/**
 * ============================================
 * Reversal Service
 * ============================================
 * Undoing a financial record - a sale, a payment, a purchase, a return.
 *
 * Two operations, deliberately different
 * --------------------------------------
 * `cancel*` marks the record cancelled and undoes its effects on stock,
 * ledgers and balances. The document stays, and still appears in history. This
 * is the safe default and what everyone with the relevant permission gets.
 *
 * `delete*` does the same reversal and then removes the document and its trail
 * outright. It is restricted to admins at the route layer. A shop owner needs a
 * real delete for a record entered entirely by mistake - a test sale, a
 * duplicate - and refusing to provide one only leads to it being done directly
 * in the database, which is worse.
 *
 * Why reverse-then-recalculate rather than subtract
 * ------------------------------------------------
 * Every function here ends by calling `recalculateCustomerTotals`, which
 * derives a customer's totals from the surviving sales and payments rather
 * than subtracting from a running figure. Arithmetic patching drifts: one
 * failed reversal, one double-click, and the customer's outstanding balance no
 * longer matches their invoices, with nothing to say which is right. Deriving
 * from source records cannot drift, because the records are the truth.
 *
 * Ordering rules
 * --------------
 * A sale cannot be cancelled while payments are still attached to it. This
 * looks like an obstacle and is in fact the point: reversing the sale first
 * would leave collected money pointing at an invoice that no longer exists,
 * and the customer's receipt would no longer match anything. The error names
 * the payments, so the user knows exactly what to reverse first.
 */

import Sale from '../models/Sale.js';
import Payment from '../models/Payment.js';
import Purchase from '../models/Purchase.js';
import Return from '../models/Return.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import Supplier from '../models/Supplier.js';
import Agreement from '../models/Agreement.js';
import LedgerEntry from '../models/LedgerEntry.js';
import StockMovement from '../models/StockMovement.js';

import { recalculateCustomerTotals } from './financial.service.js';
import { NotFoundError, BadRequestError } from '../utils/AppError.js';

/** Coerce a possibly-undefined numeric field. */
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// ============================================================================
// Stock
// ============================================================================

/**
 * Move stock back and leave a movement record saying why.
 *
 * The reversing movement is written rather than the original being deleted, so
 * the stock history reads as what actually happened: it went out on the 4th and
 * came back on the 9th. Deleting the original would make the 4th look like it
 * never happened, while the physical stock had in fact moved twice.
 *
 * @param {Array} items         Line items, each with product and quantity.
 * @param {number} direction    +1 to put stock back (reversing a sale), -1 to
 *                              take it away again (reversing a purchase).
 * @param {object} context      { reference, referenceId, userId, reason }
 */
const adjustStock = async (items, direction, { reference, referenceId, userId, reason }) => {
  for (const item of items || []) {
    const product = await Product.findById(item.product);
    if (!product) continue; // Deleted product: nothing to put back.

    const quantity = num(item.quantity) * direction;
    const quantityBefore = num(product.stock);
    const quantityAfter = Math.max(0, quantityBefore + quantity);

    product.stock = quantityAfter;
    if (quantityAfter === 0) product.status = 'out_of_stock';
    else if (product.status === 'out_of_stock') product.status = 'active';
    await product.save();

    await StockMovement.create({
      product: product._id,
      productName: product.name,
      type: 'adjustment',
      quantity,
      quantityBefore,
      quantityAfter,
      reference,
      referenceId,
      notes: reason,
      movementDate: new Date(),
      createdBy: userId,
    });
  }
};

// ============================================================================
// Payments
// ============================================================================

/**
 * Take a payment back off the installments it was applied to.
 *
 * Allocation number 0 marks a sale's down payment, which is not a row in the
 * instalment schedule - there is nothing to un-apply, and the advance is undone
 * by cancelling the sale itself.
 */
