/**
 * ============================================
 * Product Model
 * ============================================
 * Tracks inventory items with category-specific attributes,
 * serial/IMEI tracking, ownership allocation, and image gallery.
 */

import mongoose from 'mongoose';

/**
 * A product photo. Images live on disk and the record keeps only a short
 * public URL, so listing 500 products never drags megabytes of binary through
 * the query. `data` is retained purely to read records created before the
 * switch away from base64 storage.
 */
const productImageSchema = new mongoose.Schema(
  {
    url: { type: String, default: '' },
    name: { type: String, default: '' },
    mimetype: { type: String, default: '' },
    size: { type: Number, default: 0 },
    isPrimary: { type: Boolean, default: false },
    uploadedAt: { type: Date, default: Date.now },
    /** @deprecated legacy base64 payload - read only. */
    data: { type: String, default: '' },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: '' },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    brand: { type: String, default: '', trim: true },
    model: { type: String, default: '', trim: true },
    color: { type: String, default: '' },
    // Pricing
    purchasePrice: { type: Number, default: 0, min: 0 },
    cashPrice: { type: Number, default: 0, min: 0 },
    installmentPrice: { type: Number, default: 0, min: 0 },
    // Inventory
    stock: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    barcode: { type: String, default: '', index: true },
    // Ownership allocation
    ownership: {
      type: String,
      enum: ['owner', 'partner', 'shared'],
      default: 'owner',
      index: true,
    },
    partnerSharePercent: { type: Number, default: 0, min: 0, max: 100 },
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Partner',
      default: null,
    },
    // Serial tracking (for mobiles, bikes, etc.)
    imei1: { type: String, default: '', index: true, sparse: true },
    imei2: { type: String, default: '' },
    serialNumber: { type: String, default: '', index: true, sparse: true },
    engineNumber: { type: String, default: '' },
    chassisNumber: { type: String, default: '' },
    registrationNumber: { type: String, default: '' },
    // Solar-specific
    solarSpecs: {
      panel: { type: String, default: '' },
      inverter: { type: String, default: '' },
      battery: { type: String, default: '' },
    },
    // Appliance-specific
    applianceSpecs: {
      capacity: { type: String, default: '' },
      warranty: { type: String, default: '' },
    },
    // Warranty
    warrantyMonths: { type: Number, default: 0, min: 0 },
    // Custom category-specific attributes
    customAttributes: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Images
    images: [productImageSchema],
    // Status
    status: {
      type: String,
      enum: ['active', 'archived', 'out_of_stock'],
      default: 'active',
      index: true,
    },
  },
  { timestamps: true }
);

/**
 * The image to show in lists and on documents: the one flagged primary,
 * otherwise the first uploaded. Falls back to the legacy base64 field so old
 * records keep rendering.
 */
productSchema.virtual('primaryImage').get(function () {
  const primary = this.images?.find((img) => img.isPrimary) || this.images?.[0];
  return primary?.url || primary?.data || null;
});

// Virtual: is low stock
productSchema.virtual('isLowStock').get(function () {
  return this.stock > 0 && this.stock <= this.lowStockThreshold;
});

// Virtual: is out of stock
productSchema.virtual('isOutOfStock').get(function () {
  return this.stock === 0;
});

// Indexes
productSchema.index({ name: 'text', brand: 'text', model: 'text' });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ ownership: 1, partner: 1 });

const Product = mongoose.model('Product', productSchema);
export default Product;
