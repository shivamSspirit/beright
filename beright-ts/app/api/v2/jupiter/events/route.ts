/**
 * Jupiter Prediction Events API
 *
 * GET /api/v2/jupiter/events - List prediction events
 * GET /api/v2/jupiter/events?id=<eventId> - Get single event
 * GET /api/v2/jupiter/events?q=<query> - Search events
 *
 * Demo Mode: Returns mock Jupiter events from demo data
 * Production Mode: Returns live Jupiter API data
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getEvents,
  getEvent,
  searchEvents,
  getHotEvents,
  JupiterEventsParams,
} from '../../../../../lib/jupiter/prediction';
import { isDemoFromRequest } from '../../../../../lib/mode';
import { getDemoMarketsWithJitter, searchDemoMarkets } from '../../../../../lib/demo/mockMarkets';

/**
 * Transform demo market to Jupiter event format
 */
function transformToJupiterEvent(market: any) {
  return {
    id: `jupiter-${market.ticker}`,
    eventId: `evt-${market.ticker}`,
    title: market.title,
    description: market.question,
    category: market.category || 'general',
    provider: 'jupiter' as const,
    status: market.status === 'active' ? 'active' : 'ended',
    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    endTime: market.endDate,
    volume: market.volume,
    volume24h: market.volume24h,
    liquidity: market.liquidity,
    openInterest: market.openInterest,
    imageUrl: market.imageUrl,
    externalUrl: `https://jup.ag/perps/${market.ticker}`,
    markets: [{
      id: `mkt-${market.ticker}`,
      title: market.title,
      yesPrice: market.yesPrice,
      noPrice: market.noPrice,
      volume: market.volume,
      volume24h: market.volume24h,
    }],
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Get mode from cookie (UI toggle) or fall back to environment
    const cookieHeader = request.headers.get('cookie');
    const demoMode = isDemoFromRequest(cookieHeader);

    // ============================================
    // DEMO MODE: Return mock Jupiter events
    // ============================================
    if (demoMode) {
      const limit = parseInt(searchParams.get('limit') || '20');

      // Get single event by ID (demo)
      const eventId = searchParams.get('id');
      if (eventId) {
        const markets = getDemoMarketsWithJitter(20);
        const market = markets.find(m => `jupiter-${m.ticker}` === eventId || m.ticker === eventId);
        if (!market) {
          return NextResponse.json(
            { success: false, error: 'Event not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({ success: true, data: transformToJupiterEvent(market) });
      }

      // Search events (demo)
      const query = searchParams.get('q');
      if (query) {
        const markets = searchDemoMarkets(query, limit);
        return NextResponse.json({
          success: true,
          data: markets.map(transformToJupiterEvent),
        });
      }

      // Hot events (demo) - return different subset than DFlow
      const markets = getDemoMarketsWithJitter(limit * 2);
      // Take every other market to differentiate from DFlow
      const jupiterMarkets = markets.filter((_, i) => i % 2 === 1).slice(0, limit);
      return NextResponse.json({
        success: true,
        data: jupiterMarkets.map(transformToJupiterEvent),
      });
    }

    // ============================================
    // PRODUCTION MODE: Real Jupiter API
    // ============================================

    // Get single event by ID
    const eventId = searchParams.get('id');
    if (eventId) {
      const response = await getEvent(eventId);
      if (!response.success) {
        return NextResponse.json(
          { success: false, error: response.error || 'Event not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: response.data });
    }

    // Search events
    const query = searchParams.get('q');
    if (query) {
      const response = await searchEvents({
        query,
        category: searchParams.get('category') as any,
        provider: searchParams.get('provider') as any,
        limit: parseInt(searchParams.get('limit') || '20'),
        includeMarkets: searchParams.get('includeMarkets') !== 'false',
      });

      if (!response.success) {
        return NextResponse.json(
          { success: false, error: response.error || 'Search failed' },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, data: response.data });
    }

    // Get hot/trending events (default)
    const hot = searchParams.get('hot') === 'true';
    if (hot) {
      const limit = parseInt(searchParams.get('limit') || '20');
      const response = await getHotEvents(limit);

      if (!response.success) {
        return NextResponse.json(
          { success: false, error: response.error || 'Failed to fetch hot events' },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, data: response.data });
    }

    // List events with filters
    const params: JupiterEventsParams = {
      category: searchParams.get('category') as any,
      provider: searchParams.get('provider') as any,
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0'),
      sortBy: searchParams.get('sortBy') as any,
      sortOrder: searchParams.get('sortOrder') as any,
      includeMarkets: searchParams.get('includeMarkets') !== 'false',
    };

    // Parse status array
    const statusParam = searchParams.get('status');
    if (statusParam) {
      params.status = statusParam.split(',') as any;
    }

    const response = await getEvents(params);

    if (!response.success) {
      return NextResponse.json(
        { success: false, error: response.error || 'Failed to fetch events' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: response.data,
      pagination: {
        limit: params.limit,
        offset: params.offset,
      },
    });
  } catch (error) {
    console.error('[Jupiter Events API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
