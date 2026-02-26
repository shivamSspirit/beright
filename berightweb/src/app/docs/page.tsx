'use client';

import Link from 'next/link';
import { useState } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// BERIGHT DOCUMENTATION - Product Overview, Vision, Roadmap
// ═══════════════════════════════════════════════════════════════════════════════

const CURRENT_PHASE = 1;

// Navigation sections for prev/next
const NAV_SECTIONS = [
  { id: 'overview', label: 'What is BeRight?' },
  { id: 'vision', label: 'Vision' },
  { id: 'current', label: 'Current State' },
  { id: 'features', label: 'Features' },
  { id: 'platforms', label: 'Supported Platforms' },
  { id: 'telegram', label: 'Telegram Bot' },
  { id: 'roadmap', label: 'Product Roadmap' },
];

const ROADMAP_PHASES = [
  {
    phase: 1,
    title: 'Foundation',
    status: 'current',
    items: [
      { label: 'Telegram Bot Launch', done: false, soon: true },
      { label: 'Market Aggregation (5 platforms)', done: true },
      { label: 'AI Intent Classification', done: true },
      { label: 'Arbitrage Detection', done: true },
      { label: 'Landing Page Launch', done: true },
    ],
  },
  {
    phase: 2,
    title: 'Intelligence Layer',
    status: 'next',
    items: [
      { label: 'AI-Powered Market Analysis', done: false },
      { label: 'Smart Money / Whale Tracking', done: false },
      { label: 'Real-time Signal Alerts', done: false },
      { label: 'Forecaster Profiles & Scoring', done: false },
      { label: 'Web App Beta', done: false },
    ],
  },
  {
    phase: 3,
    title: 'DeFi Integration',
    status: 'future',
    items: [
      { label: 'Solana Smart Contracts', done: false },
      { label: 'Prediction Vaults (Auto-strategies)', done: false },
      { label: 'Forecaster Vaults', done: false },
      { label: 'Cross-platform Trading', done: false },
      { label: 'Liquidity Aggregation', done: false },
    ],
  },
  {
    phase: 4,
    title: 'Mobile App',
    status: 'future',
    items: [
      { label: 'iOS & Android Native Apps', done: false },
      { label: 'Solana dApp Store Launch', done: false },
      { label: 'Push Notifications', done: false },
      { label: 'Biometric Authentication', done: false },
    ],
  },
  {
    phase: 5,
    title: 'Protocol',
    status: 'future',
    items: [
      { label: 'Decentralized Resolution Oracle', done: false },
      { label: 'BeRight Token & Governance', done: false },
      { label: 'Forecaster Reputation System', done: false },
      { label: 'API Marketplace', done: false },
      { label: 'Institutional Features', done: false },
    ],
  },
  {
    phase: 6,
    title: 'Flex Integration',
    status: 'future',
    items: [
      { label: 'BeRight as Prediction Primitive', done: false },
      { label: 'Flex Social Platform Integration', done: false },
      { label: 'Multi-Private Group Markets', done: false },
      { label: 'Social Betting Features', done: false },
    ],
  },
];

const PLATFORMS = [
  { name: 'Polymarket', type: 'Crypto', chain: 'Polygon', status: 'live' },
  { name: 'Kalshi', type: 'Regulated', chain: 'USD', status: 'live' },
  { name: 'Manifold', type: 'Play Money', chain: 'Off-chain', status: 'live' },
  { name: 'Metaculus', type: 'Forecasting', chain: 'Off-chain', status: 'live' },
  { name: 'Limitless', type: 'Crypto', chain: 'Base', status: 'live' },
];

// Access Gateways
const GATEWAYS = [
  {
    id: 'terminal',
    title: 'Web Terminal',
    status: 'Soon',
    statusType: 'launching',
    description: 'Full-featured web interface with real-time data, charts, and advanced trading tools.',
    features: ['Real-time market data', 'Portfolio tracking', 'Advanced charting', 'Multi-platform view'],
  },
  {
    id: 'telegram',
    title: 'Telegram Bot',
    status: 'Soon',
    statusType: 'launching',
    description: 'Trade and analyze markets directly from Telegram. No app download required.',
    features: ['Natural language queries', 'Instant alerts', 'Quick commands', 'Mobile-first'],
  },
  {
    id: 'mobile',
    title: 'Mobile App',
    status: 'Q2 2026',
    statusType: 'future',
    description: 'Native iOS and Android apps with push notifications and seamless trading.',
    features: ['Push notifications', 'Biometric auth', 'Offline support', 'Native performance'],
  },
];

// Core Features
const CORE_FEATURES = [
  {
    icon: '01',
    title: 'Swipe-to-Trade UI',
    tag: 'Signature Feature',
    description: 'Tinder-style interface for prediction markets. Swipe right to go YES, left for NO. Fast, intuitive, and addictive.',
    details: [
      'Instant position taking with swipe gestures',
      'AI-generated market summaries on each card',
      'Fact-check badges showing verification status',
      'Quick stake selection before confirming',
    ],
  },
  {
    icon: '02',
    title: 'AI Fact-Checking',
    tag: 'Intelligence',
    description: 'Every market is analyzed by AI to verify claims, check sources, and highlight potential misinformation.',
    details: [
      'Automatic source verification',
      'Claim analysis against known facts',
      'Confidence scores for market accuracy',
      'Red flags for misleading markets',
    ],
  },
  {
    icon: '03',
    title: 'Multi-Platform Aggregation',
    tag: 'Data',
    description: 'See odds from Polymarket, Kalshi, Manifold, Metaculus, and Limitless in one unified view.',
    details: [
      'Real-time price synchronization',
      'Cross-platform comparison',
      'Unified search across all markets',
      'Best price routing',
    ],
  },
  {
    icon: '04',
    title: 'Arbitrage Detection',
    tag: 'Alpha',
    description: 'Automated scanning for price discrepancies. Get alerts when profitable spreads appear across platforms.',
    details: [
      'Real-time opportunity scanning',
      'Profit calculation with fees included',
      'One-click execution (coming soon)',
      'Historical arb tracking',
    ],
  },
  {
    icon: '05',
    title: '11 Intelligence Signals',
    tag: 'Signals',
    description: 'Comprehensive signal layer including arbitrage, momentum, whale activity, sentiment, and more.',
    details: [
      'Whale movement tracking',
      'Momentum and trend signals',
      'Sentiment analysis',
      'Volume spike detection',
    ],
  },
  {
    icon: '06',
    title: 'Smart Trading Strategies',
    tag: 'Strategy',
    description: 'Next-level trading tools powered by quantitative analysis and market intelligence.',
    details: [
      'Position sizing recommendations',
      'Risk-adjusted returns analysis',
      'Portfolio correlation warnings',
      'Entry/exit timing signals',
    ],
  },
];

