/**
 * Leaderboard API Route
 * GET /api/leaderboard - Get top forecasters
 */

import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering (uses request.url)
export const dynamic = 'force-dynamic';
import { getLeaderboard, getUserRank } from '../../../lib/db';
import { getCalibrationStats } from '../../../skills/calibration';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const userId = searchParams.get('userId');

    // Check if we have database configured
    const hasDb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;

    if (hasDb) {
      // Use database
      const leaderboard = await getLeaderboard(limit);

      let userRank = null;
      let userEntry = null;
      if (userId) {
        userRank = await getUserRank(userId);
        userEntry = leaderboard.find(e => e.user_id === userId);
      }

      return NextResponse.json({
        count: leaderboard.length,
        leaderboard: leaderboard.map((entry, index) => ({
          rank: entry.rank || index + 1,
          userId: entry.user_id,
          displayName: entry.display_name || 'Anonymous',
          walletAddress: entry.wallet_address ? `${entry.wallet_address.slice(0, 6)}...${entry.wallet_address.slice(-4)}` : null,
          brierScore: entry.brier_score,
          accuracy: entry.accuracy,
          predictions: entry.resolved_predictions,
          streak: entry.current_streak,
          streakType: entry.streak_type,
        })),
        userRank,
        userEntry: userEntry ? {
          rank: userEntry.rank,
          brierScore: userEntry.brier_score,
          accuracy: userEntry.accuracy,
          predictions: userEntry.resolved_predictions,
        } : null,
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      });
    } else {
      // Local mode — show real user stats only (no fake users)
      const stats = getCalibrationStats();

      const leaderboard: any[] = [];

      // Only show real user if they have predictions
      if (stats.resolvedPredictions > 0) {
        leaderboard.push({
          rank: 1,
          displayName: 'You (Agent)',
          brierScore: stats.overallBrierScore,
          accuracy: stats.accuracy,
          predictions: stats.resolvedPredictions,
          streak: stats.streak.current,
          isCurrentUser: true,
        });
      }

      return NextResponse.json({
        count: leaderboard.length,
        leaderboard: leaderboard.slice(0, limit),
        userRank: leaderboard.length > 0 ? 1 : null,
        userStats: {
          brierScore: stats.overallBrierScore,
          accuracy: stats.accuracy,
          predictions: stats.resolvedPredictions,
          streak: stats.streak.current,
        },
        note: leaderboard.length === 0
          ? 'No predictions yet. Make predictions to appear on the leaderboard.'
          : 'Local mode — connect to Supabase for multi-user rankings',
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      });
    }
  } catch (error) {
    console.error('Leaderboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
