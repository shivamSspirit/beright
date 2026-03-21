/**
 * BeRight Data Fabric
 *
 * The single source of truth for all market data across platforms.
 * Aggregates, deduplicates, and provides a unified interface.
 *
 * @author BeRight Protocol
 * @version 3.0.0 - Bloomberg Terminal Architecture
 */

import { DataPlatform, RawMarketData } from '../data/types';
import {
  UnifiedMarket,
  DataFabricQuery,
  DataFabricResponse,
  MarketDetailResponse,
  DataFabricCacheConfig,
  DataFabricCacheStats,
  MarketCategory,
  PlatformMarketData,
} from './types';
import { getActiveProviders, getProvider, getSupportedPlatforms, checkAllProvidersHealth } from './providers';
import { deduplicateMarkets } from './deduplication';
import { matchMarkets } from '../ml/marketMatcher';
import { mlResultsToUnifiedMarkets } from '../ml/adapters';
import {
  isMLMatchingEnabled,
  isLMSRAggregationEnabled,
  getMLConfig,
  mlDebugLog,
} from '../ml/config';
import { canGenerateEmbeddings } from '../ml/embedding';
import { aggregateProbability, type PlatformPriceData } from '../aggregation';

// =============================================================================
// CACHE LAYER
// =============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class DataFabricCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private hits = 0;
  private misses = 0;

  constructor(private config: DataFabricCacheConfig) {
    // Cleanup interval
    setInterval(() => this.cleanup(), 60000);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    if (this.cache.size >= this.config.maxEntries) {
      // Remove oldest entries
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      for (let i = 0; i < entries.length * 0.2; i++) {
        this.cache.delete(entries[i][0]);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.marketsTtl,
    });
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  getStats(): DataFabricCacheStats {
    return {
      entries: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0,
      memorySizeMb: 0, // Would need serialization to calculate
    };
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

// Default cache configuration
const DEFAULT_CACHE_CONFIG: DataFabricCacheConfig = {
  marketsTtl: 30000,       // 30 seconds
  marketDetailTtl: 10000,  // 10 seconds
  searchTtl: 60000,        // 60 seconds
  maxEntries: 10000,
  maxMemoryMb: 100,
  enableRedis: false,
};

// Global cache instance
const cache = new DataFabricCache(DEFAULT_CACHE_CONFIG);

// =============================================================================
// MAIN DATA FABRIC CLASS
// =============================================================================

export class DataFabric {
  private defaultPlatforms: DataPlatform[];

  constructor() {
    this.defaultPlatforms = getSupportedPlatforms();
  }

  /**
   * Fetch unified markets from all platforms
   */
  async getMarkets(query?: DataFabricQuery): Promise<DataFabricResponse> {
    const startTime = Date.now();
    const platforms = query?.platforms || this.defaultPlatforms;
    const limit = query?.limit || 50;

    // Check cache
    const cacheKey = `markets:${JSON.stringify(query || {})}`;
    const cached = cache.get<DataFabricResponse>(cacheKey);
    if (cached) {
      return { ...cached, cacheHit: true };
    }

    // Fetch from all platforms in parallel
    const providers = platforms
      .map(p => getProvider(p))
      .filter((p): p is NonNullable<typeof p> => p !== null);

    const results = await Promise.allSettled(
      providers.map(async (provider) => {
        try {
          if (query?.query) {
            return await provider.searchMarkets(query.query, { limit: limit * 2 });
          }
          return await provider.fetchMarkets({ limit: limit * 2 });
        } catch (error) {
          console.error(`[DataFabric] Error fetching from ${provider.name}:`, error);
          return { platform: provider.name, markets: [], fetchedAt: new Date(), latencyMs: 0, errors: [String(error)] };
        }
      })
    );

    // Collect all markets
    let allMarkets: RawMarketData[] = [];
    const errors: string[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allMarkets.push(...result.value.markets);
        if (result.value.errors) {
          errors.push(...result.value.errors);
        }
      } else {
        errors.push(result.reason?.message || 'Unknown error');
      }
    }

    // Limit raw markets before ML matching to prevent slow processing
    // Sort by volume to keep most relevant markets
    const MAX_MARKETS_FOR_ML = 200;
    if (allMarkets.length > MAX_MARKETS_FOR_ML) {
      console.log(`[DataFabric] Limiting markets from ${allMarkets.length} to ${MAX_MARKETS_FOR_ML} for ML matching`);
      allMarkets = allMarkets
        .sort((a, b) => (b.volume || 0) - (a.volume || 0))
        .slice(0, MAX_MARKETS_FOR_ML);
    }

    // Deduplicate and unify markets
    // ML matching is enabled by default (set ML_MATCHING_DISABLED=true to disable)
    let unified: UnifiedMarket[];
    let matchStats: { avgSimilarity: number };
    let matchMethod: 'ml' | 'jaccard' = 'jaccard';

    if (isMLMatchingEnabled()) {
      mlDebugLog('ML matching enabled, checking embedding availability');

      try {
        const embeddingStatus = await canGenerateEmbeddings();
        mlDebugLog('Embedding status', embeddingStatus);

        if (embeddingStatus.available) {
          console.log(`[DataFabric] Using ML matching (provider: ${embeddingStatus.provider})`);

          const mlConfig = getMLConfig();
          const mlResults = await matchMarkets(allMarkets, mlConfig);

          // Convert ML results to UnifiedMarket format using adapter
          unified = mlResultsToUnifiedMarkets(mlResults, {
            useLMSR: isLMSRAggregationEnabled(),
          });

          matchStats = {
            avgSimilarity: mlResults.length > 0
              ? mlResults.reduce((sum, r) => sum + r.matchConfidence, 0) / mlResults.length
              : 0,
          };
          matchMethod = 'ml';

          mlDebugLog(`ML matched ${allMarkets.length} → ${unified.length} markets`, {
            clusters: mlResults.filter(r => r.markets.length > 1).length,
            orphans: mlResults.filter(r => r.markets.length === 1).length,
            avgConfidence: matchStats.avgSimilarity,
          });
        } else {
          // No embeddings available, fall back to Jaccard
          console.log('[DataFabric] No embedding capability, falling back to Jaccard matching');
          const basicResult = deduplicateMarkets(allMarkets);
          unified = basicResult.unified;
          matchStats = basicResult.matchStats;
        }
      } catch (error) {
        console.error('[DataFabric] ML matching failed, falling back to Jaccard:', error);
        const basicResult = deduplicateMarkets(allMarkets);
        unified = basicResult.unified;
        matchStats = basicResult.matchStats;
      }
    } else {
      mlDebugLog('ML matching disabled, using Jaccard');
      const basicResult = deduplicateMarkets(allMarkets);
      unified = basicResult.unified;
      matchStats = basicResult.matchStats;
    }

    // Apply filters
    let filtered = unified;

    if (query?.category) {
      filtered = filtered.filter(m => m.category === query.category);
    }

    if (query?.categories && query.categories.length > 0) {
      filtered = filtered.filter(m => query.categories!.includes(m.category));
    }

    if (query?.minVolume) {
      filtered = filtered.filter(m => m.totalVolume >= query.minVolume!);
    }

    if (query?.minLiquidity) {
      filtered = filtered.filter(m => m.totalLiquidity >= query.minLiquidity!);
    }

    if (query?.minTrustScore) {
      filtered = filtered.filter(m => m.overallTrustScore >= query.minTrustScore!);
    }

    if (query?.closingWithin) {
      const cutoff = new Date(Date.now() + query.closingWithin * 60 * 60 * 1000);
      filtered = filtered.filter(m => m.closeDate && m.closeDate <= cutoff);
    }

    if (query?.includeArbitrageOnly) {
      filtered = filtered.filter(m => m.arbitrageSpread && m.arbitrageSpread > 0.02);
    }

    if (!query?.includeResolved) {
      filtered = filtered.filter(m => !m.isResolved);
    }

    // Apply sorting
    const sortBy = query?.sortBy || 'volume';
    const sortOrder = query?.sortOrder || 'desc';
    const sortMultiplier = sortOrder === 'desc' ? -1 : 1;

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'volume':
          return (a.totalVolume - b.totalVolume) * sortMultiplier;
        case 'liquidity':
          return (a.totalLiquidity - b.totalLiquidity) * sortMultiplier;
        case 'closing':
          const aClose = a.closeDate?.getTime() || Infinity;
          const bClose = b.closeDate?.getTime() || Infinity;
          return (aClose - bClose) * sortMultiplier;
        case 'trust':
          return (a.overallTrustScore - b.overallTrustScore) * sortMultiplier;
        case 'spread':
          return ((a.arbitrageSpread || 0) - (b.arbitrageSpread || 0)) * sortMultiplier;
        case 'created':
          const aCreated = a.createdAt?.getTime() || 0;
          const bCreated = b.createdAt?.getTime() || 0;
          return (aCreated - bCreated) * sortMultiplier;
        default:
          return 0;
      }
    });

    // Apply pagination
    const offset = query?.offset || 0;
    const paginated = filtered.slice(offset, offset + limit);

    const response: DataFabricResponse = {
      markets: paginated,
      total: filtered.length,
      offset,
      limit,
      hasMore: offset + limit < filtered.length,
      fetchedAt: new Date(),
      latencyMs: Date.now() - startTime,
      sources: platforms,
      cacheHit: false,
      dataQualityScore: matchStats.avgSimilarity * 100,
      warnings: errors.length > 0 ? errors : undefined,
    };

    // Cache the response
    cache.set(cacheKey, response);

    console.log(`[DataFabric] Fetched ${allMarkets.length} raw → ${unified.length} unified → ${paginated.length} returned in ${response.latencyMs}ms`);

    return response;
  }

  /**
   * Get a single market by ID
   */
  async getMarket(marketId: string): Promise<MarketDetailResponse | null> {
    const startTime = Date.now();

    // Check cache
    const cacheKey = `market:${marketId}`;
    const cached = cache.get<MarketDetailResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch all markets and find matching
    const { markets } = await this.getMarkets({ limit: 500 });

    const market = markets.find(m =>
      m.id === marketId ||
      m.slug === marketId ||
      m.platforms.some(p => p.platformId === marketId)
    );

    if (!market) return null;

    // Find related markets (same category, different question)
    const related = markets
      .filter(m =>
        m.id !== market.id &&
        m.category === market.category
      )
      .slice(0, 5);

    const response: MarketDetailResponse = {
      market,
      fetchedAt: new Date(),
      latencyMs: Date.now() - startTime,
      relatedMarkets: related,
    };

    cache.set(cacheKey, response, DEFAULT_CACHE_CONFIG.marketDetailTtl);

    return response;
  }

  /**
   * Search markets by query
   */
  async searchMarkets(query: string, options?: Partial<DataFabricQuery>): Promise<DataFabricResponse> {
    return this.getMarkets({
      ...options,
      query,
    });
  }

  /**
   * Get trending/hot markets
   */
  async getTrendingMarkets(limit: number = 20): Promise<DataFabricResponse> {
    return this.getMarkets({
      limit,
      sortBy: 'volume',
      sortOrder: 'desc',
      minVolume: 1000,
    });
  }

  /**
   * Get arbitrage opportunities
   */
  async getArbitrageOpportunities(minSpread: number = 0.02): Promise<DataFabricResponse> {
    const result = await this.getMarkets({
      limit: 100,
      includeArbitrageOnly: true,
      sortBy: 'spread',
      sortOrder: 'desc',
    });

    // Filter by minimum spread
    result.markets = result.markets.filter(m =>
      m.arbitrageSpread && m.arbitrageSpread >= minSpread
    );

    return result;
  }

  /**
   * Get markets closing soon
   */
  async getClosingSoon(hoursUntilClose: number = 24): Promise<DataFabricResponse> {
    return this.getMarkets({
      closingWithin: hoursUntilClose,
      sortBy: 'closing',
      sortOrder: 'asc',
    });
  }

  /**
   * Get markets by category
   */
  async getMarketsByCategory(category: MarketCategory, limit: number = 30): Promise<DataFabricResponse> {
    return this.getMarkets({
      category,
      limit,
      sortBy: 'volume',
      sortOrder: 'desc',
    });
  }

  /**
   * Health check for all providers
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    providers: Record<DataPlatform, boolean>;
    cacheStats: DataFabricCacheStats;
  }> {
    const providers = await checkAllProvidersHealth();
    const healthyCount = Object.values(providers).filter(v => v).length;

    return {
      healthy: healthyCount > 0,
      providers,
      cacheStats: cache.getStats(),
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    cache.clear();
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let instance: DataFabric | null = null;

/**
 * Get the singleton DataFabric instance
 */
export function getDataFabric(): DataFabric {
  if (!instance) {
    instance = new DataFabric();
  }
  return instance;
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Quick fetch of trending markets
 */
export async function fetchTrendingMarkets(limit: number = 20): Promise<UnifiedMarket[]> {
  const fabric = getDataFabric();
  const result = await fabric.getTrendingMarkets(limit);
  return result.markets;
}

/**
 * Quick search
 */
export async function searchMarkets(query: string, limit: number = 20): Promise<UnifiedMarket[]> {
  const fabric = getDataFabric();
  const result = await fabric.searchMarkets(query, { limit });
  return result.markets;
}

/**
 * Quick arb check
 */
export async function findArbitrageOpportunities(minSpread: number = 0.02): Promise<UnifiedMarket[]> {
  const fabric = getDataFabric();
  const result = await fabric.getArbitrageOpportunities(minSpread);
  return result.markets;
}

// =============================================================================
// EXPORTS
// =============================================================================

export * from './types';
export * from './providers';
export { deduplicateMarkets, quickMatchCheck } from './deduplication';

export default DataFabric;
