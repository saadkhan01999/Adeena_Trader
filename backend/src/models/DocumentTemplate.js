/**
 * ============================================
 * Document Template Model
 * ============================================
 * One document per printable type (invoice, receipt, installment agreement,
 * investor agreement, partnership agreement).
 *
 * Purpose
 * -------
 * The administrator owns the wording of every document the business issues.
 * Rather than hard-coding clauses in the React components, the templates live
 * here so the admin can rewrite the heading, intro, numbered clauses, footer
 * and signature blocks from Settings - and add their own extra clauses -
 * without a code change or redeploy.
 *
 * Placeholders
 * ------------
 * Any {token} inside a text field is substituted at render time from the
 * record being printed. `availableTokens` documents what each type supports
 * and is surfaced in the Settings editor as clickable chips.
 */

import mongoose from 'mongoose';
import { DOCUMENT_TYPES } from '../constants/index.js';

/** A single numbered clause. Clauses are ordered and individually toggleable. */
const clauseSchema = new mongoose.Schema(
  {
    title: { type: String, default: '', trim: true },
    body: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    /** Admin-added clauses can be deleted; seeded ones can only be edited. */
    isCustom: { type: Boolean, default: false },
  },
  { _id: true }
);

/** A signature line printed at the foot of an agreement. */
const signatureBlockSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    /** Optional caption under the rule, e.g. "CNIC: ____________". */
    caption: { type: String, default: '' },
    order: { type: Number, default: 0 },
  },
  { _id: true }
);

const documentTemplateSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: Object.values(DOCUMENT_TYPES),
      required: true,
      unique: true,
      index: true,
    },

    // ---- Headings ----------------------------------------------------
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, default: '', trim: true },

    /** Paragraph printed above the clause list (the "recitals"). */
    introText: { type: String, default: '' },

    /** Free-form paragraph printed after the clauses - the admin's own wording. */
    customText: { type: String, default: '' },

    // ---- Body --------------------------------------------------------
    clauses: [clauseSchema],
    signatures: [signatureBlockSchema],

    /** Small print under the signatures. */
    footerText: { type: String, default: '' },
    /** Legal/registration line, e.g. "This agreement is governed by…". */
    legalNote: { type: String, default: '' },

    // ---- Layout toggles ---------------------------------------------
    showLogo: { type: Boolean, default: true },
    showBusinessAddress: { type: Boolean, default: true },
    showWatermark: { type: Boolean, default: false },
    watermarkText: { type: String, default: '' },
    accentColor: { type: String, default: '#0b192c' },

    /** Documentation only - drives the token chips in the Settings editor. */
    availableTokens: [{ type: String }],

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

/**
 * Return clauses that should print, in order.
 * Keeps ordering logic in one place instead of in each renderer.
 */
documentTemplateSchema.methods.activeClauses = function () {
  return (this.clauses || [])
    .filter((c) => c.isActive)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
};

const DocumentTemplate = mongoose.model('DocumentTemplate', documentTemplateSchema);
export default DocumentTemplate;
