/**
 * Comparative Analysis Skill
 *
 * Compares user predictions against:
 * - Market consensus (current prices)
 * - Other forecasters' predictions
 * - Historical base rates
 *
 * Goal: Help users understand where they diverge from consensus
 *       and whether that divergence is justified
 */

import { SkillResponse } from '../types/index';
import { supabase, db } from '../lib/supabase/client';
import { getMarket, calculateBaseRate } from '../lib/dflow/api';

// Types
interface PredictionComparison {
  predictionId: string;
  question: string;
  userPrediction: {
    direction: 'YES' | 'NO';
    probability: number;
    createdAt: string;
  };
  marketConsensus?: {
    yesPrice: number;
    noPrice: number;
    fetchedAt: string;
  };
  baseRate?: {
    rate: number;
    sampleSize: number;
    confidence: 'low' | 'medium' | 'high';
  };
  divergence: {
    fromMarket?: number; // User prob - market prob
    fromBaseRate?: number; // User prob - base rate
    isContrarian: boolean;
    divergenceLevel: 'aligned' | 'slight' | 'moderate' | 'strong';
  };
  analysis: {
    summary: string;
    confidence: 'high' | 'medium' | 'low';
    suggestion?: string;
  };
}

interface ComparisonReport {
  userId: string;
  totalPending: number;
  comparisons: PredictionComparison[];
  summary: {
    alignedWithMarket: number;
    contrarianPredictions: number;
    avgDivergence: number;
    overallAssessment: string;
  };
}

/**
 * Calculate divergence level from a numeric divergence
 */
function getDivergenceLevel(divergence: number): 'aligned' | 'slight' | 'moderate' | 'strong' {
  const abs = Math.abs(divergence);
  if (abs < 0.05) return 'aligned';
  if (abs < 0.15) return 'slight';
  if (abs < 0.25) return 'moderate';
  return 'strong';
}

/**
 * Generate analysis for a single prediction comparison
 */
function analyzeComparison(comparison: Omit<PredictionComparison, 'analysis'>): PredictionComparison['analysis'] {
  const { userPrediction, marketConsensus, baseRate, divergence } = comparison;

  const parts: string[] = [];
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  let suggestion: string | undefined;

  // Compare to market
  if (marketConsensus) {
    const marketProb = userPrediction.direction === 'YES' ? marketConsensus.yesPrice : marketConsensus.noPrice;
    const userProb = userPrediction.probability;
    const diff = userProb - marketProb;

    if (Math.abs(diff) < 0.05) {
      parts.push('You agree with the market.');
    } else if (diff > 0) {
      parts.push(`You're ${(Math.abs(diff) * 100).toFixed(0)}% MORE confident than the market.`);
    } else {
      parts.push(`You're ${(Math.abs(diff) * 100).toFixed(0)}% LESS confident than the market.`);
    }
  }

  // Compare to base rate
  if (baseRate && baseRate.sampleSize >= 5) {
    const baseProb = userPrediction.direction === 'YES' ? baseRate.rate : 1 - baseRate.rate;
    const diff = userPrediction.probability - baseProb;

    if (Math.abs(diff) > 0.2) {
      parts.push(`Historical base rate suggests ${(baseProb * 100).toFixed(0)}%.`);
      if (baseRate.confidence === 'high') {
        suggestion = 'Consider whether you have information the base rate doesn\'t capture.';
        confidence = 'high';
      }
    }
  }

  // Contrarian analysis
  if (divergence.isContrarian) {
    if (divergence.divergenceLevel === 'strong') {
      parts.push('⚠️ Strong contrarian position. Make sure you have solid reasoning.');
      suggestion = suggestion || 'Contrarian positions need strong evidence to overcome market wisdom.';
    } else if (divergence.divergenceLevel === 'moderate') {
      parts.push('You\'re taking a moderately contrarian view.');
    }
  }

  // Default message if no specific analysis
  if (parts.length === 0) {
    parts.push('No strong divergence detected.');
  }

  return {
    summary: parts.join(' '),
    confidence,
    suggestion,
  };
}

/**
 * Compare a user's pending predictions against market consensus
 */
