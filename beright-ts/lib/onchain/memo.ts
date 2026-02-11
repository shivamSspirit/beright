/**
 * BeRight Memo Utilities
 *
 * Format and parse memos for on-chain prediction tracking
 */

import { createHash } from 'crypto';
import {
  MEMO_VERSION,
  MEMO_PREFIX,
  PredictionCommit,
  ResolutionCommit,
  ParsedMemo,
  Direction,
  BrierInput,
} from './types';

// Memo Program ID
export const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

// Max memo length (Solana limit is ~566 bytes, we use less)
export const MAX_MEMO_LENGTH = 500;

/**
 * Create a prediction commit memo string
 */
export function formatPredictionMemo(
  userPubkey: string,
  marketId: string,
  probability: number,
  direction: Direction,
  timestamp?: number
): string {
  const ts = timestamp || Math.floor(Date.now() / 1000);

  // Create hash for integrity verification
  const hash = createPredictionHash(userPubkey, marketId, probability, direction, ts);

  // Format: BERIGHT:PREDICT:v1|user|market|prob|direction|timestamp|hash
  const memo = [
    `${MEMO_PREFIX}:PREDICT:${MEMO_VERSION}`,
    userPubkey,
    marketId,
    probability.toFixed(4),
    direction,
    ts.toString(),
    hash.substring(0, 16), // First 16 chars of hash
  ].join('|');

  if (memo.length > MAX_MEMO_LENGTH) {
    throw new Error(`Memo too long: ${memo.length} > ${MAX_MEMO_LENGTH}`);
  }

  return memo;
}

/**
 * Create a resolution memo string
 */
export function formatResolutionMemo(
  commitTx: string,
  outcome: Direction,
  brierScore: number
): string {
  // Format: BERIGHT:RESOLVE:v1|commitTx|outcome|brierScore
  const memo = [
    `${MEMO_PREFIX}:RESOLVE:${MEMO_VERSION}`,
    commitTx,
    outcome,
    brierScore.toFixed(4),
  ].join('|');

  if (memo.length > MAX_MEMO_LENGTH) {
    throw new Error(`Memo too long: ${memo.length} > ${MAX_MEMO_LENGTH}`);
  }

  return memo;
}

/**
 * Parse a memo string from chain
 */
export function parseMemo(memoString: string): ParsedMemo | null {
  try {
    const parts = memoString.split('|');
    const header = parts[0];

    if (!header.startsWith(MEMO_PREFIX)) {
      return null; // Not a BeRight memo
    }

    const [prefix, type, version] = header.split(':');

    if (type === 'PREDICT') {
      return {
        raw: memoString,
        type: 'PREDICT',
        version,
        data: {
          version,
          type: 'PREDICT',
          userPubkey: parts[1],
          marketId: parts[2],
          probability: parseFloat(parts[3]),
          direction: parts[4] as Direction,
          timestamp: parseInt(parts[5]),
          hash: parts[6],
        } as PredictionCommit,
      };
    }

    if (type === 'RESOLVE') {
      return {
        raw: memoString,
        type: 'RESOLVE',
        version,
        data: {
          version,
          type: 'RESOLVE',
          commitTx: parts[1],
          outcome: parts[2] as Direction,
          brierScore: parseFloat(parts[3]),
        } as ResolutionCommit,
      };
    }

    return null;
  } catch (e) {
    console.error('Failed to parse memo:', e);
    return null;
  }
}

/**
 * Create a hash for prediction integrity
 */
export function createPredictionHash(
  userPubkey: string,
  marketId: string,
  probability: number,
  direction: Direction,
  timestamp: number,
  salt?: string
): string {
  const data = [
    userPubkey,
    marketId,
    probability.toFixed(4),
    direction,
    timestamp.toString(),
    salt || process.env.PREDICTION_SALT || 'beright-default-salt',
  ].join(':');

  return createHash('sha256').update(data).digest('hex');
}

/**
 * Calculate Brier score
 *
 * Brier score = (forecast - outcome)²
 * Where:
 *   - forecast = probability of YES (adjusted for direction)
 *   - outcome = 1 if YES won, 0 if NO won
 *
 * Lower is better: 0 = perfect, 1 = completely wrong
 */
export function calculateBrierScore(input: BrierInput): number {
  const { probability, direction, outcome } = input;

  // Convert to probability of YES
  const forecast = direction === 'YES' ? probability : 1 - probability;

  // Outcome as number (1 = YES won, 0 = NO won)
  const actual = outcome ? 1 : 0;

  // Brier score
  const brier = Math.pow(forecast - actual, 2);

  // Round to 4 decimal places
  return Math.round(brier * 10000) / 10000;
}

/**
 * Interpret Brier score quality
 */
export function interpretBrierScore(score: number): {
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'bad';
  description: string;
} {
  if (score <= 0.1) {
    return { quality: 'excellent', description: 'Superforecaster level' };
  }
  if (score <= 0.2) {
    return { quality: 'good', description: 'Well-calibrated' };
  }
  if (score <= 0.3) {
    return { quality: 'fair', description: 'Average forecaster' };
  }
  if (score <= 0.4) {
    return { quality: 'poor', description: 'Needs improvement' };
  }
  return { quality: 'bad', description: 'Worse than random' };
}

/**
 * Validate a prediction commit
 */
export function validatePredictionCommit(commit: PredictionCommit): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check probability range
  if (commit.probability < 0 || commit.probability > 1) {
    errors.push('Probability must be between 0 and 1');
  }

  // Check direction
  if (!['YES', 'NO'].includes(commit.direction)) {
    errors.push('Direction must be YES or NO');
  }

  // Check timestamp is not in future
  const now = Math.floor(Date.now() / 1000);
  if (commit.timestamp > now + 60) {
    // Allow 60s clock skew
    errors.push('Timestamp cannot be in the future');
  }

  // Check timestamp is not too old (30 days)
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60;
  if (commit.timestamp < thirtyDaysAgo) {
    errors.push('Timestamp is too old (>30 days)');
  }

  // Check market ID format
  if (!commit.marketId || commit.marketId.length < 3) {
    errors.push('Invalid market ID');
  }

  // Check user pubkey format (basic check)
  if (!commit.userPubkey || commit.userPubkey.length < 32) {
    errors.push('Invalid user pubkey');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
