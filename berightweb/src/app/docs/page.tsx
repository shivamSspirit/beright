'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { useStagger } from '@/components/ui';
import BrandLogo from '@/components/BrandLogo';
import styles from './docs.module.css';

// ═══════════════════════════════════════════════════════════════════════════════
// BERIGHT DOCUMENTATION - Accurate content based on actual codebase
// ═══════════════════════════════════════════════════════════════════════════════

const NAV_SECTIONS = [
  { id: 'overview', label: 'What is BeRight?' },
  { id: 'agents', label: 'AI Agents' },
  { id: 'signals', label: 'Intelligence Signals' },
  { id: 'forecaster-network', label: 'Forecaster Network' },
  { id: 'platforms', label: 'Supported Platforms' },
  { id: 'commands', label: 'Commands' },
  { id: 'api', label: 'API Reference' },
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'litepaper', label: 'Litepaper', isLink: true, href: '/docs/litepaper' },
];

// SVG Icon components for agents
const AgentIcons: Record<string, React.ReactNode> = {
  scout: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  ),
  analyst: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  ),
  trader: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  xdegen: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  ),
};

// AI Agents - Actual capabilities from beright-ts/agents/
const AGENTS = [
  {
    name: 'Scout',
    role: 'Junior Analyst',
    iconKey: 'scout',
    description: 'Fast pattern recognition and market scanning. Finds hot markets, arbitrage opportunities, and whale activity across all platforms.',
    tools: ['Hot Markets', 'Search', 'Arbitrage', 'Whale Tracking', 'Compare Odds'],
    speed: '< 2s',
  },
  {
    name: 'Analyst',
    role: 'Senior Research',
    iconKey: 'analyst',
    description: 'Deep reasoning using Tetlock superforecasting methodology. Estimates probabilities with evidence gathering and calibration tracking.',
    tools: ['Research', 'Probability Estimation', 'Evidence Gathering', 'Calibration'],
    speed: '5-15s',
  },
  {
    name: 'Trader',
    role: 'Execution Desk',
    iconKey: 'trader',
    description: 'Risk calculation and trade execution. Uses Kelly criterion for position sizing, routes to best execution venues.',
    tools: ['Positions', 'Kelly Sizing', 'Execute Trade', 'Risk Check', 'Alerts'],
    speed: '2-3s',
  },
  {
    name: 'xDegen',
    role: 'Alpha Generator',
    iconKey: 'xdegen',
    description: 'Social content generation for market alpha. Creates viral posts about arbitrage alerts, hot markets, and market narratives.',
    tools: ['Alpha Posts', 'Thread Generation', 'Market Narratives', 'Scheduling'],
    speed: '2-5s',
  },
];

// SVG Icon components for signals
const SignalIcons: Record<string, React.ReactNode> = {
  volumeSurge: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 7-8.5 8.5-5-5L2 17" />
      <path d="M16 7h6v6" />
    </svg>
  ),
  oddsShift: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  arbitrage: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12M9 10h6M9 14h6" />
    </svg>
  ),
  resolution: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  newMarket: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9" />
      <path d="M19 3v4M17 5h4" />
    </svg>
  ),
  smartMoney: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  ),
  narrative: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  ),
  crossMarket: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  insider: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  consensus: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  ),
  whale: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    </svg>
  ),
  social: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
};

// 12 Intelligence Signals - Actual detectors from beright-ts/lib/signals/
const SIGNALS = [
  { iconKey: 'volumeSurge', name: 'Volume Surge', description: 'Detects volume spikes indicating increased market activity' },
  { iconKey: 'oddsShift', name: 'Odds Shift', description: 'Rapid price movements signaling momentum' },
  { iconKey: 'arbitrage', name: 'Arbitrage Opportunity', description: 'Price discrepancies >3% across platforms' },
  { iconKey: 'resolution', name: 'Resolution Imminent', description: 'Markets resolving within 24-48 hours' },
  { iconKey: 'newMarket', name: 'New Market', description: 'Newly launched markets for early opportunities' },
  { iconKey: 'smartMoney', name: 'Smart Money', description: 'Large positions from skilled traders' },
  { iconKey: 'narrative', name: 'Narrative Emergence', description: 'Breaking social/news narratives' },
  { iconKey: 'crossMarket', name: 'Cross-Market', description: 'Correlated movements across related markets' },
  { iconKey: 'insider', name: 'Insider Pattern', description: 'Unusual trading patterns suggesting info edge' },
  { iconKey: 'consensus', name: 'Consensus Flip', description: 'Market consensus reversals' },
  { iconKey: 'whale', name: 'Whale Entry', description: 'Large wallet positions entering markets' },
  { iconKey: 'social', name: 'Social Mention', description: 'Social media buzz threshold (coming soon)' },
];

