/**
 * ============================================
 * Data Management Controller
 * ============================================
 * Backs Settings > Data Management: backup, restore, integrity repair and the
 * destructive reset. Admin-only, and every action is written to the audit log.
 *
 * Safety posture
 * --------------
 * These endpoints can destroy a business's records, so each destructive action
 * requires the caller to type an exact confirmation phrase in the request body.
 * A stray click, a replayed request or a mistyped URL cannot wipe the database.
 */

import mongoose from 'mongoose';

import User from '../models/User.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import Sale from '../models/Sale.js';
import Payment from '../models/Payment.js';
import Purchase from '../models/Purchase.js';
import Expense from '../models/Expense.js';
import Return from '../models/Return.js';
import Partner from '../models/Partner.js';
import Investor from '../models/Investor.js';
import Investment from '../models/Investment.js';
import InvestorPayout from '../models/InvestorPayout.js';
import Agreement from '../models/Agreement.js';
import Reminder from '../models/Reminder.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import LedgerEntry from '../models/LedgerEntry.js';
import StockMovement from '../models/StockMovement.js';
import Settings from '../models/Settings.js';
import BusinessProfile from '../models/BusinessProfile.js';
import DocumentTemplate from '../models/DocumentTemplate.js';
import CustomField from '../models/CustomField.js';
import { ZakatSettings, ZakatCalculation } from '../models/Zakat.js';

import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { BadRequestError } from '../utils/AppError.js';
import { logAudit } from '../middleware/audit.js';
import { refreshInstallmentStatuses, recalculateCustomerTotals } from '../services/financial.service.js';
import { pruneOldNotifications } from '../services/notification.service.js';

/**
 * Every collection the backup covers, in dependency order.
 *
 * Order matters on restore: a Sale references a Customer, so customers must be
 * written first or the resulting data would reference ids that do not exist yet.
 */
const COLLECTIONS = [
  { key: 'businessProfile', model: BusinessProfile, label: 'Business Profile' },
  { key: 'settings', model: Settings, label: 'Settings' },
  { key: 'zakatSettings', model: ZakatSettings, label: 'Zakat Settings' },
  { key: 'documentTemplates', model: DocumentTemplate, label: 'Document Templates' },
  { key: 'customFields', model: CustomField, label: 'Custom Fields' },
  { key: 'users', model: User, label: 'Users' },
  { key: 'categories', model: Category, label: 'Categories' },
  { key: 'partners', model: Partner, label: 'Partners' },
  { key: 'suppliers', model: Supplier, label: 'Suppliers' },
  { key: 'customers', model: Customer, label: 'Customers' },
  { key: 'investors', model: Investor, label: 'Investors' },
  { key: 'products', model: Product, label: 'Products' },
  { key: 'purchases', model: Purchase, label: 'Purchases' },
  { key: 'sales', model: Sale, label: 'Sales' },
  { key: 'payments', model: Payment, label: 'Payments' },
  { key: 'returns', model: Return, label: 'Returns' },
  { key: 'expenses', model: Expense, label: 'Expenses' },
  { key: 'investments', model: Investment, label: 'Investments' },
  { key: 'investorPayouts', model: InvestorPayout, label: 'Investor Payouts' },
  { key: 'agreements', model: Agreement, label: 'Agreements' },
  { key: 'zakatCalculations', model: ZakatCalculation, label: 'Zakat Calculations' },
  { key: 'ledgerEntries', model: LedgerEntry, label: 'Ledger Entries' },
  { key: 'stockMovements', model: StockMovement, label: 'Stock Movements' },
  { key: 'reminders', model: Reminder, label: 'Reminders' },
];

/** Transient collections - regenerated automatically, never worth restoring. */
const TRANSIENT = [
  { key: 'notifications', model: Notification, label: 'Notifications' },
  { key: 'auditLogs', model: AuditLog, label: 'Audit Logs' },
];

/**
 * GET /api/data/stats
 * Row counts per collection, plus database size where the driver exposes it.
 */
