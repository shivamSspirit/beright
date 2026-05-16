/**
 * Volume Surge Detector
 * Fires when a market's current volume is >3x its recent average
 */

import { getHotMarkets } from '../../skills/markets';
import { RawSignal } from './types';
import { supabaseAdmin } from '../supabase/client';

const SURGE_THRESHOLD = 2.5;   // 2.5x average = signal
const STRONG_SURGE = 5.0;      // 5x average = strong signal

export async function detectVolumeSurge(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  try {
    const markets = await getHotMarkets(50);

    for (const market of markets) {
      if (!market.volume || market.volume < 500) continue;

      // Get 7-day avg volume baseline from arbitrage_history or use heuristic
      // Heuristic: if volume > $50k and 24h vol > 30% of total vol → likely surge
      const vol24h = market.volume24h ?? 0;
      const totalVol = market.volume;

      // Signal strength: how much above threshold?
      let strength = 0;
      let surgeRatio = 1;

      if (vol24h > 0 && totalVol > 0) {
        // If 24h is >25% of total volume, it's actively surging
        const dailyRatio = vol24h / totalVol;
        if (dailyRatio > 0.25) {
          surgeRatio = dailyRatio / 0.1; // normalize: 0.1 = normal daily rate
          strength = Math.min(1, (surgeRatio - SURGE_THRESHOLD) / (STRONG_SURGE - SURGE_THRESHOLD));
        }
      } else if (totalVol > 100000) {
        // High absolute volume is always interesting
        strength = Math.min(1, (totalVol - 100000) / 900000);
      }

      if (strength > 0.3) {
        signals.push({
          type: 'volume_surge',
          marketId: market.marketId || market.title.slice(0, 50),
          marketTitle: market.title,
          platform: market.platform,
          strength: parseFloat(strength.toFixed(3)),
          rawData: {
            volume: market.volume,
            volume24h: vol24h,
            surgeRatio,
            yesPrice: market.yesPrice,
            url: market.url,
          },
          detectedAt: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.warn('[Signal:VolumeSurge] Detection failed:', err instanceof Error ? err.message : err);
  }

  return signals;
}
