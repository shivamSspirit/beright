'use client';

import { ReactNode, useEffect, useMemo } from 'react';
import { PrivyProvider as PrivyAuthProvider, usePrivy } from '@privy-io/react-auth';
import { toSolanaWalletConnectors, useWallets, useSignTransaction } from '@privy-io/react-auth/solana';
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import { BerightWalletProvider } from '@/context/BerightWalletContext';

interface PrivyProviderProps {
  children: React.ReactNode;
}

// Solana wallet connectors - Phantom, Solflare, Backpack, etc.
const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: false,
});

// RPC URLs for different networks
const MAINNET_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const DEVNET_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com';

function getWsUrl(rpcUrl: string): string {
  return rpcUrl.replace('https://', 'wss://').replace('http://', 'ws://');
}

// ============================================================================
// DEBUG BRIDGE - Expose Privy wallet state to window
// ============================================================================

function PrivyWalletBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets: solanaWallets, ready: walletsReady } = useWallets();
  const { signTransaction } = useSignTransaction();

  // Prioritize external wallets over embedded wallets
  const solanaWallet = useMemo(() => {
    if (!solanaWallets || solanaWallets.length === 0) return null;

    const externalWallet = solanaWallets.find((w) => {
      const name = (w as { name?: string }).name?.toLowerCase() || '';
      const walletClient = (w as { walletClientType?: string }).walletClientType?.toLowerCase() || '';
      return !name.includes('privy') && walletClient !== 'privy';
    });

    return externalWallet || solanaWallets[0];
  }, [solanaWallets]);

  // Also check linkedAccounts as fallback
  const linkedWalletAccount = user?.linkedAccounts?.find(
    (account) => account.type === 'wallet'
  );
  const linkedWalletAddress = linkedWalletAccount && 'address' in linkedWalletAccount
    ? (linkedWalletAccount as { address: string }).address
    : null;

  const publicKey = solanaWallet?.address || linkedWalletAddress || null;
  const walletState = useMemo(() => ({
    connected: authenticated && !!publicKey,
    connecting: !ready || !walletsReady,
    disconnecting: false,
    publicKey,
    walletName: (solanaWallet as { name?: string })?.name || 'Privy',
    walletIcon: null,
  }), [authenticated, publicKey, ready, walletsReady, solanaWallet]);

  const walletFuncs = useMemo(() => ({
    login,
    logout,
    signTransaction: solanaWallet
      ? async (tx: Transaction | VersionedTransaction | Uint8Array) => {
        const txBytes = tx instanceof Uint8Array
            ? tx
            : tx.serialize({ requireAllSignatures: false });

          console.log('[Privy] Signing transaction with wallet:', {
            address: solanaWallet.address?.slice(0, 8),
            type: (solanaWallet as { walletClientType?: string }).walletClientType,
          });

          type PrivyWalletArgument = Parameters<NonNullable<typeof signTransaction>>[0]['wallet'];
          const { signedTransaction } = await signTransaction({
            transaction: txBytes,
            wallet: solanaWallet as PrivyWalletArgument,
          });

          return signedTransaction;
        }
      : undefined,
    rawSignTransaction: signTransaction,
    solanaWallet,
  }), [login, logout, signTransaction, solanaWallet]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Expose Privy wallet state to window
    (window as Window & { __BERIGHT_WALLET__?: typeof walletState }).__BERIGHT_WALLET__ = walletState;
    (window as Window & { __BERIGHT_WALLET_RAW__?: typeof solanaWallet }).__BERIGHT_WALLET_RAW__ = solanaWallet;
    (window as Window & { __BERIGHT_MODE__?: string }).__BERIGHT_MODE__ = 'production';
    (window as Window & { __BERIGHT_PROVIDER__?: string }).__BERIGHT_PROVIDER__ = 'privy';

    // Expose Privy-specific state for escrow hook
    (window as Window & { __BERIGHT_PRIVY__?: unknown }).__BERIGHT_PRIVY__ = {
      ready,
      authenticated,
      walletsReady,
      solanaWallets: solanaWallets?.map(w => ({
        address: w.address,
        walletClientType: (w as { walletClientType?: string }).walletClientType,
        name: (w as { name?: string }).name,
      })),
      selectedWallet: solanaWallet?.address?.slice(0, 8) || 'none',
    };

    // Keep window bridge for legacy hooks while newer code uses BerightWalletContext.
    (window as Window & { __BERIGHT_WALLET_FUNCS__?: unknown }).__BERIGHT_WALLET_FUNCS__ = walletFuncs;

    console.log('[PrivyWallet] Debug state:', {
      mode: 'production',
      provider: 'privy',
      ready,
      authenticated,
      walletsReady,
      connected: authenticated && !!publicKey,
      publicKey: publicKey?.slice(0, 8) || 'none',
      walletName: (solanaWallet as { name?: string })?.name || 'none',
      walletType: (solanaWallet as { walletClientType?: string })?.walletClientType || 'none',
      solanaWalletsCount: solanaWallets?.length || 0,
      hasSignTransaction: !!signTransaction,
    });

  }, [ready, authenticated, walletsReady, user, solanaWallets, solanaWallet, walletState, walletFuncs, publicKey, signTransaction]);

  return (
    <BerightWalletProvider
      value={{
        connected: walletState.connected,
        connecting: walletState.connecting,
        publicKey: walletState.publicKey,
        walletName: walletState.walletName,
        provider: 'privy',
        login: login ? async () => login() : undefined,
        logout: logout ? async () => logout() : undefined,
        signTransaction: walletFuncs.signTransaction,
      }}
    >
      {children}
    </BerightWalletProvider>
  );
}

// ============================================================================
// PROVIDER
// ============================================================================

export default function PrivyProvider({ children }: PrivyProviderProps) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    console.warn('[Privy] App ID not configured - auth disabled');
    return <>{children}</>;
  }

  return (
    <PrivyAuthProvider
      appId={appId}
      config={{
        // Login methods - wallet, social, and email options
        loginMethods: ['wallet', 'google', 'twitter', 'email'],

        // Solana RPC configuration - both mainnet and devnet for mode switching
        solana: {
          rpcs: {
            'solana:mainnet': {
              rpc: createSolanaRpc(MAINNET_RPC_URL),
              rpcSubscriptions: createSolanaRpcSubscriptions(getWsUrl(MAINNET_RPC_URL)),
            },
            'solana:devnet': {
              rpc: createSolanaRpc(DEVNET_RPC_URL),
              rpcSubscriptions: createSolanaRpcSubscriptions(getWsUrl(DEVNET_RPC_URL)),
            },
          },
        },

        // Appearance - dark theme with brand green accent
        appearance: {
          theme: 'dark',
          accentColor: '#10B981',
          showWalletLoginFirst: true,
          logo: '/logo.jpg',
          walletChainType: 'solana-only',
        },

        // Embedded wallets - create Solana wallet for ALL users on login
        embeddedWallets: {
          solana: {
            createOnLogin: 'all-users',
          },
        },

        // External wallet connectors (Phantom, Solflare, Backpack, etc.)
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },
      }}
    >
      <PrivyWalletBridge>{children}</PrivyWalletBridge>
    </PrivyAuthProvider>
  );
}
