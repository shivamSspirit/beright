/**
 * BeRight Calibration Program - On-chain Integration
 *
 * Client SDK for interacting with the calibration Solana program.
 * Tracks forecaster accuracy using Brier score and log scores.
 *
 * Program ID: GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import * as crypto from 'crypto';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Program ID for calibration (devnet/mainnet) */
export const CALIBRATION_PROGRAM_ID = new PublicKey(
  'GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ'
);

/** PDA seeds */
export const FORECASTER_SEED = Buffer.from('forecaster');
export const PREDICTION_SEED = Buffer.from('prediction');

// Instruction discriminators (from IDL)
const DISCRIMINATORS = {
  initializeForecaster: Buffer.from([16, 22, 244, 53, 163, 61, 216, 211]),
  recordPrediction: Buffer.from([6, 250, 152, 187, 248, 58, 42, 136]),
  resolvePrediction: Buffer.from([199, 159, 54, 235, 121, 68, 53, 137]),
};

// ============================================================================
// TYPES
// ============================================================================

/** Direction of prediction */
export type PredictionDirection = 'yes' | 'no';

/** Forecaster state from on-chain */
export interface ForecasterState {
  bump: number;
  authority: PublicKey;
  totalPredictions: number;
  resolvedPredictions: number;
  cumulativeBrierScore: number;
  avgBrierScore: number;
  cumulativeLogScore: number;
  avgLogScore: number;
  correctPredictions: number;
  accuracy: number;
  marketsTraded: number;
  bestCategory: number;
  worstCategory: number;
  streakCorrect: number;
  maxStreakCorrect: number;
  lastPredictionTs: number;
  createdAt: number;
  calibrationBuckets: Array<[number, number]>;
  version: number;
}

/** Prediction record from on-chain */
export interface PredictionRecord {
  bump: number;
  forecaster: PublicKey;
  marketId: Uint8Array;
  predictedProbability: number;
  direction: PredictionDirection;
  committedAt: number;
  resolvedAt: number | null;
  outcome: boolean | null;
  brierScore: number | null;
  logScore: number | null;
  memoTxSignature: Uint8Array;
  category: number;
  version: number;
}

/** Request to record a prediction */
export interface RecordPredictionRequest {
  /** Forecaster wallet */
  authority: PublicKey;
  /** Market identifier (will be hashed to 32 bytes) */
  marketId: string;
  /** Predicted probability (0.0 - 1.0) */
  predictedProbability: number;
  /** Direction of prediction */
  direction: PredictionDirection;
  /** Optional memo transaction signature (64 bytes) */
  memoTxSignature?: Uint8Array;
  /** Category ID (0-255) */
  category?: number;
}

/** Request to resolve a prediction */
export interface ResolvePredictionRequest {
  /** Forecaster wallet */
  authority: PublicKey;
  /** Prediction record PDA */
  predictionRecord: PublicKey;
  /** Actual outcome (true = YES, false = NO) */
  outcome: boolean;
}

// ============================================================================
// PDA DERIVATION
// ============================================================================

/**
 * Derive forecaster state PDA
 */
export function deriveForecasterPda(
  authority: PublicKey,
  programId: PublicKey = CALIBRATION_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [FORECASTER_SEED, authority.toBuffer()],
    programId
  );
}

/**
 * Derive prediction record PDA
 */
export function derivePredictionPda(
  authority: PublicKey,
  marketIdHash: Uint8Array,
  timestampSeed: number,
  programId: PublicKey = CALIBRATION_PROGRAM_ID
): [PublicKey, number] {
  const timestampBuffer = Buffer.alloc(8);
  timestampBuffer.writeBigInt64LE(BigInt(timestampSeed));

  return PublicKey.findProgramAddressSync(
    [
      PREDICTION_SEED,
      authority.toBuffer(),
      Buffer.from(marketIdHash),
      timestampBuffer,
    ],
    programId
  );
}

/**
 * Hash a market ID string to 32 bytes
 */
export function hashMarketId(marketId: string): Uint8Array {
  return new Uint8Array(crypto.createHash('sha256').update(marketId).digest());
}

// ============================================================================
// CALIBRATION CLIENT CLASS
// ============================================================================

export class CalibrationClient {
  private connection: Connection;
  private programId: PublicKey;

  constructor(
    connection: Connection,
    programId: PublicKey = CALIBRATION_PROGRAM_ID
  ) {
    this.connection = connection;
    this.programId = programId;
  }

