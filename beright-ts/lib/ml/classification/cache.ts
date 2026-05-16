/**
 * Classification Cache
 *
 * LRU cache for classification results with TTL support.
 * Reduces LLM API calls and improves response latency.
 *
 * @author BeRight Protocol
 */

import { ClassificationResult, MatchRelationType } from './types';

// =============================================================================
// TYPES
// =============================================================================

interface CacheEntry {
  result: Omit<ClassificationResult, 'processingTimeMs' | 'cached'>;
  timestamp: number;
}

interface CacheConfig {
  ttlMs: number;
  maxSize: number;
}

interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  byType: Record<MatchRelationType, number>;
}

// =============================================================================
// CACHE IMPLEMENTATION
// =============================================================================

/**
 * LRU Cache with TTL for classification results
 */
export class ClassificationCache {
  private cache: Map<string, CacheEntry>;
  private config: CacheConfig;
  private hits: number = 0;
  private misses: number = 0;
  private typeCount: Record<MatchRelationType, number> = {
    exact: 0,
    related: 0,
    opposite: 0,
    unrelated: 0,
  };

  constructor(config: CacheConfig) {
    this.cache = new Map();
    this.config = config;
  }

  /**
   * Get cached classification result
   */
  get(key: string): Omit<ClassificationResult, 'processingTimeMs' | 'cached'> | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.config.ttlMs) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.hits++;
    return entry.result;
  }

  /**
   * Set classification result in cache
   */
  set(key: string, result: Omit<ClassificationResult, 'processingTimeMs' | 'cached'>): void {
    // Evict oldest entries if at capacity
    while (this.cache.size >= this.config.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        const oldEntry = this.cache.get(oldestKey);
        if (oldEntry) {
          this.typeCount[oldEntry.result.type]--;
        }
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });

    this.typeCount[result.type]++;
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() - entry.timestamp > this.config.ttlMs) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.typeCount[entry.result.type]--;
    }
    return this.cache.delete(key);
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache hit rate
   */
  getHitRate(): number {
    const total = this.hits + this.misses;
    if (total === 0) return 0;
    return this.hits / total;
  }

  /**
   * Get detailed cache statistics
   */
  getStats(): CacheStats {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.getHitRate(),
      byType: { ...this.typeCount },
    };
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.typeCount = {
      exact: 0,
      related: 0,
      opposite: 0,
      unrelated: 0,
    };
  }

  /**
   * Prune expired entries
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.ttlMs) {
        this.typeCount[entry.result.type]--;
        this.cache.delete(key);
        pruned++;
      }
    }

    return pruned;
  }

  /**
   * Get all exact match entries (for arbitrage)
   */
  getExactMatches(): Array<{ key: string; result: Omit<ClassificationResult, 'processingTimeMs' | 'cached'> }> {
    const matches: Array<{ key: string; result: Omit<ClassificationResult, 'processingTimeMs' | 'cached'> }> = [];
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp <= this.config.ttlMs && entry.result.type === 'exact') {
        matches.push({ key, result: entry.result });
      }
    }

    return matches;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let cacheInstance: ClassificationCache | null = null;

/**
 * Get or create the classification cache singleton
 */
export function getClassificationCache(config?: Partial<CacheConfig>): ClassificationCache {
  if (!cacheInstance) {
    cacheInstance = new ClassificationCache({
      ttlMs: config?.ttlMs ?? 24 * 60 * 60 * 1000, // 24 hours default
      maxSize: config?.maxSize ?? 10000,
    });
  }
  return cacheInstance;
}

/**
 * Reset the cache singleton (for testing)
 */
export function resetClassificationCache(): void {
  if (cacheInstance) {
    cacheInstance.clear();
  }
  cacheInstance = null;
}
