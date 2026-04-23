'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useBackendStatus } from '@/hooks/useMarkets';
import { useMode } from '@/context/ModeContext';
import { useUser } from '@/hooks/useUnifiedUser';
import { ApiMarket, getJupiterHotEvents, searchJupiterEvents, JupiterEvent } from '@/lib/api';
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

function ViralSparkline({ price, marketId }: { price: number; marketId: string }) {
  // Generate sparkline data based on current price and market ID as seed
  const points = useMemo(() => {
    return generateSparkData(price, marketId);
  }, [price, marketId]);

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
  market: MarketWithJupiter;
  onTrade?: (market: MarketWithJupiter) => void;
  index: number;
}

function MarketCard({ market, onTrade, index }: MarketCardProps) {
  const [imgError, setImgError] = useState(false);
  const marketTitle = market.question || market.title;
  // Get image from Jupiter source
  const imageUrl = market.jupiter?.imageUrl || market.jupiter?.metadata?.imageUrl;
  const showImage = imageUrl && !imgError;

  // Calculate 24h change (mock based on seed for now, real data would come from API)
  const seedNum = (market.id || market.title).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const change24h = ((seedNum % 20) - 10) * 0.5;
  const isUp = change24h >= 0;

  // Spread calculation from Jupiter pricing
  const jupiterMarket = market.jupiter?.markets?.[0];
  const yesAsk = jupiterMarket?.pricing?.buyYesPriceUsd ? parseFloat(jupiterMarket.pricing.buyYesPriceUsd) / 1_000_000 : 0;
  const yesBid = jupiterMarket?.pricing?.sellYesPriceUsd ? parseFloat(jupiterMarket.pricing.sellYesPriceUsd) / 1_000_000 : 0;
  const spread = Math.abs(yesAsk - yesBid) * 100; // Convert to cents

  // Time remaining
  const timeLeft = formatTimeRemaining(market.endDate);
  const isLive = timeLeft !== 'TBD' && timeLeft !== 'Ended' && parseInt(timeLeft) <= 24 && timeLeft.includes('h');

  // Get the market detail URL.
  // Jupiter's public route uses the *marketId* (e.g. POLY-75478). Prefer it when available.
  // Demo mode doesn't have `marketId`, so fall back to eventId / demo id.
  const rawMarket = (market.jupiter?.markets?.[0] as any) || null;
  const primaryMarketId =
    (rawMarket?.marketId as string | undefined)
    || (rawMarket?.id as string | undefined)
    || (rawMarket?.market_id as string | undefined)
    || undefined;

  const isDemoLike = (id?: string | null) =>
    !!id && (id.startsWith('mkt-DEMO-') || id.startsWith('evt-DEMO-') || id.includes('-DEMO-'));

  // If we can't find a real Jupiter `marketId`, only fall back to `eventId` when it looks real.
  const jupiterRouteId =
    primaryMarketId
    || (!isDemoLike(market.jupiter?.eventId) ? market.jupiter?.eventId : undefined);
  const marketDetailUrl = jupiterRouteId
    ? `/market/${encodeURIComponent(jupiterRouteId)}`
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
        <span className={`${styles.sourceBadge} ${styles.sourceBadgeJupiter}`}>
          Jupiter
        </span>
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

interface MarketWithJupiter extends ApiMarket {
  jupiter: JupiterEvent;
}

function jupiterToApiMarket(event: JupiterEvent): MarketWithJupiter | null {
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
  const marketId =
    (market as any)?.marketId
    || (market as any)?.id
    || (market as any)?.market_id
    || event.eventId;
  const jupiterUrl = `https://jup.ag/prediction/${marketId}`;

  return {
    id: event.eventId,
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

  const [markets, setMarkets] = useState<MarketWithJupiter[]>([]);
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
  const [tradingMarket, setTradingMarket] = useState<MarketWithJupiter | null>(null);

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

      // Fetch from Jupiter API only (Solana-native trading)
      const jupiterResponse = searchQuery
        ? await searchJupiterEvents(searchQuery, limit + currentCursor)
        : await getJupiterHotEvents(limit + currentCursor);

      let jupiterMarkets: MarketWithJupiter[] = [];

      if (jupiterResponse.success) {
        jupiterMarkets = jupiterResponse.data
          .map(jupiterToApiMarket)
          .filter((m): m is MarketWithJupiter => m !== null);
      }

      // Sort markets by volume (descending)
      jupiterMarkets.sort((a, b) => (b.volume || 0) - (a.volume || 0));

      // Apply pagination
      const newMarkets = isLoadMore
        ? jupiterMarkets.slice(currentCursor)
        : jupiterMarkets;

      if (isLoadMore) {
        setMarkets(prev => [...prev, ...newMarkets]);
      } else {
        setMarkets(newMarkets);
      }

      setTotalLoaded(jupiterMarkets.length);
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
              {/* Source indicator - Jupiter only */}
              <div className={styles.sourceIndicators}>
                <span
                  className={`${styles.sourceIndicator} ${totalLoaded > 0 ? styles.sourceIndicatorJupiter : styles.sourceIndicatorOffline}`}
                  title={totalLoaded > 0 ? `Jupiter: ${totalLoaded} markets` : 'Offline'}
                />
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

        {/* Trading Modal - Jupiter markets only (Solana-native) */}
        {tradingMarket && tradingMarket.jupiter && (
          <TradingModal
            isOpen={true}
            onClose={() => setTradingMarket(null)}
            prediction={{
              id: tradingMarket.id || tradingMarket.jupiter.eventId,
              question: tradingMarket.question || tradingMarket.title,
              marketOdds: tradingMarket.yesPct,
              source: tradingMarket.jupiter.markets?.[0]?.provider || 'jupiter',
              endDate: tradingMarket.jupiter.endTime ?? undefined,
              dflow: {
                ticker: tradingMarket.jupiter.eventId,
                seriesTicker: tradingMarket.jupiter.eventId,
                volume24h: parseFloat(tradingMarket.jupiter.markets?.[0]?.pricing?.volume24h || '0'),
                openInterest: parseFloat(tradingMarket.jupiter.markets?.[0]?.pricing?.openInterest || '0'),
                // Convert micro USD pricing to decimal (e.g., "500000" = $0.50 = 50%)
                yesBid: parseFloat(tradingMarket.jupiter.markets?.[0]?.pricing?.sellYesPriceUsd || '0') / 1_000_000,
                yesAsk: parseFloat(tradingMarket.jupiter.markets?.[0]?.pricing?.buyYesPriceUsd || '0') / 1_000_000,
                noBid: parseFloat(tradingMarket.jupiter.markets?.[0]?.pricing?.sellNoPriceUsd || '0') / 1_000_000,
                noAsk: parseFloat(tradingMarket.jupiter.markets?.[0]?.pricing?.buyNoPriceUsd || '0') / 1_000_000,
                spread: Math.abs(
                  parseFloat(tradingMarket.jupiter.markets?.[0]?.pricing?.buyYesPriceUsd || '0') -
                    parseFloat(tradingMarket.jupiter.markets?.[0]?.pricing?.sellYesPriceUsd || '0')
                ) / 1_000_000,
                tokens: {
                  yesMint: tradingMarket.jupiter.markets?.[0]?.onChain?.yesMint || null,
                  noMint: tradingMarket.jupiter.markets?.[0]?.onChain?.noMint || null,
                  marketLedger: tradingMarket.jupiter.markets?.[0]?.onChain?.marketPubkey || null,
                  isInitialized: !!(
                    tradingMarket.jupiter.markets?.[0]?.onChain?.yesMint &&
                    tradingMarket.jupiter.markets?.[0]?.onChain?.noMint
                  ),
                  redemptionStatus: 'open' as const,
                },
              },
            }}
          />
        )}
      </div>
    </PageWrapper>
  );
}
