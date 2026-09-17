/**
 * ============================================
 * Partner Routes
 * ============================================
 */

import express from 'express';
import { getPartners, getPartner, createPartner, updatePartner, deletePartner, getPartnerDashboard } from '../controllers/partner.controller.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validateSchema } from '../middleware/validate.js';
import { createPartnerSchema, updatePartnerSchema } from '../validators/index.js';
import { PERMISSIONS } from '../constants/index.js';

const router = express.Router();
router.use(protect);

router.get('/', requirePermission(PERMISSIONS.PARTNERS), getPartners);
router.get('/:id/dashboard', requirePermission(PERMISSIONS.PARTNERS), getPartnerDashboard);
router.get('/:id', requirePermission(PERMISSIONS.PARTNERS), getPartner);
router.post('/', requirePermission(PERMISSIONS.PARTNERS), validateSchema({ body: createPartnerSchema }), createPartner);
router.put('/:id', requirePermission(PERMISSIONS.PARTNERS), validateSchema({ body: updatePartnerSchema }), updatePartner);
router.delete('/:id', requirePermission(PERMISSIONS.PARTNERS), deletePartner);

export default router;
