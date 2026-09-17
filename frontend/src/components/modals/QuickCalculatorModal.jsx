/**
 * ============================================
 * QuickCalculatorModal
 * ============================================
 * The installment quote a salesman needs at the counter: enter a price and an
 * advance, see the monthly figure and the full schedule immediately.
 *
 * Everything recalculates as you type - there is no "Calculate" button. A
 * customer asking "and if I pay 40,000 down?" should get an answer while they
 * are still speaking.
 *
 * The arithmetic comes from the shared financial engine, so the quote given
 * here is exactly what the sale will record.
 */

import { useState, useMemo, useEffect } from 'react';
import {
  Calculator, Copy, Check, Share2, RotateCcw, TrendingUp, Percent,
} from 'lucide-react';

import Modal, { ModalFooter } from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import { CurrencyInput, RadioCards, Input } from '../common/Form.jsx';
import Badge from '../common/Badge.jsx';
import { useSettingsStore } from '../../context/settingsStore.js';
import { useToastStore } from '../../context/toastStore.js';
import {
  calculateInstallment, generateInstallmentSchedule, calculateProfit, calculateMarkup,
} from '../../utils/financialEngine.js';
import { cn, formatCurrency, formatDate, copyToClipboard, parseNumber } from '../../utils/index.js';
import { INSTALLMENT_PLANS } from '../../constants/index.js';

