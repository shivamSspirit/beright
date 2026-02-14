/**
 * Kalshi API Route
 * Endpoints for Kalshi trading operations
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getKalshiClient,
  getKalshiBalance,
  getKalshiPositions,
  getKalshiMarkets,
  getKalshiMarket,
  placeKalshiOrder,
} from '../../../lib/kalshi';

/**
 * GET /api/kalshi - Get Kalshi data
 * Query params:
 *   - action: 'balance' | 'positions' | 'markets' | 'market' | 'portfolio'
 *   - ticker: market ticker (for action=market)
 *   - limit: number of results (for action=markets)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'markets';
    const ticker = searchParams.get('ticker');
    const limit = parseInt(searchParams.get('limit') || '20');

    const client = getKalshiClient();
    const isConnected = !!client;

    switch (action) {
      case 'balance': {
        if (!client) {
          return NextResponse.json({
            connected: false,
            error: 'Kalshi API not configured',
            balance: null,
          });
        }
        const balance = await getKalshiBalance();
        return NextResponse.json({
          connected: true,
          balance: balance ? {
            total: balance.balance / 100,
            available: (balance.available_balance ?? balance.balance) / 100,
            payout: (balance.payout_balance ?? 0) / 100,
            portfolioValue: (balance.portfolio_value ?? 0) / 100,
          } : null,
        });
      }

      case 'positions': {
        if (!client) {
          return NextResponse.json({
            connected: false,
            error: 'Kalshi API not configured',
            positions: [],
          });
        }
        const positions = await getKalshiPositions();
        return NextResponse.json({
          connected: true,
          positions: positions.map(p => ({
            ticker: p.market_ticker,
            contracts: p.position,
            averagePrice: p.average_price / 100,
            totalTraded: p.total_traded,
            restingOrders: p.resting_order_count,
          })),
        });
      }

      case 'portfolio': {
        if (!client) {
          return NextResponse.json({
            connected: false,
            error: 'Kalshi API not configured',
          });
        }
        const [balance, positions] = await Promise.all([
          getKalshiBalance(),
          getKalshiPositions(),
        ]);

        let positionsValue = 0;
        const positionDetails = positions.map(p => {
          const value = p.position * (p.average_price / 100);
          positionsValue += value;
          return {
            ticker: p.market_ticker,
            contracts: p.position,
            averagePrice: p.average_price / 100,
            value,
          };
        });

        return NextResponse.json({
          connected: true,
          portfolio: {
            totalBalance: balance ? balance.balance / 100 : 0,
            availableCash: balance ? (balance.available_balance ?? balance.balance) / 100 : 0,
            portfolioValue: balance ? (balance.portfolio_value ?? 0) / 100 : 0,
            positionsValue,
            positions: positionDetails,
          },
        });
      }

      case 'market': {
        if (!ticker) {
          return NextResponse.json({ error: 'ticker parameter required' }, { status: 400 });
        }
        const market = await getKalshiMarket(ticker);
        if (!market) {
          return NextResponse.json({ error: 'Market not found' }, { status: 404 });
        }
        return NextResponse.json({
          connected: isConnected,
          market: {
            ticker: market.ticker,
            eventTicker: market.event_ticker,
            title: market.title,
            subtitle: market.subtitle,
            status: market.status,
            yesBid: market.yes_bid / 100,
            yesAsk: market.yes_ask / 100,
            noBid: market.no_bid / 100,
            noAsk: market.no_ask / 100,
            lastPrice: market.last_price / 100,
            volume: market.volume,
            openInterest: market.open_interest,
            closeTime: market.close_time,
          },
        });
      }

      case 'markets':
      default: {
        const markets = await getKalshiMarkets(limit);
        return NextResponse.json({
          connected: isConnected,
          markets: markets.map(m => ({
            ticker: m.ticker,
            eventTicker: m.event_ticker,
            title: m.title,
            subtitle: m.subtitle,
            status: m.status,
            yesPct: m.yes_bid,
            noPct: m.no_bid,
            volume: m.volume,
            closeTime: m.close_time,
            url: `https://kalshi.com/markets/${(m.event_ticker || m.ticker).replace(/-\d{1,2}[A-Z]{3}\d{2}$/, '').replace(/-\d+$/, '').toLowerCase()}`,
          })),
        });
      }
    }
  } catch (error) {
    console.error('Kalshi GET error:', error);
    return NextResponse.json(
      {
        connected: false,
        error: 'Kalshi API error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/kalshi - Place orders
 * Body:
 *   - action: 'buy' | 'sell'
 *   - ticker: market ticker
 *   - side: 'yes' | 'no'
 *   - contracts: number of contracts
 *   - price: price in cents (optional, for limit orders)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ticker, side, contracts, price } = body;

    if (!action || !ticker || !side || !contracts) {
      return NextResponse.json(
        { error: 'Missing required fields: action, ticker, side, contracts' },
        { status: 400 }
      );
    }

    if (!['buy', 'sell'].includes(action)) {
      return NextResponse.json({ error: 'action must be "buy" or "sell"' }, { status: 400 });
    }

    if (!['yes', 'no'].includes(side)) {
      return NextResponse.json({ error: 'side must be "yes" or "no"' }, { status: 400 });
    }

    const client = getKalshiClient();
    if (!client) {
      return NextResponse.json(
        { error: 'Kalshi API not configured. Set KALSHI_API_KEY and KALSHI_API_SECRET in .env' },
        { status: 503 }
      );
    }

    const order = await placeKalshiOrder(ticker, side, action, contracts, price);

    if (!order) {
      return NextResponse.json({ error: 'Failed to place order' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      order: {
        orderId: order.order_id,
        ticker: order.market_ticker,
        side: order.side,
        action: order.action,
        contracts: order.count,
        type: order.type,
        price: order.yes_price ? order.yes_price / 100 : null,
        status: order.status,
        createdAt: order.created_time,
      },
    });
  } catch (error) {
    console.error('Kalshi POST error:', error);
    return NextResponse.json(
      {
        error: 'Failed to place order',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
