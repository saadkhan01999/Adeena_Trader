/**
 * ============================================
 * ChartCard
 * ============================================
 * The frame every chart sits in: titled header with an icon, an optional
 * headline figure, a toolbar slot, and consistent empty/loading states.
 *
 * Why a wrapper rather than styling each chart
 * -------------------------------------------
 * Recharts renders only the plot. Without a shared frame, each screen invents
 * its own heading size, padding and "no data yet" message, and a dashboard of
 * six charts ends up looking like six different products.
 */

import { cn, formatCurrency, formatCompact } from '../../utils/index.js';

/**
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {React.ElementType} [props.icon]
 * @param {number|string} [props.value]  Headline figure shown beside the title.
 * @param {string} [props.valueLabel]
 * @param {React.ReactNode} [props.toolbar]  Range pickers, type toggles, etc.
 * @param {boolean} [props.isEmpty]
 * @param {string} [props.emptyMessage]
 * @param {'sm'|'md'|'lg'} [props.height='md']
 */
export default function ChartCard({
  title,
  subtitle,
  icon: Icon,
  value,
  valueLabel,
  isCurrency = true,
  toolbar,
  children,
  loading = false,
  isEmpty = false,
  emptyMessage = 'No data for this period yet.',
  emptyIcon: EmptyIcon,
  height = 'md',
  className,
  bodyClassName,
}) {
  // Charts need a fixed pixel height: Recharts' ResponsiveContainer measures
  // its parent, and a percentage height inside a flex column collapses to zero.
  const heights = {
    sm: 'h-[180px] sm:h-[200px]',
    md: 'h-[220px] sm:h-[260px] lg:h-[280px]',
    lg: 'h-[280px] sm:h-[320px] lg:h-[360px]',
    auto: '',
  };

  return (
    <div className={cn('card flex flex-col overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 sm:px-5 pt-4 pb-3">
        <div className="flex items-start gap-2.5 min-w-0">
          {Icon && (
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-navy-950 text-gold-500 flex-shrink-0">
              <Icon size={16} />
            </span>
          )}

          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-display font-semibold text-navy-950 leading-tight truncate">
              {title}
            </h3>
            {subtitle && <p className="text-xs text-navy-500 mt-0.5 truncate">{subtitle}</p>}

            {value !== undefined && value !== null && (
              <p className="mt-1.5 text-lg sm:text-xl font-display font-bold text-navy-950 tabular">
                {isCurrency ? formatCurrency(value) : formatCompact(value)}
                {valueLabel && (
                  <span className="ml-1.5 text-xs font-normal text-navy-500">{valueLabel}</span>
                )}
              </p>
            )}
          </div>
        </div>

        {toolbar && <div className="flex items-center gap-1.5 flex-shrink-0 no-print">{toolbar}</div>}
      </div>

      {/* Body */}
      <div className={cn('flex-1 px-1 sm:px-2 pb-3', bodyClassName)}>
        {loading ? (
          <div className={cn('flex items-end gap-2 px-4 pb-4', heights[height])}>
            {/* A skeleton shaped like a bar chart, so the loading state reads
                as "a chart is coming" rather than as a generic grey block. */}
            {[45, 70, 55, 85, 60, 95, 75].map((pct, i) => (
              <div key={i} className="skeleton flex-1 rounded-t" style={{ height: `${pct}%` }} />
            ))}
          </div>
        ) : isEmpty ? (
          <div className={cn('flex flex-col items-center justify-center text-center px-6', heights[height])}>
            {EmptyIcon && (
              <span className="flex items-center justify-center w-12 h-12 rounded-full bg-navy-50 text-navy-300 mb-3">
                <EmptyIcon size={22} />
              </span>
            )}
            <p className="text-sm text-navy-400 max-w-[240px]">{emptyMessage}</p>
          </div>
        ) : (
          <div className={heights[height]}>{children}</div>
        )}
      </div>
    </div>
  );
}

/**
 * A branded Recharts tooltip.
 *
 * The default tooltip renders raw numbers with no currency and no thousands
 * separator, which is unreadable for figures in the hundreds of thousands.
 *
 * Pass as: `<Tooltip content={<ChartTooltip />} />`
 */
export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter, currency = true }) {
  if (!active || !payload?.length) return null;

  const format = valueFormatter || ((v) => (currency ? formatCurrency(v) : v?.toLocaleString('en-PK')));

  return (
    <div className="rounded-lg border border-navy-200 bg-white px-3 py-2 shadow-raised text-xs">
      {label !== undefined && (
        <p className="font-semibold text-navy-950 mb-1.5 pb-1.5 border-b border-navy-100">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      )}

      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-navy-600">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.color || entry.payload?.fill }}
              />
              {entry.name}
            </span>
            <span className="font-semibold text-navy-950 tabular">{format(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A small legend that lines up with the chart palette.
 * Used where Recharts' own legend is too large for the available space.
 */
export function ChartLegend({ items, className }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 pb-1', className)}>
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-xs text-navy-600">
          <span
            className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
          {item.value !== undefined && (
            <span className="font-semibold text-navy-900 tabular">{formatCurrency(item.value)}</span>
          )}
        </span>
      ))}
    </div>
  );
}

/** Shared axis styling, so every chart's ticks match. */
export const axisProps = {
  tick: { fontSize: 11, fill: '#537298' },
  tickLine: false,
  axisLine: { stroke: '#e4eaf1' },
};

/** Shared grid styling. */
export const gridProps = {
  strokeDasharray: '3 3',
  stroke: '#e4eaf1',
  vertical: false, // Horizontal rules only - vertical lines add noise
};
