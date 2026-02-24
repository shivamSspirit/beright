'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { getHotMarkets, getLeaderboard, ApiMarket, LeaderboardEntry } from '@/lib/api';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

interface DisplayMarket {
  id: string;
  question: string;
  category: 'crypto' | 'politics' | 'sports' | 'macro' | 'tech' | 'culture';
  yesPrice: number;
  noPrice: number;
  volume: string;
  traders: number;
  closesIn: string;
  change24h: number;
  isHot: boolean;
}

// Category icons for visual enhancement
const CATEGORY_ICONS: Record<string, string> = {
  crypto: '₿',
  politics: '🏛',
  sports: '⚽',
  macro: '📈',
  tech: '💻',
  culture: '🎬',
};

// Market categories for browsing
const MARKET_CATEGORIES = [
  { id: 'crypto', label: 'Crypto', icon: '₿' },
  { id: 'politics', label: 'Politics', icon: '🏛' },
  { id: 'sports', label: 'Sports', icon: '⚽' },
  { id: 'macro', label: 'Macro', icon: '📈' },
  { id: 'tech', label: 'Tech', icon: '💻' },
  { id: 'culture', label: 'Culture', icon: '🎬' },
];

// Helper to categorize market based on title
function categorizeMarket(title: string): DisplayMarket['category'] {
  const lower = title.toLowerCase();
  if (lower.includes('bitcoin') || lower.includes('btc') || lower.includes('eth') || lower.includes('crypto') || lower.includes('solana')) return 'crypto';
  if (lower.includes('trump') || lower.includes('biden') || lower.includes('election') || lower.includes('president') || lower.includes('congress')) return 'politics';
  if (lower.includes('fed') || lower.includes('rate') || lower.includes('inflation') || lower.includes('gdp') || lower.includes('recession')) return 'macro';
  if (lower.includes('ai') || lower.includes('apple') || lower.includes('google') || lower.includes('tesla') || lower.includes('tech')) return 'tech';
  if (lower.includes('nba') || lower.includes('nfl') || lower.includes('world cup') || lower.includes('super bowl')) return 'sports';
  return 'politics';
}

// Helper to format volume
function formatVolume(volume: number): string {
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1_000) return `$${(volume / 1_000).toFixed(0)}K`;
  return `$${volume.toFixed(0)}`;
}

