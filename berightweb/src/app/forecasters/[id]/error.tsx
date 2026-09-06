'use client';

import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { PageWrapper } from '@/components/ui';
import styles from './page.module.css';

export default function ForecasterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isConnectionError =
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('fetch failed') ||
    error.message.includes('Cannot reach');

  const message = isConnectionError
    ? 'The BeRight API is not reachable. Make sure beright-ts is running on port 3001.'
    : 'Failed to load forecaster passport. The service may be temporarily unavailable.';

  return (
    <PageWrapper showHeader={false} showFooter={false}>
      <main className={styles.page}>
        <section className={styles.shell}>
          <header className={styles.topbar}>
            <Link href="/leaderboard" className={styles.backLink}>
              <ArrowLeft size={16} aria-hidden="true" />
              Leaderboard
            </Link>
          </header>

          <div className={styles.warning} role="alert">
            <AlertTriangle size={18} aria-hidden="true" />
            {message}
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
            <button onClick={reset} className={styles.backLink}>
              Try again
            </button>
            <Link href="/leaderboard" className={styles.backLink}>
              Back to leaderboard
            </Link>
          </div>
        </section>
      </main>
    </PageWrapper>
  );
}
