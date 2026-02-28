/**
 * Recommendations Handler
 *
 * Get personalized market recommendations based on user profile and performance.
 *
 * @see docs/ADR-002-TELEGRAM-AS-GATEWAY.md
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import { getRecommendations, buildUserProfile } from '../../../skills/recommendations';

// =============================================================================
// TYPES
// =============================================================================

export interface MarketRecommendation {
  ticker: string;
  title: string;
  category: string;
  currentPrice: number;
  volume: number;
  closeTime?: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  matchScore: number;
  suggestedAction?: {
    direction: 'YES' | 'NO';
    probability: number;
    rationale: string;
  };
}

export interface UserProfileSummary {
  avgBrier: number;
  totalPredictions: number;
  strongCategories: string[];
  weakCategories: string[];
  recentAccuracy: number;
  tier: string;
}

export interface RecommendationsResult {
  timestamp: string;
  userId: string;
  hasProfile: boolean;
  profile?: UserProfileSummary;
  forYou: MarketRecommendation[];
  trending: MarketRecommendation[];
  undervalued: MarketRecommendation[];
  educational: MarketRecommendation[];
  totalRecommendations: number;
}

// =============================================================================
// HELPERS
// =============================================================================

function getTier(avgBrier: number): string {
  if (avgBrier < 0.10) return 'Diamond';
  if (avgBrier < 0.15) return 'Platinum';
  if (avgBrier < 0.20) return 'Gold';
  if (avgBrier < 0.25) return 'Silver';
  return 'Bronze';
}

// =============================================================================
// HANDLER
// =============================================================================

export const recommendationsHandler: CommandHandler<RecommendationsResult> = {
  id: 'recommendations',
  skillsUsed: ['recommendations', 'dflow', 'calibration'],

  async execute(context: CommandContext): Promise<CommandResult<RecommendationsResult>> {
    const startTime = Date.now();

    try {
      const userId = context.chatId?.toString() || 'anonymous';

      // Get recommendations
      const recs = await getRecommendations(userId);

      // Get user profile
      let profile: UserProfileSummary | undefined;
      let hasProfile = false;

      try {
        const userProfile = await buildUserProfile(userId);
        if (userProfile) {
          hasProfile = true;
          profile = {
            avgBrier: userProfile.avgBrier,
            totalPredictions: userProfile.totalPredictions,
            strongCategories: userProfile.strongCategories,
            weakCategories: userProfile.weakCategories,
            recentAccuracy: userProfile.recentAccuracy,
            tier: getTier(userProfile.avgBrier),
          };
        }
      } catch (e) {
        // Profile is optional
      }

      const totalRecommendations =
        recs.forYou.length +
        recs.trending.length +
        recs.undervalued.length +
        recs.educational.length;

      const result: RecommendationsResult = {
        timestamp: new Date().toISOString(),
        userId,
        hasProfile,
        profile,
        forYou: recs.forYou.map(r => ({
          ticker: r.ticker,
          title: r.title,
          category: r.category,
          currentPrice: r.currentPrice,
          volume: r.volume,
          closeTime: r.closeTime,
          reason: r.reason,
          confidence: r.confidence,
          matchScore: r.matchScore,
          suggestedAction: r.suggestedAction,
        })),
        trending: recs.trending.map(r => ({
          ticker: r.ticker,
          title: r.title,
          category: r.category,
          currentPrice: r.currentPrice,
          volume: r.volume,
          closeTime: r.closeTime,
          reason: r.reason,
          confidence: r.confidence,
          matchScore: r.matchScore,
        })),
        undervalued: recs.undervalued.map(r => ({
          ticker: r.ticker,
          title: r.title,
          category: r.category,
          currentPrice: r.currentPrice,
          volume: r.volume,
          closeTime: r.closeTime,
          reason: r.reason,
          confidence: r.confidence,
          matchScore: r.matchScore,
          suggestedAction: r.suggestedAction,
        })),
        educational: recs.educational.map(r => ({
          ticker: r.ticker,
          title: r.title,
          category: r.category,
          currentPrice: r.currentPrice,
          volume: r.volume,
          closeTime: r.closeTime,
          reason: r.reason,
          confidence: r.confidence,
          matchScore: r.matchScore,
        })),
        totalRecommendations,
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'recommendations',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['recommendations', 'dflow', 'calibration'],
          apiCallsMade: 2,
        },
        hints: {
          mood: recs.forYou.length > 0 ? 'BULLISH' : 'NEUTRAL',
          suggestedActions: ['/smartpredict', '/intelligence'],
        },
      };
    } catch (error) {
      console.error('[RecommendationsHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'RECOMMENDATIONS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to get recommendations',
          retryable: true,
        },
        meta: {
          handlerId: 'recommendations',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['recommendations'],
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

registerHandler(recommendationsHandler);

export default recommendationsHandler;
