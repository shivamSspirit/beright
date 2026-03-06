/**
 * Hot Markets Handler
 *
 * Returns trending prediction markets from multiple platforms.
 * Part of the new gateway-agnostic architecture.
 *
 * This handler:
 * - Fetches markets from Polymarket, Kalshi/DFlow, Manifold, etc.
 * - Returns STRUCTURED DATA (never formatted text)
 * - Formatters handle presentation for each gateway
 *
 * @see docs/ADR-001-GATEWAY-SKILL-SEPARATION.md
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { MarketData } from '../../gateway/formatters/types';
import { getHotMarkets as fetchHotMarkets } from '../../../skills/markets';
import { registerHandler } from './registry';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Hot markets result data
 */
export interface HotMarketsResult {
  markets: MarketData[];
  totalCount: number;
  sources: string[];
  timestamp: Date;
}

// =============================================================================
// HANDLER
// =============================================================================

/**
 * Hot Markets Handler
 *
 * Fetches and returns trending prediction markets.
 */
export const hotMarketsHandler: CommandHandler<HotMarketsResult> = {
  id: 'hotMarkets',
  skillsUsed: ['markets'],

  async execute(context: CommandContext): Promise<CommandResult<HotMarketsResult>> {
    const startTime = Date.now();

    try {
      // Parse limit from arguments (default 10)
      const limitArg = context.params.limit as number | undefined;
      const limit = limitArg && limitArg > 0 && limitArg <= 50 ? limitArg : 10;

      // Fetch hot markets from existing skill
      const rawMarkets = await fetchHotMarkets(limit);

      // Transform to MarketData format
      const markets: MarketData[] = rawMarkets.map(m => ({
        id: m.marketId || '',
        platform: m.platform as MarketData['platform'],
        question: m.title || m.question || '',
        yesPrice: m.yesPrice || 0,
        noPrice: m.noPrice || 0,
        volume24h: (m as any).volume24h || m.volume || 0,
        liquidity: m.liquidity || 0,
        closeDate: m.endDate ? new Date(m.endDate) : undefined,
        url: m.url,
        ticker: m.marketId || undefined,
        category: detectCategory(m.title || ''),
      }));

      // Collect unique sources
      const sources = Array.from(new Set(markets.map(m => m.platform)));

      const result: HotMarketsResult = {
        markets,
        totalCount: markets.length,
        sources,
        timestamp: new Date(),
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'hotMarkets',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['markets'],
          apiCallsMade: sources.length, // One API call per platform
        },
        hints: {
          mood: 'NEUTRAL',
          suggestedActions: ['/research <topic>', '/trade <ticker> YES <amount>'],
        },
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch markets',
          retryable: true,
          recoveryAction: 'Try again in a moment',
        },
        meta: {
          handlerId: 'hotMarkets',
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
// HELPERS
// =============================================================================

/**
 * Detect market category from title
 */
function detectCategory(title: string): string {
  const t = title.toLowerCase();

  if (/trump|biden|election|president|congress|senate|governor|vote|republican|democrat/i.test(t)) {
    return 'politics';
  }
  if (/bitcoin|btc|ethereum|eth|crypto|solana|defi|token/i.test(t)) {
    return 'crypto';
  }
  if (/fed|rate|inflation|gdp|recession|jobs|unemployment|cpi|fomc/i.test(t)) {
    return 'economics';
  }
  if (/ai|openai|google|apple|tesla|microsoft|meta|nvidia|chatgpt/i.test(t)) {
    return 'tech';
  }
  if (/ukraine|russia|china|war|nato|iran|israel|military/i.test(t)) {
    return 'world';
  }

  return 'other';
}

// =============================================================================
// AUTO-REGISTER
// =============================================================================

registerHandler(hotMarketsHandler);

// =============================================================================
// EXPORTS
// =============================================================================

export default hotMarketsHandler;
