/**
 * Telegram Formatter
 *
 * Formats responses for Telegram using Markdown.
 * Handles emoji, links, and proper escaping.
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
 * Telegram Formatter Implementation
 */
export class TelegramFormatter implements ResponseFormatter {
  private readonly parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML';

  /**
   * Format a single market
   */
  formatMarket(market: Market): FormattedResponse {
    const platformEmoji = this.getPlatformEmoji(market.platform);
    const priceBar = this.createPriceBar(market.yesPrice.value);
    const volumeStr = this.formatVolume(market.volume);

    const lines = [
      `${platformEmoji} <b>${this.escapeHtml(market.title)}</b>`,
      ``,
      `${priceBar}`,
      `<b>YES:</b> ${this.formatPrice(market.yesPrice.value)} | <b>NO:</b> ${this.formatPrice(market.noPrice.value)}`,
      `<b>Volume:</b> ${volumeStr}`,
    ];

    if (market.endDate) {
      lines.push(`<b>Closes:</b> ${this.formatDate(market.endDate)}`);
    }

    if (market.url) {
      lines.push(`<a href="${market.url}">View on ${market.platform}</a>`);
    }

    return {
      content: lines.join('\n'),
      parseMode: this.parseMode,
    };
  }

  /**
   * Format multiple markets
   */
  formatMarkets(markets: Market[], options?: ListOptions): FormattedResponse {
    if (markets.length === 0) {
      return {
        content: options?.emptyMessage || 'No markets found.',
        parseMode: this.parseMode,
      };
    }

    const title = options?.title || 'Markets';
    const maxItems = options?.maxItems || 10;
    const displayMarkets = markets.slice(0, maxItems);

    const lines = [`<b>${this.escapeHtml(title)}</b>`, ''];

    displayMarkets.forEach((market, index) => {
      const num = options?.showIndex !== false ? `${index + 1}. ` : '';
      const platformEmoji = this.getPlatformEmoji(market.platform);
      const price = this.formatPrice(market.yesPrice.value);

      lines.push(`${num}${platformEmoji} ${this.escapeHtml(market.title)}`);
      lines.push(`   YES: ${price} | Vol: ${this.formatVolume(market.volume)}`);
      if (market.url) {
        lines.push(`   <a href="${market.url}">View</a>`);
      }
      lines.push('');
    });

    if (markets.length > maxItems) {
      lines.push(`<i>...and ${markets.length - maxItems} more</i>`);
    }

    return {
      content: lines.join('\n'),
      parseMode: this.parseMode,
    };
  }

  /**
   * Format odds comparison
   */
  formatOddsComparison(comparison: OddsComparison): FormattedResponse {
    const lines = [
      `<b>Odds Comparison: "${this.escapeHtml(comparison.query)}"</b>`,
      '',
    ];

    if (comparison.markets.length === 0) {
      lines.push('No markets found for comparison.');
      return { content: lines.join('\n'), parseMode: this.parseMode };
    }

    // Sort by YES price
    const sorted = [...comparison.markets].sort((a, b) => a.yesPrice - b.yesPrice);

    for (const market of sorted) {
      const emoji = this.getPlatformEmoji(market.platform);
      lines.push(`${emoji} <b>${market.platform}</b>`);
      lines.push(`   YES: ${this.formatPrice(market.yesPrice)} | NO: ${this.formatPrice(market.noPrice)}`);
    }

    lines.push('');
    lines.push(`<b>Spread:</b> ${(comparison.maxSpread * 100).toFixed(1)}%`);

    if (comparison.hasArbitrage) {
      lines.push('');
      lines.push('⚠️ <b>Arbitrage opportunity detected!</b>');
      if (comparison.bestYesBuy && comparison.bestNoBuy) {
        lines.push(`Buy YES on ${comparison.bestYesBuy.platform} @ ${this.formatPrice(comparison.bestYesBuy.yesPrice)}`);
        lines.push(`Buy NO on ${comparison.bestNoBuy.platform} @ ${this.formatPrice(comparison.bestNoBuy.noPrice)}`);
      }
    }

    return {
      content: lines.join('\n'),
      parseMode: this.parseMode,
    };
  }

