/**
 * Market Service
 *
 * Core business logic for market data operations.
 * Provides unified access to markets across all platforms.
 */

import type { MarketAggregator, MarketSearchOptions, ProviderHealth } from '../../domain/ports/providers/MarketProvider';
import type { Market } from '../../domain/entities/Market';
import type { Platform } from '../../shared/types/Common';
import type { Result } from '../../shared/types/Result';
import { Result as ResultHelper } from '../../shared/types/Result';
import { AppError } from '../../shared/errors/AppError';

/**
 * Odds comparison result
 */
export interface OddsComparison {
  query: string;
  markets: MarketOdds[];
  bestYesBuy: MarketOdds | null;
  bestNoBuy: MarketOdds | null;
  maxSpread: number;
  hasArbitrage: boolean;
}

export interface MarketOdds {
  platform: Platform;
  marketId: string;
  title: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  url: string;
}

/**
 * Market Service Interface
 */
export interface IMarketService {
  searchMarkets(query: string, options?: MarketSearchOptions): Promise<Result<Market[], AppError>>;
  getHotMarkets(limit?: number): Promise<Result<Market[], AppError>>;
  getMarket(platform: Platform, marketId: string): Promise<Result<Market | null, AppError>>;
  compareOdds(query: string): Promise<Result<OddsComparison, AppError>>;
  getClosingSoon(hours?: number, limit?: number): Promise<Result<Market[], AppError>>;
  getCategories(): Promise<Result<Record<Platform, string[]>, AppError>>;
  healthCheck(): Promise<Result<ProviderHealth[], AppError>>;
}

/**
 * Simple in-memory cache
 */
interface CacheEntry<T> {
  data: T;
  expiry: number;
}

/**
 * Market Service Implementation
 */
export class MarketService implements IMarketService {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private readonly cacheTtlMs = 30000; // 30 seconds

  constructor(private aggregator: MarketAggregator) {}

  /**
   * Search markets across platforms
   */
  async searchMarkets(
    query: string,
    options?: MarketSearchOptions
  ): Promise<Result<Market[], AppError>> {
    const cacheKey = `search:${query}:${JSON.stringify(options || {})}`;

    // Check cache
    const cached = this.getFromCache<Market[]>(cacheKey);
    if (cached) {
      return ResultHelper.ok(cached);
    }

    // Fetch from aggregator
    const result = await this.aggregator.searchAll(query, options);

    if (result.ok) {
      this.setCache(cacheKey, result.value);
    }

    return result;
  }

  /**
   * Get hot/trending markets
   */
  async getHotMarkets(limit = 10): Promise<Result<Market[], AppError>> {
    const cacheKey = `hot:${limit}`;

    const cached = this.getFromCache<Market[]>(cacheKey);
    if (cached) {
      return ResultHelper.ok(cached);
    }

    const result = await this.aggregator.getHotAll(Math.ceil(limit / 3));

    if (result.ok) {
      // Take top N across all platforms
      const sorted = result.value
        .sort((a, b) => b.volume - a.volume)
        .slice(0, limit);

      this.setCache(cacheKey, sorted);
      return ResultHelper.ok(sorted);
    }

    return result;
  }

  /**
   * Get a specific market
   */
  async getMarket(
    platform: Platform,
    marketId: string
  ): Promise<Result<Market | null, AppError>> {
    const cacheKey = `market:${platform}:${marketId}`;

    const cached = this.getFromCache<Market | null>(cacheKey);
    if (cached !== undefined) {
      return ResultHelper.ok(cached);
    }

    const result = await this.aggregator.getMarket(platform, marketId);

    if (result.ok) {
      this.setCache(cacheKey, result.value);
    }

    return result;
  }

  /**
   * Compare odds across platforms
   */
  async compareOdds(query: string): Promise<Result<OddsComparison, AppError>> {
    // Search all platforms
    const searchResult = await this.searchMarkets(query, { limit: 30 });

    if (searchResult.ok === false) {
      return searchResult;
    }

    const markets = searchResult.value;

    if (markets.length === 0) {
      return ResultHelper.ok({
        query,
        markets: [],
        bestYesBuy: null,
        bestNoBuy: null,
        maxSpread: 0,
        hasArbitrage: false,
      });
    }

    // Convert to MarketOdds
    const odds: MarketOdds[] = markets.map(m => ({
      platform: m.platform,
      marketId: m.id,
      title: m.title,
      yesPrice: m.yesPrice.value,
      noPrice: m.noPrice.value,
      volume: m.volume,
      url: m.url || '',
    }));

    // Find best prices
    const sortedByYes = [...odds].sort((a, b) => a.yesPrice - b.yesPrice);
    const sortedByNo = [...odds].sort((a, b) => a.noPrice - b.noPrice);

    const bestYesBuy = sortedByYes[0] || null;
    const bestNoBuy = sortedByNo[0] || null;

    // Calculate max spread
    const yesPrices = odds.map(o => o.yesPrice);
    const maxSpread = Math.max(...yesPrices) - Math.min(...yesPrices);

    // Check for arbitrage (simplified - buy yes on one, buy no on another)
    // Arbitrage exists if: cheapest yes + cheapest no < 1
    const hasArbitrage = bestYesBuy && bestNoBuy
      ? (bestYesBuy.yesPrice + bestNoBuy.noPrice) < 0.97
      : false;

    return ResultHelper.ok({
      query,
      markets: odds,
      bestYesBuy,
      bestNoBuy,
      maxSpread,
      hasArbitrage,
    });
  }

  /**
   * Get markets closing soon
   */
  async getClosingSoon(
    hours = 24,
    limit = 20
  ): Promise<Result<Market[], AppError>> {
    const cacheKey = `closing:${hours}:${limit}`;

    const cached = this.getFromCache<Market[]>(cacheKey);
    if (cached) {
      return ResultHelper.ok(cached);
    }

    // Fetch from each provider
    const providers = this.aggregator.getProviders();
    const limitPerProvider = Math.ceil(limit / providers.length);

    const promises = providers.map(p => p.getClosingSoon(hours, limitPerProvider));
    const results = await Promise.all(promises);

    const allMarkets: Market[] = [];
    for (const result of results) {
      if (result.ok) {
        allMarkets.push(...result.value);
      }
    }

    // Sort by end date
    allMarkets.sort((a, b) =>
      (a.endDate?.getTime() || Infinity) - (b.endDate?.getTime() || Infinity)
    );

    const limited = allMarkets.slice(0, limit);
    this.setCache(cacheKey, limited);

    return ResultHelper.ok(limited);
  }

  /**
   * Get categories from all platforms
   */
  async getCategories(): Promise<Result<Record<Platform, string[]>, AppError>> {
    const cacheKey = 'categories';

    const cached = this.getFromCache<Record<Platform, string[]>>(cacheKey);
    if (cached) {
      return ResultHelper.ok(cached);
    }

    const providers = this.aggregator.getProviders();
    const categories: Record<string, string[]> = {};

    for (const provider of providers) {
      const result = await provider.getCategories();
      if (result.ok) {
        categories[provider.platform] = result.value;
      } else {
        categories[provider.platform] = [];
      }
    }

    this.setCache(cacheKey, categories);

    return ResultHelper.ok(categories as Record<Platform, string[]>);
  }

  /**
   * Health check all providers
   */
  async healthCheck(): Promise<Result<ProviderHealth[], AppError>> {
    return this.aggregator.healthCheckAll();
  }

  /**
   * Get from cache
   */
  private getFromCache<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) return undefined;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data;
  }

  /**
   * Set cache entry
   */
  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.cacheTtlMs,
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export default MarketService;
