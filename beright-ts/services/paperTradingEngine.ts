/**
 * Paper Trading Engine
 *
 * Simulates trading without real money to:
 * - Test strategies safely
 * - Track hypothetical performance
 * - Validate signals before going live
 * - Build confidence in the system
 *
 * Features:
 * - Virtual portfolio management
 * - Simulated order execution
 * - Real-time P&L tracking
 * - Stop loss / take profit automation
 * - Performance analytics
 */

import { EventEmitter } from 'events';
import { db } from '../lib/supabase/client';
import { getMarket } from '../lib/dflow/api';
import { getKalshiMarket } from '../lib/kalshi';
import {
  Trade,
  TradeInput,
  Position,
  VirtualPortfolio,
  TradingMode,
  TradeDirection,
  StrategyType,
  RiskConfig,
  DEFAULT_RISK_CONFIG,
  inferCategory,
} from '../types/trading';

// ============================================
// CONFIGURATION
// ============================================

const ENGINE_CONFIG = {
  // Default starting balance for paper trading
  defaultInitialBalance: 1000,

  // Fee simulation (to match real trading)
  simulatedFeePct: 0.01, // 1% fee

  // Price update interval
  priceUpdateIntervalMs: 60 * 1000, // 1 minute

  // Auto-close checks
  autoCloseCheckIntervalMs: 30 * 1000, // 30 seconds

  // Slippage simulation
  simulatedSlippagePct: 0.005, // 0.5% slippage

  // Max positions
  maxOpenPositions: 20,
};

// ============================================
// PAPER TRADING ENGINE
// ============================================

export class PaperTradingEngine extends EventEmitter {
  private userId: string;
  private portfolio: VirtualPortfolio;
  private positions: Map<string, Position> = new Map();
  private priceUpdateInterval: NodeJS.Timeout | null = null;
  private autoCloseInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private riskConfig: RiskConfig;
  private dailyPnlHistory: number[] = [];
  private peakValue: number = 0;

  constructor(userId: string, initialBalance?: number, riskConfig?: Partial<RiskConfig>) {
    super();
    this.userId = userId;
    this.riskConfig = { ...DEFAULT_RISK_CONFIG, ...riskConfig };

    this.portfolio = {
      id: `paper-${userId}-${Date.now()}`,
      userId,
      mode: 'paper' as TradingMode,
      initialBalance: initialBalance || ENGINE_CONFIG.defaultInitialBalance,
      cashBalance: initialBalance || ENGINE_CONFIG.defaultInitialBalance,
      portfolioValue: 0,
      totalValue: initialBalance || ENGINE_CONFIG.defaultInitialBalance,
      totalPnl: 0,
      totalPnlPercent: 0,
      realizedPnl: 0,
      unrealizedPnl: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      profitFactor: 0,
      sharpeRatio: null,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      currentDrawdown: 0,
      openPositions: [],
      positionCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastTradeAt: null,
    };

    this.peakValue = this.portfolio.totalValue;
  }

  /**
   * Start the paper trading engine
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[PaperTrading] Already running');
      return;
    }

    console.log('[PaperTrading] Starting paper trading engine...');
    this.isRunning = true;

    // Load existing open trades
    await this.loadOpenTrades();

    // Start price update loop
    this.priceUpdateInterval = setInterval(
      () => this.updateAllPrices(),
      ENGINE_CONFIG.priceUpdateIntervalMs
    );

    // Start auto-close check loop
    this.autoCloseInterval = setInterval(
      () => this.checkAutoClose(),
      ENGINE_CONFIG.autoCloseCheckIntervalMs
    );

    this.emit('started', { portfolio: this.getPortfolio() });
    console.log(`[PaperTrading] Engine started. Balance: $${this.portfolio.cashBalance.toFixed(2)}`);
  }

  /**
   * Stop the engine
   */
  stop(): void {
    console.log('[PaperTrading] Stopping...');
    this.isRunning = false;

    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
      this.priceUpdateInterval = null;
    }

    if (this.autoCloseInterval) {
      clearInterval(this.autoCloseInterval);
      this.autoCloseInterval = null;
    }

