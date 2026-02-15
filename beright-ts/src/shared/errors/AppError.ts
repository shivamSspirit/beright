/**
 * AppError - Base error class for BeRight Protocol
 *
 * All domain errors extend this class for consistent error handling.
 * Errors are designed to be serializable for API responses.
 */

/**
 * Error codes for categorizing errors
 */
export enum ErrorCode {
  // Validation errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  INVALID_PROBABILITY = 'INVALID_PROBABILITY',
  INVALID_DIRECTION = 'INVALID_DIRECTION',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Authentication/Authorization errors (401/403)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  USER_NOT_FOUND = 'USER_NOT_FOUND',

  // Not found errors (404)
  NOT_FOUND = 'NOT_FOUND',
  MARKET_NOT_FOUND = 'MARKET_NOT_FOUND',
  PREDICTION_NOT_FOUND = 'PREDICTION_NOT_FOUND',

  // Conflict errors (409)
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  PREDICTION_ALREADY_RESOLVED = 'PREDICTION_ALREADY_RESOLVED',

  // External service errors (502/503)
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  SUPABASE_ERROR = 'SUPABASE_ERROR',
  KALSHI_ERROR = 'KALSHI_ERROR',
  POLYMARKET_ERROR = 'POLYMARKET_ERROR',
  DFLOW_ERROR = 'DFLOW_ERROR',
  SOLANA_ERROR = 'SOLANA_ERROR',
  TAVILY_ERROR = 'TAVILY_ERROR',

  // Internal errors (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
}

/**
 * HTTP status codes mapped to error codes
 */
export const errorCodeToHttpStatus: Record<ErrorCode, number> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.INVALID_PROBABILITY]: 400,
  [ErrorCode.INVALID_DIRECTION]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.USER_NOT_FOUND]: 404,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.MARKET_NOT_FOUND]: 404,
  [ErrorCode.PREDICTION_NOT_FOUND]: 404,
  [ErrorCode.ALREADY_EXISTS]: 409,
  [ErrorCode.PREDICTION_ALREADY_RESOLVED]: 409,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorCode.SUPABASE_ERROR]: 502,
  [ErrorCode.KALSHI_ERROR]: 502,
  [ErrorCode.POLYMARKET_ERROR]: 502,
  [ErrorCode.DFLOW_ERROR]: 502,
  [ErrorCode.SOLANA_ERROR]: 502,
  [ErrorCode.TAVILY_ERROR]: 502,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.UNKNOWN_ERROR]: 500,
  [ErrorCode.CONFIGURATION_ERROR]: 500,
};

/**
 * Serializable error metadata
 */
export interface ErrorMetadata {
  [key: string]: unknown;
}

/**
 * AppError - Base error class
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly metadata: ErrorMetadata;
  readonly timestamp: Date;
  readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    metadata: ErrorMetadata = {},
    isOperational = true
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = errorCodeToHttpStatus[code] || 500;
    this.metadata = metadata;
    this.timestamp = new Date();
    this.isOperational = isOperational;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON(): Record<string, unknown> {
    return {
      error: {
        code: this.code,
        message: this.message,
        metadata: this.metadata,
        timestamp: this.timestamp.toISOString(),
      },
    };
  }

  /**
   * Convert to user-friendly string (for Telegram/CLI)
   */
  toUserMessage(): string {
    return `Error: ${this.message}`;
  }

  /**
   * Create from unknown error
   */
  static fromUnknown(error: unknown, defaultCode = ErrorCode.UNKNOWN_ERROR): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return new AppError(defaultCode, error.message, {
        originalName: error.name,
        stack: error.stack,
      });
    }

    return new AppError(defaultCode, String(error));
  }

  /**
   * Factory methods for common errors
   */
  static validation(message: string, metadata?: ErrorMetadata): AppError {
    return new AppError(ErrorCode.VALIDATION_ERROR, message, metadata);
  }

  static notFound(resource: string, id?: string): AppError {
    return new AppError(
      ErrorCode.NOT_FOUND,
      `${resource} not found${id ? `: ${id}` : ''}`,
      { resource, id }
    );
  }

  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(ErrorCode.UNAUTHORIZED, message);
  }

  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(ErrorCode.FORBIDDEN, message);
  }

  static external(service: string, message: string, originalError?: unknown): AppError {
    const code = ({
      supabase: ErrorCode.SUPABASE_ERROR,
      kalshi: ErrorCode.KALSHI_ERROR,
      polymarket: ErrorCode.POLYMARKET_ERROR,
      dflow: ErrorCode.DFLOW_ERROR,
      solana: ErrorCode.SOLANA_ERROR,
      tavily: ErrorCode.TAVILY_ERROR,
    }[service.toLowerCase()] || ErrorCode.EXTERNAL_SERVICE_ERROR);

    return new AppError(code, `${service}: ${message}`, {
      service,
      originalError: originalError instanceof Error ? originalError.message : originalError,
    });
  }

  static internal(message: string, metadata?: ErrorMetadata): AppError {
    return new AppError(ErrorCode.INTERNAL_ERROR, message, metadata, false);
  }

  static config(message: string): AppError {
    return new AppError(ErrorCode.CONFIGURATION_ERROR, message, {}, false);
  }

  static service(message: string, metadata?: ErrorMetadata): AppError {
    return new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, message, metadata);
  }

  static database(message: string, metadata?: ErrorMetadata): AppError {
    return new AppError(ErrorCode.SUPABASE_ERROR, message, metadata);
  }
}

export default AppError;
