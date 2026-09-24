/**
 * ============================================
 * DataTable
 * ============================================
 * The list surface used by every screen: search, filters, sorting, pagination,
 * CSV export and print, in one component.
 *
 * Responsive strategy
 * -------------------
 * A table with nine columns cannot be made readable at 380px by shrinking it.
 * Below `md` this renders each row as a card instead, showing the columns
 * marked `primary` prominently and the rest as label/value pairs. Columns
 * marked `hideOnMobile` are dropped entirely.
 *
 * Server vs client
 * ----------------
 * Pass `serverSide` when the API already paginates and filters (the usual
 * case). Without it the component sorts, filters and paginates the array it is
 * given, which suits small embedded lists.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Inbox, Download, Printer, SlidersHorizontal, X,
} from 'lucide-react';
import { cn, parseNumber } from '../../utils/index.js';
import { exportToCSV } from '../../utils/export.js';
import { printCurrentView } from '../../utils/export.js';
import { useSettingsStore } from '../../context/settingsStore.js';
import { paperFor, applyPrintPage } from '../../utils/printPage.js';
import EmptyState from './EmptyState.jsx';
import { TableSkeleton } from './Skeleton.jsx';
import Button, { IconButton } from './Button.jsx';
import { Urdu } from './Bilingual.jsx';
import { urduForLabel } from '../../i18n/formLabels.js';

/**
 * @typedef {object} Column
 * @property {string}  [accessor]     Key on the row object.
 * @property {string}  header         Column heading.
 * @property {Function}[render]       (row, index) => ReactNode
 * @property {Function}[exportValue]  (row) => primitive, for CSV.
 * @property {boolean} [sortable]
 * @property {boolean} [hideOnMobile] Dropped from the card view.
 * @property {boolean} [primary]      Shown as the card's title.
 * @property {boolean} [secondary]    Shown as the card's subtitle.
 * @property {'left'|'right'|'center'} [align]
 * @property {string}  [width]
 */

