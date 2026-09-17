/**
 * ============================================
 * Customer Model
 * ============================================
 * Tracks customer info, CNIC, guarantor, photos, and running financial totals.
 * Financial totals are kept in sync by the financial service on every transaction.
 */

import mongoose from 'mongoose';

/**
 * A supporting document: CNIC scan, signed agreement, utility bill, etc.
 * Stored on disk; the record keeps a public URL plus enough metadata to render
 * a download chip (name, type, size) without touching the file.
 */
const customerDocumentSchema = new mongoose.Schema(
  {
    type: { type: String, default: 'other' }, // cnic_front | cnic_back | agreement | other
    url: { type: String, default: '' },
    name: { type: String, default: '' },
    mimetype: { type: String, default: '' },
    size: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
    /** @deprecated legacy base64 payload - read only. */
    data: { type: String, default: '' },
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    cnic: {
      type: String,
      trim: true,
      index: true,
      match: [/^[0-9\-]+$/, 'CNIC must contain only digits and hyphens'],
    },
    mobile1: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    mobile2: { type: String, default: '', trim: true },
    address: { type: String, default: '' },
    reference: { type: String, default: '' }, // Reference person
    // Guarantor - required for installment sales when Settings demands one
    guarantorName: { type: String, default: '' },
    guarantorPhone: { type: String, default: '' },
    guarantorCnic: { type: String, default: '' },
    guarantorAddress: { type: String, default: '' },
    guarantorRelation: { type: String, default: '' },
    // Photos - public URLs of uploaded files (not base64)
    photo: { type: String, default: null },
    cnicFrontPhoto: { type: String, default: null },
    cnicBackPhoto: { type: String, default: null },
    /** Admin-defined extra fields (see models/CustomField.js). */
    customAttributes: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    // Documents
    documents: [customerDocumentSchema],
    // Financial running totals (kept in sync by service layer)
    totalSales: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    outstanding: { type: Number, default: 0 },
    overdue: { type: Number, default: 0 },
    nextDueDate: { type: Date, default: null },
    // Status
    status: {
      type: String,
      enum: ['active', 'inactive', 'blacklisted'],
      default: 'active',
      index: true,
    },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// Text index for search
customerSchema.index({ name: 'text', cnic: 'text', mobile1: 'text', mobile2: 'text' });
customerSchema.index({ name: 1, mobile1: 1 });

const Customer = mongoose.model('Customer', customerSchema);
export default Customer;
