/**
 * Stripe Configuration for BeRight Protocol
 *
 * Tier definitions with pricing and feature gates.
 *
 * PRICING STRATEGY (based on cost analysis):
 * - Free: Limited access, lead generation
 * - Pro ($29): Power users, 10x ROI target
 * - Alpha ($79): Serious traders, full agent access
 * - Whale ($199): High-volume, priority everything
 * - Enterprise ($499): Custom, white-glove
 */

import { TierConfig, SubscriptionTier, TierFeatures, TierLimits } from '../../types/subscription';

// ============================================================================
// TIER DEFINITIONS
// ============================================================================

export const TIERS: Record<SubscriptionTier, TierConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Get started with basic market intelligence',
    priceMonthly: 0,
    priceYearly: 0,
    features: {
      dashboardAccess: true,
      telegramBot: true,
      apiAccess: false,
      scoutAgent: true,
      analystAgent: false,
      traderAgent: false,
      xdegenAgent: false,
      arbitrageAlerts: false,
      signalIntelligence: false,
      deepResearch: false,
      portfolioTracking: false,
      autoExecution: false,
      customAlerts: false,
      prioritySupport: false,
      whiteGlove: false,
    },
    limits: {
      queriesPerDay: 10,
      scoutCallsPerDay: 5,
      analystCallsPerDay: 0,
      traderCallsPerDay: 0,
      alertsPerDay: 0,
      watchlistSize: 3,
      apiCallsPerMinute: 0,
      apiCallsPerDay: 0,
    },
    badge: 'FREE',
    color: '#6B7280', // gray
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'Full Scout access with signal intelligence',
    priceMonthly: 29,
    priceYearly: 290, // ~17% discount
    stripePriceIdMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_PRO_YEARLY,
    features: {
      dashboardAccess: true,
      telegramBot: true,
      apiAccess: true,
      scoutAgent: true,
      analystAgent: false,
      traderAgent: false,
      xdegenAgent: false,
      arbitrageAlerts: true,
      signalIntelligence: true,
      deepResearch: false,
      portfolioTracking: true,
      autoExecution: false,
      customAlerts: true,
      prioritySupport: false,
      whiteGlove: false,
    },
    limits: {
      queriesPerDay: 100,
      scoutCallsPerDay: 50,
      analystCallsPerDay: 0,
      traderCallsPerDay: 0,
      alertsPerDay: 20,
      watchlistSize: 20,
      apiCallsPerMinute: 10,
      apiCallsPerDay: 1000,
    },
    badge: 'PRO',
    color: '#3B82F6', // blue
  },

  alpha: {
    id: 'alpha',
    name: 'Alpha',
    description: 'Full agent access with deep research',
    priceMonthly: 79,
    priceYearly: 790, // ~17% discount
    stripePriceIdMonthly: process.env.STRIPE_PRICE_ALPHA_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_ALPHA_YEARLY,
    features: {
      dashboardAccess: true,
      telegramBot: true,
      apiAccess: true,
      scoutAgent: true,
      analystAgent: true,
      traderAgent: true,
      xdegenAgent: true,
      arbitrageAlerts: true,
      signalIntelligence: true,
      deepResearch: true,
      portfolioTracking: true,
      autoExecution: false,
      customAlerts: true,
      prioritySupport: false,
      whiteGlove: false,
    },
    limits: {
      queriesPerDay: 500,
      scoutCallsPerDay: 200,
      analystCallsPerDay: 20,
      traderCallsPerDay: 50,
      alertsPerDay: 100,
      watchlistSize: 50,
      apiCallsPerMinute: 30,
      apiCallsPerDay: 5000,
    },
    badge: 'ALPHA',
    color: '#8B5CF6', // purple
  },

  whale: {
    id: 'whale',
    name: 'Whale',
    description: 'Unlimited access with auto-execution',
    priceMonthly: 199,
    priceYearly: 1990, // ~17% discount
    stripePriceIdMonthly: process.env.STRIPE_PRICE_WHALE_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_WHALE_YEARLY,
    features: {
      dashboardAccess: true,
      telegramBot: true,
      apiAccess: true,
      scoutAgent: true,
      analystAgent: true,
      traderAgent: true,
      xdegenAgent: true,
      arbitrageAlerts: true,
      signalIntelligence: true,
      deepResearch: true,
      portfolioTracking: true,
      autoExecution: true,
      customAlerts: true,
      prioritySupport: true,
      whiteGlove: false,
    },
    limits: {
      queriesPerDay: 2000,
      scoutCallsPerDay: 1000,
      analystCallsPerDay: 100,
      traderCallsPerDay: 200,
      alertsPerDay: 500,
      watchlistSize: 200,
      apiCallsPerMinute: 60,
      apiCallsPerDay: 20000,
    },
    badge: 'WHALE',
    color: '#F59E0B', // amber
  },

  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Custom solution with white-glove support',
    priceMonthly: 499,
    priceYearly: 4990, // ~17% discount
    stripePriceIdMonthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY,
    features: {
      dashboardAccess: true,
      telegramBot: true,
      apiAccess: true,
      scoutAgent: true,
      analystAgent: true,
      traderAgent: true,
      xdegenAgent: true,
      arbitrageAlerts: true,
      signalIntelligence: true,
      deepResearch: true,
      portfolioTracking: true,
      autoExecution: true,
      customAlerts: true,
      prioritySupport: true,
      whiteGlove: true,
    },
    limits: {
      queriesPerDay: -1, // unlimited
      scoutCallsPerDay: -1,
      analystCallsPerDay: -1,
      traderCallsPerDay: -1,
      alertsPerDay: -1,
      watchlistSize: -1,
      apiCallsPerMinute: 120,
      apiCallsPerDay: -1,
    },
    badge: 'ENTERPRISE',
    color: '#10B981', // emerald
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get tier configuration
 */
