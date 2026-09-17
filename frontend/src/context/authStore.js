/**
 * ============================================
 * Auth Store
 * ============================================
 * Session state: who is signed in, what they may do, and the helpers that
 * gate the UI on it.
 *
 * Only non-sensitive state is persisted. The access token lives in its own
 * localStorage key because the Axios interceptor reads it directly, and the
 * refresh token never reaches JavaScript at all - it is an httpOnly cookie.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '../services/authService.js';
import { STORAGE_KEYS, ROLES } from '../constants/index.js';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // ---- State ----------------------------------------------------
      user: null,
      isAuthenticated: false,
      isLoading: false,
      /** Distinguishes "checking an existing session" from "not signed in". */
      isBootstrapping: true,
      error: null,

      // ==============================================================
      // Session
      // ==============================================================

      /**
       * Sign in with a username or an email address.
       * @param {{identifier:string, password:string, rememberMe?:boolean, role?:string}} credentials
       * @returns {Promise<{success:boolean, user?:object, error?:string}>}
       */
      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authService.login(credentials);
          const { user, accessToken } = response.data;

          localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
          // Remember the role tab so the sign-in screen opens on it next time
          if (user?.role) localStorage.setItem(STORAGE_KEYS.LAST_ROLE, user.role);

          set({ user, isAuthenticated: true, isLoading: false, error: null, isBootstrapping: false });
          return { success: true, user };
        } catch (error) {
          set({ isLoading: false, error: error.message });
          return { success: false, error: error.message };
        }
      },

      /** Sign out. Local state is cleared even if the server call fails. */
      logout: async () => {
        try {
          await authService.logout();
        } catch {
          // A network failure must not trap the user in a signed-in UI.
        }
        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        set({ user: null, isAuthenticated: false, error: null, isBootstrapping: false });
      },

      /**
       * Validate the persisted session on app start.
       *
       * Persisted state alone is not proof of a live session: the account may
       * have been deactivated or the password changed since. Asking the server
       * is what makes the first render trustworthy.
       */
      bootstrap: async () => {
        const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
        if (!token) {
          set({ user: null, isAuthenticated: false, isBootstrapping: false });
          return false;
        }

        try {
          const response = await authService.getMe();
          set({ user: response.data.user, isAuthenticated: true, isBootstrapping: false });
          return true;
        } catch {
          // The interceptor has already attempted a refresh by this point.
          localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
          set({ user: null, isAuthenticated: false, isBootstrapping: false });
          return false;
        }
      },

      /** Re-read the profile, e.g. after an admin changes this user's role. */
      refreshProfile: async () => {
        try {
          const response = await authService.getMe();
          set({ user: response.data.user });
          return response.data.user;
        } catch {
          return null;
        }
      },

      // ==============================================================
      // Account
      // ==============================================================

      changePassword: async (data) => {
        try {
          const response = await authService.changePassword(data);

          // The server revokes every session and hands back a fresh token for
          // this device. Storing it keeps the user signed in where they are,
          // while every other device is signed out.
          if (response.data?.accessToken) {
            localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.data.accessToken);
          }

          set((state) => ({
            user: response.data?.user || { ...state.user, mustChangePassword: false },
          }));

          return { success: true, message: response.message };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },

      updateProfile: async (data) => {
        try {
          const response = await authService.updateProfile(data);
          set({ user: response.data.user });
          return { success: true, user: response.data.user };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },

      uploadPhoto: async (file) => {
        try {
          const response = await authService.uploadPhoto(file);
          set({ user: response.data.user });
          return { success: true, user: response.data.user };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },

      // ==============================================================
      // Authorisation helpers
      // ==============================================================

      /** Can this user reach the given module? */
      hasPermission: (permission) => {
        const { user } = get();
        if (!user) return false;
        if (user.role === ROLES.ADMIN) return true; // Admin has everything
        return user.permissions?.includes(permission) ?? false;
      },

      /** Does the user hold one of the given roles? */
      hasRole: (...roles) => roles.includes(get().user?.role),

      /** Convenience flag used all over the UI to gate destructive actions. */
      isAdmin: () => get().user?.role === ROLES.ADMIN,

      /** Admin or manager - the two roles that can approve and configure. */
      isManagerOrAbove: () => [ROLES.ADMIN, ROLES.MANAGER].includes(get().user?.role),

      clearError: () => set({ error: null }),
    }),
    {
      name: STORAGE_KEYS.AUTH,
      // The token is stored separately, and `isBootstrapping` must always
      // start true so a stale persisted session is re-verified on load.
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
