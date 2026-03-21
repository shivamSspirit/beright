/**
 * BeRight Delegation Database Queries
 *
 * Supabase queries for forecaster pools and delegations.
 */

import { supabaseAdmin, isSupabaseConfigured } from '../supabase/client';
import type {
  ForecasterPoolRow,
  PoolDelegationRow,
  NavHistoryRow,
  PoolTransactionRow,
  PoolSummary,
  PoolDetails,
  DelegationSummary,
  PoolFilterOptions,
  OnChainPoolStatus,
  ForecasterTier,
} from './types';

// ============================================================================
// Pool Queries
// ============================================================================

/**
 * Get pool by ID
 */
export async function getPoolById(poolId: string): Promise<ForecasterPoolRow | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabaseAdmin
    .from('forecaster_pools')
    .select('*')
    .eq('id', poolId)
    .single();

  if (error || !data) return null;
  return data as ForecasterPoolRow;
}

/**
 * Get pool by PDA
 */
export async function getPoolByPda(poolPda: string): Promise<ForecasterPoolRow | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabaseAdmin
    .from('forecaster_pools')
    .select('*')
    .eq('pool_pda', poolPda)
    .single();

  if (error || !data) return null;
  return data as ForecasterPoolRow;
}

/**
 * Get pool by slug
 */
export async function getPoolBySlug(slug: string): Promise<ForecasterPoolRow | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabaseAdmin
    .from('forecaster_pools')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) return null;
  return data as ForecasterPoolRow;
}

/**
 * List pools with filters
 */
export async function listPools(
  options: PoolFilterOptions = {}
): Promise<PoolSummary[]> {
  if (!isSupabaseConfigured) return [];

  let query = supabaseAdmin
    .from('forecaster_pools')
    .select(`
      id,
      pool_pda,
      slug,
      name,
      forecaster_wallet,
      forecaster_tier,
      forecaster_brier,
      status,
      total_deposits,
      nav_per_share,
      depositor_count,
      performance_fee_bps,
      created_at
    `);

  // Apply filters
  if (options.status) {
    const statuses = Array.isArray(options.status) ? options.status : [options.status];
    query = query.in('status', statuses);
  }

  if (options.tier) {
    const tiers = Array.isArray(options.tier) ? options.tier : [options.tier];
    query = query.in('forecaster_tier', tiers);
  }

  if (options.minTvl !== undefined) {
    query = query.gte('total_deposits', options.minTvl * 1_000000);
  }

  if (options.maxTvl !== undefined) {
    query = query.lte('total_deposits', options.maxTvl * 1_000000);
  }

  // Apply sorting
  const sortColumn = mapSortColumn(options.sortBy || 'tvl');
  const ascending = options.sortOrder === 'asc';
  query = query.order(sortColumn, { ascending });

  // Apply pagination
  const limit = options.limit || 20;
  const offset = options.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error || !data) return [];

  return (data as any[]).map(mapToPoolSummary);
}

/**
 * Get pools by forecaster wallet
 */
export async function getPoolsByForecaster(
  forecasterWallet: string
): Promise<PoolSummary[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabaseAdmin
    .from('forecaster_pools')
    .select(`
      id,
      pool_pda,
      slug,
      name,
      forecaster_wallet,
      forecaster_tier,
      forecaster_brier,
      status,
      total_deposits,
      nav_per_share,
      depositor_count,
      performance_fee_bps,
      created_at
    `)
    .eq('forecaster_wallet', forecasterWallet)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return (data as any[]).map(mapToPoolSummary);
}

/**
 * Get pool details with NAV history
 */
