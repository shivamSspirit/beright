'use client';

import { useState, useMemo, useCallback } from 'react';
import { animated, useSpring } from '@react-spring/web';
import CardStack from '@/components/CardStack';
import BottomNav from '@/components/BottomNav';
import MoodPills, { MoodFilter, filterByMood, getMoodCounts } from '@/components/MoodPills';
import {
  DailyChallengeBanner,
  ShareFilterButton,
  useChallenges,
} from '@/components/ViralMechanics';
import { useMarkets } from '@/hooks/useMarkets';
import Link from 'next/link';

// Minimal Header - Just the essentials
function MinimalHeader({ streak, progress }: { streak: number; progress: { done: number; total: number } }) {
  const [spring] = useSpring(() => ({
    from: { opacity: 0, y: -10 },
    to: { opacity: 1, y: 0 },
    config: { tension: 300, friction: 26 },
  }));

  return (
    <animated.header className="home-header" style={spring}>
      <div className="header-content">
        {/* Left - Streak */}
        <div className="streak-pill">
          <span className="streak-fire">🔥</span>
          <span className="streak-count">{streak}</span>
        </div>

        {/* Center - Logo */}
        <Link href="/" className="logo-link">
          <span className="logo-text">BeRight</span>
        </Link>

        {/* Right - Progress */}
        <div className="progress-pill">
          <span className="progress-text">{progress.done}/{progress.total}</span>
          <div className="progress-ring-mini">
            <svg viewBox="0 0 24 24">
              <circle className="ring-bg" cx="12" cy="12" r="10" />
              <circle
                className="ring-fill"
                cx="12"
                cy="12"
                r="10"
                strokeDasharray={62.83}
                strokeDashoffset={62.83 - (62.83 * progress.done / progress.total)}
              />
            </svg>
          </div>
        </div>
      </div>
    </animated.header>
  );
}

// Loading skeleton
function LoadingSkeleton() {
  return (
    <div className="skeleton-container">
      <div className="skeleton-card">
        <div className="skeleton-shimmer" />
        <div className="skeleton-content">
          <div className="skeleton-line short" />
          <div className="skeleton-line long" />
          <div className="skeleton-line medium" />
          <div className="skeleton-circle" />
        </div>
      </div>
    </div>
  );
}

// Error state
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="error-container">
      <span className="error-icon">😕</span>
      <h3 className="error-title">Something went wrong</h3>
      <p className="error-message">{message}</p>
      <button onClick={onRetry} className="retry-btn">
        Try Again
      </button>
    </div>
  );
}

// Empty filter state
function EmptyFilterState({ mood, onReset }: { mood: MoodFilter; onReset: () => void }) {
  const moodLabels: Record<MoodFilter, { emoji: string; label: string }> = {
    all: { emoji: '✨', label: 'All' },
    hot: { emoji: '🔥', label: 'Hot' },
    easy: { emoji: '💰', label: 'Easy Money' },
    soon: { emoji: '⏰', label: 'Soon' },
    risky: { emoji: '🎲', label: 'Risky' },
    'ai-edge': { emoji: '🧠', label: 'AI Edge' },
    crypto: { emoji: '₿', label: 'Crypto' },
    politics: { emoji: '🏛', label: 'Politics' },
  };

  const { emoji, label } = moodLabels[mood] || { emoji: '🔍', label: 'Filter' };

  return (
    <div className="empty-filter-container">
      <span className="empty-filter-emoji">{emoji}</span>
      <h3 className="empty-filter-title">No {label} markets</h3>
      <p className="empty-filter-desc">Try a different filter or check back later</p>
      <button onClick={onReset} className="empty-filter-btn">
        Show All Markets
      </button>
    </div>
  );
}

// Social proof banner
function SocialProof({ dataSource }: { dataSource: 'api' | 'dflow' | 'mock' }) {
  return (
    <div className="social-proof">
      <span className="proof-dot" />
      <span className="proof-text">
        {dataSource === 'dflow' ? (
          <>
            <strong>DFlow</strong> tokenized markets on Solana
          </>
        ) : dataSource === 'mock' ? (
          <>
            Demo mode - <strong>connect to see live markets</strong>
          </>
        ) : (
          <>
            <strong>2.4K</strong> predictions in the last hour
          </>
        )}
      </span>
    </div>
  );
}

