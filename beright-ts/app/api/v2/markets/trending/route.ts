/**
 * Trending Markets API v2
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDataFabric } from '../../../../../lib/dataFabric';

/**
 * GET /api/v2/markets/trending
 *
 * Returns the hottest markets by volume.
 *
 * Query Parameters:
 * - limit: Number of results (default 20, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    const fabric = getDataFabric();
    const result = await fabric.getTrendingMarkets(limit);

    return NextResponse.json({
      success: true,
      data: result.markets,
      meta: {
        total: result.total,
        fetchedAt: result.fetchedAt.toISOString(),
        latencyMs: result.latencyMs,
        cacheHit: result.cacheHit,
      },
    });
  } catch (error) {
    console.error('[API v2/markets/trending] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
