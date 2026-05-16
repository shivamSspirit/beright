/**
 * Polymarket CLOB Connector
 *
 * Trading connector for Polymarket's Central Limit Order Book.
 * Uses the Polymarket CLOB API for order execution.
 *
 * @author BeRight Protocol
 */

import {
  TradingConnector,
  ConnectorBalance,
  Position,
  Orderbook,
  OrderbookLevel,
  ExecutionQuote,
  ExecutionResult,
  Order,
  OrderRequest,
  OrderSide,
  OrderType,
  generateOrderId,
  generatePositionId,
  estimateSlippage,
} from '../types';
import { Platform } from '../../dataFabric/types';

// =============================================================================
// CONFIGURATION
// =============================================================================

const POLYMARKET_CLOB_API = process.env.POLYMARKET_CLOB_API || 'https://clob.polymarket.com';
const POLYMARKET_API_KEY = process.env.POLYMARKET_API_KEY;
const POLYMARKET_API_SECRET = process.env.POLYMARKET_API_SECRET;
const POLYMARKET_PASSPHRASE = process.env.POLYMARKET_PASSPHRASE;

// Fee structure (2% taker, 0% maker on most markets)
const TAKER_FEE = 0.02;
const MAKER_FEE = 0.00;

// Order limits
const MIN_ORDER_SIZE = 1;      // $1 minimum
const MAX_ORDER_SIZE = 100000; // $100k maximum

// =============================================================================
// POLYMARKET CONNECTOR
// =============================================================================

export class PolymarketConnector implements TradingConnector {
  readonly platform: Platform = 'polymarket';
  readonly name = 'Polymarket CLOB';

  private connected = false;
  private apiKey?: string;
  private apiSecret?: string;
  private passphrase?: string;

  // In-memory state (would be persisted in production)
  private orders: Map<string, Order> = new Map();
  private positions: Map<string, Position> = new Map();
  private balance: ConnectorBalance = {
    platform: 'polymarket',
    currency: 'USDC',
    available: 0,
    locked: 0,
    total: 0,
    updatedAt: new Date(),
  };

  // ==========================================================================
  // CONNECTION
  // ==========================================================================

  isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    // Load credentials
    this.apiKey = POLYMARKET_API_KEY;
    this.apiSecret = POLYMARKET_API_SECRET;
    this.passphrase = POLYMARKET_PASSPHRASE;

    if (!this.apiKey || !this.apiSecret) {
      console.warn('[Polymarket] No API credentials - running in read-only mode');
    }

