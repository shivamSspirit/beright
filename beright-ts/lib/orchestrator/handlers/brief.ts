/**
 * Brief Handler
 *
 * Returns the daily morning brief - aggregated market intelligence.
 * This is the "hook" that gets users engaged every morning.
 *
 * @see docs/ADR-002-TELEGRAM-AS-GATEWAY.md
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import { generateMorningBrief } from '../../../skills/brief';
import { Market, ArbitrageOpportunity, WhaleAlert } from '../../../types/index';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Market mover data
 */
export interface MarketMover {
  title: string;
  platform: string;
  currentPrice: number;
  change24h: number;
  volume: number;
}

/**
 * User calibration stats
 */
export interface UserStats {
  brierScore: number;
  accuracy: number;
  pendingPredictions: number;
  streak: number;
  streakType: 'win' | 'loss' | 'none';
  rank: number | null;
}

/**
 * Trust engine data (when available)
 */
export interface TrustData {
  dataQualityScore: number;
  totalValidated: number;
  totalFiltered: number;
  sources: string[];
  warnings: string[];
}

/**
 * Brief result data
 */
export interface BriefResult {
  generatedAt: string;
  hotMarkets: Market[];
  arbitrageOpportunities: ArbitrageOpportunity[];
  whaleAlerts: WhaleAlert[];
  userStats: UserStats;
  marketMovers: MarketMover[];
  trustData?: TrustData;
}

// =============================================================================
// HANDLER
// =============================================================================

/**
 * Brief Handler
 *
 * Generates the daily morning brief with:
 * - Top movers (markets with biggest price changes)
 * - Hot markets (diversified by category)
 * - Arbitrage opportunities
 * - Whale alerts
 * - User calibration stats
 */
export const briefHandler: CommandHandler<BriefResult> = {
  id: 'brief',
  skillsUsed: ['brief', 'markets', 'arbitrage', 'whale', 'calibration'],

  async execute(context: CommandContext): Promise<CommandResult<BriefResult>> {
    const startTime = Date.now();

    try {
      // Generate morning brief using existing skill
      const briefData = await generateMorningBrief(context.userId);

      // Transform to our result format
      const result: BriefResult = {
        generatedAt: briefData.generatedAt,
        hotMarkets: briefData.hotMarkets,
        arbitrageOpportunities: briefData.arbitrageOpportunities,
        whaleAlerts: briefData.whaleAlerts,
        userStats: briefData.userStats,
        marketMovers: briefData.marketMovers.map(m => ({
          title: m.title,
          platform: m.platform,
          currentPrice: m.currentPrice,
          change24h: m.change24h,
          volume: m.volume,
        })),
        trustData: briefData.trustData,
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'brief',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['brief', 'markets', 'arbitrage', 'whale', 'calibration'],
          apiCallsMade: 4, // markets, arbitrage, whale, calibration
        },
        hints: {
          mood: result.arbitrageOpportunities.length > 0 ? 'BULLISH' : 'NEUTRAL',
          suggestedActions: [
            '/research <topic>',
            '/trade <ticker> YES <amount>',
            '/predict <market>',
          ],
        },
      };
    } catch (error) {
      console.error('[BriefHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'BRIEF_GENERATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to generate brief',
          retryable: true,
          recoveryAction: 'Try again in a moment',
        },
        meta: {
          handlerId: 'brief',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['brief'],
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

registerHandler(briefHandler);

// =============================================================================
// EXPORTS
// =============================================================================

export default briefHandler;
