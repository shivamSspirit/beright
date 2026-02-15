/**
 * Result Type - Functional error handling for BeRight Protocol
 *
 * Instead of throwing exceptions, functions return Result<T, E> which
 * forces callers to handle both success and error cases explicitly.
 *
 * Usage:
 *   const result = await predictionService.makePrediction(input);
 *   if (result.ok) {
 *     console.log(result.value); // Prediction
 *   } else {
 *     console.error(result.error); // AppError
 *   }
 */

import type { AppError } from '../errors/AppError';

/**
 * Success result type
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/**
 * Error result type
 */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * Result type - discriminated union for success/error states
 */
export type Result<T, E = AppError> = Ok<T> | Err<E>;

/**
 * Result helper functions
 */
export const Result = {
  /**
   * Create a successful result
   */
  ok<T>(value: T): Ok<T> {
    return { ok: true, value };
  },

  /**
   * Create an error result
   */
  err<E>(error: E): Err<E> {
    return { ok: false, error };
  },

  /**
   * Check if result is successful
   */
  isOk<T, E>(result: Result<T, E>): result is Ok<T> {
    return result.ok;
  },

  /**
   * Check if result is an error
   */
  isErr<T, E>(result: Result<T, E>): result is Err<E> {
    return !result.ok;
  },

  /**
   * Map the success value
   */
  map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
    if (result.ok === false) {
      return result;
    }
    return { ok: true, value: fn(result.value) };
  },

  /**
   * Map the error value
   */
  mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
    if (result.ok === false) {
      return { ok: false, error: fn(result.error) };
    }
    return { ok: true, value: result.value };
  },

  /**
   * Flat map (chain) - for composing async operations
   */
  async flatMap<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => Promise<Result<U, E>>
  ): Promise<Result<U, E>> {
    if (result.ok === false) {
      return result;
    }
    return fn(result.value);
  },

  /**
   * Get value or default
   */
  unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
    if (result.ok) {
      return result.value;
    }
    return defaultValue;
  },

  /**
   * Get value or throw (use sparingly, only at boundaries)
   */
  unwrap<T, E>(result: Result<T, E>): T {
    if (result.ok === false) {
      throw result.error;
    }
    return result.value;
  },

  /**
   * Get error or throw (use sparingly)
   */
  unwrapErr<T, E>(result: Result<T, E>): E {
    if (result.ok === false) {
      return result.error;
    }
    throw new Error('Called unwrapErr on Ok result');
  },

  /**
   * Convert a Promise that may throw to a Result
   */
  async fromPromise<T, E = Error>(
    promise: Promise<T>,
    errorMapper?: (error: unknown) => E
  ): Promise<Result<T, E>> {
    try {
      const value = await promise;
      return { ok: true, value };
    } catch (error) {
      if (errorMapper) {
        return { ok: false, error: errorMapper(error) };
      }
      return { ok: false, error: error as E };
    }
  },

  /**
   * Convert a function that may throw to a Result
   */
  fromTry<T, E = Error>(
    fn: () => T,
    errorMapper?: (error: unknown) => E
  ): Result<T, E> {
    try {
      const value = fn();
      return { ok: true, value };
    } catch (error) {
      if (errorMapper) {
        return { ok: false, error: errorMapper(error) };
      }
      return { ok: false, error: error as E };
    }
  },

  /**
   * Combine multiple results into one
   * Returns first error encountered or array of all values
   */
  all<T, E>(results: Result<T, E>[]): Result<T[], E> {
    const values: T[] = [];
    for (const result of results) {
      if (result.ok === false) {
        return result;
      }
      values.push(result.value);
    }
    return { ok: true, value: values };
  },

  /**
   * Execute side effect on success without changing the result
   */
  tap<T, E>(result: Result<T, E>, fn: (value: T) => void): Result<T, E> {
    if (result.ok) {
      fn(result.value);
    }
    return result;
  },

  /**
   * Execute side effect on error without changing the result
   */
  tapErr<T, E>(result: Result<T, E>, fn: (error: E) => void): Result<T, E> {
    if (result.ok === false) {
      fn(result.error);
    }
    return result;
  },
};

/**
 * Type guard for narrowing Result to success
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

/**
 * Type guard for narrowing Result to error
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}

/**
 * AsyncResult - convenience type for async operations
 */
export type AsyncResult<T, E = AppError> = Promise<Result<T, E>>;

export default Result;
