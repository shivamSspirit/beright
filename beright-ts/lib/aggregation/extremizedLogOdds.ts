/**
 * Extremized Log-Odds Aggregation
 *
 * State-of-the-art probability aggregation based on:
 * - Satopää et al. (2014) "Combining Probability Forecasts"
 * - Good Judgment Project extremizing methodology
 * - Logarithmic Opinion Pooling (minimizes KL divergence)
 *
 * This method outperforms simple volume-weighted averaging by:
 * 1. Working in log-odds space (preserves tail information)
 * 2. Applying extremization to correct for information overlap
 * 3. Using platform calibration scores for weighting
 *
 * Empirical evidence: ~20% Brier score improvement vs linear averaging
 *
 * @author BeRight Protocol
 * @version 4.0.0
 */

import { DataPlatform } from '../data/types';
import { PLATFORM_CALIBRATION, getPlatformAccuracy } from './lmsr';

// =============================================================================
// TYPES
// =============================================================================

export interface LogOddsInput {
  platform: DataPlatform;
  probability: number;
  volume?: number;
  liquidity?: number;
  /** Optional override for platform calibration score */
  calibrationScore?: number;
}

export interface ExtremizedResult {
  /** Final aggregated probability after extremization */
  probability: number;
  /** Pre-extremization probability (for comparison) */
  rawProbability: number;
  /** Log-odds value before conversion */
  logOdds: number;
  /** Confidence score (0-1) */
  confidence: number;
  /** Extremizing factor used */
  extremizingFactor: number;
  /** Per-platform breakdown */
  platformContributions: {
    platform: DataPlatform;
    probability: number;
    logOdds: number;
    weight: number;
    normalizedWeight: number;
  }[];
  /** Method metadata */
  method: 'extremized_log_odds';
}

