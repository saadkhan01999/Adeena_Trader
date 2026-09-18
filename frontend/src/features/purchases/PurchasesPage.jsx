/**
 * ============================================
 * Purchases
 * ============================================
 * Stock coming in — from a registered supplier, the market, or another trader.
 *
 * Recording a purchase raises the stock level, logs the movement and updates
 * the supplier's payable balance in one transaction, so the catalogue and the
 * supplier account can never drift apart.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShoppingBag, Plus, Eye, Trash2, Package, Truck, Banknote,
  AlertTriangle, Building2, Boxes,
} from 'lucide-react';

import PageHeader from '../../components/common/PageHeader.jsx';
import TabGuide from '../../components/common/TabGuide.jsx';
import ReverseActions from '../../components/common/ReverseActions.jsx';
import StatCard, { StatGrid } from '../../components/common/StatCard.jsx';
import Badge from '../../components/common/Badge.jsx';
import Button, { IconButton } from '../../components/common/Button.jsx';
import DataTable, { MoneyCell } from '../../components/common/DataTable.jsx';
import Modal, { ModalFooter } from '../../components/common/Modal.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import {
  Input, Select, Textarea, CurrencyInput, SearchSelect, RadioCards,
  FormRow, FormSection, FieldDisplay,
} from '../../components/common/Form.jsx';

import {
  purchaseService, productService, supplierService, partnerService,
} from '../../services/entities.js';
import { useUIStore } from '../../context/uiStore.js';
import { useAuthStore } from '../../context/authStore.js';
import { useToastStore } from '../../context/toastStore.js';
import { useTableState } from '../../hooks/index.js';
import { cn, formatCurrency, formatDate, parseNumber, toDateInput, sumBy } from '../../utils/index.js';
import { PURCHASE_SOURCE_TYPES, OWNERSHIP_ALLOCATIONS } from '../../constants/index.js';

export default function PurchasesPage() {
  const toast = useToastStore();
  const { ownership } = useUIStore();
  const { hasPermission } = useAuthStore();

  const [purchases, setPurchases] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState(null);

  const table = useTableState({
    initialSort: 'purchaseDate',
    initialFilters: { sourceType: '' },
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await purchaseService.list({ ...table.params, ownership });
      setPurchases(response.data.purchases || []);
      setPagination(response.data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      toast.apiError(error, 'Could not load purchases.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.params, ownership]);

  useEffect(() => { load(); }, [load]);

  const columns = [
    {
      accessor: 'invoiceNumber',
      header: 'Reference',
      sortable: true,
      primary: true,
      render: (purchase) => (
        <div>
          <p className="font-medium text-navy-950 tabular">{purchase.invoiceNumber || '—'}</p>
          <p className="text-2xs text-navy-500">{formatDate(purchase.purchaseDate)}</p>
        </div>
      ),
      exportValue: (purchase) => purchase.invoiceNumber,
    },
    {
      key: 'source',
      header: 'Bought from',
      secondary: true,
      render: (purchase) => (
        <div className="min-w-0">
          <p className="text-sm text-navy-900 truncate">
            {purchase.supplier?.name || purchase.supplierName || purchase.sourceName || '—'}
          </p>
          <p className="text-2xs text-navy-500 capitalize">
            {purchase.sourceType?.replace(/_/g, ' ')}
          </p>
        </div>
      ),
      exportValue: (purchase) => purchase.supplier?.name || purchase.sourceName,
    },
    {
      key: 'items',
      header: 'Items',
      hideOnMobile: true,
      render: (purchase) => (
        <span className="text-sm text-navy-700 line-clamp-1">
          {purchase.items?.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}
        </span>
      ),
      exportValue: (purchase) => purchase.items?.map((i) => `${i.quantity}x ${i.productName}`).join('; '),
    },
    {
      accessor: 'subtotal',
      header: 'Value',
      align: 'right',
      sortable: true,
      render: (purchase) => <MoneyCell value={purchase.subtotal} />,
      exportValue: (purchase) => purchase.subtotal,
    },
    {
      accessor: 'paid',
      header: 'Paid',
      align: 'right',
      hideOnMobile: true,
      render: (purchase) => <MoneyCell value={purchase.paid} className="text-success-700" />,
      exportValue: (purchase) => purchase.paid,
    },
    {
      accessor: 'payable',
      header: 'Owed',
      align: 'right',
      sortable: true,
      render: (purchase) =>
        purchase.payable > 0 ? (
          <MoneyCell value={purchase.payable} className="text-danger-600" />
        ) : (
          <span className="text-2xs font-medium text-success-700">Settled</span>
        ),
      exportValue: (purchase) => purchase.payable,
    },
    {
      accessor: 'status',
      header: 'Status',
      hideOnMobile: true,
      render: (purchase) => (
        <Badge
          variant={
            purchase.status === 'completed'
              ? 'success'
              : purchase.status === 'partial_payment'
                ? 'warning'
                : 'danger'
          }
          size="sm"
        >
          {purchase.status.replace(/_/g, ' ')}
        </Badge>
      ),
      exportValue: (purchase) => purchase.status,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (purchase) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconButton
            icon={Eye}
            label="View this purchase"
            size="icon-sm"
            onClick={(e) => { e.stopPropagation(); setViewing(purchase); }}
          />
          <ReverseActions
            record={purchase}
            label="purchase"
            cancelled={purchase.status === 'cancelled'}
            onCancel={(id, reason) => purchaseService.cancel(id, reason)}
            onDelete={(id, reason) => purchaseService.delete(id, reason)}
            onDone={(action) =>
              setPurchases((prev) =>
                action === 'delete'
                  ? prev.filter((r) => r._id !== purchase._id)
                  : prev.map((r) =>
                      r._id === purchase._id ? { ...r, status: 'cancelled' } : r
                    )
              )
            }
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <TabGuide id="purchases" />

      <PageHeader
        title="Purchases"
        subtitle={`${pagination.total.toLocaleString('en-PK')} purchase${pagination.total === 1 ? '' : 's'} recorded`}
        icon={ShoppingBag}
        actions={
          hasPermission('purchases') && (
            <Button variant="gold" icon={Plus} onClick={() => setFormOpen(true)}>
              Record purchase
            </Button>
          )
        }
      />

      <StatGrid columns={3}>
        <StatCard
          label="Value (this page)"
          value={sumBy(purchases, 'subtotal')}
          icon={ShoppingBag}
          variant="navy"
          compact
        />
        <StatCard label="Paid" value={sumBy(purchases, 'paid')} icon={Banknote} variant="green" compact />
        <StatCard
          label="Still owed"
          value={sumBy(purchases, 'payable')}
          icon={AlertTriangle}
          variant="red"
          compact
        />
      </StatGrid>

      <DataTable
        columns={columns}
        data={purchases}
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
        searchPlaceholder="Search by reference, supplier or source…"
        onRowClick={setViewing}
        exportFilename="purchases"
        printable
        title="Purchases"
        activeFilterCount={table.filters.sourceType ? 1 : 0}
        onClearFilters={table.resetFilters}
        filters={
          <FormRow cols={2}>
            <Select
              label="Source"
              value={table.filters.sourceType}
              onChange={(e) => table.setFilter('sourceType', e.target.value)}
              placeholder="All sources"
              options={PURCHASE_SOURCE_TYPES}
            />
          </FormRow>
        }
        emptyState={
          <EmptyState
            icon={ShoppingBag}
            title="No purchases yet"
            message="Record a purchase to bring stock into the catalogue."
            action={
              hasPermission('purchases') ? (
                <Button variant="gold" icon={Plus} onClick={() => setFormOpen(true)}>
                  Record a purchase
                </Button>
              ) : null
            }
          />
        }
      />

      <NewPurchaseModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={() => { setFormOpen(false); load(); }}
      />

      <PurchaseDetailModal purchase={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

/* ============================================================================
 * New purchase
 * ========================================================================== */

