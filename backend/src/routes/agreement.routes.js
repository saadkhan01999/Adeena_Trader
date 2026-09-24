/**
 * ============================================
 * Agreement Routes
 * ============================================
 * Mounted at /api/agreements.
 *
 * Issuing and amending are open to anyone with the `agreements` permission;
 * cancelling a signed legal document is restricted to admin and manager.
 */

import express from 'express';
import {
  getAgreements, getAgreement, createAgreement, updateAgreement,
  signAgreement, addAttachments, removeAttachment, regenerate, cancelAgreement, deleteAgreementPermanently,
} from '../controllers/agreement.controller.js';
import { protect } from '../middleware/auth.js';
import { requirePermission, restrictTo } from '../middleware/rbac.js';
import { uploadDocuments } from '../middleware/upload.js';
import { PERMISSIONS } from '../constants/index.js';

const router = express.Router();

router.use(protect);
router.use(requirePermission(PERMISSIONS.AGREEMENTS));

router.get('/', getAgreements);
router.post('/', createAgreement);

router.get('/:id', getAgreement);
router.put('/:id', updateAgreement);
router.delete('/:id', restrictTo('admin', 'manager'), cancelAgreement);
router.delete('/:id/permanent', restrictTo('admin'), deleteAgreementPermanently);

router.post('/:id/sign', signAgreement);
router.post('/:id/regenerate', restrictTo('admin', 'manager'), regenerate);

// Scanned copies of the physically signed agreement
router.post(
  '/:id/attachments',
  (req, res, next) => { req.params.folder = 'agreements'; next(); },
  uploadDocuments.array('files', 10),
  addAttachments
);
router.delete('/:id/attachments/:index', removeAttachment);

export default router;
