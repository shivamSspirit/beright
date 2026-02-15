/**
 * Production-Grade Arbitrage Scanner
 *
 * Main orchestrator for the arbitrage detection system.
 * Coordinates market fetching, matching, analysis, and reporting.
 *
 * Architecture:
 * 1. Fetch markets from all platforms in parallel
 * 2. Run multi-stage validation pipeline
 * 3. Calculate arbitrage opportunities
 * 4. Apply risk controls and filters
 * 5. Generate actionable output
 */

import { Market, Platform } from '../../types/index';
import { searchMarkets, getHotMarkets } from '../../skills/markets';
import { matchMarkets, getMatchingStats } from './marketMatcher';
import { findArbitrageOpportunities, analyzeArbitrage } from './calculator';
import {
  ValidatedMarketPair,
  ValidatedArbitrageOpportunity,
  ArbitrageConfig,
  DEFAULT_ARBITRAGE_CONFIG,
  ConfidenceGrade,
} from './types';

// ============================================
// SCANNER CONFIGURATION
// ============================================

export interface ScannerOptions {
  // Platforms to scan
  platforms: Platform[];

  // Query to filter markets (optional)
  query?: string;

  // Maximum markets to fetch per platform
  maxMarketsPerPlatform: number;

  // Arbitrage configuration
  arbConfig: ArbitrageConfig;

  // Output options
  maxOpportunities: number;
  minConfidenceGrade: ConfidenceGrade;

  // Logging
  verbose: boolean;
}

const DEFAULT_SCANNER_OPTIONS: ScannerOptions = {
  platforms: ['polymarket', 'kalshi', 'manifold'],
  maxMarketsPerPlatform: 50,
  arbConfig: DEFAULT_ARBITRAGE_CONFIG,
  maxOpportunities: 10,
  minConfidenceGrade: 'C',
  verbose: false,
};

// ============================================
// SCANNER RESULT
// ============================================

export interface ScanResult {
  success: boolean;
  timestamp: Date;
  duration: number;

  // Market stats
  marketsScanned: Record<Platform, number>;
  totalMarkets: number;

  // Matching stats
  pairsEvaluated: number;
  pairsValidated: number;
  avgEquivalenceScore: number;

  // Opportunities
  opportunities: ValidatedArbitrageOpportunity[];
  filteredCount: number;  // Opportunities that didn't pass filters

  // Errors
  errors: string[];
  warnings: string[];
}

// ============================================
// MAIN SCANNER
// ============================================

/**
 * Scan for arbitrage opportunities across platforms
 */
export async function scanForArbitrage(
  options: Partial<ScannerOptions> = {}
): Promise<ScanResult> {
  const opts = { ...DEFAULT_SCANNER_OPTIONS, ...options };
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];

  const result: ScanResult = {
    success: false,
    timestamp: new Date(),
    duration: 0,
    marketsScanned: {} as Record<Platform, number>,
    totalMarkets: 0,
    pairsEvaluated: 0,
    pairsValidated: 0,
    avgEquivalenceScore: 0,
    opportunities: [],
    filteredCount: 0,
    errors,
    warnings,
  };

  try {
    // Step 1: Fetch markets from all platforms
    if (opts.verbose) console.log('Fetching markets from platforms...');

    const marketsByPlatform = await fetchAllMarkets(opts.platforms, opts.query, opts.maxMarketsPerPlatform);

    for (const [platform, markets] of Object.entries(marketsByPlatform)) {
      result.marketsScanned[platform as Platform] = markets.length;
      result.totalMarkets += markets.length;
    }

    if (opts.verbose) {
      console.log(`  Total markets: ${result.totalMarkets}`);
      for (const [p, count] of Object.entries(result.marketsScanned)) {
        console.log(`    ${p}: ${count}`);
      }
    }

    // Step 2: Match markets across platform pairs
    if (opts.verbose) console.log('\nMatching markets across platforms...');

    const allValidatedPairs: ValidatedMarketPair[] = [];
    const platforms = Object.keys(marketsByPlatform) as Platform[];

    for (let i = 0; i < platforms.length; i++) {
      for (let j = i + 1; j < platforms.length; j++) {
        const platformA = platforms[i];
        const platformB = platforms[j];
        const marketsA = marketsByPlatform[platformA] || [];
        const marketsB = marketsByPlatform[platformB] || [];

        if (marketsA.length === 0 || marketsB.length === 0) continue;

        const pairsToEvaluate = marketsA.length * marketsB.length;
        result.pairsEvaluated += pairsToEvaluate;

        if (opts.verbose) {
          console.log(`  ${platformA} vs ${platformB}: evaluating ${pairsToEvaluate} pairs`);
        }

        const pairs = matchMarkets(marketsA, marketsB, opts.arbConfig);
        allValidatedPairs.push(...pairs);

        if (opts.verbose && pairs.length > 0) {
          const stats = getMatchingStats(pairs);
          console.log(`    Found ${pairs.length} validated pairs (avg equiv: ${(stats.avgEquivalence * 100).toFixed(1)}%)`);
        }
      }
    }

    result.pairsValidated = allValidatedPairs.length;

    if (allValidatedPairs.length > 0) {
      const stats = getMatchingStats(allValidatedPairs);
      result.avgEquivalenceScore = stats.avgEquivalence;
    }

    if (opts.verbose) {
      console.log(`\nTotal validated pairs: ${result.pairsValidated}`);
      console.log(`Average equivalence score: ${(result.avgEquivalenceScore * 100).toFixed(1)}%`);
    }

    // Step 3: Analyze for arbitrage
    if (opts.verbose) console.log('\nAnalyzing for arbitrage opportunities...');

    const allOpportunities = findArbitrageOpportunities(allValidatedPairs, opts.arbConfig);

    if (opts.verbose) {
      console.log(`  Found ${allOpportunities.length} potential opportunities`);
    }

    // Step 4: Apply filters
    const gradeOrder: ConfidenceGrade[] = ['A', 'B', 'C', 'D', 'F'];
    const minGradeIndex = gradeOrder.indexOf(opts.minConfidenceGrade);

    const filteredOpportunities = allOpportunities.filter(opp => {
      const gradeIndex = gradeOrder.indexOf(opp.confidence.grade);
      return gradeIndex <= minGradeIndex;
    });

    result.filteredCount = allOpportunities.length - filteredOpportunities.length;
    result.opportunities = filteredOpportunities.slice(0, opts.maxOpportunities);

    if (opts.verbose) {
      console.log(`  Filtered out ${result.filteredCount} low-confidence opportunities`);
      console.log(`  Final opportunities: ${result.opportunities.length}`);
    }

    // Step 5: Generate warnings for any issues
    if (result.totalMarkets < 20) {
      warnings.push(`Low market count (${result.totalMarkets}) - opportunities may be limited`);
    }

    if (result.pairsValidated === 0 && result.totalMarkets > 0) {
      warnings.push('No validated market pairs found - markets may be too different');
    }

    if (result.avgEquivalenceScore < 0.7 && result.pairsValidated > 0) {
      warnings.push(`Low average equivalence (${(result.avgEquivalenceScore * 100).toFixed(0)}%) - verify matches carefully`);
    }

    result.success = true;
    result.duration = Date.now() - startTime;

    if (opts.verbose) {
      console.log(`\nScan completed in ${result.duration}ms`);
    }

    return result;

  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error');
    result.duration = Date.now() - startTime;
    return result;
  }
}

