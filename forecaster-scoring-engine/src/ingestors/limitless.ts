/**
 * Limitless Ingestor
 *
 * Fetches public wallet portfolio data from the Limitless Exchange API.
 * Public endpoints expose positions, PnL, and volume by Base wallet address.
 */

import { v4 as uuidv4 } from 'uuid';

import { V3Prediction } from '../v3/types';
import { BaseIngestor, IngestorConfig } from './base';

type LimitlessOutcome = 'yes' | 'no';

interface LimitlessMarketSummary {
  slug?: string;
  title?: string;
  conditionId?: string;
  condition_id?: string;
  id?: string | number;
  status?: string;
  closed?: boolean;
  deadline?: string;
  expirationDate?: string;
  winningOutcomeIndex?: number | null;
  winning_index?: number | null;
}

interface LimitlessPositionData {
  cost?: string;
  fillPrice?: string;
  realisedPnl?: string;
  unrealizedPnl?: string;
  marketValue?: string;
}

interface LimitlessAmmPosition {
  market: LimitlessMarketSummary;
  outcomeIndex: number;
  outcomeTokenAmount?: string;
  collateralAmount?: string;
  realizedPnl?: string;
  realisedPnl?: string;
  unrealizedPnl?: string;
  averageFillPrice?: string;
  totalBuysCost?: string;
  totalSellsCost?: string;
  account?: string;
}

interface LimitlessClobPosition {
  market: LimitlessMarketSummary;
  positions: {
    yes?: LimitlessPositionData;
    no?: LimitlessPositionData;
  };
  makerAddress?: string;
}

interface LimitlessPositionsResponse {
  amm?: LimitlessAmmPosition[];
  clob?: LimitlessClobPosition[];
}

interface LimitlessPnlChartResponse {
  currentValue?: number;
  current?: {
    realised?: {
      formatted?: string;
      usd?: string;
    };
  } | null;
}

interface LimitlessVolumeResponse {
  data?: string;
}

interface LimitlessResolvedPosition {
  market: LimitlessMarketSummary;
  outcomeIndex: number;
  fillPrice: number;
  positionSize: number;
  realizedPnl: number;
}

export interface LimitlessScoringSummary {
  positions: number;
  resolvedPositions: number;
  scoredResolvedMarkets: number;
  realizedPnl: number;
  tradedVolume: number;
}

export interface LimitlessScoringData {
  predictions: V3Prediction[];
  summary: LimitlessScoringSummary;
}

export class LimitlessIngestor extends BaseIngestor {
  private readonly marketCache = new Map<string, LimitlessMarketSummary>();

  constructor(config?: Partial<IngestorConfig>) {
    super('limitless', {
      baseUrl: 'https://api.limitless.exchange',
      rateLimitPerMinute: 60,
      ...config,
    });
  }

  async fetchUserPredictions(walletAddress: string): Promise<V3Prediction[]> {
    const scoringData = await this.fetchUserScoringData(walletAddress);
    return scoringData.predictions;
  }

  async fetchUserScoringData(walletAddress: string): Promise<LimitlessScoringData> {
    try {
      const [positionsResponse, pnl, tradedVolume] = await Promise.all([
        this.fetchPositions(walletAddress),
        this.fetchRealizedPnl(walletAddress),
        this.fetchTradedVolume(walletAddress),
      ]);

      const resolvedPositions = await this.buildResolvedPositions(positionsResponse);
      const predictions = resolvedPositions.map((position) => this.toPrediction(walletAddress, position));
      const fallbackPnl = resolvedPositions.reduce((sum, position) => sum + position.realizedPnl, 0);

      const summary: LimitlessScoringSummary = {
        positions: (positionsResponse.amm ?? []).length + (positionsResponse.clob ?? []).length,
        resolvedPositions: resolvedPositions.length,
        scoredResolvedMarkets: predictions.length,
        realizedPnl: pnl ?? fallbackPnl,
        tradedVolume,
      };

      this.logger.info(
        {
          walletAddress,
          positions: summary.positions,
          resolvedPositions: summary.resolvedPositions,
          predictions: summary.scoredResolvedMarkets,
        },
        'Fetched Limitless resolved predictions',
      );

      return { predictions, summary };
    } catch (error) {
      this.logger.error({ walletAddress, error }, 'Failed to fetch Limitless predictions');
      throw error;
    }
  }

  async getTopForecasters(): Promise<string[]> {
    return [];
  }

  private async fetchPositions(walletAddress: string): Promise<LimitlessPositionsResponse> {
    const response = await this.client.get(`/portfolio/${walletAddress}/positions`);
    return response.data as LimitlessPositionsResponse;
  }

  private async fetchRealizedPnl(walletAddress: string): Promise<number | null> {
    try {
      const response = await this.client.get(`/portfolio/${walletAddress}/pnl-chart`, {
        params: { timeframe: 'all' },
      });
      const data = response.data as LimitlessPnlChartResponse;
      return this.parseNumber(data.current?.realised?.usd ?? data.current?.realised?.formatted ?? data.currentValue);
    } catch (error) {
      this.logger.warn({ walletAddress }, 'Failed to fetch Limitless PnL chart');
      return null;
    }
  }

  private async fetchTradedVolume(walletAddress: string): Promise<number> {
    try {
      const response = await this.client.get(`/portfolio/${walletAddress}/traded-volume`);
      const data = response.data as LimitlessVolumeResponse;
      return this.parseNumber(data.data) ?? 0;
    } catch (error) {
      this.logger.warn({ walletAddress }, 'Failed to fetch Limitless traded volume');
      return 0;
    }
  }

