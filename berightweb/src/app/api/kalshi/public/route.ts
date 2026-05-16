/**
 * Kalshi Public API Route
 * Fetches market data from Kalshi's public API (no auth required)
 *
 * GET /api/kalshi/public?action=hot&limit=20
 * GET /api/kalshi/public?action=search&q=bitcoin&limit=20
 * GET /api/kalshi/public?action=market&ticker=KXBTC...
 */

import { NextRequest, NextResponse } from 'next/server';

const KALSHI_API = 'https://api.elections.kalshi.com/trade-api/v2';
const REQUEST_TIMEOUT = 10000;

interface KalshiApiMarket {
  ticker: string;
  event_ticker: string;
  series_ticker?: string;
  title: string;
  subtitle?: string;
  status: string;
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
  last_price?: number;
  volume?: number;
  volume_24h?: number;
  open_interest?: number;
  expiration_time?: string;
  created_time?: string;
  category?: string;
}

interface KalshiPublicMarket {
  ticker: string;
  eventTicker: string;
  seriesTicker: string;
  title: string;
  subtitle?: string;
  status: string;
  yesPrice: number;
  noPrice: number;
  yesPct: number;
  noPct: number;
  yesBid: number;
  yesAsk: number;
  noBid: number;
  noAsk: number;
  spread: number;
  volume: number;
  volume24h: number;
  openInterest: number;
  endDate: string | null;
  createdAt: string | null;
  category: string;
  url: string;
}

function transformMarket(m: KalshiApiMarket): KalshiPublicMarket {
  // Kalshi prices are in cents (0-100)
  const yesBid = (m.yes_bid || 0) / 100;
  const yesAsk = (m.yes_ask || 0) / 100;
  const noBid = (m.no_bid || 0) / 100;
  const noAsk = (m.no_ask || 0) / 100;

  // Mid price
  const yesPrice =
    yesBid > 0 && yesAsk > 0
      ? (yesBid + yesAsk) / 2
      : yesBid || yesAsk || (m.last_price || 50) / 100;
  const noPrice = 1 - yesPrice;

  return {
    ticker: m.ticker,
    eventTicker: m.event_ticker,
    seriesTicker: m.series_ticker || '',
    title: m.title || m.subtitle || '',
    subtitle: m.subtitle,
    status: m.status === 'open' ? 'active' : m.status,
    yesPrice,
    noPrice,
    yesPct: Math.round(yesPrice * 100),
    noPct: Math.round(noPrice * 100),
    yesBid: Math.round(yesBid * 100),
    yesAsk: Math.round(yesAsk * 100),
    noBid: Math.round(noBid * 100),
    noAsk: Math.round(noAsk * 100),
    spread: Math.round((yesAsk - yesBid) * 100),
    volume: m.volume || 0,
    volume24h: m.volume_24h || 0,
    openInterest: m.open_interest || 0,
    endDate: m.expiration_time || null,
    createdAt: m.created_time || null,
    category: m.category || 'other',
    url: `https://kalshi.com/markets/${m.ticker?.toLowerCase()}`,
  };
}

async function fetchKalshiMarkets(limit: number): Promise<KalshiPublicMarket[]> {
  const url = `${KALSHI_API}/markets?limit=${limit}&status=open`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Kalshi API error: ${response.status}`);
  }

  const data = (await response.json()) as { markets: KalshiApiMarket[] };
  return (data.markets || []).map(transformMarket);
}

async function searchKalshiMarkets(
  query: string,
  limit: number
): Promise<KalshiPublicMarket[]> {
  // Kalshi doesn't have a direct search endpoint, fetch and filter
  const url = `${KALSHI_API}/markets?limit=200&status=open`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Kalshi API error: ${response.status}`);
  }

  const data = (await response.json()) as { markets: KalshiApiMarket[] };
  const queryLower = query.toLowerCase();

  const filtered = (data.markets || []).filter((m) => {
    const title = (m.title || m.subtitle || '').toLowerCase();
    const ticker = (m.ticker || '').toLowerCase();
    return title.includes(queryLower) || ticker.includes(queryLower);
  });

  return filtered.slice(0, limit).map(transformMarket);
}

async function fetchKalshiMarket(ticker: string): Promise<KalshiPublicMarket | null> {
  const url = `${KALSHI_API}/markets/${ticker.toUpperCase()}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Kalshi API error: ${response.status}`);
  }

  const data = (await response.json()) as { market: KalshiApiMarket };
  return data.market ? transformMarket(data.market) : null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'hot';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    let result: {
      success: boolean;
      count?: number;
      markets?: KalshiPublicMarket[];
      market?: KalshiPublicMarket | null;
      query?: string;
      error?: string;
    };

    switch (action) {
      case 'hot': {
        const markets = await fetchKalshiMarkets(limit);
        // Sort by volume for "hot" markets
        markets.sort((a, b) => (b.volume24h || b.volume) - (a.volume24h || a.volume));
        result = { success: true, count: markets.length, markets };
        break;
      }

      case 'search': {
        const query = searchParams.get('q') || '';
        if (!query) {
          return NextResponse.json(
            { success: false, error: 'Query parameter required' },
            { status: 400 }
          );
        }
        const markets = await searchKalshiMarkets(query, limit);
        result = { success: true, query, count: markets.length, markets };
        break;
      }

      case 'market': {
        const ticker = searchParams.get('ticker');
        if (!ticker) {
          return NextResponse.json(
            { success: false, error: 'Ticker parameter required' },
            { status: 400 }
          );
        }
        const market = await fetchKalshiMarket(ticker);
        result = { success: true, market };
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Kalshi Public API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        markets: [],
      },
      { status: 500 }
    );
  }
}
