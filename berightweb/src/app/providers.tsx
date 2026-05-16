'use client';

import { ModeProvider, useMode } from '@/context/ModeContext';
import { OnboardingWrapper } from '@/components/Onboarding';
import Header from '@/components/Header';

// Demo mode providers
import { DemoWalletProvider } from '@/providers/DemoWalletProvider';
import { DemoUserProvider, useDemoUser } from '@/context/DemoUserContext';

// Production mode providers
import PrivyProvider from '@/providers/PrivyProvider';
import { UserProvider, useUser as usePrivyUser } from '@/context/UserContext';

interface ProvidersProps {
  children: React.ReactNode;
}

/**
 * Inner content wrapper that shows Header based on auth state
 * Uses the appropriate user hook based on mode
 */
function DemoAppContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, walletAddress } = useDemoUser();

  return (
    <>
      {isAuthenticated && (
        <Header
          isAuthenticated={isAuthenticated}
          isLoading={isLoading}
          walletAddress={walletAddress}
        />
      )}
      {isAuthenticated && <div style={{ height: 'var(--app-header-height)' }} />}
      {children}
      <OnboardingWrapper isAuthenticated={isAuthenticated} walletAddress={walletAddress} />
    </>
  );
}

function ProductionAppContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, walletAddress } = usePrivyUser();

  return (
    <>
      {isAuthenticated && (
        <Header
          isAuthenticated={isAuthenticated}
          isLoading={isLoading}
          walletAddress={walletAddress}
        />
      )}
      {isAuthenticated && <div style={{ height: 'var(--app-header-height)' }} />}
      {children}
      <OnboardingWrapper isAuthenticated={isAuthenticated} walletAddress={walletAddress} />
    </>
  );
}

/**
 * Demo mode provider stack
 * Uses the Jupiter wallet adapter flow for demo wallet connections
 */
function DemoProviders({ children }: { children: React.ReactNode }) {
  return (
    <DemoWalletProvider>
      <DemoUserProvider>
        <DemoAppContent>{children}</DemoAppContent>
      </DemoUserProvider>
    </DemoWalletProvider>
  );
}

/**
 * Production mode provider stack
 * Uses Privy for social login + wallet connections
 */
function ProductionProviders({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider>
      <UserProvider>
        <ProductionAppContent>{children}</ProductionAppContent>
      </UserProvider>
    </PrivyProvider>
  );
}

/**
 * Mode-aware provider switch
 * Renders either Demo or Production provider stack based on mode
 */
function ModeAwareProviders({ children }: { children: React.ReactNode }) {
  const { isDemo, isLoading } = useMode();

  // Show nothing while mode is loading to prevent flash
  if (isLoading) {
    return null;
  }

  if (isDemo) {
    console.log('[Providers] Using Demo mode (Jupiter wallet adapter)');
    return <DemoProviders>{children}</DemoProviders>;
  }

  console.log('[Providers] Using Production mode (Privy)');
  return <ProductionProviders>{children}</ProductionProviders>;
}

/**
 * Root providers component
 * ModeProvider must be outermost to allow mode detection before provider selection
 */
export default function Providers({ children }: ProvidersProps) {
  return (
    <ModeProvider>
      <ModeAwareProviders>{children}</ModeAwareProviders>
    </ModeProvider>
  );
}
