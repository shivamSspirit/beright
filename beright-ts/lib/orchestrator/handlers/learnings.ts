/**
 * Learnings Handler
 *
 * View accumulated learning insights from past predictions.
 *
 * @see docs/ADR-002-TELEGRAM-AS-GATEWAY.md
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import { generateLearnings, LearningPattern } from '../../../skills/learnings';

// =============================================================================
// TYPES
// =============================================================================

export interface PredictionSummary {
  id: string;
  question: string;
  direction: 'YES' | 'NO';
  probability: number;
  outcome: boolean;
  brierScore: number;
  wasCorrect: boolean;
}

export interface LessonSummary {
  predictionId: string;
  question: string;
  wasCorrect: boolean;
  brierScore: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'bad';
  lesson: string;
  category: 'overconfidence' | 'underconfidence' | 'wrong_direction' | 'calibration' | 'timing' | 'unknown';
}

export interface LearningsResult {
  timestamp: string;
  userId: string;
  analyzedPredictions: number;
  // Best/worst
  bestPredictions: PredictionSummary[];
  worstPredictions: PredictionSummary[];
  // Lessons
  recentLessons: LessonSummary[];
  // Patterns
  patterns: LearningPattern[];
  // Personal rules
  personalRules: string[];
  // Summary
  summary: {
    avgBrier: number;
    correctRate: number;
    overconfidenceFrequency: number;
    underconfidenceFrequency: number;
    biggestImprovement: string;
  };
}

// =============================================================================
// HANDLER
// =============================================================================

export const learningsHandler: CommandHandler<LearningsResult> = {
  id: 'learnings',
  skillsUsed: ['learnings', 'calibration'],

  async execute(context: CommandContext): Promise<CommandResult<LearningsResult>> {
    const startTime = Date.now();

    try {
      const userId = context.userId || context.gatewayContext?.chatId?.toString() || 'anonymous';
      const limit = context.arguments?.[0] ? parseInt(context.arguments[0]) : 50;

      // Generate learning report
      const report = await generateLearnings(userId, limit);

      if (!report) {
        return {
          success: false,
          error: {
            code: 'INSUFFICIENT_DATA',
            message: 'Not enough data yet. You need at least 5 resolved predictions to generate learning insights.',
            retryable: false,
            recoveryAction: 'Make more predictions with /predict',
          },
          meta: {
            handlerId: 'learnings',
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

      const result: LearningsResult = {
        timestamp: new Date().toISOString(),
        userId,
        analyzedPredictions: report.analyzedPredictions,
        bestPredictions: report.bestPredictions.map(p => ({
          id: p.id,
          question: p.question,
          direction: p.direction,
          probability: p.probability,
          outcome: p.outcome,
          brierScore: p.brierScore,
          wasCorrect: (p.direction === 'YES') === p.outcome,
        })),
        worstPredictions: report.worstPredictions.map(p => ({
          id: p.id,
          question: p.question,
          direction: p.direction,
          probability: p.probability,
          outcome: p.outcome,
          brierScore: p.brierScore,
          wasCorrect: (p.direction === 'YES') === p.outcome,
        })),
        recentLessons: report.lessons.slice(0, 10).map(l => ({
          predictionId: l.predictionId,
          question: l.question,
          wasCorrect: l.wasCorrect,
          brierScore: l.brierScore,
          quality: l.quality,
          lesson: l.lesson,
          category: l.category,
        })),
        patterns: report.patterns,
        personalRules: report.personalRules,
        summary: report.summary,
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'learnings',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['learnings', 'calibration'],
          apiCallsMade: 1,
        },
        hints: {
          mood: report.patterns.length > 0 ? 'EDUCATIONAL' : 'NEUTRAL',
          suggestedActions: ['/feedback', '/recommendations'],
        },
      };
    } catch (error) {
      console.error('[LearningsHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'LEARNINGS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to generate learnings',
          retryable: true,
        },
        meta: {
          handlerId: 'learnings',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['learnings'],
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

registerHandler(learningsHandler);

export default learningsHandler;
