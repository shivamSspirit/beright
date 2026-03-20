'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

// ============================================
// TYPES
// ============================================

export type AppMode = 'demo' | 'production';

interface ModeInfo {
  mode: AppMode;
  network: 'devnet' | 'mainnet-beta';
  networkLabel: string;
  tradingMode: 'paper' | 'live';
  showWaitlist: boolean;
  features: {
    trading: boolean;
    predictions: boolean;
    leaderboard: boolean;
    agents: boolean;
  };
}

interface ModeContextType {
  mode: AppMode;
  isDemo: boolean;
  isProduction: boolean;
  network: 'devnet' | 'mainnet-beta';
  networkLabel: string;
  tradingMode: 'paper' | 'live';
  showWaitlist: boolean;
  features: ModeInfo['features'];
  isLoading: boolean;
  error: string | null;
  // Toggle functionality
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
}

// ============================================
// DEFAULT VALUES
// ============================================

const DEFAULT_MODE_INFO: ModeInfo = {
  mode: 'demo',
  network: 'devnet',
  networkLabel: 'Devnet',
  tradingMode: 'paper',
  showWaitlist: true,
  features: {
    trading: true,
    predictions: true,
    leaderboard: true,
    agents: true,
  },
};

// ============================================
// CONTEXT
// ============================================

const ModeContext = createContext<ModeContextType | undefined>(undefined);

// ============================================
// CONSTANTS
// ============================================

const MODE_STORAGE_KEY = 'beright_mode';

// ============================================
// PROVIDER
// ============================================

export function ModeProvider({ children }: { children: ReactNode }) {
  const [modeInfo, setModeInfo] = useState<ModeInfo>(DEFAULT_MODE_INFO);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to update mode info based on mode (defined first so it can be used in useEffect)
  const applyModeInfo = useCallback((mode: AppMode) => {
    if (mode === 'production') {
      setModeInfo({
        mode: 'production',
        network: 'mainnet-beta',
        networkLabel: 'Mainnet',
        tradingMode: 'live',
        showWaitlist: false,
        features: {
          trading: true,
          predictions: true,
          leaderboard: true,
          agents: true,
        },
      });
    } else {
      setModeInfo({
        mode: 'demo',
        network: 'devnet',
        networkLabel: 'Devnet',
        tradingMode: 'paper',
        showWaitlist: true,
        features: {
          trading: true,
          predictions: true,
          leaderboard: true,
          agents: true,
        },
      });
    }
  }, []);

  // Load saved mode from localStorage on mount - FAST initialization
  useEffect(() => {
    // Guard for SSR - localStorage only available on client
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }

    // Priority 1: Check localStorage (fastest - instant)
    const saved = localStorage.getItem(MODE_STORAGE_KEY) as AppMode | null;
    if (saved === 'demo' || saved === 'production') {
      applyModeInfo(saved);
      document.cookie = `beright_mode=${saved};path=/;max-age=31536000`;
      setIsLoading(false);
      return;
    }

    // Priority 2: Check environment variable (instant)
    const envMode = process.env.NEXT_PUBLIC_BERIGHT_MODE;
    if (envMode === 'production') {
      applyModeInfo('production');
      document.cookie = `beright_mode=production;path=/;max-age=31536000`;
      setIsLoading(false);
      return;
    }

    // Priority 3: Default to demo immediately (no API wait)
    // This makes first load instant instead of waiting for API
    applyModeInfo('demo');
    document.cookie = `beright_mode=demo;path=/;max-age=31536000`;
    setIsLoading(false);

    // Background: Optionally sync with API (won't block UI)
    // Commented out since we don't need server-side mode source
    // fetch('/api/v2/mode').then(r => r.json()).catch(() => {});

  }, [applyModeInfo]);

  // Set mode and persist to localStorage + cookie
  const setMode = useCallback((newMode: AppMode) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(MODE_STORAGE_KEY, newMode);
      document.cookie = `beright_mode=${newMode};path=/;max-age=31536000`;
    }
    applyModeInfo(newMode);
  }, [applyModeInfo]);

  // Toggle between demo and production
  const toggleMode = useCallback(() => {
    const newMode = modeInfo.mode === 'demo' ? 'production' : 'demo';
    setMode(newMode);
  }, [modeInfo.mode, setMode]);

  const value: ModeContextType = {
    mode: modeInfo.mode,
    isDemo: modeInfo.mode === 'demo',
    isProduction: modeInfo.mode === 'production',
    network: modeInfo.network,
    networkLabel: modeInfo.networkLabel,
    tradingMode: modeInfo.tradingMode,
    showWaitlist: modeInfo.showWaitlist,
    features: modeInfo.features,
    isLoading,
    error,
    setMode,
    toggleMode,
  };

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

// ============================================
// HOOK
// ============================================

export function useMode(): ModeContextType {
  const context = useContext(ModeContext);
  if (context === undefined) {
    // Return defaults if used outside provider (graceful fallback)
    return {
      mode: 'demo',
      isDemo: true,
      isProduction: false,
      network: 'devnet',
      networkLabel: 'Devnet',
      tradingMode: 'paper',
      showWaitlist: true,
      features: DEFAULT_MODE_INFO.features,
      isLoading: false,
      error: null,
      setMode: () => {},
      toggleMode: () => {},
    };
  }
  return context;
}

// ============================================
// UTILITY HOOKS
// ============================================

/**
 * Check if currently in demo mode
 */
export function useIsDemo(): boolean {
  const { isDemo } = useMode();
  return isDemo;
}

/**
 * Check if waitlist should be shown
 */
export function useShowWaitlist(): boolean {
  const { showWaitlist } = useMode();
  return showWaitlist;
}

/**
 * Get current network label for display
 */
export function useNetworkLabel(): string {
  const { networkLabel } = useMode();
  return networkLabel;
}