const unapplyAllocations = async (payment) => {
  const touched = new Map();

  for (const allocation of payment.allocations || []) {
    if (!allocation.sale || allocation.installmentNumber === 0) continue;

    const key = String(allocation.sale);
    const sale = touched.get(key) || (await Sale.findById(allocation.sale));
    if (!sale) continue;
    touched.set(key, sale);

    const installment = (sale.installments || []).find(
      (i) => i.number === allocation.installmentNumber
    );
    if (!installment) continue;

    installment.paid = Math.max(0, num(installment.paid) - num(allocation.allocatedAmount));
    installment.remaining = Math.max(0, num(installment.expected) - num(installment.paid));

    if (installment.paid === 0) {
      installment.status = 'upcoming';
      installment.paidDate = null;
    } else {
      installment.status = 'partially_paid';
    }
  }

  // Re-derive each touched sale's balance and status from its own schedule.
  for (const sale of touched.values()) {
    sale.remainingBalance = (sale.installments || []).reduce(
      (sum, i) => sum + num(i.remaining),
      0
    );

    if (sale.status !== 'cancelled') {
      sale.status = sale.remainingBalance === 0 ? 'completed' : 'ongoing';
    }
    await sale.save();
  }
};

/**
 * Reverse a payment: un-apply it, mark it reversed, correct the customer.
 *
 * @param {string} paymentId
 * @param {object} user
 * @param {string} [reason]
 * @returns {Promise<object>} The reversed payment.
 */
export const reversePayment = async (paymentId, user, reason = '') => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new NotFoundError('Payment');

  if (payment.status === 'reversed') {
    throw new BadRequestError('This payment has already been reversed.');
  }

  await unapplyAllocations(payment);

  payment.status = 'reversed';
  payment.notes = [payment.notes, reason && `Reversed: ${reason}`].filter(Boolean).join(' | ');
  payment.reversedAt = new Date();
  payment.reversedBy = user?.id;
  await payment.save();

  await LedgerEntry.deleteMany({ referenceType: 'payment', referenceId: payment._id });
  await recalculateCustomerTotals(payment.customer);

  return payment;
};

/** Reverse a payment and then remove it and its trail entirely. */
export const deletePayment = async (paymentId, user) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new NotFoundError('Payment');

  // Reverse first, unless a previous reversal already did the un-applying.
  if (payment.status !== 'reversed') await unapplyAllocations(payment);

  const customerId = payment.customer;
  await LedgerEntry.deleteMany({ referenceType: 'payment', referenceId: payment._id });
  await Payment.findByIdAndDelete(paymentId);
  await recalculateCustomerTotals(customerId);

  return { receiptNumber: payment.receiptNumber };
};

// ============================================================================
// Sales
// ============================================================================

/**
 * Payments still attached to a sale, ignoring ones already reversed and the
 * sale's own down payment.
 */
const livePaymentsFor = async (saleId) =>
  Payment.find({
    status: { $ne: 'reversed' },
    allocations: { $elemMatch: { sale: saleId, installmentNumber: { $gt: 0 } } },
  });

/**
 * Undo a sale's effects: stock back on the shelf, ledger entries removed, the
 * advance receipt reversed.
 */
const reverseSaleEffects = async (sale, user, reason) => {
  await adjustStock(sale.items, +1, {
    reference: sale.invoiceNumber,
    referenceId: sale._id,
    userId: user?.id,
    reason: reason || `Sale ${sale.invoiceNumber} reversed`,
  });

  // The advance was written as a real Payment when the sale was created, so it
  // has to come back out with the sale.
  const advancePayments = await Payment.find({
    status: { $ne: 'reversed' },
    allocations: { $elemMatch: { sale: sale._id, installmentNumber: 0 } },
  });

  for (const payment of advancePayments) {
    payment.status = 'reversed';
    payment.reversedAt = new Date();
    payment.reversedBy = user?.id;
    await payment.save();
    await LedgerEntry.deleteMany({ referenceType: 'payment', referenceId: payment._id });
  }

  await LedgerEntry.deleteMany({ referenceType: 'sale', referenceId: sale._id });
};

/**
 * Cancel a sale. The invoice stays in history, marked cancelled.
 *
 * @param {string} saleId
 * @param {object} user
 * @param {string} [reason]
 */
