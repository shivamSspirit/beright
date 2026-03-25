/**
 * Delegation Hooks
 *
 * Hooks for interacting with the delegation pool system.
 */

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/hooks/useUnifiedUser';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ============================================================================
// Types
// ============================================================================

export type ForecasterTier = 'unranked' | 'rookie' | 'verified' | 'elite' | 'super';
export type PoolStatus = 'pending' | 'open' | 'active' | 'paused' | 'settling' | 'closed';

export interface PoolSummary {
  id: string;
  poolPda: string;
  slug: string | null;
  name: string | null;
  forecasterWallet: string;
  forecasterTier: ForecasterTier;
  forecasterBrier: number | null;
  status: PoolStatus;
  tvl: number;
  navPerShare: number;
  delegatorCount: number;
  performanceFeeBps: number;
  createdAt: string;
}

export interface PoolDetails extends PoolSummary {
  description: string | null;
  baseToken: string;
  minDeposit: number;
  maxCapacity: number;
  managementFeeBps: number;
  entryFeeBps: number;
  exitFeeBps: number;
  highWaterMark: number;
  forecasterPredictions: number | null;
  activatedAt: string | null;
  navHistory: { timestamp: string; nav: number }[];
}

export interface DelegationSummary {
  poolId: string;
  poolPda: string;
  poolName: string | null;
  shares: number;
  depositedAmount: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  hasWithdrawalPending: boolean;
  withdrawableAfter: string | null;
}

export interface EligibilityResult {
  wallet: string;
  eligible: boolean;
  tier: ForecasterTier;
  tierLabel: string;
  tierBadge: string;
  tierColor: string;
  maxCapacity: number;
  brierScore: number | null;
  predictionCount: number;
  reason?: string;
  tierProgression: {
    tier: string;
    label: string;
    badge: string;
    color: string;
    maxBrier: number;
    minPredictions: number;
    capacity: string;
    achieved: boolean;
  }[];
  nextTier: {
    tier: string;
    label: string;
    brierNeeded: number;
    predictionsNeeded: number;
    brierProgress: number;
    predictionsProgress: number;
  } | null;
}

export interface DelegatorPortfolio {
  wallet: string;
  summary: {
    totalDelegated: number;
    totalCurrentValue: number;
    totalPnl: number;
    totalPnlPercent: number;
    activePools: number;
    pendingWithdrawals: number;
    poolCount: number;
  };
  delegations: DelegationSummary[];
}

// ============================================================================
// Pool Listing Hook
// ============================================================================

interface UsePoolsOptions {
  status?: PoolStatus | PoolStatus[];
  tier?: ForecasterTier | ForecasterTier[];
  sortBy?: 'tvl' | 'nav' | 'delegators' | 'created' | 'brier';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}

export function usePools(options: UsePoolsOptions = {}) {
  const [pools, setPools] = useState<PoolSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPools = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options.status) {
        params.set('status', Array.isArray(options.status) ? options.status.join(',') : options.status);
      }
      if (options.tier) {
        params.set('tier', Array.isArray(options.tier) ? options.tier.join(',') : options.tier);
      }
      if (options.sortBy) params.set('sortBy', options.sortBy);
      if (options.sortOrder) params.set('sortOrder', options.sortOrder);
      if (options.limit) params.set('limit', options.limit.toString());

      const res = await fetch(`${API_BASE}/api/v2/delegation/pools?${params}`);
      const data = await res.json();

      if (data.success) {
        setPools(data.data);
      } else {
        setError(data.error || 'Failed to fetch pools');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pools');
    } finally {
      setLoading(false);
    }
  }, [options.status, options.tier, options.sortBy, options.sortOrder, options.limit]);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  return { pools, loading, error, refetch: fetchPools };
}

// ============================================================================
// Pool Details Hook
// ============================================================================

