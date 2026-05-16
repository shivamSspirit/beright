/**
 * ML Type Adapters
 *
 * Converts between ML matching types and Data Fabric types.
 * These adapters ensure clean separation between ML layer and data layer.
 *
 * @author BeRight Protocol
 */

import { MLMatchResult, PlatformMarket } from './types';
import {
  UnifiedMarket,
  PlatformMarketData,
  MarketStatus,
  generateMarketId,
  generateSlug,
} from '../dataFabric/types';
import { TrustLevel } from '../data/types';
import { aggregateProbability } from '../aggregation';

// =============================================================================
// ML RESULT TO UNIFIED MARKET
// =============================================================================

/**
 * Convert MLMatchResult to UnifiedMarket
 *
 * This is the primary adapter used when ML matching is enabled.
 * It transforms ML clustering results into the format expected by the rest of the system.
 */
export function mlResultToUnifiedMarket(
  result: MLMatchResult,
  options: {
    useLMSR?: boolean;
  } = {}
): UnifiedMarket {
  const { useLMSR = false } = options;

  // Convert platform markets to platform market data
  const platforms: PlatformMarketData[] = result.markets.map(platformMarketToData);

  // Calculate consensus price
  let consensusPrice: number;
  if (useLMSR && platforms.length > 1) {
    consensusPrice = aggregateProbability(
      platforms.map(p => ({
        platform: p.platform,
        yesPrice: p.yesPrice,
        liquidity: p.liquidity,
        volume24h: p.volume24h || 0,
      })),
      { method: 'lmsr' }
    ).probability;
  } else {
    consensusPrice = result.consensusPrice;
  }

  // Calculate best bid/ask
  const yesPrices = result.markets.map(m => m.yesPrice);
  const bestBid = Math.max(...yesPrices);
  const bestAsk = Math.min(...yesPrices.map(p => 1 - p)); // Lowest ask = 1 - highest no price

  // Build tags from entities
  const tags: string[] = [
    ...result.entities.people,
    ...result.entities.organizations,
    ...result.entities.events,
  ].slice(0, 10);

  // Determine status
  const status: MarketStatus = result.closeDate && result.closeDate < new Date()
    ? 'closed'
    : 'active';

  return {
    // Identity
    id: result.eventId,
    slug: generateSlug(result.canonicalQuestion),

    // Content
    question: result.canonicalQuestion,
    description: undefined, // ML doesn't generate descriptions
    category: result.category,
    tags,

    // Cross-platform data
    platforms,

    // Aggregated pricing
    bestBid,
    bestAsk,
    consensusPrice: Math.round(consensusPrice * 1000) / 1000,
    priceRange: {
      min: Math.min(...yesPrices),
      max: Math.max(...yesPrices),
    },

    // Arbitrage
    arbitrageSpread: result.arbitrage?.spread,
    arbitragePlatforms: result.arbitrage ? {
      buyPlatform: result.arbitrage.buyPlatform,
      sellPlatform: result.arbitrage.sellPlatform,
      spread: result.arbitrage.spread,
      profitPct: result.arbitrage.profitPct,
    } : undefined,

    // Volume & Liquidity
    totalVolume: result.totalVolume24h,
    totalVolume24h: result.totalVolume24h,
    totalLiquidity: result.totalLiquidity,

    // Timing
    closeDate: result.closeDate,
    createdAt: undefined,
    lastUpdate: result.matchedAt,

    // Status
    status,
    isResolved: false,
    resolution: null,

    // Trust & Quality
    overallTrustScore: result.matchConfidence * 100, // Convert to 0-100 scale
    platformCount: result.markets.length,
  };
}

/**
 * Convert PlatformMarket (ML type) to PlatformMarketData (DataFabric type)
 */
function platformMarketToData(market: PlatformMarket): PlatformMarketData {
  // Determine trust level based on platform
  // TrustLevel: 'verified' | 'good' | 'unverified' | 'suspicious' | 'filtered'
  let trustScore: number;
  let trustLevel: TrustLevel;

  switch (market.platform) {
    case 'polymarket':
      trustScore = 85;
      trustLevel = 'verified';
      break;
    case 'kalshi':
      trustScore = 90;
      trustLevel = 'verified';
      break;
    case 'manifold':
      trustScore = 70;
      trustLevel = 'good';
      break;
    case 'jupiter':
      trustScore = 75;
      trustLevel = 'good';
      break;
    default:
      trustScore = 60;
      trustLevel = 'unverified';
  }

  return {
    platform: market.platform,
    platformId: market.platformId,
    url: market.url || '',

    // Pricing
    yesPrice: market.yesPrice,
    noPrice: market.noPrice,

    // Volume & Liquidity
    volume: market.volume24h,
    volume24h: market.volume24h,
    liquidity: market.liquidity,

    // Timestamps
    lastUpdate: new Date(),

    // Trust
    trustScore,
    trustLevel,
  };
}

// =============================================================================
// BATCH CONVERSION
// =============================================================================

/**
 * Convert multiple ML results to unified markets
 */
export function mlResultsToUnifiedMarkets(
  results: MLMatchResult[],
  options: {
    useLMSR?: boolean;
  } = {}
): UnifiedMarket[] {
  return results.map(result => mlResultToUnifiedMarket(result, options));
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Calculate overall trust score from platforms
 */
export function calculateOverallTrust(platforms: PlatformMarketData[]): number {
  if (platforms.length === 0) return 50;

  // Volume-weighted average of trust scores
  const totalVolume = platforms.reduce((sum, p) => sum + (p.volume || 1), 0);

  if (totalVolume === 0) {
    return platforms.reduce((sum, p) => sum + p.trustScore, 0) / platforms.length;
  }

  return platforms.reduce((sum, p) => {
    const weight = (p.volume || 1) / totalVolume;
    return sum + p.trustScore * weight;
  }, 0);
}

/**
 * Merge trust levels (take the best)
 * TrustLevel: 'verified' | 'good' | 'unverified' | 'suspicious' | 'filtered'
 */
export function mergeTrustLevels(levels: TrustLevel[]): TrustLevel {
  const order: TrustLevel[] = ['filtered', 'suspicious', 'unverified', 'good', 'verified'];
  let best = 0;

  for (const level of levels) {
    const idx = order.indexOf(level);
    if (idx > best) best = idx;
  }

  return order[best];
}
