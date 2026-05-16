/**
 * BeRight Probability Oracle
 *
 * Exposes prediction market probabilities as DeFi-consumable feeds.
 * This is NOT a new data source—it's a specialized view of the dataFabric
 * with confidence scoring and staleness detection.
 *
 * Use cases:
 * - Lending protocols: Use probability as collateral factor
 * - Options protocols: Use probability for pricing
 * - Insurance protocols: Use probability for risk assessment
 * - Automated strategies: Trigger actions on probability thresholds
 */

import type { DataPlatform, MarketCategory } from '../dataFabric/types';

// ============================================================================
// Core Oracle Types
// ============================================================================

/**
 * Confidence level for a probability feed
 *
 * Determined by volume, liquidity, platform count, and staleness.
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unreliable';

/**
 * A single probability feed—the core oracle output
 *
 * This is what external protocols consume.
 */
export interface ProbabilityFeed {
  // Identity
  marketId: string;              // BeRight canonical market ID
  slug: string;                  // URL-friendly identifier
  question: string;              // Human-readable question

  // The oracle output
  probability: number;           // 0.0 - 1.0 (the core value)
  confidence: number;            // 0.0 - 1.0 confidence score
  confidenceLevel: ConfidenceLevel;

  // Market context
  category: MarketCategory;
  platforms: DataPlatform[];     // Which platforms contribute
  platformCount: number;

  // Liquidity metrics (for consumers to assess)
  totalVolume: number;           // Total volume across platforms
  totalVolume24h: number;        // 24h volume
  totalLiquidity: number;        // Available liquidity

  // Price spread (for arb detection / manipulation risk)
  priceRange: {
    min: number;                 // Lowest probability across platforms
    max: number;                 // Highest probability
    spread: number;              // max - min (high spread = disagreement)
  };

  // Resolution info
  resolutionDate?: Date;
  resolutionSource?: string;
  daysUntilResolution?: number;

  // Freshness
  lastUpdated: Date;
  stalenessSeconds: number;      // How old is this data
  isStale: boolean;              // Is data too old to trust

  // Status
  status: 'active' | 'closed' | 'resolved' | 'disputed';
  isResolved: boolean;
  resolution?: 'yes' | 'no';
}

/**
 * Confidence scoring breakdown
 *
 * Explains why a feed has its confidence level.
 * Useful for debugging and transparency.
 */
export interface ConfidenceBreakdown {
  // Component scores (0-1)
  volumeScore: number;           // Based on 24h volume
  liquidityScore: number;        // Based on available liquidity
  platformScore: number;         // More platforms = more confidence
  spreadScore: number;           // Lower spread = more consensus
  freshnessScore: number;        // Newer data = more confidence

  // Weights used
  weights: {
    volume: number;
    liquidity: number;
    platforms: number;
    spread: number;
    freshness: number;
  };

  // Final score
  compositeScore: number;
  level: ConfidenceLevel;

  // Warnings
  warnings: string[];
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Oracle configuration
 *
 * These thresholds determine confidence levels and staleness.
 * Can be overridden per-request for specialized use cases.
 */
export interface OracleConfig {
  // Volume thresholds (USD)
  volumeThresholds: {
    high: number;                // Volume for "high" confidence
    medium: number;              // Volume for "medium" confidence
    low: number;                 // Below this = "low" confidence
  };

  // Liquidity thresholds (USD)
  liquidityThresholds: {
    high: number;
    medium: number;
    low: number;
  };

  // Platform count thresholds
  platformThresholds: {
    high: number;                // e.g., 3+ platforms
    medium: number;              // e.g., 2 platforms
  };

  // Spread thresholds (probability difference)
  spreadThresholds: {
    high: number;                // Low spread = high consensus
    medium: number;
  };

  // Staleness (seconds)
  stalenessThresholds: {
    fresh: number;               // Under this = fresh
    stale: number;               // Over this = stale (don't trust)
  };

  // Cache settings
  cacheTTLSeconds: number;
}

/**
 * Default oracle configuration
 *
 * Tuned for prediction market data characteristics.
 */
export const DEFAULT_ORACLE_CONFIG: OracleConfig = {
  volumeThresholds: {
    high: 100000,      // $100k+ volume
    medium: 10000,     // $10k+ volume
    low: 1000,         // Below $1k = low confidence
  },

  liquidityThresholds: {
    high: 50000,       // $50k+ liquidity
    medium: 5000,      // $5k+ liquidity
    low: 500,          // Below $500 = low confidence
  },

  platformThresholds: {
    high: 3,           // 3+ platforms = high confidence
    medium: 2,         // 2 platforms = medium
  },

  spreadThresholds: {
    high: 0.03,        // <3% spread = high consensus
    medium: 0.08,      // <8% spread = medium consensus
  },

  stalenessThresholds: {
    fresh: 60,         // Under 60s = fresh
    stale: 300,        // Over 5 min = stale
  },

  cacheTTLSeconds: 30,
};

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Single feed request
 */
export interface FeedRequest {
  marketId: string;
  includeBreakdown?: boolean;    // Include confidence breakdown
}

/**
 * Batch feeds request
 */
export interface BatchFeedsRequest {
  marketIds?: string[];          // Specific markets
  category?: MarketCategory;     // Filter by category
  minConfidence?: number;        // Min confidence score
  minVolume?: number;            // Min volume
  limit?: number;                // Max results
  includeBreakdown?: boolean;
}

/**
 * Single feed response
 */
export interface FeedResponse {
  success: boolean;
  feed?: ProbabilityFeed;
  breakdown?: ConfidenceBreakdown;
  error?: string;
  latencyMs: number;
  cached: boolean;
}

/**
 * Batch feeds response
 */
export interface BatchFeedsResponse {
  success: boolean;
  feeds: ProbabilityFeed[];
  breakdowns?: Map<string, ConfidenceBreakdown>;
  total: number;
  filtered: number;              // How many were filtered out
  error?: string;
  latencyMs: number;
  cached: boolean;
}

/**
 * Oracle health response
 */
export interface OracleHealthResponse {
  healthy: boolean;
  status: 'operational' | 'degraded' | 'down';

  // Platform status
  platforms: {
    platform: DataPlatform;
    healthy: boolean;
    lastUpdate: Date;
    marketsCount: number;
  }[];

  // Metrics
  metrics: {
    totalFeeds: number;
    highConfidenceFeeds: number;
    staleFeeds: number;
    avgConfidence: number;
    avgLatencyMs: number;
  };

  // Uptime
  uptimeSeconds: number;
  lastHealthCheck: Date;
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Cache entry for a feed
 */
export interface FeedCacheEntry {
  feed: ProbabilityFeed;
  breakdown: ConfidenceBreakdown;
  timestamp: number;
}

/**
 * Oracle metrics for monitoring
 */
export interface OracleMetrics {
  requestCount: number;
  cacheHits: number;
  cacheMisses: number;
  avgLatencyMs: number;
  errorCount: number;
  lastError?: string;
  startTime: Date;
}
