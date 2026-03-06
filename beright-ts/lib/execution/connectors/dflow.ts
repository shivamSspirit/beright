/**
 * DFlow Trading Connector
 *
 * Trading connector for DFlow's tokenized prediction markets on Solana.
 * Routes to Kalshi markets via on-chain execution.
 *
 * NOW WITH REAL EXECUTION via lib/dflow/executor.ts
 *
 * @author BeRight Protocol
 */

import { Keypair, Connection } from '@solana/web3.js';
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
  ExecutionVenue,
  generateOrderId,
  generatePositionId,
  estimateSlippage,
} from '../types';
import { Platform, MarketCategory } from '../../dataFabric/types';
import {
  getDFlowClient,
  DFlowOrderbook,
  DFlowMarket,
  getDFlowMarket,
  USDC_MINT,
} from '../../dflow';
import {
  DFlowExecutor,
  getDFlowExecutor,
  ExecutionResult as DFlowExecResult,
} from '../../dflow/executor';
import {
  KeypairWallet,
  getWalletBalance,
  WalletProvider,
} from '../../dflow/wallet';
import {
  getPositions as getDFlowPositions,
  DFlowPosition,
} from '../../dflow/positions';

// =============================================================================
// CONFIGURATION
// =============================================================================

// Fee structure (DFlow takes ~0.1% platform fee)
const TAKER_FEE = 0.001;
const MAKER_FEE = 0.0;

// Order limits (in USD)
const MIN_ORDER_SIZE = 1;       // $1 minimum
const MAX_ORDER_SIZE = 50000;   // $50k per trade limit

// =============================================================================
// DFLOW CONNECTOR
// =============================================================================

export class DFlowConnector implements TradingConnector {
  readonly platform: Platform = 'kalshi'; // DFlow routes to Kalshi
  readonly name = 'DFlow (Solana)';

  private connected = false;
  private walletAddress?: string;
  private keypair?: Keypair;
  private executor: DFlowExecutor;
  private connection: Connection;

  // Execution mode: 'real' uses on-chain execution, 'simulation' for testing
  private executionMode: 'real' | 'simulation' = 'simulation';

  // In-memory state (for tracking/caching)
  private orders: Map<string, Order> = new Map();
  private positions: Map<string, Position> = new Map();
  private balance: ConnectorBalance = {
    platform: 'kalshi',
    currency: 'USDC',
    available: 0,
    locked: 0,
    total: 0,
    updatedAt: new Date(),
  };

  constructor() {
    this.executor = getDFlowExecutor();
    this.connection = this.executor.getConnection();
  }

  /**
   * Set the wallet for real execution
   */
  setWallet(keypair: Keypair): void {
    this.keypair = keypair;
    this.walletAddress = keypair.publicKey.toBase58();
    this.executionMode = 'real';
    console.log(`[DFlow] Wallet set: ${this.walletAddress} (real execution enabled)`);
  }

  /**
   * Enable simulation mode (no real trades)
   */
  setSimulationMode(): void {
    this.executionMode = 'simulation';
    console.log('[DFlow] Simulation mode enabled');
  }

  /**
   * Check if real execution is enabled
   */
  isRealExecution(): boolean {
    return this.executionMode === 'real' && !!this.keypair;
  }

  // ==========================================================================
  // CONNECTION
  // ==========================================================================

  isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    this.walletAddress = process.env.SOLANA_WALLET_ADDRESS;

    if (!this.walletAddress) {
      console.warn('[DFlow] No wallet address - running in read-only mode');
    }