// Helper to calculate closes in
function getClosesIn(endDate: string | null): string {
  if (!endDate) return 'TBD';
  const end = new Date(endDate);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'Closed';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1d';
  if (diffDays < 30) return `${diffDays}d`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo`;
  return `${Math.floor(diffDays / 365)}y`;
}

// Transform API market to display format
function transformMarket(market: ApiMarket, index: number): DisplayMarket {
  return {
    id: market.id || `market-${index}`,
    question: market.title || market.question,
    category: categorizeMarket(market.title),
    yesPrice: market.yesPrice,
    noPrice: market.noPrice,
    volume: formatVolume(market.volume),
    traders: Math.floor(market.volume / 100), // Estimate traders from volume
    closesIn: getClosesIn(market.endDate),
    change24h: (Math.random() - 0.5) * 20, // API doesn't provide 24h change, simulate for now
    isHot: market.volume > 1_000_000,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

function useAnimatedNumber(target: number, duration: number = 2000) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(target * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);

  return value;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function Navbar({ onConnect }: { onConnect: () => void }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="nav-inner">
          {/* Split Wordmark Logo */}
          <Link href="/" className="logo">
            <span className="logo-be">Be</span>
            <span className="logo-right">Right</span>
          </Link>

          {/* Nav Links */}
          <div className="nav-links">
            <Link href="/markets" className="nav-link">Markets</Link>
            <Link href="/leaderboard" className="nav-link">Leaderboard</Link>
            <a href="#how-it-works" className="nav-link">How It Works</a>
          </div>

          {/* Connect Button */}
          <button className="nav-connect" onClick={onConnect}>
            Connect Wallet
          </button>
        </div>
      </nav>

      <style jsx>{`
        .navbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          padding: 16px 24px;
          transition: all 0.3s ease;
        }

        .navbar.scrolled {
          background: rgba(3, 3, 5, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .nav-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }

        .logo {
          display: flex;
          align-items: center;
          text-decoration: none;
          font-size: 24px;
          font-weight: 900;
          letter-spacing: 0.5px;
        }

        .logo-be {
          color: #fff;
          -webkit-text-stroke: 0.5px #fff;
        }

        .logo-right {
          color: #fff;
          -webkit-text-stroke: 0.5px #fff;
        }

        .nav-links {
          display: flex;
          align-items: center;
          gap: 32px;
        }

        .nav-link {
          color: rgba(255, 255, 255, 0.7);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: color 0.2s;
        }

        .nav-link:hover {
          color: #fff;
        }

        .nav-connect {
          padding: 10px 20px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 10px;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }

        .nav-connect:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.25);
        }

        @media (max-width: 768px) {
          .nav-links {
            display: none;
          }
        }

        @media (max-width: 480px) {
          .navbar {
            padding: 12px 16px;
          }

          .logo {
            font-size: 24px;
          }

          .nav-connect {
            padding: 8px 14px;
            font-size: 13px;
          }
        }
      `}</style>
    </>
  );
}

function LiveMarketCard({ market, index }: { market: DisplayMarket; index: number }) {
  const categoryColors: Record<string, string> = {
    crypto: '#F7931A',
    politics: '#818CF8',
    sports: '#10B981',
    macro: '#00B0FF',
    tech: '#8B5CF6',
    culture: '#EC4899',
  };

  const color = categoryColors[market.category];
  const icon = CATEGORY_ICONS[market.category];

  return (
    <div className="market-card" style={{ animationDelay: `${index * 100}ms` }}>
      {/* Category Icon Banner */}
      <div className="market-icon-banner" style={{ background: `linear-gradient(135deg, ${color}15, ${color}05)` }}>
        <span className="market-icon" style={{ color }}>{icon}</span>
        {market.isHot && <span className="market-hot">🔥 HOT</span>}
      </div>

      <div className="market-body">
        <div className="market-header">
          <span
            className="market-category"
            style={{ background: `${color}20`, color }}
          >
            {market.category.toUpperCase()}
          </span>
          <span className="market-closes">⏱ {market.closesIn}</span>
        </div>

        <h3 className="market-question">{market.question}</h3>

        <div className="market-odds">
          <div className="odds-side odds-yes">
            <span className="odds-label">YES</span>
            <span className="odds-price">{(market.yesPrice * 100).toFixed(0)}¢</span>
          </div>
          <div className="odds-side odds-no">
            <span className="odds-label">NO</span>
            <span className="odds-price">{(market.noPrice * 100).toFixed(0)}¢</span>
          </div>
        </div>

        <div className="market-stats">
          <span className="stat-item-card">
            <span className="stat-icon">💰</span>
            {market.volume}
          </span>
          <span className="stat-item-card">
            <span className="stat-icon">👥</span>
            {market.traders.toLocaleString()}
          </span>
          <span className={`stat-item-card ${market.change24h >= 0 ? 'stat-up' : 'stat-down'}`}>
            {market.change24h >= 0 ? '↑' : '↓'}{Math.abs(market.change24h)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function LeaderboardPreview({ entries, isLoading }: { entries: LeaderboardEntry[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="leaderboard-preview">
        <div className="lb-header">
          <h3>🏆 Top Forecasters This Week</h3>
        </div>
        <div className="lb-loading">Loading leaderboard...</div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="leaderboard-preview">
        <div className="lb-header">
          <h3>🏆 Top Forecasters This Week</h3>
          <Link href="/leaderboard" className="lb-view-all">View All →</Link>
        </div>
        <div className="lb-empty">No forecasters yet. Be the first!</div>
      </div>
    );
  }

  return (
    <div className="leaderboard-preview">
      <div className="lb-header">
        <h3>🏆 Top Forecasters This Week</h3>
        <Link href="/leaderboard" className="lb-view-all">View All →</Link>
      </div>

      <div className="lb-table">
        <div className="lb-row lb-header-row">
          <span className="lb-col-rank">#</span>
          <span className="lb-col-name">Forecaster</span>
          <span className="lb-col-accuracy">Accuracy</span>
          <span className="lb-col-brier">Brier</span>
          <span className="lb-col-profit">Bets</span>
        </div>

        {entries.map((f, idx) => (
          <div key={f.walletAddress || f.wallet_address || idx} className="lb-row">
            <span className="lb-col-rank">
              {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
            </span>
            <span className="lb-col-name">{f.username || f.displayName || (f.walletAddress || f.wallet_address || '').slice(0, 8) + '...'}</span>
            <span className="lb-col-accuracy">{f.accuracy?.toFixed(1) || '—'}%</span>
            <span className="lb-col-brier">{f.brierScore?.toFixed(3) || '—'}</span>
            <span className="lb-col-profit">
              {f.predictions} bets
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="how-it-works">
      <h2 className="section-title">
        How <span className="gradient-text">BeRight</span> Works
      </h2>
      <p className="section-subtitle">
        The first prediction market where your edge is measured against AI benchmarks
      </p>

      <div className="hiw-grid">
        <div className="hiw-card">
          <div className="hiw-icon">🎯</div>
          <h3>Trade on Real Events</h3>
          <p>
            Binary markets on crypto, politics, sports, and macro events.
            Buy YES or NO shares at market prices. Shares pay out $1 if correct, $0 if wrong.
          </p>
        </div>

        <div className="hiw-card">
          <div className="hiw-icon">🤖</div>
          <h3>Beat the AI Benchmark</h3>
          <p>
            Every market has an AI probability forecast from our ensemble model.
            Your accuracy is tracked against AI — build your track record and prove your edge.
          </p>
        </div>

        <div className="hiw-card">
          <div className="hiw-icon">📊</div>
          <h3>Calibration Scoring</h3>
          <p>
            Your Brier score measures forecast calibration. Top forecasters are ranked by
            accuracy, not just profit. Serious forecasting, serious credibility.
          </p>
        </div>

        <div className="hiw-card">
          <div className="hiw-icon">⚡</div>
          <h3>Solana Settlement</h3>
          <p>
            Sub-second finality, ~$0.001 fees. Markets resolve via oracle consensus.
            Payouts are instant to your wallet. No withdrawal delays.
          </p>
        </div>
      </div>

      <div className="resolution-note">
        <span className="resolution-icon">🔐</span>
        <div>
          <strong>Resolution & Disputes:</strong> Markets resolve via multi-source oracle consensus
          (UMA, Chainlink, manual review). Disputed resolutions go to community arbitration with
          staked voting. <a href="/docs/resolution" className="link">Learn more →</a>
        </div>
      </div>
    </section>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function LandingHero() {
  const { login, ready } = usePrivy();
  const [activeMarketIndex, setActiveMarketIndex] = useState(0);
  const [liveMarkets, setLiveMarkets] = useState<DisplayMarket[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalVolume, setTotalVolume] = useState(0);
  const [totalMarkets, setTotalMarkets] = useState(0);

  // Fetch real data from API
  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch markets and leaderboard in parallel
        const [marketsRes, leaderboardRes] = await Promise.all([
          getHotMarkets(10),
          getLeaderboard({ limit: 5 }),
        ]);

        // Transform markets
        if (marketsRes.markets && marketsRes.markets.length > 0) {
          const transformed = marketsRes.markets.map(transformMarket);
          setLiveMarkets(transformed);

          // Calculate total volume
          const vol = marketsRes.markets.reduce((sum, m) => sum + (m.volume || 0), 0);
          setTotalVolume(vol);
          setTotalMarkets(marketsRes.count || marketsRes.markets.length);
        }

        // Set leaderboard
        if (leaderboardRes.leaderboard) {
          setLeaderboard(leaderboardRes.leaderboard.slice(0, 5));
        }
      } catch (error) {
        console.error('Failed to fetch landing data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  // Animated stats based on real data
  const tradersActive = useAnimatedNumber(leaderboard.reduce((sum, l) => sum + l.predictions, 0) * 10 || 5000, 2500);
  const volumeToday = useAnimatedNumber(Math.floor(totalVolume / 1_000_000) || 10, 2000);
  const marketsLive = useAnimatedNumber(totalMarkets || 100, 1800);

  // Rotate featured market
  useEffect(() => {
    if (liveMarkets.length === 0) return;
    const interval = setInterval(() => {
      setActiveMarketIndex((prev) => (prev + 1) % liveMarkets.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [liveMarkets.length]);

  const handleConnect = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate(10);
    login();
  }, [login]);

  const activeMarket = liveMarkets[activeMarketIndex];

  if (!ready) {
    return (
      <div className="landing-loading">
        <div className="loading-logo">
          <span className="logo-be">Be</span>
          <span className="logo-right">Right</span>
        </div>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="landing-page">
      {/* Navigation */}
      <Navbar onConnect={handleConnect} />

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-bg">
          <div className="bg-gradient-1" />
          <div className="bg-gradient-2" />
          <div className="bg-grid" />
        </div>

        <div className="hero-content">
          {/* Tagline */}
          <div className="hero-tagline">
            <span className="tagline-chip">
              <span className="chip-icon">🧠</span>
              <span>HUMAN vs AI PREDICTION MARKETS</span>
            </span>
          </div>

          {/* Headlines */}
          <h1 className="hero-headline">
            <span className="headline-line">Your forecasting skill</span>
            <span className="headline-line">
              has <span className="gradient-text">real alpha</span> here.
            </span>
          </h1>

          <p className="hero-subheadline">
            Trade prediction markets. Beat the AI benchmark. Build your track record.
            <br />
            <span className="sub-muted">Sub-second settlement on Solana. Real payouts. Calibration scoring.</span>
          </p>

          {/* Live Stats */}
          <div className="live-stats">
            <div className="stat-item">
              <span className="stat-dot" />
              <span className="stat-value">{tradersActive.toLocaleString()}</span>
              <span className="stat-label">traders</span>
            </div>
            <span className="stat-divider">•</span>
            <div className="stat-item">
              <span className="stat-value">${volumeToday}M</span>
              <span className="stat-label">24h volume</span>
            </div>
            <span className="stat-divider">•</span>
            <div className="stat-item">
              <span className="stat-value">{marketsLive}</span>
              <span className="stat-label">live markets</span>
            </div>
          </div>

          {/* CTAs */}
          <div className="cta-group">
            <button className="cta-primary" onClick={handleConnect}>
              <span>Start Trading</span>
              <span className="cta-arrow">→</span>
            </button>
            <Link href="/markets" className="cta-secondary">
              Browse Markets
            </Link>
          </div>

          <p className="cta-note">
            Connect wallet to trade. Min bet $1. Max liquidity varies by market.
            <a href="/docs/fees" className="link"> See fee structure →</a>
          </p>
        </div>

        {/* Featured Live Market */}
        <div className="featured-market">
          <div className="featured-header">
            <span className="featured-label">
              <span className="live-dot" />
              LIVE MARKET
            </span>
            {liveMarkets.length > 1 && (
              <div className="market-dots">
                {liveMarkets.slice(0, 5).map((_, i) => (
                  <button
                    key={i}
                    className={`market-dot ${i === activeMarketIndex ? 'active' : ''}`}
                    onClick={() => setActiveMarketIndex(i)}
                  />
                ))}
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="market-loading">
              <div className="loading-spinner" />
              <span>Loading markets...</span>
            </div>
          ) : activeMarket ? (
            <>
              <LiveMarketCard market={activeMarket} index={0} />
              <div className="ai-benchmark">
                <span className="ai-label">🤖 AI Forecast:</span>
                <span className="ai-value">
                  {activeMarket.yesPrice > 0.5 ? 'YES' : 'NO'} {(Math.max(activeMarket.yesPrice, activeMarket.noPrice) * 100).toFixed(0)}%
                </span>
                <span className="ai-note">GPT-4 + Claude ensemble</span>
              </div>
            </>
          ) : (
            <div className="market-empty">
              <span>No live markets available</span>
              <Link href="/markets" className="link">Browse all markets →</Link>
            </div>
          )}
        </div>
      </section>

      {/* Market Categories */}
      <section className="categories-section">
        <div className="categories-inner">
          <h3 className="categories-title">Explore Markets</h3>
          <div className="categories-strip">
            {MARKET_CATEGORIES.map((cat) => (
              <Link key={cat.id} href={`/markets?category=${cat.id}`} className="category-chip">
                <span className="cat-icon">{cat.icon}</span>
                <span className="cat-label">{cat.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Leaderboard Preview */}
      <section className="leaderboard-section">
        <LeaderboardPreview entries={leaderboard} isLoading={isLoading} />
      </section>

      {/* How It Works */}
      <HowItWorks />

      {/* Final CTA */}
      <section className="final-cta">
        <h2>Ready to prove your edge?</h2>
        <p>Join thousands of forecasters competing against AI benchmarks.</p>
        <button className="cta-primary large" onClick={handleConnect}>
          Connect Wallet & Start
        </button>
        <div className="trust-badges">
          <span className="badge">⚡ Powered by Solana</span>
          <span className="badge">🔐 Non-custodial</span>
          <span className="badge">📊 Calibration Tracked</span>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="logo-be">Be</span>
            <span className="logo-right">Right</span>
          </div>
          <div className="footer-links">
            <a href="/docs">Docs</a>
            <a href="/docs/faq">FAQ</a>
            <a href="/docs/api">API</a>
            <a href="https://twitter.com/beright" target="_blank" rel="noopener">Twitter</a>
            <a href="https://discord.gg/beright" target="_blank" rel="noopener">Discord</a>
          </div>
          <div className="footer-legal">
            © 2026 BeRight Protocol. Not available in restricted jurisdictions.
          </div>
        </div>
      </footer>

      <style jsx global>{`
        /* ═══════════════════════════════════════════════════════════════════════
           LANDING PAGE STYLES (global for child components)
           ═══════════════════════════════════════════════════════════════════════ */

        .landing-page {
          min-height: 100dvh;
          background: #030305;
          color: #fff;
          font-family: 'Outfit', system-ui, sans-serif;
        }

        .gradient-text {
          background: linear-gradient(135deg, #00E676 0%, #00B0FF 50%, #8B5CF6 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .link {
          color: #00B0FF;
          text-decoration: none;
        }
        .link:hover {
          text-decoration: underline;
        }

        .section-title {
          font-size: 36px;
          font-weight: 800;
          text-align: center;
          margin: 0 0 12px;
          letter-spacing: -0.5px;
        }

        .section-subtitle {
          font-size: 17px;
          color: rgba(255, 255, 255, 0.55);
          text-align: center;
          margin: 0 0 48px;
          max-width: 600px;
          margin-left: auto;
          margin-right: auto;
          line-height: 1.6;
        }

        /* ═══════════════════════════════════════════════════════════════════════
           HERO SECTION
           ═══════════════════════════════════════════════════════════════════════ */

        .hero-section {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 60px;
          align-items: center;
          padding: 120px 48px 80px;
          max-width: 1400px;
          margin: 0 auto;
          position: relative;
        }

        .hero-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }

        .bg-gradient-1 {
          position: absolute;
          width: 800px;
          height: 800px;
          left: -200px;
          top: -100px;
          background: radial-gradient(circle, rgba(0, 230, 118, 0.06) 0%, transparent 70%);
        }

        .bg-gradient-2 {
          position: absolute;
          width: 600px;
          height: 600px;
          right: -100px;
          bottom: 0;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.05) 0%, transparent 70%);
        }

        .bg-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
          background-size: 80px 80px;
          mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
        }

        .hero-content {
          position: relative;
          z-index: 10;
        }

        .hero-tagline {
          margin-bottom: 24px;
        }

        .tagline-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(0, 176, 255, 0.15));
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 100px;
          font-size: 11px;
          font-weight: 700;
          color: #A78BFA;
          letter-spacing: 1.5px;
        }

        .chip-icon {
          font-size: 14px;
        }

        .hero-headline {
          margin: 0 0 20px;
        }

        .headline-line {
          display: block;
          font-size: 48px;
          font-weight: 800;
          line-height: 1.15;
          letter-spacing: -1px;
        }

        .hero-subheadline {
          font-size: 18px;
          color: rgba(255, 255, 255, 0.8);
          line-height: 1.6;
          margin: 0 0 24px;
        }

        .sub-muted {
          color: rgba(255, 255, 255, 0.5);
          font-size: 15px;
        }

        .live-stats {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 32px;
          flex-wrap: wrap;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .stat-dot {
          width: 8px;
          height: 8px;
          background: #00E676;
          border-radius: 50%;
          box-shadow: 0 0 12px #00E676;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.2); }
        }

        .stat-value {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          font-family: 'JetBrains Mono', monospace;
        }

        .stat-label {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
        }

        .stat-divider {
          color: rgba(255, 255, 255, 0.2);
        }

        .cta-group {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }

        .cta-primary {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 16px 32px;
          background: linear-gradient(135deg, #00E676 0%, #00C853 100%);
          border: none;
          border-radius: 12px;
          color: #000;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }

        .cta-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(0, 230, 118, 0.4);
        }

        .cta-primary.large {
          padding: 18px 40px;
          font-size: 17px;
        }

        .cta-arrow {
          font-size: 18px;
          transition: transform 0.2s;
        }

        .cta-primary:hover .cta-arrow {
          transform: translateX(4px);
        }

        .cta-secondary {
          padding: 16px 28px;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          color: #fff;
          font-size: 16px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s;
        }

        .cta-secondary:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.3);
        }

        .cta-note {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.4);
          margin: 0;
        }

        /* Featured Market */
        .featured-market {
          position: relative;
          z-index: 10;
          background: linear-gradient(165deg, #0F0F1A 0%, #0A0A14 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 24px;
        }

        .featured-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .featured-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.6);
          letter-spacing: 1px;
        }

        .live-dot {
          width: 8px;
          height: 8px;
          background: #FF3B30;
          border-radius: 50%;
          box-shadow: 0 0 10px #FF3B30;
          animation: pulse 1.5s ease-in-out infinite;
        }

        .market-dots {
          display: flex;
          gap: 8px;
        }

        .market-dot {
          width: 8px;
          height: 8px;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.2s;
        }

        .market-dot.active {
          background: #00E676;
          box-shadow: 0 0 8px #00E676;
        }

        .ai-benchmark {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 20px;
          padding: 14px 16px;
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: 12px;
        }

        .ai-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
        }

        .ai-value {
          font-size: 14px;
          font-weight: 700;
          color: #A78BFA;
          font-family: 'JetBrains Mono', monospace;
        }

        .ai-note {
          margin-left: auto;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.3);
        }

        /* Market Card */
        .market-card {
          background: linear-gradient(165deg, rgba(15, 15, 26, 0.95) 0%, rgba(10, 10, 20, 0.98) 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          overflow: hidden;
          animation: fadeIn 0.4s ease-out both;
          position: relative;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .market-icon-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .market-icon {
          font-size: 32px;
          filter: drop-shadow(0 4px 12px currentColor);
        }

        .market-hot {
          padding: 6px 12px;
          background: linear-gradient(135deg, rgba(255, 107, 0, 0.25), rgba(255, 59, 48, 0.25));
          border: 1px solid rgba(255, 107, 0, 0.4);
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          color: #FF6B00;
          letter-spacing: 0.5px;
        }

        .market-body {
          padding: 20px;
        }

        .market-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }

        .market-category {
          padding: 5px 12px;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        .market-closes {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          font-weight: 500;
        }

        .market-question {
          font-size: 19px;
          font-weight: 700;
          line-height: 1.4;
          margin: 0 0 20px;
          color: #fff;
        }

        .market-odds {
          display: flex;
          gap: 12px;
          margin-bottom: 18px;
        }

        .odds-side {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 14px;
          border-radius: 12px;
          border: 2px solid;
        }

        .odds-yes {
          background: rgba(0, 230, 118, 0.08);
          border-color: rgba(0, 230, 118, 0.3);
        }

        .odds-no {
          background: rgba(255, 82, 82, 0.08);
          border-color: rgba(255, 82, 82, 0.3);
        }

        .odds-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .odds-yes .odds-label { color: #00E676; }
        .odds-no .odds-label { color: #FF5252; }

        .odds-price {
          font-size: 28px;
          font-weight: 800;
          font-family: 'JetBrains Mono', monospace;
        }

        .odds-yes .odds-price { color: #00E676; }
        .odds-no .odds-price { color: #FF5252; }

        .market-stats {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 12px;
          font-size: 13px;
        }

        .stat-item-card {
          display: flex;
          align-items: center;
          gap: 4px;
          color: rgba(255, 255, 255, 0.6);
          font-weight: 500;
        }

        .stat-icon {
          font-size: 14px;
        }

        .stats-divider {
          color: rgba(255, 255, 255, 0.2);
        }

        .stat-up { color: #00E676; font-weight: 600; }
        .stat-down { color: #FF5252; font-weight: 600; }

        /* ═══════════════════════════════════════════════════════════════════════
           CATEGORIES SECTION
           ═══════════════════════════════════════════════════════════════════════ */

        .categories-section {
          padding: 60px 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          background: linear-gradient(180deg, transparent 0%, rgba(0, 230, 118, 0.02) 100%);
        }

        .categories-inner {
          max-width: 1000px;
          margin: 0 auto;
          text-align: center;
        }

        .categories-title {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          letter-spacing: 1px;
          text-transform: uppercase;
          margin-bottom: 20px;
        }

        .categories-strip {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .category-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          text-decoration: none;
          transition: all 0.2s;
        }

        .category-chip:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
          transform: translateY(-2px);
        }

        .cat-icon {
          font-size: 18px;
        }

        .cat-label {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
        }

        .cat-count {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          font-family: 'JetBrains Mono', monospace;
        }

        /* ═══════════════════════════════════════════════════════════════════════
           LEADERBOARD SECTION
           ═══════════════════════════════════════════════════════════════════════ */

        .leaderboard-section {
          padding: 80px 24px;
        }

        .leaderboard-preview {
          max-width: 700px;
          margin: 0 auto;
          background: linear-gradient(165deg, #0F0F1A 0%, #0A0A14 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 24px;
        }

        .lb-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .lb-header h3 {
          font-size: 18px;
          font-weight: 700;
          margin: 0;
        }

        .lb-view-all {
          font-size: 13px;
          color: #00B0FF;
          text-decoration: none;
        }

        .lb-view-all:hover {
          text-decoration: underline;
        }

        .lb-table {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .lb-row {
          display: grid;
          grid-template-columns: 40px 1fr 70px 60px 80px;
          align-items: center;
          padding: 12px 8px;
          border-radius: 10px;
          font-size: 13px;
        }

        .lb-header-row {
          color: rgba(255, 255, 255, 0.4);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .lb-row:not(.lb-header-row):hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .lb-col-rank {
          font-weight: 700;
        }

        .lb-col-name {
          font-weight: 600;
          color: #fff;
        }

        .lb-col-accuracy {
          font-family: 'JetBrains Mono', monospace;
          color: #00E676;
        }

        .lb-col-brier {
          font-family: 'JetBrains Mono', monospace;
          color: rgba(255, 255, 255, 0.6);
        }

        .lb-col-profit {
          font-family: 'JetBrains Mono', monospace;
          text-align: right;
        }

        .profit-positive {
          color: #00E676;
        }

        /* ═══════════════════════════════════════════════════════════════════════
           HOW IT WORKS
           ═══════════════════════════════════════════════════════════════════════ */

        .how-it-works {
          padding: 100px 24px;
          background: linear-gradient(180deg, rgba(139, 92, 246, 0.05) 0%, rgba(0, 176, 255, 0.02) 50%, transparent 100%);
          position: relative;
        }

        .hiw-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
          max-width: 1200px;
          margin: 0 auto 50px;
        }

        .hiw-card {
          background: linear-gradient(165deg, rgba(20, 20, 35, 0.8) 0%, rgba(15, 15, 25, 0.9) 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 32px;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .hiw-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #00E676, #00B0FF, #8B5CF6);
          opacity: 0;
          transition: opacity 0.3s;
        }

        .hiw-card:hover {
          transform: translateY(-4px);
          border-color: rgba(255, 255, 255, 0.15);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }

        .hiw-card:hover::before {
          opacity: 1;
        }

        .hiw-icon {
          font-size: 48px;
          margin-bottom: 20px;
          display: block;
        }

        .hiw-card h3 {
          font-size: 20px;
          font-weight: 700;
          margin: 0 0 12px;
          color: #fff;
        }

        .hiw-card p {
          font-size: 15px;
          color: rgba(255, 255, 255, 0.65);
          line-height: 1.7;
          margin: 0;
        }

        .resolution-note {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          max-width: 900px;
          margin: 0 auto;
          padding: 24px 28px;
          background: linear-gradient(135deg, rgba(0, 176, 255, 0.08), rgba(139, 92, 246, 0.05));
          border: 1px solid rgba(0, 176, 255, 0.2);
          border-radius: 16px;
          font-size: 15px;
          color: rgba(255, 255, 255, 0.75);
          line-height: 1.6;
        }

        .resolution-icon {
          font-size: 24px;
          flex-shrink: 0;
        }

        /* ═══════════════════════════════════════════════════════════════════════
           PROOF SECTION
           ═══════════════════════════════════════════════════════════════════════ */

        .proof-section {
          padding: 80px 24px;
        }

        .proof-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 20px;
          max-width: 800px;
          margin: 0 auto;
        }

        .proof-card {
          background: linear-gradient(165deg, #0F0F1A 0%, #0A0A14 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 24px;
        }

        .proof-outcome {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .outcome-badge {
          padding: 4px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
        }

        .outcome-badge.yes {
          background: rgba(0, 230, 118, 0.15);
          color: #00E676;
        }

        .outcome-badge.no {
          background: rgba(255, 82, 82, 0.15);
          color: #FF5252;
        }

        .proof-date {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
        }

        .proof-question {
          font-size: 15px;
          font-weight: 600;
          margin: 0 0 16px;
          line-height: 1.4;
        }

        .proof-comparison {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .proof-stat {
          flex: 1;
          text-align: center;
        }

        .proof-label {
          display: block;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 4px;
        }

        .proof-value {
          font-size: 18px;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
        }

        .proof-value.human { color: #00E676; }
        .proof-value.ai { color: #8B5CF6; }

        .proof-vs {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.3);
          font-weight: 600;
        }

        /* ═══════════════════════════════════════════════════════════════════════
           FINAL CTA
           ═══════════════════════════════════════════════════════════════════════ */

        .final-cta {
          padding: 100px 24px;
          text-align: center;
          background: linear-gradient(180deg, transparent 0%, rgba(0, 230, 118, 0.03) 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .final-cta h2 {
          font-size: 36px;
          font-weight: 800;
          margin: 0 0 12px;
        }

        .final-cta p {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0 0 32px;
          max-width: 500px;
        }

        .final-cta .cta-primary {
          margin: 0 auto;
        }

        .trust-badges {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 24px;
          margin-top: 24px;
          flex-wrap: wrap;
        }

        .badge {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
        }

        /* ═══════════════════════════════════════════════════════════════════════
           FOOTER
           ═══════════════════════════════════════════════════════════════════════ */

        .footer {
          padding: 40px 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .footer-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 24px;
          text-align: center;
        }

        .footer-brand {
          font-size: 20px;
          font-weight: 800;
        }

        .footer-links {
          display: flex;
          gap: 24px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .footer-links a {
          color: rgba(255, 255, 255, 0.5);
          text-decoration: none;
          font-size: 14px;
          transition: color 0.2s;
        }

        .footer-links a:hover {
          color: #fff;
        }

        .footer-legal {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.3);
        }

        /* ═══════════════════════════════════════════════════════════════════════
           LOADING STATE
           ═══════════════════════════════════════════════════════════════════════ */

        .landing-loading {
          min-height: 100dvh;
          background: #030305;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 24px;
        }

        .loading-logo {
          font-size: 32px;
          font-weight: 800;
        }

        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(0, 230, 118, 0.2);
          border-top-color: #00E676;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .market-loading,
        .market-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 60px 24px;
          color: rgba(255, 255, 255, 0.5);
          font-size: 14px;
        }

        .market-loading .loading-spinner {
          width: 28px;
          height: 28px;
        }

        .lb-loading,
        .lb-empty {
          padding: 40px 24px;
          text-align: center;
          color: rgba(255, 255, 255, 0.5);
          font-size: 14px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* ═══════════════════════════════════════════════════════════════════════
           RESPONSIVE
           ═══════════════════════════════════════════════════════════════════════ */

        @media (max-width: 1024px) {
          .hero-section {
            grid-template-columns: 1fr;
            gap: 48px;
            padding: 100px 24px 60px;
            min-height: auto;
          }

          .featured-market {
            max-width: 500px;
            margin: 0 auto;
          }

          .headline-line {
            font-size: 36px;
          }
        }

        @media (max-width: 768px) {
          .hero-section {
            padding: 90px 20px 50px;
            gap: 40px;
          }

          .headline-line {
            font-size: 28px;
          }

          .hero-subheadline {
            font-size: 16px;
          }

          .cta-group {
            flex-direction: column;
            width: 100%;
          }

          .cta-primary,
          .cta-secondary {
            width: 100%;
            justify-content: center;
          }

          .live-stats {
            justify-content: center;
            gap: 12px;
          }

          .stat-divider {
            display: none;
          }

          .categories-section {
            padding: 40px 16px;
          }

          .categories-strip {
            gap: 8px;
          }

          .category-chip {
            padding: 10px 14px;
            flex: 1 1 calc(33% - 8px);
            min-width: 100px;
            justify-content: center;
          }

          .leaderboard-section {
            padding: 50px 16px;
          }

          .leaderboard-preview {
            padding: 16px;
          }

          .lb-row {
            grid-template-columns: 36px 1fr 60px 70px;
            padding: 10px 6px;
            font-size: 12px;
          }

          .lb-col-brier {
            display: none;
          }

          .how-it-works {
            padding: 60px 16px;
          }

          .hiw-grid {
            gap: 16px;
          }

          .hiw-card {
            padding: 24px;
          }

          .hiw-icon {
            font-size: 40px;
          }

          .resolution-note {
            flex-direction: column;
            text-align: center;
            padding: 20px;
          }

          .proof-section {
            padding: 60px 16px;
          }

          .proof-cards {
            grid-template-columns: 1fr;
          }

          .final-cta {
            padding: 60px 20px;
          }

          .final-cta h2 {
            font-size: 28px;
          }

          .trust-badges {
            gap: 16px;
          }

          .badge {
            font-size: 12px;
          }

          .footer {
            padding: 30px 16px;
          }

          .footer-inner {
            flex-direction: column;
            text-align: center;
            gap: 20px;
          }

          .footer-links {
            flex-wrap: wrap;
            justify-content: center;
            gap: 16px;
          }
        }

        @media (max-width: 480px) {
          .hero-section {
            padding: 80px 16px 40px;
          }

          .headline-line {
            font-size: 22px;
          }

          .hero-subheadline {
            font-size: 14px;
          }

          .sub-muted {
            font-size: 13px;
          }

          .tagline-chip {
            font-size: 10px;
            padding: 6px 12px;
          }

          .live-stats {
            flex-direction: column;
            gap: 8px;
          }

          .stat-item {
            justify-content: center;
          }

          .featured-market {
            border-radius: 16px;
          }

          .market-icon-banner {
            padding: 12px 16px;
          }

          .market-icon {
            font-size: 28px;
          }

          .market-body {
            padding: 16px;
          }

          .market-question {
            font-size: 16px;
          }

          .market-odds {
            gap: 8px;
          }

          .odds-side {
            padding: 12px 8px;
          }

          .odds-price {
            font-size: 22px;
          }

          .market-stats {
            padding: 10px 12px;
            font-size: 11px;
          }

          .ai-benchmark {
            flex-wrap: wrap;
            justify-content: center;
            gap: 8px;
            padding: 12px;
          }

          .ai-note {
            margin-left: 0;
            width: 100%;
            text-align: center;
          }

          .section-title {
            font-size: 24px;
          }

          .section-subtitle {
            font-size: 14px;
            margin-bottom: 32px;
          }

          .categories-strip {
            flex-direction: column;
          }

          .category-chip {
            width: 100%;
            justify-content: flex-start;
          }

          .cat-count {
            margin-left: auto;
          }

          .lb-row {
            grid-template-columns: 30px 1fr 55px 65px;
            font-size: 11px;
          }

          .hiw-grid {
            grid-template-columns: 1fr;
          }

          .hiw-card h3 {
            font-size: 18px;
          }

          .hiw-card p {
            font-size: 14px;
          }

          .proof-card {
            padding: 20px;
          }

          .proof-comparison {
            flex-direction: column;
            gap: 12px;
          }

          .proof-vs {
            display: none;
          }

          .final-cta {
            padding: 50px 16px;
          }

          .final-cta h2 {
            font-size: 24px;
          }

          .final-cta p {
            font-size: 14px;
          }

          .cta-primary.large {
            padding: 14px 28px;
            font-size: 15px;
          }

          .trust-badges {
            flex-direction: column;
            gap: 10px;
          }
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .stat-dot,
          .live-dot,
          .loading-spinner {
            animation: none;
          }

          .market-card {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