export async function getPoolDetails(poolId: string): Promise<PoolDetails | null> {
  if (!isSupabaseConfigured) return null;

  const { data: poolData, error: poolError } = await supabaseAdmin
    .from('forecaster_pools')
    .select('*')
    .eq('id', poolId)
    .single();

  if (poolError || !poolData) return null;

  // Get NAV history
  const { data: navData } = await supabaseAdmin
    .from('pool_nav_history')
    .select('nav_per_share, recorded_at')
    .eq('pool_id', poolId)
    .order('recorded_at', { ascending: true })
    .limit(100);

  const pool = poolData as ForecasterPoolRow;
  const navHistory = (navData || []).map((row: any) => ({
    timestamp: new Date(row.recorded_at),
    nav: Number(row.nav_per_share) / 1e9,
  }));

  return mapToPoolDetails(pool, navHistory);
}

/**
 * Create or update pool record
 */
export async function upsertPool(
  pool: Partial<ForecasterPoolRow> & { pool_pda: string }
): Promise<ForecasterPoolRow | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabaseAdmin
    .from('forecaster_pools')
    .upsert(pool, { onConflict: 'pool_pda' })
    .select()
    .single();

  if (error) {
    console.error('[DB] Failed to upsert pool:', error.message);
    return null;
  }

  return data as ForecasterPoolRow;
}

/**
 * Update pool status
 */
export async function updatePoolStatus(
  poolId: string,
  status: OnChainPoolStatus
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const { error } = await supabaseAdmin
    .from('forecaster_pools')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', poolId);

  return !error;
}

// ============================================================================
// Delegation Queries
// ============================================================================

/**
 * Get delegation by pool and wallet
 */
export async function getDelegation(
  poolId: string,
  delegatorWallet: string
): Promise<PoolDelegationRow | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabaseAdmin
    .from('pool_delegations')
    .select('*')
    .eq('pool_id', poolId)
    .eq('delegator_wallet', delegatorWallet)
    .single();

  if (error || !data) return null;
  return data as PoolDelegationRow;
}

/**
 * Get all delegations for a pool
 */
export async function getPoolDelegations(
  poolId: string
): Promise<PoolDelegationRow[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabaseAdmin
    .from('pool_delegations')
    .select('*')
    .eq('pool_id', poolId)
    .gt('shares', 0)
    .order('deposited_amount', { ascending: false });

  if (error || !data) return [];
  return data as PoolDelegationRow[];
}

/**
 * Get all delegations for a wallet
 */
export async function getDelegationsForWallet(
  delegatorWallet: string
): Promise<DelegationSummary[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabaseAdmin
    .from('pool_delegations')
    .select(`
      id,
      pool_id,
      depositor_pda,
      shares,
      deposited_amount,
      current_value,
      unrealized_pnl,
      withdrawal_requested,
      withdrawable_after,
      forecaster_pools (
        pool_pda,
        name,
        nav_per_share
      )
    `)
    .eq('delegator_wallet', delegatorWallet)
    .gt('shares', 0);

  if (error || !data) return [];

  return (data as any[]).map((row) => {
    const pool = row.forecaster_pools;
    const shares = Number(row.shares);
    const deposited = Number(row.deposited_amount) / 1e6;
    const currentValue = Number(row.current_value || 0) / 1e6;
    const pnl = currentValue - deposited;
    const pnlPercent = deposited > 0 ? (pnl / deposited) * 100 : 0;

    return {
      poolId: row.pool_id,
      poolPda: pool?.pool_pda || '',
      poolName: pool?.name || null,
      shares,
      depositedAmount: deposited,
      currentValue,
      pnl,
      pnlPercent,
      hasWithdrawalPending: Number(row.withdrawal_requested || 0) > 0,
      withdrawableAfter: row.withdrawable_after
        ? new Date(row.withdrawable_after)
        : null,
    };
  });
}

/**
 * Upsert delegation record
 */
export async function upsertDelegation(
  delegation: Partial<PoolDelegationRow> & { pool_id: string; delegator_wallet: string }
): Promise<PoolDelegationRow | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabaseAdmin
    .from('pool_delegations')
    .upsert(delegation, { onConflict: 'pool_id,delegator_wallet' })
    .select()
    .single();

  if (error) {
    console.error('[DB] Failed to upsert delegation:', error.message);
    return null;
  }

  return data as PoolDelegationRow;
}

