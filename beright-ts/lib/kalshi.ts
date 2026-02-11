/**
 * Kalshi API Client
 * Authenticated API access for trading on Kalshi
 *
 * Authentication: RSA-SHA256 with PSS padding
 * Docs: https://docs.kalshi.com
 */

import * as crypto from 'crypto';

// Kalshi API Configuration
const KALSHI_API_BASE = 'https://api.elections.kalshi.com/trade-api/v2';
const KALSHI_DEMO_API_BASE = 'https://demo-api.kalshi.co/trade-api/v2';

interface KalshiConfig {
  apiKey: string;
  privateKeyPem: string;  // PEM format private key
  useDemo?: boolean;
}

// ============================================
// TYPES (Updated for new API format)
// ============================================

interface KalshiMarket {
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
  open_interest: number;
  close_time: string;
  result?: string;
  // New fixed-point fields
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  last_price_dollars?: string;
}

interface KalshiEvent {
  event_ticker: string;
  title: string;
  category: string;
  subtitle: string;
  mutually_exclusive: boolean;
  markets: KalshiMarket[];
}

interface KalshiSeries {
  series_ticker: string;
  title: string;
  category: string;
}

interface KalshiBalance {
  balance: number;
  available_balance: number;
  payout_balance: number;
  // New fixed-point fields
  balance_dollars?: string;
  available_balance_dollars?: string;
}

interface KalshiPosition {
  market_ticker: string;
  position: number;
  position_fp?: string;  // Fixed-point contracts
  total_traded: number;
  resting_order_count: number;
  average_price: number;
}

interface KalshiOrder {
  order_id: string;
  client_order_id?: string;
  market_ticker: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  count: number;
  count_fp?: string;  // Fixed-point contracts
  type: 'limit' | 'market';
  yes_price?: number;
  no_price?: number;
  status: string;
  created_time: string;
}

// Orderbook is arrays of [price, quantity] tuples
interface KalshiOrderbook {
  orderbook: {
    yes: [number, number][];  // [price_cents, quantity][]
    no: [number, number][];
  };
}

interface PlaceOrderParams {
  ticker: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  count: number;
  type: 'limit' | 'market';
  yesPrice?: number;  // In cents (1-99)
  clientOrderId?: string;
}

// ============================================
// KALSHI CLIENT
// ============================================

export class KalshiClient {
  private apiKey: string;
  private privateKeyPem: string;
  private baseUrl: string;

  constructor(config: KalshiConfig) {
    this.apiKey = config.apiKey;
    this.privateKeyPem = config.privateKeyPem;
    this.baseUrl = config.useDemo ? KALSHI_DEMO_API_BASE : KALSHI_API_BASE;
  }

  /**
   * Generate RSA-PSS signature for API request
   * Per Kalshi docs: sign(timestamp + method + pathWithoutQuery)
   */
  private signRequest(timestamp: string, method: string, path: string): string {
    // Strip query parameters from path before signing
    const pathWithoutQuery = path.split('?')[0];

    // Message format: timestamp + method + path (NO body)
    const message = `${timestamp}${method.toUpperCase()}${pathWithoutQuery}`;

    // Sign with RSA-SHA256 using PSS padding
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(message);
    sign.end();

    // Use PSS padding with salt length equal to digest length
    const signature = sign.sign({
      key: this.privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    });

    return signature.toString('base64');
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE' | 'PATCH',
    path: string,
    body?: any
  ): Promise<T> {
    // Timestamp in MILLISECONDS per Kalshi docs
    const timestamp = Date.now().toString();
    const signature = this.signRequest(timestamp, method, path);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'KALSHI-ACCESS-KEY': this.apiKey,
      'KALSHI-ACCESS-SIGNATURE': signature,
      'KALSHI-ACCESS-TIMESTAMP': timestamp,
    };

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kalshi API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  // ============================================
  // MARKET DATA (Public endpoints)
  // ============================================

  /**
   * Get exchange status
   */
  async getExchangeStatus(): Promise<{ trading_active: boolean }> {
    return this.request('GET', '/exchange/status');
  }

