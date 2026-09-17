/**
 * ============================================
 * Reminder Service
 * ============================================
 * Builds and logs the payment-reminder messages sent to customers.
 *
 * How delivery works
 * ------------------
 * This shop chases payments over WhatsApp, which is what customers in Mardan
 * actually read. The service composes the message and returns a `wa.me` deep
 * link; the browser opens WhatsApp with the text pre-filled and the staff
 * member presses send. That keeps the system honest - it never claims a message
 * was delivered when no gateway exists - while still removing all the typing.
 *
 * Every generated message is written to the Reminder collection, so the shop
 * can prove who chased which account and when, and so the same installment is
 * not chased three times in one morning by three different people.
 */

import Reminder from '../models/Reminder.js';
import Sale from '../models/Sale.js';
import Customer from '../models/Customer.js';
import Settings from '../models/Settings.js';
import BusinessProfile from '../models/BusinessProfile.js';
import { REMINDER_TEMPLATES } from '../constants/index.js';
import { parseNumber, daysBetween, formatPKR } from '../utils/financialEngine.js';
import { BadRequestError, NotFoundError } from '../utils/AppError.js';

// ============================================================================
// Message composition
// ============================================================================

/** Format a date the way Pakistani customers read it: 16-Sep-2026. */
const formatDueDate = (date) =>
  new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * Replace every {token} in a template.
 * Unknown tokens are stripped rather than left as literal braces, so a typo in
 * a custom template degrades to a missing word instead of showing `{blance}`
 * to a customer.
 */
const renderTemplate = (template, tokens) =>
  String(template).replace(/\{(\w+)\}/g, (_, key) =>
    tokens[key] !== undefined && tokens[key] !== null ? String(tokens[key]) : ''
  ).replace(/\s{2,}/g, ' ').trim();

/**
 * Pick the template body for a reminder type.
 * An admin override in Settings wins; a blank override falls back to the
 * built-in default, which is what makes "clear the box to reset" work.
 */
const resolveTemplate = (settings, reminderType) => {
  const overrides = {
    upcoming: settings.whatsapp.upcomingTemplate,
    due_today: settings.whatsapp.dueTodayTemplate,
    overdue: settings.whatsapp.overdueTemplate,
    thank_you: settings.whatsapp.thankYouTemplate,
  };
  return overrides[reminderType]?.trim() || REMINDER_TEMPLATES[reminderType];
};

/**
 * Normalise a Pakistani number into WhatsApp's international format.
 * "0310-009 1875" -> "923100091875"
 */
export const normalisePhone = (phone) => {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `92${digits.slice(1)}`;
  else if (digits.startsWith('92')) { /* already correct */ }
  else if (digits.length === 10) digits = `92${digits}`;
  return digits;
};

/** Build the click-to-chat URL that opens WhatsApp with the text ready. */
export const buildWhatsAppUrl = (phone, message) => {
  const number = normalisePhone(phone);
  if (!number) return '';
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
};

/**
 * Compose one reminder message.
 *
 * @param {object} params
 * @param {object} params.sale
 * @param {object} params.installment
 * @param {object} params.business
 * @param {object} params.settings
 * @returns {{reminderType:string, message:string, whatsappUrl:string, daysOverdue:number, ...}}
 */
export const composeReminder = ({ sale, installment, business, settings }) => {
  const daysUntilDue = daysBetween(new Date(), installment.dueDate);
  const daysOverdue = daysUntilDue < 0 ? Math.abs(daysUntilDue) : 0;

  const reminderType = daysOverdue > 0 ? 'overdue' : daysUntilDue === 0 ? 'due_today' : 'upcoming';

  const tokens = {
    customerName: sale.customerName,
    invoiceNumber: sale.invoiceNumber,
    installmentNumber: installment.number,
    amount: formatPKR(installment.remaining),
    balance: formatPKR(sale.remainingBalance),
    dueDate: formatDueDate(installment.dueDate),
    daysOverdue,
    businessName: business.name,
    businessPhone: business.phone,
    businessAddress: business.address,
  };

  const message = renderTemplate(resolveTemplate(settings, reminderType), tokens);
  const phone = sale.customerPhone || '';

  return {
    reminderType,
    message,
    phone,
    whatsappUrl: buildWhatsAppUrl(phone, message),
    amount: parseNumber(installment.remaining),
    balance: parseNumber(sale.remainingBalance),
    dueDate: installment.dueDate,
    daysOverdue,
    installmentNumber: installment.number,
    invoiceNumber: sale.invoiceNumber,
  };
};

