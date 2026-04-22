import { NextRequest, NextResponse } from 'next/server';

/**
 * User Predictions API
 *
 * Fetches user predictions from the calibration program on devnet.
 * This endpoint wraps the /api/v2/calibration endpoint to provide
 * predictions data in the format expected by usePredictions hook.
 */

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Wallet address required' },
        { status: 400 }
      );
    }

    // Fetch from calibration endpoint
    const baseUrl = request.nextUrl.origin;
    const calibrationResponse = await fetch(`${baseUrl}/api/v2/calibration?wallet=${wallet}`);
    const calibrationData = await calibrationResponse.json();

    if (!calibrationData.success) {
      return NextResponse.json({
        success: false,
        error: calibrationData.error || 'Failed to fetch from calibration program',
      });
    }

    // If not initialized, return empty
    if (!calibrationData.data?.isInitialized) {
      return NextResponse.json({
        success: true,
        predictions: [],
        stats: null,
        message: 'Forecaster not initialized on-chain',
      });
    }

    // Transform predictions to expected format
    const predictions = (calibrationData.data.predictions || [])
      .slice(0, limit)
      .map((pred: any) => ({
        id: pred.pda,
        marketId: pred.marketIdText ?? pred.marketId,
        direction: (pred.direction === 'yes' || pred.direction === 'no')
          ? (pred.direction === 'yes' ? 'YES' : 'NO')
          : (pred.direction as 'YES' | 'NO'),
        probability: pred.predictedProbability,
        createdAt: typeof pred.committedAt === 'number'
          ? new Date(pred.committedAt * 1000).toISOString()
          : pred.committedAt,
        resolvedAt: typeof pred.resolvedAt === 'number'
          ? new Date(pred.resolvedAt * 1000).toISOString()
          : pred.resolvedAt,
        outcome: pred.outcome,
        brierScore: pred.brierScore,
        onChainTx: pred.txSignature || null,
        explorerUrl: pred.explorerUrl || (pred.txSignature ? `https://explorer.solana.com/tx/${pred.txSignature}?cluster=devnet` : null),
      }));

    // Transform stats
    const stats = calibrationData.data.stats
      ? {
          totalPredictions: calibrationData.data.stats.totalPredictions,
          resolvedPredictions: calibrationData.data.stats.resolvedPredictions,
          avgBrierScore: calibrationData.data.stats.avgBrierScore,
          accuracy: calibrationData.data.stats.accuracy,
          correctPredictions: calibrationData.data.stats.correctPredictions,
          streak: calibrationData.data.stats.streakCorrect,
          maxStreak: calibrationData.data.stats.maxStreakCorrect,
        }
      : null;

    return NextResponse.json({
      success: true,
      predictions,
      stats,
      forecasterPda: calibrationData.data.forecasterPda,
    });
  } catch (error) {
    console.error('[Predictions User API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch predictions',
      },
      { status: 500 }
    );
  }
}
