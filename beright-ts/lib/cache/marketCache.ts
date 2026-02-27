/**
 * Market Data Cache
 *
 * High-performance caching layer for validated market data.
 * Features:
 * - LRU eviction when cache is full
 * - TTL-based expiration
 * - Hit rate tracking
 * - Automatic cleanup
 *
 * @author BeRight Protocol
 * @version 1.0.0
 */

import { ValidatedMarket, CacheEntry, CacheConfig } from '../data/types';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Default cache configuration
 */
const DEFAULT_CONFIG: CacheConfig = {
  ttlMs: 5 * 60 * 1000,      // 5 minutes TTL
  maxEntries: 1000,           // Max 1000 entries
  cleanupIntervalMs: 60000,   // Cleanup every minute
};

// =============================================================================
// CACHE IMPLEMENTATION
// =============================================================================

/**
 * LRU Cache with TTL for validated market data
 */
export class MarketCache {
  private cache: Map<string, CacheEntry<ValidatedMarket>> = new Map();
  private config: CacheConfig;
  private hits: number = 0;
  private misses: number = 0;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanup();
  }

  /**
   * Generate cache key for a market
   */
  private getKey(platform: string, marketId: string): string {
    return `${platform}:${marketId}`.toLowerCase();
  }

  /**
   * Get a market from cache
   */
  get(platform: string, marketId: string): ValidatedMarket | null {
    const key = this.getKey(platform, marketId);
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt.getTime()) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Update hit count and move to end (LRU)
    entry.hits++;
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;

    return entry.data;
  }

  /**
   * Set a market in cache
   */
  set(market: ValidatedMarket, ttlMs?: number): void {
    const key = this.getKey(market.platform, market.id);
    const now = new Date();
    const ttl = ttlMs || this.config.ttlMs;

    // Evict if at capacity
    if (this.cache.size >= this.config.maxEntries) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data: market,
      cachedAt: now,
      expiresAt: new Date(now.getTime() + ttl),
      source: market.source,
      hits: 0,
    });
  }

  /**
   * Set multiple markets
   */
  setMany(markets: ValidatedMarket[], ttlMs?: number): void {
    for (const market of markets) {
      this.set(market, ttlMs);
    }
  }

  /**
   * Get multiple markets by platform
   */
  getByPlatform(platform: string): ValidatedMarket[] {
    const results: ValidatedMarket[] = [];
    const prefix = `${platform.toLowerCase()}:`;

    for (const [key, entry] of this.cache.entries()) {
      if (key.startsWith(prefix)) {
        if (Date.now() <= entry.expiresAt.getTime()) {
          results.push(entry.data);
        }
      }
    }

    return results;
  }

  /**
   * Get all cached markets
   */
  getAll(): ValidatedMarket[] {
    const results: ValidatedMarket[] = [];
    const now = Date.now();

    for (const entry of this.cache.values()) {
      if (now <= entry.expiresAt.getTime()) {
        results.push(entry.data);
      }
    }

    return results;
  }

  /**
   * Check if a market is cached and fresh
   */
  has(platform: string, marketId: string): boolean {
    const key = this.getKey(platform, marketId);
    const entry = this.cache.get(key);

    if (!entry) return false;

    return Date.now() <= entry.expiresAt.getTime();
  }

  /**
   * Delete a market from cache
   */
  delete(platform: string, marketId: string): boolean {
    const key = this.getKey(platform, marketId);
    return this.cache.delete(key);
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    hits: number;
    misses: number;
  } {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;

    return {
      size: this.cache.size,
      maxSize: this.config.maxEntries,
      hitRate,
      hits: this.hits,
      misses: this.misses,
    };
  }

  /**
   * Evict oldest entry (LRU)
   */
  private evictOldest(): void {
    // Map maintains insertion order, so first entry is oldest
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt.getTime()) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanup(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);

    // Don't keep process alive just for cleanup
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop cleanup timer
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// =============================================================================
// SEARCH CACHE
// =============================================================================

/**
 * Cache for search results
 */
export class SearchCache {
  private cache: Map<string, CacheEntry<ValidatedMarket[]>> = new Map();
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ttlMs: 2 * 60 * 1000,  // 2 minute TTL for searches
      maxEntries: 100,        // Max 100 search results
      ...config,
    };
  }

  /**
   * Generate cache key for a search
   */
  private getKey(query: string, platforms?: string[]): string {
    const platformsKey = platforms ? platforms.sort().join(',') : 'all';
    return `${query.toLowerCase().trim()}:${platformsKey}`;
  }

  /**
   * Get cached search results
   */
  get(query: string, platforms?: string[]): ValidatedMarket[] | null {
    const key = this.getKey(query, platforms);
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt.getTime()) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.data;
  }

  /**
   * Cache search results
   */
  set(query: string, markets: ValidatedMarket[], platforms?: string[]): void {
    const key = this.getKey(query, platforms);
    const now = new Date();

    // Evict oldest if at capacity
    if (this.cache.size >= this.config.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data: markets,
      cachedAt: now,
      expiresAt: new Date(now.getTime() + this.config.ttlMs),
      source: 'cache',
      hits: 0,
    });
  }

  /**
   * Clear search cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }
}

// =============================================================================
// SINGLETON INSTANCES
// =============================================================================

/**
 * Global market cache instance
 */
export const marketCache = new MarketCache();

/**
 * Global search cache instance
 */
export const searchCache = new SearchCache();

// =============================================================================
// EXPORTS
// =============================================================================

export default marketCache;
