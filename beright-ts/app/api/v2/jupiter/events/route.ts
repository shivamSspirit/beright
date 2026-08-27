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
  getMarket,
  searchEvents,
  getHotEvents,
} from '../../../../../lib/jupiter/prediction';
import type {
  JupiterCategory,
  JupiterEvent,
  JupiterEventsParams,
  JupiterEventStatus,
  JupiterMarketStatus,
} from '../../../../../lib/jupiter/types';
import { isDemoRequest } from '../../../../../lib/mode';
import { getDemoMarketsWithJitter, searchDemoMarkets } from '../../../../../lib/demo/mockMarkets';
import type { DemoMarket } from '../../../../../lib/demo/mockMarkets';

function toMicroUsd(value: number): string {
  return Math.round(value * 1_000_000).toString();
}

function toJupiterCategory(category: string): JupiterCategory {
  if (category === 'tech') return 'technology';

  const supportedCategories: JupiterCategory[] = [
    'crypto',
    'politics',
    'sports',
    'economics',
    'entertainment',
    'science',
    'technology',
    'world',
    'other',
  ];

  return supportedCategories.includes(category as JupiterCategory)
    ? category as JupiterCategory
    : 'other';
}

function toJupiterEventStatus(status: DemoMarket['status']): JupiterEventStatus {
  if (status === 'active') return 'active';
  if (status === 'resolved') return 'settled';
  return 'closed';
}

function toJupiterMarketStatus(market: DemoMarket): JupiterMarketStatus {
  if (market.status === 'active') return 'active';
  if (market.status === 'closed') return 'closed';
  return market.yesPrice >= market.noPrice ? 'resolved_yes' : 'resolved_no';
}

/**
 * Transform demo market to Jupiter event format
 */
function transformToJupiterEvent(market: DemoMarket): JupiterEvent {
  const eventId = `evt-${market.ticker}`;

  return {
    eventId,
    title: market.title,
    description: market.question,
    category: toJupiterCategory(market.category),
    status: toJupiterEventStatus(market.status),
    endTime: market.endDate,
    imageUrl: market.imageUrl,
    markets: [{
      marketId: `mkt-${market.ticker}`,
      eventId,
      title: market.title,
      description: market.question,
      status: toJupiterMarketStatus(market),
      provider: 'polymarket',
      pricing: {
        buyYesPriceUsd: toMicroUsd(market.yesPrice),
        buyNoPriceUsd: toMicroUsd(market.noPrice),
        volume: toMicroUsd(market.volume),
        volume24h: toMicroUsd(market.volume24h),
        liquidity: toMicroUsd(market.liquidity),
        openInterest: toMicroUsd(market.openInterest),
      },
      onChain: {
        marketPubkey: market.tokens.marketLedger,
        yesMint: market.tokens.yesMint,
        noMint: market.tokens.noMint,
      },
      closeTime: market.endDate,
    }],
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Get mode from middleware-injected header (instant, no parsing needed)
    const demoMode = isDemoRequest(request);

    // ============================================
    // DEMO MODE: Return mock Jupiter events
    // ============================================
    if (demoMode) {
      const limit = parseInt(searchParams.get('limit') || '20');

      // Get single event by ID (demo)
      const eventId = searchParams.get('id');
      if (eventId) {
        const markets = getDemoMarketsWithJitter(20);
        const normalized = eventId.startsWith('mkt-') ? eventId.slice('mkt-'.length) : eventId;
        const market = markets.find((m) =>
          `jupiter-${m.ticker}` === eventId ||
          `evt-${m.ticker}` === eventId ||
          `mkt-${m.ticker}` === eventId ||
          m.ticker === normalized
        );
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
      // Jupiter's public URL uses marketId (e.g. POLY-75478). Our route accepts both.
      // 1) Try as eventId.
      const response = await getEvent(eventId);
      if (response.success && response.data) {
        return NextResponse.json({ success: true, data: response.data });
      }

      // 2) Fallback: treat as marketId, fetch market, then fetch its event (and attach markets if missing).
      const marketRes = await getMarket(eventId);
      if (!marketRes.success || !marketRes.data) {
        return NextResponse.json(
          { success: false, error: response.error || marketRes.error || 'Event not found' },
          { status: 404 }
        );
      }

      const eventRes = await getEvent(marketRes.data.eventId);
      if (!eventRes.success || !eventRes.data) {
        return NextResponse.json(
          { success: false, error: eventRes.error || 'Event not found' },
          { status: 404 }
        );
      }

      // Ensure the requested market is present.
      const existing = eventRes.data.markets || [];
      const hasMarket = existing.some((m: any) => m.marketId === marketRes.data?.marketId);
      const merged = {
        ...eventRes.data,
        markets: hasMarket ? existing : [marketRes.data, ...existing],
      };

      return NextResponse.json({ success: true, data: merged });
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
