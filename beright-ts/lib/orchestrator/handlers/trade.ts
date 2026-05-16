/**
 * Trade Handler
 *
 * Executes trades on DFlow prediction markets.
 * Uses smart routing (DFlow vs Jupiter) for best execution.
 *
 * @see docs/ADR-002-TELEGRAM-AS-GATEWAY.md
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import { handleTrade as executeTrade } from '../../../skills/dflowTrade';
import { getDFlowMarket, USDC_MINT } from '../../dflow';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Trade execution result
 */
export interface TradeResult {
  success: boolean;
  ticker: string;
  marketTitle: string;
  side: 'YES' | 'NO';
  amountUsd: number;
  outputAmount: number;
  effectivePrice: number;
  route: 'dflow' | 'jupiter';
  signature?: string;
  savingsPct?: number;
  timestamp: string;
  // For linking to explorer
  solscanUrl?: string;
}

// =============================================================================
// HANDLER
// =============================================================================

/**
 * Trade Handler
 *
 * Executes trades with smart routing.
 */
export const tradeHandler: CommandHandler<TradeResult> = {
  id: 'trade',
  skillsUsed: ['dflow', 'wallet'],

  async execute(context: CommandContext): Promise<CommandResult<TradeResult>> {
    const startTime = Date.now();

    try {
      // Check authentication
      if (!context.userId) {
        return {
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'You need to be authenticated to trade. Use /wallet first.',
            retryable: false,
          },
          meta: {
            handlerId: 'trade',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: [],
            apiCallsMade: 0,
          },
          hints: {
            mood: 'NEUTRAL',
            suggestedActions: ['/wallet'],
          },
        };
      }

      // Parse parameters
      const ticker = (context.params.ticker as string) ||
                     context.arguments?.[0] ||
                     '';

      const side = ((context.params.side as string) ||
                    context.arguments?.[1] ||
                    '').toUpperCase() as 'YES' | 'NO';

      const amountStr = (context.params.amount as string) ||
                        context.arguments?.[2] ||
                        '';
      const amountUsd = parseFloat(amountStr) || 0;

      // Validate inputs
      if (!ticker) {
        return {
          success: false,
          error: {
            code: 'MISSING_TICKER',
            message: 'Please provide a market ticker. Usage: /trade <ticker> YES|NO <amount>',
            retryable: false,
          },
          meta: {
            handlerId: 'trade',
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
            message: 'Side must be YES or NO. Usage: /trade <ticker> YES|NO <amount>',
            retryable: false,
          },
          meta: {
            handlerId: 'trade',
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

      if (amountUsd < 1) {
        return {
          success: false,
          error: {
            code: 'INVALID_AMOUNT',
            message: 'Amount must be at least $1. Usage: /trade <ticker> YES|NO <amount>',
            retryable: false,
          },
          meta: {
            handlerId: 'trade',
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

      if (amountUsd > 100000) {
        return {
          success: false,
          error: {
            code: 'AMOUNT_TOO_LARGE',
            message: 'Maximum trade size is $100,000. Contact support for larger trades.',
            retryable: false,
          },
          meta: {
            handlerId: 'trade',
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

      // Get market details for title
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
            handlerId: 'trade',
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

      // Check market is tradeable
      const usdcAccounts = market.accounts?.[USDC_MINT];
      if (!usdcAccounts?.yesMint || !usdcAccounts?.noMint || !usdcAccounts?.isInitialized) {
        return {
          success: false,
          error: {
            code: 'MARKET_NOT_INITIALIZED',
            message: `Market ${ticker} is not initialized for trading yet.`,
            retryable: false,
          },
          meta: {
            handlerId: 'trade',
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

      // Execute trade using existing skill
      const skillResponse = await executeTrade(
        context.userId,
        ticker,
        side,
        amountUsd,
        { useSmartRouting: true }
      );

      if (skillResponse.mood === 'ERROR') {
        // Parse error message for specific handling
        const errorMsg = skillResponse.text;
        let errorCode = 'TRADE_FAILED';

        if (errorMsg.includes('insufficient') || errorMsg.includes('Insufficient')) {
          errorCode = 'INSUFFICIENT_BALANCE';
        } else if (errorMsg.includes("don't have a wallet")) {
          errorCode = 'NO_WALLET';
        }

        return {
          success: false,
          error: {
            code: errorCode,
            message: errorMsg,
            retryable: errorCode === 'TRADE_FAILED',
            recoveryAction: errorCode === 'INSUFFICIENT_BALANCE'
              ? 'Fund your wallet first: /wallet'
              : errorCode === 'NO_WALLET'
              ? 'Create a wallet: /wallet'
              : 'Try again or check market liquidity',
          },
          meta: {
            handlerId: 'trade',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: ['dflow', 'wallet'],
            apiCallsMade: 2,
          },
          hints: {
            mood: 'ERROR',
            suggestedActions: errorCode === 'INSUFFICIENT_BALANCE' || errorCode === 'NO_WALLET'
              ? ['/wallet']
              : ['/quote ' + ticker + ' ' + side + ' ' + amountUsd],
          },
        };
      }

      // Extract trade data from skill response
      const tradeData = skillResponse.data as {
        signature: string;
        details?: {
          inputAmount: string;
          outputAmount: string;
        };
        route: 'dflow' | 'jupiter';
        routingInfo?: {
          savingsPct: number;
        };
      };

      const outputAmount = tradeData.details?.outputAmount
        ? parseFloat(tradeData.details.outputAmount)
        : amountUsd / 0.5; // Fallback estimate

      const effectivePrice = amountUsd / outputAmount;

      const result: TradeResult = {
        success: true,
        ticker,
        marketTitle: market.title,
        side,
        amountUsd,
        outputAmount,
        effectivePrice,
        route: tradeData.route,
        signature: tradeData.signature,
        savingsPct: tradeData.routingInfo?.savingsPct,
        timestamp: new Date().toISOString(),
        solscanUrl: `https://solscan.io/tx/${tradeData.signature}`,
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'trade',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['dflow', 'wallet'],
          apiCallsMade: 3,
        },
        hints: {
          mood: 'BULLISH',
          suggestedActions: ['/positions'],
        },
      };
    } catch (error) {
      console.error('[TradeHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'TRADE_FAILED',
          message: error instanceof Error ? error.message : 'Trade execution failed',
          retryable: true,
          recoveryAction: 'Check your balance and try again',
        },
        meta: {
          handlerId: 'trade',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['dflow'],
          apiCallsMade: 0,
        },
        hints: {
          mood: 'ERROR',
          suggestedActions: ['/wallet', '/positions'],
        },
      };
    }
  },
};

// =============================================================================
// AUTO-REGISTER
// =============================================================================

registerHandler(tradeHandler);

// =============================================================================
// EXPORTS
// =============================================================================

export default tradeHandler;
