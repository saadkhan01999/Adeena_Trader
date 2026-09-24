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
import { clearList } from '../utils/listCache.js';

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

        // Drop the remembered list results with the session. They are held in
        // memory to make tabs paint instantly, and the next person to sign in
        // on this shop's counter machine must not be shown the previous
        // user's customers while their own load.
        clearList();

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

        // Paint at once from the remembered profile, and check with the server
        // behind it. Waiting on that round trip before showing anything is what
        // put a full-screen "Restoring your session" on every browser refresh.
        // If the check fails, the session is dropped a moment later and the
        // route guard sends the user to sign in - nothing is shown that the
        // server would not have allowed, because every data request is itself
        // authenticated.
        const remembered = get().user;
        if (remembered) set({ isAuthenticated: true, isBootstrapping: false });

        try {
          const response = await authService.getMe();
          set({ user: response.data.user, isAuthenticated: true, isBootstrapping: false });
          return true;
        } catch (error) {
          // No internet is not a signed-out session. Keep working from the
          // remembered profile; the offline banner says what is going on.
          const unreachable = ['OFFLINE', 'NETWORK_ERROR'].includes(error?.code);
          if (unreachable && remembered) {
            set({ isBootstrapping: false });
            return true;
          }

          localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
          clearList();
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
