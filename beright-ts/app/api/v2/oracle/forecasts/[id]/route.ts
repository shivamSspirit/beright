/**
 * GET /api/v2/oracle/forecasts/[id]
 *
 * Get a single Oracle forecast by ID.
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "forecast": { ... full forecast details }
 *   }
 * }
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/client';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const startTime = Date.now();

  try {
    const { id } = await params;

    if (!isSupabaseConfigured) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database not configured',
        },
        { status: 503 }
      );
    }

    // Fetch forecast by ID
    const { data: forecast, error } = await supabaseAdmin
      .from('oracle_forecasts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !forecast) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forecast not found',
        },
        { status: 404 }
      );
    }

    const latencyMs = Date.now() - startTime;

    return NextResponse.json(
      {
        success: true,
        data: {
          forecast,
        },
        latencyMs,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
          'X-Oracle-Latency': `${latencyMs}ms`,
        },
      }
    );
  } catch (error) {
    console.error('[Oracle API] Single forecast error:', error);
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
