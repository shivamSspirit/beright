'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/hooks/useUnifiedUser';
import { useMarkets } from '@/hooks/useMarkets';
import { usePredictions } from '@/hooks/usePredictions';
import { PageWrapper } from '@/components/ui';
import SwipeCards from '@/components/SwipeCards';
import LandingPage from '@/components/LandingPage';
import { Prediction } from '@/lib/types';
import styles from './page.module.css';

// Home page - Shows landing page (unauthenticated) or swipe cards (authenticated)

export default function Home() {
  const { isAuthenticated, isLoading: authLoading, walletAddress } = useUser();
  const { predictions, loading: marketsLoading, dataSources } = useMarkets({
    mode: 'aggregated',  // Combine DFlow + Jupiter markets
    limit: 20
  });
  const { savePrediction, isDemo } = usePredictions(walletAddress);

  // Handle vote - save prediction to storage with optional on-chain tx signature
  const handleVote = useCallback(async (
    prediction: Prediction,
    choice: 'YES' | 'NO',
    txSignature?: string,
    explorerUrl?: string
  ) => {
    console.log('[Vote]', choice, 'on:', prediction.question, txSignature ? `(tx: ${txSignature.slice(0, 16)}...)` : '');

    // Save prediction with on-chain tx signature if available
    const saved = await savePrediction(prediction, choice, txSignature, explorerUrl);
    if (saved) {
      console.log('[Vote] Prediction saved:', saved.id, isDemo ? '(demo mode - localStorage)' : '(production)');
    } else {
      console.error('[Vote] Failed to save prediction');
    }
  }, [savePrediction, isDemo]);

  // Log data sources for debugging
  useEffect(() => {
    if (dataSources) {
      console.log('[Markets] Sources:', dataSources);
      // Log errors prominently
      if (!dataSources.dflow.success) {
        console.warn('[Markets] DFlow FAILED:', dataSources.dflow.error || 'Unknown error');
      }
      if (!dataSources.jupiter.success) {
        console.warn('[Markets] Jupiter FAILED:', dataSources.jupiter.error || 'Unknown error');
      }
      // Summary
      const dflowStatus = dataSources.dflow.success ? `✓ ${dataSources.dflow.count}` : '✗ FAILED';
      const jupiterStatus = dataSources.jupiter.success ? `✓ ${dataSources.jupiter.count}` : '✗ FAILED';
      console.log(`[Markets] Summary: DFlow(${dflowStatus}), Jupiter(${jupiterStatus})`);
    }
  }, [dataSources]);

  // Emergency timeout - never show loading for more than 3 seconds
  const [forceShow, setForceShow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setForceShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Show loading while checking auth (max 3 seconds)
  if (authLoading && !forceShow) {
    return (
      <PageWrapper showHeader={false} showFooter={false}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner} />
        </div>
      </PageWrapper>
    );
  }

  // NOT LOGGED IN - Show landing page (has its own header/footer)
  if (!isAuthenticated) {
    return (
      <PageWrapper showHeader={false} showFooter={false}>
        <LandingPage />
      </PageWrapper>
    );
  }

  // LOGGED IN - Show swipe cards
  if (marketsLoading) {
    return (
      <PageWrapper showHeader={false} showFooter={false}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner} />
          <p className={styles.loadingText}>Loading predictions...</p>
        </div>
      </PageWrapper>
    );
  }

  if (predictions.length === 0) {
    return (
      <PageWrapper showHeader={false} showFooter={false}>
        <div className={styles.emptyContainer}>
          <p className={styles.emptyText}>No predictions available right now.</p>
          <p className={styles.emptyText}>Check back soon!</p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper showHeader={false} showFooter={false}>
      <SwipeCards
        predictions={predictions}
        onVote={handleVote}
      />
    </PageWrapper>
  );
}
