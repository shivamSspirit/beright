'use client';

import ErrorBoundary from '@/components/ErrorBoundary';

export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorBoundary
      error={error}
      reset={reset}
      title="Failed to load profile"
      description="We couldn't load your profile data. Make sure you're connected with a wallet."
    />
  );
}
