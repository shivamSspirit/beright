/**
 * Trade Execution Layer
 *
 * The master orchestrator that connects:
 * - Strategy Framework (signal generation)
 * - Risk Manager (position sizing, limits)
 * - Smart Order Router (execution)
 * - Paper Trading Engine (simulation)
 * - Performance Tracker (analytics)
 *
 * Provides a unified interface for autonomous trading
 */

import { EventEmitter } from 'events';
import { db } from '../lib/supabase/client';
import { PaperTradingEngine, getPaperTradingEngine } from './paperTradingEngine';
import { StrategyFramework, getStrategyFramework, MarketContext } from './strategyFramework';
import { RiskManager, getRiskManager } from './riskManager';
import { SmartOrderRouter, getSmartOrderRouter } from './smartOrderRouter';
import { getScanner as getAutonomousScanner, OpportunityScore } from './autonomousScanner';
import {
  Trade,
  Position,
  VirtualPortfolio,
  StrategySignal,
  TradingMode,
  StrategyType,
  RiskConfig,
  TradingSettings,
  DEFAULT_RISK_CONFIG,
  DEFAULT_STRATEGY_CONFIGS,
  inferCategory,
} from '../types/trading';
import { Market } from '../types/market';

// ============================================
// CONFIGURATION
// ============================================

interface ExecutionConfig {
  // Operating mode
  mode: TradingMode;
  autoExecute: boolean;

  // Strategies
  enabledStrategies: StrategyType[];

  // Execution settings
  scanIntervalMs: number;
  maxConcurrentTrades: number;
  cooldownBetweenTradesMs: number;

  // Notifications
  telegramChatId: number | null;
  notifyOnTrade: boolean;
  notifyOnSignal: boolean;
  notifyOnAlert: boolean;
}

const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = {
  mode: 'paper',
  autoExecute: false,
  enabledStrategies: ['arbitrage', 'information_speed', 'mean_reversion', 'resolution_timing', 'consensus_flip'],
  scanIntervalMs: 5 * 60 * 1000, // 5 minutes
  maxConcurrentTrades: 5,
  cooldownBetweenTradesMs: 60 * 1000, // 1 minute
  telegramChatId: null,
  notifyOnTrade: true,
  notifyOnSignal: true,
  notifyOnAlert: true,
};

// ============================================
// EXECUTION LAYER
// ============================================

export class TradeExecutionLayer extends EventEmitter {
  private userId: string;
  private config: ExecutionConfig;
  private riskConfig: RiskConfig;

  // Components
  private paperEngine: PaperTradingEngine;
  private strategyFramework: StrategyFramework;
  private riskManager: RiskManager;
  private orderRouter: SmartOrderRouter;

  // State
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private lastTradeTime: Date | null = null;
  private pendingSignals: Map<string, StrategySignal> = new Map();
  private executedSignals: Set<string> = new Set();

  // Stats
  private sessionStats = {
    startTime: new Date(),
    signalsGenerated: 0,
    signalsExecuted: 0,
    signalsSkipped: 0,
    tradesWon: 0,
    tradesLost: 0,
    totalPnl: 0,
  };

  constructor(
    userId: string,
    executionConfig?: Partial<ExecutionConfig>,
    riskConfig?: Partial<RiskConfig>
  ) {
    super();
    this.userId = userId;
    this.config = { ...DEFAULT_EXECUTION_CONFIG, ...executionConfig };
    this.riskConfig = { ...DEFAULT_RISK_CONFIG, ...riskConfig };

    // Initialize components
    this.paperEngine = getPaperTradingEngine(userId, 1000, this.riskConfig);
    this.strategyFramework = getStrategyFramework();
    this.riskManager = getRiskManager(userId, this.riskConfig);
    this.orderRouter = getSmartOrderRouter();

    // Set up strategy enablement
    for (const strategy of Object.keys(DEFAULT_STRATEGY_CONFIGS) as StrategyType[]) {
      if (this.config.enabledStrategies.includes(strategy)) {
        this.strategyFramework.enableStrategy(strategy);
      } else {
        this.strategyFramework.disableStrategy(strategy);
      }
    }

    // Listen to events
    this.setupEventListeners();
  }