/**
 * Compose the thank-you message sent after a payment is recorded.
 * Returns null when the feature is switched off in Settings.
 */
export const composeThankYou = async (payment) => {
  const [settings, business] = await Promise.all([
    Settings.getSingleton(),
    BusinessProfile.getSingleton(),
  ]);

  if (!settings.payment.sendThankYouMessage || !settings.whatsapp.enabled) return null;

  const message = renderTemplate(resolveTemplate(settings, 'thank_you'), {
    customerName: payment.customerName,
    amount: formatPKR(payment.paymentAmount),
    receiptNumber: payment.receiptNumber,
    balance: formatPKR(payment.remainingBalance),
    businessName: business.name,
    businessPhone: business.phone,
  });

  return {
    reminderType: 'thank_you',
    message,
    phone: payment.customerPhone,
    whatsappUrl: buildWhatsAppUrl(payment.customerPhone, message),
  };
};

// ============================================================================
// Generation
// ============================================================================

/**
 * Build reminders for every installment that needs chasing.
 *
 * @param {object} [options]
 * @param {'all'|'overdue'|'due_today'|'upcoming'} [options.scope='overdue']
 * @param {string} [options.customerId]  Restrict to one customer.
 * @param {boolean} [options.skipRecent=true] Honour the cooldown window.
 * @returns {Promise<Array<object>>} One entry per installment, ready to send.
 */
export const generateReminders = async ({
  scope = 'overdue',
  customerId = null,
  skipRecent = true,
} = {}) => {
  const [settings, business] = await Promise.all([
    Settings.getSingleton(),
    BusinessProfile.getSingleton(),
  ]);

  const query = {
    saleType: 'installment',
    status: { $in: ['ongoing', 'overdue'] },
  };
  if (customerId) query.customer = customerId;

  const sales = await Sale.find(query).select(
    'invoiceNumber customer customerName customerPhone installments remainingBalance'
  );

  const horizon = settings.notification.upcomingDueDays;
  const cooldown = settings.whatsapp.reminderCooldownHours;
  const reminders = [];

  for (const sale of sales) {
    if (!sale.customerPhone) continue; // Nothing to send to

    for (const inst of sale.installments) {
      if (inst.status === 'paid' || inst.remaining <= 0) continue;

      const daysUntilDue = daysBetween(new Date(), inst.dueDate);
      const isOverdue = daysUntilDue < 0;
      const isDueToday = daysUntilDue === 0;
      const isUpcoming = daysUntilDue > 0 && daysUntilDue <= horizon;

      const matchesScope =
        (scope === 'all' && (isOverdue || isDueToday || isUpcoming)) ||
        (scope === 'overdue' && isOverdue) ||
        (scope === 'due_today' && isDueToday) ||
        (scope === 'upcoming' && isUpcoming);

      if (!matchesScope) continue;

      // Do not chase the same installment twice inside the cooldown window
      if (skipRecent) {
        const recentlyChased = await Reminder.hasRecentReminder({
          saleId: sale._id,
          installmentNumber: inst.number,
          withinHours: cooldown,
        });
        if (recentlyChased) continue;
      }

      const composed = composeReminder({ sale, installment: inst, business, settings });

      reminders.push({
        ...composed,
        saleId: sale._id,
        customerId: sale.customer,
        customerName: sale.customerName,
      });
    }
  }

  // Most urgent first, so a partial send still covers the worst accounts
  reminders.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return reminders;
};

/**
 * Persist the fact that reminders were sent.
 *
 * @param {Array<object>} reminders Entries produced by {@link generateReminders}.
 * @param {object} user             `req.user`.
 * @param {string} [channel='whatsapp']
 * @returns {Promise<number>} How many were logged.
 */
