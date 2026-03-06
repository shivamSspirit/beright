/**
 * Execution API v2
 *
 * Order execution and smart routing.
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { getExecutionEngine, OrderRequest, RoutingStrategy } from '../../../../lib/execution';

/**
 * GET /api/v2/execution
 *
 * Get execution engine status.
 */
export async function GET() {
  try {
    const engine = getExecutionEngine();
    const status = engine.getStatus();

    return NextResponse.json({
      success: true,
      data: status,
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
}

/**
 * POST /api/v2/execution
 *
 * Execute an order.
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
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      marketId,
      side,
      type = 'MARKET',
      size,
      price,
      platform,
      strategy = 'BEST_PRICE',
      dryRun = false,
    } = body;

    // Validation
    if (!marketId) {
      return NextResponse.json(
        { success: false, error: 'marketId is required' },
        { status: 400 }
      );
    }

    if (!side || !['YES', 'NO'].includes(side)) {
      return NextResponse.json(
        { success: false, error: 'side must be YES or NO' },
        { status: 400 }
      );
    }

    if (!size || size <= 0) {
      return NextResponse.json(
        { success: false, error: 'size must be positive' },
        { status: 400 }
      );
    }

    if (type === 'LIMIT' && (price === undefined || price <= 0 || price >= 1)) {
      return NextResponse.json(
        { success: false, error: 'LIMIT orders require price between 0 and 1' },
        { status: 400 }
      );
    }

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
      });
    }

    // Build order request
    const orderRequest: OrderRequest = {
      marketId,
      side,
      type,
      size,
      price,
      platform: platform || 'polymarket', // Default platform
    };

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
}
