/**
 * Yield Tracker
 *
 * Tracks deposits, withdrawals, and yield in Supabase for accurate
 * yield calculation and historical analysis.
 */

import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/client';
import type { VaultToken, YieldProtocol } from '../types';
import type {
  YieldDeposit,
  YieldWithdrawal,
  YieldPosition,
  YieldSnapshot,
  DepositHistoryQuery,
  UserYieldSummary,
  PoolYieldSummary,
} from './types';

// ============================================================================
// Deposit Tracking
// ============================================================================

/**
 * Record a new deposit
 */
export async function recordDeposit(deposit: {
  pool_id: string;
  depositor: string;
  token: VaultToken;
  protocol: YieldProtocol;
  amount: bigint;
  lp_tokens_received: bigint;
  virtual_price_at_deposit: number;
  tx_signature?: string;
}): Promise<YieldDeposit | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured, deposit not tracked');
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('yield_deposits')
    .insert({
      pool_id: deposit.pool_id,
      depositor: deposit.depositor,
      token: deposit.token,
      protocol: deposit.protocol,
      amount: deposit.amount.toString(),
      lp_tokens_received: deposit.lp_tokens_received.toString(),
      virtual_price_at_deposit: deposit.virtual_price_at_deposit,
      tx_signature: deposit.tx_signature,
      status: deposit.tx_signature ? 'confirmed' : 'pending',
      confirmed_at: deposit.tx_signature ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to record deposit:', error);
    return null;
  }

  // Update position
  await updatePosition(deposit.pool_id, deposit.depositor, deposit.token, deposit.protocol);

  return data as YieldDeposit;
}

/**
 * Confirm a pending deposit
 */
export async function confirmDeposit(
  depositId: string,
  txSignature: string
): Promise<YieldDeposit | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabaseAdmin
    .from('yield_deposits')
    .update({
      tx_signature: txSignature,
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', depositId)
    .select()
    .single();

  if (error) {
    console.error('Failed to confirm deposit:', error);
    return null;
  }

  return data as YieldDeposit;
}

/**
 * Get deposit history
 */
export async function getDepositHistory(
  query: DepositHistoryQuery
): Promise<YieldDeposit[]> {
  if (!isSupabaseConfigured) return [];

  let q = supabaseAdmin
    .from('yield_deposits')
    .select('*')
    .order('created_at', { ascending: false });

  if (query.pool_id) q = q.eq('pool_id', query.pool_id);
  if (query.user) q = q.eq('depositor', query.user);
  if (query.token) q = q.eq('token', query.token);
  if (query.status) q = q.eq('status', query.status);
  if (query.from_date) q = q.gte('created_at', query.from_date);
  if (query.to_date) q = q.lte('created_at', query.to_date);
  if (query.limit) q = q.limit(query.limit);
  if (query.offset) q = q.range(query.offset, query.offset + (query.limit || 50) - 1);

  const { data, error } = await q;
  if (error) {
    console.error('Failed to get deposit history:', error);
    return [];
  }

  return (data || []) as YieldDeposit[];
}

// ============================================================================
// Withdrawal Tracking
// ============================================================================

/**
 * Record a withdrawal
 */
export async function recordWithdrawal(withdrawal: {
  pool_id: string;
  withdrawer: string;
  token: VaultToken;
  protocol: YieldProtocol;
  amount_requested: bigint;
  amount_received: bigint;
  lp_tokens_burned: bigint;
  virtual_price_at_withdrawal: number;
  yield_realized: bigint;
  tx_signature?: string;
}): Promise<YieldWithdrawal | null> {
  if (!isSupabaseConfigured) return null;

  // Calculate yield percent
  const yieldPercent = withdrawal.amount_requested > 0n
    ? (Number(withdrawal.yield_realized) / Number(withdrawal.amount_requested)) * 100
    : 0;

  const { data, error } = await supabaseAdmin
    .from('yield_withdrawals')
    .insert({
      pool_id: withdrawal.pool_id,
      withdrawer: withdrawal.withdrawer,
      token: withdrawal.token,
      protocol: withdrawal.protocol,
      amount_requested: withdrawal.amount_requested.toString(),
      amount_received: withdrawal.amount_received.toString(),
      lp_tokens_burned: withdrawal.lp_tokens_burned.toString(),
      virtual_price_at_withdrawal: withdrawal.virtual_price_at_withdrawal,
      yield_realized: withdrawal.yield_realized.toString(),
      yield_percent: yieldPercent,
      tx_signature: withdrawal.tx_signature,
      status: withdrawal.tx_signature ? 'confirmed' : 'pending',
      confirmed_at: withdrawal.tx_signature ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to record withdrawal:', error);
    return null;
  }

  // Update position
  await updatePosition(
    withdrawal.pool_id,
    withdrawal.withdrawer,
    withdrawal.token,
    withdrawal.protocol
  );

  return data as YieldWithdrawal;
}

/**
 * Get withdrawal history
 */
export async function getWithdrawalHistory(
  query: DepositHistoryQuery
): Promise<YieldWithdrawal[]> {
  if (!isSupabaseConfigured) return [];

  let q = supabaseAdmin
    .from('yield_withdrawals')
    .select('*')
    .order('created_at', { ascending: false });

  if (query.pool_id) q = q.eq('pool_id', query.pool_id);
  if (query.user) q = q.eq('withdrawer', query.user);
  if (query.token) q = q.eq('token', query.token);
  if (query.status) q = q.eq('status', query.status);
  if (query.from_date) q = q.gte('created_at', query.from_date);
  if (query.to_date) q = q.lte('created_at', query.to_date);
  if (query.limit) q = q.limit(query.limit);

  const { data, error } = await q;
  if (error) return [];

  return (data || []) as YieldWithdrawal[];
}

// ============================================================================
// Position Tracking
// ============================================================================

/**
 * Get or create a yield position
 */
export async function getPosition(
  poolId: string,
  user: string,
  token: VaultToken,
  protocol: YieldProtocol
): Promise<YieldPosition | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabaseAdmin
    .from('yield_positions')
    .select('*')
    .eq('pool_id', poolId)
    .eq('user', user)
    .eq('token', token)
    .eq('protocol', protocol)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Failed to get position:', error);
    return null;
  }

  return data as YieldPosition | null;
}

