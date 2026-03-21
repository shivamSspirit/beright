/**
 * Pool Eligibility API
 *
 * GET /api/v2/delegation/eligibility?wallet=<address>
 *
 * Check if a wallet is eligible to create a delegation pool.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  checkPoolEligibility,
  formatTier,
  getTierBadge,
  getTierColor,
  TIER_REQUIREMENTS,
} from '@/lib/delegation';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'wallet parameter is required' },
        { status: 400 }
      );
    }

    // Validate wallet address format
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
      return NextResponse.json(
        { success: false, error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    const eligibility = await checkPoolEligibility(wallet);

    // Build tier progression info
    const tierProgression = Object.entries(TIER_REQUIREMENTS)
      .filter(([tier]) => tier !== 'unranked')
      .map(([tier, req]) => ({
        tier,
        label: formatTier(tier as any),
        badge: getTierBadge(tier as any),
        color: getTierColor(tier as any),
        maxBrier: req.maxBrier,
        minPredictions: req.minPredictions,
        capacity: req.capacity === Infinity ? 'Unlimited' : `$${req.capacity.toLocaleString()}`,
        achieved:
          eligibility.brierScore !== null &&
          eligibility.brierScore <= req.maxBrier &&
          eligibility.predictionCount >= req.minPredictions,
      }));

    return NextResponse.json({
      success: true,
      data: {
        wallet,
        eligible: eligibility.eligible,
        tier: eligibility.tier,
        tierLabel: formatTier(eligibility.tier),
        tierBadge: getTierBadge(eligibility.tier),
        tierColor: getTierColor(eligibility.tier),
        maxCapacity: eligibility.maxCapacity,
        brierScore: eligibility.brierScore,
        predictionCount: eligibility.predictionCount,
        reason: eligibility.reason,
        tierProgression,
        nextTier: getNextTier(eligibility.tier, eligibility.brierScore, eligibility.predictionCount),
      },
    });
  } catch (error) {
    console.error('[API] Eligibility check failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check eligibility',
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate progress to next tier
 */
function getNextTier(
  currentTier: string,
  brierScore: number | null,
  predictionCount: number
): {
  tier: string;
  label: string;
  brierNeeded: number;
  predictionsNeeded: number;
  brierProgress: number;
  predictionsProgress: number;
} | null {
  const tierOrder = ['unranked', 'rookie', 'verified', 'elite', 'super'];
  const currentIndex = tierOrder.indexOf(currentTier);

  if (currentIndex >= tierOrder.length - 1) {
    return null; // Already at max tier
  }

  const nextTierName = tierOrder[currentIndex + 1] as keyof typeof TIER_REQUIREMENTS;
  const nextReq = TIER_REQUIREMENTS[nextTierName];

  const brierProgress = brierScore !== null
    ? Math.min(100, ((0.5 - brierScore) / (0.5 - nextReq.maxBrier)) * 100)
    : 0;

  const predictionsProgress = Math.min(
    100,
    (predictionCount / nextReq.minPredictions) * 100
  );

  return {
    tier: nextTierName,
    label: formatTier(nextTierName),
    brierNeeded: nextReq.maxBrier,
    predictionsNeeded: nextReq.minPredictions,
    brierProgress: Math.max(0, brierProgress),
    predictionsProgress,
  };
}
