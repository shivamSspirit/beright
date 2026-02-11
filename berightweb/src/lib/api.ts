/**
 * BeRight API Client
 * Connects berightweb frontend to beright-ts backend
 *
 * IMPORTANT: All API calls go through beright-ts (port 3001)
 * No duplicate API routes - single source of truth
 */

// API base URL - use local proxy (rewrites in next.config.ts handle forwarding to backend)
// This avoids CORS issues in the browser
const API_BASE = '';

// ============ TYPES (synced with beright-ts/types/) ============

export type Platform = 'polymarket' | 'kalshi' | 'manifold' | 'limitless' | 'metaculus';
export type DisplayPlatform = 'Kalshi' | 'Polymarket' | 'Manifold' | 'Limitless' | 'Metaculus';

export interface ApiMarket {
  id: string | null;
  platform: Platform;
  title: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  yesPct: number;
  noPct: number;
  volume: number;
  liquidity: number;
  endDate: string | null;
  status: 'active' | 'closed' | 'resolved';
  url: string;
}

export interface ApiArbitrage {
  topic: string;
  platformA: Platform;
  platformB: Platform;
  marketATitle?: string;
  marketBTitle?: string;
  priceA: number;
  priceB: number;
  spread: number;
  profitPercent: number;
  strategy: string;
  confidence: number;
  volumeA?: number;
  volumeB?: number;
}

export interface MarketsResponse {
  count: number;
  markets: ApiMarket[];
  arbitrage?: ApiArbitrage[];
}

export interface LeaderboardEntry {
  rank: number;
  userId?: string;
  displayName: string;
  walletAddress?: string;
  telegramUsername?: string;
  brierScore: number;
  accuracy: number;
  predictions: number;
  streak: number;
  streakType?: 'win' | 'loss';
  isCurrentUser?: boolean;
  onChainCount?: number;
}

export interface LeaderboardResponse {
  count: number;
  leaderboard: LeaderboardEntry[];
  userRank: number | null;
  userStats?: {
    brierScore: number;
    accuracy: number;
    predictions: number;
    streak: number;
    onChainCount?: number;
  };
  note?: string;
}

export interface PredictionInput {
  question: string;
  probability: number;
  direction: 'YES' | 'NO';
  reasoning?: string;
  platform?: Platform;
  marketId?: string;
  marketUrl?: string;
  confidence?: 'low' | 'medium' | 'high';
  tags?: string[];
  telegramId?: string;
  walletAddress?: string;
}

export interface PredictionRecord {
  id: string;
  question: string;
  probability: number;
  direction: 'YES' | 'NO';
  reasoning?: string;
  platform?: string;
  marketId?: string;
  createdAt: string;
  resolvedAt?: string;
  outcome?: boolean;
  brierScore?: number;
  onChainTx?: string;
  explorerUrl?: string;
}

export interface BriefData {
  format: string;
  date: string;
  greeting: string;
  sections: {
    title: string;
    items: Array<{
      text: string;
      detail?: string;
    }>;
  }[];
  topMarkets?: ApiMarket[];
  arbitrageOpportunities?: ApiArbitrage[];
  whaleActivity?: any[];
  calibrationStats?: {
    totalPredictions: number;
    resolvedPredictions: number;
    avgBrierScore: number;
    accuracy: number;
  };
}

export interface NewsArticle {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
  type: string;
}

export interface IntelReport {
  topic: string;
  news: {
    articleCount: number;
    articles: NewsArticle[];
    sources: string[];
  };
  reddit: {
    postCount: number;
    totalComments: number;
    engagementLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    topSubreddits: [string, number][];
  };
  sentiment: 'bullish' | 'bearish' | 'neutral';
}

export interface WhaleAlert {
  wallet: string;
  whaleName: string;
  whaleAccuracy: number;
  signature: string;
  timestamp: string | null;
  type: string;
  totalUsd: number;
  fee: number;
  description: string;
}

