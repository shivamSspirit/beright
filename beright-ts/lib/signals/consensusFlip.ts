/**
 * Consensus Flip Detector
 * Fires when a market's YES probability crosses the 50% boundary
 * (YES/NO majority flips). Major signal — market changing its mind.
 */

import { getHotMarkets } from '../../skills/markets';
import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';
import { RawSignal } from './types';

const FLIP_BOUNDARY = 0.50;
const BOUNDARY_MARGIN = 0.05;  // within 5% of 50% = approaching flip
const MIN_VOLUME = 10000;

async function getLastKnownPrice(marketId: string, platform: string): Promise<number | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data } = await supabaseAdmin
      .from('price_snapshots')
      .select('yes_price')
      .eq('market_id', marketId)
      .eq('platform', platform)
      .order('recorded_at', { ascending: false })
      .limit(2)
      .range(1, 1);  // second most recent (skip current)

    return (data?.[0] as any)?.yes_price ?? null;
  } catch {
    return null;
  }
}

export async function detectConsensusFlip(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  try {
    const markets = await getHotMarkets(60);

    for (const market of markets) {
      if (market.volume < MIN_VOLUME) continue;
      if (!market.marketId) continue;

      const currentPrice = market.yesPrice;
      const previousPrice = await getLastKnownPrice(market.marketId, market.platform);

      if (!previousPrice) {
        // No history — check if near the boundary (approaching flip)
        const distanceFromFlip = Math.abs(currentPrice - FLIP_BOUNDARY);
        if (distanceFromFlip < BOUNDARY_MARGIN) {
          const strength = 1 - (distanceFromFlip / BOUNDARY_MARGIN);
          signals.push({
            type: 'consensus_flip',
            marketId: market.marketId,
            marketTitle: market.title,
            platform: market.platform,
            strength: parseFloat((strength * 0.5).toFixed(3)), // lower strength without confirmed flip
            rawData: {
              currentPrice,
              previousPrice: null,
              flipped: false,
              approachingFlip: true,
              distanceFromFlip: parseFloat((distanceFromFlip * 100).toFixed(1)),
              volume: market.volume,
              url: market.url,
            },
            detectedAt: new Date().toISOString(),
          });
        }
        continue;
      }

      // Check if price crossed 50% boundary
      const crossedFlip =
        (previousPrice < FLIP_BOUNDARY && currentPrice >= FLIP_BOUNDARY) ||
        (previousPrice >= FLIP_BOUNDARY && currentPrice < FLIP_BOUNDARY);

      if (!crossedFlip) continue;

      const direction = currentPrice > FLIP_BOUNDARY ? 'YES majority' : 'NO majority';
      const magnitude = Math.abs(currentPrice - previousPrice);
      const strength = Math.min(1, 0.7 + magnitude * 2);

      signals.push({
        type: 'consensus_flip',
        marketId: market.marketId,
        marketTitle: market.title,
        platform: market.platform,
        strength: parseFloat(strength.toFixed(3)),
        rawData: {
          currentPrice,
          previousPrice,
          flipped: true,
          newMajority: direction,
          magnitude: parseFloat((magnitude * 100).toFixed(1)),
          volume: market.volume,
          url: market.url,
        },
        detectedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('[Signal:ConsensusFlip] Detection failed:', err instanceof Error ? err.message : err);
  }

  return signals;
}
