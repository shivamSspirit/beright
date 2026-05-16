'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/hooks/useUnifiedUser';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type SubscriptionTier = 'free' | 'pro' | 'alpha' | 'whale' | 'enterprise';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'unpaid';

export interface TierFeatures {
  dashboardAccess: boolean;
  telegramBot: boolean;
  apiAccess: boolean;
  scoutAgent: boolean;
  analystAgent: boolean;
  traderAgent: boolean;
  xdegenAgent: boolean;
  arbitrageAlerts: boolean;
  signalIntelligence: boolean;
  deepResearch: boolean;
  portfolioTracking: boolean;
  autoExecution: boolean;
  customAlerts: boolean;
  prioritySupport: boolean;
  whiteGlove: boolean;
}

export interface TierLimits {
  queriesPerDay: number;
  scoutCallsPerDay: number;
  analystCallsPerDay: number;
  traderCallsPerDay: number;
  alertsPerDay: number;
  watchlistSize: number;
  apiCallsPerMinute: number;
  apiCallsPerDay: number;
}

export interface SubscriptionUsage {
  queriesUsed: number;
  scoutCallsUsed: number;
  analystCallsUsed: number;
  traderCallsUsed: number;
  alertsSent: number;
  apiCallsUsed: number;
}

export interface TierInfo {
  name: string;
  description: string;
  badge: string;
  color: string;
  priceMonthly: number;
  priceYearly: number;
}

export interface Subscription {
  id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  billingInterval: 'month' | 'year';
}

export interface SubscriptionData {
  subscription: Subscription | null;
  tier: SubscriptionTier;
  tierInfo: TierInfo;
  features: TierFeatures;
  limits: TierLimits;
  usage: SubscriptionUsage | null;
  stripeConfigured: boolean;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TIER COLORS & BADGES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const TIER_CONFIG: Record<SubscriptionTier, { badge: string; color: string; name: string }> = {
  free: { badge: 'FREE', color: '#6B7280', name: 'Free' },
  pro: { badge: 'PRO', color: '#3B82F6', name: 'Pro' },
  alpha: { badge: 'ALPHA', color: '#8B5CF6', name: 'Alpha' },
  whale: { badge: 'WHALE', color: '#F59E0B', name: 'Whale' },
  enterprise: { badge: 'ENTERPRISE', color: '#10B981', name: 'Enterprise' },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HOOK
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useSubscription() {
  const { user, isAuthenticated } = useUser();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/stripe/subscription?userId=${user.id}`);

      if (!response.ok) {
        throw new Error('Failed to fetch subscription');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('[useSubscription] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch subscription');
      // Set default free tier on error
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Derived values
  const tier = data?.tier || 'free';
  const tierConfig = TIER_CONFIG[tier];
  const features = data?.features || getDefaultFeatures();
  const limits = data?.limits || getDefaultLimits();
  const usage = data?.usage || null;
  const subscription = data?.subscription || null;
  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing';
  const isPaid = tier !== 'free';
  const willCancel = subscription?.cancelAtPeriodEnd || false;

  // Helper functions
  const hasFeature = (feature: keyof TierFeatures): boolean => {
    return features[feature] || false;
  };

  const hasAgentAccess = (agent: 'scout' | 'analyst' | 'trader' | 'xdegen'): boolean => {
    const featureMap: Record<string, keyof TierFeatures> = {
      scout: 'scoutAgent',
      analyst: 'analystAgent',
      trader: 'traderAgent',
      xdegen: 'xdegenAgent',
    };
    return hasFeature(featureMap[agent]);
  };

  const getRemainingQueries = (): number => {
    if (limits.queriesPerDay === -1) return Infinity;
    return Math.max(0, limits.queriesPerDay - (usage?.queriesUsed || 0));
  };

  const getUsagePercent = (type: 'queries' | 'scout' | 'analyst' | 'trader'): number => {
    const usageMap: Record<string, { used: keyof SubscriptionUsage; limit: keyof TierLimits }> = {
      queries: { used: 'queriesUsed', limit: 'queriesPerDay' },
      scout: { used: 'scoutCallsUsed', limit: 'scoutCallsPerDay' },
      analyst: { used: 'analystCallsUsed', limit: 'analystCallsPerDay' },
      trader: { used: 'traderCallsUsed', limit: 'traderCallsPerDay' },
    };

    const { used, limit } = usageMap[type];
    const limitValue = limits[limit];
    if (limitValue === -1 || limitValue === 0) return 0;

    const usedValue = usage?.[used] || 0;
    return Math.min(100, Math.round((usedValue / limitValue) * 100));
  };

  const openBillingPortal = async (): Promise<void> => {
    if (!user?.id) return;

    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      const result = await response.json();
      if (result.portalUrl) {
        window.location.href = result.portalUrl;
      }
    } catch (err) {
      console.error('[useSubscription] Failed to open billing portal:', err);
    }
  };

  const cancelSubscription = async (): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const response = await fetch('/api/stripe/subscription', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      if (response.ok) {
        await fetchSubscription();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[useSubscription] Failed to cancel:', err);
      return false;
    }
  };

  const reactivateSubscription = async (): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const response = await fetch('/api/stripe/subscription', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, action: 'reactivate' }),
      });

      if (response.ok) {
        await fetchSubscription();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[useSubscription] Failed to reactivate:', err);
      return false;
    }
  };

  return {
    // State
    isLoading,
    error,

    // Subscription data
    subscription,
    tier,
    tierConfig,
    features,
    limits,
    usage,

    // Derived state
    isActive,
    isPaid,
    willCancel,

    // Helper functions
    hasFeature,
    hasAgentAccess,
    getRemainingQueries,
    getUsagePercent,

    // Actions
    refresh: fetchSubscription,
    openBillingPortal,
    cancelSubscription,
    reactivateSubscription,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DEFAULT VALUES (for free tier)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getDefaultFeatures(): TierFeatures {
  return {
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
  };
}

function getDefaultLimits(): TierLimits {
  return {
    queriesPerDay: 10,
    scoutCallsPerDay: 5,
    analystCallsPerDay: 0,
    traderCallsPerDay: 0,
    alertsPerDay: 0,
    watchlistSize: 3,
    apiCallsPerMinute: 0,
    apiCallsPerDay: 0,
  };
}

export default useSubscription;
