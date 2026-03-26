'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { PageWrapper, Section } from '@/components/ui';
import styles from './litepaper.module.css';

// ===========================================================================
// Table of Contents Data
// ===========================================================================

const TOC_SECTIONS = [
  { id: 'introduction', number: 1, label: 'Introduction' },
  { id: 'prediction-markets', number: 2, label: 'Prediction Markets' },
  { id: 'market-size', number: 3, label: 'Market Size & Opportunity' },
  { id: 'problem', number: 4, label: 'The Problem' },
  { id: 'solution', number: 5, label: 'The Solution' },
  { id: 'competitive', number: 6, label: 'Competitive Landscape' },
  { id: 'product', number: 7, label: 'BeRight Product' },
  { id: 'reputation', number: 8, label: 'Reputation System' },
  { id: 'staking-pools', number: 9, label: 'Conviction Pools' },
  { id: 'business-model', number: 10, label: 'Business Model' },
  { id: 'conclusion', number: 11, label: 'Conclusion' },
];

// ===========================================================================
// SVG Icon components for litepaper
// ===========================================================================

const LitepaperIcons: Record<string, React.ReactNode> = {
  aiEdge: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  ),
  swipe: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4.1 12 6" />
      <path d="m5.1 8-2.9-.8" />
      <path d="m14 4.1 2.8 2.8" />
      <path d="M18 15h.01" />
      <path d="M18 11h.01" />
      <path d="M22 11h.01" />
      <path d="M22 15h.01" />
      <path d="m7.5 10.5 8.5-3 3 8.5" />
    </svg>
  ),
  crossPlatform: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  ),
  reputation: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  ),
  pools: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12M9 10h6M9 14h6" />
    </svg>
  ),
  agents: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  ),
  dataFabric: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  ),
};

// ===========================================================================
// Solutions Data (§5)
// ===========================================================================

const SOLUTIONS = [
  {
    iconKey: 'aiEdge',
    title: 'AI Edge Detection',
    description: 'Replace 30 minutes of research with a 3-second insight. Our AI compares its analysis to market odds and tells you where the edge is.',
  },
  {
    iconKey: 'swipe',
    title: 'Swipe-to-Predict Interface',
    description: 'Mobile-first UX that no competitor has. Swipe right for YES, left for NO. Validated via search: zero competitors have this.',
  },
  {
    iconKey: 'crossPlatform',
    title: 'Cross-Platform Aggregation',
    description: 'One interface for major prediction markets including Polymarket, Kalshi, Jupiter, and more. Best price, arbitrage alerts, unified portfolio.',
  },
  {
    iconKey: 'reputation',
    title: 'On-Chain Reputation',
    description: 'Verifiable forecaster track records on Solana. Brier scores, calibration curves, tier progression from Rookie to Superforecaster.',
  },
  {
    iconKey: 'pools',
    title: 'Conviction Pools',
    description: 'Capitalists can invest in forecasters, not just predictions. Elite forecasters create pools, attract capital, earn performance fees.',
  },
];

// ===========================================================================
// Product Features Data (§7) - Using same icons as Solutions for consistency
// ===========================================================================

const PRODUCT_FEATURES = [
  {
    iconKey: 'swipe',
    title: 'Swipe Interface (Consumer)',
    description: 'Mobile-first prediction cards with aggregated markets from multiple platforms. Real-time pricing, volume, time remaining. AI edge detection on every card.',
  },
  {
    iconKey: 'agents',
    title: 'AI Agent Fleet (Intelligence)',
    description: 'Multi-agent system with extensive tool integration. Intelligent orchestrator routes queries to specialized agents (Scout, Analyst, Trader, xDegen) based on complexity and intent.',
  },
  {
    iconKey: 'reputation',
    title: 'Forecaster Network (Infrastructure)',
    description: 'On-chain reputation system with Brier score tracking, calibration analysis, tier progression. ForecasterState PDA stores verifiable track records.',
  },
  {
    iconKey: 'pools',
    title: 'Conviction Pools (Capital Delegation)',
    description: 'Elite forecasters create pools with custom fee structures. Capitalists delegate USDC, receive pool shares. 50/30/20 profit split (forecaster/delegators/platform). Idle capital earns 6.4% APY via Sanctum INF.',
  },
  {
    iconKey: 'dataFabric',
    title: 'Data Fabric (Aggregation)',
    description: 'Unified market data with optimized caching from major prediction market platforms including Polymarket, Kalshi, Jupiter, and others. Real-time arbitrage detection.',
  },
];

// ===========================================================================
// Market Stats Data
// ===========================================================================

const MARKET_STATS = [
  { value: '$63.5B', label: '2025 Volume' },
  { value: '$325B+', label: '2026 Projected' },
  { value: '170+', label: 'Ecosystem Tools' },
  { value: '4x', label: 'YoY Growth' },
];

// ===========================================================================
// Growth Chart Data
// ===========================================================================

const GROWTH_DATA = [
  { year: '2024', value: 15.8, label: '$15.8B' },
  { year: '2025', value: 63.5, label: '$63.5B' },
  { year: '2026', value: 325, label: '$325B+' },
];

// ===========================================================================
// Revenue Model Data
// ===========================================================================

const REVENUE_STREAMS = [
  {
    title: 'Transaction Fees',
    value: '1%',
    description: 'On every prediction trade through BeRight',
  },
  {
    title: 'Subscriptions',
    value: '$9.99-$49.99/mo',
    description: 'Pro/Whale tiers with unlimited AI insights',
  },
  {
    title: 'Performance Fee',
    value: '20%',
    description: 'Platform share from Conviction Pools profits (50/30/20 split)',
  },
  {
    title: 'Execution Fee',
    value: '1%',
    description: 'Jupiter referral integration',
  },
];

