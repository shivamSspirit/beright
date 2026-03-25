/**
 * BeRight Delegation Eligibility
 *
 * Checks forecaster eligibility for creating delegation pools
 * based on Brier score, decaying Brier score, and prediction count.
 *
 * Now uses time-weighted (decaying) Brier scores for more accurate
 * assessment of current forecaster quality.
 */

import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';
import type { EligibilityResult, ForecasterTier, TierRequirements } from './types';
import { TIER_REQUIREMENTS } from './types';
import {
  calculateDecayingBrier,
  calculateTierFromDecayingBrier,
  checkSlashingThreshold,
  DEFAULT_DECAY_CONFIG,
  DECAY_PRESETS,
  type DecayConfig,
  type DecayablePrediction,
  type DecayingBrierResult,
} from '../scoring/decay';

/**
 * Extended eligibility result with decay metrics
 */
export interface ExtendedEligibilityResult extends EligibilityResult {
  decayingBrier: number | null;
  decayImprovement: number | null;
  decayEffectiveSampleSize: number | null;
  slashingRisk: 'good' | 'warning' | 'poor' | null;
}

/**
 * Brier score data from database
 */
interface BrierScoreData {
  brierOverall: number | null;
  decayingBrierOverall: number | null;
  decayImprovement: number | null;
  decayEffectiveSampleSize: number | null;
}

/**
 * Get Brier score for a wallet address from forecaster_profiles
 * Falls back to users table if no direct wallet match
 */
export async function getBrierScoreForWallet(wallet: string): Promise<number | null> {
  const data = await getBrierScoreDataForWallet(wallet);
  return data.brierOverall;
}

/**
 * Get full Brier score data including decay metrics
 */
export async function getBrierScoreDataForWallet(wallet: string): Promise<BrierScoreData> {
  const defaultResult: BrierScoreData = {
    brierOverall: null,
    decayingBrierOverall: null,
    decayImprovement: null,
    decayEffectiveSampleSize: null,
  };

  if (!isSupabaseConfigured) return defaultResult;

  try {
    // First try forecaster_profiles with wallet_address
    const { data: profileData } = await supabaseAdmin
      .from('forecaster_profiles')
      .select('brier_overall, decaying_brier_overall, decay_improvement, decay_effective_sample_size')
      .eq('wallet_address', wallet)
      .single();

    if (profileData) {
      return {
        brierOverall: profileData.brier_overall as number | null,
        decayingBrierOverall: profileData.decaying_brier_overall as number | null,
        decayImprovement: profileData.decay_improvement as number | null,
        decayEffectiveSampleSize: profileData.decay_effective_sample_size as number | null,
      };
    }

    // Fallback: check users table for wallet -> telegram_id mapping
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('telegram_id')
      .eq('wallet_address', wallet)
      .single();

    if (userData?.telegram_id) {
      const { data: profile } = await supabaseAdmin
        .from('forecaster_profiles')
        .select('brier_overall, decaying_brier_overall, decay_improvement, decay_effective_sample_size')
        .eq('telegram_id', userData.telegram_id)
        .single();

      if (profile) {
        return {
          brierOverall: profile.brier_overall as number | null,
          decayingBrierOverall: profile.decaying_brier_overall as number | null,
          decayImprovement: profile.decay_improvement as number | null,
          decayEffectiveSampleSize: profile.decay_effective_sample_size as number | null,
        };
      }
    }

    return defaultResult;
  } catch (error) {
    console.warn('[Eligibility] Failed to get Brier score:', error);
    return defaultResult;
  }
}

/**
 * Get resolved prediction count for a wallet
 */
