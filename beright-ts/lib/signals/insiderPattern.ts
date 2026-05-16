/**
 * Insider Pattern Detector
 * Detects when there's a volume spike + position imbalance in a 2-hour window.
 * Pattern: sudden large one-sided volume = possible informed trading.
 */

import { getHotMarkets } from '../../skills/markets';
import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';
import { RawSignal } from './types';

const LOOKBACK_HOURS = 2;
const MIN_VOLUME = 10000;
const IMBALANCE_THRESHOLD = 0.70;  // 70%+ of volume on one side = imbalance
const STRONG_IMBALANCE = 0.85;     // 85%+ = strong signal

async function getRecentVolumeData(marketId: string, platform: string, hoursBack: number) {
  if (!isSupabaseConfigured) return null;
  try {
    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
    const { data } = await supabaseAdmin
      .from('whale_trades')
      .select('direction, amount')
      .eq('market_id', marketId)
      .gte('block_time', cutoff);

    if (!data || data.length === 0) return null;

    const trades = data as { direction: string; amount: number }[];
    const totalVol = trades.reduce((sum, t) => sum + (t.amount || 0), 0);
    const yesVol = trades
      .filter(t => t.direction === 'YES' || t.direction === 'BUY')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    return {
      totalVol,
      yesVol,
      noVol: totalVol - yesVol,
      tradeCount: trades.length,
      imbalance: totalVol > 0 ? Math.max(yesVol, totalVol - yesVol) / totalVol : 0,
      direction: yesVol > totalVol / 2 ? 'YES' : 'NO',
    };
  } catch {
    return null;
  }
}

export async function detectInsiderPattern(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  try {
    const markets = await getHotMarkets(50);

    for (const market of markets) {
      if (market.volume < MIN_VOLUME) continue;
      if (!market.marketId) continue;

      const volumeData = await getRecentVolumeData(market.marketId, market.platform, LOOKBACK_HOURS);
      if (!volumeData) continue;
      if (volumeData.totalVol < MIN_VOLUME * 0.1) continue;  // need recent activity

      if (volumeData.imbalance < IMBALANCE_THRESHOLD) continue;

      const strength = Math.min(1,
        (volumeData.imbalance - IMBALANCE_THRESHOLD) / (STRONG_IMBALANCE - IMBALANCE_THRESHOLD)
      );

      signals.push({
        type: 'insider_pattern',
        marketId: market.marketId,
        marketTitle: market.title,
        platform: market.platform,
        strength: parseFloat((strength * 0.8).toFixed(3)), // cap at 0.8 (uncertain signal)
        rawData: {
          imbalancePct: parseFloat((volumeData.imbalance * 100).toFixed(1)),
          direction: volumeData.direction,
          recentVolume: volumeData.totalVol,
          tradeCount: volumeData.tradeCount,
          yesPrice: market.yesPrice,
          url: market.url,
          windowHours: LOOKBACK_HOURS,
        },
        detectedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('[Signal:InsiderPattern] Detection failed:', err instanceof Error ? err.message : err);
  }

  return signals;
}
