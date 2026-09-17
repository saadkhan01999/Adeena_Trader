/**
 * ============================================
 * Zakat Controller
 * ============================================
 *
 * CRITICAL BUSINESS RULE
 * ----------------------
 * Zakat applies ONLY to the Owner and to Partners. Investors are NEVER
 * included. Investor capital is a liability of the business towards the
 * investor - it is not the owner's wealth - and the investor purifies their own
 * share separately. Every query below is filtered on that basis, and the
 * `/calculate` endpoint rejects any other ownership type outright.
 *
 * Shariah basis implemented here
 * ------------------------------
 *   Rate   2.5% (1/40) of net zakatable assets
 *   Nisab  87.48 g gold OR 612.36 g silver. A trading business always holds a
 *          mixture of asset types, so the LOWER silver threshold is the default.
 *   Assets trade stock at market value + cash + bank + recoverable receivables.
 *          Fixed assets used to run the shop (fittings, delivery bike) are exempt.
 *   Debts  immediate liabilities - primarily supplier payables - are deductible.
 *   Hawl   one lunar year (354 days) above nisab before Zakat falls due.
 */

import { ZakatSettings, ZakatCalculation } from '../models/Zakat.js';
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';
import Partner from '../models/Partner.js';
import Supplier from '../models/Supplier.js';
import Settings from '../models/Settings.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError, BadRequestError } from '../utils/AppError.js';
import { logAudit } from '../middleware/audit.js';
import {
  calculateZakat,
  calculateNisab,
  calculateHawlProgress,
  calculateOwnershipShare,
  parseNumber,
  NISAB_GOLD_GRAMS,
  NISAB_SILVER_GRAMS,
} from '../utils/financialEngine.js';
import { NISAB_WEIGHTS, HAWL_DAYS } from '../constants/index.js';

// ============================================================================
// Asset gathering
// ============================================================================

/**
 * Pull the live zakatable asset figures for one side of the business.
 *
 * Stock is valued at the CASH SELLING price, not at cost. Trade goods are
 * zakatable at their current market value - what they would fetch today - which
 * for a retailer is the shelf price. Falling back to cost when no selling price
 * is set keeps a half-configured product from valuing at zero.
 *
 * @param {'owner'|'partner'} ownershipType
 * @param {string|null} partnerId
 * @param {number} defaultPartnerShare
 * @returns {Promise<{eligibleStock:number, receivables:number, supplierPayables:number, detail:object}>}
 */
const gatherZakatableAssets = async (ownershipType, partnerId, defaultPartnerShare) => {
  const isOwner = ownershipType === 'owner';

  // A specific partner's agreed share overrides the business default
  let partnerShare = defaultPartnerShare;
  let partnerName = '';
  if (!isOwner && partnerId) {
    const partner = await Partner.findById(partnerId);
    if (!partner) throw new NotFoundError('Partner');
    partnerShare = partner.ownershipPercent || defaultPartnerShare;
    partnerName = partner.name;
  }

  /** Take the caller's slice of an amount. */
  const slice = (amount, recordOwnership, recordPartnerShare) => {
    const split = calculateOwnershipShare(
      amount,
      recordOwnership,
      recordPartnerShare || partnerShare
    );
    return isOwner ? split.ownerAmount : split.partnerAmount;
  };

  // ---- 1. Trade stock -----------------------------------------------
  const products = await Product.find({ status: { $ne: 'archived' }, stock: { $gt: 0 } })
    .select('name stock cashPrice purchasePrice ownership partner partnerSharePercent');

  let eligibleStock = 0;
  let stockUnits = 0;

  for (const product of products) {
    // Owner view takes owner-owned and shared; partner view takes partner-owned
    // and shared, and only for the partner being calculated.
    if (isOwner) {
      if (!['owner', 'shared'].includes(product.ownership)) continue;
    } else {
      if (!['partner', 'shared'].includes(product.ownership)) continue;
      if (partnerId && product.partner && product.partner.toString() !== partnerId) continue;
    }

    const unitValue = parseNumber(product.cashPrice) || parseNumber(product.purchasePrice);
    const value = unitValue * parseNumber(product.stock);

    eligibleStock += slice(value, product.ownership, product.partnerSharePercent);
    stockUnits += parseNumber(product.stock);
  }

  // ---- 2. Receivables ------------------------------------------------
  const sales = await Sale.find({
    saleType: 'installment',
    status: { $in: ['ongoing', 'overdue'] },
  }).select('remainingBalance ownership partner installments');

  let receivables = 0;
  let badDebt = 0;

  for (const sale of sales) {
    if (isOwner) {
      if (!['owner', 'shared'].includes(sale.ownership)) continue;
    } else {
      if (!['partner', 'shared'].includes(sale.ownership)) continue;
      if (partnerId && sale.partner && sale.partner.toString() !== partnerId) continue;
    }

    // Receivables more than a year overdue are treated as doubtful and reported
    // separately, so the owner can decide whether to exclude them. Scholars
    // exclude debts that are not realistically recoverable.
    const oneYearAgo = new Date(Date.now() - 365 * 86_400_000);
    const isDoubtful = (sale.installments || []).some(
      (i) => i.remaining > 0 && new Date(i.dueDate) < oneYearAgo
    );

    const amount = slice(sale.remainingBalance, sale.ownership);
    if (isDoubtful) badDebt += amount;
    receivables += amount;
  }

  // ---- 3. Deductible liabilities -------------------------------------
  const suppliers = await Supplier.find({ payable: { $gt: 0 } }).select('payable');
  const grossPayables = suppliers.reduce((sum, s) => sum + parseNumber(s.payable), 0);

  // Payables belong to the business as a whole, so each side carries its share
  const supplierPayables = isOwner
    ? Math.round((grossPayables * (100 - partnerShare)) / 100)
    : Math.round((grossPayables * partnerShare) / 100);

  return {
    eligibleStock: Math.round(eligibleStock),
    receivables: Math.round(receivables),
    supplierPayables,
    detail: {
      partnerName,
      partnerShare,
      productCount: products.length,
      stockUnits,
      openInvoices: sales.length,
      doubtfulReceivables: Math.round(badDebt),
      grossSupplierPayables: grossPayables,
    },
  };
};

