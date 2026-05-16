/**
 * Odds Shift Detector
 * Fires when a market's YES price moves >5% in a short window.
 * Uses Supabase price snapshots from priceTracker to compute delta.
 */

import { getHotMarkets } from '../../skills/markets';
import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';
import { RawSignal } from './types';

const MIN_SHIFT_PCT = 0.05;    // 5% absolute shift
const STRONG_SHIFT_PCT = 0.12; // 12% = strong signal
const LOOKBACK_MINUTES = 60;   // compare against 1hr ago

interface PriceSnapshot {
  market_id: string;
  platform: string;
  yes_price: number;
  recorded_at: string;
}

async function getRecentSnapshots(minutesAgo: number): Promise<PriceSnapshot[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const cutoff = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from('price_snapshots')
      .select('market_id, platform, yes_price, recorded_at')
      .gte('recorded_at', cutoff)
      .order('recorded_at', { ascending: false });

    if (error) return [];
    return (data || []) as PriceSnapshot[];
  } catch {
    return [];
  }
}

export async function detectOddsShift(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  try {
    const [currentMarkets, oldSnapshots] = await Promise.all([
      getHotMarkets(50),
      getRecentSnapshots(LOOKBACK_MINUTES),
    ]);

    // Build lookup of old prices
    const oldPrices: Record<string, number> = {};
    for (const snap of oldSnapshots) {
      const key = `${snap.platform}:${snap.market_id}`;
      if (!oldPrices[key]) oldPrices[key] = snap.yes_price;
    }

    for (const market of currentMarkets) {
      const key = `${market.platform}:${market.marketId}`;
      const oldPrice = oldPrices[key];
      if (!oldPrice || !market.yesPrice) continue;

      const shift = Math.abs(market.yesPrice - oldPrice);
      if (shift < MIN_SHIFT_PCT) continue;

      const direction = market.yesPrice > oldPrice ? 'up' : 'down';
      const strength = Math.min(1, (shift - MIN_SHIFT_PCT) / (STRONG_SHIFT_PCT - MIN_SHIFT_PCT));

      signals.push({
        type: 'odds_shift',
        marketId: market.marketId || market.title.slice(0, 50),
        marketTitle: market.title,
        platform: market.platform,
        strength: parseFloat(strength.toFixed(3)),
        rawData: {
          currentPrice: market.yesPrice,
          previousPrice: oldPrice,
          shiftPct: parseFloat((shift * 100).toFixed(1)),
          direction,
          volume: market.volume,
          url: market.url,
        },
        detectedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('[Signal:OddsShift] Detection failed:', err instanceof Error ? err.message : err);
  }

  return signals;
}
