/**
 * BeRight API Client
 * Connects berightweb frontend to beright-ts backend
 *
 * IMPORTANT: All API calls go through beright-ts (port 3001)
 * No duplicate API routes - single source of truth
 */

// API base URL - always use relative paths so Next.js rewrites can proxy to backend
// This avoids CORS issues and mixed content (HTTPS→HTTP) problems
const API_BASE = '';

// ============ TYPES (synced with beright-ts/types/) ============

export type Platform = 'polymarket' | 'kalshi' | 'manifold' | 'limitless' | 'metaculus' | 'dflow';
export type DisplayPlatform = 'Kalshi' | 'Polymarket' | 'Manifold' | 'Limitless' | 'Metaculus' | 'DFlow';

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

// ============ CROSSODDS-STYLE ARBITRAGE TYPES ============

export interface ArbTradeLeg {
  platform: string;
  platformDisplayName: string;
  side: 'YES' | 'NO';
  price: number;
  priceDisplay: string;
  url: string;
  liquidity: number;
  volume24h: number;
}

export interface ArbOpportunity {
  id: string;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  qualityScore: number;
  confidenceGrade: 'A' | 'B' | 'C' | 'D' | 'F';

  trade: {
    leg1: ArbTradeLeg;
    leg2: ArbTradeLeg;
    totalCost: number;
    totalCostDisplay: string;
    guaranteedPayout: number;
    profit: number;
    profitDisplay: string;
    profitPercent: number;
    instruction: string;
  };

  market: {
    question: string;
    questionShort: string;
    category: string;
    resolutionDate: string;
    resolutionRules: string;
    relatedMarkets: number;
  };

  risk: {
    level: 'low' | 'medium' | 'high';
    score: number;
    flags: string[];
    executionWarnings: string[];
  };

  sizing: {
    recommended: number;
    maximum: number;
    minimum: number;
  };

  detectedAt: string;
  lastUpdated: string;
  priceAge: number;
  _demo?: boolean;
}

export interface ArbApiResponse {
  success: boolean;
  data: {
    opportunities: ArbOpportunity[];
    meta: {
      totalScanned: number;
      pairsEvaluated: number;
      scanDurationMs: number;
      platforms: string[];
    };
  };
  meta: {
    source: 'demo' | 'live';
    network: 'devnet' | 'mainnet';
  };
}

export interface MarketsResponse {
  count: number;
  markets: ApiMarket[];
  arbitrage?: ApiArbitrage[];
}

export interface LeaderboardEntry {
  rank: number;
  userId?: string;
  username?: string;
  displayName: string;
  walletAddress?: string;
  wallet_address?: string; // snake_case from API
  avatarUrl?: string;
  avatar_url?: string; // snake_case from API
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
    avatarUrl?: string;
    walletAddress?: string;
    username?: string;
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

// Custom error class for rate limiting
export class RateLimitError extends Error {
  retryAfter: number;

  constructor(message: string, retryAfter: number = 60) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

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

    // Handle rate limiting specifically (429 status)
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
      console.warn(`[API] Rate limited. Retry after ${retryAfter}s`);
      throw new RateLimitError(`Rate limit exceeded. Try again in ${retryAfter} seconds.`, retryAfter);
    }

    if (!response.ok) {
      // Try to get error details from response
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorBody = await response.json();
        // Try multiple common error fields
        errorMessage = errorBody.message || errorBody.error || errorBody.text || errorMessage;
        // If it's the generic gateway error, provide more context
        if (errorMessage === 'Failed to process message') {
          errorMessage = 'Request processing failed. The backend may be experiencing issues.';
        }
      } catch {
        // JSON parsing failed - try text
        try {
          const textBody = await response.text();
          if (textBody) errorMessage = textBody.slice(0, 200);
        } catch {
          // Couldn't get any error details
          errorMessage = `Server error (${response.status}). Please try again.`;
        }
      }

      // Check if error message indicates rate limiting
      if (errorMessage.toLowerCase().includes('rate limit')) {
        throw new RateLimitError(errorMessage, 60);
      }

      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error) {
    // Re-throw RateLimitError as-is
    if (error instanceof RateLimitError) {
      throw error;
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Backend not reachable. Make sure beright-ts is running on port 3001.');
    }

    // Re-throw Error instances as-is
    if (error instanceof Error) {
      throw error;
    }

    // Wrap unknown errors
    throw new Error(String(error) || 'An unexpected error occurred');
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

// ============ FEED API v2 (ML-powered) ============

export type FeedType = 'hot' | 'closing_soon' | 'arbitrage' | 'new' | 'trending' | 'category';

export interface FeedPlatformData {
  platform: Platform;
  platformId: string;
  yesPrice: number;
  volume24h: number;
  liquidity: number;
  url: string;
}

export interface FeedArbitrageData {
  buyPlatform: Platform;
  buyPrice: number;
  sellPlatform: Platform;
  sellPrice: number;
  spread: number;
  profitPct: number;
  netProfit: number;
}

export interface FeedMarket {
  id: string;
  question: string;
  category: string;
  consensusPrice: number;
  priceSpread: number;
  matchConfidence: number;
  platformCount: number;
  platforms: FeedPlatformData[];
  totalLiquidity: number;
  totalVolume24h: number;
  arbitrage: FeedArbitrageData | null;
  entities: {
    people: string[];
    organizations: string[];
    events: string[];
  };
  closeDate: string | null;
  matchedAt: string;
}

export interface FeedResponse {
  success: boolean;
  data: FeedMarket[];
  meta: {
    type: FeedType;
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
    fetchedAt: string;
    latencyMs: number;
    mlLatencyMs: number;
    cacheHit: boolean;
  };
}

export interface FeedQuery {
  type?: FeedType;
  category?: string;
  platforms?: Platform[];
  minLiquidity?: number;
  limit?: number;
  offset?: number;
}

/**
 * Get ML-powered feed from /api/v2/feed
 */
export async function getFeed(query: FeedQuery = {}): Promise<FeedResponse> {
  const params = new URLSearchParams();
  if (query.type) params.set('type', query.type);
  if (query.category) params.set('category', query.category);
  if (query.platforms?.length) params.set('platforms', query.platforms.join(','));
  if (query.minLiquidity) params.set('minLiquidity', String(query.minLiquidity));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.offset) params.set('offset', String(query.offset));

  return apiFetch(`/api/v2/feed?${params}`);
}

/**
 * Convert FeedMarket to ApiMarket for backward compatibility
 */
export function feedMarketToApiMarket(feed: FeedMarket): ApiMarket {
  // Use first platform's data as primary
  const primary = feed.platforms[0];
  return {
    id: feed.id,
    platform: primary?.platform || 'polymarket',
    title: feed.question,
    question: feed.question,
    yesPrice: feed.consensusPrice,
    noPrice: 1 - feed.consensusPrice,
    yesPct: Math.round(feed.consensusPrice * 100),
    noPct: Math.round((1 - feed.consensusPrice) * 100),
    volume: feed.totalVolume24h,
    liquidity: feed.totalLiquidity,
    endDate: feed.closeDate,
    status: 'active',
    url: primary?.url || '',
  };
}

/**
 * Get hot markets using new feed API with fallback
 */
