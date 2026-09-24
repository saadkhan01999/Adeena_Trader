/**
 * ============================================
 * Inventory
 * ============================================
 * Everything the shop sells, by category: pricing, stock, serial tracking,
 * photos and ownership. (Called "Products" before; /products still lands here.)
 *
 * How it stays quick
 * ------------------
 * Adding, editing or deleting an item changes that one row in place - it slides
 * in, glows, or slides out - instead of reloading the list. The summary cards
 * come from the server across every item, not just the rows on this page, so
 * they do not change as you page through.
 *
 * Categories lead
 * ---------------
 * A shop thinks "which mobiles do we have", so categories are a row of picture
 * chips across the top, each with its item count, and the add form starts by
 * choosing the category from the same pictures.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package, Plus, Eye, Pencil, Trash2, LayoutGrid, List, AlertTriangle,
  TrendingUp, Boxes, ImageIcon, Tag, Cpu, Building2, History, Layers, Check,
  ArrowDownLeft, ArrowUpRight, PackageX,
} from 'lucide-react';

import PageHeader from '../../components/common/PageHeader.jsx';
import TabGuide from '../../components/common/TabGuide.jsx';
import StatCard, { StatGrid } from '../../components/common/StatCard.jsx';
import Badge from '../../components/common/Badge.jsx';
import Button, { IconButton, ButtonGroup } from '../../components/common/Button.jsx';
import DataTable, { MoneyCell } from '../../components/common/DataTable.jsx';
import Modal, { ModalFooter } from '../../components/common/Modal.jsx';
import DeleteDialog from '../../components/common/DeleteDialog.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { Urdu } from '../../components/common/Bilingual.jsx';
import { getIcon } from '../../components/common/Icon.jsx';
import {
  Input, Textarea, Select, CurrencyInput, FormRow, FormSection, FieldDisplay,
} from '../../components/common/Form.jsx';
import { CardSkeleton } from '../../components/common/Skeleton.jsx';

import { productService, categoryService, partnerService } from '../../services/entities.js';
import { useUIStore } from '../../context/uiStore.js';
import { useAuthStore } from '../../context/authStore.js';
import { useSettingsStore } from '../../context/settingsStore.js';
import { useToastStore } from '../../context/toastStore.js';
import { useTableState, useLocalStorage, useCreateFromQuery } from '../../hooks/index.js';
import { calculateMarkup, calculateProfit } from '../../utils/financialEngine.js';
import { cn, formatCurrency, formatDate, resolveFileUrl, parseNumber } from '../../utils/index.js';
import { removeRow, replaceRow, prependRow } from '../../utils/rowMotion.js';
import { cacheKey, readList, writeList, clearList } from '../../utils/listCache.js';
import { APP_LOGO_WATERMARK, PRODUCT_STATUSES, OWNERSHIP_ALLOCATIONS } from '../../constants/index.js';

const emptyItem = (settings) => ({
  name: '',
  description: '',
  category: '',
  brand: '',
  model: '',
  color: '',
  purchasePrice: '',
  cashPrice: '',
  installmentPrice: '',
  stock: 0,
  lowStockThreshold: settings?.product?.lowStockThreshold ?? 5,
  barcode: '',
  ownership: 'owner',
  partnerSharePercent: 0,
  partner: '',
  imei1: '',
  imei2: '',
  serialNumber: '',
  engineNumber: '',
  chassisNumber: '',
  registrationNumber: '',
  warrantyMonths: settings?.product?.defaultWarrantyMonths ?? 0,
  status: 'active',
});

/** The cover photo of an item, if it has one. */
const coverOf = (item) =>
  item?.primaryImage || (item?.images || []).find((i) => i.isPrimary)?.url || item?.images?.[0]?.url || null;

/** "Stock level" filter -> the API's own flags. */
const stockParams = (level) =>
  level === 'low' ? { lowStock: 'true' } : level === 'out' ? { outOfStock: 'true' } : level === 'in' ? { inStock: 'true' } : {};

