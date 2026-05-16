/**
 * Manifold Markets Connector
 *
 * Trading connector for Manifold Markets (play money).
 * Great for testing strategies without real capital.
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
} from '../types';
import { Platform } from '../../dataFabric/types';

// =============================================================================
// CONFIGURATION
// =============================================================================

const MANIFOLD_API = 'https://api.manifold.markets/v0';
const MANIFOLD_API_KEY = process.env.MANIFOLD_API_KEY;

// No fees on Manifold (play money)
const TAKER_FEE = 0.00;
const MAKER_FEE = 0.00;

// Order limits (in Mana)
const MIN_ORDER_SIZE = 1;       // M$1 minimum
const MAX_ORDER_SIZE = 100000;  // M$100k maximum

// =============================================================================
// MANIFOLD CONNECTOR
// =============================================================================

export class ManifoldConnector implements TradingConnector {
  readonly platform: Platform = 'manifold';
  readonly name = 'Manifold Markets';

  private connected = false;
  private apiKey?: string;
  private userId?: string;

  // In-memory state
  private orders: Map<string, Order> = new Map();
  private positions: Map<string, Position> = new Map();
  private balance: ConnectorBalance = {
    platform: 'manifold',
    currency: 'MANA',
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
    this.apiKey = MANIFOLD_API_KEY;

    if (!this.apiKey) {
      console.warn('[Manifold] No API key - running in read-only mode');
    } else {
      // Fetch user info
      try {
        const response = await fetch(`${MANIFOLD_API}/me`, {
          headers: {
            'Authorization': `Key ${this.apiKey}`,
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          const user = await response.json();
          this.userId = user.id;
          this.balance.available = user.balance || 0;
          this.balance.total = user.balance || 0;
          this.balance.updatedAt = new Date();
        }
      } catch (error) {
        console.error('[Manifold] Failed to fetch user:', error);
      }
    }

    this.connected = true;
    console.log('[Manifold] Connected');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    console.log('[Manifold] Disconnected');
  }

  // ==========================================================================
  // ACCOUNT
  // ==========================================================================

  async getBalance(): Promise<ConnectorBalance> {
    if (!this.connected) {
      throw new Error('Not connected to Manifold');
    }

    // Refresh balance if API key available
    if (this.apiKey) {
      try {
        const response = await fetch(`${MANIFOLD_API}/me`, {
          headers: {
            'Authorization': `Key ${this.apiKey}`,
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          const user = await response.json();
          this.balance.available = user.balance || 0;
          this.balance.total = user.balance || 0;
          this.balance.updatedAt = new Date();
        }
      } catch (error) {
        console.error('[Manifold] Failed to refresh balance:', error);
      }
    }

    return { ...this.balance };
  }

  async getPositions(): Promise<Position[]> {
    if (!this.connected) {
      throw new Error('Not connected to Manifold');
    }

    // Fetch positions from API if available
    if (this.apiKey && this.userId) {
      try {
        const response = await fetch(
          `${MANIFOLD_API}/users/${this.userId}/bets?limit=100`,
          {
            headers: {
              'Authorization': `Key ${this.apiKey}`,
              'Accept': 'application/json',
            },
          }
        );

        if (response.ok) {
          const bets = await response.json();
          // Group bets by market to create positions
          // This is simplified - real implementation would aggregate properly
          const positionMap = new Map<string, Position>();

          for (const bet of bets) {
            if (!bet.isFilled) continue;

            const key = `${bet.contractId}-${bet.outcome}`;
            const existing = positionMap.get(key);

            if (existing) {
              // Aggregate
              const newSize = existing.size + bet.amount;
              existing.avgEntryPrice =
                (existing.avgEntryPrice * existing.size + bet.probAfter * bet.amount) / newSize;
              existing.size = newSize;
              existing.updatedAt = new Date();
            } else {
              // New position
              positionMap.set(key, {
                id: generatePositionId(),
                marketId: bet.contractId,
                platform: 'manifold',
                marketQuestion: bet.contractId,
                marketCategory: 'other',
                side: bet.outcome === 'YES' ? 'YES' : 'NO',
                size: bet.amount,
                avgEntryPrice: bet.probAfter,
                currentPrice: bet.probAfter,
                unrealizedPnL: 0,
                unrealizedPnLPct: 0,
                realizedPnL: 0,
                totalFees: 0,
                costBasis: bet.amount,
                maxLoss: bet.amount,
                maxGain: bet.amount * (1 / bet.probAfter - 1),
                status: 'OPEN',
                openedAt: new Date(bet.createdTime),
                updatedAt: new Date(),
                orderIds: [],
              });
            }
          }

          return Array.from(positionMap.values());
        }
      } catch (error) {
        console.error('[Manifold] Failed to fetch positions:', error);
      }
    }

    return Array.from(this.positions.values());
  }

  // ==========================================================================
  // MARKET DATA
  // ==========================================================================

  async getOrderbook(marketId: string): Promise<Orderbook> {
    // Manifold uses AMM, not orderbook
    // We'll simulate an orderbook based on current probability

    try {
      const response = await fetch(`${MANIFOLD_API}/market/${marketId}`, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch market: ${response.status}`);
      }

      const market = await response.json();
      const prob = market.probability || 0.5;

      // Simulate orderbook around current prob
      // AMM provides infinite liquidity but with slippage
      const bids: OrderbookLevel[] = [
        { price: prob - 0.01, size: 1000, total: 1000 },
        { price: prob - 0.02, size: 2000, total: 3000 },
        { price: prob - 0.05, size: 5000, total: 8000 },
      ];

      const asks: OrderbookLevel[] = [
        { price: prob + 0.01, size: 1000, total: 1000 },
        { price: prob + 0.02, size: 2000, total: 3000 },
        { price: prob + 0.05, size: 5000, total: 8000 },
      ];

      return {
        marketId,
        platform: 'manifold',
        bids,
        asks,
        spread: 0.02,
        midPrice: prob,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('[Manifold] Failed to fetch market:', error);

      return {
        marketId,
        platform: 'manifold',
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

    // AMM provides continuous liquidity with slippage
    // Estimate slippage based on size
    const poolSize = 10000; // Assume M$10k pool
    const slippage = (size / poolSize) * 0.1; // 10% slippage per pool size

    const basePrice = orderbook.midPrice;
    const estimatedPrice = side === 'YES'
      ? Math.min(0.99, basePrice + slippage)
      : Math.max(0.01, basePrice - slippage);

    return {
      marketId,
      side,
      size,
      type: 'MARKET',
      recommendedVenue: 'manifold',
      allVenues: [{
        platform: 'manifold',
        available: this.connected,
        fees: { maker: MAKER_FEE, taker: TAKER_FEE },
        minOrderSize: MIN_ORDER_SIZE,
        maxOrderSize: MAX_ORDER_SIZE,
        supportsLimitOrders: true,
        supportsStopOrders: false,
        bestBid: orderbook.bids[0]?.price,
        bestAsk: orderbook.asks[0]?.price,
        spread: orderbook.spread,
        liquidity: poolSize,
      }],
      estimatedPrice,
      estimatedSlippage: slippage,
      estimatedFees: 0,
      estimatedTotal: size * estimatedPrice,
      priceImpact: slippage,
      executionProbability: 0.99, // AMM always fills
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
        error: 'Not connected to Manifold',
        venue: 'manifold',
        latencyMs: Date.now() - startTime,
      };
    }

    if (!this.apiKey) {
      return {
        success: false,
        error: 'No API key configured',
        venue: 'manifold',
        latencyMs: Date.now() - startTime,
      };
    }

    // Validate
    if (request.size < MIN_ORDER_SIZE) {
      return {
        success: false,
        error: `Order size below minimum (M$${MIN_ORDER_SIZE})`,
        venue: 'manifold',
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
      // Submit bet to Manifold API
      const betPayload = {
        contractId: request.marketId,
        amount: request.size,
        outcome: request.side,
        limitProb: request.price, // For limit orders
      };

      const response = await fetch(`${MANIFOLD_API}/bet`, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(betPayload),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Manifold API error: ${error}`);
      }

      const result = await response.json();

      // Update order with result
      order.status = result.isFilled ? 'FILLED' : 'OPEN';
      order.platformOrderId = result.betId;
      order.filledSize = result.amount || request.size;
      order.remainingSize = 0;
      order.avgFillPrice = result.probAfter;
      order.fees = 0;
      order.filledAt = new Date();
      order.submittedAt = new Date();
      order.updatedAt = new Date();

      this.orders.set(order.id, order);

      if (order.status === 'FILLED') {
        await this.updatePosition(order);

        // Update balance
        this.balance.available -= order.filledSize;
        this.balance.updatedAt = new Date();
      }

      return {
        success: true,
        order,
        venue: 'manifold',
        executionPrice: order.avgFillPrice,
        slippage: 0,
        fees: 0,
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
        venue: 'manifold',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (!order) return false;

    if (order.status !== 'OPEN') {
      return false;
    }

    // Manifold limit orders can be cancelled via API
    if (this.apiKey && order.platformOrderId) {
      try {
        const response = await fetch(`${MANIFOLD_API}/bet/cancel/${order.platformOrderId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Key ${this.apiKey}`,
          },
        });

        if (!response.ok) {
          return false;
        }
      } catch (error) {
        console.error('[Manifold] Failed to cancel order:', error);
        return false;
      }
    }

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
      .filter(o => o.status === 'OPEN');
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
      position.costBasis += order.filledSize;
      position.orderIds.push(order.id);
      position.updatedAt = new Date();

      this.positions.set(position.id, position);
    } else {
      position = {
        id: generatePositionId(),
        marketId: order.marketId,
        platform: 'manifold',
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
        costBasis: order.filledSize,
        maxLoss: order.filledSize,
        maxGain: order.filledSize * (1 / order.avgFillPrice - 1),
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

let manifoldConnector: ManifoldConnector | null = null;

export function getManifoldConnector(): ManifoldConnector {
  if (!manifoldConnector) {
    manifoldConnector = new ManifoldConnector();
  }
  return manifoldConnector;
}

export default ManifoldConnector;
