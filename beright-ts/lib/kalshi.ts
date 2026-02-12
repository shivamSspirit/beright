/**
 * Kalshi API Client
 *
 * TWO MODES:
 * 1. Public API (no auth) - Real production market data
 * 2. Private API (auth required) - Trading on demo or production
 *
 * Authentication: RSA-SHA256 with PSS padding
 * Docs: https://docs.kalshi.com
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// API CONFIGURATION
// ============================================

// Production API for PUBLIC data (no auth needed)
const KALSHI_PUBLIC_API = 'https://api.elections.kalshi.com/trade-api/v2';

// Demo API for PRIVATE endpoints (trading with demo credentials)
const KALSHI_DEMO_API = 'https://demo-api.kalshi.co/trade-api/v2';

// Production API for PRIVATE endpoints (real trading)
const KALSHI_PROD_API = 'https://api.elections.kalshi.com/trade-api/v2';

// ============================================
// TYPES
// ============================================

export interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  title: string;
  subtitle: string;
  status: string;
  yes_bid: number;
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  last_price: number;
  volume: number;
  volume_24h?: number;
  open_interest: number;
  close_time: string;
  expiration_time?: string;
  result?: string;
  category?: string;
  // Fixed-point fields
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  last_price_dollars?: string;
}

export interface KalshiEvent {
  event_ticker: string;
  title: string;
  category: string;
  subtitle: string;
  mutually_exclusive: boolean;
  markets?: KalshiMarket[];
  series_ticker?: string;
  strike_date?: string;
}

export interface KalshiSeries {
  series_ticker: string;
  title: string;
  category: string;
  frequency?: string;
  tags?: string[];
}

export interface KalshiTrade {
  ticker: string;
  trade_id: string;
  count: number;
  yes_price: number;
  no_price: number;
  taker_side: 'yes' | 'no';
  created_time: string;
}

export interface KalshiCandlestick {
  ticker: string;
  period_start: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface KalshiExchangeStatus {
  exchange_active: boolean;
  trading_active: boolean;
  exchange_estimated_resume_time?: string;
}

export interface KalshiAnnouncement {
  id: string;
  title: string;
  message: string;
  status: string;
  delivery_time: string;
  type: string;
}

export interface KalshiSchedule {
  schedule: {
    day: string;
    open_time: string;
    close_time: string;
  }[];
  next_open?: string;
  next_close?: string;
}

// Private endpoint types
export interface KalshiBalance {
  balance: number;
  available_balance?: number;
  payout_balance?: number;
  portfolio_value?: number;
  balance_dollars?: string;
  available_balance_dollars?: string;
}

export interface KalshiPosition {
  market_ticker: string;
  position: number;
  position_fp?: string;
  total_traded: number;
  resting_order_count: number;
  average_price: number;
}

export interface KalshiOrder {
  order_id: string;
  client_order_id?: string;
  market_ticker: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  count: number;
  count_fp?: string;
  type: 'limit' | 'market';
  yes_price?: number;
  no_price?: number;
  status: string;
  created_time: string;
}

export interface KalshiOrderbook {
  orderbook: {
    yes: [number, number][];
    no: [number, number][];
  };
}

// ============================================
// PUBLIC API CLIENT (No Authentication)
// ============================================

class KalshiPublicClient {
  private baseUrl = KALSHI_PUBLIC_API;

  private async request<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kalshi API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // ========== EXCHANGE ==========

  async getExchangeStatus(): Promise<KalshiExchangeStatus> {
    return this.request('/exchange/status');
  }

  async getExchangeAnnouncements(): Promise<{ announcements: KalshiAnnouncement[] }> {
    return this.request('/exchange/announcements');
  }

  async getExchangeSchedule(): Promise<KalshiSchedule> {
    return this.request('/exchange/schedule');
  }

  // ========== MARKETS ==========

  async getMarkets(params?: {
    limit?: number;
    cursor?: string;
    status?: 'open' | 'closed' | 'settled';
    series_ticker?: string;
    event_ticker?: string;
    tickers?: string[];
  }): Promise<{ markets: KalshiMarket[]; cursor?: string }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.status) query.set('status', params.status);
    if (params?.series_ticker) query.set('series_ticker', params.series_ticker);
    if (params?.event_ticker) query.set('event_ticker', params.event_ticker);
    if (params?.tickers) params.tickers.forEach(t => query.append('tickers', t));
    const queryStr = query.toString();
    return this.request(`/markets${queryStr ? `?${queryStr}` : ''}`);
  }

  async getMarket(ticker: string): Promise<{ market: KalshiMarket }> {
    return this.request(`/markets/${ticker}`);
  }

  async getTrades(params?: {
    limit?: number;
    cursor?: string;
    ticker?: string;
    min_ts?: number;
    max_ts?: number;
  }): Promise<{ trades: KalshiTrade[]; cursor?: string }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.ticker) query.set('ticker', params.ticker);
    if (params?.min_ts) query.set('min_ts', params.min_ts.toString());
    if (params?.max_ts) query.set('max_ts', params.max_ts.toString());
    const queryStr = query.toString();
    return this.request(`/markets/trades${queryStr ? `?${queryStr}` : ''}`);
  }

  async getCandlesticks(params: {
    tickers: string[];
    period_interval: number; // minutes
    start_ts?: number;
    end_ts?: number;
  }): Promise<{ candlesticks: KalshiCandlestick[] }> {
    const query = new URLSearchParams();
    params.tickers.forEach(t => query.append('tickers', t));
    query.set('period_interval', params.period_interval.toString());
    if (params.start_ts) query.set('start_ts', params.start_ts.toString());
    if (params.end_ts) query.set('end_ts', params.end_ts.toString());
    return this.request(`/markets/candlesticks?${query.toString()}`);
  }

  // ========== EVENTS ==========

  async getEvents(params?: {
    limit?: number;
    cursor?: string;
    status?: 'open' | 'closed' | 'settled';
    series_ticker?: string;
    with_nested_markets?: boolean;
  }): Promise<{ events: KalshiEvent[]; cursor?: string }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.status) query.set('status', params.status);
    if (params?.series_ticker) query.set('series_ticker', params.series_ticker);
    if (params?.with_nested_markets) query.set('with_nested_markets', 'true');
    const queryStr = query.toString();
    return this.request(`/events${queryStr ? `?${queryStr}` : ''}`);
  }

  async getEvent(eventTicker: string): Promise<{ event: KalshiEvent }> {
    return this.request(`/events/${eventTicker}`);
  }

  // ========== SERIES ==========

  async getSeries(params?: {
    limit?: number;
    cursor?: string;
  }): Promise<{ series: KalshiSeries[]; cursor?: string }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);
    const queryStr = query.toString();
    return this.request(`/series${queryStr ? `?${queryStr}` : ''}`);
  }

  async getSeriesDetails(seriesTicker: string): Promise<{ series: KalshiSeries }> {
    return this.request(`/series/${seriesTicker}`);
  }
}

// ============================================
// PRIVATE API CLIENT (Authentication Required)
// ============================================

interface KalshiPrivateConfig {
  apiKey: string;
  privateKeyPem: string;
  useDemo?: boolean;
}

class KalshiPrivateClient {
  private apiKey: string;
  private privateKeyPem: string;
  private baseUrl: string;

  constructor(config: KalshiPrivateConfig) {
    this.apiKey = config.apiKey;
    this.privateKeyPem = config.privateKeyPem;
    this.baseUrl = config.useDemo ? KALSHI_DEMO_API : KALSHI_PROD_API;
  }

  private signRequest(timestamp: string, method: string, path: string): string {
    const pathWithoutQuery = path.split('?')[0];
    const fullPath = `/trade-api/v2${pathWithoutQuery}`;
    const message = `${timestamp}${method.toUpperCase()}${fullPath}`;

    const signature = crypto.sign('sha256', Buffer.from(message), {
      key: this.privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_MAX_SIGN,
    });

    return signature.toString('base64');
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE' | 'PATCH',
    path: string,
    body?: any
  ): Promise<T> {
    const timestamp = Date.now().toString();
    const signature = this.signRequest(timestamp, method, path);
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'KALSHI-ACCESS-KEY': this.apiKey,
      'KALSHI-ACCESS-SIGNATURE': signature,
      'KALSHI-ACCESS-TIMESTAMP': timestamp,
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kalshi API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // ========== PORTFOLIO ==========

  async getBalance(): Promise<KalshiBalance> {
    return this.request('GET', '/portfolio/balance');
  }

  async getPositions(params?: {
    limit?: number;
    cursor?: string;
    settlement_status?: 'unsettled' | 'settled';
  }): Promise<{ positions: KalshiPosition[]; cursor?: string }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.settlement_status) query.set('settlement_status', params.settlement_status);
    const queryStr = query.toString();
    return this.request('GET', `/portfolio/positions${queryStr ? `?${queryStr}` : ''}`);
  }

  async getOrders(params?: {
    limit?: number;
    cursor?: string;
    status?: 'resting' | 'canceled' | 'executed' | 'pending';
    ticker?: string;
  }): Promise<{ orders: KalshiOrder[]; cursor?: string }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.status) query.set('status', params.status);
    if (params?.ticker) query.set('ticker', params.ticker);
    const queryStr = query.toString();
    return this.request('GET', `/portfolio/orders${queryStr ? `?${queryStr}` : ''}`);
  }

  async getFills(params?: {
    limit?: number;
    cursor?: string;
    ticker?: string;
  }): Promise<{ fills: any[]; cursor?: string }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.ticker) query.set('ticker', params.ticker);
    const queryStr = query.toString();
    return this.request('GET', `/portfolio/fills${queryStr ? `?${queryStr}` : ''}`);
  }

  // ========== TRADING ==========

  async placeOrder(params: {
    ticker: string;
    side: 'yes' | 'no';
    action: 'buy' | 'sell';
    count: number;
    type: 'limit' | 'market';
    yes_price?: number;
    client_order_id?: string;
  }): Promise<{ order: KalshiOrder }> {
    return this.request('POST', '/portfolio/orders', params);
  }

  async cancelOrder(orderId: string): Promise<{ order: KalshiOrder }> {
    return this.request('DELETE', `/portfolio/orders/${orderId}`);
  }

  async amendOrder(orderId: string, params: {
    count?: number;
    yes_price?: number;
  }): Promise<{ order: KalshiOrder }> {
    return this.request('POST', `/portfolio/orders/${orderId}/amend`, params);
  }

  // ========== ORDERBOOK (Private) ==========

  async getOrderbook(ticker: string): Promise<KalshiOrderbook> {
    return this.request('GET', `/markets/${ticker}/orderbook`);
  }
}

// ============================================
// SINGLETON INSTANCES
// ============================================

// Public client - always available, uses production
let publicClient: KalshiPublicClient | null = null;

// Private client - only if credentials configured
let privateClient: KalshiPrivateClient | null = null;

function loadPrivateKey(keyOrPath: string): string {
  if (keyOrPath.includes('-----BEGIN')) {
    return keyOrPath;
  }

  try {
    const resolvedPath = path.resolve(keyOrPath);
    if (fs.existsSync(resolvedPath)) {
      return fs.readFileSync(resolvedPath, 'utf8');
    }
  } catch {
    // Not a file path
  }

  // Raw base64 key - format into PEM
  const cleanKey = keyOrPath.replace(/\s/g, '');
  const lines: string[] = [];
  for (let i = 0; i < cleanKey.length; i += 64) {
    lines.push(cleanKey.substring(i, i + 64));
  }
  const formattedKey = lines.join('\n');

  return `-----BEGIN RSA PRIVATE KEY-----\n${formattedKey}\n-----END RSA PRIVATE KEY-----`;
}

// ============================================
// EXPORTED FUNCTIONS
// ============================================

/**
 * Get public API client (no auth needed, production data)
 */
