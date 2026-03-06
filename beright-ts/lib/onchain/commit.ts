/**
 * BeRight On-Chain Commit
 *
 * Commit predictions to Solana blockchain via:
 * 1. Memo Program (immutable timestamped log)
 * 2. Calibration Program (structured Brier tracking)
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { formatPredictionMemo, formatResolutionMemo, MEMO_PROGRAM_ID } from './memo';
import { Direction, MemoTxResult, BrierInput } from './types';
import { calculateBrierScore } from './memo';
import { getSigner, SolanaSigner } from '../signer';
import { secrets } from '../secrets';
import { recordPredictionOnChain, CalibrationCommitResult } from './calibration';

/**
 * Get Solana connection via signer
 */
export function getConnection(): Connection {
  return getSigner().getConnection();
}

/**
 * Get wallet keypair from secrets manager
 * @deprecated Use getSigner() instead for better security
 */
export function getWalletKeypair(): Keypair {
  const privateKey = secrets.getSolanaPrivateKey();
  return Keypair.fromSecretKey(privateKey);
}

/**
 * Create a memo instruction
 */
function createMemoInstruction(memo: string, signer: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    keys: [{ pubkey: signer, isSigner: true, isWritable: true }],
    programId: new PublicKey(MEMO_PROGRAM_ID),
    data: Buffer.from(memo, 'utf-8'),
  });
}

/**
 * Commit a prediction to a specific network connection
 * (Used internally by commitPredictionWithCalibration to ensure same network)
 */
