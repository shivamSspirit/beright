/**
 * BeRight Yield Layer
 *
 * Production-ready infrastructure for Outcome-Conditioned Yield (P2)
 * powering Conviction Pools (P8).
 *
 * Architecture:
 * - Deposits → Capital Router → Yield (50%) / Active (30%) / Reserve (20%)
 * - Yield layer uses Meteora Dynamic Vaults (6-12% APY)
 * - Withdrawals pull from Reserve first, then Yield layer
 *
 * @example
 * ```typescript
 * import { createYieldOrchestrator, MeteoraVaultClient } from '@/lib/yield';
 *
 * // Direct vault interaction
 * const client = await MeteoraVaultClient.createAndConnect(
 *   connection,
 *   'USDC',
 *   'mainnet-beta'
 * );
 * const balance = await client.getBalance(userPubkey);
 * const metrics = await client.getMetrics();
 *
 * // Orchestrated capital routing
 * const orchestrator = createYieldOrchestrator(connection, 'mainnet-beta');
 * await orchestrator.initialize(['USDC']);
 *
 * const allocation = await orchestrator.routeDeposit(
 *   poolId,
 *   'USDC',
 *   1000_000000n, // 1000 USDC
 *   depositorPubkey
 * );
 * ```
 *
 * @see https://docs.meteora.ag/dynamic-vaults
 */

// ============================================================================
// Types
// ============================================================================

export type {
  // Vault configuration
  YieldProtocol,
  VaultToken,
  Network,
  VaultConfig,
  VaultAddresses,

  // Yield state
  YieldPosition,
  YieldStats,

  // Operations
  YieldDepositRequest,
  YieldDepositResult,
  YieldWithdrawRequest,
  YieldWithdrawResult,

  // Orchestrator
  AllocationStrategy,
  AllocationResult,
  RebalanceRecommendation,
  RebalanceAction,

  // Client interface
  IYieldClient,

  // Events
  YieldDepositEvent,
  YieldWithdrawEvent,
  YieldHarvestEvent,
} from './types';

export { DEFAULT_ALLOCATION_STRATEGY } from './types';

// ============================================================================
// Meteora Integration
// ============================================================================

export {
  // Client
  MeteoraVaultClient,
  type VaultMetrics,
  type StrategyInfo,
  type MeteoraClientConfig,

  // Program IDs
  METEORA_VAULT_PROGRAM_ID,
  METEORA_AFFILIATE_PROGRAM_ID,
  VAULT_BASE_KEY,
  BERIGHT_AFFILIATE_ID,

  // Token configuration
  TOKEN_MINTS,
  TOKEN_DECIMALS,
  MIN_DEPOSITS,
  MAX_DEPOSITS,
  LENDING_PROTOCOLS,

  // Helper functions
  getTokenMint,
  getTokenDecimals,
  isTokenSupported,
  getSupportedTokens,
  toBaseUnits,
  fromBaseUnits,
  formatAmount,
  validateDepositAmount,

  // APY
  fetchVaultAPY,
  fetchAllVaultAPYs,
  getCachedAPY,
  clearAPYCache,
  calculateAPYFromPriceChange,
  type MeteoraVaultAPY,

  // Affiliate
  BERIGHT_AFFILIATE_CONFIG,
  isAffiliateConfigured,
  getAffiliateId,
  recordAffiliateFee,
  getAffiliateStats,
  getPartnership,
  updatePartnership,
  verifyAffiliateSetup,
  AFFILIATE_REGISTRATION_GUIDE,
  type AffiliateConfig,
  type AffiliateInfo,
  type AffiliateStats,
} from './meteora';

// ============================================================================
// Orchestrator
// ============================================================================

export {
  YieldOrchestrator,
  createYieldOrchestrator,
} from './orchestrator';

// ============================================================================
// Tracking
// ============================================================================

export type {
  YieldDeposit,
  YieldWithdrawal,
  YieldPosition as TrackedYieldPosition,
  YieldSnapshot,
  VaultHealthMetrics,
  AffiliatePartnership,
  RebalanceEvent,
  RebalanceActionRecord,
  DepositHistoryQuery,
  UserYieldSummary,
  PoolYieldSummary,
} from './tracking';

export {
  // Deposits
  recordDeposit,
  confirmDeposit,
  getDepositHistory,

  // Withdrawals
  recordWithdrawal,
  getWithdrawalHistory,

  // Positions
  getPosition,
  updatePosition,
  refreshPositionValue,
  getUserPositions,
  getPoolPositions,

  // Summaries
  getUserYieldSummary,
  getPoolYieldSummary,

  // Snapshots
  recordYieldSnapshot,
  getYieldSnapshots,
  calculateAPYFromSnapshots,
} from './tracking';

// ============================================================================
// Monitoring
// ============================================================================

export {
  VaultHealthMonitor,
  getHealthMonitor,
  startHealthMonitoring,
  type HealthCheckResult,
  type HealthAlert,
  type MonitoringConfig,
  DEFAULT_MONITORING_CONFIG,
} from './monitoring';
