'use client';

import { PrivyProvider as PrivyAuthProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';

interface PrivyProviderProps {
  children: React.ReactNode;
}

// Solana wallet connectors
const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: true,
});

export default function PrivyProvider({ children }: PrivyProviderProps) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    console.warn('Privy App ID not configured - auth disabled');
    return <>{children}</>;
  }

  return (
    <PrivyAuthProvider
      appId={appId}
      config={{
        // Login methods
        loginMethods: ['wallet', 'email', 'sms', 'google', 'twitter'],

        // Appearance
        appearance: {
          theme: 'dark',
          accentColor: '#00E676',
          showWalletLoginFirst: true,
          logo: 'https://beright.ai/logo.png',
          walletChainType: 'solana-only',
        },

        // Embedded wallets - create for users without wallets
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },

        // External wallet connectors (Phantom, Solflare, etc.)
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },

        // Solana clusters
        solanaClusters: [
          { name: 'mainnet-beta', rpcUrl: 'https://api.mainnet-beta.solana.com' },
          { name: 'devnet', rpcUrl: 'https://api.devnet.solana.com' },
        ],
      }}
    >
      {children}
    </PrivyAuthProvider>
  );
}
