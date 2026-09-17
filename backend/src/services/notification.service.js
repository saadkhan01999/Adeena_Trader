/**
 * ============================================
 * Notification Service
 * ============================================
 * Turns live business state into actionable alerts.
 *
 * Design
 * ------
 * Notifications are *derived*, not hand-written. A sweep inspects the data
 * (due installments, low stock, supplier payables, investor payouts, Zakat
 * hawl) and raises one notification per real-world condition.
 *
 * De-duplication is the hard part: the sweep runs every 30 minutes, so naively
 * inserting would produce 48 identical "Stock is low" rows a day. Each alert
 * therefore carries a deterministic `dedupeKey` (type + record + day) and
 * insertion goes through an upsert on that key. Re-running the sweep is a
 * no-op; the badge count stays honest.
 */

import Notification from '../models/Notification.js';
import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import Supplier from '../models/Supplier.js';
import Investor from '../models/Investor.js';
import Settings from '../models/Settings.js';
import { ZakatSettings } from '../models/Zakat.js';
import { refreshInstallmentStatuses } from './financial.service.js';
import { parseNumber, daysBetween, formatPKR, calculateHawlProgress } from '../utils/financialEngine.js';

/** `YYYY-MM-DD` for the current day - the granularity of de-duplication. */
const todayKey = () => new Date().toISOString().slice(0, 10);

/**
 * Insert a notification unless an identical one already exists for today.
 * Returns true when a new row was created.
 */
const raise = async (notification) => {
  const result = await Notification.updateOne(
    { dedupeKey: notification.dedupeKey },
    {
      $setOnInsert: { ...notification, isRead: false, isDeleted: false, createdAt: new Date() },
      // Message text is refreshed even on an existing alert, so a growing
      // overdue figure stays accurate without creating a duplicate row.
      $set: { message: notification.message, severity: notification.severity },
    },
    { upsert: true }
  );
  return Boolean(result.upsertedCount);
};

// ============================================================================
// Individual checks
// ============================================================================

/**
 * Installments that are due today, coming up soon, or already overdue.
 * Overdue items are aggregated per customer rather than per installment, so a
 * customer four months behind produces one urgent alert, not four.
 */
