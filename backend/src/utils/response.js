/**
 * ============================================
 * Standardized API Response Helpers
 * ============================================
 * Ensures consistent response shape across all endpoints:
 * { success: true, data: ... } or { success: false, message, code, errors }
 */

export const sendSuccess = (res, data = null, statusCode = 200, message = null) => {
  const response = { success: true };
  if (message) response.message = message;
  if (data !== null) response.data = data;
  return res.status(statusCode).json(response);
};

export const sendError = (res, statusCode = 500, message = 'Something went wrong', code = null, errors = null) => {
  const response = { success: false, message };
  if (code) response.code = code;
  if (errors) response.errors = errors;
  return res.status(statusCode).json(response);
};

export const sendPaginated = (res, data, pagination, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
    pagination,
  });
};
