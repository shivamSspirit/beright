/**
 * Portfolio API Route
 * GET /api/portfolio - Get user's portfolio and positions
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withMiddleware, ApiContext, ApiError } from '../../../lib/apiMiddleware';
import { getUserPositions, getPortfolioSummary, getPnlReport } from '../../../skills/positions';
import { getCalibrationStats, listPending } from '../../../skills/calibration';
import { getSkillLogger } from '../../../lib/logger';

const log = getSkillLogger('portfolio');

export const GET = withMiddleware(
  async (request: NextRequest, context: ApiContext) => {
    const timer = log.startTimer();
    const { searchParams } = new URL(request.url);

    // Get userId from auth or query param (for testing)
    const userId = context.userId || searchParams.get('userId');

    if (!userId) {
      throw ApiError.unauthorized('User ID required');
    }

    // Get portfolio data
    const positions = getUserPositions(userId as string);
    const portfolio = getPortfolioSummary(userId as string);
    const pnl = getPnlReport(userId as string);

    // Get calibration stats
    const calibration = getCalibrationStats();
    const pendingPredictions = listPending();

    const duration = timer();
    log.logSkillExecution({
      name: 'portfolio.get',
      duration,
      success: true,
    });

    return NextResponse.json({
      success: true,
      userId,
      portfolio: {
        totalValue: portfolio.totalValue || 0,
        cashBalance: portfolio.cashBalance || 0,
        positionsValue: portfolio.positionsValue || 0,
        totalPnL: pnl.totalPnL || 0,
        dayChange: pnl.periodPnL || 0,
        positionCount: portfolio.positionCount || 0,
      },
      positions: positions.map((p: any) => ({
        id: p.id,
        market: p.market,
        platform: p.platform,
        direction: p.direction,
        size: p.size,
        entryPrice: p.entryPrice,
        currentPrice: p.currentPrice,
        pnl: p.pnl,
        pnlPercent: p.pnlPercent,
        status: p.status,
      })),
      calibration: {
        totalPredictions: calibration.totalPredictions,
        resolvedPredictions: calibration.resolvedPredictions,
        pendingPredictions: calibration.pendingPredictions,
        brierScore: calibration.overallBrierScore,
        accuracy: calibration.accuracy,
        streak: calibration.streak,
        byBucket: calibration.bucketStats,
      },
      pendingPredictions: pendingPredictions.slice(0, 10).map(p => ({
        id: p.id,
        question: p.question,
        probability: p.probability,
        direction: p.direction,
        createdAt: p.createdAt,
      })),
      updatedAt: new Date().toISOString(),
    });
  },
  {
    rateLimit: 'predictions_read',
    requireAuth: false, // Allow with userId query param for now
  }
);
