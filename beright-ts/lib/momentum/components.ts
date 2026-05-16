/**
 * Momentum Score Engine - Component Calculators
 *
 * Each function calculates a 0-1 component score for the momentum formula:
 *   momentum = (signal_velocity × 0.30)
 *            + (volume_trend × 0.25)
 *            + (smart_money × 0.25)
 *            + (arb_activity × 0.10)
 *            + (social_score × 0.10)
 *            × resolution_multiplier
 *
 * All calculations are deterministic (no LLM) and must complete < 100ms.
 */

import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';
import { MomentumComponents, MomentumMultipliers, DEFAULT_MOMENTUM_CONFIG } from './types';

const config = DEFAULT_MOMENTUM_CONFIG;

/**
 * Signal Velocity Score (0-1)
 *
 * Measures how many signals this market generated vs its 7-day baseline.
 * High velocity = market is heating up.
 *
 * Formula: min(1, (signals_24h / baseline_daily) / 3)
 *   - 3x normal activity = score of 1.0
 */
export async function calculateSignalVelocity(
  marketId: string,
  platform: string
): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Count signals in last 24h
    const { count: signals24h } = await supabaseAdmin
      .from('signals')
      .select('*', { count: 'exact', head: true })
      .eq('market_id', marketId)
      .gte('created_at', oneDayAgo.toISOString());

    // Count signals in last 7d (for baseline)
    const { count: signals7d } = await supabaseAdmin
      .from('signals')
      .select('*', { count: 'exact', head: true })
      .eq('market_id', marketId)
      .gte('created_at', sevenDaysAgo.toISOString());

    const dailyBaseline = (signals7d || 1) / 7;
    const velocity = (signals24h || 0) / Math.max(dailyBaseline, 0.5);

    // Normalize: 3x baseline = score of 1.0
    return Math.min(1, velocity / 3);
  } catch (err) {
    console.warn('[Momentum] Signal velocity calc failed:', err);
    return 0;
  }
}

/**
 * Volume Trend Score (0-1)
 *
 * Compares current 24h volume to 7-day average.
 * Rising volume = increased interest.
 *
 * Formula: min(1, (volume_24h / avg_volume_7d) / 2)
 *   - 2x average volume = score of 1.0
 */
export async function calculateVolumeTrend(
  marketId: string,
  platform: string,
  currentVolume24h?: number
): Promise<number> {
  if (!isSupabaseConfigured || !currentVolume24h) return 0;

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get historical volume from price snapshots
    const { data: snapshots } = await supabaseAdmin
      .from('price_snapshots')
      .select('volume, recorded_at')
      .eq('market_id', marketId)
      .eq('platform', platform)
      .gte('recorded_at', sevenDaysAgo.toISOString())
      .order('recorded_at', { ascending: false })
      .limit(168); // hourly snapshots for 7 days

    if (!snapshots || snapshots.length < 2) {
      // Not enough history, use moderate score
      return currentVolume24h > 10000 ? 0.5 : 0.2;
    }

    // Calculate average daily volume from snapshots
    const totalVolume = snapshots.reduce((sum, s) => sum + (s.volume || 0), 0);
    const avgDailyVolume = (totalVolume / snapshots.length) * 24;

    const volumeRatio = currentVolume24h / Math.max(avgDailyVolume, 1000);

    // Normalize: 2x average = score of 1.0
    return Math.min(1, volumeRatio / 2);
  } catch (err) {
    console.warn('[Momentum] Volume trend calc failed:', err);
    return 0;
  }
}

/**
 * Smart Money Score (0-1)
 *
 * Weighted by forecaster Brier scores. Elite forecasters
 * taking positions = high conviction signal.
 *
 * Scoring:
 *   - Superforecaster (Brier < 0.12) prediction: 0.4 per
 *   - Expert (Brier < 0.18) prediction: 0.2 per
 *   - Good (Brier < 0.25) prediction: 0.1 per
 *   - Capped at 1.0
 */
export async function calculateSmartMoneyScore(
  marketId: string,
  platform: string
): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get recent signals of type smart_money for this market
    const { data: smartSignals } = await supabaseAdmin
      .from('signals')
      .select('raw_data, strength')
      .eq('market_id', marketId)
      .eq('type', 'smart_money')
      .gte('created_at', oneDayAgo.toISOString());

    if (!smartSignals || smartSignals.length === 0) return 0;

    // Sum weighted scores based on forecaster quality
    let score = 0;
    for (const signal of smartSignals) {
      const brier = (signal.raw_data as any)?.brierScore;
      if (brier !== undefined) {
        if (brier < 0.12) score += 0.4;      // Superforecaster
        else if (brier < 0.18) score += 0.2; // Expert
        else if (brier < 0.25) score += 0.1; // Good
      } else {
        // Use strength as fallback
        score += signal.strength * 0.2;
      }
    }

    return Math.min(1, score);
  } catch (err) {
    console.warn('[Momentum] Smart money calc failed:', err);
    return 0;
  }
}

