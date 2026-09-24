/**
 * ============================================
 * Dashboard
 * ============================================
 * The morning view: what came in, what is owed, what needs chasing today.
 *
 * Ordered by what a shop owner acts on, not by what is easiest to compute:
 *   1. Today's money (sales, collection, expenses, profit)
 *   2. What is owed and what is at risk (receivable, overdue, stock, payables)
 *   3. Trends
 *   4. Worklists - due today, overdue, low stock
 *   5. Recent activity
 *
 * Every figure respects the ownership lens in the header, so "My Share" and
 * "Partner Share" are genuine views of the same data rather than labels.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, Wallet, AlertCircle, Package, ShoppingBag, ReceiptText,
  CalendarClock, BriefcaseBusiness, ArrowRight, Plus, MessageCircle,
  Truck, RefreshCw, ChartNoAxesCombined, PieChart as PieChartIcon,
  Banknote, Clock, TriangleAlert, Inbox, Boxes, CircleDollarSign,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

import PageHeader from '../../components/common/PageHeader.jsx';
import TabGuide from '../../components/common/TabGuide.jsx';
import StatCard, { StatGrid } from '../../components/common/StatCard.jsx';
import ChartCard, { ChartTooltip, axisProps, gridProps } from '../../components/common/ChartCard.jsx';
import Badge from '../../components/common/Badge.jsx';
import Button, { IconButton } from '../../components/common/Button.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import ReminderModal from '../../components/modals/ReminderModal.jsx';
import DashboardHero from './DashboardHero.jsx';
import WalletCard from './WalletCard.jsx';
import LowStockAlert from './LowStockAlert.jsx';

import { dashboardService } from '../../services/entities.js';
import { useUIStore } from '../../context/uiStore.js';
import { useAuthStore } from '../../context/authStore.js';
import { useToastStore } from '../../context/toastStore.js';
import { useSettingsStore } from '../../context/settingsStore.js';
import {
  formatCurrency, formatCompact, formatDate, cn, timeAgo,
} from '../../utils/index.js';
import { paymentMethodLabel } from '../../constants/index.js';
import { readList, writeList } from '../../utils/listCache.js';
import { themeColor } from '../../theme/themes.js';

/** A chart palette drawn from the active theme, then fixed meanings. */
const chartPalette = () => [
  themeColor('ink-900'), themeColor('gold-500'), '#3b82f6', '#10b981',
  '#ef4444', '#8b5cf6', '#14b8a6', '#ec4899',
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const toast = useToastStore();
  const { ownership, isOnline } = useUIStore();
  const { user, hasPermission } = useAuthStore();
  // Subscribed so the charts recolour the moment the theme changes.
  const theme = useSettingsStore((s) => s.settings?.display?.theme);

  const [trendDays, setTrendDays] = useState(7);
  const cacheKeyFor = `dashboard:${ownership}:${trendDays}`;

  // The last dashboard this device saw, painted at once, then refreshed
  // behind it - so coming back to the dashboard never shows an empty page.
  const [data, setData] = useState(() => readList(cacheKeyFor)?.records || null);
  const [refreshing, setRefreshing] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [walletKey, setWalletKey] = useState(0);

  const load = useCallback(
    async () => {
      setRefreshing(true);
      try {
        const response = await dashboardService.get(ownership, trendDays);
        setData(response.data);
        writeList(`dashboard:${ownership}:${trendDays}`, { records: response.data });
      } catch (error) {
        toast.apiError(error, 'Could not load the dashboard.');
      } finally {
        setRefreshing(false);
      }
    },
    // `toast` is a stable zustand selector; excluding it avoids a refetch loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ownership, trendDays]
  );

  useEffect(() => { load(); }, [load]);

  const refreshAll = () => { load(); setWalletKey((k) => k + 1); };
  const palette = chartPalette(theme);

  const kpis = data?.kpis || {};
  const counts = data?.counts || {};
  const charts = data?.charts || { trend: [], categorySales: [] };
  const installmentsDueToday = data?.installmentsDueToday || [];
  const overdueInstallments = data?.overdueInstallments || [];
  const lowStockProducts = data?.lowStockProducts || [];
  const recentSales = data?.recentSales || [];
  const recentPayments = data?.recentPayments || [];
  const loading = !data;

  const hasTrendData = charts.trend?.some((d) => d.sales > 0 || d.collection > 0);
  const hasCategoryData = charts.categorySales?.length > 0;
  const plural = (n, word) => `${n ?? 0} ${word}${n === 1 ? '' : 's'}`;

  return (
    <div className="space-y-4 sm:space-y-5">
      <DashboardHero user={user} ownership={ownership} />

      {/* ---- Refresh + New sale, as in the reference ---- */}
      <div className="grid grid-cols-2 gap-3 lg:flex lg:justify-end">
        <Button
          variant="secondary"
          icon={RefreshCw}
          onClick={refreshAll}
          disabled={refreshing || !isOnline}
          className={cn('h-12 lg:h-11 text-[15px] rounded-xl border-gold-400 lg:min-w-[150px]', refreshing && '[&>svg]:animate-spin')}
        >
          Refresh
        </Button>
        {hasPermission('sales') ? (
          <Button
            variant="gold"
            icon={Plus}
            onClick={() => navigate('/sales?new=1')}
            className="h-12 lg:h-11 text-[15px] rounded-xl lg:min-w-[170px]"
          >
            New Sale
          </Button>
        ) : (
          counts.overdueCount > 0 && hasPermission('installments') && (
            <Button variant="danger" icon={MessageCircle} onClick={() => setReminderOpen(true)} className="h-12 lg:h-11 rounded-xl">
              Chase overdue
            </Button>
          )
        )}
      </div>

      <TabGuide id="dashboard" />

      {/* ================================================================= */}
      {/* Key figures                                                       */}
      {/* ================================================================= */}
      <section>
        <h2 className="sr-only">Key figures</h2>
        <StatGrid columns={4}>
          <StatCard
            loading={loading}
            label="Today's sales"
            value={kpis.todaysSales}
            icon={ShoppingBag}
            variant="navy"
            subtitle={plural(counts.todaysSalesCount, 'invoice')}
            onClick={hasPermission('sales') ? () => navigate('/sales') : undefined}
          />
          <StatCard
            loading={loading}
            label="Collected today"
            value={kpis.todaysCollection}
            icon={Wallet}
            variant="green"
            subtitle={plural(counts.todaysPaymentCount, 'payment')}
            onClick={hasPermission('payments') ? () => navigate('/payments') : undefined}
          />
          <StatCard
            loading={loading}
            label="Expenses today"
            value={kpis.todaysExpenses}
            icon={ReceiptText}
            variant="amber"
            subtitle={kpis.todaysExpenses > 0 ? 'Spent today' : 'No expenses'}
            onClick={hasPermission('expenses') ? () => navigate('/expenses') : undefined}
          />
          <StatCard
            loading={loading}
            label="Profit today"
            value={kpis.netProfit}
            icon={TrendingUp}
            variant={(kpis.netProfit ?? 0) >= 0 ? 'gold' : 'red'}
            subtitle="After cost of goods and expenses"
            onClick={hasPermission('reports') ? () => navigate('/reports') : undefined}
          />
          <StatCard
            loading={loading}
            label="Total receivable"
            value={kpis.totalReceivable}
            icon={CircleDollarSign}
            variant="blue"
            subtitle="Outstanding from customers"
            onClick={hasPermission('installments') ? () => navigate('/installments') : undefined}
          />
          <StatCard
            loading={loading}
            label="Overdue"
            value={kpis.overdue}
            icon={AlertCircle}
            variant="red"
            subtitle={`${plural(counts.overdueCount, 'instalment')} late`}
            onClick={hasPermission('installments') ? () => navigate('/installments') : undefined}
          />
          <StatCard
            loading={loading}
            label="Stock value"
            value={kpis.stockValue}
            icon={Boxes}
            variant="navy"
            subtitle={`${plural(counts.totalProducts, 'item')} at cost`}
            onClick={hasPermission('products') ? () => navigate('/inventory') : undefined}
          />
          <StatCard
            loading={loading}
            label="Owed to suppliers"
            value={kpis.purchasePayable}
            icon={Truck}
            variant="purple"
            subtitle={counts.suppliersOwed ? plural(counts.suppliersOwed, 'supplier') : 'No dues'}
            onClick={hasPermission('suppliers') ? () => navigate('/suppliers') : undefined}
          />
        </StatGrid>
      </section>

      {/* ================================================================= */}
      {/* Low stock alert                                                   */}
      {/* ================================================================= */}
      {hasPermission('products') && (
        <LowStockAlert
          items={lowStockProducts}
          lowCount={counts.lowStockCount || 0}
          outCount={counts.outOfStockCount || 0}
          onOpen={() => navigate('/inventory?stock=low')}
        />
      )}

      {/* ================================================================= */}
      {/* Wallet                                                            */}
      {/* ================================================================= */}
      {(hasPermission('payments') || hasPermission('reports')) && (
        <WalletCard key={walletKey} ownership={ownership} />
      )}

      {/* ================================================================= */}
      {/* Trends                                                            */}
      {/* ================================================================= */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard
          title="Sales and collection"
          subtitle={`Last ${trendDays} days`}
          icon={ChartNoAxesCombined}
          value={kpis.periodSales}
          valueLabel="sold"
          height="md"
          className="xl:col-span-2"
          isEmpty={!hasTrendData}
          emptyIcon={ChartNoAxesCombined}
          emptyMessage="No sales or collection recorded in this period yet."
          toolbar={
            <div className="tab-bar p-0.5">
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setTrendDays(days)}
                  className={cn('tab px-2 py-1 text-2xs', trendDays === days && 'tab-active')}
                >
                  {days}d
                </button>
              ))}
            </div>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={charts.trend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                {/* Soft fills rather than solid blocks: two overlapping solid
                    areas make the lower series unreadable. */}
                <linearGradient id="fillSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={palette[0]} stopOpacity={0.24} />
                  <stop offset="100%" stopColor={palette[0]} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="fillCollection" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={palette[1]} stopOpacity={0.34} />
                  <stop offset="100%" stopColor={palette[1]} stopOpacity={0.02} />
                </linearGradient>
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
                cursor={{ stroke: themeColor('ink-200'), strokeWidth: 1 }}
              />

              <Area
                type="monotone" dataKey="sales" name="Sales"
                stroke={palette[0]} strokeWidth={2} fill="url(#fillSales)"
                dot={false} activeDot={{ r: 4, fill: palette[0] }}
              />
              <Area
                type="monotone" dataKey="collection" name="Collected"
                stroke={palette[1]} strokeWidth={2.5} fill="url(#fillCollection)"
                dot={false} activeDot={{ r: 4, fill: palette[1] }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Sales by category"
          subtitle={`Last ${trendDays} days`}
          icon={PieChartIcon}
          height="md"
          isEmpty={!hasCategoryData}
          emptyIcon={PieChartIcon}
          emptyMessage="Category mix appears once you record some sales."
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={charts.categorySales}
                dataKey="total"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius="52%"
                outerRadius="80%"
                paddingAngle={2}
                stroke="none"
              >
                {charts.categorySales.map((_, index) => (
                  <Cell key={index} fill={palette[index % palette.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* A custom legend below the donut: Recharts' own legend wraps badly
              at narrow widths and pushes the chart out of view. */}
          {hasCategoryData && (
            <ul className="flex flex-wrap gap-x-3 gap-y-1 px-4 pb-1 -mt-2">
              {charts.categorySales.slice(0, 5).map((entry, index) => (
                <li key={entry.category} className="flex items-center gap-1.5 text-2xs text-navy-600">
                  <span
                    className="w-2 h-2 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: palette[index % palette.length] }}
                  />
                  <span className="truncate max-w-[92px]">{entry.category}</span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </section>

      {/* ================================================================= */}
      {/* Worklists                                                         */}
      {/* ================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Due today */}
        <WorklistCard
          title="Due today"
          icon={Clock}
          count={installmentsDueToday.length}
          countVariant="warning"
          onViewAll={hasPermission('installments') ? () => navigate('/installments') : undefined}
          isEmpty={installmentsDueToday.length === 0}
          emptyIcon={Clock}
          emptyMessage="Nothing falls due today."
        >
          {installmentsDueToday.slice(0, 5).map((item, index) => (
            <InstallmentRow key={`${item.saleId}-${item.installmentNumber}`} item={item} index={index} />
          ))}
        </WorklistCard>

        {/* Overdue */}
        <WorklistCard
          title="Overdue"
          icon={TriangleAlert}
          count={counts.overdueCount}
          countVariant="danger"
          onViewAll={hasPermission('installments') ? () => navigate('/installments') : undefined}
          action={
            counts.overdueCount > 0 && hasPermission('installments') ? (
              <Button variant="whatsapp" size="xs" icon={MessageCircle} onClick={() => setReminderOpen(true)}>
                Remind all
              </Button>
            ) : null
          }
          isEmpty={overdueInstallments.length === 0}
          emptyIcon={Banknote}
          emptyMessage="Every account is up to date."
        >
          {overdueInstallments.slice(0, 5).map((item, index) => (
            <InstallmentRow
              key={`${item.saleId}-${item.installmentNumber}`}
              item={item}
              index={index}
              overdue
            />
          ))}
        </WorklistCard>

        {/* Low stock */}
        <WorklistCard
          title="Stock running low"
          icon={Package}
          count={counts.lowStockCount + counts.outOfStockCount}
          countVariant={counts.outOfStockCount > 0 ? 'danger' : 'warning'}
          onViewAll={hasPermission('products') ? () => navigate('/inventory?stock=low') : undefined}
          isEmpty={lowStockProducts.length === 0 && counts.outOfStockCount === 0}
          emptyIcon={Package}
          emptyMessage="Everything is well stocked."
        >
          {lowStockProducts.map((product, index) => (
            <li
              key={product.id}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-navy-50 transition-colors stagger"
              style={{ '--i': index }}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-navy-900 truncate">{product.name}</span>
                <span className="block text-2xs text-navy-500">Reorder at {product.threshold}</span>
              </span>
              <Badge variant={product.stock === 0 ? 'danger' : 'warning'} size="sm">
                {product.stock} left
              </Badge>
            </li>
          ))}
          {counts.outOfStockCount > 0 && (
            <li className="px-3 py-2">
              <p className="text-2xs text-danger-600 font-medium">
                {counts.outOfStockCount} product{counts.outOfStockCount === 1 ? ' is' : 's are'} completely out of stock.
              </p>
            </li>
          )}
        </WorklistCard>
      </section>

      {/* ================================================================= */}
      {/* Recent activity                                                   */}
      {/* ================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WorklistCard
          title="Recent sales"
          icon={ShoppingBag}
          onViewAll={hasPermission('sales') ? () => navigate('/sales') : undefined}
          isEmpty={recentSales.length === 0}
          emptyIcon={Inbox}
          emptyMessage="No sales recorded yet."
        >
          {recentSales.map((sale, index) => (
            <li
              key={sale._id}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-navy-50 transition-colors stagger"
              style={{ '--i': index }}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-navy-900 truncate">
                  {sale.customerName}
                </span>
                <span className="block text-2xs text-navy-500 tabular">
                  {sale.invoiceNumber} · {timeAgo(sale.saleDate)}
                </span>
              </span>

              <span className="text-right flex-shrink-0">
                <span className="block text-sm font-semibold text-navy-950 tabular">
                  {formatCurrency(sale.grandTotal)}
                </span>
                <Badge variant={sale.saleType === 'cash' ? 'success' : 'info'} size="sm">
                  {sale.saleType}
                </Badge>
              </span>
            </li>
          ))}
        </WorklistCard>

        <WorklistCard
          title="Recent payments"
          icon={Wallet}
          onViewAll={hasPermission('payments') ? () => navigate('/payments') : undefined}
          isEmpty={recentPayments.length === 0}
          emptyIcon={Inbox}
          emptyMessage="No payments recorded yet."
        >
          {recentPayments.map((payment, index) => (
            <li
              key={payment._id}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-navy-50 transition-colors stagger"
              style={{ '--i': index }}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-navy-900 truncate">
                  {payment.customerName}
                </span>
                <span className="block text-2xs text-navy-500 tabular">
                  {payment.receiptNumber} · {timeAgo(payment.paymentDate)}
                </span>
              </span>

              <span className="text-right flex-shrink-0">
                <span className="block text-sm font-semibold text-success-700 tabular">
                  +{formatCurrency(payment.paymentAmount)}
                </span>
                <span className="text-2xs text-navy-400">{paymentMethodLabel(payment.paymentMethod)}</span>
              </span>
            </li>
          ))}
        </WorklistCard>
      </section>

      {/* Investor capital - only when there is capital to report */}
      {kpis.investorCapital > 0 && hasPermission('investors') && (
        <section className="card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-navy-950 text-gold-500 flex-shrink-0">
                <BriefcaseBusiness size={19} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy-950">Investor capital</p>
                <p className="text-2xs text-navy-500">
                  {counts.activeInvestors} active investor{counts.activeInvestors === 1 ? '' : 's'} ·
                  {' '}not included in Zakat
                </p>
              </div>
            </div>

            <div className="flex items-center gap-5">
              <div className="text-right">
                <p className="text-2xs text-navy-500">Capital</p>
                <p className="text-base font-display font-bold text-navy-950 tabular">
                  {formatCurrency(kpis.investorCapital)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xs text-navy-500">Profit due</p>
                <p className="text-base font-display font-bold text-warning-600 tabular">
                  {formatCurrency(kpis.investorProfitDue)}
                </p>
              </div>
              <Button variant="secondary" size="sm" iconRight={ArrowRight} onClick={() => navigate('/investors')}>
                Manage
              </Button>
            </div>
          </div>
        </section>
      )}

      <ReminderModal
        isOpen={reminderOpen}
        onClose={() => { setReminderOpen(false); load({ silent: true }); }}
        initialScope="overdue"
      />
    </div>
  );
}

/* ============================================================================
 * Local building blocks
 * ========================================================================== */

/** A titled panel wrapping a short list, with a consistent empty state. */
function WorklistCard({
  title, icon: Icon, count, countVariant = 'neutral',
  onViewAll, action, isEmpty, emptyIcon, emptyMessage, children,
}) {
  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-navy-100">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-navy-50 text-navy-600 flex-shrink-0">
              <Icon size={16} />
            </span>
          )}
          <h3 className="text-sm font-display font-semibold text-navy-950 truncate">{title}</h3>
          {count > 0 && <Badge variant={countVariant} size="sm">{count}</Badge>}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {action}
          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="inline-flex items-center gap-1 text-2xs font-semibold text-gold-600 hover:text-gold-700 transition-colors"
            >
              View all <ArrowRight size={11} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 p-1.5">
        {isEmpty ? (
          <EmptyState icon={emptyIcon} title="" message={emptyMessage} size="sm" />
        ) : (
          <ul className="space-y-0.5 max-h-72 overflow-y-auto scrollbar-thin">{children}</ul>
        )}
      </div>
    </div>
  );
}

/** One installment row in a worklist. */
function InstallmentRow({ item, index, overdue = false }) {
  return (
    <li
      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-navy-50 transition-colors stagger"
      style={{ '--i': index }}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-navy-900 truncate">{item.customerName}</span>
        <span className="block text-2xs text-navy-500 tabular">
          {item.invoiceNumber} · #{item.installmentNumber}
          {overdue && item.daysOverdue > 0 && (
            <span className="text-danger-600 font-medium"> · {item.daysOverdue}d late</span>
          )}
        </span>
      </span>

      <span className="text-right flex-shrink-0">
        <span
          className={cn(
            'block text-sm font-semibold tabular',
            overdue ? 'text-danger-600' : 'text-navy-950'
          )}
        >
          {formatCurrency(item.amount)}
        </span>
        {!overdue && (
          <span className="block text-2xs text-navy-400">{formatDate(item.dueDate)}</span>
        )}
      </span>
    </li>
  );
}
