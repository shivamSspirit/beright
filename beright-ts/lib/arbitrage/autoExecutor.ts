/**
 * Auto-Arbitrage Executor - Autonomous Trade Execution
 *
 * Features:
 * - WebSocket price subscription (DFlow)
 * - Real-time arbitrage detection
 * - Auto-execute when spread exceeds threshold
 * - Risk controls (max position, daily loss limit, cooldown)
 * - P&L tracking
 *
 * Target: <100ms from opportunity detection to execution
 *
 * @author BeRight Protocol
 */

import { EventEmitter } from 'events';
import { Keypair } from '@solana/web3.js';
import { DFlowWebSocket, DFlowPriceUpdate, getDFlowWebSocket } from '../dflow/websocket';
import { getFastExecutionEngine, SwapParams, ArbitrageParams, ArbitrageResult } from '../execution/fastExecution';
import { EXECUTION_CONFIG } from '../../config/execution';
import { getLatencyTracker, formatMicroseconds } from '../execution/latencyTracker';

// ============================================================================
// TYPES
// ============================================================================

export interface AutoExecutorConfig {
  enabled: boolean;
  minSpreadPct: number;           // Minimum spread to trigger (e.g., 0.03 = 3%)
  maxPositionUsd: number;         // Max per trade
  maxDailyLossUsd: number;        // Stop trading if exceeded
  cooldownMs: number;             // Between auto-trades
  maxSlippageBps: number;         // Max allowed slippage
  maxConcurrentTrades: number;    // Max trades executing at once
  dryRun: boolean;                // Simulate without executing
}

export interface PriceSnapshot {
  ticker: string;
  yesBid: number;
  yesAsk: number;
  noBid: number;
  noAsk: number;
  timestamp: number;
  spread: number;
}

export interface ArbitrageOpportunity {
  id: string;
  ticker: string;
  side: 'YES' | 'NO';
  buyPrice: number;
  sellPrice: number;
  spreadPct: number;
  estimatedProfitUsd: number;
  detectedAt: number;
  confidence: number;
}

export interface TradeExecution {
  id: string;
  opportunityId: string;
  ticker: string;
  side: 'YES' | 'NO';
  positionSizeUsd: number;
  entryPrice: number;
  expectedProfit: number;
  actualProfit?: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
  latencyUs?: number;
  signature?: string;
  error?: string;
}

export interface DailyPnL {
  date: string;
  trades: number;
  wins: number;
  losses: number;
  grossProfit: number;
  grossLoss: number;
  netPnL: number;
  fees: number;
}

export interface ExecutorStats {
  isRunning: boolean;
  totalOpportunities: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalProfitUsd: number;
  totalLossUsd: number;
  netPnLUsd: number;
  avgLatencyMs: number;
  lastTradeAt?: number;
  dailyPnL: DailyPnL;
  currentState: 'idle' | 'monitoring' | 'executing' | 'cooldown' | 'stopped';
  cooldownUntil?: number;
}

// ============================================================================
// AUTO EXECUTOR
// ============================================================================

export class AutoArbitrageExecutor extends EventEmitter {
  private config: AutoExecutorConfig;
  private wsClient: DFlowWebSocket;
  private isRunning: boolean = false;
  private currentState: 'idle' | 'monitoring' | 'executing' | 'cooldown' | 'stopped' = 'idle';

  // Price tracking
  private priceCache: Map<string, PriceSnapshot> = new Map();
  private priceHistory: Map<string, PriceSnapshot[]> = new Map();
  private maxHistorySize: number = 100;

  // Execution tracking
  private pendingExecutions: Map<string, TradeExecution> = new Map();
  private completedExecutions: TradeExecution[] = [];
  private lastTradeAt: number = 0;

  // P&L tracking
  private dailyPnL: DailyPnL;
  private totalStats = {
    opportunities: 0,
    executions: 0,
    successful: 0,
    failed: 0,
    profit: 0,
    loss: 0,
    totalLatencyUs: 0,
  };

  // Wallet
  private signer: Keypair | null = null;

