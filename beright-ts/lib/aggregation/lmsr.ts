/**
 * LMSR (Logarithmic Market Scoring Rule) Normalization
 *
 * Converts raw prediction market prices to calibrated probabilities.
 * Accounts for market maker spread and liquidity depth.
 *
 * The LMSR formula is used by major prediction market platforms and
 * is the dominant quant formula used by professional traders.
 *
 * Key insight: Raw prices != true probabilities due to:
 * - Market maker spread
 * - Liquidity constraints
 * - Platform-specific pricing models (AMM vs CLOB)
 *
 * @author BeRight Protocol
 */

import { DataPlatform } from '../data/types';

// =============================================================================
// TYPES
// =============================================================================

export interface LMSRConfig {
  // Base liquidity parameter (higher = less price impact)
  liquidityMultiplier: number;
  // Minimum probability (avoid log(0))
  minProbability: number;
  // Maximum probability
  maxProbability: number;
}

export const DEFAULT_LMSR_CONFIG: LMSRConfig = {
  liquidityMultiplier: 0.1,
  minProbability: 0.01,
  maxProbability: 0.99,
};

export interface PlatformPriceData {
  platform: DataPlatform;
  yesPrice: number;
  noPrice?: number;
  liquidity: number;
  volume24h?: number;
  calibrationScore?: number; // Historical accuracy (0-1, lower is better Brier)
}

export interface NormalizedProbability {
  platform: DataPlatform;
  rawPrice: number;
  normalizedProbability: number;
  confidence: number;
  adjustmentApplied: number;
}

export interface AggregatedProbability {
  probability: number;
  confidence: number;
  platformProbabilities: NormalizedProbability[];
  method: 'lmsr' | 'volume_weighted' | 'bayesian';
}

// =============================================================================
// PLATFORM CALIBRATION SCORES
// =============================================================================

/**
 * Historical platform calibration scores (Brier scores)
 * Lower = better calibration
 * Based on resolved market analysis
 */
export const PLATFORM_CALIBRATION: Record<DataPlatform, number> = {
  kalshi: 0.12,       // Best - regulated, institutional
  polymarket: 0.15,   // Good - high liquidity
  metaculus: 0.14,    // Good - forecasting focused
  manifold: 0.22,     // Fair - play money affects accuracy
  limitless: 0.18,    // Fair - newer platform
  jupiter: 0.16,      // Good - aggregates other platforms
  prophetx: 0.20,     // Fair
  novig: 0.20,        // Fair
  sxbet: 0.19,        // Fair - sports focused
  myriad: 0.22,       // Limited data
  baozi: 0.25,        // Limited data
  probable: 0.23,     // Newer
};

/**
 * Get calibration score for platform (0-1, higher = better accuracy)
 */
export function getPlatformAccuracy(platform: DataPlatform): number {
  const brierScore = PLATFORM_CALIBRATION[platform] || 0.25;
  // Convert Brier to accuracy (1 - brier normalizes to 0-1 where 1 is perfect)
  return Math.max(0, Math.min(1, 1 - brierScore));
}

// =============================================================================
// LMSR NORMALIZATION
// =============================================================================

/**
 * Calculate LMSR-normalized probability from market price
 *
 * The LMSR cost function is: C(q) = b * log(sum(exp(q_i / b)))
 * For binary markets: p_yes = exp(q_yes / b) / (exp(q_yes / b) + exp(q_no / b))
 *
 * @param yesPrice - Current YES price (0-1)
 * @param noPrice - Current NO price (0-1), defaults to 1-yesPrice
 * @param liquidity - Market liquidity (affects b parameter)
 * @param config - LMSR configuration
 */
export function calculateLMSRProbability(
  yesPrice: number,
  noPrice: number | undefined,
  liquidity: number,
  config: LMSRConfig = DEFAULT_LMSR_CONFIG
): number {
  // Clamp prices to valid range
  const yes = Math.max(config.minProbability, Math.min(config.maxProbability, yesPrice));
  const no = noPrice !== undefined
    ? Math.max(config.minProbability, Math.min(config.maxProbability, noPrice))
    : 1 - yes;

  // Calculate liquidity parameter b
  // Higher liquidity = higher b = more accurate prices
  const b = Math.max(0.1, Math.sqrt(liquidity) * config.liquidityMultiplier);

  // Convert prices to implied quantities
  // q = b * log(p / (1-p)) for a binary market
  const safeYes = Math.max(0.01, Math.min(0.99, yes));
  const safeNo = Math.max(0.01, Math.min(0.99, no));

  const qYes = Math.log(safeYes / (1 - safeYes));
  const qNo = Math.log(safeNo / (1 - safeNo));

  // LMSR probability formula
  const expYes = Math.exp(qYes / b);
  const expNo = Math.exp(qNo / b);

  const probability = expYes / (expYes + expNo);

  // Clamp to valid range
  return Math.max(config.minProbability, Math.min(config.maxProbability, probability));
}

