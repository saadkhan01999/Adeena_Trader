/**
 * ============================================
 * Purchase Controller
 * ============================================
 */

import mongoose from 'mongoose';
import Purchase from '../models/Purchase.js';
import { containsText } from '../utils/regex.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError } from '../utils/AppError.js';
import { logAudit } from '../middleware/audit.js';
import { createPurchaseWithStock } from '../services/financial.service.js';
import { cancelPurchase as cancelPurchaseRecord, deletePurchase as deletePurchaseRecord } from '../services/reversal.service.js';

export const getPurchases = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search = '', sourceType, supplierId, sortBy = 'purchaseDate', sortOrder = 'desc' } = req.query;
  const query = {};
  if (search) {
    query.$or = [
      { invoiceNumber: containsText(search) },
      { supplierName: containsText(search) },
      { sourceName: containsText(search) },
    ];
  }
  if (sourceType && sourceType !== 'all') query.sourceType = sourceType;
  // Cast here: the summary below is an aggregate, which does not cast strings.
  if (supplierId && mongoose.isValidObjectId(supplierId)) query.supplier = new mongoose.Types.ObjectId(supplierId);
  // The owner / partner lens: each side sees its own and the shared records.
  if (req.query.ownership && req.query.ownership !== 'all') {
    query.ownership = { $in: [req.query.ownership, 'shared'] };
  }

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(Math.max(1, parseInt(limit, 10) || 20), 500);
  const skip = (pageNumber - 1) * pageSize;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [purchases, total, totals] = await Promise.all([
    Purchase.find(query).populate('supplier', 'name phone').populate('items.product', 'name')
      .sort(sort).skip(skip).limit(pageSize),
    Purchase.countDocuments(query),
    // Summary cards: every purchase matching the filters, cancelled ones aside.
    Purchase.aggregate([
      { $match: { ...query, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, count: { $sum: 1 }, value: { $sum: '$subtotal' }, paid: { $sum: '$paid' }, payable: { $sum: '$payable' } } },
    ]),
  ]);

  return sendSuccess(res, {
    purchases,
    summary: totals[0] ? { ...totals[0], _id: undefined } : { count: 0, value: 0, paid: 0, payable: 0 },
    pagination: { page: pageNumber, limit: pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
});

export const getPurchase = asyncHandler(async (req, res) => {
  const purchase = await Purchase.findById(req.params.id).populate('supplier').populate('items.product').populate('partner', 'name');
  if (!purchase) throw new NotFoundError('Purchase');
  return sendSuccess(res, { purchase });
});

export const createPurchase = asyncHandler(async (req, res) => {
  const purchase = await createPurchaseWithStock(req.body, req.user);
  await logAudit({ req, module: 'purchases', action: 'create', recordId: purchase._id.toString(), after: purchase.toObject() });
  return sendSuccess(res, { purchase }, 201, 'Purchase recorded successfully.');
});

// ============================================================================
// Reversal
// ============================================================================

/** Cancel a purchase: stock comes back off the shelf, the supplier balance is corrected. */
export const cancelPurchase = asyncHandler(async (req, res) => {
  const purchase = await cancelPurchaseRecord(req.params.id, req.user, req.body?.reason || '');

  await logAudit({
    req, module: 'purchases', action: 'reverse', recordId: req.params.id,
    after: purchase.toObject(), reason: req.body?.reason || 'Purchase cancelled',
  });

  return sendSuccess(res, { purchase }, 200, `Purchase ${purchase.invoiceNumber || ''} cancelled and reversed.`);
});

/** Permanently remove a purchase and its trail. Admin only - see the route. */
export const removePurchase = asyncHandler(async (req, res) => {
  const before = await Purchase.findById(req.params.id);
  const { purchaseNumber } = await deletePurchaseRecord(req.params.id, req.user);

  await logAudit({
    req, module: 'purchases', action: 'delete', recordId: req.params.id,
    before: before?.toObject(), reason: req.body?.reason || 'Purchase deleted by admin',
  });

  return sendSuccess(res, null, 200, `Purchase ${purchaseNumber} deleted and fully reversed.`);
});
