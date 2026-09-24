/**
 * ============================================
 * Suppliers
 * ============================================
 * Who the shop buys from, and what it still owes them.
 *
 * The payable balance is the column that matters: it is maintained by the
 * purchase flow, so it is shown here and never edited by hand.
 */

import { useState, useEffect } from 'react';
import { Truck, Phone, Building2, AlertCircle, HandCoins, Trash2, ShoppingBag, Wallet } from 'lucide-react';

import { createListPage, RowActions } from '../../components/common/createListPage.jsx';
import {
  Input, Textarea, Select, CurrencyInput, PhoneInput, FormRow, FormSection, FieldDisplay,
} from '../../components/common/Form.jsx';
import Badge from '../../components/common/Badge.jsx';
import StatCard, { StatGrid } from '../../components/common/StatCard.jsx';
import { MoneyCell } from '../../components/common/DataTable.jsx';
import Button from '../../components/common/Button.jsx';
import { supplierService } from '../../services/entities.js';
import { useToastStore } from '../../context/toastStore.js';
import { useAuthStore } from '../../context/authStore.js';
import { PAYMENT_METHODS, paymentMethodLabel } from '../../constants/index.js';
import { formatCurrency, formatDate, getTelURL, getWhatsAppURL, parseNumber, cn } from '../../utils/index.js';

/**
 * The supplier's account inside the detail view: pay what is owed, see every
 * payment and purchase, and undo a payment entered by mistake. A payment is
 * applied to the oldest unpaid purchase first, by the server.
 */
