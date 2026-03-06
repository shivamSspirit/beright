/**
 * Execution Quote API v2
 *
 * Get execution quotes without placing orders.
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { getExecutionEngine, RoutingStrategy } from '../../../../../lib/execution';

/**
 * GET /api/v2/execution/quote
 *
 * Get execution quote for an order.
 *
 * Query Parameters:
 * - marketId: string (required)
 * - side: 'YES' | 'NO' (required)
 * - size: number (required)
 * - strategy: routing strategy (default: 'BEST_PRICE')
 * - allVenues: boolean (default: false - if true, returns quotes from all venues)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const marketId = searchParams.get('marketId');
    const side = searchParams.get('side') as 'YES' | 'NO';
    const size = parseFloat(searchParams.get('size') || '0');
    const strategy = (searchParams.get('strategy') || 'BEST_PRICE') as RoutingStrategy;
    const allVenues = searchParams.get('allVenues') === 'true';

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

    const engine = getExecutionEngine();

    if (allVenues) {
      // Get quotes from all venues
      const quotes = await engine.getQuotes(marketId, side, size);

      return NextResponse.json({
        success: true,
        data: {
          quotes,
          bestQuote: quotes[0] || null,
          venueCount: quotes.length,
        },
      });
    }

    // Get best quote with routing
    const [quote, routing] = await Promise.all([
      engine.getQuote(marketId, side, size),
      engine.getRouting(marketId, side, size, strategy),
    ]);

    if (!quote) {
      return NextResponse.json(
        { success: false, error: 'No quotes available for this market' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        quote,
        routing,
        summary: {
          estimatedPrice: quote.estimatedPrice,
          estimatedSlippage: quote.estimatedSlippage,
          estimatedFees: quote.estimatedFees,
          estimatedTotal: quote.estimatedTotal,
          recommendedVenue: quote.recommendedVenue,
          priceImpact: quote.priceImpact,
          executionProbability: quote.executionProbability,
        },
      },
    });
  } catch (error) {
    console.error('[API v2/execution/quote] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
