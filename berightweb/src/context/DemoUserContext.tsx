'use client';

/**
 * DemoUserContext - User context for Demo mode (Jupiter wallet adapter)
 *
 * Provides the same interface as UserContext but uses Jupiter/Solana wallet adapter
 * instead of Privy. Must be used within DemoWalletProvider.
 */

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useUnifiedWalletContext } from '@jup-ag/wallet-adapter';
import {
  extractReferralCode,
  storeReferralAttribution,
  getReferralAttribution,
  generateReferralCode,
} from '@/lib/referral';

// ============================================================================
// TYPES - Mirror UserContext interface exactly
// ============================================================================

interface UserProfile {
  id: string;
  walletAddress: string | null;
  email: string | null;
  phone: string | null;
  telegramId: string | null;
  username: string | null;
  avatar: string | null;
  bio: string | null;
  twitterHandle: string | null;
  discordHandle: string | null;
  websiteUrl: string | null;
  avatarUrl: string | null;
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
  login: () => Promise<void>;
  logout: () => Promise<void>;
  walletAddress: string | null;
  linkTelegram: (telegramId: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshUser: () => Promise<void>;
  referralCode: string | null;
}

// ============================================================================
// CONTEXT
// ============================================================================

const DemoUserContext = createContext<UserContextType | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

export function DemoUserProvider({ children }: { children: ReactNode }) {
  const { publicKey, connected, disconnect, connecting } = useWallet();
  const { setShowModal } = useUnifiedWalletContext();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const walletAddress = publicKey?.toString() || null;

  // Track referral on initial page load
  useEffect(() => {
    const refCode = extractReferralCode();
    if (refCode) {
      storeReferralAttribution(refCode);
    }
  }, []);

  // Open Jupiter wallet modal
  const login = useCallback(async () => {
    setShowModal(true);
  }, [setShowModal]);

  // Disconnect wallet
  const logout = useCallback(async () => {
    try {
      await disconnect();
      setUser(null);
    } catch (error) {
      console.warn('[DemoUserContext] Logout error:', error);
    }
  }, [disconnect]);

  // Debug: Expose to window
  useEffect(() => {
    if (typeof window === 'undefined') return;

    (window as Window & { __BERIGHT_USER__?: unknown }).__BERIGHT_USER__ = {
      provider: 'jupiter',
      mode: 'demo',
      connected,
      connecting,
      walletAddress: walletAddress || 'none',
      user: user ? { id: user.id, username: user.username } : null,
    };

    // Expose login/logout functions to window for Header component
    (window as Window & { __BERIGHT_USER_FUNCS__?: { login?: () => Promise<void>; logout?: () => Promise<void> } }).__BERIGHT_USER_FUNCS__ = {
      login,
      logout,
    };

    console.log('[DemoUserContext] State:', {
      connected,
      connecting,
      walletAddress: walletAddress?.slice(0, 8) || 'none',
      hasUser: !!user,
    });
  }, [connected, connecting, walletAddress, user, login, logout]);

  // Create user profile when wallet connects
  useEffect(() => {
    if (connected && walletAddress) {
      fetchOrCreateProfile(walletAddress);
    } else {
      setUser(null);
      if (!connecting) {
        setIsLoading(false);
      }
    }
  }, [connected, walletAddress, connecting]);

  // Finish loading once initial check is done
  useEffect(() => {
    // Give wallet adapter time to auto-connect
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 1500);

    return () => clearTimeout(timeout);
  }, []);

  const fetchOrCreateProfile = async (address: string) => {
    setIsLoading(true);
    try {
      const referralAttribution = getReferralAttribution();

      // Try to get existing profile
      const res = await fetch('/api/users/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privyId: `demo-${address}`,
          walletAddress: address,
          email: null,
          phone: null,
          referredBy: referralAttribution?.code || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        // Create mock profile for demo
        setUser(createMockProfile(address));
      }
    } catch (error) {
      console.warn('[DemoUserContext] Profile fetch failed:', error);
      setUser(createMockProfile(address));
    } finally {
      setIsLoading(false);
    }
  };

  const createMockProfile = (address: string): UserProfile => ({
    id: `demo-${address}`,
    walletAddress: address,
    email: null,
    phone: null,
    telegramId: null,
    username: `${address.slice(0, 6)}...${address.slice(-4)}`,
    avatar: null,
    bio: null,
    twitterHandle: null,
    discordHandle: null,
    websiteUrl: null,
    avatarUrl: null,
    totalPredictions: 0,
    accuracy: 0,
    brierScore: 0,
    streak: 0,
    rank: 0,
    joinedAt: new Date().toISOString(),
  });

  const linkTelegram = async (telegramId: string) => {
    if (!user) return;
    // In demo mode, just update local state
    setUser(prev => prev ? { ...prev, telegramId } : null);
  };

  const refreshProfile = async () => {
    if (connected && walletAddress) {
      await fetchOrCreateProfile(walletAddress);
    }
  };

  const referralCode = walletAddress ? generateReferralCode(walletAddress) : null;

  return (
    <DemoUserContext.Provider
      value={{
        user,
        isAuthenticated: connected,
        isLoading: isLoading || connecting,
        login,
        logout,
        walletAddress,
        linkTelegram,
        refreshProfile,
        refreshUser: refreshProfile,
        referralCode,
      }}
    >
      {children}
    </DemoUserContext.Provider>
  );
}

// ============================================================================
// HOOK - Named useUser to match UserContext interface
// ============================================================================

export function useDemoUser(): UserContextType {
  const context = useContext(DemoUserContext);
  if (context === undefined) {
    throw new Error('useDemoUser must be used within a DemoUserProvider');
  }
  return context;
}

// Also export as useUser for drop-in replacement
export { useDemoUser as useUser };
