'use client';

import PrivyProvider from '@/providers/PrivyProvider';
import { UserProvider } from '@/context/UserContext';
import { ModeProvider } from '@/context/ModeContext';
import { OnboardingWrapper } from '@/components/Onboarding';
import ModeBanner from '@/components/ModeBanner';

interface ProvidersProps {
  children: React.ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <ModeProvider>
      <PrivyProvider>
        <UserProvider>
          <ModeBanner />
          {children}
          <OnboardingWrapper />
        </UserProvider>
      </PrivyProvider>
    </ModeProvider>
  );
}
