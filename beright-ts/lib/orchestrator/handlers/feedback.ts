/**
 * Feedback Handler
 *
 * Get detailed calibration feedback with patterns, trends, and recommendations.
 *
 * @see docs/ADR-002-TELEGRAM-AS-GATEWAY.md
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import { generateFeedback } from '../../../skills/feedback';

// =============================================================================
// TYPES
// =============================================================================

export interface CalibrationBucket {
  range: string;
  count: number;
  expectedRate: number;
  actualRate: number;
  calibrationError: number;
}

export interface PerformanceTrend {
  period: string;
  avgBrier: number;
  count: number;
  direction: 'improving' | 'stable' | 'declining';
}

export interface FeedbackResult {
  timestamp: string;
  userId: string;
  // Overview
  totalPredictions: number;
  resolvedPredictions: number;
  avgBrierScore: number;
  tier: string;
  calibrationGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  // Calibration
  calibrationBuckets: CalibrationBucket[];
  overconfidenceScore: number;
  isOverconfident: boolean;
  isUnderconfident: boolean;
  // Trends
  trends: PerformanceTrend[];
  isImproving: boolean;
  // Patterns
  strongAreas: string[];
  weakAreas: string[];
  biasPatterns: string[];
  // Recommendations
  recommendations: string[];
  nextSteps: string[];
  // Achievements
  achievements: string[];
  streak?: {
    type: 'win' | 'loss';
    count: number;
  };
}

// =============================================================================
// HANDLER
// =============================================================================

export const feedbackHandler: CommandHandler<FeedbackResult> = {
  id: 'feedback',
  skillsUsed: ['feedback', 'calibration'],

  async execute(context: CommandContext): Promise<CommandResult<FeedbackResult>> {
    const startTime = Date.now();

    try {
      const userId = context.chatId?.toString() || 'anonymous';

      // Generate feedback report
      const report = await generateFeedback(userId);

      if (!report) {
        return {
          success: false,
          error: {
            code: 'INSUFFICIENT_DATA',
            message: 'Not enough data yet. Make at least 5 predictions that have resolved to get feedback.',
            retryable: false,
            recoveryAction: 'Make more predictions with /predict',
          },
          meta: {
            handlerId: 'feedback',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: [],
            apiCallsMade: 1,
          },
          hints: {
            mood: 'NEUTRAL',
            suggestedActions: ['/predict', '/hot'],
          },
        };
      }

      const result: FeedbackResult = {
        timestamp: new Date().toISOString(),
        userId,
        totalPredictions: report.totalPredictions,
        resolvedPredictions: report.resolvedPredictions,
        avgBrierScore: report.avgBrierScore,
        tier: report.tier,
        calibrationGrade: report.calibrationGrade,
        calibrationBuckets: report.calibrationBuckets,
        overconfidenceScore: report.overconfidenceScore,
        isOverconfident: report.overconfidenceScore > 0.1,
        isUnderconfident: report.overconfidenceScore < -0.1,
        trends: report.trends,
        isImproving: report.isImproving,
        strongAreas: report.strongAreas,
        weakAreas: report.weakAreas,
        biasPatterns: report.biasPatterns,
        recommendations: report.recommendations,
        nextSteps: report.nextSteps,
        achievements: report.achievements,
        streak: report.streakInfo,
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'feedback',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['feedback', 'calibration'],
          apiCallsMade: 1,
        },
        hints: {
          mood: report.isImproving ? 'BULLISH' : 'EDUCATIONAL',
          suggestedActions: ['/learnings', '/recommendations'],
        },
      };
    } catch (error) {
      console.error('[FeedbackHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'FEEDBACK_FAILED',
          message: error instanceof Error ? error.message : 'Failed to generate feedback',
          retryable: true,
        },
        meta: {
          handlerId: 'feedback',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['feedback'],
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

registerHandler(feedbackHandler);

export default feedbackHandler;
