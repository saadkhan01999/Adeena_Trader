/**
 * ============================================
 * Auth Routes
 * ============================================
 * Mounted at /api/auth.
 *
 * `/login` carries its own stricter rate limit, applied in app.js.
 */

import express from 'express';
import {
  login, refreshToken, logout, getMe, changePassword,
  updateProfile, uploadProfilePhoto, getSetupStatus, initialSetup,
} from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.js';
import { validateSchema } from '../middleware/validate.js';
import { loginSchema, changePasswordSchema } from '../validators/index.js';
import { uploadImage } from '../middleware/upload.js';

const router = express.Router();

// ---- Public ---------------------------------------------------------------
router.post('/login', validateSchema({ body: loginSchema }), login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/setup-status', getSetupStatus);
router.post('/setup', initialSetup);

// ---- Authenticated --------------------------------------------------------
router.use(protect);

router.get('/me', getMe);
router.put('/change-password', validateSchema({ body: changePasswordSchema }), changePassword);
router.put('/profile', updateProfile);
router.post(
  '/profile/photo',
  (req, res, next) => { req.params.folder = 'users'; next(); },
  uploadImage.single('photo'),
  uploadProfilePhoto
);

export default router;
