/**
 * BeRight P6: Forecaster Credit Score System
 *
 * Converts on-chain Brier scores into economic advantages:
 * - Credit limits
 * - Borrow rates
 * - Collateral LTV ratios
 * - Pool access tiers
 * - Delegation caps
 */

import type { ForecasterStats } from '../onchain/calibration';

// ============================================================================
// Credit Tier Definitions
// ============================================================================

/**
 * Pool access tiers based on forecaster performance
 */
export type PoolAccessTier =
  | 'restricted'   // No pool access (poor track record)
  | 'basic'        // Small pools only (<$10k TVL)
  | 'standard'     // Medium pools (<$100k TVL)
  | 'advanced'     // Large pools (<$1M TVL)
  | 'elite';       // Unlimited pool access

/**
 * Credit tier thresholds
 */
export interface CreditTierConfig {
  tier: PoolAccessTier;
  minBrierScore: number;      // Lower is better (0-1)
  maxBrierScore: number;
  minAccuracy: number;        // Higher is better (0-1)
  minPredictions: number;     // Minimum track record
  creditMultiplier: number;   // Base credit limit multiplier
  rateDiscount: number;       // Interest rate discount (0-0.3 = 0-30%)
  maxLTV: number;             // Max collateral LTV (0.5-0.9)
}

/**
 * Default tier configurations
 */
export const CREDIT_TIERS: CreditTierConfig[] = [
  {
    tier: 'elite',
    minBrierScore: 0,
    maxBrierScore: 0.15,
    minAccuracy: 0.65,
    minPredictions: 100,
    creditMultiplier: 10,
    rateDiscount: 0.30,
    maxLTV: 0.90,
  },
  {
    tier: 'advanced',
    minBrierScore: 0.15,
    maxBrierScore: 0.22,
    minAccuracy: 0.58,
    minPredictions: 50,
    creditMultiplier: 5,
    rateDiscount: 0.20,
    maxLTV: 0.80,
  },
  {
    tier: 'standard',
    minBrierScore: 0.22,
    maxBrierScore: 0.28,
    minAccuracy: 0.52,
    minPredictions: 20,
    creditMultiplier: 2,
    rateDiscount: 0.10,
    maxLTV: 0.70,
  },
  {
    tier: 'basic',
    minBrierScore: 0.28,
    maxBrierScore: 0.35,
    minAccuracy: 0.45,
    minPredictions: 5,
    creditMultiplier: 1,
    rateDiscount: 0.05,
    maxLTV: 0.60,
  },
  {
    tier: 'restricted',
    minBrierScore: 0.35,
    maxBrierScore: 1.0,
    minAccuracy: 0,
    minPredictions: 0,
    creditMultiplier: 0,
    rateDiscount: 0,
    maxLTV: 0.50,
  },
];

// ============================================================================
// Core Credit Interfaces
// ============================================================================

/**
 * Input performance metrics (from on-chain calibration)
 */
export interface CreditInputMetrics {
  pubkey: string;
  brierScore: number;           // Average Brier score (0-1, lower is better)
  logScore: number;             // Average log score
  accuracy: number;             // Prediction accuracy (0-1)
  resolvedPredictions: number;  // Number of resolved predictions
  calibrationBuckets: number[][]; // Calibration quality by probability bucket
  streakCorrect: number;        // Current correct streak
  maxStreakCorrect: number;     // Best correct streak
  marketsTraded: number;        // Unique markets
}

/**
 * Derived credit metrics (what the credit system outputs)
 */
export interface CreditMetrics {
  creditLimit: number;        // Max USDC they can access
  borrowRate: number;         // Interest rate (APR)
  collateralLTV: number;      // Max LTV on outcome tokens
  poolAccessTier: PoolAccessTier;
  delegationCap: number;      // Legacy cap retained for historical credit consumers
}

/**
 * Full forecaster credit profile
 */
export interface ForecasterCredit {
  pubkey: string;

  // Performance metrics (from on-chain calibration)
  brierScore: number;
  logScore: number;
  accuracy: number;
  calibrationQuality: number;   // 0-1 score based on bucket accuracy
  streakBonus: number;          // Multiplier from streak performance

  // Derived credit metrics
  creditLimit: number;
  borrowRate: number;
  collateralLTV: number;
  poolAccessTier: PoolAccessTier;
  delegationCap: number;

  // Tier info
  tier: CreditTierConfig;

  // Metadata
  lastUpdated: Date;
  onChainVerified: boolean;
  predictionCount: number;
}

// ============================================================================
// Credit Check Interfaces
// ============================================================================

/**
 * Credit check request
 */
export interface CreditCheckRequest {
  pubkey: string;
  action: CreditAction;
  amount?: number;          // Amount for borrow/delegate actions
  poolTier?: PoolAccessTier; // Target pool tier for access checks
}

/**
 * Supported credit actions
 */
