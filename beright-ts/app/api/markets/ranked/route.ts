/**
 * API: GET /api/markets/ranked
 *
 * Returns markets ranked by momentum score (AIXBT-style).
 *
 * Query params:
 *   - limit: number (default: 50, max: 100)
 *   - hot: boolean (default: false) - only return hot markets (momentum > 70)
 *   - platform: string - filter by platform
 *
 * Response:
 *   {
 *     markets: MarketWithMomentum[],
 *     total: number,
 *     updatedAt: string
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRankedMarkets } from '../../../../lib/momentum';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const hotOnly = searchParams.get('hot') === 'true';
    const platform = searchParams.get('platform') || undefined;

    const markets = await getRankedMarkets({
      limit,
      hotOnly,
      platform,
    });

    return NextResponse.json({
      markets,
      total: markets.length,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] /api/markets/ranked error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ranked markets' },
      { status: 500 }
    );
  }
}
