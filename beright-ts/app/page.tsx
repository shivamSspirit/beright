'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

// Types for the terminal
interface MarketData {
  title: string;
  platform: string;
  probability: number;
  volume: number;
  url: string;
  change24h: number;
}

interface ArbData {
  type: string;
  topic: string;
  spread: number;
  platformA: { name: string; price: number };
  platformB: { name: string; price: number };
  strategy: string;
  profitPercent: number;
}

interface UserStats {
  brierScore: number;
  accuracy: number;
  pendingPredictions: number;
  streak: number;
  streakType: string;
  rank: number | null;
  grade: string;
  // On-chain calibration fields
  isOnChainVerified?: boolean;
  walletAddress?: string;
  tier?: 'superforecaster' | 'elite' | 'verified' | 'rookie' | 'unranked';
  totalPredictions?: number;
  resolvedPredictions?: number;
}

// On-chain calibration data
interface OnChainCalibration {
  walletAddress: string;
  isOnChainVerified: boolean;
  brierScore: number;
  accuracy: number;
  totalPredictions: number;
  resolvedPredictions: number;
  streak: number;
  tier: string;
  grade: string;
  forecasterPda: string;
  programId: string;
}

interface FeedEntry {
  type: string;
  action?: string;
  topic?: string;
  confidence?: number;
  onChain?: boolean;
  txSignature?: string | null;
  timestamp: string;
}

interface BriefData {
  sections: {
    hotMarkets: MarketData[];
    alphaAlerts: ArbData[];
    userStats: UserStats;
    whaleAlerts: any[];
  };
}

// Section type for accordion
type SectionId = 'markets' | 'predictions' | 'arbitrage' | 'feed' | 'onchain';

// Platform colors
const platformColor: Record<string, string> = {
  polymarket: 'badge-polymarket',
  kalshi: 'badge-kalshi',
  manifold: 'badge-manifold',
  limitless: 'badge-limitless',
  metaculus: 'badge-metaculus',
};

