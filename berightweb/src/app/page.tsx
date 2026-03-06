'use client';

import { useUser } from '@/context/UserContext';
import { useMarkets } from '@/hooks/useMarkets';
import CardStack from '@/components/CardStack';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import LandingHero from '@/components/LandingHero';

// ═══════════════════════════════════════════════════════════════════════════════
// BERIGHT HOME - Landing (before login) / Swipe Cards (after login)
// ═══════════════════════════════════════════════════════════════════════════════

export default function Home() {
  const { isAuthenticated, isLoading: authLoading } = useUser();
  const { predictions, loading: marketsLoading } = useMarkets({ mode: 'hot', limit: 10 });

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
    return <LandingHero />;
  }

  // LOGGED IN - Show swipe cards
  return (
    <>
      <Header />
      <main className="app-main">
        {marketsLoading ? (
          <div className="markets-loading">
            <div className="loading-spinner" />
            <p>Loading predictions...</p>
          </div>
        ) : predictions.length > 0 ? (
          <CardStack
            predictions={predictions}
            onComplete={(results) => {
              console.log('Session complete:', results);
            }}
          />
        ) : (
          <div className="no-predictions">
            <p>No predictions available right now.</p>
            <p>Check back soon!</p>
          </div>
        )}
      </main>
      <BottomNav />

      <style jsx>{`
        .app-main {
          min-height: 100vh;
          padding-top: 80px;
          padding-bottom: 80px;
          background: #080C14;
        }
        .markets-loading,
        .no-predictions {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
          color: #94A3B8;
          gap: 16px;
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
    </>
  );
}
