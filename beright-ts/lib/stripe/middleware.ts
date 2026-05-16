/**
 * Tier-Based Access Control Middleware
 *
 * Provides functions to check feature access and enforce rate limits
 * based on user's subscription tier.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserSubscription, getTodayUsage, incrementUsage } from './client';
import { getTierFeatures, getTierLimits, hasFeature, isWithinLimit, TIERS } from './config';
import { SubscriptionTier, TierFeatures, TierLimits, SubscriptionUsage } from '../../types/subscription';

// ============================================================================
// TYPES
// ============================================================================

export interface TierContext {
  userId: string;
  tier: SubscriptionTier;
  features: TierFeatures;
  limits: TierLimits;
  usage: SubscriptionUsage | null;
}

export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
  tier: SubscriptionTier;
  requiredTier?: SubscriptionTier;
  currentUsage?: number;
  limit?: number;
}

// ============================================================================
// TIER CONTEXT
// ============================================================================

/**
 * Get full tier context for a user
 */
export async function getTierContext(userId: string): Promise<TierContext> {
  const subscription = await getUserSubscription(userId);

  const tier: SubscriptionTier =
    subscription?.status === 'active' || subscription?.status === 'trialing'
      ? subscription.tier
      : 'free';

  const features = getTierFeatures(tier);
  const limits = getTierLimits(tier);
  const usage = await getTodayUsage(userId);

  return {
    userId,
    tier,
    features,
    limits,
    usage,
  };
}

// ============================================================================
// FEATURE ACCESS CHECKS
// ============================================================================

/**
 * Check if user has access to a specific feature
 */
export async function checkFeatureAccess(
  userId: string,
  feature: keyof TierFeatures
): Promise<AccessCheckResult> {
  const context = await getTierContext(userId);

  if (context.features[feature]) {
    return { allowed: true, tier: context.tier };
  }

  // Find minimum tier that has this feature
  const tiers: SubscriptionTier[] = ['free', 'pro', 'alpha', 'whale', 'enterprise'];
  const requiredTier = tiers.find(t => TIERS[t].features[feature]);

  return {
    allowed: false,
    reason: `Feature '${feature}' requires ${requiredTier || 'higher'} tier`,
    tier: context.tier,
    requiredTier,
  };
}

/**
 * Check if user is within rate limit
 */
export async function checkRateLimit(
  userId: string,
  limitType: keyof TierLimits
): Promise<AccessCheckResult> {
  const context = await getTierContext(userId);
  const limit = context.limits[limitType];

  // Unlimited
  if (limit === -1) {
    return { allowed: true, tier: context.tier };
  }

  // Get current usage
  const usageField = limitTypeToUsageField(limitType);
  const currentUsage = usageField && context.usage
    ? (context.usage[usageField as keyof SubscriptionUsage] as number) || 0
    : 0;

  if (currentUsage < limit) {
    return {
      allowed: true,
      tier: context.tier,
      currentUsage,
      limit,
    };
  }

  return {
    allowed: false,
    reason: `Daily limit reached: ${currentUsage}/${limit} ${limitType}`,
    tier: context.tier,
    currentUsage,
    limit,
  };
}

/**
 * Check access and increment usage atomically
 */
export async function checkAndIncrementUsage(
  userId: string,
  limitType: keyof TierLimits
): Promise<AccessCheckResult> {
  const result = await checkRateLimit(userId, limitType);

  if (result.allowed) {
    const usageField = limitTypeToUsageField(limitType);
    if (usageField) {
      await incrementUsage(userId, usageField as keyof Omit<SubscriptionUsage, 'userId' | 'date'>);
    }
  }

  return result;
}

// ============================================================================
// AGENT ACCESS CHECKS
// ============================================================================

/**
 * Check if user can call a specific agent
 */