export default function QuickCalculatorModal({ isOpen, onClose }) {
  const toast = useToastStore();
  const settings = useSettingsStore((s) => s.settings);
  const defaultPlan = settings?.installment?.defaultPlan || 6;

  const [mode, setMode] = useState('installment');
  const [price, setPrice] = useState('');
  const [advance, setAdvance] = useState('');
  const [plan, setPlan] = useState(defaultPlan);
  const [cost, setCost] = useState('');
  const [markup, setMarkup] = useState(settings?.product?.defaultInstallmentMarkupPercent ?? 20);
  const [copied, setCopied] = useState(false);

  // Follow the configured default whenever it changes
  useEffect(() => { setPlan(defaultPlan); }, [defaultPlan]);

  // ---- Installment breakdown, recomputed on every keystroke -------------
  const breakdown = useMemo(
    () => calculateInstallment(price, advance, plan),
    [price, advance, plan]
  );

  const schedule = useMemo(() => {
    if (breakdown.remaining <= 0) return [];
    return generateInstallmentSchedule(new Date(), plan, breakdown.remaining);
  }, [breakdown.remaining, plan]);

  // ---- Profit, when a cost has been entered -----------------------------
  const profit = useMemo(() => {
    if (!cost || !price) return null;
    return calculateProfit(cost, price, 1);
  }, [cost, price]);

  // ---- Suggested installment price from a cash cost ---------------------
  const suggested = useMemo(() => calculateMarkup(cost, markup), [cost, markup]);

  const reset = () => {
    setPrice('');
    setAdvance('');
    setCost('');
    setPlan(defaultPlan);
  };

  /** A quote formatted for pasting into WhatsApp. */
  const quoteText = useMemo(() => {
    if (breakdown.totalPrice <= 0) return '';
    return [
      'Installment plan',
      `Total price: ${formatCurrency(breakdown.totalPrice)}`,
      `Advance: ${formatCurrency(breakdown.advance)}`,
      `Balance: ${formatCurrency(breakdown.remaining)}`,
      `${breakdown.planMonths} monthly installments of ${formatCurrency(breakdown.monthlyInstallment)}`,
      schedule.length > 0 ? `First due: ${formatDate(schedule[0].dueDate)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }, [breakdown, schedule]);

  const handleCopy = async () => {
    const ok = await copyToClipboard(quoteText);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else {
      toast.error('Could not copy the quote.');
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: 'Installment plan', text: quoteText }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  const hasQuote = breakdown.totalPrice > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Installment calculator"
      subtitle="Quote a plan without leaving the screen you are on"
      icon={Calculator}
      size="lg"
      footer={
        <ModalFooter>
          <Button variant="ghost" onClick={reset} icon={RotateCcw}>
            Clear
          </Button>
          <Button variant="secondary" onClick={handleShare} icon={Share2} disabled={!hasQuote}>
            Share
          </Button>
          <Button
            variant="gold"
            onClick={handleCopy}
            icon={copied ? Check : Copy}
            disabled={!hasQuote}
          >
            {copied ? 'Copied' : 'Copy quote'}
          </Button>
        </ModalFooter>
      }
    >
      {/* Mode */}
      <RadioCards
        options={[
          { value: 'installment', label: 'Installment plan', icon: Calculator, hint: 'Monthly figure from price and advance' },
          { value: 'pricing', label: 'Pricing & profit', icon: TrendingUp, hint: 'Markup and margin from cost' },
        ]}
        value={mode}
        onChange={setMode}
        columns={2}
        className="mb-5"
      />

      {mode === 'installment' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CurrencyInput
              label="Total price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="135000"
              autoFocus
            />
            <CurrencyInput
              label="Advance / down payment"
              value={advance}
              onChange={(e) => setAdvance(e.target.value)}
              placeholder="30000"
              hint={
                breakdown.totalPrice > 0
                  ? `${breakdown.advancePercent}% of the total price`
                  : undefined
              }
            />
          </div>

          <RadioCards
            label="Plan"
            options={INSTALLMENT_PLANS.map((p) => ({ value: p.value, label: p.label, hint: p.hint }))}
            value={plan}
            onChange={(value) => setPlan(Number(value))}
            columns={2}
          />

          {/* ---- Result ---- */}
          {hasQuote ? (
            <div className="rounded-xl border border-gold-300 bg-gold-50 overflow-hidden animate-fade-in">
              <div className="px-4 py-4 text-center bg-gold-500">
                <p className="text-2xs font-bold uppercase tracking-widest text-navy-950/70">
                  Monthly installment
                </p>
                <p className="text-3xl sm:text-4xl font-display font-bold text-navy-950 tabular mt-0.5">
                  {formatCurrency(breakdown.monthlyInstallment)}
                </p>
                <p className="text-xs text-navy-950/70 mt-0.5">
                  for {breakdown.planMonths} months
                </p>
              </div>

              <dl className="grid grid-cols-3 divide-x divide-gold-200 bg-white">
                {[
                  { label: 'Total price', value: breakdown.totalPrice },
                  { label: 'Advance', value: breakdown.advance },
                  { label: 'Financed', value: breakdown.remaining },
                ].map((item) => (
                  <div key={item.label} className="px-2 py-2.5 text-center">
                    <dt className="text-2xs text-navy-500 leading-tight">{item.label}</dt>
                    <dd className="text-xs sm:text-sm font-semibold text-navy-950 tabular mt-0.5">
                      {formatCurrency(item.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-navy-200 py-8 text-center">
              <Calculator size={26} className="mx-auto text-navy-200 mb-2" />
              <p className="text-sm text-navy-400">Enter a price to see the monthly figure.</p>
            </div>
          )}

          {/* ---- Schedule ---- */}
          {schedule.length > 0 && (
            <div>
              <p className="text-2xs font-semibold uppercase tracking-widest text-navy-500 mb-2">
                Payment schedule
              </p>

              <div className="rounded-lg border border-navy-200 overflow-hidden">
                <ul className="divide-y divide-navy-100 max-h-56 overflow-y-auto scrollbar-thin">
                  {schedule.map((installment) => (
                    <li
                      key={installment.number}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-navy-50 transition-colors"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-navy-950 text-gold-500 text-2xs font-bold flex-shrink-0">
                          {installment.number}
                        </span>
                        <span className="text-navy-700 truncate">
                          {formatDate(installment.dueDate)}
                        </span>
                      </span>

                      <span className="font-semibold text-navy-950 tabular flex-shrink-0">
                        {formatCurrency(installment.expected)}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* The last installment absorbs the rounding remainder, so the
                    schedule always sums exactly to the financed amount. */}
                <div className="flex items-center justify-between gap-3 px-3 py-2 bg-navy-50 text-sm font-semibold">
                  <span className="text-navy-700">Total of {schedule.length} installments</span>
                  <span className="text-navy-950 tabular">
                    {formatCurrency(schedule.reduce((s, i) => s + i.expected, 0))}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ================= Pricing & profit ================= */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CurrencyInput
              label="Purchase cost"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="100000"
              autoFocus
            />
            <CurrencyInput
              label="Selling price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="120000"
            />
          </div>

          {profit && (
            <div className="rounded-xl border border-navy-200 overflow-hidden animate-fade-in">
              <div
                className={cn(
                  'px-4 py-3.5 text-center',
                  profit.profit >= 0 ? 'bg-success-600' : 'bg-danger-600'
                )}
              >
                <p className="text-2xs font-bold uppercase tracking-widest text-white/80">
                  {profit.profit >= 0 ? 'Profit per unit' : 'Loss per unit'}
                </p>
                <p className="text-3xl font-display font-bold text-white tabular mt-0.5">
                  {formatCurrency(Math.abs(profit.profit))}
                </p>
              </div>

              <dl className="grid grid-cols-2 divide-x divide-navy-100 bg-white">
                <div className="px-3 py-2.5 text-center">
                  <dt className="text-2xs text-navy-500">Markup on cost</dt>
                  <dd className="text-sm font-semibold text-navy-950 tabular mt-0.5">
                    {profit.profitPercentage.toFixed(1)}%
                  </dd>
                </div>
                <div className="px-3 py-2.5 text-center">
                  <dt className="text-2xs text-navy-500">Margin on sale</dt>
                  <dd className="text-sm font-semibold text-navy-950 tabular mt-0.5">
                    {profit.marginPercentage.toFixed(1)}%
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Suggested installment price from the configured markup */}
          <div className="rounded-lg border border-navy-200 bg-navy-50/60 p-3.5">
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <p className="text-xs font-semibold text-navy-800">Suggest an installment price</p>
              <Badge variant="gold" size="sm">from cost</Badge>
            </div>

            <div className="flex items-end gap-3">
              <Input
                label="Markup"
                type="number"
                min={0}
                max={200}
                value={markup}
                onChange={(e) => setMarkup(parseNumber(e.target.value))}
                suffix="%"
                className="max-w-[110px]"
                icon={<Percent size={14} />}
              />

              <div className="flex-1 min-w-0 pb-1">
                <p className="text-2xs text-navy-500">Suggested selling price</p>
                <p className="text-lg font-display font-bold text-navy-950 tabular">
                  {formatCurrency(suggested.sellingPrice)}
                </p>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPrice(String(suggested.sellingPrice))}
                disabled={!cost}
                className="mb-1"
              >
                Use this
              </Button>
            </div>

            <p className="mt-2 text-2xs text-navy-500 leading-relaxed">
              Selling on installments ties up capital and carries collection risk, which is why the
              installment price is normally higher than the cash price.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
