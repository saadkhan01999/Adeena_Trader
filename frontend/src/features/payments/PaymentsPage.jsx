/**
 * ============================================
 * Payments
 * ============================================
 * Money received, with the receipt for each one.
 *
 * Recording a payment is deliberately reachable from here as well as from the
 * Installments worklist: sometimes a customer simply walks in and pays, without
 * anyone having chased them.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  WalletCards, Plus, Eye, Printer, Banknote, TrendingUp, Calendar,
  Users, MessageCircle, Receipt,
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
  Input, Select, Textarea, CurrencyInput, SearchSelect, FormRow, FieldDisplay,
} from '../../components/common/Form.jsx';
import DocumentPreviewModal from '../../components/modals/DocumentPreviewModal.jsx';

import { paymentService, customerService, saleService } from '../../services/entities.js';
import { useUIStore } from '../../context/uiStore.js';
import { useAuthStore } from '../../context/authStore.js';
import { useSettingsStore } from '../../context/settingsStore.js';
import { useToastStore } from '../../context/toastStore.js';
import { useTableState } from '../../hooks/index.js';
import {
  cn, formatCurrency, formatDate, formatDateTime, toDateInput, sumBy, getWhatsAppURL,
} from '../../utils/index.js';
import { PAYMENT_METHODS } from '../../constants/index.js';

export default function PaymentsPage() {
  const toast = useToastStore();
  const { ownership } = useUIStore();
  const { hasPermission } = useAuthStore();
  const business = useSettingsStore((s) => s.business);

  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [thankYou, setThankYou] = useState(null);

  const table = useTableState({
    initialSort: 'paymentDate',
    initialFilters: { paymentMethod: '', startDate: '', endDate: '' },
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await paymentService.list({ ...table.params, ownership });
      setPayments(response.data.payments || []);
      setPagination(response.data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      toast.apiError(error, 'Could not load payments.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.params, ownership]);

  useEffect(() => { load(); }, [load]);

  const openReceipt = async (payment) => {
    try {
      const response = await paymentService.get(payment._id);
      setReceiptPreview(response.data);
    } catch (error) {
      toast.apiError(error, 'Could not open that receipt.');
    }
  };

  const columns = [
    {
      accessor: 'receiptNumber',
      header: 'Receipt',
      sortable: true,
      primary: true,
      render: (payment) => (
        <div>
          <p className="font-medium text-navy-950 tabular">{payment.receiptNumber}</p>
          <p className="text-2xs text-navy-500">{formatDate(payment.paymentDate)}</p>
        </div>
      ),
      exportValue: (payment) => payment.receiptNumber,
    },
    {
      accessor: 'customerName',
      header: 'Customer',
      sortable: true,
      secondary: true,
      render: (payment) => (
        <div className="min-w-0">
          <p className="text-sm text-navy-900 truncate">{payment.customerName}</p>
          <p className="text-2xs text-navy-500 tabular">{payment.customerPhone}</p>
        </div>
      ),
      exportValue: (payment) => payment.customerName,
    },
    {
      accessor: 'paymentMethod',
      header: 'Method',
      hideOnMobile: true,
      render: (payment) => (
        <Badge variant="neutral" size="sm" className="capitalize">{payment.paymentMethod}</Badge>
      ),
      exportValue: (payment) => payment.paymentMethod,
    },
    {
      key: 'applied',
      header: 'Applied to',
      hideOnMobile: true,
      render: (payment) => (
        <span className="text-2xs text-navy-600">
          {payment.allocations?.length
            ? payment.allocations
                .map((a) => (a.installmentNumber === 0 ? 'Advance' : `#${a.installmentNumber}`))
                .join(', ')
            : '—'}
        </span>
      ),
      exportValue: (payment) => payment.allocations?.length || 0,
    },
    {
      accessor: 'paymentAmount',
      header: 'Amount',
      align: 'right',
      sortable: true,
      render: (payment) => <MoneyCell value={payment.paymentAmount} className="text-success-700" />,
      exportValue: (payment) => payment.paymentAmount,
    },
    {
      accessor: 'remainingBalance',
      header: 'Balance after',
      align: 'right',
      hideOnMobile: true,
      render: (payment) =>
        payment.remainingBalance > 0 ? (
          <MoneyCell value={payment.remainingBalance} className="text-navy-600" />
        ) : (
          <span className="text-2xs font-medium text-success-700">Cleared</span>
        ),
      exportValue: (payment) => payment.remainingBalance,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (payment) => (
        <div className="flex items-center justify-end gap-0.5">
          <ReverseActions
            record={payment}
            label="payment"
            cancelled={payment.status === 'reversed'}
            onCancel={(id, reason) => paymentService.reverse(id, reason)}
            onDelete={(id, reason) => paymentService.delete(id, reason)}
            onDone={(action) =>
              setPayments((prev) =>
                action === 'delete'
                  ? prev.filter((r) => r._id !== payment._id)
                  : prev.map((r) =>
                      r._id === payment._id ? { ...r, status: 'reversed' } : r
                    )
              )
            }
          />
          <IconButton
            icon={Eye}
            label="View this payment"
            size="icon-sm"
            onClick={(e) => { e.stopPropagation(); setViewing(payment); }}
          />
          <IconButton
            icon={Printer}
            label="Print the receipt"
            size="icon-sm"
            onClick={(e) => { e.stopPropagation(); openReceipt(payment); }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <TabGuide id="payments" />

      <PageHeader
        title="Payments"
        subtitle={`${pagination.total.toLocaleString('en-PK')} receipt${pagination.total === 1 ? '' : 's'} issued`}
        icon={WalletCards}
        actions={
          hasPermission('payments') && (
            <Button variant="gold" icon={Plus} onClick={() => setFormOpen(true)}>
              Record payment
            </Button>
          )
        }
      />

      <StatGrid columns={3}>
        <StatCard
          label="Collected (this page)"
          value={sumBy(payments, 'paymentAmount')}
          icon={Banknote}
          variant="green"
          compact
        />
        <StatCard
          label="Receipts"
          value={pagination.total}
          icon={Receipt}
          variant="navy"
          isCurrency={false}
        />
        <StatCard
          label="Average payment"
          value={payments.length ? sumBy(payments, 'paymentAmount') / payments.length : 0}
          icon={TrendingUp}
          variant="blue"
          compact
        />
      </StatGrid>

      <DataTable
        columns={columns}
        data={payments}
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
        searchPlaceholder="Search by receipt, customer or reference…"
        onRowClick={setViewing}
        exportFilename="payments"
        printable
        title="Payments"
        activeFilterCount={Object.values(table.filters).filter(Boolean).length}
        onClearFilters={table.resetFilters}
        filters={
          <FormRow cols={3}>
            <Select
              label="Method"
              value={table.filters.paymentMethod}
              onChange={(e) => table.setFilter('paymentMethod', e.target.value)}
              placeholder="All methods"
              options={PAYMENT_METHODS}
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
            icon={WalletCards}
            title={table.hasActiveFilters ? 'No matching payments' : 'No payments yet'}
            message={
              table.hasActiveFilters
                ? 'Try clearing your search or filters.'
                : 'Payments recorded against installments will appear here.'
            }
            action={
              hasPermission('payments') && !table.hasActiveFilters ? (
                <Button variant="gold" icon={Plus} onClick={() => setFormOpen(true)}>
                  Record a payment
                </Button>
              ) : null
            }
          />
        }
      />

      <RecordPaymentModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={({ payment, thankYou: message }) => {
          setFormOpen(false);
          load();
          setReceiptPreview({ payment, business });
          if (message) setThankYou(message);
        }}
      />

      <PaymentDetailModal
        payment={viewing}
        onClose={() => setViewing(null)}
        onPrint={() => { const p = viewing; setViewing(null); openReceipt(p); }}
      />

      <DocumentPreviewModal
        isOpen={Boolean(receiptPreview)}
        onClose={() => setReceiptPreview(null)}
        type="receipt"
        data={receiptPreview?.payment}
        business={receiptPreview?.business || business}
        sharePhone={receiptPreview?.payment?.customerPhone}
        shareMessage={thankYou?.message}
      />

      {/* Offer the thank-you message once, right after a payment is recorded */}
      <Modal
        isOpen={Boolean(thankYou)}
        onClose={() => setThankYou(null)}
        title="Send a confirmation?"
        subtitle="The customer can be told their payment was received"
        icon={MessageCircle}
        size="sm"
        footer={
          <ModalFooter>
            <Button variant="secondary" onClick={() => setThankYou(null)}>Not now</Button>
            <Button
              variant="whatsapp"
              icon={MessageCircle}
              onClick={() => {
                window.open(thankYou.whatsappUrl, '_blank', 'noopener');
                setThankYou(null);
              }}
            >
              Send on WhatsApp
            </Button>
          </ModalFooter>
        }
      >
        <p className="text-sm text-navy-700 leading-relaxed bg-navy-50 border border-navy-200 rounded-lg p-3 whitespace-pre-line">
          {thankYou?.message}
        </p>
      </Modal>
    </div>
  );
}

