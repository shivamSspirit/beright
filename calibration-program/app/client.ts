/**
 * BeRight Calibration Program - TypeScript Client
 *
 * Provides utilities for interacting with the on-chain calibration program.
 */

import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { PublicKey, Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

// Program ID (synced with declare_id! in lib.rs)
export const CALIBRATION_PROGRAM_ID = new PublicKey(
  'GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ'
);

export type ScoreVersion = 'v3';
export type SyncedForecasterStatus =
  | 'ImportedCandidate'
  | 'BootstrapEligible'
  | 'NativeCalibrating'
  | 'NativeVerified'
  | 'VaultEligible'
  | 'VaultScaled'
  | 'Restricted';
export type SyncedForecasterTier =
  | 'restricted'
  | 'bootstrap'
  | 'standard'
  | 'advanced'
  | 'elite';

export interface ScoreRiskCaps {
  maxActiveSleeveBps: number;
  maxMarketExposureBps: number;
  maxThemeExposureBps: number;
  probationary: boolean;
}

export interface CalibrationScoreSummaryInput {
  forecasterId: string;
  scoreVersion: ScoreVersion;
  scoreEpochHash: string;
  snapshotHash: string;
  vaultScore: number;
  importedScore: number | null;
  nativeScore: number | null;
  confidenceBps: number;
  nativeResolvedCount: number;
  importedResolvedCount: number;
  status: SyncedForecasterStatus;
  tier: SyncedForecasterTier;
  penaltyFlags: number;
  riskCaps: ScoreRiskCaps;
  calculatedAtUnixSeconds: number;
}

const SCORE_VERSION_MAP: Record<ScoreVersion, number> = {
  v3: 3,
};

const STATUS_MAP: Record<SyncedForecasterStatus, number> = {
  ImportedCandidate: 0,
  BootstrapEligible: 1,
  NativeCalibrating: 2,
  NativeVerified: 3,
  VaultEligible: 4,
  VaultScaled: 5,
  Restricted: 6,
};

const STATUS_LABELS: Record<number, SyncedForecasterStatus> = {
  0: 'ImportedCandidate',
  1: 'BootstrapEligible',
  2: 'NativeCalibrating',
  3: 'NativeVerified',
  4: 'VaultEligible',
  5: 'VaultScaled',
  6: 'Restricted',
};

const TIER_MAP: Record<SyncedForecasterTier, number> = {
  restricted: 0,
  bootstrap: 1,
  standard: 2,
  advanced: 3,
  elite: 4,
};

const TIER_LABELS: Record<number, SyncedForecasterTier> = {
  0: 'restricted',
  1: 'bootstrap',
  2: 'standard',
  3: 'advanced',
  4: 'elite',
};

function hexToBytes(hex: string): number[] {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (normalized.length !== 64) {
    throw new Error(`Expected 32-byte hex string, got length ${normalized.length / 2}`);
  }

  return Array.from(Buffer.from(normalized, 'hex'));
}

function bytesToHex(bytes: Uint8Array | number[]): string {
  return Buffer.from(bytes).toString('hex');
}

/**
 * Derive forecaster state PDA
 */
export function deriveForecasterPda(
  forecasterPubkey: PublicKey,
  programId: PublicKey = CALIBRATION_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('forecaster_v2'), forecasterPubkey.toBuffer()],
    programId
  );
}

/**
 * Derive prediction record PDA
 */
export function derivePredictionPda(
  forecasterPubkey: PublicKey,
  marketId: Uint8Array | Buffer,
  timestampSeed: BN | number,
  programId: PublicKey = CALIBRATION_PROGRAM_ID
): [PublicKey, number] {
  const timestampBuffer = Buffer.alloc(8);
  const ts = typeof timestampSeed === 'number' ? new BN(timestampSeed) : timestampSeed;
  timestampBuffer.writeBigInt64LE(BigInt(ts.toString()));

  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('prediction'),
      forecasterPubkey.toBuffer(),
      Buffer.from(marketId),
      timestampBuffer,
    ],
    programId
  );
}

