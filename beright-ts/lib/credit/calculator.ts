/**
 * BeRight P6: Credit Calculator Functions
 *
 * Converts on-chain Brier scores and calibration data into
 * economic metrics: credit limits, borrow rates, LTV ratios.
 */

import {
  type CreditInputMetrics,
  type CreditMetrics,
  type ForecasterCredit,
  type CreditConfig,
  type CreditTierConfig,
  type PoolAccessTier,
  CREDIT_TIERS,
  DEFAULT_CREDIT_CONFIG,
} from './types';

// ============================================================================
// Core Calculator Functions
// ============================================================================

/**
 * Calculate credit limit based on forecaster performance
 *
 * Formula: baseLimit × brierMultiplier × volumeMultiplier × calibrationMultiplier
 *
 * @param metrics - Forecaster performance metrics
 * @param config - Credit system configuration
 * @returns Credit limit in USDC
 */
export function calculateCreditLimit(
  metrics: CreditInputMetrics,
  config: CreditConfig = DEFAULT_CREDIT_CONFIG
): number {
  // No credit if below minimum predictions
  if (metrics.resolvedPredictions < config.minPredictionsForCredit) {
    return 0;
  }

  // No credit if Brier score too high (bad forecaster)
  if (metrics.brierScore > config.maxBrierForAnyCredit) {
    return 0;
  }

  // Brier multiplier: lower Brier = higher multiplier (0.10 → 10x, 0.40 → 1x)
  const brierRange = config.maxBrierForAnyCredit - config.minBrierForMaxCredit;
  const brierPosition = Math.max(0, metrics.brierScore - config.minBrierForMaxCredit);
  const brierMultiplier = Math.max(1, 10 - (brierPosition / brierRange) * 9);

  // Volume multiplier: more trades = more trust (capped)
  const volumeMultiplier = Math.min(
    config.volumeMultiplierCap,
    1 + Math.log10(Math.max(1, metrics.resolvedPredictions / 10))
  );

  // Calibration quality multiplier
  const calibrationMultiplier = calculateCalibrationQualityMultiplier(
    metrics.calibrationBuckets,
    config.calibrationMultiplierRange
  );

  // Streak bonus
  const streakMultiplier = calculateStreakMultiplier(
    metrics.streakCorrect,
    metrics.maxStreakCorrect,
    config.streakMultiplierMax
  );

  const creditLimit =
    config.baseCreditLimit *
    brierMultiplier *
    volumeMultiplier *
    calibrationMultiplier *
    streakMultiplier;

  return Math.round(creditLimit * 100) / 100; // Round to cents
}

/**
 * Calculate borrow rate (APR) based on forecaster accuracy
 *
 * Formula: baseRate × (1 - accuracyDiscount)
 *
 * Better forecasters get lower interest rates (up to 30% discount)
 *
 * @param metrics - Forecaster performance metrics
 * @param config - Credit system configuration
 * @returns Borrow rate as decimal (0.15 = 15% APR)
 */
export function calculateBorrowRate(
  metrics: CreditInputMetrics,
  config: CreditConfig = DEFAULT_CREDIT_CONFIG
): number {
  // Base rate for new forecasters
  if (metrics.resolvedPredictions < config.minPredictionsForCredit) {
    return config.baseBorrowRate;
  }

  // Get tier for rate discount
  const tier = getTierForMetrics(metrics);
  const discount = tier.rateDiscount;

  // Apply discount
  const rate = config.baseBorrowRate * (1 - discount);

  // Additional accuracy bonus (up to 5% more off for >70% accuracy)
  const accuracyBonus = metrics.accuracy > 0.70
    ? (metrics.accuracy - 0.70) * 0.15 // Up to 4.5% bonus for 100% accuracy
    : 0;

  return Math.max(0.05, rate - accuracyBonus); // Floor at 5% APR
}

/**
 * Calculate collateral LTV ratio
 *
 * Higher LTV = can borrow more against outcome tokens
 * Better forecasters get higher LTV (less collateral needed)
 *
 * @param metrics - Forecaster performance metrics
 * @param config - Credit system configuration
 * @returns LTV ratio (0.5 = 50% LTV)
 */
