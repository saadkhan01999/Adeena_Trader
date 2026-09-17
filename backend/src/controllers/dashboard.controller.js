/**
 * ============================================
 * Dashboard Controller
 * ============================================
 * Everything the home screen needs, in one request.
 *
 * Ownership awareness
 * -------------------
 * The dashboard respects the owner/partner selector. A record marked `shared`
 * is not counted in full for either side - it is split by the configured
 * partner percentage, so "My Share" and "Partner Share" genuinely add up to
 * "All Business" rather than double-counting.
 *
 * Cost of goods
 * -------------
 * A sale line stores the selling price, not the cost, so profit needs the
 * product's purchase price. Those are fetched in one batched query rather than
 * per line item - the previous implementation read a non-existent
 * `item.purchasePrice` and therefore always reported profit as if cost were
 * zero.
 */

import Sale from '../models/Sale.js';
import Payment from '../models/Payment.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
import Expense from '../models/Expense.js';
import Investor from '../models/Investor.js';
import Supplier from '../models/Supplier.js';
import Category from '../models/Category.js';
import Notification from '../models/Notification.js';
import Settings from '../models/Settings.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { calculateOwnershipShare, parseNumber, daysBetween } from '../utils/financialEngine.js';

/** Midnight today. */
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/** `YYYY-MM-DD`. */
const dayKey = (date) => new Date(date).toISOString().slice(0, 10);

/**
 * GET /api/dashboard?ownership=all|owner|partner&days=7
 */
