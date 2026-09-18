/**
 * ============================================
 * Calculator
 * ============================================
 * The full-screen version of the counter calculator: installment plans,
 * pricing and margin, and a Zakat quick check.
 *
 * Everything recalculates as you type — a customer asking "and if I pay 40,000
 * down?" should get an answer while they are still speaking.
 *
 * The arithmetic comes from the shared financial engine, so a quote given here
 * matches to the rupee what the sale will record.
 */

import { useState, useMemo } from 'react';
import {
  Calculator, TrendingUp, Scale, Copy, Check, Share2, RotateCcw,
  Percent, CalendarClock, Banknote, HandCoins,
} from 'lucide-react';

import PageHeader from '../../components/common/PageHeader.jsx';
import TabGuide from '../../components/common/TabGuide.jsx';
import Button, { IconButton } from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Tabs from '../../components/common/Tabs.jsx';
import {
  Input, CurrencyInput, RadioCards, FormRow, FormSection,
} from '../../components/common/Form.jsx';

import { useSettingsStore } from '../../context/settingsStore.js';
import { useToastStore } from '../../context/toastStore.js';
import {
  calculateInstallment, generateInstallmentSchedule, calculateProfit,
  calculateMarkup, calculateZakat, calculateNisab,
} from '../../utils/financialEngine.js';
import { cn, formatCurrency, formatDate, copyToClipboard, parseNumber } from '../../utils/index.js';
import { INSTALLMENT_PLANS, NISAB_WEIGHTS } from '../../constants/index.js';

