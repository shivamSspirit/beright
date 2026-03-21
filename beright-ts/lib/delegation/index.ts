/**
 * BeRight Delegation Module
 *
 * Complete delegation pool system for forecaster-managed capital.
 *
 * Usage:
 * ```typescript
 * import {
 *   checkPoolEligibility,
 *   createDelegationPoolClient,
 *   listPools,
 *   getDelegationsForWallet,
 * } from '@/lib/delegation';
 *
 * // Check if user can create a pool
 * const eligibility = await checkPoolEligibility(walletAddress);
 * if (eligibility.eligible) {
 *   console.log(`Can create pool with ${eligibility.maxCapacity} capacity`);
 * }
 *
 * // Create client for on-chain interactions
 * const client = createDelegationPoolClient(connection, wallet);
 *
 * // List available pools
 * const pools = await listPools({ status: 'open', sortBy: 'tvl' });
 *
 * // Get user's delegations
 * const delegations = await getDelegationsForWallet(walletAddress);
 * ```
 */

// Types
export type {
  // Tier system
  ForecasterTier,
  TierRequirements,
  EligibilityResult,

  // On-chain state
  OnChainPoolType,
  OnChainPoolStatus,
  OnChainPoolConfig,
  OnChainPoolState,
  OnChainDepositorState,

  // Database rows
  ForecasterPoolRow,
  PoolDelegationRow,
  NavHistoryRow,
  PoolTransactionRow,

  // API types
  PoolSummary,
  PoolDetails,
  DelegationSummary,
  PoolFilterOptions,

  // Transaction params
  InitializePoolParams,
  DepositParams,
  WithdrawalRequestParams,
  ProcessWithdrawalParams,
  UpdateNavParams,
  TransactionResult,
} from './types';

export { TIER_REQUIREMENTS } from './types';

// Eligibility checking
export {
  checkPoolEligibility,
  getBrierScoreForWallet,
  getPredictionCount,
  determineTier,
  getTierCapacityUsdc,
  checkCapacityUpgrade,
  formatTier,
  getTierBadge,
  getTierColor,
} from './eligibility';

// On-chain client
export {
  DelegationPoolClient,
  createDelegationPoolClient,
  derivePoolStatePda,
  deriveDepositorStatePda,
  derivePoolAuthorityPda,
} from './client';

// Database queries
export {
  // Pool queries
  getPoolById,
  getPoolByPda,
  getPoolBySlug,
  listPools,
  getPoolsByForecaster,
  getPoolDetails,
  upsertPool,
  updatePoolStatus,

  // Delegation queries
  getDelegation,
  getPoolDelegations,
  getDelegationsForWallet,
  upsertDelegation,

  // NAV history
  recordNavSnapshot,
  getNavHistory,

  // Transactions
  recordTransaction,
  getPoolTransactions,
} from './db';

// State sync
export {
  syncAllPools,
  syncPoolToDb,
  syncPoolDepositors,
  runFullSync,
  createSyncRunner,
} from './sync';
export type { SyncConfig } from './sync';
