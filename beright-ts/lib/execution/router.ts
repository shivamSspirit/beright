/**
 * Smart Order Router
 *
 * Routes orders to optimal execution venues based on:
 * - Best price
 * - Liquidity depth
 * - Fee structure
 * - Execution speed
 *
 * @author BeRight Protocol
 */

import {
  OrderRequest,
  ExecutionResult,
  ExecutionQuote,
  ExecutionVenue,
  RoutingStrategy,
  RoutingDecision,
  OrderSide,
  TradingConnector,
} from './types';
import { Platform, UnifiedMarket } from '../dataFabric/types';
import { getConnector, getConnectedConnectors } from './connectors';
import { getDataFabric } from '../dataFabric';

// =============================================================================
// ROUTING CONFIGURATION
// =============================================================================

/**
 * Platform priority (higher = preferred when equal)
 */
const PLATFORM_PRIORITY: Record<Platform, number> = {
  polymarket: 100,   // Highest liquidity
  kalshi: 80,        // Regulated, USD
  limitless: 70,     // On-chain USDC
  manifold: 50,      // Play money
  metaculus: 0,      // No trading
  prophetx: 40,      // Secondary platform
  novig: 30,         // Smaller platform
  sxbet: 30,         // Sports focused
  myriad: 20,        // Smaller platform
  baozi: 10,         // Minimal liquidity
  probable: 10,      // Newer platform
};

/**
 * Minimum edge to justify cross-platform routing
 */
const MIN_ROUTING_EDGE = 0.01; // 1%

/**
 * Maximum position per venue (as fraction of order)
 */
const MAX_VENUE_ALLOCATION = 0.7; // 70% max per venue

// =============================================================================
// SMART ORDER ROUTER
// =============================================================================

export class SmartOrderRouter {
  // ==========================================================================
  // QUOTE AGGREGATION
  // ==========================================================================

  /**
   * Get quotes from all available venues for a market
   */
  async getQuotes(
    marketId: string,
    side: OrderSide,
    size: number
  ): Promise<ExecutionQuote[]> {
    const quotes: ExecutionQuote[] = [];

    // Try to find market on unified fabric first
    const dataFabric = getDataFabric();
    const marketResult = await dataFabric.getMarket(marketId);

    if (marketResult?.market) {
      // Market found - get quotes from all platforms it's listed on
      const platforms = marketResult.market.platforms.map((p: { platform: Platform }) => p.platform);

      for (const platform of platforms) {
        const connector = getConnector(platform);
        if (!connector || !connector.isConnected()) continue;

        try {
          const platformId = marketResult.market.platforms
            .find((p: { platform: Platform; platformId: string }) => p.platform === platform)?.platformId;

          if (platformId) {
            const quote = await connector.getQuote(platformId, side, size);
            quotes.push(quote);
          }
        } catch (error) {
          console.error(`[Router] Failed to get quote from ${platform}:`, error);
        }
      }
    } else {
      // Fallback: try all connected connectors
      const connectors = getConnectedConnectors();

      for (const connector of connectors) {
        try {
          const quote = await connector.getQuote(marketId, side, size);
          quotes.push(quote);
        } catch (error) {
          // Market may not exist on this platform
        }
      }
    }

    return quotes;
  }

  /**
   * Get best quote across all venues
   */
  async getBestQuote(
    marketId: string,
    side: OrderSide,
    size: number
  ): Promise<ExecutionQuote | null> {
    const quotes = await this.getQuotes(marketId, side, size);

    if (quotes.length === 0) return null;

    // Sort by total cost (price + slippage + fees)
    quotes.sort((a, b) => {
      const totalA = a.estimatedTotal;
      const totalB = b.estimatedTotal;

      // For buys, lower is better
      // For "sells" (shorting YES = buying NO), we're still buying so lower is better
      return totalA - totalB;
    });

    return quotes[0];
  }

  // ==========================================================================
  // ROUTING DECISIONS
  // ==========================================================================

