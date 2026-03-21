/**
 * BeRight Conviction Projects API
 *
 * CRUD endpoints for conviction projects - crypto projects that
 * stake real money on their own milestones.
 *
 * @author BeRight Protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createProject,
  listProjects,
  getProjectLeaderboard,
} from '../../../../../lib/conviction';
import { ProjectCategory } from '../../../../../lib/conviction/types';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const CreateProjectSchema = z.object({
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters')
    .max(50, 'Slug must be at most 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  description: z.string().max(1000, 'Description must be at most 1000 characters').optional(),
  category: z.enum([
    'defi',
    'nft',
    'gaming',
    'infrastructure',
    'dao',
    'social',
    'prediction_market',
    'other',
  ] as const),
  website: z.string().url('Website must be a valid URL').optional(),
  twitter: z.string().max(50).optional(),
  github: z.string().max(100).optional(),
  discord: z.string().url().optional(),
  treasuryWallet: z
    .string()
    .min(32, 'Invalid Solana wallet address')
    .max(44, 'Invalid Solana wallet address')
    .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'Invalid Solana wallet address format'),
  tokenMint: z
    .string()
    .min(32)
    .max(44)
    .regex(/^[1-9A-HJ-NP-Za-km-z]+$/)
    .optional(),
});

const ListProjectsSchema = z.object({
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
  verified: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  sortBy: z.enum(['score', 'staked', 'created', 'name']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
  leaderboard: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

// ============================================================================
// GET /api/v2/conviction/projects
// ============================================================================

/**
 * List conviction projects with filtering and pagination
 *
 * Query Parameters:
 * - category: Filter by project category
 * - verified: Only show verified projects (true/false)
 * - minScore: Minimum conviction score (0-100)
 * - sortBy: score, staked, created, name
 * - sortOrder: asc, desc
 * - limit: Number of results (default 20, max 100)
 * - offset: Pagination offset
 * - leaderboard: If true, returns top verified projects sorted by score
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate query params
    const params = ListProjectsSchema.safeParse(
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

    const { category, verified, minScore, sortBy, sortOrder, limit, offset, leaderboard } =
      params.data;

    // Leaderboard mode - returns top verified projects
    if (leaderboard) {
      const projects = await getProjectLeaderboard({
        category: category as ProjectCategory | undefined,
        limit: limit || 10,
      });

      return NextResponse.json({
        success: true,
        data: projects,
        meta: {
          count: projects.length,
          type: 'leaderboard',
        },
      });
    }

    // Standard list mode
    const result = await listProjects({
      category: category as ProjectCategory | undefined,
      verified,
      minScore,
      sortBy: sortBy || 'score',
      sortOrder: sortOrder || 'desc',
      limit: limit || 20,
      offset: offset || 0,
    });

    return NextResponse.json({
      success: true,
      data: result.projects,
      meta: {
        total: result.total,
        offset: offset || 0,
        limit: limit || 20,
        hasMore: result.total > (offset || 0) + (limit || 20),
      },
    });
  } catch (error) {
    console.error('[API v2/conviction/projects] GET Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/v2/conviction/projects
// ============================================================================

/**
 * Create a new conviction project
 *
 * Request Body:
 * - slug: Unique project slug (lowercase, alphanumeric with hyphens)
 * - name: Project display name
 * - description: Project description (optional)
 * - category: Project category
 * - website: Project website URL (optional)
 * - twitter: Twitter handle (optional)
 * - github: GitHub org/repo (optional)
 * - discord: Discord invite URL (optional)
 * - treasuryWallet: Solana treasury wallet address
 * - tokenMint: Token mint address (optional)
 *
 * Returns:
 * - project: Created project
 * - verificationChallenge: Challenge to verify project ownership
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const parsed = CreateProjectSchema.safeParse(body);
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

    // Create project
    const result = await createProject({
      slug: parsed.data.slug,
      name: parsed.data.name,
      description: parsed.data.description,
      category: parsed.data.category as ProjectCategory,
      website: parsed.data.website,
      twitter: parsed.data.twitter,
      github: parsed.data.github,
      discord: parsed.data.discord,
      treasuryWallet: parsed.data.treasuryWallet,
      tokenMint: parsed.data.tokenMint,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          project: result.project,
          verificationChallenge: result.verificationChallenge,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API v2/conviction/projects] POST Error:', error);

    // Handle known error codes
    const errorObj = error as { code?: string; message?: string };
    if (errorObj.code === 'DUPLICATE_SLUG') {
      return NextResponse.json(
        {
          success: false,
          error: errorObj.message || 'Project slug already exists',
          code: 'DUPLICATE_SLUG',
        },
        { status: 409 }
      );
    }
    if (errorObj.code === 'INVALID_PROJECT_SLUG') {
      return NextResponse.json(
        {
          success: false,
          error: errorObj.message || 'Invalid project slug',
          code: 'INVALID_PROJECT_SLUG',
        },
        { status: 400 }
      );
    }
    if (errorObj.code === 'INVALID_WALLET') {
      return NextResponse.json(
        {
          success: false,
          error: errorObj.message || 'Invalid wallet address',
          code: 'INVALID_WALLET',
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
