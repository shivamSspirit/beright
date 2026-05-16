/**
 * Production-Grade Arbitrage Detection System
 *
 * This module provides institutional-grade arbitrage detection
 * across prediction markets with:
 *
 * - Multi-stage market equivalence validation
 * - Named entity extraction and comparison
 * - Proper arbitrage math (cross-platform spread, not buy-sell)
 * - Fee-adjusted profit calculations
 * - Slippage and liquidity estimation
 * - Risk scoring and controls
 * - Execution planning
 * - Confidence grading
 *
 * Usage:
 *   import { scanForArbitrage, formatScanResult } from '../lib/arbitrage';
 *
 *   const result = await scanForArbitrage({ verbose: true });
 *   console.log(formatScanResult(result));
 */

// Types
export * from './types';

// Market Matching Pipeline
export {
  extractMetadata,
  passesHardFilters,
  calculateEquivalence,
  matchMarkets,
  getMatchingStats,
} from './marketMatcher';

// Arbitrage Calculator
export {
  analyzeArbitrage,
  findArbitrageOpportunities,
} from './calculator';

// Main Scanner
export {
  scanForArbitrage,
  formatScanResult,
  formatOpportunity,
  scanSimple,
  type ScannerOptions,
  type ScanResult,
} from './scanner';
