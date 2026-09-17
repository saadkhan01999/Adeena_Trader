/**
 * ============================================
 * Agreement Model
 * ============================================
 * A concrete, issued agreement - the snapshot of a deal at the moment it was
 * signed. Covers three kinds:
 *
 *   installment_agreement - customer buying on a 6 or 12 month plan
 *   investor_agreement    - investor placing capital for a profit share
 *   partner_agreement     - partner taking an ownership percentage
 *
 * Snapshot, not a join
 * --------------------
 * Party names, CNICs, amounts and the rendered clause text are copied onto the
 * record rather than looked up. An agreement is a legal artefact: if the
 * customer later changes their phone number, or the admin edits the template,
 * the document that was signed must not change with it.
 */

import mongoose from 'mongoose';
import { DOCUMENT_TYPES } from '../constants/index.js';

/** A signed/scanned attachment (image or PDF) stored on disk. */
const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    name: { type: String, default: '' },
    mimetype: { type: String, default: '' },
    size: { type: Number, default: 0 },
    label: { type: String, default: '' }, // e.g. "Signed copy", "CNIC front"
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/** A witness to the agreement. Pakistani practice is two witnesses. */
const witnessSchema = new mongoose.Schema(
  {
    name: { type: String, default: '', trim: true },
    cnic: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    address: { type: String, default: '' },
  },
  { _id: false }
);

const agreementSchema = new mongoose.Schema(
  {
    /** Human reference printed on the document, e.g. "AGR-INV-1042". */
    agreementNumber: { type: String, required: true, unique: true, index: true },

    type: {
      type: String,
      enum: [
        DOCUMENT_TYPES.INSTALLMENT_AGREEMENT,
        DOCUMENT_TYPES.INVESTOR_AGREEMENT,
        DOCUMENT_TYPES.PARTNER_AGREEMENT,
      ],
      required: true,
      index: true,
    },

    // ---- Counterparty ------------------------------------------------
    /** Polymorphic link to the Customer / Investor / Partner record. */
    partyModel: { type: String, enum: ['Customer', 'Investor', 'Partner'], required: true },
    party: { type: mongoose.Schema.Types.ObjectId, refPath: 'partyModel', required: true, index: true },

    // Snapshot of the counterparty at signing time
    partyName: { type: String, required: true },
    partyCnic: { type: String, default: '' },
    partyPhone: { type: String, default: '' },
    partyAddress: { type: String, default: '' },

    /** Optional link back to the sale an installment agreement covers. */
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null, index: true },
    /** Optional link to the investment an investor agreement covers. */
    investment: { type: mongoose.Schema.Types.ObjectId, ref: 'Investment', default: null },

    // ---- Commercial terms -------------------------------------------
    /** Principal / sale value / capital, depending on `type`. */
    principalAmount: { type: Number, default: 0, min: 0 },
    advanceAmount: { type: Number, default: 0, min: 0 },
    payableAmount: { type: Number, default: 0, min: 0 },

    /** Installment agreements only. */
    installmentPlan: { type: Number, enum: [6, 12, null], default: null },
    monthlyInstallment: { type: Number, default: 0, min: 0 },
    firstDueDate: { type: Date, default: null },

    /** Investor / partner agreements only. */
    profitPercentage: { type: Number, default: 0, min: 0, max: 100 },
    ownershipPercentage: { type: Number, default: 0, min: 0, max: 100 },
    profitCalculationMethod: {
      type: String,
      enum: ['fixed_percent', 'profit_sharing', 'monthly_fixed', ''],
      default: '',
    },

    // ---- Dates -------------------------------------------------------
    agreementDate: { type: Date, default: Date.now, index: true },
    effectiveFrom: { type: Date, default: null },
    effectiveTo: { type: Date, default: null },

    // ---- Rendered content (frozen at issue time) ---------------------
    title: { type: String, default: '' },
    introText: { type: String, default: '' },
    /** Fully substituted clause text, ready to print. */
    clauses: [
      {
        title: { type: String, default: '' },
        body: { type: String, default: '' },
        _id: false,
      },
    ],
    customText: { type: String, default: '' },
    footerText: { type: String, default: '' },

    // ---- Parties & evidence -----------------------------------------
    guarantorName: { type: String, default: '' },
    guarantorCnic: { type: String, default: '' },
    guarantorPhone: { type: String, default: '' },
    guarantorAddress: { type: String, default: '' },

    witnesses: [witnessSchema],
    attachments: [attachmentSchema],

    // ---- Lifecycle ---------------------------------------------------
    status: {
      type: String,
      enum: ['draft', 'issued', 'signed', 'active', 'completed', 'cancelled'],
      default: 'draft',
      index: true,
    },
    signedAt: { type: Date, default: null },
    signedBy: { type: String, default: '' },
    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String, default: '' },

    notes: { type: String, default: '' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

agreementSchema.index({ type: 1, status: 1, agreementDate: -1 });
agreementSchema.index({ partyName: 'text', agreementNumber: 'text', partyCnic: 'text' });

/** True once the agreement is legally in force. */
agreementSchema.virtual('isActive').get(function () {
  return ['signed', 'active'].includes(this.status);
});

const Agreement = mongoose.model('Agreement', agreementSchema);
export default Agreement;
