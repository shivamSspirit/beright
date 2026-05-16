/**
 * Arbitrage Opportunity Detector
 * Wraps the existing V2 arbitrage scanner as a signal source.
 */

import { scanSimple } from '../../lib/arbitrage/scanner';
import { RawSignal } from './types';

const MIN_SPREAD = 0.03;    // 3% net profit minimum
const STRONG_SPREAD = 0.08; // 8% = strong signal

export async function detectArbOpportunity(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  try {
    const result = await scanSimple();

    for (const opp of result.opportunities) {
      const netProfit = opp.netProfitPct / 100;  // convert % to decimal
      if (netProfit < MIN_SPREAD) continue;

      const strength = Math.min(1, (netProfit - MIN_SPREAD) / (STRONG_SPREAD - MIN_SPREAD));

      const marketA = opp.pair.marketA;
      const marketB = opp.pair.marketB;
      const matchConf = opp.confidence.matchConfidence;

      signals.push({
        type: 'arb_opportunity',
        marketId: `${marketA.platform}:${marketB.platform}:${marketA.title.slice(0, 30)}`,
        marketTitle: marketA.title,
        platform: `${marketA.platform}/${marketB.platform}`,
        strength: parseFloat(strength.toFixed(3)),
        rawData: {
          platformA: marketA.platform,
          platformB: marketB.platform,
          priceAYes: marketA.yesPrice,
          priceBYes: marketB.yesPrice,
          spread: netProfit,
          spreadPct: parseFloat(opp.netProfitPct.toFixed(2)),
          grossSpreadPct: parseFloat(opp.grossProfitPct.toFixed(2)),
          matchConfidence: matchConf,
          confidenceGrade: opp.confidence.grade,
          volumeA: marketA.volume,
          volumeB: marketB.volume,
          strategy: opp.strategy.description,
        },
        detectedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('[Signal:ArbOpportunity] Detection failed:', err instanceof Error ? err.message : err);
  }

  return signals;
}
