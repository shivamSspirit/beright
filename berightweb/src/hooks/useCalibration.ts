'use client';

/**
 * useCalibration - Hook for interacting with the Calibration Program
 *
 * Provides functionality for:
 * - Recording predictions on-chain (auto-initializes forecaster)
 * - Viewing forecaster stats and Brier scores
 *
 * Program ID: GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ (devnet)
 */

import { useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets, useSignTransaction } from '@privy-io/react-auth/solana';
import { Transaction, Connection } from '@solana/web3.js';

const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';

// ============================================================================
// TYPES
// ============================================================================

export interface ForecasterStats {
  totalPredictions: number;
  resolvedPredictions: number;
  pendingPredictions: number;
  correctPredictions: number;
  accuracy: number;
  avgBrierScore: number;
  avgLogScore: number;
  marketsTraded: number;
  streakCorrect: number;
  maxStreakCorrect: number;
  bestCategory: number;
  worstCategory: number;
}

export interface CalibrationBucket {
  range: string;
  count: number;
  avgOutcome: number;
}

export interface ForecasterState {
  forecasterPda: string;
  isInitialized: boolean;
  authority: string;
  stats: ForecasterStats;
  calibrationBuckets: CalibrationBucket[];
  timestamps: {
    createdAt: number;
    createdAtISO: string;
    lastPredictionTs: number;
    lastPredictionISO: string | null;
  };
  version: number;
}

export interface RecordPredictionParams {
  marketId: string;
  predictedProbability: number;
  direction: 'yes' | 'no';
  category?: number;
}

// ============================================================================
// HOOK
// ============================================================================

