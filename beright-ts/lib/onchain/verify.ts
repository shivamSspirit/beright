/**
 * BeRight On-Chain Verification
 *
 * Verify predictions committed to Solana blockchain
 */

import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { parseMemo, calculateBrierScore, MEMO_PROGRAM_ID } from './memo';
import { PredictionCommit, ResolutionCommit, ParsedMemo, Direction } from './types';

const RPC_URL = process.env.HELIUS_RPC_MAINNET || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

/**
 * Get Solana connection
 */
function getConnection(): Connection {
  return new Connection(RPC_URL, 'confirmed');
}

/**
 * Fetch and parse a prediction from chain
 */
export async function fetchPrediction(txSignature: string): Promise<{
  found: boolean;
  prediction?: PredictionCommit;
  blockTime?: number;
  error?: string;
}> {
  try {
    const connection = getConnection();
    const tx = await connection.getParsedTransaction(txSignature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return { found: false, error: 'Transaction not found' };
    }

    // Find memo instruction
    const memoInstruction = tx.transaction.message.instructions.find(
      (ix: any) => ix.programId?.toString() === MEMO_PROGRAM_ID
    );

    if (!memoInstruction) {
      return { found: false, error: 'No memo found in transaction' };
    }

    // Parse memo data
    const memoData = (memoInstruction as any).parsed;
    if (!memoData) {
      return { found: false, error: 'Could not parse memo' };
    }

    const parsed = parseMemo(memoData);
    if (!parsed || parsed.type !== 'PREDICT') {
      return { found: false, error: 'Not a BeRight prediction memo' };
    }

    return {
      found: true,
      prediction: parsed.data as PredictionCommit,
      blockTime: tx.blockTime || undefined,
    };
  } catch (error: any) {
    return { found: false, error: error.message };
  }
}

/**
 * Fetch and parse a resolution from chain
 */
export async function fetchResolution(txSignature: string): Promise<{
  found: boolean;
  resolution?: ResolutionCommit;
  blockTime?: number;
  error?: string;
}> {
  try {
    const connection = getConnection();
    const tx = await connection.getParsedTransaction(txSignature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return { found: false, error: 'Transaction not found' };
    }

    // Find memo instruction
    const memoInstruction = tx.transaction.message.instructions.find(
      (ix: any) => ix.programId?.toString() === MEMO_PROGRAM_ID
    );

    if (!memoInstruction) {
      return { found: false, error: 'No memo found in transaction' };
    }

    const memoData = (memoInstruction as any).parsed;
    const parsed = parseMemo(memoData);

    if (!parsed || parsed.type !== 'RESOLVE') {
      return { found: false, error: 'Not a BeRight resolution memo' };
    }

    return {
      found: true,
      resolution: parsed.data as ResolutionCommit,
      blockTime: tx.blockTime || undefined,
    };
  } catch (error: any) {
    return { found: false, error: error.message };
  }
}

/**
 * Verify a complete prediction lifecycle
 *
 * Checks:
 * 1. Prediction was committed before market resolution
 * 2. Brier score is correctly calculated
 * 3. Resolution references the correct commit
 */
