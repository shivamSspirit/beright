'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';

// ═══════════════════════════════════════════════════════════════════════════════
// BERIGHT LANDING PAGE v2.0
// ═══════════════════════════════════════════════════════════════════════════════
// Design: Premium Fintech Terminal - Bloomberg meets modern crypto trading
// Principles: Nikita Bier viral strategy (FOMO, money-focused, toilet-testable)
// ═══════════════════════════════════════════════════════════════════════════════

// Live wins with readable usernames + avatars
const LIVE_WINS = [
  { username: 'CryptoKing', avatar: '👑', amount: 847, market: 'BTC > $100K', time: '12s' },
  { username: 'TraderJoe', avatar: '📈', amount: 2150, market: 'Trump 2028', time: '34s' },
  { username: 'DeFiQueen', avatar: '💎', amount: 523, market: 'ETH Merge', time: '1m' },
  { username: 'AlphaHunter', avatar: '🎯', amount: 1890, market: 'Fed Rate Cut', time: '2m' },
  { username: 'WhaleMike', avatar: '🐋', amount: 3670, market: 'SOL > $500', time: '3m' },
  { username: 'LuckyAce', avatar: '🃏', amount: 3200, market: 'AI Bubble', time: '4m' },
];

// 6 cards for balanced grid (3x2 on desktop, 2x3 on tablet, 1x6 on mobile)
const HOT_OPPS = [
  { market: 'BTC > $150K by June', odds: 34, change: +8, volume: '2.4M', closing: '6h', hot: true },
  { market: 'Trump wins 2028', odds: 52, change: -3, volume: '8.1M', closing: '2y', hot: false },
  { market: 'Fed cuts in March', odds: 78, change: +12, volume: '1.2M', closing: '18d', hot: true },
  { market: 'ETH flips BTC mcap', odds: 8, change: +2, volume: '890K', closing: '1y', hot: false },
  { market: 'US recession 2025', odds: 41, change: -5, volume: '3.2M', closing: '10m', hot: false },
  { market: 'Apple $4T valuation', odds: 62, change: +4, volume: '1.8M', closing: '8m', hot: true },
];

// ═══════════════════════════════════════════════════════════════════════════════
// NAVBAR COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function Navbar({ onConnect }: { onConnect: () => void }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`} role="navigation" aria-label="Main navigation">
      <div className="nav-inner">
        <a href="/" className="nav-logo" aria-label="BeRight Home">
          <span className="logo-icon">◉</span>
          <span className="logo-text">BeRight</span>
        </a>

        <div className="nav-links" role="menubar">
          <a href="#how-it-works" className="nav-link" role="menuitem">How it Works</a>
          <a href="#markets" className="nav-link" role="menuitem">Markets</a>
          <a href="#leaderboard" className="nav-link" role="menuitem">Leaderboard</a>
        </div>

        <button className="nav-cta" onClick={onConnect} aria-label="Connect your wallet">
          Connect Wallet
        </button>
      </div>
    </nav>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE WIN TICKER - BRANDED + READABLE
