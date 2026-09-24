/**
 * ============================================
 * StatCard
 * ============================================
 * A single KPI tile.
 *
 * Layout rules that keep a row of these readable at every width:
 *   - The value uses the fluid `--fs-metric` scale, so it shrinks on a phone
 *     instead of wrapping mid-number.
 *   - Long labels truncate; long values do not - a truncated amount is worse
 *     than useless, so figures are abbreviated (12.5L) rather than cut off.
 *   - The icon sits in a fixed 40px tile that never shrinks, so tiles in a row
 *     stay optically aligned even when their labels differ in length.
 */

import { TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';
import { cn, formatCurrency, formatCompact, parseNumber } from '../../utils/index.js';
import { Urdu } from './Bilingual.jsx';
import { urduForLabel } from '../../i18n/formLabels.js';

/**
 * Each tile's identity: a solid icon tile, a matching left edge and underline,
 * and a faint tint of the same colour across the card - the look of the shop's
 * reference dashboard. `navy` and `gold` follow the chosen theme; the others
 * are fixed meanings (green is money in, red is overdue...) in every theme.
 */
const variants = {
  navy: {
    icon: 'bg-navy-950 text-gold-400', edge: 'border-l-navy-950', bar: 'bg-gold-500',
    tint: 'to-navy-50/70', border: 'border-navy-200', chevron: 'text-navy-800',
  },
  gold: {
    icon: 'bg-accent-button text-on-accent', edge: 'border-l-gold-500', bar: 'bg-gold-500',
    tint: 'to-gold-50', border: 'border-gold-200', chevron: 'text-gold-600',
  },
  green: {
    icon: 'bg-gradient-to-br from-success-500 to-success-700 text-white', edge: 'border-l-success-600',
    bar: 'bg-success-500', tint: 'to-success-50', border: 'border-success-200', chevron: 'text-success-600',
  },
  red: {
    icon: 'bg-gradient-to-br from-danger-500 to-danger-700 text-white', edge: 'border-l-danger-600',
    bar: 'bg-danger-500', tint: 'to-danger-50', border: 'border-danger-200', chevron: 'text-danger-600',
  },
  blue: {
    icon: 'bg-gradient-to-br from-info-500 to-info-700 text-white', edge: 'border-l-info-600',
    bar: 'bg-info-500', tint: 'to-info-50', border: 'border-info-200', chevron: 'text-info-600',
  },
  amber: {
    icon: 'bg-gradient-to-br from-orange-400 to-orange-600 text-white', edge: 'border-l-orange-500',
    bar: 'bg-orange-500', tint: 'to-orange-50', border: 'border-orange-200', chevron: 'text-orange-500',
  },
  purple: {
    icon: 'bg-gradient-to-br from-violet-500 to-violet-700 text-white', edge: 'border-l-violet-600',
    bar: 'bg-violet-500', tint: 'to-violet-50', border: 'border-violet-200', chevron: 'text-violet-600',
  },
  slate: {
    icon: 'bg-navy-100 text-navy-700', edge: 'border-l-navy-300', bar: 'bg-navy-300',
    tint: 'to-navy-50/60', border: 'border-navy-200', chevron: 'text-navy-500',
  },
};

/** Full figure up to a lakh, abbreviated above it - "Rs. 33,600", "Rs. 13.8L". */
const autoCompact = (n) => Math.abs(n) >= 100_000;

/**
 * @param {object} props
 * @param {string} props.label
 * @param {number|string} props.value
 * @param {React.ElementType} [props.icon]
 * @param {keyof typeof variants} [props.variant='navy']
 * @param {boolean} [props.isCurrency=true]
 * @param {boolean|'auto'} [props.compact='auto'] Abbreviate large figures (12.5L).
 * @param {number}  [props.trend]   Percentage change vs the previous period.
 * @param {string}  [props.subtitle]
 * @param {Function}[props.onClick] Makes the whole tile a button, with a chevron.
 * @param {React.ReactNode} [props.labelUr] Urdu under the label, when Urdu is on.
 */
export default function StatCard({
  label,
  labelUr,
  value,
  icon: Icon,
  variant = 'navy',
  isCurrency = true,
  compact = 'auto',
  trend,
  trendLabel = 'vs last period',
  subtitle,
  onClick,
  loading = false,
  className,
}) {
  const colors = variants[variant] || variants.navy;
  const numeric = parseNumber(value);
  const shorten = compact === 'auto' ? autoCompact(numeric) : compact;

  const display = isCurrency
    ? shorten
      ? `Rs. ${formatCompact(numeric)}`
      : formatCurrency(numeric)
    : shorten
      ? formatCompact(numeric)
      : typeof value === 'number'
        ? value.toLocaleString('en-PK')
        : value;

  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;

  if (loading) {
    return (
      <div className={cn('stat-card border-l-4 border-l-navy-100', className)}>
        <div className="flex items-center gap-3">
          <div className="skeleton w-11 h-11 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-2/3" />
            <div className="skeleton h-6 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'stat-card group text-left w-full border-l-4 bg-gradient-to-br from-white via-white',
        colors.edge, colors.tint, colors.border,
        onClick && 'cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]',
        className
      )}
    >
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        {Icon && (
          <span
            className={cn(
              'flex items-center justify-center rounded-xl flex-shrink-0 shadow-sm',
              'w-9 h-9 sm:w-12 sm:h-12',
              'transition-transform duration-300 ease-out-expo group-hover:scale-105',
              colors.icon
            )}
            aria-hidden="true"
          >
            <Icon className="w-[18px] h-[18px] sm:w-[22px] sm:h-[22px]" strokeWidth={2} />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="stat-label line-clamp-2 leading-tight" title={label}>{label}</p>
          {labelUr ?? <Urdu className="block text-2xs text-navy-500 leading-snug">{urduForLabel(label)}</Urdu>}

          <p
            className="stat-value leading-tight whitespace-nowrap"
            title={isCurrency ? formatCurrency(numeric) : String(value)}
          >
            {display}
          </p>

          <span className={cn('block w-12 sm:w-14 h-[3px] rounded-full mt-1.5', colors.bar)} aria-hidden="true" />

          {subtitle && (
            <p className="text-[11px] sm:text-xs text-navy-500 mt-1.5 truncate" title={subtitle}>{subtitle}</p>
          )}

          {trend !== undefined && trend !== null && (
            <div className="flex items-center gap-1.5 mt-2">
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-2xs font-semibold',
                  trend > 0 && 'bg-success-50 text-success-700',
                  trend < 0 && 'bg-danger-50 text-danger-700',
                  trend === 0 && 'bg-navy-50 text-navy-500'
                )}
              >
                <TrendIcon size={11} />
                {trend > 0 ? '+' : ''}{Math.abs(trend).toFixed(1)}%
              </span>
              <span className="text-2xs text-navy-400 truncate">{trendLabel}</span>
            </div>
          )}
        </div>

        {onClick && (
          <ChevronRight
            size={20}
            className={cn('hidden sm:block flex-shrink-0 transition-transform group-hover:translate-x-0.5', colors.chevron)}
            aria-hidden="true"
          />
        )}
      </div>
    </Wrapper>
  );
}

/**
 * A responsive grid for KPI tiles.
 *
 * Two columns on a phone rather than one: eight stacked tiles would push the
 * charts a full screen down, and the figures are short enough to pair.
 */
export function StatGrid({ children, columns = 4, className }) {
  /**
   * Four columns only from `xl`. At `lg` the sidebar already takes 264px, which
   * leaves each of four tiles under 180px - too narrow for a label and a
   * six-figure amount to sit side by side.
   */
  const columnClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 xl:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-3 2xl:grid-cols-5',
    6: 'grid-cols-2 md:grid-cols-3 2xl:grid-cols-6',
  }[columns] || 'grid-cols-2 xl:grid-cols-4';

  return (
    <div className={cn('grid gap-2.5 sm:gap-3 lg:gap-4', columnClass, className)}>
      {children}
    </div>
  );
}