export const getDataStats = asyncHandler(async (req, res) => {
  const all = [...COLLECTIONS, ...TRANSIENT];

  const counts = await Promise.all(
    all.map(async ({ key, model, label }) => ({
      key,
      label,
      count: await model.estimatedDocumentCount(),
    }))
  );

  // `dbStats` is unavailable on some hosted tiers; degrade rather than fail.
  let dbSize = null;
  try {
    const stats = await mongoose.connection.db.stats();
    dbSize = {
      dataSizeMB: Math.round((stats.dataSize / 1048576) * 100) / 100,
      storageSizeMB: Math.round((stats.storageSize / 1048576) * 100) / 100,
      indexSizeMB: Math.round((stats.indexSize / 1048576) * 100) / 100,
      collections: stats.collections,
    };
  } catch {
    dbSize = null;
  }

  return sendSuccess(res, {
    collections: counts,
    totalRecords: counts.reduce((sum, c) => sum + c.count, 0),
    database: {
      name: mongoose.connection.name,
      host: mongoose.connection.host,
      readyState: mongoose.connection.readyState,
      ...dbSize,
    },
  });
});

/**
 * GET /api/data/backup
 * Download a complete JSON backup.
 *
 * Password hashes are stripped: a backup file is routinely copied to a laptop
 * or a phone, and it must not carry credential material with it. Restored users
 * therefore need their passwords reset, which is the correct trade-off.
 */
