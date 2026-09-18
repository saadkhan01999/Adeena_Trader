/**
 * ============================================
 * Products
 * ============================================
 * The catalogue: pricing, stock, serial tracking and ownership allocation.
 *
 * Two views, because two jobs
 * ---------------------------
 * A grid with photos is how you show a customer what is available; a table is
 * how you audit stock and prices. The toggle is remembered per device.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package, Plus, Eye, Pencil, Trash2, LayoutGrid, List, AlertTriangle,
  TrendingUp, Boxes, ImageIcon, Tag, Cpu, Building2, ShoppingCart,
} from 'lucide-react';

import PageHeader from '../../components/common/PageHeader.jsx';
import TabGuide from '../../components/common/TabGuide.jsx';
import StatCard, { StatGrid } from '../../components/common/StatCard.jsx';
import Badge from '../../components/common/Badge.jsx';
import Button, { IconButton, ButtonGroup } from '../../components/common/Button.jsx';
import DataTable, { MoneyCell } from '../../components/common/DataTable.jsx';
import Modal, { ModalFooter } from '../../components/common/Modal.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import {
  Input, Textarea, Select, CurrencyInput, FormRow, FormSection, FieldDisplay,
} from '../../components/common/Form.jsx';
import { CardSkeleton } from '../../components/common/Skeleton.jsx';

import { productService, categoryService, partnerService } from '../../services/entities.js';
import { useUIStore } from '../../context/uiStore.js';
import { useAuthStore } from '../../context/authStore.js';
import { useSettingsStore } from '../../context/settingsStore.js';
import { useToastStore } from '../../context/toastStore.js';
import { useTableState, useLocalStorage } from '../../hooks/index.js';
import { calculateMarkup, calculateProfit } from '../../utils/financialEngine.js';
import { cn, formatCurrency, resolveFileUrl, parseNumber, sumBy } from '../../utils/index.js';
import { PRODUCT_STATUSES, OWNERSHIP_ALLOCATIONS } from '../../constants/index.js';

const emptyProduct = (settings) => ({
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

export default function ProductsPage() {
  const toast = useToastStore();
  const { ownership } = useUIStore();
  const { hasPermission } = useAuthStore();
  const settings = useSettingsStore((s) => s.settings);

  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [categories, setCategories] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useLocalStorage('at_products_view', 'table');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyProduct(settings));
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const table = useTableState({
    initialSort: 'name',
    initialFilters: { category: '', status: '', stockLevel: '' },
  });

  // ---- Load -------------------------------------------------------------
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await productService.list({ ...table.params, ownership });
      setProducts(response.data.products || []);
      setPagination(response.data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      toast.apiError(error, 'Could not load products.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.params, ownership]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.all([
      categoryService.list({ limit: 100, status: 'active' }),
      partnerService.list({ limit: 100 }),
    ])
      .then(([categoryRes, partnerRes]) => {
        setCategories(categoryRes.data.categories || []);
        setPartners(partnerRes.data.partners || []);
      })
      .catch(() => {});
  }, []);

  // ---- Form -------------------------------------------------------------
  const openCreate = () => {
    setEditing(null);
    setForm(emptyProduct(settings));
    setFormOpen(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    const blank = emptyProduct(settings);
    setForm(
      Object.keys(blank).reduce((acc, key) => {
        // `category` and `partner` arrive populated; the form needs the id
        if (key === 'category') acc[key] = product.category?._id || product.category || '';
        else if (key === 'partner') acc[key] = product.partner?._id || product.partner || '';
        else acc[key] = product[key] ?? blank[key];
        return acc;
      }, {})
    );
    setFormOpen(true);
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();

    if (!form.name.trim() || !form.category) {
      toast.warning('A product name and a category are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form, partner: form.ownership === 'owner' ? null : form.partner || null };

      if (editing) {
        await productService.update(editing._id, payload);
        toast.success('Product updated.');
      } else {
        await productService.create(payload);
        toast.success('Product added.');
      }
      setFormOpen(false);
      load();
    } catch (error) {
      toast.apiError(error, 'Could not save this product.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      const response = await productService.delete(deleteTarget._id);
      toast.success(response?.message || 'Product removed.');
      setDeleteTarget(null);
      load();
    } catch (error) {
      toast.apiError(error);
    }
  };

  // ---- Derived ----------------------------------------------------------
  const stats = useMemo(
    () => ({
      stockValue: products.reduce(
        (sum, p) => sum + parseNumber(p.purchasePrice) * parseNumber(p.stock),
        0
      ),
      retailValue: products.reduce(
        (sum, p) => sum + parseNumber(p.cashPrice) * parseNumber(p.stock),
        0
      ),
      units: sumBy(products, 'stock'),
      lowStock: products.filter((p) => p.stock > 0 && p.stock <= p.lowStockThreshold).length,
      outOfStock: products.filter((p) => p.stock === 0).length,
    }),
    [products]
  );

  const columns = [
    {
      accessor: 'name',
      header: 'Product',
      sortable: true,
      primary: true,
      render: (product) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-navy-50 text-navy-300 flex-shrink-0 overflow-hidden">
            {product.primaryImage ? (
              <img
                src={resolveFileUrl(product.primaryImage)}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover"
              />
            ) : (
              <Package size={17} />
            )}
          </span>

          <div className="min-w-0">
            <p className="font-medium text-navy-950 truncate">{product.name}</p>
            <p className="text-2xs text-navy-500 truncate">
              {[product.brand, product.model].filter(Boolean).join(' ') || product.category?.name}
            </p>
          </div>
        </div>
      ),
      exportValue: (product) => product.name,
    },
    {
      key: 'category',
      header: 'Category',
      secondary: true,
      hideOnMobile: true,
      render: (product) => (
        <span className="text-sm text-navy-700">{product.category?.name || '—'}</span>
      ),
      exportValue: (product) => product.category?.name,
    },
    {
      accessor: 'purchasePrice',
      header: 'Cost',
      align: 'right',
      sortable: true,
      hideOnMobile: true,
      render: (product) => <MoneyCell value={product.purchasePrice} />,
      exportValue: (product) => product.purchasePrice,
    },
    {
      accessor: 'cashPrice',
      header: 'Cash price',
      align: 'right',
      sortable: true,
      render: (product) => <MoneyCell value={product.cashPrice} />,
      exportValue: (product) => product.cashPrice,
    },
    {
      accessor: 'installmentPrice',
      header: 'Installment',
      align: 'right',
      sortable: true,
      hideOnMobile: true,
      render: (product) => <MoneyCell value={product.installmentPrice} showZero={false} />,
      exportValue: (product) => product.installmentPrice,
    },
    {
      accessor: 'stock',
      header: 'Stock',
      align: 'center',
      sortable: true,
      render: (product) => <StockBadge product={product} />,
      exportValue: (product) => product.stock,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (product) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconButton
            icon={Eye}
            label="View this product"
            size="icon-sm"
            onClick={(e) => { e.stopPropagation(); setViewing(product); }}
          />
          {hasPermission('products') && (
            <>
              <IconButton
                icon={Pencil}
                label="Edit"
                size="icon-sm"
                onClick={(e) => { e.stopPropagation(); openEdit(product); }}
              />
              <IconButton
                icon={Trash2}
                label="Delete"
                size="icon-sm"
                className="text-danger-500 hover:bg-danger-50"
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(product); }}
              />
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <TabGuide id="products" />

      <PageHeader
        title="Products"
        subtitle={`${pagination.total.toLocaleString('en-PK')} product${pagination.total === 1 ? '' : 's'} in the catalogue`}
        icon={Package}
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
                title="Grid view"
                aria-label="Grid view"
              >
                <LayoutGrid size={16} />
              </Button>
            </ButtonGroup>

            {hasPermission('products') && (
              <Button variant="gold" icon={Plus} onClick={openCreate}>
                Add product
              </Button>
            )}
          </>
        }
      />

      <StatGrid columns={4}>
        <StatCard label="Stock at cost" value={stats.stockValue} icon={Boxes} variant="navy" compact />
        <StatCard
          label="Retail value"
          value={stats.retailValue}
          icon={TrendingUp}
          variant="gold"
          compact
          subtitle={`${formatCurrency(stats.retailValue - stats.stockValue)} potential profit`}
        />
        <StatCard
          label="Units in stock"
          value={stats.units}
          icon={Package}
          variant="blue"
          isCurrency={false}
        />
        <StatCard
          label="Need restocking"
          value={stats.lowStock + stats.outOfStock}
          icon={AlertTriangle}
          variant={stats.outOfStock > 0 ? 'red' : 'amber'}
          isCurrency={false}
          subtitle={`${stats.outOfStock} out of stock`}
        />
      </StatGrid>

      {/* ---- Grid view ---- */}
      {view === 'grid' ? (
        <div className="space-y-4">
          <div className="card p-3 sm:p-4">
            <ProductFilters table={table} categories={categories} />
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3">
              {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : products.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={Package}
                title={table.hasActiveFilters ? 'No matching products' : 'No products yet'}
                message={
                  table.hasActiveFilters
                    ? 'Try clearing your search or filters.'
                    : 'Add your first product to start selling.'
                }
                action={
                  hasPermission('products') && !table.hasActiveFilters ? (
                    <Button variant="gold" icon={Plus} onClick={openCreate}>Add product</Button>
                  ) : null
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3">
              {products.map((product, index) => (
                <ProductCard
                  key={product._id}
                  product={product}
                  index={index}
                  onView={() => setViewing(product)}
                  onEdit={hasPermission('products') ? () => openEdit(product) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={products}
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
          exportFilename="products"
          printable
          title="Products"
          activeFilterCount={Object.values(table.filters).filter(Boolean).length}
          onClearFilters={table.resetFilters}
          filters={<ProductFilters table={table} categories={categories} />}
          emptyState={
            <EmptyState
              icon={Package}
              title={table.hasActiveFilters ? 'No matching products' : 'No products yet'}
              message={
                table.hasActiveFilters
                  ? 'Try clearing your search or filters.'
                  : 'Add your first product to start selling.'
              }
              action={
                hasPermission('products') && !table.hasActiveFilters ? (
                  <Button variant="gold" icon={Plus} onClick={openCreate}>Add product</Button>
                ) : null
              }
            />
          }
        />
      )}

      <ProductFormModal
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
      />

      <ProductDetailModal
        product={viewing}
        onClose={() => setViewing(null)}
        onEdit={(product) => { setViewing(null); openEdit(product); }}
        onImagesChanged={load}
        canManage={hasPermission('products')}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete this product?"
        message={`"${deleteTarget?.name}" will be removed. If it still has stock it will be archived instead, so past sales keep their detail.`}
        confirmText="Delete"
      />
    </div>
  );
}

/* ============================================================================
 * Pieces
 * ========================================================================== */

function ProductFilters({ table, categories }) {
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
          { value: 'low', label: 'Low stock' },
          { value: 'out', label: 'Out of stock' },
          { value: 'in', label: 'In stock' },
        ]}
      />
    </FormRow>
  );
}

/** Stock level as a colour-coded badge. */
function StockBadge({ product }) {
  if (product.stock === 0) {
    return <Badge variant="danger" size="sm">Out of stock</Badge>;
  }
  if (product.stock <= product.lowStockThreshold) {
    return <Badge variant="warning" size="sm">{product.stock} left</Badge>;
  }
  return <Badge variant="success" size="sm">{product.stock} in stock</Badge>;
}

/** A photo-led card for the grid view. */
function ProductCard({ product, index, onView, onEdit }) {
  return (
    <article
      className="card-hover overflow-hidden flex flex-col cursor-pointer group stagger"
      style={{ '--i': index }}
      onClick={onView}
    >
      <div className="relative aspect-square bg-navy-50 overflow-hidden">
        {product.primaryImage ? (
          <img
            src={resolveFileUrl(product.primaryImage)}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 ease-out-expo group-hover:scale-105"
          />
        ) : (
          <span className="flex items-center justify-center w-full h-full text-navy-200">
            <ImageIcon size={32} />
          </span>
        )}

        <span className="absolute top-2 left-2">
          <StockBadge product={product} />
        </span>

        {onEdit && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            aria-label="Edit this product"
            className="absolute top-2 right-2 p-1.5 rounded-md bg-white/90 text-navy-600 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-white transition-all"
          >
            <Pencil size={13} />
          </button>
        )}
      </div>

      <div className="p-3 flex-1 flex flex-col">
        <h3 className="text-sm font-medium text-navy-950 line-clamp-2 leading-snug">
          {product.name}
        </h3>
        <p className="text-2xs text-navy-500 mt-0.5 truncate">
          {[product.brand, product.model].filter(Boolean).join(' ') || product.category?.name}
        </p>

        <div className="mt-auto pt-2.5 flex items-end justify-between gap-2">
          <div>
            <p className="text-2xs text-navy-400">Cash</p>
            <p className="text-sm font-semibold text-navy-950 tabular">
              {formatCurrency(product.cashPrice)}
            </p>
          </div>

          {product.installmentPrice > 0 && (
            <div className="text-right">
              <p className="text-2xs text-navy-400">Installment</p>
              <p className="text-sm font-semibold text-gold-600 tabular">
                {formatCurrency(product.installmentPrice)}
              </p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

/* ============================================================================
 * Form
 * ========================================================================== */

function ProductFormModal({
  isOpen, onClose, editing, form, setForm, onSubmit, saving, categories, partners, settings,
}) {
  // Live margin, so pricing decisions are made with the number visible
  const margin = useMemo(() => {
    if (!form.purchasePrice || !form.cashPrice) return null;
    return calculateProfit(form.purchasePrice, form.cashPrice, 1);
  }, [form.purchasePrice, form.cashPrice]);

  const suggestInstallmentPrice = () => {
    const markup = settings?.product?.defaultInstallmentMarkupPercent ?? 20;
    const base = parseNumber(form.cashPrice) || parseNumber(form.purchasePrice);
    setForm({ ...form, installmentPrice: String(calculateMarkup(base, markup).sellingPrice) });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Edit product' : 'Add product'}
      subtitle={editing?.name}
      icon={Package}
      size="lg"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="gold" onClick={onSubmit} isLoading={saving} loadingText="Saving…">
            {editing ? 'Save changes' : 'Add product'}
          </Button>
        </ModalFooter>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <FormSection title="Basics" icon={Tag}>
          <FormRow cols={2}>
            <Input
              label="Product name"
              required
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Samsung Galaxy A15 128GB"
            />
            <Select
              label="Category"
              required
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Choose a category"
              options={categories.map((c) => ({ value: c._id, label: c.name }))}
            />
          </FormRow>

          <FormRow cols={3}>
            <Input
              label="Brand"
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
            />
            <Input
              label="Model"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            />
            <Input
              label="Colour"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
            />
          </FormRow>

          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            maxLength={500}
          />
        </FormSection>

        <FormSection title="Pricing" icon={TrendingUp}>
          <FormRow cols={3}>
            <CurrencyInput
              label="Purchase cost"
              value={form.purchasePrice}
              onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
              showPreview={false}
            />
            <CurrencyInput
              label="Cash price"
              value={form.cashPrice}
              onChange={(e) => setForm({ ...form, cashPrice: e.target.value })}
              showPreview={false}
            />
            <CurrencyInput
              label="Installment price"
              value={form.installmentPrice}
              onChange={(e) => setForm({ ...form, installmentPrice: e.target.value })}
              showPreview={false}
            />
          </FormRow>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" size="sm" onClick={suggestInstallmentPrice} disabled={!form.cashPrice}>
              Suggest an installment price
            </Button>

            {margin && (
              <span
                className={cn(
                  'text-xs font-medium tabular',
                  margin.profit >= 0 ? 'text-success-700' : 'text-danger-600'
                )}
              >
                {margin.profit >= 0 ? 'Profit' : 'Loss'} {formatCurrency(Math.abs(margin.profit))}
                <span className="text-navy-400"> · {margin.marginPercentage.toFixed(1)}% margin</span>
              </span>
            )}
          </div>
        </FormSection>

        <FormSection title="Stock" icon={Boxes}>
          <FormRow cols={3}>
            <Input
              label="Quantity in stock"
              type="number"
              min={0}
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: parseNumber(e.target.value) })}
              // Stock moves through purchases, sales and returns; editing it
              // directly would bypass the movement log entirely.
              disabled={Boolean(editing)}
              hint={editing ? 'Adjust stock through purchases and returns' : undefined}
            />
            <Input
              label="Reorder at"
              type="number"
              min={0}
              value={form.lowStockThreshold}
              onChange={(e) => setForm({ ...form, lowStockThreshold: parseNumber(e.target.value) })}
              hint="Warn when stock falls to this level"
            />
            <Input
              label="Warranty (months)"
              type="number"
              min={0}
              value={form.warrantyMonths}
              onChange={(e) => setForm({ ...form, warrantyMonths: parseNumber(e.target.value) })}
            />
          </FormRow>

          <FormRow cols={2}>
            <Input
              label="Barcode"
              value={form.barcode}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })}
            />
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={Object.entries(PRODUCT_STATUSES).map(([value, meta]) => ({
                value,
                label: meta.label,
              }))}
            />
          </FormRow>
        </FormSection>

        <FormSection
          title="Serial tracking"
          icon={Cpu}
          description="For phones, bikes and anything with a unique identifier"
        >
          <FormRow cols={2}>
            <Input
              label="IMEI 1"
              value={form.imei1}
              onChange={(e) => setForm({ ...form, imei1: e.target.value })}
            />
            <Input
              label="IMEI 2"
              value={form.imei2}
              onChange={(e) => setForm({ ...form, imei2: e.target.value })}
            />
          </FormRow>

          <FormRow cols={2}>
            <Input
              label="Serial number"
              value={form.serialNumber}
              onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
            />
            <Input
              label="Registration number"
              value={form.registrationNumber}
              onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
            />
          </FormRow>

          <FormRow cols={2}>
            <Input
              label="Engine number"
              value={form.engineNumber}
              onChange={(e) => setForm({ ...form, engineNumber: e.target.value })}
            />
            <Input
              label="Chassis number"
              value={form.chassisNumber}
              onChange={(e) => setForm({ ...form, chassisNumber: e.target.value })}
            />
          </FormRow>
        </FormSection>

        <FormSection
          title="Ownership"
          icon={Building2}
          description="Decides whose stock and whose profit this is"
        >
          <FormRow cols={3}>
            <Select
              label="Owned by"
              value={form.ownership}
              onChange={(e) => setForm({ ...form, ownership: e.target.value })}
              options={OWNERSHIP_ALLOCATIONS}
            />

            {form.ownership !== 'owner' && (
              <>
                <Select
                  label="Partner"
                  value={form.partner}
                  onChange={(e) => setForm({ ...form, partner: e.target.value })}
                  placeholder="Select the partner"
                  options={partners.map((p) => ({ value: p._id, label: p.name }))}
                />
                <Input
                  label="Partner share"
                  type="number"
                  min={0}
                  max={100}
                  value={form.partnerSharePercent}
                  onChange={(e) => setForm({ ...form, partnerSharePercent: parseNumber(e.target.value) })}
                  suffix="%"
                />
              </>
            )}
          </FormRow>
        </FormSection>

        {editing && (
          <p className="text-2xs text-navy-500">
            Photos are managed from the product&apos;s detail view.
          </p>
        )}

        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}

