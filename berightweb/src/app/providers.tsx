'use client';

import PrivyProvider from '@/providers/PrivyProvider';
import { UserProvider, useUser } from '@/context/UserContext';
import { ModeProvider } from '@/context/ModeContext';
import { OnboardingWrapper } from '@/components/Onboarding';
import Header from '@/components/Header';

interface ProvidersProps {
  children: React.ReactNode;
}

/**
 * Inner wrapper that conditionally shows Header based on auth state
 */
function AppContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useUser();

  return (
    <>
      {/* Show Header on all authenticated pages */}
      {isAuthenticated && <Header />}
      {/* Add spacer for fixed header when authenticated */}
      {isAuthenticated && <div style={{ height: '72px' }} />}
      {children}
      <OnboardingWrapper />
    </>
  );
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <ModeProvider>
      <PrivyProvider>
        <UserProvider>
          <AppContent>{children}</AppContent>
        </UserProvider>
      </PrivyProvider>
    </ModeProvider>
  );
}
