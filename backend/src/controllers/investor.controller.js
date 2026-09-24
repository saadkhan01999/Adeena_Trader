/**
 * ============================================
 * Investor Controller
 * ============================================
 * NOTE: Investors are NOT part of Zakat calculations.
 * They are tracked separately for capital, profit, and payouts.
 */

import Investor from '../models/Investor.js';
import Investment from '../models/Investment.js';
import InvestorPayout from '../models/InvestorPayout.js';
import LedgerEntry from '../models/LedgerEntry.js';
import { containsText } from '../utils/regex.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import {
  NotFoundError, BadRequestError, LinkedRecordsError, describeLinks, summariseLinks, isForced,
} from '../utils/AppError.js';
import Agreement from '../models/Agreement.js';
import { logAudit } from '../middleware/audit.js';
import { calculateInvestorProfit } from '../utils/financialEngine.js';
import { generateReceiptNumber as genReceipt } from '../services/financial.service.js';

export const getInvestors = asyncHandler(async (req, res) => {
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
  const [investors, total] = await Promise.all([
    Investor.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
    Investor.countDocuments(query),
  ]);

  return sendSuccess(res, {
    investors,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) },
  });
});

export const getInvestor = asyncHandler(async (req, res) => {
  const investor = await Investor.findById(req.params.id);
  if (!investor) throw new NotFoundError('Investor');

  const [investments, payouts, ledger] = await Promise.all([
    Investment.find({ investor: investor._id }).sort({ investmentDate: -1 }),
    InvestorPayout.find({ investor: investor._id }).sort({ paymentDate: -1 }),
    LedgerEntry.find({ entityType: 'investor', entityId: investor._id }).sort({ entryDate: -1 }).limit(20),
  ]);

  return sendSuccess(res, { investor, investments, payouts, ledger });
});

export const createInvestor = asyncHandler(async (req, res) => {
  const investor = await Investor.create(req.body);

  // If initial investment provided, create investment record
  if (investor.totalInvestment > 0) {
    await Investment.create({
      investor: investor._id,
      amount: investor.totalInvestment,
      investmentDate: investor.investmentDate || new Date(),
      investmentType: investor.investmentType,
      profitPercentage: investor.profitPercentage,
      profitCalculationMethod: investor.profitCalculationMethod,
      businessAllocation: 'general',
      status: 'active',
      notes: 'Initial investment',
      createdBy: req.user.id,
    });

    // Ledger entry
    await LedgerEntry.create({
      entityType: 'investor',
      entityId: investor._id,
      entityName: investor.name,
      reference: 'INV-' + investor._id.toString().slice(-6).toUpperCase(),
      referenceType: 'investment',
      referenceId: investor._id,
      description: 'Initial investment',
      debit: investor.totalInvestment,
      credit: 0,
      balance: investor.totalInvestment,
      entryDate: new Date(),
      createdBy: req.user.id,
    });
  }

  await logAudit({ req, module: 'investors', action: 'create', recordId: investor._id.toString(), after: investor.toObject() });
  return sendSuccess(res, { investor }, 201, 'Investor created successfully.');
});

export const updateInvestor = asyncHandler(async (req, res) => {
  const investor = await Investor.findById(req.params.id);
  if (!investor) throw new NotFoundError('Investor');
  const before = investor.toObject();
  Object.assign(investor, req.body);
  await investor.save();
  await logAudit({ req, module: 'investors', action: 'update', recordId: investor._id.toString(), before, after: investor.toObject() });
  return sendSuccess(res, { investor }, 200, 'Investor updated successfully.');
});

/**
 * DELETE /api/investors/:id[?force=true]
 *
 * Investments and payouts belong to the investor alone, so a confirmed delete
 * removes them with the investor, along with their agreements and ledger.
 */
export const deleteInvestor = asyncHandler(async (req, res) => {
  const investor = await Investor.findById(req.params.id);
  if (!investor) throw new NotFoundError('Investor');

  const [investments, payouts, agreements] = await Promise.all([
    Investment.countDocuments({ investor: investor._id }),
    InvestorPayout.countDocuments({ investor: investor._id }),
    Agreement.countDocuments({ partyModel: 'Investor', party: investor._id }),
  ]);
  const links = describeLinks({ investments, payouts, agreements });

  if (links.length > 0 && !isForced(req)) {
    throw new LinkedRecordsError(
      `${investor.name} has ${summariseLinks(links)} on record.`,
      links,
      'Deleting removes the investor together with all of these. This cannot be undone.'
    );
  }

  await Promise.all([
    Investment.deleteMany({ investor: investor._id }),
    InvestorPayout.deleteMany({ investor: investor._id }),
    Agreement.deleteMany({ partyModel: 'Investor', party: investor._id }),
    LedgerEntry.deleteMany({ entityType: 'investor', entityId: investor._id }),
  ]);
  await Investor.findByIdAndDelete(investor._id);

  await logAudit({ req, module: 'investors', action: 'delete', recordId: req.params.id, before: investor.toObject() });
  return sendSuccess(res, null, 200, `${investor.name} deleted permanently.`);
});

/**
 * POST /api/investors/:id/investments
 * Add a new investment to an existing investor.
 */
