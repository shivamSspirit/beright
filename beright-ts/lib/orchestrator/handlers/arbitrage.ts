/**
 * Arbitrage Handler
 *
 * Detect cross-platform arbitrage opportunities.
 *
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import { arbitrage } from '../../../skills/arbitrage';
import { ArbitrageOpportunity } from '../../../types/index';

// =============================================================================
// TYPES
// =============================================================================

export interface ArbOpportunity {
  topic: string;
  platformA: string;
  platformB: string;
  marketATitle?: string;
  marketBTitle?: string;
  priceAYes: number;
  priceBYes: number;
  spread: number;
  strategy: string;
  profitPercent: number;
  matchConfidence: number;
  volumeA?: number;
  volumeB?: number;
  riskScore?: number;
}

export interface ArbitrageResult {
  timestamp: string;
  query?: string;
  opportunities: ArbOpportunity[];
  totalOpportunities: number;
  bestSpread?: number;
  platformsScanned: string[];
  scanDurationMs: number;
}

// =============================================================================
// HANDLER
// =============================================================================

export const arbitrageHandler: CommandHandler<ArbitrageResult> = {
  id: 'arbitrage',
  skillsUsed: ['arbitrage', 'markets'],

  async execute(context: CommandContext): Promise<CommandResult<ArbitrageResult>> {
    const startTime = Date.now();

    try {
      // Parse query from args
      const rawMessage = context.message?.text || '';
      const query = rawMessage.replace(/^\/(arb|arbitrage|spread)\s*/i, '').trim() || undefined;

      // Run arbitrage scan
      const response = await arbitrage(query);
      const opportunities = (response.data as ArbitrageOpportunity[]) || [];

      // Transform to our format
      const opps: ArbOpportunity[] = opportunities.map(o => ({
        topic: o.topic,
        platformA: o.platformA,
        platformB: o.platformB,
        marketATitle: o.marketATitle,
        marketBTitle: o.marketBTitle,
        priceAYes: o.priceAYes,
        priceBYes: o.priceBYes,
        spread: o.spread,
        strategy: o.strategy,
        profitPercent: o.profitPercent,
        matchConfidence: o.matchConfidence,
        volumeA: o.volumeA,
        volumeB: o.volumeB,
      }));

      // Find best spread
      const bestSpread = opps.length > 0
        ? Math.max(...opps.map(o => o.spread))
        : undefined;

      const result: ArbitrageResult = {
        timestamp: new Date().toISOString(),
        query,
        opportunities: opps.slice(0, 10),
        totalOpportunities: opps.length,
        bestSpread,
        platformsScanned: ['polymarket', 'kalshi', 'manifold'],
        scanDurationMs: Date.now() - startTime,
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'arbitrage',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['arbitrage', 'markets'],
          apiCallsMade: 3, // One per platform
        },
        hints: {
          mood: opps.length > 0 ? 'ALERT' : 'NEUTRAL',
          suggestedActions: opps.length > 0
            ? ['/research ' + (opps[0]?.topic?.split(' ').slice(0, 3).join(' ') || '')]
            : ['/arb bitcoin', '/arb election'],
        },
      };
    } catch (error) {
      console.error('[ArbitrageHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'ARBITRAGE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to scan for arbitrage',
          retryable: true,
        },
        meta: {
          handlerId: 'arbitrage',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['arbitrage'],
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

registerHandler(arbitrageHandler);

export default arbitrageHandler;
