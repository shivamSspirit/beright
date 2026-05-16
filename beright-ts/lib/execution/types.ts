/**
 * Execution Engine Types
 *
 * Types for order execution, position tracking, and trade management.
 *
 * @author BeRight Protocol
 * @version 3.0.0 - Bloomberg Terminal Architecture
 */

import { Platform, MarketCategory } from '../dataFabric/types';

// =============================================================================
// ORDER TYPES
// =============================================================================

/**
 * Order side
 */
export type OrderSide = 'YES' | 'NO';

/**
 * Order type
 */
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';

/**
 * Order status
 */
export type OrderStatus =
  | 'PENDING'      // Not yet submitted
  | 'SUBMITTED'    // Sent to exchange
  | 'OPEN'         // Active on orderbook
  | 'PARTIAL'      // Partially filled
  | 'FILLED'       // Fully executed
  | 'CANCELLED'    // User cancelled
  | 'REJECTED'     // Exchange rejected
  | 'EXPIRED'      // Time expired
  | 'FAILED';      // Execution failed

/**
 * Time in force
 */
export type TimeInForce =
  | 'GTC'    // Good til cancelled
  | 'IOC'    // Immediate or cancel
  | 'FOK'    // Fill or kill
  | 'GTD';   // Good til date

/**
 * Order request (what user submits)
 */
export interface OrderRequest {
  // Market identification
  marketId: string;
  platform: Platform;

  // Order details
  side: OrderSide;
  type: OrderType;
  size: number;           // Amount in shares/contracts
  price?: number;         // Required for LIMIT orders (0-1)
  stopPrice?: number;     // Required for STOP orders

  // Execution preferences
  timeInForce?: TimeInForce;
  expiresAt?: Date;
  reduceOnly?: boolean;   // Only reduce existing position

  // Risk limits
  maxSlippage?: number;   // Max acceptable slippage (0-1)

  // Metadata
  clientOrderId?: string;
  source?: string;        // 'manual' | 'signal' | 'strategy'
  notes?: string;
}

/**
 * Order (full order with status)
 */
export interface Order extends OrderRequest {
  // IDs
  id: string;
  platformOrderId?: string;

  // Status
  status: OrderStatus;
  statusMessage?: string;

  // Execution
  filledSize: number;
  remainingSize: number;
  avgFillPrice?: number;
  fees?: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  submittedAt?: Date;
  filledAt?: Date;
  cancelledAt?: Date;

  // Position link
  positionId?: string;

  // On-chain execution (Solana/DFlow)
  txSignature?: string;
}

/**
 * Order fill event
 */
export interface OrderFill {
  orderId: string;
  fillId: string;
  size: number;
  price: number;
  fees: number;
  timestamp: Date;
}

// =============================================================================
// POSITION TYPES
// =============================================================================

/**
 * Position status
 */
export type PositionStatus = 'OPEN' | 'CLOSED' | 'LIQUIDATED';

/**
 * Position in a market
 */
export interface Position {
  // Identification
  id: string;
  marketId: string;
  platform: Platform;

  // Market info (cached)
  marketQuestion: string;
  marketCategory: MarketCategory;
  marketCloseDate?: Date;

  // Position details
  side: OrderSide;
  size: number;           // Current position size
  avgEntryPrice: number;  // Volume-weighted average entry
  currentPrice: number;   // Latest market price

  // P&L
  unrealizedPnL: number;  // (current - entry) * size
  unrealizedPnLPct: number;
  realizedPnL: number;    // From closed portions
  totalFees: number;

  // Risk
  costBasis: number;      // Total capital deployed
  maxLoss: number;        // Maximum possible loss
  maxGain: number;        // Maximum possible gain

  // Status
  status: PositionStatus;

  // Timestamps
  openedAt: Date;
  updatedAt: Date;
  closedAt?: Date;

  // Order history
  orderIds: string[];
}

/**
 * Position summary
 */
export interface PositionSummary {
  totalPositions: number;
  openPositions: number;
  totalCostBasis: number;
  totalUnrealizedPnL: number;
  totalRealizedPnL: number;
  totalFees: number;

  // By platform
  byPlatform: Record<Platform, {
    positions: number;
    costBasis: number;
    unrealizedPnL: number;
  }>;

  // By category
  byCategory: Record<MarketCategory, {
    positions: number;
    costBasis: number;
    unrealizedPnL: number;
  }>;
}

// =============================================================================
// EXECUTION TYPES
// =============================================================================

/**
 * Execution venue info
 */
export interface ExecutionVenue {
  platform: Platform;
  available: boolean;
  fees: {
    maker: number;
    taker: number;
  };
  minOrderSize: number;
  maxOrderSize: number;
  supportsLimitOrders: boolean;
  supportsStopOrders: boolean;

  // Current market state
  bestBid?: number;
  bestAsk?: number;
  spread?: number;
  liquidity?: number;
}

/**
 * Execution quote (pre-trade estimate)
 */
export interface ExecutionQuote {
  // Request
  marketId: string;
  side: OrderSide;
  size: number;
  type: OrderType;

  // Best execution venue
  recommendedVenue: Platform;
  allVenues: ExecutionVenue[];

  // Estimated execution
  estimatedPrice: number;
  estimatedSlippage: number;
  estimatedFees: number;
  estimatedTotal: number;   // Price + slippage + fees