export function getKalshiPublicClient(): KalshiPublicClient {
  if (!publicClient) {
    publicClient = new KalshiPublicClient();
  }
  return publicClient;
}

/**
 * Get private API client (auth required, demo or production)
 */
export function getKalshiClient(): KalshiPrivateClient | null {
  if (privateClient) return privateClient;

  const apiKey = process.env.KALSHI_API_KEY;
  const apiSecret = process.env.KALSHI_API_SECRET;

  if (!apiKey || !apiSecret) {
    return null;
  }

  privateClient = new KalshiPrivateClient({
    apiKey,
    privateKeyPem: loadPrivateKey(apiSecret),
    useDemo: process.env.KALSHI_USE_DEMO === 'true',
  });

  return privateClient;
}

// ============================================
// CONVENIENCE EXPORTS (Public Data - Production)
// ============================================

/**
 * Get markets - fetches more and sorts by volume for better results
 */
export async function getKalshiMarkets(limit = 20): Promise<KalshiMarket[]> {
  const client = getKalshiPublicClient();
  // Fetch more markets to find ones with volume
  const result = await client.getMarkets({ status: 'open', limit: Math.max(limit * 5, 100) });

  // Sort by volume descending, then return top N
  return result.markets
    .sort((a, b) => (b.volume || 0) - (a.volume || 0))
    .slice(0, limit);
}

