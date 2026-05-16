/**
 * Risk Management API v2
 *
 * Risk checking, limits, and configuration.
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPortfolioManager, getRiskManager, DEFAULT_RISK_CONFIG } from '../../../../lib/portfolio';
import { OrderRequest } from '../../../../lib/execution/types';

/**
 * GET /api/v2/risk
 *
 * Get current risk status and configuration.
 * Returns sensible defaults if backend services aren't fully connected.
 */
export async function GET() {
  // Default response
  const defaultResponse = {
    success: true,
    data: {
      status: {
        tradingAllowed: true,
        exposure: {
          current: 0,
          limit: DEFAULT_RISK_CONFIG.maxTotalExposure,
          utilizationPct: 0,
          byPlatform: {},
        },
        dailyStatus: {
          currentLoss: 0,
          remainingLossAllowance: DEFAULT_RISK_CONFIG.maxDailyLoss,
          tradingAllowed: true,
        },
        alerts: {
          unacknowledged: 0,
          critical: 0,
        },
      },
      config: DEFAULT_RISK_CONFIG,
      defaults: DEFAULT_RISK_CONFIG,
    },
    meta: {
      timestamp: new Date().toISOString(),
      initialized: false,
    },
  };

  try {
    const portfolio = getPortfolioManager();

    // Try to initialize, but don't fail if it doesn't work
    try {
      await portfolio.initialize();
      defaultResponse.meta.initialized = true;
    } catch (initError) {
      console.warn('[API v2/risk] Portfolio not fully initialized:', initError);
      // Continue with defaults
    }

    let riskStatus;
    try {
      riskStatus = await portfolio.getRiskStatus();
    } catch (e) {
      console.warn('[API v2/risk] Error fetching risk status:', e);
      return NextResponse.json(defaultResponse);
    }

    // Transform exposure to match frontend expectations
    const exposureForFrontend = {
      current: riskStatus?.exposure?.totalAtRisk || 0,
      limit: riskStatus?.config?.maxTotalExposure || DEFAULT_RISK_CONFIG.maxTotalExposure,
      utilizationPct: riskStatus?.exposure?.utilizationPct || 0,
      byPlatform: riskStatus?.exposure?.byPlatform || {},
    };

    return NextResponse.json({
      success: true,
      data: {
        status: {
          tradingAllowed: riskStatus?.tradingAllowed ?? true,
          exposure: exposureForFrontend,
          dailyStatus: riskStatus?.dailyStatus || defaultResponse.data.status.dailyStatus,
          alerts: riskStatus?.alerts || defaultResponse.data.status.alerts,
        },
        config: riskStatus?.config || DEFAULT_RISK_CONFIG,
        defaults: DEFAULT_RISK_CONFIG,
      },
      meta: {
        timestamp: new Date().toISOString(),
        initialized: defaultResponse.meta.initialized,
      },
    });
  } catch (error) {
    console.error('[API v2/risk] Error:', error);
    // Return defaults instead of error
    return NextResponse.json(defaultResponse);
  }
}

/**
 * POST /api/v2/risk/check
 *
 * Check if a trade passes risk limits.
 *
 * Body:
 * - marketId: string (required)
 * - side: 'YES' | 'NO' (required)
 * - size: number (required)
 * - price: number (optional)
 * - platform: string (required)
 * - probability: number (optional) - model probability for edge check
 * - confidence: number (optional) - confidence for sizing
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      marketId,
      side,
      size,
      price,
      platform,
      probability,
      confidence,
    } = body;

    // Validation
    if (!marketId || !side || !size || !platform) {
      return NextResponse.json(
        { success: false, error: 'marketId, side, size, and platform are required' },
        { status: 400 }
      );
    }

    const portfolio = getPortfolioManager();
    await portfolio.initialize();

    // Build order request
    const orderRequest: OrderRequest = {
      marketId,
      side,
      type: 'MARKET',
      size,
      price,
      platform,
    };

    // Check risk
    const result = await portfolio.checkTrade(orderRequest, probability, confidence);

    // Get optimal size if trade is rejected or close to limits
    let optimalSize = null;
    if (!result.approved || result.warnings.length > 0) {
      if (probability !== undefined && price !== undefined && confidence !== undefined) {
        const sizing = await portfolio.getOptimalSize(probability, price, confidence);
        optimalSize = {
          suggestedSize: sizing.suggestedSize,
          kellyFraction: sizing.kelly.suggestedFraction,
          reasoning: sizing.reasoning,
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        approved: result.approved,
        warnings: result.warnings,
        violations: result.violations,
        suggestedSize: result.suggestedSize,
        reasoning: result.reasoning,
        optimalSize,
      },
    });
  } catch (error) {
    console.error('[API v2/risk/check] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v2/risk
 *
 * Update risk configuration.
 *
 * Body: Partial<RiskConfig>
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate numeric fields
    const numericFields = [
      'maxPositionSize', 'maxPositionPct', 'maxTotalExposure', 'maxExposurePct',
      'maxPerPlatform', 'maxPerPlatformPct', 'maxPerCategory', 'maxPerCategoryPct',
      'maxDailyLoss', 'maxDailyLossPct', 'maxDrawdown', 'maxDrawdownPct',
      'stopLossDefault', 'takeProfitDefault', 'maxOpenPositions',
      'kellyFraction', 'minEdgeForTrade', 'minConfidenceForTrade',
    ];

    for (const field of numericFields) {
      if (body[field] !== undefined && typeof body[field] !== 'number') {
        return NextResponse.json(
          { success: false, error: `${field} must be a number` },
          { status: 400 }
        );
      }
    }

    const portfolio = getPortfolioManager();
    portfolio.updateConfig(body);

    const riskManager = getRiskManager();
    const newConfig = riskManager.getConfig();

    return NextResponse.json({
      success: true,
      data: {
        config: newConfig,
        message: 'Risk configuration updated',
      },
    });
  } catch (error) {
    console.error('[API v2/risk] Update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