/**
 * Update position based on deposit/withdrawal history
 */
export async function updatePosition(
  poolId: string,
  user: string,
  token: VaultToken,
  protocol: YieldProtocol
): Promise<YieldPosition | null> {
  if (!isSupabaseConfigured) return null;

  // Get all deposits
  const { data: deposits } = await supabaseAdmin
    .from('yield_deposits')
    .select('*')
    .eq('pool_id', poolId)
    .eq('depositor', user)
    .eq('status', 'confirmed');

  // Get all withdrawals
  const { data: withdrawals } = await supabaseAdmin
    .from('yield_withdrawals')
    .select('*')
    .eq('pool_id', poolId)
    .eq('withdrawer', user)
    .eq('status', 'confirmed');

  const depositList = (deposits || []) as YieldDeposit[];
  const withdrawalList = (withdrawals || []) as YieldWithdrawal[];

  // Calculate totals
  let totalDeposited = 0n;
  let totalLpReceived = 0n;
  let weightedPriceSum = 0;

  for (const d of depositList) {
    const amount = BigInt(d.amount);
    totalDeposited += amount;
    totalLpReceived += BigInt(d.lp_tokens_received);
    weightedPriceSum += Number(amount) * d.virtual_price_at_deposit;
  }

  let totalWithdrawn = 0n;
  let totalLpBurned = 0n;
  let totalYieldRealized = 0n;

  for (const w of withdrawalList) {
    totalWithdrawn += BigInt(w.amount_received);
    totalLpBurned += BigInt(w.lp_tokens_burned);
    totalYieldRealized += BigInt(w.yield_realized);
  }

  const currentLpBalance = totalLpReceived - totalLpBurned;
  const avgEntryPrice = totalDeposited > 0n
    ? weightedPriceSum / Number(totalDeposited)
    : 1.0;

  // Get first deposit date
  const firstDeposit = depositList.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )[0];

  // Upsert position
  const { data, error } = await supabaseAdmin
    .from('yield_positions')
    .upsert(
      {
        pool_id: poolId,
        user,
        token,
        protocol,
        total_deposited: totalDeposited.toString(),
        total_withdrawn: totalWithdrawn.toString(),
        current_lp_balance: currentLpBalance.toString(),
        current_value: '0', // Updated by refresh job
        total_yield_earned: totalYieldRealized.toString(),
        unrealized_yield: '0', // Updated by refresh job
        avg_entry_price: avgEntryPrice,
        deposit_count: depositList.length,
        withdrawal_count: withdrawalList.length,
        first_deposit_at: firstDeposit?.created_at || new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'pool_id,user,token,protocol' }
    )
    .select()
    .single();

  if (error) {
    console.error('Failed to update position:', error);
    return null;
  }

  return data as YieldPosition;
}

