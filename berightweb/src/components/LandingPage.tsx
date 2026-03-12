'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import BrandLogo from './BrandLogo';

// ═══════════════════════════════════════════════════════════════════════════════
// BERIGHT LANDING PAGE - Premium Prediction Markets Landing
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────────

const TICKER_ITEMS = [
  { type: 'win', user: '@whale_69', amount: '+$4,200', market: 'Fed Cuts' },
  { type: 'resolved', market: 'Will BTC hit $150k?', result: 'YES' },
  { type: 'price', market: 'ETH/BTC ratio', price: '73¢ YES' },
  { type: 'win', user: '@kash_alpha', amount: '+$1,800', market: 'SOL ETF' },
  { type: 'loss', user: '@rekt_boy', amount: '-$900', market: 'SOL ETF' },
  { type: 'new', market: 'US Election 2024', volume: '+12% Vol' },
];

const LEADERBOARD = [
  { rank: 1, username: '@oracle_mind', brier: 0.124, winRate: 88.4, profit: '+$12,450', isPro: true },
  { rank: 2, username: '@vitalik_stan', brier: 0.156, winRate: 72.1, profit: '+$8,920', isPro: false },
  { rank: 3, username: '@market_maker_0x', brier: 0.182, winRate: 65.8, profit: '+$5,100', isPro: false },
  { rank: 4, username: '@quant_bros', brier: 0.210, winRate: 59.2, profit: '+$3,400', isPro: false },
  { rank: 5, username: '@fomo_sapiens', brier: 0.245, winRate: 51.4, profit: '+$1,200', isPro: false },
];

// ─────────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────────

