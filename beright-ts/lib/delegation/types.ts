/**
 * BeRight Delegation Pool Types
 *
 * Type definitions for the forecaster delegation system.
 * Maps to on-chain state from staking-pool program.
 */

import type { PublicKey } from '@solana/web3.js';

// ============================================================================
// Forecaster Tier System
// ============================================================================

/**
 * Forecaster tier based on Brier score and prediction count.
 * Maps to on-chain ForecasterTier enum.
 */
export type ForecasterTier = 'unranked' | 'rookie' | 'verified' | 'elite' | 'super';

/**
 * Tier requirements and capacity limits
 */
export interface TierRequirements {
  maxBrier: number;
  minPredictions: number;
  capacity: number; // USD
}

/**
 * Tier configuration
 */
export const TIER_REQUIREMENTS: Record<ForecasterTier, TierRequirements> = {
  super: { maxBrier: 0.12, minPredictions: 100, capacity: Infinity },
  elite: { maxBrier: 0.18, minPredictions: 50, capacity: 1_000_000 },
  verified: { maxBrier: 0.25, minPredictions: 20, capacity: 100_000 },
  rookie: { maxBrier: 1.0, minPredictions: 0, capacity: 10_000 }, // TODO: Restore to 10 for production
  unranked: { maxBrier: 1.0, minPredictions: 0, capacity: 0 },
};

/**
 * Eligibility check result
 */
export interface EligibilityResult {
  eligible: boolean;
  tier: ForecasterTier;
  maxCapacity: number;
  brierScore: number | null;
  predictionCount: number;
  reason?: string;
}

// ============================================================================
// On-Chain State Types
// ============================================================================

/**
 * Pool type enum (maps to on-chain PoolType)
 */
export type OnChainPoolType = 'tournament' | 'alpha_vault' | 'index_pool';

/**
 * Pool status (mirrors on-chain)
 */
export type OnChainPoolStatus =
  | 'pending'
  | 'open'
  | 'active'
  | 'paused'
  | 'settling'
  | 'closed';

/**
 * On-chain pool configuration
 */
export interface OnChainPoolConfig {
  performanceFeeBps: number;
  managementFeeBps: number;
  entryFeeBps: number;
  exitFeeBps: number;
  withdrawalDelay: number; // seconds
  maxCapacity: bigint;
  minDeposit: bigint;
  idleAllocationBps: number;
}

/**
 * On-chain staking pool state (mirrors StakingPoolState)
 */
export interface OnChainPoolState {
  // Core identifiers
  poolPda: PublicKey;
  poolMint: PublicKey;
  baseTokenMint: PublicKey;
  poolBaseTokenAccount: PublicKey;

  // Ownership
  forecaster: PublicKey;
  forecasterTier: ForecasterTier;

  // Configuration
  poolType: OnChainPoolType;
  config: OnChainPoolConfig;

  // State
  status: OnChainPoolStatus;
  totalDeposits: bigint;
  totalShares: bigint;
  depositorCount: number;

  // NAV
  navPerShare: bigint; // scaled 1e9
  highWaterMark: bigint; // scaled 1e9
  lastNavUpdate: Date;

  // Fees
  accruedPerformanceFee: bigint;
  accruedManagementFee: bigint;
  lastFeeCollection: Date;

  // Timestamps
  createdAt: Date;
  activatedAt: Date | null;
}

/**
 * On-chain depositor state (mirrors DepositorState)
 */
export interface OnChainDepositorState {
  depositorPda: PublicKey;
  poolPda: PublicKey;
  owner: PublicKey;

  // Position
  shares: bigint;
  depositedAmount: bigint;
  entryNav: bigint;

  // Withdrawal
  withdrawalRequested: bigint;
  withdrawalRequestTs: Date | null;
  withdrawableAfter: Date | null;

  // Timestamps
  firstDepositAt: Date;
  lastDepositAt: Date;
}

// ============================================================================
// Database Types
// ============================================================================

/**
 * Forecaster pool row (from forecaster_pools table)
 */