  /**
   * Check if forecaster is initialized
   */
  async isForecasterInitialized(authority: PublicKey): Promise<boolean> {
    const [forecasterPda] = deriveForecasterPda(authority, this.programId);
    const accountInfo = await this.connection.getAccountInfo(forecasterPda);
    return accountInfo !== null;
  }

  /**
   * Get forecaster state
   */
  async getForecasterState(authority: PublicKey): Promise<ForecasterState | null> {
    const [forecasterPda] = deriveForecasterPda(authority, this.programId);
    const accountInfo = await this.connection.getAccountInfo(forecasterPda);
    if (!accountInfo) return null;

    return this.decodeForecasterState(accountInfo.data);
  }

  /**
   * Get prediction record
   */
  async getPredictionRecord(predictionPda: PublicKey): Promise<PredictionRecord | null> {
    const accountInfo = await this.connection.getAccountInfo(predictionPda);
    if (!accountInfo) return null;

    return this.decodePredictionRecord(accountInfo.data);
  }

  /**
   * Build initialize forecaster transaction
   */
  buildInitializeForecasterTransaction(authority: PublicKey): {
    transaction: Transaction;
    forecasterPda: PublicKey;
    bump: number;
  } {
    const [forecasterPda, bump] = deriveForecasterPda(authority, this.programId);

    const instruction = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: forecasterPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: DISCRIMINATORS.initializeForecaster,
    });

    return {
      transaction: new Transaction().add(instruction),
      forecasterPda,
      bump,
    };
  }

  /**
   * Build record prediction transaction
   */
  buildRecordPredictionTransaction(request: RecordPredictionRequest): {
    transaction: Transaction;
    predictionPda: PublicKey;
    bump: number;
    timestampSeed: number;
  } {
    const { authority, marketId, predictedProbability, direction, memoTxSignature, category } = request;

    // Validate probability
    if (predictedProbability < 0 || predictedProbability > 1) {
      throw new Error('Predicted probability must be between 0.0 and 1.0');
    }

    const [forecasterPda] = deriveForecasterPda(authority, this.programId);
    const marketIdHash = hashMarketId(marketId);
    const timestampSeed = Math.floor(Date.now() / 1000);
    const [predictionPda, bump] = derivePredictionPda(
      authority,
      marketIdHash,
      timestampSeed,
      this.programId
    );

    // Build instruction data
    const dataBuffer = Buffer.alloc(8 + 32 + 8 + 8 + 1 + 64 + 1);
    let offset = 0;

    // Discriminator
    DISCRIMINATORS.recordPrediction.copy(dataBuffer, offset);
    offset += 8;

    // market_id [u8; 32]
    Buffer.from(marketIdHash).copy(dataBuffer, offset);
    offset += 32;

    // timestamp_seed i64
    dataBuffer.writeBigInt64LE(BigInt(timestampSeed), offset);
    offset += 8;

    // predicted_probability f64
    dataBuffer.writeDoubleLE(predictedProbability, offset);
    offset += 8;

    // direction enum (0 = Yes, 1 = No)
    dataBuffer.writeUInt8(direction === 'yes' ? 0 : 1, offset);
    offset += 1;

    // memo_tx_signature [u8; 64]
    if (memoTxSignature && memoTxSignature.length === 64) {
      Buffer.from(memoTxSignature).copy(dataBuffer, offset);
    }
    offset += 64;

    // category u8
    dataBuffer.writeUInt8(category || 0, offset);

    const instruction = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: forecasterPda, isSigner: false, isWritable: true },
        { pubkey: predictionPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: dataBuffer,
    });

    return {
      transaction: new Transaction().add(instruction),
      predictionPda,
      bump,
      timestampSeed,
    };
  }

  /**
   * Build resolve prediction transaction
   */
  buildResolvePredictionTransaction(request: ResolvePredictionRequest): Transaction {
    const { authority, predictionRecord, outcome } = request;
    const [forecasterPda] = deriveForecasterPda(authority, this.programId);

    // Build instruction data
    const dataBuffer = Buffer.alloc(9);
    DISCRIMINATORS.resolvePrediction.copy(dataBuffer, 0);
    dataBuffer.writeUInt8(outcome ? 1 : 0, 8);

    const instruction = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: forecasterPda, isSigner: false, isWritable: true },
        { pubkey: predictionRecord, isSigner: false, isWritable: true },
      ],
      data: dataBuffer,
    });

    return new Transaction().add(instruction);
  }

  // ============================================================================
  // DECODE METHODS
  // ============================================================================

  private decodeForecasterState(data: Buffer): ForecasterState {
    // Skip 8-byte discriminator
    let offset = 8;

    const bump = data.readUInt8(offset);
    offset += 1;

    const authority = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const totalPredictions = data.readUInt32LE(offset);
    offset += 4;

    const resolvedPredictions = data.readUInt32LE(offset);
    offset += 4;

    const cumulativeBrierScore = data.readDoubleLE(offset);
    offset += 8;

    const avgBrierScore = data.readDoubleLE(offset);
    offset += 8;

    const cumulativeLogScore = data.readDoubleLE(offset);
    offset += 8;

    const avgLogScore = data.readDoubleLE(offset);
    offset += 8;

    const correctPredictions = data.readUInt32LE(offset);
    offset += 4;

    const accuracy = data.readDoubleLE(offset);
    offset += 8;

    const marketsTraded = data.readUInt16LE(offset);
    offset += 2;

    const bestCategory = data.readUInt8(offset);
    offset += 1;

    const worstCategory = data.readUInt8(offset);
    offset += 1;

    const streakCorrect = data.readUInt16LE(offset);
    offset += 2;

    const maxStreakCorrect = data.readUInt16LE(offset);
    offset += 2;

    const lastPredictionTs = Number(data.readBigInt64LE(offset));
    offset += 8;

    const createdAt = Number(data.readBigInt64LE(offset));
    offset += 8;

    // Calibration buckets: 10 buckets * 2 u16 values
    const calibrationBuckets: Array<[number, number]> = [];
    for (let i = 0; i < 10; i++) {
      const count = data.readUInt16LE(offset);
      offset += 2;
      const sumOutcomes = data.readUInt16LE(offset);
      offset += 2;
      calibrationBuckets.push([count, sumOutcomes]);
    }

    const version = data.readUInt8(offset);

    return {
      bump,
      authority,
      totalPredictions,
      resolvedPredictions,
      cumulativeBrierScore,
      avgBrierScore,
      cumulativeLogScore,
      avgLogScore,
      correctPredictions,
      accuracy,
      marketsTraded,
      bestCategory,
      worstCategory,
      streakCorrect,
      maxStreakCorrect,
      lastPredictionTs,
      createdAt,
      calibrationBuckets,
      version,
    };
  }

  private decodePredictionRecord(data: Buffer): PredictionRecord {
    // Skip 8-byte discriminator
    let offset = 8;

    const bump = data.readUInt8(offset);
    offset += 1;

    const forecaster = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const marketId = new Uint8Array(data.slice(offset, offset + 32));
    offset += 32;

    const predictedProbability = data.readDoubleLE(offset);
    offset += 8;

    const directionByte = data.readUInt8(offset);
    offset += 1;
    const direction: PredictionDirection = directionByte === 0 ? 'yes' : 'no';

    const committedAt = Number(data.readBigInt64LE(offset));
    offset += 8;

    // Option<i64> for resolved_at
    const hasResolvedAt = data.readUInt8(offset);
    offset += 1;
    let resolvedAt: number | null = null;
    if (hasResolvedAt) {
      resolvedAt = Number(data.readBigInt64LE(offset));
    }
    offset += 8;

    // Option<bool> for outcome
    const hasOutcome = data.readUInt8(offset);
    offset += 1;
    let outcome: boolean | null = null;
    if (hasOutcome) {
      outcome = data.readUInt8(offset) === 1;
    }
    offset += 1;

    // Option<f64> for brier_score
    const hasBrierScore = data.readUInt8(offset);
    offset += 1;
    let brierScore: number | null = null;
    if (hasBrierScore) {
      brierScore = data.readDoubleLE(offset);
    }
    offset += 8;

    // Option<f64> for log_score
    const hasLogScore = data.readUInt8(offset);
    offset += 1;
    let logScore: number | null = null;
    if (hasLogScore) {
      logScore = data.readDoubleLE(offset);
    }
    offset += 8;

    const memoTxSignature = new Uint8Array(data.slice(offset, offset + 64));
    offset += 64;

    const category = data.readUInt8(offset);
    offset += 1;

    const version = data.readUInt8(offset);

    return {
      bump,
      forecaster,
      marketId,
      predictedProbability,
      direction,
      committedAt,
      resolvedAt,
      outcome,
      brierScore,
      logScore,
      memoTxSignature,
      category,
      version,
    };
  }
}

