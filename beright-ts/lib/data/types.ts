/**
 * BeRight Trust Engine - Unified Data Types
 *
 * These types define the core data structures for:
 * - Aggregated market data from multiple platforms
 * - Validation results and confidence scores
 * - Trust indicators shown to users
 *
 * @author BeRight Protocol
 * @version 2.0.0 - Trust Engine
 */

// =============================================================================
// PLATFORM TYPES
// =============================================================================

/**
 * Supported prediction market platforms
 * Extended to include all platforms from aggregators
 */
export type DataPlatform =
  | 'polymarket'
  | 'kalshi'
  | 'manifold'
  | 'limitless'
  | 'metaculus'
  | 'prophetx'
  | 'novig'
  | 'sxbet'
  | 'myriad'
  | 'baozi'
  | 'probable';

/**
 * Data source type - where the data came from
 */
export type DataSource =
  | 'pmxt'           // Open source aggregator (primary)
  | 'polyrouter'     // Free beta aggregator (secondary)
  | 'direct'         // Direct platform API (fallback)
  | 'cache'          // From local cache
  | 'unknown';

/**
 * Platform configuration
 */
export interface PlatformConfig {
  name: DataPlatform;
  displayName: string;
  fee: number;           // Trading fee percentage (0.01 = 1%)
  hasWebSocket: boolean; // Supports real-time updates
  hasOrderbook: boolean; // Has full orderbook data
  apiLatencyMs: number;  // Typical API response time
  accuracy: number;      // Historical accuracy (0-1) from Vanderbilt study
}

// =============================================================================
// MARKET DATA TYPES
// =============================================================================

/**
 * Raw market data from any source (before validation)
 */
export interface RawMarketData {
  // Identity
  id: string;
  platform: DataPlatform;
  source: DataSource;

  // Content
  title: string;
  question?: string;
  description?: string;
  category?: string;

  // Pricing (0-1 scale)
  yesPrice: number;
  noPrice: number;

  // Orderbook (optional)
  yesBid?: number;
  yesAsk?: number;
  noBid?: number;
  noAsk?: number;
  spread?: number;

  // Volume & Liquidity
  volume?: number;
  volume24h?: number;
  liquidity?: number;
  openInterest?: number;

  // Timing
  endDate?: Date | null;
  createdAt?: Date | null;
  fetchedAt: Date;

  // Status
  status: 'active' | 'closed' | 'resolved' | 'unknown';

  // URLs
  url?: string;

  // On-chain data (for tokenized markets)
  onChain?: {
    yesMint?: string;
    noMint?: string;
    marketLedger?: string;
  };

  // Original platform data (for debugging)
  _raw?: unknown;
}

/**
 * Trust level for UI display
 */
export type TrustLevel = 'verified' | 'good' | 'unverified' | 'suspicious' | 'filtered';

/**
 * Validated market data with trust indicators
 */
export interface ValidatedMarket extends RawMarketData {
  // Validation results
  validation: ValidationResult;

  // Trust score (0-100)
  trustScore: number;

  // Trust level for UI
  trustLevel: TrustLevel;

  // Data freshness
  dataAgeSeconds: number;
  isFresh: boolean;

  // Platform attribution
  sourceLabel: string;  // "Polymarket via PMXT" or "Kalshi (Direct API)"

  // Cross-platform matching (if available)
  crossPlatformMatches?: CrossPlatformMatch[];
}

/**
 * Cross-platform match for arbitrage detection
 */
export interface CrossPlatformMatch {
  platform: DataPlatform;
  marketId: string;
  title: string;
  yesPrice: number;
  matchConfidence: number;  // 0-1 similarity score
  priceSpread: number;      // Absolute price difference
  url?: string;
}

// =============================================================================
// VALIDATION TYPES
// =============================================================================

/**
 * Individual validation check result
 */