  /**
   * Determine optimal routing for an order
   */
  async route(
    marketId: string,
    side: OrderSide,
    size: number,
    strategy: RoutingStrategy = 'BEST_PRICE'
  ): Promise<RoutingDecision> {
    const quotes = await this.getQuotes(marketId, side, size);

    if (quotes.length === 0) {
      return {
        strategy,
        venues: [],
        estimatedSavings: 0,
        warnings: ['No available venues for this market'],
      };
    }

    const warnings: string[] = [];

    // Apply routing strategy
    let venues: RoutingDecision['venues'] = [];

    switch (strategy) {
      case 'BEST_PRICE':
        venues = this.routeBestPrice(quotes);
        break;

      case 'BEST_LIQUIDITY':
        venues = this.routeBestLiquidity(quotes);
        break;

      case 'LOWEST_FEES':
        venues = this.routeLowestFees(quotes);
        break;

      case 'FASTEST':
        venues = this.routeFastest(quotes);
        break;

      case 'SPLIT':
        venues = this.routeSplit(quotes, size);
        break;

      case 'PREFER_SOLANA':
        venues = this.routePreferPlatform(quotes, 'kalshi'); // DFlow routes to Kalshi
        break;

      case 'PREFER_USD':
        venues = this.routePreferPlatform(quotes, 'kalshi');
        break;

      default:
        venues = this.routeBestPrice(quotes);
    }

    // Calculate savings vs naive routing
    const naiveTotal = quotes[0]?.estimatedTotal || 0;
    const routedTotal = venues.reduce(
      (sum, v) => sum + v.allocation * (quotes.find(q => q.recommendedVenue === v.platform)?.estimatedTotal || 0),
      0
    );
    const estimatedSavings = naiveTotal - routedTotal;

    // Add warnings
    if (venues.length === 0) {
      warnings.push('Could not determine optimal venue');
    }

    const totalAllocation = venues.reduce((sum, v) => sum + v.allocation, 0);
    if (Math.abs(totalAllocation - 1) > 0.01) {
      warnings.push('Partial fill expected - insufficient liquidity');
    }

    return {
      strategy,
      venues,
      estimatedSavings: Math.max(0, estimatedSavings),
      warnings,
    };
  }

  /**
   * Route to best price
   */
  private routeBestPrice(quotes: ExecutionQuote[]): RoutingDecision['venues'] {
    // Sort by total cost
    const sorted = [...quotes].sort((a, b) => a.estimatedTotal - b.estimatedTotal);

    if (sorted.length === 0) return [];

    const best = sorted[0];

    return [{
      platform: best.recommendedVenue,
      allocation: 1,
      reason: `Best price: ${(best.estimatedPrice * 100).toFixed(1)}¢ with ${(best.estimatedFees * 100).toFixed(2)}% fees`,
    }];
  }

  /**
   * Route to deepest liquidity
   */
  private routeBestLiquidity(quotes: ExecutionQuote[]): RoutingDecision['venues'] {
    // Sort by liquidity
    const sorted = [...quotes].sort((a, b) => {
      const liqA = a.allVenues[0]?.liquidity || 0;
      const liqB = b.allVenues[0]?.liquidity || 0;
      return liqB - liqA;
    });

    if (sorted.length === 0) return [];

    const best = sorted[0];

    return [{
      platform: best.recommendedVenue,
      allocation: 1,
      reason: `Deepest liquidity: $${((best.allVenues[0]?.liquidity || 0) / 1000).toFixed(0)}k`,
    }];
  }

  /**
   * Route to lowest fees
   */
  private routeLowestFees(quotes: ExecutionQuote[]): RoutingDecision['venues'] {
    // Sort by fees
    const sorted = [...quotes].sort((a, b) => {
      const feeA = a.allVenues[0]?.fees.taker || 0;
      const feeB = b.allVenues[0]?.fees.taker || 0;
      return feeA - feeB;
    });

    if (sorted.length === 0) return [];

    const best = sorted[0];

    return [{
      platform: best.recommendedVenue,
      allocation: 1,
      reason: `Lowest fees: ${((best.allVenues[0]?.fees.taker || 0) * 100).toFixed(1)}%`,
    }];
  }

  /**
   * Route for fastest execution (use platform priority as proxy)
   */
  private routeFastest(quotes: ExecutionQuote[]): RoutingDecision['venues'] {
    // Sort by platform priority (higher = faster assumed)
    const sorted = [...quotes].sort((a, b) => {
      const priA = PLATFORM_PRIORITY[a.recommendedVenue] || 0;
      const priB = PLATFORM_PRIORITY[b.recommendedVenue] || 0;
      return priB - priA;
    });

    if (sorted.length === 0) return [];

    const best = sorted[0];

    return [{
      platform: best.recommendedVenue,
      allocation: 1,
      reason: 'Fastest execution venue',
    }];
  }

  /**
   * Route to preferred platform (with fallback to best price)
   */
  private routePreferPlatform(
    quotes: ExecutionQuote[],
    preferredPlatform: Platform
  ): RoutingDecision['venues'] {
    // Find quote for preferred platform
    const preferred = quotes.find(q => q.recommendedVenue === preferredPlatform);

    if (preferred) {
      return [{
        platform: preferred.recommendedVenue,
        allocation: 1,
        reason: `Preferred platform: ${preferredPlatform}`,
      }];
    }

    // Fallback to best price
    console.log(`[Router] Preferred platform ${preferredPlatform} not available, using best price`);
    return this.routeBestPrice(quotes);
  }