export default function CalculatorPage() {
  const [tab, setTab] = useState('installment');

  return (
    <div className="space-y-5">
      <TabGuide id="calculator" />

      <PageHeader
        title="Calculator"
        subtitle="Quote a plan, check a margin, or test a Zakat figure"
        icon={Calculator}
      />

      <Tabs
        tabs={[
          { id: 'installment', label: 'Installment plan', icon: CalendarClock },
          { id: 'pricing', label: 'Pricing & profit', icon: TrendingUp },
          { id: 'zakat', label: 'Zakat check', icon: Scale },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'installment' && <InstallmentCalculator />}
      {tab === 'pricing' && <PricingCalculator />}
      {tab === 'zakat' && <ZakatCalculator />}
    </div>
  );
}

/* ============================================================================
 * Installment plan
 * ========================================================================== */

function InstallmentCalculator() {
  const toast = useToastStore();
  const settings = useSettingsStore((s) => s.settings);

  const [price, setPrice] = useState('');
  const [advance, setAdvance] = useState('');
  const [plan, setPlan] = useState(settings?.installment?.defaultPlan || 6);
  const [copied, setCopied] = useState(false);

  const breakdown = useMemo(() => calculateInstallment(price, advance, plan), [price, advance, plan]);

  const schedule = useMemo(() => {
    if (breakdown.remaining <= 0) return [];
    return generateInstallmentSchedule(new Date(), plan, breakdown.remaining);
  }, [breakdown.remaining, plan]);

  const quote = useMemo(() => {
    if (breakdown.totalPrice <= 0) return '';
    return [
      'Installment plan',
      `Total price: ${formatCurrency(breakdown.totalPrice)}`,
      `Advance: ${formatCurrency(breakdown.advance)}`,
      `Balance: ${formatCurrency(breakdown.remaining)}`,
      `${breakdown.planMonths} monthly payments of ${formatCurrency(breakdown.monthlyInstallment)}`,
      schedule.length ? `First due: ${formatDate(schedule[0].dueDate)}` : '',
      'No interest — the price is fixed today.',
    ].filter(Boolean).join('\n');
  }, [breakdown, schedule]);

  const handleCopy = async () => {
    const ok = await copyToClipboard(quote);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1800); }
    else toast.error('Could not copy the quote.');
  };

  const reset = () => { setPrice(''); setAdvance(''); setPlan(settings?.installment?.defaultPlan || 6); };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-3 card p-4 sm:p-5 space-y-5">
        <FormSection title="The deal" icon={Banknote}>
          <FormRow cols={2}>
            <CurrencyInput
              label="Total price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="135000"
              autoFocus
            />
            <CurrencyInput
              label="Advance today"
              value={advance}
              onChange={(e) => setAdvance(e.target.value)}
              placeholder="30000"
              hint={breakdown.totalPrice > 0 ? `${breakdown.advancePercent}% of the price` : undefined}
            />
          </FormRow>

          <RadioCards
            label="Plan"
            options={INSTALLMENT_PLANS.map((p) => ({ value: p.value, label: p.label, hint: p.hint }))}
            value={plan}
            onChange={(value) => setPlan(Number(value))}
            columns={2}
          />

          {/* Quick advance amounts, since customers think in round figures */}
          {breakdown.totalPrice > 0 && (
            <div className="flex flex-wrap gap-2">
              {[10, 20, 30, 40, 50].map((percent) => {
                const amount = Math.round((breakdown.totalPrice * percent) / 100);
                return (
                  <button
                    key={percent}
                    type="button"
                    onClick={() => setAdvance(String(amount))}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg border text-2xs font-medium transition-all active:scale-95',
                      breakdown.advance === amount
                        ? 'border-gold-500 bg-gold-50 text-navy-950'
                        : 'border-navy-200 text-navy-600 hover:border-navy-300 hover:bg-navy-50'
                    )}
                  >
                    {percent}% down
                    <span className="block text-navy-400 tabular">{formatCurrency(amount)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </FormSection>

        {schedule.length > 0 && (
          <FormSection title="Payment schedule" icon={CalendarClock}>
            <div className="rounded-lg border border-navy-200 overflow-hidden">
              <ul className="divide-y divide-navy-100 max-h-72 overflow-y-auto scrollbar-thin">
                {schedule.map((installment) => (
                  <li
                    key={installment.number}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-navy-50 transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-navy-950 text-gold-500 text-2xs font-bold">
                        {installment.number}
                      </span>
                      <span className="text-navy-700 tabular">{formatDate(installment.dueDate)}</span>
                    </span>
                    <span className="font-semibold text-navy-950 tabular">
                      {formatCurrency(installment.expected)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between gap-3 px-3 py-2 bg-navy-50 text-sm font-semibold">
                <span className="text-navy-700">Total of {schedule.length} payments</span>
                <span className="text-navy-950 tabular">
                  {formatCurrency(schedule.reduce((s, i) => s + i.expected, 0))}
                </span>
              </div>
            </div>

            <p className="text-2xs text-navy-500 leading-relaxed">
              The final payment absorbs any rounding, so the schedule always adds up exactly to the
              financed amount.
            </p>
          </FormSection>
        )}
      </div>

      {/* ---- Result ---- */}
      <aside className="lg:col-span-2">
        <div className="lg:sticky lg:top-20 card overflow-hidden">
          <div className="px-5 py-6 text-center bg-gold-500">
            <p className="text-2xs font-bold uppercase tracking-widest text-navy-950/70">
              Monthly payment
            </p>
            <p className="text-4xl font-display font-bold text-navy-950 tabular mt-1">
              {formatCurrency(breakdown.monthlyInstallment)}
            </p>
            <p className="text-xs text-navy-950/70 mt-1">
              for {breakdown.planMonths} months · no interest
            </p>
          </div>

          <dl className="divide-y divide-navy-100">
            {[
              { label: 'Total price', value: breakdown.totalPrice },
              { label: 'Advance today', value: breakdown.advance },
              { label: 'Balance financed', value: breakdown.remaining },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <dt className="text-sm text-navy-600">{item.label}</dt>
                <dd className="text-sm font-semibold text-navy-950 tabular">
                  {formatCurrency(item.value)}
                </dd>
              </div>
            ))}
          </dl>

          <div className="p-4 flex gap-2">
            <Button variant="ghost" icon={RotateCcw} onClick={reset}>Clear</Button>
            <Button
              variant="gold"
              icon={copied ? Check : Copy}
              onClick={handleCopy}
              disabled={!quote}
              className="flex-1"
            >
              {copied ? 'Copied' : 'Copy quote'}
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ============================================================================
 * Pricing & profit
 * ========================================================================== */

function PricingCalculator() {
  const settings = useSettingsStore((s) => s.settings);

  const [cost, setCost] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [markup, setMarkup] = useState(settings?.product?.defaultInstallmentMarkupPercent ?? 20);

  const profit = useMemo(
    () => (cost && sellingPrice ? calculateProfit(cost, sellingPrice, quantity) : null),
    [cost, sellingPrice, quantity]
  );

  const suggested = useMemo(() => calculateMarkup(cost, markup), [cost, markup]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-3 card p-4 sm:p-5 space-y-5">
        <FormSection title="Cost and price" icon={Banknote}>
          <FormRow cols={3}>
            <CurrencyInput
              label="Purchase cost"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="100000"
              autoFocus
              showPreview={false}
            />
            <CurrencyInput
              label="Selling price"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              placeholder="120000"
              showPreview={false}
            />
            <Input
              label="Quantity"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseNumber(e.target.value)))}
            />
          </FormRow>
        </FormSection>

        <FormSection
          title="Suggest a price"
          icon={Percent}
          description="Apply a markup to the cost"
        >
          <div className="flex items-end gap-3">
            <Input
              label="Markup"
              type="number"
              min={0}
              max={200}
              value={markup}
              onChange={(e) => setMarkup(parseNumber(e.target.value))}
              suffix="%"
              className="max-w-[120px]"
            />

            <div className="flex-1 min-w-0 pb-1">
              <p className="text-2xs text-navy-500">Suggested selling price</p>
              <p className="text-xl font-display font-bold text-navy-950 tabular">
                {formatCurrency(suggested.sellingPrice)}
              </p>
            </div>

            <Button
              variant="secondary"
              onClick={() => setSellingPrice(String(suggested.sellingPrice))}
              disabled={!cost}
              className="mb-1"
            >
              Use this
            </Button>
          </div>

          {/* Common markups, so the usual cases are one tap */}
          <div className="flex flex-wrap gap-2">
            {[10, 15, 20, 25, 30, 40].map((percent) => (
              <button
                key={percent}
                type="button"
                onClick={() => setMarkup(percent)}
                className={cn(
                  'px-2.5 py-1 rounded-lg border text-2xs font-medium transition-all active:scale-95',
                  markup === percent
                    ? 'border-gold-500 bg-gold-50 text-navy-950'
                    : 'border-navy-200 text-navy-600 hover:border-navy-300 hover:bg-navy-50'
                )}
              >
                {percent}%
              </button>
            ))}
          </div>

          <p className="text-2xs text-navy-500 leading-relaxed">
            Selling on installments ties up capital and carries collection risk, which is why the
            installment price is normally higher than the cash price.
          </p>
        </FormSection>
      </div>

      <aside className="lg:col-span-2">
        <div className="lg:sticky lg:top-20 card overflow-hidden">
          <div
            className={cn(
              'px-5 py-6 text-center',
              !profit ? 'bg-navy-950' : profit.profit >= 0 ? 'bg-success-600' : 'bg-danger-600'
            )}
          >
            <p className="text-2xs font-bold uppercase tracking-widest text-white/70">
              {!profit ? 'Profit' : profit.profit >= 0 ? 'Profit' : 'Loss'}
            </p>
            <p className="text-4xl font-display font-bold text-white tabular mt-1">
              {formatCurrency(Math.abs(profit?.profit || 0))}
            </p>
            {quantity > 1 && profit && (
              <p className="text-xs text-white/70 mt-1">on {quantity} units</p>
            )}
          </div>

          {profit && (
            <>
              <dl className="divide-y divide-navy-100">
                {[
                  { label: 'Total cost', value: profit.totalCost },
                  { label: 'Total revenue', value: profit.totalRevenue },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <dt className="text-sm text-navy-600">{item.label}</dt>
                    <dd className="text-sm font-semibold text-navy-950 tabular">
                      {formatCurrency(item.value)}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="grid grid-cols-2 divide-x divide-navy-100 border-t border-navy-100">
                <div className="px-3 py-3 text-center">
                  <p className="text-2xs text-navy-500">Markup on cost</p>
                  <p className="text-base font-semibold text-navy-950 tabular mt-0.5">
                    {profit.profitPercentage.toFixed(1)}%
                  </p>
                </div>
                <div className="px-3 py-3 text-center">
                  <p className="text-2xs text-navy-500">Margin on sale</p>
                  <p className="text-base font-semibold text-navy-950 tabular mt-0.5">
                    {profit.marginPercentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            </>
          )}

          {!profit && (
            <p className="px-4 py-6 text-center text-sm text-navy-400">
              Enter a cost and a selling price to see the margin.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

/* ============================================================================
 * Zakat check
 * ========================================================================== */

/**
 * A scratchpad for testing a Zakat figure. Nothing is saved — the Zakat screen
 * is where a calculation is recorded against the business.
 */
function ZakatCalculator() {
  const [basis, setBasis] = useState('silver');
  const [rate, setRate] = useState('');
  const [assets, setAssets] = useState({ stock: '', receivables: '', cash: '', bank: '', gold: '' });
  const [liabilities, setLiabilities] = useState('');

  const nisab = useMemo(
    () =>
      calculateNisab({
        basis,
        goldRatePerGram: basis === 'gold' ? rate : 0,
        silverRatePerGram: basis === 'silver' ? rate : 0,
      }),
    [basis, rate]
  );

  const result = useMemo(
    () =>
      calculateZakat({
        eligibleStock: assets.stock,
        receivables: assets.receivables,
        cash: assets.cash,
        bankBalance: assets.bank,
        otherAssets: assets.gold,
        otherLiabilities: liabilities,
        nisab: nisab.nisab,
        rate: 0.025,
      }),
    [assets, liabilities, nisab.nisab]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-3 card p-4 sm:p-5 space-y-5">
        <div className="flex items-start gap-2.5 rounded-lg bg-gold-50 border border-gold-200 p-3">
          <Scale size={15} className="text-gold-600 flex-shrink-0 mt-0.5" />
          <p className="text-2xs text-navy-700 leading-relaxed">
            A scratchpad for checking a figure. To record a Zakat calculation against the business —
            with your live stock, receivables and payables — use the Zakat screen.
          </p>
        </div>

        <FormSection title="Nisab" icon={Scale}>
          <RadioCards
            label="Basis"
            options={[
              {
                value: 'silver',
                label: `Silver (${NISAB_WEIGHTS.SILVER_GRAMS} g)`,
                hint: 'Applies where wealth is a mixture of asset types',
              },
              {
                value: 'gold',
                label: `Gold (${NISAB_WEIGHTS.GOLD_GRAMS} g)`,
                hint: 'Where wealth is held in gold alone',
              },
            ]}
            value={basis}
            onChange={setBasis}
            columns={2}
          />

          <CurrencyInput
            label={`${basis === 'gold' ? 'Gold' : 'Silver'} rate per gram`}
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            hint={nisab.explanation}
            showPreview={false}
          />
        </FormSection>

        <FormSection title="Zakatable assets" icon={HandCoins}>
          <FormRow cols={2}>
            <CurrencyInput
              label="Trade stock"
              value={assets.stock}
              onChange={(e) => setAssets({ ...assets, stock: e.target.value })}
              showPreview={false}
              hint="At current market value"
            />
            <CurrencyInput
              label="Receivables"
              value={assets.receivables}
              onChange={(e) => setAssets({ ...assets, receivables: e.target.value })}
              showPreview={false}
              hint="Money you expect to collect"
            />
          </FormRow>

          <FormRow cols={2}>
            <CurrencyInput
              label="Cash in hand"
              value={assets.cash}
              onChange={(e) => setAssets({ ...assets, cash: e.target.value })}
              showPreview={false}
            />
            <CurrencyInput
              label="Bank balance"
              value={assets.bank}
              onChange={(e) => setAssets({ ...assets, bank: e.target.value })}
              showPreview={false}
            />
          </FormRow>

          <FormRow cols={2}>
            <CurrencyInput
              label="Gold, silver & investments"
              value={assets.gold}
              onChange={(e) => setAssets({ ...assets, gold: e.target.value })}
              showPreview={false}
            />
            <CurrencyInput
              label="Immediate liabilities"
              value={liabilities}
              onChange={(e) => setLiabilities(e.target.value)}
              showPreview={false}
              hint="Debts due within the coming month"
            />
          </FormRow>

          <p className="text-2xs text-navy-500 leading-relaxed">
            Fixed assets used to run a business — fittings, vehicles, equipment — are exempt.
          </p>
        </FormSection>
      </div>

      <aside className="lg:col-span-2">
        <div className="lg:sticky lg:top-20 card overflow-hidden">
          <div className={cn('px-5 py-6 text-center', result.isAboveNisab ? 'bg-gold-500' : 'bg-navy-950')}>
            <p
              className={cn(
                'text-2xs font-bold uppercase tracking-widest',
                result.isAboveNisab ? 'text-navy-950/70' : 'text-navy-400'
              )}
            >
              Zakat at 2.5%
            </p>
            <p
              className={cn(
                'text-4xl font-display font-bold tabular mt-1',
                result.isAboveNisab ? 'text-navy-950' : 'text-white'
              )}
            >
              {formatCurrency(result.zakatAmount)}
            </p>
            <p className={cn('text-xs mt-1', result.isAboveNisab ? 'text-navy-950/70' : 'text-navy-400')}>
              {result.isAboveNisab
                ? 'Above the Nisab threshold'
                : nisab.nisab > 0
                  ? `${formatCurrency(result.shortfallToNisab)} below the threshold`
                  : 'Enter a metal rate to set the threshold'}
            </p>
          </div>

          <dl className="divide-y divide-navy-100">
            {[
              { label: 'Gross assets', value: result.grossAssets },
              { label: 'Less liabilities', value: result.deductions, negative: true },
              { label: 'Net zakatable wealth', value: result.netAssets, bold: true },
              { label: 'Nisab threshold', value: result.nisab },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <dt className={cn('text-sm', item.bold ? 'font-semibold text-navy-900' : 'text-navy-600')}>
                  {item.label}
                </dt>
                <dd
                  className={cn(
                    'text-sm tabular',
                    item.bold ? 'font-bold text-navy-950' : 'font-medium text-navy-800',
                    item.negative && 'text-danger-600'
                  )}
                >
                  {item.negative && '−'}{formatCurrency(item.value)}
                </dd>
              </div>
            ))}
          </dl>

          <p className="px-4 py-3 text-2xs text-navy-500 leading-relaxed border-t border-navy-100">
            Zakat falls due once a full lunar year (about 354 days) has passed with wealth above the
            threshold.
          </p>
        </div>
      </aside>
    </div>
  );
}
