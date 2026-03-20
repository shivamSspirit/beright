/**
 * On-Chain Calibration API
 *
 * GET /api/v2/calibration?wallet=<address>  → Get on-chain Brier scores
 * GET /api/v2/calibration?leaderboard=true  → Top on-chain verified forecasters
 *
 * Demo Mode: Returns mock leaderboard data
 * Production Mode: Returns real on-chain data
 */

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { isDemo } from '../../../../lib/mode';
import { getDemoLeaderboard, getDemoForecasterByWallet } from '../../../../lib/demo/mockLeaderboard';

// Dynamic import to avoid build issues with Anchor
async function getOnChainStats(walletAddress: string) {
  try {
    const { getForecasterStats, deriveForecasterPda, CALIBRATION_PROGRAM_ID } = await import('../../../../lib/onchain/calibration');

    const pubkey = new PublicKey(walletAddress);
    const stats = await getForecasterStats(pubkey);

    if (!stats) {
      return null;
    }

    // Calculate tier based on Brier score and predictions
    let tier: 'superforecaster' | 'elite' | 'verified' | 'rookie' | 'unranked' = 'unranked';
    if (stats.resolvedPredictions < 10) tier = 'unranked';
    else if (stats.resolvedPredictions < 20) tier = 'rookie';
    else if (stats.avgBrierScore < 0.12 && stats.resolvedPredictions >= 100) tier = 'superforecaster';
    else if (stats.avgBrierScore < 0.18 && stats.resolvedPredictions >= 50) tier = 'elite';
    else if (stats.avgBrierScore < 0.25 && stats.resolvedPredictions >= 20) tier = 'verified';
    else tier = 'rookie';

    // Calculate grade
    let grade = 'F';
    if (stats.avgBrierScore < 0.1) grade = 'S';
    else if (stats.avgBrierScore < 0.15) grade = 'A';
    else if (stats.avgBrierScore < 0.2) grade = 'B';
    else if (stats.avgBrierScore < 0.25) grade = 'C';
    else if (stats.avgBrierScore < 0.3) grade = 'D';

    const [forecasterPda] = deriveForecasterPda(pubkey);

    return {
      walletAddress,
      forecasterPda: forecasterPda.toBase58(),
      programId: CALIBRATION_PROGRAM_ID.toBase58(),
      isOnChainVerified: true,
      brierScore: stats.avgBrierScore,
      accuracy: stats.accuracy,
      totalPredictions: stats.totalPredictions,
      resolvedPredictions: stats.resolvedPredictions,
      correctPredictions: stats.correctPredictions,
      streak: stats.streakCorrect,
      maxStreak: stats.maxStreakCorrect,
      marketsTraded: stats.marketsTraded,
      tier,
      grade,
      calibrationBuckets: stats.calibrationBuckets,
      lastPrediction: stats.lastPredictionTs.toISOString(),
      createdAt: stats.createdAt.toISOString(),
    };
  } catch (error) {
    console.error('[Calibration API] Error fetching on-chain stats:', error);
    return null;
  }
}

// Known on-chain forecasters (expand this list or fetch from Supabase)
const KNOWN_FORECASTERS = [
  { wallet: '8X7vZpVYitCw7mb2ny9TWzubebZGanqEEW1fMnn28Rzf', name: 'BeRightBot' },
  // Add more as they register
];

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get('wallet');
  const leaderboard = searchParams.get('leaderboard');

  // ============================================
  // DEMO MODE: Return mock data
  // ============================================
  if (isDemo()) {
    // Single wallet lookup in demo mode
    if (wallet) {
      const forecaster = getDemoForecasterByWallet(wallet);
      if (forecaster) {
        return NextResponse.json({
          success: true,
          data: {
            walletAddress: forecaster.walletAddress,
            forecasterPda: 'Demo' + forecaster.walletAddress.slice(4),
            programId: 'DemoProgramId11111111111111111111111111111',
            isOnChainVerified: true,
            brierScore: forecaster.brierScore,
            accuracy: forecaster.accuracy,
            totalPredictions: forecaster.predictions,
            resolvedPredictions: forecaster.resolvedPredictions,
            correctPredictions: Math.round(forecaster.resolvedPredictions * forecaster.accuracy / 100),
            streak: forecaster.streak,
            maxStreak: forecaster.maxStreak,
            tier: forecaster.tier,
            grade: forecaster.grade,
            displayName: forecaster.displayName,
            _demo: true,
          },
          meta: { source: 'demo', network: 'devnet' },
        });
      }
      return NextResponse.json({
        walletAddress: wallet,
        isOnChainVerified: false,
        message: 'No calibration data found (Demo Mode)',
        _demo: true,
      });
    }

    // Leaderboard in demo mode
    if (leaderboard === 'true') {
      const demoForecasters = getDemoLeaderboard(50);
      return NextResponse.json({
        success: true,
        data: {
          forecasters: demoForecasters.map(f => ({
            rank: f.rank,
            walletAddress: f.walletAddress,
            displayName: f.displayName,
            brierScore: f.brierScore,
            accuracy: f.accuracy,
            totalPredictions: f.predictions,
            resolvedPredictions: f.resolvedPredictions,
            streak: f.streak,
            tier: f.tier,
            grade: f.grade,
            onChainCount: f.onChainCount,
            isOnChainVerified: true,
            _demo: true,
          })),
          totalOnChain: demoForecasters.length,
          network: 'devnet',
        },
        meta: { source: 'demo', network: 'devnet' },
      });
    }

    // Default demo info
    return NextResponse.json({
      success: true,
      data: {
        programId: 'DemoProgramId11111111111111111111111111111',
        network: 'devnet',
        description: 'BeRight On-Chain Calibration Program (Demo Mode)',
        _demo: true,
      },
      meta: { source: 'demo', network: 'devnet' },
    });
  }

  // ============================================
  // PRODUCTION MODE: Real on-chain data
  // ============================================

  // Single wallet lookup
  if (wallet) {
    try {
      // Validate wallet address
      new PublicKey(wallet);
    } catch {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    const stats = await getOnChainStats(wallet);

    if (!stats) {
      return NextResponse.json({
        walletAddress: wallet,
        isOnChainVerified: false,
        message: 'No on-chain calibration data found for this wallet',
      });
    }

    return NextResponse.json({
      success: true,
      data: stats,
    });
  }

  // Leaderboard mode - fetch all known forecasters
  if (leaderboard === 'true') {
    const forecasters = [];

    for (const { wallet, name } of KNOWN_FORECASTERS) {
      const stats = await getOnChainStats(wallet);
      if (stats && stats.resolvedPredictions > 0) {
        forecasters.push({
          ...stats,
          displayName: name,
        });
      }
    }

    // Sort by Brier score (lower is better)
    forecasters.sort((a, b) => a.brierScore - b.brierScore);

    // Add ranks
    const ranked = forecasters.map((f, i) => ({
      ...f,
      rank: i + 1,
    }));

    return NextResponse.json({
      success: true,
      data: {
        forecasters: ranked,
        totalOnChain: ranked.length,
        network: process.env.CALIBRATION_USE_DEVNET !== 'false' ? 'devnet' : 'mainnet',
      },
    });
  }

  // Default: return info about the calibration program
  return NextResponse.json({
    success: true,
    data: {
      programId: 'GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ',
      network: process.env.CALIBRATION_USE_DEVNET !== 'false' ? 'devnet' : 'mainnet',
      description: 'BeRight On-Chain Calibration Program',
      usage: {
        singleWallet: '/api/v2/calibration?wallet=<address>',
        leaderboard: '/api/v2/calibration?leaderboard=true',
      },
    },
  });
}