// ============================================
// MARKET FETCHING
// ============================================

async function fetchAllMarkets(
  platforms: Platform[],
  query: string | undefined,
  maxPerPlatform: number
): Promise<Record<Platform, Market[]>> {
  const results: Record<Platform, Market[]> = {} as Record<Platform, Market[]>;

  // Fetch in parallel
  const fetchPromises = platforms.map(async (platform) => {
    try {
      const markets = await searchMarkets(query || '', [platform]);
      return { platform, markets: markets.slice(0, maxPerPlatform) };
    } catch (error) {
      console.error(`Error fetching ${platform}:`, error);
      return { platform, markets: [] };
    }
  });

  const fetchResults = await Promise.allSettled(fetchPromises);

  for (const result of fetchResults) {
    if (result.status === 'fulfilled') {
      results[result.value.platform] = result.value.markets;
    }
  }

  return results;
}

// ============================================
// OUTPUT FORMATTING
// ============================================

/**
 * Format scan result for display
 * ENHANCED: More actionable, cleaner output
 */
export function formatScanResult(result: ScanResult): string {
  const lines: string[] = [];

  // Compact header
  lines.push('🎯 ARBITRAGE SCANNER');
  lines.push('━'.repeat(45));

  // Compact stats
  const platforms = Object.entries(result.marketsScanned)
    .map(([p, c]) => `${p}: ${c}`)
    .join(' | ');
  lines.push(`📊 Scanned ${result.totalMarkets} markets (${platforms})`);
  lines.push(`🔍 Found ${result.pairsValidated} matching pairs`);
  lines.push('');

  // Opportunities
  if (result.opportunities.length === 0) {
    lines.push('━'.repeat(45));
    lines.push('❌ NO PROFITABLE ARBITRAGE RIGHT NOW');
    lines.push('━'.repeat(45));
    lines.push('');
    lines.push('Markets are efficiently priced at the moment.');
    lines.push('');
    lines.push('💡 Try:');
    lines.push('• /arb bitcoin - Search specific topic');
    lines.push('• /arb-subscribe - Get instant alerts when arbs appear');
    lines.push('• /hot - See trending markets');
    if (result.filteredCount > 0) {
      lines.push('');
      lines.push(`(${result.filteredCount} low-confidence matches filtered)`);
    }
  } else {
    // Calculate total potential profit
    const bestProfit = Math.max(...result.opportunities.map(o => o.netProfitPct * 100));

    lines.push('━'.repeat(45));
    lines.push(`🚨 FOUND ${result.opportunities.length} OPPORTUNITIES (up to ${bestProfit.toFixed(1)}% profit)`);
    lines.push('━'.repeat(45));
    lines.push('');

    for (let i = 0; i < result.opportunities.length; i++) {
      const opp = result.opportunities[i];
      lines.push(formatOpportunity(opp, i + 1));
      lines.push('');
      lines.push('─'.repeat(45));
      lines.push('');
    }
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push('─'.repeat(50));
    lines.push('WARNINGS');
    lines.push('─'.repeat(50));
    for (const warning of result.warnings) {
      lines.push(`⚠️ ${warning}`);
    }
    lines.push('');
  }

  // Errors
  if (result.errors.length > 0) {
    lines.push('─'.repeat(50));
    lines.push('ERRORS');
    lines.push('─'.repeat(50));
    for (const error of result.errors) {
      lines.push(`❌ ${error}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format a single opportunity for display
 * ENHANCED: Includes links, profit calculation, clear execution steps
 */
export function formatOpportunity(opp: ValidatedArbitrageOpportunity, index: number): string {
  const lines: string[] = [];

  const confidenceEmoji = {
    A: '🟢',
    B: '🟢',
    C: '🟡',
    D: '🟠',
    F: '🔴',
  };

  const marketA = opp.pair.marketA;
  const marketB = opp.pair.marketB;
  const leg1 = opp.strategy.legs[0];
  const leg2 = opp.strategy.legs[1];
  const netProfitPct = opp.netProfitPct * 100;

  // Calculate dollar profits for common position sizes
  const profit100 = (100 * opp.netProfitPct).toFixed(2);
  const profit500 = (500 * opp.netProfitPct).toFixed(2);
  const profit1000 = (1000 * opp.netProfitPct).toFixed(2);

  // Header with profit highlight
  lines.push(`🚨 ARB #${index} | ${netProfitPct.toFixed(1)}% PROFIT | Grade ${opp.confidence.grade} ${confidenceEmoji[opp.confidence.grade]}`);
  lines.push('━'.repeat(45));
  lines.push('');

  // Market title (shortened, same for both if equivalent)
  const title = marketA.title.length > 45 ? marketA.title.slice(0, 45) + '...' : marketA.title;
  lines.push(`📊 "${title}"`);
  lines.push('');

  // Price comparison with links
  lines.push('💰 PRICES:');
  const priceA = (marketA.yesPrice * 100).toFixed(0);
  const priceB = (marketB.yesPrice * 100).toFixed(0);
  lines.push(`├─ ${marketA.platform.toUpperCase()}: ${priceA}¢ YES`);
  if (marketA.url) {
    lines.push(`│  [${marketA.url}]`);
  }
  lines.push(`├─ ${marketB.platform.toUpperCase()}: ${priceB}¢ YES`);
  if (marketB.url) {
    lines.push(`│  [${marketB.url}]`);
  }
  lines.push('');

  // Clear execution steps
  lines.push('📋 EXECUTION STEPS:');
  lines.push(`Step 1: ${leg1.action.toUpperCase()} ${leg1.side} @ ${leg1.platform} at ${(leg1.targetPrice * 100).toFixed(0)}¢`);
  lines.push(`Step 2: ${leg2.action.toUpperCase()} ${leg2.side} @ ${leg2.platform} at ${(leg2.targetPrice * 100).toFixed(0)}¢`);
  lines.push('');

  // Profit calculation
  lines.push('💵 PROFIT CALCULATOR:');
  lines.push(`├─ $100 position → $${profit100} profit`);
  lines.push(`├─ $500 position → $${profit500} profit`);
  lines.push(`└─ $1000 position → $${profit1000} profit`);
  lines.push('');

  // Recommended size
  lines.push(`📏 Recommended: $${opp.execution.recommendedSize.toFixed(0)} (max: $${opp.execution.maxSize.toFixed(0)})`);
  lines.push('');

  // Risk & confidence (compact)
  const riskLevel = opp.risk.overallRiskScore < 30 ? '🟢 Low' : opp.risk.overallRiskScore < 60 ? '🟡 Medium' : '🔴 High';
  lines.push(`⚠️ Risk: ${riskLevel} | Match: ${(opp.pair.equivalence.overallScore * 100).toFixed(0)}%`);

  // Top warning if any
  if (opp.risk.flags.length > 0) {
    const topFlag = opp.risk.flags[0];
    lines.push(`   └─ ${topFlag.message}`);
  }
  lines.push('');

  // Urgency
  lines.push('⏰ Execute within 5-10 mins (prices move fast!)');

  return lines.join('\n');
}

// ============================================
// SIMPLE INTERFACE FOR EXISTING CODE
// ============================================

/**
 * Simple wrapper matching the old arbitrage() function interface
 * For backwards compatibility
 */
export async function scanSimple(query?: string): Promise<{
  opportunities: ValidatedArbitrageOpportunity[];
  summary: string;
}> {
  const result = await scanForArbitrage({
    query,
    verbose: false,
    minConfidenceGrade: 'C',
  });

  return {
    opportunities: result.opportunities,
    summary: formatScanResult(result),
  };
}