export const addInvestment = asyncHandler(async (req, res) => {
  const investor = await Investor.findById(req.params.id);
  if (!investor) throw new NotFoundError('Investor');

  const investment = await Investment.create({
    ...req.body,
    investor: investor._id,
    createdBy: req.user.id,
  });

  // Update investor totals
  investor.totalInvestment += investment.amount;
  await investor.save();

  // Ledger entry
  await LedgerEntry.create({
    entityType: 'investor',
    entityId: investor._id,
    entityName: investor.name,
    reference: 'INV-' + investment._id.toString().slice(-6).toUpperCase(),
    referenceType: 'investment',
    referenceId: investment._id,
    description: `Additional investment - ${investment.notes || ''}`,
    debit: investment.amount,
    credit: 0,
    balance: investor.totalInvestment,
    entryDate: new Date(),
    createdBy: req.user.id,
  });

  await logAudit({ req, module: 'investors', action: 'create', recordId: investment._id.toString(), after: investment.toObject() });
  return sendSuccess(res, { investment, investor }, 201, 'Investment added successfully.');
});

/**
 * POST /api/investors/:id/payouts
 * Record a profit payout to an investor.
 */
export const recordPayout = asyncHandler(async (req, res) => {
  const investor = await Investor.findById(req.params.id);
  if (!investor) throw new NotFoundError('Investor');

  const { payoutAmount, paymentDate, paymentMethod, referenceNumber, notes } = req.body;

  // Check if investor has enough remaining profit
  if (payoutAmount > investor.profitRemaining) {
    throw new BadRequestError(`Payout amount exceeds remaining profit. Available: Rs. ${investor.profitRemaining.toLocaleString()}`);
  }

  const receiptNumber = await genReceipt();

  const payout = await InvestorPayout.create({
    investor: investor._id,
    payoutAmount,
    paymentDate: paymentDate || new Date(),
    paymentMethod: paymentMethod || 'cash',
    referenceNumber: referenceNumber || '',
    receiptNumber,
    notes: notes || '',
    status: 'completed',
    createdBy: req.user.id,
  });

  // Update investor totals
  investor.profitPaid += payoutAmount;
  investor.profitRemaining = Math.max(0, investor.profitRemaining - payoutAmount);
  await investor.save();

  // Ledger entry
  await LedgerEntry.create({
    entityType: 'investor',
    entityId: investor._id,
    entityName: investor.name,
    reference: receiptNumber,
    referenceType: 'payout',
    referenceId: payout._id,
    description: `Profit payout - ${paymentMethod}`,
    debit: 0,
    credit: payoutAmount,
    balance: investor.profitRemaining,
    entryDate: new Date(),
    createdBy: req.user.id,
  });

  await logAudit({ req, module: 'investors', action: 'payment', recordId: payout._id.toString(), after: payout.toObject() });
  return sendSuccess(res, { payout, investor }, 201, `Payout recorded. Receipt: ${receiptNumber}`);
});

/**
 * GET /api/investors/dashboard
 * Investor dashboard summary.
 */
export const getInvestorDashboard = asyncHandler(async (req, res) => {
  const [totalInvestors, totalInvestment, totalProfitPaid, totalProfitRemaining] = await Promise.all([
    Investor.countDocuments({ status: 'active' }),
    Investor.aggregate([{ $match: { status: 'active' } }, { $group: { _id: null, total: { $sum: '$totalInvestment' } } }]),
    Investor.aggregate([{ $match: { status: 'active' } }, { $group: { _id: null, total: { $sum: '$profitPaid' } } }]),
    Investor.aggregate([{ $match: { status: 'active' } }, { $group: { _id: null, total: { $sum: '$profitRemaining' } } }]),
  ]);

  return sendSuccess(res, {
    totalInvestors,
    totalInvestment: totalInvestment[0]?.total || 0,
    totalProfitPaid: totalProfitPaid[0]?.total || 0,
    totalProfitRemaining: totalProfitRemaining[0]?.total || 0,
  });
});

/**
 * DELETE /api/investors/:id/investments/:investmentId
 * Remove one investment entered by mistake. The investor's capital total and
 * ledger move back by exactly its amount.
 */
export const deleteInvestment = asyncHandler(async (req, res) => {
  const investment = await Investment.findOne({ _id: req.params.investmentId, investor: req.params.id });
  if (!investment) throw new NotFoundError('Investment');

  const investor = await Investor.findById(req.params.id);
  if (investor) {
    investor.totalInvestment = Math.max(0, (investor.totalInvestment || 0) - (investment.amount || 0));
    await investor.save();
  }

  await LedgerEntry.deleteMany({ referenceType: 'investment', referenceId: investment._id });
  await Investment.findByIdAndDelete(investment._id);

  await logAudit({ req, module: 'investors', action: 'delete', recordId: investment._id.toString(), before: investment.toObject() });
  return sendSuccess(res, { investor }, 200, 'Investment deleted permanently.');
});

/**
 * DELETE /api/investors/:id/payouts/:payoutId
 * Remove a profit payout entered by mistake; the amount goes back to the
 * investor's unpaid profit.
 */
export const deletePayout = asyncHandler(async (req, res) => {
  const payout = await InvestorPayout.findOne({ _id: req.params.payoutId, investor: req.params.id });
  if (!payout) throw new NotFoundError('Payout');

  const investor = await Investor.findById(req.params.id);
  if (investor) {
    investor.profitPaid = Math.max(0, (investor.profitPaid || 0) - (payout.payoutAmount || 0));
    investor.profitRemaining = (investor.profitRemaining || 0) + (payout.payoutAmount || 0);
    await investor.save();
  }

  await LedgerEntry.deleteMany({ referenceType: 'payout', referenceId: payout._id });
  await InvestorPayout.findByIdAndDelete(payout._id);

  await logAudit({ req, module: 'investors', action: 'delete', recordId: payout._id.toString(), before: payout.toObject() });
  return sendSuccess(res, { investor }, 200, 'Payout deleted permanently.');
});