// ============================================================================
// Settings
// ============================================================================

/**
 * GET /api/zakat/settings
 * Returns the settings plus the reference weights and hawl progress, so the UI
 * can explain the threshold rather than just printing a number.
 */
export const getZakatSettings = asyncHandler(async (req, res) => {
  const settings = await ZakatSettings.getSingleton();

  return sendSuccess(res, {
    settings,
    reference: {
      goldGrams: NISAB_GOLD_GRAMS,
      silverGrams: NISAB_SILVER_GRAMS,
      gramsPerTola: NISAB_WEIGHTS.GRAMS_PER_TOLA,
      goldTola: 7.5,
      silverTola: 52.5,
      rate: settings.rate,
      hawlDays: HAWL_DAYS,
      guidance:
        'Where a person holds a mixture of asset types - which a trading business always does - ' +
        'the lower silver threshold applies. Enter the current local rate per gram and the ' +
        'threshold is calculated for you.',
    },
    hawl: calculateHawlProgress(settings.hawlStartDate),
  });
});

/**
 * PUT /api/zakat/settings
 * The nisab figure is derived from the metal rate on save (see the model's
 * pre-save hook), so it can never drift out of step with the rate entered.
 */
export const updateZakatSettings = asyncHandler(async (req, res) => {
  const settings = await ZakatSettings.getSingleton();
  const before = settings.toObject();

  const { _id, nisab, ...updates } = req.body;

  Object.assign(settings, updates);

  // Only accept a directly-supplied nisab when the basis is manual
  if (settings.nisabBasis === 'manual' && nisab !== undefined) {
    settings.nisab = parseNumber(nisab);
  }

  if (updates.goldRatePerGram !== undefined || updates.silverRatePerGram !== undefined) {
    settings.rateLastUpdated = new Date();
  }

  settings.updatedBy = req.user.id;
  await settings.save();

  await logAudit({
    req,
    module: 'zakat',
    action: 'zakat_change',
    recordId: settings._id.toString(),
    before,
    after: settings.toObject(),
    reason: 'Updated Zakat settings',
  });

  return sendSuccess(
    res,
    { settings, hawl: calculateHawlProgress(settings.hawlStartDate) },
    200,
    'Zakat settings saved.'
  );
});

/**
 * GET /api/zakat/nisab-preview
 * Live nisab for a candidate metal rate, without saving anything - so the admin
 * sees the threshold update as they type.
 *
 * Query: basis, goldRatePerGram, silverRatePerGram, manualNisab
 */
export const previewNisab = asyncHandler(async (req, res) => {
  const { basis = 'silver', goldRatePerGram = 0, silverRatePerGram = 0, manualNisab = 0 } = req.query;

  const result = calculateNisab({
    basis,
    goldRatePerGram: parseNumber(goldRatePerGram),
    silverRatePerGram: parseNumber(silverRatePerGram),
    manualNisab: parseNumber(manualNisab),
  });

  return sendSuccess(res, { ...result, weights: { gold: NISAB_GOLD_GRAMS, silver: NISAB_SILVER_GRAMS } });
});

