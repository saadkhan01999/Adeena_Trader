/**
 * ============================================
 * Settings Store
 * ============================================
 * Caches the business profile, application settings and admin-defined custom
 * fields for the whole session.
 *
 * Every screen needs some of this - the currency symbol, the default
 * installment plan, the low-stock threshold, the invoice letterhead - so it is
 * fetched once on sign-in rather than by each page on every mount.
 */

import { create } from 'zustand';
import { businessService, settingsService, customFieldService } from '../services/entities.js';
import { BUSINESS_FALLBACK, SETTINGS_FALLBACK } from '../constants/fallbacks.js';
import { applyTheme, isTheme } from '../theme/themes.js';

/** Put the shop's saved theme on the page whenever settings arrive or change. */
const syncTheme = (settings) => {
  const theme = settings?.display?.theme;
  if (isTheme(theme)) applyTheme(theme);
};

export const useSettingsStore = create((set, get) => ({
  // ---- State ------------------------------------------------------
  business: null,
  settings: null,
  /** Custom fields grouped by module: { product: [...], customer: [...] }. */
  customFields: {},

  isLoaded: false,
  isLoading: false,
  /** False for non-admins - they may read settings but not change them. */
  canEditSettings: false,
  error: null,

  // ================================================================
  // Loading
  // ================================================================

  /**
   * Load everything in parallel.
   *
   * `Promise.allSettled` rather than `all`: a non-admin may be refused one of
   * these, and one refusal must not leave the app with no business profile and
   * therefore no currency symbol or letterhead.
   */
  load: async ({ force = false } = {}) => {
    if (get().isLoaded && !force) return;
    set({ isLoading: true, error: null });

    const [businessResult, settingsResult, fieldsResult] = await Promise.allSettled([
      businessService.get(),
      settingsService.get(),
      customFieldService.list({ activeOnly: true }),
    ]);

    set({
      business:
        businessResult.status === 'fulfilled'
          ? businessResult.value.data.profile
          : get().business || BUSINESS_FALLBACK,

      settings:
        settingsResult.status === 'fulfilled'
          ? settingsResult.value.data.settings
          : get().settings || SETTINGS_FALLBACK,

      canEditSettings:
        settingsResult.status === 'fulfilled' ? Boolean(settingsResult.value.data.canEdit) : false,

      customFields: fieldsResult.status === 'fulfilled' ? fieldsResult.value.data.grouped : {},

      isLoaded: true,
      isLoading: false,
      error: businessResult.status === 'rejected' ? businessResult.reason?.message : null,
    });

    syncTheme(get().settings);
  },

  /** Clear the cache on sign-out so the next user does not inherit it. */
  reset: () =>
    set({
      business: null,
      settings: null,
      customFields: {},
      isLoaded: false,
      canEditSettings: false,
      error: null,
    }),

  // ================================================================
  // Mutations - each updates the cache so the UI reflects the save at once
  // ================================================================

  saveBusiness: async (data) => {
    try {
      const response = await businessService.update(data);
      set({ business: response.data.profile });
      return { success: true, business: response.data.profile };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  saveSettings: async (data) => {
    try {
      const response = await settingsService.update(data);
      set({ settings: response.data.settings });
      syncTheme(response.data.settings);
      return { success: true, settings: response.data.settings };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  uploadBranding: async (file, field) => {
    try {
      const response = await businessService.uploadBranding(file, field);
      set({ business: response.data.profile });
      return { success: true, business: response.data.profile };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  removeBranding: async (field) => {
    try {
      const response = await businessService.removeBranding(field);
      set({ business: response.data.profile });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  reloadCustomFields: async () => {
    try {
      const response = await customFieldService.list({ activeOnly: true });
      set({ customFields: response.data.grouped });
      return response.data.grouped;
    } catch {
      return get().customFields;
    }
  },

  // ================================================================
  // Selectors
  // ================================================================

  /** Active custom fields for one module's form, in display order. */
  fieldsFor: (module) => get().customFields?.[module] || [],

  /** "Rs." - falls back so a failed profile load never breaks formatting. */
  currencySymbol: () => get().business?.currencySymbol || 'Rs.',

  /** Default installment tenure for a new sale. */
  defaultPlan: () => get().settings?.installment?.defaultPlan || 6,

  /** Partner's default share of a `shared` record. */
  partnerShare: () => get().settings?.ownership?.defaultPartnerShare ?? 40,
}));

/**
 * Is Urdu switched on for the shop? OFF unless the admin turned it on in
 * Settings > Appearance & language. Every piece of Urdu in the app asks this
 * one question, through the <Urdu> component or this hook.
 */
export const useUrduEnabled = () => useSettingsStore((state) => state.settings?.display?.urdu === true);

/** Are the "How to use" panels switched on? On unless turned off. */
export const useGuidesEnabled = () =>
  useSettingsStore((state) => state.settings?.display?.screenGuides !== false);
