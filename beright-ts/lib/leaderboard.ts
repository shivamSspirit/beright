/**
 * Multi-User Leaderboard for BeRight Protocol
 * Tracks forecaster performance across all users
 */

import * as fs from 'fs';
import * as path from 'path';
import { getAllUsers, UserIdentity, updateUserStats } from './identity';

const MEMORY_DIR = path.join(process.cwd(), 'memory');
const USER_PREDICTIONS_FILE = path.join(MEMORY_DIR, 'user-predictions.json');

// ============================================
// TYPES
// ============================================

export interface UserPrediction {
  id: string;
  telegramId: string;
  question: string;
  predictedProbability: number;  // 0-1
  direction: 'YES' | 'NO';
  reasoning: string;
  createdAt: string;
  resolvedAt?: string;
  outcome?: boolean;
  brierScore?: number;
  platform?: string;
}

export interface LeaderboardEntry {
  rank: number;
  telegramId: string;
  username?: string;
  brierScore: number;
  accuracy: number;
  totalPredictions: number;
  resolvedPredictions: number;
  streak: number;
  streakType: 'win' | 'loss' | 'none';
  grade: { grade: string; emoji: string; label: string };
}

export interface UserStats {
  brierScore: number;
  accuracy: number;
  totalPredictions: number;
  resolvedPredictions: number;
  streak: number;
  streakType: 'win' | 'loss' | 'none';
}

// ============================================
// STORAGE
// ============================================

