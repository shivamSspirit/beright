/**
 * Me Handler
 *
 * View user profile with stats, achievements, and history.
 *
 * @see docs/ADR-002-TELEGRAM-AS-GATEWAY.md
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import { getPortfolioSummary } from '../../../skills/positions';
import { getCalibrationStats } from '../../../skills/calibration';

// =============================================================================
// TYPES
// =============================================================================

export interface MeResult {
  timestamp: string;
  userId: string;
  username?: string;
  memberSince?: string;
  predictions: {
    total: number;
    resolved: number;
    pending: number;
    accuracy: number;
    brierScore: number;
  };
  trading: {
    totalPositions: number;
    openPositions: number;
    totalPnL: number;
    winRate: number;
  };
  streak: {
    current: number;
    type: 'win' | 'loss' | 'none';
    best: number;
  };
  grade: {
    letter: string;
    emoji: string;
    title: string;
  };
  achievements: string[];
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

function getAchievements(
  calibration: ReturnType<typeof getCalibrationStats>,
  portfolio: ReturnType<typeof getPortfolioSummary>
): string[] {
  const achievements: string[] = [];

  // Prediction achievements
  if (calibration.totalPredictions >= 100) {
    achievements.push('🎯 Century Club (100+ predictions)');
  } else if (calibration.totalPredictions >= 50) {
    achievements.push('🎯 Active Forecaster (50+ predictions)');
  } else if (calibration.totalPredictions >= 10) {
    achievements.push('🎯 Getting Started (10+ predictions)');
  }

  // Calibration achievements
  if (calibration.overallBrierScore < 0.15 && calibration.resolvedPredictions >= 20) {
    achievements.push('🏆 Superforecaster');
  }
  if (calibration.overallBrierScore < 0.2 && calibration.resolvedPredictions >= 10) {
    achievements.push('✨ Well Calibrated');
  }

  // Accuracy achievements
  if (calibration.accuracy >= 0.8 && calibration.resolvedPredictions >= 10) {
    achievements.push('🎯 Sharp Shooter (80%+ accuracy)');
  }
  if (calibration.accuracy >= 0.7 && calibration.resolvedPredictions >= 10) {
    achievements.push('📊 Consistent Caller (70%+ accuracy)');
  }

  // Streak achievements
  if (calibration.streak.current >= 10 && calibration.streak.type === 'win') {
    achievements.push('🔥 On Fire (10+ win streak)');
  } else if (calibration.streak.current >= 5 && calibration.streak.type === 'win') {
    achievements.push('🔥 Hot Streak (5+ wins)');
  }

  // Trading achievements
  if (portfolio.totalPnl > 1000) {
    achievements.push('💰 Big Winner ($1000+ profit)');
  } else if (portfolio.totalPnl > 100) {
    achievements.push('💵 In the Green ($100+ profit)');
  }

  if (portfolio.winRate >= 0.7 && portfolio.totalPositions >= 10) {
    achievements.push('📈 Trading Pro (70%+ win rate)');
  }

  return achievements;
}

// =============================================================================
// HANDLER
// =============================================================================

export const meHandler: CommandHandler<MeResult> = {
  id: 'me',
  skillsUsed: ['calibration', 'positions'],

  async execute(context: CommandContext): Promise<CommandResult<MeResult>> {
    const startTime = Date.now();

    try {
      // Get user ID from context
      const telegramId = context.userId || context.gatewayContext?.chatId?.toString() || 'anonymous';

      // Get calibration stats
      const calibration = getCalibrationStats();
      const portfolio = getPortfolioSummary(telegramId);

      // Calculate grade
      const grade = calibration.resolvedPredictions >= 5
        ? getGrade(calibration.overallBrierScore)
        : { letter: '-', emoji: '🆕', title: 'New Forecaster' };

      // Get achievements
      const achievements = getAchievements(calibration, portfolio);

      const result: MeResult = {
        timestamp: new Date().toISOString(),
        userId: telegramId,
        predictions: {
          total: calibration.totalPredictions,
          resolved: calibration.resolvedPredictions,
          pending: calibration.pendingPredictions,
          accuracy: calibration.accuracy,
          brierScore: calibration.overallBrierScore,
        },
        trading: {
          totalPositions: portfolio.totalPositions,
          openPositions: portfolio.openPositions,
          totalPnL: portfolio.totalPnl,
          winRate: portfolio.winRate,
        },
        streak: {
          current: calibration.streak.current,
          type: calibration.streak.type,
          best: calibration.streak.best,
        },
        grade,
        achievements,
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'me',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['calibration', 'positions'],
          apiCallsMade: 0,
        },
        hints: {
          mood: calibration.overallBrierScore < 0.2 ? 'BULLISH' : 'NEUTRAL',
          suggestedActions: ['/calibration', '/portfolio', '/leaderboard'],
        },
      };
    } catch (error) {
      console.error('[MeHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'ME_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch profile',
          retryable: true,
          recoveryAction: 'Try again in a moment',
        },
        meta: {
          handlerId: 'me',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['calibration', 'positions'],
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

registerHandler(meHandler);

export default meHandler;
