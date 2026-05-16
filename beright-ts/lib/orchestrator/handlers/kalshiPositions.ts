/**
 * Kalshi Positions Handler
 *
 * View open positions on Kalshi.
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
  getKalshiPositions,
  getKalshiMarket,
  isKalshiConfigured,
  isKalshiDemo,
  KalshiPosition,
  KalshiMarket,
} from '../../kalshi';

// =============================================================================
// TYPES
// =============================================================================

export interface KalshiPositionData {
  ticker: string;
  marketTitle: string;
  side: 'YES' | 'NO';
  contracts: number;
  avgPrice: number;
  currentPrice: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  restingOrders: number;
}

export interface KalshiPositionsResult {
  positions: KalshiPositionData[];
  totalPositions: number;
  totalValue: number;
  totalUnrealizedPnL: number;
  isDemo: boolean;
  timestamp: string;
}

// =============================================================================
// HANDLER
// =============================================================================

export const kalshiPositionsHandler: CommandHandler<KalshiPositionsResult> = {
  id: 'kalshiPositions',
  skillsUsed: ['kalshi'],

  async execute(context: CommandContext): Promise<CommandResult<KalshiPositionsResult>> {
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
            handlerId: 'kalshiPositions',
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

      const rawPositions = await getKalshiPositions(false);

      // Enrich positions with market data
      const positions: KalshiPositionData[] = [];

      for (const pos of rawPositions) {
        if (pos.position === 0) continue; // Skip zero positions

        let market: KalshiMarket | null = null;
        try {
          market = await getKalshiMarket(pos.market_ticker);
        } catch {
          // Skip if market not found
        }

        const side: 'YES' | 'NO' = pos.position > 0 ? 'YES' : 'NO';
        const contracts = Math.abs(pos.position);
        const avgPrice = pos.average_price || 50;

        // Get current price
        let currentPrice = 50;
        if (market) {
          currentPrice = side === 'YES'
            ? ((market.yes_bid + market.yes_ask) / 2 || market.last_price || 50)
            : ((market.no_bid + market.no_ask) / 2 || 100 - (market.last_price || 50));
        }

        const currentValue = contracts * currentPrice;
        const costBasis = contracts * avgPrice;
        const unrealizedPnL = currentValue - costBasis;
        const unrealizedPnLPct = costBasis > 0 ? unrealizedPnL / costBasis : 0;

        positions.push({
          ticker: pos.market_ticker,
          marketTitle: market?.title || pos.market_ticker,
          side,
          contracts,
          avgPrice,
          currentPrice,
          currentValue,
          unrealizedPnL,
          unrealizedPnLPct,
          restingOrders: pos.resting_order_count || 0,
        });
      }

      const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
      const totalUnrealizedPnL = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);

      const result: KalshiPositionsResult = {
        positions,
        totalPositions: positions.length,
        totalValue,
        totalUnrealizedPnL,
        isDemo: isKalshiDemo(),
        timestamp: new Date().toISOString(),
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'kalshiPositions',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['kalshi'],
          apiCallsMade: 1 + positions.length,
        },
        hints: {
          mood: totalUnrealizedPnL >= 0 ? 'BULLISH' : 'BEARISH',
          suggestedActions: ['/kalshi orders', '/kalshi balance'],
        },
      };
    } catch (error) {
      console.error('[KalshiPositionsHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'KALSHI_POSITIONS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch positions',
          retryable: true,
          recoveryAction: 'Try again in a moment',
        },
        meta: {
          handlerId: 'kalshiPositions',
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

registerHandler(kalshiPositionsHandler);

export default kalshiPositionsHandler;
