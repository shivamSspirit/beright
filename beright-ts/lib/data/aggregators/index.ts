/**
 * Unified Aggregator Layer
 *
 * Combines multiple data sources with automatic failover:
 * 1. PMXT (primary - open source, free)
 * 2. PolyRouter (secondary - free beta)
 * 3. Direct APIs (fallback)
 *
 * Features:
 * - Automatic failover between sources
 * - Deduplication across sources
 * - Source attribution for all data
 * - Health monitoring
 *
 * @author BeRight Protocol
 * @version 1.0.0
 */

import {
  RawMarketData,
  DataPlatform,
  DataSource,
  FetchOptions,
  AggregatorResponse,
  MarketAggregator,
} from '../types';

import pmxtAggregator, { PMXT_PLATFORMS } from './pmxt';
import polyRouterAggregator, { POLYROUTER_PLATFORMS } from './polyrouter';
import directAggregator, { DIRECT_PLATFORMS } from './direct';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Aggregator priority order
 * Direct APIs are most reliable, then PMXT (when working), then PolyRouter
 */
const AGGREGATOR_PRIORITY: MarketAggregator[] = [
  directAggregator,    // Most reliable - uses same APIs as markets.ts
  pmxtAggregator,      // Secondary - open source aggregator
  polyRouterAggregator, // Tertiary - requires API key now
];

/**
 * All supported platforms across all aggregators
 */
const ALL_SUPPORTED_PLATFORMS: DataPlatform[] = [
  ...new Set([...DIRECT_PLATFORMS, ...PMXT_PLATFORMS, ...POLYROUTER_PLATFORMS])
];

/**
 * Health status cache
 */
const healthCache: Map<DataSource, { healthy: boolean; checkedAt: Date }> = new Map();
const HEALTH_CACHE_TTL = 60000; // 1 minute

// =============================================================================
// HEALTH CHECKING
// =============================================================================

/**
 * Check if an aggregator is healthy (with caching)
 */
async function isAggregatorHealthy(aggregator: MarketAggregator): Promise<boolean> {
  const cached = healthCache.get(aggregator.name);

  if (cached && Date.now() - cached.checkedAt.getTime() < HEALTH_CACHE_TTL) {
    return cached.healthy;
  }

  try {
    const healthy = await aggregator.isHealthy();
    healthCache.set(aggregator.name, { healthy, checkedAt: new Date() });
    return healthy;
  } catch {
    healthCache.set(aggregator.name, { healthy: false, checkedAt: new Date() });
    return false;
  }
}

/**
 * Get the first healthy aggregator
 */
async function getHealthyAggregator(): Promise<MarketAggregator | null> {
  for (const aggregator of AGGREGATOR_PRIORITY) {
    if (await isAggregatorHealthy(aggregator)) {
      return aggregator;
    }
  }
  return null;
}

// =============================================================================
// DEDUPLICATION
// =============================================================================

/**
 * Generate a unique key for a market (for deduplication)
 */
function getMarketKey(market: RawMarketData): string {
  // Use platform + id as primary key
  const key = `${market.platform}:${market.id}`;
  return key.toLowerCase();
}

/**
 * Deduplicate markets, preferring ones with more data
 */
function deduplicateMarkets(markets: RawMarketData[]): RawMarketData[] {
  const seen = new Map<string, RawMarketData>();

  for (const market of markets) {
    const key = getMarketKey(market);
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, market);
      continue;
    }

    // Prefer market with:
    // 1. More volume
    // 2. More recent fetch time
    // 3. More complete data (has orderbook)
    const existingScore = (existing.volume || 0) +
      (existing.yesBid ? 10 : 0) +
      (existing.fetchedAt.getTime() / 1000000000);

    const newScore = (market.volume || 0) +
      (market.yesBid ? 10 : 0) +
      (market.fetchedAt.getTime() / 1000000000);

    if (newScore > existingScore) {
      seen.set(key, market);
    }
  }

  return Array.from(seen.values());
}

// =============================================================================
// UNIFIED AGGREGATOR
// =============================================================================

/**
 * Unified aggregator that combines all sources
 */
