import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

// Program IDs
export const STAKING_POOL_PROGRAM_ID = new PublicKey(
  "STAKEpoo11111111111111111111111111111111111"
);

export const DRIFT_PROGRAM_ID = new PublicKey(
  "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"
);

// Seeds
export const DRIFT_TRADING_STATE_SEED = Buffer.from("drift_trading_state");
export const PERP_POSITION_SEED = Buffer.from("perp_position");

// Market Indices (Drift Protocol)
export const MARKET_SOL_PERP = 0;
export const MARKET_BTC_PERP = 1;
export const MARKET_ETH_PERP = 2;
export const MARKET_ARB_PERP = 3;
export const MARKET_DOGE_PERP = 4;
export const MARKET_BONK_PERP = 5;
export const MARKET_PEPE_PERP = 6;
export const MARKET_WIF_PERP = 7;
export const MARKET_JUP_PERP = 8;
export const MARKET_PYTH_PERP = 9;

// Constants
export const DEFAULT_MAX_LEVERAGE = 3;
export const ELITE_MAX_LEVERAGE = 5;
export const DEFAULT_MAX_POSITION_SIZE_BPS = 1000; // 10%
export const DEFAULT_MAX_DRAWDOWN_BPS = 1000; // 10%
export const DEFAULT_MAX_POSITIONS = 5;
export const DEFAULT_MIN_BRIER_THRESHOLD = 300; // 0.30
export const PRICE_SCALE = new BN(1_000_000);

/**
 * Position side enum
 */
export enum PositionSide {
  Long = 0,
  Short = 1,
}

/**
 * Position status enum
 */
export enum PerpPositionStatus {
  Open = 0,
  Closed = 1,
  Liquidated = 2,
}

/**
 * Drift Trading State account data
 */
export interface DriftTradingState {
  bump: number;
  pool: PublicKey;
  driftSubAccount: PublicKey;
  driftUser: PublicKey;
  maxLeverage: number;
  maxPositionSizeBps: number;
  maxPositions: number;
  openPositions: number;
  totalCollateral: BN;
  unrealizedPnl: BN; // i64
  realizedPnl: BN; // i64
  maxDrawdownBps: number;
  currentDrawdownBps: number;
  highWaterMark: BN;
  isActive: boolean;
  minBrierScoreThreshold: number;
  createdAt: BN;
  lastUpdate: BN;
  totalTrades: number;
  winningTrades: number;
}

/**
 * Perp Position Record account data
 */
export interface PerpPositionRecord {
  bump: number;
  tradingState: PublicKey;
  pool: PublicKey;
  marketIndex: number;
  side: PositionSide;
  entryPrice: BN;
  size: BN;
  leverage: number;
  predictionId: Uint8Array; // [u8; 32]
  predictionProbability: number;
  forecasterBrier: number;
  stopLossPrice: BN | null;
  takeProfitPrice: BN | null;
  liquidationPrice: BN;
  unrealizedPnl: BN; // i64
  status: PerpPositionStatus;
  positionIndex: number;
  openedAt: BN;
  closedAt: BN;
  exitPrice: BN;
  realizedPnl: BN; // i64
}

/**
 * Config parameters for initialization
 */
export interface DriftTradingConfig {
  maxLeverage?: number;
  maxPositionSizeBps?: number;
  maxDrawdownBps?: number;
}

/**
 * Parameters for opening a position
 */
export interface OpenPositionParams {
  marketIndex: number;
  side: PositionSide;
  size: BN;
  leverage: number;
  predictionId: Uint8Array;
  predictionProbability: number;
  forecasterBrier: number;
  stopLossPrice?: BN;
  takeProfitPrice?: BN;
}

// Events

export interface DriftTradingInitializedEvent {
  pool: PublicKey;
  driftSubAccount: PublicKey;
  driftUser: PublicKey;
  maxLeverage: number;
  maxPositionSizeBps: number;
  maxPositions: number;
  maxDrawdownBps: number;
  minBrierThreshold: number;
  timestamp: BN;
}

export interface DriftCollateralEvent {
  pool: PublicKey;
  action: number; // 0 = deposit, 1 = withdraw
  amount: BN;
  totalCollateral: BN;
  timestamp: BN;
}

export interface DriftPositionOpenedEvent {
  pool: PublicKey;
  marketIndex: number;
  side: number; // 0 = long, 1 = short
  size: BN;
  entryPrice: BN;
  leverage: number;
  predictionId: Uint8Array;
  predictionProbability: number;
  liquidationPrice: BN;
  timestamp: BN;
}

export interface DriftPositionClosedEvent {
  pool: PublicKey;
  marketIndex: number;
  exitPrice: BN;
  realizedPnl: BN;
  positionIndex: number;
  timestamp: BN;
}

export interface DriftPnlUpdatedEvent {
  pool: PublicKey;
  positionIndex: number;
  currentPrice: BN;
  unrealizedPnl: BN;
  marginRatio: BN;
  timestamp: BN;
}

export interface DriftLiquidationWarningEvent {
  pool: PublicKey;
  positionIndex: number;
  currentPrice: BN;
  liquidationPrice: BN;
  marginRatio: BN;
  unrealizedPnl: BN;
  actionTaken: number; // 0 = warning, 1 = stop loss, 2 = liquidated
  timestamp: BN;
}

/**
 * Derive Drift trading state PDA
 */
