/**
 * Cross-Market Divergence Detector
 * Fires when correlated markets diverge by >10 percentage points.
 * e.g. "Trump wins presidency" at 60% but "Trump wins Florida" at 45% — divergence.
 */

import { getHotMarkets } from '../../skills/markets';
import { RawSignal } from './types';

const MIN_DIVERGENCE = 0.10;     // 10pp divergence = signal
const STRONG_DIVERGENCE = 0.20;  // 20pp = strong signal
const MIN_VOLUME_EACH = 5000;    // both markets need $5k+ volume

// Pairs of keywords that indicate correlated markets
const CORRELATION_PATTERNS = [
  ['trump', 'republican'],
  ['biden', 'democrat'],
  ['bitcoin', 'btc'],
  ['ethereum', 'eth'],
  ['fed', 'rate', 'interest'],
  ['recession', 'gdp'],
  ['inflation', 'cpi'],
  ['ukraine', 'russia'],
  ['china', 'taiwan'],
  ['ai', 'artificial intelligence'],
];

function matchesPattern(title: string, pattern: string[]): boolean {
  const lower = title.toLowerCase();
  return pattern.some(kw => lower.includes(kw));
}

function findCorrelatedGroup(market: { title: string }, allMarkets: { title: string }[]): string | null {
  for (const pattern of CORRELATION_PATTERNS) {
    if (matchesPattern(market.title, pattern)) {
      return pattern[0]; // use first keyword as group ID
    }
  }
  return null;
}

export async function detectCrossMarket(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  try {
    const markets = await getHotMarkets(80);
    const filtered = markets.filter(m => m.volume >= MIN_VOLUME_EACH && m.status === 'active');

    // Group markets by correlation pattern
    const groups: Record<string, typeof filtered> = {};
    for (const market of filtered) {
      const group = findCorrelatedGroup(market, filtered);
      if (!group) continue;
      if (!groups[group]) groups[group] = [];
      groups[group].push(market);
    }

    // Find divergences within each group
    for (const [groupKey, groupMarkets] of Object.entries(groups)) {
      if (groupMarkets.length < 2) continue;

      // Sort by YES price to find divergent pairs
      const sorted = groupMarkets.sort((a, b) => b.yesPrice - a.yesPrice);

      for (let i = 0; i < sorted.length - 1; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const marketA = sorted[i];
          const marketB = sorted[j];

          const divergence = Math.abs(marketA.yesPrice - marketB.yesPrice);
          if (divergence < MIN_DIVERGENCE) continue;

          const strength = Math.min(1, (divergence - MIN_DIVERGENCE) / (STRONG_DIVERGENCE - MIN_DIVERGENCE));

          signals.push({
            type: 'cross_market',
            marketId: `cross:${groupKey}:${marketA.marketId}:${marketB.marketId}`,
            marketTitle: `Cross-market divergence: ${groupKey} (${(divergence * 100).toFixed(0)}pp)`,
            platform: `${marketA.platform}/${marketB.platform}`,
            strength: parseFloat(strength.toFixed(3)),
            rawData: {
              group: groupKey,
              marketA: {
                title: marketA.title,
                platform: marketA.platform,
                yesPrice: marketA.yesPrice,
                volume: marketA.volume,
                url: marketA.url,
              },
              marketB: {
                title: marketB.title,
                platform: marketB.platform,
                yesPrice: marketB.yesPrice,
                volume: marketB.volume,
                url: marketB.url,
              },
              divergencePct: parseFloat((divergence * 100).toFixed(1)),
            },
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }
  } catch (err) {
    console.warn('[Signal:CrossMarket] Detection failed:', err instanceof Error ? err.message : err);
  }

  return signals.sort((a, b) =>
    (b.rawData.divergencePct as number) - (a.rawData.divergencePct as number)
  ).slice(0, 5);
}
