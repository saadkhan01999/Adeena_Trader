/**
 * ============================================
 * Document Template & Custom Field Routes
 * ============================================
 * Mounted at /api.
 *
 * Templates are READABLE by anyone who can print a document (an invoice needs
 * its clause text), but WRITABLE only by an administrator - the wording of a
 * legal agreement is the owner's responsibility alone.
 */

import express from 'express';
import {
  getTemplates, getTemplateByType, updateTemplate, resetTemplateToDefault, getTemplateDefault,
  getCustomFields, createCustomField, updateCustomField, deleteCustomField, reorderCustomFields,
} from '../controllers/template.controller.js';
import { protect } from '../middleware/auth.js';
import { restrictTo } from '../middleware/rbac.js';

const router = express.Router();

router.use(protect);

// ============================================================================
// Document templates
// ============================================================================
router.get('/templates', getTemplates);
router.get('/templates/:type/default', restrictTo('admin'), getTemplateDefault);
router.get('/templates/:type', getTemplateByType);
router.put('/templates/:type', restrictTo('admin'), updateTemplate);
router.post('/templates/:type/reset', restrictTo('admin'), resetTemplateToDefault);

// ============================================================================
// Custom fields
// Readable by all so entity forms can render them; managed by admin only.
// ============================================================================
router.get('/custom-fields', getCustomFields);
router.post('/custom-fields', restrictTo('admin'), createCustomField);
router.put('/custom-fields/reorder', restrictTo('admin'), reorderCustomFields);
router.put('/custom-fields/:id', restrictTo('admin'), updateCustomField);
router.delete('/custom-fields/:id', restrictTo('admin'), deleteCustomField);

export default router;
