/**
 * Forecast Pool Types
 *
 * TypeScript types matching the Anchor program's Rust structs.
 * Based on specs/FORECASTER_STAKING_SPEC.md
 *
 * @author BeRight Protocol
 */

import { PublicKey } from '@solana/web3.js';

// =============================================================================
// POOL TIERS
// =============================================================================

/**
 * Pool tier determines capacity and eligibility requirements
 */
export enum PoolTier {
  /** Starter SOL: 5 SOL capacity, Brier < 0.35, 10+ predictions */
  StarterSol = 0,
  /** Basic SOL: 10 SOL capacity, Brier < 0.30, 25+ predictions */
  BasicSol = 1,
  /** Starter USDC: 500 USDC capacity, Brier < 0.35, 10+ predictions */
  StarterUsdc = 2,
  /** Basic USDC: 1,000 USDC capacity, Brier < 0.30, 25+ predictions */
  BasicUsdc = 3,
  /** Pro SOL: 100 SOL capacity, Brier < 0.25, 100+ predictions */
  ProSol = 4,
  /** Pro USDC: 10,000 USDC capacity, Brier < 0.25, 100+ predictions */
  ProUsdc = 5,
  /** Elite SOL: 500 SOL capacity, Brier < 0.20, 250+ predictions */
  EliteSol = 6,
  /** Elite USDC: 50,000 USDC capacity, Brier < 0.20, 250+ predictions */
  EliteUsdc = 7,
}

/**
 * Pool tier configuration
 */
export interface TierConfig {
  tier: PoolTier;
  name: string;
  capacity: number;
  capacityDisplay: string;
  token: 'SOL' | 'USDC';
  maxBrier: number;
  minPredictions: number;
  minDeposit: number;
  isPro: boolean;
}

/**
 * Get tier configuration
 */
export function getTierConfig(tier: PoolTier): TierConfig {
  const configs: Record<PoolTier, TierConfig> = {
    [PoolTier.StarterSol]: {
      tier: PoolTier.StarterSol,
      name: 'Starter SOL',
      capacity: 5 * 1e9,
      capacityDisplay: '5 SOL',
      token: 'SOL',
      maxBrier: 0.35,
      minPredictions: 10,
      minDeposit: 0.05 * 1e9,
      isPro: false,
    },
    [PoolTier.BasicSol]: {
      tier: PoolTier.BasicSol,
      name: 'Basic SOL',
      capacity: 10 * 1e9,
      capacityDisplay: '10 SOL',
      token: 'SOL',
      maxBrier: 0.30,
      minPredictions: 25,
      minDeposit: 0.1 * 1e9,
      isPro: false,
    },
    [PoolTier.StarterUsdc]: {
      tier: PoolTier.StarterUsdc,
      name: 'Starter USDC',
      capacity: 500 * 1e6,
      capacityDisplay: '500 USDC',
      token: 'USDC',
      maxBrier: 0.35,
      minPredictions: 10,
      minDeposit: 5 * 1e6,
      isPro: false,
    },
    [PoolTier.BasicUsdc]: {
      tier: PoolTier.BasicUsdc,
      name: 'Basic USDC',
      capacity: 1000 * 1e6,
      capacityDisplay: '1,000 USDC',
      token: 'USDC',
      maxBrier: 0.30,
      minPredictions: 25,
      minDeposit: 10 * 1e6,
      isPro: false,
    },
    [PoolTier.ProSol]: {
      tier: PoolTier.ProSol,
      name: 'Pro SOL',
      capacity: 100 * 1e9,
      capacityDisplay: '100 SOL',
      token: 'SOL',
      maxBrier: 0.25,
      minPredictions: 100,
      minDeposit: 1 * 1e9,
      isPro: true,
    },
    [PoolTier.ProUsdc]: {
      tier: PoolTier.ProUsdc,
      name: 'Pro USDC',
      capacity: 10000 * 1e6,
      capacityDisplay: '10,000 USDC',
      token: 'USDC',
      maxBrier: 0.25,
      minPredictions: 100,
      minDeposit: 100 * 1e6,
      isPro: true,
    },
    [PoolTier.EliteSol]: {
      tier: PoolTier.EliteSol,
      name: 'Elite SOL',
      capacity: 500 * 1e9,
      capacityDisplay: '500 SOL',
      token: 'SOL',
      maxBrier: 0.20,
      minPredictions: 250,
      minDeposit: 5 * 1e9,
      isPro: true,
    },
    [PoolTier.EliteUsdc]: {
      tier: PoolTier.EliteUsdc,
      name: 'Elite USDC',
      capacity: 50000 * 1e6,
      capacityDisplay: '50,000 USDC',
      token: 'USDC',
      maxBrier: 0.20,
      minPredictions: 250,
      minDeposit: 500 * 1e6,
      isPro: true,
    },
  };
  return configs[tier];
}

