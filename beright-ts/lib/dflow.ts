/**
 * DFlow API Client for BeRight Protocol
 *
 * Unified API for tokenized prediction markets on Solana.
 * Provides market data, trading, and real-time updates.
 *
 * TWO MODES:
 * 1. Metadata API (free) - Market data, events, search, trades
 * 2. Trade API (free for users) - Order execution via wallet signing
 *
 * No API key required for dev endpoints (rate limited).
 * For production, request key at https://pond.dflow.net/build/api-key
 */

// ============================================
// API CONFIGURATION
// ============================================

// Metadata API - Market data, events, trades
const DFLOW_METADATA_API = 'https://dev-prediction-markets-api.dflow.net/api/v1';

// Trade API - Order execution
const DFLOW_TRADE_API = 'https://dev-quote-api.dflow.net';

// Production APIs (when we have API key)
const DFLOW_PROD_METADATA_API = 'https://prediction-markets-api.dflow.net/api/v1';
const DFLOW_PROD_TRADE_API = 'https://quote-api.dflow.net';

// Common token addresses
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const SOL_MINT = 'So11111111111111111111111111111111111111112';

// ============================================
// TYPES
// ============================================

export type DFlowMarketStatus = 'initialized' | 'active' | 'inactive' | 'closed' | 'determined' | 'finalized';
export type DFlowMarketResult = 'yes' | 'no' | '';
export type DFlowTakerSide = 'yes' | 'no';
export type DFlowOrderStatus = 'pending' | 'expired' | 'failed' | 'open' | 'pendingClose' | 'closed';
export type DFlowSortField = 'volume' | 'volume24h' | 'liquidity' | 'openInterest' | 'startDate';
export type DFlowSortOrder = 'asc' | 'desc';

export interface DFlowMarketAccountInfo {
  marketLedger: string;
  yesMint: string;
  noMint: string;
  isInitialized: boolean;
  redemptionStatus: 'open' | 'closed';
  scalarOutcomePct?: number;
}

export interface DFlowMarket {
  ticker: string;
  eventTicker: string;
  marketType: string;
  title: string;
  subtitle?: string;
  yesSubTitle?: string;
  noSubTitle?: string;
  openTime: number;
  closeTime: number;
  expirationTime: number;
  status: DFlowMarketStatus;
  result?: DFlowMarketResult;
  volume: number;
  openInterest: number;
  yesBid?: string | null;
  yesAsk?: string | null;
  noBid?: string | null;
  noAsk?: string | null;
  canCloseEarly: boolean;
  earlyCloseCondition?: string | null;
  rulesPrimary?: string | null;
  rulesSecondary?: string | null;
  accounts: Record<string, DFlowMarketAccountInfo>;
}

export interface DFlowSettlementSource {
  name: string;
  url: string;
}

export interface DFlowEvent {
  ticker: string;
  seriesTicker: string;
  title: string;
  subtitle?: string;
  competition?: string;
  competitionScope?: string;
  imageUrl?: string;
  liquidity?: number;
  volume?: number;
  volume24h?: number;
  openInterest?: number;
  strikeDate?: number;
  strikePeriod?: string;
  settlementSources?: DFlowSettlementSource[];
  markets?: DFlowMarket[];
}

export interface DFlowTrade {
  tradeId: string;
  ticker: string;
  price: number;
  count: number;
  yesPrice: number;
  noPrice: number;
  yesPriceDollars: string;
  noPriceDollars: string;
  takerSide: DFlowTakerSide;
  createdTime: number;
}

export interface DFlowOrderbook {
  sequence?: number;
  yesBids?: Record<string, number>;
  yesAsks?: Record<string, number>;
  noBids?: Record<string, number>;
  noAsks?: Record<string, number>;
}

export interface DFlowSeries {
  ticker: string;
  title: string;
  category?: string;
  subcategory?: string;
  tags?: string[];
}

export interface DFlowOrderResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan?: any[];
  transaction?: string;
  executionMode: string;
  contextSlot: number;
  platformFee?: {
    amount: string;
    feeBps: number;
  };
}

export interface DFlowOrderStatusResponse {
  status: DFlowOrderStatus;
  inAmount: string;
  outAmount: string;
  fills?: Array<{
    signature: string;
    inputMint: string;
    inAmount: string;
    outputMint: string;
    outAmount: string;
  }>;
  reverts?: Array<{
    signature: string;
    mint: string;
    amount: string;
  }>;
}