  /**
   * Get all series
   */
  async getSeries(params?: {
    limit?: number;
    cursor?: string;
  }): Promise<{ series: KalshiSeries[]; cursor?: string }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);
    const queryStr = query.toString();
    return this.request('GET', `/series${queryStr ? `?${queryStr}` : ''}`);
  }

  /**
   * Get all events with pagination
   */
  async getEvents(params?: {
    status?: 'open' | 'closed';
    series_ticker?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ events: KalshiEvent[]; cursor?: string }> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.series_ticker) query.set('series_ticker', params.series_ticker);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);
    const queryStr = query.toString();
    return this.request('GET', `/events${queryStr ? `?${queryStr}` : ''}`);
  }

  /**
   * Get specific event
   */
  async getEvent(eventTicker: string): Promise<{ event: KalshiEvent }> {
    return this.request('GET', `/events/${eventTicker}`);
  }

  /**
   * Get all markets with pagination
   */
  async getMarkets(params?: {
    status?: 'open' | 'closed' | 'settled';
    event_ticker?: string;
    series_ticker?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ markets: KalshiMarket[]; cursor?: string }> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.event_ticker) query.set('event_ticker', params.event_ticker);
    if (params?.series_ticker) query.set('series_ticker', params.series_ticker);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);
    const queryStr = query.toString();
    return this.request('GET', `/markets${queryStr ? `?${queryStr}` : ''}`);
  }

  /**
   * Get all markets for a series with pagination support
   */
  async getAllMarketsForSeries(seriesTicker: string): Promise<KalshiMarket[]> {
    const allMarkets: KalshiMarket[] = [];
    let cursor: string | undefined;

    while (true) {
      const result = await this.getMarkets({
        series_ticker: seriesTicker,
        limit: 100,
        cursor,
      });

      allMarkets.push(...result.markets);
      cursor = result.cursor;

      if (!cursor) break;
    }

    return allMarkets;
  }

  /**
   * Get specific market
   */
  async getMarket(ticker: string): Promise<{ market: KalshiMarket }> {
    return this.request('GET', `/markets/${ticker}`);
  }

  /**
   * Get market orderbook
   * Returns arrays of [price, quantity] tuples
   */
  async getOrderbook(ticker: string, depth?: number): Promise<KalshiOrderbook> {
    const query = depth ? `?depth=${depth}` : '';
    return this.request('GET', `/markets/${ticker}/orderbook${query}`);
  }

  /**
   * Get market trades
   */
  async getMarketTrades(ticker: string, params?: {
    limit?: number;
    cursor?: string;
  }): Promise<{ trades: any[]; cursor?: string }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);
    const queryStr = query.toString();
    return this.request('GET', `/markets/${ticker}/trades${queryStr ? `?${queryStr}` : ''}`);
  }

  // ============================================
  // ACCOUNT & PORTFOLIO
  // ============================================

  /**
   * Get account balance
   */
  async getBalance(): Promise<KalshiBalance> {
    return this.request('GET', '/portfolio/balance');
  }

  /**
   * Get portfolio positions
   */
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

  /**
   * Get specific position
   */
  async getPosition(ticker: string): Promise<{ position: KalshiPosition }> {
    return this.request('GET', `/portfolio/positions/${ticker}`);
  }

  /**
   * Get portfolio history
   */
  async getPortfolioHistory(params?: {
    limit?: number;
    cursor?: string;
  }): Promise<{ history: any[]; cursor?: string }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);
    const queryStr = query.toString();
    return this.request('GET', `/portfolio/history${queryStr ? `?${queryStr}` : ''}`);
  }

  // ============================================
  // TRADING
  // ============================================

  /**
   * Place an order
   */
  async placeOrder(params: PlaceOrderParams): Promise<{ order: KalshiOrder }> {
    const body: any = {
      ticker: params.ticker,
      side: params.side,
      action: params.action,
      count: params.count,
      type: params.type,
    };

    if (params.type === 'limit' && params.yesPrice !== undefined) {
      body.yes_price = params.yesPrice;
    }

    if (params.clientOrderId) {
      body.client_order_id = params.clientOrderId;
    }

    return this.request('POST', '/portfolio/orders', body);
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<{ order: KalshiOrder }> {
    return this.request('DELETE', `/portfolio/orders/${orderId}`);
  }

  /**
   * Amend an order
   */
  async amendOrder(orderId: string, params: {
    count?: number;
    yes_price?: number;
  }): Promise<{ order: KalshiOrder }> {
    return this.request('PATCH', `/portfolio/orders/${orderId}`, params);
  }

  /**
   * Get all orders
   */
  async getOrders(params?: {
    ticker?: string;
    status?: 'resting' | 'pending' | 'executed' | 'canceled';
    limit?: number;
    cursor?: string;
  }): Promise<{ orders: KalshiOrder[]; cursor?: string }> {
    const query = new URLSearchParams();
    if (params?.ticker) query.set('ticker', params.ticker);
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);
    const queryStr = query.toString();
    return this.request('GET', `/portfolio/orders${queryStr ? `?${queryStr}` : ''}`);
  }

  /**
   * Get fills (executed trades)
   */
  async getFills(params?: {
    ticker?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ fills: any[]; cursor?: string }> {
    const query = new URLSearchParams();
    if (params?.ticker) query.set('ticker', params.ticker);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);
    const queryStr = query.toString();
    return this.request('GET', `/portfolio/fills${queryStr ? `?${queryStr}` : ''}`);
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Parse orderbook into best bid/ask
   */
  parseOrderbook(orderbook: KalshiOrderbook): {
    bestYesBid: number;
    bestYesAsk: number;
    bestNoBid: number;
    bestNoAsk: number;
    spread: number;
  } {
    const yesOrders = orderbook.orderbook.yes;
    const noOrders = orderbook.orderbook.no;

    // Best bids are last in sorted arrays (highest price)
    const bestYesBid = yesOrders.length > 0 ? yesOrders[yesOrders.length - 1][0] : 0;
    const bestNoBid = noOrders.length > 0 ? noOrders[noOrders.length - 1][0] : 0;

    // Best asks are implied from opposite side (100 - best bid)
    const bestYesAsk = bestNoBid > 0 ? 100 - bestNoBid : 100;
    const bestNoAsk = bestYesBid > 0 ? 100 - bestYesBid : 100;

    const spread = bestYesAsk - bestYesBid;

    return { bestYesBid, bestYesAsk, bestNoBid, bestNoAsk, spread };
  }

  /**
   * Buy YES contracts (limit order)
   */
  async buyYes(ticker: string, contracts: number, priceInCents: number): Promise<{ order: KalshiOrder }> {
    return this.placeOrder({
      ticker,
      side: 'yes',
      action: 'buy',
      count: contracts,
      type: 'limit',
      yesPrice: priceInCents,
    });
  }

  /**
   * Buy NO contracts (limit order)
   */
  async buyNo(ticker: string, contracts: number, priceInCents: number): Promise<{ order: KalshiOrder }> {
    return this.placeOrder({
      ticker,
      side: 'no',
      action: 'buy',
      count: contracts,
      type: 'limit',
      yesPrice: 100 - priceInCents,
    });
  }

  /**
   * Sell YES contracts (limit order)
   */
  async sellYes(ticker: string, contracts: number, priceInCents: number): Promise<{ order: KalshiOrder }> {
    return this.placeOrder({
      ticker,
      side: 'yes',
      action: 'sell',
      count: contracts,
      type: 'limit',
      yesPrice: priceInCents,
    });
  }

  /**
   * Market buy (takes best available price)
   */
  async marketBuy(ticker: string, side: 'yes' | 'no', contracts: number): Promise<{ order: KalshiOrder }> {
    return this.placeOrder({
      ticker,
      side,
      action: 'buy',
      count: contracts,
      type: 'market',
    });
  }

  /**
   * Market sell (takes best available price)
   */
  async marketSell(ticker: string, side: 'yes' | 'no', contracts: number): Promise<{ order: KalshiOrder }> {
    return this.placeOrder({
      ticker,
      side,
      action: 'sell',
      count: contracts,
      type: 'market',
    });
  }
}

