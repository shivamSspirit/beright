'use client';

/**
 * usePredictionRecorder - Hook to record predictions to on-chain calibration program
 *
 * Every prediction on the platform is recorded on-chain (devnet) to track forecaster accuracy.
 * Returns transaction signature for display in profile.
 *
 * Uses window globals set by both DemoWalletProvider and PrivyProvider for unified access.
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

// Window globals type for wallet state (set by both DemoWalletProvider and PrivyProvider)
interface WalletState {
  connected: boolean;
  publicKey: string | null;
}

interface WalletFuncs {
  signTransaction?: (tx: Transaction | VersionedTransaction | Uint8Array) => Promise<Transaction | VersionedTransaction | Uint8Array>;
  rawSignTransaction?: unknown;
}

export function usePredictionRecorder() {
  const { isDemo } = useMode();

  // Try to use wallet adapter (works in both modes as a fallback)
  let walletAdapterPublicKey = null;
  let walletSignTransaction = null;
  let walletAdapterConnected = false;

  try {
    const wallet = useWallet();
    walletAdapterPublicKey = wallet.publicKey;
    walletSignTransaction = wallet.signTransaction;
    walletAdapterConnected = wallet.connected;
  } catch {
    // Wallet adapter not available (might be outside provider)
    console.log('[Calibration] Wallet adapter not available, using window globals');
  }

  // State from window globals (works for both Demo and Privy)
  const [windowWalletState, setWindowWalletState] = useState<WalletState>({
    connected: false,
    publicKey: null,
  });

  // Poll for wallet state from window globals (both providers set this)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkWallet = () => {
      const walletState = (window as Window & { __BERIGHT_WALLET__?: WalletState }).__BERIGHT_WALLET__;
      if (walletState) {
        setWindowWalletState({
          connected: walletState.connected,
          publicKey: walletState.publicKey,
        });
      }
    };

    // Check immediately
    checkWallet();

    // Poll every 500ms
    const interval = setInterval(checkWallet, 500);
    return () => clearInterval(interval);
  }, []);

  // UNIFIED: Use window globals as primary source (both providers set these)
  // This works for BOTH Demo (Jupiter) and Production (Privy) modes
  const connected = windowWalletState.connected || (walletAdapterConnected && !!walletAdapterPublicKey);
  const ownerPubkey = windowWalletState.publicKey || walletAdapterPublicKey?.toBase58() || null;

  /**
   * Get the signTransaction function - UNIFIED for both Demo and Production
   * Both DemoWalletProvider and PrivyProvider set window.__BERIGHT_WALLET_FUNCS__
   */
  const getSignTransaction = useCallback((): ((tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>) | null => {
    const provider = typeof window !== 'undefined' ? (window as Window & { __BERIGHT_PROVIDER__?: string }).__BERIGHT_PROVIDER__ : 'unknown';

    console.log('[Calibration] getSignTransaction - checking sources:', {
      isDemo,
      provider,
      hasWalletAdapter: !!walletSignTransaction,
      hasWindowGlobal: !!(typeof window !== 'undefined' && (window as Window & { __BERIGHT_WALLET_FUNCS__?: WalletFuncs }).__BERIGHT_WALLET_FUNCS__?.signTransaction),
    });

    // PRIMARY: Use window globals (both providers set this)
    if (typeof window !== 'undefined') {
      const walletFuncs = (window as Window & { __BERIGHT_WALLET_FUNCS__?: WalletFuncs }).__BERIGHT_WALLET_FUNCS__;

      if (walletFuncs?.signTransaction) {
        console.log(`[Calibration] ✓ Using window global signTransaction (${provider} provider)`);

        // The signTransaction function signature differs between providers:
        // - Jupiter/Demo: (tx: Transaction) => Promise<Transaction>
        // - Privy: (tx: Uint8Array) => Promise<Uint8Array>
        // We detect and handle both

        return async (tx: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction> => {
          try {
            // Try direct call first (Jupiter wallet adapter style)
            const result = await walletFuncs.signTransaction!(tx);

            // If result is a Transaction/VersionedTransaction, return directly
            if (result instanceof Transaction || result instanceof VersionedTransaction) {
              console.log('[Calibration] ✓ Direct Transaction signing succeeded');
              return result;
            }

            // If result is Uint8Array (Privy style), deserialize
            if (result instanceof Uint8Array) {
              console.log('[Calibration] ✓ Uint8Array signing succeeded, deserializing');
              if (tx instanceof Transaction) {
                return Transaction.from(result);
              } else {
                return VersionedTransaction.deserialize(result);
              }
            }

            // Unknown result type - try to use as-is
            console.log('[Calibration] Unknown result type, attempting to use as-is');
            return result as Transaction | VersionedTransaction;
          } catch (err) {
            // If direct call fails, try serializing first (for Privy)
            console.log('[Calibration] Direct signing failed, trying serialized approach');
            const serialized = tx.serialize({ requireAllSignatures: false });
            const signedBytes = await walletFuncs.signTransaction!(serialized as unknown as Transaction);

            if (signedBytes instanceof Uint8Array) {
              if (tx instanceof Transaction) {
                return Transaction.from(signedBytes);
              } else {
                return VersionedTransaction.deserialize(signedBytes);
              }
            }

            throw err;
          }
        };
      }
    }

    // FALLBACK: Try wallet adapter directly
    if (walletSignTransaction) {
      console.log('[Calibration] ✓ Using wallet adapter signTransaction (direct fallback)');
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

      const provider = typeof window !== 'undefined' ? (window as Window & { __BERIGHT_PROVIDER__?: string }).__BERIGHT_PROVIDER__ : 'unknown';

      console.log('═══════════════════════════════════════════════════');
      console.log('[Calibration] 🚀 recordPrediction called' + (retryCount > 0 ? ` (retry ${retryCount})` : ''));
      console.log('[Calibration] Params:', params);
      console.log('[Calibration] Wallet state:', {
        isDemo,
        provider,
        connected,
        ownerPubkey: ownerPubkey?.slice(0, 8) || 'none',
        windowWalletConnected: windowWalletState.connected,
        windowWalletPubkey: windowWalletState.publicKey?.slice(0, 8) || 'none',
        walletAdapterConnected,
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
    [connected, ownerPubkey, isDemo, getSignTransaction, walletAdapterConnected, windowWalletState]
  );

  return {
    recordPrediction,
    connected,
    ownerPubkey,
  };
}

export default usePredictionRecorder;
