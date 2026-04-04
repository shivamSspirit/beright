/**
 * Serper API Endpoint
 *
 * Provides web search, fact-checking, and research capabilities
 * for the AI fact-check modal in the swipe cards feature.
 *
 * Replaces Tavily with Serper.dev for better free tier (2,500 queries)
 *
 * POST /api/serper
 * Body: { query: string, type: 'facts' | 'verify' | 'research' | 'search' | 'news' }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getFactsForPrediction,
  verifyClaim,
  serperResearch,
  serperSearch,
  serperNewsSearch,
} from '../../../lib/serper';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface SerperRequest {
  query: string;
  type: 'facts' | 'verify' | 'research' | 'search' | 'news';
  options?: {
    num?: number;
    tbs?: string;
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const body: SerperRequest = await request.json();
    const { query, type, options } = body;

    if (!query || !type) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: query, type' },
        { status: 400 }
      );
    }

    let result: Record<string, unknown>;

    switch (type) {
      case 'facts': {
        // Get verified facts for a prediction market question
        const facts = await getFactsForPrediction(query);
        result = {
          facts: facts.facts,
          sources: facts.sources,
          answer: facts.answer,
          confidence: facts.confidence,
        };
        break;
      }

      case 'verify': {
        // Verify a claim
        const verification = await verifyClaim(query);
        result = {
          verified: verification.verified,
          evidence: verification.evidence,
          sources: verification.sources,
          confidence: verification.confidence >= 70 ? 'high' : verification.confidence >= 50 ? 'medium' : 'low',
        };
        break;
      }

      case 'research': {
        // Deep research on a topic
        const research = await serperResearch(query);
        result = {
          report: research.report,
          sources: research.sources,
          provider: research.provider,
        };
        break;
      }

      case 'search': {
        // General web search
        const searchResult = await serperSearch(query, {
          num: options?.num || 10,
        });
        result = {
          results: searchResult.results,
          answer: searchResult.answer,
          provider: searchResult.provider,
        };
        break;
      }

      case 'news': {
        // News search
        const newsResult = await serperNewsSearch(query, {
          num: options?.num || 10,
          tbs: options?.tbs || 'qdr:w',
        });
        result = {
          results: newsResult.results,
          provider: newsResult.provider,
        };
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown type: ${type}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      query,
      type,
      result,
      searchedAt: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error('[Serper API] Error:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('SERPER_API_KEY')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Serper API is not configured. Please set SERPER_API_KEY environment variable.',
          },
          { status: 503 }
        );
      }

      if (error.message.includes('rate limit') || error.message.includes('credit')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Rate limit exceeded. Please try again later.',
          },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Serper search failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for quick searches
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const type = searchParams.get('type') || 'search';

  if (!query) {
    return NextResponse.json(
      { success: false, error: 'Missing query parameter: q' },
      { status: 400 }
    );
  }

  // Redirect to POST handler
  const body: SerperRequest = { query, type: type as SerperRequest['type'] };
  const postRequest = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

  return POST(postRequest);
}
