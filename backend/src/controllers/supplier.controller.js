/**
 * ============================================
 * Supplier Controller
 * ============================================
 */

import Supplier from '../models/Supplier.js';
import Purchase from '../models/Purchase.js';
import LedgerEntry from '../models/LedgerEntry.js';
import { containsText } from '../utils/regex.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import {
  NotFoundError, BadRequestError, LinkedRecordsError, describeLinks, summariseLinks, isForced,
} from '../utils/AppError.js';
import { logAudit } from '../middleware/audit.js';
import SupplierPayment from '../models/SupplierPayment.js';
import { parseNumber } from '../utils/financialEngine.js';
import { PAYMENT_METHODS } from '../constants/index.js';

export const getSuppliers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search = '', status } = req.query;
  const query = {};
  if (search) {
    query.$or = [
      { name: containsText(search) },
      { phone: containsText(search) },
      { contactPerson: containsText(search) },
    ];
  }
  if (status && status !== 'all') query.status = status;

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(Math.max(1, parseInt(limit, 10) || 20), 500);
  const skip = (pageNumber - 1) * pageSize;
  const [suppliers, total, totals] = await Promise.all([
    Supplier.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    Supplier.countDocuments(query),
    Supplier.aggregate([
      {
        $group: {
          _id: null,
          suppliers: { $sum: 1 },
          purchases: { $sum: '$totalPurchases' },
          paid: { $sum: '$totalPaid' },
          payable: { $sum: '$payable' },
          owedTo: { $sum: { $cond: [{ $gt: ['$payable', 0] }, 1, 0] } },
        },
      },
    ]),
  ]);

  return sendSuccess(res, {
    suppliers,
    summary: totals[0] ? { ...totals[0], _id: undefined } : null,
    pagination: {
      page: pageNumber, limit: pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
});

export const getSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) throw new NotFoundError('Supplier');

  const [purchases, ledger, payments] = await Promise.all([
    Purchase.find({ supplier: supplier._id }).sort({ purchaseDate: -1 }).limit(25),
    LedgerEntry.find({ entityType: 'supplier', entityId: supplier._id }).sort({ entryDate: -1 }).limit(40),
    SupplierPayment.find({ supplier: supplier._id }).sort({ paymentDate: -1 }).limit(25),
  ]);

  return sendSuccess(res, { supplier, recentPurchases: purchases, ledger, payments });
});

export const createSupplier = asyncHandler(async (req, res) => {
  // An opening balance is money already owed on the day the supplier is added.
  const openingBalance = Math.max(0, parseNumber(req.body.openingBalance));
  const supplier = await Supplier.create({
    ...req.body,
    openingBalance,
    totalPurchases: 0,
    totalPaid: 0,
    payable: openingBalance,
  });
  await logAudit({ req, module: 'suppliers', action: 'create', recordId: supplier._id.toString(), after: supplier.toObject() });
  return sendSuccess(res, { supplier }, 201, 'Supplier created successfully.');
});

export const updateSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) throw new NotFoundError('Supplier');
  const before = supplier.toObject();
  // Running totals are the service's to keep. Only the opening balance may be
  // corrected here, and the payable moves by exactly the correction.
  const { totalPurchases, totalPaid, payable, openingBalance, ...details } = req.body;
  Object.assign(supplier, details);
  if (openingBalance !== undefined) {
    const next = Math.max(0, parseNumber(openingBalance));
    supplier.payable = Math.max(0, parseNumber(supplier.payable) + next - parseNumber(supplier.openingBalance));
    supplier.openingBalance = next;
  }
  await supplier.save();
  await logAudit({ req, module: 'suppliers', action: 'update', recordId: supplier._id.toString(), before, after: supplier.toObject() });
  return sendSuccess(res, { supplier }, 200, 'Supplier updated successfully.');
});

/**
 * DELETE /api/suppliers/:id[?force=true]
 *
 * A supplier with no purchases or payments is deleted at once. Otherwise the
 * delete is refused with the counts, and confirming deletes the supplier while
 * KEEPING those purchases and payments, filed under the supplier's name. They
 * are not deleted with it: the goods are on the shelf and the money has left
 * the till, and deleting the records would make stock and cash stop adding up.
 */
export const deleteSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) throw new NotFoundError('Supplier');

  const [purchaseCount, paymentCount] = await Promise.all([
    Purchase.countDocuments({ supplier: supplier._id }),
    SupplierPayment.countDocuments({ supplier: supplier._id }),
  ]);
  const links = describeLinks({ purchases: purchaseCount, payments: paymentCount });

  if (links.length > 0 && !isForced(req)) {
    throw new LinkedRecordsError(
      `${supplier.name} has ${summariseLinks(links)} on record.`,
      links,
      `The supplier is deleted. The purchases and payments stay in your records under the name "${supplier.name}", so stock and cash history remain correct.`
    );
  }

  await Purchase.updateMany(
    { supplier: supplier._id },
    { $set: { supplier: null, supplierName: supplier.name } }
  );
  await SupplierPayment.updateMany({ supplier: supplier._id }, { $set: { supplier: null } });
  await LedgerEntry.deleteMany({ entityType: 'supplier', entityId: supplier._id });
  await Supplier.findByIdAndDelete(supplier._id);

  await logAudit({ req, module: 'suppliers', action: 'delete', recordId: req.params.id, before: supplier.toObject() });
  return sendSuccess(res, null, 200, `${supplier.name} deleted permanently.`);
});

