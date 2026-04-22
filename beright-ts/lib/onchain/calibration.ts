/**
 * BeRight Calibration Program Integration
 *
 * Integrates with the on-chain Calibration Program to track
 * forecaster Brier scores and prediction history.
 */

import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { getWalletKeypair, getConnection } from './commit';
import { Direction } from './types';

// Import IDL directly (resolveJsonModule is enabled in tsconfig)
import calibrationIdl from './calibration-idl.json';

// bs58 import - use require for compatibility
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bs58 = require('bs58');

// Program ID (from IDL)
export const CALIBRATION_PROGRAM_ID = new PublicKey(calibrationIdl.address);

// Devnet RPC endpoint
const DEVNET_RPC = 'https://api.devnet.solana.com';

// Use devnet by default for calibration program (can override via env)
let useDevnet = process.env.CALIBRATION_USE_DEVNET !== 'false';

/**
 * Get devnet connection for calibration program
 */
export function getCalibrationConnection(): Connection {
  if (useDevnet) {
    return new Connection(DEVNET_RPC, 'confirmed');
  }
  return getConnection();
}

/**
 * Set whether to use devnet for calibration
 */
export function setUseDevnet(devnet: boolean): void {
  useDevnet = devnet;
}

/**
 * Get Anchor program instance
 */
export function getCalibrationProgram(): Program {
  const connection = getCalibrationConnection();
  const wallet = getWalletKeypair();

  // Create a minimal wallet adapter
  const walletAdapter = {
    publicKey: wallet.publicKey,
    signTransaction: async (tx: web3.Transaction) => {
      tx.partialSign(wallet);
      return tx;
    },
    signAllTransactions: async (txs: web3.Transaction[]) => {
      txs.forEach((tx) => tx.partialSign(wallet));
      return txs;
    },
  };

  const provider = new AnchorProvider(
    connection,
    walletAdapter as any,
    { commitment: 'confirmed' }
  );

  return new Program(calibrationIdl as any, provider);
}

/**
 * Derive forecaster state PDA
 */
export function deriveForecasterPda(
  forecasterPubkey: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('forecaster_v2'), forecasterPubkey.toBuffer()],
    CALIBRATION_PROGRAM_ID
  );
}

/**
 * Derive prediction record PDA
 */
export function derivePredictionPda(
  forecasterPubkey: PublicKey,
  marketIdHash: Buffer,
  timestampSeed: BN
): [PublicKey, number] {
  const timestampBuffer = Buffer.alloc(8);
  timestampBuffer.writeBigInt64LE(BigInt(timestampSeed.toString()));

  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('prediction'),
      forecasterPubkey.toBuffer(),
      marketIdHash,
      timestampBuffer,
    ],
    CALIBRATION_PROGRAM_ID
  );
}

/**
 * Hash market ID to 32 bytes
 */
function hashMarketId(marketId: string): Buffer {
  const hash = Buffer.alloc(32);
  // Use a simple hash - copy bytes and pad with zeros
  const marketBytes = Buffer.from(marketId, 'utf-8');
  marketBytes.copy(hash, 0, 0, Math.min(marketBytes.length, 32));
  return hash;
}

/**
 * Check if forecaster is initialized
 */
export async function isForecasterInitialized(
  forecasterPubkey?: PublicKey
): Promise<boolean> {
  try {
    const program = getCalibrationProgram();
    const wallet = getWalletKeypair();
    const pubkey = forecasterPubkey || wallet.publicKey;
    const [forecasterStatePda] = deriveForecasterPda(pubkey);

    // Use generic account fetch with type assertion
    const account = await (program.account as any).forecasterState?.fetchNullable(
      forecasterStatePda
    );
    return account !== null;
  } catch (error) {
    console.error('Error checking forecaster initialization:', error);
    return false;
  }
}

/**
 * Initialize forecaster state (one-time setup)
 */
