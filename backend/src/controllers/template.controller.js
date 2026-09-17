/**
 * ============================================
 * Document Template & Custom Field Controller
 * ============================================
 * Backs the "Documents" and "Custom Fields" sections of Settings, where the
 * administrator owns the wording of every printed document and can add their
 * own fields to any module's form.
 */

import DocumentTemplate from '../models/DocumentTemplate.js';
import CustomField, { toFieldKey } from '../models/CustomField.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/AppError.js';
import { logAudit } from '../middleware/audit.js';
import {
  seedDocumentTemplates,
  getTemplate,
  resetTemplate,
  getDefaultTemplate,
} from '../services/template.service.js';
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  CUSTOM_FIELD_MODULES,
  CUSTOM_FIELD_TYPES,
} from '../constants/index.js';

// ============================================================================
// Document templates
// ============================================================================

/**
 * GET /api/templates
 * Every template, seeding any that are missing so the UI always has a full set.
 */
export const getTemplates = asyncHandler(async (req, res) => {
  await seedDocumentTemplates();

  const templates = await DocumentTemplate.find().sort({ type: 1 });

  return sendSuccess(res, {
    templates,
    types: Object.values(DOCUMENT_TYPES).map((type) => ({
      type,
      label: DOCUMENT_TYPE_LABELS[type],
    })),
  });
});

/** GET /api/templates/:type */
export const getTemplateByType = asyncHandler(async (req, res) => {
  const template = await getTemplate(req.params.type);
  if (!template) throw new NotFoundError(`Template "${req.params.type}"`);
  return sendSuccess(res, { template });
});

/**
 * PUT /api/templates/:type
 * Save the admin's wording.
 *
 * `type` is stripped from the payload: the URL decides which template is being
 * edited, and letting the body override it would allow one template to be
 * written over another's slot.
 */
export const updateTemplate = asyncHandler(async (req, res) => {
  const template = await getTemplate(req.params.type);
  if (!template) throw new NotFoundError(`Template "${req.params.type}"`);

  const before = template.toObject();
  const { type, _id, ...updates } = req.body;

  // Renumber clauses and signature blocks from their array position, so
  // drag-to-reorder in the UI needs no separate ordering call.
  if (Array.isArray(updates.clauses)) {
    updates.clauses = updates.clauses.map((c, index) => ({ ...c, order: index + 1 }));
  }
  if (Array.isArray(updates.signatures)) {
    updates.signatures = updates.signatures.map((s, index) => ({ ...s, order: index + 1 }));
  }

  Object.assign(template, updates, { updatedBy: req.user.id });
  await template.save();

  await logAudit({
    req,
    module: 'settings',
    action: 'update',
    recordId: template._id.toString(),
    before,
    after: template.toObject(),
    reason: `Updated ${DOCUMENT_TYPE_LABELS[template.type]} template`,
  });

  return sendSuccess(res, { template }, 200, 'Document template saved.');
});

/**
 * POST /api/templates/:type/reset
 * Restore a template to the wording the system shipped with.
 */
export const resetTemplateToDefault = asyncHandler(async (req, res) => {
  const template = await resetTemplate(req.params.type);
  if (!template) throw new NotFoundError(`Template "${req.params.type}"`);

  await logAudit({
    req,
    module: 'settings',
    action: 'update',
    recordId: template._id.toString(),
    after: template.toObject(),
    reason: `Reset ${DOCUMENT_TYPE_LABELS[template.type]} template to defaults`,
  });

  return sendSuccess(res, { template }, 200, 'Template restored to the default wording.');
});

/**
 * GET /api/templates/:type/default
 * The shipped default, so the editor can show "what you would get if you reset".
 */
export const getTemplateDefault = asyncHandler(async (req, res) => {
  const template = getDefaultTemplate(req.params.type);
  if (!template) throw new NotFoundError(`Template "${req.params.type}"`);
  return sendSuccess(res, { template });
});

// ============================================================================
// Custom fields
// ============================================================================

/**
 * GET /api/custom-fields?module=product
 * Fields for one module, or all of them grouped by module when no filter is
 * given (which is what the Settings screen loads).
 */
