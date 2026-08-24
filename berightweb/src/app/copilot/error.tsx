'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import styles from './copilot.module.css';

export default function CopilotError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className={styles.routeError}>
      <div className={styles.routeErrorCard} role="alert">
        <AlertTriangle size={28} aria-hidden="true" />
        <h1>Copilot couldn’t open</h1>
        <p>No trade was prepared or submitted. Retry the conversation workspace.</p>
        <button type="button" onClick={reset}>
          <RefreshCw size={16} aria-hidden="true" />
          Try again
        </button>
      </div>
    </main>
  );
}
