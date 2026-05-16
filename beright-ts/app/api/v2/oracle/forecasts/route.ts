/**
 * GET /api/v2/oracle/forecasts
 *
 * Get Oracle autonomous forecasts.
 *
 * Query params:
 *   - status: 'active' | 'resolved' | 'all' (default: 'active')
 *   - category: Filter by market category
 *   - limit: Max results (default: 50, max: 100)
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "forecasts": [...],
 *     "total": 15,
 *     "category": "politics"
 *   }
 * }
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActiveForecasts, getResolvedForecasts } from '@/lib/oracle';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const searchParams = request.nextUrl.searchParams;

    const status = searchParams.get('status') || 'active';
    const category = searchParams.get('category') || undefined;
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '50', 10),
      100
    );

    if (!isSupabaseConfigured) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database not configured',
        },
        { status: 503 }
      );
    }

    let forecasts: unknown[] = [];

    if (status === 'active') {
      forecasts = await getActiveForecasts({ category, limit });
    } else if (status === 'resolved') {
      forecasts = await getResolvedForecasts({ category, limit });
    } else {
      // Get all (active first, then resolved)
      const active = await getActiveForecasts({ category, limit: Math.floor(limit / 2) });
      const resolved = await getResolvedForecasts({ category, limit: Math.floor(limit / 2) });
      forecasts = [...active, ...resolved];
    }

    const latencyMs = Date.now() - startTime;

    return NextResponse.json(
      {
        success: true,
        data: {
          forecasts,
          total: forecasts.length,
          status,
          category: category || 'all',
        },
        latencyMs,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
          'X-Oracle-Count': String(forecasts.length),
          'X-Oracle-Latency': `${latencyMs}ms`,
        },
      }
    );
  } catch (error) {
    console.error('[Oracle API] Forecasts error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
