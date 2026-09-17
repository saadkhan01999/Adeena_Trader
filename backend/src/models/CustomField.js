/**
 * ============================================
 * Custom Field Model
 * ============================================
 * Admin-defined extra fields attached to a module's create/edit form.
 *
 * Why this exists
 * ---------------
 * Every trading business records something the next one does not: a bike
 * dealer wants "Registration Book No.", a solar dealer wants "Panel Watts",
 * a furniture dealer wants "Wood Type". Rather than growing the schema for
 * each request, the admin defines the field once in Settings and it appears on
 * that module's form, in its detail view, and in CSV exports.
 *
 * Values are stored on the owning record's `customAttributes` map, keyed by
 * this field's `key`.
 */

import mongoose from 'mongoose';
import { CUSTOM_FIELD_MODULES, CUSTOM_FIELD_TYPES } from '../constants/index.js';

const customFieldSchema = new mongoose.Schema(
  {
    /** Which form this field is injected into. */
    module: {
      type: String,
      enum: CUSTOM_FIELD_MODULES,
      required: true,
      index: true,
    },

    /**
     * Stable machine key used as the map key on the owning record.
     * Generated from the label and then frozen, so renaming the label never
     * orphans data that was already captured.
     */
    key: { type: String, required: true, trim: true },

    label: { type: String, required: true, trim: true },
    type: { type: String, enum: CUSTOM_FIELD_TYPES, default: 'text' },

    /** Options for `select` fields. Ignored for every other type. */
    options: [{ type: String, trim: true }],

    placeholder: { type: String, default: '' },
    helpText: { type: String, default: '' },
    defaultValue: { type: String, default: '' },

    isRequired: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    /** Also print this field on the record's invoice/agreement. */
    showOnDocuments: { type: Boolean, default: false },

    /** Display order within the module's "Additional Details" section. */
    order: { type: Number, default: 0 },

    /** How wide the control renders: 1 = half row, 2 = full row. */
    span: { type: Number, enum: [1, 2], default: 1 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// A key only has to be unique inside its own module.
customFieldSchema.index({ module: 1, key: 1 }, { unique: true });
customFieldSchema.index({ module: 1, order: 1 });

/**
 * Normalise a label into a safe, stable key: "Panel Watts" -> "panel_watts".
 * Exported so the controller can generate keys consistently.
 */
export const toFieldKey = (label = '') =>
  String(label)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

const CustomField = mongoose.model('CustomField', customFieldSchema);
export default CustomField;
