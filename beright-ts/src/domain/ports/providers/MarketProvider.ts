/**
 * MarketProvider Interface
 *
 * Port for fetching market data from external platforms.
 * Implemented by platform-specific adapters (Kalshi, Polymarket, DFlow, etc.)
 */

import type { Platform } from '../../../shared/types/Common';
import type { Result } from '../../../shared/types/Result';
import type { Market } from '../../entities/Market';
import type { AppError } from '../../../shared/errors/AppError';

/**
 * Search options for market queries
 */
export interface MarketSearchOptions {
  query?: string;
  limit?: number;
  status?: 'open' | 'closed' | 'resolved' | 'all';
  category?: string;
  minVolume?: number;
  minLiquidity?: number;
  sortBy?: 'volume' | 'liquidity' | 'end_date' | 'created_at';
  sortDirection?: 'asc' | 'desc';
}

/**
 * Provider health status
 */
export interface ProviderHealth {
  platform: Platform;
  isHealthy: boolean;
  latencyMs: number;
  lastChecked: Date;
  error?: string;
}

/**
 * MarketProvider Port
 *
 * Each platform adapter implements this interface.
 */
export interface MarketProvider {
  /**
   * Platform identifier
   */
  readonly platform: Platform;

  /**
   * Check if provider is configured and available
   */
  isConfigured(): boolean;

  /**
   * Health check
   */
  healthCheck(): Promise<Result<ProviderHealth, AppError>>;

  /**
   * Search markets by query
   */
  search(
    query: string,
    options?: MarketSearchOptions
  ): Promise<Result<Market[], AppError>>;

  /**
   * Get trending/hot markets
   */
  getHot(limit?: number): Promise<Result<Market[], AppError>>;

  /**
   * Get market by ID
   */
  getById(marketId: string): Promise<Result<Market | null, AppError>>;

  /**
   * Get multiple markets by IDs
   */
  getByIds(marketIds: string[]): Promise<Result<Market[], AppError>>;

  /**
   * Get markets by category
   */
  getByCategory(
    category: string,
    limit?: number
  ): Promise<Result<Market[], AppError>>;

  /**
   * Get markets closing soon
   */
  getClosingSoon(
    hoursUntilClose?: number,
    limit?: number
  ): Promise<Result<Market[], AppError>>;

  /**
   * Get recently resolved markets
   */
  getRecentlyResolved(limit?: number): Promise<Result<Market[], AppError>>;

  /**
   * Get market categories available on this platform
   */
  getCategories(): Promise<Result<string[], AppError>>;
}

/**
 * MarketAggregator Interface
 *
 * Combines multiple providers into a unified interface.
 */
export interface MarketAggregator {
  /**
   * Get all configured providers
   */
  getProviders(): MarketProvider[];

  /**
   * Get provider for specific platform
   */
  getProvider(platform: Platform): MarketProvider | null;

  /**
   * Check health of all providers
   */
  healthCheckAll(): Promise<Result<ProviderHealth[], AppError>>;

  /**
   * Search across all platforms
   */
  searchAll(
    query: string,
    options?: MarketSearchOptions
  ): Promise<Result<Market[], AppError>>;

  /**
   * Search specific platforms
   */
  searchPlatforms(
    platforms: Platform[],
    query: string,
    options?: MarketSearchOptions
  ): Promise<Result<Market[], AppError>>;

  /**
   * Get hot markets from all platforms
   */
  getHotAll(limitPerPlatform?: number): Promise<Result<Market[], AppError>>;

  /**
   * Get market from any platform by ID
   */
  getMarket(
    platform: Platform,
    marketId: string
  ): Promise<Result<Market | null, AppError>>;

  /**
   * Compare markets across platforms (for arbitrage)
   */
  compareMarkets(
    query: string,
    minMatchConfidence?: number
  ): Promise<Result<MarketComparison[], AppError>>;
}

/**
 * Market comparison result (for arbitrage detection)
 */
export interface MarketComparison {
  topic: string;
  markets: Market[];
  maxSpread: number;
  hasArbitrage: boolean;
  matchConfidence: number;
}

export default MarketProvider;
