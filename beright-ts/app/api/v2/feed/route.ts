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
  matchMarkets,
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

/**
 * Get cached ML results or compute new ones
 */
async function getMLResults(
  platforms?: DataPlatform[]
): Promise<{ results: MLMatchResult[]; fromCache: boolean }> {
  // Check cache
  if (mlCache && Date.now() - mlCache.timestamp < ML_CACHE_TTL) {
    return { results: mlCache.results, fromCache: true };
  }

  // Fetch from DataFabric
  const fabric = getDataFabric();
  const fabricResult = await fabric.getMarkets({
    limit: 300, // Reduced for faster processing
    platforms,
  });

  // Convert to RawMarketData format
  const rawMarkets = fabricResult.markets.flatMap(market =>
    market.platforms.map(p => ({
      id: p.platformId,
      platform: p.platform,
      source: 'direct' as const,
      title: market.question,
      question: market.question,
      yesPrice: p.yesPrice,
      noPrice: p.noPrice,
      volume: p.volume,
      volume24h: p.volume24h || p.volume,
      liquidity: p.liquidity,
      url: p.url,
      endDate: market.closeDate,
      fetchedAt: p.lastUpdate,
      status: market.status as 'active' | 'resolved',
    }))
  );

  // Run ML matching
  const results = await matchMarkets(rawMarkets);

  // Update cache
  mlCache = { results, timestamp: Date.now() };

  return { results, fromCache: false };
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
