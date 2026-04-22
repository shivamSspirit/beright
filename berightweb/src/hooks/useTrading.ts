'use client';

import { useState, useCallback } from 'react';
import { useMode } from '@/context/ModeContext';
import { useUser } from '@/hooks/useUnifiedUser';

// Solana RPC endpoints
const MAINNET_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const DEVNET_RPC = process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com';

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
  signature: string | null;
  error: string | null;
  txUrl: string | null;
}

/**
 * Generic trading hook for Jupiter prediction markets
 * Handles wallet connection state and trading step tracking
 */
export function useTrading() {
  // Mode context for demo vs production
  const { isDemo, network, isLoading: modeLoading } = useMode();

  // Unified user hook for auth (works in both demo and production)
  const { isAuthenticated, login, logout, walletAddress, isLoading: userLoading } = useUser();

  // Select RPC based on mode
  const SOLANA_RPC = isDemo ? DEVNET_RPC : MAINNET_RPC;

  const [state, setState] = useState<TradingState>({
    step: 'idle',
    signature: null,
    error: null,
    txUrl: null,
  });

  // Connection status
  const isReady = !modeLoading && !userLoading;
  const isConnected = isReady && isAuthenticated && !!walletAddress;

  // Connect wallet - opens login modal (Privy or Jupiter based on mode)
  const connectWallet = useCallback(async () => {
    if (!isReady) {
      console.warn('[Trading] Not ready yet');
      return;
    }
    if (!isAuthenticated) {
      try {
        await login();
      } catch (error) {
        console.warn('[Trading] Login error:', error);
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
      signature: null,
      error: null,
      txUrl: null,
    });
  }, []);

  // Set trading step
  const setStep = useCallback((step: TradingStep, error?: string) => {
    setState(prev => ({
      ...prev,
      step,
      error: error || null,
    }));
  }, []);

  // Set success with signature
  const setSuccess = useCallback((signature: string, txUrl?: string) => {
    setState({
      step: 'success',
      signature,
      error: null,
      txUrl: txUrl || `https://explorer.solana.com/tx/${signature}?cluster=${isDemo ? 'devnet' : 'mainnet-beta'}`,
    });
  }, [isDemo]);

  // Set error
  const setError = useCallback((error: string) => {
    setState(prev => ({
      ...prev,
      step: 'error',
      error,
    }));
  }, []);

  return {
    ...state,
    walletAddress,
    isConnected,
    isReady,
    authenticated: isAuthenticated,
    connectWallet,
    disconnectWallet,
    reset,
    setStep,
    setSuccess,
    setError,
    // Mode info
    isDemo,
    network,
    rpcUrl: SOLANA_RPC,
  };
}

// Re-export TradingStep type for backwards compatibility
export type { TradingStep as DFlowTradingStep };
