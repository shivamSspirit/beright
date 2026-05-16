/**
 * BeRight Conviction - Project Management
 *
 * CRUD operations for conviction projects.
 */

import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';
import {
  ConvictionProject,
  ConvictionProjectRow,
  CreateProjectRequest,
  ProjectCategory,
  VerificationChallenge,
  ConvictionError,
  CONVICTION_ERROR_CODES,
} from './types';
import { randomBytes } from 'crypto';

// ============================================================================
// TYPE CONVERTERS
// ============================================================================

/**
 * Convert database row to ConvictionProject
 */
function rowToProject(row: ConvictionProjectRow): ConvictionProject {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description || '',
    category: row.category as ProjectCategory,

    website: row.website || '',
    twitter: row.twitter || undefined,
    github: row.github || undefined,
    discord: row.discord || undefined,

    tokenMint: row.token_mint || undefined,
    treasuryWallet: row.treasury_wallet,

    convictionScore: row.conviction_score,
    totalStaked: row.total_staked,
    marketsCreated: row.markets_created,
    marketsResolved: row.markets_resolved,
    successRate: row.success_rate,

    geoScore: row.geo_score || undefined,
    lastCitationCheck: row.last_citation_check
      ? new Date(row.last_citation_check)
      : undefined,

    verified: row.verified,
    verificationMethod: row.verification_method as 'tweet' | 'dns' | 'wallet_sign' | undefined,
    verifiedAt: row.verified_at ? new Date(row.verified_at) : undefined,

    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Convert CreateProjectRequest to database insert
 */
function requestToRow(request: CreateProjectRequest): Partial<ConvictionProjectRow> {
  return {
    slug: request.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    name: request.name,
    description: request.description,
    category: request.category,

    website: request.website,
    twitter: request.twitter || null,
    github: request.github || null,
    discord: request.discord || null,

    treasury_wallet: request.treasuryWallet,
    token_mint: request.tokenMint || null,

    conviction_score: 0,
    total_staked: 0,
    markets_created: 0,
    markets_resolved: 0,
    success_rate: 0,

    verified: false,
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate project slug
 */
function validateSlug(slug: string): { valid: boolean; error?: string } {
  if (!slug || slug.length < 3) {
    return { valid: false, error: 'Slug must be at least 3 characters' };
  }
  if (slug.length > 50) {
    return { valid: false, error: 'Slug must be at most 50 characters' };
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { valid: false, error: 'Slug must contain only lowercase letters, numbers, and hyphens' };
  }
  return { valid: true };
}

/**
 * Validate Solana wallet address
 */
function validateWallet(wallet: string): { valid: boolean; error?: string } {
  if (!wallet || wallet.length < 32 || wallet.length > 44) {
    return { valid: false, error: 'Invalid Solana wallet address' };
  }
  // Basic base58 check
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(wallet)) {
    return { valid: false, error: 'Invalid Solana wallet address format' };
  }
  return { valid: true };
}

// ============================================================================
// PROJECT CRUD
// ============================================================================

/**
 * Create a new conviction project
 */
export async function createProject(
  request: CreateProjectRequest
): Promise<{ project: ConvictionProject; verificationChallenge: VerificationChallenge }> {
  if (!isSupabaseConfigured) {
    throw new Error('Database not configured');
  }

  // Validate slug
  const slugValidation = validateSlug(request.slug);
  if (!slugValidation.valid) {
    const error: ConvictionError = {
      code: CONVICTION_ERROR_CODES.INVALID_PROJECT_SLUG,
      message: slugValidation.error || 'Invalid slug',
    };
    throw error;
  }

  // Validate wallet
  const walletValidation = validateWallet(request.treasuryWallet);
  if (!walletValidation.valid) {
    const error: ConvictionError = {
      code: CONVICTION_ERROR_CODES.INVALID_WALLET,
      message: walletValidation.error || 'Invalid wallet',
    };
    throw error;
  }

  // Check for duplicate slug
  const existing = await getProjectBySlug(request.slug);
  if (existing) {
    const error: ConvictionError = {
      code: CONVICTION_ERROR_CODES.DUPLICATE_SLUG,
      message: `Project with slug "${request.slug}" already exists`,
    };
    throw error;
  }

  // Insert project
  const rowData = requestToRow(request);
  const { data, error } = await supabaseAdmin
    .from('conviction_projects')
    .insert(rowData)
    .select()
    .single();

  if (error) {
    throw error;
  }

  const project = rowToProject(data as ConvictionProjectRow);

  // Generate verification challenge
  const challenge = generateVerificationChallenge(project);

  return { project, verificationChallenge: challenge };
}

/**
 * Get project by ID
 */
export async function getProjectById(id: string): Promise<ConvictionProject | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('conviction_projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (!data) {
    return null;
  }

  return rowToProject(data as ConvictionProjectRow);
}

/**
 * Get project by slug
 */
export async function getProjectBySlug(slug: string): Promise<ConvictionProject | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const normalizedSlug = slug.toLowerCase();

  const { data, error } = await supabaseAdmin
    .from('conviction_projects')
    .select('*')
    .eq('slug', normalizedSlug)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (!data) {
    return null;
  }

  return rowToProject(data as ConvictionProjectRow);
}

