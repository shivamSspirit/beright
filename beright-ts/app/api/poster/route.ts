/**
 * Poster API Route
 * GET /api/poster - Get poster status
 * POST /api/poster - Execute poster action (post, engage, vote, cycle)
 *
 * This is the API layer that both Web and Telegram use.
 * Skill changes automatically sync across both.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withMiddleware, ApiContext, ApiError } from '../../../lib/apiMiddleware';
import {
  handlePosterCommand,
  createIntelligentPost,
  engageWithRelevantPosts,
  voteOnRelevantProjects,
  runPosterCycle,
} from '../../../skills/agentPoster';
import { getSkillLogger } from '../../../lib/logger';

const log = getSkillLogger('poster');

// GET - Status
export const GET = withMiddleware(
  async (request: NextRequest, context: ApiContext) => {
    const result = await handlePosterCommand('status');

    return NextResponse.json({
      success: true,
      status: result.data || {},
      message: result.text,
      mood: result.mood,
    });
  },
  {
    rateLimit: 'default',
    cache: { maxAge: 30, staleWhileRevalidate: 60 },
  }
);

// POST - Execute action
const bodySchema = z.object({
  action: z.enum(['post', 'engage', 'vote', 'cycle', 'status']),
  options: z.object({
    maxComments: z.number().min(1).max(10).optional(),
  }).optional(),
});

export const POST = withMiddleware(
  async (request: NextRequest, context: ApiContext) => {
    const timer = log.startTimer();
    const body = await request.json();
    const { action, options } = bodySchema.parse(body);

    log.info('Executing poster action', { action, userId: context.userId });

    let result;

    switch (action) {
      case 'post':
        result = await createIntelligentPost();
        break;

      case 'engage':
        result = await engageWithRelevantPosts(options?.maxComments || 3);
        break;

      case 'vote':
        result = await voteOnRelevantProjects();
        break;

      case 'cycle':
        result = await runPosterCycle();
        break;

      case 'status':
        result = await handlePosterCommand('status');
        break;

      default:
        throw ApiError.badRequest('Invalid action', 'Use: post, engage, vote, cycle, status');
    }

    const duration = timer();
    log.logSkillExecution({
      name: `poster.${action}`,
      duration,
      success: result.mood !== 'ERROR',
    });

    return NextResponse.json({
      success: result.mood !== 'ERROR',
      action,
      result: {
        message: result.text,
        mood: result.mood,
        data: result.data,
      },
      executedAt: new Date().toISOString(),
    });
  },
  {
    rateLimit: 'default',
    requireAuth: false,
    bodySchema,
  }
);
