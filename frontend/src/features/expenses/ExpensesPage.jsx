/**
 * ============================================
 * Expenses
 * ============================================
 * Shop running costs: rent, electricity, salaries, transport and the rest.
 *
 * Expenses carry an ownership allocation because they reduce whoever's profit
 * they belong to. A partner's salary contribution should not quietly come out
 * of the owner's share.
 */

import { ReceiptText, Wallet, Calendar, Building2, Paperclip } from 'lucide-react';

import { createListPage, RowActions } from '../../components/common/createListPage.jsx';
import {
  Input, Textarea, Select, CurrencyInput, FormRow, FormSection, FieldDisplay,
} from '../../components/common/Form.jsx';
import FileUpload from '../../components/common/FileUpload.jsx';
import Badge from '../../components/common/Badge.jsx';
import StatCard, { StatGrid } from '../../components/common/StatCard.jsx';
import { MoneyCell } from '../../components/common/DataTable.jsx';
import { expenseService, partnerService } from '../../services/entities.js';
import {
  formatCurrency, formatDate, toDateInput, sumBy, resolveFileUrl, groupBy,
} from '../../utils/index.js';
import {
  EXPENSE_CATEGORIES, PAYMENT_METHODS, OWNERSHIP_ALLOCATIONS, paymentMethodLabel,
} from '../../constants/index.js';

