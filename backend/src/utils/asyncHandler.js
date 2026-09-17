/**
 * ============================================
 * Async Handler Wrapper
 * ============================================
 * Catches async errors and forwards them to Express error middleware.
 * Avoids writing try/catch in every controller.
 */

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
