/**
 * Production-Grade Arbitrage Detection Types
 *
 * Designed for real capital management with institutional-grade
 * validation, risk controls, and execution planning.
 */

import { Platform, Market } from '../../types/index';

// ============================================
// MARKET EQUIVALENCE TYPES
// ============================================

/**
 * Structured market metadata for equivalence checking
 * These are the hard requirements for "same market"
 */
export interface MarketMetadata {
  // Core identification
  platform: Platform;
  marketId: string;
  title: string;

  // Event structure
  eventDate: Date | null;           // When the event occurs
  resolutionDate: Date | null;      // When market resolves
  resolutionSource: string | null;  // e.g., "AP", "Official Results"

  // Outcome structure
  outcomeType: 'binary' | 'multi' | 'scalar';
  outcomes: string[];               // ["Yes", "No"] or ["Trump", "Biden", "Other"]

  // Category/topic
  category: MarketCategory;
  subcategory: string | null;

  // Extracted entities
  entities: ExtractedEntities;
}

export type MarketCategory =
  | 'politics'
  | 'economics'
  | 'crypto'
  | 'sports'
  | 'tech'
  | 'entertainment'
  | 'science'
  | 'other';

/**
 * Named entities extracted from market question
 */
export interface ExtractedEntities {
  people: string[];         // "Trump", "Biden"
  organizations: string[];  // "Fed", "SEC", "Tesla"
  locations: string[];      // "US", "China", "Taiwan"
  dates: ExtractedDate[];   // Parsed date references
  amounts: ExtractedAmount[]; // "$100K", "3%"
  events: string[];         // "Super Bowl", "Election"
}

export interface ExtractedDate {
  raw: string;              // "by end of 2025"
  normalized: Date | null;  // 2025-12-31
  type: 'deadline' | 'event' | 'range';
}

export interface ExtractedAmount {
  raw: string;              // "$100,000"
  value: number;            // 100000
  unit: string;             // "USD", "%", "BTC"
}

// ============================================
// MARKET MATCHING TYPES
// ============================================

/**
 * Result of comparing two markets for equivalence
 */
export interface EquivalenceScore {
  // Overall confidence that these are the same market
  overallScore: number;           // 0-1, require >= 0.85 for arbitrage

  // Component scores
  titleSimilarity: number;        // Text similarity (0-1)
  entityOverlap: number;          // Same people/orgs/events (0-1)
  dateAlignment: number;          // Same timeframe (0-1)
  categoryMatch: number;          // Same category (0 or 1)
  outcomeAlignment: number;       // Same outcome structure (0-1)

  // Validation flags (must all be true for real arbitrage)
  validations: EquivalenceValidations;

  // Reasons for any score reductions
  warnings: string[];
  disqualifiers: string[];
}

export interface EquivalenceValidations {
  sameCoreEvent: boolean;         // About the same underlying event
  sameTimeframe: boolean;         // Resolves at same time (within tolerance)
  sameOutcomeStructure: boolean;  // Yes/No maps correctly
  noResolutionConflict: boolean;  // Resolution criteria don't conflict
  entitiesMatch: boolean;         // Key entities are the same
}

/**
 * A validated market pair that passed equivalence checks
 */
export interface ValidatedMarketPair {
  marketA: Market;
  marketB: Market;
  metadataA: MarketMetadata;
  metadataB: MarketMetadata;
  equivalence: EquivalenceScore;

  // Mapping of outcomes between platforms
  outcomeMapping: OutcomeMapping;
}

export interface OutcomeMapping {
  // Maps outcome index from A to B
  // e.g., { 0: 0, 1: 1 } for Yes/No alignment
  // or { 0: 1, 1: 0 } if platforms have inverted outcomes
  aToB: Record<number, number>;
  bToA: Record<number, number>;
  isInverted: boolean;
}

// ============================================
// PRICING & EXECUTION TYPES
// ============================================

/**
 * Executable price with full order book context
 */
export interface ExecutablePrice {
  // Mid-market price
  midPrice: number;

  // Executable prices (what you actually pay/receive)
  bidPrice: number;           // Best price to sell
  askPrice: number;           // Best price to buy
  spread: number;             // askPrice - bidPrice

  // Liquidity at these prices
  bidSize: number;            // Volume available at bid
  askSize: number;            // Volume available at ask

  // Depth beyond top of book
  depth: OrderBookDepth;

