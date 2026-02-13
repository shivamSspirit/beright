'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import { usePrivy } from '@privy-io/react-auth';
import { getHotMarkets, getArbitrageOpportunities, getIntel, ApiMarket, ApiArbitrage } from '@/lib/api';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BERIGHT TERMINAL v8.1 - With Chat Interface
// Clean, professional design matching project aesthetics
// Typography: Bricolage Grotesque (display) + DM Mono (data)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type FilterTab = 'hot' | 'arb' | 'news' | 'picks' | 'chat';
type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// Chat Message Interface
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isTyping?: boolean;
}

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILITY FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
  if (diff < 0) return 'Ended';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 30) return `${Math.floor(days / 30)}mo`;
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return '<1h';
}

function getCategoryInfo(title: string): { emoji: string; label: string; colorClass: string } {
  const lower = title.toLowerCase();
  if (lower.includes('bitcoin') || lower.includes('btc') || lower.includes('eth') || lower.includes('crypto')) {
    return { emoji: '₿', label: 'Crypto', colorClass: 'crypto' };
  }
  if (lower.includes('trump') || lower.includes('biden') || lower.includes('election') || lower.includes('president')) {
    return { emoji: '🏛', label: 'Politics', colorClass: 'politics' };
  }
  if (lower.includes('fed') || lower.includes('rate') || lower.includes('inflation') || lower.includes('gdp')) {
    return { emoji: '📊', label: 'Economy', colorClass: 'economy' };
  }
  if (lower.includes('ai') || lower.includes('openai') || lower.includes('tech') || lower.includes('apple') || lower.includes('google')) {
    return { emoji: '🤖', label: 'AI/Tech', colorClass: 'tech' };
  }
  if (lower.includes('nba') || lower.includes('nfl') || lower.includes('game') || lower.includes('championship')) {
    return { emoji: '🏆', label: 'Sports', colorClass: 'sports' };
  }
  return { emoji: '📈', label: 'Markets', colorClass: 'markets' };
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SPARKLINE COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

  if (points.length > 0) {
    points[points.length - 1].value = currentPrice;
  }

  return points;
}

