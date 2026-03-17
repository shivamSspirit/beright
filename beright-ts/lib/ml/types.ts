/**
 * ML Market Matching Types
 *
 * Type definitions for the ML-powered market aggregation system.
 *
 * @author BeRight Protocol
 */

import { DataPlatform } from '../data/types';
import { UnifiedMarket, MarketCategory } from '../dataFabric/types';

// =============================================================================
// ML MATCH RESULT
// =============================================================================

/**
 * Result of ML-powered market matching
 */
export interface MLMatchResult {
  // BeRight canonical event ID
  eventId: string;

  // Canonical question (normalized from best source)
  canonicalQuestion: string;

  // Category detected
  category: MarketCategory;

  // All platform markets matched to this event
  markets: PlatformMarket[];

  // ML confidence score (0-1)
  matchConfidence: number;

  // Consensus price (volume-weighted)
  consensusPrice: number;

  // Price spread across platforms
  priceSpread: number;

  // Total liquidity across platforms
  totalLiquidity: number;

  // Total 24h volume
  totalVolume24h: number;

  // Arbitrage opportunity (if spread > threshold)
  arbitrage?: ArbitrageOpportunity;

  // Key entities extracted
  entities: ExtractedEntities;

  // Timing
  closeDate?: Date;
  matchedAt: Date;
}

/**
 * Platform-specific market data
 */
export interface PlatformMarket {
  platform: DataPlatform;
  platformId: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  liquidity: number;
  url?: string;
  closeDate?: Date;

  // Embedding if cached
  embedding?: number[];
}

/**
 * Arbitrage opportunity between platforms
 */
export interface ArbitrageOpportunity {
  buyPlatform: DataPlatform;
  buyPrice: number;
  sellPlatform: DataPlatform;
  sellPrice: number;
  spread: number;
  profitPct: number;
  estimatedFees: number;
  netProfit: number;
}

// =============================================================================
// ENTITY EXTRACTION
// =============================================================================

/**
 * Extracted entities from market text
 */
export interface ExtractedEntities {
  people: string[];           // Trump, Biden, Musk
  organizations: string[];    // Fed, SEC, Tesla
  locations: string[];        // US, China, Ukraine
  events: string[];           // Super Bowl, FOMC Meeting
  dates: ExtractedDate[];     // by Dec 2025, Q3 2024
  amounts: ExtractedAmount[]; // $100K, 3%, 50bps
  customTags: string[];       // Category-specific tags
}

/**
 * Extracted date with type
 */
export interface ExtractedDate {
  raw: string;
  normalized: Date | null;
  type: 'deadline' | 'range' | 'exact';
}

/**
 * Extracted amount with unit
 */
export interface ExtractedAmount {
  raw: string;
  value: number;
  unit: string;
}

// =============================================================================
// ML CONFIGURATION
// =============================================================================

/**
 * ML matching configuration
 */
export interface MLMatchConfig {
  // Embedding settings
  embeddingModel: 'openai' | 'huggingface' | 'local';
  embeddingDimension: number;

  // Similarity thresholds
  minEmbeddingSimilarity: number;  // Default: 0.85
  minOverallScore: number;         // Default: 0.75

  // Scoring weights
  weights: {
    embedding: number;    // 40%
    entity: number;       // 30%
    date: number;         // 15%
    category: number;     // 15%
  };

  // Clustering settings
  maxClusterSize: number;          // Max markets per cluster
  minClusterConfidence: number;    // Min confidence to form cluster

  // Cache settings
  embeddingCacheTtl: number;       // Embedding cache TTL (ms)

  // Arbitrage detection
  minArbSpread: number;            // Minimum spread for arb (default 0.02)
  platformFees: Record<string, number>;
}

/**
 * Default ML configuration
 */
export const DEFAULT_ML_CONFIG: MLMatchConfig = {
  embeddingModel: 'openai',
  embeddingDimension: 1536,

  minEmbeddingSimilarity: 0.85,
  minOverallScore: 0.75,

  weights: {
    embedding: 0.40,
    entity: 0.30,
    date: 0.15,
    category: 0.15,
  },

  maxClusterSize: 10,
  minClusterConfidence: 0.70,

  embeddingCacheTtl: 1000 * 60 * 30, // 30 minutes

  minArbSpread: 0.02, // 2%
  platformFees: {
    polymarket: 0.01,  // 1% fee
    kalshi: 0.01,
    manifold: 0.00,    // No fee
    jupiter: 0.02,     // 2% Jupiter fee
    limitless: 0.01,
  },
};

// =============================================================================
// FEED TYPES
// =============================================================================

/**
 * Types of market feeds
 */
export type FeedType =
  | 'hot'           // High volume, multiple platforms
  | 'closing_soon'  // < 24h to resolution
  | 'arbitrage'     // Price divergence > threshold
  | 'new'           // < 24h old, gaining traction
  | 'trending'      // Recent volume spike
  | 'category';     // Filtered by category

/**
 * Feed query options
 */
export interface FeedQuery {
  type: FeedType;
  category?: MarketCategory;
  limit?: number;
  offset?: number;
  minLiquidity?: number;
  platforms?: DataPlatform[];
}

/**
 * Feed response
 */
export interface FeedResponse {
  type: FeedType;
  markets: MLMatchResult[];
  total: number;
  hasMore: boolean;
  fetchedAt: Date;
  latencyMs: number;
}

// =============================================================================
// CLUSTERING TYPES
// =============================================================================

/**
 * Market cluster (group of similar markets)
 */
export interface MarketCluster {
  clusterId: string;
  centroid: number[];         // Average embedding
  markets: PlatformMarket[];
  confidence: number;
  canonicalQuestion: string;
}

/**
 * Clustering result
 */
export interface ClusteringResult {
  clusters: MarketCluster[];
  orphans: PlatformMarket[];  // Markets that didn't match any cluster
  stats: {
    totalMarkets: number;
    totalClusters: number;
    avgClusterSize: number;
    avgConfidence: number;
  };
}

// =============================================================================
// SIMILARITY SCORES
// =============================================================================

/**
 * Detailed similarity breakdown
 */
export interface SimilarityScore {
  overall: number;
  components: {
    embedding: number;
    entity: number;
    date: number;
    category: number;
  };
  details: {
    matchedEntities: string[];
    conflictingEntities: string[];
    dateDifferencesDays: number | null;
    categoryMatch: boolean;
  };
}
