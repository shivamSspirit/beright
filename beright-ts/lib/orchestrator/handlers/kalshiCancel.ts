/**
 * Kalshi Cancel Handler
 *
 * Cancel orders on Kalshi.
 *
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import {
  cancelKalshiOrder,
  cancelAllKalshiOrders,
  isKalshiConfigured,
  isKalshiDemo,
} from '../../kalshi';

// =============================================================================
// TYPES
// =============================================================================

export interface KalshiCancelResult {
  success: boolean;
  orderId?: string;
  canceledCount?: number;
  cancelAll: boolean;
  ticker?: string;
  isDemo: boolean;
  timestamp: string;
}

// =============================================================================
// HANDLER
// =============================================================================

export const kalshiCancelHandler: CommandHandler<KalshiCancelResult> = {
  id: 'kalshiCancel',
  skillsUsed: ['kalshi'],

  async execute(context: CommandContext): Promise<CommandResult<KalshiCancelResult>> {
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
            handlerId: 'kalshiCancel',
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

      // Parse arguments: /kalshi cancel <orderId> OR /kalshi cancel all [ticker]
      const arg1 = (context.params.orderId as string) ||
                   context.arguments?.[0] ||
                   '';

      const arg2 = context.arguments?.[1];

      let result: KalshiCancelResult;

      if (!arg1) {
        return {
          success: false,
          error: {
            code: 'MISSING_ORDER_ID',
            message: 'Please provide an order ID or "all". Usage: /kalshi cancel <orderId> OR /kalshi cancel all [ticker]',
            retryable: false,
          },
          meta: {
            handlerId: 'kalshiCancel',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: [],
            apiCallsMade: 0,
          },
          hints: {
            mood: 'NEUTRAL',
            suggestedActions: ['/kalshi orders'],
          },
        };
      }

      if (arg1.toLowerCase() === 'all') {
        // Cancel all orders (optionally for a specific ticker)
        const ticker = arg2;
        const canceledCount = await cancelAllKalshiOrders(ticker);

        result = {
          success: true,
          canceledCount,
          cancelAll: true,
          ticker,
          isDemo: isKalshiDemo(),
          timestamp: new Date().toISOString(),
        };
      } else {
        // Cancel specific order
        const orderId = arg1;
        const success = await cancelKalshiOrder(orderId);

        if (!success) {
          return {
            success: false,
            error: {
              code: 'CANCEL_FAILED',
              message: `Failed to cancel order ${orderId}. It may already be filled or canceled.`,
              retryable: false,
            },
            meta: {
              handlerId: 'kalshiCancel',
              routeId: context.route.id,
              executedAt: new Date(),
              durationMs: Date.now() - startTime,
              skillsUsed: ['kalshi'],
              apiCallsMade: 1,
            },
            hints: {
              mood: 'NEUTRAL',
              suggestedActions: ['/kalshi orders'],
            },
          };
        }

        result = {
          success: true,
          orderId,
          cancelAll: false,
          isDemo: isKalshiDemo(),
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'kalshiCancel',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['kalshi'],
          apiCallsMade: 1,
        },
        hints: {
          mood: 'NEUTRAL',
          suggestedActions: ['/kalshi orders', '/kalshi positions'],
        },
      };
    } catch (error) {
      console.error('[KalshiCancelHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'KALSHI_CANCEL_FAILED',
          message: error instanceof Error ? error.message : 'Failed to cancel order',
          retryable: true,
          recoveryAction: 'Try again in a moment',
        },
        meta: {
          handlerId: 'kalshiCancel',
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

registerHandler(kalshiCancelHandler);

export default kalshiCancelHandler;