export const logRemindersSent = async (reminders, user, channel = 'whatsapp') => {
  if (!Array.isArray(reminders) || reminders.length === 0) return 0;

  const docs = reminders.map((r) => ({
    customer: r.customerId,
    customerName: r.customerName,
    customerPhone: r.phone,
    sale: r.saleId,
    invoiceNumber: r.invoiceNumber,
    installmentNumber: r.installmentNumber,
    reminderType: r.reminderType,
    channel,
    message: r.message,
    amount: r.amount,
    balance: r.balance,
    dueDate: r.dueDate,
    daysOverdue: r.daysOverdue,
    status: 'sent',
    sentAt: new Date(),
    sentBy: user?.id || null,
    sentByName: user?.name || 'System',
  }));

  const inserted = await Reminder.insertMany(docs, { ordered: false });
  return inserted.length;
};

/**
 * Compose a reminder for one specific installment, identified by invoice.
 * Used by the "Remind" button on a single row.
 */
export const generateReminderForInstallment = async (saleId, installmentNumber) => {
  const [settings, business] = await Promise.all([
    Settings.getSingleton(),
    BusinessProfile.getSingleton(),
  ]);

  const sale = await Sale.findById(saleId);
  if (!sale) throw new NotFoundError('Sale');

  const installment = sale.installments.find((i) => i.number === Number(installmentNumber));
  if (!installment) throw new BadRequestError(`Installment #${installmentNumber} does not exist on this invoice.`);

  const composed = composeReminder({ sale, installment, business, settings });

  return {
    ...composed,
    saleId: sale._id,
    customerId: sale.customer,
    customerName: sale.customerName,
  };
};

/**
 * Compose a single account-level summary for a customer with several arrears.
 * More respectful than firing four separate messages at the same person.
 */
export const generateCustomerSummaryReminder = async (customerId) => {
  const [settings, business, customer] = await Promise.all([
    Settings.getSingleton(),
    BusinessProfile.getSingleton(),
    Customer.findById(customerId),
  ]);

  if (!customer) throw new NotFoundError('Customer');

  const sales = await Sale.find({
    customer: customerId,
    saleType: 'installment',
    status: { $in: ['ongoing', 'overdue'] },
  });

  const overdue = [];
  for (const sale of sales) {
    for (const inst of sale.installments) {
      if (inst.status !== 'paid' && inst.remaining > 0 && daysBetween(new Date(), inst.dueDate) < 0) {
        overdue.push({ sale, inst });
      }
    }
  }

  if (overdue.length === 0) return null;

  const totalOverdue = overdue.reduce((s, o) => s + parseNumber(o.inst.remaining), 0);
  const totalBalance = sales.reduce((s, sale) => s + parseNumber(sale.remainingBalance), 0);
  const oldest = overdue.sort((a, b) => new Date(a.inst.dueDate) - new Date(b.inst.dueDate))[0];

  const message = renderTemplate(resolveTemplate(settings, 'overdue'), {
    customerName: customer.name,
    invoiceNumber: oldest.sale.invoiceNumber,
    installmentNumber: oldest.inst.number,
    amount: formatPKR(totalOverdue),
    balance: formatPKR(totalBalance),
    dueDate: formatDueDate(oldest.inst.dueDate),
    daysOverdue: Math.abs(daysBetween(new Date(), oldest.inst.dueDate)),
    businessName: business.name,
    businessPhone: business.phone,
  });

  return {
    reminderType: 'overdue',
    message,
    phone: customer.mobile1,
    whatsappUrl: buildWhatsAppUrl(customer.mobile1, message),
    amount: totalOverdue,
    balance: totalBalance,
    dueDate: oldest.inst.dueDate,
    daysOverdue: Math.abs(daysBetween(new Date(), oldest.inst.dueDate)),
    installmentNumber: oldest.inst.number,
    invoiceNumber: oldest.sale.invoiceNumber,
    saleId: oldest.sale._id,
    customerId: customer._id,
    customerName: customer.name,
  };
};
