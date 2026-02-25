'use client';

import { useState, useMemo, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import CardStack from '@/components/CardStack';
import BottomNav from '@/components/BottomNav';
import MoodPills, { MoodFilter, filterByMood, getMoodCounts } from '@/components/MoodPills';
import LandingHero from '@/components/LandingHero';
import { useMarkets } from '@/hooks/useMarkets';
import { useUser } from '@/context/UserContext';
import Link from 'next/link';

// ═══════════════════════════════════════════════════════════════════════════════
// NIKITA BIER VIRAL STRATEGY: Ego, FOMO, Social Proof, Low Barrier Dopamine
// ═══════════════════════════════════════════════════════════════════════════════

const STORAGE_KEY_VISITED = 'beright_has_visited';

// Live ticker data - FOMO trigger
const LIVE_ACTIVITY = [
  { user: '@whale', action: 'won', amount: '+$2,340', market: 'BTC > $100K' },
  { user: '@sage', action: 'bet', amount: '$500', market: 'Fed cuts March' },
  { user: '@degen', action: 'won', amount: '+$890', market: 'ETH $5K' },
  { user: '@alpha', action: 'bet', amount: '$1,200', market: 'Trump 2028' },
  { user: '@oracle', action: 'won', amount: '+$3,100', market: 'US Recession' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE TICKER - FOMO Engine
// ═══════════════════════════════════════════════════════════════════════════════

function LiveTicker() {
  return (
    <div className="live-ticker">
      <div className="ticker-glow" />
      <div className="ticker-track">
        <div className="ticker-content">
          {[...LIVE_ACTIVITY, ...LIVE_ACTIVITY, ...LIVE_ACTIVITY].map((item, i) => (
            <span key={i} className="ticker-item">
              <span className={`ticker-dot ${item.action === 'won' ? 'green' : 'blue'}`} />
              <span className="ticker-user">{item.user}</span>
              <span className={`ticker-action ${item.action}`}>{item.action === 'won' ? 'won' : 'placed'}</span>
              <span className={`ticker-amount ${item.action === 'won' ? 'green' : ''}`}>{item.amount}</span>
              <span className="ticker-on">on</span>
              <span className="ticker-market">"{item.market}"</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MINIMAL HEADER - Ego & Status Display
// ═══════════════════════════════════════════════════════════════════════════════

function MinimalHeader({ streak, portfolioValue, dayChange }: {
  streak: number;
  portfolioValue: number;
  dayChange: number;
}) {
  const { logout } = usePrivy();
  const [showMenu, setShowMenu] = useState(false);
  const [showStreakTooltip, setShowStreakTooltip] = useState(false);

  return (
    <header className="minimal-header">
      <div className="header-left">
        <Link href="/" className="logo">
          <span className="logo-dot">◉</span>
          <span className="logo-text">BeRight</span>
        </Link>
      </div>

      <div className="header-right">
        {/* Portfolio - Ego */}
        <div className="portfolio-badge">
          <span className="portfolio-value">${portfolioValue.toLocaleString()}</span>
          <span className={`portfolio-change ${dayChange >= 0 ? 'up' : 'down'}`}>
            {dayChange >= 0 ? '+' : ''}{dayChange.toFixed(1)}%
          </span>
        </div>

        {/* Streak - Dopamine with Tooltip */}
        <div
          className="streak-badge"
          onMouseEnter={() => setShowStreakTooltip(true)}
          onMouseLeave={() => setShowStreakTooltip(false)}
          onClick={() => setShowStreakTooltip(!showStreakTooltip)}
        >
          <span className="streak-icon">🔥</span>
          <span className="streak-count">{streak}</span>
          {showStreakTooltip && (
            <div className="streak-tooltip">
              <div className="streak-tooltip-title">{streak} Day Streak!</div>
              <div className="streak-tooltip-desc">
                Predict daily to keep your streak alive. Longer streaks = bonus XP!
              </div>
              <div className="streak-tooltip-tip">
                Come back tomorrow to continue
              </div>
            </div>
          )}
        </div>

        {/* Menu */}
        <button className="menu-btn" onClick={() => setShowMenu(!showMenu)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="6" r="1.5" />
            <circle cx="12" cy="18" r="1.5" />
          </svg>
        </button>

        {showMenu && (
          <>
            <div className="menu-backdrop" onClick={() => setShowMenu(false)} />
            <div className="menu-dropdown">
              <Link href="/profile" className="menu-item" onClick={() => setShowMenu(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="8" r="4"/>
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                </svg>
                Profile
              </Link>
              <Link href="/beright-terminal" className="menu-item" onClick={() => setShowMenu(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2"/>
                  <path d="M8 21h8M12 17v4"/>
                </svg>
                Terminal
              </Link>
              <button className="menu-item logout" onClick={logout}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
                </svg>
                Logout
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE STATS BAR - Social Proof
// ═══════════════════════════════════════════════════════════════════════════════

function LiveStatsBar({ marketCount }: { marketCount: number }) {
  const [activeNow, setActiveNow] = useState(127);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveNow(prev => prev + Math.floor(Math.random() * 5) - 2);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="live-stats">
      <div className="stat-item">
        <span className="stat-dot pulse" />
        <span className="stat-text">{activeNow} trading now</span>
      </div>
      <div className="stat-divider" />
      <div className="stat-item">
        <span className="stat-text">{marketCount} markets</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING STATE
// ═══════════════════════════════════════════════════════════════════════════════

function LoadingState() {
  return (
    <div className="loading-container">
      <div className="loading-card">
        <div className="loading-shimmer" />
        <div className="loading-center">
          <div className="loading-spinner" />
          <p className="loading-text">Finding opportunities...</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR STATE
// ═══════════════════════════════════════════════════════════════════════════════

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="state-container error">
      <div className="state-icon error">!</div>
      <h3 className="state-title">Something went wrong</h3>
      <p className="state-desc">{message}</p>
      <button onClick={onRetry} className="state-btn">Try Again</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY FILTER STATE
// ═══════════════════════════════════════════════════════════════════════════════

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
    <div className="state-container">
      <div className="state-icon">🎯</div>
      <h3 className="state-title">No {moodLabels[mood]} markets</h3>
      <p className="state-desc">Try another filter to find predictions</p>
      <button onClick={onReset} className="state-btn primary">Show All Markets</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════

export default function Home() {
  const [selectedMood, setSelectedMood] = useState<MoodFilter>('all');
  const [showTransition, setShowTransition] = useState(false);

  const { ready, authenticated } = usePrivy();
  const { walletAddress } = useUser();

  const { predictions, loading, error, refetch } = useMarkets({
    mode: 'dflow',
    limit: 50,
    useMockOnError: true,
  });

  // Generate user stats from wallet (Ego trigger)
  const userStats = useMemo(() => {
    const addr = walletAddress || '0x0000';
    const hash = addr.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return {
      streak: hash % 15,
      portfolioValue: 1000 + (hash % 9000),
      dayChange: -5 + (hash % 20),
    };
  }, [walletAddress]);

  // Sort by tension (close to 50%)
  const sortedPredictions = useMemo(() => {
    return [...predictions].sort((a, b) => {
      const tensionA = 50 - Math.abs(50 - a.marketOdds);
      const tensionB = 50 - Math.abs(50 - b.marketOdds);
      return tensionB - tensionA;
    });
  }, [predictions]);

  // Mark visited on auth
  useEffect(() => {
    if (typeof window === 'undefined' || !ready) return;
    if (authenticated) {
      try {
        localStorage.setItem(STORAGE_KEY_VISITED, 'true');
        setShowTransition(true);
        setTimeout(() => setShowTransition(false), 500);
      } catch { /* ignore */ }
    }
  }, [ready, authenticated]);

  // Filter predictions
  const filteredPredictions = useMemo(() => {
    return filterByMood(sortedPredictions, selectedMood);
  }, [sortedPredictions, selectedMood]);

  // Mood counts
  const moodCounts = useMemo(() => {
    return getMoodCounts(sortedPredictions);
  }, [sortedPredictions]);

  // Handle mood selection
  const handleMoodSelect = (mood: MoodFilter) => {
    if (navigator.vibrate) navigator.vibrate(5);
    setSelectedMood(mood);
  };

  // Unauthenticated → Landing
  if (!authenticated && ready) {
    return <LandingHero />;
  }

  // Init loading
  if (!ready) {
    return (
      <div className="init-screen">
        <div className="init-logo">
          <span className="init-dot">◉</span>
          <span className="init-text">BeRight</span>
        </div>
        <div className="init-spinner" />
      </div>
    );
  }

  return (
    <div className={`app ${showTransition ? 'fade-in' : ''}`}>
      {/* FOMO Ticker */}
      <LiveTicker />

      {/* Header */}
      <MinimalHeader
        streak={userStats.streak}
        portfolioValue={userStats.portfolioValue}
        dayChange={userStats.dayChange}
      />

      {/* Social Proof Stats */}
      {!loading && predictions.length > 0 && (
        <LiveStatsBar marketCount={predictions.length} />
      )}

      {/* Filter Pills */}
      {!loading && predictions.length > 0 && (
        <div className="filter-bar">
          <MoodPills
            selected={selectedMood}
            onSelect={handleMoodSelect}
            counts={moodCounts}
          />
        </div>
      )}

      {/* Main Content - CardStack unchanged */}
      <main className="main-area">
        {loading ? (
          <LoadingState />
        ) : error && predictions.length === 0 ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : filteredPredictions.length > 0 ? (
          <CardStack predictions={filteredPredictions} key={selectedMood} />
        ) : selectedMood !== 'all' ? (
          <EmptyFilterState mood={selectedMood} onReset={() => setSelectedMood('all')} />
        ) : (
          <ErrorState message="No predictions available" onRetry={refetch} />
        )}
      </main>

      {/* Bottom Nav - unchanged */}
      <BottomNav />

      <style jsx global>{`
        /* ═══════════════════════════════════════════════════════════════════════
           BERIGHT - NIKITA BIER VIRAL AESTHETIC
           Clean, minimal, addictive
           ═══════════════════════════════════════════════════════════════════════ */

        :root {
          --bg: #030305;
          --bg-card: #0A0A0F;
          --bg-elevated: #111118;
          --border: rgba(255, 255, 255, 0.06);
          --border-hover: rgba(255, 255, 255, 0.12);
          --text: #FFFFFF;
          --text-secondary: rgba(255, 255, 255, 0.6);
          --text-muted: rgba(255, 255, 255, 0.35);
          --green: #00E676;
          --green-dim: rgba(0, 230, 118, 0.12);
          --red: #FF5252;
          --red-dim: rgba(255, 82, 82, 0.12);
          --blue: #00B4FF;
          --blue-dim: rgba(0, 180, 255, 0.12);
          --font: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
          --mono: 'JetBrains Mono', 'SF Mono', monospace;
        }

        * { box-sizing: border-box; }

        body {
          margin: 0;
          background: var(--bg);
          color: var(--text);
          font-family: var(--font);
          -webkit-font-smoothing: antialiased;
        }

        .app {
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
        }

        .app.fade-in {
          animation: fadeIn 0.4s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }

        /* ═══════════════════════════════════════════════════════════════════════
           INIT SCREEN
           ═══════════════════════════════════════════════════════════════════════ */

        .init-screen {
          min-height: 100dvh;
          background: var(--bg);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 28px;
        }

        .init-logo {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .init-dot {
          font-size: 32px;
          color: var(--green);
          animation: pulse 2s ease-in-out infinite;
        }

        .init-text {
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }

        .init-spinner {
          width: 28px;
          height: 28px;
          border: 2px solid var(--green-dim);
          border-top-color: var(--green);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* ═══════════════════════════════════════════════════════════════════════
           LIVE TICKER - FOMO
           ═══════════════════════════════════════════════════════════════════════ */

        .live-ticker {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 200;
          height: 32px;
          background: rgba(3, 3, 5, 0.95);
          border-bottom: 1px solid var(--border);
          overflow: hidden;
        }

        .ticker-glow {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--green), transparent);
          opacity: 0.4;
        }

        .ticker-track {
          height: 100%;
          display: flex;
          align-items: center;
          overflow: hidden;
        }

        .ticker-content {
          display: flex;
          gap: 40px;
          padding: 0 20px;
          animation: ticker 40s linear infinite;
          white-space: nowrap;
        }

        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }

        .ticker-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-muted);
        }

        .ticker-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
        }

        .ticker-dot.green { background: var(--green); box-shadow: 0 0 6px var(--green); }
        .ticker-dot.blue { background: var(--blue); }

        .ticker-user { color: var(--blue); font-weight: 600; }
        .ticker-action { color: var(--text-muted); }
        .ticker-action.won { color: var(--green); }
        .ticker-amount { font-weight: 600; font-family: var(--mono); font-size: 11px; }
        .ticker-amount.green { color: var(--green); }
        .ticker-on { color: var(--text-muted); }
        .ticker-market { color: var(--text-secondary); }

        /* ═══════════════════════════════════════════════════════════════════════
           MINIMAL HEADER
           ═══════════════════════════════════════════════════════════════════════ */

        .minimal-header {
          position: fixed;
          top: 32px;
          left: 0;
          right: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          background: linear-gradient(180deg, var(--bg) 0%, transparent 100%);
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
        }

        .logo-dot {
          font-size: 22px;
          color: var(--green);
        }

        .logo-text {
          font-size: 18px;
          font-weight: 800;
          color: var(--text);
          letter-spacing: -0.3px;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 8px;
          position: relative;
        }

        .portfolio-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 8px;
        }

        .portfolio-value {
          font-size: 13px;
          font-weight: 700;
          font-family: var(--mono);
        }

        .portfolio-change {
          font-size: 11px;
          font-weight: 600;
          font-family: var(--mono);
        }

        .portfolio-change.up { color: var(--green); }
        .portfolio-change.down { color: var(--red); }

        .streak-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          background: linear-gradient(135deg, rgba(255, 140, 0, 0.1), rgba(255, 80, 0, 0.08));
          border: 1px solid rgba(255, 140, 0, 0.2);
          border-radius: 8px;
          cursor: pointer;
          position: relative;
        }

        .streak-icon { font-size: 12px; }
        .streak-count {
          font-size: 13px;
          font-weight: 700;
          color: #FF8C00;
          font-family: var(--mono);
        }

        .streak-tooltip {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 200px;
          padding: 12px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          z-index: 200;
          animation: tooltipFadeIn 0.2s ease-out;
        }

        @keyframes tooltipFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .streak-tooltip::before {
          content: '';
          position: absolute;
          top: -6px;
          right: 16px;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-bottom: 6px solid var(--border);
        }

        .streak-tooltip-title {
          font-size: 14px;
          font-weight: 700;
          color: #FF8C00;
          margin-bottom: 6px;
        }

        .streak-tooltip-desc {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.4;
          margin-bottom: 8px;
        }

        .streak-tooltip-tip {
          font-size: 11px;
          color: var(--text-muted);
          padding-top: 8px;
          border-top: 1px solid var(--border);
        }

        .menu-btn {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .menu-btn:hover {
          background: var(--bg-elevated);
          border-color: var(--border-hover);
          color: var(--text);
        }

        .menu-backdrop {
          position: fixed;
          inset: 0;
          z-index: 150;
        }

        .menu-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 160px;
          padding: 6px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          z-index: 200;
        }

        .menu-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 12px;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: var(--text-secondary);
          font-size: 14px;
          font-family: inherit;
          text-decoration: none;
          text-align: left;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .menu-item:hover {
          background: rgba(255,255,255,0.04);
          color: var(--text);
        }

        .menu-item.logout { color: var(--red); }
        .menu-item.logout:hover { background: var(--red-dim); }

        /* ═══════════════════════════════════════════════════════════════════════
           LIVE STATS BAR - Social Proof
           ═══════════════════════════════════════════════════════════════════════ */

        .live-stats {
          position: fixed;
          top: 80px;
          left: 0;
          right: 0;
          z-index: 90;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 8px 16px;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .stat-dot {
          width: 6px;
          height: 6px;
          background: var(--green);
          border-radius: 50%;
        }

        .stat-dot.pulse {
          animation: statPulse 2s ease-in-out infinite;
        }

        @keyframes statPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }

        .stat-text {
          font-size: 12px;
          color: var(--text-muted);
        }

        .stat-divider {
          width: 3px;
          height: 3px;
          background: var(--text-muted);
          border-radius: 50%;
          opacity: 0.5;
        }

        /* ═══════════════════════════════════════════════════════════════════════
           FILTER BAR
           ═══════════════════════════════════════════════════════════════════════ */

        .filter-bar {
          position: fixed;
          top: 104px;
          left: 0;
          right: 0;
          z-index: 80;
          padding: 8px 16px;
          background: linear-gradient(180deg, rgba(3, 3, 5, 0.95) 0%, rgba(3, 3, 5, 0.85) 100%);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        /* ═══════════════════════════════════════════════════════════════════════
           MAIN AREA
           ═══════════════════════════════════════════════════════════════════════ */

        .main-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          max-width: 500px;
          margin: 0 auto;
          padding: 16px 12px;
          padding-top: calc(150px + env(safe-area-inset-top, 0px));
          padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
        }

        /* ═══════════════════════════════════════════════════════════════════════
           LOADING STATE
           ═══════════════════════════════════════════════════════════════════════ */

        .loading-container {
          width: 100%;
          max-width: 380px;
          padding: 0 12px;
        }

        .loading-card {
          width: 100%;
          height: 480px;
          background: linear-gradient(165deg, var(--bg-card) 0%, #080810 100%);
          border: 1px solid var(--border);
          border-radius: 24px;
          position: relative;
          overflow: hidden;
        }

        .loading-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.02) 50%, transparent 70%);
          animation: shimmer 2s ease-in-out infinite;
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .loading-center {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .loading-spinner {
          width: 36px;
          height: 36px;
          border: 2px solid var(--green-dim);
          border-top-color: var(--green);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .loading-text {
          font-size: 13px;
          color: var(--text-muted);
          margin: 0;
        }

        /* ═══════════════════════════════════════════════════════════════════════
           STATE CONTAINERS (Error, Empty)
           ═══════════════════════════════════════════════════════════════════════ */

        .state-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 48px 32px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 20px;
          max-width: 320px;
        }

        .state-icon {
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          background: var(--bg-elevated);
          border-radius: 16px;
          margin-bottom: 20px;
        }

        .state-icon.error {
          font-weight: 800;
          color: var(--red);
          background: var(--red-dim);
          border: 1px solid rgba(255, 82, 82, 0.2);
        }

        .state-title {
          font-size: 17px;
          font-weight: 700;
          color: var(--text);
          margin: 0 0 8px;
        }

        .state-desc {
          font-size: 14px;
          color: var(--text-secondary);
          margin: 0 0 24px;
          line-height: 1.5;
        }

        .state-btn {
          padding: 12px 24px;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 10px;
          color: var(--text);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s ease;
        }

        .state-btn:hover {
          background: rgba(255,255,255,0.08);
          border-color: var(--border-hover);
        }

        .state-btn.primary {
          background: var(--green-dim);
          border-color: rgba(0, 230, 118, 0.25);
          color: var(--green);
        }

        .state-btn.primary:hover {
          background: rgba(0, 230, 118, 0.2);
          border-color: rgba(0, 230, 118, 0.4);
        }

        /* ═══════════════════════════════════════════════════════════════════════
           RESPONSIVE
           ═══════════════════════════════════════════════════════════════════════ */

        @media (max-width: 380px) {
          .portfolio-badge { display: none; }

          .live-stats { top: 76px; }
          .filter-bar { top: 96px; }
          .main-area { padding-top: calc(140px + env(safe-area-inset-top, 0px)); }
        }

        @media (min-width: 768px) {
          .main-area { max-width: 440px; }
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .ticker-content,
          .loading-shimmer,
          .loading-spinner,
          .init-spinner,
          .stat-dot.pulse,
          .init-dot {
            animation: none;
          }
          .app.fade-in { animation: none; }
        }
      `}</style>
    </div>
  );
}
