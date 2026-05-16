/**
 * API: GET /api/markets/hot
 *
 * Returns hot markets (momentum > 70).
 * Shortcut for /api/markets/ranked?hot=true
 *
 * Query params:
 *   - limit: number (default: 20, max: 50)
 *
 * Response:
 *   {
 *     markets: MarketWithMomentum[],
 *     total: number
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getHotMarkets } from '../../../../lib/momentum';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    const markets = await getHotMarkets(limit);

    return NextResponse.json({
      markets,
      total: markets.length,
    });
  } catch (error) {
    console.error('[API] /api/markets/hot error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch hot markets' },
      { status: 500 }
    );
  }
}
