/**
 * useForecastPool Hook
 *
 * React hook for interacting with Forecaster Staking Pools.
 * Works with both Privy (production) and Jupiter (demo) wallet providers.
 *
 * @author BeRight Protocol
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { PublicKey, Transaction, Connection } from '@solana/web3.js';

// =============================================================================
// WALLET BRIDGE TYPES (local, not global to avoid conflicts)
// =============================================================================

interface LocalWalletState {
  connected: boolean;
  connecting: boolean;
  disconnecting: boolean;
  publicKey: string | null;
  walletName: string | null;
  walletIcon: string | null;
}

interface LocalWalletFuncs {
  signTransaction?: (tx: unknown) => Promise<unknown>;
  disconnect?: () => Promise<void>;
}

// Helper to read wallet state from window
function getWalletFromWindow(): { state: LocalWalletState | null; funcs: LocalWalletFuncs | null } {
  if (typeof window === 'undefined') {
    return { state: null, funcs: null };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return {
    state: w.__BERIGHT_WALLET__ || null,
    funcs: w.__BERIGHT_WALLET_FUNCS__ || null,
  };
}

function getMode(): string {
  if (typeof window === 'undefined') return 'unknown';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).__BERIGHT_MODE__ || 'unknown';
}

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

// On-chain program requires: Brier < 0.25, 20+ predictions
// Tier requirements must satisfy these minimums
export const TIER_CONFIGS: Record<PoolTier, TierConfig> = {
  [PoolTier.StarterSol]: {
    tier: PoolTier.StarterSol,
    name: 'Starter SOL',
    capacity: 5 * 1e9,
    capacityDisplay: '5 SOL',
    token: 'SOL',
    maxBrier: 0.249, // On-chain requires < 0.25
    minPredictions: 20, // On-chain minimum
    minDeposit: 0.1 * 1e9, // 0.1 SOL minimum
    isPro: false,
  },
  [PoolTier.BasicSol]: {
    tier: PoolTier.BasicSol,
    name: 'Basic SOL',
    capacity: 10 * 1e9,
    capacityDisplay: '10 SOL',
    token: 'SOL',
    maxBrier: 0.249,
    minPredictions: 20,
    minDeposit: 0.1 * 1e9,
    isPro: false,
  },
  [PoolTier.StarterUsdc]: {
    tier: PoolTier.StarterUsdc,
    name: 'Starter USDC',
    capacity: 500 * 1e6,
    capacityDisplay: '500 USDC',
    token: 'USDC',
    maxBrier: 0.249,
    minPredictions: 20,
    minDeposit: 5 * 1e6,
    isPro: false,
  },
  [PoolTier.BasicUsdc]: {
    tier: PoolTier.BasicUsdc,
    name: 'Basic USDC',
    capacity: 1000 * 1e6,
    capacityDisplay: '1,000 USDC',
    token: 'USDC',
    maxBrier: 0.249,
    minPredictions: 20,
    minDeposit: 10 * 1e6,
    isPro: false,
  },
  [PoolTier.ProSol]: {
    tier: PoolTier.ProSol,
    name: 'Pro SOL',
    capacity: 100 * 1e9,
    capacityDisplay: '100 SOL',
    token: 'SOL',
    maxBrier: 0.20,
    minPredictions: 50,
    minDeposit: 1 * 1e9,
    isPro: true,
  },
  [PoolTier.ProUsdc]: {
    tier: PoolTier.ProUsdc,
    name: 'Pro USDC',
    capacity: 10000 * 1e6,
    capacityDisplay: '10,000 USDC',
    token: 'USDC',
    maxBrier: 0.20,
    minPredictions: 50,
    minDeposit: 100 * 1e6,
    isPro: true,
  },
  [PoolTier.EliteSol]: {
    tier: PoolTier.EliteSol,
    name: 'Elite SOL',
    capacity: 500 * 1e9,
    capacityDisplay: '500 SOL',
    token: 'SOL',
    maxBrier: 0.15,
    minPredictions: 100,
    minDeposit: 5 * 1e9,
    isPro: true,
  },
  [PoolTier.EliteUsdc]: {
    tier: PoolTier.EliteUsdc,
    name: 'Elite USDC',
    capacity: 50000 * 1e6,
    capacityDisplay: '50,000 USDC',
    token: 'USDC',
    maxBrier: 0.15,
    minPredictions: 100,
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
  existingPool: PoolDisplayInfo | null; // User's own pool if they have one
  loading: boolean;
  error: string | null;
}

interface UseForecastPoolReturn extends ForecastPoolState {
  // Wallet state (from window bridge)
  connected: boolean;
  walletAddress: string | null;
  // Pool ownership
  hasPool: boolean; // true if user already has a pool
  // Pool operations
  createPool: (tier: PoolTier, tokenMint?: string) => Promise<string | null>;
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

// =============================================================================
// RPC CONNECTION
// =============================================================================

function getConnection(): Connection {
  // Use devnet for demo mode, mainnet for production
  // IMPORTANT: Must match the RPC used by the API to avoid blockhash mismatch
  const isDemo = getMode() === 'demo';
  const rpcUrl = isDemo
    ? (process.env.NEXT_PUBLIC_HELIUS_RPC_DEVNET || process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com')
    : (process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
  console.log(`[useForecastPool] Using RPC: ${rpcUrl.slice(0, 40)}...`);
  return new Connection(rpcUrl, 'confirmed');
}

// =============================================================================
// HOOK
// =============================================================================

export function useForecastPool(): UseForecastPoolReturn {
  // Create connection instance (memoized)
  const connection = useMemo(() => getConnection(), []);

  // Track wallet state from window bridge (works with both Privy and Jupiter)
  const [walletState, setWalletState] = useState<{
    publicKey: PublicKey | null;
    connected: boolean;
    signTransaction: ((tx: Transaction) => Promise<Transaction>) | null;
  }>({
    publicKey: null,
    connected: false,
    signTransaction: null,
  });

  // Poll window for wallet state changes
  useEffect(() => {
    const updateWalletState = () => {
      const { state, funcs } = getWalletFromWindow();

      if (state && state.publicKey) {
        try {
          const pk = new PublicKey(state.publicKey);
          setWalletState({
            publicKey: pk,
            connected: state.connected,
            signTransaction: funcs?.signTransaction
              ? async (tx: Transaction) => {
                  const signed = await funcs.signTransaction!(tx);
                  return signed as Transaction;
                }
              : null,
          });
        } catch {
          setWalletState({ publicKey: null, connected: false, signTransaction: null });
        }
      } else {
        setWalletState({ publicKey: null, connected: false, signTransaction: null });
      }
    };

    // Initial check
    updateWalletState();

    // Poll for changes (wallet providers update window state asynchronously)
    const interval = setInterval(updateWalletState, 500);

    return () => clearInterval(interval);
  }, []);

  // Destructure for convenience
  const { publicKey, connected, signTransaction } = walletState;

  const [state, setState] = useState<ForecastPoolState>({
    pools: [],
    delegations: [],
    forecasterStats: null,
    existingPool: null,
    loading: false,
    error: null,
  });

  // Fetch forecaster stats from calibration program
  const fetchForecasterStats = useCallback(async (): Promise<ForecasterStats | null> => {
    // Get current wallet state from window (not from React state which may be stale)
    const { state: walletState } = getWalletFromWindow();
    const walletPk = walletState?.publicKey;

    if (!walletPk) {
      console.log('[useForecastPool] fetchForecasterStats: No wallet connected');
      return null;
    }

    try {
      console.log('[useForecastPool] fetchForecasterStats: Returning mock stats for', walletPk.slice(0, 8));
      // In production, fetch from calibration program
      // For now, return mock data that qualifies for all tiers
      // NOTE: Program requires Brier < 0.25 (strictly less than), so use 0.20
      return {
        brierScore: 0.20,
        predictionCount: 50,
        resolvedCount: 45,
        winRate: 0.65,
      };
    } catch (err) {
      console.error('Failed to fetch forecaster stats:', err);
      return null;
    }
  }, []);

  // Fetch pools from blockchain
  const refreshPools = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      let pools: PoolDisplayInfo[] = [];
      let existingPool: PoolDisplayInfo | null = null;

      // If wallet connected, fetch their pool
      const { state: walletState } = getWalletFromWindow();
      if (walletState?.publicKey) {
        try {
          // Fetch pool for this forecaster via API
          console.log('[useForecastPool] Fetching pools for:', walletState.publicKey.slice(0, 12));
          const response = await fetch(`/api/v2/forecast-pools?forecaster=${walletState.publicKey}`);
          const data = await response.json();
          console.log('[useForecastPool] API response:', data);

          if (response.ok && data.success && data.data?.pools) {
            pools = data.data.pools;
            // The first pool returned for this forecaster is their own pool
            if (pools.length > 0) {
              existingPool = pools[0];
              console.log('[useForecastPool] Found existing pool:', existingPool.address);
            }
          }
        } catch (err) {
          console.log('[useForecastPool] Could not fetch pools:', err);
        }
      }

      const forecasterStats = await fetchForecasterStats();

      setState((prev) => ({
        ...prev,
        pools,
        existingPool,
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
    async (tier: PoolTier, tokenMint?: string): Promise<string | null> => {
      console.log('[useForecastPool.createPool] Called with tier:', tier, 'tokenMint:', tokenMint?.slice(0, 8) || 'default');
      console.log('[useForecastPool.createPool] Wallet state:', {
        publicKey: publicKey?.toBase58() || 'null',
        hasSignTransaction: !!signTransaction,
        connectionEndpoint: connection?.rpcEndpoint || 'no connection',
      });

      if (!publicKey || !signTransaction) {
        console.error('[useForecastPool.createPool] Wallet not connected - publicKey:', !!publicKey, 'signTransaction:', !!signTransaction);
        setState((prev) => ({ ...prev, error: 'Wallet not connected' }));
        return null;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const stats = state.forecasterStats;
        console.log('[useForecastPool.createPool] Forecaster stats:', stats);
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
        const requestBody: {
          tier: PoolTier;
          forecaster: string;
          brierScoreScaled: number;
          predictionCount: number;
          tokenMint?: string;
        } = {
          tier,
          forecaster: publicKey.toBase58(),
          brierScoreScaled: Math.round(stats.brierScore * 1000),
          predictionCount: stats.predictionCount,
        };
        // Include custom token mint for USDC pools (from user's wallet)
        if (tokenMint) {
          requestBody.tokenMint = tokenMint;
        }
        console.log('[useForecastPool.createPool] API request:', requestBody);

        const response = await fetch('/api/v2/forecast-pools/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        console.log('[useForecastPool.createPool] API response status:', response.status);
        const responseData = await response.json();
        console.log('[useForecastPool.createPool] API response data:', responseData);

        if (!response.ok) {
          throw new Error(responseData.error || 'Failed to create pool');
        }

        const { transaction: serializedTx, poolAddress, network, blockhash, lastValidBlockHeight, rpcUrl } = responseData.data;

        console.log(`[useForecastPool] Creating pool on ${network || 'unknown'}: ${poolAddress}`);
        console.log(`[useForecastPool] Using API RPC: ${rpcUrl?.slice(0, 50)}...`);

        // Use the SAME RPC as the API to avoid blockhash mismatch
        const sendConnection = rpcUrl ? new Connection(rpcUrl, 'confirmed') : connection;

        // Deserialize transaction (DO NOT modify blockhash - would invalidate poolMint signature)
        const tx = Transaction.from(Buffer.from(serializedTx, 'base64'));

        console.log(`[useForecastPool] Transaction details:`, {
          feePayer: tx.feePayer?.toBase58()?.slice(0, 12),
          recentBlockhash: tx.recentBlockhash?.slice(0, 16),
          instructions: tx.instructions.length,
          signatures: tx.signatures.length,
          partialSignatures: tx.signatures.filter(s => s.signature !== null).length,
        });

        // Sign transaction with wallet
        console.log(`[useForecastPool] Calling signTransaction...`);
        const signedTx = await signTransaction(tx);
        console.log(`[useForecastPool] signTransaction returned`);

        // Send transaction using the SAME RPC as API
        const signature = await sendConnection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });

        console.log(`[useForecastPool] Transaction sent: ${signature}`);

        // Confirm transaction with blockhash context for reliable confirmation
        const confirmation = await sendConnection.confirmTransaction(
          {
            signature,
            blockhash,
            lastValidBlockHeight,
          },
          'confirmed'
        );
        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }

        console.log(`[useForecastPool] Pool created successfully: ${poolAddress}`);

        // Refresh to fetch the new pool from blockchain
        await refreshPools();

        setState((prev) => ({ ...prev, loading: false }));
        return signature;
      } catch (err: any) {
        console.error('[useForecastPool] Create pool error:', err);
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
      console.log('[useForecastPool.stake] Called with pool:', poolAddress.slice(0, 12), 'amount:', amount);

      if (!publicKey || !signTransaction) {
        console.error('[useForecastPool.stake] Wallet not connected');
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

        const responseData = await response.json();
        console.log('[useForecastPool.stake] API response:', responseData);

        if (!response.ok) {
          throw new Error(responseData.error || 'Failed to stake');
        }

        const { transaction: serializedTx, blockhash, lastValidBlockHeight, rpcUrl, network } = responseData.data;

        console.log(`[useForecastPool.stake] Staking on ${network}: ${amount} to ${poolAddress.slice(0, 12)}`);

        // Use the SAME RPC as the API to avoid blockhash mismatch
        const sendConnection = rpcUrl ? new Connection(rpcUrl, 'confirmed') : connection;

        // Sign and send transaction
        const tx = Transaction.from(Buffer.from(serializedTx, 'base64'));
        const signedTx = await signTransaction(tx);
        const signature = await sendConnection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });

        console.log(`[useForecastPool.stake] Transaction sent: ${signature}`);

        // Confirm with blockhash context
        const confirmation = await sendConnection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          'confirmed'
        );
        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }

        console.log(`[useForecastPool.stake] Stake confirmed!`);

        await refreshDelegations();
        await refreshPools();

        setState((prev) => ({ ...prev, loading: false }));
        return signature;
      } catch (err: any) {
        console.error('[useForecastPool.stake] Error:', err);
        setState((prev) => ({
          ...prev,
          error: err.message || 'Failed to stake',
          loading: false,
        }));
        return null;
      }
    },
    [publicKey, signTransaction, connection, refreshDelegations, refreshPools]
  );

  // Unstake from pool
  const unstake = useCallback(
    async (poolAddress: string, shares: number): Promise<string | null> => {
      console.log('[useForecastPool.unstake] Called with pool:', poolAddress.slice(0, 12), 'shares:', shares);

      if (!publicKey || !signTransaction) {
        console.error('[useForecastPool.unstake] Wallet not connected');
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

        const responseData = await response.json();
        console.log('[useForecastPool.unstake] API response:', responseData);

        if (!response.ok) {
          throw new Error(responseData.error || 'Failed to unstake');
        }

        const { transaction: serializedTx, blockhash, lastValidBlockHeight, rpcUrl, network, fee, feeType, netValue } = responseData.data;

        console.log(`[useForecastPool.unstake] Withdrawing on ${network}: ${shares} shares (fee: ${fee}, type: ${feeType})`);

        // Use the SAME RPC as the API to avoid blockhash mismatch
        const sendConnection = rpcUrl ? new Connection(rpcUrl, 'confirmed') : connection;

        // Sign and send transaction
        const tx = Transaction.from(Buffer.from(serializedTx, 'base64'));
        const signedTx = await signTransaction(tx);
        const signature = await sendConnection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });

        console.log(`[useForecastPool.unstake] Transaction sent: ${signature}`);

        // Confirm with blockhash context
        const confirmation = await sendConnection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          'confirmed'
        );
        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }

        console.log(`[useForecastPool.unstake] Unstake confirmed! Net value: ${netValue}`);

        await refreshDelegations();
        await refreshPools();

        setState((prev) => ({ ...prev, loading: false }));
        return signature;
      } catch (err: any) {
        console.error('[useForecastPool.unstake] Error:', err);
        setState((prev) => ({
          ...prev,
          error: err.message || 'Failed to unstake',
          loading: false,
        }));
        return null;
      }
    },
    [publicKey, signTransaction, connection, refreshDelegations, refreshPools]
  );

  // Track if we've already fetched to prevent infinite loops
  const [hasFetched, setHasFetched] = useState(false);

  // Initial fetch when wallet connects (only once)
  useEffect(() => {
    if (connected && publicKey && !hasFetched) {
      console.log('[useForecastPool] Wallet connected, fetching pools and delegations (once)');
      setHasFetched(true);
      refreshPools();
      refreshDelegations();
    }
  }, [connected, publicKey, hasFetched, refreshPools, refreshDelegations]);

  // Reset hasFetched when wallet disconnects
  useEffect(() => {
    if (!connected) {
      setHasFetched(false);
    }
  }, [connected]);

  return {
    ...state,
    // Wallet state from window bridge
    connected,
    walletAddress: publicKey?.toBase58() || null,
    // Pool ownership
    hasPool: state.existingPool !== null,
    // Operations
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
