/**
 * ============================================
 * Category Model
 * ============================================
 * Product categories with custom field support.
 * Custom fields allow admin to define category-specific attributes
 * (e.g., Mobile has IMEI, Bike has Engine Number).
 */

import mongoose from 'mongoose';

const customFieldSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['text', 'number', 'currency', 'date', 'dropdown', 'multiselect', 'boolean', 'textarea', 'image'],
      default: 'text',
    },
    required: { type: Boolean, default: false },
    defaultValue: { type: mongoose.Schema.Types.Mixed, default: null },
    options: [{ type: String }], // For dropdown/multiselect
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, trim: true, lowercase: true, index: true },
    description: { type: String, default: '' },
    icon: { type: String, default: 'Package' }, // Lucide icon name
    image: { type: String, default: null }, // Base64 or URL
    customFields: [customFieldSchema],
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Auto-generate slug from name
categorySchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  next();
});

categorySchema.index({ status: 1 });

const Category = mongoose.model('Category', categorySchema);
export default Category;
