/**
 * ============================================
 * Reports Controller
 * ============================================
 * Every figure on the Reports screen is aggregated from live collections -
 * there is no sample or placeholder data anywhere in this file.
 *
 * Shape of a report response
 * --------------------------
 *   { meta, summary, series, breakdown, rows }
 *
 *   meta      - what was asked for (type, range, ownership) so the printed
 *               header can state it
 *   summary   - the KPI tiles
 *   series    - time-bucketed data for the line/bar charts
 *   breakdown - categorical data for the pie chart
 *   rows      - the detail table, and the exact rows a CSV export writes
 *
 * Keeping every report on one contract means the frontend renders any of them
 * with a single component instead of seven bespoke ones.
 */

import Sale from '../models/Sale.js';
import Payment from '../models/Payment.js';
import Purchase from '../models/Purchase.js';
import Product from '../models/Product.js';
import Expense from '../models/Expense.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import Category from '../models/Category.js';
import Partner from '../models/Partner.js';
import { ZakatCalculation } from '../models/Zakat.js';
import Settings from '../models/Settings.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { BadRequestError } from '../utils/AppError.js';
import { calculateOwnershipShare, parseNumber } from '../utils/financialEngine.js';

// ============================================================================
// Shared helpers
// ============================================================================

/**
 * Resolve the requested window, defaulting to the last 30 days.
 * `end` is pushed to 23:59:59 so a same-day range includes today's activity -
 * otherwise "today to today" silently returns nothing.
 */
const resolveRange = (startDate, endDate) => {
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);

  const start = startDate ? new Date(startDate) : new Date(end.getTime() - 29 * 86_400_000);
  start.setHours(0, 0, 0, 0);

  if (start > end) throw new BadRequestError('The start date must be on or before the end date.');
  return { start, end };
};

/**
 * Translate the ownership selector into a Mongo filter.
 * 'owner' and 'partner' both include 'shared' records, because a shared record
 * contributes a slice to each side; the slicing itself happens in `share()`.
 */
const ownershipFilter = (ownership) => {
  if (!ownership || ownership === 'all') return {};
  return { ownership: { $in: [ownership, 'shared'] } };
};

/**
 * Take one side's slice of an amount, honouring the configured partner share.
 * Returns the full amount when viewing "All Business".
 */
const share = (amount, recordOwnership, ownership, partnerPercent) => {
  if (!ownership || ownership === 'all') return parseNumber(amount);
  const split = calculateOwnershipShare(amount, recordOwnership, partnerPercent);
  return ownership === 'owner' ? split.ownerAmount : split.partnerAmount;
};

/** `YYYY-MM-DD` bucket key. */
const dayKey = (date) => new Date(date).toISOString().slice(0, 10);

/**
 * Build a zero-filled day series across the range.
 *
 * Pre-seeding every day matters: without it a chart skips days with no trade
 * and the line implies continuous activity that did not happen.
 */
const emptySeries = (start, end) => {
  const series = new Map();
  const cursor = new Date(start);
  while (cursor <= end) {
    series.set(dayKey(cursor), { date: dayKey(cursor) });
    cursor.setDate(cursor.getDate() + 1);
  }
  return series;
};

/** Convert the series Map into the sorted array Recharts expects. */
const toSeriesArray = (series, defaults) =>
  Array.from(series.values())
    .map((point) => ({ ...defaults, ...point }))
    .sort((a, b) => a.date.localeCompare(b.date));

// ============================================================================
// Individual reports
// ============================================================================

