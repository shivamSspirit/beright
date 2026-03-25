'use client';

import { useUser } from '@/hooks/useUnifiedUser';
import { useMode, AppMode } from '@/context/ModeContext';

/**
 * Owner email that has access to production mode
 * All other users (wallet-only, other emails, social logins) are restricted to demo mode
 */
const OWNER_EMAIL = process.env.NEXT_PUBLIC_OWNER_EMAIL;

interface ProductionAccessResult {
  /** Whether the current user can access production mode */
  canAccessProduction: boolean;
  /** Whether the mode toggle should be shown */
  canToggle: boolean;
  /** The effective mode (enforced demo for non-owners) */
  effectiveMode: AppMode;
  /** Whether currently in production (only true if owner AND in production mode) */
  isEffectiveProduction: boolean;
  /** Whether currently in demo (always true for non-owners) */
  isEffectiveDemo: boolean;
  /** Original mode from context (before access control) */
  rawMode: AppMode;
}

/**
 * Hook to check production mode access based on user authentication
 *
 * Access Control Logic:
 * - User authenticated with owner email (shivamssoni6@gmail.com) → Full access
 * - User authenticated with different email → Demo mode only
 * - User authenticated via wallet only (no email) → Demo mode only
 * - User not authenticated → Demo mode only
 *
 * @returns ProductionAccessResult with access flags and effective mode
 */
export function useProductionAccess(): ProductionAccessResult {
  const { user, isAuthenticated } = useUser();
  const modeContext = useMode();

  // Check if current user's email matches owner email
  const userEmail = user?.email?.toLowerCase().trim();
  const ownerEmail = OWNER_EMAIL?.toLowerCase().trim();

  // Can access production only if:
  // 1. User is authenticated
  // 2. User has an email (not wallet-only)
  // 3. User's email matches the owner email
  const canAccessProduction = Boolean(
    isAuthenticated &&
    userEmail &&
    ownerEmail &&
    userEmail === ownerEmail
  );

  // Toggle should only be shown to users who can access production
  const canToggle = canAccessProduction;

  // Effective mode: if user can't access production, force demo
  const effectiveMode: AppMode = canAccessProduction
    ? modeContext.mode
    : 'demo';

  return {
    canAccessProduction,
    canToggle,
    effectiveMode,
    isEffectiveProduction: effectiveMode === 'production',
    isEffectiveDemo: effectiveMode === 'demo',
    rawMode: modeContext.mode,
  };
}

/**
 * Simple hook to check if user can access production mode
 * Use this for quick access checks in components
 */
export function useCanAccessProduction(): boolean {
  const { canAccessProduction } = useProductionAccess();
  return canAccessProduction;
}

/**
 * Hook to get the effective mode (respects access control)
 * Use this instead of useMode().mode when you need the enforced mode
 */
export function useEffectiveMode(): AppMode {
  const { effectiveMode } = useProductionAccess();
  return effectiveMode;
}
