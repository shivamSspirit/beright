/**
 * Calibration Feedback API Route
 *
 * Provides personalized performance analysis and improvement suggestions:
 * - Calibration accuracy and buckets
 * - Overconfidence/underconfidence detection
 * - Performance trends over time
 * - Bias pattern identification
 * - Actionable recommendations
 *
 * GET /api/feedback?userId=xxx - Get calibration feedback for user
 */

import { NextRequest, NextResponse } from 'next/server';
import { withMiddleware, ApiContext, ApiError } from '../../../lib/apiMiddleware';
import { feedback, generateFeedback } from '../../../skills/feedback';
import { getSkillLogger } from '../../../lib/logger';

const log = getSkillLogger('feedback');

/**
 * GET /api/feedback?userId=xxx
 * Get personalized calibration feedback
 */
export const GET = withMiddleware(
  async (request: NextRequest, context: ApiContext) => {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || context.userId;

    if (!userId) {
      throw ApiError.badRequest('Missing userId parameter', 'Provide ?userId=xxx or authenticate');
    }

    const timer = log.startTimer();

    log.info('Generating calibration feedback', { userId });

    // Generate full feedback report
    const report = await generateFeedback(userId);

    const duration = timer();
    log.logSkillExecution({
      name: 'feedback.generate',
      duration,
      success: report !== null,
    });

    if (!report) {
      return NextResponse.json({
        success: false,
        error: 'Not enough data',
        message: 'You need at least 5 resolved predictions to get calibration feedback. Keep making predictions!',
        minRequired: 5,
      });
    }

    return NextResponse.json({
      success: true,
      userId,
      feedback: {
        // Overview
        totalPredictions: report.totalPredictions,
        resolvedPredictions: report.resolvedPredictions,
        avgBrierScore: report.avgBrierScore,
        tier: report.tier,
        rank: report.rank,

        // Calibration
        calibrationGrade: report.calibrationGrade,
        overconfidenceScore: report.overconfidenceScore,
        calibrationBuckets: report.calibrationBuckets,

        // Trends
        trends: report.trends,
        isImproving: report.isImproving,

        // Patterns
        strongAreas: report.strongAreas,
        weakAreas: report.weakAreas,
        biasPatterns: report.biasPatterns,

        // Recommendations
        recommendations: report.recommendations,
        nextSteps: report.nextSteps,

        // Achievements
        achievements: report.achievements,
        streakInfo: report.streakInfo,
      },
      generatedAt: new Date().toISOString(),
    });
  },
  {
    rateLimit: 'leaderboard',
    cache: { maxAge: 60, staleWhileRevalidate: 300 },
  }
);

/**
 * POST /api/feedback
 * Get formatted feedback text (for Telegram/display)
 */
export const POST = withMiddleware(
  async (request: NextRequest, context: ApiContext) => {
    const body = await request.json();
    const userId = body.userId || context.userId;

    if (!userId) {
      throw ApiError.badRequest('Missing userId in body', 'Provide userId in request body or authenticate');
    }

    const timer = log.startTimer();

    log.info('Generating formatted feedback', { userId });

    const result = await feedback(userId);

    const duration = timer();
    log.logSkillExecution({
      name: 'feedback.formatted',
      duration,
      success: result.mood !== 'ERROR',
    });

    return NextResponse.json({
      success: result.mood !== 'ERROR',
      userId,
      text: result.text,
      mood: result.mood,
      data: result.data,
      generatedAt: new Date().toISOString(),
    });
  },
  {
    rateLimit: 'leaderboard',
    requireAuth: false,
  }
);
