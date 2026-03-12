'use client';

import PrivyProvider from '@/providers/PrivyProvider';
import { UserProvider } from '@/context/UserContext';
import { OnboardingWrapper } from '@/components/Onboarding';

interface ProvidersProps {
  children: React.ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <PrivyProvider>
      <UserProvider>
        {children}
        <OnboardingWrapper />
      </UserProvider>
    </PrivyProvider>
  );
}
