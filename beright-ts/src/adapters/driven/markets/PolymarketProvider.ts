/**
 * Polymarket Provider
 *
 * Implements MarketProvider interface for Polymarket.
 * Wraps the existing polymarket integration in skills/markets.ts.
 */

import type { MarketProvider, MarketSearchOptions, ProviderHealth } from '../../../domain/ports/providers/MarketProvider';
import type { Market } from '../../../domain/entities/Market';
import { Market as MarketEntity } from '../../../domain/entities/Market';
import type { Platform } from '../../../shared/types/Common';
import type { Result } from '../../../shared/types/Result';
import { Result as ResultHelper } from '../../../shared/types/Result';
import { AppError } from '../../../shared/errors/AppError';

const POLYMARKET_API = 'https://gamma-api.polymarket.com';

interface PolymarketResponse {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  outcomes: string[];
  outcomePrices: string | string[];
  volume: number;
  volume24hr?: number;
  liquidity?: number;
  endDate?: string;
  closed?: boolean;
  active?: boolean;
}

/**
 * Polymarket Provider Implementation
 */
export class PolymarketProvider implements MarketProvider {
  readonly platform: Platform = 'polymarket';

  /**
   * Check if provider is configured
   */
  isConfigured(): boolean {
    // Polymarket public API doesn't require configuration
    return true;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<Result<ProviderHealth, AppError>> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${POLYMARKET_API}/markets?limit=1`);
      const latencyMs = Date.now() - startTime;

      return ResultHelper.ok({
        platform: this.platform,
        isHealthy: response.ok,
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

      // Polymarket's search is broken, so we fetch more and filter client-side
      const response = await fetch(
        `${POLYMARKET_API}/markets?closed=false&limit=200&order=volume&ascending=false`
      );

      if (!response.ok) {
        return ResultHelper.err(AppError.external(
          'polymarket',
          `API error: ${response.status}`
        ));
      }

      const data = await response.json() as PolymarketResponse[];

      // Client-side filtering
      const queryLower = query.toLowerCase();
      const filtered = data.filter((m: PolymarketResponse) =>
        m.question?.toLowerCase().includes(queryLower)
      );

      // Sort by relevance (match count) then volume
      filtered.sort((a: PolymarketResponse, b: PolymarketResponse) => {
        const aMatches = (a.question?.toLowerCase().match(new RegExp(queryLower, 'g')) || []).length;
        const bMatches = (b.question?.toLowerCase().match(new RegExp(queryLower, 'g')) || []).length;
        if (aMatches !== bMatches) return bMatches - aMatches;
        return (b.volume || 0) - (a.volume || 0);
      });

      const markets = this.convertMarkets(filtered.slice(0, limit));

      return ResultHelper.ok(markets);
    } catch (err) {
      return ResultHelper.err(AppError.external(
        'polymarket',
        err instanceof Error ? err.message : 'Unknown error searching markets'
      ));
    }
  }

  /**
   * Get hot/trending markets
   */
  async getHot(limit = 10): Promise<Result<Market[], AppError>> {
    try {
      const response = await fetch(
        `${POLYMARKET_API}/markets?closed=false&limit=${limit}&order=volume&ascending=false`
      );

      if (!response.ok) {
        return ResultHelper.err(AppError.external(
          'polymarket',
          `API error: ${response.status}`
        ));
      }

      const data = await response.json() as PolymarketResponse[];
      const markets = this.convertMarkets(data);

      return ResultHelper.ok(markets);
    } catch (err) {
      return ResultHelper.err(AppError.external(
        'polymarket',
        err instanceof Error ? err.message : 'Unknown error fetching hot markets'
      ));
    }
  }

  /**
   * Get market by ID
   */
  async getById(marketId: string): Promise<Result<Market | null, AppError>> {
    try {
      const response = await fetch(`${POLYMARKET_API}/markets/${marketId}`);

      if (!response.ok) {
        if (response.status === 404) {
          return ResultHelper.ok(null);
        }
        return ResultHelper.err(AppError.external(
          'polymarket',
          `API error: ${response.status}`
        ));
      }

      const data = await response.json() as PolymarketResponse;
      const market = this.convertMarket(data);

      return ResultHelper.ok(market);
    } catch (err) {
      return ResultHelper.err(AppError.external(
        'polymarket',
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

      // Fetch in parallel
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
        'polymarket',
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
    // Polymarket doesn't have native category support
    // Search with category as query
    return this.search(category, { limit });
  }

  /**
   * Get markets closing soon
   */
  async getClosingSoon(
    hoursUntilClose = 24,
    limit = 20
  ): Promise<Result<Market[], AppError>> {
    try {
      const response = await fetch(
        `${POLYMARKET_API}/markets?closed=false&limit=100&order=end_date&ascending=true`
      );

      if (!response.ok) {
        return ResultHelper.err(AppError.external(
          'polymarket',
          `API error: ${response.status}`
        ));
      }

      const data = await response.json() as PolymarketResponse[];

      const now = Date.now();
      const cutoff = now + hoursUntilClose * 60 * 60 * 1000;

      const closing = data.filter((m: PolymarketResponse) => {
        if (!m.endDate) return false;
        const endTime = new Date(m.endDate).getTime();
        return endTime > now && endTime < cutoff;
      });

      const markets = this.convertMarkets(closing.slice(0, limit));

      return ResultHelper.ok(markets);
    } catch (err) {
      return ResultHelper.err(AppError.external(
        'polymarket',
        err instanceof Error ? err.message : 'Unknown error fetching closing soon'
      ));
    }
  }

  /**
   * Get recently resolved markets
   */
  async getRecentlyResolved(limit = 20): Promise<Result<Market[], AppError>> {
    try {
      const response = await fetch(
        `${POLYMARKET_API}/markets?closed=true&limit=${limit}&order=end_date&ascending=false`
      );

      if (!response.ok) {
        return ResultHelper.err(AppError.external(
          'polymarket',
          `API error: ${response.status}`
        ));
      }

      const data = await response.json() as PolymarketResponse[];
      const markets = this.convertMarkets(data);

      return ResultHelper.ok(markets);
    } catch (err) {
      return ResultHelper.err(AppError.external(
        'polymarket',
        err instanceof Error ? err.message : 'Unknown error fetching resolved markets'
      ));
    }
  }

  /**
   * Get available categories
   */
  async getCategories(): Promise<Result<string[], AppError>> {
    // Polymarket doesn't have a categories endpoint
    // Return common categories
    return ResultHelper.ok([
      'Politics',
      'Crypto',
      'Sports',
      'Entertainment',
      'Science',
      'Economics',
    ]);
  }

  /**
   * Convert Polymarket responses to Market entities
   */
  private convertMarkets(polymarkets: PolymarketResponse[]): Market[] {
    const markets: Market[] = [];

    for (const pm of polymarkets) {
      const market = this.convertMarket(pm);
      if (market) {
        markets.push(market);
      }
    }

    return markets;
  }

  /**
   * Convert single Polymarket response to Market entity
   */
  private convertMarket(pm: PolymarketResponse): Market | null {
    try {
      // Parse outcome prices
      let yesPrice = 0.5;
      if (pm.outcomePrices) {
        const prices = typeof pm.outcomePrices === 'string'
          ? JSON.parse(pm.outcomePrices)
          : pm.outcomePrices;
        yesPrice = parseFloat(prices[0]) || 0.5;
      }

      const result = MarketEntity.create({
        id: pm.conditionId || pm.id,
        platform: 'polymarket',
        title: pm.question,
        question: pm.question,
        yesPrice,
        noPrice: 1 - yesPrice,
        volume: pm.volume || 0,
        liquidity: pm.liquidity || 0,
        endDate: pm.endDate ? new Date(pm.endDate) : undefined,
        status: pm.closed ? 'resolved' : (pm.active === false ? 'closed' : 'open'),
        url: `https://polymarket.com/event/${pm.slug}`,
        metadata: {
          conditionId: pm.conditionId,
          slug: pm.slug,
          outcomes: pm.outcomes,
          volume24hr: pm.volume24hr,
        },
      });

      return result.ok ? result.value : null;
    } catch {
      return null;
    }
  }
}

export default PolymarketProvider;
