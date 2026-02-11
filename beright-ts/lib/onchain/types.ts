/**
 * BeRight On-Chain Types
 *
 * Types for on-chain prediction tracking via Solana Memo Program
 */

// Memo protocol version
export const MEMO_VERSION = 'v1';
export const MEMO_PREFIX = 'BERIGHT';

// Memo types
export type MemoType = 'PREDICT' | 'RESOLVE';

// Direction
export type Direction = 'YES' | 'NO';

// Prediction commitment (what goes on-chain)
export interface PredictionCommit {
  version: string;
  type: 'PREDICT';
  userPubkey: string;      // Base58 Solana pubkey
  marketId: string;        // e.g., "KXBTC-26DEC31-T100K"
  probability: number;     // 0.00 - 1.00
  direction: Direction;
  timestamp: number;       // Unix seconds
  hash: string;            // SHA256 for integrity
}

// Resolution record (what goes on-chain)
export interface ResolutionCommit {
  version: string;
  type: 'RESOLVE';
  commitTx: string;        // Original prediction TX signature
  outcome: Direction;      // Actual result
  brierScore: number;      // 0.0000 - 1.0000 (lower is better)
}

// Parsed memo (after decoding from chain)
export interface ParsedMemo {
  raw: string;
  type: MemoType;
  version: string;
  data: PredictionCommit | ResolutionCommit;
}

// On-chain prediction record (combined with Supabase data)
export interface OnChainPrediction {
  // Supabase fields
  id: string;
  userId: string;
  question: string;
  platform: string;
  marketUrl?: string;
  reasoning?: string;
  confidence?: 'low' | 'medium' | 'high';
  createdAt: string;

  // On-chain fields
  commitTx: string;        // Prediction TX signature
  userPubkey: string;
  marketId: string;
  probability: number;
  direction: Direction;
  commitTimestamp: number;

  // Resolution fields (null if not resolved)
  resolutionTx?: string;
  outcome?: Direction;
  brierScore?: number;
  resolvedAt?: string;
}

// Leaderboard entry with on-chain verification
export interface VerifiedLeaderboardEntry {
  userPubkey: string;
  username?: string;
  telegramUsername?: string;

  // Stats
  totalPredictions: number;
  resolvedPredictions: number;
  avgBrierScore: number;
  accuracy: number;

  // Verification
  onChainPredictions: number;  // How many are verifiable on-chain
  verificationRate: number;    // % of predictions with on-chain proof

  // Rank
  rank: number;
}

// Transaction result
export interface MemoTxResult {
  success: boolean;
  signature?: string;
  error?: string;
  explorerUrl?: string;
}

// Brier score calculation input
export interface BrierInput {
  probability: number;     // User's predicted probability
  direction: Direction;    // User's predicted direction
  outcome: boolean;        // true = YES won, false = NO won
}
