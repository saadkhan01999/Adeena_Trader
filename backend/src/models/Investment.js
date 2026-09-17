/**
 * ============================================
 * Investment Model
 * ============================================
 * Individual investment records from investors.
 * One investor can have multiple investments.
 */

import mongoose from 'mongoose';

const investmentSchema = new mongoose.Schema(
  {
    investor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Investor',
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    investmentDate: { type: Date, default: Date.now },
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
    businessAllocation: { type: String, default: 'general' },
    status: {
      type: String,
      enum: ['active', 'withdrawn', 'matured', 'cancelled'],
      default: 'active',
    },
    notes: { type: String, default: '' },
    // Reference for audit
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

investmentSchema.index({ investor: 1, status: 1 });
investmentSchema.index({ investmentDate: -1 });

const Investment = mongoose.model('Investment', investmentSchema);
export default Investment;
