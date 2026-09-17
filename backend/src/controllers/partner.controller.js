/**
 * ============================================
 * Partner Controller
 * ============================================
 */

import Partner from '../models/Partner.js';
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';
import LedgerEntry from '../models/LedgerEntry.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError } from '../utils/AppError.js';
import { logAudit } from '../middleware/audit.js';
import { calculateOwnershipShare } from '../utils/financialEngine.js';

export const getPartners = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search = '', status } = req.query;
  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { cnic: { $regex: search, $options: 'i' } },
    ];
  }
  if (status) query.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [partners, total] = await Promise.all([
    Partner.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
    Partner.countDocuments(query),
  ]);

  return sendSuccess(res, {
    partners,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) },
  });
});

export const getPartner = asyncHandler(async (req, res) => {
  const partner = await Partner.findById(req.params.id);
  if (!partner) throw new NotFoundError('Partner');

  // Get partner-specific data
  const [products, sales, ledger] = await Promise.all([
    Product.find({ partner: partner._id }).populate('category', 'name'),
    Sale.find({ partner: partner._id }).sort({ saleDate: -1 }).limit(10),
    LedgerEntry.find({ entityType: 'partner', entityId: partner._id }).sort({ entryDate: -1 }).limit(20),
  ]);

  const stockValue = products.reduce((sum, p) => sum + p.purchasePrice * p.stock, 0);

  return sendSuccess(res, {
    partner,
    products,
    recentSales: sales,
    ledger,
    stockValue,
  });
});

export const createPartner = asyncHandler(async (req, res) => {
  const partner = await Partner.create(req.body);
  await logAudit({ req, module: 'partners', action: 'create', recordId: partner._id.toString(), after: partner.toObject() });
  return sendSuccess(res, { partner }, 201, 'Partner created successfully.');
});

export const updatePartner = asyncHandler(async (req, res) => {
  const partner = await Partner.findById(req.params.id);
  if (!partner) throw new NotFoundError('Partner');
  const before = partner.toObject();
  Object.assign(partner, req.body);
  await partner.save();
  await logAudit({ req, module: 'partners', action: 'update', recordId: partner._id.toString(), before, after: partner.toObject() });
  return sendSuccess(res, { partner }, 200, 'Partner updated successfully.');
});

export const deletePartner = asyncHandler(async (req, res) => {
  const partner = await Partner.findById(req.params.id);
  if (!partner) throw new NotFoundError('Partner');

  // Check linked products
  const productCount = await Product.countDocuments({ partner: partner._id });
  if (productCount > 0) {
    partner.status = 'inactive';
    await partner.save();
    return sendSuccess(res, null, 200, `Partner deactivated (${productCount} products linked).`);
  }

  await Partner.findByIdAndDelete(req.params.id);
  await logAudit({ req, module: 'partners', action: 'delete', recordId: req.params.id, before: partner.toObject() });
  return sendSuccess(res, null, 200, 'Partner deleted successfully.');
});

/**
 * GET /api/partners/:id/dashboard
 * Partner-specific dashboard with ownership-calculated values.
 */
export const getPartnerDashboard = asyncHandler(async (req, res) => {
  const partner = await Partner.findById(req.params.id);
  if (!partner) throw new NotFoundError('Partner');

  const products = await Product.find({ partner: partner._id });
  const sales = await Sale.find({ partner: partner._id });

  const stockValue = products.reduce((sum, p) => sum + p.purchasePrice * p.stock, 0);
  const totalSales = sales.reduce((sum, s) => sum + s.grandTotal, 0);
  const totalCollection = sales.reduce((sum, s) => sum + (s.grandTotal - s.remainingBalance), 0);
  const totalReceivable = sales.reduce((sum, s) => sum + s.remainingBalance, 0);

  // Calculate partner's share of each sale
  const partnerShare = partner.ownershipPercent / 100;
  const partnerStockValue = calculateOwnershipShare(stockValue, 'partner', partner.ownershipPercent).partnerAmount;
  const partnerSales = calculateOwnershipShare(totalSales, 'partner', partner.ownershipPercent).partnerAmount;
  const partnerCollection = calculateOwnershipShare(totalCollection, 'partner', partner.ownershipPercent).partnerAmount;
  const partnerReceivable = calculateOwnershipShare(totalReceivable, 'partner', partner.ownershipPercent).partnerAmount;

  return sendSuccess(res, {
    partner,
    dashboard: {
      stockValue,
      partnerStockValue,
      totalSales,
      partnerSales,
      totalCollection,
      partnerCollection,
      totalReceivable,
      partnerReceivable,
      totalProducts: products.length,
      totalSalesCount: sales.length,
    },
  });
});
