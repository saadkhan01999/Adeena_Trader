/**
 * ============================================
 * Wallet
 * ============================================
 * Money in and out of the shop by how it moved - the drawer's cash, JazzCash,
 * EasyPaisa, the bank - shown the way a mobile wallet shows a balance per
 * account.
 *
 * Every figure comes from the server (GET /dashboard/wallet): receipts in;
 * expenses, supplier payments, refunds and investor payouts out. Nothing is
 * estimated here.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Wallet, ArrowDownLeft, ArrowUpRight, Banknote, Smartphone, Landmark, CreditCard,
  ScrollText, CircleEllipsis,
} from 'lucide-react';

import { dashboardService } from '../../services/entities.js';
import { PAYMENT_METHODS, paymentMethodLabel } from '../../constants/index.js';
import { Urdu } from '../../components/common/Bilingual.jsx';
import { formatCurrency, formatDate, cn } from '../../utils/index.js';
import { readList, writeList } from '../../utils/listCache.js';

const RANGES = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: '7 days' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
  { id: 'all', label: 'All time' },
];

const ICONS = {
  cash: Banknote,
  jazzcash: Smartphone,
  easypaisa: Smartphone,
  bank: Landmark,
  card: CreditCard,
  cheque: ScrollText,
  other: CircleEllipsis,
};

/**
 * Wallet brands keep their own colours in every theme - staff recognise the
 * JazzCash red and the EasyPaisa green faster than they read the words.
 */
const brand = (method) => PAYMENT_METHODS.find((m) => m.value === method)?.color || '#64748b';

export default function WalletCard({ ownership = 'all' }) {
  const [range, setRange] = useState('today');
  const key = `wallet:${ownership}:${range}`;
  const [data, setData] = useState(() => readList(key)?.records || null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const response = await dashboardService.getWallet(range, ownership);
      setData(response.data);
      setError(null);
      writeList(`wallet:${ownership}:${range}`, { records: response.data });
    } catch (err) {
      setError(err?.message || 'Could not load the wallet.');
    }
  }, [range, ownership]);

  useEffect(() => {
    const cached = readList(`wallet:${ownership}:${range}`)?.records;
    if (cached) setData(cached);
    load();
  }, [load, ownership, range]);

  const methods = (data?.methods || []).filter(
    // Always show the three the shop uses daily; others only once they move.
    (m) => ['cash', 'jazzcash', 'easypaisa'].includes(m.method) || m.in > 0 || m.out > 0
  );
  const totals = data?.totals || { in: 0, out: 0, net: 0 };

  return (
    <section className="card overflow-hidden soft-in">
      {/* ---- Balance header ---- */}
      <div className="relative bg-ink-950 text-white p-4 sm:p-5">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-gold-500/15 blur-2xl" aria-hidden="true" />

        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-accent-button text-on-accent shadow-glow">
              <Wallet size={22} />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-display font-bold text-white">
                Wallet <Urdu className="text-sm text-gold-300 font-normal">بٹوہ</Urdu>
              </h2>
              <p className="text-2xs sm:text-xs text-white/60">Cash, JazzCash, EasyPaisa and bank - in and out</p>
            </div>
          </div>

          <div className="flex gap-1 p-1 rounded-xl bg-white/[0.07] overflow-x-auto scrollbar-none max-w-full">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all',
                  range === r.id ? 'bg-accent-button text-on-accent shadow-xs' : 'text-white/70 hover:text-white'
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative mt-4 grid grid-cols-3 gap-2 sm:gap-4">
          <Figure label="Net balance" value={totals.net} tone={totals.net >= 0 ? 'text-gold-300' : 'text-danger-400'} big />
          <Figure label="Money in" value={totals.in} tone="text-success-400" icon={ArrowDownLeft} />
          <Figure label="Money out" value={totals.out} tone="text-danger-400" icon={ArrowUpRight} />
        </div>
      </div>

      {/* ---- Per-method tiles ---- */}
      {error && !data ? (
        <p className="p-5 text-sm text-danger-600">{error}</p>
      ) : (
        <div className="p-3 sm:p-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
          {(data ? methods : [{ method: 'cash' }, { method: 'jazzcash' }, { method: 'easypaisa' }]).map((m) => {
            const Icon = ICONS[m.method] || CircleEllipsis;
            const color = brand(m.method);
            return (
              <div
                key={m.method}
                className="relative overflow-hidden rounded-xl border border-navy-100 bg-white p-3 sm:p-3.5 transition-all hover:shadow-card-hover hover:-translate-y-0.5"
                style={{ boxShadow: `inset 3px 0 0 ${color}` }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex items-center justify-center w-9 h-9 rounded-lg text-white flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
                  >
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-navy-950 truncate">{paymentMethodLabel(m.method)}</p>
                    <Urdu className="block text-2xs text-navy-500">
                      {PAYMENT_METHODS.find((p) => p.value === m.method)?.labelUr}
                    </Urdu>
                  </div>
                </div>

                {data ? (
                  <>
                    <p className={cn('mt-2.5 text-lg font-display font-extrabold tabular', m.net < 0 ? 'text-danger-600' : 'text-navy-950')}>
                      {formatCurrency(m.net)}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-2xs tabular">
                      <span className="text-success-700 font-semibold">+{formatCurrency(m.in)}</span>
                      <span className="text-danger-600 font-semibold">-{formatCurrency(m.out)}</span>
                    </div>
                  </>
                ) : (
                  <div className="mt-3 space-y-1.5">
                    <div className="skeleton h-5 w-3/4" />
                    <div className="skeleton h-3 w-full" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Latest movements ---- */}
      {data?.recent?.length > 0 && (
        <div className="border-t border-navy-100 px-3 sm:px-4 py-3">
          <p className="text-2xs font-semibold uppercase tracking-wider text-navy-500 mb-2">Latest movements</p>
          <ul className="divide-y divide-navy-100">
            {data.recent.map((item) => (
              <li key={`${item.direction}-${item.id}`} className="flex items-center gap-3 py-2">
                <span
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0',
                    item.direction === 'in' ? 'bg-success-50 text-success-600' : 'bg-danger-50 text-danger-600'
                  )}
                >
                  {item.direction === 'in' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-navy-900 truncate">{item.label}</span>
                  <span className="block text-2xs text-navy-500 truncate">
                    {item.reference} · {paymentMethodLabel(item.method)} · {formatDate(item.date)}
                  </span>
                </span>
                <span
                  className={cn(
                    'text-sm font-bold tabular flex-shrink-0',
                    item.direction === 'in' ? 'text-success-700' : 'text-danger-600'
                  )}
                >
                  {item.direction === 'in' ? '+' : '-'}{formatCurrency(item.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Figure({ label, value, tone, icon: Icon, big }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/[0.05] border border-white/10 px-2.5 sm:px-3.5 py-2.5">
      <p className="flex items-center gap-1 text-[10px] sm:text-2xs uppercase tracking-wider text-white/60 font-semibold truncate">
        {Icon && <Icon size={12} />}
        {label}
      </p>
      <p className={cn('mt-0.5 font-display font-extrabold tabular truncate', big ? 'text-base sm:text-2xl' : 'text-sm sm:text-xl', tone)}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}
