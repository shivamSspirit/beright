'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Connection, VersionedTransaction, Transaction, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { getDFlowOrder, getDFlowOrderStatus, DFlowOrderResponse, DFlowOrderStatus } from '@/lib/api';
import { useMode } from '@/context/ModeContext';
import { useUser } from '@/hooks/useUnifiedUser';

// Solana RPC endpoints
const MAINNET_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const DEVNET_RPC = process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com';

// Token mints - mainnet
const USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
// Token mints - devnet (demo mode)
const USDC_MINT_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

// Memo program ID (same on mainnet and devnet)
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

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
  // Mode context for demo vs production
  const { isDemo, network, isLoading: modeLoading } = useMode();

  // Unified user hook for auth (works in both demo and production)
  const { isAuthenticated, login, logout, walletAddress, isLoading: userLoading } = useUser();

  // Select RPC and USDC mint based on mode
  const SOLANA_RPC = isDemo ? DEVNET_RPC : MAINNET_RPC;
  const USDC_MINT = isDemo ? USDC_MINT_DEVNET : USDC_MINT_MAINNET;

  const [state, setState] = useState<TradingState>({
    step: 'idle',
    order: null,
    signature: null,
    status: null,
    error: null,
    txUrl: null,
  });

  // Connection status
  const isReady = !modeLoading && !userLoading;
  const isConnected = isReady && isAuthenticated && !!walletAddress;

  // Connect wallet - opens login modal (Privy or Jupiter based on mode)
  const connectWallet = useCallback(async () => {
    if (!isReady) {
      console.warn('[DFlowTrading] Not ready yet');
      return;
    }
    if (!isAuthenticated) {
      try {
        await login();
      } catch (error) {
        console.warn('[DFlowTrading] Login error:', error);
      }
    }
  }, [isReady, isAuthenticated, login]);

  // Disconnect wallet
  const disconnectWallet = useCallback(async () => {
    if (isAuthenticated && logout) {
      logout();
    }
  }, [isAuthenticated, logout]);

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

  // Execute trade - demo mode uses mock transactions, production uses real DFlow
  const executeTrade = useCallback(async (params: TradeParams): Promise<string | null> => {
    if (!walletAddress) {
      setState(prev => ({ ...prev, step: 'error', error: 'Wallet not connected' }));
      return null;
    }

    try {
      // =====================================================
      // DEMO MODE: Real devnet transaction with memo
      // =====================================================
      if (isDemo) {
        console.log('[Demo] Executing real devnet prediction:', params);

        // Step 1: Build prediction memo
        setState(prev => ({ ...prev, step: 'getting-quote', error: null }));

        const connection = new Connection(DEVNET_RPC, 'confirmed');
        const outputMint = params.side === 'YES' ? params.yesMint : params.noMint;

        // Create order info for display
        const demoOrder: DFlowOrderResponse = {
          inputMint: USDC_MINT_DEVNET,
          outputMint,
          inAmount: String(params.amount),
          outAmount: String(params.amount * 0.98),
          slippageBps: params.slippageBps || 200,
          priceImpactPct: '0.5',
          executionMode: 'demo-devnet',
          transaction: '',
        };
        setState(prev => ({ ...prev, order: demoOrder }));

        // Get wallet signing function
        const walletFuncs = (window as Window & {
          __BERIGHT_WALLET_FUNCS__?: {
            signTransaction?: (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
          };
        }).__BERIGHT_WALLET_FUNCS__;

        if (!walletFuncs?.signTransaction) {
          throw new Error('Wallet not connected. Please connect your wallet first.');
        }

        // Step 2: Create and sign memo transaction
        setState(prev => ({ ...prev, step: 'signing' }));

        // Create memo with prediction details
        const memoData = JSON.stringify({
          type: 'beright_prediction',
          side: params.side,
          amount: params.amount,
          market: outputMint.slice(0, 8),
          timestamp: Date.now(),
        });

        const memoInstruction = new TransactionInstruction({
          keys: [{ pubkey: new PublicKey(walletAddress), isSigner: true, isWritable: true }],
          programId: MEMO_PROGRAM_ID,
          data: Buffer.from(memoData),
        });

        // Build transaction
        const transaction = new Transaction();
        transaction.add(memoInstruction);
        transaction.feePayer = new PublicKey(walletAddress);
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        // Sign with wallet
        const signedTx = await walletFuncs.signTransaction(transaction);

        // Step 3: Submit to devnet
        setState(prev => ({ ...prev, step: 'submitting' }));

        const signature = await connection.sendRawTransaction(
          (signedTx as Transaction).serialize(),
          { skipPreflight: false, preflightCommitment: 'confirmed' }
        );

        const txUrl = `https://solscan.io/tx/${signature}?cluster=devnet`;
        setState(prev => ({ ...prev, signature, txUrl }));

        // Step 4: Confirm transaction
        setState(prev => ({ ...prev, step: 'confirming' }));

        await connection.confirmTransaction(signature, 'confirmed');

        // Success!
        const demoStatus: DFlowOrderStatus = {
          status: 'closed',
          inAmount: String(params.amount),
          outAmount: String(params.amount * 0.98),
        };

        setState(prev => ({
          ...prev,
          step: 'success',
          status: demoStatus,
        }));

        console.log('[Demo] Real devnet prediction recorded:', signature);
        return signature;
      }

      // =====================================================
      // PRODUCTION MODE: Real DFlow trade execution
      // =====================================================

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
        userPublicKey: walletAddress,
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

      // Get wallet signing function from window (set by DemoWalletProvider or PrivyProvider)
      const walletFuncs = (window as Window & {
        __BERIGHT_WALLET_FUNCS__?: {
          signTransaction?: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
        };
      }).__BERIGHT_WALLET_FUNCS__;

      if (!walletFuncs?.signTransaction) {
        throw new Error('Wallet signing not available');
      }

      // Sign the transaction
      const signedTx = await walletFuncs.signTransaction(transaction);

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
        txUrl: `https://orbmarkets.io/tx/${signature}?cluster=devnet&tab=summary`,
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
  }, [walletAddress, pollStatus, isDemo, SOLANA_RPC, USDC_MINT]);

  return {
    ...state,
    walletAddress,
    isConnected,
    isReady,
    authenticated: isAuthenticated,
    executeTrade,
    connectWallet,
    disconnectWallet,
    reset,
    // Demo mode info
    isDemo,
    network,
  };
}