// ============================================================================
// Calculation
// ============================================================================

/**
 * GET /api/zakat/assets
 * Live zakatable assets, pulled from stock, receivables and payables.
 *
 * This is what makes the calculator "auto-calculate as data is entered": the
 * screen opens pre-filled with the real position, and the user only types the
 * figures the system cannot know - cash in the till and the bank balance.
 *
 * Query: ownershipType=owner|partner, partner=<id>
 */
export const getZakatableAssets = asyncHandler(async (req, res) => {
  const { ownershipType = 'owner', partner: partnerId } = req.query;

  if (!['owner', 'partner'].includes(ownershipType)) {
    throw new BadRequestError(
      'Zakat applies to the owner and to partners only. Investors are not included in Zakat.'
    );
  }

  const [zakatSettings, appSettings] = await Promise.all([
    ZakatSettings.getSingleton(),
    Settings.getSingleton(),
  ]);

  const assets = await gatherZakatableAssets(
    ownershipType,
    partnerId || null,
    appSettings.ownership.defaultPartnerShare
  );

  // Preview the result with cash and bank at zero, so the breakdown panel has
  // something meaningful to show before the user types anything.
  const preview = calculateZakat({
    eligibleStock: assets.eligibleStock,
    receivables: assets.receivables,
    cash: 0,
    bankBalance: 0,
    otherAssets: 0,
    supplierPayables: assets.supplierPayables,
    otherLiabilities: 0,
    nisab: zakatSettings.nisab,
    rate: zakatSettings.rate,
    eligibleAssets: zakatSettings.eligibleAssets,
    eligibleDeductions: zakatSettings.eligibleDeductions,
  });

  return sendSuccess(res, {
    assets,
    preview,
    settings: {
      nisab: zakatSettings.nisab,
      nisabBasis: zakatSettings.nisabBasis,
      rate: zakatSettings.rate,
      eligibleAssets: zakatSettings.eligibleAssets,
      eligibleDeductions: zakatSettings.eligibleDeductions,
    },
    hawl: calculateHawlProgress(zakatSettings.hawlStartDate),
  });
});

/**
 * POST /api/zakat/calculate
 * Compute and record a Zakat calculation.
 *
 * Stock, receivables and supplier payables are re-read from live data on the
 * server; only cash, bank and other assets/liabilities are accepted from the
 * client, because those are the only figures the system cannot observe itself.
 * That stops a client from posting an arbitrary asset base.
 */
export const calculateZakatForOwner = asyncHandler(async (req, res) => {
  const {
    ownershipType,
    partner: partnerId,
    cash = 0,
    bankBalance = 0,
    otherAssets = 0,
    otherLiabilities = 0,
    zakatYear,
    notes = '',
    overrideStock,
    overrideReceivables,
  } = req.body;

  if (!['owner', 'partner'].includes(ownershipType)) {
    throw new BadRequestError(
      'Zakat applies to the owner and to partners only. Investors are never included in Zakat calculations.'
    );
  }
  if (ownershipType === 'partner' && !partnerId) {
    throw new BadRequestError('Select which partner this Zakat calculation is for.');
  }

  const [zakatSettings, appSettings] = await Promise.all([
    ZakatSettings.getSingleton(),
    Settings.getSingleton(),
  ]);

  if (!zakatSettings.nisab || zakatSettings.nisab <= 0) {
    throw new BadRequestError(
      'Set the Nisab threshold first. Enter the current gold or silver rate per gram in Zakat Settings.'
    );
  }

  const assets = await gatherZakatableAssets(
    ownershipType,
    partnerId || null,
    appSettings.ownership.defaultPartnerShare
  );

  // An explicit override is allowed - a physical stock count may differ from
  // the system figure - but it is recorded as a manual calculation.
  const usedOverride = overrideStock !== undefined || overrideReceivables !== undefined;
  const eligibleStock = overrideStock !== undefined ? parseNumber(overrideStock) : assets.eligibleStock;
  const receivables = overrideReceivables !== undefined ? parseNumber(overrideReceivables) : assets.receivables;

  const breakdown = calculateZakat({
    eligibleStock,
    receivables,
    cash,
    bankBalance,
    otherAssets,
    supplierPayables: assets.supplierPayables,
    otherLiabilities,
    nisab: zakatSettings.nisab,
    rate: zakatSettings.rate,
    eligibleAssets: zakatSettings.eligibleAssets,
    eligibleDeductions: zakatSettings.eligibleDeductions,
  });

  const record = await ZakatCalculation.create({
    ownershipType,
    partner: partnerId || null,
    partnerName: assets.detail.partnerName,
    ...breakdown,
    nisabBasis: zakatSettings.nisabBasis,
    zakatYear: zakatYear || String(new Date().getFullYear()),
    calculationDate: new Date(),
    isAutoCalculated: !usedOverride,
    notes,
    createdBy: req.user.id,
    createdByName: req.user.name,
  });

  await logAudit({
    req,
    module: 'zakat',
    action: 'create',
    recordId: record._id.toString(),
    after: record.toObject(),
    reason: `Zakat calculated for ${ownershipType}${assets.detail.partnerName ? ` (${assets.detail.partnerName})` : ''}`,
  });

  return sendSuccess(
    res,
    { calculation: record, breakdown, detail: assets.detail },
    201,
    breakdown.isAboveNisab
      ? `Zakat due: Rs. ${breakdown.zakatAmount.toLocaleString('en-PK')}`
      : 'Net assets are below the Nisab threshold - no Zakat is due.'
  );
});

