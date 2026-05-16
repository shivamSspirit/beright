/**
 * Retry Utilities for BeRight Protocol
 * Exponential backoff with jitter and configurable strategies
 */

import { isBeRightError, RateLimitError } from './errors';
import { ErrorCode } from '../../types/api';

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay before first retry (ms) */
  initialDelayMs: number;
  /** Maximum delay between retries (ms) */
  maxDelayMs: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Add random jitter to prevent thundering herd */
  jitter: boolean;
  /** Error codes that should trigger retry */
  retryableErrors: ErrorCode[];
  /** Custom function to determine if error is retryable */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Callback on each retry attempt */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

/**
 * Default retry options
 */
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30_000,
  backoffMultiplier: 2,
  jitter: true,
  retryableErrors: [
    ErrorCode.NETWORK_ERROR,
    ErrorCode.TIMEOUT,
    ErrorCode.RATE_LIMITED,
    ErrorCode.SERVICE_UNAVAILABLE,
  ],
};

/**
 * Preset retry configurations
 */
export const RETRY_PRESETS = {
  /** Aggressive retry for critical operations */
  AGGRESSIVE: {
    ...DEFAULT_RETRY_OPTIONS,
    maxRetries: 5,
    initialDelayMs: 500,
  },
  /** Conservative retry to avoid overwhelming services */
  CONSERVATIVE: {
    ...DEFAULT_RETRY_OPTIONS,
    maxRetries: 2,
    initialDelayMs: 2000,
    maxDelayMs: 10_000,
  },
  /** No retry */
  NONE: {
    ...DEFAULT_RETRY_OPTIONS,
    maxRetries: 0,
  },
} as const;

/**
 * Calculate delay for a given retry attempt
 */
export function calculateDelay(
  attempt: number,
  options: Pick<RetryOptions, 'initialDelayMs' | 'maxDelayMs' | 'backoffMultiplier' | 'jitter'>
): number {
  const exponentialDelay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, options.maxDelayMs);

  if (options.jitter) {
    // Add ±25% jitter
    const jitterFactor = 0.75 + Math.random() * 0.5;
    return Math.round(cappedDelay * jitterFactor);
  }

  return cappedDelay;
}

/**
 * Sleep for a given duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determine if an error should trigger a retry
 */
function isRetryable(error: unknown, options: RetryOptions, attempt: number): boolean {
  // Custom retry logic takes precedence
  if (options.shouldRetry) {
    return options.shouldRetry(error, attempt);
  }

  // Check if it's a BeRightError with retryable flag
  if (isBeRightError(error)) {
    return error.retryable && options.retryableErrors.includes(error.code);
  }

  // Check for common retryable error patterns
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('socket hang up')
    );
  }

  return false;
}

/**
 * Get delay from rate limit error
 */
function getRateLimitDelay(error: unknown): number | null {
  if (error instanceof RateLimitError) {
    return error.retryAfterMs;
  }
  return null;
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if we've exhausted attempts
      if (attempt >= opts.maxRetries) {
        break;
      }

      // Check if error is retryable
      if (!isRetryable(error, opts, attempt)) {
        throw error;
      }

      // Calculate delay (respect rate limit headers if present)
      let delayMs = getRateLimitDelay(error) ?? calculateDelay(attempt, opts);

      // Notify about retry
      opts.onRetry?.(error, attempt + 1, delayMs);

      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * Retry decorator for class methods
 */
export function Retryable(options: Partial<RetryOptions> = {}) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      return withRetry(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}

/**
 * Create a retry wrapper with preconfigured options
 */
export function createRetrier(baseOptions: Partial<RetryOptions> = {}) {
  return function retry<T>(
    fn: () => Promise<T>,
    overrideOptions: Partial<RetryOptions> = {}
  ): Promise<T> {
    return withRetry(fn, { ...baseOptions, ...overrideOptions });
  };
}

/**
 * Retry result with metadata
 */
export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: unknown;
  attempts: number;
  totalDelayMs: number;
}

/**
 * Execute with retry and return detailed result
 */
export async function withRetryResult<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<RetryResult<T>> {
  const opts: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let attempts = 0;
  let totalDelayMs = 0;

  const wrappedOptions: Partial<RetryOptions> = {
    ...opts,
    onRetry: (error, attempt, delayMs) => {
      totalDelayMs += delayMs;
      opts.onRetry?.(error, attempt, delayMs);
    },
  };

  try {
    const originalFn = fn;
    const data = await withRetry(() => {
      attempts++;
      return originalFn();
    }, wrappedOptions);

    return {
      success: true,
      data,
      attempts,
      totalDelayMs,
    };
  } catch (error) {
    return {
      success: false,
      error,
      attempts,
      totalDelayMs,
    };
  }
}
