/**
 * BeRight On-Chain Retry Logic
 *
 * Handles transient failures when committing to Solana
 */

import { commitPrediction, resolvePrediction, Direction, MemoTxResult } from './index';

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Retry a function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      console.warn(`Attempt ${attempt}/${config.maxAttempts} failed:`, error.message);

      if (attempt < config.maxAttempts) {
        const delay = calculateDelay(attempt, config);
        console.log(`Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

/**
 * Commit prediction with retry logic
 */
export async function commitPredictionWithRetry(
  userPubkey: string,
  marketId: string,
  probability: number,
  direction: Direction,
  config?: Partial<RetryConfig>
): Promise<MemoTxResult> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

  try {
    const result = await retryWithBackoff(
      async () => {
        const res = await commitPrediction(userPubkey, marketId, probability, direction);
        if (!res.success) {
          throw new Error(res.error || 'Commit failed');
        }
        return res;
      },
      retryConfig
    );

    return result;
  } catch (error: any) {
    console.error('commitPredictionWithRetry: All attempts failed');
    return {
      success: false,
      error: error.message || 'All retry attempts failed',
    };
  }
}

/**
 * Resolve prediction with retry logic
 */
export async function resolvePredictionWithRetry(
  commitTx: string,
  probability: number,
  direction: Direction,
  outcome: boolean,
  config?: Partial<RetryConfig>
): Promise<MemoTxResult> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

  try {
    const result = await retryWithBackoff(
      async () => {
        const res = await resolvePrediction(commitTx, probability, direction, outcome);
        if (!res.success) {
          throw new Error(res.error || 'Resolution failed');
        }
        return res;
      },
      retryConfig
    );

    return result;
  } catch (error: any) {
    console.error('resolvePredictionWithRetry: All attempts failed');
    return {
      success: false,
      error: error.message || 'All retry attempts failed',
    };
  }
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: any): boolean {
  const message = error?.message?.toLowerCase() || '';

  // Retryable errors
  const retryablePatterns = [
    'network',
    'timeout',
    'econnrefused',
    'enotfound',
    'blockhash not found',
    'transaction was not confirmed',
    '429', // Rate limit
    '503', // Service unavailable
  ];

  return retryablePatterns.some(pattern => message.includes(pattern));
}

/**
 * Smart retry - only retry if error is retryable
 */
export async function smartRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if we should retry
      const shouldRetry = isRetryableError(error);

      if (!shouldRetry) {
        console.error('Non-retryable error encountered:', error.message);
        throw error;
      }

      console.warn(`Attempt ${attempt}/${retryConfig.maxAttempts} failed (retryable):`, error.message);

      if (attempt < retryConfig.maxAttempts) {
        const delay = calculateDelay(attempt, retryConfig);
        console.log(`Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}
