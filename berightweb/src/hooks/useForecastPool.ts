/**
 * useForecastPool Hook
 *
 * React hook for interacting with Forecaster Staking Pools.
 *
 * @author BeRight Protocol
 */

import { useState, useCallback, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';

// Types from the SDK
export enum PoolTier {
  StarterSol = 0,
  BasicSol = 1,
  StarterUsdc = 2,
  BasicUsdc = 3,
  ProSol = 4,
  ProUsdc = 5,
  EliteSol = 6,
  EliteUsdc = 7,
}

export interface TierConfig {
  tier: PoolTier;
  name: string;
  capacity: number;
  capacityDisplay: string;
  token: 'SOL' | 'USDC';
  maxBrier: number;
  minPredictions: number;
  minDeposit: number;
  isPro: boolean;
}

export const TIER_CONFIGS: Record<PoolTier, TierConfig> = {
  [PoolTier.StarterSol]: {
    tier: PoolTier.StarterSol,
    name: 'Starter SOL',
    capacity: 5 * 1e9,
    capacityDisplay: '5 SOL',
    token: 'SOL',
    maxBrier: 0.35,
    minPredictions: 10,
    minDeposit: 0.05 * 1e9,
    isPro: false,
  },
  [PoolTier.BasicSol]: {
    tier: PoolTier.BasicSol,
    name: 'Basic SOL',
    capacity: 10 * 1e9,
    capacityDisplay: '10 SOL',
    token: 'SOL',
    maxBrier: 0.30,
    minPredictions: 25,
    minDeposit: 0.1 * 1e9,
    isPro: false,
  },
  [PoolTier.StarterUsdc]: {
    tier: PoolTier.StarterUsdc,
    name: 'Starter USDC',
    capacity: 500 * 1e6,
    capacityDisplay: '500 USDC',
    token: 'USDC',
    maxBrier: 0.35,
    minPredictions: 10,
    minDeposit: 5 * 1e6,
    isPro: false,
  },
  [PoolTier.BasicUsdc]: {
    tier: PoolTier.BasicUsdc,
    name: 'Basic USDC',
    capacity: 1000 * 1e6,
    capacityDisplay: '1,000 USDC',
    token: 'USDC',
    maxBrier: 0.30,
    minPredictions: 25,
    minDeposit: 10 * 1e6,
    isPro: false,
  },
  [PoolTier.ProSol]: {
    tier: PoolTier.ProSol,
    name: 'Pro SOL',
    capacity: 100 * 1e9,
    capacityDisplay: '100 SOL',
    token: 'SOL',
    maxBrier: 0.25,
    minPredictions: 100,
    minDeposit: 1 * 1e9,
    isPro: true,
  },
  [PoolTier.ProUsdc]: {
    tier: PoolTier.ProUsdc,
    name: 'Pro USDC',
    capacity: 10000 * 1e6,
    capacityDisplay: '10,000 USDC',
    token: 'USDC',
    maxBrier: 0.25,
    minPredictions: 100,
    minDeposit: 100 * 1e6,
    isPro: true,
  },
  [PoolTier.EliteSol]: {
    tier: PoolTier.EliteSol,
    name: 'Elite SOL',
    capacity: 500 * 1e9,
    capacityDisplay: '500 SOL',
    token: 'SOL',
    maxBrier: 0.20,
    minPredictions: 250,
    minDeposit: 5 * 1e9,
    isPro: true,
  },
  [PoolTier.EliteUsdc]: {
    tier: PoolTier.EliteUsdc,
    name: 'Elite USDC',
    capacity: 50000 * 1e6,
    capacityDisplay: '50,000 USDC',
    token: 'USDC',
    maxBrier: 0.20,
    minPredictions: 250,
    minDeposit: 500 * 1e6,
    isPro: true,
  },
};

export interface PoolDisplayInfo {
  address: string;
  forecaster: string;
  tier: TierConfig;
  tvl: number;
  tvlDisplay: string;
  sharePrice: number;
  sharePriceDisplay: string;
  capacity: number;
  utilizationPct: number;
  delegatorCount: number;
  winRate: number;
  predictionCount: number;
  status: 'active' | 'paused' | 'closed';
  createdAt: Date;
}

export interface DelegationInfo {
  poolAddress: string;
  shares: number;
  value: number;
  valueDisplay: string;
  pnl: number;
  pnlPct: number;
  pnlDisplay: string;
  depositedAt: Date;
  lockupComplete: boolean;
  withdrawalFeeRate: number;
}

export interface ForecasterStats {
  brierScore: number;
  predictionCount: number;
  resolvedCount: number;
  winRate: number;
}

/**
 * Get available tiers for a forecaster
 */
export function getAvailableTiers(brierScore: number, predictionCount: number): TierConfig[] {
  return Object.values(TIER_CONFIGS).filter(
    (config) => brierScore <= config.maxBrier && predictionCount >= config.minPredictions
  );
}

/**
 * Format amount for display
 */
function formatAmount(amount: number, token: 'SOL' | 'USDC'): string {
  if (token === 'SOL') {
    return `${(amount / 1e9).toFixed(4)} SOL`;
  }
  return `$${(amount / 1e6).toFixed(2)}`;
}

// =============================================================================
// HOOK
// =============================================================================

interface ForecastPoolState {
  pools: PoolDisplayInfo[];
  delegations: DelegationInfo[];
  forecasterStats: ForecasterStats | null;
  loading: boolean;
  error: string | null;
}

interface UseForecastPoolReturn extends ForecastPoolState {
  // Pool operations
  createPool: (tier: PoolTier) => Promise<string | null>;
  // Delegation operations
  stake: (poolAddress: string, amount: number) => Promise<string | null>;
  unstake: (poolAddress: string, shares: number) => Promise<string | null>;
  // Data fetching
  refreshPools: () => Promise<void>;
  refreshDelegations: () => Promise<void>;
  // Utilities
  getAvailableTiers: () => TierConfig[];
  getTierConfig: (tier: PoolTier) => TierConfig;
}

export function useForecastPool(): UseForecastPoolReturn {
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();

  const [state, setState] = useState<ForecastPoolState>({
    pools: [],
    delegations: [],
    forecasterStats: null,
    loading: false,
    error: null,
  });

  // Fetch forecaster stats from calibration program
  const fetchForecasterStats = useCallback(async (): Promise<ForecasterStats | null> => {
    if (!publicKey) return null;

    try {
      // In production, fetch from calibration program
      // For now, return mock data
      return {
        brierScore: 0.25,
        predictionCount: 50,
        resolvedCount: 45,
        winRate: 0.65,
      };
    } catch (err) {
      console.error('Failed to fetch forecaster stats:', err);
      return null;
    }
  }, [publicKey]);

  // Fetch pools
  const refreshPools = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // In production, fetch from program accounts
      // For now, return empty array
      const pools: PoolDisplayInfo[] = [];

      const forecasterStats = await fetchForecasterStats();

      setState((prev) => ({
        ...prev,
        pools,
        forecasterStats,
        loading: false,
      }));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        error: err.message || 'Failed to fetch pools',
        loading: false,
      }));
    }
  }, [fetchForecasterStats]);

  // Fetch delegations
  const refreshDelegations = useCallback(async () => {
    if (!publicKey) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // In production, fetch from program accounts
      const delegations: DelegationInfo[] = [];

      setState((prev) => ({
        ...prev,
        delegations,
        loading: false,
      }));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        error: err.message || 'Failed to fetch delegations',
        loading: false,
      }));
    }
  }, [publicKey]);

  // Create pool
  const createPool = useCallback(
    async (tier: PoolTier): Promise<string | null> => {
      if (!publicKey || !signTransaction) {
        setState((prev) => ({ ...prev, error: 'Wallet not connected' }));
        return null;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const stats = state.forecasterStats;
        if (!stats) {
          throw new Error('Forecaster stats not available');
        }

        const tierConfig = TIER_CONFIGS[tier];
        if (stats.brierScore > tierConfig.maxBrier) {
          throw new Error(`Brier score too high for ${tierConfig.name} pool`);
        }
        if (stats.predictionCount < tierConfig.minPredictions) {
          throw new Error(`Need ${tierConfig.minPredictions} predictions for ${tierConfig.name} pool`);
        }

        // Build transaction via API
        const response = await fetch('/api/v2/forecast-pools/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tier,
            forecaster: publicKey.toBase58(),
            brierScoreScaled: Math.round(stats.brierScore * 1000),
            predictionCount: stats.predictionCount,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to create pool');
        }

        const { transaction: serializedTx, poolAddress } = await response.json();

        // Sign and send transaction
        const tx = Transaction.from(Buffer.from(serializedTx, 'base64'));
        const signedTx = await signTransaction(tx);
        const signature = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(signature, 'confirmed');

        await refreshPools();

        setState((prev) => ({ ...prev, loading: false }));
        return signature;
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          error: err.message || 'Failed to create pool',
          loading: false,
        }));
        return null;
      }
    },
    [publicKey, signTransaction, connection, state.forecasterStats, refreshPools]
  );

  // Stake to pool
  const stake = useCallback(
    async (poolAddress: string, amount: number): Promise<string | null> => {
      if (!publicKey || !signTransaction) {
        setState((prev) => ({ ...prev, error: 'Wallet not connected' }));
        return null;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        // Build transaction via API
        const response = await fetch(`/api/v2/forecast-pools/${poolAddress}/stake`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            delegator: publicKey.toBase58(),
            amount,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to stake');
        }

        const { transaction: serializedTx } = await response.json();

        // Sign and send transaction
        const tx = Transaction.from(Buffer.from(serializedTx, 'base64'));
        const signedTx = await signTransaction(tx);
        const signature = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(signature, 'confirmed');

        await refreshDelegations();

        setState((prev) => ({ ...prev, loading: false }));
        return signature;
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          error: err.message || 'Failed to stake',
          loading: false,
        }));
        return null;
      }
    },
    [publicKey, signTransaction, connection, refreshDelegations]
  );

  // Unstake from pool
  const unstake = useCallback(
    async (poolAddress: string, shares: number): Promise<string | null> => {
      if (!publicKey || !signTransaction) {
        setState((prev) => ({ ...prev, error: 'Wallet not connected' }));
        return null;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        // Build transaction via API
        const response = await fetch(`/api/v2/forecast-pools/${poolAddress}/unstake`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            delegator: publicKey.toBase58(),
            shares,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to unstake');
        }

        const { transaction: serializedTx } = await response.json();

        // Sign and send transaction
        const tx = Transaction.from(Buffer.from(serializedTx, 'base64'));
        const signedTx = await signTransaction(tx);
        const signature = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(signature, 'confirmed');

        await refreshDelegations();

        setState((prev) => ({ ...prev, loading: false }));
        return signature;
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          error: err.message || 'Failed to unstake',
          loading: false,
        }));
        return null;
      }
    },
    [publicKey, signTransaction, connection, refreshDelegations]
  );

  // Initial fetch
  useEffect(() => {
    if (connected) {
      refreshPools();
      refreshDelegations();
    }
  }, [connected, refreshPools, refreshDelegations]);

  return {
    ...state,
    createPool,
    stake,
    unstake,
    refreshPools,
    refreshDelegations,
    getAvailableTiers: () =>
      state.forecasterStats
        ? getAvailableTiers(state.forecasterStats.brierScore, state.forecasterStats.predictionCount)
        : [],
    getTierConfig: (tier: PoolTier) => TIER_CONFIGS[tier],
  };
}

export default useForecastPool;