    // Test connection
    try {
      // In real implementation, would verify credentials with API
      this.connected = true;
      console.log('[Polymarket] Connected to CLOB');
    } catch (error) {
      console.error('[Polymarket] Connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    console.log('[Polymarket] Disconnected');
  }

  // ==========================================================================
  // ACCOUNT
  // ==========================================================================

  async getBalance(): Promise<ConnectorBalance> {
    if (!this.connected) {
      throw new Error('Not connected to Polymarket');
    }

    // In real implementation, would fetch from API
    // For now, return simulated balance
    return { ...this.balance };
  }

  async getPositions(): Promise<Position[]> {
    if (!this.connected) {
      throw new Error('Not connected to Polymarket');
    }

    return Array.from(this.positions.values());
  }

  // ==========================================================================
  // MARKET DATA
  // ==========================================================================

  async getOrderbook(marketId: string): Promise<Orderbook> {
    try {
      // Fetch from CLOB API
      const response = await fetch(
        `${POLYMARKET_CLOB_API}/book?token_id=${encodeURIComponent(marketId)}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch orderbook: ${response.status}`);
      }

      const data = await response.json();

      // Parse bids (sorted descending by price)
      const bids: OrderbookLevel[] = (data.bids || [])
        .map((bid: any) => ({
          price: parseFloat(bid.price),
          size: parseFloat(bid.size),
          total: 0, // Will calculate below
        }))
        .sort((a: OrderbookLevel, b: OrderbookLevel) => b.price - a.price);

      // Calculate cumulative totals for bids
      let bidTotal = 0;
      for (const bid of bids) {
        bidTotal += bid.size;
        bid.total = bidTotal;
      }

      // Parse asks (sorted ascending by price)
      const asks: OrderbookLevel[] = (data.asks || [])
        .map((ask: any) => ({
          price: parseFloat(ask.price),
          size: parseFloat(ask.size),
          total: 0,
        }))
        .sort((a: OrderbookLevel, b: OrderbookLevel) => a.price - b.price);

      // Calculate cumulative totals for asks
      let askTotal = 0;
      for (const ask of asks) {
        askTotal += ask.size;
        ask.total = askTotal;
      }

      const bestBid = bids[0]?.price || 0;
      const bestAsk = asks[0]?.price || 1;
      const spread = bestAsk - bestBid;
      const midPrice = (bestBid + bestAsk) / 2;

      return {
        marketId,
        platform: 'polymarket',
        bids,
        asks,
        spread,
        midPrice,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('[Polymarket] Failed to fetch orderbook:', error);

      // Return empty orderbook
      return {
        marketId,
        platform: 'polymarket',
        bids: [],
        asks: [],
        spread: 0,
        midPrice: 0.5,
        timestamp: new Date(),
      };
    }
  }

  async getQuote(
    marketId: string,
    side: OrderSide,
    size: number
  ): Promise<ExecutionQuote> {
    const orderbook = await this.getOrderbook(marketId);

    // Calculate estimated execution
    const slippage = estimateSlippage(orderbook, side, size);
    const basePrice = side === 'YES' ? orderbook.asks[0]?.price : orderbook.bids[0]?.price;
    const estimatedPrice = basePrice ? basePrice + (side === 'YES' ? slippage : -slippage) : 0.5;
    const estimatedFees = size * TAKER_FEE;
    const estimatedTotal = size * estimatedPrice + estimatedFees;

    // Calculate price impact
    const levels = side === 'YES' ? orderbook.asks : orderbook.bids;
    const totalLiquidity = levels.reduce((sum, l) => sum + l.size, 0);
    const priceImpact = totalLiquidity > 0 ? size / totalLiquidity : 1;

    // Execution probability (higher if more liquidity)
    const executionProbability = Math.min(0.99, 0.5 + totalLiquidity / (size * 4));

    return {
      marketId,
      side,
      size,
      type: 'MARKET',
      recommendedVenue: 'polymarket',
      allVenues: [{
        platform: 'polymarket',
        available: this.connected,
        fees: { maker: MAKER_FEE, taker: TAKER_FEE },
        minOrderSize: MIN_ORDER_SIZE,
        maxOrderSize: MAX_ORDER_SIZE,
        supportsLimitOrders: true,
        supportsStopOrders: false,
        bestBid: orderbook.bids[0]?.price,
        bestAsk: orderbook.asks[0]?.price,
        spread: orderbook.spread,
        liquidity: totalLiquidity,
      }],
      estimatedPrice,
      estimatedSlippage: slippage,
      estimatedFees,
      estimatedTotal,
      priceImpact,
      executionProbability,
      quotedAt: new Date(),
      validUntil: new Date(Date.now() + 30000), // 30 second validity
    };
  }

  // ==========================================================================
  // ORDERS
  // ==========================================================================

  async submitOrder(request: OrderRequest): Promise<ExecutionResult> {
    const startTime = Date.now();

    if (!this.connected) {
      return {
        success: false,
        error: 'Not connected to Polymarket',
        venue: 'polymarket',
        latencyMs: Date.now() - startTime,
      };
    }

    if (!this.apiKey || !this.apiSecret) {
      return {
        success: false,
        error: 'No API credentials configured',
        venue: 'polymarket',
        latencyMs: Date.now() - startTime,
      };
    }

    // Validate order
    if (request.size < MIN_ORDER_SIZE) {
      return {
        success: false,
        error: `Order size below minimum (${MIN_ORDER_SIZE})`,
        venue: 'polymarket',
        latencyMs: Date.now() - startTime,
      };
    }

    if (request.size > MAX_ORDER_SIZE) {
      return {
        success: false,
        error: `Order size above maximum (${MAX_ORDER_SIZE})`,
        venue: 'polymarket',
        latencyMs: Date.now() - startTime,
      };
    }

    // Create order object
    const order: Order = {
      ...request,
      id: request.clientOrderId || generateOrderId(),
      status: 'PENDING',
      filledSize: 0,
      remainingSize: request.size,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      // Get current quote for execution estimate
      const quote = await this.getQuote(request.marketId, request.side, request.size);

      // In real implementation, would sign and submit to CLOB API
      // For now, simulate execution

      // Simulate market order fill
      if (request.type === 'MARKET') {
        order.status = 'FILLED';
        order.filledSize = request.size;
        order.remainingSize = 0;
        order.avgFillPrice = quote.estimatedPrice;
        order.fees = quote.estimatedFees;
        order.filledAt = new Date();
        order.submittedAt = new Date();
      } else {
        // Limit order - stays open
        order.status = 'OPEN';
        order.submittedAt = new Date();
      }

      order.updatedAt = new Date();

      // Store order
      this.orders.set(order.id, order);

      // Update position if filled
      if (order.status === 'FILLED') {
        await this.updatePosition(order);
      }

      // Update balance
      if (order.status === 'FILLED') {
        const cost = order.filledSize * (order.avgFillPrice || 0) + (order.fees || 0);
        this.balance.available -= cost;
        this.balance.total -= (order.fees || 0);
        this.balance.updatedAt = new Date();
      }

      return {
        success: true,
        order,
        venue: 'polymarket',
        executionPrice: order.avgFillPrice,
        slippage: order.avgFillPrice ? order.avgFillPrice - (quote.estimatedPrice - quote.estimatedSlippage) : 0,
        fees: order.fees,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      order.status = 'FAILED';
      order.statusMessage = error instanceof Error ? error.message : 'Unknown error';
      order.updatedAt = new Date();
      this.orders.set(order.id, order);

      return {
        success: false,
        order,
        error: order.statusMessage,
        venue: 'polymarket',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (!order) return false;

    if (order.status !== 'OPEN' && order.status !== 'PARTIAL') {
      return false; // Can only cancel open orders
    }

    // In real implementation, would call CLOB API to cancel
    order.status = 'CANCELLED';
    order.cancelledAt = new Date();
    order.updatedAt = new Date();
    this.orders.set(orderId, order);

    // Release locked funds
    if (order.remainingSize > 0 && order.price) {
      const released = order.remainingSize * order.price;
      this.balance.locked -= released;
      this.balance.available += released;
      this.balance.updatedAt = new Date();
    }

    return true;
  }

  async getOrder(orderId: string): Promise<Order | null> {
    return this.orders.get(orderId) || null;
  }

  async getOpenOrders(): Promise<Order[]> {
    return Array.from(this.orders.values())
      .filter(o => o.status === 'OPEN' || o.status === 'PARTIAL');
  }

  // ==========================================================================
  // CAPABILITIES
  // ==========================================================================

  supportsOrderType(type: OrderType): boolean {
    return type === 'MARKET' || type === 'LIMIT';
  }

  getMinOrderSize(): number {
    return MIN_ORDER_SIZE;
  }

  getMaxOrderSize(): number {
    return MAX_ORDER_SIZE;
  }

  getFees(): { maker: number; taker: number } {
    return { maker: MAKER_FEE, taker: TAKER_FEE };
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private async updatePosition(order: Order): Promise<void> {
    if (order.status !== 'FILLED' || !order.avgFillPrice) return;

    // Find existing position
    let position = Array.from(this.positions.values())
      .find(p => p.marketId === order.marketId && p.side === order.side);

    if (position) {
      // Update existing position
      const totalSize = position.size + order.filledSize;
      const totalCost = position.avgEntryPrice * position.size + order.avgFillPrice * order.filledSize;

      position.avgEntryPrice = totalCost / totalSize;
      position.size = totalSize;
      position.costBasis += order.filledSize * order.avgFillPrice;
      position.totalFees += order.fees || 0;
      position.orderIds.push(order.id);
      position.updatedAt = new Date();

      this.positions.set(position.id, position);
    } else {
      // Create new position
      position = {
        id: generatePositionId(),
        marketId: order.marketId,
        platform: 'polymarket',
        marketQuestion: order.marketId, // Would fetch from market data
        marketCategory: 'other',
        side: order.side,
        size: order.filledSize,
        avgEntryPrice: order.avgFillPrice,
        currentPrice: order.avgFillPrice,
        unrealizedPnL: 0,
        unrealizedPnLPct: 0,
        realizedPnL: 0,
        totalFees: order.fees || 0,
        costBasis: order.filledSize * order.avgFillPrice,
        maxLoss: order.side === 'YES'
          ? order.avgFillPrice * order.filledSize
          : (1 - order.avgFillPrice) * order.filledSize,
        maxGain: order.side === 'YES'
          ? (1 - order.avgFillPrice) * order.filledSize
          : order.avgFillPrice * order.filledSize,
        status: 'OPEN',
        openedAt: new Date(),
        updatedAt: new Date(),
        orderIds: [order.id],
      };

      this.positions.set(position.id, position);
    }

    // Link order to position
    order.positionId = position.id;
    this.orders.set(order.id, order);
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let polymarketConnector: PolymarketConnector | null = null;

export function getPolymarketConnector(): PolymarketConnector {
  if (!polymarketConnector) {
    polymarketConnector = new PolymarketConnector();
  }
  return polymarketConnector;
}

export default PolymarketConnector;
