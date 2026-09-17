/**
 * ============================================
 * Zod Validation Middleware
 * ============================================
 * Validates req.body, req.params, req.query against Zod schemas.
 * Returns 400 with field-level errors if validation fails.
 */

import { BadRequestError } from '../utils/AppError.js';

/**
 * Create a validation middleware from Zod schemas.
 *
 * Usage:
 *   const schema = validateSchema({ body: productSchema, params: idSchema });
 *   router.post('/', schema, handler);
 */
export const validateSchema = ({ body, params, query } = {}) => {
  return (req, res, next) => {
    const errors = [];

    if (body) {
      const result = body.safeParse(req.body);
      if (!result.success) {
        errors.push(...formatZodErrors('body', result.error));
      } else {
        req.body = result.data; // Replace with parsed (and coerced) data
      }
    }

    if (params) {
      const result = params.safeParse(req.params);
      if (!result.success) {
        errors.push(...formatZodErrors('params', result.error));
      } else {
        req.params = result.data;
      }
    }

    if (query) {
      const result = query.safeParse(req.query);
      if (!result.success) {
        errors.push(...formatZodErrors('query', result.error));
      } else {
        req.query = result.data;
      }
    }

    if (errors.length > 0) {
      return next(new BadRequestError('Validation failed', errors));
    }

    next();
  };
};

/**
 * Format Zod errors into a clean array.
 */
const formatZodErrors = (location, zodError) => {
  return zodError.errors.map((err) => ({
    location,
    field: err.path.join('.'),
    message: err.message,
  }));
};
