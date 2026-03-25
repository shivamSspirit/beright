/**
 * Decaying Brier Score for Forecaster Reputation
 *
 * Implements time-weighted Brier scoring where recent predictions
 * matter more than older ones. This prevents forecasters who were
 * accurate in the past but inaccurate recently from maintaining
 * artificially high reputation scores.
 *
 * Formula:
 *   BS_decay = Σ (weight_i × brier_i) / Σ weight_i
 *   where weight_i = e^(-λ × t_i)
 *
 * Parameters:
 *   λ (lambda) = decay rate per day
 *   t = time since resolution in days
 *   half-life = ln(2) / λ ≈ 0.693 / λ
 *
 * Example decay rates:
 *   λ = 0.01  → half-life ≈ 69 days (slow decay, long memory)
 *   λ = 0.02  → half-life ≈ 35 days (moderate decay)
 *   λ = 0.05  → half-life ≈ 14 days (fast decay, recent focus)
 *
 * @author BeRight Protocol
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * A resolved prediction with timestamp for decay calculation
 */
export interface DecayablePrediction {
  id: string;
  probability: number;      // 0-1, forecasted probability
  direction: 'YES' | 'NO';
  outcome: boolean;         // true = YES won
  resolvedAt: Date;
  stakeUsd?: number;        // Optional: for volume-weighted decay
  category?: string;        // Optional: for per-category decay
}

/**
 * Decay configuration
 */
export interface DecayConfig {
  /** Decay rate per day (λ). Default: 0.02 (~35 day half-life) */
  lambda: number;

  /** Minimum weight threshold. Predictions below this are excluded. Default: 0.01 */
  minWeight: number;

  /** Maximum age in days to consider. Default: 365 */
  maxAgeDays: number;

  /** Whether to apply volume weighting on top of time decay. Default: true */
  volumeWeighted: boolean;
}

/**
 * Result of decaying Brier calculation
 */
export interface DecayingBrierResult {
  /** Time-weighted Brier score (0-1, lower = better) */
  decayingBrier: number;

  /** Standard (non-decayed) Brier for comparison */
  standardBrier: number;

  /** Decay improvement: how much better recent performance is */
  decayImprovement: number;

  /** Half-life in days based on current lambda */
  halfLifeDays: number;

  /** Number of predictions included (above min weight) */
  predictionsIncluded: number;

  /** Number of predictions excluded (below min weight) */
  predictionsExcluded: number;

  /** Effective sample size (sum of weights) */
  effectiveSampleSize: number;

  /** Total weight sum */
  totalWeight: number;

  /** Weighted sum of Brier scores */
  weightedBrierSum: number;

  /** Age of oldest included prediction */
  oldestIncludedDays: number;

  /** Age of newest included prediction */
  newestIncludedDays: number;
}

/**
 * Per-category decaying Brier scores
 */
