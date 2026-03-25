'use client';

import { useUser } from '@/hooks/useUnifiedUser';
import BrandLogo from './BrandLogo';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// BERIGHT LANDING PAGE - Premium Prediction Markets Landing
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────────

const TICKER_ITEMS = [
  { type: 'win', user: '@oracle_mind', amount: '+$4,200', market: 'Fed Cuts' },
  { type: 'resolved', market: 'BTC breaks $100k?', result: 'YES' },
  { type: 'price', market: 'ETH/SOL ratio', price: '68c YES' },
  { type: 'win', user: '@kash_alpha', amount: '+$2,800', market: 'SOL ETF' },
  { type: 'loss', user: '@rekt_boy', amount: '-$900', market: 'Trump 2024' },
  { type: 'new', market: 'AGI before 2027?', volume: '+18% Vol' },
];

const LEADERBOARD = [
  { rank: 1, username: '@oracle_mind', brier: 0.124, winRate: 88.4, profit: '+$12,450', isPro: true },
  { rank: 2, username: '@quant_alpha', brier: 0.156, winRate: 72.1, profit: '+$8,920', isPro: true },
  { rank: 3, username: '@market_sage', brier: 0.182, winRate: 65.8, profit: '+$5,100', isPro: false },
  { rank: 4, username: '@data_mind', brier: 0.195, winRate: 61.2, profit: '+$3,400', isPro: false },
  { rank: 5, username: '@edge_hunter', brier: 0.218, winRate: 57.4, profit: '+$2,200', isPro: false },
];

// Network visualization data - Forecasters with connections
const NETWORK_NODES = [
  { id: 'oracle', label: '@oracle_mind', brier: 0.124, tier: 'ELITE', x: 50, y: 30, size: 40 },
  { id: 'quant', label: '@quant_alpha', brier: 0.156, tier: 'ELITE', x: 75, y: 50, size: 35 },
  { id: 'sage', label: '@market_sage', brier: 0.182, tier: 'VERIFIED', x: 25, y: 55, size: 30 },
  { id: 'data', label: '@data_mind', brier: 0.195, tier: 'VERIFIED', x: 60, y: 75, size: 28 },
  { id: 'edge', label: '@edge_hunter', brier: 0.218, tier: 'ROOKIE', x: 35, y: 80, size: 25 },
  { id: 'pool1', label: 'SOL Pool', isPool: true, x: 85, y: 25, size: 45, tvl: '$125K' },
  { id: 'pool2', label: 'ETH Pool', isPool: true, x: 15, y: 35, size: 38, tvl: '$82K' },
];

const NETWORK_EDGES = [
  { from: 'oracle', to: 'pool1', strength: 0.9 },
  { from: 'quant', to: 'pool1', strength: 0.7 },
  { from: 'sage', to: 'pool2', strength: 0.8 },
  { from: 'oracle', to: 'quant', strength: 0.4 },
  { from: 'sage', to: 'data', strength: 0.5 },
  { from: 'data', to: 'edge', strength: 0.3 },
];

// AI Agents data
const AI_AGENTS = [
  {
    id: 'scout',
    name: 'Scout',
    model: 'Sonnet 4.5',
    latency: '<2s',
    specialty: 'Hot markets, arbitrage, breaking news',
    color: '#00FFB2',
    icon: '⚡'
  },
  {
    id: 'analyst',
    name: 'Analyst',
    model: 'Opus 4.5',
    latency: '5-15s',
    specialty: 'Deep research, Tetlock methodology',
    color: '#8B5CF6',
    icon: '🧠'
  },
  {
    id: 'trader',
    name: 'Trader',
    model: 'Sonnet 4.5',
    latency: '3s',
    specialty: 'Risk checks, position sizing, execution',
    color: '#FBBF24',
    icon: '📊'
  },
];

// Live arbitrage opportunities
const LIVE_ARBS = [
  { market: 'ETH breaks $5K', poly: 68, kalshi: 61, spread: 7, direction: 'BUY NO on Poly' },
  { market: 'Fed cuts in June', poly: 45, kalshi: 52, spread: 7, direction: 'BUY YES on Poly' },
  { market: 'SOL flips BNB', poly: 34, kalshi: 28, spread: 6, direction: 'BUY YES on Kalshi' },
];

// ─────────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────────

function Navigation() {
  const { login, isLoading } = useUser();
  const ready = !isLoading;

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-white/[0.08] bg-[#080C14]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 group cursor-pointer">
          <BrandLogo size={32} />
          <span className="font-semibold text-xl tracking-tight text-white group-hover:text-[#00FFB2] transition-colors" style={{ fontFamily: 'Inter, sans-serif' }}>
            BeRight
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
          <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          <Link href="/docs/faq" className="hover:text-white transition-colors">FAQ</Link>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={login}
            disabled={!ready}
            className="flex items-center gap-2 bg-gradient-to-r from-[#00FFB2] to-[#10B981] hover:opacity-90 px-5 py-2 rounded-full transition-all font-medium text-sm text-[#080C14] disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M22 10H18C16.9 10 16 10.9 16 12C16 13.1 16.9 14 18 14H22" />
              <circle cx="18" cy="12" r="1" fill="currentColor" />
            </svg>
            <span>Login</span>
          </button>
        </div>
      </div>
    </nav>
  );
}

