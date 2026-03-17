/**
 * BeRight Conviction Pools Types
 *
 * P8: Conviction Pools - Forecaster hedge fund model where
 * delegators stake capital to skilled forecasters.
 *
 * Key concepts:
 * - Forecaster: Creates and manages pool, makes predictions
 * - Delegator: Stakes capital to a forecaster's pool
 * - Conviction: Track record strength based on Brier score
 */

import type { PublicKey } from '@solana/web3.js';
import type { VaultToken } from '../yield/types';
import type { PoolAccessTier } from '../credit/types';

// ============================================================================
// Pool Configuration
// ============================================================================

/**
 * Pool status
 */
export type PoolStatus =
  | 'pending'      // Created, awaiting activation
  | 'active'       // Accepting deposits, making predictions
  | 'paused'       // Temporarily not accepting new deposits
  | 'settling'     // Resolving open positions
  | 'closed';      // Permanently closed

/**
 * Pool type based on access model
 */
export type PoolType =
  | 'public'       // Anyone can delegate
  | 'private'      // Whitelist only
  | 'institutional'; // Accredited investors

/**
 * Pool fee structure
 */
export interface PoolFees {
  managementFeeBps: number;     // Annual management fee (e.g., 200 = 2%)
  performanceFeeBps: number;    // Performance fee on profits (e.g., 2000 = 20%)
  entryFeeBps: number;          // Fee on deposits (usually 0)
  exitFeeBps: number;           // Fee on withdrawals (usually 0-50bps)

  // High-water mark for performance fee
  highWaterMark: bigint;
}

/**
 * Pool constraints
 */
export interface PoolConstraints {
  minDeposit: bigint;           // Minimum delegation
  maxDeposit?: bigint;          // Maximum per delegator
  maxTVL?: bigint;              // Pool capacity
  lockupPeriodDays: number;     // Minimum lock period
  withdrawalNoticeDays: number; // Notice before withdrawal
}

/**
 * Pool configuration
 */
export interface PoolConfig {
  // Identity
  name: string;
  description: string;
  token: VaultToken;

  // Access
  type: PoolType;
  requiredTier?: PoolAccessTier; // Minimum forecaster tier

  // Economics
  fees: PoolFees;
  constraints: PoolConstraints;

  // Capital allocation (bps)
  yieldAllocationBps: number;   // % to yield layer
  reserveAllocationBps: number; // % liquid reserve
  activeAllocationBps: number;  // % for predictions
}

/**
 * Default pool configuration
 */
export const DEFAULT_POOL_CONFIG: Omit<PoolConfig, 'name' | 'description'> = {
  token: 'USDC',
  type: 'public',
  fees: {
    managementFeeBps: 200,      // 2% annual
    performanceFeeBps: 2000,    // 20% of profits
    entryFeeBps: 0,
    exitFeeBps: 25,             // 0.25% exit fee
    highWaterMark: 0n,
  },
  constraints: {
    minDeposit: 100_000000n,    // 100 USDC minimum
    lockupPeriodDays: 7,
    withdrawalNoticeDays: 3,
  },
  yieldAllocationBps: 5000,     // 50% to yield
  reserveAllocationBps: 2000,   // 20% reserve
  activeAllocationBps: 3000,    // 30% active
};

// ============================================================================
// Pool State
// ============================================================================

/**
 * Core pool state
 */
export interface ConvictionPool {
  // Identity
  id: string;                   // Unique pool ID (UUID or PDA)
  address?: PublicKey;          // On-chain address if deployed
  slug: string;                 // URL-friendly identifier

  // Ownership
  forecaster: PublicKey;        // Pool manager
  forecasterName?: string;

  // Configuration
  config: PoolConfig;
  status: PoolStatus;

  // Capital
  tvl: bigint;                  // Total value locked
  delegatorCount: number;

  // Capital breakdown
  activeCapital: bigint;        // In predictions
  yieldCapital: bigint;         // In yield layer
  reserveCapital: bigint;       // Liquid reserve

  // Performance
  sharePrice: number;           // Current share price (starts at 1.0)
  totalShares: bigint;          // Total shares issued
  allTimeReturn: number;        // Cumulative return %
  mtdReturn: number;            // Month-to-date return %

  // Yield metrics
  yieldEarned: bigint;          // Total yield earned
  yieldAPY: number;             // Current yield APY

  // Track record
  predictionCount: number;
  winRate: number;
  avgBrierScore: number;

  // Timestamps
  createdAt: Date;
  activatedAt?: Date;
  lastActivityAt: Date;

  // Metadata
  isVerified: boolean;
  tags: string[];
}

/**
 * Pool performance snapshot
 */
export interface PoolPerformance {
  poolId: string;
  timestamp: Date;

  // NAV
  sharePrice: number;
  tvl: bigint;

