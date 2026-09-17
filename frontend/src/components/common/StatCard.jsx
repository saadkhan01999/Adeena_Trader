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

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn, formatCurrency, formatCompact, parseNumber } from '../../utils/index.js';

const variants = {
  navy: { icon: 'bg-navy-950 text-gold-500', accent: 'bg-navy-950', ring: 'hover:border-navy-300' },
  gold: { icon: 'bg-gold-500 text-navy-950', accent: 'bg-gold-500', ring: 'hover:border-gold-300' },
  green: { icon: 'bg-success-600 text-white', accent: 'bg-success-600', ring: 'hover:border-success-200' },
  red: { icon: 'bg-danger-600 text-white', accent: 'bg-danger-600', ring: 'hover:border-danger-200' },
  blue: { icon: 'bg-info-600 text-white', accent: 'bg-info-600', ring: 'hover:border-info-200' },
  amber: { icon: 'bg-warning-500 text-navy-950', accent: 'bg-warning-500', ring: 'hover:border-warning-200' },
  slate: { icon: 'bg-navy-100 text-navy-600', accent: 'bg-navy-300', ring: 'hover:border-navy-300' },
};

/**
 * @param {object} props
 * @param {string} props.label
 * @param {number|string} props.value
 * @param {React.ElementType} [props.icon]
 * @param {keyof typeof variants} [props.variant='navy']
 * @param {boolean} [props.isCurrency=true]
 * @param {boolean} [props.compact] Abbreviate large figures (12.5L).
 * @param {number}  [props.trend]   Percentage change vs the previous period.
 * @param {string}  [props.subtitle]
 * @param {Function}[props.onClick] Makes the whole tile a button.
 */
export default function StatCard({
  label,
  value,
  icon: Icon,
  variant = 'navy',
  isCurrency = true,
  compact = false,
  trend,
  trendLabel = 'vs last period',
  subtitle,
  onClick,
  loading = false,
  className,
}) {
  const colors = variants[variant] || variants.navy;
  const numeric = parseNumber(value);

  const display = isCurrency
    ? compact
      ? `Rs. ${formatCompact(numeric)}`
      : formatCurrency(numeric)
    : compact
      ? formatCompact(numeric)
      : typeof value === 'number'
        ? value.toLocaleString('en-PK')
        : value;

  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;

  if (loading) {
    return (
      <div className={cn('stat-card', className)}>
        <div className="space-y-2.5">
          <div className="skeleton h-3 w-2/3" />
          <div className="skeleton h-7 w-3/4" />
          <div className="skeleton h-3 w-1/2" />
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
        'stat-card group text-left w-full',
        onClick && 'cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]',
        colors.ring,
        className
      )}
    >
      {/* A 3px accent stripe gives each tile an identity without adding colour
          to the card body, which would make a row of eight tiles noisy. */}
      <span className={cn('absolute left-0 top-0 bottom-0 w-[3px]', colors.accent)} aria-hidden="true" />

      {/* The icon is positioned rather than placed in the flow, so the amount
          gets the tile's full width. Sharing a row with a 40px icon forces
          "Rs. 40,000" onto two lines at phone width. */}
      {Icon && (
        <span
          className={cn(
            'absolute top-3.5 right-3.5 sm:top-4 sm:right-4 flex items-center justify-center rounded-lg',
            'w-9 h-9 sm:w-10 sm:h-10',
            'transition-transform duration-300 ease-out-expo group-hover:scale-105',
            colors.icon
          )}
          aria-hidden="true"
        >
          <Icon size={18} />
        </span>
      )}

      <div className="pl-1.5">
        <div className="min-w-0">
          {/* Wraps to two lines rather than truncating: a KPI whose label reads
              "TODAY'S…" tells the reader nothing. The right padding keeps it
              clear of the icon. */}
          <p className={cn('stat-label line-clamp-2 leading-tight', Icon && 'pr-11')} title={label}>
            {label}
          </p>

          <p className="stat-value leading-tight break-words" title={isCurrency ? formatCurrency(numeric) : String(value)}>
            {display}
          </p>

          {subtitle && (
            <p className="text-xs text-navy-500 mt-1 truncate" title={subtitle}>{subtitle}</p>
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