export const getDashboard = asyncHandler(async (req, res) => {
  const ownership = req.query.ownership || 'all';
  const trendDays = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 7), 90);

  const settings = await Settings.getSingleton();
  const partnerPercent = settings.ownership.defaultPartnerShare;

  const today = startOfToday();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const trendStart = new Date(today.getTime() - (trendDays - 1) * 86_400_000);

  /** Take the selected side's slice of an amount. */
  const share = (amount, recordOwnership, recordPartnerPercent) => {
    if (ownership === 'all') return parseNumber(amount);
    const split = calculateOwnershipShare(
      amount,
      recordOwnership,
      recordPartnerPercent || partnerPercent
    );
    return ownership === 'owner' ? split.ownerAmount : split.partnerAmount;
  };

  /** Owner and partner views both include `shared` records. */
  const ownershipMatch = ownership === 'all' ? {} : { ownership: { $in: [ownership, 'shared'] } };

  // ==========================================================================
  // Fetch in parallel - these queries do not depend on each other
  // ==========================================================================
  const [
    trendSales,
    trendPayments,
    trendExpenses,
    openSales,
    products,
    suppliers,
    investorTotals,
    recentSales,
    recentPayments,
    customerCount,
    unreadNotifications,
  ] = await Promise.all([
    Sale.find({ saleDate: { $gte: trendStart }, status: { $ne: 'cancelled' }, ...ownershipMatch })
      .select('saleDate grandTotal advance saleType ownership items status invoiceNumber customerName'),

    Payment.find({ paymentDate: { $gte: trendStart }, status: 'completed', ...ownershipMatch })
      .select('paymentDate paymentAmount ownership'),

    Expense.find({ expenseDate: { $gte: trendStart }, ...ownershipMatch })
      .select('expenseDate amount ownership category'),

    Sale.find({ saleType: 'installment', status: { $in: ['ongoing', 'overdue'] }, ...ownershipMatch })
      .select('invoiceNumber customer customerName customerPhone installments remainingBalance ownership'),

    Product.find({ status: { $ne: 'archived' }, ...ownershipMatch })
      .select('name stock lowStockThreshold purchasePrice cashPrice ownership partnerSharePercent category'),

    Supplier.find({ payable: { $gt: 0 } }).select('name payable'),

    Investor.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: null,
          capital: { $sum: '$totalInvestment' },
          profitDue: { $sum: '$profitRemaining' },
          count: { $sum: 1 },
        },
      },
    ]),

    Sale.find(ownershipMatch)
      .select('invoiceNumber customerName grandTotal saleType status saleDate')
      .sort({ saleDate: -1 })
      .limit(6),

    Payment.find({ status: 'completed', ...ownershipMatch })
      .select('receiptNumber customerName paymentAmount paymentMethod paymentDate')
      .sort({ paymentDate: -1 })
      .limit(6),

    Customer.countDocuments({ status: 'active' }),

    Notification.countDocuments({ isRead: false, isDeleted: false }),
  ]);

  // ==========================================================================
  // Cost of goods - one batched product lookup for every sale line
  // ==========================================================================
  const soldProductIds = [
    ...new Set(trendSales.flatMap((s) => s.items.map((i) => String(i.product)))),
  ];
  const costLookup = await Product.find({ _id: { $in: soldProductIds } })
    .select('purchasePrice category')
    .lean();
  const costMap = new Map(costLookup.map((p) => [String(p._id), parseNumber(p.purchasePrice)]));

  /** Cost of goods for one sale, in this ownership view. */
  const saleCost = (sale) => {
    const gross = sale.items.reduce(
      (sum, item) => sum + (costMap.get(String(item.product)) || 0) * parseNumber(item.quantity),
      0
    );
    return share(gross, sale.ownership);
  };

  // ==========================================================================
  // Trend series - pre-seeded with every day so gaps render as zero, not as a
  // straight line implying continuous trading
  // ==========================================================================
  const series = new Map();
  for (let i = 0; i < trendDays; i += 1) {
    const key = dayKey(new Date(trendStart.getTime() + i * 86_400_000));
    series.set(key, { date: key, sales: 0, count: 0, collection: 0, payments: 0, expenses: 0, profit: 0 });
  }

  let todaysSales = 0;
  let todaysSalesCount = 0;
  let todaysCost = 0;
  let periodSales = 0;

  for (const sale of trendSales) {
    const value = share(sale.grandTotal, sale.ownership);
    const cost = saleCost(sale);

    const point = series.get(dayKey(sale.saleDate));
    if (point) {
      point.sales += value;
      point.count += 1;
      point.profit += value - cost;
    }

    periodSales += value;

    if (sale.saleDate >= today && sale.saleDate < tomorrow) {
      todaysSales += value;
      todaysSalesCount += 1;
      todaysCost += cost;
    }
  }

  let todaysCollection = 0;
  let todaysPaymentCount = 0;

  for (const payment of trendPayments) {
    const value = share(payment.paymentAmount, payment.ownership);
    const point = series.get(dayKey(payment.paymentDate));
    if (point) {
      point.collection += value;
      point.payments += 1;
    }
    if (payment.paymentDate >= today && payment.paymentDate < tomorrow) {
      todaysCollection += value;
      todaysPaymentCount += 1;
    }
  }

  let todaysExpenses = 0;
  const expenseByCategory = new Map();

  for (const expense of trendExpenses) {
    const value = share(expense.amount, expense.ownership);
    const point = series.get(dayKey(expense.expenseDate));
    if (point) point.expenses += value;

    expenseByCategory.set(expense.category, (expenseByCategory.get(expense.category) || 0) + value);

    if (expense.expenseDate >= today && expense.expenseDate < tomorrow) {
      todaysExpenses += value;
    }
  }

  const chartSeries = Array.from(series.values()).sort((a, b) => a.date.localeCompare(b.date));

  // ==========================================================================
  // Receivables, overdue, due today, upcoming
  // ==========================================================================
  const upcomingHorizon = settings.notification.upcomingDueDays;

  let totalReceivable = 0;
  let overdueAmount = 0;
  let overdueCount = 0;
  const dueToday = [];
  const upcoming = [];
  const overdueList = [];

  for (const sale of openSales) {
    totalReceivable += share(sale.remainingBalance, sale.ownership);

    for (const inst of sale.installments) {
      if (inst.status === 'paid' || inst.remaining <= 0) continue;

      const amount = share(inst.remaining, sale.ownership);
      const daysUntil = daysBetween(today, inst.dueDate);

      const entry = {
        saleId: sale._id,
        customerId: sale.customer,
        invoiceNumber: sale.invoiceNumber,
        customerName: sale.customerName,
        customerPhone: sale.customerPhone,
        installmentNumber: inst.number,
        dueDate: inst.dueDate,
        amount,
        daysOverdue: daysUntil < 0 ? Math.abs(daysUntil) : 0,
      };

      if (daysUntil < 0) {
        overdueAmount += amount;
        overdueCount += 1;
        overdueList.push(entry);
      } else if (daysUntil === 0) {
        dueToday.push(entry);
      } else if (daysUntil <= upcomingHorizon) {
        upcoming.push(entry);
      }
    }
  }

  // Worst first - that is the order a recovery officer works in
  overdueList.sort((a, b) => b.daysOverdue - a.daysOverdue);
  upcoming.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  // ==========================================================================
  // Stock
  // ==========================================================================
  let stockValue = 0;
  let stockRetailValue = 0;
  const lowStock = [];
  let outOfStockCount = 0;

  for (const product of products) {
    stockValue += share(
      parseNumber(product.purchasePrice) * parseNumber(product.stock),
      product.ownership,
      product.partnerSharePercent
    );
    stockRetailValue += share(
      parseNumber(product.cashPrice) * parseNumber(product.stock),
      product.ownership,
      product.partnerSharePercent
    );

    if (product.stock === 0) outOfStockCount += 1;
    else if (product.stock <= product.lowStockThreshold) {
      lowStock.push({
        id: product._id,
        name: product.name,
        stock: product.stock,
        threshold: product.lowStockThreshold,
      });
    }
  }
  lowStock.sort((a, b) => a.stock - b.stock);

  // ==========================================================================
  // Category mix
  // ==========================================================================
  const categoryIds = [...new Set(costLookup.map((p) => String(p.category)).filter(Boolean))];
  const categories = await Category.find({ _id: { $in: categoryIds } }).select('name').lean();
  const categoryNames = new Map(categories.map((c) => [String(c._id), c.name]));
  const productCategory = new Map(costLookup.map((p) => [String(p._id), String(p.category)]));

  const byCategory = new Map();
  for (const sale of trendSales) {
    for (const item of sale.items) {
      const name = categoryNames.get(productCategory.get(String(item.product))) || 'Uncategorised';
      byCategory.set(name, (byCategory.get(name) || 0) + share(item.total, sale.ownership));
    }
  }

  // ==========================================================================
  // Supplier payables - split by ownership, since the debt is the business's
  // ==========================================================================
  const grossPayable = suppliers.reduce((sum, s) => sum + parseNumber(s.payable), 0);
  const purchasePayable =
    ownership === 'all'
      ? grossPayable
      : ownership === 'owner'
        ? Math.round((grossPayable * (100 - partnerPercent)) / 100)
        : Math.round((grossPayable * partnerPercent) / 100);

  const investors = investorTotals[0] || { capital: 0, profitDue: 0, count: 0 };

  // ==========================================================================
  // Period totals for the trend badges
  // ==========================================================================
  const periodProfit = chartSeries.reduce((sum, d) => sum + d.profit, 0);
  const periodExpenses = chartSeries.reduce((sum, d) => sum + d.expenses, 0);
  const periodCollection = chartSeries.reduce((sum, d) => sum + d.collection, 0);

  return sendSuccess(res, {
    meta: { ownership, trendDays, generatedAt: new Date(), partnerPercent },

    kpis: {
      todaysSales,
      todaysCollection,
      todaysExpenses,
      // Today's gross profit, after cost of goods and today's expenses
      netProfit: todaysSales - todaysCost - todaysExpenses,
      totalReceivable,
      overdue: overdueAmount,
      stockValue,
      stockRetailValue,
      purchasePayable,
      investorCapital: investors.capital,
      investorProfitDue: investors.profitDue,
      periodSales,
      periodCollection,
      periodProfit,
      periodExpenses,
    },

    charts: {
      trend: chartSeries,
      // Kept under their previous names so existing chart code stays valid
      sales: chartSeries.map((d) => ({ date: d.date, sales: d.sales, count: d.count })),
      collection: chartSeries.map((d) => ({ date: d.date, collection: d.collection, count: d.payments })),
      categorySales: Array.from(byCategory, ([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8),
      expenseBreakdown: Array.from(expenseByCategory, ([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total),
    },

    installmentsDueToday: dueToday,
    upcomingInstallments: upcoming.slice(0, 10),
    overdueInstallments: overdueList.slice(0, 10),
    lowStockProducts: lowStock.slice(0, 6),
    recentSales,
    recentPayments,

    counts: {
      totalProducts: products.length,
      lowStockCount: lowStock.length,
      outOfStockCount,
      dueTodayCount: dueToday.length,
      upcomingCount: upcoming.length,
      overdueCount,
      activeCustomers: customerCount,
      activeInvestors: investors.count,
      suppliersOwed: suppliers.length,
      unreadNotifications,
      todaysSalesCount,
      todaysPaymentCount,
    },
  });
});