export async function initializeForecaster(): Promise<string> {
  const program = getCalibrationProgram();
  const wallet = getWalletKeypair();

  const [forecasterStatePda] = deriveForecasterPda(wallet.publicKey);

  console.log('Initializing forecaster:', {
    wallet: wallet.publicKey.toBase58(),
    forecasterStatePda: forecasterStatePda.toBase58(),
  });

  const tx = await program.methods
    .initializeForecaster()
    .accounts({
      authority: wallet.publicKey,
      forecasterState: forecasterStatePda,
      systemProgram: web3.SystemProgram.programId,
    })
    .signers([wallet])
    .rpc();

  console.log('Forecaster initialized:', tx);
  return tx;
}

/**
 * Record a prediction to the calibration program
 *
 * @param marketId - Market identifier
 * @param probability - Predicted probability (0-1)
 * @param direction - YES or NO
 * @param memoTxSignature - Base58 signature from Memo transaction
 * @param category - Market category (0-255)
 * @returns Transaction signature
 */
export async function recordPredictionOnChain(
  marketId: string,
  probability: number,
  direction: Direction,
  memoTxSignature: string,
  category: number = 0
): Promise<string> {
  const program = getCalibrationProgram();
  const wallet = getWalletKeypair();

  // Ensure forecaster is initialized
  const isInitialized = await isForecasterInitialized();
  if (!isInitialized) {
    console.log('Forecaster not initialized, initializing...');
    await initializeForecaster();
  }

  // Hash market ID to 32 bytes
  const marketIdHash = hashMarketId(marketId);

  // Use current timestamp as seed
  const timestampSeed = new BN(Date.now());

  // Parse memo tx signature
  const memoTxBytes = bs58.decode(memoTxSignature);
  const memoTxArray = Array.from(memoTxBytes).concat(
    Array(64 - memoTxBytes.length).fill(0)
  );

  const [forecasterStatePda] = deriveForecasterPda(wallet.publicKey);
  const [predictionPda] = derivePredictionPda(
    wallet.publicKey,
    marketIdHash,
    timestampSeed
  );

  console.log('Recording prediction on calibration program:', {
    wallet: wallet.publicKey.toBase58(),
    predictionPda: predictionPda.toBase58(),
    marketId,
    probability,
    direction,
  });

  const tx = await program.methods
    .recordPrediction(
      Array.from(marketIdHash),
      timestampSeed,
      probability,
      direction === 'YES' ? { yes: {} } : { no: {} },
      memoTxArray,
      category
    )
    .accounts({
      authority: wallet.publicKey,
      forecasterState: forecasterStatePda,
      predictionRecord: predictionPda,
      systemProgram: web3.SystemProgram.programId,
    })
    .signers([wallet])
    .rpc();

  console.log('Prediction recorded on calibration program:', tx);
  return tx;
}

/**
 * Get forecaster calibration stats
 */
export async function getForecasterStats(
  forecasterPubkey?: PublicKey
): Promise<ForecasterStats | null> {
  try {
    const program = getCalibrationProgram();
    const wallet = getWalletKeypair();
    const pubkey = forecasterPubkey || wallet.publicKey;
    const [forecasterStatePda] = deriveForecasterPda(pubkey);

    // Use generic account fetch with type assertion
    const account = await (program.account as any).forecasterState?.fetchNullable(
      forecasterStatePda
    );

    if (!account) return null;

    return {
      authority: account.authority.toBase58(),
      totalPredictions: account.totalPredictions,
      resolvedPredictions: account.resolvedPredictions,
      avgBrierScore: account.avgBrierScore,
      avgLogScore: account.avgLogScore,
      accuracy: account.accuracy,
      correctPredictions: account.correctPredictions,
      marketsTraded: account.marketsTraded,
      streakCorrect: account.streakCorrect,
      maxStreakCorrect: account.maxStreakCorrect,
      lastPredictionTs: new Date(
        account.lastPredictionTs.toNumber() * 1000
      ),
      createdAt: new Date(account.createdAt.toNumber() * 1000),
      calibrationBuckets: account.calibrationBuckets,
    };
  } catch (error) {
    console.error('Error fetching forecaster stats:', error);
    return null;
  }
}

