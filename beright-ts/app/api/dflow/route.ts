/**
 * DFlow API Route
 * Tokenized prediction markets on Solana via DFlow
 *
 * Endpoints for market data, search, trading, and positions.
 * All market data is FREE (no API key required for dev endpoints).
 * Trading requires user wallet signing (no backend auth needed).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getDFlowClient,
  getDFlowHotMarkets,
  searchDFlowMarkets,
  getDFlowMarket,
  getDFlowMarketByMint,
  getDFlowOrderbook,
  getDFlowTrades,
  getDFlowCategories,
  getDFlowOrderTransaction,
  checkDFlowOrderStatus,
  filterDFlowOutcomeMints,
  batchGetDFlowMarkets,
  USDC_MINT,
  SOL_MINT,
  DFlowEvent,
  DFlowMarket,
} from '../../../lib/dflow';

/**
 * Helper to extract token addresses from market
 */
function getMarketTokens(market: DFlowMarket) {
  const usdcAccount = market.accounts?.[USDC_MINT];
  return {
    yesMint: usdcAccount?.yesMint || null,
    noMint: usdcAccount?.noMint || null,
    marketLedger: usdcAccount?.marketLedger || null,
    isInitialized: usdcAccount?.isInitialized || false,
    redemptionStatus: usdcAccount?.redemptionStatus || 'closed',
  };
}

/**
 * Helper to format event for API response
 */
function formatEvent(event: DFlowEvent) {
  const primaryMarket = event.markets?.[0];
  const yesBid = parseFloat(primaryMarket?.yesBid || '0');
  const yesAsk = parseFloat(primaryMarket?.yesAsk || '0');
  const noBid = parseFloat(primaryMarket?.noBid || '0');
  const noAsk = parseFloat(primaryMarket?.noAsk || '0');
  const yesPrice = yesBid > 0 && yesAsk > 0 ? (yesBid + yesAsk) / 2 : yesBid || yesAsk;

  const tokens = primaryMarket ? getMarketTokens(primaryMarket) : null;

  return {
    ticker: event.ticker,
    seriesTicker: event.seriesTicker,
    title: event.title,
    subtitle: event.subtitle,
    imageUrl: event.imageUrl,
    volume: event.volume,
    volume24h: event.volume24h,
    liquidity: event.liquidity,
    openInterest: event.openInterest,
    strikeDate: event.strikeDate,
    strikePeriod: event.strikePeriod,
    settlementSources: event.settlementSources,

    // Primary market data
    marketTicker: primaryMarket?.ticker,
    status: primaryMarket?.status,
    yesPrice,
    noPrice: 1 - yesPrice,
    yesPct: yesPrice * 100,
    noPct: (1 - yesPrice) * 100,
    yesBid,
    yesAsk,
    noBid,
    noAsk,
    spread: yesAsk - yesBid,

    // Token addresses for on-chain trading
    tokens,

    // All markets in event
    markets: event.markets?.map(m => ({
      ticker: m.ticker,
      title: m.title,
      status: m.status,
      result: m.result,
      yesBid: parseFloat(m.yesBid || '0'),
      yesAsk: parseFloat(m.yesAsk || '0'),
      noBid: parseFloat(m.noBid || '0'),
      noAsk: parseFloat(m.noAsk || '0'),
      volume: m.volume,
      openInterest: m.openInterest,
      closeTime: m.closeTime,
      expirationTime: m.expirationTime,
      tokens: getMarketTokens(m),
    })),

    // External link
    url: `https://kalshi.com/markets/${event.ticker}`,
  };
}

