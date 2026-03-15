/**
 * Leaderboard Handler
 *
 * View rankings based on calibration scores and trading performance.
 * Integrates with on-chain calibration program for verified Brier scores.
 *
 * @see docs/ADR-002-TELEGRAM-AS-GATEWAY.md
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import * as fs from 'fs';
import * as path from 'path';
import { getForecasterStats, ForecasterStats } from '../../onchain/calibration';
import { PublicKey } from '@solana/web3.js';

// =============================================================================
// TYPES
// =============================================================================

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username?: string;
  walletAddress?: string;
  brierScore: number;
  accuracy: number;
  predictions: number;
  resolvedPredictions: number;
  streak: number;
  grade: string;
  isCurrentUser: boolean;
  isOnChainVerified: boolean;
  tier: 'superforecaster' | 'elite' | 'verified' | 'rookie' | 'unranked';
}

export interface LeaderboardResult {
  timestamp: string;
  category: 'calibration' | 'trading' | 'overall';
  entries: LeaderboardEntry[];
  totalParticipants: number;
  onChainVerifiedCount: number;
  currentUserRank?: number;
  currentUserStats?: LeaderboardEntry;
  period: 'all-time' | 'monthly' | 'weekly';
}

// =============================================================================
// HELPERS
// =============================================================================

interface UserStats {
  id: string;
  username?: string;
  walletAddress?: string;
  brierScore: number;
  accuracy: number;
  predictions: number;
  resolvedPredictions: number;
  streak: number;
  streakType: 'win' | 'loss' | 'none';
  isOnChainVerified?: boolean;
}

function loadAllUserStats(): UserStats[] {
  // Load from memory/users.json if it exists
  try {
    const usersFile = path.join(process.cwd(), 'memory', 'users.json');
    if (fs.existsSync(usersFile)) {
      const users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
      return Object.entries(users).map(([id, data]: [string, any]) => ({
        id,
        username: data.username,
        brierScore: data.stats?.brierScore || 0.25,
        accuracy: data.stats?.accuracy || 0.5,
        predictions: data.stats?.totalPredictions || 0,
        resolvedPredictions: data.stats?.resolvedPredictions || 0,
        streak: data.stats?.streak || 0,
        streakType: data.stats?.streakType || 'none',
      }));
    }
  } catch (error) {
    console.error('[Leaderboard] Failed to load user stats:', error);
  }

  // Return mock data if no users file
  return [
    { id: 'user_1', username: 'SuperForecaster', brierScore: 0.12, accuracy: 0.78, predictions: 150, resolvedPredictions: 120, streak: 8, streakType: 'win' },
    { id: 'user_2', username: 'MarketWatcher', brierScore: 0.18, accuracy: 0.72, predictions: 89, resolvedPredictions: 75, streak: 3, streakType: 'win' },
    { id: 'user_3', username: 'ProbabilityPro', brierScore: 0.21, accuracy: 0.68, predictions: 200, resolvedPredictions: 180, streak: 2, streakType: 'loss' },
    { id: 'user_4', username: 'CalibrationKing', brierScore: 0.14, accuracy: 0.75, predictions: 65, resolvedPredictions: 55, streak: 5, streakType: 'win' },
    { id: 'user_5', username: 'EdgeFinder', brierScore: 0.23, accuracy: 0.65, predictions: 45, resolvedPredictions: 40, streak: 1, streakType: 'win' },
  ];
}

function getGrade(brierScore: number): string {
  if (brierScore < 0.1) return 'S';
  if (brierScore < 0.15) return 'A';
  if (brierScore < 0.2) return 'B';
  if (brierScore < 0.25) return 'C';
  if (brierScore < 0.3) return 'D';
  return 'F';
}

function getTier(brierScore: number, resolvedPredictions: number): LeaderboardEntry['tier'] {
  if (resolvedPredictions < 10) return 'unranked';
  if (resolvedPredictions < 20) return 'rookie';
  if (brierScore < 0.12 && resolvedPredictions >= 100) return 'superforecaster';
  if (brierScore < 0.18 && resolvedPredictions >= 50) return 'elite';
  if (brierScore < 0.25 && resolvedPredictions >= 20) return 'verified';
  return 'rookie';
}

/**
 * Fetch on-chain forecaster stats for known wallet addresses
 * This will be populated from Supabase or a registry of known forecasters
 */
async function fetchOnChainForecasters(): Promise<UserStats[]> {
  const onChainForecasters: UserStats[] = [];

  // Known forecaster wallet addresses (in production, fetch from Supabase)
  const knownWallets = [
    { address: '8X7vZpVYitCw7mb2ny9TWzubebZGanqEEW1fMnn28Rzf', username: 'BeRightBot' },
    // Add more known forecasters here
  ];

  for (const { address, username } of knownWallets) {
    try {
      const pubkey = new PublicKey(address);
      const stats = await getForecasterStats(pubkey);

      if (stats && stats.resolvedPredictions > 0) {
        onChainForecasters.push({
          id: address,
          username,
          walletAddress: address,
          brierScore: stats.avgBrierScore,
          accuracy: stats.accuracy,
          predictions: stats.totalPredictions,
          resolvedPredictions: stats.resolvedPredictions,
          streak: stats.streakCorrect,
          streakType: stats.streakCorrect > 0 ? 'win' : 'none',
          isOnChainVerified: true,
        });
      }
    } catch (error) {
      console.error(`[Leaderboard] Failed to fetch on-chain stats for ${address}:`, error);
    }
  }

  return onChainForecasters;
}

