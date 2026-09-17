/**
 * ============================================
 * Toast Store
 * ============================================
 * Transient success/error feedback.
 *
 * Errors stay on screen longer than successes, and stack with a cap: a burst
 * of failures should not bury the screen under twenty overlapping cards.
 */

import { create } from 'zustand';

let nextId = 0;

/** Hard cap on visible toasts. Older ones are dropped as new ones arrive. */
const MAX_VISIBLE = 4;

export const useToastStore = create((set, get) => ({
  toasts: [],

  /**
   * Show a toast.
   *
   * @param {string|object} message  Text, or { message, title, action }.
   * @param {'success'|'error'|'warning'|'info'} [type='success']
   * @param {number} [duration]      ms; 0 keeps it until dismissed.
   * @returns {number} The toast id, so the caller can dismiss it early.
   */
  addToast: (message, type = 'success', duration) => {
    const id = ++nextId;

    // Errors deserve longer: the user may need to read a validation message.
    const resolvedDuration = duration ?? (type === 'error' ? 6000 : 3800);

    const toast =
      typeof message === 'object'
        ? { id, type, duration: resolvedDuration, ...message }
        : { id, message, type, duration: resolvedDuration };

    set((state) => ({ toasts: [...state.toasts, toast].slice(-MAX_VISIBLE) }));

    if (resolvedDuration > 0) {
      setTimeout(() => get().removeToast(id), resolvedDuration);
    }
    return id;
  },

  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  clearToasts: () => set({ toasts: [] }),

  // ---- Convenience wrappers --------------------------------------------
  success: (message, duration) => get().addToast(message, 'success', duration),
  error: (message, duration) => get().addToast(message, 'error', duration),
  warning: (message, duration) => get().addToast(message, 'warning', duration),
  info: (message, duration) => get().addToast(message, 'info', duration),

  /**
   * Report a failed API call.
   * Field-level validation errors are joined into the body, so the user sees
   * exactly which inputs were rejected rather than a generic "Validation failed".
   */
  apiError: (error, fallback = 'Something went wrong. Please try again.') => {
    const detail = error?.errors?.length
      ? error.errors.map((e) => e.message).join(' · ')
      : null;

    return get().addToast(
      { message: detail || error?.message || fallback, title: detail ? error?.message : undefined },
      'error'
    );
  },
}));
