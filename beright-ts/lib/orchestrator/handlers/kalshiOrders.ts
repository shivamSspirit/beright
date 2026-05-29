/**
 * Kalshi Orders Handler
 *
 * View resting (open) orders on Kalshi.
 *
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import {
  getKalshiOrders,
  isKalshiConfigured,
  isKalshiDemo,
  KalshiOrder,
} from '../../kalshi';

// =============================================================================
// TYPES
// =============================================================================

export interface KalshiOrderData {
  orderId: string;
  ticker: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  contracts: number;
  remainingContracts: number;
  price: number;
  status: string;
  createdAt: string;
}

export interface KalshiOrdersResult {
  orders: KalshiOrderData[];
  totalOrders: number;
  totalPendingValue: number;
  isDemo: boolean;
  timestamp: string;
}

// =============================================================================
// HANDLER
// =============================================================================

export const kalshiOrdersHandler: CommandHandler<KalshiOrdersResult> = {
  id: 'kalshiOrders',
  skillsUsed: ['kalshi'],

  async execute(context: CommandContext): Promise<CommandResult<KalshiOrdersResult>> {
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
            handlerId: 'kalshiOrders',
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

      // Get status filter from arguments
      const statusArg = context.arguments?.[0]?.toLowerCase();
      let status: 'resting' | 'executed' | 'canceled' | undefined;

      if (statusArg === 'resting' || statusArg === 'open') {
        status = 'resting';
      } else if (statusArg === 'executed' || statusArg === 'filled') {
        status = 'executed';
      } else if (statusArg === 'canceled' || statusArg === 'cancelled') {
        status = 'canceled';
      } else {
        // Default to resting orders
        status = 'resting';
      }

      const rawOrders = await getKalshiOrders(status);

      const orders: KalshiOrderData[] = rawOrders.map(order => ({
        orderId: order.order_id,
        ticker: order.market_ticker,
        side: order.side,
        action: order.action,
        contracts: order.count,
        remainingContracts: order.remaining_count ?? order.count,
        price: order.yes_price,
        status: order.status,
        createdAt: order.created_time,
      }));

      // Calculate total pending value
      const totalPendingValue = orders.reduce((sum, o) => {
        return sum + (o.remainingContracts * o.price);
      }, 0);

      const result: KalshiOrdersResult = {
        orders,
        totalOrders: orders.length,
        totalPendingValue,
        isDemo: isKalshiDemo(),
        timestamp: new Date().toISOString(),
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'kalshiOrders',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['kalshi'],
          apiCallsMade: 1,
        },
        hints: {
          mood: 'NEUTRAL',
          suggestedActions: orders.length > 0
            ? [`/kalshi cancel ${orders[0].orderId}`]
            : ['/kalshi markets'],
        },
      };
    } catch (error) {
      console.error('[KalshiOrdersHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'KALSHI_ORDERS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch orders',
          retryable: true,
          recoveryAction: 'Try again in a moment',
        },
        meta: {
          handlerId: 'kalshiOrders',
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

registerHandler(kalshiOrdersHandler);

export default kalshiOrdersHandler;