function SupplierAccount({ supplier, update }) {
  const toast = useToastStore();
  const { user } = useAuthStore();
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ amount: '', paymentMethod: 'cash', paymentDate: '', referenceNumber: '' });
  const [paying, setPaying] = useState(false);

  const load = () =>
    supplierService.get(supplier._id).then((res) => setDetail(res.data)).catch(() => setDetail({ payments: [], recentPurchases: [] }));

  useEffect(() => { load(); }, [supplier._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const owed = parseNumber(supplier.payable);

  const pay = async (event) => {
    event?.preventDefault();
    const amount = parseNumber(form.amount);
    if (amount <= 0) return toast.warning('Enter the amount you paid.');
    if (amount > owed) return toast.warning(`Only ${formatCurrency(owed)} is owed.`);
    setPaying(true);
    try {
      const response = await supplierService.pay(supplier._id, { ...form, amount });
      update(response.data.supplier);
      toast.success(response.message || 'Payment recorded.');
      setForm({ amount: '', paymentMethod: form.paymentMethod, paymentDate: '', referenceNumber: '' });
      load();
    } catch (error) {
      toast.apiError(error, 'Could not record the payment.');
    } finally {
      setPaying(false);
    }
  };

  const undo = async (payment) => {
    if (!window.confirm(`Delete this payment of ${formatCurrency(payment.amount)}? The amount goes back on the account.`)) return;
    try {
      const response = await supplierService.deletePayment(supplier._id, payment._id);
      if (response.data?.supplier) update(response.data.supplier);
      toast.success(response.message || 'Payment deleted.');
      load();
    } catch (error) {
      toast.apiError(error);
    }
  };

  return (
    <div className="space-y-4">
      {owed > 0 && (
        <form onSubmit={pay} className="rounded-xl border-2 border-gold-300 bg-gold-50/70 p-3.5 space-y-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-navy-900">
            <HandCoins size={16} className="text-gold-700" />
            Pay {supplier.name}
            <span className="ms-auto text-xs font-medium text-danger-600">Owed {formatCurrency(owed)}</span>
          </p>
          <FormRow cols={2}>
            <CurrencyInput
              label="Amount paid"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              hint={
                <button type="button" className="text-gold-700 font-semibold" onClick={() => setForm({ ...form, amount: String(owed) })}>
                  Pay the full {formatCurrency(owed)}
                </button>
              }
            />
            <Select
              label="Paid by"
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
              options={PAYMENT_METHODS}
            />
          </FormRow>
          <FormRow cols={2}>
            <Input label="Date" type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} hint="Leave empty for today" />
            <Input label="Reference" value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} placeholder="Cheque / transaction no." />
          </FormRow>
          <Button type="submit" variant="gold" icon={HandCoins} isLoading={paying} loadingText="Recording…" className="w-full">
            Record payment
          </Button>
        </form>
      )}

      <div>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-navy-500 mb-2">
          <Wallet size={13} /> Payments
        </p>
        {!detail ? (
          <div className="skeleton h-10 w-full" />
        ) : detail.payments?.length ? (
          <ul className="divide-y divide-navy-100 rounded-lg border border-navy-100">
            {detail.payments.map((p) => (
              <li key={p._id} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-navy-900 tabular">{formatCurrency(p.amount)}</span>
                  <span className="block text-2xs text-navy-500">
                    {formatDate(p.paymentDate)} · {paymentMethodLabel(p.paymentMethod)}
                    {p.referenceNumber && ` · ${p.referenceNumber}`}
                    {p.allocations?.length ? ` · ${p.allocations.map((a) => a.invoiceNumber).join(', ')}` : ''}
                  </span>
                </span>
                {['admin', 'manager'].includes(user?.role) && (
                  <button
                    type="button"
                    onClick={() => undo(p)}
                    aria-label="Delete this payment"
                    className="p-1.5 rounded-md text-danger-500 hover:bg-danger-50 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-navy-500">No payments recorded yet.</p>
        )}
      </div>

      <div>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-navy-500 mb-2">
          <ShoppingBag size={13} /> Purchases
        </p>
        {!detail ? (
          <div className="skeleton h-10 w-full" />
        ) : detail.recentPurchases?.length ? (
          <ul className="divide-y divide-navy-100 rounded-lg border border-navy-100">
            {detail.recentPurchases.map((p) => (
              <li key={p._id} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-navy-900">{p.invoiceNumber}</span>
                  <span className="block text-2xs text-navy-500">{formatDate(p.purchaseDate)} · {formatCurrency(p.subtotal)}</span>
                </span>
                <Badge
                  variant={p.status === 'completed' ? 'success' : p.status === 'cancelled' ? 'neutral' : 'warning'}
                  size="sm"
                >
                  {p.status === 'completed' ? 'Paid' : p.status === 'cancelled' ? 'Cancelled' : `${formatCurrency(p.payable)} due`}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-navy-500">No purchases from this supplier yet.</p>
        )}
      </div>
    </div>
  );
}

export default createListPage({
  guideId: 'suppliers',
  entityName: 'Supplier',
  entityNamePlural: 'Suppliers',
  collectionKey: 'suppliers',
  icon: Truck,
  service: supplierService,
  permission: 'suppliers',
  searchPlaceholder: 'Search by name, phone or contact person…',

  getInitialForm: () => ({
    name: '',
    phone: '',
    alternatePhone: '',
    contactPerson: '',
    email: '',
    address: '',
    openingBalance: 0,
    status: 'active',
    notes: '',
  }),

  renderForm: (form, setForm, { editing }) => (
    <>
      <FormSection title="Supplier details" icon={Building2}>
        <FormRow cols={2}>
          <Input
            label="Business name"
            required
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Al-Madina Electronics"
          />
          <Input
            label="Contact person"
            value={form.contactPerson}
            onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
            placeholder="Who you deal with"
          />
        </FormRow>

        <FormRow cols={2}>
          <PhoneInput
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <PhoneInput
            label="Alternate phone"
            value={form.alternatePhone}
            onChange={(e) => setForm({ ...form, alternatePhone: e.target.value })}
          />
        </FormRow>

        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="Optional"
        />

        <Textarea
          label="Address"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          rows={2}
        />
      </FormSection>

      <FormSection title="Account" icon={AlertCircle}>
        <FormRow cols={2}>
          <CurrencyInput
            label="Opening balance"
            value={form.openingBalance}
            onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
            hint={
              editing
                ? 'Correcting it moves the amount owed by the same difference.'
                : 'Anything already owed to this supplier before using the system'
            }
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
        </FormRow>

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

  // Figures across every supplier, from the server.
  renderSummary: (summary) => (
    <StatGrid columns={3}>
      <StatCard label="Suppliers" value={summary.suppliers} icon={Truck} variant="navy" isCurrency={false} />
      <StatCard label="Total purchases" value={summary.purchases} icon={Building2} variant="blue" />
      <StatCard
        label="Owed to suppliers"
        value={summary.payable}
        icon={AlertCircle}
        variant="red"
        subtitle={`${summary.owedTo || 0} with a balance`}
      />
    </StatGrid>
  ),

  describeDelete: (supplier) =>
    `"${supplier.name}" will be deleted permanently. If there are purchases or payments, you will be told how many and they will be kept under the supplier's name.`,

  columns: ({ onEdit, onDelete, onView, canManage }) => [
    {
      accessor: 'name',
      header: 'Supplier',
      sortable: true,
      primary: true,
      render: (supplier) => (
        <div className="min-w-0">
          <p className="font-medium text-navy-950 truncate">{supplier.name}</p>
          {supplier.contactPerson && (
            <p className="text-2xs text-navy-500 truncate">{supplier.contactPerson}</p>
          )}
        </div>
      ),
      exportValue: (supplier) => supplier.name,
    },
    {
      accessor: 'phone',
      header: 'Phone',
      secondary: true,
      render: (supplier) =>
        supplier.phone ? (
          <a
            href={getTelURL(supplier.phone)}
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-info-600 hover:underline tabular"
          >
            {supplier.phone}
          </a>
        ) : (
          <span className="text-navy-300">—</span>
        ),
      exportValue: (supplier) => supplier.phone,
    },
    {
      accessor: 'totalPurchases',
      header: 'Purchased',
      align: 'right',
      sortable: true,
      hideOnMobile: true,
      render: (supplier) => <MoneyCell value={supplier.totalPurchases} />,
      exportValue: (supplier) => supplier.totalPurchases,
    },
    {
      accessor: 'totalPaid',
      header: 'Paid',
      align: 'right',
      sortable: true,
      hideOnMobile: true,
      render: (supplier) => <MoneyCell value={supplier.totalPaid} />,
      exportValue: (supplier) => supplier.totalPaid,
    },
    {
      accessor: 'payable',
      header: 'Owed',
      align: 'right',
      sortable: true,
      render: (supplier) =>
        supplier.payable > 0 ? (
          <MoneyCell value={supplier.payable} className="text-danger-600" />
        ) : (
          <span className="text-2xs font-medium text-success-700">Settled</span>
        ),
      exportValue: (supplier) => supplier.payable,
    },
    {
      accessor: 'status',
      header: 'Status',
      hideOnMobile: true,
      render: (supplier) => (
        <Badge variant={supplier.status === 'active' ? 'success' : 'neutral'} size="sm">
          {supplier.status}
        </Badge>
      ),
      exportValue: (supplier) => supplier.status,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (supplier) => (
        <RowActions
          record={supplier}
          onEdit={onEdit}
          onDelete={onDelete}
          onView={onView}
          canManage={canManage}
        />
      ),
    },
  ],

  renderDetail: (supplier, extras, { update }) => (
    <div className="space-y-4 soft-in">
      <div className="grid grid-cols-2 gap-3">
        <FieldDisplay label="Contact person" value={supplier.contactPerson} />
        <FieldDisplay label="Phone" value={supplier.phone} icon={Phone} />
        <FieldDisplay label="Alternate" value={supplier.alternatePhone} />
        <FieldDisplay label="Email" value={supplier.email} />
      </div>

      <FieldDisplay label="Address" value={supplier.address} />

      <div className={cn('grid grid-cols-3 gap-2 rounded-xl bg-navy-50 border border-navy-100 p-3 text-center')}>
        {[
          { label: 'Purchased', value: supplier.totalPurchases },
          { label: 'Paid', value: supplier.totalPaid },
          { label: 'Owed', value: supplier.payable, tone: supplier.payable > 0 ? 'text-danger-600' : 'text-success-700' },
        ].map((item) => (
          <div key={item.label}>
            <p className="text-2xs text-navy-500">{item.label}</p>
            <p className={`text-sm font-semibold tabular mt-0.5 ${item.tone || 'text-navy-950'}`}>
              {formatCurrency(item.value)}
            </p>
          </div>
        ))}
      </div>

      {supplier.notes && <FieldDisplay label="Notes" value={supplier.notes} />}

      <SupplierAccount supplier={supplier} update={update} />

      {supplier.phone && (
        <div className="flex gap-2">
          <a href={getTelURL(supplier.phone)} className="btn-secondary btn flex-1 justify-center">
            <Phone size={15} /> Call
          </a>
          <a
            href={getWhatsAppURL(supplier.phone, `Assalam-o-Alaikum ${supplier.name}`)}
            target="_blank"
            rel="noreferrer"
            className="btn-whatsapp btn flex-1 justify-center"
          >
            WhatsApp
          </a>
        </div>
      )}
    </div>
  ),

  renderFilters: (table) => (
    <FormRow cols={2}>
      <Select
        label="Status"
        value={table.filters.status || ''}
        onChange={(e) => table.setFilter('status', e.target.value)}
        placeholder="All statuses"
        options={[
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ]}
      />
    </FormRow>
  ),

  initialFilters: { status: '' },
});