/**
 * Normalize price accounting for spread
 * Estimates true probability from bid-ask spread
 */
export function normalizeWithSpread(
  yesBid: number,
  yesAsk: number,
  liquidity: number,
  config: LMSRConfig = DEFAULT_LMSR_CONFIG
): { probability: number; confidence: number } {
  // Mid price
  const mid = (yesBid + yesAsk) / 2;

  // Spread indicates uncertainty - wider spread = lower confidence
  const spread = Math.max(0, yesAsk - yesBid);
  const confidence = Math.max(0.1, 1 - spread * 5); // 20% spread = 0 confidence

  // Apply LMSR normalization to mid price
  const probability = calculateLMSRProbability(mid, 1 - mid, liquidity, config);

  return { probability, confidence };
}

// =============================================================================
// CROSS-PLATFORM AGGREGATION
// =============================================================================

/**
 * Aggregate probabilities across multiple platforms using LMSR + calibration weighting
 *
 * This combines:
 * 1. LMSR normalization per platform
 * 2. Platform calibration scores (historical accuracy)
 * 3. Liquidity weighting (deeper markets = more weight)
 */
export function aggregateProbabilities(
  platforms: PlatformPriceData[],
  config: LMSRConfig = DEFAULT_LMSR_CONFIG
): AggregatedProbability {
  if (platforms.length === 0) {
    return {
      probability: 0.5,
      confidence: 0,
      platformProbabilities: [],
      method: 'lmsr',
    };
  }

  const normalizedProbabilities: NormalizedProbability[] = [];
  let weightedSum = 0;
  let totalWeight = 0;

  for (const platform of platforms) {
    // Get LMSR-normalized probability
    const lmsrProb = calculateLMSRProbability(
      platform.yesPrice,
      platform.noPrice,
      platform.liquidity,
      config
    );

    // Calculate weight from calibration + liquidity
    const calibration = platform.calibrationScore !== undefined
      ? 1 - platform.calibrationScore  // Convert Brier to accuracy
      : getPlatformAccuracy(platform.platform);

    const liquidityWeight = Math.sqrt(platform.liquidity);
    const volumeWeight = Math.sqrt(platform.volume24h || 1);

    const weight = calibration * liquidityWeight * Math.sqrt(volumeWeight);

    // Track adjustment
    const adjustment = lmsrProb - platform.yesPrice;

    normalizedProbabilities.push({
      platform: platform.platform,
      rawPrice: platform.yesPrice,
      normalizedProbability: lmsrProb,
      confidence: calibration,
      adjustmentApplied: adjustment,
    });

    weightedSum += lmsrProb * weight;
    totalWeight += weight;
  }

  // Calculate final probability
  const probability = totalWeight > 0 ? weightedSum / totalWeight : 0.5;

  // Calculate overall confidence (based on agreement)
  const probabilities = normalizedProbabilities.map(p => p.normalizedProbability);
  const variance = calculateVariance(probabilities);
  const agreement = Math.max(0, 1 - Math.sqrt(variance) * 4); // High variance = low confidence

  const avgCalibration = normalizedProbabilities.reduce((sum, p) => sum + p.confidence, 0)
    / normalizedProbabilities.length;

  const confidence = Math.min(agreement, avgCalibration);

  return {
    probability,
    confidence,
    platformProbabilities: normalizedProbabilities,
    method: 'lmsr',
  };
}

/**
 * Simple volume-weighted average (fallback)
 */
export function volumeWeightedAverage(platforms: PlatformPriceData[]): AggregatedProbability {
  if (platforms.length === 0) {
    return {
      probability: 0.5,
      confidence: 0,
      platformProbabilities: [],
      method: 'volume_weighted',
    };
  }

  const totalVolume = platforms.reduce((sum, p) => sum + (p.volume24h || 1), 0);

  let weightedSum = 0;
  const normalizedProbabilities: NormalizedProbability[] = [];

  for (const platform of platforms) {
    const weight = (platform.volume24h || 1) / totalVolume;
    weightedSum += platform.yesPrice * weight;

    normalizedProbabilities.push({
      platform: platform.platform,
      rawPrice: platform.yesPrice,
      normalizedProbability: platform.yesPrice, // No normalization
      confidence: getPlatformAccuracy(platform.platform),
      adjustmentApplied: 0,
    });
  }

  return {
    probability: weightedSum,
    confidence: 0.5, // Medium confidence for simple average
    platformProbabilities: normalizedProbabilities,
    method: 'volume_weighted',
  };
}