export interface DFlowMarketInitResponse {
  transaction: string;
  lastValidBlockHeight: number;
  computeUnitLimit: number;
}

export interface DFlowCandlestick {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Response types
interface MultiEventResponse {
  cursor: number | null;
  events: DFlowEvent[];
}

interface MultiMarketResponse {
  cursor: number | null;
  markets: DFlowMarket[];
}

interface SearchResponse {
  cursor: number | null;
  events: DFlowEvent[];
}

interface TradesResponse {
  cursor: string | null;
  trades: DFlowTrade[];
}

// ============================================
// DFLOW CLIENT
// ============================================

class DFlowClient {
  private metadataUrl: string;
  private tradeUrl: string;
  private apiKey?: string;

  constructor(options?: { apiKey?: string; useProd?: boolean }) {
    this.apiKey = options?.apiKey || process.env.DFLOW_API_KEY;
    this.metadataUrl = options?.useProd ? DFLOW_PROD_METADATA_API : DFLOW_METADATA_API;
    this.tradeUrl = options?.useProd ? DFLOW_PROD_TRADE_API : DFLOW_TRADE_API;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }
    return headers;
  }

  private async request<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options?.headers,
      },
      signal: options?.signal || AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DFlow API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // ========== EVENTS ==========

  async getEvents(params?: {
    limit?: number;
    cursor?: number;
    withNestedMarkets?: boolean;
    isInitialized?: boolean;
    status?: DFlowMarketStatus;
    seriesTickers?: string[];
    sort?: DFlowSortField;
    order?: DFlowSortOrder;
  }): Promise<MultiEventResponse> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor.toString());
    if (params?.withNestedMarkets) query.set('withNestedMarkets', 'true');
    if (params?.isInitialized !== undefined) query.set('isInitialized', params.isInitialized.toString());
    if (params?.status) query.set('status', params.status);
    if (params?.seriesTickers) query.set('seriesTickers', params.seriesTickers.join(','));
    if (params?.sort) query.set('sort', params.sort);
    if (params?.order) query.set('order', params.order);
    const queryStr = query.toString();
    return this.request(`${this.metadataUrl}/events${queryStr ? `?${queryStr}` : ''}`);
  }

  async getEvent(ticker: string): Promise<DFlowEvent> {
    return this.request(`${this.metadataUrl}/event/${ticker}`);
  }

  async getEventCandlesticks(ticker: string, params?: {
    resolution?: string;
    startTime?: number;
    endTime?: number;
  }): Promise<{ candlesticks: DFlowCandlestick[] }> {
    const query = new URLSearchParams();
    if (params?.resolution) query.set('resolution', params.resolution);
    if (params?.startTime) query.set('startTime', params.startTime.toString());
    if (params?.endTime) query.set('endTime', params.endTime.toString());
    const queryStr = query.toString();
    return this.request(`${this.metadataUrl}/event/${ticker}/candlesticks${queryStr ? `?${queryStr}` : ''}`);
  }

  // ========== MARKETS ==========

  async getMarkets(params?: {
    limit?: number;
    cursor?: number;
    isInitialized?: boolean;
    status?: DFlowMarketStatus;
    sort?: DFlowSortField;
    order?: DFlowSortOrder;
  }): Promise<MultiMarketResponse> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor.toString());
    if (params?.isInitialized !== undefined) query.set('isInitialized', params.isInitialized.toString());
    if (params?.status) query.set('status', params.status);
    if (params?.sort) query.set('sort', params.sort);
    if (params?.order) query.set('order', params.order);
    const queryStr = query.toString();
    return this.request(`${this.metadataUrl}/markets${queryStr ? `?${queryStr}` : ''}`);
  }

  async getMarket(ticker: string): Promise<DFlowMarket> {
    return this.request(`${this.metadataUrl}/market/${ticker}`);
  }

  async getMarketByMint(mint: string): Promise<DFlowMarket> {
    return this.request(`${this.metadataUrl}/market/by-mint/${mint}`);
  }

  async getMarketsBatch(mints: string[]): Promise<{ markets: DFlowMarket[] }> {
    return this.request(`${this.metadataUrl}/markets/batch`, {
      method: 'POST',
      body: JSON.stringify({ mints }),
    });
  }

  async getMarketCandlesticks(ticker: string, params?: {
    resolution?: string;
    startTime?: number;
    endTime?: number;
  }): Promise<{ candlesticks: DFlowCandlestick[] }> {
    const query = new URLSearchParams();
    if (params?.resolution) query.set('resolution', params.resolution);
    if (params?.startTime) query.set('startTime', params.startTime.toString());
    if (params?.endTime) query.set('endTime', params.endTime.toString());
    const queryStr = query.toString();
    return this.request(`${this.metadataUrl}/market/${ticker}/candlesticks${queryStr ? `?${queryStr}` : ''}`);
  }

  async getOutcomeMints(ticker: string): Promise<{ yesMint: string; noMint: string }> {
    return this.request(`${this.metadataUrl}/outcome_mints/${ticker}`);
  }

  async filterOutcomeMints(addresses: string[]): Promise<{ outcomeMints: string[] }> {
    return this.request(`${this.metadataUrl}/filter_outcome_mints`, {
      method: 'POST',
      body: JSON.stringify({ addresses }),
    });
  }

  // ========== SEARCH ==========

  async search(query: string, params?: {
    sort?: DFlowSortField;
    order?: DFlowSortOrder;
    limit?: number;
    cursor?: number;
    withNestedMarkets?: boolean;
    withMarketAccounts?: boolean;
  }): Promise<SearchResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set('q', query);
    if (params?.sort) searchParams.set('sort', params.sort);
    if (params?.order) searchParams.set('order', params.order);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.cursor) searchParams.set('cursor', params.cursor.toString());
    if (params?.withNestedMarkets) searchParams.set('withNestedMarkets', 'true');
    if (params?.withMarketAccounts) searchParams.set('withMarketAccounts', 'true');
    return this.request(`${this.metadataUrl}/search?${searchParams.toString()}`);
  }

  // ========== ORDERBOOK ==========

  async getOrderbook(ticker: string): Promise<DFlowOrderbook> {
    return this.request(`${this.metadataUrl}/orderbook/${ticker}`);
  }

  async getOrderbookByMint(mint: string): Promise<DFlowOrderbook> {
    return this.request(`${this.metadataUrl}/orderbook/by-mint/${mint}`);
  }

  // ========== TRADES ==========

  async getTrades(params?: {
    ticker?: string;
    limit?: number;
    cursor?: string;
    minTs?: number;
    maxTs?: number;
  }): Promise<TradesResponse> {
    const query = new URLSearchParams();
    if (params?.ticker) query.set('ticker', params.ticker);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.minTs) query.set('minTs', params.minTs.toString());
    if (params?.maxTs) query.set('maxTs', params.maxTs.toString());
    const queryStr = query.toString();
    return this.request(`${this.metadataUrl}/trades${queryStr ? `?${queryStr}` : ''}`);
  }

  async getTradesByMint(mint: string, params?: {
    limit?: number;
    cursor?: string;
  }): Promise<TradesResponse> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);
    const queryStr = query.toString();
    return this.request(`${this.metadataUrl}/trades/by-mint/${mint}${queryStr ? `?${queryStr}` : ''}`);
  }

  // ========== SERIES & TAGS ==========

  async getSeries(params?: {
    category?: string;
    tags?: string[];
    limit?: number;
    cursor?: number;
  }): Promise<{ cursor: number | null; series: DFlowSeries[] }> {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.tags) query.set('tags', params.tags.join(','));
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor.toString());
    const queryStr = query.toString();
    return this.request(`${this.metadataUrl}/series${queryStr ? `?${queryStr}` : ''}`);
  }

  async getSeriesByTicker(ticker: string): Promise<DFlowSeries> {
    return this.request(`${this.metadataUrl}/series/${ticker}`);
  }

  async getTagsByCategories(): Promise<Record<string, string[]>> {
    return this.request(`${this.metadataUrl}/tags_by_categories`);
  }

  async getFiltersBySports(): Promise<any> {
    return this.request(`${this.metadataUrl}/filters_by_sports`);
  }

  // ========== LIVE DATA ==========

  async getLiveData(milestoneIds: string[]): Promise<any> {
    const query = new URLSearchParams();
    query.set('milestoneIds', JSON.stringify(milestoneIds));
    return this.request(`${this.metadataUrl}/live_data?${query.toString()}`);
  }

  async getLiveDataByEvent(ticker: string): Promise<any> {
    return this.request(`${this.metadataUrl}/live_data/by-event/${ticker}`);
  }

  async getLiveDataByMint(mint: string): Promise<any> {
    return this.request(`${this.metadataUrl}/live_data/by-mint/${mint}`);
  }

  // ========== TRADING ==========

  async getOrder(params: {
    inputMint: string;
    outputMint: string;
    amount: number | string;
    userPublicKey?: string;
    slippageBps?: number | 'auto';
    predictionMarketSlippageBps?: number | 'auto';
    platformFeeBps?: number;
    platformFeeScale?: number;
    feeAccount?: string;
    prioritizationFeeLamports?: number | 'auto';
    destinationTokenAccount?: string;
  }): Promise<DFlowOrderResponse> {
    const query = new URLSearchParams();
    query.set('inputMint', params.inputMint);
    query.set('outputMint', params.outputMint);
    query.set('amount', params.amount.toString());
    if (params.userPublicKey) query.set('userPublicKey', params.userPublicKey);
    if (params.slippageBps !== undefined) query.set('slippageBps', params.slippageBps.toString());
    if (params.predictionMarketSlippageBps !== undefined) {
      query.set('predictionMarketSlippageBps', params.predictionMarketSlippageBps.toString());
    }
    if (params.platformFeeBps) query.set('platformFeeBps', params.platformFeeBps.toString());
    if (params.platformFeeScale) query.set('platformFeeScale', params.platformFeeScale.toString());
    if (params.feeAccount) query.set('feeAccount', params.feeAccount);
    if (params.prioritizationFeeLamports !== undefined) {
      query.set('prioritizationFeeLamports', params.prioritizationFeeLamports.toString());
    }
    if (params.destinationTokenAccount) query.set('destinationTokenAccount', params.destinationTokenAccount);

    return this.request(`${this.tradeUrl}/order?${query.toString()}`);
  }

  async getOrderStatus(signature: string, lastValidBlockHeight?: number): Promise<DFlowOrderStatusResponse> {
    const query = new URLSearchParams();
    query.set('signature', signature);
    if (lastValidBlockHeight) query.set('lastValidBlockHeight', lastValidBlockHeight.toString());
    return this.request(`${this.tradeUrl}/order-status?${query.toString()}`);
  }

  async initializeMarket(payer: string, outcomeMint: string): Promise<DFlowMarketInitResponse> {
    const query = new URLSearchParams();
    query.set('payer', payer);
    query.set('outcomeMint', outcomeMint);
    return this.request(`${this.tradeUrl}/prediction-market-init?${query.toString()}`);
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let dflowClient: DFlowClient | null = null;

export function getDFlowClient(): DFlowClient {
  if (!dflowClient) {
    dflowClient = new DFlowClient();
  }
  return dflowClient;
}

// ============================================
// CONVENIENCE EXPORTS
// ============================================

/**
 * Get hot markets sorted by 24h volume
 */
export async function getDFlowHotMarkets(limit = 20): Promise<DFlowEvent[]> {
  const client = getDFlowClient();
  const result = await client.getEvents({
    limit,
    sort: 'volume24h',
    order: 'desc',
    withNestedMarkets: true,
    status: 'active',
  });
  return result.events;
}

/**
 * Search markets by query
 */
export async function searchDFlowMarkets(query: string, limit = 20): Promise<DFlowEvent[]> {
  const client = getDFlowClient();
  const result = await client.search(query, {
    limit,
    withNestedMarkets: true,
    withMarketAccounts: true,
    sort: 'volume24h',
    order: 'desc',
  });
  return result.events;
}

/**
 * Get single market details
 */
export async function getDFlowMarket(ticker: string): Promise<DFlowMarket | null> {
  try {
    const client = getDFlowClient();
    return await client.getMarket(ticker);
  } catch {
    return null;
  }
}

/**
 * Get market by outcome mint address
 */
export async function getDFlowMarketByMint(mint: string): Promise<DFlowMarket | null> {
  try {
    const client = getDFlowClient();
    return await client.getMarketByMint(mint);
  } catch {
    return null;
  }
}

/**
 * Get orderbook for a market
 */
export async function getDFlowOrderbook(ticker: string): Promise<DFlowOrderbook | null> {
  try {
    const client = getDFlowClient();
    return await client.getOrderbook(ticker);
  } catch {
    return null;
  }
}

/**
 * Get recent trades for a market
 */
export async function getDFlowTrades(ticker: string, limit = 50): Promise<DFlowTrade[]> {
  const client = getDFlowClient();
  const result = await client.getTrades({ ticker, limit });
  return result.trades;
}

/**
 * Get all categories and tags
 */
export async function getDFlowCategories(): Promise<Record<string, string[]>> {
  const client = getDFlowClient();
  return client.getTagsByCategories();
}

/**
 * Get order transaction for trading
 * Returns base64-encoded transaction to sign and submit
 */
export async function getDFlowOrderTransaction(params: {
  inputMint: string;
  outputMint: string;
  amount: number;
  userPublicKey: string;
  slippageBps?: number;
}): Promise<DFlowOrderResponse> {
  const client = getDFlowClient();
  return client.getOrder({
    ...params,
    slippageBps: params.slippageBps || 50,
  });
}

/**
 * Check order status by transaction signature
 */
export async function checkDFlowOrderStatus(signature: string): Promise<DFlowOrderStatusResponse> {
  const client = getDFlowClient();
  return client.getOrderStatus(signature);
}

/**
 * Filter wallet token mints to find outcome tokens
 */
export async function filterDFlowOutcomeMints(mints: string[]): Promise<string[]> {
  const client = getDFlowClient();
  const result = await client.filterOutcomeMints(mints);
  return result.outcomeMints;
}

/**
 * Batch fetch markets by mint addresses
 */
export async function batchGetDFlowMarkets(mints: string[]): Promise<DFlowMarket[]> {
  const client = getDFlowClient();
  const result = await client.getMarketsBatch(mints);
  return result.markets;
}

/**
 * Get candlestick (OHLCV) data for a market
 */
export async function getCandlesticks(
  ticker: string,
  options: {
    resolution?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
    from?: number;
    to?: number;
  } = {}
): Promise<{ success: boolean; data?: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>; error?: string }> {
  try {
    const client = getDFlowClient();
    const result = await client.getMarketCandlesticks(ticker, {
      resolution: options.resolution || '1h',
      startTime: options.from,
      endTime: options.to,
    });

    // Transform the response to match expected format
    const candles = result.candlesticks.map(c => ({
      time: c.openTime,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));

    return { success: true, data: candles };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================
// WEBSOCKET CLIENT
// ============================================

export type DFlowWSChannel = 'prices' | 'trades' | 'orderbook';

export interface DFlowWSPriceMessage {
  channel: 'prices';
  type: 'ticker';
  market_ticker: string;
  yes_bid: string | null;
  yes_ask: string | null;
  no_bid: string | null;
  no_ask: string | null;
}

export interface DFlowWSTradeMessage {
  channel: 'trades';
  trade: DFlowTrade;
}

export interface DFlowWSOrderbookMessage {
  channel: 'orderbook';
  ticker: string;
  orderbook: DFlowOrderbook;
}

export type DFlowWSMessage = DFlowWSPriceMessage | DFlowWSTradeMessage | DFlowWSOrderbookMessage;

export class DFlowWebSocket {
  private ws: WebSocket | null = null;
  private apiKey?: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private handlers: Map<string, Set<(msg: DFlowWSMessage) => void>> = new Map();

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.DFLOW_API_KEY;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = 'wss://dev-prediction-markets-api.dflow.net/ws';

      // Note: In browser, WebSocket doesn't support custom headers
      // API key needs to be passed differently for browser clients
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onerror = (error) => {
        reject(error);
      };

      this.ws.onclose = () => {
        this.attemptReconnect();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as DFlowWSMessage;
          const channel = data.channel;
          const handlers = this.handlers.get(channel);
          if (handlers) {
            handlers.forEach(handler => handler(data));
          }
        } catch (e) {
          console.error('WebSocket message parse error:', e);
        }
      };
    });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000;
      setTimeout(() => this.connect(), delay);
    }
  }

  subscribe(channel: DFlowWSChannel, tickers?: string[], all = false) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const message = all
      ? { type: 'subscribe', channel, all: true }
      : { type: 'subscribe', channel, tickers };

    this.ws.send(JSON.stringify(message));
  }

  unsubscribe(channel: DFlowWSChannel, tickers?: string[], all = false) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const message = all
      ? { type: 'unsubscribe', channel, all: true }
      : { type: 'unsubscribe', channel, tickers };

    this.ws.send(JSON.stringify(message));
  }

  onMessage(channel: DFlowWSChannel, handler: (msg: DFlowWSMessage) => void) {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
    }
    this.handlers.get(channel)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(channel)?.delete(handler);
    };
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// ============================================
// CLI INTERFACE
// ============================================

