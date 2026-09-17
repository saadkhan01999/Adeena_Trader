/**
 * ============================================
 * Product Routes
 * ============================================
 * Mounted at /api/products.
 */

import express from 'express';
import {
  getProducts, getProduct, createProduct, updateProduct, deleteProduct,
  uploadProductImages, deleteProductImage, setPrimaryImage, getLowStockProducts,
} from '../controllers/product.controller.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validateSchema } from '../middleware/validate.js';
import { createProductSchema, updateProductSchema } from '../validators/index.js';
import { uploadImages } from '../middleware/upload.js';
import { PERMISSIONS } from '../constants/index.js';

const router = express.Router();

router.use(protect);
router.use(requirePermission(PERMISSIONS.PRODUCTS));

// `/low-stock` is declared before `/:id` so it is not captured as an id.
router.get('/low-stock', getLowStockProducts);
router.get('/', getProducts);
router.get('/:id', getProduct);

router.post('/', validateSchema({ body: createProductSchema }), createProduct);
router.put('/:id', validateSchema({ body: updateProductSchema }), updateProduct);
router.delete('/:id', deleteProduct);

// ---- Gallery (multipart/form-data) ----------------------------------------
router.post(
  '/:id/images',
  // Bucket product photos under uploads/products/<year-month>
  (req, res, next) => { req.params.folder = 'products'; next(); },
  uploadImages.array('images', 10),
  uploadProductImages
);
router.put('/:id/images/:index/primary', setPrimaryImage);
router.delete('/:id/images/:index', deleteProductImage);

export default router;
