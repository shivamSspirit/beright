/**
 * Market Aggregator
 *
 * Combines multiple market providers into a unified interface.
 * Handles parallel fetching, deduplication, and cross-platform comparison.
 */

import type {
  MarketProvider,
  MarketAggregator as IMarketAggregator,
  MarketSearchOptions,
  ProviderHealth,
  MarketComparison,
} from '../../../domain/ports/providers/MarketProvider';
import type { Market } from '../../../domain/entities/Market';
import type { Platform } from '../../../shared/types/Common';
import type { Result } from '../../../shared/types/Result';
import { Result as ResultHelper } from '../../../shared/types/Result';
import { AppError } from '../../../shared/errors/AppError';

/**
 * Market Aggregator Implementation
 */
export class MarketAggregator implements IMarketAggregator {
  private providers: Map<Platform, MarketProvider>;

  constructor(providers: MarketProvider[]) {
    this.providers = new Map();
    for (const provider of providers) {
      if (provider.isConfigured()) {
        this.providers.set(provider.platform, provider);
      }
    }
  }

  /**
   * Get all configured providers
   */
  getProviders(): MarketProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get provider for specific platform
   */
  getProvider(platform: Platform): MarketProvider | null {
    return this.providers.get(platform) || null;
  }

  /**
   * Health check all providers
   */
  async healthCheckAll(): Promise<Result<ProviderHealth[], AppError>> {
    try {
      const providers = this.getProviders();
      const results = await Promise.all(
        providers.map(p => p.healthCheck())
      );

      const healths: ProviderHealth[] = [];
      for (const result of results) {
        if (result.ok) {
          healths.push(result.value);
        }
      }

      return ResultHelper.ok(healths);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error checking health'
      ));
    }
  }

  /**
   * Search across all platforms
   */
  async searchAll(
    query: string,
    options?: MarketSearchOptions
  ): Promise<Result<Market[], AppError>> {
    const platforms = Array.from(this.providers.keys());
    return this.searchPlatforms(platforms, query, options);
  }

  /**
   * Search specific platforms
   */
  async searchPlatforms(
    platforms: Platform[],
    query: string,
    options?: MarketSearchOptions
  ): Promise<Result<Market[], AppError>> {
    try {
      const limitPerPlatform = options?.limit || 10;

      // Fetch from all platforms in parallel
      const promises = platforms
        .filter(p => this.providers.has(p))
        .map(async (platform) => {
          const provider = this.providers.get(platform);
          if (!provider) return [];

          const result = await provider.search(query, {
            ...options,
            limit: limitPerPlatform,
          });

          return result.ok ? result.value : [];
        });

      const results = await Promise.all(promises);

      // Flatten and deduplicate
      const allMarkets = results.flat();
      const deduplicated = this.deduplicateMarkets(allMarkets);

      // Sort by volume
      deduplicated.sort((a, b) => b.volume - a.volume);

      return ResultHelper.ok(deduplicated);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error searching platforms'
      ));
    }
  }

  /**
   * Get hot markets from all platforms
   */
  async getHotAll(limitPerPlatform = 5): Promise<Result<Market[], AppError>> {
    try {
      const providers = this.getProviders();

      const promises = providers.map(async (provider) => {
        const result = await provider.getHot(limitPerPlatform);
        return result.ok ? result.value : [];
      });

      const results = await Promise.all(promises);

      // Flatten and sort by volume
      const allMarkets = results.flat();
      allMarkets.sort((a, b) => b.volume - a.volume);

      return ResultHelper.ok(allMarkets);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error fetching hot markets'
      ));
    }
  }

  /**
   * Get market from specific platform
   */
  async getMarket(
    platform: Platform,
    marketId: string
  ): Promise<Result<Market | null, AppError>> {
    const provider = this.providers.get(platform);

    if (!provider) {
      return ResultHelper.err(AppError.notFound(`Platform not configured: ${platform}`));
    }

    return provider.getById(marketId);
  }

  /**
   * Compare markets across platforms for arbitrage detection
   */
  async compareMarkets(
    query: string,
    minMatchConfidence = 0.7
  ): Promise<Result<MarketComparison[], AppError>> {
    try {
      // Search all platforms
      const searchResult = await this.searchAll(query, { limit: 20 });

      if (searchResult.ok === false) {
        return searchResult;
      }

      const markets = searchResult.value;

      // Group markets by similar topic
      const groups = this.groupSimilarMarkets(markets, minMatchConfidence);

      // Calculate spreads and arbitrage opportunities
      const comparisons: MarketComparison[] = groups.map(group => {
        const prices = group.map(m => m.yesPrice.value);
        const maxSpread = Math.max(...prices) - Math.min(...prices);

        return {
          topic: group[0]?.title || 'Unknown',
          markets: group,
          maxSpread,
          hasArbitrage: maxSpread >= 0.03 && group.length >= 2,
          matchConfidence: group.length > 1 ? this.calculateMatchConfidence(group) : 1,
        };
      });

      // Sort by spread (potential arbitrage)
      comparisons.sort((a, b) => b.maxSpread - a.maxSpread);

      return ResultHelper.ok(comparisons);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error comparing markets'
      ));
    }
  }

  /**
   * Deduplicate markets from different platforms
   */
  private deduplicateMarkets(markets: Market[]): Market[] {
    const seen = new Set<string>();
    const unique: Market[] = [];

    for (const market of markets) {
      const key = `${market.platform}:${market.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(market);
      }
    }

    return unique;
  }

  /**
   * Group similar markets together
   */
  private groupSimilarMarkets(markets: Market[], minConfidence: number): Market[][] {
    const groups: Market[][] = [];
    const assigned = new Set<number>();

    for (let i = 0; i < markets.length; i++) {
      if (assigned.has(i)) continue;

      const marketI = markets[i];
      if (!marketI) continue;

      const group: Market[] = [marketI];
      assigned.add(i);

      for (let j = i + 1; j < markets.length; j++) {
        if (assigned.has(j)) continue;

        const marketJ = markets[j];
        if (!marketJ) continue;

        const similarity = this.calculateSimilarity(
          marketI.title,
          marketJ.title
        );

        if (similarity >= minConfidence) {
          group.push(marketJ);
          assigned.add(j);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  /**
   * Calculate text similarity (simple Jaccard index)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const normalize = (s: string) =>
      s.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2);

    const words1 = new Set(normalize(text1));
    const words2 = new Set(normalize(text2));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    if (union.size === 0) return 0;

    return intersection.size / union.size;
  }

  /**
   * Calculate match confidence for a group
   */
  private calculateMatchConfidence(group: Market[]): number {
    if (group.length < 2) return 1;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < group.length; i++) {
      const marketI = group[i];
      if (!marketI) continue;

      for (let j = i + 1; j < group.length; j++) {
        const marketJ = group[j];
        if (!marketJ) continue;

        totalSimilarity += this.calculateSimilarity(
          marketI.title,
          marketJ.title
        );
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 1;
  }
}

export default MarketAggregator;
