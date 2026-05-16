/**
 * Research API Route
 * POST /api/research - Analyze a prediction question
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withMiddleware, ApiContext, ApiError } from '../../../lib/apiMiddleware';
import { research, quickLookup } from '../../../skills/research';
import { getSkillLogger } from '../../../lib/logger';

const log = getSkillLogger('research');

// Request body validation
const bodySchema = z.object({
  question: z.string().min(10).max(500),
  includeNews: z.boolean().optional().default(true),
  includeSocial: z.boolean().optional().default(true),
  depth: z.enum(['quick', 'standard', 'deep']).optional().default('standard'),
});

export const POST = withMiddleware(
  async (request: NextRequest, context: ApiContext) => {
    const timer = log.startTimer();

    const body = await request.json();
    const { question, includeNews, includeSocial, depth } = bodySchema.parse(body);

    log.info('Starting research analysis', {
      question: question.substring(0, 50),
      depth,
      userId: context.userId,
    });

    // Analyze the question using superforecaster methodology
    const result = await research(question);

    const duration = timer();
    log.logSkillExecution({
      name: 'research.analyze',
      duration,
      success: true,
    });

    // Extract synthesis data if available (Groq LLM analysis)
    const synthesis = (result.data as any)?.synthesis;

    return NextResponse.json({
      success: true,
      question,
      analysis: {
        summary: result.text,
        mood: result.mood,
        confidence: synthesis?.confidence || (result.data as any)?.analysis?.confidence || 'medium',
        sources: (result.data as any)?.sources || [],
        marketData: (result.data as any)?.markets || [],
        baseRate: (result.data as any)?.baseRate,
        recommendation: synthesis?.recommendation || 'WATCH',
      },
      // AI Synthesis from Groq LLM (if available)
      aiSynthesis: synthesis ? {
        probability: synthesis.probability,
        confidence: synthesis.confidence,
        recommendation: synthesis.recommendation,
        narrative: synthesis.narrative,
        tradingEdge: synthesis.tradingEdge,
        bullishFactors: synthesis.bullishFactors,
        bearishFactors: synthesis.bearishFactors,
        keyUncertainties: synthesis.keyUncertainties,
        model: synthesis.model,
        tokensUsed: synthesis.tokensUsed,
      } : null,
      analyzedAt: new Date().toISOString(),
    });
  },
  {
    rateLimit: 'research',
    requireAuth: false, // Make auth optional for research
    bodySchema,
  }
);

// GET endpoint for quick lookups
export const GET = withMiddleware(
  async (request: NextRequest, context: ApiContext) => {
    const { searchParams } = new URL(request.url);
    const question = searchParams.get('q');

    if (!question) {
      throw ApiError.badRequest('Missing question parameter', 'Provide ?q=your+question');
    }

    const result = await quickLookup(question);

    return NextResponse.json({
      success: true,
      question,
      summary: result.text,
      mood: result.mood,
    });
  },
  {
    rateLimit: 'research',
    cache: { maxAge: 300, staleWhileRevalidate: 600 },
  }
);