// ============================================================================
// Paying a supplier
// ============================================================================

/**
 * POST /api/suppliers/:id/payments
 * Body: { amount, paymentMethod, paymentDate?, referenceNumber?, notes? }
 *
 * Applied to the supplier's unpaid purchases oldest first; whatever is left
 * after every purchase is settled comes off the opening balance. Paying more
 * than is owed is refused - an advance to a supplier is a different thing and
 * should not be hidden inside a payment.
 */
export const paySupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) throw new NotFoundError('Supplier');

  const amount = Math.round(parseNumber(req.body.amount));
  const paymentMethod = PAYMENT_METHODS.includes(req.body.paymentMethod) ? req.body.paymentMethod : 'cash';
  const owed = parseNumber(supplier.payable);

  if (amount <= 0) throw new BadRequestError('Enter an amount greater than zero.');
  if (amount > owed) {
    throw new BadRequestError(
      `Only Rs. ${owed.toLocaleString('en-PK')} is owed to ${supplier.name}. Enter that amount or less.`
    );
  }

  const unpaid = await Purchase.find({
    supplier: supplier._id,
    status: { $in: ['unpaid', 'partial_payment'] },
    payable: { $gt: 0 },
  }).sort({ purchaseDate: 1, createdAt: 1 });

  let left = amount;
  const allocations = [];
  for (const purchase of unpaid) {
    if (left <= 0) break;
    const part = Math.min(left, parseNumber(purchase.payable));
    purchase.paid = parseNumber(purchase.paid) + part;
    purchase.payable = Math.max(0, parseNumber(purchase.payable) - part);
    purchase.status = purchase.payable === 0 ? 'completed' : 'partial_payment';
    await purchase.save();
    allocations.push({ purchase: purchase._id, invoiceNumber: purchase.invoiceNumber, amount: part });
    left -= part;
  }

  const payment = await SupplierPayment.create({
    supplier: supplier._id,
    supplierName: supplier.name,
    amount,
    paymentMethod,
    paymentDate: req.body.paymentDate ? new Date(req.body.paymentDate) : new Date(),
    referenceNumber: req.body.referenceNumber || '',
    notes: req.body.notes || '',
    allocations,
    createdBy: req.user.id,
  });

  supplier.totalPaid = parseNumber(supplier.totalPaid) + amount;
  supplier.payable = Math.max(0, owed - amount);
  await supplier.save();

  await LedgerEntry.create({
    entityType: 'supplier',
    entityId: supplier._id,
    entityName: supplier.name,
    reference: payment.referenceNumber || `Payment ${payment._id.toString().slice(-6).toUpperCase()}`,
    referenceType: 'supplier_payment',
    referenceId: payment._id,
    description: `Paid via ${paymentMethod}${allocations.length ? ` - ${allocations.map((a) => a.invoiceNumber).join(', ')}` : ''}`,
    debit: amount,
    credit: 0,
    balance: supplier.payable,
    entryDate: payment.paymentDate,
    createdBy: req.user.id,
  }).catch((error) => console.warn('[SUPPLIERS] Ledger entry not written:', error.message));

  await logAudit({
    req, module: 'suppliers', action: 'payment', recordId: supplier._id.toString(),
    after: payment.toObject(), reason: `Paid ${supplier.name} Rs. ${amount}`,
  });

  return sendSuccess(res, { payment, supplier }, 201, `Rs. ${amount.toLocaleString('en-PK')} paid to ${supplier.name}.`);
});

/** GET /api/suppliers/:id/payments */
export const getSupplierPayments = asyncHandler(async (req, res) => {
  const payments = await SupplierPayment.find({ supplier: req.params.id }).sort({ paymentDate: -1 });
  return sendSuccess(res, { payments });
});

/**
 * DELETE /api/suppliers/:id/payments/:paymentId
 * Undo a supplier payment: its amounts go back onto the purchases it settled
 * and onto the supplier's payable, and its ledger line is removed.
 */
export const deleteSupplierPayment = asyncHandler(async (req, res) => {
  const payment = await SupplierPayment.findById(req.params.paymentId);
  if (!payment) throw new NotFoundError('Supplier payment');

  for (const allocation of payment.allocations || []) {
    const purchase = await Purchase.findById(allocation.purchase);
    if (!purchase || purchase.status === 'cancelled') continue;
    purchase.paid = Math.max(0, parseNumber(purchase.paid) - parseNumber(allocation.amount));
    purchase.payable = parseNumber(purchase.payable) + parseNumber(allocation.amount);
    purchase.status = purchase.paid > 0 ? 'partial_payment' : 'unpaid';
    await purchase.save();
  }

  const supplier = payment.supplier ? await Supplier.findById(payment.supplier) : null;
  if (supplier) {
    supplier.totalPaid = Math.max(0, parseNumber(supplier.totalPaid) - parseNumber(payment.amount));
    supplier.payable = parseNumber(supplier.payable) + parseNumber(payment.amount);
    await supplier.save();
  }

  await LedgerEntry.deleteMany({ referenceType: 'supplier_payment', referenceId: payment._id });
  await SupplierPayment.findByIdAndDelete(payment._id);

  await logAudit({
    req, module: 'suppliers', action: 'delete', recordId: payment._id.toString(),
    before: payment.toObject(), reason: 'Supplier payment deleted',
  });

  return sendSuccess(res, { supplier }, 200, 'Payment deleted and the amount put back on the account.');
});