function LiveTicker() {
  const renderItem = (item: typeof TICKER_ITEMS[0], index: number) => {
    switch (item.type) {
      case 'win':
        return (
          <span key={index} className="flex items-center gap-2 text-gray-400">
            <span className="text-[#10B981]">+</span>
            <span>{item.user}</span>
            <span className="text-[#10B981]">{item.amount}</span>
            <span>on {item.market}</span>
          </span>
        );
      case 'resolved':
        return (
          <span key={index} className="flex items-center gap-2 text-gray-400">
            <span className="text-[#00FFB2]">*</span>
            <span>{item.market}</span>
            <span className="text-[#00FFB2] bg-[#00FFB2]/10 px-1 rounded">RESOLVED {item.result}</span>
          </span>
        );
      case 'price':
        return (
          <span key={index} className="flex items-center gap-2 text-gray-400">
            <span className="text-[#FBBF24]">^</span>
            <span>{item.market}</span>
            <span className="text-[#FBBF24]">{item.price}</span>
          </span>
        );
      case 'loss':
        return (
          <span key={index} className="flex items-center gap-2 text-gray-400">
            <span className="text-red-500">-</span>
            <span>{item.user}</span>
            <span className="text-red-500">{item.amount}</span>
            <span>on {item.market}</span>
          </span>
        );
      case 'new':
        return (
          <span key={index} className="flex items-center gap-2 text-gray-400">
            <span className="text-[#00FFB2]">NEW</span>
            <span className="text-white">{item.market}</span>
            <span className="text-[#10B981]">{item.volume}</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="mt-16 w-full border-b border-white/[0.08] bg-[#0F131C]/50 overflow-hidden relative">
      <div className="absolute top-0 left-0 w-20 h-full bg-gradient-to-r from-[#080C14] to-transparent z-10" />
      <div className="absolute top-0 right-0 w-20 h-full bg-gradient-to-l from-[#080C14] to-transparent z-10" />

      <div className="flex whitespace-nowrap py-3 animate-marquee hover:[animation-play-state:paused]">
        <div className="flex gap-8 px-4 font-mono text-xs items-center">
          {TICKER_ITEMS.map((item, i) => (
            <div key={`ticker-1-${i}`} className="flex items-center gap-8">
              {renderItem(item, i)}
              <span className="w-1 h-1 bg-gray-700 rounded-full" />
            </div>
          ))}
          {TICKER_ITEMS.map((item, i) => (
            <div key={`ticker-2-${i}`} className="flex items-center gap-8">
              {renderItem(item, i + TICKER_ITEMS.length)}
              <span className="w-1 h-1 bg-gray-700 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative pt-24 pb-32 px-6 overflow-hidden">
      <div className="max-w-7xl mx-auto text-center relative z-10">
        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00FFB2]/10 border border-[#00FFB2]/20 mb-8 animate-float">
          <span className="w-2 h-2 rounded-full bg-[#00FFB2] animate-pulse" />
          <span className="text-xs font-mono uppercase tracking-wider text-[#00FFB2]">Live on Solana Devnet</span>
        </div>

        {/* Headline */}
        <h1 className="text-6xl md:text-8xl font-bold leading-[0.9] tracking-tight mb-8" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
          Stop Guessing. <br />
          <span className="bg-gradient-to-r from-[#00FFB2] to-[#10B981] bg-clip-text text-transparent">Start Proving.</span>
        </h1>

        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-16 font-light">
          The AI-powered intelligence layer for prediction markets.{' '}
          <span className="text-white">Build your track record. Attract capital. Monetize your skill.</span>
        </p>

        {/* 3D Card Stack */}
        <div className="perspective-1000 h-[400px] flex justify-center items-center gap-4 md:gap-8 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00FFB2]/20 rounded-full blur-[100px] pointer-events-none" />

          {/* Left Card */}
          <div className="card-3d-left glass-card w-64 h-80 rounded-2xl p-6 flex-col justify-between hidden md:flex opacity-60 hover:opacity-100 transition-opacity cursor-pointer">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">S</div>
                <span className="text-xs font-mono text-gray-500">CRYPTO</span>
              </div>
              <h3 className="text-lg leading-tight mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>SOL breaks $300 by Q2?</h3>
            </div>
            <div>
              <div className="flex justify-between mb-2 text-sm font-mono">
                <span className="text-[#10B981]">YES 34c</span>
                <span className="text-gray-500">NO 66c</span>
              </div>
              <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                <div className="w-[34%] h-full bg-[#10B981]" />
              </div>
            </div>
          </div>

          {/* Center Card - with AI Edge */}
          <div className="card-3d-center glass-card w-80 h-[440px] rounded-2xl p-6 pb-8 flex flex-col bg-[#0B1019] border-[#00FFB2]/30">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center shadow-lg shadow-orange-500/20 text-white font-bold text-sm">E</div>
              <span className="px-2 py-1 rounded bg-[#FBBF24]/10 text-[#FBBF24] text-xs font-mono border border-[#FBBF24]/20">VOLATILE</span>
            </div>

            {/* Title */}
            <h3 className="text-2xl font-semibold leading-tight mb-1" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>ETH breaks $5K by Q3?</h3>
            <p className="text-sm text-gray-500 mb-4">Expires Sep 30, 2026</p>

            {/* AI Edge Insight */}
            <div className="rounded-lg bg-[#00FFB2]/10 border border-[#00FFB2]/20 p-3 mb-auto">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-3.5 h-3.5 text-[#00FFB2]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                <span className="text-[10px] font-mono text-[#00FFB2] uppercase">AI Edge</span>
              </div>
              <p className="text-xs text-white">Market at 68c. Our analysis: 54%. Edge on NO.</p>
            </div>

            {/* Price & Volume */}
            <div className="flex justify-between items-end mb-4 mt-4">
              <div>
                <div className="text-xs text-gray-400 font-mono mb-1">MARKET PRICE</div>
                <div className="text-3xl font-mono font-medium text-[#00FFB2]">68c</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400 font-mono mb-1">VOLUME</div>
                <div className="text-sm font-mono text-white">$2.1M</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button className="bg-[#10B981]/10 hover:bg-[#10B981]/20 border border-[#10B981]/20 text-[#10B981] font-mono text-sm py-3 rounded-lg transition-colors cursor-pointer">BUY YES</button>
              <button className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-mono text-sm py-3 rounded-lg transition-colors cursor-pointer">BUY NO</button>
            </div>
          </div>

          {/* Right Card */}
          <div className="card-3d-right glass-card w-64 h-80 rounded-2xl p-6 flex-col justify-between hidden md:flex opacity-60 hover:opacity-100 transition-opacity cursor-pointer">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">AI</div>
                <span className="text-xs font-mono text-gray-500">TECH</span>
              </div>
              <h3 className="text-lg leading-tight mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>AGI achieved before 2027?</h3>
            </div>
            <div>
              <div className="flex justify-between mb-2 text-sm font-mono">
                <span className="text-[#FBBF24]">YES 41c</span>
                <span className="text-gray-500">NO 59c</span>
              </div>
              <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                <div className="w-[41%] h-full bg-[#FBBF24]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MarketStatsBar() {
  return (
    <section className="border-y border-white/[0.08] bg-[#0F131C]/30 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-wrap justify-center md:justify-between items-center gap-8 md:gap-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-purple-500 to-teal-400" />
            <span className="font-semibold tracking-wide" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>SOLANA</span>
          </div>
          <div className="h-4 w-px bg-white/10 hidden md:block" />
          <div className="font-mono text-sm">
            <span className="text-white font-bold">$63.5B</span>
            <span className="text-gray-500 ml-1">2025 Volume</span>
          </div>
          <div className="h-4 w-px bg-white/10 hidden md:block" />
          <div className="font-mono text-sm">
            <span className="text-[#00FFB2] font-bold">4x</span>
            <span className="text-gray-500 ml-1">YoY Growth</span>
          </div>
          <div className="h-4 w-px bg-white/10 hidden md:block" />
          <div className="font-mono text-sm">
            <span className="text-white">6+</span>
            <span className="text-gray-500 ml-1">Markets Aggregated</span>
          </div>
          <div className="h-4 w-px bg-white/10 hidden md:block" />
          <div className="font-mono text-sm text-[#00FFB2] flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            On-chain Verified
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// PROBLEM STATEMENT SECTION - The Information Gap
// ─────────────────────────────────────────────────────────────────────────────────

function ProblemStatementSection() {
  return (
    <section className="py-24 px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#080C14] via-red-900/5 to-[#080C14] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 mb-6">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-mono uppercase tracking-wider text-red-400">The Problem</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            The <span className="text-red-400">Information Gap</span> Is Costing You
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Market makers extract 7%+ on every trade. The edge goes to insiders. You&apos;re caught in the middle.
          </p>
        </div>

        {/* Before/After Comparison */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Before - The Pain */}
          <div className="rounded-2xl bg-red-500/5 border border-red-500/20 p-8 relative overflow-hidden">
            <div className="absolute top-4 right-4 px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs font-mono">BEFORE</div>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-1">30+ minutes per trade</h4>
                  <p className="text-gray-500 text-sm">Manually checking 6+ platforms, comparing prices, reading news</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-1">No verifiable track record</h4>
                  <p className="text-gray-500 text-sm">Your Polymarket wins mean nothing on Kalshi. Skills are invisible.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-1">Missed arbitrage opportunities</h4>
                  <p className="text-gray-500 text-sm">7%+ spreads exist but you can&apos;t see them in real-time</p>
                </div>
              </div>
            </div>
          </div>

          {/* After - The Solution */}
          <div className="rounded-2xl bg-[#00FFB2]/5 border border-[#00FFB2]/20 p-8 relative overflow-hidden">
            <div className="absolute top-4 right-4 px-2 py-1 rounded bg-[#00FFB2]/20 text-[#00FFB2] text-xs font-mono">WITH BERIGHT</div>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-[#00FFB2]/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-[#00FFB2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-1">AI Edge in 3 seconds</h4>
                  <p className="text-gray-500 text-sm">Our multi-agent AI does 30 min of research instantly</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-[#00FFB2]/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-[#00FFB2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-1">On-chain Brier score</h4>
                  <p className="text-gray-500 text-sm">Verifiable accuracy. Unfakeable. Portable across platforms.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-[#00FFB2]/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-[#00FFB2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-1">Real-time arbitrage alerts</h4>
                  <p className="text-gray-500 text-sm">6+ platforms aggregated. Spreads detected automatically.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Research Citation */}
        <div className="mt-8 text-center">
          <p className="text-xs font-mono text-gray-600">
            Based on analysis of 72M trades • Becker et al. (2026) • Maker-taker gap: 7.2% on world events
          </p>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// FORECASTER NETWORK VISUALIZATION
// ─────────────────────────────────────────────────────────────────────────────────

function ForecasterNetworkSection() {
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [animationPhase, setAnimationPhase] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationPhase(prev => (prev + 1) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'ELITE': return '#00FFB2';
      case 'VERIFIED': return '#FBBF24';
      case 'ROOKIE': return '#60A5FA';
      default: return '#6B7280';
    }
  };

  return (
    <section className="py-24 px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#080C14] via-[#00FFB2]/3 to-[#080C14] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left - Text */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00FFB2]/10 border border-[#00FFB2]/20 mb-6">
              <span className="w-2 h-2 rounded-full bg-[#00FFB2] animate-pulse" />
              <span className="text-xs font-mono uppercase tracking-wider text-[#00FFB2]">DeFi Primitive</span>
            </div>

            <h2 className="text-4xl md:text-5xl font-bold mb-6" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
              The Decentralized <br />
              <span className="bg-gradient-to-r from-[#00FFB2] to-[#10B981] bg-clip-text text-transparent">Forecaster Network</span>
            </h2>

            <p className="text-gray-400 text-lg mb-8">
              Skill becomes an on-chain asset. Your Brier score is verified, portable, and investable.
              Capital flows to proven forecasters through Conviction Pools.
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-[#00FFB2]" />
                <span className="text-white">ELITE tier: Brier &lt; 0.18, 250+ predictions</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-[#FBBF24]" />
                <span className="text-white">VERIFIED tier: Brier &lt; 0.25, 100+ predictions</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-[#60A5FA]" />
                <span className="text-white">ROOKIE tier: Building track record</span>
              </div>
            </div>

            <div className="mt-8 p-4 rounded-xl bg-[#0F131C] border border-white/5">
              <div className="flex items-center gap-3 mb-2">
                <svg className="w-5 h-5 text-[#00FFB2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-sm font-mono text-[#00FFB2]">NEW DEFI PRIMITIVE</span>
              </div>
              <p className="text-sm text-gray-400">
                Conviction Pools let capitalists invest in forecaster skill, not individual trades.
                Elite forecasters earn <span className="text-white">20% performance fee</span>.
              </p>
            </div>
          </div>

          {/* Right - Network Visualization */}
          <div className="relative h-[500px] bg-[#0B0F18] rounded-2xl border border-white/5 overflow-hidden">
            {/* Animated Background Grid */}
            <div className="absolute inset-0 opacity-20">
              <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#00FFB2" strokeWidth="0.5" opacity="0.3" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
            </div>

            {/* SVG Network */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
              {/* Animated Edges */}
              {NETWORK_EDGES.map((edge, i) => {
                const fromNode = NETWORK_NODES.find(n => n.id === edge.from);
                const toNode = NETWORK_NODES.find(n => n.id === edge.to);
                if (!fromNode || !toNode) return null;

                const dashOffset = (animationPhase * 2) % 100;

                return (
                  <g key={i}>
                    {/* Base line */}
                    <line
                      x1={fromNode.x}
                      y1={fromNode.y}
                      x2={toNode.x}
                      y2={toNode.y}
                      stroke="#00FFB2"
                      strokeWidth={edge.strength * 0.8}
                      opacity={0.2}
                    />
                    {/* Animated dash */}
                    <line
                      x1={fromNode.x}
                      y1={fromNode.y}
                      x2={toNode.x}
                      y2={toNode.y}
                      stroke="#00FFB2"
                      strokeWidth={edge.strength * 0.5}
                      strokeDasharray="4 8"
                      strokeDashoffset={dashOffset}
                      opacity={0.6}
                    />
                  </g>
                );
              })}

              {/* Nodes */}
              {NETWORK_NODES.map((node) => {
                const isPool = 'isPool' in node && node.isPool;
                const color = isPool ? '#8B5CF6' : getTierColor(node.tier || '');
                const isActive = activeNode === node.id;
                const pulseScale = 1 + Math.sin(animationPhase * 0.1) * 0.05;

                return (
                  <g
                    key={node.id}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setActiveNode(node.id)}
                    onMouseLeave={() => setActiveNode(null)}
                  >
                    {/* Glow effect */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.size * 0.15 * pulseScale}
                      fill={color}
                      opacity={0.3}
                      style={{ filter: 'blur(3px)' }}
                    />
                    {/* Main circle */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.size * 0.08}
                      fill={isPool ? '#0B0F18' : '#0B0F18'}
                      stroke={color}
                      strokeWidth={isActive ? 1.5 : 0.8}
                      opacity={isActive ? 1 : 0.8}
                    />
                    {/* Inner fill */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.size * 0.06}
                      fill={color}
                      opacity={0.2}
                    />
                    {/* Label */}
                    <text
                      x={node.x}
                      y={node.y + node.size * 0.15}
                      textAnchor="middle"
                      fill="white"
                      fontSize="2.5"
                      fontFamily="monospace"
                      opacity={isActive ? 1 : 0.7}
                    >
                      {node.label}
                    </text>
                    {/* Brier score or TVL */}
                    {!isPool && 'brier' in node && (
                      <text
                        x={node.x}
                        y={node.y + node.size * 0.22}
                        textAnchor="middle"
                        fill={color}
                        fontSize="2"
                        fontFamily="monospace"
                      >
                        Brier: {node.brier}
                      </text>
                    )}
                    {isPool && 'tvl' in node && (
                      <text
                        x={node.x}
                        y={node.y + node.size * 0.22}
                        textAnchor="middle"
                        fill={color}
                        fontSize="2"
                        fontFamily="monospace"
                      >
                        TVL: {node.tvl}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#00FFB2]" />
                <span className="text-gray-400">Forecaster</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#8B5CF6]" />
                <span className="text-gray-400">Conviction Pool</span>
              </div>
            </div>

            {/* "Live" indicator */}
            <div className="absolute top-4 right-4 flex items-center gap-2 px-2 py-1 rounded bg-[#00FFB2]/10 border border-[#00FFB2]/20">
              <span className="w-2 h-2 rounded-full bg-[#00FFB2] animate-pulse" />
              <span className="text-xs font-mono text-[#00FFB2]">LIVE NETWORK</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// AI SIGNAL LAYER VISUALIZATION
// ─────────────────────────────────────────────────────────────────────────────────

function AISignalLayerSection() {
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProcessingStep(prev => (prev + 1) % 4);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-24 px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#080C14] via-[#8B5CF6]/3 to-[#080C14] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 mb-6">
            <span className="w-2 h-2 rounded-full bg-[#8B5CF6] animate-pulse" />
            <span className="text-xs font-mono uppercase tracking-wider text-[#8B5CF6]">Multi-Agent Intelligence</span>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold mb-6" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            AI Signal Layer <br />
            <span className="bg-gradient-to-r from-[#8B5CF6] to-[#00FFB2] bg-clip-text text-transparent">Powered by Claude</span>
          </h2>

          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Three specialized AI agents working together. Scout for speed. Analyst for depth. Trader for precision.
          </p>
        </div>

        {/* Agent Pipeline Visualization */}
        <div className="relative">
          {/* Connection lines */}
          <div className="hidden md:block absolute top-1/2 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-[#00FFB2] via-[#8B5CF6] to-[#FBBF24] opacity-30" />

          <div className="grid md:grid-cols-3 gap-6">
            {AI_AGENTS.map((agent, index) => (
              <div
                key={agent.id}
                className={`group relative rounded-2xl bg-[#0F131C] border p-6 transition-all duration-300 cursor-pointer ${
                  processingStep === index
                    ? `border-[${agent.color}]/50 shadow-lg shadow-[${agent.color}]/10`
                    : 'border-white/5 hover:border-white/10'
                }`}
                style={{
                  borderColor: processingStep === index ? agent.color : undefined,
                  boxShadow: processingStep === index ? `0 0 30px ${agent.color}20` : undefined
                }}
                onMouseEnter={() => setActiveAgent(agent.id)}
                onMouseLeave={() => setActiveAgent(null)}
              >
                {/* Step indicator */}
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono"
                  style={{
                    backgroundColor: `${agent.color}20`,
                    border: `1px solid ${agent.color}40`,
                    color: agent.color
                  }}
                >
                  {index + 1}
                </div>

                {/* Agent Icon - Using SVG instead of emoji */}
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${agent.color}15`, border: `1px solid ${agent.color}30` }}
                >
                  {agent.id === 'scout' && (
                    <svg className="w-8 h-8" style={{ color: agent.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                  {agent.id === 'analyst' && (
                    <svg className="w-8 h-8" style={{ color: agent.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  )}
                  {agent.id === 'trader' && (
                    <svg className="w-8 h-8" style={{ color: agent.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  )}
                </div>

                {/* Agent Info */}
                <h3 className="text-xl font-bold mb-1" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                  {agent.name}
                </h3>

                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded text-xs font-mono" style={{ backgroundColor: `${agent.color}15`, color: agent.color }}>
                    {agent.model}
                  </span>
                  <span className="text-xs font-mono text-gray-500">{agent.latency}</span>
                </div>

                <p className="text-gray-400 text-sm leading-relaxed">
                  {agent.specialty}
                </p>

                {/* Processing indicator */}
                {processingStep === index && (
                  <div className="absolute bottom-4 right-4">
                    <div className="w-4 h-4 rounded-full animate-spin" style={{
                      border: `2px solid ${agent.color}30`,
                      borderTopColor: agent.color
                    }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Sample Output */}
        <div className="mt-12 rounded-2xl bg-[#0B0F18] border border-white/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00FFB2] animate-pulse" />
              <span className="text-sm font-mono text-gray-400">AI Edge Output</span>
            </div>
            <span className="text-xs font-mono text-gray-500">ETH breaks $5K by Q3?</span>
          </div>
          <div className="p-6 font-mono text-sm">
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="text-xs text-[#00FFB2] mb-2">SCOUT - MARKET SCAN</div>
                <p className="text-gray-400">
                  Market price: <span className="text-white">68c YES</span><br />
                  Volume 24h: <span className="text-white">$2.1M</span><br />
                  Sentiment: <span className="text-[#FBBF24]">Bullish</span>
                </p>
              </div>
              <div>
                <div className="text-xs text-[#8B5CF6] mb-2">ANALYST - RESEARCH</div>
                <p className="text-gray-400">
                  Base rate: <span className="text-white">42%</span><br />
                  Evidence adjustment: <span className="text-white">+12%</span><br />
                  Final estimate: <span className="text-white">54%</span>
                </p>
              </div>
              <div>
                <div className="text-xs text-[#FBBF24] mb-2">TRADER - RECOMMENDATION</div>
                <p className="text-gray-400">
                  Edge: <span className="text-[#00FFB2]">14% on NO</span><br />
                  Position size: <span className="text-white">2% of bankroll</span><br />
                  Action: <span className="text-[#00FFB2]">BUY NO @ 32c</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tech Stack Badge */}
        <div className="mt-8 flex justify-center">
          <div className="inline-flex items-center gap-4 px-4 py-2 rounded-full bg-[#0F131C] border border-white/5">
            <span className="text-xs font-mono text-gray-500">Powered by</span>
            <span className="text-sm font-medium text-white">Anthropic Claude</span>
            <span className="text-xs text-gray-500">•</span>
            <span className="text-xs font-mono text-gray-500">OpenClaw Architecture</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// LIVE ARBITRAGE FEED
// ─────────────────────────────────────────────────────────────────────────────────

function LiveArbitrageFeed() {
  const [highlightedArb, setHighlightedArb] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setHighlightedArb(prev => (prev + 1) % LIVE_ARBS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-16 px-6 bg-gradient-to-b from-[#080C14] to-[#0F131C]">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            <h3 className="text-xl font-bold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>Live Arbitrage Opportunities</h3>
          </div>
          <span className="text-xs font-mono text-gray-500">Refreshes every 30s</span>
        </div>

        <div className="space-y-3">
          {LIVE_ARBS.map((arb, index) => (
            <div
              key={index}
              className={`rounded-xl bg-[#0F131C] border p-4 transition-all duration-500 cursor-pointer ${
                highlightedArb === index
                  ? 'border-[#10B981]/50 shadow-lg shadow-[#10B981]/10'
                  : 'border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="text-white font-medium mb-1">{arb.market}</div>
                  <div className="flex items-center gap-4 text-sm font-mono">
                    <span className="text-gray-400">Polymarket: <span className="text-white">{arb.poly}c</span></span>
                    <span className="text-gray-400">Kalshi: <span className="text-white">{arb.kalshi}c</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#10B981] font-mono">{arb.spread}%</div>
                    <div className="text-xs text-gray-500">SPREAD</div>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-[#10B981]/10 border border-[#10B981]/20">
                    <span className="text-sm font-mono text-[#10B981]">{arb.direction}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs font-mono text-gray-600">
            Aggregating: Polymarket • Kalshi • Jupiter • Manifold • Limitless • DFlow
          </p>
        </div>
      </div>
    </section>
  );
}

function LeaderboardSection() {
  return (
    <section id="leaderboard" className="py-24 px-6 relative">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>Top Forecasters</h2>
            <p className="text-gray-400 font-mono text-sm">Weekly Brier Score &middot; On-chain verified</p>
          </div>
        </div>

        <div className="glass-card rounded-xl overflow-hidden border border-white/[0.08]">
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-white/5 border-b border-white/5 text-xs font-mono text-gray-500 uppercase tracking-wider">
            <div className="col-span-1">#</div>
            <div className="col-span-5">Forecaster</div>
            <div className="col-span-2 text-right">Brier</div>
            <div className="col-span-2 text-right">Accuracy</div>
            <div className="col-span-2 text-right">Profit</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/5 font-mono text-sm">
            {LEADERBOARD.map((player, i) => (
              <div
                key={player.rank}
                className={`grid grid-cols-12 gap-4 px-6 py-4 items-center transition-colors cursor-pointer ${
                  i === 0 ? 'bg-[#00FFB2]/5 hover:bg-[#00FFB2]/10' : 'hover:bg-white/5'
                }`}
              >
                <div className={`col-span-1 ${i === 0 ? 'text-[#00FFB2] font-bold' : 'text-gray-500'}`}>
                  {String(player.rank).padStart(2, '0')}
                </div>
                <div className="col-span-5 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded ${i === 0 ? 'bg-gradient-to-r from-[#00FFB2] to-[#10B981]' : 'bg-gray-700'}`} />
                  <span className={`${i === 0 ? 'text-white font-medium' : 'text-gray-300'}`}>{player.username}</span>
                  {player.isPro && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#00FFB2]/20 text-[#00FFB2] border border-[#00FFB2]/20">ELITE</span>
                  )}
                </div>
                <div className="col-span-2 text-right text-gray-400">{player.brier.toFixed(3)}</div>
                <div className="col-span-2 text-right text-white">{player.winRate}%</div>
                <div className={`col-span-2 text-right ${i === 0 ? 'text-[#10B981] font-bold' : 'text-[#10B981]'}`}>{player.profit}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-center text-xs font-mono text-gray-500">
          Elite forecasters can launch Conviction Pools and earn 20% of profits
        </p>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section className="py-24 px-6 relative">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-6">
            <span className="text-xs font-mono uppercase tracking-wider text-[#00FFB2]">How It Works</span>
          </div>
          <h2 className="text-4xl font-bold mb-4" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>Three Steps to the Edge</h2>
          <p className="text-gray-400 font-mono text-sm">30 minutes of research in 3 seconds</p>
        </div>

        <div className="relative flex flex-col md:flex-row items-center gap-0">
          {/* Step 1 */}
          <div className="flex-1 flex flex-col items-center text-center px-8">
            <div className="relative w-20 h-20 rounded-2xl bg-[#00FFB2]/10 border border-[#00FFB2]/30 flex items-center justify-center mb-6">
              <svg className="w-9 h-9 text-[#00FFB2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18-3a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6m18 0V4.5A2.25 2.25 0 0018.75 2.25H5.25A2.25 2.25 0 003 4.5V6" />
              </svg>
              <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#00FFB2] text-[#080C14] text-xs font-bold font-mono flex items-center justify-center">1</span>
            </div>
            <h3 className="text-xl font-bold mb-3" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>Connect Wallet</h3>
            <p className="text-gray-400 text-sm leading-relaxed">Sign in with email or Solana wallet. No KYC. Non-custodial. You control your funds.</p>
          </div>

          {/* Connector */}
          <div className="hidden md:flex flex-col items-center gap-1 flex-shrink-0 mb-20">
            <div className="w-12 h-px bg-gradient-to-r from-[#00FFB2]/50 to-[#10B981]/30" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#00FFB2]/40" />
          </div>

          {/* Step 2 */}
          <div className="flex-1 flex flex-col items-center text-center px-8">
            <div className="relative w-20 h-20 rounded-2xl bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center mb-6">
              <svg className="w-9 h-9 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#10B981] text-[#080C14] text-xs font-bold font-mono flex items-center justify-center">2</span>
            </div>
            <h3 className="text-xl font-bold mb-3" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>Swipe &amp; Predict</h3>
            <p className="text-gray-400 text-sm leading-relaxed">See AI edge insight on every market. Swipe right (YES) or left (NO). Every prediction recorded on-chain.</p>
          </div>

          {/* Connector */}
          <div className="hidden md:flex flex-col items-center gap-1 flex-shrink-0 mb-20">
            <div className="w-12 h-px bg-gradient-to-r from-[#10B981]/30 to-[#FBBF24]/50" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]/40" />
          </div>

          {/* Step 3 */}
          <div className="flex-1 flex flex-col items-center text-center px-8">
            <div className="relative w-20 h-20 rounded-2xl bg-[#FBBF24]/10 border border-[#FBBF24]/30 flex items-center justify-center mb-6">
              <svg className="w-9 h-9 text-[#FBBF24]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
              </svg>
              <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#FBBF24] text-[#080C14] text-xs font-bold font-mono flex items-center justify-center">3</span>
            </div>
            <h3 className="text-xl font-bold mb-3" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>Build Reputation</h3>
            <p className="text-gray-400 text-sm leading-relaxed">Your Brier score tracks accuracy. Climb tiers. Unlock capital delegation. Monetize your skill.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function FourWaysToProfitSection() {
  return (
    <section className="py-24 px-6 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#10B981]/5 to-transparent pointer-events-none" />
      <div className="max-w-5xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10B981]/10 border border-[#10B981]/20 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            <span className="text-xs font-mono uppercase tracking-wider text-[#10B981]">How You Earn</span>
          </div>
          <h2 className="text-4xl font-bold mb-4" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            Four Ways to <span className="bg-gradient-to-r from-white to-[#00FFB2] bg-clip-text text-transparent">Profit</span>
          </h2>
          <p className="text-gray-400 font-mono text-sm">Intelligence-driven alpha, not gambling</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* AI Edge Detection */}
          <div className="group relative rounded-2xl bg-[#0F131C] border border-white/5 p-8 hover:border-[#00FFB2]/30 transition-all duration-300 overflow-hidden cursor-pointer">
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#00FFB2]/5 rounded-full blur-[60px] group-hover:bg-[#00FFB2]/10 transition-all" />
            <div className="flex items-start gap-5">
              <div className="w-12 h-12 rounded-xl bg-[#00FFB2]/10 border border-[#00FFB2]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#00FFB2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">Core Feature</div>
                <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>AI Edge Detection</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">Our AI compares its analysis to market odds and tells you where the edge is. 30 min research in 3 seconds.</p>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#00FFB2]/10 border border-[#00FFB2]/20 text-[#00FFB2] text-xs font-mono">20% better Brier scores</span>
              </div>
            </div>
          </div>

          {/* Cross-Platform Arbitrage */}
          <div className="group relative rounded-2xl bg-[#0F131C] border border-white/5 p-8 hover:border-[#10B981]/30 transition-all duration-300 overflow-hidden cursor-pointer">
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#10B981]/5 rounded-full blur-[60px] group-hover:bg-[#10B981]/10 transition-all" />
            <div className="flex items-start gap-5">
              <div className="w-12 h-12 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">Risk-Free Profits</div>
                <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>Cross-Platform Arbitrage</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">Polymarket says 65%. Kalshi says 58%. We aggregate 6+ platforms to spot the gaps. You pocket the spread.</p>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981] text-xs font-mono">7%+ spreads detected</span>
              </div>
            </div>
          </div>

          {/* Conviction Pools */}
          <div className="group relative rounded-2xl bg-[#0F131C] border border-white/5 p-8 hover:border-[#FBBF24]/30 transition-all duration-300 overflow-hidden cursor-pointer">
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#FBBF24]/5 rounded-full blur-[60px] group-hover:bg-[#FBBF24]/10 transition-all" />
            <div className="flex items-start gap-5">
              <div className="w-12 h-12 rounded-xl bg-[#FBBF24]/10 border border-[#FBBF24]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#FBBF24]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">Capital Delegation</div>
                <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>Conviction Pools</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">Elite forecasters launch pools. Capitalists delegate USDC. Forecasters earn 20%, capitalists earn 80% of profits.</p>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#FBBF24]/10 border border-[#FBBF24]/20 text-[#FBBF24] text-xs font-mono">Skill becomes investable</span>
              </div>
            </div>
          </div>

          {/* On-Chain Reputation */}
          <div className="group relative rounded-2xl bg-[#0F131C] border border-white/5 p-8 hover:border-[#00FFB2]/30 transition-all duration-300 overflow-hidden cursor-pointer">
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#00FFB2]/5 rounded-full blur-[60px] group-hover:bg-[#00FFB2]/10 transition-all" />
            <div className="flex items-start gap-5">
              <div className="w-12 h-12 rounded-xl bg-[#00FFB2]/10 border border-[#00FFB2]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#00FFB2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">Verifiable Track Record</div>
                <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>On-Chain Reputation</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">Every prediction recorded on Solana. Your Brier score is unfakeable. Build a verifiable forecasting career.</p>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#00FFB2]/10 border border-[#00FFB2]/20 text-[#00FFB2] text-xs font-mono">Portable across platforms</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom insight bar */}
        <div className="mt-6 rounded-xl bg-[#0F131C] border border-white/5 px-8 py-5 flex items-start gap-4">
          <div className="w-5 h-5 rounded-full bg-[#10B981]/20 border border-[#10B981]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
            <div className="w-2 h-2 rounded-full bg-[#10B981]" />
          </div>
          <p className="text-sm font-mono text-gray-400 leading-relaxed">
            <span className="text-white">The edge is information.</span> While others guess, you have AI-powered research, real-time arbitrage detection, and access to the best forecasters&apos; signals.
          </p>
        </div>
      </div>
    </section>
  );
}

function ChooseArchetypeSection() {
  return (
    <section className="py-24 px-6 bg-gradient-to-b from-[#080C14] to-[#0F131C]">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-4xl font-bold text-center mb-16" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>Choose Your Path</h2>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Forecaster */}
          <div className="group relative rounded-2xl bg-[#0F131C] border border-white/5 p-8 hover:border-[#00FFB2]/50 transition-all duration-300 overflow-hidden cursor-pointer">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#00FFB2]/10 rounded-full blur-[50px] group-hover:bg-[#00FFB2]/20 transition-all" />
            <div className="w-12 h-12 rounded-lg bg-[#00FFB2]/10 text-[#00FFB2] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>Forecaster</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">Build reputation through accurate predictions. Reach Elite tier and launch your own Conviction Pool.</p>
            <ul className="space-y-2 text-sm font-mono text-gray-500">
              <li className="flex items-center"><span className="text-[#00FFB2] mr-2">+</span> Earn from pure skill</li>
              <li className="flex items-center"><span className="text-[#00FFB2] mr-2">+</span> 20% performance fee</li>
              <li className="flex items-center"><span className="text-[#00FFB2] mr-2">+</span> $120K/yr potential</li>
            </ul>
          </div>

          {/* Capitalist */}
          <div className="group relative rounded-2xl bg-[#0F131C] border border-white/5 p-8 hover:border-[#10B981]/50 transition-all duration-300 overflow-hidden cursor-pointer">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#10B981]/10 rounded-full blur-[50px] group-hover:bg-[#10B981]/20 transition-all" />
            <div className="w-12 h-12 rounded-lg bg-[#10B981]/10 text-[#10B981] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>Capitalist</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">Invest in proven forecasters, not individual predictions. Delegate USDC to Conviction Pools.</p>
            <ul className="space-y-2 text-sm font-mono text-gray-500">
              <li className="flex items-center"><span className="text-[#10B981] mr-2">+</span> 80% of profits</li>
              <li className="flex items-center"><span className="text-[#10B981] mr-2">+</span> 6.4% APY on idle</li>
              <li className="flex items-center"><span className="text-[#10B981] mr-2">+</span> Exit anytime</li>
            </ul>
          </div>

          {/* Casual */}
          <div className="group relative rounded-2xl bg-[#0F131C] border border-white/5 p-8 hover:border-[#FBBF24]/50 transition-all duration-300 overflow-hidden cursor-pointer">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FBBF24]/10 rounded-full blur-[50px] group-hover:bg-[#FBBF24]/20 transition-all" />
            <div className="w-12 h-12 rounded-lg bg-[#FBBF24]/10 text-[#FBBF24] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>Casual</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">Just want the AI edge. Swipe through markets, get AI insights, trade when you see opportunity.</p>
            <ul className="space-y-2 text-sm font-mono text-gray-500">
              <li className="flex items-center"><span className="text-[#FBBF24] mr-2">+</span> AI edge on every market</li>
              <li className="flex items-center"><span className="text-[#FBBF24] mr-2">+</span> Mobile-first UX</li>
              <li className="flex items-center"><span className="text-[#FBBF24] mr-2">+</span> Start with $1</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCTASection() {
  const { login } = useUser();

  return (
    <section className="py-20 relative overflow-hidden flex flex-col items-center text-center">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-b from-[#00FFB2]/10 to-transparent rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 px-6">
        <h2 className="text-5xl md:text-7xl font-bold mb-8" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
          Ready to prove <br /> you&apos;re right?
        </h2>

        <button
          onClick={login}
          className="inline-flex items-center gap-3 bg-gradient-to-r from-[#00FFB2] to-[#10B981] hover:opacity-90 px-10 py-5 rounded-full transition-all font-semibold text-lg text-[#080C14] cursor-pointer"
        >
          <span>Start Predicting</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </button>

        <p className="mt-6 text-sm text-gray-500 font-mono">
          No KYC required. Non-custodial. You control your funds.
        </p>

        <div className="mt-12 opacity-50 flex items-center justify-center gap-2 font-mono text-xs text-gray-500">
          <span>POWERED BY</span>
          <span className="font-bold text-gray-300">SOLANA</span>
        </div>
      </div>
    </section>
  );
}


// ─────────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="landing-page min-h-screen bg-[#080C14] text-white overflow-x-hidden selection:bg-[#00FFB2] selection:text-[#080C14]">
      {/* Background Glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-[#00FFB2]/5 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-0 w-[800px] h-[600px] bg-[#10B981]/5 rounded-full blur-[100px] pointer-events-none -z-10" />

      <Navigation />
      <LiveTicker />
      <HeroSection />
      <MarketStatsBar />

      {/* NEW: Problem Statement - The Information Gap */}
      <ProblemStatementSection />

      {/* NEW: AI Signal Layer - Multi-Agent Intelligence */}
      <AISignalLayerSection />

      {/* NEW: Live Arbitrage Feed */}
      <LiveArbitrageFeed />

      {/* NEW: Forecaster Network - DeFi Primitive */}
      <ForecasterNetworkSection />

      <LeaderboardSection />
      <HowItWorksSection />
      <FourWaysToProfitSection />
      <ChooseArchetypeSection />
      <FinalCTASection />
      {/* BottomNav from layout.tsx handles navigation */}
      <div className="h-20" /> {/* Spacer for BottomNav */}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;400;600;800&family=JetBrains+Mono:wght@400;500&family=Inter:wght@300;400;500;600&display=swap');

        .landing-page {
          font-family: 'Inter', sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        /* Scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #080C14;
        }
        ::-webkit-scrollbar-thumb {
          background: #1A1F2B;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #2D3442;
        }

        /* Glass Card */
        .glass-card {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
        }

        /* 3D Card Effects */
        .perspective-1000 {
          perspective: 1000px;
        }
        .card-3d-left {
          transform: rotateY(15deg) rotateX(5deg) translateZ(-20px);
          transition: transform 0.3s ease;
        }
        .card-3d-right {
          transform: rotateY(-15deg) rotateX(5deg) translateZ(-20px);
          transition: transform 0.3s ease;
        }
        .card-3d-center {
          transform: translateZ(20px);
          box-shadow: 0 20px 50px -12px rgba(0, 255, 178, 0.25);
          z-index: 10;
        }

        /* Animations */
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
