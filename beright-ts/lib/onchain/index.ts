/**
 * BeRight On-Chain Module
 *
 * On-chain prediction tracking via:
 * - Solana Memo Program (immutable timestamped logs)
 * - Calibration Program (structured Brier tracking)
 *
 * Usage:
 *   import { commitPredictionWithCalibration, getForecasterStats } from '../lib/onchain';
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
  commitPredictionWithCalibration,
  resolvePrediction,
  batchCommitPredictions,
  getWalletBalance,
  estimateMemoTransactionCost,
  getConnection,
} from './commit';

// Calibration program functions
export {
  CALIBRATION_PROGRAM_ID,
  getCalibrationProgram,
  getCalibrationConnection,
  setUseDevnet,
  deriveForecasterPda,
  derivePredictionPda,
  isForecasterInitialized,
  initializeForecaster,
  recordPredictionOnChain,
  getForecasterStats,
  resolvePredictionOnChain,
  getPredictionRecord,
  getForecasterPredictions,
  recordPredictionWithTracking,
} from './calibration';

// Calibration types
export type {
  ForecasterStats,
  PredictionRecord,
  CalibrationCommitResult,
  FullPredictionCommitResult,
} from './calibration';

// Verification functions
export {
  fetchPrediction,
  fetchResolution,
  verifyPrediction,
  getUserPredictions,
  generateVerificationProof,
} from './verify';
