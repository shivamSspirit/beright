'use client';

import { createContext, useContext, useMemo, ReactNode } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { usePrivyConfigured } from './PrivyProvider';

interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  isReady: boolean;
  login: () => void;
  logout: () => Promise<void>;
  user: any | null;
  wallets: any[];
  authenticated: boolean;
}

const defaultState: WalletState = {
  address: null,
  isConnected: false,
  isConnecting: false,
  isReady: true,
  login: () => {},
  logout: async () => {},
  user: null,
  wallets: [],
  authenticated: false,
};

const WalletContext = createContext<WalletState>(defaultState);

// Inner component that uses Privy hooks (only rendered when Privy is configured)
function PrivyWalletProvider({ children }: { children: ReactNode }) {
  const { login, logout, authenticated, ready, user } = usePrivy();
  const { wallets } = useWallets();

  const value = useMemo(() => {
    const primaryWallet = wallets?.find((w: any) => w.walletClientType === 'privy') || wallets?.[0];
    const address = primaryWallet?.address || user?.wallet?.address || null;

    return {
      address,
      isConnected: authenticated && !!address,
      isConnecting: !ready,
      isReady: ready,
      login,
      logout,
      user,
      wallets: wallets || [],
      authenticated,
    };
  }, [authenticated, ready, user, wallets, login, logout]);

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

// Fallback provider when Privy is not configured
function FallbackWalletProvider({ children }: { children: ReactNode }) {
  return (
    <WalletContext.Provider value={defaultState}>
      {children}
    </WalletContext.Provider>
  );
}

// Main export - checks if Privy is configured via context
export function WalletProvider({ children }: { children: ReactNode }) {
  const privyConfigured = usePrivyConfigured();

  if (!privyConfigured) {
    return <FallbackWalletProvider>{children}</FallbackWalletProvider>;
  }

  return <PrivyWalletProvider>{children}</PrivyWalletProvider>;
}

export function useWallet() {
  return useContext(WalletContext);
}

// Re-export Privy hooks for advanced usage
export { usePrivy, useWallets } from '@privy-io/react-auth';
