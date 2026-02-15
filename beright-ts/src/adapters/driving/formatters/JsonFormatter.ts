/**
 * JSON Formatter
 *
 * Formats responses as JSON for API endpoints.
 * Provides consistent API response structure.
 */

import type {
  ResponseFormatter,
  FormattedResponse,
  ListOptions,
} from './FormatterInterface';
import type { Market } from '../../../domain/entities/Market';
import type { Prediction } from '../../../domain/entities/Prediction';
import type { ArbitrageOpportunity } from '../../../domain/entities/ArbitrageOpportunity';
import type { UserStats } from '../../../domain/entities/User';
import type { CalibrationReport } from '../../../application/services/PredictionService';
import type { OddsComparison } from '../../../application/services/MarketService';
import type { ArbitrageScanResult } from '../../../application/services/ArbitrageService';
import type { AppError } from '../../../shared/errors/AppError';

/**
 * Standard API response envelope
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    count?: number;
    offset?: number;
    limit?: number;
  };
}

/**
 * JSON Formatter Implementation
 */
export class JsonFormatter implements ResponseFormatter {
  /**
   * Format a single market
   */
  formatMarket(market: Market): FormattedResponse {
    const response: ApiResponse<object> = {
      success: true,
      data: this.serializeMarket(market),
      meta: {
        timestamp: new Date().toISOString(),
      },
    };

    return {
      content: JSON.stringify(response, null, 2),
      parseMode: 'plain',
      metadata: { type: 'market', marketId: market.id },
    };
  }

  /**
   * Format multiple markets
   */
  formatMarkets(markets: Market[], options?: ListOptions): FormattedResponse {
    const maxItems = options?.maxItems;
    const displayMarkets = maxItems ? markets.slice(0, maxItems) : markets;

    const response: ApiResponse<object[]> = {
      success: true,
      data: displayMarkets.map(m => this.serializeMarket(m)),
      meta: {
        timestamp: new Date().toISOString(),
        count: markets.length,
        limit: maxItems,
      },
    };

    return {
      content: JSON.stringify(response, null, 2),
      parseMode: 'plain',
      metadata: { type: 'markets', count: markets.length },
    };
  }

  /**
   * Format odds comparison
   */
  formatOddsComparison(comparison: OddsComparison): FormattedResponse {
    const response: ApiResponse<object> = {
      success: true,
      data: {
        query: comparison.query,
        markets: comparison.markets.map(m => ({
          platform: m.platform,
          marketId: m.marketId,
          title: m.title,
          yesPrice: m.yesPrice,
          noPrice: m.noPrice,
          volume: m.volume,
          url: m.url,
        })),
        bestYesBuy: comparison.bestYesBuy,
        bestNoBuy: comparison.bestNoBuy,
        maxSpread: comparison.maxSpread,
        maxSpreadPercent: comparison.maxSpread * 100,
        hasArbitrage: comparison.hasArbitrage,
      },
      meta: {
        timestamp: new Date().toISOString(),
        count: comparison.markets.length,
      },
    };

    return {
      content: JSON.stringify(response, null, 2),
      parseMode: 'plain',
      metadata: { type: 'oddsComparison', hasArbitrage: comparison.hasArbitrage },
    };
  }

  /**
   * Format a single prediction
   */
  formatPrediction(prediction: Prediction): FormattedResponse {
    const response: ApiResponse<object> = {
      success: true,
      data: this.serializePrediction(prediction),
      meta: {
        timestamp: new Date().toISOString(),
      },
    };

    return {
      content: JSON.stringify(response, null, 2),
      parseMode: 'plain',
      metadata: { type: 'prediction', predictionId: prediction.id },
    };
  }

  /**
   * Format multiple predictions
   */
  formatPredictions(predictions: Prediction[], options?: ListOptions): FormattedResponse {
    const maxItems = options?.maxItems;
    const displayPreds = maxItems ? predictions.slice(0, maxItems) : predictions;

    const response: ApiResponse<object[]> = {
      success: true,
      data: displayPreds.map(p => this.serializePrediction(p)),
      meta: {
        timestamp: new Date().toISOString(),
        count: predictions.length,
        limit: maxItems,
      },
    };

    return {
      content: JSON.stringify(response, null, 2),
      parseMode: 'plain',
      metadata: { type: 'predictions', count: predictions.length },
    };
  }

  /**
   * Format user stats
   */
  formatUserStats(stats: UserStats): FormattedResponse {
    const response: ApiResponse<UserStats> = {
      success: true,
      data: stats,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };

    return {
      content: JSON.stringify(response, null, 2),
      parseMode: 'plain',
      metadata: { type: 'userStats' },
    };
  }

  /**
   * Format calibration report
   */
  formatCalibrationReport(report: CalibrationReport): FormattedResponse {
    const response: ApiResponse<CalibrationReport> = {
      success: true,
      data: report,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };

    return {
      content: JSON.stringify(response, null, 2),
      parseMode: 'plain',
      metadata: { type: 'calibrationReport' },
    };
  }

  /**
   * Format single arbitrage opportunity
   */
  formatOpportunity(opportunity: ArbitrageOpportunity): FormattedResponse {
    const response: ApiResponse<object> = {
      success: true,
      data: this.serializeArbitrageOpportunity(opportunity),
      meta: {
        timestamp: new Date().toISOString(),
      },
    };

    return {
      content: JSON.stringify(response, null, 2),
      parseMode: 'plain',
      metadata: { type: 'arbitrageOpportunity', id: opportunity.id },
    };
  }

