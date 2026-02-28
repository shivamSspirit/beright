/**
 * Compare Handler
 *
 * Compare user predictions against market consensus and base rates.
 *
 * @see docs/ADR-002-TELEGRAM-AS-GATEWAY.md
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import { compareUserPredictions } from '../../../skills/comparison';

// =============================================================================
// TYPES
// =============================================================================

export interface PredictionComparison {
  predictionId: string;
  question: string;
  userDirection: 'YES' | 'NO';
  userProbability: number;
  marketProbability?: number;
  baseRate?: number;
  baseRateSampleSize?: number;
  divergenceFromMarket?: number;
  divergenceFromBaseRate?: number;
  divergenceLevel: 'aligned' | 'slight' | 'moderate' | 'strong';
  isContrarian: boolean;
  analysis: string;
  suggestion?: string;
}

export interface CompareResult {
  timestamp: string;
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

// =============================================================================
// HANDLER
// =============================================================================

export const compareHandler: CommandHandler<CompareResult> = {
  id: 'compare',
  skillsUsed: ['comparison', 'dflow'],

  async execute(context: CommandContext): Promise<CommandResult<CompareResult>> {
    const startTime = Date.now();

    try {
      // Get user ID from context
      const userId = context.chatId?.toString() || 'anonymous';

      // Get comparison report
      const report = await compareUserPredictions(userId);

      // Map to response format
      const comparisons: PredictionComparison[] = report.comparisons.map(comp => ({
        predictionId: comp.predictionId,
        question: comp.question,
        userDirection: comp.userPrediction.direction,
        userProbability: comp.userPrediction.probability,
        marketProbability: comp.marketConsensus?.yesPrice,
        baseRate: comp.baseRate?.rate,
        baseRateSampleSize: comp.baseRate?.sampleSize,
        divergenceFromMarket: comp.divergence.fromMarket,
        divergenceFromBaseRate: comp.divergence.fromBaseRate,
        divergenceLevel: comp.divergence.divergenceLevel,
        isContrarian: comp.divergence.isContrarian,
        analysis: comp.analysis.summary,
        suggestion: comp.analysis.suggestion,
      }));

      const result: CompareResult = {
        timestamp: new Date().toISOString(),
        userId,
        totalPending: report.totalPending,
        comparisons,
        summary: {
          alignedWithMarket: report.summary.alignedWithMarket,
          contrarianPredictions: report.summary.contrarianPredictions,
          avgDivergence: report.summary.avgDivergence,
          overallAssessment: report.summary.overallAssessment,
        },
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'compare',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['comparison', 'dflow'],
          apiCallsMade: comparisons.length * 2,
        },
        hints: {
          mood: report.summary.contrarianPredictions > comparisons.length * 0.5 ? 'ALERT' : 'NEUTRAL',
          suggestedActions: ['/calibration', '/me'],
        },
      };
    } catch (error) {
      console.error('[CompareHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'COMPARE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to compare predictions',
          retryable: true,
          recoveryAction: 'Try again in a moment',
        },
        meta: {
          handlerId: 'compare',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['comparison'],
          apiCallsMade: 0,
        },
        hints: {
          mood: 'ERROR',
        },
      };
    }
  },
};

// =============================================================================
// AUTO-REGISTER
// =============================================================================

registerHandler(compareHandler);

export default compareHandler;