  /**
   * Start the execution layer
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[ExecutionLayer] Already running');
      return;
    }

    console.log('[ExecutionLayer] Starting trade execution layer...');
    console.log(`[ExecutionLayer] Mode: ${this.config.mode.toUpperCase()}`);
    console.log(`[ExecutionLayer] Auto-execute: ${this.config.autoExecute ? 'ON' : 'OFF'}`);
    console.log(`[ExecutionLayer] Enabled strategies: ${this.config.enabledStrategies.join(', ')}`);

    this.isRunning = true;
    this.sessionStats.startTime = new Date();

    // Start paper engine
    await this.paperEngine.start();

    // Start scanning loop
    this.scanInterval = setInterval(
      () => this.runScanCycle(),
      this.config.scanIntervalMs
    );

    // Run initial scan
    await this.runScanCycle();

    this.emit('started', { config: this.config, mode: this.config.mode });
    console.log('[ExecutionLayer] Started successfully');
  }

  /**
   * Stop the execution layer
   */
  async stop(): Promise<void> {
    console.log('[ExecutionLayer] Stopping...');
    this.isRunning = false;

    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    // Save final snapshot
    await this.paperEngine.saveSnapshot();

    this.paperEngine.stop();
    this.emit('stopped', { stats: this.sessionStats });
    console.log('[ExecutionLayer] Stopped');
  }

  /**
   * Run a scan and evaluation cycle
   */
  async runScanCycle(): Promise<{
    marketsScanned: number;
    signalsGenerated: number;
    tradesExecuted: number;
  }> {
    if (!this.isRunning) return { marketsScanned: 0, signalsGenerated: 0, tradesExecuted: 0 };

    console.log('[ExecutionLayer] Running scan cycle...');

    let marketsScanned = 0;
    let signalsGenerated = 0;
    let tradesExecuted = 0;

    try {
      // Get opportunities from scanner
      const scanner = getAutonomousScanner();
      if (!scanner) {
        return { marketsScanned: 0, signalsGenerated: 0, tradesExecuted: 0 };
      }
      const scanResult = await scanner.scan();
      marketsScanned = scanResult.marketsScanned;

      // Evaluate each opportunity with strategy framework
      for (const opportunity of scanResult.topOpportunities) {
        const context = this.opportunityToContext(opportunity);
        const evaluations = await this.strategyFramework.evaluateAll(context);

        for (const evaluation of evaluations) {
          if (evaluation.shouldTrade && evaluation.signal) {
            signalsGenerated++;
            this.sessionStats.signalsGenerated++;

            // Store pending signal
            this.pendingSignals.set(evaluation.signal.id, evaluation.signal);
            this.emit('signalGenerated', evaluation.signal);

            // Auto-execute if enabled
            if (this.config.autoExecute && !this.executedSignals.has(evaluation.signal.id)) {
              const executed = await this.executeSignal(evaluation.signal);
              if (executed) {
                tradesExecuted++;
              }
            }
          }
        }
      }

      console.log(`[ExecutionLayer] Scan complete: ${marketsScanned} markets, ${signalsGenerated} signals, ${tradesExecuted} trades`);

    } catch (err) {
      console.error('[ExecutionLayer] Scan cycle error:', err);
    }

    return { marketsScanned, signalsGenerated, tradesExecuted };
  }

  /**
   * Execute a trading signal
   */
  async executeSignal(signal: StrategySignal): Promise<boolean> {
    // Check cooldown
    if (this.lastTradeTime) {
      const timeSince = Date.now() - this.lastTradeTime.getTime();
      if (timeSince < this.config.cooldownBetweenTradesMs) {
        console.log(`[ExecutionLayer] Cooldown active, ${(this.config.cooldownBetweenTradesMs - timeSince) / 1000}s remaining`);
        return false;
      }
    }

    // Check if already executed
    if (this.executedSignals.has(signal.id)) {
      console.log(`[ExecutionLayer] Signal ${signal.id} already executed`);
      return false;
    }

    // Check concurrent trade limit
    const openPositions = this.paperEngine.getPositions();
    if (openPositions.length >= this.config.maxConcurrentTrades) {
      console.log(`[ExecutionLayer] Max concurrent trades (${this.config.maxConcurrentTrades}) reached`);
      this.sessionStats.signalsSkipped++;
      return false;
    }

    // Execute through order router
    const result = await this.orderRouter.executeOrder({
      userId: this.userId,
      mode: this.config.mode,
      marketId: signal.marketId,
      marketTicker: signal.marketTicker,
      direction: signal.direction,
      orderType: 'market',
      quantity: Math.max(1, Math.floor(signal.recommendedSize * 100)), // Convert to shares
      strategy: signal.strategyType,
      signalId: signal.id,
    });

    if (result.success) {
      this.executedSignals.add(signal.id);
      this.pendingSignals.delete(signal.id);
      this.lastTradeTime = new Date();
      this.sessionStats.signalsExecuted++;

      this.emit('tradeExecuted', {
        signal,
        trade: result.trade,
        result,
      });

      console.log(`[ExecutionLayer] Trade executed: ${signal.direction} on ${signal.marketTicker}`);
      return true;
    } else {
      console.log(`[ExecutionLayer] Trade failed: ${result.error}`);
      this.sessionStats.signalsSkipped++;
      return false;
    }
  }