export default function DataTable({
  columns = [],
  data = [],
  loading = false,

  // ---- Search ----
  searchable = true,
  searchPlaceholder = 'Search…',
  searchValue,
  onSearchChange,

  // ---- Pagination ----
  pagination = true,
  pageSize = 20,
  onPageSizeChange,
  /** Server-side pagination: { page, totalPages, total } */
  serverSide = false,
  currentPage: controlledPage,
  totalPages: controlledTotalPages,
  totalRecords,
  onPageChange,

  // ---- Extras ----
  /** Rendered in the toolbar, right of the search box. */
  toolbar,
  /** Rendered in a collapsible panel under the toolbar. */
  filters,
  activeFilterCount = 0,
  onClearFilters,

  exportable = true,
  exportFilename = 'export',
  /** Supply to export the full server-side result set rather than this page. */
  onExport,

  printable = false,
  title,

  emptyState,
  onRowClick,
  rowClassName,
  className,
  /** Adds a footer row; receives the visible rows. */
  summaryRow,
  density = 'comfortable',
}) {
  const [internalSearch, setInternalSearch] = useState('');
  const [internalPage, setInternalPage] = useState(1);
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const printSettings = useSettingsStore((state) => state.settings?.print);

  /** Print the list on the paper chosen for reports in Settings. */
  const printList = () => {
    const cleanup = applyPrintPage(paperFor('report', printSettings), {
      orientation: printSettings?.orientation,
      colorMode: printSettings?.colorMode,
    });
    printCurrentView(title || 'List', cleanup);
  };

  const isControlledSearch = searchValue !== undefined;
  const search = isControlledSearch ? searchValue : internalSearch;

  const handleSearch = useCallback(
    (value) => {
      if (isControlledSearch) onSearchChange?.(value);
      else {
        setInternalSearch(value);
        setInternalPage(1);
      }
    },
    [isControlledSearch, onSearchChange]
  );

  // ==========================================================================
  // Client-side filter, sort, paginate. All three are skipped in server mode,
  // where the API has already done the work.
  // ==========================================================================
  const filtered = useMemo(() => {
    if (serverSide || !search) return data;
    const needle = search.toLowerCase();

    return data.filter((row) =>
      columns.some((col) => {
        const value = col.exportValue
          ? col.exportValue(row)
          : col.accessor
            ? row[col.accessor]
            : null;
        return String(value ?? '').toLowerCase().includes(needle);
      })
    );
  }, [data, search, columns, serverSide]);

  const sorted = useMemo(() => {
    if (serverSide || !sortField) return filtered;

    return [...filtered].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      // Empty values sort last regardless of direction - a blank is not "small"
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      const bothNumeric = typeof aVal === 'number' && typeof bVal === 'number';
      const bothDates = aVal instanceof Date || (!bothNumeric && !Number.isNaN(Date.parse(aVal)) && String(aVal).length > 7);

      let comparison;
      if (bothNumeric) comparison = aVal - bVal;
      else if (bothDates) comparison = new Date(aVal) - new Date(bVal);
      else comparison = String(aVal).localeCompare(String(bVal), 'en', { numeric: true });

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filtered, sortField, sortOrder, serverSide]);

  const page = serverSide ? controlledPage || 1 : internalPage;
  const totalPages = serverSide
    ? controlledTotalPages || 1
    : Math.max(1, Math.ceil(sorted.length / pageSize));

  const rows = useMemo(() => {
    if (serverSide || !pagination) return sorted;
    return sorted.slice((page - 1) * pageSize, page * pageSize);
  }, [sorted, page, pageSize, pagination, serverSide]);

  const total = serverSide ? totalRecords ?? sorted.length : sorted.length;

  // ==========================================================================
  // Row motion
  // ==========================================================================
  // A row that was not on screen a moment ago - one just added - slides in; a
  // row flagged `__leaving` by the screen (just deleted) slides out before it
  // is dropped; one flagged `__fresh` (just edited) glows once. A whole new
  // page of rows (a page change, a new search) fades in together instead,
  // because thirty rows each sliding would be exactly the heavy animation the
  // shop asked not to have.
  const rowKey = (row, index) => row._id || row.id || index;
  const seenRef = useRef(null);
  const freshIds = useMemo(() => {
    const ids = rows.map(rowKey);
    const seen = seenRef.current;
    if (!seen) return new Set();
    const arrived = ids.filter((id) => !seen.has(id));
    return arrived.length > 0 && arrived.length <= 3 ? new Set(arrived) : new Set();
  }, [rows]);
  const bodyKey = useMemo(() => {
    const seen = seenRef.current;
    if (!seen) return 'first';
    const arrived = rows.filter((row, index) => !seen.has(rowKey(row, index))).length;
    return arrived > 3 ? `page-${rows.map(rowKey).slice(0, 3).join('-')}` : 'stable';
  }, [rows]);
  useEffect(() => {
    seenRef.current = new Set(rows.map(rowKey));
  }, [rows]);

  const motionClass = (row, index) =>
    row.__leaving ? 'row-leave' : row.__fresh ? 'row-flash' : freshIds.has(rowKey(row, index)) ? 'row-enter' : '';

  const goToPage = useCallback(
    (next) => {
      const target = Math.min(Math.max(1, next), totalPages);
      if (serverSide) onPageChange?.(target);
      else setInternalPage(target);
      // Bring the top of the table back into view after a page change
      window.scrollTo({ top: Math.max(0, window.scrollY - 200), behavior: 'smooth' });
    },
    [totalPages, serverSide, onPageChange]
  );

  const handleSort = useCallback(
    (field) => {
      if (!field) return;
      setSortField((current) => {
        if (current === field) {
          setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
          return current;
        }
        setSortOrder('asc');
        return field;
      });
      if (!serverSide) setInternalPage(1);
    },
    [serverSide]
  );

  // ==========================================================================
  // Export
  // ==========================================================================
  const handleExport = useCallback(() => {
    if (onExport) return onExport();

    const exportColumns = columns
      .filter((col) => col.accessor || col.exportValue)
      .map((col) => ({
        key: col.accessor || col.header,
        label: col.header,
        format: col.exportValue ? (_, row) => col.exportValue(row) : undefined,
      }));

    // Export everything that matches the current filters, not just this page
    return exportToCSV(sorted, exportFilename, exportColumns);
  }, [onExport, columns, sorted, exportFilename]);

  const cellPadding = density === 'compact' ? 'py-2' : 'py-3';

  // ==========================================================================
  // Loading
  // ==========================================================================
  // The skeleton is only for the FIRST load - when there is genuinely nothing
  // to show. On a filter, a search, a page change or a return to this screen,
  // the rows already on screen stay put and are replaced when the new ones
  // arrive.
  //
  // Blanking the table to a skeleton on every fetch is what made the app feel
  // like it was reloading constantly: the thing you were looking at vanished
  // and rebuilt each time you touched a filter. The parent never cleared its
  // rows, so they were always available to keep showing.
  const isFirstLoad = loading && data.length === 0;
  if (isFirstLoad) {
    return <TableSkeleton rows={6} cols={Math.min(columns.length, 6)} className={className} />;
  }

  const showToolbar = searchable || toolbar || filters || exportable || printable;

  return (
    <div className={cn('card overflow-hidden relative', className)}>
      {/* Refreshing over existing rows: a hairline rather than a skeleton, so
          nothing moves and the figures stay readable while it updates. */}
      {loading && (
        <div
          className="absolute inset-x-0 top-0 h-[2px] overflow-hidden z-10 no-print"
          role="status"
          aria-label="Refreshing"
        >
          <div className="h-full w-1/3 bg-gold-gradient animate-table-refresh" />
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Toolbar                                                           */}
      {/* ---------------------------------------------------------------- */}
      {showToolbar && (
        <div className="border-b border-navy-100 no-print">
          <div className="flex flex-col sm:flex-row gap-2.5 p-3 sm:p-4">
            {searchable && (
              <div className="relative flex-1 min-w-0">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="input pl-10 pr-9"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => handleSearch('')}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-navy-400 hover:text-navy-700 hover:bg-navy-100 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {filters && (
                <Button
                  variant={activeFilterCount > 0 ? 'gold' : 'secondary'}
                  size="md"
                  icon={SlidersHorizontal}
                  onClick={() => setFiltersOpen((o) => !o)}
                  aria-expanded={filtersOpen}
                >
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-navy-950 text-gold-500 text-2xs font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              )}

              {toolbar}

              {exportable && (
                <IconButton
                  icon={Download}
                  label="Export to CSV"
                  variant="secondary"
                  onClick={handleExport}
                  disabled={rows.length === 0}
                />
              )}

              {printable && (
                <IconButton
                  icon={Printer}
                  label="Print this list"
                  variant="secondary"
                  onClick={printList}
                  disabled={rows.length === 0}
                />
              )}
            </div>
          </div>

          {/* Filter drawer */}
          {filters && filtersOpen && (
            <div className="px-3 sm:px-4 pb-4 pt-1 border-t border-navy-100 bg-navy-50/50 animate-fade-in-down">
              {filters}
              {activeFilterCount > 0 && onClearFilters && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-danger-600 hover:text-danger-700 transition-colors"
                >
                  <X size={13} /> Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Desktop table                                                     */}
      {/* ---------------------------------------------------------------- */}
      <div className="hidden md:block overflow-x-auto scrollbar-thin">
        <table className="table">
          <thead className="sticky top-0 z-10">
            <tr>
              {columns.map((col) => {
                const isSorted = sortField === col.accessor;
                return (
                  <th
                    key={col.key || col.accessor || col.header}
                    scope="col"
                    style={{ width: col.width, textAlign: col.align || 'left' }}
                    aria-sort={isSorted ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn(col.sortable && 'cursor-pointer select-none hover:text-navy-900 transition-colors')}
                    onClick={() => col.sortable && handleSort(col.accessor)}
                  >
                    <span
                      className={cn(
                        'inline-flex items-center gap-1',
                        col.align === 'right' && 'justify-end w-full',
                        col.align === 'center' && 'justify-center w-full'
                      )}
                    >
                      <span className="flex flex-col leading-tight">
                        {col.header}
                        <Urdu className="text-[10px] normal-case tracking-normal font-normal text-gold-300/80">
                          {col.headerUr ?? urduForLabel(col.header)}
                        </Urdu>
                      </span>
                      {col.sortable && (
                        <span className={cn('transition-opacity', isSorted ? 'opacity-100' : 'opacity-25')}>
                          {isSorted && sortOrder === 'desc' ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody key={bodyKey} className={bodyKey.startsWith('page-') ? 'soft-in' : undefined}>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-4">
                  {emptyState || (
                    <EmptyState
                      icon={Inbox}
                      title="Nothing to show"
                      message={search ? 'No records match your search.' : 'No records have been added yet.'}
                    />
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={row._id || row.id || index}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    onRowClick && 'cursor-pointer',
                    motionClass(row, index),
                    typeof rowClassName === 'function' ? rowClassName(row) : rowClassName
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key || col.accessor || col.header}
                      style={{ textAlign: col.align || 'left' }}
                      className={cn(cellPadding, col.align === 'right' && 'tabular', col.cellClassName)}
                    >
                      {col.render ? col.render(row, index) : col.accessor ? row[col.accessor] : null}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>

          {summaryRow && rows.length > 0 && (
            <tfoot className="bg-navy-50 font-semibold text-navy-950 border-t-2 border-navy-200">
              {summaryRow(rows)}
            </tfoot>
          )}
        </table>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Mobile cards                                                      */}
      {/* ---------------------------------------------------------------- */}
      <div className="md:hidden divide-y divide-navy-100">
        {rows.length === 0 ? (
          <div className="p-4">
            {emptyState || (
              <EmptyState
                icon={Inbox}
                title="Nothing to show"
                message={search ? 'No records match your search.' : 'No records have been added yet.'}
              />
            )}
          </div>
        ) : (
          rows.map((row, index) => {
            const primary = columns.find((c) => c.primary);
            const secondary = columns.find((c) => c.secondary);
            const rest = columns.filter((c) => !c.hideOnMobile && !c.primary && !c.secondary);

            return (
              <div
                key={row._id || row.id || index}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'p-3.5 transition-colors duration-150',
                  onRowClick && 'cursor-pointer active:bg-gold-50',
                  motionClass(row, index)
                )}
                style={{ '--i': index }}
              >
                {/* Card header: the row's identity */}
                {(primary || secondary) && (
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="min-w-0 flex-1">
                      {primary && (
                        <div className="text-sm font-semibold text-navy-950 truncate">
                          {primary.render ? primary.render(row, index) : row[primary.accessor]}
                        </div>
                      )}
                      {secondary && (
                        <div className="text-xs text-navy-500 mt-0.5 truncate">
                          {secondary.render ? secondary.render(row, index) : row[secondary.accessor]}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Remaining fields as label/value pairs */}
                <dl className="space-y-1.5">
                  {rest.map((col) => (
                    <div
                      key={col.key || col.accessor || col.header}
                      className="flex items-start justify-between gap-3"
                    >
                      <dt className="text-2xs font-medium uppercase tracking-wide text-navy-400 flex-shrink-0 pt-0.5">
                        {col.mobileLabel || col.header}
                      </dt>
                      <dd className="text-sm text-navy-900 text-right min-w-0">
                        {col.render ? col.render(row, index) : col.accessor ? row[col.accessor] : null}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Pagination                                                        */}
      {/* ---------------------------------------------------------------- */}
      {pagination && rows.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 sm:px-4 py-3 border-t border-navy-100 bg-navy-50/40 no-print">
          <p className="text-xs text-navy-500 order-2 sm:order-1">
            {serverSide
              ? `Page ${page} of ${totalPages} · ${total.toLocaleString('en-PK')} record${total === 1 ? '' : 's'}`
              : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total.toLocaleString('en-PK')}`}
          </p>

          {totalPages > 1 && (
            <div className="flex items-center gap-1 order-1 sm:order-2">
              <IconButton
                icon={ChevronsLeft}
                label="First page"
                size="icon-sm"
                onClick={() => goToPage(1)}
                disabled={page === 1}
              />
              <IconButton
                icon={ChevronLeft}
                label="Previous page"
                size="icon-sm"
                onClick={() => goToPage(page - 1)}
                disabled={page === 1}
              />

              <span className="px-3 py-1 text-xs font-medium text-navy-700 tabular min-w-[64px] text-center">
                {page} / {totalPages}
              </span>

              <IconButton
                icon={ChevronRight}
                label="Next page"
                size="icon-sm"
                onClick={() => goToPage(page + 1)}
                disabled={page === totalPages}
              />
              <IconButton
                icon={ChevronsRight}
                label="Last page"
                size="icon-sm"
                onClick={() => goToPage(totalPages)}
                disabled={page === totalPages}
              />
            </div>
          )}

          {onPageSizeChange && (
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Rows per page"
              className="input input-sm w-auto order-3"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>{n} per page</option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A right-aligned money cell.
 * Negative figures render red without the caller repeating the condition.
 */
export function MoneyCell({ value, className, showZero = true, colored = false }) {
  const amount = parseNumber(value);
  if (!showZero && amount === 0) return <span className="text-navy-300">-</span>;

  return (
    <span
      className={cn(
        'tabular font-medium',
        colored && amount < 0 && 'text-danger-600',
        colored && amount > 0 && 'text-success-700',
        className
      )}
    >
      Rs. {Math.round(amount).toLocaleString('en-PK')}
    </span>
  );
}