// ============================================================================
// NAV History
// ============================================================================

/**
 * Record NAV snapshot
 */
export async function recordNavSnapshot(
  poolId: string,
  navPerShare: bigint,
  totalValue: bigint
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const { error } = await supabaseAdmin.from('pool_nav_history').insert({
    pool_id: poolId,
    nav_per_share: navPerShare.toString(),
    total_value: totalValue.toString(),
  });

  return !error;
}

/**
 * Get NAV history for a pool
 */
export async function getNavHistory(
  poolId: string,
  limit: number = 100
): Promise<NavHistoryRow[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabaseAdmin
    .from('pool_nav_history')
    .select('*')
    .eq('pool_id', poolId)
    .order('recorded_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as NavHistoryRow[];
}

// ============================================================================
// Transactions
// ============================================================================

/**
 * Record pool transaction
 */
export async function recordTransaction(
  tx: Omit<PoolTransactionRow, 'id' | 'created_at'>
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const { error } = await supabaseAdmin.from('pool_transactions').insert(tx);

  return !error;
}

/**
 * Get pool transactions
 */
export async function getPoolTransactions(
  poolId: string,
  limit: number = 50
): Promise<PoolTransactionRow[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabaseAdmin
    .from('pool_transactions')
    .select('*')
    .eq('pool_id', poolId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as PoolTransactionRow[];
}

// ============================================================================
// Helpers
// ============================================================================

function mapSortColumn(sortBy: string): string {
  const mapping: Record<string, string> = {
    tvl: 'total_deposits',
    nav: 'nav_per_share',
    delegators: 'depositor_count',
    created: 'created_at',
    brier: 'forecaster_brier',
  };
  return mapping[sortBy] || 'total_deposits';
}

function mapToPoolSummary(row: any): PoolSummary {
  return {
    id: row.id,
    poolPda: row.pool_pda,
    slug: row.slug,
    name: row.name,
    forecasterWallet: row.forecaster_wallet,
    forecasterTier: (row.forecaster_tier || 'unranked') as ForecasterTier,
    forecasterBrier: row.forecaster_brier,
    status: (row.status || 'pending') as OnChainPoolStatus,
    tvl: Number(row.total_deposits || 0) / 1e6,
    navPerShare: Number(row.nav_per_share || 1e9) / 1e9,
    delegatorCount: row.depositor_count || 0,
    performanceFeeBps: row.performance_fee_bps,
    createdAt: new Date(row.created_at),
  };
}

function mapToPoolDetails(
  pool: ForecasterPoolRow,
  navHistory: { timestamp: Date; nav: number }[]
): PoolDetails {
  return {
    id: pool.id,
    poolPda: pool.pool_pda,
    slug: pool.slug,
    name: pool.name,
    description: pool.description,
    forecasterWallet: pool.forecaster_wallet,
    forecasterTier: (pool.forecaster_tier || 'unranked') as ForecasterTier,
    forecasterBrier: pool.forecaster_brier,
    forecasterPredictions: pool.forecaster_predictions,
    status: (pool.status || 'pending') as OnChainPoolStatus,
    tvl: Number(pool.total_deposits || 0) / 1e6,
    navPerShare: Number(pool.nav_per_share || 1e9) / 1e9,
    delegatorCount: pool.depositor_count || 0,
    baseToken: pool.base_token,
    minDeposit: Number(pool.min_deposit) / 1e6,
    maxCapacity: Number(pool.max_capacity) / 1e6,
    performanceFeeBps: pool.performance_fee_bps,
    managementFeeBps: pool.management_fee_bps,
    entryFeeBps: pool.entry_fee_bps || 0,
    exitFeeBps: pool.exit_fee_bps || 25,
    highWaterMark: Number(pool.high_water_mark || 1e9) / 1e9,
    createdAt: new Date(pool.created_at),
    activatedAt: pool.activated_at ? new Date(pool.activated_at) : null,
    navHistory,
  };
}