export const getCustomFields = asyncHandler(async (req, res) => {
  const { module, activeOnly } = req.query;

  const query = {};
  if (module) query.module = module;
  if (activeOnly === 'true') query.isActive = true;

  const fields = await CustomField.find(query).sort({ module: 1, order: 1, createdAt: 1 });

  // Grouped shape saves the client from bucketing this itself on every render
  const grouped = fields.reduce((acc, field) => {
    (acc[field.module] ||= []).push(field);
    return acc;
  }, {});

  return sendSuccess(res, {
    fields,
    grouped,
    modules: CUSTOM_FIELD_MODULES,
    fieldTypes: CUSTOM_FIELD_TYPES,
  });
});

/**
 * POST /api/custom-fields
 * Define a new field on a module's form.
 */
export const createCustomField = asyncHandler(async (req, res) => {
  const { module, label, type = 'text' } = req.body;

  if (!CUSTOM_FIELD_MODULES.includes(module)) {
    throw new BadRequestError(`"${module}" is not a module that accepts custom fields.`);
  }
  if (!label?.trim()) {
    throw new BadRequestError('A field label is required.');
  }
  if (type === 'select' && (!Array.isArray(req.body.options) || req.body.options.length === 0)) {
    throw new BadRequestError('A dropdown field needs at least one option.');
  }

  const key = toFieldKey(label);
  if (!key) {
    throw new BadRequestError('The label must contain at least one letter or number.');
  }

  const duplicate = await CustomField.findOne({ module, key });
  if (duplicate) {
    throw new ConflictError(`A field named "${label}" already exists on the ${module} form.`);
  }

  // Append to the end of the module's field list
  const last = await CustomField.findOne({ module }).sort({ order: -1 }).select('order');

  const field = await CustomField.create({
    ...req.body,
    key,
    order: (last?.order ?? 0) + 1,
    createdBy: req.user.id,
  });

  await logAudit({
    req,
    module: 'settings',
    action: 'create',
    recordId: field._id.toString(),
    after: field.toObject(),
    reason: `Added custom field "${label}" to ${module}`,
  });

  return sendSuccess(res, { field }, 201, `"${label}" added to the ${module} form.`);
});

/**
 * PUT /api/custom-fields/:id
 *
 * The `key` is immutable. Renaming the label is cosmetic and safe; changing the
 * key would orphan every value already captured under the old one.
 */
export const updateCustomField = asyncHandler(async (req, res) => {
  const field = await CustomField.findById(req.params.id);
  if (!field) throw new NotFoundError('Custom field');

  const before = field.toObject();
  const { key, module, _id, ...updates } = req.body;

  Object.assign(field, updates);
  await field.save();

  await logAudit({
    req,
    module: 'settings',
    action: 'update',
    recordId: field._id.toString(),
    before,
    after: field.toObject(),
  });

  return sendSuccess(res, { field }, 200, 'Custom field updated.');
});

/**
 * DELETE /api/custom-fields/:id
 *
 * Deactivates rather than deletes by default: the values already captured on
 * existing records stay readable. `?hard=true` removes the definition outright
 * for a field created by mistake.
 */
export const deleteCustomField = asyncHandler(async (req, res) => {
  const field = await CustomField.findById(req.params.id);
  if (!field) throw new NotFoundError('Custom field');

  const hard = req.query.hard === 'true';

  if (hard) {
    await field.deleteOne();
  } else {
    field.isActive = false;
    await field.save();
  }

  await logAudit({
    req,
    module: 'settings',
    action: hard ? 'delete' : 'archive',
    recordId: req.params.id,
    before: field.toObject(),
    reason: `${hard ? 'Deleted' : 'Hid'} custom field "${field.label}"`,
  });

  return sendSuccess(
    res,
    null,
    200,
    hard
      ? 'Custom field deleted.'
      : 'Custom field hidden. Existing records keep the values already saved.'
  );
});

/**
 * PUT /api/custom-fields/reorder
 * Persist a drag-and-drop reorder in one round trip.
 * Body: { module, orderedIds: [...] }
 */
export const reorderCustomFields = asyncHandler(async (req, res) => {
  const { module, orderedIds } = req.body;

  if (!Array.isArray(orderedIds)) {
    throw new BadRequestError('Provide orderedIds as an array of field ids.');
  }

  await Promise.all(
    orderedIds.map((id, index) =>
      CustomField.updateOne({ _id: id, module }, { $set: { order: index + 1 } })
    )
  );

  const fields = await CustomField.find({ module }).sort({ order: 1 });
  return sendSuccess(res, { fields }, 200, 'Field order saved.');
});