function Sparkline({ price, marketId }: { price: number; marketId: string }) {
  const points = useMemo(() => generateSparkData(price, marketId), [price, marketId]);

  const values = points.map(p => p.value);
  const min = Math.min(...values) * 0.92;
  const max = Math.max(...values) * 1.08;
  const range = max - min || 1;

  const width = 100;
  const height = 40;
  const paddingY = 4;
  const paddingRight = 6;
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

  const gradId = `spark-grad-${marketId.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div className="sparkline-container">
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isUp ? 'rgba(0, 230, 118, 0.25)' : 'rgba(255, 23, 68, 0.25)'} />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path
          d={pathData}
          fill="none"
          stroke={isUp ? 'var(--yes)' : 'var(--no)'}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={drawWidth} cy={lastY} r="3" fill={isUp ? 'var(--yes)' : 'var(--no)'} className="pulse-dot" />
        <circle cx={drawWidth} cy={lastY} r="1.5" fill="#fff" opacity="0.8" />
      </svg>
      <div className={`spark-change ${isUp ? 'up' : 'down'}`}>
        <span>{isUp ? '↑' : '↓'}</span>
        <span>{Math.abs(parseFloat(changePercent))}%</span>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SKELETON COMPONENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SkeletonCard({ index }: { index: number }) {
  return (
    <div className="skeleton-card" style={{ animationDelay: `${index * 50}ms` }}>
      <div className="skeleton-header">
        <div className="skeleton-chip" />
        <div className="skeleton-chip short" />
      </div>
      <div className="skeleton-title" />
      <div className="skeleton-title short" />
      <div className="skeleton-prices">
        <div className="skeleton-price" />
        <div className="skeleton-price" />
      </div>
      <div className="skeleton-bar" />
      <div className="skeleton-spark" />
      <div className="skeleton-stats">
        <div className="skeleton-stat" />
        <div className="skeleton-stat" />
        <div className="skeleton-stat" />
      </div>
    </div>
  );
}

function SkeletonNews() {
  return (
    <div className="skeleton-news">
      <div className="skeleton-news-line" />
      <div className="skeleton-news-meta" />
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ERROR STATE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="error-state">
      <div className="error-icon">!</div>
      <p className="error-message">{message}</p>
      <button className="retry-btn" onClick={onRetry}>
        Try Again
      </button>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function TerminalPage() {
  usePrivy();

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

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'system',
      content: 'Welcome to BeRight Terminal. Ask me about prediction markets, arbitrage opportunities, or market analysis.',
      timestamp: new Date(),
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // ━━━ DATA FETCHING ━━━

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

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

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

  // ━━━ HANDLERS ━━━

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

  // ━━━ CHAT HANDLERS ━━━

  // Scroll to bottom of chat
  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, scrollToBottom]);

  // Focus input when chat tab is active
  useEffect(() => {
    if (activeTab === 'chat' && chatInputRef.current) {
      chatInputRef.current.focus();
    }
  }, [activeTab]);

  // Generate AI response based on user query
  const generateAIResponse = useCallback(async (query: string): Promise<string> => {
    const lowerQuery = query.toLowerCase();

    // Check for specific commands/queries
    if (lowerQuery.includes('hot') || lowerQuery.includes('trending')) {
      const topMarkets = markets.slice(0, 3);
      if (topMarkets.length > 0) {
        return `Here are the hottest markets right now:\n\n${topMarkets.map((m, i) =>
          `${i + 1}. **${m.title}**\n   YES: ${m.yesPct}% | Volume: ${formatVolume(m.volume)}`
        ).join('\n\n')}`;
      }
      return "I'm currently loading market data. Please try again in a moment.";
    }

    if (lowerQuery.includes('arb') || lowerQuery.includes('arbitrage')) {
      if (arbOpportunities.length > 0) {
        const topArbs = arbOpportunities.slice(0, 3);
        return `Found ${arbOpportunities.length} arbitrage opportunities:\n\n${topArbs.map((a, i) =>
          `${i + 1}. **${a.topic}**\n   Spread: +${a.spread.toFixed(1)}% | ${a.platformA} vs ${a.platformB}`
        ).join('\n\n')}`;
      }
      return "No arbitrage opportunities detected at the moment. Minimum spread threshold is 3%.";
    }

    if (lowerQuery.includes('predict') || lowerQuery.includes('my pick')) {
      if (userPredictions.length > 0) {
        return `You've made ${userPredictions.length} prediction(s) this session. Keep building your track record!`;
      }
      return "You haven't made any predictions yet. Browse the Hot tab and make your first call!";
    }

    if (lowerQuery.includes('help') || lowerQuery.includes('command')) {
      return `**Available Commands:**\n
- "hot markets" - Show trending predictions
- "arbitrage" - Find arbitrage opportunities
- "my predictions" - View your picks
- "stats" - Your performance stats
- "news" - Latest market news
- Ask any question about prediction markets!`;
    }

    if (lowerQuery.includes('stat') || lowerQuery.includes('performance')) {
      return `**Your Stats:**\n
- Predictions: ${userPredictions.length}
- Streak: ${userStreak} days
- Accuracy: 68.5%
- Rank: Top 15%\n
Keep predicting to improve your rank!`;
    }

    if (lowerQuery.includes('news')) {
      if (newsItems.length > 0) {
        const topNews = newsItems.slice(0, 3);
        return `**Latest News:**\n\n${topNews.map((n, i) =>
          `${i + 1}. ${n.title}\n   Source: ${n.source}`
        ).join('\n\n')}`;
      }
      return "Loading news feed... Try again in a moment.";
    }

    // Default response for general queries
    const responses = [
      "That's an interesting question! Based on current market sentiment, I'd suggest checking the Hot tab for trending predictions.",
      "Great question! Prediction markets are showing high activity today. Would you like me to show you the top opportunities?",
      "I'm analyzing the markets... The crypto and politics categories are seeing the most volume right now.",
      "Based on my analysis, there are several interesting opportunities. Try asking about 'hot markets' or 'arbitrage' for specific insights.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }, [markets, arbOpportunities, userPredictions, newsItems, userStreak]);

  // Send chat message
  const handleSendMessage = useCallback(async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    // Add typing indicator
    const typingId = `typing-${Date.now()}`;
    setChatMessages(prev => [...prev, {
      id: typingId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isTyping: true,
    }]);

    // Simulate AI thinking delay
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 700));

    // Generate response
    const response = await generateAIResponse(userMessage.content);

    // Replace typing indicator with actual response
    setChatMessages(prev => prev.map(msg =>
      msg.id === typingId
        ? { ...msg, content: response, isTyping: false }
        : msg
    ));

    setIsChatLoading(false);
  }, [chatInput, isChatLoading, generateAIResponse]);

  // Handle Enter key
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Send quick action message directly
  const handleQuickAction = useCallback(async (query: string) => {
    if (isChatLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setIsChatLoading(true);

    const typingId = `typing-${Date.now()}`;
    setChatMessages(prev => [...prev, {
      id: typingId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isTyping: true,
    }]);

    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 700));
    const response = await generateAIResponse(query);

    setChatMessages(prev => prev.map(msg =>
      msg.id === typingId
        ? { ...msg, content: response, isTyping: false }
        : msg
    ));

    setIsChatLoading(false);
  }, [isChatLoading, generateAIResponse]);

  // Quick action buttons
  const quickActions = [
    { label: 'Hot Markets', query: 'Show me hot markets' },
    { label: 'Arbitrage', query: 'Find arbitrage opportunities' },
    { label: 'My Stats', query: 'Show my stats' },
    { label: 'Help', query: 'What commands are available?' },
  ];

  // ━━━ RENDER MARKET CARD ━━━

  const renderMarketCard = (market: MarketCard, index: number) => {
    const userPrediction = getUserPrediction(market.id);
    const category = getCategoryInfo(market.title);
    const isUrgent = market.closesIn.includes('h') && !market.closesIn.includes('d');

    // Mock 24h change
    const seedNum = market.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const change24h = ((seedNum % 20) - 10) * 0.5;
    const isUp = change24h >= 0;

    return (
      <motion.article
        key={market.id}
        className="market-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
      >
        {/* Header */}
        <header className="card-header">
          <div className="header-pills">
            <span className={`category-pill ${category.colorClass}`}>
              <span className="pill-emoji">{category.emoji}</span>
              {category.label}
            </span>
            <span className="platform-pill">{market.platform}</span>
          </div>
          {market.isHot && (
            <span className="hot-badge">
              <span className="hot-dot" />
              HOT
            </span>
          )}
        </header>

        {/* Title */}
        <h3 className="card-title">{market.title}</h3>

        {/* Price Row */}
        <div className="price-row">
          <div className="price-yes">
            <span className="price-label">YES</span>
            <span className="price-value">{market.yesPct.toFixed(0)}¢</span>
          </div>
          <div className="price-divider" />
          <div className="price-no">
            <span className="price-label">NO</span>
            <span className="price-value">{market.noPct.toFixed(0)}¢</span>
          </div>
        </div>

        {/* Probability Bar */}
        <div className="prob-bar">
          <div className="prob-fill" style={{ width: `${market.yesPct}%` }} />
        </div>

        {/* Sparkline */}
        <div className="spark-row">
          <Sparkline price={market.yesPct} marketId={market.id} />
        </div>

        {/* Stats Row */}
        <div className="stats-row">
          <div className="stat">
            <span className="stat-value">{formatVolume(market.volume)}</span>
            <span className="stat-label">Volume</span>
          </div>
          <div className={`stat change ${isUp ? 'up' : 'down'}`}>
            <span className="stat-value">{isUp ? '+' : ''}{change24h.toFixed(1)}%</span>
            <span className="stat-label">24h</span>
          </div>
          <div className={`stat time ${isUrgent ? 'urgent' : ''}`}>
            <span className="stat-value">{market.closesIn}</span>
            <span className="stat-label">Closes</span>
          </div>
        </div>

        {/* Action Buttons */}
        {userPrediction ? (
          <div className="predicted-state">
            <div className={`predicted-badge ${userPrediction.direction.toLowerCase()}`}>
              Predicted {userPrediction.direction}
            </div>
            <button
              className="share-btn"
              onClick={() => {
                setSelectedMarket(market);
                setPredictionDirection(userPrediction.direction);
                setShowShareModal(true);
              }}
            >
              Share
            </button>
          </div>
        ) : (
          <div className="action-row">
            <button className="predict-btn yes" onClick={() => handlePrediction(market, 'YES')}>
              <span className="btn-dir">YES</span>
              <span className="btn-pct">{market.yesPct.toFixed(0)}¢</span>
            </button>
            <button className="predict-btn no" onClick={() => handlePrediction(market, 'NO')}>
              <span className="btn-dir">NO</span>
              <span className="btn-pct">{market.noPct.toFixed(0)}¢</span>
            </button>
          </div>
        )}
      </motion.article>
    );
  };

  // ━━━ RENDER ARB CARD ━━━

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
        <span className={`arb-confidence ${arb.confidence > 0.8 ? 'high' : arb.confidence > 0.5 ? 'med' : 'low'}`}>
          {Math.round(arb.confidence * 100)}% conf
        </span>
      </header>
      <h3 className="arb-title">{arb.topic}</h3>
      <div className="arb-compare">
        <div className="arb-platform">
          <span className="platform-name">{arb.platformA.toUpperCase()}</span>
          <span className="platform-price yes">{(arb.priceA * 100).toFixed(0)}¢</span>
        </div>
        <div className="arb-vs">vs</div>
        <div className="arb-platform">
          <span className="platform-name">{arb.platformB.toUpperCase()}</span>
          <span className="platform-price no">{(arb.priceB * 100).toFixed(0)}¢</span>
        </div>
      </div>
      <p className="arb-strategy">{arb.strategy}</p>
    </motion.article>
  );

  // ━━━ RENDER NEWS ITEM ━━━

  const renderNewsItem = (news: NewsItem, index: number) => (
    <motion.article
      key={`news-${index}`}
      className="news-card"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
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

  // ━━━ TAB CONTENT ━━━

  const renderTabContent = () => {
    switch (activeTab) {
      case 'hot':
        if (marketsState === 'loading') {
          return (
            <div className="cards-grid">
              {[...Array(6)].map((_, i) => <SkeletonCard key={i} index={i} />)}
            </div>
          );
        }
        if (marketsState === 'error') {
          return <ErrorState message="Failed to load markets" onRetry={fetchMarkets} />;
        }
        if (markets.length === 0) {
          return (
            <div className="empty-state">
              <span className="empty-icon">📊</span>
              <p className="empty-title">No markets available</p>
              <p className="empty-desc">Check back soon for new predictions</p>
            </div>
          );
        }
        return (
          <div className="cards-grid">
            {markets.map((m, i) => renderMarketCard(m, i))}
          </div>
        );

      case 'arb':
        if (arbState === 'loading') {
          return (
            <div className="cards-grid">
              {[...Array(4)].map((_, i) => <SkeletonCard key={i} index={i} />)}
            </div>
          );
        }
        if (arbState === 'error') {
          return <ErrorState message="Failed to load arbitrage opportunities" onRetry={fetchMarkets} />;
        }
        if (arbOpportunities.length === 0) {
          return (
            <div className="empty-state arb">
              <span className="empty-icon">⚖️</span>
              <p className="empty-title">No arbitrage opportunities</p>
              <p className="empty-desc">Minimum spread threshold: 3%</p>
            </div>
          );
        }
        return (
          <div className="arb-grid">
            <div className="arb-banner">
              <span className="banner-count">{arbOpportunities.length}</span> arbitrage signals detected
            </div>
            {arbOpportunities.map((arb, i) => renderArbCard(arb, i))}
          </div>
        );

      case 'news':
        if (newsState === 'loading') {
          return (
            <div className="news-grid">
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
              <p className="empty-title">No news available</p>
              <p className="empty-desc">Monitoring feeds for updates</p>
            </div>
          );
        }
        return (
          <div className="news-grid">
            {newsItems.map((news, i) => renderNewsItem(news, i))}
          </div>
        );

      case 'picks':
        if (userPredictions.length === 0) {
          return (
            <div className="empty-state onboarding">
              <span className="empty-icon">🎯</span>
              <p className="empty-title">No predictions yet</p>
              <p className="empty-desc">Make your first prediction to track your picks</p>
              <button className="cta-btn" onClick={() => setActiveTab('hot')}>
                Browse Markets
              </button>
            </div>
          );
        }
        const userMarkets = markets.filter(m => userPredictions.some(p => p.marketId === m.id));
        return (
          <div className="cards-grid">
            {userMarkets.map((m, i) => renderMarketCard(m, i))}
          </div>
        );

      case 'chat':
        return (
          <div className="chat-container">
            {/* Chat Messages */}
            <div className="chat-messages" ref={chatContainerRef}>
              {chatMessages.map((msg) => (
                <motion.div
                  key={msg.id}
                  className={`chat-message ${msg.role}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {msg.role === 'assistant' && (
                    <div className="message-avatar">
                      <span>◈</span>
                    </div>
                  )}
                  <div className="message-content">
                    {msg.isTyping ? (
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    ) : (
                      <>
                        <div className="message-text">
                          {msg.content.split('\n').map((line, i) => (
                            <p key={i}>{line.replace(/\*\*(.*?)\*\*/g, '$1')}</p>
                          ))}
                        </div>
                        <span className="message-time">
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Quick Actions */}
            {chatMessages.length <= 2 && (
              <div className="quick-actions">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    className="quick-action-btn"
                    onClick={() => handleQuickAction(action.query)}
                    disabled={isChatLoading}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}

            {/* Chat Input */}
            <div className="chat-input-container">
              <div className="chat-input-wrapper">
                <input
                  ref={chatInputRef}
                  type="text"
                  className="chat-input"
                  placeholder="Ask about markets, arbitrage, news..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isChatLoading}
                />
                <button
                  className={`send-btn ${chatInput.trim() && !isChatLoading ? 'active' : ''}`}
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || isChatLoading}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 2L11 13" />
                    <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                  </svg>
                </button>
              </div>
              <p className="chat-hint">Press Enter to send</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ━━━ RENDER ━━━

  return (
    <div className="terminal-page">
      {/* Header */}
      <header className="terminal-header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">◈</span>
            <span className="logo-text">Terminal</span>
          </div>
        </div>
        <div className="header-center">
          <div className="live-indicator">
            <span className="live-dot" />
            <span className="live-text">{onlineCount.toLocaleString()} online</span>
          </div>
        </div>
        <div className="header-right">
          <div className="streak-badge">
            <span className="streak-fire">🔥</span>
            <span className="streak-num">{userStreak}</span>
          </div>
        </div>
      </header>

      {/* Activity Banner */}
      <div className="activity-bar">
        <span className="activity-dot" />
        <span className="activity-count">{predCount.toLocaleString()}</span>
        <span className="activity-label">predictions in last hour</span>
      </div>

      {/* Tabs */}
      <nav className="tab-nav">
        {([
          { id: 'hot' as FilterTab, label: 'Hot', icon: '🔥', count: markets.length },
          { id: 'arb' as FilterTab, label: 'Arb', icon: '⚖️', count: arbOpportunities.length },
          { id: 'news' as FilterTab, label: 'News', icon: '📰', count: newsItems.length },
          { id: 'picks' as FilterTab, label: 'Picks', icon: '🎯', count: userPredictions.length },
          { id: 'chat' as FilterTab, label: 'Chat', icon: '💬', count: chatMessages.length - 1 },
        ]).map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
            {tab.count > 0 && <span className="tab-count">{tab.count}</span>}
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className="terminal-main">
        <AnimatePresence mode="wait">
          {renderTabContent()}
        </AnimatePresence>
      </main>

      {/* Stats Footer */}
      <section className="stats-footer">
        {userPredictions.length === 0 ? (
          <div className="stats-onboarding">
            <span className="stats-icon">📊</span>
            <span className="stats-text">Make predictions to track your performance</span>
          </div>
        ) : (
          <div className="stats-grid">
            <div className="stat-block">
              <span className="stat-val">68.5%</span>
              <span className="stat-lbl">Accuracy</span>
            </div>
            <div className="stat-block">
              <span className="stat-val">{userPredictions.length}</span>
              <span className="stat-lbl">Predictions</span>
            </div>
            <div className="stat-block">
              <span className="stat-val">Top 15%</span>
              <span className="stat-lbl">Rank</span>
            </div>
            <div className="stat-block">
              <span className="stat-val streak">{userStreak}</span>
              <span className="stat-lbl">Streak</span>
            </div>
          </div>
        )}
      </section>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && selectedMarket && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowShareModal(false)}
          >
            <motion.div
              className="modal-content"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
            >
              <header className="modal-header">
                <span className="modal-logo">◈ BeRight</span>
                <span className={`modal-prediction ${predictionDirection?.toLowerCase()}`}>
                  Predicted {predictionDirection}
                </span>
              </header>
              <h3 className="modal-title">{selectedMarket.title}</h3>
              <div className="modal-stats">
                <span className="modal-pct">{selectedMarket.yesPct.toFixed(0)}% YES</span>
                <span className="modal-vol">{formatVolume(selectedMarket.volume)} vol</span>
              </div>
              <div className="modal-actions">
                <button className="modal-btn twitter">Share on X</button>
                <button className="modal-btn copy">Copy Link</button>
              </div>
              <button className="modal-close" onClick={() => setShowShareModal(false)}>×</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />

      <style jsx>{`
        /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           BERIGHT TERMINAL v8.0 - PROJECT THEME
           Uses existing CSS variables from globals.css
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

        .terminal-page {
          min-height: 100dvh;
          background: var(--bg-void, #000000);
          color: var(--text-primary, #fff);
          font-family: var(--font-display, 'Bricolage Grotesque', system-ui, sans-serif);
          padding-bottom: calc(140px + env(safe-area-inset-bottom));
        }

        /* ━━━ HEADER ━━━ */
        .terminal-header {
          position: sticky;
          top: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          padding-top: max(12px, env(safe-area-inset-top));
          background: linear-gradient(180deg, var(--bg-deep, #0A0A12) 0%, rgba(10, 10, 18, 0.95) 100%);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--card-border, rgba(255, 255, 255, 0.08));
        }

        .header-left, .header-right { flex: 1; }
        .header-center { flex: 2; display: flex; justify-content: center; }
        .header-right { display: flex; justify-content: flex-end; }

        .logo {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .logo-icon {
          font-size: 20px;
          color: var(--accent, #2979FF);
        }

        .logo-text {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }

        .live-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          background: var(--card-bg, #1A1A2E);
          border: 1px solid var(--card-border);
          border-radius: 20px;
        }

        .live-dot {
          width: 8px;
          height: 8px;
          background: var(--yes, #00E676);
          border-radius: 50%;
          animation: pulse 2s ease-in-out infinite;
          box-shadow: 0 0 8px var(--yes-glow, rgba(0, 230, 118, 0.4));
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }

        .live-text {
          font-size: 11px;
          font-weight: 600;
          font-family: var(--font-mono, 'DM Mono', monospace);
          color: var(--text-secondary, rgba(255, 255, 255, 0.7));
        }

        .streak-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          background: var(--fire, #FF6B35);
          background: linear-gradient(135deg, rgba(255, 107, 53, 0.2), rgba(255, 107, 53, 0.1));
          border: 1px solid rgba(255, 107, 53, 0.3);
          border-radius: 8px;
        }

        .streak-fire { font-size: 14px; }
        .streak-num {
          font-size: 14px;
          font-weight: 700;
          color: var(--fire);
          font-family: var(--font-mono);
        }

        /* ━━━ ACTIVITY BAR ━━━ */
        .activity-bar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 16px;
          background: linear-gradient(90deg,
            rgba(139, 92, 246, 0.05),
            rgba(41, 121, 255, 0.05),
            rgba(139, 92, 246, 0.05)
          );
          border-bottom: 1px solid var(--card-border);
        }

        .activity-dot {
          width: 6px;
          height: 6px;
          background: var(--ai, #8B5CF6);
          border-radius: 50%;
          animation: blink 1s ease-in-out infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .activity-count {
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 700;
          color: var(--ai);
        }

        .activity-label {
          font-size: 11px;
          color: var(--text-muted, rgba(255, 255, 255, 0.5));
        }

        /* ━━━ TAB NAV ━━━ */
        .tab-nav {
          position: sticky;
          top: 52px;
          z-index: 90;
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          background: var(--bg-void);
          border-bottom: 1px solid var(--card-border);
          overflow-x: auto;
          scrollbar-width: none;
        }

        .tab-nav::-webkit-scrollbar { display: none; }

        .tab-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 12px;
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 600;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .tab-btn:hover {
          background: var(--bg-elevated, #0D0D1A);
          border-color: rgba(255, 255, 255, 0.12);
          color: var(--text-secondary);
        }

        .tab-btn.active {
          background: linear-gradient(135deg, rgba(41, 121, 255, 0.15), rgba(41, 121, 255, 0.08));
          border-color: var(--accent);
          color: var(--accent);
        }

        .tab-icon { font-size: 14px; }
        .tab-label { letter-spacing: -0.01em; }

        .tab-count {
          padding: 2px 8px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          font-family: var(--font-mono);
        }

        .tab-btn.active .tab-count {
          background: var(--accent);
          color: #fff;
        }

        /* ━━━ MAIN CONTENT ━━━ */
        .terminal-main {
          padding: 16px;
          min-height: 400px;
        }

        .cards-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }

        .arb-grid, .news-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* ━━━ MARKET CARD ━━━ */
        .terminal-main :global(.market-card) {
          background: var(--card-bg-gradient, linear-gradient(145deg, #1C1C32, #161628));
          border: 1px solid var(--card-border);
          border-radius: var(--card-radius, 24px);
          padding: 16px;
          transition: all 0.2s;
        }

        .terminal-main :global(.market-card:hover) {
          border-color: rgba(255, 255, 255, 0.12);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px -8px rgba(0, 0, 0, 0.5);
        }

        .terminal-main :global(.card-header) {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .terminal-main :global(.header-pills) {
          display: flex;
          gap: 8px;
        }

        .terminal-main :global(.category-pill) {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .terminal-main :global(.category-pill.crypto) {
          background: rgba(255, 193, 7, 0.15);
          color: #FFC107;
          border: 1px solid rgba(255, 193, 7, 0.25);
        }

        .terminal-main :global(.category-pill.politics) {
          background: rgba(139, 92, 246, 0.15);
          color: var(--ai);
          border: 1px solid rgba(139, 92, 246, 0.25);
        }

        .terminal-main :global(.category-pill.economy) {
          background: var(--yes-subtle, rgba(0, 230, 118, 0.15));
          color: var(--yes);
          border: 1px solid rgba(0, 230, 118, 0.25);
        }

        .terminal-main :global(.category-pill.tech) {
          background: rgba(41, 121, 255, 0.15);
          color: var(--accent);
          border: 1px solid rgba(41, 121, 255, 0.25);
        }

        .terminal-main :global(.category-pill.sports) {
          background: rgba(255, 107, 53, 0.15);
          color: var(--fire);
          border: 1px solid rgba(255, 107, 53, 0.25);
        }

        .terminal-main :global(.category-pill.markets) {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-secondary);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .terminal-main :global(.pill-emoji) {
          font-size: 12px;
        }

        .terminal-main :global(.platform-pill) {
          padding: 4px 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          font-size: 10px;
          font-weight: 700;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .terminal-main :global(.hot-badge) {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: rgba(255, 107, 53, 0.15);
          border: 1px solid rgba(255, 107, 53, 0.3);
          border-radius: 6px;
          font-size: 10px;
          font-weight: 800;
          color: var(--fire);
          text-transform: uppercase;
        }

        .terminal-main :global(.hot-dot) {
          width: 6px;
          height: 6px;
          background: var(--fire);
          border-radius: 50%;
          animation: pulse 1s ease-in-out infinite;
        }

        .terminal-main :global(.card-title) {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.4;
          margin: 0 0 14px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* Price Row */
        .terminal-main :global(.price-row) {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-bottom: 10px;
        }

        .terminal-main :global(.price-yes),
        .terminal-main :global(.price-no) {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .terminal-main :global(.price-label) {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .terminal-main :global(.price-yes .price-label) { color: var(--yes); }
        .terminal-main :global(.price-no .price-label) { color: var(--no); }

        .terminal-main :global(.price-value) {
          font-size: 20px;
          font-weight: 800;
          font-family: var(--font-mono);
          letter-spacing: -0.02em;
        }

        .terminal-main :global(.price-yes .price-value) { color: var(--yes); }
        .terminal-main :global(.price-no .price-value) { color: var(--no); }

        .terminal-main :global(.price-divider) {
          width: 1px;
          height: 36px;
          background: var(--card-border);
        }

        /* Probability Bar */
        .terminal-main :global(.prob-bar) {
          height: 6px;
          background: var(--no-subtle, rgba(255, 23, 68, 0.15));
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 12px;
        }

        .terminal-main :global(.prob-fill) {
          height: 100%;
          background: var(--yes);
          border-radius: 3px;
          transition: width 0.3s ease;
        }

        /* Sparkline */
        .terminal-main :global(.spark-row) {
          height: 48px;
          margin-bottom: 12px;
        }

        .terminal-main :global(.sparkline-container) {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 100%;
        }

        .terminal-main :global(.sparkline-container svg) {
          flex: 1;
          height: 100%;
        }

        .terminal-main :global(.pulse-dot) {
          animation: dotPulse 2s ease-in-out infinite;
        }

        @keyframes dotPulse {
          0%, 100% { opacity: 1; r: 3; }
          50% { opacity: 0.7; r: 4; }
        }

        .terminal-main :global(.spark-change) {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          font-family: var(--font-mono);
        }

        .terminal-main :global(.spark-change.up) {
          background: var(--yes-subtle);
          color: var(--yes);
        }

        .terminal-main :global(.spark-change.down) {
          background: var(--no-subtle);
          color: var(--no);
        }

        /* Stats Row */
        .terminal-main :global(.stats-row) {
          display: flex;
          justify-content: space-between;
          margin-bottom: 14px;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 10px;
        }

        .terminal-main :global(.stat) {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .terminal-main :global(.stat-value) {
          font-size: 13px;
          font-weight: 700;
          font-family: var(--font-mono);
          color: var(--text-primary);
        }

        .terminal-main :global(.stat-label) {
          font-size: 10px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .terminal-main :global(.stat.change.up .stat-value) { color: var(--yes); }
        .terminal-main :global(.stat.change.down .stat-value) { color: var(--no); }
        .terminal-main :global(.stat.time.urgent .stat-value) { color: var(--fire); }

        /* Action Buttons */
        .terminal-main :global(.action-row) {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .terminal-main :global(.predict-btn) {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 14px 16px;
          border-radius: 14px;
          font-family: var(--font-display);
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid;
        }

        .terminal-main :global(.predict-btn.yes) {
          background: var(--yes-subtle);
          border-color: rgba(0, 230, 118, 0.3);
          color: var(--yes);
        }

        .terminal-main :global(.predict-btn.yes:hover) {
          background: rgba(0, 230, 118, 0.25);
          border-color: var(--yes);
          transform: scale(1.02);
        }

        .terminal-main :global(.predict-btn.no) {
          background: var(--no-subtle);
          border-color: rgba(255, 23, 68, 0.3);
          color: var(--no);
        }

        .terminal-main :global(.predict-btn.no:hover) {
          background: rgba(255, 23, 68, 0.25);
          border-color: var(--no);
          transform: scale(1.02);
        }

        .terminal-main :global(.btn-dir) {
          font-size: 14px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .terminal-main :global(.btn-pct) {
          font-size: 12px;
          font-weight: 600;
          font-family: var(--font-mono);
          opacity: 0.8;
        }

        /* Predicted State */
        .terminal-main :global(.predicted-state) {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .terminal-main :global(.predicted-badge) {
          flex: 1;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 700;
          text-align: center;
        }

        .terminal-main :global(.predicted-badge.yes) {
          background: var(--yes-subtle);
          color: var(--yes);
          border: 1px solid rgba(0, 230, 118, 0.3);
        }

        .terminal-main :global(.predicted-badge.no) {
          background: var(--no-subtle);
          color: var(--no);
          border: 1px solid rgba(255, 23, 68, 0.3);
        }

        .terminal-main :global(.share-btn) {
          padding: 12px 20px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .terminal-main :global(.share-btn:hover) {
          background: rgba(255, 255, 255, 0.12);
          color: var(--text-primary);
        }

        /* ━━━ ARB CARD ━━━ */
        .terminal-main :global(.arb-card) {
          background: var(--card-bg-gradient);
          border: 1px solid var(--card-border);
          border-radius: 20px;
          padding: 16px;
        }

        .terminal-main :global(.arb-header) {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .terminal-main :global(.arb-spread) {
          font-size: 18px;
          font-weight: 800;
          font-family: var(--font-mono);
          color: var(--yes);
        }

        .terminal-main :global(.arb-confidence) {
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          font-family: var(--font-mono);
        }

        .terminal-main :global(.arb-confidence.high) {
          background: var(--yes-subtle);
          color: var(--yes);
        }

        .terminal-main :global(.arb-confidence.med) {
          background: rgba(255, 193, 7, 0.15);
          color: #FFC107;
        }

        .terminal-main :global(.arb-confidence.low) {
          background: var(--no-subtle);
          color: var(--no);
        }

        .terminal-main :global(.arb-title) {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 14px;
          line-height: 1.4;
        }

        .terminal-main :global(.arb-compare) {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 12px;
          margin-bottom: 12px;
        }

        .terminal-main :global(.arb-platform) {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .terminal-main :global(.platform-name) {
          font-size: 10px;
          font-weight: 700;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .terminal-main :global(.platform-price) {
          font-size: 18px;
          font-weight: 800;
          font-family: var(--font-mono);
        }

        .terminal-main :global(.platform-price.yes) { color: var(--yes); }
        .terminal-main :global(.platform-price.no) { color: var(--no); }

        .terminal-main :global(.arb-vs) {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .terminal-main :global(.arb-strategy) {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.5;
          margin: 0;
        }

        .arb-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: var(--yes-subtle);
          border: 1px solid rgba(0, 230, 118, 0.25);
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          color: var(--yes);
        }

        .banner-count {
          font-weight: 800;
          font-family: var(--font-mono);
        }

        /* ━━━ NEWS CARD ━━━ */
        .terminal-main :global(.news-card) {
          padding: 14px 16px;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 14px;
          transition: all 0.2s;
        }

        .terminal-main :global(.news-card:hover) {
          border-color: rgba(255, 255, 255, 0.12);
        }

        .terminal-main :global(.news-title) {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 10px;
          line-height: 1.4;
        }

        .terminal-main :global(.news-footer) {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .terminal-main :global(.news-source) {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .terminal-main :global(.news-link) {
          font-size: 12px;
          font-weight: 600;
          color: var(--accent);
          text-decoration: none;
          transition: opacity 0.2s;
        }

        .terminal-main :global(.news-link:hover) {
          opacity: 0.8;
        }

        /* ━━━ SKELETON ━━━ */
        .skeleton-card {
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: var(--card-radius);
          padding: 16px;
          animation: skeletonPulse 1.5s ease-in-out infinite;
        }

        @keyframes skeletonPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .skeleton-header {
          display: flex;
          gap: 8px;
          margin-bottom: 14px;
        }

        .skeleton-chip {
          height: 24px;
          width: 80px;
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 8px;
        }

        .skeleton-chip.short { width: 50px; }

        .skeleton-title {
          height: 18px;
          width: 100%;
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 6px;
          margin-bottom: 8px;
        }

        .skeleton-title.short { width: 70%; }

        .skeleton-prices {
          display: flex;
          gap: 16px;
          justify-content: center;
          margin-bottom: 12px;
        }

        .skeleton-price {
          height: 36px;
          width: 60px;
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 8px;
        }

        .skeleton-bar {
          height: 6px;
          width: 100%;
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 3px;
          margin-bottom: 12px;
        }

        .skeleton-spark {
          height: 48px;
          width: 100%;
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 8px;
          margin-bottom: 12px;
        }

        .skeleton-stats {
          display: flex;
          gap: 12px;
          margin-bottom: 14px;
        }

        .skeleton-stat {
          flex: 1;
          height: 40px;
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 10px;
        }

        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .skeleton-news {
          padding: 14px 16px;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 14px;
        }

        .skeleton-news-line {
          height: 16px;
          width: 90%;
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 6px;
          margin-bottom: 10px;
        }

        .skeleton-news-meta {
          height: 12px;
          width: 120px;
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 6px;
        }

        /* ━━━ EMPTY & ERROR STATES ━━━ */
        .empty-state, .error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .empty-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 8px;
        }

        .empty-desc {
          font-size: 14px;
          color: var(--text-muted);
          margin: 0 0 20px;
        }

        .cta-btn {
          padding: 14px 28px;
          background: var(--accent);
          border: none;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          cursor: pointer;
          transition: all 0.2s;
        }

        .cta-btn:hover {
          transform: scale(1.02);
          box-shadow: 0 4px 20px rgba(41, 121, 255, 0.3);
        }

        .error-icon {
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 800;
          color: var(--no);
          background: var(--no-subtle);
          border-radius: 50%;
          margin-bottom: 16px;
        }

        .error-message {
          font-size: 14px;
          color: var(--text-secondary);
          margin: 0 0 20px;
        }

        .retry-btn {
          padding: 12px 24px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .retry-btn:hover {
          background: rgba(255, 255, 255, 0.12);
        }

        /* ━━━ STATS FOOTER ━━━ */
        .stats-footer {
          position: fixed;
          bottom: calc(72px + env(safe-area-inset-bottom));
          left: 0;
          right: 0;
          z-index: 50;
          padding: 12px 16px;
          background: linear-gradient(180deg, rgba(10, 10, 18, 0.95) 0%, var(--bg-deep) 100%);
          backdrop-filter: blur(20px);
          border-top: 1px solid var(--card-border);
        }

        .stats-onboarding {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .stats-icon { font-size: 16px; }

        .stats-text {
          font-size: 12px;
          color: var(--text-muted);
        }

        .stats-grid {
          display: flex;
          justify-content: space-around;
        }

        .stat-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .stat-val {
          font-size: 15px;
          font-weight: 800;
          font-family: var(--font-mono);
          color: var(--text-primary);
        }

        .stat-val.streak {
          color: var(--fire);
        }

        .stat-lbl {
          font-size: 10px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        /* ━━━ MODAL ━━━ */
        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(8px);
        }

        .modal-content {
          position: relative;
          width: 100%;
          max-width: 380px;
          background: var(--card-bg-gradient);
          border: 1px solid var(--card-border);
          border-radius: var(--card-radius);
          padding: 24px;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .modal-logo {
          font-size: 14px;
          font-weight: 700;
          color: var(--accent);
        }

        .modal-prediction {
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
        }

        .modal-prediction.yes {
          background: var(--yes-subtle);
          color: var(--yes);
        }

        .modal-prediction.no {
          background: var(--no-subtle);
          color: var(--no);
        }

        .modal-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 12px;
          line-height: 1.4;
        }

        .modal-stats {
          display: flex;
          gap: 16px;
          margin-bottom: 20px;
        }

        .modal-pct {
          font-size: 14px;
          font-weight: 700;
          font-family: var(--font-mono);
          color: var(--yes);
        }

        .modal-vol {
          font-size: 14px;
          font-weight: 600;
          font-family: var(--font-mono);
          color: var(--text-muted);
        }

        .modal-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .modal-btn {
          padding: 14px 16px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid;
        }

        .modal-btn.twitter {
          background: rgba(29, 161, 242, 0.15);
          border-color: rgba(29, 161, 242, 0.3);
          color: #1DA1F2;
        }

        .modal-btn.twitter:hover {
          background: rgba(29, 161, 242, 0.25);
        }

        .modal-btn.copy {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.12);
          color: var(--text-secondary);
        }

        .modal-btn.copy:hover {
          background: rgba(255, 255, 255, 0.12);
          color: var(--text-primary);
        }

        .modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.08);
          border: none;
          border-radius: 50%;
          font-size: 18px;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s;
        }

        .modal-close:hover {
          background: rgba(255, 255, 255, 0.12);
          color: var(--text-primary);
        }

        /* ━━━ CHAT INTERFACE ━━━ */
        .chat-container {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 280px);
          min-height: 400px;
          background: var(--bg-deep);
          border-radius: var(--card-radius);
          border: 1px solid var(--card-border);
          overflow: hidden;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          scroll-behavior: smooth;
        }

        .chat-messages::-webkit-scrollbar {
          width: 6px;
        }

        .chat-messages::-webkit-scrollbar-track {
          background: transparent;
        }

        .chat-messages::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }

        .chat-messages::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .chat-message {
          display: flex;
          gap: 10px;
          max-width: 85%;
        }

        .chat-message.user {
          align-self: flex-end;
          flex-direction: row-reverse;
        }

        .chat-message.assistant,
        .chat-message.system {
          align-self: flex-start;
        }

        .message-avatar {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(41, 121, 255, 0.2), rgba(139, 92, 246, 0.2));
          border: 1px solid rgba(41, 121, 255, 0.3);
          border-radius: 10px;
          color: var(--accent);
          font-size: 14px;
          flex-shrink: 0;
        }

        .message-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .chat-message.user .message-content {
          align-items: flex-end;
        }

        .message-text {
          padding: 12px 16px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.5;
        }

        .message-text p {
          margin: 0;
        }

        .message-text p:not(:last-child) {
          margin-bottom: 8px;
        }

        .chat-message.user .message-text {
          background: var(--accent);
          color: #fff;
          border-bottom-right-radius: 4px;
        }

        .chat-message.assistant .message-text,
        .chat-message.system .message-text {
          background: var(--card-bg);
          color: var(--text-primary);
          border: 1px solid var(--card-border);
          border-bottom-left-radius: 4px;
        }

        .chat-message.system .message-text {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(41, 121, 255, 0.1));
          border-color: rgba(139, 92, 246, 0.2);
        }

        .message-time {
          font-size: 10px;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        /* Typing Indicator */
        .typing-indicator {
          display: flex;
          gap: 4px;
          padding: 16px 20px;
        }

        .typing-indicator span {
          width: 8px;
          height: 8px;
          background: var(--text-muted);
          border-radius: 50%;
          animation: typingBounce 1.4s infinite ease-in-out;
        }

        .typing-indicator span:nth-child(1) { animation-delay: 0s; }
        .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
        .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }

        /* Quick Actions */
        .quick-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 0 16px 12px;
        }

        .quick-action-btn {
          padding: 8px 14px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--card-border);
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .quick-action-btn:hover {
          background: rgba(41, 121, 255, 0.1);
          border-color: var(--accent);
          color: var(--accent);
        }

        /* Chat Input */
        .chat-input-container {
          padding: 12px 16px 16px;
          background: var(--bg-elevated);
          border-top: 1px solid var(--card-border);
        }

        .chat-input-wrapper {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .chat-input {
          flex: 1;
          padding: 14px 18px;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 14px;
          font-size: 14px;
          font-family: var(--font-display);
          color: var(--text-primary);
          outline: none;
          transition: all 0.2s;
        }

        .chat-input::placeholder {
          color: var(--text-muted);
        }

        .chat-input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(41, 121, 255, 0.1);
        }

        .chat-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .send-btn {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 14px;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s;
        }

        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .send-btn.active {
          background: var(--accent);
          border-color: var(--accent);
          color: #fff;
        }

        .send-btn.active:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(41, 121, 255, 0.3);
        }

        .chat-hint {
          margin: 8px 0 0;
          font-size: 11px;
          color: var(--text-ghost);
          text-align: center;
        }

        /* ━━━ RESPONSIVE ━━━ */
        @media (max-width: 359px) {
          .terminal-header { padding: 10px 12px; }
          .logo-text { font-size: 14px; }
          .live-indicator { padding: 4px 10px; }
          .live-text { font-size: 10px; }
          .tab-nav { padding: 10px 12px; gap: 6px; }
          .tab-btn { padding: 8px 12px; font-size: 12px; }
          .terminal-main { padding: 12px; }
          .terminal-main :global(.market-card) { padding: 14px; border-radius: 20px; }
          .terminal-main :global(.card-title) { font-size: 14px; }
          .terminal-main :global(.price-value) { font-size: 18px; }
          .stats-footer { padding: 10px 12px; }

          /* Chat mobile */
          .chat-container { height: calc(100vh - 260px); min-height: 350px; border-radius: 16px; }
          .chat-messages { padding: 12px; gap: 10px; }
          .message-text { padding: 10px 14px; font-size: 13px; }
          .chat-input { padding: 12px 14px; font-size: 13px; }
          .send-btn { width: 44px; height: 44px; }
          .quick-action-btn { padding: 6px 12px; font-size: 11px; }
        }

        @media (min-width: 480px) {
          .cards-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (min-width: 768px) {
          .terminal-header { padding: 14px 24px; }
          .tab-nav { padding: 14px 24px; }
          .terminal-main { padding: 20px 24px; }
          .cards-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
          }

          /* Chat tablet */
          .chat-container { height: calc(100vh - 300px); max-width: 800px; margin: 0 auto; }
          .chat-message { max-width: 70%; }
        }

        @media (min-width: 1024px) {
          .terminal-main {
            max-width: 1200px;
            margin: 0 auto;
          }
          .cards-grid {
            grid-template-columns: repeat(3, 1fr);
          }

          /* Chat desktop */
          .chat-container { max-width: 900px; height: calc(100vh - 320px); }
          .chat-message { max-width: 60%; }
          .message-text { font-size: 15px; }
        }

        @media (min-width: 1280px) {
          .cards-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .live-dot, .activity-dot, .hot-dot, .terminal-main :global(.pulse-dot) {
            animation: none;
          }
          .skeleton-card, .skeleton-chip, .skeleton-title,
          .skeleton-price, .skeleton-bar, .skeleton-spark,
          .skeleton-stat, .skeleton-news-line, .skeleton-news-meta,
          .typing-indicator span {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