/**
 * Resolve a prediction with the actual outcome
 */
export async function resolvePredictionOnChain(
  predictionPda: PublicKey,
  outcome: boolean
): Promise<string> {
  const program = getCalibrationProgram();
  const wallet = getWalletKeypair();

  const [forecasterStatePda] = deriveForecasterPda(wallet.publicKey);

  console.log('Resolving prediction:', {
    predictionPda: predictionPda.toBase58(),
    outcome,
  });

  const tx = await program.methods
    .resolvePrediction(outcome)
    .accounts({
      authority: wallet.publicKey,
      forecasterState: forecasterStatePda,
      predictionRecord: predictionPda,
    })
    .signers([wallet])
    .rpc();

  console.log('Prediction resolved:', tx);
  return tx;
}

/**
 * Forecaster stats interface
 */
export interface ForecasterStats {
  authority: string;
  totalPredictions: number;
  resolvedPredictions: number;
  avgBrierScore: number;
  avgLogScore: number;
  accuracy: number;
  correctPredictions: number;
  marketsTraded: number;
  streakCorrect: number;
  maxStreakCorrect: number;
  lastPredictionTs: Date;
  createdAt: Date;
  calibrationBuckets: number[][];
}

/**
 * Combined result from both memo and calibration transactions
 */
export interface CalibrationCommitResult {
  memoTx: string;
  calibrationTx?: string;
  forecasterPda: string;
  predictionPda?: string;
  success: boolean;
  error?: string;
}

/**
 * Prediction record interface (matches on-chain PredictionRecord)
 */
export interface PredictionRecord {
  bump: number;
  forecaster: string;
  marketId: string;
  marketIdHash: number[];
  predictedProbability: number;
  direction: 'YES' | 'NO';
  committedAt: Date;
  resolvedAt: Date | null;
  outcome: boolean | null;
  brierScore: number | null;
  logScore: number | null;
  memoTxSignature: string;
  category: number;
  version: number;
}

/**
 * Fetch a prediction record by PDA
 */
export async function getPredictionRecord(
  predictionPda: PublicKey
): Promise<PredictionRecord | null> {
  try {
    const program = getCalibrationProgram();

    const account = await (program.account as any).predictionRecord?.fetchNullable(
      predictionPda
    );

    if (!account) return null;

    // Decode market ID from bytes
    const marketIdBytes = Buffer.from(account.marketId);
    const marketIdStr = marketIdBytes.toString('utf-8').replace(/\0+$/, '');

    // Decode memo tx signature
    const memoSigBytes = Buffer.from(account.memoTxSignature);
    const memoSig = bs58.encode(memoSigBytes.filter((b: number) => b !== 0));

    return {
      bump: account.bump,
      forecaster: account.forecaster.toBase58(),
      marketId: marketIdStr,
      marketIdHash: account.marketId,
      predictedProbability: account.predictedProbability,
      direction: account.direction.yes ? 'YES' : 'NO',
      committedAt: new Date(account.committedAt.toNumber() * 1000),
      resolvedAt: account.resolvedAt ? new Date(account.resolvedAt.toNumber() * 1000) : null,
      outcome: account.outcome ?? null,
      brierScore: account.brierScore ?? null,
      logScore: account.logScore ?? null,
      memoTxSignature: memoSig,
      category: account.category,
      version: account.version,
    };
  } catch (error) {
    console.error('Error fetching prediction record:', error);
    return null;
  }
}

/**
 * Get all prediction PDAs for a forecaster (requires getProgramAccounts)
 * Note: This can be expensive for large datasets
 */
