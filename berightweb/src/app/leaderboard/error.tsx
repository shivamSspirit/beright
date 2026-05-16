'use client';

import ErrorBoundary from '@/components/ErrorBoundary';

export default function LeaderboardError({
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
      title="Failed to load leaderboard"
      description="We couldn't fetch the forecaster rankings. Please try again in a moment."
    />
  );
}
