'use client';

import { createContext, useContext, useMemo, ReactNode } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';

interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  isReady: boolean;
  login: () => void;
  logout: () => Promise<void>;
  // Privy-specific
  user: any | null;
  wallets: any[];
  authenticated: boolean;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const {
    login,
    logout,
    authenticated,
    ready,
    user
  } = usePrivy();

  const { wallets } = useWallets();

  const value = useMemo(() => {
    // Get the first wallet (Privy embedded or external)
    // Privy v2 uses walletClientType to identify wallet type
    const primaryWallet = wallets.find(w => w.walletClientType === 'privy') || wallets[0];
    const address = primaryWallet?.address || user?.wallet?.address || null;

    return {
      address,
      isConnected: authenticated && !!address,
      isConnecting: !ready,
      isReady: ready,
      login,
      logout,
      user,
      wallets,
      authenticated,
    };
  }, [authenticated, ready, user, wallets, login, logout]);

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

// Re-export Privy hooks for advanced usage
export { usePrivy, useWallets } from '@privy-io/react-auth';
