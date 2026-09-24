/**
 * ============================================
 * Installments
 * ============================================
 * The collection worklist: who owes what, how late they are, and one-tap
 * actions to chase or settle it.
 *
 * Bucketed by urgency rather than presented as one long table, because the
 * work is genuinely different: overdue accounts need chasing today, upcoming
 * ones need a courtesy reminder, and the rest need nothing at all.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText, CalendarClock, MessageCircle, Wallet, Phone, TriangleAlert, Clock,
  CheckCircle2, Users, RefreshCw, Eye, Banknote, CalendarDays,
} from 'lucide-react';

import PageHeader from '../../components/common/PageHeader.jsx';
import TabGuide from '../../components/common/TabGuide.jsx';
import StatCard, { StatGrid } from '../../components/common/StatCard.jsx';
import Badge from '../../components/common/Badge.jsx';
import Button, { IconButton } from '../../components/common/Button.jsx';
import DataTable, { MoneyCell } from '../../components/common/DataTable.jsx';
import Tabs from '../../components/common/Tabs.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import Modal, { ModalFooter } from '../../components/common/Modal.jsx';
import { CurrencyInput, Select, Input, FormRow, FieldDisplay } from '../../components/common/Form.jsx';
import { PageSkeleton } from '../../components/common/Skeleton.jsx';
import ReminderModal from '../../components/modals/ReminderModal.jsx';
import DocumentPreviewModal from '../../components/modals/DocumentPreviewModal.jsx';

import { saleService, paymentService, reminderService } from '../../services/entities.js';
import { useUIStore } from '../../context/uiStore.js';
import { useAuthStore } from '../../context/authStore.js';
import { useSettingsStore } from '../../context/settingsStore.js';
import { useToastStore } from '../../context/toastStore.js';
import {
  cn, formatCurrency, formatDate, getTelURL, getWhatsAppURL, sumBy,
} from '../../utils/index.js';
import { INSTALLMENT_STATUSES, PAYMENT_METHODS } from '../../constants/index.js';

export default function InstallmentsPage() {
  const [viewing, setViewing] = useState(null);
  const toast = useToastStore();
  const { ownership } = useUIStore();
  const { hasPermission } = useAuthStore();
  const business = useSettingsStore((s) => s.business);
  const settings = useSettingsStore((s) => s.settings);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bucket, setBucket] = useState('overdue');
  const [search, setSearch] = useState('');

  const [payTarget, setPayTarget] = useState(null);
  const [reminderTarget, setReminderTarget] = useState(null);

  /** The sale behind a row, loaded on demand for the invoice preview. */
  const [invoicePreview, setInvoicePreview] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(null);
  const [bulkReminderOpen, setBulkReminderOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);

  // ---- Load -------------------------------------------------------------
  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) setRefreshing(true);
      else setLoading(true);

      try {
        const response = await saleService.getInstallments({ ownership });
        setData(response.data);
      } catch (error) {
        toast.apiError(error, 'Could not load the installment list.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ownership]
  );

  useEffect(() => { load(); }, [load]);

  // ---- Derived ----------------------------------------------------------
  const rows = useMemo(() => {
    if (!data) return [];
    const source = bucket === 'all'
      ? [...data.overdue, ...data.dueToday, ...data.upcoming, ...data.later]
      : data[bucket] || [];

    if (!search.trim()) return source;

    const needle = search.toLowerCase();
    return source.filter(
      (row) =>
        row.customerName?.toLowerCase().includes(needle) ||
        row.invoiceNumber?.toLowerCase().includes(needle) ||
        row.customerPhone?.includes(needle) ||
        row.productName?.toLowerCase().includes(needle)
    );
  }, [data, bucket, search]);

  const tabs = useMemo(() => {
    if (!data) return [];
    return [
      { id: 'overdue', label: 'Overdue', icon: TriangleAlert, count: data.summary.overdueCount },
      { id: 'dueToday', label: 'Due today', icon: Clock, count: data.summary.dueTodayCount },
      { id: 'upcoming', label: 'Upcoming', icon: CalendarDays, count: data.summary.upcomingCount },
      { id: 'later', label: 'Later', icon: CheckCircle2, count: data.summary.laterCount },
      { id: 'all', label: 'All open' },
    ];
  }, [data]);

  if (loading || !data) return <PageSkeleton stats={4} showChart={false} />;

  const { summary } = data;

  // ---- Columns ----------------------------------------------------------
  const columns = [
    {
      accessor: 'customerName',
      header: 'Customer',
      primary: true,
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-navy-950 truncate">{row.customerName}</p>
          <p className="text-2xs text-navy-500 tabular">
            {row.customerPhone || 'No phone on file'}
          </p>
        </div>
      ),
      exportValue: (row) => row.customerName,
    },
    {
      accessor: 'invoiceNumber',
      header: 'Invoice',
      secondary: true,
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="text-sm tabular text-navy-800">{row.invoiceNumber}</p>
          <p className="text-2xs text-navy-500 truncate">{row.productName}</p>
        </div>
      ),
      exportValue: (row) => row.invoiceNumber,
    },
    {
      accessor: 'installmentNumber',
      header: 'Installment',
      align: 'center',
      hideOnMobile: true,
      render: (row) => (
        <span className="text-sm tabular text-navy-700">
          {row.installmentNumber}
          <span className="text-navy-400"> / {row.totalInstallments}</span>
        </span>
      ),
      exportValue: (row) => `${row.installmentNumber}/${row.totalInstallments}`,
    },
    {
      accessor: 'dueDate',
      header: 'Due date',
      sortable: true,
      render: (row) => (
        <div>
          <p className="text-sm text-navy-800 tabular">{formatDate(row.dueDate)}</p>
          {row.daysOverdue > 0 ? (
            <p className="text-2xs font-medium text-danger-600">
              {row.daysOverdue} day{row.daysOverdue === 1 ? '' : 's'} late
            </p>
          ) : row.daysUntilDue > 0 ? (
            <p className="text-2xs text-navy-500">in {row.daysUntilDue} days</p>
          ) : (
            <p className="text-2xs font-medium text-warning-600">Today</p>
          )}
        </div>
      ),
      exportValue: (row) => formatDate(row.dueDate),
    },
    {
      accessor: 'remaining',
      header: 'Amount due',
      align: 'right',
      sortable: true,
      render: (row) => (
        <div className="text-right">
          <MoneyCell value={row.remaining} className={row.daysOverdue > 0 ? 'text-danger-600' : ''} />
          {row.paid > 0 && (
            <p className="text-2xs text-success-700">{formatCurrency(row.paid)} already paid</p>
          )}
        </div>
      ),
      exportValue: (row) => row.remaining,
    },
    {
      accessor: 'status',
      header: 'Status',
      hideOnMobile: true,
      render: (row) => (
        <Badge variant={INSTALLMENT_STATUSES[row.status]?.color || 'neutral'} size="sm">
          {INSTALLMENT_STATUSES[row.status]?.label || row.status}
        </Badge>
      ),
      exportValue: (row) => INSTALLMENT_STATUSES[row.status]?.label || row.status,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {hasPermission('payments') && (
            <Button
              variant="success-soft"
              size="xs"
              icon={Wallet}
              onClick={(e) => { e.stopPropagation(); setPayTarget(row); }}
            >
              Collect
            </Button>
          )}

          {/* The worklist shows one instalment; the invoice behind it is what
              answers "what did they actually buy?" when a customer queries a
              figure at the counter. Fetched on demand rather than with the
              list, because the list is long and most rows are never opened. */}
          <IconButton
            icon={FileText}
            label="View the invoice"
            size="icon-sm"
            isLoading={loadingInvoice === row.saleId}
            onClick={async (e) => {
              e.stopPropagation();
              setLoadingInvoice(row.saleId);
              try {
                const response = await saleService.get(row.saleId);
                setInvoicePreview(response.data.sale || response.data);
              } catch (error) {
                toast.apiError(error, 'Could not open that invoice.');
              } finally {
                setLoadingInvoice(null);
              }
            }}
          />

          {row.customerPhone && (
            <>
              <IconButton
                icon={MessageCircle}
                label="Send a reminder"
                size="icon-sm"
                variant="ghost"
                className="text-[#25D366] hover:bg-[#25D366]/10"
                onClick={(e) => { e.stopPropagation(); setReminderTarget(row); }}
              />
              <a
                href={getTelURL(row.customerPhone)}
                onClick={(e) => e.stopPropagation()}
                title={`Call ${row.customerName}`}
                aria-label={`Call ${row.customerName}`}
                className="hidden sm:inline-flex p-1.5 rounded-md text-info-600 hover:bg-info-50 transition-colors"
              >
                <Phone size={15} />
              </a>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <TabGuide id="installments" />

      <PageHeader
        title="Installments"
        subtitle="Track what is due, chase what is late, collect on the spot"
        icon={CalendarClock}
        actions={
          <>
            <IconButton
              icon={RefreshCw}
              label="Refresh"
              variant="secondary"
              onClick={() => load({ silent: true })}
              disabled={refreshing}
              className={cn(refreshing && '[&>svg]:animate-spin')}
            />
            {summary.overdueCount > 0 && (
              <Button variant="whatsapp" icon={MessageCircle} onClick={() => setBulkReminderOpen(true)}>
                Remind {summary.overdueCount} overdue
              </Button>
            )}
          </>
        }
      />

      {/* Summary */}
      <StatGrid columns={4}>
        <StatCard
          label="Overdue"
          value={summary.overdueAmount}
          icon={TriangleAlert}
          variant="red"
          compact
          subtitle={`${summary.overdueCount} across ${summary.affectedCustomers} customer${summary.affectedCustomers === 1 ? '' : 's'}`}
          onClick={() => setBucket('overdue')}
        />
        <StatCard
          label="Due today"
          value={summary.dueTodayAmount}
          icon={Clock}
          variant="amber"
          compact
          subtitle={`${summary.dueTodayCount} installment${summary.dueTodayCount === 1 ? '' : 's'}`}
          onClick={() => setBucket('dueToday')}
        />
        <StatCard
          label={`Next ${settings?.notification?.upcomingDueDays || 3} days`}
          value={summary.upcomingAmount}
          icon={CalendarDays}
          variant="blue"
          compact
          subtitle={`${summary.upcomingCount} installment${summary.upcomingCount === 1 ? '' : 's'}`}
          onClick={() => setBucket('upcoming')}
        />
        <StatCard
          label="Later"
          value={summary.laterAmount}
          icon={CheckCircle2}
          variant="slate"
          compact
          subtitle={`${summary.laterCount} scheduled`}
          onClick={() => setBucket('later')}
        />
      </StatGrid>

      <Tabs tabs={tabs} active={bucket} onChange={setBucket} />

      <DataTable
        columns={columns}
        data={rows}
        onRowClick={setViewing}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by customer, invoice, phone or product…"
        pageSize={25}
        exportFilename={`installments-${bucket}`}
        printable
        title="Installments"
        emptyState={
          <EmptyState
            icon={bucket === 'overdue' ? CheckCircle2 : CalendarClock}
            title={bucket === 'overdue' ? 'No overdue accounts' : 'Nothing here'}
            message={
              bucket === 'overdue'
                ? 'Every customer is up to date on their payments.'
                : search
                  ? 'No installments match your search.'
                  : 'There are no installments in this category.'
            }
          />
        }
      />

      {/* ---- Modals ---- */}
      <InstallmentDetailModal
        row={viewing}
        onClose={() => setViewing(null)}
        canCollect={hasPermission('payments')}
        onCollect={(row) => { setViewing(null); setPayTarget(row); }}
        onRemind={(row) => { setViewing(null); setReminderTarget(row); }}
        onInvoice={async (row) => {
          setViewing(null);
          try {
            const response = await saleService.get(row.saleId);
            setInvoicePreview(response.data.sale || response.data);
          } catch (error) {
            toast.apiError(error, 'Could not open that invoice.');
          }
        }}
      />

      <CollectPaymentModal
        installment={payTarget}
        onClose={() => setPayTarget(null)}
        onSuccess={(payment) => {
          setPayTarget(null);
          setReceipt(payment);
          load({ silent: true });
        }}
      />

      <SingleReminderModal
        installment={reminderTarget}
        onClose={() => setReminderTarget(null)}
      />

      <ReminderModal
        isOpen={bulkReminderOpen}
        onClose={() => { setBulkReminderOpen(false); load({ silent: true }); }}
        initialScope="overdue"
      />

      <DocumentPreviewModal
        isOpen={Boolean(invoicePreview)}
        onClose={() => setInvoicePreview(null)}
        type="invoice"
        data={invoicePreview}
        business={business}
        sharePhone={invoicePreview?.customerPhone}
      />

      <DocumentPreviewModal
        isOpen={Boolean(receipt)}
        onClose={() => setReceipt(null)}
        type="receipt"
        data={receipt}
        business={business}
        sharePhone={receipt?.customerPhone}
        shareMessage={
          receipt
            ? `Payment of ${formatCurrency(receipt.paymentAmount)} received. Receipt ${receipt.receiptNumber}. Balance: ${formatCurrency(receipt.remainingBalance)}.`
            : ''
        }
      />
    </div>
  );
}

/* ============================================================================
 * Detail
 * ========================================================================== */

/** One instalment in full, with the three things done from it. */
function InstallmentDetailModal({ row, onClose, canCollect, onCollect, onRemind, onInvoice }) {
  if (!row) return null;
  const late = row.daysOverdue > 0;

  return (
    <Modal
      isOpen={Boolean(row)}
      onClose={onClose}
      title={`${row.customerName} · instalment ${row.installmentNumber}${row.totalInstallments ? ` of ${row.totalInstallments}` : ''}`}
      subtitle={`${row.invoiceNumber}${row.productName ? ` · ${row.productName}` : ''}`}
      icon={CalendarClock}
      size="md"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button variant="secondary" icon={FileText} onClick={() => onInvoice(row)}>Invoice</Button>
          {row.customerPhone && (
            <Button variant="whatsapp" icon={MessageCircle} onClick={() => onRemind(row)}>Remind</Button>
          )}
          {canCollect && row.remaining > 0 && (
            <Button variant="gold" icon={Wallet} onClick={() => onCollect(row)}>Collect</Button>
          )}
        </ModalFooter>
      }
    >
      <div className="space-y-4 soft-in">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Due', value: row.expected ?? (row.paid || 0) + (row.remaining || 0), tone: 'text-navy-950' },
            { label: 'Paid', value: row.paid, tone: 'text-success-700' },
            { label: 'Still to pay', value: row.remaining, tone: late ? 'text-danger-600' : 'text-warning-600' },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-navy-50 border border-navy-100 p-3 text-center">
              <p className="text-2xs text-navy-500">{item.label}</p>
              <p className={cn('text-sm font-bold tabular mt-0.5', item.tone)}>{formatCurrency(item.value)}</p>
            </div>
          ))}
        </div>

        <div className={cn('rounded-xl border px-3 py-2.5 text-sm', late ? 'border-danger-200 bg-danger-50 text-danger-800' : 'border-navy-100 bg-white text-navy-700')}>
          Due on <strong>{formatDate(row.dueDate)}</strong>
          {late ? ` - ${row.daysOverdue} day(s) late` : row.daysUntilDue > 0 ? ` - in ${row.daysUntilDue} day(s)` : ' - today'}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldDisplay label="Customer" value={row.customerName} />
          <FieldDisplay label="Phone" value={row.customerPhone} icon={Phone} />
          <FieldDisplay label="Invoice" value={row.invoiceNumber} mono />
          <FieldDisplay label="Item" value={row.productName} />
          <FieldDisplay label="Status" value={INSTALLMENT_STATUSES[row.status]?.label || row.status} />
        </div>

        {row.customerPhone && (
          <a href={getTelURL(row.customerPhone)} className="btn-secondary btn w-full justify-center">
            <Phone size={15} /> Call {row.customerName?.split(' ')[0]}
          </a>
        )}
      </div>
    </Modal>
  );
}