function loadUserPredictions(): Record<string, UserPrediction[]> {
  try {
    if (fs.existsSync(USER_PREDICTIONS_FILE)) {
      return JSON.parse(fs.readFileSync(USER_PREDICTIONS_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Error loading user predictions:', error);
  }
  return {};
}

function saveUserPredictions(data: Record<string, UserPrediction[]>): void {
  try {
    if (!fs.existsSync(MEMORY_DIR)) {
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
    }
    fs.writeFileSync(USER_PREDICTIONS_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving user predictions:', error);
  }
}

// ============================================
// PREDICTION TRACKING
// ============================================

/**
 * Add a prediction for a specific user
 */
export function addUserPrediction(
  telegramId: string,
  question: string,
  probability: number,
  direction: 'YES' | 'NO',
  reasoning: string,
  platform?: string
): UserPrediction {
  const data = loadUserPredictions();

  if (!data[telegramId]) {
    data[telegramId] = [];
  }

  const prediction: UserPrediction = {
    id: `upred_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    telegramId,
    question,
    predictedProbability: Math.min(1, Math.max(0, probability)),
    direction,
    reasoning,
    createdAt: new Date().toISOString(),
    platform,
  };

  data[telegramId].push(prediction);
  saveUserPredictions(data);

  // Update user stats
  updateUserStats(telegramId, {
    totalPredictions: data[telegramId].length,
  });

  return prediction;
}

/**
 * Resolve a user's prediction
 */
export function resolveUserPrediction(
  telegramId: string,
  predictionId: string,
  outcome: boolean
): UserPrediction | null {
  const data = loadUserPredictions();
  const userPredictions = data[telegramId];

  if (!userPredictions) return null;

  const index = userPredictions.findIndex(p => p.id === predictionId);
  if (index === -1) return null;

  const prediction = userPredictions[index];
  prediction.outcome = outcome;
  prediction.resolvedAt = new Date().toISOString();

  // Calculate Brier score
  const probForYes = prediction.direction === 'YES'
    ? prediction.predictedProbability
    : 1 - prediction.predictedProbability;
  prediction.brierScore = Math.pow(probForYes - (outcome ? 1 : 0), 2);

  data[telegramId][index] = prediction;
  saveUserPredictions(data);

  return prediction;
}

/**
 * Get predictions for a specific user
 */
export function getUserPredictions(telegramId: string): UserPrediction[] {
  const data = loadUserPredictions();
  return data[telegramId] || [];
}

/**
 * Get pending predictions for a user
 */
export function getUserPendingPredictions(telegramId: string): UserPrediction[] {
  return getUserPredictions(telegramId).filter(p => p.outcome === undefined);
}

// ============================================
// STATS CALCULATION
// ============================================

/**
 * Calculate stats for a specific user
 */
export function calculateUserStats(telegramId: string): UserStats {
  const predictions = getUserPredictions(telegramId);
  const resolved = predictions.filter(p => p.outcome !== undefined);

  // Brier score
  const brierScores = resolved.map(p => p.brierScore || 0);
  const brierScore = brierScores.length > 0
    ? brierScores.reduce((a, b) => a + b, 0) / brierScores.length
    : 0;

  // Accuracy
  const correct = resolved.filter(p =>
    (p.direction === 'YES') === p.outcome
  );
  const accuracy = resolved.length > 0
    ? correct.length / resolved.length
    : 0;

  // Streak
  let streak = 0;
  let streakType: 'win' | 'loss' | 'none' = 'none';

  const sortedResolved = [...resolved].sort(
    (a, b) => new Date(b.resolvedAt || 0).getTime() - new Date(a.resolvedAt || 0).getTime()
  );

  for (const p of sortedResolved) {
    const isWin = (p.direction === 'YES') === p.outcome;
    if (streak === 0) {
      streakType = isWin ? 'win' : 'loss';
      streak = 1;
    } else if ((streakType === 'win' && isWin) || (streakType === 'loss' && !isWin)) {
      streak++;
    } else {
      break;
    }
  }

  return {
    brierScore,
    accuracy,
    totalPredictions: predictions.length,
    resolvedPredictions: resolved.length,
    streak,
    streakType,
  };
}

/**
 * Get grade based on Brier score
 */
function getGrade(brierScore: number, resolvedCount: number): { grade: string; emoji: string; label: string } {
  if (resolvedCount === 0) return { grade: '-', emoji: '🆕', label: 'New Forecaster' };
  if (resolvedCount < 5) return { grade: '?', emoji: '📊', label: 'Building Track Record' };
  if (brierScore < 0.1) return { grade: 'S', emoji: '🏆', label: 'Superforecaster Elite' };
  if (brierScore < 0.15) return { grade: 'A', emoji: '⭐', label: 'Superforecaster' };
  if (brierScore < 0.2) return { grade: 'B', emoji: '✨', label: 'Very Good' };
  if (brierScore < 0.25) return { grade: 'C', emoji: '👍', label: 'Above Average' };
  if (brierScore < 0.3) return { grade: 'D', emoji: '📈', label: 'Average' };
  return { grade: 'F', emoji: '📉', label: 'Needs Work' };
}

// ============================================
// LEADERBOARD
// ============================================

/**
 * Get the global leaderboard
 */
export function getLeaderboard(limit = 10): LeaderboardEntry[] {
  const data = loadUserPredictions();
  const users = getAllUsers();

  // Calculate stats for all users with predictions
  const entries: LeaderboardEntry[] = [];

  for (const telegramId of Object.keys(data)) {
    const stats = calculateUserStats(telegramId);

    // Only include users with at least 1 resolved prediction
    if (stats.resolvedPredictions === 0) continue;

    // Find user info
    const user = users.find(u => u.telegramId === telegramId);

    entries.push({
      rank: 0, // Will be set after sorting
      telegramId,
      username: user?.telegramUsername,
      brierScore: stats.brierScore,
      accuracy: stats.accuracy,
      totalPredictions: stats.totalPredictions,
      resolvedPredictions: stats.resolvedPredictions,
      streak: stats.streak,
      streakType: stats.streakType,
      grade: getGrade(stats.brierScore, stats.resolvedPredictions),
    });
  }

  // Sort by Brier score (lower is better), with tiebreaker on prediction count
  entries.sort((a, b) => {
    // Users with fewer than 5 predictions go to bottom
    if (a.resolvedPredictions >= 5 && b.resolvedPredictions < 5) return -1;
    if (a.resolvedPredictions < 5 && b.resolvedPredictions >= 5) return 1;

    // Sort by Brier score
    if (a.brierScore !== b.brierScore) return a.brierScore - b.brierScore;

    // Tiebreaker: more predictions = higher rank
    return b.resolvedPredictions - a.resolvedPredictions;
  });

  // Assign ranks
  for (let i = 0; i < entries.length; i++) {
    entries[i].rank = i + 1;
  }

  return entries.slice(0, limit);
}

/**
 * Get a user's rank on the leaderboard
 */
export function getUserRank(telegramId: string): number | null {
  const leaderboard = getLeaderboard(100); // Get more to find user
  const entry = leaderboard.find(e => e.telegramId === telegramId);
  return entry?.rank || null;
}

/**
 * Format leaderboard for Telegram
 */
export function formatLeaderboard(entries: LeaderboardEntry[]): string {
  if (entries.length === 0) {
    return `
🏆 *FORECASTER LEADERBOARD*
${'─'.repeat(35)}

No forecasters ranked yet.

Make predictions to join the leaderboard:
/predict <question> <probability> YES|NO

Min 5 resolved predictions to rank.
`;
  }

  let text = `
🏆 *FORECASTER LEADERBOARD*
${'─'.repeat(35)}

`;

  for (const entry of entries) {
    const rankEmoji = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`;
    const username = entry.username ? `@${entry.username}` : `User ${entry.telegramId.slice(-4)}`;
    const streakStr = entry.streak > 2 ? ` ${entry.streakType === 'win' ? '🔥' : '❄️'}${entry.streak}` : '';

    text += `${rankEmoji} ${entry.grade.emoji} *${username}*${streakStr}\n`;
    text += `   Brier: ${entry.brierScore.toFixed(3)} | Acc: ${(entry.accuracy * 100).toFixed(0)}% | n=${entry.resolvedPredictions}\n\n`;
  }

  text += `
${'─'.repeat(35)}
*Brier Score* (lower = better)
< 0.15 = Superforecaster
< 0.25 = Above Average
= 0.25 = Random Guessing

/me - Your stats | /calibration - Full report
`;

  return text;
}

/**
 * Get leaderboard stats summary
 */
export function getLeaderboardStats(): {
  totalForecasters: number;
  totalPredictions: number;
  totalResolved: number;
  avgBrierScore: number;
  topScore: number;
} {
  const data = loadUserPredictions();

  let totalPredictions = 0;
  let totalResolved = 0;
  let brierSum = 0;
  let brierCount = 0;
  let topScore = 1;

  for (const predictions of Object.values(data)) {
    totalPredictions += predictions.length;

    for (const p of predictions) {
      if (p.outcome !== undefined) {
        totalResolved++;
        if (p.brierScore !== undefined) {
          brierSum += p.brierScore;
          brierCount++;
          if (p.brierScore < topScore) topScore = p.brierScore;
        }
      }
    }
  }

  return {
    totalForecasters: Object.keys(data).length,
    totalPredictions,
    totalResolved,
    avgBrierScore: brierCount > 0 ? brierSum / brierCount : 0,
    topScore: brierCount > 0 ? topScore : 0,
  };
}