export function useCalibration() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { signTransaction } = useSignTransaction();

  const [forecasterState, setForecasterState] = useState<ForecasterState | null>(null);
  const [loading, setLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Get connected Solana wallet (useWallets from solana module already filters to Solana wallets)
  const solanaWallet = wallets.length > 0 ? wallets[0] : null;
  const connected = authenticated && !!solanaWallet;
  const ownerPubkey = solanaWallet?.address || null;

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH FORECASTER STATE
  // ─────────────────────────────────────────────────────────────────────────────

  const fetchForecasterState = useCallback(async () => {
    if (!ownerPubkey) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v2/calibration?wallet=${ownerPubkey}`);
      const json = await res.json();

      if (json.success && json.data?.isInitialized) {
        setForecasterState(json.data);
        setIsInitialized(true);
      } else {
        // Not initialized yet
        setForecasterState(null);
        setIsInitialized(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch forecaster state');
      setForecasterState(null);
    } finally {
      setLoading(false);
    }
  }, [ownerPubkey]);

  // Fetch on mount and when wallet changes
  useEffect(() => {
    // Clear state immediately when wallet changes to prevent showing stale data
    setForecasterState(null);
    setIsInitialized(false);
    setLastTx(null);
    setError(null);

    if (connected && ownerPubkey) {
      fetchForecasterState();
    }
  }, [connected, ownerPubkey, fetchForecasterState]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RECORD PREDICTION (auto-initializes if needed - transparent to user)
  // ─────────────────────────────────────────────────────────────────────────────

  const recordPrediction = useCallback(
    async (params: RecordPredictionParams): Promise<string> => {
      if (!connected || !ownerPubkey) {
        throw new Error('Wallet not connected');
      }

      setTxLoading(true);
      setError(null);

      const connection = new Connection(SOLANA_RPC, 'confirmed');

      try {
        // Check if forecaster needs initialization first
        if (!isInitialized) {
          console.log('[Calibration] Auto-initializing forecaster account...');

          // Build initialize transaction
          const initRes = await fetch('/api/v2/calibration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'initialize',
              authority: ownerPubkey,
            }),
          });

          const initJson = await initRes.json();

          // Only proceed if not already initialized (409 is OK)
          if (!initJson.success && initJson.code !== 'ALREADY_INITIALIZED') {
            throw new Error(initJson.error || 'Failed to initialize forecaster');
          }

          if (initJson.success && solanaWallet) {
            const initTxBytes = Buffer.from(initJson.data.transaction, 'base64');
            const initTransaction = Transaction.from(initTxBytes);

            // Serialize for Privy signing
            const serializedInitTx = initTransaction.serialize({ requireAllSignatures: false });

            // Sign with Privy
            const { signedTransaction: signedInitTxBytes } = await signTransaction({
              transaction: serializedInitTx,
              wallet: solanaWallet,
            });

            // Send transaction
            const initSig = await connection.sendRawTransaction(signedInitTxBytes);
            await connection.confirmTransaction(initSig, 'confirmed');

            console.log('[Calibration] Forecaster initialized:', initSig);
            setIsInitialized(true);
          }
        }

        // Now build the record prediction transaction
        const res = await fetch('/api/v2/calibration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'record',
            authority: ownerPubkey,
            marketId: params.marketId,
            predictedProbability: params.predictedProbability,
            direction: params.direction,
            category: params.category || 0,
          }),
        });

        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || 'Failed to build transaction');
        }

        // Deserialize and sign
        const txBytes = Buffer.from(json.data.transaction, 'base64');
        const transaction = Transaction.from(txBytes);

        if (!solanaWallet) {
          throw new Error('Wallet not available');
        }

        // Serialize for Privy signing
        const serializedTx = transaction.serialize({ requireAllSignatures: false });

        // Sign with Privy
        const { signedTransaction: signedTxBytes } = await signTransaction({
          transaction: serializedTx,
          wallet: solanaWallet,
        });

        // Send transaction
        const signature = await connection.sendRawTransaction(signedTxBytes);
        await connection.confirmTransaction(signature, 'confirmed');

        setLastTx(signature);

        // Refresh state
        await fetchForecasterState();

        return signature;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Transaction failed';
        setError(message);
        throw err;
      } finally {
        setTxLoading(false);
      }
    },
    [connected, ownerPubkey, isInitialized, signTransaction, fetchForecasterState, solanaWallet]
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // COMPUTED VALUES
  // ─────────────────────────────────────────────────────────────────────────────

  const stats = forecasterState?.stats ?? null;
  const brierScore = stats?.avgBrierScore ?? null;
  const accuracy = stats?.accuracy ?? null;

  // Grade based on Brier score
  let grade = 'N/A';
  if (brierScore !== null && stats && stats.resolvedPredictions >= 10) {
    if (brierScore < 0.1) grade = 'S';
    else if (brierScore < 0.15) grade = 'A';
    else if (brierScore < 0.2) grade = 'B';
    else if (brierScore < 0.25) grade = 'C';
    else if (brierScore < 0.3) grade = 'D';
    else grade = 'F';
  }

  // Tier based on performance
  let tier: 'superforecaster' | 'elite' | 'verified' | 'rookie' | 'unranked' = 'unranked';
  if (stats) {
    if (stats.resolvedPredictions < 10) tier = 'unranked';
    else if (stats.resolvedPredictions < 20) tier = 'rookie';
    else if (brierScore !== null && brierScore < 0.12 && stats.resolvedPredictions >= 100)
      tier = 'superforecaster';
    else if (brierScore !== null && brierScore < 0.18 && stats.resolvedPredictions >= 50)
      tier = 'elite';
    else if (brierScore !== null && brierScore < 0.25 && stats.resolvedPredictions >= 20)
      tier = 'verified';
    else tier = 'rookie';
  }

  return {
    // State
    forecasterState,
    isInitialized,
    stats,
    brierScore,
    accuracy,
    grade,
    tier,
    calibrationBuckets: forecasterState?.calibrationBuckets ?? [],

    // Loading
    loading,
    txLoading,
    error,
    lastTx,

    // Connection
    connected,
    ownerPubkey,

    // Actions (initialize is automatic on first prediction)
    recordPrediction,
    refreshState: fetchForecasterState,
  };
}

export default useCalibration;
