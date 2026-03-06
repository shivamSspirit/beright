/**
 * Predict Handler
 *
 * Make a prediction on a market with auto-linking to DFlow.
 *
 * @see docs/ADR-002-TELEGRAM-AS-GATEWAY.md
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import { predict as makePrediction } from '../../../skills/smartPredict';

// =============================================================================
// TYPES
// =============================================================================

export interface MarketMatch {
  ticker: string;
  title: string;
  yesPrice: number;
  noPrice: number;
  similarity: number;
  closeTime?: string;
}

export interface PredictResult {
  timestamp: string;
  prediction: {
    id: string;
    question: string;
    direction: 'YES' | 'NO';
    probability: number;
    marketTicker?: string;
    onChainTx?: string;
    calibrationTx?: string;
    forecasterPda?: string;
  };
  matchedMarket?: MarketMatch;
  alternatives?: MarketMatch[];
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

export const predictHandler: CommandHandler<PredictResult> = {
  id: 'predict',
  skillsUsed: ['smartPredict', 'dflow', 'onchain'],

  async execute(context: CommandContext): Promise<CommandResult<PredictResult>> {
    const startTime = Date.now();

    try {
      // Parse arguments: question, probability, direction, [reasoning]
      const args = context.arguments || [];

      if (args.length < 3) {
        return {
          success: false,
          error: {
            code: 'INVALID_ARGUMENTS',
            message: 'Usage: /predict "question" probability YES|NO [reasoning]',
            retryable: false,
            recoveryAction: 'Provide question, probability (1-99), and direction (YES/NO)',
          },
          meta: {
            handlerId: 'predict',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: [],
            apiCallsMade: 0,
          },
          hints: { mood: 'ERROR' },
        };
      }

      const question = args[0];
      const probability = parseFloat(args[1]) / 100; // Convert 65 -> 0.65
      const direction = args[2].toUpperCase() as 'YES' | 'NO';
      const reasoning = args.slice(3).join(' ') || undefined;
      const userId = context.userId || context.gatewayContext?.chatId?.toString() || 'anonymous';

      // Validate inputs
      if (isNaN(probability) || probability < 0.01 || probability > 0.99) {
        return {
          success: false,
          error: {
            code: 'INVALID_PROBABILITY',
            message: 'Probability must be between 1 and 99',
            retryable: false,
          },
          meta: {
            handlerId: 'predict',
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
            handlerId: 'predict',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: [],
            apiCallsMade: 0,
          },
          hints: { mood: 'ERROR' },
        };
      }

      // Make the prediction
      const response = await makePrediction(question, probability, direction, userId, { reasoning });

      if (!response.data) {
        throw new Error('Prediction failed - no data returned');
      }

      // Type assertion for the prediction response data
      const data = response.data as {
        prediction?: {
          id?: string;
          onChainTx?: string;
          calibrationTx?: string;
          forecasterPda?: string;
        };
        matchedMarket?: {
          ticker: string;
          title: string;
          yesPrice: number;
          noPrice: number;
          similarity: number;
          closeTime?: string;
        };
        alternatives?: Array<{
          ticker: string;
          title: string;
          yesPrice: number;
          noPrice: number;
          similarity: number;
          closeTime?: string;
        }>;
        intelligence?: {
          baseRate: number;
          recommendedRange: { low: number; high: number };
          biasWarnings: string[];
        };
      };

      const result: PredictResult = {
        timestamp: new Date().toISOString(),
        prediction: {
          id: data.prediction?.id || 'unknown',
          question,
          direction,
          probability,
          marketTicker: data.matchedMarket?.ticker,
          onChainTx: data.prediction?.onChainTx,
          calibrationTx: data.prediction?.calibrationTx,
          forecasterPda: data.prediction?.forecasterPda,
        },
        matchedMarket: data.matchedMarket ? {
          ticker: data.matchedMarket.ticker,
          title: data.matchedMarket.title,
          yesPrice: data.matchedMarket.yesPrice,
          noPrice: data.matchedMarket.noPrice,
          similarity: data.matchedMarket.similarity,
          closeTime: data.matchedMarket.closeTime,
        } : undefined,
        alternatives: data.alternatives?.map(a => ({
          ticker: a.ticker,
          title: a.title,
          yesPrice: a.yesPrice,
          noPrice: a.noPrice,
          similarity: a.similarity,
          closeTime: a.closeTime,
        })),
        intelligence: data.intelligence,
        autoResolve: !!data.matchedMarket,
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'predict',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['smartPredict', 'dflow', 'onchain'],
          apiCallsMade: 3,
        },
        hints: {
          mood: data.matchedMarket ? 'BULLISH' : 'NEUTRAL',
          suggestedActions: ['/compare', '/calibration'],
        },
      };
    } catch (error) {
      console.error('[PredictHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'PREDICT_FAILED',
          message: error instanceof Error ? error.message : 'Failed to create prediction',
          retryable: true,
          recoveryAction: 'Check your inputs and try again',
        },
        meta: {
          handlerId: 'predict',
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

registerHandler(predictHandler);

export default predictHandler;
