/**
 * GET /api/v2/oracle/stats
 *
 * Get Oracle aggregate performance statistics.
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "totalPredictions": 150,
 *     "resolvedPredictions": 45,
 *     "pendingPredictions": 105,
 *     "correctPredictions": 35,
 *     "brierScore": 0.142,
 *     "accuracy": 77.8,
 *     "calibrationRating": "Excellent",
 *     "lastForecastAt": "2024-01-15T10:00:00Z"
 *   }
 * }
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOracleStats } from '@/lib/oracle';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * Interpret Brier score as a calibration rating
 */
function getBrierRating(brier: number | null): string {
  if (brier === null || brier === undefined) return 'No data';
  if (brier < 0.10) return 'Elite (Superforecaster)';
  if (brier < 0.15) return 'Excellent';
  if (brier < 0.20) return 'Good';
  if (brier < 0.25) return 'Average';
  return 'Below Average';
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database not configured',
        },
        { status: 503 }
      );
    }

    // Get oracle stats
    const stats = await getOracleStats();

    if (!stats) {
      return NextResponse.json(
        {
          success: true,
          data: {
            totalPredictions: 0,
            resolvedPredictions: 0,
            pendingPredictions: 0,
            correctPredictions: 0,
            brierScore: null,
            accuracy: 0,
            calibrationRating: 'No data',
            lastForecastAt: null,
            message: 'No Oracle forecasts yet. Run the Oracle cron job to start forecasting.',
          },
        },
        {
          headers: {
            'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
          },
        }
      );
    }

    // Calculate accuracy percentage
    const resolved = (stats.resolved_predictions as number) || 0;
    const correct = (stats.correct_predictions as number) || 0;
    const accuracy = resolved > 0 ? (correct / resolved) * 100 : 0;

    const brierScore = stats.brier_score_avg as number | null;
    const calibrationRating = getBrierRating(brierScore);

    const latencyMs = Date.now() - startTime;

    return NextResponse.json(
      {
        success: true,
        data: {
          totalPredictions: stats.total_predictions || 0,
          resolvedPredictions: resolved,
          pendingPredictions: stats.pending_predictions || 0,
          correctPredictions: correct,
          brierScore: brierScore ? Number(brierScore.toFixed(4)) : null,
          accuracy: Number(accuracy.toFixed(1)),
          calibrationRating,
          lastForecastAt: stats.last_forecast_at || null,
          lastResolutionAt: stats.last_resolution_at || null,
          categoryStats: stats.category_stats || null,
          weeklyBrier: stats.weekly_brier || null,
        },
        latencyMs,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
          'X-Oracle-Latency': `${latencyMs}ms`,
        },
      }
    );
  } catch (error) {
    console.error('[Oracle API] Stats error:', error);
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
