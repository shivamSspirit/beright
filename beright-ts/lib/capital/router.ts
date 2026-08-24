import type { CapitalRouteInput, CapitalRouteRecommendation } from './types';

const DEFAULT_MAX_LTV_BPS = 3_500;
const BPS_DENOMINATOR = 10_000;

function requireFiniteRange(name: string, value: number, minimum: number, maximum: number): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}.`);
  }
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

/**
 * Deterministic routing policy. An LLM may explain this result, but it cannot
 * change the action, limits, or authorization payload.
 */
export function recommendCapitalRoute(input: CapitalRouteInput): CapitalRouteRecommendation {
  const maxLtvBps = input.maxLtvBps ?? DEFAULT_MAX_LTV_BPS;
  const requestedBorrowUsd = input.requestedBorrowUsd ?? 0;
  requireFiniteRange('shares', input.shares, 0.000001, 1_000_000_000);
  requireFiniteRange('opposingAvailableShares', input.opposingAvailableShares, 0, 1_000_000_000);
  requireFiniteRange('holdingDays', input.holdingDays, 1, 365);
  requireFiniteRange('maxLtvBps', maxLtvBps, 1, 5_000);
  requireFiniteRange('requestedBorrowUsd', requestedBorrowUsd, 0, 1_000_000_000);

  const riskPrice = input.eligibility.riskPrice.price ?? 0;
  const collateralValue = input.shares * riskPrice;
  const maximumBorrowUsd = collateralValue * (maxLtvBps / BPS_DENOMINATOR);
  const matchedShares = Math.min(input.shares, input.opposingAvailableShares);

  if (!input.eligibility.eligible || riskPrice <= 0) {
    return {
      action: 'exit',
      confidence: 'high',
      reasons: ['The market failed deterministic eligibility or executable-bid checks.'],
      matchedShares: 0,
      maximumBorrowUsd: 0,
      requestedBorrowUsd: round(requestedBorrowUsd),
      requiresWalletSignature: true,
      executable: false,
      intent: null,
    };
  }

  if (requestedBorrowUsd > 0) {
    const withinLimit = requestedBorrowUsd <= maximumBorrowUsd;
    return {
      action: withinLimit ? 'borrow' : 'hold',
      confidence: withinLimit ? 'medium' : 'high',
      reasons: withinLimit
        ? [`Requested borrowing is within the conservative ${maxLtvBps / 100}% LTV cap.`]
        : [`Requested borrowing exceeds the ${round(maximumBorrowUsd)} USDC deterministic limit.`],
      matchedShares: round(matchedShares),
      maximumBorrowUsd: round(maximumBorrowUsd),
      requestedBorrowUsd: round(requestedBorrowUsd),
      requiresWalletSignature: true,
      executable: false,
      intent: withinLimit ? {
        version: 1,
        action: 'borrow',
        amount: round(requestedBorrowUsd),
        minOutput: round(requestedBorrowUsd),
        expiresInSeconds: 300,
      } : null,
    };
  }

  if (matchedShares > 0 && input.holdingDays >= 7) {
    return {
      action: 'match_for_yield',
      confidence: input.eligibility.status === 'eligible' ? 'high' : 'medium',
      reasons: ['Opposite-side capacity exists and the holding period is long enough to model yield.'],
      matchedShares: round(matchedShares),
      maximumBorrowUsd: round(maximumBorrowUsd),
      requestedBorrowUsd: 0,
      requiresWalletSignature: true,
      executable: false,
      intent: {
        version: 1,
        action: 'match_for_yield',
        amount: round(matchedShares),
        minOutput: 0,
        expiresInSeconds: 300,
      },
    };
  }

  return {
    action: 'hold',
    confidence: 'medium',
    reasons: ['No safe, sufficiently useful match or borrow action is currently available.'],
    matchedShares: round(matchedShares),
    maximumBorrowUsd: round(maximumBorrowUsd),
    requestedBorrowUsd: 0,
    requiresWalletSignature: true,
    executable: false,
    intent: null,
  };
}
