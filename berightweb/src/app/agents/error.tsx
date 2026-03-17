'use client';

import ErrorBoundary from '@/components/ErrorBoundary';

export default function AgentsError({
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
      title="Agent system unavailable"
      description="The AI agent system encountered an error. Our agents are taking a quick break."
    />
  );
}