  /**
   * Format a single prediction
   */
  formatPrediction(prediction: Prediction): FormattedResponse {
    const statusEmoji = this.getPredictionStatusEmoji(prediction);
    const directionEmoji = prediction.direction === 'YES' ? '✅' : '❌';

    const lines = [
      `${statusEmoji} <b>${this.escapeHtml(prediction.question)}</b>`,
      '',
      `<b>Prediction:</b> ${directionEmoji} ${prediction.direction} @ ${(prediction.probability.value * 100).toFixed(0)}%`,
    ];

    if (prediction.reasoning) {
      lines.push(`<b>Reasoning:</b> ${this.escapeHtml(prediction.reasoning)}`);
    }

    if (prediction.platform) {
      lines.push(`<b>Platform:</b> ${prediction.platform}`);
    }

    if (prediction.stakeAmount) {
      lines.push(`<b>Stake:</b> $${prediction.stakeAmount.toFixed(2)}`);
    }

    if (prediction.outcome !== null) {
      const outcomeEmoji = prediction.outcome ? '✅' : '❌';
      lines.push(`<b>Outcome:</b> ${outcomeEmoji} ${prediction.outcome ? 'YES' : 'NO'}`);

      if (prediction.brierScore) {
        lines.push(`<b>Brier Score:</b> ${prediction.brierScore.value.toFixed(3)}`);
      }
    }

    lines.push(`<b>Created:</b> ${this.formatDate(prediction.createdAt)}`);

    if (prediction.isOnChain && prediction.onChainTx) {
      lines.push(`<b>On-chain:</b> <a href="https://solscan.io/tx/${prediction.onChainTx}">View tx</a>`);
    }

    return {
      content: lines.join('\n'),
      parseMode: this.parseMode,
    };
  }

  /**
   * Format multiple predictions
   */
  formatPredictions(predictions: Prediction[], options?: ListOptions): FormattedResponse {
    if (predictions.length === 0) {
      return {
        content: options?.emptyMessage || 'No predictions found.',
        parseMode: this.parseMode,
      };
    }

    const title = options?.title || 'Predictions';
    const maxItems = options?.maxItems || 10;
    const displayPreds = predictions.slice(0, maxItems);

    const lines = [`<b>${this.escapeHtml(title)}</b>`, ''];

    displayPreds.forEach((pred, index) => {
      const num = options?.showIndex !== false ? `${index + 1}. ` : '';
      const statusEmoji = this.getPredictionStatusEmoji(pred);
      const prob = (pred.probability.value * 100).toFixed(0);

      lines.push(`${num}${statusEmoji} ${this.escapeHtml(pred.question.substring(0, 50))}...`);
      lines.push(`   ${pred.direction} @ ${prob}%`);
      lines.push('');
    });

    if (predictions.length > maxItems) {
      lines.push(`<i>...and ${predictions.length - maxItems} more</i>`);
    }

    return {
      content: lines.join('\n'),
      parseMode: this.parseMode,
    };
  }

  /**
   * Format user stats
   */
  formatUserStats(stats: UserStats): FormattedResponse {
    const accuracy = (stats.accuracy * 100).toFixed(1);
    const brierDisplay = stats.averageBrierScore !== null
      ? stats.averageBrierScore.toFixed(3)
      : 'N/A';

    const lines = [
      '<b>📊 Your Prediction Stats</b>',
      '',
      `<b>Total Predictions:</b> ${stats.totalPredictions}`,
      `<b>Resolved:</b> ${stats.resolvedPredictions}`,
      `<b>Pending:</b> ${stats.pendingPredictions}`,
      '',
      `<b>Correct:</b> ${stats.correctPredictions}`,
      `<b>Accuracy:</b> ${accuracy}%`,
      `<b>Brier Score:</b> ${brierDisplay}`,
    ];

    if (stats.rank !== undefined && stats.rank !== null) {
      lines.push(`<b>Rank:</b> #${stats.rank}`);
    }

    if (stats.onChainPredictions && stats.onChainPredictions > 0) {
      lines.push(`<b>On-chain:</b> ${stats.onChainPredictions}`);
    }

    // Platform breakdown
    const platforms = Object.entries(stats.predictionsByPlatform);
    if (platforms.length > 0) {
      lines.push('');
      lines.push('<b>By Platform:</b>');
      for (const [platform, count] of platforms) {
        lines.push(`  ${this.getPlatformEmoji(platform)} ${platform}: ${count}`);
      }
    }

    // Confidence breakdown
    const conf = stats.predictionsByConfidence;
    if (conf.high + conf.medium + conf.low > 0) {
      lines.push('');
      lines.push('<b>By Confidence:</b>');
      lines.push(`  🔥 High (80%+): ${conf.high}`);
      lines.push(`  📊 Medium (50-80%): ${conf.medium}`);
      lines.push(`  🤔 Low (&lt;50%): ${conf.low}`);
    }

    return {
      content: lines.join('\n'),
      parseMode: this.parseMode,
    };
  }

