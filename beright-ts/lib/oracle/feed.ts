/**
 * BeRight Oracle: Feed Generation
 *
 * Transforms UnifiedMarket (dataFabric) → ProbabilityFeed (oracle output)
 *
 * This is the translation layer between our internal data model
 * and the DeFi-consumable oracle format.
 */

import type { UnifiedMarket } from '../dataFabric/types';
import type {
  ProbabilityFeed,
  ConfidenceBreakdown,
  OracleConfig,
  FeedCacheEntry,
} from './types';
import { DEFAULT_ORACLE_CONFIG } from './types';
import { calculateConfidence, detectManipulationRisk } from './confidence';

// ============================================================================
// Feed Generation
// ============================================================================

/**
 * Transform a UnifiedMarket into a ProbabilityFeed
 *
 * This is the core transformation function.
 */
export function marketToFeed(
  market: UnifiedMarket,
  config: OracleConfig = DEFAULT_ORACLE_CONFIG
): { feed: ProbabilityFeed; breakdown: ConfidenceBreakdown } {
  // Calculate confidence
  const breakdown = calculateConfidence(market, config);

  // Add manipulation warnings
  const manipulationRisks = detectManipulationRisk(market, config);
  breakdown.warnings.push(...manipulationRisks);

  // Calculate staleness
  const stalenessSeconds = Math.round((Date.now() - market.lastUpdate.getTime()) / 1000);
  const isStale = stalenessSeconds > config.stalenessThresholds.stale;

  // Calculate days until resolution
  const daysUntilResolution = market.closeDate
    ? Math.max(0, Math.ceil((market.closeDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : undefined;

  const feed: ProbabilityFeed = {
    // Identity
    marketId: market.id,
    slug: market.slug,
    question: market.question,

    // The oracle output
    probability: market.consensusPrice,
    confidence: breakdown.compositeScore,
    confidenceLevel: breakdown.level,

    // Market context
    category: market.category,
    platforms: market.platforms.map((p) => p.platform),
    platformCount: market.platformCount,

    // Liquidity metrics
    totalVolume: market.totalVolume,
    totalVolume24h: market.totalVolume24h,
    totalLiquidity: market.totalLiquidity,

    // Price spread
    priceRange: {
      min: market.priceRange.min,
      max: market.priceRange.max,
      spread: market.priceRange.max - market.priceRange.min,
    },

    // Resolution info
    resolutionDate: market.closeDate,
    resolutionSource: market.resolutionSource,
    daysUntilResolution,

    // Freshness
    lastUpdated: market.lastUpdate,
    stalenessSeconds,
    isStale,

    // Status
    status: market.status,
    isResolved: market.isResolved,
    resolution: market.resolution ?? undefined,
  };

  return { feed, breakdown };
}

/**
 * Transform multiple markets into feeds
 *
 * Filters out markets that don't meet minimum thresholds.
 */
export function marketsToFeeds(
  markets: UnifiedMarket[],
  config: OracleConfig = DEFAULT_ORACLE_CONFIG,
  options: {
    minConfidence?: number;
    minVolume?: number;
    excludeStale?: boolean;
    excludeResolved?: boolean;
  } = {}
): {
  feeds: ProbabilityFeed[];
  breakdowns: Map<string, ConfidenceBreakdown>;
  filtered: number;
} {
  const feeds: ProbabilityFeed[] = [];
  const breakdowns = new Map<string, ConfidenceBreakdown>();
  let filtered = 0;

  for (const market of markets) {
    // Skip resolved markets if requested
    if (options.excludeResolved && market.isResolved) {
      filtered++;
      continue;
    }

    const { feed, breakdown } = marketToFeed(market, config);

    // Apply filters
    if (options.minConfidence && feed.confidence < options.minConfidence) {
      filtered++;
      continue;
    }

    if (options.minVolume && feed.totalVolume24h < options.minVolume) {
      filtered++;
      continue;
    }

    if (options.excludeStale && feed.isStale) {
      filtered++;
      continue;
    }

    feeds.push(feed);
    breakdowns.set(feed.marketId, breakdown);
  }

  return { feeds, breakdowns, filtered };
}

// ============================================================================
// Feed Cache
// ============================================================================

const feedCache = new Map<string, FeedCacheEntry>();

/**
 * Get feed from cache if fresh
 */
export function getCachedFeed(
  marketId: string,
  config: OracleConfig = DEFAULT_ORACLE_CONFIG
): FeedCacheEntry | null {
  const entry = feedCache.get(marketId);
  if (!entry) return null;

  const age = (Date.now() - entry.timestamp) / 1000;
  if (age > config.cacheTTLSeconds) {
    feedCache.delete(marketId);
    return null;
  }

  return entry;
}

/**
 * Cache a feed
 */
export function cacheFeed(
  marketId: string,
  feed: ProbabilityFeed,
  breakdown: ConfidenceBreakdown
): void {
  feedCache.set(marketId, {
    feed,
    breakdown,
    timestamp: Date.now(),
  });
}

/**
 * Clear feed cache
 */
export function clearFeedCache(): void {
  feedCache.clear();
}

/**
 * Get cache stats
 */
export function getFeedCacheStats(): {
  size: number;
  entries: string[];
} {
  return {
    size: feedCache.size,
    entries: Array.from(feedCache.keys()),
  };
}

// ============================================================================
// Feed Sorting & Ranking
// ============================================================================

/**
 * Sort feeds by confidence (highest first)
 */
export function sortByConfidence(feeds: ProbabilityFeed[]): ProbabilityFeed[] {
  return [...feeds].sort((a, b) => b.confidence - a.confidence);
}

/**
 * Sort feeds by volume (highest first)
 */
export function sortByVolume(feeds: ProbabilityFeed[]): ProbabilityFeed[] {
  return [...feeds].sort((a, b) => b.totalVolume24h - a.totalVolume24h);
}

/**
 * Sort feeds by resolution date (soonest first)
 */
export function sortByResolution(feeds: ProbabilityFeed[]): ProbabilityFeed[] {
  return [...feeds].sort((a, b) => {
    if (!a.resolutionDate) return 1;
    if (!b.resolutionDate) return -1;
    return a.resolutionDate.getTime() - b.resolutionDate.getTime();
  });
}

/**
 * Get "oracle quality score" for ranking
 *
 * Combines confidence with volume and liquidity.
 * Used for "top feeds" rankings.
 */
export function getQualityScore(feed: ProbabilityFeed): number {
  // Confidence is the base (0-1)
  let score = feed.confidence;

  // Volume bonus (log scale, up to +0.2)
  const volumeBonus = Math.min(0.2, Math.log10(feed.totalVolume24h + 1) / 30);
  score += volumeBonus;

  // Multi-platform bonus (up to +0.1)
  if (feed.platformCount >= 3) score += 0.1;
  else if (feed.platformCount >= 2) score += 0.05;

  // Freshness penalty
  if (feed.isStale) score *= 0.5;

  return Math.min(1.0, score);
}