/** Sales: what was sold, to whom, cash vs installment. */
const salesReport = async ({ start, end, ownership, partnerPercent }) => {
  const sales = await Sale.find({
    saleDate: { $gte: start, $lte: end },
    status: { $ne: 'cancelled' },
    ...ownershipFilter(ownership),
  })
    .populate('items.product', 'name category purchasePrice')
    .sort({ saleDate: -1 });

  const series = emptySeries(start, end);
  let totalSales = 0;
  let cashSales = 0;
  let installmentSales = 0;
  let totalAdvance = 0;
  let totalCost = 0;

  const rows = [];

  for (const sale of sales) {
    const value = share(sale.grandTotal, sale.ownership, ownership, partnerPercent);
    const advance = share(sale.advance, sale.ownership, ownership, partnerPercent);

    // Cost of goods sold, from the purchase price captured on each product
    const cost = sale.items.reduce(
      (sum, item) => sum + parseNumber(item.product?.purchasePrice) * parseNumber(item.quantity),
      0
    );
    const ownedCost = share(cost, sale.ownership, ownership, partnerPercent);

    totalSales += value;
    totalAdvance += advance;
    totalCost += ownedCost;
    if (sale.saleType === 'cash') cashSales += value;
    else installmentSales += value;

    const key = dayKey(sale.saleDate);
    const point = series.get(key) || { date: key };
    point.sales = (point.sales || 0) + value;
    point.count = (point.count || 0) + 1;
    point.cash = (point.cash || 0) + (sale.saleType === 'cash' ? value : 0);
    point.installment = (point.installment || 0) + (sale.saleType === 'installment' ? value : 0);
    series.set(key, point);

    rows.push({
      date: sale.saleDate,
      invoiceNumber: sale.invoiceNumber,
      customer: sale.customerName,
      phone: sale.customerPhone,
      items: sale.items.map((i) => `${i.quantity} x ${i.productName}`).join(', '),
      saleType: sale.saleType,
      plan: sale.installmentPlan || '',
      grandTotal: value,
      advance,
      balance: share(sale.remainingBalance, sale.ownership, ownership, partnerPercent),
      status: sale.status,
    });
  }

  // Category mix for the pie chart
  const categoryIds = [
    ...new Set(sales.flatMap((s) => s.items.map((i) => i.product?.category).filter(Boolean))),
  ];
  const categories = await Category.find({ _id: { $in: categoryIds } }).select('name');
  const categoryNames = new Map(categories.map((c) => [c._id.toString(), c.name]));

  const byCategory = new Map();
  for (const sale of sales) {
    for (const item of sale.items) {
      const name = categoryNames.get(String(item.product?.category)) || 'Uncategorised';
      const value = share(item.total, sale.ownership, ownership, partnerPercent);
      byCategory.set(name, (byCategory.get(name) || 0) + value);
    }
  }

  return {
    summary: {
      totalSales,
      cashSales,
      installmentSales,
      totalAdvance,
      grossProfit: totalSales - totalCost,
      invoiceCount: sales.length,
      averageSale: sales.length ? Math.round(totalSales / sales.length) : 0,
    },
    series: toSeriesArray(series, { sales: 0, count: 0, cash: 0, installment: 0 }),
    breakdown: Array.from(byCategory, ([name, value]) => ({ name, value })).sort(
      (a, b) => b.value - a.value
    ),
    rows,
  };
};

/** Collection: cash actually received, by day and by method. */
const collectionReport = async ({ start, end, ownership, partnerPercent }) => {
  const payments = await Payment.find({
    paymentDate: { $gte: start, $lte: end },
    status: 'completed',
    ...ownershipFilter(ownership),
  }).sort({ paymentDate: -1 });

  const series = emptySeries(start, end);
  const byMethod = new Map();
  let totalCollection = 0;

  const rows = payments.map((payment) => {
    const value = share(payment.paymentAmount, payment.ownership, ownership, partnerPercent);
    totalCollection += value;

    const key = dayKey(payment.paymentDate);
    const point = series.get(key) || { date: key };
    point.collection = (point.collection || 0) + value;
    point.count = (point.count || 0) + 1;
    series.set(key, point);

    byMethod.set(payment.paymentMethod, (byMethod.get(payment.paymentMethod) || 0) + value);

    return {
      date: payment.paymentDate,
      receiptNumber: payment.receiptNumber,
      customer: payment.customerName,
      phone: payment.customerPhone,
      method: payment.paymentMethod,
      reference: payment.referenceNumber,
      amount: value,
      balanceAfter: payment.remainingBalance,
    };
  });

  return {
    summary: {
      totalCollection,
      paymentCount: payments.length,
      averagePayment: payments.length ? Math.round(totalCollection / payments.length) : 0,
      largestPayment: payments.length ? Math.max(...rows.map((r) => r.amount)) : 0,
    },
    series: toSeriesArray(series, { collection: 0, count: 0 }),
    breakdown: Array.from(byMethod, ([name, value]) => ({ name, value })),
    rows,
  };
};

