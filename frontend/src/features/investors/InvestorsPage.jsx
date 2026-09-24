/**
 * ============================================
 * Investors
 * ============================================
 * People who place capital with the business for a profit share.
 *
 * IMPORTANT
 * ---------
 * Investors are NOT part of Zakat. Their capital is a liability of the business
 * towards them, not the owner's wealth, and each investor purifies their own
 * share. The screen says so explicitly so nobody has to remember the rule.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BriefcaseBusiness, Plus, Eye, Pencil, TrendingUp, Wallet, HandCoins,
  FileSignature, Phone, IdCard, Percent, Banknote, Info, History, Save, Trash2,
} from 'lucide-react';

import PageHeader from '../../components/common/PageHeader.jsx';
import TabGuide from '../../components/common/TabGuide.jsx';
import StatCard, { StatGrid } from '../../components/common/StatCard.jsx';
import Badge from '../../components/common/Badge.jsx';
import Button, { IconButton } from '../../components/common/Button.jsx';
import DataTable, { MoneyCell } from '../../components/common/DataTable.jsx';
import Modal, { ModalFooter } from '../../components/common/Modal.jsx';
import DeleteDialog from '../../components/common/DeleteDialog.jsx';
import { removeRow, replaceRow, prependRow } from '../../utils/rowMotion.js';
import { paymentMethodLabel } from '../../constants/index.js';
import EmptyState from '../../components/common/EmptyState.jsx';
import Tabs from '../../components/common/Tabs.jsx';
import {
  Input, Textarea, Select, CurrencyInput, CNICInput, PhoneInput,
  FormRow, FormSection, FieldDisplay,
} from '../../components/common/Form.jsx';
import { AvatarUpload } from '../../components/common/FileUpload.jsx';

import { investorService, agreementService } from '../../services/entities.js';
import { useAuthStore } from '../../context/authStore.js';
import { useSettingsStore } from '../../context/settingsStore.js';
import { useToastStore } from '../../context/toastStore.js';
import { useTableState } from '../../hooks/index.js';
import { calculateInvestorProfit } from '../../utils/financialEngine.js';
import {
  cn, formatCurrency, formatDate, getTelURL, getInitials,
  resolveFileUrl, sumBy, toDateInput, parseNumber,
} from '../../utils/index.js';
import { DOCUMENT_TYPES } from '../../constants/index.js';

const PROFIT_METHODS = [
  { value: 'fixed_percent', label: 'Fixed % of capital', hint: 'A set return on the capital placed' },
  { value: 'profit_sharing', label: 'Share of profit', hint: 'A percentage of business profit' },
  { value: 'monthly_fixed', label: 'Fixed monthly amount', hint: 'An agreed rupee amount each month' },
];

const emptyInvestor = (settings) => ({
  name: '',
  phone: '',
  alternatePhone: '',
  email: '',
  cnic: '',
  address: '',
  photo: null,
  totalInvestment: '',
  investmentDate: toDateInput(new Date()),
  investmentType: 'profit_sharing',
  profitPercentage: settings?.investor?.defaultProfitPercentage ?? 10,
  profitCalculationMethod: settings?.investor?.defaultCalcMethod || 'fixed_percent',
  status: 'active',
  notes: '',
});

export default function InvestorsPage() {
  const toast = useToastStore();
  const { hasPermission } = useAuthStore();
  const settings = useSettingsStore((s) => s.settings);

  const [investors, setInvestors] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyInvestor(settings));
  const [saving, setSaving] = useState(false);

  const [viewing, setViewing] = useState(null);
  const [payoutTarget, setPayoutTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const table = useTableState({ initialSort: 'createdAt', initialFilters: { status: '' } });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await investorService.list(table.params);
      setInvestors(response.data.investors || []);
      setPagination(response.data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      toast.apiError(error, 'Could not load investors.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.params]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyInvestor(settings));
    setFormOpen(true);
  };

  const openEdit = (investor) => {
    setEditing(investor);
    const blank = emptyInvestor(settings);
    setForm(
      Object.keys(blank).reduce((acc, key) => {
        acc[key] = key === 'investmentDate'
          ? toDateInput(investor.investmentDate)
          : investor[key] ?? blank[key];
        return acc;
      }, {})
    );
    setFormOpen(true);
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();

    if (!form.name.trim()) {
      toast.warning('An investor name is required.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const response = await investorService.update(editing._id, form);
        if (response.data?.investor) replaceRow(setInvestors, response.data.investor);
        else load();
        toast.success('Investor updated.');
      } else {
        const response = await investorService.create(form);
        if (response.data?.investor) prependRow(setInvestors, response.data.investor);
        else load();
        toast.success('Investor added.');
      }
      setFormOpen(false);
    } catch (error) {
      toast.apiError(error, 'Could not save this investor.');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      accessor: 'name',
      header: 'Investor',
      sortable: true,
      primary: true,
      render: (investor) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-navy-100 text-navy-600 text-2xs font-bold flex-shrink-0 overflow-hidden">
            {investor.photo ? (
              <img src={resolveFileUrl(investor.photo)} alt="" className="w-full h-full object-cover" />
            ) : (
              getInitials(investor.name)
            )}
          </span>
          <div className="min-w-0">
            <p className="font-medium text-navy-950 truncate">{investor.name}</p>
            <p className="text-2xs text-navy-500 tabular">{investor.phone || investor.cnic}</p>
          </div>
        </div>
      ),
      exportValue: (investor) => investor.name,
    },
    {
      accessor: 'totalInvestment',
      header: 'Capital',
      align: 'right',
      sortable: true,
      secondary: true,
      render: (investor) => <MoneyCell value={investor.totalInvestment} />,
      exportValue: (investor) => investor.totalInvestment,
    },
    {
      accessor: 'profitPercentage',
      header: 'Terms',
      align: 'center',
      hideOnMobile: true,
      render: (investor) => (
        <div>
          <Badge variant="gold" size="sm">{investor.profitPercentage}%</Badge>
          <p className="text-2xs text-navy-500 mt-0.5 capitalize">
            {investor.profitCalculationMethod?.replace(/_/g, ' ')}
          </p>
        </div>
      ),
      exportValue: (investor) => `${investor.profitPercentage}% ${investor.profitCalculationMethod}`,
    },
    {
      accessor: 'profitEarned',
      header: 'Profit earned',
      align: 'right',
      sortable: true,
      hideOnMobile: true,
      render: (investor) => <MoneyCell value={investor.profitEarned} />,
      exportValue: (investor) => investor.profitEarned,
    },
    {
      accessor: 'profitRemaining',
      header: 'Due to pay',
      align: 'right',
      sortable: true,
      render: (investor) =>
        investor.profitRemaining > 0 ? (
          <MoneyCell value={investor.profitRemaining} className="text-warning-600" />
        ) : (
          <span className="text-2xs font-medium text-success-700">Settled</span>
        ),
      exportValue: (investor) => investor.profitRemaining,
    },
    {
      accessor: 'status',
      header: 'Status',
      hideOnMobile: true,
      render: (investor) => (
        <Badge
          variant={
            investor.status === 'active' ? 'success' : investor.status === 'closed' ? 'neutral' : 'warning'
          }
          size="sm"
        >
          {investor.status}
        </Badge>
      ),
      exportValue: (investor) => investor.status,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (investor) => (
        <div className="flex items-center justify-end gap-0.5">
          {investor.profitRemaining > 0 && hasPermission('investors') && (
            <Button
              variant="gold"
              size="xs"
              icon={Banknote}
              onClick={(e) => { e.stopPropagation(); setPayoutTarget(investor); }}
            >
              Pay out
            </Button>
          )}
          <IconButton
            icon={Eye}
            label="View this investor"
            size="icon-sm"
            onClick={(e) => { e.stopPropagation(); setViewing(investor); }}
          />
          {hasPermission('investors') && (
            <IconButton
              icon={Pencil}
              label="Edit"
              size="icon-sm"
              onClick={(e) => { e.stopPropagation(); openEdit(investor); }}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <TabGuide id="investors" />

      <PageHeader
        title="Investors"
        subtitle="Capital placed with the business for a profit share"
        icon={BriefcaseBusiness}
        actions={
          hasPermission('investors') && (
            <Button variant="gold" icon={Plus} onClick={openCreate}>
              Add investor
            </Button>
          )
        }
      />

      {/* The rule, stated where it cannot be missed */}
      <aside className="flex items-start gap-3 rounded-xl border border-info-200 bg-info-50 p-3.5">
        <Info size={17} className="text-info-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-navy-700 leading-relaxed">
          <strong className="text-navy-950">Investors are not included in Zakat.</strong> Their
          capital is a liability of the business towards them rather than the owner&apos;s wealth.
          Each investor is responsible for the Zakat on their own capital and profit share. Zakat
          here is calculated for the owner and for partners only.
        </p>
      </aside>

      <StatGrid columns={4}>
        <StatCard
          label="Investors"
          value={pagination.total}
          icon={BriefcaseBusiness}
          variant="navy"
          isCurrency={false}
        />
        <StatCard
          label="Capital placed"
          value={sumBy(investors, 'totalInvestment')}
          icon={Wallet}
          variant="blue"
          compact
        />
        <StatCard
          label="Profit earned"
          value={sumBy(investors, 'profitEarned')}
          icon={TrendingUp}
          variant="green"
          compact
        />
        <StatCard
          label="Due to pay out"
          value={sumBy(investors, 'profitRemaining')}
          icon={HandCoins}
          variant="amber"
          compact
          subtitle={`${investors.filter((i) => i.profitRemaining > 0).length} pending`}
        />
      </StatGrid>

      <DataTable
        columns={columns}
        data={investors}
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
        searchPlaceholder="Search by name, phone or CNIC…"
        onRowClick={setViewing}
        exportFilename="investors"
        printable
        title="Investors"
        emptyState={
          <EmptyState
            icon={BriefcaseBusiness}
            title="No investors yet"
            message="Record an investor when someone places capital with the business."
            action={
              hasPermission('investors') ? (
                <Button variant="gold" icon={Plus} onClick={openCreate}>Add investor</Button>
              ) : null
            }
          />
        }
      />

      <InvestorFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        saving={saving}
      />

      <InvestorDetailModal
        investor={viewing}
        onClose={() => setViewing(null)}
        onEdit={(investor) => { setViewing(null); openEdit(investor); }}
        onPayout={(investor) => { setViewing(null); setPayoutTarget(investor); }}
        onDelete={(investor) => { setViewing(null); setDeleteTarget(investor); }}
        onChanged={(investor) => { replaceRow(setInvestors, investor); setViewing((v) => (v ? { ...v, ...investor } : v)); }}
      />

      <PayoutModal
        investor={payoutTarget}
        onClose={() => setPayoutTarget(null)}
        onSuccess={(investor) => {
          setPayoutTarget(null);
          if (investor?._id) replaceRow(setInvestors, investor);
          else load();
        }}
      />

      <DeleteDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete this investor?"
        describe={(investor) =>
          `"${investor.name}" will be deleted permanently. If they have investments, payouts or agreements, you will see how many before anything is removed.`
        }
        onDelete={(investor, params) => investorService.delete(investor._id, params)}
        onDeleted={(investor) => removeRow(setInvestors, investor._id)}
      />
    </div>
  );
}

