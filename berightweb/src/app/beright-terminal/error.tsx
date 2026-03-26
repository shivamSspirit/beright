'use client';

import { useEffect } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function TerminalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Log error details to console for debugging
  useEffect(() => {
    console.error('[Terminal Error]', error);
    console.error('[Terminal Error] Stack:', error.stack);
    console.error('[Terminal Error] Message:', error.message);
  }, [error]);

  return (
    <ErrorBoundary
      error={error}
      reset={reset}
      title="Terminal connection lost"
      description="The BeRight Terminal encountered an error. Please try reconnecting."
    />
  );
}
