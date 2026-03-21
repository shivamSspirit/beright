import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { BN, Program, AnchorProvider } from "@coral-xyz/anchor";
import {
  STAKING_POOL_PROGRAM_ID,
  DRIFT_PROGRAM_ID,
  DriftTradingState,
  PerpPositionRecord,
  DriftTradingConfig,
  OpenPositionParams,
  PositionSide,
  PerpPositionStatus,
  deriveDriftTradingStatePda,
  derivePerpPositionPda,
  calculatePositionSize,
  calculateUnrealizedPnl,
  calculateLiquidationPrice,
  calculateWinRateBps,
  getMarketName,
} from "./types";

/**
 * Client for interacting with the Drift Trading integration
 */
export class DriftTradingClient {
  private connection: Connection;
  private programId: PublicKey;

  constructor(
    connection: Connection,
    programId: PublicKey = STAKING_POOL_PROGRAM_ID
  ) {
    this.connection = connection;
    this.programId = programId;
  }

  // ============ Read Methods ============

  /**
   * Get the trading state for a pool
   */
  async getTradingState(poolPubkey: PublicKey): Promise<DriftTradingState | null> {
    const [tradingStatePda] = deriveDriftTradingStatePda(poolPubkey, this.programId);

    try {
      const accountInfo = await this.connection.getAccountInfo(tradingStatePda);
      if (!accountInfo) return null;

      // Decode account data (simplified - in production use IDL)
      return this.decodeTradingState(accountInfo.data);
    } catch (error) {
      console.error("Error fetching trading state:", error);
      return null;
    }
  }

  /**
   * Get a position record
   */
  async getPositionRecord(
    poolPubkey: PublicKey,
    positionIndex: number
  ): Promise<PerpPositionRecord | null> {
    const [positionPda] = derivePerpPositionPda(poolPubkey, positionIndex, this.programId);

    try {
      const accountInfo = await this.connection.getAccountInfo(positionPda);
      if (!accountInfo) return null;

      return this.decodePositionRecord(accountInfo.data);
    } catch (error) {
      console.error("Error fetching position record:", error);
      return null;
    }
  }

  /**
   * Get all open positions for a pool
   */
  async getAllPositions(poolPubkey: PublicKey): Promise<PerpPositionRecord[]> {
    const positions: PerpPositionRecord[] = [];

    // Check positions 0-254 (max 255)
    for (let i = 0; i < 255; i++) {
      const position = await this.getPositionRecord(poolPubkey, i);
      if (position && position.status === PerpPositionStatus.Open) {
        positions.push(position);
      }
    }

    return positions;
  }

  /**
   * Get pool trading statistics
   */
  async getPoolStats(poolPubkey: PublicKey): Promise<{
    totalTrades: number;
    winningTrades: number;
    winRate: number;
    realizedPnl: BN;
    unrealizedPnl: BN;
    totalCollateral: BN;
    openPositions: number;
    currentDrawdown: number;
  } | null> {
    const state = await this.getTradingState(poolPubkey);
    if (!state) return null;

    return {
      totalTrades: state.totalTrades,
      winningTrades: state.winningTrades,
      winRate: calculateWinRateBps(state.winningTrades, state.totalTrades) / 100,
      realizedPnl: state.realizedPnl,
      unrealizedPnl: state.unrealizedPnl,
      totalCollateral: state.totalCollateral,
      openPositions: state.openPositions,
      currentDrawdown: state.currentDrawdownBps / 100,
    };
  }

  // ============ Utility Methods ============

  /**
   * Derive trading state PDA
   */
  deriveTradingStatePda(poolPubkey: PublicKey): [PublicKey, number] {
    return deriveDriftTradingStatePda(poolPubkey, this.programId);
  }

  /**
   * Derive position PDA
   */
  derivePositionPda(poolPubkey: PublicKey, positionIndex: number): [PublicKey, number] {
    return derivePerpPositionPda(poolPubkey, positionIndex, this.programId);
  }

  /**
   * Calculate recommended position size based on forecaster metrics
   */
  calculateRecommendedSize(
    poolCapital: BN,
    maxPositionSizeBps: number,
    forecasterBrier: number,
    predictionProbability: number
  ): BN {
    return calculatePositionSize(
      poolCapital,
      maxPositionSizeBps,
      forecasterBrier,
      predictionProbability
    );
  }

  /**
   * Calculate position P&L
   */
  calculatePnl(
    side: PositionSide,
    entryPrice: BN,
    currentPrice: BN,
    size: BN,
    leverage: number
  ): BN {
    return calculateUnrealizedPnl(side, entryPrice, currentPrice, size, leverage);
  }

  /**
   * Calculate liquidation price for a position
   */
  getLiquidationPrice(
    side: PositionSide,
    entryPrice: BN,
    leverage: number
  ): BN {
    return calculateLiquidationPrice(side, entryPrice, leverage);
  }

  /**
   * Format position for display
   */
  formatPosition(position: PerpPositionRecord): {
    market: string;
    side: string;
    size: string;
    entryPrice: string;
    unrealizedPnl: string;
    leverage: string;
    status: string;
  } {
    return {
      market: getMarketName(position.marketIndex),
      side: position.side === PositionSide.Long ? "LONG" : "SHORT",
      size: position.size.toString(),
      entryPrice: (position.entryPrice.toNumber() / 1e6).toFixed(4),
      unrealizedPnl: position.unrealizedPnl.toString(),
      leverage: `${position.leverage}x`,
      status: PerpPositionStatus[position.status],
    };
  }

