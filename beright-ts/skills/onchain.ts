/**
 * On-Chain Audit Log for BeRight Protocol
 * Writes agent decisions to Solana as memo transactions
 * Creates verifiable, immutable proof of autonomous behavior
 */

import {
  Keypair,
  Transaction,
  TransactionInstruction,
  PublicKey,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { getConnection } from './rpc';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Solana Memo Program ID
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

// Local log for when on-chain logging is unavailable
const LOCAL_LOG_FILE = path.join(process.cwd(), 'memory', 'decisions.json');

export type DecisionType = 'DECISION' | 'PREDICTION' | 'RESOLUTION' | 'HEARTBEAT' | 'ARBITRAGE';

export interface DecisionMemo {
  v: number | 2;            // version (1 = legacy, 2 = signed commitment)
  t: DecisionType;          // type
  q: string;                // question/topic (truncated)
  consensus?: number;       // consensus probability
  spread?: number;          // arbitrage spread
  action: string;           // EXECUTE | WATCH | SKIP | PREDICT | RESOLVE
  conf: number;             // confidence 0-100
  brier?: number;           // current Brier score
  ts: number;               // unix timestamp
}

interface LogEntry {
  memo: DecisionMemo;
  txSignature: string | null;
  loggedAt: string;
  onChain: boolean;
}

/**
 * Load the agent wallet keypair from environment
 */
function loadWallet(): Keypair | null {
  const privateKeyStr = process.env.AGENT_WALLET_PRIVATE_KEY;
  if (!privateKeyStr) return null;

  try {
    const secretKey = Uint8Array.from(JSON.parse(privateKeyStr));
    return Keypair.fromSecretKey(secretKey);
  } catch {
    // Try base58 format
    try {
      const bs58 = require('bs58');
      const secretKey = bs58.decode(privateKeyStr);
      return Keypair.fromSecretKey(secretKey);
    } catch {
      console.warn('Could not parse AGENT_WALLET_PRIVATE_KEY');
      return null;
    }
  }
}

/**
 * Write a memo transaction to Solana
 */
async function writeMemoToChain(memo: DecisionMemo, wallet: Keypair): Promise<string | null> {
  try {
    const connection = getConnection();
    const memoStr = JSON.stringify(memo);

    // Memo must be < 566 bytes
    if (Buffer.byteLength(memoStr) > 566) {
      console.warn('Memo too large, truncating question');
      memo.q = memo.q.slice(0, 40);
    }

    const instruction = new TransactionInstruction({
      keys: [{ pubkey: wallet.publicKey, isSigner: true, isWritable: true }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(JSON.stringify(memo)),
    });

    const transaction = new Transaction().add(instruction);

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet],
      { commitment: 'confirmed' }
    );

    return signature;
  } catch (error) {
    console.error('On-chain memo failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Save decision to local log file (always, as backup)
 */
function saveToLocalLog(entry: LogEntry): void {
  try {
    let entries: LogEntry[] = [];
    if (fs.existsSync(LOCAL_LOG_FILE)) {
      entries = JSON.parse(fs.readFileSync(LOCAL_LOG_FILE, 'utf-8'));
    }

    entries.push(entry);

    // Keep last 1000 entries
    if (entries.length > 1000) {
      entries = entries.slice(-1000);
    }

    const dir = path.dirname(LOCAL_LOG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_LOG_FILE, JSON.stringify(entries, null, 2));
  } catch (error) {
    console.error('Could not save to local log:', error);
  }
}

/**
 * Log a decision — writes to chain if wallet available, always saves locally
 */
export async function logDecision(memo: DecisionMemo): Promise<{ txSignature: string | null; onChain: boolean }> {
  const wallet = loadWallet();
  let txSignature: string | null = null;
  let onChain = false;

  if (wallet) {
    txSignature = await writeMemoToChain(memo, wallet);
    onChain = txSignature !== null;
  }

  // Always save locally
  const entry: LogEntry = {
    memo,
    txSignature,
    loggedAt: new Date().toISOString(),
    onChain,
  };
  saveToLocalLog(entry);

  if (onChain) {
    console.log(`Decision logged on-chain: ${txSignature}`);
  } else {
    console.log('Decision logged locally (no wallet configured for on-chain)');
  }

  return { txSignature, onChain };
}

/**
 * Convenience: log a prediction decision
 */
export async function logPrediction(
  question: string,
  probability: number,
  direction: 'YES' | 'NO',
  confidence: number,
  brierScore?: number,
): Promise<{ txSignature: string | null; onChain: boolean }> {
  return logDecision({
    v: 1,
    t: 'PREDICTION',
    q: (question || 'unknown').slice(0, 80),
    consensus: probability,
    action: `PREDICT_${direction}`,
    conf: Math.round(confidence || 0),
    brier: brierScore,
    ts: Math.floor(Date.now() / 1000),
  });
}

/**
 * Convenience: log an arbitrage decision
 */
export async function logArbitrage(
  topic: string,
  spread: number,
  action: 'EXECUTE' | 'WATCH' | 'SKIP',
  confidence: number,
  brierScore?: number,
): Promise<{ txSignature: string | null; onChain: boolean }> {
  return logDecision({
    v: 1,
    t: 'ARBITRAGE',
    q: (topic || 'unknown').slice(0, 80),
    spread: spread || 0,
    action,
    conf: Math.round(confidence || 0),
    brier: brierScore,
    ts: Math.floor(Date.now() / 1000),
  });
}

/**
 * Convenience: log a heartbeat
 */
export async function logHeartbeat(
  marketsScanned: number,
  arbsFound: number,
  whaleAlerts: number,
  brierScore?: number,
): Promise<{ txSignature: string | null; onChain: boolean }> {
  return logDecision({
    v: 1,
    t: 'HEARTBEAT',
    q: `scan:${marketsScanned} arbs:${arbsFound} whales:${whaleAlerts}`,
    action: 'HEARTBEAT',
    conf: 100,
    brier: brierScore,
    ts: Math.floor(Date.now() / 1000),
  });
}

/**
 * Get recent decision log entries
 */
export function getRecentDecisions(limit = 20): LogEntry[] {
  try {
    if (!fs.existsSync(LOCAL_LOG_FILE)) return [];
    const entries: LogEntry[] = JSON.parse(fs.readFileSync(LOCAL_LOG_FILE, 'utf-8'));
    return entries.slice(-limit);
  } catch {
    return [];
  }
}

/**
 * Get on-chain decision count
 */
export function getOnChainCount(): number {
  try {
    if (!fs.existsSync(LOCAL_LOG_FILE)) return 0;
    const entries: LogEntry[] = JSON.parse(fs.readFileSync(LOCAL_LOG_FILE, 'utf-8'));
    return entries.filter(e => e.onChain).length;
  } catch {
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────
// SIGNED COMMITMENT SYSTEM (Phase 2 upgrade)
// Verifiable pre-resolution prediction commits.
// Anyone can verify: hash(commitment) → find on Solana → check timestamp.
// ─────────────────────────────────────────────────────────────

export interface SignedCommitment {
  v: 2;
  type: 'SIGNED_PREDICTION';
  questionHash: string;    // SHA256 of the question
  question: string;        // plaintext question (for display)
  direction: 'YES' | 'NO';
  probability: number;     // 0-1
  domain: string;          // politics, crypto, sports, macro, general
  timestamp: number;       // unix seconds
  forecasterHash: string;  // SHA256 of telegramId (privacy-preserving)
  commitHash: string;      // SHA256 of the full commitment (canonical proof)
}

export interface CommitResult {
  commitment: SignedCommitment;
  commitHash: string;
  txSignature: string | null;
  onChain: boolean;
  verifyUrl: string | null;
}

/**
 * Create a verifiable signed prediction commitment.
 *
 * The commitment is hashed with SHA256 and written to Solana memo program.
 * The timestamp PROVES the prediction was made BEFORE resolution.
 *
 * Verification:
 *   1. Reconstruct commitment object from stored fields
 *   2. SHA256 → should match commitHash
 *   3. Find commitHash in Solana memo transactions
 *   4. Solana block timestamp ≤ market resolution timestamp → valid
 */
export async function commitPredictionSigned(opts: {
  telegramId: number;
  question: string;
  direction: 'YES' | 'NO';
  probability: number;
  domain: string;
}): Promise<CommitResult> {
  const { telegramId, question, direction, probability, domain } = opts;

  const timestamp = Math.floor(Date.now() / 1000);

  // Hash question for compact on-chain storage
  const questionHash = crypto.createHash('sha256').update(question.toLowerCase().trim()).digest('hex').slice(0, 16);

  // Hash forecaster ID for privacy (someone can claim it by revealing their telegramId)
  const forecasterHash = crypto.createHash('sha256').update(String(telegramId)).digest('hex').slice(0, 16);

  // Build canonical commitment
  const commitBody = `${questionHash}:${direction}:${probability.toFixed(4)}:${timestamp}:${forecasterHash}`;
  const commitHash = crypto.createHash('sha256').update(commitBody).digest('hex').slice(0, 32);

  const commitment: SignedCommitment = {
    v: 2,
    type: 'SIGNED_PREDICTION',
    questionHash,
    question: question.slice(0, 100),
    direction,
    probability,
    domain,
    timestamp,
    forecasterHash,
    commitHash,
  };

  // Write to Solana memo: just the hash (compact, costs ~0.000005 SOL)
  const memoPayload: DecisionMemo = {
    v: 2,
    t: 'PREDICTION',
    q: commitHash,     // the commitment hash IS the memo
    action: `COMMIT_${direction}`,
    conf: Math.round(probability * 100),
    ts: timestamp,
  };

  const result = await logDecision(memoPayload);

  const verifyUrl = result.txSignature
    ? `https://solscan.io/tx/${result.txSignature}`
    : null;

  return {
    commitment,
    commitHash,
    txSignature: result.txSignature,
    onChain: result.onChain,
    verifyUrl,
  };
}

/**
 * Verify a commitment: reconstructs hash from stored fields
 * Returns true if the commitHash matches (commitment was not tampered with)
 */
export function verifyCommitment(commitment: SignedCommitment): boolean {
  const commitBody = `${commitment.questionHash}:${commitment.direction}:${commitment.probability.toFixed(4)}:${commitment.timestamp}:${commitment.forecasterHash}`;
  const expectedHash = crypto.createHash('sha256').update(commitBody).digest('hex').slice(0, 32);
  return expectedHash === commitment.commitHash;
}

/**
 * Format a commit result for Telegram display
 */
export function formatCommitResult(result: CommitResult): string {
  const { commitment, verifyUrl, onChain } = result;

  let text = `*Prediction Committed*\n\n`;
  text += `${commitment.question.slice(0, 70)}\n\n`;
  text += `Direction: *${commitment.direction}* at ${(commitment.probability * 100).toFixed(0)}%\n`;
  text += `Domain: ${commitment.domain}\n`;
  text += `Hash: \`${commitment.commitHash.slice(0, 16)}...\`\n\n`;

  if (onChain && verifyUrl) {
    text += `✅ *On-chain timestamp proof*\n`;
    text += `[View on Solscan](${verifyUrl})\n\n`;
    text += `_This proves you made this prediction before resolution._`;
  } else {
    text += `⚠️ _Commitment saved locally (no wallet configured for on-chain proof)_`;
  }

  return text;
}

// CLI interface
if (process.argv[1]?.endsWith('onchain.ts')) {
  const command = process.argv[2];
  (async () => {
    if (command === 'test') {
      console.log('Testing on-chain logging...');
      const result = await logHeartbeat(100, 3, 1, 0.14);
      console.log(`On-chain: ${result.onChain}`);
      if (result.txSignature) {
        console.log(`TX: https://solscan.io/tx/${result.txSignature}`);
      }
    } else if (command === 'history') {
      const entries = getRecentDecisions();
      console.log(`Recent decisions (${entries.length}):`);
      for (const entry of entries) {
        console.log(`  [${entry.memo.t}] ${entry.memo.q} → ${entry.memo.action} (conf: ${entry.memo.conf}%) ${entry.onChain ? '✓ on-chain' : '○ local'}`);
      }
    } else {
      console.log('Usage:');
      console.log('  ts-node onchain.ts test     - Test logging a heartbeat');
      console.log('  ts-node onchain.ts history   - View recent decisions');
    }
  })();
}
