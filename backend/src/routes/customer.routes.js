/**
 * ============================================
 * Customer Routes
 * ============================================
 * Mounted at /api/customers.
 */

import express from 'express';
import {
  getCustomers, getCustomer, getCustomerLedger, createCustomer, updateCustomer,
  deleteCustomer, uploadCustomerPhoto, uploadCustomerDocuments, deleteCustomerDocument,
} from '../controllers/customer.controller.js';
import { protect } from '../middleware/auth.js';
import { requirePermission, restrictTo } from '../middleware/rbac.js';
import { validateSchema } from '../middleware/validate.js';
import { createCustomerSchema, updateCustomerSchema } from '../validators/index.js';
import { uploadImage, uploadDocuments } from '../middleware/upload.js';
import { PERMISSIONS } from '../constants/index.js';

const router = express.Router();

router.use(protect);
router.use(requirePermission(PERMISSIONS.CUSTOMERS));

router.get('/', getCustomers);
router.get('/:id', getCustomer);
router.get('/:id/ledger', getCustomerLedger);

router.post('/', validateSchema({ body: createCustomerSchema }), createCustomer);
router.put('/:id', validateSchema({ body: updateCustomerSchema }), updateCustomer);
router.delete('/:id', restrictTo('admin', 'manager'), deleteCustomer);

// ---- Identity photos and supporting documents -----------------------------
// Bucket everything customer-related under uploads/customers/<year-month>.
const bucketAsCustomers = (req, res, next) => { req.params.folder = 'customers'; next(); };

router.post('/:id/photo', bucketAsCustomers, uploadImage.single('photo'), uploadCustomerPhoto);
router.post('/:id/documents', bucketAsCustomers, uploadDocuments.array('files', 10), uploadCustomerDocuments);
router.delete('/:id/documents/:index', deleteCustomerDocument);

export default router;
