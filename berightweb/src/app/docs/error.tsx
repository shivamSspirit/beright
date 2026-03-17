'use client';

import ErrorBoundary from '@/components/ErrorBoundary';

export default function DocsError({
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
      title="Documentation unavailable"
      description="We couldn't load the documentation. Please try again."
    />
  );
}
