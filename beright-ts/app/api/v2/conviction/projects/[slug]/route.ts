/**
 * BeRight Conviction Project Profile API
 *
 * Endpoint for fetching individual project profiles with full details,
 * markets, and conviction score breakdown.
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getProjectBySlug,
  getMarketsByProject,
  calculateConvictionScore,
  getScoreHistory,
} from '../../../../../../lib/conviction';

// ============================================================================
// GET /api/v2/conviction/projects/[slug]
// ============================================================================

/**
 * Get a conviction project profile by slug
 *
 * Path Parameters:
 * - slug: Project slug (e.g., "jupiter", "drift-protocol")
 *
 * Query Parameters:
 * - includeMarkets: Include project's markets (default: true)
 * - includeScoreDetails: Include conviction score breakdown (default: true)
 * - includeHistory: Include score history (default: false)
 * - historyDays: Days of score history to include (default: 30)
 * - marketLimit: Max markets to include (default: 10)
 * - marketStatus: Filter markets by status (active, resolved, all)
 *
 * Returns:
 * - project: Project details
 * - markets: Array of markets (if requested)
 * - scoreDetails: Conviction score breakdown (if requested)
 * - scoreHistory: Historical scores (if requested)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);

    // Parse options
    const includeMarkets = searchParams.get('includeMarkets') !== 'false';
    const includeScoreDetails = searchParams.get('includeScoreDetails') !== 'false';
    const includeHistory = searchParams.get('includeHistory') === 'true';
    const historyDays = parseInt(searchParams.get('historyDays') || '30');
    const marketLimit = parseInt(searchParams.get('marketLimit') || '10');
    const marketStatus = searchParams.get('marketStatus') || 'all';

    // Fetch project
    const project = await getProjectBySlug(slug);
    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project not found',
          code: 'PROJECT_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Build response
    const response: {
      project: typeof project;
      markets?: Awaited<ReturnType<typeof getMarketsByProject>>;
      scoreDetails?: Awaited<ReturnType<typeof calculateConvictionScore>>;
      scoreHistory?: Awaited<ReturnType<typeof getScoreHistory>>;
    } = {
      project,
    };

    // Fetch markets if requested
    if (includeMarkets) {
      const marketOptions: { status?: 'active' | 'resolved'; limit?: number } = {
        limit: marketLimit,
      };

      if (marketStatus === 'active') {
        marketOptions.status = 'active';
      } else if (marketStatus === 'resolved') {
        marketOptions.status = 'resolved';
      }
      // 'all' doesn't set status filter

      response.markets = await getMarketsByProject(project.id, marketOptions);
    }

    // Fetch score details if requested
    if (includeScoreDetails) {
      response.scoreDetails = await calculateConvictionScore(project.id);
    }

    // Fetch score history if requested
    if (includeHistory) {
      response.scoreHistory = await getScoreHistory(project.id, historyDays);
    }

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('[API v2/conviction/projects/[slug]] GET Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
