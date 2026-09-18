/**
 * ============================================
 * Suppliers
 * ============================================
 * Who the shop buys from, and what it still owes them.
 *
 * The payable balance is the column that matters: it is maintained by the
 * purchase flow, so it is shown here and never edited by hand.
 */

import { Truck, Phone, Building2, AlertCircle } from 'lucide-react';

import { createListPage, RowActions } from '../../components/common/createListPage.jsx';
import {
  Input, Textarea, Select, CurrencyInput, PhoneInput, FormRow, FormSection, FieldDisplay,
} from '../../components/common/Form.jsx';
import Badge from '../../components/common/Badge.jsx';
import StatCard, { StatGrid } from '../../components/common/StatCard.jsx';
import { MoneyCell } from '../../components/common/DataTable.jsx';
import { supplierService } from '../../services/entities.js';
import { formatCurrency, getTelURL, getWhatsAppURL, sumBy } from '../../utils/index.js';

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
            // Editing it later would silently rewrite history that purchases
            // have already built on, so it is set once at creation.
            disabled={Boolean(editing)}
            hint={
              editing
                ? 'Set when the supplier was added. Record a purchase to change the balance.'
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

  renderSummary: (summary, { records }) => (
    <StatGrid columns={3}>
      <StatCard
        label="Suppliers"
        value={records.length}
        icon={Truck}
        variant="navy"
        isCurrency={false}
      />
      <StatCard
        label="Total purchases"
        value={sumBy(records, 'totalPurchases')}
        icon={Building2}
        variant="blue"
        compact
      />
      <StatCard
        label="Still owed"
        value={sumBy(records, 'payable')}
        icon={AlertCircle}
        variant="red"
        compact
        subtitle={`${records.filter((s) => s.payable > 0).length} with a balance`}
      />
    </StatGrid>
  ),

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

  renderDetail: (supplier) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <FieldDisplay label="Contact person" value={supplier.contactPerson} />
        <FieldDisplay label="Phone" value={supplier.phone} icon={Phone} />
        <FieldDisplay label="Alternate" value={supplier.alternatePhone} />
        <FieldDisplay label="Email" value={supplier.email} />
      </div>

      <FieldDisplay label="Address" value={supplier.address} />

      <div className="grid grid-cols-3 gap-2 rounded-lg bg-navy-50 border border-navy-100 p-3 text-center">
        {[
          { label: 'Purchased', value: supplier.totalPurchases },
          { label: 'Paid', value: supplier.totalPaid },
          { label: 'Owed', value: supplier.payable, tone: 'text-danger-600' },
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
