/**
 * Composite Score API
 *
 * GET /api/v2/forecaster/:pubkey/composite-score
 *
 * Returns the weighted composite score with full breakdown.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCompositeScore } from '../../../../../../lib/platformImport';
import type { ScoreComponent } from '../../../../../../lib/platformImport';

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pubkey: string }> }
): Promise<NextResponse> {
  try {
    const { pubkey } = await params;
    const { searchParams } = new URL(req.url);

    // Validate pubkey format
    if (!pubkey || pubkey.length < 32 || pubkey.length > 64) {
      return NextResponse.json(
        { success: false, error: 'Invalid pubkey format' },
        { status: 400 }
      );
    }

    // Optional: force recalculate
    const forceRecalculate = searchParams.get('recalculate') === 'true';
    const maxAgeMinutes = forceRecalculate ? 0 : 60;

    const result = await getCompositeScore(pubkey, maxAgeMinutes);

    if (!result) {
      return NextResponse.json({
        success: true,
        data: {
          forecasterPubkey: pubkey,
          compositeScore: 0,
          tier: 'unranked',
          breakdown: [],
          totalPredictions: 0,
          message: 'No prediction data available',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        forecasterPubkey: pubkey,
        compositeScore: result.score,
        tier: result.tier,
        breakdown: result.breakdown.map((component: ScoreComponent) => ({
          source: component.source,
          displayName: component.displayName,
          weight: Math.round(component.weight * 100) / 100,
          normalizedScore: Math.round(component.normalizedScore * 10000) / 10000,
          predictionCount: component.predictionCount,
          isVerified: component.isVerified,
          // Convert normalized score back to Brier for display
          brierScore: Math.round((1 - component.normalizedScore) * 1000) / 1000,
        })),
        totalPredictions: result.totalPredictions,
        lastCalculatedAt: result.lastCalculatedAt,
        // Score as percentage for easier display
        scorePercent: Math.round(result.score / 100) / 10,
        // On-chain calibration metadata
        onChainVerified: result.onChainVerified ?? false,
        calibrationMultiplier: result.calibrationMultiplier ?? 1.0,
        streakBonus: result.streakBonus ?? 1.0,
        onChainMetrics: result.onChainMetrics ?? null,
      },
    });
  } catch (error) {
    console.error('[Composite Score API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v2/forecaster/:pubkey/composite-score
 *
 * Force recalculate composite score.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pubkey: string }> }
): Promise<NextResponse> {
  try {
    const { pubkey } = await params;

    // Validate pubkey format
    if (!pubkey || pubkey.length < 32 || pubkey.length > 64) {
      return NextResponse.json(
        { success: false, error: 'Invalid pubkey format' },
        { status: 400 }
      );
    }

    // Force recalculate by passing maxAge = 0
    const result = await getCompositeScore(pubkey, 0);

    if (!result) {
      return NextResponse.json({
        success: true,
        data: {
          forecasterPubkey: pubkey,
          compositeScore: 0,
          tier: 'unranked',
          breakdown: [],
          totalPredictions: 0,
          message: 'No prediction data available',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        forecasterPubkey: pubkey,
        compositeScore: result.score,
        tier: result.tier,
        breakdown: result.breakdown,
        totalPredictions: result.totalPredictions,
        lastCalculatedAt: result.lastCalculatedAt,
        message: 'Composite score recalculated',
      },
    });
  } catch (error) {
    console.error('[Composite Score API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
