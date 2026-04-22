'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '@/hooks/useUnifiedUser';
import { useMarkets } from '@/hooks/useMarkets';
import { usePredictions } from '@/hooks/usePredictions';
import { useMode } from '@/context/ModeContext';
import { PageWrapper } from '@/components/ui';
import SwipeCards from '@/components/SwipeCards';
import LandingPage from '@/components/LandingPage';
import OnboardingTour from '@/components/OnboardingTour';
import RestartTourButton from '@/components/RestartTourButton';
import { getTourSteps } from '@/config/tour-steps';
import { Prediction } from '@/lib/types';
import styles from './page.module.css';

// Home page - Shows landing page (unauthenticated) or swipe cards (authenticated)

export default function Home() {
  const { isAuthenticated, isLoading: authLoading, walletAddress } = useUser();
  const { predictions, loading: marketsLoading } = useMarkets({
    mode: 'hot',  // Jupiter markets only (Solana-native)
    limit: 20
  });
  const { savePrediction, isDemo } = usePredictions(walletAddress);
  const { isDemo: isDemoMode } = useMode();

  // Tour setup - MUST be at top level before any returns
  const tourSteps = useMemo(() => {
    try {
      return getTourSteps('home');
    } catch (error) {
      console.error('[Home] Error loading tour steps:', error);
      return [];
    }
  }, []);

  // Home (SwipeCards) should behave like an "app shell" with internal interactions only.
  // Lock the document scroll so the fixed global chrome (Header/BottomNav) doesn't cause
  // the card stack / action UI to slide behind it on mobile.
  useEffect(() => {
    if (!isAuthenticated) return;
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
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && isDemoMode && tourSteps.length > 0) {
      console.log('[Home] Tour conditions:', {
        isAuthenticated,
        isDemoMode,
        tourStepsCount: tourSteps.length,
        willShowTour: true,
      });
    }
  }, [isAuthenticated, isDemoMode, tourSteps.length]);

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

  // Log markets count for debugging
  useEffect(() => {
    if (predictions.length > 0) {
      console.log(`[Markets] Jupiter: ${predictions.length} markets loaded`);
    }
  }, [predictions.length]);

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
      {/* Onboarding Tour - only in demo mode */}
      {isAuthenticated && isDemoMode && tourSteps.length > 0 && (
        <OnboardingTour
          steps={tourSteps}
          storageKey="beright-home-tour-completed"
          onComplete={() => console.log('[Home] Tour completed!')}
          forceShow={false}
          debug={true}
        />
      )}

      {/* Restart tour button - only in demo mode */}
      {isAuthenticated && isDemoMode && (
        <RestartTourButton
          storageKey="beright-home-tour-completed"
          ariaLabel="Restart home page tour"
        />
      )}

      <SwipeCards
        predictions={predictions}
        onVote={handleVote}
      />
    </PageWrapper>
  );
}