    try {
      // Verify DFlow API is accessible
      const client = getDFlowClient();
      await client.getEvents({ limit: 1 });

      this.connected = true;
      console.log('[DFlow] Connected');
    } catch (error) {
      console.error('[DFlow] Connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    console.log('[DFlow] Disconnected');
  }

  // ==========================================================================
  // BALANCE
  // ==========================================================================

  async getBalance(): Promise<ConnectorBalance> {
    if (!this.connected || !this.walletAddress) {
      return this.balance;
    }

    try {
      // Fetch real balance from Solana
      const walletBalance = await getWalletBalance(this.connection, this.walletAddress);

      this.balance = {
        platform: 'kalshi',
        currency: 'USDC',
        available: walletBalance.usdc,
        locked: 0, // Would need to track pending orders
        total: walletBalance.usdc,
        updatedAt: walletBalance.updatedAt,
      };

      return this.balance;
    } catch (error) {
      console.error('[DFlow] Balance fetch failed:', error);
      return this.balance;
    }
  }

  // ==========================================================================
  // POSITIONS
  // ==========================================================================

  async getPositions(): Promise<Position[]> {
    if (!this.connected || !this.walletAddress) {
      return [];
    }

    try {
      // Fetch real positions from on-chain token accounts
      const dflowPositions = await getDFlowPositions(this.connection, this.walletAddress);

      // Convert DFlowPosition to internal Position format
      const positions: Position[] = dflowPositions.map(p => ({
        id: generatePositionId(),
        marketId: p.marketTicker,
        platform: 'kalshi' as Platform,
        marketQuestion: p.title,
        marketCategory: 'politics' as MarketCategory, // TODO: Map from market data
        side: p.side as OrderSide,
        status: p.result ? 'CLOSED' : 'OPEN',
        size: p.shares,
        avgEntryPrice: p.costBasis ? p.costBasis / p.shares : p.currentPrice,
        currentPrice: p.currentPrice,
        costBasis: p.costBasis || p.currentValue,
        unrealizedPnL: p.unrealizedPnL || 0,
        unrealizedPnLPct: p.costBasis ? ((p.currentValue - p.costBasis) / p.costBasis) * 100 : 0,
        realizedPnL: 0,
        totalFees: 0,
        maxLoss: p.maxLoss,
        maxGain: p.maxPayout - (p.costBasis || p.currentValue),
        openedAt: new Date(),
        updatedAt: new Date(),
        orderIds: [],
      }));

      // Update cache
      this.positions.clear();
      for (const pos of positions) {
        this.positions.set(`${pos.marketId}_${pos.side}`, pos);
      }

      return positions;
    } catch (error) {
      console.error('[DFlow] Position fetch failed:', error);
      return Array.from(this.positions.values());
    }
  }

  // ==========================================================================
  // ORDERBOOK
  // ==========================================================================

  async getOrderbook(marketId: string): Promise<Orderbook> {
    try {
      const client = getDFlowClient();
      const orderbook = await client.getOrderbook(marketId);

      return this.convertOrderbook(marketId, orderbook);
    } catch (error) {
      console.error(`[DFlow] Failed to get orderbook for ${marketId}:`, error);
      throw error;
    }
  }

  private convertOrderbook(marketId: string, ob: DFlowOrderbook): Orderbook {
    const bids: OrderbookLevel[] = [];
    const asks: OrderbookLevel[] = [];

    // Convert yes bids (buying YES = bidding)
    if (ob.yesBids) {
      let cumulative = 0;
      for (const [price, size] of Object.entries(ob.yesBids)) {
        cumulative += size;
        bids.push({
          price: parseFloat(price) / 100, // Convert from cents to decimal
          size: size,
          total: cumulative,
        });
      }
    }

    // Convert yes asks (selling YES = asking)
    if (ob.yesAsks) {
      let cumulative = 0;
      for (const [price, size] of Object.entries(ob.yesAsks)) {
        cumulative += size;
        asks.push({
          price: parseFloat(price) / 100,
          size: size,
          total: cumulative,
        });
      }
    }

    // Sort: bids descending, asks ascending
    bids.sort((a, b) => b.price - a.price);
    asks.sort((a, b) => a.price - b.price);

    const bestBid = bids[0]?.price || 0;
    const bestAsk = asks[0]?.price || 1;
    const spread = bestAsk - bestBid;
    const midPrice = (bestBid + bestAsk) / 2;

    return {
      marketId,
      platform: 'kalshi',
      bids,
      asks,
      spread,
      midPrice,
      timestamp: new Date(),
    };
  }

  // ==========================================================================
  // EXECUTION
  // ==========================================================================

  async getQuote(marketId: string, side: OrderSide, size: number): Promise<ExecutionQuote> {
    if (!this.connected) {
      throw new Error('DFlow not connected');
    }

    try {
      const client = getDFlowClient();
      const dflowOrderbook = await client.getOrderbook(marketId);

      // Convert to internal orderbook format
      const internalOrderbook = this.convertOrderbook(marketId, dflowOrderbook);

      // Calculate execution price based on side and size
      const price = this.calculateExecutionPrice(dflowOrderbook, side, size);
      const slippage = estimateSlippage(internalOrderbook, side, size);
      const fees = size * TAKER_FEE;

      const venue: ExecutionVenue = {
        platform: 'kalshi',
        available: true,
        fees: { maker: MAKER_FEE, taker: TAKER_FEE },
        minOrderSize: MIN_ORDER_SIZE,
        maxOrderSize: MAX_ORDER_SIZE,
        supportsLimitOrders: true,
        supportsStopOrders: false,
        bestBid: this.getBestBid(dflowOrderbook),
        bestAsk: this.getBestAsk(dflowOrderbook),
        spread: this.getBestAsk(dflowOrderbook) - this.getBestBid(dflowOrderbook),
        liquidity: this.estimateLiquidity(dflowOrderbook),
      };

      return {
        marketId,
        side,
        size,
        type: 'MARKET',
        recommendedVenue: 'kalshi',
        allVenues: [venue],
        estimatedPrice: price,
        estimatedSlippage: slippage,
        estimatedFees: fees,
        estimatedTotal: size + fees,
        priceImpact: slippage,
        executionProbability: 0.95,
        quotedAt: new Date(),
        validUntil: new Date(Date.now() + 30000), // 30 second validity
      };
    } catch (error) {
      console.error('[DFlow] Failed to get quote:', error);
      throw error;
    }
  }

  private getBestBid(orderbook: DFlowOrderbook): number {
    if (!orderbook.yesBids) return 0;
    const prices = Object.keys(orderbook.yesBids).map(p => parseFloat(p) / 100);
    return Math.max(...prices, 0);
  }

  private getBestAsk(orderbook: DFlowOrderbook): number {
    if (!orderbook.yesAsks) return 1;
    const prices = Object.keys(orderbook.yesAsks).map(p => parseFloat(p) / 100);
    return Math.min(...prices, 1);
  }

  private estimateLiquidity(orderbook: DFlowOrderbook): number {
    let total = 0;
    if (orderbook.yesBids) {
      for (const [price, size] of Object.entries(orderbook.yesBids)) {
        total += (parseFloat(price) / 100) * size;
      }
    }
    if (orderbook.yesAsks) {
      for (const [price, size] of Object.entries(orderbook.yesAsks)) {
        total += (parseFloat(price) / 100) * size;
      }
    }
    return total;
  }

  private calculateExecutionPrice(
    orderbook: DFlowOrderbook,
    side: OrderSide,
    size: number
  ): number {
    // For YES: use yes asks (what we'd pay)
    // For NO: use no asks
    const levels = side === 'YES' ? orderbook.yesAsks : orderbook.noAsks;

    if (!levels || Object.keys(levels).length === 0) {
      return 0.5; // Default to 50% if no orderbook
    }

    // Sort asks ascending and walk the book
    const sortedAsks = Object.entries(levels)
      .map(([price, qty]) => ({ price: parseFloat(price) / 100, size: qty }))
      .sort((a, b) => a.price - b.price);

    let remaining = size;
    let totalCost = 0;

    for (const level of sortedAsks) {
      const fillAmount = Math.min(remaining, level.size * level.price);
      totalCost += fillAmount;
      remaining -= fillAmount;

      if (remaining <= 0) break;
    }

    return size > 0 ? totalCost / size : sortedAsks[0]?.price || 0.5;
  }

  async submitOrder(request: OrderRequest): Promise<ExecutionResult> {
    if (!this.connected || !this.walletAddress) {
      return {
        success: false,
        error: 'DFlow not connected or no wallet',
        venue: 'kalshi',
        latencyMs: 0,
      };
    }

    const startTime = Date.now();
    const orderId = generateOrderId();

    try {
      const quote = await this.getQuote(request.marketId, request.side, request.size);

      // Create order record
      const order: Order = {
        id: orderId,
        marketId: request.marketId,
        platform: 'kalshi',
        side: request.side,
        type: request.type,
        size: request.size,
        price: request.price,
        status: 'PENDING',
        filledSize: 0,
        remainingSize: request.size,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.orders.set(orderId, order);

      // REAL EXECUTION: Use executor with wallet
      if (this.executionMode === 'real' && this.keypair) {
        // Fetch market details for execution
        const market = await getDFlowMarket(request.marketId);
        if (!market) {
          throw new Error(`Market not found: ${request.marketId}`);
        }

        // Execute real trade
        const execResult = await this.executor.executeWithKeypair(
          {
            market,
            side: request.side,
            amountUsdc: request.size,
            slippageBps: 100, // 1% default slippage
          },
          this.keypair
        );

        if (!execResult.success) {
          order.status = 'FAILED';
          order.updatedAt = new Date();
          return {
            success: false,
            error: execResult.error || 'Execution failed',
            venue: 'kalshi',
            latencyMs: Date.now() - startTime,
          };
        }

        // Update order with execution details
        order.status = 'FILLED';
        order.filledSize = request.size;
        order.remainingSize = 0;
        order.avgFillPrice = quote.estimatedPrice;
        order.fees = quote.estimatedFees;
        order.updatedAt = new Date();
        order.filledAt = new Date();
        order.txSignature = execResult.signature;

        // Update position tracking
        await this.updatePosition(request, quote);

        console.log(`[DFlow] Order executed: ${execResult.signature}`);

        return {
          success: true,
          order,
          venue: 'kalshi',
          executionPrice: quote.estimatedPrice,
          slippage: quote.estimatedSlippage,
          fees: quote.estimatedFees,
          latencyMs: Date.now() - startTime,
          txSignature: execResult.signature,
        };
      }

      // SIMULATION MODE: No real execution
      console.log(`[DFlow] Simulating order: ${request.side} $${request.size} on ${request.marketId}`);

      order.status = 'FILLED';
      order.filledSize = request.size;
      order.remainingSize = 0;
      order.avgFillPrice = quote.estimatedPrice;
      order.fees = quote.estimatedFees;
      order.updatedAt = new Date();
      order.filledAt = new Date();

      // Update simulated position
      await this.updatePosition(request, quote);

      return {
        success: true,
        order,
        venue: 'kalshi',
        executionPrice: quote.estimatedPrice,
        slippage: quote.estimatedSlippage,
        fees: quote.estimatedFees,
        latencyMs: Date.now() - startTime,
        simulated: true,
      };
    } catch (error) {
      // Mark order as failed
      const order = this.orders.get(orderId);
      if (order) {
        order.status = 'FAILED';
        order.updatedAt = new Date();
      }

      console.error('[DFlow] Order submission failed:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        venue: 'kalshi',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  private async updatePosition(request: OrderRequest, quote: ExecutionQuote): Promise<void> {
    const positionId = `${request.marketId}_${request.side}`;
    const existing = this.positions.get(positionId);

    const shares = quote.size / quote.estimatedPrice;

    if (existing) {
      // Update existing position
      const newSize = existing.size + shares;
      const newCostBasis = existing.costBasis + quote.estimatedTotal;
      existing.size = newSize;
      existing.costBasis = newCostBasis;
      existing.avgEntryPrice = newCostBasis / newSize;
      existing.totalFees += quote.estimatedFees;
      existing.updatedAt = new Date();
    } else {
      // Create new position
      const position: Position = {
        id: generatePositionId(),
        marketId: request.marketId,
        platform: 'kalshi',
        marketQuestion: '',
        marketCategory: 'crypto' as MarketCategory,
        side: request.side,
        status: 'OPEN',
        size: shares,
        avgEntryPrice: quote.estimatedPrice,
        currentPrice: quote.estimatedPrice,
        costBasis: quote.estimatedTotal,
        unrealizedPnL: 0,
        unrealizedPnLPct: 0,
        realizedPnL: 0,
        totalFees: quote.estimatedFees,
        maxLoss: quote.estimatedTotal,
        maxGain: shares - quote.estimatedTotal,
        openedAt: new Date(),
        updatedAt: new Date(),
        orderIds: [],
      };
      this.positions.set(positionId, position);
    }
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (!order || order.status !== 'OPEN') {
      return false;
    }

    // In production, would cancel on DFlow
    order.status = 'CANCELLED';
    order.updatedAt = new Date();
    order.cancelledAt = new Date();
    return true;
  }

  // ==========================================================================
  // ORDERS
  // ==========================================================================

  async getOpenOrders(): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(o => o.status === 'OPEN');
  }

  async getOrder(orderId: string): Promise<Order | null> {
    return this.orders.get(orderId) || null;
  }

  // ==========================================================================
  // CAPABILITIES
  // ==========================================================================

  supportsOrderType(type: OrderType): boolean {
    return type === 'MARKET' || type === 'LIMIT';
  }

  getFees(): { maker: number; taker: number } {
    return { maker: MAKER_FEE, taker: TAKER_FEE };
  }

  getMinOrderSize(): number {
    return MIN_ORDER_SIZE;
  }

  getMaxOrderSize(): number {
    return MAX_ORDER_SIZE;
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let dflowConnector: DFlowConnector | null = null;

export function getDFlowConnector(): DFlowConnector {
  if (!dflowConnector) {
    dflowConnector = new DFlowConnector();
  }
  return dflowConnector;
}

export default DFlowConnector;
