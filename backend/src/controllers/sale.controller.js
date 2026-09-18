/**
 * ============================================
 * Sales Controller
 * ============================================
 * Creating, listing and inspecting sales, plus the installment worklist that
 * drives the Installments screen.
 */

import Sale from '../models/Sale.js';
import Agreement from '../models/Agreement.js';
import BusinessProfile from '../models/BusinessProfile.js';
import Settings from '../models/Settings.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError } from '../utils/AppError.js';
import { logAudit } from '../middleware/audit.js';
import { createSaleWithRelations, refreshInstallmentStatuses } from '../services/financial.service.js';
import { createInstallmentAgreement } from '../services/agreement.service.js';
import { parseNumber, daysBetween } from '../utils/financialEngine.js';
import { DOCUMENT_TYPES } from '../constants/index.js';
import { cancelSale as cancelSaleRecord, deleteSale as deleteSaleRecord } from '../services/reversal.service.js';

/** Escape user input before it becomes part of a regular expression. */
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * GET /api/sales
 * Filterable, paginated list with summary totals for the tiles above the table.
 */
export const getSales = asyncHandler(async (req, res) => {
  const {
    page = 1, limit = 20, search = '', saleType, status, ownership,
    customerId, sortBy = 'saleDate', sortOrder = 'desc', startDate, endDate,
  } = req.query;

  const query = {};

  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    query.$or = [
      { invoiceNumber: rx },
      { customerName: rx },
      { customerPhone: rx },
      { customerCnic: rx },
      { 'items.productName': rx },
    ];
  }
  if (saleType) query.saleType = saleType;
  if (status) query.status = status;
  if (ownership && ownership !== 'all') query.ownership = { $in: [ownership, 'shared'] };
  if (customerId) query.customer = customerId;

  if (startDate || endDate) {
    query.saleDate = {};
    if (startDate) query.saleDate.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include the whole end day
      query.saleDate.$lte = end;
    }
  }

  const skip = (Number(page) - 1) * Number(limit);
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [sales, total, totals] = await Promise.all([
    Sale.find(query)
      .populate('customer', 'name mobile1 cnic')
      .populate('items.product', 'name brand model')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit)),
    Sale.countDocuments(query),
    // Totals across the whole filtered set, not just this page
    Sale.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalValue: { $sum: '$grandTotal' },
          totalAdvance: { $sum: '$advance' },
          totalOutstanding: { $sum: '$remainingBalance' },
          cashCount: { $sum: { $cond: [{ $eq: ['$saleType', 'cash'] }, 1, 0] } },
          installmentCount: { $sum: { $cond: [{ $eq: ['$saleType', 'installment'] }, 1, 0] } },
        },
      },
    ]),
  ]);

  return sendSuccess(res, {
    sales,
    summary: totals[0] || {
      totalValue: 0, totalAdvance: 0, totalOutstanding: 0,
      cashCount: 0, installmentCount: 0,
    },
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
      hasNext: skip + sales.length < total,
    },
  });
});

/**
 * GET /api/sales/:id
 * Full sale plus the business profile and any agreement, so the invoice view
 * can render everything from one response.
 */
export const getSale = asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id)
    .populate('customer')
    .populate('items.product')
    .populate('partner', 'name ownershipPercent');

  if (!sale) throw new NotFoundError('Sale');

  const [business, agreement] = await Promise.all([
    BusinessProfile.getSingleton(),
    Agreement.findOne({ sale: sale._id, status: { $ne: 'cancelled' } }),
  ]);

  return sendSuccess(res, { sale, business, agreement });
});

/**
 * POST /api/sales
 *
 * When the business has `autoGenerateAgreement` enabled, an installment sale
 * also issues its agreement here. Failure to issue it is logged but does not
 * fail the sale: the money has changed hands and the stock has moved, so the
 * sale must stand. The agreement can be issued afterwards from the Sales screen.
 */
export const createSale = asyncHandler(async (req, res) => {
  const sale = await createSaleWithRelations(req.body, req.user);
  const settings = await Settings.getSingleton();

  let agreement = null;
  if (sale.saleType === 'installment' && settings.installment.autoGenerateAgreement) {
    try {
      agreement = await createInstallmentAgreement(sale._id, req.user);
    } catch (error) {
      console.error('[SALES] Could not auto-issue the installment agreement:', error.message);
    }
  }

  await logAudit({
    req,
    module: 'sales',
    action: 'sale',
    recordId: sale._id.toString(),
    after: sale.toObject(),
    reason: `${sale.saleType} sale to ${sale.customerName}`,
  });

  return sendSuccess(
    res,
    { sale, agreement },
    201,
    `Sale recorded. Invoice ${sale.invoiceNumber}.`
  );
});

