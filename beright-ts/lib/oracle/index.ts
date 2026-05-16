/**
 * BeRight Probability Oracle
 *
 * Main entry point for the oracle system.
 * Provides high-level functions for fetching probability feeds.
 *
 * Usage:
 *   import { getFeed, getFeeds, getOracleHealth } from '@/lib/oracle';
 *
 *   const feed = await getFeed('btc-100k-2025');
 *   const feeds = await getFeeds({ category: 'crypto', minConfidence: 0.6 });
 */

import { getDataFabric, type DataFabricQuery } from '../dataFabric';
import type { MarketCategory } from '../dataFabric/types';
import {
  marketToFeed,
  marketsToFeeds,
  getCachedFeed,
  cacheFeed,
  clearFeedCache,
  getFeedCacheStats,
  sortByConfidence,
  sortByVolume,
  getQualityScore,
} from './feed';
import { quickConfidenceScore } from './confidence';
import type {
  ProbabilityFeed,
  ConfidenceBreakdown,
  FeedResponse,
  BatchFeedsResponse,
  BatchFeedsRequest,
  OracleHealthResponse,
  OracleConfig,
  OracleMetrics,
} from './types';
import { DEFAULT_ORACLE_CONFIG } from './types';

// Re-export all types
export * from './types';
export * from './confidence';
export * from './feed';

// ============================================================================
// Oracle Metrics
// ============================================================================

const metrics: OracleMetrics = {
  requestCount: 0,
  cacheHits: 0,
  cacheMisses: 0,
  avgLatencyMs: 0,
  errorCount: 0,
  startTime: new Date(),
};

function recordRequest(latencyMs: number, cacheHit: boolean, error?: string): void {
  metrics.requestCount++;
  if (cacheHit) {
    metrics.cacheHits++;
  } else {
    metrics.cacheMisses++;
  }
  // Rolling average
  metrics.avgLatencyMs =
    (metrics.avgLatencyMs * (metrics.requestCount - 1) + latencyMs) / metrics.requestCount;

  if (error) {
    metrics.errorCount++;
    metrics.lastError = error;
  }
}

export function getOracleMetrics(): OracleMetrics {
  return { ...metrics };
}

// ============================================================================
// Single Feed
// ============================================================================

/**
 * Get a single probability feed by market ID
 *
 * @param marketId - BeRight canonical market ID
 * @param config - Oracle configuration
 * @returns Feed response with probability and confidence
 */
