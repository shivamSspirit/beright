/**
 * Whale Entry Detector
 * Fires when unusually large positions appear in a market.
 * Wraps the existing whale detection skill.
 */

import { whaleWatch } from '../../skills/whale';
import { RawSignal } from './types';

const LARGE_POSITION = 5000;    // $5k = notable
const WHALE_POSITION = 50000;   // $50k = whale
const MEGA_WHALE = 250000;      // $250k = mega whale

export async function detectWhaleEntry(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  try {
    const result = await whaleWatch();
    const movements = (result.data as any[]) || [];

    for (const move of movements) {
      const amount = move.amount || move.size || move.volume || 0;
      if (amount < LARGE_POSITION) continue;

      let strength: number;
      if (amount >= MEGA_WHALE) strength = 1.0;
      else if (amount >= WHALE_POSITION) strength = 0.75 + (amount - WHALE_POSITION) / (MEGA_WHALE - WHALE_POSITION) * 0.25;
      else strength = 0.4 + (amount - LARGE_POSITION) / (WHALE_POSITION - LARGE_POSITION) * 0.35;

      signals.push({
        type: 'whale_entry',
        marketId: move.marketId || move.market_id || move.title?.slice(0, 50) || 'unknown',
        marketTitle: move.title || move.market || 'Unknown Market',
        platform: move.platform || 'solana',
        strength: parseFloat(Math.min(1, strength).toFixed(3)),
        rawData: {
          walletAddress: move.wallet || move.address,
          amount,
          direction: move.direction || move.side,
          txSignature: move.signature || move.tx,
          price: move.price,
          platform: move.platform,
        },
        detectedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('[Signal:WhaleEntry] Detection failed:', err instanceof Error ? err.message : err);
  }

  return signals;
}