  /**
   * Check if trading is allowed for a pool
   */
  async canTrade(poolPubkey: PublicKey): Promise<{
    canTrade: boolean;
    reason?: string;
  }> {
    const state = await this.getTradingState(poolPubkey);
    if (!state) {
      return { canTrade: false, reason: "Trading not initialized" };
    }

    if (!state.isActive) {
      return { canTrade: false, reason: "Trading is paused" };
    }

    if (state.openPositions >= state.maxPositions) {
      return { canTrade: false, reason: "Max positions reached" };
    }

    if (state.currentDrawdownBps > state.maxDrawdownBps) {
      return { canTrade: false, reason: "Drawdown limit exceeded" };
    }

    return { canTrade: true };
  }

  /**
   * Get next available position index
   */
  async getNextPositionIndex(poolPubkey: PublicKey): Promise<number | null> {
    for (let i = 0; i < 255; i++) {
      const position = await this.getPositionRecord(poolPubkey, i);
      if (!position || position.status !== PerpPositionStatus.Open) {
        return i;
      }
    }
    return null;
  }

  // ============ Account Decoding (Simplified) ============

  private decodeTradingState(data: Buffer): DriftTradingState {
    // Skip 8-byte discriminator
    let offset = 8;

    const bump = data.readUInt8(offset);
    offset += 1;

    const pool = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const driftSubAccount = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const driftUser = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const maxLeverage = data.readUInt8(offset);
    offset += 1;

    const maxPositionSizeBps = data.readUInt16LE(offset);
    offset += 2;

    const maxPositions = data.readUInt8(offset);
    offset += 1;

    const openPositions = data.readUInt8(offset);
    offset += 1;

    const totalCollateral = new BN(data.slice(offset, offset + 8), "le");
    offset += 8;

    const unrealizedPnl = new BN(data.slice(offset, offset + 8), "le");
    offset += 8;

    const realizedPnl = new BN(data.slice(offset, offset + 8), "le");
    offset += 8;

    const maxDrawdownBps = data.readUInt16LE(offset);
    offset += 2;

    const currentDrawdownBps = data.readUInt16LE(offset);
    offset += 2;

    const highWaterMark = new BN(data.slice(offset, offset + 8), "le");
    offset += 8;

    const isActive = data.readUInt8(offset) === 1;
    offset += 1;

    const minBrierScoreThreshold = data.readUInt16LE(offset);
    offset += 2;

    const createdAt = new BN(data.slice(offset, offset + 8), "le");
    offset += 8;

    const lastUpdate = new BN(data.slice(offset, offset + 8), "le");
    offset += 8;

    const totalTrades = data.readUInt32LE(offset);
    offset += 4;

    const winningTrades = data.readUInt32LE(offset);
    offset += 4;

    return {
      bump,
      pool,
      driftSubAccount,
      driftUser,
      maxLeverage,
      maxPositionSizeBps,
      maxPositions,
      openPositions,
      totalCollateral,
      unrealizedPnl,
      realizedPnl,
      maxDrawdownBps,
      currentDrawdownBps,
      highWaterMark,
      isActive,
      minBrierScoreThreshold,
      createdAt,
      lastUpdate,
      totalTrades,
      winningTrades,
    };
  }

  private decodePositionRecord(data: Buffer): PerpPositionRecord {
    // Skip 8-byte discriminator
    let offset = 8;

    const bump = data.readUInt8(offset);
    offset += 1;

    const tradingState = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const pool = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const marketIndex = data.readUInt16LE(offset);
    offset += 2;

    const side = data.readUInt8(offset) as PositionSide;
    offset += 1;

    const entryPrice = new BN(data.slice(offset, offset + 8), "le");
    offset += 8;

    const size = new BN(data.slice(offset, offset + 8), "le");
    offset += 8;

    const leverage = data.readUInt8(offset);
    offset += 1;

    const predictionId = new Uint8Array(data.slice(offset, offset + 32));
    offset += 32;

    const predictionProbability = data.readUInt16LE(offset);
    offset += 2;

    const forecasterBrier = data.readUInt16LE(offset);
    offset += 2;

    // Option<u64> for stop_loss_price
    const hasStopLoss = data.readUInt8(offset) === 1;
    offset += 1;
    const stopLossPrice = hasStopLoss
      ? new BN(data.slice(offset, offset + 8), "le")
      : null;
    offset += 8;

    // Option<u64> for take_profit_price
    const hasTakeProfit = data.readUInt8(offset) === 1;
    offset += 1;
    const takeProfitPrice = hasTakeProfit
      ? new BN(data.slice(offset, offset + 8), "le")
      : null;
    offset += 8;

    const liquidationPrice = new BN(data.slice(offset, offset + 8), "le");
    offset += 8;

    const unrealizedPnl = new BN(data.slice(offset, offset + 8), "le");
    offset += 8;

    const status = data.readUInt8(offset) as PerpPositionStatus;
    offset += 1;

    const positionIndex = data.readUInt8(offset);
    offset += 1;

    const openedAt = new BN(data.slice(offset, offset + 8), "le");
    offset += 8;

    const closedAt = new BN(data.slice(offset, offset + 8), "le");
    offset += 8;

    const exitPrice = new BN(data.slice(offset, offset + 8), "le");
    offset += 8;

    const realizedPnl = new BN(data.slice(offset, offset + 8), "le");
    offset += 8;

    return {
      bump,
      tradingState,
      pool,
      marketIndex,
      side,
      entryPrice,
      size,
      leverage,
      predictionId,
      predictionProbability,
      forecasterBrier,
      stopLossPrice,
      takeProfitPrice,
      liquidationPrice,
      unrealizedPnl,
      status,
      positionIndex,
      openedAt,
      closedAt,
      exitPrice,
      realizedPnl,
    };
  }
}

export default DriftTradingClient;
