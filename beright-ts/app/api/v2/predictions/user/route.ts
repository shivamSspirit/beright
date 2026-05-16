/**
 * User On-Chain Predictions API
 * GET /api/v2/predictions/user?wallet=<address> - Get user's on-chain predictions
 *
 * Fetches predictions from the calibration program.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getModeFromHeaders, getNetworkFromHeaders } from '../../../../../lib/mode';

// Dynamic import to avoid build issues with Anchor
async function fetchOnChainPredictions(walletAddress?: string, limit: number = 50) {
  try {
    const {
      getForecasterPredictions,
      getForecasterStats,
      CALIBRATION_PROGRAM_ID,
    } = await import('../../../../../lib/onchain/calibration');

    // Convert wallet address string to PublicKey if provided
    const forecasterPubkey = walletAddress ? new PublicKey(walletAddress) : undefined;

    // Get predictions from the calibration program for the specified wallet
    const predictions = await getForecasterPredictions(forecasterPubkey, limit);

    // Get forecaster stats for the specified wallet
    const stats = await getForecasterStats(forecasterPubkey);

    // Transform predictions to match frontend expectations
    const formattedPredictions = predictions.map(({ pda, record }) => ({
      id: pda.toBase58(),
      marketId: record.marketId,
      probability: record.predictedProbability,
      direction: record.direction,
      createdAt: record.committedAt.toISOString(),
      resolvedAt: record.resolvedAt?.toISOString() || null,
      outcome: record.outcome,
      brierScore: record.brierScore,
      onChainTx: record.memoTxSignature,
      explorerUrl: `https://solscan.io/account/${pda.toBase58()}?cluster=devnet`,
    }));

    return {
      success: true,
      predictions: formattedPredictions,
      stats: stats ? {
        totalPredictions: stats.totalPredictions,
        resolvedPredictions: stats.resolvedPredictions,
        avgBrierScore: stats.avgBrierScore,
        accuracy: stats.accuracy,
        correctPredictions: stats.correctPredictions,
        streak: stats.streakCorrect,
        maxStreak: stats.maxStreakCorrect,
      } : null,
      programId: CALIBRATION_PROGRAM_ID.toBase58(),
    };
  } catch (error) {
    console.error('[FetchOnChainPredictions] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      predictions: [],
      stats: null,
    };
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');
    const limit = parseInt(searchParams.get('limit') || '50');

    const mode = getModeFromHeaders(request.headers);
    const network = getNetworkFromHeaders(request.headers);

    console.log(`[Predictions/User] Mode: ${mode}, Network: ${network}, Wallet: ${wallet || 'server'}`);

    // Validate wallet if provided
    if (wallet) {
      try {
        new PublicKey(wallet);
      } catch {
        return NextResponse.json(
          { error: 'Invalid wallet address' },
          { status: 400 }
        );
      }
    }

    // Fetch on-chain predictions
    const result = await fetchOnChainPredictions(wallet || undefined, limit);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
        predictions: [],
        stats: null,
        meta: { mode, network },
      });
    }

    return NextResponse.json({
      success: true,
      predictions: result.predictions,
      stats: result.stats,
      programId: result.programId,
      meta: { mode, network },
    });

  } catch (error) {
    console.error('[Predictions/User] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        predictions: [],
        stats: null,
      },
      { status: 500 }
    );
  }
}
