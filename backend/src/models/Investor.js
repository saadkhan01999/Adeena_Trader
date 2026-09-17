/**
 * ============================================
 * Investor Model
 * ============================================
 * External investors who provide capital for profit share.
 *
 * CRITICAL BUSINESS RULE:
 * Investors are NOT part of Zakat calculations.
 * Zakat applies only to Owner and Partner.
 * Investors are tracked separately for capital, profit, and payouts.
 */

import mongoose from 'mongoose';

const investorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    phone: { type: String, default: '', trim: true, index: true },
    alternatePhone: { type: String, default: '' },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email'],
    },
    cnic: { type: String, default: '', trim: true },
    address: { type: String, default: '' },
    photo: { type: String, default: null }, // Base64
    // Investment configuration
    totalInvestment: { type: Number, default: 0 },
    investmentDate: { type: Date, default: null },
    investmentType: {
      type: String,
      enum: ['fixed_term', 'ongoing', 'profit_sharing'],
      default: 'profit_sharing',
    },
    profitPercentage: { type: Number, default: 0, min: 0, max: 100 },
    profitCalculationMethod: {
      type: String,
      enum: ['fixed_percent', 'profit_sharing', 'monthly_fixed'],
      default: 'fixed_percent',
    },
    // Running profit totals (synced by service)
    profitEarned: { type: Number, default: 0 },
    profitPaid: { type: Number, default: 0 },
    profitRemaining: { type: Number, default: 0 },
    // Agreement
    agreementDocPhoto: { type: String, default: null },
    witnesses: [{
      name: { type: String, default: '' },
      cnic: { type: String, default: '' },
      phone: { type: String, default: '' },
    }],
    signedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['active', 'inactive', 'closed'],
      default: 'active',
    },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

investorSchema.index({ name: 'text', phone: 'text', cnic: 'text' });

const Investor = mongoose.model('Investor', investorSchema);
export default Investor;
