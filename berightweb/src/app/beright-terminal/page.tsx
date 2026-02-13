'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import { usePrivy } from '@privy-io/react-auth';
import { getHotMarkets, getArbitrageOpportunities, getIntel, ApiMarket, ApiArbitrage } from '@/lib/api';

// ═══════════════════════════════════════════════════════════════
// BERIGHT TERMINAL v6.0 - Production-Ready with Full Error Handling
// Fixes: Tab mapping, skeleton loading, error states, WCAG contrast,
// sticky stats, conditional rendering, proper card styling
// ═══════════════════════════════════════════════════════════════

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
  if (diff < 0) return 'Closed';
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
    return { emoji: '🏛', label: 'POLITICS', color: '#818CF8' };
  }
  if (lower.includes('fed') || lower.includes('rate') || lower.includes('inflation') || lower.includes('gdp')) {
    return { emoji: '📊', label: 'ECON', color: '#34D399' };
  }
  if (lower.includes('ai') || lower.includes('openai') || lower.includes('tech') || lower.includes('apple') || lower.includes('google')) {
    return { emoji: '🤖', label: 'AI/TECH', color: '#A78BFA' };
  }
  if (lower.includes('nba') || lower.includes('nfl') || lower.includes('game') || lower.includes('championship')) {
    return { emoji: '🏆', label: 'SPORTS', color: '#F87171' };
  }
  return { emoji: '🔮', label: 'MARKETS', color: '#60A5FA' };
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
// SKELETON COMPONENTS
// ═══════════════════════════════════════════════════════════════

function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-header">
        <div className="skeleton-pill" />
        <div className="skeleton-pill short" />
      </div>
      <div className="skeleton-title" />
      <div className="skeleton-title short" />
      <div className="skeleton-bar" />
      <div className="skeleton-stats">
        <div className="skeleton-stat" />
        <div className="skeleton-stat" />
        <div className="skeleton-stat" />
      </div>
      <div className="skeleton-buttons">
        <div className="skeleton-btn" />
        <div className="skeleton-btn" />
      </div>
    </div>
  );
}

