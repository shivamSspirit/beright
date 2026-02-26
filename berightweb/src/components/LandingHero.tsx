'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';

// ═══════════════════════════════════════════════════════════════════════════════
// BERIGHT LANDING PAGE v3.0 - NIKITA BIER VIRAL STRATEGY
// ═══════════════════════════════════════════════════════════════════════════════
// Psychology: Ego, FOMO, Social Proof, Low Barrier Dopamine
// Layout: Hook → Social Proof → Product → Trust → Education → Identity → Close
// ═══════════════════════════════════════════════════════════════════════════════

// Only show 3 markets in the viral layout - less is more, creates scarcity
const HOT_OPPS = [
  { market: 'BTC > $150K by June', odds: 34, change: +8, volume: '2.4M', closing: '6h', hot: true, category: 'crypto' },
  { market: 'Fed cuts in March', odds: 78, change: +12, volume: '1.2M', closing: '18d', hot: true, category: 'politics' },
  { market: 'Trump wins 2028', odds: 52, change: -3, volume: '8.1M', closing: '2y', hot: false, category: 'politics' },
];

// Live ticker data - casino floor noise
const TICKER_ITEMS = [
  { type: 'win', user: '@anon_whale', amount: '+$2,340', market: 'BTC > $100K' },
  { type: 'move', change: '+12%', market: 'Fed cuts March' },
  { type: 'volume', amount: '$3.2M', market: 'US Recession 2025' },
  { type: 'win', user: '@crypto_sage', amount: '+$890', market: 'ETH merge success' },
  { type: 'new', market: 'Apple $4T valuation' },
  { type: 'win', user: '@predictor_x', amount: '+$1,200', market: 'Trump indictment' },
  { type: 'move', change: '-8%', market: 'Biden drops out' },
  { type: 'volume', amount: '$1.8M', market: 'OpenAI IPO 2025' },
];

// Leaderboard data - ego trigger
const LEADERBOARD = [
  { rank: 1, brier: 0.12, winRate: 81, predictions: 1204 },
  { rank: 2, brier: 0.15, winRate: 77, predictions: 892 },
  { rank: 3, brier: 0.17, winRate: 74, predictions: 2341 },
  { rank: 4, brier: 0.18, winRate: 73, predictions: 567 },
  { rank: 5, brier: 0.19, winRate: 71, predictions: 1892 },
];

// Market filter categories
const MARKET_FILTERS = [
  { id: 'hot', label: '🔥 Hot', active: true },
  { id: 'crypto', label: '📈 Crypto', active: false },
  { id: 'politics', label: '🏛️ Politics', active: false },
  { id: 'sports', label: '⚽ Sports', active: false },
  { id: 'ai', label: '🤖 AI', active: false },
];

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE TICKER - Casino Floor Noise (FOMO Engine)
// ═══════════════════════════════════════════════════════════════════════════════