/**
 * POST /api/sales/:id/agreement
 * Issue (or fetch) the installment agreement for a sale.
 */
export const issueAgreement = asyncHandler(async (req, res) => {
  const agreement = await createInstallmentAgreement(req.params.id, req.user);
  return sendSuccess(res, { agreement }, 201, `Agreement ${agreement.agreementNumber} ready.`);
});

/**
 * GET /api/sales/overdue/list
 * The installment worklist, bucketed into overdue / due today / upcoming.
 *
 * Statuses are refreshed against today's date first, so a row that quietly
 * became overdue overnight is classified correctly rather than still reading
 * "upcoming".
 *
 * Query: ownership, customerId, search
 */
export const getOverdueInstallments = asyncHandler(async (req, res) => {
  await refreshInstallmentStatuses();

  const { ownership, customerId, search = '' } = req.query;
  const settings = await Settings.getSingleton();

  const query = { saleType: 'installment', status: { $in: ['ongoing', 'overdue'] } };
  if (ownership && ownership !== 'all') query.ownership = { $in: [ownership, 'shared'] };
  if (customerId) query.customer = customerId;
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    query.$or = [{ invoiceNumber: rx }, { customerName: rx }, { customerPhone: rx }];
  }

  const sales = await Sale.find(query)
    .populate('customer', 'name mobile1 cnic address')
    .sort({ saleDate: 1 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = settings.notification.upcomingDueDays;

  const overdue = [];
  const dueToday = [];
  const upcoming = [];
  const later = [];

  for (const sale of sales) {
    for (const inst of sale.installments) {
      if (inst.status === 'paid' || inst.remaining <= 0) continue;

      const daysUntil = daysBetween(today, inst.dueDate);

      const item = {
        saleId: sale._id,
        invoiceNumber: sale.invoiceNumber,
        customer: sale.customer,
        customerName: sale.customerName,
        customerPhone: sale.customerPhone || sale.customer?.mobile1 || '',
        installmentNumber: inst.number,
        totalInstallments: sale.installmentPlan,
        dueDate: inst.dueDate,
        expected: inst.expected,
        paid: inst.paid,
        remaining: inst.remaining,
        status: inst.status,
        saleBalance: sale.remainingBalance,
        productName: sale.items.map((i) => i.productName).join(', ') || '-',
        daysOverdue: daysUntil < 0 ? Math.abs(daysUntil) : 0,
        daysUntilDue: daysUntil > 0 ? daysUntil : 0,
      };

      if (daysUntil < 0) overdue.push(item);
      else if (daysUntil === 0) dueToday.push(item);
      else if (daysUntil <= horizon) upcoming.push(item);
      else later.push(item);
    }
  }

  // Most urgent first within each bucket
  overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
  upcoming.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  later.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  const sum = (rows) => rows.reduce((s, r) => s + parseNumber(r.remaining), 0);

  return sendSuccess(res, {
    overdue,
    dueToday,
    upcoming,
    later,
    summary: {
      overdueAmount: sum(overdue),
      dueTodayAmount: sum(dueToday),
      upcomingAmount: sum(upcoming),
      laterAmount: sum(later),
      overdueCount: overdue.length,
      dueTodayCount: dueToday.length,
      upcomingCount: upcoming.length,
      laterCount: later.length,
      // Customers behind, not installments - one person may owe several
      affectedCustomers: new Set(overdue.map((i) => String(i.customer?._id || i.customer))).size,
    },
  });
});

// ============================================================================
// Reversal
// ============================================================================

/**
 * Cancel a sale: stock goes back, balances are corrected, the invoice stays in
 * history marked cancelled. Refused while payments are still attached to it.
 */
export const cancelSale = asyncHandler(async (req, res) => {
  const sale = await cancelSaleRecord(req.params.id, req.user, req.body?.reason || '');

  await logAudit({
    req, module: 'sales', action: 'reverse', recordId: req.params.id,
    after: sale.toObject(), reason: req.body?.reason || 'Sale cancelled',
  });

  return sendSuccess(res, { sale }, 200, `Sale ${sale.invoiceNumber} cancelled and reversed.`);
});

/** Permanently remove a sale and its trail. Admin only - see the route. */
export const removeSale = asyncHandler(async (req, res) => {
  const before = await Sale.findById(req.params.id);
  const { invoiceNumber } = await deleteSaleRecord(req.params.id, req.user);

  await logAudit({
    req, module: 'sales', action: 'delete', recordId: req.params.id,
    before: before?.toObject(), reason: req.body?.reason || 'Sale deleted by admin',
  });

  return sendSuccess(res, null, 200, `Sale ${invoiceNumber} deleted and fully reversed.`);
});