// ===========================================================================
// Reputation System Data
// ===========================================================================

const DECAY_FORMULA = {
  main: 'BS_decay = \u03A3(weight_i \u00D7 brier_i) / \u03A3 weight_i',
  weight: 'weight_i = e^(-\u03BB \u00D7 t_i)',
  halfLife: 'half-life = ln(2) / \u03BB \u2248 0.693 / \u03BB',
};

const DECAY_PRESETS = [
  { name: 'Conservative', halfLife: '60+ days', lookback: '2 years', useCase: 'Long-term reputation' },
  { name: 'Balanced', halfLife: '30-40 days', lookback: '1 year', useCase: 'Default mode' },
  { name: 'Aggressive', halfLife: '10-20 days', lookback: '180 days', useCase: 'Recent focus' },
  { name: 'Strict', halfLife: '<10 days', lookback: '90 days', useCase: 'High accountability' },
];

const TIER_REQUIREMENTS = [
  { tier: 'Superforecaster', maxBrier: '0.15', minPredictions: '50', minEffective: '20', color: '#10b981' },
  { tier: 'Elite', maxBrier: '0.22', minPredictions: '30', minEffective: '12', color: '#8b5cf6' },
  { tier: 'Verified', maxBrier: '0.28', minPredictions: '15', minEffective: '8', color: '#3b82f6' },
  { tier: 'Rookie', maxBrier: '1.00', minPredictions: '5', minEffective: '3', color: '#6b7280' },
];

// ===========================================================================
// Staking Pool Tiers Data
// ===========================================================================

const POOL_TIERS = [
  { tier: 0, name: 'Starter SOL', capacity: '5 SOL', token: 'SOL', maxBrier: '0.35', minPredictions: 10, minDeposit: '0.1 SOL' },
  { tier: 1, name: 'Basic SOL', capacity: '10 SOL', token: 'SOL', maxBrier: '0.30', minPredictions: 25, minDeposit: '0.1 SOL' },
  { tier: 2, name: 'Starter USDC', capacity: '500 USDC', token: 'USDC', maxBrier: '0.35', minPredictions: 10, minDeposit: '5 USDC' },
  { tier: 3, name: 'Basic USDC', capacity: '1,000 USDC', token: 'USDC', maxBrier: '0.30', minPredictions: 25, minDeposit: '10 USDC' },
  { tier: 4, name: 'Pro SOL', capacity: '100 SOL', token: 'SOL', maxBrier: '0.25', minPredictions: 100, minDeposit: '1 SOL' },
  { tier: 5, name: 'Pro USDC', capacity: '10,000 USDC', token: 'USDC', maxBrier: '0.25', minPredictions: 100, minDeposit: '100 USDC' },
  { tier: 6, name: 'Elite SOL', capacity: '500 SOL', token: 'SOL', maxBrier: '0.20', minPredictions: 250, minDeposit: '5 SOL' },
  { tier: 7, name: 'Elite USDC', capacity: '50,000 USDC', token: 'USDC', maxBrier: '0.20', minPredictions: 250, minDeposit: '500 USDC' },
];

const POOL_CONSTANTS = {
  revenueSplit: { forecaster: 50, delegator: 30, platform: 20 },
  lockupPeriod: '7 days',
  withdrawalFee: '0.5%',
  earlyExitFee: '2%',
  maxPosition: '20%',
  minPosition: '1%',
  creationFee: '0.1 SOL',
};

// ===========================================================================
// ML Pipeline Data
// ===========================================================================

const ML_ALGORITHMS = [
  {
    name: 'Semantic Embedding Model',
    type: 'Embeddings',
    description: 'High-dimensional semantic embeddings for market text matching with sub-second inference times.',
  },
  {
    name: 'Ensemble Classifier',
    type: 'Classification',
    description: 'Combines multiple signals including semantic similarity, entity overlap, and temporal proximity for accurate market matching.',
  },
  {
    name: 'LLM Fallback',
    type: 'Classification',
    description: 'Advanced language model for edge cases requiring deeper reasoning.',
  },
  {
    name: 'Similarity Scoring',
    type: 'Ranking',
    description: 'Measures semantic similarity between normalized vector representations.',
  },
  {
    name: 'Entity Matching',
    type: 'Extraction',
    description: 'Identifies and compares key entities (names, dates, amounts) from market questions.',
  },
  {
    name: 'Verification Layer',
    type: 'Validation',
    description: 'Secondary verification for high-confidence match validation.',
  },
];

// ===========================================================================
// Reusable Callout Component - Standardized styling
// ===========================================================================

interface CalloutProps {
  title: string;
  children: React.ReactNode;
}

function Callout({ title, children }: CalloutProps) {
  return (
    <div className={styles.callout}>
      <p className={styles.calloutTitle}>{title}</p>
      <p className={styles.calloutText}>{children}</p>
    </div>
  );
}

// ===========================================================================
// Growth Chart Component - Animated SVG bar chart
// ===========================================================================