export async function getPredictionCount(wallet: string): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  try {
    // First try forecaster_profiles
    const { data: profileData } = await supabaseAdmin
      .from('forecaster_profiles')
      .select('resolved_count')
      .eq('wallet_address', wallet)
      .single();

    if (profileData?.resolved_count) {
      return profileData.resolved_count as number;
    }

    // Fallback via users table
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('telegram_id')
      .eq('wallet_address', wallet)
      .single();

    if (userData?.telegram_id) {
      const { data: profile } = await supabaseAdmin
        .from('forecaster_profiles')
        .select('resolved_count')
        .eq('telegram_id', userData.telegram_id)
        .single();

      if (profile?.resolved_count) {
        return profile.resolved_count as number;
      }
    }

    return 0;
  } catch (error) {
    console.warn('[Eligibility] Failed to get prediction count:', error);
    return 0;
  }
}

/**
 * Determine forecaster tier based on Brier score and prediction count
 * Now considers decaying Brier if available (prioritized)
 */
export function determineTier(
  brierScore: number | null,
  predictionCount: number,
  decayingBrierScore?: number | null
): ForecasterTier {
  // Use decaying Brier if available, otherwise fall back to standard
  const effectiveBrier = decayingBrierScore ?? brierScore;

  // Check prediction count requirement first
  if (predictionCount < TIER_REQUIREMENTS.rookie.minPredictions) {
    return 'unranked';
  }

  // TODO: Restore Brier requirement for production
  // For testing: if no Brier score but minPredictions is 0, allow rookie tier
  if (effectiveBrier === null) {
    if (TIER_REQUIREMENTS.rookie.minPredictions === 0) {
      return 'rookie'; // Allow testing without Brier score
    }
    return 'unranked';
  }

  // Check tiers from highest to lowest
  const tierOrder: ForecasterTier[] = ['super', 'elite', 'verified', 'rookie'];

  for (const tier of tierOrder) {
    const req = TIER_REQUIREMENTS[tier];
    if (effectiveBrier <= req.maxBrier && predictionCount >= req.minPredictions) {
      return tier;
    }
  }

  return 'unranked';
}

/**
 * Determine slashing risk level based on decaying Brier
 */
export function determineSlashingRisk(
  decayingBrier: number | null,
  threshold: number = 0.35
): 'good' | 'warning' | 'poor' | null {
  if (decayingBrier === null) return null;

  if (decayingBrier > threshold) return 'poor';
  if (decayingBrier > threshold * 0.85) return 'warning'; // Within 15% of threshold
  return 'good';
}

/**
 * Check if a wallet is eligible to create a delegation pool
 */
export async function checkPoolEligibility(wallet: string): Promise<EligibilityResult> {
  const [brierData, predictionCount] = await Promise.all([
    getBrierScoreDataForWallet(wallet),
    getPredictionCount(wallet),
  ]);

  const tier = determineTier(brierData.brierOverall, predictionCount, brierData.decayingBrierOverall);
  const eligible = tier !== 'unranked';
  const maxCapacity = TIER_REQUIREMENTS[tier].capacity;

  let reason: string | undefined;
  if (!eligible) {
    if (predictionCount < TIER_REQUIREMENTS.rookie.minPredictions) {
      reason = `Need at least ${TIER_REQUIREMENTS.rookie.minPredictions} resolved predictions to create a pool`;
    } else if (brierData.brierOverall === null && brierData.decayingBrierOverall === null) {
      reason = 'No Brier score found. Make predictions and wait for resolution';
    } else if (brierData.decayingBrierOverall !== null && brierData.decayingBrierOverall > 0.30) {
      reason = `Recent performance too low (decaying Brier: ${brierData.decayingBrierOverall.toFixed(3)}). Improve recent predictions`;
    } else {
      reason = 'Brier score too high. Improve calibration to create a pool';
    }
  }

  return {
    eligible,
    tier,
    maxCapacity,
    brierScore: brierData.brierOverall,
    predictionCount,
    reason,
  };
}

/**
 * Check extended eligibility including decay metrics
 */