/**
 * GET /api/dflow - Get DFlow market data
 *
 * Query params:
 *   - action: 'hot' | 'search' | 'market' | 'orderbook' | 'trades' | 'categories' | 'positions'
 *   - query: search query (for action=search)
 *   - ticker: market ticker (for action=market, orderbook, trades)
 *   - mint: token mint address (for action=market, positions)
 *   - mints: comma-separated mints (for action=positions)
 *   - limit: number of results (default 20)
 *   - sort: volume | volume24h | liquidity | openInterest | startDate
 *   - order: asc | desc
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'hot';
    const query = searchParams.get('query') || searchParams.get('q');
    const ticker = searchParams.get('ticker');
    const mint = searchParams.get('mint');
    const mints = searchParams.get('mints')?.split(',').filter(Boolean);
    const limit = parseInt(searchParams.get('limit') || '20');
    const sort = searchParams.get('sort') as any;
    const order = searchParams.get('order') as any;

    const client = getDFlowClient();

    switch (action) {
      case 'hot': {
        // Hot markets by 24h volume
        const events = await getDFlowHotMarkets(limit);
        return NextResponse.json({
          success: true,
          count: events.length,
          events: events.map(formatEvent),
        });
      }

      case 'search': {
        if (!query) {
          return NextResponse.json({ error: 'query parameter required' }, { status: 400 });
        }
        const events = await searchDFlowMarkets(query, limit);
        return NextResponse.json({
          success: true,
          query,
          count: events.length,
          events: events.map(formatEvent),
        });
      }

      case 'market': {
        // Get single market by ticker or mint
        let market: DFlowMarket | null = null;

        if (ticker) {
          market = await getDFlowMarket(ticker);
        } else if (mint) {
          market = await getDFlowMarketByMint(mint);
        } else {
          return NextResponse.json(
            { error: 'ticker or mint parameter required' },
            { status: 400 }
          );
        }

        if (!market) {
          return NextResponse.json({ error: 'Market not found' }, { status: 404 });
        }

        const yesBid = parseFloat(market.yesBid || '0');
        const yesAsk = parseFloat(market.yesAsk || '0');
        const noBid = parseFloat(market.noBid || '0');
        const noAsk = parseFloat(market.noAsk || '0');
        const yesPrice = yesBid > 0 && yesAsk > 0 ? (yesBid + yesAsk) / 2 : yesBid || yesAsk;

        return NextResponse.json({
          success: true,
          market: {
            ticker: market.ticker,
            eventTicker: market.eventTicker,
            title: market.title,
            subtitle: market.subtitle,
            marketType: market.marketType,
            status: market.status,
            result: market.result,
            yesPrice,
            noPrice: 1 - yesPrice,
            yesPct: yesPrice * 100,
            noPct: (1 - yesPrice) * 100,
            yesBid,
            yesAsk,
            noBid,
            noAsk,
            spread: yesAsk - yesBid,
            volume: market.volume,
            openInterest: market.openInterest,
            openTime: market.openTime,
            closeTime: market.closeTime,
            expirationTime: market.expirationTime,
            canCloseEarly: market.canCloseEarly,
            earlyCloseCondition: market.earlyCloseCondition,
            rulesPrimary: market.rulesPrimary,
            rulesSecondary: market.rulesSecondary,
            tokens: getMarketTokens(market),
            url: `https://kalshi.com/markets/${market.ticker}`,
          },
        });
      }

      case 'orderbook': {
        if (!ticker) {
          return NextResponse.json({ error: 'ticker parameter required' }, { status: 400 });
        }
        const orderbook = await getDFlowOrderbook(ticker);
        if (!orderbook) {
          return NextResponse.json({ error: 'Orderbook not found' }, { status: 404 });
        }
        return NextResponse.json({
          success: true,
          ticker,
          orderbook,
        });
      }

      case 'trades': {
        if (!ticker) {
          return NextResponse.json({ error: 'ticker parameter required' }, { status: 400 });
        }
        const trades = await getDFlowTrades(ticker, limit);
        return NextResponse.json({
          success: true,
          ticker,
          count: trades.length,
          trades: trades.map(t => ({
            tradeId: t.tradeId,
            price: t.price / 10000,  // Convert to 0-1 scale
            yesPriceDollars: t.yesPriceDollars,
            noPriceDollars: t.noPriceDollars,
            count: t.count,
            takerSide: t.takerSide,
            timestamp: t.createdTime,
            time: new Date(t.createdTime * 1000).toISOString(),
          })),
        });
      }

      case 'categories': {
        const categories = await getDFlowCategories();
        return NextResponse.json({
          success: true,
          categories,
        });
      }

      case 'positions': {
        // Filter mints to find outcome tokens, then get market details
        if (!mints || mints.length === 0) {
          return NextResponse.json(
            { error: 'mints parameter required (comma-separated)' },
            { status: 400 }
          );
        }

        const outcomeMints = await filterDFlowOutcomeMints(mints);
        if (outcomeMints.length === 0) {
          return NextResponse.json({
            success: true,
            positions: [],
            message: 'No outcome tokens found in provided mints',
          });
        }

        const markets = await batchGetDFlowMarkets(outcomeMints);

        // Build position map
        const positions = outcomeMints.map(mintAddr => {
          const market = markets.find(m => {
            const tokens = getMarketTokens(m);
            return tokens.yesMint === mintAddr || tokens.noMint === mintAddr;
          });

          if (!market) {
            return { mint: mintAddr, market: null, side: 'unknown' };
          }

          const tokens = getMarketTokens(market);
          const side = tokens.yesMint === mintAddr ? 'YES' : 'NO';
          const yesBid = parseFloat(market.yesBid || '0');
          const yesAsk = parseFloat(market.yesAsk || '0');
          const midPrice = yesBid > 0 && yesAsk > 0 ? (yesBid + yesAsk) / 2 : yesBid || yesAsk;

          return {
            mint: mintAddr,
            side,
            ticker: market.ticker,
            eventTicker: market.eventTicker,
            title: market.title,
            status: market.status,
            result: market.result,
            currentPrice: side === 'YES' ? midPrice : 1 - midPrice,
            tokens,
          };
        });

        return NextResponse.json({
          success: true,
          count: positions.length,
          positions,
        });
      }

      case 'events': {
        // List events with optional filters
        const result = await client.getEvents({
          limit,
          withNestedMarkets: true,
          status: searchParams.get('status') as any || 'active',
          sort: sort || 'volume24h',
          order: order || 'desc',
        });

        return NextResponse.json({
          success: true,
          cursor: result.cursor,
          count: result.events.length,
          events: result.events.map(formatEvent),
        });
      }

      case 'series': {
        // List series/event templates
        const category = searchParams.get('category');
        const tags = searchParams.get('tags')?.split(',').filter(Boolean);
        const result = await client.getSeries({ category: category || undefined, tags, limit });

        return NextResponse.json({
          success: true,
          cursor: result.cursor,
          count: result.series.length,
          series: result.series,
        });
      }

      default:
        return NextResponse.json(
          {
            error: 'Invalid action',
            validActions: ['hot', 'search', 'market', 'orderbook', 'trades', 'categories', 'positions', 'events', 'series'],
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('DFlow GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'DFlow API error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dflow - Trading operations
 *
 * Body:
 *   - action: 'order' | 'status' | 'filter-mints'
 *
 *   For action='order':
 *     - inputMint: source token (SOL, USDC, etc.)
 *     - outputMint: destination token (outcome token or settlement mint)
 *     - amount: amount in atomic units
 *     - userPublicKey: wallet address
 *     - slippageBps: max slippage (optional, default 50)
 *
 *   For action='status':
 *     - signature: transaction signature to check
 *
 *   For action='filter-mints':
 *     - addresses: array of mint addresses to filter
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'order': {
        const { inputMint, outputMint, amount, userPublicKey, slippageBps } = body;

        if (!inputMint || !outputMint || !amount || !userPublicKey) {
          return NextResponse.json(
            { error: 'Missing required fields: inputMint, outputMint, amount, userPublicKey' },
            { status: 400 }
          );
        }

        const order = await getDFlowOrderTransaction({
          inputMint,
          outputMint,
          amount: parseInt(amount),
          userPublicKey,
          slippageBps: slippageBps || 50,
        });

        return NextResponse.json({
          success: true,
          order: {
            inputMint: order.inputMint,
            outputMint: order.outputMint,
            inAmount: order.inAmount,
            outAmount: order.outAmount,
            slippageBps: order.slippageBps,
            priceImpactPct: order.priceImpactPct,
            executionMode: order.executionMode,
            transaction: order.transaction,  // Base64 encoded, sign and submit
            routePlan: order.routePlan,
            platformFee: order.platformFee,
          },
        });
      }

      case 'status': {
        const { signature } = body;

        if (!signature) {
          return NextResponse.json({ error: 'signature required' }, { status: 400 });
        }

        const status = await checkDFlowOrderStatus(signature);

        return NextResponse.json({
          success: true,
          status: {
            status: status.status,
            inAmount: status.inAmount,
            outAmount: status.outAmount,
            fills: status.fills,
            reverts: status.reverts,
          },
        });
      }

      case 'filter-mints': {
        const { addresses } = body;

        if (!addresses || !Array.isArray(addresses)) {
          return NextResponse.json(
            { error: 'addresses array required' },
            { status: 400 }
          );
        }

        const outcomeMints = await filterDFlowOutcomeMints(addresses);

        return NextResponse.json({
          success: true,
          total: addresses.length,
          outcomeTokens: outcomeMints.length,
          outcomeMints,
        });
      }

      case 'batch-markets': {
        const { mints } = body;

        if (!mints || !Array.isArray(mints)) {
          return NextResponse.json(
            { error: 'mints array required' },
            { status: 400 }
          );
        }

        const markets = await batchGetDFlowMarkets(mints);

        return NextResponse.json({
          success: true,
          count: markets.length,
          markets: markets.map(m => ({
            ticker: m.ticker,
            title: m.title,
            status: m.status,
            result: m.result,
            tokens: getMarketTokens(m),
          })),
        });
      }

      default:
        return NextResponse.json(
          {
            error: 'Invalid action',
            validActions: ['order', 'status', 'filter-mints', 'batch-markets'],
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('DFlow POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'DFlow API error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
