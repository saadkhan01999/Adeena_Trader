/**
 * ============================================
 * Auth Service
 * ============================================
 * Endpoints for signing in, session lifecycle, own-account management and
 * first-run setup.
 */

import { compressImage } from '../utils/imageCompress.js';
import api from './api.js';

export const authService = {
  /** @param {{identifier:string, password:string, rememberMe?:boolean, role?:string}} credentials */
  login: (credentials) => api.post('/auth/login', credentials),

  logout: () => api.post('/auth/logout'),

  /** Rotates the refresh cookie and returns a fresh access token. */
  refresh: () => api.post('/auth/refresh'),

  getMe: () => api.get('/auth/me'),

  changePassword: (data) => api.put('/auth/change-password', data),

  updateProfile: (data) => api.put('/auth/profile', data),

  uploadPhoto: async (file) => {
    const form = new FormData();
    form.append('photo', await compressImage(file));
    return api.post('/auth/profile/photo', form);
  },

  /**
   * Public. Tells the sign-in screen whether setup is still required, and
   * which roles have accounts, so it can render the right role tabs.
   */
  getSetupStatus: () => api.get('/auth/setup-status'),

  /** Creates the first administrator and the business profile. */
  initialSetup: (data) => api.post('/auth/setup', data),
};