/**
 * Derive score config PDA
 */
export function deriveScoreConfigPda(
  programId: PublicKey = CALIBRATION_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('score_config')],
    programId
  );
}

/**
 * Derive V3 score snapshot PDA
 */
export function deriveScoreSnapshotV3Pda(
  forecasterPubkey: PublicKey,
  programId: PublicKey = CALIBRATION_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('score_v3'), forecasterPubkey.toBuffer()],
    programId
  );
}

/**
 * Initialize forecaster calibration state
 */
export async function initializeForecaster(
  program: Program<any>,
  forecasterKeypair: Keypair
): Promise<string> {
  const [forecasterStatePda] = deriveForecasterPda(
    forecasterKeypair.publicKey,
    program.programId
  );

  const tx = await program.methods
    .initializeForecaster()
    .accounts({
      authority: forecasterKeypair.publicKey,
      forecasterState: forecasterStatePda,
      systemProgram: web3.SystemProgram.programId,
    })
    .signers([forecasterKeypair])
    .rpc();

  console.log('Forecaster initialized:', {
    forecaster: forecasterKeypair.publicKey.toBase58(),
    forecasterState: forecasterStatePda.toBase58(),
    tx,
  });

  return tx;
}

/**
 * Record a prediction
 */
export async function recordPrediction(
  program: Program<any>,
  forecasterKeypair: Keypair,
  marketId: string, // Will be hashed to 32 bytes
  predictedProbability: number, // 0.0 - 1.0
  direction: 'Yes' | 'No',
  memoTxSignature: string, // Base58 signature from Memo transaction
  category: number = 0
): Promise<string> {
  // Hash market ID to 32 bytes (simple example - use proper hash in production)
  const marketIdHash = Buffer.alloc(32);
  Buffer.from(marketId).copy(marketIdHash);

  // Use current timestamp as seed
  const timestampSeed = new BN(Date.now());

  // Parse memo tx signature
  const memoTxBytes = bs58.decode(memoTxSignature);
  const memoTxArray = Array.from(memoTxBytes).concat(Array(64 - memoTxBytes.length).fill(0));

  const [forecasterStatePda] = deriveForecasterPda(
    forecasterKeypair.publicKey,
    program.programId
  );

  const [predictionPda] = derivePredictionPda(
    forecasterKeypair.publicKey,
    marketIdHash,
    timestampSeed,
    program.programId
  );

  const tx = await program.methods
    .recordPrediction(
      Array.from(marketIdHash),
      timestampSeed,
      predictedProbability,
      direction === 'Yes' ? { yes: {} } : { no: {} },
      memoTxArray,
      category
    )
    .accounts({
      authority: forecasterKeypair.publicKey,
      forecasterState: forecasterStatePda,
      predictionRecord: predictionPda,
      systemProgram: web3.SystemProgram.programId,
    })
    .signers([forecasterKeypair])
    .rpc();

  console.log('Prediction recorded:', {
    forecaster: forecasterKeypair.publicKey.toBase58(),
    predictionPda: predictionPda.toBase58(),
    marketId,
    probability: predictedProbability,
    direction,
    tx,
  });

  return tx;
}

/**
 * Resolve a prediction
 */
export async function resolvePrediction(
  program: Program<any>,
  forecasterKeypair: Keypair,
  predictionPda: PublicKey,
  outcome: boolean
): Promise<string> {
  const [forecasterStatePda] = deriveForecasterPda(
    forecasterKeypair.publicKey,
    program.programId
  );

  const tx = await program.methods
    .resolvePrediction(outcome)
    .accounts({
      authority: forecasterKeypair.publicKey,
      forecasterState: forecasterStatePda,
      predictionRecord: predictionPda,
    })
    .signers([forecasterKeypair])
    .rpc();

  console.log('Prediction resolved:', {
    forecaster: forecasterKeypair.publicKey.toBase58(),
    predictionPda: predictionPda.toBase58(),
    outcome,
    tx,
  });

  return tx;
}

/**
 * Initialize score-sync config PDA
 */
