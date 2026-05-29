/**
 * Quote Handler
 *
 * Gets trade quotes with routing comparison.
 * Shows DFlow direct vs Jupiter aggregator pricing.
 *
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import { handleQuote as getQuote } from '../../../skills/dflowTrade';
import { getDFlowMarket, DFlowMarket, USDC_MINT } from '../../dflow';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Quote for a single venue
 */
export interface VenueQuote {
  venue: 'dflow' | 'jupiter';
  outputAmount: number;
  effectivePrice: number;
  priceImpact: number;
  route?: string[];
  available: boolean;
}

/**
 * Quote result data
 */
export interface QuoteResult {
  ticker: string;
  marketTitle: string;
  side: 'YES' | 'NO';
  amountUsd: number;
  timestamp: string;
  quotes: {
    dflow?: VenueQuote;
    jupiter?: VenueQuote;
  };
  recommended: 'dflow' | 'jupiter';
  reason: string;
  savingsPct: number;
  marketStatus: string;
  yesMint?: string;
  noMint?: string;
}

// =============================================================================
// HANDLER
// =============================================================================

/**
 * Quote Handler
 *
 * Returns trade quotes with routing comparison.
 */
export const quoteHandler: CommandHandler<QuoteResult> = {
  id: 'quote',
  skillsUsed: ['dflow'],

  async execute(context: CommandContext): Promise<CommandResult<QuoteResult>> {
    const startTime = Date.now();

    try {
      // Parse parameters
      const ticker = (context.params.ticker as string) ||
                     context.arguments?.[0] ||
                     '';

      const side = ((context.params.side as string) ||
                    context.arguments?.[1] ||
                    'YES').toUpperCase() as 'YES' | 'NO';

      const amountStr = (context.params.amount as string) ||
                        context.arguments?.[2] ||
                        '10';
      const amountUsd = parseFloat(amountStr) || 10;

      // Validate inputs
      if (!ticker) {
        return {
          success: false,
          error: {
            code: 'MISSING_TICKER',
            message: 'Please provide a market ticker. Usage: /quote <ticker> YES|NO <amount>',
            retryable: false,
          },
          meta: {
            handlerId: 'quote',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: [],
            apiCallsMade: 0,
          },
          hints: {
            mood: 'NEUTRAL',
            suggestedActions: ['/dflow bitcoin', '/hot'],
          },
        };
      }

      if (side !== 'YES' && side !== 'NO') {
        return {
          success: false,
          error: {
            code: 'INVALID_SIDE',
            message: 'Side must be YES or NO. Usage: /quote <ticker> YES|NO <amount>',
            retryable: false,
          },
          meta: {
            handlerId: 'quote',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: [],
            apiCallsMade: 0,
          },
          hints: {
            mood: 'NEUTRAL',
          },
        };
      }

      if (amountUsd < 1 || amountUsd > 100000) {
        return {
          success: false,
          error: {
            code: 'INVALID_AMOUNT',
            message: 'Amount must be between $1 and $100,000',
            retryable: false,
          },
          meta: {
            handlerId: 'quote',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: [],
            apiCallsMade: 0,
          },
          hints: {
            mood: 'NEUTRAL',
          },
        };
      }

      // Get market details
      const market = await getDFlowMarket(ticker);
      if (!market) {
        return {
          success: false,
          error: {
            code: 'MARKET_NOT_FOUND',
            message: `Market not found: ${ticker}. Use /dflow <query> to search.`,
            retryable: false,
          },
          meta: {
            handlerId: 'quote',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: ['dflow'],
            apiCallsMade: 1,
          },
          hints: {
            mood: 'NEUTRAL',
            suggestedActions: ['/dflow', '/hot'],
          },
        };
      }

      // Get user ID for quote (simulation if not authenticated)
      const userId = context.userId || 'simulation';

      // Get quote using existing skill
      const skillResponse = await getQuote(userId, ticker, side, amountUsd);

      if (skillResponse.mood === 'ERROR') {
        return {
          success: false,
          error: {
            code: 'QUOTE_FAILED',
            message: skillResponse.text,
            retryable: true,
            recoveryAction: 'Try again or use a different market',
          },
          meta: {
            handlerId: 'quote',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: ['dflow'],
            apiCallsMade: 2,
          },
          hints: {
            mood: 'ERROR',
          },
        };
      }

      // Extract routing data from skill response
      const routingData = skillResponse.data as {
        recommended: 'dflow' | 'jupiter';
        reason: string;
        savingsPct: number;
        quotes: {
          dflow?: {
            outputAmount: number;
            effectivePrice: number;
            priceImpact: number;
          };
          jupiter?: {
            outputAmount: number;
            effectivePrice: number;
            priceImpact: number;
            route: string[];
          };
        };
      };

      // Get mints from market accounts
      const usdcAccounts = market.accounts?.[USDC_MINT];

      const result: QuoteResult = {
        ticker,
        marketTitle: market.title,
        side,
        amountUsd,
        timestamp: new Date().toISOString(),
        quotes: {
          dflow: routingData.quotes.dflow ? {
            venue: 'dflow',
            outputAmount: routingData.quotes.dflow.outputAmount,
            effectivePrice: routingData.quotes.dflow.effectivePrice,
            priceImpact: routingData.quotes.dflow.priceImpact,
            available: true,
          } : undefined,
          jupiter: routingData.quotes.jupiter ? {
            venue: 'jupiter',
            outputAmount: routingData.quotes.jupiter.outputAmount,
            effectivePrice: routingData.quotes.jupiter.effectivePrice,
            priceImpact: routingData.quotes.jupiter.priceImpact,
            route: routingData.quotes.jupiter.route,
            available: true,
          } : undefined,
        },
        recommended: routingData.recommended,
        reason: routingData.reason,
        savingsPct: routingData.savingsPct,
        marketStatus: market.status,
        yesMint: usdcAccounts?.yesMint,
        noMint: usdcAccounts?.noMint,
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'quote',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['dflow'],
          apiCallsMade: 2,
        },
        hints: {
          mood: 'NEUTRAL',
          suggestedActions: [`/trade ${ticker} ${side} ${amountUsd}`],
        },
      };
    } catch (error) {
      console.error('[QuoteHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'QUOTE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to get quote',
          retryable: true,
          recoveryAction: 'Check market ticker and try again',
        },
        meta: {
          handlerId: 'quote',
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

registerHandler(quoteHandler);

// =============================================================================
// EXPORTS
// =============================================================================

export default quoteHandler;
