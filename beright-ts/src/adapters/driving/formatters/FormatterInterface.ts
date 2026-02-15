/**
 * Formatter Interface
 *
 * Common interface for formatting responses across different output channels.
 * Each implementation handles platform-specific formatting (Telegram, JSON, Text).
 */

import type { Market } from '../../../domain/entities/Market';
import type { Prediction } from '../../../domain/entities/Prediction';
import type { ArbitrageOpportunity } from '../../../domain/entities/ArbitrageOpportunity';
import type { UserStats } from '../../../domain/entities/User';
import type { CalibrationReport } from '../../../application/services/PredictionService';
import type { OddsComparison } from '../../../application/services/MarketService';
import type { ArbitrageScanResult } from '../../../application/services/ArbitrageService';
import type { AppError } from '../../../shared/errors/AppError';

/**
 * Formatted response wrapper
 */
export interface FormattedResponse {
  content: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2' | 'plain';
  metadata?: Record<string, unknown>;
}

/**
 * Generic list formatting options
 */
export interface ListOptions {
  title?: string;
  showIndex?: boolean;
  maxItems?: number;
  emptyMessage?: string;
}

/**
 * Market formatter interface
 */
export interface MarketFormatter {
  formatMarket(market: Market): FormattedResponse;
  formatMarkets(markets: Market[], options?: ListOptions): FormattedResponse;
  formatOddsComparison(comparison: OddsComparison): FormattedResponse;
}

/**
 * Prediction formatter interface
 */
export interface PredictionFormatter {
  formatPrediction(prediction: Prediction): FormattedResponse;
  formatPredictions(predictions: Prediction[], options?: ListOptions): FormattedResponse;
  formatUserStats(stats: UserStats): FormattedResponse;
  formatCalibrationReport(report: CalibrationReport): FormattedResponse;
}

/**
 * Arbitrage formatter interface
 */
export interface ArbitrageFormatter {
  formatOpportunity(opportunity: ArbitrageOpportunity): FormattedResponse;
  formatOpportunities(opportunities: ArbitrageOpportunity[], options?: ListOptions): FormattedResponse;
  formatScanResult(result: ArbitrageScanResult): FormattedResponse;
}

/**
 * Error formatter interface
 */
export interface ErrorFormatter {
  formatError(error: AppError): FormattedResponse;
  formatValidationErrors(errors: string[]): FormattedResponse;
}

/**
 * Combined response formatter interface
 */
export interface ResponseFormatter extends MarketFormatter, PredictionFormatter, ArbitrageFormatter, ErrorFormatter {
  /**
   * Format a success message
   */
  formatSuccess(message: string): FormattedResponse;

  /**
   * Format a warning message
   */
  formatWarning(message: string): FormattedResponse;

  /**
   * Format a loading/progress message
   */
  formatLoading(message: string): FormattedResponse;
}
