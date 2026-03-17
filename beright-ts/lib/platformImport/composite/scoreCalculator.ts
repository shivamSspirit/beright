/**
 * Composite Score Calculator
 *
 * Calculates weighted composite scores from native BeRight predictions
 * and imported external platform data. Uses confidence multipliers
 * based on prediction count to weight sample size.
 *
 * IMPORTANT: Native BeRight scores are sourced from the on-chain
 * calibration program - the source of truth for portable reputation.
 */

import { PublicKey } from '@solana/web3.js';
import { supabaseAdmin } from '../../supabase/client';
import { getForecasterStats, type ForecasterStats } from '../../onchain/calibration';
import { PLATFORM_WEIGHTS, BERIGHT_NATIVE_WEIGHT, PLATFORM_DISPLAY_NAMES } from '../registry';
import type {
  ExternalPlatform,
  ForecasterTier,
  ScoreComponent,
  CompositeScoreResult,
  CompositeScoreInput,
  ExternalPlatformLink,
  ImportedStats,
} from '../types';

// =============================================================================
// CONSTANTS
// =============================================================================

// Minimum predictions to count in composite score
const MIN_PREDICTIONS_THRESHOLD = 5;

// Tier thresholds (equivalent Brier score and prediction count)
const TIER_THRESHOLDS = {
  superforecaster: { maxBrier: 0.10, minPredictions: 100 },
  elite: { maxBrier: 0.15, minPredictions: 50 },
  verified: { maxBrier: 0.25, minPredictions: 20 },
  rookie: { maxBrier: 1.0, minPredictions: 5 },
  unranked: { maxBrier: 1.0, minPredictions: 0 },
};

// =============================================================================
// CONFIDENCE MULTIPLIER
// =============================================================================

/**
 * Calculate confidence multiplier based on prediction count.
 *
 * More predictions = more confidence in the score.
 * Uses logarithmic scaling to avoid over-weighting huge counts.
 *
 * - 5 predictions: ~0.35
 * - 10 predictions: ~0.5
 * - 50 predictions: ~0.85
 * - 100 predictions: 1.0 (max)
 */
function getConfidenceMultiplier(predictionCount: number): number {
  if (predictionCount < MIN_PREDICTIONS_THRESHOLD) {
    return 0; // Below threshold = doesn't count
  }

  // Logarithmic scaling: caps at ~100 predictions
  return Math.min(1, Math.log10(predictionCount) / 2);
}

// =============================================================================
// TIER CALCULATION
// =============================================================================

/**
 * Calculate forecaster tier based on composite score and predictions.
 */
export function calculateTier(
  compositeScore: number,
  totalPredictions: number
): ForecasterTier {
  // Convert composite score (0-10000) back to Brier-like (0-1)
  const equivalentBrier = 1 - compositeScore / 10000;

  if (totalPredictions < TIER_THRESHOLDS.rookie.minPredictions) {
    return 'unranked';
  }

  if (
    equivalentBrier < TIER_THRESHOLDS.superforecaster.maxBrier &&
    totalPredictions >= TIER_THRESHOLDS.superforecaster.minPredictions
  ) {
    return 'superforecaster';
  }

  if (
    equivalentBrier < TIER_THRESHOLDS.elite.maxBrier &&
    totalPredictions >= TIER_THRESHOLDS.elite.minPredictions
  ) {
    return 'elite';
  }

  if (
    equivalentBrier < TIER_THRESHOLDS.verified.maxBrier &&
    totalPredictions >= TIER_THRESHOLDS.verified.minPredictions
  ) {
    return 'verified';
  }

  return 'rookie';
}

// =============================================================================
// COMPOSITE SCORE CALCULATION
// =============================================================================

/**
 * Calculate composite score from native + imported scores.
 *
 * Formula:
 *   composite = sum(score_i * weight_i * confidence_i) / sum(weight_i * confidence_i)
 *
 * Where:
 *   - score_i = normalized score (1 - Brier, so higher = better)
 *   - weight_i = platform reputation weight
 *   - confidence_i = log-scaled prediction count multiplier
 */
