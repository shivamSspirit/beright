/**
 * BeRight Unified Data Layer
 *
 * The main entry point for all market data in BeRight.
 * Combines:
 * - Aggregators (PMXT, PolyRouter) for data collection
 * - Trust Engine for validation
 * - Cache for performance
 *
 * Usage:
 * ```typescript
 * import { dataLayer } from '@/lib/data';
 *
 * // Get validated hot markets
 * const result = await dataLayer.getHotMarkets(20);
 *
 * // Search with validation
 * const searchResult = await dataLayer.searchMarkets('bitcoin');
 *
 * // Access trust scores
 * for (const market of result.markets) {
 *   console.log(market.title, market.trustScore, market.trustLevel);
 * }
 * ```
 *
 * @author BeRight Protocol
 * @version 2.0.0 - Trust Engine
 */

import {
  RawMarketData,
  ValidatedMarket,
  DataPlatform,
  FetchOptions,
  TrustEngineResult,
  ValidatedArbitrage,
  TrustLevel,
  getTrustIndicator,
} from './types';

import { unifiedAggregator, SUPPORTED_PLATFORMS } from './aggregators/index';
import { trustEngine, formatTrustIndicator, formatValidationSummary } from '../validation/trustEngine';
import { marketCache, searchCache } from '../cache/marketCache';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Default fetch options
 */
const DEFAULT_OPTIONS: FetchOptions = {
  limit: 50,
  includeInactive: false,
  timeout: 15000,
};

// =============================================================================
// DATA LAYER
// =============================================================================

/**
 * Unified Data Layer for BeRight
 */
class DataLayer {
  /**
   * Get hot/trending markets with validation
   */
  async getHotMarkets(limit: number = 20): Promise<TrustEngineResult> {
    console.log(`[DataLayer] Fetching ${limit} hot markets...`);

    try {
      // Check cache first
      const cachedMarkets = marketCache.getAll();
      if (cachedMarkets.length >= limit) {
        console.log(`[DataLayer] Returning ${limit} cached markets`);
        return {
          markets: cachedMarkets.slice(0, limit),
          filteredOut: [],
          fetchedAt: new Date(),
          totalFetched: cachedMarkets.length,
          totalValidated: cachedMarkets.length,
          totalFiltered: 0,
          sources: ['cache'],
          dataQualityScore: this.calculateAverageScore(cachedMarkets.slice(0, limit)),
          warnings: [],
        };
      }

      // Fetch from aggregators
      const response = await unifiedAggregator.getHotMarkets(limit * 2); // Fetch extra for filtering

      console.log(`[DataLayer] Fetched ${response.markets.length} raw markets from ${response.source}`);

      // Validate through Trust Engine
      const validated = await trustEngine.validateMarkets(response.markets);

      console.log(`[DataLayer] Validated: ${validated.totalValidated}/${validated.totalFetched}, filtered: ${validated.totalFiltered}`);

      // Cache validated markets
      marketCache.setMany(validated.markets);

      // Return limited results
      return {
        ...validated,
        markets: validated.markets.slice(0, limit),
      };
    } catch (error) {
      console.error('[DataLayer] getHotMarkets error:', error);

      // Return cached data as fallback
      const cached = marketCache.getAll();
      if (cached.length > 0) {
        return {
          markets: cached.slice(0, limit),
          filteredOut: [],
          fetchedAt: new Date(),
          totalFetched: cached.length,
          totalValidated: cached.length,
          totalFiltered: 0,
          sources: ['cache'],
          dataQualityScore: this.calculateAverageScore(cached),
          warnings: [`Failed to fetch fresh data: ${error}`],
        };
      }

      // No data available
      return {
        markets: [],
        filteredOut: [],
        fetchedAt: new Date(),
        totalFetched: 0,
        totalValidated: 0,
        totalFiltered: 0,
        sources: [],
        dataQualityScore: 0,
        warnings: [`Failed to fetch data: ${error}`],
      };
    }
  }

  /**
   * Search markets with validation
   */
  async searchMarkets(
    query: string,
    platforms?: DataPlatform[],
    limit: number = 30
  ): Promise<TrustEngineResult> {
    console.log(`[DataLayer] Searching for "${query}" on ${platforms?.join(', ') || 'all platforms'}...`);

    try {
      // Check search cache
      const cached = searchCache.get(query, platforms);
      if (cached && cached.length > 0) {
        console.log(`[DataLayer] Returning ${cached.length} cached search results`);
        return {
          markets: cached.slice(0, limit),
          filteredOut: [],
          fetchedAt: new Date(),
          totalFetched: cached.length,
          totalValidated: cached.length,
          totalFiltered: 0,
          sources: ['cache'],
          dataQualityScore: this.calculateAverageScore(cached.slice(0, limit)),
          warnings: [],
        };
      }

      // Fetch from aggregators
      const response = await unifiedAggregator.searchMarkets(query, {
        platforms,
        limit: limit * 2,
      });

      console.log(`[DataLayer] Found ${response.markets.length} raw markets`);

      // Validate
      const validated = await trustEngine.validateMarkets(response.markets);

      console.log(`[DataLayer] Validated: ${validated.totalValidated}/${validated.totalFetched}`);

      // Cache results
      searchCache.set(query, validated.markets, platforms);
      marketCache.setMany(validated.markets);

      return {
        ...validated,
        markets: validated.markets.slice(0, limit),
      };
    } catch (error) {
      console.error('[DataLayer] searchMarkets error:', error);

      return {
        markets: [],
        filteredOut: [],
        fetchedAt: new Date(),
        totalFetched: 0,
        totalValidated: 0,
        totalFiltered: 0,
        sources: [],
        dataQualityScore: 0,
        warnings: [`Search failed: ${error}`],
      };
    }
  }