  constructor(config?: Partial<AutoExecutorConfig>) {
    super();
    this.config = {
      enabled: config?.enabled ?? EXECUTION_CONFIG.autoArbitrage.enabled,
      minSpreadPct: config?.minSpreadPct ?? EXECUTION_CONFIG.autoArbitrage.minSpreadPct,
      maxPositionUsd: config?.maxPositionUsd ?? EXECUTION_CONFIG.autoArbitrage.maxPositionUsd,
      maxDailyLossUsd: config?.maxDailyLossUsd ?? EXECUTION_CONFIG.autoArbitrage.maxDailyLossUsd,
      cooldownMs: config?.cooldownMs ?? EXECUTION_CONFIG.autoArbitrage.cooldownMs,
      maxSlippageBps: config?.maxSlippageBps ?? 300,
      maxConcurrentTrades: config?.maxConcurrentTrades ?? 1,
      dryRun: config?.dryRun ?? true,
    };

    this.wsClient = getDFlowWebSocket();
    this.dailyPnL = this.createEmptyDailyPnL();

    // Set up WebSocket event handlers
    this.setupWebSocketHandlers();
  }

  /**
   * Set the signer keypair for transactions
   */
  setSigner(signer: Keypair): void {
    this.signer = signer;
  }

  /**
   * Start the auto-executor
   */
  async start(tickers?: string[]): Promise<void> {
    if (this.isRunning) {
      console.log('[AutoExecutor] Already running');
      return;
    }

    if (!this.config.enabled) {
      console.log('[AutoExecutor] Auto-execution is disabled in config');
      return;
    }

    console.log('[AutoExecutor] Starting auto-arbitrage executor...');
    console.log('[AutoExecutor] Config:', {
      minSpread: `${(this.config.minSpreadPct * 100).toFixed(1)}%`,
      maxPosition: `$${this.config.maxPositionUsd}`,
      maxDailyLoss: `$${this.config.maxDailyLossUsd}`,
      cooldown: `${this.config.cooldownMs}ms`,
      dryRun: this.config.dryRun,
    });

    // Initialize fast execution engine
    const engine = getFastExecutionEngine();
    await engine.initialize();

    // Connect to WebSocket
    if (!this.wsClient.connected) {
      await this.wsClient.connect();
    }

    // Subscribe to price updates
    if (tickers && tickers.length > 0) {
      this.wsClient.subscribeToPrices(tickers);
    } else {
      this.wsClient.subscribeToAllPrices();
    }

    this.isRunning = true;
    this.currentState = 'monitoring';

    console.log('[AutoExecutor] Started and monitoring for opportunities');
    this.emit('started');
  }

  /**
   * Stop the auto-executor
   */
  stop(): void {
    console.log('[AutoExecutor] Stopping...');

    this.isRunning = false;
    this.currentState = 'stopped';

    this.emit('stopped', this.getStats());
    console.log('[AutoExecutor] Stopped');
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    this.wsClient.on('price', (update: DFlowPriceUpdate) => {
      this.handlePriceUpdate(update);
    });

    this.wsClient.on('connected', () => {
      console.log('[AutoExecutor] WebSocket connected');
      if (this.isRunning && this.currentState === 'stopped') {
        this.currentState = 'monitoring';
      }
    });

    this.wsClient.on('disconnected', () => {
      console.warn('[AutoExecutor] WebSocket disconnected');
    });

    this.wsClient.on('error', (error: Error) => {
      console.error('[AutoExecutor] WebSocket error:', error.message);
      this.emit('error', error);
    });
  }

