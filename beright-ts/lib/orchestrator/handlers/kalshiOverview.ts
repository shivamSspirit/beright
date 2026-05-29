/**
 * Kalshi Overview Handler
 *
 * Returns overview of Kalshi markets and user portfolio.
 * Shows hot markets, exchange status, and account summary if authenticated.
 *
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import {
  getPopularKalshiMarkets,
  getKalshiExchangeStatus,
  getKalshiPortfolioSummary,
  isKalshiConfigured,
  isKalshiDemo,
  KalshiMarket,
  KalshiExchangeStatus,
  KalshiPortfolioSummary,
} from '../../kalshi';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Kalshi market data for display
 */
export interface KalshiMarketData {
  ticker: string;
  title: string;
  subtitle?: string;
  yesPrice: number;  // 0-100 (cents)
  noPrice: number;
  spread: number;
  volume: number;
  openInterest: number;
  status: string;
  closeTime: string;
  url: string;
}

/**
 * Kalshi overview result
 */
export interface KalshiOverviewResult {
  timestamp: string;
  exchange: {
    active: boolean;
    tradingActive: boolean;
    nextOpen?: string;
    nextClose?: string;
  };
  hotMarkets: KalshiMarketData[];
  totalMarkets: number;
  portfolio?: {
    balance: number;
    available: number;
    positions: number;
    orders: number;
    isDemo: boolean;
  };
  isConfigured: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

function transformMarket(market: KalshiMarket): KalshiMarketData {
  const yesPrice = (market.yes_bid + market.yes_ask) / 2 || market.last_price || 50;
  const noPrice = 100 - yesPrice;
  const spread = Math.abs(market.yes_ask - market.yes_bid);

  // Build URL
  const eventTicker = market.event_ticker || market.ticker;
  const cleanTicker = eventTicker
    .replace(/-\d{1,2}[A-Z]{3}\d{2}$/, '')
    .replace(/-\d+$/, '')
    .toLowerCase();

  return {
    ticker: market.ticker,
    title: market.title,
    subtitle: market.subtitle,
    yesPrice,
    noPrice,
    spread,
    volume: market.volume || 0,
    openInterest: market.open_interest || 0,
    status: market.status,
    closeTime: market.close_time,
    url: `https://kalshi.com/markets/${cleanTicker}`,
  };
}

// =============================================================================
// HANDLER
// =============================================================================

export const kalshiOverviewHandler: CommandHandler<KalshiOverviewResult> = {
  id: 'kalshiOverview',
  skillsUsed: ['kalshi'],

  async execute(context: CommandContext): Promise<CommandResult<KalshiOverviewResult>> {
    const startTime = Date.now();

    try {
      // Fetch data in parallel
      const [exchangeStatus, markets, portfolio] = await Promise.all([
        getKalshiExchangeStatus().catch(() => null),
        getPopularKalshiMarkets(10).catch(() => []),
        isKalshiConfigured() ? getKalshiPortfolioSummary().catch(() => null) : Promise.resolve(null),
      ]);

      const result: KalshiOverviewResult = {
        timestamp: new Date().toISOString(),
        exchange: {
          active: exchangeStatus?.exchange_active ?? true,
          tradingActive: exchangeStatus?.trading_active ?? true,
          nextOpen: exchangeStatus?.exchange_estimated_resume_time,
        },
        hotMarkets: markets.map(transformMarket),
        totalMarkets: markets.length,
        isConfigured: isKalshiConfigured(),
      };

      // Add portfolio if authenticated
      if (portfolio) {
        result.portfolio = {
          balance: portfolio.balance.total,
          available: portfolio.balance.available,
          positions: portfolio.positions.open,
          orders: portfolio.orders.resting,
          isDemo: portfolio.isDemo,
        };
      }

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'kalshiOverview',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['kalshi'],
          apiCallsMade: portfolio ? 3 : 2,
        },
        hints: {
          mood: result.exchange.tradingActive ? 'NEUTRAL' : 'ALERT',
          suggestedActions: ['/kalshi markets', '/kalshi balance'],
        },
      };
    } catch (error) {
      console.error('[KalshiOverviewHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'KALSHI_OVERVIEW_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch Kalshi overview',
          retryable: true,
          recoveryAction: 'Try again in a moment',
        },
        meta: {
          handlerId: 'kalshiOverview',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['kalshi'],
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

registerHandler(kalshiOverviewHandler);

export default kalshiOverviewHandler;