export function calculateCompositeScore(input: CompositeScoreInput): {
  score: number;
  breakdown: ScoreComponent[];
  totalPredictions: number;
} {
  const breakdown: ScoreComponent[] = [];
  let weightedSum = 0;
  let totalWeight = 0;
  let totalPredictions = 0;

  // Process native BeRight score
  if (input.berightBrier !== null && input.berightPredictions >= MIN_PREDICTIONS_THRESHOLD) {
    const confidence = getConfidenceMultiplier(input.berightPredictions);
    const weight = BERIGHT_NATIVE_WEIGHT * confidence;
    const normalizedScore = 1 - input.berightBrier; // Invert Brier (lower = better → higher = better)

    weightedSum += normalizedScore * weight;
    totalWeight += weight;
    totalPredictions += input.berightPredictions;

    breakdown.push({
      source: 'beright',
      displayName: PLATFORM_DISPLAY_NAMES.beright,
      weight,
      normalizedScore,
      predictionCount: input.berightPredictions,
      isVerified: true, // On-chain = always verified
    });
  }

  // Process imported scores
  for (const imported of input.importedScores) {
    // Only count verified links
    if (!imported.isVerified) continue;

    // Skip if below minimum threshold
    if (imported.predictions < MIN_PREDICTIONS_THRESHOLD) continue;

    // Skip if no Brier score available
    if (imported.brier === null || imported.brier === undefined) continue;

    const confidence = getConfidenceMultiplier(imported.predictions);
    const weight = imported.weight * confidence;
    const normalizedScore = 1 - imported.brier;

    weightedSum += normalizedScore * weight;
    totalWeight += weight;
    totalPredictions += imported.predictions;

    breakdown.push({
      source: imported.platform,
      displayName: PLATFORM_DISPLAY_NAMES[imported.platform],
      weight,
      normalizedScore,
      predictionCount: imported.predictions,
      isVerified: imported.isVerified,
    });
  }

  // Calculate final composite score
  if (totalWeight === 0) {
    return { score: 0, breakdown: [], totalPredictions: 0 };
  }

  // Scale to 0-10000 for precision
  const score = Math.round((weightedSum / totalWeight) * 10000);

  // Sort breakdown by weight descending
  breakdown.sort((a, b) => b.weight - a.weight);

  return { score, breakdown, totalPredictions };
}

// =============================================================================
// CALIBRATION QUALITY BONUS
// =============================================================================

/**
 * Calculate calibration quality bonus based on how well-calibrated
 * the forecaster is across probability buckets.
 *
 * A perfectly calibrated forecaster would have outcomes matching
 * their predicted probabilities in each bucket.
 *
 * Returns a multiplier between 0.9 (poor calibration) and 1.1 (excellent).
 */
function getCalibrationQualityMultiplier(
  calibrationBuckets: number[][] | undefined
): number {
  if (!calibrationBuckets || calibrationBuckets.length === 0) {
    return 1.0; // Neutral if no calibration data
  }

  // Each bucket is [predictions, correct]
  // Calculate how close actual accuracy is to expected
  let totalDeviation = 0;
  let totalWeight = 0;

  calibrationBuckets.forEach((bucket, index) => {
    const [predictions, correct] = bucket;
    if (predictions < 5) return; // Skip buckets with too few predictions

    // Expected accuracy for this bucket (10% buckets: 0-10%, 10-20%, etc.)
    const expectedAccuracy = (index + 0.5) / 10;
    const actualAccuracy = correct / predictions;

    // Deviation from expected
    const deviation = Math.abs(actualAccuracy - expectedAccuracy);
    totalDeviation += deviation * predictions;
    totalWeight += predictions;
  });

  if (totalWeight === 0) return 1.0;

  const avgDeviation = totalDeviation / totalWeight;

  // Map deviation to multiplier:
  // 0% deviation = 1.1x, 20% deviation = 1.0x, 40%+ deviation = 0.9x
  const multiplier = 1.1 - avgDeviation * 0.5;
  return Math.max(0.9, Math.min(1.1, multiplier));
}

/**
 * Calculate streak bonus for consistent correct predictions.
 * Rewards forecasters who maintain accuracy over time.
 */
function getStreakBonus(streakCorrect: number, maxStreakCorrect: number): number {
  // Current streak contributes more than historical max
  const currentBonus = Math.min(streakCorrect / 20, 0.05); // Max 5% from current
  const historicalBonus = Math.min(maxStreakCorrect / 50, 0.03); // Max 3% from best

  return 1 + currentBonus + historicalBonus;
}

// =============================================================================
// FULL COMPOSITE CALCULATION WITH ON-CHAIN CALIBRATION
// =============================================================================

