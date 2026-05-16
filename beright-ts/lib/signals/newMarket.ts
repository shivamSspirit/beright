/**
 * New Market Detector
 * Fires when high-volume markets were created recently (last 2 hours).
 * Early detection of new narratives.
 */

import { searchMarkets } from '../../skills/markets';
import { RawSignal } from './types';

const LOOKBACK_HOURS = 2;      // Markets created in last 2 hours
const MIN_VOLUME = 500;        // $500 minimum (some traction already)
const HOT_VOLUME = 25000;      // $25k = hot new market

export async function detectNewMarket(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  try {
    const markets = await searchMarkets('', ['polymarket', 'kalshi', 'manifold']);
    const cutoff = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);

    for (const market of markets) {
      if (!market.createdAt) continue;
      if (market.volume < MIN_VOLUME) continue;
      if (market.status !== 'active') continue;

      const createdAt = new Date(market.createdAt);
      if (createdAt < cutoff) continue;

      // Strength: volume in first 2 hours is extraordinary
      const strength = Math.min(1, market.volume / HOT_VOLUME);

      const ageMinutes = (Date.now() - createdAt.getTime()) / (60 * 1000);

      signals.push({
        type: 'new_market',
        marketId: market.marketId || market.title.slice(0, 50),
        marketTitle: market.title,
        platform: market.platform,
        strength: parseFloat(strength.toFixed(3)),
        rawData: {
          ageMinutes: parseFloat(ageMinutes.toFixed(0)),
          volume: market.volume,
          yesPrice: market.yesPrice,
          createdAt: market.createdAt?.toISOString(),
          url: market.url,
        },
        detectedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('[Signal:NewMarket] Detection failed:', err instanceof Error ? err.message : err);
  }

  return signals.sort((a, b) => (b.rawData.volume as number) - (a.rawData.volume as number));
}
