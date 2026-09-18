/**
 * ============================================
 * Reports
 * ============================================
 * Ten reports over one contract.
 *
 * Every figure here is aggregated by the server from live collections — there
 * is no sample data anywhere in this screen. Because all reports return the
 * same `{ meta, summary, series, breakdown, rows }` shape, one component
 * renders all of them, and adding an eleventh report needs no frontend change
 * beyond the server exposing it.
 *
 * Export is server-side so a CSV contains the complete result set rather than
 * the page that happens to be on screen.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChartNoAxesCombined, FileDown, Printer, Calendar, TrendingUp, Wallet,
  Package, Users, Truck, ShoppingBag, ReceiptText, HandCoins, Boxes,
  CircleDollarSign, RefreshCw,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

import PageHeader from '../../components/common/PageHeader.jsx';
import TabGuide from '../../components/common/TabGuide.jsx';
import StatCard, { StatGrid } from '../../components/common/StatCard.jsx';
import ChartCard, { ChartTooltip, axisProps, gridProps } from '../../components/common/ChartCard.jsx';
import Button, { IconButton } from '../../components/common/Button.jsx';
import DataTable from '../../components/common/DataTable.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { Select, Input, FormRow } from '../../components/common/Form.jsx';
import { PageSkeleton } from '../../components/common/Skeleton.jsx';

import { reportService } from '../../services/entities.js';
import { useUIStore } from '../../context/uiStore.js';
import { useSettingsStore } from '../../context/settingsStore.js';
import { useToastStore } from '../../context/toastStore.js';
import { printCurrentView } from '../../utils/export.js';
import {
  cn, formatCurrency, formatCompact, formatDate, titleCase,
  dateRangePresets, toDateInput, parseNumber,
} from '../../utils/index.js';
import { CHART_COLORS, OWNERSHIP_LABELS } from '../../constants/index.js';

/** Icon and headline metrics per report, so each one reads as purpose-built. */
const REPORT_META = {
  sales: {
    icon: ShoppingBag,
    tiles: [
      { key: 'totalSales', label: 'Total sales', variant: 'navy' },
      { key: 'cashSales', label: 'Cash sales', variant: 'green' },
      { key: 'installmentSales', label: 'Installment sales', variant: 'gold' },
      { key: 'grossProfit', label: 'Gross profit', variant: 'blue' },
    ],
    chart: 'area',
    series: [
      { key: 'sales', name: 'Sales', color: '#0b192c' },
      { key: 'cash', name: 'Cash', color: '#10b981' },
      { key: 'installment', name: 'Installment', color: '#f59e0b' },
    ],
  },
  collection: {
    icon: Wallet,
    tiles: [
      { key: 'totalCollection', label: 'Collected', variant: 'green' },
      { key: 'paymentCount', label: 'Payments', variant: 'navy', isCurrency: false },
      { key: 'averagePayment', label: 'Average', variant: 'blue' },
      { key: 'largestPayment', label: 'Largest', variant: 'gold' },
    ],
    chart: 'bar',
    series: [{ key: 'collection', name: 'Collected', color: '#f59e0b' }],
  },
  profit: {
    icon: TrendingUp,
    tiles: [
      { key: 'revenue', label: 'Revenue', variant: 'navy' },
      { key: 'grossProfit', label: 'Gross profit', variant: 'blue' },
      { key: 'totalExpenses', label: 'Expenses', variant: 'amber' },
      { key: 'netProfit', label: 'Net profit', variant: 'green' },
    ],
    chart: 'area',
    series: [
      { key: 'revenue', name: 'Revenue', color: '#0b192c' },
      { key: 'grossProfit', name: 'Gross profit', color: '#10b981' },
      { key: 'expenses', name: 'Expenses', color: '#ef4444' },
    ],
  },
  stock: {
    icon: Boxes,
    tiles: [
      { key: 'costValue', label: 'Stock at cost', variant: 'navy' },
      { key: 'retailValue', label: 'Retail value', variant: 'gold' },
      { key: 'potentialProfit', label: 'Potential profit', variant: 'green' },
      { key: 'productCount', label: 'Products', variant: 'blue', isCurrency: false },
    ],
  },
  receivables: {
    icon: CircleDollarSign,
    tiles: [
      { key: 'totalReceivable', label: 'Receivable', variant: 'blue' },
      { key: 'totalOverdue', label: 'Overdue', variant: 'red' },
      { key: 'currentDue', label: 'Not yet due', variant: 'navy' },
      { key: 'collectionRate', label: 'On-time rate', variant: 'green', isCurrency: false, suffix: '%' },
    ],
  },
  expenses: {
    icon: ReceiptText,
    tiles: [
      { key: 'totalExpenses', label: 'Total spent', variant: 'amber' },
      { key: 'entryCount', label: 'Entries', variant: 'navy', isCurrency: false },
      { key: 'dailyAverage', label: 'Daily average', variant: 'blue' },
    ],
    chart: 'bar',
    series: [{ key: 'expenses', name: 'Expenses', color: '#ef4444' }],
  },
  zakat: {
    icon: HandCoins,
    tiles: [
      { key: 'totalZakat', label: 'Zakat due', variant: 'gold' },
      { key: 'totalPaid', label: 'Paid', variant: 'green' },
      { key: 'outstanding', label: 'Outstanding', variant: 'red' },
      { key: 'totalNetAssets', label: 'Net wealth assessed', variant: 'navy' },
    ],
  },
  customers: {
    icon: Users,
    tiles: [
      { key: 'customerCount', label: 'Customers', variant: 'navy', isCurrency: false },
      { key: 'totalBusiness', label: 'Total business', variant: 'blue' },
      { key: 'totalOutstanding', label: 'Outstanding', variant: 'amber' },
      { key: 'collectedInPeriod', label: 'Collected', variant: 'green' },
    ],
  },
  products: {
    icon: Package,
    tiles: [
      { key: 'unitsSold', label: 'Units sold', variant: 'navy', isCurrency: false },
      { key: 'revenue', label: 'Revenue', variant: 'gold' },
      { key: 'profit', label: 'Profit', variant: 'green' },
      { key: 'productsSold', label: 'Products sold', variant: 'blue', isCurrency: false },
    ],
  },
  suppliers: {
    icon: Truck,
    tiles: [
      { key: 'supplierCount', label: 'Suppliers', variant: 'navy', isCurrency: false },
      { key: 'totalPurchases', label: 'Purchased', variant: 'blue' },
      { key: 'totalPayable', label: 'Owed', variant: 'red' },
      { key: 'suppliersOwed', label: 'With a balance', variant: 'amber', isCurrency: false },
    ],
  },
};