  /**
   * Format calibration report
   */
  formatCalibrationReport(report: CalibrationReport): FormattedResponse {
    const brierDisplay = report.averageBrierScore !== null
      ? report.averageBrierScore.toFixed(3)
      : 'N/A';

    const lines = [
      '<b>📈 Calibration Report</b>',
      '',
      `<b>Total Predictions:</b> ${report.totalPredictions}`,
      `<b>Resolved:</b> ${report.resolvedPredictions}`,
      `<b>Avg Brier Score:</b> ${brierDisplay}`,
      '',
    ];

    if (report.calibrationBuckets.length > 0) {
      lines.push('<b>Calibration by Confidence:</b>');
      lines.push('<pre>');
      lines.push('Range    | Predicted | Actual | Count');
      lines.push('---------|-----------|--------|------');

      for (const bucket of report.calibrationBuckets) {
        if (bucket.count === 0) continue;

        const predicted = (bucket.predictedProbability * 100).toFixed(0).padStart(3);
        const actual = (bucket.actualOutcomeRate * 100).toFixed(0).padStart(3);
        const count = bucket.count.toString().padStart(3);

        lines.push(`${bucket.range.padEnd(9)}|   ${predicted}%    |  ${actual}%  | ${count}`);
      }

      lines.push('</pre>');
    }

    if (report.overconfidenceScore > 0.1) {
      lines.push('');
      lines.push(`⚠️ <b>Overconfidence detected:</b> ${(report.overconfidenceScore * 100).toFixed(1)}%`);
    }

    if (report.underconfidenceScore > 0.1) {
      lines.push('');
      lines.push(`⚠️ <b>Underconfidence detected:</b> ${(report.underconfidenceScore * 100).toFixed(1)}%`);
    }

    if (report.recommendations.length > 0) {
      lines.push('');
      lines.push('<b>Recommendations:</b>');
      for (const rec of report.recommendations) {
        lines.push(`• ${this.escapeHtml(rec)}`);
      }
    }

    return {
      content: lines.join('\n'),
      parseMode: this.parseMode,
    };
  }

  /**
   * Format single arbitrage opportunity
   */
  formatOpportunity(opportunity: ArbitrageOpportunity): FormattedResponse {
    const lines = [
      `💰 <b>Arbitrage Opportunity</b>`,
      `<b>Topic:</b> ${this.escapeHtml(opportunity.topic)}`,
      '',
      `<b>Market A:</b> ${opportunity.platformA}`,
      `  ${this.escapeHtml(opportunity.titleA)}`,
      `  YES Price: ${this.formatPrice(opportunity.priceAYes.value)}`,
      opportunity.urlA ? `  <a href="${opportunity.urlA}">View market</a>` : '',
      '',
      `<b>Market B:</b> ${opportunity.platformB}`,
      `  ${this.escapeHtml(opportunity.titleB)}`,
      `  YES Price: ${this.formatPrice(opportunity.priceBYes.value)}`,
      opportunity.urlB ? `  <a href="${opportunity.urlB}">View market</a>` : '',
      '',
      `<b>Spread:</b> ${(opportunity.spread * 100).toFixed(1)}%`,
      `<b>Profit Potential:</b> ${opportunity.profitPercent.toFixed(1)}%`,
      `<b>Confidence:</b> ${(opportunity.matchConfidence * 100).toFixed(0)}%`,
      '',
      `<b>Strategy:</b> ${opportunity.strategyDescription}`,
      '',
      `<i>Detected: ${this.formatDate(opportunity.detectedAt)}</i>`,
    ].filter(line => line !== '');

    return {
      content: lines.join('\n'),
      parseMode: this.parseMode,
    };
  }

