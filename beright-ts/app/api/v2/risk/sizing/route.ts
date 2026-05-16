/**
 * Position Sizing API v2
 *
 * Kelly criterion position sizing.
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPortfolioManager, calculateKelly, calculateMultiKelly, KellyInput, MultiKellyInput } from '../../../../../lib/portfolio';
import { getExecutionEngine } from '../../../../../lib/execution';

/**
 * POST /api/v2/risk/sizing
 *
 * Calculate optimal position size using Kelly criterion.
 *
 * Body:
 * - probability: number (required) - model probability (0-1)
 * - marketPrice: number (required) - current market price (0-1)
 * - confidence: number (required) - confidence level (0-1)
 * - riskLevel: 'conservative' | 'moderate' | 'aggressive' (default: 'moderate')
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      probability,
      marketPrice,
      confidence,
      riskLevel = 'moderate',
    } = body;

    // Validation
    if (probability === undefined || marketPrice === undefined || confidence === undefined) {
      return NextResponse.json(
        { success: false, error: 'probability, marketPrice, and confidence are required' },
        { status: 400 }
      );
    }

    if (probability < 0 || probability > 1 ||
        marketPrice < 0 || marketPrice > 1 ||
        confidence < 0 || confidence > 1) {
      return NextResponse.json(
        { success: false, error: 'probability, marketPrice, and confidence must be between 0 and 1' },
        { status: 400 }
      );
    }

    const portfolio = getPortfolioManager();
    await portfolio.initialize();

    const sizing = await portfolio.getOptimalSize(probability, marketPrice, confidence);

    // Calculate direction and edge
    const edge = probability - marketPrice;
    const direction = edge > 0 ? 'YES' : edge < 0 ? 'NO' : 'NEUTRAL';

    return NextResponse.json({
      success: true,
      data: {
        sizing: {
          suggestedSize: sizing.suggestedSize,
          riskAdjusted: sizing.riskAdjusted,
        },

        kelly: {
          fullKelly: sizing.kelly.fullKelly,
          halfKelly: sizing.kelly.halfKelly,
          quarterKelly: sizing.kelly.quarterKelly,
          suggestedFraction: sizing.kelly.suggestedFraction,
          fullKellyDollars: sizing.kelly.fullKellyDollars,
          suggestedDollars: sizing.kelly.suggestedDollars,
          maxAllowedDollars: sizing.kelly.maxAllowedDollars,
        },

        analysis: {
          probability,
          marketPrice,
          confidence,
          edge,
          direction,
          expectedValue: sizing.kelly.expectedValue,
          varianceReduction: sizing.kelly.varianceReduction,
        },

        reasoning: sizing.reasoning,
      },
    });
  } catch (error) {
    console.error('[API v2/risk/sizing] Error:', error);
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
 * POST /api/v2/risk/sizing/multi
 *
 * Calculate optimal sizes for multiple positions (portfolio allocation).
 *
 * Body:
 * - positions: Array<{
 *     marketId: string;
 *     probability: number;
 *     marketPrice: number;
 *     confidence: number;
 *     correlation?: number;
 *   }>
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { positions } = body;

    if (!positions || !Array.isArray(positions) || positions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'positions array is required' },
        { status: 400 }
      );
    }

    // Validate positions
    for (const pos of positions) {
      if (pos.probability === undefined || pos.marketPrice === undefined || pos.confidence === undefined) {
        return NextResponse.json(
          { success: false, error: 'Each position requires probability, marketPrice, and confidence' },
          { status: 400 }
        );
      }
    }

    const engine = getExecutionEngine();
    await engine.initialize();

    const [balance, exposure] = await Promise.all([
      engine.getTotalBalance(),
      engine.getExposure(),
    ]);

    const multiInput: MultiKellyInput = {
      positions,
      portfolioValue: balance.total,
      currentExposure: exposure.totalAtRisk,
    };

    const multiKelly = calculateMultiKelly(multiInput);

    return NextResponse.json({
      success: true,
      data: {
        allocations: multiKelly.allocations,
        summary: {
          totalAllocation: multiKelly.totalAllocation,
          diversificationBenefit: multiKelly.diversificationBenefit,
          portfolioValue: balance.total,
          availableForBetting: balance.available,
        },
        reasoning: multiKelly.reasoning,
      },
    });
  } catch (error) {
    console.error('[API v2/risk/sizing/multi] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