// Coming Soon Features
const COMING_FEATURES = [
  { title: 'Mobile App', description: 'Native iOS and Android apps', timeline: 'Q2 2026' },
  { title: 'Auto-Trading Vaults', description: 'Set strategies, let AI execute', timeline: 'Q2 2026' },
  { title: 'Cross-Platform Execution', description: 'Trade on multiple platforms from one interface', timeline: 'Q3 2026' },
  { title: 'Social Features', description: 'Follow top forecasters, copy trades', timeline: 'Q3 2026' },
  { title: 'API Access', description: 'Build your own tools on BeRight data', timeline: 'Q3 2026' },
];

const BOT_COMMANDS = [
  { cmd: '/hot', desc: 'Trending markets with high activity' },
  { cmd: '/arb', desc: 'Current arbitrage opportunities' },
  { cmd: '/research <topic>', desc: 'Deep analysis on any topic' },
  { cmd: '/whale', desc: 'Smart money movements' },
  { cmd: '/odds <market>', desc: 'Current odds across platforms' },
  { cmd: '/subscribe', desc: 'Get real-time alerts' },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Get prev/next sections for navigation
  const currentIndex = NAV_SECTIONS.findIndex(s => s.id === activeSection);
  const prevSection = currentIndex > 0 ? NAV_SECTIONS[currentIndex - 1] : null;
  const nextSection = currentIndex < NAV_SECTIONS.length - 1 ? NAV_SECTIONS[currentIndex + 1] : null;

  const handleNavClick = (sectionId: string) => {
    setActiveSection(sectionId);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="docs-page">
      {/* Mobile Header */}
      <header className="mobile-header">
        <Link href="/" className="mobile-logo">
          <span className="logo-icon">◉</span>
          <span className="logo-text">BeRight</span>
        </Link>
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          )}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar Navigation */}
      <aside className={`docs-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <Link href="/" className="sidebar-logo">
          <span className="logo-icon">◉</span>
          <span className="logo-text">BeRight</span>
        </Link>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <span className="nav-label">Getting Started</span>
            <button
              className={`nav-item ${activeSection === 'overview' ? 'active' : ''}`}
              onClick={() => handleNavClick('overview')}
            >
              What is BeRight?
            </button>
            <button
              className={`nav-item ${activeSection === 'vision' ? 'active' : ''}`}
              onClick={() => handleNavClick('vision')}
            >
              Vision
            </button>
            <button
              className={`nav-item ${activeSection === 'current' ? 'active' : ''}`}
              onClick={() => handleNavClick('current')}
            >
              Current State
            </button>
          </div>

          <div className="nav-section">
            <span className="nav-label">Product</span>
            <button
              className={`nav-item ${activeSection === 'features' ? 'active' : ''}`}
              onClick={() => handleNavClick('features')}
            >
              Features
            </button>
            <button
              className={`nav-item ${activeSection === 'platforms' ? 'active' : ''}`}
              onClick={() => handleNavClick('platforms')}
            >
              Supported Platforms
            </button>
            <button
              className={`nav-item ${activeSection === 'telegram' ? 'active' : ''}`}
              onClick={() => handleNavClick('telegram')}
            >
              Telegram Bot
            </button>
          </div>

          <div className="nav-section">
            <span className="nav-label">Roadmap</span>
            <button
              className={`nav-item ${activeSection === 'roadmap' ? 'active' : ''}`}
              onClick={() => handleNavClick('roadmap')}
            >
              Product Roadmap
            </button>
          </div>

          <div className="nav-section">
            <span className="nav-label">Resources</span>
            <Link href="/docs/faq" className="nav-item">FAQ</Link>
          </div>
        </nav>

        <div className="sidebar-cta">
          <a href="https://t.me/berightai" target="_blank" rel="noopener noreferrer" className="cta-btn">
            Try Telegram Bot →
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="docs-main">
        {/* Overview Section */}
        {activeSection === 'overview' && (
          <section className="content-section">
            <div className="section-header">
              <span className="section-badge">Overview</span>
              <h1>What is BeRight?</h1>
              <p className="section-subtitle gradient-text">
                The Bloomberg Terminal for prediction markets
              </p>
            </div>

            <div className="content-block highlight-box">
              <span className="callout-label">What We Do</span>
              <p className="highlight-text">
                <strong>BeRight</strong> is a middle layer that connects forecasters to capital.
                We're building a prediction market ecosystem aggregator with automated tools
                that make betting easier and more profitable.
              </p>
            </div>

            <div className="section-divider" />

            <h2><span className="h2-accent" />The Problem</h2>
            <p>
              Prediction markets have massive potential, but critical gaps hold them back:
            </p>
            <div className="problem-card">
              <ul className="problem-list">
                <li><strong>Forecasters need capital</strong> — Skilled predictors can't monetize their knowledge without risking their own money</li>
                <li><strong>No automation</strong> — Finding arbitrage, hot markets, and trending opportunities across platforms requires constant manual monitoring</li>
                <li><strong>Fragmented ecosystem</strong> — Data is scattered across Polymarket, Kalshi, Manifold, and others with no unified view</li>
                <li><strong>Slow execution</strong> — By the time you spot an opportunity and execute, the edge is often gone</li>
                <li><strong>No agentic tools</strong> — Markets need automated systems that can act on your behalf when conditions are right</li>
              </ul>
            </div>

            <h2><span className="h2-accent" />The Solution</h2>
            <p>
              BeRight is building the infrastructure layer for prediction markets:
            </p>
            <div className="solution-grid">
              <div className="solution-card">
                <h3>Forecaster Economy</h3>
                <p>We connect forecasters to capitalists. Build your track record, prove your edge, and monetize your knowledge without risking your own capital.</p>
              </div>
              <div className="solution-card">
                <h3>Agentic Automation</h3>
                <p>Using OpenClaw tech, we automate complex operations — arbitrage detection, hot market scanning, whale tracking — and deliver them simply via Terminal and Telegram.</p>
              </div>
              <div className="solution-card">
                <h3>Unified Gateway</h3>
                <p>One interface to all prediction markets. We're integrating every gateway — Telegram, Terminal, API — into a seamless experience for power users.</p>
              </div>
            </div>

            <h2><span className="h2-accent" />Who is it for?</h2>
            <div className="persona-grid">
              <div className="persona-card">
                <h3>Forecasters</h3>
                <p>Build your reputation, prove your accuracy with Brier scores, and attract capital to back your predictions.</p>
              </div>
              <div className="persona-card">
                <h3>Capital Providers</h3>
                <p>Find skilled forecasters with verified track records. Deploy capital to proven predictors and share in their success.</p>
              </div>
              <div className="persona-card">
                <h3>Active Traders</h3>
                <p>Get instant alerts on arbitrage, momentum, and whale movements. Execute faster with automated tools.</p>
              </div>
              <div className="persona-card">
                <h3>Developers</h3>
                <p>Access aggregated data, market intelligence, and prediction signals via our API. Build on top of BeRight.</p>
              </div>
            </div>
          </section>
        )}

        {/* Vision Section */}
        {activeSection === 'vision' && (
          <section className="content-section">
            <div className="section-header">
              <span className="section-badge">Vision</span>
              <h1>Our Vision</h1>
              <p className="section-subtitle gradient-text">
                Be the Bloomberg for prediction markets
              </p>
            </div>

            <div className="vision-statement">
              <blockquote>
                We're building a middle layer that connects forecasters to capital —
                creating an ecosystem where skilled predictors can monetize their knowledge
                and capital providers can access verified forecasting talent.
              </blockquote>
            </div>

            <h2><span className="h2-accent" />What We're Building</h2>
            <div className="vision-pillars">
              <div className="pillar-card">
                <div className="pillar-number">01</div>
                <div className="pillar-content">
                  <h3>Prediction Market Intelligence Layer</h3>
                  <p>
                    A comprehensive intelligence layer powered by 11 distinct signals — arbitrage, momentum,
                    whale activity, sentiment, and more — giving you an edge no single platform can provide.
                  </p>
                </div>
              </div>
              <div className="pillar-card">
                <div className="pillar-number">02</div>
                <div className="pillar-content">
                  <h3>Prediction Market Aggregator</h3>
                  <p>
                    A unified ecosystem that aggregates every prediction market platform into one interface.
                    Real-time data, cross-platform comparison, and comprehensive market intelligence.
                  </p>
                </div>
              </div>
              <div className="pillar-card">
                <div className="pillar-number">03</div>
                <div className="pillar-content">
                  <h3>Forecaster-Capital Bridge</h3>
                  <p>
                    A middle layer connecting forecasters to capitalists. Skilled predictors can build track records
                    and attract capital. Investors can back proven forecasters without managing trades themselves.
                  </p>
                </div>
              </div>
              <div className="pillar-card">
                <div className="pillar-number">04</div>
                <div className="pillar-content">
                  <h3>Automated Trading Tools</h3>
                  <p>
                    Tools that make betting easier in prediction markets. Automated arbitrage detection,
                    instant execution, and agentic systems that act when opportunities arise.
                  </p>
                </div>
              </div>
            </div>

            <h2><span className="h2-accent" />Why Now?</h2>
            <ul className="why-now-list">
              <li>
                <strong>Market Growth:</strong> Prediction markets are experiencing exponential growth.
                Polymarket alone has seen billions in volume.
              </li>
              <li>
                <strong>Regulatory Clarity:</strong> Kalshi's CFTC approval has opened the door for
                regulated prediction markets in the US.
              </li>
              <li>
                <strong>AI Capabilities:</strong> Modern LLMs and agentic systems can now automate
                complex trading operations that were previously manual.
              </li>
              <li>
                <strong>Creator Economy:</strong> Forecasters are the next wave of creators —
                they need infrastructure to monetize their knowledge.
              </li>
            </ul>
          </section>
        )}

        {/* Current State Section */}
        {activeSection === 'current' && (
          <section className="content-section">
            <div className="section-header">
              <span className="section-badge live">Live Now</span>
              <h1>Current State</h1>
              <p className="section-subtitle">
                Shipping fast for prediction market power users
              </p>
            </div>

            <div className="content-block highlight-box green">
              <h3>Phase 1: Foundation Complete</h3>
              <p>
                Our Telegram bot is live with basic commands. We're continuously shipping new features
                to serve prediction market power users who need instant access to market intelligence.
              </p>
            </div>

            <h2><span className="h2-accent" />What's Live Now</h2>
            <div className="live-features">
              <div className="live-feature">
                <span className="live-status">●</span>
                <div>
                  <h3>Telegram Bot (@berightbot)</h3>
                  <p>Full functionality via Telegram. Natural language queries, market data, and real-time alerts.</p>
                </div>
              </div>
              <div className="live-feature">
                <span className="live-status">●</span>
                <div>
                  <h3>5-Platform Aggregation</h3>
                  <p>Real-time data from Polymarket, Kalshi, Manifold, Metaculus, and Limitless.</p>
                </div>
              </div>
              <div className="live-feature">
                <span className="live-status">●</span>
                <div>
                  <h3>AI-Powered Understanding</h3>
                  <p>Ask anything in plain English. The bot understands your intent and delivers relevant data.</p>
                </div>
              </div>
              <div className="live-feature">
                <span className="live-status">●</span>
                <div>
                  <h3>Arbitrage Detection</h3>
                  <p>Automated scanning for price discrepancies across all supported platforms.</p>
                </div>
              </div>
              <div className="live-feature">
                <span className="live-status">●</span>
                <div>
                  <h3>Hot Markets & Trending</h3>
                  <p>Discover high-activity markets and momentum opportunities across the ecosystem.</p>
                </div>
              </div>
            </div>

            <h2><span className="h2-accent" />Coming Next</h2>
            <div className="coming-features">
              <div className="coming-feature">
                <span className="coming-status">○</span>
                <div>
                  <h3>Web Terminal</h3>
                  <p>Full web interface with charts, portfolio tracking, and advanced trading tools.</p>
                </div>
              </div>
              <div className="coming-feature">
                <span className="coming-status">○</span>
                <div>
                  <h3>Whale Tracking</h3>
                  <p>Follow smart money movements and get alerts on large trades in real-time.</p>
                </div>
              </div>
              <div className="coming-feature">
                <span className="coming-status">○</span>
                <div>
                  <h3>Forecaster Profiles</h3>
                  <p>Build your track record with verified Brier scores and attract capital backers.</p>
                </div>
              </div>
            </div>

            <h2>Try It Now</h2>
            <div className="try-cta">
              <p>The Telegram bot is live and free to use. Start exploring prediction markets today.</p>
              <a href="https://t.me/berightai" target="_blank" rel="noopener noreferrer" className="try-btn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                </svg>
                Open @berightbot on Telegram
              </a>
            </div>
          </section>
        )}

        {/* Features Section */}
        {activeSection === 'features' && (
          <section className="content-section">
            <div className="section-header">
              <span className="section-badge">Product</span>
              <h1>Features</h1>
              <p className="section-subtitle">
                The complete toolkit for prediction market success
              </p>
            </div>

            {/* Access Gateways */}
            <h2><span className="h2-accent" />Access Your Way</h2>
            <p className="section-intro">
              BeRight gives you multiple ways to access prediction markets. Choose the interface that fits your workflow.
            </p>
            <div className="gateways-grid">
              {GATEWAYS.map((gateway) => (
                <div key={gateway.id} className={`gateway-card ${gateway.statusType === 'future' ? 'coming-soon' : ''}`}>
                  <div className="gateway-header">
                    <h3>{gateway.title}</h3>
                    <span className={`gateway-status ${gateway.statusType}`}>
                      {gateway.status}
                    </span>
                  </div>
                  <p className="gateway-desc">{gateway.description}</p>
                  <ul className="gateway-features">
                    {gateway.features.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Core Features */}
            <h2><span className="h2-accent" />Core Features</h2>
            <div className="core-features-grid">
              {CORE_FEATURES.map((feature, i) => (
                <div key={i} className="core-feature-card">
                  <div className="feature-top">
                    <span className="feature-number">{feature.icon}</span>
                    <span className="feature-tag">{feature.tag}</span>
                  </div>
                  <h3>{feature.title}</h3>
                  <p className="feature-desc">{feature.description}</p>
                  <ul className="feature-details">
                    {feature.details.map((detail, j) => (
                      <li key={j}>{detail}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Swipe UI Highlight */}
            <div className="feature-highlight">
              <div className="highlight-content">
                <span className="highlight-badge">Signature Experience</span>
                <h2>Swipe-to-Trade</h2>
                <p>
                  We reimagined how you interact with prediction markets. Our Tinder-style interface
                  lets you browse markets naturally — swipe right for YES, left for NO. Each card shows
                  you everything you need: AI-generated summaries, fact-check status, current odds, and
                  quick stake options.
                </p>
                <div className="highlight-points">
                  <div className="point">
                    <span className="point-icon">→</span>
                    <span>Swipe Right = YES Position</span>
                  </div>
                  <div className="point">
                    <span className="point-icon">←</span>
                    <span>Swipe Left = NO Position</span>
                  </div>
                  <div className="point">
                    <span className="point-icon">↑</span>
                    <span>Swipe Up = Save for Later</span>
                  </div>
                </div>
              </div>
              <div className="highlight-visual">
                <div className="mock-card">
                  <div className="mock-badge">AI Verified</div>
                  <div className="mock-title">Will BTC hit $150K by Dec 2026?</div>
                  <div className="mock-odds">
                    <span className="yes">YES 42%</span>
                    <span className="no">NO 58%</span>
                  </div>
                  <div className="mock-swipe">← NO &nbsp;&nbsp; YES →</div>
                </div>
              </div>
            </div>

            {/* AI Fact-Checking */}
            <div className="feature-highlight alt">
              <div className="highlight-visual">
                <div className="fact-check-demo">
                  <div className="fc-header">AI Analysis</div>
                  <div className="fc-item verified">
                    <span className="fc-icon">✓</span>
                    <span>Source verified: Reuters, AP</span>
                  </div>
                  <div className="fc-item verified">
                    <span className="fc-icon">✓</span>
                    <span>Historical accuracy: 87%</span>
                  </div>
                  <div className="fc-item warning">
                    <span className="fc-icon">!</span>
                    <span>Market may resolve ambiguously</span>
                  </div>
                  <div className="fc-score">
                    <span>Confidence Score</span>
                    <span className="score">8.4/10</span>
                  </div>
                </div>
              </div>
              <div className="highlight-content">
                <span className="highlight-badge">Intelligence</span>
                <h2>AI Fact-Checking</h2>
                <p>
                  Not all markets are created equal. Our AI analyzes every market to verify claims,
                  check source reliability, and flag potential issues. You see a confidence score
                  and detailed breakdown before you trade.
                </p>
                <ul className="highlight-list">
                  <li>Automatic source verification against trusted outlets</li>
                  <li>Historical accuracy tracking for market creators</li>
                  <li>Red flags for ambiguous resolution criteria</li>
                  <li>Real-time updates as new information emerges</li>
                </ul>
              </div>
            </div>

            {/* Coming Soon */}
            <h2><span className="h2-accent" />Coming Soon</h2>
            <p className="section-intro">
              We are shipping continuously. Here is what is next on our roadmap.
            </p>
            <div className="coming-soon-grid">
              {COMING_FEATURES.map((feature, i) => (
                <div key={i} className="coming-card">
                  <div className="coming-header">
                    <h4>{feature.title}</h4>
                    <span className="coming-timeline">{feature.timeline}</span>
                  </div>
                  <p>{feature.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Platforms Section */}
        {activeSection === 'platforms' && (
          <section className="content-section">
            <div className="section-header">
              <span className="section-badge">Integration</span>
              <h1>Supported Platforms</h1>
              <p className="section-subtitle">
                All major prediction markets in one place
              </p>
            </div>

            <div className="platforms-table">
              <div className="table-header">
                <span>Platform</span>
                <span>Type</span>
                <span>Settlement</span>
                <span>Status</span>
              </div>
              {PLATFORMS.map((platform, i) => (
                <div key={i} className="table-row">
                  <span className="platform-name">{platform.name}</span>
                  <span className="platform-type">{platform.type}</span>
                  <span className="platform-chain">{platform.chain}</span>
                  <span className={`platform-status ${platform.status}`}>
                    {platform.status === 'live' ? '● Live' : '○ Coming'}
                  </span>
                </div>
              ))}
            </div>

            <h2>Platform Details</h2>
            <div className="platform-details">
              <div className="platform-card">
                <h3>Polymarket</h3>
                <p>The largest crypto prediction market. High liquidity, USDC settlement on Polygon.</p>
                <div className="platform-stats">
                  <span>💰 High Volume</span>
                  <span>⚡ Instant Settlement</span>
                  <span>🔗 Polygon</span>
                </div>
              </div>
              <div className="platform-card">
                <h3>Kalshi</h3>
                <p>CFTC-regulated US exchange. Legal for US users, USD settlement.</p>
                <div className="platform-stats">
                  <span>✅ Regulated</span>
                  <span>🇺🇸 US Legal</span>
                  <span>💵 USD</span>
                </div>
              </div>
              <div className="platform-card">
                <h3>Manifold</h3>
                <p>Play money markets with high engagement. Great for research and calibration.</p>
                <div className="platform-stats">
                  <span>🎮 Play Money</span>
                  <span>📈 High Activity</span>
                  <span>🔬 Research</span>
                </div>
              </div>
              <div className="platform-card">
                <h3>Metaculus</h3>
                <p>Forecasting platform focused on accuracy. Detailed scoring and analysis.</p>
                <div className="platform-stats">
                  <span>🎯 Accuracy Focus</span>
                  <span>📊 Calibration</span>
                  <span>🏆 Leaderboards</span>
                </div>
              </div>
              <div className="platform-card">
                <h3>Limitless</h3>
                <p>New platform on Base. Fast settlement, low fees, growing liquidity.</p>
                <div className="platform-stats">
                  <span>🆕 New</span>
                  <span>⚡ Fast</span>
                  <span>🔵 Base</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Telegram Section */}
        {activeSection === 'telegram' && (
          <section className="content-section">
            <div className="section-header">
              <span className="section-badge">Bot</span>
              <h1>Telegram Bot</h1>
              <p className="section-subtitle">
                Full BeRight functionality in your favorite messaging app
              </p>
            </div>

            <div className="content-block highlight-box">
              <p>
                <strong>@berightbot</strong> is the fastest way to access prediction market intelligence.
                Ask questions in natural language, get alerts, and analyze markets - all without leaving Telegram.
              </p>
            </div>

            <h2>Commands</h2>
            <div className="commands-list">
              {BOT_COMMANDS.map((cmd, i) => (
                <div key={i} className="command-row">
                  <code className="command-code">{cmd.cmd}</code>
                  <span className="command-desc">{cmd.desc}</span>
                </div>
              ))}
            </div>

            <h2>Natural Language</h2>
            <p>
              You don't need to memorize commands. Just ask questions in plain English:
            </p>
            <div className="nl-examples">
              <div className="nl-example">
                <span className="user-msg">"What are the odds on Trump winning?"</span>
                <span className="bot-response">Returns current odds across all platforms</span>
              </div>
              <div className="nl-example">
                <span className="user-msg">"Find me arbitrage opportunities"</span>
                <span className="bot-response">Lists current arb spreads with profit potential</span>
              </div>
              <div className="nl-example">
                <span className="user-msg">"Analyze the Fed rate cut market"</span>
                <span className="bot-response">Deep research with probability estimates</span>
              </div>
              <div className="nl-example">
                <span className="user-msg">"What's hot right now?"</span>
                <span className="bot-response">Trending markets with high activity</span>
              </div>
            </div>

            <h2>Get Started</h2>
            <div className="telegram-cta">
              <a href="https://t.me/berightai" target="_blank" rel="noopener noreferrer" className="telegram-btn">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                </svg>
                Open @berightbot
              </a>
              <p className="telegram-note">Free to use. No registration required.</p>
            </div>
          </section>
        )}

        {/* Roadmap Section */}
        {activeSection === 'roadmap' && (
          <section className="content-section">
            <div className="section-header">
              <span className="section-badge">Future</span>
              <h1>Product Roadmap</h1>
              <p className="section-subtitle">
                Our journey to becoming the Bloomberg Terminal of prediction markets
              </p>
            </div>

            <div className="roadmap-timeline">
              {ROADMAP_PHASES.map((phase, i) => (
                <div key={i} className={`roadmap-phase ${phase.status}`}>
                  <div className="phase-indicator">
                    <span className={`phase-dot ${phase.status}`}>
                      {phase.status === 'current' ? '●' : phase.status === 'next' ? '○' : '○'}
                    </span>
                    {i < ROADMAP_PHASES.length - 1 && <div className="phase-line" />}
                  </div>
                  <div className="phase-content">
                    <div className="phase-header">
                      <span className="phase-number">Phase {phase.phase}</span>
                      <h3 className="phase-title">{phase.title}</h3>
                      {phase.status === 'current' && <span className="status-badge current">In Progress</span>}
                      {phase.status === 'next' && <span className="status-badge next">Up Next</span>}
                    </div>
                    <ul className="phase-items">
                      {phase.items.map((item, j) => (
                        <li key={j} className={`${item.done ? 'done' : ''} ${item.soon ? 'soon' : ''}`}>
                          <span className="item-check">
                            {item.done ? '✓' : item.soon ? '◉' : '○'}
                          </span>
                          <span className="item-label">{item.label}</span>
                          {item.soon && <span className="soon-badge">Soon</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>

            <h2><span className="h2-accent" />Long-Term Vision</h2>
            <div className="vision-cards">
              <div className="vision-card">
                <h3>Universal Market Access</h3>
                <p>Trade any prediction market from any platform through a single unified interface.</p>
              </div>
              <div className="vision-card">
                <h3>Autonomous Trading</h3>
                <p>AI agents that execute trades on your behalf when conditions are optimal.</p>
              </div>
              <div className="vision-card">
                <h3>Prediction Vaults</h3>
                <p>Automated strategies that compound your forecasting edge with capital backing.</p>
              </div>
              <div className="vision-card">
                <h3>Forecaster Economy</h3>
                <p>Infrastructure where skilled predictors monetize their knowledge.</p>
              </div>
            </div>
          </section>
        )}

        {/* Prev/Next Navigation */}
        <nav className="page-nav">
          {prevSection ? (
            <button className="page-nav-btn prev" onClick={() => handleNavClick(prevSection.id)}>
              <span className="nav-direction">← Previous</span>
              <span className="nav-page-title">{prevSection.label}</span>
            </button>
          ) : (
            <div />
          )}
          {nextSection ? (
            <button className="page-nav-btn next" onClick={() => handleNavClick(nextSection.id)}>
              <span className="nav-direction">Next →</span>
              <span className="nav-page-title">{nextSection.label}</span>
            </button>
          ) : (
            <Link href="/docs/faq" className="page-nav-btn next">
              <span className="nav-direction">Next →</span>
              <span className="nav-page-title">FAQ</span>
            </Link>
          )}
        </nav>

        {/* Footer */}
        <footer className="docs-footer">
          <div className="footer-brand">
            <span className="logo-icon">◉</span>
            <span>BeRight</span>
          </div>
          <div className="footer-links">
            <a href="https://t.me/berightai" target="_blank" rel="noopener noreferrer">Telegram</a>
            <a href="https://x.com/AgentBEright" target="_blank" rel="noopener noreferrer">Twitter</a>
          </div>
          <p className="footer-copyright">© 2026 BeRight Protocol</p>
        </footer>
      </main>

      <style jsx>{`
        .docs-page {
          display: flex;
          min-height: 100vh;
          background: #0A0A0B;
          color: #fff;
          font-family: 'Satoshi', system-ui, sans-serif;
        }

        /* Mobile Header */
        .mobile-header {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 64px;
          background: rgba(10, 10, 11, 0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          padding: 0 20px;
          align-items: center;
          justify-content: space-between;
          z-index: 100;
        }

        .mobile-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }

        .mobile-menu-btn {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #fff;
          cursor: pointer;
        }

        .mobile-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          z-index: 90;
        }

        /* Sidebar */
        .docs-sidebar {
          width: 280px;
          background: #0D0D0F;
          border-right: 1px solid rgba(255, 255, 255, 0.06);
          padding: 24px;
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          margin-bottom: 32px;
        }

        .logo-icon {
          font-size: 24px;
          color: #00FF88;
        }

        .logo-text {
          font-size: 20px;
          font-weight: 800;
          color: #fff;
          padding-left: 4px;
        }

        .sidebar-nav {
          flex: 1;
        }

        .nav-section {
          margin-bottom: 24px;
        }

        .nav-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: rgba(255, 255, 255, 0.4);
          margin-bottom: 12px;
          padding-left: 12px;
        }

        .nav-item {
          display: block;
          width: 100%;
          padding: 10px 12px;
          background: none;
          border: none;
          border-left: 3px solid transparent;
          border-radius: 0 8px 8px 0;
          color: rgba(255, 255, 255, 0.6);
          font-size: 14px;
          font-family: inherit;
          text-align: left;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .nav-item:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.05);
          border-left-color: rgba(255, 255, 255, 0.2);
        }

        .nav-item.active {
          color: #00FF88;
          background: rgba(0, 255, 136, 0.1);
          border-left-color: #00FF88;
          font-weight: 600;
        }

        .sidebar-cta {
          margin-top: auto;
          padding-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .cta-btn {
          display: block;
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, rgba(0, 255, 136, 0.15), rgba(0, 212, 255, 0.1));
          border: 1px solid rgba(0, 255, 136, 0.2);
          border-radius: 8px;
          color: #00FF88;
          font-size: 14px;
          font-weight: 600;
          text-align: center;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .cta-btn:hover {
          background: rgba(0, 255, 136, 0.2);
        }

        /* Main Content */
        .docs-main {
          flex: 1;
          margin-left: 280px;
          padding: 48px 64px;
          max-width: 900px;
        }

        .content-section {
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .section-header {
          margin-bottom: 40px;
        }

        .section-badge {
          display: inline-block;
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 100px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 16px;
        }

        .section-badge.live {
          background: rgba(0, 255, 136, 0.1);
          border-color: rgba(0, 255, 136, 0.2);
          color: #00FF88;
        }

        .section-header h1 {
          font-size: 42px;
          font-weight: 800;
          margin: 0 0 12px;
          letter-spacing: -1px;
        }

        .section-subtitle {
          font-size: 18px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0;
        }

        .section-subtitle.gradient-text {
          font-size: 20px;
          font-weight: 600;
          background: linear-gradient(135deg, #00FF88, #00B0FF);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .section-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
          margin: 48px 0;
        }

        .callout-label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #00B0FF;
          margin-bottom: 12px;
        }

        h2 {
          font-size: 28px;
          font-weight: 800;
          margin: 48px 0 20px;
          letter-spacing: -0.5px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .h2-accent {
          width: 4px;
          height: 28px;
          background: linear-gradient(180deg, #00FF88, #00B0FF);
          border-radius: 2px;
        }

        h3 {
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 8px;
        }

        p {
          font-size: 16px;
          line-height: 1.7;
          color: rgba(255, 255, 255, 0.75);
          margin: 0 0 16px;
        }

        /* Content Blocks */
        .content-block {
          padding: 24px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          margin-bottom: 32px;
        }

        .highlight-box {
          border-left: 3px solid #00B0FF;
        }

        .highlight-box.green {
          border-left-color: #00FF88;
          background: rgba(0, 255, 136, 0.05);
        }

        .highlight-text {
          font-size: 17px;
          margin: 0;
        }

        /* Problem Card */
        .problem-card {
          padding: 24px;
          background: rgba(255, 71, 87, 0.05);
          border: 1px solid rgba(255, 71, 87, 0.15);
          border-radius: 16px;
          margin-bottom: 32px;
        }

        /* Problem List */
        .problem-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .problem-list li {
          padding: 12px 0 12px 32px;
          border-bottom: 1px solid rgba(255, 71, 87, 0.1);
          color: rgba(255, 255, 255, 0.7);
          position: relative;
        }

        .problem-list li:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .problem-list li::before {
          content: '✗';
          position: absolute;
          left: 0;
          color: #FF4757;
        }

        /* Solution Grid */
        .solution-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin: 24px 0;
        }

        .solution-card {
          padding: 24px;
          background: rgba(0, 255, 136, 0.05);
          border: 1px solid rgba(0, 255, 136, 0.15);
          border-radius: 16px;
        }

        .solution-icon {
          font-size: 32px;
          display: block;
          margin-bottom: 16px;
        }

        .solution-card h3 {
          color: #00FF88;
        }

        .solution-card p {
          font-size: 14px;
          margin: 0;
        }

        /* Persona Grid */
        .persona-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .persona-card {
          padding: 20px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
        }

        .persona-icon {
          font-size: 28px;
          display: block;
          margin-bottom: 12px;
        }

        .persona-card p {
          font-size: 14px;
          margin: 0;
        }

        /* Vision */
        .vision-statement blockquote {
          font-size: 22px;
          font-style: italic;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.9);
          border-left: 3px solid #00FF88;
          padding-left: 24px;
          margin: 32px 0;
        }

        .vision-pillars {
          display: grid;
          gap: 20px;
        }

        .pillar-card {
          padding: 28px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          display: grid;
          grid-template-columns: 60px 1fr;
          gap: 20px;
        }

        .pillar-number {
          font-size: 32px;
          font-weight: 800;
          color: #00FF88;
          opacity: 0.5;
        }

        .pillar-content h3 {
          margin-bottom: 8px;
        }

        .pillar-content p {
          margin: 0;
          font-size: 15px;
        }

        .why-now-list {
          list-style: none;
          padding: 0;
        }

        .why-now-list li {
          padding: 16px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .why-now-list strong {
          color: #00FF88;
        }

        /* Live Features */
        .live-features, .coming-features {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .live-feature, .coming-feature {
          display: flex;
          gap: 16px;
          padding: 20px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
        }

        .live-status {
          color: #00FF88;
          font-size: 12px;
        }

        .coming-status {
          color: rgba(255, 255, 255, 0.3);
          font-size: 12px;
        }

        .live-feature h3, .coming-feature h3 {
          margin-bottom: 4px;
        }

        .live-feature p, .coming-feature p {
          font-size: 14px;
          margin: 0;
        }

        /* Try CTA */
        .try-cta {
          margin-top: 40px;
          padding: 32px;
          background: linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(0, 212, 255, 0.05));
          border: 1px solid rgba(0, 255, 136, 0.2);
          border-radius: 16px;
          text-align: center;
        }

        .try-btn {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 16px 32px;
          background: linear-gradient(135deg, #00FF88, #00D4FF);
          border-radius: 12px;
          color: #000;
          font-size: 16px;
          font-weight: 700;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .try-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 255, 136, 0.3);
        }

        /* Features Grid */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }

        .feature-card {
          padding: 24px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
        }

        .feature-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          font-size: 14px;
          font-weight: 700;
          color: #00FF88;
          background: rgba(0, 255, 136, 0.1);
          border: 1px solid rgba(0, 255, 136, 0.2);
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .feature-card p {
          font-size: 14px;
          margin: 0;
        }

        /* Section Intro */
        .section-intro {
          color: rgba(255, 255, 255, 0.6);
          font-size: 15px;
          line-height: 1.6;
          margin-bottom: 24px;
          max-width: 600px;
        }

        /* Gateways Grid */
        .gateways-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 48px;
        }

        .gateway-card {
          padding: 24px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          transition: all 0.2s ease;
        }

        .gateway-card:hover {
          border-color: rgba(0, 255, 136, 0.3);
          transform: translateY(-2px);
        }

        .gateway-card.coming-soon {
          opacity: 0.6;
        }

        .gateway-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .gateway-header h3 {
          margin: 0;
          font-size: 18px;
        }

        .gateway-status {
          font-size: 10px;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .gateway-status.live {
          background: rgba(0, 255, 136, 0.15);
          color: #00FF88;
        }

        .gateway-status.launching {
          background: rgba(0, 255, 136, 0.12);
          color: #00FF88;
          border: 1px solid rgba(0, 255, 136, 0.3);
        }

        .gateway-status.future {
          background: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.5);
        }

        .gateway-desc {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 16px;
        }

        .gateway-features {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .gateway-features li {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          padding-left: 16px;
          position: relative;
        }

        .gateway-features li::before {
          content: '•';
          position: absolute;
          left: 0;
          color: #00FF88;
        }

        /* Core Features Grid */
        .core-features-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
          margin-bottom: 48px;
        }

        .core-feature-card {
          padding: 28px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          transition: all 0.2s ease;
        }

        .core-feature-card:hover {
          border-color: rgba(0, 255, 136, 0.2);
        }

        .feature-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .feature-number {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          font-size: 14px;
          font-weight: 700;
          color: #00FF88;
          background: rgba(0, 255, 136, 0.1);
          border: 1px solid rgba(0, 255, 136, 0.2);
          border-radius: 8px;
        }

        .feature-tag {
          font-size: 10px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: rgba(0, 176, 255, 0.15);
          color: #00B0FF;
        }

        .core-feature-card h3 {
          font-size: 18px;
          margin: 0 0 12px 0;
        }

        .feature-desc {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.5;
          margin-bottom: 16px;
        }

        .feature-details {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .feature-details li {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          padding-left: 20px;
          position: relative;
        }

        .feature-details li::before {
          content: '✓';
          position: absolute;
          left: 0;
          color: #00FF88;
          font-size: 12px;
        }

        /* Feature Highlight */
        .feature-highlight {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          padding: 40px;
          background: linear-gradient(135deg, rgba(0, 255, 136, 0.05) 0%, rgba(0, 176, 255, 0.05) 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          margin-bottom: 48px;
          align-items: center;
        }

        .feature-highlight.alt {
          background: linear-gradient(135deg, rgba(0, 176, 255, 0.05) 0%, rgba(138, 43, 226, 0.05) 100%);
        }

        .feature-highlight.alt .highlight-visual {
          order: -1;
        }

        .highlight-badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 600;
          padding: 6px 14px;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: rgba(0, 255, 136, 0.15);
          color: #00FF88;
          margin-bottom: 16px;
        }

        .highlight-content h2 {
          font-size: 28px;
          margin: 0 0 16px 0;
        }

        .highlight-content p {
          font-size: 15px;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.7;
          margin-bottom: 24px;
        }

        .highlight-points {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .highlight-points .point {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 15px;
        }

        .point-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          font-size: 14px;
          color: #00FF88;
          background: rgba(0, 255, 136, 0.1);
          border-radius: 6px;
        }

        .highlight-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .highlight-list li {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.7);
          padding-left: 24px;
          position: relative;
        }

        .highlight-list li::before {
          content: '✓';
          position: absolute;
          left: 0;
          color: #00FF88;
        }

        /* Mock Card */
        .mock-card {
          padding: 24px;
          background: rgba(13, 13, 18, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        }

        .mock-badge {
          display: inline-block;
          font-size: 10px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 20px;
          text-transform: uppercase;
          background: rgba(0, 255, 136, 0.15);
          color: #00FF88;
          margin-bottom: 16px;
        }

        .mock-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 20px;
          line-height: 1.4;
        }

        .mock-odds {
          display: flex;
          justify-content: center;
          gap: 24px;
          margin-bottom: 20px;
        }

        .mock-odds .yes {
          color: #00FF88;
          font-weight: 700;
          font-size: 18px;
        }

        .mock-odds .no {
          color: #FF4757;
          font-weight: 700;
          font-size: 18px;
        }

        .mock-swipe {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        /* Fact Check Demo */
        .fact-check-demo {
          padding: 24px;
          background: rgba(13, 13, 18, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        }

        .fc-header {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .fc-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
          font-size: 14px;
        }

        .fc-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          font-size: 11px;
          font-weight: 700;
        }

        .fc-item.verified .fc-icon {
          background: rgba(0, 255, 136, 0.15);
          color: #00FF88;
        }

        .fc-item.warning .fc-icon {
          background: rgba(255, 193, 7, 0.15);
          color: #FFC107;
        }

        .fc-score {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
        }

        .fc-score .score {
          font-size: 20px;
          font-weight: 700;
          color: #00FF88;
        }

        /* Coming Soon Grid */
        .coming-soon-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .coming-card {
          padding: 20px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
        }

        .coming-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .coming-header h4 {
          margin: 0;
          font-size: 15px;
        }

        .coming-timeline {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          font-weight: 500;
        }

        .coming-card p {
          margin: 0;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
        }

        /* Platforms Table */
        .platforms-table {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          overflow: hidden;
        }

        .table-header, .table-row {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          padding: 16px 20px;
        }

        .table-header {
          background: rgba(255, 255, 255, 0.05);
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: rgba(255, 255, 255, 0.5);
        }

        .table-row {
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .platform-name {
          font-weight: 600;
        }

        .platform-type, .platform-chain {
          color: rgba(255, 255, 255, 0.6);
          font-size: 14px;
        }

        .platform-status.live {
          color: #00FF88;
        }

        /* Platform Details */
        .platform-details {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-top: 24px;
        }

        .platform-card {
          padding: 20px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
        }

        .platform-card p {
          font-size: 14px;
        }

        .platform-stats {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .platform-stats span {
          padding: 4px 10px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
        }

        /* Commands */
        .commands-list {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          overflow: hidden;
        }

        .command-row {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .command-row:last-child {
          border-bottom: none;
        }

        .command-code {
          min-width: 180px;
          padding: 6px 12px;
          background: rgba(0, 255, 136, 0.1);
          border-radius: 6px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 14px;
          color: #00FF88;
        }

        .command-desc {
          color: rgba(255, 255, 255, 0.6);
          font-size: 14px;
        }

        /* NL Examples */
        .nl-examples {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .nl-example {
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .user-msg {
          color: #00B0FF;
          font-style: italic;
        }

        .bot-response {
          color: rgba(255, 255, 255, 0.5);
          font-size: 14px;
        }

        /* Telegram CTA */
        .telegram-cta {
          text-align: center;
          margin-top: 40px;
        }

        .telegram-btn {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 20px 40px;
          background: linear-gradient(135deg, #0088CC, #00AAFF);
          border-radius: 12px;
          color: #fff;
          font-size: 18px;
          font-weight: 700;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .telegram-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 136, 204, 0.3);
        }

        .telegram-note {
          margin-top: 12px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.4);
        }

        /* Roadmap */
        .roadmap-timeline {
          margin: 32px 0;
        }

        .roadmap-phase {
          display: flex;
          gap: 24px;
        }

        .phase-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 24px;
        }

        .phase-dot {
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        }

        .phase-dot.current {
          color: #00FF88;
        }

        .phase-dot.next {
          color: #00B0FF;
        }

        .phase-line {
          flex: 1;
          width: 2px;
          background: rgba(255, 255, 255, 0.1);
          margin: 8px 0;
        }

        .phase-content {
          flex: 1;
          padding-bottom: 40px;
        }

        .phase-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .phase-number {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: rgba(255, 255, 255, 0.4);
        }

        .phase-title {
          font-size: 20px;
          margin: 0;
        }

        .status-badge {
          padding: 4px 10px;
          border-radius: 100px;
          font-size: 11px;
          font-weight: 600;
        }

        .status-badge.current {
          background: rgba(0, 255, 136, 0.15);
          color: #00FF88;
        }

        .status-badge.next {
          background: rgba(0, 176, 255, 0.15);
          color: #00B0FF;
        }

        .phase-items {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .phase-items li {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
          color: rgba(255, 255, 255, 0.6);
          font-size: 15px;
        }

        .phase-items li.done {
          color: rgba(255, 255, 255, 0.9);
        }

        .item-check {
          font-size: 14px;
        }

        .phase-items li.done .item-check {
          color: #00FF88;
        }

        .phase-items li.soon {
          color: rgba(255, 255, 255, 0.9);
        }

        .phase-items li.soon .item-check {
          color: #00FF88;
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .soon-badge {
          font-size: 9px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: rgba(0, 255, 136, 0.15);
          color: #00FF88;
          margin-left: 8px;
        }

        /* Vision Cards */
        .vision-cards {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .vision-card {
          padding: 24px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
        }

        .vision-card h3 {
          margin-bottom: 8px;
        }

        .vision-card p {
          font-size: 14px;
          margin: 0;
        }

        /* Page Navigation */
        .page-nav {
          display: flex;
          justify-content: space-between;
          margin-top: 64px;
          padding-top: 32px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .page-nav-btn {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 16px 24px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          color: #fff;
          text-decoration: none;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .page-nav-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(0, 255, 136, 0.2);
        }

        .page-nav-btn.prev {
          align-items: flex-start;
        }

        .page-nav-btn.next {
          align-items: flex-end;
        }

        .nav-direction {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
        }

        .nav-page-title {
          font-size: 15px;
          font-weight: 600;
          color: #00FF88;
        }

        /* Footer */
        .docs-footer {
          margin-top: 48px;
          padding: 32px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }

        .footer-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
        }

        .footer-links {
          display: flex;
          gap: 24px;
        }

        .footer-links a {
          color: rgba(255, 255, 255, 0.5);
          text-decoration: none;
          font-size: 14px;
        }

        .footer-links a:hover {
          color: #fff;
        }

        .footer-copyright {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.3);
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .mobile-header {
            display: flex;
          }

          .mobile-overlay {
            display: block;
          }

          .docs-sidebar {
            position: fixed;
            left: -300px;
            top: 0;
            bottom: 0;
            z-index: 95;
            transition: left 0.3s ease;
          }

          .docs-sidebar.open {
            left: 0;
          }

          .docs-main {
            margin-left: 0;
            padding: 88px 24px 32px;
          }

          .page-nav {
            flex-direction: column;
            gap: 12px;
          }

          .page-nav-btn.prev,
          .page-nav-btn.next {
            align-items: flex-start;
          }
        }

        @media (max-width: 900px) {
          .solution-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .features-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .solution-grid,
          .persona-grid,
          .features-grid,
          .platform-details,
          .vision-cards {
            grid-template-columns: 1fr;
          }

          .section-header h1 {
            font-size: 32px;
          }

          .pillar-card {
            grid-template-columns: 1fr;
          }

          .docs-footer {
            flex-direction: column;
            text-align: center;
          }

          .gateways-grid {
            grid-template-columns: 1fr;
          }

          .core-features-grid {
            grid-template-columns: 1fr;
          }

          .feature-highlight {
            grid-template-columns: 1fr;
            padding: 24px;
            gap: 24px;
          }

          .feature-highlight.alt .highlight-visual {
            order: 0;
          }

          .highlight-content h2 {
            font-size: 24px;
          }

          .coming-soon-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 480px) {
          .cat-btn {
            padding: 8px 14px;
            font-size: 13px;
          }

          .search-input {
            font-size: 14px;
          }

          .feature-highlight {
            padding: 20px;
          }

          .mock-card,
          .fact-check-demo {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
}