function NewPurchaseModal({ isOpen, onClose, onSuccess }) {
  const toast = useToastStore();

  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [partners, setPartners] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(emptyPurchase());

  useEffect(() => {
    if (!isOpen) return;
    setForm(emptyPurchase());

    Promise.all([
      productService.list({ limit: 500 }),
      supplierService.list({ limit: 200, status: 'active' }),
      partnerService.list({ limit: 100 }),
    ])
      .then(([productRes, supplierRes, partnerRes]) => {
        setProducts(productRes.data.products || []);
        setSuppliers(supplierRes.data.suppliers || []);
        setPartners(partnerRes.data.partners || []);
      })
      .catch((error) => toast.apiError(error, 'Could not load products and suppliers.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const subtotal = useMemo(
    () =>
      form.items.reduce(
        (sum, item) => sum + parseNumber(item.purchasePrice) * parseNumber(item.quantity),
        0
      ),
    [form.items]
  );

  const payable = Math.max(0, subtotal - parseNumber(form.paid));
  const isRegisteredSupplier = form.sourceType === 'registered_supplier';

  const addItem = (productId) => {
    const product = products.find((p) => p._id === productId);
    if (!product) return;

    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          product: product._id,
          productName: product.name,
          quantity: 1,
          // Default to the last known cost; it is usually right
          purchasePrice: product.purchasePrice || 0,
          currentStock: product.stock,
        },
      ],
    }));
  };

  const updateItem = (index, patch) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();

    if (form.items.length === 0) {
      toast.warning('Add at least one product.');
      return;
    }
    if (isRegisteredSupplier && !form.supplier) {
      toast.warning('Choose the supplier, or change the source type.');
      return;
    }

    setSaving(true);
    try {
      await purchaseService.create({
        supplier: isRegisteredSupplier ? form.supplier : null,
        sourceType: form.sourceType,
        sourceName: form.sourceName,
        sourcePhone: form.sourcePhone,
        sourceLocation: form.sourceLocation,
        invoiceNumber: form.invoiceNumber,
        items: form.items.map((item) => ({
          product: item.product,
          productName: item.productName,
          quantity: parseNumber(item.quantity),
          purchasePrice: parseNumber(item.purchasePrice),
          total: parseNumber(item.purchasePrice) * parseNumber(item.quantity),
        })),
        subtotal,
        paid: parseNumber(form.paid),
        ownership: form.ownership,
        partner: form.ownership === 'owner' ? null : form.partner || null,
        purchaseDate: form.purchaseDate,
        notes: form.notes,
      });

      toast.success('Purchase recorded and stock updated.');
      onSuccess?.();
    } catch (error) {
      toast.apiError(error, 'Could not record the purchase.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record a purchase"
      subtitle="Stock levels update automatically"
      icon={ShoppingBag}
      size="lg"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-2xs text-navy-500">Total</p>
              <p className="text-lg font-display font-bold text-navy-950 tabular">
                {formatCurrency(subtotal)}
              </p>
            </div>
            {payable > 0 && (
              <div className="pl-4 border-l border-navy-200">
                <p className="text-2xs text-navy-500">Will owe</p>
                <p className="text-lg font-display font-bold text-danger-600 tabular">
                  {formatCurrency(payable)}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button
              variant="gold"
              onClick={handleSubmit}
              isLoading={saving}
              loadingText="Recording…"
              disabled={form.items.length === 0}
            >
              Record purchase
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <FormSection title="Where the stock came from" icon={Truck}>
          <Select
            label="Source type"
            required
            value={form.sourceType}
            onChange={(e) => setForm({ ...form, sourceType: e.target.value, supplier: '' })}
            options={PURCHASE_SOURCE_TYPES}
          />

          {isRegisteredSupplier ? (
            <SearchSelect
              label="Supplier"
              required
              value={form.supplier}
              onChange={(value) => setForm({ ...form, supplier: value })}
              options={suppliers.map((s) => ({
                value: s._id,
                label: s.name,
                sublabel: s.phone,
                meta: s.payable > 0 ? `${formatCurrency(s.payable)} owed` : undefined,
              }))}
              placeholder="Search suppliers"
              emptyMessage="No matching supplier. Add them from the Suppliers screen first."
            />
          ) : (
            <FormRow cols={3}>
              <Input
                label="Bought from"
                value={form.sourceName}
                onChange={(e) => setForm({ ...form, sourceName: e.target.value })}
                placeholder="Name of the seller"
              />
              <Input
                label="Phone"
                value={form.sourcePhone}
                onChange={(e) => setForm({ ...form, sourcePhone: e.target.value })}
              />
              <Input
                label="Location"
                value={form.sourceLocation}
                onChange={(e) => setForm({ ...form, sourceLocation: e.target.value })}
                placeholder="Market or city"
              />
            </FormRow>
          )}

          <FormRow cols={2}>
            <Input
              label="Their invoice number"
              value={form.invoiceNumber}
              onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
              placeholder="Leave blank to generate one"
            />
            <Input
              label="Purchase date"
              type="date"
              value={form.purchaseDate}
              onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
              max={toDateInput(new Date())}
            />
          </FormRow>
        </FormSection>

        <FormSection title="Items received" icon={Package}>
          <SearchSelect
            label="Add a product"
            value=""
            onChange={addItem}
            options={products
              .filter((p) => !form.items.some((item) => item.product === p._id))
              .map((p) => ({
                value: p._id,
                label: p.name,
                sublabel: [p.brand, p.model].filter(Boolean).join(' '),
                meta: `${p.stock} in stock`,
              }))}
            placeholder="Search the catalogue"
            emptyMessage="No matching product. Add it from the Products screen first."
          />

          {form.items.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="Nothing added yet"
              message="Search above to add the products you received."
              size="sm"
            />
          ) : (
            <ul className="space-y-2.5">
              {form.items.map((item, index) => (
                <li key={item.product} className="rounded-lg border border-navy-200 p-3">
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy-950 truncate">{item.productName}</p>
                      <p className="text-2xs text-navy-500">
                        {item.currentStock} in stock → {item.currentStock + parseNumber(item.quantity)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-semibold text-navy-950 tabular">
                        {formatCurrency(parseNumber(item.purchasePrice) * parseNumber(item.quantity))}
                      </span>
                      <IconButton
                        icon={Trash2}
                        label="Remove"
                        size="icon-sm"
                        variant="ghost"
                        className="text-danger-500 hover:bg-danger-50"
                        onClick={() =>
                          setForm({ ...form, items: form.items.filter((_, i) => i !== index) })
                        }
                      />
                    </div>
                  </div>

                  <FormRow cols={2}>
                    <Input
                      label="Quantity"
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(index, { quantity: parseNumber(e.target.value) })}
                    />
                    <CurrencyInput
                      label="Unit cost"
                      value={item.purchasePrice}
                      onChange={(e) => updateItem(index, { purchasePrice: e.target.value })}
                      showPreview={false}
                      hint="Updates the product's recorded cost"
                    />
                  </FormRow>
                </li>
              ))}
            </ul>
          )}
        </FormSection>

        <FormSection title="Payment" icon={Banknote}>
          <div className="rounded-lg bg-navy-50 border border-navy-200 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-navy-600">Purchase total</span>
              <span className="font-semibold text-navy-950 tabular">{formatCurrency(subtotal)}</span>
            </div>

            <CurrencyInput
              label="Paid now"
              value={form.paid}
              onChange={(e) => setForm({ ...form, paid: e.target.value })}
              showPreview={false}
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, paid: String(subtotal) })}
                className="px-2.5 py-1 rounded-lg border border-navy-200 text-2xs font-medium text-navy-600 hover:bg-white transition-colors"
              >
                Paid in full
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, paid: '0' })}
                className="px-2.5 py-1 rounded-lg border border-navy-200 text-2xs font-medium text-navy-600 hover:bg-white transition-colors"
              >
                On credit
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-navy-200">
              <span className="text-sm font-semibold text-navy-800">Balance owed</span>
              <span
                className={cn(
                  'text-lg font-display font-bold tabular',
                  payable > 0 ? 'text-danger-600' : 'text-success-700'
                )}
              >
                {formatCurrency(payable)}
              </span>
            </div>
          </div>
        </FormSection>

        <FormSection title="Ownership" icon={Building2}>
          <FormRow cols={2}>
            <Select
              label="This stock belongs to"
              value={form.ownership}
              onChange={(e) => setForm({ ...form, ownership: e.target.value })}
              options={OWNERSHIP_ALLOCATIONS}
            />
            {form.ownership !== 'owner' && (
              <Select
                label="Partner"
                value={form.partner}
                onChange={(e) => setForm({ ...form, partner: e.target.value })}
                placeholder="Select the partner"
                options={partners.map((p) => ({ value: p._id, label: p.name }))}
              />
            )}
          </FormRow>

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            maxLength={500}
          />
        </FormSection>

        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}

