'use client';

/**
 * DemoWalletProvider - Jupiter Unified Wallet Kit for Demo Mode
 *
 * Uses Jupiter's wallet adapter for demo/devnet mode.
 * Provides standard Solana wallet functionality without Privy.
 */

import { ReactNode, useEffect, useMemo } from 'react';
import {
  UnifiedWalletProvider,
  UnifiedWalletButton,
} from '@jup-ag/wallet-adapter';
import { useWallet } from '@solana/wallet-adapter-react';
import { clusterApiUrl, Transaction, VersionedTransaction } from '@solana/web3.js';

// ============================================================================
// TYPES
// ============================================================================

interface DemoWalletProviderProps {
  children: ReactNode;
}

// ============================================================================
// DEBUG BRIDGE - Expose wallet state to window
// ============================================================================

function WalletDebugBridge({ children }: { children: ReactNode }) {
  const { wallet, publicKey, connected, connecting, disconnect, signTransaction, signAllTransactions, signMessage } = useWallet();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Expose Jupiter wallet state to window
    const walletState = {
      connected,
      connecting,
      disconnecting: false,
      publicKey: publicKey?.toString() || null,
      walletName: wallet?.adapter?.name || null,
      walletIcon: wallet?.adapter?.icon || null,
    };

    (window as Window & { __BERIGHT_WALLET__?: typeof walletState }).__BERIGHT_WALLET__ = walletState;
    (window as Window & { __BERIGHT_WALLET_RAW__?: typeof wallet }).__BERIGHT_WALLET_RAW__ = wallet;
    (window as Window & { __BERIGHT_MODE__?: string }).__BERIGHT_MODE__ = 'demo';
    (window as Window & { __BERIGHT_PROVIDER__?: string }).__BERIGHT_PROVIDER__ = 'jupiter';

    // Expose wallet functions for escrow hook
    // The signTransaction function needs to be bound to work correctly
    (window as Window & { __BERIGHT_WALLET_FUNCS__?: unknown }).__BERIGHT_WALLET_FUNCS__ = {
      disconnect,
      signTransaction: signTransaction ? async (tx: unknown) => {
        try {
          console.log('[DemoWallet] signTransaction called, tx type:', tx?.constructor?.name);
          // signTransaction from wallet-adapter returns the signed transaction directly
          const signed = await signTransaction(tx as Transaction | VersionedTransaction);
          console.log('[DemoWallet] signTransaction success');
          return signed;
        } catch (err) {
          console.error('[DemoWallet] signTransaction failed:', err);
          throw err;
        }
      } : null,
      signAllTransactions,
      signMessage,
    };

    console.log('[DemoWallet] Debug state:', {
      mode: 'demo',
      provider: 'jupiter',
      connected,
      publicKey: publicKey?.toString()?.slice(0, 8) || 'none',
      walletName: wallet?.adapter?.name || 'none',
      hasSignTransaction: !!signTransaction,
    });

  }, [wallet, publicKey, connected, connecting, disconnect, signTransaction, signAllTransactions, signMessage]);

  return <>{children}</>;
}

// ============================================================================
// PROVIDER
// ============================================================================

export function DemoWalletProvider({ children }: DemoWalletProviderProps) {
  // Use devnet RPC
  const endpoint = useMemo(() => {
    return process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL || clusterApiUrl('devnet');
  }, []);

  return (
    <UnifiedWalletProvider
      wallets={[]}
      config={{
        autoConnect: true,
        env: 'devnet',
        metadata: {
          name: 'BeRight',
          description: 'AI Prediction Markets',
          url: 'https://beright.ai',
          iconUrls: ['/logo.jpg'],
        },
        walletlistExplanation: {
          href: 'https://docs.beright.ai/wallets',
        },
        theme: 'dark',
      }}
    >
      <WalletDebugBridge>{children}</WalletDebugBridge>
    </UnifiedWalletProvider>
  );
}

// ============================================================================
// HOOK: Use Demo Wallet (for components in demo mode)
// ============================================================================

export function useDemoWallet() {
  const { wallet, publicKey, connected, connecting, disconnect, signTransaction, signAllTransactions, signMessage, select } = useWallet();

  return {
    // State
    connected,
    connecting,
    publicKey: publicKey?.toString() || null,
    walletName: wallet?.adapter?.name || null,

    // Actions
    connect: async () => {
      // If wallet is selected, connect it
      if (wallet) {
        await wallet.adapter.connect();
      }
    },

    disconnect: async () => {
      if (disconnect) {
        await disconnect();
      }
    },

    signTransaction,
    signAllTransactions,
    signMessage,

    // Raw wallet access
    wallet,
    select,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { UnifiedWalletButton };
export default DemoWalletProvider;
