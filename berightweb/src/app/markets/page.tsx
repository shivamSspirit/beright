'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useBackendStatus } from '@/hooks/useMarkets';
import { useMode } from '@/context/ModeContext';
import { useUser } from '@/hooks/useUnifiedUser';
import { ApiMarket, getDFlowHotMarkets, searchDFlowMarkets, DFlowEvent, getDFlowCandlesticks, DFlowCandleData, getJupiterHotEvents, searchJupiterEvents, JupiterEvent } from '@/lib/api';
import TradingModal from '@/components/TradingModal';
import OnboardingTour from '@/components/OnboardingTour';
import RestartTourButton from '@/components/RestartTourButton';
import { getTourSteps } from '@/config/tour-steps';
import { PageWrapper } from '@/components/ui';
import styles from './markets.module.css';

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
      className={styles.portalMenu}
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
          className={`${styles.portalItem} ${value === option.id ? styles.portalItemSelected : ''}`}
          onClick={() => {
            onChange(option.id);
            setIsOpen(false);
          }}
          type="button"
        >
          {option.icon && <span className={styles.itemIcon}>{option.icon}</span>}
          {option.color && !option.icon && (
            <span className={styles.itemDot} style={{ background: option.color }} />
          )}
          <span className={styles.itemLabel}>{option.label}</span>
          {value === option.id && (
            <svg className={styles.itemCheck} width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <div className={`${styles.dropdown} ${isOpen ? styles.dropdownOpen : ''}`}>
      <button
        ref={triggerRef}
        className={styles.dropdownTrigger}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        {selectedOption?.icon && <span className={styles.dropdownIcon}>{selectedOption.icon}</span>}
        <span className={styles.dropdownLabel}>{selectedOption?.label}</span>
        <svg className={styles.dropdownArrow} width="12" height="12" viewBox="0 0 12 12" fill="none">
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
    <div className={styles.viralSpark}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          {/* Gradient fill under the line */}
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isUp ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'} />
            <stop offset="60%" stopColor={isUp ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)'} />
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
          stroke={isUp ? '#10B981' : '#F43F5E'}
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
          fill={isUp ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)'}
          className={styles.pulseRing}
        />

        {/* Main pulse dot */}
        <circle
          cx={drawWidth}
          cy={lastY}
          r="3"
          fill={isUp ? '#10B981' : '#F43F5E'}
          filter={`url(#${pulseGlowId})`}
          className={styles.pulseDot}
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
      <div className={`${styles.sparkBadge} ${isUp ? styles.sparkBadgeUp : styles.sparkBadgeDown}`}>
        <span className={styles.sparkArrow}>{isUp ? '↑' : '↓'}</span>
        <span className={styles.sparkPct}>{Math.abs(parseFloat(changePercent))}%</span>
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
  const hasJupiter = !!market.jupiter;
  const isTradeable = hasDFlow || hasJupiter;
  const marketTitle = market.question || market.title;
  // Get image from either source
  const imageUrl = market.dflow?.imageUrl || market.jupiter?.imageUrl || market.jupiter?.metadata?.imageUrl;
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

  // Get the market detail URL
  const marketDetailUrl = hasDFlow && market.dflow?.ticker
    ? `/market/${encodeURIComponent(market.dflow.ticker)}`
    : hasJupiter && market.jupiter?.eventId
    ? `/market/${encodeURIComponent(market.jupiter.eventId)}`
    : null;

  return (
    <Link
      href={marketDetailUrl || '#'}
      className={styles.compactCard}
      style={{ '--delay': `${index * 35}ms` } as React.CSSProperties}
      onClick={(e) => {
        // If no detail URL, prevent navigation
        if (!marketDetailUrl) {
          e.preventDefault();
        }
      }}
    >
      {/* Only show image if API provides one and it loads successfully */}
      {showImage && (
        <div className={styles.cardMedia}>
          <img
            src={imageUrl}
            alt={marketTitle}
            className={styles.mediaImg}
            loading="lazy"
            onError={() => setImgError(true)}
          />
          <div className={styles.mediaOverlay} />
        </div>
      )}

      {/* Content Section */}
      <div className={styles.cardContent}>
        {/* Title */}
        <h3 className={styles.cardTitle}>{marketTitle}</h3>

        {/* Price Row - YES/NO with spread */}
        <div className={styles.priceRow}>
          <div className={styles.priceYes}>
            <span className={styles.priceLabel}>YES</span>
            <span className={styles.priceValue}>{market.yesPct}c</span>
          </div>
          <div className={styles.priceSpread}>
            <span className={styles.spreadValue}>{spread > 0 ? `${spread.toFixed(0)}c` : '-'}</span>
            <span className={styles.spreadLabel}>spread</span>
          </div>
          <div className={styles.priceNo}>
            <span className={styles.priceLabel}>NO</span>
            <span className={styles.priceValue}>{market.noPct}c</span>
          </div>
        </div>

        {/* Probability Bar */}
        <div className={styles.probBar}>
          <div className={styles.probFill} style={{ width: `${market.yesPct}%` }} />
        </div>

        {/* Sparkline */}
        <div className={styles.sparkRow}>
          <ViralSparkline
            price={market.yesPct}
            marketId={market.id || market.title}
            ticker={market.dflow?.ticker}
          />
        </div>

        {/* Stats Row */}
        <div className={styles.statsRow} data-tour="market-stats">
          <div className={styles.stat}>
            <span className={styles.statValue}>{formatVolume(market.volume)}</span>
            <span className={styles.statLabel}>vol</span>
          </div>
          <div className={`${styles.stat} ${isUp ? styles.statChangeUp : styles.statChangeDown}`}>
            <span className={styles.statValue}>{isUp ? '+' : ''}{change24h.toFixed(1)}%</span>
            <span className={styles.statLabel}>24h</span>
          </div>
          <div className={`${styles.stat} ${isLive ? styles.statTimeLive : ''}`}>
            <span className={styles.statValue}>{timeLeft}</span>
            <span className={styles.statLabel}>{isLive ? 'live' : 'left'}</span>
          </div>
        </div>
      </div>

      {/* Source badge & Trade button */}
      <div className={styles.cardFooter}>
        <span className={`${styles.sourceBadge} ${hasDFlow ? styles.sourceBadgeDflow : styles.sourceBadgeJupiter}`}>
          {hasDFlow ? 'DFlow' : 'Jupiter'}
        </span>
        {isTradeable && (
          <button
            className={styles.tradeBtn}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTrade?.(market);
            }}
            data-tour="trade-button"
          >
            Trade
          </button>
        )}
      </div>
    </Link>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SKELETON CARD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SkeletonCard({ index }: { index: number }) {
  return (
    <div className={styles.skeletonCard} style={{ animationDelay: `${index * 50}ms` }}>
      <div className={styles.skeletonTitle} />
      <div className={styles.skeletonDate} />
      <div className={styles.skeletonOutcomes}>
        <div className={styles.skeletonOutcome} />
        <div className={styles.skeletonOutcome} />
      </div>
      <div className={styles.skeletonFooter} />
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface MarketWithDFlow extends ApiMarket {
  dflow?: DFlowEvent;
  jupiter?: JupiterEvent;
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

function jupiterToApiMarket(event: JupiterEvent): MarketWithDFlow | null {
  // Get the first market from the event
  const market = event.markets?.[0];
  if (!market) return null;

  // Parse pricing (values are in micro USD, e.g., "500000" = $0.50)
  const yesPriceUsd = market.pricing?.buyYesPriceUsd
    ? parseFloat(market.pricing.buyYesPriceUsd) / 1_000_000
    : 0.5;
  const noPriceUsd = market.pricing?.buyNoPriceUsd
    ? parseFloat(market.pricing.buyNoPriceUsd) / 1_000_000
    : 0.5;

  // Convert to percentage (0-100)
  const yesPct = Math.round(yesPriceUsd * 100);
  const noPct = Math.round(noPriceUsd * 100);

  // Parse volume from pricing
  const volumeUsd = market.pricing?.volume
    ? parseFloat(market.pricing.volume) / 1_000_000
    : 0;

  // Construct Jupiter URL
  const jupiterUrl = `https://app.jup.ag/predictions/${event.eventId}`;

  return {
    id: `jupiter-${event.eventId}`,
    platform: 'kalshi' as const, // Jupiter aggregates Kalshi/Polymarket - use kalshi as compatible type
    title: event.title || market.title,
    question: event.title || market.title,
    yesPrice: yesPriceUsd,
    noPrice: noPriceUsd,
    yesPct,
    noPct,
    volume: volumeUsd,
    liquidity: 0,
    endDate: event.endTime || null,
    status: event.status as 'active' | 'resolved' || 'active',
    url: jupiterUrl,
    jupiter: event,
  };
}

export default function MarketsPage() {
  const { isConnected } = useBackendStatus();
  const { isDemo } = useMode();
  const { isAuthenticated } = useUser();

  // Tour setup - MUST be at top level before any returns
  const tourSteps = useMemo(() => {
    try {
      return getTourSteps('markets-page');
    } catch (error) {
      console.error('[MarketsPage] Error loading tour steps:', error);
      return [];
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && isDemo && tourSteps.length > 0) {
      console.log('[MarketsPage] Tour conditions:', {
        isAuthenticated,
        isDemo,
        tourStepsCount: tourSteps.length,
        willShowTour: true,
      });
    }
  }, [isAuthenticated, isDemo, tourSteps.length]);

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

  // Data source tracking
  const [dataSources, setDataSources] = useState<{
    dflow: { count: number; success: boolean };
    jupiter: { count: number; success: boolean };
  }>({ dflow: { count: 0, success: false }, jupiter: { count: 0, success: false } });

  // Trading modal state
  const [tradingMarket, setTradingMarket] = useState<MarketWithDFlow | null>(null);

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

      // Fetch from both DFlow and Jupiter APIs in parallel
      const [dflowResponse, jupiterResponse] = await Promise.allSettled([
        searchQuery
          ? searchDFlowMarkets(searchQuery, limit + currentCursor)
          : getDFlowHotMarkets(limit + currentCursor),
        searchQuery
          ? searchJupiterEvents(searchQuery, limit + currentCursor)
          : getJupiterHotEvents(limit + currentCursor),
      ]);

      const allMarkets: MarketWithDFlow[] = [];
      const sources = {
        dflow: { count: 0, success: false },
        jupiter: { count: 0, success: false },
      };

      // Process DFlow results
      if (dflowResponse.status === 'fulfilled' && dflowResponse.value.success) {
        const dflowMarkets = dflowResponse.value.events.map(dflowToApiMarket);
        allMarkets.push(...dflowMarkets);
        sources.dflow = { count: dflowMarkets.length, success: true };
      }

      // Process Jupiter results
      if (jupiterResponse.status === 'fulfilled' && jupiterResponse.value.success) {
        const jupiterMarkets = jupiterResponse.value.data
          .map(jupiterToApiMarket)
          .filter((m): m is MarketWithDFlow => m !== null);
        allMarkets.push(...jupiterMarkets);
        sources.jupiter = { count: jupiterMarkets.length, success: true };
      }

      // Sort combined markets by volume (descending)
      allMarkets.sort((a, b) => (b.volume || 0) - (a.volume || 0));

      // Apply pagination
      const newMarkets = isLoadMore
        ? allMarkets.slice(currentCursor)
        : allMarkets;

      if (isLoadMore) {
        setMarkets(prev => [...prev, ...newMarkets]);
      } else {
        setMarkets(newMarkets);
      }

      setDataSources(sources);
      setTotalLoaded(allMarkets.length);
      setHasMore(newMarkets.length >= limit);
      setCursor(currentCursor + newMarkets.length);
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
    <PageWrapper showHeader={false} showFooter={false}>
      {/* Onboarding Tour - only in demo mode */}
      {isAuthenticated && isDemo && tourSteps.length > 0 && (
        <OnboardingTour
          steps={tourSteps}
          storageKey="beright-markets-page-tour-completed"
          onComplete={() => console.log('[MarketsPage] Tour completed!')}
          forceShow={false}
          debug={true}
        />
      )}

      {/* Restart tour button - only in demo mode */}
      {isAuthenticated && isDemo && (
        <RestartTourButton
          storageKey="beright-markets-page-tour-completed"
          ariaLabel="Restart markets page tour"
        />
      )}

      <div className={styles.marketsPage} data-tour="markets-page">
        {/* Compact Search & Filters Header */}
        <header className={styles.marketsHeader}>
          <div className={styles.headerRow} data-tour="search-filters">
            {/* Search - compact on desktop */}
            <div className={styles.searchContainer}>
              <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
              />
              {searchQuery && (
                <button className={styles.searchClear} onClick={() => setSearchQuery('')} type="button">
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.5 3.5L3.5 10.5M3.5 3.5l7 7" />
                  </svg>
                </button>
              )}
            </div>

            {/* Filters - inline with search on desktop */}
            <div className={styles.filtersContainer}>
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

            {/* Results count - inline on desktop */}
            <div className={styles.resultsInfo}>
              <span className={styles.resultsCount}>{filteredMarkets.length}</span>
              <span className={styles.resultsLabel}>markets</span>
              {/* Source indicators - compact dots */}
              <div className={styles.sourceIndicators}>
                {dataSources.dflow.success && (
                  <span className={`${styles.sourceIndicator} ${styles.sourceIndicatorDflow}`} title={`DFlow: ${dataSources.dflow.count} markets`} />
                )}
                {dataSources.jupiter.success && (
                  <span className={`${styles.sourceIndicator} ${styles.sourceIndicatorJupiter}`} title={`Jupiter: ${dataSources.jupiter.count} markets`} />
                )}
                {!dataSources.dflow.success && !dataSources.jupiter.success && (
                  <span className={`${styles.sourceIndicator} ${styles.sourceIndicatorOffline}`} title="Offline" />
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Market Grid */}
        <main className={styles.marketsMain}>
          {loading ? (
            <div className={styles.marketsGrid}>
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} index={i} />
              ))}
            </div>
          ) : filteredMarkets.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyTitle}>No markets found</p>
              <p className={styles.emptyHint}>Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <div className={styles.marketsGrid}>
                {filteredMarkets.map((market, index) => (
                  <div key={market.id} data-tour={index === 0 ? 'market-card' : undefined}>
                    <MarketCard
                      market={market}
                      onTrade={setTradingMarket}
                      index={index}
                    />
                  </div>
                ))}
              </div>

              {/* Pagination / Load More */}
              {hasMore && (
                <div className={styles.loadMoreContainer}>
                  <button
                    className={`${styles.loadMoreBtn} ${loadingMore ? styles.loadMoreBtnLoading : ''}`}
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <span className={styles.spinner} />
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
                  <span className={styles.paginationInfo}>
                    Showing {filteredMarkets.length} of {totalLoaded}+ markets
                  </span>
                </div>
              )}
            </>
          )}
        </main>

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
                openInterest: tradingMarket.dflow.openInterest || 0,
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
      </div>
    </PageWrapper>
  );
}
