/**
 * AI Analyst Types
 *
 * Structured types for superforecaster-style analysis.
 * Based on Philip Tetlock's methodology from "Superforecasting."
 *
 * @author BeRight Protocol
 * @version 3.0.0 - Bloomberg Terminal Architecture
 */

import { UnifiedMarket } from '../dataFabric/types';

// =============================================================================
// ANALYST OUTPUT TYPES
// =============================================================================

/**
 * Full analysis output from the AI Analyst
 */
export interface AnalystOutput {
  // Market info
  market: {
    id: string;
    question: string;
    category: string;
    closeDate?: Date;
    url?: string;
  };

  // Timestamp
  analyzedAt: Date;
  analysisVersion: string;

  // Core prediction
  prediction: {
    probability: number;          // Our model estimate (0-1)
    marketPrice: number;          // Current market consensus
    edge: number;                 // model - market (positive = underpriced)
    direction: 'YES' | 'NO' | 'NEUTRAL';
    confidence: ConfidenceLevel;
  };

  // Reasoning (transparent chain)
  reasoning: {
    outsideView: OutsideViewAnalysis;
    insideView: InsideViewAnalysis;
    synthesis: SynthesisAnalysis;
  };

  // Trading recommendation
  recommendation: TradingRecommendation;

  // Uncertainty & caveats
  uncertainty: UncertaintyAnalysis;

  // Metadata
  metadata: {
    dataPoints: number;
    sourcesUsed: string[];
    modelConfidence: number;      // How confident the model is in its output
    computeTimeMs: number;
  };
}

// =============================================================================
// REASONING COMPONENTS
// =============================================================================

/**
 * Confidence levels
 */
export type ConfidenceLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';

/**
 * Outside View (Base Rate) Analysis
 * "What happens in similar situations historically?"
 */
export interface OutsideViewAnalysis {
  // Reference class
  referenceClass: string;         // "Elections where incumbent is trailing"
  baseRate: number;               // Historical probability (0-1)
  sampleSize?: number;            // How many similar cases
  confidence: ConfidenceLevel;

  // Supporting data
  historicalExamples?: {
    event: string;
    outcome: boolean;
    year?: number;
  }[];

  // Explanation
  reasoning: string;
}

/**
 * Inside View Analysis
 * "What's specific about this case?"
 */
export interface InsideViewAnalysis {
  // Evidence for YES
  bullishFactors: EvidenceFactor[];

  // Evidence for NO
  bearishFactors: EvidenceFactor[];

  // Net assessment
  netDirection: 'bullish' | 'bearish' | 'neutral';
  insideAdjustment: number;       // How much to adjust from base rate (-0.3 to +0.3)

  // Key differentiators
  uniqueFactors: string[];        // What makes this case different
}

/**
 * Individual evidence factor
 */
export interface EvidenceFactor {
  factor: string;                 // "Recent poll shows 5-point lead"
  source?: string;                // "538 polling average"
  weight: 'weak' | 'moderate' | 'strong';
  direction: 'bullish' | 'bearish';
  confidence: number;             // 0-1
}

/**
 * Synthesis of outside + inside view
 */
export interface SynthesisAnalysis {
  // How we combined views
  method: string;                 // "Weighted average with inside view adjustment"

  // Step-by-step probability update
  probabilityChain: {
    step: string;
    value: number;
    reasoning: string;
  }[];

  // Final synthesis
  finalProbability: number;
  synthesisReasoning: string;
}

// =============================================================================
// TRADING RECOMMENDATION
// =============================================================================

/**
 * Actionable trading recommendation
 */
export interface TradingRecommendation {
  // Action
  action: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' | 'NO_TRADE';
  direction: 'YES' | 'NO' | null;

  // Sizing (Kelly-inspired)
  suggestedSize: 'skip' | 'small' | 'medium' | 'large';
  kellyFraction?: number;         // Full Kelly (for reference)
  halfKelly?: number;             // Recommended (safer)

  // Entry/Exit
  entryPrice?: number;            // Current price is entry
  targetPrice?: number;           // Price target
  stopLoss?: number;              // Exit if price moves against

  // Reasoning
  reasoning: string;
  edgeExplanation: string;

  // Warnings
  warnings: string[];
}

// =============================================================================
// UNCERTAINTY ANALYSIS
// =============================================================================

/**
 * Analysis of what we don't know
 */
export interface UncertaintyAnalysis {
  // Known unknowns
  knownUnknowns: string[];        // "Debate performance not yet factored in"

  // Potential black swans
  potentialSurprises: {
    event: string;
    impact: 'minor' | 'major' | 'extreme';
    probability: 'unlikely' | 'possible' | 'likely';
  }[];

  // Model limitations
  modelLimitations: string[];