  /**
   * Split order across venues for best overall execution
   */
  private routeSplit(
    quotes: ExecutionQuote[],
    totalSize: number
  ): RoutingDecision['venues'] {
    if (quotes.length === 0) return [];
    if (quotes.length === 1) return this.routeBestPrice(quotes);

    // Sort by price
    const sorted = [...quotes].sort((a, b) => a.estimatedPrice - b.estimatedPrice);

    const venues: RoutingDecision['venues'] = [];
    let remaining = 1; // Allocation remaining

    for (const quote of sorted) {
      if (remaining <= 0) break;

      const liquidity = quote.allVenues[0]?.liquidity || 0;
      const maxFill = Math.min(
        remaining,
        MAX_VENUE_ALLOCATION,
        liquidity > 0 ? liquidity / totalSize : 0.5
      );

      if (maxFill > 0.05) { // Minimum 5% allocation
        venues.push({
          platform: quote.recommendedVenue,
          allocation: maxFill,
          reason: `Split: ${(maxFill * 100).toFixed(0)}% @ ${(quote.estimatedPrice * 100).toFixed(1)}¢`,
        });
        remaining -= maxFill;
      }
    }

    // Normalize allocations to sum to 1
    const total = venues.reduce((sum, v) => sum + v.allocation, 0);
    if (total > 0 && total < 1) {
      for (const venue of venues) {
        venue.allocation /= total;
      }
    }

    return venues;
  }

  // ==========================================================================
  // ORDER EXECUTION
  // ==========================================================================

  /**
   * Execute an order using smart routing
   */
  async execute(
    request: OrderRequest,
    strategy: RoutingStrategy = 'BEST_PRICE'
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    // Get routing decision
    const routing = await this.route(
      request.marketId,
      request.side,
      request.size,
      strategy
    );

    if (routing.venues.length === 0) {
      return [{
        success: false,
        error: routing.warnings.join('; ') || 'No venues available',
        venue: request.platform,
        latencyMs: 0,
      }];
    }

    // Execute on each venue
    for (const venue of routing.venues) {
      const connector = getConnector(venue.platform);
      if (!connector || !connector.isConnected()) {
        results.push({
          success: false,
          error: `Connector not available: ${venue.platform}`,
          venue: venue.platform,
          latencyMs: 0,
        });
        continue;
      }

      // Calculate size for this venue
      const venueSize = request.size * venue.allocation;

      // Get platform-specific market ID
      let platformMarketId = request.marketId;

      // Try to resolve unified ID to platform ID
      const dataFabric = getDataFabric();
      const marketResult = await dataFabric.getMarket(request.marketId);

      if (marketResult?.market) {
        const platformData = marketResult.market.platforms.find(
          (p: { platform: Platform; platformId: string }) => p.platform === venue.platform
        );
        if (platformData) {
          platformMarketId = platformData.platformId;
        }
      }

      // Submit order
      const venueRequest: OrderRequest = {
        ...request,
        marketId: platformMarketId,
        platform: venue.platform,
        size: venueSize,
      };

      const result = await connector.submitOrder(venueRequest);
      results.push(result);
    }

    return results;
  }

  /**
   * Execute with automatic retry on partial failures
   */
  async executeWithRetry(
    request: OrderRequest,
    strategy: RoutingStrategy = 'BEST_PRICE',
    maxRetries: number = 2
  ): Promise<{
    results: ExecutionResult[];
    totalFilled: number;
    totalCost: number;
    avgPrice: number;
  }> {
    let results = await this.execute(request, strategy);
    let retries = 0;

    // Calculate filled
    let totalFilled = results
      .filter(r => r.success && r.order)
      .reduce((sum, r) => sum + (r.order?.filledSize || 0), 0);

    const totalCost = results
      .filter(r => r.success && r.order)
      .reduce((sum, r) => {
        const order = r.order!;
        return sum + (order.filledSize * (order.avgFillPrice || 0)) + (order.fees || 0);
      }, 0);

    // Retry for unfilled portion
    while (totalFilled < request.size && retries < maxRetries) {
      const remaining = request.size - totalFilled;

      if (remaining < 1) break; // Below minimum

      const retryRequest: OrderRequest = {
        ...request,
        size: remaining,
      };

      const retryResults = await this.execute(retryRequest, strategy);
      results = [...results, ...retryResults];

      const newFilled = retryResults
        .filter(r => r.success && r.order)
        .reduce((sum, r) => sum + (r.order?.filledSize || 0), 0);

      totalFilled += newFilled;
      retries++;

      if (newFilled === 0) break; // No progress
    }

    const avgPrice = totalFilled > 0 ? totalCost / totalFilled : 0;

    return {
      results,
      totalFilled,
      totalCost,
      avgPrice,
    };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let router: SmartOrderRouter | null = null;

export function getSmartOrderRouter(): SmartOrderRouter {
  if (!router) {
    router = new SmartOrderRouter();
  }
  return router;
}

export default SmartOrderRouter;
