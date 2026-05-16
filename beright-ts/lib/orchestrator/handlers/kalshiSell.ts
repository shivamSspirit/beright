/**
 * Kalshi Sell Handler
 *
 * Place sell orders on Kalshi prediction markets.
 * Sells existing positions.
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
  placeKalshiOrder,
  getKalshiMarket,
  getKalshiPositions,
  isKalshiConfigured,
  isKalshiDemo,
  KalshiOrder,
  KalshiMarket,
  KalshiPosition,
} from '../../kalshi';

// =============================================================================
// TYPES
// =============================================================================

export interface KalshiSellResult {
  success: boolean;
  ticker: string;
  marketTitle: string;
  side: 'yes' | 'no';
  contracts: number;
  price: number;
  proceeds: number;
  orderId?: string;
  status?: string;
  isDemo: boolean;
  timestamp: string;
}

// =============================================================================
// HANDLER
// =============================================================================

export const kalshiSellHandler: CommandHandler<KalshiSellResult> = {
  id: 'kalshiSell',
  skillsUsed: ['kalshi'],

  async execute(context: CommandContext): Promise<CommandResult<KalshiSellResult>> {
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
            handlerId: 'kalshiSell',
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

      // Parse parameters: /kalshi sell <ticker> [contracts] [price]
      const ticker = (context.params.ticker as string) ||
                     context.arguments?.[0] ||
                     '';

      const contractsStr = (context.params.contracts as string) ||
                           context.arguments?.[1];

      const priceStr = (context.params.price as string) ||
                       context.arguments?.[2];

      if (!ticker) {
        return {
          success: false,
          error: {
            code: 'MISSING_TICKER',
            message: 'Please provide a market ticker. Usage: /kalshi sell <ticker> [contracts] [price]',
            retryable: false,
          },
          meta: {
            handlerId: 'kalshiSell',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: [],
            apiCallsMade: 0,
          },
          hints: {
            mood: 'NEUTRAL',
            suggestedActions: ['/kalshi positions'],
          },
        };
      }

      // Get current position
      const positions = await getKalshiPositions(false);
      const position = positions.find(p => p.market_ticker === ticker);

      if (!position || position.position === 0) {
        return {
          success: false,
          error: {
            code: 'NO_POSITION',
            message: `You don't have a position in ${ticker}`,
            retryable: false,
          },
          meta: {
            handlerId: 'kalshiSell',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: ['kalshi'],
            apiCallsMade: 1,
          },
          hints: {
            mood: 'NEUTRAL',
            suggestedActions: ['/kalshi positions'],
          },
        };
      }

      // Determine side based on position
      const side: 'yes' | 'no' = position.position > 0 ? 'yes' : 'no';
      const maxContracts = Math.abs(position.position);

      // Parse contracts (default to all)
      let contracts = contractsStr ? parseInt(contractsStr) : maxContracts;
      if (contracts > maxContracts) {
        contracts = maxContracts;
      }

      if (contracts < 1) {
        return {
          success: false,
          error: {
            code: 'INVALID_CONTRACTS',
            message: 'Must sell at least 1 contract',
            retryable: false,
          },
          meta: {
            handlerId: 'kalshiSell',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: ['kalshi'],
            apiCallsMade: 1,
          },
          hints: {
            mood: 'NEUTRAL',
          },
        };
      }

      // Get market for current price
      const market = await getKalshiMarket(ticker);
      if (!market) {
        return {
          success: false,
          error: {
            code: 'MARKET_NOT_FOUND',
            message: `Market not found: ${ticker}`,
            retryable: false,
          },
          meta: {
            handlerId: 'kalshiSell',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: ['kalshi'],
            apiCallsMade: 2,
          },
          hints: {
            mood: 'NEUTRAL',
          },
        };
      }

      // Use bid price for selling (or specified price)
      let price = priceStr ? parseInt(priceStr) : undefined;
      if (!price) {
        price = side === 'yes' ? market.yes_bid : market.no_bid;
        if (!price || price < 1 || price > 99) {
          price = side === 'yes' ? 50 : 50;
        }
      }

      if (price < 1 || price > 99) {
        return {
          success: false,
          error: {
            code: 'INVALID_PRICE',
            message: 'Price must be between 1 and 99 cents',
            retryable: false,
          },
          meta: {
            handlerId: 'kalshiSell',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: ['kalshi'],
            apiCallsMade: 2,
          },
          hints: {
            mood: 'NEUTRAL',
          },
        };
      }

      // Place sell order
      const order = await placeKalshiOrder(
        ticker,
        side,
        'sell',
        contracts,
        price
      );

      if (!order) {
        return {
          success: false,
          error: {
            code: 'ORDER_FAILED',
            message: 'Failed to place sell order',
            retryable: true,
            recoveryAction: 'Try again in a moment',
          },
          meta: {
            handlerId: 'kalshiSell',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: ['kalshi'],
            apiCallsMade: 3,
          },
          hints: {
            mood: 'ERROR',
          },
        };
      }

      const proceeds = contracts * price;

      const result: KalshiSellResult = {
        success: true,
        ticker,
        marketTitle: market.title,
        side,
        contracts,
        price,
        proceeds,
        orderId: order.order_id,
        status: order.status,
        isDemo: isKalshiDemo(),
        timestamp: new Date().toISOString(),
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'kalshiSell',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['kalshi'],
          apiCallsMade: 3,
        },
        hints: {
          mood: 'NEUTRAL',
          suggestedActions: ['/kalshi positions', '/kalshi orders'],
        },
      };
    } catch (error) {
      console.error('[KalshiSellHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'KALSHI_SELL_FAILED',
          message: error instanceof Error ? error.message : 'Failed to place sell order',
          retryable: true,
          recoveryAction: 'Try again in a moment',
        },
        meta: {
          handlerId: 'kalshiSell',
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

registerHandler(kalshiSellHandler);

export default kalshiSellHandler;
