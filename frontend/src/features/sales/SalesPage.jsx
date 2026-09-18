/**
 * ============================================
 * Sales
 * ============================================
 * Record a sale and review the sales ledger.
 *
 * The new-sale form is the busiest screen in the application, so it is built as
 * a three-step flow - customer, items, payment - rather than one long form.
 * On a phone that difference is the difference between usable and not.
 *
 * The installment figures update live from the shared financial engine, so the
 * monthly amount quoted to the customer is exactly what gets stored.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShoppingCart, Plus, Eye, Printer, FileSignature, Trash2, User, Package,
  Wallet, ArrowRight, ArrowLeft, Check, Search, X, CalendarClock, Banknote,
  AlertTriangle, Users,
} from 'lucide-react';

import PageHeader from '../../components/common/PageHeader.jsx';
import TabGuide from '../../components/common/TabGuide.jsx';
import StatCard, { StatGrid } from '../../components/common/StatCard.jsx';
import Badge from '../../components/common/Badge.jsx';
import Button, { IconButton } from '../../components/common/Button.jsx';
import DataTable, { MoneyCell } from '../../components/common/DataTable.jsx';
import Modal, { ModalFooter } from '../../components/common/Modal.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import {
  Input, Select, Textarea, CurrencyInput, SearchSelect,
  RadioCards, FormRow, FormSection, FieldDisplay,
} from '../../components/common/Form.jsx';
import DocumentPreviewModal from '../../components/modals/DocumentPreviewModal.jsx';

import {
  saleService, customerService, productService, partnerService,
} from '../../services/entities.js';
import { useUIStore } from '../../context/uiStore.js';
import { useAuthStore } from '../../context/authStore.js';
import { useSettingsStore } from '../../context/settingsStore.js';
import { useToastStore } from '../../context/toastStore.js';
import { useTableState } from '../../hooks/index.js';
import { calculateInstallment, generateInstallmentSchedule } from '../../utils/financialEngine.js';
import { cn, formatCurrency, formatDate, parseNumber, toDateInput } from '../../utils/index.js';
import {
  SALE_STATUSES, PAYMENT_METHODS, INSTALLMENT_PLANS, OWNERSHIP_ALLOCATIONS,
} from '../../constants/index.js';

export default function SalesPage() {
  const toast = useToastStore();
  const { ownership } = useUIStore();
  const { hasPermission } = useAuthStore();
  const business = useSettingsStore((s) => s.business);

  const [searchParams, setSearchParams] = useSearchParams();

  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [invoicePreview, setInvoicePreview] = useState(null);

  const table = useTableState({
    pageSize: 20,
    initialSort: 'saleDate',
    initialFilters: { saleType: '', status: '', startDate: '', endDate: '' },
  });

  // Deep link: /sales?new=1 opens the form straight away
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setFormOpen(true);
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await saleService.list({ ...table.params, ownership });
      setSales(response.data.sales);
      setSummary(response.data.summary);
      setPagination(response.data.pagination);
    } catch (error) {
      toast.apiError(error, 'Could not load sales.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.params, ownership]);

  useEffect(() => { load(); }, [load]);

  const handleView = async (sale) => {
    try {
      const response = await saleService.get(sale._id);
      setViewing(response.data);
    } catch (error) {
      toast.apiError(error, 'Could not open that sale.');
    }
  };

  const columns = [
    {
      accessor: 'invoiceNumber',
      header: 'Invoice',
      sortable: true,
      primary: true,
      render: (sale) => (
        <div>
          <p className="font-medium text-navy-950 tabular">{sale.invoiceNumber}</p>
          <p className="text-2xs text-navy-500">{formatDate(sale.saleDate)}</p>
        </div>
      ),
      exportValue: (sale) => sale.invoiceNumber,
    },
    {
      accessor: 'customerName',
      header: 'Customer',
      sortable: true,
      secondary: true,
      render: (sale) => (
        <div className="min-w-0">
          <p className="text-sm text-navy-900 truncate">{sale.customerName}</p>
          <p className="text-2xs text-navy-500 tabular">{sale.customerPhone}</p>
        </div>
      ),
      exportValue: (sale) => sale.customerName,
    },
    {
      key: 'items',
      header: 'Items',
      hideOnMobile: true,
      render: (sale) => (
        <span className="text-sm text-navy-700 line-clamp-1">
          {sale.items?.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}
        </span>
      ),
      exportValue: (sale) => sale.items?.map((i) => `${i.quantity}x ${i.productName}`).join('; '),
    },
    {
      accessor: 'saleType',
      header: 'Type',
      render: (sale) => (
        <Badge variant={sale.saleType === 'cash' ? 'success' : 'info'} size="sm">
          {sale.saleType === 'cash' ? 'Cash' : `${sale.installmentPlan}-month`}
        </Badge>
      ),
      exportValue: (sale) => (sale.saleType === 'cash' ? 'Cash' : `Installment ${sale.installmentPlan}m`),
    },
    {
      accessor: 'grandTotal',
      header: 'Total',
      align: 'right',
      sortable: true,
      render: (sale) => <MoneyCell value={sale.grandTotal} />,
      exportValue: (sale) => sale.grandTotal,
    },
    {
      accessor: 'remainingBalance',
      header: 'Balance',
      align: 'right',
      sortable: true,
      render: (sale) =>
        sale.remainingBalance > 0 ? (
          <MoneyCell value={sale.remainingBalance} className="text-danger-600" />
        ) : (
          <span className="text-2xs font-medium text-success-700">Cleared</span>
        ),
      exportValue: (sale) => sale.remainingBalance,
    },
    {
      accessor: 'status',
      header: 'Status',
      hideOnMobile: true,
      render: (sale) => (
        <Badge variant={SALE_STATUSES[sale.status]?.color || 'neutral'} size="sm">
          {SALE_STATUSES[sale.status]?.label || sale.status}
        </Badge>
      ),
      exportValue: (sale) => sale.status,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (sale) => (
        <div className="flex items-center justify-end gap-1">
          <IconButton
            icon={Eye}
            label="View this sale"
            size="icon-sm"
            onClick={(e) => { e.stopPropagation(); handleView(sale); }}
          />
          <IconButton
            icon={Printer}
            label="Print the invoice"
            size="icon-sm"
            onClick={async (e) => {
              e.stopPropagation();
              try {
                const response = await saleService.get(sale._id);
                setInvoicePreview(response.data);
              } catch (error) {
                toast.apiError(error);
              }
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <TabGuide id="sales" />

      <PageHeader
        title="Sales"
        subtitle={`${pagination.total.toLocaleString('en-PK')} invoice${pagination.total === 1 ? '' : 's'} recorded`}
        icon={ShoppingCart}
        actions={
          hasPermission('sales') && (
            <Button variant="gold" icon={Plus} onClick={() => setFormOpen(true)}>
              New sale
            </Button>
          )
        }
      />

      {summary && (
        <StatGrid columns={4}>
          <StatCard label="Total value" value={summary.totalValue} icon={ShoppingCart} variant="navy" compact />
          <StatCard label="Advance received" value={summary.totalAdvance} icon={Banknote} variant="green" compact />
          <StatCard label="Outstanding" value={summary.totalOutstanding} icon={CalendarClock} variant="red" compact />
          <StatCard
            label="Cash / installment"
            value={`${summary.cashCount} / ${summary.installmentCount}`}
            icon={Wallet}
            variant="gold"
            isCurrency={false}
            subtitle="invoices"
          />
        </StatGrid>
      )}

      <DataTable
        columns={columns}
        data={sales}
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
        searchPlaceholder="Search invoice, customer, phone or product…"
        onRowClick={handleView}
        exportFilename="sales"
        printable
        title="Sales"
        activeFilterCount={Object.values(table.filters).filter(Boolean).length}
        onClearFilters={table.resetFilters}
        filters={
          <FormRow cols={4}>
            <Select
              label="Type"
              value={table.filters.saleType}
              onChange={(e) => table.setFilter('saleType', e.target.value)}
              placeholder="All types"
              options={[{ value: 'cash', label: 'Cash' }, { value: 'installment', label: 'Installment' }]}
            />
            <Select
              label="Status"
              value={table.filters.status}
              onChange={(e) => table.setFilter('status', e.target.value)}
              placeholder="All statuses"
              options={Object.entries(SALE_STATUSES).map(([value, meta]) => ({ value, label: meta.label }))}
            />
            <Input
              label="From"
              type="date"
              value={table.filters.startDate}
              onChange={(e) => table.setFilter('startDate', e.target.value)}
            />
            <Input
              label="To"
              type="date"
              value={table.filters.endDate}
              onChange={(e) => table.setFilter('endDate', e.target.value)}
            />
          </FormRow>
        }
        emptyState={
          <EmptyState
            icon={ShoppingCart}
            title="No sales yet"
            message="Record your first sale to start tracking invoices and installments."
            action={
              hasPermission('sales') && (
                <Button variant="gold" icon={Plus} onClick={() => setFormOpen(true)}>
                  Record a sale
                </Button>
              )
            }
          />
        }
      />

      <NewSaleModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={(result) => {
          setFormOpen(false);
          load();
          setInvoicePreview({ sale: result.sale, business, agreement: result.agreement });
        }}
      />

      <SaleDetailModal
        data={viewing}
        onClose={() => setViewing(null)}
        onPrint={(payload) => { setViewing(null); setInvoicePreview(payload); }}
      />

      <DocumentPreviewModal
        isOpen={Boolean(invoicePreview)}
        onClose={() => setInvoicePreview(null)}
        type="invoice"
        data={invoicePreview?.sale}
        business={invoicePreview?.business || business}
        sharePhone={invoicePreview?.sale?.customerPhone}
        shareMessage={
          invoicePreview?.sale
            ? `Invoice ${invoicePreview.sale.invoiceNumber} — ${formatCurrency(invoicePreview.sale.grandTotal)}`
            : ''
        }
      />
    </div>
  );
}

/* ============================================================================
 * New sale
 * ========================================================================== */

