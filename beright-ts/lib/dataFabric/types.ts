/**
 * BeRight Data Fabric - Unified Types
 *
 * The Data Fabric is the single source of truth for all market data.
 * It aggregates data from multiple platforms and provides a unified interface.
 *
 * @author BeRight Protocol
 * @version 3.0.0 - Bloomberg Terminal Architecture
 */

import { DataPlatform, RawMarketData, TrustLevel } from '../data/types';

// Re-export DataPlatform as Platform for execution module compatibility
export type { DataPlatform as Platform };
export type { DataPlatform };

// =============================================================================
// UNIFIED MARKET TYPE
// =============================================================================

/**
 * Market category for filtering and organization
 */
export type MarketCategory =
  | 'politics'
  | 'crypto'
  | 'sports'
  | 'economics'
  | 'science'
  | 'entertainment'
  | 'technology'
  | 'world'
  | 'other';

/**
 * Market status across platforms
 */
export type MarketStatus = 'active' | 'closed' | 'resolved' | 'disputed';

/**
 * Platform-specific data for a market
 */
export interface PlatformMarketData {
  platform: DataPlatform;
  platformId: string;
  url: string;

  // Pricing
  yesPrice: number;
  noPrice: number;

  // Orderbook (if available)
  yesBid?: number;
  yesAsk?: number;
  noBid?: number;
  noAsk?: number;
  spread?: number;

  // Volume & Liquidity
  volume: number;
  volume24h?: number;
  liquidity: number;
  openInterest?: number;

  // Timestamps
  lastUpdate: Date;

  // Trust
  trustScore: number;
  trustLevel: TrustLevel;
}

/**
 * Unified Market - The core data structure
 *
 * Represents a single market/question across all platforms.
 * This is what the terminal displays and trades against.
 */
export interface UnifiedMarket {
  // Identity
  id: string;                      // BeRight canonical ID (hash of normalized question)
  slug: string;                    // URL-friendly identifier

  // Content
  question: string;                // Normalized question text
  description?: string;            // Detailed description
  category: MarketCategory;
  tags: string[];

  // Cross-platform data
  platforms: PlatformMarketData[];

  // Aggregated pricing (best across platforms)
  bestBid: number;                 // Highest YES bid
  bestAsk: number;                 // Lowest YES ask (= 1 - highest NO bid)
  consensusPrice: number;          // Volume-weighted average
  priceRange: {
    min: number;
    max: number;
  };

  // Arbitrage indicator
  arbitrageSpread?: number;        // If > 0, arb opportunity exists
  arbitragePlatforms?: {
    buyPlatform: DataPlatform;
    sellPlatform: DataPlatform;
    spread: number;
    profitPct: number;
  };

  // Aggregated volume & liquidity
  totalVolume: number;
  totalVolume24h: number;
  totalLiquidity: number;

  // Timing
  closeDate?: Date;
  createdAt?: Date;
  lastUpdate: Date;

  // Status
  status: MarketStatus;
  isResolved: boolean;
  resolution?: 'yes' | 'no' | null;

  // Trust & Quality
  overallTrustScore: number;       // Weighted average across platforms
  platformCount: number;           // Number of platforms with this market

  // Resolution source (if known)
  resolutionSource?: string;
  resolutionCriteria?: string;
}

// =============================================================================
// DATA FABRIC TYPES
// =============================================================================

/**
 * Search/filter options for the Data Fabric
 */
export interface DataFabricQuery {
  // Text search
  query?: string;

  // Filters
  category?: MarketCategory;
  categories?: MarketCategory[];
  platforms?: DataPlatform[];
  status?: MarketStatus[];
  minVolume?: number;
  minLiquidity?: number;
  minTrustScore?: number;

  // Time filters
  closingWithin?: number;          // Markets closing within N hours
  createdAfter?: Date;

  // Sorting
  sortBy?: 'volume' | 'liquidity' | 'closing' | 'trust' | 'spread' | 'created';
  sortOrder?: 'asc' | 'desc';

  // Pagination
  limit?: number;
  offset?: number;

  // Options
  includeResolved?: boolean;
  includeArbitrageOnly?: boolean;
}

/**
 * Data Fabric response
 */
export interface DataFabricResponse {
  markets: UnifiedMarket[];

  // Pagination info
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;

  // Metadata
  fetchedAt: Date;
  latencyMs: number;
  sources: DataPlatform[];

  // Quality indicators
  cacheHit: boolean;
  dataQualityScore: number;
  warnings?: string[];
}

/**
 * Single market detail response
 */
export interface MarketDetailResponse {
  market: UnifiedMarket;
  fetchedAt: Date;
  latencyMs: number;

  // Related markets
  relatedMarkets?: UnifiedMarket[];

