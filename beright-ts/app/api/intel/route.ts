/**
 * Intel API Route
 * GET /api/intel - Get news and social sentiment
 * GET /api/intel?q=bitcoin - Search specific topic
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withMiddleware, ApiContext } from '../../../lib/apiMiddleware';
import { searchNews, newsSearch, socialSearch } from '../../../skills/intel';
import { getSkillLogger } from '../../../lib/logger';

const log = getSkillLogger('intel');

// Query parameter validation
const querySchema = z.object({
  q: z.string().max(200).optional(),
  type: z.enum(['news', 'social', 'all']).optional().default('all'),
  limit: z.string().regex(/^\d+$/).optional().transform(v => v ? parseInt(v) : 20),
}).strict();

export const GET = withMiddleware(
  async (request: NextRequest, context: ApiContext) => {
    const timer = log.startTimer();
    const { searchParams } = new URL(request.url);

    const query = searchParams.get('q') || '';
    const type = searchParams.get('type') || 'all';
    const limit = parseInt(searchParams.get('limit') || '20');

    let newsData: any[] = [];
    let socialData: any[] = [];

    // Fetch based on type
    if (type === 'news' || type === 'all') {
      const newsResult = await newsSearch(query || 'prediction markets');
      newsData = newsResult.data?.articles || [];
    }

    if (type === 'social' || type === 'all') {
      const socialResult = await socialSearch(query || 'prediction markets');
      socialData = socialResult.data?.posts || [];
    }

    const duration = timer();
    log.logSkillExecution({
      name: 'intel.fetch',
      duration,
      success: true,
    });

    return NextResponse.json({
      success: true,
      query: query || 'general',
      type,
      news: newsData.slice(0, limit).map((n: any) => ({
        title: n.title,
        source: n.source,
        url: n.url,
        publishedAt: n.publishedAt,
        summary: n.summary,
        sentiment: n.sentiment,
        relevance: n.relevance,
      })),
      social: socialData.slice(0, limit).map((s: any) => ({
        platform: s.platform,
        author: s.author,
        content: s.content?.substring(0, 500),
        sentiment: s.sentiment,
        engagement: s.engagement,
        url: s.url,
      })),
      totalNews: newsData.length,
      totalSocial: socialData.length,
      fetchedAt: new Date().toISOString(),
    });
  },
  {
    rateLimit: 'default',
    querySchema,
    cache: { maxAge: 120, staleWhileRevalidate: 300 },
  }
);