export interface CategoryDecayingBrier {
  category: string;
  decayingBrier: number;
  standardBrier: number;
  predictionCount: number;
  effectiveSampleSize: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default decay configuration */
export const DEFAULT_DECAY_CONFIG: DecayConfig = {
  lambda: 0.02,           // ~35 day half-life
  minWeight: 0.01,        // Exclude predictions with <1% weight
  maxAgeDays: 365,        // Max 1 year lookback
  volumeWeighted: true,
};

/** Preset decay configurations for different use cases */
export const DECAY_PRESETS = {
  /** Slow decay - good for long-term reputation */
  slow: {
    lambda: 0.01,         // ~69 day half-life
    minWeight: 0.001,
    maxAgeDays: 730,      // 2 years
    volumeWeighted: true,
  },

  /** Moderate decay - balanced approach (default) */
  moderate: {
    lambda: 0.02,         // ~35 day half-life
    minWeight: 0.01,
    maxAgeDays: 365,
    volumeWeighted: true,
  },

  /** Fast decay - emphasizes recent performance */
  fast: {
    lambda: 0.05,         // ~14 day half-life
    minWeight: 0.05,
    maxAgeDays: 180,
    volumeWeighted: true,
  },

  /** Slashing - very fast decay for accountability */
  slashing: {
    lambda: 0.1,          // ~7 day half-life
    minWeight: 0.1,
    maxAgeDays: 90,
    volumeWeighted: false,
  },
} as const;

// =============================================================================
// CORE CALCULATIONS
// =============================================================================

/**
 * Calculate exponential decay weight for a given time elapsed
 *
 * weight = e^(-λ × t)
 *
 * @param daysElapsed - Days since prediction resolved
 * @param lambda - Decay rate per day
 * @returns Weight between 0 and 1
 */
export function calculateDecayWeight(daysElapsed: number, lambda: number): number {
  if (daysElapsed < 0) return 1; // Future predictions get full weight
  return Math.exp(-lambda * daysElapsed);
}

/**
 * Calculate half-life from decay rate
 *
 * half-life = ln(2) / λ
 *
 * @param lambda - Decay rate per day
 * @returns Half-life in days
 */
export function calculateHalfLife(lambda: number): number {
  if (lambda <= 0) return Infinity;
  return Math.LN2 / lambda; // ln(2) ≈ 0.693
}

/**
 * Calculate decay rate from desired half-life
 *
 * λ = ln(2) / half-life
 *
 * @param halfLifeDays - Desired half-life in days
 * @returns Decay rate (lambda)
 */
export function calculateLambdaFromHalfLife(halfLifeDays: number): number {
  if (halfLifeDays <= 0) return Infinity;
  return Math.LN2 / halfLifeDays;
}

/**
 * Calculate standard (non-decayed) Brier score for a single prediction
 *
 * Brier = (forecast - actual)²
 *
 * @param probability - Forecasted probability (0-1)
 * @param direction - 'YES' or 'NO'
 * @param outcome - true if YES won
 * @returns Brier score (0-1)
 */
export function calculateBrierScore(
  probability: number,
  direction: 'YES' | 'NO',
  outcome: boolean
): number {
  // Convert to probability of YES outcome
  const forecastYes = direction === 'YES' ? probability : 1 - probability;
  const actual = outcome ? 1 : 0;
  return Math.pow(forecastYes - actual, 2);
}

// =============================================================================
// DECAYING BRIER CALCULATION
// =============================================================================

/**
 * Calculate decaying Brier score across a set of predictions
 *
 * Formula:
 *   BS_decay = Σ (weight_i × brier_i) / Σ weight_i
 *   where weight_i = e^(-λ × t_i) × (optional: √stake_i)
 *
 * @param predictions - Array of resolved predictions
 * @param config - Decay configuration
 * @param referenceDate - Reference point for decay (default: now)
 * @returns Decaying Brier result with metadata
 */
export function calculateDecayingBrier(
  predictions: DecayablePrediction[],
  config: DecayConfig = DEFAULT_DECAY_CONFIG,
  referenceDate: Date = new Date()
): DecayingBrierResult {
  const halfLifeDays = calculateHalfLife(config.lambda);

  if (predictions.length === 0) {
    return {
      decayingBrier: 0.25,     // Neutral/uninformative prior
      standardBrier: 0.25,
      decayImprovement: 0,
      halfLifeDays,
      predictionsIncluded: 0,
      predictionsExcluded: 0,
      effectiveSampleSize: 0,
      totalWeight: 0,
      weightedBrierSum: 0,
      oldestIncludedDays: 0,
      newestIncludedDays: 0,
    };
  }

  let totalWeight = 0;
  let weightedBrierSum = 0;
  let standardBrierSum = 0;
  let predictionsIncluded = 0;
  let predictionsExcluded = 0;
  let oldestIncludedDays = 0;
  let newestIncludedDays = Infinity;

  const referenceMs = referenceDate.getTime();
  const maxAgeMs = config.maxAgeDays * 24 * 60 * 60 * 1000;

  for (const pred of predictions) {
    const resolvedMs = pred.resolvedAt.getTime();
    const ageMs = referenceMs - resolvedMs;
    const ageDays = ageMs / (24 * 60 * 60 * 1000);

    // Skip if too old
    if (ageMs > maxAgeMs) {
      predictionsExcluded++;
      continue;
    }

    // Calculate time decay weight
    let weight = calculateDecayWeight(ageDays, config.lambda);

    // Apply volume weighting if enabled
    if (config.volumeWeighted && pred.stakeUsd && pred.stakeUsd > 0) {
      weight *= Math.sqrt(pred.stakeUsd);
    }

    // Skip if below minimum weight
    if (weight < config.minWeight) {
      predictionsExcluded++;
      continue;
    }

    // Calculate Brier score for this prediction
    const brier = calculateBrierScore(pred.probability, pred.direction, pred.outcome);

    // Accumulate
    weightedBrierSum += weight * brier;
    totalWeight += weight;
    standardBrierSum += brier;
    predictionsIncluded++;

    // Track age range
    if (ageDays > oldestIncludedDays) oldestIncludedDays = ageDays;
    if (ageDays < newestIncludedDays) newestIncludedDays = ageDays;
  }

  // Handle edge cases
  if (predictionsIncluded === 0 || totalWeight === 0) {
    return {
      decayingBrier: 0.25,
      standardBrier: 0.25,
      decayImprovement: 0,
      halfLifeDays,
      predictionsIncluded: 0,
      predictionsExcluded: predictions.length,
      effectiveSampleSize: 0,
      totalWeight: 0,
      weightedBrierSum: 0,
      oldestIncludedDays: 0,
      newestIncludedDays: 0,
    };
  }

  const decayingBrier = weightedBrierSum / totalWeight;
  const standardBrier = standardBrierSum / predictionsIncluded;
  const decayImprovement = standardBrier - decayingBrier;

  return {
    decayingBrier,
    standardBrier,
    decayImprovement,
    halfLifeDays,
    predictionsIncluded,
    predictionsExcluded,
    effectiveSampleSize: totalWeight,
    totalWeight,
    weightedBrierSum,
    oldestIncludedDays: Math.round(oldestIncludedDays * 10) / 10,
    newestIncludedDays: newestIncludedDays === Infinity ? 0 : Math.round(newestIncludedDays * 10) / 10,
  };
}

/**
 * Calculate decaying Brier scores per category
 *
 * @param predictions - Array of resolved predictions with categories
 * @param config - Decay configuration
 * @param referenceDate - Reference point for decay
 * @returns Array of per-category results
 */
export function calculateDecayingBrierByCategory(
  predictions: DecayablePrediction[],
  config: DecayConfig = DEFAULT_DECAY_CONFIG,
  referenceDate: Date = new Date()
): CategoryDecayingBrier[] {
  // Group by category
  const byCategory = new Map<string, DecayablePrediction[]>();

  for (const pred of predictions) {
    const category = pred.category || 'other';
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
    }
    byCategory.get(category)!.push(pred);
  }

