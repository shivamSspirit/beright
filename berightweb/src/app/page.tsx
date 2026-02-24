'use client';

import { useState, useMemo, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import CardStack from '@/components/CardStack';
import BottomNav from '@/components/BottomNav';
import MoodPills, { MoodFilter, filterByMood, getMoodCounts } from '@/components/MoodPills';
import LandingHero from '@/components/LandingHero';
import GameHeader from '@/components/GameHeader';
import { useMarkets } from '@/hooks/useMarkets';

// ============ CONSTANTS ============

const STORAGE_KEY_VISITED = 'beright_has_visited';

// Simple loading state
function LoadingState() {
  return (
    <div className="loading-container">
      <div className="loading-card">
        <div className="loading-shimmer" />
        <div className="loading-pulse" />
      </div>
      <p className="loading-text">Finding hot markets...</p>
    </div>
  );
}

// Error state
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="error-container">
      <div className="error-icon">!</div>
      <p className="error-message">{message}</p>
      <button onClick={onRetry} className="retry-btn">
        Try Again
      </button>
    </div>
  );
}

// Empty filter state
function EmptyFilterState({ mood, onReset }: { mood: MoodFilter; onReset: () => void }) {
  const moodLabels: Record<MoodFilter, string> = {
    all: 'All',
    hot: 'Hot',
    easy: 'Easy Money',
    soon: 'Closing Soon',
    risky: 'Risky',
    'ai-edge': 'AI Edge',
    crypto: 'Crypto',
    politics: 'Politics',
  };

  return (
    <div className="empty-container">
      <div className="empty-icon">🎯</div>
      <p className="empty-title">No {moodLabels[mood]} markets</p>
      <p className="empty-desc">Try another filter to find predictions</p>
      <button onClick={onReset} className="reset-btn">
        Show All Markets
      </button>
    </div>
  );
}

// Empty leaderboard state (for reuse)
function EmptyLeaderboardState() {
  return (
    <div className="empty-container">
      <div className="empty-icon">🏆</div>
      <p className="empty-title">Be the first legend</p>
      <p className="empty-desc">Make your first prediction to claim the top spot</p>
      <button className="glow-btn">
        Start Predicting
      </button>
    </div>
  );
}

