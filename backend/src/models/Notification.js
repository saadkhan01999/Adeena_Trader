/**
 * ============================================
 * Notification Model
 * ============================================
 * System-raised alerts: due and overdue installments, low stock, supplier
 * payables, investor payouts and Zakat reminders.
 *
 * Notifications are derived from live data by notification.service.js rather
 * than written by hand. Because that sweep runs on a timer, every alert carries
 * a deterministic `dedupeKey` and a unique index enforces one row per real
 * condition per day - otherwise the same "low stock" warning would be inserted
 * dozens of times a day and the unread badge would be meaningless.
 */

import mongoose from 'mongoose';
import { NOTIFICATION_TYPES } from '../constants/index.js';

const notificationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: NOTIFICATION_TYPES, required: true, index: true },

    title: { type: String, required: true },
    message: { type: String, required: true },

    severity: {
      type: String,
      enum: ['info', 'warning', 'error', 'success'],
      default: 'info',
      index: true,
    },

    /**
     * Identity of the real-world condition this alert represents, e.g.
     * `low_stock:<productId>:2026-09-16`. The unique index on this field is
     * what makes the sweep idempotent.
     */
    dedupeKey: { type: String, required: true, unique: true, index: true },

    // ---- Deep link back to the record --------------------------------
    referenceType: { type: String, default: '' }, // sale | product | customer | supplier | investor | zakat
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    /** Front-end route the "View" button navigates to. */
    actionPath: { type: String, default: '' },

    // ---- State -------------------------------------------------------
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false, index: true },

    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// Drives the notification panel query: newest unread first.
notificationSchema.index({ isDeleted: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
