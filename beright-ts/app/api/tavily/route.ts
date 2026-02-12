/**
 * Tavily API Route
 * Provides web search, news, research, and fact verification
 *
 * POST /api/tavily - Unified search endpoint
 * GET /api/tavily?q=query - Quick search
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withMiddleware, ApiContext, ApiError } from '../../../lib/apiMiddleware';
import { getSkillLogger } from '../../../lib/logger';
import {
  isTavilyConfigured,
  tavilySearch,
  tavilyNewsSearch,
  tavilyFinanceSearch,
  tavilyResearch,
  getFactsForPrediction,
  getNewsContext,
  verifyClaim,
  tavilyExtract,
} from '../../../lib/tavily';

const log = getSkillLogger('tavily');

// Request body validation
const bodySchema = z.object({
  query: z.string().min(3).max(500),
  type: z.enum(['search', 'news', 'finance', 'research', 'verify', 'facts', 'extract']).optional().default('search'),
  options: z.object({
    maxResults: z.number().min(1).max(20).optional(),
    days: z.number().min(1).max(365).optional(),
    includeAnswer: z.boolean().optional(),
    includeDomains: z.array(z.string()).optional(),
    excludeDomains: z.array(z.string()).optional(),
  }).optional(),
});

export const POST = withMiddleware(
  async (request: NextRequest, context: ApiContext) => {
    // Check if Tavily is configured
    if (!isTavilyConfigured()) {
      throw ApiError.internal(
        'Tavily not configured',
        'TAVILY_API_KEY environment variable is not set'
      );
    }

    const timer = log.startTimer();

    const body = await request.json();
    const { query, type, options = {} } = bodySchema.parse(body);

    log.info('Tavily API request', {
      query: query.substring(0, 50),
      type,
      userId: context.userId,
    });

    let result: any;

    switch (type) {
      case 'search':
        result = await tavilySearch(query, {
          maxResults: options.maxResults || 10,
          includeAnswer: options.includeAnswer ?? true,
          days: options.days,
          includeDomains: options.includeDomains,
          excludeDomains: options.excludeDomains,
        });
        break;

      case 'news':
        result = await tavilyNewsSearch(query, {
          maxResults: options.maxResults || 15,
          days: options.days || 7,
        });
        break;

      case 'finance':
        result = await tavilyFinanceSearch(query, {
          maxResults: options.maxResults || 15,
          includeDomains: options.includeDomains,
        });
        break;

      case 'research':
        result = await tavilyResearch(query);
        break;

      case 'verify':
        result = await verifyClaim(query);
        break;

      case 'facts':
        result = await getFactsForPrediction(query);
        break;

      case 'extract':
        // Query should be a URL for extraction
        result = await tavilyExtract([query]);
        break;

      default:
        throw ApiError.badRequest('Invalid type', `Unknown type: ${type}`);
    }

    const duration = timer();
    log.logSkillExecution({
      name: `tavily.${type}`,
      duration,
      success: true,
    });

    return NextResponse.json({
      success: true,
      query,
      type,
      result,
      searchedAt: new Date().toISOString(),
    });
  },
  {
    rateLimit: 'research',
    requireAuth: false,
    bodySchema,
  }
);

// GET endpoint for quick search
export const GET = withMiddleware(
  async (request: NextRequest, context: ApiContext) => {
    // Check if Tavily is configured
    if (!isTavilyConfigured()) {
      throw ApiError.internal(
        'Tavily not configured',
        'TAVILY_API_KEY environment variable is not set'
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const type = searchParams.get('type') || 'search';

    if (!query) {
      throw ApiError.badRequest('Missing query parameter', 'Provide ?q=your+search+query');
    }

    let result: any;

    switch (type) {
      case 'news':
        result = await getNewsContext(query);
        break;
      case 'facts':
        result = await getFactsForPrediction(query);
        break;
      default:
        result = await tavilySearch(query, {
          maxResults: 5,
          includeAnswer: true,
        });
    }

    return NextResponse.json({
      success: true,
      query,
      type,
      result,
    });
  },
  {
    rateLimit: 'research',
    cache: { maxAge: 300, staleWhileRevalidate: 600 },
  }
);
