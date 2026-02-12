/**
 * Prediction Intelligence API Route
 *
 * Helps users "be right mostly" by providing:
 * - Base rate analysis from similar markets
 * - Market consensus and divergence
 * - Key factors to consider
 * - Cognitive bias warnings
 * - Recommended probability range
 *
 * POST /api/intelligence - Analyze a prediction question
 * GET /api/intelligence?q=question - Quick check
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withMiddleware, ApiContext, ApiError } from '../../../lib/apiMiddleware';
import { analyze, quickCheck, getIntelligence } from '../../../skills/intelligence';
import { getSkillLogger } from '../../../lib/logger';

const log = getSkillLogger('intelligence');

// Request body validation for POST
const bodySchema = z.object({
  question: z.string().min(5).max(500),
  marketTicker: z.string().optional(),
  userId: z.string().optional(),
});

/**
 * POST /api/intelligence
 * Full prediction intelligence report
 */
export const POST = withMiddleware(
  async (request: NextRequest, context: ApiContext) => {
    const timer = log.startTimer();

    const body = await request.json();
    const { question, marketTicker, userId } = bodySchema.parse(body);

    log.info('Starting intelligence analysis', {
      question: question.substring(0, 50),
      marketTicker,
      userId: context.userId || userId,
    });

    // Get full intelligence report
    const result = await analyze(question, {
      marketTicker,
      userId: context.userId || userId,
    });

    const duration = timer();
    log.logSkillExecution({
      name: 'intelligence.analyze',
      duration,
      success: result.mood !== 'ERROR',
    });

    return NextResponse.json({
      success: result.mood !== 'ERROR',
      question,
      intelligence: {
        summary: result.text,
        mood: result.mood,
        report: result.data,
      },
      analyzedAt: new Date().toISOString(),
    });
  },
  {
    rateLimit: 'research',
    requireAuth: false,
    bodySchema,
  }
);

/**
 * GET /api/intelligence?q=question
 * Quick intelligence check (base rate + recommended range)
 */
export const GET = withMiddleware(
  async (request: NextRequest, context: ApiContext) => {
    const { searchParams } = new URL(request.url);
    const question = searchParams.get('q');

    if (!question) {
      throw ApiError.badRequest('Missing question parameter', 'Provide ?q=your+question');
    }

    const timer = log.startTimer();

    // Quick check - just key numbers
    const result = await quickCheck(question);

    const duration = timer();
    log.logSkillExecution({
      name: 'intelligence.quickCheck',
      duration,
      success: true,
    });

    return NextResponse.json({
      success: true,
      question,
      baseRate: result.baseRate,
      marketPrice: result.marketPrice,
      recommendedRange: result.recommendedRange,
      checkedAt: new Date().toISOString(),
    });
  },
  {
    rateLimit: 'research',
    cache: { maxAge: 300, staleWhileRevalidate: 600 },
  }
);
