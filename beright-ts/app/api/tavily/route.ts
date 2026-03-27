/**
 * Tavily API Endpoint
 *
 * Provides web search, fact-checking, and research capabilities
 * for the AI fact-check modal in the swipe cards feature.
 *
 * POST /api/tavily
 * Body: { query: string, type: 'facts' | 'verify' | 'research' | 'extract' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFactsForPrediction, verifyClaim, tavilyResearch, tavilyExtract } from '../../../lib/tavily';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface TavilyRequest {
  query: string;
  type: 'facts' | 'verify' | 'research' | 'extract';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const body: TavilyRequest = await request.json();
    const { query, type } = body;

    if (!query || !type) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: query, type' },
        { status: 400 }
      );
    }

    let result: any;

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
        const research = await tavilyResearch(query);
        result = {
          report: research.report,
          sources: research.sources,
          provider: research.provider,
        };
        break;
      }

      case 'extract': {
        // Extract content from URLs
        const urls = query.split(',').map(u => u.trim());
        const extracted = await tavilyExtract(urls);
        result = {
          results: extracted.results,
          failedUrls: extracted.failedUrls,
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
    console.error('[Tavily API] Error:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('TAVILY_API_KEY')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Tavily API is not configured. Please set TAVILY_API_KEY environment variable.',
          },
          { status: 503 }
        );
      }

      if (error.message.includes('rate limit') || error.message.includes('usage limit')) {
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
        error: error instanceof Error ? error.message : 'Tavily search failed',
      },
      { status: 500 }
    );
  }
}