  private async buildResolvedPositions(
    positionsResponse: LimitlessPositionsResponse,
  ): Promise<LimitlessResolvedPosition[]> {
    const resolved: LimitlessResolvedPosition[] = [];

    for (const position of positionsResponse.amm ?? []) {
      const market = await this.withResolvedMarket(position.market);
      const winningOutcomeIndex = this.getWinningOutcomeIndex(market);
      const fillPrice = this.parseNumber(position.averageFillPrice);
      const totalBuysCost = this.parseNumber(position.totalBuysCost);

      if (winningOutcomeIndex === null || fillPrice === null || totalBuysCost === null || totalBuysCost <= 0) {
        continue;
      }

      resolved.push({
        market,
        outcomeIndex: position.outcomeIndex,
        fillPrice: this.clampProbability(fillPrice),
        positionSize: totalBuysCost,
        realizedPnl: this.parseNumber(position.realizedPnl ?? position.realisedPnl) ?? 0,
      });
    }

    for (const position of positionsResponse.clob ?? []) {
      const market = await this.withResolvedMarket(position.market);
      const winningOutcomeIndex = this.getWinningOutcomeIndex(market);

      if (winningOutcomeIndex === null) {
        continue;
      }

      const yes = this.toResolvedClobSide(market, 'yes', position.positions.yes);
      const no = this.toResolvedClobSide(market, 'no', position.positions.no);
      const strongestSide = [yes, no]
        .filter((side): side is LimitlessResolvedPosition => Boolean(side))
        .sort((a, b) => b.positionSize - a.positionSize)[0];

      if (strongestSide) {
        resolved.push(strongestSide);
      }
    }

    return resolved;
  }

  private async withResolvedMarket(market: LimitlessMarketSummary): Promise<LimitlessMarketSummary> {
    if (this.getWinningOutcomeIndex(market) !== null) {
      return market;
    }

    const slug = market.slug;
    if (!slug) {
      return market;
    }

    const cached = this.marketCache.get(slug);
    if (cached) {
      return { ...market, ...cached };
    }

    try {
      const response = await this.client.get(`/markets/${slug}`);
      const fullMarket = response.data as LimitlessMarketSummary;
      this.marketCache.set(slug, fullMarket);
      await this.sleep(50);
      return { ...market, ...fullMarket };
    } catch (error) {
      this.logger.warn({ slug }, 'Failed to fetch Limitless market details');
      return market;
    }
  }

  private toResolvedClobSide(
    market: LimitlessMarketSummary,
    outcome: LimitlessOutcome,
    side: LimitlessPositionData | undefined,
  ): LimitlessResolvedPosition | null {
    const fillPrice = this.parseDecimalPrice(side?.fillPrice);
    const cost = this.parseTokenAmount(side?.cost);
    const realizedPnl = this.parseTokenAmount(side?.realisedPnl);

    if (fillPrice === null || cost === null || cost <= 0) {
      return null;
    }

    return {
      market,
      outcomeIndex: outcome === 'yes' ? 0 : 1,
      fillPrice,
      positionSize: cost,
      realizedPnl: realizedPnl ?? 0,
    };
  }

  private toPrediction(walletAddress: string, position: LimitlessResolvedPosition): V3Prediction {
    const outcomeIndex = position.outcomeIndex;
    const predictedProbability = outcomeIndex === 0 ? position.fillPrice : 1 - position.fillPrice;
    const winningOutcomeIndex = this.getWinningOutcomeIndex(position.market);
    const marketCloseTime = this.normalizeTimestamp(
      position.market.deadline ?? position.market.expirationDate ?? new Date().toISOString(),
    );

    return {
      id: uuidv4(),
      forecasterId: walletAddress,
      source: 'imported',
      platform: 'limitless',
      marketId: this.getMarketId(position.market),
      marketTitle: position.market.title ?? 'Limitless market',
      predictedProbability,
      direction: outcomeIndex === 0 ? 'YES' : 'NO',
      entryPrice: predictedProbability,
      positionSize: position.positionSize,
      outcome: winningOutcomeIndex === 0,
      resolvedAt: marketCloseTime,
      predictedAt: marketCloseTime,
      marketCloseTime,
      category: `imported:limitless:${position.market.slug ?? this.getMarketId(position.market)}`,
      difficulty: this.estimateDifficulty(predictedProbability),
      resolutionEvidence: {
        source: 'limitless-portfolio-api',
        finality: 'api_resolved',
        confidence: 0.85,
        observedAt: new Date(),
        referenceUrl: position.market.slug
          ? `https://limitless.exchange/markets/${position.market.slug}`
          : undefined,
      },
    };
  }

  private getMarketId(market: LimitlessMarketSummary): string {
    return String(market.conditionId ?? market.condition_id ?? market.id ?? market.slug ?? 'unknown');
  }

  private getWinningOutcomeIndex(market: LimitlessMarketSummary): number | null {
    const index = market.winningOutcomeIndex ?? market.winning_index ?? null;
    return index === 0 || index === 1 ? index : null;
  }

  private parseDecimalPrice(value: string | number | undefined): number | null {
    const parsed = this.parseNumber(value);
    if (parsed === null) return null;
    return this.clampProbability(parsed > 1 ? parsed / 1_000_000 : parsed);
  }

  private parseTokenAmount(value: string | number | undefined): number | null {
    const parsed = this.parseNumber(value);
    if (parsed === null) return null;
    return typeof value === 'string' && value.includes('.') ? parsed : parsed / 1_000_000;
  }

  private parseNumber(value: string | number | undefined | null): number | null {
    if (value === undefined || value === null) return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private clampProbability(probability: number): number {
    return Math.min(Math.max(probability, 0.001), 0.999);
  }

  private estimateDifficulty(probability: number): number {
    return 1 - Math.abs(probability - 0.5) * 2;
  }
}