  // Freshness
  timestamp: Date;
  isStale: boolean;           // > 30 seconds old
}

export interface OrderBookDepth {
  // How much can we execute at various slippage levels
  volumeAt1Pct: number;       // Volume within 1% slippage
  volumeAt2Pct: number;       // Volume within 2% slippage
  volumeAt5Pct: number;       // Volume within 5% slippage

  // Price impact for common order sizes
  priceImpact100: number;     // Impact of $100 order
  priceImpact1000: number;    // Impact of $1000 order
  priceImpact10000: number;   // Impact of $10000 order
}

/**
 * Platform-specific fee structure
 */
export interface FeeStructure {
  tradingFee: number;         // Per-trade fee (0.01 = 1%)
  withdrawalFee: number;      // Fee to withdraw funds
  settlementFee: number;      // Fee on winning positions

  // Some platforms have tiered fees
  volumeDiscounts: Array<{ minVolume: number; feeRate: number }>;
}

// ============================================
// ARBITRAGE OPPORTUNITY TYPES
// ============================================

/**
 * A potential arbitrage opportunity before risk checks
 */
export interface RawArbitrageOpportunity {
  pair: ValidatedMarketPair;

  // Prices for each leg
  legA: ArbitrageLeg;
  legB: ArbitrageLeg;

  // Raw calculations (before fees/slippage)
  rawSpread: number;          // Price difference
  rawProfitPct: number;       // Theoretical profit %
}

export interface ArbitrageLeg {
  platform: Platform;
  market: Market;
  side: 'YES' | 'NO';
  action: 'BUY' | 'SELL';

  // Pricing
  targetPrice: number;        // Price we want
  executablePrice: ExecutablePrice;

  // Costs
  fees: FeeStructure;
  estimatedSlippage: number;
}

/**
 * Validated arbitrage opportunity with full risk assessment
 */
export interface ValidatedArbitrageOpportunity {
  // Core identification
  id: string;
  timestamp: Date;

  // Market pair
  pair: ValidatedMarketPair;

  // Strategy details
  strategy: ArbitrageStrategy;

  // Profit calculations (after all costs)
  netProfitPct: number;       // Expected profit after fees/slippage
  grossProfitPct: number;     // Profit before costs
  totalCosts: CostBreakdown;

  // Risk assessment
  risk: RiskAssessment;

  // Execution plan
  execution: ExecutionPlan;

  // Confidence & scoring
  confidence: ArbitrageConfidence;
}

export type ArbitrageStrategyType =
  | 'CROSS_PLATFORM_SPREAD'   // Buy YES on A + NO on B (or vice versa)
  | 'SYNTHETIC_CONVERSION'    // Convert position via third platform
  | 'IMPLIED_ODDS_MISMATCH';  // Multi-outcome probability doesn't sum to 1

export interface ArbitrageStrategy {
  type: ArbitrageStrategyType;
  description: string;

  // The specific trades required
  legs: ArbitrageLeg[];

  // Guaranteed return (if strategy executes perfectly)
  guaranteedReturn: number;   // 1.0 = break even, 1.03 = 3% profit
}

export interface CostBreakdown {
  tradingFees: number;        // Platform trading fees
  slippage: number;           // Expected execution slippage
  spreadCost: number;         // Bid-ask spread cost
  settlementFees: number;     // Fees on resolution
  totalCost: number;          // Sum of all costs
  costAsPctOfCapital: number; // Total cost as % of capital required
}

// ============================================
// RISK ASSESSMENT TYPES
// ============================================

export interface RiskAssessment {
  // Overall risk score (0-100, lower is better)
  overallRiskScore: number;

  // Risk categories
  executionRisk: ExecutionRisk;
  marketRisk: MarketRisk;
  operationalRisk: OperationalRisk;

  // Risk flags
  flags: RiskFlag[];

  // Is this opportunity safe to execute?
  isSafe: boolean;
  safetyReason: string;
}

export interface ExecutionRisk {
  score: number;              // 0-100

  // Specific risks
  liquidityRisk: number;      // Can we execute the size?
  slippageRisk: number;       // Will price move against us?
  timingRisk: number;         // Can we execute both legs fast enough?

  // Metrics
  maxExecutableSize: number;  // Largest position we can take
  expectedSlippage: number;   // Expected slippage in %
  executionWindowMs: number;  // How fast prices change
}

