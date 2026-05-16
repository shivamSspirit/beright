/**
 * Kalshi API Types
 * Full type definitions for Kalshi API responses
 */

// ============================================================================
// Market Types
// ============================================================================

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

// ============================================================================
// Exchange Types
// ============================================================================

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

// ============================================================================
// Account Types
// ============================================================================

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
  market_exposure?: number;
  realized_pnl?: number;
  realized_pnl_fp?: string;
  resting_order_count?: number;
  total_traded?: number;
  fees_paid?: number;
}

// ============================================================================
// Order Types
// ============================================================================

export type OrderSide = 'yes' | 'no';
export type OrderType = 'market' | 'limit';
export type OrderAction = 'buy' | 'sell';
export type OrderStatus = 'resting' | 'canceled' | 'executed' | 'pending';
export type TimeInForce = 'gtc' | 'ioc' | 'fok';

export interface KalshiOrder {
  order_id: string;
  ticker: string;
  client_order_id?: string;
  side: OrderSide;
  action: OrderAction;
  type: OrderType;
  status: OrderStatus;
  yes_price: number;
  no_price: number;
  count: number;
  remaining_count: number;
  created_time: string;
  expiration_time?: string;
  close_cancel?: boolean;
  user_id?: string;
}

export interface KalshiOrderRequest {
  ticker: string;
  side: OrderSide;
  action: OrderAction;
  type: OrderType;
  count: number;
  yes_price?: number;
  no_price?: number;
  client_order_id?: string;
  expiration_time?: string;
  time_in_force?: TimeInForce;
  close_cancel?: boolean;
}

export interface KalshiFill {
  trade_id: string;
  order_id: string;
  ticker: string;
  side: OrderSide;
  action: OrderAction;
  yes_price: number;
  no_price: number;
  count: number;
  is_taker: boolean;
  created_time: string;
}

export interface KalshiSettlement {
  market_ticker: string;
  event_ticker: string;
  settlement_type: 'manual' | 'auto';
  settled_time: string;
  market_result: 'yes' | 'no';
  revenue: number;
  revenue_fp?: string;
  position: number;
  payout: number;
  payout_fp?: string;
}

// ============================================================================
// Orderbook Types
// ============================================================================

export interface KalshiOrderbookLevel {
  price: number;
  count: number;
}

export interface KalshiOrderbook {
  ticker: string;
  yes: KalshiOrderbookLevel[];
  no: KalshiOrderbookLevel[];
}

// ============================================================================
// API Response Types
// ============================================================================

export interface KalshiApiResponse<T> {
  cursor?: string;
  data?: T;
}

export interface KalshiMarketsResponse {
  markets: KalshiMarket[];
  cursor?: string;
}

export interface KalshiEventsResponse {
  events: KalshiEvent[];
  cursor?: string;
}

export interface KalshiPositionsResponse {
  market_positions: KalshiPosition[];
  cursor?: string;
}

export interface KalshiOrdersResponse {
  orders: KalshiOrder[];
  cursor?: string;
}

export interface KalshiFillsResponse {
  fills: KalshiFill[];
  cursor?: string;
}

export interface KalshiSettlementsResponse {
  settlements: KalshiSettlement[];
  cursor?: string;
}

// ============================================================================
// Client Configuration
// ============================================================================

export interface KalshiClientConfig {
  /** Use demo API instead of production */
  demo?: boolean;
  /** API key ID for authentication */
  apiKeyId?: string;
  /** Path to private key file */
  privateKeyPath?: string;
  /** Private key content (alternative to path) */
  privateKey?: string;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** Enable debug logging */
  debug?: boolean;
}

export interface KalshiWebSocketConfig {
  /** Use demo WebSocket instead of production */
  demo?: boolean;
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect delay in milliseconds */
  reconnectDelayMs?: number;
  /** Maximum reconnect attempts */
  maxReconnectAttempts?: number;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface KalshiMarketQuery {
  ticker?: string;
  event_ticker?: string;
  series_ticker?: string;
  status?: 'open' | 'closed' | 'settled';
  tickers?: string;
  cursor?: string;
  limit?: number;
}

export interface KalshiEventQuery {
  series_ticker?: string;
  status?: 'open' | 'closed' | 'settled';
  cursor?: string;
  limit?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert cents to dollars
 */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/**
 * Convert dollars to cents
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Format price as percentage (Kalshi uses 0-100 scale)
 */
export function formatKalshiPrice(price: number): string {
  return `${price}¢`;
}

/**
 * Calculate cost for a Kalshi order
 */
export function calculateOrderCost(
  side: OrderSide,
  action: OrderAction,
  price: number,
  count: number
): number {
  // Price is in cents (0-100)
  if (action === 'buy') {
    const effectivePrice = side === 'yes' ? price : 100 - price;
    return effectivePrice * count;
  } else {
    // Selling releases margin
    const effectivePrice = side === 'yes' ? price : 100 - price;
    return -effectivePrice * count;
  }
}

/**
 * Calculate potential profit for a Kalshi position
 */
export function calculatePotentialProfit(
  side: OrderSide,
  avgPrice: number,
  count: number
): { maxProfit: number; maxLoss: number } {
  const effectivePrice = side === 'yes' ? avgPrice : 100 - avgPrice;
  const maxProfit = (100 - effectivePrice) * count;
  const maxLoss = effectivePrice * count;

  return { maxProfit, maxLoss };
}