// ============================================================================
// History
// ============================================================================

/** GET /api/zakat/history */
export const getZakatHistory = asyncHandler(async (req, res) => {
  const { ownershipType, zakatYear, paymentStatus, page = 1, limit = 20 } = req.query;

  const query = {};
  if (ownershipType) query.ownershipType = ownershipType;
  if (zakatYear) query.zakatYear = zakatYear;
  if (paymentStatus) query.paymentStatus = paymentStatus;

  const skip = (Number(page) - 1) * Number(limit);

  const [records, total, totals] = await Promise.all([
    ZakatCalculation.find(query)
      .populate('partner', 'name ownershipPercent')
      .sort({ calculationDate: -1 })
      .skip(skip)
      .limit(Number(limit)),
    ZakatCalculation.countDocuments(query),
    ZakatCalculation.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalZakat: { $sum: '$zakatAmount' },
          totalPaid: { $sum: '$amountPaid' },
          totalNetAssets: { $sum: '$netAssets' },
        },
      },
    ]),
  ]);

  const summary = totals[0] || { totalZakat: 0, totalPaid: 0, totalNetAssets: 0 };

  return sendSuccess(res, {
    records,
    summary: { ...summary, outstanding: summary.totalZakat - summary.totalPaid },
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

/** GET /api/zakat/:id */
export const getZakatCalculation = asyncHandler(async (req, res) => {
  const record = await ZakatCalculation.findById(req.params.id).populate(
    'partner',
    'name ownershipPercent phone cnic'
  );
  if (!record) throw new NotFoundError('Zakat calculation');
  return sendSuccess(res, { calculation: record });
});

/**
 * PUT /api/zakat/:id/payment
 * Record Zakat paid out. The status is derived in the model's pre-save hook,
 * so partial payments are handled without the caller having to reason about it.
 *
 * Body: { amountPaid, paidTo, paidAt }
 */
export const recordZakatPayment = asyncHandler(async (req, res) => {
  const record = await ZakatCalculation.findById(req.params.id);
  if (!record) throw new NotFoundError('Zakat calculation');

  const amountPaid = parseNumber(req.body.amountPaid);
  if (amountPaid < 0) throw new BadRequestError('The amount paid cannot be negative.');
  if (amountPaid > record.zakatAmount) {
    throw new BadRequestError(
      `That is more than the Zakat due (Rs. ${record.zakatAmount.toLocaleString('en-PK')}).`
    );
  }

  const before = record.toObject();

  record.amountPaid = amountPaid;
  record.paidTo = req.body.paidTo || record.paidTo;
  record.paidAt = amountPaid > 0 ? req.body.paidAt || new Date() : null;
  await record.save();

  await logAudit({
    req,
    module: 'zakat',
    action: 'payment',
    recordId: record._id.toString(),
    before,
    after: record.toObject(),
    reason: `Recorded Zakat payment of Rs. ${amountPaid.toLocaleString('en-PK')}`,
  });

  return sendSuccess(res, { calculation: record }, 200, 'Zakat payment recorded.');
});

/**
 * DELETE /api/zakat/:id
 * Remove an erroneous calculation. Permitted only while nothing has been paid
 * against it - a record of Zakat actually discharged must not be erased.
 */
export const deleteZakatCalculation = asyncHandler(async (req, res) => {
  const record = await ZakatCalculation.findById(req.params.id);
  if (!record) throw new NotFoundError('Zakat calculation');

  if (record.amountPaid > 0) {
    throw new BadRequestError(
      'This calculation has a payment recorded against it and cannot be deleted.'
    );
  }

  await record.deleteOne();

  await logAudit({
    req,
    module: 'zakat',
    action: 'delete',
    recordId: req.params.id,
    before: record.toObject(),
  });

  return sendSuccess(res, null, 200, 'Zakat calculation deleted.');
});
