/**
 * Signal Aggregator Types
 *
 * Defines all signal types for the unified alpha stream.
 *
 * @author BeRight Protocol
 * @version 3.0.0 - Bloomberg Terminal Architecture
 */

import { DataPlatform } from '../data/types';
import { UnifiedMarket } from '../dataFabric/types';

// =============================================================================
// SIGNAL TYPES
// =============================================================================

/**
 * All possible signal types
 */
export type SignalType =
  | 'WHALE_BET'           // Large position detected
  | 'NEWS_CATALYST'       // Breaking news relevant to market
  | 'VOLUME_SPIKE'        // Unusual trading activity
  | 'ARB_OPPORTUNITY'     // Cross-platform price divergence
  | 'AI_MISPRICING'       // Model vs market disagreement
  | 'SMART_MONEY'         // Pro trader position change
  | 'SOCIAL_BUZZ'         // Twitter/social volume spike
  | 'RESOLUTION_NEAR'     // Market closing soon with edge
  | 'PRICE_MOMENTUM'      // Strong directional move
  | 'CONSENSUS_FLIP'      // Market crossed 50% threshold
  | 'NEW_MARKET'          // New market launched
  | 'INSIDER_PATTERN';    // Unusual pre-event activity

/**
 * Signal urgency level
 */
export type SignalUrgency = 'low' | 'medium' | 'high' | 'critical';

/**
 * Signal source
 */
export type SignalSource =
  | 'arkham'        // Arkham Intelligence
  | 'helius'        // Helius (Solana)
  | 'tavily'        // Tavily web search
  | 'twitter'       // Twitter/X
  | 'reddit'        // Reddit
  | 'internal'      // BeRight internal detection
  | 'polymarket'    // Platform-specific
  | 'kalshi'        // Platform-specific
  | 'manifold';     // Platform-specific

// =============================================================================
// BASE SIGNAL INTERFACE
// =============================================================================

/**
 * Base Signal - All signals extend this
 */
export interface BaseSignal {
  id: string;
  type: SignalType;
  source: SignalSource;

  // Timing
  timestamp: Date;
  expiresAt?: Date;           // Signal validity window

  // Scoring
  confidence: number;         // 0-1 scale
  urgency: SignalUrgency;

  // Display
  title: string;
  description: string;
  emoji: string;

  // Action suggestion
  suggestedAction?: {
    direction: 'YES' | 'NO';
    size: 'small' | 'medium' | 'large';
    reasoning: string;
  };
}

/**
 * Market-linked Signal (most signals)
 */
export interface MarketSignal extends BaseSignal {
  market: {
    id: string;
    question: string;
    platform: DataPlatform;
    url?: string;
    currentPrice: number;
  };
}

// =============================================================================
// SPECIFIC SIGNAL DATA TYPES
// =============================================================================

/**
 * Whale Bet Signal Data
 */
export interface WhaleSignalData {
  wallet: string;
  walletLabel?: string;        // Known entity name
  amount: number;              // USD value
  direction: 'YES' | 'NO';
  platform: DataPlatform;
  txHash?: string;
  historicalAccuracy?: number; // 0-1 if known
  isSmartMoney: boolean;
}

export interface WhaleSignal extends MarketSignal {
  type: 'WHALE_BET';
  data: WhaleSignalData;
}

/**
 * News Catalyst Signal Data
 */
export interface NewsSignalData {
  headline: string;
  source: string;              // Publication name
  url: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  relevanceScore: number;      // 0-1
  publishedAt: Date;
  summary?: string;
  entities?: string[];         // People, organizations mentioned
}

export interface NewsSignal extends MarketSignal {
  type: 'NEWS_CATALYST';
  data: NewsSignalData;
}

/**
 * Volume Spike Signal Data
 */
export interface VolumeSpikeData {
  platform: DataPlatform;
  currentVolume: number;
  avgVolume: number;
  spikeMultiplier: number;     // How many X above average
  timeWindowMinutes: number;
  priceChange: number;         // Price change during spike
}

export interface VolumeSpikeSignal extends MarketSignal {
  type: 'VOLUME_SPIKE';
  data: VolumeSpikeData;
}

/**
 * Arbitrage Opportunity Signal Data
 */
export interface ArbSignalData {
  buyPlatform: DataPlatform;
  sellPlatform: DataPlatform;
  buyPrice: number;
  sellPrice: number;
  spread: number;
  spreadPct: number;
  estimatedProfit: number;     // For $100 trade
  requiredCapital: number;
  buyUrl: string;
  sellUrl: string;
}

export interface ArbSignal extends MarketSignal {
  type: 'ARB_OPPORTUNITY';
  data: ArbSignalData;
}

/**
 * AI Mispricing Signal Data
 */
export interface MispricingData {
  marketPrice: number;
  modelPrice: number;
  edge: number;                // model - market
  modelConfidence: number;
  methodology: string;         // How we arrived at model price
  factors: string[];           // Key factors considered
}

export interface MispricingSignal extends MarketSignal {
  type: 'AI_MISPRICING';
  data: MispricingData;
}

/**
 * Social Buzz Signal Data
 */
export interface SocialBuzzData {
  platform: 'twitter' | 'reddit' | 'discord';
  mentionCount: number;
  avgMentions: number;
  spikeMultiplier: number;
  sentiment: 'bullish' | 'bearish' | 'mixed';
  topPosts?: {
    text: string;
    author: string;
    engagement: number;
    url?: string;
  }[];
  influencerMentions?: string[];
}

export interface SocialSignal extends MarketSignal {
  type: 'SOCIAL_BUZZ';
  data: SocialBuzzData;
}

