'use client';

import { useUser } from '@/hooks/useUnifiedUser';
import BrandLogo from './BrandLogo';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// BERIGHT LANDING PAGE - Premium Prediction Markets Intelligence
// Streamlined narrative: Problem → Intelligence → Network → Action
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────────

const TICKER_ITEMS = [
  { type: 'win', user: '@oracle_mind', amount: '+$4,200', market: 'Fed Cuts' },
  { type: 'arb', spread: '7.2%', market: 'ETH $5K', platforms: 'Poly→Kalshi' },
  { type: 'price', market: 'BTC $150K', price: '34c' },
  { type: 'win', user: '@quant_alpha', amount: '+$2,800', market: 'SOL ETF' },
  { type: 'resolved', market: 'Trump 2024', result: 'YES' },
  { type: 'new', market: 'AGI before 2027?', volume: '$2.1M' },
];

// Network visualization data
const NETWORK_NODES = [
  { id: 'oracle', label: '@oracle_mind', brier: 0.124, tier: 'ELITE', x: 50, y: 25, size: 44 },
  { id: 'quant', label: '@quant_alpha', brier: 0.156, tier: 'ELITE', x: 78, y: 45, size: 38 },
  { id: 'sage', label: '@market_sage', brier: 0.182, tier: 'VERIFIED', x: 22, y: 50, size: 32 },
  { id: 'data', label: '@data_mind', brier: 0.195, tier: 'VERIFIED', x: 65, y: 72, size: 28 },
  { id: 'edge', label: '@edge_hunter', brier: 0.218, tier: 'ROOKIE', x: 38, y: 78, size: 24 },
  { id: 'pool1', label: 'SOL Pool', isPool: true, x: 88, y: 22, size: 48, tvl: '$125K' },
  { id: 'pool2', label: 'Macro Pool', isPool: true, x: 12, y: 30, size: 40, tvl: '$82K' },
];

const NETWORK_EDGES = [
  { from: 'oracle', to: 'pool1', strength: 0.9 },
  { from: 'quant', to: 'pool1', strength: 0.7 },
  { from: 'sage', to: 'pool2', strength: 0.8 },
  { from: 'oracle', to: 'quant', strength: 0.3 },
  { from: 'sage', to: 'data', strength: 0.4 },
];

// ─────────────────────────────────────────────────────────────────────────────────
// SECTION 1: NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────────