  /**
   * Handle incoming price update
   */
  private handlePriceUpdate(update: DFlowPriceUpdate): void {
    const tracker = getLatencyTracker();
    tracker.start('price_process');

    try {
      // Parse prices
      const snapshot: PriceSnapshot = {
        ticker: update.market_ticker,
        yesBid: parseFloat(update.yes_bid),
        yesAsk: parseFloat(update.yes_ask),
        noBid: parseFloat(update.no_bid),
        noAsk: parseFloat(update.no_ask),
        timestamp: Date.now(),
        spread: 0,
      };

      // Calculate bid-ask spread
      snapshot.spread = snapshot.yesAsk - snapshot.yesBid;

      // Update cache
      this.priceCache.set(snapshot.ticker, snapshot);

      // Update history
      let history = this.priceHistory.get(snapshot.ticker) || [];
      history.push(snapshot);
      if (history.length > this.maxHistorySize) {
        history = history.slice(-this.maxHistorySize);
      }
      this.priceHistory.set(snapshot.ticker, history);

      // Check for arbitrage opportunity
      const opportunity = this.detectOpportunity(snapshot);

      if (opportunity) {
        this.totalStats.opportunities++;
        this.emit('opportunity', opportunity);

        // Check if we should execute
        if (this.shouldExecute(opportunity)) {
          this.executeOpportunity(opportunity);
        }
      }

      const elapsed = tracker.end('price_process');
      if (elapsed > 10_000) { // > 10ms
        console.warn(`[AutoExecutor] Slow price processing: ${formatMicroseconds(elapsed)}`);
      }
    } catch (error) {
      tracker.end('price_process');
      console.error('[AutoExecutor] Error processing price update:', error);
    }
  }

  /**
   * Detect arbitrage opportunity from price snapshot
   */
  private detectOpportunity(snapshot: PriceSnapshot): ArbitrageOpportunity | null {
    // Simple spread-based arbitrage detection
    // In a real scenario, you'd compare with other platforms

    // For DFlow internal arbitrage (YES + NO < 1)
    const yesCost = snapshot.yesAsk;
    const noCost = snapshot.noAsk;
    const totalCost = yesCost + noCost;

    // Arbitrage exists if total cost < 1 (guaranteed $1 payout)
    if (totalCost < 1) {
      const spreadPct = (1 - totalCost);

      if (spreadPct >= this.config.minSpreadPct) {
        return {
          id: `opp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          ticker: snapshot.ticker,
          side: 'YES', // Buy both YES and NO
          buyPrice: yesCost,
          sellPrice: 1 - noCost, // Effective sell price
          spreadPct,
          estimatedProfitUsd: spreadPct * this.config.maxPositionUsd,
          detectedAt: Date.now(),
          confidence: this.calculateConfidence(snapshot, spreadPct),
        };
      }
    }

    // Check for mispricing (YES + NO > 1)
    // This could indicate market inefficiency
    if (snapshot.yesBid + snapshot.noBid > 1) {
      const spreadPct = (snapshot.yesBid + snapshot.noBid - 1);

      if (spreadPct >= this.config.minSpreadPct) {
        return {
          id: `opp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          ticker: snapshot.ticker,
          side: 'NO', // Sell both (if we have positions)
          buyPrice: snapshot.yesAsk,
          sellPrice: snapshot.yesBid,
          spreadPct,
          estimatedProfitUsd: spreadPct * this.config.maxPositionUsd,
          detectedAt: Date.now(),
          confidence: this.calculateConfidence(snapshot, spreadPct),
        };
      }
    }

    return null;
  }

  /**
   * Calculate confidence score for opportunity
   */
  private calculateConfidence(snapshot: PriceSnapshot, spreadPct: number): number {
    let confidence = 50; // Base confidence

    // Higher spread = higher confidence
    if (spreadPct > 0.05) confidence += 20;
    else if (spreadPct > 0.03) confidence += 10;

    // Lower bid-ask spread = higher confidence
    if (snapshot.spread < 0.02) confidence += 15;
    else if (snapshot.spread < 0.05) confidence += 5;

    // Price history stability
    const history = this.priceHistory.get(snapshot.ticker);
    if (history && history.length > 10) {
      const recentPrices = history.slice(-10).map(h => h.yesBid);
      const volatility = this.calculateVolatility(recentPrices);
      if (volatility < 0.01) confidence += 15;
      else if (volatility < 0.03) confidence += 5;
    }

    return Math.min(100, Math.max(0, confidence));
  }