  /**
   * Format multiple arbitrage opportunities
   */
  formatOpportunities(opportunities: ArbitrageOpportunity[], options?: ListOptions): FormattedResponse {
    const maxItems = options?.maxItems;
    const displayOpps = maxItems ? opportunities.slice(0, maxItems) : opportunities;

    const response: ApiResponse<object[]> = {
      success: true,
      data: displayOpps.map(o => this.serializeArbitrageOpportunity(o)),
      meta: {
        timestamp: new Date().toISOString(),
        count: opportunities.length,
        limit: maxItems,
      },
    };

    return {
      content: JSON.stringify(response, null, 2),
      parseMode: 'plain',
      metadata: { type: 'arbitrageOpportunities', count: opportunities.length },
    };
  }

  /**
   * Format arbitrage scan result
   */
  formatScanResult(result: ArbitrageScanResult): FormattedResponse {
    const response: ApiResponse<object> = {
      success: true,
      data: {
        scannedAt: result.scannedAt.toISOString(),
        marketsScanned: result.marketsScanned,
        opportunitiesFound: result.opportunitiesFound,
        opportunities: result.opportunities.map(o => this.serializeArbitrageOpportunity(o)),
        errors: result.errors,
      },
      meta: {
        timestamp: new Date().toISOString(),
        count: result.opportunitiesFound,
      },
    };

    return {
      content: JSON.stringify(response, null, 2),
      parseMode: 'plain',
      metadata: { type: 'arbitrageScanResult' },
    };
  }

  /**
   * Format error message
   */
  formatError(error: AppError): FormattedResponse {
    const response: ApiResponse<never> = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.metadata,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };

    return {
      content: JSON.stringify(response, null, 2),
      parseMode: 'plain',
      metadata: { type: 'error', code: error.code },
    };
  }

  /**
   * Format validation errors
   */
  formatValidationErrors(errors: string[]): FormattedResponse {
    const response: ApiResponse<never> = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: { errors },
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };

    return {
      content: JSON.stringify(response, null, 2),
      parseMode: 'plain',
      metadata: { type: 'validationErrors', count: errors.length },
    };
  }

  /**
   * Format success message
   */
  formatSuccess(message: string): FormattedResponse {
    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };

    return {
      content: JSON.stringify(response, null, 2),
      parseMode: 'plain',
      metadata: { type: 'success' },
    };
  }

  /**
   * Format warning message
   */
  formatWarning(message: string): FormattedResponse {
    const response: ApiResponse<{ message: string; level: string }> = {
      success: true,
      data: { message, level: 'warning' },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };

    return {
      content: JSON.stringify(response, null, 2),
      parseMode: 'plain',
      metadata: { type: 'warning' },
    };
  }

  /**
   * Format loading/progress message
   */
  formatLoading(message: string): FormattedResponse {
    const response: ApiResponse<{ message: string; status: string }> = {
      success: true,
      data: { message, status: 'loading' },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };

    return {
      content: JSON.stringify(response, null, 2),
      parseMode: 'plain',
      metadata: { type: 'loading' },
    };
  }

  // ========== Serialization Helpers ==========

  private serializeMarket(market: Market): object {
    return {
      id: market.id,
      platform: market.platform,
      title: market.title,
      question: market.question,
      category: market.category,
      yesPrice: market.yesPrice.value,
      noPrice: market.noPrice.value,
      volume: market.volume,
      liquidity: market.liquidity,
      endDate: market.endDate?.toISOString() || null,
      url: market.url,
      status: market.status,
      fetchedAt: market.fetchedAt.toISOString(),
    };
  }

  private serializePrediction(prediction: Prediction): object {
    return {
      id: prediction.id,
      userId: prediction.userId,
      question: prediction.question,
      probability: prediction.probability.value,
      direction: prediction.direction,
      reasoning: prediction.reasoning,
      platform: prediction.platform,
      marketId: prediction.marketId,
      marketUrl: prediction.marketUrl,
      stakeAmount: prediction.stakeAmount,
      confidence: prediction.confidence,
      outcome: prediction.outcome,
      brierScore: prediction.brierScore?.value || null,
      resolvedAt: prediction.resolvedAt?.toISOString() || null,
      resolvesAt: prediction.resolvesAt?.toISOString() || null,
      isOnChain: prediction.isOnChain,
      onChainTx: prediction.onChainTx,
      createdAt: prediction.createdAt.toISOString(),
    };
  }

  private serializeArbitrageOpportunity(opportunity: ArbitrageOpportunity): object {
    return {
      id: opportunity.id,
      topic: opportunity.topic,
      marketA: {
        platform: opportunity.platformA,
        marketId: opportunity.marketIdA,
        title: opportunity.titleA,
        yesPrice: opportunity.priceAYes.value,
        url: opportunity.urlA,
      },
      marketB: {
        platform: opportunity.platformB,
        marketId: opportunity.marketIdB,
        title: opportunity.titleB,
        yesPrice: opportunity.priceBYes.value,
        url: opportunity.urlB,
      },
      spread: opportunity.spread,
      spreadPercent: opportunity.spread * 100,
      profitPercent: opportunity.profitPercent,
      strategy: opportunity.strategy,
      strategyDescription: opportunity.strategyDescription,
      matchConfidence: opportunity.matchConfidence,
      isValid: opportunity.isValid,
      isHighValue: opportunity.isHighValue,
      detectedAt: opportunity.detectedAt.toISOString(),
      expiresAt: opportunity.expiresAt.toISOString(),
    };
  }
}

export default JsonFormatter;