export function usePoolDetails(poolIdOrSlug: string | null) {
  const [pool, setPool] = useState<PoolDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!poolIdOrSlug) {
      setPool(null);
      setLoading(false);
      return;
    }

    async function fetchPool() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${API_BASE}/api/v2/delegation/pools/${poolIdOrSlug}`);
        const data = await res.json();

        if (data.success) {
          setPool(data.data);
        } else {
          setError(data.error || 'Pool not found');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch pool');
      } finally {
        setLoading(false);
      }
    }

    fetchPool();
  }, [poolIdOrSlug]);

  return { pool, loading, error };
}

// ============================================================================
// Eligibility Hook
// ============================================================================

export function usePoolEligibility() {
  const { walletAddress } = useUser();
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      setEligibility(null);
      return;
    }

    async function checkEligibility() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${API_BASE}/api/v2/delegation/eligibility?wallet=${walletAddress}`);
        const data = await res.json();

        if (data.success) {
          setEligibility(data.data);
        } else {
          setError(data.error || 'Failed to check eligibility');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to check eligibility');
      } finally {
        setLoading(false);
      }
    }

    checkEligibility();
  }, [walletAddress]);

  return { eligibility, loading, error };
}

// ============================================================================
// Delegator Portfolio Hook
// ============================================================================

export function useDelegatorPortfolio() {
  const { walletAddress } = useUser();
  const [portfolio, setPortfolio] = useState<DelegatorPortfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    if (!walletAddress) {
      setPortfolio(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/v2/delegation/delegator?wallet=${walletAddress}`);
      const data = await res.json();

      if (data.success) {
        setPortfolio(data.data);
      } else {
        setError(data.error || 'Failed to fetch portfolio');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch portfolio');
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  return { portfolio, loading, error, refetch: fetchPortfolio };
}

// ============================================================================
// Pool Actions Hook
// ============================================================================

export function usePoolActions(poolId: string) {
  const { walletAddress } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performAction = useCallback(
    async (action: string, params: Record<string, any> = {}) => {
      if (!walletAddress) {
        setError('Wallet not connected');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${API_BASE}/api/v2/delegation/pools/${poolId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            wallet: walletAddress,
            ...params,
          }),
        });

        const data = await res.json();

        if (data.success) {
          return data.data;
        } else {
          setError(data.error || 'Action failed');
          return null;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Action failed');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [poolId, walletAddress]
  );

  const delegate = useCallback(
    (amount: number) => performAction('delegate', { amount }),
    [performAction]
  );

  const undelegate = useCallback(
    (shares: number) => performAction('undelegate', { shares }),
    [performAction]
  );

  const processWithdrawal = useCallback(
    () => performAction('processWithdrawal'),
    [performAction]
  );

  return {
    delegate,
    undelegate,
    processWithdrawal,
    loading,
    error,
  };
}

// ============================================================================
// Helpers
// ============================================================================

export function formatTvl(tvl: number, isDemo: boolean = false): string {
  if (isDemo) {
    // Demo mode: display as SOL
    if (tvl >= 1_000) return `${(tvl / 1_000).toFixed(2)}K SOL`;
    return `${tvl.toFixed(4)} SOL`;
  }
  // Production: display as USD
  if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(2)}M`;
  if (tvl >= 1_000) return `$${(tvl / 1_000).toFixed(1)}K`;
  return `$${tvl.toFixed(2)}`;
}

export function formatNav(nav: number): string {
  return nav.toFixed(4);
}

export function formatPnl(pnl: number, showSign = true, isDemo: boolean = false): string {
  const sign = showSign && pnl > 0 ? '+' : '';
  if (isDemo) {
    return `${sign}${Math.abs(pnl).toFixed(4)} SOL`;
  }
  return `${sign}$${Math.abs(pnl).toFixed(2)}`;
}

export function formatPercent(pct: number, showSign = true): string {
  const sign = showSign && pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

export const TIER_COLORS: Record<ForecasterTier, string> = {
  super: '#FFD700',
  elite: '#C0C0C0',
  verified: '#4CAF50',
  rookie: '#2196F3',
  unranked: '#9E9E9E',
};

export const TIER_LABELS: Record<ForecasterTier, string> = {
  super: 'Super Forecaster',
  elite: 'Elite',
  verified: 'Verified',
  rookie: 'Rookie',
  unranked: 'Unranked',
};