async function commitPredictionToNetwork(
  connection: Connection,
  userPubkey: string,
  marketId: string,
  probability: number,
  direction: Direction
): Promise<MemoTxResult> {
  try {
    const wallet = getWalletKeypair();

    // Format the memo
    const memo = formatPredictionMemo(userPubkey, marketId, probability, direction);
    console.log('Committing prediction memo:', memo);

    // Create transaction
    const transaction = new Transaction().add(
      createMemoInstruction(memo, wallet.publicKey)
    );

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    // Send and confirm
    const signature = await sendAndConfirmTransaction(connection, transaction, [wallet], {
      commitment: 'confirmed',
    });

    console.log('Prediction committed:', signature);

    return {
      success: true,
      signature,
      explorerUrl: `https://solscan.io/tx/${signature}?cluster=devnet`,
    };
  } catch (error: any) {
    console.error('Failed to commit prediction:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Commit a prediction on-chain (Memo only - legacy)
 *
 * @param userPubkey - User's public key (for tracking, not signing)
 * @param marketId - Market identifier
 * @param probability - Predicted probability (0-1)
 * @param direction - YES or NO
 * @returns Transaction result with signature
 */
export async function commitPrediction(
  userPubkey: string,
  marketId: string,
  probability: number,
  direction: Direction
): Promise<MemoTxResult> {
  try {
    const connection = getConnection();
    const wallet = getWalletKeypair();

    // Format the memo
    const memo = formatPredictionMemo(userPubkey, marketId, probability, direction);
    console.log('Committing prediction memo:', memo);

    // Create transaction
    const transaction = new Transaction().add(
      createMemoInstruction(memo, wallet.publicKey)
    );

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    // Send and confirm
    const signature = await sendAndConfirmTransaction(connection, transaction, [wallet], {
      commitment: 'confirmed',
    });

    console.log('Prediction committed:', signature);

    return {
      success: true,
      signature,
      explorerUrl: `https://solscan.io/tx/${signature}`,
    };
  } catch (error: any) {
    console.error('Failed to commit prediction:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Commit a prediction on-chain with full calibration tracking
 *
 * Hybrid approach:
 * 1. First sends Memo transaction (immutable timestamped log)
 * 2. Then records to Calibration program (structured Brier tracking)
 *
 * Both transactions go to the same network (devnet by default for calibration).
 *
 * @param userPubkey - User's public key (for tracking)
 * @param marketId - Market identifier
 * @param probability - Predicted probability (0-1)
 * @param direction - YES or NO
 * @param category - Market category (0-255, default 0)
 * @returns Combined result with both transaction signatures
 */
export async function commitPredictionWithCalibration(
  userPubkey: string,
  marketId: string,
  probability: number,
  direction: Direction,
  category: number = 0
): Promise<CalibrationCommitResult> {
  const wallet = getWalletKeypair();

  // Import calibration connection to use same network for both
  const { getCalibrationConnection } = await import('./calibration');
  const calibrationConnection = getCalibrationConnection();

  try {
    // Step 1: Send Memo transaction first (immutable commitment)
    // Use calibration connection to ensure same network
    const memoResult = await commitPredictionToNetwork(
      calibrationConnection,
      userPubkey,
      marketId,
      probability,
      direction
    );

    if (!memoResult.success || !memoResult.signature) {
      return {
        memoTx: '',
        success: false,
        error: memoResult.error || 'Memo transaction failed',
        forecasterPda: '',
      };
    }

    console.log('Memo committed, now recording to calibration program...');

    // Step 2: Record to Calibration program
    try {
      const calibrationTx = await recordPredictionOnChain(
        marketId,
        probability,
        direction,
        memoResult.signature,
        category
      );

      // Get forecaster PDA for response
      const { deriveForecasterPda } = await import('./calibration');
      const [forecasterPda] = deriveForecasterPda(wallet.publicKey);

      return {
        memoTx: memoResult.signature,
        calibrationTx,
        forecasterPda: forecasterPda.toBase58(),
        success: true,
      };
    } catch (calibrationError: any) {
      // Memo succeeded but calibration failed - still return partial success
      console.error('Calibration recording failed (memo succeeded):', calibrationError);

      const { deriveForecasterPda } = await import('./calibration');
      const [forecasterPda] = deriveForecasterPda(wallet.publicKey);

      return {
        memoTx: memoResult.signature,
        forecasterPda: forecasterPda.toBase58(),
        success: true, // Memo succeeded, which is the critical part
        error: `Calibration failed: ${calibrationError.message}`,
      };
    }
  } catch (error: any) {
    console.error('Failed to commit prediction with calibration:', error);
    return {
      memoTx: '',
      forecasterPda: '',
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Resolve a prediction on-chain
 *
 * @param commitTx - Original prediction transaction signature
 * @param probability - Original predicted probability
 * @param direction - Original predicted direction
 * @param outcome - Actual outcome (true = YES won)
 * @returns Transaction result with signature
 */
export async function resolvePrediction(
  commitTx: string,
  probability: number,
  direction: Direction,
  outcome: boolean
): Promise<MemoTxResult> {
  try {
    const connection = getConnection();
    const wallet = getWalletKeypair();

    // Calculate Brier score
    const brierScore = calculateBrierScore({
      probability,
      direction,
      outcome,
    });

    // Determine outcome direction
    const outcomeDirection: Direction = outcome ? 'YES' : 'NO';

    // Format the resolution memo
    const memo = formatResolutionMemo(commitTx, outcomeDirection, brierScore);
    console.log('Resolving prediction memo:', memo);

    // Create transaction
    const transaction = new Transaction().add(
      createMemoInstruction(memo, wallet.publicKey)
    );

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    // Send and confirm
    const signature = await sendAndConfirmTransaction(connection, transaction, [wallet], {
      commitment: 'confirmed',
    });

    console.log('Prediction resolved:', signature);

    return {
      success: true,
      signature,
      explorerUrl: `https://solscan.io/tx/${signature}`,
    };
  } catch (error: any) {
    console.error('Failed to resolve prediction:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Estimate cost of a memo transaction
 */
export async function estimateMemoTransactionCost(): Promise<{
  lamports: number;
  sol: number;
  usd: number;
}> {
  const connection = getConnection();

  // Memo transactions are very cheap - just the base fee
  // Typical cost is ~5000 lamports (0.000005 SOL)
  const baseFee = 5000;

  // Get SOL price (approximate)
  const solPrice = 150; // TODO: Fetch real price

  return {
    lamports: baseFee,
    sol: baseFee / 1e9,
    usd: (baseFee / 1e9) * solPrice,
  };
}

/**
 * Get wallet balance
 */
export async function getWalletBalance(): Promise<{
  lamports: number;
  sol: number;
  canCommit: boolean;
  estimatedPredictions: number;
}> {
  const connection = getConnection();
  const wallet = getWalletKeypair();

  const balance = await connection.getBalance(wallet.publicKey);
  const costPerTx = 5000; // lamports
  const estimatedPredictions = Math.floor(balance / (costPerTx * 2)); // 2 txs per prediction lifecycle

  return {
    lamports: balance,
    sol: balance / 1e9,
    canCommit: balance > costPerTx,
    estimatedPredictions,
  };
}

/**
 * Batch commit multiple predictions (cost-efficient)
 *
 * Note: Solana allows ~1232 bytes per transaction
 * Each memo is ~200 bytes, so we can fit ~6 per transaction
 */
export async function batchCommitPredictions(
  predictions: Array<{
    userPubkey: string;
    marketId: string;
    probability: number;
    direction: Direction;
  }>
): Promise<MemoTxResult> {
  try {
    const connection = getConnection();
    const wallet = getWalletKeypair();

    // Create transaction with multiple memos
    const transaction = new Transaction();

    for (const pred of predictions) {
      const memo = formatPredictionMemo(
        pred.userPubkey,
        pred.marketId,
        pred.probability,
        pred.direction
      );
      transaction.add(createMemoInstruction(memo, wallet.publicKey));
    }

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    // Send and confirm
    const signature = await sendAndConfirmTransaction(connection, transaction, [wallet], {
      commitment: 'confirmed',
    });

    console.log(`Batch committed ${predictions.length} predictions:`, signature);

    return {
      success: true,
      signature,
      explorerUrl: `https://solscan.io/tx/${signature}`,
    };
  } catch (error: any) {
    console.error('Failed to batch commit:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}