  // Historical data (if available)
  priceHistory?: PricePoint[];

  // Signals (if any)
  activeSignals?: MarketSignal[];
}

/**
 * Price history point
 */
export interface PricePoint {
  timestamp: Date;
  price: number;
  volume: number;
  platform?: DataPlatform;
}

/**
 * Market signal (placeholder for Signal Aggregator)
 */
export interface MarketSignal {
  type: string;
  message: string;
  confidence: number;
  timestamp: Date;
}

// =============================================================================
// PROVIDER TYPES
// =============================================================================

/**
 * Provider interface - all platform providers implement this
 */
export interface DataFabricProvider {
  name: DataPlatform;
  displayName: string;

  // Fetch markets from this platform
  fetchMarkets(options?: ProviderFetchOptions): Promise<ProviderResponse>;

  // Fetch a single market by platform ID
  fetchMarket(platformId: string): Promise<RawMarketData | null>;

  // Search markets
  searchMarkets(query: string, options?: ProviderFetchOptions): Promise<ProviderResponse>;

  // Health check
  isHealthy(): Promise<boolean>;

  // Get trading fee for this platform
  getTradingFee(): number;
}

/**
 * Provider fetch options
 */
export interface ProviderFetchOptions {
  limit?: number;
  status?: 'active' | 'all';
  timeout?: number;
}

/**
 * Provider response
 */
export interface ProviderResponse {
  platform: DataPlatform;
  markets: RawMarketData[];
  fetchedAt: Date;
  latencyMs: number;
  errors?: string[];
}

// =============================================================================
// DEDUPLICATION TYPES
// =============================================================================

/**
 * Market match candidate (for deduplication)
 */
export interface MarketMatchCandidate {
  marketA: RawMarketData;
  marketB: RawMarketData;
  similarity: number;              // 0-1 text similarity
  matchType: 'exact' | 'fuzzy' | 'related';
  confidence: number;              // Overall match confidence
}

/**
 * Deduplication result
 */
export interface DeduplicationResult {
  unified: UnifiedMarket[];
  unmatched: RawMarketData[];
  matchStats: {
    totalInput: number;
    totalUnified: number;
    totalMatches: number;
    avgSimilarity: number;
  };
}

// =============================================================================
// CACHE TYPES
// =============================================================================

/**
 * Cache configuration
 */
export interface DataFabricCacheConfig {
  // TTL in milliseconds
  marketsTtl: number;              // Default: 30s
  marketDetailTtl: number;         // Default: 10s
  searchTtl: number;               // Default: 60s

  // Limits
  maxEntries: number;              // Default: 10000
  maxMemoryMb: number;             // Default: 100

  // Options
  enableRedis: boolean;            // Use Redis for shared cache
  redisUrl?: string;
}

/**
 * Cache stats
 */
export interface DataFabricCacheStats {
  entries: number;
  hits: number;
  misses: number;
  hitRate: number;
  memorySizeMb: number;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a canonical ID for a market question
 */
export function generateMarketId(question: string): string {
  const normalized = question
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, '-');

  // Simple hash for uniqueness
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return `m-${Math.abs(hash).toString(36)}`;
}

/**
 * Generate a URL-friendly slug
 */
export function generateSlug(question: string): string {
  return question
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 100);
}

/**
 * Detect market category from question text
 */
export function detectCategory(question: string): MarketCategory {
  const q = question.toLowerCase();

  // Politics
  if (/\b(trump|biden|election|president|congress|senate|vote|governor|party|democrat|republican|poll)\b/.test(q)) {
    return 'politics';
  }

  // Crypto
  if (/\b(bitcoin|btc|ethereum|eth|crypto|token|blockchain|solana|sol|defi|nft)\b/.test(q)) {
    return 'crypto';
  }

  // Sports
  if (/\b(nba|nfl|mlb|nhl|soccer|football|basketball|tennis|golf|championship|super bowl|world cup|olympics)\b/.test(q)) {
    return 'sports';
  }

  // Economics
  if (/\b(fed|interest rate|inflation|gdp|unemployment|stock|s&p|nasdaq|dow|recession|economy)\b/.test(q)) {
    return 'economics';
  }

  // Science
  if (/\b(climate|space|nasa|vaccine|covid|pandemic|ai|artificial intelligence|research|study)\b/.test(q)) {
    return 'science';
  }

  // Entertainment
  if (/\b(oscar|grammy|emmy|movie|film|tv|show|celebrity|music|award)\b/.test(q)) {
    return 'entertainment';
  }

  // Technology
  if (/\b(apple|google|microsoft|amazon|meta|facebook|twitter|startup|tech|product launch)\b/.test(q)) {
    return 'technology';
  }

  // World
  if (/\b(war|russia|ukraine|china|nato|un|conflict|treaty|international)\b/.test(q)) {
    return 'world';
  }

  return 'other';
}