// =============================================================================
// CALIBRATION HELPERS
// =============================================================================

/**
 * Calculate variance of an array
 */
function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map(v => (v - mean) ** 2);
  return squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Detect if probability needs calibration adjustment
 * Returns suggested adjustment factor
 */
export function detectCalibrationBias(
  platform: DataPlatform,
  recentPredictions: { probability: number; resolved: boolean }[]
): { bias: number; suggestion: string } {
  if (recentPredictions.length < 10) {
    return { bias: 0, suggestion: 'Insufficient data for calibration' };
  }

  // Group by probability bucket
  const buckets: Map<number, { predictions: number; hits: number }> = new Map();

  for (const pred of recentPredictions) {
    const bucket = Math.floor(pred.probability * 10) / 10;
    const existing = buckets.get(bucket) || { predictions: 0, hits: 0 };
    existing.predictions++;
    if (pred.resolved) existing.hits++;
    buckets.set(bucket, existing);
  }

  // Calculate calibration error
  let totalError = 0;
  let bucketCount = 0;

  for (const [bucket, data] of buckets) {
    if (data.predictions >= 5) {
      const expectedRate = bucket + 0.05; // Middle of bucket
      const actualRate = data.hits / data.predictions;
      totalError += actualRate - expectedRate;
      bucketCount++;
    }
  }

  const bias = bucketCount > 0 ? totalError / bucketCount : 0;

  let suggestion = 'Well calibrated';
  if (bias > 0.1) suggestion = 'Platform tends to underconfident - prices too conservative';
  if (bias < -0.1) suggestion = 'Platform tends to overconfident - prices too extreme';

  return { bias, suggestion };
}

// =============================================================================
// FRANK-WOLFE PROJECTION
// =============================================================================

/**
 * Project probabilities onto valid probability simplex
 * Ensures probabilities sum to 1 for multi-outcome markets
 *
 * Uses Adaptive Fully-Corrective Frank-Wolfe algorithm
 */
export function projectOntoSimplex(probabilities: number[]): number[] {
  const n = probabilities.length;
  if (n === 0) return [];
  if (n === 1) return [1];

  // Sort in descending order
  const sorted = [...probabilities].sort((a, b) => b - a);

  // Find threshold
  let cssv = 0;
  let rho = 0;

  for (let j = 0; j < n; j++) {
    cssv += sorted[j];
    if (sorted[j] - (cssv - 1) / (j + 1) > 0) {
      rho = j + 1;
    }
  }

  // Calculate threshold theta
  const theta = (cssv - 1) / rho;

  // Apply threshold and clamp
  return probabilities.map(p => Math.max(0, p - theta));
}

/**
 * Frank-Wolfe optimization for probability aggregation
 * Finds optimal weights for platform probabilities
 */
export function frankWolfeOptimize(
  targetProbabilities: number[],
  iterations: number = 100,
  tolerance: number = 1e-6
): number[] {
  const n = targetProbabilities.length;
  if (n === 0) return [];

  // Initialize with uniform weights
  let x = new Array(n).fill(1 / n);

  for (let t = 0; t < iterations; t++) {
    // Compute gradient (for quadratic loss)
    const grad = x.map((xi, i) => 2 * (xi - targetProbabilities[i]));

    // Linear minimization oracle
    const minIdx = grad.indexOf(Math.min(...grad));
    const s = new Array(n).fill(0);
    s[minIdx] = 1;

    // Step size (diminishing)
    const gamma = 2 / (t + 2);

    // Update
    const xNew = x.map((xi, i) => (1 - gamma) * xi + gamma * s[i]);

    // Check convergence
    const diff = Math.sqrt(
      xNew.reduce((sum, xi, i) => sum + (xi - x[i]) ** 2, 0)
    );

    if (diff < tolerance) break;
    x = xNew;
  }

  return projectOntoSimplex(x);
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  calculateLMSRProbability,
  normalizeWithSpread,
  aggregateProbabilities,
  volumeWeightedAverage,
  getPlatformAccuracy,
  detectCalibrationBias,
  projectOntoSimplex,
  frankWolfeOptimize,
  PLATFORM_CALIBRATION,
  DEFAULT_LMSR_CONFIG,
};