export async function compareUserPredictions(userId: string): Promise<ComparisonReport> {
  // Get user's pending predictions
  const predictions = await db.predictions.getByUser(userId);
  const pending = predictions.filter(p => p.resolved_at === null);

  const comparisons: PredictionComparison[] = [];
  let totalDivergence = 0;
  let contrarianCount = 0;
  let alignedCount = 0;

  for (const pred of pending.slice(0, 10)) { // Limit to 10 for performance
    const comparison: Omit<PredictionComparison, 'analysis'> = {
      predictionId: pred.id,
      question: pred.question,
      userPrediction: {
        direction: (pred.direction as 'YES' | 'NO') || 'YES',
        probability: pred.predicted_probability,
        createdAt: pred.created_at,
      },
      divergence: {
        isContrarian: false,
        divergenceLevel: 'aligned',
      },
    };

    // Try to get market data
    if (pred.market_id) {
      try {
        const marketResult = await getMarket(pred.market_id);
        if (marketResult.success && marketResult.data) {
          comparison.marketConsensus = {
            yesPrice: parseFloat(marketResult.data.yesBid || '0.5'),
            noPrice: parseFloat(marketResult.data.noBid || '0.5'),
            fetchedAt: new Date().toISOString(),
          };

          // Calculate divergence from market
          const marketProb = pred.direction === 'YES'
            ? comparison.marketConsensus.yesPrice
            : comparison.marketConsensus.noPrice;
          comparison.divergence.fromMarket = pred.predicted_probability - marketProb;
        }
      } catch (err) {
        console.warn(`[Comparison] Failed to get market ${pred.market_id}:`, err);
      }
    }

    // Try to get base rate
    try {
      const baseRateResult = await calculateBaseRate(pred.question);
      if (baseRateResult.sampleSize >= 3) {
        comparison.baseRate = {
          rate: baseRateResult.baseRate,
          sampleSize: baseRateResult.sampleSize,
          confidence: baseRateResult.sampleSize >= 10 ? 'high' : baseRateResult.sampleSize >= 5 ? 'medium' : 'low',
        };

        // Calculate divergence from base rate
        const baseProb = pred.direction === 'YES' ? baseRateResult.baseRate : 1 - baseRateResult.baseRate;
        comparison.divergence.fromBaseRate = pred.predicted_probability - baseProb;
      }
    } catch (err) {
      console.warn(`[Comparison] Failed to get base rate:`, err);
    }

    // Determine overall divergence
    const primaryDivergence = comparison.divergence.fromMarket ?? comparison.divergence.fromBaseRate ?? 0;
    comparison.divergence.divergenceLevel = getDivergenceLevel(primaryDivergence);
    comparison.divergence.isContrarian = Math.abs(primaryDivergence) > 0.15;

    // Track summary stats
    totalDivergence += Math.abs(primaryDivergence);
    if (comparison.divergence.isContrarian) contrarianCount++;
    if (comparison.divergence.divergenceLevel === 'aligned') alignedCount++;

    // Generate analysis
    const analysis = analyzeComparison(comparison);
    comparisons.push({ ...comparison, analysis });
  }

  // Generate overall assessment
  const avgDivergence = pending.length > 0 ? totalDivergence / Math.min(pending.length, 10) : 0;
  let overallAssessment = '';

  if (contrarianCount > pending.length * 0.5) {
    overallAssessment = 'You have many contrarian positions. Ensure each has strong reasoning.';
  } else if (alignedCount > pending.length * 0.8) {
    overallAssessment = 'Your predictions largely align with market consensus.';
  } else {
    overallAssessment = 'You have a healthy mix of consensus and independent views.';
  }

  return {
    userId,
    totalPending: pending.length,
    comparisons,
    summary: {
      alignedWithMarket: alignedCount,
      contrarianPredictions: contrarianCount,
      avgDivergence,
      overallAssessment,
    },
  };
}

/**
 * Format comparison report as markdown
 */
function formatComparisonReport(report: ComparisonReport): string {
  let text = `
📊 *PREDICTION COMPARISON REPORT*
${'═'.repeat(50)}

📈 *Summary*
Pending predictions: ${report.totalPending}
Aligned with market: ${report.summary.alignedWithMarket}
Contrarian positions: ${report.summary.contrarianPredictions}
Avg divergence: ${(report.summary.avgDivergence * 100).toFixed(1)}%

💬 ${report.summary.overallAssessment}

`;

  if (report.comparisons.length === 0) {
    text += `No pending predictions to compare.\n\nMake predictions with /predict to see comparisons.`;
    return text;
  }

  text += `📋 *YOUR PREDICTIONS VS MARKET*
${'─'.repeat(40)}

`;

  for (const comp of report.comparisons) {
    const divergenceEmoji =
      comp.divergence.divergenceLevel === 'aligned' ? '✅' :
      comp.divergence.divergenceLevel === 'slight' ? '🔹' :
      comp.divergence.divergenceLevel === 'moderate' ? '🔶' : '⚠️';

    text += `${divergenceEmoji} *${comp.question.slice(0, 40)}*${comp.question.length > 40 ? '...' : ''}
`;

    text += `   You: ${comp.userPrediction.direction} @ ${(comp.userPrediction.probability * 100).toFixed(0)}%
`;

    if (comp.marketConsensus) {
      const marketProb = comp.userPrediction.direction === 'YES'
        ? comp.marketConsensus.yesPrice
        : comp.marketConsensus.noPrice;
      text += `   Market: ${(marketProb * 100).toFixed(0)}%
`;
    }

    if (comp.baseRate && comp.baseRate.sampleSize >= 5) {
      const baseProb = comp.userPrediction.direction === 'YES'
        ? comp.baseRate.rate
        : 1 - comp.baseRate.rate;
      text += `   Base rate: ${(baseProb * 100).toFixed(0)}% (n=${comp.baseRate.sampleSize})
`;
    }

    text += `   ${comp.analysis.summary}
`;

    if (comp.analysis.suggestion) {
      text += `   💡 ${comp.analysis.suggestion}
`;
    }

    text += '\n';
  }

  return text;
}

/**
 * Main skill function
 */
export async function compare(userId: string): Promise<SkillResponse> {
  try {
    const report = await compareUserPredictions(userId);
    const text = formatComparisonReport(report);

    return {
      text,
      mood: report.summary.contrarianPredictions > report.comparisons.length * 0.5 ? 'ALERT' : 'NEUTRAL',
      data: report,
    };
  } catch (error) {
    console.error('[Comparison] Error:', error);
    return {
      text: `❌ Comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

// CLI interface
if (require.main === module) {
  const userId = process.argv[2];

  if (!userId) {
    console.log('Usage: npx ts-node comparison.ts <userId>');
    process.exit(1);
  }

  compare(userId).then(result => {
    console.log(result.text);
  }).catch(console.error);
}

export { getDivergenceLevel };
