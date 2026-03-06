/**
 * Portfolio API v2
 *
 * Portfolio management and performance tracking.
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPortfolioManager } from '../../../../lib/portfolio';
import { getExecutionEngine } from '../../../../lib/execution';

/**
 * GET /api/v2/portfolio
 *
 * Get comprehensive portfolio overview.
 * Returns sensible defaults if backend services aren't fully connected.
 */
export async function GET() {
  // Default response structure
  const defaultResponse = {
    success: true,
    data: {
      overview: {
        portfolioValue: 0,
        totalBalance: 0,
        unrealizedPnL: 0,
        realizedPnL: 0,
        openPositions: 0,
      },
      balances: {
        total: 0,
        available: 0,
        locked: 0,
        byPlatform: {},
      },
      positions: [],
      today: null,
      risk: {
        tradingAllowed: true,
        exposure: { totalAtRisk: 0, utilizationPct: 0, byPlatform: {} },
        dailyLoss: 0,
        remainingLossAllowance: 1000,
      },
      alerts: {
        unacknowledged: 0,
        critical: 0,
        recent: [],
      },
      performance: {
        totalReturn: 0,
        totalReturnPct: 0,
        sharpeRatio: 0,
        winRate: 0,
        profitFactor: 0,
        maxDrawdownPct: 0,
      },
      recentPnL: [],
    },
    meta: {
      timestamp: new Date().toISOString(),
      initialized: false,
    },
  };

  try {
    const portfolio = getPortfolioManager();
    const engine = getExecutionEngine();

    // Try to initialize, but don't fail if it doesn't work
    try {
      await portfolio.initialize();
      defaultResponse.meta.initialized = true;
    } catch (initError) {
      console.warn('[API v2/portfolio] Portfolio not fully initialized:', initError);
      // Continue with defaults
    }

    // Try to get data, falling back to defaults for each piece
    let pnlSummary: any, riskStatus: any, metrics: any, dailyPnL: any, positions: any[] = [], balance: any;

    try {
      [pnlSummary, riskStatus, metrics, dailyPnL] = await Promise.all([
        portfolio.getPnLSummary().catch(() => ({ current: null, today: null })),
        portfolio.getRiskStatus().catch(() => ({
          tradingAllowed: true,
          exposure: { totalAtRisk: 0, utilizationPct: 0, byPlatform: {} },
          dailyStatus: { currentLoss: 0, remainingLossAllowance: 1000, tradingAllowed: true },
          alerts: { unacknowledged: 0, critical: 0 },
          config: {},
        })),
        Promise.resolve(portfolio.getPerformanceMetrics()).catch(() => ({
          totalReturn: 0, totalReturnPct: 0, sharpeRatio: 0, winRate: 0, profitFactor: 0, maxDrawdownPct: 0,
        })),
        Promise.resolve(portfolio.getDailyPnL(7)).catch(() => []),
      ]);
    } catch (e) {
      console.warn('[API v2/portfolio] Error fetching portfolio data:', e);
    }

    try {
      [positions, balance] = await Promise.all([
        engine.getOpenPositions().catch(() => []),
        engine.getTotalBalance().catch(() => ({ total: 0, available: 0, locked: 0, byPlatform: {} })),
      ]);
    } catch (e) {
      console.warn('[API v2/portfolio] Error fetching engine data:', e);
      positions = [];
      balance = { total: 0, available: 0, locked: 0, byPlatform: {} };
    }

    // Get alerts
    let alerts: any[] = [];
    try {
      alerts = portfolio.getAlerts({ unacknowledgedOnly: true, limit: 5 }) || [];
    } catch (e) {
      console.warn('[API v2/portfolio] Error fetching alerts:', e);
    }

    // Format positions
    const formattedPositions = (positions || []).map((pos: any) => {
      const currentValue = pos.side === 'YES'
        ? pos.size * pos.currentPrice
        : pos.size * (1 - pos.currentPrice);

      return {
        id: pos.id,
        marketId: pos.marketId,
        platform: pos.platform,
        question: pos.marketQuestion,
        side: pos.side,
        size: pos.size,
        avgPrice: pos.avgEntryPrice,
        currentPrice: pos.currentPrice,
        currentValue,
        costBasis: pos.costBasis,
        unrealizedPnL: pos.unrealizedPnL,
        unrealizedPnLPct: pos.unrealizedPnLPct,
        openedAt: pos.openedAt?.toISOString?.() || pos.openedAt,
        closeDate: pos.marketCloseDate?.toISOString?.() || pos.marketCloseDate,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          portfolioValue: pnlSummary?.current?.portfolioValue || 0,
          totalBalance: pnlSummary?.current?.totalBalance || 0,
          unrealizedPnL: pnlSummary?.current?.unrealizedPnL || 0,
          realizedPnL: pnlSummary?.current?.realizedPnL || 0,
          openPositions: pnlSummary?.current?.openPositions || 0,
        },

        balances: {
          total: balance?.total || 0,
          available: balance?.available || 0,
          locked: balance?.locked || 0,
          byPlatform: balance?.byPlatform || {},
        },

        positions: formattedPositions,

        today: pnlSummary?.today ? {
          pnl: pnlSummary.today.pnl,
          pnlPct: pnlSummary.today.pnlPct,
          tradesExecuted: pnlSummary.today.tradesExecuted,
          winRate: pnlSummary.today.winRate,
        } : null,

        risk: {
          tradingAllowed: riskStatus?.tradingAllowed ?? true,
          exposure: riskStatus?.exposure || { totalAtRisk: 0, utilizationPct: 0, byPlatform: {} },
          dailyLoss: riskStatus?.dailyStatus?.currentLoss || 0,
          remainingLossAllowance: riskStatus?.dailyStatus?.remainingLossAllowance || 1000,
        },

        alerts: {
          unacknowledged: riskStatus?.alerts?.unacknowledged || 0,
          critical: riskStatus?.alerts?.critical || 0,
          recent: alerts.map((a: any) => ({
            id: a.id,
            type: a.type,
            priority: a.priority,
            title: a.title,
            message: a.message,
            createdAt: a.createdAt?.toISOString?.() || new Date().toISOString(),
          })),
        },

        performance: {
          totalReturn: metrics?.totalReturn || 0,
          totalReturnPct: metrics?.totalReturnPct || 0,
          sharpeRatio: metrics?.sharpeRatio || 0,
          winRate: metrics?.winRate || 0,
          profitFactor: metrics?.profitFactor || 0,
          maxDrawdownPct: metrics?.maxDrawdownPct || 0,
        },

        recentPnL: (dailyPnL || []).slice(0, 7).map((d: any) => ({
          date: d.date,
          pnl: d.pnl,
          pnlPct: d.pnlPct,
        })),
      },
      meta: {
        timestamp: new Date().toISOString(),
        initialized: defaultResponse.meta.initialized,
      },
    });
  } catch (error) {
    console.error('[API v2/portfolio] Error:', error);
    // Return defaults instead of error
    return NextResponse.json(defaultResponse);
  }
}

