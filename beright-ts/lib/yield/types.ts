/**
 * BeRight Yield Layer Types
 *
 * Interfaces for the yield infrastructure that powers
 * Outcome-Conditioned Yield (P2) for Conviction Pools.
 */

import type { PublicKey } from '@solana/web3.js';

// ============================================================================
// Vault Configuration
// ============================================================================

/**
 * Supported yield protocols
 */
export type YieldProtocol = 'meteora' | 'sanctum' | 'kamino';

/**
 * Vault token types we support
 */
export type VaultToken = 'USDC' | 'SOL' | 'USDT';

/**
 * Network environment
 */
export type Network = 'mainnet-beta' | 'devnet';

/**
 * Vault configuration
 */
export interface VaultConfig {
  protocol: YieldProtocol;
  token: VaultToken;
  vaultAddress: PublicKey;
  tokenMint: PublicKey;
  decimals: number;
  minDeposit: bigint;
  maxDeposit?: bigint;
}

/**
 * Known vault addresses
 */
export interface VaultAddresses {
  mainnet: Partial<Record<VaultToken, PublicKey>>;
  devnet: Partial<Record<VaultToken, PublicKey>>;
}

// ============================================================================
// Yield State
// ============================================================================

/**
 * Current state of a yield position
 */
export interface YieldPosition {
  protocol: YieldProtocol;
  token: VaultToken;

  // Balances
  depositedAmount: bigint;       // Original deposit
  currentValue: bigint;          // Current value including yield
  lpTokenBalance: bigint;        // LP tokens received

  // Yield metrics
  yieldEarned: bigint;           // Total yield earned
  yieldRate: number;             // Current APY (0.08 = 8%)

  // Timestamps
  depositedAt: Date;
  lastHarvest: Date;

  // Virtual price for LP → underlying conversion
  virtualPrice: number;          // LP token price (>1 means yield accrued)
}

/**
 * Yield statistics for display
 */
export interface YieldStats {
  totalDeposited: bigint;
  totalYieldEarned: bigint;
  currentAPY: number;
  projectedYield30d: bigint;
  projectedYield90d: bigint;
  lastUpdate: Date;
}

// ============================================================================
// Operations
// ============================================================================

/**
 * Deposit request
 */
export interface YieldDepositRequest {
  amount: bigint;
  token: VaultToken;
  poolId?: PublicKey;            // Optional: associate with pool
}

/**
 * Deposit result
 */
export interface YieldDepositResult {
  success: boolean;
  txSignature?: string;
  lpTokensReceived?: bigint;
  depositedAmount?: bigint;
  error?: string;
}

/**
 * Withdraw request
 */
export interface YieldWithdrawRequest {
  amount: bigint;                // Amount in underlying token
  token: VaultToken;
  poolId?: PublicKey;
}

/**
 * Withdraw result
 */
export interface YieldWithdrawResult {
  success: boolean;
  txSignature?: string;
  amountReceived?: bigint;
  lpTokensBurned?: bigint;
  yieldRealized?: bigint;
  error?: string;
}

// ============================================================================
// Orchestrator Types
// ============================================================================

/**
 * Allocation strategy
 */
export interface AllocationStrategy {
  yieldAllocationBps: number;    // % to yield (e.g., 5000 = 50%)
  reserveAllocationBps: number;  // % to liquid reserve
  activeAllocationBps: number;   // % for active predictions

  // Constraints
  minReserve: bigint;            // Minimum liquid reserve
  rebalanceThresholdBps: number; // Trigger rebalance when off by this %
}

/**
 * Default allocation strategy
 */
export const DEFAULT_ALLOCATION_STRATEGY: AllocationStrategy = {
  yieldAllocationBps: 5000,      // 50% to yield
  reserveAllocationBps: 2000,    // 20% liquid reserve
  activeAllocationBps: 3000,     // 30% for predictions
  minReserve: 1000_000000n,      // 1000 USDC minimum reserve
  rebalanceThresholdBps: 500,    // Rebalance when 5% off target
};

/**
 * Allocation result from capital router
 */
export interface AllocationResult {
  yieldAmount: bigint;
  reserveAmount: bigint;
  activeAmount: bigint;

  yieldTxSignature?: string;
  poolId: PublicKey;
  timestamp: Date;
}

/**
 * Rebalance recommendation
 */
export interface RebalanceRecommendation {
  needsRebalance: boolean;
  currentAllocations: {
    yieldBps: number;
    reserveBps: number;
    activeBps: number;
  };
  targetAllocations: {
    yieldBps: number;
    reserveBps: number;
    activeBps: number;
  };
  actions: RebalanceAction[];
}

/**
 * Single rebalance action
 */
export interface RebalanceAction {
  type: 'deposit_yield' | 'withdraw_yield' | 'move_to_reserve';
  amount: bigint;
  reason: string;
}

// ============================================================================
// Client Interface
// ============================================================================

/**
 * Yield client interface
 *
 * All yield protocol clients implement this interface.
 */
export interface IYieldClient {
  readonly protocol: YieldProtocol;
  readonly token: VaultToken;

  // Connection
  connect(): Promise<void>;
  isConnected(): boolean;

  // Queries
  getBalance(owner: PublicKey): Promise<bigint>;
  getYieldEarned(owner: PublicKey): Promise<bigint>;
  getVirtualPrice(): Promise<number>;
  getAPY(): Promise<number>;

  // Operations
  deposit(owner: PublicKey, amount: bigint): Promise<YieldDepositResult>;
  withdraw(owner: PublicKey, amount: bigint): Promise<YieldWithdrawResult>;

  // Conversion helpers
  lpToUnderlying(lpAmount: bigint): Promise<bigint>;
  underlyingToLp(underlyingAmount: bigint): Promise<bigint>;
}

// ============================================================================
// Events
// ============================================================================

/**
 * Yield deposit event
 */
export interface YieldDepositEvent {
  protocol: YieldProtocol;
  token: VaultToken;
  depositor: PublicKey;
  amount: bigint;
  lpTokens: bigint;
  timestamp: Date;
  txSignature: string;
}

/**
 * Yield withdraw event
 */
export interface YieldWithdrawEvent {
  protocol: YieldProtocol;
  token: VaultToken;
  withdrawer: PublicKey;
  amount: bigint;
  lpTokensBurned: bigint;
  yieldRealized: bigint;
  timestamp: Date;
  txSignature: string;
}

/**
 * Yield harvest event
 */
export interface YieldHarvestEvent {
  protocol: YieldProtocol;
  token: VaultToken;
  poolId: PublicKey;
  yieldAmount: bigint;
  timestamp: Date;
  txSignature: string;
}
