/**
 * Narrative Emergence Detector
 * Detects when multiple markets share growing keyword clusters —
 * signals that a topic is becoming a market narrative.
 */

import { getHotMarkets } from '../../skills/markets';
import { RawSignal } from './types';

// Noise words to exclude from clustering
const STOP_WORDS = new Set([
  'will', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and',
  'or', 'be', 'is', 'are', 'was', 'were', 'by', 'from', 'with', 'that',
  'this', 'it', 'he', 'she', 'they', 'we', 'you', 'i', 'what', 'who',
  'when', 'where', 'how', 'which', 'have', 'has', 'had', 'do', 'does',
  'did', 'can', 'could', 'would', 'should', 'may', 'might', 'must',
  'win', 'lose', 'happen', 'occur', 'become', 'get', 'go', 'come',
  'election', 'market', 'predict', '2024', '2025', '2026',
]);

function extractKeywords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));
}

export async function detectNarrativeEmergence(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  try {
    const markets = await getHotMarkets(80);

    // Extract keywords and cluster
    const keywordClusters: Record<string, { markets: typeof markets; totalVolume: number }> = {};

    for (const market of markets) {
      if (market.volume < 1000) continue;
      const keywords = extractKeywords(market.title);

      for (const kw of keywords) {
        if (!keywordClusters[kw]) {
          keywordClusters[kw] = { markets: [], totalVolume: 0 };
        }
        keywordClusters[kw].markets.push(market);
        keywordClusters[kw].totalVolume += market.volume;
      }
    }

    // Find clusters with multiple markets and significant combined volume
    const emerging = Object.entries(keywordClusters)
      .filter(([, cluster]) => cluster.markets.length >= 3 && cluster.totalVolume > 20000)
      .sort(([, a], [, b]) => b.totalVolume - a.totalVolume)
      .slice(0, 5);

    for (const [keyword, cluster] of emerging) {
      // Unique markets only
      const uniqueMarkets = [...new Map(cluster.markets.map(m => [m.marketId, m])).values()];
      if (uniqueMarkets.length < 3) continue;

      const strength = Math.min(1, (uniqueMarkets.length - 2) / 8 + cluster.totalVolume / 500000);
      const representativeMarket = uniqueMarkets.sort((a, b) => b.volume - a.volume)[0];

      signals.push({
        type: 'narrative_emergence',
        marketId: `narrative:${keyword}`,
        marketTitle: `Narrative: "${keyword}" (${uniqueMarkets.length} markets)`,
        platform: representativeMarket.platform,
        strength: parseFloat(Math.min(1, strength).toFixed(3)),
        rawData: {
          keyword,
          marketCount: uniqueMarkets.length,
          totalVolume: cluster.totalVolume,
          topMarkets: uniqueMarkets.slice(0, 5).map(m => ({
            title: m.title,
            platform: m.platform,
            volume: m.volume,
            yesPrice: m.yesPrice,
            url: m.url,
          })),
        },
        detectedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('[Signal:NarrativeEmergence] Detection failed:', err instanceof Error ? err.message : err);
  }

  return signals;
}
