'use client';

import { PrivyProvider as PrivyClientProvider } from '@privy-io/react-auth';
import { ReactNode } from 'react';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';

// Solana mainnet chain definition
const solanaMainnet = {
  id: 101,
  name: 'Solana',
  network: 'mainnet-beta',
  nativeCurrency: {
    name: 'SOL',
    symbol: 'SOL',
    decimals: 9,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'],
    },
  },
};

export function PrivyProvider({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) {
    console.warn('[PrivyProvider] NEXT_PUBLIC_PRIVY_APP_ID not set, wallet features disabled');
    return <>{children}</>;
  }

  return (
    <PrivyClientProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#22c55e',
          logo: '/logo.png',
        },
        loginMethods: ['wallet', 'email'],
        embeddedWallets: {
          solana: {
            createOnLogin: 'users-without-wallets',
          },
        },
        supportedChains: [solanaMainnet],
        defaultChain: solanaMainnet,
      }}
    >
      {children}
    </PrivyClientProvider>
  );
}
