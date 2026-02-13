'use client';

import { useState, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets, useSignTransaction } from '@privy-io/react-auth/solana';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import { getDFlowOrder, getDFlowOrderStatus, DFlowOrderResponse, DFlowOrderStatus } from '@/lib/api';

// Solana RPC endpoint
const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';

// Token mints
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SOL_MINT = 'So11111111111111111111111111111111111111112';

export type TradingStep =
  | 'idle'
  | 'getting-quote'
  | 'signing'
  | 'submitting'
  | 'confirming'
  | 'success'
  | 'error';

interface TradingState {
  step: TradingStep;
  order: DFlowOrderResponse | null;
  signature: string | null;
  status: DFlowOrderStatus | null;
  error: string | null;
  txUrl: string | null;
}

interface TradeParams {
  side: 'YES' | 'NO';
  amount: number;
  inputToken: 'USDC' | 'SOL';
  yesMint: string;
  noMint: string;
  slippageBps?: number;
}

export function useDFlowTrading() {
  // Privy hooks for auth and wallet
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets: solanaWallets, ready: walletsReady } = useWallets();
  const { signTransaction } = useSignTransaction();

  const [state, setState] = useState<TradingState>({
    step: 'idle',
    order: null,
    signature: null,
    status: null,
    error: null,
    txUrl: null,
  });

  // Get the first connected Solana wallet
  const solanaWallet = solanaWallets[0];

  // Connection status
  const isReady = ready && walletsReady;
  const isConnected = isReady && authenticated && !!solanaWallet?.address;

  // Connect wallet - opens Privy modal
  const connectWallet = useCallback(async () => {
    if (!ready) {
      console.warn('[DFlowTrading] Privy not ready yet');
      return;
    }
    if (!authenticated) {
      try {
        // This opens the Privy login modal
        await login();
      } catch (error) {
        // Privy handles its own error UI, just log
        console.warn('[DFlowTrading] Login error:', error);
      }
    }
  }, [ready, authenticated, login]);

  // Disconnect wallet
  const disconnectWallet = useCallback(async () => {
    if (authenticated) {
      logout();
    }
  }, [authenticated, logout]);

  // Reset state
  const reset = useCallback(() => {
    setState({
      step: 'idle',
      order: null,
      signature: null,
      status: null,
      error: null,
      txUrl: null,
    });
  }, []);

  // Poll for order status
  const pollStatus = useCallback(async (signature: string, maxAttempts = 30): Promise<DFlowOrderStatus | null> => {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await getDFlowOrderStatus(signature);

        if (response.success && response.status) {
          setState(prev => ({ ...prev, status: response.status }));

          if (response.status.status === 'closed') {
            return response.status;
          }

          if (response.status.status === 'failed' || response.status.status === 'expired') {
            throw new Error(`Order ${response.status.status}`);
          }
        }
      } catch (err) {
        console.error('Status poll error:', err);
      }

      // Wait 2 seconds between polls
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return null;
  }, []);

  // Execute trade
  const executeTrade = useCallback(async (params: TradeParams): Promise<string | null> => {
    if (!solanaWallet?.address) {
      setState(prev => ({ ...prev, step: 'error', error: 'Wallet not connected' }));
      return null;
    }

    try {
      // Step 1: Get order/quote from DFlow
      setState(prev => ({ ...prev, step: 'getting-quote', error: null }));

      const inputMint = params.inputToken === 'USDC' ? USDC_MINT : SOL_MINT;
      const outputMint = params.side === 'YES' ? params.yesMint : params.noMint;

      // Convert amount to smallest unit (USDC has 6 decimals, SOL has 9)
      const decimals = params.inputToken === 'USDC' ? 6 : 9;
      const amountInSmallestUnit = Math.floor(params.amount * Math.pow(10, decimals));

      const orderResponse = await getDFlowOrder({
        inputMint,
        outputMint,
        amount: amountInSmallestUnit,
        userPublicKey: solanaWallet.address,
        slippageBps: params.slippageBps || 100,
      });

      if (!orderResponse.success || !orderResponse.order) {
        throw new Error('Failed to get order from DFlow');
      }

      setState(prev => ({ ...prev, order: orderResponse.order }));

      // Step 2: Decode and sign transaction
      setState(prev => ({ ...prev, step: 'signing' }));

      // Decode base64 transaction
      const transactionBuffer = Buffer.from(orderResponse.order.transaction, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuffer);

      // Sign with wallet using Privy's Solana signTransaction hook
      if (!solanaWallet) {
        throw new Error('No wallet connected');
      }

      // Serialize transaction to Uint8Array for signing
      const serializedTx = transaction.serialize();

      // Sign using Privy's signTransaction
      const { signedTransaction: signedTxBytes } = await signTransaction({
        transaction: serializedTx,
        wallet: solanaWallet,
      });

      // Deserialize signed transaction
      const signedTx = VersionedTransaction.deserialize(signedTxBytes);

      // Step 3: Submit transaction
      setState(prev => ({ ...prev, step: 'submitting' }));

      const connection = new Connection(SOLANA_RPC, 'confirmed');
      const signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      setState(prev => ({
        ...prev,
        signature,
        txUrl: `https://solscan.io/tx/${signature}`,
      }));

      // Step 4: Confirm transaction
      setState(prev => ({ ...prev, step: 'confirming' }));

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');

      if (confirmation.value.err) {
        throw new Error('Transaction failed on-chain');
      }

      // Poll DFlow status
      const finalStatus = await pollStatus(signature);

      if (finalStatus?.status === 'closed') {
        setState(prev => ({ ...prev, step: 'success', status: finalStatus }));
        return signature;
      } else {
        // Transaction confirmed but DFlow status not closed yet - still success
        setState(prev => ({ ...prev, step: 'success' }));
        return signature;
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Trade failed';
      console.error('Trade error:', err);
      setState(prev => ({ ...prev, step: 'error', error: message }));
      return null;
    }
  }, [solanaWallet, signTransaction, pollStatus]);

  return {
    ...state,
    walletAddress: solanaWallet?.address,
    isConnected,
    isReady,
    authenticated,
    executeTrade,
    connectWallet,
    disconnectWallet,
    reset,
  };
}
