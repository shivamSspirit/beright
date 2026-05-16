/**
 * User Profile API Route
 * POST /api/users/profile - Get or create user profile (for web auth)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getOrCreateUserByWallet,
  getUserPredictions,
  getUserRank,
} from '../../../../lib/db';
import { getCalibrationStats, calculateStreak } from '../../../../skills/calibration';
import * as fs from 'fs';
import * as path from 'path';

// In-memory user store for when DB is not available
const userStorePath = path.join(process.cwd(), 'memory', 'users.json');

function getLocalUserStore(): Record<string, any> {
  try {
    if (fs.existsSync(userStorePath)) {
      return JSON.parse(fs.readFileSync(userStorePath, 'utf-8'));
    }
  } catch { /* ignore */ }
  return {};
}

function saveLocalUserStore(store: Record<string, any>) {
  const memoryDir = path.dirname(userStorePath);
  if (!fs.existsSync(memoryDir)) {
    fs.mkdirSync(memoryDir, { recursive: true });
  }
  fs.writeFileSync(userStorePath, JSON.stringify(store, null, 2));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { privyId, walletAddress, email, phone } = body;

    if (!privyId && !walletAddress) {
      return NextResponse.json(
        { error: 'Must provide privyId or walletAddress' },
        { status: 400 }
      );
    }

    // Check if we have database configured
    const hasDb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;

    if (hasDb && walletAddress) {
      // Get user from database
      const user = await getOrCreateUserByWallet(walletAddress);
      const rank = await getUserRank(user.id);
      const predictions = await getUserPredictions(user.id, { status: 'all' });
      const resolved = predictions.filter(p => p.outcome !== null);
      const brierScores = resolved.map(p => p.brier_score || 0);
      const avgBrier = brierScores.length > 0
        ? brierScores.reduce((a, b) => a + b, 0) / brierScores.length
        : 0;
      const correct = resolved.filter(p => (p.direction === 'YES') === p.outcome);

      return NextResponse.json({
        user: {
          id: user.id,
          walletAddress: user.wallet_address,
          email: email || null,
          phone: phone || null,
          telegramId: user.telegram_id,
          username: user.display_name || (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : null),
          avatar: user.avatar_url,
          totalPredictions: predictions.length,
          accuracy: resolved.length > 0 ? Math.round((correct.length / resolved.length) * 100) : 0,
          brierScore: avgBrier,
          streak: calculateStreak(predictions.map(p => ({
            outcome: p.outcome,
            direction: p.direction,
          }))),
          rank,
          joinedAt: user.created_at,
        },
      });
    } else {
      // Use local file-based storage
      const store = getLocalUserStore();
      const key = walletAddress || privyId;

      if (!store[key]) {
        store[key] = {
          id: key,
          walletAddress: walletAddress || null,
          privyId: privyId || null,
          email: email || null,
          phone: phone || null,
          telegramId: null,
          username: walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : null,
          avatar: null,
          totalPredictions: 0,
          accuracy: 0,
          brierScore: 0,
          streak: 0,
          rank: 0,
          joinedAt: new Date().toISOString(),
        };
        saveLocalUserStore(store);
      } else {
        // Update fields
        if (walletAddress) store[key].walletAddress = walletAddress;
        if (email) store[key].email = email;
        if (phone) store[key].phone = phone;
        saveLocalUserStore(store);
      }

      // Get stats from calibration
      const stats = getCalibrationStats();

      return NextResponse.json({
        user: {
          ...store[key],
          totalPredictions: stats.totalPredictions,
          accuracy: Math.round(stats.accuracy * 100),
          brierScore: stats.overallBrierScore,
          streak: stats.streak.current,
        },
      });
    }
  } catch (error) {
    console.error('Profile POST error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch/create profile', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
