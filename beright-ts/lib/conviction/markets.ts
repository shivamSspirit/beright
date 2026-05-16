/**
 * BeRight Conviction - Market Management
 *
 * CRUD operations for conviction markets.
 */

import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';
import {
  ConvictionMarket,
  ConvictionMarketRow,
  CreateMarketRequest,
  CreateMarketResponse,
  ListMarketsQuery,
  ListMarketsResponse,
  MarketStatus,
  MarketOutcome,
  MilestoneType,
  ResolutionSource,
  StakeInstructions,
  ConvictionError,
  CONVICTION_ERROR_CODES,
  ProjectCategory,
} from './types';
import { getMilestoneTemplate, validateStakeAmount } from './milestones';
import { getProjectById, updateProjectMetrics } from './projects';
import { calculateConvictionScore } from './scoring';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPE CONVERTERS
// ============================================================================

/**
 * Convert database row to ConvictionMarket
 */
function rowToMarket(row: ConvictionMarketRow): ConvictionMarket {
  return {
    id: row.id,
    projectId: row.project_id,

    question: row.question,
    description: row.description || '',
    milestoneType: row.milestone_type as MilestoneType,

    resolutionCriteria: row.resolution_criteria,
    resolutionSource: row.resolution_source as ResolutionSource,
    resolutionDate: new Date(row.resolution_date),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
    outcome: row.outcome as MarketOutcome | undefined,
    resolutionEvidence: row.resolution_evidence || undefined,

    projectStake: {
      amount: row.project_stake_amount,
      position: row.project_stake_position as 'yes' | 'no',
      txSignature: row.project_stake_tx || undefined,
      stakedAt: row.project_stake_at ? new Date(row.project_stake_at) : undefined,
    },

    yesPrice: row.yes_price,
    noPrice: row.no_price,
    volume: row.volume,
    liquidity: row.liquidity,
    tradeCount: row.trade_count,

    platform: row.platform as 'beright' | 'manifold' | 'polymarket',
    externalId: row.external_id || undefined,
    externalUrl: row.external_url || undefined,

    status: row.status as MarketStatus,

    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ============================================================================
// MARKET CRUD
// ============================================================================

/**
 * Create a new conviction market
 */
export async function createMarket(
  request: CreateMarketRequest
): Promise<CreateMarketResponse> {
  if (!isSupabaseConfigured) {
    throw new Error('Database not configured');
  }

  // Validate project exists
  const project = await getProjectById(request.projectId);
  if (!project) {
    const error: ConvictionError = {
      code: CONVICTION_ERROR_CODES.PROJECT_NOT_FOUND,
      message: 'Project not found',
    };
    throw error;
  }

  // Validate stake amount
  const stakeValidation = validateStakeAmount(request.milestoneType, request.stakeAmount);
  if (!stakeValidation.valid) {
    const error: ConvictionError = {
      code: CONVICTION_ERROR_CODES.INSUFFICIENT_STAKE,
      message: `Minimum stake for ${request.milestoneType} is ${stakeValidation.minRequired} SOL`,
    };
    throw error;
  }

  // Validate resolution date is in the future
  const resolutionDate = new Date(request.resolutionDate);
  if (resolutionDate <= new Date()) {
    const error: ConvictionError = {
      code: CONVICTION_ERROR_CODES.RESOLUTION_DATE_IN_PAST,
      message: 'Resolution date must be in the future',
    };
    throw error;
  }

  // Get milestone template for defaults
  const template = getMilestoneTemplate(request.milestoneType);

  // Create market ID
  const marketId = uuidv4();

  // Insert market
  const rowData: Partial<ConvictionMarketRow> = {
    id: marketId,
    project_id: request.projectId,

    question: request.question,
    description: request.description,
    milestone_type: request.milestoneType,

    resolution_criteria: request.resolutionCriteria || template.resolutionCriteria,
    resolution_source: request.resolutionSource || template.resolutionSource,
    resolution_date: resolutionDate.toISOString(),

    project_stake_amount: request.stakeAmount,
    project_stake_position: request.stakePosition || 'yes',

    yes_price: 0.5,
    no_price: 0.5,
    volume: 0,
    liquidity: 0,
    trade_count: 0,

    platform: 'beright',
    status: 'pending_stake',
  };

  const { data, error } = await supabaseAdmin
    .from('conviction_markets')
    .insert(rowData)
    .select()
    .single();

  if (error) {
    throw error;
  }

  const market = rowToMarket(data as ConvictionMarketRow);

  // Generate stake instructions
  const stakeInstructions: StakeInstructions = {
    escrowAddress: generateEscrowAddress(marketId),
    amount: request.stakeAmount,
    memo: `BeRight Conviction: ${marketId}`,
  };

  // Update project metrics
  await updateProjectMetrics(request.projectId, {
    marketsCreated: project.marketsCreated + 1,
  });

  return { market, stakeInstructions };
}

/**
 * Get market by ID
 */
export async function getMarketById(id: string): Promise<ConvictionMarket | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('conviction_markets')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (!data) {
    return null;
  }

  return rowToMarket(data as ConvictionMarketRow);
}

/**
 * List markets with filters
 */
export async function listMarkets(
  query?: ListMarketsQuery
): Promise<ListMarketsResponse> {
  if (!isSupabaseConfigured) {
    return { markets: [], total: 0, hasMore: false };
  }

  const limit = query?.limit || 20;
  const offset = query?.offset || 0;

  // Build query
  let dbQuery = supabaseAdmin
    .from('conviction_markets')
    .select('*', { count: 'exact' });

  // Apply filters
  if (query?.projectId) {
    dbQuery = dbQuery.eq('project_id', query.projectId);
  }
  if (query?.status) {
    dbQuery = dbQuery.eq('status', query.status);
  }
  if (query?.milestoneType) {
    dbQuery = dbQuery.eq('milestone_type', query.milestoneType);
  }

  // Apply sorting
  const sortColumn = {
    volume: 'volume',
    stake: 'project_stake_amount',
    closing: 'resolution_date',
    created: 'created_at',
  }[query?.sortBy || 'created'];

  const ascending = query?.sortOrder === 'asc';
  dbQuery = dbQuery.order(sortColumn, { ascending });

  // Apply pagination
  dbQuery = dbQuery.range(offset, offset + limit - 1);

  const { data, error, count } = await dbQuery;

  if (error) {
    throw error;
  }

  const markets = (data || []).map((row) => rowToMarket(row as ConvictionMarketRow));

  return {
    markets,
    total: count || 0,
    hasMore: (count || 0) > offset + limit,
  };
}

/**
 * Get markets by project
 */
export async function getMarketsByProject(
  projectId: string,
  options?: { status?: MarketStatus; limit?: number }
): Promise<ConvictionMarket[]> {
  return (await listMarkets({
    projectId,
    status: options?.status,
    limit: options?.limit,
    sortBy: 'created',
    sortOrder: 'desc',
  })).markets;
}

/**
 * Get active markets (for trading)
 */
export async function getActiveMarkets(
  options?: { limit?: number; category?: ProjectCategory }
): Promise<ConvictionMarket[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  // For active markets, we need to join with projects to filter by category
  let query = supabaseAdmin
    .from('conviction_markets')
    .select(`
      *,
      conviction_projects!inner(category)
    `)
    .eq('status', 'active')
    .order('volume', { ascending: false })
    .limit(options?.limit || 20);

  if (options?.category) {
    query = query.eq('conviction_projects.category', options.category);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data || []).map((row) => rowToMarket(row as ConvictionMarketRow));
}

/**
 * Get markets closing soon
 */
export async function getClosingSoonMarkets(
  hoursUntilClose: number = 24,
  limit: number = 10
): Promise<ConvictionMarket[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() + hoursUntilClose * 60 * 60 * 1000);

  const { data, error } = await supabaseAdmin
    .from('conviction_markets')
    .select('*')
    .eq('status', 'active')
    .gte('resolution_date', now.toISOString())
    .lte('resolution_date', cutoff.toISOString())
    .order('resolution_date', { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data || []).map((row) => rowToMarket(row as ConvictionMarketRow));
}

/**
 * Record project stake transaction
 */
export async function recordProjectStake(
  marketId: string,
  txSignature: string
): Promise<ConvictionMarket> {
  if (!isSupabaseConfigured) {
    throw new Error('Database not configured');
  }

  const market = await getMarketById(marketId);
  if (!market) {
    const error: ConvictionError = {
      code: CONVICTION_ERROR_CODES.MARKET_NOT_FOUND,
      message: 'Market not found',
    };
    throw error;
  }

  // Update market with stake info
  const { data, error } = await supabaseAdmin
    .from('conviction_markets')
    .update({
      project_stake_tx: txSignature,
      project_stake_at: new Date().toISOString(),
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', marketId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  // Update project total staked
  const project = await getProjectById(market.projectId);
  if (project) {
    await updateProjectMetrics(market.projectId, {
      totalStaked: project.totalStaked + market.projectStake.amount,
    });
  }

  return rowToMarket(data as ConvictionMarketRow);
}

/**
 * Update market prices (from trading activity)
 */
export async function updateMarketPrices(
  marketId: string,
  yesPrice: number,
  noPrice: number,
  volumeIncrease: number = 0
): Promise<ConvictionMarket> {
  if (!isSupabaseConfigured) {
    throw new Error('Database not configured');
  }

  const market = await getMarketById(marketId);
  if (!market) {
    const error: ConvictionError = {
      code: CONVICTION_ERROR_CODES.MARKET_NOT_FOUND,
      message: 'Market not found',
    };
    throw error;
  }

  const { data, error } = await supabaseAdmin
    .from('conviction_markets')
    .update({
      yes_price: yesPrice,
      no_price: noPrice,
      volume: market.volume + volumeIncrease,
      trade_count: market.tradeCount + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', marketId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return rowToMarket(data as ConvictionMarketRow);
}

/**
 * Resolve a market
 */
export async function resolveMarket(
  marketId: string,
  outcome: MarketOutcome,
  evidence: string
): Promise<ConvictionMarket> {
  if (!isSupabaseConfigured) {
    throw new Error('Database not configured');
  }

  const market = await getMarketById(marketId);
  if (!market) {
    const error: ConvictionError = {
      code: CONVICTION_ERROR_CODES.MARKET_NOT_FOUND,
      message: 'Market not found',
    };
    throw error;
  }

  if (market.status === 'resolved') {
    const error: ConvictionError = {
      code: CONVICTION_ERROR_CODES.MARKET_ALREADY_RESOLVED,
      message: 'Market is already resolved',
    };
    throw error;
  }

  // Update market
  const { data, error } = await supabaseAdmin
    .from('conviction_markets')
    .update({
      outcome,
      resolution_evidence: evidence,
      resolved_at: new Date().toISOString(),
      status: 'resolved',
      updated_at: new Date().toISOString(),
    })
    .eq('id', marketId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  const resolvedMarket = rowToMarket(data as ConvictionMarketRow);

  // Update project metrics
  const project = await getProjectById(market.projectId);
  if (project) {
    const allMarkets = await getMarketsByProject(market.projectId, { status: 'resolved' });
    const successCount = allMarkets.filter(
      (m) =>
        m.outcome === 'yes' && m.projectStake.position === 'yes' ||
        m.outcome === 'no' && m.projectStake.position === 'no'
    ).length;

    const successRate = allMarkets.length > 0
      ? (successCount / allMarkets.length) * 100
      : 0;

    // Recalculate conviction score
    const newScore = await calculateConvictionScore(project.id);

    await updateProjectMetrics(market.projectId, {
      marketsResolved: project.marketsResolved + 1,
      successRate,
      convictionScore: newScore.overall,
    });
  }

  return resolvedMarket;
}

/**
 * Close markets that have passed resolution date
 */
export async function closeExpiredMarkets(): Promise<number> {
  if (!isSupabaseConfigured) {
    return 0;
  }

  const now = new Date();

  const { data, error } = await supabaseAdmin
    .from('conviction_markets')
    .update({
      status: 'closed',
      updated_at: now.toISOString(),
    })
    .eq('status', 'active')
    .lt('resolution_date', now.toISOString())
    .select();

  if (error) {
    throw error;
  }

  return data?.length || 0;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate escrow address for a market
 * In production, this would be a PDA derived from the market ID
 */
function generateEscrowAddress(marketId: string): string {
  // For MVP, return a placeholder
  // In production: derive PDA from program + market ID
  return `escrow_${marketId.substring(0, 8)}`;
}

/**
 * Get market statistics
 */
export async function getMarketStats(): Promise<{
  totalMarkets: number;
  activeMarkets: number;
  resolvedMarkets: number;
  totalVolume: number;
  totalStaked: number;
}> {
  if (!isSupabaseConfigured) {
    return {
      totalMarkets: 0,
      activeMarkets: 0,
      resolvedMarkets: 0,
      totalVolume: 0,
      totalStaked: 0,
    };
  }

  // Get counts by status
  const { data: statusCounts } = await supabaseAdmin
    .from('conviction_markets')
    .select('status')
    .not('status', 'is', null);

  const counts = {
    total: statusCounts?.length || 0,
    active: statusCounts?.filter((r) => r.status === 'active').length || 0,
    resolved: statusCounts?.filter((r) => r.status === 'resolved').length || 0,
  };

  // Get aggregates
  const { data: aggregates } = await supabaseAdmin
    .from('conviction_markets')
    .select('volume, project_stake_amount');

  const totalVolume = aggregates?.reduce((sum, r) => sum + (r.volume || 0), 0) || 0;
  const totalStaked = aggregates?.reduce((sum, r) => sum + (r.project_stake_amount || 0), 0) || 0;

  return {
    totalMarkets: counts.total,
    activeMarkets: counts.active,
    resolvedMarkets: counts.resolved,
    totalVolume,
    totalStaked,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const markets = {
  create: createMarket,
  getById: getMarketById,
  list: listMarkets,
  getByProject: getMarketsByProject,
  getActive: getActiveMarkets,
  getClosingSoon: getClosingSoonMarkets,
  recordStake: recordProjectStake,
  updatePrices: updateMarketPrices,
  resolve: resolveMarket,
  closeExpired: closeExpiredMarkets,
  getStats: getMarketStats,
};