  /**
   * Manually execute a trade (bypasses strategy framework)
   */
  async manualTrade(params: {
    platform: string;
    marketId: string;
    marketTicker: string;
    marketTitle: string;
    direction: 'YES' | 'NO';
    quantity: number;
    price: number;
  }): Promise<{ success: boolean; trade: Trade | null; error: string | null }> {
    const result = await this.orderRouter.executeOrder({
      userId: this.userId,
      mode: this.config.mode,
      platform: params.platform,
      marketId: params.marketId,
      marketTicker: params.marketTicker,
      direction: params.direction,
      orderType: 'limit',
      quantity: params.quantity,
      limitPrice: params.price,
      strategy: 'manual',
    });

    if (result.success && result.trade) {
      this.lastTradeTime = new Date();
      this.emit('manualTradeExecuted', result.trade);
    }

    return {
      success: result.success,
      trade: result.trade,
      error: result.error,
    };
  }

  /**
   * Close a position
   */
  async closePosition(tradeId: string, reason: 'manual' | 'take_profit' | 'stop_loss' = 'manual'): Promise<{
    success: boolean;
    pnl: number;
    error: string | null;
  }> {
    const result = await this.paperEngine.closePosition(tradeId, reason);

    if (result.success) {
      this.sessionStats.totalPnl += result.pnl;
      if (result.pnl > 0) {
        this.sessionStats.tradesWon++;
      } else {
        this.sessionStats.tradesLost++;
      }

      // Update risk manager
      this.riskManager.recordTradePnl(result.pnl);
    }

    return {
      success: result.success,
      pnl: result.pnl,
      error: result.error,
    };
  }

  /**
   * Get current portfolio
   */
  getPortfolio(): VirtualPortfolio {
    return this.paperEngine.getPortfolio();
  }

  /**
   * Get open positions
   */
  getPositions(): Position[] {
    return this.paperEngine.getPositions();
  }

  /**
   * Get pending signals
   */
  getPendingSignals(): StrategySignal[] {
    // Filter out expired signals
    const now = new Date();
    const pending: StrategySignal[] = [];

    for (const [id, signal] of this.pendingSignals) {
      if (signal.expiresAt > now && !this.executedSignals.has(id)) {
        pending.push(signal);
      } else {
        this.pendingSignals.delete(id);
      }
    }

    return pending;
  }

  /**
   * Get session statistics
   */
  getSessionStats(): typeof this.sessionStats & {
    runningTime: string;
    winRate: number;
    avgPnl: number;
  } {
    const runningMs = Date.now() - this.sessionStats.startTime.getTime();
    const hours = Math.floor(runningMs / (1000 * 60 * 60));
    const minutes = Math.floor((runningMs % (1000 * 60 * 60)) / (1000 * 60));

    const totalClosed = this.sessionStats.tradesWon + this.sessionStats.tradesLost;

    return {
      ...this.sessionStats,
      runningTime: `${hours}h ${minutes}m`,
      winRate: totalClosed > 0 ? this.sessionStats.tradesWon / totalClosed : 0,
      avgPnl: totalClosed > 0 ? this.sessionStats.totalPnl / totalClosed : 0,
    };
  }

  /**
   * Get risk summary
   */
  getRiskSummary() {
    const portfolio = this.getPortfolio();
    this.riskManager.updateState({
      totalValue: portfolio.totalValue,
      cashBalance: portfolio.cashBalance,
      portfolioValue: portfolio.portfolioValue,
      openPositions: portfolio.openPositions,
      unrealizedPnl: portfolio.unrealizedPnl,
      realizedPnl: portfolio.realizedPnl,
      winRate: portfolio.winRate,
    });

    return this.riskManager.getRiskSummary();
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ExecutionConfig>): void {
    this.config = { ...this.config, ...updates };

    // Update strategy enablement
    if (updates.enabledStrategies) {
      for (const strategy of Object.keys(DEFAULT_STRATEGY_CONFIGS) as StrategyType[]) {
        if (updates.enabledStrategies.includes(strategy)) {
          this.strategyFramework.enableStrategy(strategy);
        } else {
          this.strategyFramework.disableStrategy(strategy);
        }
      }
    }

    this.emit('configUpdated', this.config);
  }

