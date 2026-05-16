'use client';

/**
 * useConvictionEscrow - React hook for BeRight conviction escrow operations
 *
 * Handles creating conviction markets, staking SOL, resolving outcomes,
 * and claiming funds from the on-chain escrow program.
 *
 * Supports both Demo mode (Jupiter wallet) and Production mode (Privy)
 * by reading wallet state from window (exposed by both providers).
 *
 * Usage:
 *   const { createMarket, stake, escrowState, loading } = useConvictionEscrow();
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useMode } from '@/context/ModeContext';
import {
  Connection,
  Transaction,
  VersionedTransaction,
  PublicKey,
} from '@solana/web3.js';

// ============================================================================
// CONSTANTS
// ============================================================================

// Conviction escrow runs on devnet - use devnet RPC
const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com';
const SOLANA_NETWORK = 'devnet'; // Conviction escrow is ALWAYS on devnet
const API_BASE = '';

// ============================================================================
// TYPES
// ============================================================================

export interface EscrowState {
  marketPda: string;
  vaultPda: string;
  projectWallet: string;
  resolver: string;
  stakeAmountSol: number;
  stakeAmountLamports: number;
  stakePosition: 'yes' | 'no';
  resolutionDate: number;
  resolutionDateISO: string;
  status: 'pending_stake' | 'active' | 'resolved' | 'claimed';
  outcome: 'none' | 'yes' | 'no' | 'invalid';
  createdAt: number;
  createdAtISO: string;
  vaultBalanceSol: number;
  vaultBalanceLamports: number;
}

export interface CreateMarketParams {
  resolver: string;
  stakePosition?: 'yes' | 'no';
  resolutionDate: Date | number;
  stakeAmountSol: number;
}

export interface EscrowPdas {
  marketPda: string;
  vaultPda: string;
  marketBump: number;
  vaultBump: number;
}

// Window state interface (exposed by both providers)
interface WalletState {
  connected: boolean;
  connecting: boolean;
  publicKey: string | null;
  walletName: string | null;
}

interface WalletFuncs {
  signTransaction?: (tx: Transaction | VersionedTransaction | Uint8Array) => Promise<Transaction | VersionedTransaction | Uint8Array>;
  disconnect?: () => Promise<void>;
}

// ============================================================================
// API HELPERS
// ============================================================================

async function fetchEscrowState(projectWallet: string): Promise<EscrowState | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v2/conviction/escrow?projectWallet=${projectWallet}`
    );
    const json = await res.json();

    if (!json.success) {
      if (json.code === 'MARKET_NOT_FOUND') return null;
      throw new Error(json.error || 'Failed to fetch escrow state');
    }

    const { market, pdas, vaultBalanceSol, vaultBalanceLamports } = json.data;
    return {
      marketPda: pdas?.marketPda || '',
      vaultPda: pdas?.vaultPda || '',
      projectWallet: market.projectWallet,
      resolver: market.resolver,
      stakeAmountSol: market.stakeAmount,
      stakeAmountLamports: parseInt(market.stakeAmountLamports),
      stakePosition: market.stakePosition,
      resolutionDate: market.resolutionDate,
      resolutionDateISO: market.resolutionDateISO,
      status: market.status,
      outcome: market.outcome,
      createdAt: market.createdAt,
      createdAtISO: market.createdAtISO,
      vaultBalanceSol,
      vaultBalanceLamports,
    };
  } catch (error) {
    console.error('[useConvictionEscrow] fetchEscrowState error:', error);
    return null;
  }
}

async function derivePdas(projectWallet: string): Promise<EscrowPdas> {
  const res = await fetch(`${API_BASE}/api/v2/conviction/escrow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'derive-pdas',
      projectWallet,
    }),
  });
  const json = await res.json();

  if (!json.success) {
    throw new Error(json.error || 'Failed to derive PDAs');
  }

  return json.data;
}

async function buildCreateTx(params: {
  projectWallet: string;
  resolver: string;
  stakePosition: 'yes' | 'no';
  resolutionDate: number;
  stakeAmountSol: number;
}): Promise<{ transaction: string; marketPda: string; vaultPda: string }> {
  const res = await fetch(`${API_BASE}/api/v2/conviction/escrow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create',
      ...params,
    }),
  });
  const json = await res.json();

  if (!json.success) {
    throw new Error(json.error || 'Failed to build create transaction');
  }

  return json.data;
}

async function buildStakeTx(projectWallet: string): Promise<{ transaction: string }> {
  const res = await fetch(`${API_BASE}/api/v2/conviction/escrow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'stake',
      projectWallet,
    }),
  });
  const json = await res.json();

  if (!json.success) {
    throw new Error(json.error || 'Failed to build stake transaction');
  }

  return json.data;
}

async function buildResolveTx(
  projectWallet: string,
  resolver: string,
  outcome: 'yes' | 'no' | 'invalid'
): Promise<{ transaction: string }> {
  const res = await fetch(`${API_BASE}/api/v2/conviction/escrow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'resolve',
      projectWallet,
      resolver,
      outcome,
    }),
  });
  const json = await res.json();

  if (!json.success) {
    throw new Error(json.error || 'Failed to build resolve transaction');
  }

  return json.data;
}

async function buildClaimTx(
  projectWallet: string,
  claimer: string
): Promise<{ transaction: string }> {
  const res = await fetch(`${API_BASE}/api/v2/conviction/escrow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'claim',
      projectWallet,
      claimer,
    }),
  });
  const json = await res.json();

  if (!json.success) {
    throw new Error(json.error || 'Failed to build claim transaction');
  }

  return json.data;
}

// ============================================================================
// WINDOW STATE HELPERS
// ============================================================================

function getWalletState(): WalletState {
  if (typeof window === 'undefined') {
    return { connected: false, connecting: false, publicKey: null, walletName: null };
  }
  const state = (window as Window & { __BERIGHT_WALLET__?: WalletState }).__BERIGHT_WALLET__;
  return state || { connected: false, connecting: false, publicKey: null, walletName: null };
}

function getWalletFuncs(): WalletFuncs {
  if (typeof window === 'undefined') {
    return {};
  }
  return (window as Window & { __BERIGHT_WALLET_FUNCS__?: WalletFuncs }).__BERIGHT_WALLET_FUNCS__ || {};
}

function getProvider(): 'jupiter' | 'privy' | null {
  if (typeof window === 'undefined') return null;
  return (window as Window & { __BERIGHT_PROVIDER__?: string }).__BERIGHT_PROVIDER__ as 'jupiter' | 'privy' | null;
}

// ============================================================================
// HOOK
// ============================================================================

export function useConvictionEscrow(projectWallet?: string) {
  const { isDemo } = useMode();

  // Read wallet state from window (updated by provider bridges)
  const [walletState, setWalletState] = useState<WalletState>({
    connected: false,
    connecting: true,
    publicKey: null,
    walletName: null,
  });

  const [escrowState, setEscrowState] = useState<EscrowState | null>(null);
  const [pdas, setPdas] = useState<EscrowPdas | null>(null);
  const [loading, setLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  // Subscribe to wallet state changes from window
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkWalletState = () => {
      const state = getWalletState();
      setWalletState(prev => {
        // Only update if something changed to avoid unnecessary re-renders
        if (
          prev.connected !== state.connected ||
          prev.connecting !== state.connecting ||
          prev.publicKey !== state.publicKey ||
          prev.walletName !== state.walletName
        ) {
          return state;
        }
        return prev;
      });
    };

    // Check immediately
    checkWalletState();

    // Poll for changes (providers update window state)
    const interval = setInterval(checkWalletState, 300);

    return () => clearInterval(interval);
  }, []);

  const ownerPubkey = walletState.publicKey;
  const targetWallet = projectWallet || ownerPubkey;
  const connection = useMemo(() => new Connection(SOLANA_RPC, 'confirmed'), []);
  const provider = getProvider();

  // Debug: Log wallet state
  useEffect(() => {
    console.log('[useConvictionEscrow] Wallet state:', {
      mode: isDemo ? 'demo' : 'production',
      provider,
      connected: walletState.connected,
      connecting: walletState.connecting,
      publicKey: ownerPubkey?.slice(0, 8) || 'none',
      walletName: walletState.walletName || 'none',
      rpc: SOLANA_RPC,
    });
  }, [isDemo, provider, walletState, ownerPubkey]);

  // Debug: Expose to window
  useEffect(() => {
    if (typeof window === 'undefined') return;

    (window as Window & { __BERIGHT_ESCROW__?: unknown }).__BERIGHT_ESCROW__ = {
      mode: isDemo ? 'demo' : 'production',
      provider,
      connected: walletState.connected,
      ownerPubkey: ownerPubkey?.slice(0, 8) || 'none',
      hasMarket: escrowState !== null,
      escrowStatus: escrowState?.status || 'none',
    };
  }, [isDemo, provider, walletState, ownerPubkey, escrowState]);

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH STATE
  // ─────────────────────────────────────────────────────────────────────────────

  const fetchState = useCallback(async () => {
    if (!targetWallet) return;

    setLoading(true);
    setError(null);

    try {
      const [state, derivedPdas] = await Promise.all([
        fetchEscrowState(targetWallet),
        derivePdas(targetWallet),
      ]);

      setEscrowState(state);
      setPdas(derivedPdas);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [targetWallet]);

  // Auto-fetch on mount and wallet change
  useEffect(() => {
    if (walletState.connected && targetWallet) {
      fetchState();
    }
  }, [walletState.connected, targetWallet, fetchState]);

  // ─────────────────────────────────────────────────────────────────────────────
  // SIGN AND SEND TRANSACTION
  // ─────────────────────────────────────────────────────────────────────────────

  const signAndSendTx = useCallback(async (serializedTx: string): Promise<string> => {
    const txBuffer = Buffer.from(serializedTx, 'base64');
    const funcs = getWalletFuncs();
    const currentProvider = getProvider();

    console.log('[useConvictionEscrow] Signing - publicKey:', ownerPubkey,
      'connected:', walletState.connected,
      'provider:', currentProvider,
      'hasSignTransaction:', !!funcs.signTransaction);

    if (!walletState.connected || !ownerPubkey) {
      throw new Error('Wallet not connected. Please connect your wallet first.');
    }

    if (!funcs.signTransaction) {
      throw new Error('signTransaction function not available. Please reconnect your wallet.');
    }

    // Try to deserialize as VersionedTransaction first, fall back to legacy Transaction
    let transaction: Transaction | VersionedTransaction;
    try {
      transaction = VersionedTransaction.deserialize(txBuffer);
    } catch {
      transaction = Transaction.from(txBuffer);
    }

    // IMPORTANT: Log network info for debugging
    console.log(`[useConvictionEscrow] 🔐 Signing transaction:`, {
      network: SOLANA_NETWORK,
      rpc: SOLANA_RPC.substring(0, 40),
      provider: currentProvider,
      txType: transaction instanceof VersionedTransaction ? 'VersionedTransaction' : 'Transaction',
    });

    // CRITICAL: Warn if mode/network mismatch detected
    const currentMode = (window as Window & { __BERIGHT_MODE__?: string }).__BERIGHT_MODE__;
    if (currentMode === 'production' && SOLANA_NETWORK === 'devnet') {
      console.warn(
        '⚠️  NETWORK MISMATCH: Running in production mode but conviction escrow uses devnet. ' +
        'This is expected - conviction escrow is deployed on devnet only.'
      );
    }

    // Sign using the provider's signTransaction function
    console.log(`[useConvictionEscrow] Using ${currentProvider} signTransaction`);

    let signedTx: Transaction | VersionedTransaction;

    if (currentProvider === 'jupiter') {
      // Jupiter wallet adapter returns the signed transaction directly
      signedTx = await funcs.signTransaction(transaction) as Transaction | VersionedTransaction;
    } else {
      // Privy returns Uint8Array from window bridge
      const serialized = transaction.serialize();
      const signedBytes = await funcs.signTransaction(serialized) as Uint8Array;

      // Deserialize the signed transaction
      try {
        signedTx = VersionedTransaction.deserialize(signedBytes);
      } catch {
        signedTx = Transaction.from(signedBytes);
      }
    }

    // Send transaction
    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    // Confirm transaction
    await connection.confirmTransaction(signature, 'confirmed');

    return signature;
  }, [walletState, ownerPubkey, connection]);

  // ─────────────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  const createMarket = useCallback(
    async (params: CreateMarketParams): Promise<string> => {
      if (!ownerPubkey) throw new Error('Wallet not connected');

      setTxLoading(true);
      setError(null);

      try {
        const resolutionTimestamp =
          typeof params.resolutionDate === 'number'
            ? params.resolutionDate
            : Math.floor(params.resolutionDate.getTime() / 1000);

        const { transaction } = await buildCreateTx({
          projectWallet: ownerPubkey,
          resolver: params.resolver,
          stakePosition: params.stakePosition || 'yes',
          resolutionDate: resolutionTimestamp,
          stakeAmountSol: params.stakeAmountSol,
        });

        const signature = await signAndSendTx(transaction);
        setLastTx(signature);
        await fetchState();
        return signature;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        throw e;
      } finally {
        setTxLoading(false);
      }
    },
    [ownerPubkey, fetchState, signAndSendTx]
  );

  const stake = useCallback(async (): Promise<string> => {
    if (!ownerPubkey) throw new Error('Wallet not connected');

    setTxLoading(true);
    setError(null);

    try {
      const { transaction } = await buildStakeTx(ownerPubkey);
      const signature = await signAndSendTx(transaction);
      setLastTx(signature);
      await fetchState();
      return signature;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setTxLoading(false);
    }
  }, [ownerPubkey, fetchState, signAndSendTx]);

  const resolve = useCallback(
    async (outcome: 'yes' | 'no' | 'invalid'): Promise<string> => {
      if (!ownerPubkey || !targetWallet) throw new Error('Wallet not connected');

      setTxLoading(true);
      setError(null);

      try {
        const { transaction } = await buildResolveTx(targetWallet, ownerPubkey, outcome);
        const signature = await signAndSendTx(transaction);
        setLastTx(signature);
        await fetchState();
        return signature;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        throw e;
      } finally {
        setTxLoading(false);
      }
    },
    [ownerPubkey, targetWallet, fetchState, signAndSendTx]
  );

  const claim = useCallback(async (): Promise<string> => {
    if (!ownerPubkey || !targetWallet) throw new Error('Wallet not connected');

    setTxLoading(true);
    setError(null);

    try {
      const { transaction } = await buildClaimTx(targetWallet, ownerPubkey);
      const signature = await signAndSendTx(transaction);
      setLastTx(signature);
      await fetchState();
      return signature;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setTxLoading(false);
    }
  }, [ownerPubkey, targetWallet, fetchState, signAndSendTx]);

  // ─────────────────────────────────────────────────────────────────────────────
  // COMPUTED VALUES
  // ─────────────────────────────────────────────────────────────────────────────

  const hasMarket = escrowState !== null;
  const canStake = escrowState?.status === 'pending_stake';
  const canResolve =
    escrowState?.status === 'active' &&
    escrowState.resolutionDate <= Math.floor(Date.now() / 1000);
  const canClaim = escrowState?.status === 'resolved';

  const isProjectWinner =
    escrowState?.status === 'resolved' &&
    ((escrowState.stakePosition === 'yes' && escrowState.outcome === 'yes') ||
      (escrowState.stakePosition === 'no' && escrowState.outcome === 'no') ||
      escrowState.outcome === 'invalid');

  const canSign = walletState.connected && !!getWalletFuncs().signTransaction;

  return {
    // State
    escrowState,
    pdas,
    loading,
    txLoading,
    error,
    lastTx,
    ownerPubkey,
    connected: walletState.connected && !!ownerPubkey,
    canSign,
    walletsReady: !walletState.connecting,

    // Computed
    hasMarket,
    canStake,
    canResolve,
    canClaim,
    isProjectWinner,

    // Actions
    fetchState,
    createMarket,
    stake,
    resolve,
    claim,
  };
}

export default useConvictionEscrow;
