/**
 * BeRight On-Chain Module
 *
 * On-chain prediction tracking via Solana Memo Program
 *
 * Usage:
 *   import { commitPrediction, resolvePrediction, verifyPrediction } from '../lib/onchain';
 */

// Types
export * from './types';

// Memo utilities
export {
  formatPredictionMemo,
  formatResolutionMemo,
  parseMemo,
  calculateBrierScore,
  interpretBrierScore,
  validatePredictionCommit,
  createPredictionHash,
  MEMO_PROGRAM_ID,
  MAX_MEMO_LENGTH,
} from './memo';

// Commit functions
export {
  commitPrediction,
  resolvePrediction,
  batchCommitPredictions,
  getWalletBalance,
  estimateMemoTransactionCost,
  getConnection,
} from './commit';

// Verification functions
export {
  fetchPrediction,
  fetchResolution,
  verifyPrediction,
  getUserPredictions,
  generateVerificationProof,
} from './verify';

// Pricing utilities
export {
  fetchSolPrice,
  getCachedSolPrice,
  clearPriceCache,
} from './pricing';
