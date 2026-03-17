/**
 * BeRight P6: Forecaster Credit Score System
 *
 * Main entry point that wires on-chain calibration data to credit calculations.
 * Provides cached credit profile fetching and credit checks.
 */

import { PublicKey } from '@solana/web3.js';
import { getForecasterStats, type ForecasterStats } from '../onchain/calibration';
import {
  buildCreditProfile,
  calculateAllCreditMetrics,
  getTierForMetrics,
} from './calculator';
import {
  type ForecasterCredit,
  type CreditCheckRequest,
  type CreditCheckResult,
  type CreditConfig,
  type CreditInputMetrics,
  type CreditProfileResponse,
  type CreditLimitsResponse,
  type CreditCheckResponse,
  DEFAULT_CREDIT_CONFIG,
  statsToInputMetrics,
} from './types';

// Re-export all types
export * from './types';
export * from './calculator';

// ============================================================================
// In-Memory Cache
// ============================================================================

interface CacheEntry {
  credit: ForecasterCredit;
  timestamp: number;
}

const creditCache = new Map<string, CacheEntry>();

/**
 * Clear all cached credit profiles
 */
export function clearCreditCache(): void {
  creditCache.clear();
}

/**
 * Clear specific forecaster from cache
 */
export function invalidateCreditCache(pubkey: string): void {
  creditCache.delete(pubkey);
}

/**
 * Get cache stats
 */
export function getCreditCacheStats(): { size: number; entries: string[] } {
  return {
    size: creditCache.size,
    entries: Array.from(creditCache.keys()),
  };
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get credit profile for a forecaster
 *
 * Fetches on-chain calibration data and calculates credit metrics.
 * Results are cached for performance.
 *
 * @param pubkey - Forecaster public key (string or PublicKey)
 * @param config - Credit system configuration
 * @param forceRefresh - Skip cache and fetch fresh data
 * @returns Credit profile or null if not found
 */
export async function getCreditProfile(
  pubkey: string | PublicKey,
  config: CreditConfig = DEFAULT_CREDIT_CONFIG,
  forceRefresh: boolean = false
): Promise<ForecasterCredit | null> {
  const pubkeyStr = typeof pubkey === 'string' ? pubkey : pubkey.toBase58();

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = creditCache.get(pubkeyStr);
    if (cached) {
      const age = (Date.now() - cached.timestamp) / 1000;
      if (age < config.cacheTTLSeconds) {
        return cached.credit;
      }
    }
  }

  // Fetch from on-chain calibration program
  const pubkeyObj = typeof pubkey === 'string' ? new PublicKey(pubkey) : pubkey;
  const stats = await getForecasterStats(pubkeyObj);

  if (!stats) {
    return null;
  }

  // Convert to credit input metrics
  const inputMetrics = statsToInputMetrics(pubkeyStr, stats);

  // Build credit profile
  const credit = buildCreditProfile(inputMetrics, config, true);

  // Cache result
  creditCache.set(pubkeyStr, {
    credit,
    timestamp: Date.now(),
  });

  return credit;
}

/**
 * Get credit profile with API response wrapper
 *
 * @param pubkey - Forecaster public key
 * @param config - Credit system configuration
 * @returns API response with credit profile
 */
