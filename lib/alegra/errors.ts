/**
 * Typed errors for the Alegra API integration.
 *
 * All errors thrown by the AlegraClient extend `AlegraError` so callers can
 * catch the base class for "any Alegra problem" or a specific subclass for
 * a targeted UI message (e.g. "Sesión expirada, contactá al admin").
 *
 * The `code` field is a stable machine-readable string (UPPER_SNAKE_CASE)
 * suitable for analytics/logging, never localized.
 */

export class AlegraError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AlegraError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Thrown when the service user credentials are invalid, the token was
 * revoked, or ALEGRA_EMAIL / ALEGRA_TOKEN are missing/empty in env.
 * Maps to HTTP 401 from Alegra.
 *
 * NOT recoverable by retrying the request — requires operator action
 * (rotate the token in Alegra → Configuración → API → Integraciones).
 */
export class AuthError extends AlegraError {
  constructor(message = 'Credenciales de Alegra inválidas') {
    super('AUTH_ERROR', message);
    this.name = 'AuthError';
  }
}

/**
 * Thrown when the 150 req/min/user rate limit is exceeded.
 * Maps to HTTP 429 from Alegra.
 *
 * `resetAt` is the epoch-ms timestamp when the rolling 1-minute window
 * resets (parsed from the `X-Rate-Limit-Reset` header, which is seconds).
 *
 * The client should automatically wait-and-retry on this — only throw
 * here if the wait would exceed the safety cap (60s).
 */
export class RateLimitError extends AlegraError {
  public readonly resetAt: number;

  constructor(message: string, resetAt: number) {
    super('RATE_LIMIT', message);
    this.name = 'RateLimitError';
    this.resetAt = resetAt;
  }
}

/**
 * Thrown when Alegra returns a payload that fails Zod validation
 * (unexpected shape, missing required field, wrong type).
 *
 * Indicates an upstream API change we haven't adapted to yet.
 * `details` contains the Zod error tree for debugging.
 */
export class ValidationError extends AlegraError {
  constructor(message: string, details: unknown) {
    super('VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}