export default createListPage({
  guideId: 'expenses',
  entityName: 'Expense',
  entityNamePlural: 'Expenses',
  collectionKey: 'expenses',
  icon: ReceiptText,
  service: expenseService,
  permission: 'expenses',
  searchPlaceholder: 'Search by description, category or who was paid…',
  initialSort: 'expenseDate',
  initialFilters: { category: '', startDate: '', endDate: '' },

  // Partners are needed by the ownership picker
  onLoadExtras: async () => {
    const response = await partnerService.list({ limit: 100 });
    return { partners: response.data.partners || [] };
  },

  getInitialForm: () => ({
    category: 'Shop Rent',
    description: '',
    amount: '',
    paymentMethod: 'cash',
    expenseDate: toDateInput(new Date()),
    ownership: 'owner',
    partner: '',
    paidTo: '',
    referenceNumber: '',
    receiptImage: null,
    notes: '',
  }),

  toPayload: (form) => ({
    ...form,
    // The server rejects an empty string where it expects an id or null
    partner: form.ownership === 'owner' ? null : form.partner || null,
  }),

  renderForm: (form, setForm, { extras }) => (
    <>
      <FormSection title="What was spent" icon={Wallet}>
        <FormRow cols={2}>
          <Select
            label="Category"
            required
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
          <CurrencyInput
            label="Amount"
            required
            autoFocus
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </FormRow>

        <Input
          label="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="e.g. Shop rent for September"
        />

        <FormRow cols={2}>
          <Input
            label="Paid to"
            value={form.paidTo}
            onChange={(e) => setForm({ ...form, paidTo: e.target.value })}
            placeholder="Landlord, staff member, utility company…"
          />
          <Input
            label="Date"
            type="date"
            required
            value={form.expenseDate}
            onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
            max={toDateInput(new Date())}
          />
        </FormRow>

        <FormRow cols={2}>
          <Select
            label="Paid by"
            value={form.paymentMethod}
            onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            options={PAYMENT_METHODS}
          />
          <Input
            label="Reference"
            value={form.referenceNumber}
            onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
            placeholder="Receipt or transaction number"
          />
        </FormRow>
      </FormSection>

      <FormSection
        title="Who bears this cost"
        icon={Building2}
        description="Decides whose profit the expense is deducted from"
      >
        <FormRow cols={2}>
          <Select
            label="Ownership"
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
              options={(extras?.partners || []).map((p) => ({
                value: p._id,
                label: `${p.name} (${p.ownershipPercent}%)`,
              }))}
            />
          )}
        </FormRow>
      </FormSection>

      <FormSection title="Bill or receipt" icon={Paperclip}>
        <FileUpload
          label="Attach the bill"
          hint="A photo or a PDF — useful when reconciling the month"
          value={form.receiptImage}
          onChange={(url) => setForm({ ...form, receiptImage: url })}
          allowPdf
          folder="expenses"
          aspect="wide"
          compact
        />

        <Textarea
          label="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={2}
          maxLength={500}
        />
      </FormSection>
    </>
  ),

  // Every matching expense, from the server - not just the rows on this page.
  renderSummary: (summary) => (
    <StatGrid columns={3}>
      <StatCard label="Total spent" value={summary.total} icon={ReceiptText} variant="amber" subtitle="With the filters applied" />
      <StatCard label="Entries" value={summary.count} icon={Calendar} variant="navy" isCurrency={false} />
      <StatCard
        label="Largest category"
        value={summary.topCategory?.total || 0}
        icon={Wallet}
        variant="red"
        subtitle={summary.topCategory?.category || '—'}
      />
    </StatGrid>
  ),

  // A new, edited or deleted expense changes the totals above the list.
  onChanged: ({ reload }) => reload(),

  columns: ({ onEdit, onDelete, onView, canManage }) => [
    {
      accessor: 'expenseDate',
      header: 'Date',
      sortable: true,
      secondary: true,
      render: (expense) => (
        <span className="text-sm text-navy-800 tabular">{formatDate(expense.expenseDate)}</span>
      ),
      exportValue: (expense) => formatDate(expense.expenseDate),
    },
    {
      accessor: 'category',
      header: 'Category',
      sortable: true,
      primary: true,
      render: (expense) => (
        <div className="min-w-0">
          <p className="font-medium text-navy-950 truncate">{expense.category}</p>
          {expense.description && (
            <p className="text-2xs text-navy-500 truncate">{expense.description}</p>
          )}
        </div>
      ),
      exportValue: (expense) => expense.category,
    },
    {
      accessor: 'paidTo',
      header: 'Paid to',
      hideOnMobile: true,
      render: (expense) => (
        <span className="text-sm text-navy-700 truncate">{expense.paidTo || '—'}</span>
      ),
      exportValue: (expense) => expense.paidTo,
    },
    {
      accessor: 'paymentMethod',
      header: 'Method',
      hideOnMobile: true,
      render: (expense) => (
        <Badge variant="neutral" size="sm">{paymentMethodLabel(expense.paymentMethod)}</Badge>
      ),
      exportValue: (expense) => expense.paymentMethod,
    },
    {
      accessor: 'ownership',
      header: 'Borne by',
      hideOnMobile: true,
      render: (expense) => (
        <span className="text-sm text-navy-600 capitalize">
          {expense.ownership === 'owner'
            ? 'Owner'
            : expense.partner?.name || expense.ownership}
        </span>
      ),
      exportValue: (expense) => expense.ownership,
    },
    {
      accessor: 'amount',
      header: 'Amount',
      align: 'right',
      sortable: true,
      render: (expense) => <MoneyCell value={expense.amount} className="text-danger-600" />,
      exportValue: (expense) => expense.amount,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (expense) => (
        <RowActions
          record={expense}
          onEdit={onEdit}
          onDelete={onDelete}
          onView={onView}
          canManage={canManage}
        />
      ),
    },
  ],

  renderDetail: (expense) => (
    <div className="space-y-4">
      <div className="rounded-lg bg-danger-50 border border-danger-200 px-4 py-3 text-center">
        <p className="text-2xs font-semibold uppercase tracking-wider text-danger-700">Amount</p>
        <p className="text-2xl font-display font-bold text-danger-800 tabular mt-0.5">
          {formatCurrency(expense.amount)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FieldDisplay label="Category" value={expense.category} />
        <FieldDisplay label="Date" value={formatDate(expense.expenseDate)} />
        <FieldDisplay label="Paid to" value={expense.paidTo} />
        <FieldDisplay label="Method" value={expense.paymentMethod} />
        <FieldDisplay label="Reference" value={expense.referenceNumber} />
        <FieldDisplay
          label="Borne by"
          value={expense.ownership === 'owner' ? 'Owner' : expense.partner?.name || expense.ownership}
        />
      </div>

      {expense.description && <FieldDisplay label="Description" value={expense.description} />}
      {expense.notes && <FieldDisplay label="Notes" value={expense.notes} />}

      {expense.receiptImage && (
        <div>
          <p className="label">Attached bill</p>
          <a
            href={resolveFileUrl(expense.receiptImage)}
            target="_blank"
            rel="noreferrer"
            className="block rounded-lg border border-navy-200 overflow-hidden hover:border-gold-400 transition-colors"
          >
            {/\.pdf$/i.test(expense.receiptImage) ? (
              <span className="flex items-center gap-2 p-3 text-sm text-navy-700">
                <Paperclip size={15} /> Open the attached PDF
              </span>
            ) : (
              <img
                src={resolveFileUrl(expense.receiptImage)}
                alt="Receipt"
                className="w-full max-h-64 object-contain bg-navy-50"
              />
            )}
          </a>
        </div>
      )}
    </div>
  ),

  renderFilters: (table) => (
    <FormRow cols={3}>
      <Select
        label="Category"
        value={table.filters.category || ''}
        onChange={(e) => table.setFilter('category', e.target.value)}
        placeholder="All categories"
        options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
      />
      <Input
        label="From"
        type="date"
        value={table.filters.startDate || ''}
        onChange={(e) => table.setFilter('startDate', e.target.value)}
      />
      <Input
        label="To"
        type="date"
        value={table.filters.endDate || ''}
        onChange={(e) => table.setFilter('endDate', e.target.value)}
      />
    </FormRow>
  ),
});
