/**
 * Demo Markets API
 *
 * Returns demo market data when in demo mode.
 * In production mode, redirects to live market APIs.
 *
 * GET /api/v2/demo/markets
 * Query params:
 *   - limit: number (default 20)
 *   - search: string (search query)
 *   - category: string (filter by category)
 */

import { NextRequest, NextResponse } from 'next/server';
import { isDemo } from '@/lib/mode';
import {
  getHotDemoMarkets,
  searchDemoMarkets,
  getDemoMarkets,
  getDemoMarketsWithJitter,
} from '@/lib/demo/mockMarkets';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const search = searchParams.get('search') || searchParams.get('q');
  const category = searchParams.get('category');
  const hot = searchParams.get('hot') === 'true';

  // If not in demo mode, return redirect instruction
  if (!isDemo()) {
    return NextResponse.json({
      success: false,
      error: 'Not in demo mode',
      message: 'Use /api/v2/markets or /api/dflow for production market data',
      redirect: '/api/v2/markets',
    }, { status: 400 });
  }

  try {
    let markets;

    if (search) {
      // Search demo markets
      markets = searchDemoMarkets(search, limit);
    } else if (category) {
      // Filter by category
      markets = getDemoMarkets()
        .filter(m => m.category === category)
        .slice(0, limit);
    } else if (hot) {
      // Hot markets with price jitter for live feel
      markets = getDemoMarketsWithJitter(limit);
    } else {
      // Default: hot markets
      markets = getHotDemoMarkets(limit);
    }

    // Transform to match expected API format
    const events = markets.map(m => ({
      ticker: m.ticker,
      seriesTicker: m.seriesTicker,
      title: m.title,
      subtitle: m.question,
      status: m.status,
      yesPrice: m.yesPrice,
      noPrice: m.noPrice,
      yesPct: m.yesPct,
      noPct: m.noPct,
      yesBid: m.yesPrice - 0.01,
      yesAsk: m.yesPrice + 0.01,
      noBid: m.noPrice - 0.01,
      noAsk: m.noPrice + 0.01,
      spread: 0.02,
      volume: m.volume,
      volume24h: m.volume24h,
      liquidity: m.liquidity,
      openInterest: m.openInterest,
      strikeDate: new Date(m.endDate).getTime() / 1000,
      tokens: m.tokens,
      url: m.url,
      // Original market object for compatibility
      _demo: true,
      _category: m.category,
    }));

    return NextResponse.json({
      success: true,
      count: events.length,
      events,
      meta: {
        source: 'demo',
        mode: 'demo',
        network: 'devnet',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Demo Markets API] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch demo markets',
    }, { status: 500 });
  }
}
