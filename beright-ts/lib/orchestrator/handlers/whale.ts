/**
 * Whale Handler
 *
 * Track whale activity and large wallet movements.
 *
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import {
  whaleWatch,
  checkWallet,
  addWhale,
} from '../../../skills/whale';

// =============================================================================
// TYPES
// =============================================================================

export interface WhaleMovement {
  wallet: string;
  whaleName: string;
  whaleAccuracy: number;
  signature: string;
  timestamp: string | null;
  type: string;
  totalUsd: number;
  fee: number;
  description: string;
}

export interface WalletInfo {
  address: string;
  balance: {
    sol: number;
    usdc: number;
  } | null;
  recentTransactions: Array<{
    totalUsd: number;
    type: string;
  }>;
}

export interface WhaleResult {
  timestamp: string;
  mode: 'scan' | 'check' | 'add';
  // For scan
  movements?: WhaleMovement[];
  totalMovements?: number;
  totalVolume?: number;
  trackedWhales?: number;
  // For check
  wallet?: WalletInfo;
  // For add
  added?: {
    address: string;
    name: string;
  };
}

// =============================================================================
// HANDLER
// =============================================================================

export const whaleHandler: CommandHandler<WhaleResult> = {
  id: 'whale',
  skillsUsed: ['whale', 'helius'],

  async execute(context: CommandContext): Promise<CommandResult<WhaleResult>> {
    const startTime = Date.now();

    try {
      const rawMessage = context.message?.text || '';
      const args = rawMessage.replace(/^\/whale\s*/i, '').trim();

      // Check specific wallet: /whale check <address>
      const checkMatch = args.match(/^check\s+([A-Za-z0-9]{32,44})/i);
      if (checkMatch) {
        const address = checkMatch[1];
        const response = await checkWallet(address);

        // Type assertion for response data
        const walletData = response.data as {
          balance?: { sol: number; usdc: number };
          txs?: any[]
        } | undefined;

        // Parse wallet data from response
        const walletInfo: WalletInfo = {
          address,
          balance: walletData?.balance || null,
          recentTransactions: (walletData?.txs || [])
            .filter((tx: any) => tx)
            .slice(0, 5)
            .map((tx: any) => ({
              totalUsd: tx.totalUsd || 0,
              type: tx.type || 'unknown',
            })),
        };

        const result: WhaleResult = {
          timestamp: new Date().toISOString(),
          mode: 'check',
          wallet: walletInfo,
        };

        return {
          success: true,
          data: result,
          meta: {
            handlerId: 'whale',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: ['whale', 'helius'],
            apiCallsMade: 2,
          },
          hints: {
            mood: 'NEUTRAL',
            suggestedActions: ['/whale'],
          },
        };
      }

      // Add whale to tracking: /whale add <address> [name]
      const addMatch = args.match(/^add\s+([A-Za-z0-9]{32,44})\s*(.+)?$/i);
      if (addMatch) {
        const address = addMatch[1];
        const name = addMatch[2]?.trim() || 'Unknown';

        addWhale(address, name);

        const result: WhaleResult = {
          timestamp: new Date().toISOString(),
          mode: 'add',
          added: {
            address,
            name,
          },
        };

        return {
          success: true,
          data: result,
          meta: {
            handlerId: 'whale',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: ['whale'],
            apiCallsMade: 0,
          },
          hints: {
            mood: 'BULLISH',
            suggestedActions: ['/whale'],
          },
        };
      }

      // Default: scan for whale activity
      const response = await whaleWatch();
      const alerts = (response.data as WhaleMovement[]) || [];

      // Calculate total volume
      const totalVolume = alerts.reduce((sum, a) => sum + a.totalUsd, 0);

      const result: WhaleResult = {
        timestamp: new Date().toISOString(),
        mode: 'scan',
        movements: alerts.slice(0, 10),
        totalMovements: alerts.length,
        totalVolume,
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'whale',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['whale', 'helius'],
          apiCallsMade: 1,
        },
        hints: {
          mood: alerts.length > 0 ? 'ALERT' : 'NEUTRAL',
          suggestedActions: alerts.length > 0
            ? ['/research']
            : ['/whale add <address>'],
        },
      };
    } catch (error) {
      console.error('[WhaleHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'WHALE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to scan whale activity',
          retryable: true,
        },
        meta: {
          handlerId: 'whale',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['whale'],
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

registerHandler(whaleHandler);

export default whaleHandler;