export interface ForecasterPoolRow {
  id: string;
  pool_pda: string;
  pool_mint: string;
  forecaster_wallet: string;
  pool_type: string;
  base_token: string;
  min_deposit: string; // Stored as bigint, returned as string from Supabase
  max_capacity: string;
  performance_fee_bps: number;
  management_fee_bps: number;
  entry_fee_bps: number | null;
  exit_fee_bps: number | null;
  status: string;
  nav_per_share: string;
  high_water_mark: string;
  total_deposits: string | null;
  total_shares: string | null;
  depositor_count: number | null;
  forecaster_brier: number | null;
  forecaster_predictions: number | null;
  forecaster_tier: string | null;
  name: string | null;
  description: string | null;
  slug: string | null;
  created_at: string;
  updated_at: string;
  activated_at: string | null;
  closes_at: string | null;
}

/**
 * Pool delegation row (from pool_delegations table)
 */
export interface PoolDelegationRow {
  id: string;
  pool_id: string;
  depositor_pda: string;
  delegator_wallet: string;
  shares: string; // Stored as bigint, returned as string from Supabase
  deposited_amount: string;
  entry_nav: string;
  current_value: string | null;
  unrealized_pnl: string | null;
  realized_pnl: string | null;
  withdrawal_requested: string | null;
  withdrawal_request_ts: string | null;
  withdrawable_after: string | null;
  first_deposit_at: string;
  last_deposit_at: string | null;
}

/**
 * NAV history row
 */
export interface NavHistoryRow {
  id: string;
  pool_id: string;
  nav_per_share: string;
  total_value: string;
  recorded_at: string;
}

/**
 * Pool transaction row
 */
export interface PoolTransactionRow {
  id: string;
  pool_id: string;
  delegator_wallet: string | null;
  tx_type: string;
  amount: string | null;
  shares: string | null;
  nav_at_tx: string | null;
  tx_signature: string | null;
  created_at: string;
}

// ============================================================================
// API Types
// ============================================================================

/**
 * Pool summary for listing
 */
export interface PoolSummary {
  id: string;
  poolPda: string;
  slug: string | null;
  name: string | null;
  forecasterWallet: string;
  forecasterTier: ForecasterTier;
  forecasterBrier: number | null;
  status: OnChainPoolStatus;
  tvl: number;
  navPerShare: number;
  delegatorCount: number;
  performanceFeeBps: number;
  createdAt: Date;
}

/**
 * Pool details for detail page
 */
export interface PoolDetails extends PoolSummary {
  description: string | null;
  baseToken: string;
  minDeposit: number;
  maxCapacity: number;
  managementFeeBps: number;
  entryFeeBps: number;
  exitFeeBps: number;
  highWaterMark: number;
  forecasterPredictions: number | null;
  activatedAt: Date | null;
  navHistory: { timestamp: Date; nav: number }[];
}

/**
 * Delegator position summary
 */
export interface DelegationSummary {
  poolId: string;
  poolPda: string;
  poolName: string | null;
  shares: number;
  depositedAmount: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  hasWithdrawalPending: boolean;
  withdrawableAfter: Date | null;
}

/**
 * API pool filter options
 */
export interface PoolFilterOptions {
  status?: OnChainPoolStatus | OnChainPoolStatus[];
  tier?: ForecasterTier | ForecasterTier[];
  minTvl?: number;
  maxTvl?: number;
  sortBy?: 'tvl' | 'nav' | 'delegators' | 'created' | 'brier';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// ============================================================================
// Transaction Building Types
// ============================================================================

/**
 * Initialize pool parameters
 */
export interface InitializePoolParams {
  forecaster: PublicKey;
  poolType: OnChainPoolType;
  baseMint: PublicKey;
  config: Partial<OnChainPoolConfig>;
  avgBrierScore: number;
  resolvedPredictions: number;
}

/**
 * Deposit parameters
 */
export interface DepositParams {
  poolPda: PublicKey;
  depositor: PublicKey;
  amount: bigint;
}

/**
 * Withdrawal request parameters
 */
export interface WithdrawalRequestParams {
  poolPda: PublicKey;
  depositor: PublicKey;
  shares: bigint;
}

/**
 * Process withdrawal parameters
 */
export interface ProcessWithdrawalParams {
  poolPda: PublicKey;
  depositor: PublicKey;
}

/**
 * Update NAV parameters
 */
export interface UpdateNavParams {
  poolPda: PublicKey;
  forecaster: PublicKey;
  newNavPerShare: bigint;
}

/**
 * Transaction result
 */
export interface TransactionResult {
  success: boolean;
  signature?: string;
  error?: string;
}
