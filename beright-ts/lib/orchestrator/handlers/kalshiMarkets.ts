/**
 * Kalshi Markets Handler
 *
 * Search and browse Kalshi prediction markets.
 *
 * @see docs/ADR-002-TELEGRAM-AS-GATEWAY.md
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import {
  searchKalshiMarkets,
  getPopularKalshiMarkets,
  getKalshiMarketsByCategory,
  KalshiMarket,
} from '../../kalshi';

// =============================================================================
// TYPES
// =============================================================================

export interface KalshiMarketData {
  ticker: string;
  eventTicker: string;
  title: string;
  subtitle?: string;
  yesPrice: number;
  noPrice: number;
  spread: number;
  volume: number;
  volume24h?: number;
  openInterest: number;
  status: string;
  closeTime: string;
  category?: string;
  url: string;
}

export interface KalshiMarketsResult {
  query: string;
  timestamp: string;
  markets: KalshiMarketData[];
  totalResults: number;
  hasMore: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

function transformMarket(market: KalshiMarket): KalshiMarketData {
  const yesPrice = market.yes_bid > 0 && market.yes_ask > 0
    ? (market.yes_bid + market.yes_ask) / 2
    : market.last_price || 50;
  const noPrice = 100 - yesPrice;
  const spread = market.yes_ask > 0 && market.yes_bid > 0
    ? market.yes_ask - market.yes_bid
    : 0;

  const eventTicker = market.event_ticker || market.ticker;
  const cleanTicker = eventTicker
    .replace(/-\d{1,2}[A-Z]{3}\d{2}$/, '')
    .replace(/-\d+$/, '')
    .toLowerCase();

  return {
    ticker: market.ticker,
    eventTicker: market.event_ticker,
    title: market.title,
    subtitle: market.subtitle,
    yesPrice,
    noPrice,
    spread,
    volume: market.volume || 0,
    volume24h: market.volume_24h,
    openInterest: market.open_interest || 0,
    status: market.status,
    closeTime: market.close_time,
    category: market.category,
    url: `https://kalshi.com/markets/${cleanTicker}`,
  };
}

// =============================================================================
// HANDLER
// =============================================================================

export const kalshiMarketsHandler: CommandHandler<KalshiMarketsResult> = {
  id: 'kalshiMarkets',
  skillsUsed: ['kalshi'],

  async execute(context: CommandContext): Promise<CommandResult<KalshiMarketsResult>> {
    const startTime = Date.now();

    try {
      // Extract query from params or arguments
      const query = (context.params.query as string) ||
                    context.arguments?.join(' ') ||
                    '';

      let markets: KalshiMarket[];

      // Check if query is a category
      const categories = ['politics', 'crypto', 'elections', 'financials', 'sports', 'entertainment'];
      const queryLower = query.toLowerCase();

      if (!query) {
        // No query - return popular markets
        markets = await getPopularKalshiMarkets(15);
      } else if (categories.includes(queryLower)) {
        // Category search
        const category = queryLower.charAt(0).toUpperCase() + queryLower.slice(1);
        markets = await getKalshiMarketsByCategory(category as any, 15);
      } else {
        // Text search
        markets = await searchKalshiMarkets(query, 15);
      }

      const result: KalshiMarketsResult = {
        query: query || 'popular',
        timestamp: new Date().toISOString(),
        markets: markets.map(transformMarket),
        totalResults: markets.length,
        hasMore: markets.length >= 15,
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'kalshiMarkets',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['kalshi'],
          apiCallsMade: 1,
        },
        hints: {
          mood: 'NEUTRAL',
          suggestedActions: markets.length > 0
            ? [`/kalshi buy ${markets[0].ticker} YES 5`]
            : ['/kalshi', '/kalshi politics'],
        },
      };
    } catch (error) {
      console.error('[KalshiMarketsHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'KALSHI_SEARCH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to search Kalshi markets',
          retryable: true,
          recoveryAction: 'Try a different search term',
        },
        meta: {
          handlerId: 'kalshiMarkets',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['kalshi'],
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

registerHandler(kalshiMarketsHandler);

export default kalshiMarketsHandler;
