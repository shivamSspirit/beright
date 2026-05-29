/**
 * Kalshi Balance Handler
 *
 * View Kalshi account balance and portfolio summary.
 *
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import {
  getKalshiPortfolioSummary,
  isKalshiConfigured,
  isKalshiDemo,
  KalshiPortfolioSummary,
} from '../../kalshi';

// =============================================================================
// TYPES
// =============================================================================

export interface KalshiBalanceResult {
  balance: {
    total: number;      // In dollars
    available: number;
    inPositions: number;
    pendingSettlement: number;
  };
  positions: {
    open: number;
    totalValue: number;
  };
  orders: {
    resting: number;
    pendingValue: number;
  };
  history: {
    totalTrades: number;
    realizedPnL: number;
    winRate: number;
  };
  isDemo: boolean;
  timestamp: string;
}

// =============================================================================
// HANDLER
// =============================================================================

export const kalshiBalanceHandler: CommandHandler<KalshiBalanceResult> = {
  id: 'kalshiBalance',
  skillsUsed: ['kalshi'],

  async execute(context: CommandContext): Promise<CommandResult<KalshiBalanceResult>> {
    const startTime = Date.now();

    try {
      if (!isKalshiConfigured()) {
        return {
          success: false,
          error: {
            code: 'KALSHI_NOT_CONFIGURED',
            message: 'Kalshi trading is not configured. Please set KALSHI_API_KEY and KALSHI_API_SECRET.',
            retryable: false,
          },
          meta: {
            handlerId: 'kalshiBalance',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: [],
            apiCallsMade: 0,
          },
          hints: {
            mood: 'NEUTRAL',
            suggestedActions: ['/kalshi'],
          },
        };
      }

      const summary = await getKalshiPortfolioSummary();

      if (!summary) {
        return {
          success: false,
          error: {
            code: 'BALANCE_FETCH_FAILED',
            message: 'Failed to fetch balance',
            retryable: true,
            recoveryAction: 'Try again in a moment',
          },
          meta: {
            handlerId: 'kalshiBalance',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: ['kalshi'],
            apiCallsMade: 1,
          },
          hints: {
            mood: 'ERROR',
          },
        };
      }

      const result: KalshiBalanceResult = {
        balance: {
          total: summary.balance.total,
          available: summary.balance.available,
          inPositions: summary.balance.inPositions,
          pendingSettlement: summary.balance.pendingSettlement,
        },
        positions: {
          open: summary.positions.open,
          totalValue: summary.positions.total_value,
        },
        orders: {
          resting: summary.orders.resting,
          pendingValue: summary.orders.pending_value,
        },
        history: {
          totalTrades: summary.history.total_trades,
          realizedPnL: summary.history.realized_pnl,
          winRate: summary.history.win_rate,
        },
        isDemo: summary.isDemo,
        timestamp: new Date().toISOString(),
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'kalshiBalance',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['kalshi'],
          apiCallsMade: 5,
        },
        hints: {
          mood: result.balance.available > 0 ? 'NEUTRAL' : 'ALERT',
          suggestedActions: ['/kalshi positions', '/kalshi markets'],
        },
      };
    } catch (error) {
      console.error('[KalshiBalanceHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'KALSHI_BALANCE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch balance',
          retryable: true,
          recoveryAction: 'Try again in a moment',
        },
        meta: {
          handlerId: 'kalshiBalance',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['kalshi'],
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

registerHandler(kalshiBalanceHandler);

export default kalshiBalanceHandler;