/**
 * Profit & Loss.
 *
 * Revenue is recognised at the point of sale (accrual basis), which is the
 * correct treatment for an installment business: the profit is earned when the
 * goods are handed over, not when the last installment lands months later.
 * Collection is reported separately in the cash-flow tiles.
 */
const profitReport = async ({ start, end, ownership, partnerPercent }) => {
  const [sales, expenses, payments] = await Promise.all([
    Sale.find({
      saleDate: { $gte: start, $lte: end },
      status: { $ne: 'cancelled' },
      ...ownershipFilter(ownership),
    }).populate('items.product', 'purchasePrice name'),
    Expense.find({ expenseDate: { $gte: start, $lte: end }, ...ownershipFilter(ownership) }),
    Payment.find({ paymentDate: { $gte: start, $lte: end }, status: 'completed', ...ownershipFilter(ownership) }),
  ]);

  const series = emptySeries(start, end);
  let revenue = 0;
  let costOfGoods = 0;
  let totalExpenses = 0;

  for (const sale of sales) {
    const value = share(sale.grandTotal, sale.ownership, ownership, partnerPercent);
    const cost = sale.items.reduce(
      (sum, i) => sum + parseNumber(i.product?.purchasePrice) * parseNumber(i.quantity),
      0
    );
    const ownedCost = share(cost, sale.ownership, ownership, partnerPercent);

    revenue += value;
    costOfGoods += ownedCost;

    const key = dayKey(sale.saleDate);
    const point = series.get(key) || { date: key };
    point.revenue = (point.revenue || 0) + value;
    point.cost = (point.cost || 0) + ownedCost;
    point.grossProfit = (point.grossProfit || 0) + (value - ownedCost);
    series.set(key, point);
  }

  const expenseByCategory = new Map();
  for (const expense of expenses) {
    const value = share(expense.amount, expense.ownership, ownership, partnerPercent);
    totalExpenses += value;
    expenseByCategory.set(expense.category, (expenseByCategory.get(expense.category) || 0) + value);

    const key = dayKey(expense.expenseDate);
    const point = series.get(key) || { date: key };
    point.expenses = (point.expenses || 0) + value;
    series.set(key, point);
  }

  const grossProfit = revenue - costOfGoods;
  const netProfit = grossProfit - totalExpenses;
  const collected = payments.reduce(
    (s, p) => s + share(p.paymentAmount, p.ownership, ownership, partnerPercent),
    0
  );

  // The detail table is the P&L statement itself, one line per caption
  const rows = [
    { line: 'Revenue (sales invoiced)', amount: revenue, type: 'income' },
    { line: 'Less: Cost of goods sold', amount: -costOfGoods, type: 'cost' },
    { line: 'Gross Profit', amount: grossProfit, type: 'subtotal' },
    ...Array.from(expenseByCategory, ([category, amount]) => ({
      line: `Less: ${category}`,
      amount: -amount,
      type: 'expense',
    })),
    { line: 'Net Profit', amount: netProfit, type: 'total' },
  ];

  return {
    summary: {
      revenue,
      costOfGoods,
      grossProfit,
      totalExpenses,
      netProfit,
      collected,
      grossMargin: revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0,
      netMargin: revenue > 0 ? Math.round((netProfit / revenue) * 1000) / 10 : 0,
    },
    series: toSeriesArray(series, { revenue: 0, cost: 0, grossProfit: 0, expenses: 0 }),
    breakdown: Array.from(expenseByCategory, ([name, value]) => ({ name, value })).sort(
      (a, b) => b.value - a.value
    ),
    rows,
  };
};

/**
 * Stock valuation - a point-in-time snapshot, so the date range does not apply.
 */
