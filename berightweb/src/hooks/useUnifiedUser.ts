'use client';

/**
 * Unified User Hook - Works in both Demo and Production modes
 *
 * This hook automatically detects which mode the app is in and returns
 * the appropriate user context. Components should import this instead
 * of directly importing from UserContext or DemoUserContext.
 *
 * Usage:
 *   import { useUser } from '@/hooks/useUnifiedUser';
 *   const { isAuthenticated, walletAddress, login, logout } = useUser();
 */

import { useContext, createContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useMode } from '@/context/ModeContext';

// ============================================================================
// TYPES - Unified interface for both modes
// ============================================================================

export interface UserProfile {
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

export interface UnifiedUserContextType {
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
// CONTEXT - Fallback context for SSR
// ============================================================================

const defaultContext: UnifiedUserContextType = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
  walletAddress: null,
  linkTelegram: async () => {},
  refreshProfile: async () => {},
  refreshUser: async () => {},
  referralCode: null,
};

// ============================================================================
// UNIFIED HOOK - Reads from window state set by providers
// ============================================================================

/**
 * Unified user hook that works in both Demo (Jupiter) and Production (Privy) modes.
 * Reads wallet state from window object that's set by the active provider.
 */
export function useUser(): UnifiedUserContextType {
  const { isDemo, isLoading: modeLoading } = useMode();
  const [state, setState] = useState<{
    isAuthenticated: boolean;
    walletAddress: string | null;
    isLoading: boolean;
  }>({
    isAuthenticated: false,
    walletAddress: null,
    isLoading: true,
  });

  // Poll window state for wallet connection
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkWalletState = () => {
      const walletState = (window as Window & {
        __BERIGHT_WALLET__?: {
          connected: boolean;
          connecting: boolean;
          publicKey: string | null;
        };
      }).__BERIGHT_WALLET__;

      if (walletState) {
        // Only update if values actually changed to prevent infinite loops
        setState(prev => {
          if (
            prev.isAuthenticated === walletState.connected &&
            prev.walletAddress === walletState.publicKey &&
            prev.isLoading === walletState.connecting
          ) {
            return prev; // No change, return same reference
          }
          return {
            isAuthenticated: walletState.connected,
            walletAddress: walletState.publicKey,
            isLoading: walletState.connecting,
          };
        });
      } else {
        // No wallet state yet - only update if loading state changed
        setState(prev => {
          if (prev.isLoading === modeLoading) {
            return prev; // No change
          }
          return {
            ...prev,
            isLoading: modeLoading,
          };
        });
      }
    };

    // Check immediately
    checkWalletState();

    // Poll for changes (reduced frequency to prevent excessive re-renders)
    const interval = setInterval(checkWalletState, 500);

    // Also check on storage events (for cross-tab sync)
    window.addEventListener('storage', checkWalletState);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', checkWalletState);
    };
  }, [modeLoading]);

  // Stop loading after timeout
  useEffect(() => {
    const timeout = setTimeout(() => {
      setState(prev => ({ ...prev, isLoading: false }));
    }, 3000);
    return () => clearTimeout(timeout);
  }, []);

  // Login handler - uses window functions
  const login = useCallback(async () => {
    if (typeof window === 'undefined') return;

    // Try user functions first (from DemoUserContext or UserContext)
    const userFuncs = (window as Window & {
      __BERIGHT_USER_FUNCS__?: { login?: () => Promise<void> };
    }).__BERIGHT_USER_FUNCS__;

    if (userFuncs?.login) {
      await userFuncs.login();
      return;
    }

    // Fallback to wallet functions
    const walletFuncs = (window as Window & {
      __BERIGHT_WALLET_FUNCS__?: { login?: () => Promise<void> };
    }).__BERIGHT_WALLET_FUNCS__;

    if (walletFuncs?.login) {
      await walletFuncs.login();
    }
  }, []);

  // Logout handler - uses window functions
  const logout = useCallback(async () => {
    if (typeof window === 'undefined') return;

    // Try user functions first
    const userFuncs = (window as Window & {
      __BERIGHT_USER_FUNCS__?: { logout?: () => Promise<void> };
    }).__BERIGHT_USER_FUNCS__;

    if (userFuncs?.logout) {
      await userFuncs.logout();
      return;
    }

    // Fallback to wallet functions
    const walletFuncs = (window as Window & {
      __BERIGHT_WALLET_FUNCS__?: { disconnect?: () => Promise<void> };
    }).__BERIGHT_WALLET_FUNCS__;

    if (walletFuncs?.disconnect) {
      await walletFuncs.disconnect();
    }
  }, []);

  // Memoize user profile to prevent creating new object on every render
  const user = useMemo((): UserProfile | null => {
    if (!state.isAuthenticated || !state.walletAddress) return null;
    return {
      id: `${isDemo ? 'demo' : 'prod'}-${state.walletAddress}`,
      walletAddress: state.walletAddress,
      email: null,
      phone: null,
      telegramId: null,
      username: `${state.walletAddress.slice(0, 6)}...${state.walletAddress.slice(-4)}`,
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
    };
  }, [state.isAuthenticated, state.walletAddress, isDemo]);

  // Memoize referral code
  const referralCode = useMemo(() => {
    return state.walletAddress
      ? `BR${state.walletAddress.slice(0, 6).toUpperCase()}`
      : null;
  }, [state.walletAddress]);

  // Memoize return object to prevent creating new reference on every render
  return useMemo(() => ({
    user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading || modeLoading,
    login,
    logout,
    walletAddress: state.walletAddress,
    linkTelegram: async () => {},
    refreshProfile: async () => {},
    refreshUser: async () => {},
    referralCode,
  }), [user, state.isAuthenticated, state.isLoading, modeLoading, login, logout, state.walletAddress, referralCode]);
}

// Default export for convenience
export default useUser;