export default function InventoryPage() {
  const toast = useToastStore();
  const { ownership } = useUIStore();
  const { hasPermission, user } = useAuthStore();
  const settings = useSettingsStore((s) => s.settings);
  const canManage = hasPermission('products');
  const canDelete = ['admin', 'manager'].includes(user?.role);

  // Arriving from the dashboard's low-stock alert: ?stock=low
  const initialStock = new URLSearchParams(window.location.search).get('stock') || '';

  const table = useTableState({
    initialSort: 'createdAt',
    initialFilters: { category: '', status: '', stockLevel: initialStock },
  });

  const params = useMemo(() => {
    const { stockLevel, ...rest } = table.params;
    return { ...rest, ...stockParams(stockLevel), ...(ownership !== 'all' ? { ownership } : {}) };
  }, [table.params, ownership]);
  const listKey = cacheKey('inventory', params);

  const cached = readList(listKey);
  const [items, setItems] = useState(cached?.records || []);
  const [pagination, setPagination] = useState(cached?.pagination || { page: 1, totalPages: 1, total: 0 });
  const [summary, setSummary] = useState(cached?.summary || null);
  const [categories, setCategories] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(!cached);

  const [view, setView] = useLocalStorage('at_products_view', 'table');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyItem(settings));
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ---- Load -------------------------------------------------------------
  const load = useCallback(async () => {
    const hit = readList(listKey);
    if (hit) {
      setItems(hit.records);
      setPagination(hit.pagination);
      setSummary(hit.summary);
    }
    setLoading(true);
    try {
      const response = await productService.list(params);
      const next = {
        records: response.data.products || [],
        pagination: response.data.pagination || { page: 1, totalPages: 1, total: 0 },
        summary: response.data.summary || null,
      };
      setItems(next.records);
      setPagination(next.pagination);
      setSummary(next.summary);
      writeList(listKey, next);
    } catch (error) {
      toast.apiError(error, 'Could not load the inventory.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey]);

  useEffect(() => { load(); }, [load]);

  const loadCategories = useCallback(() => {
    categoryService
      .list({ status: 'active' })
      .then((res) => setCategories(res.data.categories || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadCategories();
    partnerService.list({ limit: 100 }).then((res) => setPartners(res.data.partners || [])).catch(() => {});
  }, [loadCategories]);

  /** Summary cards and category counts move with every change. */
  const refreshFigures = () => {
    clearList('inventory');
    productService.list({ ...params, limit: 1 }).then((res) => setSummary(res.data.summary)).catch(() => {});
    loadCategories();
  };

  // ---- Form -------------------------------------------------------------
  const openCreate = (categoryId = '') => {
    setEditing(null);
    setForm({ ...emptyItem(settings), category: typeof categoryId === 'string' ? categoryId : '' });
    setPendingPhotos([]);
    setFormOpen(true);
  };
  useCreateFromQuery(canManage ? () => openCreate(table.filters.category) : null);

  const openEdit = (item) => {
    setEditing(item);
    const blank = emptyItem(settings);
    setForm(
      Object.keys(blank).reduce((acc, key) => {
        if (key === 'category') acc[key] = item.category?._id || item.category || '';
        else if (key === 'partner') acc[key] = item.partner?._id || item.partner || '';
        else acc[key] = item[key] ?? blank[key];
        return acc;
      }, {})
    );
    setPendingPhotos([]);
    setFormOpen(true);
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();

    if (!form.category) {
      toast.warning('Choose the category this item belongs to.');
      return;
    }
    if (!String(form.name).trim()) {
      toast.warning('Give the item a name.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        stock: parseNumber(form.stock),
        partner: form.ownership === 'owner' ? null : form.partner || null,
      };

      let saved;
      if (editing) {
        saved = (await productService.update(editing._id, payload)).data.product;
      } else {
        saved = (await productService.create(payload)).data.product;
      }

      // Photos chosen in the form go up once the item exists.
      if (pendingPhotos.length > 0) {
        try {
          saved = (await productService.uploadImages(saved._id, pendingPhotos)).data.product;
        } catch (error) {
          toast.apiError(error, 'The item was saved, but its photos could not be uploaded.');
        }
      }

      if (editing) {
        replaceRow(setItems, saved);
        if (viewing?._id === saved._id) setViewing(saved);
        toast.success(`"${saved.name}" updated.`);
      } else {
        prependRow(setItems, saved);
        setPagination((p) => ({ ...p, total: p.total + 1 }));
        toast.success(`"${saved.name}" added to ${saved.category?.name || 'inventory'}.`);
      }

      setFormOpen(false);
      refreshFigures();
    } catch (error) {
      toast.apiError(error, 'Could not save this item.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleted = (item) => {
    removeRow(setItems, item._id);
    setPagination((p) => ({ ...p, total: Math.max(0, p.total - 1) }));
    if (viewing?._id === item._id) setViewing(null);
    refreshFigures();
  };

  /** A photo change inside the detail view updates the row behind it too. */
  const handleItemChanged = (saved) => {
    replaceRow(setItems, saved);
    setViewing(saved);
  };

  const needRestock = (summary?.lowStock || 0) + (summary?.outOfStock || 0);
  const activeCategory = categories.find((c) => c._id === table.filters.category);

  // ---- Columns ----------------------------------------------------------
  const columns = [
    {
      accessor: 'name',
      header: 'Item',
      sortable: true,
      primary: true,
      render: (item) => (
        <div className="flex items-center gap-3 min-w-0">
          <Thumb item={item} />
          <div className="min-w-0">
            <p className="font-semibold text-navy-950 truncate">{item.name}</p>
            <p className="text-2xs text-navy-500 truncate">
              {[item.brand, item.model, item.color].filter(Boolean).join(' · ') || item.sku || '—'}
            </p>
          </div>
        </div>
      ),
      exportValue: (item) => item.name,
    },
    {
      key: 'category',
      header: 'Category',
      secondary: true,
      render: (item) => <CategoryChip category={item.category} />,
      exportValue: (item) => item.category?.name,
    },
    {
      accessor: 'purchasePrice',
      header: 'Cost',
      align: 'right',
      sortable: true,
      hideOnMobile: true,
      render: (item) => <MoneyCell value={item.purchasePrice} className="text-navy-600" />,
      exportValue: (item) => item.purchasePrice,
    },
    {
      accessor: 'cashPrice',
      header: 'Cash price',
      align: 'right',
      sortable: true,
      render: (item) => <MoneyCell value={item.cashPrice} className="text-navy-950 font-semibold" />,
      exportValue: (item) => item.cashPrice,
    },
    {
      accessor: 'installmentPrice',
      header: 'Installment',
      align: 'right',
      sortable: true,
      hideOnMobile: true,
      render: (item) => <MoneyCell value={item.installmentPrice} showZero={false} className="text-gold-700" />,
      exportValue: (item) => item.installmentPrice,
    },
    {
      accessor: 'stock',
      header: 'Stock',
      align: 'center',
      sortable: true,
      render: (item) => <StockBadge item={item} />,
      exportValue: (item) => item.stock,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (item) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconButton icon={Eye} label="View" size="icon-sm" onClick={(e) => { e.stopPropagation(); setViewing(item); }} />
          {canManage && (
            <IconButton icon={Pencil} label="Edit" size="icon-sm" onClick={(e) => { e.stopPropagation(); openEdit(item); }} />
          )}
          {canDelete && (
            <IconButton
              icon={Trash2}
              label="Delete"
              size="icon-sm"
              className="text-danger-500 hover:bg-danger-50"
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); }}
            />
          )}
        </div>
      ),
    },
  ];

  const emptyState = (
    <EmptyState
      icon={Package}
      title={table.hasActiveFilters ? 'No matching items' : 'Your inventory is empty'}
      message={
        table.hasActiveFilters
          ? 'Try clearing your search or filters.'
          : 'Add your first item - choose its category, then its prices and stock.'
      }
      action={
        canManage && !table.hasActiveFilters ? (
          <Button variant="gold" icon={Plus} onClick={() => openCreate()}>Add item</Button>
        ) : null
      }
    />
  );

  return (
    <div className="space-y-5">
      <TabGuide id="inventory" />

      <PageHeader
        title="Inventory"
        subtitle={`${(summary?.items ?? pagination.total).toLocaleString('en-PK')} items · ${(summary?.units ?? 0).toLocaleString('en-PK')} units in stock`}
        icon={Boxes}
        actions={
          <>
            <ButtonGroup>
              <Button
                variant={view === 'table' ? 'primary' : 'secondary'}
                size="icon"
                onClick={() => setView('table')}
                title="Table view"
                aria-label="Table view"
              >
                <List size={16} />
              </Button>
              <Button
                variant={view === 'grid' ? 'primary' : 'secondary'}
                size="icon"
                onClick={() => setView('grid')}
                title="Card view"
                aria-label="Card view"
              >
                <LayoutGrid size={16} />
              </Button>
            </ButtonGroup>

            {canManage && (
              <Button variant="gold" icon={Plus} onClick={() => openCreate(table.filters.category)}>
                Add item
              </Button>
            )}
          </>
        }
      />

      <StatGrid columns={4}>
        <StatCard label="Stock at cost" value={summary?.costValue} icon={Boxes} variant="navy" loading={!summary} />
        <StatCard
          label="Retail value"
          value={summary?.retailValue}
          icon={TrendingUp}
          variant="gold"
          loading={!summary}
          subtitle={summary ? `${formatCurrency((summary.retailValue || 0) - (summary.costValue || 0))} potential profit` : ''}
        />
        <StatCard label="Units in stock" value={summary?.units} icon={Package} variant="blue" isCurrency={false} loading={!summary} />
        <StatCard
          label="Need restocking"
          value={needRestock}
          icon={AlertTriangle}
          variant={summary?.outOfStock > 0 ? 'red' : 'amber'}
          isCurrency={false}
          loading={!summary}
          subtitle={`${summary?.outOfStock || 0} out of stock`}
          onClick={needRestock > 0 ? () => table.setFilter('stockLevel', 'low') : undefined}
        />
      </StatGrid>

      {/* ---- Low stock banner ---- */}
      {needRestock > 0 && table.filters.stockLevel !== 'low' && table.filters.stockLevel !== 'out' && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning-300 bg-warning-50 px-4 py-3 soft-in">
          <AlertTriangle size={20} className="text-warning-600 flex-shrink-0" />
          <p className="flex-1 min-w-[200px] text-sm text-navy-800">
            <strong>{needRestock} item{needRestock === 1 ? '' : 's'}</strong> need restocking
            {summary?.outOfStock > 0 && <> - <strong className="text-danger-700">{summary.outOfStock} out of stock</strong></>}.
            <Urdu className="ms-2 text-xs text-navy-600">کچھ اشیاء کم ہیں</Urdu>
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => table.setFilter('stockLevel', 'low')}>Show low</Button>
            {summary?.outOfStock > 0 && (
              <Button size="sm" variant="danger" icon={PackageX} onClick={() => table.setFilter('stockLevel', 'out')}>Show out of stock</Button>
            )}
          </div>
        </div>
      )}

      {/* ---- Category chips ---- */}
      <CategoryStrip
        categories={categories}
        active={table.filters.category}
        onPick={(id) => table.setFilter('category', id)}
        total={summary?.items}
      />

      {activeCategory && (
        <p className="text-sm text-navy-600 -mt-2">
          Showing <strong className="text-navy-900">{activeCategory.name}</strong> ·{' '}
          <button type="button" className="text-gold-700 font-semibold hover:underline" onClick={() => table.setFilter('category', '')}>
            show all categories
          </button>
        </p>
      )}

      {/* ---- Grid view ---- */}
      {view === 'grid' ? (
        <div className="space-y-4">
          <div className="card p-3 sm:p-4">
            <InventoryFilters table={table} categories={categories} />
          </div>

          {loading && items.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3">
              {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : items.length === 0 ? (
            <div className="card">{emptyState}</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3">
              {items.map((item, index) => (
                <ItemCard
                  key={item._id}
                  item={item}
                  index={index}
                  onView={() => setViewing(item)}
                  onEdit={canManage ? () => openEdit(item) : undefined}
                  onDelete={canDelete ? () => setDeleteTarget(item) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          serverSide
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalRecords={pagination.total}
          onPageChange={table.setPage}
          pageSize={table.pageSize}
          onPageSizeChange={table.setPageSize}
          searchValue={table.search}
          onSearchChange={table.setSearch}
          searchPlaceholder="Search by name, brand, barcode, IMEI or serial…"
          onRowClick={setViewing}
          exportFilename="inventory"
          printable
          title="Inventory"
          activeFilterCount={Object.values(table.filters).filter(Boolean).length}
          onClearFilters={table.resetFilters}
          filters={<InventoryFilters table={table} categories={categories} />}
          rowClassName={(item) => (item.stock === 0 ? 'bg-danger-50/40' : '')}
          emptyState={emptyState}
        />
      )}

      <ItemFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        saving={saving}
        categories={categories}
        partners={partners}
        settings={settings}
        pendingPhotos={pendingPhotos}
        setPendingPhotos={setPendingPhotos}
      />

      <ItemDetailModal
        item={viewing}
        onClose={() => setViewing(null)}
        onEdit={(item) => { setViewing(null); openEdit(item); }}
        onDelete={canDelete ? (item) => setDeleteTarget(item) : undefined}
        onChanged={handleItemChanged}
        canManage={canManage}
      />

      <DeleteDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete this item?"
        describe={(item) =>
          `"${item.name}" will be deleted permanently${item.stock > 0 ? `, with its ${item.stock} unit(s) of stock` : ''}. ` +
          'Past invoices keep its name and price. To stop selling it but keep it, edit it and set it to Archived instead.'
        }
        onDelete={(item, extra) => productService.delete(item._id, extra)}
        onDeleted={handleDeleted}
      />
    </div>
  );
}

/* ============================================================================
 * Pieces
 * ========================================================================== */

/** Item photo, or the category's picture, or the brand mark. */
function Thumb({ item, size = 'md' }) {
  const src = coverOf(item) || item?.category?.image;
  const Icon = getIcon(item?.category?.icon || 'Package');
  return (
    <span
      className={cn(
        'flex items-center justify-center rounded-xl bg-gold-50 text-gold-600 flex-shrink-0 overflow-hidden border border-gold-200/70',
        size === 'lg' ? 'w-20 h-20' : 'w-11 h-11'
      )}
    >
      {src ? (
        <img src={resolveFileUrl(src)} alt="" loading="lazy" className="w-full h-full object-cover" />
      ) : (
        <Icon size={size === 'lg' ? 30 : 19} />
      )}
    </span>
  );
}

/** The category as a small chip with its picture or icon. */
function CategoryChip({ category }) {
  if (!category?.name) return <span className="text-navy-400">—</span>;
  const Icon = getIcon(category.icon || 'Package');
  return (
    <span className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full bg-navy-50 border border-navy-100 text-xs font-medium text-navy-700 max-w-full">
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white text-gold-600 overflow-hidden flex-shrink-0">
        {category.image ? (
          <img src={resolveFileUrl(category.image)} alt="" className="w-full h-full object-cover" />
        ) : (
          <Icon size={12} />
        )}
      </span>
      <span className="truncate">{category.name}</span>
    </span>
  );
}

/** Horizontal strip of category picture-chips with counts. */
function CategoryStrip({ categories, active, onPick, total }) {
  if (!categories.length) return null;
  return (
    <div className="flex gap-2.5 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1 touch-scroll">
      <StripChip label="All items" count={total} active={!active} onClick={() => onPick('')} icon={Layers} />
      {categories.map((category) => (
        <StripChip
          key={category._id}
          label={category.name}
          count={category.productCount}
          image={category.image}
          icon={getIcon(category.icon || 'Package')}
          warn={(category.lowStockCount || 0) + (category.outOfStockCount || 0)}
          active={active === category._id}
          onClick={() => onPick(active === category._id ? '' : category._id)}
        />
      ))}
    </div>
  );
}

function StripChip({ label, count, image, icon: Icon, active, onClick, warn = 0 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'relative flex items-center gap-2.5 pl-1.5 pr-4 py-1.5 rounded-full border-2 flex-shrink-0 transition-all duration-200',
        active
          ? 'bg-ink-950 border-gold-500 text-white shadow-glow'
          : 'bg-white border-navy-100 text-navy-800 hover:border-gold-400 hover:-translate-y-0.5'
      )}
    >
      <span
        className={cn(
          'flex items-center justify-center w-9 h-9 rounded-full overflow-hidden flex-shrink-0',
          active ? 'bg-accent-button text-on-accent' : 'bg-gold-50 text-gold-600'
        )}
      >
        {image ? <img src={resolveFileUrl(image)} alt="" className="w-full h-full object-cover" /> : <Icon size={18} />}
      </span>
      <span className="text-left leading-tight">
        <span className="block text-sm font-semibold whitespace-nowrap">{label}</span>
        <span className={cn('block text-2xs', active ? 'text-gold-300' : 'text-navy-500')}>
          {(count ?? 0).toLocaleString('en-PK')} item{count === 1 ? '' : 's'}
        </span>
      </span>
      {warn > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-warning-500 text-ink-950 text-[10px] font-bold flex items-center justify-center" title={`${warn} low or out of stock`}>
          {warn}
        </span>
      )}
    </button>
  );
}

function InventoryFilters({ table, categories }) {
  return (
    <FormRow cols={3}>
      <Select
        label="Category"
        value={table.filters.category}
        onChange={(e) => table.setFilter('category', e.target.value)}
        placeholder="All categories"
        options={categories.map((c) => ({ value: c._id, label: c.name }))}
      />
      <Select
        label="Status"
        value={table.filters.status}
        onChange={(e) => table.setFilter('status', e.target.value)}
        placeholder="All statuses"
        options={Object.entries(PRODUCT_STATUSES).map(([value, meta]) => ({ value, label: meta.label }))}
      />
      <Select
        label="Stock level"
        value={table.filters.stockLevel}
        onChange={(e) => table.setFilter('stockLevel', e.target.value)}
        placeholder="Any level"
        options={[
          { value: 'low', label: 'Low stock (at or under reorder level)' },
          { value: 'out', label: 'Out of stock' },
          { value: 'in', label: 'In stock' },
        ]}
      />
    </FormRow>
  );
}

/** Stock level as a colour-coded badge. */
function StockBadge({ item }) {
  if (item.stock <= 0) return <Badge variant="danger" size="sm">Out of stock</Badge>;
  if (item.stock <= item.lowStockThreshold) return <Badge variant="warning" size="sm">{item.stock} left</Badge>;
  return <Badge variant="success" size="sm">{item.stock} in stock</Badge>;
}

/**
 * One item in the card grid - photo first, because on a counter the picture is
 * how an item is recognised, then the two prices that get asked for.
 */
function ItemCard({ item, index, onView, onEdit, onDelete }) {
  const out = item.stock <= 0;
  const cover = coverOf(item) || item.category?.image;

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden cursor-pointer stagger',
        'rounded-xl bg-white border border-ink-200',
        'transition-[border-color,box-shadow,transform] duration-200',
        'hover:border-gold-400 hover:shadow-card-hover hover:-translate-y-0.5',
        item.__leaving && 'row-leave',
        out && 'opacity-80'
      )}
      style={{ '--i': index }}
      onClick={onView}
    >
      <div className="relative aspect-square bg-ink-50 overflow-hidden">
        {cover ? (
          <img
            src={resolveFileUrl(cover)}
            alt={item.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <span className="flex items-center justify-center w-full h-full">
            <img src={APP_LOGO_WATERMARK} alt="" className="w-1/2 opacity-25" />
          </span>
        )}

        <span className="absolute top-2 left-2"><StockBadge item={item} /></span>

        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 max-sm:opacity-100 transition-opacity">
          {onEdit && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              aria-label="Edit this item"
              className="p-1.5 rounded-md bg-white/95 text-ink-600 hover:bg-white hover:text-gold-700 shadow-xs transition-colors"
            >
              <Pencil size={13} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              aria-label="Delete this item"
              className="p-1.5 rounded-md bg-white/95 text-danger-500 hover:bg-white shadow-xs transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="p-3 flex-1 flex flex-col">
        <h3 className="text-sm font-semibold text-ink-950 line-clamp-2 leading-snug">{item.name}</h3>
        <p className="text-2xs text-ink-500 mt-0.5 truncate">
          {[item.brand, item.model].filter(Boolean).join(' ') || ' '}
        </p>
        <span className="mt-1.5 self-start max-w-full"><CategoryChip category={item.category} /></span>

        <div className="mt-auto pt-3">
          <div className="flex items-end justify-between gap-2 rounded-lg bg-gold-50 border border-gold-200 px-2.5 py-2">
            <div className="min-w-0">
              <p className="text-2xs text-ink-500">Cash</p>
              <p className="text-sm font-bold text-ink-950 tabular truncate">{formatCurrency(item.cashPrice)}</p>
            </div>
            {item.installmentPrice > 0 && (
              <div className="text-right min-w-0">
                <p className="text-2xs text-ink-500">Instalment</p>
                <p className="text-sm font-bold text-gold-700 tabular truncate">{formatCurrency(item.installmentPrice)}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/* ============================================================================
 * Form
 * ========================================================================== */

function ItemFormModal({
  isOpen, onClose, editing, form, setForm, onSubmit, saving, categories, partners, settings,
  pendingPhotos, setPendingPhotos,
}) {
  const set = (patch) => setForm((current) => ({ ...current, ...patch }));

  // Live margin, so pricing is decided with the number visible
  const margin = useMemo(() => {
    if (!form.purchasePrice || !form.cashPrice) return null;
    return calculateProfit(form.purchasePrice, form.cashPrice, 1);
  }, [form.purchasePrice, form.cashPrice]);

  const instalmentMargin = useMemo(() => {
    if (!form.purchasePrice || !form.installmentPrice) return null;
    return calculateProfit(form.purchasePrice, form.installmentPrice, 1);
  }, [form.purchasePrice, form.installmentPrice]);

  const suggestInstallmentPrice = () => {
    const markup = settings?.product?.defaultInstallmentMarkupPercent ?? 20;
    const base = parseNumber(form.cashPrice) || parseNumber(form.purchasePrice);
    set({ installmentPrice: String(calculateMarkup(base, markup).sellingPrice) });
  };

  const chosen = categories.find((c) => c._id === form.category);
  const stockChanged = editing && parseNumber(form.stock) !== parseNumber(editing.stock);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Edit item' : 'Add item to inventory'}
      subtitle={editing?.name || (chosen ? `Category: ${chosen.name}` : 'Start by choosing its category')}
      icon={Package}
      size="lg"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="gold" onClick={onSubmit} isLoading={saving} loadingText="Saving…" icon={Check}>
            {editing ? 'Save changes' : 'Add item'}
          </Button>
        </ModalFooter>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        {/* ---- 1. Category, as pictures ---- */}
        <FormSection title="Choose a category" icon={Layers} description="Every item belongs to one category">
          {categories.length === 0 ? (
            <p className="text-sm text-warning-700 bg-warning-50 border border-warning-200 rounded-lg p-3">
              No categories yet. Add one in the Categories screen first (for example Mobiles or Solar Panels).
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {categories.map((category) => {
                const Icon = getIcon(category.icon || 'Package');
                const selected = form.category === category._id;
                return (
                  <button
                    key={category._id}
                    type="button"
                    onClick={() => set({ category: category._id })}
                    aria-pressed={selected}
                    className={cn(
                      'relative flex items-center gap-2.5 p-2 rounded-xl border-2 text-left transition-all duration-200',
                      selected
                        ? 'border-gold-500 bg-gold-50 shadow-glow'
                        : 'border-navy-100 bg-white hover:border-gold-300'
                    )}
                  >
                    <span
                      className={cn(
                        'flex items-center justify-center w-11 h-11 rounded-lg overflow-hidden flex-shrink-0',
                        selected ? 'bg-accent-button text-on-accent' : 'bg-gold-50 text-gold-600'
                      )}
                    >
                      {category.image ? (
                        <img src={resolveFileUrl(category.image)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Icon size={21} />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-navy-900 truncate">{category.name}</span>
                      <span className="block text-2xs text-navy-500">{category.productCount ?? 0} items</span>
                    </span>
                    {selected && (
                      <span className="absolute top-1.5 right-1.5 flex items-center justify-center w-5 h-5 rounded-full bg-gold-500 text-on-accent">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </FormSection>

        {/* ---- 2. Basics ---- */}
        <FormSection title="Basics" icon={Tag}>
          <Input
            label="Item name"
            required
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="e.g. Samsung Galaxy A15 128GB"
          />
          <FormRow cols={3}>
            <Input label="Brand" value={form.brand} onChange={(e) => set({ brand: e.target.value })} />
            <Input label="Model" value={form.model} onChange={(e) => set({ model: e.target.value })} />
            <Input label="Colour" value={form.color} onChange={(e) => set({ color: e.target.value })} />
          </FormRow>
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            rows={2}
            maxLength={500}
          />
        </FormSection>

        {/* ---- 3. Pricing ---- */}
        <FormSection title="Pricing" icon={TrendingUp}>
          <FormRow cols={3}>
            <CurrencyInput
              label="Purchase cost"
              value={form.purchasePrice}
              onChange={(e) => set({ purchasePrice: e.target.value })}
              showPreview={false}
            />
            <CurrencyInput
              label="Cash price"
              required
              value={form.cashPrice}
              onChange={(e) => set({ cashPrice: e.target.value })}
              showPreview={false}
            />
            <CurrencyInput
              label="Installment price"
              value={form.installmentPrice}
              onChange={(e) => set({ installmentPrice: e.target.value })}
              showPreview={false}
            />
          </FormRow>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-navy-50/60 border border-navy-100 px-3 py-2.5">
            <Button variant="secondary" size="sm" onClick={suggestInstallmentPrice} disabled={!form.cashPrice && !form.purchasePrice}>
              Suggest installment price (+{settings?.product?.defaultInstallmentMarkupPercent ?? 20}%)
            </Button>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium tabular">
              {margin && (
                <span className={margin.profit >= 0 ? 'text-success-700' : 'text-danger-600'}>
                  Cash {margin.profit >= 0 ? 'profit' : 'loss'} {formatCurrency(Math.abs(margin.profit))}
                  <span className="text-navy-400"> · {margin.marginPercentage.toFixed(1)}%</span>
                </span>
              )}
              {instalmentMargin && (
                <span className={instalmentMargin.profit >= 0 ? 'text-gold-700' : 'text-danger-600'}>
                  Instalment {instalmentMargin.profit >= 0 ? 'profit' : 'loss'} {formatCurrency(Math.abs(instalmentMargin.profit))}
                </span>
              )}
              {!margin && <span className="text-navy-400">Enter cost and price to see the profit</span>}
            </div>
          </div>
        </FormSection>

        {/* ---- 4. Stock ---- */}
        <FormSection title="Stock" icon={Boxes}>
          <FormRow cols={3}>
            <Input
              label="Quantity in stock"
              type="number"
              min={0}
              value={form.stock}
              onChange={(e) => set({ stock: e.target.value })}
              hint={
                editing
                  ? stockChanged
                    ? `Will be recorded as a correction (${parseNumber(form.stock) - parseNumber(editing.stock) > 0 ? '+' : ''}${parseNumber(form.stock) - parseNumber(editing.stock)})`
                    : 'Purchases and sales change this automatically'
                  : 'Opening stock'
              }
            />
            <Input
              label="Reorder at"
              type="number"
              min={0}
              value={form.lowStockThreshold}
              onChange={(e) => set({ lowStockThreshold: parseNumber(e.target.value) })}
              hint="Low-stock alert at this level"
            />
            <Input
              label="Warranty (months)"
              type="number"
              min={0}
              value={form.warrantyMonths}
              onChange={(e) => set({ warrantyMonths: parseNumber(e.target.value) })}
            />
          </FormRow>
          <FormRow cols={2}>
            <Input label="Barcode" value={form.barcode} onChange={(e) => set({ barcode: e.target.value })} />
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => set({ status: e.target.value })}
              options={Object.entries(PRODUCT_STATUSES).map(([value, meta]) => ({ value, label: meta.label }))}
            />
          </FormRow>
        </FormSection>

        {/* ---- 5. Serial tracking ---- */}
        <FormSection title="Serial tracking" icon={Cpu} description="For phones, bikes and anything with a unique identifier">
          <FormRow cols={2}>
            <Input label="IMEI 1" value={form.imei1} onChange={(e) => set({ imei1: e.target.value })} />
            <Input label="IMEI 2" value={form.imei2} onChange={(e) => set({ imei2: e.target.value })} />
          </FormRow>
          <FormRow cols={2}>
            <Input label="Serial number" value={form.serialNumber} onChange={(e) => set({ serialNumber: e.target.value })} />
            <Input label="Registration number" value={form.registrationNumber} onChange={(e) => set({ registrationNumber: e.target.value })} />
          </FormRow>
          <FormRow cols={2}>
            <Input label="Engine number" value={form.engineNumber} onChange={(e) => set({ engineNumber: e.target.value })} />
            <Input label="Chassis number" value={form.chassisNumber} onChange={(e) => set({ chassisNumber: e.target.value })} />
          </FormRow>
        </FormSection>

        {/* ---- 6. Ownership ---- */}
        <FormSection title="Ownership" icon={Building2} description="Decides whose stock and whose profit this is">
          <FormRow cols={3}>
            <Select label="Owned by" value={form.ownership} onChange={(e) => set({ ownership: e.target.value })} options={OWNERSHIP_ALLOCATIONS} />
            {form.ownership !== 'owner' && (
              <>
                <Select
                  label="Partner"
                  value={form.partner}
                  onChange={(e) => set({ partner: e.target.value })}
                  placeholder="Select the partner"
                  options={partners.map((p) => ({ value: p._id, label: p.name }))}
                />
                <Input
                  label="Partner share"
                  type="number"
                  min={0}
                  max={100}
                  value={form.partnerSharePercent}
                  onChange={(e) => set({ partnerSharePercent: parseNumber(e.target.value) })}
                  suffix="%"
                />
              </>
            )}
          </FormRow>
        </FormSection>

        {/* ---- 7. Photos ---- */}
        <FormSection title="Photos" icon={ImageIcon} description="Shown in the card view and on the counter">
          <label className="btn-secondary btn w-full justify-center cursor-pointer">
            <ImageIcon size={15} />
            {pendingPhotos.length ? `${pendingPhotos.length} photo(s) ready to upload` : 'Choose photos'}
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              multiple
              className="hidden"
              onChange={(e) => setPendingPhotos(Array.from(e.target.files || []))}
            />
          </label>
          {pendingPhotos.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {pendingPhotos.map((file, i) => (
                <img key={i} src={URL.createObjectURL(file)} alt="" className="w-16 h-16 rounded-lg object-cover border border-navy-200" />
              ))}
            </div>
          )}
          {editing && (editing.images || []).length > 0 && (
            <p className="text-2xs text-navy-500">
              This item already has {editing.images.length} photo(s). Remove or reorder them from its detail view.
            </p>
          )}
        </FormSection>

        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}

/* ============================================================================
 * Detail
 * ========================================================================== */

const MOVEMENT_LABELS = {
  sale: 'Sold',
  purchase: 'Purchased',
  buy_from_other: 'Bought in',
  return: 'Returned',
  adjustment: 'Adjustment',
};

function ItemDetailModal({ item, onClose, onEdit, onDelete, onChanged, canManage }) {
  const toast = useToastStore();
  const [uploading, setUploading] = useState(false);
  const [local, setLocal] = useState(item);
  const [movements, setMovements] = useState(null);

  useEffect(() => {
    setLocal(item);
    setMovements(null);
    if (!item?._id) return;
    productService
      .get(item._id)
      .then((res) => {
        setLocal((current) => ({ ...current, ...res.data.product }));
        setMovements(res.data.movements || []);
      })
      .catch(() => setMovements([]));
  }, [item?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!local) return null;

  const apply = (saved, message) => {
    setLocal(saved);
    onChanged?.(saved);
    if (message) toast.success(message);
  };

  const handleUpload = async (files) => {
    setUploading(true);
    try {
      apply((await productService.uploadImages(local._id, files)).data.product, 'Photos uploaded.');
    } catch (error) {
      toast.apiError(error, 'Could not upload those photos.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async (index) => {
    try {
      apply((await productService.deleteImage(local._id, index)).data.product, 'Photo removed.');
    } catch (error) {
      toast.apiError(error);
    }
  };

  const handleSetPrimary = async (index) => {
    try {
      apply((await productService.setPrimaryImage(local._id, index)).data.product, 'Cover photo updated.');
    } catch (error) {
      toast.apiError(error);
    }
  };

  const margin = local.purchasePrice && local.cashPrice ? calculateProfit(local.purchasePrice, local.cashPrice, 1) : null;

  return (
    <Modal
      isOpen={Boolean(item)}
      onClose={onClose}
      title={local.name}
      subtitle={[local.brand, local.model, local.color].filter(Boolean).join(' · ')}
      icon={Package}
      size="lg"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {onDelete && (
            <Button variant="secondary" icon={Trash2} className="text-danger-600" onClick={() => { onClose(); onDelete(local); }}>
              Delete
            </Button>
          )}
          {canManage && (
            <Button variant="gold" icon={Pencil} onClick={() => onEdit(local)}>Edit</Button>
          )}
        </ModalFooter>
      }
    >
      <div className="space-y-5 soft-in">
        {/* Identity */}
        <div className="flex items-center gap-4">
          <Thumb item={local} size="lg" />
          <div className="min-w-0 space-y-1.5">
            <CategoryChip category={local.category} />
            <div className="flex flex-wrap gap-1.5">
              <StockBadge item={local} />
              {local.status === 'archived' && <Badge variant="neutral" size="sm">Archived</Badge>}
            </div>
            {local.sku && <p className="text-2xs text-navy-500 font-mono">{local.sku}</p>}
          </div>
        </div>

        {/* Prices */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Cost', value: local.purchasePrice, tone: 'text-navy-700', bg: 'bg-navy-50 border-navy-100' },
            { label: 'Cash price', value: local.cashPrice, tone: 'text-navy-950', bg: 'bg-white border-navy-200' },
            { label: 'Installment', value: local.installmentPrice, tone: 'text-gold-700', bg: 'bg-gold-50 border-gold-200' },
          ].map((p) => (
            <div key={p.label} className={cn('rounded-xl border p-3 text-center', p.bg)}>
              <p className="text-2xs text-navy-500">{p.label}</p>
              <p className={cn('text-sm sm:text-base font-bold tabular mt-0.5', p.tone)}>{formatCurrency(p.value)}</p>
            </div>
          ))}
        </div>

        {margin && (
          <p className="text-center text-xs text-navy-600">
            Margin on a cash sale:{' '}
            <strong className={margin.profit >= 0 ? 'text-success-700' : 'text-danger-600'}>
              {formatCurrency(margin.profit)} ({margin.marginPercentage.toFixed(1)}%)
            </strong>
            {' · '}stock worth <strong>{formatCurrency(parseNumber(local.purchasePrice) * parseNumber(local.stock))}</strong> at cost
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <FieldDisplay label="In stock" value={`${local.stock} units`} />
          <FieldDisplay label="Reorder at" value={local.lowStockThreshold} />
          <FieldDisplay label="Warranty" value={local.warrantyMonths ? `${local.warrantyMonths} months` : '—'} />
          <FieldDisplay label="Barcode" value={local.barcode} mono />
          <FieldDisplay label="Ownership" value={OWNERSHIP_ALLOCATIONS.find((o) => o.value === local.ownership)?.label || local.ownership} />
          {local.partner?.name && <FieldDisplay label="Partner" value={`${local.partner.name} (${local.partnerSharePercent || 0}%)`} />}
          <FieldDisplay label="Added" value={formatDate(local.createdAt)} />
        </div>

        {(local.imei1 || local.imei2 || local.serialNumber || local.engineNumber || local.chassisNumber || local.registrationNumber) && (
          <FormSection title="Serial tracking" icon={Cpu}>
            <div className="grid grid-cols-2 gap-3">
              <FieldDisplay label="IMEI 1" value={local.imei1} mono />
              <FieldDisplay label="IMEI 2" value={local.imei2} mono />
              <FieldDisplay label="Serial" value={local.serialNumber} mono />
              <FieldDisplay label="Registration" value={local.registrationNumber} mono />
              <FieldDisplay label="Engine" value={local.engineNumber} mono />
              <FieldDisplay label="Chassis" value={local.chassisNumber} mono />
            </div>
          </FormSection>
        )}

        {local.description && <FieldDisplay label="Description" value={local.description} />}

        {/* Stock history */}
        <FormSection title="Stock history" icon={History}>
          {movements === null ? (
            <div className="space-y-2">
              <div className="skeleton h-8 w-full" />
              <div className="skeleton h-8 w-full" />
            </div>
          ) : movements.length === 0 ? (
            <p className="text-sm text-navy-500">No stock movements recorded yet.</p>
          ) : (
            <ul className="divide-y divide-navy-100 rounded-lg border border-navy-100 overflow-hidden">
              {movements.map((m) => (
                <li key={m._id} className="flex items-center gap-3 px-3 py-2 bg-white">
                  <span
                    className={cn(
                      'flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0',
                      m.quantity >= 0 ? 'bg-success-50 text-success-600' : 'bg-danger-50 text-danger-600'
                    )}
                  >
                    {m.quantity >= 0 ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-navy-900">
                      {MOVEMENT_LABELS[m.type] || m.type}
                      {m.reference && <span className="text-navy-500"> · {m.reference}</span>}
                    </span>
                    <span className="block text-2xs text-navy-500">
                      {formatDate(m.movementDate || m.createdAt)} · {m.quantityBefore} → {m.quantityAfter}
                    </span>
                  </span>
                  <span className={cn('text-sm font-bold tabular', m.quantity >= 0 ? 'text-success-700' : 'text-danger-600')}>
                    {m.quantity > 0 ? '+' : ''}{m.quantity}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </FormSection>

        {/* Photos */}
        {canManage && (
          <FormSection title="Photos" icon={ImageIcon}>
            <label className="btn-secondary btn w-full justify-center cursor-pointer">
              <ImageIcon size={15} />
              {uploading ? 'Uploading…' : 'Add photos'}
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={(e) => e.target.files?.length && handleUpload(e.target.files)}
              />
            </label>

            {(local.images || []).length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {local.images.map((image, index) => (
                  <figure
                    key={image.url || index}
                    className={cn(
                      'relative group aspect-square rounded-lg overflow-hidden border',
                      image.isPrimary ? 'border-gold-500 ring-2 ring-gold-500/30' : 'border-navy-200'
                    )}
                  >
                    <img src={resolveFileUrl(image.url || image.data)} alt="" className="w-full h-full object-cover" />
                    <figcaption className="absolute inset-x-0 top-0 flex justify-end gap-1 p-1 bg-gradient-to-b from-navy-950/70 to-transparent opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity">
                      {!image.isPrimary && (
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(index)}
                          aria-label="Use as cover photo"
                          className="px-1.5 py-0.5 rounded bg-white/90 text-navy-700 hover:bg-white text-2xs font-medium"
                        >
                          Cover
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        aria-label="Remove photo"
                        className="p-1 rounded bg-danger-500 text-white hover:bg-danger-600"
                      >
                        <Trash2 size={11} />
                      </button>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </FormSection>
        )}
      </div>
    </Modal>
  );
}