/* ============================================================================
 * Record a payment
 * ========================================================================== */

function RecordPaymentModal({ isOpen, onClose, onSuccess }) {
  const toast = useToastStore();

  const [customers, setCustomers] = useState([]);
  const [openSales, setOpenSales] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    customer: '',
    sale: '',
    paymentAmount: '',
    paymentMethod: 'cash',
    paymentDate: toDateInput(new Date()),
    referenceNumber: '',
    notes: '',
  });

  useEffect(() => {
    if (!isOpen) return;

    setForm({
      customer: '', sale: '', paymentAmount: '', paymentMethod: 'cash',
      paymentDate: toDateInput(new Date()), referenceNumber: '', notes: '',
    });
    setOpenSales([]);
    setLoadingCustomers(true);

    // Only customers who actually owe money - the rest are noise here
    customerService
      .list({ limit: 500, status: 'active' })
      .then((response) => {
        setCustomers((response.data.customers || []).filter((c) => c.outstanding > 0));
      })
      .catch((error) => toast.apiError(error, 'Could not load customers.'))
      .finally(() => setLoadingCustomers(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Load that customer's open invoices once one is chosen
  useEffect(() => {
    if (!form.customer) { setOpenSales([]); return; }

    saleService
      .list({ customerId: form.customer, status: 'ongoing', limit: 50 })
      .then((response) => setOpenSales(response.data.sales || []))
      .catch(() => setOpenSales([]));
  }, [form.customer]);

  const selectedCustomer = customers.find((c) => c._id === form.customer);
  const amount = Number(form.paymentAmount) || 0;

  const handleSubmit = async (event) => {
    event?.preventDefault();

    if (!form.customer) { toast.warning('Choose a customer.'); return; }
    if (amount <= 0) { toast.warning('Enter an amount greater than zero.'); return; }

    setSaving(true);
    try {
      const response = await paymentService.create({
        customer: form.customer,
        sale: form.sale || undefined,
        paymentAmount: amount,
        paymentMethod: form.paymentMethod,
        paymentDate: form.paymentDate,
        referenceNumber: form.referenceNumber,
        notes: form.notes,
      });

      toast.success(response.message);
      onSuccess?.({ payment: response.data.payment, thankYou: response.data.thankYou });
    } catch (error) {
      toast.apiError(error, 'Could not record the payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record a payment"
      subtitle="Applied oldest installment first"
      icon={WalletCards}
      size="md"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            variant="success"
            icon={Banknote}
            onClick={handleSubmit}
            isLoading={saving}
            loadingText="Recording…"
            disabled={!form.customer || amount <= 0}
          >
            Record {amount > 0 ? formatCurrency(amount) : 'payment'}
          </Button>
        </ModalFooter>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <SearchSelect
          label="Customer"
          required
          value={form.customer}
          onChange={(value) => setForm({ ...form, customer: value, sale: '', paymentAmount: '' })}
          options={customers.map((c) => ({
            value: c._id,
            label: c.name,
            sublabel: c.mobile1,
            meta: formatCurrency(c.outstanding),
          }))}
          placeholder={loadingCustomers ? 'Loading…' : 'Search customers with a balance'}
          emptyMessage="No customer currently owes anything."
        />

        {selectedCustomer && (
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-navy-50 border border-navy-100 p-3 text-center animate-fade-in">
            {[
              { label: 'Outstanding', value: selectedCustomer.outstanding, tone: 'text-warning-600' },
              { label: 'Overdue', value: selectedCustomer.overdue, tone: 'text-danger-600' },
              { label: 'Total paid', value: selectedCustomer.totalPaid, tone: 'text-success-700' },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-2xs text-navy-500 leading-tight">{item.label}</p>
                <p className={cn('text-sm font-semibold tabular mt-0.5', item.tone)}>
                  {formatCurrency(item.value)}
                </p>
              </div>
            ))}
          </div>
        )}

        {openSales.length > 1 && (
          <Select
            label="Apply to a specific invoice"
            value={form.sale}
            onChange={(e) => setForm({ ...form, sale: e.target.value })}
            placeholder="Oldest installment first (recommended)"
            options={openSales.map((sale) => ({
              value: sale._id,
              label: `${sale.invoiceNumber} — ${formatCurrency(sale.remainingBalance)} due`,
            }))}
            hint="Leave blank to settle the oldest installments across every invoice"
          />
        )}

        <CurrencyInput
          label="Amount received"
          required
          value={form.paymentAmount}
          onChange={(e) => setForm({ ...form, paymentAmount: e.target.value })}
        />

        {selectedCustomer && (
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Full balance', value: selectedCustomer.outstanding },
              { label: 'Overdue only', value: selectedCustomer.overdue },
            ]
              .filter((option) => option.value > 0)
              .map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setForm({ ...form, paymentAmount: String(option.value) })}
                  className={cn(
                    'px-2.5 py-1.5 rounded-lg border text-2xs font-medium transition-all active:scale-95',
                    amount === option.value
                      ? 'border-gold-500 bg-gold-50 text-navy-950'
                      : 'border-navy-200 text-navy-600 hover:border-navy-300 hover:bg-navy-50'
                  )}
                >
                  {option.label}
                  <span className="block text-navy-400 tabular">{formatCurrency(option.value)}</span>
                </button>
              ))}
          </div>
        )}

        <FormRow cols={2}>
          <Select
            label="Method"
            value={form.paymentMethod}
            onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            options={PAYMENT_METHODS}
          />
          <Input
            label="Date"
            type="date"
            value={form.paymentDate}
            onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
            max={toDateInput(new Date())}
          />
        </FormRow>

        <FormRow cols={2}>
          <Input
            label="Reference"
            value={form.referenceNumber}
            onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
            placeholder="Transaction ID (optional)"
          />
          <Input
            label="Note"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Optional"
          />
        </FormRow>

        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}