const STEPS = [
  { id: 'customer', label: 'Customer', icon: User },
  { id: 'items', label: 'Items', icon: Package },
  { id: 'payment', label: 'Payment', icon: Wallet },
];

function NewSaleModal({ isOpen, onClose, onSuccess }) {
  const toast = useToastStore();
  const settings = useSettingsStore((s) => s.settings);

  const [step, setStep] = useState('customer');
  const [saving, setSaving] = useState(false);

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loadingLists, setLoadingLists] = useState(false);

  const [form, setForm] = useState(emptySale(settings));

  // ---- Load the pick lists once, when the dialog opens ------------------
  useEffect(() => {
    if (!isOpen) return;

    setStep('customer');
    setForm(emptySale(settings));
    setLoadingLists(true);

    Promise.all([
      customerService.list({ limit: 500, status: 'active' }),
      productService.list({ limit: 500, status: 'active' }),
      partnerService.list({ limit: 100 }),
    ])
      .then(([customerRes, productRes, partnerRes]) => {
        setCustomers(customerRes.data.customers || []);
        setProducts(productRes.data.products || []);
        setPartners(partnerRes.data.partners || []);
      })
      .catch((error) => toast.apiError(error, 'Could not load customers and products.'))
      .finally(() => setLoadingLists(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const selectedCustomer = customers.find((c) => c._id === form.customer);

  // ---- Totals, recomputed on every change -------------------------------
  const totals = useMemo(() => {
    const subtotal = form.items.reduce(
      (sum, item) => sum + parseNumber(item.price) * parseNumber(item.quantity) - parseNumber(item.discount),
      0
    );
    const grandTotal = Math.max(0, subtotal - parseNumber(form.discount));
    return { subtotal, grandTotal };
  }, [form.items, form.discount]);

  const breakdown = useMemo(
    () => calculateInstallment(totals.grandTotal, form.advance, form.installmentPlan),
    [totals.grandTotal, form.advance, form.installmentPlan]
  );

  const schedule = useMemo(() => {
    if (form.saleType !== 'installment' || breakdown.remaining <= 0) return [];
    return generateInstallmentSchedule(
      form.saleDate || new Date(),
      form.installmentPlan,
      breakdown.remaining,
      { gracePeriodDays: settings?.installment?.gracePeriodDays || 0 }
    );
  }, [form.saleType, form.saleDate, form.installmentPlan, breakdown.remaining, settings]);

  // ---- Item helpers -----------------------------------------------------
  const addItem = (productId) => {
    const product = products.find((p) => p._id === productId);
    if (!product) return;

    // Installment sales quote the installment price where one is set
    const price =
      form.saleType === 'installment' && product.installmentPrice > 0
        ? product.installmentPrice
        : product.cashPrice;

    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          product: product._id,
          productName: product.name,
          quantity: 1,
          price,
          discount: 0,
          stock: product.stock,
          imei1: product.imei1 || '',
          serialNumber: product.serialNumber || '',
          warranty: product.warrantyMonths ? `${product.warrantyMonths} months` : '',
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

  const removeItem = (index) => {
    setForm((current) => ({ ...current, items: current.items.filter((_, i) => i !== index) }));
  };

  // ---- Validation per step ---------------------------------------------
  const stepErrors = useMemo(() => {
    const errors = {};

    if (!form.customer) errors.customer = 'Choose a customer.';
    if (form.items.length === 0) errors.items = 'Add at least one product.';

    const overstocked = form.items.find(
      (item) => settings?.product?.preventNegativeStock && item.quantity > item.stock
    );
    if (overstocked) {
      errors.items = `Only ${overstocked.stock} of "${overstocked.productName}" are in stock.`;
    }

    if (form.saleType === 'installment') {
      if (settings?.installment?.requireGuarantor && selectedCustomer && !selectedCustomer.guarantorName) {
        errors.guarantor = `${selectedCustomer.name} has no guarantor on file, which installment sales require.`;
      }
      const minAdvance = (totals.grandTotal * (settings?.installment?.minAdvancePercent || 0)) / 100;
      if (minAdvance > 0 && parseNumber(form.advance) < minAdvance) {
        errors.advance = `A minimum advance of ${formatCurrency(minAdvance)} is required.`;
      }
    }

    return errors;
  }, [form, selectedCustomer, settings, totals.grandTotal]);

  const canAdvance = {
    customer: !stepErrors.customer,
    items: !stepErrors.items && form.items.length > 0,
    payment: Object.keys(stepErrors).length === 0,
  };

  const handleSubmit = async () => {
    if (Object.keys(stepErrors).length > 0) {
      toast.warning(Object.values(stepErrors)[0]);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customer: form.customer,
        items: form.items.map((item) => ({
          product: item.product,
          productName: item.productName,
          quantity: parseNumber(item.quantity),
          price: parseNumber(item.price),
          discount: parseNumber(item.discount),
          total: parseNumber(item.price) * parseNumber(item.quantity) - parseNumber(item.discount),
          imei1: item.imei1,
          serialNumber: item.serialNumber,
          warranty: item.warranty,
        })),
        subtotal: totals.subtotal,
        discount: parseNumber(form.discount),
        grandTotal: totals.grandTotal,
        saleType: form.saleType,
        advance: form.saleType === 'installment' ? parseNumber(form.advance) : 0,
        installmentPlan: form.saleType === 'installment' ? form.installmentPlan : null,
        paymentMethod: form.paymentMethod,
        amountReceived: form.saleType === 'cash' ? totals.grandTotal : parseNumber(form.advance),
        ownership: form.ownership,
        partner: form.ownership === 'owner' ? null : form.partner || null,
        saleDate: form.saleDate || undefined,
        notes: form.notes,
      };

      const response = await saleService.create(payload);
      toast.success(response.message);
      onSuccess?.(response.data);
    } catch (error) {
      toast.apiError(error, 'Could not record the sale.');
    } finally {
      setSaving(false);
    }
  };

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const isLastStep = stepIndex === STEPS.length - 1;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New sale"
      subtitle={
        form.saleType === 'installment'
          ? `Installment sale · ${form.installmentPlan} months`
          : 'Cash sale'
      }
      icon={ShoppingCart}
      size="xl"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Live total, always visible while filling the form */}
          <div className="flex items-center gap-4">
            <div>
              <p className="text-2xs text-navy-500">Total</p>
              <p className="text-lg font-display font-bold text-navy-950 tabular">
                {formatCurrency(totals.grandTotal)}
              </p>
            </div>
            {form.saleType === 'installment' && breakdown.monthlyInstallment > 0 && (
              <div className="pl-4 border-l border-navy-200">
                <p className="text-2xs text-navy-500">Monthly</p>
                <p className="text-lg font-display font-bold text-gold-600 tabular">
                  {formatCurrency(breakdown.monthlyInstallment)}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2">
            {stepIndex > 0 && (
              <Button
                variant="secondary"
                icon={ArrowLeft}
                onClick={() => setStep(STEPS[stepIndex - 1].id)}
                disabled={saving}
              >
                Back
              </Button>
            )}

            {isLastStep ? (
              <Button
                variant="gold"
                icon={Check}
                onClick={handleSubmit}
                isLoading={saving}
                loadingText="Recording…"
                disabled={!canAdvance.payment}
              >
                Complete sale
              </Button>
            ) : (
              <Button
                variant="primary"
                iconRight={ArrowRight}
                onClick={() => setStep(STEPS[stepIndex + 1].id)}
                disabled={!canAdvance[step]}
              >
                Continue
              </Button>
            )}
          </div>
        </div>
      }
    >
      {/* ---- Step indicator ---- */}
      <ol className="flex items-center gap-1 mb-5" aria-label="Progress">
        {STEPS.map((s, index) => {
          const isActive = s.id === step;
          const isDone = index < stepIndex;

          return (
            <li key={s.id} className="flex items-center flex-1 min-w-0">
              <button
                type="button"
                onClick={() => index <= stepIndex && setStep(s.id)}
                disabled={index > stepIndex}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-lg min-w-0 transition-colors',
                  index <= stepIndex && 'hover:bg-navy-50',
                  index > stepIndex && 'cursor-not-allowed'
                )}
              >
                <span
                  className={cn(
                    'flex items-center justify-center w-6 h-6 rounded-full text-2xs font-bold flex-shrink-0 transition-colors',
                    isDone && 'bg-success-600 text-white',
                    isActive && 'bg-navy-950 text-gold-500',
                    !isDone && !isActive && 'bg-navy-100 text-navy-400'
                  )}
                >
                  {isDone ? <Check size={12} /> : index + 1}
                </span>
                <span
                  className={cn(
                    'text-xs font-medium truncate hidden xs:block',
                    isActive ? 'text-navy-950' : 'text-navy-500'
                  )}
                >
                  {s.label}
                </span>
              </button>

              {index < STEPS.length - 1 && (
                <span className={cn('h-px flex-1 mx-1', isDone ? 'bg-success-400' : 'bg-navy-200')} />
              )}
            </li>
          );
        })}
      </ol>

      {/* ================= Step: customer ================= */}
      {step === 'customer' && (
        <div className="space-y-4">
          <SearchSelect
            label="Customer"
            required
            value={form.customer}
            onChange={(value) => setForm({ ...form, customer: value })}
            options={customers.map((c) => ({
              value: c._id,
              label: c.name,
              sublabel: c.mobile1,
              meta: c.outstanding > 0 ? formatCurrency(c.outstanding) : undefined,
            }))}
            placeholder={loadingLists ? 'Loading customers…' : 'Search by name, phone or CNIC'}
            error={stepErrors.customer}
            emptyMessage="No matching customer. Add them from the Customers screen first."
          />

          {selectedCustomer && (
            <div className="rounded-lg border border-navy-200 bg-navy-50/60 p-3.5 animate-fade-in">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <FieldDisplay label="CNIC" value={selectedCustomer.cnic} />
                <FieldDisplay label="Mobile" value={selectedCustomer.mobile1} />
                <FieldDisplay label="Outstanding" value={formatCurrency(selectedCustomer.outstanding)} mono />
                <FieldDisplay label="Guarantor" value={selectedCustomer.guarantorName} />
              </div>

              {selectedCustomer.outstanding > 0 && (
                <p className="mt-2.5 flex items-start gap-1.5 text-2xs text-warning-700">
                  <AlertTriangle size={12} className="flex-shrink-0 mt-px" />
                  This customer already owes {formatCurrency(selectedCustomer.outstanding)}.
                </p>
              )}

              {stepErrors.guarantor && (
                <p className="mt-2 flex items-start gap-1.5 text-2xs text-danger-700">
                  <AlertTriangle size={12} className="flex-shrink-0 mt-px" />
                  {stepErrors.guarantor}
                </p>
              )}
            </div>
          )}

          <FormRow cols={2}>
            <Input
              label="Sale date"
              type="date"
              value={form.saleDate}
              onChange={(e) => setForm({ ...form, saleDate: e.target.value })}
              max={toDateInput(new Date())}
            />
            <Select
              label="Ownership"
              value={form.ownership}
              onChange={(e) => setForm({ ...form, ownership: e.target.value })}
              options={OWNERSHIP_ALLOCATIONS}
              hint="Decides whose share of the profit this sale belongs to"
            />
          </FormRow>

          {form.ownership !== 'owner' && partners.length > 0 && (
            <Select
              label="Partner"
              value={form.partner}
              onChange={(e) => setForm({ ...form, partner: e.target.value })}
              placeholder="Select the partner"
              options={partners.map((p) => ({ value: p._id, label: `${p.name} (${p.ownershipPercent}%)` }))}
            />
          )}
        </div>
      )}

      {/* ================= Step: items ================= */}
      {step === 'items' && (
        <div className="space-y-4">
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
                meta: `${p.stock} in stock · ${formatCurrency(p.cashPrice)}`,
              }))}
            placeholder={loadingLists ? 'Loading products…' : 'Search products to add'}
            emptyMessage="No matching product in stock."
          />

          {form.items.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No items yet"
              message="Search above to add the products being sold."
              size="sm"
            />
          ) : (
            <ul className="space-y-2.5">
              {form.items.map((item, index) => {
                const lineTotal =
                  parseNumber(item.price) * parseNumber(item.quantity) - parseNumber(item.discount);
                const overstocked = item.quantity > item.stock;

                return (
                  <li
                    key={item.product}
                    className={cn(
                      'rounded-lg border p-3',
                      overstocked ? 'border-danger-300 bg-danger-50/40' : 'border-navy-200'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-navy-950 truncate">{item.productName}</p>
                        <p className="text-2xs text-navy-500">{item.stock} in stock</p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-semibold text-navy-950 tabular">
                          {formatCurrency(lineTotal)}
                        </span>
                        <IconButton
                          icon={Trash2}
                          label="Remove this item"
                          size="icon-sm"
                          variant="ghost"
                          className="text-danger-500 hover:bg-danger-50"
                          onClick={() => removeItem(index)}
                        />
                      </div>
                    </div>

                    <FormRow cols={3}>
                      <Input
                        label="Quantity"
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(index, { quantity: parseNumber(e.target.value) })}
                        error={overstocked ? `Only ${item.stock} available` : undefined}
                      />
                      <CurrencyInput
                        label="Unit price"
                        value={item.price}
                        onChange={(e) => updateItem(index, { price: e.target.value })}
                        showPreview={false}
                      />
                      <CurrencyInput
                        label="Line discount"
                        value={item.discount}
                        onChange={(e) => updateItem(index, { discount: e.target.value })}
                        showPreview={false}
                      />
                    </FormRow>

                    {/* Serial capture: what a warranty claim is checked against */}
                    <FormRow cols={2} className="mt-3">
                      <Input
                        label="IMEI / Serial"
                        value={item.imei1 || item.serialNumber}
                        onChange={(e) => updateItem(index, { imei1: e.target.value })}
                        placeholder="Optional"
                      />
                      <Input
                        label="Warranty"
                        value={item.warranty}
                        onChange={(e) => updateItem(index, { warranty: e.target.value })}
                        placeholder="e.g. 12 months"
                      />
                    </FormRow>
                  </li>
                );
              })}
            </ul>
          )}

          {form.items.length > 0 && (
            <div className="rounded-lg bg-navy-50 border border-navy-200 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-navy-600">Subtotal</span>
                <span className="font-medium text-navy-950 tabular">{formatCurrency(totals.subtotal)}</span>
              </div>

              <CurrencyInput
                label="Overall discount"
                value={form.discount}
                onChange={(e) => setForm({ ...form, discount: e.target.value })}
                showPreview={false}
              />

              <div className="flex items-center justify-between pt-2 border-t border-navy-200">
                <span className="text-sm font-semibold text-navy-800">Grand total</span>
                <span className="text-lg font-display font-bold text-navy-950 tabular">
                  {formatCurrency(totals.grandTotal)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= Step: payment ================= */}
      {step === 'payment' && (
        <div className="space-y-4">
          <RadioCards
            label="How is the customer paying?"
            required
            options={[
              { value: 'cash', label: 'Cash sale', icon: Banknote, hint: 'Paid in full today' },
              { value: 'installment', label: 'Installments', icon: CalendarClock, hint: '6 or 12 monthly payments' },
            ]}
            value={form.saleType}
            onChange={(value) => setForm({ ...form, saleType: value })}
            columns={2}
          />

          {form.saleType === 'installment' ? (
            <>
              <RadioCards
                label="Plan"
                required
                options={INSTALLMENT_PLANS.map((p) => ({ value: p.value, label: p.label, hint: p.hint }))}
                value={form.installmentPlan}
                onChange={(value) => setForm({ ...form, installmentPlan: Number(value) })}
                columns={2}
              />

              <FormRow cols={2}>
                <CurrencyInput
                  label="Advance received today"
                  required
                  value={form.advance}
                  onChange={(e) => setForm({ ...form, advance: e.target.value })}
                  error={stepErrors.advance}
                  hint={
                    totals.grandTotal > 0
                      ? `${breakdown.advancePercent}% of the total price`
                      : undefined
                  }
                />
                <Select
                  label="Advance paid by"
                  value={form.paymentMethod}
                  onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                  options={PAYMENT_METHODS}
                />
              </FormRow>

              {/* Live plan summary */}
              {breakdown.remaining > 0 && (
                <div className="rounded-xl border border-gold-300 bg-gold-50 overflow-hidden animate-fade-in">
                  <div className="px-4 py-3.5 text-center bg-gold-500">
                    <p className="text-2xs font-bold uppercase tracking-widest text-navy-950/70">
                      Monthly installment
                    </p>
                    <p className="text-3xl font-display font-bold text-navy-950 tabular mt-0.5">
                      {formatCurrency(breakdown.monthlyInstallment)}
                    </p>
                    <p className="text-xs text-navy-950/70">
                      × {breakdown.planMonths} months, no interest
                    </p>
                  </div>

                  {schedule.length > 0 && (
                    <div className="bg-white px-3 py-2.5">
                      <p className="text-2xs text-navy-500 mb-1.5">
                        First due {formatDate(schedule[0].dueDate)} · last due{' '}
                        {formatDate(schedule[schedule.length - 1].dueDate)}
                      </p>
                      <div className="flex gap-1 flex-wrap">
                        {schedule.map((installment) => (
                          <span
                            key={installment.number}
                            className="px-1.5 py-0.5 rounded bg-navy-50 border border-navy-200 text-2xs text-navy-600 tabular"
                            title={formatDate(installment.dueDate)}
                          >
                            {formatCurrency(installment.expected)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <FormRow cols={2}>
              <Select
                label="Paid by"
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                options={PAYMENT_METHODS}
              />
              <div className="flex items-end pb-1">
                <div className="rounded-lg bg-success-50 border border-success-200 px-3 py-2 w-full">
                  <p className="text-2xs text-success-700">Amount to collect</p>
                  <p className="text-lg font-display font-bold text-success-800 tabular">
                    {formatCurrency(totals.grandTotal)}
                  </p>
                </div>
              </div>
            </FormRow>
          )}

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Anything worth recording about this sale (optional)"
            rows={2}
            maxLength={500}
          />

          {form.saleType === 'installment' && settings?.installment?.autoGenerateAgreement && (
            <p className="flex items-start gap-1.5 text-2xs text-navy-500">
              <FileSignature size={12} className="flex-shrink-0 mt-px" />
              An installment agreement will be issued automatically and is ready to print once the
              sale is saved.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

/** A blank sale, seeded from the configured defaults. */
function emptySale(settings) {
  return {
    customer: '',
    items: [],
    discount: '',
    saleType: 'installment',
    advance: '',
    installmentPlan: settings?.installment?.defaultPlan || 6,
    paymentMethod: 'cash',
    ownership: 'owner',
    partner: '',
    saleDate: toDateInput(new Date()),
    notes: '',
  };
}

/* ============================================================================
 * Sale detail
 * ========================================================================== */

function SaleDetailModal({ data, onClose, onPrint }) {
  if (!data?.sale) return null;
  const { sale, business, agreement } = data;

  return (
    <Modal
      isOpen={Boolean(sale)}
      onClose={onClose}
      title={sale.invoiceNumber}
      subtitle={`${sale.customerName} · ${formatDate(sale.saleDate)}`}
      icon={ShoppingCart}
      size="lg"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button variant="gold" icon={Printer} onClick={() => onPrint({ sale, business })}>
            Print invoice
          </Button>
        </ModalFooter>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <FieldDisplay label="Type" value={sale.saleType === 'cash' ? 'Cash' : `${sale.installmentPlan}-month`} />
          <FieldDisplay label="Total" value={formatCurrency(sale.grandTotal)} mono />
          <FieldDisplay label="Advance" value={formatCurrency(sale.advance)} mono />
          <FieldDisplay label="Balance" value={formatCurrency(sale.remainingBalance)} mono />
        </div>

        <FormSection title="Items" icon={Package}>
          <ul className="divide-y divide-navy-100 rounded-lg border border-navy-200 overflow-hidden">
            {sale.items?.map((item, index) => (
              <li key={index} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-navy-900 truncate">{item.productName}</p>
                  <p className="text-2xs text-navy-500 tabular">
                    {item.quantity} × {formatCurrency(item.price)}
                    {item.imei1 && ` · IMEI ${item.imei1}`}
                  </p>
                </div>
                <span className="text-sm font-medium text-navy-950 tabular flex-shrink-0">
                  {formatCurrency(item.total)}
                </span>
              </li>
            ))}
          </ul>
        </FormSection>

        {sale.installments?.length > 0 && (
          <FormSection title="Payment schedule" icon={CalendarClock}>
            <ul className="divide-y divide-navy-100 rounded-lg border border-navy-200 overflow-hidden max-h-64 overflow-y-auto scrollbar-thin">
              {sale.installments.map((installment) => (
                <li key={installment.number} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="flex items-center gap-2.5">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-navy-950 text-gold-500 text-2xs font-bold">
                      {installment.number}
                    </span>
                    <span className="text-sm text-navy-700 tabular">{formatDate(installment.dueDate)}</span>
                  </span>

                  <span className="flex items-center gap-2.5">
                    <span className="text-sm font-medium text-navy-950 tabular">
                      {formatCurrency(installment.expected)}
                    </span>
                    <Badge variant={SALE_STATUSES[installment.status]?.color || 'neutral'} size="sm">
                      {installment.status.replace('_', ' ')}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          </FormSection>
        )}

        {agreement && (
          <div className="flex items-center gap-2.5 rounded-lg bg-navy-50 border border-navy-200 p-3">
            <FileSignature size={17} className="text-navy-600 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-navy-900">
                Agreement {agreement.agreementNumber}
              </p>
              <p className="text-2xs text-navy-500 capitalize">{agreement.status}</p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
