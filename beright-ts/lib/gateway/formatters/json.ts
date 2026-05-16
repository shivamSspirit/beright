/**
 * JSON Formatter
 *
 * Transforms CommandResult data into JSON format for API responses.
 *
 * This formatter enables API parity with Telegram:
 * Same handlers, same data, different presentation.
 *
 * @see docs/ADR-001-GATEWAY-SKILL-SEPARATION.md
 */

import { FormattedResponse } from '../types';
import { CommandContext, CommandResult, Mood, ErrorResult } from '../../orchestrator/types';
import {
  Formatter,
  MarketData,
  PositionData,
  TradeData,
  ResearchData,
  ArbitrageData,
  WalletData,
  getFormatterRegistry,
} from './types';

// =============================================================================
// JSON FORMATTER
// =============================================================================

/**
 * JSON API Response structure
 */
interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  meta: {
    handler: string;
    route: string;
    timestamp: string;
    durationMs: number;
  };
}

/**
 * JSON Formatter
 *
 * Formats CommandResult data as JSON for API responses.
 */
export class JSONFormatter implements Formatter {
  name = 'api' as const;

  // ===========================================================================
  // GENERIC FORMATTING
  // ===========================================================================

  /**
   * Format a command result as JSON
   */
  format(result: CommandResult, context: CommandContext): FormattedResponse {
    const response: APIResponse = {
      success: result.success,
      data: result.data,
      error: result.error ? {
        code: result.error.code,
        message: result.error.message,
        retryable: result.error.retryable,
      } : undefined,
      meta: {
        handler: result.meta.handlerId,
        route: result.meta.routeId,
        timestamp: result.meta.executedAt.toISOString(),
        durationMs: result.meta.durationMs,
      },
    };

    return {
      text: JSON.stringify(response, null, 2),
      parseMode: 'plain',
    };
  }

  /**
   * Format an error as JSON
   */
  formatError(error: ErrorResult, context: CommandContext): FormattedResponse {
    const response: APIResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      },
      meta: {
        handler: context.route.handler,
        route: context.route.id,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - context.startTime.getTime(),
      },
    };

    return {
      text: JSON.stringify(response, null, 2),
      parseMode: 'plain',
    };
  }

  // ===========================================================================
  // TYPE-SPECIFIC FORMATTERS
  // ===========================================================================

  /**
   * Format market list as JSON
   */
  formatMarkets(markets: MarketData[], context: CommandContext): FormattedResponse {
    const response: APIResponse<{ markets: MarketData[]; count: number }> = {
      success: true,
      data: {
        markets,
        count: markets.length,
      },
      meta: {
        handler: context.route.handler,
        route: context.route.id,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - context.startTime.getTime(),
      },
    };

    return {
      text: JSON.stringify(response, null, 2),
      parseMode: 'plain',
    };
  }

  /**
   * Format single market as JSON
   */
  formatMarket(market: MarketData, context: CommandContext): FormattedResponse {
    const response: APIResponse<MarketData> = {
      success: true,
      data: market,
      meta: {
        handler: context.route.handler,
        route: context.route.id,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - context.startTime.getTime(),
      },
    };

    return {
      text: JSON.stringify(response, null, 2),
      parseMode: 'plain',
    };
  }

  /**
   * Format positions as JSON
   */
  formatPositions(positions: PositionData[], context: CommandContext): FormattedResponse {
    const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
    const totalPnL = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);

    const response: APIResponse<{
      positions: PositionData[];
      count: number;
      totalValue: number;
      totalPnL: number;
    }> = {
      success: true,
      data: {
        positions,
        count: positions.length,
        totalValue,
        totalPnL,
      },
      meta: {
        handler: context.route.handler,
        route: context.route.id,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - context.startTime.getTime(),
      },
    };

    return {
      text: JSON.stringify(response, null, 2),
      parseMode: 'plain',
    };
  }

  /**
   * Format trade result as JSON
   */
  formatTrade(trade: TradeData, context: CommandContext): FormattedResponse {
    const response: APIResponse<TradeData> = {
      success: true,
      data: trade,
      meta: {
        handler: context.route.handler,
        route: context.route.id,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - context.startTime.getTime(),
      },
    };

    return {
      text: JSON.stringify(response, null, 2),
      parseMode: 'plain',
    };
  }

  /**
   * Format research result as JSON
   */
  formatResearch(research: ResearchData, context: CommandContext): FormattedResponse {
    const response: APIResponse<ResearchData> = {
      success: true,
      data: research,
      meta: {
        handler: context.route.handler,
        route: context.route.id,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - context.startTime.getTime(),
      },
    };

    return {
      text: JSON.stringify(response, null, 2),
      parseMode: 'plain',
    };
  }

  /**
   * Format arbitrage opportunities as JSON
   */
  formatArbitrage(opportunities: ArbitrageData[], context: CommandContext): FormattedResponse {
    const response: APIResponse<{ opportunities: ArbitrageData[]; count: number }> = {
      success: true,
      data: {
        opportunities,
        count: opportunities.length,
      },
      meta: {
        handler: context.route.handler,
        route: context.route.id,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - context.startTime.getTime(),
      },
    };

    return {
      text: JSON.stringify(response, null, 2),
      parseMode: 'plain',
    };
  }

  /**
   * Format wallet info as JSON
   */
  formatWallet(wallet: WalletData, context: CommandContext): FormattedResponse {
    const response: APIResponse<WalletData> = {
      success: true,
      data: wallet,
      meta: {
        handler: context.route.handler,
        route: context.route.id,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - context.startTime.getTime(),
      },
    };

    return {
      text: JSON.stringify(response, null, 2),
      parseMode: 'plain',
    };
  }

  /**
   * Format help as JSON
   */
  formatHelp(
    commands: { id: string; description: string }[],
    context: CommandContext
  ): FormattedResponse {
    const response: APIResponse<{ commands: { id: string; description: string }[] }> = {
      success: true,
      data: { commands },
      meta: {
        handler: context.route.handler,
        route: context.route.id,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - context.startTime.getTime(),
      },
    };

    return {
      text: JSON.stringify(response, null, 2),
      parseMode: 'plain',
    };
  }

  // ===========================================================================
  // UTILITIES
  // ===========================================================================

  getMoodEmoji(_mood: Mood): string {
    return ''; // No emojis in JSON
  }

  formatPrice(price: number): string {
    return price.toFixed(4);
  }

  formatCurrency(amount: number): string {
    return amount.toFixed(2);
  }

  formatPercentage(value: number): string {
    return (value * 100).toFixed(2);
  }

  formatDate(date: Date): string {
    return date.toISOString();
  }

  truncate(text: string, _maxLength: number): string {
    return text; // No truncation for JSON
  }
}

// =============================================================================
// AUTO-REGISTER
// =============================================================================

// Register JSON formatter
getFormatterRegistry().register(new JSONFormatter());

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

let jsonFormatterInstance: JSONFormatter | null = null;

/**
 * Get JSON formatter instance
 */
export function getJSONFormatter(): JSONFormatter {
  if (!jsonFormatterInstance) {
    jsonFormatterInstance = new JSONFormatter();
  }
  return jsonFormatterInstance;
}