export default function ReportsPage() {
  const toast = useToastStore();
  const { ownership } = useUIStore();

  const [catalogue, setCatalogue] = useState([]);
  const [type, setType] = useState('sales');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const presets = useMemo(() => dateRangePresets(), []);
  const [preset, setPreset] = useState('30d');
  const [range, setRange] = useState(() => {
    const thirtyDays = dateRangePresets().find((p) => p.id === '30d');
    return { start: toDateInput(thirtyDays.start), end: toDateInput(thirtyDays.end) };
  });

  // ---- Catalogue --------------------------------------------------------
  useEffect(() => {
    reportService
      .list()
      .then((response) => setCatalogue(response.data.reports || []))
      .catch(() => {});
  }, []);

  // ---- Report -----------------------------------------------------------
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await reportService.get(type, {
        startDate: range.start,
        endDate: range.end,
        ownership,
      });
      setReport(response.data);
    } catch (error) {
      toast.apiError(error, 'Could not build that report.');
      setReport(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, range.start, range.end, ownership]);

  useEffect(() => { load(); }, [load]);

  const applyPreset = (id) => {
    const found = presets.find((p) => p.id === id);
    if (!found) return;
    setPreset(id);
    setRange({ start: toDateInput(found.start), end: toDateInput(found.end) });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { filename } = await reportService.exportCSV(type, {
        startDate: range.start,
        endDate: range.end,
        ownership,
      });
      toast.success(`Downloaded ${filename}`);
    } catch (error) {
      toast.apiError(error, 'Could not export this report.');
    } finally {
      setExporting(false);
    }
  };

  const meta = REPORT_META[type] || {};
  const Icon = meta.icon || ChartNoAxesCombined;
  const definition = catalogue.find((r) => r.type === type);
  const isPointInTime = report?.meta?.isPointInTime;

  // Build table columns from the server's column list, so a new report needs
  // no frontend change to render its detail table.
  const columns = useMemo(() => {
    if (!report?.meta?.columns) return [];

    return report.meta.columns.map((key) => ({
      accessor: key,
      header: titleCase(key),
      sortable: true,
      align: isNumericColumn(key) ? 'right' : 'left',
      primary: key === report.meta.columns[0],
      hideOnMobile: report.meta.columns.indexOf(key) > 3,
      render: (row) => renderCell(key, row[key]),
      exportValue: (row) => row[key],
    }));
  }, [report?.meta?.columns]);

  if (loading && !report) return <PageSkeleton stats={4} />;

  return (
    <div className="space-y-5">
      <TabGuide id="reports" />

      <PageHeader
        title="Reports"
        subtitle={
          report?.meta
            ? `${report.meta.label} · ${OWNERSHIP_LABELS[ownership]}${
                isPointInTime
                  ? ' · as at today'
                  : ` · ${formatDate(report.meta.startDate)} to ${formatDate(report.meta.endDate)}`
              }`
            : 'Business intelligence from your live records'
        }
        icon={ChartNoAxesCombined}
        actions={
          <>
            <IconButton
              icon={RefreshCw}
              label="Refresh"
              variant="secondary"
              onClick={load}
              className={cn(loading && '[&>svg]:animate-spin')}
            />
            <Button variant="secondary" icon={Printer} onClick={() => printCurrentView(`${type}-report`)}>
              Print
            </Button>
            <Button
              variant="gold"
              icon={FileDown}
              onClick={handleExport}
              isLoading={exporting}
              loadingText="Preparing…"
            >
              Export CSV
            </Button>
          </>
        }
      />

      {/* ---- Controls ---- */}
      <div className="card p-3 sm:p-4 space-y-3 no-print">
        <FormRow cols={isPointInTime ? 1 : 3}>
          <Select
            label="Report"
            value={type}
            onChange={(e) => setType(e.target.value)}
            options={
              catalogue.length
                ? catalogue.map((r) => ({ value: r.type, label: r.label }))
                : Object.keys(REPORT_META).map((t) => ({ value: t, label: titleCase(t) }))
            }
          />

          {!isPointInTime && (
            <>
              <Input
                label="From"
                type="date"
                value={range.start}
                onChange={(e) => { setRange({ ...range, start: e.target.value }); setPreset('custom'); }}
                max={range.end}
              />
              <Input
                label="To"
                type="date"
                value={range.end}
                onChange={(e) => { setRange({ ...range, end: e.target.value }); setPreset('custom'); }}
                max={toDateInput(new Date())}
              />
            </>
          )}
        </FormRow>

        {/* Quick ranges — faster than two date pickers for the common cases */}
        {!isPointInTime && (
          <div className="flex flex-wrap gap-1.5">
            {presets.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => applyPreset(option.id)}
                className={cn(
                  'px-2.5 py-1 rounded-lg border text-2xs font-medium transition-all active:scale-95',
                  preset === option.id
                    ? 'border-gold-500 bg-gold-50 text-navy-950'
                    : 'border-navy-200 text-navy-600 hover:border-navy-300 hover:bg-navy-50'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {isPointInTime && (
          <p className="flex items-center gap-1.5 text-2xs text-navy-500">
            <Calendar size={12} />
            This report is a snapshot of today&apos;s position, so the date range does not apply.
          </p>
        )}
      </div>

      {!report ? (
        <div className="card">
          <EmptyState
            icon={ChartNoAxesCombined}
            title="No data for this report"
            message="Try a wider date range, or record some transactions first."
          />
        </div>
      ) : (
        <div className="print-area space-y-5">
          {/* Printed header — the on-screen one is hidden when printing */}
          <div className="hidden print:block mb-4">
            <h1 className="font-display font-bold text-lg">{report.meta.label}</h1>
            <p className="text-xs text-navy-600">
              {OWNERSHIP_LABELS[ownership]} ·{' '}
              {isPointInTime
                ? `As at ${formatDate(new Date())}`
                : `${formatDate(report.meta.startDate)} to ${formatDate(report.meta.endDate)}`}
            </p>
          </div>

          {/* ---- Tiles ---- */}
          {meta.tiles && (
            <StatGrid columns={meta.tiles.length > 3 ? 4 : 3}>
              {meta.tiles.map((tile) => (
                <StatCard
                  key={tile.key}
                  label={tile.label}
                  value={
                    tile.suffix
                      ? `${report.summary[tile.key] ?? 0}${tile.suffix}`
                      : report.summary[tile.key] ?? 0
                  }
                  icon={Icon}
                  variant={tile.variant}
                  isCurrency={tile.isCurrency !== false && !tile.suffix}
                  compact
                />
              ))}
            </StatGrid>
          )}

          {/* ---- Charts ---- */}
          {(report.series?.length > 0 || report.breakdown?.length > 0) && (
            <div
              className={cn(
                'grid gap-4',
                report.series?.length > 0 && report.breakdown?.length > 0
                  ? 'grid-cols-1 xl:grid-cols-3'
                  : 'grid-cols-1'
              )}
            >
              {report.series?.length > 0 && meta.chart && (
                <ChartCard
                  title="Over time"
                  subtitle={`${formatDate(report.meta.startDate)} to ${formatDate(report.meta.endDate)}`}
                  icon={Icon}
                  height="lg"
                  className={report.breakdown?.length > 0 ? 'xl:col-span-2' : ''}
                  isEmpty={!report.series.some((d) => meta.series.some((s) => d[s.key] > 0))}
                  emptyIcon={Icon}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    {meta.chart === 'bar' ? (
                      <BarChart data={report.series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis
                          dataKey="date"
                          {...axisProps}
                          tickFormatter={(d) => formatDate(d, { day: 'numeric', month: 'short', year: undefined })}
                          minTickGap={24}
                        />
                        <YAxis {...axisProps} tickFormatter={formatCompact} width={52} />
                        <Tooltip
                          content={<ChartTooltip labelFormatter={(d) => formatDate(d)} />}
                          cursor={{ fill: 'rgba(11,25,44,0.04)' }}
                        />
                        {meta.series.map((s) => (
                          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[3, 3, 0, 0]} />
                        ))}
                      </BarChart>
                    ) : (
                      <AreaChart data={report.series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                        <defs>
                          {meta.series.map((s) => (
                            <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={s.color} stopOpacity={0.24} />
                              <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid {...gridProps} />
                        <XAxis
                          dataKey="date"
                          {...axisProps}
                          tickFormatter={(d) => formatDate(d, { day: 'numeric', month: 'short', year: undefined })}
                          minTickGap={24}
                        />
                        <YAxis {...axisProps} tickFormatter={formatCompact} width={52} />
                        <Tooltip
                          content={<ChartTooltip labelFormatter={(d) => formatDate(d)} />}
                          cursor={{ stroke: '#c9d5e3', strokeWidth: 1 }}
                        />
                        {meta.series.map((s) => (
                          <Area
                            key={s.key}
                            type="monotone"
                            dataKey={s.key}
                            name={s.name}
                            stroke={s.color}
                            strokeWidth={2}
                            fill={`url(#fill-${s.key})`}
                            dot={false}
                          />
                        ))}
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {report.breakdown?.length > 0 && (
                <ChartCard
                  title="Breakdown"
                  icon={Package}
                  height="lg"
                  isEmpty={report.breakdown.every((b) => !b.value)}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={report.breakdown}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="45%"
                        innerRadius="48%"
                        outerRadius="78%"
                        paddingAngle={2}
                        stroke="none"
                      >
                        {report.breakdown.map((_, index) => (
                          <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>

                  <ul className="flex flex-wrap gap-x-3 gap-y-1 px-4 pb-1 -mt-6">
                    {report.breakdown.slice(0, 6).map((entry, index) => (
                      <li key={entry.name} className="flex items-center gap-1.5 text-2xs text-navy-600">
                        <span
                          className="w-2 h-2 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        <span className="truncate max-w-[110px]">{entry.name}</span>
                      </li>
                    ))}
                  </ul>
                </ChartCard>
              )}
            </div>
          )}

          {/* ---- Detail ---- */}
          <DataTable
            columns={columns}
            data={report.rows || []}
            loading={loading}
            pageSize={25}
            searchable={report.rows?.length > 10}
            searchPlaceholder="Search this report…"
            exportable={false} // Export goes through the server for the full set
            exportFilename={`${type}-report`}
            density="compact"
            emptyState={
              <EmptyState
                icon={Icon}
                title="Nothing in this period"
                message="Try a wider date range, or record some transactions first."
              />
            }
          />
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * Cell rendering
 * ========================================================================== */

/** Columns whose name implies a money or count value get right-aligned. */
function isNumericColumn(key) {
  return /amount|total|price|value|balance|paid|due|profit|cost|stock|count|revenue|nisab|zakat|receivable|payable|overdue|units|sold|advance|days/i.test(
    key
  );
}

/** Format one cell based on what its column name implies. */
function renderCell(key, value) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-navy-300">—</span>;
  }

  // Money
  if (
    /amount|total|price|value|balance|paid|due|profit|cost|revenue|nisab|zakat|receivable|payable|advance/i.test(key) &&
    typeof value === 'number'
  ) {
    const isNegative = value < 0;
    return (
      <span className={cn('tabular font-medium', isNegative && 'text-danger-600')}>
        {formatCurrency(Math.abs(value))}
      </span>
    );
  }

  // Dates
  if (/date/i.test(key)) return <span className="tabular">{formatDate(value)}</span>;

  // Plain counts
  if (typeof value === 'number') return <span className="tabular">{value.toLocaleString('en-PK')}</span>;

  // A P&L line: emphasise the subtotal and total captions
  if (key === 'line') {
    const isTotal = /^(Gross Profit|Net Profit)/.test(value);
    return <span className={cn(isTotal && 'font-semibold text-navy-950')}>{value}</span>;
  }

  return <span className="truncate">{String(value)}</span>;
}
