'use client';

import ErrorBoundary from '@/components/ErrorBoundary';

export default function ForecasterError({
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
      title="Forecaster profile unavailable"
      description="We couldn't load this forecaster's profile. They might not have made any predictions yet."
    />
  );
}