const stockReport = async ({ ownership, partnerPercent }) => {
  const products = await Product.find({
    status: { $ne: 'archived' },
    ...ownershipFilter(ownership),
  })
    .populate('category', 'name')
    .sort({ name: 1 });

  const byCategory = new Map();
  let costValue = 0;
  let retailValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let totalUnits = 0;

  const rows = products.map((product) => {
    const cost = parseNumber(product.purchasePrice) * parseNumber(product.stock);
    const retail = parseNumber(product.cashPrice) * parseNumber(product.stock);

    const ownedCost = share(cost, product.ownership, ownership, product.partnerSharePercent || partnerPercent);
    const ownedRetail = share(retail, product.ownership, ownership, product.partnerSharePercent || partnerPercent);

    costValue += ownedCost;
    retailValue += ownedRetail;
    totalUnits += parseNumber(product.stock);

    if (product.stock === 0) outOfStockCount += 1;
    else if (product.stock <= product.lowStockThreshold) lowStockCount += 1;

    const categoryName = product.category?.name || 'Uncategorised';
    byCategory.set(categoryName, (byCategory.get(categoryName) || 0) + ownedCost);

    return {
      name: product.name,
      category: categoryName,
      brand: product.brand,
      stock: product.stock,
      purchasePrice: product.purchasePrice,
      cashPrice: product.cashPrice,
      installmentPrice: product.installmentPrice,
      stockValue: ownedCost,
      retailValue: ownedRetail,
      ownership: product.ownership,
      status: product.stock === 0 ? 'Out of stock' : product.stock <= product.lowStockThreshold ? 'Low stock' : 'In stock',
    };
  });

  return {
    summary: {
      productCount: products.length,
      totalUnits,
      costValue,
      retailValue,
      potentialProfit: retailValue - costValue,
      lowStockCount,
      outOfStockCount,
    },
    series: [],
    breakdown: Array.from(byCategory, ([name, value]) => ({ name, value })).sort(
      (a, b) => b.value - a.value
    ),
    rows,
  };
};

