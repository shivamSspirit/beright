/**
 * Autonomous Trader Cron Endpoint
 *
 * This endpoint is called by Vercel Cron to run automated trading scans.
 * It scans markets, generates signals, and executes paper trades automatically.
 *
 * Schedule: Every 5 minutes (star/5 * * * *)
 *
 * To test locally: curl http://localhost:3000/api/cron/trader
 */

import { NextResponse } from 'next/server';
import { getKalshiMarkets, isKalshiDemo } from '../../../../lib/kalshi';
import { getStrategyFramework } from '../../../../services/strategyFramework';
import type { MarketContext } from '../../../../services/strategyFramework';
import { getPaperTradingEngine } from '../../../../services/paperTradingEngine';
import type { StrategySignal } from '../../../../types/trading';

// Configuration for serverless execution
const CONFIG = {
  marketsPerScan: 50,          // Limit for serverless timeout
  autoExecute: true,
  maxConcurrentPositions: 10,
  minConfidence: 45,           // Min signal confidence (0-100)
  minEdge: 0.015,              // 1.5% minimum edge
  defaultPositionSizeUsd: 25,
  enableKalshi: true,
  enablePolymarket: true,
};

// Polymarket fetcher
async function fetchPolymarkets(limit: number = 50): Promise<any[]> {
  try {
    const response = await fetch(
      `https://gamma-api.polymarket.com/markets?closed=false&limit=${limit}`,
      { headers: { Accept: 'application/json' }, next: { revalidate: 0 } }
    );
    if (!response.ok) return [];
    const data: any = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Fetch all markets from enabled platforms
async function fetchAllMarkets(): Promise<MarketContext[]> {
  const contexts: MarketContext[] = [];

  // Fetch Kalshi
  if (CONFIG.enableKalshi) {
    try {
      const kalshiMarkets = await getKalshiMarkets(CONFIG.marketsPerScan);
      for (const m of kalshiMarkets) {
        const yesPrice = (m.yes_bid || m.last_price || 50) / 100;
        if (yesPrice > 0.05 && yesPrice < 0.95) {
          contexts.push({
            market: m as any,
            platform: 'kalshi',
            marketId: m.ticker,
            ticker: m.ticker,
            title: m.title || m.ticker,
            category: 'general',
            currentPrice: yesPrice,
            volume: m.volume || 0,
            daysToExpiry: m.expiration_time
              ? Math.max(1, (new Date(m.expiration_time).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : 30,
            newsRecency: 60,
          });
        }
      }
    } catch (e: any) {
      console.warn('[Cron/Trader] Kalshi fetch error:', e?.message);
    }
  }

  // Fetch Polymarket
  if (CONFIG.enablePolymarket) {
    try {
      const polyMarkets = await fetchPolymarkets(CONFIG.marketsPerScan);
      for (const m of polyMarkets) {
        let yesPrice = 0.5;
        try {
          const prices = JSON.parse(m.outcomePrices || '[]');
          yesPrice = parseFloat(prices[0]) || 0.5;
        } catch {}

        if (yesPrice > 0.05 && yesPrice < 0.95) {
          contexts.push({
            market: m as any,
            platform: 'polymarket',
            marketId: m.conditionId || m.id,
            ticker: (m.slug || m.id || 'POLY').substring(0, 25),
            title: m.question || m.title || 'Unknown',
            category: 'general',
            currentPrice: yesPrice,
            volume: m.volumeNum || m.volume || 0,
            daysToExpiry: m.endDate
              ? Math.max(1, (new Date(m.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : 30,
            newsRecency: 60,
          });
        }
      }
    } catch (e: any) {
      console.warn('[Cron/Trader] Polymarket fetch error:', e?.message);
    }
  }

  return contexts;
}

// Validate signal meets thresholds
function isSignalValid(signal: StrategySignal, positions: any[]): boolean {
  if (signal.confidence < CONFIG.minConfidence) return false;
  if (signal.edge < CONFIG.minEdge) return false;

  const hasPosition = positions.some(p => p.marketTicker === signal.marketTicker);
  if (hasPosition) return false;

  if (positions.length >= CONFIG.maxConcurrentPositions) return false;

  return true;
}

// Execute signals
async function executeSignals(
  signals: StrategySignal[],
  engine: ReturnType<typeof getPaperTradingEngine>
): Promise<{ executed: number; trades: any[] }> {
  const positions = engine.getPositions();
  const availableSlots = CONFIG.maxConcurrentPositions - positions.length;
  const toExecute = signals.slice(0, availableSlots);
  const trades: any[] = [];

  for (const signal of toExecute) {
    try {
      const portfolioValue = engine.getPortfolio().totalValue;
      const kellyFraction = (signal.edge * signal.confidence / 100) / (1 - signal.confidence / 100);
      const kellySize = Math.min(kellyFraction, 0.1) * portfolioValue;
      const positionSize = Math.min(kellySize, CONFIG.defaultPositionSizeUsd);

      const price = signal.currentPrice + (signal.direction === 'YES' ? 0.005 : -0.005);
      const quantity = Math.floor(positionSize / price);

      if (quantity < 1) continue;

      const result = await engine.executeTrade({
        userId: 'cron-trader',
        mode: 'paper',
        platform: signal.platform,
        marketId: signal.marketId,
        marketTicker: signal.marketTicker,
        marketTitle: signal.marketTitle,
        direction: signal.direction,
        quantity,
        entryPrice: price,
        strategy: signal.strategyType,
        signalId: signal.id,
        signalConfidence: signal.confidence,
      });

      if (result.success && result.trade) {
        trades.push({
          direction: signal.direction,
          ticker: signal.marketTicker,
          quantity,
          price,
          strategy: signal.strategyType,
          confidence: signal.confidence,
        });
        console.log(`[Cron/Trader] TRADE: ${signal.direction} ${quantity} ${signal.marketTicker} @ $${price.toFixed(3)}`);
      }
    } catch (err: any) {
      console.error(`[Cron/Trader] Trade error: ${err?.message}`);
    }
  }

  return { executed: trades.length, trades };
}

// Verify the request is from Vercel Cron (in production)
function verifyCronRequest(request: Request): boolean {
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }
  return false;
}

export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    console.log('[Cron/Trader] Starting autonomous trading scan...');
    console.log(`[Cron/Trader] Kalshi Demo Mode: ${isKalshiDemo()}`);

    // Initialize
    const framework = getStrategyFramework();
    const engine = getPaperTradingEngine('cron-trader');
    await engine.start();

    // Fetch markets
    const markets = await fetchAllMarkets();
    console.log(`[Cron/Trader] Fetched ${markets.length} markets`);

    // Evaluate signals
    const signals: StrategySignal[] = [];
    const positions = engine.getPositions();

    for (const market of markets) {
      try {
        const signal = await framework.getBestSignal(market);
        if (signal && isSignalValid(signal, positions)) {
          signals.push(signal);
        }
      } catch {}
    }

    // Sort by confidence
    signals.sort((a, b) => b.confidence - a.confidence);
    console.log(`[Cron/Trader] Found ${signals.length} valid signals`);

    // Execute if enabled
    let executionResult = { executed: 0, trades: [] as any[] };
    if (CONFIG.autoExecute && signals.length > 0) {
      executionResult = await executeSignals(signals, engine);
    }

    // Get portfolio state
    const portfolio = engine.getPortfolio();
    const duration = Date.now() - startTime;

    console.log(`[Cron/Trader] Completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      demoMode: isKalshiDemo(),
      scan: {
        marketsScanned: markets.length,
        kalshiMarkets: markets.filter(m => m.platform === 'kalshi').length,
        polymarketMarkets: markets.filter(m => m.platform === 'polymarket').length,
        signalsFound: signals.length,
        topSignals: signals.slice(0, 5).map(s => ({
          ticker: s.marketTicker,
          direction: s.direction,
          confidence: s.confidence,
          edge: (s.edge * 100).toFixed(2) + '%',
          strategy: s.strategyType,
        })),
      },
      execution: executionResult,
      portfolio: {
        totalValue: portfolio.totalValue.toFixed(2),
        cash: portfolio.cashBalance.toFixed(2),
        positionCount: portfolio.positionCount,
        totalPnl: portfolio.totalPnl.toFixed(2),
        totalPnlPercent: ((portfolio.totalPnlPercent || 0) * 100).toFixed(2) + '%',
      },
    });

  } catch (error) {
    console.error('[Cron/Trader] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Support POST for manual triggers
export async function POST(request: Request) {
  return GET(request);
}
