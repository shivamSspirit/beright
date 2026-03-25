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

// Types
export {
  // Enums
  PoolTier,
  ForecastPoolStatus,
  PredictionStatus,
  PredictionSide,
  PredictionPlatform,

  // Tier utilities
  TierConfig,
  getTierConfig,
  getAllTiers,
  getAvailableTiers,

  // Data structures
  RevenueSplit,
  DEFAULT_REVENUE_SPLIT,
  ForecastPoolData,
  DelegationData,
  PoolPredictionData,
  PlatformTreasuryData,

  // UI types
  PoolDisplayInfo,
  DelegationDisplayInfo,

  // Params
  CreatePoolParams,
  StakeParams,
  UnstakeParams,
  OpenPredictionParams,
  ResolvePredictionParams,

  // Constants
  FORECAST_POOL_CONSTANTS,

  // PDA derivation
  deriveForecastPoolPda,
  derivePoolVaultPda,
  deriveDelegationPda,
  derivePoolPredictionPda,
  derivePlatformTreasuryPda,
} from './types';

// Client
export {
  ForecastPoolClient,
  getForecastPoolClient,
  resetForecastPoolClient,
} from './client';
