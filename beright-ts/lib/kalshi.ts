/**
 * Kalshi API Client
 * Authenticated API access for trading on Kalshi
 * Uses RSA signing for API authentication
 */

import * as crypto from 'crypto';

// Kalshi API Configuration
const KALSHI_API_BASE = 'https://api.elections.kalshi.com/trade-api/v2';
const KALSHI_DEMO_API_BASE = 'https://demo-api.kalshi.co/trade-api/v2';

interface KalshiConfig {
  apiKey: string;
  privateKey: string;
  useDemo?: boolean;
}

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
}

interface KalshiEvent {
  event_ticker: string;
  title: string;
  category: string;
  subtitle: string;
  mutually_exclusive: boolean;
  markets: KalshiMarket[];
}

interface KalshiBalance {
  balance: number;
  available_balance: number;
  payout_balance: number;
}

interface KalshiPosition {
  market_ticker: string;
  position: number;
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
  type: 'limit' | 'market';
  yes_price?: number;
  no_price?: number;
  status: string;
  created_time: string;
}

interface PlaceOrderParams {
  ticker: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  count: number;
  type: 'limit' | 'market';
  yesPrice?: number; // In cents (1-99)
  clientOrderId?: string;
}

/**
 * Kalshi API Client with RSA authentication
 */
export class KalshiClient {
  private apiKey: string;
  private privateKey: string;
  private baseUrl: string;

  constructor(config: KalshiConfig) {
    this.apiKey = config.apiKey;
    this.privateKey = config.privateKey;
    this.baseUrl = config.useDemo ? KALSHI_DEMO_API_BASE : KALSHI_API_BASE;
  }

  /**
   * Generate RSA signature for API request
   */
  private sign(timestamp: string, method: string, path: string, body?: string): string {
    // Message format: timestamp + method + path + body
    const message = `${timestamp}${method.toUpperCase()}${path}${body || ''}`;

    // Sign with RSA-SHA256
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(message);
    sign.end();

    // Private key should be in PEM format
    let pemKey = this.privateKey;
    if (!pemKey.includes('-----BEGIN')) {
      // Convert raw key to PEM format
      pemKey = `-----BEGIN RSA PRIVATE KEY-----\n${pemKey}\n-----END RSA PRIVATE KEY-----`;
    }

    return sign.sign(pemKey, 'base64');
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: any
  ): Promise<T> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyStr = body ? JSON.stringify(body) : '';
    const signature = this.sign(timestamp, method, path, bodyStr);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'KALSHI-ACCESS-KEY': this.apiKey,
      'KALSHI-ACCESS-SIGNATURE': signature,
      'KALSHI-ACCESS-TIMESTAMP': timestamp,
    };

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? bodyStr : undefined,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kalshi API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  // ============================================
  // MARKET DATA
  // ============================================

  /**
   * Get all events
   */
  async getEvents(params?: {
    status?: 'open' | 'closed';
    limit?: number;
    cursor?: string;
  }): Promise<{ events: KalshiEvent[]; cursor?: string }> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
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
   * Get all markets
   */
  async getMarkets(params?: {
    status?: 'open' | 'closed' | 'settled';
    event_ticker?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ markets: KalshiMarket[]; cursor?: string }> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.event_ticker) query.set('event_ticker', params.event_ticker);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);

    const queryStr = query.toString();
    return this.request('GET', `/markets${queryStr ? `?${queryStr}` : ''}`);
  }

  /**
   * Get specific market
   */
  async getMarket(ticker: string): Promise<{ market: KalshiMarket }> {
    return this.request('GET', `/markets/${ticker}`);
  }

  /**
   * Get market orderbook
   */
  async getOrderbook(ticker: string, depth?: number): Promise<{
    orderbook: {
      yes: { price: number; quantity: number }[];
      no: { price: number; quantity: number }[];
    };
  }> {
    const query = depth ? `?depth=${depth}` : '';
    return this.request('GET', `/markets/${ticker}/orderbook${query}`);
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
   * Get portfolio summary
   */
  async getPortfolioSummary(): Promise<{
    total_value: number;
    cash_balance: number;
    positions_value: number;
    total_pnl: number;
  }> {
    const [balance, positions] = await Promise.all([
      this.getBalance(),
      this.getPositions({ limit: 100 }),
    ]);

    let positionsValue = 0;
    for (const pos of positions.positions) {
      positionsValue += pos.position * (pos.average_price / 100);
    }

    return {
      total_value: balance.balance / 100,
      cash_balance: balance.available_balance / 100,
      positions_value: positionsValue,
      total_pnl: 0, // Would need historical data
    };
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
   * Get all orders
   */
  async getOrders(params?: {
    ticker?: string;
    status?: 'resting' | 'pending' | 'executed' | 'canceled';
    limit?: number;
  }): Promise<{ orders: KalshiOrder[]; cursor?: string }> {
    const query = new URLSearchParams();
    if (params?.ticker) query.set('ticker', params.ticker);
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', params.limit.toString());

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
      yesPrice: 100 - priceInCents, // NO price is 100 - YES price
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
// SINGLETON INSTANCE
// ============================================

import { secrets } from './secrets';

let kalshiClient: KalshiClient | null = null;

export function getKalshiClient(): KalshiClient | null {
  if (kalshiClient) return kalshiClient;

  const credentials = secrets.getKalshiCredentials();
  if (!credentials) {
    console.warn('Kalshi API credentials not configured');
    return null;
  }

  kalshiClient = new KalshiClient({
    apiKey: credentials.apiKey,
    privateKey: credentials.apiSecret,
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