const checkInstallments = async (settings) => {
  const horizon = settings.notification.upcomingDueDays;
  const created = { due: 0, overdue: 0, upcoming: 0 };

  const sales = await Sale.find({
    saleType: 'installment',
    status: { $in: ['ongoing', 'overdue'] },
  }).select('invoiceNumber customer customerName customerPhone installments remainingBalance');

  /** @type {Map<string, {name:string, total:number, count:number, saleId:string}>} */
  const overdueByCustomer = new Map();

  for (const sale of sales) {
    for (const inst of sale.installments) {
      if (inst.status === 'paid' || inst.remaining <= 0) continue;

      const daysUntil = daysBetween(new Date(), inst.dueDate);

      // --- Overdue: accumulate per customer
      if (daysUntil < 0) {
        const key = sale.customer.toString();
        const entry = overdueByCustomer.get(key) || {
          name: sale.customerName,
          total: 0,
          count: 0,
          saleId: sale._id.toString(),
        };
        entry.total += parseNumber(inst.remaining);
        entry.count += 1;
        overdueByCustomer.set(key, entry);
        continue;
      }

      // --- Due today
      if (daysUntil === 0) {
        const isNew = await raise({
          type: 'installment_due',
          title: `Installment due today - ${sale.customerName}`,
          message: `Installment #${inst.number} of ${formatPKR(inst.remaining)} on invoice ${sale.invoiceNumber} is due today.`,
          severity: 'warning',
          referenceType: 'sale',
          referenceId: sale._id,
          actionPath: '/installments',
          dedupeKey: `installment_due:${sale._id}:${inst.number}:${todayKey()}`,
        });
        if (isNew) created.due += 1;
        continue;
      }

      // --- Upcoming inside the configured horizon
      if (daysUntil <= horizon) {
        const isNew = await raise({
          type: 'upcoming_payment',
          title: `Payment due in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
          message: `${sale.customerName} owes ${formatPKR(inst.remaining)} on invoice ${sale.invoiceNumber}.`,
          severity: 'info',
          referenceType: 'sale',
          referenceId: sale._id,
          actionPath: '/installments',
          dedupeKey: `upcoming_payment:${sale._id}:${inst.number}:${todayKey()}`,
        });
        if (isNew) created.upcoming += 1;
      }
    }
  }

  if (settings.notification.overdueAlerts) {
    for (const [customerId, entry] of overdueByCustomer) {
      const isNew = await raise({
        type: 'installment_overdue',
        title: `Overdue - ${entry.name}`,
        message: `${entry.count} overdue installment${entry.count === 1 ? '' : 's'} totalling ${formatPKR(entry.total)}. Send a reminder or record a payment.`,
        severity: 'error',
        referenceType: 'customer',
        referenceId: customerId,
        actionPath: '/installments',
        dedupeKey: `installment_overdue:${customerId}:${todayKey()}`,
      });
      if (isNew) created.overdue += 1;
    }
  }

  return created;
};

/** Products at or below their reorder threshold, and those fully out. */
const checkStock = async (settings) => {
  if (!settings.notification.lowStockAlerts) return { low: 0, out: 0 };

  const products = await Product.find({ status: { $ne: 'archived' } })
    .select('name stock lowStockThreshold');

  const created = { low: 0, out: 0 };

  for (const product of products) {
    const threshold = product.lowStockThreshold || settings.product.lowStockThreshold;

    if (product.stock === 0) {
      const isNew = await raise({
        type: 'out_of_stock',
        title: `Out of stock - ${product.name}`,
        message: `${product.name} has no units left. Reorder before taking further sales.`,
        severity: 'error',
        referenceType: 'product',
        referenceId: product._id,
        actionPath: '/products',
        dedupeKey: `out_of_stock:${product._id}:${todayKey()}`,
      });
      if (isNew) created.out += 1;
    } else if (product.stock <= threshold) {
      const isNew = await raise({
        type: 'low_stock',
        title: `Low stock - ${product.name}`,
        message: `Only ${product.stock} unit${product.stock === 1 ? '' : 's'} left (threshold ${threshold}).`,
        severity: 'warning',
        referenceType: 'product',
        referenceId: product._id,
        actionPath: '/products',
        dedupeKey: `low_stock:${product._id}:${todayKey()}`,
      });
      if (isNew) created.low += 1;
    }
  }

  return created;
};

/** Suppliers we still owe money to. */
const checkSupplierPayables = async (settings) => {
  if (!settings.notification.supplierPayableAlerts) return 0;

  const suppliers = await Supplier.find({ payable: { $gt: 0 }, status: 'active' })
    .select('name payable');

  let count = 0;
  for (const supplier of suppliers) {
    const isNew = await raise({
      type: 'supplier_payable',
      title: `Payable to ${supplier.name}`,
      message: `${formatPKR(supplier.payable)} is outstanding to ${supplier.name}.`,
      severity: 'info',
      referenceType: 'supplier',
      referenceId: supplier._id,
      actionPath: '/suppliers',
      dedupeKey: `supplier_payable:${supplier._id}:${todayKey()}`,
    });
    if (isNew) count += 1;
  }
  return count;
};

/** Investors with profit earned but not yet paid out. */
const checkInvestorPayouts = async (settings) => {
  if (!settings.notification.investorPayoutAlerts) return 0;

  const investors = await Investor.find({ status: 'active', profitRemaining: { $gt: 0 } })
    .select('name profitRemaining');

  let count = 0;
  for (const investor of investors) {
    const isNew = await raise({
      type: 'investor_payout_due',
      title: `Payout due - ${investor.name}`,
      message: `${formatPKR(investor.profitRemaining)} of profit is pending payout to ${investor.name}.`,
      severity: 'info',
      referenceType: 'investor',
      referenceId: investor._id,
      actionPath: '/investors',
      dedupeKey: `investor_payout_due:${investor._id}:${todayKey()}`,
    });
    if (isNew) count += 1;
  }
  return count;
};

/**
 * Zakat reminder once the hawl (lunar year) is complete or close to it.
 * Raised at most once a week so it informs rather than nags.
 */
const checkZakat = async (settings) => {
  if (!settings.notification.zakatReminder) return 0;

  const zakatSettings = await ZakatSettings.getSingleton();
  if (!zakatSettings.hawlStartDate) return 0;

  const progress = calculateHawlProgress(zakatSettings.hawlStartDate);
  if (progress.daysRemaining > 14) return 0;

  // Week-granular dedupe key: one reminder per ISO week, not per day.
  const weekKey = `${new Date().getFullYear()}-W${Math.ceil(daysBetween(new Date(new Date().getFullYear(), 0, 1), new Date()) / 7)}`;

  const isNew = await raise({
    type: 'zakat_due',
    title: progress.isComplete ? 'Zakat is now due' : `Zakat due in ${progress.daysRemaining} days`,
    message: progress.isComplete
      ? 'A full lunar year (hawl) has passed. Run the Zakat calculation for the owner and each partner.'
      : `The hawl completes on ${progress.dueDate.toLocaleDateString('en-GB')}. Review your stock, receivables and cash before then.`,
    severity: progress.isComplete ? 'warning' : 'info',
    referenceType: 'zakat',
    referenceId: null,
    actionPath: '/zakat',
    dedupeKey: `zakat_due:${weekKey}`,
  });

  return isNew ? 1 : 0;
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Run every check and report what was raised.
 * Safe to call repeatedly - de-duplication makes it idempotent for the day.
 *
 * @returns {Promise<object>} Counts per category, for the admin's "last sweep" panel.
 */
export const runNotificationSweep = async () => {
  const settings = await Settings.getSingleton();

  if (!settings.notification.enabled) {
    return { skipped: true, reason: 'Notifications are disabled in Settings.' };
  }

  // Bring installment statuses in line with today's date first, so the checks
  // below classify each row correctly.
  const statusRefresh = await refreshInstallmentStatuses();

  const [installments, stock, supplierPayables, investorPayouts, zakat] = await Promise.all([
    checkInstallments(settings),
    checkStock(settings),
    checkSupplierPayables(settings),
    checkInvestorPayouts(settings),
    checkZakat(settings),
  ]);

  return {
    skipped: false,
    ranAt: new Date(),
    statusRefresh,
    created: {
      installmentsDue: installments.due,
      installmentsOverdue: installments.overdue,
      upcomingPayments: installments.upcoming,
      lowStock: stock.low,
      outOfStock: stock.out,
      supplierPayables,
      investorPayouts,
      zakat,
    },
  };
};

/**
 * Remove read notifications older than `days`.
 * Keeps the collection from growing without bound; unread alerts are never
 * purged because they still need someone's attention.
 */
export const pruneOldNotifications = async (days = 30) => {
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const result = await Notification.deleteMany({
    isRead: true,
    createdAt: { $lt: cutoff },
  });
  return result.deletedCount;
};
