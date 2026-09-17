/**
 * ============================================
 * Partner Model
 * ============================================
 * Business partners with ownership percentage.
 * Partners ARE included in Zakat calculations (unlike investors).
 */

import mongoose from 'mongoose';

const partnerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    phone: { type: String, default: '', trim: true, index: true },
    address: { type: String, default: '' },
    photo: { type: String, default: null }, // Base64
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email'],
    },
    cnic: { type: String, default: '', trim: true },
    // Ownership
    ownershipPercent: { type: Number, default: 0, min: 0, max: 100 },
    // Capital tracking
    capitalInvested: { type: Number, default: 0 },
    capitalWithdrawn: { type: Number, default: 0 },
    // Running financial totals (synced by service)
    stockValue: { type: Number, default: 0 },
    totalSales: { type: Number, default: 0 },
    totalCollection: { type: Number, default: 0 },
    totalReceivable: { type: Number, default: 0 },
    totalProfit: { type: Number, default: 0 },
    totalOverdue: { type: Number, default: 0 },
    // Zakat-eligible assets snapshot
    zakatEligibleAssets: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    notes: { type: String, default: '' },
    agreementDate: { type: Date, default: null },
  },
  { timestamps: true }
);

partnerSchema.index({ name: 'text', phone: 'text' });

const Partner = mongoose.model('Partner', partnerSchema);
export default Partner;
