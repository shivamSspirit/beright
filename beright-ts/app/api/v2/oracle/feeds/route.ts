/**
 * GET/POST /api/v2/oracle/feeds
 *
 * Get multiple probability feeds with filtering.
 *
 * GET query params:
 *   - category: Filter by market category
 *   - minConfidence: Minimum confidence score (0-1)
 *   - minVolume: Minimum 24h volume
 *   - limit: Max results (default 50)
 *   - breakdown: Include confidence breakdown
 *
 * POST body (for batch lookup by IDs):
 * {
 *   "marketIds": ["id1", "id2"],
 *   "includeBreakdown": true
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getFeeds, getFeedsByIds, DEFAULT_ORACLE_CONFIG } from '@/lib/oracle';

// Validation schema for POST requests
const BatchRequestSchema = z.object({
  marketIds: z.array(z.string()).min(1).max(100),
  includeBreakdown: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const category = searchParams.get('category') as any;
    const minConfidence = searchParams.get('minConfidence')
      ? parseFloat(searchParams.get('minConfidence')!)
      : undefined;
    const minVolume = searchParams.get('minVolume')
      ? parseFloat(searchParams.get('minVolume')!)
      : undefined;
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!, 10)
      : 50;
    const includeBreakdown = searchParams.get('breakdown') === 'true';

    const response = await getFeeds(
      {
        category,
        minConfidence,
        minVolume,
        limit,
        includeBreakdown,
      },
      DEFAULT_ORACLE_CONFIG
    );

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
        'X-Oracle-Count': String(response.feeds.length),
        'X-Oracle-Latency': `${response.latencyMs}ms`,
      },
    });
  } catch (error) {
    console.error('Oracle feeds error:', error);
    return NextResponse.json(
      {
        success: false,
        feeds: [],
        total: 0,
        filtered: 0,
        error: error instanceof Error ? error.message : 'Internal server error',
        latencyMs: 0,
        cached: false,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = BatchRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          feeds: [],
          total: 0,
          filtered: 0,
          error: 'Invalid request body',
          details: parsed.error.issues,
          latencyMs: 0,
          cached: false,
        },
        { status: 400 }
      );
    }

    const { marketIds, includeBreakdown } = parsed.data;

    const response = await getFeedsByIds(marketIds, DEFAULT_ORACLE_CONFIG);

    // Remove breakdowns if not requested
    if (!includeBreakdown) {
      delete (response as any).breakdowns;
    }

    return NextResponse.json(response, {
      headers: {
        'X-Oracle-Count': String(response.feeds.length),
        'X-Oracle-Latency': `${response.latencyMs}ms`,
      },
    });
  } catch (error) {
    console.error('Oracle batch feeds error:', error);
    return NextResponse.json(
      {
        success: false,
        feeds: [],
        total: 0,
        filtered: 0,
        error: error instanceof Error ? error.message : 'Internal server error',
        latencyMs: 0,
        cached: false,
      },
      { status: 500 }
    );
  }
}