export async function getFeed(
  marketId: string,
  config: OracleConfig = DEFAULT_ORACLE_CONFIG
): Promise<FeedResponse> {
  const startTime = Date.now();
  let cacheHit = false;

  try {
    // Check cache first
    const cached = getCachedFeed(marketId, config);
    if (cached) {
      cacheHit = true;
      const latencyMs = Date.now() - startTime;
      recordRequest(latencyMs, true);

      return {
        success: true,
        feed: cached.feed,
        breakdown: cached.breakdown,
        latencyMs,
        cached: true,
      };
    }

    // Fetch from dataFabric
    const fabric = getDataFabric();
    const marketResponse = await fabric.getMarket(marketId);

    if (!marketResponse) {
      const latencyMs = Date.now() - startTime;
      recordRequest(latencyMs, false, 'Market not found');

      return {
        success: false,
        error: `Market not found: ${marketId}`,
        latencyMs,
        cached: false,
      };
    }

    // Transform to feed
    const { feed, breakdown } = marketToFeed(marketResponse.market, config);

    // Cache result
    cacheFeed(marketId, feed, breakdown);

    const latencyMs = Date.now() - startTime;
    recordRequest(latencyMs, false);

    return {
      success: true,
      feed,
      breakdown,
      latencyMs,
      cached: false,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    recordRequest(latencyMs, false, errorMessage);

    return {
      success: false,
      error: errorMessage,
      latencyMs,
      cached: false,
    };
  }
}

// ============================================================================
// Batch Feeds
// ============================================================================

/**
 * Get multiple probability feeds with filtering
 *
 * @param request - Batch request with filters
 * @param config - Oracle configuration
 * @returns Batch response with feeds array
 */
export async function getFeeds(
  request: BatchFeedsRequest = {},
  config: OracleConfig = DEFAULT_ORACLE_CONFIG
): Promise<BatchFeedsResponse> {
  const startTime = Date.now();

  try {
    // Build dataFabric query
    const query: DataFabricQuery = {
      limit: request.limit || 100,
      includeResolved: false,
    };

    if (request.category) {
      query.category = request.category;
    }

    if (request.minVolume) {
      query.minVolume = request.minVolume;
    }

    // Fetch markets
    const fabric = getDataFabric();
    const response = await fabric.getMarkets(query);

    // Transform to feeds
    const { feeds, breakdowns, filtered } = marketsToFeeds(
      response.markets,
      config,
      {
        minConfidence: request.minConfidence,
        minVolume: request.minVolume,
        excludeStale: true,
        excludeResolved: true,
      }
    );

    // Sort by confidence
    const sortedFeeds = sortByConfidence(feeds);

    const latencyMs = Date.now() - startTime;
    recordRequest(latencyMs, false);

    return {
      success: true,
      feeds: sortedFeeds,
      breakdowns: request.includeBreakdown ? breakdowns : undefined,
      total: sortedFeeds.length,
      filtered,
      latencyMs,
      cached: response.cacheHit,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    recordRequest(latencyMs, false, errorMessage);

    return {
      success: false,
      feeds: [],
      total: 0,
      filtered: 0,
      error: errorMessage,
      latencyMs,
      cached: false,
    };
  }
}

/**
 * Get feeds for specific market IDs (batch lookup)
 */
export async function getFeedsByIds(
  marketIds: string[],
  config: OracleConfig = DEFAULT_ORACLE_CONFIG
): Promise<BatchFeedsResponse> {
  const startTime = Date.now();

  try {
    const feeds: ProbabilityFeed[] = [];
    const breakdowns = new Map<string, ConfidenceBreakdown>();
    let cacheHits = 0;

    // Fetch each market (could optimize with batch fetch)
    await Promise.all(
      marketIds.map(async (marketId) => {
        const response = await getFeed(marketId, config);
        if (response.success && response.feed) {
          feeds.push(response.feed);
          if (response.breakdown) {
            breakdowns.set(marketId, response.breakdown);
          }
          if (response.cached) {
            cacheHits++;
          }
        }
      })
    );

    const latencyMs = Date.now() - startTime;

    return {
      success: true,
      feeds,
      breakdowns,
      total: feeds.length,
      filtered: marketIds.length - feeds.length,
      latencyMs,
      cached: cacheHits === marketIds.length,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      feeds: [],
      total: 0,
      filtered: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs,
      cached: false,
    };
  }
}

// ============================================================================
// Specialized Queries
// ============================================================================

/**
 * Get top feeds by quality score
 *
 * Returns the most reliable feeds across all categories.
 */
export async function getTopFeeds(
  limit: number = 20,
  config: OracleConfig = DEFAULT_ORACLE_CONFIG
): Promise<ProbabilityFeed[]> {
  const response = await getFeeds({ limit: 100 }, config);

  if (!response.success) {
    return [];
  }

  // Sort by quality score and take top N
  return response.feeds
    .sort((a, b) => getQualityScore(b) - getQualityScore(a))
    .slice(0, limit);
}

/**
 * Get feeds by category
 */
export async function getFeedsByCategory(
  category: MarketCategory,
  limit: number = 50,
  config: OracleConfig = DEFAULT_ORACLE_CONFIG
): Promise<ProbabilityFeed[]> {
  const response = await getFeeds({ category, limit }, config);
  return response.feeds;
}

/**
 * Get high-confidence feeds only
 *
 * Useful for protocols that need reliable data.
 */
export async function getHighConfidenceFeeds(
  minConfidence: number = 0.7,
  limit: number = 50,
  config: OracleConfig = DEFAULT_ORACLE_CONFIG
): Promise<ProbabilityFeed[]> {
  const response = await getFeeds({ minConfidence, limit }, config);
  return response.feeds;
}

// ============================================================================
// Health & Status
// ============================================================================

/**
 * Get oracle health status
 *
 * Reports on data freshness, platform availability, and metrics.
 */
export async function getOracleHealth(
  config: OracleConfig = DEFAULT_ORACLE_CONFIG
): Promise<OracleHealthResponse> {
  const startTime = Date.now();

  try {
    // Fetch sample of markets to assess health
    const response = await getFeeds({ limit: 100 }, config);

    // Calculate health metrics
    let staleCount = 0;
    let highConfidenceCount = 0;
    let totalConfidence = 0;

    const platformStats = new Map<string, { count: number; lastUpdate: Date }>();

    for (const feed of response.feeds) {
      if (feed.isStale) staleCount++;
      if (feed.confidenceLevel === 'high') highConfidenceCount++;
      totalConfidence += feed.confidence;

      // Track platform stats
      for (const platform of feed.platforms) {
        const existing = platformStats.get(platform);
        if (!existing || feed.lastUpdated > existing.lastUpdate) {
          platformStats.set(platform, {
            count: (existing?.count || 0) + 1,
            lastUpdate: feed.lastUpdated,
          });
        }
      }
    }

    const avgConfidence = response.feeds.length > 0
      ? totalConfidence / response.feeds.length
      : 0;

    // Build platform health
    const platforms = Array.from(platformStats.entries()).map(([platform, stats]) => ({
      platform: platform as any,
      healthy: true, // TODO: Real health check
      lastUpdate: stats.lastUpdate,
      marketsCount: stats.count,
    }));

    // Determine overall status
    const staleRatio = response.feeds.length > 0 ? staleCount / response.feeds.length : 0;
    const status = staleRatio < 0.1 ? 'operational' :
                   staleRatio < 0.3 ? 'degraded' : 'down';

    return {
      healthy: status === 'operational',
      status,
      platforms,
      metrics: {
        totalFeeds: response.feeds.length,
        highConfidenceFeeds: highConfidenceCount,
        staleFeeds: staleCount,
        avgConfidence,
        avgLatencyMs: metrics.avgLatencyMs,
      },
      uptimeSeconds: Math.round((Date.now() - metrics.startTime.getTime()) / 1000),
      lastHealthCheck: new Date(),
    };
  } catch (error) {
    return {
      healthy: false,
      status: 'down',
      platforms: [],
      metrics: {
        totalFeeds: 0,
        highConfidenceFeeds: 0,
        staleFeeds: 0,
        avgConfidence: 0,
        avgLatencyMs: metrics.avgLatencyMs,
      },
      uptimeSeconds: Math.round((Date.now() - metrics.startTime.getTime()) / 1000),
      lastHealthCheck: new Date(),
    };
  }
}

// ============================================================================
// Cache Management
// ============================================================================

export { clearFeedCache, getFeedCacheStats };

// ============================================================================
// Autonomous Oracle (Discovery + Forecasting)
// ============================================================================

export {
  discoverTrendingMarkets,
  getMarketById,
  isDiscoveryHealthy,
  calculateTriageScore,
  passesTriageCriteria,
  TRIAGE_THRESHOLDS,
  type TriagedMarket,
  type DiscoveryResult,
} from './discovery';

export {
  runOracleForecaster,
  getOracleStats,
  getActiveForecasts,
  getResolvedForecasts,
  generateForecast,
  saveForecast,
  type OracleForecast,
  type OracleRunResult,
} from './forecaster';

export {
  checkResolutions,
  manualResolve,
  calculateBrierScore,
  calculateLogScore,
  recalculateBrier,
  type ResolutionResult,
  type ResolutionRunResult,
} from './resolution';

/**
 * Autonomous Oracle configuration
 */
export const AUTONOMOUS_ORACLE_CONFIG = {
  // Scheduling
  cronSchedule: '0 */6 * * *', // Every 6 hours
  targetMarketsPerRun: 10,

  // Triage defaults
  minVolume: 10000,
  minPrice: 0.10,
  maxPrice: 0.90,
  minDaysToResolve: 7,
  maxDaysToResolve: 90,

  // Performance
  requestDelayMs: 1000,
  timeoutMs: 60000,

  // Identity
  name: 'Oracle',
  tier: 'verified',
  model: 'claude-opus-4-5',
};