export const exportBackup = asyncHandler(async (req, res) => {
  const includeTransient = req.query.includeLogs === 'true';
  const sets = includeTransient ? [...COLLECTIONS, ...TRANSIENT] : COLLECTIONS;

  const data = {};
  for (const { key, model } of sets) {
    const docs = await model.find().lean();

    data[key] =
      key === 'users'
        ? docs.map(({ password, refreshTokens, ...safe }) => safe)
        : docs;
  }

  const backup = {
    meta: {
      application: 'ADEENA TRADERS',
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      exportedBy: req.user.name,
      database: mongoose.connection.name,
      includesLogs: includeTransient,
      note: 'User passwords are excluded from backups. Restored users must have their passwords reset by an administrator.',
      recordCounts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])),
    },
    data,
  };

  await logAudit({
    req,
    module: 'settings',
    action: 'update',
    recordId: 'backup',
    reason: 'Exported a full data backup',
  });

  const filename = `adeena-traders-backup-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(JSON.stringify(backup, null, 2));
});

/**
 * POST /api/data/restore
 * Restore from a backup produced by {@link exportBackup}.
 *
 * Body: { backup, mode: 'merge' | 'replace', confirm }
 *
 *   merge   - insert records whose _id is not already present (safe default)
 *   replace - wipe each collection first, then insert (requires confirmation)
 */
export const importBackup = asyncHandler(async (req, res) => {
  const { backup, mode = 'merge', confirm } = req.body;

  if (!backup?.data) {
    throw new BadRequestError('That file is not a valid ADEENA TRADERS backup.');
  }
  if (mode === 'replace' && confirm !== 'REPLACE ALL DATA') {
    throw new BadRequestError(
      'Replacing all data is irreversible. Send confirm: "REPLACE ALL DATA" to proceed.'
    );
  }

  const report = [];

  for (const { key, model, label } of COLLECTIONS) {
    const records = backup.data[key];
    if (!Array.isArray(records) || records.length === 0) continue;

    if (mode === 'replace') {
      await model.deleteMany({});
    }

    let inserted = 0;
    let skipped = 0;

    for (const record of records) {
      try {
        const exists = record._id ? await model.exists({ _id: record._id }) : null;
        if (exists) {
          skipped += 1;
          continue;
        }
        // validateBeforeSave stays on: a corrupt backup should surface as a
        // skipped row, not as silently invalid data in a live system.
        await model.create(record);
        inserted += 1;
      } catch {
        skipped += 1;
      }
    }

    report.push({ collection: label, inserted, skipped, total: records.length });
  }

  await logAudit({
    req,
    module: 'settings',
    action: 'update',
    recordId: 'restore',
    after: { mode, report },
    reason: `Restored data from backup (${mode} mode)`,
  });

  return sendSuccess(
    res,
    { report, mode },
    200,
    'Restore complete. Users restored from a backup need their passwords reset before they can sign in.'
  );
});

/**
 * POST /api/data/repair
 * Recompute cached aggregates from the source transactions.
 *
 * Customer totals and installment statuses are caches. A reversal, a manual
 * edit or an interrupted write can leave them out of step with the underlying
 * records; this rebuilds them without touching the transactions themselves.
 */
export const repairData = asyncHandler(async (req, res) => {
  const statusRefresh = await refreshInstallmentStatuses();

  const customers = await Customer.find().select('_id');
  let repaired = 0;
  const failures = [];

  for (const customer of customers) {
    try {
      await recalculateCustomerTotals(customer._id);
      repaired += 1;
    } catch (error) {
      failures.push({ customerId: customer._id, message: error.message });
    }
  }

  const prunedNotifications = await pruneOldNotifications(30);

  await logAudit({
    req,
    module: 'settings',
    action: 'update',
    recordId: 'repair',
    after: { statusRefresh, repaired, prunedNotifications },
    reason: 'Ran the data integrity repair',
  });

  return sendSuccess(
    res,
    {
      installmentStatuses: statusRefresh,
      customersRepaired: repaired,
      failures,
      prunedNotifications,
    },
    200,
    `Repair complete. ${repaired} customer balance(s) recalculated.`
  );
});

/**
 * DELETE /api/data/transactions
 * Clear transactional history while keeping the master data (products,
 * customers, users, settings).
 *
 * This is what a shop actually wants at the end of a trial period: keep the
 * catalogue and the customer list, discard the practice invoices.
 *
 * Body: { confirm: 'CLEAR TRANSACTIONS' }
 */
export const clearTransactions = asyncHandler(async (req, res) => {
  if (req.body?.confirm !== 'CLEAR TRANSACTIONS') {
    throw new BadRequestError(
      'This permanently deletes all sales, payments, purchases and expenses. Send confirm: "CLEAR TRANSACTIONS" to proceed.'
    );
  }

  const targets = [
    { model: Sale, label: 'Sales' },
    { model: Payment, label: 'Payments' },
    { model: Purchase, label: 'Purchases' },
    { model: Return, label: 'Returns' },
    { model: Expense, label: 'Expenses' },
    { model: LedgerEntry, label: 'Ledger Entries' },
    { model: StockMovement, label: 'Stock Movements' },
    { model: Agreement, label: 'Agreements' },
    { model: Reminder, label: 'Reminders' },
    { model: InvestorPayout, label: 'Investor Payouts' },
    { model: ZakatCalculation, label: 'Zakat Calculations' },
    { model: Notification, label: 'Notifications' },
  ];

  const report = [];
  for (const { model, label } of targets) {
    const { deletedCount } = await model.deleteMany({});
    report.push({ collection: label, deleted: deletedCount });
  }

  // Reset the running balances those transactions produced, or the customer
  // cards would keep showing money owed against invoices that no longer exist.
  await Customer.updateMany({}, {
    $set: { totalSales: 0, totalPaid: 0, outstanding: 0, overdue: 0, nextDueDate: null },
  });
  await Supplier.updateMany({}, { $set: { totalPurchases: 0, totalPaid: 0, payable: 0 } });
  await Investor.updateMany({}, { $set: { profitEarned: 0, profitPaid: 0, profitRemaining: 0 } });
  await Partner.updateMany({}, {
    $set: { totalSales: 0, totalCollection: 0, totalReceivable: 0, totalProfit: 0, totalOverdue: 0 },
  });

  await logAudit({
    req,
    module: 'settings',
    action: 'delete',
    recordId: 'clear-transactions',
    after: { report },
    reason: 'Cleared all transactional data',
  });

  return sendSuccess(res, { report }, 200, 'Transactional data cleared. Master data was kept.');
});

/**
 * DELETE /api/data/all
 * Wipe everything except the signed-in administrator's own account.
 *
 * Body: { confirm: 'DELETE EVERYTHING', password }
 *
 * Requires the admin's current password: a hijacked session should not be able
 * to destroy the business by replaying a single request.
 */
export const clearAllData = asyncHandler(async (req, res) => {
  const { confirm, password } = req.body || {};

  if (confirm !== 'DELETE EVERYTHING') {
    throw new BadRequestError(
      'This erases the entire database. Send confirm: "DELETE EVERYTHING" to proceed.'
    );
  }
  if (!password) {
    throw new BadRequestError('Enter your password to confirm this action.');
  }

  const admin = await User.findById(req.user.id).select('+password');
  if (!admin || !(await admin.comparePassword(password))) {
    throw new BadRequestError('That password is incorrect. Nothing has been deleted.');
  }

  const report = [];
  for (const { model, label } of [...COLLECTIONS, ...TRANSIENT]) {
    // Keep the acting administrator so the system stays reachable afterwards
    const filter = model === User ? { _id: { $ne: admin._id } } : {};
    const { deletedCount } = await model.deleteMany(filter);
    report.push({ collection: label, deleted: deletedCount });
  }

  await logAudit({
    req,
    module: 'settings',
    action: 'delete',
    recordId: 'clear-all',
    after: { report },
    reason: 'Erased all business data',
  });

  return sendSuccess(
    res,
    { report },
    200,
    'All data erased. Your administrator account was kept so you can set the system up again.'
  );
});
