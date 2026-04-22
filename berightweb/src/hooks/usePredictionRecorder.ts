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
const DEVNET_AIRDROP_LAMPORTS = 50_000_000; // 0.05 SOL
const MIN_DEVNET_BALANCE_LAMPORTS = 10_000_000; // 0.01 SOL

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

  const ensureDevnetBalance = useCallback(async (connection: Connection, pubkeyBase58: string): Promise<void> => {
    // Only attempt airdrop on devnet RPC URLs
    if (!SOLANA_RPC.includes('devnet')) return;

    try {
      const { PublicKey } = await import('@solana/web3.js');
      const pubkey = new PublicKey(pubkeyBase58);
      const balance = await connection.getBalance(pubkey, 'confirmed');
      if (balance >= MIN_DEVNET_BALANCE_LAMPORTS) return;

      console.log('[Calibration] Low devnet SOL balance, requesting airdrop...', { balance });
      const sig = await connection.requestAirdrop(pubkey, DEVNET_AIRDROP_LAMPORTS);
      const latest = await connection.getLatestBlockhash('confirmed');
      await connection.confirmTransaction(
        { signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
        'confirmed'
      );
      console.log('[Calibration] Airdrop confirmed:', sig);
    } catch (error) {
      // Airdrops can be rate limited; proceed and let the real tx error surface.
      console.warn('[Calibration] Airdrop failed (continuing):', error instanceof Error ? error.message : String(error));
    }
  }, []);

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
   *
   * The API automatically combines init + record into a single transaction
   * if the forecaster is not yet initialized. User signs only ONCE.
   *
   * Returns the transaction signature on success, null on failure
   */
  const recordPrediction = useCallback(
    async (params: RecordParams): Promise<string | null> => {
      const provider = typeof window !== 'undefined' ? (window as Window & { __BERIGHT_PROVIDER__?: string }).__BERIGHT_PROVIDER__ : 'unknown';

      console.log('[Calibration] ═══════════════════════════════════════════════════');
      console.log('[Calibration] 🚀 Recording prediction on-chain');
      console.log('[Calibration] Market:', params.marketId);
      console.log('[Calibration] Direction:', params.direction, '| Probability:', params.probability);
      console.log('[Calibration] Provider:', provider, '| Wallet:', ownerPubkey?.slice(0, 8) || 'none');

      // Validate wallet connection
      if (!connected || !ownerPubkey) {
        console.error('[Calibration] ❌ Wallet not connected');
        return null;
      }

      const signTransaction = getSignTransaction();
      if (!signTransaction) {
        console.error('[Calibration] ❌ No signTransaction function available');
        return null;
      }

      // Validate params
      if (!params.marketId || typeof params.marketId !== 'string' || params.marketId.trim() === '') {
        console.error('[Calibration] ❌ Invalid marketId:', params.marketId);
        return null;
      }
      if (typeof params.probability !== 'number' || isNaN(params.probability) || params.probability < 0 || params.probability > 1) {
        console.error('[Calibration] ❌ Invalid probability:', params.probability);
        return null;
      }
      if (params.direction !== 'yes' && params.direction !== 'no') {
        console.error('[Calibration] ❌ Invalid direction:', params.direction);
        return null;
      }

      const connection = new Connection(SOLANA_RPC, 'confirmed');

      try {
        // Ensure the user has enough devnet SOL to pay for account creation + fees.
        // This is a common failure mode in production (mainnet wallets often have 0 devnet SOL).
        await ensureDevnetBalance(connection, ownerPubkey);

        // Step 1: Call API to build transaction (includes init if needed)
        console.log('[Calibration] 📝 Building transaction...');
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
          }),
        });

        const json = await res.json();

        if (!json.success) {
          console.error('[Calibration] ❌ API error:', json.error);
          return null;
        }

        const { transaction: txBase64, predictionPda, includesInit } = json.data;

        if (includesInit) {
          console.log('[Calibration] ✓ Transaction includes forecaster initialization');
        }
        console.log('[Calibration] ✓ Prediction PDA:', predictionPda);

        // Step 2: Deserialize and update blockhash
        const txBytes = Buffer.from(txBase64, 'base64');
        const transaction = Transaction.from(txBytes);

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;

        // Step 3: Sign transaction (user signs ONCE)
        console.log('[Calibration] 🔐 Requesting wallet signature...');
        const signedTx = await signTransaction(transaction);
        console.log('[Calibration] ✓ Transaction signed');

        // Step 4: Submit to network
        console.log('[Calibration] 📤 Submitting to devnet...');
        const signedTxSerialized = (signedTx as Transaction).serialize();
        let signature: string;
        try {
          signature = await connection.sendRawTransaction(signedTxSerialized, {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
          });
        } catch (sendErr) {
          const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
          // If we failed due to insufficient devnet funds, try one airdrop + retry once.
          if (SOLANA_RPC.includes('devnet') && /insufficient funds|attempt to debit|custom program error: 0x1/i.test(msg)) {
            console.warn('[Calibration] Send failed (likely low funds), attempting airdrop then retry once...');
            await ensureDevnetBalance(connection, ownerPubkey);
            signature = await connection.sendRawTransaction(signedTxSerialized, {
              skipPreflight: false,
              preflightCommitment: 'confirmed',
            });
          } else {
            throw sendErr;
          }
        }

        // Step 5: Confirm
        console.log('[Calibration] ⏳ Confirming...');
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        }, 'confirmed');

        console.log('[Calibration] ═══════════════════════════════════════════════════');
        console.log('[Calibration] ✅ PREDICTION RECORDED ON-CHAIN!');
        console.log('[Calibration] Signature:', signature);
        console.log('[Calibration] Explorer: https://explorer.solana.com/tx/' + signature + '?cluster=devnet');
        console.log('[Calibration] ═══════════════════════════════════════════════════');

        return signature;
      } catch (err) {
        console.error('[Calibration] ═══════════════════════════════════════════════════');
        console.error('[Calibration] ❌ ERROR recording prediction');
        console.error('[Calibration] Full error:', err);
        if (err instanceof Error) {
          console.error('[Calibration] Message:', err.message);
          console.error('[Calibration] Stack:', err.stack);
          // Check for Solana-specific errors
          if ('logs' in err) {
            console.error('[Calibration] Program logs:', (err as any).logs);
          }
        }
        console.error('[Calibration] ═══════════════════════════════════════════════════');
        return null;
      }
    },
    [connected, ownerPubkey, getSignTransaction]
  );

  return {
    recordPrediction,
    connected,
    ownerPubkey,
  };
}

export default usePredictionRecorder;