export async function checkAgentAccess(
  userId: string,
  agent: 'scout' | 'analyst' | 'trader' | 'xdegen'
): Promise<AccessCheckResult> {
  const featureMap: Record<string, keyof TierFeatures> = {
    scout: 'scoutAgent',
    analyst: 'analystAgent',
    trader: 'traderAgent',
    xdegen: 'xdegenAgent',
  };

  const limitMap: Record<string, keyof TierLimits> = {
    scout: 'scoutCallsPerDay',
    analyst: 'analystCallsPerDay',
    trader: 'traderCallsPerDay',
  };

  // Check feature access
  const featureCheck = await checkFeatureAccess(userId, featureMap[agent]);
  if (!featureCheck.allowed) {
    return featureCheck;
  }

  // Check rate limit (if applicable)
  const limitType = limitMap[agent];
  if (limitType) {
    return checkAndIncrementUsage(userId, limitType);
  }

  return { allowed: true, tier: featureCheck.tier };
}

// ============================================================================
// API MIDDLEWARE
// ============================================================================

/**
 * Middleware to require a minimum tier
 */
export function requireTier(minimumTier: SubscriptionTier) {
  return async function middleware(
    request: NextRequest,
    handler: (req: NextRequest, context: TierContext) => Promise<NextResponse>
  ): Promise<NextResponse> {
    const userId = request.headers.get('x-user-id') ||
                   request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing user ID' },
        { status: 401 }
      );
    }

    const context = await getTierContext(userId);

    // Check tier level
    const tierOrder: SubscriptionTier[] = ['free', 'pro', 'alpha', 'whale', 'enterprise'];
    const userTierIndex = tierOrder.indexOf(context.tier);
    const requiredTierIndex = tierOrder.indexOf(minimumTier);

    if (userTierIndex < requiredTierIndex) {
      return NextResponse.json(
        {
          error: 'Upgrade required',
          message: `This feature requires ${minimumTier} tier or higher`,
          currentTier: context.tier,
          requiredTier: minimumTier,
          upgradeUrl: '/subscription',
        },
        { status: 403 }
      );
    }

    return handler(request, context);
  };
}

/**
 * Middleware to require a specific feature
 */
export function requireFeature(feature: keyof TierFeatures) {
  return async function middleware(
    request: NextRequest,
    handler: (req: NextRequest, context: TierContext) => Promise<NextResponse>
  ): Promise<NextResponse> {
    const userId = request.headers.get('x-user-id') ||
                   request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing user ID' },
        { status: 401 }
      );
    }

    const result = await checkFeatureAccess(userId, feature);

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: 'Feature not available',
          message: result.reason,
          currentTier: result.tier,
          requiredTier: result.requiredTier,
          upgradeUrl: '/subscription',
        },
        { status: 403 }
      );
    }

    const context = await getTierContext(userId);
    return handler(request, context);
  };
}

/**
 * Middleware to enforce rate limits
 */
export function enforceRateLimit(limitType: keyof TierLimits) {
  return async function middleware(
    request: NextRequest,
    handler: (req: NextRequest, context: TierContext) => Promise<NextResponse>
  ): Promise<NextResponse> {
    const userId = request.headers.get('x-user-id') ||
                   request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing user ID' },
        { status: 401 }
      );
    }

    const result = await checkAndIncrementUsage(userId, limitType);

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: result.reason,
          currentUsage: result.currentUsage,
          limit: result.limit,
          tier: result.tier,
          upgradeUrl: '/subscription',
        },
        { status: 429 }
      );
    }

    const context = await getTierContext(userId);
    return handler(request, context);
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function limitTypeToUsageField(limitType: keyof TierLimits): string | null {
  const mapping: Record<keyof TierLimits, string | null> = {
    queriesPerDay: 'queriesUsed',
    scoutCallsPerDay: 'scoutCallsUsed',
    analystCallsPerDay: 'analystCallsUsed',
    traderCallsPerDay: 'traderCallsUsed',
    alertsPerDay: 'alertsSent',
    watchlistSize: null,
    apiCallsPerMinute: null,
    apiCallsPerDay: 'apiCallsUsed',
  };

  return mapping[limitType];
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  hasFeature,
  isWithinLimit,
  getTierFeatures,
  getTierLimits,
};