export async function initializeScoreConfig(
  program: Program<any>,
  authorityKeypair: Keypair
): Promise<string> {
  const [scoreConfigPda] = deriveScoreConfigPda(program.programId);

  const tx = await program.methods
    .initializeScoreConfig()
    .accounts({
      authority: authorityKeypair.publicKey,
      scoreConfig: scoreConfigPda,
      systemProgram: web3.SystemProgram.programId,
    })
    .signers([authorityKeypair])
    .rpc();

  console.log('Score config initialized:', {
    authority: authorityKeypair.publicKey.toBase58(),
    scoreConfig: scoreConfigPda.toBase58(),
    tx,
  });

  return tx;
}

/**
 * Update score-sync config authority or pause state
 */
export async function updateScoreConfig(
  program: Program<any>,
  authorityKeypair: Keypair,
  params: {
    nextAuthority: PublicKey;
    acceptedScoreVersion?: ScoreVersion;
    paused: boolean;
  }
): Promise<string> {
  const [scoreConfigPda] = deriveScoreConfigPda(program.programId);

  const tx = await program.methods
    .updateScoreConfig(
      params.nextAuthority,
      SCORE_VERSION_MAP[params.acceptedScoreVersion ?? 'v3'],
      params.paused
    )
    .accounts({
      authority: authorityKeypair.publicKey,
      scoreConfig: scoreConfigPda,
    })
    .signers([authorityKeypair])
    .rpc();

  console.log('Score config updated:', {
    authority: authorityKeypair.publicKey.toBase58(),
    nextAuthority: params.nextAuthority.toBase58(),
    paused: params.paused,
    tx,
  });

  return tx;
}

/**
 * Sync a calibration-ready V3 score summary onchain
 */
export async function syncScoreSnapshotV3(
  program: Program<any>,
  authorityKeypair: Keypair,
  forecasterPubkey: PublicKey,
  summary: CalibrationScoreSummaryInput,
  proofHashHex?: string
): Promise<string> {
  const [scoreConfigPda] = deriveScoreConfigPda(program.programId);
  const [scoreSnapshotPda] = deriveScoreSnapshotV3Pda(
    forecasterPubkey,
    program.programId
  );

  const args = {
    scoreVersion: SCORE_VERSION_MAP[summary.scoreVersion],
    status: STATUS_MAP[summary.status],
    tier: TIER_MAP[summary.tier],
    snapshotHash: hexToBytes(summary.snapshotHash),
    scoreEpochHash: hexToBytes(summary.scoreEpochHash),
    proofHash: proofHashHex ? hexToBytes(proofHashHex) : Array(32).fill(0),
    hasImportedScore: summary.importedScore !== null,
    importedScore: summary.importedScore ?? 0,
    hasNativeScore: summary.nativeScore !== null,
    nativeScore: summary.nativeScore ?? 0,
    vaultScore: summary.vaultScore,
    confidenceBps: summary.confidenceBps,
    nativeResolvedCount: summary.nativeResolvedCount,
    importedResolvedCount: summary.importedResolvedCount,
    maxActiveSleeveBps: summary.riskCaps.maxActiveSleeveBps,
    maxMarketExposureBps: summary.riskCaps.maxMarketExposureBps,
    maxThemeExposureBps: summary.riskCaps.maxThemeExposureBps,
    probationary: summary.riskCaps.probationary,
    penaltyFlags: summary.penaltyFlags,
    calculatedAt: new BN(summary.calculatedAtUnixSeconds),
  };

  const tx = await program.methods
    .syncScoreSnapshotV3(args)
    .accounts({
      authority: authorityKeypair.publicKey,
      scoreConfig: scoreConfigPda,
      forecaster: forecasterPubkey,
      scoreSnapshotV3: scoreSnapshotPda,
      systemProgram: web3.SystemProgram.programId,
    })
    .signers([authorityKeypair])
    .rpc();

  console.log('Score snapshot synced:', {
    authority: authorityKeypair.publicKey.toBase58(),
    forecaster: forecasterPubkey.toBase58(),
    vaultScore: summary.vaultScore,
    scoreSnapshot: scoreSnapshotPda.toBase58(),
    tx,
  });

  return tx;
}

