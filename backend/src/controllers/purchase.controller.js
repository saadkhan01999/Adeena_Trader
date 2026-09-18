/**
 * ============================================
 * Purchase Controller
 * ============================================
 */

import Purchase from '../models/Purchase.js';
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
      { invoiceNumber: { $regex: search, $options: 'i' } },
      { supplierName: { $regex: search, $options: 'i' } },
      { sourceName: { $regex: search, $options: 'i' } },
    ];
  }
  if (sourceType) query.sourceType = sourceType;
  if (supplierId) query.supplier = supplierId;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [purchases, total] = await Promise.all([
    Purchase.find(query).populate('supplier', 'name phone').populate('items.product', 'name')
      .sort(sort).skip(skip).limit(parseInt(limit)),
    Purchase.countDocuments(query),
  ]);

  return sendSuccess(res, {
    purchases,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) },
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

  return sendSuccess(res, { purchase }, 200, `Purchase ${purchase.purchaseNumber} cancelled and reversed.`);
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
