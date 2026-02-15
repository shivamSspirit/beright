/**
 * DFlow Market Provider
 *
 * Implements MarketProvider interface for DFlow (tokenized Kalshi on Solana).
 * Wraps the existing lib/dflow/api.ts implementation.
 */

import type { MarketProvider, MarketSearchOptions, ProviderHealth } from '../../../domain/ports/providers/MarketProvider';
import type { Market } from '../../../domain/entities/Market';
import { Market as MarketEntity } from '../../../domain/entities/Market';
import type { Platform } from '../../../shared/types/Common';
import type { Result } from '../../../shared/types/Result';
import { Result as ResultHelper } from '../../../shared/types/Result';
import { AppError } from '../../../shared/errors/AppError';

// Import existing DFlow functions
import {
  getEvents,
  searchEvents,
  getMarket,
  getSeries,
  getTagsAndCategories,
  type DFlowMarket,
  type DFlowEvent,
} from '../../../../lib/dflow/api';

/**
 * DFlow Provider Implementation
 */
export class DFlowProvider implements MarketProvider {
  readonly platform: Platform = 'dflow';

  /**
   * Check if provider is configured
   */
  isConfigured(): boolean {
    // DFlow public API doesn't require configuration
    return true;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<Result<ProviderHealth, AppError>> {
    const startTime = Date.now();

    try {
      const response = await getEvents({ limit: 1 });
      const latencyMs = Date.now() - startTime;

      return ResultHelper.ok({
        platform: this.platform,
        isHealthy: response.success,
        latencyMs,
        lastChecked: new Date(),
        error: response.error,
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

      // DFlow has working search
      const response = await searchEvents(query);

      if (!response.success || !response.data) {
        return ResultHelper.ok([]);
      }

      // Flatten events to markets
      const markets: Market[] = [];
      for (const event of response.data) {
        if (event.markets) {
          for (const market of event.markets) {
            const converted = this.convertMarket(market, event);
            if (converted) {
              markets.push(converted);
            }
          }
        }
      }

      // Sort by volume and limit
      markets.sort((a, b) => b.volume - a.volume);

      return ResultHelper.ok(markets.slice(0, limit));
    } catch (err) {
      return ResultHelper.err(AppError.external(
        'dflow',
        err instanceof Error ? err.message : 'Unknown error searching markets'
      ));
    }
  }

  /**
   * Get hot/trending markets
   */
  async getHot(limit = 10): Promise<Result<Market[], AppError>> {
    try {
      const response = await getEvents({
        status: 'active',
        sort: 'volume',
        limit: limit * 2,
        withNestedMarkets: true,
      });

      if (!response.success || !response.data) {
        return ResultHelper.ok([]);
      }

      // Flatten events to markets
      const markets: Market[] = [];
      for (const event of response.data.events) {
        if (event.markets) {
          for (const market of event.markets) {
            const converted = this.convertMarket(market, event);
            if (converted) {
              markets.push(converted);
            }
          }
        }
      }

      // Sort by volume and limit
      markets.sort((a, b) => b.volume - a.volume);

      return ResultHelper.ok(markets.slice(0, limit));
    } catch (err) {
      return ResultHelper.err(AppError.external(
        'dflow',
        err instanceof Error ? err.message : 'Unknown error fetching hot markets'
      ));
    }
  }

  /**
   * Get market by ID (ticker)
   */
  async getById(marketId: string): Promise<Result<Market | null, AppError>> {
    try {
      const response = await getMarket(marketId);

      if (!response.success || !response.data) {
        return ResultHelper.ok(null);
      }

      const converted = this.convertMarket(response.data);

      return ResultHelper.ok(converted);
    } catch (err) {
      return ResultHelper.err(AppError.external(
        'dflow',
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

      // DFlow might support batch by mint, but for tickers we fetch individually
      const promises = marketIds.map(id => this.getById(id));
      const results = await Promise.all(promises);

      for (const result of results) {
        if (result.ok && result.value) {
          markets.push(result.value);
        }
      }

      return ResultHelper.ok(markets);
    } catch (err) {
      return ResultHelper.err(AppError.external(
        'dflow',
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
      // DFlow has categories via series
      const response = await getSeries();

      if (!response.success || !response.data) {
        // Fallback to search
        return this.search(category, { limit });
      }

      // Filter series by category
      const series = response.data.series || [];
      const matchingSeries = series.filter(s =>
        s.category?.toLowerCase() === category.toLowerCase() ||
        s.title?.toLowerCase().includes(category.toLowerCase())
      );

      if (matchingSeries.length === 0) {
        return this.search(category, { limit });
      }

      // Get events for matching series
      const markets: Market[] = [];
      for (const s of matchingSeries.slice(0, 5)) {
        const eventResponse = await getEvents({
          seriesTickers: [s.ticker],
          withNestedMarkets: true,
          limit: 10,
        });

        if (eventResponse.success && eventResponse.data) {
          for (const event of eventResponse.data.events) {
            if (event.markets) {
              for (const market of event.markets) {
                const converted = this.convertMarket(market, event);
                if (converted) {
                  markets.push(converted);
                }
              }
            }
          }
        }
      }

      return ResultHelper.ok(markets.slice(0, limit));
    } catch (err) {
      return ResultHelper.err(AppError.external(
        'dflow',
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
      const response = await getEvents({
        status: 'active',
        sort: 'startDate',
        limit: 100,
        withNestedMarkets: true,
      });

      if (!response.success || !response.data) {
        return ResultHelper.ok([]);
      }

      const now = Date.now();
      const cutoff = now + hoursUntilClose * 60 * 60 * 1000;

      const markets: Market[] = [];
      for (const event of response.data.events) {
        if (event.markets) {
          for (const market of event.markets) {
            const expTime = market.expirationTime
              ? (typeof market.expirationTime === 'number'
                  ? market.expirationTime * 1000
                  : new Date(market.expirationTime).getTime())
              : 0;

            if (expTime > now && expTime < cutoff) {
              const converted = this.convertMarket(market, event);
              if (converted) {
                markets.push(converted);
              }
            }
          }
        }
      }

      // Sort by expiration time
      markets.sort((a, b) =>
        (a.endDate?.getTime() || 0) - (b.endDate?.getTime() || 0)
      );

      return ResultHelper.ok(markets.slice(0, limit));
    } catch (err) {
      return ResultHelper.err(AppError.external(
        'dflow',
        err instanceof Error ? err.message : 'Unknown error fetching closing soon'
      ));
    }
  }

  /**
   * Get recently resolved markets
   */
  async getRecentlyResolved(limit = 20): Promise<Result<Market[], AppError>> {
    try {
      // DFlow uses 'determined' status for resolved markets
      const response = await getEvents({
        status: 'determined',
        sort: 'startDate',
        order: 'desc',
        limit,
        withNestedMarkets: true,
      });

      if (!response.success || !response.data) {
        return ResultHelper.ok([]);
      }

      const markets: Market[] = [];
      for (const event of response.data.events) {
        if (event.markets) {
          for (const market of event.markets) {
            const converted = this.convertMarket(market, event);
            if (converted) {
              markets.push(converted);
            }
          }
        }
      }

      return ResultHelper.ok(markets);
    } catch (err) {
      return ResultHelper.err(AppError.external(
        'dflow',
        err instanceof Error ? err.message : 'Unknown error fetching resolved markets'
      ));
    }
  }

  /**
   * Get available categories
   */
  async getCategories(): Promise<Result<string[], AppError>> {
    try {
      const response = await getTagsAndCategories();

      if (!response.success || !response.data) {
        return ResultHelper.ok([]);
      }

      return ResultHelper.ok(Object.keys(response.data));
    } catch (err) {
      return ResultHelper.err(AppError.external(
        'dflow',
        err instanceof Error ? err.message : 'Unknown error fetching categories'
      ));
    }
  }

  /**
   * Convert DFlow market to Market entity
   */
  private convertMarket(dm: DFlowMarket, event?: DFlowEvent): Market | null {
    try {
      // Filter out sports parlays (known broken pricing)
      if (dm.title?.toLowerCase().includes('parlay')) {
        return null;
      }

      // Calculate yes price from bid/ask
      const yesBid = parseFloat(dm.yesBid || '0') / 100;
      const yesAsk = parseFloat(dm.yesAsk || '0') / 100;
      const yesPrice = yesBid && yesAsk ? (yesBid + yesAsk) / 2 : 0.5;

      // Parse expiration time
      let endDate: Date | undefined;
      if (dm.expirationTime) {
        endDate = typeof dm.expirationTime === 'number'
          ? new Date(dm.expirationTime * 1000)
          : new Date(dm.expirationTime);
      }

      const result = MarketEntity.create({
        id: dm.ticker,
        platform: 'dflow',
        title: dm.title || event?.title || dm.ticker,
        question: dm.title || event?.title,
        yesPrice,
        noPrice: 1 - yesPrice,
        volume: dm.volume || 0,
        liquidity: dm.openInterest || 0,
        endDate,
        status: this.mapStatus(dm.status),
        url: `https://app.dflow.net/markets/${dm.ticker}`,
        category: dm.eventTicker,
        metadata: {
          eventTicker: dm.eventTicker,
          yesBid: dm.yesBid,
          yesAsk: dm.yesAsk,
          noBid: dm.noBid,
          noAsk: dm.noAsk,
          accounts: dm.accounts,
        },
      });

      return result.ok ? result.value : null;
    } catch {
      return null;
    }
  }

  /**
   * Map DFlow status to standard status
   */
  private mapStatus(status?: string): 'open' | 'closed' | 'resolved' {
    switch (status) {
      case 'active':
      case 'initialized':
        return 'open';
      case 'inactive':
      case 'closed':
        return 'closed';
      case 'determined':
      case 'finalized':
        return 'resolved';
      default:
        return 'open';
    }
  }
}

export default DFlowProvider;