export const unifiedAggregator: MarketAggregator = {
  name: 'pmxt', // Default to PMXT as primary source

  supportedPlatforms: ALL_SUPPORTED_PLATFORMS,

  /**
   * Fetch markets with automatic failover
   */
  async fetchMarkets(options: FetchOptions = {}): Promise<AggregatorResponse> {
    const startTime = Date.now();
    const fetchedAt = new Date();
    const allErrors: string[] = [];
    let allMarkets: RawMarketData[] = [];
    let usedSource: DataSource = 'unknown';

    // Try each aggregator in priority order
    for (const aggregator of AGGREGATOR_PRIORITY) {
      try {
        // Check if this aggregator supports requested platforms
        const requestedPlatforms = options.platforms || [];
        const supportedPlatforms = requestedPlatforms.filter(p =>
          aggregator.supportedPlatforms.includes(p)
        );

        // Skip if this aggregator doesn't support any requested platforms
        if (requestedPlatforms.length > 0 && supportedPlatforms.length === 0) {
          continue;
        }

        // Try to fetch
        const response = await aggregator.fetchMarkets({
          ...options,
          platforms: supportedPlatforms.length > 0 ? supportedPlatforms : undefined,
        });

        if (response.markets.length > 0) {
          allMarkets.push(...response.markets);
          usedSource = aggregator.name;

          if (response.errors) {
            allErrors.push(...response.errors);
          }

          // If we have enough data, stop trying other sources
          if (allMarkets.length >= (options.limit || 20)) {
            break;
          }
        }
      } catch (error) {
        allErrors.push(`${aggregator.name}: ${error}`);
      }
    }

    // Deduplicate
    allMarkets = deduplicateMarkets(allMarkets);

    // Sort by volume
    allMarkets.sort((a, b) => (b.volume || 0) - (a.volume || 0));

    // Apply limit
    if (options.limit) {
      allMarkets = allMarkets.slice(0, options.limit);
    }

    return {
      source: usedSource,
      markets: allMarkets,
      fetchedAt,
      latencyMs: Date.now() - startTime,
      errors: allErrors.length > 0 ? allErrors : undefined,
    };
  },

  /**
   * Search markets with automatic failover
   */
  async searchMarkets(query: string, options: FetchOptions = {}): Promise<AggregatorResponse> {
    const startTime = Date.now();
    const fetchedAt = new Date();
    const allErrors: string[] = [];
    let allMarkets: RawMarketData[] = [];
    let usedSource: DataSource = 'unknown';

    // Try each aggregator
    for (const aggregator of AGGREGATOR_PRIORITY) {
      try {
        const response = await aggregator.searchMarkets(query, options);

        if (response.markets.length > 0) {
          allMarkets.push(...response.markets);
          usedSource = aggregator.name;

          if (response.errors) {
            allErrors.push(...response.errors);
          }

          // If we have enough results, stop
          if (allMarkets.length >= (options.limit || 30)) {
            break;
          }
        }
      } catch (error) {
        allErrors.push(`${aggregator.name}: ${error}`);
      }
    }

    // Deduplicate
    allMarkets = deduplicateMarkets(allMarkets);

    // Apply limit
    if (options.limit) {
      allMarkets = allMarkets.slice(0, options.limit);
    }

    return {
      source: usedSource,
      markets: allMarkets,
      fetchedAt,
      latencyMs: Date.now() - startTime,
      errors: allErrors.length > 0 ? allErrors : undefined,
    };
  },

  /**
   * Get hot markets with automatic failover
   */
  async getHotMarkets(limit: number = 20): Promise<AggregatorResponse> {
    const startTime = Date.now();
    const fetchedAt = new Date();
    const allErrors: string[] = [];
    let allMarkets: RawMarketData[] = [];
    let usedSource: DataSource = 'unknown';

    // Try each aggregator
    for (const aggregator of AGGREGATOR_PRIORITY) {
      try {
        const response = await aggregator.getHotMarkets(limit);

        if (response.markets.length > 0) {
          allMarkets.push(...response.markets);
          usedSource = aggregator.name;

          if (response.errors) {
            allErrors.push(...response.errors);
          }

          // If we have enough, stop
          if (allMarkets.length >= limit) {
            break;
          }
        }
      } catch (error) {
        allErrors.push(`${aggregator.name}: ${error}`);
      }
    }

    // Deduplicate and sort by volume
    allMarkets = deduplicateMarkets(allMarkets);
    allMarkets.sort((a, b) => (b.volume || 0) - (a.volume || 0));

    return {
      source: usedSource,
      markets: allMarkets.slice(0, limit),
      fetchedAt,
      latencyMs: Date.now() - startTime,
      errors: allErrors.length > 0 ? allErrors : undefined,
    };
  },

  /**
   * Health check - at least one aggregator must be healthy
   */
  async isHealthy(): Promise<boolean> {
    const aggregator = await getHealthyAggregator();
    return aggregator !== null;
  },
};

// =============================================================================
// EXPORTS
// =============================================================================

export { pmxtAggregator, polyRouterAggregator, directAggregator };
export { ALL_SUPPORTED_PLATFORMS as SUPPORTED_PLATFORMS };
export default unifiedAggregator;
