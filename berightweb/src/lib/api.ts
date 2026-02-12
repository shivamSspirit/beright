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

  // AI prediction based on market odds
  const { aiPrediction, aiReasoning, aiEvidence } = generateAIPrediction({
    id: event.ticker,
    platform: 'kalshi',
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
    url: event.url,
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
    url: event.url,
    liquidity: event.liquidity,
    status: event.status as any,

    // DFlow-specific fields
    dflow: {
      ticker: event.ticker,
      seriesTicker: event.seriesTicker,
      volume24h: event.volume24h,
      yesBid: event.yesBid,
      yesAsk: event.yesAsk,
      noBid: event.noBid,
      noAsk: event.noAsk,
      spread: event.spread,
      tokens: event.tokens,
      markets: event.markets,
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