function SkeletonNews() {
  return (
    <div className="skeleton-news">
      <div className="skeleton-news-title" />
      <div className="skeleton-news-source" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ERROR STATE COMPONENT
// ═══════════════════════════════════════════════════════════════

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="error-state">
      <div className="error-icon">⚠️</div>
      <p className="error-message">{message}</p>
      <button className="retry-btn" onClick={onRetry}>
        <span className="retry-icon">↻</span>
        Tap to retry
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function TerminalPage() {
  usePrivy();

  // Tab state
  const [activeTab, setActiveTab] = useState<FilterTab>('hot');

  // Data states with loading/error tracking
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

  const tickerRef = useRef<HTMLDivElement>(null);

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

  // Initial load
  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  // Fetch news when tab changes
  useEffect(() => {
    if (activeTab === 'news' && newsState === 'idle') {
      fetchNews();
    }
  }, [activeTab, newsState, fetchNews]);

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

  const renderMarketCard = (market: MarketCard) => {
    const userPrediction = getUserPrediction(market.id);
    const category = getCategoryInfo(market.title);
    const isUrgent = market.closesIn.includes('h') && !market.closesIn.includes('d');

    return (
      <motion.article
        key={market.id}
        className="market-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        whileHover={{ y: -3, transition: { duration: 0.15 } }}
        role="article"
        aria-label={`Market: ${market.title}`}
      >
        {/* Card Header */}
        <header className="card-header">
          <div className="header-left">
            <span className="rank" aria-label={`Rank ${market.rank}`}>
              #{String(market.rank).padStart(2, '0')}
            </span>
            <span
              className="category-pill"
              style={{
                background: `${category.color}15`,
                borderColor: `${category.color}40`,
                color: category.color
              }}
            >
              {category.emoji} {category.label}
            </span>
            <span className="platform-badge">{market.platform}</span>
          </div>
          {market.isHot && (
            <span className="hot-badge" aria-label="Hot market">🔥 HOT</span>
          )}
        </header>

        {/* Title */}
        <h3 className="market-title">{market.title}</h3>

        {/* Visual Odds Bar - Properly separated YES/NO */}
        <div className="odds-container">
          <div className="odds-labels">
            <span className="yes-label">
              <span className="label-text">YES</span>
              <span className="label-pct">{formatPct(market.yesPct)}</span>
            </span>
            <span className="no-label">
              <span className="label-pct">{formatPct(market.noPct)}</span>
              <span className="label-text">NO</span>
            </span>
          </div>
          <div className="odds-bar" role="progressbar" aria-valuenow={market.yesPct} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="odds-fill-yes"
              style={{ width: `${market.yesPct}%` }}
            />
            <div
              className="odds-fill-no"
              style={{ width: `${market.noPct}%` }}
            />
          </div>
        </div>

        {/* Stats Row with proper labels */}
        <div className="stats-row">
          <div className="stat-item">
            <span className="stat-icon" aria-hidden="true">📊</span>
            <div className="stat-content">
              <span className="stat-label">Volume</span>
              <span className="stat-value">{formatVolume(market.volume)}</span>
            </div>
          </div>
          <div className="stat-divider-v" />
          <div className="stat-item">
            <span className="stat-icon" aria-hidden="true">👥</span>
            <div className="stat-content">
              <span className="stat-label">Traders</span>
              <span className="stat-value">{market.predictors.toLocaleString()}</span>
            </div>
          </div>
          <div className="stat-divider-v" />
          <div className={`stat-item ${isUrgent ? 'urgent' : ''}`}>
            <span className="stat-icon" aria-hidden="true">⏱️</span>
            <div className="stat-content">
              <span className="stat-label">Closes</span>
              <span className="stat-value">{market.closesIn}</span>
            </div>
          </div>
        </div>

        {/* Action Row */}
        {userPrediction ? (
          <div className="predicted-row">
            <div className={`predicted-badge ${userPrediction.direction.toLowerCase()}`}>
              ✓ You predicted {userPrediction.direction}
            </div>
            <button
              className="share-btn"
              onClick={() => {
                setSelectedMarket(market);
                setPredictionDirection(userPrediction.direction);
                setShowShareModal(true);
              }}
              aria-label="Share your prediction"
            >
              Share
            </button>
          </div>
        ) : (
          <div className="action-row">
            <button
              className="predict-btn yes"
              onClick={() => handlePrediction(market, 'YES')}
              aria-label={`Predict YES at ${formatPct(market.yesPct)}`}
            >
              <span className="btn-label">YES</span>
              <span className="btn-price">{formatPct(market.yesPct)}</span>
            </button>
            <button
              className="predict-btn no"
              onClick={() => handlePrediction(market, 'NO')}
              aria-label={`Predict NO at ${formatPct(market.noPct)}`}
            >
              <span className="btn-label">NO</span>
              <span className="btn-price">{formatPct(market.noPct)}</span>
            </button>
          </div>
        )}
      </motion.article>
    );
  };

  const renderArbCard = (arb: ApiArbitrage, index: number) => (
    <motion.article
      key={`arb-${index}`}
      className="arb-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <header className="arb-header">
        <span className="arb-spread">+{Math.round(arb.spread * 10) / 10}%</span>
        <span className="arb-confidence">
          {arb.confidence > 0.8 ? '🟢' : arb.confidence > 0.5 ? '🟡' : '🔴'}
          {Math.round(arb.confidence * 100)}% conf
        </span>
      </header>
      <h3 className="arb-title">{arb.topic}</h3>
      <div className="arb-platforms">
        <div className="platform-price">
          <span className="platform-name">{arb.platformA.toUpperCase()}</span>
          <span className="platform-pct yes">{formatPct(arb.priceA * 100)}</span>
        </div>
        <span className="vs-badge">VS</span>
        <div className="platform-price">
          <span className="platform-name">{arb.platformB.toUpperCase()}</span>
          <span className="platform-pct no">{formatPct(arb.priceB * 100)}</span>
        </div>
      </div>
      <p className="arb-strategy">{arb.strategy}</p>
    </motion.article>
  );

  const renderNewsItem = (news: NewsItem, index: number) => (
    <motion.article
      key={`news-${index}`}
      className="news-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <h4 className="news-title">{news.title}</h4>
      <footer className="news-footer">
        <span className="news-source">{news.source}</span>
        {news.url && (
          <a href={news.url} target="_blank" rel="noopener noreferrer" className="news-link">
            Read →
          </a>
        )}
      </footer>
    </motion.article>
  );

  // ═══════════════════════════════════════════════════════════════
  // TAB CONTENT - FIXED MAPPING
  // ═══════════════════════════════════════════════════════════════

  const renderTabContent = () => {
    switch (activeTab) {
      case 'hot':
        if (marketsState === 'loading') {
          return (
            <div className="skeleton-grid">
              {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          );
        }
        if (marketsState === 'error') {
          return <ErrorState message="Failed to load markets" onRetry={fetchMarkets} />;
        }
        if (markets.length === 0) {
          return (
            <div className="empty-state">
              <span className="empty-icon">📈</span>
              <p>No markets available</p>
              <span className="empty-hint">Check back soon for new prediction markets</span>
            </div>
          );
        }
        return (
          <motion.div className="markets-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {markets.map(renderMarketCard)}
          </motion.div>
        );

      case 'arb':
        if (arbState === 'loading') {
          return (
            <div className="skeleton-grid">
              {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          );
        }
        if (arbState === 'error') {
          return <ErrorState message="Failed to load arbitrage opportunities" onRetry={fetchMarkets} />;
        }
        if (arbOpportunities.length === 0) {
          return (
            <div className="empty-state arb-empty">
              <span className="empty-icon">🔍</span>
              <p>No arbitrage opportunities detected</p>
              <span className="empty-hint">Minimum spread threshold: 3%</span>
              <span className="empty-subhint">We continuously scan across platforms</span>
            </div>
          );
        }
        return (
          <motion.div className="arb-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="arb-header-banner">
              <span className="arb-icon">💰</span>
              <span className="arb-text">Found {arbOpportunities.length} arbitrage opportunities</span>
            </div>
            {arbOpportunities.map((arb, i) => renderArbCard(arb, i))}
          </motion.div>
        );

      case 'news':
        if (newsState === 'loading') {
          return (
            <div className="skeleton-grid news">
              {[...Array(6)].map((_, i) => <SkeletonNews key={i} />)}
            </div>
          );
        }
        if (newsState === 'error') {
          return <ErrorState message="Failed to load news" onRetry={fetchNews} />;
        }
        if (newsItems.length === 0) {
          return (
            <div className="empty-state">
              <span className="empty-icon">📰</span>
              <p>No news available</p>
              <span className="empty-hint">Check back for market-moving headlines</span>
            </div>
          );
        }
        return (
          <motion.div className="news-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {newsItems.map((news, i) => renderNewsItem(news, i))}
          </motion.div>
        );

      case 'picks':
        if (userPredictions.length === 0) {
          return (
            <div className="empty-state onboarding">
              <span className="empty-icon">🎯</span>
              <p>No predictions yet</p>
              <span className="empty-hint">Tap YES or NO on any market to make your first prediction</span>
              <button className="cta-btn" onClick={() => setActiveTab('hot')}>
                Browse Markets →
              </button>
            </div>
          );
        }
        const userMarkets = markets.filter(m => userPredictions.some(p => p.marketId === m.id));
        return (
          <motion.div className="picks-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {userMarkets.map(renderMarketCard)}
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
    <div className="terminal-page">
      {/* Top Bar */}
      <header className="top-bar" role="banner">
        <div className="logo-section">
          <span className="logo-icon" aria-hidden="true">⚡</span>
          <span className="logo-text">Terminal</span>
        </div>
        <div className="live-indicator" aria-live="polite">
          <span className="pulse-dot" aria-hidden="true" />
          <span className="online-count">{onlineCount.toLocaleString()} online</span>
        </div>
        <div className="user-badges">
          <span className="streak-badge" aria-label={`${userStreak} day streak`}>🔥 {userStreak}</span>
        </div>
      </header>

      {/* Social Proof Banner */}
      <div className="social-proof-banner" aria-live="polite">
        <span className="fire-icon" aria-hidden="true">🔥</span>
        <span className="proof-text">
          <strong>{predCount.toLocaleString()}</strong> predictions in the last hour
        </span>
      </div>

      {/* Hot Market Ticker */}
      {markets.length > 0 && (
        <div className="ticker-container" ref={tickerRef} aria-label="Trending markets">
          <div className="ticker-scroll">
            {[...markets.slice(0, 5), ...markets.slice(0, 5)].map((market, i) => {
              const cat = getCategoryInfo(market.title);
              return (
                <div key={`ticker-${i}`} className="ticker-pill">
                  <span className="ticker-emoji">{cat.emoji}</span>
                  <span className="ticker-title">{market.title.slice(0, 25)}...</span>
                  <span className="ticker-pct">{formatPct(market.yesPct)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <nav className="filter-tabs" role="tablist" aria-label="Market filters">
        {([
          { id: 'hot' as FilterTab, label: 'HOT', emoji: '🔥', count: markets.length },
          { id: 'arb' as FilterTab, label: 'ARB', emoji: '💰', count: arbOpportunities.length },
          { id: 'news' as FilterTab, label: 'NEWS', emoji: '📰', count: newsItems.length },
          { id: 'picks' as FilterTab, label: 'MY PICKS', emoji: '👤', count: userPredictions.length },
        ]).map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-emoji">{tab.emoji}</span>
            <span className="tab-label">{tab.label}</span>
            {tab.count > 0 && <span className="tab-count">{tab.count}</span>}
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className="main-content" role="tabpanel" id={`panel-${activeTab}`}>
        <AnimatePresence mode="wait">
          {renderTabContent()}
        </AnimatePresence>
      </main>

      {/* Sticky Stats Bar - Conditional rendering */}
      <section className="sticky-stats-bar" aria-label="Your statistics">
        {userPredictions.length === 0 ? (
          <div className="onboarding-cta">
            <span className="onboarding-icon">🎯</span>
            <span className="onboarding-text">Make your first prediction to start tracking!</span>
          </div>
        ) : (
          <div className="stats-container">
            <div className="stat-block">
              <span className="stat-label">Accuracy</span>
              <span className="stat-value">{userPredictions.length > 0 ? '68.5%' : '—'}</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-block">
              <span className="stat-label">Predictions</span>
              <span className="stat-value">{userPredictions.length}</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-block">
              <span className="stat-label">Rank</span>
              <span className="stat-value">{userPredictions.length > 0 ? 'Top 15%' : '—'}</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-block">
              <span className="stat-label">Streak</span>
              <span className="stat-value streak">🔥 {userStreak}</span>
            </div>
          </div>
        )}
      </section>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && selectedMarket && (
          <motion.div
            className="share-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowShareModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-modal-title"
          >
            <motion.div
              className="share-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="share-card">
                <div className="share-card-header">
                  <span className="share-logo">⚡ BeRight</span>
                  <span className={`share-prediction ${predictionDirection?.toLowerCase()}`}>
                    I predict {predictionDirection}
                  </span>
                </div>
                <h3 id="share-modal-title" className="share-title">{selectedMarket.title}</h3>
                <div className="share-stats">
                  <span className="share-pct">{formatPct(selectedMarket.yesPct)} YES</span>
                  <span className="share-volume">{formatVolume(selectedMarket.volume)} volume</span>
                </div>
              </div>
              <div className="share-actions">
                <button className="share-action-btn twitter">Share on X</button>
                <button className="share-action-btn copy">Copy Link</button>
              </div>
              <button
                className="close-modal"
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
        /* ═══════════════════════════════════════════════════════════════
           BERIGHT TERMINAL v6.0 - PRODUCTION CSS
           WCAG AA Compliant | Mobile-First | Proper Card Styling
           ═══════════════════════════════════════════════════════════════ */

        .terminal-page {
          --bg-void: #08080C;
          --bg-primary: #0A0A0F;
          --bg-card: rgba(255, 255, 255, 0.04);
          --bg-card-hover: rgba(255, 255, 255, 0.06);
          --border-subtle: rgba(255, 255, 255, 0.08);
          --border-hover: rgba(255, 255, 255, 0.15);

          --accent-green: #00FF6A;
          --accent-green-dim: rgba(0, 255, 106, 0.15);
          --accent-red: #FF4757;
          --accent-red-dim: rgba(255, 71, 87, 0.15);
          --accent-blue: #3B82F6;
          --accent-gold: #FFD93D;

          /* WCAG AA Compliant Text Colors */
          --text-primary: #F3F4F6;
          --text-secondary: #D1D5DB;
          --text-muted: #9CA3AF;
          --text-dim: #6B7280;

          min-height: 100dvh;
          background: var(--bg-void);
          color: var(--text-primary);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          padding-bottom: calc(140px + env(safe-area-inset-bottom));
        }

        /* ═══════════════════════════════════════════════════════════════
           TOP BAR
           ═══════════════════════════════════════════════════════════════ */

        .top-bar {
          position: sticky;
          top: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          padding-top: max(12px, env(safe-area-inset-top));
          background: rgba(8, 8, 12, 0.95);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border-subtle);
        }

        .logo-section {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .logo-icon {
          font-size: 20px;
        }

        .logo-text {
          font-size: 17px;
          font-weight: 700;
          letter-spacing: -0.5px;
          color: var(--text-primary);
        }

        .live-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .pulse-dot {
          width: 8px;
          height: 8px;
          background: var(--accent-green);
          border-radius: 50%;
          animation: pulse 2s ease-in-out infinite;
          box-shadow: 0 0 8px var(--accent-green);
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }

        .online-count {
          font-size: 12px;
          font-weight: 500;
          color: var(--text-muted);
          font-variant-numeric: tabular-nums;
        }

        .user-badges {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .streak-badge {
          padding: 5px 10px;
          background: linear-gradient(135deg, rgba(255, 165, 0, 0.2), rgba(255, 100, 0, 0.15));
          border: 1px solid rgba(255, 165, 0, 0.3);
          border-radius: 16px;
          font-size: 12px;
          font-weight: 600;
          color: #FFB347;
        }

        /* ═══════════════════════════════════════════════════════════════
           SOCIAL PROOF BANNER
           ═══════════════════════════════════════════════════════════════ */

        .social-proof-banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 16px;
          background: linear-gradient(90deg, rgba(0, 255, 106, 0.06), rgba(59, 130, 246, 0.06));
          border-bottom: 1px solid var(--border-subtle);
        }

        .fire-icon {
          font-size: 14px;
          animation: flamePulse 1.5s ease-in-out infinite;
        }

        @keyframes flamePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1) rotate(5deg); }
        }

        .proof-text {
          font-size: 13px;
          color: var(--text-secondary);
        }

        .proof-text strong {
          color: var(--text-primary);
          font-weight: 600;
        }

        /* ═══════════════════════════════════════════════════════════════
           TICKER
           ═══════════════════════════════════════════════════════════════ */

        .ticker-container {
          overflow: hidden;
          border-bottom: 1px solid var(--border-subtle);
        }

        .ticker-scroll {
          display: flex;
          gap: 12px;
          padding: 10px 16px;
          animation: tickerScroll 30s linear infinite;
          width: max-content;
        }

        .ticker-scroll:hover {
          animation-play-state: paused;
        }

        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .ticker-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 20px;
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.2s;
        }

        .ticker-pill:hover {
          border-color: var(--accent-green);
          background: var(--accent-green-dim);
        }

        .ticker-emoji {
          font-size: 12px;
        }

        .ticker-title {
          font-size: 11px;
          color: var(--text-secondary);
        }

        .ticker-pct {
          font-size: 11px;
          font-weight: 700;
          color: var(--accent-green);
          font-variant-numeric: tabular-nums;
        }

        /* ═══════════════════════════════════════════════════════════════
           FILTER TABS
           ═══════════════════════════════════════════════════════════════ */

        .filter-tabs {
          position: sticky;
          top: 52px;
          z-index: 90;
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          background: var(--bg-void);
          border-bottom: 1px solid var(--border-subtle);
          overflow-x: auto;
          scrollbar-width: none;
        }

        .filter-tabs::-webkit-scrollbar {
          display: none;
        }

        .tab-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: var(--bg-card);
          border: 1px solid transparent;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .tab-btn:hover {
          background: var(--bg-card-hover);
          color: var(--text-secondary);
        }

        .tab-btn.active {
          background: var(--accent-green-dim);
          border-color: rgba(0, 255, 106, 0.4);
          color: var(--accent-green);
        }

        .tab-emoji {
          font-size: 14px;
        }

        .tab-label {
          font-weight: 600;
        }

        .tab-count {
          padding: 2px 7px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          font-size: 10px;
          font-weight: 700;
          color: var(--text-muted);
        }

        .tab-btn.active .tab-count {
          background: rgba(0, 255, 106, 0.2);
          color: var(--accent-green);
        }

        /* ═══════════════════════════════════════════════════════════════
           MAIN CONTENT
           ═══════════════════════════════════════════════════════════════ */

        .main-content {
          padding: 16px;
          min-height: 400px;
        }

        .markets-grid, .arb-grid, .picks-grid, .news-grid {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .skeleton-grid {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .skeleton-grid.news {
          gap: 10px;
        }

        /* ═══════════════════════════════════════════════════════════════
           SKELETON LOADING
           ═══════════════════════════════════════════════════════════════ */

        .skeleton-card {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 16px;
          padding: 16px;
        }

        .skeleton-header {
          display: flex;
          gap: 8px;
          margin-bottom: 14px;
        }

        .skeleton-pill {
          height: 22px;
          width: 80px;
          background: linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04));
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 6px;
        }

        .skeleton-pill.short {
          width: 50px;
        }

        .skeleton-title {
          height: 20px;
          width: 100%;
          background: linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04));
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 6px;
          margin-bottom: 8px;
        }

        .skeleton-title.short {
          width: 70%;
        }

        .skeleton-bar {
          height: 10px;
          width: 100%;
          background: linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04));
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 5px;
          margin: 16px 0;
        }

        .skeleton-stats {
          display: flex;
          gap: 12px;
          margin-bottom: 14px;
        }

        .skeleton-stat {
          height: 28px;
          width: 70px;
          background: linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04));
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 6px;
        }

        .skeleton-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .skeleton-btn {
          height: 52px;
          background: linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04));
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 12px;
        }

        .skeleton-news {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 14px 16px;
        }

        .skeleton-news-title {
          height: 18px;
          width: 90%;
          background: linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04));
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 4px;
          margin-bottom: 8px;
        }

        .skeleton-news-source {
          height: 14px;
          width: 100px;
          background: linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04));
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 4px;
        }

        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ═══════════════════════════════════════════════════════════════
           ERROR STATE
           ═══════════════════════════════════════════════════════════════ */

        .error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
        }

        .error-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .error-message {
          font-size: 16px;
          font-weight: 500;
          color: var(--text-secondary);
          margin: 0 0 16px 0;
        }

        .retry-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .retry-btn:hover {
          background: var(--bg-card-hover);
          border-color: var(--accent-blue);
          color: var(--accent-blue);
        }

        .retry-icon {
          font-size: 16px;
        }

        /* ═══════════════════════════════════════════════════════════════
           EMPTY STATE
           ═══════════════════════════════════════════════════════════════ */

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
        }

        .empty-state.onboarding {
          background: linear-gradient(135deg, rgba(0, 255, 106, 0.03), rgba(59, 130, 246, 0.03));
          border-radius: 20px;
          border: 1px dashed var(--border-subtle);
        }

        .empty-icon {
          font-size: 52px;
          margin-bottom: 16px;
          opacity: 0.8;
        }

        .empty-state p {
          font-size: 17px;
          font-weight: 600;
          color: var(--text-secondary);
          margin: 0 0 8px 0;
        }

        .empty-hint {
          font-size: 14px;
          color: var(--text-muted);
          margin-bottom: 4px;
        }

        .empty-subhint {
          font-size: 12px;
          color: var(--text-dim);
        }

        .cta-btn {
          margin-top: 20px;
          padding: 12px 24px;
          background: var(--accent-green);
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          color: #000;
          cursor: pointer;
          transition: all 0.2s;
        }

        .cta-btn:hover {
          background: #00E65C;
          transform: translateY(-2px);
        }

        /* ═══════════════════════════════════════════════════════════════
           MARKET CARD - PROPER STYLING
           ═══════════════════════════════════════════════════════════════ */

        .market-card {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 16px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .market-card:hover {
          background: var(--bg-card-hover);
          border-color: var(--border-hover);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          flex-wrap: wrap;
          gap: 8px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .rank {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-dim);
          font-variant-numeric: tabular-nums;
        }

        .category-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border: 1px solid;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.3px;
        }

        .platform-badge {
          font-size: 10px;
          font-weight: 600;
          color: var(--text-dim);
          letter-spacing: 0.5px;
        }

        .hot-badge {
          padding: 4px 10px;
          background: linear-gradient(135deg, rgba(255, 107, 0, 0.2), rgba(255, 59, 48, 0.15));
          border: 1px solid rgba(255, 107, 0, 0.35);
          border-radius: 8px;
          font-size: 10px;
          font-weight: 700;
          color: #FF8C42;
        }

        .market-title {
          font-size: 16px;
          font-weight: 600;
          line-height: 1.4;
          color: var(--text-primary);
          margin: 0 0 14px 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* ═══════════════════════════════════════════════════════════════
           ODDS BAR - PROPERLY SEPARATED YES/NO
           ═══════════════════════════════════════════════════════════════ */

        .odds-container {
          margin-bottom: 14px;
        }

        .odds-labels {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .yes-label, .no-label {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .yes-label .label-text {
          font-size: 11px;
          font-weight: 700;
          color: var(--accent-green);
          letter-spacing: 0.5px;
        }

        .yes-label .label-pct {
          font-size: 16px;
          font-weight: 800;
          color: var(--accent-green);
          font-variant-numeric: tabular-nums;
        }

        .no-label .label-text {
          font-size: 11px;
          font-weight: 700;
          color: var(--accent-red);
          letter-spacing: 0.5px;
        }

        .no-label .label-pct {
          font-size: 16px;
          font-weight: 800;
          color: var(--accent-red);
          font-variant-numeric: tabular-nums;
        }

        .odds-bar {
          display: flex;
          height: 10px;
          border-radius: 5px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.05);
        }

        .odds-fill-yes {
          background: linear-gradient(90deg, var(--accent-green), rgba(0, 255, 106, 0.7));
          border-radius: 5px 0 0 5px;
          transition: width 0.5s ease;
        }

        .odds-fill-no {
          background: linear-gradient(90deg, rgba(255, 71, 87, 0.7), var(--accent-red));
          border-radius: 0 5px 5px 0;
          transition: width 0.5s ease;
        }

        /* ═══════════════════════════════════════════════════════════════
           STATS ROW - WITH LABELS
           ═══════════════════════════════════════════════════════════════ */

        .stats-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 0;
          margin-bottom: 14px;
          border-top: 1px solid var(--border-subtle);
          border-bottom: 1px solid var(--border-subtle);
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 1;
          justify-content: center;
        }

        .stat-icon {
          font-size: 14px;
        }

        .stat-content {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .stat-item .stat-label {
          font-size: 9px;
          font-weight: 500;
          color: var(--text-dim);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat-item .stat-value {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-secondary);
          font-variant-numeric: tabular-nums;
        }

        .stat-item.urgent .stat-value {
          color: var(--accent-red);
        }

        .stat-divider-v {
          width: 1px;
          height: 28px;
          background: var(--border-subtle);
        }

        /* ═══════════════════════════════════════════════════════════════
           ACTION BUTTONS
           ═══════════════════════════════════════════════════════════════ */

        .action-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .predict-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          padding: 14px;
          border-radius: 14px;
          border: 2px solid;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s ease;
        }

        .predict-btn.yes {
          background: var(--accent-green-dim);
          border-color: rgba(0, 255, 106, 0.35);
        }

        .predict-btn.yes:hover {
          background: rgba(0, 255, 106, 0.2);
          border-color: var(--accent-green);
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0, 255, 106, 0.2);
        }

        .predict-btn.yes:active {
          background: var(--accent-green);
          transform: translateY(0);
        }

        .predict-btn.yes:active .btn-label,
        .predict-btn.yes:active .btn-price {
          color: #000;
        }

        .predict-btn.yes .btn-label,
        .predict-btn.yes .btn-price {
          color: var(--accent-green);
        }

        .predict-btn.no {
          background: var(--accent-red-dim);
          border-color: rgba(255, 71, 87, 0.35);
        }

        .predict-btn.no:hover {
          background: rgba(255, 71, 87, 0.2);
          border-color: var(--accent-red);
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(255, 71, 87, 0.2);
        }

        .predict-btn.no:active {
          background: var(--accent-red);
          transform: translateY(0);
        }

        .predict-btn.no:active .btn-label,
        .predict-btn.no:active .btn-price {
          color: #fff;
        }

        .predict-btn.no .btn-label,
        .predict-btn.no .btn-price {
          color: var(--accent-red);
        }

        .btn-label {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .btn-price {
          font-size: 18px;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
        }

        /* Predicted State */
        .predicted-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .predicted-badge {
          flex: 1;
          padding: 14px 16px;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 600;
          text-align: center;
        }

        .predicted-badge.yes {
          background: var(--accent-green-dim);
          color: var(--accent-green);
          border: 1px solid rgba(0, 255, 106, 0.25);
        }

        .predicted-badge.no {
          background: var(--accent-red-dim);
          color: var(--accent-red);
          border: 1px solid rgba(255, 71, 87, 0.25);
        }

        .share-btn {
          padding: 14px 20px;
          background: var(--accent-blue);
          border: none;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          transition: all 0.15s;
        }

        .share-btn:hover {
          background: #2563EB;
          transform: translateY(-2px);
        }

        /* ═══════════════════════════════════════════════════════════════
           ARB CARDS
           ═══════════════════════════════════════════════════════════════ */

        .arb-header-banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 16px;
          background: linear-gradient(90deg, rgba(255, 215, 0, 0.08), rgba(255, 165, 0, 0.08));
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 12px;
          margin-bottom: 14px;
        }

        .arb-icon {
          font-size: 18px;
        }

        .arb-text {
          font-size: 14px;
          font-weight: 600;
          color: var(--accent-gold);
        }

        .arb-card {
          background: var(--bg-card);
          border: 1px solid rgba(255, 215, 0, 0.15);
          border-radius: 16px;
          padding: 16px;
          transition: all 0.2s;
        }

        .arb-card:hover {
          border-color: rgba(255, 215, 0, 0.3);
          box-shadow: 0 4px 16px rgba(255, 215, 0, 0.1);
        }

        .arb-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .arb-spread {
          font-size: 22px;
          font-weight: 800;
          color: var(--accent-green);
        }

        .arb-confidence {
          font-size: 12px;
          font-weight: 500;
          color: var(--text-muted);
        }

        .arb-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 14px 0;
          line-height: 1.4;
        }

        .arb-platforms {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          padding: 12px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 12px;
        }

        .platform-price {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .platform-name {
          font-size: 10px;
          font-weight: 700;
          color: var(--text-dim);
          letter-spacing: 1px;
        }

        .platform-pct {
          font-size: 20px;
          font-weight: 700;
        }

        .platform-pct.yes {
          color: var(--accent-green);
        }

        .platform-pct.no {
          color: var(--accent-red);
        }

        .vs-badge {
          padding: 4px 10px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          font-size: 10px;
          font-weight: 700;
          color: var(--text-dim);
          letter-spacing: 1px;
        }

        .arb-strategy {
          font-size: 13px;
          color: var(--text-muted);
          margin: 0;
          line-height: 1.5;
        }

        /* ═══════════════════════════════════════════════════════════════
           NEWS CARDS
           ═══════════════════════════════════════════════════════════════ */

        .news-card {
          padding: 16px;
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 14px;
          transition: all 0.2s;
        }

        .news-card:hover {
          background: var(--bg-card-hover);
          border-color: var(--border-hover);
        }

        .news-title {
          font-size: 15px;
          font-weight: 500;
          color: var(--text-primary);
          margin: 0 0 10px 0;
          line-height: 1.5;
        }

        .news-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .news-source {
          font-size: 12px;
          color: var(--text-dim);
          font-weight: 500;
        }

        .news-link {
          font-size: 12px;
          font-weight: 600;
          color: var(--accent-blue);
          text-decoration: none;
          transition: color 0.2s;
        }

        .news-link:hover {
          color: #60A5FA;
        }

        /* ═══════════════════════════════════════════════════════════════
           STICKY STATS BAR
           ═══════════════════════════════════════════════════════════════ */

        .sticky-stats-bar {
          position: fixed;
          bottom: calc(56px + env(safe-area-inset-bottom));
          left: 0;
          right: 0;
          z-index: 90;
          padding: 12px 16px;
          background: rgba(8, 8, 12, 0.95);
          backdrop-filter: blur(20px);
          border-top: 1px solid var(--border-subtle);
        }

        .onboarding-cta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 8px;
        }

        .onboarding-icon {
          font-size: 20px;
        }

        .onboarding-text {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .stats-container {
          display: flex;
          align-items: center;
          justify-content: space-around;
        }

        .stat-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .stat-block .stat-label {
          font-size: 10px;
          font-weight: 500;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat-block .stat-value {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .stat-block .stat-value.streak {
          color: #FFB347;
        }

        .stat-divider {
          width: 1px;
          height: 30px;
          background: var(--border-subtle);
        }

        /* ═══════════════════════════════════════════════════════════════
           SHARE MODAL
           ═══════════════════════════════════════════════════════════════ */

        .share-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(0, 0, 0, 0.9);
          backdrop-filter: blur(10px);
        }

        .share-modal {
          position: relative;
          width: 100%;
          max-width: 360px;
        }

        .share-card {
          background: linear-gradient(145deg, rgba(26, 26, 46, 0.95), rgba(18, 18, 26, 0.95));
          border: 1px solid var(--border-subtle);
          border-radius: 20px;
          padding: 24px;
          margin-bottom: 16px;
        }

        .share-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .share-logo {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .share-prediction {
          padding: 5px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
        }

        .share-prediction.yes {
          background: var(--accent-green-dim);
          color: var(--accent-green);
        }

        .share-prediction.no {
          background: var(--accent-red-dim);
          color: var(--accent-red);
        }

        .share-title {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 16px 0;
          line-height: 1.4;
        }

        .share-stats {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .share-pct {
          font-size: 24px;
          font-weight: 800;
          color: var(--accent-green);
        }

        .share-volume {
          font-size: 14px;
          color: var(--text-muted);
        }

        .share-actions {
          display: flex;
          gap: 10px;
        }

        .share-action-btn {
          flex: 1;
          padding: 14px;
          border: none;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }

        .share-action-btn.twitter {
          background: #1DA1F2;
          color: #fff;
        }

        .share-action-btn.twitter:hover {
          background: #0C90E0;
        }

        .share-action-btn.copy {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          color: var(--text-primary);
        }

        .share-action-btn.copy:hover {
          background: var(--bg-card-hover);
        }

        .close-modal {
          position: absolute;
          top: -44px;
          right: 0;
          width: 36px;
          height: 36px;
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 50%;
          color: var(--text-primary);
          font-size: 18px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .close-modal:hover {
          background: var(--bg-card-hover);
          border-color: var(--border-hover);
        }

        /* ═══════════════════════════════════════════════════════════════
           RESPONSIVE
           ═══════════════════════════════════════════════════════════════ */

        @media (max-width: 359px) {
          .top-bar {
            padding: 10px 12px;
          }

          .logo-text {
            font-size: 15px;
          }

          .filter-tabs {
            padding: 10px 12px;
          }

          .tab-btn {
            padding: 6px 10px;
            font-size: 12px;
          }

          .main-content {
            padding: 12px;
          }

          .market-card {
            padding: 14px;
          }

          .market-title {
            font-size: 15px;
          }

          .predict-btn {
            padding: 12px;
          }

          .btn-price {
            font-size: 16px;
          }

          .stats-row {
            flex-wrap: wrap;
            gap: 12px;
          }

          .stat-divider-v {
            display: none;
          }
        }

        @media (min-width: 640px) {
          .markets-grid, .arb-grid, .picks-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }

          .market-title {
            font-size: 16px;
          }

          .sticky-stats-bar {
            max-width: 600px;
            left: 50%;
            transform: translateX(-50%);
            border-radius: 16px 16px 0 0;
            bottom: calc(60px + env(safe-area-inset-bottom));
          }
        }

        @media (min-width: 1024px) {
          .markets-grid, .arb-grid, .picks-grid {
            grid-template-columns: repeat(3, 1fr);
          }

          .main-content {
            max-width: 1200px;
            margin: 0 auto;
          }
        }

        /* Touch devices */
        @media (hover: none) and (pointer: coarse) {
          .predict-btn:hover {
            transform: none;
            box-shadow: none;
          }

          .market-card:hover {
            transform: none;
            box-shadow: none;
          }
        }
      `}</style>
    </div>
  );
}