/**
 * Refresh position values with current virtual price
 */
export async function refreshPositionValue(
  poolId: string,
  user: string,
  currentVirtualPrice: number
): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { data: position } = await supabaseAdmin
    .from('yield_positions')
    .select('*')
    .eq('pool_id', poolId)
    .eq('user', user)
    .single();

  if (!position) return;

  const lpBalance = BigInt(position.current_lp_balance);
  const currentValue = BigInt(Math.floor(Number(lpBalance) * currentVirtualPrice));

  // Calculate unrealized yield
  const deposited = BigInt(position.total_deposited);
  const withdrawn = BigInt(position.total_withdrawn);
  const yieldRealized = BigInt(position.total_yield_earned);
  const costBasis = deposited - withdrawn - yieldRealized;
  const unrealizedYield = currentValue > costBasis ? currentValue - costBasis : 0n;

  await supabaseAdmin
    .from('yield_positions')
    .update({
      current_value: currentValue.toString(),
      unrealized_yield: unrealizedYield.toString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', position.id);
}

/**
 * Get all positions for a user
 */
export async function getUserPositions(user: string): Promise<YieldPosition[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabaseAdmin
    .from('yield_positions')
    .select('*')
    .eq('user', user)
    .gt('current_lp_balance', '0')
    .order('last_activity_at', { ascending: false });

  if (error) return [];
  return (data || []) as YieldPosition[];
}

/**
 * Get all positions for a pool
 */
export async function getPoolPositions(poolId: string): Promise<YieldPosition[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabaseAdmin
    .from('yield_positions')
    .select('*')
    .eq('pool_id', poolId)
    .gt('current_lp_balance', '0')
    .order('current_value', { ascending: false });

  if (error) return [];
  return (data || []) as YieldPosition[];
}

// ============================================================================
// Yield Summaries
// ============================================================================

/**
 * Get yield summary for a user
 */
export async function getUserYieldSummary(user: string): Promise<UserYieldSummary | null> {
  const positions = await getUserPositions(user);
  if (positions.length === 0) return null;

  let totalDeposited = 0n;
  let totalWithdrawn = 0n;
  let currentValue = 0n;
  let totalYieldEarned = 0n;
  let unrealizedYield = 0n;

  for (const p of positions) {
    totalDeposited += BigInt(p.total_deposited);
    totalWithdrawn += BigInt(p.total_withdrawn);
    currentValue += BigInt(p.current_value);
    totalYieldEarned += BigInt(p.total_yield_earned);
    unrealizedYield += BigInt(p.unrealized_yield);
  }

  const netDeposited = totalDeposited - totalWithdrawn;
  const overallYieldPercent = netDeposited > 0n
    ? (Number(totalYieldEarned + unrealizedYield) / Number(netDeposited)) * 100
    : 0;

  return {
    user,
    total_deposited: totalDeposited.toString(),
    total_withdrawn: totalWithdrawn.toString(),
    current_value: currentValue.toString(),
    total_yield_earned: totalYieldEarned.toString(),
    unrealized_yield: unrealizedYield.toString(),
    overall_yield_percent: overallYieldPercent,
    positions,
  };
}

/**
 * Get yield summary for a pool
 */
export async function getPoolYieldSummary(
  poolId: string,
  token: VaultToken
): Promise<PoolYieldSummary | null> {
  const positions = await getPoolPositions(poolId);
  if (positions.length === 0) return null;

  let totalTvl = 0n;
  let totalYieldDistributed = 0n;

  for (const p of positions) {
    totalTvl += BigInt(p.current_value);
    totalYieldDistributed += BigInt(p.total_yield_earned);
  }

  const avgYieldPerDepositor = positions.length > 0
    ? totalYieldDistributed / BigInt(positions.length)
    : 0n;

  return {
    pool_id: poolId,
    token,
    total_tvl: totalTvl.toString(),
    total_yield_distributed: totalYieldDistributed.toString(),
    current_apy: 0, // Filled by caller
    depositor_count: positions.length,
    avg_yield_per_depositor: avgYieldPerDepositor.toString(),
  };
}

// ============================================================================
// Yield Snapshots
// ============================================================================

/**
 * Record daily yield snapshot
 */
export async function recordYieldSnapshot(snapshot: {
  pool_id: string;
  token: VaultToken;
  protocol: YieldProtocol;
  total_deposited: bigint;
  total_lp_supply: bigint;
  virtual_price: number;
  daily_yield: bigint;
  cumulative_yield: bigint;
  apy_7d: number;
  apy_30d: number;
  apy_all_time: number;
}): Promise<YieldSnapshot | null> {
  if (!isSupabaseConfigured) return null;

  const today = new Date().toISOString().split('T')[0];
  const dailyYieldPercent = snapshot.total_deposited > 0n
    ? (Number(snapshot.daily_yield) / Number(snapshot.total_deposited)) * 100
    : 0;

  const { data, error } = await supabaseAdmin
    .from('yield_snapshots')
    .upsert(
      {
        pool_id: snapshot.pool_id,
        token: snapshot.token,
        protocol: snapshot.protocol,
        snapshot_date: today,
        total_deposited: snapshot.total_deposited.toString(),
        total_lp_supply: snapshot.total_lp_supply.toString(),
        virtual_price: snapshot.virtual_price,
        daily_yield: snapshot.daily_yield.toString(),
        daily_yield_percent: dailyYieldPercent,
        cumulative_yield: snapshot.cumulative_yield.toString(),
        apy_7d: snapshot.apy_7d,
        apy_30d: snapshot.apy_30d,
        apy_all_time: snapshot.apy_all_time,
      },
      { onConflict: 'pool_id,snapshot_date' }
    )
    .select()
    .single();

  if (error) {
    console.error('Failed to record snapshot:', error);
    return null;
  }

  return data as YieldSnapshot;
}

/**
 * Get historical yield snapshots
 */
export async function getYieldSnapshots(
  poolId: string,
  days: number = 30
): Promise<YieldSnapshot[]> {
  if (!isSupabaseConfigured) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabaseAdmin
    .from('yield_snapshots')
    .select('*')
    .eq('pool_id', poolId)
    .gte('snapshot_date', startDate.toISOString().split('T')[0])
    .order('snapshot_date', { ascending: true });

  if (error) return [];
  return (data || []) as YieldSnapshot[];
}

/**
 * Calculate APY from virtual price history
 */
export function calculateAPYFromSnapshots(
  snapshots: YieldSnapshot[],
  days: number
): number {
  if (snapshots.length < 2) return 0;

  // Get first and last snapshot
  const sortedSnapshots = [...snapshots].sort(
    (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
  );

  const firstSnapshot = sortedSnapshots[0];
  const lastSnapshot = sortedSnapshots[sortedSnapshots.length - 1];

  const priceChange = lastSnapshot.virtual_price / firstSnapshot.virtual_price - 1;
  const actualDays = Math.max(
    1,
    (new Date(lastSnapshot.snapshot_date).getTime() -
      new Date(firstSnapshot.snapshot_date).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  // Annualize
  const annualizedReturn = Math.pow(1 + priceChange, 365 / actualDays) - 1;
  return annualizedReturn;
}
