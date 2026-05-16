/**
 * Price History API - Proxies DFlow candlesticks endpoint
 * GET /api/markets/candlesticks?ticker=XXX&resolution=1h
 */

import { NextRequest, NextResponse } from 'next/server';

const DFLOW_API = 'https://dev-prediction-markets-api.dflow.net';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');
  const resolution = searchParams.get('resolution') || '1h';

  if (!ticker) {
    return NextResponse.json({ error: 'ticker is required' }, { status: 400 });
  }

  try {
    // Get last 24 hours of data
    const now = Math.floor(Date.now() / 1000);
    const from = now - (24 * 60 * 60); // 24 hours ago

    const url = `${DFLOW_API}/api/v1/market/${ticker}/candlesticks?resolution=${resolution}&from=${from}&to=${now}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.DFLOW_API_KEY ? { 'x-api-key': process.env.DFLOW_API_KEY } : {}),
      },
      next: { revalidate: 60 }, // Cache for 1 minute
    });

    if (!response.ok) {
      // Return empty array on error (chart will use fallback)
      return NextResponse.json({ data: [], error: `DFlow API ${response.status}` });
    }

    const data = await response.json();

    // Transform to simple price points for sparkline
    // Use 'close' price as the primary price point
    const priceHistory = Array.isArray(data)
      ? data.map((candle: { time: number; close: number }) => ({
          time: candle.time,
          price: candle.close * 100, // Convert to percentage (0-100)
        }))
      : [];

    return NextResponse.json({
      success: true,
      data: priceHistory,
      ticker,
      resolution,
    });
  } catch (error) {
    console.error('[Candlesticks API] Error:', error);
    return NextResponse.json({
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Failed to fetch price history'
    });
  }
}
