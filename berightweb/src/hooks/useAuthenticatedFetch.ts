'use client';

import { useUser } from '@/hooks/useUnifiedUser';
import { useMode } from '@/context/ModeContext';
import { useProductionAccess } from './useProductionAccess';

/**
 * Hook to create an authenticated fetch function with mode and user headers
 *
 * Includes:
 * - x-beright-mode: The effective mode (respects access control)
 * - x-beright-network: The network (devnet/mainnet-beta)
 * - x-user-email: The user's email for backend access validation
 * - x-wallet-address: The user's wallet address
 *
 * This ensures backend can validate mode access even if someone tries to bypass frontend
 */
export function useAuthenticatedFetch() {
  const { user, walletAddress } = useUser();
  const { mode } = useMode();
  const { effectiveMode } = useProductionAccess();

  return async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers);

    // Set mode headers (use effective mode that respects access control)
    headers.set('x-beright-mode', effectiveMode);
    headers.set('x-beright-network', effectiveMode === 'production' ? 'mainnet-beta' : 'devnet');

    // Set user identity headers for backend validation
    if (user?.email) {
      headers.set('x-user-email', user.email);
    }
    if (walletAddress) {
      headers.set('x-wallet-address', walletAddress);
    }

    return fetch(url, {
      ...options,
      headers,
    });
  };
}

/**
 * Simple wrapper to get headers object with auth + mode info
 * Use this when you need to manually construct requests
 */
export function useAuthHeaders(): () => Record<string, string> {
  const { user, walletAddress } = useUser();
  const { effectiveMode } = useProductionAccess();

  return () => {
    const headers: Record<string, string> = {
      'x-beright-mode': effectiveMode,
      'x-beright-network': effectiveMode === 'production' ? 'mainnet-beta' : 'devnet',
    };

    if (user?.email) {
      headers['x-user-email'] = user.email;
    }
    if (walletAddress) {
      headers['x-wallet-address'] = walletAddress;
    }

    return headers;
  };
}