export function calculateCollateralLTV(
  metrics: CreditInputMetrics,
  config: CreditConfig = DEFAULT_CREDIT_CONFIG
): number {
  // Base LTV for new forecasters
  if (metrics.resolvedPredictions < config.minPredictionsForCredit) {
    return config.baseCollateralLTV;
  }

  const tier = getTierForMetrics(metrics);
  return tier.maxLTV;
}

/**
 * Determine pool access tier based on metrics
 *
 * @param metrics - Forecaster performance metrics
 * @returns Pool access tier
 */
export function calculatePoolAccessTier(
  metrics: CreditInputMetrics
): PoolAccessTier {
  const tier = getTierForMetrics(metrics);
  return tier.tier;
}

/**
 * Calculate delegation cap (max capital that can be delegated to this forecaster)
 *
 * Formula: baseCap × tierMultiplier × trackRecordMultiplier
 *
 * @param metrics - Forecaster performance metrics
 * @param config - Credit system configuration
 * @returns Delegation cap in USDC
 */
export function calculateDelegationCap(
  metrics: CreditInputMetrics,
  config: CreditConfig = DEFAULT_CREDIT_CONFIG
): number {
  // No delegation for new forecasters
  if (metrics.resolvedPredictions < config.minPredictionsForCredit * 2) {
    return 0;
  }

  const tier = getTierForMetrics(metrics);

  // No delegation for restricted tier
  if (tier.tier === 'restricted') {
    return 0;
  }

  // Track record multiplier (more predictions = more trust)
  const trackRecordMultiplier = Math.min(
    5, // Cap at 5x
    1 + Math.log10(metrics.resolvedPredictions / 20)
  );

  // Markets diversity bonus (trading more markets = more robust)
  const diversityBonus = Math.min(
    1.5,
    1 + (metrics.marketsTraded / 50) * 0.5
  );

  const delegationCap =
    config.baseDelegationCap *
    tier.creditMultiplier *
    trackRecordMultiplier *
    diversityBonus;

  return Math.round(delegationCap);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate calibration quality multiplier from bucket accuracy
 *
 * Looks at how well-calibrated the forecaster is across probability buckets.
 * A well-calibrated forecaster says "60%" and is right 60% of the time.
 *
 * @param buckets - Calibration buckets [[predictions, correct], ...]
 * @param range - [min, max] multiplier range
 * @returns Multiplier (typically 0.9-1.1)
 */
export function calculateCalibrationQualityMultiplier(
  buckets: number[][] | undefined,
  range: [number, number] = [0.9, 1.1]
): number {
  if (!buckets || buckets.length === 0) {
    return 1.0; // Neutral if no data
  }

  // Calculate deviation from perfect calibration
  // Buckets represent probability ranges: 0-10%, 10-20%, ..., 90-100%
  const bucketMidpoints = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95];

  let totalDeviation = 0;
  let totalPredictions = 0;

  for (let i = 0; i < buckets.length && i < bucketMidpoints.length; i++) {
    const [predictions, correct] = buckets[i];
    if (predictions > 0) {
      const actualRate = correct / predictions;
      const expectedRate = bucketMidpoints[i];
      const deviation = Math.abs(actualRate - expectedRate);
      totalDeviation += deviation * predictions;
      totalPredictions += predictions;
    }
  }

  if (totalPredictions === 0) {
    return 1.0;
  }

  // Average deviation (0 = perfectly calibrated, 0.5 = worst case)
  const avgDeviation = totalDeviation / totalPredictions;

  // Convert to multiplier: 0 deviation → max, 0.3 deviation → min
  const [min, max] = range;
  const multiplier = max - (avgDeviation / 0.3) * (max - min);

  return Math.max(min, Math.min(max, multiplier));
}

/**
 * Calculate streak multiplier
 *
 * Rewards forecasters on winning streaks (momentum indicator)
 *
 * @param currentStreak - Current consecutive correct predictions
 * @param maxStreak - Best streak ever
 * @param maxMultiplier - Maximum multiplier (e.g., 1.10)
 * @returns Streak multiplier (1.0-maxMultiplier)
 */