function Navigation() {
  const { login, ready } = usePrivy();

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-white/[0.08] bg-[#080C14]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 group cursor-pointer">
          <BrandLogo size={32} />
          <span className="font-semibold text-xl tracking-tight text-white group-hover:text-[#00C2FF] transition-colors" style={{ fontFamily: 'Inter, sans-serif' }}>
            BeRight
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
          <a href="#" className="hover:text-white transition-colors">Markets</a>
          <a href="#" className="hover:text-white transition-colors">Docs</a>
          <a href="#" className="hover:text-white transition-colors">FAQ</a>
          <a href="#leaderboard" className="hover:text-white transition-colors">Leaderboard</a>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://t.me/berightbot"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-full transition-all group"
          >
            <svg className="w-4 h-4 text-[#00C2FF]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
            </svg>
            <span className="text-sm font-mono text-[#00C2FF]">Telegram</span>
          </a>

          <button
            onClick={login}
            disabled={!ready}
            className="flex items-center gap-2 bg-gradient-to-r from-[#00C2FF] to-[#10B981] hover:opacity-90 px-5 py-2 rounded-full transition-all font-medium text-sm text-[#080C14] disabled:opacity-50"
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
            <span>🔥</span>
            <span>{item.user}</span>
            <span className="text-[#10B981]">{item.amount}</span>
            <span>on {item.market}</span>
          </span>
        );
      case 'resolved':
        return (
          <span key={index} className="flex items-center gap-2 text-gray-400">
            <span>✅</span>
            <span>{item.market}</span>
            <span className="text-[#00C2FF] bg-[#00C2FF]/10 px-1 rounded">RESOLVED {item.result}</span>
          </span>
        );
      case 'price':
        return (
          <span key={index} className="flex items-center gap-2 text-gray-400">
            <span>📈</span>
            <span>{item.market}</span>
            <span className="text-[#FBBF24]">{item.price}</span>
          </span>
        );
      case 'loss':
        return (
          <span key={index} className="flex items-center gap-2 text-gray-400">
            <span>💀</span>
            <span>{item.user}</span>
            <span className="text-red-500">{item.amount}</span>
            <span>on {item.market}</span>
          </span>
        );
      case 'new':
        return (
          <span key={index} className="flex items-center gap-2 text-gray-400">
            <span>🏆</span>
            <span>New Market:</span>
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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-8 animate-float">
          <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
          <span className="text-xs font-mono uppercase tracking-wider text-[#10B981]">Live Mainnet Beta</span>
        </div>

        {/* Headline */}
        <h1 className="text-6xl md:text-8xl font-bold leading-[0.9] tracking-tight mb-8" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
          Prove You&apos;re <br />
          <span className="bg-gradient-to-r from-white to-[#00C2FF] bg-clip-text text-transparent">Right.</span>
        </h1>

        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-16 font-light">
          The prediction market where forecasting skill becomes a tradeable asset.{' '}
          <span className="text-white">Don&apos;t just say it. Bet it.</span>
        </p>

        {/* 3D Card Stack */}
        <div className="perspective-1000 h-[400px] flex justify-center items-center gap-4 md:gap-8 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00C2FF]/20 rounded-full blur-[100px] pointer-events-none" />

          {/* Left Card */}
          <div className="card-3d-left glass-card w-64 h-80 rounded-2xl p-6 flex-col justify-between hidden md:flex opacity-60 hover:opacity-100 transition-opacity">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">🏀</div>
                <span className="text-xs font-mono text-gray-500">SPORT</span>
              </div>
              <h3 className="text-lg leading-tight mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>Lakers win NBA Finals 2024?</h3>
            </div>
            <div>
              <div className="flex justify-between mb-2 text-sm font-mono">
                <span className="text-[#10B981]">YES 22¢</span>
                <span className="text-gray-500">NO 78¢</span>
              </div>
              <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                <div className="w-[22%] h-full bg-[#10B981]" />
              </div>
            </div>
          </div>

          {/* Center Card */}
          <div className="card-3d-center glass-card w-80 h-96 rounded-2xl p-8 flex flex-col justify-between bg-[#0B1019] border-[#00C2FF]/30">
            <div>
              <div className="flex justify-between items-start mb-6">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00C2FF] to-blue-600 flex items-center justify-center shadow-lg shadow-[#00C2FF]/20 text-white font-bold">₿</div>
                <span className="px-2 py-1 rounded bg-[#00C2FF]/10 text-[#00C2FF] text-xs font-mono border border-[#00C2FF]/20">VOLATILE</span>
              </div>
              <h3 className="text-2xl font-semibold leading-tight mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>Bitcoin breaks $100k by Q4?</h3>
              <p className="text-sm text-gray-500">Expires Dec 31, 2024</p>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-xs text-gray-400 font-mono mb-1">CURRENT PRICE</div>
                  <div className="text-3xl font-mono font-medium text-[#00C2FF]">64¢</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400 font-mono mb-1">VOLUME</div>
                  <div className="text-sm font-mono text-white">$4.2M</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button className="bg-[#10B981]/10 hover:bg-[#10B981]/20 border border-[#10B981]/20 text-[#10B981] font-mono text-sm py-3 rounded-lg transition-colors">BUY YES</button>
                <button className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-mono text-sm py-3 rounded-lg transition-colors">BUY NO</button>
              </div>
            </div>
          </div>

          {/* Right Card */}
          <div className="card-3d-right glass-card w-64 h-80 rounded-2xl p-6 flex-col justify-between hidden md:flex opacity-60 hover:opacity-100 transition-opacity">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">🤖</div>
                <span className="text-xs font-mono text-gray-500">AI</span>
              </div>
              <h3 className="text-lg leading-tight mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>AGI Achieved before 2027?</h3>
            </div>
            <div>
              <div className="flex justify-between mb-2 text-sm font-mono">
                <span className="text-[#FBBF24]">YES 41¢</span>
                <span className="text-gray-500">NO 59¢</span>
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

function SolanaTrustBar() {
  return (
    <section className="border-y border-white/[0.08] bg-[#0F131C]/30 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-wrap justify-center md:justify-between items-center gap-8 md:gap-4 opacity-70">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-purple-500 to-teal-400" />
            <span className="font-semibold tracking-wide" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>SOLANA</span>
          </div>
          <div className="h-4 w-px bg-white/10 hidden md:block" />
          <div className="font-mono text-sm flex items-center gap-2">
            <span className="text-[#10B981]">⚡</span> 400ms Finality
          </div>
          <div className="h-4 w-px bg-white/10 hidden md:block" />
          <div className="font-mono text-sm text-gray-400">$0.00025 Fees</div>
          <div className="h-4 w-px bg-white/10 hidden md:block" />
          <div className="font-mono text-sm text-gray-400">Non-Custodial</div>
          <div className="h-4 w-px bg-white/10 hidden md:block" />
          <div className="font-mono text-sm text-[#00C2FF] flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            On-chain Verification
          </div>
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
            <p className="text-gray-400 font-mono text-sm">Weekly PnL · Verified on-chain</p>
          </div>
          <a href="#" className="text-[#00C2FF] font-mono text-sm hover:underline">View All →</a>
        </div>

        <div className="glass-card rounded-xl overflow-hidden border border-white/[0.08]">
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-white/5 border-b border-white/5 text-xs font-mono text-gray-500 uppercase tracking-wider">
            <div className="col-span-1">#</div>
            <div className="col-span-5">User</div>
            <div className="col-span-2 text-right">Brier Score</div>
            <div className="col-span-2 text-right">Win Rate</div>
            <div className="col-span-2 text-right">Profit</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/5 font-mono text-sm">
            {LEADERBOARD.map((player, i) => (
              <div
                key={player.rank}
                className={`grid grid-cols-12 gap-4 px-6 py-4 items-center transition-colors cursor-pointer ${
                  i === 0 ? 'bg-[#00C2FF]/5 hover:bg-[#00C2FF]/10' : 'hover:bg-white/5'
                }`}
              >
                <div className={`col-span-1 ${i === 0 ? 'text-[#00C2FF] font-bold' : 'text-gray-500'}`}>
                  {String(player.rank).padStart(2, '0')}
                </div>
                <div className="col-span-5 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded ${i === 0 ? 'bg-gradient-to-r from-[#00C2FF] to-blue-500' : 'bg-gray-700'}`} />
                  <span className={`${i === 0 ? 'text-white font-medium' : 'text-gray-300'}`}>{player.username}</span>
                  {player.isPro && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#00C2FF]/20 text-[#00C2FF] border border-[#00C2FF]/20">PRO</span>
                  )}
                </div>
                <div className="col-span-2 text-right text-gray-400">{player.brier.toFixed(3)}</div>
                <div className="col-span-2 text-right text-white">{player.winRate}%</div>
                <div className={`col-span-2 text-right ${i === 0 ? 'text-[#10B981] font-bold' : 'text-[#10B981]'}`}>{player.profit}</div>
              </div>
            ))}
          </div>
        </div>
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
            <span className="text-xs font-mono uppercase tracking-wider text-[#00C2FF]">How It Works</span>
          </div>
          <h2 className="text-4xl font-bold mb-4" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>Three steps to the edge</h2>
          <p className="text-gray-400 font-mono text-sm">No experience required. Skill rewarded.</p>
        </div>

        <div className="relative flex flex-col md:flex-row items-center gap-0">
          {/* Step 1 */}
          <div className="flex-1 flex flex-col items-center text-center px-8">
            <div className="relative w-20 h-20 rounded-2xl bg-[#00C2FF]/10 border border-[#00C2FF]/30 flex items-center justify-center mb-6">
              <svg className="w-9 h-9 text-[#00C2FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18-3a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6m18 0V4.5A2.25 2.25 0 0018.75 2.25H5.25A2.25 2.25 0 003 4.5V6" />
              </svg>
              <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#00C2FF] text-[#080C14] text-xs font-bold font-mono flex items-center justify-center">1</span>
            </div>
            <h3 className="text-xl font-bold mb-3" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>Connect Wallet</h3>
            <p className="text-gray-400 text-sm leading-relaxed">Sign in with email or any Solana wallet. No KYC. Non-custodial. You control your funds.</p>
          </div>

          {/* Connector */}
          <div className="hidden md:flex flex-col items-center gap-1 flex-shrink-0 mb-20">
            <div className="w-12 h-px bg-gradient-to-r from-[#00C2FF]/50 to-[#10B981]/30" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#00C2FF]/40" />
          </div>

          {/* Step 2 */}
          <div className="flex-1 flex flex-col items-center text-center px-8">
            <div className="relative w-20 h-20 rounded-2xl bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center mb-6">
              <svg className="w-9 h-9 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#10B981] text-[#080C14] text-xs font-bold font-mono flex items-center justify-center">2</span>
            </div>
            <h3 className="text-xl font-bold mb-3" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>Browse & Trade</h3>
            <p className="text-gray-400 text-sm leading-relaxed">Buy YES or NO shares at market prices. Shares resolve to $1 if correct, $0 if wrong.</p>
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
            <h3 className="text-xl font-bold mb-3" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>Collect Winnings</h3>
            <p className="text-gray-400 text-sm leading-relaxed">Markets resolve on-chain. Winning shares pay $1. Settle instantly to your wallet.</p>
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
            Four Ways to <span className="bg-gradient-to-r from-white to-[#00C2FF] bg-clip-text text-transparent">Profit</span>
          </h2>
          <p className="text-gray-400 font-mono text-sm">BeRight isn&apos;t gambling. It&apos;s intelligence-driven alpha.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Arbitrage Alerts */}
          <div className="group relative rounded-2xl bg-[#0F131C] border border-white/5 p-8 hover:border-[#00C2FF]/30 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#00C2FF]/5 rounded-full blur-[60px] group-hover:bg-[#00C2FF]/10 transition-all" />
            <div className="flex items-start gap-5">
              <div className="w-12 h-12 rounded-xl bg-[#00C2FF]/10 border border-[#00C2FF]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#00C2FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">Risk-Free Profits</div>
                <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>Arbitrage Alerts</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">Polymarket says 65%. Kalshi says 58%. Our AI spots the gap. You pocket the spread.</p>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#00C2FF]/10 border border-[#00C2FF]/20 text-[#00C2FF] text-xs font-mono">7% spreads detected daily</span>
              </div>
            </div>
          </div>

          {/* Autonomous Loops */}
          <div className="group relative rounded-2xl bg-[#0F131C] border border-white/5 p-8 hover:border-[#10B981]/30 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#10B981]/5 rounded-full blur-[60px] group-hover:bg-[#10B981]/10 transition-all" />
            <div className="flex items-start gap-5">
              <div className="w-12 h-12 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">24/7 Edge Detection</div>
                <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>Autonomous Loops</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">AI agents scan news, social sentiment, and whale movements. You get alerts before the market moves.</p>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981] text-xs font-mono">Set once, profit forever</span>
              </div>
            </div>
          </div>

          {/* Follow Top Forecasters */}
          <div className="group relative rounded-2xl bg-[#0F131C] border border-white/5 p-8 hover:border-[#FBBF24]/30 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#FBBF24]/5 rounded-full blur-[60px] group-hover:bg-[#FBBF24]/10 transition-all" />
            <div className="flex items-start gap-5">
              <div className="w-12 h-12 rounded-xl bg-[#FBBF24]/10 border border-[#FBBF24]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#FBBF24]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">Copy Proven Winners</div>
                <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>Follow Top Forecasters</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">See who has the best Brier score. Mirror their positions. Their research, your returns.</p>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#FBBF24]/10 border border-[#FBBF24]/20 text-[#FBBF24] text-xs font-mono">Top 10 avg 74% win rate</span>
              </div>
            </div>
          </div>

          {/* AI Research Edge */}
          <div className="group relative rounded-2xl bg-[#0F131C] border border-white/5 p-8 hover:border-[#00C2FF]/30 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#00C2FF]/5 rounded-full blur-[60px] group-hover:bg-[#00C2FF]/10 transition-all" />
            <div className="flex items-start gap-5">
              <div className="w-12 h-12 rounded-xl bg-[#00C2FF]/10 border border-[#00C2FF]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#00C2FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">Know More Than the Market</div>
                <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>AI Research Edge</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">Ask any question. Get synthesized intelligence from news, data, and expert analysis in seconds.</p>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#00C2FF]/10 border border-[#00C2FF]/20 text-[#00C2FF] text-xs font-mono">Your personal analyst</span>
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
            <span className="text-white">The edge is information.</span> While others guess, you&apos;ll have AI-powered research, real-time arbitrage detection, and access to the best forecasters&apos; signals.
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
        <h2 className="text-4xl font-bold text-center mb-16" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>Choose Your Archetype</h2>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Forecaster */}
          <div className="group relative rounded-2xl bg-[#0F131C] border border-white/5 p-8 hover:border-[#00C2FF]/50 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#00C2FF]/10 rounded-full blur-[50px] group-hover:bg-[#00C2FF]/20 transition-all" />
            <div className="w-12 h-12 rounded-lg bg-[#00C2FF]/10 text-[#00C2FF] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>Forecaster</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">You analyze data, track trends, and trust your gut. Build reputation and earn from pure skill.</p>
            <ul className="space-y-2 text-sm font-mono text-gray-500">
              <li className="flex items-center"><span className="text-[#00C2FF] mr-2">+</span> High Accuracy Rewards</li>
              <li className="flex items-center"><span className="text-[#00C2FF] mr-2">+</span> Build Track Record</li>
            </ul>
          </div>

          {/* Whale */}
          <div className="group relative rounded-2xl bg-[#0F131C] border border-white/5 p-8 hover:border-[#10B981]/50 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#10B981]/10 rounded-full blur-[50px] group-hover:bg-[#10B981]/20 transition-all" />
            <div className="w-12 h-12 rounded-lg bg-[#10B981]/10 text-[#10B981] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>Whale</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">Capital allocator. You copy-trade the top 1% of forecasters and automate your positions.</p>
            <ul className="space-y-2 text-sm font-mono text-gray-500">
              <li className="flex items-center"><span className="text-[#10B981] mr-2">+</span> Deep Liquidity</li>
              <li className="flex items-center"><span className="text-[#10B981] mr-2">+</span> API Trading Access</li>
            </ul>
          </div>

          {/* Degen */}
          <div className="group relative rounded-2xl bg-[#0F131C] border border-white/5 p-8 hover:border-[#FBBF24]/50 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FBBF24]/10 rounded-full blur-[50px] group-hover:bg-[#FBBF24]/20 transition-all" />
            <div className="w-12 h-12 rounded-lg bg-[#FBBF24]/10 text-[#FBBF24] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>Degen</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">High risk, high reward. You trade obscure markets and leverage early signals for max alpha.</p>
            <ul className="space-y-2 text-sm font-mono text-gray-500">
              <li className="flex items-center"><span className="text-[#FBBF24] mr-2">+</span> 50x Leverage</li>
              <li className="flex items-center"><span className="text-[#FBBF24] mr-2">+</span> Exotic Markets</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCTASection() {
  return (
    <section className="py-32 relative overflow-hidden flex flex-col items-center text-center">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-b from-[#00C2FF]/10 to-transparent rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 px-6">
        <h2 className="text-5xl md:text-7xl font-bold mb-8" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
          Ready to prove <br /> you&apos;re right?
        </h2>

        <div className="group relative inline-block">
          <div className="absolute -inset-1 bg-gradient-to-r from-[#00C2FF] to-[#10B981] rounded-full blur opacity-70 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
          <button className="relative px-12 py-6 bg-black rounded-full leading-none flex items-center divide-x divide-gray-600">
            <span className="flex items-center gap-3 pr-6 text-[#00C2FF] font-bold text-xl tracking-wide group-hover:text-white transition-colors" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
              START TRADING
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </span>
            <span className="pl-6 text-gray-500 font-mono text-sm uppercase tracking-wider group-hover:text-gray-300 transition-colors">Coming Soon</span>
          </button>
        </div>

        <div className="mt-12 opacity-50 flex items-center justify-center gap-2 font-mono text-xs text-gray-500">
          <span>POWERED BY</span>
          <span className="font-bold text-gray-300">SOLANA</span>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.08] py-12 text-center text-gray-600 text-sm font-mono">
      <p>© 2024 BeRight Protocol. All rights reserved.</p>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="landing-page min-h-screen bg-[#080C14] text-white overflow-x-hidden selection:bg-[#00C2FF] selection:text-[#080C14]">
      {/* Background Glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-[#00C2FF]/5 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-0 w-[800px] h-[600px] bg-[#10B981]/5 rounded-full blur-[100px] pointer-events-none -z-10" />

      <Navigation />
      <LiveTicker />
      <HeroSection />
      <SolanaTrustBar />
      <LeaderboardSection />
      <HowItWorksSection />
      <FourWaysToProfitSection />
      <ChooseArchetypeSection />
      <FinalCTASection />
      <Footer />

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
          box-shadow: 0 20px 50px -12px rgba(0, 194, 255, 0.25);
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
