/**
 * ============================================
 * Reminder Controller
 * ============================================
 * Endpoints behind the "Send Reminder" actions on the Installments, Customers
 * and Payments screens.
 *
 * Every message body is composed server-side from the admin's template, so the
 * wording is consistent no matter which staff member presses the button, and
 * every generated message is logged for accountability.
 */

import Reminder from '../models/Reminder.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { BadRequestError } from '../utils/AppError.js';
import {
  generateReminders,
  generateReminderForInstallment,
  generateCustomerSummaryReminder,
  logRemindersSent,
} from '../services/reminder.service.js';

/**
 * GET /api/reminders/generate
 * Preview the reminders that would be sent, without logging anything.
 *
 * Query: scope=overdue|due_today|upcoming|all, customerId, includeRecent=true
 *
 * Preview and send are separate so staff can review the list - and the exact
 * wording - before anything reaches a customer.
 */
export const previewReminders = asyncHandler(async (req, res) => {
  const { scope = 'overdue', customerId, includeRecent } = req.query;

  const reminders = await generateReminders({
    scope,
    customerId: customerId || null,
    skipRecent: includeRecent !== 'true',
  });

  return sendSuccess(res, {
    reminders,
    count: reminders.length,
    totalAmount: reminders.reduce((sum, r) => sum + r.amount, 0),
    scope,
  });
});

/**
 * GET /api/reminders/installment/:saleId/:installmentNumber
 * The message for one specific installment row.
 */
export const getInstallmentReminder = asyncHandler(async (req, res) => {
  const { saleId, installmentNumber } = req.params;
  const reminder = await generateReminderForInstallment(saleId, installmentNumber);
  return sendSuccess(res, { reminder });
});

/**
 * GET /api/reminders/customer/:customerId
 * One consolidated message covering all of a customer's arrears - more
 * respectful than firing a separate message per overdue installment.
 */
export const getCustomerReminder = asyncHandler(async (req, res) => {
  const reminder = await generateCustomerSummaryReminder(req.params.customerId);

  if (!reminder) {
    return sendSuccess(res, { reminder: null }, 200, 'This customer has no overdue installments.');
  }
  return sendSuccess(res, { reminder });
});

/**
 * POST /api/reminders/log
 * Record that reminders were actually sent.
 *
 * Called by the client after the WhatsApp windows have been opened. Logging is
 * a separate step from generation on purpose: a previewed message that the
 * staff member decided not to send must not appear in the audit trail as sent.
 *
 * Body: { reminders: [...], channel }
 */
export const logReminders = asyncHandler(async (req, res) => {
  const { reminders, channel = 'whatsapp' } = req.body;

  if (!Array.isArray(reminders) || reminders.length === 0) {
    throw new BadRequestError('Provide the reminders that were sent.');
  }

  const logged = await logRemindersSent(reminders, req.user, channel);
  return sendSuccess(res, { logged }, 201, `${logged} reminder(s) recorded.`);
});

/**
 * GET /api/reminders
 * The reminder history, filterable by customer, type and date.
 */
export const getReminderHistory = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    customerId,
    reminderType,
    startDate,
    endDate,
  } = req.query;

  const query = {};
  if (customerId) query.customer = customerId;
  if (reminderType) query.reminderType = reminderType;
  if (startDate || endDate) {
    query.sentAt = {};
    if (startDate) query.sentAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.sentAt.$lte = end;
    }
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [reminders, total, stats] = await Promise.all([
    Reminder.find(query)
      .populate('customer', 'name mobile1')
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Reminder.countDocuments(query),
    Reminder.aggregate([
      { $match: query },
      { $group: { _id: '$reminderType', count: { $sum: 1 } } },
    ]),
  ]);

  return sendSuccess(res, {
    reminders,
    stats: stats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});
