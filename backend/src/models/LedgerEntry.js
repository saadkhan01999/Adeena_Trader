/**
 * ============================================
 * Ledger Entry Model
 * ============================================
 * Transaction-driven ledger for all entity types.
 * Each entry represents a debit or credit to an entity's account.
 *
 * Entities: customer, supplier, partner, investor
 */

import mongoose from 'mongoose';

const ledgerEntrySchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ['customer', 'supplier', 'partner', 'investor'],
      required: true,
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    entityName: { type: String, required: true },
    // Transaction reference
    reference: { type: String, default: '' }, // Invoice #, Receipt #, etc.
    referenceType: {
      type: String,
      enum: ['sale', 'payment', 'purchase', 'payout', 'return', 'adjustment', 'investment', 'opening'],
      default: 'adjustment',
    },
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    description: { type: String, default: '' },
    // Financial
    debit: { type: Number, default: 0, min: 0 }, // Amount owed increases
    credit: { type: Number, default: 0, min: 0 }, // Amount owed decreases
    balance: { type: Number, default: 0 }, // Running balance after this entry
    // Date
    entryDate: { type: Date, default: Date.now, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

ledgerEntrySchema.index({ entityType: 1, entityId: 1, entryDate: -1 });

const LedgerEntry = mongoose.model('LedgerEntry', ledgerEntrySchema);
export default LedgerEntry;
