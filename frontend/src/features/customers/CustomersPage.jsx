/**
 * ============================================
 * Customers
 * ============================================
 * The customer file: identity, guarantor, documents and account position.
 *
 * Written directly rather than through the list-page factory because a customer
 * record carries real weight here - CNIC scans, a guarantor, a running ledger
 * and reminder actions - and squeezing that through a generic form would cost
 * more than it saved.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Eye, Pencil, Trash2, Phone, MessageCircle, FileText, Wallet,
  UserCheck, IdCard, CalendarClock, AlertTriangle, TrendingUp, ShieldAlert,
} from 'lucide-react';

import PageHeader from '../../components/common/PageHeader.jsx';
import TabGuide from '../../components/common/TabGuide.jsx';
import StatCard, { StatGrid } from '../../components/common/StatCard.jsx';
import Badge from '../../components/common/Badge.jsx';
import Button, { IconButton } from '../../components/common/Button.jsx';
import DataTable, { MoneyCell } from '../../components/common/DataTable.jsx';
import Modal, { ModalFooter } from '../../components/common/Modal.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import Tabs from '../../components/common/Tabs.jsx';
import {
  Input, Textarea, Select, CNICInput, PhoneInput,
  FormRow, FormSection, FieldDisplay,
} from '../../components/common/Form.jsx';
import FileUpload, { AvatarUpload } from '../../components/common/FileUpload.jsx';
import { ListSkeleton } from '../../components/common/Skeleton.jsx';

import { customerService, reminderService } from '../../services/entities.js';
import { useAuthStore } from '../../context/authStore.js';
import { useToastStore } from '../../context/toastStore.js';
import { useTableState } from '../../hooks/index.js';
import {
  cn, formatCurrency, formatDate, getTelURL, getWhatsAppURL,
  getInitials, resolveFileUrl, sumBy,
} from '../../utils/index.js';
import { CUSTOMER_STATUSES } from '../../constants/index.js';

const emptyCustomer = () => ({
  name: '',
  cnic: '',
  mobile1: '',
  mobile2: '',
  address: '',
  reference: '',
  guarantorName: '',
  guarantorPhone: '',
  guarantorCnic: '',
  guarantorAddress: '',
  guarantorRelation: '',
  photo: null,
  cnicFrontPhoto: null,
  cnicBackPhoto: null,
  status: 'active',
  notes: '',
});

export default function CustomersPage() {
  const toast = useToastStore();
  const { hasPermission } = useAuthStore();

  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyCustomer());
  const [saving, setSaving] = useState(false);

  const [viewing, setViewing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const table = useTableState({ initialSort: 'createdAt', initialFilters: { status: '' } });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await customerService.list(table.params);
      setCustomers(response.data.customers || []);
      setPagination(response.data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      toast.apiError(error, 'Could not load customers.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.params]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyCustomer());
    setFormOpen(true);
  };

  const openEdit = (customer) => {
    setEditing(customer);
    const blank = emptyCustomer();
    setForm(
      Object.keys(blank).reduce((acc, key) => {
        acc[key] = customer[key] ?? blank[key];
        return acc;
      }, {})
    );
    setFormOpen(true);
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();

    if (!form.name.trim() || !form.mobile1.trim()) {
      toast.warning('A name and a mobile number are required.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await customerService.update(editing._id, form);
        toast.success('Customer updated.');
      } else {
        await customerService.create(form);
        toast.success('Customer added.');
      }
      setFormOpen(false);
      load();
    } catch (error) {
      toast.apiError(error, 'Could not save this customer.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      const response = await customerService.delete(deleteTarget._id);

      // A customer with sales on record is deactivated rather than removed;
      // the API says which in its message, shown as-is. Either way the row
      // leaves the current view, so the list is patched instead of reloaded.
      setCustomers((prev) => prev.filter((c) => c._id !== deleteTarget._id));
      setPagination((p) => ({ ...p, total: Math.max(0, p.total - 1) }));

      toast.success(response?.message || 'Customer removed.');
      setDeleteTarget(null);
    } catch (error) {
      toast.apiError(error);
    }
  };

  const handleRemind = async (customer) => {
    try {
      const response = await reminderService.forCustomer(customer._id);
      const reminder = response.data.reminder;

      if (!reminder) {
        toast.info(`${customer.name} has nothing overdue.`);
        return;
      }

      window.open(reminder.whatsappUrl, '_blank', 'noopener');
      await reminderService.log([reminder], 'whatsapp').catch(() => {});
      toast.success('Reminder opened in WhatsApp.');
    } catch (error) {
      toast.apiError(error, 'Could not prepare a reminder.');
    }
  };

  const columns = [
    {
      accessor: 'name',
      header: 'Customer',
      sortable: true,
      primary: true,
      render: (customer) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-navy-100 text-navy-600 text-2xs font-bold flex-shrink-0 overflow-hidden">
            {customer.photo ? (
              <img src={resolveFileUrl(customer.photo)} alt="" className="w-full h-full object-cover" />
            ) : (
              getInitials(customer.name)
            )}
          </span>

          <div className="min-w-0">
            <p className="font-medium text-navy-950 truncate">{customer.name}</p>
            <p className="text-2xs text-navy-500 tabular">{customer.cnic || 'No CNIC on file'}</p>
          </div>
        </div>
      ),
      exportValue: (customer) => customer.name,
    },
    {
      accessor: 'mobile1',
      header: 'Mobile',
      secondary: true,
      render: (customer) => (
        <a
          href={getTelURL(customer.mobile1)}
          onClick={(e) => e.stopPropagation()}
          className="text-sm text-info-600 hover:underline tabular"
        >
          {customer.mobile1}
        </a>
      ),
      exportValue: (customer) => customer.mobile1,
    },
    {
      accessor: 'totalSales',
      header: 'Business',
      align: 'right',
      sortable: true,
      hideOnMobile: true,
      render: (customer) => <MoneyCell value={customer.totalSales} />,
      exportValue: (customer) => customer.totalSales,
    },
    {
      accessor: 'outstanding',
      header: 'Outstanding',
      align: 'right',
      sortable: true,
      render: (customer) =>
        customer.outstanding > 0 ? (
          <div className="text-right">
            <MoneyCell value={customer.outstanding} className="text-danger-600" />
            {customer.overdue > 0 && (
              <p className="text-2xs text-danger-600 font-medium">
                {formatCurrency(customer.overdue)} overdue
              </p>
            )}
          </div>
        ) : (
          <span className="text-2xs font-medium text-success-700">Clear</span>
        ),
      exportValue: (customer) => customer.outstanding,
    },
    {
      accessor: 'nextDueDate',
      header: 'Next due',
      hideOnMobile: true,
      sortable: true,
      render: (customer) =>
        customer.nextDueDate ? (
          <span className="text-sm text-navy-700 tabular">{formatDate(customer.nextDueDate)}</span>
        ) : (
          <span className="text-navy-300">—</span>
        ),
      exportValue: (customer) => formatDate(customer.nextDueDate),
    },
    {
      accessor: 'status',
      header: 'Status',
      hideOnMobile: true,
      render: (customer) => (
        <Badge variant={CUSTOMER_STATUSES[customer.status]?.color || 'neutral'} size="sm">
          {CUSTOMER_STATUSES[customer.status]?.label || customer.status}
        </Badge>
      ),
      exportValue: (customer) => customer.status,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (customer) => (
        <div className="flex items-center justify-end gap-0.5">
          {customer.overdue > 0 && (
            <IconButton
              icon={MessageCircle}
              label="Send an overdue reminder"
              size="icon-sm"
              className="text-[#25D366] hover:bg-[#25D366]/10"
              onClick={(e) => { e.stopPropagation(); handleRemind(customer); }}
            />
          )}
          <IconButton
            icon={Eye}
            label="View this customer"
            size="icon-sm"
            onClick={(e) => { e.stopPropagation(); setViewing(customer); }}
          />
          {hasPermission('customers') && (
            <>
              <IconButton
                icon={Pencil}
                label="Edit"
                size="icon-sm"
                onClick={(e) => { e.stopPropagation(); openEdit(customer); }}
              />
              <IconButton
                icon={Trash2}
                label="Delete this customer"
                size="icon-sm"
                className="text-danger-500 hover:bg-danger-50"
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(customer); }}
              />
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <TabGuide id="customers" />

      <PageHeader
        title="Customers"
        subtitle={`${pagination.total.toLocaleString('en-PK')} customer${pagination.total === 1 ? '' : 's'} on file`}
        icon={Users}
        actions={
          hasPermission('customers') && (
            <Button variant="gold" icon={Plus} onClick={openCreate}>
              Add customer
            </Button>
          )
        }
      />

      <StatGrid columns={4}>
        <StatCard
          label="Customers"
          value={pagination.total}
          icon={Users}
          variant="navy"
          isCurrency={false}
        />
        <StatCard
          label="Business (this page)"
          value={sumBy(customers, 'totalSales')}
          icon={TrendingUp}
          variant="blue"
          compact
        />
        <StatCard
          label="Outstanding"
          value={sumBy(customers, 'outstanding')}
          icon={Wallet}
          variant="amber"
          compact
        />
        <StatCard
          label="Overdue"
          value={sumBy(customers, 'overdue')}
          icon={AlertTriangle}
          variant="red"
          compact
          subtitle={`${customers.filter((c) => c.overdue > 0).length} behind`}
        />
      </StatGrid>

      <DataTable
        columns={columns}
        data={customers}
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
        searchPlaceholder="Search by name, mobile or CNIC…"
        onRowClick={setViewing}
        exportFilename="customers"
        printable
        title="Customers"
        activeFilterCount={table.filters.status ? 1 : 0}
        onClearFilters={table.resetFilters}
        filters={
          <FormRow cols={2}>
            <Select
              label="Status"
              value={table.filters.status}
              onChange={(e) => table.setFilter('status', e.target.value)}
              placeholder="All statuses"
              options={Object.entries(CUSTOMER_STATUSES).map(([value, meta]) => ({
                value,
                label: meta.label,
              }))}
            />
          </FormRow>
        }
        emptyState={
          <EmptyState
            icon={Users}
            title={table.hasActiveFilters ? 'No matching customers' : 'No customers yet'}
            message={
              table.hasActiveFilters
                ? 'Try clearing your search or filters.'
                : 'Add your first customer to start recording sales.'
            }
            action={
              hasPermission('customers') && !table.hasActiveFilters ? (
                <Button variant="gold" icon={Plus} onClick={openCreate}>Add customer</Button>
              ) : null
            }
          />
        }
      />

      {/* ---- Create / edit ---- */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit customer' : 'Add customer'}
        subtitle={editing?.name}
        icon={Users}
        size="lg"
        footer={
          <ModalFooter>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="gold" onClick={handleSubmit} isLoading={saving} loadingText="Saving…">
              {editing ? 'Save changes' : 'Add customer'}
            </Button>
          </ModalFooter>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <FormSection title="Identity" icon={IdCard}>
            <AvatarUpload
              label="Customer photo"
              value={form.photo}
              onChange={(url) => setForm({ ...form, photo: url })}
              folder="customers"
            />

            <FormRow cols={2}>
              <Input
                label="Full name"
                required
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="As written on the CNIC"
              />
              <CNICInput
                label="CNIC"
                value={form.cnic}
                onChange={(e) => setForm({ ...form, cnic: e.target.value })}
              />
            </FormRow>

            <FormRow cols={2}>
              <PhoneInput
                label="Mobile"
                required
                value={form.mobile1}
                onChange={(e) => setForm({ ...form, mobile1: e.target.value })}
                hint="Used for payment reminders over WhatsApp"
              />
              <PhoneInput
                label="Alternate mobile"
                value={form.mobile2}
                onChange={(e) => setForm({ ...form, mobile2: e.target.value })}
              />
            </FormRow>

            <Textarea
              label="Address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              rows={2}
            />

            <Input
              label="Introduced by"
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="Who referred this customer (optional)"
            />
          </FormSection>

          <FormSection
            title="CNIC scans"
            icon={FileText}
            description="Required before an installment sale can be agreed"
          >
            <FormRow cols={2}>
              <FileUpload
                label="CNIC — front"
                value={form.cnicFrontPhoto}
                onChange={(url) => setForm({ ...form, cnicFrontPhoto: url })}
                allowPdf
                folder="customers"
                aspect="wide"
                compact
              />
              <FileUpload
                label="CNIC — back"
                value={form.cnicBackPhoto}
                onChange={(url) => setForm({ ...form, cnicBackPhoto: url })}
                allowPdf
                folder="customers"
                aspect="wide"
                compact
              />
            </FormRow>
          </FormSection>

          <FormSection
            title="Guarantor"
            icon={UserCheck}
            description="Stands behind the customer if an installment goes unpaid"
          >
            <FormRow cols={2}>
              <Input
                label="Guarantor name"
                value={form.guarantorName}
                onChange={(e) => setForm({ ...form, guarantorName: e.target.value })}
              />
              <Input
                label="Relationship"
                value={form.guarantorRelation}
                onChange={(e) => setForm({ ...form, guarantorRelation: e.target.value })}
                placeholder="Brother, neighbour, employer…"
              />
            </FormRow>

            <FormRow cols={2}>
              <CNICInput
                label="Guarantor CNIC"
                value={form.guarantorCnic}
                onChange={(e) => setForm({ ...form, guarantorCnic: e.target.value })}
              />
              <PhoneInput
                label="Guarantor phone"
                value={form.guarantorPhone}
                onChange={(e) => setForm({ ...form, guarantorPhone: e.target.value })}
              />
            </FormRow>

            <Textarea
              label="Guarantor address"
              value={form.guarantorAddress}
              onChange={(e) => setForm({ ...form, guarantorAddress: e.target.value })}
              rows={2}
            />
          </FormSection>

          <FormSection title="Account" icon={ShieldAlert}>
            <FormRow cols={2}>
              <Select
                label="Status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                  { value: 'blacklisted', label: 'Blacklisted — cannot be sold to' },
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

          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      </Modal>

      <CustomerDetailModal
        customer={viewing}
        onClose={() => setViewing(null)}
        onEdit={(customer) => { setViewing(null); openEdit(customer); }}
        onRemind={handleRemind}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove this customer?"
        message={`"${deleteTarget?.name}" will be removed. If they have sales on record, they will be deactivated instead so the history stays intact.`}
        confirmText="Remove"
      />
    </div>
  );
}

