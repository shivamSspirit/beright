/**
 * Unified Feed API v2
 *
 * ML-powered market feed with multiple feed types:
 * - hot: High volume, multi-platform markets
 * - closing_soon: Markets closing within 24h
 * - arbitrage: Cross-platform arbitrage opportunities
 * - new: Recently created markets
 * - trending: Volume spike detection
 * - category: Filtered by category
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDataFabric } from '../../../../lib/dataFabric';
import {
  filterByFeedType,
  MLMatchResult,
  FeedType,
  FeedQuery,
} from '../../../../lib/ml';
import { MarketCategory } from '../../../../lib/dataFabric/types';
import { DataPlatform } from '../../../../lib/data/types';

// =============================================================================
// ML RESULTS CACHE (avoid recomputing on every request)
// =============================================================================

interface MLCache {
  results: MLMatchResult[];
  timestamp: number;
}

const ML_CACHE_TTL = 60_000; // 60 seconds
let mlCache: MLCache | null = null;

// Request timeout for ML processing (30 seconds)
const ML_REQUEST_TIMEOUT = 30_000;

/**
 * Get cached ML results or compute new ones
 * Includes timeout to prevent indefinite hangs
 */
async function getMLResults(
  platforms?: DataPlatform[]
): Promise<{ results: MLMatchResult[]; fromCache: boolean }> {
  // Check cache
  if (mlCache && Date.now() - mlCache.timestamp < ML_CACHE_TTL) {
    return { results: mlCache.results, fromCache: true };
  }

  // Wrap in timeout to prevent indefinite hangs
  const computeResults = async (): Promise<MLMatchResult[]> => {
    console.log('[API v2/feed] Computing ML results...');

    // Fetch from DataFabric - it already does ML matching internally
    const fabric = getDataFabric();
    const fabricResult = await fabric.getMarkets({
      limit: 100, // Reduced for faster initial load
      platforms,
    });

    console.log(`[API v2/feed] Fetched ${fabricResult.markets.length} unified markets from DataFabric`);

    // Convert UnifiedMarket to MLMatchResult format directly
    // DataFabric already did ML matching, so we just adapt the format
    const results: MLMatchResult[] = fabricResult.markets.map(market => ({
      eventId: market.id,
      canonicalQuestion: market.question,
      category: market.category,
      markets: market.platforms.map(p => ({
        platform: p.platform,
        platformId: p.platformId,
        question: market.question,
        yesPrice: p.yesPrice,
        noPrice: p.noPrice,
        volume24h: p.volume24h || p.volume,
        liquidity: p.liquidity,
        url: p.url,
        closeDate: market.closeDate,
      })),
      matchConfidence: market.matchConfidence || 0.95, // DataFabric sets this
      consensusPrice: market.consensusPrice,
      priceSpread: market.priceRange.max - market.priceRange.min,
      totalLiquidity: market.totalLiquidity,
      totalVolume24h: market.totalVolume,
      arbitrage: market.arbitrageSpread && market.arbitrageSpread > 0.02 && market.arbitragePlatforms ? {
        buyPlatform: market.arbitragePlatforms.buy,
        buyPrice: market.platforms.find(p => p.platform === market.arbitragePlatforms?.buy)?.yesPrice || 0,
        sellPlatform: market.arbitragePlatforms.sell,
        sellPrice: market.platforms.find(p => p.platform === market.arbitragePlatforms?.sell)?.yesPrice || 0,
        spread: market.arbitrageSpread,
        profitPct: market.arbitrageSpread * 100,
        estimatedFees: 0.02, // ~2% typical platform fees
        netProfit: market.arbitrageSpread - 0.02,
      } : undefined,
      entities: {
        people: market.tags?.filter(t => t.startsWith('person:')).map(t => t.replace('person:', '')) || [],
        organizations: market.tags?.filter(t => t.startsWith('org:')).map(t => t.replace('org:', '')) || [],
        events: market.tags?.filter(t => t.startsWith('event:')).map(t => t.replace('event:', '')) || [],
        locations: [],
        dates: [],
        amounts: [],
        customTags: market.tags?.filter(t => !t.includes(':')) || [],
      },
      closeDate: market.closeDate,
      matchedAt: new Date(),
    }));

    console.log(`[API v2/feed] Converted ${results.length} markets to feed format`);
    return results;
  };

  try {
    // Race between computation and timeout
    const results = await Promise.race([
      computeResults(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('ML processing timeout')), ML_REQUEST_TIMEOUT)
      ),
    ]);

    // Update cache
    mlCache = { results, timestamp: Date.now() };

    return { results, fromCache: false };
  } catch (error) {
    console.error('[API v2/feed] ML processing failed:', error);

    // If we have stale cache, use it rather than failing completely
    if (mlCache) {
      console.log('[API v2/feed] Using stale cache due to processing error');
      return { results: mlCache.results, fromCache: true };
    }

    // No cache available, return empty results
    return { results: [], fromCache: false };
  }
}

