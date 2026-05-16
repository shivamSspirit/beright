/**
 * Market Consensus Engine for BeRight Protocol
 * Liquidity-weighted consensus across 5 prediction platforms
 * Cross-validates probabilities to produce trustworthy estimates
 */

import { Market, Platform } from '../types/index';
import { searchMarkets } from './markets';
import { calculateSimilarity } from './utils';

export interface ConsensusResult {
  query: string;
  consensus: number;           // weighted probability 0-1
  consensusPct: number;        // weighted probability 0-100
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  agreementScore: number;      // 0-1 how much sources agree
  sourceCount: number;
  sources: ConsensusSourcE[];
  spread: number;              // max - min probability
  timestamp: string;
}

interface ConsensusSourcE {
  platform: Platform;
  title: string;
  probability: number;
  volume: number;
  weight: number;
  url: string;
}

// Platform reliability factors for weighting
const PLATFORM_RELIABILITY: Record<string, number> = {
  polymarket: 1.0,    // highest liquidity, most reliable
  kalshi: 0.95,       // regulated, US-based
  metaculus: 0.90,    // forecaster quality, not money-driven
  limitless: 0.80,    // smaller but real
  manifold: 0.70,     // play money, lower signal
};

/**
 * Calculate weight for a market based on volume and platform reliability
 */
function calculateWeight(market: Market): number {
  const reliability = PLATFORM_RELIABILITY[market.platform] ?? 0.5;
  // log(volume + 1) gives diminishing returns to raw volume
  const volumeWeight = Math.log(market.volume + 1);
  return volumeWeight * reliability;
}

/**
 * Group markets by topic similarity
 * Returns clusters of markets that likely refer to the same question
 */
function clusterMarkets(markets: Market[], threshold = 0.35): Market[][] {
  const clusters: Market[][] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < markets.length; i++) {
    if (assigned.has(i)) continue;

    const cluster: Market[] = [markets[i]];
    assigned.add(i);

    for (let j = i + 1; j < markets.length; j++) {
      if (assigned.has(j)) continue;

      const similarity = calculateSimilarity(markets[i].title, markets[j].title);
      if (similarity >= threshold) {
        cluster.push(markets[j]);
        assigned.add(j);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

/**
 * Calculate consensus for a specific cluster of related markets
 */
function calculateClusterConsensus(markets: Market[]): ConsensusResult | null {
  if (markets.length === 0) return null;

  const sources: ConsensusSourcE[] = markets.map(m => ({
    platform: m.platform,
    title: m.title,
    probability: m.yesPrice,
    volume: m.volume,
    weight: calculateWeight(m),
    url: m.url,
  }));

  const totalWeight = sources.reduce((sum, s) => sum + s.weight, 0);

  // Weighted average probability
  let consensus: number;
  if (totalWeight > 0) {
    consensus = sources.reduce((sum, s) => sum + s.probability * s.weight, 0) / totalWeight;
  } else {
    // Equal weight fallback
    consensus = sources.reduce((sum, s) => sum + s.probability, 0) / sources.length;
  }

  // Agreement score: how close are all sources to the consensus?
  const deviations = sources.map(s => Math.abs(s.probability - consensus));
  const avgDeviation = deviations.reduce((sum, d) => sum + d, 0) / deviations.length;
  const agreementScore = Math.max(0, 1 - avgDeviation * 5); // 0.2 avg deviation = 0 agreement

  // Spread: difference between highest and lowest probability
  const probabilities = sources.map(s => s.probability);
  const spread = Math.max(...probabilities) - Math.min(...probabilities);

  // Confidence based on source count and agreement
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  if (sources.length >= 3 && agreementScore > 0.7) {
    confidence = 'HIGH';
  } else if (sources.length >= 2 && agreementScore > 0.4) {
    confidence = 'MEDIUM';
  } else {
    confidence = 'LOW';
  }

  return {
    query: markets[0].title,
    consensus,
    consensusPct: consensus * 100,
    confidence,
    agreementScore,
    sourceCount: sources.length,
    sources,
    spread,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get consensus for a query across all platforms
 * Returns the best matching cluster's consensus
 */
export async function getConsensus(query: string): Promise<ConsensusResult | null> {
  const allPlatforms: Platform[] = ['polymarket', 'kalshi', 'manifold', 'limitless', 'metaculus' as Platform];
  const markets = await searchMarkets(query, allPlatforms);

  if (markets.length === 0) return null;

  // Cluster similar markets
  const clusters = clusterMarkets(markets);

  // Find the best cluster (most sources, highest total volume)
  let bestCluster: Market[] = [];
  let bestScore = -1;

  for (const cluster of clusters) {
    // Score = number of unique platforms * total volume
    const uniquePlatforms = new Set(cluster.map(m => m.platform)).size;
    const totalVolume = cluster.reduce((sum, m) => sum + m.volume, 0);
    const score = uniquePlatforms * Math.log(totalVolume + 1);

    if (score > bestScore) {
      bestScore = score;
      bestCluster = cluster;
    }
  }

  return calculateClusterConsensus(bestCluster);
}

/**
 * Get consensus for multiple queries at once
 */
export async function getMultiConsensus(queries: string[]): Promise<Map<string, ConsensusResult | null>> {
  const results = await Promise.all(queries.map(q => getConsensus(q)));
  const map = new Map<string, ConsensusResult | null>();
  for (let i = 0; i < queries.length; i++) {
    map.set(queries[i], results[i]);
  }
  return map;
}

/**
 * Format consensus for display
 */
export function formatConsensus(result: ConsensusResult): string {
  const confEmoji = result.confidence === 'HIGH' ? '🟢' : result.confidence === 'MEDIUM' ? '🟡' : '🔴';

  let output = `\n${'='.repeat(50)}\n   MARKET CONSENSUS\n${'='.repeat(50)}\n\n`;
  output += `Question: ${result.query.slice(0, 60)}\n\n`;
  output += `${confEmoji} CONSENSUS: ${result.consensusPct.toFixed(1)}% YES\n`;
  output += `   Confidence: ${result.confidence}\n`;
  output += `   Agreement: ${(result.agreementScore * 100).toFixed(0)}%\n`;
  output += `   Spread: ${(result.spread * 100).toFixed(1)}pp\n`;
  output += `   Sources: ${result.sourceCount} platforms\n\n`;

  output += 'BREAKDOWN:\n';
  for (const source of result.sources.sort((a, b) => b.weight - a.weight)) {
    const pct = (source.probability * 100).toFixed(1);
    output += `   ${source.platform.toUpperCase().padEnd(12)} ${pct}% YES`;
    if (source.volume > 0) {
      output += `  (vol: ${source.volume > 1000 ? `$${(source.volume / 1000).toFixed(0)}K` : source.volume})`;
    }
    output += '\n';
  }

  return output;
}

// CLI interface
if (process.argv[1]?.endsWith('consensus.ts')) {
  const query = process.argv.slice(2).join(' ');
  if (!query) {
    console.log('Usage: ts-node consensus.ts <query>');
    process.exit(1);
  }
  (async () => {
    console.log(`Getting consensus for: "${query}"...`);
    const result = await getConsensus(query);
    if (result) {
      console.log(formatConsensus(result));
    } else {
      console.log('No markets found for this query.');
    }
  })();
}
