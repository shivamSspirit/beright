'use client';

import { useUser } from '@/context/UserContext';
import { useMarkets } from '@/hooks/useMarkets';
import SwipeCards from '@/components/SwipeCards';
import LandingPage from '@/components/LandingPage';

// ═══════════════════════════════════════════════════════════════════════════════
// BERIGHT HOME - Landing (before login) / Swipe Cards (after login)
// Variant Design System - Direct HTML replica
// ═══════════════════════════════════════════════════════════════════════════════

export default function Home() {
  const { isAuthenticated, isLoading: authLoading } = useUser();
  const { predictions, loading: marketsLoading } = useMarkets({ mode: 'hot', limit: 10, preferDFlow: true });

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <style jsx>{`
          .app-loading {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #080C14;
          }
          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(0, 194, 255, 0.2);
            border-top-color: #00C2FF;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // NOT LOGGED IN - Show landing page
  if (!isAuthenticated) {
    return <LandingPage />;
  }

  // LOGGED IN - Show swipe cards
  if (marketsLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <p style={{ color: '#94A3B8', marginTop: 16 }}>Loading predictions...</p>
        <style jsx>{`
          .app-loading {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #080C14;
          }
          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(0, 194, 255, 0.2);
            border-top-color: #00C2FF;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div className="no-predictions">
        <p>No predictions available right now.</p>
        <p>Check back soon!</p>
        <style jsx>{`
          .no-predictions {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #080C14;
            color: #94A3B8;
            gap: 8px;
          }
        `}</style>
      </div>
    );
  }

  return (
    <SwipeCards
      predictions={predictions}
      onVote={(prediction, choice) => {
        console.log('Voted:', prediction.question, choice);
      }}
    />
  );
}