/**
 * Get popular markets - high volume, real trading activity
 */
export async function getPopularKalshiMarkets(limit = 20): Promise<KalshiMarket[]> {
  const client = getKalshiPublicClient();
  const result = await client.getMarkets({ status: 'open', limit: 500 });

  // Filter for markets with actual volume and sort
  return result.markets
    .filter(m => (m.volume || 0) > 0 && (m.yes_bid > 0 || m.yes_ask > 0))
    .sort((a, b) => (b.volume || 0) - (a.volume || 0))
    .slice(0, limit);
}

/**
 * Get markets by category
 */
export async function getKalshiMarketsByCategory(
  category: 'Politics' | 'Crypto' | 'Elections' | 'Financials' | 'Sports' | 'Entertainment',
  limit = 20
): Promise<KalshiMarket[]> {
  const client = getKalshiPublicClient();

  // Get events in this category
  const events = await client.getEvents({ status: 'open', limit: 50 });
  const categoryEvents = events.events.filter(e => e.category === category);

  // Get markets for each event
  const allMarkets: KalshiMarket[] = [];
  for (const event of categoryEvents.slice(0, 10)) {
    try {
      const markets = await client.getMarkets({ event_ticker: event.event_ticker, limit: 20 });
      allMarkets.push(...markets.markets);
    } catch {
      // Skip failed events
    }
  }

  return allMarkets
    .sort((a, b) => (b.volume || 0) - (a.volume || 0))
    .slice(0, limit);
}