function Navigation() {
  const { login, isLoading } = useUser();
  const ready = !isLoading;

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-[var(--color-border)] bg-[var(--color-bg-base)]/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 group cursor-pointer">
          <BrandLogo size={28} />
          <span className="font-semibold text-lg sm:text-xl tracking-tight text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
            BeRight
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[var(--color-text-muted)]">
          <Link href="/docs" className="hover:text-[var(--color-text-primary)] transition-colors">Docs</Link>
          <Link href="/docs/faq" className="hover:text-[var(--color-text-primary)] transition-colors">FAQ</Link>
        </div>

        <button
          onClick={login}
          disabled={!ready}
          className="flex items-center gap-1.5 sm:gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] px-3 sm:px-5 py-2 sm:py-2.5 rounded-full transition-all font-semibold text-xs sm:text-sm text-[var(--color-bg-base)] disabled:opacity-50 cursor-pointer shadow-[var(--shadow-glow-primary)]"
        >
          <svg className="w-4 h-4 hidden sm:block" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <path d="M22 10H18C16.9 10 16 10.9 16 12C16 13.1 16.9 14 18 14H22" />
          </svg>
          <span>Start Predicting</span>
        </button>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// SECTION 2: LIVE TICKER
// ─────────────────────────────────────────────────────────────────────────────────

function LiveTicker() {
  const renderItem = (item: typeof TICKER_ITEMS[0], index: number) => {
    switch (item.type) {
      case 'win':
        return (
          <span key={index} className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <span className="text-[var(--color-primary)]">+</span>
            <span className="text-[var(--color-text-secondary)]">{item.user}</span>
            <span className="text-[var(--color-primary)] font-semibold">{item.amount}</span>
            <span className="text-[var(--color-text-ghost)]">on {item.market}</span>
          </span>
        );
      case 'arb':
        return (
          <span key={index} className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--color-warning-dim)] text-[var(--color-warning)] border border-[var(--color-warning)]/30">ARB</span>
            <span className="text-[var(--color-warning)] font-semibold">{item.spread}</span>
            <span className="text-[var(--color-text-muted)]">{item.market}</span>
            <span className="text-[var(--color-text-ghost)]">{item.platforms}</span>
          </span>
        );
      case 'resolved':
        return (
          <span key={index} className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <span className="text-[var(--color-primary)]">RESOLVED</span>
            <span>{item.market}</span>
            <span className="text-[var(--color-primary)] font-semibold">{item.result}</span>
          </span>
        );
      case 'price':
        return (
          <span key={index} className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <span className="text-[var(--color-text-secondary)]">{item.market}</span>
            <span className="text-[var(--color-gold)] font-semibold">{item.price}</span>
          </span>
        );
      case 'new':
        return (
          <span key={index} className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--color-secondary-dim)] text-[var(--color-secondary)]">NEW</span>
            <span className="text-[var(--color-text-primary)]">{item.market}</span>
            <span className="text-[var(--color-text-ghost)]">{item.volume}</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="mt-14 sm:mt-16 w-full border-b border-[var(--color-border)] bg-[var(--color-bg-surface-1)]/50 overflow-hidden relative">
      <div className="absolute top-0 left-0 w-12 sm:w-24 h-full bg-gradient-to-r from-[var(--color-bg-base)] to-transparent z-10" />
      <div className="absolute top-0 right-0 w-12 sm:w-24 h-full bg-gradient-to-l from-[var(--color-bg-base)] to-transparent z-10" />

      <div className="flex whitespace-nowrap py-2.5 sm:py-3 animate-marquee hover:[animation-play-state:paused]">
        <div className="flex gap-6 sm:gap-10 px-4 font-mono text-[10px] sm:text-xs items-center">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <div key={i} className="flex items-center gap-10">
              {renderItem(item, i)}
              <span className="w-1 h-1 bg-[var(--color-border-hover)] rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// SECTION 3: HERO - Problem + Solution in One
// ─────────────────────────────────────────────────────────────────────────────────

function HeroSection() {
  const { login } = useUser();

  return (
    <section className="relative pt-12 sm:pt-20 pb-16 sm:pb-24 px-4 sm:px-6 overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[800px] h-[300px] sm:h-[600px] bg-[var(--color-primary)]/8 rounded-full blur-[100px] sm:blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[200px] sm:w-[400px] h-[200px] sm:h-[400px] bg-[var(--color-secondary)]/5 rounded-full blur-[60px] sm:blur-[100px] pointer-events-none" />

      <div className="max-w-5xl mx-auto text-center relative z-10">
        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-[var(--color-primary-dim)] border border-[var(--color-primary)]/20 mb-6 sm:mb-8">
          <span className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-[var(--color-primary)] animate-pulse" />
          <span className="text-[10px] sm:text-xs font-mono uppercase tracking-wider text-[var(--color-primary)]">Live on Solana Devnet</span>
        </div>

        {/* Headline */}
        <h1 className="text-[2.75rem] sm:text-6xl md:text-8xl lg:text-9xl font-black leading-[0.9] tracking-tight mb-6 sm:mb-8">
          <span className="text-[var(--color-text-primary)]">Be Right.</span>
          <br />
          <span className="bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-gold)] to-[var(--color-primary)] bg-clip-text text-transparent">
            Get Paid.
          </span>
        </h1>

        <p className="text-base sm:text-lg md:text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2">
          AI-powered prediction markets. On-chain reputation.
          <span className="text-[var(--color-text-primary)] font-medium"> Turn your forecasting skill into income.</span>
        </p>

        {/* Value Props Row */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-8 sm:mb-12 px-2">
          <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-[var(--color-bg-surface-1)] border border-[var(--color-border)]">
            <svg className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-xs sm:text-sm text-[var(--color-text-secondary)]">3s AI research</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-[var(--color-bg-surface-1)] border border-[var(--color-border)]">
            <svg className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[var(--color-warning)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-xs sm:text-sm text-[var(--color-text-secondary)]">7%+ arb</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-[var(--color-bg-surface-1)] border border-[var(--color-border)]">
            <svg className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[var(--color-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="text-xs sm:text-sm text-[var(--color-text-secondary)]">On-chain</span>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={login}
          className="inline-flex items-center gap-2 sm:gap-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] px-6 sm:px-8 py-3 sm:py-4 rounded-full transition-all font-bold text-base sm:text-lg text-[var(--color-bg-base)] cursor-pointer shadow-[var(--shadow-glow-primary-lg)] hover:shadow-[0_0_60px_var(--color-primary-glow)]"
        >
          <span>Start Predicting</span>
          <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </button>

        <p className="mt-4 text-[10px] sm:text-xs text-[var(--color-text-ghost)] font-mono">
          No KYC • Non-custodial • You control your funds
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// SECTION 4: MARKET STATS BAR - Trust Signals
// ─────────────────────────────────────────────────────────────────────────────────

function MarketStatsBar() {
  return (
    <section className="border-y border-[var(--color-border)] bg-[var(--color-bg-surface-1)]/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center md:justify-between items-center gap-3 sm:gap-6 md:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 col-span-2 sm:col-span-1 justify-center sm:justify-start">
            <div className="w-5 sm:w-6 h-5 sm:h-6 rounded-full bg-gradient-to-tr from-[#9945FF] to-[#14F195]" />
            <span className="font-bold tracking-wide text-sm sm:text-base text-[var(--color-text-primary)]">SOLANA</span>
          </div>
          <div className="h-4 w-px bg-[var(--color-border)] hidden md:block" />
          <div className="font-mono text-xs sm:text-sm text-center sm:text-left">
            <span className="text-[var(--color-text-primary)] font-bold">$63.5B</span>
            <span className="text-[var(--color-text-ghost)] ml-1 hidden sm:inline">2025 Vol</span>
          </div>
          <div className="h-4 w-px bg-[var(--color-border)] hidden md:block" />
          <div className="font-mono text-xs sm:text-sm text-center sm:text-left">
            <span className="text-[var(--color-primary)] font-bold">4x</span>
            <span className="text-[var(--color-text-ghost)] ml-1 hidden sm:inline">YoY</span>
          </div>
          <div className="h-4 w-px bg-[var(--color-border)] hidden md:block" />
          <div className="font-mono text-xs sm:text-sm text-center sm:text-left">
            <span className="text-[var(--color-text-primary)]">6+</span>
            <span className="text-[var(--color-text-ghost)] ml-1">Platforms</span>
          </div>
          <div className="h-4 w-px bg-[var(--color-border)] hidden md:block" />
          <div className="font-mono text-xs sm:text-sm text-[var(--color-primary)] flex items-center gap-1.5 sm:gap-2 justify-center sm:justify-start col-span-2 sm:col-span-1">
            <svg className="w-3.5 sm:w-4 h-3.5 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="hidden sm:inline">On-chain Verified</span>
            <span className="sm:hidden">Verified</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// SECTION 5: AI SIGNAL + NETWORK VISUALIZATION (Combined)
// ─────────────────────────────────────────────────────────────────────────────────

function IntelligenceSection() {
  const [animationPhase, setAnimationPhase] = useState(0);
  const [activeAgent, setActiveAgent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationPhase(prev => (prev + 1) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveAgent(prev => (prev + 1) % 3);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'ELITE': return 'var(--color-primary)';
      case 'VERIFIED': return 'var(--color-gold)';
      case 'ROOKIE': return 'var(--color-secondary)';
      default: return 'var(--color-text-ghost)';
    }
  };

  const agents = [
    { name: 'Scout', model: 'Sonnet', latency: '<2s', desc: 'Market scan & arbitrage detection', color: 'var(--color-primary)' },
    { name: 'Analyst', model: 'Opus', latency: '5-15s', desc: 'Deep research & probability estimation', color: 'var(--color-secondary)' },
    { name: 'Trader', model: 'Sonnet', latency: '3s', desc: 'Risk checks & position sizing', color: 'var(--color-gold)' },
  ];

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-bg-base)] via-[var(--color-secondary)]/3 to-[var(--color-bg-base)] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section Header */}
        <div className="text-center mb-10 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-secondary-dim)] border border-[var(--color-secondary)]/20 mb-4 sm:mb-6">
            <span className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-[var(--color-secondary)] animate-pulse" />
            <span className="text-[10px] sm:text-xs font-mono uppercase tracking-wider text-[var(--color-secondary)]">Multi-Agent Intelligence</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-3 sm:mb-4 text-[var(--color-text-primary)]">
            Your Edge. <span className="text-[var(--color-secondary)]">Automated.</span>
          </h2>
          <p className="text-[var(--color-text-secondary)] text-sm sm:text-lg max-w-2xl mx-auto px-2">
            Three specialized AI agents work together. 30 minutes of research in 3 seconds.
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 items-stretch">
          {/* Left: AI Agents */}
          <div className="space-y-3 sm:space-y-4">
            {agents.map((agent, index) => (
              <div
                key={agent.name}
                className={`relative rounded-xl sm:rounded-2xl p-4 sm:p-5 transition-all duration-500 cursor-pointer border ${
                  activeAgent === index
                    ? 'bg-[var(--color-bg-surface-2)] border-[var(--color-border-hover)]'
                    : 'bg-[var(--color-bg-surface-1)] border-[var(--color-border)] hover:border-[var(--color-border-hover)]'
                }`}
                style={{
                  boxShadow: activeAgent === index ? `0 0 40px ${agent.color}15` : undefined
                }}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  {/* Agent Icon */}
                  <div
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center transition-all flex-shrink-0"
                    style={{
                      backgroundColor: activeAgent === index ? `${agent.color}20` : 'var(--color-bg-surface-2)',
                      border: `1px solid ${activeAgent === index ? agent.color : 'var(--color-border)'}40`
                    }}
                  >
                    {index === 0 && (
                      <svg className="w-6 h-6" style={{ color: agent.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    )}
                    {index === 1 && (
                      <svg className="w-6 h-6" style={{ color: agent.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    )}
                    {index === 2 && (
                      <svg className="w-6 h-6" style={{ color: agent.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    )}
                  </div>

                  {/* Agent Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-sm sm:text-base text-[var(--color-text-primary)]">{agent.name}</span>
                      <span className="px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-mono" style={{ backgroundColor: `${agent.color}15`, color: agent.color }}>
                        {agent.model}
                      </span>
                      <span className="text-[9px] sm:text-[10px] font-mono text-[var(--color-text-ghost)]">{agent.latency}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-[var(--color-text-muted)] line-clamp-2">{agent.desc}</p>
                  </div>

                  {/* Active Indicator */}
                  {activeAgent === index && (
                    <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full animate-pulse flex-shrink-0" style={{ backgroundColor: agent.color }} />
                  )}
                </div>
              </div>
            ))}

            {/* Powered By */}
            <div className="flex items-center justify-center gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-[var(--color-border)]">
              <span className="text-[10px] sm:text-xs font-mono text-[var(--color-text-ghost)]">Powered by</span>
              <span className="text-xs sm:text-sm font-semibold text-[var(--color-text-secondary)]">OpenClaw AI</span>
            </div>
          </div>

          {/* Right: Network Visualization */}
          <div className="relative h-[280px] sm:h-[350px] lg:h-[420px] bg-[var(--color-bg-surface-1)] rounded-xl sm:rounded-2xl border border-[var(--color-border)] overflow-hidden">
            {/* Grid Background */}
            <div className="absolute inset-0 opacity-30">
              <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="var(--color-primary)" strokeWidth="0.3" opacity="0.4" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
            </div>

            {/* Network SVG */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
              {/* Edges */}
              {NETWORK_EDGES.map((edge, i) => {
                const fromNode = NETWORK_NODES.find(n => n.id === edge.from);
                const toNode = NETWORK_NODES.find(n => n.id === edge.to);
                if (!fromNode || !toNode) return null;
                const dashOffset = (animationPhase * 2) % 100;

                return (
                  <g key={i}>
                    <line
                      x1={fromNode.x} y1={fromNode.y}
                      x2={toNode.x} y2={toNode.y}
                      stroke="var(--color-primary)"
                      strokeWidth={edge.strength * 0.6}
                      opacity={0.15}
                    />
                    <line
                      x1={fromNode.x} y1={fromNode.y}
                      x2={toNode.x} y2={toNode.y}
                      stroke="var(--color-primary)"
                      strokeWidth={edge.strength * 0.4}
                      strokeDasharray="3 6"
                      strokeDashoffset={dashOffset}
                      opacity={0.5}
                    />
                  </g>
                );
              })}

              {/* Nodes */}
              {NETWORK_NODES.map((node) => {
                const isPool = 'isPool' in node && node.isPool;
                const color = isPool ? 'var(--color-secondary)' : getTierColor(node.tier || '');
                const pulseScale = 1 + Math.sin(animationPhase * 0.08) * 0.04;

                return (
                  <g key={node.id} style={{ cursor: 'pointer' }}>
                    {/* Glow */}
                    <circle
                      cx={node.x} cy={node.y}
                      r={node.size * 0.12 * pulseScale}
                      fill={color}
                      opacity={0.25}
                      style={{ filter: 'blur(2px)' }}
                    />
                    {/* Ring */}
                    <circle
                      cx={node.x} cy={node.y}
                      r={node.size * 0.08}
                      fill="var(--color-bg-surface-1)"
                      stroke={color}
                      strokeWidth={0.6}
                      opacity={0.9}
                    />
                    {/* Inner */}
                    <circle
                      cx={node.x} cy={node.y}
                      r={node.size * 0.05}
                      fill={color}
                      opacity={0.3}
                    />
                    {/* Label */}
                    <text
                      x={node.x} y={node.y + node.size * 0.14}
                      textAnchor="middle"
                      fill="var(--color-text-primary)"
                      fontSize="2.2"
                      fontFamily="monospace"
                      opacity={0.8}
                    >
                      {node.label}
                    </text>
                    {/* Brier or TVL */}
                    {'brier' in node && !isPool && (
                      <text
                        x={node.x} y={node.y + node.size * 0.21}
                        textAnchor="middle"
                        fill={color}
                        fontSize="1.8"
                        fontFamily="monospace"
                      >
                        {node.brier}
                      </text>
                    )}
                    {'tvl' in node && isPool && (
                      <text
                        x={node.x} y={node.y + node.size * 0.21}
                        textAnchor="middle"
                        fill={color}
                        fontSize="1.8"
                        fontFamily="monospace"
                      >
                        {node.tvl}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 flex items-center gap-4 text-[10px] font-mono">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
                <span className="text-[var(--color-text-muted)]">Forecaster</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-secondary)' }} />
                <span className="text-[var(--color-text-muted)]">Conviction Pool</span>
              </div>
            </div>

            {/* Live Badge */}
            <div className="absolute top-4 right-4 flex items-center gap-2 px-2.5 py-1 rounded-md bg-[var(--color-primary-dim)] border border-[var(--color-primary)]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" />
              <span className="text-[10px] font-mono text-[var(--color-primary)]">LIVE</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// SECTION 5.5: CORE FEATURES - BeRight Protocol
// ─────────────────────────────────────────────────────────────────────────────────

function CoreFeaturesSection() {
  const features = [
    {
      icon: '🧠',
      title: 'AI Signal Layer & Agent Tech',
      subtitle: 'AXBT-Level Intelligence',
      description: 'Multi-agent system powered by OpenClaw AI. Scout agents scan markets in <2s, Analyst agents deliver deep research in 5-15s, and Trader agents handle risk checks instantly.',
      specs: [
        { label: 'Response Time', value: '<2s scan, 5-15s analysis' },
        { label: 'Data Sources', value: '4+ platforms aggregated' },
        { label: 'Models', value: 'Claude Sonnet 4.5 + Opus 4.5' },
      ],
      color: 'var(--color-secondary)',
    },
    {
      icon: '🌐',
      title: 'Forecaster Network Protocol',
      subtitle: 'Permissionless Skill Graph',
      description: 'On-chain reputation system tracking Brier scores across all predictions. Elite forecasters earn verified status and attract capital to their conviction pools.',
      specs: [
        { label: 'Calibration', value: 'Brier score < 0.15 = ELITE' },
        { label: 'Track Record', value: 'Immutable, verifiable on-chain' },
        { label: 'Network Effect', value: 'Better forecasters → more capital' },
      ],
      color: 'var(--color-primary)',
    },
    {
      icon: '💎',
      title: 'DeFi Primitive: Forecaster Pools',
      subtitle: 'Conviction-Backed Staking',
      description: 'Capital follows skill. Stake in forecaster pools managed by top performers. Pool operators earn 20% of profits while LPs gain exposure to alpha without trading themselves.',
      specs: [
        { label: 'Operator Fee', value: '20% performance fee' },
        { label: 'Min. Calibration', value: 'Brier < 0.20 to create pool' },
        { label: 'LP Benefits', value: 'Passive alpha exposure + verifiable returns' },
      ],
      color: 'var(--color-gold)',
    },
    {
      icon: '🎯',
      title: 'Calibration Program',
      subtitle: 'Proof of Skill',
      description: 'Continuous Brier score tracking across all markets. Lower scores unlock higher tiers, larger pool sizes, and premium features. Your edge is quantified and rewarded.',
      specs: [
        { label: 'ELITE Tier', value: 'Brier < 0.15 | Max pool $500K' },
        { label: 'VERIFIED Tier', value: 'Brier < 0.20 | Max pool $100K' },
        { label: 'ROOKIE Tier', value: 'Brier < 0.30 | Max pool $25K' },
      ],
      color: 'var(--color-primary)',
    },
  ];

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 relative overflow-hidden bg-[var(--color-bg-surface-1)]/30">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary)]/5 via-transparent to-[var(--color-secondary)]/5 pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-primary-dim)] border border-[var(--color-primary)]/20 mb-4 sm:mb-6">
            <span className="text-[10px] sm:text-xs font-mono uppercase tracking-wider text-[var(--color-primary)]">BeRight Protocol</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4 sm:mb-6 text-[var(--color-text-primary)]">
            Core Features That <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)]">Set Us Apart</span>
          </h2>
          <p className="text-[var(--color-text-secondary)] text-sm sm:text-lg max-w-3xl mx-auto px-2">
            Not just another prediction market. BeRight combines AI intelligence with a permissionless forecaster network and unique DeFi primitive.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative rounded-2xl sm:rounded-3xl p-6 sm:p-8 bg-[var(--color-bg-surface-1)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-all duration-300 overflow-hidden"
              style={{
                boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
              }}
            >
              {/* Hover Glow */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl sm:rounded-3xl"
                style={{
                  background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${feature.color}15, transparent 40%)`
                }}
              />

              {/* Content */}
              <div className="relative z-10">
                {/* Icon & Title */}
                <div className="flex items-start gap-4 mb-4 sm:mb-6">
                  <div
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl sm:text-3xl transition-transform group-hover:scale-110 duration-300"
                    style={{
                      backgroundColor: `${feature.color}15`,
                      border: `1px solid ${feature.color}40`
                    }}
                  >
                    {feature.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg sm:text-xl mb-1 text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
                      {feature.title}
                    </h3>
                    <p
                      className="text-xs sm:text-sm font-semibold"
                      style={{ color: feature.color }}
                    >
                      {feature.subtitle}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm sm:text-base text-[var(--color-text-secondary)] mb-6 leading-relaxed">
                  {feature.description}
                </p>

                {/* Specs */}
                <div className="space-y-3">
                  {feature.specs.map((spec, specIndex) => (
                    <div
                      key={specIndex}
                      className="flex items-start justify-between gap-3 p-3 rounded-lg bg-[var(--color-bg-surface-2)]/50 border border-[var(--color-border)]"
                    >
                      <span className="text-xs sm:text-sm font-medium text-[var(--color-text-muted)]">
                        {spec.label}
                      </span>
                      <span
                        className="text-xs sm:text-sm font-mono font-semibold text-right"
                        style={{ color: feature.color }}
                      >
                        {spec.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Corner Accent */}
              <div
                className="absolute top-0 right-0 w-24 h-24 opacity-10 pointer-events-none"
                style={{
                  background: `radial-gradient(circle at top right, ${feature.color}, transparent 70%)`
                }}
              />
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 sm:mt-16 text-center">
          <div className="inline-flex flex-col sm:flex-row items-center gap-3 sm:gap-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-secondary)]/10 border border-[var(--color-primary)]/20">
            <div className="flex-1 text-left">
              <p className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)] mb-1">
                Want the technical deep dive?
              </p>
              <p className="text-xs sm:text-sm text-[var(--color-text-muted)]">
                Read the full protocol specification in our litepaper
              </p>
            </div>
            <Link
              href="/docs/litepaper"
              className="flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-bg-base)] font-semibold rounded-xl transition-all shadow-[var(--shadow-glow-primary)] hover:shadow-[var(--shadow-glow-primary-lg)]"
            >
              <span className="text-sm">Read Litepaper</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// SECTION 6: PRODUCT PREVIEW - Swipe Card + AI Insight Demo
// ─────────────────────────────────────────────────────────────────────────────────

// Platform logos as inline SVGs for crisp rendering
const PLATFORMS = [
  {
    name: 'Polymarket',
    logo: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    ),
    color: '#00D395',
  },
  {
    name: 'Kalshi',
    logo: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
    color: '#6366F1',
  },
  {
    name: 'Metaculus',
    logo: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    color: '#F59E0B',
  },
  {
    name: 'Manifold',
    logo: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2l9 4.5v11L12 22l-9-4.5v-11L12 2z" />
        <path d="M12 22V12M3 7l9 5 9-5" />
      </svg>
    ),
    color: '#8B5CF6',
  },
];

function ProductPreviewSection() {
  const [showInsight, setShowInsight] = useState(false);

  useEffect(() => {
    // Auto-show insight after 1.5s
    const timer = setTimeout(() => setShowInsight(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-bg-base)] via-[var(--color-primary)]/3 to-[var(--color-bg-base)] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section Header */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-primary-dim)] border border-[var(--color-primary)]/20 mb-4 sm:mb-6">
            <span className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-[var(--color-primary)] animate-pulse" />
            <span className="text-[10px] sm:text-xs font-mono uppercase tracking-wider text-[var(--color-primary)]">Experience the Edge</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-3 sm:mb-4 text-[var(--color-text-primary)]">
            Swipe. <span className="text-[var(--color-primary)]">See the Edge.</span> Decide.
          </h2>
          <p className="text-[var(--color-text-secondary)] text-sm sm:text-lg max-w-2xl mx-auto px-2">
            Every market card shows AI analysis instantly. See what others miss.
          </p>
        </div>

        {/* Platform Logos */}
        <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-6 md:gap-10 mb-10 sm:mb-16">
          <span className="text-[10px] sm:text-xs font-mono text-[var(--color-text-ghost)] uppercase tracking-wider w-full sm:w-auto text-center mb-2 sm:mb-0">Aggregating from</span>
          {PLATFORMS.map((platform) => (
            <div
              key={platform.name}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-[var(--color-bg-surface-1)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-all cursor-pointer group"
            >
              <span style={{ color: platform.color }} className="opacity-70 group-hover:opacity-100 transition-opacity [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6">
                {platform.logo}
              </span>
              <span className="text-xs sm:text-sm font-medium text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] transition-colors hidden sm:inline">
                {platform.name}
              </span>
            </div>
          ))}
        </div>

        {/* Card Preview */}
        <div className="flex justify-center">
          <div className="relative w-full max-w-[340px] sm:max-w-none sm:w-auto">
            {/* Glow behind card */}
            <div className="absolute inset-0 bg-[var(--color-primary)]/20 blur-[60px] sm:blur-[80px] rounded-full scale-75" />

            {/* Mock Swipe Card */}
            <div className="relative w-full sm:w-[340px] md:w-[380px] bg-[rgba(18,22,36,0.85)] backdrop-blur-xl rounded-[24px] sm:rounded-[32px] border border-[var(--color-border)] shadow-2xl overflow-hidden">
              {/* Decorative glows */}
              <div className="absolute -top-5 -right-5 w-24 h-24 bg-[var(--color-primary)] rounded-full blur-[40px] opacity-30" />
              <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-[var(--color-secondary)] rounded-full blur-[50px] opacity-20" />

              {/* Card Content */}
              <div className="relative p-4 sm:p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <span className="px-2.5 sm:px-3 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold uppercase tracking-wide bg-[var(--color-gold)]/15 text-[var(--color-gold)] border border-[var(--color-gold)]/20">
                    CRYPTO
                  </span>
                  <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] font-mono text-[var(--color-text-ghost)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" />
                    LIVE
                  </div>
                </div>

                {/* Question */}
                <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-[var(--color-text-primary)] leading-tight mb-4 sm:mb-6">
                  Will Bitcoin reach $150K before July 2025?
                </h3>

                {/* Mini Chart */}
                <div className="h-16 sm:h-20 mb-4 sm:mb-6 relative">
                  <svg viewBox="0 0 100 40" className="w-full h-full" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,35 Q10,30 20,28 T40,22 T60,18 T80,12 T100,8"
                      fill="none"
                      stroke="var(--color-primary)"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M0,35 Q10,30 20,28 T40,22 T60,18 T80,12 T100,8 L100,40 L0,40 Z"
                      fill="url(#chartGradient)"
                    />
                    <circle cx="100" cy="8" r="3" fill="var(--color-primary)" className="animate-pulse" />
                  </svg>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[rgba(0,0,0,0.3)] border border-[var(--color-border)] mb-4 sm:mb-6">
                  <div>
                    <div className="text-[10px] sm:text-[11px] font-mono text-[var(--color-text-ghost)] uppercase mb-1">Yes Price</div>
                    <div className="text-xl sm:text-2xl font-bold text-[var(--color-primary)]">34¢</div>
                  </div>
                  <div>
                    <div className="text-[10px] sm:text-[11px] font-mono text-[var(--color-text-ghost)] uppercase mb-1">No Price</div>
                    <div className="text-xl sm:text-2xl font-bold text-[var(--color-error)]">66¢</div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-[10px] sm:text-xs text-[var(--color-text-ghost)] border-t border-[var(--color-border)] pt-3 sm:pt-4">
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span>$2.4M Vol</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    <span>Ends 4mo</span>
                  </div>
                </div>
              </div>

              {/* AI Insight Overlay */}
              <div
                className={`absolute bottom-0 left-0 right-0 bg-[var(--color-bg-surface-2)]/95 backdrop-blur-lg border-t border-[var(--color-secondary)]/30 p-4 sm:p-5 transition-all duration-500 ${
                  showInsight ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
                }`}
              >
                {/* Insight Header */}
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-[var(--color-secondary)]/20 flex items-center justify-center">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 text-[var(--color-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[var(--color-secondary)]">AI Insight</span>
                  </div>
                  <span className="px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase bg-[var(--color-warning)]/15 text-[var(--color-warning)] border border-[var(--color-warning)]/20">
                    HIGH CONF
                  </span>
                </div>

                {/* Insight Stats */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4">
                  <div className="text-center p-1.5 sm:p-2 rounded-lg bg-[var(--color-bg-surface-1)]">
                    <div className="text-base sm:text-lg font-bold text-[var(--color-secondary)]">42%</div>
                    <div className="text-[9px] sm:text-[10px] text-[var(--color-text-ghost)] uppercase">AI Est.</div>
                  </div>
                  <div className="text-center p-1.5 sm:p-2 rounded-lg bg-[var(--color-bg-surface-1)]">
                    <div className="text-base sm:text-lg font-bold text-[var(--color-text-secondary)]">34%</div>
                    <div className="text-[9px] sm:text-[10px] text-[var(--color-text-ghost)] uppercase">Market</div>
                  </div>
                  <div className="text-center p-1.5 sm:p-2 rounded-lg bg-[var(--color-bg-surface-1)]">
                    <div className="text-base sm:text-lg font-bold text-[var(--color-primary)]">+8%</div>
                    <div className="text-[9px] sm:text-[10px] text-[var(--color-text-ghost)] uppercase">Edge</div>
                  </div>
                </div>

                {/* Verdict */}
                <div className="flex items-start gap-1.5 sm:gap-2 p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20">
                  <span className="text-[var(--color-primary)] mt-0.5 text-sm">→</span>
                  <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed">
                    <span className="font-semibold text-[var(--color-text-primary)]">Underpriced YES.</span>{' '}
                    ETF inflows + halving cycle suggest higher probability.
                  </p>
                </div>
              </div>

              {/* Swipe Indicators (decorative) */}
              <div className="absolute top-1/2 -translate-y-1/2 left-4 w-12 h-12 rounded-full bg-[var(--color-error)]/20 border border-[var(--color-error)]/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-6 h-6 text-[var(--color-error)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="absolute top-1/2 -translate-y-1/2 right-4 w-12 h-12 rounded-full bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            {/* Swipe Buttons (decorative, below card) */}
            <div className="flex justify-center gap-8 sm:gap-12 mt-6 sm:mt-8">
              <button className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[var(--color-bg-surface-1)] border border-[var(--color-error)]/30 flex items-center justify-center text-[var(--color-error)] shadow-lg shadow-[var(--color-error)]/10 hover:scale-105 transition-transform cursor-pointer">
                <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[var(--color-bg-surface-1)] border border-[var(--color-primary)]/30 flex items-center justify-center text-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/10 hover:scale-105 transition-transform cursor-pointer">
                <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>

            {/* Hint text */}
            <p className="text-center text-[10px] sm:text-xs text-[var(--color-text-ghost)] mt-4 sm:mt-6 font-mono">
              ← SWIPE NO • SWIPE YES →
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// SECTION 7: HOW IT WORKS - Simple 3 Steps
// ─────────────────────────────────────────────────────────────────────────────────

function HowItWorksSection() {
  const steps = [
    {
      num: '01',
      title: 'Connect',
      desc: 'Sign in with email or Solana wallet. Non-custodial.',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18-3a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6m18 0V4.5A2.25 2.25 0 0018.75 2.25H5.25A2.25 2.25 0 003 4.5V6" />
        </svg>
      ),
      color: 'var(--color-primary)',
    },
    {
      num: '02',
      title: 'Predict',
      desc: 'See AI edge on every market. Swipe to predict.',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      ),
      color: 'var(--color-secondary)',
    },
    {
      num: '03',
      title: 'Earn',
      desc: 'Build your Brier score. Attract capital. Monetize skill.',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
        </svg>
      ),
      color: 'var(--color-gold)',
    },
  ];

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 bg-[var(--color-bg-surface-1)]/30">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-3 sm:mb-4 text-[var(--color-text-primary)]">
            How It Works
          </h2>
          <p className="text-sm sm:text-base text-[var(--color-text-secondary)]">Three steps to the edge</p>
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {steps.map((step, i) => (
            <div
              key={step.num}
              className="relative group rounded-xl sm:rounded-2xl bg-[var(--color-bg-surface-1)] border border-[var(--color-border)] p-6 sm:p-8 text-center hover:border-[var(--color-border-hover)] transition-all cursor-pointer"
            >
              {/* Step Number */}
              <div
                className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold font-mono"
                style={{ backgroundColor: step.color, color: 'var(--color-bg-base)' }}
              >
                {step.num}
              </div>

              {/* Icon */}
              <div
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl mx-auto mb-4 sm:mb-6 flex items-center justify-center transition-transform group-hover:scale-110 [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-7 sm:[&>svg]:h-7"
                style={{ backgroundColor: `${step.color}15`, border: `1px solid ${step.color}30`, color: step.color }}
              >
                {step.icon}
              </div>

              <h3 className="text-lg sm:text-xl font-bold mb-2 text-[var(--color-text-primary)]">{step.title}</h3>
              <p className="text-xs sm:text-sm text-[var(--color-text-muted)] leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// SECTION 7: USER PATHS - Choose Your Role
// ─────────────────────────────────────────────────────────────────────────────────

function UserPathsSection() {
  const paths = [
    {
      title: 'Forecaster',
      desc: 'Build reputation through accurate predictions. Launch Conviction Pools.',
      perks: ['Earn 20% of pool profits', 'Verifiable track record', 'On-chain Brier score'],
      color: 'var(--color-primary)',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: 'Capitalist',
      desc: 'Invest in proven forecasters. Delegate capital to top performers.',
      perks: ['60% of pool profits', 'Access elite forecasters', 'Exit anytime'],
      color: 'var(--color-gold)',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: 'Casual',
      desc: 'Just want the AI edge. Swipe through markets with AI insights.',
      perks: ['AI edge on every market', 'Mobile-first UX', 'Start with $1'],
      color: 'var(--color-secondary)',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
  ];

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-3 sm:mb-4 text-[var(--color-text-primary)]">
            Choose Your Path
          </h2>
          <p className="text-sm sm:text-base text-[var(--color-text-secondary)]">Everyone profits differently</p>
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {paths.map((path) => (
            <div
              key={path.title}
              className="group relative rounded-xl sm:rounded-2xl bg-[var(--color-bg-surface-1)] border border-[var(--color-border)] p-5 sm:p-8 hover:border-[var(--color-border-hover)] transition-all cursor-pointer overflow-hidden"
            >
              {/* Glow */}
              <div
                className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 rounded-full blur-[40px] sm:blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: path.color }}
              />

              {/* Icon */}
              <div
                className="w-11 h-11 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl mb-4 sm:mb-6 flex items-center justify-center transition-transform group-hover:scale-110 [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-7 sm:[&>svg]:h-7"
                style={{ backgroundColor: `${path.color}15`, border: `1px solid ${path.color}30`, color: path.color }}
              >
                {path.icon}
              </div>

              <h3 className="text-xl sm:text-2xl font-bold mb-2 text-[var(--color-text-primary)]">{path.title}</h3>
              <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mb-4 sm:mb-6 leading-relaxed">{path.desc}</p>

              <ul className="space-y-1.5 sm:space-y-2">
                {path.perks.map((perk, i) => (
                  <li key={i} className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                    <span style={{ color: path.color }}>+</span>
                    <span className="text-[var(--color-text-secondary)]">{perk}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// SECTION 8: FINAL CTA
// ─────────────────────────────────────────────────────────────────────────────────

function FinalCTASection() {
  const { login } = useUser();

  return (
    <section className="py-16 sm:py-24 relative overflow-hidden">
      {/* Ambient */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[700px] h-[400px] sm:h-[700px] bg-gradient-radial from-[var(--color-primary)]/15 to-transparent rounded-full blur-[80px] sm:blur-[100px] pointer-events-none" />

      <div className="max-w-3xl mx-auto text-center relative z-10 px-4 sm:px-6">
        <h2 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-4 sm:mb-6 text-[var(--color-text-primary)]">
          Ready to prove
          <br />
          <span className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] bg-clip-text text-transparent">
            you&apos;re right?
          </span>
        </h2>

        <p className="text-base sm:text-lg text-[var(--color-text-secondary)] mb-8 sm:mb-10 max-w-xl mx-auto px-2">
          Join the network of forecasters building verifiable track records and earning from their skill.
        </p>

        <button
          onClick={login}
          className="inline-flex items-center gap-2 sm:gap-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] px-6 sm:px-10 py-3.5 sm:py-5 rounded-full transition-all font-bold text-base sm:text-lg text-[var(--color-bg-base)] cursor-pointer shadow-[var(--shadow-glow-primary-lg)]"
        >
          <span>Start Predicting</span>
          <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </button>

        <p className="mt-4 sm:mt-6 text-[10px] sm:text-xs text-[var(--color-text-ghost)] font-mono">
          No KYC required • Non-custodial • You control your funds
        </p>

        <div className="mt-10 sm:mt-16 flex items-center justify-center gap-2 sm:gap-3 opacity-50">
          <span className="text-[10px] sm:text-xs font-mono text-[var(--color-text-ghost)]">POWERED BY</span>
          <span className="font-bold text-sm sm:text-base text-[var(--color-text-secondary)]">SOLANA</span>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT - Streamlined Narrative Flow
// ─────────────────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="landing-page min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] overflow-x-hidden selection:bg-[var(--color-primary)] selection:text-[var(--color-bg-base)]">
      {/* Ambient Background */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-[var(--color-primary)]/4 rounded-full blur-[150px] pointer-events-none -z-10" />

      {/* 1. Navigation */}
      <Navigation />

      {/* 2. Live Ticker - Social Proof */}
      <LiveTicker />

      {/* 3. Hero - Problem + Solution */}
      <HeroSection />

      {/* 4. Stats Bar - Trust Signals */}
      <MarketStatsBar />

      {/* 5. Intelligence + Network - Core Value Prop */}
      <IntelligenceSection />

      {/* 5.5. Core Features - BeRight Protocol */}
      <CoreFeaturesSection />

      {/* 6. Product Preview - Swipe Card + AI Insight */}
      <ProductPreviewSection />

      {/* 7. How It Works - Simple Steps */}
      <HowItWorksSection />

      {/* 8. User Paths - Choose Your Role */}
      <UserPathsSection />

      {/* 9. Final CTA */}
      <FinalCTASection />

      {/* Spacer for Bottom Nav */}
      <div className="h-20" />

      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
      `}</style>
    </div>
  );
}