// Supported Platforms - 6+ platforms from beright-ts/lib/dataFabric/providers/
const PLATFORMS = [
  { name: 'Jupiter/DFlow', type: 'Crypto', chain: 'Solana', status: 'live', volume: '$28.6M (Jan)', highlight: true },
  { name: 'Polymarket', type: 'Crypto', chain: 'Polygon', status: 'soon', volume: '$33.4B (2025)' },
  { name: 'Kalshi', type: 'Regulated', chain: 'USD', status: 'soon', volume: '$22.88B (2025)' },
  { name: 'Manifold', type: 'Play Money', chain: 'Off-chain', status: 'soon', volume: 'Experimentation' },
  { name: 'Limitless', type: 'Crypto', chain: 'Base', status: 'soon', volume: 'Growing' },
  { name: 'Metaculus', type: 'Forecasting', chain: 'Off-chain', status: 'soon', volume: 'Long-range' },
];

// Commands - Available in the BeRight Terminal
const COMMANDS = [
  { cmd: '/hot', desc: 'Trending markets with high activity', category: 'Discovery', status: 'live' },
  { cmd: '/brief', desc: 'Market brief with hot markets, signals, and news', category: 'Discovery', status: 'live' },
  { cmd: '/arb', desc: 'Current arbitrage opportunities across platforms', category: 'Discovery', status: 'live' },
  { cmd: '/signals', desc: 'Real-time intelligence signal feed', category: 'Discovery', status: 'live' },
  { cmd: '/research <topic>', desc: 'Deep analysis using Analyst agent', category: 'Research', status: 'live' },
  { cmd: '/predict <market>', desc: 'Make and record predictions', category: 'Research', status: 'live' },
  { cmd: '/recommend', desc: 'AI-generated trading recommendations', category: 'Research', status: 'live' },
  { cmd: '/calibration', desc: 'Check your forecasting accuracy', category: 'Research', status: 'soon' },
  { cmd: '/trade <market>', desc: 'Execute trades with smart routing', category: 'Trading', status: 'soon' },
  { cmd: '/positions', desc: 'View current holdings across platforms', category: 'Trading', status: 'soon' },
  { cmd: '/portfolio', desc: 'Full portfolio with P&L analysis', category: 'Trading', status: 'soon' },
  { cmd: '/whale', desc: 'Track smart money movements', category: 'Trading', status: 'soon' },
  { cmd: '/leaderboard', desc: 'Community forecaster rankings', category: 'Social', status: 'soon' },
  { cmd: '/follow <user>', desc: 'Follow top forecasters', category: 'Social', status: 'soon' },
  { cmd: '/alerts', desc: 'Set up real-time alerts', category: 'Social', status: 'soon' },
];

// API Endpoints - Actual routes from beright-ts/app/api/
const API_ENDPOINTS = [
  { method: 'GET', path: '/api/v2/markets', description: 'Search and list markets' },
  { method: 'GET', path: '/api/v2/markets/trending', description: 'Get trending markets' },
  { method: 'GET', path: '/api/v2/markets/[id]', description: 'Get market details' },
  { method: 'GET', path: '/api/v2/arbitrage', description: 'Find arbitrage opportunities' },
  { method: 'POST', path: '/api/v2/execution', description: 'Execute trades' },
  { method: 'GET', path: '/api/v2/portfolio', description: 'Get user portfolio' },
  { method: 'GET', path: '/api/v2/feed', description: 'ML-powered market feed' },
  { method: 'POST', path: '/api/v2/fact-check', description: 'AI fact-checking' },
  { method: 'GET', path: '/api/v2/calibration', description: 'User calibration data' },
  { method: 'GET', path: '/api/v2/yield/apy', description: 'Yield pool APY' },
];

