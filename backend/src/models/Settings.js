/**
 * ============================================
 * Settings Model
 * ============================================
 * Single-document collection holding every app-wide preference.
 *
 * Grouped by concern so the Settings screen can map one section to one object,
 * and so a partial update (`{ installment: {...} }`) never disturbs unrelated
 * settings. `Settings.getSingleton()` guarantees exactly one document exists.
 */

import mongoose from 'mongoose';
import { PAYMENT_METHODS } from '../constants/index.js';

const settingsSchema = new mongoose.Schema(
  {
    // ================================================================
    // Installments
    // ================================================================
    installment: {
      /** Only 6- and 12-month plans are offered by this business. */
      defaultPlan: { type: Number, enum: [6, 12], default: 6 },
      /** Days after the due date before an installment is treated as late. */
      gracePeriodDays: { type: Number, default: 0, min: 0, max: 30 },
      roundingRule: { type: String, enum: ['round', 'floor', 'ceil'], default: 'round' },
      lateStatusBehavior: { type: String, enum: ['strict', 'graceful'], default: 'strict' },
      /** Minimum advance as a % of sale value. 0 = no minimum. */
      minAdvancePercent: { type: Number, default: 0, min: 0, max: 100 },
      /** Require a guarantor before an installment sale can be saved. */
      requireGuarantor: { type: Boolean, default: true },
      /** Auto-issue an installment agreement when the sale is created. */
      autoGenerateAgreement: { type: Boolean, default: true },
    },

    // ================================================================
    // Payments & receipts
    // ================================================================
    payment: {
      acceptedMethods: {
        type: [{ type: String, enum: PAYMENT_METHODS }],
        default: PAYMENT_METHODS,
      },
      receiptPrefix: { type: String, default: 'RCP' },
      receiptCounter: { type: Number, default: 1000 },
      allocationRule: {
        type: String,
        enum: ['oldest_first', 'admin_selected'],
        default: 'oldest_first',
      },
      /** Allow a payment smaller than the installment amount. */
      allowPartialPayment: { type: Boolean, default: true },
      /** Auto-send a thank-you message after a payment is recorded. */
      sendThankYouMessage: { type: Boolean, default: true },
    },

    // ================================================================
    // Products & stock
    // ================================================================
    product: {
      skuPrefix: { type: String, default: 'PRD' },
      lowStockThreshold: { type: Number, default: 5, min: 0 },
      defaultWarrantyMonths: { type: Number, default: 0, min: 0 },
      requireSerial: { type: Boolean, default: false },
      /** Block a sale that would take stock below zero. */
      preventNegativeStock: { type: Boolean, default: true },
      /** Default markup applied when suggesting an installment price. */
      defaultInstallmentMarkupPercent: { type: Number, default: 20, min: 0, max: 200 },
    },

    // ================================================================
    // Display
    // ----------------------------------------------------------------
    // Shop-wide, not per user. A counter machine is shared: the owner, a
    // manager and two salesmen all sign in to the same screen through the
    // day, and a preference stored per account would mean the Urdu a new
    // salesman needs disappears the moment the owner signs in to check a
    // figure. The admin sets it once for the shop.
    // ================================================================
    display: {
      /**
       * Urdu across the app - menus, headings, form labels, documents.
       *
       * OFF until the admin turns it on. This replaced `urduLabels`, which
       * defaulted to on; a new field (rather than a new default on the old
       * one) is what actually turns Urdu off for a shop that already has a
       * settings document, since Mongoose stored the old default in it.
       */
      urdu: { type: Boolean, default: false },
      /** @deprecated Read `urdu`. Kept so old documents still validate. */
      urduLabels: { type: Boolean, default: false },
      /** The "How to use" panel at the top of each screen. */
      screenGuides: { type: Boolean, default: true },
      /**
       * Colour theme for the whole app. Shop-wide for the same reason as Urdu:
       * the counter screen is shared.
       */
      theme: {
        type: String,
        enum: ['gold', 'blue', 'green', 'red', 'purple'],
        default: 'gold',
      },
    },

    // ================================================================
    // Printing
    // ----------------------------------------------------------------
    // Paper per document type, because a shop commonly has both: an A4
    // laser for agreements and a thermal roll printer at the counter for
    // receipts.
    // ================================================================
    print: {
      invoiceSize: {
        type: String, enum: ['a4', 'a5', 'letter', 'legal', 'thermal80', 'thermal58'], default: 'a4',
      },
      receiptSize: {
        type: String, enum: ['a4', 'a5', 'letter', 'legal', 'thermal80', 'thermal58'], default: 'a4',
      },
      agreementSize: { type: String, enum: ['a4', 'letter', 'legal'], default: 'a4' },
      reportSize: { type: String, enum: ['a4', 'letter', 'legal'], default: 'a4' },
      orientation: { type: String, enum: ['portrait', 'landscape'], default: 'portrait' },
      /** Print colour bands and the gold rules, or plain black on white to save ink. */
      colorMode: { type: String, enum: ['color', 'grayscale'], default: 'color' },
      showLogo: { type: Boolean, default: true },
      showWatermark: { type: Boolean, default: true },
      /** Printed on every invoice and receipt, under the totals. */
      footerNote: { type: String, default: 'Thank you for your business!' },
      copies: { type: Number, default: 1, min: 1, max: 5 },
    },

    // ================================================================
    // Ownership split (owner vs partner)
    // ================================================================
    ownership: {
      defaultPartnerShare: { type: Number, default: 40, min: 0, max: 100 },
      /** Split profit by the same ratio as capital, or by a fixed agreement. */
      profitSplitMode: { type: String, enum: ['by_share', 'fixed'], default: 'by_share' },
    },

    // ================================================================
    // Investors (never part of Zakat - see Zakat model)
    // ================================================================
    investor: {
      defaultProfitPercentage: { type: Number, default: 10, min: 0, max: 100 },
      defaultCalcMethod: {
        type: String,
        enum: ['fixed_percent', 'profit_sharing', 'monthly_fixed'],
        default: 'fixed_percent',
      },
      payoutFrequency: {
        type: String,
        enum: ['monthly', 'quarterly', 'half_yearly', 'annually', 'on_demand'],
        default: 'monthly',
      },
      autoGenerateAgreement: { type: Boolean, default: true },
    },

    // ================================================================
    // Appearance
    // ================================================================
    appearance: {
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'light' },
      primaryColor: { type: String, default: '#0b192c' },
      accentColor: { type: String, default: '#f59e0b' },
      sidebarCollapsed: { type: Boolean, default: false },
      density: { type: String, enum: ['comfortable', 'compact'], default: 'comfortable' },
    },

    // ================================================================
    // Security
    // ================================================================
    security: {
      sessionTimeoutMinutes: { type: Number, default: 30, min: 5, max: 1440 },
      requirePasswordChange: { type: Boolean, default: false },
      minPasswordLength: { type: Number, default: 8, min: 6, max: 64 },
      /** Require a mix of letters, digits and symbols for new passwords. */
      requireStrongPassword: { type: Boolean, default: true },
      /** Failed attempts before the account is temporarily locked. */
      maxLoginAttempts: { type: Number, default: 8, min: 3, max: 20 },
      lockoutMinutes: { type: Number, default: 15, min: 1, max: 1440 },
      /** Write an audit entry for every create/update/delete. */
      auditAllChanges: { type: Boolean, default: true },
    },

    // ================================================================
    // Notifications
    // ================================================================
    notification: {
      enabled: { type: Boolean, default: true },
      /** How many days ahead an installment starts appearing as "upcoming". */
      upcomingDueDays: { type: Number, default: 3, min: 1, max: 30 },
      lowStockAlerts: { type: Boolean, default: true },
      overdueAlerts: { type: Boolean, default: true },
      supplierPayableAlerts: { type: Boolean, default: true },
      investorPayoutAlerts: { type: Boolean, default: true },
      zakatReminder: { type: Boolean, default: true },
      /** Play a short chime when a new notification arrives. */
      soundEnabled: { type: Boolean, default: false },
    },

    // ================================================================
    // Customer messaging (WhatsApp / SMS reminders)
    // ================================================================
    whatsapp: {
      enabled: { type: Boolean, default: true },
      businessNumber: { type: String, default: '' },
      /**
       * Message bodies. Empty means "use the built-in default" from
       * constants/REMINDER_TEMPLATES, so an admin can reset by clearing.
       */
      upcomingTemplate: { type: String, default: '' },
      dueTodayTemplate: { type: String, default: '' },
      overdueTemplate: { type: String, default: '' },
      thankYouTemplate: { type: String, default: '' },
      /** Hours to wait before the same installment can be chased again. */
      reminderCooldownHours: { type: Number, default: 20, min: 1, max: 168 },
    },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

/**
 * Fetch the one settings document, creating it with defaults on first call.
 * Every caller goes through this, so the "is there a document yet?" branch
 * lives in exactly one place.
 */
settingsSchema.statics.getSingleton = async function () {
  let settings = await this.findOne();
  if (!settings) settings = await this.create({});
  return settings;
};

const Settings = mongoose.model('Settings', settingsSchema);
export default Settings;