/**
 * Get all available tiers
 */
export function getAllTiers(): TierConfig[] {
  return Object.values(PoolTier)
    .filter((v) => typeof v === 'number')
    .map((tier) => getTierConfig(tier as PoolTier));
}

/**
 * Get tiers available to a forecaster based on their stats
 */
export function getAvailableTiers(brierScore: number, predictionCount: number): TierConfig[] {
  return getAllTiers().filter(
    (config) => brierScore <= config.maxBrier && predictionCount >= config.minPredictions
  );
}

// =============================================================================
// POOL STATUS
// =============================================================================

/**
 * Pool status
 */
export enum ForecastPoolStatus {
  /** Pool is active and accepting stakes */
  Active = 0,
  /** Pool is temporarily paused */
  Paused = 1,
  /** Pool is closed, withdrawals only */
  Closed = 2,
}

// =============================================================================
// PREDICTION STATUS
// =============================================================================

/**
 * Prediction status
 */
export enum PredictionStatus {
  Open = 0,
  Won = 1,
  Lost = 2,
  Cancelled = 3,
}

/**
 * Prediction side
 */
export enum PredictionSide {
  No = 0,
  Yes = 1,
}

/**
 * Platform identifier
 */
export enum PredictionPlatform {
  Polymarket = 0,
  Kalshi = 1,
  Jupiter = 2,
  Manifold = 3,
  Limitless = 4,
}

// =============================================================================
// ACCOUNT DATA STRUCTURES
// =============================================================================

/**
 * Revenue split configuration
 */
export interface RevenueSplit {
  forecasterBps: number;
  delegatorBps: number;
  platformBps: number;
}

/**
 * Default revenue split: 30/50/20
 */
export const DEFAULT_REVENUE_SPLIT: RevenueSplit = {
  forecasterBps: 3000, // 30%
  delegatorBps: 5000,  // 50%
  platformBps: 2000,   // 20%
};

/**
 * Forecast Pool account data
 */
export interface ForecastPoolData {
  bump: number;
  forecaster: PublicKey;
  tier: PoolTier;
  tokenMint: PublicKey;
  vault: PublicKey;
  totalValue: bigint;
  totalShares: bigint;
  sharePrice: bigint;
  capacity: bigint;
  availableLiquidity: bigint;
  revenueSplit: RevenueSplit;
  delegatorCount: number;
  predictionCount: number;
  winsCount: number;
  lossesCount: number;
  forecasterEarnings: bigint;
  platformEarnings: bigint;
  status: ForecastPoolStatus;
  version: number;
  createdAt: bigint;
  lastActivity: bigint;
}

/**
 * Delegation account data
 */
export interface DelegationData {
  bump: number;
  pool: PublicKey;
  delegator: PublicKey;
  shares: bigint;
  depositedAmount: bigint;
  depositedAt: bigint;
  lastClaimAt: bigint;
  pendingWithdrawal: bigint;
  withdrawalRequestedAt: bigint;
}

/**
 * Pool Prediction account data
 */
export interface PoolPredictionData {
  bump: number;
  pool: PublicKey;
  marketId: Uint8Array;
  platform: PredictionPlatform;
  side: PredictionSide;
  amount: bigint;
  entryPrice: bigint;
  exitPrice: bigint;
  pnl: bigint;
  status: PredictionStatus;
  openedAt: bigint;
  closedAt: bigint;
}

/**
 * Platform Treasury account data
 */
export interface PlatformTreasuryData {
  bump: number;
  admin: PublicKey;
  totalSolCollected: bigint;
  totalUsdcCollected: bigint;
}

