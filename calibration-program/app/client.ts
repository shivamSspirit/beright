/**
 * BeRight Calibration Program - TypeScript Client
 *
 * Provides utilities for interacting with the on-chain calibration program.
 */

import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { PublicKey, Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

type DynamicAnchorProgram = Program<any> & {
  methods: Record<string, any>;
  account: Record<string, any>;
};

function asDynamicProgram(program: Program<any>): DynamicAnchorProgram {
  return program as unknown as DynamicAnchorProgram;
}

// Program ID (synced with declare_id! in lib.rs)
export const CALIBRATION_PROGRAM_ID = new PublicKey(
  'GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ'
);

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

/** Stable PDA for the authority-governed Forecaster Passport configuration. */
export function derivePassportConfigPda(
  programId: PublicKey = CALIBRATION_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('passport_config')], programId);
}

/** Stable PDA for a published Passport v1 commitment. The subject never signs issuer writes. */
export function derivePassportSnapshotV1Pda(
  subject: PublicKey,
  programId: PublicKey = CALIBRATION_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('passport_v1'), subject.toBuffer()], programId);
}

export interface PassportSnapshotV1Account {
  bump: number; subject: PublicKey; issuer: PublicKey; schemaVersion: number; status: number;
  passportRoot: string; evidenceRoot: string; topicVectorHash: string; scoringCodeHash: string;
  scoreEpoch: BN; dataWindowStart: BN; dataWindowEnd: BN; evidenceCount: number; confidenceBps: number;
  issuedAt: BN; expiresAt: BN; revokedAt: BN; revocationReasonHash: string; updatedSlot: BN;
}

export function parsePassportSnapshotV1Account(value: Record<string, unknown>): PassportSnapshotV1Account {
  const bytes = (field: string) => bytesToHex(value[field] as Uint8Array);
  return { bump: value.bump as number, subject: value.subject as PublicKey, issuer: value.issuer as PublicKey,
    schemaVersion: value.schemaVersion as number, status: value.status as number, passportRoot: bytes('passportRoot'), evidenceRoot: bytes('evidenceRoot'),
    topicVectorHash: bytes('topicVectorHash'), scoringCodeHash: bytes('scoringCodeHash'), scoreEpoch: value.scoreEpoch as BN,
    dataWindowStart: value.dataWindowStart as BN, dataWindowEnd: value.dataWindowEnd as BN, evidenceCount: value.evidenceCount as number,
    confidenceBps: value.confidenceBps as number, issuedAt: value.issuedAt as BN, expiresAt: value.expiresAt as BN,
    revokedAt: value.revokedAt as BN, revocationReasonHash: bytes('revocationReasonHash'), updatedSlot: value.updatedSlot as BN };
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

  const tx = await asDynamicProgram(program).methods
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

  const tx = await asDynamicProgram(program).methods
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
  forecasterPubkey: PublicKey,
  resolverKeypair: Keypair,
  predictionPda: PublicKey,
  outcome: boolean
): Promise<string> {
  const [forecasterStatePda] = deriveForecasterPda(
    forecasterPubkey,
    program.programId
  );
  const [scoreConfigPda] = deriveScoreConfigPda(program.programId);

  const tx = await asDynamicProgram(program).methods
    .resolvePrediction(outcome)
    .accounts({
      resolver: resolverKeypair.publicKey,
      scoreConfig: scoreConfigPda,
      predictionRecord: predictionPda,
      forecasterState: forecasterStatePda,
    })
    .signers([resolverKeypair])
    .rpc();

  console.log('Prediction resolved:', {
    forecaster: forecasterPubkey.toBase58(),
    resolver: resolverKeypair.publicKey.toBase58(),
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

  const tx = await asDynamicProgram(program).methods
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
    acceptedScoreVersion?: never;
    paused: boolean;
  }
): Promise<string> {
  const [scoreConfigPda] = deriveScoreConfigPda(program.programId);

  const tx = await asDynamicProgram(program).methods
    .updateScoreConfig(
      params.nextAuthority,
      0,
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

  const forecasterState = await asDynamicProgram(program).account.forecasterState.fetch(forecasterStatePda);

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
  const scoreConfig = await asDynamicProgram(program).account.scoreConfig.fetch(scoreConfigPda);

  return {
    authority: scoreConfig.authority.toBase58(),
    acceptedScoreVersion: scoreConfig.acceptedScoreVersion,
    paused: scoreConfig.paused,
    lastUpdatedSlot: scoreConfig.lastUpdatedSlot.toString(),
  };
}

/**
 * Fetch prediction record details
 */
export async function getPredictionRecord(
  program: Program<any>,
  predictionPda: PublicKey
): Promise<any> {
  const prediction = await asDynamicProgram(program).account.predictionRecord.fetch(predictionPda);

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
  const forecasters = await asDynamicProgram(program).account.forecasterState.all() as Array<{
    publicKey: PublicKey;
    account: {
      authority: PublicKey;
      avgBrierScore: number;
      accuracy: number;
      resolvedPredictions: number;
      streakCorrect: number;
    };
  }>;

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
  const tx = await asDynamicProgram(program).methods
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

  const tx = await asDynamicProgram(program).methods
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