  // Returns
  dailyReturn: number;
  weeklyReturn: number;
  monthlyReturn: number;
  allTimeReturn: number;

  // Risk metrics
  sharpeRatio?: number;
  maxDrawdown?: number;
  volatility?: number;

  // Yield breakdown
  yieldContribution: number;    // % of return from yield
  predictionContribution: number; // % of return from predictions
}

// ============================================================================
// Delegator State
// ============================================================================

/**
 * Delegation status
 */
export type DelegationStatus =
  | 'active'           // Currently delegated
  | 'pending_entry'    // Deposit queued
  | 'pending_exit'     // Withdrawal requested
  | 'exited';          // Fully withdrawn

/**
 * Delegator position in a pool
 */
export interface Delegation {
  id: string;
  poolId: string;
  delegator: PublicKey;

  // Position
  shares: bigint;               // Pool shares held
  depositedAmount: bigint;      // Original deposit
  currentValue: bigint;         // Current value
  pnl: bigint;                  // Profit/loss

  // Status
  status: DelegationStatus;
  entrySharePrice: number;      // Price at entry
  entryDate: Date;

  // Withdrawal state
  withdrawalRequest?: {
    requestedAt: Date;
    shares: bigint;
    effectiveDate: Date;        // When withdrawal can execute
  };

  // Yield tracking
  yieldEarned: bigint;          // Yield attributed to this delegation
  feesAccrued: bigint;          // Fees accrued

  // Timestamps
  lastUpdateAt: Date;
}

/**
 * Delegator summary across all pools
 */
export interface DelegatorSummary {
  delegator: PublicKey;
  totalDelegated: bigint;
  totalPnl: bigint;
  totalYieldEarned: bigint;
  activePoolsCount: number;
  delegations: Delegation[];
}

// ============================================================================
// Operations
// ============================================================================

/**
 * Pool creation request
 */
export interface CreatePoolRequest {
  forecaster: PublicKey;
  config: PoolConfig;
}

/**
 * Pool creation result
 */
export interface CreatePoolResult {
  success: boolean;
  pool?: ConvictionPool;
  txSignature?: string;
  error?: string;
}

/**
 * Deposit (delegate) request
 */
export interface DelegateRequest {
  poolId: string;
  delegator: PublicKey;
  amount: bigint;
}

/**
 * Deposit result
 */
export interface DelegateResult {
  success: boolean;
  delegation?: Delegation;
  sharesReceived?: bigint;
  allocationBreakdown?: {
    toActive: bigint;
    toYield: bigint;
    toReserve: bigint;
  };
  txSignature?: string;
  error?: string;
}

/**
 * Withdrawal request
 */
export interface UndelegateRequest {
  poolId: string;
  delegator: PublicKey;
  shares?: bigint;              // If not specified, withdraw all
}

/**
 * Withdrawal result
 */
export interface UndelegateResult {
  success: boolean;
  amountReceived?: bigint;
  sharesBurned?: bigint;
  fees?: bigint;
  yieldRealized?: bigint;
  effectiveDate?: Date;         // If withdrawal is queued
  txSignature?: string;
  error?: string;
}

// ============================================================================
// Events
// ============================================================================

/**
 * Pool created event
 */
export interface PoolCreatedEvent {
  poolId: string;
  forecaster: PublicKey;
  config: PoolConfig;
  timestamp: Date;
  txSignature: string;
}

/**
 * Delegation event
 */
export interface DelegationEvent {
  poolId: string;
  delegator: PublicKey;
  amount: bigint;
  shares: bigint;
  sharePrice: number;
  timestamp: Date;
  txSignature: string;
}

/**
 * Undelegation event
 */
export interface UndelegationEvent {
  poolId: string;
  delegator: PublicKey;
  amount: bigint;
  shares: bigint;
  sharePrice: number;
  pnl: bigint;
  fees: bigint;
  timestamp: Date;
  txSignature: string;
}

/**
 * Yield distribution event
 */
export interface YieldDistributionEvent {
  poolId: string;
  yieldAmount: bigint;
  sharePrice: number;           // New share price after distribution
  timestamp: Date;
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Pool filter for queries
 */
export interface PoolFilter {
  status?: PoolStatus | PoolStatus[];
  type?: PoolType | PoolType[];
  token?: VaultToken;
  forecaster?: PublicKey;
  minTVL?: bigint;
  maxTVL?: bigint;
  minReturn?: number;
  tags?: string[];
}

/**
 * Pool sort options
 */
export type PoolSortBy =
  | 'tvl'
  | 'return'
  | 'sharpe'
  | 'delegators'
  | 'created'
  | 'activity';

/**
 * Pool list options
 */
export interface PoolListOptions {
  filter?: PoolFilter;
  sortBy?: PoolSortBy;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}
