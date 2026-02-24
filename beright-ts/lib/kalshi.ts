/**
 * Kalshi API Client - Full Feature Implementation
 *
 * FEATURES:
 * 1. Public API (no auth) - Real production market data
 * 2. Private API (auth required) - Trading on demo or production
 * 3. WebSocket real-time data streaming
 * 4. Settlement and payout tracking
 * 5. Batch order operations
 * 6. Full orderbook support
 *
 * Authentication: RSA-SHA256 with PSS padding
 * Docs: https://docs.kalshi.com
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

// ============================================
// API CONFIGURATION
// ============================================

// Production API for PUBLIC data (no auth needed)
const KALSHI_PUBLIC_API = 'https://api.elections.kalshi.com/trade-api/v2';

// Demo API for PRIVATE endpoints (trading with demo credentials)
const KALSHI_DEMO_API = 'https://demo-api.kalshi.co/trade-api/v2';

// Production API for PRIVATE endpoints (real trading)
const KALSHI_PROD_API = 'https://api.elections.kalshi.com/trade-api/v2';

// WebSocket URLs
const KALSHI_WS_PROD = 'wss://api.elections.kalshi.com/trade-api/ws/v2';
const KALSHI_WS_DEMO = 'wss://demo-api.kalshi.co/trade-api/ws/v2';

// ============================================
// TYPES
// ============================================

export interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  title: string;
  subtitle: string;
  status: 'open' | 'closed' | 'settled';
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
  result?: 'yes' | 'no' | null;
  category?: string;
  // Fixed-point fields (dollar-denominated)
  yes_bid_fp?: string;
  yes_ask_fp?: string;
  no_bid_fp?: string;
  no_ask_fp?: string;
  last_price_fp?: string;
  // Fractional trading
  fractional_trading_enabled?: boolean;
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
  balance: number; // In cents
  available_balance?: number;
  payout_balance?: number;
  portfolio_value?: number;
  // Fixed-point (dollar) versions
  balance_fp?: string;
  available_balance_fp?: string;
  payout_balance_fp?: string;
  portfolio_value_fp?: string;
}

export interface KalshiPosition {
  market_ticker: string;
  position: number; // Positive = YES, Negative = NO
  position_fp?: string;
  total_traded: number;
  resting_order_count: number;
  average_price: number;
  // Settlement info
  settlement_status?: 'unsettled' | 'settled';
  settlement_value?: number;
  realized_pnl?: number;
}

export interface KalshiOrder {
  order_id: string;
  client_order_id?: string;
  market_ticker: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  count: number;
  count_fp?: string;
  remaining_count?: number;
  type: 'limit';
  yes_price: number;
  no_price?: number;
  status: 'resting' | 'canceled' | 'executed' | 'pending';
  created_time: string;
  updated_time?: string;
  expiration_time?: string;
  // Subaccount support
  subaccount_number?: number;
}

export interface KalshiFill {
  trade_id: string;
  order_id: string;
  market_ticker: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  count: number;
  yes_price: number;
  no_price: number;
  is_taker: boolean;
  created_time: string;
  // Fee info
  fee?: number;
}

export interface KalshiOrderbook {
  ticker: string;
  orderbook: {
    yes: [number, number][]; // [price, quantity][]
    no: [number, number][];
  };
  // L1 data
  yes_bid?: number;
  yes_ask?: number;
  yes_bid_size?: number;
  yes_ask_size?: number;
}

export interface KalshiSettlement {
  market_ticker: string;
  position: number;
  settlement_value: number; // Amount won/lost in cents
  result: 'yes' | 'no';
  settled_time: string;
}

// Batch order types
export interface KalshiBatchOrderRequest {
  ticker: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  count: number;
  yes_price: number;
  client_order_id?: string;
}

export interface KalshiBatchOrderResponse {
  orders: KalshiOrder[];
  failed_orders?: {
    index: number;
    error: string;
  }[];
}

// WebSocket message types
export interface KalshiWSMessage {
  type: string;
  sid?: number;
  msg?: any;
}

export interface KalshiTickerUpdate {
  ticker: string;
  yes_bid: number;
  yes_ask: number;
  yes_bid_size_fp?: string;
  yes_ask_size_fp?: string;
  last_price: number;
  last_trade_size_fp?: string;
  volume: number;
  ts: number;
}

export interface KalshiOrderbookDelta {
  ticker: string;
  side: 'yes' | 'no';
  price: number;
  delta: number; // Change in quantity
}

export interface KalshiUserOrderUpdate {
  order: KalshiOrder;
  action: 'place' | 'cancel' | 'fill' | 'amend';
}

export interface KalshiUserFillUpdate {
  fill: KalshiFill;
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
    period_interval: 1 | 60 | 1440; // 1 min, 1 hour, 1 day
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
  public isDemo: boolean;

  constructor(config: KalshiPrivateConfig) {
    this.apiKey = config.apiKey;
    this.privateKeyPem = config.privateKeyPem;
    this.isDemo = config.useDemo ?? false;
    this.baseUrl = this.isDemo ? KALSHI_DEMO_API : KALSHI_PROD_API;
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

  getAuthHeaders(): { apiKey: string; timestamp: string; signature: string } {
    const timestamp = Date.now().toString();
    const signature = this.signRequest(timestamp, 'GET', '/');
    return { apiKey: this.apiKey, timestamp, signature };
  }

  // ========== PORTFOLIO ==========

  async getBalance(): Promise<KalshiBalance> {
    return this.request('GET', '/portfolio/balance');
  }

  async getPositions(params?: {
    limit?: number;
    cursor?: string;
    settlement_status?: 'unsettled' | 'settled';
    event_ticker?: string;
  }): Promise<{ positions: KalshiPosition[]; cursor?: string }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.settlement_status) query.set('settlement_status', params.settlement_status);
    if (params?.event_ticker) query.set('event_ticker', params.event_ticker);
    const queryStr = query.toString();
    return this.request('GET', `/portfolio/positions${queryStr ? `?${queryStr}` : ''}`);
  }

  async getOrders(params?: {
    limit?: number;
    cursor?: string;
    status?: 'resting' | 'canceled' | 'executed' | 'pending';
    ticker?: string;
    event_ticker?: string;
  }): Promise<{ orders: KalshiOrder[]; cursor?: string }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.status) query.set('status', params.status);
    if (params?.ticker) query.set('ticker', params.ticker);
    if (params?.event_ticker) query.set('event_ticker', params.event_ticker);
    const queryStr = query.toString();
    return this.request('GET', `/portfolio/orders${queryStr ? `?${queryStr}` : ''}`);
  }

  async getOrder(orderId: string): Promise<{ order: KalshiOrder }> {
    return this.request('GET', `/portfolio/orders/${orderId}`);
  }

  async getFills(params?: {
    limit?: number;
    cursor?: string;
    ticker?: string;
    order_id?: string;
    min_ts?: number;
    max_ts?: number;
  }): Promise<{ fills: KalshiFill[]; cursor?: string }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.ticker) query.set('ticker', params.ticker);
    if (params?.order_id) query.set('order_id', params.order_id);
    if (params?.min_ts) query.set('min_ts', params.min_ts.toString());
    if (params?.max_ts) query.set('max_ts', params.max_ts.toString());
    const queryStr = query.toString();
    return this.request('GET', `/portfolio/fills${queryStr ? `?${queryStr}` : ''}`);
  }

  async getSettlements(params?: {
    limit?: number;
    cursor?: string;
    min_ts?: number;
    max_ts?: number;
  }): Promise<{ settlements: KalshiSettlement[]; cursor?: string }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.min_ts) query.set('min_ts', params.min_ts.toString());
    if (params?.max_ts) query.set('max_ts', params.max_ts.toString());
    const queryStr = query.toString();
    return this.request('GET', `/portfolio/settlements${queryStr ? `?${queryStr}` : ''}`);
  }

  // ========== TRADING ==========

  async placeOrder(params: {
    ticker: string;
    side: 'yes' | 'no';
    action: 'buy' | 'sell';
    count: number;
    type: 'limit';
    yes_price: number; // 1-99 cents
    client_order_id?: string;
    expiration_time?: string; // ISO timestamp for GTD orders
  }): Promise<{ order: KalshiOrder }> {
    return this.request('POST', '/portfolio/orders', params);
  }

  async placeBatchOrders(orders: KalshiBatchOrderRequest[]): Promise<KalshiBatchOrderResponse> {
    return this.request('POST', '/portfolio/orders/batched', { orders });
  }

  async cancelOrder(orderId: string): Promise<{ order: KalshiOrder }> {
    return this.request('DELETE', `/portfolio/orders/${orderId}`);
  }

  async cancelAllOrders(params?: {
    ticker?: string;
    event_ticker?: string;
  }): Promise<{ canceled_count: number }> {
    const query = new URLSearchParams();
    if (params?.ticker) query.set('ticker', params.ticker);
    if (params?.event_ticker) query.set('event_ticker', params.event_ticker);
    const queryStr = query.toString();
    return this.request('DELETE', `/portfolio/orders${queryStr ? `?${queryStr}` : ''}`);
  }

  async amendOrder(orderId: string, params: {
    count?: number;
    yes_price?: number;
  }): Promise<{ order: KalshiOrder }> {
    return this.request('PATCH', `/portfolio/orders/${orderId}`, params);
  }

  // ========== ORDERBOOK ==========

  async getOrderbook(ticker: string, depth?: number): Promise<KalshiOrderbook> {
    const query = depth ? `?depth=${depth}` : '';
    return this.request('GET', `/markets/${ticker}/orderbook${query}`);
  }

  // ========== ACCOUNT ==========

  async getAccountLimits(): Promise<{
    max_open_orders: number;
    max_position_size: number;
    daily_withdrawal_limit: number;
  }> {
    return this.request('GET', '/account/limits');
  }
}

// ============================================
// WEBSOCKET CLIENT (Real-time Data)
// ============================================

type KalshiWSEventType =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'ticker'
  | 'orderbook_delta'
  | 'trade'
  | 'user_order'
  | 'user_fill'
  | 'market_lifecycle';

interface KalshiWSConfig {
  apiKey: string;
  privateKeyPem: string;
  useDemo?: boolean;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

class KalshiWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: KalshiWSConfig;
  private wsUrl: string;
  private subscriptions: Map<string, Set<string>> = new Map();
  private reconnecting = false;
  private pingInterval: NodeJS.Timeout | null = null;
  private messageId = 0;

  constructor(config: KalshiWSConfig) {
    super();
    this.config = config;
    this.wsUrl = config.useDemo ? KALSHI_WS_DEMO : KALSHI_WS_PROD;
  }

  private signRequest(timestamp: string): string {
    const message = `${timestamp}GET/trade-api/ws/v2`;
    const signature = crypto.sign('sha256', Buffer.from(message), {
      key: this.config.privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_MAX_SIGN,
    });
    return signature.toString('base64');
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now().toString();
      const signature = this.signRequest(timestamp);

      // Connect with auth headers
      const headers = {
        'KALSHI-ACCESS-KEY': this.config.apiKey,
        'KALSHI-ACCESS-SIGNATURE': signature,
        'KALSHI-ACCESS-TIMESTAMP': timestamp,
      };

      // Note: Browser WebSocket doesn't support headers,
      // but Node.js ws library does
      try {
        // For Node.js environment
        const WebSocket = require('ws');
        this.ws = new WebSocket(this.wsUrl, { headers });
      } catch {
        // Fallback for browser (won't have auth)
        this.ws = new WebSocket(this.wsUrl);
      }

      this.ws!.onopen = () => {
        console.log('[Kalshi WS] Connected');
        this.emit('connected');
        this.startPing();
        resolve();
      };

      this.ws!.onclose = () => {
        console.log('[Kalshi WS] Disconnected');
        this.emit('disconnected');
        this.stopPing();
        if (this.config.autoReconnect && !this.reconnecting) {
          this.scheduleReconnect();
        }
      };

      this.ws!.onerror = (error: any) => {
        console.error('[Kalshi WS] Error:', error);
        this.emit('error', error);
        reject(error);
      };

      this.ws!.onmessage = (event: any) => {
        this.handleMessage(event.data);
      };
    });
  }

  private handleMessage(data: string) {
    try {
      const msg: KalshiWSMessage = JSON.parse(data);

      switch (msg.type) {
        case 'ticker':
          this.emit('ticker', msg.msg as KalshiTickerUpdate);
          break;
        case 'orderbook_delta':
          this.emit('orderbook_delta', msg.msg as KalshiOrderbookDelta);
          break;
        case 'trade':
          this.emit('trade', msg.msg as KalshiTrade);
          break;
        case 'user_order':
          this.emit('user_order', msg.msg as KalshiUserOrderUpdate);
          break;
        case 'user_fill':
          this.emit('user_fill', msg.msg as KalshiUserFillUpdate);
          break;
        case 'market_lifecycle':
          this.emit('market_lifecycle', msg.msg);
          break;
        case 'subscribed':
          console.log('[Kalshi WS] Subscribed:', msg.msg);
          break;
        case 'unsubscribed':
          console.log('[Kalshi WS] Unsubscribed:', msg.msg);
          break;
        case 'pong':
          // Heartbeat response
          break;
        default:
          console.log('[Kalshi WS] Unknown message type:', msg.type);
      }
    } catch (error) {
      console.error('[Kalshi WS] Failed to parse message:', error);
    }
  }

  private send(type: string, params: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    const message = {
      id: ++this.messageId,
      cmd: type,
      params,
    };
    this.ws.send(JSON.stringify(message));
  }

  // ========== SUBSCRIPTIONS ==========

  /**
   * Subscribe to real-time ticker updates for markets
   */
  subscribeTicker(tickers: string[]) {
    this.send('subscribe', {
      channels: ['ticker'],
      market_tickers: tickers,
    });
    this.trackSubscription('ticker', tickers);
  }

  /**
   * Subscribe to orderbook delta updates
   */
  subscribeOrderbook(tickers: string[]) {
    this.send('subscribe', {
      channels: ['orderbook_delta'],
      market_tickers: tickers,
    });
    this.trackSubscription('orderbook_delta', tickers);
  }

  /**
   * Subscribe to public trade feed
   */
  subscribeTrades(tickers: string[]) {
    this.send('subscribe', {
      channels: ['trade'],
      market_tickers: tickers,
    });
    this.trackSubscription('trade', tickers);
  }

  /**
   * Subscribe to user order updates (requires auth)
   */
  subscribeUserOrders(tickers?: string[]) {
    const params: any = { channels: ['user_orders'] };
    if (tickers) params.market_tickers = tickers;
    this.send('subscribe', params);
    this.trackSubscription('user_orders', tickers || ['*']);
  }

  /**
   * Subscribe to user fill updates (requires auth)
   */
  subscribeUserFills(tickers?: string[]) {
    const params: any = { channels: ['user_fills'] };
    if (tickers) params.market_tickers = tickers;
    this.send('subscribe', params);
    this.trackSubscription('user_fills', tickers || ['*']);
  }

  /**
   * Subscribe to market lifecycle events (open, close, settle)
   */
  subscribeMarketLifecycle() {
    this.send('subscribe', {
      channels: ['market_lifecycle'],
    });
    this.trackSubscription('market_lifecycle', ['*']);
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel: string, tickers?: string[]) {
    const params: any = { channels: [channel] };
    if (tickers) params.market_tickers = tickers;
    this.send('unsubscribe', params);
    this.subscriptions.delete(channel);
  }

  private trackSubscription(channel: string, tickers: string[]) {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    tickers.forEach(t => this.subscriptions.get(channel)!.add(t));
  }

  // ========== CONNECTION MANAGEMENT ==========

  private startPing() {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ cmd: 'ping' }));
      }
    }, 30000); // Ping every 30 seconds
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect() {
    this.reconnecting = true;
    const interval = this.config.reconnectInterval || 5000;
    console.log(`[Kalshi WS] Reconnecting in ${interval}ms...`);
    setTimeout(async () => {
      try {
        await this.connect();
        // Resubscribe to all channels
        this.resubscribeAll();
        this.reconnecting = false;
      } catch (error) {
        console.error('[Kalshi WS] Reconnect failed:', error);
        this.scheduleReconnect();
      }
    }, interval);
  }

  private resubscribeAll() {
    this.subscriptions.forEach((tickers, channel) => {
      const tickerArray = Array.from(tickers);
      switch (channel) {
        case 'ticker':
          this.subscribeTicker(tickerArray);
          break;
        case 'orderbook_delta':
          this.subscribeOrderbook(tickerArray);
          break;
        case 'trade':
          this.subscribeTrades(tickerArray);
          break;
        case 'user_orders':
          this.subscribeUserOrders(tickerArray[0] === '*' ? undefined : tickerArray);
          break;
        case 'user_fills':
          this.subscribeUserFills(tickerArray[0] === '*' ? undefined : tickerArray);
          break;
        case 'market_lifecycle':
          this.subscribeMarketLifecycle();
          break;
      }
    });
  }

  disconnect() {
    this.config.autoReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.stopPing();
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// ============================================
// SINGLETON INSTANCES
// ============================================

// Public client - always available, uses production
let publicClient: KalshiPublicClient | null = null;

// Private client - only if credentials configured
let privateClient: KalshiPrivateClient | null = null;

// WebSocket client - for real-time data
let wsClient: KalshiWebSocketClient | null = null;

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

/**
 * Get WebSocket client for real-time data
 */
export function getKalshiWebSocket(): KalshiWebSocketClient | null {
  if (wsClient) return wsClient;

  const apiKey = process.env.KALSHI_API_KEY;
  const apiSecret = process.env.KALSHI_API_SECRET;

  if (!apiKey || !apiSecret) {
    return null;
  }

  wsClient = new KalshiWebSocketClient({
    apiKey,
    privateKeyPem: loadPrivateKey(apiSecret),
    useDemo: process.env.KALSHI_USE_DEMO === 'true',
    autoReconnect: true,
    reconnectInterval: 5000,
  });

  return wsClient;
}

/**
 * Check if Kalshi is configured for trading
 */
export function isKalshiConfigured(): boolean {
  return !!getKalshiClient();
}

/**
 * Check if using demo mode
 */
export function isKalshiDemo(): boolean {
  return process.env.KALSHI_USE_DEMO === 'true';
}

// ============================================
// CONVENIENCE EXPORTS (Public Data - Production)
// ============================================

/**
 * Get markets - fetches more and sorts by volume for better results
 */
export async function getKalshiMarkets(limit = 20): Promise<KalshiMarket[]> {
  const client = getKalshiPublicClient();
  const result = await client.getMarkets({ status: 'open', limit: Math.max(limit * 5, 100) });
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
  const events = await client.getEvents({ status: 'open', limit: 50 });
  const categoryEvents = events.events.filter(e => e.category === category);

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

export async function getKalshiCandlesticks(
  tickers: string[],
  interval: 1 | 60 | 1440 = 60,
  hours = 24
): Promise<KalshiCandlestick[]> {
  const client = getKalshiPublicClient();
  const now = Math.floor(Date.now() / 1000);
  const start = now - (hours * 3600);
  const result = await client.getCandlesticks({
    tickers,
    period_interval: interval,
    start_ts: start,
    end_ts: now,
  });
  return result.candlesticks;
}

/**
 * Search markets by keyword
 */
export async function searchKalshiMarkets(query: string, limit = 20): Promise<KalshiMarket[]> {
  const client = getKalshiPublicClient();
  const events = await client.getEvents({ status: 'open', limit: 100 });
  const queryLower = query.toLowerCase();

  const matchingEvents = events.events.filter(e =>
    e.title?.toLowerCase().includes(queryLower) ||
    e.category?.toLowerCase().includes(queryLower)
  );

  const allMarkets: KalshiMarket[] = [];
  for (const event of matchingEvents.slice(0, 10)) {
    try {
      const markets = await client.getMarkets({ event_ticker: event.event_ticker, limit: 20 });
      allMarkets.push(...markets.markets);
    } catch {
      // Skip
    }
  }

  const directMarkets = await client.getMarkets({ status: 'open', limit: 200 });
  const matchingDirect = directMarkets.markets.filter(m =>
    m.title?.toLowerCase().includes(queryLower) ||
    m.subtitle?.toLowerCase().includes(queryLower) ||
    m.ticker?.toLowerCase().includes(queryLower)
  );

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
// CONVENIENCE EXPORTS (Private Data - Trading)
// ============================================

export async function getKalshiBalance(): Promise<KalshiBalance | null> {
  const client = getKalshiClient();
  if (!client) return null;
  return client.getBalance();
}

export async function getKalshiPositions(settled = false): Promise<KalshiPosition[]> {
  const client = getKalshiClient();
  if (!client) return [];
  const result = await client.getPositions({
    settlement_status: settled ? 'settled' : 'unsettled',
  });
  return result?.positions || [];
}

export async function getKalshiOrders(status?: 'resting' | 'executed' | 'canceled'): Promise<KalshiOrder[]> {
  const client = getKalshiClient();
  if (!client) return [];
  const result = await client.getOrders({ status });
  return result?.orders || [];
}

export async function getKalshiFills(limit = 50): Promise<KalshiFill[]> {
  const client = getKalshiClient();
  if (!client) return [];
  const result = await client.getFills({ limit });
  return result?.fills || [];
}

export async function getKalshiSettlements(limit = 50): Promise<KalshiSettlement[]> {
  const client = getKalshiClient();
  if (!client) return [];
  const result = await client.getSettlements({ limit });
  return result?.settlements || [];
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
  count: number,
  yesPrice: number,
  clientOrderId?: string
): Promise<KalshiOrder | null> {
  const client = getKalshiClient();
  if (!client) return null;

  if (yesPrice < 1 || yesPrice > 99) {
    throw new Error('yes_price must be between 1 and 99 cents');
  }

  const result = await client.placeOrder({
    ticker,
    side,
    action,
    count,
    type: 'limit',
    yes_price: yesPrice,
    client_order_id: clientOrderId,
  });

  return result.order;
}

export async function placeBatchKalshiOrders(
  orders: KalshiBatchOrderRequest[]
): Promise<KalshiBatchOrderResponse | null> {
  const client = getKalshiClient();
  if (!client) return null;

  // Validate all prices
  for (const order of orders) {
    if (order.yes_price < 1 || order.yes_price > 99) {
      throw new Error(`yes_price must be between 1 and 99 cents for ${order.ticker}`);
    }
  }

  return client.placeBatchOrders(orders);
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

export async function cancelAllKalshiOrders(ticker?: string): Promise<number> {
  const client = getKalshiClient();
  if (!client) return 0;

  const result = await client.cancelAllOrders({ ticker });
  return result.canceled_count;
}

export async function amendKalshiOrder(
  orderId: string,
  newCount?: number,
  newPrice?: number
): Promise<KalshiOrder | null> {
  const client = getKalshiClient();
  if (!client) return null;

  const params: { count?: number; yes_price?: number } = {};
  if (newCount !== undefined) params.count = newCount;
  if (newPrice !== undefined) {
    if (newPrice < 1 || newPrice > 99) {
      throw new Error('yes_price must be between 1 and 99 cents');
    }
    params.yes_price = newPrice;
  }

  const result = await client.amendOrder(orderId, params);
  return result.order;
}

// ============================================
// PORTFOLIO ANALYTICS
// ============================================

export interface KalshiPortfolioSummary {
  balance: {
    total: number; // In dollars
    available: number;
    inPositions: number;
    pendingSettlement: number;
  };
  positions: {
    open: number;
    total_value: number;
    unrealized_pnl: number;
  };
  orders: {
    resting: number;
    pending_value: number;
  };
  history: {
    total_trades: number;
    realized_pnl: number;
    win_rate: number;
  };
  isDemo: boolean;
}

export async function getKalshiPortfolioSummary(): Promise<KalshiPortfolioSummary | null> {
  const client = getKalshiClient();
  if (!client) return null;

  const [balance, positions, restingOrders, fills, settlements] = await Promise.all([
    client.getBalance(),
    client.getPositions({ settlement_status: 'unsettled' }),
    client.getOrders({ status: 'resting' }),
    client.getFills({ limit: 100 }),
    client.getSettlements({ limit: 100 }),
  ]);

  // Calculate position value
  let positionValue = 0;
  for (const pos of positions.positions) {
    positionValue += Math.abs(pos.position) * (pos.average_price / 100);
  }

  // Calculate resting order value
  let restingValue = 0;
  for (const order of restingOrders.orders) {
    const remaining = order.remaining_count ?? order.count;
    restingValue += remaining * ((order.yes_price || 0) / 100);
  }

  // Calculate realized PnL from settlements
  let realizedPnl = 0;
  let wins = 0;
  for (const settlement of settlements.settlements) {
    realizedPnl += settlement.settlement_value / 100;
    if (settlement.settlement_value > 0) wins++;
  }

  const totalSettlements = settlements.settlements.length;
  const winRate = totalSettlements > 0 ? wins / totalSettlements : 0;

  return {
    balance: {
      total: (balance.balance || 0) / 100,
      available: (balance.available_balance || balance.balance || 0) / 100,
      inPositions: positionValue,
      pendingSettlement: (balance.payout_balance || 0) / 100,
    },
    positions: {
      open: positions.positions.length,
      total_value: positionValue,
      unrealized_pnl: 0, // Would need current prices to calculate
    },
    orders: {
      resting: restingOrders.orders.length,
      pending_value: restingValue,
    },
    history: {
      total_trades: fills.fills.length,
      realized_pnl: realizedPnl,
      win_rate: winRate,
    },
    isDemo: client.isDemo,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Build Kalshi market URL
 */
export function buildKalshiUrl(market: KalshiMarket): string {
  const eventTicker = market.event_ticker || market.ticker;
  const cleanTicker = eventTicker
    .replace(/-\d{1,2}[A-Z]{3}\d{2}$/, '')
    .replace(/-\d+$/, '')
    .toLowerCase();
  return `https://kalshi.com/markets/${cleanTicker}`;
}

/**
 * Format price from cents to dollars
 */
export function formatKalshiPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Format probability from cents
 */
export function formatKalshiProbability(cents: number): string {
  return `${cents}%`;
}

/**
 * Calculate cost of buying contracts
 */
export function calculateKalshiCost(
  side: 'yes' | 'no',
  contracts: number,
  price: number // In cents
): number {
  // Cost in cents
  const costPerContract = side === 'yes' ? price : 100 - price;
  return contracts * costPerContract;
}

/**
 * Calculate potential profit
 */
export function calculateKalshiProfit(
  side: 'yes' | 'no',
  contracts: number,
  entryPrice: number // In cents
): { if_win: number; if_lose: number } {
  const cost = calculateKalshiCost(side, contracts, entryPrice);
  const payout = contracts * 100; // $1 per contract if correct

  return {
    if_win: payout - cost, // Profit in cents
    if_lose: -cost, // Loss in cents
  };
}

// ============================================
// EXPORTS
// ============================================

export {
  KalshiPublicClient,
  KalshiPrivateClient,
  KalshiWebSocketClient,
};