/* ============================================================================
 * Form
 * ========================================================================== */

function InvestorFormModal({ isOpen, onClose, editing, form, setForm, onSubmit, saving }) {
  // Live projection of what the agreed terms would pay
  const projected = useMemo(
    () =>
      calculateInvestorProfit({
        investmentAmount: form.totalInvestment,
        profitPercentage: form.profitPercentage,
        method: form.profitCalculationMethod,
      }),
    [form.totalInvestment, form.profitPercentage, form.profitCalculationMethod]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Edit investor' : 'Add investor'}
      subtitle={editing?.name}
      icon={BriefcaseBusiness}
      size="lg"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="gold" onClick={onSubmit} isLoading={saving} loadingText="Saving…">
            {editing ? 'Save changes' : 'Add investor'}
          </Button>
        </ModalFooter>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <FormSection title="Investor details" icon={IdCard}>
          <AvatarUpload
            label="Photo"
            value={form.photo}
            onChange={(url) => setForm({ ...form, photo: url })}
            folder="misc"
          />

          <FormRow cols={2}>
            <Input
              label="Full name"
              required
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <CNICInput
              label="CNIC"
              value={form.cnic}
              onChange={(e) => setForm({ ...form, cnic: e.target.value })}
            />
          </FormRow>

          <FormRow cols={2}>
            <PhoneInput
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </FormRow>

          <Textarea
            label="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            rows={2}
          />
        </FormSection>

        <FormSection title="Investment terms" icon={Percent}>
          <FormRow cols={2}>
            <CurrencyInput
              label="Capital placed"
              required
              value={form.totalInvestment}
              onChange={(e) => setForm({ ...form, totalInvestment: e.target.value })}
            />
            <Input
              label="Date placed"
              type="date"
              value={form.investmentDate}
              onChange={(e) => setForm({ ...form, investmentDate: e.target.value })}
              max={toDateInput(new Date())}
            />
          </FormRow>

          <FormRow cols={2}>
            <Select
              label="Profit basis"
              value={form.profitCalculationMethod}
              onChange={(e) => setForm({ ...form, profitCalculationMethod: e.target.value })}
              options={PROFIT_METHODS}
              hint={PROFIT_METHODS.find((m) => m.value === form.profitCalculationMethod)?.hint}
            />
            <Input
              label="Profit share"
              type="number"
              min={0}
              max={100}
              value={form.profitPercentage}
              onChange={(e) => setForm({ ...form, profitPercentage: parseNumber(e.target.value) })}
              suffix="%"
            />
          </FormRow>

          {projected.calculatedProfit > 0 && (
            <div className="rounded-lg bg-gold-50 border border-gold-200 p-3 animate-fade-in">
              <p className="text-2xs text-navy-600">On these terms, the profit works out at</p>
              <p className="text-lg font-display font-bold text-navy-950 tabular">
                {formatCurrency(projected.calculatedProfit)}
              </p>
              <p className="text-2xs text-navy-500">{projected.basis}</p>
            </div>
          )}

          <FormRow cols={2}>
            <Select
              label="Investment type"
              value={form.investmentType}
              onChange={(e) => setForm({ ...form, investmentType: e.target.value })}
              options={[
                { value: 'profit_sharing', label: 'Profit sharing' },
                { value: 'fixed_term', label: 'Fixed term' },
                { value: 'ongoing', label: 'Ongoing' },
              ]}
            />
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'closed', label: 'Closed — capital returned' },
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
  );
}

