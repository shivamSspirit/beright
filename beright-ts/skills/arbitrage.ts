/**
 * Arbitrage Skill for BeRight Protocol
 * Cross-platform price comparison and opportunity detection
 *
 * V2 UPDATE: Now uses production-grade matching with:
 * - 85% minimum equivalence threshold
 * - Named entity extraction
 * - Date/resolution alignment
 * - Proper arbitrage math
 * - Risk scoring
 *
 * Set USE_V2_ARBITRAGE=false to use legacy scanner
 */

import { ArbitrageOpportunity, Market, Platform, SkillResponse } from '../types/index';
import { PLATFORMS } from '../config/platforms';
import { ARBITRAGE } from '../config/thresholds';
import { searchMarkets } from './markets';
import {
  calculateSimilarity,
  formatUsd,
  formatPct,
  confidenceEmoji,
  timestamp,
} from './utils';

// Feature flag for V2 system
const USE_V2_ARBITRAGE = process.env.USE_V2_ARBITRAGE !== 'false';

// Import V2 system
import { arbitrageV2 } from './arbitrageV2';

/**
 * Match markets between two platforms by similarity
 */
function matchMarkets(
  marketsA: Market[],
  marketsB: Market[],
  threshold = ARBITRAGE.similarityThreshold
): Array<[Market, Market, number]> {
  const matches: Array<[Market, Market, number]> = [];

  for (const ma of marketsA) {
    let bestMatch: Market | null = null;
    let bestScore = 0;

    for (const mb of marketsB) {
      const score = calculateSimilarity(ma.title, mb.title);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = mb;
      }
    }

    if (bestMatch && bestScore >= threshold) {
      matches.push([ma, bestMatch, bestScore]);
    }
  }

  return matches.sort((a, b) => b[2] - a[2]);
}

/**
 * Calculate arbitrage opportunity between two prices
 */
function calculateArbitrage(
  priceAYes: number,
  priceBYes: number,
  platformA: Platform,
  platformB: Platform
): { strategy: string; profit: number; profitPercent: number } | null {
  const feeA = PLATFORMS[platformA]?.fee || 0.01;
  const feeB = PLATFORMS[platformB]?.fee || 0.01;

  const priceANo = 1 - priceAYes;
  const priceBNo = 1 - priceBYes;

  const strategies: Array<{ strategy: string; cost: number; profit: number; profitPercent: number }> = [];

  // Strategy 1: Buy YES on A (lower) + NO on B
  if (priceAYes < priceBYes) {
    const cost = priceAYes * (1 + feeA) + priceBNo * (1 + feeB);
    if (cost < 1) {
      const profit = 1 - cost;
      strategies.push({
        strategy: `Buy YES @ ${platformA} (${formatPct(priceAYes)}) + NO @ ${platformB} (${formatPct(priceBNo)})`,
        cost,
        profit,
        profitPercent: profit / cost,
      });
    }
  }

  // Strategy 2: Buy YES on B (lower) + NO on A
  if (priceBYes < priceAYes) {
    const cost = priceBYes * (1 + feeB) + priceANo * (1 + feeA);
    if (cost < 1) {
      const profit = 1 - cost;
      strategies.push({
        strategy: `Buy YES @ ${platformB} (${formatPct(priceBYes)}) + NO @ ${platformA} (${formatPct(priceANo)})`,
        cost,
        profit,
        profitPercent: profit / cost,
      });
    }
  }

  // Pure price discrepancy
  const spread = Math.abs(priceAYes - priceBYes);
  if (spread >= ARBITRAGE.minSpread) {
    if (priceAYes < priceBYes) {
      strategies.push({
        strategy: `Buy YES @ ${platformA} (${formatPct(priceAYes)}), Sell @ ${platformB} (${formatPct(priceBYes)})`,
        cost: priceAYes,
        profit: spread,
        profitPercent: priceAYes > 0 ? spread / priceAYes : 0,
      });
    } else {
      strategies.push({
        strategy: `Buy YES @ ${platformB} (${formatPct(priceBYes)}), Sell @ ${platformA} (${formatPct(priceAYes)})`,
        cost: priceBYes,
        profit: spread,
        profitPercent: priceBYes > 0 ? spread / priceBYes : 0,
      });
    }
  }

  if (strategies.length === 0) return null;

  // Return best strategy
  return strategies.reduce((best, curr) =>
    curr.profitPercent > best.profitPercent ? curr : best
  );
}

/**
 * Scan for arbitrage between two platforms
 */
