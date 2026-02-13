'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import { usePrivy } from '@privy-io/react-auth';
import { getHotMarkets, getArbitrageOpportunities, getIntel, ApiMarket, ApiArbitrage } from '@/lib/api';

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  BERIGHT TERMINAL v7.0 - CYBERPUNK EDITION                                ║
// ║  "Jack into the future of prediction markets"                              ║
// ║                                                                            ║
// ║  Features: Neon aesthetics, scanlines, glitch effects, CRT feel           ║
// ║  Typography: Orbitron (display) + JetBrains Mono (data)                   ║
// ║  Responsive: 320px → 1440px+ with fluid breakpoints                       ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

type FilterTab = 'hot' | 'arb' | 'news' | 'picks';
type LoadingState = 'idle' | 'loading' | 'success' | 'error';

interface MarketCard {
  id: string;
  rank: number;
  title: string;
  category: string;
  platform: string;
  yesPct: number;
  noPct: number;
  volume: number;
  predictors: number;
  closesIn: string;
  url: string;
  isHot?: boolean;
}

interface UserPrediction {
  marketId: string;
  direction: 'YES' | 'NO';
  timestamp: Date;
}

interface NewsItem {
  title: string;
  source: string;
  url?: string;
}

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function formatPct(value: number): string {
  return Math.round(value * 10) / 10 + '%';
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v)}`;
}

function formatTimeRemaining(endDate: string | null): string {
  if (!endDate) return 'TBD';
  const now = new Date();
  const end = new Date(endDate);
  const diff = end.getTime() - now.getTime();
  if (diff < 0) return 'CLOSED';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 30) return `${Math.floor(days / 30)}mo`;
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return '<1h';
}

function getCategoryInfo(title: string): { emoji: string; label: string; color: string } {
  const lower = title.toLowerCase();
  if (lower.includes('bitcoin') || lower.includes('btc') || lower.includes('eth') || lower.includes('crypto')) {
    return { emoji: '₿', label: 'CRYPTO', color: '#F7931A' };
  }
  if (lower.includes('trump') || lower.includes('biden') || lower.includes('election') || lower.includes('president')) {
    return { emoji: '⚖', label: 'POLITICS', color: '#FF00FF' };
  }
  if (lower.includes('fed') || lower.includes('rate') || lower.includes('inflation') || lower.includes('gdp')) {
    return { emoji: '◈', label: 'ECON', color: '#00F0FF' };
  }
  if (lower.includes('ai') || lower.includes('openai') || lower.includes('tech') || lower.includes('apple') || lower.includes('google')) {
    return { emoji: '◉', label: 'AI/TECH', color: '#39FF14' };
  }
  if (lower.includes('nba') || lower.includes('nfl') || lower.includes('game') || lower.includes('championship')) {
    return { emoji: '◆', label: 'SPORTS', color: '#FF6B00' };
  }
  return { emoji: '◎', label: 'MARKETS', color: '#00F0FF' };
}

function transformToCard(market: ApiMarket, index: number): MarketCard {
  return {
    id: market.id || `${market.platform}-${index}`,
    rank: index + 1,
    title: market.title,
    category: getCategoryInfo(market.title).label,
    platform: market.platform.toUpperCase(),
    yesPct: Math.round(market.yesPct * 10) / 10,
    noPct: Math.round(market.noPct * 10) / 10,
    volume: market.volume,
    predictors: Math.round(market.volume / 50) + Math.floor(Math.random() * 500),
    closesIn: formatTimeRemaining(market.endDate),
    url: market.url,
    isHot: market.volume > 100000 || index < 3,
  };
}

// ═══════════════════════════════════════════════════════════════
// CYBERPUNK SKELETON - Matrix Rain Effect
// ═══════════════════════════════════════════════════════════════

function CyberSkeleton() {
  return (
    <div className="cyber-skeleton">
      <div className="skeleton-glitch-bar" />
      <div className="skeleton-header-row">
        <div className="skeleton-chip" />
        <div className="skeleton-chip short" />
        <div className="skeleton-chip tiny" />
      </div>
      <div className="skeleton-title-block">
        <div className="skeleton-line" />
        <div className="skeleton-line short" />
      </div>
      <div className="skeleton-data-bar" />
      <div className="skeleton-metrics">
        <div className="skeleton-metric" />
        <div className="skeleton-metric" />
        <div className="skeleton-metric" />
      </div>
      <div className="skeleton-actions">
        <div className="skeleton-btn-cyber" />
        <div className="skeleton-btn-cyber" />
      </div>
      <div className="matrix-rain" aria-hidden="true">
        {[...Array(8)].map((_, i) => (
          <span key={i} className="rain-drop" style={{ animationDelay: `${i * 0.15}s` }}>
            {String.fromCharCode(0x30A0 + Math.random() * 96)}
          </span>
        ))}
      </div>
    </div>
  );
}

function CyberSkeletonNews() {
  return (
    <div className="cyber-skeleton-news">
      <div className="skeleton-news-line" />
      <div className="skeleton-news-meta" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ERROR STATE - System Failure
// ═══════════════════════════════════════════════════════════════

function SystemError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="system-error">
      <div className="error-glitch" data-text="SYSTEM_FAILURE">SYSTEM_FAILURE</div>
      <div className="error-code">[ERR_0x7F3A]</div>
      <p className="error-desc">{message}</p>
      <button className="retry-cyber" onClick={onRetry}>
        <span className="btn-scanline" />
        <span className="btn-text">[ REINITIALIZE ]</span>
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function TerminalPage() {
  usePrivy();

  // Boot sequence state
  const [bootComplete, setBootComplete] = useState(false);
  const [bootText, setBootText] = useState('');

  // Tab state
  const [activeTab, setActiveTab] = useState<FilterTab>('hot');

  // Data states
  const [markets, setMarkets] = useState<MarketCard[]>([]);
  const [marketsState, setMarketsState] = useState<LoadingState>('idle');
  const [arbOpportunities, setArbOpportunities] = useState<ApiArbitrage[]>([]);
  const [arbState, setArbState] = useState<LoadingState>('idle');
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [newsState, setNewsState] = useState<LoadingState>('idle');

  // UI state
  const [onlineCount, setOnlineCount] = useState(2776);
  const [predCount, setPredCount] = useState(1001);
  const [userStreak] = useState(7);
  const [userPredictions, setUserPredictions] = useState<UserPrediction[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<MarketCard | null>(null);
  const [predictionDirection, setPredictionDirection] = useState<'YES' | 'NO' | null>(null);
  const [glitchActive, setGlitchActive] = useState(false);

  const tickerRef = useRef<HTMLDivElement>(null);

  // Boot sequence effect
  useEffect(() => {
    const bootMessages = [
      '> INITIALIZING NEURAL LINK...',
      '> CONNECTING TO PREDICTION MATRIX...',
      '> LOADING MARKET DATA STREAMS...',
      '> CALIBRATING PROBABILITY ENGINES...',
      '> SYSTEM ONLINE'
    ];

    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < bootMessages.length) {
        setBootText(bootMessages[currentIndex]);
        currentIndex++;
      } else {
        setBootComplete(true);
        clearInterval(interval);
      }
    }, 400);

    return () => clearInterval(interval);
  }, []);

  // Random glitch effect
  useEffect(() => {
    const glitchInterval = setInterval(() => {
      if (Math.random() > 0.92) {
        setGlitchActive(true);
        setTimeout(() => setGlitchActive(false), 150);
      }
    }, 3000);
    return () => clearInterval(glitchInterval);
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // DATA FETCHING
  // ═══════════════════════════════════════════════════════════════

  const fetchMarkets = useCallback(async () => {
    setMarketsState('loading');
    try {
      const [hotData, arbData] = await Promise.all([
        getHotMarkets(15),
        getArbitrageOpportunities(),
      ]);

      if (hotData.markets?.length > 0) {
        setMarkets(hotData.markets.map((m, i) => transformToCard(m, i)));
      }
      setMarketsState('success');

      if (arbData.opportunities?.length > 0) {
        setArbOpportunities(arbData.opportunities);
        setArbState('success');
      } else {
        setArbState('success');
      }
    } catch (error) {
      console.error('Failed to fetch markets:', error);
      setMarketsState('error');
      setArbState('error');
    }
  }, []);

  const fetchNews = useCallback(async () => {
    setNewsState('loading');
    try {
      const data = await getIntel('prediction markets', 'news');
      if (data.news?.length > 0) {
        setNewsItems(data.news.slice(0, 10).map(n => ({
          title: n.title,
          source: n.source,
          url: n.url,
        })));
      }
      setNewsState('success');
    } catch (error) {
      console.error('Failed to fetch news:', error);
      setNewsState('error');
    }
  }, []);

  // Initial load after boot
  useEffect(() => {
    if (bootComplete) {
      fetchMarkets();
    }
  }, [bootComplete, fetchMarkets]);

  // Fetch news when tab changes
  useEffect(() => {
    if (activeTab === 'news' && newsState === 'idle' && bootComplete) {
      fetchNews();
    }
  }, [activeTab, newsState, bootComplete, fetchNews]);

  // Live stats simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineCount(c => Math.max(2500, c + Math.floor(Math.random() * 21) - 10));
      setPredCount(c => c + Math.floor(Math.random() * 3) + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════

  const handlePrediction = useCallback((market: MarketCard, direction: 'YES' | 'NO') => {
    // Trigger glitch on prediction
    setGlitchActive(true);
    setTimeout(() => setGlitchActive(false), 200);

    setUserPredictions(prev => [
      ...prev.filter(p => p.marketId !== market.id),
      { marketId: market.id, direction, timestamp: new Date() }
    ]);
    setSelectedMarket(market);
    setPredictionDirection(direction);
    setShowShareModal(true);
    setPredCount(c => c + 1);
  }, []);

  const getUserPrediction = useCallback((marketId: string) => {
    return userPredictions.find(p => p.marketId === marketId);
  }, [userPredictions]);

  // ═══════════════════════════════════════════════════════════════
  // RENDER COMPONENTS
  // ═══════════════════════════════════════════════════════════════

  const renderMarketCard = (market: MarketCard, index: number) => {
    const userPrediction = getUserPrediction(market.id);
    const category = getCategoryInfo(market.title);
    const isUrgent = market.closesIn.includes('h') && !market.closesIn.includes('d');

    return (
      <motion.article
        key={market.id}
        className="cyber-card"
        initial={{ opacity: 0, y: 30, rotateX: -10 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.5, delay: index * 0.08 }}
        whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
        role="article"
        aria-label={`Market: ${market.title}`}
      >
        {/* Animated border */}
        <div className="card-border-glow" />

        {/* Scanline overlay */}
        <div className="card-scanlines" aria-hidden="true" />

        {/* Card content */}
        <div className="card-inner">
          {/* Header */}
          <header className="cyber-header">
            <div className="header-chips">
              <span className="rank-chip">
                <span className="rank-hash">#</span>
                {String(market.rank).padStart(2, '0')}
              </span>
              <span
                className="category-chip"
                style={{
                  '--cat-color': category.color,
                  borderColor: category.color,
                  color: category.color,
                  background: `${category.color}15`
                } as React.CSSProperties}
              >
                <span className="cat-icon">{category.emoji}</span>
                {category.label}
              </span>
              <span className="platform-chip">{market.platform}</span>
            </div>
            {market.isHot && (
              <span className="hot-indicator">
                <span className="hot-pulse" />
                HOT
              </span>
            )}
          </header>

          {/* Title */}
          <h3 className="cyber-title">{market.title}</h3>

          {/* Odds visualization */}
          <div className="odds-display">
            <div className="odds-header">
              <div className="odds-yes">
                <span className="odds-label">YES</span>
                <span className="odds-value">{formatPct(market.yesPct)}</span>
              </div>
              <div className="odds-no">
                <span className="odds-value">{formatPct(market.noPct)}</span>
                <span className="odds-label">NO</span>
              </div>
            </div>
            <div className="odds-bar-cyber">
              <div
                className="odds-fill-yes-cyber"
                style={{ width: `${market.yesPct}%` }}
              >
                <div className="fill-glow" />
              </div>
              <div
                className="odds-fill-no-cyber"
                style={{ width: `${market.noPct}%` }}
              >
                <div className="fill-glow" />
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="stats-grid-cyber">
            <div className="stat-cell">
              <span className="stat-icon-cyber">◈</span>
              <div className="stat-data">
                <span className="stat-label-cyber">VOL</span>
                <span className="stat-value-cyber">{formatVolume(market.volume)}</span>
              </div>
            </div>
            <div className="stat-divider-cyber" />
            <div className="stat-cell">
              <span className="stat-icon-cyber">◎</span>
              <div className="stat-data">
                <span className="stat-label-cyber">TRADERS</span>
                <span className="stat-value-cyber">{market.predictors.toLocaleString()}</span>
              </div>
            </div>
            <div className="stat-divider-cyber" />
            <div className={`stat-cell ${isUrgent ? 'urgent' : ''}`}>
              <span className="stat-icon-cyber">◉</span>
              <div className="stat-data">
                <span className="stat-label-cyber">CLOSES</span>
                <span className="stat-value-cyber">{market.closesIn}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          {userPrediction ? (
            <div className="predicted-state">
              <div className={`predicted-badge-cyber ${userPrediction.direction.toLowerCase()}`}>
                <span className="badge-icon">◆</span>
                PREDICTED {userPrediction.direction}
              </div>
              <button
                className="share-cyber"
                onClick={() => {
                  setSelectedMarket(market);
                  setPredictionDirection(userPrediction.direction);
                  setShowShareModal(true);
                }}
                aria-label="Share prediction"
              >
                SHARE
              </button>
            </div>
          ) : (
            <div className="action-grid">
              <button
                className="cyber-btn yes"
                onClick={() => handlePrediction(market, 'YES')}
                aria-label={`Predict YES at ${formatPct(market.yesPct)}`}
              >
                <span className="btn-glow" />
                <span className="btn-content">
                  <span className="btn-direction">YES</span>
                  <span className="btn-odds">{formatPct(market.yesPct)}</span>
                </span>
              </button>
              <button
                className="cyber-btn no"
                onClick={() => handlePrediction(market, 'NO')}
                aria-label={`Predict NO at ${formatPct(market.noPct)}`}
              >
                <span className="btn-glow" />
                <span className="btn-content">
                  <span className="btn-direction">NO</span>
                  <span className="btn-odds">{formatPct(market.noPct)}</span>
                </span>
              </button>
            </div>
          )}
        </div>
      </motion.article>
    );
  };

  const renderArbCard = (arb: ApiArbitrage, index: number) => (
    <motion.article
      key={`arb-${index}`}
      className="arb-card-cyber"
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <div className="arb-glow" />
      <header className="arb-header-cyber">
        <span className="arb-spread-cyber">+{Math.round(arb.spread * 10) / 10}%</span>
        <span className="arb-confidence-cyber">
          <span className={`conf-dot ${arb.confidence > 0.8 ? 'high' : arb.confidence > 0.5 ? 'med' : 'low'}`} />
          {Math.round(arb.confidence * 100)}% CONF
        </span>
      </header>
      <h3 className="arb-title-cyber">{arb.topic}</h3>
      <div className="arb-compare">
        <div className="arb-platform">
          <span className="platform-label">{arb.platformA.toUpperCase()}</span>
          <span className="platform-price yes">{formatPct(arb.priceA * 100)}</span>
        </div>
        <div className="arb-vs">
          <span className="vs-line" />
          <span className="vs-text">VS</span>
          <span className="vs-line" />
        </div>
        <div className="arb-platform">
          <span className="platform-label">{arb.platformB.toUpperCase()}</span>
          <span className="platform-price no">{formatPct(arb.priceB * 100)}</span>
        </div>
      </div>
      <p className="arb-strategy-cyber">{arb.strategy}</p>
    </motion.article>
  );

  const renderNewsItem = (news: NewsItem, index: number) => (
    <motion.article
      key={`news-${index}`}
      className="news-card-cyber"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <div className="news-indicator" />
      <h4 className="news-title-cyber">{news.title}</h4>
      <footer className="news-footer-cyber">
        <span className="news-source-cyber">[{news.source}]</span>
        {news.url && (
          <a href={news.url} target="_blank" rel="noopener noreferrer" className="news-link-cyber">
            ACCESS →
          </a>
        )}
      </footer>
    </motion.article>
  );

  // ═══════════════════════════════════════════════════════════════
  // TAB CONTENT
  // ═══════════════════════════════════════════════════════════════

  const renderTabContent = () => {
    switch (activeTab) {
      case 'hot':
        if (marketsState === 'loading') {
          return (
            <div className="skeleton-grid-cyber">
              {[...Array(6)].map((_, i) => <CyberSkeleton key={i} />)}
            </div>
          );
        }
        if (marketsState === 'error') {
          return <SystemError message="MARKET DATA STREAM INTERRUPTED" onRetry={fetchMarkets} />;
        }
        if (markets.length === 0) {
          return (
            <div className="empty-cyber">
              <div className="empty-icon-cyber">◎</div>
              <p className="empty-text">NO MARKETS DETECTED</p>
              <span className="empty-subtext">Awaiting data stream...</span>
            </div>
          );
        }
        return (
          <motion.div
            className="markets-grid-cyber"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {markets.map((m, i) => renderMarketCard(m, i))}
          </motion.div>
        );

      case 'arb':
        if (arbState === 'loading') {
          return (
            <div className="skeleton-grid-cyber">
              {[...Array(4)].map((_, i) => <CyberSkeleton key={i} />)}
            </div>
          );
        }
        if (arbState === 'error') {
          return <SystemError message="ARBITRAGE SCANNER OFFLINE" onRetry={fetchMarkets} />;
        }
        if (arbOpportunities.length === 0) {
          return (
            <div className="empty-cyber arb">
              <div className="empty-icon-cyber">◈</div>
              <p className="empty-text">NO ARB OPPORTUNITIES</p>
              <span className="empty-subtext">Min spread threshold: 3%</span>
              <span className="empty-hint">Scanning across platforms...</span>
            </div>
          );
        }
        return (
          <motion.div className="arb-grid-cyber" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="arb-banner">
              <span className="banner-icon">◆</span>
              <span className="banner-text">{arbOpportunities.length} ARBITRAGE SIGNALS DETECTED</span>
            </div>
            {arbOpportunities.map((arb, i) => renderArbCard(arb, i))}
          </motion.div>
        );

      case 'news':
        if (newsState === 'loading') {
          return (
            <div className="skeleton-grid-cyber news">
              {[...Array(6)].map((_, i) => <CyberSkeletonNews key={i} />)}
            </div>
          );
        }
        if (newsState === 'error') {
          return <SystemError message="NEWS FEED DISCONNECTED" onRetry={fetchNews} />;
        }
        if (newsItems.length === 0) {
          return (
            <div className="empty-cyber">
              <div className="empty-icon-cyber">◉</div>
              <p className="empty-text">NO NEWS DATA</p>
              <span className="empty-subtext">Monitoring feeds...</span>
            </div>
          );
        }
        return (
          <motion.div className="news-grid-cyber" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {newsItems.map((news, i) => renderNewsItem(news, i))}
          </motion.div>
        );

      case 'picks':
        if (userPredictions.length === 0) {
          return (
            <div className="empty-cyber onboarding">
              <div className="empty-icon-cyber pulse">◎</div>
              <p className="empty-text">NO PREDICTIONS LOGGED</p>
              <span className="empty-subtext">Select YES or NO on any market to begin</span>
              <button className="cta-cyber" onClick={() => setActiveTab('hot')}>
                <span className="cta-glow" />
                [ ACCESS MARKETS ]
              </button>
            </div>
          );
        }
        const userMarkets = markets.filter(m => userPredictions.some(p => p.marketId === m.id));
        return (
          <motion.div className="picks-grid-cyber" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {userMarkets.map((m, i) => renderMarketCard(m, i))}
          </motion.div>
        );

      default:
        return null;
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className={`cyber-terminal ${glitchActive ? 'glitch-active' : ''}`}>
      {/* Global scanlines overlay */}
      <div className="global-scanlines" aria-hidden="true" />

      {/* CRT vignette effect */}
      <div className="crt-vignette" aria-hidden="true" />

      {/* Boot sequence overlay */}
      <AnimatePresence>
        {!bootComplete && (
          <motion.div
            className="boot-overlay"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="boot-content">
              <div className="boot-logo">BERIGHT</div>
              <div className="boot-subtitle">PREDICTION TERMINAL v7.0</div>
              <div className="boot-text">{bootText}</div>
              <div className="boot-progress">
                <div className="boot-bar" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="cyber-topbar" role="banner">
        <div className="topbar-left">
          <div className="logo-cyber">
            <span className="logo-icon-cyber">◈</span>
            <span className="logo-text-cyber" data-text="TERMINAL">TERMINAL</span>
          </div>
        </div>
        <div className="topbar-center">
          <div className="status-indicator">
            <span className="status-pulse" />
            <span className="status-text">{onlineCount.toLocaleString()} CONNECTED</span>
          </div>
        </div>
        <div className="topbar-right">
          <div className="streak-display">
            <span className="streak-icon">◆</span>
            <span className="streak-value">{userStreak}</span>
          </div>
        </div>
      </header>

      {/* Activity banner */}
      <div className="activity-banner" aria-live="polite">
        <span className="activity-pulse" />
        <span className="activity-text">
          <span className="activity-count">{predCount.toLocaleString()}</span>
          PREDICTIONS IN LAST HOUR
        </span>
      </div>

      {/* Ticker */}
      {markets.length > 0 && (
        <div className="ticker-cyber" ref={tickerRef} aria-label="Trending markets">
          <div className="ticker-scroll-cyber">
            {[...markets.slice(0, 5), ...markets.slice(0, 5)].map((market, i) => {
              const cat = getCategoryInfo(market.title);
              return (
                <div key={`ticker-${i}`} className="ticker-item-cyber">
                  <span className="ticker-cat" style={{ color: cat.color }}>{cat.emoji}</span>
                  <span className="ticker-title-cyber">{market.title.slice(0, 30)}...</span>
                  <span className="ticker-pct-cyber">{formatPct(market.yesPct)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation tabs */}
      <nav className="tabs-cyber" role="tablist" aria-label="Market filters">
        {([
          { id: 'hot' as FilterTab, label: 'HOT', icon: '◉', count: markets.length },
          { id: 'arb' as FilterTab, label: 'ARB', icon: '◈', count: arbOpportunities.length },
          { id: 'news' as FilterTab, label: 'NEWS', icon: '◎', count: newsItems.length },
          { id: 'picks' as FilterTab, label: 'PICKS', icon: '◆', count: userPredictions.length },
        ]).map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            className={`tab-cyber ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-glow" />
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label-cyber">{tab.label}</span>
            {tab.count > 0 && <span className="tab-count-cyber">{tab.count}</span>}
          </button>
        ))}
      </nav>

      {/* Main content */}
      <main className="main-cyber" role="tabpanel" id={`panel-${activeTab}`}>
        <AnimatePresence mode="wait">
          {bootComplete && renderTabContent()}
        </AnimatePresence>
      </main>

      {/* Stats HUD */}
      <section className="hud-stats" aria-label="Your statistics">
        {userPredictions.length === 0 ? (
          <div className="hud-onboarding">
            <span className="hud-icon">◎</span>
            <span className="hud-text">MAKE YOUR FIRST PREDICTION TO INITIALIZE TRACKING</span>
          </div>
        ) : (
          <div className="hud-container">
            <div className="hud-stat">
              <span className="hud-label">ACCURACY</span>
              <span className="hud-value">68.5%</span>
            </div>
            <div className="hud-divider" />
            <div className="hud-stat">
              <span className="hud-label">PREDICTIONS</span>
              <span className="hud-value">{userPredictions.length}</span>
            </div>
            <div className="hud-divider" />
            <div className="hud-stat">
              <span className="hud-label">RANK</span>
              <span className="hud-value">TOP 15%</span>
            </div>
            <div className="hud-divider" />
            <div className="hud-stat">
              <span className="hud-label">STREAK</span>
              <span className="hud-value streak">{userStreak}</span>
            </div>
          </div>
        )}
      </section>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && selectedMarket && (
          <motion.div
            className="modal-overlay-cyber"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowShareModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-modal-title"
          >
            <motion.div
              className="modal-cyber"
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-border-glow" />
              <div className="modal-scanlines" />
              <div className="modal-content">
                <header className="modal-header-cyber">
                  <span className="modal-logo">◈ BERIGHT</span>
                  <span className={`modal-prediction ${predictionDirection?.toLowerCase()}`}>
                    PREDICTED {predictionDirection}
                  </span>
                </header>
                <h3 id="share-modal-title" className="modal-title-cyber">{selectedMarket.title}</h3>
                <div className="modal-stats-cyber">
                  <span className="modal-pct">{formatPct(selectedMarket.yesPct)} YES</span>
                  <span className="modal-vol">{formatVolume(selectedMarket.volume)} VOL</span>
                </div>
              </div>
              <div className="modal-actions-cyber">
                <button className="modal-btn twitter">SHARE ON X</button>
                <button className="modal-btn copy">COPY LINK</button>
              </div>
              <button
                className="modal-close-cyber"
                onClick={() => setShowShareModal(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />

      <style jsx>{`
        /* ╔═══════════════════════════════════════════════════════════════════╗
           ║  CYBERPUNK TERMINAL STYLES v7.0                                   ║
           ║  Typography: Orbitron + JetBrains Mono                            ║
           ║  Colors: Cyan, Magenta, Acid Green, Warning Orange                ║
           ╚═══════════════════════════════════════════════════════════════════╝ */

        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

        .cyber-terminal {
          /* Cyberpunk Color Palette */
          --cyber-void: #0a0a0f;
          --cyber-dark: #0d0d14;
          --cyber-surface: #12121a;
          --cyber-elevated: #1a1a24;

          --neon-cyan: #00F0FF;
          --neon-cyan-dim: rgba(0, 240, 255, 0.15);
          --neon-cyan-glow: rgba(0, 240, 255, 0.4);
          --neon-magenta: #FF00FF;
          --neon-magenta-dim: rgba(255, 0, 255, 0.15);
          --neon-magenta-glow: rgba(255, 0, 255, 0.4);
          --neon-green: #39FF14;
          --neon-green-dim: rgba(57, 255, 20, 0.15);
          --neon-green-glow: rgba(57, 255, 20, 0.4);
          --neon-orange: #FF6B00;
          --neon-orange-dim: rgba(255, 107, 0, 0.15);
          --neon-red: #FF0040;
          --neon-red-dim: rgba(255, 0, 64, 0.15);

          --text-bright: #FFFFFF;
          --text-primary: #E0E0E0;
          --text-secondary: #A0A0A0;
          --text-muted: #707080;

          --border-dim: rgba(0, 240, 255, 0.1);
          --border-subtle: rgba(0, 240, 255, 0.2);
          --border-bright: rgba(0, 240, 255, 0.4);

          min-height: 100dvh;
          background: var(--cyber-void);
          color: var(--text-primary);
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          padding-bottom: calc(140px + env(safe-area-inset-bottom));
          position: relative;
          overflow-x: hidden;
        }

        /* Glitch effect on container */
        .cyber-terminal.glitch-active {
          animation: terminalGlitch 0.15s ease;
        }

        @keyframes terminalGlitch {
          0%, 100% { transform: translate(0); filter: none; }
          25% { transform: translate(-2px, 1px); filter: hue-rotate(90deg); }
          50% { transform: translate(2px, -1px); filter: hue-rotate(-90deg); }
          75% { transform: translate(-1px, 2px); filter: saturate(2); }
        }

        /* ═══════════════════════════════════════════════════════════════
           GLOBAL EFFECTS
           ═══════════════════════════════════════════════════════════════ */

        .global-scanlines {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 9999;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.03) 2px,
            rgba(0, 0, 0, 0.03) 4px
          );
          animation: scanlineMove 10s linear infinite;
        }

        @keyframes scanlineMove {
          0% { background-position: 0 0; }
          100% { background-position: 0 100px; }
        }

        .crt-vignette {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 9998;
          background: radial-gradient(
            ellipse at center,
            transparent 0%,
            transparent 60%,
            rgba(0, 0, 0, 0.4) 100%
          );
        }

        /* ═══════════════════════════════════════════════════════════════
           BOOT SEQUENCE
           ═══════════════════════════════════════════════════════════════ */

        .boot-overlay {
          position: fixed;
          inset: 0;
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--cyber-void);
        }

        .boot-content {
          text-align: center;
        }

        .boot-logo {
          font-family: 'Orbitron', sans-serif;
          font-size: clamp(32px, 8vw, 48px);
          font-weight: 900;
          color: var(--neon-cyan);
          text-shadow:
            0 0 10px var(--neon-cyan),
            0 0 20px var(--neon-cyan),
            0 0 40px var(--neon-cyan-glow);
          letter-spacing: 8px;
          margin-bottom: 8px;
        }

        .boot-subtitle {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: var(--text-muted);
          letter-spacing: 4px;
          margin-bottom: 32px;
        }

        .boot-text {
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          color: var(--neon-green);
          margin-bottom: 24px;
          min-height: 20px;
        }

        .boot-progress {
          width: 200px;
          height: 4px;
          background: var(--cyber-elevated);
          border-radius: 2px;
          margin: 0 auto;
          overflow: hidden;
        }

        .boot-bar {
          height: 100%;
          background: linear-gradient(90deg, var(--neon-cyan), var(--neon-magenta));
          animation: bootProgress 2s ease-out forwards;
          box-shadow: 0 0 10px var(--neon-cyan);
        }

        @keyframes bootProgress {
          0% { width: 0%; }
          100% { width: 100%; }
        }

        /* ═══════════════════════════════════════════════════════════════
           TOP BAR
           ═══════════════════════════════════════════════════════════════ */

        .cyber-topbar {
          position: sticky;
          top: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          padding-top: max(12px, env(safe-area-inset-top));
          background: linear-gradient(180deg, var(--cyber-dark) 0%, rgba(13, 13, 20, 0.95) 100%);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border-dim);
        }

        .topbar-left, .topbar-right {
          flex: 1;
        }

        .topbar-center {
          flex: 2;
          display: flex;
          justify-content: center;
        }

        .topbar-right {
          display: flex;
          justify-content: flex-end;
        }

        .logo-cyber {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .logo-icon-cyber {
          font-size: 20px;
          color: var(--neon-cyan);
          text-shadow: 0 0 10px var(--neon-cyan-glow);
        }

        .logo-text-cyber {
          font-family: 'Orbitron', sans-serif;
          font-size: 16px;
          font-weight: 700;
          color: var(--text-bright);
          letter-spacing: 2px;
          position: relative;
        }

        .logo-text-cyber::before {
          content: attr(data-text);
          position: absolute;
          left: 2px;
          top: 0;
          color: var(--neon-magenta);
          opacity: 0;
          animation: logoGlitch 4s infinite;
        }

        @keyframes logoGlitch {
          0%, 90%, 100% { opacity: 0; clip-path: none; }
          92% { opacity: 0.8; clip-path: inset(20% 0 60% 0); transform: translateX(-2px); }
          94% { opacity: 0; }
          96% { opacity: 0.6; clip-path: inset(60% 0 20% 0); transform: translateX(2px); }
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          background: var(--cyber-elevated);
          border: 1px solid var(--border-dim);
          border-radius: 20px;
        }

        .status-pulse {
          width: 8px;
          height: 8px;
          background: var(--neon-green);
          border-radius: 50%;
          animation: statusPulse 2s ease-in-out infinite;
          box-shadow: 0 0 8px var(--neon-green), 0 0 16px var(--neon-green-glow);
        }

        @keyframes statusPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }

        .status-text {
          font-size: 11px;
          font-weight: 600;
          color: var(--neon-green);
          letter-spacing: 1px;
          font-variant-numeric: tabular-nums;
        }

        .streak-display {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: var(--neon-orange-dim);
          border: 1px solid var(--neon-orange);
          border-radius: 8px;
        }

        .streak-icon {
          color: var(--neon-orange);
          text-shadow: 0 0 8px var(--neon-orange);
        }

        .streak-value {
          font-family: 'Orbitron', sans-serif;
          font-size: 14px;
          font-weight: 700;
          color: var(--neon-orange);
        }

        /* ═══════════════════════════════════════════════════════════════
           ACTIVITY BANNER
           ═══════════════════════════════════════════════════════════════ */

        .activity-banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 10px 16px;
          background: linear-gradient(90deg,
            rgba(0, 240, 255, 0.05),
            rgba(255, 0, 255, 0.05),
            rgba(0, 240, 255, 0.05)
          );
          border-bottom: 1px solid var(--border-dim);
        }

        .activity-pulse {
          width: 6px;
          height: 6px;
          background: var(--neon-magenta);
          border-radius: 50%;
          animation: activityPulse 1s ease-in-out infinite;
        }

        @keyframes activityPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .activity-text {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          letter-spacing: 2px;
        }

        .activity-count {
          color: var(--neon-magenta);
          margin-right: 6px;
          text-shadow: 0 0 8px var(--neon-magenta-glow);
        }

        /* ═══════════════════════════════════════════════════════════════
           TICKER
           ═══════════════════════════════════════════════════════════════ */

        .ticker-cyber {
          overflow: hidden;
          border-bottom: 1px solid var(--border-dim);
          background: rgba(0, 0, 0, 0.3);
        }

        .ticker-scroll-cyber {
          display: flex;
          gap: 16px;
          padding: 10px 16px;
          animation: tickerScrollCyber 40s linear infinite;
          width: max-content;
        }

        .ticker-scroll-cyber:hover {
          animation-play-state: paused;
        }

        @keyframes tickerScrollCyber {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .ticker-item-cyber {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          background: var(--cyber-elevated);
          border: 1px solid var(--border-dim);
          border-radius: 4px;
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.2s;
        }

        .ticker-item-cyber:hover {
          border-color: var(--neon-cyan);
          box-shadow: 0 0 15px var(--neon-cyan-glow);
        }

        .ticker-cat {
          font-size: 14px;
        }

        .ticker-title-cyber {
          font-size: 11px;
          color: var(--text-secondary);
        }

        .ticker-pct-cyber {
          font-family: 'Orbitron', sans-serif;
          font-size: 11px;
          font-weight: 700;
          color: var(--neon-cyan);
          text-shadow: 0 0 6px var(--neon-cyan-glow);
        }

        /* ═══════════════════════════════════════════════════════════════
           TABS
           ═══════════════════════════════════════════════════════════════ */

        .tabs-cyber {
          position: sticky;
          top: 52px;
          z-index: 90;
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          background: var(--cyber-void);
          border-bottom: 1px solid var(--border-dim);
          overflow-x: auto;
          scrollbar-width: none;
        }

        .tabs-cyber::-webkit-scrollbar {
          display: none;
        }

        .tab-cyber {
          position: relative;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          background: var(--cyber-elevated);
          border: 1px solid var(--border-dim);
          border-radius: 4px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
          overflow: hidden;
        }

        .tab-glow {
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 0.3s;
        }

        .tab-cyber:hover {
          border-color: var(--border-subtle);
          color: var(--text-secondary);
        }

        .tab-cyber.active {
          background: var(--neon-cyan-dim);
          border-color: var(--neon-cyan);
          color: var(--neon-cyan);
          box-shadow: 0 0 20px var(--neon-cyan-glow), inset 0 0 20px var(--neon-cyan-dim);
        }

        .tab-cyber.active .tab-glow {
          opacity: 1;
          background: linear-gradient(
            90deg,
            transparent,
            var(--neon-cyan-dim),
            transparent
          );
          animation: tabGlowMove 2s linear infinite;
        }

        @keyframes tabGlowMove {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .tab-icon {
          font-size: 14px;
        }

        .tab-label-cyber {
          letter-spacing: 1px;
        }

        .tab-count-cyber {
          padding: 2px 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
        }

        .tab-cyber.active .tab-count-cyber {
          background: var(--neon-cyan);
          color: var(--cyber-void);
        }

        /* ═══════════════════════════════════════════════════════════════
           MAIN CONTENT
           ═══════════════════════════════════════════════════════════════ */

        .main-cyber {
          padding: 16px;
          min-height: 400px;
        }

        .markets-grid-cyber,
        .arb-grid-cyber,
        .picks-grid-cyber,
        .news-grid-cyber {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .skeleton-grid-cyber {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .skeleton-grid-cyber.news {
          gap: 12px;
        }

        /* ═══════════════════════════════════════════════════════════════
           CYBER SKELETON
           ═══════════════════════════════════════════════════════════════ */

        .cyber-skeleton {
          position: relative;
          background: var(--cyber-elevated);
          border: 1px solid var(--border-dim);
          border-radius: 8px;
          padding: 16px;
          overflow: hidden;
        }

        .skeleton-glitch-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, var(--neon-cyan), var(--neon-magenta), var(--neon-cyan));
          animation: glitchBar 2s linear infinite;
        }

        @keyframes glitchBar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .skeleton-header-row {
          display: flex;
          gap: 8px;
          margin-bottom: 14px;
        }

        .skeleton-chip {
          height: 24px;
          width: 70px;
          background: linear-gradient(90deg, var(--cyber-surface), var(--cyber-elevated), var(--cyber-surface));
          background-size: 200% 100%;
          animation: matrixShimmer 1.5s linear infinite;
          border-radius: 4px;
          border: 1px solid var(--border-dim);
        }

        .skeleton-chip.short {
          width: 50px;
        }

        .skeleton-chip.tiny {
          width: 40px;
        }

        .skeleton-title-block {
          margin-bottom: 16px;
        }

        .skeleton-line {
          height: 18px;
          width: 100%;
          background: linear-gradient(90deg, var(--cyber-surface), var(--cyber-elevated), var(--cyber-surface));
          background-size: 200% 100%;
          animation: matrixShimmer 1.5s linear infinite;
          border-radius: 4px;
          margin-bottom: 8px;
        }

        .skeleton-line.short {
          width: 60%;
        }

        .skeleton-data-bar {
          height: 12px;
          width: 100%;
          background: linear-gradient(90deg,
            var(--neon-cyan-dim) 0%,
            var(--neon-magenta-dim) 50%,
            var(--neon-cyan-dim) 100%
          );
          background-size: 200% 100%;
          animation: matrixShimmer 2s linear infinite;
          border-radius: 6px;
          margin-bottom: 16px;
        }

        .skeleton-metrics {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }

        .skeleton-metric {
          flex: 1;
          height: 36px;
          background: linear-gradient(90deg, var(--cyber-surface), var(--cyber-elevated), var(--cyber-surface));
          background-size: 200% 100%;
          animation: matrixShimmer 1.5s linear infinite;
          border-radius: 4px;
          border: 1px solid var(--border-dim);
        }

        .skeleton-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .skeleton-btn-cyber {
          height: 52px;
          background: linear-gradient(90deg, var(--cyber-surface), var(--cyber-elevated), var(--cyber-surface));
          background-size: 200% 100%;
          animation: matrixShimmer 1.5s linear infinite;
          border-radius: 4px;
          border: 1px solid var(--border-dim);
        }

        @keyframes matrixShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .matrix-rain {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          justify-content: space-around;
          pointer-events: none;
          opacity: 0.15;
        }

        .rain-drop {
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          color: var(--neon-green);
          animation: rainFall 2s linear infinite;
          text-shadow: 0 0 8px var(--neon-green);
        }

        @keyframes rainFall {
          0% { transform: translateY(-20px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(100%); opacity: 0; }
        }

        .cyber-skeleton-news {
          background: var(--cyber-elevated);
          border: 1px solid var(--border-dim);
          border-radius: 4px;
          padding: 14px 16px;
        }

        .skeleton-news-line {
          height: 16px;
          width: 90%;
          background: linear-gradient(90deg, var(--cyber-surface), var(--cyber-elevated), var(--cyber-surface));
          background-size: 200% 100%;
          animation: matrixShimmer 1.5s linear infinite;
          border-radius: 4px;
          margin-bottom: 10px;
        }

        .skeleton-news-meta {
          height: 12px;
          width: 120px;
          background: linear-gradient(90deg, var(--cyber-surface), var(--cyber-elevated), var(--cyber-surface));
          background-size: 200% 100%;
          animation: matrixShimmer 1.5s linear infinite;
          border-radius: 4px;
        }

        /* ═══════════════════════════════════════════════════════════════
           SYSTEM ERROR
           ═══════════════════════════════════════════════════════════════ */

        .system-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
        }

        .error-glitch {
          font-family: 'Orbitron', sans-serif;
          font-size: 24px;
          font-weight: 700;
          color: var(--neon-red);
          text-shadow: 0 0 10px var(--neon-red);
          position: relative;
          margin-bottom: 8px;
        }

        .error-glitch::before,
        .error-glitch::after {
          content: attr(data-text);
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
        }

        .error-glitch::before {
          color: var(--neon-cyan);
          animation: errorGlitch1 0.3s infinite;
          clip-path: inset(0 0 60% 0);
        }

        .error-glitch::after {
          color: var(--neon-magenta);
          animation: errorGlitch2 0.3s infinite;
          clip-path: inset(40% 0 0 0);
        }

        @keyframes errorGlitch1 {
          0%, 100% { transform: translate(0); }
          20% { transform: translate(-2px, 2px); }
          40% { transform: translate(2px, -2px); }
          60% { transform: translate(-1px, 1px); }
          80% { transform: translate(1px, -1px); }
        }

        @keyframes errorGlitch2 {
          0%, 100% { transform: translate(0); }
          20% { transform: translate(2px, -2px); }
          40% { transform: translate(-2px, 2px); }
          60% { transform: translate(1px, -1px); }
          80% { transform: translate(-1px, 1px); }
        }

        .error-code {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 16px;
        }

        .error-desc {
          font-size: 14px;
          color: var(--text-secondary);
          margin: 0 0 24px 0;
        }

        .retry-cyber {
          position: relative;
          padding: 14px 28px;
          background: transparent;
          border: 2px solid var(--neon-cyan);
          border-radius: 4px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          font-weight: 600;
          color: var(--neon-cyan);
          cursor: pointer;
          overflow: hidden;
          transition: all 0.3s;
        }

        .retry-cyber:hover {
          background: var(--neon-cyan-dim);
          box-shadow: 0 0 20px var(--neon-cyan-glow);
        }

        .btn-scanline {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--neon-cyan);
          animation: scanlineBtn 1.5s linear infinite;
        }

        @keyframes scanlineBtn {
          0% { top: 0; opacity: 1; }
          50% { opacity: 0.5; }
          100% { top: 100%; opacity: 0; }
        }

        .btn-text {
          position: relative;
          z-index: 1;
        }

        /* ═══════════════════════════════════════════════════════════════
           EMPTY STATE
           ═══════════════════════════════════════════════════════════════ */

        .empty-cyber {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
        }

        .empty-cyber.onboarding {
          background: linear-gradient(135deg, var(--neon-cyan-dim), var(--neon-magenta-dim));
          border: 1px dashed var(--border-subtle);
          border-radius: 8px;
        }

        .empty-icon-cyber {
          font-size: 48px;
          color: var(--neon-cyan);
          text-shadow: 0 0 20px var(--neon-cyan-glow);
          margin-bottom: 16px;
        }

        .empty-icon-cyber.pulse {
          animation: emptyPulse 2s ease-in-out infinite;
        }

        @keyframes emptyPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.7; }
        }

        .empty-text {
          font-family: 'Orbitron', sans-serif;
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 8px 0;
          letter-spacing: 2px;
        }

        .empty-subtext {
          font-size: 13px;
          color: var(--text-muted);
          margin-bottom: 4px;
        }

        .empty-hint {
          font-size: 11px;
          color: var(--text-muted);
          opacity: 0.7;
        }

        .cta-cyber {
          position: relative;
          margin-top: 24px;
          padding: 14px 28px;
          background: var(--neon-cyan);
          border: none;
          border-radius: 4px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          font-weight: 700;
          color: var(--cyber-void);
          cursor: pointer;
          overflow: hidden;
          transition: all 0.3s;
        }

        .cta-cyber:hover {
          box-shadow: 0 0 30px var(--neon-cyan-glow);
          transform: translateY(-2px);
        }

        .cta-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          transition: all 0.5s;
        }

        .cta-cyber:hover .cta-glow {
          width: 300px;
          height: 300px;
        }

        /* ═══════════════════════════════════════════════════════════════
           CYBER CARD
           ═══════════════════════════════════════════════════════════════ */

        .cyber-card {
          position: relative;
          background: var(--cyber-elevated);
          border-radius: 8px;
          overflow: hidden;
          cursor: pointer;
        }

        .card-border-glow {
          position: absolute;
          inset: 0;
          border-radius: 8px;
          padding: 1px;
          background: linear-gradient(
            135deg,
            var(--neon-cyan),
            transparent 30%,
            transparent 70%,
            var(--neon-magenta)
          );
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          opacity: 0.5;
          transition: opacity 0.3s;
        }

        .cyber-card:hover .card-border-glow {
          opacity: 1;
          animation: borderRotate 3s linear infinite;
        }

        @keyframes borderRotate {
          0% {
            background: linear-gradient(135deg, var(--neon-cyan), transparent 30%, transparent 70%, var(--neon-magenta));
          }
          25% {
            background: linear-gradient(225deg, var(--neon-cyan), transparent 30%, transparent 70%, var(--neon-magenta));
          }
          50% {
            background: linear-gradient(315deg, var(--neon-cyan), transparent 30%, transparent 70%, var(--neon-magenta));
          }
          75% {
            background: linear-gradient(45deg, var(--neon-cyan), transparent 30%, transparent 70%, var(--neon-magenta));
          }
          100% {
            background: linear-gradient(135deg, var(--neon-cyan), transparent 30%, transparent 70%, var(--neon-magenta));
          }
        }

        .card-scanlines {
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.05) 2px,
            rgba(0, 0, 0, 0.05) 4px
          );
          pointer-events: none;
          z-index: 1;
        }

        .card-inner {
          position: relative;
          z-index: 2;
          padding: 16px;
        }

        .cyber-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          flex-wrap: wrap;
          gap: 8px;
        }

        .header-chips {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .rank-chip {
          font-family: 'Orbitron', sans-serif;
          font-size: 12px;
          font-weight: 700;
          color: var(--text-muted);
        }

        .rank-hash {
          color: var(--neon-cyan);
        }

        .category-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border: 1px solid;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .cat-icon {
          font-size: 12px;
        }

        .platform-chip {
          font-size: 10px;
          font-weight: 600;
          color: var(--text-muted);
          letter-spacing: 1px;
          padding: 4px 8px;
          background: var(--cyber-surface);
          border-radius: 4px;
        }

        .hot-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: var(--neon-orange-dim);
          border: 1px solid var(--neon-orange);
          border-radius: 4px;
          font-family: 'Orbitron', sans-serif;
          font-size: 10px;
          font-weight: 700;
          color: var(--neon-orange);
        }

        .hot-pulse {
          width: 6px;
          height: 6px;
          background: var(--neon-orange);
          border-radius: 50%;
          animation: hotPulse 0.8s ease-in-out infinite;
          box-shadow: 0 0 8px var(--neon-orange);
        }

        @keyframes hotPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
        }

        .cyber-title {
          font-family: 'JetBrains Mono', monospace;
          font-size: 15px;
          font-weight: 600;
          line-height: 1.5;
          color: var(--text-primary);
          margin: 0 0 16px 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* ═══════════════════════════════════════════════════════════════
           ODDS DISPLAY
           ═══════════════════════════════════════════════════════════════ */

        .odds-display {
          margin-bottom: 16px;
        }

        .odds-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .odds-yes, .odds-no {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .odds-label {
          font-family: 'Orbitron', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .odds-yes .odds-label {
          color: var(--neon-green);
        }

        .odds-no .odds-label {
          color: var(--neon-red);
        }

        .odds-value {
          font-family: 'Orbitron', sans-serif;
          font-size: 18px;
          font-weight: 800;
        }

        .odds-yes .odds-value {
          color: var(--neon-green);
          text-shadow: 0 0 10px var(--neon-green-glow);
        }

        .odds-no .odds-value {
          color: var(--neon-red);
          text-shadow: 0 0 10px rgba(255, 0, 64, 0.4);
        }

        .odds-bar-cyber {
          display: flex;
          height: 12px;
          border-radius: 2px;
          overflow: hidden;
          background: var(--cyber-surface);
          border: 1px solid var(--border-dim);
        }

        .odds-fill-yes-cyber {
          position: relative;
          background: linear-gradient(90deg, var(--neon-green), rgba(57, 255, 20, 0.6));
          transition: width 0.5s ease;
        }

        .odds-fill-no-cyber {
          position: relative;
          background: linear-gradient(90deg, rgba(255, 0, 64, 0.6), var(--neon-red));
          transition: width 0.5s ease;
        }

        .fill-glow {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
          animation: fillGlow 2s linear infinite;
        }

        @keyframes fillGlow {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        /* ═══════════════════════════════════════════════════════════════
           STATS GRID
           ═══════════════════════════════════════════════════════════════ */

        .stats-grid-cyber {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 0;
          margin-bottom: 16px;
          border-top: 1px solid var(--border-dim);
          border-bottom: 1px solid var(--border-dim);
        }

        .stat-cell {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          justify-content: center;
        }

        .stat-icon-cyber {
          font-size: 14px;
          color: var(--neon-cyan);
        }

        .stat-data {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .stat-label-cyber {
          font-size: 9px;
          font-weight: 600;
          color: var(--text-muted);
          letter-spacing: 1px;
        }

        .stat-value-cyber {
          font-family: 'Orbitron', sans-serif;
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .stat-cell.urgent .stat-value-cyber {
          color: var(--neon-red);
          animation: urgentPulse 1s ease-in-out infinite;
        }

        @keyframes urgentPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        .stat-divider-cyber {
          width: 1px;
          height: 28px;
          background: var(--border-dim);
        }

        /* ═══════════════════════════════════════════════════════════════
           ACTION BUTTONS
           ═══════════════════════════════════════════════════════════════ */

        .action-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .cyber-btn {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 14px;
          border-radius: 4px;
          border: 2px solid;
          cursor: pointer;
          font-family: 'JetBrains Mono', monospace;
          transition: all 0.2s;
          overflow: hidden;
        }

        .btn-glow {
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 0.3s;
        }

        .btn-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .cyber-btn.yes {
          background: var(--neon-green-dim);
          border-color: var(--neon-green);
        }

        .cyber-btn.yes .btn-glow {
          background: radial-gradient(circle at center, var(--neon-green-glow), transparent 70%);
        }

        .cyber-btn.yes:hover {
          box-shadow: 0 0 30px var(--neon-green-glow), inset 0 0 30px var(--neon-green-dim);
          transform: translateY(-2px);
        }

        .cyber-btn.yes:hover .btn-glow {
          opacity: 1;
        }

        .cyber-btn.yes:active {
          background: var(--neon-green);
          transform: translateY(0);
        }

        .cyber-btn.yes:active .btn-direction,
        .cyber-btn.yes:active .btn-odds {
          color: var(--cyber-void);
        }

        .cyber-btn.yes .btn-direction,
        .cyber-btn.yes .btn-odds {
          color: var(--neon-green);
        }

        .cyber-btn.no {
          background: var(--neon-red-dim);
          border-color: var(--neon-red);
        }

        .cyber-btn.no .btn-glow {
          background: radial-gradient(circle at center, rgba(255, 0, 64, 0.4), transparent 70%);
        }

        .cyber-btn.no:hover {
          box-shadow: 0 0 30px rgba(255, 0, 64, 0.4), inset 0 0 30px var(--neon-red-dim);
          transform: translateY(-2px);
        }

        .cyber-btn.no:hover .btn-glow {
          opacity: 1;
        }

        .cyber-btn.no:active {
          background: var(--neon-red);
          transform: translateY(0);
        }

        .cyber-btn.no:active .btn-direction,
        .cyber-btn.no:active .btn-odds {
          color: var(--text-bright);
        }

        .cyber-btn.no .btn-direction,
        .cyber-btn.no .btn-odds {
          color: var(--neon-red);
        }

        .btn-direction {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 2px;
        }

        .btn-odds {
          font-family: 'Orbitron', sans-serif;
          font-size: 18px;
          font-weight: 800;
        }

        /* Predicted state */
        .predicted-state {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .predicted-badge-cyber {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .badge-icon {
          font-size: 14px;
        }

        .predicted-badge-cyber.yes {
          background: var(--neon-green-dim);
          border: 1px solid var(--neon-green);
          color: var(--neon-green);
        }

        .predicted-badge-cyber.no {
          background: var(--neon-red-dim);
          border: 1px solid var(--neon-red);
          color: var(--neon-red);
        }

        .share-cyber {
          padding: 14px 20px;
          background: var(--neon-cyan);
          border: none;
          border-radius: 4px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          font-weight: 700;
          color: var(--cyber-void);
          letter-spacing: 1px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .share-cyber:hover {
          box-shadow: 0 0 20px var(--neon-cyan-glow);
          transform: translateY(-2px);
        }

        /* ═══════════════════════════════════════════════════════════════
           ARB CARDS
           ═══════════════════════════════════════════════════════════════ */

        .arb-banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px 16px;
          background: linear-gradient(90deg, var(--neon-orange-dim), transparent, var(--neon-orange-dim));
          border: 1px solid var(--neon-orange);
          border-radius: 4px;
          margin-bottom: 16px;
        }

        .banner-icon {
          color: var(--neon-orange);
          font-size: 16px;
          text-shadow: 0 0 10px var(--neon-orange);
        }

        .banner-text {
          font-family: 'Orbitron', sans-serif;
          font-size: 12px;
          font-weight: 600;
          color: var(--neon-orange);
          letter-spacing: 2px;
        }

        .arb-card-cyber {
          position: relative;
          background: var(--cyber-elevated);
          border: 1px solid var(--neon-orange);
          border-radius: 4px;
          padding: 16px;
          overflow: hidden;
          transition: all 0.3s;
        }

        .arb-card-cyber:hover {
          box-shadow: 0 0 20px var(--neon-orange-dim);
        }

        .arb-glow {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--neon-orange), transparent);
          animation: arbGlow 2s linear infinite;
        }

        @keyframes arbGlow {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .arb-header-cyber {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .arb-spread-cyber {
          font-family: 'Orbitron', sans-serif;
          font-size: 24px;
          font-weight: 800;
          color: var(--neon-green);
          text-shadow: 0 0 15px var(--neon-green-glow);
        }

        .arb-confidence-cyber {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          letter-spacing: 1px;
        }

        .conf-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .conf-dot.high {
          background: var(--neon-green);
          box-shadow: 0 0 8px var(--neon-green);
        }

        .conf-dot.med {
          background: var(--neon-orange);
          box-shadow: 0 0 8px var(--neon-orange);
        }

        .conf-dot.low {
          background: var(--neon-red);
          box-shadow: 0 0 8px var(--neon-red);
        }

        .arb-title-cyber {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 16px 0;
          line-height: 1.5;
        }

        .arb-compare {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px;
          background: var(--cyber-surface);
          border: 1px solid var(--border-dim);
          border-radius: 4px;
          margin-bottom: 12px;
        }

        .arb-platform {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }

        .platform-label {
          font-size: 10px;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 2px;
        }

        .platform-price {
          font-family: 'Orbitron', sans-serif;
          font-size: 20px;
          font-weight: 700;
        }

        .platform-price.yes {
          color: var(--neon-green);
          text-shadow: 0 0 10px var(--neon-green-glow);
        }

        .platform-price.no {
          color: var(--neon-red);
          text-shadow: 0 0 10px rgba(255, 0, 64, 0.4);
        }

        .arb-vs {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .vs-line {
          width: 20px;
          height: 1px;
          background: var(--border-subtle);
        }

        .vs-text {
          font-family: 'Orbitron', sans-serif;
          font-size: 10px;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 2px;
        }

        .arb-strategy-cyber {
          font-size: 12px;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.6;
        }

        /* ═══════════════════════════════════════════════════════════════
           NEWS CARDS
           ═══════════════════════════════════════════════════════════════ */

        .news-card-cyber {
          position: relative;
          padding: 16px;
          padding-left: 24px;
          background: var(--cyber-elevated);
          border: 1px solid var(--border-dim);
          border-radius: 4px;
          transition: all 0.2s;
        }

        .news-card-cyber:hover {
          border-color: var(--neon-cyan);
          box-shadow: 0 0 15px var(--neon-cyan-dim);
        }

        .news-indicator {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          background: var(--neon-cyan);
        }

        .news-title-cyber {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
          margin: 0 0 12px 0;
          line-height: 1.6;
        }

        .news-footer-cyber {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .news-source-cyber {
          font-size: 11px;
          color: var(--text-muted);
          letter-spacing: 1px;
        }

        .news-link-cyber {
          font-size: 11px;
          font-weight: 700;
          color: var(--neon-cyan);
          text-decoration: none;
          letter-spacing: 1px;
          transition: all 0.2s;
        }

        .news-link-cyber:hover {
          text-shadow: 0 0 10px var(--neon-cyan-glow);
        }

        /* ═══════════════════════════════════════════════════════════════
           HUD STATS
           ═══════════════════════════════════════════════════════════════ */

        .hud-stats {
          position: fixed;
          bottom: calc(56px + env(safe-area-inset-bottom));
          left: 0;
          right: 0;
          z-index: 90;
          padding: 12px 16px;
          background: linear-gradient(180deg, rgba(10, 10, 15, 0.95), rgba(10, 10, 15, 0.98));
          backdrop-filter: blur(20px);
          border-top: 1px solid var(--border-dim);
        }

        .hud-onboarding {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 8px;
        }

        .hud-icon {
          font-size: 18px;
          color: var(--neon-cyan);
          text-shadow: 0 0 10px var(--neon-cyan-glow);
        }

        .hud-text {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          letter-spacing: 1px;
        }

        .hud-container {
          display: flex;
          align-items: center;
          justify-content: space-around;
        }

        .hud-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .hud-label {
          font-size: 9px;
          font-weight: 600;
          color: var(--text-muted);
          letter-spacing: 1px;
        }

        .hud-value {
          font-family: 'Orbitron', sans-serif;
          font-size: 14px;
          font-weight: 700;
          color: var(--neon-cyan);
          text-shadow: 0 0 8px var(--neon-cyan-glow);
        }

        .hud-value.streak {
          color: var(--neon-orange);
          text-shadow: 0 0 8px var(--neon-orange);
        }

        .hud-divider {
          width: 1px;
          height: 30px;
          background: var(--border-dim);
        }

        /* ═══════════════════════════════════════════════════════════════
           MODAL
           ═══════════════════════════════════════════════════════════════ */

        .modal-overlay-cyber {
          position: fixed;
          inset: 0;
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(0, 0, 0, 0.95);
          backdrop-filter: blur(10px);
        }

        .modal-cyber {
          position: relative;
          width: 100%;
          max-width: 380px;
          background: var(--cyber-elevated);
          border-radius: 8px;
          overflow: hidden;
        }

        .modal-border-glow {
          position: absolute;
          inset: 0;
          border-radius: 8px;
          padding: 2px;
          background: linear-gradient(135deg, var(--neon-cyan), var(--neon-magenta));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: modalBorderRotate 4s linear infinite;
        }

        @keyframes modalBorderRotate {
          0% { filter: hue-rotate(0deg); }
          100% { filter: hue-rotate(360deg); }
        }

        .modal-scanlines {
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.1) 2px,
            rgba(0, 0, 0, 0.1) 4px
          );
          pointer-events: none;
          z-index: 1;
        }

        .modal-content {
          position: relative;
          z-index: 2;
          padding: 24px;
        }

        .modal-header-cyber {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .modal-logo {
          font-family: 'Orbitron', sans-serif;
          font-size: 14px;
          font-weight: 700;
          color: var(--neon-cyan);
        }

        .modal-prediction {
          padding: 6px 14px;
          border-radius: 4px;
          font-family: 'Orbitron', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .modal-prediction.yes {
          background: var(--neon-green-dim);
          color: var(--neon-green);
          border: 1px solid var(--neon-green);
        }

        .modal-prediction.no {
          background: var(--neon-red-dim);
          color: var(--neon-red);
          border: 1px solid var(--neon-red);
        }

        .modal-title-cyber {
          font-size: 17px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 16px 0;
          line-height: 1.5;
        }

        .modal-stats-cyber {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-pct {
          font-family: 'Orbitron', sans-serif;
          font-size: 24px;
          font-weight: 800;
          color: var(--neon-green);
          text-shadow: 0 0 15px var(--neon-green-glow);
        }

        .modal-vol {
          font-size: 13px;
          color: var(--text-muted);
          letter-spacing: 1px;
        }

        .modal-actions-cyber {
          display: flex;
          gap: 12px;
          padding: 16px 24px 24px;
          position: relative;
          z-index: 2;
        }

        .modal-btn {
          flex: 1;
          padding: 14px;
          border: none;
          border-radius: 4px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .modal-btn.twitter {
          background: #1DA1F2;
          color: #fff;
        }

        .modal-btn.twitter:hover {
          box-shadow: 0 0 20px rgba(29, 161, 242, 0.5);
        }

        .modal-btn.copy {
          background: var(--cyber-surface);
          border: 1px solid var(--border-subtle);
          color: var(--text-primary);
        }

        .modal-btn.copy:hover {
          border-color: var(--neon-cyan);
          box-shadow: 0 0 15px var(--neon-cyan-dim);
        }

        .modal-close-cyber {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 32px;
          height: 32px;
          background: var(--cyber-surface);
          border: 1px solid var(--border-dim);
          border-radius: 4px;
          color: var(--text-primary);
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s;
          z-index: 3;
        }

        .modal-close-cyber:hover {
          border-color: var(--neon-red);
          color: var(--neon-red);
          box-shadow: 0 0 10px rgba(255, 0, 64, 0.3);
        }

        /* ═══════════════════════════════════════════════════════════════
           RESPONSIVE BREAKPOINTS
           ═══════════════════════════════════════════════════════════════ */

        /* Extra small devices (320px - 480px) */
        @media (max-width: 480px) {
          .cyber-topbar {
            padding: 10px 12px;
          }

          .logo-text-cyber {
            font-size: 14px;
          }

          .status-indicator {
            padding: 4px 10px;
          }

          .status-text {
            font-size: 10px;
          }

          .tabs-cyber {
            padding: 10px 12px;
          }

          .tab-cyber {
            padding: 8px 12px;
            font-size: 11px;
          }

          .tab-icon {
            font-size: 12px;
          }

          .main-cyber {
            padding: 12px;
          }

          .cyber-title {
            font-size: 14px;
          }

          .odds-value {
            font-size: 16px;
          }

          .btn-odds {
            font-size: 16px;
          }

          .stats-grid-cyber {
            flex-wrap: wrap;
            gap: 12px;
          }

          .stat-divider-cyber {
            display: none;
          }

          .stat-cell {
            flex: 0 0 calc(50% - 6px);
          }

          .hud-stats {
            padding: 10px 12px;
          }

          .hud-value {
            font-size: 12px;
          }
        }

        /* Small devices (481px - 768px) - 2 columns */
        @media (min-width: 481px) {
          .markets-grid-cyber,
          .arb-grid-cyber,
          .picks-grid-cyber {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }

          .hud-stats {
            max-width: 600px;
            left: 50%;
            transform: translateX(-50%);
            border-radius: 8px 8px 0 0;
            border-left: 1px solid var(--border-dim);
            border-right: 1px solid var(--border-dim);
          }
        }

        /* Medium devices (769px - 1024px) - 3 columns */
        @media (min-width: 769px) {
          .markets-grid-cyber,
          .arb-grid-cyber,
          .picks-grid-cyber {
            grid-template-columns: repeat(3, 1fr);
          }

          .main-cyber {
            max-width: 1000px;
            margin: 0 auto;
          }

          .cyber-topbar {
            padding: 14px 24px;
          }

          .tabs-cyber {
            padding: 14px 24px;
            justify-content: center;
          }

          .tab-cyber {
            padding: 12px 24px;
          }
        }

        /* Large devices (1025px+) - 4 columns */
        @media (min-width: 1025px) {
          .markets-grid-cyber,
          .arb-grid-cyber,
          .picks-grid-cyber {
            grid-template-columns: repeat(4, 1fr);
          }

          .main-cyber {
            max-width: 1400px;
            padding: 24px;
          }

          .hud-stats {
            max-width: 800px;
          }
        }

        /* Touch devices - disable hover transforms */
        @media (hover: none) and (pointer: coarse) {
          .cyber-btn:hover {
            transform: none;
          }

          .cyber-card:hover {
            transform: none;
          }

          .cta-cyber:hover {
            transform: none;
          }

          .share-cyber:hover {
            transform: none;
          }
        }

        /* Reduced motion preference */
        @media (prefers-reduced-motion: reduce) {
          .global-scanlines,
          .card-border-glow,
          .boot-bar,
          .matrix-rain,
          .rain-drop,
          .ticker-scroll-cyber,
          .status-pulse,
          .hot-pulse,
          .fill-glow,
          .skeleton-glitch-bar,
          .arb-glow,
          .btn-scanline {
            animation: none;
          }

          .cyber-terminal.glitch-active {
            animation: none;
          }

          .logo-text-cyber::before {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
