'use client';

/**
 * useConvictionEscrow - React hook for BeRight conviction escrow operations
 *
 * Handles creating conviction markets, staking SOL, resolving outcomes,
 * and claiming funds from the on-chain escrow program.
 *
 * Usage:
 *   const { createMarket, stake, escrowState, loading } = useConvictionEscrow();
 */

import { useState, useEffect, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useSignTransaction } from '@privy-io/react-auth/solana';
import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
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
// HOOK
// ============================================================================

export function useConvictionEscrow(projectWallet?: string) {
  const { ready, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { signTransaction } = useSignTransaction();

  const [escrowState, setEscrowState] = useState<EscrowState | null>(null);
  const [pdas, setPdas] = useState<EscrowPdas | null>(null);
  const [loading, setLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  // Pick the active Solana wallet (prefer external over embedded)
  const wallet = wallets.find((w) => w.walletClientType !== 'privy') ?? wallets[0];
  const ownerPubkey = wallet?.address || null;

  // Use provided projectWallet or connected wallet
  const targetWallet = projectWallet || ownerPubkey;

  // Connection for sending transactions
  const connection = new Connection(SOLANA_RPC, 'confirmed');

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
    if (ready && walletsReady && targetWallet) {
      fetchState();
    }
  }, [ready, walletsReady, targetWallet, fetchState]);

  // ─────────────────────────────────────────────────────────────────────────────
  // SIGN AND SEND TRANSACTION
  // ─────────────────────────────────────────────────────────────────────────────

  const signAndSendTx = async (serializedTx: string): Promise<string> => {
    // Deserialize transaction
    const txBuffer = Buffer.from(serializedTx, 'base64');
    const tx = Transaction.from(txBuffer);

    // Sign with Privy - serialize for their API
    const serialized = tx.serialize({ requireAllSignatures: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const signedTx = await signTransaction(serialized as any);

    // Send transaction
    const signature = await connection.sendRawTransaction(
      (signedTx as unknown as Transaction).serialize()
    );

    // Confirm transaction
    await connection.confirmTransaction(signature, 'confirmed');

    return signature;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // CREATE MARKET
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

        const { transaction, marketPda, vaultPda } = await buildCreateTx({
          projectWallet: ownerPubkey,
          resolver: params.resolver,
          stakePosition: params.stakePosition || 'yes',
          resolutionDate: resolutionTimestamp,
          stakeAmountSol: params.stakeAmountSol,
        });

        const signature = await signAndSendTx(transaction);
        setLastTx(signature);

        // Refresh state
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

  // ─────────────────────────────────────────────────────────────────────────────
  // STAKE
  // ─────────────────────────────────────────────────────────────────────────────

  const stake = useCallback(async (): Promise<string> => {
    if (!ownerPubkey) throw new Error('Wallet not connected');

    setTxLoading(true);
    setError(null);

    try {
      const { transaction } = await buildStakeTx(ownerPubkey);
      const signature = await signAndSendTx(transaction);
      setLastTx(signature);

      // Refresh state
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

  // ─────────────────────────────────────────────────────────────────────────────
  // RESOLVE
  // ─────────────────────────────────────────────────────────────────────────────

  const resolve = useCallback(
    async (outcome: 'yes' | 'no' | 'invalid'): Promise<string> => {
      if (!ownerPubkey || !targetWallet) throw new Error('Wallet not connected');

      setTxLoading(true);
      setError(null);

      try {
        const { transaction } = await buildResolveTx(targetWallet, ownerPubkey, outcome);
        const signature = await signAndSendTx(transaction);
        setLastTx(signature);

        // Refresh state
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

  // ─────────────────────────────────────────────────────────────────────────────
  // CLAIM
  // ─────────────────────────────────────────────────────────────────────────────

  const claim = useCallback(async (): Promise<string> => {
    if (!ownerPubkey || !targetWallet) throw new Error('Wallet not connected');

    setTxLoading(true);
    setError(null);

    try {
      const { transaction } = await buildClaimTx(targetWallet, ownerPubkey);
      const signature = await signAndSendTx(transaction);
      setLastTx(signature);

      // Refresh state
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

  return {
    // State
    escrowState,
    pdas,
    loading,
    txLoading,
    error,
    lastTx,
    ownerPubkey,
    connected: !!ownerPubkey && authenticated,

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