/* ============================================================================
 * Detail
 * ========================================================================== */

function PaymentDetailModal({ payment, onClose, onPrint }) {
  if (!payment) return null;

  return (
    <Modal
      isOpen={Boolean(payment)}
      onClose={onClose}
      title={payment.receiptNumber}
      subtitle={`${payment.customerName} · ${formatDate(payment.paymentDate)}`}
      icon={Receipt}
      size="md"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button variant="gold" icon={Printer} onClick={onPrint}>Print receipt</Button>
        </ModalFooter>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-success-50 border border-success-200 px-4 py-3.5 text-center">
          <p className="text-2xs font-semibold uppercase tracking-wider text-success-700">Received</p>
          <p className="text-2xl font-display font-bold text-success-800 tabular mt-0.5">
            {formatCurrency(payment.paymentAmount)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldDisplay label="Method" value={payment.paymentMethod} />
          <FieldDisplay label="Reference" value={payment.referenceNumber} />
          <FieldDisplay label="Balance before" value={formatCurrency(payment.previousBalance)} mono />
          <FieldDisplay label="Balance after" value={formatCurrency(payment.remainingBalance)} mono />
          <FieldDisplay label="Next due" value={formatDate(payment.nextDueDate)} />
          <FieldDisplay label="Recorded" value={formatDateTime(payment.createdAt)} />
        </div>

        {payment.allocations?.length > 0 && (
          <div>
            <p className="label">Applied to</p>
            <ul className="divide-y divide-navy-100 rounded-lg border border-navy-200 overflow-hidden">
              {payment.allocations.map((allocation, index) => (
                <li key={index} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-sm text-navy-700">
                    {allocation.sale?.invoiceNumber || 'Invoice'} ·{' '}
                    {allocation.installmentNumber === 0
                      ? 'Advance'
                      : `Installment #${allocation.installmentNumber}`}
                  </span>
                  <span className="text-sm font-medium text-navy-950 tabular">
                    {formatCurrency(allocation.allocatedAmount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {payment.notes && <FieldDisplay label="Note" value={payment.notes} />}
      </div>
    </Modal>
  );
}
