/**
 * Calibration Handler
 *
 * View prediction calibration stats, Brier scores, and accuracy.
 *
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import { getCalibrationStats } from '../../../skills/calibration';

// =============================================================================
// TYPES
// =============================================================================

export interface CalibrationBucket {
  range: string;
  predictions: number;
  actualRate: number;
  expectedRate: number;
  calibrationError: number;
}

export interface PlatformStats {
  predictions: number;
  brierScore: number;
  accuracy: number;
}

export interface CalibrationResult {
  timestamp: string;
  totalPredictions: number;
  resolvedPredictions: number;
  pendingPredictions: number;
  overallBrierScore: number;
  accuracy: number;
  grade: {
    letter: string;
    emoji: string;
    title: string;
  };
  calibrationByBucket: CalibrationBucket[];
  performanceByPlatform: Record<string, PlatformStats>;
  streak: {
    current: number;
    type: 'win' | 'loss' | 'none';
    best: number;
  };
  benchmarks: {
    superforecasterElite: number;
    superforecaster: number;
    veryGood: number;
    aboveAverage: number;
    random: number;
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function getGrade(brierScore: number): { letter: string; emoji: string; title: string } {
  if (brierScore < 0.1) return { letter: 'S', emoji: '🏆', title: 'Superforecaster Elite' };
  if (brierScore < 0.15) return { letter: 'A', emoji: '⭐', title: 'Superforecaster' };
  if (brierScore < 0.2) return { letter: 'B', emoji: '✨', title: 'Very Good' };
  if (brierScore < 0.25) return { letter: 'C', emoji: '👍', title: 'Above Average' };
  if (brierScore < 0.3) return { letter: 'D', emoji: '📊', title: 'Average' };
  return { letter: 'F', emoji: '📉', title: 'Needs Improvement' };
}

// =============================================================================
// HANDLER
// =============================================================================

export const calibrationHandler: CommandHandler<CalibrationResult> = {
  id: 'calibration',
  skillsUsed: ['calibration'],

  async execute(context: CommandContext): Promise<CommandResult<CalibrationResult>> {
    const startTime = Date.now();

    try {
      // Get calibration stats
      const stats = getCalibrationStats();

      // Calculate grade
      const grade = stats.resolvedPredictions >= 5
        ? getGrade(stats.overallBrierScore)
        : { letter: '-', emoji: '🆕', title: 'New Forecaster (need 5+ resolved)' };

      const result: CalibrationResult = {
        timestamp: new Date().toISOString(),
        totalPredictions: stats.totalPredictions,
        resolvedPredictions: stats.resolvedPredictions,
        pendingPredictions: stats.pendingPredictions,
        overallBrierScore: stats.overallBrierScore,
        accuracy: stats.accuracy,
        grade,
        calibrationByBucket: stats.calibrationByBucket,
        performanceByPlatform: stats.performanceByPlatform,
        streak: stats.streak,
        benchmarks: {
          superforecasterElite: 0.1,
          superforecaster: 0.15,
          veryGood: 0.2,
          aboveAverage: 0.25,
          random: 0.25,
        },
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'calibration',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['calibration'],
          apiCallsMade: 0,
        },
        hints: {
          mood: stats.overallBrierScore < 0.2 ? 'BULLISH' : 'EDUCATIONAL',
          suggestedActions: ['/me', '/compare', '/leaderboard'],
        },
      };
    } catch (error) {
      console.error('[CalibrationHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'CALIBRATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch calibration stats',
          retryable: true,
          recoveryAction: 'Try again in a moment',
        },
        meta: {
          handlerId: 'calibration',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['calibration'],
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

registerHandler(calibrationHandler);

export default calibrationHandler;