function emptyPurchase() {
  return {
    sourceType: 'registered_supplier',
    supplier: '',
    sourceName: '',
    sourcePhone: '',
    sourceLocation: '',
    invoiceNumber: '',
    items: [],
    paid: '',
    ownership: 'owner',
    partner: '',
    purchaseDate: toDateInput(new Date()),
    notes: '',
  };
}

/* ============================================================================
 * Detail
 * ========================================================================== */

function PurchaseDetailModal({ purchase, onClose }) {
  if (!purchase) return null;

  return (
    <Modal
      isOpen={Boolean(purchase)}
      onClose={onClose}
      title={purchase.invoiceNumber || 'Purchase'}
      subtitle={formatDate(purchase.purchaseDate)}
      icon={ShoppingBag}
      size="md"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </ModalFooter>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-navy-50 border border-navy-100 p-3 text-center">
          {[
            { label: 'Value', value: purchase.subtotal },
            { label: 'Paid', value: purchase.paid, tone: 'text-success-700' },
            { label: 'Owed', value: purchase.payable, tone: 'text-danger-600' },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-2xs text-navy-500">{item.label}</p>
              <p className={cn('text-sm font-semibold tabular mt-0.5', item.tone || 'text-navy-950')}>
                {formatCurrency(item.value)}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldDisplay
            label="Bought from"
            value={purchase.supplier?.name || purchase.supplierName || purchase.sourceName}
          />
          <FieldDisplay label="Source" value={purchase.sourceType?.replace(/_/g, ' ')} />
          <FieldDisplay label="Phone" value={purchase.sourcePhone || purchase.supplier?.phone} />
          <FieldDisplay label="Ownership" value={purchase.ownership} />
        </div>

        <div>
          <p className="label">Items received</p>
          <ul className="divide-y divide-navy-100 rounded-lg border border-navy-200 overflow-hidden">
            {purchase.items?.map((item, index) => (
              <li key={index} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-navy-900 truncate">{item.productName}</p>
                  <p className="text-2xs text-navy-500 tabular">
                    {item.quantity} × {formatCurrency(item.purchasePrice)}
                  </p>
                </div>
                <span className="text-sm font-medium text-navy-950 tabular flex-shrink-0">
                  {formatCurrency(item.total)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {purchase.notes && <FieldDisplay label="Notes" value={purchase.notes} />}
      </div>
    </Modal>
  );
}
