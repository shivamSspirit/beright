/**
 * AI Analyst Module
 *
 * Superforecaster-style analysis for prediction markets.
 * Implements Philip Tetlock's methodology with transparent reasoning.
 *
 * @author BeRight Protocol
 * @version 3.0.0 - Bloomberg Terminal Architecture
 */

// =============================================================================
// RE-EXPORTS
// =============================================================================

// Types
export * from './types';

// Base rates (outside view)
export {
  estimateBaseRate,
  getKnownBaseRate,
  listReferenceClasses,
} from './baserates';

// Evidence (inside view)
export {
  gatherEvidence,
  quickEvidence,
} from './evidence';

// Superforecaster (main analysis)
export {
  analyze,
  quickTake,
  batchAnalyze,
} from './superforecaster';

// Calibration
export {
  recordPrediction,
  recordResolution,
  analyzeCalibration,
  suggestAdjustment,
  getPredictionsForMarket,
  getUnresolvedPredictions,
  getResolvedPredictions,
} from './calibration';

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

import { analyze, quickTake, batchAnalyze } from './superforecaster';
import { analyzeCalibration, recordPrediction } from './calibration';
import { UnifiedMarket } from '../dataFabric/types';
import { AnalystOutput, QuickTake } from './types';

/**
 * Analyst singleton for convenient access
 */
class Analyst {
  /**
   * Full analysis of a market
   */
  async analyze(
    market: UnifiedMarket,
    options?: {
      includeNews?: boolean;
      userContext?: string;
      priorBelief?: number;
    }
  ): Promise<AnalystOutput> {
    const result = await analyze(market, options);

    // Record for calibration
    recordPrediction({
      analysisId: `${market.id}-${Date.now()}`,
      marketId: market.id,
      question: market.question,
      predictedProbability: result.prediction.probability,
      predictedAt: new Date(),
      marketPriceAtPrediction: result.prediction.marketPrice,
      analysisDepth: 'standard',
      confidence: result.prediction.confidence,
    });

    return result;
  }

  /**
   * Quick take on a market
   */
  async quickTake(market: UnifiedMarket): Promise<QuickTake> {
    const result = await quickTake(market);

    // Record for calibration
    recordPrediction({
      analysisId: `${market.id}-quick-${Date.now()}`,
      marketId: market.id,
      question: market.question,
      predictedProbability: result.probability,
      predictedAt: new Date(),
      marketPriceAtPrediction: result.marketPrice,
      analysisDepth: 'quick',
      confidence: result.confidence,
    });

    return result;
  }

  /**
   * Batch analysis of multiple markets
   */
  async batchAnalyze(
    markets: UnifiedMarket[],
    options?: {
      depth?: 'quick' | 'standard';
      maxConcurrent?: number;
    }
  ): Promise<(AnalystOutput | QuickTake)[]> {
    return batchAnalyze(markets, options);
  }

  /**
   * Get calibration stats
   */
  getCalibrationStats() {
    return analyzeCalibration();
  }
}

// Export singleton
export const analyst = new Analyst();

// =============================================================================
// SUMMARY FORMATTERS
// =============================================================================

/**
 * Format analysis output for display
 */
export function formatAnalysisForDisplay(output: AnalystOutput): string {
  const lines: string[] = [];

  // Header
  lines.push(`📊 **Analysis: ${output.market.question}**`);
  lines.push('');

  // Prediction
  const prob = (output.prediction.probability * 100).toFixed(0);
  const market = (output.prediction.marketPrice * 100).toFixed(0);
  const edge = output.prediction.edge > 0 ? '+' : '';
  lines.push(`**Probability:** ${prob}% (Market: ${market}%)`);
  lines.push(`**Edge:** ${edge}${(output.prediction.edge * 100).toFixed(1)}%`);
  lines.push(`**Direction:** ${output.prediction.direction} (${output.prediction.confidence} confidence)`);
  lines.push('');

  // Recommendation
  lines.push(`**Recommendation:** ${output.recommendation.action}`);
  if (output.recommendation.direction) {
    lines.push(`**Trade:** ${output.recommendation.direction} @ ${(output.recommendation.entryPrice! * 100).toFixed(0)}¢`);
    lines.push(`**Size:** ${output.recommendation.suggestedSize}`);
  }
  lines.push('');

  // Key reasoning
  lines.push('**Outside View:**');
  lines.push(`- Base rate: ${(output.reasoning.outsideView.baseRate * 100).toFixed(0)}% (${output.reasoning.outsideView.referenceClass})`);
  lines.push('');

  lines.push('**Inside View:**');
  if (output.reasoning.insideView.bullishFactors.length > 0) {
    lines.push(`- Bullish: ${output.reasoning.insideView.bullishFactors[0].factor}`);
  }
  if (output.reasoning.insideView.bearishFactors.length > 0) {
    lines.push(`- Bearish: ${output.reasoning.insideView.bearishFactors[0].factor}`);
  }
  lines.push('');

  // Synthesis
  lines.push(`**Synthesis:** ${output.reasoning.synthesis.synthesisReasoning}`);
  lines.push('');

  // Warnings
  if (output.recommendation.warnings.length > 0) {
    lines.push('**Warnings:**');
    for (const warning of output.recommendation.warnings) {
      lines.push(`⚠️ ${warning}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format quick take for display
 */
export function formatQuickTakeForDisplay(take: QuickTake): string {
  const prob = (take.probability * 100).toFixed(0);
  const market = (take.marketPrice * 100).toFixed(0);
  const edge = take.edge > 0 ? '+' : '';

  const actionEmoji = {
    'BUY_YES': '🟢',
    'BUY_NO': '🔴',
    'HOLD': '🟡',
    'SKIP': '⚪',
  };

  return [
    `${actionEmoji[take.action]} **${take.action}** - ${take.market.question.slice(0, 50)}...`,
    `   ${prob}% (mkt: ${market}%) | Edge: ${edge}${(take.edge * 100).toFixed(1)}%`,
    `   ${take.oneLiner}`,
  ].join('\n');
}

/**
 * Format multiple quick takes as a table
 */
export function formatQuickTakesTable(takes: QuickTake[]): string {
  const lines: string[] = [];

  lines.push('| Market | Our Est. | Market | Edge | Action |');
  lines.push('|--------|----------|--------|------|--------|');

  for (const take of takes) {
    const question = take.market.question.slice(0, 30) + (take.market.question.length > 30 ? '...' : '');
    const prob = (take.probability * 100).toFixed(0) + '%';
    const market = (take.marketPrice * 100).toFixed(0) + '%';
    const edge = (take.edge > 0 ? '+' : '') + (take.edge * 100).toFixed(1) + '%';

    lines.push(`| ${question} | ${prob} | ${market} | ${edge} | ${take.action} |`);
  }

  return lines.join('\n');
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default analyst;
