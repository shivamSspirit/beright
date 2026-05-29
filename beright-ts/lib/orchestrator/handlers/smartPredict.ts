/**
 * SmartPredict Handler
 *
 * AI-assisted prediction with market matching, base rates, and bias warnings.
 *
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import { smartPredict, searchMarketsForPrediction } from '../../../skills/smartPredict';

// =============================================================================
// TYPES
// =============================================================================

export interface MarketSearchResult {
  ticker: string;
  title: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  closeTime?: string;
  similarity: number;
}

export interface SmartPredictResult {
  timestamp: string;
  mode: 'search' | 'predict';
  // Search mode
  searchQuery?: string;
  markets?: MarketSearchResult[];
  // Predict mode
  prediction?: {
    id: string;
    question: string;
    direction: 'YES' | 'NO';
    probability: number;
    marketTicker?: string;
    onChainTx?: string;
  };
  matchedMarket?: MarketSearchResult;
  alternatives?: MarketSearchResult[];
  intelligence?: {
    baseRate: number;
    recommendedRange: { low: number; high: number };
    biasWarnings: string[];
  };
  autoResolve: boolean;
}

// =============================================================================
// HANDLER
// =============================================================================

export const smartPredictHandler: CommandHandler<SmartPredictResult> = {
  id: 'smartPredict',
  skillsUsed: ['smartPredict', 'dflow', 'intelligence', 'onchain'],

  async execute(context: CommandContext): Promise<CommandResult<SmartPredictResult>> {
    const startTime = Date.now();

    try {
      const args = context.arguments || [];
      const userId = context.userId || context.gatewayContext?.chatId?.toString() || 'anonymous';

      // If no args or just a query, search for markets
      if (args.length === 0) {
        return {
          success: false,
          error: {
            code: 'MISSING_ARGUMENTS',
            message: 'Usage:\nSearch: /smartpredict search "bitcoin"\nPredict: /smartpredict TICKER 65 YES',
            retryable: false,
          },
          meta: {
            handlerId: 'smartPredict',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: [],
            apiCallsMade: 0,
          },
          hints: { mood: 'NEUTRAL' },
        };
      }

      // Search mode
      if (args[0].toLowerCase() === 'search') {
        const query = args.slice(1).join(' ');
        const response = await searchMarketsForPrediction(query);

        const markets: MarketSearchResult[] = (response.data as any[])?.map((m: any) => ({
          ticker: m.ticker,
          title: m.title,
          yesPrice: m.yesPrice,
          noPrice: m.noPrice,
          volume: m.volume || 0,
          closeTime: m.closeTime,
          similarity: m.similarity,
        })) || [];

        return {
          success: true,
          data: {
            timestamp: new Date().toISOString(),
            mode: 'search',
            searchQuery: query,
            markets,
            autoResolve: false,
          },
          meta: {
            handlerId: 'smartPredict',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: ['dflow'],
            apiCallsMade: 1,
          },
          hints: {
            mood: 'NEUTRAL',
            suggestedActions: markets.length > 0 ? ['/smartpredict TICKER 65 YES'] : [],
          },
        };
      }

      // Predict mode: /smartpredict TICKER probability direction [reasoning]
      if (args.length < 3) {
        return {
          success: false,
          error: {
            code: 'INVALID_ARGUMENTS',
            message: 'Usage: /smartpredict TICKER probability YES|NO [reasoning]',
            retryable: false,
          },
          meta: {
            handlerId: 'smartPredict',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: [],
            apiCallsMade: 0,
          },
          hints: { mood: 'ERROR' },
        };
      }

      const ticker = args[0].toUpperCase();
      const probability = parseFloat(args[1]) / 100;
      const direction = args[2].toUpperCase() as 'YES' | 'NO';
      const reasoning = args.slice(3).join(' ') || undefined;

      // Validate
      if (isNaN(probability) || probability < 0.01 || probability > 0.99) {
        return {
          success: false,
          error: {
            code: 'INVALID_PROBABILITY',
            message: 'Probability must be between 1 and 99',
            retryable: false,
          },
          meta: {
            handlerId: 'smartPredict',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: [],
            apiCallsMade: 0,
          },
          hints: { mood: 'ERROR' },
        };
      }

      if (direction !== 'YES' && direction !== 'NO') {
        return {
          success: false,
          error: {
            code: 'INVALID_DIRECTION',
            message: 'Direction must be YES or NO',
            retryable: false,
          },
          meta: {
            handlerId: 'smartPredict',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: [],
            apiCallsMade: 0,
          },
          hints: { mood: 'ERROR' },
        };
      }

      // Make smart prediction with forced ticker
      const data = await smartPredict(ticker, probability, direction, userId, {
        reasoning,
        forceMarketTicker: ticker,
      });

      const result: SmartPredictResult = {
        timestamp: new Date().toISOString(),
        mode: 'predict',
        prediction: data.prediction ? {
          id: data.prediction.id,
          question: data.prediction.question,
          direction: data.prediction.direction,
          probability: data.prediction.probability,
          marketTicker: data.prediction.marketTicker,
          onChainTx: data.prediction.onChainTx,
        } : undefined,
        matchedMarket: data.matchedMarket ? {
          ticker: data.matchedMarket.ticker,
          title: data.matchedMarket.title,
          yesPrice: data.matchedMarket.yesPrice,
          noPrice: data.matchedMarket.noPrice,
          volume: data.matchedMarket.volume,
          closeTime: data.matchedMarket.closeTime,
          similarity: data.matchedMarket.similarity,
        } : undefined,
        alternatives: data.alternatives?.map(a => ({
          ticker: a.ticker,
          title: a.title,
          yesPrice: a.yesPrice,
          noPrice: a.noPrice,
          volume: a.volume,
          closeTime: a.closeTime,
          similarity: a.similarity,
        })),
        intelligence: data.intelligence,
        autoResolve: !!data.matchedMarket,
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'smartPredict',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['smartPredict', 'dflow', 'intelligence', 'onchain'],
          apiCallsMade: 4,
        },
        hints: {
          mood: data.matchedMarket ? 'BULLISH' : 'NEUTRAL',
          suggestedActions: ['/compare', '/calibration'],
        },
      };
    } catch (error) {
      console.error('[SmartPredictHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'SMARTPREDICT_FAILED',
          message: error instanceof Error ? error.message : 'Smart prediction failed',
          retryable: true,
        },
        meta: {
          handlerId: 'smartPredict',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['smartPredict'],
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

registerHandler(smartPredictHandler);

export default smartPredictHandler;