function GrowthChart() {
  const [animated, setAnimated] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animated) {
          setAnimated(true);
        }
      },
      { threshold: 0.3 }
    );

    if (chartRef.current) {
      observer.observe(chartRef.current);
    }

    return () => observer.disconnect();
  }, [animated]);

  const maxValue = 325;
  const chartHeight = 200;
  const barWidth = 60;
  const gap = 40;

  return (
    <div ref={chartRef} className={styles.chartContainer}>
      <h4 className={styles.chartTitle}>Market Volume Growth</h4>
      <svg
        viewBox={`0 0 ${GROWTH_DATA.length * (barWidth + gap) + gap} ${chartHeight + 60}`}
        className={styles.chartSvg}
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
          <line
            key={i}
            x1={gap}
            y1={chartHeight - chartHeight * ratio + 20}
            x2={GROWTH_DATA.length * (barWidth + gap)}
            y2={chartHeight - chartHeight * ratio + 20}
            stroke="rgba(148, 163, 184, 0.1)"
            strokeDasharray="4 4"
          />
        ))}

        {/* Bars */}
        {GROWTH_DATA.map((item, i) => {
          const barHeight = (item.value / maxValue) * chartHeight;
          const x = gap + i * (barWidth + gap);
          const y = chartHeight - barHeight + 20;

          return (
            <g key={item.year}>
              {/* Bar */}
              <rect
                x={x}
                y={animated ? y : chartHeight + 20}
                width={barWidth}
                height={animated ? barHeight : 0}
                rx={4}
                fill="url(#barGradient)"
                className={styles.chartBar}
                style={{
                  transition: `all 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${i * 0.2}s`,
                }}
              />
              {/* Value label */}
              <text
                x={x + barWidth / 2}
                y={animated ? y - 8 : chartHeight + 12}
                textAnchor="middle"
                fill="#10b981"
                fontSize="12"
                fontWeight="600"
                fontFamily="var(--font-mono)"
                className={styles.chartLabel}
                style={{
                  transition: `all 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${i * 0.2}s`,
                  opacity: animated ? 1 : 0,
                }}
              >
                {item.label}
              </text>
              {/* Year label */}
              <text
                x={x + barWidth / 2}
                y={chartHeight + 45}
                textAnchor="middle"
                fill="rgba(148, 163, 184, 0.8)"
                fontSize="13"
                fontWeight="500"
              >
                {item.year}
              </text>
            </g>
          );
        })}

        {/* Gradient definition */}
        <defs>
          <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// ===========================================================================
// Reading Progress Bar Component
// ===========================================================================

function ProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setProgress(Math.min(100, Math.max(0, scrollPercent)));
    };

    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();

    return () => window.removeEventListener('scroll', updateProgress);
  }, []);

  return (
    <div className={styles.progressBarContainer}>
      <div
        className={styles.progressBar}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

// ===========================================================================
// Sticky TOC Sidebar Component (Desktop)
// ===========================================================================

interface StickyTocProps {
  activeSection: string | null;
  onSectionClick: (sectionId: string) => void;
}

function StickyToc({ activeSection, onSectionClick }: StickyTocProps) {
  return (
    <nav className={styles.stickyToc}>
      <p className={styles.stickyTocTitle}>Contents</p>
      <ul className={styles.stickyTocList}>
        {TOC_SECTIONS.map((section) => (
          <li key={section.id}>
            <button
              className={`${styles.stickyTocItem} ${activeSection === section.id ? styles.stickyTocItemActive : ''}`}
              onClick={() => onSectionClick(section.id)}
            >
              <span className={styles.stickyTocNumber}>{section.number}</span>
              <span className={styles.stickyTocLabel}>{section.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ===========================================================================
// Main Litepaper Page
// ===========================================================================

export default function LitepaperPage() {
  const [activeSection, setActiveSection] = useState<string | null>('introduction');

  // Handle scroll to section
  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 100; // Account for sticky header
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - offset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
  }, []);

  // Track active section using IntersectionObserver
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    TOC_SECTIONS.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) {
        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              setActiveSection(section.id);
            }
          },
          {
            rootMargin: '-20% 0px -70% 0px',
            threshold: 0,
          }
        );
        observer.observe(element);
        observers.push(observer);
      }
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, []);

  return (
    <PageWrapper showHeader={false} showFooter={false}>
      {/* Reading Progress Bar */}
      <ProgressBar />

      {/* Hero */}
      <Section variant="gradient" size="lg" className={styles.hero}>
        <Link href="/docs" className={styles.backLink}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Docs
        </Link>

        <h1 className={styles.heroTitle}>BeRight Protocol</h1>
        <p className={styles.heroSubtitle}>Stop Guessing. Start Proving.</p>
        <p className={styles.heroMeta}>Version 2.0 | March 2026</p>

        <div className={styles.heroActions}>
          {/* Read Litepaper is now PRIMARY (user's goal is to read) */}
          <button
            className={`${styles.heroBtn} ${styles.heroBtnPrimary}`}
            onClick={() => scrollToSection('introduction')}
          >
            Read Litepaper
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
          </button>
          {/* GitHub is now SECONDARY (ghost/outlined) */}
          <a
            href="https://github.com/beright/litepaper"
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.heroBtn} ${styles.heroBtnSecondary}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            View on GitHub
          </a>
        </div>
      </Section>

      {/* Table of Contents (Mobile) */}
      <Section size="md" className={styles.tocSectionMobile}>
        <h2 style={{ textAlign: 'center', marginBottom: '24px', fontSize: 'var(--text-xl)' }}>
          Table of Contents
        </h2>
        <div className={styles.tocGrid}>
          {TOC_SECTIONS.map((section) => (
            <button
              key={section.id}
              className={styles.tocItem}
              onClick={() => scrollToSection(section.id)}
            >
              <span className={styles.tocNumber}>{section.number}</span>
              <span className={styles.tocLabel}>{section.label}</span>
              <svg className={styles.tocArrow} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          ))}
        </div>
      </Section>

      {/* Main content wrapper with sticky TOC */}
      <div className={styles.contentWrapper}>
        {/* Sticky TOC (Desktop) */}
        <StickyToc activeSection={activeSection} onSectionClick={scrollToSection} />

        {/* Main content */}
        <div className={styles.mainContent}>
          {/* Section 1: Introduction */}
          <Section id="introduction" className={styles.contentSection}>
            <div className={styles.sectionTitle}>
              <span className={styles.sectionNumber}>1</span>
              <h2 className={styles.sectionHeading}>Introduction</h2>
            </div>
            <div className={styles.sectionContent}>
              <p className={styles.paragraph}>
                Prediction markets have emerged as one of the most powerful mechanisms for aggregating human knowledge about future events. When designed correctly, they consistently outperform polls, expert panels, and statistical models in forecasting everything from election outcomes to economic indicators.
              </p>
              <p className={styles.paragraph}>
                <span className={styles.highlight}>The market has exploded.</span> In 2024, monthly trading volume was under $100M. By late 2025, it exceeded $18B per month—a 180x increase in under two years. Full-year 2025 volume reached $63.5B, with projections of $325B+ for 2026.
              </p>
              <p className={styles.paragraph}>
                Yet despite this growth, prediction markets remain fundamentally broken for two key participants:
              </p>
              <Callout title="For Forecasters">
                There is no way to build a verifiable track record. Skilled predictors cannot prove their ability, cannot attract capital, and cannot monetize their expertise beyond trading their own limited funds.
              </Callout>
              <Callout title="For Capital Allocators">
                There is no way to invest in forecasting skill. Investors who recognize the alpha in prediction markets but lack domain expertise have no mechanism to delegate capital to proven forecasters.
              </Callout>
              <p className={styles.paragraph}>
                <span className={styles.highlight}>BeRight solves both problems.</span> We are building the intelligence and reputation layer for prediction markets—a platform where forecasters build verifiable on-chain track records, and capitalists can invest in proven predictors.
              </p>
            </div>
          </Section>

          {/* Section 2: Prediction Markets */}
          <Section id="prediction-markets" className={styles.contentSection}>
            <div className={styles.sectionTitle}>
              <span className={styles.sectionNumber}>2</span>
              <h2 className={styles.sectionHeading}>Prediction Markets</h2>
            </div>
            <div className={styles.sectionContent}>
              <p className={styles.paragraph}>
                Prediction markets are platforms where participants trade event contracts—financial instruments that resolve to a fixed payout based on the outcome of a future event. In their simplest form, these are binary contracts (Yes/No), where the market price represents the collective implied probability of an outcome.
              </p>
              <p className={styles.paragraph}>
                For example, if a "Yes" contract trades at $0.65, the market is pricing a ~65% probability that the event will occur.
              </p>

              <h3 style={{ marginTop: '32px', marginBottom: '16px' }}>Current Platform Landscape</h3>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Platform</th>
                    <th>Stack</th>
                    <th>2025 Volume</th>
                    <th>Position</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Kalshi</td>
                    <td>Regulated DCM (US)</td>
                    <td>$22.88B</td>
                    <td>Sports leader</td>
                  </tr>
                  <tr>
                    <td>Polymarket</td>
                    <td>Polygon</td>
                    <td>$33.4B</td>
                    <td>$425M TVL</td>
                  </tr>
                  <tr>
                    <td>Jupiter/DFlow</td>
                    <td>Solana</td>
                    <td>$28.6M (Jan)</td>
                    <td>Zero fees, 4x engagement</td>
                  </tr>
                  <tr>
                    <td>Limitless</td>
                    <td>Base (Coinbase L2)</td>
                    <td>Growing</td>
                    <td>Fast iteration</td>
                  </tr>
                  <tr>
                    <td>Manifold</td>
                    <td>Off-chain</td>
                    <td>Play money</td>
                    <td>Experimentation</td>
                  </tr>
                </tbody>
              </table>
              <Callout title="Key Insight">
                Kalshi and Polymarket control ~97.5% of the market, but over 170 third-party tools are extracting value from users who need better infrastructure.
              </Callout>
            </div>
          </Section>

          {/* Section 3: Market Size */}
          <Section id="market-size" className={styles.contentSection}>
            <div className={styles.sectionTitle}>
              <span className={styles.sectionNumber}>3</span>
              <h2 className={styles.sectionHeading}>Market Size & Opportunity</h2>
            </div>
            <div className={styles.sectionContent}>
              <div className={styles.statsGrid}>
                {MARKET_STATS.map((stat) => (
                  <div key={stat.label} className={styles.statCard}>
                    <p className={styles.statValue}>{stat.value}</p>
                    <p className={styles.statLabel}>{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Growth Chart */}
              <GrowthChart />

              <h3 style={{ marginTop: '32px', marginBottom: '16px' }}>Growth Trajectory</h3>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Volume</th>
                    <th>Growth</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>2024</td>
                    <td>$15.8B</td>
                    <td>Baseline</td>
                  </tr>
                  <tr>
                    <td>2025</td>
                    <td>$63.5B</td>
                    <td style={{ color: 'var(--color-primary)' }}>4x YoY</td>
                  </tr>
                  <tr>
                    <td>2026 (projected)</td>
                    <td>$325B+</td>
                    <td style={{ color: 'var(--color-primary)' }}>5x YoY</td>
                  </tr>
                </tbody>
              </table>

              <Callout title="Mainstream Catalysts">
                Robinhood traded 12 billion event contracts in 2025. Jupiter Prediction Markets launched with zero payout fees on Solana. Kalshi valuation doubled from $11B to $22B in 4 months.
              </Callout>
            </div>
          </Section>

          {/* Section 4: Problem */}
          <Section id="problem" className={styles.contentSection}>
            <div className={styles.sectionTitle}>
              <span className={styles.sectionNumber}>4</span>
              <h2 className={styles.sectionHeading}>The Problem</h2>
            </div>
            <div className={styles.sectionContent}>
              <p className={styles.paragraph}>
                Despite explosive growth, prediction markets suffer from critical problems that limit participation and extract value from users.
              </p>

              <div className={styles.solutionsList}>
                <div className={styles.solutionItem}>
                  <div className={styles.solutionHeader}>
                    <div className={styles.solutionIcon}>1</div>
                    <h3 className={styles.solutionTitle}>Information Asymmetry</h3>
                  </div>
                  <p className={styles.solutionDesc}>
                    Users lose at both ends. Finance markets show 0.17 percentage point maker-taker gap, while entertainment markets show 7+ points. Market makers extract value without correct predictions.
                  </p>
                </div>

                <div className={styles.solutionItem}>
                  <div className={styles.solutionHeader}>
                    <div className={styles.solutionIcon}>2</div>
                    <h3 className={styles.solutionTitle}>Research Fragmentation</h3>
                  </div>
                  <p className={styles.solutionDesc}>
                    Users manually research across multiple platforms, burning 30+ minutes per trade. Open tabs for Polymarket, Kalshi, Manifold, Jupiter, plus news sources.
                  </p>
                </div>

                <div className={styles.solutionItem}>
                  <div className={styles.solutionHeader}>
                    <div className={styles.solutionIcon}>3</div>
                    <h3 className={styles.solutionTitle}>Broken Infrastructure</h3>
                  </div>
                  <p className={styles.solutionDesc}>
                    Polymarket's SDK has 82+ unresolved GitHub issues. Authentication failures, balance bugs, WebSocket silent failures. Developers burn real money testing.
                  </p>
                </div>

                <div className={styles.solutionItem}>
                  <div className={styles.solutionHeader}>
                    <div className={styles.solutionIcon}>4</div>
                    <h3 className={styles.solutionTitle}>No Reputation Infrastructure</h3>
                  </div>
                  <p className={styles.solutionDesc}>
                    Skilled forecasters cannot prove their ability. Platforms track wins/losses internally but don't share. A forecaster's Polymarket record is invisible on Kalshi.
                  </p>
                </div>

                <div className={styles.solutionItem}>
                  <div className={styles.solutionHeader}>
                    <div className={styles.solutionIcon}>5</div>
                    <h3 className={styles.solutionTitle}>No Portfolio or Tax Management</h3>
                  </div>
                  <p className={styles.solutionDesc}>
                    No consolidated positions across markets. CPAs charging $500+/hr for manual tax calculations. Depositing easy, withdrawing "nearly impossible."
                  </p>
                </div>
              </div>
            </div>
          </Section>

          {/* Section 5: Solution */}
          <Section id="solution" className={styles.contentSection}>
            <div className={styles.sectionTitle}>
              <span className={styles.sectionNumber}>5</span>
              <h2 className={styles.sectionHeading}>The Solution</h2>
            </div>
            <div className={styles.sectionContent}>
              <p className={styles.paragraph}>
                BeRight solves these problems through an integrated platform combining consumer UX, AI intelligence, and on-chain reputation infrastructure.
              </p>

              <div className={styles.solutionsList}>
                {SOLUTIONS.map((solution) => (
                  <div key={solution.title} className={styles.solutionItem}>
                    <div className={styles.solutionHeader}>
                      <div className={styles.solutionIconEmoji}>{LitepaperIcons[solution.iconKey]}</div>
                      <h3 className={styles.solutionTitle}>{solution.title}</h3>
                    </div>
                    <p className={styles.solutionDesc}>{solution.description}</p>
                  </div>
                ))}
              </div>

              <Callout title="Our Thesis">
                Forecasting skill is an asset class. BeRight creates the infrastructure to make it tradeable.
              </Callout>
            </div>
          </Section>

          {/* Section 6: Competitive Landscape */}
          <Section id="competitive" className={styles.contentSection}>
            <div className={styles.sectionTitle}>
              <span className={styles.sectionNumber}>6</span>
              <h2 className={styles.sectionHeading}>Competitive Landscape</h2>
            </div>
            <div className={styles.sectionContent}>
              <p className={styles.paragraph}>
                The prediction market ecosystem has matured from "platform-building" (2024) to "tooling-building" (2026). Over 170 third-party products extract value from users. Estimated ecosystem revenue: $15-50M annually.
              </p>

              <h3 style={{ marginTop: '32px', marginBottom: '16px' }}>What No Competitor Has</h3>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Polymarket</th>
                    <th>Kalshi</th>
                    <th>BeRight</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Mobile-First Swipe UI</td>
                    <td>No</td>
                    <td>No</td>
                    <td style={{ color: 'var(--color-primary)' }}>Yes (unique)</td>
                  </tr>
                  <tr>
                    <td>AI Edge Detection</td>
                    <td>None</td>
                    <td>None</td>
                    <td style={{ color: 'var(--color-primary)' }}>Built-in</td>
                  </tr>
                  <tr>
                    <td>One-Line Insights</td>
                    <td>None</td>
                    <td>None</td>
                    <td style={{ color: 'var(--color-primary)' }}>Yes (unique)</td>
                  </tr>
                  <tr>
                    <td>Cross-Platform</td>
                    <td>Single</td>
                    <td>Single</td>
                    <td style={{ color: 'var(--color-primary)' }}>Multi-platform</td>
                  </tr>
                  <tr>
                    <td>On-Chain Reputation</td>
                    <td>None</td>
                    <td>None</td>
                    <td style={{ color: 'var(--color-primary)' }}>Solana PDAs</td>
                  </tr>
                  <tr>
                    <td>Conviction Pools</td>
                    <td>None</td>
                    <td>None</td>
                    <td style={{ color: 'var(--color-primary)' }}>DeFi primitive</td>
                  </tr>
                </tbody>
              </table>

              <Callout title="Positioning">
                BeRight is not a prediction market. We do not compete with Polymarket or Kalshi for order flow. BeRight is the intelligence and capital layer that makes prediction markets more valuable.
              </Callout>
            </div>
          </Section>

          {/* Section 7: Product - Now using emoji icons like §5 */}
          <Section id="product" className={styles.contentSection}>
            <div className={styles.sectionTitle}>
              <span className={styles.sectionNumber}>7</span>
              <h2 className={styles.sectionHeading}>BeRight Product</h2>
            </div>
            <div className={styles.sectionContent}>
              <div className={styles.solutionsList}>
                {PRODUCT_FEATURES.map((feature) => (
                  <div key={feature.title} className={styles.solutionItem}>
                    <div className={styles.solutionHeader}>
                      <div className={styles.solutionIconEmoji}>{LitepaperIcons[feature.iconKey]}</div>
                      <h3 className={styles.solutionTitle}>{feature.title}</h3>
                    </div>
                    <p className={styles.solutionDesc}>{feature.description}</p>
                  </div>
                ))}
              </div>

              <h3 style={{ marginTop: '32px', marginBottom: '16px' }}>Technology Stack</h3>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Layer</th>
                    <th>Technology</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>AI/LLM</td><td>Advanced LLMs with intelligent routing</td></tr>
                  <tr><td>Fact-Check</td><td>Real-time verification and synthesis</td></tr>
                  <tr><td>Frontend</td><td>Next.js 16, React 19, TypeScript</td></tr>
                  <tr><td>Blockchain</td><td>Solana, Anchor programs</td></tr>
                  <tr><td>Wallet</td><td>Privy (abstracted onboarding)</td></tr>
                  <tr><td>DEX</td><td>Jupiter (execution), Meteora (liquidity)</td></tr>
                  <tr><td>Yield</td><td>Sanctum INF (idle capital)</td></tr>
                </tbody>
              </table>

              <h3 style={{ marginTop: '32px', marginBottom: '16px' }}>ML Pipeline</h3>
              <p className={styles.paragraph}>
                Our market matching and classification system uses a multi-stage ML pipeline for accurate cross-platform market identification.
              </p>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Algorithm</th>
                    <th>Type</th>
                    <th>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {ML_ALGORITHMS.map((algo) => (
                    <tr key={algo.name}>
                      <td style={{ fontWeight: 600 }}>{algo.name}</td>
                      <td>{algo.type}</td>
                      <td style={{ fontSize: 'var(--text-xs)' }}>{algo.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Callout title="Research Foundation">
                Our matching methodology is built on academic research in semantic similarity, adapted and optimized for prediction market semantics with custom entity extraction for dates, names, and numerical thresholds.
              </Callout>
            </div>
          </Section>

          {/* Section 8: Reputation System */}
          <Section id="reputation" className={styles.contentSection}>
            <div className={styles.sectionTitle}>
              <span className={styles.sectionNumber}>8</span>
              <h2 className={styles.sectionHeading}>Reputation System</h2>
            </div>
            <div className={styles.sectionContent}>
              <p className={styles.paragraph}>
                BeRight implements a sophisticated on-chain reputation system using the <span className={styles.highlight}>Brier Score</span> with exponential time decay. This ensures forecasters are judged on recent performance, not historical accuracy that may no longer be relevant.
              </p>

              <h3 style={{ marginTop: '32px', marginBottom: '16px' }}>Brier Score Fundamentals</h3>
              <p className={styles.paragraph}>
                The Brier Score measures forecast accuracy on a 0-1 scale where <strong>lower is better</strong>. A score of 0 means perfect predictions, while 0.25 equals random guessing.
              </p>
              <div className={styles.formulaBox}>
                <code className={styles.formula}>Brier = (forecast_probability - actual_outcome)²</code>
                <p className={styles.formulaExample}>Example: Predicted 65% YES, outcome was NO → Brier = (0.65 - 0)² = 0.4225</p>
              </div>

              <h3 style={{ marginTop: '32px', marginBottom: '16px' }}>Decaying Brier Score</h3>
              <p className={styles.paragraph}>
                We apply exponential decay weighting so recent predictions matter more than older ones. This prevents forecasters who were accurate in the past but inaccurate recently from maintaining artificially high reputation.
              </p>
              <div className={styles.formulaBox}>
                <code className={styles.formula}>{DECAY_FORMULA.main}</code>
                <code className={styles.formula}>{DECAY_FORMULA.weight}</code>
                <code className={styles.formula}>{DECAY_FORMULA.halfLife}</code>
              </div>

              <h3 style={{ marginTop: '32px', marginBottom: '16px' }}>Decay Configurations</h3>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Mode</th>
                    <th>Half-Life</th>
                    <th>Lookback</th>
                    <th>Use Case</th>
                  </tr>
                </thead>
                <tbody>
                  {DECAY_PRESETS.map((preset) => (
                    <tr key={preset.name}>
                      <td>{preset.name}</td>
                      <td>{preset.halfLife}</td>
                      <td>{preset.lookback}</td>
                      <td>{preset.useCase}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3 style={{ marginTop: '32px', marginBottom: '16px' }}>Forecaster Tiers</h3>
              <p className={styles.paragraph}>
                Forecasters progress through tiers based on their decaying Brier score and prediction volume. Higher tiers unlock larger pool capacities.
              </p>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Tier</th>
                    <th>Max Brier</th>
                    <th>Min Predictions</th>
                    <th>Effective Sample</th>
                  </tr>
                </thead>
                <tbody>
                  {TIER_REQUIREMENTS.map((tier) => (
                    <tr key={tier.tier}>
                      <td style={{ color: tier.color, fontWeight: 600 }}>{tier.tier}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>\u2264 {tier.maxBrier}</td>
                      <td>{tier.minPredictions}+</td>
                      <td>{tier.minEffective}+</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Callout title="On-Chain Storage">
                All predictions are recorded immutably on Solana via custom Anchor programs. ForecasterState PDAs store cumulative Brier scores, calibration buckets, and performance streaks with full transparency and verifiability.
              </Callout>
            </div>
          </Section>

          {/* Section 9: Staking Pools */}
          <Section id="staking-pools" className={styles.contentSection}>
            <div className={styles.sectionTitle}>
              <span className={styles.sectionNumber}>9</span>
              <h2 className={styles.sectionHeading}>Conviction Pools</h2>
            </div>
            <div className={styles.sectionContent}>
              <p className={styles.paragraph}>
                The first <span className={styles.highlight}>skill-backed delegation primitive</span> in DeFi. Elite forecasters with proven Brier scores create pools, attract capital, and earn performance fees. Based on battle-tested models from Jito, Marinade, and Sanctum.
              </p>

              {/* Profit Split - 50/30/20 */}
              <h3 style={{ marginTop: '32px', marginBottom: '16px' }}>Profit Distribution (50/30/20 Model)</h3>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <p className={styles.statValue}>{POOL_CONSTANTS.revenueSplit.forecaster}%</p>
                  <p className={styles.statLabel}>Forecaster</p>
                  <p style={{ fontSize: '11px', color: 'rgba(148, 163, 184, 0.8)', marginTop: '4px' }}>Strong incentive</p>
                </div>
                <div className={styles.statCard}>
                  <p className={styles.statValue}>{POOL_CONSTANTS.revenueSplit.delegator}%</p>
                  <p className={styles.statLabel}>Delegators</p>
                  <p style={{ fontSize: '11px', color: 'rgba(148, 163, 184, 0.8)', marginTop: '4px' }}>Stays in pool</p>
                </div>
                <div className={styles.statCard}>
                  <p className={styles.statValue}>{POOL_CONSTANTS.revenueSplit.platform}%</p>
                  <p className={styles.statLabel}>Platform</p>
                  <p style={{ fontSize: '11px', color: 'rgba(148, 163, 184, 0.8)', marginTop: '4px' }}>Treasury</p>
                </div>
              </div>

              {/* Exchange Rate Formula */}
              <h3 style={{ marginTop: '32px', marginBottom: '16px' }}>Exchange Rate Appreciation Model</h3>
              <div className={styles.formulaBox}>
                <code className={styles.formula}>exchange_rate = (total_capital + profits) / total_shares</code>
                <code className={styles.formula}>shares_minted = deposit_amount / exchange_rate</code>
                <code className={styles.formula}>amount_returned = shares_burned × exchange_rate</code>
              </div>

              {/* Reward Calculation Example */}
              <h3 style={{ marginTop: '32px', marginBottom: '16px' }}>Reward Calculation Example</h3>
              <Callout title="Scenario: 10,000 USDC Pool with 20% Return">
                <strong>Initial State:</strong><br/>
                • 10,000 USDC deposited → 10,000 shares minted<br/>
                • Exchange rate: 1.0<br/><br/>

                <strong>After +20% profit (2,000 USDC):</strong><br/>
                • Forecaster gets: 50% × 2,000 = <span style={{color: '#10b981'}}>1,000 USDC</span> (direct payout)<br/>
                • Delegators get: 30% × 2,000 = <span style={{color: '#10b981'}}>600 USDC</span> (stays in pool)<br/>
                • Platform gets: 20% × 2,000 = 400 USDC<br/><br/>

                <strong>New Exchange Rate:</strong><br/>
                • Total capital: 10,600 USDC (10,000 + 600)<br/>
                • Total shares: 10,000 (unchanged)<br/>
                • <span style={{color: '#10b981', fontWeight: 600}}>exchange_rate = 1.06 (+6% for delegators)</span><br/><br/>

                <strong>Delegator who deposited 1,000 USDC:</strong><br/>
                • Owns 1,000 shares<br/>
                • Value = 1,000 × 1.06 = <span style={{color: '#10b981', fontWeight: 600}}>1,060 USDC (+6% return)</span>
              </Callout>

              {/* Pool Tiers - Simplified to 4 key tiers */}
              <h3 style={{ marginTop: '32px', marginBottom: '16px' }}>Pool Tiers</h3>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Tier</th>
                    <th>Capacity</th>
                    <th>Max Brier</th>
                    <th>Min Predictions</th>
                    <th>Requirements</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Starter</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>5 SOL / 500 USDC</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: '#6b7280' }}>&lt; 0.35</td>
                    <td>10+</td>
                    <td style={{ fontSize: '12px' }}>Entry tier</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Basic</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>10 SOL / 1,000 USDC</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: '#3b82f6' }}>&lt; 0.30</td>
                    <td>25+</td>
                    <td style={{ fontSize: '12px' }}>Consistent accuracy</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Pro</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>100 SOL / 10,000 USDC</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: '#8b5cf6' }}>&lt; 0.25</td>
                    <td>100+</td>
                    <td style={{ fontSize: '12px' }}>Professional grade</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600, color: '#10b981' }}>Elite</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: '#10b981' }}>500 SOL / 50,000 USDC</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: '#10b981' }}>&lt; 0.20</td>
                    <td style={{ color: '#10b981' }}>250+</td>
                    <td style={{ fontSize: '12px', color: '#10b981' }}>Superforecaster</td>
                  </tr>
                </tbody>
              </table>

              {/* Risk Management */}
              <h3 style={{ marginTop: '32px', marginBottom: '16px' }}>Risk Management</h3>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <p className={styles.statValue}>1-20%</p>
                  <p className={styles.statLabel}>Position Limits</p>
                </div>
                <div className={styles.statCard}>
                  <p className={styles.statValue}>7 days</p>
                  <p className={styles.statLabel}>Lockup Period</p>
                </div>
                <div className={styles.statCard}>
                  <p className={styles.statValue}>6.4% APY</p>
                  <p className={styles.statLabel}>Idle Yield (Sanctum)</p>
                </div>
                <div className={styles.statCard}>
                  <p className={styles.statValue}>0.5%</p>
                  <p className={styles.statLabel}>Withdrawal Fee</p>
                </div>
              </div>

              <Callout title="On-Chain Transparency">
                All Conviction Pools run on audited Solana smart contracts with full transparency. Every prediction, profit distribution, and share price update is recorded immutably on-chain. The 50/30/20 profit split ensures perfect alignment between forecasters and delegators. Conditional performance fees mean forecasters only earn when they maintain their tier's quality threshold.
              </Callout>
            </div>
          </Section>

          {/* Section 10: Business Model */}
          <Section id="business-model" className={styles.contentSection}>
            <div className={styles.sectionTitle}>
              <span className={styles.sectionNumber}>10</span>
              <h2 className={styles.sectionHeading}>Business Model</h2>
            </div>
            <div className={styles.sectionContent}>
              <div className={styles.revenueGrid}>
                {REVENUE_STREAMS.map((stream) => (
                  <div key={stream.title} className={styles.revenueCard}>
                    <p className={styles.revenueTitle}>{stream.title}</p>
                    <p className={styles.revenueValue}>{stream.value}</p>
                    <p className={styles.revenueDesc}>{stream.description}</p>
                  </div>
                ))}
              </div>

              <h3 style={{ marginTop: '32px', marginBottom: '16px' }}>Subscription Tiers</h3>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Tier</th>
                    <th>Price</th>
                    <th>Features</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Free</td>
                    <td>$0</td>
                    <td>10 AI insights/day, basic portfolio</td>
                  </tr>
                  <tr>
                    <td>Pro</td>
                    <td>$9.99/mo</td>
                    <td>Unlimited insights, real-time alerts, arbitrage</td>
                  </tr>
                  <tr>
                    <td>Whale</td>
                    <td>$49.99/mo</td>
                    <td>API access, whale tracking, custom alerts</td>
                  </tr>
                  <tr>
                    <td>Enterprise</td>
                    <td>Custom</td>
                    <td>Dedicated feeds, white-label, institutional</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* Section 11: Conclusion */}
          <Section id="conclusion" className={styles.contentSection}>
            <div className={styles.sectionTitle}>
              <span className={styles.sectionNumber}>11</span>
              <h2 className={styles.sectionHeading}>Conclusion</h2>
            </div>
            <div className={styles.sectionContent}>
              <p className={styles.paragraph}>
                Prediction markets are the fastest-growing segment of DeFi, but they remain broken for the people who matter most: forecasters who can't prove their skill, and capitalists who can't access forecasting alpha.
              </p>
              <p className={styles.paragraph}>
                BeRight fixes this by building the missing layers: AI-powered edge detection for faster decisions, on-chain reputation for verifiable track records, and Conviction Pools for capital delegation.
              </p>
              <Callout title="Our Thesis">
                Forecasting skill is an asset class. The market is $63.5B and growing 4x annually. BeRight creates the infrastructure to make forecasting skill investable—and we're building it on Solana with AI-native tools.
              </Callout>
              <p className={styles.paragraph} style={{ textAlign: 'center', marginTop: '32px' }}>
                <span className={styles.highlight} style={{ fontSize: 'var(--text-xl)' }}>
                  Stop guessing. Start proving.
                </span>
              </p>
            </div>
          </Section>

          {/* Footer CTA */}
          <Section variant="gradient" className={styles.footerCta}>
            <h2 className={styles.footerTitle}>Ready to BeRight?</h2>
            <p className={styles.footerSubtitle}>Join the prediction market intelligence revolution</p>
            <div className={styles.footerButtons}>
              <Link
                href="/beright-terminal"
                className={`${styles.footerBtn} ${styles.footerBtnPrimary}`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 17l6-6-6-6M12 19h8" />
                </svg>
                Open Terminal
              </Link>
              <a
                href="https://x.com/AgentBEright"
                className={`${styles.footerBtn} ${styles.footerBtnSecondary}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Follow @AgentBEright
              </a>
              <Link href="/docs" className={`${styles.footerBtn} ${styles.footerBtnSecondary}`}>
                Back to Docs
              </Link>
            </div>
          </Section>
        </div>
      </div>
    </PageWrapper>
  );
}
