'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useBackendStatus } from '@/hooks/useMarkets';
import { ApiMarket, getDFlowHotMarkets, searchDFlowMarkets, DFlowEvent, getDFlowCandlesticks, DFlowCandleData } from '@/lib/api';
import BottomNav from '@/components/BottomNav';
import TradingModal from '@/components/TradingModal';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES & CONFIG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type Category = 'all' | 'crypto' | 'politics' | 'economics' | 'tech' | 'sports';
type SortOption = 'trending' | 'newest' | 'volume' | 'ending';

const categories: { id: Category; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '' },
  { id: 'crypto', label: 'Crypto', icon: '' },
  { id: 'politics', label: 'Politics', icon: '' },
  { id: 'economics', label: 'Economy', icon: '' },
  { id: 'tech', label: 'Tech', icon: '' },
  { id: 'sports', label: 'Sports', icon: '' },
];

const sortOptions: { id: SortOption; label: string; icon: string }[] = [
  { id: 'trending', label: 'Trending', icon: '' },
  { id: 'newest', label: 'Newest', icon: '' },
  { id: 'volume', label: 'Volume', icon: '' },
  { id: 'ending', label: 'Ending Soon', icon: '' },
];

const ITEMS_PER_PAGE = 20;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CUSTOM DROPDOWN COMPONENT (Portal-based)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface DropdownOption<T> {
  id: T;
  label: string;
  icon?: string;
  color?: string;
}

interface DropdownProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: DropdownOption<T>[];
}

