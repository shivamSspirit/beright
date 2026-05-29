/**
 * Follow Handler
 *
 * Follow/unfollow forecasters for copy trading signals.
 *
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import {
  follow as followUser,
  unfollow as unfollowUser,
  getFollowing,
  getFollowers,
} from '../../../skills/copyTrading';
import { calculateUserStats } from '../../../lib/leaderboard';
import { getAllUsers } from '../../../lib/identity';

// =============================================================================
// TYPES
// =============================================================================

export interface FollowedUser {
  telegramId: string;
  username?: string;
  brierScore: number;
  accuracy: number;
  resolvedPredictions: number;
  grade: string;
}

export interface FollowResult {
  timestamp: string;
  action: 'follow' | 'unfollow' | 'list';
  success: boolean;
  message?: string;
  // For follow/unfollow
  targetUsername?: string;
  targetStats?: {
    brierScore: number;
    accuracy: number;
    resolvedPredictions: number;
  };
  // For list
  following?: FollowedUser[];
  followerCount?: number;
}

// =============================================================================
// HELPERS
// =============================================================================

function getGrade(brierScore: number, resolvedCount: number): string {
  if (resolvedCount < 3) return 'New';
  if (brierScore < 0.1) return 'Elite';
  if (brierScore < 0.15) return 'Expert';
  if (brierScore < 0.2) return 'Advanced';
  if (brierScore < 0.25) return 'Intermediate';
  return 'Beginner';
}

// =============================================================================
// HANDLER
// =============================================================================

export const followHandler: CommandHandler<FollowResult> = {
  id: 'follow',
  skillsUsed: ['copyTrading', 'leaderboard'],

  async execute(context: CommandContext): Promise<CommandResult<FollowResult>> {
    const startTime = Date.now();

    try {
      const userId = context.userId || context.gatewayContext?.chatId?.toString() || 'anonymous';
      const rawMessage = context.message?.text || '';

      // Check if this is an unfollow command
      const isUnfollow = rawMessage.toLowerCase().startsWith('/unfollow');

      // Parse target username
      const usernameMatch = rawMessage.match(/\/(?:un)?follow\s+@?(\w+)/i);
      const targetUsername = usernameMatch?.[1] || context.arguments?.[0];

      // If no username provided, show list of following
      if (!targetUsername) {
        const followingIds = getFollowing(userId);
        const users = getAllUsers();

        const following: FollowedUser[] = followingIds.map(id => {
          const user = users.find(u => u.telegramId === id);
          const stats = calculateUserStats(id);
          return {
            telegramId: id,
            username: user?.telegramUsername,
            brierScore: stats.brierScore,
            accuracy: stats.accuracy,
            resolvedPredictions: stats.resolvedPredictions,
            grade: getGrade(stats.brierScore, stats.resolvedPredictions),
          };
        });

        const followerCount = getFollowers(userId).length;

        const result: FollowResult = {
          timestamp: new Date().toISOString(),
          action: 'list',
          success: true,
          following,
          followerCount,
        };

        return {
          success: true,
          data: result,
          meta: {
            handlerId: 'follow',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: ['copyTrading', 'leaderboard'],
            apiCallsMade: 0,
          },
          hints: {
            mood: following.length > 0 ? 'NEUTRAL' : 'EDUCATIONAL',
            suggestedActions: following.length === 0
              ? ['/leaderboard', '/signals']
              : ['/signals', '/unfollow'],
          },
        };
      }

      // Handle follow/unfollow
      if (isUnfollow) {
        const success = unfollowUser(userId, targetUsername);

        const result: FollowResult = {
          timestamp: new Date().toISOString(),
          action: 'unfollow',
          success,
          targetUsername,
          message: success
            ? `Unfollowed @${targetUsername}`
            : `You weren't following @${targetUsername}`,
        };

        return {
          success: true,
          data: result,
          meta: {
            handlerId: 'follow',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: ['copyTrading'],
            apiCallsMade: 0,
          },
          hints: {
            mood: 'NEUTRAL',
            suggestedActions: ['/follow', '/signals'],
          },
        };
      }

      // Handle follow
      const followResult = followUser(userId, targetUsername);

      // Get target stats if successful
      let targetStats: FollowResult['targetStats'];
      if (followResult.success) {
        const users = getAllUsers();
        const target = users.find(u =>
          u.telegramUsername?.toLowerCase() === targetUsername.toLowerCase()
        );
        if (target?.telegramId) {
          const stats = calculateUserStats(target.telegramId);
          targetStats = {
            brierScore: stats.brierScore,
            accuracy: stats.accuracy,
            resolvedPredictions: stats.resolvedPredictions,
          };
        }
      }

      const result: FollowResult = {
        timestamp: new Date().toISOString(),
        action: 'follow',
        success: followResult.success,
        targetUsername,
        message: followResult.message,
        targetStats,
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'follow',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['copyTrading', 'leaderboard'],
          apiCallsMade: 0,
        },
        hints: {
          mood: followResult.success ? 'BULLISH' : 'NEUTRAL',
          suggestedActions: followResult.success
            ? ['/signals']
            : ['/leaderboard'],
        },
      };
    } catch (error) {
      console.error('[FollowHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'FOLLOW_FAILED',
          message: error instanceof Error ? error.message : 'Failed to process follow request',
          retryable: true,
        },
        meta: {
          handlerId: 'follow',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['copyTrading'],
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

registerHandler(followHandler);

export default followHandler;
