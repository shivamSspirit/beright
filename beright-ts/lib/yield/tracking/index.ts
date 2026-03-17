/**
 * Yield Tracking Module
 *
 * Tracks deposits, withdrawals, and positions in Supabase
 * for accurate yield calculation.
 */

// Types
export type {
  YieldDeposit,
  YieldWithdrawal,
  YieldPosition,
  YieldSnapshot,
  VaultHealthMetrics,
  AffiliatePartnership,
  RebalanceEvent,
  RebalanceActionRecord,
  DepositHistoryQuery,
  UserYieldSummary,
  PoolYieldSummary,
} from './types';

// Tracker functions
export {
  // Deposits
  recordDeposit,
  confirmDeposit,
  getDepositHistory,

  // Withdrawals
  recordWithdrawal,
  getWithdrawalHistory,

  // Positions
  getPosition,
  updatePosition,
  refreshPositionValue,
  getUserPositions,
  getPoolPositions,

  // Summaries
  getUserYieldSummary,
  getPoolYieldSummary,

  // Snapshots
  recordYieldSnapshot,
  getYieldSnapshots,
  calculateAPYFromSnapshots,
} from './tracker';
