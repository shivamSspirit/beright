/**
 * Kalshi Market Provider
 *
 * Implements MarketProvider interface for Kalshi prediction market.
 * Wraps the existing lib/kalshi.ts implementation.
 */

import type { MarketProvider, MarketSearchOptions, ProviderHealth } from '../../../domain/ports/providers/MarketProvider';
import type { Market } from '../../../domain/entities/Market';
import { Market as MarketEntity } from '../../../domain/entities/Market';
import type { Platform } from '../../../shared/types/Common';
import type { Result } from '../../../shared/types/Result';
import { Result as ResultHelper } from '../../../shared/types/Result';
import { AppError } from '../../../shared/errors/AppError';

// Import existing Kalshi client
import { getKalshiPublicClient, type KalshiMarket } from '../../../../lib/kalshi';

// Get client instance
const getClient = () => getKalshiPublicClient();

/**
 * Kalshi Provider Implementation
 */
export class KalshiProvider implements MarketProvider {
  readonly platform: Platform = 'kalshi';

  /**
   * Check if provider is configured
   */
  isConfigured(): boolean {
    // Kalshi public API doesn't require configuration
    return true;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<Result<ProviderHealth, AppError>> {
    const startTime = Date.now();

    try {
      const status = await getClient().getExchangeStatus();
      const latencyMs = Date.now() - startTime;

      return ResultHelper.ok({
        platform: this.platform,
        isHealthy: status?.trading_active ?? false,
        latencyMs,
        lastChecked: new Date(),
      });
    } catch (err) {
      return ResultHelper.ok({
        platform: this.platform,
        isHealthy: false,
        latencyMs: Date.now() - startTime,
        lastChecked: new Date(),
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  /**
   * Search markets by query
   */
  async search(
    query: string,
    options?: MarketSearchOptions
  ): Promise<Result<Market[], AppError>> {
    try {
      const limit = options?.limit || 20;
      // Map status: Kalshi uses 'settled' instead of 'resolved'
      const status = this.mapStatusToKalshi(options?.status);

      // Kalshi API search is limited, so we fetch and filter client-side
      const response = await getClient().getMarkets({
        status,
        limit: Math.min(limit * 5, 200), // Fetch more for filtering
      });

      if (!response?.markets) {
        return ResultHelper.ok([]);
      }

      // Filter by query (case-insensitive)
      const queryLower = query.toLowerCase();
      const filtered = response.markets.filter((m: KalshiMarket) =>
        m.title?.toLowerCase().includes(queryLower) ||
        m.ticker?.toLowerCase().includes(queryLower) ||
        m.event_ticker?.toLowerCase().includes(queryLower)
      );

      // Convert to Market entities
      const markets = this.convertMarkets(filtered.slice(0, limit));

      return ResultHelper.ok(markets);
    } catch (err) {
      return ResultHelper.err(AppError.external(
        'kalshi',
        err instanceof Error ? err.message : 'Unknown error searching markets'
      ));
    }
  }

  /**
   * Get hot/trending markets
   */
  async getHot(limit = 10): Promise<Result<Market[], AppError>> {
    try {
      const response = await getClient().getMarkets({
        status: 'open',
        limit: limit * 2,
      });

      if (!response?.markets) {
        return ResultHelper.ok([]);
      }

      // Sort by volume (descending) and take top N
      const sorted = [...response.markets].sort((a, b) =>
        (b.volume || 0) - (a.volume || 0)
      );

      const markets = this.convertMarkets(sorted.slice(0, limit));

      return ResultHelper.ok(markets);
    } catch (err) {
      return ResultHelper.err(AppError.external(
        'kalshi',
        err instanceof Error ? err.message : 'Unknown error fetching hot markets'
      ));
    }
  }

  /**
   * Get market by ID (ticker)
   */
  async getById(marketId: string): Promise<Result<Market | null, AppError>> {
    try {
      const response = await getClient().getMarket(marketId);

      if (!response?.market) {
        return ResultHelper.ok(null);
      }

      const converted = this.convertMarket(response.market);
      if (!converted) {
        return ResultHelper.ok(null);
      }

      return ResultHelper.ok(converted);
    } catch (err) {
      return ResultHelper.err(AppError.external(
        'kalshi',
        err instanceof Error ? err.message : 'Unknown error fetching market'
      ));
    }
  }

  /**
   * Get multiple markets by IDs
   */
  async getByIds(marketIds: string[]): Promise<Result<Market[], AppError>> {
    try {
      const markets: Market[] = [];

      // Kalshi doesn't have batch endpoint, fetch individually
      for (const id of marketIds) {
        const result = await this.getById(id);
        if (result.ok && result.value) {
          markets.push(result.value);
        }
      }

      return ResultHelper.ok(markets);
    } catch (err) {
      return ResultHelper.err(AppError.external(
        'kalshi',
        err instanceof Error ? err.message : 'Unknown error fetching markets'
      ));
    }
  }

  /**
   * Get markets by category
   */
  async getByCategory(
    category: string,
    limit = 20
  ): Promise<Result<Market[], AppError>> {
    try {
      // Use series_ticker as category proxy
      const response = await getClient().getMarkets({
        series_ticker: category.toUpperCase(),
        status: 'open',
        limit,
      });

      if (!response?.markets) {
        return ResultHelper.ok([]);
      }

      const markets = this.convertMarkets(response.markets);

      return ResultHelper.ok(markets);
    } catch (err) {
      return ResultHelper.err(AppError.external(
        'kalshi',
        err instanceof Error ? err.message : 'Unknown error fetching by category'
      ));
    }
  }

  /**
   * Get markets closing soon
   */
  async getClosingSoon(
    hoursUntilClose = 24,
    limit = 20
  ): Promise<Result<Market[], AppError>> {
    try {
      const response = await getClient().getMarkets({
        status: 'open',
        limit: 100,
      });

      if (!response?.markets) {
        return ResultHelper.ok([]);
      }

      const now = Date.now();
      const cutoff = now + hoursUntilClose * 60 * 60 * 1000;

      const closing = response.markets.filter((m: KalshiMarket) => {
        if (!m.close_time) return false;
        const closeTime = new Date(m.close_time).getTime();
        return closeTime > now && closeTime < cutoff;
      });

      // Sort by close time
      closing.sort((a: KalshiMarket, b: KalshiMarket) =>
        new Date(a.close_time || 0).getTime() - new Date(b.close_time || 0).getTime()
      );

      const markets = this.convertMarkets(closing.slice(0, limit));

      return ResultHelper.ok(markets);
    } catch (err) {
      return ResultHelper.err(AppError.external(
        'kalshi',
        err instanceof Error ? err.message : 'Unknown error fetching closing soon'
      ));
    }
  }

  /**
   * Get recently resolved markets
   */
  async getRecentlyResolved(limit = 20): Promise<Result<Market[], AppError>> {
    try {
      const response = await getClient().getMarkets({
        status: 'settled',
        limit,
      });

      if (!response?.markets) {
        return ResultHelper.ok([]);
      }

      const markets = this.convertMarkets(response.markets);

      return ResultHelper.ok(markets);
    } catch (err) {
      return ResultHelper.err(AppError.external(
        'kalshi',
        err instanceof Error ? err.message : 'Unknown error fetching resolved markets'
      ));
    }
  }

  /**
   * Get available categories
   */
  async getCategories(): Promise<Result<string[], AppError>> {
    try {
      const response = await getClient().getSeries();

      if (!response?.series) {
        return ResultHelper.ok([]);
      }

      // Extract unique categories from series
      const categories = [...new Set(response.series.map(s => s.category))].filter(Boolean);

      return ResultHelper.ok(categories);
    } catch (err) {
      return ResultHelper.err(AppError.external(
        'kalshi',
        err instanceof Error ? err.message : 'Unknown error fetching categories'
      ));
    }
  }

  /**
   * Convert Kalshi markets to Market entities
   */
  private convertMarkets(kalshiMarkets: KalshiMarket[]): Market[] {
    const markets: Market[] = [];

    for (const km of kalshiMarkets) {
      const market = this.convertMarket(km);
      if (market) {
        markets.push(market);
      }
    }

    return markets;
  }

  /**
   * Convert single Kalshi market to Market entity
   */
  private convertMarket(km: KalshiMarket): Market | null {
    try {
      // Calculate yes price from bid/ask midpoint or last price
      const yesPrice = km.yes_bid && km.yes_ask
        ? (km.yes_bid + km.yes_ask) / 2 / 100
        : (km.last_price || 50) / 100;

      const result = MarketEntity.create({
        id: km.ticker,
        platform: 'kalshi',
        title: km.title || km.ticker,
        question: km.title,
        yesPrice,
        noPrice: 1 - yesPrice,
        volume: km.volume || 0,
        liquidity: km.open_interest || 0,
        endDate: km.close_time ? new Date(km.close_time) : undefined,
        status: this.mapStatus(km.status),
        url: `https://kalshi.com/markets/${km.ticker}`,
        category: km.event_ticker,
        metadata: {
          eventTicker: km.event_ticker,
          yesBid: km.yes_bid,
          yesAsk: km.yes_ask,
          noBid: km.no_bid,
          noAsk: km.no_ask,
        },
      });

      return result.ok ? result.value : null;
    } catch {
      return null;
    }
  }

  /**
   * Map Kalshi status to standard status
   */
  private mapStatus(status?: string): 'open' | 'closed' | 'resolved' {
    switch (status) {
      case 'open':
        return 'open';
      case 'closed':
        return 'closed';
      case 'settled':
        return 'resolved';
      default:
        return 'open';
    }
  }

  /**
   * Map standard status to Kalshi API status
   */
  private mapStatusToKalshi(status?: 'open' | 'closed' | 'resolved' | 'all'): 'open' | 'closed' | 'settled' | undefined {
    switch (status) {
      case 'open':
        return 'open';
      case 'closed':
        return 'closed';
      case 'resolved':
        return 'settled';
      case 'all':
        return undefined;
      default:
        return 'open';
    }
  }
}

export default KalshiProvider;