export function calculateStreakMultiplier(
  currentStreak: number,
  maxStreak: number,
  maxMultiplier: number = 1.10
): number {
  // Current streak bonus: +0.25% per correct, up to 5%
  const currentBonus = Math.min(0.05, currentStreak * 0.0025);

  // Historical max streak bonus: +0.1% per correct, up to 3%
  const historicalBonus = Math.min(0.03, maxStreak * 0.001);

  const totalBonus = currentBonus + historicalBonus;

  return Math.min(maxMultiplier, 1 + totalBonus);
}

/**
 * Get the tier configuration for given metrics
 *
 * @param metrics - Forecaster performance metrics
 * @returns Matching tier configuration
 */
export function getTierForMetrics(metrics: CreditInputMetrics): CreditTierConfig {
  // Sort tiers by quality (best first)
  const sortedTiers = [...CREDIT_TIERS].sort(
    (a, b) => a.maxBrierScore - b.maxBrierScore
  );

  for (const tier of sortedTiers) {
    if (
      metrics.brierScore >= tier.minBrierScore &&
      metrics.brierScore < tier.maxBrierScore &&
      metrics.accuracy >= tier.minAccuracy &&
      metrics.resolvedPredictions >= tier.minPredictions
    ) {
      return tier;
    }
  }

  // Default to restricted
  return CREDIT_TIERS.find((t) => t.tier === 'restricted')!;
}

// ============================================================================
// Main Calculator
// ============================================================================

/**
 * Calculate all credit metrics for a forecaster
 *
 * @param metrics - Forecaster performance metrics
 * @param config - Credit system configuration
 * @returns Full credit metrics
 */
export function calculateAllCreditMetrics(
  metrics: CreditInputMetrics,
  config: CreditConfig = DEFAULT_CREDIT_CONFIG
): CreditMetrics {
  return {
    creditLimit: calculateCreditLimit(metrics, config),
    borrowRate: calculateBorrowRate(metrics, config),
    collateralLTV: calculateCollateralLTV(metrics, config),
    poolAccessTier: calculatePoolAccessTier(metrics),
    delegationCap: calculateDelegationCap(metrics, config),
  };
}

/**
 * Build full ForecasterCredit profile from input metrics
 *
 * @param metrics - Forecaster performance metrics
 * @param config - Credit system configuration
 * @param onChainVerified - Whether data is from on-chain source
 * @returns Full credit profile
 */
export function buildCreditProfile(
  metrics: CreditInputMetrics,
  config: CreditConfig = DEFAULT_CREDIT_CONFIG,
  onChainVerified: boolean = false
): ForecasterCredit {
  const tier = getTierForMetrics(metrics);
  const creditMetrics = calculateAllCreditMetrics(metrics, config);

  const calibrationQuality = calculateCalibrationQualityMultiplier(
    metrics.calibrationBuckets,
    config.calibrationMultiplierRange
  );

  const streakBonus = calculateStreakMultiplier(
    metrics.streakCorrect,
    metrics.maxStreakCorrect,
    config.streakMultiplierMax
  );

  return {
    pubkey: metrics.pubkey,

    // Performance metrics
    brierScore: metrics.brierScore,
    logScore: metrics.logScore,
    accuracy: metrics.accuracy,
    calibrationQuality,
    streakBonus,

    // Credit metrics
    ...creditMetrics,

    // Tier info
    tier,

    // Metadata
    lastUpdated: new Date(),
    onChainVerified,
    predictionCount: metrics.resolvedPredictions,
  };
}

/**
 * Compare two forecasters' credit profiles
 *
 * @param a - First forecaster
 * @param b - Second forecaster
 * @returns Comparison result (positive = a is better)
 */
export function compareCreditProfiles(
  a: ForecasterCredit,
  b: ForecasterCredit
): number {
  // Primary: Brier score (lower is better)
  const brierDiff = b.brierScore - a.brierScore;
  if (Math.abs(brierDiff) > 0.05) {
    return brierDiff;
  }

  // Secondary: Credit limit (higher is better)
  const creditDiff = a.creditLimit - b.creditLimit;
  if (Math.abs(creditDiff) > 100) {
    return creditDiff;
  }

  // Tertiary: Prediction count (more is better for tie-breaking)
  return a.predictionCount - b.predictionCount;
}