  /**
   * Calculate price volatility
   */
  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;

    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const squaredDiffs = prices.map(p => Math.pow(p - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / prices.length;

    return Math.sqrt(variance);
  }

  /**
   * Check if we should execute an opportunity
   */
  private shouldExecute(opportunity: ArbitrageOpportunity): boolean {
    // Check if enabled
    if (!this.config.enabled) {
      return false;
    }

    // Check if running
    if (!this.isRunning || this.currentState !== 'monitoring') {
      return false;
    }

    // Check signer
    if (!this.signer && !this.config.dryRun) {
      console.warn('[AutoExecutor] No signer set, skipping execution');
      return false;
    }

    // Check cooldown
    const now = Date.now();
    if (now - this.lastTradeAt < this.config.cooldownMs) {
      return false;
    }

    // Check concurrent trades
    if (this.pendingExecutions.size >= this.config.maxConcurrentTrades) {
      return false;
    }

    // Check daily loss limit
    if (this.dailyPnL.netPnL < -this.config.maxDailyLossUsd) {
      console.warn('[AutoExecutor] Daily loss limit reached, stopping auto-execution');
      this.currentState = 'stopped';
      this.emit('dailyLossLimitReached', this.dailyPnL);
      return false;
    }

    // Check minimum spread
    if (opportunity.spreadPct < this.config.minSpreadPct) {
      return false;
    }

    // Check confidence
    if (opportunity.confidence < 50) {
      return false;
    }

    return true;
  }

  /**
   * Execute an arbitrage opportunity
   */
  private async executeOpportunity(opportunity: ArbitrageOpportunity): Promise<void> {
    const tracker = getLatencyTracker();
    tracker.start('arb_execute');

    this.currentState = 'executing';
    this.totalStats.executions++;

    const execution: TradeExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      opportunityId: opportunity.id,
      ticker: opportunity.ticker,
      side: opportunity.side,
      positionSizeUsd: Math.min(opportunity.estimatedProfitUsd / opportunity.spreadPct, this.config.maxPositionUsd),
      entryPrice: opportunity.buyPrice,
      expectedProfit: opportunity.estimatedProfitUsd,
      status: 'pending',
      startedAt: Date.now(),
    };

    this.pendingExecutions.set(execution.id, execution);
    this.emit('executionStarted', execution);

    console.log(
      `[AutoExecutor] Executing ${opportunity.ticker} ` +
        `spread=${(opportunity.spreadPct * 100).toFixed(2)}% ` +
        `size=$${execution.positionSizeUsd.toFixed(2)} ` +
        `expected=$${opportunity.estimatedProfitUsd.toFixed(2)}`
    );

    try {
      execution.status = 'executing';

      if (this.config.dryRun) {
        // Simulate execution
        await this.sleep(50); // Simulate 50ms execution time

        execution.status = 'completed';
        execution.completedAt = Date.now();
        execution.latencyUs = tracker.end('arb_execute');
        execution.actualProfit = opportunity.estimatedProfitUsd * 0.9; // Assume 90% of expected
        execution.signature = `DRY_RUN_${Date.now()}`;

        console.log(
          `[AutoExecutor] DRY RUN completed in ${formatMicroseconds(execution.latencyUs)}: ` +
            `profit=$${execution.actualProfit?.toFixed(2)}`
        );
      } else {
        // Real execution
        const engine = getFastExecutionEngine();
        const result = await engine.executeArbitrage(
          {
            marketId: opportunity.ticker,
            buyPlatform: 'dflow',
            sellPlatform: 'dflow',
            side: opportunity.side,
            positionSizeUsd: execution.positionSizeUsd,
            spreadPct: opportunity.spreadPct,
            atomic: true,
          },
          this.signer!
        );

        execution.latencyUs = tracker.end('arb_execute');
        execution.completedAt = Date.now();

        if (result.success) {
          execution.status = 'completed';
          execution.actualProfit = result.profitUsd;
          execution.signature = result.buySignature;

          this.totalStats.successful++;
          this.totalStats.profit += execution.actualProfit || 0;

          this.updateDailyPnL(execution.actualProfit || 0, true);

          console.log(
            `[AutoExecutor] Execution completed in ${formatMicroseconds(execution.latencyUs)}: ` +
              `profit=$${execution.actualProfit?.toFixed(2)} sig=${execution.signature?.slice(0, 20)}...`
          );
        } else {
          execution.status = 'failed';
          execution.error = result.error;

          this.totalStats.failed++;
          this.totalStats.loss += execution.positionSizeUsd * 0.01; // Assume 1% loss on failed trades

          this.updateDailyPnL(-execution.positionSizeUsd * 0.01, false);

          console.error(`[AutoExecutor] Execution failed: ${result.error}`);
        }
      }

      this.totalStats.totalLatencyUs += execution.latencyUs || 0;
    } catch (error) {
      const elapsed = tracker.end('arb_execute');
      execution.status = 'failed';
      execution.latencyUs = elapsed;
      execution.error = error instanceof Error ? error.message : String(error);
      execution.completedAt = Date.now();

      this.totalStats.failed++;
      console.error(`[AutoExecutor] Execution error: ${execution.error}`);
    }

    // Move to completed
    this.pendingExecutions.delete(execution.id);
    this.completedExecutions.push(execution);
    this.lastTradeAt = Date.now();

    // Emit completion
    this.emit('executionCompleted', execution);

    // Enter cooldown
    this.currentState = 'cooldown';
    setTimeout(() => {
      if (this.isRunning) {
        this.currentState = 'monitoring';
      }
    }, this.config.cooldownMs);
  }

