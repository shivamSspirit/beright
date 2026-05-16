'use client';

import ErrorBoundary from '@/components/ErrorBoundary';

export default function MarketsError({
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
      title="Failed to load markets"
      description="We couldn't load the prediction markets. This might be a temporary issue with our data providers."
    />
  );
}
