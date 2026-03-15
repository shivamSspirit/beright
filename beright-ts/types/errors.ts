/**
 * Error Types for BeRight Protocol
 * Type definitions for error handling across the system
 */

import { ErrorCode } from './api';
import type { Platform } from './market';

/**
 * Base error context that all errors should include
 */
export interface ErrorContext {
  operation: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
}

/**
 * Network error details
 */
export interface NetworkErrorDetails extends ErrorContext {
  url: string;
  method: string;
  statusCode?: number;
  responseBody?: string;
}

/**
 * Platform-specific error details
 */
export interface PlatformErrorDetails extends ErrorContext {
  platform: Platform;
  endpoint?: string;
  platformErrorCode?: string;
  platformMessage?: string;
}

/**
 * Rate limit error details
 */
export interface RateLimitErrorDetails extends ErrorContext {
  limit: number;
  remaining: number;
  resetAt: string;
  retryAfterMs: number;
}

/**
 * Validation error with field-level details
 */
export interface ValidationErrorDetails extends ErrorContext {
  fields: ValidationFieldError[];
}

export interface ValidationFieldError {
  field: string;
  message: string;
  received?: unknown;
  expected?: string;
}

/**
 * Trade execution error details
 */
export interface TradeErrorDetails extends ErrorContext {
  platform: Platform;
  marketId: string;
  side: 'yes' | 'no';
  quantity: number;
  price?: number;
  reason: string;
}

/**
 * Serialized error for logging/transport
 */
export interface SerializedError {
  name: string;
  code: ErrorCode;
  message: string;
  stack?: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

/**
 * Error handler function type
 */
export type ErrorHandler = (error: unknown, context: ErrorContext) => void;

/**
 * Error recovery strategy
 */
export interface RecoveryStrategy {
  shouldRetry: boolean;
  delayMs: number;
  maxRetries: number;
  fallback?: () => Promise<unknown>;
}