export function deriveDriftTradingStatePda(
  poolPubkey: PublicKey,
  programId: PublicKey = STAKING_POOL_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [DRIFT_TRADING_STATE_SEED, poolPubkey.toBuffer()],
    programId
  );
}

/**
 * Derive perp position record PDA
 */
export function derivePerpPositionPda(
  poolPubkey: PublicKey,
  positionIndex: number,
  programId: PublicKey = STAKING_POOL_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PERP_POSITION_SEED, poolPubkey.toBuffer(), Buffer.from([positionIndex])],
    programId
  );
}

/**
 * Calculate position size based on forecaster metrics
 *
 * Size = base_size * brier_weight * confidence_weight
 * - brier_weight: 1.0 - (brier_score / 0.5) -> better calibration = more size
 * - confidence_weight: |probability - 0.5| * 2 -> higher conviction = more size
 */
export function calculatePositionSize(
  poolCapital: BN,
  maxPositionSizeBps: number,
  forecasterBrier: number, // Scaled by 1000 (e.g., 200 = 0.20)
  predictionProbability: number // Scaled by 1000 (e.g., 750 = 75%)
): BN {
  // Max size based on pool allocation
  const maxSize = poolCapital.muln(maxPositionSizeBps).divn(10000);

  // Brier weight: better calibration (lower Brier) = higher weight
  const brierWeight = forecasterBrier >= 500 ? 0 : (500 - forecasterBrier) * 2;

  // Confidence weight: distance from 50%
  const confidence = predictionProbability > 500
    ? predictionProbability - 500
    : 500 - predictionProbability;
  const confidenceWeight = confidence * 2;

  // Final size = max_size * (brier_weight / 1000) * (confidence_weight / 1000)
  return maxSize
    .muln(brierWeight)
    .divn(1000)
    .muln(confidenceWeight)
    .divn(1000);
}

/**
 * Calculate unrealized P&L for a position
 */
export function calculateUnrealizedPnl(
  side: PositionSide,
  entryPrice: BN,
  currentPrice: BN,
  size: BN,
  leverage: number
): BN {
  const priceDiff = side === PositionSide.Long
    ? currentPrice.sub(entryPrice)
    : entryPrice.sub(currentPrice);

  return priceDiff.mul(size).muln(leverage).div(PRICE_SCALE);
}

/**
 * Calculate liquidation price
 */
export function calculateLiquidationPrice(
  side: PositionSide,
  entryPrice: BN,
  leverage: number
): BN {
  if (side === PositionSide.Long) {
    // liq_price = entry_price * (leverage - 1) / leverage
    return entryPrice.muln(leverage - 1).divn(leverage);
  } else {
    // liq_price = entry_price * (leverage + 1) / leverage
    return entryPrice.muln(leverage + 1).divn(leverage);
  }
}

/**
 * Check if position should be stopped out
 */
export function shouldStopLoss(
  side: PositionSide,
  currentPrice: BN,
  stopLossPrice: BN | null
): boolean {
  if (!stopLossPrice) return false;

  return side === PositionSide.Long
    ? currentPrice.lte(stopLossPrice)
    : currentPrice.gte(stopLossPrice);
}

/**
 * Check if position should take profit
 */
export function shouldTakeProfit(
  side: PositionSide,
  currentPrice: BN,
  takeProfitPrice: BN | null
): boolean {
  if (!takeProfitPrice) return false;

  return side === PositionSide.Long
    ? currentPrice.gte(takeProfitPrice)
    : currentPrice.lte(takeProfitPrice);
}

/**
 * Check if position should be liquidated
 */
export function shouldLiquidate(
  side: PositionSide,
  currentPrice: BN,
  liquidationPrice: BN
): boolean {
  return side === PositionSide.Long
    ? currentPrice.lte(liquidationPrice)
    : currentPrice.gte(liquidationPrice);
}

/**
 * Calculate margin ratio in basis points
 */
export function calculateMarginRatioBps(
  size: BN,
  leverage: number,
  unrealizedPnl: BN,
  currentPrice: BN
): number {
  const equity = size.muln(leverage).add(unrealizedPnl);
  const notional = size.mul(currentPrice).div(PRICE_SCALE);

  if (notional.isZero()) return 10000;

  return equity.muln(10000).div(notional).toNumber();
}

/**
 * Calculate win rate in basis points
 */
export function calculateWinRateBps(
  winningTrades: number,
  totalTrades: number
): number {
  if (totalTrades === 0) return 0;
  return Math.floor((winningTrades * 10000) / totalTrades);
}

/**
 * Get market name from index
 */
export function getMarketName(marketIndex: number): string {
  const markets: { [key: number]: string } = {
    [MARKET_SOL_PERP]: "SOL-PERP",
    [MARKET_BTC_PERP]: "BTC-PERP",
    [MARKET_ETH_PERP]: "ETH-PERP",
    [MARKET_ARB_PERP]: "ARB-PERP",
    [MARKET_DOGE_PERP]: "DOGE-PERP",
    [MARKET_BONK_PERP]: "BONK-PERP",
    [MARKET_PEPE_PERP]: "PEPE-PERP",
    [MARKET_WIF_PERP]: "WIF-PERP",
    [MARKET_JUP_PERP]: "JUP-PERP",
    [MARKET_PYTH_PERP]: "PYTH-PERP",
  };
  return markets[marketIndex] || `MARKET-${marketIndex}`;
}
