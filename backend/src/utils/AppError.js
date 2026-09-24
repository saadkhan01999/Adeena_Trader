/**
 * ============================================
 * Custom Application Error Class
 * ============================================
 * Used for operational errors that can be sent to client safely.
 * Distinguishes from programmer errors (bugs) that should not leak.
 */

export class AppError extends Error {
  constructor(message, statusCode = 500, code = null, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', errors = null) {
    super(message, 400, 'BAD_REQUEST', errors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', errors = null) {
    super(message, 409, 'CONFLICT', errors);
  }
}

/**
 * A delete that would touch other records, refused until the user confirms.
 *
 * `links` lists what is attached - [{ label: 'sales', count: 3 }] - and
 * `consequence` says, in plain words, what a confirmed delete (`?force=true`)
 * will do to them. The frontend shows both in a second confirmation, so the
 * admin deletes knowing exactly what goes with the record, instead of the old
 * behaviour of quietly archiving it and reporting "deleted".
 */
export class LinkedRecordsError extends AppError {
  constructor(message, links = [], consequence = '') {
    super(message, 409, 'HAS_LINKED_RECORDS', { links, consequence, canForce: true });
  }
}

/** Build the `links` list, dropping anything with a zero count. */
export const describeLinks = (counts) =>
  Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => ({ label, count }));

/** "3 sales and 2 payments" */
export const summariseLinks = (links) => {
  const parts = links.map(({ label, count }) => `${count} ${count === 1 ? label.replace(/s$/, '') : label}`);
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
};

/**
 * `?force=true` - the admin has seen the linked records and confirmed.
 * Only an administrator may force a delete that takes other records with it.
 */
export const isForced = (req) => {
  const forced = ['1', 'true', 'yes'].includes(String(req.query.force || '').toLowerCase());
  if (forced && req.user?.role !== 'admin') {
    throw new ForbiddenError('Only an administrator can delete a record together with its linked records.');
  }
  return forced;
};