export interface ValidationCheck {
  name: string;
  passed: boolean;
  confidence: number;      // 0-100
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * Complete validation result for a market
 */
export interface ValidationResult {
  isValid: boolean;
  overallConfidence: number;  // 0-100
  checks: ValidationCheck[];
  failedChecks: string[];
  warnings: string[];
  timestamp: Date;
}

/**
 * Validation rule configuration
 */
export interface ValidationRule {
  name: string;
  weight: number;           // How much this affects overall score (0-1)
  required: boolean;        // If false, market is filtered out
  validator: (market: RawMarketData, context?: ValidationContext) => Promise<ValidationCheck>;
}

/**
 * Context passed to validators
 */
export interface ValidationContext {
  oraclePrice?: number;     // BTC/ETH price from oracle
  previousPrice?: number;   // Previous price for spike detection
  existingMarkets?: Map<string, RawMarketData>;  // For cross-platform validation
  platform?: PlatformConfig;
}

// =============================================================================
// AGGREGATOR TYPES
// =============================================================================

/**
 * Aggregator fetch options
 */
export interface FetchOptions {
  query?: string;
  limit?: number;
  platforms?: DataPlatform[];
  includeInactive?: boolean;
  timeout?: number;
}

/**
 * Aggregator response
 */
export interface AggregatorResponse {
  source: DataSource;
  markets: RawMarketData[];
  fetchedAt: Date;
  latencyMs: number;
  errors?: string[];
}

/**
 * Aggregator interface - all aggregators must implement this
 */
export interface MarketAggregator {
  name: DataSource;
  supportedPlatforms: DataPlatform[];

  // Fetch markets
  fetchMarkets(options: FetchOptions): Promise<AggregatorResponse>;

  // Search markets
  searchMarkets(query: string, options?: FetchOptions): Promise<AggregatorResponse>;

  // Get hot/trending markets
  getHotMarkets(limit?: number): Promise<AggregatorResponse>;

  // Health check
  isHealthy(): Promise<boolean>;
}

// =============================================================================
// CACHE TYPES
// =============================================================================

/**
 * Cache entry for market data
 */
export interface CacheEntry<T> {
  data: T;
  cachedAt: Date;
  expiresAt: Date;
  source: DataSource;
  hits: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  ttlMs: number;            // Time to live in milliseconds
  maxEntries: number;       // Max entries before cleanup
  cleanupIntervalMs: number;// Cleanup interval
}

// =============================================================================
// ORACLE TYPES
// =============================================================================

/**
 * Price oracle response
 */
export interface OraclePrice {
  asset: string;            // 'BTC', 'ETH', etc.
  price: number;            // Price in USD
  source: string;           // 'binance', 'coinbase', etc.
  fetchedAt: Date;
  confidence: number;       // 0-1 confidence in price accuracy
}

// =============================================================================
// ARBITRAGE TYPES
// =============================================================================

/**
 * Validated arbitrage opportunity
 */
export interface ValidatedArbitrage {
  // Markets
  marketA: ValidatedMarket;
  marketB: ValidatedMarket;

  // Pricing
  priceAYes: number;
  priceBYes: number;
  spread: number;
  spreadPct: number;

  // Strategy
  strategy: string;
  profitPct: number;

  // Match confidence
  matchConfidence: number;
  titleSimilarity: number;

  // Validation
  isValid: boolean;
  trustScore: number;       // Average of both markets
  warnings: string[];

  // Execution details
  volumeA: number;
  volumeB: number;
  minExecutableUsd: number;

  // Timestamps
  detectedAt: Date;
  expiresAt?: Date;
}

// =============================================================================
// TRUST ENGINE OUTPUT TYPES
// =============================================================================

/**
 * Trust Engine fetch result
 */
export interface TrustEngineResult {
  // Validated markets
  markets: ValidatedMarket[];

  // Filtered out markets (for debugging/logging)
  filteredOut: {
    market: RawMarketData;
    reason: string;
  }[];

  // Metadata
  fetchedAt: Date;
  totalFetched: number;
  totalValidated: number;
  totalFiltered: number;

  // Data sources used
  sources: DataSource[];

