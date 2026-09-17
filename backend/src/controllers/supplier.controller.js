/**
 * ============================================
 * Supplier Controller
 * ============================================
 */

import Supplier from '../models/Supplier.js';
import Purchase from '../models/Purchase.js';
import LedgerEntry from '../models/LedgerEntry.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError } from '../utils/AppError.js';
import { logAudit } from '../middleware/audit.js';

export const getSuppliers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search = '', status } = req.query;
  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { contactPerson: { $regex: search, $options: 'i' } },
    ];
  }
  if (status) query.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [suppliers, total] = await Promise.all([
    Supplier.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
    Supplier.countDocuments(query),
  ]);

  return sendSuccess(res, {
    suppliers,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) },
  });
});

export const getSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) throw new NotFoundError('Supplier');

  const [purchases, ledger] = await Promise.all([
    Purchase.find({ supplier: supplier._id }).sort({ purchaseDate: -1 }).limit(10),
    LedgerEntry.find({ entityType: 'supplier', entityId: supplier._id }).sort({ entryDate: -1 }).limit(20),
  ]);

  return sendSuccess(res, { supplier, recentPurchases: purchases, ledger });
});

export const createSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.create(req.body);
  await logAudit({ req, module: 'suppliers', action: 'create', recordId: supplier._id.toString(), after: supplier.toObject() });
  return sendSuccess(res, { supplier }, 201, 'Supplier created successfully.');
});

export const updateSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) throw new NotFoundError('Supplier');
  const before = supplier.toObject();
  Object.assign(supplier, req.body);
  await supplier.save();
  await logAudit({ req, module: 'suppliers', action: 'update', recordId: supplier._id.toString(), before, after: supplier.toObject() });
  return sendSuccess(res, { supplier }, 200, 'Supplier updated successfully.');
});

export const deleteSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) throw new NotFoundError('Supplier');

  const purchaseCount = await Purchase.countDocuments({ supplier: supplier._id });
  if (purchaseCount > 0) {
    supplier.status = 'inactive';
    await supplier.save();
    return sendSuccess(res, null, 200, `Supplier deactivated (${purchaseCount} purchases linked).`);
  }

  await Supplier.findByIdAndDelete(req.params.id);
  await logAudit({ req, module: 'suppliers', action: 'delete', recordId: req.params.id, before: supplier.toObject() });
  return sendSuccess(res, null, 200, 'Supplier deleted successfully.');
});