export default function Home() {
  const [selectedMood, setSelectedMood] = useState<MoodFilter>('all');
  const [showTransition, setShowTransition] = useState(false);

  // Privy authentication
  const { ready, authenticated } = usePrivy();

  const { predictions, loading, error, refetch } = useMarkets({
    mode: 'dflow',
    limit: 50,
    useMockOnError: true,
  });

  // Sort predictions to show close odds (tension) first for better engagement
  const sortedPredictions = useMemo(() => {
    return [...predictions].sort((a, b) => {
      // Calculate "tension score" - closer to 50% = more tension
      const tensionA = 50 - Math.abs(50 - a.marketOdds);
      const tensionB = 50 - Math.abs(50 - b.marketOdds);
      // Sort by tension (highest first), with some randomness for variety
      return tensionB - tensionA;
    });
  }, [predictions]);

  // ============ Auto-open Privy on first visit ============
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!ready) return;

    if (authenticated) {
      try {
        localStorage.setItem(STORAGE_KEY_VISITED, 'true');
        // Trigger transition animation
        setShowTransition(true);
        setTimeout(() => setShowTransition(false), 500);
      } catch {
        // Ignore storage errors
      }
    }
  }, [ready, authenticated]);

  // Filter predictions based on selected mood
  const filteredPredictions = useMemo(() => {
    return filterByMood(sortedPredictions, selectedMood);
  }, [sortedPredictions, selectedMood]);

  // Get counts for each mood filter
  const moodCounts = useMemo(() => {
    return getMoodCounts(sortedPredictions);
  }, [sortedPredictions]);

  // Handle mood selection
  const handleMoodSelect = (mood: MoodFilter) => {
    if (navigator.vibrate) navigator.vibrate(5);
    setSelectedMood(mood);
  };

  // Show landing hero for unauthenticated users
  if (!authenticated && ready) {
    return <LandingHero />;
  }

  // Show loading while Privy initializes
  if (!ready) {
    return (
      <div className="init-loading">
        <div className="init-logo">
          <span className="logo-icon">🎯</span>
          <span className="logo-text">BeRight</span>
        </div>
        <div className="init-spinner" />
      </div>
    );
  }

  return (
    <div className={`home-page ${showTransition ? 'transitioning' : ''}`}>
      {/* Game Header with streak/XP */}
      <GameHeader />

      {/* Filter Pills */}
      {!loading && predictions.length > 0 && (
        <div className="filter-section">
          <MoodPills
            selected={selectedMood}
            onSelect={handleMoodSelect}
            counts={moodCounts}
          />
        </div>
      )}

      {/* Main Content */}
      <main className="main-content">
        {loading ? (
          <LoadingState />
        ) : error && predictions.length === 0 ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : filteredPredictions.length > 0 ? (
          <CardStack predictions={filteredPredictions} key={selectedMood} />
        ) : selectedMood !== 'all' ? (
          <EmptyFilterState
            mood={selectedMood}
            onReset={() => setSelectedMood('all')}
          />
        ) : (
          <ErrorState message="No predictions available" onRetry={refetch} />
        )}
      </main>

      <BottomNav />

      <style jsx global>{`
        .home-page {
          min-height: 100dvh;
          background: #030305;
          display: flex;
          flex-direction: column;
          transition: opacity 0.3s ease;
        }

        .home-page.transitioning {
          animation: fadeIn 0.5s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.98);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* Init Loading */
        .init-loading {
          min-height: 100dvh;
          background: #030305;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 24px;
        }

        .init-logo {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo-icon {
          font-size: 40px;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .logo-text {
          font-size: 32px;
          font-weight: 800;
          color: #fff;
          font-family: 'Outfit', sans-serif;
          letter-spacing: -1px;
        }

        .init-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(0, 230, 118, 0.2);
          border-top-color: #00E676;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Filter Section */
        .filter-section {
          position: fixed;
          top: 56px;
          left: 0;
          right: 0;
          z-index: 50;
          padding: 12px 16px;
          padding-top: calc(env(safe-area-inset-top, 0px) + 12px);
          background: linear-gradient(180deg, rgba(3, 3, 5, 0.98) 0%, rgba(3, 3, 5, 0.9) 100%);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        /* Main Content */
        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          max-width: 500px;
          margin: 0 auto;
          padding: 16px 12px;
          padding-top: calc(110px + env(safe-area-inset-top, 0px) + 16px);
          padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px) + 16px);
        }

        /* Loading State */
        .loading-container {
          width: 100%;
          max-width: 380px;
          padding: 0 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }

        .loading-card {
          width: 100%;
          height: 480px;
          background: linear-gradient(165deg, #0F0F1A 0%, #0A0A14 100%);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 24px;
          position: relative;
          overflow: hidden;
        }

        .loading-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            110deg,
            transparent 25%,
            rgba(255, 255, 255, 0.03) 37%,
            transparent 63%
          );
          animation: shimmer 2s ease-in-out infinite;
        }

        .loading-pulse {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(0, 230, 118, 0.2) 0%, transparent 70%);
          animation: loadPulse 1.5s ease-in-out infinite;
        }

        .loading-text {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.4);
          margin: 0;
          animation: fadeInOut 2s ease-in-out infinite;
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        @keyframes loadPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
          50% { transform: translate(-50%, -50%) scale(1.3); opacity: 1; }
        }

        @keyframes fadeInOut {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }

        /* Error State */
        .error-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 48px 28px;
          background: linear-gradient(165deg, #0F0F1A 0%, #0A0A14 100%);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 24px;
          max-width: 340px;
        }

        .error-icon {
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 800;
          color: #FF5252;
          background: rgba(255, 82, 82, 0.12);
          border: 1px solid rgba(255, 82, 82, 0.25);
          border-radius: 16px;
          margin-bottom: 20px;
        }

        .error-message {
          font-size: 15px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0 0 24px;
          line-height: 1.5;
        }

        .retry-btn {
          padding: 14px 28px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .retry-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px);
        }

        .retry-btn:active {
          transform: translateY(0);
        }

        /* Empty State */
        .empty-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 48px 28px;
          background: linear-gradient(165deg, #0F0F1A 0%, #0A0A14 100%);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 24px;
          max-width: 340px;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .empty-title {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 8px;
        }

        .empty-desc {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0 0 24px;
          line-height: 1.5;
        }

        .reset-btn {
          padding: 14px 28px;
          background: rgba(0, 230, 118, 0.1);
          border: 1px solid rgba(0, 230, 118, 0.25);
          border-radius: 14px;
          color: #00E676;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .reset-btn:hover {
          background: rgba(0, 230, 118, 0.15);
          border-color: rgba(0, 230, 118, 0.4);
          box-shadow: 0 4px 20px rgba(0, 230, 118, 0.2);
          transform: translateY(-1px);
        }

        .reset-btn:active {
          transform: translateY(0);
        }

        .glow-btn {
          padding: 16px 32px;
          background: linear-gradient(135deg, #00E676 0%, #00C853 100%);
          border: none;
          border-radius: 14px;
          color: #000;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
          font-family: inherit;
          position: relative;
          overflow: hidden;
        }

        .glow-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 200%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.3) 50%,
            transparent 100%
          );
          animation: btnShine 3s ease-in-out infinite;
        }

        @keyframes btnShine {
          0% { left: -100%; }
          20% { left: 100%; }
          100% { left: 100%; }
        }

        .glow-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(0, 230, 118, 0.4);
        }

        /* Responsive */
        @media (max-width: 359px) {
          .filter-section {
            top: 50px;
            padding: 10px 12px;
            padding-top: calc(env(safe-area-inset-top, 0px) + 10px);
          }

          .main-content {
            padding: 12px 8px;
            padding-top: calc(100px + env(safe-area-inset-top, 0px) + 12px);
            padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px) + 12px);
          }

          .loading-card {
            height: 420px;
            border-radius: 20px;
          }

          .error-container,
          .empty-container {
            padding: 36px 20px;
            border-radius: 20px;
          }
        }

        @media (min-width: 640px) {
          .main-content {
            max-width: 420px;
          }
        }

        @media (min-width: 768px) {
          .main-content {
            max-width: 440px;
          }
        }

        /* Landscape */
        @media (max-height: 500px) and (orientation: landscape) {
          .filter-section {
            top: 46px;
            padding-top: 8px;
          }

          .main-content {
            padding-top: calc(90px + 10px);
            padding-bottom: calc(56px + 10px);
          }
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .loading-shimmer,
          .loading-pulse,
          .loading-text,
          .logo-icon,
          .init-spinner,
          .glow-btn::before {
            animation: none;
          }

          .home-page.transitioning {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
