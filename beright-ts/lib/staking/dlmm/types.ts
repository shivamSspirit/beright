import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

// Program IDs
export const STAKING_POOL_PROGRAM_ID = new PublicKey(
  "STAKEpoo11111111111111111111111111111111111"
);

export const DLMM_PROGRAM_ID = new PublicKey(
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo"
);

// Seeds
export const DLMM_CONFIG_SEED = Buffer.from("dlmm_config");
export const DLMM_POSITION_SEED = Buffer.from("dlmm_position");

// Constants
export const DEFAULT_MAX_POSITIONS = 5;
export const DEFAULT_MAX_ALLOCATION_BPS = 5000; // 50%
export const DEFAULT_REBALANCE_THRESHOLD_BPS = 1000; // 10%
export const MIN_BIN_WIDTH = 10;
export const MAX_BIN_WIDTH = 200;
export const PRICE_SCALE = new BN(1_000_000_000);

/**
 * Position status enum
 */
export enum DlmmPositionStatus {
  Active = 0,
  OutOfRange = 1,
  Closed = 2,
}

/**
 * DLMM Config account data
 */
export interface DlmmConfig {
  bump: number;
  pool: PublicKey;
  maxPositions: number;
  maxAllocationBps: number;
  rebalanceThresholdBps: number;
  activePositions: number;
  totalLiquidityValue: BN;
  totalFeesX: BN;
  totalFeesY: BN;
  isActive: boolean;
  createdAt: BN;
  lastUpdate: BN;
}

/**
 * DLMM Position State account data
 */
export interface DlmmPositionState {
  bump: number;
  pool: PublicKey;
  dlmmPool: PublicKey;
  positionNft: PublicKey;
  tokenXMint: PublicKey;
  tokenYMint: PublicKey;
  lowerBinId: number;
  upperBinId: number;
  activeBinId: number;
  liquidityShares: BN; // u128
  depositedX: BN;
  depositedY: BN;
  unclaimedFeeX: BN;
  unclaimedFeeY: BN;
  totalClaimedFeeX: BN;
  totalClaimedFeeY: BN;
  status: DlmmPositionStatus;
  positionIndex: number;
  entryPrice: BN;
  createdAt: BN;
  lastUpdate: BN;
  rebalanceCount: number;
}

/**
 * Config parameters for initialization
 */
export interface DlmmConfigParams {
  maxPositions?: number;
  maxAllocationBps?: number;
  rebalanceThresholdBps?: number;
}

/**
 * Parameters for creating a position
 */
export interface CreatePositionParams {
  lowerBinId: number;
  upperBinId: number;
  amountX: BN;
  amountY: BN;
}

/**
 * Parameters for rebalancing a position
 */
export interface RebalanceParams {
  newLowerBinId: number;
  newUpperBinId: number;
  minAmountX: BN;
  minAmountY: BN;
}

// Events

export interface DlmmConfigInitializedEvent {
  pool: PublicKey;
  maxPositions: number;
  maxAllocationBps: number;
  rebalanceThresholdBps: number;
  timestamp: BN;
}

export interface DlmmPositionCreatedEvent {
  pool: PublicKey;
  dlmmPool: PublicKey;
  positionNft: PublicKey;
  positionIndex: number;
  lowerBinId: number;
  upperBinId: number;
  amountX: BN;
  amountY: BN;
  timestamp: BN;
}

export interface DlmmLiquidityAddedEvent {
  pool: PublicKey;
  positionNft: PublicKey;
  positionIndex: number;
  amountX: BN;
  amountY: BN;
  sharesReceived: BN;
  newTotalShares: BN;
  timestamp: BN;
}

export interface DlmmLiquidityRemovedEvent {
  pool: PublicKey;
  positionNft: PublicKey;
  positionIndex: number;
  sharesRemoved: BN;
  amountX: BN;
  amountY: BN;
  remainingShares: BN;
  positionClosed: boolean;
  timestamp: BN;
}

export interface DlmmFeesClaimedEvent {
  pool: PublicKey;
  positionNft: PublicKey;
  positionIndex: number;
  feeX: BN;
  feeY: BN;
  totalClaimedX: BN;
  totalClaimedY: BN;
  timestamp: BN;
}

export interface DlmmPositionRebalancedEvent {
  pool: PublicKey;
  positionNft: PublicKey;
  positionIndex: number;
  oldLowerBinId: number;
  oldUpperBinId: number;
  newLowerBinId: number;
  newUpperBinId: number;
  amountX: BN;
  amountY: BN;
  feesClaimedX: BN;
  feesClaimedY: BN;
  rebalanceCount: number;
  timestamp: BN;
}

/**
 * Derive DLMM config PDA
 */
export function deriveDlmmConfigPda(
  poolPubkey: PublicKey,
  programId: PublicKey = STAKING_POOL_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [DLMM_CONFIG_SEED, poolPubkey.toBuffer()],
    programId
  );
}

/**
 * Derive DLMM position state PDA
 */
export function deriveDlmmPositionPda(
  poolPubkey: PublicKey,
  positionIndex: number,
  programId: PublicKey = STAKING_POOL_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [DLMM_POSITION_SEED, poolPubkey.toBuffer(), Buffer.from([positionIndex])],
    programId
  );
}

/**
 * Check if a position is in range
 */
export function isPositionInRange(
  activeBinId: number,
  lowerBinId: number,
  upperBinId: number
): boolean {
  return activeBinId >= lowerBinId && activeBinId <= upperBinId;
}

/**
 * Check if position should be rebalanced
 */
export function shouldRebalance(
  position: DlmmPositionState,
  thresholdBps: number
): boolean {
  if (position.status === DlmmPositionStatus.Closed) {
    return false;
  }

  const binWidth = position.upperBinId - position.lowerBinId;
  const thresholdBins = Math.floor((binWidth * thresholdBps) / 10000);

  const nearLower = position.activeBinId <= position.lowerBinId + thresholdBins;
  const nearUpper = position.activeBinId >= position.upperBinId - thresholdBins;

  return nearLower || nearUpper || !isPositionInRange(
    position.activeBinId,
    position.lowerBinId,
    position.upperBinId
  );
}

/**
 * Calculate position value in token Y
 */
export function calculatePositionValueInY(
  position: DlmmPositionState,
  currentPrice: BN
): BN {
  const xValueInY = position.depositedX.mul(currentPrice).div(PRICE_SCALE);
  return position.depositedY.add(xValueInY);
}

/**
 * Calculate impermanent loss in basis points
 */
export function calculateImpermanentLossBps(
  entryPrice: BN,
  currentPrice: BN
): number {
  if (entryPrice.isZero() || currentPrice.isZero()) {
    return 0;
  }

  // Simplified IL calculation
  const priceRatio = currentPrice.mul(PRICE_SCALE).div(entryPrice);
  const ratioDiff = priceRatio.gt(PRICE_SCALE)
    ? priceRatio.sub(PRICE_SCALE)
    : PRICE_SCALE.sub(priceRatio);

  // IL approximation: (price_ratio - 1)^2 / (4 * price_ratio)
  const ilRaw = ratioDiff.mul(ratioDiff).div(priceRatio.muln(4));
  return ilRaw.muln(10000).div(PRICE_SCALE).toNumber();
}