export interface MarketRisk {
  score: number;              // 0-100

  // Specific risks
  resolutionRisk: number;     // Could platforms resolve differently?
  correlationRisk: number;    // Are outcomes actually equivalent?
  priceVolatility: number;    // How much does price move?

  // Metrics
  historicalVolatility: number;
  resolutionDays: number;     // Days until resolution
}

export interface OperationalRisk {
  score: number;              // 0-100

  // Platform-specific risks
  platformReliability: Record<Platform, number>;
  settlementRisk: number;     // Platform might not pay out
  regulatoryRisk: number;     // Legal/regulatory concerns
}

export type RiskFlagSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface RiskFlag {
  severity: RiskFlagSeverity;
  code: string;
  message: string;
  details?: string;
}

// ============================================
// EXECUTION PLANNING TYPES
// ============================================

export interface ExecutionPlan {
  // Order of execution
  legOrder: number[];         // Which leg to execute first

  // Timing
  estimatedExecutionTimeMs: number;
  maxAcceptableDelayMs: number;

  // Size
  recommendedSize: number;    // In USD
  maxSize: number;            // Maximum safe size
  minSize: number;            // Minimum for profitability

  // Price limits
  maxPriceDeviation: number;  // Cancel if price moves more than this

  // Contingencies
  fallbackStrategy: string;
  abortConditions: string[];
}

// ============================================
// CONFIDENCE SCORING
// ============================================

export interface ArbitrageConfidence {
  // Overall confidence score (0-100)
  score: number;

  // Component scores
  matchConfidence: number;    // How sure we are markets are equivalent
  priceConfidence: number;    // How sure we are of executable prices
  executionConfidence: number;// How sure we are of execution success
  profitConfidence: number;   // How sure we are of profit calculation

  // Interpretation
  grade: ConfidenceGrade;
  recommendation: string;
}

export type ConfidenceGrade =
  | 'A'   // 90-100: High confidence, safe to execute
  | 'B'   // 75-89:  Good confidence, proceed with caution
  | 'C'   // 60-74:  Moderate confidence, small size only
  | 'D'   // 40-59:  Low confidence, manual review required
  | 'F';  // 0-39:   Very low confidence, do not execute

// ============================================
// CONFIGURATION TYPES
// ============================================

export interface ArbitrageConfig {
  // Matching thresholds
  minEquivalenceScore: number;      // Default: 0.85
  minTitleSimilarity: number;       // Default: 0.70
  maxDateDriftDays: number;         // Default: 7

  // Profit thresholds
  minNetProfitPct: number;          // Default: 0.02 (2%)
  minGrossProfitPct: number;        // Default: 0.05 (5%)

  // Risk thresholds
  maxRiskScore: number;             // Default: 50
  maxExecutionRisk: number;         // Default: 40

  // Liquidity requirements
  minLiquidityUsd: number;          // Default: 1000
  minVolumeUsd: number;             // Default: 5000

  // Position sizing
  maxPositionPct: number;           // Max % of available liquidity
  defaultPositionUsd: number;       // Default position size
  maxPositionUsd: number;           // Maximum position size

  // Execution
  maxExecutionTimeMs: number;       // Default: 5000
  maxPriceDeviation: number;        // Default: 0.02 (2%)
}

export const DEFAULT_ARBITRAGE_CONFIG: ArbitrageConfig = {
  // Matching - STRICT thresholds to ensure we only match SAME events
  // High threshold prevents false positives from different markets
  minEquivalenceScore: 0.80,    // 80% overall score required (was 55%)
  minTitleSimilarity: 0.70,     // 70% title similarity minimum (was 45%)
  maxDateDriftDays: 7,          // Within 1 week (was 2 weeks)

  // Profit - Must be profitable AFTER all costs
  minNetProfitPct: 0.02,        // 2% minimum after fees
  minGrossProfitPct: 0.03,      // 3% minimum gross

  // Risk - Moderate limits
  maxRiskScore: 60,
  maxExecutionRisk: 50,

  // Liquidity - Lower bar for discovery
  minLiquidityUsd: 500,
  minVolumeUsd: 1000,

  // Position sizing - Start small
  maxPositionPct: 0.05,
  defaultPositionUsd: 100,
  maxPositionUsd: 1000,

  // Execution - Fast and disciplined
  maxExecutionTimeMs: 5000,
  maxPriceDeviation: 0.02,
};