/** Receivables ageing - who owes what, and how late they are. */
const receivablesReport = async ({ ownership, partnerPercent }) => {
  const sales = await Sale.find({
    saleType: 'installment',
    status: { $in: ['ongoing', 'overdue'] },
    ...ownershipFilter(ownership),
  }).sort({ saleDate: 1 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Standard ageing buckets used in receivables analysis
  const buckets = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  let totalReceivable = 0;
  let totalOverdue = 0;

  const rows = sales.map((sale) => {
    const balance = share(sale.remainingBalance, sale.ownership, ownership, partnerPercent);
    totalReceivable += balance;

    let oldestOverdueDays = 0;
    let overdueAmount = 0;

    for (const inst of sale.installments) {
      if (inst.status === 'paid' || inst.remaining <= 0) continue;
      const due = new Date(inst.dueDate);
      due.setHours(0, 0, 0, 0);
      const daysLate = Math.round((today - due) / 86_400_000);

      const amount = share(inst.remaining, sale.ownership, ownership, partnerPercent);

      if (daysLate <= 0) buckets.current += amount;
      else {
        overdueAmount += amount;
        oldestOverdueDays = Math.max(oldestOverdueDays, daysLate);
        if (daysLate <= 30) buckets['1-30'] += amount;
        else if (daysLate <= 60) buckets['31-60'] += amount;
        else if (daysLate <= 90) buckets['61-90'] += amount;
        else buckets['90+'] += amount;
      }
    }

    totalOverdue += overdueAmount;

    return {
      invoiceNumber: sale.invoiceNumber,
      customer: sale.customerName,
      phone: sale.customerPhone,
      saleDate: sale.saleDate,
      grandTotal: sale.grandTotal,
      paid: sale.grandTotal - sale.remainingBalance,
      balance,
      overdueAmount,
      daysOverdue: oldestOverdueDays,
      plan: sale.installmentPlan,
      status: sale.status,
    };
  });

  // Worst accounts first - that is the order a recovery officer works in
  rows.sort((a, b) => b.daysOverdue - a.daysOverdue || b.balance - a.balance);

  return {
    summary: {
      totalReceivable,
      totalOverdue,
      currentDue: buckets.current,
      accountCount: rows.length,
      overdueAccounts: rows.filter((r) => r.overdueAmount > 0).length,
      collectionRate:
        totalReceivable > 0
          ? Math.round(((totalReceivable - totalOverdue) / totalReceivable) * 1000) / 10
          : 100,
    },
    series: [],
    breakdown: Object.entries(buckets).map(([name, value]) => ({
      name: name === 'current' ? 'Not yet due' : `${name} days`,
      value,
    })),
    rows,
  };
};

/** Expenses by day and category. */
const expensesReport = async ({ start, end, ownership, partnerPercent }) => {
  const expenses = await Expense.find({
    expenseDate: { $gte: start, $lte: end },
    ...ownershipFilter(ownership),
  })
    .populate('partner', 'name')
    .sort({ expenseDate: -1 });

  const series = emptySeries(start, end);
  const byCategory = new Map();
  let total = 0;

  const rows = expenses.map((expense) => {
    const value = share(expense.amount, expense.ownership, ownership, partnerPercent);
    total += value;

    const key = dayKey(expense.expenseDate);
    const point = series.get(key) || { date: key };
    point.expenses = (point.expenses || 0) + value;
    series.set(key, point);

    byCategory.set(expense.category, (byCategory.get(expense.category) || 0) + value);

    return {
      date: expense.expenseDate,
      category: expense.category,
      description: expense.description,
      paidTo: expense.paidTo,
      method: expense.paymentMethod,
      ownership: expense.ownership,
      partner: expense.partner?.name || '',
      amount: value,
    };
  });

  const days = Math.max(1, Math.round((end - start) / 86_400_000) + 1);

  return {
    summary: {
      totalExpenses: total,
      entryCount: expenses.length,
      dailyAverage: Math.round(total / days),
      largestCategory:
        [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '-',
    },
    series: toSeriesArray(series, { expenses: 0 }),
    breakdown: Array.from(byCategory, ([name, value]) => ({ name, value })).sort(
      (a, b) => b.value - a.value
    ),
    rows,
  };
};

/** Zakat: every calculation recorded in the period, owner and partners only. */
const zakatReport = async ({ start, end }) => {
  const records = await ZakatCalculation.find({ calculationDate: { $gte: start, $lte: end } })
    .populate('partner', 'name ownershipPercent')
    .sort({ calculationDate: -1 });

  let totalZakat = 0;
  let totalPaid = 0;
  let totalNetAssets = 0;
  const byType = new Map();

  const rows = records.map((record) => {
    totalZakat += record.zakatAmount;
    totalPaid += record.amountPaid;
    totalNetAssets += record.netAssets;

    const label = record.ownershipType === 'owner' ? 'Owner' : record.partnerName || record.partner?.name || 'Partner';
    byType.set(label, (byType.get(label) || 0) + record.zakatAmount);

    return {
      date: record.calculationDate,
      year: record.zakatYear,
      for: label,
      stock: record.eligibleStock,
      receivables: record.receivables,
      cash: record.cash,
      bank: record.bankBalance,
      grossAssets: record.grossAssets,
      deductions: record.deductions,
      netAssets: record.netAssets,
      nisab: record.nisab,
      aboveNisab: record.isAboveNisab ? 'Yes' : 'No',
      zakatAmount: record.zakatAmount,
      paid: record.amountPaid,
      status: record.paymentStatus,
    };
  });

  return {
    summary: {
      totalZakat,
      totalPaid,
      outstanding: totalZakat - totalPaid,
      totalNetAssets,
      calculationCount: records.length,
    },
    series: [],
    breakdown: Array.from(byType, ([name, value]) => ({ name, value })),
    rows,
  };
};

/** Customer ranking by business value and payment behaviour. */
const customersReport = async ({ start, end }) => {
  const customers = await Customer.find({ status: { $ne: 'inactive' } }).sort({ totalSales: -1 });

  const payments = await Payment.aggregate([
    { $match: { paymentDate: { $gte: start, $lte: end }, status: 'completed' } },
    { $group: { _id: '$customer', paid: { $sum: '$paymentAmount' }, count: { $sum: 1 } } },
  ]);
  const paidMap = new Map(payments.map((p) => [String(p._id), p]));

  const rows = customers.map((customer) => {
    const recent = paidMap.get(String(customer._id));
    return {
      name: customer.name,
      phone: customer.mobile1,
      cnic: customer.cnic,
      totalSales: customer.totalSales,
      totalPaid: customer.totalPaid,
      outstanding: customer.outstanding,
      overdue: customer.overdue,
      paidInPeriod: recent?.paid || 0,
      paymentsInPeriod: recent?.count || 0,
      nextDueDate: customer.nextDueDate,
      status: customer.status,
    };
  });

  return {
    summary: {
      customerCount: customers.length,
      totalBusiness: rows.reduce((s, r) => s + r.totalSales, 0),
      totalOutstanding: rows.reduce((s, r) => s + r.outstanding, 0),
      collectedInPeriod: rows.reduce((s, r) => s + r.paidInPeriod, 0),
      customersWithOverdue: rows.filter((r) => r.overdue > 0).length,
    },
    series: [],
    breakdown: rows
      .slice(0, 8)
      .map((r) => ({ name: r.name, value: r.totalSales }))
      .filter((r) => r.value > 0),
    rows,
  };
};

/** Best-selling products by units and value in the period. */
const productsReport = async ({ start, end }) => {
  const sales = await Sale.find({
    saleDate: { $gte: start, $lte: end },
    status: { $ne: 'cancelled' },
  }).populate('items.product', 'name brand purchasePrice stock category');

  /** @type {Map<string, object>} */
  const tally = new Map();

  for (const sale of sales) {
    for (const item of sale.items) {
      const key = String(item.product?._id || item.productName);
      const entry = tally.get(key) || {
        name: item.productName,
        brand: item.product?.brand || '',
        unitsSold: 0,
        revenue: 0,
        cost: 0,
        stockLeft: item.product?.stock ?? 0,
      };

      entry.unitsSold += parseNumber(item.quantity);
      entry.revenue += parseNumber(item.total);
      entry.cost += parseNumber(item.product?.purchasePrice) * parseNumber(item.quantity);
      tally.set(key, entry);
    }
  }

  const rows = Array.from(tally.values())
    .map((r) => ({ ...r, profit: r.revenue - r.cost }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    summary: {
      productsSold: rows.length,
      unitsSold: rows.reduce((s, r) => s + r.unitsSold, 0),
      revenue: rows.reduce((s, r) => s + r.revenue, 0),
      profit: rows.reduce((s, r) => s + r.profit, 0),
      bestSeller: rows[0]?.name || '-',
    },
    series: [],
    breakdown: rows.slice(0, 8).map((r) => ({ name: r.name, value: r.revenue })),
    rows,
  };
};

/** Supplier payables. */
const suppliersReport = async () => {
  const suppliers = await Supplier.find().sort({ payable: -1 });
  const purchases = await Purchase.aggregate([
    { $group: { _id: '$supplier', total: { $sum: '$subtotal' }, count: { $sum: 1 } } },
  ]);
  const purchaseMap = new Map(purchases.map((p) => [String(p._id), p]));

  const rows = suppliers.map((supplier) => {
    const stats = purchaseMap.get(String(supplier._id));
    return {
      name: supplier.name,
      phone: supplier.phone,
      contactPerson: supplier.contactPerson,
      totalPurchases: supplier.totalPurchases,
      totalPaid: supplier.totalPaid,
      payable: supplier.payable,
      purchaseCount: stats?.count || 0,
      status: supplier.status,
    };
  });

  return {
    summary: {
      supplierCount: suppliers.length,
      totalPurchases: rows.reduce((s, r) => s + r.totalPurchases, 0),
      totalPayable: rows.reduce((s, r) => s + r.payable, 0),
      suppliersOwed: rows.filter((r) => r.payable > 0).length,
    },
    series: [],
    breakdown: rows.filter((r) => r.payable > 0).slice(0, 8).map((r) => ({ name: r.name, value: r.payable })),
    rows,
  };
};

// ============================================================================
// Dispatcher
// ============================================================================

/** Report id -> builder, plus the column set used for table rendering and CSV. */
const REPORTS = {
  sales: {
    label: 'Sales Report',
    build: salesReport,
    columns: ['date', 'invoiceNumber', 'customer', 'phone', 'items', 'saleType', 'plan', 'grandTotal', 'advance', 'balance', 'status'],
  },
  collection: {
    label: 'Collection Report',
    build: collectionReport,
    columns: ['date', 'receiptNumber', 'customer', 'phone', 'method', 'reference', 'amount', 'balanceAfter'],
  },
  profit: {
    label: 'Profit & Loss Statement',
    build: profitReport,
    columns: ['line', 'amount'],
  },
  stock: {
    label: 'Stock Valuation',
    build: stockReport,
    columns: ['name', 'category', 'brand', 'stock', 'purchasePrice', 'cashPrice', 'stockValue', 'retailValue', 'ownership', 'status'],
  },
  receivables: {
    label: 'Receivables & Ageing',
    build: receivablesReport,
    columns: ['invoiceNumber', 'customer', 'phone', 'saleDate', 'grandTotal', 'paid', 'balance', 'overdueAmount', 'daysOverdue', 'status'],
  },
  expenses: {
    label: 'Expense Report',
    build: expensesReport,
    columns: ['date', 'category', 'description', 'paidTo', 'method', 'ownership', 'amount'],
  },
  zakat: {
    label: 'Zakat Report',
    build: zakatReport,
    columns: ['date', 'year', 'for', 'stock', 'receivables', 'cash', 'bank', 'grossAssets', 'deductions', 'netAssets', 'nisab', 'aboveNisab', 'zakatAmount', 'paid', 'status'],
  },
  customers: {
    label: 'Customer Report',
    build: customersReport,
    columns: ['name', 'phone', 'cnic', 'totalSales', 'totalPaid', 'outstanding', 'overdue', 'paidInPeriod', 'status'],
  },
  products: {
    label: 'Product Performance',
    build: productsReport,
    columns: ['name', 'brand', 'unitsSold', 'revenue', 'cost', 'profit', 'stockLeft'],
  },
  suppliers: {
    label: 'Supplier Payables',
    build: suppliersReport,
    columns: ['name', 'phone', 'contactPerson', 'totalPurchases', 'totalPaid', 'payable', 'status'],
  },
};

/**
 * GET /api/reports/:type
 * Query: startDate, endDate, ownership
 */
export const getReport = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const definition = REPORTS[type];

  if (!definition) {
    throw new BadRequestError(
      `Unknown report "${type}". Available: ${Object.keys(REPORTS).join(', ')}.`
    );
  }

  const { startDate, endDate, ownership = 'all' } = req.query;
  const { start, end } = resolveRange(startDate, endDate);

  const settings = await Settings.getSingleton();
  const partnerPercent = settings.ownership.defaultPartnerShare;

  const result = await definition.build({ start, end, ownership, partnerPercent });

  return sendSuccess(res, {
    meta: {
      type,
      label: definition.label,
      columns: definition.columns,
      startDate: start,
      endDate: end,
      ownership,
      generatedAt: new Date(),
      // Snapshot reports ignore the date range; the UI hides the picker for these
      isPointInTime: ['stock', 'receivables', 'suppliers'].includes(type),
    },
    ...result,
  });
});

/**
 * GET /api/reports
 * The catalogue the Reports screen builds its type selector from.
 */
export const listReports = asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    reports: Object.entries(REPORTS).map(([type, def]) => ({
      type,
      label: def.label,
      columns: def.columns,
      isPointInTime: ['stock', 'receivables', 'suppliers'].includes(type),
    })),
  });
});

