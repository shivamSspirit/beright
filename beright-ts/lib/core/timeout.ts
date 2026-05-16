/**
 * Timeout Utilities for BeRight Protocol
 * Request timeout handling with AbortController
 */

import { TimeoutError } from './errors';

/**
 * Default timeout values (in milliseconds)
 */
export const TIMEOUT_DEFAULTS = {
  /** Fast operations like cache lookups */
  FAST: 3_000,
  /** Standard API calls */
  STANDARD: 10_000,
  /** Slow operations like LLM calls */
  SLOW: 30_000,
  /** Very slow operations like batch processing */
  VERY_SLOW: 60_000,
  /** Maximum allowed timeout */
  MAX: 120_000,
} as const;

export type TimeoutPreset = keyof typeof TIMEOUT_DEFAULTS;

/**
 * Options for timeout wrapper
 */
export interface TimeoutOptions {
  timeoutMs: number;
  timeoutMessage?: string;
}

/**
 * Wrap a promise with a timeout
 * Throws TimeoutError if the promise doesn't resolve in time
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  options: TimeoutOptions | number
): Promise<T> {
  const { timeoutMs, timeoutMessage } = typeof options === 'number'
    ? { timeoutMs: options, timeoutMessage: undefined }
    : options;

  if (timeoutMs <= 0) {
    throw new Error('Timeout must be positive');
  }

  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(
        timeoutMessage ?? `Operation timed out after ${timeoutMs}ms`,
        timeoutMs
      ));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

/**
 * Options for fetch with timeout
 */
export interface FetchWithTimeoutOptions extends RequestInit {
  timeoutMs?: number;
  timeoutMessage?: string;
}

/**
 * Fetch with automatic timeout using AbortController
 * More efficient than withTimeout for fetch calls
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const {
    timeoutMs = TIMEOUT_DEFAULTS.STANDARD,
    timeoutMessage,
    signal: externalSignal,
    ...fetchOptions
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Combine with external signal if provided
  if (externalSignal) {
    externalSignal.addEventListener('abort', () => controller.abort());
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(
        timeoutMessage ?? `Request to ${url} timed out after ${timeoutMs}ms`,
        timeoutMs,
        url
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Create an abort controller with automatic timeout
 */
export function createTimeoutController(timeoutMs: number): {
  controller: AbortController;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    controller,
    cleanup: () => clearTimeout(timeoutId),
  };
}

/**
 * Deadline-based timeout (for multi-step operations)
 * Returns milliseconds remaining before deadline
 */
export class Deadline {
  private readonly deadlineMs: number;

  constructor(timeoutMs: number) {
    this.deadlineMs = Date.now() + timeoutMs;
  }

  /**
   * Get remaining time in milliseconds
   */
  remaining(): number {
    return Math.max(0, this.deadlineMs - Date.now());
  }

  /**
   * Check if deadline has passed
   */
  isExpired(): boolean {
    return this.remaining() <= 0;
  }

  /**
   * Throw if deadline has passed
   */
  check(operation?: string): void {
    if (this.isExpired()) {
      throw new TimeoutError(
        operation ? `${operation} exceeded deadline` : 'Operation exceeded deadline',
        0
      );
    }
  }

  /**
   * Get timeout options for remaining time
   */
  toOptions(minTimeoutMs: number = 1000): TimeoutOptions {
    const remaining = this.remaining();
    return {
      timeoutMs: Math.max(remaining, minTimeoutMs),
      timeoutMessage: `Operation exceeded deadline (${remaining}ms remaining)`,
    };
  }
}