export async function getCreditProfileResponse(
  pubkey: string | PublicKey,
  config: CreditConfig = DEFAULT_CREDIT_CONFIG
): Promise<CreditProfileResponse> {
  try {
    const pubkeyStr = typeof pubkey === 'string' ? pubkey : pubkey.toBase58();

    // Check cache for age reporting
    const cached = creditCache.get(pubkeyStr);
    const wasCached = !!cached;
    const cacheAge = cached ? (Date.now() - cached.timestamp) / 1000 : 0;

    const credit = await getCreditProfile(pubkey, config);

    if (!credit) {
      return {
        success: false,
        error: 'Forecaster not found or no on-chain calibration data',
      };
    }

    return {
      success: true,
      credit,
      cached: wasCached && cacheAge < config.cacheTTLSeconds,
      cacheAge: Math.round(cacheAge),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get credit limits only (lighter response)
 *
 * @param pubkey - Forecaster public key
 * @param config - Credit system configuration
 * @returns API response with just limits
 */
export async function getCreditLimitsResponse(
  pubkey: string | PublicKey,
  config: CreditConfig = DEFAULT_CREDIT_CONFIG
): Promise<CreditLimitsResponse> {
  try {
    const pubkeyStr = typeof pubkey === 'string' ? pubkey : pubkey.toBase58();
    const credit = await getCreditProfile(pubkey, config);

    if (!credit) {
      return {
        success: false,
        pubkey: pubkeyStr,
        error: 'Forecaster not found',
      };
    }

    return {
      success: true,
      pubkey: pubkeyStr,
      limits: {
        creditLimit: credit.creditLimit,
        borrowRate: credit.borrowRate,
        collateralLTV: credit.collateralLTV,
        delegationCap: credit.delegationCap,
        poolAccessTier: credit.poolAccessTier,
      },
    };
  } catch (error) {
    const pubkeyStr = typeof pubkey === 'string' ? pubkey : pubkey.toBase58();
    return {
      success: false,
      pubkey: pubkeyStr,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Credit Check Functions
// ============================================================================

/**
 * Check if a credit action is allowed for a forecaster
 *
 * @param request - Credit check request
 * @param config - Credit system configuration
 * @returns Credit check result
 */
export async function checkCredit(
  request: CreditCheckRequest,
  config: CreditConfig = DEFAULT_CREDIT_CONFIG
): Promise<CreditCheckResult> {
  const credit = await getCreditProfile(request.pubkey, config);

  if (!credit) {
    return {
      allowed: false,
      reason: 'Forecaster not found or no on-chain calibration data',
    };
  }

  switch (request.action) {
    case 'borrow':
      return checkBorrowAction(credit, request.amount);

    case 'delegate':
      return checkDelegateAction(credit, request.amount);

    case 'manage_pool':
      return checkPoolManageAction(credit, request.poolTier);

    case 'access_tier':
      return checkTierAccessAction(credit, request.poolTier);

    case 'collateralize':
      return checkCollateralizeAction(credit, request.amount);

    default:
      return {
        allowed: false,
        reason: `Unknown action: ${request.action}`,
      };
  }
}

/**
 * Check borrow action
 */
function checkBorrowAction(
  credit: ForecasterCredit,
  amount?: number
): CreditCheckResult {
  if (credit.creditLimit === 0) {
    return {
      allowed: false,
      reason: 'No credit available (insufficient prediction history or poor performance)',
      currentTier: credit.poolAccessTier,
    };
  }

  if (amount && amount > credit.creditLimit) {
    return {
      allowed: false,
      reason: `Requested amount ($${amount}) exceeds credit limit ($${credit.creditLimit})`,
      maxAmount: credit.creditLimit,
      currentTier: credit.poolAccessTier,
    };
  }

  return {
    allowed: true,
    maxAmount: credit.creditLimit,
    availableCredit: credit.creditLimit, // TODO: Track utilization
    currentTier: credit.poolAccessTier,
  };
}

/**
 * Check delegate action (receiving delegated capital)
 */
function checkDelegateAction(
  credit: ForecasterCredit,
  amount?: number
): CreditCheckResult {
  if (credit.delegationCap === 0) {
    return {
      allowed: false,
      reason: 'Not eligible for delegation (need more track record)',
      currentTier: credit.poolAccessTier,
    };
  }

  if (amount && amount > credit.delegationCap) {
    return {
      allowed: false,
      reason: `Requested delegation ($${amount}) exceeds cap ($${credit.delegationCap})`,
      maxAmount: credit.delegationCap,
      currentTier: credit.poolAccessTier,
    };
  }

  return {
    allowed: true,
    maxAmount: credit.delegationCap,
    currentTier: credit.poolAccessTier,
  };
}

/**
 * Check pool management action
 */
function checkPoolManageAction(
  credit: ForecasterCredit,
  requiredTier?: string
): CreditCheckResult {
  const tierOrder = ['restricted', 'basic', 'standard', 'advanced', 'elite'];
  const currentIndex = tierOrder.indexOf(credit.poolAccessTier);
  const requiredIndex = requiredTier ? tierOrder.indexOf(requiredTier) : 1; // Default basic

  if (currentIndex < requiredIndex) {
    return {
      allowed: false,
      reason: `Pool requires ${requiredTier || 'basic'} tier (you have ${credit.poolAccessTier})`,
      requiredTier: (requiredTier || 'basic') as any,
      currentTier: credit.poolAccessTier,
    };
  }

  return {
    allowed: true,
    currentTier: credit.poolAccessTier,
  };
}

/**
 * Check tier access action
 */
function checkTierAccessAction(
  credit: ForecasterCredit,
  targetTier?: string
): CreditCheckResult {
  if (!targetTier) {
    return {
      allowed: true,
      currentTier: credit.poolAccessTier,
    };
  }

  const tierOrder = ['restricted', 'basic', 'standard', 'advanced', 'elite'];
  const currentIndex = tierOrder.indexOf(credit.poolAccessTier);
  const targetIndex = tierOrder.indexOf(targetTier);

  if (currentIndex < targetIndex) {
    return {
      allowed: false,
      reason: `Requires ${targetTier} tier (you have ${credit.poolAccessTier})`,
      requiredTier: targetTier as any,
      currentTier: credit.poolAccessTier,
    };
  }

  return {
    allowed: true,
    currentTier: credit.poolAccessTier,
  };
}

/**
 * Check collateralize action
 */
function checkCollateralizeAction(
  credit: ForecasterCredit,
  amount?: number
): CreditCheckResult {
  if (credit.collateralLTV === 0) {
    return {
      allowed: false,
      reason: 'Not eligible for collateralization',
      currentTier: credit.poolAccessTier,
    };
  }

  // Calculate max borrowable against collateral
  const maxBorrow = amount ? amount * credit.collateralLTV : undefined;

  return {
    allowed: true,
    maxAmount: maxBorrow,
    currentTier: credit.poolAccessTier,
  };
}

/**
 * Get credit check response with API wrapper
 */
export async function getCreditCheckResponse(
  request: CreditCheckRequest,
  config: CreditConfig = DEFAULT_CREDIT_CONFIG
): Promise<CreditCheckResponse> {
  try {
    const result = await checkCredit(request, config);
    return {
      success: true,
      result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Get credit profiles for multiple forecasters
 *
 * @param pubkeys - Array of forecaster public keys
 * @param config - Credit system configuration
 * @returns Map of pubkey to credit profile
 */
export async function getBatchCreditProfiles(
  pubkeys: (string | PublicKey)[],
  config: CreditConfig = DEFAULT_CREDIT_CONFIG
): Promise<Map<string, ForecasterCredit | null>> {
  const results = new Map<string, ForecasterCredit | null>();

  // Process in parallel
  const promises = pubkeys.map(async (pubkey) => {
    const pubkeyStr = typeof pubkey === 'string' ? pubkey : pubkey.toBase58();
    const credit = await getCreditProfile(pubkey, config);
    return { pubkeyStr, credit };
  });

  const resolved = await Promise.all(promises);

  for (const { pubkeyStr, credit } of resolved) {
    results.set(pubkeyStr, credit);
  }

  return results;
}

/**
 * Get leaderboard of forecasters by credit score
 *
 * @param pubkeys - Array of forecaster public keys to rank
 * @param config - Credit system configuration
 * @param limit - Max results to return
 * @returns Ranked list of credit profiles
 */
export async function getCreditLeaderboard(
  pubkeys: (string | PublicKey)[],
  config: CreditConfig = DEFAULT_CREDIT_CONFIG,
  limit: number = 50
): Promise<ForecasterCredit[]> {
  const profiles = await getBatchCreditProfiles(pubkeys, config);

  const ranked = Array.from(profiles.values())
    .filter((p): p is ForecasterCredit => p !== null)
    .sort((a, b) => {
      // Sort by credit limit descending (higher = better)
      return b.creditLimit - a.creditLimit;
    })
    .slice(0, limit);

  return ranked;
}
