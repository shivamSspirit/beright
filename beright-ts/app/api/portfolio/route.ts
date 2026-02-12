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

    const portfolioData = portfolio as any;
    const pnlData = pnl as any;
    const calibrationData = calibration as any;

    return NextResponse.json({
      success: true,
      userId,
      portfolio: {
        totalValue: portfolioData.totalValue || 0,
        cashBalance: portfolioData.cashBalance || 0,
        positionsValue: portfolioData.positionsValue || 0,
        totalPnL: pnlData.totalPnl || 0,
        dayChange: pnlData.totalPnl || 0,
        positionCount: portfolioData.positionCount || positions.length || 0,
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
        totalPredictions: calibrationData.totalPredictions,
        resolvedPredictions: calibrationData.resolvedPredictions,
        pendingPredictions: calibrationData.pendingPredictions,
        brierScore: calibrationData.overallBrierScore,
        accuracy: calibrationData.accuracy,
        streak: calibrationData.streak,
        byBucket: calibrationData.bucketStats || calibrationData.byBucket,
      },
      pendingPredictions: pendingPredictions.slice(0, 10).map((p: any) => ({
        id: p.id,
        question: p.question,
        probability: p.predicted_probability || p.probability,
        direction: p.direction,
        createdAt: p.created_at || p.createdAt,
      })),
      updatedAt: new Date().toISOString(),
    });
  },
  {
    rateLimit: 'predictions_read',
    requireAuth: false, // Allow with userId query param for now
  }
);
