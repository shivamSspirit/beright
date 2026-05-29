/**
 * P&L Handler
 *
 * View profit and loss report for different time periods.
 *
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import {
  getPnlReport,
  getPortfolioSummary,
} from '../../../skills/positions';

// =============================================================================
// TYPES
// =============================================================================

export interface PnlResult {
  timestamp: string;
  period: string;
  days: number;
  trades: number;
  volume: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  byPlatform: Record<string, number>;
  allTime: {
    totalPnL: number;
    winRate: number;
    totalTrades: number;
  };
}

// =============================================================================
// HANDLER
// =============================================================================

export const pnlHandler: CommandHandler<PnlResult> = {
  id: 'pnl',
  skillsUsed: ['positions'],

  async execute(context: CommandContext): Promise<CommandResult<PnlResult>> {
    const startTime = Date.now();

    try {
      // Get user ID from context
      const telegramId = context.userId || context.gatewayContext?.chatId?.toString() || 'anonymous';

      // Parse days from arguments (default 7)
      const daysArg = context.arguments?.[0];
      const days = daysArg ? parseInt(daysArg) : 7;

      if (isNaN(days) || days < 1 || days > 365) {
        return {
          success: false,
          error: {
            code: 'INVALID_PERIOD',
            message: 'Please specify days between 1 and 365. Usage: /pnl [days]',
            retryable: false,
          },
          meta: {
            handlerId: 'pnl',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: [],
            apiCallsMade: 0,
          },
          hints: {
            mood: 'NEUTRAL',
            suggestedActions: ['/pnl 7', '/pnl 30'],
          },
        };
      }

      // Get P&L report
      const report = getPnlReport(telegramId, days);
      const allTimeReport = getPnlReport(telegramId, 365);
      const summary = getPortfolioSummary(telegramId);

      const result: PnlResult = {
        timestamp: new Date().toISOString(),
        period: `${days}d`,
        days,
        trades: report.trades,
        volume: report.volume,
        realizedPnL: report.realizedPnl,
        unrealizedPnL: report.unrealizedPnl,
        totalPnL: report.totalPnl,
        byPlatform: report.byCategory,
        allTime: {
          totalPnL: allTimeReport.totalPnl,
          winRate: summary.winRate,
          totalTrades: allTimeReport.trades,
        },
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'pnl',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['positions'],
          apiCallsMade: 1,
        },
        hints: {
          mood: report.totalPnl >= 0 ? 'BULLISH' : 'BEARISH',
          suggestedActions: ['/portfolio', '/calibration'],
        },
      };
    } catch (error) {
      console.error('[PnlHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'PNL_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch P&L report',
          retryable: true,
          recoveryAction: 'Try again in a moment',
        },
        meta: {
          handlerId: 'pnl',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['positions'],
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

registerHandler(pnlHandler);

export default pnlHandler;
