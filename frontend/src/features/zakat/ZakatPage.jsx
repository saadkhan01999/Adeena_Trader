/**
 * ============================================
 * Zakat
 * ============================================
 * Calculate, record and track the Zakat due on the business.
 *
 * BUSINESS RULE
 * -------------
 * Zakat applies to the OWNER and to PARTNERS only. Investors are never
 * included: their capital is a liability of the business towards them, not the
 * owner's wealth, and they purify their own share. The screen states this
 * plainly rather than leaving it implicit, because getting it wrong is a
 * religious error, not just an accounting one.
 *
 * How the figures are produced
 * ----------------------------
 * Stock, receivables and supplier payables are read live from the business and
 * cannot be typed over casually. Only cash in hand, the bank balance and any
 * other assets or liabilities are entered by the user, because those are the
 * only figures the system cannot observe. Everything recalculates as you type.
 *
 * Nisab
 * -----
 * Fixed at 87.48 g of gold or 612.36 g of silver. Where wealth is a mixture of
 * asset types - which a trading business always is - the lower SILVER threshold
 * applies, so that is the default. The admin enters the current local rate per
 * gram and the rupee threshold follows.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Eye, HandCoins, Calculator, History, Settings as SettingsIcon, Save, Printer,
  Info, TrendingUp, Scale, Coins, AlertTriangle, CheckCircle2, Users,
  Landmark, Package, Receipt, CircleDollarSign, RefreshCw, Trash2, Wallet,
} from 'lucide-react';

import PageHeader from '../../components/common/PageHeader.jsx';
import TabGuide from '../../components/common/TabGuide.jsx';
import StatCard, { StatGrid } from '../../components/common/StatCard.jsx';
import Badge from '../../components/common/Badge.jsx';
import Button, { IconButton } from '../../components/common/Button.jsx';
import DataTable, { MoneyCell } from '../../components/common/DataTable.jsx';
import Tabs from '../../components/common/Tabs.jsx';
import Modal, { ModalFooter } from '../../components/common/Modal.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import {
  Input, Select, Textarea, CurrencyInput, Checkbox, RadioCards,
  FormRow, FormSection, FieldDisplay,
} from '../../components/common/Form.jsx';
import { PageSkeleton } from '../../components/common/Skeleton.jsx';

import { zakatService, partnerService } from '../../services/entities.js';
import { useAuthStore } from '../../context/authStore.js';
import { useToastStore } from '../../context/toastStore.js';
import { calculateZakat, calculateNisab } from '../../utils/financialEngine.js';
import { cn, formatCurrency, formatDate, parseNumber, toDateInput } from '../../utils/index.js';
import { NISAB_WEIGHTS, NISAB_BASIS_OPTIONS, ZAKAT_RATE } from '../../constants/index.js';

export default function ZakatPage() {
  const toast = useToastStore();
  const { isAdmin } = useAuthStore();

  const [tab, setTab] = useState('calculator');
  const [settings, setSettings] = useState(null);
  const [reference, setReference] = useState(null);
  const [hawl, setHawl] = useState(null);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);

  // ---- Load ------------------------------------------------------------
  const loadSettings = useCallback(async () => {
    try {
      const [settingsRes, partnerRes] = await Promise.all([
        zakatService.getSettings(),
        partnerService.list({ limit: 100, status: 'active' }),
      ]);

      setSettings(settingsRes.data.settings);
      setReference(settingsRes.data.reference);
      setHawl(settingsRes.data.hawl);
      setPartners(partnerRes.data.partners || []);
    } catch (error) {
      toast.apiError(error, 'Could not load Zakat settings.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  if (loading || !settings) return <PageSkeleton stats={4} showChart={false} />;

  const nisabIsSet = settings.nisab > 0;

  return (
    <div className="space-y-5">
      <TabGuide id="zakat" />

      <PageHeader
        title="Zakat"
        subtitle="2.5% of net zakatable wealth, for the owner and each partner"
        icon={HandCoins}
        badge={
          nisabIsSet ? (
            <Badge variant="gold" size="sm">
              Nisab {formatCurrency(settings.nisab)}
            </Badge>
          ) : (
            <Badge variant="danger" size="sm" dot pulse>Nisab not set</Badge>
          )
        }
      />

      {/* The rule, stated where nobody can miss it */}
      <aside className="card overflow-hidden">
        <div className="flex items-start gap-3 p-4 bg-gold-50 border-l-[3px] border-gold-500">
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-gold-500 text-navy-950 flex-shrink-0">
            <Scale size={18} />
          </span>

          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-navy-950">
              Zakat is calculated for the owner and partners only
            </h2>
            <p className="text-xs text-navy-700 mt-1 leading-relaxed">
              Investor capital is <strong>never</strong> included. It is a liability of the business
              towards the investor rather than the owner&apos;s wealth, and each investor is
              responsible for the Zakat on their own capital and profit share.
            </p>
          </div>
        </div>
      </aside>

      {!nisabIsSet && (
        <aside className="flex items-start gap-3 rounded-xl border border-danger-200 bg-danger-50 p-4">
          <AlertTriangle size={18} className="text-danger-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-danger-800">
              Set the Nisab threshold before calculating
            </p>
            <p className="text-xs text-danger-700 mt-0.5 leading-relaxed">
              Enter today&apos;s silver rate per gram in the Settings tab. The threshold is then
              612.36 g × that rate.
            </p>
          </div>
          {isAdmin() && (
            <Button variant="danger" size="sm" onClick={() => setTab('settings')}>
              Open settings
            </Button>
          )}
        </aside>
      )}

      <Tabs
        tabs={[
          { id: 'calculator', label: 'Calculator', icon: Calculator },
          { id: 'history', label: 'History', icon: History },
          { id: 'settings', label: 'Settings', icon: SettingsIcon },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'calculator' && (
        <ZakatCalculator settings={settings} partners={partners} hawl={hawl} onSaved={() => setTab('history')} />
      )}

      {tab === 'history' && <ZakatHistory />}

      {tab === 'settings' && (
        <ZakatSettings
          settings={settings}
          reference={reference}
          hawl={hawl}
          canEdit={isAdmin()}
          onSaved={loadSettings}
        />
      )}
    </div>
  );
}

