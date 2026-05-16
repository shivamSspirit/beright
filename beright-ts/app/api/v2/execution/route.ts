/**
 * Execution API v2
 *
 * Order execution and smart routing.
 * SECURED: Requires authentication for POST (execution).
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { getExecutionEngine, OrderRequest, RoutingStrategy, OrderType } from '../../../../lib/execution';
import { requireAuth, withAuth, logSecurityEvent, logTransactionAudit } from '../../../../lib/middleware';
import { schemas, validateRequest } from '../../../../lib/validation';
import { assertTradingEnabled } from '../../../../lib/killSwitch';
import { Platform } from '../../../../lib/core/validation';

/**
 * GET /api/v2/execution
 *
 * Get execution engine status.
 * Public endpoint (no auth required).
 */
export const GET = withAuth(async (_request, ctx) => {
  try {
    const engine = getExecutionEngine();
    const status = engine.getStatus();

    return NextResponse.json({
      success: true,
      data: status,
      requestId: ctx.requestId,
    });
  } catch (error) {
    console.error('[API v2/execution] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});

/**
 * POST /api/v2/execution
 *
 * Execute an order.
 * SECURED: Requires verified or admin tier.
 *
 * Body:
 * - marketId: string (required)
 * - side: 'YES' | 'NO' (required)
 * - type: 'MARKET' | 'LIMIT' (default: 'MARKET')
 * - size: number (required)
 * - price: number (required for LIMIT orders)
 * - platform: string (optional - auto-route if not specified)
 * - strategy: 'BEST_PRICE' | 'BEST_LIQUIDITY' | 'LOWEST_FEES' | 'SPLIT' (default: 'BEST_PRICE')
 * - dryRun: boolean (default: false - if true, only returns quote)
 */
export const POST = requireAuth(
  async (request: NextRequest, ctx) => {
    try {
      // Check kill switch
      try {
        assertTradingEnabled();
      } catch (killSwitchError) {
        await logSecurityEvent({
          eventType: 'kill_switch',
          action: 'execution_blocked',
          severity: 'warning',
          walletAddress: ctx.walletAddress,
          requestId: ctx.requestId,
          details: { reason: 'trading_disabled' },
        });

        return NextResponse.json(
          {
            success: false,
            error: 'Trading is currently disabled',
            code: 'TRADING_DISABLED',
          },
          { status: 503 }
        );
      }

      // Validate request body
      const { data, error } = await validateRequest(request, schemas.executionRequest);
      if (error) return error;

      const { marketId, side, type, size, price, platform, strategy, dryRun } = data;

      const engine = getExecutionEngine();

      // Dry run - return quote and routing
      if (dryRun) {
        const [quote, routing] = await Promise.all([
          engine.getQuote(marketId, side, size),
          engine.getRouting(marketId, side, size, strategy as RoutingStrategy),
        ]);

        return NextResponse.json({
          success: true,
          dryRun: true,
          data: {
            quote,
            routing,
          },
          requestId: ctx.requestId,
        });
      }

      // Log transaction audit (before execution)
      const auditId = await logTransactionAudit({
        txType: 'trade',
        fromWallet: ctx.walletAddress || 'unknown',
        status: 'pending',
        userId: ctx.userId,
        sessionId: ctx.requestId,
      });

      // Build order request
      const targetPlatform = (platform || 'polymarket') as Platform;
      const orderType = (type || 'MARKET') as OrderType;

      const orderRequest: OrderRequest = {
        marketId,
        side,
        type: orderType,
        size,
        price,
        platform: targetPlatform,
      };

      // Log security event
      await logSecurityEvent({
        eventType: 'transaction_sign',
        action: 'execution_order',
        severity: 'info',
        walletAddress: ctx.walletAddress,
        requestId: ctx.requestId,
        details: {
          marketId,
          side,
          type,
          size,
          strategy,
        },
      });

      // Execute order
      const results = await engine.execute(orderRequest, strategy as RoutingStrategy);

      // Calculate summary
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      const totalFilled = successful.reduce(
        (sum, r) => sum + (r.order?.filledSize || 0),
        0
      );
      const totalCost = successful.reduce(
        (sum, r) => {
          const order = r.order;
          if (!order) return sum;
          return sum + (order.filledSize * (order.avgFillPrice || 0)) + (order.fees || 0);
        },
        0
      );
      const avgPrice = totalFilled > 0 ? totalCost / totalFilled : 0;

      // Update transaction audit
      if (auditId) {
        const { updateTransactionAudit } = await import('../../../../lib/middleware');
        await updateTransactionAudit(auditId, {
          status: successful.length > 0 ? 'confirmed' : 'failed',
          errorMessage: failed.length > 0 ? failed[0].error : undefined,
        });
      }

      // Log completion
      await logSecurityEvent({
        eventType: 'transaction_send',
        action: 'execution_complete',
        severity: successful.length > 0 ? 'info' : 'warning',
        walletAddress: ctx.walletAddress,
        requestId: ctx.requestId,
        success: successful.length > 0,
        details: {
          marketId,
          totalFilled,
          totalCost,
          successfulOrders: successful.length,
          failedOrders: failed.length,
        },
      });

      return NextResponse.json({
        success: successful.length > 0,
        data: {
          results,
          summary: {
            totalOrders: results.length,
            successfulOrders: successful.length,
            failedOrders: failed.length,
            totalFilled,
            totalCost,
            avgPrice,
          },
        },
        requestId: ctx.requestId,
      });
    } catch (error) {
      console.error('[API v2/execution] Error:', error);

      await logSecurityEvent({
        eventType: 'transaction_send',
        action: 'execution_error',
        severity: 'error',
        walletAddress: ctx.walletAddress,
        requestId: ctx.requestId,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  },
  { allowedTiers: ['verified', 'admin', 'service'] }
);