/**
 * Arbitrage Activity Score (0-1)
 *
 * How often arb opportunities are detected for this market.
 * Frequent arbs = price discovery happening, market in flux.
 *
 * Scoring:
 *   - 1 arb signal in 24h: 0.3
 *   - 2 arb signals: 0.6
 *   - 3+ arb signals: 1.0
 */
export async function calculateArbActivity(
  marketId: string,
  platform: string
): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Count arb_opportunity signals for this market
    const { count: arbCount } = await supabaseAdmin
      .from('signals')
      .select('*', { count: 'exact', head: true })
      .eq('market_id', marketId)
      .eq('type', 'arb_opportunity')
      .gte('created_at', oneDayAgo.toISOString());

    if (!arbCount || arbCount === 0) return 0;
    if (arbCount === 1) return 0.3;
    if (arbCount === 2) return 0.6;
    return 1.0;
  } catch (err) {
    console.warn('[Momentum] Arb activity calc failed:', err);
    return 0;
  }
}

/**
 * Social Score (0-1)
 *
 * Social mention velocity from Twitter/Reddit.
 * Note: Requires social_mentions table (Phase 2).
 * Returns 0 until social listener is implemented.
 *
 * Formula: min(1, mentions_24h / baseline_mentions / 2)
 */
export async function calculateSocialScore(
  marketId: string,
  platform: string
): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  try {
    // Check if social_mentions table exists
    const { data: socialData, error } = await supabaseAdmin
      .from('social_mentions')
      .select('id', { count: 'exact', head: true })
      .eq('market_id', marketId)
      .limit(1);

    // Table doesn't exist yet or no data - return 0
    if (error || !socialData) return 0;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Count mentions in last 24h
    const { count: mentions24h } = await supabaseAdmin
      .from('social_mentions')
      .select('*', { count: 'exact', head: true })
      .eq('market_id', marketId)
      .gte('created_at', oneDayAgo.toISOString());

    // Count mentions in last 7d (for baseline)
    const { count: mentions7d } = await supabaseAdmin
      .from('social_mentions')
      .select('*', { count: 'exact', head: true })
      .eq('market_id', marketId)
      .gte('created_at', sevenDaysAgo.toISOString());

    const dailyBaseline = (mentions7d || 1) / 7;
    const velocity = (mentions24h || 0) / Math.max(dailyBaseline, 1);

    // Normalize: 2x baseline = score of 1.0
    return Math.min(1, velocity / 2);
  } catch (err) {
    // Table likely doesn't exist - this is expected until Phase 2
    return 0;
  }
}

/**
 * Resolution Multiplier (1.0 → 3.0)
 *
 * Markets resolving soon get momentum boost.
 * Starts boosting 7 days before resolution.
 *
 * Formula: 1.0 + 2.0 × (1 - hoursLeft / 168)
 *   - 7 days out: 1.0x
 *   - 3.5 days out: 2.0x
 *   - 0 hours (resolving now): 3.0x
 */
export function calculateResolutionMultiplier(
  endDate?: Date | string | null
): number {
  if (!endDate) return 1.0;

  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  const now = new Date();
  const hoursLeft = (end.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Already resolved or in the past
  if (hoursLeft <= 0) return 1.0;

  // More than 7 days away - no boost
  if (hoursLeft > config.resolutionBoostStartHours) return 1.0;

  // Linear interpolation: 1.0 → 3.0
  const progress = 1 - (hoursLeft / config.resolutionBoostStartHours);
  return 1.0 + (config.resolutionBoostMaxMultiplier - 1.0) * progress;
}

/**
 * Calculate all momentum components for a market
 */
export async function calculateAllComponents(
  marketId: string,
  platform: string,
  volume24h?: number,
  endDate?: Date | string | null
): Promise<{ components: MomentumComponents; multipliers: MomentumMultipliers }> {
  // Run all component calculations in parallel
  const [
    signalVelocity,
    volumeTrend,
    smartMoneyScore,
    arbActivity,
    socialScore,
  ] = await Promise.all([
    calculateSignalVelocity(marketId, platform),
    calculateVolumeTrend(marketId, platform, volume24h),
    calculateSmartMoneyScore(marketId, platform),
    calculateArbActivity(marketId, platform),
    calculateSocialScore(marketId, platform),
  ]);

  const resolutionMultiplier = calculateResolutionMultiplier(endDate);

  return {
    components: {
      signalVelocity,
      volumeTrend,
      smartMoneyScore,
      arbActivity,
      socialScore,
    },
    multipliers: {
      resolutionMultiplier,
    },
  };
}

/**
 * Calculate composite momentum score (0-100)
 */
export function calculateCompositeScore(
  components: MomentumComponents,
  multipliers: MomentumMultipliers
): number {
  const weights = config.weights;

  // Weighted sum of components (0-1 range)
  const baseScore =
    components.signalVelocity * weights.signalVelocity +
    components.volumeTrend * weights.volumeTrend +
    components.smartMoneyScore * weights.smartMoneyScore +
    components.arbActivity * weights.arbActivity +
    components.socialScore * weights.socialScore;

  // Apply resolution multiplier and scale to 0-100
  const rawScore = baseScore * multipliers.resolutionMultiplier * 100;

  // Cap at 100
  return Math.min(100, Math.round(rawScore * 10) / 10);
}
