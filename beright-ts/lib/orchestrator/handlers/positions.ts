/**
 * Positions Handler
 *
 * Shows user's DFlow positions from on-chain data.
 * Includes wallet balance and unrealized P&L.
 *
 * @see docs/ADR-002-TELEGRAM-AS-GATEWAY.md
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import { handlePositions as getPositions, getOrCreateWallet } from '../../../skills/dflowTrade';
import { Market } from '../../../types/market';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Position data
 */
export interface Position {
  marketTicker: string;
  marketTitle: string;
  side: 'YES' | 'NO';
  shares: number;
  avgPrice: number;
  currentPrice: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
}

/**
 * Wallet balance
 */
export interface WalletBalance {
  sol: number;
  usdc: number;
}

/**
 * Positions result
 */
export interface PositionsResult {
  publicKey: string;
  balance: WalletBalance;
  positions: Position[];
  totalValue: number;
  totalUnrealizedPnL: number;
  timestamp: string;
}

// =============================================================================
// HANDLER
// =============================================================================

/**
 * Positions Handler
 *
 * Returns user's on-chain positions.
 */
export const positionsHandler: CommandHandler<PositionsResult> = {
  id: 'positions',
  skillsUsed: ['dflow', 'wallet'],

  async execute(context: CommandContext): Promise<CommandResult<PositionsResult>> {
    const startTime = Date.now();

    try {
      // Check authentication
      if (!context.userId) {
        return {
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'You need to be authenticated to view positions. Use /wallet first.',
            retryable: false,
          },
          meta: {
            handlerId: 'positions',
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

      // Get or create wallet to get public key
      const { publicKey, isNew } = getOrCreateWallet(context.userId);

      if (isNew) {
        return {
          success: true,
          data: {
            publicKey,
            balance: { sol: 0, usdc: 0 },
            positions: [],
            totalValue: 0,
            totalUnrealizedPnL: 0,
            timestamp: new Date().toISOString(),
          },
          meta: {
            handlerId: 'positions',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: ['wallet'],
            apiCallsMade: 0,
          },
          hints: {
            mood: 'NEUTRAL',
            suggestedActions: ['/dflow', '/hot'],
          },
        };
      }

      // Get positions using existing skill
      const skillResponse = await getPositions(context.userId);

      if (skillResponse.mood === 'ERROR') {
        return {
          success: false,
          error: {
            code: 'POSITIONS_FETCH_FAILED',
            message: skillResponse.text,
            retryable: true,
            recoveryAction: 'Try again in a moment',
          },
          meta: {
            handlerId: 'positions',
            routeId: context.route.id,
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
            skillsUsed: ['dflow', 'wallet'],
            apiCallsMade: 1,
          },
          hints: {
            mood: 'ERROR',
          },
        };
      }

      // Extract position data from skill response
      const positionData = skillResponse.data as {
        positions: Array<{
          market: { ticker: string; title: string };
          side: 'YES' | 'NO';
          balance: number;
          avgPrice: number;
          currentPrice: number;
          value: number;
          unrealizedPnL: number;
          unrealizedPnLPct: number;
        }>;
        balance: { sol: number; usdc: number };
        totalValue: number;
      };

      // Transform to our format
      const positions: Position[] = (positionData?.positions || []).map(p => ({
        marketTicker: p.market.ticker,
        marketTitle: p.market.title,
        side: p.side,
        shares: p.balance,
        avgPrice: p.avgPrice,
        currentPrice: p.currentPrice,
        currentValue: p.value,
        unrealizedPnL: p.unrealizedPnL,
        unrealizedPnLPct: p.unrealizedPnLPct,
      }));

      // Calculate totals
      const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
      const totalUnrealizedPnL = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);

      const result: PositionsResult = {
        publicKey,
        balance: positionData?.balance || { sol: 0, usdc: 0 },
        positions,
        totalValue,
        totalUnrealizedPnL,
        timestamp: new Date().toISOString(),
      };

      // Determine mood based on P&L
      const mood = totalUnrealizedPnL > 0 ? 'BULLISH' : totalUnrealizedPnL < 0 ? 'BEARISH' : 'NEUTRAL';

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'positions',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['dflow', 'wallet'],
          apiCallsMade: 2,
        },
        hints: {
          mood,
          suggestedActions: positions.length > 0
            ? ['/hot', '/dflow']
            : ['/dflow bitcoin', '/hot'],
        },
      };
    } catch (error) {
      console.error('[PositionsHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'POSITIONS_FETCH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch positions',
          retryable: true,
          recoveryAction: 'Try again in a moment',
        },
        meta: {
          handlerId: 'positions',
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

registerHandler(positionsHandler);

// =============================================================================
// EXPORTS
// =============================================================================

export default positionsHandler;
