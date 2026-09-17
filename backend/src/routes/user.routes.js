/**
 * ============================================
 * User Routes
 * ============================================
 * Mounted at /api/users. Managing staff accounts is an administrator's job, so
 * everything except the role catalogue requires the `users` permission.
 */

import express from 'express';
import {
  getUsers, getUser, createUser, updateUser,
  resetPassword, uploadUserPhoto, deleteUser, getRoles,
} from '../controllers/user.controller.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validateSchema } from '../middleware/validate.js';
import { createUserSchema, updateUserSchema } from '../validators/index.js';
import { uploadImage } from '../middleware/upload.js';
import { PERMISSIONS } from '../constants/index.js';

const router = express.Router();

router.use(protect);

// Readable by anyone signed in: the role catalogue is also used to explain a
// user's own access on the Settings screen.
router.get('/roles', getRoles);

router.use(requirePermission(PERMISSIONS.USERS));

router.get('/', getUsers);
router.get('/:id', getUser);

router.post('/', validateSchema({ body: createUserSchema }), createUser);
router.put('/:id', validateSchema({ body: updateUserSchema }), updateUser);
router.put('/:id/reset-password', resetPassword);
router.delete('/:id', deleteUser);

router.post(
  '/:id/photo',
  (req, res, next) => { req.params.folder = 'users'; next(); },
  uploadImage.single('photo'),
  uploadUserPhoto
);

export default router;