export async function verifyPrediction(
  commitTx: string,
  resolutionTx: string,
  marketResolutionTime: number // Unix timestamp when market resolved
): Promise<{
  valid: boolean;
  errors: string[];
  details?: {
    prediction: PredictionCommit;
    resolution: ResolutionCommit;
    commitTime: number;
    resolveTime: number;
    expectedBrierScore: number;
    actualBrierScore: number;
  };
}> {
  const errors: string[] = [];

  // Fetch prediction
  const predResult = await fetchPrediction(commitTx);
  if (!predResult.found || !predResult.prediction) {
    return { valid: false, errors: ['Could not fetch prediction: ' + predResult.error] };
  }

  // Fetch resolution
  const resResult = await fetchResolution(resolutionTx);
  if (!resResult.found || !resResult.resolution) {
    return { valid: false, errors: ['Could not fetch resolution: ' + resResult.error] };
  }

  const prediction = predResult.prediction;
  const resolution = resResult.resolution;

  // Check 1: Resolution references correct commit
  if (resolution.commitTx !== commitTx) {
    errors.push('Resolution does not reference the correct commit transaction');
  }

  // Check 2: Prediction was made before market resolution
  if (predResult.blockTime && predResult.blockTime > marketResolutionTime) {
    errors.push('Prediction was made after market resolved');
  }

  // Check 3: Verify Brier score calculation
  const outcomeBoolean = resolution.outcome === 'YES';
  const expectedBrier = calculateBrierScore({
    probability: prediction.probability,
    direction: prediction.direction,
    outcome: outcomeBoolean,
  });

  // Allow small floating point difference
  if (Math.abs(expectedBrier - resolution.brierScore) > 0.0001) {
    errors.push(
      `Brier score mismatch: expected ${expectedBrier.toFixed(4)}, got ${resolution.brierScore.toFixed(4)}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    details: {
      prediction,
      resolution,
      commitTime: predResult.blockTime || 0,
      resolveTime: resResult.blockTime || 0,
      expectedBrierScore: expectedBrier,
      actualBrierScore: resolution.brierScore,
    },
  };
}

/**
 * Get all BeRight predictions for a user
 *
 * Note: This requires an indexer or iterating through transactions
 * For now, we'll rely on Supabase as the source of truth
 * and use this for verification only
 */
export async function getUserPredictions(
  userPubkey: string,
  options?: {
    limit?: number;
    before?: string; // TX signature to start before
  }
): Promise<{
  predictions: Array<{
    txSignature: string;
    prediction: PredictionCommit;
    blockTime: number;
  }>;
  hasMore: boolean;
}> {
  // This would require indexing or using Helius/Shyft webhooks
  // For MVP, we track in Supabase and verify on-demand

  console.warn(
    'getUserPredictions: Full on-chain query not implemented. Use Supabase as source of truth.'
  );

  return {
    predictions: [],
    hasMore: false,
  };
}

/**
 * Generate verification proof for a prediction
 *
 * Returns a shareable proof that anyone can verify
 */
export function generateVerificationProof(
  commitTx: string,
  resolutionTx?: string
): {
  proofUrl: string;
  commitExplorer: string;
  resolveExplorer?: string;
  verifyCommand: string;
} {
  const base = 'https://solscan.io/tx/';

  return {
    proofUrl: `https://beright.app/verify/${commitTx}`,
    commitExplorer: `${base}${commitTx}`,
    resolveExplorer: resolutionTx ? `${base}${resolutionTx}` : undefined,
    verifyCommand: `npx ts-node lib/onchain/verify.ts ${commitTx}${resolutionTx ? ' ' + resolutionTx : ''}`,
  };
}

/**
 * CLI verification
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npx ts-node lib/onchain/verify.ts <commitTx> [resolutionTx] [marketResolutionTime]');
    console.log('\nExamples:');
    console.log('  Fetch prediction:  npx ts-node lib/onchain/verify.ts abc123...');
    console.log('  Full verification: npx ts-node lib/onchain/verify.ts abc123... def456... 1707494400');
    process.exit(1);
  }

  const commitTx = args[0];

  if (args.length === 1) {
    // Just fetch and display prediction
    console.log('Fetching prediction:', commitTx);
    const result = await fetchPrediction(commitTx);
    console.log(JSON.stringify(result, null, 2));
  } else if (args.length >= 2) {
    // Full verification
    const resolutionTx = args[1];
    const marketResolutionTime = parseInt(args[2]) || Math.floor(Date.now() / 1000);

    console.log('Verifying prediction lifecycle...');
    console.log('  Commit TX:', commitTx);
    console.log('  Resolution TX:', resolutionTx);
    console.log('  Market resolved at:', new Date(marketResolutionTime * 1000).toISOString());

    const result = await verifyPrediction(commitTx, resolutionTx, marketResolutionTime);
    console.log('\nResult:', result.valid ? '✅ VALID' : '❌ INVALID');

    if (result.errors.length > 0) {
      console.log('Errors:', result.errors);
    }

    if (result.details) {
      console.log('\nDetails:');
      console.log('  Probability:', result.details.prediction.probability);
      console.log('  Direction:', result.details.prediction.direction);
      console.log('  Outcome:', result.details.resolution.outcome);
      console.log('  Brier Score:', result.details.actualBrierScore);
    }
  }
}

// Run CLI if executed directly
if (require.main === module) {
  main().catch(console.error);
}
