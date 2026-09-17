/**
 * ============================================
 * Zakat Settings & Calculation Models
 * ============================================
 *
 * CRITICAL BUSINESS RULE
 * ----------------------
 * Zakat applies ONLY to the Owner and to Partners. Investors are NEVER
 * included: their capital is a liability of the business towards them, not an
 * asset of the owner, and the profit share they receive is theirs to purify.
 * Every query in the Zakat controller filters on this basis.
 *
 * Shariah reference used by the calculator
 * ----------------------------------------
 *   Rate   : 2.5% (1/40) of net zakatable assets.
 *   Nisab  : 87.48 g gold  OR  612.36 g silver. Where a person holds a mixture
 *            of assets - which a trading business always does - the lower
 *            SILVER nisab applies, so `silver` is the default basis.
 *   Hawl   : one lunar year (~354 days) above nisab before Zakat falls due.
 *   Assets : trade stock at current market value + cash + bank + recoverable
 *            receivables. Fixed assets used to run the business (shop fittings,
 *            delivery bike, counters) are exempt.
 *   Debts  : immediate liabilities due within the coming lunar month are
 *            deductible - primarily supplier payables.
 */

import mongoose from 'mongoose';
import { ZAKAT_DEFAULT_RATE, NISAB_WEIGHTS, NISAB_BASIS } from '../constants/index.js';

// ============================================================================
// Zakat Settings (single document)
// ============================================================================
const zakatSettingsSchema = new mongoose.Schema(
  {
    /** 0.025 = 2.5%. Configurable but should almost never change. */
    rate: { type: Number, default: ZAKAT_DEFAULT_RATE, min: 0, max: 1 },

    /**
     * Which threshold to apply.
     *   silver -> nisab = silverRatePerGram * 612.36   (default, and the
     *             cautious choice for a mixed-asset business)
     *   gold   -> nisab = goldRatePerGram   * 87.48
     *   manual -> admin types the rupee figure directly
     */
    nisabBasis: {
      type: String,
      enum: Object.values(NISAB_BASIS),
      default: NISAB_BASIS.SILVER,
    },

    /** Local market rates in PKR per gram, entered by the admin. */
    goldRatePerGram: { type: Number, default: 0, min: 0 },
    silverRatePerGram: { type: Number, default: 0, min: 0 },

    /** Resolved threshold in PKR. Recomputed on save unless basis is manual. */
    nisab: { type: Number, default: 0, min: 0 },

    /** Free-text note about where the rate came from and when. */
    nisabReference: { type: String, default: '' },
    rateLastUpdated: { type: Date, default: null },

    /** Start of the current hawl - used to show "Zakat due on …". */
    hawlStartDate: { type: Date, default: null },
    effectiveDate: { type: Date, default: Date.now },
    calculationNotes: { type: String, default: '' },

    /** Which asset classes count towards the zakatable total. */
    eligibleAssets: {
      stock: { type: Boolean, default: true },
      receivables: { type: Boolean, default: true },
      cash: { type: Boolean, default: true },
      bankBalance: { type: Boolean, default: true },
      otherAssets: { type: Boolean, default: false },
    },

    /** Which liabilities may be deducted. */
    eligibleDeductions: {
      supplierPayables: { type: Boolean, default: true },
      otherLiabilities: { type: Boolean, default: false },
    },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

/**
 * Derive the rupee nisab from the chosen metal basis before every save, so the
 * stored `nisab` can never drift out of step with the entered metal rate.
 * A `manual` basis is left untouched - that is the point of choosing it.
 */
zakatSettingsSchema.pre('save', function (next) {
  if (this.nisabBasis === NISAB_BASIS.GOLD) {
    this.nisab = Math.round(this.goldRatePerGram * NISAB_WEIGHTS.GOLD_GRAMS);
  } else if (this.nisabBasis === NISAB_BASIS.SILVER) {
    this.nisab = Math.round(this.silverRatePerGram * NISAB_WEIGHTS.SILVER_GRAMS);
  }
  next();
});

/** Fetch the one settings document, creating it with defaults on first call. */
zakatSettingsSchema.statics.getSingleton = async function () {
  let settings = await this.findOne();
  if (!settings) settings = await this.create({});
  return settings;
};

const ZakatSettings = mongoose.model('ZakatSettings', zakatSettingsSchema);

// ============================================================================
// Zakat Calculation Record
// ============================================================================
const zakatCalculationSchema = new mongoose.Schema(
  {
    /** Only 'owner' or 'partner'. Investors are excluded by design. */
    ownershipType: {
      type: String,
      enum: ['owner', 'partner'],
      required: true,
      index: true,
    },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', default: null },
    partnerName: { type: String, default: '' },

    // ---- Asset breakdown (snapshot at calculation time) --------------
    eligibleStock: { type: Number, default: 0 },
    receivables: { type: Number, default: 0 },
    cash: { type: Number, default: 0 },
    bankBalance: { type: Number, default: 0 },
    otherAssets: { type: Number, default: 0 },
    grossAssets: { type: Number, default: 0 },

    // ---- Liabilities -------------------------------------------------
    supplierPayables: { type: Number, default: 0 },
    otherLiabilities: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },

    netAssets: { type: Number, default: 0 },

    // ---- Threshold & result ------------------------------------------
    nisab: { type: Number, default: 0 },
    nisabBasis: { type: String, default: NISAB_BASIS.SILVER },
    rate: { type: Number, default: ZAKAT_DEFAULT_RATE },
    isAboveNisab: { type: Boolean, default: false },
    zakatAmount: { type: Number, default: 0 },

    // ---- Payment tracking --------------------------------------------
    amountPaid: { type: Number, default: 0, min: 0 },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'partially_paid', 'paid'],
      default: 'unpaid',
      index: true,
    },
    paidAt: { type: Date, default: null },
    paidTo: { type: String, default: '' },

    // ---- Metadata ----------------------------------------------------
    zakatYear: { type: String, default: '' }, // e.g. "1447 AH" or "2026"
    calculationDate: { type: Date, default: Date.now, index: true },
    /** true when figures came from live business data rather than manual entry. */
    isAutoCalculated: { type: Boolean, default: true },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdByName: { type: String, default: '' },
  },
  { timestamps: true }
);

zakatCalculationSchema.index({ ownershipType: 1, calculationDate: -1 });
zakatCalculationSchema.index({ zakatYear: 1 });

/** Keep the payment status consistent with the amount recorded. */
zakatCalculationSchema.pre('save', function (next) {
  if (this.amountPaid <= 0) this.paymentStatus = 'unpaid';
  else if (this.amountPaid >= this.zakatAmount) this.paymentStatus = 'paid';
  else this.paymentStatus = 'partially_paid';
  next();
});

const ZakatCalculation = mongoose.model('ZakatCalculation', zakatCalculationSchema);

export { ZakatSettings, ZakatCalculation };