/**
 * Fetch forecaster calibration stats
 */
export async function getForecasterStats(
  program: Program<any>,
  forecasterPubkey: PublicKey
): Promise<any> {
  const [forecasterStatePda] = deriveForecasterPda(
    forecasterPubkey,
    program.programId
  );

  const forecasterState = await program.account.forecasterState.fetch(forecasterStatePda);

  return {
    authority: forecasterState.authority.toBase58(),
    totalPredictions: forecasterState.totalPredictions,
    resolvedPredictions: forecasterState.resolvedPredictions,
    avgBrierScore: forecasterState.avgBrierScore,
    avgLogScore: forecasterState.avgLogScore,
    accuracy: forecasterState.accuracy,
    correctPredictions: forecasterState.correctPredictions,
    marketsTraded: forecasterState.marketsTraded,
    streakCorrect: forecasterState.streakCorrect,
    maxStreakCorrect: forecasterState.maxStreakCorrect,
    lastPredictionTs: new Date(forecasterState.lastPredictionTs.toNumber() * 1000),
    createdAt: new Date(forecasterState.createdAt.toNumber() * 1000),
    calibrationBuckets: forecasterState.calibrationBuckets,
  };
}

/**
 * Fetch score-sync config
 */
export async function getScoreConfig(program: Program<any>): Promise<any> {
  const [scoreConfigPda] = deriveScoreConfigPda(program.programId);
  const scoreConfig = await program.account.scoreConfig.fetch(scoreConfigPda);

  return {
    authority: scoreConfig.authority.toBase58(),
    acceptedScoreVersion: scoreConfig.acceptedScoreVersion,
    paused: scoreConfig.paused,
    lastUpdatedSlot: scoreConfig.lastUpdatedSlot.toString(),
  };
}

/**
 * Fetch latest V3 score snapshot for a forecaster
 */
export async function getScoreSnapshotV3(
  program: Program<any>,
  forecasterPubkey: PublicKey
): Promise<any | null> {
  const [scoreSnapshotPda] = deriveScoreSnapshotV3Pda(
    forecasterPubkey,
    program.programId
  );

  try {
    const snapshot = await program.account.scoreSnapshotV3.fetch(scoreSnapshotPda);

    return {
      forecaster: snapshot.forecaster.toBase58(),
      scoreVersion: snapshot.scoreVersion,
      status: STATUS_LABELS[snapshot.status] ?? 'Restricted',
      tier: TIER_LABELS[snapshot.tier] ?? 'restricted',
      snapshotHash: bytesToHex(snapshot.snapshotHash),
      scoreEpochHash: bytesToHex(snapshot.scoreEpochHash),
      proofHash: bytesToHex(snapshot.proofHash),
      importedScore: snapshot.hasImportedScore ? snapshot.importedScore : null,
      nativeScore: snapshot.hasNativeScore ? snapshot.nativeScore : null,
      vaultScore: snapshot.vaultScore,
      confidenceBps: snapshot.confidenceBps,
      nativeResolvedCount: snapshot.nativeResolvedCount,
      importedResolvedCount: snapshot.importedResolvedCount,
      maxActiveSleeveBps: snapshot.maxActiveSleeveBps,
      maxMarketExposureBps: snapshot.maxMarketExposureBps,
      maxThemeExposureBps: snapshot.maxThemeExposureBps,
      probationary: snapshot.probationary,
      penaltyFlags: snapshot.penaltyFlags,
      calculatedAt: new Date(snapshot.calculatedAt.toNumber() * 1000),
      updatedAt: new Date(snapshot.updatedAt.toNumber() * 1000),
      updatedSlot: snapshot.updatedSlot.toString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Account does not exist') || message.includes('Account not found')) {
      return null;
    }

    throw error;
  }
}

/**
 * Fetch prediction record details
 */