  /**
   * Get markets by platform with validation
   */
  async getByPlatform(
    platform: DataPlatform,
    limit: number = 30
  ): Promise<TrustEngineResult> {
    return this.searchMarkets('', [platform], limit);
  }

  /**
   * Find arbitrage opportunities with validation
   */
  async findArbitrage(
    query?: string,
    minSpread: number = 0.03
  ): Promise<ValidatedArbitrage[]> {
    console.log(`[DataLayer] Finding arbitrage opportunities...`);

    try {
      // Fetch from multiple platforms
      const response = await unifiedAggregator.fetchMarkets({
        query,
        limit: 100,
        platforms: ['polymarket', 'kalshi', 'manifold'],
      });

      // Validate
      const validated = await trustEngine.validateMarkets(response.markets);

      // Group by potential matches
      const opportunities: ValidatedArbitrage[] = [];
      const markets = validated.markets;

      // Compare each pair of markets
      for (let i = 0; i < markets.length; i++) {
        for (let j = i + 1; j < markets.length; j++) {
          const a = markets[i];
          const b = markets[j];

          // Skip same platform
          if (a.platform === b.platform) continue;

          // Check title similarity
          const similarity = this.calculateSimilarity(a.title, b.title);
          if (similarity < 0.5) continue;

          // Calculate spread
          const spread = Math.abs(a.yesPrice - b.yesPrice);
          if (spread < minSpread) continue;

          // Valid arbitrage opportunity
          const lowerPrice = a.yesPrice < b.yesPrice ? a : b;
          const higherPrice = a.yesPrice < b.yesPrice ? b : a;

          opportunities.push({
            marketA: lowerPrice,
            marketB: higherPrice,
            priceAYes: lowerPrice.yesPrice,
            priceBYes: higherPrice.yesPrice,
            spread,
            spreadPct: spread * 100,
            strategy: `Buy YES @ ${lowerPrice.platform} (${(lowerPrice.yesPrice * 100).toFixed(1)}%), Sell @ ${higherPrice.platform} (${(higherPrice.yesPrice * 100).toFixed(1)}%)`,
            profitPct: spread * 100,
            matchConfidence: similarity,
            titleSimilarity: similarity,
            isValid: true,
            trustScore: Math.min(lowerPrice.trustScore, higherPrice.trustScore),
            warnings: [
              ...lowerPrice.validation.warnings,
              ...higherPrice.validation.warnings,
            ],
            volumeA: lowerPrice.volume || 0,
            volumeB: higherPrice.volume || 0,
            minExecutableUsd: Math.min(lowerPrice.volume || 0, higherPrice.volume || 0) * 0.1,
            detectedAt: new Date(),
          });
        }
      }

      // Sort by profit potential
      opportunities.sort((a, b) => b.profitPct - a.profitPct);

      console.log(`[DataLayer] Found ${opportunities.length} arbitrage opportunities`);

      return opportunities;
    } catch (error) {
      console.error('[DataLayer] findArbitrage error:', error);
      return [];
    }
  }

  /**
   * Get a single market by ID
   */
  async getMarket(
    platform: DataPlatform,
    marketId: string
  ): Promise<ValidatedMarket | null> {
    // Check cache first
    const cached = marketCache.get(platform, marketId);
    if (cached) {
      return cached;
    }

    // Search for it
    const result = await this.searchMarkets(marketId, [platform], 1);
    return result.markets[0] || null;
  }

  /**
   * Get current oracle prices (BTC, ETH)
   */
  async getOraclePrices(): Promise<{ btc?: number; eth?: number }> {
    return trustEngine.getOraclePrices();
  }

  /**
   * Get data quality report
   */
  getDataQualityReport(): {
    cacheStats: ReturnType<typeof marketCache.getStats>;
    oraclePrices: { btc?: number; eth?: number };
    supportedPlatforms: DataPlatform[];
  } {
    return {
      cacheStats: marketCache.getStats(),
      oraclePrices: {}, // Would need async, return empty for sync
      supportedPlatforms: SUPPORTED_PLATFORMS,
    };
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    marketCache.clear();
    searchCache.clear();
    trustEngine.clearCache();
  }

  /**
   * Calculate average trust score for markets
   */
  private calculateAverageScore(markets: ValidatedMarket[]): number {
    if (markets.length === 0) return 0;
    const total = markets.reduce((sum, m) => sum + m.trustScore, 0);
    return Math.round(total / markets.length);
  }

  /**
   * Calculate title similarity (simple word-based)
   */
  private calculateSimilarity(a: string, b: string): number {
    const wordsA = new Set(
      a.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    );
    const wordsB = new Set(
      b.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    );

    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    let matches = 0;
    for (const word of wordsA) {
      if (wordsB.has(word)) matches++;
    }

    return matches / Math.max(wordsA.size, wordsB.size);
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

/**
 * Global Data Layer instance
 */
export const dataLayer = new DataLayer();

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

// Type exports (isolatedModules compatibility)
export type {
  RawMarketData,
  ValidatedMarket,
  DataPlatform,
  TrustEngineResult,
  ValidatedArbitrage,
  TrustLevel,
};

// Re-export functions
export {
  getTrustIndicator,
  formatTrustIndicator,
  formatValidationSummary,
  SUPPORTED_PLATFORMS,
};

export default dataLayer;