function Dropdown<T extends string>({ value, onChange, options }: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.id === value);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: Math.max(rect.width, 180)
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const menuContent = isOpen && mounted && menuPosition.width > 0 ? createPortal(
    <div
      ref={menuRef}
      className="portal-dropdown-menu"
      style={{
        position: 'fixed',
        top: menuPosition.top,
        left: menuPosition.left,
        minWidth: menuPosition.width,
        zIndex: 99999,
      }}
    >
      {options.map((option) => (
        <button
          key={option.id}
          className={`portal-dropdown-item ${value === option.id ? 'selected' : ''}`}
          onClick={() => {
            onChange(option.id);
            setIsOpen(false);
          }}
          type="button"
        >
          {option.icon && <span className="item-icon">{option.icon}</span>}
          {option.color && !option.icon && (
            <span className="item-dot" style={{ background: option.color }} />
          )}
          <span className="item-label">{option.label}</span>
          {value === option.id && (
            <svg className="item-check" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <div className={`dropdown ${isOpen ? 'open' : ''}`}>
      <button
        ref={triggerRef}
        className="dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        {selectedOption?.icon && <span className="dropdown-icon">{selectedOption.icon}</span>}
        <span className="dropdown-label">{selectedOption?.label}</span>
        <svg className="dropdown-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {menuContent}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) return `$${(volume / 1_000_000_000).toFixed(1)}B`;
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1_000) return `$${Math.round(volume / 1_000)}K`;
  return `$${volume}`;
}

function formatDate(dateStr: string | null): { text: string; isLive: boolean } {
  if (!dateStr) return { text: 'TBD', isLive: false };

  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 1 && diffDays >= 0) {
    return { text: 'LIVE', isLive: true };
  }

  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();

  return { text: `${month} ${day}`, isLive: false };
}

function categorizeMarket(title: string): Category {
  const lower = title.toLowerCase();
  if (lower.includes('bitcoin') || lower.includes('btc') || lower.includes('eth') || lower.includes('crypto') || lower.includes('solana')) return 'crypto';
  if (lower.includes('trump') || lower.includes('biden') || lower.includes('election') || lower.includes('president')) return 'politics';
  if (lower.includes('fed') || lower.includes('rate') || lower.includes('inflation') || lower.includes('recession') || lower.includes('tariff')) return 'economics';
  if (lower.includes('ai') || lower.includes('spacex') || lower.includes('tesla') || lower.includes('gpt')) return 'tech';
  if (lower.includes('nba') || lower.includes('nfl') || lower.includes('championship') || lower.includes('super bowl')) return 'sports';
  return 'politics';
}

function getMultiplier(pct: number): string {
  if (pct <= 0) return '—';
  return (100 / pct).toFixed(1) + 'x';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER: Format time remaining
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function formatTimeRemaining(dateStr: string | null): string {
  if (!dateStr) return 'TBD';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  if (diffMs <= 0) return 'Ended';

  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffHours < 24) return `${Math.ceil(diffHours)}h`;
  if (diffDays < 7) return `${Math.ceil(diffDays)}d`;
  if (diffDays < 30) return `${Math.ceil(diffDays / 7)}w`;
  return `${Math.ceil(diffDays / 30)}mo`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VIRAL SPARKLINE CHART (Clean & Punchy)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface SparkPoint {
  value: number;
}

function generateSparkData(currentPrice: number, seed: string): SparkPoint[] {
  const seedNum = seed.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const points: SparkPoint[] = [];
  let price = currentPrice * 0.8;

  for (let i = 0; i < 20; i++) {
    const volatility = 0.06 + ((seedNum * (i + 1)) % 100) / 1500;
    const trend = (seedNum % 2 === 0) ? 0.015 : -0.008;
    const change = (Math.sin(seedNum + i * 0.8) * volatility) + trend;
    price = Math.max(5, Math.min(95, price * (1 + change)));
    points.push({ value: price });
  }

  // Ensure last point is current price
  if (points.length > 0) {
    points[points.length - 1].value = currentPrice;
  }

  return points;
}

// Transform API candles to spark points
function transformToSparkPoints(apiCandles: DFlowCandleData[]): SparkPoint[] {
  return apiCandles.slice(-20).map(c => ({ value: c.close * 100 }));
}

// Global cache for spark data
const sparkCache = new Map<string, { data: SparkPoint[]; timestamp: number }>();
const SPARK_CACHE_TTL = 60000;

function ViralSparkline({ price, marketId, ticker }: { price: number; marketId: string; ticker?: string }) {
  const [realData, setRealData] = useState<SparkPoint[] | null>(null);

  useEffect(() => {
    if (!ticker) return;

    const cached = sparkCache.get(ticker);
    if (cached && Date.now() - cached.timestamp < SPARK_CACHE_TTL) {
      setRealData(cached.data);
      return;
    }

    getDFlowCandlesticks(ticker, '1h')
      .then(response => {
        if (response.success && response.candles?.length > 0) {
          const transformed = transformToSparkPoints(response.candles);
          sparkCache.set(ticker, { data: transformed, timestamp: Date.now() });
          setRealData(transformed);
        }
      })
      .catch(() => {});
  }, [ticker]);

  const points = useMemo(() => {
    if (realData && realData.length > 0) return realData;
    return generateSparkData(price, marketId);
  }, [realData, price, marketId]);

  const values = points.map(p => p.value);
  const min = Math.min(...values) * 0.92;
  const max = Math.max(...values) * 1.08;
  const range = max - min || 1;

  const width = 100;
  const height = 44;
  const paddingY = 6;
  const paddingRight = 8; // Space for pulse dot glow
  const drawWidth = width - paddingRight;

  const pathData = points.map((p, i) => {
    const x = (i / (points.length - 1)) * drawWidth;
    const y = paddingY + (height - paddingY * 2) - ((p.value - min) / range) * (height - paddingY * 2);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');

  const areaPath = `${pathData} L ${drawWidth} ${height} L 0 ${height} Z`;

  const firstVal = values[0];
  const lastVal = values[values.length - 1];
  const isUp = lastVal >= firstVal;
  const changePercent = ((lastVal - firstVal) / firstVal * 100).toFixed(1);
  const lastY = paddingY + (height - paddingY * 2) - ((lastVal - min) / range) * (height - paddingY * 2);

  // Create unique IDs for this instance
  const gradId = `spark-grad-${marketId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const glowId = `spark-glow-${marketId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const pulseGlowId = `pulse-glow-${marketId.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div className="viral-spark">
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          {/* Gradient fill under the line */}
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isUp ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255, 82, 82, 0.3)'} />
            <stop offset="60%" stopColor={isUp ? 'rgba(0, 230, 118, 0.08)' : 'rgba(255, 82, 82, 0.08)'} />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          {/* Line glow effect */}
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Pulse dot outer glow */}
          <filter id={pulseGlowId} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Gradient fill area */}
        <path d={areaPath} fill={`url(#${gradId})`} />

        {/* Main line with glow */}
        <path
          d={pathData}
          fill="none"
          stroke={isUp ? '#00E676' : '#FF5252'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${glowId})`}
        />

        {/* Outer glow ring for pulse dot */}
        <circle
          cx={drawWidth}
          cy={lastY}
          r="5"
          fill={isUp ? 'rgba(0, 230, 118, 0.25)' : 'rgba(255, 82, 82, 0.25)'}
          className="pulse-ring"
        />

        {/* Main pulse dot */}
        <circle
          cx={drawWidth}
          cy={lastY}
          r="3"
          fill={isUp ? '#00E676' : '#FF5252'}
          filter={`url(#${pulseGlowId})`}
          className="pulse-dot"
        />

        {/* Inner bright dot */}
        <circle
          cx={drawWidth}
          cy={lastY}
          r="1.5"
          fill="#fff"
          opacity="0.85"
        />
      </svg>

      {/* Change percentage badge */}
      <div className={`spark-badge ${isUp ? 'up' : 'down'}`}>
        <span className="spark-arrow">{isUp ? '↑' : '↓'}</span>
        <span className="spark-pct">{Math.abs(parseFloat(changePercent))}%</span>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MARKET CARD - Clean Data-Rich Trading Card
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface MarketCardProps {
  market: MarketWithDFlow;
  onTrade?: (market: MarketWithDFlow) => void;
  index: number;
}

function MarketCard({ market, onTrade, index }: MarketCardProps) {
  const [imgError, setImgError] = useState(false);
  const hasDFlow = !!market.dflow;
  const marketTitle = market.question || market.title;
  const imageUrl = market.dflow?.imageUrl; // Only use if actually provided by API
  const showImage = imageUrl && !imgError;

  // Calculate 24h change (mock based on seed for now, real data would come from API)
  const seedNum = (market.id || market.title).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const change24h = ((seedNum % 20) - 10) * 0.5;
  const isUp = change24h >= 0;

  // Spread calculation
  const spread = market.dflow ? Math.abs((market.dflow.yesAsk || 0) - (market.dflow.yesBid || 0)) : 0;

  // Time remaining
  const timeLeft = formatTimeRemaining(market.endDate);
  const isLive = timeLeft !== 'TBD' && timeLeft !== 'Ended' && parseInt(timeLeft) <= 24 && timeLeft.includes('h');

  return (
    <div
      className="compact-card"
      style={{ '--delay': `${index * 35}ms` } as React.CSSProperties}
    >
      {/* Only show image if API provides one and it loads successfully */}
      {showImage && (
        <div className="card-media">
          <img
            src={imageUrl}
            alt={marketTitle}
            className="media-img"
            loading="lazy"
            onError={() => setImgError(true)}
          />
          <div className="media-overlay" />
        </div>
      )}

      {/* Content Section */}
      <div className="card-content">
        {/* Title */}
        <h3 className="card-title">{marketTitle}</h3>

        {/* Price Row - YES/NO with spread */}
        <div className="price-row">
          <div className="price-yes">
            <span className="price-label">YES</span>
            <span className="price-value">{market.yesPct}c</span>
          </div>
          <div className="price-spread">
            <span className="spread-value">{spread > 0 ? `${spread.toFixed(0)}c` : '-'}</span>
            <span className="spread-label">spread</span>
          </div>
          <div className="price-no">
            <span className="price-label">NO</span>
            <span className="price-value">{market.noPct}c</span>
          </div>
        </div>

        {/* Probability Bar */}
        <div className="prob-bar">
          <div className="prob-fill" style={{ width: `${market.yesPct}%` }} />
        </div>

        {/* Sparkline */}
        <div className="spark-row">
          <ViralSparkline
            price={market.yesPct}
            marketId={market.id || market.title}
            ticker={market.dflow?.ticker}
          />
        </div>

        {/* Stats Row */}
        <div className="stats-row">
          <div className="stat">
            <span className="stat-value">{formatVolume(market.volume)}</span>
            <span className="stat-label">vol</span>
          </div>
          <div className={`stat change ${isUp ? 'up' : 'down'}`}>
            <span className="stat-value">{isUp ? '+' : ''}{change24h.toFixed(1)}%</span>
            <span className="stat-label">24h</span>
          </div>
          <div className={`stat time ${isLive ? 'live' : ''}`}>
            <span className="stat-value">{timeLeft}</span>
            <span className="stat-label">{isLive ? 'live' : 'left'}</span>
          </div>
        </div>
      </div>

      {/* Trade button */}
      {hasDFlow && (
        <button className="trade-btn" type="button" onClick={() => onTrade?.(market)}>
          Trade
        </button>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SKELETON CARD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SkeletonCard({ index }: { index: number }) {
  return (
    <div className="skeleton-card" style={{ animationDelay: `${index * 50}ms` }}>
      <div className="skeleton-title" />
      <div className="skeleton-date" />
      <div className="skeleton-outcomes">
        <div className="skeleton-outcome" />
        <div className="skeleton-outcome" />
      </div>
      <div className="skeleton-footer" />
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface MarketWithDFlow extends ApiMarket {
  dflow?: DFlowEvent;
}

function dflowToApiMarket(event: DFlowEvent): MarketWithDFlow {
  // Construct DFlow URL - use their app instead of Kalshi
  const dflowUrl = `https://dflow.net/market/${event.ticker}`;

  return {
    id: event.ticker,
    platform: 'dflow',
    title: event.title,
    question: event.title,
    yesPrice: event.yesPrice || 0,
    noPrice: event.noPrice || 0,
    yesPct: Math.round(event.yesPct || 0),
    noPct: Math.round(event.noPct || 0),
    volume: event.volume || 0,
    liquidity: event.liquidity || 0,
    endDate: event.strikeDate ? new Date(event.strikeDate * 1000).toISOString() : null,
    status: event.status as any || 'active',
    url: dflowUrl,
    dflow: event,
  };
}

export default function MarketsPage() {
  const { isConnected } = useBackendStatus();
  const { login, authenticated, ready } = usePrivy();
  const { wallets } = useWallets();

  const [markets, setMarkets] = useState<MarketWithDFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const [selectedSort, setSelectedSort] = useState<SortOption>('trending');

  // Pagination state
  const [cursor, setCursor] = useState<number>(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalLoaded, setTotalLoaded] = useState(0);

  // Trading modal state
  const [tradingMarket, setTradingMarket] = useState<MarketWithDFlow | null>(null);

  // Get wallet address from Privy
  const solanaWallet = wallets.find(w =>
    w.walletClientType === 'privy' ||
    w.walletClientType === 'phantom' ||
    w.walletClientType === 'solflare'
  );
  const walletAddress = solanaWallet?.address;

  const fetchMarkets = useCallback(async (isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setCursor(0);
      setMarkets([]);
    }

    try {
      const currentCursor = isLoadMore ? cursor : 0;
      const limit = ITEMS_PER_PAGE;

      // Fetch with cursor-based pagination
      const dflowResponse = searchQuery
        ? await searchDFlowMarkets(searchQuery, limit + currentCursor)
        : await getDFlowHotMarkets(limit + currentCursor);

      if (dflowResponse.success) {
        const allMarkets = dflowResponse.events.map(dflowToApiMarket);
        const newMarkets = isLoadMore
          ? allMarkets.slice(currentCursor)
          : allMarkets;

        if (isLoadMore) {
          setMarkets(prev => [...prev, ...newMarkets]);
        } else {
          setMarkets(newMarkets);
        }

        setTotalLoaded(allMarkets.length);
        setHasMore(newMarkets.length >= limit);
        setCursor(currentCursor + newMarkets.length);
      } else {
        if (!isLoadMore) setMarkets([]);
        setHasMore(false);
      }
    } catch {
      if (!isLoadMore) setMarkets([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchQuery, cursor]);

  // Initial fetch
  useEffect(() => {
    fetchMarkets(false);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => fetchMarkets(false), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter and sort markets
  const filteredMarkets = useMemo(() => {
    let filtered = markets;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(m => categorizeMarket(m.title) === selectedCategory);
    }

    // Apply sorting
    switch (selectedSort) {
      case 'volume':
        filtered = [...filtered].sort((a, b) => (b.volume || 0) - (a.volume || 0));
        break;
      case 'ending':
        filtered = [...filtered].sort((a, b) => {
          if (!a.endDate) return 1;
          if (!b.endDate) return -1;
          return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
        });
        break;
      case 'newest':
        break;
      case 'trending':
      default:
        break;
    }

    return filtered;
  }, [markets, selectedCategory, selectedSort]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchMarkets(true);
    }
  };

  return (
    <div className="markets-page">
      {/* Header */}
      <header className="markets-header">
        <div className="header-top">
          <Link href="/" className="back-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="page-title">Markets</h1>
          <div className="header-right">
            {ready && !authenticated ? (
              <button className="connect-wallet-btn" onClick={login}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 7V4a1 1 0 00-1-1H5a2 2 0 00-2 2v14a2 2 0 002 2h13a1 1 0 001-1v-4" />
                  <path d="M16 10h6M18 8v4" />
                </svg>
                Connect
              </button>
            ) : walletAddress ? (
              <div className="wallet-badge">
                <span className="wallet-dot" />
                {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
              </div>
            ) : (
              <div className={`status-badge ${isConnected ? 'live' : ''}`}>
                <span className="status-dot" />
                {isConnected ? 'Live' : 'Demo'}
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="search-container">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search markets..."
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')} type="button">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.5 3.5L3.5 10.5M3.5 3.5l7 7" />
              </svg>
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="filters-container">
          <Dropdown
            value={selectedSort}
            onChange={setSelectedSort}
            options={sortOptions}
          />
          <Dropdown
            value={selectedCategory}
            onChange={setSelectedCategory}
            options={categories}
          />
        </div>

        {/* Results info */}
        <div className="results-info">
          <span className="results-count">{filteredMarkets.length} markets</span>
          <span className="data-source dflow">
            <span className="source-dot" />
            DFlow
          </span>
        </div>
      </header>

      {/* Market Grid */}
      <main className="markets-main">
        {loading ? (
          <div className="markets-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} index={i} />
            ))}
          </div>
        ) : filteredMarkets.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">No markets found</p>
            <p className="empty-hint">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <div className="markets-grid">
              {filteredMarkets.map((market, index) => (
                <MarketCard
                  key={market.id}
                  market={market}
                  onTrade={setTradingMarket}
                  index={index}
                />
              ))}
            </div>

            {/* Pagination / Load More */}
            {hasMore && (
              <div className="load-more-container">
                <button
                  className={`load-more-btn ${loadingMore ? 'loading' : ''}`}
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <>
                      <span className="spinner" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      Load More Markets
                    </>
                  )}
                </button>
                <span className="pagination-info">
                  Showing {filteredMarkets.length} of {totalLoaded}+ markets
                </span>
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />

      {/* Trading Modal */}
      {tradingMarket && tradingMarket.dflow && (
        <TradingModal
          isOpen={true}
          onClose={() => setTradingMarket(null)}
          prediction={{
            id: tradingMarket.id || tradingMarket.dflow.ticker,
            question: tradingMarket.question || tradingMarket.title,
            marketOdds: tradingMarket.yesPct,
            source: 'dflow',
            endDate: tradingMarket.endDate ?? undefined,
            dflow: {
              ticker: tradingMarket.dflow.ticker,
              seriesTicker: tradingMarket.dflow.seriesTicker || '',
              volume24h: tradingMarket.dflow.volume24h || tradingMarket.dflow.volume || 0,
              yesBid: tradingMarket.dflow.yesBid || 0,
              yesAsk: tradingMarket.dflow.yesAsk || 0,
              noBid: tradingMarket.dflow.noBid || 0,
              noAsk: tradingMarket.dflow.noAsk || 0,
              spread: tradingMarket.dflow.spread || 0,
              tokens: tradingMarket.dflow.tokens,
            },
          }}
        />
      )}

      <style jsx>{`
        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           VIRAL MARKET CARDS - Premium Trading Aesthetic
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

        .markets-page {
          min-height: 100dvh;
          background: linear-gradient(180deg, #0A0A0C 0%, #111114 50%, #0A0A0C 100%);
          padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
        }

        /* ━━━ HEADER ━━━ */
        .markets-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(10, 10, 12, 0.85);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          padding-top: env(safe-area-inset-top, 0px);
        }

        .header-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
        }

        .back-btn {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          color: rgba(255, 255, 255, 0.6);
          transition: all 0.2s;
        }
        .back-btn:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }

        .page-title {
          font-size: 18px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.03em;
          text-transform: uppercase;
        }

        .header-right { display: flex; align-items: center; }

        .status-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 20px;
          font-size: 10px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .status-badge.live { background: rgba(0, 255, 136, 0.12); color: #00FF88; }
        .status-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
        .status-badge.live .status-dot { box-shadow: 0 0 8px currentColor; animation: pulse-glow 2s infinite; }

        @keyframes pulse-glow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.9); }
        }

        .connect-wallet-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: linear-gradient(135deg, #00FF88 0%, #00CC6A 100%);
          border: none;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 700;
          color: #000;
          cursor: pointer;
          transition: all 0.2s;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .connect-wallet-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(0, 255, 136, 0.3); }
        .connect-wallet-btn svg { stroke: #000; }

        .wallet-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(0, 255, 136, 0.1);
          border: 1px solid rgba(0, 255, 136, 0.2);
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          font-family: 'SF Mono', 'Fira Code', monospace;
          color: #00FF88;
        }
        .wallet-dot { width: 6px; height: 6px; border-radius: 50%; background: #00FF88; box-shadow: 0 0 8px #00FF88; }

        /* ━━━ SEARCH ━━━ */
        .search-container {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 8px 16px 10px;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          transition: all 0.2s;
        }
        .search-container:focus-within {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(0, 255, 136, 0.3);
          box-shadow: 0 0 0 3px rgba(0, 255, 136, 0.08);
        }
        .search-container svg { color: rgba(255, 255, 255, 0.3); flex-shrink: 0; }
        .search-container input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-size: 14px;
          font-weight: 500;
          color: #fff;
        }
        .search-container input::placeholder { color: rgba(255, 255, 255, 0.3); }
        .search-clear {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 6px;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          transition: all 0.15s;
        }
        .search-clear:hover { background: rgba(255, 255, 255, 0.15); color: #fff; }

        /* ━━━ FILTERS ━━━ */
        .filters-container {
          display: flex;
          gap: 8px;
          padding: 0 16px 8px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .filters-container::-webkit-scrollbar { display: none; }
        .filters-container :global(.dropdown) { position: relative; flex-shrink: 0; }
        .filters-container :global(.dropdown-trigger) {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .filters-container :global(.dropdown-trigger:hover) {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.12);
        }
        .filters-container :global(.dropdown.open .dropdown-trigger) {
          background: rgba(0, 255, 136, 0.1);
          border-color: rgba(0, 255, 136, 0.3);
          color: #00FF88;
        }
        .filters-container :global(.dropdown-icon) { font-size: 11px; }
        .filters-container :global(.dropdown-label) { max-width: 80px; overflow: hidden; text-overflow: ellipsis; }
        .filters-container :global(.dropdown-arrow) { color: rgba(255, 255, 255, 0.4); transition: transform 0.2s; flex-shrink: 0; }
        .filters-container :global(.dropdown.open .dropdown-arrow) { transform: rotate(180deg); color: #00FF88; }

        /* Portal dropdown */
        :global(.portal-dropdown-menu) {
          padding: 6px;
          background: rgba(20, 20, 24, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          box-shadow: 0 20px 50px -15px rgba(0, 0, 0, 0.8);
          animation: dropEnter 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes dropEnter {
          from { opacity: 0; transform: translateY(-8px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        :global(.portal-dropdown-item) {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 9px 12px;
          background: transparent;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          transition: all 0.15s;
          text-align: left;
        }
        :global(.portal-dropdown-item:hover) { background: rgba(255, 255, 255, 0.06); color: #fff; }
        :global(.portal-dropdown-item.selected) { background: rgba(0, 255, 136, 0.12); color: #00FF88; }
        :global(.portal-dropdown-item .item-icon) { font-size: 14px; width: 20px; text-align: center; }
        :global(.portal-dropdown-item .item-label) { flex: 1; }
        :global(.portal-dropdown-item .item-check) { color: #00FF88; flex-shrink: 0; }

        /* Results info */
        .results-info {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 16px 10px;
        }
        .results-count {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.35);
          font-family: 'SF Mono', monospace;
          font-weight: 500;
        }
        .data-source {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .data-source.dflow { background: rgba(0, 255, 136, 0.1); color: #00FF88; }
        .source-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; animation: pulse-glow 2s infinite; }

        /* ━━━ MAIN GRID ━━━ */
        .markets-main {
          padding: 8px 12px;
          max-width: 1400px;
          margin: 0 auto;
        }
        .markets-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           COMPACT CARD - Clean Data-Rich Design (FIXED HEIGHT)
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        .markets-grid :global(.compact-card) {
          position: relative;
          display: flex;
          flex-direction: column;
          height: 250px;
          min-height: 250px;
          max-height: 250px;
          background: rgba(14, 14, 18, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          overflow: hidden;
          animation: cardPop 0.35s cubic-bezier(0.16, 1, 0.3, 1) backwards;
          animation-delay: var(--delay);
          transition: all 0.2s ease;
        }
        @keyframes cardPop {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .markets-grid :global(.compact-card:hover) {
          border-color: rgba(255, 255, 255, 0.12);
          box-shadow: 0 8px 24px -8px rgba(0, 0, 0, 0.5);
        }

        /* ━━━ IMAGE SECTION (Only when API provides image) ━━━ */
        .markets-grid :global(.card-media) {
          position: relative;
          height: 70px;
          flex-shrink: 0;
          overflow: hidden;
        }
        .markets-grid :global(.media-img) {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .markets-grid :global(.media-overlay) {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(14, 14, 18, 1) 0%, transparent 100%);
          pointer-events: none;
        }

        /* ━━━ CONTENT SECTION ━━━ */
        .markets-grid :global(.card-content) {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 10px;
          text-decoration: none;
          color: inherit;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }
        .markets-grid :global(.card-title) {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.88);
          line-height: 1.35;
          height: 30px;
          min-height: 30px;
          max-height: 30px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          letter-spacing: -0.01em;
        }

        /* ━━━ PRICE ROW - YES/NO/SPREAD ━━━ */
        .markets-grid :global(.price-row) {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 4px;
        }
        .markets-grid :global(.price-yes),
        .markets-grid :global(.price-no) {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
        }
        .markets-grid :global(.price-label) {
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .markets-grid :global(.price-yes .price-label) { color: #00E676; }
        .markets-grid :global(.price-no .price-label) { color: #FF5252; }
        .markets-grid :global(.price-value) {
          font-size: 14px;
          font-weight: 800;
          font-family: 'SF Mono', 'Fira Code', monospace;
          letter-spacing: -0.02em;
        }
        .markets-grid :global(.price-yes .price-value) { color: #00E676; }
        .markets-grid :global(.price-no .price-value) { color: #FF5252; }
        .markets-grid :global(.price-spread) {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
          padding: 2px 6px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 4px;
        }
        .markets-grid :global(.spread-value) {
          font-size: 10px;
          font-weight: 700;
          font-family: 'SF Mono', monospace;
          color: rgba(255, 255, 255, 0.5);
        }
        .markets-grid :global(.spread-label) {
          font-size: 7px;
          color: rgba(255, 255, 255, 0.3);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        /* ━━━ PROBABILITY BAR ━━━ */
        .markets-grid :global(.prob-bar) {
          height: 3px;
          background: rgba(255, 82, 82, 0.2);
          border-radius: 2px;
          overflow: hidden;
        }
        .markets-grid :global(.prob-fill) {
          height: 100%;
          background: #00E676;
          border-radius: 2px;
          transition: width 0.3s ease;
        }

        /* ━━━ SPARKLINE ROW - Visual Centerpiece ━━━ */
        .markets-grid :global(.spark-row) {
          height: 48px;
          min-height: 48px;
          flex-shrink: 0;
          margin: 4px 0;
          position: relative;
        }
        .markets-grid :global(.viral-spark) {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .markets-grid :global(.viral-spark svg) {
          display: block;
          flex: 1;
          height: 100%;
          min-width: 0;
        }

        /* Pulse ring animation */
        .markets-grid :global(.pulse-ring) {
          animation: pulse-ring 2s ease-in-out infinite;
          transform-origin: center;
        }
        @keyframes pulse-ring {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 0.2; transform: scale(1.4); }
        }

        /* Pulse dot glow */
        .markets-grid :global(.pulse-dot) {
          animation: pulse-dot 2s ease-in-out infinite;
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        /* Change badge - inline next to chart */
        .markets-grid :global(.spark-badge) {
          position: relative;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 3px 6px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 700;
          font-family: 'SF Mono', 'Fira Code', monospace;
        }
        .markets-grid :global(.spark-badge.up) {
          background: rgba(0, 230, 118, 0.12);
          color: #00E676;
        }
        .markets-grid :global(.spark-badge.down) {
          background: rgba(255, 82, 82, 0.12);
          color: #FF5252;
        }
        .markets-grid :global(.spark-arrow) {
          font-size: 8px;
        }
        .markets-grid :global(.spark-pct) {
          letter-spacing: -0.02em;
        }

        .markets-grid :global(.spark-change) {
          display: none;
        }

        /* ━━━ STATS ROW ━━━ */
        .markets-grid :global(.stats-row) {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 4px;
          margin-top: auto;
        }
        .markets-grid :global(.stat) {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
        }
        .markets-grid :global(.stat-value) {
          font-size: 10px;
          font-weight: 700;
          font-family: 'SF Mono', monospace;
          color: rgba(255, 255, 255, 0.7);
        }
        .markets-grid :global(.stat-label) {
          font-size: 7px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.3);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .markets-grid :global(.stat.change.up .stat-value) { color: #00E676; }
        .markets-grid :global(.stat.change.down .stat-value) { color: #FF5252; }
        .markets-grid :global(.stat.time.live .stat-value) { color: #00E676; }
        .markets-grid :global(.stat.time.live .stat-label) { color: #00E676; }

        /* ━━━ TRADE BUTTON ━━━ */
        .markets-grid :global(.trade-btn) {
          margin: 0 10px 8px;
          padding: 7px;
          background: transparent;
          border: 1px solid rgba(0, 230, 118, 0.3);
          border-radius: 6px;
          font-size: 10px;
          font-weight: 700;
          color: #00E676;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .markets-grid :global(.trade-btn:hover) {
          background: rgba(0, 230, 118, 0.1);
          border-color: rgba(0, 230, 118, 0.5);
        }
        .markets-grid :global(.trade-btn:active) {
          transform: scale(0.98);
        }

        /* ━━━ SKELETON ━━━ */
        .markets-grid :global(.skeleton-card) {
          padding: 12px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          animation: skeleton-pulse 1.5s ease-in-out infinite;
        }
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .markets-grid :global(.skeleton-title),
        .markets-grid :global(.skeleton-date),
        .markets-grid :global(.skeleton-outcome),
        .markets-grid :global(.skeleton-footer) {
          background: linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 100%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 6px;
        }
        .markets-grid :global(.skeleton-title) { height: 12px; width: 85%; margin-bottom: 8px; }
        .markets-grid :global(.skeleton-date) { height: 32px; width: 50%; margin-bottom: 10px; }
        .markets-grid :global(.skeleton-outcomes) { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
        .markets-grid :global(.skeleton-outcome) { height: 4px; }
        .markets-grid :global(.skeleton-footer) { height: 28px; margin-top: 8px; }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ━━━ EMPTY STATE ━━━ */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
        }
        .empty-title { font-size: 16px; font-weight: 700; color: rgba(255, 255, 255, 0.8); margin-bottom: 6px; }
        .empty-hint { font-size: 13px; color: rgba(255, 255, 255, 0.4); }

        /* ━━━ LOAD MORE ━━━ */
        .load-more-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 24px 0;
          margin-top: 8px;
        }
        .load-more-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 28px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          font-size: 13px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.8);
          cursor: pointer;
          transition: all 0.2s;
          min-width: 180px;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .load-more-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(0, 255, 136, 0.3);
          color: #fff;
        }
        .load-more-btn:disabled { cursor: not-allowed; opacity: 0.6; }
        .load-more-btn.loading {
          background: rgba(0, 255, 136, 0.08);
          border-color: rgba(0, 255, 136, 0.2);
          color: #00FF88;
        }
        .load-more-btn svg { stroke: currentColor; }
        .load-more-btn .spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(0, 255, 136, 0.3);
          border-top-color: #00FF88;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .pagination-info {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.3);
          font-family: 'SF Mono', monospace;
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           RESPONSIVE - VERY SMALL PHONES (<360px)
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        @media (max-width: 359px) {
          .header-top { padding: 8px 10px; }
          .page-title { font-size: 14px; }
          .back-btn { width: 30px; height: 30px; }
          .connect-wallet-btn { padding: 5px 8px; font-size: 9px; }
          .status-badge, .wallet-badge { padding: 3px 6px; font-size: 9px; }

          .search-container { margin: 0 10px 8px; padding: 8px 10px; }
          .search-container input { font-size: 12px; }

          .filters-container { padding: 0 10px 6px; gap: 4px; }
          .filters-container :global(.dropdown-trigger) { padding: 5px 8px; font-size: 10px; }
          .filters-container :global(.dropdown-label) { max-width: 50px; }

          .results-info { padding: 0 10px 6px; }
          .results-count { font-size: 9px; }
          .data-source { font-size: 8px; padding: 2px 5px; }

          .markets-main { padding: 6px 8px; }
          .markets-grid { grid-template-columns: 1fr; gap: 8px; }

          .markets-grid :global(.compact-card) { height: 210px; min-height: 210px; max-height: 210px; }
          .markets-grid :global(.card-media) { height: 60px; }
          .markets-grid :global(.card-content) { padding: 8px; gap: 5px; }
          .markets-grid :global(.card-title) { font-size: 12px; height: 32px; min-height: 32px; max-height: 32px; }
          .markets-grid :global(.price-value) { font-size: 13px; }
          .markets-grid :global(.spark-row) { height: 40px; min-height: 40px; }
          .markets-grid :global(.spark-badge) { padding: 1px 4px; font-size: 8px; }
          .markets-grid :global(.trade-btn) { margin: 0 8px 6px; padding: 6px; font-size: 9px; }

          .load-more-btn { padding: 10px 16px; font-size: 11px; min-width: 140px; }
          .pagination-info { font-size: 9px; }
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           RESPONSIVE - SMALL PHONES (360-399px)
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        @media (min-width: 360px) and (max-width: 399px) {
          .markets-grid { grid-template-columns: repeat(2, 1fr); gap: 6px; }
          .markets-grid :global(.compact-card) { height: 230px; min-height: 230px; max-height: 230px; }
          .markets-grid :global(.card-media) { height: 55px; }
          .markets-grid :global(.card-content) { padding: 8px; gap: 4px; }
          .markets-grid :global(.card-title) { font-size: 10px; height: 26px; min-height: 26px; max-height: 26px; }
          .markets-grid :global(.price-value) { font-size: 12px; }
          .markets-grid :global(.price-label) { font-size: 7px; }
          .markets-grid :global(.spark-row) { height: 42px; min-height: 42px; }
          .markets-grid :global(.spark-badge) { padding: 1px 4px; font-size: 8px; }
          .markets-grid :global(.stat-value) { font-size: 9px; }
          .markets-grid :global(.trade-btn) { margin: 0 6px 5px; padding: 5px; font-size: 8px; }
          .filters-container :global(.dropdown-label) { max-width: 60px; }
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           RESPONSIVE - MEDIUM PHONES (400-479px)
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        @media (min-width: 400px) and (max-width: 479px) {
          .markets-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .markets-grid :global(.compact-card) { height: 240px; min-height: 240px; max-height: 240px; }
          .markets-grid :global(.card-media) { height: 60px; }
          .markets-grid :global(.card-title) { font-size: 11px; height: 28px; min-height: 28px; max-height: 28px; }
          .markets-grid :global(.price-value) { font-size: 13px; }
          .markets-grid :global(.spark-row) { height: 44px; min-height: 44px; }
          .filters-container :global(.dropdown-label) { max-width: 80px; }
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           RESPONSIVE - LARGE PHONES (480-639px)
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        @media (min-width: 480px) and (max-width: 639px) {
          .markets-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .markets-grid :global(.compact-card) { height: 250px; min-height: 250px; max-height: 250px; }
          .markets-grid :global(.card-media) { height: 65px; }
          .markets-grid :global(.card-title) { font-size: 12px; height: 32px; min-height: 32px; max-height: 32px; }
          .markets-grid :global(.price-value) { font-size: 14px; }
          .markets-grid :global(.spark-row) { height: 46px; min-height: 46px; }
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           RESPONSIVE - SMALL TABLETS (640-767px)
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        @media (min-width: 640px) and (max-width: 767px) {
          .header-top { padding: 14px 20px; }
          .search-container { margin: 0 20px 14px; }
          .filters-container { padding: 0 20px 12px; }
          .results-info { padding: 0 20px 12px; }
          .markets-main { padding: 14px 20px; }
          .markets-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .markets-grid :global(.compact-card) { height: 260px; min-height: 260px; max-height: 260px; }
          .markets-grid :global(.card-media) { height: 70px; }
          .markets-grid :global(.card-title) { font-size: 12px; height: 32px; min-height: 32px; max-height: 32px; }
          .markets-grid :global(.price-value) { font-size: 15px; }
          .markets-grid :global(.spark-row) { height: 50px; min-height: 50px; }
          .filters-container :global(.dropdown-label) { max-width: 100px; }
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           RESPONSIVE - TABLETS (768-1023px)
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        @media (min-width: 768px) and (max-width: 1023px) {
          .header-top { padding: 16px 24px; }
          .page-title { font-size: 18px; }
          .search-container { margin: 0 24px 16px; padding: 12px 16px; }
          .filters-container { padding: 0 24px 14px; gap: 10px; }
          .filters-container :global(.dropdown-trigger) { padding: 10px 14px; }
          .filters-container :global(.dropdown-label) { max-width: 120px; }
          .results-info { padding: 0 24px 14px; }
          .markets-main { padding: 16px 24px; }
          .markets-grid { grid-template-columns: repeat(3, 1fr); gap: 14px; }
          .markets-grid :global(.compact-card) { height: 270px; min-height: 270px; max-height: 270px; }
          .markets-grid :global(.card-media) { height: 75px; }
          .markets-grid :global(.card-title) { font-size: 12px; height: 32px; min-height: 32px; max-height: 32px; }
          .markets-grid :global(.price-value) { font-size: 16px; }
          .markets-grid :global(.spark-row) { height: 52px; min-height: 52px; }
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           RESPONSIVE - DESKTOP (1024px+)
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        @media (min-width: 1024px) {
          .markets-header { padding-left: 24px; padding-right: 24px; }
          .header-top { padding: 18px 0; max-width: 1400px; margin: 0 auto; }
          .page-title { font-size: 20px; }
          .search-container { max-width: 1400px; margin: 0 auto 18px; padding: 14px 18px; }
          .filters-container { max-width: 1400px; margin: 0 auto; padding: 0 0 16px; gap: 12px; }
          .filters-container :global(.dropdown-trigger) { padding: 10px 16px; border-radius: 12px; }
          .filters-container :global(.dropdown-label) { max-width: none; }
          .results-info { max-width: 1400px; margin: 0 auto; padding: 0 0 16px; }
          .markets-main { padding: 20px 24px; }
          .markets-grid { grid-template-columns: repeat(3, 1fr); gap: 16px; }
          .markets-grid :global(.compact-card) { height: 280px; min-height: 280px; max-height: 280px; }
          .markets-grid :global(.card-media) { height: 80px; }
          .markets-grid :global(.card-title) { font-size: 13px; height: 34px; min-height: 34px; max-height: 34px; }
          .markets-grid :global(.price-value) { font-size: 16px; }
          .markets-grid :global(.spark-row) { height: 54px; min-height: 54px; }
          .load-more-btn { padding: 14px 32px; font-size: 14px; min-width: 200px; }
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           RESPONSIVE - LARGE DESKTOP (1280px+)
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        @media (min-width: 1280px) {
          .markets-grid { grid-template-columns: repeat(4, 1fr); gap: 18px; }
          .markets-grid :global(.compact-card) { height: 290px; min-height: 290px; max-height: 290px; }
          .markets-grid :global(.card-media) { height: 85px; }
          .markets-grid :global(.card-title) { font-size: 13px; height: 34px; min-height: 34px; max-height: 34px; }
          .markets-grid :global(.price-value) { font-size: 17px; }
          .markets-grid :global(.spark-row) { height: 56px; min-height: 56px; }
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           RESPONSIVE - EXTRA LARGE (1536px+)
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        @media (min-width: 1536px) {
          .markets-grid { grid-template-columns: repeat(5, 1fr); gap: 20px; }
          .markets-grid :global(.compact-card) { height: 300px; min-height: 300px; max-height: 300px; }
          .markets-grid :global(.card-media) { height: 90px; }
          .markets-grid :global(.card-title) { font-size: 14px; height: 36px; min-height: 36px; max-height: 36px; }
          .markets-grid :global(.price-value) { font-size: 18px; }
          .markets-grid :global(.spark-row) { height: 58px; min-height: 58px; }
        }

        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           LANDSCAPE MODE
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
        @media (max-height: 500px) and (orientation: landscape) {
          .markets-header { position: relative; }
          .header-top { padding: 8px 16px; }
          .page-title { font-size: 15px; }
          .search-container { margin: 0 16px 8px; padding: 8px 12px; }
          .filters-container { padding: 0 16px 8px; }
          .filters-container :global(.dropdown-trigger) { padding: 6px 10px; }
          .results-info { padding: 0 16px 8px; }
          .markets-main { padding: 10px 16px; }
          .markets-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; }
          .markets-grid :global(.compact-card) { height: 170px; min-height: 170px; max-height: 170px; }
          .markets-grid :global(.card-media) { height: 45px; }
          .markets-grid :global(.card-title) { font-size: 9px; height: 24px; min-height: 24px; max-height: 24px; }
          .markets-grid :global(.price-value) { font-size: 11px; }
          .markets-grid :global(.spark-row) { height: 32px; min-height: 32px; }
          .markets-grid :global(.spark-badge) { display: none; }
          .markets-grid :global(.trade-btn) { display: none; }
        }

        /* Landscape for larger phones */
        @media (min-width: 640px) and (max-height: 500px) and (orientation: landscape) {
          .markets-grid { grid-template-columns: repeat(3, 1fr); }
          .markets-grid :global(.compact-card) { height: 180px; min-height: 180px; max-height: 180px; }
          .markets-grid :global(.spark-row) { height: 36px; min-height: 36px; }
        }
      `}</style>
    </div>
  );
}
