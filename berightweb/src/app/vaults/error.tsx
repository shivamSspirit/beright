'use client';

import ErrorBoundary from '@/components/ErrorBoundary';

export default function VaultsError({
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
      title="Failed to load vaults"
      description="We couldn't load the yield vaults. This might be a connection issue with our yield providers."
    />
  );
}