/**
 * Get project by treasury wallet
 */
export async function getProjectByWallet(wallet: string): Promise<ConvictionProject | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('conviction_projects')
    .select('*')
    .eq('treasury_wallet', wallet)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (!data) {
    return null;
  }

  return rowToProject(data as ConvictionProjectRow);
}

/**
 * List projects with filters
 */
export async function listProjects(options?: {
  category?: ProjectCategory;
  verified?: boolean;
  minScore?: number;
  sortBy?: 'score' | 'staked' | 'created' | 'name';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}): Promise<{ projects: ConvictionProject[]; total: number }> {
  if (!isSupabaseConfigured) {
    return { projects: [], total: 0 };
  }

  const limit = options?.limit || 20;
  const offset = options?.offset || 0;

  // Build query
  let query = supabaseAdmin
    .from('conviction_projects')
    .select('*', { count: 'exact' });

  // Apply filters
  if (options?.category) {
    query = query.eq('category', options.category);
  }
  if (options?.verified !== undefined) {
    query = query.eq('verified', options.verified);
  }
  if (options?.minScore !== undefined) {
    query = query.gte('conviction_score', options.minScore);
  }

  // Apply sorting
  const sortColumn = {
    score: 'conviction_score',
    staked: 'total_staked',
    created: 'created_at',
    name: 'name',
  }[options?.sortBy || 'score'];

  const ascending = options?.sortOrder === 'asc';
  query = query.order(sortColumn, { ascending });

  // Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  const projects = (data || []).map((row) => rowToProject(row as ConvictionProjectRow));

  return {
    projects,
    total: count || 0,
  };
}

/**
 * Update project metrics after market creation/resolution
 */
export async function updateProjectMetrics(
  projectId: string,
  updates: {
    marketsCreated?: number;
    marketsResolved?: number;
    totalStaked?: number;
    successRate?: number;
    convictionScore?: number;
  }
): Promise<ConvictionProject> {
  if (!isSupabaseConfigured) {
    throw new Error('Database not configured');
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.marketsCreated !== undefined) {
    updateData.markets_created = updates.marketsCreated;
  }
  if (updates.marketsResolved !== undefined) {
    updateData.markets_resolved = updates.marketsResolved;
  }
  if (updates.totalStaked !== undefined) {
    updateData.total_staked = updates.totalStaked;
  }
  if (updates.successRate !== undefined) {
    updateData.success_rate = updates.successRate;
  }
  if (updates.convictionScore !== undefined) {
    updateData.conviction_score = updates.convictionScore;
  }

  const { data, error } = await supabaseAdmin
    .from('conviction_projects')
    .update(updateData)
    .eq('id', projectId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return rowToProject(data as ConvictionProjectRow);
}

/**
 * Verify project ownership
 */
export async function verifyProject(
  projectId: string,
  method: 'tweet' | 'dns' | 'wallet_sign',
  proof: string
): Promise<ConvictionProject> {
  if (!isSupabaseConfigured) {
    throw new Error('Database not configured');
  }

  // TODO: Actually verify the proof based on method
  // For MVP, we'll just mark as verified

  const { data, error } = await supabaseAdmin
    .from('conviction_projects')
    .update({
      verified: true,
      verification_method: method,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return rowToProject(data as ConvictionProjectRow);
}

/**
 * Update project GEO score
 */
export async function updateProjectGeoScore(
  projectId: string,
  geoScore: number
): Promise<ConvictionProject> {
  if (!isSupabaseConfigured) {
    throw new Error('Database not configured');
  }

  const { data, error } = await supabaseAdmin
    .from('conviction_projects')
    .update({
      geo_score: geoScore,
      last_citation_check: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return rowToProject(data as ConvictionProjectRow);
}

/**
 * Get leaderboard of projects by conviction score
 */
export async function getProjectLeaderboard(
  options?: {
    category?: ProjectCategory;
    limit?: number;
  }
): Promise<ConvictionProject[]> {
  return (await listProjects({
    category: options?.category,
    verified: true,
    sortBy: 'score',
    sortOrder: 'desc',
    limit: options?.limit || 10,
  })).projects;
}

// ============================================================================
// VERIFICATION HELPERS
// ============================================================================

/**
 * Generate a verification challenge for a project
 */
function generateVerificationChallenge(project: ConvictionProject): VerificationChallenge {
  const code = randomBytes(16).toString('hex');
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

  return {
    type: 'tweet',
    challenge: `Verifying ${project.name} on BeRight Conviction. Code: ${code}`,
    expiresAt,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const projects = {
  create: createProject,
  getById: getProjectById,
  getBySlug: getProjectBySlug,
  getByWallet: getProjectByWallet,
  list: listProjects,
  updateMetrics: updateProjectMetrics,
  verify: verifyProject,
  updateGeoScore: updateProjectGeoScore,
  getLeaderboard: getProjectLeaderboard,
};
