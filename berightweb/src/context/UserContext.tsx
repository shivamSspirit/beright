'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';

interface UserProfile {
  id: string;
  walletAddress: string | null;
  email: string | null;
  phone: string | null;
  telegramId: string | null;
  username: string | null;
  avatar: string | null;
  totalPredictions: number;
  accuracy: number;
  brierScore: number;
  streak: number;
  rank: number;
  joinedAt: string;
}

interface UserContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  walletAddress: string | null;
  linkTelegram: (telegramId: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated, user: privyUser, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const primaryWallet = wallets?.[0];
  const walletAddress = primaryWallet?.address || null;

  // Fetch or create user profile when authenticated
  useEffect(() => {
    if (!ready) return;

    if (authenticated && privyUser) {
      fetchOrCreateProfile();
    } else {
      setUser(null);
      setIsLoading(false);
    }
  }, [ready, authenticated, privyUser, walletAddress]);

  const fetchOrCreateProfile = async () => {
    setIsLoading(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      // Try to get existing profile
      const res = await fetch(`${API_BASE}/api/users/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privyId: privyUser?.id,
          walletAddress,
          email: privyUser?.email?.address,
          phone: privyUser?.phone?.number,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        // Create mock profile for demo
        setUser({
          id: privyUser?.id || 'demo-user',
          walletAddress,
          email: privyUser?.email?.address || null,
          phone: privyUser?.phone?.number || null,
          telegramId: null,
          username: walletAddress
            ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
            : 'Anonymous',
          avatar: null,
          totalPredictions: 0,
          accuracy: 0,
          brierScore: 0,
          streak: 0,
          rank: 0,
          joinedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      // Fallback to local profile
      setUser({
        id: privyUser?.id || 'demo-user',
        walletAddress,
        email: privyUser?.email?.address || null,
        phone: privyUser?.phone?.number || null,
        telegramId: null,
        username: walletAddress
          ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
          : 'Anonymous',
        avatar: null,
        totalPredictions: 0,
        accuracy: 0,
        brierScore: 0,
        streak: 0,
        rank: 0,
        joinedAt: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const linkTelegram = async (telegramId: string) => {
    if (!user) return;

    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${API_BASE}/api/users/link-telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          walletAddress,
          telegramId,
        }),
      });

      if (res.ok) {
        setUser(prev => prev ? { ...prev, telegramId } : null);
      }
    } catch (error) {
      console.error('Failed to link Telegram:', error);
    }
  };

  const refreshProfile = async () => {
    if (authenticated && privyUser) {
      await fetchOrCreateProfile();
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        isAuthenticated: authenticated,
        isLoading: !ready || isLoading,
        login,
        logout,
        walletAddress,
        linkTelegram,
        refreshProfile,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