export const cancelSale = async (saleId, user, reason = '') => {
  const sale = await Sale.findById(saleId);
  if (!sale) throw new NotFoundError('Sale');

  if (sale.status === 'cancelled') {
    throw new BadRequestError('This sale has already been cancelled.');
  }

  const payments = await livePaymentsFor(sale._id);
  if (payments.length > 0) {
    throw new BadRequestError(
      `This sale has ${payments.length} payment(s) recorded against it ` +
      `(${payments.map((p) => p.receiptNumber).join(', ')}). ` +
      'Reverse those payments first, then cancel the sale.'
    );
  }

  await reverseSaleEffects(sale, user, reason);

  sale.status = 'cancelled';
  sale.remainingBalance = 0;
  sale.notes = [sale.notes, reason && `Cancelled: ${reason}`].filter(Boolean).join(' | ');
  sale.cancelledAt = new Date();
  sale.cancelledBy = user?.id;
  await sale.save();

  // A cancelled sale must not leave a live agreement pointing at it.
  await Agreement.updateMany(
    { sale: sale._id, status: { $ne: 'cancelled' } },
    { $set: { status: 'cancelled' } }
  );

  await recalculateCustomerTotals(sale.customer);
  return sale;
};

/** Cancel a sale and then remove it and its trail entirely. */
export const deleteSale = async (saleId, user) => {
  const sale = await Sale.findById(saleId);
  if (!sale) throw new NotFoundError('Sale');

  const payments = await livePaymentsFor(sale._id);
  if (payments.length > 0) {
    throw new BadRequestError(
      `This sale has ${payments.length} payment(s) recorded against it ` +
      `(${payments.map((p) => p.receiptNumber).join(', ')}). ` +
      'Delete or reverse those payments first, then delete the sale.'
    );
  }

  if (sale.status !== 'cancelled') {
    await reverseSaleEffects(sale, user, 'Sale deleted');
  }

  const customerId = sale.customer;

  // A single payment can be spread across several of a customer's invoices -
  // recordPaymentWithAllocation walks every open instalment the customer has,
  // oldest first, not just the ones on one sale. Deleting every payment that
  // merely mentions this sale would therefore erase money that also paid a
  // different, still-live invoice, and that money would simply vanish from
  // the customer's ledger.
  //
  // So: a payment belonging solely to this sale is deleted with it; one that
  // also touches another sale keeps its other allocations and loses only the
  // part that pointed here.
  const attached = await Payment.find({ allocations: { $elemMatch: { sale: sale._id } } });

  for (const payment of attached) {
    const belongsHereOnly = (payment.allocations || []).every(
      (a) => String(a.sale) === String(sale._id)
    );

    if (belongsHereOnly) {
      await LedgerEntry.deleteMany({ referenceType: 'payment', referenceId: payment._id });
      await Payment.findByIdAndDelete(payment._id);
      continue;
    }

    payment.allocations = payment.allocations.filter(
      (a) => String(a.sale) !== String(sale._id)
    );
    payment.notes = [payment.notes, `Allocation to ${sale.invoiceNumber} removed (sale deleted)`]
      .filter(Boolean)
      .join(' | ');
    await payment.save();
  }
  await LedgerEntry.deleteMany({ referenceType: 'sale', referenceId: sale._id });
  await StockMovement.deleteMany({ referenceId: sale._id });
  await Agreement.deleteMany({ sale: sale._id });
  await Sale.findByIdAndDelete(saleId);

  await recalculateCustomerTotals(customerId);
  return { invoiceNumber: sale.invoiceNumber };
};

// ============================================================================
// Purchases
// ============================================================================

/** Undo a purchase's effects: stock off the shelf, supplier balance corrected. */
const reversePurchaseEffects = async (purchase, user, reason) => {
  await adjustStock(purchase.items, -1, {
    reference: purchase.purchaseNumber,
    referenceId: purchase._id,
    userId: user?.id,
    reason: reason || `Purchase ${purchase.purchaseNumber} reversed`,
  });

  if (purchase.supplier) {
    const supplier = await Supplier.findById(purchase.supplier);
    if (supplier) {
      supplier.totalPurchases = Math.max(0, num(supplier.totalPurchases) - num(purchase.subtotal));
      supplier.totalPaid = Math.max(0, num(supplier.totalPaid) - num(purchase.paid));
      supplier.payable = Math.max(0, num(supplier.payable) - num(purchase.payable));
      await supplier.save();
    }
  }

  await LedgerEntry.deleteMany({ referenceType: 'purchase', referenceId: purchase._id });
};

