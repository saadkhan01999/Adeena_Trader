/**
 * ============================================
 * Business Profile Model
 * ============================================
 * Single-document collection describing the business itself: identity,
 * contact details, and the numbering series used for invoices, receipts and
 * agreements. Everything printed on a document reads from here.
 */

import mongoose from 'mongoose';
import { BUSINESS_DEFAULTS } from '../constants/index.js';

const businessProfileSchema = new mongoose.Schema(
  {
    // ---- Identity ----------------------------------------------------
    name: { type: String, required: true, default: BUSINESS_DEFAULTS.name, trim: true },
    tagline: { type: String, default: BUSINESS_DEFAULTS.tagline },
    owner: { type: String, default: BUSINESS_DEFAULTS.owner, trim: true },
    ownerCnic: { type: String, default: '' },

    // ---- Contact -----------------------------------------------------
    phone: { type: String, default: BUSINESS_DEFAULTS.phone },
    alternatePhone: { type: String, default: BUSINESS_DEFAULTS.alternatePhone },
    email: { type: String, default: '', lowercase: true, trim: true },
    website: { type: String, default: '' },
    address: { type: String, default: BUSINESS_DEFAULTS.address },
    city: { type: String, default: 'Mardan' },
    country: { type: String, default: 'Pakistan' },

    // ---- Registration (printed on formal agreements) ------------------
    ntn: { type: String, default: '' },         // National Tax Number
    strn: { type: String, default: '' },        // Sales Tax Registration Number
    registrationNumber: { type: String, default: '' },

    // ---- Branding ----------------------------------------------------
    /** Public URL of an uploaded file, e.g. "/uploads/business/2026-09/x.png". */
    logo: { type: String, default: null },
    stamp: { type: String, default: null },      // Company stamp for agreements
    signature: { type: String, default: null },  // Authorised signature image

    currency: { type: String, default: BUSINESS_DEFAULTS.currency },
    currencySymbol: { type: String, default: BUSINESS_DEFAULTS.currencySymbol },

    // ================================================================
    // Document numbering
    // ----------------------------------------------------------------
    // Each series keeps its own counter. `nextNumber()` below is the only
    // supported way to consume one, because it increments atomically.
    // ================================================================
    invoicePrefix: { type: String, default: 'INV' },
    invoiceStartingNumber: { type: Number, default: 1000 },
    invoiceCounter: { type: Number, default: 1000 },

    receiptPrefix: { type: String, default: 'RCP' },
    receiptStartingNumber: { type: Number, default: 1000 },
    receiptCounter: { type: Number, default: 1000 },

    agreementPrefix: { type: String, default: 'AGR' },
    agreementStartingNumber: { type: Number, default: 1000 },
    agreementCounter: { type: Number, default: 1000 },

    purchasePrefix: { type: String, default: 'PUR' },
    purchaseCounter: { type: Number, default: 1000 },

    // ---- Document wording defaults -----------------------------------
    termsAndConditions: {
      type: String,
      default:
        '1. Goods once sold will not be taken back or exchanged after 7 days.\n' +
        '2. Installments must be paid on or before the due date each month.\n' +
        '3. Late payment may attract a recovery charge as agreed at the time of sale.\n' +
        '4. Warranty is provided by the manufacturer and is subject to their terms.\n' +
        '5. The buyer is responsible for the safe custody of the goods until full payment is made.',
    },
    invoiceFooter: { type: String, default: 'Thank you for your business. We value your trust.' },
    receiptFooter: { type: String, default: 'This is a computer-generated receipt.' },

    /** Bank details printed on invoices when payment by transfer is offered. */
    bankName: { type: String, default: '' },
    bankAccountTitle: { type: String, default: '' },
    bankAccountNumber: { type: String, default: '' },
    bankIban: { type: String, default: '' },
  },
  { timestamps: true }
);

/**
 * Fetch the one business profile, creating it with defaults on first call.
 */
businessProfileSchema.statics.getSingleton = async function () {
  let profile = await this.findOne();
  if (!profile) profile = await this.create({});
  return profile;
};

/**
 * Atomically reserve the next number in a series.
 *
 * Uses `findOneAndUpdate` with `$inc` so two concurrent sales can never be
 * handed the same invoice number - a plain read-modify-write would race and
 * then trip the unique index, failing the second sale.
 *
 * @param {'invoice'|'receipt'|'agreement'|'purchase'} series
 * @param {string} [subPrefix] Extra segment, e.g. 'INV' -> "AGR-INV-1042".
 * @returns {Promise<string>} The formatted document number.
 */
businessProfileSchema.statics.nextNumber = async function (series, subPrefix = '') {
  const counterField = `${series}Counter`;
  const prefixField = `${series}Prefix`;

  // Guarantee the singleton exists before incrementing.
  await this.getSingleton();

  const profile = await this.findOneAndUpdate(
    {},
    { $inc: { [counterField]: 1 } },
    { new: true, upsert: true }
  );

  const prefix = profile[prefixField] || series.toUpperCase().slice(0, 3);
  const number = profile[counterField];
  return subPrefix ? `${prefix}-${subPrefix}-${number}` : `${prefix}-${number}`;
};

const BusinessProfile = mongoose.model('BusinessProfile', businessProfileSchema);
export default BusinessProfile;
