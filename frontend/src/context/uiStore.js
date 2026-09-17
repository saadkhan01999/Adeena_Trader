/**
 * ============================================
 * UI Store
 * ============================================
 * Chrome-level state: sidebar, the ownership lens, global modals and the
 * online/offline indicator.
 *
 * Only durable preferences are persisted. Transient things - an open drawer,
 * the command palette - deliberately reset on reload, because restoring a modal
 * the user had open three days ago is disorienting, not helpful.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { OWNERSHIP_TYPES, STORAGE_KEYS } from '../constants/index.js';

export const useUIStore = create(
  persist(
    (set, get) => ({
      // ---- Sidebar --------------------------------------------------
      /** Desktop: collapsed to an icon rail. */
      sidebarCollapsed: false,
      /** Mobile: the drawer is open over the content. */
      sidebarOpen: false,

      // ---- Ownership lens -------------------------------------------
      /** Filters every figure in the app to all / owner / partner. */
      ownership: OWNERSHIP_TYPES.ALL,

      // ---- Global overlays ------------------------------------------
      calculatorOpen: false,
      commandPaletteOpen: false,
      notificationsOpen: false,

      // ---- Connectivity ---------------------------------------------
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      /** True when the browser is online but the API did not answer. */
      apiUnreachable: false,

      // ---- Unread notification badge --------------------------------
      unreadCount: 0,

      // ==============================================================
      // Actions
      // ==============================================================
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      closeSidebar: () => set({ sidebarOpen: false }),

      setOwnership: (ownership) => set({ ownership }),

      setCalculatorOpen: (open) => set({ calculatorOpen: open }),
      toggleCalculator: () => set((s) => ({ calculatorOpen: !s.calculatorOpen })),

      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),

      setNotificationsOpen: (open) => set({ notificationsOpen: open }),
      toggleNotifications: () => set((s) => ({ notificationsOpen: !s.notificationsOpen })),

      setOnline: (isOnline) => set({ isOnline, ...(isOnline ? {} : { apiUnreachable: false }) }),
      setApiUnreachable: (unreachable) => set({ apiUnreachable: unreachable }),

      setUnreadCount: (count) => set({ unreadCount: Math.max(0, count) }),
      decrementUnread: (by = 1) => set((s) => ({ unreadCount: Math.max(0, s.unreadCount - by) })),

      /** Close every overlay. Used by the Escape key handler. */
      closeAllOverlays: () =>
        set({
          calculatorOpen: false,
          commandPaletteOpen: false,
          notificationsOpen: false,
          sidebarOpen: false,
        }),
    }),
    {
      name: STORAGE_KEYS.UI,
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        ownership: state.ownership,
      }),
    }
  )
);