export interface EdgeCalculation {
  /** Consensus market probability */
  consensus: number;
  /** AI fair probability estimate */
  aiProbability: number;
  /** Raw edge (signed: positive = YES underpriced) */
  edge: number;
  /** Absolute edge magnitude */
  edgeMagnitude: number;
  /** Direction: YES if edge > 0, NO if edge < 0 */
  direction: 'YES' | 'NO' | 'NEUTRAL';
  /** Confidence in the edge */
  confidence: number;
  /** Kelly criterion optimal fraction */
  kellyFraction: number;
  /** Half-Kelly (recommended for safety) */
  halfKelly: number;
  /** Suggested position size (capped at 2.5%) */
  suggestedSize: number;
  /** Actionable edge after estimated fees */
  actionableEdge: number;
  /** Is this edge worth trading? */
  isActionable: boolean;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface ExtremizingConfig {
  /**
   * Extremizing factor (d)
   * - 1.0 = no extremizing
   * - 1.5 = moderate (recommended for prediction markets)
   * - 1.73 = optimal for worst-case (Satopää et al.)
   * - 2.0 = aggressive
   */
  extremizingFactor: number;

  /** Minimum probability (avoid log(0)) */
  minProbability: number;

  /** Maximum probability */
  maxProbability: number;

  /** Minimum platforms required for high confidence */
  minPlatformsForHighConfidence: number;

  /** Estimated round-trip fees (for actionable edge calculation) */
  estimatedFees: number;

  /** Minimum edge to consider actionable */
  minActionableEdge: number;

  /** Maximum position size (Kelly cap) */
  maxPositionSize: number;
}

export const DEFAULT_EXTREMIZING_CONFIG: ExtremizingConfig = {
  extremizingFactor: 1.5,
  minProbability: 0.01,
  maxProbability: 0.99,
  minPlatformsForHighConfidence: 3,
  estimatedFees: 0.02, // 2% typical platform fees
  minActionableEdge: 0.03, // 3% minimum edge
  maxPositionSize: 0.025, // 2.5% max per Kelly research
};

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Convert probability to log-odds
 *
 * log_odds = log(p / (1 - p))
 */
export function toLogOdds(probability: number, config = DEFAULT_EXTREMIZING_CONFIG): number {
  const p = Math.max(config.minProbability, Math.min(config.maxProbability, probability));
  return Math.log(p / (1 - p));
}

/**
 * Convert log-odds back to probability
 *
 * p = 1 / (1 + exp(-log_odds))
 */
export function fromLogOdds(logOdds: number, config = DEFAULT_EXTREMIZING_CONFIG): number {
  const p = 1 / (1 + Math.exp(-logOdds));
  return Math.max(config.minProbability, Math.min(config.maxProbability, p));
}

/**
 * Calculate weight for a platform based on calibration, volume, and liquidity
 */
export function calculatePlatformWeight(input: LogOddsInput): number {
  // Base calibration score (1 - Brier, so higher is better)
  const calibration = input.calibrationScore !== undefined
    ? input.calibrationScore
    : getPlatformAccuracy(input.platform);

  // Volume component (sqrt for diminishing returns)
  const volumeWeight = Math.sqrt(input.volume || 1);

  // Liquidity component (sqrt for diminishing returns)
  const liquidityWeight = Math.sqrt(input.liquidity || 1);

  // Combined weight: calibration × sqrt(volume) × sqrt(liquidity)
  return calibration * volumeWeight * liquidityWeight;
}

/**
 * Extremized Log-Odds Aggregation
 *
 * The state-of-the-art aggregation method:
 *
 * 1. Convert all probabilities to log-odds space
 * 2. Compute weighted mean of log-odds (logarithmic pooling)
 * 3. Apply extremizing transformation (push toward certainty)
 * 4. Convert back to probability
 *
 * @param inputs - Array of platform probabilities with metadata
 * @param config - Configuration options
 * @returns Aggregated probability with metadata
 */
export function extremizedLogOddsAggregate(
  inputs: LogOddsInput[],
  config: ExtremizingConfig = DEFAULT_EXTREMIZING_CONFIG
): ExtremizedResult {
  // Handle edge cases
  if (inputs.length === 0) {
    return {
      probability: 0.5,
      rawProbability: 0.5,
      logOdds: 0,
      confidence: 0,
      extremizingFactor: config.extremizingFactor,
      platformContributions: [],
      method: 'extremized_log_odds',
    };
  }

  if (inputs.length === 1) {
    const input = inputs[0];
    const logOdds = toLogOdds(input.probability, config);
    const extremizedLogOdds = config.extremizingFactor * logOdds;

    return {
      probability: fromLogOdds(extremizedLogOdds, config),
      rawProbability: input.probability,
      logOdds: extremizedLogOdds,
      confidence: 0.4, // Low confidence with single source
      extremizingFactor: config.extremizingFactor,
      platformContributions: [{
        platform: input.platform,
        probability: input.probability,
        logOdds,
        weight: 1,
        normalizedWeight: 1,
      }],
      method: 'extremized_log_odds',
    };
  }

  // Step 1: Calculate weights and convert to log-odds
  const contributions: ExtremizedResult['platformContributions'] = [];
  let totalWeight = 0;

  for (const input of inputs) {
    const weight = calculatePlatformWeight(input);
    const logOdds = toLogOdds(input.probability, config);

    contributions.push({
      platform: input.platform,
      probability: input.probability,
      logOdds,
      weight,
      normalizedWeight: 0, // Will be normalized below
    });

    totalWeight += weight;
  }

  // Normalize weights
  for (const c of contributions) {
    c.normalizedWeight = totalWeight > 0 ? c.weight / totalWeight : 1 / contributions.length;
  }

  // Step 2: Weighted mean in log-odds space (logarithmic pooling)
  const meanLogOdds = contributions.reduce(
    (sum, c) => sum + c.logOdds * c.normalizedWeight,
    0
  );

  // Step 3: Apply extremization
  // Formula: x_extremized = d * x_mean
  // This pushes the log-odds away from 0 (probability away from 0.5)
  const extremizedLogOdds = config.extremizingFactor * meanLogOdds;

  // Step 4: Convert back to probability
  const rawProbability = fromLogOdds(meanLogOdds, config);
  const extremizedProbability = fromLogOdds(extremizedLogOdds, config);

  // Calculate confidence based on:
  // 1. Number of platforms (more = better)
  // 2. Agreement between platforms (lower variance = better)
  // 3. Total weight (more volume/liquidity = better)
  const platformCount = inputs.length;
  const platformScore = Math.min(1, platformCount / config.minPlatformsForHighConfidence);

  const logOddsValues = contributions.map(c => c.logOdds);
  const variance = calculateVariance(logOddsValues);
  const agreementScore = Math.max(0, 1 - Math.sqrt(variance) * 0.5);

  const weightScore = Math.min(1, Math.log10(totalWeight + 1) / 3);

  const confidence = (platformScore * 0.4 + agreementScore * 0.4 + weightScore * 0.2);

  return {
    probability: extremizedProbability,
    rawProbability,
    logOdds: extremizedLogOdds,
    confidence,
    extremizingFactor: config.extremizingFactor,
    platformContributions: contributions,
    method: 'extremized_log_odds',
  };
}

/**
 * Calculate edge between AI probability and market consensus
 *
 * Implements full edge calculation with Kelly sizing
 */
export function calculateEdge(
  aiProbability: number,
  marketInputs: LogOddsInput[],
  config: ExtremizingConfig = DEFAULT_EXTREMIZING_CONFIG
): EdgeCalculation {
  // Get market consensus using extremized log-odds
  const aggregation = extremizedLogOddsAggregate(marketInputs, config);
  const consensus = aggregation.probability;

  // Calculate edge (signed)
  const edge = aiProbability - consensus;
  const edgeMagnitude = Math.abs(edge);

  // Determine direction
  let direction: 'YES' | 'NO' | 'NEUTRAL' = 'NEUTRAL';
  if (edge > 0.02) {
    direction = 'YES';
  } else if (edge < -0.02) {
    direction = 'NO';
  }

  // Kelly criterion calculation
  // f* = (bp - q) / b where:
  // b = odds received (for binary: 1/price - 1)
  // p = true probability (our AI estimate)
  // q = 1 - p
  const price = direction === 'YES' ? consensus : 1 - consensus;
  const b = (1 / price) - 1; // Odds
  const p = direction === 'YES' ? aiProbability : 1 - aiProbability;
  const q = 1 - p;

  let kellyFraction = (b * p - q) / b;
  kellyFraction = Math.max(0, Math.min(1, kellyFraction)); // Clamp 0-1

  const halfKelly = kellyFraction / 2;

  // Suggested size (capped per research)
  const suggestedSize = Math.min(halfKelly, config.maxPositionSize);

  // Actionable edge (after fees)
  const actionableEdge = edgeMagnitude - config.estimatedFees;

  // Is this worth trading?
  const isActionable =
    actionableEdge >= config.minActionableEdge &&
    aggregation.confidence >= 0.5 &&
    direction !== 'NEUTRAL';

  return {
    consensus,
    aiProbability,
    edge,
    edgeMagnitude,
    direction,
    confidence: aggregation.confidence,
    kellyFraction,
    halfKelly,
    suggestedSize,
    actionableEdge,
    isActionable,
  };
}

/**
 * Adaptive extremizing factor based on platform diversity
 *
 * More diverse sources → more extremizing needed
 * Single source → less extremizing
 */
export function calculateAdaptiveExtremizingFactor(
  inputs: LogOddsInput[],
  baseConfig: ExtremizingConfig = DEFAULT_EXTREMIZING_CONFIG
): number {
  if (inputs.length <= 1) {
    return 1.0; // No extremizing for single source
  }

  // Calculate diversity score based on:
  // 1. Number of unique platforms
  // 2. Variance in probabilities (disagreement = more info diversity)

  const platformCount = new Set(inputs.map(i => i.platform)).size;
  const platformDiversity = Math.min(1, platformCount / 5); // Max out at 5 platforms

  const probabilities = inputs.map(i => i.probability);
  const variance = calculateVariance(probabilities);
  const disagreementScore = Math.min(1, variance * 10); // Scale variance

  // Higher diversity → higher extremizing factor (up to 2.0)
  // Formula: d = 1 + (diversity_score * 0.73)
  // This gives range of 1.0 (no diversity) to 1.73 (max diversity, per Satopää optimal)
  const diversityScore = (platformDiversity * 0.6 + disagreementScore * 0.4);
  const adaptiveFactor = 1 + (diversityScore * 0.73);

  return Math.min(adaptiveFactor, 2.0);
}

/**
 * Full aggregation with adaptive extremizing
 */
export function adaptiveExtremizedAggregate(
  inputs: LogOddsInput[],
  baseConfig: ExtremizingConfig = DEFAULT_EXTREMIZING_CONFIG
): ExtremizedResult {
  const adaptiveFactor = calculateAdaptiveExtremizingFactor(inputs, baseConfig);

  const config: ExtremizingConfig = {
    ...baseConfig,
    extremizingFactor: adaptiveFactor,
  };

  return extremizedLogOddsAggregate(inputs, config);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map(v => (v - mean) ** 2);
  return squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

/**
 * Quick consensus price calculation using extremized log-odds
 *
 * Drop-in replacement for simple volume-weighted average
 */
export function calculateExtremizedConsensus(
  platforms: { platform: DataPlatform; yesPrice: number; volume?: number; liquidity?: number }[]
): number {
  const inputs: LogOddsInput[] = platforms.map(p => ({
    platform: p.platform,
    probability: p.yesPrice,
    volume: p.volume,
    liquidity: p.liquidity,
  }));

  const result = extremizedLogOddsAggregate(inputs);
  return result.probability;
}

/**
 * Calculate consensus with full metadata
 */
export function calculateExtremizedConsensusWithMeta(
  platforms: { platform: DataPlatform; yesPrice: number; volume?: number; liquidity?: number }[]
): ExtremizedResult {
  const inputs: LogOddsInput[] = platforms.map(p => ({
    platform: p.platform,
    probability: p.yesPrice,
    volume: p.volume,
    liquidity: p.liquidity,
  }));

  return adaptiveExtremizedAggregate(inputs);
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default {
  toLogOdds,
  fromLogOdds,
  calculatePlatformWeight,
  extremizedLogOddsAggregate,
  adaptiveExtremizedAggregate,
  calculateAdaptiveExtremizingFactor,
  calculateEdge,
  calculateExtremizedConsensus,
  calculateExtremizedConsensusWithMeta,
  DEFAULT_EXTREMIZING_CONFIG,
};
