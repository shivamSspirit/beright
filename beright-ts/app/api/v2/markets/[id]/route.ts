/**
 * Single Market Detail API v2
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDataFabric } from '../../../../../lib/dataFabric';

/**
 * GET /api/v2/markets/:id
 *
 * Returns detailed information about a single market.
 * ID can be:
 * - BeRight canonical ID
 * - Slug
 * - Platform-specific ID (polymarket:abc123)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Market ID required' },
        { status: 400 }
      );
    }

    const fabric = getDataFabric();
    const result = await fabric.getMarket(id);

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Market not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.market,
      meta: {
        fetchedAt: result.fetchedAt.toISOString(),
        latencyMs: result.latencyMs,
      },
      related: result.relatedMarkets,
    });
  } catch (error) {
    console.error('[API v2/markets/:id] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