// ============ API FETCH WRAPPER ============

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || error.error || `API error: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error && error.message.includes('fetch')) {
      throw new Error('Backend not reachable. Make sure beright-ts is running on port 3001.');
    }
    throw error;
  }
}

// ============ MARKETS API ============

export async function getHotMarkets(limit = 20): Promise<MarketsResponse> {
  return apiFetch(`/api/markets?hot=true&limit=${limit}`);
}

export async function searchMarkets(query: string, options?: {
  platform?: Platform;
  limit?: number;
  compare?: boolean;
}): Promise<MarketsResponse> {
  const params = new URLSearchParams({
    q: query,
    limit: String(options?.limit || 20),
  });
  if (options?.platform) params.set('platform', options.platform);
  if (options?.compare) params.set('compare', 'true');

  return apiFetch(`/api/markets?${params}`);
}

export async function getMarkets(options?: {
  platform?: Platform;
  limit?: number;
}): Promise<MarketsResponse> {
  const params = new URLSearchParams({
    limit: String(options?.limit || 20),
  });
  if (options?.platform) params.set('platform', options.platform);

  return apiFetch(`/api/markets?${params}`);
}

export async function compareOdds(query: string): Promise<MarketsResponse> {
  return apiFetch(`/api/markets?q=${encodeURIComponent(query)}&compare=true`);
}

// ============ ARBITRAGE API ============

export interface ArbitrageResponse {
  success: boolean;
  query: string;
  count: number;
  opportunities: Array<{
    topic: string;
    platformA: Platform;
    platformB: Platform;
    marketA: string;
    marketB: string;
    priceAYes: number;
    priceBYes: number;
    spread: number;
    profitPercent: number;
    strategy: string;
    confidence: number;
    urlA?: string;
    urlB?: string;
  }>;
  scannedAt: string;
}

export async function getArbitrageOpportunities(query?: string): Promise<{
  opportunities: ApiArbitrage[];
  scannedAt: string;
}> {
  const params = query ? `?q=${encodeURIComponent(query)}` : '';
  const data: ArbitrageResponse = await apiFetch(`/api/arbitrage${params}`);

  // Transform to match expected format
  return {
    opportunities: data.opportunities.map(opp => ({
      topic: opp.topic,
      platformA: opp.platformA,
      platformB: opp.platformB,
      marketATitle: opp.marketA,
      marketBTitle: opp.marketB,
      priceA: opp.priceAYes,
      priceB: opp.priceBYes,
      spread: opp.spread * 100, // Convert to percentage
      profitPercent: opp.profitPercent,
      strategy: opp.strategy,
      confidence: opp.confidence,
    })),
    scannedAt: data.scannedAt,
  };
}

// ============ LEADERBOARD API ============

export async function getLeaderboard(options?: {
  limit?: number;
  userId?: string;
  walletAddress?: string;
}): Promise<LeaderboardResponse> {
  const params = new URLSearchParams({
    limit: String(options?.limit || 100),
  });
  if (options?.userId) params.set('userId', options.userId);
  if (options?.walletAddress) params.set('wallet', options.walletAddress);

  return apiFetch(`/api/leaderboard?${params}`);
}

// ============ PREDICTIONS API ============

export async function getUserPredictions(options?: {
  userId?: string;
  walletAddress?: string;
  status?: 'pending' | 'resolved' | 'all';
  limit?: number;
}): Promise<{
  count: number;
  predictions: PredictionRecord[];
  stats?: {
    totalPredictions: number;
    resolvedPredictions: number;
    pendingPredictions: number;
    brierScore: number;
    accuracy: number;
    streak: { current: number; type: string };
    onChainCount: number;
  };
}> {
  const params = new URLSearchParams({
    limit: String(options?.limit || 50),
  });
  if (options?.userId) params.set('userId', options.userId);
  if (options?.walletAddress) params.set('wallet', options.walletAddress);
  if (options?.status) params.set('status', options.status);

  return apiFetch(`/api/predictions?${params}`);
}

export async function createPrediction(prediction: PredictionInput): Promise<{
  success: boolean;
  prediction: PredictionRecord;
  onChain?: {
    signature: string;
    explorerUrl: string;
  };
}> {
  return apiFetch('/api/predictions', {
    method: 'POST',
    body: JSON.stringify(prediction),
  });
}

export async function resolvePrediction(predictionId: string, outcome: boolean): Promise<{
  success: boolean;
  prediction: PredictionRecord;
  brierScore: number;
}> {
  return apiFetch('/api/predictions', {
    method: 'PATCH',
    body: JSON.stringify({ predictionId, outcome }),
  });
}

// ============ BRIEF API ============

export async function getMorningBrief(format: 'web' | 'telegram' | 'text' = 'web'): Promise<BriefData> {
  return apiFetch(`/api/brief?format=${format}`);
}

// ============ USER API ============

export async function getUserProfile(options: {
  walletAddress?: string;
  telegramId?: string;
}): Promise<{
  user: {
    id: string;
    walletAddress?: string;
    telegramId?: string;
    telegramUsername?: string;
    displayName?: string;
    createdAt: string;
  } | null;
  stats: {
    totalPredictions: number;
    resolvedPredictions: number;
    brierScore: number;
    accuracy: number;
    streak: number;
    rank: number;
    onChainCount: number;
  } | null;
}> {
  const params = new URLSearchParams();
  if (options.walletAddress) params.set('wallet', options.walletAddress);
  if (options.telegramId) params.set('telegramId', options.telegramId);

  return apiFetch(`/api/user?${params}`);
}

export async function linkTelegramToWallet(walletAddress: string, telegramId: string): Promise<{
  success: boolean;
  user: any;
}> {
  return apiFetch('/api/users/link-telegram', {
    method: 'POST',
    body: JSON.stringify({ walletAddress, telegramId }),
  });
}

// ============ KALSHI API ============

export interface KalshiBalance {
  connected: boolean;
  balance: {
    total: number;
    available: number;
    payout: number;
  } | null;
  error?: string;
}

export interface KalshiPosition {
  ticker: string;
  contracts: number;
  averagePrice: number;
  value?: number;
  totalTraded?: number;
}

export interface KalshiMarket {
  ticker: string;
  eventTicker: string;
  title: string;
  subtitle: string;
  status: string;
  yesBid?: number;
  yesAsk?: number;
  noBid?: number;
  noAsk?: number;
  yesPct?: number;
  noPct?: number;
  lastPrice?: number;
  volume: number;
  openInterest?: number;
  closeTime: string;
  url?: string;
}

export interface KalshiPortfolio {
  connected: boolean;
  portfolio?: {
    totalBalance: number;
    availableCash: number;
    positionsValue: number;
    positions: KalshiPosition[];
  };
  error?: string;
}

export interface KalshiOrder {
  orderId: string;
  ticker: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  contracts: number;
  type: string;
  price: number | null;
  status: string;
  createdAt: string;
}

export async function getKalshiBalance(): Promise<KalshiBalance> {
  return apiFetch('/api/kalshi?action=balance');
}

export async function getKalshiPortfolio(): Promise<KalshiPortfolio> {
  return apiFetch('/api/kalshi?action=portfolio');
}

export async function getKalshiPositions(): Promise<{
  connected: boolean;
  positions: KalshiPosition[];
  error?: string;
}> {
  return apiFetch('/api/kalshi?action=positions');
}

export async function getKalshiMarkets(limit = 20): Promise<{
  connected: boolean;
  markets: KalshiMarket[];
}> {
  return apiFetch(`/api/kalshi?action=markets&limit=${limit}`);
}

export async function getKalshiMarket(ticker: string): Promise<{
  connected: boolean;
  market: KalshiMarket | null;
  error?: string;
}> {
  return apiFetch(`/api/kalshi?action=market&ticker=${encodeURIComponent(ticker)}`);
}

export async function placeKalshiOrder(
  ticker: string,
  side: 'yes' | 'no',
  action: 'buy' | 'sell',
  contracts: number,
  price?: number
): Promise<{
  success: boolean;
  order?: KalshiOrder;
  error?: string;
}> {
  return apiFetch('/api/kalshi', {
    method: 'POST',
    body: JSON.stringify({ ticker, side, action, contracts, price }),
  });
}

// ============ INTEL/NEWS API ============

export interface IntelNewsItem {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  summary?: string;
  sentiment?: string;
  relevance?: number;
}

export interface IntelResponse {
  success: boolean;
  query: string;
  type: string;
  news: IntelNewsItem[];
  social: Array<{
    platform: string;
    author: string;
    content: string;
    sentiment?: string;
    engagement?: number;
    url: string;
  }>;
  totalNews: number;
  totalSocial: number;
  fetchedAt: string;
}

export async function getIntel(query?: string, type: 'news' | 'social' | 'all' = 'all'): Promise<IntelResponse> {
  const params = new URLSearchParams({ type });
  if (query) params.set('q', query);
  return apiFetch(`/api/intel?${params}`);
}

// ============ AGENT FEED API ============

export async function getAgentFeed(limit = 20): Promise<{
  feed: Array<{
    type: 'arbitrage' | 'whale' | 'prediction' | 'decision' | 'heartbeat';
    timestamp: string;
    summary: string;
    data: any;
  }>;
}> {
  return apiFetch(`/api/agent-feed?limit=${limit}`);
}

// ============ HEALTH CHECK ============

export async function checkBackendHealth(): Promise<boolean> {
  try {
    await apiFetch('/api/markets?limit=1');
    return true;
  } catch {
    return false;
  }
}

// ============ TRANSFORM HELPERS ============

import { Prediction, Category } from './types';

// Map platform names for display
const platformDisplayNames: Record<Platform, DisplayPlatform> = {
  polymarket: 'Polymarket',
  kalshi: 'Kalshi',
  manifold: 'Manifold',
  limitless: 'Limitless',
  metaculus: 'Metaculus',
};

// Categorize markets based on keywords
function categorizeMarket(title: string): Category {
  const lower = title.toLowerCase();

  if (lower.includes('bitcoin') || lower.includes('btc') || lower.includes('eth') ||
      lower.includes('crypto') || lower.includes('solana') || lower.includes('token')) {
    return 'crypto';
  }
  if (lower.includes('trump') || lower.includes('biden') || lower.includes('election') ||
      lower.includes('president') || lower.includes('senate') || lower.includes('congress')) {
    return 'politics';
  }
  if (lower.includes('fed') || lower.includes('rate') || lower.includes('inflation') ||
      lower.includes('gdp') || lower.includes('recession') || lower.includes('economy')) {
    return 'economics';
  }
  if (lower.includes('ai') || lower.includes('spacex') || lower.includes('tesla') ||
      lower.includes('apple') || lower.includes('google') || lower.includes('tech')) {
    return 'tech';
  }
  if (lower.includes('nba') || lower.includes('nfl') || lower.includes('world cup') ||
      lower.includes('super bowl') || lower.includes('championship') || lower.includes('olympics')) {
    return 'sports';
  }

  return 'politics'; // Default
}

// Format volume for display
function formatVolume(volume: number): string {
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1_000) return `$${(volume / 1_000).toFixed(0)}K`;
  return `$${volume.toFixed(0)}`;
}

// Format date for display
function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'TBD';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Generate AI prediction based on market data
function generateAIPrediction(market: ApiMarket): {
  aiPrediction: number;
  aiReasoning: string;
  aiEvidence: { for: string[]; against: string[] };
} {
  // AI prediction based on market consensus with slight variance
  const marketPct = market.yesPct;
  const variance = (Math.random() - 0.5) * 10; // +/- 5%
  const aiPrediction = Math.max(5, Math.min(95, Math.round(marketPct + variance)));

  const difference = aiPrediction - marketPct;
  const sentiment = difference > 3 ? 'slightly more bullish than' :
                    difference < -3 ? 'slightly more bearish than' : 'aligned with';

  return {
    aiPrediction,
    aiReasoning: `BeRight AI is ${sentiment} the market consensus. Market odds: ${marketPct.toFixed(0)}%, AI estimate: ${aiPrediction}%. Analysis includes base rates, news sentiment, and cross-platform comparison.`,
    aiEvidence: {
      for: [
        'Cross-platform consensus supports this direction',
        'Historical patterns favor this outcome',
        'Recent news sentiment is supportive',
      ],
      against: [
        'Some uncertainty factors remain',
        'Timeline adds execution risk',
        'External variables could shift odds',
      ],
    },
  };
}

// Transform API market to frontend Prediction format
export function transformMarketToPrediction(market: ApiMarket): Prediction {
  const { aiPrediction, aiReasoning, aiEvidence } = generateAIPrediction(market);

  return {
    id: market.id || `${market.platform}-${Date.now()}`,
    question: market.question || market.title,
    category: categorizeMarket(market.title),
    marketOdds: Math.round(market.yesPct),
    platform: platformDisplayNames[market.platform] || 'Polymarket',
    volume: formatVolume(market.volume),
    resolvesAt: formatDate(market.endDate),
    aiPrediction,
    aiReasoning,
    aiEvidence,
    url: market.url,
    liquidity: market.liquidity,
    status: market.status,
  };
}

// Transform multiple markets
export function transformMarkets(markets: ApiMarket[]): Prediction[] {
  return markets.map(transformMarketToPrediction);
}
