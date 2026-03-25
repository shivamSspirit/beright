/**
 * On-Chain Prediction Recording API
 * POST /api/v2/predictions/record - Record a prediction to the calibration program
 *
 * Records predictions on-chain (devnet in demo mode, mainnet in production).
 * Uses the server wallet as the forecaster authority.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getModeFromHeaders, getNetworkFromHeaders } from '../../../../../lib/mode';

// Dynamic import to avoid build issues with Anchor
async function recordOnChain(
  marketId: string,
  probability: number,
  direction: 'YES' | 'NO',
  userWallet: string
) {
  try {
    const {
      getForecasterStats,
      CALIBRATION_PROGRAM_ID,
    } = await import('../../../../../lib/onchain/calibration');
    const { commitPredictionWithCalibration } = await import('../../../../../lib/onchain/commit');

    // Use the combined function that does both memo + calibration
    console.log('[RecordOnChain] Recording prediction:', { marketId, probability, direction, userWallet });

    const result = await commitPredictionWithCalibration(
      userWallet,
      marketId,
      probability,
      direction,
      0 // category
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to commit prediction');
    }

    console.log('[RecordOnChain] Memo tx:', result.memoTx);
    console.log('[RecordOnChain] Calibration tx:', result.calibrationTx);

    // Get forecaster stats
    const stats = await getForecasterStats();

    return {
      success: true,
      memoTx: result.memoTx,
      calibrationTx: result.calibrationTx,
      programId: CALIBRATION_PROGRAM_ID.toBase58(),
      forecasterStats: stats,
      explorerUrl: `https://solscan.io/tx/${result.calibrationTx}?cluster=devnet`,
    };
  } catch (error) {
    console.error('[RecordOnChain] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      marketId,
      question,
      platform,
      probability,
      direction,
      userWallet,
    } = body;

    // Validate required fields
    if (!marketId || probability === undefined || !direction) {
      return NextResponse.json(
        { error: 'Missing required fields: marketId, probability, direction' },
        { status: 400 }
      );
    }

    if (probability < 0 || probability > 1) {
      return NextResponse.json(
        { error: 'Probability must be between 0 and 1' },
        { status: 400 }
      );
    }

    if (direction !== 'YES' && direction !== 'NO') {
      return NextResponse.json(
        { error: 'Direction must be YES or NO' },
        { status: 400 }
      );
    }

    const mode = getModeFromHeaders(request.headers);
    const network = getNetworkFromHeaders(request.headers);

    console.log(`[Predictions/Record] Mode: ${mode}, Network: ${network}`);
    console.log(`[Predictions/Record] Recording: ${direction} on ${marketId} at ${probability}`);

    // Record on-chain (both demo and production - just different networks)
    const result = await recordOnChain(
      marketId,
      probability,
      direction,
      userWallet || 'anonymous'
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          meta: { mode, network },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      prediction: {
        id: `${marketId}-${Date.now()}`,
        marketId,
        question,
        platform,
        probability,
        direction,
        userWallet,
        createdAt: new Date().toISOString(),
      },
      onChain: {
        memoTx: result.memoTx,
        calibrationTx: result.calibrationTx,
        programId: result.programId,
        explorerUrl: result.explorerUrl,
        network,
      },
      forecasterStats: result.forecasterStats,
      meta: { mode, network },
    }, { status: 201 });

  } catch (error) {
    console.error('[Predictions/Record] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
