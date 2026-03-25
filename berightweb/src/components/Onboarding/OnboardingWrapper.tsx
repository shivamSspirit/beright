'use client';

import { usePathname } from 'next/navigation';
import OnboardingModal, { useOnboarding } from './OnboardingModal';

// Pages where onboarding should NOT show
const EXCLUDED_PATHS = [
  '/docs',
  '/docs/',
  '/landing',
  '/coming-soon',
  '/embed',
  '/', // Don't show on landing page
];

interface OnboardingWrapperProps {
  isAuthenticated?: boolean;
  walletAddress?: string | null;
}

export default function OnboardingWrapper({ isAuthenticated = false, walletAddress = null }: OnboardingWrapperProps) {
  const pathname = usePathname();
  const {
    hasCompletedOnboarding,
    showOnboarding,
    completeOnboarding,
    closeOnboarding,
  } = useOnboarding();

  // Don't show onboarding on excluded paths
  const shouldShow = !EXCLUDED_PATHS.some(path => pathname?.startsWith(path));

  // Only show if:
  // 1. Not on excluded path
  // 2. User hasn't completed onboarding
  // 3. Onboarding state is ready (not null)
  const displayOnboarding = shouldShow && showOnboarding && hasCompletedOnboarding === false;

  return (
    <OnboardingModal
      isOpen={displayOnboarding}
      onClose={closeOnboarding}
      onComplete={completeOnboarding}
      walletAddress={walletAddress}
    />
  );
}