  /**
   * Update daily P&L
   */
  private updateDailyPnL(amount: number, isWin: boolean): void {
    const today = new Date().toISOString().split('T')[0];

    if (this.dailyPnL.date !== today) {
      // New day, reset daily P&L
      this.dailyPnL = this.createEmptyDailyPnL();
    }

    this.dailyPnL.trades++;
    if (isWin) {
      this.dailyPnL.wins++;
      this.dailyPnL.grossProfit += amount;
    } else {
      this.dailyPnL.losses++;
      this.dailyPnL.grossLoss += Math.abs(amount);
    }
    this.dailyPnL.netPnL = this.dailyPnL.grossProfit - this.dailyPnL.grossLoss;
  }

  /**
   * Create empty daily P&L
   */
  private createEmptyDailyPnL(): DailyPnL {
    return {
      date: new Date().toISOString().split('T')[0],
      trades: 0,
      wins: 0,
      losses: 0,
      grossProfit: 0,
      grossLoss: 0,
      netPnL: 0,
      fees: 0,
    };
  }

  /**
   * Get executor statistics
   */
  getStats(): ExecutorStats {
    const avgLatencyMs =
      this.totalStats.executions > 0
        ? this.totalStats.totalLatencyUs / this.totalStats.executions / 1000
        : 0;

    return {
      isRunning: this.isRunning,
      totalOpportunities: this.totalStats.opportunities,
      totalExecutions: this.totalStats.executions,
      successfulExecutions: this.totalStats.successful,
      failedExecutions: this.totalStats.failed,
      totalProfitUsd: this.totalStats.profit,
      totalLossUsd: this.totalStats.loss,
      netPnLUsd: this.totalStats.profit - this.totalStats.loss,
      avgLatencyMs,
      lastTradeAt: this.lastTradeAt || undefined,
      dailyPnL: this.dailyPnL,
      currentState: this.currentState,
      cooldownUntil:
        this.currentState === 'cooldown' ? this.lastTradeAt + this.config.cooldownMs : undefined,
    };
  }

  /**
   * Get recent executions
   */
  getRecentExecutions(limit: number = 10): TradeExecution[] {
    return this.completedExecutions.slice(-limit);
  }

  /**
   * Get current price cache
   */
  getPriceCache(): Map<string, PriceSnapshot> {
    return new Map(this.priceCache);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AutoExecutorConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[AutoExecutor] Config updated:', this.config);
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.totalStats = {
      opportunities: 0,
      executions: 0,
      successful: 0,
      failed: 0,
      profit: 0,
      loss: 0,
      totalLatencyUs: 0,
    };
    this.dailyPnL = this.createEmptyDailyPnL();
    this.completedExecutions = [];
    console.log('[AutoExecutor] Stats reset');
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalExecutor: AutoArbitrageExecutor | null = null;

export function getAutoArbitrageExecutor(): AutoArbitrageExecutor {
  if (!globalExecutor) {
    globalExecutor = new AutoArbitrageExecutor();
  }
  return globalExecutor;
}

export function initializeAutoExecutor(
  config?: Partial<AutoExecutorConfig>
): AutoArbitrageExecutor {
  if (!globalExecutor) {
    globalExecutor = new AutoArbitrageExecutor(config);
  }
  return globalExecutor;
}

export default AutoArbitrageExecutor;