    this.emit('stopped');
  }

  /**
   * Execute a paper trade
   */
  async executeTrade(input: TradeInput): Promise<{
    success: boolean;
    trade: Trade | null;
    error: string | null;
  }> {
    const startTime = Date.now();

    try {
      // Validate input
      const validation = this.validateTrade(input);
      if (!validation.valid) {
        return { success: false, trade: null, error: validation.error || 'Validation failed' };
      }

      // Simulate slippage
      const slippage = input.entryPrice * ENGINE_CONFIG.simulatedSlippagePct;
      const executedPrice = input.direction === 'YES'
        ? input.entryPrice + slippage
        : input.entryPrice - slippage;

      // Calculate fees
      const fees = input.quantity * executedPrice * ENGINE_CONFIG.simulatedFeePct;

      // Calculate total cost
      const totalCost = (input.quantity * executedPrice) + fees;

      // Check if we have enough balance
      if (totalCost > this.portfolio.cashBalance) {
        return {
          success: false,
          trade: null,
          error: `Insufficient balance. Need $${totalCost.toFixed(2)}, have $${this.portfolio.cashBalance.toFixed(2)}`,
        };
      }

      // Create trade record
      const trade: Trade = {
        id: `paper-trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId: this.userId,
        mode: 'paper',
        platform: input.platform,
        marketId: input.marketId,
        marketTicker: input.marketTicker,
        marketTitle: input.marketTitle,
        category: input.category || inferCategory(input.marketTitle),
        direction: input.direction,
        orderType: input.orderType || 'market',
        entryPrice: executedPrice,
        exitPrice: null,
        quantity: input.quantity,
        quantityFilled: input.quantity,
        entryValueUsd: input.quantity * executedPrice,
        exitValueUsd: null,
        unrealizedPnl: 0,
        realizedPnl: null,
        pnlPercent: null,
        fees,
        strategy: input.strategy || 'manual',
        signalId: input.signalId || null,
        signalConfidence: input.signalConfidence || null,
        stopLossPrice: input.stopLossPrice || this.calculateDefaultStopLoss(executedPrice, input.direction),
        takeProfitPrice: input.takeProfitPrice || this.calculateDefaultTakeProfit(executedPrice, input.direction),
        maxLossUsd: input.maxLossUsd || null,
        createdAt: new Date(),
        filledAt: new Date(),
        closedAt: null,
        expiresAt: input.expiresAt || null,
        status: 'open',
        closeReason: null,
        executionLatencyMs: Date.now() - startTime,
        slippage,
        orderId: null,
        txSignature: null,
      };

      // Update portfolio
      this.portfolio.cashBalance -= totalCost;
      this.portfolio.totalTrades++;
      this.portfolio.lastTradeAt = new Date();
      this.portfolio.updatedAt = new Date();

      // Create position
      const position = this.createPosition(trade);
      this.positions.set(trade.id, position);
      this.portfolio.positionCount = this.positions.size;

      // Save to database
      try {
        await db.trading.createTrade({
          user_id: this.userId,
          mode: 'paper',
          platform: trade.platform as string,
          market_id: trade.marketId,
          market_ticker: trade.marketTicker,
          market_title: trade.marketTitle,
          category: trade.category,
          direction: trade.direction,
          order_type: trade.orderType,
          entry_price: trade.entryPrice,
          quantity: trade.quantity,
          entry_value_usd: trade.entryValueUsd,
          strategy: trade.strategy,
          signal_id: trade.signalId || undefined,
          signal_confidence: trade.signalConfidence || undefined,
          stop_loss_price: trade.stopLossPrice || undefined,
          take_profit_price: trade.takeProfitPrice || undefined,
        });
      } catch (dbError) {
        console.warn('[PaperTrading] Database save failed, continuing in-memory:', dbError);
      }

      this.emit('tradeExecuted', { trade, position, portfolio: this.getPortfolio() });
      console.log(`[PaperTrading] Trade executed: ${trade.direction} ${trade.quantity} @ $${executedPrice.toFixed(4)} on ${trade.marketTicker}`);

      return { success: true, trade, error: null };

    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error('[PaperTrading] Trade execution error:', error);
      return { success: false, trade: null, error };
    }
  }

  /**
   * Close a position
   */
  async closePosition(tradeId: string, reason: 'take_profit' | 'stop_loss' | 'manual' | 'expiry' = 'manual'): Promise<{
    success: boolean;
    trade: Trade | null;
    pnl: number;
    error: string | null;
  }> {
    const position = this.positions.get(tradeId);
    if (!position) {
      return { success: false, trade: null, pnl: 0, error: 'Position not found' };
    }

    try {
      // Get current price
      const currentPrice = await this.fetchCurrentPrice(position.platform as string, position.marketId);
      if (currentPrice === null) {
        return { success: false, trade: null, pnl: 0, error: 'Could not fetch current price' };
      }

      // Calculate P&L
      const exitPrice = position.direction === 'YES' ? currentPrice : 1 - currentPrice;
      const pnl = position.direction === 'YES'
        ? (exitPrice - position.avgEntryPrice) * position.quantity
        : (position.avgEntryPrice - exitPrice) * position.quantity;

      const fees = position.quantity * exitPrice * ENGINE_CONFIG.simulatedFeePct;
      const netPnl = pnl - fees;

      // Update portfolio
      const returnedValue = (position.quantity * exitPrice) - fees;
      this.portfolio.cashBalance += returnedValue;
      this.portfolio.realizedPnl += netPnl;

      // Update win/loss stats
      if (netPnl > 0) {
        this.portfolio.winningTrades++;
        this.portfolio.largestWin = Math.max(this.portfolio.largestWin, netPnl);
      } else {
        this.portfolio.losingTrades++;
        this.portfolio.largestLoss = Math.min(this.portfolio.largestLoss, netPnl);
      }

      // Calculate win rate
      const closedTrades = this.portfolio.winningTrades + this.portfolio.losingTrades;
      this.portfolio.winRate = closedTrades > 0
        ? this.portfolio.winningTrades / closedTrades
        : 0;

      // Remove position
      this.positions.delete(tradeId);
      this.portfolio.positionCount = this.positions.size;
      this.portfolio.updatedAt = new Date();

      // Update total value
      this.updateTotalValue();

      // Create closed trade record
      const closedTrade: Trade = {
        id: tradeId,
        userId: this.userId,
        mode: 'paper',
        platform: position.platform,
        marketId: position.marketId,
        marketTicker: position.marketTicker,
        marketTitle: position.marketTitle,
        category: position.category,
        direction: position.direction,
        orderType: 'market',
        entryPrice: position.avgEntryPrice,
        exitPrice,
        quantity: position.quantity,
        quantityFilled: position.quantity,
        entryValueUsd: position.costBasis,
        exitValueUsd: position.quantity * exitPrice,
        unrealizedPnl: 0,
        realizedPnl: netPnl,
        pnlPercent: position.avgEntryPrice > 0 ? netPnl / position.costBasis : 0,
        fees,
        strategy: 'manual',
        signalId: null,
        signalConfidence: null,
        stopLossPrice: position.stopLossPrice,
        takeProfitPrice: position.takeProfitPrice,
        maxLossUsd: null,
        createdAt: position.openedAt,
        filledAt: position.openedAt,
        closedAt: new Date(),
        expiresAt: position.expiresAt,
        status: 'closed',
        closeReason: reason,
        executionLatencyMs: null,
        slippage: null,
        orderId: null,
        txSignature: null,
      };

      // Update database
      try {
        await db.trading.closeTrade(tradeId, exitPrice, reason);
      } catch (dbError) {
        console.warn('[PaperTrading] Database close failed:', dbError);
      }

      this.emit('positionClosed', { trade: closedTrade, pnl: netPnl, reason, portfolio: this.getPortfolio() });
      console.log(`[PaperTrading] Position closed: ${reason} - P&L: $${netPnl.toFixed(2)}`);

      return { success: true, trade: closedTrade, pnl: netPnl, error: null };

    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error('[PaperTrading] Close position error:', error);
      return { success: false, trade: null, pnl: 0, error };
    }
  }

  /**
   * Get current portfolio state
   */
  getPortfolio(): VirtualPortfolio {
    // Update open positions list
    this.portfolio.openPositions = Array.from(this.positions.values());
    return { ...this.portfolio };
  }

  /**
   * Get all open positions
   */
  getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  /**
   * Get position by ID
   */
  getPosition(tradeId: string): Position | undefined {
    return this.positions.get(tradeId);
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Validate trade input
   */
  private validateTrade(input: TradeInput): { valid: boolean; error?: string } {
    // Check if engine is running
    if (!this.isRunning) {
      return { valid: false, error: 'Engine not running' };
    }

    // Check max positions
    if (this.positions.size >= ENGINE_CONFIG.maxOpenPositions) {
      return { valid: false, error: `Max positions (${ENGINE_CONFIG.maxOpenPositions}) reached` };
    }

    // Check quantity
    if (input.quantity <= 0) {
      return { valid: false, error: 'Quantity must be positive' };
    }

    // Check price
    if (input.entryPrice <= 0 || input.entryPrice >= 1) {
      return { valid: false, error: 'Price must be between 0 and 1' };
    }

    // Check position size limit
    const positionValue = input.quantity * input.entryPrice;
    const maxPositionSize = this.portfolio.totalValue * this.riskConfig.maxPositionSizePct;
    if (positionValue > maxPositionSize) {
      return {
        valid: false,
        error: `Position size ($${positionValue.toFixed(2)}) exceeds max (${(this.riskConfig.maxPositionSizePct * 100).toFixed(0)}% = $${maxPositionSize.toFixed(2)})`,
      };
    }

    // Check daily loss limit
    const todaysPnl = this.calculateTodaysPnl();
    if (todaysPnl < -this.riskConfig.maxDailyLossUsd) {
      return {
        valid: false,
        error: `Daily loss limit ($${this.riskConfig.maxDailyLossUsd}) reached. Today's P&L: $${todaysPnl.toFixed(2)}`,
      };
    }

    // Check category exposure
    const categoryPositions = Array.from(this.positions.values())
      .filter(p => p.category === (input.category || inferCategory(input.marketTitle)));
    const categoryExposure = categoryPositions.reduce((sum, p) => sum + p.currentValue, 0);
    const maxCategoryExposure = this.portfolio.totalValue * this.riskConfig.maxCategoryExposurePct;
    if (categoryExposure + positionValue > maxCategoryExposure) {
      return {
        valid: false,
        error: `Category exposure limit (${(this.riskConfig.maxCategoryExposurePct * 100).toFixed(0)}%) would be exceeded`,
      };
    }

    return { valid: true };
  }

  /**
   * Create position from trade
   */
  private createPosition(trade: Trade): Position {
    return {
      id: trade.id,
      tradeId: trade.id,
      userId: this.userId,
      mode: 'paper',
      platform: trade.platform,
      marketId: trade.marketId,
      marketTicker: trade.marketTicker,
      marketTitle: trade.marketTitle,
      category: trade.category,
      direction: trade.direction,
      quantity: trade.quantity,
      avgEntryPrice: trade.entryPrice,
      currentPrice: trade.entryPrice,
      costBasis: trade.entryValueUsd,
      currentValue: trade.entryValueUsd,
      unrealizedPnl: 0,
      unrealizedPnlPercent: 0,
      stopLossPrice: trade.stopLossPrice,
      takeProfitPrice: trade.takeProfitPrice,
      riskScore: this.calculateRiskScore(trade),
      openedAt: trade.createdAt,
      expiresAt: trade.expiresAt,
      daysToExpiry: trade.expiresAt
        ? (trade.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        : null,
      isOpen: true,
    };
  }

  /**
   * Calculate default stop loss price
   */
  private calculateDefaultStopLoss(entryPrice: number, direction: TradeDirection): number {
    const stopLossPct = this.riskConfig.defaultStopLossPct;
    if (direction === 'YES') {
      return Math.max(0.01, entryPrice * (1 - stopLossPct));
    } else {
      return Math.min(0.99, entryPrice * (1 + stopLossPct));
    }
  }

  /**
   * Calculate default take profit price
   */
  private calculateDefaultTakeProfit(entryPrice: number, direction: TradeDirection): number {
    const takeProfitPct = this.riskConfig.defaultTakeProfitPct;
    if (direction === 'YES') {
      return Math.min(0.99, entryPrice * (1 + takeProfitPct));
    } else {
      return Math.max(0.01, entryPrice * (1 - takeProfitPct));
    }
  }

  /**
   * Calculate risk score for a trade
   */
  private calculateRiskScore(trade: Trade): number {
    let score = 50;

    // Higher risk for extreme prices
    if (trade.entryPrice < 0.1 || trade.entryPrice > 0.9) score += 15;

    // Higher risk for larger positions
    const positionPct = trade.entryValueUsd / this.portfolio.totalValue;
    if (positionPct > 0.10) score += 20;
    else if (positionPct > 0.05) score += 10;

    // Higher risk without stop loss
    if (!trade.stopLossPrice) score += 15;

    return Math.min(100, score);
  }

  /**
   * Load existing open trades from database
   */
  private async loadOpenTrades(): Promise<void> {
    try {
      const trades = await db.trading.getOpenTrades(this.userId, 'paper');

      for (const trade of trades) {
        const position: Position = {
          id: trade.id,
          tradeId: trade.id,
          userId: this.userId,
          mode: 'paper',
          platform: trade.platform,
          marketId: trade.market_id,
          marketTicker: trade.market_ticker,
          marketTitle: trade.market_title,
          category: trade.category,
          direction: trade.direction as TradeDirection,
          quantity: trade.quantity,
          avgEntryPrice: trade.entry_price,
          currentPrice: trade.entry_price,
          costBasis: trade.entry_value_usd,
          currentValue: trade.entry_value_usd,
          unrealizedPnl: trade.unrealized_pnl || 0,
          unrealizedPnlPercent: 0,
          stopLossPrice: trade.stop_loss_price,
          takeProfitPrice: trade.take_profit_price,
          riskScore: 50,
          openedAt: new Date(trade.created_at),
          expiresAt: trade.expires_at ? new Date(trade.expires_at) : null,
          daysToExpiry: null,
          isOpen: true,
        };

        this.positions.set(trade.id, position);
      }

      // Update portfolio value
      this.updateTotalValue();

      console.log(`[PaperTrading] Loaded ${trades.length} open positions`);
    } catch (err) {
      console.warn('[PaperTrading] Could not load trades from database:', err);
    }
  }

  /**
   * Update all position prices
   */
  private async updateAllPrices(): Promise<void> {
    if (!this.isRunning) return;

    let totalUnrealizedPnl = 0;
    let portfolioValue = 0;

    for (const [id, position] of this.positions) {
      try {
        const currentPrice = await this.fetchCurrentPrice(position.platform as string, position.marketId);
        if (currentPrice !== null) {
          // Adjust for direction
          const adjustedPrice = position.direction === 'YES' ? currentPrice : 1 - currentPrice;

          // Update position
          position.currentPrice = adjustedPrice;
          position.currentValue = position.quantity * adjustedPrice;
          position.unrealizedPnl = position.currentValue - position.costBasis;
          position.unrealizedPnlPercent = position.costBasis > 0
            ? position.unrealizedPnl / position.costBasis
            : 0;

          // Update days to expiry
          if (position.expiresAt) {
            position.daysToExpiry = (position.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
          }

          totalUnrealizedPnl += position.unrealizedPnl;
          portfolioValue += position.currentValue;
        }
      } catch (err) {
        console.warn(`[PaperTrading] Price update failed for ${position.marketTicker}:`, err);
      }
    }

    // Update portfolio
    this.portfolio.unrealizedPnl = totalUnrealizedPnl;
    this.portfolio.portfolioValue = portfolioValue;
    this.updateTotalValue();

    this.emit('pricesUpdated', { positions: this.getPositions(), portfolio: this.getPortfolio() });
  }

  /**
   * Check for auto-close conditions (stop loss / take profit)
   */
  private async checkAutoClose(): Promise<void> {
    if (!this.isRunning) return;

    for (const [id, position] of this.positions) {
      // Check stop loss
      if (position.stopLossPrice !== null) {
        const shouldTriggerStopLoss = position.direction === 'YES'
          ? position.currentPrice <= position.stopLossPrice
          : position.currentPrice >= position.stopLossPrice;

        if (shouldTriggerStopLoss) {
          console.log(`[PaperTrading] Stop loss triggered for ${position.marketTicker}`);
          await this.closePosition(id, 'stop_loss');
          continue;
        }
      }

      // Check take profit
      if (position.takeProfitPrice !== null) {
        const shouldTriggerTakeProfit = position.direction === 'YES'
          ? position.currentPrice >= position.takeProfitPrice
          : position.currentPrice <= position.takeProfitPrice;

        if (shouldTriggerTakeProfit) {
          console.log(`[PaperTrading] Take profit triggered for ${position.marketTicker}`);
          await this.closePosition(id, 'take_profit');
          continue;
        }
      }

      // Check expiry
      if (position.daysToExpiry !== null && position.daysToExpiry <= 0) {
        console.log(`[PaperTrading] Position expired for ${position.marketTicker}`);
        await this.closePosition(id, 'expiry');
      }
    }
  }

  /**
   * Fetch current price from platform
   */
  private async fetchCurrentPrice(platform: string, marketId: string): Promise<number | null> {
    try {
      if (platform === 'dflow' || platform === 'kalshi') {
        const result = await getMarket(marketId);
        if (result.success && result.data) {
          return parseFloat(result.data.yesBid || '0.5');
        }
      } else if (platform === 'kalshi') {
        const market = await getKalshiMarket(marketId);
        if (market) {
          return market.yes_bid / 100;
        }
      }
      // Default fallback - return null to indicate price not available
      return null;
    } catch (err) {
      console.warn(`[PaperTrading] Price fetch failed for ${platform}/${marketId}:`, err);
      return null;
    }
  }

  /**
   * Update total portfolio value
   */
  private updateTotalValue(): void {
    this.portfolio.totalValue = this.portfolio.cashBalance + this.portfolio.portfolioValue;
    this.portfolio.totalPnl = this.portfolio.totalValue - this.portfolio.initialBalance;
    this.portfolio.totalPnlPercent = this.portfolio.initialBalance > 0
      ? this.portfolio.totalPnl / this.portfolio.initialBalance
      : 0;

    // Update drawdown
    if (this.portfolio.totalValue > this.peakValue) {
      this.peakValue = this.portfolio.totalValue;
    }
    this.portfolio.currentDrawdown = this.peakValue - this.portfolio.totalValue;
    this.portfolio.maxDrawdown = Math.max(this.portfolio.maxDrawdown, this.portfolio.currentDrawdown);
    this.portfolio.maxDrawdownPercent = this.peakValue > 0
      ? this.portfolio.maxDrawdown / this.peakValue
      : 0;

    this.portfolio.updatedAt = new Date();
  }

  /**
   * Calculate today's P&L
   */
  private calculateTodaysPnl(): number {
    // This would need to track daily P&L history
    // For now, return realized + unrealized
    return this.portfolio.realizedPnl + this.portfolio.unrealizedPnl;
  }

  /**
   * Save portfolio snapshot
   */
  async saveSnapshot(): Promise<void> {
    try {
      await db.trading.savePortfolioSnapshot({
        user_id: this.userId,
        mode: 'paper',
        cash_balance: this.portfolio.cashBalance,
        portfolio_value: this.portfolio.portfolioValue,
        total_value: this.portfolio.totalValue,
        total_pnl: this.portfolio.totalPnl,
        total_pnl_percent: this.portfolio.totalPnlPercent,
        realized_pnl: this.portfolio.realizedPnl,
        unrealized_pnl: this.portfolio.unrealizedPnl,
        total_trades: this.portfolio.totalTrades,
        winning_trades: this.portfolio.winningTrades,
        losing_trades: this.portfolio.losingTrades,
        win_rate: this.portfolio.winRate,
        sharpe_ratio: this.portfolio.sharpeRatio || undefined,
        max_drawdown: this.portfolio.maxDrawdown,
        max_drawdown_percent: this.portfolio.maxDrawdownPercent,
        position_count: this.portfolio.positionCount,
      });
      console.log('[PaperTrading] Portfolio snapshot saved');
    } catch (err) {
      console.warn('[PaperTrading] Failed to save snapshot:', err);
    }
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    totalReturn: number;
    totalReturnPct: number;
    winRate: number;
    profitFactor: number;
    maxDrawdownPct: number;
    tradesCount: number;
    avgWin: number;
    avgLoss: number;
    sharpeRatio: number | null;
  } {
    const closedTrades = this.portfolio.winningTrades + this.portfolio.losingTrades;
    const totalWins = this.portfolio.winningTrades > 0
      ? this.portfolio.largestWin // Simplified - would need full history
      : 0;
    const totalLosses = this.portfolio.losingTrades > 0
      ? Math.abs(this.portfolio.largestLoss)
      : 0;

    return {
      totalReturn: this.portfolio.totalPnl,
      totalReturnPct: this.portfolio.totalPnlPercent,
      winRate: this.portfolio.winRate,
      profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
      maxDrawdownPct: this.portfolio.maxDrawdownPercent,
      tradesCount: this.portfolio.totalTrades,
      avgWin: this.portfolio.winningTrades > 0 ? totalWins / this.portfolio.winningTrades : 0,
      avgLoss: this.portfolio.losingTrades > 0 ? totalLosses / this.portfolio.losingTrades : 0,
      sharpeRatio: this.portfolio.sharpeRatio,
    };
  }
}

// ============================================
// SINGLETON & FACTORY
// ============================================

const engineInstances: Map<string, PaperTradingEngine> = new Map();

export function getPaperTradingEngine(
  userId: string,
  initialBalance?: number,
  riskConfig?: Partial<RiskConfig>
): PaperTradingEngine {
  let engine = engineInstances.get(userId);
  if (!engine) {
    engine = new PaperTradingEngine(userId, initialBalance, riskConfig);
    engineInstances.set(userId, engine);
  }
  return engine;
}

export function stopAllEngines(): void {
  for (const engine of engineInstances.values()) {
    engine.stop();
  }
  engineInstances.clear();
}

// ============================================
// CLI INTERFACE
// ============================================

if (require.main === module) {
  const command = process.argv[2] || 'status';
  const userId = process.env.AUTONOMOUS_AGENT_USER_ID || 'paper-test-user';

  const engine = new PaperTradingEngine(userId, 1000);

  switch (command) {
    case 'start':
      engine.start().then(() => {
        console.log('\n📊 Paper Trading Engine Running');
        console.log('Press Ctrl+C to stop\n');
      });

      process.on('SIGINT', async () => {
        await engine.saveSnapshot();
        engine.stop();
        process.exit(0);
      });
      break;

    case 'test':
      engine.start().then(async () => {
        console.log('\n🧪 Running test trade...\n');

        const result = await engine.executeTrade({
          userId,
          mode: 'paper',
          platform: 'kalshi',
          marketId: 'test-market',
          marketTicker: 'TEST-MARKET',
          marketTitle: 'Test Market for Paper Trading',
          direction: 'YES',
          entryPrice: 0.50,
          quantity: 10,
          strategy: 'manual',
        });

        console.log('Trade result:', result);
        console.log('\nPortfolio:', engine.getPortfolio());

        engine.stop();
        process.exit(0);
      });
      break;

    case 'status':
    default:
      console.log('\n📊 Paper Trading Engine');
      console.log('═'.repeat(40));
      console.log(`User: ${userId}`);
      console.log(`Initial Balance: $${engine.getPortfolio().initialBalance}`);
      console.log('\nUsage:');
      console.log('  ts-node paperTradingEngine.ts start  # Run engine');
      console.log('  ts-node paperTradingEngine.ts test   # Execute test trade');
      console.log('  ts-node paperTradingEngine.ts status # Show status');
      process.exit(0);
  }
}

export type { Trade, Position, VirtualPortfolio };
