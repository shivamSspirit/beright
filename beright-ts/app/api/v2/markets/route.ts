/**
 * Data Fabric Markets API v2
 *
 * Unified market data endpoint that aggregates from all platforms.
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDataFabric, DataFabricQuery, MarketCategory } from '../../../../lib/dataFabric';

/**
 * GET /api/v2/markets
 *
 * Query Parameters:
 * - q: Search query
 * - category: Filter by category (politics, crypto, sports, etc.)
 * - platforms: Comma-separated list of platforms
 * - minVolume: Minimum total volume
 * - minLiquidity: Minimum total liquidity
 * - minTrust: Minimum trust score (0-100)
 * - closingWithin: Markets closing within N hours
 * - arbitrage: Only show arbitrage opportunities (true/false)
 * - sortBy: volume, liquidity, closing, trust, spread, created
 * - sortOrder: asc, desc
 * - limit: Number of results (default 50, max 200)
 * - offset: Pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Build query from URL params
    const query: DataFabricQuery = {};

    // Search query
    const q = searchParams.get('q');
    if (q) query.query = q;

    // Category filter
    const category = searchParams.get('category');
    if (category) query.category = category as MarketCategory;

    // Platforms filter
    const platforms = searchParams.get('platforms');
    if (platforms) {
      query.platforms = platforms.split(',') as any[];
    }

    // Volume filter
    const minVolume = searchParams.get('minVolume');
    if (minVolume) query.minVolume = parseFloat(minVolume);

    // Liquidity filter
    const minLiquidity = searchParams.get('minLiquidity');
    if (minLiquidity) query.minLiquidity = parseFloat(minLiquidity);

    // Trust filter
    const minTrust = searchParams.get('minTrust');
    if (minTrust) query.minTrustScore = parseFloat(minTrust);

    // Closing soon filter
    const closingWithin = searchParams.get('closingWithin');
    if (closingWithin) query.closingWithin = parseFloat(closingWithin);

    // Arbitrage filter
    const arbitrage = searchParams.get('arbitrage');
    if (arbitrage === 'true') query.includeArbitrageOnly = true;

    // Sorting
    const sortBy = searchParams.get('sortBy');
    if (sortBy) query.sortBy = sortBy as any;

    const sortOrder = searchParams.get('sortOrder');
    if (sortOrder) query.sortOrder = sortOrder as 'asc' | 'desc';

    // Pagination
    const limit = searchParams.get('limit');
    query.limit = Math.min(parseInt(limit || '50'), 200);

    const offset = searchParams.get('offset');
    if (offset) query.offset = parseInt(offset);

    // Fetch from Data Fabric
    const fabric = getDataFabric();
    const result = await fabric.getMarkets(query);

    return NextResponse.json({
      success: true,
      data: result.markets,
      meta: {
        total: result.total,
        offset: result.offset,
        limit: result.limit,
        hasMore: result.hasMore,
        fetchedAt: result.fetchedAt.toISOString(),
        latencyMs: result.latencyMs,
        sources: result.sources,
        cacheHit: result.cacheHit,
        dataQualityScore: result.dataQualityScore,
      },
      warnings: result.warnings,
    });
  } catch (error) {
    console.error('[API v2/markets] Error:', error);
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
 * Health check endpoint
 */
export async function HEAD() {
  try {
    const fabric = getDataFabric();
    const health = await fabric.getHealthStatus();

    if (health.healthy) {
      return new NextResponse(null, { status: 200 });
    }
    return new NextResponse(null, { status: 503 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
