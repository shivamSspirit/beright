'use client';

import { PrivyProvider as PrivyAuthProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';

interface PrivyProviderProps {
  children: React.ReactNode;
}

// Solana wallet connectors - Phantom, Solflare, Backpack, etc.
const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: false,
});

// Solana RPC configuration for embedded wallets
const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const SOLANA_WS_URL = SOLANA_RPC_URL.replace('https://', 'wss://').replace('http://', 'ws://');

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

        // Solana RPC configuration (required for embedded wallets in v3)
        solana: {
          rpcs: {
            'solana:mainnet': {
              rpc: createSolanaRpc(SOLANA_RPC_URL),
              rpcSubscriptions: createSolanaRpcSubscriptions(SOLANA_WS_URL),
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
      {children}
    </PrivyAuthProvider>
  );
}