  // Contrarian check
  contrarian: {
    steelManOpposite: string;     // Best argument against our view
    whyWeDisagree: string;
  };

  // Confidence interval
  confidenceInterval?: {
    low: number;                  // 10th percentile
    mid: number;                  // 50th percentile (our estimate)
    high: number;                 // 90th percentile
  };
}

// =============================================================================
// QUICK ANALYSIS TYPES
// =============================================================================

/**
 * Quick take (faster, less detailed)
 */
export interface QuickTake {
  market: {
    id: string;
    question: string;
  };

  probability: number;
  marketPrice: number;
  edge: number;

  direction: 'YES' | 'NO' | 'NEUTRAL';
  confidence: ConfidenceLevel;

  oneLiner: string;               // "Market underpricing YES by ~5%"
  keyReason: string;              // Main reasoning

  action: 'BUY_YES' | 'BUY_NO' | 'HOLD' | 'SKIP';
}

// =============================================================================
// REQUEST TYPES
// =============================================================================

/**
 * Analysis request options
 */
export interface AnalysisRequest {
  // What to analyze
  market?: UnifiedMarket;         // If already have market data
  marketId?: string;              // Or lookup by ID
  question?: string;              // Or natural language question

  // Analysis depth
  depth: 'quick' | 'standard' | 'deep';

  // What to include
  includeNews?: boolean;
  includeSocial?: boolean;
  includeHistorical?: boolean;

  // Customization
  userContext?: string;           // Additional context from user
  priorBelief?: number;           // User's prior probability (if any)
}

// =============================================================================
// CALIBRATION TYPES
// =============================================================================

/**
 * Calibration record for tracking accuracy
 */
export interface CalibrationRecord {
  analysisId: string;
  marketId: string;
  question: string;

  // Prediction
  predictedProbability: number;
  predictedAt: Date;
  marketPriceAtPrediction: number;

  // Resolution (filled in later)
  resolved?: boolean;
  resolvedAt?: Date;
  actualOutcome?: boolean;        // true = YES, false = NO

  // Scoring
  brierScore?: number;            // (prediction - outcome)^2
  logScore?: number;              // Log scoring rule

  // Context
  analysisDepth: 'quick' | 'standard' | 'deep';
  confidence: ConfidenceLevel;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate Kelly criterion for position sizing
 */
export function calculateKelly(edge: number, odds: number): number {
  // Kelly formula: f* = (bp - q) / b
  // where b = odds, p = probability of winning, q = 1-p
  // Simplified for binary markets: f* = edge / (1 - marketPrice)
  if (odds <= 0 || odds >= 1) return 0;

  const kellyFraction = edge / (1 - odds);

  // Cap at 25% (never more than quarter kelly in practice)
  return Math.max(0, Math.min(kellyFraction, 0.25));
}

/**
 * Get confidence level from probability certainty
 */
export function getConfidenceLevel(certainty: number): ConfidenceLevel {
  // certainty = how far from 50% (0-0.5)
  const c = Math.abs(certainty - 0.5);

  if (c >= 0.4) return 'very_high';   // 90%+ or 10%-
  if (c >= 0.3) return 'high';        // 80%+ or 20%-
  if (c >= 0.2) return 'medium';      // 70%+ or 30%-
  if (c >= 0.1) return 'low';         // 60%+ or 40%-
  return 'very_low';                  // Close to 50%
}

/**
 * Calculate Brier score
 */
export function calculateBrierScore(prediction: number, outcome: boolean): number {
  const actual = outcome ? 1 : 0;
  return Math.pow(prediction - actual, 2);
}

/**
 * Convert confidence to numeric score
 */
export function confidenceToScore(confidence: ConfidenceLevel): number {
  const scores: Record<ConfidenceLevel, number> = {
    'very_low': 0.2,
    'low': 0.4,
    'medium': 0.6,
    'high': 0.8,
    'very_high': 0.95,
  };
  return scores[confidence];
}

/**
 * Get action from edge and confidence
 */
export function getAction(
  edge: number,
  confidence: ConfidenceLevel
): 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' | 'NO_TRADE' {
  const confScore = confidenceToScore(confidence);

  // Need meaningful edge and confidence
  if (Math.abs(edge) < 0.02 || confScore < 0.4) return 'NO_TRADE';

  const isPositiveEdge = edge > 0;  // Market underpriced
  const strongEdge = Math.abs(edge) > 0.1;

  if (isPositiveEdge) {
    if (strongEdge && confScore >= 0.7) return 'STRONG_BUY';
    if (confScore >= 0.5) return 'BUY';
    return 'HOLD';
  } else {
    if (strongEdge && confScore >= 0.7) return 'STRONG_SELL';
    if (confScore >= 0.5) return 'SELL';
    return 'HOLD';
  }
}
