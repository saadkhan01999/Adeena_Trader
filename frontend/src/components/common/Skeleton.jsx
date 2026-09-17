/**
 * ============================================
 * Loading Skeletons
 * ============================================
 * Placeholders that mirror the shape of the content that is coming.
 *
 * A skeleton that matches the final layout prevents the jarring reflow you get
 * from a spinner: the page does not jump when the data arrives, because the
 * space was already reserved.
 */

import { cn } from '../../utils/index.js';

/** A single shimmering block. */
export function Skeleton({ className }) {
  return <div className={cn('skeleton h-4 w-full', className)} aria-hidden="true" />;
}

/** Placeholder for a KPI tile. */
export function CardSkeleton({ className }) {
  return (
    <div className={cn('card p-4 space-y-2.5', className)}>
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-7 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

/** Placeholder for a data table - rows on desktop, cards on mobile. */
export function TableSkeleton({ rows = 5, cols = 5, className }) {
  return (
    <div className={cn('card overflow-hidden', className)}>
      <div className="p-4 border-b border-navy-100">
        <Skeleton className="h-9 w-full sm:w-1/3" />
      </div>

      {/* Desktop */}
      <div className="hidden md:block p-4 space-y-3">
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className="flex gap-4 items-center">
            {Array.from({ length: cols }).map((_, col) => (
              <Skeleton
                key={col}
                className="h-4 flex-1"
                // Vary the widths so it reads as text, not as a grid of bars
                style={{ maxWidth: col === 0 ? '22%' : undefined }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Mobile */}
      <div className="md:hidden divide-y divide-navy-100">
        {Array.from({ length: Math.min(rows, 4) }).map((_, row) => (
          <div key={row} className="p-4 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Placeholder for a chart panel. */
export function ChartSkeleton({ className }) {
  return (
    <div className={cn('card p-4 sm:p-5', className)}>
      <Skeleton className="h-4 w-1/3 mb-4" />
      <div className="flex items-end gap-2 h-[220px]">
        {[45, 70, 55, 85, 60, 95, 75, 50].map((height, i) => (
          <div key={i} className="skeleton flex-1 rounded-t" style={{ height: `${height}%` }} />
        ))}
      </div>
    </div>
  );
}

/** Full-page placeholder: header, KPI row, chart pair and a table. */
export function PageSkeleton({ stats = 4, showChart = true, className }) {
  return (
    <div className={cn('space-y-4 sm:space-y-6', className)} role="status" aria-label="Loading">
      <div className="flex items-center gap-3">
        <div className="skeleton w-10 h-10 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-64" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: stats }).map((_, i) => <CardSkeleton key={i} />)}
      </div>

      {showChart && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      )}

      <TableSkeleton />
      <span className="sr-only">Loading, please wait…</span>
    </div>
  );
}

/** Placeholder for a list of avatar + text rows. */
export function ListSkeleton({ items = 4, className }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="skeleton w-9 h-9 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-4 w-16 flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