if (process.argv[1]?.endsWith('dflow.ts')) {
  const args = process.argv.slice(2);
  const command = args[0];
  const query = args.slice(1).join(' ');

  (async () => {
    const client = getDFlowClient();

    if (command === 'hot') {
      const events = await getDFlowHotMarkets(15);
      console.log('\n=== DFlow Hot Markets (24h Volume) ===\n');
      for (const event of events) {
        console.log(`[${event.ticker}] ${event.title}`);
        console.log(`  Volume 24h: $${(event.volume24h || 0).toLocaleString()}`);
        console.log(`  Liquidity: $${(event.liquidity || 0).toLocaleString()}`);
        if (event.markets?.[0]) {
          const m = event.markets[0];
          console.log(`  YES: ${m.yesBid || 'N/A'} / ${m.yesAsk || 'N/A'}`);
        }
        console.log('');
      }
    } else if (command === 'search' && query) {
      const events = await searchDFlowMarkets(query, 10);
      console.log(`\n=== DFlow Search: "${query}" ===\n`);
      for (const event of events) {
        console.log(`[${event.ticker}] ${event.title}`);
        if (event.markets?.[0]) {
          const m = event.markets[0];
          const yesBid = parseFloat(m.yesBid || '0');
          const yesAsk = parseFloat(m.yesAsk || '0');
          const midPrice = (yesBid + yesAsk) / 2;
          console.log(`  YES: ${(midPrice * 100).toFixed(1)}%`);
          console.log(`  Mints: YES=${m.accounts?.[USDC_MINT]?.yesMint?.slice(0, 8)}...`);
        }
        console.log('');
      }
    } else if (command === 'market' && query) {
      const market = await getDFlowMarket(query);
      if (market) {
        console.log('\n=== Market Details ===\n');
        console.log(JSON.stringify(market, null, 2));
      } else {
        console.log(`Market not found: ${query}`);
      }
    } else if (command === 'trades' && query) {
      const trades = await getDFlowTrades(query, 20);
      console.log(`\n=== Recent Trades: ${query} ===\n`);
      for (const trade of trades) {
        const price = (trade.yesPrice / 100).toFixed(2);
        const side = trade.takerSide.toUpperCase();
        console.log(`${side} ${trade.count} @ ${price}% - ${new Date(trade.createdTime * 1000).toLocaleTimeString()}`);
      }
    } else if (command === 'categories') {
      const categories = await getDFlowCategories();
      console.log('\n=== DFlow Categories ===\n');
      for (const [category, tags] of Object.entries(categories)) {
        const tagList = Array.isArray(tags) ? tags.join(', ') : JSON.stringify(tags);
        console.log(`${category}: ${tagList}`);
      }
    } else if (command === 'orderbook' && query) {
      const orderbook = await getDFlowOrderbook(query);
      if (orderbook) {
        console.log(`\n=== Orderbook: ${query} ===\n`);
        console.log(JSON.stringify(orderbook, null, 2));
      }
    } else {
      console.log('DFlow CLI - Tokenized Prediction Markets on Solana\n');
      console.log('Usage:');
      console.log('  npx ts-node lib/dflow.ts hot                  - Hot markets by 24h volume');
      console.log('  npx ts-node lib/dflow.ts search <query>       - Search markets');
      console.log('  npx ts-node lib/dflow.ts market <ticker>      - Market details');
      console.log('  npx ts-node lib/dflow.ts trades <ticker>      - Recent trades');
      console.log('  npx ts-node lib/dflow.ts orderbook <ticker>   - Orderbook data');
      console.log('  npx ts-node lib/dflow.ts categories           - All categories/tags');
    }
  })();
}