/**
 * GET /api/reports/:type/export
 * Stream the report's rows as CSV.
 *
 * Generated server-side so the export contains the complete result set, not
 * just the page the user happens to be looking at.
 */
export const exportReport = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const definition = REPORTS[type];
  if (!definition) throw new BadRequestError(`Unknown report "${type}".`);

  const { startDate, endDate, ownership = 'all' } = req.query;
  const { start, end } = resolveRange(startDate, endDate);

  const settings = await Settings.getSingleton();
  const result = await definition.build({
    start,
    end,
    ownership,
    partnerPercent: settings.ownership.defaultPartnerShare,
  });

  /**
   * Escape a CSV cell.
   *
   * A leading =, +, - or @ is prefixed with a single quote: Excel would
   * otherwise treat the cell as a formula, which is a well-known injection
   * route when the value came from a customer-supplied name or note.
   */
  const escape = (value) => {
    if (value === null || value === undefined) return '';
    let str = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
    if (/^[=+\-@]/.test(str)) str = `'${str}`;
    return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const headers = definition.columns;
  const lines = [
    headers.map((h) => escape(h.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()))).join(','),
    ...result.rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ];

  const filename = `${type}-report-${start.toISOString().slice(0, 10)}-to-${end.toISOString().slice(0, 10)}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  // BOM so Excel opens UTF-8 correctly (matters for names with Urdu characters)
  return res.send(`﻿${lines.join('\r\n')}`);
});
