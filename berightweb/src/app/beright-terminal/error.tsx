'use client';

import ErrorBoundary from '@/components/ErrorBoundary';

export default function TerminalError({
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
      title="Terminal connection lost"
      description="The BeRight Terminal encountered an error. Please try reconnecting."
    />
  );
}