/* ============================================================================
 * Calculator
 * ========================================================================== */

function ZakatCalculator({ settings, partners, hawl, onSaved }) {
  const toast = useToastStore();

  const [ownershipType, setOwnershipType] = useState('owner');
  const [partnerId, setPartnerId] = useState('');
  const [assets, setAssets] = useState(null);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [saving, setSaving] = useState(false);

  const [manual, setManual] = useState({
    cash: '',
    bankBalance: '',
    otherAssets: '',
    otherLiabilities: '',
    zakatYear: String(new Date().getFullYear()),
    notes: '',
  });

  const [overrides, setOverrides] = useState({ useOverride: false, stock: '', receivables: '' });

  // ---- Pull the live position ------------------------------------------
  const loadAssets = useCallback(async () => {
    setLoadingAssets(true);
    try {
      const response = await zakatService.getAssets({
        ownershipType,
        ...(ownershipType === 'partner' && partnerId ? { partner: partnerId } : {}),
      });
      setAssets(response.data.assets);
    } catch (error) {
      toast.apiError(error, 'Could not read the current asset position.');
    } finally {
      setLoadingAssets(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownershipType, partnerId]);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  // ---- Live result, recomputed on every keystroke -----------------------
  const result = useMemo(() => {
    if (!assets) return null;

    return calculateZakat({
      eligibleStock: overrides.useOverride && overrides.stock !== '' ? overrides.stock : assets.eligibleStock,
      receivables:
        overrides.useOverride && overrides.receivables !== '' ? overrides.receivables : assets.receivables,
      cash: manual.cash,
      bankBalance: manual.bankBalance,
      otherAssets: manual.otherAssets,
      supplierPayables: assets.supplierPayables,
      otherLiabilities: manual.otherLiabilities,
      nisab: settings.nisab,
      rate: settings.rate,
      eligibleAssets: settings.eligibleAssets,
      eligibleDeductions: settings.eligibleDeductions,
    });
  }, [assets, manual, overrides, settings]);

  const handleSave = async () => {
    if (ownershipType === 'partner' && !partnerId) {
      toast.warning('Choose which partner this calculation is for.');
      return;
    }
    if (!settings.nisab) {
      toast.error('Set the Nisab threshold in the Settings tab first.');
      return;
    }

    setSaving(true);
    try {
      const response = await zakatService.calculate({
        ownershipType,
        partner: ownershipType === 'partner' ? partnerId : null,
        cash: parseNumber(manual.cash),
        bankBalance: parseNumber(manual.bankBalance),
        otherAssets: parseNumber(manual.otherAssets),
        otherLiabilities: parseNumber(manual.otherLiabilities),
        zakatYear: manual.zakatYear,
        notes: manual.notes,
        ...(overrides.useOverride && overrides.stock !== '' ? { overrideStock: parseNumber(overrides.stock) } : {}),
        ...(overrides.useOverride && overrides.receivables !== ''
          ? { overrideReceivables: parseNumber(overrides.receivables) }
          : {}),
      });

      toast.success(response.message);
      onSaved?.();
    } catch (error) {
      toast.apiError(error, 'Could not save the calculation.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
      {/* ---------------- Inputs ---------------- */}
      <div className="xl:col-span-3 space-y-4">
        <div className="card p-4 sm:p-5 space-y-5">
          <FormSection title="Whose Zakat is this?" icon={Users}>
            <RadioCards
              options={[
                { value: 'owner', label: 'Owner', icon: Users, hint: 'Your own share of the business' },
                {
                  value: 'partner',
                  label: 'Partner',
                  icon: Users,
                  hint: partners.length ? 'A partner’s share' : 'No partners on record',
                  disabled: partners.length === 0,
                },
              ]}
              value={ownershipType}
              onChange={(value) => { setOwnershipType(value); setPartnerId(''); }}
              columns={2}
            />

            {ownershipType === 'partner' && (
              <Select
                label="Partner"
                required
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                placeholder="Choose a partner"
                options={partners.map((p) => ({
                  value: p._id,
                  label: `${p.name} — ${p.ownershipPercent}% share`,
                }))}
                hint="Their zakatable assets are their share of the stock, receivables and cash"
              />
            )}
          </FormSection>

          {/* ---- Read from the business ---- */}
          <FormSection
            title="Read from your records"
            icon={Package}
            description="Live figures — no need to type them"
            action={
              <IconButton
                icon={RefreshCw}
                label="Refresh these figures"
                size="icon-sm"
                variant="secondary"
                onClick={loadAssets}
                className={cn(loadingAssets && '[&>svg]:animate-spin')}
              />
            }
          >
            {loadingAssets || !assets ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => <div key={i} className="skeleton h-[72px] rounded-lg" />)}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <LiveFigure
                    label="Trade stock"
                    value={assets.eligibleStock}
                    hint={`${assets.detail.stockUnits} units at selling price`}
                    icon={Package}
                  />
                  <LiveFigure
                    label="Receivables"
                    value={assets.receivables}
                    hint={`${assets.detail.openInvoices} open invoice(s)`}
                    icon={Receipt}
                  />
                  <LiveFigure
                    label="Supplier payables"
                    value={assets.supplierPayables}
                    hint="Deducted from your assets"
                    icon={CircleDollarSign}
                    negative
                  />
                </div>

                {assets.detail.doubtfulReceivables > 0 && (
                  <p className="flex items-start gap-1.5 text-2xs text-warning-700 mt-2">
                    <AlertTriangle size={12} className="flex-shrink-0 mt-px" />
                    {formatCurrency(assets.detail.doubtfulReceivables)} of the receivables are more
                    than a year overdue. Scholars exclude debts that are not realistically
                    recoverable — use the override below if you consider them bad debt.
                  </p>
                )}

                <div className="mt-3 pt-3 border-t border-navy-100">
                  <Checkbox
                    label="Enter stock and receivables manually"
                    description="Use this after a physical stock count, or to exclude bad debt"
                    checked={overrides.useOverride}
                    onChange={(e) => setOverrides({ ...overrides, useOverride: e.target.checked })}
                  />

                  {overrides.useOverride && (
                    <FormRow cols={2} className="mt-3 animate-fade-in">
                      <CurrencyInput
                        label="Stock value"
                        value={overrides.stock}
                        onChange={(e) => setOverrides({ ...overrides, stock: e.target.value })}
                        placeholder={String(assets.eligibleStock)}
                        showPreview={false}
                      />
                      <CurrencyInput
                        label="Recoverable receivables"
                        value={overrides.receivables}
                        onChange={(e) => setOverrides({ ...overrides, receivables: e.target.value })}
                        placeholder={String(assets.receivables)}
                        showPreview={false}
                      />
                    </FormRow>
                  )}
                </div>
              </>
            )}
          </FormSection>

          {/* ---- Entered by the user ---- */}
          <FormSection
            title="What only you know"
            icon={Wallet}
            description="Cash in hand, bank balances and anything else"
          >
            <FormRow cols={2}>
              <CurrencyInput
                label="Cash in hand"
                value={manual.cash}
                onChange={(e) => setManual({ ...manual, cash: e.target.value })}
                showPreview={false}
              />
              <CurrencyInput
                label="Bank balance"
                value={manual.bankBalance}
                onChange={(e) => setManual({ ...manual, bankBalance: e.target.value })}
                showPreview={false}
              />
            </FormRow>

            <FormRow cols={2}>
              <CurrencyInput
                label="Other zakatable assets"
                value={manual.otherAssets}
                onChange={(e) => setManual({ ...manual, otherAssets: e.target.value })}
                showPreview={false}
                hint="Gold, silver or investments held for trade"
              />
              <CurrencyInput
                label="Other immediate liabilities"
                value={manual.otherLiabilities}
                onChange={(e) => setManual({ ...manual, otherLiabilities: e.target.value })}
                showPreview={false}
                hint="Debts falling due within the coming month"
              />
            </FormRow>

            <p className="text-2xs text-navy-500 leading-relaxed">
              Fixed assets used to run the shop — fittings, counters, the delivery bike — are
              exempt and should not be entered here.
            </p>
          </FormSection>

          <FormSection title="Record" icon={Save}>
            <FormRow cols={2}>
              <Input
                label="Zakat year"
                value={manual.zakatYear}
                onChange={(e) => setManual({ ...manual, zakatYear: e.target.value })}
                placeholder="2026 or 1447 AH"
              />
            </FormRow>

            <Textarea
              label="Notes"
              value={manual.notes}
              onChange={(e) => setManual({ ...manual, notes: e.target.value })}
              rows={2}
              maxLength={500}
              placeholder="Anything worth recording about this calculation"
            />
          </FormSection>
        </div>
      </div>

      {/* ---------------- Result ---------------- */}
      <div className="xl:col-span-2">
        <div className="xl:sticky xl:top-20 space-y-4">
          <div className="card overflow-hidden print-area">
            {/* Headline */}
            <div
              className={cn(
                'px-5 py-5 text-center',
                result?.isAboveNisab ? 'bg-gold-500' : 'bg-navy-950'
              )}
            >
              <p
                className={cn(
                  'text-2xs font-bold uppercase tracking-widest',
                  result?.isAboveNisab ? 'text-navy-950/70' : 'text-navy-400'
                )}
              >
                Zakat payable
              </p>
              <p
                className={cn(
                  'text-3xl sm:text-4xl font-display font-bold tabular mt-1',
                  result?.isAboveNisab ? 'text-navy-950' : 'text-white'
                )}
              >
                {formatCurrency(result?.zakatAmount || 0)}
              </p>
              <p
                className={cn(
                  'text-xs mt-1',
                  result?.isAboveNisab ? 'text-navy-950/70' : 'text-navy-400'
                )}
              >
                {result?.isAboveNisab
                  ? `${(settings.rate * 100).toFixed(2)}% of net zakatable wealth`
                  : 'Below the Nisab threshold — nothing is due'}
              </p>
            </div>

            {/* Working */}
            <div className="p-4 space-y-1">
              <p className="text-2xs font-semibold uppercase tracking-widest text-navy-400 mb-2">
                Working
              </p>

              {[
                { label: 'Trade stock', value: result?.eligibleStock },
                { label: 'Receivables', value: result?.receivables },
                { label: 'Cash in hand', value: result?.cash },
                { label: 'Bank balance', value: result?.bankBalance },
                { label: 'Other assets', value: result?.otherAssets },
              ]
                .filter((row) => row.value > 0)
                .map((row) => (
                  <Line key={row.label} label={row.label} value={row.value} />
                ))}

              <Line label="Gross assets" value={result?.grossAssets} bold divider />

              {result?.supplierPayables > 0 && (
                <Line label="Less: supplier payables" value={result.supplierPayables} negative />
              )}
              {result?.otherLiabilities > 0 && (
                <Line label="Less: other liabilities" value={result.otherLiabilities} negative />
              )}

              <Line label="Net zakatable wealth" value={result?.netAssets} bold divider />
            </div>

            {/* Nisab test */}
            <div className="px-4 pb-4">
              <div
                className={cn(
                  'rounded-lg border p-3',
                  result?.isAboveNisab
                    ? 'border-success-200 bg-success-50'
                    : 'border-navy-200 bg-navy-50'
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-navy-700">
                    {result?.isAboveNisab ? (
                      <CheckCircle2 size={14} className="text-success-600" />
                    ) : (
                      <Info size={14} className="text-navy-400" />
                    )}
                    Nisab threshold
                  </span>
                  <span className="text-sm font-semibold text-navy-950 tabular">
                    {formatCurrency(result?.nisab || 0)}
                  </span>
                </div>

                <p className="text-2xs text-navy-600 mt-1.5 leading-relaxed">
                  {result?.isAboveNisab
                    ? 'Net wealth is at or above the threshold, so Zakat is due.'
                    : result?.shortfallToNisab > 0
                      ? `${formatCurrency(result.shortfallToNisab)} below the threshold.`
                      : 'Enter a metal rate in Settings to set the threshold.'}
                </p>
              </div>
            </div>

            {/* Hawl */}
            {hawl?.dueDate && (
              <div className="px-4 pb-4">
                <div className="rounded-lg border border-navy-200 p-3">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-xs font-medium text-navy-700">
                      Hawl (lunar year) progress
                    </span>
                    <span className="text-2xs text-navy-500 tabular">{hawl.percent}%</span>
                  </div>

                  <div className="h-1.5 rounded-full bg-navy-100 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        hawl.isComplete ? 'bg-success-500' : 'bg-gold-500'
                      )}
                      style={{ width: `${hawl.percent}%` }}
                    />
                  </div>

                  <p className="text-2xs text-navy-600 mt-1.5">
                    {hawl.isComplete
                      ? 'A full lunar year has passed — Zakat is due now.'
                      : `${hawl.daysRemaining} days remaining · due ${formatDate(hawl.dueDate)}`}
                  </p>
                </div>
              </div>
            )}

            <div className="px-4 pb-4 flex gap-2 no-print">
              <Button
                variant="gold"
                icon={Save}
                onClick={handleSave}
                isLoading={saving}
                loadingText="Saving…"
                disabled={!settings.nisab}
                className="flex-1"
              >
                Save calculation
              </Button>
              <IconButton
                icon={Printer}
                label="Print this working"
                variant="secondary"
                onClick={() => window.print()}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A read-only figure pulled from the business. */
function LiveFigure({ label, value, hint, icon: Icon, negative }) {
  return (
    <div className="rounded-lg border border-navy-200 bg-navy-50/60 p-3">
      <span className="flex items-center gap-1.5 text-2xs text-navy-500">
        {Icon && <Icon size={12} />}
        {label}
      </span>
      <p className={cn('text-base font-semibold tabular mt-0.5', negative ? 'text-danger-600' : 'text-navy-950')}>
        {negative && '−'}{formatCurrency(value)}
      </p>
      {hint && <p className="text-2xs text-navy-400 mt-0.5 leading-snug">{hint}</p>}
    </div>
  );
}

/** One line in the working. */
function Line({ label, value, bold, negative, divider }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 py-1 text-sm',
        divider && 'border-t border-navy-100 pt-2 mt-1'
      )}
    >
      <span className={cn(bold ? 'font-semibold text-navy-900' : 'text-navy-600')}>{label}</span>
      <span
        className={cn(
          'tabular',
          bold ? 'font-bold text-navy-950' : 'font-medium text-navy-800',
          negative && 'text-danger-600'
        )}
      >
        {negative && '−'}{formatCurrency(value || 0)}
      </span>
    </div>
  );
}

