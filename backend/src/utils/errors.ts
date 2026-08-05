/**
 * Error carrying an HTTP status and a stable machine-readable code.
 *
 * Controllers previously branched on `error.message === 'Unauthorized'`, which
 * meant rewording a message silently changed an HTTP status. Throw one of these
 * instead — `errorHandler` reads `statusCode` and `code` directly.
 */
export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(code: string, message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }
}

export const notFound = (what: string) => new AppError('NOT_FOUND', `${what} not found`, 404);

export const forbidden = (message = 'You do not have permission to do that') =>
  new AppError('FORBIDDEN', message, 403);

export const unauthorized = (message = 'Not authenticated') =>
  new AppError('UNAUTHORIZED', message, 401);

export const badRequest = (message: string, details?: unknown) =>
  new AppError('VALIDATION_ERROR', message, 400, details);

export const conflict = (code: string, message: string) => new AppError(code, message, 409);

/** True when `err` is an AppError, narrowed for the error handler. */
export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guard an id before it is interpolated into a PostgREST filter expression.
 * `.or()` and `.filter()` build query strings, so an id carrying commas or
 * parentheses can restructure the query.
 */
export function assertUuid(value: unknown, label = 'id'): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw badRequest(`Invalid ${label}`);
  }
  return value;
}
