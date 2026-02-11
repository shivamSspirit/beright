/**
 * Markets API Route
 * GET /api/markets - Get markets list
 * GET /api/markets?q=bitcoin - Search markets
 * GET /api/markets?hot=true - Get trending markets
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withMiddleware, jsonResponse, ApiContext } from '../../../lib/apiMiddleware';
import { searchMarkets, getHotMarkets, compareOdds } from '../../../skills/markets';

// Query parameter validation schema
const querySchema = z.object({
  q: z.string().max(200).optional(),
  hot: z.enum(['true', 'false']).optional(),
  compare: z.enum(['true', 'false']).optional(),
  limit: z.string().regex(/^\d+$/).optional().transform(v => v ? parseInt(v) : 20),
  platform: z.enum(['polymarket', 'kalshi', 'manifold', 'limitless', 'metaculus']).optional(),
}).strict();

export const GET = withMiddleware(
  async (request: NextRequest, context: ApiContext) => {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const hot = searchParams.get('hot') === 'true';
    const compare = searchParams.get('compare') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');
    const platform = searchParams.get('platform');

    let markets;
    let arbitrage = null;

    if (hot) {
      // Get trending markets
      markets = await getHotMarkets(limit);
    } else if (query) {
      // Search markets
      const platforms = platform
        ? [platform as 'polymarket' | 'kalshi' | 'manifold']
        : ['polymarket', 'kalshi', 'manifold'] as const;

      markets = await searchMarkets(query, [...platforms]);

      // If compare flag is set, also get arbitrage opportunities
      if (compare) {
        const comparison = await compareOdds(query);
        arbitrage = comparison.arbitrageOpportunities;
      }
    } else {
      // Default: get all markets
      markets = await searchMarkets('', ['polymarket', 'kalshi', 'manifold']);
    }

    // Limit results
    markets = markets.slice(0, limit);

    return NextResponse.json({
      count: markets.length,
      markets: markets.map(m => ({
        id: m.marketId,
        platform: m.platform,
        title: m.title,
        question: m.question,
        yesPrice: m.yesPrice,
        noPrice: m.noPrice,
        yesPct: m.yesPct,
        noPct: m.noPct,
        volume: m.volume,
        liquidity: m.liquidity,
        endDate: m.endDate,
        status: m.status,
        url: m.url,
      })),
      arbitrage: arbitrage ? arbitrage.slice(0, 5).map(a => ({
        topic: a.topic,
        platformA: a.platformA,
        platformB: a.platformB,
        priceA: a.priceAYes,
        priceB: a.priceBYes,
        spread: a.spread,
        profitPercent: a.profitPercent,
        strategy: a.strategy,
        confidence: a.matchConfidence,
      })) : undefined,
    });
  },
  {
    rateLimit: 'markets',
    querySchema,
    cache: { maxAge: 60, staleWhileRevalidate: 120 },
  }
);