/**
 * Price Momentum Signal Data
 */
export interface MomentumData {
  platform: DataPlatform;
  priceNow: number;
  price1hAgo: number;
  price24hAgo: number;
  change1h: number;
  change24h: number;
  direction: 'up' | 'down';
  strength: 'weak' | 'moderate' | 'strong';
}

export interface MomentumSignal extends MarketSignal {
  type: 'PRICE_MOMENTUM';
  data: MomentumData;
}

/**
 * Resolution Near Signal Data
 */
export interface ResolutionNearData {
  closeDate: Date;
  hoursRemaining: number;
  currentPrice: number;
  expectedResolution?: 'YES' | 'NO' | 'UNCERTAIN';
  volume24h: number;
}

export interface ResolutionNearSignal extends MarketSignal {
  type: 'RESOLUTION_NEAR';
  data: ResolutionNearData;
}

/**
 * Consensus Flip Signal Data
 */
export interface ConsensusFlipData {
  platform: DataPlatform;
  previousPrice: number;
  currentPrice: number;
  crossedThreshold: number;    // 0.5 for 50%
  direction: 'to_yes' | 'to_no';
  timeSinceFlip: number;       // minutes
}

export interface ConsensusFlipSignal extends MarketSignal {
  type: 'CONSENSUS_FLIP';
  data: ConsensusFlipData;
}

// =============================================================================
// UNIFIED SIGNAL TYPE
// =============================================================================

/**
 * Union of all signal types
 */
export type Signal =
  | WhaleSignal
  | NewsSignal
  | VolumeSpikeSignal
  | ArbSignal
  | MispricingSignal
  | SocialSignal
  | MomentumSignal
  | ResolutionNearSignal
  | ConsensusFlipSignal
  | MarketSignal;

// =============================================================================
// DETECTOR TYPES
// =============================================================================

/**
 * Signal detector interface
 */
export interface SignalDetector {
  name: string;
  signalTypes: SignalType[];
  enabled: boolean;

  // Detect signals
  detect(): Promise<Signal[]>;

  // Check if detector is healthy
  isHealthy(): Promise<boolean>;
}

/**
 * Detector configuration
 */
export interface DetectorConfig {
  enabled: boolean;
  pollingIntervalMs: number;
  maxSignalsPerPoll: number;
}

// =============================================================================
// STREAM TYPES
// =============================================================================

/**
 * Signal stream event
 */
export interface SignalStreamEvent {
  type: 'signal' | 'heartbeat' | 'error';
  data: Signal | null;
  timestamp: Date;
}

/**
 * Signal filter options
 */
export interface SignalFilter {
  types?: SignalType[];
  sources?: SignalSource[];
  minConfidence?: number;
  urgency?: SignalUrgency[];
  marketId?: string;
  platforms?: DataPlatform[];
  since?: Date;
  limit?: number;
}

/**
 * Aggregator statistics
 */
export interface AggregatorStats {
  totalSignals: number;
  signalsByType: Record<SignalType, number>;
  signalsBySource: Record<SignalSource, number>;
  avgConfidence: number;
  lastSignalAt?: Date;
  detectorsHealthy: number;
  detectorsTotal: number;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate unique signal ID
 */
export function generateSignalId(type: SignalType, marketId: string, source: SignalSource): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `sig-${type.toLowerCase()}-${timestamp}-${random}`;
}

/**
 * Get emoji for signal type
 */
export function getSignalEmoji(type: SignalType): string {
  const emojis: Record<SignalType, string> = {
    WHALE_BET: '🐋',
    NEWS_CATALYST: '📰',
    VOLUME_SPIKE: '📈',
    ARB_OPPORTUNITY: '💰',
    AI_MISPRICING: '🤖',
    SMART_MONEY: '🧠',
    SOCIAL_BUZZ: '🔥',
    RESOLUTION_NEAR: '⏰',
    PRICE_MOMENTUM: '🚀',
    CONSENSUS_FLIP: '🔄',
    NEW_MARKET: '🆕',
    INSIDER_PATTERN: '👀',
  };
  return emojis[type] || '📊';
}

/**
 * Get urgency from confidence score
 */
export function getUrgencyFromConfidence(confidence: number): SignalUrgency {
  if (confidence >= 0.9) return 'critical';
  if (confidence >= 0.75) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

/**
 * Calculate signal TTL based on type
 */
export function getSignalTTL(type: SignalType): number {
  const ttls: Record<SignalType, number> = {
    WHALE_BET: 30 * 60 * 1000,        // 30 minutes
    NEWS_CATALYST: 4 * 60 * 60 * 1000, // 4 hours
    VOLUME_SPIKE: 15 * 60 * 1000,     // 15 minutes
    ARB_OPPORTUNITY: 5 * 60 * 1000,    // 5 minutes (fast-moving)
    AI_MISPRICING: 2 * 60 * 60 * 1000, // 2 hours
    SMART_MONEY: 60 * 60 * 1000,      // 1 hour
    SOCIAL_BUZZ: 2 * 60 * 60 * 1000,   // 2 hours
    RESOLUTION_NEAR: 24 * 60 * 60 * 1000, // 24 hours
    PRICE_MOMENTUM: 30 * 60 * 1000,   // 30 minutes
    CONSENSUS_FLIP: 60 * 60 * 1000,   // 1 hour
    NEW_MARKET: 24 * 60 * 60 * 1000,  // 24 hours
    INSIDER_PATTERN: 60 * 60 * 1000,  // 1 hour
  };
  return ttls[type] || 60 * 60 * 1000;
}
