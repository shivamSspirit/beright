/**
 * Copy Trading / Signal Sharing for BeRight Protocol
 * Allows users to follow top forecasters and get their signals
 *
 * Features:
 * - Follow/unfollow forecasters
 * - Get alerts when followed users predict
 * - View signals from top performers
 * - Track copy trading performance
 */

import * as fs from 'fs';
import * as path from 'path';
import { SkillResponse } from '../types/index';
import { getLeaderboard, getUserPredictions, calculateUserStats, LeaderboardEntry, UserPrediction } from '../lib/leaderboard';
import { getAllUsers, getUserByTelegram } from '../lib/identity';
import { formatPct } from './utils';

const MEMORY_DIR = path.join(process.cwd(), 'memory');
const FOLLOWS_FILE = path.join(MEMORY_DIR, 'follows.json');

// ============================================
// TYPES
// ============================================

interface FollowRelation {
  followerId: string;      // Telegram ID of follower
  followingId: string;     // Telegram ID of person being followed
  createdAt: string;
  copiedPredictions: number;
  performanceGain: number; // Improvement from copying
}

interface Signal {
  id: string;
  forecasterTelegramId: string;
  forecasterUsername?: string;
  forecasterGrade: string;
  prediction: UserPrediction;
  createdAt: string;
}

// ============================================
// STORAGE
// ============================================