/* ============================================================================
 * History
 * ========================================================================== */

function ZakatHistory() {
  const toast = useToastStore();
  const { isAdmin } = useAuthStore();

  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payTarget, setPayTarget] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await zakatService.getHistory({ limit: 100 });
      setRecords(response.data.records || []);
      setSummary(response.data.summary);
    } catch (error) {
      toast.apiError(error, 'Could not load the Zakat history.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    try {
      await zakatService.delete(deleteTarget._id);
      toast.success('Calculation deleted.');
      setDeleteTarget(null);
      load();
    } catch (error) {
      toast.apiError(error);
    }
  };

  const columns = [
    {
      accessor: 'zakatYear',
      header: 'Year',
      sortable: true,
      primary: true,
      render: (record) => (
        <div>
          <p className="font-medium text-navy-950">{record.zakatYear}</p>
          <p className="text-2xs text-navy-500">{formatDate(record.calculationDate)}</p>
        </div>
      ),
      exportValue: (record) => record.zakatYear,
    },
    {
      key: 'for',
      header: 'For',
      secondary: true,
      render: (record) => (
        <Badge variant={record.ownershipType === 'owner' ? 'gold' : 'info'} size="sm">
          {record.ownershipType === 'owner'
            ? 'Owner'
            : record.partnerName || record.partner?.name || 'Partner'}
        </Badge>
      ),
      exportValue: (record) =>
        record.ownershipType === 'owner' ? 'Owner' : record.partnerName || 'Partner',
    },
    {
      accessor: 'netAssets',
      header: 'Net wealth',
      align: 'right',
      sortable: true,
      hideOnMobile: true,
      render: (record) => <MoneyCell value={record.netAssets} />,
      exportValue: (record) => record.netAssets,
    },
    {
      accessor: 'nisab',
      header: 'Nisab',
      align: 'right',
      hideOnMobile: true,
      render: (record) => <MoneyCell value={record.nisab} />,
      exportValue: (record) => record.nisab,
    },
    {
      accessor: 'zakatAmount',
      header: 'Zakat',
      align: 'right',
      sortable: true,
      render: (record) => <MoneyCell value={record.zakatAmount} className="text-gold-700 font-bold" />,
      exportValue: (record) => record.zakatAmount,
    },
    {
      accessor: 'paymentStatus',
      header: 'Paid',
      render: (record) => (
        <div>
          <Badge
            variant={
              record.paymentStatus === 'paid'
                ? 'success'
                : record.paymentStatus === 'partially_paid'
                  ? 'warning'
                  : 'neutral'
            }
            size="sm"
          >
            {record.paymentStatus === 'paid'
              ? 'Paid'
              : record.paymentStatus === 'partially_paid'
                ? 'Part paid'
                : 'Unpaid'}
          </Badge>
          {record.amountPaid > 0 && record.paymentStatus !== 'paid' && (
            <p className="text-2xs text-navy-500 tabular mt-0.5">
              {formatCurrency(record.amountPaid)}
            </p>
          )}
        </div>
      ),
      exportValue: (record) => record.paymentStatus,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (record) => (
        <div className="flex items-center justify-end gap-1">
          <IconButton
            icon={Eye}
            label="View this calculation"
            size="icon-sm"
            onClick={(e) => { e.stopPropagation(); setViewing(record); }}
          />

          {record.zakatAmount > 0 && record.paymentStatus !== 'paid' && (
            <Button
              variant="gold"
              size="xs"
              icon={HandCoins}
              onClick={(e) => { e.stopPropagation(); setPayTarget(record); }}
            >
              Record payment
            </Button>
          )}
          {isAdmin() && record.amountPaid === 0 && (
            <IconButton
              icon={Trash2}
              label="Delete"
              size="icon-sm"
              className="text-danger-500 hover:bg-danger-50"
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(record); }}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {summary && (
        <StatGrid columns={4}>
          <StatCard label="Total Zakat" value={summary.totalZakat} icon={HandCoins} variant="gold" compact />
          <StatCard label="Paid" value={summary.totalPaid} icon={CheckCircle2} variant="green" compact />
          <StatCard label="Still to pay" value={summary.outstanding} icon={AlertTriangle} variant="red" compact />
          <StatCard
            label="Calculations"
            value={records.length}
            icon={History}
            variant="navy"
            isCurrency={false}
          />
        </StatGrid>
      )}

      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        pageSize={20}
        exportFilename="zakat-history"
        printable
        title="Zakat history"
        emptyState={
          <EmptyState
            icon={History}
            title="No calculations yet"
            message="Saved Zakat calculations will appear here, with what has been paid against each."
          />
        }
      />

      <ZakatDetailModal record={viewing} onClose={() => setViewing(null)} />

      <RecordZakatPaymentModal
        record={payTarget}
        onClose={() => setPayTarget(null)}
        onSuccess={() => { setPayTarget(null); load(); }}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete this calculation?"
        message="The record will be removed permanently. Calculations with a payment against them cannot be deleted."
        confirmText="Delete"
      />
    </div>
  );
}

/**
 * A past Zakat calculation, in full.
 *
 * The history table can only show a few columns, but the figure that matters -
 * why this much Zakat was due - lives in the assets, the liabilities and the
 * nisab it was measured against. Those are what someone checks a year later
 * when asked how the number was reached.
 */
function ZakatDetailModal({ record, onClose }) {
  if (!record) return null;

  const rows = [
    { label: 'Zakat year', value: record.zakatYear },
    { label: 'Calculated on', value: formatDate(record.calculationDate) },
    { label: 'Applies to', value: record.partnerName || record.ownershipType },
    { label: 'Net zakatable assets', value: formatCurrency(record.netAssets), money: true },
    { label: 'Nisab threshold', value: formatCurrency(record.nisab), money: true },
    { label: 'Zakat due', value: formatCurrency(record.zakatAmount), money: true, strong: true },
    { label: 'Paid so far', value: formatCurrency(record.amountPaid), money: true },
    {
      label: 'Still to pay',
      value: formatCurrency(Math.max(0, (record.zakatAmount || 0) - (record.amountPaid || 0))),
      money: true,
    },
    { label: 'Paid to', value: record.paidTo },
  ].filter((r) => r.value !== undefined && r.value !== null && r.value !== '');

  return (
    <Modal
      isOpen={Boolean(record)}
      onClose={onClose}
      title={`Zakat ${record.zakatYear || ''}`.trim()}
      subtitle={record.partnerName || record.ownershipType}
      icon={HandCoins}
      size="md"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </ModalFooter>
      }
    >
      <dl className="divide-y divide-ink-100">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 py-2">
            <dt className="text-xs text-ink-500">{row.label}</dt>
            <dd
              className={cn(
                'text-sm text-ink-900 text-right',
                row.money && 'tabular',
                row.strong && 'font-semibold text-ink-950'
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      {record.netAssets < record.nisab && (
        <p className="mt-3 rounded-md bg-warning-50 border border-warning-200 p-2.5 text-2xs text-warning-800">
          Net assets were below the nisab threshold, so no Zakat was due for this period.
        </p>
      )}
    </Modal>
  );
}

function RecordZakatPaymentModal({ record, onClose, onSuccess }) {
  const toast = useToastStore();
  const [form, setForm] = useState({ amountPaid: '', paidTo: '', paidAt: toDateInput(new Date()) });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (record) {
      setForm({
        amountPaid: String(record.zakatAmount - record.amountPaid),
        paidTo: record.paidTo || '',
        paidAt: toDateInput(new Date()),
      });
    }
  }, [record]);

  if (!record) return null;

  const handleSubmit = async (event) => {
    event?.preventDefault();
    setSaving(true);
    try {
      // The API stores the cumulative total paid, not this instalment
      await zakatService.recordPayment(record._id, {
        amountPaid: record.amountPaid + parseNumber(form.amountPaid),
        paidTo: form.paidTo,
        paidAt: form.paidAt,
      });
      toast.success('Zakat payment recorded.');
      onSuccess?.();
    } catch (error) {
      toast.apiError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(record)}
      onClose={onClose}
      title="Record a Zakat payment"
      subtitle={`${record.zakatYear} · ${record.ownershipType === 'owner' ? 'Owner' : record.partnerName}`}
      icon={HandCoins}
      size="sm"
      footer={
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="gold" icon={Save} onClick={handleSubmit} isLoading={saving}>
            Record payment
          </Button>
        </ModalFooter>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-navy-50 border border-navy-100 p-3 text-center">
          {[
            { label: 'Zakat due', value: record.zakatAmount },
            { label: 'Already paid', value: record.amountPaid, tone: 'text-success-700' },
            { label: 'Remaining', value: record.zakatAmount - record.amountPaid, tone: 'text-danger-600' },
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
          label="Amount paid now"
          required
          autoFocus
          value={form.amountPaid}
          onChange={(e) => setForm({ ...form, amountPaid: e.target.value })}
        />

        <FormRow cols={2}>
          <Input
            label="Paid to"
            value={form.paidTo}
            onChange={(e) => setForm({ ...form, paidTo: e.target.value })}
            placeholder="Recipient or charity"
          />
          <Input
            label="Date"
            type="date"
            value={form.paidAt}
            onChange={(e) => setForm({ ...form, paidAt: e.target.value })}
            max={toDateInput(new Date())}
          />
        </FormRow>

        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}

/* ============================================================================
 * Settings
 * ========================================================================== */

function ZakatSettings({ settings, reference, hawl, canEdit, onSaved }) {
  const toast = useToastStore();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(settings); }, [settings]);

  // Live nisab preview from the entered metal rate
  const preview = useMemo(
    () =>
      calculateNisab({
        basis: form.nisabBasis,
        goldRatePerGram: form.goldRatePerGram,
        silverRatePerGram: form.silverRatePerGram,
        manualNisab: form.nisab,
      }),
    [form.nisabBasis, form.goldRatePerGram, form.silverRatePerGram, form.nisab]
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await zakatService.updateSettings({
        rate: form.rate,
        nisabBasis: form.nisabBasis,
        nisab: form.nisab,
        goldRatePerGram: form.goldRatePerGram,
        silverRatePerGram: form.silverRatePerGram,
        nisabReference: form.nisabReference,
        hawlStartDate: form.hawlStartDate || null,
        calculationNotes: form.calculationNotes,
        eligibleAssets: form.eligibleAssets,
        eligibleDeductions: form.eligibleDeductions,
      });
      toast.success('Zakat settings saved.');
      onSaved?.();
    } catch (error) {
      toast.apiError(error);
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <div className="card p-5">
        <EmptyState
          icon={SettingsIcon}
          title="Administrator only"
          message="Zakat settings — the rate, the Nisab basis and which assets count — can only be changed by an administrator."
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 card p-4 sm:p-5 space-y-5">
        <FormSection
          title="Nisab threshold"
          icon={Scale}
          description="The level of wealth at which Zakat becomes due"
        >
          <RadioCards
            label="Basis"
            options={NISAB_BASIS_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
              hint: o.hint,
              icon: o.value === 'gold' ? Coins : o.value === 'silver' ? Coins : Calculator,
            }))}
            value={form.nisabBasis}
            onChange={(value) => setForm({ ...form, nisabBasis: value })}
            columns={3}
          />

          {form.nisabBasis === 'silver' && (
            <CurrencyInput
              label="Silver rate per gram"
              value={form.silverRatePerGram}
              onChange={(e) => setForm({ ...form, silverRatePerGram: parseNumber(e.target.value) })}
              hint={`Threshold = ${NISAB_WEIGHTS.SILVER_GRAMS} g × your rate`}
              showPreview={false}
            />
          )}

          {form.nisabBasis === 'gold' && (
            <CurrencyInput
              label="Gold rate per gram"
              value={form.goldRatePerGram}
              onChange={(e) => setForm({ ...form, goldRatePerGram: parseNumber(e.target.value) })}
              hint={`Threshold = ${NISAB_WEIGHTS.GOLD_GRAMS} g × your rate`}
              showPreview={false}
            />
          )}

          {form.nisabBasis === 'manual' && (
            <CurrencyInput
              label="Nisab threshold"
              value={form.nisab}
              onChange={(e) => setForm({ ...form, nisab: parseNumber(e.target.value) })}
              hint="Enter the rupee figure directly"
              showPreview={false}
            />
          )}

          <Input
            label="Where this rate came from"
            value={form.nisabReference || ''}
            onChange={(e) => setForm({ ...form, nisabReference: e.target.value })}
            placeholder="e.g. Mardan sarafa bazaar rate, 16 Sep 2026"
            hint="Worth recording — metal rates move, and this is the audit trail"
          />
        </FormSection>

        <FormSection title="Rate and hawl" icon={Calculator}>
          <FormRow cols={2}>
            <Input
              label="Zakat rate"
              type="number"
              step="0.001"
              min={0}
              max={1}
              value={form.rate}
              onChange={(e) => setForm({ ...form, rate: parseNumber(e.target.value) })}
              suffix={`${(form.rate * 100).toFixed(2)}%`}
              hint="2.5% (0.025) is the standard rate — one fortieth"
            />
            <Input
              label="Hawl start date"
              type="date"
              value={toDateInput(form.hawlStartDate)}
              onChange={(e) => setForm({ ...form, hawlStartDate: e.target.value })}
              hint="Zakat falls due one lunar year (354 days) later"
            />
          </FormRow>

          {hawl?.dueDate && (
            <p className="text-2xs text-navy-600">
              At the current setting, Zakat next falls due on{' '}
              <strong className="text-navy-900">{formatDate(hawl.dueDate)}</strong>.
            </p>
          )}
        </FormSection>

        <FormSection
          title="What counts"
          icon={Package}
          description="Asset classes included in the zakatable total"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { key: 'stock', label: 'Trade stock', hint: 'Goods held for resale' },
              { key: 'receivables', label: 'Receivables', hint: 'Money owed by customers' },
              { key: 'cash', label: 'Cash in hand', hint: '' },
              { key: 'bankBalance', label: 'Bank balances', hint: '' },
              { key: 'otherAssets', label: 'Other assets', hint: 'Gold, silver, trade investments' },
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-start gap-2.5 rounded-lg border border-navy-200 p-2.5 cursor-pointer hover:bg-navy-50 transition-colors"
              >
                <input
                  type="checkbox"
                  className="checkbox mt-0.5"
                  checked={form.eligibleAssets?.[item.key] ?? true}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      eligibleAssets: { ...form.eligibleAssets, [item.key]: e.target.checked },
                    })
                  }
                />
                <span className="min-w-0">
                  <span className="block text-sm text-navy-800">{item.label}</span>
                  {item.hint && <span className="block text-2xs text-navy-500">{item.hint}</span>}
                </span>
              </label>
            ))}
          </div>

          <p className="text-2xs font-semibold uppercase tracking-widest text-navy-400 mt-4 mb-2">
            Deductible liabilities
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { key: 'supplierPayables', label: 'Supplier payables', hint: 'What you owe suppliers' },
              { key: 'otherLiabilities', label: 'Other liabilities', hint: 'Debts due within a month' },
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-start gap-2.5 rounded-lg border border-navy-200 p-2.5 cursor-pointer hover:bg-navy-50 transition-colors"
              >
                <input
                  type="checkbox"
                  className="checkbox mt-0.5"
                  checked={form.eligibleDeductions?.[item.key] ?? true}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      eligibleDeductions: { ...form.eligibleDeductions, [item.key]: e.target.checked },
                    })
                  }
                />
                <span className="min-w-0">
                  <span className="block text-sm text-navy-800">{item.label}</span>
                  <span className="block text-2xs text-navy-500">{item.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </FormSection>

        <Textarea
          label="Notes"
          value={form.calculationNotes || ''}
          onChange={(e) => setForm({ ...form, calculationNotes: e.target.value })}
          rows={3}
          placeholder="Any guidance from your scholar that should be remembered"
          maxLength={1000}
        />

        <Button variant="gold" icon={Save} onClick={handleSave} isLoading={saving} loadingText="Saving…">
          Save Zakat settings
        </Button>
      </div>

      {/* ---- Reference panel ---- */}
      <aside className="space-y-4">
        <div className="card overflow-hidden lg:sticky lg:top-20">
          <div className="px-4 py-4 bg-navy-950 text-center">
            <p className="text-2xs font-bold uppercase tracking-widest text-navy-400">
              Nisab threshold
            </p>
            <p className="text-2xl font-display font-bold text-gold-500 tabular mt-1">
              {formatCurrency(preview.nisab)}
            </p>
            <p className="text-2xs text-navy-400 mt-1 leading-snug px-2">{preview.explanation}</p>
          </div>

          <div className="p-4 space-y-3">
            <p className="text-2xs font-semibold uppercase tracking-widest text-navy-400">
              Shariah reference
            </p>

            <dl className="space-y-2">
              {[
                { label: 'Rate', value: '2.5% (1/40) of net zakatable wealth' },
                { label: 'Gold nisab', value: `${NISAB_WEIGHTS.GOLD_GRAMS} g (7.5 tola)` },
                { label: 'Silver nisab', value: `${NISAB_WEIGHTS.SILVER_GRAMS} g (52.5 tola)` },
                { label: 'Hawl', value: 'One lunar year, about 354 days' },
              ].map((item) => (
                <div key={item.label} className="flex justify-between gap-3 text-xs">
                  <dt className="text-navy-500 flex-shrink-0">{item.label}</dt>
                  <dd className="text-navy-900 font-medium text-right">{item.value}</dd>
                </div>
              ))}
            </dl>

            <div className="rounded-lg bg-gold-50 border border-gold-200 p-3">
              <p className="text-2xs text-navy-700 leading-relaxed">
                <strong>Which threshold applies?</strong> Where wealth is a mixture of asset types —
                which a trading business always is — the lower <strong>silver</strong> nisab is used.
                Use the gold nisab only where wealth is held in gold alone.
              </p>
            </div>

            <div className="rounded-lg bg-navy-50 border border-navy-200 p-3">
              <p className="text-2xs text-navy-700 leading-relaxed">
                <strong>What is zakatable?</strong> Trade stock at market value, cash, bank balances
                and recoverable receivables. Fixed assets used to run the shop are exempt.
              </p>
            </div>

            <p className="text-2xs text-navy-400 leading-relaxed">
              These settings implement the standard position. Where your circumstances are unusual,
              confirm the treatment with a scholar you trust.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
