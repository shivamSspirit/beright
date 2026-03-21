/**
 * BeRight Delegation Eligibility
 *
 * Checks forecaster eligibility for creating delegation pools
 * based on Brier score and prediction count.
 */

import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';
import type { EligibilityResult, ForecasterTier, TierRequirements } from './types';
import { TIER_REQUIREMENTS } from './types';

/**
 * Get Brier score for a wallet address from forecaster_profiles
 * Falls back to users table if no direct wallet match
 */
export async function getBrierScoreForWallet(wallet: string): Promise<number | null> {
  if (!isSupabaseConfigured) return null;

  try {
    // First try forecaster_profiles with wallet_address
    const { data: profileData } = await supabaseAdmin
      .from('forecaster_profiles')
      .select('brier_overall')
      .eq('wallet_address', wallet)
      .single();

    if (profileData && profileData.brier_overall !== null) {
      return profileData.brier_overall as number;
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
        .select('brier_overall')
        .eq('telegram_id', userData.telegram_id)
        .single();

      if (profile && profile.brier_overall !== null) {
        return profile.brier_overall as number;
      }
    }

    return null;
  } catch (error) {
    console.warn('[Eligibility] Failed to get Brier score:', error);
    return null;
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
 */
export function determineTier(
  brierScore: number | null,
  predictionCount: number
): ForecasterTier {
  if (brierScore === null || predictionCount < TIER_REQUIREMENTS.rookie.minPredictions) {
    return 'unranked';
  }

  // Check tiers from highest to lowest
  const tierOrder: ForecasterTier[] = ['super', 'elite', 'verified', 'rookie'];

  for (const tier of tierOrder) {
    const req = TIER_REQUIREMENTS[tier];
    if (brierScore <= req.maxBrier && predictionCount >= req.minPredictions) {
      return tier;
    }
  }

  return 'unranked';
}

/**
 * Check if a wallet is eligible to create a delegation pool
 */
export async function checkPoolEligibility(wallet: string): Promise<EligibilityResult> {
  const [brierScore, predictionCount] = await Promise.all([
    getBrierScoreForWallet(wallet),
    getPredictionCount(wallet),
  ]);

  const tier = determineTier(brierScore, predictionCount);
  const eligible = tier !== 'unranked';
  const maxCapacity = TIER_REQUIREMENTS[tier].capacity;

  let reason: string | undefined;
  if (!eligible) {
    if (predictionCount < TIER_REQUIREMENTS.rookie.minPredictions) {
      reason = `Need at least ${TIER_REQUIREMENTS.rookie.minPredictions} resolved predictions to create a pool`;
    } else if (brierScore === null) {
      reason = 'No Brier score found. Make predictions and wait for resolution';
    } else {
      reason = 'Brier score too high. Improve calibration to create a pool';
    }
  }

  return {
    eligible,
    tier,
    maxCapacity,
    brierScore,
    predictionCount,
    reason,
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