/* ============================================================================
 * Detail
 * ========================================================================== */

/** Profile, account position and the running ledger, in one dialog. */
function CustomerDetailModal({ customer, onClose, onEdit, onRemind }) {
  const toast = useToastStore();
  const [tab, setTab] = useState('profile');
  const [ledger, setLedger] = useState(null);
  const [loadingLedger, setLoadingLedger] = useState(false);

  useEffect(() => {
    if (!customer) { setTab('profile'); setLedger(null); return; }
    if (tab !== 'ledger' || ledger) return;

    setLoadingLedger(true);
    customerService
      .getLedger(customer._id, { limit: 50 })
      .then((response) => setLedger(response.data))
      .catch((error) => toast.apiError(error, 'Could not load the ledger.'))
      .finally(() => setLoadingLedger(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, tab]);

  if (!customer) return null;

  return (
    <Modal
      isOpen={Boolean(customer)}
      onClose={onClose}
      title={customer.name}
      subtitle={customer.mobile1}
      icon={Users}
      size="lg"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {customer.overdue > 0 && (
            <Button variant="whatsapp" icon={MessageCircle} onClick={() => onRemind(customer)}>
              Send reminder
            </Button>
          )}
          <Button variant="gold" icon={Pencil} onClick={() => onEdit(customer)}>Edit</Button>
        </ModalFooter>
      }
    >
      {/* Account position */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {[
          { label: 'Total business', value: customer.totalSales, tone: 'text-navy-950' },
          { label: 'Paid', value: customer.totalPaid, tone: 'text-success-700' },
          { label: 'Outstanding', value: customer.outstanding, tone: 'text-warning-600' },
          { label: 'Overdue', value: customer.overdue, tone: 'text-danger-600' },
        ].map((item) => (
          <div key={item.label} className="rounded-lg bg-navy-50 border border-navy-100 p-2.5 text-center">
            <p className="text-2xs text-navy-500 leading-tight">{item.label}</p>
            <p className={cn('text-sm font-semibold tabular mt-0.5', item.tone)}>
              {formatCurrency(item.value)}
            </p>
          </div>
        ))}
      </div>

      <Tabs
        tabs={[
          { id: 'profile', label: 'Profile', icon: IdCard },
          { id: 'guarantor', label: 'Guarantor', icon: UserCheck },
          { id: 'ledger', label: 'Ledger', icon: FileText },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-4"
      />

      {tab === 'profile' && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 gap-3">
            <FieldDisplay label="CNIC" value={customer.cnic} mono />
            <FieldDisplay label="Mobile" value={customer.mobile1} mono />
            <FieldDisplay label="Alternate" value={customer.mobile2} mono />
            <FieldDisplay label="Introduced by" value={customer.reference} />
            <FieldDisplay label="Next due" value={formatDate(customer.nextDueDate)} />
            <FieldDisplay label="Status" value={CUSTOMER_STATUSES[customer.status]?.label} />
          </div>

          <FieldDisplay label="Address" value={customer.address} />
          {customer.notes && <FieldDisplay label="Notes" value={customer.notes} />}

          {/* CNIC scans */}
          {(customer.cnicFrontPhoto || customer.cnicBackPhoto) && (
            <div>
              <p className="label">CNIC scans</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { url: customer.cnicFrontPhoto, label: 'Front' },
                  { url: customer.cnicBackPhoto, label: 'Back' },
                ]
                  .filter((item) => item.url)
                  .map((item) => (
                    <a
                      key={item.label}
                      href={resolveFileUrl(item.url)}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-lg border border-navy-200 overflow-hidden hover:border-gold-400 transition-colors"
                    >
                      <img
                        src={resolveFileUrl(item.url)}
                        alt={`CNIC ${item.label}`}
                        className="w-full aspect-[16/10] object-cover bg-navy-50"
                      />
                      <span className="block px-2 py-1 text-2xs text-navy-600">{item.label}</span>
                    </a>
                  ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <a href={getTelURL(customer.mobile1)} className="btn-secondary btn flex-1 justify-center">
              <Phone size={15} /> Call
            </a>
            <a
              href={getWhatsAppURL(customer.mobile1, `Assalam-o-Alaikum ${customer.name}`)}
              target="_blank"
              rel="noreferrer"
              className="btn-whatsapp btn flex-1 justify-center"
            >
              <MessageCircle size={15} /> WhatsApp
            </a>
          </div>
        </div>
      )}

      {tab === 'guarantor' && (
        <div className="animate-fade-in">
          {customer.guarantorName ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FieldDisplay label="Name" value={customer.guarantorName} />
                <FieldDisplay label="Relationship" value={customer.guarantorRelation} />
                <FieldDisplay label="CNIC" value={customer.guarantorCnic} mono />
                <FieldDisplay label="Phone" value={customer.guarantorPhone} mono />
              </div>
              <FieldDisplay label="Address" value={customer.guarantorAddress} />

              {customer.guarantorPhone && (
                <a
                  href={getTelURL(customer.guarantorPhone)}
                  className="btn-secondary btn w-full justify-center"
                >
                  <Phone size={15} /> Call the guarantor
                </a>
              )}
            </div>
          ) : (
            <EmptyState
              icon={UserCheck}
              title="No guarantor recorded"
              message="Installment sales normally require one. Add the details from the edit form."
              size="sm"
              action={
                <Button variant="secondary" size="sm" icon={Pencil} onClick={() => onEdit(customer)}>
                  Add a guarantor
                </Button>
              }
            />
          )}
        </div>
      )}

      {tab === 'ledger' && (
        <div className="animate-fade-in">
          {loadingLedger ? (
            <ListSkeleton items={5} />
          ) : !ledger?.entries?.length ? (
            <EmptyState
              icon={FileText}
              title="No transactions yet"
              message="Sales and payments will appear here as they are recorded."
              size="sm"
            />
          ) : (
            <ul className="divide-y divide-navy-100 rounded-lg border border-navy-200 overflow-hidden max-h-80 overflow-y-auto scrollbar-thin">
              {ledger.entries.map((entry) => (
                <li key={entry._id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-navy-900 truncate">{entry.description}</p>
                    <p className="text-2xs text-navy-500 tabular">
                      {entry.reference} · {formatDate(entry.entryDate)}
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    {entry.debit > 0 && (
                      <p className="text-sm font-medium text-navy-950 tabular">
                        +{formatCurrency(entry.debit)}
                      </p>
                    )}
                    {entry.credit > 0 && (
                      <p className="text-sm font-medium text-success-700 tabular">
                        -{formatCurrency(entry.credit)}
                      </p>
                    )}
                    <p className="text-2xs text-navy-400 tabular">
                      Bal {formatCurrency(entry.balance)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