  // Calculate decay for each category
  const results: CategoryDecayingBrier[] = [];

  for (const [category, categoryPreds] of byCategory.entries()) {
    const result = calculateDecayingBrier(categoryPreds, config, referenceDate);
    results.push({
      category,
      decayingBrier: result.decayingBrier,
      standardBrier: result.standardBrier,
      predictionCount: result.predictionsIncluded,
      effectiveSampleSize: result.effectiveSampleSize,
    });
  }

  // Sort by prediction count (most active categories first)
  results.sort((a, b) => b.predictionCount - a.predictionCount);

  return results;
}

// =============================================================================
// ROLLING WINDOW DECAY
// =============================================================================

/**
 * Calculate decaying Brier over rolling time windows
 * Useful for trend analysis and performance charts
 *
 * @param predictions - Array of resolved predictions
 * @param windowDays - Size of each rolling window
 * @param stepDays - Step between windows
 * @param config - Decay configuration
 * @returns Array of [date, decayingBrier] tuples
 */
export function calculateRollingDecayingBrier(
  predictions: DecayablePrediction[],
  windowDays: number = 30,
  stepDays: number = 7,
  config: DecayConfig = DEFAULT_DECAY_CONFIG
): Array<{ date: Date; decayingBrier: number; standardBrier: number; count: number }> {
  if (predictions.length === 0) return [];

  // Sort by resolution date
  const sorted = [...predictions].sort(
    (a, b) => a.resolvedAt.getTime() - b.resolvedAt.getTime()
  );

  const earliest = sorted[0].resolvedAt.getTime();
  const latest = sorted[sorted.length - 1].resolvedAt.getTime();

  const results: Array<{ date: Date; decayingBrier: number; standardBrier: number; count: number }> = [];
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const stepMs = stepDays * 24 * 60 * 60 * 1000;

  // Start from earliest + window, step forward
  for (let refMs = earliest + windowMs; refMs <= latest + windowMs; refMs += stepMs) {
    const refDate = new Date(refMs);
    const windowStart = refMs - windowMs;

    // Filter predictions in this window
    const windowPreds = sorted.filter(p => {
      const t = p.resolvedAt.getTime();
      return t >= windowStart && t <= refMs;
    });

    if (windowPreds.length > 0) {
      const result = calculateDecayingBrier(windowPreds, config, refDate);
      results.push({
        date: refDate,
        decayingBrier: result.decayingBrier,
        standardBrier: result.standardBrier,
        count: result.predictionsIncluded,
      });
    }
  }

  return results;
}

// =============================================================================
// TIER THRESHOLDS WITH DECAY
// =============================================================================

/**
 * Forecaster tier based on decaying Brier score
 */
export type ForecasterTier = 'unranked' | 'rookie' | 'verified' | 'elite' | 'super';