/**
 * Cancel a purchase.
 *
 * Stock is taken back off the shelf, which can drive a product negative if some
 * of it has already been sold. That is reported rather than silently clamped:
 * a negative figure here means the goods left the shop on a sale that is still
 * live, and the person needs to know that before the count is trusted.
 */
export const cancelPurchase = async (purchaseId, user, reason = '') => {
  const purchase = await Purchase.findById(purchaseId);
  if (!purchase) throw new NotFoundError('Purchase');

  if (purchase.status === 'cancelled') {
    throw new BadRequestError('This purchase has already been cancelled.');
  }

  await reversePurchaseEffects(purchase, user, reason);

  purchase.status = 'cancelled';
  purchase.notes = [purchase.notes, reason && `Cancelled: ${reason}`].filter(Boolean).join(' | ');
  await purchase.save();

  return purchase;
};

/** Cancel a purchase and then remove it and its trail entirely. */
export const deletePurchase = async (purchaseId, user) => {
  const purchase = await Purchase.findById(purchaseId);
  if (!purchase) throw new NotFoundError('Purchase');

  if (purchase.status !== 'cancelled') {
    await reversePurchaseEffects(purchase, user, 'Purchase deleted');
  }

  await LedgerEntry.deleteMany({ referenceType: 'purchase', referenceId: purchase._id });
  await StockMovement.deleteMany({ referenceId: purchase._id });
  await Purchase.findByIdAndDelete(purchaseId);

  return { purchaseNumber: purchase.purchaseNumber };
};

// ============================================================================
// Returns
// ============================================================================

/** Undo a return: the goods go back out, and the sale stops reading returned. */
const reverseReturnEffects = async (returnRecord, user, reason) => {
  const note = reason || `Return ${returnRecord.returnNumber} reversed`;

  // The returned goods came back into stock; they go out again.
  await adjustStock(returnRecord.items, -1, {
    reference: returnRecord.returnNumber,
    referenceId: returnRecord._id,
    userId: user?.id,
    reason: note,
  });

  // An exchange moved a SECOND product as well: one unit of the replacement
  // went out to the customer. Reversing only the returned item would leave
  // that replacement permanently one short, with nothing on the stock card to
  // explain where it went.
  if (returnRecord.returnType === 'exchange') {
    const replacements = (returnRecord.items || [])
      .filter((item) => item.exchangeProduct)
      .map((item) => ({ product: item.exchangeProduct, quantity: 1 }));

    await adjustStock(replacements, +1, {
      reference: returnRecord.returnNumber,
      referenceId: returnRecord._id,
      userId: user?.id,
      reason: `${note} (exchange replacement returned to stock)`,
    });
  }

  if (returnRecord.sale) {
    const sale = await Sale.findById(returnRecord.sale);
    if (sale && sale.status === 'returned') {
      // Put the sale back to what its own schedule says it is.
      sale.status = num(sale.remainingBalance) === 0 ? 'completed' : 'ongoing';
      await sale.save();
    }
  }
};

/** Cancel a return. */
export const cancelReturn = async (returnId, user, reason = '') => {
  const returnRecord = await Return.findById(returnId);
  if (!returnRecord) throw new NotFoundError('Return');

  // Return.status is ['completed', 'reversed'] - there is no 'cancelled' on
  // this model, and saving one would fail validation.
  if (returnRecord.status === 'reversed') {
    throw new BadRequestError('This return has already been reversed.');
  }

  await reverseReturnEffects(returnRecord, user, reason);

  returnRecord.status = 'reversed';
  await returnRecord.save();

  if (returnRecord.customer) await recalculateCustomerTotals(returnRecord.customer);
  return returnRecord;
};

/** Cancel a return and then remove it entirely. */
export const deleteReturn = async (returnId, user) => {
  const returnRecord = await Return.findById(returnId);
  if (!returnRecord) throw new NotFoundError('Return');

  if (returnRecord.status !== 'reversed') {
    await reverseReturnEffects(returnRecord, user, 'Return deleted');
  }

  const customerId = returnRecord.customer;
  await StockMovement.deleteMany({ referenceId: returnRecord._id });
  await Return.findByIdAndDelete(returnId);

  if (customerId) await recalculateCustomerTotals(customerId);
  return { returnNumber: returnRecord.returnNumber };
};
