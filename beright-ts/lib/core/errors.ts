/**
 * Error Classes for BeRight Protocol
 * Custom error types with recovery semantics
 */

import { ErrorCode } from '../../types/api';
import type { Platform } from '../../types/market';
import type { SerializedError } from '../../types/errors';

/**
 * Base error class for all BeRight errors
 * Includes error code, retryability, and serialization
 */
export class BeRightError extends Error {
  public readonly timestamp: string;

  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly retryable: boolean = false,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Serialize error for logging or transport
   */
  toJSON(): SerializedError {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      stack: this.stack,
      retryable: this.retryable,
      details: this.details,
    };
  }

  /**
   * Create error from serialized form
   */
  static fromJSON(json: SerializedError): BeRightError {
    const error = new BeRightError(
      json.message,
      json.code,
      json.retryable,
      json.details
    );
    error.stack = json.stack;
    return error;
  }
}

/**
 * Network-related errors (connection, DNS, etc.)
 * Always retryable with exponential backoff
 */
export class NetworkError extends BeRightError {
  constructor(
    message: string,
    public readonly url?: string,
    public readonly statusCode?: number,
    details?: Record<string, unknown>
  ) {
    super(message, ErrorCode.NETWORK_ERROR, true, {
      url,
      statusCode,
      ...details,
    });
  }
}

/**
 * Request timeout errors
 * Retryable, may need longer timeout on retry
 */
export class TimeoutError extends BeRightError {
  constructor(
    message: string,
    public readonly timeoutMs: number,
    public readonly url?: string
  ) {
    super(message, ErrorCode.TIMEOUT, true, { timeoutMs, url });
  }
}

/**
 * Rate limit errors from external APIs
 * Retryable after waiting for reset
 */
export class RateLimitError extends BeRightError {
  constructor(
    public readonly retryAfterMs: number,
    public readonly limit?: number,
    public readonly remaining?: number,
    details?: Record<string, unknown>
  ) {
    super(
      `Rate limited. Retry after ${Math.ceil(retryAfterMs / 1000)}s`,
      ErrorCode.RATE_LIMITED,
      true,
      { retryAfterMs, limit, remaining, ...details }
    );
  }
}

/**
 * Platform-specific errors (Kalshi, Polymarket, etc.)
 * May or may not be retryable depending on error type
 */
export class PlatformError extends BeRightError {
  constructor(
    public readonly platform: Platform,
    message: string,
    retryable: boolean = false,
    public readonly platformErrorCode?: string,
    details?: Record<string, unknown>
  ) {
    super(
      `[${platform}] ${message}`,
      ErrorCode.PLATFORM_ERROR,
      retryable,
      { platform, platformErrorCode, ...details }
    );
  }
}

/**
 * Validation errors for bad input
 * Never retryable without changing input
 */
export class ValidationError extends BeRightError {
  constructor(
    message: string,
    public readonly fields?: Array<{ field: string; message: string }>
  ) {
    super(message, ErrorCode.VALIDATION_ERROR, false, { fields });
  }
}

/**
 * Authentication/authorization errors
 * May need token refresh
 */
export class AuthError extends BeRightError {
  constructor(
    message: string,
    public readonly tokenExpired: boolean = false
  ) {
    super(
      message,
      tokenExpired ? ErrorCode.UNAUTHORIZED : ErrorCode.FORBIDDEN,
      tokenExpired, // Retryable if just token expired
      { tokenExpired }
    );
  }
}

/**
 * Resource not found errors
 * Never retryable
 */
export class NotFoundError extends BeRightError {
  constructor(
    resource: string,
    identifier: string
  ) {
    super(
      `${resource} not found: ${identifier}`,
      ErrorCode.NOT_FOUND,
      false,
      { resource, identifier }
    );
  }
}

/**
 * Circuit breaker open error
 * Retryable after circuit resets
 */
export class CircuitOpenError extends BeRightError {
  constructor(
    public readonly serviceName: string,
    public readonly resetAtMs?: number
  ) {
    const resetIn = resetAtMs ? ` (resets in ${Math.ceil((resetAtMs - Date.now()) / 1000)}s)` : '';
    super(
      `Circuit breaker open for ${serviceName}${resetIn}`,
      ErrorCode.CIRCUIT_OPEN,
      true,
      { serviceName, resetAtMs }
    );
  }
}

/**
 * Trade execution errors
 * Retryability depends on reason
 */
export class TradeError extends BeRightError {
  constructor(
    message: string,
    public readonly platform: Platform,
    public readonly marketId: string,
    retryable: boolean = false,
    details?: Record<string, unknown>
  ) {
    super(message, ErrorCode.INVALID_TRADE, retryable, {
      platform,
      marketId,
      ...details,
    });
  }
}

/**
 * Check if an error is a BeRightError
 */
export function isBeRightError(error: unknown): error is BeRightError {
  return error instanceof BeRightError;
}

/**
 * Convert unknown error to BeRightError
 */
export function toBeRightError(error: unknown): BeRightError {
  if (isBeRightError(error)) {
    return error;
  }

  if (error instanceof Error) {
    // Check for common error patterns
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return new TimeoutError(error.message, 0);
    }
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return new NetworkError(error.message);
    }
    return new BeRightError(error.message, ErrorCode.INTERNAL_ERROR, false, {
      originalName: error.name,
      originalStack: error.stack,
    });
  }

  return new BeRightError(
    String(error),
    ErrorCode.INTERNAL_ERROR,
    false
  );
}