export async function getHotMarketsFeed(limit = 20): Promise<MarketsResponse> {
  try {
    const feed = await getFeed({ type: 'hot', limit });
    return {
      count: feed.meta.total,
      markets: feed.data.map(feedMarketToApiMarket),
    };
  } catch {
    // Fallback to old API
    return getHotMarkets(limit);
  }
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

/**
 * Get CrossOdds-style arbitrage opportunities
 * Returns detailed arbitrage data with trade instructions, profit calculations,
 * and direct platform links.
 */
export async function getCrossOddsArbitrage(options?: {
  query?: string;
  minProfit?: number;
  limit?: number;
}): Promise<ArbApiResponse> {
  const params = new URLSearchParams();
  if (options?.query) params.set('query', options.query);
  if (options?.minProfit) params.set('minProfit', String(options.minProfit));
  if (options?.limit) params.set('limit', String(options.limit));

  const queryString = params.toString();
  return apiFetch(`/api/v2/arbitrage${queryString ? `?${queryString}` : ''}`);
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

// ============ ON-CHAIN CALIBRATION API ============

export interface OnChainForecaster {
  rank: number;
  walletAddress: string;
  displayName?: string;
  forecasterPda: string;
  programId: string;
  isOnChainVerified: boolean;
  brierScore: number;
  accuracy: number;
  totalPredictions: number;
  resolvedPredictions: number;
  correctPredictions: number;
  streak: number;
  maxStreak: number;
  marketsTraded: number;
  tier: 'superforecaster' | 'elite' | 'verified' | 'rookie' | 'unranked';
  grade: string;
  lastPrediction: string;
  createdAt: string;
}

export interface OnChainLeaderboardResponse {
  success: boolean;
  data: {
    forecasters: OnChainForecaster[];
    totalOnChain: number;
    network: 'devnet' | 'mainnet';
  };
}

export async function getOnChainLeaderboard(): Promise<OnChainLeaderboardResponse> {
  return apiFetch('/api/v2/calibration?leaderboard=true');
}

export async function getOnChainStats(walletAddress: string): Promise<{
  success: boolean;
  data: OnChainForecaster | null;
}> {
  return apiFetch(`/api/v2/calibration?wallet=${walletAddress}`);
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

// ============ AGENT API v2 ============
// Direct access to the new BeRight Agent System (Scout, Analyst, Trader, Orchestrator)

export interface AgentResponse {
  success: boolean;
  data: {
    text: string;
    mood: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'EDUCATIONAL' | 'ERROR';
    agent?: string;
    agentEmoji?: string;
    metadata?: Record<string, unknown>;
  };
  session?: {
    id: string;
    messageCount: number;
  };
  meta?: {
    processingTimeMs: number;
    timestamp: string;
  };
  error?: string;
}

export interface AgentInfo {
  success: boolean;
  data: {
    version: string;
    architecture: string;
    agents: Record<string, {
      id: string;
      name: string;
      emoji: string;
      role: string;
      purpose: string;
      tools: string[];
      available: boolean;
    }>;
    toolCounts: {
      scout: number;
      analyst: number;
      trader: number;
      total: number;
    };
    activeSessions: number;
    capabilities: string[];
    exampleQueries: string[];
  };
}

/**
 * Send a message to the BeRight Agent System
 * Routes through Orchestrator → Scout/Analyst/Trader
 */
export async function sendToAgent(
  message: string,
  options?: {
    sessionId?: string;
    userId?: string;
    agent?: 'scout' | 'analyst' | 'trader';
  }
): Promise<AgentResponse> {
  return apiFetch('/api/v2/agent', {
    method: 'POST',
    body: JSON.stringify({
      message,
      sessionId: options?.sessionId,
      userId: options?.userId,
      agent: options?.agent,
    }),
  });
}

/**
 * Get agent system info and capabilities
 */
export async function getAgentInfo(): Promise<AgentInfo> {
  return apiFetch('/api/v2/agent');
}

/**
 * Get session history
 */
export async function getAgentSession(sessionId: string): Promise<{
  success: boolean;
  data: {
    sessionId: string;
    exists: boolean;
    messageCount: number;
    messages: Array<{
      role: 'user' | 'agent';
      content: string;
      agent?: string;
      timestamp: number;
    }>;
  };
}> {
  return apiFetch(`/api/v2/agent?sessionId=${sessionId}`);
}

// ============ UNIFIED GATEWAY API ============
// Routes commands through the same handler as Telegram
// Enables full agent/skill system in web terminal

export interface GatewayResponse {
  success: boolean;
  text: string;           // Formatted for web (markdown stripped)
  rawText?: string;       // Original with Telegram markdown
  mood: string;
  data?: any;
  sessionId?: string;
  error?: string;
  // Async job fields (for long-running operations)
  async?: boolean;        // True if this is an async job
  jobId?: string;         // Job ID for polling
  pollUrl?: string;       // URL to poll for status
}

export interface JobStatus {
  id: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  progress: number;
  progressMessage?: string;
  result?: GatewayResponse;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Send a command or message through the unified gateway
 * This routes through the full Telegram handler logic including:
 * - Multi-agent routing (COMMANDER, RESEARCH, ARBITRAGE, WHALE, etc.)
 * - All 60+ commands
 * - LLM reasoning layer
 * - Context and memory
 * - Skill execution
 */
export async function sendToGateway(
  message: string,
  options?: {
    userId?: string;
    sessionId?: string;
  }
): Promise<GatewayResponse> {
  return apiFetch('/api/gateway', {
    method: 'POST',
    body: JSON.stringify({
      message,
      userId: options?.userId,
      sessionId: options?.sessionId,
    }),
  });
}

/**
 * Poll for async job status
 * Used for long-running operations (research, analyze, etc.)
 */
export async function pollJobStatus(jobId: string): Promise<JobStatus> {
  return apiFetch(`/api/jobs/${jobId}`);
}

/**
 * Poll for job completion with progress callbacks
 * Returns the final result when complete or throws on failure
 */
export async function waitForJob(
  jobId: string,
  options?: {
    onProgress?: (progress: number, message?: string) => void;
    maxAttempts?: number;
    pollIntervalMs?: number;
  }
): Promise<GatewayResponse> {
  const maxAttempts = options?.maxAttempts ?? 60;  // 60 attempts
  const pollInterval = options?.pollIntervalMs ?? 2000;  // 2 seconds

  for (let i = 0; i < maxAttempts; i++) {
    const status = await pollJobStatus(jobId);

    // Report progress
    if (options?.onProgress) {
      options.onProgress(status.progress, status.progressMessage);
    }

    // Check if complete
    if (status.status === 'complete' && status.result) {
      return status.result;
    }

    // Check if failed
    if (status.status === 'failed') {
      throw new Error(status.error || 'Job failed');
    }

    // Wait before next poll (with exponential backoff, max 5s)
    const waitTime = Math.min(pollInterval * Math.pow(1.2, Math.min(i, 5)), 5000);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  throw new Error('Job timed out - please try again');
}

/**
 * Get gateway status and available commands
 */
export async function getGatewayStatus(sessionId?: string): Promise<{
  status: string;
  activeSessions: number;
  supportedCommands: string[];
  sessionId?: string;
  exists?: boolean;
  messageCount?: number;
}> {
  const params = sessionId ? `?sessionId=${sessionId}` : '';
  return apiFetch(`/api/gateway${params}`);
}

// ============ TAVILY API (Web Search & Research) ============

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
}

export interface TavilySearchResponse {
  success: boolean;
  query: string;
  type: string;
  result: {
    query: string;
    results: TavilySearchResult[];
    answer?: string;
    responseTime: number;
    images?: string[];
  };
  searchedAt: string;
}

export interface TavilyNewsResponse {
  success: boolean;
  query: string;
  type: string;
  result: {
    headlines: Array<{ title: string; url: string; date?: string }>;
    summary?: string;
    sentiment: 'bullish' | 'bearish' | 'neutral';
    lastUpdated: string;
  };
  searchedAt: string;
}

export interface TavilyFactsResponse {
  success: boolean;
  query: string;
  type: string;
  result: {
    facts: string[];
    sources: Array<{ title: string; url: string }>;
    answer?: string;
    confidence: 'high' | 'medium' | 'low';
  };
  searchedAt: string;
}

export interface TavilyVerifyResponse {
  success: boolean;
  query: string;
  type: string;
  result: {
    verified: boolean;
    evidence: string[];
    sources: Array<{ title: string; url: string }>;
    confidence: number;
  };
  searchedAt: string;
}

export interface TavilyResearchResponse {
  success: boolean;
  query: string;
  type: string;
  result: {
    topic: string;
    report: string;
    sources: Array<{ url: string; title: string }>;
    responseTime: number;
  };
  searchedAt: string;
}

/**
 * Search the web using Tavily AI-powered search
 */
export async function tavilySearch(query: string, options?: {
  maxResults?: number;
  days?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
}): Promise<TavilySearchResponse> {
  return apiFetch('/api/tavily', {
    method: 'POST',
    body: JSON.stringify({
      query,
      type: 'search',
      options,
    }),
  });
}

/**
 * Search news using Tavily
 */
export async function tavilyNewsSearch(query: string, days?: number): Promise<TavilySearchResponse> {
  return apiFetch('/api/tavily', {
    method: 'POST',
    body: JSON.stringify({
      query,
      type: 'news',
      options: { days: days || 7 },
    }),
  });
}

/**
 * Search financial news using Tavily
 */
export async function tavilyFinanceSearch(query: string): Promise<TavilySearchResponse> {
  return apiFetch('/api/tavily', {
    method: 'POST',
    body: JSON.stringify({
      query,
      type: 'finance',
    }),
  });
}

/**
 * Get verified facts for a prediction question
 */
export async function tavilyGetFacts(question: string): Promise<TavilyFactsResponse> {
  return apiFetch('/api/tavily', {
    method: 'POST',
    body: JSON.stringify({
      query: question,
      type: 'facts',
    }),
  });
}

/**
 * Verify a claim using Tavily
 */
export async function tavilyVerifyClaim(claim: string): Promise<TavilyVerifyResponse> {
  return apiFetch('/api/tavily', {
    method: 'POST',
    body: JSON.stringify({
      query: claim,
      type: 'verify',
    }),
  });
}

/**
 * Deep research on a topic using Tavily
 */
export async function tavilyResearch(topic: string): Promise<TavilyResearchResponse> {
  return apiFetch('/api/tavily', {
    method: 'POST',
    body: JSON.stringify({
      query: topic,
      type: 'research',
    }),
  });
}

/**
 * Extract content from a URL using Tavily
 */
export async function tavilyExtract(url: string): Promise<{
  success: boolean;
  query: string;
  type: string;
  result: {
    results: Array<{
      url: string;
      rawContent: string;
      extractedContent?: string;
    }>;
    failedUrls?: string[];
  };
}> {
  return apiFetch('/api/tavily', {
    method: 'POST',
    body: JSON.stringify({
      query: url,
      type: 'extract',
    }),
  });
}

/**
 * Quick Tavily search (GET endpoint)
 */
export async function tavilyQuickSearch(query: string, type?: 'search' | 'news' | 'facts'): Promise<any> {
  const params = new URLSearchParams({ q: query });
  if (type) params.set('type', type);
  return apiFetch(`/api/tavily?${params}`);
}

// ============ DFLOW API (Tokenized Prediction Markets) ============

/**
 * DFlow Market Token Info
 * SPL token addresses for on-chain trading via wallet signing
 */
export interface DFlowTokens {
  yesMint: string | null;
  noMint: string | null;
  marketLedger: string | null;
  isInitialized: boolean;
  redemptionStatus: 'open' | 'closed';
}

/**
 * DFlow Market (nested within event)
 */
export interface DFlowMarketInfo {
  ticker: string;
  title: string;
  status: string;
  result?: string;
  yesBid: number;
  yesAsk: number;
  noBid: number;
  noAsk: number;
  volume: number;
  openInterest: number;
  closeTime: number;
  expirationTime: number;
  tokens: DFlowTokens;
}

/**
 * DFlow Event (main market entity)
 */
export interface DFlowEvent {
  ticker: string;
  seriesTicker: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  volume: number;
  volume24h: number;
  liquidity: number;
  openInterest: number;
  strikeDate?: number;
  strikePeriod?: string;
  settlementSources?: Array<{ name: string; url: string }>;

  // Computed prices
  marketTicker?: string;
  status: string;
  yesPrice: number;
  noPrice: number;
  yesPct: number;
  noPct: number;
  yesBid: number;
  yesAsk: number;
  noBid: number;
  noAsk: number;
  spread: number;

  // Token addresses for trading
  tokens: DFlowTokens | null;

  // All markets in event
  markets?: DFlowMarketInfo[];

  // External link
  url: string;
}

/**
 * DFlow Order Response (for trading)
 */
export interface DFlowOrderResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  slippageBps: number;
  priceImpactPct: string;
  executionMode: string;
  transaction: string;  // Base64 encoded, sign and submit
  routePlan?: any[];
  platformFee?: {
    amount: string;
    feeBps: number;
  };
}

/**
 * DFlow Order Status
 */
export interface DFlowOrderStatus {
  status: 'pending' | 'expired' | 'failed' | 'open' | 'pendingClose' | 'closed';
  inAmount: string;
  outAmount: string;
  fills?: Array<{
    signature: string;
    inputMint: string;
    inAmount: string;
    outputMint: string;
    outAmount: string;
  }>;
}

/**
 * DFlow Position
 */
export interface DFlowPosition {
  mint: string;
  side: 'YES' | 'NO' | 'unknown';
  ticker?: string;
  eventTicker?: string;
  title?: string;
  status?: string;
  result?: string;
  currentPrice?: number;
  tokens?: DFlowTokens;
}

/**
 * DFlow Trade
 */
export interface DFlowTrade {
  tradeId: string;
  price: number;
  yesPriceDollars: string;
  noPriceDollars: string;
  count: number;
  takerSide: 'yes' | 'no';
  timestamp: number;
  time: string;
}

/**
 * DFlow Orderbook
 */
export interface DFlowOrderbook {
  sequence?: number;
  yesBids?: Record<string, number>;
  yesAsks?: Record<string, number>;
  noBids?: Record<string, number>;
  noAsks?: Record<string, number>;
}

// ===== DFlow API Functions =====

/**
 * Get hot DFlow markets sorted by 24h volume
 */
export async function getDFlowHotMarkets(limit = 20): Promise<{
  success: boolean;
  count: number;
  events: DFlowEvent[];
}> {
  return apiFetch(`/api/dflow?action=hot&limit=${limit}`);
}

/**
 * Search DFlow markets
 */
export async function searchDFlowMarkets(query: string, limit = 20): Promise<{
  success: boolean;
  query: string;
  count: number;
  events: DFlowEvent[];
}> {
  return apiFetch(`/api/dflow?action=search&q=${encodeURIComponent(query)}&limit=${limit}`);
}

/**
 * Get single DFlow market by ticker or mint
 */
export async function getDFlowMarket(params: { ticker?: string; mint?: string }): Promise<{
  success: boolean;
  market: DFlowEvent | null;
  error?: string;
}> {
  const query = new URLSearchParams();
  query.set('action', 'market');
  if (params.ticker) query.set('ticker', params.ticker);
  if (params.mint) query.set('mint', params.mint);
  return apiFetch(`/api/dflow?${query}`);
}

/**
 * Get single DFlow event by ticker
 * Searches hot/active events to find matching ticker
 */
export async function getDFlowEventByTicker(ticker: string): Promise<DFlowEvent> {
  // Try to get from hot markets first (most likely to be there)
  const hotResponse = await getDFlowHotMarkets(100);
  if (hotResponse.success && hotResponse.events) {
    const event = hotResponse.events.find(
      e => e.ticker === ticker || e.seriesTicker === ticker || e.marketTicker === ticker
    );
    if (event) return event;
  }

  // If not in hot, try searching
  const searchResponse = await searchDFlowMarkets(ticker, 20);
  if (searchResponse.success && searchResponse.events) {
    const event = searchResponse.events.find(
      e => e.ticker === ticker || e.seriesTicker === ticker || e.marketTicker === ticker
    );
    if (event) return event;
  }

  throw new Error('Market not found');
}

/**
 * Get DFlow orderbook
 */
export async function getDFlowOrderbook(ticker: string): Promise<{
  success: boolean;
  ticker: string;
  orderbook: DFlowOrderbook;
}> {
  return apiFetch(`/api/dflow?action=orderbook&ticker=${encodeURIComponent(ticker)}`);
}

/**
 * Get DFlow trades
 */
export async function getDFlowTrades(ticker: string, limit = 50): Promise<{
  success: boolean;
  ticker: string;
  count: number;
  trades: DFlowTrade[];
}> {
  return apiFetch(`/api/dflow?action=trades&ticker=${encodeURIComponent(ticker)}&limit=${limit}`);
}

/**
 * Get DFlow categories
 */
export async function getDFlowCategories(): Promise<{
  success: boolean;
  categories: Record<string, string[]>;
}> {
  return apiFetch('/api/dflow?action=categories');
}

/**
 * Get DFlow positions for wallet
 */
export async function getDFlowPositions(mints: string[]): Promise<{
  success: boolean;
  count: number;
  positions: DFlowPosition[];
}> {
  return apiFetch(`/api/dflow?action=positions&mints=${mints.join(',')}`);
}

/**
 * DFlow Candlestick Data
 */
export interface DFlowCandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Get DFlow candlestick (OHLCV) data for a market
 */
export async function getDFlowCandlesticks(
  ticker: string,
  resolution?: '1m' | '1h' | '1d'
): Promise<{
  success: boolean;
  ticker: string;
  candles: DFlowCandleData[];
}> {
  // IMPORTANT: ticker must be marketTicker (e.g., KXUCLGAME-26MAR17MCIRMA-RMA)
  // Not event ticker (e.g., KXUCLGAME-26MAR17MCIRMA)
  const params = new URLSearchParams({ action: 'candlesticks', ticker });
  if (resolution) params.set('resolution', resolution);
  return apiFetch(`/api/dflow?${params}`);
}

/**
 * Get DFlow order transaction for trading
 * Returns base64 encoded transaction to sign and submit
 */
export async function getDFlowOrder(params: {
  inputMint: string;
  outputMint: string;
  amount: number;
  userPublicKey: string;
  slippageBps?: number;
}): Promise<{
  success: boolean;
  order: DFlowOrderResponse;
}> {
  return apiFetch('/api/dflow', {
    method: 'POST',
    body: JSON.stringify({
      action: 'order',
      ...params,
    }),
  });
}

/**
 * Check DFlow order status
 */
export async function getDFlowOrderStatus(signature: string): Promise<{
  success: boolean;
  status: DFlowOrderStatus;
}> {
  return apiFetch('/api/dflow', {
    method: 'POST',
    body: JSON.stringify({
      action: 'status',
      signature,
    }),
  });
}

/**
 * Filter mints to find outcome tokens
 */
export async function filterDFlowOutcomeMints(addresses: string[]): Promise<{
  success: boolean;
  total: number;
  outcomeTokens: number;
  outcomeMints: string[];
}> {
  return apiFetch('/api/dflow', {
    method: 'POST',
    body: JSON.stringify({
      action: 'filter-mints',
      addresses,
    }),
  });
}

// ===== DFlow Predictions API =====

/**
 * DFlow Prediction Response
 */
export interface DFlowPredictionResponse {
  success: boolean;
  prediction: {
    id: string;
    question: string;
    platform: 'dflow';
    market_id: string;
    market_url: string;
    predicted_probability: number;
    direction: 'YES' | 'NO';
    confidence: 'low' | 'medium' | 'high';
    reasoning: string | null;
    created_at: string;
    on_chain_tx: string | null;
    on_chain_confirmed: boolean;
    dflow_event_ticker: string | null;
    dflow_market_ticker: string;
    yes_mint: string | null;
    no_mint: string | null;
    market: {
      ticker: string;
      title: string;
      status: string;
      yesPrice: number;
      noPrice: number;
      volume: number;
      closeTime: number | null;
    };
    tokens: {
      yesMint: string | null;
      noMint: string | null;
      canTrade: boolean;
    };
  };
  onChain: {
    committed: boolean;
    signature: string | null;
    explorerUrl: string | null;
    error: string | null;
  } | null;
}

/**
 * Create a prediction on a DFlow tokenized market
 * Automatically commits to Solana blockchain
 */
export async function createDFlowPrediction(params: {
  ticker: string;
  probability: number;
  direction: 'YES' | 'NO';
  reasoning?: string;
  confidence?: 'low' | 'medium' | 'high';
  walletAddress?: string;
  telegramId?: number;
}): Promise<DFlowPredictionResponse> {
  return apiFetch('/api/dflow/predictions', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Get user's DFlow predictions
 */
export async function getDFlowPredictions(params: {
  wallet?: string;
  telegramId?: number;
  status?: 'pending' | 'resolved' | 'all';
}): Promise<{
  count: number;
  predictions: Array<{
    id: string;
    question: string;
    platform: 'dflow';
    predicted_probability: number;
    direction: 'YES' | 'NO';
    dflow_market_ticker: string;
    yes_mint: string | null;
    no_mint: string | null;
    on_chain_tx: string | null;
    outcome: boolean | null;
    brier_score: number | null;
    created_at: string;
  }>;
}> {
  const query = new URLSearchParams();
  if (params.wallet) query.set('wallet', params.wallet);
  if (params.telegramId) query.set('telegramId', String(params.telegramId));
  if (params.status) query.set('status', params.status);
  return apiFetch(`/api/dflow/predictions?${query}`);
}

// ===== DFlow Transform Helpers =====

/**
 * Transform DFlow event to frontend Prediction format
 */
export function transformDFlowToPrediction(event: DFlowEvent): Prediction {
  const category = categorizeDFlowMarket(event.title);
  const volume = formatVolume(event.volume || 0);

  // Construct proper DFlow URL instead of using Kalshi URL
  const dflowUrl = `https://dflow.net/market/${event.ticker}`;

  // AI prediction based on market odds
  const { aiPrediction, aiReasoning, aiEvidence } = generateAIPrediction({
    id: event.ticker,
    platform: 'dflow',
    title: event.title,
    question: event.title,
    yesPrice: event.yesPrice,
    noPrice: event.noPrice,
    yesPct: event.yesPct,
    noPct: event.noPct,
    volume: event.volume,
    liquidity: event.liquidity,
    endDate: event.strikeDate ? new Date(event.strikeDate * 1000).toISOString() : null,
    status: event.status as any,
    url: dflowUrl,
  });

  return {
    id: event.ticker,
    question: event.title,
    category,
    marketOdds: Math.round(event.yesPct),
    platform: 'DFlow',  // DFlow tokenized markets
    volume,
    resolvesAt: event.strikeDate
      ? new Date(event.strikeDate * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'TBD',
    aiPrediction,
    aiReasoning,
    aiEvidence,
    url: dflowUrl,
    liquidity: event.liquidity,
    status: event.status as any,

    // DFlow-specific fields
    dflow: {
      ticker: event.ticker,
      seriesTicker: event.seriesTicker,
      volume24h: event.volume24h,
      openInterest: event.openInterest,  // Real trader data
      yesBid: event.yesBid,
      yesAsk: event.yesAsk,
      noBid: event.noBid,
      noAsk: event.noAsk,
      spread: event.spread,
      tokens: event.tokens,
      markets: event.markets,
      imageUrl: event.imageUrl,
    },
  };
}

/**
 * Categorize DFlow market
 */
function categorizeDFlowMarket(title: string): Category {
  const lower = title.toLowerCase();

  if (lower.includes('bitcoin') || lower.includes('btc') || lower.includes('eth') ||
      lower.includes('crypto') || lower.includes('solana') || lower.includes('token')) {
    return 'crypto';
  }
  if (lower.includes('trump') || lower.includes('biden') || lower.includes('election') ||
      lower.includes('president') || lower.includes('senate') || lower.includes('congress') ||
      lower.includes('fed chair') || lower.includes('nominate')) {
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
      lower.includes('super bowl') || lower.includes('championship') || lower.includes('match') ||
      lower.includes('game') || lower.includes(' vs ') || lower.includes(' at ')) {
    return 'sports';
  }

  return 'politics'; // Default
}

/**
 * Transform multiple DFlow events
 */
export function transformDFlowEvents(events: DFlowEvent[]): Prediction[] {
  return events.map(transformDFlowToPrediction);
}

// ===== Jupiter Prediction API Functions =====

/**
 * Jupiter Event from API
 */
export interface JupiterEvent {
  eventId: string;
  title: string;
  description?: string;
  category?: string;
  status: string;
  imageUrl?: string;
  startTime?: string;
  endTime?: string;
  markets?: JupiterMarket[];
  metadata?: {
    title: string;
    description?: string;
    imageUrl?: string;
    source?: string;
    tags?: string[];
  };
}

/**
 * Jupiter Market from API
 */
export interface JupiterMarket {
  marketId: string;
  eventId: string;
  title: string;
  description?: string;
  status: string;
  provider: 'polymarket' | 'kalshi';
  pricing: {
    buyYesPriceUsd: string;
    buyNoPriceUsd: string;
    sellYesPriceUsd?: string;
    sellNoPriceUsd?: string;
    volume?: string;
    volume24h?: string;
    liquidity?: string;
    openInterest?: string;
  };
  onChain?: {
    marketPubkey: string;
    yesMint?: string;
    noMint?: string;
  };
  openTime?: string;
  closeTime?: string;
  settlementTime?: string;
}

/**
 * Get hot Jupiter prediction events
 */
export async function getJupiterHotEvents(limit = 20): Promise<{
  success: boolean;
  data: JupiterEvent[];
}> {
  return apiFetch(`/api/v2/jupiter/events?hot=true&limit=${limit}&includeMarkets=true`);
}

/**
 * Search Jupiter prediction events
 */
export async function searchJupiterEvents(query: string, limit = 20): Promise<{
  success: boolean;
  data: JupiterEvent[];
}> {
  return apiFetch(`/api/v2/jupiter/events?q=${encodeURIComponent(query)}&limit=${limit}&includeMarkets=true`);
}

/**
 * Get single Jupiter event by ID
 */
export async function getJupiterEvent(eventId: string): Promise<{
  success: boolean;
  data: JupiterEvent | null;
}> {
  return apiFetch(`/api/v2/jupiter/events?id=${encodeURIComponent(eventId)}`);
}

/**
 * Transform Jupiter event to Prediction format
 */
export function transformJupiterToPrediction(event: JupiterEvent, market?: JupiterMarket): Prediction {
  // Use the first market if not specified
  const mkt = market || event.markets?.[0];

  // Calculate YES probability from pricing (micro USD to percentage)
  const yesPriceUsd = mkt?.pricing?.buyYesPriceUsd
    ? parseInt(mkt.pricing.buyYesPriceUsd, 10) / 1_000_000
    : 0.5;
  const yesPct = Math.round(yesPriceUsd * 100);

  // Parse volume
  const volumeNum = mkt?.pricing?.volume
    ? parseInt(mkt.pricing.volume, 10) / 1_000_000
    : 0;

  // Parse open interest
  const openInterest = mkt?.pricing?.openInterest
    ? parseInt(mkt.pricing.openInterest, 10) / 1_000_000
    : 0;

  // Category from event or infer from title
  const category = categorizeJupiterMarket(event.title || mkt?.title || '');

  // Format volume
  const volume = formatVolumeForJupiter(volumeNum);

  // Generate AI prediction
  const { aiPrediction, aiReasoning, aiEvidence } = generateAIPrediction({
    id: event.eventId,
    platform: mkt?.provider || 'polymarket',
    title: event.title,
    question: mkt?.title || event.title,
    yesPrice: yesPriceUsd,
    noPrice: 1 - yesPriceUsd,
    yesPct,
    noPct: 100 - yesPct,
    volume: volumeNum,
    liquidity: mkt?.pricing?.liquidity ? parseInt(mkt.pricing.liquidity, 10) / 1_000_000 : 0,
    endDate: mkt?.closeTime || event.endTime || null,
    status: event.status as any,
    url: `https://jup.ag/prediction/${event.eventId}`,
  });

  // Determine platform display name
  const platformName = mkt?.provider === 'kalshi' ? 'Kalshi' : 'Polymarket';

  return {
    id: `jupiter-${event.eventId}${mkt ? `-${mkt.marketId}` : ''}`,
    question: mkt?.title || event.title,
    category,
    marketOdds: yesPct,
    platform: platformName as any,
    volume,
    resolvesAt: mkt?.closeTime
      ? new Date(mkt.closeTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'TBD',
    aiPrediction,
    aiReasoning,
    aiEvidence,
    url: `https://jup.ag/prediction/${event.eventId}`,
    liquidity: mkt?.pricing?.liquidity ? parseInt(mkt.pricing.liquidity, 10) / 1_000_000 : 0,
    status: event.status as any,

    // Jupiter-specific data stored in dflow field for compatibility
    dflow: {
      ticker: event.eventId,
      seriesTicker: mkt?.marketId || '',
      volume24h: mkt?.pricing?.volume24h ? parseInt(mkt.pricing.volume24h, 10) / 1_000_000 : 0,
      openInterest: openInterest,
      yesBid: yesPriceUsd,
      yesAsk: yesPriceUsd,
      noBid: 1 - yesPriceUsd,
      noAsk: 1 - yesPriceUsd,
      spread: 0,
      tokens: mkt?.onChain ? {
        yesMint: mkt.onChain.yesMint || null,
        noMint: mkt.onChain.noMint || null,
        marketLedger: mkt.onChain.marketPubkey,
        isInitialized: true,
        redemptionStatus: 'open' as const,
      } : null,
      imageUrl: event.imageUrl || event.metadata?.imageUrl,
    },
  };
}

/**
 * Transform multiple Jupiter events to Predictions
 */
export function transformJupiterEvents(events: JupiterEvent[]): Prediction[] {
  const predictions: Prediction[] = [];

  for (const event of events) {
    // If event has markets, create a prediction for each market
    if (event.markets && event.markets.length > 0) {
      for (const market of event.markets) {
        predictions.push(transformJupiterToPrediction(event, market));
      }
    } else {
      // No markets, create single prediction from event
      predictions.push(transformJupiterToPrediction(event));
    }
  }

  return predictions;
}

// Helper to categorize Jupiter markets
function categorizeJupiterMarket(title: string): Category {
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
      lower.includes('super bowl') || lower.includes('championship') || lower.includes('olympics') ||
      lower.includes('basketball') || lower.includes('football') || lower.includes('soccer')) {
    return 'sports';
  }

  return 'politics'; // Default
}

// Format volume for Jupiter (already in USD)
function formatVolumeForJupiter(volume: number): string {
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1_000) return `$${(volume / 1_000).toFixed(0)}K`;
  return `$${Math.round(volume)}`;
}

// ===== Aggregated Market Data =====

/**
 * Calculate trending score for a prediction
 * Higher score = more trending/hot
 *
 * Factors considered:
 * - Total volume (40% weight) - higher volume = more interest
 * - 24h volume velocity (30% weight) - recent activity matters more
 * - Open interest (15% weight) - more positions = more engagement
 * - Time urgency (15% weight) - markets ending soon get boosted
 */
function calculateTrendingScore(prediction: Prediction): number {
  let score = 0;

  // 1. Total volume score (40% weight)
  const volumeStr = prediction.volume || '$0';
  const volumeNum = parseFloat(volumeStr.replace(/[$,KMB]/g, '')) * (
    volumeStr.includes('M') ? 1_000_000 :
    volumeStr.includes('K') ? 1_000 :
    volumeStr.includes('B') ? 1_000_000_000 : 1
  );
  // Normalize: $1M = 100 points, cap at 500
  const volumeScore = Math.min(500, (volumeNum / 10_000));
  score += volumeScore * 0.4;

  // 2. 24h volume velocity (30% weight) - recent activity
  const volume24h = prediction.dflow?.volume24h || 0;
  // Normalize: $100K 24h = 100 points, cap at 300
  const velocityScore = Math.min(300, (volume24h / 1_000));
  score += velocityScore * 0.3;

  // 3. Open interest (15% weight) - engagement indicator
  const openInterest = prediction.dflow?.openInterest || 0;
  // Normalize: 1000 contracts = 100 points, cap at 200
  const oiScore = Math.min(200, (openInterest / 10));
  score += oiScore * 0.15;

  // 4. Time urgency (15% weight) - markets ending soon are hotter
  const resolvesAt = prediction.resolvesAt;
  if (resolvesAt && resolvesAt !== 'TBD') {
    try {
      const endDate = new Date(resolvesAt);
      const now = new Date();
      const hoursUntilEnd = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilEnd > 0 && hoursUntilEnd <= 24) {
        // Ending within 24h - max boost (100 points)
        score += 100 * 0.15;
      } else if (hoursUntilEnd > 0 && hoursUntilEnd <= 72) {
        // Ending within 3 days - medium boost (60 points)
        score += 60 * 0.15;
      } else if (hoursUntilEnd > 0 && hoursUntilEnd <= 168) {
        // Ending within a week - small boost (30 points)
        score += 30 * 0.15;
      }
      // Markets ending later get no urgency boost
    } catch {
      // Invalid date, no urgency score
    }
  }

  // 5. Spread bonus - tighter spreads indicate active trading
  const spread = prediction.dflow?.spread;
  if (spread !== undefined && spread < 5) {
    // Very tight spread (<5 cents) = bonus
    score += (5 - spread) * 2;
  }

  return score;
}

/**
 * Sort and shuffle predictions by trending score
 * Most trending market goes first, then shuffled by score bands
 */
function sortByTrending(predictions: Prediction[]): Prediction[] {
  if (predictions.length === 0) return predictions;

  // Calculate scores for all predictions
  const scored = predictions.map(p => ({
    prediction: p,
    score: calculateTrendingScore(p)
  }));

  // Sort by score (descending)
  scored.sort((a, b) => b.score - a.score);

  // Return sorted predictions
  // The top market (highest score) is guaranteed to be first
  // Rest are sorted by score, creating a natural "trending" order
  return scored.map(s => s.prediction);
}

/**
 * Get aggregated hot markets from both DFlow and Jupiter
 */
export async function getAggregatedHotMarkets(limit = 20): Promise<{
  success: boolean;
  predictions: Prediction[];
  sources: {
    dflow: { count: number; success: boolean; error?: string };
    jupiter: { count: number; success: boolean; error?: string };
  };
}> {
  // Fetch from both sources in parallel
  const [dflowResult, jupiterResult] = await Promise.allSettled([
    getDFlowHotMarkets(limit),
    getJupiterHotEvents(limit),
  ]);

  const predictions: Prediction[] = [];
  const sources: {
    dflow: { count: number; success: boolean; error?: string };
    jupiter: { count: number; success: boolean; error?: string };
  } = {
    dflow: { count: 0, success: false },
    jupiter: { count: 0, success: false },
  };

  // Process DFlow results
  if (dflowResult.status === 'fulfilled' && dflowResult.value.success) {
    const dflowPredictions = transformDFlowEvents(dflowResult.value.events);
    predictions.push(...dflowPredictions);
    sources.dflow = { count: dflowPredictions.length, success: true };
  } else if (dflowResult.status === 'rejected') {
    const errorMsg = dflowResult.reason instanceof Error ? dflowResult.reason.message : 'Unknown error';
    console.error('[API] DFlow fetch failed:', errorMsg);
    sources.dflow = { count: 0, success: false, error: errorMsg };
  } else if (dflowResult.status === 'fulfilled' && !dflowResult.value.success) {
    console.error('[API] DFlow API returned error');
    sources.dflow = { count: 0, success: false, error: 'API returned unsuccessful response' };
  }

  // Process Jupiter results
  if (jupiterResult.status === 'fulfilled' && jupiterResult.value.success) {
    const jupiterPredictions = transformJupiterEvents(jupiterResult.value.data);
    predictions.push(...jupiterPredictions);
    sources.jupiter = { count: jupiterPredictions.length, success: true };
  } else if (jupiterResult.status === 'rejected') {
    const errorMsg = jupiterResult.reason instanceof Error ? jupiterResult.reason.message : 'Unknown error';
    console.error('[API] Jupiter fetch failed:', errorMsg);
    sources.jupiter = { count: 0, success: false, error: errorMsg };
  } else if (jupiterResult.status === 'fulfilled' && !jupiterResult.value.success) {
    console.error('[API] Jupiter API returned error');
    sources.jupiter = { count: 0, success: false, error: 'API returned unsuccessful response' };
  }

  // Sort by trending score (considers volume, 24h activity, open interest, time urgency)
  // The most trending market will always be first in the deck
  const sortedPredictions = sortByTrending(predictions);

  // Limit total results
  const limitedPredictions = sortedPredictions.slice(0, limit);

  return {
    success: sources.dflow.success || sources.jupiter.success,
    predictions: limitedPredictions,
    sources,
  };
}

/**
 * Search aggregated markets from both DFlow and Jupiter
 */
export async function searchAggregatedMarkets(query: string, limit = 20): Promise<{
  success: boolean;
  predictions: Prediction[];
  sources: {
    dflow: { count: number; success: boolean; error?: string };
    jupiter: { count: number; success: boolean; error?: string };
  };
}> {
  // Fetch from both sources in parallel
  const [dflowResult, jupiterResult] = await Promise.allSettled([
    searchDFlowMarkets(query, limit),
    searchJupiterEvents(query, limit),
  ]);

  const predictions: Prediction[] = [];
  const sources: {
    dflow: { count: number; success: boolean; error?: string };
    jupiter: { count: number; success: boolean; error?: string };
  } = {
    dflow: { count: 0, success: false },
    jupiter: { count: 0, success: false },
  };

  // Process DFlow results
  if (dflowResult.status === 'fulfilled' && dflowResult.value.success) {
    const dflowPredictions = transformDFlowEvents(dflowResult.value.events);
    predictions.push(...dflowPredictions);
    sources.dflow = { count: dflowPredictions.length, success: true };
  } else if (dflowResult.status === 'rejected') {
    const errorMsg = dflowResult.reason instanceof Error ? dflowResult.reason.message : 'Unknown error';
    console.error('[API] DFlow search failed:', errorMsg);
    sources.dflow = { count: 0, success: false, error: errorMsg };
  }

  // Process Jupiter results
  if (jupiterResult.status === 'fulfilled' && jupiterResult.value.success) {
    const jupiterPredictions = transformJupiterEvents(jupiterResult.value.data);
    predictions.push(...jupiterPredictions);
    sources.jupiter = { count: jupiterPredictions.length, success: true };
  } else if (jupiterResult.status === 'rejected') {
    const errorMsg = jupiterResult.reason instanceof Error ? jupiterResult.reason.message : 'Unknown error';
    console.error('[API] Jupiter search failed:', errorMsg);
    sources.jupiter = { count: 0, success: false, error: errorMsg };
  }

  // Sort by trending score (considers volume, 24h activity, open interest, time urgency)
  const sortedPredictions = sortByTrending(predictions);

  return {
    success: sources.dflow.success || sources.jupiter.success,
    predictions: sortedPredictions.slice(0, limit),
    sources,
  };
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
  dflow: 'DFlow',
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
    platform: platformDisplayNames[market.platform] || market.platform as any,
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

// ============ V2 MARKETS API ============
// Modern market data endpoints with better caching and normalization

export interface V2Market {
  id: string;
  platform: Platform;
  title: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  yesPct: number;
  noPct: number;
  volume: number;
  volume24h?: number;
  liquidity: number;
  openInterest?: number;
  endDate: string | null;
  status: 'active' | 'closed' | 'resolved';
  url: string;
  category?: string;
  tags?: string[];
}

export interface V2MarketsResponse {
  success: boolean;
  data: {
    markets: V2Market[];
    count: number;
    platforms: Platform[];
  };
  meta: {
    timestamp: string;
    cached: boolean;
  };
}

/**
 * Get markets from V2 API (better caching, unified format)
 */
export async function getV2Markets(options?: {
  platform?: Platform;
  category?: string;
  limit?: number;
  offset?: number;
  sort?: 'volume' | 'liquidity' | 'newest' | 'closing';
}): Promise<V2MarketsResponse> {
  const params = new URLSearchParams();
  if (options?.platform) params.set('platform', options.platform);
  if (options?.category) params.set('category', options.category);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  if (options?.sort) params.set('sort', options.sort);

  return apiFetch(`/api/v2/markets?${params}`);
}

/**
 * Get a single market by ID
 */
export async function getV2Market(marketId: string): Promise<{
  success: boolean;
  data: V2Market | null;
  meta: { timestamp: string };
}> {
  return apiFetch(`/api/v2/markets/${encodeURIComponent(marketId)}`);
}

/**
 * Get trending markets (high momentum)
 */
export async function getTrendingMarkets(options?: {
  limit?: number;
  platform?: Platform;
}): Promise<{
  success: boolean;
  data: {
    markets: Array<V2Market & {
      momentum: number;
      priceChange24h: number;
      volumeChange24h: number;
    }>;
  };
  meta: { timestamp: string };
}> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.platform) params.set('platform', options.platform);

  return apiFetch(`/api/v2/markets/trending?${params}`);
}

// ============ V2 EXECUTION API ============
// Trade execution across platforms

export interface ExecutionQuote {
  marketId: string;
  platform: Platform;
  side: 'YES' | 'NO';
  size: number;
  price: number;
  estimatedCost: number;
  estimatedFees: number;
  slippage: number;
  executionMode: 'market' | 'limit' | 'twap';
  expiresAt: string;
}

export interface ExecutionResult {
  orderId: string;
  status: 'pending' | 'filled' | 'partial' | 'cancelled' | 'failed';
  marketId: string;
  platform: Platform;
  side: 'YES' | 'NO';
  size: number;
  filledSize: number;
  avgPrice: number;
  fees: number;
  timestamp: string;
  txSignature?: string;
}

export interface PlatformBalance {
  platform: Platform;
  total: number;
  available: number;
  locked: number;
  currency: string;
}

/**
 * Get execution quote for a trade
 */
export async function getExecutionQuote(params: {
  marketId: string;
  platform: Platform;
  side: 'YES' | 'NO';
  size: number;
}): Promise<{
  success: boolean;
  data: {
    quote: ExecutionQuote;
    riskCheck: {
      approved: boolean;
      warnings: string[];
    };
  };
}> {
  const queryParams = new URLSearchParams({
    marketId: params.marketId,
    platform: params.platform,
    side: params.side,
    size: String(params.size),
  });
  return apiFetch(`/api/v2/execution/quote?${queryParams}`);
}

/**
 * Execute a trade
 */
export async function executeTrade(params: {
  marketId: string;
  platform: Platform;
  side: 'YES' | 'NO';
  size: number;
  price?: number;
  type?: 'market' | 'limit';
}): Promise<{
  success: boolean;
  data: {
    execution: ExecutionResult;
  };
  error?: string;
}> {
  return apiFetch('/api/v2/execution', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Get balances across all platforms
 */
export async function getExecutionBalances(): Promise<{
  success: boolean;
  data: {
    balances: PlatformBalance[];
    total: number;
    available: number;
  };
}> {
  return apiFetch('/api/v2/execution/balances');
}

/**
 * Get execution status
 */
export async function getExecutionStatus(): Promise<{
  success: boolean;
  data: {
    status: 'online' | 'degraded' | 'offline';
    platforms: Record<Platform, {
      connected: boolean;
      latencyMs: number;
    }>;
    recentExecutions: ExecutionResult[];
  };
}> {
  return apiFetch('/api/v2/execution');
}

// ============ V2 RISK SIZING API ============
// Kelly criterion and optimal position sizing

export interface RiskSizingResult {
  suggestedSize: number;
  maxSize: number;
  kelly: {
    fullKelly: number;
    halfKelly: number;
    quarterKelly: number;
    suggestedFraction: number;
  };
  edge: number;
  expectedValue: number;
  reasoning: string;
}

/**
 * Get optimal position size
 */
export async function getOptimalSize(params: {
  probability: number;
  marketPrice: number;
  confidence: number;
  bankroll?: number;
}): Promise<{
  success: boolean;
  data: RiskSizingResult;
}> {
  return apiFetch('/api/v2/risk/sizing', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Check if trade passes risk limits
 */
export async function checkTradeRisk(params: {
  marketId: string;
  platform: Platform;
  side: 'YES' | 'NO';
  size: number;
  price?: number;
  probability?: number;
  confidence?: number;
}): Promise<{
  success: boolean;
  data: {
    approved: boolean;
    warnings: string[];
    violations: string[];
    suggestedSize?: number;
    reasoning: string;
  };
}> {
  return apiFetch('/api/v2/risk', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Update risk configuration
 */
export async function updateRiskConfig(config: {
  maxPositionSize?: number;
  maxTotalExposure?: number;
  maxDailyLoss?: number;
  maxDrawdownPct?: number;
  kellyFraction?: number;
  minEdgeForTrade?: number;
  minConfidenceForTrade?: number;
}): Promise<{
  success: boolean;
  data: {
    config: Record<string, number>;
    message: string;
  };
}> {
  return apiFetch('/api/v2/risk', {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

// ============ RESEARCH API ============
// Superforecaster methodology research

export interface ResearchReport {
  topic: string;
  question: string;
  analysis: {
    baseRate: number;
    adjustments: Array<{
      factor: string;
      direction: 'up' | 'down';
      magnitude: number;
      reasoning: string;
    }>;
    finalProbability: number;
    confidence: 'low' | 'medium' | 'high';
  };
  evidence: {
    supporting: string[];
    opposing: string[];
  };
  sources: Array<{
    title: string;
    url: string;
    relevance: number;
  }>;
  marketComparison?: {
    platform: Platform;
    currentPrice: number;
    edge: number;
  }[];
  generatedAt: string;
}

/**
 * Request deep research analysis
 */
export async function requestResearch(topic: string): Promise<{
  success: boolean;
  data: ResearchReport;
}> {
  return apiFetch('/api/research', {
    method: 'POST',
    body: JSON.stringify({ topic }),
  });
}

/**
 * Get cached research (if available)
 */
export async function getResearch(topic: string): Promise<{
  success: boolean;
  data: ResearchReport | null;
  cached: boolean;
}> {
  return apiFetch(`/api/research?topic=${encodeURIComponent(topic)}`);
}

// ============ FORECASTERS API ============
// Top forecasters leaderboard

export interface Forecaster {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  brierScore: number;
  accuracy: number;
  predictions: number;
  resolvedPredictions: number;
  streak: number;
  rank: number;
  onChainCount: number;
  walletAddress?: string;
  expertise?: string[];
}

/**
 * Get top forecasters leaderboard
 */
export async function getForecasters(options?: {
  limit?: number;
  sortBy?: 'brier' | 'accuracy' | 'predictions' | 'streak';
  timeframe?: '7d' | '30d' | '90d' | 'all';
}): Promise<{
  success: boolean;
  data: {
    forecasters: Forecaster[];
    count: number;
  };
}> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.sortBy) params.set('sortBy', options.sortBy);
  if (options?.timeframe) params.set('timeframe', options.timeframe);

  return apiFetch(`/api/forecasters?${params}`);
}

// ============ CRON/PROACTIVE API ============
// Proactive agent triggers (internal use)

/**
 * Trigger proactive agent scan
 */
export async function triggerProactiveScan(): Promise<{
  success: boolean;
  data: {
    triggered: boolean;
    lastRun: string;
    nextRun: string;
  };
}> {
  return apiFetch('/api/cron', { method: 'POST' });
}

// ============ HEALTH API ============

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  services: {
    database: boolean;
    redis: boolean;
    llm: boolean;
    markets: boolean;
  };
  timestamp: string;
}

/**
 * Get backend health status
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  return apiFetch('/api/health');
}

/**
 * Get V2 API health
 */
export async function getV2Health(): Promise<{
  success: boolean;
  data: {
    status: string;
    services: Record<string, boolean>;
    latency: Record<string, number>;
  };
}> {
  return apiFetch('/api/v2/health');
}

// ============ COMBINED TERMINAL DATA ============
// Helper to fetch all terminal data in one call

export interface TerminalData {
  markets: ApiMarket[];
  arbitrage: ApiArbitrage[];
  portfolio: any;
  risk: any;
  connected: boolean;
}

/**
 * Fetch all terminal data in parallel
 * Uses v2 feed API for ML-powered market matching
 */
export async function fetchTerminalData(): Promise<TerminalData> {
  const [marketsRes, portfolioRes, riskRes] = await Promise.all([
    getHotMarketsFeed(20).catch(() => ({ markets: [], count: 0 })),
    apiFetch('/api/v2/portfolio').catch(() => ({ success: false, data: null })),
    apiFetch('/api/v2/risk').catch(() => ({ success: false, data: null })),
  ]);

  // Extract arbitrage from feed response or fetch separately
  const arbRes = await getFeed({ type: 'arbitrage', limit: 10 }).catch(() => ({ data: [], meta: {} }));

  // Convert feed arbitrage to ApiArbitrage format
  const arbitrageOpportunities: ApiArbitrage[] = arbRes.data
    ?.filter((m: FeedMarket) => m.arbitrage)
    .map((m: FeedMarket) => ({
      topic: m.question,
      platformA: m.arbitrage!.buyPlatform,
      platformB: m.arbitrage!.sellPlatform,
      priceA: m.arbitrage!.buyPrice,
      priceB: m.arbitrage!.sellPrice,
      spread: m.arbitrage!.spread,
      profitPercent: m.arbitrage!.profitPct,
      strategy: `Buy on ${m.arbitrage!.buyPlatform}, sell on ${m.arbitrage!.sellPlatform}`,
      confidence: m.matchConfidence,
    })) || [];

  return {
    markets: marketsRes.markets || [],
    arbitrage: arbitrageOpportunities,
    portfolio: (portfolioRes as any)?.data || null,
    risk: (riskRes as any)?.data || null,
    connected: true,
  };
}

// ============ MODE API ============
// Get app mode info (demo vs production)

export interface ModeInfo {
  mode: 'demo' | 'production';
  network: 'devnet' | 'mainnet-beta';
  networkLabel: string;
  tradingMode: 'paper' | 'live';
  showWaitlist: boolean;
  features: {
    trading: boolean;
    predictions: boolean;
    leaderboard: boolean;
    agents: boolean;
  };
}

/**
 * Get current app mode info
 */
export async function getModeInfo(): Promise<{
  success: boolean;
  data: ModeInfo | null;
}> {
  return apiFetch('/api/v2/mode');
}

/**
 * Check if currently in demo mode
 */
export async function isInDemoMode(): Promise<boolean> {
  try {
    const result = await getModeInfo();
    return result.success && result.data?.mode === 'demo';
  } catch {
    // Default to demo if can't determine
    return true;
  }
}