function formatUsd(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(0)}`;
}

// Chevron icon component
function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      className={`section-chevron ${isOpen ? 'section-chevron-open' : ''}`}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

// Dropdown component with portal for proper z-index
interface DropdownProps {
  id: SectionId;
  title: string;
  badge?: string | number;
  badgeAlert?: boolean;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  headerClass: string;
  indicatorClass: string;
}

function Dropdown({ id, title, badge, badgeAlert, isOpen, onToggle, children, headerClass, indicatorClass }: DropdownProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate position when opening
  useEffect(() => {
    if (isOpen && triggerRef.current && mounted) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width
      });
    } else if (!isOpen) {
      setPosition(null);
    }
  }, [isOpen, mounted]);

  // Render dropdown via portal only when we have valid position
  const showDropdown = isOpen && mounted && position && position.width > 0;

  return (
    <div className={`dropdown-trigger ${isOpen ? 'dropdown-trigger-active' : ''}`}>
      <button
        ref={triggerRef}
        onClick={onToggle}
        className={`accordion-header ${headerClass}`}
      >
        <div className="accordion-header-content">
          <span className={`accordion-indicator ${indicatorClass}`}></span>
          <span className="accordion-title">{title}</span>
          {badge !== undefined && (
            <span className={`accordion-badge ${badgeAlert ? 'accordion-badge-alert' : ''}`}>
              {badge}
            </span>
          )}
        </div>
        <ChevronIcon isOpen={isOpen} />
      </button>

      {/* Portal-rendered dropdown panel */}
      {showDropdown && createPortal(
        <div
          className="dropdown-panel"
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            width: position.width,
            zIndex: 99999,
          }}
        >
          <div className="dropdown-panel-body">
            {children}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function Terminal() {
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [arbs, setArbs] = useState<ArbData[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [commandInput, setCommandInput] = useState('');
  const [commandOutput, setCommandOutput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [agentStatus, setAgentStatus] = useState<'ONLINE' | 'SCANNING' | 'OFFLINE'>('SCANNING');
  const [lastUpdate, setLastUpdate] = useState('');
  const [expandedSection, setExpandedSection] = useState<SectionId | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // On-chain calibration state
  const [onChainData, setOnChainData] = useState<OnChainCalibration | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [isCheckingOnChain, setIsCheckingOnChain] = useState(false);

  // Fetch on-chain calibration data for a wallet
  const fetchOnChainCalibration = useCallback(async (wallet: string) => {
    if (!wallet) return;
    setIsCheckingOnChain(true);
    try {
      const res = await fetch(`/api/v2/calibration?wallet=${wallet}`);
      if (!res.ok) throw new Error('Failed to fetch on-chain data');
      const data = await res.json();
      if (data.success && data.data?.isOnChainVerified) {
        setOnChainData(data.data);
        // Update stats with on-chain data
        setStats(prev => prev ? {
          ...prev,
          isOnChainVerified: true,
          walletAddress: wallet,
          brierScore: data.data.brierScore,
          accuracy: data.data.accuracy,
          tier: data.data.tier,
          streak: data.data.streak,
          grade: data.data.grade,
        } : {
          brierScore: data.data.brierScore,
          accuracy: data.data.accuracy,
          pendingPredictions: 0,
          streak: data.data.streak,
          streakType: data.data.streak > 0 ? 'win' : 'none',
          rank: null,
          grade: data.data.grade,
          isOnChainVerified: true,
          walletAddress: wallet,
          tier: data.data.tier,
          totalPredictions: data.data.totalPredictions,
          resolvedPredictions: data.data.resolvedPredictions,
        });
      } else {
        setOnChainData(null);
      }
    } catch (err) {
      console.error('On-chain fetch error:', err);
      setOnChainData(null);
    } finally {
      setIsCheckingOnChain(false);
    }
  }, []);

  // Check localStorage for saved wallet on mount
  useEffect(() => {
    const savedWallet = localStorage.getItem('beright_wallet');
    if (savedWallet) {
      setWalletAddress(savedWallet);
      fetchOnChainCalibration(savedWallet);
    }
  }, [fetchOnChainCalibration]);

  // Toggle section - only one can be open at a time
  const toggleSection = (section: SectionId) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  // Fetch real data from APIs
  const fetchData = useCallback(async () => {
    try {
      setAgentStatus('SCANNING');

      // Fetch trending markets from real API
      const marketsRes = await fetch('/api/v2/markets/trending?limit=10');
      if (marketsRes.ok) {
        const marketsData = await marketsRes.json();
        if (marketsData.markets) {
          setMarkets(marketsData.markets.map((m: any) => ({
            title: m.title || m.question || 'Unknown',
            platform: m.platform || 'unknown',
            probability: m.probability || m.yesPrice || 0.5,
            volume: m.volume || 0,
            url: m.url || '',
            change24h: m.change24h || 0,
          })));
        }
      }

      // Fetch arbitrage opportunities
      const arbRes = await fetch('/api/markets?compare=true&limit=5');
      if (arbRes.ok) {
        const arbData = await arbRes.json();
        if (arbData.arbitrage) {
          setArbs(arbData.arbitrage.map((a: any) => ({
            type: 'cross-platform',
            topic: a.topic || a.question || 'Unknown',
            spread: a.spread || 0,
            platformA: { name: a.platformA?.name || 'unknown', price: a.platformA?.price || 0.5 },
            platformB: { name: a.platformB?.name || 'unknown', price: a.platformB?.price || 0.5 },
            strategy: a.strategy || 'arb',
            profitPercent: (a.spread || 0) * 100,
          })));
        }
      }

      setAgentStatus('ONLINE');
      setLastUpdate(new Date().toLocaleTimeString());
      setIsLoading(false);
    } catch (err) {
      console.error('Data fetch error:', err);
      setAgentStatus('OFFLINE');
      setIsLoading(false);
    }
  }, []);

  // Fetch data and connect to SSE feed
  useEffect(() => {
    fetchData();

    // Refresh every 5 minutes
    const refreshInterval = setInterval(fetchData, 5 * 60 * 1000);

    // SSE connection to signals stream (if available)
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/signals/stream');
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'heartbeat' || data.type === 'connected') return;
          if (data.type === 'signal') {
            setFeed(prev => [...prev.slice(-49), {
              type: data.signalType?.toUpperCase() || 'SIGNAL',
              action: data.action,
              topic: data.marketTitle,
              confidence: data.confidence,
              onChain: false,
              timestamp: data.createdAt || new Date().toISOString(),
            }]);
          }
        } catch {
          // ignore parse errors
        }
      };
      eventSource.onerror = () => {
        // Will auto-reconnect
      };
    } catch {
      // SSE not supported
    }

    return () => {
      clearInterval(refreshInterval);
      eventSource?.close();
    };
  }, [fetchData]);

  // Auto-scroll feed
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [feed]);

  // Handle command submission
  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = commandInput.trim();
    if (!cmd) return;

    setCommandInput('');
    setCommandOutput(`> ${cmd}\nSearching...`);

    try {
      const res = await fetch(`/api/markets?q=${encodeURIComponent(cmd)}&compare=true`);
      if (!res.ok) throw new Error('Search failed');
      const data: any = await res.json();

      let output = `> ${cmd}\n\n`;

      if (data.markets && data.markets.length > 0) {
        output += `Found ${data.markets.length} markets:\n\n`;
        for (const m of data.markets.slice(0, 8)) {
          const pct = ((m.yesPrice || m.probability || 0) * 100).toFixed(1);
          output += `  [${(m.platform || '').toUpperCase()}] ${(m.title || m.question || '').slice(0, 50)}\n`;
          output += `  YES: ${pct}%  Vol: ${formatUsd(m.volume || 0)}\n\n`;
        }
      } else {
        output += 'No markets found.\n';
      }

      if (data.arbitrage && data.arbitrage.length > 0) {
        output += `\nArbitrage: ${data.arbitrage.length} opportunities\n`;
        for (const a of data.arbitrage.slice(0, 3)) {
          output += `  ${(a.spread * 100).toFixed(1)}% spread on "${(a.topic || '').slice(0, 30)}"\n`;
        }
      }

      setCommandOutput(output);
    } catch {
      setCommandOutput(`> ${cmd}\nSearch failed. Try again.`);
    }
  };

  const gradeColor = (grade: string) => {
    if (grade === 'A' || grade === 'S') return 'text-green-400';
    if (grade === 'B') return 'text-yellow-400';
    return 'text-gray-400';
  };

  return (
    <div className="terminal-container">
      {/* Header */}
      <header className="terminal-header">
        <div className="flex items-center gap-3">
          <span className="text-green-400 font-bold text-base">BeRight Terminal</span>
          <span className="text-gray-600 text-xs">v1.0</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <a
            href="/swipe"
            className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-md transition-colors"
          >
            Swipe Mode
          </a>
          <span className="text-gray-500">Updated: {lastUpdate || '--:--'}</span>
          <span className="flex items-center gap-1.5">
            <span className={`inline-block w-2 h-2 rounded-full ${
              agentStatus === 'ONLINE' ? 'bg-green-400 status-online' :
              agentStatus === 'SCANNING' ? 'bg-yellow-400 status-online' :
              'bg-red-400'
            }`} />
            <span className={
              agentStatus === 'ONLINE' ? 'text-green-400' :
              agentStatus === 'SCANNING' ? 'text-yellow-400' :
              'text-red-400'
            }>
              Agent: {agentStatus}
            </span>
          </span>
        </div>
      </header>

      {/* Backdrop for closing dropdowns */}
      {expandedSection && (
        <div
          className="dropdown-backdrop dropdown-backdrop-visible"
          onClick={() => setExpandedSection(null)}
        />
      )}

      {/* Dropdown Sections */}
      <div className="dropdown-grid">

        {/* Hot Markets */}
        <Dropdown
          id="markets"
          title="Hot Markets"
          badge={markets.length}
          isOpen={expandedSection === 'markets'}
          onToggle={() => toggleSection('markets')}
          headerClass="accordion-header-markets"
          indicatorClass="accordion-indicator-markets"
        >
          {isLoading ? (
            <p className="text-gray-500 text-xs">Scanning 5 platforms...</p>
          ) : (
            <div className="space-y-2.5">
              {markets.map((m, i) => (
                <div key={i} className="flex items-start justify-between text-xs market-row">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`${platformColor[m.platform] || 'text-gray-400'} uppercase text-[10px] font-semibold`}>
                        {m.platform.slice(0, 4)}
                      </span>
                      <span className="text-gray-300 truncate">{m.title.slice(0, 42)}</span>
                    </div>
                    <div className="text-gray-600 text-[10px] mt-0.5">
                      Vol: {formatUsd(m.volume)}
                    </div>
                  </div>
                  <div className="text-right ml-2 shrink-0">
                    <div className="text-white font-semibold">
                      {(m.probability * 100).toFixed(1)}%
                    </div>
                    {m.change24h !== 0 && (
                      <div className={`text-[10px] ${m.change24h > 0 ? 'price-up' : m.change24h < 0 ? 'price-down' : 'price-neutral'}`}>
                        {m.change24h > 0 ? '+' : ''}{m.change24h.toFixed(1)}pp
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {markets.length === 0 && <p className="text-gray-600 text-xs">No markets loaded</p>}
            </div>
          )}
        </Dropdown>

        {/* Predictions */}
        <Dropdown
          id="predictions"
          title="My Predictions"
          badge={stats?.isOnChainVerified ? `${stats.grade} ✓` : stats?.grade}
          isOpen={expandedSection === 'predictions'}
          onToggle={() => toggleSection('predictions')}
          headerClass="accordion-header-predictions"
          indicatorClass="accordion-indicator-predictions"
        >
          {stats ? (
            <div className="space-y-3">
              {/* On-chain verification badge */}
              {stats.isOnChainVerified && (
                <div className="flex items-center gap-2 px-2 py-1.5 bg-green-900/30 border border-green-700/50 rounded text-xs">
                  <span className="text-green-400">✓ On-Chain Verified</span>
                  <span className="text-gray-500">|</span>
                  <span className="text-green-300 capitalize">{stats.tier}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div className="stat-row">
                  <span className="text-gray-500">Brier Score</span>
                  <span className="text-white font-semibold">
                    {stats.brierScore.toFixed(3)}
                    {stats.isOnChainVerified && <span className="text-green-500 ml-1 text-[10px]">on-chain</span>}
                  </span>
                </div>
                <div className="stat-row">
                  <span className="text-gray-500">Accuracy</span>
                  <span className="text-white font-semibold">{(stats.accuracy * 100).toFixed(0)}%</span>
                </div>
                <div className="stat-row">
                  <span className="text-gray-500">Grade</span>
                  <span className={`font-semibold ${gradeColor(stats.grade)}`}>{stats.grade}</span>
                </div>
                <div className="stat-row">
                  <span className="text-gray-500">Streak</span>
                  <span className="text-white font-semibold">
                    {stats.streak} {stats.streakType === 'win' ? 'W' : stats.streakType === 'loss' ? 'L' : ''}
                  </span>
                </div>
                <div className="stat-row">
                  <span className="text-gray-500">Pending</span>
                  <span className="text-yellow-400 font-semibold">{stats.pendingPredictions}</span>
                </div>
                <div className="stat-row">
                  <span className="text-gray-500">Rank</span>
                  <span className="text-white font-semibold">
                    {stats.rank ? `#${stats.rank}` : '--'}
                  </span>
                </div>
                {stats.totalPredictions !== undefined && (
                  <div className="stat-row col-span-2">
                    <span className="text-gray-500">Predictions</span>
                    <span className="text-white font-semibold">
                      {stats.resolvedPredictions} resolved / {stats.totalPredictions} total
                    </span>
                  </div>
                )}
              </div>
              {/* Wallet connection prompt */}
              {!stats.isOnChainVerified && (
                <div className="mt-2 pt-2 border-t border-gray-800 text-[10px] text-gray-500">
                  Connect wallet to verify on-chain reputation
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-600 text-xs">No predictions yet</p>
          )}
        </Dropdown>

        {/* On-Chain Calibration */}
        <Dropdown
          id="onchain"
          title="On-Chain Stats"
          badge={onChainData ? '✓' : undefined}
          badgeAlert={!!onChainData}
          isOpen={expandedSection === 'onchain'}
          onToggle={() => toggleSection('onchain')}
          headerClass="accordion-header-predictions"
          indicatorClass="accordion-indicator-predictions"
        >
          {onChainData ? (
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 px-2 py-1.5 bg-green-900/30 border border-green-700/50 rounded">
                <span className="text-green-400 font-semibold">Verified Forecaster</span>
                <span className="text-green-300 capitalize ml-auto">{onChainData.tier}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <div className="stat-row">
                  <span className="text-gray-500">Brier</span>
                  <span className="text-white font-semibold">{onChainData.brierScore.toFixed(4)}</span>
                </div>
                <div className="stat-row">
                  <span className="text-gray-500">Accuracy</span>
                  <span className="text-white font-semibold">{(onChainData.accuracy * 100).toFixed(1)}%</span>
                </div>
                <div className="stat-row">
                  <span className="text-gray-500">Resolved</span>
                  <span className="text-white font-semibold">{onChainData.resolvedPredictions}</span>
                </div>
                <div className="stat-row">
                  <span className="text-gray-500">Streak</span>
                  <span className="text-white font-semibold">{onChainData.streak}W</span>
                </div>
              </div>
              <div className="text-[10px] text-gray-600 pt-1 border-t border-gray-800">
                <div className="truncate">Wallet: {onChainData.walletAddress.slice(0, 8)}...{onChainData.walletAddress.slice(-6)}</div>
                <div className="truncate">Program: {onChainData.programId.slice(0, 8)}...</div>
              </div>
            </div>
          ) : isCheckingOnChain ? (
            <p className="text-gray-500 text-xs">Checking on-chain data...</p>
          ) : walletAddress ? (
            <div className="text-xs">
              <p className="text-gray-500">No on-chain calibration data found.</p>
              <p className="text-gray-600 text-[10px] mt-1">Make predictions via Telegram to build your on-chain reputation.</p>
            </div>
          ) : (
            <div className="text-xs space-y-2">
              <p className="text-gray-500">Connect your Solana wallet to view on-chain calibration data.</p>
              <input
                type="text"
                placeholder="Enter Solana wallet address..."
                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-xs placeholder-gray-600"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const target = e.target as HTMLInputElement;
                    const addr = target.value.trim();
                    if (addr.length >= 32) {
                      setWalletAddress(addr);
                      localStorage.setItem('beright_wallet', addr);
                      fetchOnChainCalibration(addr);
                    }
                  }
                }}
              />
              <p className="text-gray-600 text-[10px]">Press ENTER to check on-chain stats</p>
            </div>
          )}
        </Dropdown>

        {/* Arbitrage */}
        <Dropdown
          id="arbitrage"
          title="Arbitrage Radar"
          badge={arbs.length > 0 ? arbs.length : undefined}
          badgeAlert={arbs.length > 0}
          isOpen={expandedSection === 'arbitrage'}
          onToggle={() => toggleSection('arbitrage')}
          headerClass="accordion-header-arbitrage"
          indicatorClass="accordion-indicator-arbitrage"
        >
          <div className="space-y-2.5">
            {arbs.map((a, i) => (
              <div key={i} className="text-xs arb-row">
                <div className="text-gray-300 truncate">{a.topic.slice(0, 50)}</div>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`${platformColor[a.platformA.name] || ''} uppercase text-[10px]`}>
                    {a.platformA.name.slice(0, 4)}: {(a.platformA.price * 100).toFixed(1)}%
                  </span>
                  <span className="text-gray-600">vs</span>
                  <span className={`${platformColor[a.platformB.name] || ''} uppercase text-[10px]`}>
                    {a.platformB.name.slice(0, 4)}: {(a.platformB.price * 100).toFixed(1)}%
                  </span>
                  <span className="text-green-400 font-semibold ml-auto">
                    +{(a.spread * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
            {arbs.length === 0 && (
              <p className="text-gray-600 text-xs">No arbitrage detected (3% threshold)</p>
            )}
          </div>
        </Dropdown>

        {/* Agent Feed */}
        <Dropdown
          id="feed"
          title="Agent Feed"
          badge={feed.length > 0 ? feed.length : undefined}
          isOpen={expandedSection === 'feed'}
          onToggle={() => toggleSection('feed')}
          headerClass="accordion-header-feed"
          indicatorClass="accordion-indicator-feed"
        >
          <div className="space-y-1.5 text-[11px]" ref={feedRef}>
            {feed.length === 0 ? (
              <p className="text-gray-600">Waiting for agent activity...</p>
            ) : (
              feed.map((entry, i) => (
                <div key={i} className="feed-entry flex gap-2">
                  <span className="text-gray-600 shrink-0">
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className={
                    entry.type === 'HEARTBEAT' ? 'text-gray-500' :
                    entry.type === 'ARBITRAGE' ? 'text-amber-400' :
                    entry.type === 'DECISION' ? 'text-green-400' :
                    entry.type === 'PREDICTION' ? 'text-blue-400' :
                    'text-gray-400'
                  }>
                    [{entry.type}]
                  </span>
                  <span className="text-gray-300 truncate">
                    {entry.action && `${entry.action} `}
                    {entry.topic}
                    {entry.confidence ? ` (${entry.confidence}%)` : ''}
                  </span>
                  {entry.onChain && (
                    <span className="text-green-600 shrink-0" title="Logged on-chain">
                      {'\u2713'}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </Dropdown>

      </div>

      {/* Command Output */}
      {commandOutput && (
        <div className="command-output">
          {commandOutput}
        </div>
      )}

      {/* Command Input */}
      <form onSubmit={handleCommand} className="command-input">
        <span className="text-green-400 font-semibold">&gt;</span>
        <input
          ref={inputRef}
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          placeholder="search markets... (e.g. bitcoin, trump 2028, fed rate)"
          className="flex-1 bg-transparent text-white outline-none placeholder-gray-600 text-xs"
          autoFocus
        />
        <span className="text-gray-600 text-xs">ENTER</span>
      </form>
    </div>
  );
}
