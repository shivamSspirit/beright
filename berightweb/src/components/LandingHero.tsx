'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';

// ═══════════════════════════════════════════════════════════════════════════════
// NIKITA BIER VIRAL LANDING PAGE
// ═══════════════════════════════════════════════════════════════════════════════
// Principles applied:
// 1. MAKING MONEY - The only value prop that matters
// 2. FOMO - Live wins, countdown timers, "others are profiting NOW"
// 3. TOILET-TESTABLE - One CTA, instant understanding, mobile-first
// 4. OBSESSIVE TRADERS - Numbers, tickers, real signals
// ═══════════════════════════════════════════════════════════════════════════════

// Fake live wins for social proof (will be real from API later)
const LIVE_WINS = [
  { user: '0x7a3...f91', amount: 847, market: 'BTC > $100K', time: '12s ago' },
  { user: '0xb2e...4c8', amount: 2150, market: 'Trump 2028', time: '34s ago' },
  { user: '0x91d...e27', amount: 523, market: 'ETH Merge Date', time: '1m ago' },
  { user: '0xf4a...b83', amount: 1890, market: 'Fed Rate Cut', time: '2m ago' },
  { user: '0x3c7...d15', amount: 670, market: 'SOL > $500', time: '3m ago' },
  { user: '0x8f2...a49', amount: 3200, market: 'AI Bubble Pop', time: '4m ago' },
];

// Hot opportunities
const HOT_OPPS = [
  { market: 'BTC > $150K by June', odds: 34, change: +8, volume: '2.4M', closing: '6h' },
  { market: 'Trump wins 2028', odds: 52, change: -3, volume: '8.1M', closing: '2y' },
  { market: 'Fed cuts in March', odds: 78, change: +12, volume: '1.2M', closing: '18d' },
  { market: 'ETH flips BTC', odds: 8, change: +2, volume: '890K', closing: '1y' },
];

function LiveWinTicker() {
  const [currentWin, setCurrentWin] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentWin((prev) => (prev + 1) % LIVE_WINS.length);
        setIsAnimating(false);
      }, 300);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const win = LIVE_WINS[currentWin];

  return (
    <div className={`live-win-ticker ${isAnimating ? 'animating' : ''}`}>
      <span className="ticker-live">
        <span className="live-dot" />
        LIVE
      </span>
      <span className="ticker-content">
        <span className="ticker-user">{win.user}</span>
        <span className="ticker-action">just won</span>
        <span className="ticker-amount">${win.amount.toLocaleString()}</span>
        <span className="ticker-market">on {win.market}</span>
      </span>
      <span className="ticker-time">{win.time}</span>
    </div>
  );
}

function CountingNumber({ target, prefix = '', suffix = '' }: { target: number; prefix?: string; suffix?: string }) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const start = Date.now();
    const duration = 2000;
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(target * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target]);

  return <span ref={ref}>{prefix}{value.toLocaleString()}{suffix}</span>;
}

function HotOpportunityCard({ opp, index }: { opp: typeof HOT_OPPS[0]; index: number }) {
  const isUp = opp.change > 0;

  return (
    <div className="hot-opp-card" style={{ animationDelay: `${index * 100}ms` }}>
      <div className="opp-header">
        <span className="opp-closing">
          <span className="closing-icon">⏱</span>
          {opp.closing}
        </span>
        <span className={`opp-change ${isUp ? 'up' : 'down'}`}>
          {isUp ? '↑' : '↓'}{Math.abs(opp.change)}%
        </span>
      </div>
      <h3 className="opp-market">{opp.market}</h3>
      <div className="opp-odds">
        <div className="odds-bar">
          <div className="odds-fill" style={{ width: `${opp.odds}%` }} />
        </div>
        <div className="odds-labels">
          <span className="odds-yes">{opp.odds}% YES</span>
          <span className="odds-no">{100 - opp.odds}% NO</span>
        </div>
      </div>
      <div className="opp-volume">
        <span className="volume-icon">💰</span>
        ${opp.volume} volume
      </div>
    </div>
  );
}