  /**
   * Enable/disable auto-execute
   */
  setAutoExecute(enabled: boolean): void {
    this.config.autoExecute = enabled;
    console.log(`[ExecutionLayer] Auto-execute: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    this.emit('autoExecuteChanged', enabled);
  }

  /**
   * Switch trading mode
   */
  setMode(mode: TradingMode): void {
    if (this.isRunning) {
      console.warn('[ExecutionLayer] Cannot change mode while running. Stop first.');
      return;
    }
    this.config.mode = mode;
    console.log(`[ExecutionLayer] Mode set to: ${mode.toUpperCase()}`);
  }

  /**
   * Get current configuration
   */
  getConfig(): ExecutionConfig {
    return { ...this.config };
  }

  /**
   * Convert opportunity to market context
   */
  private opportunityToContext(opportunity: OpportunityScore): MarketContext {
    return {
      market: {} as Market,
      platform: 'kalshi',
      marketId: opportunity.ticker,
      ticker: opportunity.ticker,
      title: opportunity.title,
      currentPrice: opportunity.currentPrice,
      volume: opportunity.volume,
      category: opportunity.category,
      consensusShift: opportunity.expectedEdge,
    };
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Strategy signals
    this.strategyFramework.on('signal', (signal: StrategySignal) => {
      this.emit('strategySignal', signal);
    });

    // Paper engine events
    this.paperEngine.on('tradeExecuted', (data) => {
      this.emit('paperTradeExecuted', data);
    });

    this.paperEngine.on('positionClosed', (data) => {
      this.emit('paperPositionClosed', data);
    });

    // Risk manager events
    this.riskManager.on('circuitBreakerTriggered', (data) => {
      this.emit('circuitBreakerTriggered', data);
      console.log('[ExecutionLayer] CIRCUIT BREAKER TRIGGERED - Trading halted');
    });

    this.riskManager.on('circuitBreakerReset', () => {
      this.emit('circuitBreakerReset');
      console.log('[ExecutionLayer] Circuit breaker reset - Trading resumed');
    });
  }
}

// ============================================
// SINGLETON
// ============================================

let executionLayerInstance: TradeExecutionLayer | null = null;

export function getTradeExecutionLayer(
  userId: string,
  executionConfig?: Partial<ExecutionConfig>,
  riskConfig?: Partial<RiskConfig>
): TradeExecutionLayer {
  if (!executionLayerInstance) {
    executionLayerInstance = new TradeExecutionLayer(userId, executionConfig, riskConfig);
  }
  return executionLayerInstance;
}

export function stopExecutionLayer(): void {
  if (executionLayerInstance) {
    executionLayerInstance.stop();
    executionLayerInstance = null;
  }
}

// ============================================
// CLI INTERFACE
// ============================================

if (require.main === module) {
  const command = process.argv[2] || 'status';
  const userId = process.env.AUTONOMOUS_AGENT_USER_ID || 'execution-test-user';

  const layer = new TradeExecutionLayer(userId, {
    mode: 'paper',
    autoExecute: false,
  });

  switch (command) {
    case 'start':
      layer.start().then(() => {
        console.log('\n🤖 Trade Execution Layer Running');
        console.log('Press Ctrl+C to stop\n');
      });

      process.on('SIGINT', async () => {
        await layer.stop();
        const stats = layer.getSessionStats();
        console.log('\n📊 Session Summary:');
        console.log(`  Running time: ${stats.runningTime}`);
        console.log(`  Signals generated: ${stats.signalsGenerated}`);
        console.log(`  Signals executed: ${stats.signalsExecuted}`);
        console.log(`  Win rate: ${(stats.winRate * 100).toFixed(1)}%`);
        console.log(`  Total P&L: $${stats.totalPnl.toFixed(2)}`);
        process.exit(0);
      });
      break;

    case 'scan':
      layer.start().then(async () => {
        console.log('\n🔍 Running single scan cycle...\n');
        const result = await layer.runScanCycle();
        console.log(`\nResults:`);
        console.log(`  Markets scanned: ${result.marketsScanned}`);
        console.log(`  Signals generated: ${result.signalsGenerated}`);
        console.log(`  Trades executed: ${result.tradesExecuted}`);

        const signals = layer.getPendingSignals();
        if (signals.length > 0) {
          console.log(`\nPending Signals:`);
          for (const s of signals) {
            console.log(`  ${s.strategyType}: ${s.direction} on ${s.marketTicker} (${s.confidence.toFixed(0)}% conf)`);
          }
        }

        await layer.stop();
        process.exit(0);
      });
      break;

    case 'status':
    default:
      console.log('\n⚡ Trade Execution Layer');
      console.log('═'.repeat(50));

      const config = layer.getConfig();
      console.log('\nConfiguration:');
      console.log(`  Mode: ${config.mode}`);
      console.log(`  Auto-execute: ${config.autoExecute}`);
      console.log(`  Enabled strategies: ${config.enabledStrategies.join(', ')}`);
      console.log(`  Scan interval: ${config.scanIntervalMs / 1000}s`);
      console.log(`  Max concurrent trades: ${config.maxConcurrentTrades}`);

      console.log('\n\nUsage:');
      console.log('  ts-node tradeExecutionLayer.ts status  # Show configuration');
      console.log('  ts-node tradeExecutionLayer.ts start   # Start continuous trading');
      console.log('  ts-node tradeExecutionLayer.ts scan    # Run single scan cycle');
      break;
  }
}

export type { ExecutionConfig };