export async function getForecasterPredictions(
  forecasterPubkey?: PublicKey,
  limit: number = 50
): Promise<{ pda: PublicKey; record: PredictionRecord }[]> {
  try {
    const program = getCalibrationProgram();
    const wallet = getWalletKeypair();
    const pubkey = forecasterPubkey || wallet.publicKey;

    // Fetch all prediction records for this forecaster using memcmp filter
    const accounts = await (program.account as any).predictionRecord.all([
      {
        memcmp: {
          offset: 8 + 1, // discriminator + bump
          bytes: pubkey.toBase58(),
        },
      },
    ]);

    const predictions: { pda: PublicKey; record: PredictionRecord }[] = [];

    for (const { publicKey, account } of accounts.slice(0, limit)) {
      const marketIdBytes = Buffer.from(account.marketId as number[]);
      const marketIdStr = marketIdBytes.toString('utf-8').replace(/\0+$/, '');

      const memoSigBytes = Buffer.from(account.memoTxSignature as number[]);
      const memoSig = bs58.encode(memoSigBytes.filter((b: number) => b !== 0));

      predictions.push({
        pda: publicKey,
        record: {
          bump: account.bump as number,
          forecaster: (account.forecaster as PublicKey).toBase58(),
          marketId: marketIdStr,
          marketIdHash: account.marketId as number[],
          predictedProbability: account.predictedProbability as number,
          direction: (account.direction as any).yes ? 'YES' : 'NO',
          committedAt: new Date((account.committedAt as BN).toNumber() * 1000),
          resolvedAt: account.resolvedAt
            ? new Date((account.resolvedAt as BN).toNumber() * 1000)
            : null,
          outcome: (account.outcome as boolean | null) ?? null,
          brierScore: (account.brierScore as number | null) ?? null,
          logScore: (account.logScore as number | null) ?? null,
          memoTxSignature: memoSig,
          category: account.category as number,
          version: account.version as number,
        },
      });
    }

    // Sort by committedAt descending (most recent first)
    predictions.sort((a, b) => b.record.committedAt.getTime() - a.record.committedAt.getTime());

    return predictions;
  } catch (error) {
    console.error('Error fetching forecaster predictions:', error);
    return [];
  }
}

/**
 * Full prediction commit result with PDA info for later fetching
 */
export interface FullPredictionCommitResult {
  memoTx: string;
  calibrationTx: string;
  forecasterPda: string;
  predictionPda: string;
  marketId: string;
  probability: number;
  direction: Direction;
  timestampSeed: string;
  success: boolean;
  error?: string;
}

/**
 * Record prediction with full tracking data for fetching later
 */
export async function recordPredictionWithTracking(
  marketId: string,
  probability: number,
  direction: Direction,
  memoTxSignature: string,
  category: number = 0
): Promise<FullPredictionCommitResult> {
  const wallet = getWalletKeypair();
  const [forecasterStatePda] = deriveForecasterPda(wallet.publicKey);

  // Hash market ID
  const marketIdHash = hashMarketId(marketId);

  // Use current timestamp as seed
  const timestampSeed = new BN(Date.now());

  // Derive prediction PDA
  const [predictionPda] = derivePredictionPda(
    wallet.publicKey,
    marketIdHash,
    timestampSeed
  );

  try {
    const tx = await recordPredictionOnChain(
      marketId,
      probability,
      direction,
      memoTxSignature,
      category
    );

    return {
      memoTx: memoTxSignature,
      calibrationTx: tx,
      forecasterPda: forecasterStatePda.toBase58(),
      predictionPda: predictionPda.toBase58(),
      marketId,
      probability,
      direction,
      timestampSeed: timestampSeed.toString(),
      success: true,
    };
  } catch (error: any) {
    return {
      memoTx: memoTxSignature,
      calibrationTx: '',
      forecasterPda: forecasterStatePda.toBase58(),
      predictionPda: predictionPda.toBase58(),
      marketId,
      probability,
      direction,
      timestampSeed: timestampSeed.toString(),
      success: false,
      error: error?.message || 'Unknown error',
    };
  }
}
