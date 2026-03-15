/**
 * API Response Types for BeRight Protocol
 * Strongly-typed API responses with consistent error handling
 */

/**
 * Error codes for programmatic error handling
 * Each code maps to specific recovery strategies
 */
export enum ErrorCode {
  // Client errors (4xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  RATE_LIMITED = 'RATE_LIMITED',
  CONFLICT = 'CONFLICT',

  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  PLATFORM_ERROR = 'PLATFORM_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // Business logic errors
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  MARKET_CLOSED = 'MARKET_CLOSED',
  POSITION_NOT_FOUND = 'POSITION_NOT_FOUND',
  INVALID_TRADE = 'INVALID_TRADE',
  CIRCUIT_OPEN = 'CIRCUIT_OPEN',
}

/**
 * Structured API error with recovery hints
 */
export interface ApiError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
  details?: Record<string, unknown>;
}

/**
 * Response metadata for debugging and pagination
 */
export interface ResponseMeta {
  requestId: string;
  timestamp: string;
  durationMs: number;
  cached?: boolean;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Standard API response wrapper
 * All API endpoints should return this shape
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

/**
 * Helper to create success response
 */
export function successResponse<T>(
  data: T,
  meta?: Partial<ResponseMeta>
): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: meta as ResponseMeta,
  };
}

/**
 * Helper to create error response
 */
export function errorResponse(
  code: ErrorCode,
  message: string,
  options?: {
    retryable?: boolean;
    retryAfterMs?: number;
    details?: Record<string, unknown>;
  }
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
      retryable: options?.retryable ?? isRetryableError(code),
      retryAfterMs: options?.retryAfterMs,
      details: options?.details,
    },
  };
}

/**
 * Determine if an error code is retryable by default
 */
export function isRetryableError(code: ErrorCode): boolean {
  return [
    ErrorCode.NETWORK_ERROR,
    ErrorCode.TIMEOUT,
    ErrorCode.RATE_LIMITED,
    ErrorCode.SERVICE_UNAVAILABLE,
  ].includes(code);
}

/**
 * Map HTTP status codes to error codes
 */
export function httpStatusToErrorCode(status: number): ErrorCode {
  switch (status) {
    case 400:
      return ErrorCode.VALIDATION_ERROR;
    case 401:
      return ErrorCode.UNAUTHORIZED;
    case 403:
      return ErrorCode.FORBIDDEN;
    case 404:
      return ErrorCode.NOT_FOUND;
    case 409:
      return ErrorCode.CONFLICT;
    case 429:
      return ErrorCode.RATE_LIMITED;
    case 503:
      return ErrorCode.SERVICE_UNAVAILABLE;
    case 504:
      return ErrorCode.TIMEOUT;
    default:
      return status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.VALIDATION_ERROR;
  }
}
