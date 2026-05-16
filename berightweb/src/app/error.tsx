'use client';

import ErrorBoundary from '@/components/ErrorBoundary';

export default function GlobalError({
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
      title="Oops! Something went wrong"
      description="We encountered an unexpected error. Don't worry, you can try again or head back to the home page."
    />
  );
}
