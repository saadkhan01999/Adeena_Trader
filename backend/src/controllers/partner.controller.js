/**
 * ============================================
 * Partner Controller
 * ============================================
 */

import Partner from '../models/Partner.js';
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';
import LedgerEntry from '../models/LedgerEntry.js';
import { containsText } from '../utils/regex.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import {
  NotFoundError, LinkedRecordsError, describeLinks, summariseLinks, isForced,
} from '../utils/AppError.js';
import Purchase from '../models/Purchase.js';
import Expense from '../models/Expense.js';
import Agreement from '../models/Agreement.js';
import { logAudit } from '../middleware/audit.js';
import { calculateOwnershipShare } from '../utils/financialEngine.js';

export const getPartners = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search = '', status } = req.query;
  const query = {};
  if (search) {
    query.$or = [
      { name: containsText(search) },
      { phone: containsText(search) },
      { cnic: containsText(search) },
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

/**
 * DELETE /api/partners/:id[?force=true]
 *
 * Items, sales, purchases and expenses tagged to the partner are KEPT when the
 * partner is deleted - they are the shop's stock and money - and simply stop
 * pointing at the partner. The partnership agreement goes with the partner.
 */
export const deletePartner = asyncHandler(async (req, res) => {
  const partner = await Partner.findById(req.params.id);
  if (!partner) throw new NotFoundError('Partner');

  const [items, sales, purchases, expenses, agreements] = await Promise.all([
    Product.countDocuments({ partner: partner._id }),
    Sale.countDocuments({ partner: partner._id }),
    Purchase.countDocuments({ partner: partner._id }),
    Expense.countDocuments({ partner: partner._id }),
    Agreement.countDocuments({ partyModel: 'Partner', party: partner._id }),
  ]);
  const links = describeLinks({
    'inventory items': items, sales, purchases, expenses, agreements,
  });

  if (links.length > 0 && !isForced(req)) {
    throw new LinkedRecordsError(
      `${partner.name} is linked to ${summariseLinks(links)}.`,
      links,
      'The partner is deleted. Items, sales, purchases and expenses stay in your records and are no longer linked to them; their agreements are deleted.'
    );
  }

  const unlink = { $set: { partner: null } };
  await Promise.all([
    Product.updateMany({ partner: partner._id }, unlink),
    Sale.updateMany({ partner: partner._id }, unlink),
    Purchase.updateMany({ partner: partner._id }, unlink),
    Expense.updateMany({ partner: partner._id }, unlink),
    Agreement.deleteMany({ partyModel: 'Partner', party: partner._id }),
    LedgerEntry.deleteMany({ entityType: 'partner', entityId: partner._id }),
  ]);
  await Partner.findByIdAndDelete(partner._id);

  await logAudit({ req, module: 'partners', action: 'delete', recordId: req.params.id, before: partner.toObject() });
  return sendSuccess(res, null, 200, `${partner.name} deleted permanently.`);
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
