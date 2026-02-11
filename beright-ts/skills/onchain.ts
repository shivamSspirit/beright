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

// Solana Memo Program ID
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

// Local log for when on-chain logging is unavailable
const LOCAL_LOG_FILE = path.join(process.cwd(), 'memory', 'decisions.json');

export type DecisionType = 'DECISION' | 'PREDICTION' | 'RESOLUTION' | 'HEARTBEAT' | 'ARBITRAGE';

export interface DecisionMemo {
  v: number;                // version
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
    q: question.slice(0, 80),
    consensus: probability,
    action: `PREDICT_${direction}`,
    conf: Math.round(confidence),
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
    q: topic.slice(0, 80),
    spread,
    action,
    conf: Math.round(confidence),
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