/* ============================================================================
 * Collect payment
 * ========================================================================== */

/**
 * Records a payment against one installment.
 *
 * The amount is pre-filled with what is owed, because that is what happens
 * ninety-nine times in a hundred - but it stays editable so a partial payment
 * takes two taps rather than a trip to another screen.
 */
function CollectPaymentModal({ installment, onClose, onSuccess }) {
  const toast = useToastStore();
  const settings = useSettingsStore((s) => s.settings);

  const [form, setForm] = useState({ paymentAmount: '', paymentMethod: 'cash', referenceNumber: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (installment) {
      setForm({
        paymentAmount: String(installment.remaining),
        paymentMethod: 'cash',
        referenceNumber: '',
        notes: '',
      });
    }
  }, [installment]);

  if (!installment) return null;

  const amount = Number(form.paymentAmount) || 0;
  const isPartial = amount > 0 && amount < installment.remaining;
  const isOver = amount > installment.saleBalance;
  const allowPartial = settings?.payment?.allowPartialPayment ?? true;

  const handleSubmit = async (event) => {
    event?.preventDefault();

    if (amount <= 0) {
      toast.warning('Enter an amount greater than zero.');
      return;
    }
    if (isPartial && !allowPartial) {
      toast.error('Partial payments are switched off in Settings.');
      return;
    }

    setSaving(true);
    try {
      const response = await paymentService.create({
        customer: installment.customer?._id || installment.customer,
        sale: installment.saleId,
        paymentAmount: amount,
        paymentMethod: form.paymentMethod,
        referenceNumber: form.referenceNumber,
        notes: form.notes,
      });

      toast.success(response.message);
      onSuccess?.(response.data.payment);
    } catch (error) {
      toast.apiError(error, 'Could not record the payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(installment)}
      onClose={onClose}
      title="Collect payment"
      subtitle={`${installment.customerName} · ${installment.invoiceNumber}`}
      icon={Wallet}
      size="sm"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            variant="success"
            icon={Banknote}
            onClick={handleSubmit}
            isLoading={saving}
            loadingText="Recording…"
            disabled={amount <= 0}
          >
            Record {amount > 0 ? formatCurrency(amount) : 'payment'}
          </Button>
        </ModalFooter>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Context */}
        <div className="rounded-lg bg-navy-50 border border-navy-100 p-3 grid grid-cols-3 gap-2 text-center">
          {[
            { label: `Installment #${installment.installmentNumber}`, value: installment.expected },
            { label: 'Already paid', value: installment.paid },
            { label: 'Still due', value: installment.remaining, tone: 'text-danger-600' },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-2xs text-navy-500 leading-tight">{item.label}</p>
              <p className={cn('text-sm font-semibold tabular mt-0.5', item.tone || 'text-navy-950')}>
                {formatCurrency(item.value)}
              </p>
            </div>
          ))}
        </div>

        <CurrencyInput
          label="Amount received"
          required
          autoFocus
          value={form.paymentAmount}
          onChange={(e) => setForm({ ...form, paymentAmount: e.target.value })}
          error={isOver ? 'That is more than the full outstanding balance on this invoice.' : undefined}
          hint={
            isPartial
              ? `Partial payment — ${formatCurrency(installment.remaining - amount)} would remain on this installment.`
              : undefined
          }
        />

        {/* Quick amounts: the two most common cases in one tap each */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'This installment', value: installment.remaining },
            { label: 'Full balance', value: installment.saleBalance },
            { label: 'Half', value: Math.round(installment.remaining / 2) },
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

        <FormRow cols={2}>
          <Select
            label="Method"
            value={form.paymentMethod}
            onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            options={PAYMENT_METHODS}
          />
          <Input
            label="Reference"
            value={form.referenceNumber}
            onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
            placeholder="Transaction ID (optional)"
          />
        </FormRow>

        <Input
          label="Note"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Anything worth recording (optional)"
        />

        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}

/* ============================================================================
 * Single reminder
 * ========================================================================== */

/** Shows the generated message for one installment before it is sent. */
function SingleReminderModal({ installment, onClose }) {
  const toast = useToastStore();
  const [reminder, setReminder] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!installment) { setReminder(null); return; }

    setLoading(true);
    reminderService
      .forInstallment(installment.saleId, installment.installmentNumber)
      .then((response) => setReminder(response.data.reminder))
      .catch((error) => toast.apiError(error, 'Could not prepare the reminder.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installment]);

  const handleSend = async () => {
    if (!reminder?.whatsappUrl) return;
    window.open(reminder.whatsappUrl, '_blank', 'noopener');

    try {
      await reminderService.log([reminder], 'whatsapp');
      toast.success('Reminder opened in WhatsApp and recorded.');
    } catch {
      toast.warning('Reminder opened, but it could not be recorded in the log.');
    }
    onClose?.();
  };

  return (
    <Modal
      isOpen={Boolean(installment)}
      onClose={onClose}
      title="Send a reminder"
      subtitle={installment?.customerName}
      icon={MessageCircle}
      size="sm"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="whatsapp" icon={MessageCircle} onClick={handleSend} disabled={!reminder?.whatsappUrl}>
            Open WhatsApp
          </Button>
        </ModalFooter>
      }
    >
      {loading ? (
        <div className="skeleton h-28 rounded-lg" />
      ) : reminder ? (
        <div className="space-y-3">
          <p className="text-sm text-navy-700 leading-relaxed bg-navy-50 border border-navy-200 rounded-lg p-3 whitespace-pre-line">
            {reminder.message}
          </p>
          <p className="text-2xs text-navy-500">
            Sending to {reminder.phone}. The wording comes from your reminder template in
            Settings, so every member of staff sends the same message.
          </p>
        </div>
      ) : (
        <EmptyState icon={MessageCircle} title="No message" message="This reminder could not be prepared." size="sm" />
      )}
    </Modal>
  );
}