export async function getPredictionRecord(
  program: Program<any>,
  predictionPda: PublicKey
): Promise<any> {
  const prediction = await program.account.predictionRecord.fetch(predictionPda);

  return {
    forecaster: prediction.forecaster.toBase58(),
    marketId: Buffer.from(prediction.marketId).toString('hex'),
    predictedProbability: prediction.predictedProbability,
    direction: prediction.direction,
    committedAt: new Date(prediction.committedAt.toNumber() * 1000),
    resolvedAt: prediction.resolvedAt
      ? new Date(prediction.resolvedAt.toNumber() * 1000)
      : null,
    outcome: prediction.outcome,
    brierScore: prediction.brierScore,
    logScore: prediction.logScore,
    category: prediction.category,
  };
}

/**
 * Get top forecasters (requires fetching all forecaster accounts)
 */
export async function getTopForecasters(
  program: Program<any>,
  limit: number = 10
): Promise<any[]> {
  const forecasters = await program.account.forecasterState.all();

  return forecasters
    .sort((a, b) => a.account.avgBrierScore - b.account.avgBrierScore)
    .slice(0, limit)
    .map((f) => ({
      pubkey: f.publicKey.toBase58(),
      authority: f.account.authority.toBase58(),
      avgBrierScore: f.account.avgBrierScore,
      accuracy: f.account.accuracy,
      resolvedPredictions: f.account.resolvedPredictions,
      streakCorrect: f.account.streakCorrect,
    }));
}

// ========================================
// STATE COMPRESSION (99% COST REDUCTION)
// ========================================

/**
 * SPL Account Compression Program ID
 */
export const SPL_ACCOUNT_COMPRESSION_PROGRAM_ID = new PublicKey(
  'cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK'
);

/**
 * SPL Noop Program ID (for logging compressed data)
 */
export const SPL_NOOP_PROGRAM_ID = new PublicKey(
  'noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV'
);

/**
 * Initialize a concurrent Merkle tree for compressed predictions
 *
 * Tree capacity configurations:
 * - Small (1K predictions): maxDepth=10, maxBufferSize=64, cost=~0.001 SOL
 * - Medium (16K predictions): maxDepth=14, maxBufferSize=64, cost=~0.002 SOL
 * - Large (262K predictions): maxDepth=18, maxBufferSize=256, cost=~0.005 SOL
 * - Massive (1M predictions): maxDepth=20, maxBufferSize=256, cost=~0.01 SOL
 *
 * @param program - Anchor program instance
 * @param payer - Keypair paying for tree initialization
 * @param treeKeypair - Keypair for the Merkle tree account
 * @param treeAuthority - Who can append to the tree (usually forecaster or program PDA)
 * @param maxDepth - Tree depth (3-30, determines capacity: 2^depth)
 * @param maxBufferSize - Buffer size (8-2048, affects concurrent writes)
 */
export async function initializeMerkleTree(
  program: Program<any>,
  payer: Keypair,
  treeKeypair: Keypair,
  treeAuthority: PublicKey,
  maxDepth: number = 14, // 16,384 predictions by default
  maxBufferSize: number = 64
): Promise<string> {
  const tx = await program.methods
    .initializeMerkleTree(maxDepth, maxBufferSize)
    .accounts({
      payer: payer.publicKey,
      treeAuthority,
      merkleTree: treeKeypair.publicKey,
      compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    })
    .signers([payer, treeKeypair])
    .rpc();

  console.log('Merkle tree initialized:', {
    tree: treeKeypair.publicKey.toBase58(),
    authority: treeAuthority.toBase58(),
    capacity: Math.pow(2, maxDepth),
    maxDepth,
    maxBufferSize,
    estimatedCostPerPrediction: '$0.0001',
    tx,
  });

  return tx;
}

/**
 * Record a compressed prediction (99% cheaper than PDA version)
 *
 * Cost: ~$0.0001 per prediction (vs $0.27 for regular PDAs)
 *
 * @param program - Anchor program instance
 * @param forecasterKeypair - Forecaster making the prediction
 * @param merkleTree - Merkle tree account to store prediction in
 * @param marketId - Market identifier (will be hashed to 32 bytes)
 * @param predictedProbability - Prediction probability (0.0 - 1.0)
 * @param direction - 'Yes' or 'No'
 * @param memoTxSignature - Base58 signature from Memo transaction
 * @param category - Market category (0-255)
 */