  // Risk metrics
  priceImpact: number;      // Impact on market price
  executionProbability: number;

  // Timing
  quotedAt: Date;
  validUntil: Date;
}

/**
 * Execution result
 */
export interface ExecutionResult {
  success: boolean;
  order?: Order;
  error?: string;

  // Execution details
  venue: Platform;
  executionPrice?: number;
  slippage?: number;
  fees?: number;

  // Timing
  latencyMs: number;

  // On-chain execution (Solana/DFlow)
  txSignature?: string;
  simulated?: boolean;
}

// =============================================================================
// CONNECTOR TYPES
// =============================================================================

/**
 * Trading connector interface (each platform implements this)
 */
export interface TradingConnector {
  readonly platform: Platform;
  readonly name: string;

  // Connection
  isConnected(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // Account
  getBalance(): Promise<ConnectorBalance>;
  getPositions(): Promise<Position[]>;

  // Market data
  getOrderbook(marketId: string): Promise<Orderbook>;
  getQuote(marketId: string, side: OrderSide, size: number): Promise<ExecutionQuote>;

  // Orders
  submitOrder(request: OrderRequest): Promise<ExecutionResult>;
  cancelOrder(orderId: string): Promise<boolean>;
  getOrder(orderId: string): Promise<Order | null>;
  getOpenOrders(): Promise<Order[]>;

  // Capabilities
  supportsOrderType(type: OrderType): boolean;
  getMinOrderSize(): number;
  getMaxOrderSize(): number;
  getFees(): { maker: number; taker: number };
}

/**
 * Connector balance
 */
export interface ConnectorBalance {
  platform: Platform;
  currency: string;        // 'USDC', 'USD', 'MANA' (Manifold)
  available: number;
  locked: number;          // In open orders
  total: number;
  updatedAt: Date;
}

/**
 * Orderbook
 */
export interface Orderbook {
  marketId: string;
  platform: Platform;
  bids: OrderbookLevel[];  // Sorted by price descending
  asks: OrderbookLevel[];  // Sorted by price ascending
  spread: number;
  midPrice: number;
  timestamp: Date;
}

/**
 * Orderbook level
 */
export interface OrderbookLevel {
  price: number;
  size: number;
  total: number;           // Cumulative size
}

// =============================================================================
// SMART ORDER ROUTER TYPES
// =============================================================================

/**
 * Routing strategy
 */
export type RoutingStrategy =
  | 'BEST_PRICE'      // Route to best price
  | 'BEST_LIQUIDITY'  // Route to deepest book
  | 'LOWEST_FEES'     // Route to lowest fees
  | 'FASTEST'         // Route to fastest execution
  | 'SPLIT'           // Split across venues
  | 'PREFER_SOLANA'   // Prefer DFlow/Solana execution
  | 'PREFER_USD';     // Prefer Kalshi USD execution

/**
 * Routing decision
 */
export interface RoutingDecision {
  strategy: RoutingStrategy;
  venues: {
    platform: Platform;
    allocation: number;    // 0-1 portion of order
    reason: string;
  }[];

  estimatedSavings: number;
  warnings: string[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate position P&L
 */
export function calculatePnL(
  side: OrderSide,
  entryPrice: number,
  currentPrice: number,
  size: number
): { unrealized: number; pct: number } {
  let unrealized: number;

  if (side === 'YES') {
    // Profit if price goes up
    unrealized = (currentPrice - entryPrice) * size;
  } else {
    // Profit if price goes down (short YES = long NO)
    unrealized = (entryPrice - currentPrice) * size;
  }

  const pct = entryPrice > 0 ? unrealized / (entryPrice * size) : 0;

  return { unrealized, pct };
}

/**
 * Calculate max loss for a position
 */
export function calculateMaxLoss(
  side: OrderSide,
  entryPrice: number,
  size: number
): number {
  if (side === 'YES') {
    // Max loss: price goes to 0
    return entryPrice * size;
  } else {
    // Max loss: price goes to 1
    return (1 - entryPrice) * size;
  }
}

/**
 * Calculate max gain for a position
 */
export function calculateMaxGain(
  side: OrderSide,
  entryPrice: number,
  size: number
): number {
  if (side === 'YES') {
    // Max gain: price goes to 1
    return (1 - entryPrice) * size;
  } else {
    // Max gain: price goes to 0
    return entryPrice * size;
  }
}

/**
 * Estimate slippage from orderbook
 */
export function estimateSlippage(
  orderbook: Orderbook,
  side: OrderSide,
  size: number
): number {
  const levels = side === 'YES' ? orderbook.asks : orderbook.bids;

  if (levels.length === 0) return 0.1; // 10% default if no data

  let remaining = size;
  let totalCost = 0;
  let executed = 0;

  for (const level of levels) {
    const fillSize = Math.min(remaining, level.size);
    totalCost += fillSize * level.price;
    executed += fillSize;
    remaining -= fillSize;

    if (remaining <= 0) break;
  }

  if (executed === 0) return 0.1;

  const avgPrice = totalCost / executed;
  const bestPrice = levels[0].price;

  return Math.abs(avgPrice - bestPrice);
}

/**
 * Generate unique order ID
 */
export function generateOrderId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ord_${timestamp}_${random}`;
}

/**
 * Generate unique position ID
 */
export function generatePositionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `pos_${timestamp}_${random}`;
}