/**
 * Get markets for a specific event
 */
export async function getKalshiEventMarkets(eventTicker: string): Promise<KalshiMarket[]> {
  const client = getKalshiPublicClient();
  const result = await client.getMarkets({ event_ticker: eventTicker, limit: 50 });
  return result.markets;
}

export async function getKalshiMarket(ticker: string): Promise<KalshiMarket | null> {
  try {
    const client = getKalshiPublicClient();
    const result = await client.getMarket(ticker);
    return result.market;
  } catch {
    return null;
  }
}

export async function getKalshiEvents(limit = 20): Promise<KalshiEvent[]> {
  const client = getKalshiPublicClient();
  const result = await client.getEvents({ status: 'open', limit });
  return result.events;
}

/**
 * Get events by category
 */
export async function getKalshiEventsByCategory(
  category: 'Politics' | 'Crypto' | 'Elections' | 'Financials' | 'Sports' | 'Entertainment',
  limit = 20
): Promise<KalshiEvent[]> {
  const client = getKalshiPublicClient();
  const result = await client.getEvents({ status: 'open', limit: 100 });
  return result.events.filter(e => e.category === category).slice(0, limit);
}

export async function getKalshiTrades(ticker?: string, limit = 50): Promise<KalshiTrade[]> {
  const client = getKalshiPublicClient();
  const result = await client.getTrades({ ticker, limit });
  return result.trades;
}

export async function getKalshiExchangeStatus(): Promise<KalshiExchangeStatus> {
  const client = getKalshiPublicClient();
  return client.getExchangeStatus();
}

/**
 * Search markets by keyword - searches across more markets for better results
 */