/* ============================================================================
 * Detail
 * ========================================================================== */

function ProductDetailModal({ product, onClose, onEdit, onImagesChanged, canManage }) {
  const toast = useToastStore();
  const [uploading, setUploading] = useState(false);
  const [local, setLocal] = useState(product);

  useEffect(() => { setLocal(product); }, [product]);

  if (!local) return null;

  const handleUpload = async (files) => {
    setUploading(true);
    try {
      const response = await productService.uploadImages(local._id, files);
      setLocal(response.data.product);
      toast.success('Photos uploaded.');
      onImagesChanged?.();
    } catch (error) {
      toast.apiError(error, 'Could not upload those photos.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async (index) => {
    try {
      const response = await productService.deleteImage(local._id, index);
      setLocal(response.data.product);
      onImagesChanged?.();
    } catch (error) {
      toast.apiError(error);
    }
  };

  const handleSetPrimary = async (index) => {
    try {
      const response = await productService.setPrimaryImage(local._id, index);
      setLocal(response.data.product);
      toast.success('Cover image updated.');
      onImagesChanged?.();
    } catch (error) {
      toast.apiError(error);
    }
  };

  const margin =
    local.purchasePrice && local.cashPrice
      ? calculateProfit(local.purchasePrice, local.cashPrice, 1)
      : null;

  return (
    <Modal
      isOpen={Boolean(local)}
      onClose={onClose}
      title={local.name}
      subtitle={[local.brand, local.model].filter(Boolean).join(' ')}
      icon={Package}
      size="lg"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {canManage && (
            <Button variant="gold" icon={Pencil} onClick={() => onEdit(local)}>Edit</Button>
          )}
        </ModalFooter>
      }
    >
      <div className="space-y-5">
        {/* Pricing summary */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Cost', value: local.purchasePrice, tone: 'text-navy-700' },
            { label: 'Cash price', value: local.cashPrice, tone: 'text-navy-950' },
            { label: 'Installment', value: local.installmentPrice, tone: 'text-gold-600' },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-navy-50 border border-navy-100 p-2.5 text-center">
              <p className="text-2xs text-navy-500">{item.label}</p>
              <p className={cn('text-sm font-semibold tabular mt-0.5', item.tone)}>
                {formatCurrency(item.value)}
              </p>
            </div>
          ))}
        </div>

        {margin && (
          <p className="text-center text-xs text-navy-600">
            Margin on a cash sale:{' '}
            <strong className={margin.profit >= 0 ? 'text-success-700' : 'text-danger-600'}>
              {formatCurrency(margin.profit)} ({margin.marginPercentage.toFixed(1)}%)
            </strong>
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <FieldDisplay label="Category" value={local.category?.name} />
          <FieldDisplay label="In stock" value={`${local.stock} units`} />
          <FieldDisplay label="Reorder at" value={local.lowStockThreshold} />
          <FieldDisplay label="Warranty" value={local.warrantyMonths ? `${local.warrantyMonths} months` : '—'} />
          <FieldDisplay label="Barcode" value={local.barcode} mono />
          <FieldDisplay label="Ownership" value={local.ownership} />
        </div>

        {(local.imei1 || local.serialNumber || local.engineNumber) && (
          <FormSection title="Serial details" icon={Cpu}>
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

        {/* Photos */}
        {canManage && (
          <FormSection title="Photos" icon={ImageIcon}>
            {/* Products upload through their own endpoint rather than the
                generic one, so the image lands on the record and can be flagged
                as the cover in a single round trip. */}
            <label className="btn-secondary btn w-full justify-center cursor-pointer">
              <ImageIcon size={15} />
              {uploading ? 'Uploading…' : 'Add photos to this product'}
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
                    key={index}
                    className={cn(
                      'relative group aspect-square rounded-lg overflow-hidden border',
                      image.isPrimary ? 'border-gold-500 ring-2 ring-gold-500/30' : 'border-navy-200'
                    )}
                  >
                    <img
                      src={resolveFileUrl(image.url || image.data)}
                      alt=""
                      className="w-full h-full object-cover"
                    />

                    <figcaption className="absolute inset-x-0 top-0 flex justify-end gap-1 p-1 bg-gradient-to-b from-navy-950/70 to-transparent opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity">
                      {!image.isPrimary && (
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(index)}
                          title="Use as cover"
                          aria-label="Use as cover image"
                          className="p-1 rounded bg-white/90 text-navy-600 hover:bg-white text-2xs"
                        >
                          Cover
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        title="Remove"
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
