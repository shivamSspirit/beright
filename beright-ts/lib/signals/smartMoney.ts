/**
 * Smart Money Detector
 * Fires when top-ranked forecasters (low Brier score) have made predictions
 * on a market in the last hour. Their moves = signal.
 */

import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';
import { RawSignal } from './types';

const LOOKBACK_MINUTES = 60;
const TOP_FORECASTER_BRIER = 0.18;  // Brier < 0.18 = smart money
const SUPERFORECASTER_BRIER = 0.12; // Brier < 0.12 = elite

export async function detectSmartMoney(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  if (!isSupabaseConfigured) return signals;

  try {
    const cutoff = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000).toISOString();

    // Find recent predictions by users with good Brier scores
    const { data: recentPredictions, error } = await supabaseAdmin
      .from('predictions')
      .select(`
        id, question, platform, market_id, predicted_probability,
        direction, created_at, reasoning,
        users!inner(id, telegram_username, brier_score:predictions(brier_score))
      `)
      .gte('created_at', cutoff)
      .not('question', 'is', null)
      .limit(50);

    if (error || !recentPredictions) return signals;

    // Also check forecaster_profiles for ranked forecasters
    const { data: smartForecasters } = await supabaseAdmin
      .from('forecaster_profiles')
      .select('telegram_id, display_name, brier_overall, global_rank')
      .lt('brier_overall', TOP_FORECASTER_BRIER)
      .order('brier_overall', { ascending: true })
      .limit(20);

    if (!smartForecasters || smartForecasters.length === 0) return signals;

    const smartTelegramIds = new Set(smartForecasters.map((f: any) => f.telegram_id));

    for (const pred of recentPredictions as any[]) {
      const user = pred.users;
      if (!user) continue;

      // Check if this user is a smart money forecaster
      const isSmartMoney = smartTelegramIds.has(user.telegram_id);
      if (!isSmartMoney) continue;

      const forecaster = smartForecasters.find((f: any) => f.telegram_id === user.telegram_id);
      const brier = forecaster?.brier_overall ?? 0.2;

      // Strength: how elite is this forecaster?
      const strength = brier < SUPERFORECASTER_BRIER
        ? 0.9
        : 0.6 + (TOP_FORECASTER_BRIER - brier) / (TOP_FORECASTER_BRIER - SUPERFORECASTER_BRIER) * 0.3;

      signals.push({
        type: 'smart_money',
        marketId: pred.market_id || pred.question.slice(0, 50),
        marketTitle: pred.question,
        platform: pred.platform || 'unknown',
        strength: parseFloat(Math.min(1, strength).toFixed(3)),
        rawData: {
          forecasterName: forecaster?.display_name || user.telegram_username || 'Anonymous',
          brierScore: brier,
          rank: forecaster?.global_rank,
          direction: pred.direction,
          probability: pred.predicted_probability,
          reasoning: pred.reasoning?.slice(0, 200),
          predictedAt: pred.created_at,
        },
        detectedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('[Signal:SmartMoney] Detection failed:', err instanceof Error ? err.message : err);
  }

  return signals;
}
