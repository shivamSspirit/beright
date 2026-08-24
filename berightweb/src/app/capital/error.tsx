'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import styles from './capital.module.css';

export default function CapitalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className={styles.routeError}>
      <div className={styles.routeErrorCard} role="alert">
        <AlertTriangle size={28} aria-hidden="true" />
        <h1>Capital couldn’t open</h1>
        <p>No transaction was prepared by this page error. Check your wallet activity before retrying.</p>
        <button type="button" onClick={reset}>
          <RefreshCw size={16} aria-hidden="true" />
          Try again
        </button>
      </div>
    </main>
  );
}