export async function checkExtendedPoolEligibility(wallet: string): Promise<ExtendedEligibilityResult> {
  const [brierData, predictionCount] = await Promise.all([
    getBrierScoreDataForWallet(wallet),
    getPredictionCount(wallet),
  ]);

  const tier = determineTier(brierData.brierOverall, predictionCount, brierData.decayingBrierOverall);
  const slashingRisk = determineSlashingRisk(brierData.decayingBrierOverall);
  const eligible = tier !== 'unranked' && slashingRisk !== 'poor';
  const maxCapacity = TIER_REQUIREMENTS[tier].capacity;

  let reason: string | undefined;
  if (!eligible) {
    if (predictionCount < TIER_REQUIREMENTS.rookie.minPredictions) {
      reason = `Need at least ${TIER_REQUIREMENTS.rookie.minPredictions} resolved predictions`;
    } else if (brierData.brierOverall === null && brierData.decayingBrierOverall === null) {
      reason = 'No Brier score found. Make predictions and wait for resolution';
    } else if (slashingRisk === 'poor') {
      reason = `Recent performance in slashing range (decaying Brier: ${brierData.decayingBrierOverall?.toFixed(3)}). Improve recent predictions`;
    } else if (brierData.decayingBrierOverall !== null && brierData.decayingBrierOverall > 0.30) {
      reason = `Recent performance too low. Improve recent predictions`;
    } else {
      reason = 'Brier score too high. Improve calibration to create a pool';
    }
  }

  return {
    eligible,
    tier,
    maxCapacity,
    brierScore: brierData.brierOverall,
    predictionCount,
    reason,
    decayingBrier: brierData.decayingBrierOverall,
    decayImprovement: brierData.decayImprovement,
    decayEffectiveSampleSize: brierData.decayEffectiveSampleSize,
    slashingRisk,
  };
}

/**
 * Get capacity limit for a tier in USDC (6 decimals)
 */
export function getTierCapacityUsdc(tier: ForecasterTier): bigint {
  const usdCapacity = TIER_REQUIREMENTS[tier].capacity;
  if (usdCapacity === Infinity) {
    return BigInt(Number.MAX_SAFE_INTEGER);
  }
  return BigInt(usdCapacity) * BigInt(1_000000); // 6 decimals
}

/**
 * Check if a forecaster can increase their pool capacity
 */
export async function checkCapacityUpgrade(
  wallet: string,
  currentCapacity: bigint
): Promise<{
  canUpgrade: boolean;
  newTier: ForecasterTier | null;
  newCapacity: bigint | null;
}> {
  const eligibility = await checkPoolEligibility(wallet);

  if (!eligibility.eligible) {
    return { canUpgrade: false, newTier: null, newCapacity: null };
  }

  const newCapacityUsdc = getTierCapacityUsdc(eligibility.tier);

  if (newCapacityUsdc > currentCapacity) {
    return {
      canUpgrade: true,
      newTier: eligibility.tier,
      newCapacity: newCapacityUsdc,
    };
  }

  return { canUpgrade: false, newTier: null, newCapacity: null };
}

/**
 * Format tier for display
 */
export function formatTier(tier: ForecasterTier): string {
  const labels: Record<ForecasterTier, string> = {
    super: 'Super Forecaster',
    elite: 'Elite',
    verified: 'Verified',
    rookie: 'Rookie',
    unranked: 'Unranked',
  };
  return labels[tier];
}

/**
 * Get tier badge/icon
 */
export function getTierBadge(tier: ForecasterTier): string {
  const badges: Record<ForecasterTier, string> = {
    super: '🏆',
    elite: '⭐',
    verified: '✓',
    rookie: '🌱',
    unranked: '',
  };
  return badges[tier];
}

/**
 * Get tier color for UI
 */
export function getTierColor(tier: ForecasterTier): string {
  const colors: Record<ForecasterTier, string> = {
    super: '#FFD700', // gold
    elite: '#C0C0C0', // silver
    verified: '#4CAF50', // green
    rookie: '#2196F3', // blue
    unranked: '#9E9E9E', // gray
  };
  return colors[tier];
}
