/**
 * MarketRepository Interface
 *
 * Port for market data persistence operations.
 * This is primarily for caching market data, not the source of truth.
 * Market data comes from MarketProvider ports.
 */

import type { UUID, Platform } from '../../../shared/types/Common';
import type { AsyncResult } from '../../../shared/types/Result';
import type { Market } from '../../entities/Market';
import type { ArbitrageOpportunity } from '../../entities/ArbitrageOpportunity';
import type { AppError } from '../../../shared/errors/AppError';

/**
 * Market cache options
 */
export interface MarketCacheOptions {
  maxAge?: number;  // Max age in milliseconds
  platform?: Platform;
}

/**
 * Arbitrage history filter
 */
export interface ArbitrageHistoryFilter {
  platform?: Platform;
  minSpread?: number;
  detectedAfter?: Date;
  limit?: number;
}

/**
 * MarketRepository Port
 */
export interface MarketRepository {
  /**
   * Cache a market for faster subsequent access
   */
  cacheMarket(market: Market): AsyncResult<void, AppError>;

  /**
   * Cache multiple markets
   */
  cacheMarkets(markets: Market[]): AsyncResult<void, AppError>;

  /**
   * Get cached market by ID and platform
   */
  getCachedMarket(
    platform: Platform,
    marketId: string
  ): AsyncResult<Market | null, AppError>;

  /**
   * Get all cached markets for a platform
   */
  getCachedMarkets(
    platform: Platform,
    options?: MarketCacheOptions
  ): AsyncResult<Market[], AppError>;

  /**
   * Clear cache for a platform
   */
  clearCache(platform?: Platform): AsyncResult<void, AppError>;

  /**
   * Record an arbitrage opportunity
   */
  recordArbitrage(
    opportunity: ArbitrageOpportunity
  ): AsyncResult<ArbitrageOpportunity, AppError>;

  /**
   * Get arbitrage history
   */
  getArbitrageHistory(
    filter?: ArbitrageHistoryFilter
  ): AsyncResult<ArbitrageOpportunity[], AppError>;

  /**
   * Get recent arbitrage opportunities (not expired)
   */
  getActiveArbitrageOpportunities(): AsyncResult<ArbitrageOpportunity[], AppError>;

  /**
   * Add to watchlist
   */
  addToWatchlist(
    userId: UUID,
    market: Market,
    notes?: string
  ): AsyncResult<void, AppError>;

  /**
   * Remove from watchlist
   */
  removeFromWatchlist(
    userId: UUID,
    platform: Platform,
    marketId: string
  ): AsyncResult<void, AppError>;

  /**
   * Get user's watchlist
   */
  getWatchlist(userId: UUID): AsyncResult<Market[], AppError>;
}

export default MarketRepository;
