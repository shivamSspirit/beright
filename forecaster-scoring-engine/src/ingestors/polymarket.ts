/**
 * Polymarket Ingestor
 *
 * Fetches public resolved position history from the Polymarket Data API.
 * API Docs: https://docs.polymarket.com
 */

import { v4 as uuidv4 } from 'uuid';

import { V3Prediction } from '../v3/types';
import { BaseIngestor, IngestorConfig } from './base';

interface PolymarketClosedPosition {
  proxyWallet: string;
  asset: string;
  conditionId: string;
  avgPrice: number;
  totalBought: number;
  realizedPnl: number;
  curPrice: number;
  title: string;
  slug: string;
  eventSlug: string;
  outcome: string;
  outcomeIndex: number;
  oppositeOutcome: string;
  oppositeAsset: string;
  endDate: string;
  timestamp: number;
}

interface PolymarketLeaderboardRow {
  proxyWallet?: string;
  address?: string;
  user?: string;
}

export interface PolymarketScoringSummary {
  closedPositions: number;
  resolvedClosedPositions: number;
  scoredResolvedMarkets: number;
  realizedPnl: number;
  resolvedRealizedPnl: number;
}

export interface PolymarketScoringData {
  predictions: V3Prediction[];
  summary: PolymarketScoringSummary;
}

export class PolymarketIngestor extends BaseIngestor {
  constructor(config?: Partial<IngestorConfig>) {
    super('polymarket', {
      baseUrl: 'https://data-api.polymarket.com',
      rateLimitPerMinute: 60,
      ...config,
    });
  }

  /**
   * Fetch resolved predictions for a Polymarket wallet address.
   *
   * The Data API exposes closed positions with the final token price. For binary
   * markets, a final `curPrice` of 1 means that outcome token won and 0 means it
   * lost. We map outcomeIndex 0 to the canonical YES event for V3 scoring.
   */
  async fetchUserPredictions(walletAddress: string): Promise<V3Prediction[]> {
    const scoringData = await this.fetchUserScoringData(walletAddress);
    return scoringData.predictions;
  }

  async fetchUserScoringData(walletAddress: string): Promise<PolymarketScoringData> {
    try {
      const closedPositions = await this.fetchClosedPositions(walletAddress);
      const resolvedPositions = closedPositions.filter((position) => this.isResolvedBinaryPosition(position));
      const primaryPositions = this.selectPrimaryPositionPerMarket(resolvedPositions);

      const predictions = primaryPositions.map((position) => this.toPrediction(walletAddress, position));
      const summary: PolymarketScoringSummary = {
        closedPositions: closedPositions.length,
        resolvedClosedPositions: resolvedPositions.length,
        scoredResolvedMarkets: predictions.length,
        realizedPnl: this.sumRealizedPnl(closedPositions),
        resolvedRealizedPnl: this.sumRealizedPnl(resolvedPositions),
      };

      this.logger.info(
        {
          walletAddress,
          closedPositions: summary.closedPositions,
          resolvedPositions: summary.resolvedClosedPositions,
          predictions: summary.scoredResolvedMarkets,
        },
        'Fetched Polymarket resolved predictions',
      );

      return { predictions, summary };
    } catch (error) {
      this.logger.error({ walletAddress, error }, 'Failed to fetch Polymarket predictions');
      throw error;
    }
  }

  /**
   * Get top traders by public leaderboard endpoint when available.
   */
  async getTopForecasters(limit: number = 100): Promise<string[]> {
    try {
      const response = await this.client.get('/leaderboard', {
        params: {
          limit,
          sortBy: 'PROFIT',
          sortDirection: 'DESC',
        },
      });

      const traders = response.data as PolymarketLeaderboardRow[];
      return traders
        .map((trader) => trader.proxyWallet ?? trader.address ?? trader.user)
        .filter((address): address is string => Boolean(address));
    } catch (error) {
      this.logger.error({ error }, 'Failed to fetch Polymarket leaderboard');
      return [];
    }
  }

  private async fetchClosedPositions(walletAddress: string): Promise<PolymarketClosedPosition[]> {
    const positions: PolymarketClosedPosition[] = [];
    const limit = 50;
    let offset = 0;

    while (offset <= 10000) {
      const response = await this.client.get('/closed-positions', {
        params: {
          user: walletAddress,
          limit,
          offset,
        },
      });

      const page = response.data as PolymarketClosedPosition[];
      positions.push(...page);

      if (page.length < limit) {
        break;
      }

      offset += limit;
      await this.sleep(100);
    }

    return positions;
  }

  private sumRealizedPnl(positions: PolymarketClosedPosition[]): number {
    return positions.reduce((sum, position) => (
      Number.isFinite(position.realizedPnl) ? sum + position.realizedPnl : sum
    ), 0);
  }

  private isResolvedBinaryPosition(position: PolymarketClosedPosition): boolean {
    const hasBinaryOutcome = position.outcomeIndex === 0 || position.outcomeIndex === 1;
    const hasFinalPrice = position.curPrice === 0 || position.curPrice === 1;
    const hasUsablePrice = position.avgPrice >= 0 && position.avgPrice <= 1;
    return hasBinaryOutcome && hasFinalPrice && hasUsablePrice;
  }

  private selectPrimaryPositionPerMarket(
    positions: PolymarketClosedPosition[],
  ): PolymarketClosedPosition[] {
    const byConditionId = new Map<string, PolymarketClosedPosition>();

    for (const position of positions) {
      const existing = byConditionId.get(position.conditionId);
      if (!existing || position.totalBought > existing.totalBought) {
        byConditionId.set(position.conditionId, position);
      }
    }

    return [...byConditionId.values()];
  }

  private toPrediction(walletAddress: string, position: PolymarketClosedPosition): V3Prediction {
    const tradedFirstOutcome = position.outcomeIndex === 0;
    const predictedProbability = tradedFirstOutcome ? position.avgPrice : 1 - position.avgPrice;
    const firstOutcomeWon = tradedFirstOutcome ? position.curPrice === 1 : position.curPrice === 0;
    const marketCloseTime = this.normalizeTimestamp(position.endDate);

    return {
      id: uuidv4(),
      forecasterId: walletAddress,
      source: 'imported',
      platform: 'polymarket',
      marketId: position.conditionId,
      marketTitle: position.title,
      predictedProbability,
      direction: tradedFirstOutcome ? 'YES' : 'NO',
      entryPrice: predictedProbability,
      positionSize: position.totalBought,
      outcome: firstOutcomeWon,
      resolvedAt: marketCloseTime,
      predictedAt: this.normalizeTimestamp(position.timestamp),
      marketCloseTime,
      category: `imported:polymarket:${position.eventSlug || position.slug}`,
      difficulty: this.estimateDifficulty(predictedProbability),
    };
  }

  private estimateDifficulty(probability: number): number {
    return 1 - Math.abs(probability - 0.5) * 2;
  }
}