export function getTierConfig(tier: SubscriptionTier): TierConfig {
  return TIERS[tier];
}

/**
 * Get tier features
 */
export function getTierFeatures(tier: SubscriptionTier): TierFeatures {
  return TIERS[tier].features;
}

/**
 * Get tier limits
 */
export function getTierLimits(tier: SubscriptionTier): TierLimits {
  return TIERS[tier].limits;
}

/**
 * Check if a tier has access to a feature
 */
export function hasFeature(tier: SubscriptionTier, feature: keyof TierFeatures): boolean {
  return TIERS[tier].features[feature];
}

/**
 * Check if usage is within tier limits
 * Returns -1 for unlimited
 */
export function getLimit(tier: SubscriptionTier, limit: keyof TierLimits): number {
  return TIERS[tier].limits[limit];
}

/**
 * Check if user is within their limit
 */
export function isWithinLimit(
  tier: SubscriptionTier,
  limit: keyof TierLimits,
  currentUsage: number
): boolean {
  const maxLimit = getLimit(tier, limit);
  if (maxLimit === -1) return true; // unlimited
  return currentUsage < maxLimit;
}

/**
 * Get all paid tiers
 */
export function getPaidTiers(): TierConfig[] {
  return Object.values(TIERS).filter(t => t.priceMonthly > 0);
}

/**
 * Get Stripe price ID for a tier
 */
export function getStripePriceId(
  tier: Exclude<SubscriptionTier, 'free'>,
  interval: 'month' | 'year'
): string | undefined {
  const config = TIERS[tier];
  return interval === 'month' ? config.stripePriceIdMonthly : config.stripePriceIdYearly;
}

/**
 * Compare tier levels (for upgrade/downgrade detection)
 */
export function compareTiers(tierA: SubscriptionTier, tierB: SubscriptionTier): number {
  const order: SubscriptionTier[] = ['free', 'pro', 'alpha', 'whale', 'enterprise'];
  return order.indexOf(tierA) - order.indexOf(tierB);
}

/**
 * Check if tierA is higher than tierB
 */
export function isHigherTier(tierA: SubscriptionTier, tierB: SubscriptionTier): boolean {
  return compareTiers(tierA, tierB) > 0;
}