function LiveTicker() {
  const renderTickerItem = (item: typeof TICKER_ITEMS[0], index: number) => {
    switch (item.type) {
      case 'win':
        return (
          <span key={index} className="ticker-item win">
            <span className="ticker-dot green" />
            <span className="ticker-user">{item.user}</span>
            <span className="ticker-text">won</span>
            <span className="ticker-amount green">{item.amount}</span>
            <span className="ticker-text">on "{item.market}"</span>
          </span>
        );
      case 'move':
        const isUp = item.change?.startsWith('+');
        return (
          <span key={index} className="ticker-item move">
            <span className={`ticker-dot ${isUp ? 'green' : 'red'}`} />
            <span className="ticker-text">Market moved</span>
            <span className={`ticker-change ${isUp ? 'green' : 'red'}`}>{item.change}</span>
            <span className="ticker-text">on "{item.market}"</span>
          </span>
        );
      case 'volume':
        return (
          <span key={index} className="ticker-item volume">
            <span className="ticker-dot amber" />
            <span className="ticker-amount amber">{item.amount}</span>
            <span className="ticker-text">volume on "{item.market}"</span>
          </span>
        );
      case 'new':
        return (
          <span key={index} className="ticker-item new">
            <span className="ticker-dot cyan" />
            <span className="ticker-badge">NEW</span>
            <span className="ticker-text">"{item.market}" just opened</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="live-ticker" aria-label="Live activity feed">
      <div className="ticker-track">
        <div className="ticker-content">
          {TICKER_ITEMS.map((item, i) => renderTickerItem(item, i))}
          {/* Duplicate for seamless loop */}
          {TICKER_ITEMS.map((item, i) => renderTickerItem(item, i + TICKER_ITEMS.length))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRUST STRIP - Social Proof Numbers
// ═══════════════════════════════════════════════════════════════════════════════

function TrustStrip() {
  const stats = [
    { value: '$2.4M+', label: 'Volume' },
    { value: '847', label: 'Forecasters' },
    { value: '0%', label: 'Platform Fee' },
    { value: '<1s', label: 'Settlement' },
  ];

  return (
    <div className="trust-strip">
      {stats.map((stat, i) => (
        <div key={i} className="trust-stat">
          <span className="trust-value">{stat.value}</span>
          <span className="trust-label">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEADERBOARD PEEK - Ego Trigger
// ═══════════════════════════════════════════════════════════════════════════════

function LeaderboardPeek({ onConnect }: { onConnect: () => void }) {
  const medals = ['🥇', '🥈', '🥉', '4th', '5th'];

  return (
    <section id="leaderboard" className="leaderboard-section" aria-labelledby="leaderboard-title">
      <div className="leaderboard-header">
        <span className="leaderboard-badge">🏆 LIVE RANKINGS</span>
        <h2 id="leaderboard-title" className="leaderboard-title">
          Top Forecasters
        </h2>
        <p className="leaderboard-subtitle">The best predictors this month</p>
      </div>

      <div className="leaderboard-table">
        {LEADERBOARD.map((player, i) => (
          <div key={i} className={`leaderboard-row ${i === 0 ? 'first' : ''}`}>
            <span className="lb-rank">{medals[i]}</span>
            <span className="lb-name">Anonymous</span>
            <div className="lb-stats">
              <span className="lb-stat">
                <span className="lb-stat-label">Brier</span>
                <span className="lb-stat-value">{player.brier.toFixed(2)}</span>
              </span>
              <span className="lb-stat">
                <span className="lb-stat-label">Win Rate</span>
                <span className="lb-stat-value green">{player.winRate}%</span>
              </span>
              <span className="lb-stat">
                <span className="lb-stat-label">Predictions</span>
                <span className="lb-stat-value">{player.predictions.toLocaleString()}</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="leaderboard-cta">
        <p className="cta-question">Could you be on this list?</p>
        <button className="cta-button-secondary" onClick={onConnect}>
          <span>Start Predicting</span>
          <span className="cta-arrow">→</span>
        </button>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FINAL CTA - The Close
// ═══════════════════════════════════════════════════════════════════════════════

function FinalCTA({ onConnect }: { onConnect: () => void }) {
  return (
    <section className="final-cta-section">
      <div className="final-cta-bg" aria-hidden="true">
        <div className="final-glow-left" />
        <div className="final-glow-right" />
      </div>

      <div className="final-cta-content">
        <h2 className="final-cta-title">
          Ready to prove you're <span className="gradient-text">right</span>?
        </h2>

        <div className="final-cta-buttons">
          <button className="final-btn primary" onClick={onConnect}>
            <span>🚀 Coming Soon</span>
          </button>
        </div>

        <p className="final-cta-trust">
          $1 minimum · 0% fees · Your keys, your funds
        </p>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WHICH ONE ARE YOU? - Identity Fork (Character Selection)
// ═══════════════════════════════════════════════════════════════════════════════

function WhichOneAreYou({ onConnect }: { onConnect: () => void }) {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const personas = [
    {
      id: 'forecaster',
      icon: '🎯',
      title: 'The Forecaster',
      subtitle: 'Skill over luck',
      description: 'You have an edge. A thesis. Years of pattern recognition. You want to monetize what you know, not gamble.',
      stats: ['Track record matters', 'Brier score ranking', 'Reputation building'],
      color: 'cyan',
      cta: 'Prove Your Skill'
    },
    {
      id: 'whale',
      title: 'The Whale',
      icon: '💎',
      subtitle: 'Capital seeking alpha',
      description: "You have capital but limited time. You want to back the best forecasters and ride their conviction.",
      stats: ['Follow top predictors', 'Copy-trade signals', 'Passive exposure'],
      color: 'green',
      cta: 'Deploy Capital'
    },
    {
      id: 'degen',
      title: 'The Degen',
      icon: '🔥',
      subtitle: 'Here for the thrill',
      description: "Let's be real—you love the action. You want fast markets, live odds, and that dopamine hit when you're right.",
      stats: ['Quick trades', 'Live markets', 'Instant settlement'],
      color: 'amber',
      cta: 'Start Trading'
    }
  ];

  return (
    <section className="identity-section" aria-labelledby="identity-title">
      <div className="identity-bg" aria-hidden="true">
        <div className="identity-grid" />
        <div className="identity-glow" />
      </div>

      <div className="identity-header">
        <span className="identity-badge">CHOOSE YOUR PATH</span>
        <h2 id="identity-title" className="identity-title">
          Which one are <span className="gradient-text">you</span>?
        </h2>
        <p className="identity-subtitle">
          Three ways to win. One protocol.
        </p>
      </div>

      <div className="identity-cards">
        {personas.map((persona) => (
          <div
            key={persona.id}
            className={`identity-card ${persona.color} ${hoveredCard === persona.id ? 'hovered' : ''}`}
            onMouseEnter={() => setHoveredCard(persona.id)}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div className="card-glow" />
            <div className="card-content">
              <div className="card-icon-row">
                <span className="card-icon">{persona.icon}</span>
                <span className="card-subtitle">{persona.subtitle}</span>
              </div>
              <h3 className="card-title">{persona.title}</h3>
              <p className="card-description">{persona.description}</p>

              <ul className="card-stats">
                {persona.stats.map((stat, i) => (
                  <li key={i} className="stat-item">
                    <span className={`stat-check ${persona.color}`}>✓</span>
                    <span className="stat-text">{stat}</span>
                  </li>
                ))}
              </ul>

              <button className={`card-cta ${persona.color}`} onClick={onConnect}>
                <span>{persona.cta}</span>
                <span className="cta-arrow">→</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="identity-footer">
        Don't fit a box? That's fine. <span className="text-dim">BeRight adapts to how you trade.</span>
      </p>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKET OPPORTUNITY CARD
// ═══════════════════════════════════════════════════════════════════════════════

function MarketCard({ opp, index }: { opp: typeof HOT_OPPS[0]; index: number }) {
  const isUp = opp.change > 0;
  const yesPrice = (opp.odds / 100).toFixed(2);
  const noPrice = ((100 - opp.odds) / 100).toFixed(2);

  return (
    <article
      className={`market-card ${opp.hot ? 'is-hot' : ''}`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Card Header */}
      <div className="card-header">
        <span className="card-closing">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
          {opp.closing}
        </span>
        <span className={`card-change ${isUp ? 'up' : 'down'}`}>
          {isUp ? '↑' : '↓'}{Math.abs(opp.change)}%
        </span>
      </div>

      {/* Market Question */}
      <h3 className="card-market">{opp.market}</h3>

      {/* Odds Bar */}
      <div className="card-odds">
        <div className="odds-bar">
          <div className="odds-fill-yes" style={{ width: `${opp.odds}%` }} />
        </div>
      </div>

      {/* Volume - Bigger number */}
      <div className="card-volume">
        <span className="volume-amount">${opp.volume}</span>
        <span className="volume-label">volume</span>
      </div>

      {/* Quick Trade Buttons */}
      <div className="card-trade-btns">
        <button className="trade-btn yes">
          <span className="trade-side">YES</span>
          <span className="trade-price">${yesPrice}</span>
        </button>
        <button className="trade-btn no">
          <span className="trade-side">NO</span>
          <span className="trade-price">${noPrice}</span>
        </button>
      </div>
    </article>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOW IT WORKS SECTION - Enhanced with visual flow
// ═══════════════════════════════════════════════════════════════════════════════

function HowItWorks() {
  const steps = [
    {
      num: '1',
      title: 'Connect Wallet',
      desc: 'Sign in with email or any Solana wallet',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M19 7V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2v-2"/>
          <path d="M15 7h6v10h-6a2 2 0 01-2-2V9a2 2 0 012-2z"/>
          <circle cx="17" cy="12" r="1"/>
        </svg>
      )
    },
    {
      num: '2',
      title: 'Browse & Trade',
      desc: 'Buy YES or NO shares at market prices',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 3v18h18"/>
          <path d="M18 9l-5 5-4-4-3 3"/>
        </svg>
      )
    },
    {
      num: '3',
      title: 'Collect Winnings',
      desc: 'Winning shares pay $1. Losers pay $0.',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="8" r="6"/>
          <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
        </svg>
      )
    }
  ];

  return (
    <section id="how-it-works" className="how-section" aria-labelledby="how-title">
      <h2 id="how-title" className="how-title">How It Works</h2>

      <div className="how-steps">
        {steps.map((step, i) => (
          <div key={i} className="how-step">
            <div className="step-icon-wrap">
              {step.icon}
            </div>
            <span className="step-num">{step.num}</span>
            <h3 className="step-title">{step.title}</h3>
            <p className="step-desc">{step.desc}</p>
            {i < steps.length - 1 && (
              <div className="step-arrow" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            )}
          </div>
        ))}
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
// TERMINAL PREVIEW SECTION - BeRight Terminal Glimpse
// ═══════════════════════════════════════════════════════════════════════════════

function TerminalPreview() {
  const terminalCommands = [
    { cmd: '/hot', desc: 'Trending markets' },
    { cmd: '/arb', desc: 'Arbitrage scanner' },
    { cmd: '/intel', desc: 'AI briefing' },
    { cmd: '/signals', desc: 'Live alerts' },
  ];

  const agents = [
    { name: 'SCOUT', status: 'ACTIVE', color: '#00D4FF', task: 'Scanning 847 markets...' },
    { name: 'ANALYST', status: 'PROCESSING', color: '#DC1FFF', task: 'Deep dive: BTC $150K' },
    { name: 'TRADER', status: 'READY', color: '#00FF88', task: 'Awaiting signal' },
  ];

  const signals = [
    { type: 'ARB', text: 'Polymarket vs Kalshi: Fed March +4.2%', time: '2s ago' },
    { type: 'HOT', text: 'BTC $150K volume spike +340%', time: '15s ago' },
    { type: 'INTEL', text: 'Breaking: SEC filing detected', time: '42s ago' },
  ];

  return (
    <section id="terminal" className="terminal-section" aria-labelledby="terminal-title">
      <div className="terminal-header">
        <span className="terminal-badge">⚡ Pro Terminal</span>
        <h2 id="terminal-title" className="section-title">
          <span className="title-icon">🖥️</span>
          BeRight Terminal
        </h2>
        <p className="section-subtitle">
          Professional-grade intelligence for serious forecasters
        </p>
      </div>

      <div className="terminal-mockup">
        {/* Scanlines effect */}
        <div className="terminal-scanlines" />

        {/* Terminal window */}
        <div className="terminal-window">
          {/* Title bar */}
          <div className="terminal-title-bar">
            <div className="title-dots">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
            </div>
            <span className="title-text">BeRight Terminal v2.0</span>
            <div className="title-status">
              <span className="status-dot pulse" />
              <span className="status-text">LIVE</span>
            </div>
          </div>

          {/* Main terminal content */}
          <div className="terminal-body">
            {/* Left: Agent Panel */}
            <div className="terminal-agents">
              <div className="agents-header">
                <span className="agents-title">AI AGENTS</span>
                <span className="agents-count">3 ONLINE</span>
              </div>
              {agents.map((agent, i) => (
                <div key={i} className="agent-row" style={{ animationDelay: `${i * 150}ms` }}>
                  <div className="agent-indicator" style={{ background: agent.color }} />
                  <div className="agent-info">
                    <span className="agent-name" style={{ color: agent.color }}>{agent.name}</span>
                    <span className="agent-task">{agent.task}</span>
                  </div>
                  <span className="agent-status" style={{ color: agent.color }}>{agent.status}</span>
                </div>
              ))}
            </div>

            {/* Center: Terminal Input */}
            <div className="terminal-center">
              <div className="terminal-output">
                <div className="output-line welcome">
                  <span className="output-prompt">$</span>
                  <span className="output-text">Welcome to BeRight Terminal</span>
                </div>
                <div className="output-line">
                  <span className="output-prompt">$</span>
                  <span className="output-text typing">/hot</span>
                </div>
                <div className="output-response">
                  <span className="response-label">🔥 TRENDING NOW:</span>
                  <span className="response-item">1. BTC &gt; $150K (34% YES, +8%)</span>
                  <span className="response-item">2. Fed cuts March (78% YES, +12%)</span>
                  <span className="response-item">3. ETH flips BTC (8% YES, +2%)</span>
                </div>
              </div>
              <div className="terminal-input-row">
                <span className="input-prompt">❯</span>
                <span className="input-cursor" />
              </div>
              <div className="command-hints">
                {terminalCommands.map((c, i) => (
                  <span key={i} className="command-hint">
                    <code>{c.cmd}</code>
                    <span>{c.desc}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Right: Signals Feed */}
            <div className="terminal-signals">
              <div className="signals-header">
                <span className="signals-title">LIVE SIGNALS</span>
                <span className="signals-pulse" />
              </div>
              {signals.map((signal, i) => (
                <div key={i} className="signal-row" style={{ animationDelay: `${i * 200}ms` }}>
                  <span className={`signal-type ${signal.type.toLowerCase()}`}>{signal.type}</span>
                  <span className="signal-text">{signal.text}</span>
                  <span className="signal-time">{signal.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="terminal-cta">
        <p className="cta-text">Access the terminal via Web</p>
        <div className="cta-buttons">
          <a href="/beright-terminal" className="terminal-btn web">
            <span>Launch Web Terminal</span>
            <span className="btn-arrow">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLE LAYER CONCEPT - Forecasters ↔ Capitalists (ENHANCED)
// ═══════════════════════════════════════════════════════════════════════════════

function MiddleLayerConcept() {
  return (
    <section id="protocol" className="protocol-section" aria-labelledby="protocol-title">
      {/* Background Effects */}
      <div className="protocol-bg" aria-hidden="true">
        <div className="protocol-grid" />
        <div className="protocol-glow-left" />
        <div className="protocol-glow-right" />
        <div className="protocol-glow-center" />
        {/* Floating particles */}
        <div className="particle p1" />
        <div className="particle p2" />
        <div className="particle p3" />
        <div className="particle p4" />
        <div className="particle p5" />
        <div className="particle p6" />
      </div>

      <div className="protocol-header">
        <span className="protocol-badge">
          <span className="badge-pulse" />
          <span className="badge-text">THE PROTOCOL</span>
        </span>
        <h2 id="protocol-title" className="protocol-title">
          <span className="title-line">The</span>
          <span className="title-main">
            Middle <span className="title-gradient">Layer</span>
          </span>
        </h2>
        <p className="protocol-subtitle">
          Connecting those who <span className="highlight-cyan">know</span> with those who <span className="highlight-green">invest</span>
        </p>
      </div>

      <div className="protocol-visual">
        {/* Data Flow Lines - Left to Center */}
        <div className="data-flow data-flow-left" aria-hidden="true">
          <div className="flow-line">
            <div className="flow-particle fp1" />
            <div className="flow-particle fp2" />
            <div className="flow-particle fp3" />
          </div>
        </div>

        {/* Data Flow Lines - Center to Right */}
        <div className="data-flow data-flow-right" aria-hidden="true">
          <div className="flow-line">
            <div className="flow-particle fp1" />
            <div className="flow-particle fp2" />
            <div className="flow-particle fp3" />
          </div>
        </div>

        {/* Left: Forecasters */}
        <div className="protocol-side forecasters">
          <div className="side-glow" />
          <div className="side-inner">
            <div className="side-header">
              <div className="side-icon-wrapper">
                <div className="icon-ring" />
                <span className="side-icon">🎯</span>
              </div>
              <div className="side-title-group">
                <span className="side-title">Forecasters</span>
                <span className="side-badge elite">ELITE TIER</span>
              </div>
            </div>
            <p className="side-desc">Skilled predictors with <span className="text-cyan">proven track records</span></p>

            <div className="side-metrics">
              <div className="metric-item">
                <div className="metric-icon-wrap cyan">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3v18h18"/>
                    <path d="M18 9l-5 5-4-4-3 3"/>
                  </svg>
                </div>
                <div className="metric-content">
                  <span className="metric-label">Brier Score</span>
                  <div className="metric-value-row">
                    <span className="metric-value cyan">0.18</span>
                    <div className="metric-bar">
                      <div className="metric-fill cyan" style={{ width: '82%' }} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="metric-item">
                <div className="metric-icon-wrap cyan">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="8" r="6"/>
                    <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
                  </svg>
                </div>
                <div className="metric-content">
                  <span className="metric-label">Win Rate</span>
                  <div className="metric-value-row">
                    <span className="metric-value cyan">73%</span>
                    <div className="metric-bar">
                      <div className="metric-fill cyan" style={{ width: '73%' }} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="metric-item">
                <div className="metric-icon-wrap cyan">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
                  </svg>
                </div>
                <div className="metric-content">
                  <span className="metric-label">Predictions</span>
                  <div className="metric-value-row">
                    <span className="metric-value cyan">847</span>
                    <span className="metric-trend up">+12%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="side-benefits">
              <div className="benefit-item">
                <span className="benefit-check cyan">✓</span>
                <span className="benefit-text">Monetize your forecasting skill</span>
              </div>
              <div className="benefit-item">
                <span className="benefit-check cyan">✓</span>
                <span className="benefit-text">Build verifiable reputation</span>
              </div>
              <div className="benefit-item">
                <span className="benefit-check cyan">✓</span>
                <span className="benefit-text">Attract capital to your picks</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: BeRight Protocol Core */}
        <div className="protocol-center">
          <div className="flow-label flow-label-left">
            <span className="flow-text">PREDICTIONS</span>
            <div className="flow-arrows">
              <span className="arrow-char">→</span>
              <span className="arrow-char">→</span>
              <span className="arrow-char">→</span>
            </div>
          </div>

          <div className="protocol-core">
            {/* Multiple orbital rings */}
            <div className="orbital-system">
              <div className="orbit orbit-1">
                <div className="orbit-dot" />
              </div>
              <div className="orbit orbit-2">
                <div className="orbit-dot" />
                <div className="orbit-dot delay" />
              </div>
              <div className="orbit orbit-3">
                <div className="orbit-dot" />
              </div>
            </div>

            {/* Core glow layers */}
            <div className="core-glow-outer" />
            <div className="core-glow-mid" />
            <div className="core-glow-inner" />

            {/* Pulsing rings */}
            <div className="pulse-ring ring-1" />
            <div className="pulse-ring ring-2" />
            <div className="pulse-ring ring-3" />

            {/* Core content */}
            <div className="core-content">
              <div className="core-icon">◉</div>
              <span className="core-label">BeRight</span>
            </div>
          </div>

          <div className="flow-label flow-label-right">
            <div className="flow-arrows">
              <span className="arrow-char">→</span>
              <span className="arrow-char">→</span>
              <span className="arrow-char">→</span>
            </div>
            <span className="flow-text">CAPITAL</span>
          </div>

          <div className="protocol-features">
            <span className="feature-pill">
              <span className="pill-dot" />
              On-chain verification
            </span>
            <span className="feature-pill">
              <span className="pill-dot" />
              AI-powered matching
            </span>
            <span className="feature-pill">
              <span className="pill-dot" />
              Real-time signals
            </span>
          </div>
        </div>

        {/* Right: Capitalists */}
        <div className="protocol-side capitalists">
          <div className="side-glow" />
          <div className="side-inner">
            <div className="side-header">
              <div className="side-icon-wrapper">
                <div className="icon-ring" />
                <span className="side-icon">💰</span>
              </div>
              <div className="side-title-group">
                <span className="side-title">Capitalists</span>
                <span className="side-badge whale">WHALE TIER</span>
              </div>
            </div>
            <p className="side-desc">Investors seeking <span className="text-green">alpha</span> from proven forecasters</p>

            <div className="side-metrics">
              <div className="metric-item">
                <div className="metric-icon-wrap green">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                  </svg>
                </div>
                <div className="metric-content">
                  <span className="metric-label">Capital Deployed</span>
                  <div className="metric-value-row">
                    <span className="metric-value green">$50K+</span>
                    <span className="metric-trend up">↑</span>
                  </div>
                </div>
              </div>
              <div className="metric-item">
                <div className="metric-icon-wrap green">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                  </svg>
                </div>
                <div className="metric-content">
                  <span className="metric-label">Target ROI</span>
                  <div className="metric-value-row">
                    <span className="metric-value green">20%+</span>
                    <div className="metric-bar">
                      <div className="metric-fill green" style={{ width: '65%' }} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="metric-item">
                <div className="metric-icon-wrap green">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                  </svg>
                </div>
                <div className="metric-content">
                  <span className="metric-label">Status</span>
                  <div className="metric-value-row">
                    <span className="metric-value green">Active</span>
                    <span className="status-dot active" />
                  </div>
                </div>
              </div>
            </div>

            <div className="side-benefits">
              <div className="benefit-item">
                <span className="benefit-check green">✓</span>
                <span className="benefit-text">Access top forecaster signals</span>
              </div>
              <div className="benefit-item">
                <span className="benefit-check green">✓</span>
                <span className="benefit-text">Verified performance data</span>
              </div>
              <div className="benefit-item">
                <span className="benefit-check green">✓</span>
                <span className="benefit-text">Automated copy-trading</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="protocol-callout">
        <div className="callout-glow" />
        <div className="callout-content">
          <div className="callout-icon-wrap">
            <span className="callout-icon">⚡</span>
          </div>
          <div className="callout-text-wrapper">
            <p className="callout-headline">The Prediction Market Alpha Layer</p>
            <p className="callout-text">
              BeRight creates a marketplace where <span className="text-gradient">forecasting skill becomes a tradeable asset</span>.
              Top predictors earn by sharing signals. Investors profit by following the best.
            </p>
          </div>
          <div className="callout-stats">
            <div className="callout-stat">
              <span className="stat-value">$2.4M+</span>
              <span className="stat-label">Volume</span>
            </div>
            <div className="callout-stat">
              <span className="stat-value">847</span>
              <span className="stat-label">Forecasters</span>
            </div>
          </div>
        </div>
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
            <h4>Resources</h4>
            <a href="/docs">Documentation</a>
            <a href="/docs/faq">FAQ</a>
          </div>
        </div>

        <div className="footer-social">
          <a href="https://x.com/AgentBEright" aria-label="Twitter" className="social-link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
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
        <p className="footer-copyright">© 2026 BeRight Protocol. All rights reserved.</p>
      </div>
    </footer>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN LANDING COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function LandingHero() {
  const [showComingSoon, setShowComingSoon] = useState(false);

  const handleComingSoon = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate(10);
    setShowComingSoon(true);
    setTimeout(() => setShowComingSoon(false), 3000);
  }, []);

  return (
    <div className="landing">
      {/* Navigation */}
      {/* Coming Soon Toast */}
      {showComingSoon && (
        <div className="coming-soon-toast">
          <span className="toast-icon">🚀</span>
          <span className="toast-text">Launching Soon! Join our Telegram for early access.</span>
        </div>
      )}

      <Header />

      {/* Hero Section - 2 Column Split Layout */}
      <main className="hero">
        {/* Background Effects */}
        <div className="hero-bg" aria-hidden="true">
          <div className="bg-grid" />
          <div className="bg-glow-center" />
          <div className="bg-glow-left" />
          <div className="bg-glow-right" />
          <div className="bg-noise" />
        </div>

        {/* Hero Split Layout */}
        <div className="hero-split">
          {/* LEFT COLUMN - Content */}
          <div className="hero-left">
            {/* Main Headline */}
            <h1 className="hero-headline">
              <span className="headline-pre">Think you're</span>
              <span className="headline-main">
                <span className="gradient-text">Right</span>?
              </span>
            </h1>

            {/* Subheadline - One line */}
            <p className="hero-sub">
              Bet on what you know. Win when you're right.
            </p>

            {/* CTA Buttons */}
            <div className="hero-cta-row">
              <button className="cta-button primary" onClick={handleComingSoon}>
                <span className="cta-text">Coming Soon</span>
                <span className="cta-arrow">🚀</span>
              </button>
            </div>

            {/* Mini stats - inline */}
            <div className="hero-mini-stats">
              <span className="mini-stat">
                <span className="stat-value">$1</span>
                <span className="stat-label">min</span>
              </span>
              <span className="mini-divider">•</span>
              <span className="mini-stat">
                <span className="stat-value">&lt;1s</span>
                <span className="stat-label">settle</span>
              </span>
              <span className="mini-divider">•</span>
              <span className="mini-stat">
                <span className="stat-value">0%</span>
                <span className="stat-label">fees</span>
              </span>
            </div>
          </div>

          {/* RIGHT COLUMN - Live Demo Card */}
          <div className="hero-right">
            <div className="demo-card">
              <div className="demo-card-header">
                <span className="demo-live-dot" />
                <span className="demo-live-text">LIVE DEMO</span>
              </div>

              <div className="demo-step">
                <span className="demo-step-label">QUESTION</span>
                <span className="demo-step-content question">Will ETH hit $5K by Dec?</span>
              </div>

              <div className="demo-arrow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12l7 7 7-7"/>
                </svg>
              </div>

              <div className="demo-step">
                <span className="demo-step-label">YOUR POSITION</span>
                <div className="demo-position-btns">
                  <button className="demo-btn yes active">
                    <span className="btn-side">YES</span>
                    <span className="btn-price">$0.42</span>
                  </button>
                  <button className="demo-btn no">
                    <span className="btn-side">NO</span>
                    <span className="btn-price">$0.58</span>
                  </button>
                </div>
              </div>

              <div className="demo-arrow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12l7 7 7-7"/>
                </svg>
              </div>

              <div className="demo-step outcome">
                <span className="demo-step-label">IF CORRECT</span>
                <span className="demo-payout">+138%</span>
                <span className="demo-payout-sub">$100 → $238</span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            OPTIMIZED LAYOUT ORDER (Based on conversion principles):
            1. Hero (above) - with demo card side-by-side
            2. Live Ticker - Casino floor noise (FOMO)
            3. Trust Bar - Inline social proof
            4. Active Markets - 2-column grid with trade buttons
            5. How It Works - Horizontal 3-column
            6. Leaderboard - Social proof & ego trigger
            7. Choose Your Path - 3-column identity selection
            8. AI Intelligence - Edge showcase
            9. Terminal Preview - Pro features
            10. Final CTA - The close
            ═══════════════════════════════════════════════════════════════════════ */}

        {/* LIVE TICKER - Casino Floor Noise */}
        <LiveTicker />

        {/* TRUST BAR - Inline row (not its own section) */}
        <TrustStrip />

        {/* ACTIVE MARKETS - 2-column grid */}
        <section id="markets" className="markets-section" aria-labelledby="markets-title">
          <div className="markets-header">
            <h2 id="markets-title" className="section-title">Active Markets</h2>
          </div>

          {/* Filter Pills - Emoji first, better visual anchor */}
          <div className="market-filters" role="tablist" aria-label="Market categories">
            {MARKET_FILTERS.map((filter) => (
              <button
                key={filter.id}
                className={`filter-pill ${filter.active ? 'active' : ''}`}
                role="tab"
                aria-selected={filter.active}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="markets-grid">
            {HOT_OPPS.map((opp, i) => (
              <MarketCard key={i} opp={opp} index={i} />
            ))}
          </div>

        </section>

        {/* HOW IT WORKS - Horizontal 3-column */}
        <HowItWorks />

        {/* AI INTELLIGENCE - Edge showcase */}
        <AIIntelligence />

        {/* MIDDLE LAYER - Forecasters ↔ Capitalists */}
        <MiddleLayerConcept />

        {/* TERMINAL PREVIEW - Pro features */}
        <TerminalPreview />

        {/* SOLANA TRUST BLOCK - Merged with footer trust */}
        <TrustSignals />

        {/* FINAL CTA - The Close */}
        <FinalCTA onConnect={handleComingSoon} />
      </main>

      {/* Footer */}
      <Footer />

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
           COMING SOON TOAST
           ═══════════════════════════════════════════════════════════════════════ */

        .coming-soon-toast {
          position: fixed;
          top: 100px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 24px;
          background: linear-gradient(135deg, rgba(0, 255, 136, 0.15), rgba(0, 212, 255, 0.1));
          border: 1px solid rgba(0, 255, 136, 0.3);
          border-radius: 16px;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          z-index: 9999;
          animation: toastSlideIn 0.3s ease-out;
        }

        .toast-icon {
          font-size: 24px;
        }

        .toast-text {
          font-size: 15px;
          font-weight: 600;
          color: var(--color-text);
        }

        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
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

        /* ═══════════════════════════════════════════════════════════════════════
           HERO SPLIT LAYOUT - 2 Column
           ═══════════════════════════════════════════════════════════════════════ */

        .hero-split {
          position: relative;
          z-index: 10;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 60px;
          align-items: center;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
        }

        .hero-left {
          text-align: left;
        }

        .hero-right {
          display: flex;
          justify-content: center;
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
          margin-bottom: 20px;
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
          margin: 0 0 16px;
          animation: fadeUp 0.6s ease-out 0.1s both;
        }

        .headline-pre {
          display: block;
          font-size: 20px;
          font-weight: 500;
          color: var(--color-text-tertiary);
          letter-spacing: 1px;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .headline-main {
          display: block;
          font-size: 64px;
          font-weight: 900;
          line-height: 1.05;
          letter-spacing: -2px;
        }

        .gradient-text {
          background: linear-gradient(135deg, var(--color-green) 0%, var(--color-cyan) 60%, #A855F7 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-sub {
          font-size: 18px;
          color: var(--color-text-secondary);
          line-height: 1.5;
          margin: 0 0 24px;
          animation: fadeUp 0.6s ease-out 0.2s both;
        }

        /* CTA Buttons Row */
        .hero-cta-row {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
          animation: fadeUp 0.6s ease-out 0.3s both;
        }

        .cta-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 16px 28px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s ease;
          text-decoration: none;
        }

        .cta-button.primary {
          background: linear-gradient(135deg, var(--color-green) 0%, #00CC6A 100%);
          border: none;
          color: #000;
          position: relative;
          overflow: hidden;
        }

        .cta-button.primary::before {
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

        .cta-button.primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(0, 255, 136, 0.35);
        }

        .cta-button.ghost {
          background: transparent;
          border: 1px solid var(--color-border);
          color: var(--color-text-secondary);
        }

        .cta-button.ghost:hover {
          border-color: var(--color-text-tertiary);
          color: var(--color-text);
          background: rgba(255, 255, 255, 0.03);
        }

        .cta-arrow {
          font-size: 18px;
          transition: transform 0.2s;
        }

        .cta-button:hover .cta-arrow {
          transform: translateX(3px);
        }

        /* Mini Stats */
        .hero-mini-stats {
          display: flex;
          align-items: center;
          gap: 8px;
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
          font-size: 12px;
        }

        /* ═══════════════════════════════════════════════════════════════════════
           DEMO CARD - Live prediction flow
           ═══════════════════════════════════════════════════════════════════════ */

        .demo-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 20px;
          padding: 24px;
          width: 100%;
          max-width: 340px;
          animation: fadeUp 0.7s ease-out 0.3s both;
        }

        .demo-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 20px;
        }

        .demo-live-dot {
          width: 8px;
          height: 8px;
          background: var(--color-green);
          border-radius: 50%;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(0, 255, 136, 0.4); }
          50% { opacity: 0.8; box-shadow: 0 0 0 8px rgba(0, 255, 136, 0); }
        }

        .demo-live-text {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 600;
          color: var(--color-green);
          letter-spacing: 1px;
        }

        .demo-step {
          margin-bottom: 12px;
        }

        .demo-step-label {
          display: block;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          color: var(--color-text-tertiary);
          letter-spacing: 1px;
          margin-bottom: 6px;
        }

        .demo-step-content {
          font-size: 16px;
          font-weight: 600;
          color: var(--color-text);
        }

        .demo-step-content.question {
          color: var(--color-cyan);
        }

        .demo-arrow {
          display: flex;
          justify-content: center;
          color: var(--color-text-tertiary);
          margin: 8px 0;
        }

        .demo-position-btns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .demo-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 12px;
          border-radius: 10px;
          border: 1px solid var(--color-border);
          background: rgba(255, 255, 255, 0.02);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .demo-btn.yes {
          border-color: rgba(0, 255, 136, 0.2);
        }

        .demo-btn.yes.active {
          background: rgba(0, 255, 136, 0.1);
          border-color: var(--color-green);
        }

        .demo-btn.no {
          border-color: rgba(255, 71, 87, 0.2);
        }

        .demo-btn .btn-side {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        .demo-btn.yes .btn-side { color: var(--color-green); }
        .demo-btn.no .btn-side { color: var(--color-red); }

        .demo-btn .btn-price {
          font-family: var(--font-mono);
          font-size: 18px;
          font-weight: 700;
          color: var(--color-text);
        }

        .demo-step.outcome {
          text-align: center;
          padding: 16px;
          background: rgba(0, 255, 136, 0.05);
          border-radius: 12px;
          margin-bottom: 0;
        }

        .demo-payout {
          display: block;
          font-family: var(--font-mono);
          font-size: 32px;
          font-weight: 700;
          color: var(--color-green);
        }

        .demo-payout-sub {
          font-size: 13px;
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
           MARKETS SECTION - 2 Column Grid
           ═══════════════════════════════════════════════════════════════════════ */

        .markets-section {
          position: relative;
          z-index: 10;
          max-width: 900px;
          margin: 0 auto;
          padding: 60px 24px 80px;
        }

        .markets-header {
          text-align: center;
          margin-bottom: 24px;
        }

        .section-title {
          font-size: 32px;
          font-weight: 700;
          margin: 0 0 8px;
          color: var(--color-text);
        }

        .markets-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        /* Market Card - Compact with Trade Buttons */
        .market-card {
          position: relative;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 16px;
          padding: 20px;
          transition: all 0.2s ease;
          animation: fadeUp 0.5s ease-out both;
        }

        .market-card:hover {
          border-color: var(--color-border-hover);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .market-card.is-hot {
          border-color: rgba(255, 184, 0, 0.25);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .card-closing {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          color: var(--color-text-tertiary);
        }

        .card-change {
          font-size: 12px;
          font-weight: 700;
          font-family: var(--font-mono);
        }

        .card-change.up { color: var(--color-green); }
        .card-change.down { color: var(--color-red); }

        .card-market {
          font-size: 15px;
          font-weight: 600;
          margin: 0 0 12px;
          line-height: 1.35;
          color: var(--color-text);
        }

        .card-odds {
          margin-bottom: 12px;
        }

        .odds-bar {
          height: 6px;
          background: rgba(255, 71, 87, 0.2);
          border-radius: 3px;
          overflow: hidden;
        }

        .odds-fill-yes {
          height: 100%;
          background: linear-gradient(90deg, var(--color-green), #00CC6A);
          border-radius: 3px;
          transition: width 0.3s ease;
        }

        /* Volume - Bigger number, smaller label */
        .card-volume {
          display: flex;
          align-items: baseline;
          gap: 6px;
          margin-bottom: 14px;
        }

        .volume-amount {
          font-size: 18px;
          font-weight: 700;
          font-family: var(--font-mono);
          color: var(--color-text);
        }

        .volume-label {
          font-size: 12px;
          color: var(--color-text-tertiary);
        }

        /* Quick Trade Buttons */
        .card-trade-btns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .trade-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 10px;
          border-radius: 10px;
          border: 1px solid var(--color-border);
          background: rgba(255, 255, 255, 0.02);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .trade-btn.yes {
          border-color: rgba(0, 255, 136, 0.2);
        }

        .trade-btn.yes:hover {
          background: rgba(0, 255, 136, 0.1);
          border-color: var(--color-green);
        }

        .trade-btn.no {
          border-color: rgba(255, 71, 87, 0.2);
        }

        .trade-btn.no:hover {
          background: rgba(255, 71, 87, 0.1);
          border-color: var(--color-red);
        }

        .trade-side {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        .trade-btn.yes .trade-side { color: var(--color-green); }
        .trade-btn.no .trade-side { color: var(--color-red); }

        .trade-price {
          font-family: var(--font-mono);
          font-size: 15px;
          font-weight: 700;
          color: var(--color-text);
        }

        /* ═══════════════════════════════════════════════════════════════════════
           HOW IT WORKS - Horizontal 3-Column
           ═══════════════════════════════════════════════════════════════════════ */

        .how-section {
          position: relative;
          z-index: 10;
          max-width: 900px;
          margin: 0 auto;
          padding: 60px 24px 80px;
          text-align: center;
        }

        .how-title {
          font-size: 32px;
          font-weight: 700;
          color: var(--color-text);
          margin: 0 0 40px;
        }

        .how-steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          position: relative;
        }

        .how-step {
          position: relative;
          text-align: center;
          padding: 24px 16px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 16px;
          transition: all 0.2s ease;
        }

        .how-step:hover {
          border-color: var(--color-border-hover);
          transform: translateY(-4px);
        }

        .step-icon-wrap {
          width: 48px;
          height: 48px;
          margin: 0 auto 16px;
          background: rgba(0, 255, 136, 0.1);
          border: 1px solid rgba(0, 255, 136, 0.2);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-green);
        }

        .step-icon-wrap svg {
          width: 24px;
          height: 24px;
        }

        .step-num {
          display: inline-block;
          width: 24px;
          height: 24px;
          background: linear-gradient(135deg, var(--color-green) 0%, #00CC6A 100%);
          border-radius: 50%;
          font-size: 12px;
          font-weight: 700;
          color: #000;
          line-height: 24px;
          margin-bottom: 12px;
        }

        .step-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--color-text);
          margin: 0 0 8px;
        }

        .step-desc {
          font-size: 14px;
          color: var(--color-text-secondary);
          margin: 0;
          line-height: 1.5;
        }

        .step-arrow {
          position: absolute;
          right: -20px;
          top: 50%;
          transform: translateY(-50%);
          width: 16px;
          height: 16px;
          color: var(--color-text-tertiary);
          z-index: 5;
        }

        .step-arrow svg {
          width: 100%;
          height: 100%;
        }

        /* ═══════════════════════════════════════════════════════════════════════
           AI INTELLIGENCE SECTION
           ═══════════════════════════════════════════════════════════════════════ */

        .ai-section {
          position: relative;
          z-index: 10;
          padding: 80px 24px;
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
           TERMINAL PREVIEW SECTION
           ═══════════════════════════════════════════════════════════════════════ */

        .terminal-section {
          position: relative;
          z-index: 10;
          padding: 80px 24px;
        }

        .terminal-header {
          text-align: center;
          margin-bottom: 48px;
        }

        .terminal-badge {
          display: inline-block;
          padding: 6px 14px;
          background: linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(0, 255, 136, 0.15) 100%);
          border: 1px solid rgba(0, 212, 255, 0.3);
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          color: var(--color-cyan);
          margin-bottom: 16px;
          letter-spacing: 0.5px;
        }

        .terminal-mockup {
          position: relative;
          max-width: 1000px;
          margin: 0 auto;
          border-radius: 16px;
          overflow: hidden;
          animation: fadeUp 0.6s ease-out both;
        }

        .terminal-scanlines {
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.03) 2px,
            rgba(0, 0, 0, 0.03) 4px
          );
          pointer-events: none;
          z-index: 10;
        }

        .terminal-window {
          background: linear-gradient(180deg, #0a0a0c 0%, #050506 100%);
          border: 1px solid rgba(0, 212, 255, 0.2);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 0 60px rgba(0, 212, 255, 0.1), 0 0 120px rgba(0, 212, 255, 0.05);
        }

        .terminal-title-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.5);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .title-dots {
          display: flex;
          gap: 8px;
        }

        .title-dots .dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .dot.red { background: #ff5f57; }
        .dot.yellow { background: #febc2e; }
        .dot.green { background: #28c840; }

        .title-text {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-text-tertiary);
          letter-spacing: 0.5px;
        }

        .title-status {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          background: var(--color-green);
          border-radius: 50%;
        }

        .status-dot.pulse {
          animation: statusPulse 2s ease-in-out infinite;
        }

        @keyframes statusPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 4px var(--color-green); }
          50% { opacity: 0.5; box-shadow: 0 0 8px var(--color-green); }
        }

        .status-text {
          font-size: 10px;
          font-weight: 700;
          color: var(--color-green);
          letter-spacing: 1px;
        }

        .terminal-body {
          display: grid;
          grid-template-columns: 220px 1fr 240px;
          gap: 1px;
          background: rgba(255, 255, 255, 0.03);
          min-height: 300px;
        }

        /* Agent Panel */
        .terminal-agents {
          background: rgba(0, 0, 0, 0.3);
          padding: 16px;
        }

        .agents-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--color-border);
        }

        .agents-title {
          font-size: 10px;
          font-weight: 700;
          color: var(--color-cyan);
          letter-spacing: 1px;
        }

        .agents-count {
          font-size: 9px;
          font-weight: 600;
          color: var(--color-green);
          padding: 2px 6px;
          background: rgba(0, 255, 136, 0.1);
          border-radius: 4px;
        }

        .agent-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          margin-bottom: 8px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          animation: fadeUp 0.4s ease-out both;
        }

        .agent-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
          box-shadow: 0 0 8px currentColor;
        }

        .agent-info {
          flex: 1;
          min-width: 0;
        }

        .agent-name {
          display: block;
          font-size: 11px;
          font-weight: 700;
          font-family: var(--font-mono);
          letter-spacing: 0.5px;
        }

        .agent-task {
          display: block;
          font-size: 9px;
          color: var(--color-text-tertiary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .agent-status {
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        /* Terminal Center */
        .terminal-center {
          background: rgba(0, 0, 0, 0.2);
          padding: 20px;
          display: flex;
          flex-direction: column;
        }

        .terminal-output {
          flex: 1;
          font-family: var(--font-mono);
        }

        .output-line {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }

        .output-line.welcome .output-text {
          color: var(--color-cyan);
        }

        .output-prompt {
          color: var(--color-green);
          font-weight: 600;
        }

        .output-text {
          color: var(--color-text);
          font-size: 13px;
        }

        .output-text.typing {
          color: var(--color-green);
        }

        .output-text.typing::after {
          content: '|';
          animation: blink 1s step-end infinite;
        }

        @keyframes blink {
          50% { opacity: 0; }
        }

        .output-response {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 12px;
          margin: 12px 0;
          background: rgba(0, 255, 136, 0.05);
          border: 1px solid rgba(0, 255, 136, 0.15);
          border-radius: 8px;
        }

        .response-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-amber);
          margin-bottom: 4px;
        }

        .response-item {
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        .terminal-input-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .input-prompt {
          color: var(--color-cyan);
          font-family: var(--font-mono);
          font-weight: 700;
        }

        .input-cursor {
          width: 8px;
          height: 16px;
          background: var(--color-green);
          animation: cursorBlink 1s step-end infinite;
        }

        @keyframes cursorBlink {
          50% { opacity: 0; }
        }

        .command-hints {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .command-hint {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--color-border);
          border-radius: 6px;
          font-size: 11px;
        }

        .command-hint code {
          color: var(--color-cyan);
          font-family: var(--font-mono);
          font-weight: 600;
        }

        .command-hint span {
          color: var(--color-text-tertiary);
        }

        /* Signals Feed */
        .terminal-signals {
          background: rgba(0, 0, 0, 0.3);
          padding: 16px;
        }

        .signals-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--color-border);
        }

        .signals-title {
          font-size: 10px;
          font-weight: 700;
          color: #DC1FFF;
          letter-spacing: 1px;
        }

        .signals-pulse {
          width: 8px;
          height: 8px;
          background: #DC1FFF;
          border-radius: 50%;
          animation: signalPulse 2s ease-in-out infinite;
        }

        @keyframes signalPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }

        .signal-row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 10px;
          margin-bottom: 8px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          animation: fadeUp 0.4s ease-out both;
        }

        .signal-type {
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.5px;
          flex-shrink: 0;
        }

        .signal-type.arb {
          background: rgba(0, 255, 136, 0.15);
          color: var(--color-green);
        }

        .signal-type.hot {
          background: rgba(255, 184, 0, 0.15);
          color: var(--color-amber);
        }

        .signal-type.intel {
          background: rgba(220, 31, 255, 0.15);
          color: #DC1FFF;
        }

        .signal-text {
          flex: 1;
          font-size: 10px;
          color: var(--color-text-secondary);
          line-height: 1.4;
        }

        .signal-time {
          font-size: 9px;
          color: var(--color-text-tertiary);
          flex-shrink: 0;
        }

        /* Terminal CTA */
        .terminal-cta {
          text-align: center;
          margin-top: 32px;
        }

        .terminal-cta .cta-text {
          font-size: 14px;
          color: var(--color-text-tertiary);
          margin-bottom: 16px;
        }

        .cta-buttons {
          display: flex;
          justify-content: center;
          gap: 12px;
        }

        .terminal-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 24px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .terminal-btn.telegram {
          background: rgba(0, 136, 204, 0.15);
          border: 1px solid rgba(0, 136, 204, 0.3);
          color: #0088cc;
        }

        .terminal-btn.telegram:hover {
          background: rgba(0, 136, 204, 0.25);
          border-color: #0088cc;
          transform: translateY(-2px);
        }

        .terminal-btn.web {
          background: linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(0, 255, 136, 0.1) 100%);
          border: 1px solid rgba(0, 212, 255, 0.3);
          color: var(--color-cyan);
        }

        .terminal-btn.web:hover {
          background: linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(0, 255, 136, 0.15) 100%);
          border-color: var(--color-cyan);
          transform: translateY(-2px);
        }

        .terminal-btn .btn-arrow {
          transition: transform 0.2s;
        }

        .terminal-btn:hover .btn-arrow {
          transform: translateX(4px);
        }

        /* ═══════════════════════════════════════════════════════════════════════
           MIDDLE LAYER / PROTOCOL SECTION - ENHANCED
           ═══════════════════════════════════════════════════════════════════════ */

        .protocol-section {
          position: relative;
          z-index: 10;
          padding: 80px 24px;
          overflow: hidden;
        }

        /* Protocol Background Effects */
        .protocol-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }

        .protocol-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(0, 212, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 212, 255, 0.03) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: radial-gradient(ellipse 70% 50% at 50% 50%, black, transparent);
        }

        .protocol-glow-left {
          position: absolute;
          width: 500px;
          height: 500px;
          left: -100px;
          top: 50%;
          transform: translateY(-50%);
          background: radial-gradient(circle, rgba(0, 212, 255, 0.15) 0%, transparent 60%);
          filter: blur(80px);
          animation: glowPulse 4s ease-in-out infinite;
        }

        .protocol-glow-right {
          position: absolute;
          width: 500px;
          height: 500px;
          right: -100px;
          top: 50%;
          transform: translateY(-50%);
          background: radial-gradient(circle, rgba(0, 255, 136, 0.15) 0%, transparent 60%);
          filter: blur(80px);
          animation: glowPulse 4s ease-in-out infinite 2s;
        }

        .protocol-glow-center {
          position: absolute;
          width: 600px;
          height: 600px;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          background: radial-gradient(circle, rgba(0, 255, 136, 0.1) 0%, transparent 50%);
          filter: blur(60px);
          animation: glowPulse 3s ease-in-out infinite 1s;
        }

        @keyframes glowPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        /* Floating particles */
        .particle {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--color-green);
          opacity: 0.6;
          animation: floatParticle 15s linear infinite;
        }

        .particle.p1 { left: 10%; top: 20%; animation-delay: 0s; background: var(--color-cyan); }
        .particle.p2 { left: 25%; top: 70%; animation-delay: 2s; }
        .particle.p3 { left: 75%; top: 30%; animation-delay: 4s; background: var(--color-cyan); }
        .particle.p4 { left: 85%; top: 60%; animation-delay: 6s; }
        .particle.p5 { left: 50%; top: 15%; animation-delay: 8s; background: #A855F7; }
        .particle.p6 { left: 60%; top: 80%; animation-delay: 10s; }

        @keyframes floatParticle {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 0.6; }
          90% { opacity: 0.6; }
          100% { transform: translateY(-100px) translateX(30px); opacity: 0; }
        }

        /* Protocol Header */
        .protocol-header {
          text-align: center;
          margin-bottom: 64px;
          position: relative;
          z-index: 2;
        }

        .protocol-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 18px;
          background: linear-gradient(135deg, rgba(0, 255, 136, 0.15) 0%, rgba(0, 212, 255, 0.1) 100%);
          border: 1px solid rgba(0, 255, 136, 0.3);
          border-radius: 100px;
          margin-bottom: 20px;
        }

        .badge-pulse {
          width: 8px;
          height: 8px;
          background: var(--color-green);
          border-radius: 50%;
          animation: badgePulse 2s ease-in-out infinite;
        }

        @keyframes badgePulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 4px var(--color-green); }
          50% { opacity: 0.5; box-shadow: 0 0 12px var(--color-green); }
        }

        .badge-text {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 2px;
          color: var(--color-green);
        }

        .protocol-title {
          margin: 0 0 16px;
        }

        .protocol-title .title-line {
          display: block;
          font-size: 18px;
          font-weight: 500;
          color: var(--color-text-tertiary);
          letter-spacing: 3px;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .protocol-title .title-main {
          display: block;
          font-size: 56px;
          font-weight: 900;
          color: var(--color-text);
          letter-spacing: -2px;
          line-height: 1.1;
        }

        .protocol-title .title-gradient {
          background: linear-gradient(135deg, var(--color-green) 0%, var(--color-cyan) 50%, #A855F7 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .protocol-subtitle {
          font-size: 18px;
          color: var(--color-text-secondary);
          margin: 0;
        }

        .highlight-cyan {
          color: var(--color-cyan);
          font-weight: 600;
        }

        .highlight-green {
          color: var(--color-green);
          font-weight: 600;
        }

        /* Protocol Visual Layout */
        .protocol-visual {
          display: grid;
          grid-template-columns: 1fr 320px 1fr;
          gap: 40px;
          align-items: center;
          margin-bottom: 60px;
          position: relative;
          z-index: 2;
        }

        /* Data Flow Lines */
        .data-flow {
          position: absolute;
          top: 50%;
          height: 2px;
          pointer-events: none;
          z-index: 1;
        }

        .data-flow-left {
          left: calc(33.33% - 20px);
          width: 80px;
          transform: translateY(-50%);
        }

        .data-flow-right {
          right: calc(33.33% - 20px);
          width: 80px;
          transform: translateY(-50%);
        }

        .flow-line {
          position: relative;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, rgba(0, 212, 255, 0.3), rgba(0, 255, 136, 0.3));
        }

        .flow-particle {
          position: absolute;
          width: 8px;
          height: 8px;
          background: var(--color-cyan);
          border-radius: 50%;
          top: 50%;
          transform: translateY(-50%);
          animation: flowParticle 2s linear infinite;
          box-shadow: 0 0 10px var(--color-cyan);
        }

        .data-flow-right .flow-particle {
          background: var(--color-green);
          box-shadow: 0 0 10px var(--color-green);
        }

        .flow-particle.fp1 { animation-delay: 0s; }
        .flow-particle.fp2 { animation-delay: 0.6s; }
        .flow-particle.fp3 { animation-delay: 1.2s; }

        @keyframes flowParticle {
          0% { left: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }

        /* Protocol Side Cards */
        .protocol-side {
          position: relative;
          border-radius: 24px;
          overflow: hidden;
          animation: fadeUp 0.6s ease-out both;
          transition: all 0.4s ease;
        }

        .protocol-side.forecasters { animation-delay: 0.1s; }
        .protocol-side.capitalists { animation-delay: 0.3s; }

        .side-glow {
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 0.4s ease;
        }

        .forecasters .side-glow {
          background: radial-gradient(ellipse at center, rgba(0, 212, 255, 0.15) 0%, transparent 70%);
        }

        .capitalists .side-glow {
          background: radial-gradient(ellipse at center, rgba(0, 255, 136, 0.15) 0%, transparent 70%);
        }

        .protocol-side:hover .side-glow {
          opacity: 1;
        }

        .side-inner {
          position: relative;
          z-index: 2;
          padding: 32px;
          background: linear-gradient(145deg, rgba(17, 17, 19, 0.95) 0%, rgba(10, 10, 11, 0.98) 100%);
          border: 1px solid var(--color-border);
          border-radius: 24px;
          transition: all 0.4s ease;
        }

        .forecasters .side-inner {
          border-color: rgba(0, 212, 255, 0.2);
        }

        .capitalists .side-inner {
          border-color: rgba(0, 255, 136, 0.2);
        }

        .protocol-side:hover .side-inner {
          transform: translateY(-4px);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        }

        .forecasters:hover .side-inner {
          border-color: rgba(0, 212, 255, 0.4);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), 0 0 40px rgba(0, 212, 255, 0.1);
        }

        .capitalists:hover .side-inner {
          border-color: rgba(0, 255, 136, 0.4);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), 0 0 40px rgba(0, 255, 136, 0.1);
        }

        /* Side Header */
        .side-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 12px;
        }

        .side-icon-wrapper {
          position: relative;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .icon-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          animation: iconRing 3s ease-in-out infinite;
        }

        .forecasters .icon-ring {
          border: 2px solid rgba(0, 212, 255, 0.3);
        }

        .capitalists .icon-ring {
          border: 2px solid rgba(0, 255, 136, 0.3);
        }

        @keyframes iconRing {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.15); opacity: 1; }
        }

        .side-icon {
          font-size: 28px;
          z-index: 2;
        }

        .side-title-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .side-title {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }

        .forecasters .side-title {
          background: linear-gradient(90deg, var(--color-cyan), #A855F7);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .capitalists .side-title {
          background: linear-gradient(90deg, var(--color-green), var(--color-cyan));
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .side-badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1px;
          width: fit-content;
        }

        .side-badge.elite {
          background: rgba(0, 212, 255, 0.15);
          color: var(--color-cyan);
          border: 1px solid rgba(0, 212, 255, 0.3);
        }

        .side-badge.whale {
          background: rgba(0, 255, 136, 0.15);
          color: var(--color-green);
          border: 1px solid rgba(0, 255, 136, 0.3);
        }

        .side-desc {
          font-size: 14px;
          color: var(--color-text-secondary);
          margin: 0 0 24px;
          line-height: 1.5;
        }

        .text-cyan { color: var(--color-cyan); }
        .text-green { color: var(--color-green); }

        /* Side Metrics */
        .side-metrics {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
          padding: 20px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--color-border);
          border-radius: 16px;
        }

        .metric-item {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .metric-icon-wrap {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          flex-shrink: 0;
        }

        .metric-icon-wrap.cyan {
          background: rgba(0, 212, 255, 0.1);
          border: 1px solid rgba(0, 212, 255, 0.2);
        }

        .metric-icon-wrap.green {
          background: rgba(0, 255, 136, 0.1);
          border: 1px solid rgba(0, 255, 136, 0.2);
        }

        .metric-icon-wrap svg {
          width: 18px;
          height: 18px;
        }

        .metric-icon-wrap.cyan svg { stroke: var(--color-cyan); }
        .metric-icon-wrap.green svg { stroke: var(--color-green); }

        .metric-content {
          flex: 1;
          min-width: 0;
        }

        .metric-label {
          display: block;
          font-size: 11px;
          color: var(--color-text-tertiary);
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .metric-value-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .metric-value {
          font-size: 18px;
          font-weight: 800;
          font-family: var(--font-mono);
        }

        .metric-value.cyan { color: var(--color-cyan); }
        .metric-value.green { color: var(--color-green); }

        .metric-bar {
          flex: 1;
          height: 6px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
          overflow: hidden;
        }

        .metric-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 1s ease-out;
        }

        .metric-fill.cyan {
          background: linear-gradient(90deg, var(--color-cyan), #A855F7);
        }

        .metric-fill.green {
          background: linear-gradient(90deg, var(--color-green), var(--color-cyan));
        }

        .metric-trend {
          font-size: 11px;
          font-weight: 700;
          font-family: var(--font-mono);
        }

        .metric-trend.up { color: var(--color-green); }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .status-dot.active {
          background: var(--color-green);
          animation: statusBlink 2s ease-in-out infinite;
          box-shadow: 0 0 8px var(--color-green);
        }

        @keyframes statusBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* Side Benefits */
        .side-benefits {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .benefit-item {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .benefit-check {
          font-size: 14px;
          font-weight: 700;
        }

        .benefit-check.cyan { color: var(--color-cyan); }
        .benefit-check.green { color: var(--color-green); }

        .benefit-text {
          font-size: 13px;
          color: var(--color-text-secondary);
        }

        /* Protocol Center - Core */
        .protocol-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          animation: fadeUp 0.6s ease-out 0.2s both;
        }

        .flow-label {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .flow-label-right {
          margin-bottom: 0;
          margin-top: 24px;
        }

        .flow-text {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 2px;
          color: var(--color-text-tertiary);
        }

        .flow-arrows {
          display: flex;
          gap: 2px;
        }

        .arrow-char {
          font-size: 14px;
          color: var(--color-green);
          opacity: 0.3;
          animation: arrowFlow 1.5s ease-in-out infinite;
        }

        .arrow-char:nth-child(1) { animation-delay: 0s; }
        .arrow-char:nth-child(2) { animation-delay: 0.2s; }
        .arrow-char:nth-child(3) { animation-delay: 0.4s; }

        @keyframes arrowFlow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }

        .protocol-core {
          position: relative;
          width: 180px;
          height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Orbital System */
        .orbital-system {
          position: absolute;
          inset: 0;
        }

        .orbit {
          position: absolute;
          border-radius: 50%;
          border: 1px solid;
          animation: orbitRotate linear infinite;
        }

        .orbit-1 {
          inset: 10px;
          border-color: rgba(0, 255, 136, 0.2);
          animation-duration: 10s;
        }

        .orbit-2 {
          inset: -10px;
          border-color: rgba(0, 212, 255, 0.15);
          animation-duration: 15s;
          animation-direction: reverse;
        }

        .orbit-3 {
          inset: -30px;
          border-color: rgba(168, 85, 247, 0.1);
          animation-duration: 20s;
        }

        @keyframes orbitRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .orbit-dot {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
        }

        .orbit-1 .orbit-dot { background: var(--color-green); box-shadow: 0 0 8px var(--color-green); }
        .orbit-2 .orbit-dot { background: var(--color-cyan); box-shadow: 0 0 8px var(--color-cyan); }
        .orbit-2 .orbit-dot.delay { top: auto; bottom: 0; }
        .orbit-3 .orbit-dot { background: #A855F7; box-shadow: 0 0 8px #A855F7; }

        /* Core Glow Layers */
        .core-glow-outer,
        .core-glow-mid,
        .core-glow-inner {
          position: absolute;
          border-radius: 50%;
          filter: blur(20px);
        }

        .core-glow-outer {
          width: 160px;
          height: 160px;
          background: radial-gradient(circle, rgba(0, 255, 136, 0.2) 0%, transparent 70%);
          animation: coreGlowPulse 3s ease-in-out infinite;
        }

        .core-glow-mid {
          width: 120px;
          height: 120px;
          background: radial-gradient(circle, rgba(0, 212, 255, 0.15) 0%, transparent 70%);
          animation: coreGlowPulse 3s ease-in-out infinite 0.5s;
        }

        .core-glow-inner {
          width: 80px;
          height: 80px;
          background: radial-gradient(circle, rgba(168, 85, 247, 0.2) 0%, transparent 70%);
          animation: coreGlowPulse 3s ease-in-out infinite 1s;
        }

        @keyframes coreGlowPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }

        /* Pulse Rings */
        .pulse-ring {
          position: absolute;
          border-radius: 50%;
          border: 2px solid var(--color-green);
          animation: pulseRingExpand 3s ease-out infinite;
        }

        .ring-1 { width: 60px; height: 60px; animation-delay: 0s; }
        .ring-2 { width: 60px; height: 60px; animation-delay: 1s; }
        .ring-3 { width: 60px; height: 60px; animation-delay: 2s; }

        @keyframes pulseRingExpand {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(2.5); opacity: 0; }
        }

        /* Core Content */
        .core-content {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          background: linear-gradient(145deg, rgba(17, 17, 19, 0.95) 0%, rgba(10, 10, 11, 0.98) 100%);
          border: 2px solid rgba(0, 255, 136, 0.4);
          border-radius: 50%;
          width: 100px;
          height: 100px;
          justify-content: center;
          box-shadow: 0 0 30px rgba(0, 255, 136, 0.2);
        }

        .core-icon {
          font-size: 32px;
          color: var(--color-green);
          line-height: 1;
        }

        .core-label {
          font-size: 12px;
          font-weight: 800;
          color: var(--color-text);
          margin-top: 2px;
          letter-spacing: 0.5px;
        }

        /* Protocol Features */
        .protocol-features {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 10px;
          margin-top: 32px;
        }

        .feature-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(0, 255, 136, 0.05);
          border: 1px solid rgba(0, 255, 136, 0.2);
          border-radius: 100px;
          font-size: 12px;
          color: var(--color-text-secondary);
          transition: all 0.3s ease;
        }

        .feature-pill:hover {
          background: rgba(0, 255, 136, 0.1);
          border-color: rgba(0, 255, 136, 0.4);
          color: var(--color-text);
        }

        .pill-dot {
          width: 6px;
          height: 6px;
          background: var(--color-green);
          border-radius: 50%;
          animation: pillDotPulse 2s ease-in-out infinite;
        }

        @keyframes pillDotPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; box-shadow: 0 0 6px var(--color-green); }
        }

        /* Protocol Callout */
        .protocol-callout {
          position: relative;
          max-width: 900px;
          margin: 0 auto;
          z-index: 2;
        }

        .callout-glow {
          position: absolute;
          inset: -20px;
          background: radial-gradient(ellipse at center, rgba(0, 255, 136, 0.1) 0%, transparent 70%);
          filter: blur(40px);
          opacity: 0;
          transition: opacity 0.4s ease;
        }

        .protocol-callout:hover .callout-glow {
          opacity: 1;
        }

        .protocol-callout .callout-content {
          position: relative;
          display: flex;
          align-items: center;
          gap: 24px;
          padding: 32px 40px;
          background: linear-gradient(135deg, rgba(17, 17, 19, 0.95) 0%, rgba(10, 10, 11, 0.98) 100%);
          border: 1px solid rgba(0, 255, 136, 0.2);
          border-radius: 24px;
          transition: all 0.4s ease;
        }

        .protocol-callout:hover .callout-content {
          border-color: rgba(0, 255, 136, 0.4);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        }

        .callout-icon-wrap {
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(0, 255, 136, 0.2) 0%, rgba(0, 212, 255, 0.15) 100%);
          border: 1px solid rgba(0, 255, 136, 0.3);
          border-radius: 16px;
          flex-shrink: 0;
        }

        .protocol-callout .callout-icon {
          font-size: 28px;
        }

        .callout-text-wrapper {
          flex: 1;
        }

        .callout-headline {
          font-size: 20px;
          font-weight: 800;
          color: var(--color-text);
          margin: 0 0 8px;
        }

        .protocol-callout .callout-text {
          font-size: 14px;
          color: var(--color-text-secondary);
          line-height: 1.6;
          margin: 0;
        }

        .text-gradient {
          background: linear-gradient(90deg, var(--color-green), var(--color-cyan));
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          font-weight: 600;
        }

        .callout-stats {
          display: flex;
          gap: 24px;
          flex-shrink: 0;
        }

        .callout-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px 20px;
          background: rgba(0, 255, 136, 0.05);
          border: 1px solid rgba(0, 255, 136, 0.15);
          border-radius: 12px;
        }

        .stat-value {
          font-size: 20px;
          font-weight: 800;
          font-family: var(--font-mono);
          color: var(--color-green);
        }

        .stat-label {
          font-size: 10px;
          color: var(--color-text-tertiary);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-top: 2px;
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
          max-width: 900px;
          margin: 0 auto 80px;
          padding: 32px 48px;
          background: linear-gradient(135deg, rgba(0, 255, 163, 0.03) 0%, rgba(220, 31, 255, 0.02) 100%);
          border: 1px solid rgba(0, 255, 163, 0.15);
          border-radius: 20px;
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
           LIVE TICKER - Casino Floor Noise
           ═══════════════════════════════════════════════════════════════════════ */

        .live-ticker {
          position: relative;
          width: 100%;
          background: linear-gradient(180deg, rgba(0, 255, 136, 0.03) 0%, transparent 100%);
          border-top: 1px solid rgba(0, 255, 136, 0.15);
          border-bottom: 1px solid rgba(0, 255, 136, 0.1);
          padding: 12px 0;
          overflow: hidden;
          margin-top: 40px;
        }

        .live-ticker::before,
        .live-ticker::after {
          content: '';
          position: absolute;
          top: 0;
          width: 80px;
          height: 100%;
          z-index: 2;
          pointer-events: none;
        }

        .live-ticker::before {
          left: 0;
          background: linear-gradient(90deg, var(--color-bg), transparent);
        }

        .live-ticker::after {
          right: 0;
          background: linear-gradient(270deg, var(--color-bg), transparent);
        }

        .ticker-track {
          display: flex;
          width: 100%;
        }

        .ticker-content {
          display: flex;
          gap: 48px;
          animation: tickerScroll 40s linear infinite;
          white-space: nowrap;
        }

        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .ticker-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-mono);
          font-size: 13px;
          color: var(--color-text-secondary);
        }

        .ticker-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          animation: tickerPulse 2s ease-in-out infinite;
        }

        .ticker-dot.green {
          background: var(--color-green);
          box-shadow: 0 0 12px var(--color-green);
        }

        .ticker-dot.red {
          background: var(--color-red);
          box-shadow: 0 0 12px var(--color-red);
        }

        .ticker-dot.amber {
          background: var(--color-amber);
          box-shadow: 0 0 12px var(--color-amber);
        }

        .ticker-dot.cyan {
          background: var(--color-cyan);
          box-shadow: 0 0 12px var(--color-cyan);
        }

        @keyframes tickerPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .ticker-user {
          color: var(--color-cyan);
          font-weight: 600;
        }

        .ticker-amount {
          font-weight: 600;
        }

        .ticker-amount.green,
        .ticker-change.green {
          color: var(--color-green);
        }

        .ticker-amount.amber {
          color: var(--color-amber);
        }

        .ticker-change.red {
          color: var(--color-red);
        }

        .ticker-badge {
          background: rgba(0, 212, 255, 0.2);
          color: var(--color-cyan);
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* ═══════════════════════════════════════════════════════════════════════
           TRUST STRIP - Social Proof Numbers
           ═══════════════════════════════════════════════════════════════════════ */

        .trust-strip {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 48px;
          padding: 32px 24px;
          background: rgba(255, 255, 255, 0.02);
          border-top: 1px solid var(--color-border);
          border-bottom: 1px solid var(--color-border);
          margin: 0 0 60px;
        }

        .trust-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .trust-value {
          font-family: var(--font-mono);
          font-size: 28px;
          font-weight: 700;
          color: var(--color-text);
          letter-spacing: -0.5px;
        }

        .trust-label {
          font-size: 13px;
          color: var(--color-text-tertiary);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        /* ═══════════════════════════════════════════════════════════════════════
           MARKET FILTER PILLS
           ═══════════════════════════════════════════════════════════════════════ */

        .market-filters {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin-bottom: 32px;
          flex-wrap: wrap;
        }

        .filter-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 20px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--color-border);
          border-radius: 100px;
          color: var(--color-text-secondary);
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .filter-pill:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: var(--color-border-hover);
          color: var(--color-text);
        }

        .filter-pill.active {
          background: rgba(0, 255, 136, 0.1);
          border-color: rgba(0, 255, 136, 0.3);
          color: var(--color-green);
        }

        /* ═══════════════════════════════════════════════════════════════════════
           LEADERBOARD PEEK - Ego Trigger
           ═══════════════════════════════════════════════════════════════════════ */

        .leaderboard-section {
          max-width: 900px;
          margin: 80px auto;
          padding: 0 24px;
        }

        .leaderboard-header {
          text-align: center;
          margin-bottom: 40px;
        }

        .leaderboard-badge {
          display: inline-block;
          padding: 8px 16px;
          background: rgba(255, 184, 0, 0.1);
          border: 1px solid rgba(255, 184, 0, 0.2);
          border-radius: 100px;
          color: var(--color-amber);
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 1px;
          margin-bottom: 20px;
        }

        .leaderboard-title {
          font-family: var(--font-display);
          font-size: 42px;
          font-weight: 700;
          color: var(--color-text);
          margin: 0 0 12px;
        }

        .leaderboard-subtitle {
          font-size: 16px;
          color: var(--color-text-secondary);
          margin: 0;
        }

        .leaderboard-table {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 16px;
          overflow: hidden;
        }

        .leaderboard-row {
          display: flex;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid var(--color-border);
          transition: background 0.2s ease;
        }

        .leaderboard-row:last-child {
          border-bottom: none;
        }

        .leaderboard-row:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .leaderboard-row.first {
          background: rgba(255, 184, 0, 0.05);
          border-left: 3px solid var(--color-amber);
        }

        .lb-rank {
          font-size: 24px;
          width: 50px;
          text-align: center;
        }

        .lb-name {
          font-family: var(--font-mono);
          font-size: 15px;
          color: var(--color-text-secondary);
          flex: 1;
          margin-left: 16px;
        }

        .lb-stats {
          display: flex;
          gap: 32px;
        }

        .lb-stat {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }

        .lb-stat-label {
          font-size: 11px;
          color: var(--color-text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .lb-stat-value {
          font-family: var(--font-mono);
          font-size: 15px;
          font-weight: 600;
          color: var(--color-text);
        }

        .lb-stat-value.green {
          color: var(--color-green);
        }

        .leaderboard-cta {
          text-align: center;
          margin-top: 32px;
        }

        .cta-question {
          font-size: 18px;
          color: var(--color-text-secondary);
          margin-bottom: 16px;
        }

        .cta-button-secondary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          background: transparent;
          border: 2px solid var(--color-green);
          border-radius: 12px;
          color: var(--color-green);
          font-family: var(--font-display);
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .cta-button-secondary:hover {
          background: var(--color-green);
          color: var(--color-bg);
        }

        .cta-button-secondary .cta-arrow {
          transition: transform 0.2s ease;
        }

        .cta-button-secondary:hover .cta-arrow {
          transform: translateX(4px);
        }

        /* ═══════════════════════════════════════════════════════════════════════
           WHICH ONE ARE YOU? - Identity Fork
           ═══════════════════════════════════════════════════════════════════════ */

        .identity-section {
          position: relative;
          max-width: 1200px;
          margin: 80px auto;
          padding: 80px 24px;
          overflow: hidden;
        }

        .identity-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .identity-grid {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
          background-size: 40px 40px;
          opacity: 0.5;
        }

        .identity-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(0, 212, 255, 0.08) 0%, transparent 70%);
          filter: blur(60px);
        }

        .identity-header {
          text-align: center;
          margin-bottom: 48px;
          position: relative;
        }

        .identity-badge {
          display: inline-block;
          padding: 8px 16px;
          background: rgba(0, 212, 255, 0.1);
          border: 1px solid rgba(0, 212, 255, 0.2);
          border-radius: 100px;
          color: var(--color-cyan);
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 1.5px;
          margin-bottom: 20px;
        }

        .identity-title {
          font-family: var(--font-display);
          font-size: 48px;
          font-weight: 700;
          color: var(--color-text);
          margin: 0 0 12px;
        }

        .identity-subtitle {
          font-size: 18px;
          color: var(--color-text-secondary);
          margin: 0;
        }

        .identity-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          position: relative;
        }

        .identity-card {
          position: relative;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 20px;
          padding: 32px;
          transition: all 0.3s ease;
          overflow: hidden;
        }

        .identity-card .card-glow {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 200px;
          height: 200px;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .identity-card.cyan .card-glow {
          background: var(--color-cyan);
        }

        .identity-card.green .card-glow {
          background: var(--color-green);
        }

        .identity-card.amber .card-glow {
          background: var(--color-amber);
        }

        .identity-card:hover,
        .identity-card.hovered {
          transform: translateY(-8px);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .identity-card:hover .card-glow,
        .identity-card.hovered .card-glow {
          opacity: 0.15;
        }

        .identity-card.cyan:hover,
        .identity-card.cyan.hovered {
          border-color: rgba(0, 212, 255, 0.3);
        }

        .identity-card.green:hover,
        .identity-card.green.hovered {
          border-color: rgba(0, 255, 136, 0.3);
        }

        .identity-card.amber:hover,
        .identity-card.amber.hovered {
          border-color: rgba(255, 184, 0, 0.3);
        }

        .identity-card .card-content {
          position: relative;
          z-index: 1;
        }

        .identity-card .card-icon-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .identity-card .card-icon {
          font-size: 32px;
        }

        .identity-card .card-subtitle {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-text-tertiary);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .identity-card .card-title {
          font-family: var(--font-display);
          font-size: 24px;
          font-weight: 700;
          color: var(--color-text);
          margin: 0 0 12px;
        }

        .identity-card .card-description {
          font-size: 15px;
          line-height: 1.6;
          color: var(--color-text-secondary);
          margin: 0 0 24px;
        }

        .identity-card .card-stats {
          list-style: none;
          padding: 0;
          margin: 0 0 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .identity-card .stat-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          color: var(--color-text-secondary);
        }

        .identity-card .stat-check {
          font-size: 14px;
          font-weight: 700;
        }

        .identity-card .stat-check.cyan {
          color: var(--color-cyan);
        }

        .identity-card .stat-check.green {
          color: var(--color-green);
        }

        .identity-card .stat-check.amber {
          color: var(--color-amber);
        }

        .identity-card .card-cta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 14px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          color: var(--color-text);
          font-family: var(--font-display);
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .identity-card .card-cta.cyan:hover {
          background: var(--color-cyan);
          border-color: var(--color-cyan);
          color: var(--color-bg);
        }

        .identity-card .card-cta.green:hover {
          background: var(--color-green);
          border-color: var(--color-green);
          color: var(--color-bg);
        }

        .identity-card .card-cta.amber:hover {
          background: var(--color-amber);
          border-color: var(--color-amber);
          color: var(--color-bg);
        }

        .identity-card .card-cta .cta-arrow {
          transition: transform 0.2s ease;
        }

        .identity-card .card-cta:hover .cta-arrow {
          transform: translateX(4px);
        }

        .identity-footer {
          text-align: center;
          margin-top: 40px;
          font-size: 16px;
          color: var(--color-text);
        }

        .identity-footer .text-dim {
          color: var(--color-text-tertiary);
        }

        /* ═══════════════════════════════════════════════════════════════════════
           FINAL CTA - The Close
           ═══════════════════════════════════════════════════════════════════════ */

        .final-cta-section {
          position: relative;
          padding: 80px 24px;
          text-align: center;
          overflow: hidden;
        }

        .final-cta-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .final-glow-left {
          position: absolute;
          left: 10%;
          top: 50%;
          transform: translateY(-50%);
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(0, 255, 136, 0.15) 0%, transparent 70%);
          filter: blur(80px);
        }

        .final-glow-right {
          position: absolute;
          right: 10%;
          top: 50%;
          transform: translateY(-50%);
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(220, 31, 255, 0.15) 0%, transparent 70%);
          filter: blur(80px);
        }

        .final-cta-content {
          position: relative;
          max-width: 600px;
          margin: 0 auto;
        }

        .final-cta-title {
          font-family: var(--font-display);
          font-size: 48px;
          font-weight: 700;
          color: var(--color-text);
          margin: 0 0 40px;
          line-height: 1.2;
        }

        .final-cta-buttons {
          display: flex;
          justify-content: center;
          gap: 16px;
          margin-bottom: 24px;
        }

        .final-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 16px 32px;
          border-radius: 12px;
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
        }

        .final-btn.primary {
          background: var(--color-green);
          border: none;
          color: var(--color-bg);
        }

        .final-btn.primary:hover {
          background: #00E67A;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 255, 136, 0.3);
        }

        .final-btn.secondary {
          background: transparent;
          border: 2px solid var(--color-border);
          color: var(--color-text);
        }

        .final-btn.secondary:hover {
          border-color: var(--color-text-secondary);
          background: rgba(255, 255, 255, 0.05);
        }

        .final-cta-trust {
          font-size: 14px;
          color: var(--color-text-tertiary);
          margin: 0;
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

          /* New components - tablet */
          .trust-strip {
            gap: 32px;
          }

          .trust-value {
            font-size: 24px;
          }

          .identity-cards {
            grid-template-columns: repeat(2, 1fr);
          }

          .identity-card:last-child {
            grid-column: span 2;
            max-width: 400px;
            margin: 0 auto;
          }

          .identity-title {
            font-size: 38px;
          }

          .lb-stats {
            gap: 20px;
          }

          .lb-stat {
            align-items: center;
          }

          .final-cta-title {
            font-size: 38px;
          }

          .leaderboard-title {
            font-size: 36px;
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

          /* Terminal responsive - 1024px */
          .terminal-body {
            grid-template-columns: 1fr;
          }

          .terminal-agents,
          .terminal-signals {
            display: none;
          }

          /* Protocol responsive - 1024px */
          .protocol-visual {
            grid-template-columns: 1fr;
            gap: 40px;
          }

          .data-flow {
            display: none;
          }

          .protocol-center {
            order: -1;
          }

          .protocol-title .title-main {
            font-size: 42px;
          }

          .protocol-callout .callout-content {
            flex-direction: column;
            text-align: center;
            gap: 20px;
          }

          .callout-stats {
            justify-content: center;
          }
        }

        @media (max-width: 768px) {
          .hero {
            padding: 80px 16px 40px;
          }

          /* Hero Split - Stack on mobile */
          .hero-split {
            grid-template-columns: 1fr;
            gap: 40px;
            text-align: center;
          }

          .hero-left {
            text-align: center;
          }

          .hero-cta-row {
            flex-direction: column;
            gap: 12px;
          }

          .cta-button {
            width: 100%;
          }

          .hero-mini-stats {
            justify-content: center;
          }

          .demo-card {
            max-width: 300px;
            margin: 0 auto;
          }

          .headline-pre {
            font-size: 16px;
          }

          .headline-main {
            font-size: 48px;
            letter-spacing: -2px;
          }

          .hero-sub {
            font-size: 16px;
          }

          /* Markets - Single column on mobile */
          .markets-grid {
            grid-template-columns: 1fr;
          }

          /* How It Works - Stack on mobile */
          .how-steps {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .step-arrow {
            display: none;
          }

          .how-title {
            font-size: 28px;
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
            display: none;
          }

          /* New components - mobile 768px */
          .live-ticker {
            margin-top: 40px;
          }

          .ticker-content {
            gap: 32px;
            animation-duration: 30s;
          }

          .ticker-item {
            font-size: 12px;
          }

          .trust-strip {
            flex-wrap: wrap;
            gap: 24px;
            padding: 24px 16px;
          }

          .trust-value {
            font-size: 22px;
          }

          .trust-label {
            font-size: 11px;
          }

          .market-filters {
            gap: 8px;
            margin-bottom: 24px;
          }

          .filter-pill {
            padding: 8px 14px;
            font-size: 13px;
          }

          .leaderboard-section {
            margin: 60px auto;
            padding: 0 16px;
          }

          .leaderboard-title {
            font-size: 32px;
          }

          .leaderboard-row {
            flex-wrap: wrap;
            gap: 12px;
            padding: 16px;
          }

          .lb-name {
            width: 100%;
            margin-left: 0;
            order: 1;
            font-size: 14px;
          }

          .lb-rank {
            font-size: 20px;
            width: auto;
          }

          .lb-stats {
            order: 2;
            width: 100%;
            justify-content: space-between;
            gap: 16px;
          }

          .lb-stat {
            align-items: center;
            flex: 1;
          }

          .identity-section {
            padding: 60px 16px;
            margin: 60px auto;
          }

          .identity-title {
            font-size: 32px;
          }

          .identity-subtitle {
            font-size: 16px;
          }

          .identity-cards {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .identity-card:last-child {
            grid-column: span 1;
            max-width: none;
          }

          .identity-card {
            padding: 24px;
          }

          .identity-card .card-title {
            font-size: 22px;
          }

          .identity-card .card-description {
            font-size: 14px;
          }

          .identity-footer {
            font-size: 14px;
          }

          .final-cta-section {
            padding: 60px 16px;
          }

          .final-cta-title {
            font-size: 28px;
          }

          .final-cta-buttons {
            flex-direction: column;
            gap: 12px;
          }

          .final-btn {
            width: 100%;
            justify-content: center;
            padding: 16px 24px;
          }

          .footer-links {
            flex-direction: column;
            gap: 32px;
          }

          .ai-section {
            padding: 60px 16px;
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

          /* Terminal responsive - 768px */
          .terminal-section {
            padding: 60px 16px;
          }

          .terminal-mockup {
            border-radius: 12px;
          }

          .terminal-window {
            border-radius: 12px;
          }

          .terminal-center {
            padding: 16px;
          }

          .command-hints {
            flex-direction: column;
            gap: 6px;
          }

          .cta-buttons {
            flex-direction: column;
            gap: 10px;
          }

          .terminal-btn {
            justify-content: center;
          }

          /* Protocol responsive - 768px */
          .protocol-section {
            padding: 60px 16px;
          }

          .protocol-title .title-line {
            font-size: 14px;
          }

          .protocol-title .title-main {
            font-size: 32px;
            letter-spacing: -1px;
          }

          .protocol-subtitle {
            font-size: 15px;
          }

          .side-inner {
            padding: 24px;
          }

          .side-title {
            font-size: 20px;
          }

          .side-icon-wrapper {
            width: 40px;
            height: 40px;
          }

          .side-icon {
            font-size: 22px;
          }

          .metric-icon-wrap {
            width: 32px;
            height: 32px;
          }

          .metric-icon-wrap svg {
            width: 16px;
            height: 16px;
          }

          .metric-value {
            font-size: 16px;
          }

          .protocol-core {
            width: 140px;
            height: 140px;
          }

          .core-content {
            width: 80px;
            height: 80px;
          }

          .core-icon {
            font-size: 24px;
          }

          .core-label {
            font-size: 10px;
          }

          .protocol-features {
            flex-direction: column;
            align-items: center;
          }

          .protocol-callout .callout-content {
            flex-direction: column;
            text-align: center;
            gap: 16px;
            padding: 24px;
          }

          .callout-icon-wrap {
            width: 48px;
            height: 48px;
          }

          .callout-headline {
            font-size: 18px;
          }

          .callout-stats {
            width: 100%;
            justify-content: center;
          }
        }

        @media (max-width: 480px) {
          .hero {
            padding: 70px 12px 50px;
          }

          .headline-pre {
            font-size: 14px;
          }

          .headline-main {
            font-size: 32px;
            letter-spacing: -1px;
          }

          .hero-sub {
            font-size: 15px;
          }

          .hero-mini-stats {
            gap: 8px;
          }

          .mini-stat {
            gap: 4px;
          }

          .stat-value {
            font-size: 14px;
          }

          .stat-label {
            font-size: 10px;
          }

          /* Demo card - 480px */
          .demo-card {
            max-width: 100%;
            padding: 20px;
          }

          .demo-step-content.question {
            font-size: 16px;
          }

          .demo-position-btns {
            gap: 8px;
          }

          .demo-btn {
            padding: 10px 14px;
          }

          .demo-payout {
            font-size: 28px;
          }

          /* Section titles - 480px */
          .section-title {
            font-size: 22px;
          }

          /* Market card - 480px */
          .market-card {
            padding: 16px;
          }

          .card-market {
            font-size: 14px;
          }

          .card-trade-btns {
            gap: 6px;
          }

          .trade-btn {
            padding: 8px;
          }

          .trade-price {
            font-size: 14px;
          }

          /* Trust strip - 480px */
          .trust-strip {
            gap: 16px;
            padding: 20px 12px;
          }

          .trust-value {
            font-size: 18px;
          }

          .trust-label {
            font-size: 10px;
          }

          /* How it works - 480px */
          .how-section {
            padding: 40px 16px;
          }

          .how-title {
            font-size: 24px;
          }

          .step-title {
            font-size: 16px;
          }

          .step-desc {
            font-size: 13px;
          }

          .step-card {
            padding: 24px 20px;
          }

          /* Leaderboard - 480px */
          .leaderboard-title {
            font-size: 26px;
          }

          .leaderboard-subtitle {
            font-size: 14px;
          }

          .leaderboard-row {
            padding: 14px;
          }

          .lb-stat-value {
            font-size: 14px;
          }

          /* Identity section - 480px */
          .identity-title {
            font-size: 26px;
          }

          .identity-subtitle {
            font-size: 14px;
          }

          .identity-card {
            padding: 20px;
          }

          .identity-card .card-title {
            font-size: 18px;
          }

          /* Final CTA - 480px */
          .final-cta-title {
            font-size: 26px;
          }

          .final-btn {
            padding: 14px 20px;
            font-size: 15px;
          }

          /* Terminal - 480px */
          .terminal-title {
            font-size: 26px;
          }

          .terminal-center {
            padding: 12px;
          }

          .terminal-line {
            font-size: 12px;
          }

          /* Ticker - 480px */
          .ticker-item {
            font-size: 11px;
          }

          .ticker-content {
            gap: 24px;
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
