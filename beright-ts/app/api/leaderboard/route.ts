/**
 * Leaderboard API (V3)
 *
 * Keeps the legacy `/api/leaderboard` path stable for the web app,
 * but serves V3-native scores (vaultScore/tier/status) derived from
 * the on-chain calibration program.
 *
 * Source of truth for native predictions: `/api/v2/calibration`.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type LeaderboardEntryV3 = {
  rank: number;
  displayName: string;
  walletAddress: string;
  brierScore: number;
  accuracy: number;
  predictions: number;
  streak: number;
  onChainCount?: number;

  // V3
  scoreVersion: 'v3';
  scoreEpoch: string;
  vaultScore: number;
  confidence: number;
  status: string;
  tier: string;
};

function normalizeAccuracy(value: unknown): number {
  const v = typeof value === 'number' ? value : 0;
  return v <= 1 ? Number((v * 100).toFixed(1)) : Number(v.toFixed(1));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(req.url);
  const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '100', 10)));
  const wallet = searchParams.get('wallet');

  try {
    const res = await fetch(`${origin}/api/v2/calibration?leaderboard=true`, {
      headers: req.headers,
      cache: 'no-store',
    });
    const payload = await res.json();

    const forecasters: any[] = payload?.data?.forecasters ?? [];

    const leaderboard: LeaderboardEntryV3[] = forecasters
      .filter((row) => row?.walletAddress)
      .slice(0, limit)
      .map((row, index) => ({
        rank: row.rank ?? index + 1,
        displayName: row.displayName ?? row.walletAddress,
        walletAddress: row.walletAddress,
        brierScore: typeof row.brierScore === 'number' ? row.brierScore : 0,
        accuracy: normalizeAccuracy(row.accuracy),
        predictions: typeof row.totalPredictions === 'number' ? row.totalPredictions : 0,
        streak: typeof row.streak === 'number' ? row.streak : 0,
        onChainCount: typeof row.resolvedPredictions === 'number' ? row.resolvedPredictions : undefined,

        scoreVersion: 'v3',
        scoreEpoch: row.scoreEpoch ?? new Date().toISOString(),
        vaultScore: typeof row.vaultScore === 'number' ? row.vaultScore : 0,
        confidence: typeof row.confidence === 'number' ? row.confidence : 0,
        status: row.status ?? 'Restricted',
        tier: row.tier ?? 'restricted',
      }));

    const userRank = wallet
      ? (leaderboard.find((entry) => entry.walletAddress === wallet)?.rank ?? null)
      : null;

    return NextResponse.json({
      count: leaderboard.length,
      leaderboard,
      userRank,
      note: 'V3 leaderboard derived from on-chain calibration data.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        count: 0,
        leaderboard: [],
        userRank: null,
        error: error instanceof Error ? error.message : 'Failed to fetch leaderboard',
      },
      { status: 500 },
    );
  }
}
