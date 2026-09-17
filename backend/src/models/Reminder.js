/**
 * ============================================
 * Reminder Model
 * ============================================
 * An audit trail of every payment reminder generated for a customer.
 *
 * Why log reminders
 * -----------------
 * Two reasons, both practical:
 *   1. Staff must be able to answer "did anyone actually chase this account?"
 *      - the log answers it with a timestamp and the user who sent it.
 *   2. It prevents spamming. `hasRecentReminder()` lets the bulk-send flow skip
 *      anyone already contacted inside the cooldown window, so a customer is
 *      not messaged three times in one morning by three different staff.
 *
 * Delivery
 * --------
 * The message body is always generated and stored here. `channel` records how
 * it left the building: `whatsapp` opens a wa.me deep link (no gateway needed,
 * which is how this shop actually works), `sms` is reserved for a future
 * provider, `manual` means it was read out over the phone.
 */

import mongoose from 'mongoose';
import { REMINDER_CHANNELS } from '../constants/index.js';

const reminderSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    customerName: { type: String, required: true },
    customerPhone: { type: String, default: '' },

    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null, index: true },
    invoiceNumber: { type: String, default: '' },
    installmentNumber: { type: Number, default: null },

    /** Which template produced the body. Mirrors REMINDER_TEMPLATES keys. */
    reminderType: {
      type: String,
      enum: ['upcoming', 'due_today', 'overdue', 'thank_you'],
      required: true,
      index: true,
    },

    channel: { type: String, enum: REMINDER_CHANNELS, default: 'whatsapp' },

    /** The exact text that was generated, after token substitution. */
    message: { type: String, required: true },

    amount: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    dueDate: { type: Date, default: null },
    daysOverdue: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ['generated', 'sent', 'failed'],
      default: 'generated',
      index: true,
    },
    failureReason: { type: String, default: '' },

    sentAt: { type: Date, default: Date.now, index: true },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    sentByName: { type: String, default: '' },
  },
  { timestamps: true }
);

reminderSchema.index({ customer: 1, sentAt: -1 });
reminderSchema.index({ sale: 1, installmentNumber: 1, sentAt: -1 });

/**
 * Has this exact installment already been chased inside the cooldown window?
 * Used to de-duplicate bulk sends.
 *
 * @param {object}  params
 * @param {string}  params.saleId
 * @param {number}  params.installmentNumber
 * @param {number} [params.withinHours=20] Cooldown window.
 * @returns {Promise<boolean>}
 */
reminderSchema.statics.hasRecentReminder = async function ({
  saleId,
  installmentNumber,
  withinHours = 20,
}) {
  if (!saleId) return false;
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000);
  const existing = await this.findOne({
    sale: saleId,
    installmentNumber: installmentNumber ?? null,
    sentAt: { $gte: since },
    status: { $ne: 'failed' },
  }).select('_id');
  return Boolean(existing);
};

const Reminder = mongoose.model('Reminder', reminderSchema);
export default Reminder;