export async function recordCompressedPrediction(
  program: Program<any>,
  forecasterKeypair: Keypair,
  merkleTree: PublicKey,
  marketId: string,
  predictedProbability: number,
  direction: 'Yes' | 'No',
  memoTxSignature: string,
  category: number = 0
): Promise<string> {
  // Hash market ID to 32 bytes
  const marketIdHash = Buffer.alloc(32);
  Buffer.from(marketId).copy(marketIdHash);

  // Parse memo tx signature
  const memoTxBytes = bs58.decode(memoTxSignature);
  const memoTxArray = Array.from(memoTxBytes).concat(Array(64 - memoTxBytes.length).fill(0));

  const [forecasterStatePda] = deriveForecasterPda(
    forecasterKeypair.publicKey,
    program.programId
  );

  const tx = await program.methods
    .recordCompressedPrediction(
      Array.from(marketIdHash),
      predictedProbability,
      direction === 'Yes' ? { yes: {} } : { no: {} },
      memoTxArray,
      category
    )
    .accounts({
      authority: forecasterKeypair.publicKey,
      forecasterState: forecasterStatePda,
      merkleTree,
      compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
      logWrapper: SPL_NOOP_PROGRAM_ID,
    })
    .signers([forecasterKeypair])
    .rpc();

  console.log('Compressed prediction recorded:', {
    forecaster: forecasterKeypair.publicKey.toBase58(),
    merkleTree: merkleTree.toBase58(),
    marketId,
    probability: predictedProbability,
    direction,
    cost: '~$0.0001',
    savingsVsPDA: '99%',
    tx,
  });

  return tx;
}

/**
 * Fetch compressed predictions from Helius DAS API
 *
 * Note: Compressed data is not queryable via standard RPC.
 * You must use an indexer like Helius to read compressed account data.
 *
 * @param heliusApiKey - Your Helius API key (get from helius.dev)
 * @param merkleTree - Merkle tree address
 * @param limit - Number of predictions to fetch
 */
export async function getCompressedPredictions(
  heliusApiKey: string,
  merkleTree: PublicKey,
  limit: number = 100
): Promise<any[]> {
  const url = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'beright-calibration',
      method: 'getAssetsByGroup',
      params: {
        groupKey: 'collection',
        groupValue: merkleTree.toBase58(),
        page: 1,
        limit,
      },
    }),
  });

  const { result } = await response.json() as {
    result?: { items?: any[] };
  };

  return result?.items?.map((item: any) => ({
    id: item.id,
    content: item.content,
    compression: item.compression,
    // Parse prediction data from content
  })) || [];
}

/**
 * Cost comparison helper
 */
export function calculateCostSavings(numPredictions: number) {
  const pdaCost = numPredictions * 0.27; // $0.27 per PDA
  const compressedCost = numPredictions * 0.0001; // $0.0001 per compressed
  const savings = pdaCost - compressedCost;
  const savingsPercent = ((savings / pdaCost) * 100).toFixed(1);

  return {
    predictions: numPredictions,
    pdaApproach: {
      total: `$${pdaCost.toFixed(2)}`,
      perPrediction: '$0.27',
    },
    compressedApproach: {
      total: `$${compressedCost.toFixed(2)}`,
      perPrediction: '$0.0001',
    },
    savings: {
      dollars: `$${savings.toFixed(2)}`,
      percent: `${savingsPercent}%`,
    },
  };
}

/**
 * Example usage:
 *
 * // 1M predictions comparison
 * console.log(calculateCostSavings(1_000_000));
 * // Output:
 * // {
 * //   pdaApproach: { total: "$270,000.00" },
 * //   compressedApproach: { total: "$100.00" },
 * //   savings: { dollars: "$269,900.00", percent: "99.96%" }
 * // }
 */
