/**
 * Alpha Handler
 *
 * Returns actionable market opportunities:
 * - High conviction plays (decisive markets with volume)
 * - Contentious markets (40-60% - potential edge)
 * - High volume markets
 *
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import { getHotMarkets } from '../../../skills/markets';
import { Market } from '../../../types/market';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Alpha market with signal classification
 */
export interface AlphaMarket {
  market: Market;
  signal: 'high_conviction' | 'contentious' | 'high_volume';
  direction?: 'YES' | 'NO';
  confidence: number;
}

/**
 * Alpha result data
 */
export interface AlphaResult {
  timestamp: string;
  highConviction: AlphaMarket[];
  contentious: AlphaMarket[];
  highVolume: AlphaMarket[];
  totalOpportunities: number;
}

// =============================================================================
// HANDLER
// =============================================================================

/**
 * Alpha Handler
 *
 * Analyzes markets to find actionable opportunities.
 */
export const alphaHandler: CommandHandler<AlphaResult> = {
  id: 'alpha',
  skillsUsed: ['markets'],

  async execute(context: CommandContext): Promise<CommandResult<AlphaResult>> {
    const startTime = Date.now();

    try {
      // Fetch markets
      const markets = await getHotMarkets(20);

      // Classify markets by signal type
      const highConviction: AlphaMarket[] = [];
      const contentious: AlphaMarket[] = [];
      const highVolume: AlphaMarket[] = [];

      for (const market of markets) {
        const pct = market.yesPrice <= 1 ? market.yesPrice * 100 : market.yesPrice;
        const volume = market.volume || 0;

        // High conviction: decisive (>90% or <10%) with volume
        if ((pct >= 90 || pct <= 10) && volume >= 100_000) {
          highConviction.push({
            market,
            signal: 'high_conviction',
            direction: pct >= 50 ? 'YES' : 'NO',
            confidence: Math.abs(pct - 50) / 50, // 0-1 based on distance from 50%
          });
        }
        // Contentious: uncertain (40-60%)
        else if (pct >= 40 && pct <= 60) {
          contentious.push({
            market,
            signal: 'contentious',
            confidence: 1 - Math.abs(pct - 50) / 50, // Higher when closer to 50%
          });
        }
        // High volume
        else if (volume >= 1_000_000) {
          highVolume.push({
            market,
            signal: 'high_volume',
            direction: pct >= 50 ? 'YES' : 'NO',
            confidence: 0.5,
          });
        }
      }

      // Sort by confidence within each category
      highConviction.sort((a, b) => b.confidence - a.confidence);
      contentious.sort((a, b) => b.confidence - a.confidence);
      highVolume.sort((a, b) => (b.market.volume || 0) - (a.market.volume || 0));

      const result: AlphaResult = {
        timestamp: new Date().toISOString(),
        highConviction: highConviction.slice(0, 3),
        contentious: contentious.slice(0, 3),
        highVolume: highVolume.slice(0, 3),
        totalOpportunities: highConviction.length + contentious.length + highVolume.length,
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'alpha',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['markets'],
          apiCallsMade: 1,
        },
        hints: {
          mood: result.highConviction.length > 0 ? 'BULLISH' : 'NEUTRAL',
          suggestedActions: result.highConviction.length > 0
            ? [`/trade ${result.highConviction[0].market.marketId} ${result.highConviction[0].direction} 10`]
            : ['/hot', '/research'],
        },
      };
    } catch (error) {
      console.error('[AlphaHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'ALPHA_SCAN_FAILED',
          message: error instanceof Error ? error.message : 'Failed to scan for alpha',
          retryable: true,
          recoveryAction: 'Try again in a moment',
        },
        meta: {
          handlerId: 'alpha',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['markets'],
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

registerHandler(alphaHandler);

// =============================================================================
// EXPORTS
// =============================================================================

export default alphaHandler;