/**
 * Tier thresholds for decaying Brier
 * Note: These are slightly more lenient than standard Brier
 * since decay emphasizes recent (harder) predictions
 */
export const DECAY_TIER_THRESHOLDS = {
  super: {
    maxDecayingBrier: 0.15,    // vs 0.12 for standard
    minPredictions: 50,        // Fewer needed since decay gives more signal
    minEffectiveSample: 20,
  },
  elite: {
    maxDecayingBrier: 0.22,    // vs 0.18 for standard
    minPredictions: 30,
    minEffectiveSample: 12,
  },
  verified: {
    maxDecayingBrier: 0.28,    // vs 0.25 for standard
    minPredictions: 15,
    minEffectiveSample: 8,
  },
  rookie: {
    maxDecayingBrier: 1.0,     // Any score
    minPredictions: 5,
    minEffectiveSample: 3,
  },
} as const;

/**
 * Calculate forecaster tier based on decaying Brier score
 *
 * @param result - Decaying Brier calculation result
 * @param totalPredictions - Total prediction count (for minimum threshold)
 * @returns Forecaster tier
 */
export function calculateTierFromDecayingBrier(
  result: DecayingBrierResult,
  totalPredictions: number
): ForecasterTier {
  const { decayingBrier, effectiveSampleSize } = result;

  // Check each tier from highest to lowest
  if (
    decayingBrier <= DECAY_TIER_THRESHOLDS.super.maxDecayingBrier &&
    totalPredictions >= DECAY_TIER_THRESHOLDS.super.minPredictions &&
    effectiveSampleSize >= DECAY_TIER_THRESHOLDS.super.minEffectiveSample
  ) {
    return 'super';
  }

  if (
    decayingBrier <= DECAY_TIER_THRESHOLDS.elite.maxDecayingBrier &&
    totalPredictions >= DECAY_TIER_THRESHOLDS.elite.minPredictions &&
    effectiveSampleSize >= DECAY_TIER_THRESHOLDS.elite.minEffectiveSample
  ) {
    return 'elite';
  }

  if (
    decayingBrier <= DECAY_TIER_THRESHOLDS.verified.maxDecayingBrier &&
    totalPredictions >= DECAY_TIER_THRESHOLDS.verified.minPredictions &&
    effectiveSampleSize >= DECAY_TIER_THRESHOLDS.verified.minEffectiveSample
  ) {
    return 'verified';
  }

  if (
    totalPredictions >= DECAY_TIER_THRESHOLDS.rookie.minPredictions &&
    effectiveSampleSize >= DECAY_TIER_THRESHOLDS.rookie.minEffectiveSample
  ) {
    return 'rookie';
  }

  return 'unranked';
}

// =============================================================================
// SLASHING THRESHOLD CHECK
// =============================================================================

/**
 * Check if forecaster should be slashed based on decaying Brier
 *
 * Uses faster decay (slashing preset) to emphasize very recent performance
 *
 * @param predictions - Recent predictions
 * @param threshold - Brier threshold for slashing (default: 0.35)
 * @returns Whether slashing should be triggered
 */
export function checkSlashingThreshold(
  predictions: DecayablePrediction[],
  threshold: number = 0.35
): {
  shouldSlash: boolean;
  decayingBrier: number;
  threshold: number;
  margin: number;
  recentPerformance: 'good' | 'warning' | 'poor';
} {
  const result = calculateDecayingBrier(predictions, DECAY_PRESETS.slashing);

  const margin = threshold - result.decayingBrier;
  const shouldSlash = result.decayingBrier > threshold;

  let recentPerformance: 'good' | 'warning' | 'poor';
  if (result.decayingBrier <= threshold * 0.7) {
    recentPerformance = 'good';
  } else if (result.decayingBrier <= threshold) {
    recentPerformance = 'warning';
  } else {
    recentPerformance = 'poor';
  }

  return {
    shouldSlash,
    decayingBrier: result.decayingBrier,
    threshold,
    margin,
    recentPerformance,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export const decay = {
  calculate: calculateDecayingBrier,
  calculateByCategory: calculateDecayingBrierByCategory,
  calculateRolling: calculateRollingDecayingBrier,
  calculateWeight: calculateDecayWeight,
  calculateHalfLife,
  calculateLambdaFromHalfLife,
  calculateBrierScore,
  calculateTier: calculateTierFromDecayingBrier,
  checkSlashing: checkSlashingThreshold,
  presets: DECAY_PRESETS,
  tierThresholds: DECAY_TIER_THRESHOLDS,
  defaultConfig: DEFAULT_DECAY_CONFIG,
};

export default decay;