// Roadmap - Aligned with Litepaper V2
const ROADMAP = [
  {
    phase: 1,
    title: 'Foundation',
    status: 'current',
    items: [
      { label: 'AI Agent System (4 agents)', done: true },
      { label: '12 Intelligence Signals', done: true },
      { label: '6-Platform Aggregation', done: true },
      { label: 'Arbitrage Detection', done: true },
      { label: 'Web Swipe Interface', done: true },
      { label: 'BeRight Terminal', done: true },
      { label: 'AI Edge Detection', done: true },
      { label: 'Privy Wallet Integration', done: true },
    ],
  },
  {
    phase: 2,
    title: 'Intelligence Layer',
    status: 'next',
    items: [
      { label: 'Jupiter Zero-Fee Trading', done: true },
      { label: 'On-Chain Predictions (Solana)', done: true },
      { label: 'Forecaster Profiles & Brier Scoring', done: false },
      { label: 'Whale Tracking Alerts', done: false },
      { label: 'Social Signal Integration', done: false },
      { label: 'Mobile App Beta', done: false },
    ],
  },
  {
    phase: 3,
    title: 'DeFi Integration',
    status: 'future',
    items: [
      { label: 'Conviction Pools Launch', done: false },
      { label: 'Forecaster Staking', done: false },
      { label: 'Sanctum INF Yield (6.4% APY)', done: false },
      { label: 'Cross-Platform Liquidity', done: false },
      { label: 'Auto-Execution Strategies', done: false },
    ],
  },
  {
    phase: 4,
    title: 'Protocol',
    status: 'future',
    items: [
      { label: 'Mobile Apps (iOS/Android)', done: false },
      { label: 'API Marketplace', done: false },
      { label: 'Decentralized Resolution', done: false },
      { label: 'Multi-Chain Expansion', done: false },
    ],
  },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // GSAP stagger animations for grids
  const agentsGridRef = useStagger<HTMLDivElement>({ stagger: 0.1 });
  const signalsGridRef = useStagger<HTMLDivElement>({ stagger: 0.05 });

  const currentIndex = NAV_SECTIONS.findIndex(s => s.id === activeSection);
  const prevSection = currentIndex > 0 ? NAV_SECTIONS[currentIndex - 1] : null;
  const nextSection = currentIndex < NAV_SECTIONS.length - 1 ? NAV_SECTIONS[currentIndex + 1] : null;

  const handleNavClick = (sectionId: string) => {
    setActiveSection(sectionId);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filter commands by search
  const filteredCommands = useMemo(() => {
    if (!searchQuery) return COMMANDS;
    const q = searchQuery.toLowerCase();
    return COMMANDS.filter(c =>
      c.cmd.toLowerCase().includes(q) ||
      c.desc.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <div className={styles.docsPage}>
        {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className={styles.mobileOverlay}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`${styles.sidebar} ${mobileMenuOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.searchContainer}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search docs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <nav className={styles.sidebarNav}>
          <div className={styles.navSection}>
            <span className={styles.navLabel}>Getting Started</span>
            {NAV_SECTIONS.slice(0, 1).map(section => (
              <button
                key={section.id}
                className={`${styles.navItem} ${activeSection === section.id ? styles.navItemActive : ''}`}
                onClick={() => handleNavClick(section.id)}
              >
                {section.label}
              </button>
            ))}
          </div>

          <div className={styles.navSection}>
            <span className={styles.navLabel}>Core Features</span>
            {NAV_SECTIONS.slice(1, 5).map(section => (
              <button
                key={section.id}
                className={`${styles.navItem} ${activeSection === section.id ? styles.navItemActive : ''}`}
                onClick={() => handleNavClick(section.id)}
              >
                {section.label}
              </button>
            ))}
          </div>

          <div className={styles.navSection}>
            <span className={styles.navLabel}>Developers</span>
            {NAV_SECTIONS.slice(5, 6).map(section => (
              <button
                key={section.id}
                className={`${styles.navItem} ${activeSection === section.id ? styles.navItemActive : ''}`}
                onClick={() => handleNavClick(section.id)}
              >
                {section.label}
              </button>
            ))}
          </div>

          <div className={styles.navSection}>
            <span className={styles.navLabel}>Future</span>
            {NAV_SECTIONS.slice(6, 7).map(section => (
              <button
                key={section.id}
                className={`${styles.navItem} ${activeSection === section.id ? styles.navItemActive : ''}`}
                onClick={() => handleNavClick(section.id)}
              >
                {section.label}
              </button>
            ))}
          </div>

          <div className={styles.navSection}>
            <span className={styles.navLabel}>Resources</span>
            <Link href="/docs/litepaper" className={styles.navItem}>Litepaper</Link>
            <Link href="/docs/faq" className={styles.navItem}>FAQ</Link>
          </div>
        </nav>

        <div className={styles.sidebarCta}>
          <Link href="/beright-terminal" className={styles.ctaBtn}>
            Open Terminal
          </Link>
        </div>
      </aside>

      {/* Mobile Menu Button */}
      <button
        className={styles.mobileMenuBtn}
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle menu"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {mobileMenuOpen ? (
            <path d="M18 6L6 18M6 6l12 12" />
          ) : (
            <path d="M3 12h18M3 6h18M3 18h18" />
          )}
        </svg>
      </button>

      {/* Main Content */}
      <main className={styles.main}>
        {/* Overview Section */}
        {activeSection === 'overview' && (
          <section className={styles.contentSection}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionBadge}>Overview</span>
              <h1 className={styles.sectionTitle}>What is BeRight?</h1>
              <p className={`${styles.sectionSubtitle} ${styles.gradientText}`}>
                AI-powered prediction market intelligence
              </p>
            </div>

            <div className={`${styles.contentBlock} ${styles.highlightBox}`}>
              <span className={styles.calloutLabel}>Stop Guessing. Start Proving.</span>
              <p className={styles.paragraph} style={{ margin: 0, fontSize: '17px' }}>
                <strong>BeRight</strong> is the AI-powered intelligence and reputation layer for prediction markets.
                We aggregate data from 6+ platforms, provide AI edge detection on every market, and build
                verifiable on-chain forecaster track records. Forecasting skill is an asset class.
              </p>
            </div>

            <h2 className={styles.h2}><span className={styles.h2Accent} />Why BeRight?</h2>
            <div className={styles.grid3}>
              <div className={`${styles.card} ${styles.solutionCard}`}>
                <h3 className={styles.h3}>AI Edge Detection</h3>
                <p style={{ fontSize: '14px', margin: 0 }}>Replace 30 minutes of research with a 3-second insight. One-line analysis comparing AI view to market odds.</p>
              </div>
              <div className={`${styles.card} ${styles.solutionCard}`}>
                <h3 className={styles.h3}>6+ Platforms</h3>
                <p style={{ fontSize: '14px', margin: 0 }}>Unified access to Polymarket, Kalshi, Jupiter/DFlow, Manifold, Limitless, and more.</p>
              </div>
              <div className={`${styles.card} ${styles.solutionCard}`}>
                <h3 className={styles.h3}>On-Chain Reputation</h3>
                <p style={{ fontSize: '14px', margin: 0 }}>Verifiable Brier scores and calibration curves on Solana. Build provable track records.</p>
              </div>
            </div>

            <h2 className={styles.h2}><span className={styles.h2Accent} />Who is it for?</h2>
            <div className={styles.grid2}>
              <div className={styles.card}>
                <h3 className={styles.h3}>Forecasters</h3>
                <p style={{ fontSize: '14px', margin: 0 }}>Build verifiable track records with on-chain Brier scores. Prove your edge and attract capital through Conviction Pools.</p>
              </div>
              <div className={styles.card}>
                <h3 className={styles.h3}>Active Traders</h3>
                <p style={{ fontSize: '14px', margin: 0 }}>Get AI-powered edge detection, real-time arbitrage alerts, and whale tracking. Execute with zero fees on Jupiter.</p>
              </div>
              <div className={styles.card}>
                <h3 className={styles.h3}>Capital Providers</h3>
                <p style={{ fontSize: '14px', margin: 0 }}>Invest in forecasting skill via Conviction Pools. Delegate capital to proven predictors, earn 30% of pool profits.</p>
              </div>
              <div className={styles.card}>
                <h3 className={styles.h3}>Developers</h3>
                <p style={{ fontSize: '14px', margin: 0 }}>Access aggregated market data, signals, and forecaster profiles via our API. Build on the intelligence layer.</p>
              </div>
            </div>

            <div className={styles.tryCta}>
              <p className={styles.paragraph}>Start exploring prediction markets with AI assistance.</p>
              <Link href="/beright-terminal" className={styles.tryBtn}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 17l6-6-6-6M12 19h8" />
                </svg>
                Open Terminal
              </Link>
            </div>
          </section>
        )}

        {/* Forecaster Network Section */}
        {activeSection === 'forecaster-network' && (
          <section className={styles.contentSection}>
            <div className={styles.sectionHeader}>
              <span className={`${styles.sectionBadge} ${styles.sectionBadgeLive}`}>DeFi Primitive</span>
              <h1 className={styles.sectionTitle}>Forecaster Network</h1>
              <p className={styles.sectionSubtitle}>
                On-chain reputation, conviction pools, and the calibration economy
              </p>
            </div>

            <div className={`${styles.contentBlock} ${styles.highlightBox} ${styles.highlightBoxGreen}`}>
              <span className={styles.calloutLabel}>Forecasting as an Asset Class</span>
              <p className={styles.paragraph} style={{ margin: 0 }}>
                BeRight transforms forecasting skill into a permissionless financial primitive. Build verifiable track records,
                attract capital to your conviction pools, and earn performance fees. Your Brier score is your credit rating.
              </p>
            </div>

            <h2 className={styles.h2}><span className={styles.h2Accent} />Forecaster Network Protocol</h2>
            <div className={styles.contentBlock}>
              <h3 className={styles.h3}>Permissionless Skill Graph</h3>
              <p className={styles.paragraph}>
                Every prediction you make is recorded on-chain with its corresponding outcome and Brier score. Your track record
                is immutable, portable, and verifiable by anyone. Elite forecasters earn verified status and attract capital
                to their conviction pools. The better your calibration, the more capital you can manage.
              </p>

              <h3 className={styles.h3} style={{ marginTop: '24px' }}>How It Works</h3>
              <div className={styles.grid2}>
                <div className={styles.card}>
                  <h3 className={styles.h3}>1. Make Predictions</h3>
                  <p style={{ fontSize: '14px', margin: 0 }}>
                    Predict outcomes across any supported market. Every prediction is recorded on Solana with timestamp, probability, and metadata.
                  </p>
                </div>
                <div className={styles.card}>
                  <h3 className={styles.h3}>2. Build Track Record</h3>
                  <p style={{ fontSize: '14px', margin: 0 }}>
                    As markets resolve, your Brier score updates automatically. Lower scores = better calibration = higher tier.
                  </p>
                </div>
                <div className={styles.card}>
                  <h3 className={styles.h3}>3. Unlock Tiers</h3>
                  <p style={{ fontSize: '14px', margin: 0 }}>
                    ELITE (&lt;0.15), VERIFIED (&lt;0.20), or ROOKIE (&lt;0.30). Higher tiers unlock larger pool sizes and premium features.
                  </p>
                </div>
                <div className={styles.card}>
                  <h3 className={styles.h3}>4. Launch Pool</h3>
                  <p style={{ fontSize: '14px', margin: 0 }}>
                    Create a Conviction Pool, attract LPs, and earn 30% performance fees on all pool profits.
                  </p>
                </div>
              </div>

              <div className={styles.grid3} style={{ marginTop: '24px' }}>
                <div className={styles.card}>
                  <h3 className={styles.h3}>Calibration Metric</h3>
                  <p style={{ fontSize: '14px', margin: 0, color: 'var(--color-primary)' }}>
                    Brier score<br/>Lower is better
                  </p>
                </div>
                <div className={styles.card}>
                  <h3 className={styles.h3}>On-Chain Record</h3>
                  <p style={{ fontSize: '14px', margin: 0, color: 'var(--color-primary)' }}>
                    Immutable<br/>Portable & verifiable
                  </p>
                </div>
                <div className={styles.card}>
                  <h3 className={styles.h3}>Network Effect</h3>
                  <p style={{ fontSize: '14px', margin: 0, color: 'var(--color-primary)' }}>
                    Better calibration<br/>→ more capital
                  </p>
                </div>
              </div>
            </div>

            <h2 className={styles.h2}><span className={styles.h2Accent} />DeFi Primitive: Forecaster Pools</h2>
            <div className={styles.contentBlock}>
              <h3 className={styles.h3}>Conviction-Backed Staking</h3>
              <p className={styles.paragraph}>
                Forecaster Pools are permissionless prediction market hedge funds. Capital providers (LPs) stake in pools
                managed by elite forecasters. Pool operators deploy capital across markets based on their conviction.
                Profits are split: 50% to forecasters, 30% to delegators, and 20% to platform. It's like an index fund
                for alpha, but the "fund manager" has a verifiable, on-chain track record.
              </p>

              <h3 className={styles.h3} style={{ marginTop: '24px' }}>Pool Economics</h3>
              <div className={styles.grid2}>
                <div className={`${styles.card} ${styles.solutionCard}`}>
                  <h3 className={styles.h3}>For Forecasters (Pool Operators)</h3>
                  <p style={{ fontSize: '14px', margin: 0 }}>
                    • Earn 50% of pool profits<br/>
                    • Manage up to $500K (ELITE tier)<br/>
                    • Must maintain Brier &lt; 0.20<br/>
                    • Build reputation and earn recurring revenue
                  </p>
                </div>
                <div className={`${styles.card} ${styles.solutionCard}`}>
                  <h3 className={styles.h3}>For Delegators (Capital Providers)</h3>
                  <p style={{ fontSize: '14px', margin: 0 }}>
                    • Earn 30% of pool profits<br/>
                    • Passive alpha exposure (no trading)<br/>
                    • Verifiable operator track record<br/>
                    • Withdraw anytime (no lock-up)
                  </p>
                </div>
              </div>

              <div className={styles.grid3} style={{ marginTop: '24px' }}>
                <div className={styles.card}>
                  <h3 className={styles.h3}>Fee Structure</h3>
                  <p style={{ fontSize: '14px', margin: 0, color: 'var(--color-primary)' }}>
                    50/30/20 split<br/>Forecasters/Delegators/Platform
                  </p>
                </div>
                <div className={styles.card}>
                  <h3 className={styles.h3}>Pool Creation</h3>
                  <p style={{ fontSize: '14px', margin: 0, color: 'var(--color-primary)' }}>
                    Min Brier &lt; 0.20<br/>VERIFIED tier+
                  </p>
                </div>
                <div className={styles.card}>
                  <h3 className={styles.h3}>Security</h3>
                  <p style={{ fontSize: '14px', margin: 0, color: 'var(--color-primary)' }}>
                    No lock-up<br/>Withdraw anytime
                  </p>
                </div>
              </div>
            </div>

            <h2 className={styles.h2}><span className={styles.h2Accent} />Calibration Tiers</h2>
            <div className={styles.contentBlock}>
              <h3 className={styles.h3}>Proof of Skill Economy</h3>
              <p className={styles.paragraph}>
                Your Brier score determines your tier. Lower scores unlock higher pool sizes, premium features, and
                more capital inflow. Think of it as a credit score for forecasting—except it's earned, not bought.
              </p>

              <div className={styles.platformTable}>
                <div className={styles.tableHeader}>
                  <div>Tier</div>
                  <div>Brier Score</div>
                  <div>Max Pool Size</div>
                  <div>Min Predictions</div>
                </div>
                <div className={styles.tableRow}>
                  <div className={styles.platformName}>ELITE</div>
                  <div className={styles.platformType}>&lt; 0.15</div>
                  <div className={styles.platformChain}>$500K</div>
                  <div className={styles.statusLive}>100+</div>
                </div>
                <div className={styles.tableRow}>
                  <div className={styles.platformName}>VERIFIED</div>
                  <div className={styles.platformType}>&lt; 0.20</div>
                  <div className={styles.platformChain}>$100K</div>
                  <div className={styles.statusLive}>50+</div>
                </div>
                <div className={styles.tableRow}>
                  <div className={styles.platformName}>ROOKIE</div>
                  <div className={styles.platformType}>&lt; 0.30</div>
                  <div className={styles.platformChain}>$25K</div>
                  <div className={styles.statusLive}>10+</div>
                </div>
              </div>

              <div className={`${styles.contentBlock} ${styles.highlightBox}`} style={{ marginTop: '24px' }}>
                <span className={styles.calloutLabel}>Brier Score Explained</span>
                <p className={styles.paragraph} style={{ margin: 0 }}>
                  Brier score measures the accuracy of probabilistic predictions. Score = (predicted_probability - actual_outcome)².
                  A perfect prediction (70% on a YES that resolved YES) scores 0.09. A terrible prediction (70% on a NO that resolved YES) scores 0.49.
                  <strong> Lower is always better.</strong> BeRight tracks your cumulative Brier score across all predictions.
                </p>
              </div>
            </div>

            <h2 className={styles.h2}><span className={styles.h2Accent} />Why This Matters</h2>
            <div className={styles.grid2}>
              <div className={styles.card}>
                <h3 className={styles.h3}>For Forecasters</h3>
                <p style={{ fontSize: '14px', margin: 0 }}>
                  Your edge becomes an income stream. Build a track record, launch a pool, earn performance fees.
                  No VC needed, no permission required.
                </p>
              </div>
              <div className={styles.card}>
                <h3 className={styles.h3}>For Capital Providers</h3>
                <p style={{ fontSize: '14px', margin: 0 }}>
                  Access alpha without trading yourself. Stake with elite forecasters, earn passive returns,
                  track performance on-chain.
                </p>
              </div>
              <div className={styles.card}>
                <h3 className={styles.h3}>For the Ecosystem</h3>
                <p style={{ fontSize: '14px', margin: 0 }}>
                  More capital → more liquidity → tighter spreads → better markets.
                  Forecaster pools create a flywheel effect.
                </p>
              </div>
              <div className={styles.card}>
                <h3 className={styles.h3}>For Prediction Markets</h3>
                <p style={{ fontSize: '14px', margin: 0 }}>
                  Finally, a way to monetize forecasting skill beyond pure trading.
                  Opens prediction markets to a new class of participants.
                </p>
              </div>
            </div>

            <div className={styles.tryCta}>
              <p className={styles.paragraph}>
                <strong>Ready to build your forecaster reputation?</strong><br/>
                Start making predictions and see your Brier score improve over time.
              </p>
              <Link href="/beright-terminal" className={styles.tryBtn}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 17l6-6-6-6M12 19h8" />
                </svg>
                Start Forecasting
              </Link>
            </div>
          </section>
        )}

        {/* Agents Section */}
        {activeSection === 'agents' && (
          <section className={styles.contentSection}>
            <div className={styles.sectionHeader}>
              <span className={`${styles.sectionBadge} ${styles.sectionBadgeLive}`}>Live</span>
              <h1 className={styles.sectionTitle}>AI Agents</h1>
              <p className={styles.sectionSubtitle}>
                Four specialized agents work together to find and execute opportunities
              </p>
            </div>

            <div className={`${styles.contentBlock} ${styles.highlightBox}`}>
              <span className={styles.calloutLabel}>Agentic Architecture</span>
              <p className={styles.paragraph} style={{ margin: 0 }}>
                Each agent has a specialized role and set of tools. The LLM decides which tools to use
                based on your request - not hardcoded routing. This means natural, intelligent responses
                to complex queries.
              </p>
            </div>

            <div ref={agentsGridRef} className={styles.grid2}>
              {AGENTS.map(agent => (
                <div key={agent.name} className={styles.agentCard}>
                  <div className={styles.agentHeader}>
                    <span className={styles.agentEmoji}>{AgentIcons[agent.iconKey]}</span>
                    <div>
                      <h3 className={styles.agentName}>{agent.name}</h3>
                      <p className={styles.agentRole}>{agent.role} • {agent.speed}</p>
                    </div>
                  </div>
                  <p className={styles.agentDesc}>{agent.description}</p>
                  <div className={styles.agentTools}>
                    {agent.tools.map(tool => (
                      <span key={tool} className={styles.agentTool}>{tool}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <h2 className={styles.h2}><span className={styles.h2Accent} />How It Works</h2>
            <div className={styles.grid3}>
              <div className={styles.card}>
                <h3 className={styles.h3}>1. You Ask</h3>
                <p style={{ fontSize: '14px', margin: 0 }}>Natural language query via the Terminal</p>
              </div>
              <div className={styles.card}>
                <h3 className={styles.h3}>2. Agent Routes</h3>
                <p style={{ fontSize: '14px', margin: 0 }}>Orchestrator picks the right specialist agent</p>
              </div>
              <div className={styles.card}>
                <h3 className={styles.h3}>3. Tools Execute</h3>
                <p style={{ fontSize: '14px', margin: 0 }}>Agent uses tools to gather data and execute</p>
              </div>
            </div>
          </section>
        )}

        {/* Signals Section */}
        {activeSection === 'signals' && (
          <section className={styles.contentSection}>
            <div className={styles.sectionHeader}>
              <span className={`${styles.sectionBadge} ${styles.sectionBadgeLive}`}>Live</span>
              <h1 className={styles.sectionTitle}>Intelligence Signals</h1>
              <p className={styles.sectionSubtitle}>
                12 real-time detectors scanning for actionable opportunities
              </p>
            </div>

            <div className={`${styles.contentBlock} ${styles.highlightBoxGreen}`}>
              <p className={styles.paragraph} style={{ margin: 0 }}>
                Signals run in parallel across all supported platforms. Each signal is evaluated by our
                Scout LLM which determines: <strong>ALERT</strong> (act now), <strong>WATCH</strong> (monitor),
                or <strong>SKIP</strong> (noise).
              </p>
            </div>

            <div ref={signalsGridRef} className={styles.grid3}>
              {SIGNALS.map(signal => (
                <div key={signal.name} className={styles.signalCard}>
                  <span className={styles.signalEmoji}>{SignalIcons[signal.iconKey]}</span>
                  <div className={styles.signalContent}>
                    <h4>{signal.name}</h4>
                    <p>{signal.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <h2 className={styles.h2}><span className={styles.h2Accent} />Signal Pipeline</h2>
            <div className={styles.card} style={{ padding: '24px' }}>
              <p className={styles.paragraph}>
                <code style={{ color: '#00FFB2' }}>12 Detectors</code> →
                <code style={{ color: '#A78BFA' }}> Groq Scout Eval</code> →
                <code style={{ color: '#10B981' }}> Supabase</code> →
                <code style={{ color: '#F59E0B' }}> Alert Queue</code>
              </p>
              <p style={{ fontSize: '14px', margin: 0, color: 'rgba(255,255,255,0.6)' }}>
                Top 15 signals by strength are evaluated. Only actionable signals (ALERT + WATCH) are
                sent to users with reasoning and data citations.
              </p>
            </div>
          </section>
        )}

        {/* Platforms Section */}
        {activeSection === 'platforms' && (
          <section className={styles.contentSection}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionBadge}>Integration</span>
              <h1 className={styles.sectionTitle}>Supported Platforms</h1>
              <p className={styles.sectionSubtitle}>
                Unified access to major prediction markets
              </p>
            </div>

            <div className={styles.platformTable}>
              <div className={styles.tableHeader}>
                <span>Platform</span>
                <span>Type</span>
                <span>Settlement</span>
                <span>Status</span>
              </div>
              {PLATFORMS.map(platform => (
                <div key={platform.name} className={styles.tableRow} style={platform.highlight ? { background: 'rgba(0, 255, 178, 0.05)' } : undefined}>
                  <span className={styles.platformName}>
                    {platform.name}
                    {platform.highlight && <span style={{ marginLeft: '8px', fontSize: '10px', color: '#00FFB2' }}>Zero Fees</span>}
                  </span>
                  <span className={styles.platformType}>{platform.type}</span>
                  <span className={styles.platformChain}>{platform.chain}</span>
                  <span className={platform.status === 'live' ? styles.statusLive : styles.statusSoon}>
                    {platform.status === 'live' ? '● Live' : '○ Soon'}
                  </span>
                </div>
              ))}
            </div>

            <h2 className={styles.h2}><span className={styles.h2Accent} />Jupiter Integration</h2>
            <div className={`${styles.contentBlock} ${styles.highlightBox}`}>
              <span className={styles.calloutLabel}>Zero Payout Fees</span>
              <p className={styles.paragraph} style={{ margin: 0 }}>
                Jupiter aggregates Polymarket + Kalshi liquidity on Solana. Winners get the full $1/contract
                with no payout fees. On-chain settlement in ~400ms with low transaction fees.
              </p>
            </div>
          </section>
        )}

        {/* Commands Section */}
        {activeSection === 'commands' && (
          <section className={styles.contentSection}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionBadge}>Reference</span>
              <h1 className={styles.sectionTitle}>Commands</h1>
              <p className={styles.sectionSubtitle}>
                40+ commands available in the BeRight Terminal
              </p>
            </div>

            <div className={styles.searchContainer}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search commands..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className={styles.commandsList}>
              {filteredCommands.map(cmd => (
                <div key={cmd.cmd} className={styles.commandRow}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <code className={styles.commandCode}>{cmd.cmd}</code>
                    <span className={cmd.status === 'live' ? styles.statusLive : styles.statusSoon} style={{ fontSize: '11px', fontWeight: '600' }}>
                      {cmd.status === 'live' ? '● LIVE' : '○ Coming Soon'}
                    </span>
                  </div>
                  <span className={styles.commandDesc}>{cmd.desc}</span>
                </div>
              ))}
            </div>

            <h2 className={styles.h2}><span className={styles.h2Accent} />Natural Language</h2>
            <p className={styles.paragraph}>
              You don't need to memorize commands. Just ask in plain English:
            </p>
            <div className={styles.grid2}>
              <div className={styles.card}>
                <p style={{ color: '#00FFB2', fontStyle: 'italic', margin: '0 0 8px' }}>"What are the odds on the Fed cutting rates?"</p>
                <p style={{ fontSize: '13px', margin: 0, color: 'rgba(255,255,255,0.5)' }}>Returns odds from all platforms</p>
              </div>
              <div className={styles.card}>
                <p style={{ color: '#00FFB2', fontStyle: 'italic', margin: '0 0 8px' }}>"Find me arbitrage opportunities"</p>
                <p style={{ fontSize: '13px', margin: 0, color: 'rgba(255,255,255,0.5)' }}>Lists current spreads with profit potential</p>
              </div>
              <div className={styles.card}>
                <p style={{ color: '#00FFB2', fontStyle: 'italic', margin: '0 0 8px' }}>"What's hot right now?"</p>
                <p style={{ fontSize: '13px', margin: 0, color: 'rgba(255,255,255,0.5)' }}>Trending markets by volume</p>
              </div>
              <div className={styles.card}>
                <p style={{ color: '#00FFB2', fontStyle: 'italic', margin: '0 0 8px' }}>"Analyze the Bitcoin ETF market"</p>
                <p style={{ fontSize: '13px', margin: 0, color: 'rgba(255,255,255,0.5)' }}>Deep research with probability estimate</p>
              </div>
            </div>
          </section>
        )}

        {/* API Section */}
        {activeSection === 'api' && (
          <section className={styles.contentSection}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionBadge}>Developers</span>
              <h1 className={styles.sectionTitle}>API Reference</h1>
              <p className={styles.sectionSubtitle}>
                REST API for building on BeRight data
              </p>
            </div>

            <div className={`${styles.contentBlock} ${styles.highlightBox}`}>
              <span className={styles.calloutLabel}>Base URL</span>
              <code style={{ color: '#00FFB2', fontSize: '16px' }}>https://api.beright.fun/api/v2</code>
            </div>

            <h2 className={styles.h2}><span className={styles.h2Accent} />Endpoints</h2>
            <table className={styles.apiTable}>
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Endpoint</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {API_ENDPOINTS.map(endpoint => (
                  <tr key={endpoint.path}>
                    <td className={endpoint.method === 'GET' ? styles.methodGet : styles.methodPost}>
                      {endpoint.method}
                    </td>
                    <td className={styles.endpoint}>{endpoint.path}</td>
                    <td style={{ color: 'rgba(255,255,255,0.6)' }}>{endpoint.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2 className={styles.h2}><span className={styles.h2Accent} />Authentication</h2>
            <div className={styles.card} style={{ padding: '24px' }}>
              <p className={styles.paragraph} style={{ margin: 0 }}>
                Public endpoints require no authentication. Trading and portfolio endpoints require
                a Solana wallet signature. Include the signature in the <code>X-Wallet-Signature</code> header.
              </p>
            </div>
          </section>
        )}

        {/* Roadmap Section */}
        {activeSection === 'roadmap' && (
          <section className={styles.contentSection}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionBadge}>Future</span>
              <h1 className={styles.sectionTitle}>Roadmap</h1>
              <p className={styles.sectionSubtitle}>
                Building the prediction market intelligence layer
              </p>
            </div>

            <div style={{ marginTop: '32px' }}>
              {ROADMAP.map((phase, i) => (
                <div key={phase.phase} className={styles.roadmapPhase}>
                  <div className={styles.phaseIndicator}>
                    <span className={`${styles.phaseDot} ${phase.status === 'current' ? styles.phaseDotCurrent : phase.status === 'next' ? styles.phaseDotNext : ''}`}>
                      {phase.status === 'current' ? '●' : '○'}
                    </span>
                    {i < ROADMAP.length - 1 && <div className={styles.phaseLine} />}
                  </div>
                  <div className={styles.phaseContent}>
                    <div className={styles.phaseHeader}>
                      <span className={styles.phaseNumber}>Phase {phase.phase}</span>
                      <h3 className={styles.phaseTitle}>{phase.title}</h3>
                      {phase.status === 'current' && <span className={`${styles.statusBadge} ${styles.statusBadgeCurrent}`}>In Progress</span>}
                      {phase.status === 'next' && <span className={`${styles.statusBadge} ${styles.statusBadgeNext}`}>Up Next</span>}
                    </div>
                    <ul className={styles.phaseItems}>
                      {phase.items.map((item, j) => (
                        <li key={j} className={`${styles.phaseItem} ${item.done ? styles.phaseItemDone : ''}`}>
                          <span className={styles.itemCheck}>{item.done ? '✓' : '○'}</span>
                          <span>{item.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Page Navigation */}
        <nav className={styles.pageNav}>
          {prevSection ? (
            <button className={`${styles.pageNavBtn} ${styles.pageNavPrev}`} onClick={() => handleNavClick(prevSection.id)}>
              <span className={styles.navDirection}>← Previous</span>
              <span className={styles.navPageTitle}>{prevSection.label}</span>
            </button>
          ) : (
            <div />
          )}
          {nextSection ? (
            <button className={`${styles.pageNavBtn} ${styles.pageNavNext}`} onClick={() => handleNavClick(nextSection.id)}>
              <span className={styles.navDirection}>Next →</span>
              <span className={styles.navPageTitle}>{nextSection.label}</span>
            </button>
          ) : (
            <Link href="/docs/faq" className={`${styles.pageNavBtn} ${styles.pageNavNext}`}>
              <span className={styles.navDirection}>Next →</span>
              <span className={styles.navPageTitle}>FAQ</span>
            </Link>
          )}
        </nav>

        {/* Footer */}
        <footer className={styles.footer}>
          <div className={styles.footerBrand}>
            <BrandLogo size={20} />
            <span>BeRight</span>
          </div>
          <div className={styles.footerLinks}>
            <Link href="/beright-terminal">Terminal</Link>
            <a href="https://x.com/AgentBEright" target="_blank" rel="noopener noreferrer">Twitter</a>
          </div>
          <p className={styles.footerCopyright}>© 2026 BeRight Protocol</p>
        </footer>
      </main>
    </div>
  );
}
