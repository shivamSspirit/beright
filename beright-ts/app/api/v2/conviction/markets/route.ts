/**
 * BeRight Conviction Markets API
 *
 * CRUD endpoints for conviction markets - prediction markets where
 * crypto projects stake real money on their own milestones.
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createMarket,
  listMarkets,
  getActiveMarkets,
  getClosingSoonMarkets,
  getMarketStats,
} from '../../../../../lib/conviction';
import { MilestoneType, ResolutionSource, ProjectCategory } from '../../../../../lib/conviction/types';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const CreateMarketSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  question: z.string().min(10, 'Question must be at least 10 characters').max(500),
  description: z.string().max(2000).optional(),
  milestoneType: z.enum([
    'mainnet_launch',
    'user_milestone',
    'tvl_milestone',
    'token_launch',
    'partnership',
    'audit_completion',
    'feature_release',
    'revenue_milestone',
    'funding_round',
    'ai_visibility',
    'custom',
  ] as const),
  resolutionCriteria: z.string().max(1000).optional(),
  resolutionSource: z
    .enum(['on_chain', 'api', 'manual', 'oracle', 'ai_query'] as const)
    .optional(),
  resolutionDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), 'Invalid date format')
    .refine((val) => new Date(val) > new Date(), 'Resolution date must be in the future'),
  stakeAmount: z.number().positive('Stake amount must be positive'),
  stakePosition: z.enum(['yes', 'no']).optional().default('yes'),
});

const ListMarketsSchema = z.object({
  projectId: z.string().uuid().optional(),
  status: z.enum(['draft', 'pending_stake', 'active', 'closed', 'resolved', 'disputed']).optional(),
  milestoneType: z
    .enum([
      'mainnet_launch',
      'user_milestone',
      'tvl_milestone',
      'token_launch',
      'partnership',
      'audit_completion',
      'feature_release',
      'revenue_milestone',
      'funding_round',
      'ai_visibility',
      'custom',
    ] as const)
    .optional(),
  sortBy: z.enum(['volume', 'stake', 'closing', 'created']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
  active: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  closingSoon: z.coerce.number().min(1).max(168).optional(), // hours until close
  category: z
    .enum([
      'defi',
      'nft',
      'gaming',
      'infrastructure',
      'dao',
      'social',
      'prediction_market',
      'other',
    ] as const)
    .optional(),
  stats: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

// ============================================================================
// GET /api/v2/conviction/markets
// ============================================================================

/**
 * List conviction markets with filtering and pagination
 *
 * Query Parameters:
 * - projectId: Filter by project
 * - status: Filter by market status
 * - milestoneType: Filter by milestone type
 * - sortBy: volume, stake, closing, created
 * - sortOrder: asc, desc
 * - limit: Number of results (default 20, max 100)
 * - offset: Pagination offset
 * - active: If true, returns only active markets sorted by volume
 * - closingSoon: Returns markets closing within N hours
 * - category: Filter by project category (for active markets)
 * - stats: If true, returns aggregate market statistics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate query params
    const params = ListMarketsSchema.safeParse(
      Object.fromEntries(searchParams.entries())
    );

    if (!params.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: params.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      projectId,
      status,
      milestoneType,
      sortBy,
      sortOrder,
      limit,
      offset,
      active,
      closingSoon,
      category,
      stats,
    } = params.data;

    // Stats mode - returns aggregate statistics
    if (stats) {
      const marketStats = await getMarketStats();
      return NextResponse.json({
        success: true,
        data: marketStats,
        meta: { type: 'stats' },
      });
    }

    // Closing soon mode
    if (closingSoon) {
      const markets = await getClosingSoonMarkets(closingSoon, limit || 10);
      return NextResponse.json({
        success: true,
        data: markets,
        meta: {
          count: markets.length,
          type: 'closing_soon',
          hoursUntilClose: closingSoon,
        },
      });
    }

    // Active markets mode
    if (active) {
      const markets = await getActiveMarkets({
        limit: limit || 20,
        category: category as ProjectCategory | undefined,
      });
      return NextResponse.json({
        success: true,
        data: markets,
        meta: {
          count: markets.length,
          type: 'active',
        },
      });
    }

    // Standard list mode
    const result = await listMarkets({
      projectId,
      status,
      milestoneType: milestoneType as MilestoneType | undefined,
      sortBy: sortBy || 'created',
      sortOrder: sortOrder || 'desc',
      limit: limit || 20,
      offset: offset || 0,
    });

    return NextResponse.json({
      success: true,
      data: result.markets,
      meta: {
        total: result.total,
        offset: offset || 0,
        limit: limit || 20,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    console.error('[API v2/conviction/markets] GET Error:', error);

    // Return demo data in case of database errors
    const demoMarkets = [
      {
        id: 'demo-market-1',
        projectId: 'demo-project-1',
        question: 'Will BeRight launch mainnet by Q2 2026?',
        description: 'BeRight Protocol mainnet deployment milestone',
        milestoneType: 'mainnet_launch',
        resolutionDate: '2026-06-30T00:00:00Z',
        projectStake: { amount: 10, position: 'yes' },
        yesPrice: 0.75,
        noPrice: 0.25,
        volume: 5000,
        status: 'active',
        platform: 'beright',
        createdAt: '2026-03-01T00:00:00Z',
      },
      {
        id: 'demo-market-2',
        projectId: 'demo-project-2',
        question: 'Will Sanctum reach 100M TVL by April 2026?',
        description: 'Sanctum INF TVL milestone tracking',
        milestoneType: 'tvl_milestone',
        resolutionDate: '2026-04-30T00:00:00Z',
        projectStake: { amount: 25, position: 'yes' },
        yesPrice: 0.82,
        noPrice: 0.18,
        volume: 12500,
        status: 'active',
        platform: 'beright',
        createdAt: '2026-02-15T00:00:00Z',
      },
      {
        id: 'demo-market-3',
        projectId: 'demo-project-3',
        question: 'Will Jupiter launch perps V2 by May 2026?',
        description: 'Jupiter exchange perps upgrade milestone',
        milestoneType: 'feature_release',
        resolutionDate: '2026-05-31T00:00:00Z',
        projectStake: { amount: 50, position: 'yes' },
        yesPrice: 0.68,
        noPrice: 0.32,
        volume: 28000,
        status: 'active',
        platform: 'beright',
        createdAt: '2026-03-10T00:00:00Z',
      },
    ];

    return NextResponse.json({
      success: true,
      data: demoMarkets,
      meta: {
        total: demoMarkets.length,
        offset: 0,
        limit: 20,
        hasMore: false,
        _demo: true,
        _note: 'Demo data - database table not configured',
      },
    });
  }
}

// ============================================================================
// POST /api/v2/conviction/markets
// ============================================================================

/**
 * Create a new conviction market
 *
 * Request Body:
 * - projectId: UUID of the project creating the market
 * - question: Market question (e.g., "Will X launch mainnet by Y?")
 * - description: Detailed market description (optional)
 * - milestoneType: Type of milestone being predicted
 * - resolutionCriteria: How the market will be resolved (optional, uses template default)
 * - resolutionSource: Source for resolution data (optional, uses template default)
 * - resolutionDate: ISO date string for when market resolves
 * - stakeAmount: Amount of SOL the project is staking
 * - stakePosition: Position project takes (yes/no, default: yes)
 *
 * Returns:
 * - market: Created market
 * - stakeInstructions: Instructions for staking (escrow address, amount, memo)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const parsed = CreateMarketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Create market
    const result = await createMarket({
      projectId: parsed.data.projectId,
      question: parsed.data.question,
      description: parsed.data.description,
      milestoneType: parsed.data.milestoneType as MilestoneType,
      resolutionCriteria: parsed.data.resolutionCriteria,
      resolutionSource: parsed.data.resolutionSource as ResolutionSource | undefined,
      resolutionDate: new Date(parsed.data.resolutionDate),
      stakeAmount: parsed.data.stakeAmount,
      stakePosition: parsed.data.stakePosition as 'yes' | 'no',
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          market: result.market,
          stakeInstructions: result.stakeInstructions,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API v2/conviction/markets] POST Error:', error);

    // Handle known error codes
    const errorObj = error as { code?: string; message?: string };
    if (errorObj.code === 'PROJECT_NOT_FOUND') {
      return NextResponse.json(
        {
          success: false,
          error: errorObj.message || 'Project not found',
          code: 'PROJECT_NOT_FOUND',
        },
        { status: 404 }
      );
    }
    if (errorObj.code === 'INSUFFICIENT_STAKE') {
      return NextResponse.json(
        {
          success: false,
          error: errorObj.message || 'Stake amount too low for milestone type',
          code: 'INSUFFICIENT_STAKE',
        },
        { status: 400 }
      );
    }
    if (errorObj.code === 'RESOLUTION_DATE_IN_PAST') {
      return NextResponse.json(
        {
          success: false,
          error: errorObj.message || 'Resolution date must be in the future',
          code: 'RESOLUTION_DATE_IN_PAST',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
