/**
 * DFlow Search Handler
 *
 * Searches DFlow prediction markets by query.
 * Returns tokenized markets on Solana with pricing and liquidity.
 *
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import { searchDFlowMarkets, getDFlowHotMarkets, DFlowEvent, DFlowMarket, USDC_MINT } from '../../dflow';
import { Market } from '../../../types/market';

// =============================================================================
// TYPES
// =============================================================================

/**
 * DFlow search result
 */
export interface DFlowSearchResult {
  query: string;
  timestamp: string;
  markets: DFlowMarketData[];
  totalResults: number;
  hasMore: boolean;
}

/**
 * Market data from DFlow
 */
export interface DFlowMarketData {
  ticker: string;
  eventTicker: string;
  title: string;
  subtitle?: string;
  yesPrice: number;
  noPrice: number;
  spread: number;
  volume24h: number;
  liquidity: number;
  openInterest: number;
  status: string;
  closeTime: Date;
  yesMint?: string;
  noMint?: string;
  url: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Transform DFlow event to our market data format
 */
function transformDFlowEvent(event: DFlowEvent): DFlowMarketData | null {
  const market = event.markets?.[0];
  if (!market) return null;

  const yesBid = parseFloat(market.yesBid || '0');
  const yesAsk = parseFloat(market.yesAsk || '0');
  const noBid = parseFloat(market.noBid || '0');
  const noAsk = parseFloat(market.noAsk || '0');

  const yesPrice = yesBid && yesAsk ? (yesBid + yesAsk) / 2 : yesBid || yesAsk || 0.5;
  const noPrice = noBid && noAsk ? (noBid + noAsk) / 2 : noBid || noAsk || 0.5;
  const spread = Math.max(yesAsk - yesBid, noAsk - noBid, 0);

  // Get mints from market accounts
  const usdcAccounts = market.accounts?.[USDC_MINT];
  const yesMint = usdcAccounts?.yesMint;
  const noMint = usdcAccounts?.noMint;

  return {
    ticker: market.ticker,
    eventTicker: event.ticker,
    title: event.title,
    subtitle: event.subtitle,
    yesPrice,
    noPrice,
    spread,
    volume24h: event.volume24h || 0,
    liquidity: event.liquidity || 0,
    openInterest: market.openInterest || 0,
    status: market.status,
    closeTime: new Date(market.closeTime * 1000),
    yesMint,
    noMint,
    url: `https://dflow.trade/market/${market.ticker}`,
  };
}

// =============================================================================
// HANDLER
// =============================================================================

/**
 * DFlow Search Handler
 *
 * Searches DFlow prediction markets and returns structured results.
 */
export const dflowSearchHandler: CommandHandler<DFlowSearchResult> = {
  id: 'dflowSearch',
  skillsUsed: ['dflow'],

  async execute(context: CommandContext): Promise<CommandResult<DFlowSearchResult>> {
    const startTime = Date.now();

    try {
      // Extract query from params or arguments
      const query = (context.params.query as string) ||
                    context.arguments?.join(' ') ||
                    '';

      let events: DFlowEvent[];

      if (!query || query.length < 2) {
        // No query - return hot markets
        events = await getDFlowHotMarkets(15);
      } else {
        // Search by query
        events = await searchDFlowMarkets(query, 15);
      }

      // Transform events to our format
      const markets: DFlowMarketData[] = events
        .map(transformDFlowEvent)
        .filter((m): m is DFlowMarketData => m !== null);

      const result: DFlowSearchResult = {
        query: query || 'hot markets',
        timestamp: new Date().toISOString(),
        markets,
        totalResults: markets.length,
        hasMore: events.length >= 15,
      };

      // Determine mood based on results
      const mood = markets.length > 0 ? 'NEUTRAL' : 'NEUTRAL';

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'dflowSearch',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['dflow'],
          apiCallsMade: 1,
        },
        hints: {
          mood,
          suggestedActions: markets.length > 0
            ? [`/trade ${markets[0].ticker} YES 10`, `/quote ${markets[0].ticker} YES 10`]
            : ['/hot', '/research'],
        },
      };
    } catch (error) {
      console.error('[DFlowSearchHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'DFLOW_SEARCH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to search DFlow markets',
          retryable: true,
          recoveryAction: 'Try a different search term or check back later',
        },
        meta: {
          handlerId: 'dflowSearch',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['dflow'],
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

registerHandler(dflowSearchHandler);

// =============================================================================
// EXPORTS
// =============================================================================

export default dflowSearchHandler;