// ═══════════════════════════════════════════════════════════════════════════════

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
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const win = LIVE_WINS[currentWin];

  return (
    <div className={`live-ticker ${isAnimating ? 'slide-out' : ''}`} role="status" aria-live="polite">
      <div className="ticker-brand">
        <span className="brand-icon">◉</span>
        <span className="brand-text">BeRight Live</span>
      </div>
      <div className="ticker-divider" />
      <div className="ticker-content">
        <span className="ticker-avatar" aria-hidden="true">{win.avatar}</span>
        <span className="ticker-user">{win.username}</span>
        <span className="ticker-action">just won</span>
        <span className="ticker-amount">${win.amount.toLocaleString()}</span>
        <span className="ticker-market">on {win.market}</span>
      </div>
      <span className="ticker-time">{win.time} ago</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COUNTING NUMBER ANIMATION
// ═══════════════════════════════════════════════════════════════════════════════

function CountingNumber({
  target,
  prefix = '',
  suffix = '',
  duration = 2000
}: {
  target: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const start = Date.now();
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(target * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);

  return <span ref={ref}>{prefix}{value.toLocaleString()}{suffix}</span>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKET OPPORTUNITY CARD - ENHANCED
// ═══════════════════════════════════════════════════════════════════════════════

function MarketCard({ opp, index }: { opp: typeof HOT_OPPS[0]; index: number }) {
  const isUp = opp.change > 0;
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <article
      className={`market-card ${opp.hot ? 'is-hot' : ''}`}
      style={{ animationDelay: `${index * 80}ms` }}
      tabIndex={0}
      role="button"
      aria-label={`${opp.market}, ${opp.odds}% chance, ${isUp ? 'up' : 'down'} ${Math.abs(opp.change)}%`}
    >
      {opp.hot && <span className="hot-badge">🔥 HOT</span>}

      <div className="card-header">
        <span className="card-closing">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
          {opp.closing}
        </span>
        <span
          className={`card-change ${isUp ? 'up' : 'down'}`}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          aria-describedby={`tooltip-${index}`}
        >
          {isUp ? '↑' : '↓'}{Math.abs(opp.change)}%
          {showTooltip && (
            <span id={`tooltip-${index}`} className="change-tooltip" role="tooltip">
              Odds shift in 24h
            </span>
          )}
        </span>
      </div>

      <h3 className="card-market">{opp.market}</h3>

      <div className="card-odds">
        <div className="odds-bar" role="progressbar" aria-valuenow={opp.odds} aria-valuemin={0} aria-valuemax={100}>
          <div className="odds-fill-yes" style={{ width: `${opp.odds}%` }} />
        </div>
        <div className="odds-labels">
          <span className="label-yes">{opp.odds}% YES</span>
          <span className="label-no">{100 - opp.odds}% NO</span>
        </div>
      </div>

      <div className="card-volume">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
        </svg>
        ${opp.volume} volume
      </div>
    </article>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOW IT WORKS SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function HowItWorks() {
  const steps = [
    {
      icon: '🎯',
      title: 'Predict',
      desc: 'Choose YES or NO on any market',
      detail: 'Find markets on politics, crypto, sports, and more'
    },
    {
      icon: '✅',
      title: 'Win',
      desc: 'Get paid when you\'re right',
      detail: 'Correct predictions pay out at market resolution'
    },
    {
      icon: '💸',
      title: 'Withdraw',
      desc: 'Cash out anytime, instantly',
      detail: 'No lockups. Your money, your control'
    },
  ];

  return (
    <section id="how-it-works" className="how-section" aria-labelledby="how-title">
      <h2 id="how-title" className="section-title">
        <span className="title-icon">⚡</span>
        How It Works
      </h2>
      <p className="section-subtitle">Three steps to start profiting</p>

      <div className="steps-grid">
        {steps.map((step, i) => (
          <div key={i} className="step-card" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="step-number">{i + 1}</div>
            <span className="step-icon">{step.icon}</span>
            <h3 className="step-title">{step.title}</h3>
            <p className="step-desc">{step.desc}</p>
            <p className="step-detail">{step.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRUST SIGNALS SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function TrustSignals() {
  const chains = [
    { name: 'Solana', icon: '◎' },
    { name: 'Ethereum', icon: '⟠' },
    { name: 'Base', icon: '🔵' },
  ];

  const badges = [
    { icon: '🔒', label: 'Audited Smart Contracts' },
    { icon: '⚡', label: 'Instant Settlement' },
    { icon: '🌐', label: 'Non-Custodial' },
  ];

  return (
    <section className="trust-section" aria-label="Trust signals and supported chains">
      <div className="trust-chains">
        <span className="trust-label">Powered by</span>
        <div className="chains-row">
          {chains.map((chain, i) => (
            <div key={i} className="chain-badge">
              <span className="chain-icon">{chain.icon}</span>
              <span className="chain-name">{chain.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="trust-divider" />

      <div className="trust-badges">
        {badges.map((badge, i) => (
          <div key={i} className="security-badge">
            <span className="badge-icon">{badge.icon}</span>
            <span className="badge-label">{badge.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════════════════════════════════════════

function Footer() {
  return (
    <footer className="footer" role="contentinfo">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="footer-logo">
            <span className="logo-icon">◉</span>
            BeRight
          </span>
          <p className="footer-tagline">Predict markets. Get paid.</p>
        </div>

        <div className="footer-links">
          <div className="link-group">
            <h4>Product</h4>
            <a href="#markets">Markets</a>
            <a href="#how-it-works">How it Works</a>
            <a href="#leaderboard">Leaderboard</a>
          </div>
          <div className="link-group">
            <h4>Resources</h4>
            <a href="/docs">Documentation</a>
            <a href="/faq">FAQ</a>
            <a href="/support">Support</a>
          </div>
          <div className="link-group">
            <h4>Legal</h4>
            <a href="/terms">Terms of Service</a>
            <a href="/privacy">Privacy Policy</a>
          </div>
        </div>

        <div className="footer-social">
          <a href="https://twitter.com/beright" aria-label="Twitter" className="social-link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
          <a href="https://t.me/beright" aria-label="Telegram" className="social-link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
            </svg>
          </a>
          <a href="https://discord.gg/beright" aria-label="Discord" className="social-link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
          </a>
        </div>
      </div>

      <div className="footer-bottom">
        <p className="footer-disclaimer">
          Trading involves risk. Past performance is not indicative of future results.
          Only trade with money you can afford to lose.
        </p>
        <p className="footer-copyright">© 2025 BeRight Protocol. All rights reserved.</p>
      </div>
    </footer>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN LANDING COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function LandingHero() {
  const { login, ready } = usePrivy();
  const [todayProfits, setTodayProfits] = useState(847523);

  useEffect(() => {
    const interval = setInterval(() => {
      setTodayProfits(prev => prev + Math.floor(Math.random() * 500));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate(10);
    login();
  }, [login]);

  if (!ready) {
    return (
      <div className="loading-screen" role="status" aria-label="Loading">
        <div className="loading-content">
          <span className="loading-logo">
            <span className="logo-icon pulse">◉</span>
            BeRight
          </span>
          <div className="loading-bar">
            <div className="loading-fill" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="landing">
      {/* Navigation */}
      <Navbar onConnect={handleConnect} />

      {/* Live Ticker */}
      <LiveWinTicker />

      {/* Hero Section */}
      <main className="hero">
        {/* Background Effects */}
        <div className="hero-bg" aria-hidden="true">
          <div className="bg-grid" />
          <div className="bg-glow-center" />
          <div className="bg-glow-left" />
          <div className="bg-glow-right" />
          <div className="bg-noise" />
        </div>

        {/* Hero Content */}
        <div className="hero-content">
          {/* Main Headline */}
          <h1 className="hero-headline">
            <span className="headline-main">
              Start <span className="gradient-text">Profiting</span>
            </span>
          </h1>

          {/* Subheadline */}
          <p className="hero-sub">
            Predict markets. Get paid when you're right.
          </p>

          {/* Stats Chip */}
          <div className="winner-chip">
            <span className="chip-icon">💰</span>
            <span className="chip-text">Average winner: $340/trade</span>
          </div>

          {/* Live Stats Bar */}
          <div className="stats-bar">
            <div className="stat">
              <span className="stat-icon">💵</span>
              <div className="stat-content">
                <span className="stat-label">Paid out today</span>
                <span className="stat-value green">
                  $<CountingNumber target={todayProfits} />
                </span>
              </div>
            </div>

            <div className="stat-divider" />

            <div className="stat">
              <span className="stat-icon">📊</span>
              <div className="stat-content">
                <span className="stat-label">Active markets</span>
                <span className="stat-value">
                  <CountingNumber target={847} />
                </span>
              </div>
            </div>

            <div className="stat-divider" />

            <div className="stat">
              <span className="stat-icon">👥</span>
              <div className="stat-content">
                <span className="stat-label">Online now</span>
                <span className="stat-value">
                  <span className="online-dot" />
                  <CountingNumber target={1247} />
                </span>
              </div>
            </div>
          </div>

          {/* CTA Button - Fixed Width */}
          <button className="cta-button" onClick={handleConnect}>
            <span className="cta-text">Start Making Money</span>
            <span className="cta-arrow">→</span>
          </button>

          {/* Social Proof - Near CTA */}
          <div className="social-proof">
            <span className="proof-icon">🔥</span>
            <span className="proof-text">
              <CountingNumber target={2847} /> traders made money today
            </span>
          </div>

          {/* Micro-copy */}
          <p className="cta-note">
            Connect wallet in 10 seconds · Min bet $1 · Withdraw anytime
          </p>
        </div>

        {/* Hot Markets Section */}
        <section id="markets" className="markets-section" aria-labelledby="markets-title">
          <div className="markets-header">
            <h2 id="markets-title" className="section-title">
              <span className="title-icon">🔥</span>
              Hot Right Now
            </h2>
            <span className="section-subtitle">Markets with edge</span>
          </div>

          <div className="markets-grid">
            {HOT_OPPS.map((opp, i) => (
              <MarketCard key={i} opp={opp} index={i} />
            ))}
          </div>

          <button className="see-all-button" onClick={handleConnect}>
            <span>See all 847 markets</span>
            <span className="button-arrow">→</span>
          </button>
        </section>

        {/* How It Works */}
        <HowItWorks />

        {/* Trust Signals */}
        <TrustSignals />
      </main>

      {/* Footer */}
      <Footer />

      {/* Mobile Sticky CTA */}
      <div className="sticky-cta" aria-hidden="true">
        <div className="sticky-inner">
          <div className="sticky-info">
            <span className="live-dot" />
            <span className="sticky-amount">$<CountingNumber target={todayProfits} /></span>
            <span className="sticky-label">paid today</span>
          </div>
          <button className="sticky-button" onClick={handleConnect}>
            Start Now
          </button>
        </div>
      </div>

      <style jsx global>{`
        /* ═══════════════════════════════════════════════════════════════════════
           BERIGHT LANDING v2.0 - PREMIUM FINTECH TERMINAL
           ═══════════════════════════════════════════════════════════════════════ */

        @import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600;700&display=swap');

        /* CSS Variables */
        :root {
          --color-bg: #0A0A0B;
          --color-surface: #111113;
          --color-border: rgba(255, 255, 255, 0.08);
          --color-border-hover: rgba(255, 255, 255, 0.15);
          --color-text: #FFFFFF;
          --color-text-secondary: rgba(255, 255, 255, 0.7);
          --color-text-tertiary: rgba(255, 255, 255, 0.5);
          --color-green: #00FF88;
          --color-green-dim: rgba(0, 255, 136, 0.15);
          --color-cyan: #00D4FF;
          --color-amber: #FFB800;
          --color-red: #FF4757;
          --font-display: 'Satoshi', system-ui, sans-serif;
          --font-mono: 'IBM Plex Mono', 'SF Mono', monospace;
        }

        /* Reset & Base */
        .landing {
          min-height: 100dvh;
          background: var(--color-bg);
          color: var(--color-text);
          font-family: var(--font-display);
          overflow-x: hidden;
          -webkit-font-smoothing: antialiased;
        }

        /* Focus states for accessibility */
        *:focus-visible {
          outline: 2px solid var(--color-green);
          outline-offset: 2px;
        }

        /* ═══════════════════════════════════════════════════════════════════════
           NAVBAR
           ═══════════════════════════════════════════════════════════════════════ */

        .navbar {
          position: fixed;
          top: 40px;
          left: 0;
          right: 0;
          z-index: 50;
          padding: 0 20px;
          transition: all 0.3s ease;
        }

        .navbar.scrolled {
          top: 0;
          background: rgba(10, 10, 11, 0.9);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--color-border);
        }

        .nav-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 0;
        }

        .nav-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          color: var(--color-text);
          font-weight: 700;
          font-size: 20px;
        }

        .logo-icon {
          color: var(--color-green);
          font-size: 24px;
        }

        .nav-links {
          display: flex;
          gap: 32px;
        }

        .nav-link {
          color: var(--color-text-secondary);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: color 0.2s;
        }

        .nav-link:hover {
          color: var(--color-text);
        }

        .nav-cta {
          padding: 10px 20px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 10px;
          color: var(--color-text);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }

        .nav-cta:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: var(--color-border-hover);
        }

        /* ═══════════════════════════════════════════════════════════════════════
           LIVE TICKER - BRANDED
           ═══════════════════════════════════════════════════════════════════════ */

        .live-ticker {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 10px 20px;
          background: linear-gradient(90deg, var(--color-green-dim) 0%, rgba(0, 200, 100, 0.08) 100%);
          border-bottom: 1px solid rgba(0, 255, 136, 0.2);
          font-size: 13px;
          transition: transform 0.3s ease;
        }

        .live-ticker.slide-out {
          transform: translateY(-100%);
        }

        .ticker-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 12px;
          background: rgba(0, 255, 136, 0.15);
          border-radius: 6px;
          flex-shrink: 0;
        }

        .brand-icon {
          color: var(--color-green);
          font-size: 12px;
        }

        .brand-text {
          font-weight: 700;
          font-size: 11px;
          letter-spacing: 0.5px;
          color: var(--color-green);
          text-transform: uppercase;
        }

        .ticker-divider {
          width: 1px;
          height: 20px;
          background: rgba(255, 255, 255, 0.15);
        }

        .ticker-content {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          min-width: 0;
        }

        .ticker-avatar {
          font-size: 16px;
        }

        .ticker-user {
          font-weight: 600;
          color: var(--color-text);
        }

        .ticker-action {
          color: var(--color-text-tertiary);
        }

        .ticker-amount {
          font-weight: 700;
          color: var(--color-green);
          font-family: var(--font-mono);
        }

        .ticker-market {
          color: var(--color-text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ticker-time {
          color: var(--color-text-tertiary);
          font-size: 12px;
          flex-shrink: 0;
        }

        /* ═══════════════════════════════════════════════════════════════════════
           HERO SECTION
           ═══════════════════════════════════════════════════════════════════════ */

        .hero {
          padding: 140px 20px 80px;
          max-width: 1200px;
          margin: 0 auto;
          position: relative;
        }

        .hero-bg {
          position: fixed;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }

        .bg-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, black, transparent);
        }

        .bg-glow-center {
          position: absolute;
          width: 800px;
          height: 800px;
          left: 50%;
          top: 20%;
          transform: translateX(-50%);
          background: radial-gradient(circle, rgba(0, 255, 136, 0.08) 0%, transparent 60%);
          filter: blur(80px);
        }

        .bg-glow-left {
          position: absolute;
          width: 500px;
          height: 500px;
          left: -200px;
          top: 30%;
          background: radial-gradient(circle, rgba(0, 212, 255, 0.06) 0%, transparent 60%);
          filter: blur(60px);
        }

        .bg-glow-right {
          position: absolute;
          width: 400px;
          height: 400px;
          right: -150px;
          bottom: 20%;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.06) 0%, transparent 60%);
          filter: blur(60px);
        }

        .bg-noise {
          position: absolute;
          inset: 0;
          opacity: 0.04;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }

        .hero-content {
          position: relative;
          z-index: 10;
          text-align: center;
          max-width: 720px;
          margin: 0 auto 80px;
        }

        /* Headline */
        .hero-headline {
          margin: 0 0 20px;
          animation: fadeUp 0.6s ease-out;
        }

        .headline-main {
          display: block;
          font-size: 72px;
          font-weight: 900;
          line-height: 1.05;
          letter-spacing: -3px;
        }

        .gradient-text {
          background: linear-gradient(135deg, var(--color-green) 0%, var(--color-cyan) 60%, #A855F7 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-sub {
          font-size: 20px;
          color: var(--color-text-secondary);
          line-height: 1.5;
          margin: 0 0 20px;
          animation: fadeUp 0.6s ease-out 0.1s both;
        }

        /* Winner Chip */
        .winner-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: linear-gradient(135deg, rgba(255, 184, 0, 0.15) 0%, rgba(255, 184, 0, 0.05) 100%);
          border: 1px solid rgba(255, 184, 0, 0.3);
          border-radius: 100px;
          margin-bottom: 32px;
          animation: fadeUp 0.6s ease-out 0.15s both;
        }

        .chip-icon {
          font-size: 16px;
        }

        .chip-text {
          font-size: 14px;
          font-weight: 600;
          color: var(--color-amber);
        }

        /* Stats Bar */
        .stats-bar {
          display: flex;
          align-items: stretch;
          justify-content: center;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 16px;
          margin-bottom: 32px;
          animation: fadeUp 0.6s ease-out 0.2s both;
          overflow: hidden;
        }

        .stat {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 20px 28px;
        }

        .stat-icon {
          font-size: 24px;
        }

        .stat-content {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
        }

        .stat-label {
          font-size: 11px;
          color: var(--color-text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat-value {
          font-size: 22px;
          font-weight: 700;
          font-family: var(--font-mono);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .stat-value.green {
          color: var(--color-green);
        }

        .stat-divider {
          width: 1px;
          background: var(--color-border);
        }

        .online-dot {
          width: 8px;
          height: 8px;
          background: var(--color-green);
          border-radius: 50%;
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }

        /* CTA Button */
        .cta-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 340px;
          max-width: 100%;
          padding: 22px 40px;
          background: linear-gradient(135deg, var(--color-green) 0%, #00CC6A 100%);
          border: none;
          border-radius: 14px;
          color: #000;
          font-size: 18px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.3s ease;
          animation: fadeUp 0.6s ease-out 0.25s both;
          position: relative;
          overflow: hidden;
        }

        .cta-button::before {
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

        .cta-button:hover {
          transform: translateY(-3px);
          box-shadow: 0 20px 60px rgba(0, 255, 136, 0.35);
        }

        .cta-button:active {
          transform: translateY(-1px);
        }

        .cta-arrow {
          font-size: 22px;
          transition: transform 0.2s;
        }

        .cta-button:hover .cta-arrow {
          transform: translateX(4px);
        }

        /* Social Proof */
        .social-proof {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 20px;
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--color-border);
          border-radius: 100px;
          animation: fadeUp 0.6s ease-out 0.3s both;
        }

        .proof-icon {
          font-size: 14px;
        }

        .proof-text {
          font-size: 13px;
          color: var(--color-text-secondary);
          font-weight: 500;
        }

        /* Micro-copy */
        .cta-note {
          font-size: 13px;
          color: var(--color-text-tertiary);
          margin: 16px 0 0;
          animation: fadeUp 0.6s ease-out 0.35s both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ═══════════════════════════════════════════════════════════════════════
           MARKETS SECTION
           ═══════════════════════════════════════════════════════════════════════ */

        .markets-section {
          position: relative;
          z-index: 10;
          margin-bottom: 100px;
        }

        .markets-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .section-title {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-size: 28px;
          font-weight: 700;
          margin: 0 0 8px;
        }

        .title-icon {
          font-size: 32px;
        }

        .section-subtitle {
          font-size: 15px;
          color: var(--color-text-tertiary);
        }

        .markets-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        /* Market Card */
        .market-card {
          position: relative;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 16px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.3s ease;
          animation: fadeUp 0.5s ease-out both;
        }

        .market-card:hover {
          transform: translateY(-4px);
          border-color: rgba(0, 255, 136, 0.3);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4), 0 0 20px rgba(0, 255, 136, 0.1);
        }

        .market-card.is-hot {
          border-color: rgba(255, 184, 0, 0.3);
        }

        .market-card.is-hot:hover {
          border-color: rgba(255, 184, 0, 0.5);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4), 0 0 20px rgba(255, 184, 0, 0.1);
        }

        .hot-badge {
          position: absolute;
          top: -8px;
          right: 16px;
          padding: 4px 10px;
          background: linear-gradient(135deg, var(--color-amber) 0%, #FF8C00 100%);
          border-radius: 6px;
          font-size: 10px;
          font-weight: 700;
          color: #000;
          letter-spacing: 0.5px;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .card-closing {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--color-text-tertiary);
        }

        .card-change {
          position: relative;
          font-size: 13px;
          font-weight: 700;
          font-family: var(--font-mono);
          cursor: help;
        }

        .card-change.up { color: var(--color-green); }
        .card-change.down { color: var(--color-red); }

        .change-tooltip {
          position: absolute;
          top: -32px;
          left: 50%;
          transform: translateX(-50%);
          padding: 6px 10px;
          background: var(--color-text);
          color: var(--color-bg);
          font-size: 11px;
          font-weight: 500;
          border-radius: 6px;
          white-space: nowrap;
          pointer-events: none;
          z-index: 10;
        }

        .change-tooltip::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 50%;
          transform: translateX(-50%);
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-top: 5px solid var(--color-text);
        }

        .card-market {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 16px;
          line-height: 1.3;
          color: var(--color-text);
        }

        .card-odds {
          margin-bottom: 14px;
        }

        .odds-bar {
          height: 8px;
          background: rgba(255, 71, 87, 0.25);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .odds-fill-yes {
          height: 100%;
          background: linear-gradient(90deg, var(--color-green), #00CC6A);
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .odds-labels {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          font-family: var(--font-mono);
          font-weight: 600;
        }

        .label-yes { color: var(--color-green); }
        .label-no { color: var(--color-red); }

        .card-volume {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--color-text-tertiary);
        }

        /* See All Button */
        .see-all-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 16px;
          background: transparent;
          border: 1px solid var(--color-border-hover);
          border-radius: 12px;
          color: var(--color-text);
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }

        .see-all-button:hover {
          background: rgba(255, 255, 255, 0.03);
          border-color: var(--color-text-tertiary);
        }

        .button-arrow {
          transition: transform 0.2s;
        }

        .see-all-button:hover .button-arrow {
          transform: translateX(4px);
        }

        /* ═══════════════════════════════════════════════════════════════════════
           HOW IT WORKS
           ═══════════════════════════════════════════════════════════════════════ */

        .how-section {
          position: relative;
          z-index: 10;
          margin-bottom: 100px;
          text-align: center;
        }

        .steps-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          margin-top: 40px;
        }

        .step-card {
          position: relative;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 20px;
          padding: 32px 24px;
          text-align: center;
          animation: fadeUp 0.5s ease-out both;
        }

        .step-number {
          position: absolute;
          top: -12px;
          left: 24px;
          width: 24px;
          height: 24px;
          background: var(--color-green);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          color: #000;
        }

        .step-icon {
          display: block;
          font-size: 48px;
          margin-bottom: 16px;
        }

        .step-title {
          font-size: 20px;
          font-weight: 700;
          margin: 0 0 8px;
        }

        .step-desc {
          font-size: 15px;
          color: var(--color-text-secondary);
          margin: 0 0 12px;
        }

        .step-detail {
          font-size: 13px;
          color: var(--color-text-tertiary);
          margin: 0;
        }

        /* ═══════════════════════════════════════════════════════════════════════
           TRUST SIGNALS
           ═══════════════════════════════════════════════════════════════════════ */

        .trust-section {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 40px;
          padding: 40px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 20px;
          margin-bottom: 80px;
        }

        .trust-label {
          font-size: 12px;
          color: var(--color-text-tertiary);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 12px;
          display: block;
        }

        .chains-row {
          display: flex;
          gap: 16px;
        }

        .chain-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--color-border);
          border-radius: 8px;
        }

        .chain-icon {
          font-size: 18px;
        }

        .chain-name {
          font-size: 13px;
          font-weight: 600;
        }

        .trust-divider {
          width: 1px;
          height: 60px;
          background: var(--color-border);
        }

        .trust-badges {
          display: flex;
          gap: 24px;
        }

        .security-badge {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .badge-icon {
          font-size: 20px;
        }

        .badge-label {
          font-size: 13px;
          color: var(--color-text-secondary);
          font-weight: 500;
        }

        /* ═══════════════════════════════════════════════════════════════════════
           FOOTER
           ═══════════════════════════════════════════════════════════════════════ */

        .footer {
          position: relative;
          z-index: 10;
          background: var(--color-surface);
          border-top: 1px solid var(--color-border);
          padding: 60px 20px 30px;
        }

        .footer-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 2fr 1fr;
          gap: 40px;
          padding-bottom: 40px;
          border-bottom: 1px solid var(--color-border);
        }

        .footer-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 20px;
          font-weight: 700;
          color: var(--color-text);
        }

        .footer-tagline {
          font-size: 14px;
          color: var(--color-text-tertiary);
          margin: 12px 0 0;
        }

        .footer-links {
          display: flex;
          justify-content: center;
          gap: 60px;
        }

        .link-group h4 {
          font-size: 12px;
          color: var(--color-text-tertiary);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 0 0 16px;
        }

        .link-group a {
          display: block;
          font-size: 14px;
          color: var(--color-text-secondary);
          text-decoration: none;
          margin-bottom: 10px;
          transition: color 0.2s;
        }

        .link-group a:hover {
          color: var(--color-text);
        }

        .footer-social {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .social-link {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--color-border);
          border-radius: 10px;
          color: var(--color-text-secondary);
          transition: all 0.2s;
        }

        .social-link:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: var(--color-border-hover);
          color: var(--color-text);
        }

        .footer-bottom {
          max-width: 1200px;
          margin: 0 auto;
          padding-top: 30px;
          text-align: center;
        }

        .footer-disclaimer {
          font-size: 12px;
          color: var(--color-text-tertiary);
          margin: 0 0 12px;
          line-height: 1.6;
        }

        .footer-copyright {
          font-size: 12px;
          color: var(--color-text-tertiary);
          margin: 0;
        }

        /* ═══════════════════════════════════════════════════════════════════════
           STICKY MOBILE CTA
           ═══════════════════════════════════════════════════════════════════════ */

        .sticky-cta {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 90;
          padding: 12px 16px;
          padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
          background: rgba(10, 10, 11, 0.95);
          border-top: 1px solid var(--color-border);
          backdrop-filter: blur(20px);
        }

        .sticky-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 500px;
          margin: 0 auto;
        }

        .sticky-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .live-dot {
          width: 8px;
          height: 8px;
          background: var(--color-green);
          border-radius: 50%;
          animation: pulse 1.5s ease-in-out infinite;
        }

        .sticky-amount {
          font-family: var(--font-mono);
          font-weight: 700;
          font-size: 16px;
          color: var(--color-green);
        }

        .sticky-label {
          font-size: 13px;
          color: var(--color-text-tertiary);
        }

        .sticky-button {
          padding: 12px 28px;
          background: linear-gradient(135deg, var(--color-green) 0%, #00CC6A 100%);
          border: none;
          border-radius: 10px;
          color: #000;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }

        .sticky-button:hover {
          transform: scale(1.02);
          box-shadow: 0 8px 24px rgba(0, 255, 136, 0.3);
        }

        /* ═══════════════════════════════════════════════════════════════════════
           LOADING SCREEN
           ═══════════════════════════════════════════════════════════════════════ */

        .loading-screen {
          min-height: 100dvh;
          background: var(--color-bg);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .loading-content {
          text-align: center;
        }

        .loading-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 28px;
          font-weight: 700;
          color: var(--color-text);
          margin-bottom: 24px;
        }

        .loading-logo .logo-icon.pulse {
          animation: pulse 1s ease-in-out infinite;
        }

        .loading-bar {
          width: 120px;
          height: 3px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          overflow: hidden;
          margin: 0 auto;
        }

        .loading-fill {
          width: 30%;
          height: 100%;
          background: linear-gradient(90deg, var(--color-green), #00CC6A);
          border-radius: 2px;
          animation: loadingSlide 1s ease-in-out infinite;
        }

        @keyframes loadingSlide {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(200%); }
          100% { transform: translateX(-100%); }
        }

        /* ═══════════════════════════════════════════════════════════════════════
           RESPONSIVE DESIGN
           ═══════════════════════════════════════════════════════════════════════ */

        @media (max-width: 1024px) {
          .markets-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .trust-section {
            flex-direction: column;
            gap: 24px;
          }

          .trust-divider {
            width: 100%;
            height: 1px;
          }

          .footer-inner {
            grid-template-columns: 1fr;
            text-align: center;
          }

          .footer-links {
            justify-content: center;
          }

          .footer-social {
            justify-content: center;
          }
        }

        @media (max-width: 768px) {
          .navbar {
            top: 36px;
          }

          .nav-links {
            display: none;
          }

          .hero {
            padding: 120px 16px 60px;
          }

          .headline-main {
            font-size: 42px;
            letter-spacing: -2px;
          }

          .hero-sub {
            font-size: 17px;
          }

          .stats-bar {
            flex-direction: column;
            gap: 0;
          }

          .stat {
            padding: 16px 20px;
            justify-content: center;
          }

          .stat-divider {
            width: 80%;
            height: 1px;
          }

          .cta-button {
            width: 100%;
            padding: 20px 32px;
          }

          .markets-grid {
            grid-template-columns: 1fr;
          }

          .steps-grid {
            grid-template-columns: 1fr;
          }

          .live-ticker {
            font-size: 12px;
            padding: 8px 12px;
          }

          .ticker-market {
            display: none;
          }

          .sticky-cta {
            display: block;
          }

          .footer-links {
            flex-direction: column;
            gap: 32px;
          }

          .trust-badges {
            flex-direction: column;
            align-items: center;
            gap: 16px;
          }
        }

        @media (max-width: 480px) {
          .hero {
            padding: 100px 12px 50px;
          }

          .headline-main {
            font-size: 32px;
            letter-spacing: -1px;
          }

          .hero-sub {
            font-size: 15px;
          }

          .winner-chip {
            padding: 6px 12px;
          }

          .chip-text {
            font-size: 12px;
          }

          .section-title {
            font-size: 22px;
          }

          .market-card {
            padding: 16px;
          }

          .step-card {
            padding: 24px 20px;
          }

          .sticky-inner {
            gap: 10px;
          }

          .sticky-amount {
            font-size: 14px;
          }

          .sticky-button {
            padding: 10px 20px;
            font-size: 14px;
          }
        }

        /* Hide sticky CTA on desktop */
        @media (min-width: 769px) {
          .sticky-cta {
            display: none !important;
          }
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .live-dot,
          .online-dot,
          .loading-fill,
          .cta-button::before {
            animation: none;
          }

          .hero-headline,
          .hero-sub,
          .winner-chip,
          .stats-bar,
          .cta-button,
          .social-proof,
          .cta-note,
          .market-card,
          .step-card {
            animation: none;
            opacity: 1;
            transform: none;
          }

          .live-ticker.slide-out {
            transform: none;
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