export type CreditAction =
  | 'borrow'              // Request to borrow against reputation
  | 'delegate'            // Request to receive delegated capital
  | 'manage_pool'         // Request to manage a pool
  | 'access_tier'         // Check if can access a tier
  | 'collateralize';      // Use outcome tokens as collateral

/**
 * Credit check response
 */
export interface CreditCheckResult {
  allowed: boolean;
  reason?: string;          // Why denied (if not allowed)
  maxAmount?: number;       // Max amount for this action
  currentUsage?: number;    // Current credit utilization
  availableCredit?: number; // Remaining credit
  requiredTier?: PoolAccessTier; // Tier needed for this action
  currentTier?: PoolAccessTier;  // User's current tier
}

// ============================================================================
// Credit History & Audit
// ============================================================================

/**
 * Credit score change event
 */
export interface CreditEvent {
  id: string;
  pubkey: string;
  timestamp: Date;
  eventType: CreditEventType;
  previousScore: number;
  newScore: number;
  previousTier: PoolAccessTier;
  newTier: PoolAccessTier;
  reason: string;
  txSignature?: string;     // On-chain tx that triggered the change
}

export type CreditEventType =
  | 'prediction_resolved'   // Prediction was resolved (Brier update)
  | 'tier_upgrade'          // Moved to higher tier
  | 'tier_downgrade'        // Moved to lower tier
  | 'calibration_bonus'     // Got calibration quality bonus
  | 'streak_bonus'          // Got streak bonus
  | 'manual_adjustment';    // Admin adjustment

/**
 * Credit utilization tracking
 */
export interface CreditUtilization {
  pubkey: string;
  creditLimit: number;
  borrowedAmount: number;
  delegatedCapital: number;
  utilizationRate: number;  // (borrowed + delegated) / limit
  poolsManaged: string[];   // Pool IDs being managed
  lastActivity: Date;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Credit profile API response
 */
export interface CreditProfileResponse {
  success: boolean;
  credit?: ForecasterCredit;
  error?: string;
  cached?: boolean;
  cacheAge?: number;        // Seconds since cache update
}

/**
 * Credit limits API response
 */
export interface CreditLimitsResponse {
  success: boolean;
  pubkey: string;
  limits?: {
    creditLimit: number;
    borrowRate: number;
    collateralLTV: number;
    delegationCap: number;
    poolAccessTier: PoolAccessTier;
  };
  error?: string;
}

/**
 * Credit check API response
 */
export interface CreditCheckResponse {
  success: boolean;
  result?: CreditCheckResult;
  error?: string;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Credit system configuration
 */
export interface CreditConfig {
  // Base values
  baseCreditLimit: number;     // Base credit limit in USDC (e.g., 1000)
  baseBorrowRate: number;      // Base APR (e.g., 0.15 = 15%)
  baseCollateralLTV: number;   // Base LTV (e.g., 0.5 = 50%)
  baseDelegationCap: number;   // Base delegation cap in USDC

  // Score thresholds
  minPredictionsForCredit: number;  // Min predictions to get any credit
  minBrierForMaxCredit: number;     // Brier score for max credit (lower = better)
  maxBrierForAnyCredit: number;     // Brier score cutoff for any credit

  // Multipliers
  volumeMultiplierCap: number;      // Max bonus from trading volume
  calibrationMultiplierRange: [number, number]; // Min/max calibration multiplier
  streakMultiplierMax: number;      // Max streak bonus

  // Cache settings
  cacheTTLSeconds: number;          // How long to cache credit scores
}

/**
 * Default credit configuration
 */
export const DEFAULT_CREDIT_CONFIG: CreditConfig = {
  baseCreditLimit: 1000,           // $1000 USDC base
  baseBorrowRate: 0.15,            // 15% APR base
  baseCollateralLTV: 0.50,         // 50% LTV base
  baseDelegationCap: 5000,         // $5000 USDC base

  minPredictionsForCredit: 5,
  minBrierForMaxCredit: 0.10,      // Very good forecaster
  maxBrierForAnyCredit: 0.40,      // Above this = no credit

  volumeMultiplierCap: 3.0,        // Up to 3x bonus from volume
  calibrationMultiplierRange: [0.9, 1.1],
  streakMultiplierMax: 1.10,       // Up to 10% streak bonus

  cacheTTLSeconds: 300,            // 5 minute cache
};

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Convert ForecasterStats (on-chain) to CreditInputMetrics
 */
export function statsToInputMetrics(
  pubkey: string,
  stats: ForecasterStats
): CreditInputMetrics {
  return {
    pubkey,
    brierScore: stats.avgBrierScore,
    logScore: stats.avgLogScore,
    accuracy: stats.accuracy,
    resolvedPredictions: stats.resolvedPredictions,
    calibrationBuckets: stats.calibrationBuckets,
    streakCorrect: stats.streakCorrect,
    maxStreakCorrect: stats.maxStreakCorrect,
    marketsTraded: stats.marketsTraded,
  };
}