export default function LandingHero() {
  const { login, ready } = usePrivy();
  const [todayProfits, setTodayProfits] = useState(0);

  // Simulate increasing profits counter
  useEffect(() => {
    const base = 847523;
    const interval = setInterval(() => {
      setTodayProfits(base + Math.floor(Math.random() * 1000));
    }, 2000);
    setTodayProfits(base);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate(10);
    login();
  }, [login]);

  if (!ready) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <span className="loading-logo">BeRight</span>
          <div className="loading-bar">
            <div className="loading-fill" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="viral-landing">
      {/* Live Win Ticker - FOMO at the top */}
      <LiveWinTicker />

      {/* Main Hero */}
      <main className="hero-main">
        {/* Background Effects */}
        <div className="hero-bg">
          <div className="bg-glow-1" />
          <div className="bg-glow-2" />
          <div className="bg-noise" />
        </div>

        {/* Content */}
        <div className="hero-content">
          {/* Social Proof Badge */}
          <div className="social-proof-badge">
            <span className="proof-icon">🔥</span>
            <span className="proof-text">
              <CountingNumber target={2847} /> traders made money today
            </span>
          </div>

          {/* Main Headline - MONEY FOCUSED */}
          <h1 className="hero-headline">
            <span className="headline-small">Stop watching.</span>
            <span className="headline-big">Start <span className="gradient-text">profiting</span>.</span>
          </h1>

          {/* Sub - Simple value prop */}
          <p className="hero-sub">
            Predict markets. Get paid when you're right.
            <br />
            <span className="sub-highlight">Average winner: $340/trade</span>
          </p>

          {/* Live Stats - More FOMO */}
          <div className="live-stats-bar">
            <div className="stat-box">
              <span className="stat-label">Paid out today</span>
              <span className="stat-value green">
                $<CountingNumber target={todayProfits} />
              </span>
            </div>
            <div className="stat-divider" />
            <div className="stat-box">
              <span className="stat-label">Active markets</span>
              <span className="stat-value">
                <CountingNumber target={847} />
              </span>
            </div>
            <div className="stat-divider" />
            <div className="stat-box">
              <span className="stat-label">Online now</span>
              <span className="stat-value">
                <span className="online-dot" />
                <CountingNumber target={1247} />
              </span>
            </div>
          </div>

          {/* SINGLE CTA - The only thing that matters */}
          <button className="mega-cta" onClick={handleConnect}>
            <span className="cta-text">Start Making Money</span>
            <span className="cta-arrow">→</span>
          </button>

          <p className="cta-note">
            Connect wallet in 10 seconds. Min bet $1. Withdraw anytime.
          </p>
        </div>

        {/* Hot Opportunities - Show the money */}
        <div className="hot-section">
          <div className="hot-header">
            <h2 className="hot-title">
              <span className="fire-icon">🔥</span>
              Hot Right Now
            </h2>
            <span className="hot-subtitle">Markets with edge</span>
          </div>

          <div className="hot-grid">
            {HOT_OPPS.map((opp, i) => (
              <HotOpportunityCard key={i} opp={opp} index={i} />
            ))}
          </div>

          <button className="see-all-btn" onClick={handleConnect}>
            See all 847 markets →
          </button>
        </div>
      </main>

      {/* Bottom CTA Bar - Mobile sticky */}
      <div className="sticky-cta-bar">
        <div className="sticky-inner">
          <div className="sticky-info">
            <span className="sticky-live">
              <span className="live-dot" />
              $<CountingNumber target={todayProfits} /> paid today
            </span>
          </div>
          <button className="sticky-btn" onClick={handleConnect}>
            Start Now
          </button>
        </div>
      </div>

      <style jsx global>{`
        /* ═══════════════════════════════════════════════════════════════════════
           VIRAL LANDING - NIKITA BIER OPTIMIZED
           ═══════════════════════════════════════════════════════════════════════ */

        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');

        .viral-landing {
          min-height: 100dvh;
          background: #000;
          color: #fff;
          font-family: 'Space Grotesk', system-ui, sans-serif;
          overflow-x: hidden;
        }

        /* ═══════════════════════════════════════════════════════════════════════
           LIVE WIN TICKER - FOMO MACHINE
           ═══════════════════════════════════════════════════════════════════════ */

        .live-win-ticker {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          background: linear-gradient(90deg, rgba(0, 255, 136, 0.15) 0%, rgba(0, 200, 100, 0.08) 100%);
          border-bottom: 1px solid rgba(0, 255, 136, 0.3);
          font-size: 13px;
          overflow: hidden;
          transition: transform 0.3s ease;
        }

        .live-win-ticker.animating {
          transform: translateY(-100%);
        }

        .ticker-live {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: rgba(0, 255, 136, 0.2);
          border-radius: 4px;
          font-weight: 700;
          font-size: 10px;
          letter-spacing: 1px;
          color: #00FF88;
          flex-shrink: 0;
        }

        .live-dot {
          width: 6px;
          height: 6px;
          background: #00FF88;
          border-radius: 50%;
          animation: pulse 1s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }

        .ticker-content {
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 1;
          min-width: 0;
        }

        .ticker-user {
          font-family: 'JetBrains Mono', monospace;
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
        }

        .ticker-action {
          color: rgba(255, 255, 255, 0.5);
        }

        .ticker-amount {
          font-weight: 700;
          color: #00FF88;
          font-family: 'JetBrains Mono', monospace;
        }

        .ticker-market {
          color: rgba(255, 255, 255, 0.7);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ticker-time {
          color: rgba(255, 255, 255, 0.4);
          font-size: 11px;
          flex-shrink: 0;
        }

        /* ═══════════════════════════════════════════════════════════════════════
           HERO MAIN
           ═══════════════════════════════════════════════════════════════════════ */

        .hero-main {
          padding: 80px 20px 120px;
          max-width: 1200px;
          margin: 0 auto;
          position: relative;
        }

        .hero-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }

        .bg-glow-1 {
          position: absolute;
          width: 600px;
          height: 600px;
          left: -200px;
          top: 0;
          background: radial-gradient(circle, rgba(0, 255, 136, 0.12) 0%, transparent 70%);
          filter: blur(60px);
        }

        .bg-glow-2 {
          position: absolute;
          width: 500px;
          height: 500px;
          right: -150px;
          bottom: 0;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%);
          filter: blur(60px);
        }

        .bg-noise {
          position: absolute;
          inset: 0;
          opacity: 0.03;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }

        .hero-content {
          position: relative;
          z-index: 10;
          text-align: center;
          max-width: 700px;
          margin: 0 auto 60px;
        }

        /* Social Proof Badge */
        .social-proof-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 100px;
          margin-bottom: 24px;
          animation: fadeInUp 0.6s ease-out;
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .proof-icon {
          font-size: 16px;
        }

        .proof-text {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
          font-weight: 500;
        }

        /* Headlines */
        .hero-headline {
          margin: 0 0 20px;
          animation: fadeInUp 0.6s ease-out 0.1s both;
        }

        .headline-small {
          display: block;
          font-size: 20px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 8px;
        }

        .headline-big {
          display: block;
          font-size: 56px;
          font-weight: 700;
          line-height: 1.1;
          letter-spacing: -2px;
        }

        .gradient-text {
          background: linear-gradient(135deg, #00FF88 0%, #00D4FF 50%, #A855F7 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-sub {
          font-size: 18px;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.6;
          margin: 0 0 24px;
          animation: fadeInUp 0.6s ease-out 0.2s both;
        }

        .sub-highlight {
          color: #00FF88;
          font-weight: 600;
        }

        /* Live Stats Bar */
        .live-stats-bar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 24px;
          padding: 16px 24px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          margin-bottom: 32px;
          animation: fadeInUp 0.6s ease-out 0.3s both;
        }

        .stat-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .stat-label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat-value {
          font-size: 20px;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .stat-value.green {
          color: #00FF88;
        }

        .online-dot {
          width: 8px;
          height: 8px;
          background: #00FF88;
          border-radius: 50%;
          animation: pulse 1.5s ease-in-out infinite;
        }

        .stat-divider {
          width: 1px;
          height: 32px;
          background: rgba(255, 255, 255, 0.1);
        }

        /* MEGA CTA */
        .mega-cta {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 20px 48px;
          background: linear-gradient(135deg, #00FF88 0%, #00CC6A 100%);
          border: none;
          border-radius: 16px;
          color: #000;
          font-size: 20px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.3s ease;
          animation: fadeInUp 0.6s ease-out 0.4s both;
          position: relative;
          overflow: hidden;
        }

        .mega-cta::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 200%;
          height: 100%;
          background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%);
          animation: shine 3s ease-in-out infinite;
        }

        @keyframes shine {
          0% { left: -100%; }
          20%, 100% { left: 100%; }
        }

        .mega-cta:hover {
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 20px 60px rgba(0, 255, 136, 0.4);
        }

        .mega-cta:active {
          transform: translateY(-1px) scale(0.99);
        }

        .cta-arrow {
          font-size: 24px;
          transition: transform 0.2s;
        }

        .mega-cta:hover .cta-arrow {
          transform: translateX(4px);
        }

        .cta-note {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.4);
          margin: 16px 0 0;
          animation: fadeInUp 0.6s ease-out 0.5s both;
        }

        /* ═══════════════════════════════════════════════════════════════════════
           HOT OPPORTUNITIES
           ═══════════════════════════════════════════════════════════════════════ */

        .hot-section {
          position: relative;
          z-index: 10;
        }

        .hot-header {
          text-align: center;
          margin-bottom: 24px;
        }

        .hot-title {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 8px;
        }

        .fire-icon {
          font-size: 28px;
        }

        .hot-subtitle {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
        }

        .hot-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .hot-opp-card {
          background: linear-gradient(165deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.3s ease;
          animation: fadeInUp 0.5s ease-out both;
        }

        .hot-opp-card:hover {
          transform: translateY(-4px);
          border-color: rgba(0, 255, 136, 0.3);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
        }

        .opp-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .opp-closing {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
        }

        .closing-icon {
          font-size: 14px;
        }

        .opp-change {
          font-size: 13px;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
        }

        .opp-change.up { color: #00FF88; }
        .opp-change.down { color: #FF4757; }

        .opp-market {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 16px;
          line-height: 1.3;
        }

        .opp-odds {
          margin-bottom: 12px;
        }

        .odds-bar {
          height: 8px;
          background: rgba(255, 71, 87, 0.3);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .odds-fill {
          height: 100%;
          background: linear-gradient(90deg, #00FF88, #00CC6A);
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .odds-labels {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          font-family: 'JetBrains Mono', monospace;
        }

        .odds-yes { color: #00FF88; }
        .odds-no { color: #FF4757; }

        .opp-volume {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
        }

        .volume-icon {
          font-size: 14px;
        }

        .see-all-btn {
          display: block;
          width: 100%;
          padding: 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }

        .see-all-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
        }

        /* ═══════════════════════════════════════════════════════════════════════
           STICKY BOTTOM CTA
           ═══════════════════════════════════════════════════════════════════════ */

        .sticky-cta-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 90;
          padding: 12px 16px;
          padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
          background: rgba(0, 0, 0, 0.95);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        .sticky-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 500px;
          margin: 0 auto;
        }

        .sticky-info {
          flex: 1;
        }

        .sticky-live {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #00FF88;
          font-family: 'JetBrains Mono', monospace;
        }

        .sticky-btn {
          padding: 12px 28px;
          background: linear-gradient(135deg, #00FF88 0%, #00CC6A 100%);
          border: none;
          border-radius: 10px;
          color: #000;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }

        .sticky-btn:hover {
          transform: scale(1.02);
          box-shadow: 0 8px 24px rgba(0, 255, 136, 0.3);
        }

        /* ═══════════════════════════════════════════════════════════════════════
           LOADING SCREEN
           ═══════════════════════════════════════════════════════════════════════ */

        .loading-screen {
          min-height: 100dvh;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .loading-content {
          text-align: center;
        }

        .loading-logo {
          display: block;
          font-size: 32px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 24px;
          font-family: 'Space Grotesk', sans-serif;
        }

        .loading-bar {
          width: 120px;
          height: 4px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          overflow: hidden;
          margin: 0 auto;
        }

        .loading-fill {
          width: 30%;
          height: 100%;
          background: linear-gradient(90deg, #00FF88, #00CC6A);
          border-radius: 2px;
          animation: loadingSlide 1s ease-in-out infinite;
        }

        @keyframes loadingSlide {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(200%); }
          100% { transform: translateX(-100%); }
        }

        /* ═══════════════════════════════════════════════════════════════════════
           RESPONSIVE
           ═══════════════════════════════════════════════════════════════════════ */

        @media (max-width: 768px) {
          .hero-main {
            padding: 70px 16px 100px;
          }

          .headline-big {
            font-size: 36px;
            letter-spacing: -1px;
          }

          .headline-small {
            font-size: 16px;
          }

          .hero-sub {
            font-size: 16px;
          }

          .live-stats-bar {
            flex-wrap: wrap;
            gap: 16px;
            padding: 16px;
          }

          .stat-divider {
            display: none;
          }

          .stat-box {
            flex: 1;
            min-width: 80px;
          }

          .stat-value {
            font-size: 18px;
          }

          .mega-cta {
            width: 100%;
            justify-content: center;
            padding: 18px 32px;
            font-size: 18px;
          }

          .hot-grid {
            grid-template-columns: 1fr;
          }

          .live-win-ticker {
            font-size: 12px;
            padding: 8px 12px;
          }

          .ticker-market {
            display: none;
          }
        }

        @media (max-width: 480px) {
          .hero-main {
            padding: 60px 12px 90px;
          }

          .headline-big {
            font-size: 28px;
          }

          .hero-sub {
            font-size: 14px;
          }

          .social-proof-badge {
            font-size: 12px;
            padding: 6px 12px;
          }

          .mega-cta {
            padding: 16px 24px;
            font-size: 16px;
            border-radius: 12px;
          }

          .hot-title {
            font-size: 20px;
          }

          .hot-opp-card {
            padding: 16px;
          }

          .sticky-inner {
            gap: 12px;
          }

          .sticky-live {
            font-size: 12px;
          }

          .sticky-btn {
            padding: 10px 20px;
            font-size: 14px;
          }
        }

        /* Hide on desktop */
        @media (min-width: 769px) {
          .sticky-cta-bar {
            display: none;
          }
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .live-dot,
          .online-dot,
          .loading-fill,
          .mega-cta::before {
            animation: none;
          }

          .social-proof-badge,
          .hero-headline,
          .hero-sub,
          .live-stats-bar,
          .mega-cta,
          .cta-note,
          .hot-opp-card {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
