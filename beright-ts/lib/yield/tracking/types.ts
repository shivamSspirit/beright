/**
 * Yield Tracking Types
 *
 * Types for tracking deposits, withdrawals, and yield in Supabase.
 * Enables accurate yield calculation and historical analysis.
 */

import type { VaultToken, YieldProtocol } from '../types';

// ============================================================================
// Deposit Tracking
// ============================================================================

/**
 * A single deposit record
 */
export interface YieldDeposit {
  id: string;
  pool_id: string;
  depositor: string;               // Wallet pubkey
  token: VaultToken;
  protocol: YieldProtocol;

  // Amounts
  amount: string;                  // Base units as string (bigint)
  lp_tokens_received: string;
  virtual_price_at_deposit: number;

  // Transaction
  tx_signature?: string;
  block_time?: string;

  // Status
  status: 'pending' | 'confirmed' | 'failed';

  // Timestamps
  created_at: string;
  confirmed_at?: string;
}

/**
 * A single withdrawal record
 */
export interface YieldWithdrawal {
  id: string;
  pool_id: string;
  withdrawer: string;
  token: VaultToken;
  protocol: YieldProtocol;

  // Amounts
  amount_requested: string;
  amount_received: string;
  lp_tokens_burned: string;
  virtual_price_at_withdrawal: number;

  // Yield calculation
  yield_realized: string;
  yield_percent: number;

  // Transaction
  tx_signature?: string;
  block_time?: string;

  // Status
  status: 'pending' | 'confirmed' | 'failed';

  // Timestamps
  created_at: string;
  confirmed_at?: string;
}

/**
 * Aggregated position for a user in a pool
 */
export interface YieldPosition {
  id: string;
  pool_id: string;
  user: string;
  token: VaultToken;
  protocol: YieldProtocol;

  // Current state
  total_deposited: string;         // Sum of all deposits
  total_withdrawn: string;         // Sum of all withdrawals
  current_lp_balance: string;      // Current LP tokens held
  current_value: string;           // Current value in underlying

  // Yield metrics
  total_yield_earned: string;      // Lifetime yield
  unrealized_yield: string;        // Yield not yet withdrawn
  avg_entry_price: number;         // Weighted average entry virtual price

  // Stats
  deposit_count: number;
  withdrawal_count: number;
  first_deposit_at: string;
  last_activity_at: string;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Daily yield snapshot for a pool
 */
export interface YieldSnapshot {
  id: string;
  pool_id: string;
  token: VaultToken;
  protocol: YieldProtocol;
  snapshot_date: string;           // YYYY-MM-DD

  // Pool state
  total_deposited: string;
  total_lp_supply: string;
  virtual_price: number;

  // Daily metrics
  daily_yield: string;
  daily_yield_percent: number;
  cumulative_yield: string;

  // APY calculation
  apy_7d: number;
  apy_30d: number;
  apy_all_time: number;

  // Timestamps
  created_at: string;
}

/**
 * Vault health metrics
 */
export interface VaultHealthMetrics {
  id: string;
  token: VaultToken;
  protocol: YieldProtocol;

  // Health indicators
  status: 'healthy' | 'degraded' | 'critical';
  withdrawable_amount: string;
  total_tvl: string;
  utilization_rate: number;        // % of capital in lending protocols

  // Risk metrics
  largest_strategy_allocation: number; // % in single strategy
  strategy_count: number;
  staleness_seconds: number;

  // Performance
  current_apy: number;
  virtual_price: number;
  price_change_24h: number;

  // Alerts
  alerts: string[];

  // Timestamps
  checked_at: string;
  created_at: string;
}

// ============================================================================
// Affiliate Tracking
// ============================================================================

/**
 * Affiliate partnership record
 */
export interface AffiliatePartnership {
  id: string;
  protocol: YieldProtocol;
  affiliate_id: string;            // On-chain affiliate ID
  partner_name: string;

  // Fee sharing
  fee_share_bps: number;           // Basis points of fees shared
  total_fees_earned: string;
  total_volume_routed: string;

  // Status
  status: 'pending' | 'active' | 'paused';
  verified_at?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Rebalance Tracking
// ============================================================================

/**
 * Rebalance event record
 */
export interface RebalanceEvent {
  id: string;
  pool_id: string;
  token: VaultToken;

  // Before state
  yield_bps_before: number;
  reserve_bps_before: number;
  active_bps_before: number;

  // After state
  yield_bps_after: number;
  reserve_bps_after: number;
  active_bps_after: number;

  // Actions taken
  actions: RebalanceActionRecord[];

  // Trigger
  trigger_reason: 'drift' | 'withdrawal' | 'deposit' | 'manual';
  triggered_by?: string;

  // Transaction
  tx_signature?: string;
  status: 'pending' | 'completed' | 'failed';

  // Timestamps
  created_at: string;
  completed_at?: string;
}

/**
 * Single rebalance action
 */
export interface RebalanceActionRecord {
  type: 'deposit_yield' | 'withdraw_yield' | 'move_to_reserve';
  amount: string;
  tx_signature?: string;
  status: 'pending' | 'completed' | 'failed';
}

// ============================================================================
// Query Types
// ============================================================================

/**
 * Deposit history query options
 */
export interface DepositHistoryQuery {
  pool_id?: string;
  user?: string;
  token?: VaultToken;
  status?: 'pending' | 'confirmed' | 'failed';
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}

/**
 * Yield summary for a user
 */
export interface UserYieldSummary {
  user: string;
  total_deposited: string;
  total_withdrawn: string;
  current_value: string;
  total_yield_earned: string;
  unrealized_yield: string;
  overall_yield_percent: number;
  positions: YieldPosition[];
}

/**
 * Pool yield summary
 */
export interface PoolYieldSummary {
  pool_id: string;
  token: VaultToken;
  total_tvl: string;
  total_yield_distributed: string;
  current_apy: number;
  depositor_count: number;
  avg_yield_per_depositor: string;
}
