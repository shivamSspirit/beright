/**
 * Signals Handler
 *
 * View trading signals from followed forecasters.
 *
 * @see docs/ADR-002-TELEGRAM-AS-GATEWAY.md
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import {
  getSignals as getFollowedSignals,
  getTopSignals,
  getFollowing,
} from '../../../skills/copyTrading';

// =============================================================================
// TYPES
// =============================================================================

export interface SignalPrediction {
  id: string;
  question: string;
  direction: 'YES' | 'NO';
  probability: number;
  outcome?: boolean;
  isResolved: boolean;
  wasCorrect?: boolean;
  createdAt: string;
}

export interface Signal {
  id: string;
  forecasterTelegramId: string;
  forecasterUsername?: string;
  forecasterGrade: string;
  prediction: SignalPrediction;
  createdAt: string;
}

export interface SignalsResult {
  timestamp: string;
  userId: string;
  source: 'followed' | 'top';
  signals: Signal[];
  followingCount: number;
  hasMore: boolean;
}

// =============================================================================
// HANDLER
// =============================================================================

export const signalsHandler: CommandHandler<SignalsResult> = {
  id: 'signals',
  skillsUsed: ['copyTrading', 'leaderboard'],

  async execute(context: CommandContext): Promise<CommandResult<SignalsResult>> {
    const startTime = Date.now();

    try {
      const userId = context.userId || context.gatewayContext?.chatId?.toString() || 'anonymous';
      const limit = context.arguments?.[0] ? parseInt(context.arguments[0]) : 10;

      // Check if user is following anyone
      const following = getFollowing(userId);

      let rawSignals;
      let source: 'followed' | 'top';

      if (following.length > 0) {
        // Get signals from followed users
        rawSignals = getFollowedSignals(userId, limit);
        source = 'followed';
      } else {
        // Get signals from top forecasters
        rawSignals = getTopSignals(limit);
        source = 'top';
      }

      // Transform signals to our format
      const signals: Signal[] = rawSignals.map(s => ({
        id: s.id,
        forecasterTelegramId: s.forecasterTelegramId,
        forecasterUsername: s.forecasterUsername,
        forecasterGrade: s.forecasterGrade,
        prediction: {
          id: s.prediction.id,
          question: s.prediction.question,
          direction: s.prediction.direction,
          probability: s.prediction.predictedProbability,
          outcome: s.prediction.outcome,
          isResolved: s.prediction.outcome !== undefined,
          wasCorrect: s.prediction.outcome !== undefined
            ? (s.prediction.direction === 'YES') === s.prediction.outcome
            : undefined,
          createdAt: s.prediction.createdAt,
        },
        createdAt: s.createdAt,
      }));

      const result: SignalsResult = {
        timestamp: new Date().toISOString(),
        userId,
        source,
        signals,
        followingCount: following.length,
        hasMore: rawSignals.length >= limit,
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'signals',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['copyTrading', 'leaderboard'],
          apiCallsMade: 0,
        },
        hints: {
          mood: signals.length > 0 ? 'BULLISH' : 'NEUTRAL',
          suggestedActions: source === 'top'
            ? ['/follow', '/leaderboard']
            : ['/predict', '/follow'],
        },
      };
    } catch (error) {
      console.error('[SignalsHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'SIGNALS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch signals',
          retryable: true,
        },
        meta: {
          handlerId: 'signals',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['copyTrading'],
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

registerHandler(signalsHandler);

export default signalsHandler;