// ============================================================================
// SINGLETON & CONVENIENCE FUNCTIONS
// ============================================================================

let calibrationClient: CalibrationClient | null = null;

export function getCalibrationClient(connection?: Connection): CalibrationClient {
  if (!calibrationClient && connection) {
    calibrationClient = new CalibrationClient(connection);
  }
  if (!calibrationClient) {
    const defaultConnection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'
    );
    calibrationClient = new CalibrationClient(defaultConnection);
  }
  return calibrationClient;
}

export function resetCalibrationClient(): void {
  calibrationClient = null;
}

// ============================================================================
// DECAYING BRIER INTEGRATION
// ============================================================================

import {
  calculateDecayingBrier,
  calculateTierFromDecayingBrier,
  checkSlashingThreshold,
  DEFAULT_DECAY_CONFIG,
  DECAY_PRESETS,
  type DecayConfig,
  type DecayablePrediction,
  type DecayingBrierResult,
  type ForecasterTier,
} from '../scoring/decay';

/**
 * Convert on-chain PredictionRecord to DecayablePrediction
 */
export function toDecayablePrediction(record: PredictionRecord): DecayablePrediction | null {
  if (!record.resolvedAt || record.outcome === null || record.brierScore === null) {
    return null;
  }

  return {
    id: Buffer.from(record.marketId).toString('hex'),
    probability: record.predictedProbability,
    direction: record.direction === 'yes' ? 'YES' : 'NO',
    outcome: record.outcome,
    resolvedAt: new Date(record.resolvedAt * 1000),
    category: String(record.category),
  };
}

