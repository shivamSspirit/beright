/**
 * Request Deduplication for BeRight Protocol
 * Prevents duplicate concurrent requests to the same resource
 */

/**
 * In-flight request tracker
 */
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Deduplication statistics
 */
const stats = {
  hits: 0,
  misses: 0,
  errors: 0,
};

/**
 * Deduplicate concurrent requests with the same key
 * If a request with the same key is already in-flight, returns the existing promise
 *
 * @example
 * // These two calls made simultaneously will only result in one actual API call
 * const [result1, result2] = await Promise.all([
 *   deduplicateRequest('market:123', () => fetchMarket('123')),
 *   deduplicateRequest('market:123', () => fetchMarket('123')),
 * ]);
 */
export async function deduplicateRequest<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  // Check if request is already in-flight
  const existing = inFlight.get(key);
  if (existing) {
    stats.hits++;
    return existing as Promise<T>;
  }

  stats.misses++;

  // Create new request and track it
  const promise = fn()
    .catch((error) => {
      stats.errors++;
      throw error;
    })
    .finally(() => {
      // Remove from in-flight when done (success or failure)
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

/**
 * Create a key generator for consistent cache keys
 */
export function createKeyGenerator(prefix: string) {
  return (...parts: (string | number | boolean | null | undefined)[]): string => {
    const sanitized = parts
      .filter((p) => p !== null && p !== undefined)
      .map((p) => String(p).replace(/:/g, '_'));
    return `${prefix}:${sanitized.join(':')}`;
  };
}

/**
 * Get deduplication statistics
 */
export function getDeduplicationStats(): {
  hits: number;
  misses: number;
  errors: number;
  hitRate: number;
  currentInFlight: number;
} {
  const total = stats.hits + stats.misses;
  return {
    ...stats,
    hitRate: total > 0 ? stats.hits / total : 0,
    currentInFlight: inFlight.size,
  };
}

/**
 * Reset deduplication statistics
 */
export function resetDeduplicationStats(): void {
  stats.hits = 0;
  stats.misses = 0;
  stats.errors = 0;
}

/**
 * Clear all in-flight requests (for testing)
 */
export function clearInFlight(): void {
  inFlight.clear();
}

/**
 * Batch multiple requests and deduplicate
 * Useful when you need to fetch multiple items but want to deduplicate each
 */
export async function batchDeduplicatedRequests<T, K extends string | number>(
  items: K[],
  keyPrefix: string,
  fetchFn: (item: K) => Promise<T>
): Promise<Map<K, T>> {
  const results = new Map<K, T>();

  await Promise.all(
    items.map(async (item) => {
      const key = `${keyPrefix}:${item}`;
      try {
        const result = await deduplicateRequest(key, () => fetchFn(item));
        results.set(item, result);
      } catch {
        // Individual failures don't break the batch
      }
    })
  );

  return results;
}

/**
 * Debounced request - collapses multiple rapid calls into one
 * Unlike deduplicateRequest which handles concurrent calls,
 * this handles rapid sequential calls
 */
export function createDebouncedRequest<T>(
  fn: () => Promise<T>,
  delayMs: number
): () => Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null;
  let pendingPromise: Promise<T> | null = null;
  let resolvers: Array<{
    resolve: (value: T) => void;
    reject: (error: unknown) => void;
  }> = [];

  return () => {
    return new Promise<T>((resolve, reject) => {
      resolvers.push({ resolve, reject });

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(async () => {
        if (pendingPromise) {
          // If a request is already in progress, wait for it
          try {
            const result = await pendingPromise;
            resolvers.forEach(({ resolve }) => resolve(result));
          } catch (error) {
            resolvers.forEach(({ reject }) => reject(error));
          }
        } else {
          // Start new request
          pendingPromise = fn();
          try {
            const result = await pendingPromise;
            resolvers.forEach(({ resolve }) => resolve(result));
          } catch (error) {
            resolvers.forEach(({ reject }) => reject(error));
          } finally {
            pendingPromise = null;
          }
        }
        resolvers = [];
        timeoutId = null;
      }, delayMs);
    });
  };
}

/**
 * Memoized request with TTL
 * Caches results and returns cached value if not expired
 */
export function createMemoizedRequest<T, A extends unknown[]>(
  fn: (...args: A) => Promise<T>,
  options: {
    keyFn: (...args: A) => string;
    ttlMs: number;
  }
): (...args: A) => Promise<T> {
  const cache = new Map<string, { value: T; expiresAt: number }>();

  return async (...args: A): Promise<T> => {
    const key = options.keyFn(...args);
    const now = Date.now();

    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    // Use deduplication for concurrent calls
    const result = await deduplicateRequest(key, () => fn(...args));

    cache.set(key, {
      value: result,
      expiresAt: now + options.ttlMs,
    });

    return result;
  };
}