export default function Home() {
  const [completedToday, setCompletedToday] = useState(0);
  const [streak] = useState(3);
  const [selectedMood, setSelectedMood] = useState<MoodFilter>('all');

  // Viral mechanics
  const { challenges } = useChallenges();

  const { predictions, loading, error, refetch, dataSource } = useMarkets({
    mode: 'dflow',  // Use DFlow tokenized markets as primary source
    limit: 20,
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

  // Handle mood selection with haptic feedback
  const handleMoodSelect = (mood: MoodFilter) => {
    if (navigator.vibrate) navigator.vibrate(5);
    setSelectedMood(mood);
  };

  return (
    <div className="home-page">
      <MinimalHeader
        streak={streak}
        progress={{ done: completedToday, total: filteredPredictions.length || 7 }}
      />

      {/* Main Content */}
      <main className="home-main">
        {/* Daily Challenges */}
        {!loading && predictions.length > 0 && (
          <DailyChallengeBanner challenges={challenges.slice(0, 2)} />
        )}

        {/* Mood Filter Pills + Share */}
        {!loading && predictions.length > 0 && (
          <div className="filter-row">
            <MoodPills
              selected={selectedMood}
              onSelect={handleMoodSelect}
              counts={moodCounts}
            />
            {selectedMood !== 'all' && (
              <ShareFilterButton
                mood={selectedMood}
                count={filteredPredictions.length}
              />
            )}
          </div>
        )}

        {loading ? (
          <LoadingSkeleton />
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

      {/* Social Proof */}
      {!loading && predictions.length > 0 && <SocialProof dataSource={dataSource} />}

      <BottomNav />

      {/* Home Page Styles */}
      <style jsx global>{`
        .home-page {
          min-height: 100dvh;
          background: radial-gradient(ellipse at 50% 0%, rgba(0, 230, 118, 0.04) 0%, transparent 50%),
                      radial-gradient(ellipse at 50% 100%, rgba(99, 102, 241, 0.04) 0%, transparent 50%),
                      #0A0A0F;
          overflow: hidden;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           HEADER - MINIMAL & COMPACT
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .home-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          padding-top: env(safe-area-inset-top, 0px);
          background: rgba(10, 10, 15, 0.95);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 12px;
          max-width: 500px;
          margin: 0 auto;
          height: 44px;
          box-sizing: content-box;
        }

        .streak-pill {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          background: rgba(255, 107, 53, 0.15);
          border: 1px solid rgba(255, 107, 53, 0.3);
          border-radius: 20px;
        }

        .streak-fire {
          font-size: 14px;
          animation: flame 0.5s ease-in-out infinite alternate;
        }

        @keyframes flame {
          from { transform: scale(1) rotate(-3deg); }
          to { transform: scale(1.1) rotate(3deg); }
        }

        .streak-count {
          font-size: 13px;
          font-weight: 700;
          color: #FF6B35;
          font-family: var(--font-mono);
        }

        .logo-link {
          text-decoration: none;
        }

        .logo-text {
          font-size: 18px;
          font-weight: 800;
          background: linear-gradient(135deg, #00E676, #2979FF);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: -0.5px;
        }

        .progress-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
        }

        .progress-text {
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          font-family: var(--font-mono);
        }

        .progress-ring-mini {
          width: 18px;
          height: 18px;
        }

        .progress-ring-mini svg {
          transform: rotate(-90deg);
        }

        .ring-bg {
          fill: none;
          stroke: rgba(255, 255, 255, 0.1);
          stroke-width: 3;
        }

        .ring-fill {
          fill: none;
          stroke: #00E676;
          stroke-width: 3;
          stroke-linecap: round;
          transition: stroke-dashoffset 0.5s ease;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           FILTER ROW
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .filter-row {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 4px;
        }

        .filter-row :global(.mood-pills-container) {
          margin-bottom: 0;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           MAIN CONTENT - Centered & Compact
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .home-main {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: calc(100dvh - 56px - 72px);
          max-width: 500px;
          margin: 0 auto;
          padding: 16px 12px;
          padding-top: calc(56px + env(safe-area-inset-top, 0px) + 16px);
          padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px) + 16px);
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           LOADING SKELETON
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .skeleton-container {
          width: 100%;
          max-width: 400px;
          padding: 0 12px;
        }

        .skeleton-card {
          height: calc(70vh);
          min-height: 420px;
          max-height: 600px;
          background: linear-gradient(165deg, #1A1A2E 0%, #141420 100%);
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          overflow: hidden;
          position: relative;
        }

        .skeleton-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%);
          animation: shimmer 1.5s ease-in-out infinite;
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .skeleton-content {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          height: 100%;
        }

        .skeleton-line {
          height: 16px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
        }

        .skeleton-line.short { width: 30%; }
        .skeleton-line.medium { width: 60%; }
        .skeleton-line.long { width: 80%; }

        .skeleton-circle {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          margin: auto;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           ERROR STATE
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .error-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 40px 24px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          max-width: 320px;
        }

        .error-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .error-title {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 8px;
        }

        .error-message {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 20px;
        }

        .retry-btn {
          padding: 12px 24px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .retry-btn:hover {
          background: rgba(255, 255, 255, 0.12);
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           EMPTY FILTER STATE
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .empty-filter-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 48px 24px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          max-width: 320px;
          width: 100%;
        }

        .empty-filter-emoji {
          font-size: 56px;
          margin-bottom: 16px;
          filter: grayscale(0.3);
        }

        .empty-filter-title {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 8px;
        }

        .empty-filter-desc {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0 0 24px;
        }

        .empty-filter-btn {
          padding: 12px 24px;
          background: rgba(0, 230, 118, 0.15);
          border: 1px solid rgba(0, 230, 118, 0.3);
          border-radius: 12px;
          color: #00E676;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .empty-filter-btn:hover {
          background: rgba(0, 230, 118, 0.25);
          border-color: rgba(0, 230, 118, 0.5);
        }

        .empty-filter-btn:active {
          transform: scale(0.98);
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           SOCIAL PROOF - Above bottom nav
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .social-proof {
          position: fixed;
          bottom: calc(76px + env(safe-area-inset-bottom, 0px));
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: rgba(10, 10, 15, 0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          z-index: 60;
          max-width: calc(100% - 32px);
          white-space: nowrap;
        }

        .proof-dot {
          width: 6px;
          height: 6px;
          background: #00E676;
          border-radius: 50%;
          animation: pulse-dot 2s ease-in-out infinite;
          flex-shrink: 0;
        }

        .proof-text {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
        }

        .proof-text strong {
          color: #00E676;
          font-weight: 600;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           RESPONSIVE - Mobile-first
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        @media (max-width: 359px) {
          .header-content {
            padding: 10px 12px;
          }

          .streak-pill,
          .progress-pill {
            padding: 5px 8px;
          }

          .streak-count,
          .progress-text {
            font-size: 11px;
          }

          .logo-text {
            font-size: 16px;
          }

          .home-main {
            padding: 12px 8px;
            padding-top: calc(48px + env(safe-area-inset-top, 0px) + 12px);
            padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px) + 12px);
          }

          .social-proof {
            padding: 6px 10px;
            bottom: calc(68px + env(safe-area-inset-bottom, 0px));
          }

          .proof-text {
            font-size: 10px;
          }
        }

        @media (min-width: 481px) {
          .header-content {
            padding: 12px 20px;
          }

          .logo-text {
            font-size: 20px;
          }

          .home-main {
            padding: 20px 16px;
            padding-top: calc(56px + env(safe-area-inset-top, 0px) + 20px);
            padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px) + 20px);
          }
        }

        /* Landscape - compact everything */
        @media (max-height: 500px) and (orientation: landscape) {
          .home-main {
            min-height: calc(100dvh - 48px - 56px);
            padding-top: calc(48px + env(safe-area-inset-top, 0px) + 8px);
            padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px) + 8px);
          }

          .social-proof {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
