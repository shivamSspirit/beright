/**
 * Kalshi Trading Connector
 *
 * Trading connector for Kalshi's regulated prediction market.
 * CFTC-regulated, USD-denominated, US-only.
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

const KALSHI_API = process.env.KALSHI_API_URL || 'https://api.elections.kalshi.com/trade-api/v2';
const KALSHI_API_KEY = process.env.KALSHI_API_KEY;
const KALSHI_PRIVATE_KEY = process.env.KALSHI_PRIVATE_KEY;

// Fee structure (1% on profits, not on trades)
const TAKER_FEE = 0.01;
const MAKER_FEE = 0.00;

// Order limits (in cents)
const MIN_ORDER_SIZE = 1;       // 1 contract = $1 max payout
const MAX_ORDER_SIZE = 25000;   // $25k per market limit

// =============================================================================
// KALSHI CONNECTOR
// =============================================================================

export class KalshiConnector implements TradingConnector {
  readonly platform: Platform = 'kalshi';
  readonly name = 'Kalshi';

  private connected = false;
  private apiKey?: string;
  private privateKey?: string;
  private memberId?: string;

  // In-memory state
  private orders: Map<string, Order> = new Map();
  private positions: Map<string, Position> = new Map();
  private balance: ConnectorBalance = {
    platform: 'kalshi',
    currency: 'USD',
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
    this.apiKey = KALSHI_API_KEY;
    this.privateKey = KALSHI_PRIVATE_KEY;

    if (!this.apiKey || !this.privateKey) {
      console.warn('[Kalshi] No API credentials - running in read-only mode');
    }

    try {
      // In real implementation, would authenticate with Kalshi
      // and get member_id
      this.connected = true;
      console.log('[Kalshi] Connected');
    } catch (error) {
      console.error('[Kalshi] Connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    console.log('[Kalshi] Disconnected');
  }

  // ==========================================================================
  // ACCOUNT
  // ==========================================================================

  async getBalance(): Promise<ConnectorBalance> {
    if (!this.connected) {
      throw new Error('Not connected to Kalshi');
    }

    // In real implementation, fetch from /portfolio/balance
    return { ...this.balance };
  }

  async getPositions(): Promise<Position[]> {
    if (!this.connected) {
      throw new Error('Not connected to Kalshi');
    }

    // In real implementation, fetch from /portfolio/positions
    return Array.from(this.positions.values());
  }

  // ==========================================================================
  // MARKET DATA
  // ==========================================================================

  async getOrderbook(marketId: string): Promise<Orderbook> {
    try {
      const response = await fetch(
        `${KALSHI_API}/markets/${encodeURIComponent(marketId)}/orderbook`,
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
      const book = data.orderbook || {};

      // Kalshi prices are in cents (0-100), convert to 0-1
      const parseLevels = (levels: any[], isBid: boolean): OrderbookLevel[] => {
        if (!levels) return [];

        const parsed = levels.map((level: any) => ({
          price: (level.price || level[0]) / 100, // cents to decimal
          size: level.count || level[1] || 0,
          total: 0,
        }));

        // Sort: bids descending, asks ascending
        parsed.sort((a, b) => isBid ? b.price - a.price : a.price - b.price);

        // Calculate cumulative totals
        let total = 0;
        for (const level of parsed) {
          total += level.size;
          level.total = total;
        }

        return parsed;
      };

      const bids = parseLevels(book.yes || [], true);
      const asks = parseLevels(book.no || [], false);

      // For Kalshi, YES orderbook: bids are YES buys, "asks" are NO sells
      // We need to invert NO prices for consistency
      const invertedAsks = asks.map(a => ({
        ...a,
        price: 1 - a.price, // NO at 40c = YES at 60c
      })).sort((a, b) => a.price - b.price);

      const bestBid = bids[0]?.price || 0;
      const bestAsk = invertedAsks[0]?.price || 1;

      return {
        marketId,
        platform: 'kalshi',
        bids,
        asks: invertedAsks,
        spread: bestAsk - bestBid,
        midPrice: (bestBid + bestAsk) / 2,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('[Kalshi] Failed to fetch orderbook:', error);

      return {
        marketId,
        platform: 'kalshi',
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

    const slippage = estimateSlippage(orderbook, side, size);
    const basePrice = side === 'YES' ? orderbook.asks[0]?.price : orderbook.bids[0]?.price;
    const estimatedPrice = basePrice ? basePrice + (side === 'YES' ? slippage : -slippage) : 0.5;

    // Kalshi charges 1% on profits, not upfront
    const estimatedFees = 0; // Fees at settlement, not trade time
    const estimatedTotal = size * estimatedPrice;

    const levels = side === 'YES' ? orderbook.asks : orderbook.bids;
    const totalLiquidity = levels.reduce((sum, l) => sum + l.size, 0);
    const priceImpact = totalLiquidity > 0 ? size / totalLiquidity : 1;
    const executionProbability = Math.min(0.99, 0.5 + totalLiquidity / (size * 4));

    return {
      marketId,
      side,
      size,
      type: 'MARKET',
      recommendedVenue: 'kalshi',
      allVenues: [{
        platform: 'kalshi',
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
      validUntil: new Date(Date.now() + 30000),
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
        error: 'Not connected to Kalshi',
        venue: 'kalshi',
        latencyMs: Date.now() - startTime,
      };
    }

    if (!this.apiKey || !this.privateKey) {
      return {
        success: false,
        error: 'No API credentials configured',
        venue: 'kalshi',
        latencyMs: Date.now() - startTime,
      };
    }

    // Validate
    if (request.size < MIN_ORDER_SIZE) {
      return {
        success: false,
        error: `Order size below minimum (${MIN_ORDER_SIZE} contracts)`,
        venue: 'kalshi',
        latencyMs: Date.now() - startTime,
      };
    }

    if (request.size > MAX_ORDER_SIZE) {
      return {
        success: false,
        error: `Order size above maximum (${MAX_ORDER_SIZE} contracts)`,
        venue: 'kalshi',
        latencyMs: Date.now() - startTime,
      };
    }

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
      const quote = await this.getQuote(request.marketId, request.side, request.size);

      // In real implementation, would call Kalshi API
      // POST /portfolio/orders with signed request

      if (request.type === 'MARKET') {
        order.status = 'FILLED';
        order.filledSize = request.size;
        order.remainingSize = 0;
        order.avgFillPrice = quote.estimatedPrice;
        order.fees = 0; // Fees at settlement
        order.filledAt = new Date();
        order.submittedAt = new Date();
      } else {
        order.status = 'OPEN';
        order.submittedAt = new Date();
      }

      order.updatedAt = new Date();
      this.orders.set(order.id, order);

      if (order.status === 'FILLED') {
        await this.updatePosition(order);
        const cost = order.filledSize * (order.avgFillPrice || 0);
        this.balance.available -= cost;
        this.balance.updatedAt = new Date();
      }

      return {
        success: true,
        order,
        venue: 'kalshi',
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
        venue: 'kalshi',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (!order) return false;

    if (order.status !== 'OPEN' && order.status !== 'PARTIAL') {
      return false;
    }

    // In real implementation, would call DELETE /portfolio/orders/{order_id}
    order.status = 'CANCELLED';
    order.cancelledAt = new Date();
    order.updatedAt = new Date();
    this.orders.set(orderId, order);

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

    let position = Array.from(this.positions.values())
      .find(p => p.marketId === order.marketId && p.side === order.side);

    if (position) {
      const totalSize = position.size + order.filledSize;
      const totalCost = position.avgEntryPrice * position.size + order.avgFillPrice * order.filledSize;

      position.avgEntryPrice = totalCost / totalSize;
      position.size = totalSize;
      position.costBasis += order.filledSize * order.avgFillPrice;
      position.orderIds.push(order.id);
      position.updatedAt = new Date();

      this.positions.set(position.id, position);
    } else {
      position = {
        id: generatePositionId(),
        marketId: order.marketId,
        platform: 'kalshi',
        marketQuestion: order.marketId,
        marketCategory: 'other',
        side: order.side,
        size: order.filledSize,
        avgEntryPrice: order.avgFillPrice,
        currentPrice: order.avgFillPrice,
        unrealizedPnL: 0,
        unrealizedPnLPct: 0,
        realizedPnL: 0,
        totalFees: 0,
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

    order.positionId = position.id;
    this.orders.set(order.id, order);
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let kalshiConnector: KalshiConnector | null = null;

export function getKalshiConnector(): KalshiConnector {
  if (!kalshiConnector) {
    kalshiConnector = new KalshiConnector();
  }
  return kalshiConnector;
}

export default KalshiConnector;
