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
 */
export function formatScanResult(result: ScanResult): string {
  const lines: string[] = [];

  lines.push('═'.repeat(50));
  lines.push('ARBITRAGE SCANNER RESULTS');
  lines.push('═'.repeat(50));
  lines.push('');

  // Stats
  lines.push(`Scan time: ${result.duration}ms`);
  lines.push(`Markets scanned: ${result.totalMarkets}`);
  for (const [platform, count] of Object.entries(result.marketsScanned)) {
    lines.push(`  ${platform}: ${count}`);
  }
  lines.push(`Pairs evaluated: ${result.pairsEvaluated}`);
  lines.push(`Pairs validated: ${result.pairsValidated} (${result.avgEquivalenceScore > 0 ? (result.avgEquivalenceScore * 100).toFixed(1) : 0}% avg equivalence)`);
  lines.push('');

  // Opportunities
  if (result.opportunities.length === 0) {
    lines.push('─'.repeat(50));
    lines.push('NO ARBITRAGE OPPORTUNITIES FOUND');
    lines.push('─'.repeat(50));
    lines.push('');
    lines.push('This is expected. True arbitrage opportunities are rare');
    lines.push('and get captured quickly by automated systems.');
    lines.push('');
    if (result.filteredCount > 0) {
      lines.push(`(${result.filteredCount} low-confidence opportunities were filtered out)`);
    }
  } else {
    lines.push('─'.repeat(50));
    lines.push(`FOUND ${result.opportunities.length} OPPORTUNITIES`);
    lines.push('─'.repeat(50));
    lines.push('');

    for (let i = 0; i < result.opportunities.length; i++) {
      const opp = result.opportunities[i];
      lines.push(formatOpportunity(opp, i + 1));
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

  lines.push(`#${index} | Grade ${opp.confidence.grade} ${confidenceEmoji[opp.confidence.grade]} | ${(opp.netProfitPct * 100).toFixed(2)}% net profit`);
  lines.push('');

  // Market titles
  const marketA = opp.pair.marketA;
  const marketB = opp.pair.marketB;

  lines.push(`Market A (${marketA.platform}): ${marketA.title.slice(0, 50)}`);
  lines.push(`Market B (${marketB.platform}): ${marketB.title.slice(0, 50)}`);
  lines.push('');

  // Strategy
  lines.push(`Strategy: ${opp.strategy.description}`);
  lines.push('');

  // Prices
  const leg1 = opp.strategy.legs[0];
  const leg2 = opp.strategy.legs[1];
  lines.push(`Leg 1: ${leg1.action} ${leg1.side} @ ${leg1.platform} at ${(leg1.targetPrice * 100).toFixed(1)}%`);
  lines.push(`Leg 2: ${leg2.action} ${leg2.side} @ ${leg2.platform} at ${(leg2.targetPrice * 100).toFixed(1)}%`);
  lines.push('');

  // Economics
  lines.push(`Gross profit: ${(opp.grossProfitPct * 100).toFixed(2)}%`);
  lines.push(`Total costs: ${(opp.totalCosts.costAsPctOfCapital * 100).toFixed(2)}%`);
  lines.push(`Net profit: ${(opp.netProfitPct * 100).toFixed(2)}%`);
  lines.push('');

  // Execution
  lines.push(`Recommended size: $${opp.execution.recommendedSize.toFixed(0)}`);
  lines.push(`Max size: $${opp.execution.maxSize.toFixed(0)}`);
  lines.push('');

  // Risk
  lines.push(`Risk score: ${opp.risk.overallRiskScore}/100`);
  if (opp.risk.flags.length > 0) {
    for (const flag of opp.risk.flags.slice(0, 3)) {
      const emoji = flag.severity === 'CRITICAL' ? '🔴' : flag.severity === 'WARNING' ? '🟡' : 'ℹ️';
      lines.push(`  ${emoji} ${flag.message}`);
    }
  }
  lines.push('');

  // Confidence
  lines.push(`Confidence: ${opp.confidence.score}% - ${opp.confidence.recommendation}`);
  lines.push('');

  // Equivalence
  lines.push(`Match confidence: ${(opp.pair.equivalence.overallScore * 100).toFixed(0)}%`);
  if (opp.pair.equivalence.warnings.length > 0) {
    for (const warning of opp.pair.equivalence.warnings.slice(0, 2)) {
      lines.push(`  ⚠️ ${warning}`);
    }
  }

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