/**
 * Calculate and store composite score for a forecaster.
 *
 * Uses the on-chain calibration program as the source of truth for native
 * BeRight scores, with fallback to Supabase for backwards compatibility.
 */
export async function calculateAndStoreCompositeScore(
  forecasterPubkey: string
): Promise<CompositeScoreResult> {
  // First, try to fetch from on-chain calibration program (source of truth)
  let onChainStats: ForecasterStats | null = null;
  let calibrationQualityMultiplier = 1.0;
  let streakBonus = 1.0;

  try {
    const pubkey = new PublicKey(forecasterPubkey);
    onChainStats = await getForecasterStats(pubkey);

    if (onChainStats) {
      // Calculate bonuses from on-chain calibration data
      calibrationQualityMultiplier = getCalibrationQualityMultiplier(
        onChainStats.calibrationBuckets
      );
      streakBonus = getStreakBonus(
        onChainStats.streakCorrect,
        onChainStats.maxStreakCorrect
      );
    }
  } catch (error) {
    // On-chain fetch failed - will fall back to Supabase
    console.warn(
      `[Composite Score] On-chain fetch failed for ${forecasterPubkey}, using Supabase fallback:`,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }

  // Fallback: fetch from Supabase if on-chain not available
  let brierScore: number | null = null;
  let resolvedCount = 0;

  if (onChainStats) {
    // Use on-chain calibration program data (source of truth)
    brierScore = onChainStats.avgBrierScore;
    resolvedCount = onChainStats.resolvedPredictions;
  } else {
    // Fallback to Supabase (legacy/sync'd data)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('forecaster_profiles')
      .select('brier_overall, resolved_count')
      .eq('pubkey', forecasterPubkey)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch forecaster profile: ${profileError.message}`);
    }

    brierScore = profile?.brier_overall ?? null;
    resolvedCount = profile?.resolved_count ?? 0;
  }

  // Fetch linked platforms
  const { data: links, error: linksError } = await supabaseAdmin
    .from('external_platform_links')
    .select('*')
    .eq('forecaster_pubkey', forecasterPubkey)
    .not('verified_at', 'is', null);

  if (linksError) {
    throw new Error(`Failed to fetch platform links: ${linksError.message}`);
  }

  // Build input for composite calculation
  const input: CompositeScoreInput = {
    berightBrier: brierScore,
    berightPredictions: resolvedCount,
    importedScores: [],
  };

  // Process linked platforms
  for (const link of (links || [])) {
    const platformLink = link as unknown as ExternalPlatformLink;
    const stats = platformLink.importedStats as ImportedStats;

    if (stats && stats.brierScore !== null) {
      input.importedScores.push({
        platform: platformLink.platform,
        brier: stats.brierScore,
        predictions: stats.resolvedCount || 0,
        weight: PLATFORM_WEIGHTS[platformLink.platform],
        isVerified: platformLink.verifiedAt !== null,
      });
    }
  }

  // Calculate composite score
  const { score: rawScore, breakdown, totalPredictions } = calculateCompositeScore(input);

  // Apply on-chain calibration bonuses (only if we have on-chain data)
  // These reward well-calibrated forecasters and consistent accuracy
  const adjustedScore = Math.round(
    rawScore * calibrationQualityMultiplier * streakBonus
  );

  // Clamp to valid range (0-10000)
  const score = Math.max(0, Math.min(10000, adjustedScore));

  // Add calibration metadata to breakdown if available
  if (onChainStats) {
    breakdown.unshift({
      source: 'beright' as const,
      displayName: `${PLATFORM_DISPLAY_NAMES.beright} (On-Chain)`,
      weight: BERIGHT_NATIVE_WEIGHT * getConfidenceMultiplier(resolvedCount),
      normalizedScore: brierScore !== null ? 1 - brierScore : 0,
      predictionCount: resolvedCount,
      isVerified: true,
      // Include calibration bonuses in breakdown for transparency
      calibrationBonus: Math.round((calibrationQualityMultiplier - 1) * 100),
      streakBonus: Math.round((streakBonus - 1) * 100),
    } as ScoreComponent & { calibrationBonus: number; streakBonus: number });

    // Remove the duplicate beright entry that calculateCompositeScore added
    const berightIdx = breakdown.findIndex(
      (c: ScoreComponent) => c.source === 'beright' && !('calibrationBonus' in c)
    );
    if (berightIdx > 0) {
      breakdown.splice(berightIdx, 1);
    }
  }

  const tier = calculateTier(score, totalPredictions);
  const now = new Date().toISOString();

  // Store in database with on-chain calibration metadata
  const { error: upsertError } = await supabaseAdmin
    .from('forecaster_composite_scores')
    .upsert(
      {
        forecaster_pubkey: forecasterPubkey,
        composite_score: score,
        tier,
        breakdown: JSON.stringify(breakdown),
        total_predictions: totalPredictions,
        last_calculated_at: now,
        // Store calibration metadata for analytics
        calibration_multiplier: calibrationQualityMultiplier,
        streak_bonus: streakBonus,
        on_chain_verified: onChainStats !== null,
      },
      { onConflict: 'forecaster_pubkey' }
    );

  if (upsertError) {
    console.error('Failed to store composite score:', upsertError);
  }

  // Also update the forecaster_profiles table
  await supabaseAdmin
    .from('forecaster_profiles')
    .update({
      composite_score: score,
      tier,
    })
    .eq('pubkey', forecasterPubkey);

  return {
    score,
    tier,
    breakdown,
    totalPredictions,
    lastCalculatedAt: now,
    // On-chain calibration metadata
    onChainVerified: onChainStats !== null,
    calibrationMultiplier: calibrationQualityMultiplier,
    streakBonus,
    // Additional on-chain metrics
    onChainMetrics: onChainStats
      ? {
          avgBrierScore: onChainStats.avgBrierScore,
          avgLogScore: onChainStats.avgLogScore,
          accuracy: onChainStats.accuracy,
          streakCorrect: onChainStats.streakCorrect,
          maxStreakCorrect: onChainStats.maxStreakCorrect,
          marketsTraded: onChainStats.marketsTraded,
        }
      : undefined,
  };
}

/**
 * Get cached composite score, or calculate if stale.
 */
export async function getCompositeScore(
  forecasterPubkey: string,
  maxAgeMinutes: number = 60
): Promise<CompositeScoreResult | null> {
  // Check cache
  const { data, error } = await supabaseAdmin
    .from('forecaster_composite_scores')
    .select('*')
    .eq('forecaster_pubkey', forecasterPubkey)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch composite score: ${error.message}`);
  }

  // If no cache or stale, recalculate
  if (!data) {
    return calculateAndStoreCompositeScore(forecasterPubkey);
  }

  const cacheAge = Date.now() - new Date(data.last_calculated_at).getTime();
  const maxAgeMs = maxAgeMinutes * 60 * 1000;

  if (cacheAge > maxAgeMs) {
    return calculateAndStoreCompositeScore(forecasterPubkey);
  }

  // Parse breakdown from JSON
  let breakdown: ScoreComponent[] = [];
  try {
    breakdown = typeof data.breakdown === 'string'
      ? JSON.parse(data.breakdown)
      : data.breakdown;
  } catch {
    breakdown = [];
  }

  return {
    score: data.composite_score,
    tier: data.tier as ForecasterTier,
    breakdown,
    totalPredictions: data.total_predictions,
    lastCalculatedAt: data.last_calculated_at,
  };
}

/**
 * Recalculate composite scores for all forecasters with stale scores.
 * Should be run periodically (e.g., via cron job).
 */
export async function recalculateStaleScores(
  maxAgeMinutes: number = 60
): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();

  // Find forecasters with stale or missing scores
  const { data: staleForecasters, error } = await supabaseAdmin
    .from('forecaster_profiles')
    .select('pubkey')
    .or(`pubkey.not.in.(select forecaster_pubkey from forecaster_composite_scores where last_calculated_at > '${cutoff}')`);

  if (error) {
    console.error('Failed to find stale forecasters:', error);
    return 0;
  }

  let updated = 0;
  for (const forecaster of staleForecasters || []) {
    try {
      await calculateAndStoreCompositeScore(forecaster.pubkey);
      updated++;
    } catch (err) {
      console.error(`Failed to recalculate score for ${forecaster.pubkey}:`, err);
    }
  }

  return updated;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  calculateCompositeScore,
  calculateTier,
  calculateAndStoreCompositeScore,
  getCompositeScore,
  recalculateStaleScores,
  getConfidenceMultiplier,
  MIN_PREDICTIONS_THRESHOLD,
  TIER_THRESHOLDS,
};
