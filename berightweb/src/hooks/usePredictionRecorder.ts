'use client';

/**
 * usePredictionRecorder - Hook to record predictions to on-chain calibration program
 *
 * Every prediction on the platform is recorded on-chain (devnet) to track forecaster accuracy.
 * Returns transaction signature for display in profile.
 *
 * Works in both demo mode (Jupiter wallet adapter) and production mode (Privy).
 */

import { useCallback, useState, useEffect } from 'react';
import { Transaction, Connection, VersionedTransaction } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { useMode } from '@/context/ModeContext';

// Always use devnet for calibration recording
const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com';

interface RecordParams {
  marketId: string;
  direction: 'yes' | 'no';
  probability: number; // 0.0 - 1.0
  category?: number;
}

// Window globals type for Privy wallet state
interface PrivyWalletState {
  connected: boolean;
  publicKey: string | null;
}

interface PrivyWalletFuncs {
  signTransaction?: (tx: Uint8Array) => Promise<Uint8Array>;
  rawSignTransaction?: unknown;
}

export function usePredictionRecorder() {
  const { isDemo } = useMode();

  // Use wallet adapter directly for demo mode
  const wallet = useWallet();
  const { publicKey: walletAdapterPublicKey, signTransaction: walletSignTransaction, connected: walletAdapterConnected } = wallet;

  // State for Privy wallet (production mode)
  const [privyWalletState, setPrivyWalletState] = useState<PrivyWalletState>({
    connected: false,
    publicKey: null,
  });

  // Poll for Privy wallet state from window globals
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkPrivyWallet = () => {
      const walletState = (window as Window & { __BERIGHT_WALLET__?: PrivyWalletState }).__BERIGHT_WALLET__;
      if (walletState) {
        setPrivyWalletState({
          connected: walletState.connected,
          publicKey: walletState.publicKey,
        });
      }
    };

    // Check immediately
    checkPrivyWallet();

    // Poll every 500ms (Privy sets this on login)
    const interval = setInterval(checkPrivyWallet, 500);
    return () => clearInterval(interval);
  }, []);

  // Determine connected state based on mode
  const connected = isDemo
    ? walletAdapterConnected && !!walletAdapterPublicKey
    : privyWalletState.connected && !!privyWalletState.publicKey;

  const ownerPubkey = isDemo
    ? walletAdapterPublicKey?.toBase58() || null
    : privyWalletState.publicKey;

  /**
   * Get the signTransaction function - from wallet adapter (demo) or Privy globals (production)
   */
  const getSignTransaction = useCallback((): ((tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>) | null => {
    console.log('[Calibration] getSignTransaction - checking sources:', {
      isDemo,
      hasWalletAdapter: !!walletSignTransaction,
      hasPrivyGlobal: !!(typeof window !== 'undefined' && (window as Window & { __BERIGHT_WALLET_FUNCS__?: PrivyWalletFuncs }).__BERIGHT_WALLET_FUNCS__?.signTransaction),
    });

    // Demo mode: Use wallet adapter signTransaction
    if (isDemo && walletSignTransaction) {
      console.log('[Calibration] ✓ Using wallet adapter signTransaction (demo mode)');
      return walletSignTransaction;
    }

    // Production mode: Use Privy's signTransaction from window globals
    if (typeof window !== 'undefined') {
      const walletFuncs = (window as Window & { __BERIGHT_WALLET_FUNCS__?: PrivyWalletFuncs }).__BERIGHT_WALLET_FUNCS__;

      if (walletFuncs?.signTransaction) {
        console.log('[Calibration] ✓ Using Privy signTransaction (production mode)');

        // Wrap Privy's signTransaction to match expected interface
        // Privy expects Uint8Array and returns Uint8Array
        return async (tx: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction> => {
          const serialized = tx.serialize({ requireAllSignatures: false });
          const signedBytes = await walletFuncs.signTransaction!(serialized);

          // Return signed transaction
          if (tx instanceof Transaction) {
            return Transaction.from(signedBytes);
          } else {
            return VersionedTransaction.deserialize(signedBytes);
          }
        };
      }
    }

    // Fallback: Try wallet adapter even in production (some wallets inject it)
    if (walletSignTransaction) {
      console.log('[Calibration] ✓ Using wallet adapter signTransaction (fallback)');
      return walletSignTransaction;
    }

    console.log('[Calibration] ✗ No signTransaction function available');
    return null;
  }, [isDemo, walletSignTransaction]);

  /**
   * Record a prediction to the on-chain calibration program
   * Returns the transaction signature on success, null on failure
   */
  const recordPrediction = useCallback(
    async (params: RecordParams, retryCount = 0): Promise<string | null> => {
      const MAX_RETRIES = 3;
      if (retryCount >= MAX_RETRIES) {
        console.error('[Calibration] ❌ Max retries reached, giving up');
        return null;
      }

      console.log('═══════════════════════════════════════════════════');
      console.log('[Calibration] 🚀 recordPrediction called' + (retryCount > 0 ? ` (retry ${retryCount})` : ''));
      console.log('[Calibration] Params:', params);
      console.log('[Calibration] Wallet state:', {
        isDemo,
        connected,
        ownerPubkey,
        walletAdapterConnected,
        privyConnected: privyWalletState.connected,
        privyPubkey: privyWalletState.publicKey?.slice(0, 8) || 'none',
      });

      if (!connected || !ownerPubkey) {
        console.error('[Calibration] ❌ ABORT: Wallet not connected');
        console.error('[Calibration] Mode:', isDemo ? 'demo' : 'production');
        console.error('[Calibration] connected:', connected, 'ownerPubkey:', ownerPubkey);
        return null;
      }

      const signTransaction = getSignTransaction();
      if (!signTransaction) {
        console.error('[Calibration] ❌ ABORT: No signTransaction function available');
        console.error('[Calibration] Mode:', isDemo ? 'demo' : 'production');
        return null;
      }

      console.log('[Calibration] ✓ signTransaction function available');

      // Validate params before calling API
      if (!params.marketId || typeof params.marketId !== 'string' || params.marketId.trim() === '') {
        console.error('[Calibration] ❌ ABORT: Invalid marketId:', params.marketId);
        return null;
      }
      if (typeof params.probability !== 'number' || isNaN(params.probability) || params.probability < 0 || params.probability > 1) {
        console.error('[Calibration] ❌ ABORT: Invalid probability:', params.probability);
        return null;
      }
      if (params.direction !== 'yes' && params.direction !== 'no') {
        console.error('[Calibration] ❌ ABORT: Invalid direction:', params.direction);
        return null;
      }

      const connection = new Connection(SOLANA_RPC, 'confirmed');
      console.log('[Calibration] Using RPC:', SOLANA_RPC);

      try {
        console.log('[Calibration] 📝 Step 1: Calling record API...');

        // skipInitCheck on retries to bypass stale RPC cache
        const res = await fetch('/api/v2/calibration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'record',
            authority: ownerPubkey,
            marketId: params.marketId,
            predictedProbability: params.probability,
            direction: params.direction,
            category: params.category || 0,
            skipInitCheck: retryCount > 0, // Skip check on retries after init
          }),
        });

        const json = await res.json();
        console.log('[Calibration] Record API response:', json);

        if (!json.success) {
          // If forecaster not initialized, initialize first then retry
          if (json.code === 'NOT_INITIALIZED') {
            console.log('[Calibration] 📝 Step 2: Forecaster not initialized, initializing...');

            const initRes = await fetch('/api/v2/calibration', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'initialize',
                authority: ownerPubkey,
              }),
            });

            const initJson = await initRes.json();
            console.log('[Calibration] Initialize API response:', initJson);

            if (initJson.success) {
              console.log('[Calibration] 📝 Step 3: Building init transaction...');
              const initTxBytes = Buffer.from(initJson.data.transaction, 'base64');
              const initTransaction = Transaction.from(initTxBytes);

              // CRITICAL FIX: Get fresh blockhash to avoid "Blockhash not found" error
              console.log('[Calibration] Getting fresh blockhash...');
              const { blockhash: freshBlockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
              initTransaction.recentBlockhash = freshBlockhash;
              console.log('[Calibration] Init transaction built with fresh blockhash:', freshBlockhash);

              console.log('[Calibration] 🔐 Step 4: Requesting wallet signature for init...');
              console.log('[Calibration] (Wallet popup should appear now)');
              const signedInitTx = await signTransaction(initTransaction);
              console.log('[Calibration] ✓ Init transaction signed');

              try {
                console.log('[Calibration] 📤 Step 5: Submitting init transaction to devnet...');
                const signedInitTxSerialized = (signedInitTx as Transaction).serialize();
                const initSig = await connection.sendRawTransaction(signedInitTxSerialized, {
                  skipPreflight: false,
                  preflightCommitment: 'confirmed',
                });
                console.log('[Calibration] Init transaction submitted:', initSig);

                console.log('[Calibration] ⏳ Step 6: Waiting for init confirmation...');
                await connection.confirmTransaction({
                  signature: initSig,
                  blockhash: freshBlockhash,
                  lastValidBlockHeight,
                }, 'confirmed');
                console.log('[Calibration] ✅ Forecaster initialized! Signature:', initSig);
                console.log('[Calibration] Explorer: https://explorer.solana.com/tx/' + initSig + '?cluster=devnet');
              } catch (initErr) {
                // Handle "account already in use" error - forecaster exists but RPC cache was stale
                const errMsg = initErr instanceof Error ? initErr.message : String(initErr);
                if (errMsg.includes('already in use') || errMsg.includes('0x0')) {
                  console.log('[Calibration] ✓ Forecaster already exists (RPC cache was stale)');
                } else {
                  // Re-throw other errors
                  throw initErr;
                }
              }

              // Wait for RPC to propagate
              console.log('[Calibration] ⏳ Waiting 2s for RPC propagation...');
              await new Promise(resolve => setTimeout(resolve, 2000));

              // Now retry recording
              console.log('[Calibration] 🔄 Retrying record after init...');
              return recordPrediction(params, retryCount + 1);
            } else if (initJson.code === 'ALREADY_INITIALIZED') {
              console.log('[Calibration] Forecaster already initialized, waiting for RPC sync...');
              await new Promise(resolve => setTimeout(resolve, 1500));
              return recordPrediction(params, retryCount + 1);
            } else {
              console.error('[Calibration] ❌ Init failed:', initJson.error);
              return null;
            }
          }
          console.error('[Calibration] ❌ Failed to build record tx:', json.error);
          return null;
        }

        console.log('[Calibration] 📝 Building record transaction...');
        const txBytes = Buffer.from(json.data.transaction, 'base64');
        const transaction = Transaction.from(txBytes);
        console.log('[Calibration] Prediction PDA:', json.data.predictionPda);

        // CRITICAL FIX: Get fresh blockhash to avoid "Blockhash not found" error
        console.log('[Calibration] Getting fresh blockhash for record tx...');
        const { blockhash: freshBlockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = freshBlockhash;
        console.log('[Calibration] Record transaction built with fresh blockhash:', freshBlockhash);

        console.log('[Calibration] 🔐 Requesting wallet signature for record...');
        console.log('[Calibration] (Wallet popup should appear now)');
        const signedTx = await signTransaction(transaction);
        console.log('[Calibration] ✓ Record transaction signed');

        console.log('[Calibration] 📤 Submitting record transaction to devnet...');
        const signedTxSerialized = (signedTx as Transaction).serialize();
        const signature = await connection.sendRawTransaction(signedTxSerialized, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });
        console.log('[Calibration] Transaction submitted:', signature);

        console.log('[Calibration] ⏳ Waiting for confirmation...');
        await connection.confirmTransaction({
          signature,
          blockhash: freshBlockhash,
          lastValidBlockHeight,
        }, 'confirmed');
        console.log('[Calibration] ═══════════════════════════════════════════════════');
        console.log('[Calibration] ✅ PREDICTION RECORDED ON-CHAIN!');
        console.log('[Calibration] Signature:', signature);
        console.log('[Calibration] Solana Explorer: https://explorer.solana.com/tx/' + signature + '?cluster=devnet');
        console.log('[Calibration] Solscan: https://solscan.io/tx/' + signature + '?cluster=devnet');
        console.log('[Calibration] ═══════════════════════════════════════════════════');

        return signature;
      } catch (err) {
        console.error('[Calibration] ═══════════════════════════════════════════════════');
        console.error('[Calibration] ❌ ERROR recording prediction');
        console.error('[Calibration] Error:', err);
        if (err instanceof Error) {
          console.error('[Calibration] Error message:', err.message);
          console.error('[Calibration] Error stack:', err.stack);
        }
        console.error('[Calibration] ═══════════════════════════════════════════════════');
        return null;
      }
    },
    [connected, ownerPubkey, isDemo, getSignTransaction, walletAdapterConnected, privyWalletState]
  );

  return {
    recordPrediction,
    connected,
    ownerPubkey,
  };
}

export default usePredictionRecorder;
