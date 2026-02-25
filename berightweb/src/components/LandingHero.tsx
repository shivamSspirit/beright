'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';

// ═══════════════════════════════════════════════════════════════════════════════
// BERIGHT LANDING PAGE v2.1 - CLEANED UP
// ═══════════════════════════════════════════════════════════════════════════════
// Removed: Fake live ticker, unverifiable stats, misleading marketing hooks
// Added: Prominent risk disclaimer near CTA
// ═══════════════════════════════════════════════════════════════════════════════

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
// MARKET OPPORTUNITY CARD
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
// HOW IT WORKS SECTION - Enhanced with visual flow
// ═══════════════════════════════════════════════════════════════════════════════

function HowItWorks() {
  return (
    <section id="how-it-works" className="how-section" aria-labelledby="how-title">
      <h2 id="how-title" className="section-title">
        <span className="title-icon">⚡</span>
        How It Works
      </h2>
      <p className="section-subtitle">Buy shares. If you're right, they pay $1. If wrong, $0.</p>

      <div className="steps-visual-grid">
        {/* Step 1: Connect Wallet */}
        <div className="step-visual-card" style={{ animationDelay: '0ms' }}>
          <div className="step-badge">1</div>
          <div className="step-visual-content">
            <div className="step-visual-icon wallet-visual">
              <div className="wallet-frame">
                <div className="wallet-header">
                  <span className="wallet-dot" />
                  <span className="wallet-dot" />
                  <span className="wallet-dot" />
                </div>
                <div className="wallet-body">
                  <svg className="wallet-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M19 7V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2v-2"/>
                    <path d="M15 7h6v10h-6a2 2 0 01-2-2V9a2 2 0 012-2z"/>
                    <circle cx="17" cy="12" r="1"/>
                  </svg>
                  <span className="wallet-connect-pulse" />
                </div>
              </div>
            </div>
            <h3 className="step-visual-title">Connect Wallet</h3>
            <p className="step-visual-desc">Sign in with email or any Web3 wallet. Your keys, your funds.</p>
            <div className="step-visual-detail">
              <span className="detail-chip">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                Non-custodial
              </span>
              <span className="detail-chip">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
                30 seconds
              </span>
            </div>
          </div>
        </div>

        {/* Arrow Connector */}
        <div className="step-connector" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>

        {/* Step 2: Browse & Trade */}
        <div className="step-visual-card" style={{ animationDelay: '100ms' }}>
          <div className="step-badge">2</div>
          <div className="step-visual-content">
            <div className="step-visual-icon market-visual">
              <div className="market-preview-card">
                <div className="preview-header">
                  <span className="preview-topic">BTC &gt; $150K?</span>
                  <span className="preview-odds">34%</span>
                </div>
                <div className="preview-actions">
                  <button className="preview-btn yes-btn" aria-label="Buy YES">
                    <span className="btn-label">YES</span>
                    <span className="btn-price">$0.34</span>
                  </button>
                  <button className="preview-btn no-btn" aria-label="Buy NO">
                    <span className="btn-label">NO</span>
                    <span className="btn-price">$0.66</span>
                  </button>
                </div>
              </div>
            </div>
            <h3 className="step-visual-title">Browse & Trade</h3>
            <p className="step-visual-desc">Find markets on politics, crypto, sports. Buy YES or NO shares.</p>
            <div className="step-visual-detail">
              <span className="detail-chip">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                </svg>
                USDC
              </span>
              <span className="detail-chip">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                  <path d="M22 4L12 14.01l-3-3"/>
                </svg>
                Instant
              </span>
            </div>
          </div>
        </div>

        {/* Arrow Connector */}
        <div className="step-connector" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>

        {/* Step 3: Shares in Wallet */}
        <div className="step-visual-card" style={{ animationDelay: '200ms' }}>
          <div className="step-badge">3</div>
          <div className="step-visual-content">
            <div className="step-visual-icon tokens-visual">
              <div className="tokens-container">
                <div className="token-item yes-token">
                  <span className="token-symbol">YES</span>
                  <span className="token-amount">100</span>
                </div>
                <div className="token-arrow">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12l7 7 7-7"/>
                  </svg>
                </div>
                <div className="token-result">
                  <span className="result-win">$100</span>
                  <span className="result-label">if correct</span>
                </div>
              </div>
            </div>
            <h3 className="step-visual-title">Collect Winnings</h3>
            <p className="step-visual-desc">Winning shares pay $1 each. Losers pay $0. Settle directly to wallet.</p>
            <div className="step-visual-detail">
              <span className="detail-chip">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  <path d="M9 12l2 2 4-4"/>
                </svg>
                Auto-settle
              </span>
              <span className="detail-chip">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                  <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
                </svg>
                On-chain
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual explainer */}
      <div className="how-explainer">
        <div className="explainer-box">
          <span className="explainer-icon">💡</span>
          <p className="explainer-text">
            <strong>Example:</strong> Buy 10 YES shares at $0.34 each = $3.40 cost.
            If correct, receive $10.00 (194% return). If wrong, receive $0.
          </p>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI INTELLIGENCE SECTION - BeRight's unique edge
// ═══════════════════════════════════════════════════════════════════════════════

function AIIntelligence() {
  return (
    <section id="ai-intelligence" className="ai-section" aria-labelledby="ai-title">
      <div className="ai-header">
        <span className="ai-badge">✨ BeRight Edge</span>
        <h2 id="ai-title" className="section-title">
          <span className="title-icon">🤖</span>
          AI-Powered Trading
        </h2>
        <p className="section-subtitle">
          Not just markets. Intelligence that helps you win.
        </p>
      </div>

      <div className="ai-features-grid">
        {/* Feature 1: AI Fact-Check */}
        <div className="ai-feature-card">
          <div className="ai-feature-visual">
            <div className="fact-check-visual">
              <div className="chat-bubble user-bubble">
                <span className="bubble-label">You</span>
                <span className="bubble-text">Will BTC hit $150K?</span>
              </div>
              <div className="chat-bubble ai-bubble">
                <span className="bubble-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 16v-4M12 8h.01"/>
                  </svg>
                  BeRight AI
                </span>
                <span className="bubble-text">
                  <span className="fact-item">📊 ETF inflows: +$2.1B this week</span>
                  <span className="fact-item">📰 Fed signals rate pause</span>
                  <span className="fact-item">⚠️ RSI overbought at 78</span>
                </span>
              </div>
            </div>
          </div>
          <div className="ai-feature-content">
            <h3 className="ai-feature-title">AI Research Assistant</h3>
            <p className="ai-feature-desc">
              Ask any market question. Get fact-checked insights, news summaries,
              and data analysis before you trade.
            </p>
            <div className="ai-feature-tags">
              <span className="ai-tag">Real-time data</span>
              <span className="ai-tag">Source citations</span>
            </div>
          </div>
        </div>

        {/* Feature 2: Prediction Memo */}
        <div className="ai-feature-card">
          <div className="ai-feature-visual">
            <div className="memo-visual">
              <div className="memo-card">
                <div className="memo-header">
                  <span className="memo-date">Feb 25, 2026</span>
                  <span className="memo-status resolved">✓ Resolved</span>
                </div>
                <div className="memo-content">
                  <span className="memo-market">Fed cuts in March</span>
                  <span className="memo-position">
                    <span className="position-badge yes">YES</span>
                    @ $0.42
                  </span>
                </div>
                <div className="memo-reasoning">
                  <span className="reasoning-label">Your reasoning:</span>
                  <span className="reasoning-text">"CPI trending down, unemployment ticking up..."</span>
                </div>
                <div className="memo-result">
                  <span className="result-label">Result:</span>
                  <span className="result-value win">+138%</span>
                </div>
              </div>
            </div>
          </div>
          <div className="ai-feature-content">
            <h3 className="ai-feature-title">Prediction Journal</h3>
            <p className="ai-feature-desc">
              Every prediction stored with your reasoning. Review what worked,
              learn from mistakes, improve over time.
            </p>
            <div className="ai-feature-tags">
              <span className="ai-tag">On-chain history</span>
              <span className="ai-tag">Export anytime</span>
            </div>
          </div>
        </div>

        {/* Feature 3: Brier Score */}
        <div className="ai-feature-card">
          <div className="ai-feature-visual">
            <div className="brier-visual">
              <div className="brier-card">
                <div className="brier-header">
                  <span className="brier-label">Your Brier Score</span>
                  <span className="brier-info" title="Lower is better. 0 = perfect, 0.25 = random">ⓘ</span>
                </div>
                <div className="brier-score">
                  <span className="score-value">0.18</span>
                  <span className="score-rank">Top 12%</span>
                </div>
                <div className="brier-breakdown">
                  <div className="breakdown-item">
                    <span className="breakdown-label">Calibration</span>
                    <div className="breakdown-bar">
                      <div className="breakdown-fill" style={{ width: '85%' }} />
                    </div>
                    <span className="breakdown-value">85%</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-label">Resolution</span>
                    <div className="breakdown-bar">
                      <div className="breakdown-fill" style={{ width: '72%' }} />
                    </div>
                    <span className="breakdown-value">72%</span>
                  </div>
                </div>
                <div className="brier-predictions">
                  <span className="predictions-count">47 predictions</span>
                </div>
              </div>
            </div>
          </div>
          <div className="ai-feature-content">
            <h3 className="ai-feature-title">Brier Score Tracking</h3>
            <p className="ai-feature-desc">
              Scientific accuracy measurement. See how calibrated your predictions
              are and compare against other forecasters.
            </p>
            <div className="ai-feature-tags">
              <span className="ai-tag">Leaderboard ranking</span>
              <span className="ai-tag">Skill decomposition</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom callout */}
      <div className="ai-callout">
        <span className="callout-icon">💡</span>
        <p className="callout-text">
          <strong>Why this matters:</strong> Most traders lose because they trade on vibes.
          BeRight gives you data, tracks your reasoning, and measures your actual skill.
        </p>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRUST SIGNALS SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function TrustSignals() {
  const features = [
    { icon: '⚡', label: '400ms Finality', desc: 'Lightning-fast settlement' },
    { icon: '💰', label: '$0.00025 Fees', desc: 'Near-zero transaction costs' },
    { icon: '🔒', label: 'Non-Custodial', desc: 'Your keys, your funds' },
  ];

  return (
    <section className="trust-section" aria-label="Platform features">
      {/* Solana Branding */}
      <div className="solana-powered">
        <div className="solana-logo">
          <svg viewBox="0 0 397 311" fill="none" className="solana-svg">
            <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" fill="url(#solana-gradient-1)"/>
            <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" fill="url(#solana-gradient-2)"/>
            <path d="M332.1 120.9c-2.4-2.4-5.7-3.8-9.2-3.8H5.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" fill="url(#solana-gradient-3)"/>
            <defs>
              <linearGradient id="solana-gradient-1" x1="0" y1="0" x2="397" y2="311">
                <stop stopColor="#00FFA3"/>
                <stop offset="1" stopColor="#DC1FFF"/>
              </linearGradient>
              <linearGradient id="solana-gradient-2" x1="0" y1="0" x2="397" y2="311">
                <stop stopColor="#00FFA3"/>
                <stop offset="1" stopColor="#DC1FFF"/>
              </linearGradient>
              <linearGradient id="solana-gradient-3" x1="0" y1="0" x2="397" y2="311">
                <stop stopColor="#00FFA3"/>
                <stop offset="1" stopColor="#DC1FFF"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="solana-text">
          <span className="solana-label">Powered by</span>
          <span className="solana-name">Solana</span>
        </div>
      </div>

      <div className="trust-divider" />

      {/* Features */}
      <div className="trust-features">
        {features.map((feature, i) => (
          <div key={i} className="trust-feature">
            <span className="feature-icon">{feature.icon}</span>
            <div className="feature-text">
              <span className="feature-label">{feature.label}</span>
              <span className="feature-desc">{feature.desc}</span>
            </div>
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
          <p className="footer-tagline">Prediction Markets Protocol</p>
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
          {/* Solana Badge */}
          <div className="hero-badge">
            <span className="badge-icon">◎</span>
            <span className="badge-text">Built on Solana</span>
          </div>

          {/* Main Headline */}
          <h1 className="hero-headline">
            <span className="headline-pre">Bet on</span>
            <span className="headline-main">
              What You <span className="gradient-text">Know</span>
            </span>
          </h1>

          {/* Subheadline */}
          <p className="hero-sub">
            The prediction market for people who do their research.
            <br />
            <span className="hero-sub-accent">AI-powered insights. On-chain settlement. Your edge.</span>
          </p>

          {/* CTA Button */}
          <button className="cta-button" onClick={handleConnect}>
            <span className="cta-text">Start Trading</span>
            <span className="cta-arrow">→</span>
          </button>

          {/* Mini stats under CTA */}
          <div className="hero-mini-stats">
            <span className="mini-stat">
              <span className="stat-value">$1</span>
              <span className="stat-label">min trade</span>
            </span>
            <span className="mini-divider">·</span>
            <span className="mini-stat">
              <span className="stat-value">&lt;1s</span>
              <span className="stat-label">settlement</span>
            </span>
            <span className="mini-divider">·</span>
            <span className="mini-stat">
              <span className="stat-value">0%</span>
              <span className="stat-label">platform fee</span>
            </span>
          </div>
        </div>

        {/* Hero Visual - Animated prediction flow */}
        <div className="hero-visual" aria-hidden="true">
          <div className="prediction-flow">
            <div className="flow-card flow-question">
              <span className="flow-label">Question</span>
              <span className="flow-text">Will ETH hit $5K?</span>
            </div>
            <div className="flow-arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12l7 7 7-7"/>
              </svg>
            </div>
            <div className="flow-card flow-position">
              <span className="flow-label">Your Position</span>
              <div className="flow-buttons">
                <span className="flow-btn yes active">YES $0.42</span>
                <span className="flow-btn no">NO $0.58</span>
              </div>
            </div>
            <div className="flow-arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12l7 7 7-7"/>
              </svg>
            </div>
            <div className="flow-card flow-outcome">
              <span className="flow-label">If Correct</span>
              <span className="flow-payout">+138%</span>
            </div>
          </div>
        </div>

        {/* Hot Markets Section */}
        <section id="markets" className="markets-section" aria-labelledby="markets-title">
          <div className="markets-header">
            <h2 id="markets-title" className="section-title">
              <span className="title-icon">📊</span>
              Active Markets
            </h2>
            <span className="section-subtitle">Browse prediction markets</span>
          </div>

          <div className="markets-grid">
            {HOT_OPPS.map((opp, i) => (
              <MarketCard key={i} opp={opp} index={i} />
            ))}
          </div>

          <button className="see-all-button" onClick={handleConnect}>
            <span>Browse all markets</span>
            <span className="button-arrow">→</span>
          </button>
        </section>

        {/* How It Works */}
        <HowItWorks />

        {/* AI Intelligence - BeRight's unique edge */}
        <AIIntelligence />

        {/* Trust Signals */}
        <TrustSignals />
      </main>

      {/* Footer */}
      <Footer />

      {/* Mobile Sticky CTA */}
      <div className="sticky-cta" aria-hidden="true">
        <div className="sticky-inner">
          <span className="sticky-brand">◉ BeRight</span>
          <button className="sticky-button" onClick={handleConnect}>
            Connect Wallet
          </button>
        </div>
      </div>

      <style jsx global>{`
        /* ═══════════════════════════════════════════════════════════════════════
           BERIGHT LANDING v2.1 - CLEANED UP
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
          top: 0;
          left: 0;
          right: 0;
          z-index: 50;
          padding: 0 20px;
          transition: all 0.3s ease;
        }

        .navbar.scrolled {
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
           HERO SECTION
           ═══════════════════════════════════════════════════════════════════════ */

        .hero {
          padding: 100px 20px 80px;
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
          margin: 0 auto 60px;
        }

        /* Hero Badge */
        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: linear-gradient(135deg, rgba(0, 255, 163, 0.1) 0%, rgba(220, 31, 255, 0.08) 100%);
          border: 1px solid rgba(0, 255, 163, 0.3);
          border-radius: 100px;
          margin-bottom: 24px;
          animation: fadeUp 0.5s ease-out;
        }

        .hero-badge .badge-icon {
          font-size: 16px;
          color: #00FFA3;
        }

        .hero-badge .badge-text {
          font-size: 13px;
          font-weight: 600;
          background: linear-gradient(90deg, #00FFA3, #DC1FFF);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        /* Headline */
        .hero-headline {
          margin: 0 0 20px;
          animation: fadeUp 0.6s ease-out 0.1s both;
        }

        .headline-pre {
          display: block;
          font-size: 24px;
          font-weight: 500;
          color: var(--color-text-tertiary);
          letter-spacing: 2px;
          text-transform: uppercase;
          margin-bottom: 8px;
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
          line-height: 1.6;
          margin: 0 0 32px;
          animation: fadeUp 0.6s ease-out 0.2s both;
        }

        .hero-sub-accent {
          color: var(--color-text-tertiary);
          font-size: 16px;
        }

        /* CTA Button */
        .cta-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 280px;
          max-width: 100%;
          padding: 20px 40px;
          background: linear-gradient(135deg, var(--color-green) 0%, #00CC6A 100%);
          border: none;
          border-radius: 14px;
          color: #000;
          font-size: 18px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.3s ease;
          animation: fadeUp 0.6s ease-out 0.2s both;
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

        /* Mini Stats under CTA */
        .hero-mini-stats {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 20px;
          animation: fadeUp 0.6s ease-out 0.4s both;
        }

        .mini-stat {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }

        .mini-stat .stat-value {
          font-size: 14px;
          font-weight: 700;
          font-family: var(--font-mono);
          color: var(--color-text);
        }

        .mini-stat .stat-label {
          font-size: 12px;
          color: var(--color-text-tertiary);
        }

        .mini-divider {
          color: var(--color-text-tertiary);
          font-size: 14px;
        }

        /* Hero Visual - Prediction Flow */
        .hero-visual {
          position: relative;
          z-index: 10;
          display: flex;
          justify-content: center;
          margin-bottom: 80px;
          animation: fadeUp 0.8s ease-out 0.5s both;
        }

        .prediction-flow {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 24px;
          background: linear-gradient(145deg, rgba(17, 17, 19, 0.9) 0%, rgba(10, 10, 11, 0.95) 100%);
          border: 1px solid var(--color-border);
          border-radius: 20px;
          backdrop-filter: blur(10px);
        }

        .flow-card {
          padding: 14px 20px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          min-width: 200px;
          text-align: center;
        }

        .flow-label {
          display: block;
          font-size: 10px;
          font-weight: 600;
          color: var(--color-text-tertiary);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 6px;
        }

        .flow-text {
          font-size: 15px;
          font-weight: 600;
          color: var(--color-text);
        }

        .flow-arrow {
          width: 20px;
          height: 20px;
          color: var(--color-text-tertiary);
          animation: flowBounce 2s ease-in-out infinite;
        }

        .flow-arrow svg {
          width: 100%;
          height: 100%;
        }

        @keyframes flowBounce {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(4px); opacity: 1; }
        }

        .flow-buttons {
          display: flex;
          gap: 8px;
          justify-content: center;
        }

        .flow-btn {
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          font-family: var(--font-mono);
        }

        .flow-btn.yes {
          background: rgba(0, 255, 136, 0.1);
          border: 1px solid rgba(0, 255, 136, 0.3);
          color: var(--color-green);
        }

        .flow-btn.yes.active {
          background: rgba(0, 255, 136, 0.2);
          border-color: var(--color-green);
          box-shadow: 0 0 12px rgba(0, 255, 136, 0.3);
        }

        .flow-btn.no {
          background: rgba(255, 71, 87, 0.1);
          border: 1px solid rgba(255, 71, 87, 0.2);
          color: var(--color-text-tertiary);
        }

        .flow-outcome {
          background: linear-gradient(135deg, rgba(0, 255, 136, 0.1) 0%, rgba(0, 212, 255, 0.05) 100%);
          border-color: rgba(0, 255, 136, 0.3);
        }

        .flow-payout {
          font-size: 24px;
          font-weight: 900;
          font-family: var(--font-mono);
          color: var(--color-green);
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
           HOW IT WORKS - Enhanced Visual
           ═══════════════════════════════════════════════════════════════════════ */

        .how-section {
          position: relative;
          z-index: 10;
          margin-bottom: 100px;
          text-align: center;
        }

        .steps-visual-grid {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-top: 48px;
        }

        .step-connector {
          width: 40px;
          height: 40px;
          color: var(--color-text-tertiary);
          flex-shrink: 0;
        }

        .step-connector svg {
          width: 100%;
          height: 100%;
        }

        .step-visual-card {
          position: relative;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 24px;
          padding: 28px 24px 24px;
          width: 280px;
          text-align: center;
          animation: fadeUp 0.5s ease-out both;
          transition: all 0.3s ease;
        }

        .step-visual-card:hover {
          border-color: var(--color-border-hover);
          transform: translateY(-4px);
        }

        .step-badge {
          position: absolute;
          top: -14px;
          left: 50%;
          transform: translateX(-50%);
          width: 28px;
          height: 28px;
          background: linear-gradient(135deg, var(--color-green) 0%, #00CC6A 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 800;
          color: #000;
          box-shadow: 0 4px 12px rgba(0, 255, 136, 0.3);
        }

        .step-visual-content {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .step-visual-icon {
          width: 100%;
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }

        /* Wallet Visual */
        .wallet-frame {
          width: 100px;
          height: 80px;
          background: linear-gradient(145deg, #1a1a1c 0%, #0d0d0e 100%);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          overflow: hidden;
          position: relative;
        }

        .wallet-header {
          display: flex;
          gap: 4px;
          padding: 8px 10px;
          background: rgba(255,255,255,0.02);
          border-bottom: 1px solid var(--color-border);
        }

        .wallet-dot {
          width: 6px;
          height: 6px;
          background: var(--color-text-tertiary);
          border-radius: 50%;
        }

        .wallet-body {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 50px;
          position: relative;
        }

        .wallet-icon-svg {
          width: 32px;
          height: 32px;
          color: var(--color-green);
        }

        .wallet-connect-pulse {
          position: absolute;
          width: 48px;
          height: 48px;
          border: 2px solid var(--color-green);
          border-radius: 50%;
          animation: walletPulse 2s ease-out infinite;
        }

        @keyframes walletPulse {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(1.5); opacity: 0; }
        }

        /* Market Preview Visual */
        .market-preview-card {
          width: 140px;
          background: linear-gradient(145deg, #1a1a1c 0%, #0d0d0e 100%);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          padding: 12px;
        }

        .preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .preview-topic {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text);
        }

        .preview-odds {
          font-size: 10px;
          font-weight: 700;
          color: var(--color-green);
          font-family: var(--font-mono);
        }

        .preview-actions {
          display: flex;
          gap: 6px;
        }

        .preview-btn {
          flex: 1;
          padding: 8px 4px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-family: inherit;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          transition: transform 0.2s;
        }

        .preview-btn:hover {
          transform: scale(1.05);
        }

        .preview-btn.yes-btn {
          background: rgba(0, 255, 136, 0.15);
          border: 1px solid rgba(0, 255, 136, 0.3);
        }

        .preview-btn.no-btn {
          background: rgba(255, 71, 87, 0.15);
          border: 1px solid rgba(255, 71, 87, 0.3);
        }

        .btn-label {
          font-size: 10px;
          font-weight: 700;
        }

        .yes-btn .btn-label { color: var(--color-green); }
        .no-btn .btn-label { color: var(--color-red); }

        .btn-price {
          font-size: 9px;
          font-family: var(--font-mono);
          color: var(--color-text-secondary);
        }

        /* Tokens Visual */
        .tokens-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .token-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: rgba(0, 255, 136, 0.1);
          border: 1px solid rgba(0, 255, 136, 0.3);
          border-radius: 10px;
        }

        .token-symbol {
          font-size: 12px;
          font-weight: 800;
          color: var(--color-green);
        }

        .token-amount {
          font-size: 14px;
          font-weight: 700;
          font-family: var(--font-mono);
          color: var(--color-text);
        }

        .token-arrow {
          width: 20px;
          height: 20px;
          color: var(--color-text-tertiary);
          animation: tokenBounce 1.5s ease-in-out infinite;
        }

        .token-arrow svg {
          width: 100%;
          height: 100%;
        }

        @keyframes tokenBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(4px); }
        }

        .token-result {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 10px 20px;
          background: linear-gradient(135deg, rgba(0, 255, 136, 0.2) 0%, rgba(0, 212, 255, 0.1) 100%);
          border: 1px solid rgba(0, 255, 136, 0.4);
          border-radius: 10px;
        }

        .result-win {
          font-size: 18px;
          font-weight: 800;
          font-family: var(--font-mono);
          color: var(--color-green);
        }

        .result-label {
          font-size: 10px;
          color: var(--color-text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Step Text Content */
        .step-visual-title {
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 8px;
          color: var(--color-text);
        }

        .step-visual-desc {
          font-size: 13px;
          color: var(--color-text-secondary);
          margin: 0 0 16px;
          line-height: 1.5;
        }

        .step-visual-detail {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .detail-chip {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--color-border);
          border-radius: 6px;
          font-size: 11px;
          color: var(--color-text-tertiary);
        }

        .detail-chip svg {
          color: var(--color-green);
        }

        /* Explainer Box */
        .how-explainer {
          margin-top: 40px;
        }

        .explainer-box {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 16px 24px;
          background: rgba(0, 212, 255, 0.08);
          border: 1px solid rgba(0, 212, 255, 0.2);
          border-radius: 12px;
          text-align: left;
        }

        .explainer-icon {
          font-size: 24px;
          flex-shrink: 0;
        }

        .explainer-text {
          font-size: 13px;
          color: var(--color-text-secondary);
          margin: 0;
          line-height: 1.5;
        }

        .explainer-text strong {
          color: var(--color-cyan);
        }

        /* ═══════════════════════════════════════════════════════════════════════
           AI INTELLIGENCE SECTION
           ═══════════════════════════════════════════════════════════════════════ */

        .ai-section {
          position: relative;
          z-index: 10;
          margin-bottom: 100px;
          padding: 60px 0;
        }

        .ai-header {
          text-align: center;
          margin-bottom: 48px;
        }

        .ai-badge {
          display: inline-block;
          padding: 6px 14px;
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(0, 212, 255, 0.15) 100%);
          border: 1px solid rgba(168, 85, 247, 0.3);
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          color: #A855F7;
          margin-bottom: 16px;
          letter-spacing: 0.5px;
        }

        .ai-features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          margin-bottom: 40px;
        }

        .ai-feature-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 20px;
          overflow: hidden;
          transition: all 0.3s ease;
          animation: fadeUp 0.5s ease-out both;
        }

        .ai-feature-card:hover {
          border-color: rgba(168, 85, 247, 0.3);
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3), 0 0 20px rgba(168, 85, 247, 0.1);
        }

        .ai-feature-visual {
          padding: 24px;
          background: linear-gradient(180deg, rgba(168, 85, 247, 0.05) 0%, transparent 100%);
          min-height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ai-feature-content {
          padding: 24px;
          border-top: 1px solid var(--color-border);
        }

        .ai-feature-title {
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 8px;
          color: var(--color-text);
        }

        .ai-feature-desc {
          font-size: 14px;
          color: var(--color-text-secondary);
          line-height: 1.6;
          margin: 0 0 16px;
        }

        .ai-feature-tags {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .ai-tag {
          padding: 4px 10px;
          background: rgba(168, 85, 247, 0.1);
          border: 1px solid rgba(168, 85, 247, 0.2);
          border-radius: 6px;
          font-size: 11px;
          color: #A855F7;
          font-weight: 500;
        }

        /* Fact Check Visual */
        .fact-check-visual {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
          max-width: 260px;
        }

        .chat-bubble {
          padding: 12px 14px;
          border-radius: 12px;
          animation: fadeUp 0.4s ease-out both;
        }

        .user-bubble {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--color-border);
          align-self: flex-end;
          margin-left: 20%;
        }

        .ai-bubble {
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(0, 212, 255, 0.1) 100%);
          border: 1px solid rgba(168, 85, 247, 0.3);
          align-self: flex-start;
          margin-right: 10%;
        }

        .bubble-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          font-weight: 600;
          color: var(--color-text-tertiary);
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .ai-bubble .bubble-label {
          color: #A855F7;
        }

        .bubble-text {
          font-size: 13px;
          color: var(--color-text);
          line-height: 1.4;
        }

        .ai-bubble .bubble-text {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .fact-item {
          font-size: 11px;
          color: var(--color-text-secondary);
        }

        /* Memo Visual */
        .memo-visual {
          width: 100%;
          max-width: 240px;
        }

        .memo-card {
          background: linear-gradient(145deg, #1a1a1c 0%, #0d0d0e 100%);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          padding: 14px;
        }

        .memo-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .memo-date {
          font-size: 10px;
          color: var(--color-text-tertiary);
        }

        .memo-status {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .memo-status.resolved {
          background: rgba(0, 255, 136, 0.15);
          color: var(--color-green);
        }

        .memo-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .memo-market {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text);
        }

        .memo-position {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--color-text-secondary);
          font-family: var(--font-mono);
        }

        .position-badge {
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
        }

        .position-badge.yes {
          background: rgba(0, 255, 136, 0.2);
          color: var(--color-green);
        }

        .memo-reasoning {
          padding: 10px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 8px;
          margin-bottom: 12px;
        }

        .reasoning-label {
          display: block;
          font-size: 9px;
          color: var(--color-text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .reasoning-text {
          font-size: 11px;
          color: var(--color-text-secondary);
          font-style: italic;
        }

        .memo-result {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 10px;
          border-top: 1px solid var(--color-border);
        }

        .result-label {
          font-size: 11px;
          color: var(--color-text-tertiary);
        }

        .result-value {
          font-size: 16px;
          font-weight: 800;
          font-family: var(--font-mono);
        }

        .result-value.win {
          color: var(--color-green);
        }

        /* Brier Score Visual */
        .brier-visual {
          width: 100%;
          max-width: 220px;
        }

        .brier-card {
          background: linear-gradient(145deg, #1a1a1c 0%, #0d0d0e 100%);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          padding: 16px;
        }

        .brier-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .brier-label {
          font-size: 11px;
          color: var(--color-text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .brier-info {
          font-size: 12px;
          color: var(--color-text-tertiary);
          cursor: help;
        }

        .brier-score {
          display: flex;
          align-items: baseline;
          gap: 12px;
          margin-bottom: 16px;
        }

        .score-value {
          font-size: 36px;
          font-weight: 900;
          font-family: var(--font-mono);
          background: linear-gradient(135deg, var(--color-green) 0%, var(--color-cyan) 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .score-rank {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-green);
          padding: 3px 8px;
          background: rgba(0, 255, 136, 0.1);
          border-radius: 4px;
        }

        .brier-breakdown {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 14px;
        }

        .breakdown-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .breakdown-label {
          font-size: 10px;
          color: var(--color-text-tertiary);
          width: 70px;
          flex-shrink: 0;
        }

        .breakdown-bar {
          flex: 1;
          height: 6px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
          overflow: hidden;
        }

        .breakdown-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--color-cyan), #A855F7);
          border-radius: 3px;
          transition: width 0.5s ease;
        }

        .breakdown-value {
          font-size: 11px;
          font-weight: 600;
          font-family: var(--font-mono);
          color: var(--color-text-secondary);
          width: 32px;
          text-align: right;
        }

        .brier-predictions {
          text-align: center;
          padding-top: 12px;
          border-top: 1px solid var(--color-border);
        }

        .predictions-count {
          font-size: 11px;
          color: var(--color-text-tertiary);
        }

        /* AI Callout */
        .ai-callout {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 20px 28px;
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(0, 212, 255, 0.08) 100%);
          border: 1px solid rgba(168, 85, 247, 0.2);
          border-radius: 16px;
          max-width: 700px;
          margin: 0 auto;
        }

        .callout-icon {
          font-size: 28px;
          flex-shrink: 0;
        }

        .callout-text {
          font-size: 14px;
          color: var(--color-text-secondary);
          line-height: 1.6;
          margin: 0;
          text-align: left;
        }

        .callout-text strong {
          color: #A855F7;
        }

        /* ═══════════════════════════════════════════════════════════════════════
           TRUST SIGNALS - Solana Powered
           ═══════════════════════════════════════════════════════════════════════ */

        .trust-section {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 48px;
          padding: 32px 48px;
          background: linear-gradient(135deg, rgba(0, 255, 163, 0.03) 0%, rgba(220, 31, 255, 0.02) 100%);
          border: 1px solid rgba(0, 255, 163, 0.15);
          border-radius: 20px;
          margin-bottom: 80px;
        }

        .solana-powered {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .solana-logo {
          width: 40px;
          height: 32px;
        }

        .solana-svg {
          width: 100%;
          height: 100%;
        }

        .solana-text {
          display: flex;
          flex-direction: column;
        }

        .solana-label {
          font-size: 10px;
          font-weight: 500;
          color: var(--color-text-tertiary);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .solana-name {
          font-size: 20px;
          font-weight: 800;
          background: linear-gradient(90deg, #00FFA3, #DC1FFF);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .trust-divider {
          width: 1px;
          height: 50px;
          background: linear-gradient(180deg, transparent 0%, rgba(0, 255, 163, 0.3) 50%, transparent 100%);
        }

        .trust-features {
          display: flex;
          gap: 32px;
        }

        .trust-feature {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .feature-icon {
          font-size: 20px;
        }

        .feature-text {
          display: flex;
          flex-direction: column;
        }

        .feature-label {
          font-size: 14px;
          font-weight: 700;
          color: var(--color-text);
        }

        .feature-desc {
          font-size: 11px;
          color: var(--color-text-tertiary);
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

        .sticky-brand {
          font-weight: 700;
          font-size: 16px;
          color: var(--color-text);
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

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
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

        @media (max-width: 1024px) {
          .steps-visual-grid {
            flex-wrap: wrap;
            gap: 24px;
          }

          .step-connector {
            display: none;
          }

          .step-visual-card {
            width: calc(50% - 12px);
          }

          .ai-features-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }

          .ai-feature-card {
            display: flex;
            flex-direction: row;
          }

          .ai-feature-visual {
            min-width: 280px;
            min-height: auto;
          }

          .ai-feature-content {
            border-top: none;
            border-left: 1px solid var(--color-border);
          }
        }

        @media (max-width: 768px) {
          .nav-links {
            display: none;
          }

          .hero {
            padding: 80px 16px 60px;
          }

          .headline-pre {
            font-size: 18px;
          }

          .headline-main {
            font-size: 42px;
            letter-spacing: -2px;
          }

          .hero-sub {
            font-size: 17px;
          }

          .hero-sub-accent {
            font-size: 14px;
          }

          .cta-button {
            width: 100%;
            padding: 18px 32px;
          }

          .hero-mini-stats {
            flex-wrap: wrap;
            justify-content: center;
          }

          .hero-visual {
            margin-bottom: 60px;
          }

          .prediction-flow {
            padding: 16px;
          }

          .flow-card {
            min-width: 160px;
            padding: 12px 16px;
          }

          .markets-grid {
            grid-template-columns: 1fr;
          }

          .steps-visual-grid {
            flex-direction: column;
            gap: 20px;
          }

          .step-visual-card {
            width: 100%;
            max-width: 320px;
          }

          .explainer-box {
            flex-direction: column;
            text-align: center;
            gap: 8px;
          }

          .trust-features {
            flex-direction: column;
            gap: 16px;
            align-items: center;
          }

          .sticky-cta {
            display: block;
          }

          .footer-links {
            flex-direction: column;
            gap: 32px;
          }

          .ai-feature-card {
            flex-direction: column;
          }

          .ai-feature-visual {
            min-width: auto;
            min-height: 180px;
          }

          .ai-feature-content {
            border-left: none;
            border-top: 1px solid var(--color-border);
          }

          .ai-callout {
            flex-direction: column;
            text-align: center;
            gap: 10px;
            padding: 16px 20px;
          }
        }

        @media (max-width: 480px) {
          .hero {
            padding: 70px 12px 50px;
          }

          .headline-main {
            font-size: 32px;
            letter-spacing: -1px;
          }

          .hero-sub {
            font-size: 15px;
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
          .loading-fill,
          .cta-button::before {
            animation: none;
          }

          .hero-headline,
          .hero-sub,
          .cta-button,
          .risk-disclaimer,
          .market-card,
          .step-card {
            animation: none;
            opacity: 1;
            transform: none;
          }
        }
      `}</style>
    </div>
  );
}
