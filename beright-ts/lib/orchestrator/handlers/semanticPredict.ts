/**
 * Semantic Predict Handler
 *
 * Natural language prediction commands for the BeRight Terminal.
 *
 * Examples:
 * - "Predict YES on Chiefs Super Bowl with 0.5 SOL"
 * - "bet 1 SOL on NO for Bitcoin $100k"
 * - "putting 0.25 SOL on YES for Fed rate cut"
 *
 * Flow:
 * 1. Parse natural language to extract market, direction, amount
 * 2. Search for matching DFlow market
 * 3. Get Jupiter quote (demo mode = quote only)
 * 4. Record prediction on-chain to calibration program
 * 5. Return Solscan link
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import {
  parseNaturalLanguageCommand,
  executeSemanticPrediction,
  ParsedPredictionCommand,
  MarketMatch,
  JupiterQuoteResult,
  OnChainResult,
} from '../../../skills/semanticPredict';

// =============================================================================
// TYPES
// =============================================================================

export interface SemanticPredictResult {
  timestamp: string;
  parsedCommand: ParsedPredictionCommand;
  matchedMarket: MarketMatch | null;
  quote: JupiterQuoteResult | null;
  onChain: OnChainResult | null;
  summary: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Format result summary for display
 */
function formatSummary(
  parsed: ParsedPredictionCommand,
  matchedMarket: MarketMatch | null,
  quote: JupiterQuoteResult | null,
  onChain: OnChainResult | null
): string {
  let summary = `Prediction: ${parsed.direction} on "${parsed.market}" (${parsed.amount} ${parsed.token})\n\n`;

  // Market match
  if (matchedMarket) {
    summary += `Matched Market: ${matchedMarket.title}\n`;
    summary += `Current: YES ${(matchedMarket.yesPrice * 100).toFixed(0)}% / NO ${(matchedMarket.noPrice * 100).toFixed(0)}%\n`;
    summary += `Confidence: ${(matchedMarket.similarity * 100).toFixed(0)}% match\n\n`;
  } else {
    summary += `No exact market match found. Recording as custom prediction.\n\n`;
  }

  // Jupiter quote
  if (quote) {
    summary += `Quote: ${quote.inputAmount.toFixed(4)} ${quote.inputToken} -> ${quote.outputAmount.toFixed(2)} ${quote.outputToken}\n`;
    summary += `Rate: 1 ${quote.inputToken} = ${quote.rate.toFixed(2)} ${quote.outputToken}\n`;
    if (quote.priceImpact > 0) {
      summary += `Price Impact: ${(quote.priceImpact * 100).toFixed(3)}%\n`;
    }
    if (quote.isSimulation) {
      summary += `Mode: Demo (quote only, no execution)\n`;
    }
    summary += '\n';
  }

  // On-chain result
  if (onChain) {
    summary += `On-Chain Recorded\n`;
    const tx = onChain.calibrationTx || onChain.memoTx;
    summary += `TX: ${tx.slice(0, 8)}...${tx.slice(-8)}\n`;
    summary += `View: ${onChain.explorerUrl}\n`;
  }

  return summary;
}

// =============================================================================
// HANDLER
// =============================================================================

export const semanticPredictHandler: CommandHandler<SemanticPredictResult> = {
  id: 'semanticPredict',
  skillsUsed: ['semanticPredict', 'swap', 'onchain'],

  async execute(context: CommandContext): Promise<CommandResult<SemanticPredictResult>> {
    const startTime = Date.now();
    const messageText = context.message.text;

    try {
      // Step 1: Parse natural language command
      const parsed = parseNaturalLanguageCommand(messageText);

      if (!parsed) {
        return {
          success: false,
          error: {
            code: 'PARSE_FAILED',
            message: 'Could not understand prediction command.',
            retryable: false,
            recoveryAction: 'Try: "Predict YES on [market] with [amount] SOL" or "bet [amount] SOL on YES for [market]"',
          },
          meta: {
            handlerId: 'semanticPredict',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: [],
            apiCallsMade: 0,
          },
          hints: {
            mood: 'ERROR',
            suggestedActions: ['/help'],
          },
        };
      }

      // Validate amount
      if (isNaN(parsed.amount) || parsed.amount <= 0) {
        return {
          success: false,
          error: {
            code: 'INVALID_AMOUNT',
            message: 'Amount must be a positive number',
            retryable: false,
          },
          meta: {
            handlerId: 'semanticPredict',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: [],
            apiCallsMade: 0,
          },
          hints: { mood: 'ERROR' },
        };
      }

      // Get user info
      const userId = context.userId || context.gatewayContext?.chatId?.toString() || 'anonymous';
      const walletAddress = context.wallet?.publicKey;

      console.log('[SemanticPredictHandler] Parsed:', parsed);
      console.log('[SemanticPredictHandler] User:', userId, 'Wallet:', walletAddress);

      // Step 2: Execute prediction workflow
      const result = await executeSemanticPrediction({
        market: parsed.market,
        direction: parsed.direction,
        amount: parsed.amount,
        token: parsed.token,
        userId,
        walletAddress,
      });

      if (!result.success) {
        return {
          success: false,
          error: {
            code: 'PREDICTION_FAILED',
            message: result.error || 'Failed to record prediction',
            retryable: true,
          },
          meta: {
            handlerId: 'semanticPredict',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: ['semanticPredict'],
            apiCallsMade: 1,
          },
          hints: {
            mood: 'ERROR',
            suggestedActions: ['/help'],
          },
        };
      }

      // Step 3: Format success response
      const summary = formatSummary(
        parsed,
        result.marketMatch,
        result.jupiterQuote,
        result.onChainResult
      );

      const responseData: SemanticPredictResult = {
        timestamp: new Date().toISOString(),
        parsedCommand: parsed,
        matchedMarket: result.marketMatch,
        quote: result.jupiterQuote,
        onChain: result.onChainResult,
        summary,
      };

      return {
        success: true,
        data: responseData,
        meta: {
          handlerId: 'semanticPredict',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['semanticPredict', 'swap', 'onchain'],
          apiCallsMade: 3,
        },
        hints: {
          mood: result.marketMatch ? 'BULLISH' : 'NEUTRAL',
          suggestedActions: ['/calibration', '/positions'],
        },
      };
    } catch (error) {
      console.error('[SemanticPredictHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'SEMANTIC_PREDICT_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          retryable: true,
          recoveryAction: 'Check your inputs and try again',
        },
        meta: {
          handlerId: 'semanticPredict',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['semanticPredict'],
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

registerHandler(semanticPredictHandler);

export default semanticPredictHandler;
