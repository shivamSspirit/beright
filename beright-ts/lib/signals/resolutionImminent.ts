/**
 * Resolution Imminent Detector
 * Fires when a high-volume market resolves within 24 hours.
 * These are high-urgency: prices are about to lock in.
 */

import { getHotMarkets } from '../../skills/markets';
import { RawSignal } from './types';

const RESOLVE_WINDOW_HOURS = 24;
const MIN_VOLUME = 5000;        // $5k minimum volume to be interesting
const HIGH_VOLUME = 100000;     // $100k = strong signal

export async function detectResolutionImminent(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  try {
    const markets = await getHotMarkets(100);
    const now = Date.now();
    const windowMs = RESOLVE_WINDOW_HOURS * 60 * 60 * 1000;

    for (const market of markets) {
      if (!market.endDate) continue;
      if (market.volume < MIN_VOLUME) continue;
      if (market.status !== 'active') continue;

      const endsAt = new Date(market.endDate).getTime();
      const msUntilClose = endsAt - now;

      if (msUntilClose < 0 || msUntilClose > windowMs) continue;

      const hoursLeft = msUntilClose / (60 * 60 * 1000);

      // Strength: more urgent + more volume = stronger signal
      const urgency = 1 - (hoursLeft / RESOLVE_WINDOW_HOURS); // 0-1
      const volumeScore = Math.min(1, market.volume / HIGH_VOLUME);
      const strength = (urgency * 0.6 + volumeScore * 0.4);

      // Is the market still uncertain (close to 50%)?
      const uncertainty = 1 - Math.abs(market.yesPrice - 0.5) * 2;

      signals.push({
        type: 'resolution_imminent',
        marketId: market.marketId || market.title.slice(0, 50),
        marketTitle: market.title,
        platform: market.platform,
        strength: parseFloat(strength.toFixed(3)),
        rawData: {
          hoursLeft: parseFloat(hoursLeft.toFixed(1)),
          endsAt: market.endDate?.toISOString(),
          volume: market.volume,
          yesPrice: market.yesPrice,
          noPrice: market.noPrice,
          uncertainty: parseFloat(uncertainty.toFixed(3)),
          url: market.url,
        },
        detectedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('[Signal:ResolutionImminent] Detection failed:', err instanceof Error ? err.message : err);
  }

  // Sort by most urgent first
  return signals.sort((a, b) =>
    (a.rawData.hoursLeft as number) - (b.rawData.hoursLeft as number)
  );
}