// =============================================================================
// HANDLER
// =============================================================================

export const leaderboardHandler: CommandHandler<LeaderboardResult> = {
  id: 'leaderboard',
  skillsUsed: ['calibration'],

  async execute(context: CommandContext): Promise<CommandResult<LeaderboardResult>> {
    const startTime = Date.now();

    try {
      // Get current user ID
      const currentUserId = context.userId || context.gatewayContext?.chatId?.toString() || 'anonymous';

      // Parse category from arguments
      const categoryArg = context.arguments?.[0]?.toLowerCase();
      const category: 'calibration' | 'trading' | 'overall' =
        categoryArg === 'trading' ? 'trading' :
        categoryArg === 'overall' ? 'overall' : 'calibration';

      // Load local user stats (fallback/additional data)
      const localStats = loadAllUserStats();

      // Fetch on-chain verified forecasters
      let onChainStats: UserStats[] = [];
      try {
        onChainStats = await fetchOnChainForecasters();
        console.log(`[Leaderboard] Fetched ${onChainStats.length} on-chain forecasters`);
      } catch (error) {
        console.error('[Leaderboard] Failed to fetch on-chain data, using local only:', error);
      }

      // Merge: on-chain takes priority, then local
      const allStatsMap = new Map<string, UserStats>();

      // Add local stats first
      for (const user of localStats) {
        allStatsMap.set(user.id, { ...user, isOnChainVerified: false });
      }

      // Override with on-chain stats (they are authoritative)
      for (const user of onChainStats) {
        allStatsMap.set(user.id, user);
      }

      const allStats = Array.from(allStatsMap.values());

      // Filter to users with enough data (at least 1 resolved for on-chain, 5 for local)
      const eligibleUsers = allStats.filter(u =>
        u.isOnChainVerified ? u.resolvedPredictions >= 1 : u.resolvedPredictions >= 5
      );

      // Sort by Brier score (lower is better), on-chain verified first
      const sorted = [...eligibleUsers].sort((a, b) => {
        // On-chain verified users get priority
        if (a.isOnChainVerified && !b.isOnChainVerified) return -1;
        if (!a.isOnChainVerified && b.isOnChainVerified) return 1;
        return a.brierScore - b.brierScore;
      });

      // Map to leaderboard entries
      const entries: LeaderboardEntry[] = sorted.slice(0, 20).map((user, index) => ({
        rank: index + 1,
        userId: user.id,
        username: user.username,
        walletAddress: user.walletAddress,
        brierScore: user.brierScore,
        accuracy: user.accuracy,
        predictions: user.predictions,
        resolvedPredictions: user.resolvedPredictions,
        streak: user.streak,
        grade: getGrade(user.brierScore),
        isCurrentUser: user.id === currentUserId,
        isOnChainVerified: user.isOnChainVerified || false,
        tier: getTier(user.brierScore, user.resolvedPredictions),
      }));

      // Find current user's rank
      const currentUserIndex = sorted.findIndex(u => u.id === currentUserId);
      const currentUserRank = currentUserIndex >= 0 ? currentUserIndex + 1 : undefined;

      // Get current user's stats if not in top 20
      let currentUserStats: LeaderboardEntry | undefined;
      if (currentUserRank && currentUserRank > 20) {
        const user = sorted[currentUserIndex];
        currentUserStats = {
          rank: currentUserRank,
          userId: user.id,
          username: user.username,
          walletAddress: user.walletAddress,
          brierScore: user.brierScore,
          accuracy: user.accuracy,
          predictions: user.predictions,
          resolvedPredictions: user.resolvedPredictions,
          streak: user.streak,
          grade: getGrade(user.brierScore),
          isCurrentUser: true,
          isOnChainVerified: user.isOnChainVerified || false,
          tier: getTier(user.brierScore, user.resolvedPredictions),
        };
      }

      const result: LeaderboardResult = {
        timestamp: new Date().toISOString(),
        category,
        entries,
        totalParticipants: eligibleUsers.length,
        onChainVerifiedCount: entries.filter(e => e.isOnChainVerified).length,
        currentUserRank,
        currentUserStats,
        period: 'all-time',
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'leaderboard',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['calibration'],
          apiCallsMade: 0,
        },
        hints: {
          mood: 'NEUTRAL',
          suggestedActions: ['/calibration', '/me'],
        },
      };
    } catch (error) {
      console.error('[LeaderboardHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'LEADERBOARD_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch leaderboard',
          retryable: true,
          recoveryAction: 'Try again in a moment',
        },
        meta: {
          handlerId: 'leaderboard',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['calibration'],
          apiCallsMade: 0,
        },
        hints: {
          mood: 'ERROR',
        },
      };
    }
  },
};

// =============================================================================
// AUTO-REGISTER
// =============================================================================

registerHandler(leaderboardHandler);

export default leaderboardHandler;