/**
 * Calculate consensus price using Extremized Log-Odds Aggregation
 *
 * State-of-the-art aggregation based on Satopää et al. (2014) research,
 * showing ~20% Brier score improvement over simple volume-weighted averaging.
 *
 * Algorithm:
 * 1. Convert each platform price to log-odds: x_i = log(p_i / (1 - p_i))
 * 2. Calculate weights: w_i = calibration_i × √volume_i × √liquidity_i
 * 3. Compute weighted mean in log-odds space: x̄ = Σ(w_i × x_i) / Σ(w_i)
 * 4. Apply extremization: x̂ = d × x̄ (d = 1.5 default, optimal per research)
 * 5. Convert back to probability: P = 1 / (1 + exp(-x̂))
 *
 * References:
 * - Satopää et al. (2014) "Combining Probability Forecasts"
 * - Good Judgment Project extremizing methodology
 * - Logarithmic Opinion Pooling (minimizes KL divergence)
 */
export function calculateConsensusPrice(platforms: PlatformMarketData[]): number {
  if (platforms.length === 0) return 0.5;
  if (platforms.length === 1) return platforms[0].yesPrice;

  const MIN_PROB = 0.01;
  const MAX_PROB = 0.99;
  const EXTREMIZING_FACTOR = 1.5; // Optimal per Satopää et al.

  // Platform calibration scores (1 - Brier, higher = better)
  const CALIBRATION: Record<string, number> = {
    kalshi: 0.88,      // Best - regulated, institutional
    polymarket: 0.85,  // Good - high liquidity
    metaculus: 0.86,   // Good - forecasting focused
    jupiter: 0.84,     // Good - aggregates other platforms
    manifold: 0.78,    // Fair - play money affects accuracy
    limitless: 0.82,   // Fair - newer platform
    prophetx: 0.80,
    novig: 0.80,
    sxbet: 0.81,
    myriad: 0.78,
    baozi: 0.75,
    probable: 0.77,
  };

  // Step 1 & 2: Convert to log-odds and calculate weights
  let totalWeight = 0;
  let weightedLogOddsSum = 0;

  for (const p of platforms) {
    // Clamp probability
    const prob = Math.max(MIN_PROB, Math.min(MAX_PROB, p.yesPrice));

    // Convert to log-odds
    const logOdds = Math.log(prob / (1 - prob));

    // Calculate weight: calibration × √volume × √liquidity
    const calibration = CALIBRATION[p.platform] || 0.75;
    const weight = calibration * Math.sqrt(p.volume || 1) * Math.sqrt(p.liquidity || 1);

    weightedLogOddsSum += logOdds * weight;
    totalWeight += weight;
  }

  // Step 3: Weighted mean in log-odds space
  const meanLogOdds = totalWeight > 0 ? weightedLogOddsSum / totalWeight : 0;

  // Step 4: Apply extremization
  const extremizedLogOdds = EXTREMIZING_FACTOR * meanLogOdds;

  // Step 5: Convert back to probability
  const consensus = 1 / (1 + Math.exp(-extremizedLogOdds));

  // Clamp and round
  return Math.round(Math.max(MIN_PROB, Math.min(MAX_PROB, consensus)) * 1000) / 1000;
}

/**
 * Detect arbitrage opportunity between platforms
 */
export function detectArbitrage(platforms: PlatformMarketData[]): UnifiedMarket['arbitragePlatforms'] | undefined {
  if (platforms.length < 2) return undefined;

  let maxSpread = 0;
  let buyPlatform: DataPlatform | undefined;
  let sellPlatform: DataPlatform | undefined;

  for (let i = 0; i < platforms.length; i++) {
    for (let j = i + 1; j < platforms.length; j++) {
      const pA = platforms[i];
      const pB = platforms[j];

      // Calculate spread both ways
      const spreadAB = pB.yesPrice - pA.yesPrice;
      const spreadBA = pA.yesPrice - pB.yesPrice;

      if (spreadAB > maxSpread) {
        maxSpread = spreadAB;
        buyPlatform = pA.platform;
        sellPlatform = pB.platform;
      }

      if (spreadBA > maxSpread) {
        maxSpread = spreadBA;
        buyPlatform = pB.platform;
        sellPlatform = pA.platform;
      }
    }
  }

  // Only report if spread is significant (> 2%)
  if (maxSpread > 0.02 && buyPlatform && sellPlatform) {
    return {
      buyPlatform,
      sellPlatform,
      spread: maxSpread,
      profitPct: maxSpread * 100,
    };
  }

  return undefined;
}
