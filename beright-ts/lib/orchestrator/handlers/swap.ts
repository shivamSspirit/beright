/**
 * Swap Handler
 *
 * Execute token swaps via Jupiter aggregator.
 *
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import { getQuote, executeSwap } from '../../../skills/swap';

// =============================================================================
// TYPES
// =============================================================================

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount: number;
  rate: number;
  priceImpact: number;
  routeSteps: number;
}

export interface SwapResult {
  timestamp: string;
  mode: 'quote' | 'execute';
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  outputAmount: number;
  rate: number;
  priceImpact: number;
  routeSteps: number;
  // Execution only
  txSignature?: string;
  solscanUrl?: string;
  isSimulation?: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

function getDecimals(mint: string): number {
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
  const BONK_MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

  if (mint === SOL_MINT) return 9;
  if (mint === USDC_MINT || mint === USDT_MINT) return 6;
  if (mint === BONK_MINT) return 5;
  return 9;
}

// =============================================================================
// HANDLER
// =============================================================================

export const swapHandler: CommandHandler<SwapResult> = {
  id: 'swap',
  skillsUsed: ['swap', 'jupiter'],

  async execute(context: CommandContext): Promise<CommandResult<SwapResult>> {
    const startTime = Date.now();

    try {
      // Parse parameters: /swap <inputToken> <outputToken> <amount> [--execute]
      const inputToken = (context.params.inputToken as string) ||
                         context.arguments?.[0] ||
                         '';
      const outputToken = (context.params.outputToken as string) ||
                          context.arguments?.[1] ||
                          '';
      const amountStr = (context.params.amount as string) ||
                        context.arguments?.[2] ||
                        '';
      const amount = parseFloat(amountStr) || 0;

      // Check for --execute flag
      const shouldExecute = context.message?.text?.includes('--execute') ||
                            context.params.execute === true;

      // Validate inputs
      if (!inputToken || !outputToken) {
        return {
          success: false,
          error: {
            code: 'MISSING_TOKENS',
            message: 'Please specify input and output tokens. Usage: /swap SOL USDC 1',
            retryable: false,
          },
          meta: {
            handlerId: 'swap',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: [],
            apiCallsMade: 0,
          },
          hints: {
            mood: 'NEUTRAL',
            suggestedActions: ['/swap SOL USDC 1'],
          },
        };
      }

      if (amount <= 0) {
        return {
          success: false,
          error: {
            code: 'INVALID_AMOUNT',
            message: 'Please specify a valid amount. Usage: /swap SOL USDC 1',
            retryable: false,
          },
          meta: {
            handlerId: 'swap',
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

      // Get quote from Jupiter
      const quote = await getQuote(inputToken, outputToken, amount);

      if (!quote) {
        return {
          success: false,
          error: {
            code: 'QUOTE_FAILED',
            message: `Could not get quote for ${inputToken} -> ${outputToken}. Check token symbols.`,
            retryable: true,
          },
          meta: {
            handlerId: 'swap',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: ['jupiter'],
            apiCallsMade: 1,
          },
          hints: {
            mood: 'ERROR',
            suggestedActions: ['/swap SOL USDC 1', '/swap USDC BONK 100'],
          },
        };
      }

      // Parse quote data
      const inputDecimals = getDecimals(quote.inputMint);
      const outputDecimals = getDecimals(quote.outputMint);
      const inputAmount = parseInt(quote.inAmount) / Math.pow(10, inputDecimals);
      const outputAmount = parseInt(quote.outAmount) / Math.pow(10, outputDecimals);
      const priceImpact = parseFloat(quote.priceImpactPct);
      const rate = outputAmount / inputAmount;

      if (shouldExecute) {
        // Execute the swap
        const swapResult = await executeSwap(inputToken, outputToken, amount);

        if (!swapResult.success) {
          return {
            success: false,
            error: {
              code: 'SWAP_FAILED',
              message: swapResult.error || 'Swap execution failed',
              retryable: true,
            },
            meta: {
              handlerId: 'swap',
              routeId: context.route.id,
              executedAt: new Date(),
              durationMs: Date.now() - startTime,
              skillsUsed: ['swap', 'jupiter'],
              apiCallsMade: 2,
            },
            hints: {
              mood: 'ERROR',
              suggestedActions: ['/wallet'],
            },
          };
        }

        const isSimulation = swapResult.txSignature === 'QUOTE_ONLY';

        const result: SwapResult = {
          timestamp: new Date().toISOString(),
          mode: 'execute',
          inputToken: inputToken.toUpperCase(),
          outputToken: outputToken.toUpperCase(),
          inputAmount: swapResult.inputAmount,
          outputAmount: swapResult.outputAmount,
          rate: swapResult.outputAmount / swapResult.inputAmount,
          priceImpact: swapResult.priceImpact,
          routeSteps: quote.routePlan?.length || 1,
          txSignature: swapResult.txSignature,
          solscanUrl: isSimulation ? undefined : `https://solscan.io/tx/${swapResult.txSignature}`,
          isSimulation,
        };

        return {
          success: true,
          data: result,
          meta: {
            handlerId: 'swap',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: ['swap', 'jupiter', 'wallet'],
            apiCallsMade: 2,
          },
          hints: {
            mood: isSimulation ? 'NEUTRAL' : 'BULLISH',
            suggestedActions: ['/wallet', '/positions'],
          },
        };
      }

      // Quote only mode
      const result: SwapResult = {
        timestamp: new Date().toISOString(),
        mode: 'quote',
        inputToken: inputToken.toUpperCase(),
        outputToken: outputToken.toUpperCase(),
        inputAmount,
        outputAmount,
        rate,
        priceImpact,
        routeSteps: quote.routePlan?.length || 1,
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'swap',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['jupiter'],
          apiCallsMade: 1,
        },
        hints: {
          mood: priceImpact > 0.01 ? 'BEARISH' : 'NEUTRAL',
          suggestedActions: ['/swap ' + inputToken + ' ' + outputToken + ' ' + amount + ' --execute'],
        },
      };
    } catch (error) {
      console.error('[SwapHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'SWAP_ERROR',
          message: error instanceof Error ? error.message : 'Swap failed',
          retryable: true,
        },
        meta: {
          handlerId: 'swap',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['swap'],
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

registerHandler(swapHandler);

export default swapHandler;
