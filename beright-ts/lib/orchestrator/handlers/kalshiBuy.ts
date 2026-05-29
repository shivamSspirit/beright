/**
 * Kalshi Buy Handler
 *
 * Place buy orders on Kalshi prediction markets.
 *
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
  isKalshiConfigured,
  isKalshiDemo,
  KalshiOrder,
  KalshiMarket,
} from '../../kalshi';

// =============================================================================
// TYPES
// =============================================================================

export interface KalshiBuyResult {
  success: boolean;
  ticker: string;
  marketTitle: string;
  side: 'yes' | 'no';
  contracts: number;
  price: number;  // In cents (1-99)
  cost: number;   // Total cost in cents
  orderId?: string;
  status?: string;
  isDemo: boolean;
  timestamp: string;
}

// =============================================================================
// HANDLER
// =============================================================================

export const kalshiBuyHandler: CommandHandler<KalshiBuyResult> = {
  id: 'kalshiBuy',
  skillsUsed: ['kalshi'],

  async execute(context: CommandContext): Promise<CommandResult<KalshiBuyResult>> {
    const startTime = Date.now();

    try {
      // Check if Kalshi is configured
      if (!isKalshiConfigured()) {
        return {
          success: false,
          error: {
            code: 'KALSHI_NOT_CONFIGURED',
            message: 'Kalshi trading is not configured. Please set KALSHI_API_KEY and KALSHI_API_SECRET.',
            retryable: false,
          },
          meta: {
            handlerId: 'kalshiBuy',
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

      // Parse parameters: /kalshi buy <ticker> <YES|NO> <contracts> [price]
      const ticker = (context.params.ticker as string) ||
                     context.arguments?.[0] ||
                     '';

      const side = ((context.params.side as string) ||
                    context.arguments?.[1] ||
                    'yes').toLowerCase() as 'yes' | 'no';

      const contractsStr = (context.params.contracts as string) ||
                           context.arguments?.[2] ||
                           '1';
      const contracts = parseInt(contractsStr) || 1;

      // Optional limit price
      const priceStr = (context.params.price as string) ||
                       context.arguments?.[3];
      let price = priceStr ? parseInt(priceStr) : undefined;

      // Validate inputs
      if (!ticker) {
        return {
          success: false,
          error: {
            code: 'MISSING_TICKER',
            message: 'Please provide a market ticker. Usage: /kalshi buy <ticker> YES|NO <contracts> [price]',
            retryable: false,
          },
          meta: {
            handlerId: 'kalshiBuy',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: [],
            apiCallsMade: 0,
          },
          hints: {
            mood: 'NEUTRAL',
            suggestedActions: ['/kalshi markets'],
          },
        };
      }

      if (side !== 'yes' && side !== 'no') {
        return {
          success: false,
          error: {
            code: 'INVALID_SIDE',
            message: 'Side must be YES or NO',
            retryable: false,
          },
          meta: {
            handlerId: 'kalshiBuy',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: [],
            apiCallsMade: 0,
          },
          hints: {
            mood: 'NEUTRAL',
          },
        };
      }

      if (contracts < 1 || contracts > 1000) {
        return {
          success: false,
          error: {
            code: 'INVALID_CONTRACTS',
            message: 'Contracts must be between 1 and 1000',
            retryable: false,
          },
          meta: {
            handlerId: 'kalshiBuy',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: [],
            apiCallsMade: 0,
          },
          hints: {
            mood: 'NEUTRAL',
          },
        };
      }

      // Get market to validate and get current price
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
            handlerId: 'kalshiBuy',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: ['kalshi'],
            apiCallsMade: 1,
          },
          hints: {
            mood: 'NEUTRAL',
            suggestedActions: ['/kalshi markets'],
          },
        };
      }

      if (market.status !== 'open') {
        return {
          success: false,
          error: {
            code: 'MARKET_CLOSED',
            message: `Market ${ticker} is ${market.status}`,
            retryable: false,
          },
          meta: {
            handlerId: 'kalshiBuy',
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

      // Use current ask price if no price specified
      if (!price) {
        price = side === 'yes' ? market.yes_ask : market.no_ask;
        if (!price || price < 1 || price > 99) {
          price = side === 'yes' ? 50 : 50;
        }
      }

      // Validate price
      if (price < 1 || price > 99) {
        return {
          success: false,
          error: {
            code: 'INVALID_PRICE',
            message: 'Price must be between 1 and 99 cents',
            retryable: false,
          },
          meta: {
            handlerId: 'kalshiBuy',
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

      // Place the order
      const order = await placeKalshiOrder(
        ticker,
        side,
        'buy',
        contracts,
        price
      );

      if (!order) {
        return {
          success: false,
          error: {
            code: 'ORDER_FAILED',
            message: 'Failed to place order',
            retryable: true,
            recoveryAction: 'Check your balance and try again',
          },
          meta: {
            handlerId: 'kalshiBuy',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: ['kalshi'],
            apiCallsMade: 2,
          },
          hints: {
            mood: 'ERROR',
            suggestedActions: ['/kalshi balance'],
          },
        };
      }

      const cost = contracts * price;

      const result: KalshiBuyResult = {
        success: true,
        ticker,
        marketTitle: market.title,
        side,
        contracts,
        price,
        cost,
        orderId: order.order_id,
        status: order.status,
        isDemo: isKalshiDemo(),
        timestamp: new Date().toISOString(),
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'kalshiBuy',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['kalshi'],
          apiCallsMade: 2,
        },
        hints: {
          mood: 'BULLISH',
          suggestedActions: ['/kalshi positions', '/kalshi orders'],
        },
      };
    } catch (error) {
      console.error('[KalshiBuyHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'KALSHI_BUY_FAILED',
          message: error instanceof Error ? error.message : 'Failed to place buy order',
          retryable: true,
          recoveryAction: 'Check your balance and try again',
        },
        meta: {
          handlerId: 'kalshiBuy',
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

registerHandler(kalshiBuyHandler);

export default kalshiBuyHandler;