  /**
   * Format multiple arbitrage opportunities
   */
  formatOpportunities(opportunities: ArbitrageOpportunity[], options?: ListOptions): FormattedResponse {
    if (opportunities.length === 0) {
      return {
        content: options?.emptyMessage || 'No arbitrage opportunities found.',
        parseMode: this.parseMode,
      };
    }

    const title = options?.title || '💰 Arbitrage Opportunities';
    const maxItems = options?.maxItems || 5;
    const displayOpps = opportunities.slice(0, maxItems);

    const lines = [`<b>${title}</b>`, ''];

    displayOpps.forEach((opp, index) => {
      const num = options?.showIndex !== false ? `${index + 1}. ` : '';
      const spread = (opp.spread * 100).toFixed(1);

      lines.push(`${num}<b>${this.escapeHtml(opp.topic)}</b>`);
      lines.push(`   ${opp.platformA} vs ${opp.platformB} | Spread: ${spread}%`);
      lines.push('');
    });

    if (opportunities.length > maxItems) {
      lines.push(`<i>...and ${opportunities.length - maxItems} more</i>`);
    }

    return {
      content: lines.join('\n'),
      parseMode: this.parseMode,
    };
  }

  /**
   * Format arbitrage scan result
   */
  formatScanResult(result: ArbitrageScanResult): FormattedResponse {
    const lines = [
      `<b>🔍 Arbitrage Scan Complete</b>`,
      '',
      `<b>Markets Scanned:</b> ${result.marketsScanned}`,
      `<b>Opportunities Found:</b> ${result.opportunitiesFound}`,
      `<b>Scanned At:</b> ${this.formatDate(result.scannedAt)}`,
    ];

    if (result.errors.length > 0) {
      lines.push('');
      lines.push(`<b>Errors:</b> ${result.errors.length}`);
    }

    if (result.opportunities.length > 0) {
      lines.push('');
      const oppsFormatted = this.formatOpportunities(result.opportunities, { maxItems: 3 });
      lines.push(oppsFormatted.content);
    }

    return {
      content: lines.join('\n'),
      parseMode: this.parseMode,
    };
  }

  /**
   * Format error message
   */
  formatError(error: AppError): FormattedResponse {
    return {
      content: `❌ <b>Error:</b> ${this.escapeHtml(error.message)}`,
      parseMode: this.parseMode,
    };
  }

  /**
   * Format validation errors
   */
  formatValidationErrors(errors: string[]): FormattedResponse {
    const lines = ['❌ <b>Validation Errors:</b>', ''];

    for (const error of errors) {
      lines.push(`• ${this.escapeHtml(error)}`);
    }

    return {
      content: lines.join('\n'),
      parseMode: this.parseMode,
    };
  }

  /**
   * Format success message
   */
  formatSuccess(message: string): FormattedResponse {
    return {
      content: `✅ ${this.escapeHtml(message)}`,
      parseMode: this.parseMode,
    };
  }

  /**
   * Format warning message
   */
  formatWarning(message: string): FormattedResponse {
    return {
      content: `⚠️ ${this.escapeHtml(message)}`,
      parseMode: this.parseMode,
    };
  }

  /**
   * Format loading/progress message
   */
  formatLoading(message: string): FormattedResponse {
    return {
      content: `⏳ ${this.escapeHtml(message)}`,
      parseMode: this.parseMode,
    };
  }

  // ========== Helper Methods ==========

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private formatPrice(price: number): string {
    return `${(price * 100).toFixed(0)}¢`;
  }

  private formatVolume(volume: number): string {
    if (volume >= 1_000_000) {
      return `$${(volume / 1_000_000).toFixed(1)}M`;
    }
    if (volume >= 1_000) {
      return `$${(volume / 1_000).toFixed(1)}K`;
    }
    return `$${volume.toFixed(0)}`;
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private createPriceBar(yesPrice: number): string {
    const width = 20;
    const filled = Math.round(yesPrice * width);
    const empty = width - filled;

    const filledBar = '█'.repeat(filled);
    const emptyBar = '░'.repeat(empty);

    return `[${filledBar}${emptyBar}] ${(yesPrice * 100).toFixed(0)}%`;
  }

  private getPlatformEmoji(platform: string): string {
    const emojis: Record<string, string> = {
      kalshi: '🎯',
      polymarket: '🔮',
      dflow: '🌊',
      manifold: '📊',
      metaculus: '🔬',
      limitless: '♾️',
    };

    return emojis[platform.toLowerCase()] || '📈';
  }

  private getPredictionStatusEmoji(prediction: Prediction): string {
    if (prediction.outcome === null) {
      return '⏳'; // Pending
    }

    const wasCorrect =
      (prediction.direction === 'YES' && prediction.outcome) ||
      (prediction.direction === 'NO' && !prediction.outcome);

    return wasCorrect ? '✅' : '❌';
  }
}

export default TelegramFormatter;
