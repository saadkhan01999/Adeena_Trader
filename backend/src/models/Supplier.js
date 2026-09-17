/**
 * ============================================
 * Supplier Model
 * ============================================
 * Tracks suppliers with running purchase/payable totals.
 */

import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    phone: { type: String, default: '', trim: true, index: true },
    alternatePhone: { type: String, default: '' },
    address: { type: String, default: '' },
    contactPerson: { type: String, default: '' },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email'],
    },
    // Running totals (synced by service)
    openingBalance: { type: Number, default: 0 },
    totalPurchases: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    payable: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

supplierSchema.index({ name: 'text', phone: 'text' });

const Supplier = mongoose.model('Supplier', supplierSchema);
export default Supplier;
