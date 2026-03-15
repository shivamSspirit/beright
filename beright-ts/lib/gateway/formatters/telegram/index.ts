/**
 * Telegram Formatter
 * Main formatter class that delegates to specialized modules
 *
 * This is a refactored, modular version of the original 3500+ line file.
 * Each domain has its own formatting module for maintainability.
 */

import type { FormattedResponse, Button } from '../../types';
import type { CommandContext, CommandResult, Mood } from '../../../orchestrator/types';
import type { Formatter, MarketData, PositionData, ArbitrageData } from '../types';

// Import common utilities
import {
  createResponse,
  createErrorResponse,
  ExtendedResponse,
  ErrorResult,
  MOOD_EMOJIS,
  MAX_MESSAGE_LENGTH,
  truncateMessage,
  bold,
  italic,
} from './common';

import type { WalletData as BaseWalletData } from '../types';

// Import specialized formatters
import * as marketsFormatter from './markets';
import * as portfolioFormatter from './portfolio';
import * as kalshiFormatter from './kalshi';

// Re-export common utilities for external use
export * from './common';

/**
 * Telegram Formatter
 *
 * Formats CommandResult data for Telegram display.
 * Delegates to specialized modules based on handler type.
 */
export class TelegramFormatter implements Formatter {
  name = 'telegram' as const;

  /**
   * Format a command result
   */
  format(result: CommandResult, context: CommandContext): ExtendedResponse {
    if (!result.success && result.error) {
      return this.formatError(result.error, context);
    }

    // Dispatch to type-specific formatter based on handler
    const handlerId = context.route.handler;

    switch (handlerId) {
      // Markets
      case 'hotMarkets':
        return marketsFormatter.formatMarkets(result.data as MarketData[], context);
      case 'dflowSearch':
        return marketsFormatter.formatDFlowSearch(result, context);
      case 'brief':
        return marketsFormatter.formatBrief(result, context);
      case 'arbitrage':
        return marketsFormatter.formatArbitrage(result.data as ArbitrageData[], context);
      case 'compare':
        return marketsFormatter.formatCompare(result, context);
      case 'alpha':
        return marketsFormatter.formatAlpha(result, context);

      // Portfolio
      case 'positions':
        return portfolioFormatter.formatPositionsResult(result, context);
      case 'portfolio':
        return portfolioFormatter.formatPortfolio(result, context);
      case 'pnl':
        return portfolioFormatter.formatPnl(result, context);
      case 'me':
        return portfolioFormatter.formatMe(result, context);
      case 'calibration':
        return portfolioFormatter.formatCalibration(result, context);
      case 'leaderboard':
        return portfolioFormatter.formatLeaderboard(result, context);

      // Kalshi
      case 'kalshiOverview':
        return kalshiFormatter.formatKalshiOverview(result, context);
      case 'kalshiMarkets':
        return kalshiFormatter.formatKalshiMarkets(result, context);
      case 'kalshiBuy':
        return kalshiFormatter.formatKalshiBuy(result, context);
      case 'kalshiSell':
        return kalshiFormatter.formatKalshiSell(result, context);
      case 'kalshiPositions':
        return kalshiFormatter.formatKalshiPositions(result, context);
      case 'kalshiBalance':
        return kalshiFormatter.formatKalshiBalance(result, context);
      case 'kalshiOrders':
        return kalshiFormatter.formatKalshiOrders(result, context);
      case 'kalshiCancel':
        return kalshiFormatter.formatKalshiCancel(result, context);

      // Generic fallback
      default:
        return this.formatGeneric(result, context);
    }
  }

  /**
   * Format an error result
   */
  formatError(error: ErrorResult, context: CommandContext): FormattedResponse {
    return createErrorResponse(error, context);
  }

  /**
   * Format markets list
   */
  formatMarkets(markets: MarketData[], context: CommandContext): FormattedResponse {
    return marketsFormatter.formatMarkets(markets, context);
  }

  /**
   * Format single market
   */
  formatMarket(market: MarketData, context: CommandContext): FormattedResponse {
    return marketsFormatter.formatMarket(market, context);
  }

  /**
   * Format positions
   */
  formatPositions(positions: PositionData[], context: CommandContext): FormattedResponse {
    return portfolioFormatter.formatPositions(positions, context);
  }

  /**
   * Format arbitrage opportunities
   */
  formatArbitrage(opportunities: ArbitrageData[], context: CommandContext): FormattedResponse {
    return marketsFormatter.formatArbitrage(opportunities, context);
  }

  /**
   * Format wallet data
   */
  formatWallet(wallet: BaseWalletData, _context: CommandContext): FormattedResponse {
    let text = `${bold('💳 WALLET')}\n\n`;

    const shortAddr = wallet.publicKey.slice(0, 6) + '...' + wallet.publicKey.slice(-4);
    text += `Address: \`${shortAddr}\`\n`;
    text += `SOL: ${wallet.solBalance.toFixed(4)}\n`;
    text += `USDC: $${wallet.usdcBalance.toFixed(2)}\n`;

    if (wallet.isNew) {
      text += italic('\nNew wallet - no prediction history yet');
    }

    return createResponse(text, { mood: 'NEUTRAL', data: wallet });
  }

  /**
   * Generic fallback formatter
   */
  formatGeneric(result: CommandResult, _context: CommandContext): ExtendedResponse {
    // If result has a pre-formatted message or text, use it
    const message = (result as { message?: string }).message;
    const mood = (result as { mood?: Mood }).mood;
    if (message) {
      return createResponse(message, { mood: mood || 'NEUTRAL', data: result.data });
    }

    // If result has text data, format it
    if (typeof result.data === 'string') {
      return createResponse(result.data, { mood: 'NEUTRAL' });
    }

    // Default: stringify data
    if (result.data) {
      try {
        const text = JSON.stringify(result.data, null, 2);
        return createResponse(`\`\`\`\n${truncateMessage(text, 4000)}\n\`\`\``, { mood: 'NEUTRAL' });
      } catch {
        return createResponse(italic('Result data could not be displayed.'), { mood: 'NEUTRAL' });
      }
    }

    return createResponse(italic('Command completed.'), { mood: 'NEUTRAL' });
  }
}

// Singleton instance
let formatterInstance: TelegramFormatter | null = null;

/**
 * Get the Telegram formatter instance
 */
export function getTelegramFormatter(): TelegramFormatter {
  if (!formatterInstance) {
    formatterInstance = new TelegramFormatter();
  }
  return formatterInstance;
}

// Default export
export default TelegramFormatter;
