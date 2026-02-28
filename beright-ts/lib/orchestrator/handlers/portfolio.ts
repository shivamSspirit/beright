/**
 * Portfolio Handler
 *
 * View comprehensive portfolio with positions, P&L, and allocation.
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
  getUserPositions,
  getPortfolioSummary,
  refreshPositionPrices,
  Position,
  PortfolioSummary,
} from '../../../skills/positions';

// =============================================================================
// TYPES
// =============================================================================

export interface PortfolioPositionData {
  id: string;
  marketTitle: string;
  platform: string;
  direction: 'YES' | 'NO';
  shares: number;
  avgEntryPrice: number;
  currentPrice: number;
  totalCost: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  settlementDate?: string;
}

export interface PortfolioResult {
  timestamp: string;
  summary: {
    totalPositions: number;
    openPositions: number;
    totalInvested: number;
    currentValue: number;
    unrealizedPnL: number;
    unrealizedPnLPct: number;
    realizedPnL: number;
    totalPnL: number;
    winRate: number;
  };
  positions: PortfolioPositionData[];
  bestPosition?: PortfolioPositionData;
  worstPosition?: PortfolioPositionData;
  allocation: {
    byPlatform: Record<string, number>;
    byDirection: { yes: number; no: number };
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function mapPosition(p: Position): PortfolioPositionData {
  return {
    id: p.id,
    marketTitle: p.marketTitle,
    platform: p.platform,
    direction: p.direction,
    shares: p.shares,
    avgEntryPrice: p.avgEntryPrice,
    currentPrice: p.currentPrice,
    totalCost: p.totalCost,
    currentValue: p.shares * p.currentPrice,
    unrealizedPnL: p.unrealizedPnl,
    unrealizedPnLPct: p.unrealizedPnlPct,
    settlementDate: p.settlementDate,
  };
}

// =============================================================================
// HANDLER
// =============================================================================

export const portfolioHandler: CommandHandler<PortfolioResult> = {
  id: 'portfolio',
  skillsUsed: ['positions'],

  async execute(context: CommandContext): Promise<CommandResult<PortfolioResult>> {
    const startTime = Date.now();

    try {
      // Get user ID from context
      const telegramId = context.chatId?.toString() || 'anonymous';

      // Refresh prices first
      await refreshPositionPrices(telegramId);

      // Get portfolio data
      const summary = getPortfolioSummary(telegramId);
      const rawPositions = getUserPositions(telegramId, 'open');

      // Map positions to response format
      const positions = rawPositions.map(mapPosition);

      // Calculate allocation
      const byPlatform: Record<string, number> = {};
      let yesValue = 0;
      let noValue = 0;

      for (const p of positions) {
        byPlatform[p.platform] = (byPlatform[p.platform] || 0) + p.currentValue;
        if (p.direction === 'YES') {
          yesValue += p.currentValue;
        } else {
          noValue += p.currentValue;
        }
      }

      // Map best/worst positions
      const bestPosition = summary.bestPosition ? mapPosition(summary.bestPosition) : undefined;
      const worstPosition = summary.worstPosition ? mapPosition(summary.worstPosition) : undefined;

      const result: PortfolioResult = {
        timestamp: new Date().toISOString(),
        summary: {
          totalPositions: summary.totalPositions,
          openPositions: summary.openPositions,
          totalInvested: summary.totalInvested,
          currentValue: summary.currentValue,
          unrealizedPnL: summary.unrealizedPnl,
          unrealizedPnLPct: summary.unrealizedPnlPct,
          realizedPnL: summary.realizedPnl,
          totalPnL: summary.totalPnl,
          winRate: summary.winRate,
        },
        positions,
        bestPosition,
        worstPosition,
        allocation: {
          byPlatform,
          byDirection: { yes: yesValue, no: noValue },
        },
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'portfolio',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['positions'],
          apiCallsMade: positions.length + 1,
        },
        hints: {
          mood: summary.totalPnl >= 0 ? 'BULLISH' : 'BEARISH',
          suggestedActions: ['/pnl', '/kalshi positions'],
        },
      };
    } catch (error) {
      console.error('[PortfolioHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'PORTFOLIO_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch portfolio',
          retryable: true,
          recoveryAction: 'Try again in a moment',
        },
        meta: {
          handlerId: 'portfolio',
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

registerHandler(portfolioHandler);

export default portfolioHandler;
