/**
 * Wallet Handler
 *
 * Manage user wallets for DFlow trading.
 *
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import { handleWallet, getOrCreateWallet } from '../../../skills/dflowTrade';

// =============================================================================
// TYPES
// =============================================================================

export interface WalletResult {
  timestamp: string;
  publicKey: string;
  isNew: boolean;
  balance: {
    sol: number;
    usdc: number;
  };
  // Explorer link
  solscanUrl: string;
}

// =============================================================================
// HANDLER
// =============================================================================

export const walletHandler: CommandHandler<WalletResult> = {
  id: 'wallet',
  skillsUsed: ['wallet', 'dflow'],

  async execute(context: CommandContext): Promise<CommandResult<WalletResult>> {
    const startTime = Date.now();

    try {
      // Get user ID
      const userId = context.userId || context.gatewayContext?.chatId?.toString() || context.userId;

      if (!userId) {
        return {
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Could not identify user. Please try again.',
            retryable: false,
          },
          meta: {
            handlerId: 'wallet',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: [],
            apiCallsMade: 0,
          },
          hints: {
            mood: 'ERROR',
          },
        };
      }

      // Get or create wallet using skill
      const response = await handleWallet(userId);

      // Parse the response to extract wallet data
      const publicKeyMatch = response.text.match(/`([A-Za-z0-9]{32,44})`/);
      const publicKey = publicKeyMatch?.[1] || '';

      // Extract balances from response
      const solMatch = response.text.match(/SOL:\s*([\d.]+)/);
      const usdcMatch = response.text.match(/USDC:\s*([\d.]+)/);

      const sol = solMatch ? parseFloat(solMatch[1]) : 0;
      const usdc = usdcMatch ? parseFloat(usdcMatch[1]) : 0;

      const isNew = response.text.includes('NEW WALLET CREATED');

      const result: WalletResult = {
        timestamp: new Date().toISOString(),
        publicKey,
        isNew,
        balance: {
          sol,
          usdc,
        },
        solscanUrl: `https://solscan.io/account/${publicKey}`,
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'wallet',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['wallet', 'dflow'],
          apiCallsMade: 1,
        },
        hints: {
          mood: isNew ? 'BULLISH' : 'NEUTRAL',
          suggestedActions: isNew
            ? ['/dflow bitcoin', '/hot']
            : ['/trade', '/positions', '/swap SOL USDC 1'],
        },
      };
    } catch (error) {
      console.error('[WalletHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'WALLET_FAILED',
          message: error instanceof Error ? error.message : 'Failed to access wallet',
          retryable: true,
        },
        meta: {
          handlerId: 'wallet',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['wallet'],
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

registerHandler(walletHandler);

export default walletHandler;