/**
 * Calculate decaying Brier for a forecaster from on-chain records
 */
export async function calculateForecasterDecayingBrier(
  client: CalibrationClient,
  predictionRecords: PredictionRecord[],
  config: DecayConfig = DEFAULT_DECAY_CONFIG
): Promise<DecayingBrierResult> {
  // Convert to decayable predictions
  const decayablePreds = predictionRecords
    .map(toDecayablePrediction)
    .filter((p): p is DecayablePrediction => p !== null);

  return calculateDecayingBrier(decayablePreds, config);
}

/**
 * Check if forecaster should be slashed based on on-chain records
 */
export async function checkForecasterSlashingRisk(
  client: CalibrationClient,
  predictionRecords: PredictionRecord[],
  threshold: number = 0.35
): Promise<{
  shouldSlash: boolean;
  decayingBrier: number;
  threshold: number;
  margin: number;
  recentPerformance: 'good' | 'warning' | 'poor';
}> {
  const decayablePreds = predictionRecords
    .map(toDecayablePrediction)
    .filter((p): p is DecayablePrediction => p !== null);

  return checkSlashingThreshold(decayablePreds, threshold);
}

/**
 * Get forecaster tier from on-chain records using decay
 */
export function getForecasterTierFromRecords(
  predictionRecords: PredictionRecord[],
  config: DecayConfig = DEFAULT_DECAY_CONFIG
): ForecasterTier {
  const decayablePreds = predictionRecords
    .map(toDecayablePrediction)
    .filter((p): p is DecayablePrediction => p !== null);

  const result = calculateDecayingBrier(decayablePreds, config);
  return calculateTierFromDecayingBrier(result, predictionRecords.length);
}

// ============================================================================
// EXPORTS
// ============================================================================

export const calibration = {
  client: CalibrationClient,
  getClient: getCalibrationClient,
  resetClient: resetCalibrationClient,
  deriveForecasterPda,
  derivePredictionPda,
  hashMarketId,
  PROGRAM_ID: CALIBRATION_PROGRAM_ID,

  // Decay utilities
  decay: {
    calculate: calculateForecasterDecayingBrier,
    checkSlashing: checkForecasterSlashingRisk,
    getTier: getForecasterTierFromRecords,
    toDecayable: toDecayablePrediction,
    presets: DECAY_PRESETS,
    defaultConfig: DEFAULT_DECAY_CONFIG,
  },
};

// Re-export decay types for convenience
export type { DecayConfig, DecayablePrediction, DecayingBrierResult, ForecasterTier };
export { DECAY_PRESETS, DEFAULT_DECAY_CONFIG };

export default calibration;