export async function searchKalshiMarkets(query: string, limit = 20): Promise<KalshiMarket[]> {
  const client = getKalshiPublicClient();

  // First search events to find relevant ones
  const events = await client.getEvents({ status: 'open', limit: 100 });
  const queryLower = query.toLowerCase();

  const matchingEvents = events.events.filter(e =>
    e.title?.toLowerCase().includes(queryLower) ||
    e.category?.toLowerCase().includes(queryLower)
  );

  // Get markets from matching events
  const allMarkets: KalshiMarket[] = [];
  for (const event of matchingEvents.slice(0, 10)) {
    try {
      const markets = await client.getMarkets({ event_ticker: event.event_ticker, limit: 20 });
      allMarkets.push(...markets.markets);
    } catch {
      // Skip
    }
  }

  // Also search markets directly
  const directMarkets = await client.getMarkets({ status: 'open', limit: 200 });
  const matchingDirect = directMarkets.markets.filter(m =>
    m.title?.toLowerCase().includes(queryLower) ||
    m.subtitle?.toLowerCase().includes(queryLower) ||
    m.ticker?.toLowerCase().includes(queryLower)
  );

  // Combine and dedupe
  const combined = [...allMarkets, ...matchingDirect];
  const seen = new Set<string>();
  const unique = combined.filter(m => {
    if (seen.has(m.ticker)) return false;
    seen.add(m.ticker);
    return true;
  });

  return unique
    .sort((a, b) => (b.volume || 0) - (a.volume || 0))
    .slice(0, limit);
}

// ============================================
// CONVENIENCE EXPORTS (Private Data - Demo/Production)
// ============================================

export async function getKalshiBalance(): Promise<KalshiBalance | null> {
  const client = getKalshiClient();
  if (!client) return null;
  return client.getBalance();
}

export async function getKalshiPositions(): Promise<KalshiPosition[]> {
  const client = getKalshiClient();
  if (!client) return [];
  const result = await client.getPositions();
  return result?.positions || [];
}

export async function getKalshiOrders(): Promise<KalshiOrder[]> {
  const client = getKalshiClient();
  if (!client) return [];
  const result = await client.getOrders();
  return result?.orders || [];
}

export async function placeKalshiOrder(
  ticker: string,
  side: 'yes' | 'no',
  action: 'buy' | 'sell',
  count: number,
  yesPrice?: number
): Promise<KalshiOrder | null> {
  const client = getKalshiClient();
  if (!client) return null;

  const result = await client.placeOrder({
    ticker,
    side,
    action,
    count,
    type: yesPrice ? 'limit' : 'market',
    yes_price: yesPrice,
  });

  return result.order;
}

export async function cancelKalshiOrder(orderId: string): Promise<boolean> {
  const client = getKalshiClient();
  if (!client) return false;

  try {
    await client.cancelOrder(orderId);
    return true;
  } catch {
    return false;
  }
}

// ============================================
// SUMMARY OF PUBLIC ENDPOINTS
// ============================================
/*
PUBLIC ENDPOINTS (No Auth - Production Data):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXCHANGE:
  GET /exchange/status         - Exchange operational status
  GET /exchange/announcements  - Exchange-wide announcements
  GET /exchange/schedule       - Trading hours

MARKETS:
  GET /markets                 - List markets (filterable)
  GET /markets/{ticker}        - Single market details
  GET /markets/trades          - Historical trades
  GET /markets/candlesticks    - OHLCV candlestick data

EVENTS:
  GET /events                  - List events
  GET /events/{event_ticker}   - Single event details

SERIES:
  GET /series                  - List series
  GET /series/{series_ticker}  - Single series details

PRIVATE ENDPOINTS (Auth Required - Demo):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PORTFOLIO:
  GET /portfolio/balance       - Account balance
  GET /portfolio/positions     - Open positions
  GET /portfolio/orders        - Order history
  GET /portfolio/fills         - Trade fills

TRADING:
  POST /portfolio/orders       - Place order
  DELETE /portfolio/orders/:id - Cancel order
  POST /portfolio/orders/:id/amend - Modify order

ORDERBOOK:
  GET /markets/{ticker}/orderbook - Live orderbook (auth required)
*/
