/**
 * Forecast Pool SDK
 *
 * TypeScript SDK for the Forecaster Staking Pools system.
 *
 * Usage:
 * ```typescript
 * import { getForecastPoolClient, PoolTier, getAvailableTiers } from './lib/staking/forecast-pool';
 *
 * // Get available tiers for a forecaster
 * const tiers = getAvailableTiers(0.25, 100); // Brier score, prediction count
 *
 * // Create client
 * const client = getForecastPoolClient(connection, { network: 'devnet' });
 *
 * // Build create pool transaction
 * const tx = await client.buildCreatePoolTx(forecasterWallet, {
 *   tier: PoolTier.ProSol,
 *   brierScoreScaled: 250, // 0.25 * 1000
 *   predictionCount: 100,
 * });
 *
 * // Build stake transaction
 * const stakeTx = await client.buildStakeTx(delegatorWallet, {
 *   poolAddress: 'pool...',
 *   amount: 1_000_000_000, // 1 SOL
 * });
 * ```
 *
 * @author BeRight Protocol
 */

// Enums (runtime values)
export {
  PoolTier,
  ForecastPoolStatus,
  PredictionStatus,
  PredictionSide,
  PredictionPlatform,
} from './types';

// Tier utilities (runtime functions)
export {
  getTierConfig,
  getAllTiers,
  getAvailableTiers,
} from './types';

// Constants (runtime values)
export {
  DEFAULT_REVENUE_SPLIT,
  FORECAST_POOL_CONSTANTS,
} from './types';

// PDA derivation (runtime functions)
export {
  deriveForecastPoolPda,
  derivePoolVaultPda,
  deriveDelegationPda,
  derivePoolPredictionPda,
  derivePlatformTreasuryPda,
} from './types';

// Type-only exports (use export type for Turbopack compatibility)
export type {
  TierConfig,
  RevenueSplit,
  ForecastPoolData,
  DelegationData,
  PoolPredictionData,
  PlatformTreasuryData,
  PoolDisplayInfo,
  DelegationDisplayInfo,
  CreatePoolParams,
  StakeParams,
  UnstakeParams,
  OpenPredictionParams,
  ResolvePredictionParams,
} from './types';

// Client
export {
  ForecastPoolClient,
  getForecastPoolClient,
  resetForecastPoolClient,
} from './client';
