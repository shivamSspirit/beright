/**
 * BeRight Conviction Pools
 *
 * P8: Forecaster hedge fund model where delegators stake to skilled forecasters.
 *
 * Integrated with:
 * - P6: Credit Score (determines pool access tier)
 * - P2: Yield Layer (earns on idle capital)
 * - On-chain Calibration (track record verification)
 *
 * @example
 * ```typescript
 * import { createPoolManager } from '@/lib/pools';
 *
 * const manager = createPoolManager(connection, 'mainnet-beta');
 * await manager.initialize();
 *
 * // Create a pool
 * const result = await manager.createPool({
 *   forecaster: forecasterPubkey,
 *   config: {
 *     name: 'Alpha Predictions',
 *     description: 'Top-decile forecaster pool',
 *     token: 'USDC',
 *     type: 'public',
 *     fees: { ... },
 *     constraints: { ... },
 *   },
 * });
 *
 * // Delegate to pool
 * const delegation = await manager.delegate({
 *   poolId: result.pool.id,
 *   delegator: delegatorPubkey,
 *   amount: 1000_000000n,
 * });
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export type {
  // Pool configuration
  PoolStatus,
  PoolType,
  PoolFees,
  PoolConstraints,
  PoolConfig,

  // Pool state
  ConvictionPool,
  PoolPerformance,

  // Delegation state
  DelegationStatus,
  Delegation,
  DelegatorSummary,

  // Operations
  CreatePoolRequest,
  CreatePoolResult,
  DelegateRequest,
  DelegateResult,
  UndelegateRequest,
  UndelegateResult,

  // Events
  PoolCreatedEvent,
  DelegationEvent,
  UndelegationEvent,
  YieldDistributionEvent,

  // Queries
  PoolFilter,
  PoolSortBy,
  PoolListOptions,
} from './types';

export { DEFAULT_POOL_CONFIG } from './types';

// ============================================================================
// Manager
// ============================================================================

export { PoolManager, createPoolManager } from './manager';
