/**
 * ============================================
 * Stock Movement Model
 * ============================================
 * Audit trail for all stock changes.
 * Every purchase, sale, return, and adjustment creates a movement record.
 */

import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    productName: { type: String, required: true },
    type: {
      type: String,
      enum: ['purchase', 'sale', 'return', 'exchange', 'adjustment', 'buy_from_other'],
      required: true,
    },
    quantity: { type: Number, required: true }, // Positive = increase, negative = decrease
    quantityBefore: { type: Number, required: true },
    quantityAfter: { type: Number, required: true },
    reference: { type: String, default: '' }, // Invoice #, Purchase #, etc.
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    reason: { type: String, default: '' },
    movementDate: { type: Date, default: Date.now, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

stockMovementSchema.index({ product: 1, movementDate: -1 });
stockMovementSchema.index({ type: 1 });

const StockMovement = mongoose.model('StockMovement', stockMovementSchema);
export default StockMovement;