/**
 * POST /api/v2/portfolio
 *
 * Portfolio actions (acknowledge alerts, start/end of day routines).
 *
 * Body:
 * - action: 'acknowledge_alert' | 'start_of_day' | 'end_of_day'
 * - alertId: string (for acknowledge_alert)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, alertId } = body;

    const portfolioManager = getPortfolioManager();

    switch (action) {
      case 'acknowledge_alert': {
        if (!alertId) {
          return NextResponse.json(
            { success: false, error: 'alertId is required' },
            { status: 400 }
          );
        }

        const acknowledged = portfolioManager.acknowledgeAlert(alertId);

        if (!acknowledged) {
          return NextResponse.json(
            { success: false, error: 'Alert not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          data: {
            alertId,
            acknowledged: true,
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }

      case 'start_of_day': {
        await portfolioManager.startOfDay();

        return NextResponse.json({
          success: true,
          data: {
            action: 'start_of_day',
            completed: true,
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }

      case 'end_of_day': {
        const result = await portfolioManager.endOfDay();

        return NextResponse.json({
          success: true,
          data: {
            action: 'end_of_day',
            dailyPnL: result.dailyPnL,
            metrics: {
              totalReturn: result.metrics.totalReturn,
              totalReturnPct: result.metrics.totalReturnPct,
              winRate: result.metrics.winRate,
              sharpeRatio: result.metrics.sharpeRatio,
            },
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API v2/portfolio] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