/**
 * GET /api/v2/feed
 *
 * Query Parameters:
 * - type: Feed type (hot, closing_soon, arbitrage, new, trending, category)
 * - category: Filter by category (required for type=category)
 * - platforms: Comma-separated list of platforms
 * - minLiquidity: Minimum total liquidity
 * - limit: Number of results (default 20, max 100)
 * - offset: Pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const start = Date.now();
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const type = (searchParams.get('type') || 'hot') as FeedType;
    const category = searchParams.get('category') as MarketCategory | undefined;
    const platformsParam = searchParams.get('platforms');
    const platforms = platformsParam
      ? (platformsParam.split(',') as DataPlatform[])
      : undefined;
    const minLiquidity = searchParams.get('minLiquidity')
      ? parseFloat(searchParams.get('minLiquidity')!)
      : undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate feed type
    const validTypes: FeedType[] = ['hot', 'closing_soon', 'arbitrage', 'new', 'trending', 'category'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid feed type. Must be one of: ${validTypes.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Category required for category feed
    if (type === 'category' && !category) {
      return NextResponse.json(
        {
          success: false,
          error: 'category parameter required for type=category',
        },
        { status: 400 }
      );
    }

    // Get ML results (cached or fresh)
    const { results: mlResults, fromCache } = await getMLResults(platforms);

    // Build feed query
    const feedQuery: FeedQuery = {
      type,
      category: category || undefined,
      limit,
      offset,
      minLiquidity,
      platforms,
    };

    // Filter by feed type
    const feedResponse = filterByFeedType(mlResults, feedQuery);

    // Transform results for API response
    const responseData = feedResponse.markets.map(transformMLResult);

    return NextResponse.json({
      success: true,
      data: responseData,
      meta: {
        type,
        total: feedResponse.total,
        offset,
        limit,
        hasMore: feedResponse.hasMore,
        fetchedAt: feedResponse.fetchedAt.toISOString(),
        latencyMs: Date.now() - start,
        mlLatencyMs: feedResponse.latencyMs,
        cacheHit: fromCache,
      },
    });
  } catch (error) {
    console.error('[API v2/feed] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Transform MLMatchResult to API response format
 */
function transformMLResult(result: MLMatchResult): Record<string, unknown> {
  return {
    id: result.eventId,
    question: result.canonicalQuestion,
    category: result.category,
    consensusPrice: result.consensusPrice,
    priceSpread: result.priceSpread,
    matchConfidence: result.matchConfidence,
    platformCount: result.markets.length,
    platforms: result.markets.map(m => ({
      platform: m.platform,
      platformId: m.platformId,
      yesPrice: m.yesPrice,
      volume24h: m.volume24h,
      liquidity: m.liquidity,
      url: m.url,
    })),
    totalLiquidity: result.totalLiquidity,
    totalVolume24h: result.totalVolume24h,
    arbitrage: result.arbitrage
      ? {
          buyPlatform: result.arbitrage.buyPlatform,
          buyPrice: result.arbitrage.buyPrice,
          sellPlatform: result.arbitrage.sellPlatform,
          sellPrice: result.arbitrage.sellPrice,
          spread: result.arbitrage.spread,
          profitPct: result.arbitrage.profitPct,
          netProfit: result.arbitrage.netProfit,
        }
      : null,
    entities: {
      people: result.entities.people,
      organizations: result.entities.organizations,
      events: result.entities.events,
    },
    closeDate: result.closeDate?.toISOString() || null,
    matchedAt: result.matchedAt.toISOString(),
  };
}

/**
 * POST /api/v2/feed - Batch query multiple feed types
 */
export async function POST(request: NextRequest) {
  try {
    const start = Date.now();
    const body = await request.json();

    if (!body.feeds || !Array.isArray(body.feeds)) {
      return NextResponse.json(
        {
          success: false,
          error: 'feeds array required in request body',
        },
        { status: 400 }
      );
    }

    // Get ML results (cached or fresh)
    const { results: mlResults, fromCache } = await getMLResults();

    // Process each feed request
    const results: Record<string, unknown> = {};

    for (const feedReq of body.feeds) {
      const feedQuery: FeedQuery = {
        type: feedReq.type || 'hot',
        category: feedReq.category,
        limit: Math.min(feedReq.limit || 10, 50),
        offset: feedReq.offset || 0,
        minLiquidity: feedReq.minLiquidity,
      };

      const feedResponse = filterByFeedType(mlResults, feedQuery);
      results[feedReq.type || 'hot'] = {
        markets: feedResponse.markets.map(transformMLResult),
        total: feedResponse.total,
        hasMore: feedResponse.hasMore,
      };
    }

    return NextResponse.json({
      success: true,
      data: results,
      meta: {
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - start,
        cacheHit: fromCache,
      },
    });
  } catch (error) {
    console.error('[API v2/feed] POST Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