function loadFollows(): FollowRelation[] {
  try {
    if (fs.existsSync(FOLLOWS_FILE)) {
      return JSON.parse(fs.readFileSync(FOLLOWS_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Error loading follows:', error);
  }
  return [];
}

function saveFollows(follows: FollowRelation[]): void {
  try {
    if (!fs.existsSync(MEMORY_DIR)) {
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
    }
    fs.writeFileSync(FOLLOWS_FILE, JSON.stringify(follows, null, 2));
  } catch (error) {
    console.error('Error saving follows:', error);
  }
}

// ============================================
// FOLLOW MANAGEMENT
// ============================================

/**
 * Follow a forecaster
 */
export function follow(followerId: string, targetUsername: string): { success: boolean; message: string } {
  // Find the target user by username
  const users = getAllUsers();
  const target = users.find(u =>
    u.telegramUsername?.toLowerCase() === targetUsername.toLowerCase().replace('@', '')
  );

  if (!target || !target.telegramId) {
    return { success: false, message: `User @${targetUsername} not found. They need to use BeRight first.` };
  }

  // Check if already following
  const follows = loadFollows();
  const existing = follows.find(f => f.followerId === followerId && f.followingId === target.telegramId);

  if (existing) {
    return { success: false, message: `You're already following @${targetUsername}` };
  }

  // Check the target's stats
  const stats = calculateUserStats(target.telegramId);
  if (stats.resolvedPredictions < 3) {
    return {
      success: false,
      message: `@${targetUsername} needs at least 3 resolved predictions to be followed.`
    };
  }

  // Add follow relationship
  follows.push({
    followerId,
    followingId: target.telegramId,
    createdAt: new Date().toISOString(),
    copiedPredictions: 0,
    performanceGain: 0,
  });

  saveFollows(follows);

  return {
    success: true,
    message: `Now following @${targetUsername} (Brier: ${stats.brierScore.toFixed(3)}, ${stats.resolvedPredictions} predictions)`
  };
}

/**
 * Unfollow a forecaster
 */
export function unfollow(followerId: string, targetUsername: string): boolean {
  const users = getAllUsers();
  const target = users.find(u =>
    u.telegramUsername?.toLowerCase() === targetUsername.toLowerCase().replace('@', '')
  );

  if (!target) return false;

  const follows = loadFollows();
  const index = follows.findIndex(f => f.followerId === followerId && f.followingId === target.telegramId);

  if (index === -1) return false;

  follows.splice(index, 1);
  saveFollows(follows);
  return true;
}

/**
 * Get users that a person is following
 */
export function getFollowing(telegramId: string): string[] {
  const follows = loadFollows();
  return follows
    .filter(f => f.followerId === telegramId)
    .map(f => f.followingId);
}

/**
 * Get followers of a user
 */
export function getFollowers(telegramId: string): string[] {
  const follows = loadFollows();
  return follows
    .filter(f => f.followingId === telegramId)
    .map(f => f.followerId);
}

// ============================================
// SIGNALS
// ============================================

/**
 * Get recent signals from followed forecasters
 */
export function getSignals(telegramId: string, limit = 10): Signal[] {
  const following = getFollowing(telegramId);
  const users = getAllUsers();
  const signals: Signal[] = [];

  for (const followedId of following) {
    const predictions = getUserPredictions(followedId);
    const stats = calculateUserStats(followedId);
    const user = users.find(u => u.telegramId === followedId);

    // Get recent predictions (last 7 days)
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    for (const pred of predictions) {
      if (new Date(pred.createdAt).getTime() > weekAgo) {
        signals.push({
          id: pred.id,
          forecasterTelegramId: followedId,
          forecasterUsername: user?.telegramUsername,
          forecasterGrade: getGradeEmoji(stats.brierScore, stats.resolvedPredictions),
          prediction: pred,
          createdAt: pred.createdAt,
        });
      }
    }
  }

  // Sort by date, newest first
  signals.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return signals.slice(0, limit);
}

/**
 * Get signals from top forecasters (public signals)
 */
export function getTopSignals(limit = 10): Signal[] {
  const leaderboard = getLeaderboard(5); // Top 5 forecasters
  const users = getAllUsers();
  const signals: Signal[] = [];

  for (const entry of leaderboard) {
    const predictions = getUserPredictions(entry.telegramId);

    // Get recent predictions (last 7 days)
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    for (const pred of predictions) {
      if (new Date(pred.createdAt).getTime() > weekAgo) {
        signals.push({
          id: pred.id,
          forecasterTelegramId: entry.telegramId,
          forecasterUsername: entry.username,
          forecasterGrade: entry.grade.emoji,
          prediction: pred,
          createdAt: pred.createdAt,
        });
      }
    }
  }

  // Sort by date, newest first
  signals.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return signals.slice(0, limit);
}

function getGradeEmoji(brierScore: number, resolvedCount: number): string {
  if (resolvedCount < 3) return '🆕';
  if (brierScore < 0.1) return '🏆';
  if (brierScore < 0.15) return '⭐';
  if (brierScore < 0.2) return '✨';
  if (brierScore < 0.25) return '👍';
  return '📊';
}

// ============================================
// TELEGRAM HANDLERS
// ============================================

/**
 * Handle /follow command
 */
export function handleFollow(text: string, telegramId: string): SkillResponse {
  const match = text.match(/\/follow\s+@?(\w+)/i);

  if (!match) {
    // Show who they're following
    const following = getFollowing(telegramId);
    const users = getAllUsers();

    if (following.length === 0) {
      return {
        text: `
📡 *COPY TRADING*
${'─'.repeat(35)}

You're not following anyone yet.

/follow @username - Follow a forecaster
/signals - View signals from top forecasters
/leaderboard - Find top performers

When you follow someone, you'll see their predictions in /signals
`,
        mood: 'EDUCATIONAL',
      };
    }

    let text = `
📡 *FOLLOWING* (${following.length})
${'─'.repeat(35)}

`;

    for (const followedId of following) {
      const user = users.find(u => u.telegramId === followedId);
      const stats = calculateUserStats(followedId);
      const emoji = getGradeEmoji(stats.brierScore, stats.resolvedPredictions);

      text += `${emoji} @${user?.telegramUsername || followedId.slice(-6)}\n`;
      text += `   Brier: ${stats.brierScore.toFixed(3)} | Acc: ${(stats.accuracy * 100).toFixed(0)}%\n\n`;
    }

    text += `\n/unfollow @username - Stop following`;

    return { text, mood: 'NEUTRAL' };
  }

  const username = match[1];
  const result = follow(telegramId, username);

  return {
    text: result.success
      ? `✅ ${result.message}\n\n/signals to see their predictions`
      : `❌ ${result.message}`,
    mood: result.success ? 'BULLISH' : 'NEUTRAL',
  };
}

/**
 * Handle /unfollow command
 */
export function handleUnfollow(text: string, telegramId: string): SkillResponse {
  const match = text.match(/\/unfollow\s+@?(\w+)/i);

  if (!match) {
    return {
      text: `Usage: /unfollow @username`,
      mood: 'NEUTRAL',
    };
  }

  const username = match[1];
  const success = unfollow(telegramId, username);

  return {
    text: success
      ? `✅ Unfollowed @${username}`
      : `❌ You weren't following @${username}`,
    mood: 'NEUTRAL',
  };
}

/**
 * Handle /signals command
 */
export function handleSignals(telegramId?: string): SkillResponse {
  // Get signals from followed users or top forecasters
  let signals: Signal[];
  let title: string;

  if (telegramId) {
    const following = getFollowing(telegramId);
    if (following.length > 0) {
      signals = getSignals(telegramId, 10);
      title = 'SIGNALS FROM FOLLOWED';
    } else {
      signals = getTopSignals(10);
      title = 'TOP FORECASTER SIGNALS';
    }
  } else {
    signals = getTopSignals(10);
    title = 'TOP FORECASTER SIGNALS';
  }

  if (signals.length === 0) {
    return {
      text: `
📡 *${title}*
${'─'.repeat(35)}

No recent signals in the last 7 days.

${telegramId ? '/follow @username - Follow a forecaster\n' : ''}/leaderboard - Find top performers
`,
      mood: 'NEUTRAL',
    };
  }

  let text = `
📡 *${title}*
${'─'.repeat(35)}

`;

  for (const signal of signals.slice(0, 8)) {
    const pred = signal.prediction;
    const username = signal.forecasterUsername ? `@${signal.forecasterUsername}` : 'Anonymous';
    const outcome = pred.outcome !== undefined
      ? (pred.direction === 'YES') === pred.outcome ? '✅' : '❌'
      : '⏳';

    text += `${signal.forecasterGrade} *${username}*\n`;
    text += `${outcome} ${pred.question.slice(0, 40)}...\n`;
    text += `   ${pred.direction} @ ${(pred.predictedProbability * 100).toFixed(0)}%\n`;
    text += `   ${new Date(pred.createdAt).toLocaleDateString()}\n\n`;
  }

  text += `
${'─'.repeat(35)}
${telegramId ? '/follow @username - Follow more' : '/follow @username - Start following'}
`;

  return { text, mood: 'BULLISH', data: signals };
}

/**
 * Handle /toplists command - show suggested forecasters to follow
 */
export function handleTopLists(): SkillResponse {
  const leaderboard = getLeaderboard(10);

  if (leaderboard.length === 0) {
    return {
      text: `
🏆 *TOP FORECASTERS TO FOLLOW*
${'─'.repeat(35)}

No ranked forecasters yet.
Make predictions to join: /predict
`,
      mood: 'NEUTRAL',
    };
  }

  let text = `
🏆 *TOP FORECASTERS TO FOLLOW*
${'─'.repeat(35)}

`;

  for (const entry of leaderboard.slice(0, 5)) {
    const username = entry.username ? `@${entry.username}` : `User-${entry.telegramId.slice(-4)}`;
    const winRate = (entry.accuracy * 100).toFixed(0);
    const streak = entry.streak > 2 ? ` ${entry.streakType === 'win' ? '🔥' : ''}${entry.streak}` : '';

    text += `${entry.grade.emoji} *${username}*${streak}\n`;
    text += `   Brier: ${entry.brierScore.toFixed(3)} | Win: ${winRate}% | n=${entry.resolvedPredictions}\n`;
    text += `   /follow ${username}\n\n`;
  }

  text += `
${'─'.repeat(35)}
Follow top performers to see their signals!
`;

  return { text, mood: 'BULLISH', data: leaderboard };
}