/* ============================================================================
 * Detail
 * ========================================================================== */

function InvestorDetailModal({ investor, onClose, onEdit, onPayout, onDelete, onChanged }) {
  const toast = useToastStore();
  const [issuing, setIssuing] = useState(false);
  const [account, setAccount] = useState(null);
  const [capital, setCapital] = useState({ amount: '', investmentDate: '', notes: '' });
  const [adding, setAdding] = useState(false);

  const loadAccount = (id) =>
    investorService.get(id).then((res) => setAccount(res.data)).catch(() => setAccount({ investments: [], payouts: [] }));

  useEffect(() => {
    setAccount(null);
    if (investor?._id) loadAccount(investor._id);
  }, [investor?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!investor) return null;

  const addCapital = async (event) => {
    event?.preventDefault();
    if (!(Number(capital.amount) > 0)) return toast.warning('Enter the amount invested.');
    setAdding(true);
    try {
      const response = await investorService.addInvestment(investor._id, {
        amount: Number(capital.amount),
        investmentDate: capital.investmentDate || undefined,
        notes: capital.notes,
      });
      onChanged?.(response.data.investor);
      toast.success('Capital added.');
      setCapital({ amount: '', investmentDate: '', notes: '' });
      loadAccount(investor._id);
    } catch (error) {
      toast.apiError(error, 'Could not add the capital.');
    } finally {
      setAdding(false);
    }
  };

  const removeEntry = async (kind, entry) => {
    const amount = kind === 'investment' ? entry.amount : entry.payoutAmount;
    if (!window.confirm(`Delete this ${kind} of ${formatCurrency(amount)} permanently?`)) return;
    try {
      const response = kind === 'investment'
        ? await investorService.deleteInvestment(investor._id, entry._id)
        : await investorService.deletePayout(investor._id, entry._id);
      if (response.data?.investor) onChanged?.(response.data.investor);
      toast.success(response.message || 'Deleted.');
      loadAccount(investor._id);
    } catch (error) {
      toast.apiError(error);
    }
  };

  const handleIssueAgreement = async () => {
    setIssuing(true);
    try {
      const response = await agreementService.create({
        type: DOCUMENT_TYPES.INVESTOR_AGREEMENT,
        investorId: investor._id,
      });
      toast.success(
        `Agreement ${response.data.agreement.agreementNumber} issued. Open it from the Agreements screen to print.`
      );
    } catch (error) {
      toast.apiError(error, 'Could not issue the agreement.');
    } finally {
      setIssuing(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(investor)}
      onClose={onClose}
      title={investor.name}
      subtitle={`${investor.profitPercentage}% · ${investor.profitCalculationMethod?.replace(/_/g, ' ')}`}
      icon={BriefcaseBusiness}
      size="md"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button
            variant="secondary"
            icon={FileSignature}
            onClick={handleIssueAgreement}
            isLoading={issuing}
          >
            Issue agreement
          </Button>
          {onDelete && (
            <Button variant="secondary" icon={Trash2} className="text-danger-600" onClick={() => onDelete(investor)}>
              Delete
            </Button>
          )}
          <Button variant="secondary" icon={Pencil} onClick={() => onEdit(investor)}>Edit</Button>
          {investor.profitRemaining > 0 && (
            <Button variant="gold" icon={Banknote} onClick={() => onPayout(investor)}>
              Record a payout
            </Button>
          )}
        </ModalFooter>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Capital', value: investor.totalInvestment, tone: 'text-navy-950' },
            { label: 'Profit earned', value: investor.profitEarned, tone: 'text-success-700' },
            { label: 'Due to pay', value: investor.profitRemaining, tone: 'text-warning-600' },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-navy-50 border border-navy-100 p-2.5 text-center">
              <p className="text-2xs text-navy-500 leading-tight">{item.label}</p>
              <p className={cn('text-sm font-semibold tabular mt-0.5', item.tone)}>
                {formatCurrency(item.value)}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldDisplay label="CNIC" value={investor.cnic} mono />
          <FieldDisplay label="Phone" value={investor.phone} mono icon={Phone} />
          <FieldDisplay label="Email" value={investor.email} />
          <FieldDisplay label="Placed on" value={formatDate(investor.investmentDate)} />
          <FieldDisplay label="Type" value={investor.investmentType?.replace(/_/g, ' ')} />
          <FieldDisplay label="Status" value={investor.status} />
        </div>

        <FieldDisplay label="Address" value={investor.address} />
        {investor.notes && <FieldDisplay label="Notes" value={investor.notes} />}

        <div className="flex items-start gap-2.5 rounded-lg bg-info-50 border border-info-200 p-3">
          <Info size={15} className="text-info-600 flex-shrink-0 mt-0.5" />
          <p className="text-2xs text-navy-700 leading-relaxed">
            This capital is excluded from the business&apos;s Zakat calculation.{' '}
            {investor.name.split(' ')[0]} is responsible for the Zakat on their own capital and
            profit share.
          </p>
        </div>

        {/* ---- Capital added ---- */}
        <FormSection title="Capital" icon={BriefcaseBusiness}>
          <form onSubmit={addCapital} className="rounded-xl border-2 border-gold-300 bg-gold-50/70 p-3 space-y-2.5">
            <p className="text-sm font-semibold text-navy-900">Add capital</p>
            <FormRow cols={2}>
              <CurrencyInput label="Amount" value={capital.amount} onChange={(e) => setCapital({ ...capital, amount: e.target.value })} />
              <Input label="Date" type="date" value={capital.investmentDate} onChange={(e) => setCapital({ ...capital, investmentDate: e.target.value })} hint="Leave empty for today" />
            </FormRow>
            <Input label="Notes" value={capital.notes} onChange={(e) => setCapital({ ...capital, notes: e.target.value })} />
            <Button type="submit" variant="gold" icon={Plus} isLoading={adding} loadingText="Adding…" className="w-full">Add capital</Button>
          </form>

          <AccountList
            loading={!account}
            empty="No capital recorded yet."
            rows={(account?.investments || []).map((inv) => ({
              id: inv._id,
              amount: inv.amount,
              line: `${formatDate(inv.investmentDate || inv.createdAt)}${inv.notes ? ` · ${inv.notes}` : ''}`,
              onDelete: () => removeEntry('investment', inv),
            }))}
          />
        </FormSection>

        {/* ---- Payouts ---- */}
        <FormSection title="Profit payouts" icon={Banknote}>
          <AccountList
            loading={!account}
            empty="No payouts yet."
            rows={(account?.payouts || []).map((p) => ({
              id: p._id,
              amount: p.payoutAmount,
              tone: 'text-danger-600',
              line: `${formatDate(p.paymentDate)} · ${paymentMethodLabel(p.paymentMethod)}${p.receiptNumber ? ` · ${p.receiptNumber}` : ''}`,
              onDelete: () => removeEntry('payout', p),
            }))}
          />
        </FormSection>

        {investor.phone && (
          <a href={getTelURL(investor.phone)} className="btn-secondary btn w-full justify-center">
            <Phone size={15} /> Call {investor.name.split(' ')[0]}
          </a>
        )}
      </div>
    </Modal>
  );
}

/** A short list of account entries, each with its own delete. */
function AccountList({ rows, loading, empty }) {
  if (loading) return <div className="skeleton h-10 w-full" />;
  if (!rows.length) return <p className="text-sm text-navy-500">{empty}</p>;
  return (
    <ul className="divide-y divide-navy-100 rounded-lg border border-navy-100">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center gap-3 px-3 py-2">
          <span className="min-w-0 flex-1">
            <span className={cn('block text-sm font-semibold tabular', row.tone || 'text-navy-900')}>{formatCurrency(row.amount)}</span>
            <span className="block text-2xs text-navy-500 truncate">{row.line}</span>
          </span>
          <button
            type="button"
            onClick={row.onDelete}
            aria-label="Delete this entry"
            className="p-1.5 rounded-md text-danger-500 hover:bg-danger-50 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ============================================================================
 * Payout
 * ========================================================================== */

function PayoutModal({ investor, onClose, onSuccess }) {
  const toast = useToastStore();
  const [form, setForm] = useState({
    payoutAmount: '',
    paymentMethod: 'cash',
    paymentDate: toDateInput(new Date()),
    referenceNumber: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (investor) {
      setForm((current) => ({ ...current, payoutAmount: String(investor.profitRemaining || '') }));
    }
  }, [investor]);

  if (!investor) return null;

  const amount = parseNumber(form.payoutAmount);

  const handleSubmit = async (event) => {
    event?.preventDefault();

    if (amount <= 0) {
      toast.warning('Enter an amount greater than zero.');
      return;
    }

    setSaving(true);
    try {
      const response = await investorService.recordPayout(investor._id, {
        investor: investor._id,
        payoutAmount: amount,
        paymentMethod: form.paymentMethod,
        paymentDate: form.paymentDate,
        referenceNumber: form.referenceNumber,
        notes: form.notes,
      });
      toast.success(`Payout of ${formatCurrency(amount)} recorded.`);
      onSuccess?.(response.data?.investor);
    } catch (error) {
      toast.apiError(error, 'Could not record the payout.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(investor)}
      onClose={onClose}
      title="Record a profit payout"
      subtitle={investor.name}
      icon={Banknote}
      size="sm"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            variant="gold"
            icon={Save}
            onClick={handleSubmit}
            isLoading={saving}
            disabled={amount <= 0}
          >
            Record {amount > 0 ? formatCurrency(amount) : 'payout'}
          </Button>
        </ModalFooter>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-navy-50 border border-navy-100 p-3 text-center">
          <div>
            <p className="text-2xs text-navy-500">Profit earned</p>
            <p className="text-sm font-semibold text-navy-950 tabular mt-0.5">
              {formatCurrency(investor.profitEarned)}
            </p>
          </div>
          <div>
            <p className="text-2xs text-navy-500">Still to pay</p>
            <p className="text-sm font-semibold text-warning-600 tabular mt-0.5">
              {formatCurrency(investor.profitRemaining)}
            </p>
          </div>
        </div>

        <CurrencyInput
          label="Payout amount"
          required
          autoFocus
          value={form.payoutAmount}
          onChange={(e) => setForm({ ...form, payoutAmount: e.target.value })}
          error={
            amount > investor.profitRemaining
              ? 'That is more than the profit currently owed.'
              : undefined
          }
        />

        <FormRow cols={2}>
          <Select
            label="Method"
            value={form.paymentMethod}
            onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'bank', label: 'Bank transfer' },
              { value: 'card', label: 'Card' },
              { value: 'other', label: 'Other' },
            ]}
          />
          <Input
            label="Date"
            type="date"
            value={form.paymentDate}
            onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
            max={toDateInput(new Date())}
          />
        </FormRow>

        <Input
          label="Reference"
          value={form.referenceNumber}
          onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
          placeholder="Transaction ID (optional)"
        />

        <Textarea
          label="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={2}
        />

        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}