  // Overall health
  dataQualityScore: number;  // 0-100
  warnings: string[];
}

/**
 * Trust indicator for UI display
 */
export interface TrustIndicator {
  level: 'verified' | 'good' | 'unverified' | 'suspicious';
  emoji: string;            // '🟢', '🟡', '🔴'
  label: string;            // 'Verified', 'Good', etc.
  tooltip: string;          // Explanation for users
  score: number;            // 0-100
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Platform configurations with data quality metrics
 * Based on Vanderbilt University study
 */
export const PLATFORM_CONFIGS: Record<DataPlatform, PlatformConfig> = {
  polymarket: {
    name: 'polymarket',
    displayName: 'Polymarket',
    fee: 0.01,
    hasWebSocket: true,
    hasOrderbook: true,
    apiLatencyMs: 50,
    accuracy: 0.67,  // 67% from Vanderbilt study
  },
  kalshi: {
    name: 'kalshi',
    displayName: 'Kalshi',
    fee: 0.01,
    hasWebSocket: true,
    hasOrderbook: true,
    apiLatencyMs: 80,
    accuracy: 0.78,  // 78% from Vanderbilt study
  },
  manifold: {
    name: 'manifold',
    displayName: 'Manifold',
    fee: 0,
    hasWebSocket: true,
    hasOrderbook: false,
    apiLatencyMs: 100,
    accuracy: 0.75,  // Estimated (research-focused)
  },
  limitless: {
    name: 'limitless',
    displayName: 'Limitless',
    fee: 0.01,
    hasWebSocket: false,
    hasOrderbook: false,
    apiLatencyMs: 150,
    accuracy: 0.70,  // Estimated
  },
  metaculus: {
    name: 'metaculus',
    displayName: 'Metaculus',
    fee: 0,
    hasWebSocket: false,
    hasOrderbook: false,
    apiLatencyMs: 200,
    accuracy: 0.80,  // Research platform, good calibration
  },
  prophetx: {
    name: 'prophetx',
    displayName: 'ProphetX',
    fee: 0.01,
    hasWebSocket: false,
    hasOrderbook: false,
    apiLatencyMs: 150,
    accuracy: 0.70,
  },
  novig: {
    name: 'novig',
    displayName: 'Novig',
    fee: 0.01,
    hasWebSocket: false,
    hasOrderbook: false,
    apiLatencyMs: 150,
    accuracy: 0.70,
  },
  sxbet: {
    name: 'sxbet',
    displayName: 'SX.bet',
    fee: 0.02,
    hasWebSocket: false,
    hasOrderbook: true,
    apiLatencyMs: 100,
    accuracy: 0.72,
  },
  myriad: {
    name: 'myriad',
    displayName: 'Myriad',
    fee: 0.01,
    hasWebSocket: false,
    hasOrderbook: false,
    apiLatencyMs: 150,
    accuracy: 0.70,
  },
  baozi: {
    name: 'baozi',
    displayName: 'Baozi',
    fee: 0.01,
    hasWebSocket: false,
    hasOrderbook: false,
    apiLatencyMs: 150,
    accuracy: 0.70,
  },
  probable: {
    name: 'probable',
    displayName: 'Probable Markets',
    fee: 0.01,
    hasWebSocket: false,
    hasOrderbook: false,
    apiLatencyMs: 150,
    accuracy: 0.70,
  },
};

/**
 * Trust level thresholds
 */
export const TRUST_THRESHOLDS = {
  verified: 95,    // 95%+ = Verified (green)
  good: 75,        // 75-94% = Good (yellow-green)
  unverified: 50,  // 50-74% = Unverified (yellow)
  suspicious: 25,  // 25-49% = Suspicious (orange)
  // Below 25% = Filtered out (red) - not shown to users
};

/**
 * Data freshness thresholds (in seconds)
 */
export const FRESHNESS_THRESHOLDS = {
  fresh: 60,       // Under 1 minute = Fresh
  acceptable: 300, // Under 5 minutes = Acceptable
  stale: 900,      // Under 15 minutes = Stale (warning)
  expired: 1800,   // Over 30 minutes = Expired (filter out)
};

/**
 * Get trust indicator for display
 */
export function getTrustIndicator(score: number): TrustIndicator {
  if (score >= TRUST_THRESHOLDS.verified) {
    return {
      level: 'verified',
      emoji: '🟢',
      label: 'Verified',
      tooltip: 'High confidence in data accuracy. Multiple validation checks passed.',
      score,
    };
  }
  if (score >= TRUST_THRESHOLDS.good) {
    return {
      level: 'good',
      emoji: '🟡',
      label: 'Good',
      tooltip: 'Data appears reliable but verify before large trades.',
      score,
    };
  }
  if (score >= TRUST_THRESHOLDS.unverified) {
    return {
      level: 'unverified',
      emoji: '🟠',
      label: 'Unverified',
      tooltip: 'Some validation checks failed. Exercise caution.',
      score,
    };
  }
  return {
    level: 'suspicious',
    emoji: '🔴',
    label: 'Suspicious',
    tooltip: 'Data quality issues detected. Verify independently.',
    score,
  };
}
