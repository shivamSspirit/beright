/**
 * GET /api/v2/oracle/feed/[marketId]
 *
 * Get a single probability feed for a market.
 * This is the core oracle endpoint for external consumers.
 *
 * Response:
 * {
 *   "success": true,
 *   "feed": {
 *     "marketId": "btc-100k-2025",
 *     "probability": 0.42,
 *     "confidence": 0.85,
 *     "confidenceLevel": "high",
 *     ...
 *   },
 *   "breakdown": { ... }  // If ?breakdown=true
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFeed, DEFAULT_ORACLE_CONFIG } from '@/lib/oracle';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ marketId: string }> }
) {
  try {
    const { marketId } = await params;

    if (!marketId) {
      return NextResponse.json(
        { success: false, error: 'Market ID is required' },
        { status: 400 }
      );
    }

    // Check for breakdown query param
    const includeBreakdown = request.nextUrl.searchParams.get('breakdown') === 'true';

    const response = await getFeed(marketId, DEFAULT_ORACLE_CONFIG);

    if (!response.success) {
      return NextResponse.json(response, { status: 404 });
    }

    // Remove breakdown if not requested
    if (!includeBreakdown) {
      delete response.breakdown;
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
        'X-Oracle-Confidence': String(response.feed?.confidence || 0),
        'X-Oracle-Latency': `${response.latencyMs}ms`,
      },
    });
  } catch (error) {
    console.error('Oracle feed error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        latencyMs: 0,
        cached: false,
      },
      { status: 500 }
    );
  }
}