// =============================================================================
// UI TYPES
// =============================================================================

/**
 * Pool display info for UI
 */
export interface PoolDisplayInfo {
  address: string;
  forecaster: string;
  tier: TierConfig;
  tvl: number;
  tvlDisplay: string;
  sharePrice: number;
  sharePriceDisplay: string;
  capacity: number;
  capacityDisplay: string;
  utilizationPct: number;
  delegatorCount: number;
  winRate: number;
  predictionCount: number;
  status: ForecastPoolStatus;
  createdAt: Date;
  forecasterEarnings: number;
  apy: number | null;
}

/**
 * Delegation display info for UI
 */
export interface DelegationDisplayInfo {
  poolAddress: string;
  shares: number;
  value: number;
  valueDisplay: string;
  depositedAmount: number;
  depositedAmountDisplay: string;
  pnl: number;
  pnlPct: number;
  pnlDisplay: string;
  depositedAt: Date;
  lockupComplete: boolean;
  withdrawalFeeRate: number;
}

/**
 * Create pool params
 */
export interface CreatePoolParams {
  tier: PoolTier;
  brierScoreScaled: number; // Brier * 1000
  predictionCount: number;
}

/**
 * Stake params
 */
export interface StakeParams {
  poolAddress: string;
  amount: number; // In lamports or USDC base units
}

/**
 * Unstake params
 */
export interface UnstakeParams {
  poolAddress: string;
  shares: number; // Number of shares to unstake
}

/**
 * Open prediction params
 */
export interface OpenPredictionParams {
  poolAddress: string;
  marketId: string;
  platform: PredictionPlatform;
  side: PredictionSide;
  amount: number;
  entryPrice: number; // Scaled 1e6
}

/**
 * Resolve prediction params
 */
export interface ResolvePredictionParams {
  poolAddress: string;
  predictionIndex: number;
  won: boolean;
  exitPrice: number; // Scaled 1e6
  realizedAmount: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const FORECAST_POOL_CONSTANTS = {
  /** Share price decimals (1e9) */
  SHARE_DECIMALS: 1_000_000_000n,
  /** Default share price (1.0) */
  DEFAULT_SHARE_PRICE: 1_000_000_000n,
  /** 7 day lockup period in seconds */
  LOCKUP_PERIOD: 7 * 24 * 60 * 60,
  /** Withdrawal fee (50 bps = 0.5%) */
  WITHDRAWAL_FEE_BPS: 50,
  /** Early exit fee (200 bps = 2%) */
  EARLY_EXIT_FEE_BPS: 200,
  /** Max position size per prediction (20%) */
  MAX_POSITION_PCT: 20,
  /** Min position size per prediction (1%) */
  MIN_POSITION_PCT: 1,
  /** Pool creation fee (0.1 SOL) */
  CREATION_FEE_LAMPORTS: 100_000_000,
  /** Program ID */
  PROGRAM_ID: 'Fkb7q8pbMa4Wko4u1DYZMXBrXvq8ECFnSqze2TYMm4pM',
};

// =============================================================================
// PDA DERIVATION
// =============================================================================

/**
 * Derive forecast pool PDA
 */
export function deriveForecastPoolPda(
  forecaster: PublicKey,
  tier: PoolTier,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('forecast_pool'), forecaster.toBuffer(), Buffer.from([tier])],
    programId
  );
}

/**
 * Derive pool vault PDA
 */
export function derivePoolVaultPda(
  pool: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('pool_vault'), pool.toBuffer()],
    programId
  );
}

/**
 * Derive delegation PDA
 */
export function deriveDelegationPda(
  pool: PublicKey,
  delegator: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('delegation'), pool.toBuffer(), delegator.toBuffer()],
    programId
  );
}

/**
 * Derive pool prediction PDA
 */
export function derivePoolPredictionPda(
  pool: PublicKey,
  predictionIndex: number,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('pool_prediction'), pool.toBuffer(), Buffer.from([predictionIndex])],
    programId
  );
}

/**
 * Derive platform treasury PDA
 */
export function derivePlatformTreasuryPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('platform_treasury')], programId);
}
