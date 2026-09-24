/**
 * ============================================
 * Payment Controller
 * ============================================
 */

import Payment from '../models/Payment.js';
import BusinessProfile from '../models/BusinessProfile.js';
import { containsText } from '../utils/regex.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError } from '../utils/AppError.js';
import { logAudit } from '../middleware/audit.js';
import { recordPaymentWithAllocation } from '../services/financial.service.js';
import { composeThankYou } from '../services/reminder.service.js';
import { reversePayment as reversePaymentRecord, deletePayment as deletePaymentRecord } from '../services/reversal.service.js';

export const getPayments = asyncHandler(async (req, res) => {
  const {
    page = 1, limit = 20, search = '', customerId, paymentMethod,
    sortBy = 'paymentDate', sortOrder = 'desc', startDate, endDate,
  } = req.query;

  const query = {};
  if (search) {
    query.$or = [
      { receiptNumber: containsText(search) },
      { customerName: containsText(search) },
      { customerPhone: containsText(search) },
      { referenceNumber: containsText(search) },
    ];
  }
  if (customerId) query.customer = customerId;
  if (paymentMethod) query.paymentMethod = paymentMethod;

  if (startDate || endDate) {
    query.paymentDate = {};
    if (startDate) query.paymentDate.$gte = new Date(startDate);
    if (endDate) query.paymentDate.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [payments, total] = await Promise.all([
    Payment.find(query).populate('customer', 'name mobile1 cnic')
      .sort(sort).skip(skip).limit(parseInt(limit)),
    Payment.countDocuments(query),
  ]);

  return sendSuccess(res, {
    payments,
    pagination: {
      page: parseInt(page), limit: parseInt(limit), total,
      totalPages: Math.ceil(total / parseInt(limit)),
      hasNext: skip + payments.length < total,
    },
  });
});

/**
 * GET /api/payments/:id
 * The payment plus the business profile, so the receipt view can render the
 * letterhead without a second request.
 */
export const getPayment = asyncHandler(async (req, res) => {
  const [payment, business] = await Promise.all([
    Payment.findById(req.params.id)
      .populate('customer')
      .populate('allocations.sale', 'invoiceNumber grandTotal remainingBalance installmentPlan'),
    BusinessProfile.getSingleton(),
  ]);

  if (!payment) throw new NotFoundError('Payment');
  return sendSuccess(res, { payment, business });
});

/**
 * POST /api/payments
 *
 * The response carries a ready-to-send thank-you message (and a WhatsApp deep
 * link) when that feature is enabled, so the cashier can confirm receipt to the
 * customer in one click straight from the success dialog.
 */
export const createPayment = asyncHandler(async (req, res) => {
  const result = await recordPaymentWithAllocation(req.body, req.user);

  await logAudit({
    req,
    module: 'payments',
    action: 'payment',
    recordId: result.payment._id.toString(),
    after: result.payment.toObject(),
    reason: `Received Rs. ${result.payment.paymentAmount.toLocaleString('en-PK')} from ${result.payment.customerName}`,
  });

  // A messaging failure must never fail a recorded payment - the money is in.
  let thankYou = null;
  try {
    thankYou = await composeThankYou(result.payment);
  } catch (error) {
    console.error('[PAYMENTS] Could not compose the thank-you message:', error.message);
  }

  // Money received beyond what was owed is reported, never silently absorbed
  const overpaymentNote =
    result.remainingPayment > 0
      ? ` Rs. ${result.remainingPayment.toLocaleString('en-PK')} was more than the outstanding balance - please refund it or hold it as credit.`
      : '';

  return sendSuccess(
    res,
    {
      payment: result.payment,
      totalAllocated: result.totalAllocated,
      remainingPayment: result.remainingPayment,
      thankYou,
    },
    201,
    `Payment recorded. Receipt ${result.payment.receiptNumber}.${overpaymentNote}`
  );
});

// ============================================================================
// Reversal
// ============================================================================

/**
 * Reverse a payment: it comes off the installments it paid, the receipt stays
 * in history marked reversed, and the customer's balance is recalculated.
 */
export const reversePayment = asyncHandler(async (req, res) => {
  const payment = await reversePaymentRecord(req.params.id, req.user, req.body?.reason || '');

  await logAudit({
    req, module: 'payments', action: 'reverse', recordId: req.params.id,
    after: payment.toObject(), reason: req.body?.reason || 'Payment reversed',
  });

  return sendSuccess(res, { payment }, 200, `Receipt ${payment.receiptNumber} reversed.`);
});

/** Permanently remove a payment and its trail. Admin only - see the route. */
export const removePayment = asyncHandler(async (req, res) => {
  const before = await Payment.findById(req.params.id);
  const { receiptNumber } = await deletePaymentRecord(req.params.id, req.user);

  await logAudit({
    req, module: 'payments', action: 'delete', recordId: req.params.id,
    before: before?.toObject(), reason: req.body?.reason || 'Payment deleted by admin',
  });

  return sendSuccess(res, null, 200, `Receipt ${receiptNumber} deleted and fully reversed.`);
});
