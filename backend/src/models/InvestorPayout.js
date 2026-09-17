/**
 * ============================================
 * Investor Payout Model
 * ============================================
 * Records profit payouts to investors.
 * Each payout reduces investor's profit remaining.
 */

import mongoose from 'mongoose';

const investorPayoutSchema = new mongoose.Schema(
  {
    investor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Investor',
      required: true,
      index: true,
    },
    investment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Investment',
      default: null,
    },
    payoutAmount: { type: Number, required: true, min: 0 },
    paymentDate: { type: Date, default: Date.now },
    paymentMethod: {
      type: String,
      enum: ['cash', 'bank', 'card', 'other'],
      default: 'cash',
    },
    referenceNumber: { type: String, default: '' },
    receiptNumber: { type: String, default: '' },
    notes: { type: String, default: '' },
    status: {
      type: String,
      enum: ['completed', 'reversed'],
      default: 'completed',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

investorPayoutSchema.index({ investor: 1, paymentDate: -1 });

const InvestorPayout = mongoose.model('InvestorPayout', investorPayoutSchema);
export default InvestorPayout;
