/**
 * Tavily API Endpoint (DEPRECATED - Now uses Serper.dev)
 *
 * This endpoint is maintained for backward compatibility.
 * All requests are handled by Serper.dev instead of Tavily.
 *
 * POST /api/tavily
 * Body: { query: string, type: 'facts' | 'verify' | 'research' | 'extract' }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getFactsForPrediction,
  verifyClaim,
  serperResearch,
  serperSearch,
} from '../../../lib/serper';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface SearchRequest {
  query: string;
  type: 'facts' | 'verify' | 'research' | 'extract' | 'search' | 'news';
  options?: Record<string, unknown>;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const body: SearchRequest = await request.json();
    const { query, type } = body;

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

      case 'extract': {
        // Extract is not supported by Serper - return search results instead
        console.warn('[Search API] Extract type not supported, returning search results');
        const searchResult = await serperSearch(query, { num: 5 });
        result = {
          results: searchResult.results.map(r => ({
            url: r.url,
            rawContent: r.content,
          })),
          failedUrls: [],
        };
        break;
      }

      case 'search': {
        const searchResult = await serperSearch(query, { num: 10 });
        result = {
          results: searchResult.results,
          answer: searchResult.answer,
          provider: searchResult.provider,
        };
        break;
      }

      case 'news': {
        const { serperNewsSearch } = await import('../../../lib/serper');
        const newsResult = await serperNewsSearch(query, { num: 10 });
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
    console.error('[Search API] Error:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('SERPER_API_KEY')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Search API is not configured. Please set SERPER_API_KEY environment variable.',
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
        error: error instanceof Error ? error.message : 'Search failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for quick searches (backward compatibility)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const type = (searchParams.get('type') || 'facts') as SearchRequest['type'];

  if (!query) {
    return NextResponse.json(
      { success: false, error: 'Missing query parameter: q' },
      { status: 400 }
    );
  }

  // Create a POST request with the query params
  const body: SearchRequest = { query, type };
  const postRequest = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

  return POST(postRequest);
}
