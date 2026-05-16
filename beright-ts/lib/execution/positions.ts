/**
 * Position Manager
 *
 * Aggregated position tracking across all platforms.
 * Real-time P&L calculation and risk monitoring.
 *
 * @author BeRight Protocol
 */

import {
  Position,
  PositionSummary,
  PositionStatus,
  OrderSide,
  calculatePnL,
  calculateMaxLoss,
  calculateMaxGain,
} from './types';
import { Platform, MarketCategory, UnifiedMarket } from '../dataFabric/types';
import { getConnector, getConnectedConnectors } from './connectors';
import { getDataFabric } from '../dataFabric';

// =============================================================================
// POSITION MANAGER
// =============================================================================

export class PositionManager {
  // Aggregated positions (keyed by unified market ID)
  private aggregatedPositions: Map<string, Position[]> = new Map();

  // Price cache (to avoid excessive API calls)
  private priceCache: Map<string, { price: number; timestamp: Date }> = new Map();
  private readonly priceCacheTTL = 30000; // 30 seconds

  // ==========================================================================
  // POSITION RETRIEVAL
  // ==========================================================================

  /**
   * Get all positions across all platforms
   */
  async getAllPositions(): Promise<Position[]> {
    const connectors = getConnectedConnectors();
    const allPositions: Position[] = [];

    await Promise.all(
      connectors.map(async connector => {
        try {
          const positions = await connector.getPositions();
          allPositions.push(...positions);
        } catch (error) {
          console.error(`[Positions] Failed to fetch from ${connector.platform}:`, error);
        }
      })
    );

    // Update P&L for all positions
    await this.updatePrices(allPositions);

    return allPositions;
  }

  /**
   * Get positions for a specific market
   */
  async getPositionsForMarket(marketId: string): Promise<Position[]> {
    const allPositions = await this.getAllPositions();

    return allPositions.filter(p => p.marketId === marketId);
  }

  /**
   * Get positions by platform
   */
  async getPositionsByPlatform(platform: Platform): Promise<Position[]> {
    const connector = getConnector(platform);
    if (!connector || !connector.isConnected()) {
      return [];
    }

    const positions = await connector.getPositions();
    await this.updatePrices(positions);

    return positions;
  }

  /**
   * Get open positions only
   */
  async getOpenPositions(): Promise<Position[]> {
    const allPositions = await this.getAllPositions();

    return allPositions.filter(p => p.status === 'OPEN');
  }

  /**
   * Get aggregated positions (same market across platforms)
   */
  async getAggregatedPositions(): Promise<Map<string, Position[]>> {
    const allPositions = await this.getAllPositions();
    const aggregated = new Map<string, Position[]>();

    // Try to group by unified market ID
    const dataFabric = getDataFabric();

    for (const position of allPositions) {
      // Try to find unified market
      let unifiedId = position.marketId;

      try {
        const market = await dataFabric.getMarket(position.marketId);
        if (market?.market) {
          unifiedId = market.market.id;
        }
      } catch {
        // Keep original ID
      }

      const existing = aggregated.get(unifiedId) || [];
      existing.push(position);
      aggregated.set(unifiedId, existing);
    }

    this.aggregatedPositions = aggregated;
    return aggregated;
  }

  // ==========================================================================
  // P&L CALCULATION
  // ==========================================================================

  /**
   * Update current prices for positions
   */
  private async updatePrices(positions: Position[]): Promise<void> {
    const dataFabric = getDataFabric();

    for (const position of positions) {
      try {
        // Check cache first
        const cached = this.priceCache.get(position.marketId);
        if (cached && Date.now() - cached.timestamp.getTime() < this.priceCacheTTL) {
          position.currentPrice = cached.price;
        } else {
          // Fetch current price
          const market = await dataFabric.getMarket(position.marketId);
          if (market?.market) {
            position.currentPrice = market.market.consensusPrice;
            this.priceCache.set(position.marketId, {
              price: market.market.consensusPrice,
              timestamp: new Date(),
            });
          }
        }

        // Calculate P&L
        const pnl = calculatePnL(
          position.side,
          position.avgEntryPrice,
          position.currentPrice,
          position.size
        );

        position.unrealizedPnL = pnl.unrealized;
        position.unrealizedPnLPct = pnl.pct;

        // Update max loss/gain
        position.maxLoss = calculateMaxLoss(position.side, position.avgEntryPrice, position.size);
        position.maxGain = calculateMaxGain(position.side, position.avgEntryPrice, position.size);

        position.updatedAt = new Date();
      } catch (error) {
        console.error(`[Positions] Failed to update price for ${position.marketId}:`, error);
      }
    }
  }

  /**
   * Get position summary
   */
  async getSummary(): Promise<PositionSummary> {
    const positions = await this.getAllPositions();
    const openPositions = positions.filter(p => p.status === 'OPEN');

    const totalCostBasis = openPositions.reduce((sum, p) => sum + p.costBasis, 0);
    const totalUnrealizedPnL = openPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
    const totalRealizedPnL = positions.reduce((sum, p) => sum + p.realizedPnL, 0);
    const totalFees = positions.reduce((sum, p) => sum + p.totalFees, 0);

    // Group by platform
    const byPlatform: PositionSummary['byPlatform'] = {} as any;
    for (const position of openPositions) {
      if (!byPlatform[position.platform]) {
        byPlatform[position.platform] = {
          positions: 0,
          costBasis: 0,
          unrealizedPnL: 0,
        };
      }
      byPlatform[position.platform].positions++;
      byPlatform[position.platform].costBasis += position.costBasis;
      byPlatform[position.platform].unrealizedPnL += position.unrealizedPnL;
    }

    // Group by category
    const byCategory: PositionSummary['byCategory'] = {} as any;
    for (const position of openPositions) {
      const category = position.marketCategory || 'other';
      if (!byCategory[category]) {
        byCategory[category] = {
          positions: 0,
          costBasis: 0,
          unrealizedPnL: 0,
        };
      }
      byCategory[category].positions++;
      byCategory[category].costBasis += position.costBasis;
      byCategory[category].unrealizedPnL += position.unrealizedPnL;
    }

    return {
      totalPositions: positions.length,
      openPositions: openPositions.length,
      totalCostBasis,
      totalUnrealizedPnL,
      totalRealizedPnL,
      totalFees,
      byPlatform,
      byCategory,
    };
  }