async function scanPair(
  platformA: Platform,
  platformB: Platform,
  query?: string
): Promise<ArbitrageOpportunity[]> {
  console.log(`Fetching ${platformA} markets...`);
  const marketsA = await searchMarkets(query || '', [platformA]);
  console.log(`  Got ${marketsA.length} markets`);

  console.log(`Fetching ${platformB} markets...`);
  const marketsB = await searchMarkets(query || '', [platformB]);
  console.log(`  Got ${marketsB.length} markets`);

  console.log('Matching markets...');
  const matches = matchMarkets(marketsA, marketsB);
  console.log(`  Found ${matches.length} potential matches`);

  const opportunities: ArbitrageOpportunity[] = [];

  for (const [ma, mb, similarity] of matches) {
    if (ma.yesPrice === 0 || mb.yesPrice === 0) continue;

    const arb = calculateArbitrage(ma.yesPrice, mb.yesPrice, platformA, platformB);

    if (arb && arb.profitPercent >= ARBITRAGE.minSpread) {
      opportunities.push({
        topic: ma.title.slice(0, 60),
        platformA: platformA,
        platformB: platformB,
        marketATitle: ma.title.slice(0, 50),
        marketBTitle: mb.title.slice(0, 50),
        priceAYes: ma.yesPrice,
        priceBYes: mb.yesPrice,
        spread: Math.abs(ma.yesPrice - mb.yesPrice),
        strategy: arb.strategy,
        profitPercent: arb.profitPercent,
        matchConfidence: similarity,
        volumeA: ma.volume,
        volumeB: mb.volume,
      });
    }
  }

  return opportunities.sort((a, b) => b.profitPercent - a.profitPercent);
}

/**
 * Scan all platform pairs for arbitrage
 */
export async function scanAll(query?: string): Promise<ArbitrageOpportunity[]> {
  const platforms: Platform[] = ['polymarket', 'kalshi', 'manifold'];
  const allOpportunities: ArbitrageOpportunity[] = [];

  for (let i = 0; i < platforms.length; i++) {
    for (let j = i + 1; j < platforms.length; j++) {
      console.log(`\n--- Scanning ${platforms[i]} vs ${platforms[j]} ---`);
      const opps = await scanPair(platforms[i], platforms[j], query);
      allOpportunities.push(...opps);
    }
  }

  return allOpportunities.sort((a, b) => b.profitPercent - a.profitPercent);
}

/**
 * Format single opportunity for display
 */
function formatOpportunity(opp: ArbitrageOpportunity, index: number): string {
  const emoji = confidenceEmoji(opp.matchConfidence);

  return `
#${index} | ${formatPct(opp.profitPercent)} potential profit

📊 ${opp.topic}

Platform          YES      NO
${opp.platformA.padEnd(16)} ${formatPct(opp.priceAYes).padEnd(8)} ${formatPct(1 - opp.priceAYes)}
${opp.platformB.padEnd(16)} ${formatPct(opp.priceBYes).padEnd(8)} ${formatPct(1 - opp.priceBYes)}

SPREAD: ${formatPct(opp.spread)}
STRATEGY: ${opp.strategy}

Match confidence: ${emoji} ${formatPct(opp.matchConfidence)}
Volume: ${opp.platformA} ${formatUsd(opp.volumeA)} | ${opp.platformB} ${formatUsd(opp.volumeB)}
`;
}

/**
 * Format full arbitrage report
 */
export function formatArbReport(opportunities: ArbitrageOpportunity[]): string {
  if (!opportunities.length) {
    return `
🎯 ARBITRAGE SCAN COMPLETE

No opportunities found above 3% threshold.

Platforms scanned:
• Polymarket
• Kalshi
• Manifold

This is normal - arbitrage opportunities are rare and
get captured quickly by automated traders.

Try again later or search for specific topics.
`;
  }

  let report = `
🎯 ARBITRAGE SCAN RESULTS

Found ${opportunities.length} opportunities above 3% threshold
Scan time: ${timestamp().slice(0, 19)}

`;

  for (let i = 0; i < Math.min(opportunities.length, 5); i++) {
    report += formatOpportunity(opportunities[i], i + 1);
    report += '\n---\n';
  }

  report += `
⚠️ RISKS TO CONSIDER:
• Resolution rules may differ between platforms
• Execution slippage on large orders
• Liquidity constraints
• Match confidence affects reliability

💡 LEARNING MOMENT:
Arbitrage exists because markets are fragmented.
Same event, different platforms = different prices.
The spread is your edge - but act fast!
`;

  return report;
}

/**
 * Main arbitrage skill function
 *
 * Uses V2 production-grade system by default.
 * Falls back to legacy if V2 fails or is disabled.
 */
export async function arbitrage(query?: string): Promise<SkillResponse> {
  // Try V2 system first (production-grade with strict validation)
  if (USE_V2_ARBITRAGE) {
    try {
      console.log('[Arbitrage] Using V2 production-grade scanner');
      return await arbitrageV2(query);
    } catch (error) {
      console.error('[Arbitrage] V2 failed, falling back to legacy:', error);
      // Fall through to legacy
    }
  }

  // Legacy implementation
  console.log('[Arbitrage] Using legacy scanner');
  try {
    const opportunities = await scanAll(query);
    const text = formatArbReport(opportunities);

    return {
      text,
      mood: opportunities.length > 0 ? 'ALERT' : 'NEUTRAL',
      data: opportunities,
    };
  } catch (error) {
    return {
      text: `
🎯 ARBITRAGE SCAN ERROR

Failed to complete scan: ${error instanceof Error ? error.message : 'Unknown error'}

Please try again in a few minutes.
`,
      mood: 'ERROR',
    };
  }
}

// CLI interface
if (process.argv[1]?.endsWith('arbitrage.ts')) {
  const query = process.argv.slice(2).join(' ') || undefined;

  console.log('='.repeat(60));
  console.log('BeRight Arbitrage Scanner');
  console.log('='.repeat(60));
  console.log();

  if (query) {
    console.log(`Searching for: ${query}`);
  }

  arbitrage(query).then(result => {
    console.log(result.text);
  });
}