// ============================================
// SINGLETON & HELPERS
// ============================================

import { secrets } from './secrets';
import * as fs from 'fs';
import * as path from 'path';

let kalshiClient: KalshiClient | null = null;

/**
 * Load private key from file or string
 */
function loadPrivateKey(keyOrPath: string): string {
  // If it's already in PEM format, return as-is
  if (keyOrPath.includes('-----BEGIN')) {
    return keyOrPath;
  }

  // Try to load from file
  try {
    const resolvedPath = path.resolve(keyOrPath);
    if (fs.existsSync(resolvedPath)) {
      return fs.readFileSync(resolvedPath, 'utf8');
    }
  } catch {
    // Not a file path
  }

  // Assume it's a raw key, wrap in PEM format
  return `-----BEGIN RSA PRIVATE KEY-----\n${keyOrPath}\n-----END RSA PRIVATE KEY-----`;
}

export function getKalshiClient(): KalshiClient | null {
  if (kalshiClient) return kalshiClient;

  const credentials = secrets.getKalshiCredentials();
  if (!credentials) {
    console.warn('Kalshi API credentials not configured');
    return null;
  }

  kalshiClient = new KalshiClient({
    apiKey: credentials.apiKey,
    privateKeyPem: loadPrivateKey(credentials.apiSecret),
    useDemo: process.env.KALSHI_USE_DEMO === 'true',
  });

  return kalshiClient;
}

// ============================================
// EXPORTS FOR SKILLS
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
  return result.positions;
}

export async function getKalshiMarkets(limit = 20): Promise<KalshiMarket[]> {
  const client = getKalshiClient();
  if (!client) return [];
  const result = await client.getMarkets({ status: 'open', limit });
  return result.markets;
}

export async function getKalshiMarket(ticker: string): Promise<KalshiMarket | null> {
  const client = getKalshiClient();
  if (!client) return null;
  const result = await client.getMarket(ticker);
  return result.market;
}

export async function getKalshiOrderbook(ticker: string): Promise<KalshiOrderbook | null> {
  const client = getKalshiClient();
  if (!client) return null;
  return client.getOrderbook(ticker);
}

export async function placeKalshiOrder(
  ticker: string,
  side: 'yes' | 'no',
  action: 'buy' | 'sell',
  contracts: number,
  priceInCents?: number
): Promise<KalshiOrder | null> {
  const client = getKalshiClient();
  if (!client) return null;

  const result = await client.placeOrder({
    ticker,
    side,
    action,
    count: contracts,
    type: priceInCents ? 'limit' : 'market',
    yesPrice: priceInCents,
  });

  return result.order;
}

// Export types
export type {
  KalshiMarket,
  KalshiEvent,
  KalshiSeries,
  KalshiBalance,
  KalshiPosition,
  KalshiOrder,
  KalshiOrderbook,
};