  // ==========================================================================
  // POSITION ANALYSIS
  // ==========================================================================

  /**
   * Get positions with highest P&L
   */
  async getTopWinners(limit: number = 5): Promise<Position[]> {
    const positions = await this.getOpenPositions();

    return [...positions]
      .sort((a, b) => b.unrealizedPnL - a.unrealizedPnL)
      .slice(0, limit);
  }

  /**
   * Get positions with lowest P&L
   */
  async getTopLosers(limit: number = 5): Promise<Position[]> {
    const positions = await this.getOpenPositions();

    return [...positions]
      .sort((a, b) => a.unrealizedPnL - b.unrealizedPnL)
      .slice(0, limit);
  }

  /**
   * Get positions approaching resolution
   */
  async getClosingSoon(hoursUntil: number = 24): Promise<Position[]> {
    const positions = await this.getOpenPositions();
    const cutoff = new Date(Date.now() + hoursUntil * 60 * 60 * 1000);

    return positions.filter(p => p.marketCloseDate && p.marketCloseDate <= cutoff);
  }

  /**
   * Get positions with significant P&L moves
   */
  async getSignificantMoves(thresholdPct: number = 0.1): Promise<Position[]> {
    const positions = await this.getOpenPositions();

    return positions.filter(p => Math.abs(p.unrealizedPnLPct) >= thresholdPct);
  }

  /**
   * Calculate total exposure
   */
  async getTotalExposure(): Promise<{
    totalAtRisk: number;
    totalMaxGain: number;
    riskRewardRatio: number;
    exposureByPlatform: Record<Platform, number>;
    exposureByCategory: Record<MarketCategory, number>;
  }> {
    const positions = await this.getOpenPositions();

    const totalAtRisk = positions.reduce((sum, p) => sum + p.maxLoss, 0);
    const totalMaxGain = positions.reduce((sum, p) => sum + p.maxGain, 0);
    const riskRewardRatio = totalAtRisk > 0 ? totalMaxGain / totalAtRisk : 0;

    const exposureByPlatform: Record<Platform, number> = {} as any;
    const exposureByCategory: Record<MarketCategory, number> = {} as any;

    for (const position of positions) {
      exposureByPlatform[position.platform] =
        (exposureByPlatform[position.platform] || 0) + position.maxLoss;

      const category = position.marketCategory || 'other';
      exposureByCategory[category] =
        (exposureByCategory[category] || 0) + position.maxLoss;
    }

    return {
      totalAtRisk,
      totalMaxGain,
      riskRewardRatio,
      exposureByPlatform,
      exposureByCategory,
    };
  }

  // ==========================================================================
  // HEDGING ANALYSIS
  // ==========================================================================

  /**
   * Find positions that could hedge each other
   */
  async findHedges(): Promise<{
    marketId: string;
    question: string;
    yesPositions: Position[];
    noPositions: Position[];
    netExposure: number;
    hedgeOpportunity: boolean;
  }[]> {
    const aggregated = await this.getAggregatedPositions();
    const hedges: ReturnType<typeof this.findHedges> extends Promise<infer T> ? T : never = [];

    for (const [marketId, positions] of aggregated) {
      const yesPositions = positions.filter(p => p.side === 'YES');
      const noPositions = positions.filter(p => p.side === 'NO');

      if (yesPositions.length > 0 || noPositions.length > 0) {
        const yesExposure = yesPositions.reduce((sum, p) => sum + p.size, 0);
        const noExposure = noPositions.reduce((sum, p) => sum + p.size, 0);
        const netExposure = yesExposure - noExposure;

        hedges.push({
          marketId,
          question: positions[0]?.marketQuestion || marketId,
          yesPositions,
          noPositions,
          netExposure,
          hedgeOpportunity: yesPositions.length > 0 && noPositions.length > 0,
        });
      }
    }

    return hedges;
  }

  /**
   * Find correlated positions (same category, opposing bets)
   */
  async findCorrelatedPositions(): Promise<{
    category: MarketCategory;
    positions: Position[];
    netBias: 'YES' | 'NO' | 'NEUTRAL';
  }[]> {
    const positions = await this.getOpenPositions();
    const byCategory = new Map<MarketCategory, Position[]>();

    for (const position of positions) {
      const category = position.marketCategory || 'other';
      const existing = byCategory.get(category) || [];
      existing.push(position);
      byCategory.set(category, existing);
    }

    return Array.from(byCategory.entries()).map(([category, positions]) => {
      const yesSize = positions
        .filter(p => p.side === 'YES')
        .reduce((sum, p) => sum + p.size, 0);
      const noSize = positions
        .filter(p => p.side === 'NO')
        .reduce((sum, p) => sum + p.size, 0);

      const netBias: 'YES' | 'NO' | 'NEUTRAL' =
        yesSize > noSize * 1.2 ? 'YES' :
        noSize > yesSize * 1.2 ? 'NO' :
        'NEUTRAL';

      return { category, positions, netBias };
    });
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let positionManager: PositionManager | null = null;

export function getPositionManager(): PositionManager {
  if (!positionManager) {
    positionManager = new PositionManager();
  }
  return positionManager;
}

export default PositionManager;
