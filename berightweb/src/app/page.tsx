'use client';

import { useEffect, useCallback } from 'react';
import { useMarkets } from '@/hooks/useMarkets';
import { usePredictions } from '@/hooks/usePredictions';
import { PageWrapper } from '@/components/ui';
import SwipeCards from '@/components/SwipeCards';
import { Prediction } from '@/lib/types';
import styles from './page.module.css';

export default function Home() {
  const { predictions, loading: marketsLoading, refetch } = useMarkets({
    mode: 'hot',  // Jupiter markets only (Solana-native)
    limit: 20
  });
  const { savePrediction, isLocal } = usePredictions(null);

  // Home (SwipeCards) should behave like an "app shell" with internal interactions only.
  // Lock the document scroll so the fixed global chrome (Header/BottomNav) doesn't cause
  // the card stack / action UI to slide behind it on mobile.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const scrollY = window.scrollY;
    const html = document.documentElement;
    const body = document.body;

    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyPosition = body.style.position;
    const prevBodyTop = body.style.top;
    const prevBodyWidth = body.style.width;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.position = prevBodyPosition;
      body.style.top = prevBodyTop;
      body.style.width = prevBodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, []);

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
      console.log('[Vote] Prediction saved:', saved.id, isLocal ? '(local)' : '(production)');
    } else {
      console.error('[Vote] Failed to save prediction');
    }
  }, [savePrediction, isLocal]);

  // Log markets count for debugging
  useEffect(() => {
    if (predictions.length > 0) {
      console.log(`[Markets] Jupiter: ${predictions.length} markets loaded`);
    }
  }, [predictions.length]);

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
          <button className={styles.retryButton} type="button" onClick={() => void refetch()}>
            Try again
          </button>
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
