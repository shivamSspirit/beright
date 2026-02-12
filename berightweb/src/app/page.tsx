'use client';

import { useState, useMemo } from 'react';
import CardStack from '@/components/CardStack';
import BottomNav from '@/components/BottomNav';
import MoodPills, { MoodFilter, filterByMood, getMoodCounts } from '@/components/MoodPills';
import { useMarkets } from '@/hooks/useMarkets';

// Simple loading state
function LoadingState() {
  return (
    <div className="loading-container">
      <div className="loading-card">
        <div className="loading-shimmer" />
        <div className="loading-pulse" />
      </div>
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
      <p className="empty-title">No {moodLabels[mood]} markets</p>
      <p className="empty-desc">Try another filter</p>
      <button onClick={onReset} className="reset-btn">
        Show All
      </button>
    </div>
  );
}

export default function Home() {
  const [selectedMood, setSelectedMood] = useState<MoodFilter>('all');

  const { predictions, loading, error, refetch } = useMarkets({
    mode: 'dflow',
    limit: 50,
    useMockOnError: true,
  });

  // Filter predictions based on selected mood
  const filteredPredictions = useMemo(() => {
    return filterByMood(predictions, selectedMood);
  }, [predictions, selectedMood]);

  // Get counts for each mood filter
  const moodCounts = useMemo(() => {
    return getMoodCounts(predictions);
  }, [predictions]);

  // Handle mood selection
  const handleMoodSelect = (mood: MoodFilter) => {
    if (navigator.vibrate) navigator.vibrate(5);
    setSelectedMood(mood);
  };

  return (
    <div className="home-page">
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
          background: var(--bg, #0a0a0a);
          display: flex;
          flex-direction: column;
        }

        /* Filter Section */
        .filter-section {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 50;
          padding: 12px 16px;
          padding-top: calc(env(safe-area-inset-top, 0px) + 12px);
          background: linear-gradient(180deg, var(--bg, #0a0a0a) 0%, rgba(10, 10, 10, 0.95) 100%);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
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
          padding-top: calc(60px + env(safe-area-inset-top, 0px) + 16px);
          padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px) + 16px);
        }

        /* Loading State */
        .loading-container {
          width: 100%;
          max-width: 380px;
          padding: 0 12px;
        }

        .loading-card {
          width: 100%;
          height: 480px;
          background: var(--card-bg, #111);
          border-radius: 20px;
          position: relative;
          overflow: hidden;
        }

        .loading-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            110deg,
            transparent 25%,
            rgba(255, 255, 255, 0.05) 37%,
            transparent 63%
          );
          animation: shimmer 1.5s ease-in-out infinite;
        }

        .loading-pulse {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        @keyframes pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
          50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.8; }
        }

        /* Error State */
        .error-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 40px 24px;
          background: var(--card-bg, #111);
          border-radius: 20px;
          max-width: 320px;
        }

        .error-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 700;
          color: var(--no, #ff4757);
          background: rgba(255, 71, 87, 0.1);
          border-radius: 50%;
          margin-bottom: 16px;
        }

        .error-message {
          font-size: 15px;
          color: rgba(255, 255, 255, 0.7);
          margin: 0 0 20px;
          line-height: 1.5;
        }

        .retry-btn {
          padding: 12px 24px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .retry-btn:hover {
          background: rgba(255, 255, 255, 0.12);
          transform: scale(1.02);
        }

        /* Empty State */
        .empty-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 40px 24px;
          background: var(--card-bg, #111);
          border-radius: 20px;
          max-width: 320px;
        }

        .empty-title {
          font-size: 17px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 8px;
        }

        .empty-desc {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0 0 24px;
        }

        .reset-btn {
          padding: 12px 24px;
          background: rgba(0, 255, 159, 0.1);
          border: 1px solid rgba(0, 255, 159, 0.2);
          border-radius: 12px;
          color: var(--yes, #00ff9f);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .reset-btn:hover {
          background: rgba(0, 255, 159, 0.15);
          transform: scale(1.02);
        }

        /* Responsive */
        @media (max-width: 359px) {
          .filter-section {
            padding: 10px 12px;
            padding-top: calc(env(safe-area-inset-top, 0px) + 10px);
          }

          .main-content {
            padding: 12px 8px;
            padding-top: calc(55px + env(safe-area-inset-top, 0px) + 12px);
            padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px) + 12px);
          }

          .loading-card {
            height: 420px;
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
            padding-top: 8px;
          }

          .main-content {
            padding-top: calc(50px + 10px);
            padding-bottom: calc(56px + 10px);
          }
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .loading-shimmer,
          .loading-pulse {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
