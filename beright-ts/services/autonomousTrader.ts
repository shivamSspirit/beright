/**
 * Autonomous Trader Daemon
 *
 * Runs 24/7 scanning markets and executing paper trades automatically.
 *
 * Features:
 * - Multi-platform scanning (Kalshi, Polymarket, DFlow)
 * - Strategy-based signal generation
 * - Automatic trade execution with risk controls
 * - Position management (stop-loss, take-profit)
 * - Telegram notifications
 * - Graceful shutdown handling
 */

import 'dotenv/config';
import { EventEmitter } from 'events';
import { getKalshiMarkets, getKalshiMarketsByCategory, isKalshiDemo } from '../lib/kalshi';
import { getHotMarkets as getDFlowHotMarkets } from '../lib/dflow/api';
import { getStrategyFramework } from './strategyFramework';
import type { MarketContext } from './strategyFramework';
import { getPaperTradingEngine } from './paperTradingEngine';
import { getRiskManager } from './riskManager';
import {
  StrategySignal,
  TradeDirection,
  DEFAULT_RISK_CONFIG,
} from '../types/trading';

// ============================================
// CONFIGURATION
// ============================================

interface AutoTraderConfig {
  // Scanning
  scanIntervalMs: number;          // How often to scan (default: 5 min)
  marketsPerScan: number;          // Max markets to evaluate per scan

  // Execution
  autoExecute: boolean;            // Auto-execute trades or just alert
  maxConcurrentPositions: number;  // Max open positions
  minConfidence: number;           // Min signal confidence to execute (0-100)
  minEdge: number;                 // Min edge to execute (0-1)

  // Risk
  maxDailyTrades: number;          // Max trades per day
  maxDailyLossUsd: number;         // Stop trading if daily loss exceeds
  defaultPositionSizeUsd: number;  // Default position size

  // Platforms
  enableKalshi: boolean;
  enablePolymarket: boolean;
  enableDFlow: boolean;

  // Notifications
  telegramChatId?: string;
  notifyOnSignal: boolean;
  notifyOnTrade: boolean;
  notifyOnError: boolean;
}

const DEFAULT_CONFIG: AutoTraderConfig = {
  scanIntervalMs: 5 * 60 * 1000,   // 5 minutes
  marketsPerScan: 100,

  autoExecute: true,
  maxConcurrentPositions: 10,
  minConfidence: 50,
  minEdge: 0.02,                   // 2% minimum edge

  maxDailyTrades: 20,
  maxDailyLossUsd: 100,
  defaultPositionSizeUsd: 25,

  enableKalshi: true,
  enablePolymarket: true,
  enableDFlow: true,

  notifyOnSignal: true,
  notifyOnTrade: true,
  notifyOnError: true,
};

// ============================================
// POLYMARKET FETCHER
// ============================================

async function fetchPolymarkets(limit: number = 50): Promise<any[]> {
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(
      `https://gamma-api.polymarket.com/markets?closed=false&limit=${limit}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!response.ok) return [];
    const data: any = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ============================================
// AUTONOMOUS TRADER CLASS
// ============================================

export class AutonomousTrader extends EventEmitter {
  private config: AutoTraderConfig;
  private userId: string;
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private positionCheckInterval: NodeJS.Timeout | null = null;

  // Stats
  private stats = {
    startTime: new Date(),
    scansCompleted: 0,
    signalsGenerated: 0,
    tradesExecuted: 0,
    tradesWon: 0,
    tradesLost: 0,
    totalPnl: 0,
    dailyTrades: 0,
    dailyPnl: 0,
    lastScanTime: null as Date | null,
    lastTradeTime: null as Date | null,
    errors: [] as string[],
  };

  // Components
  private framework = getStrategyFramework();
  private engine: ReturnType<typeof getPaperTradingEngine>;
  private riskManager: ReturnType<typeof getRiskManager>;

  constructor(userId: string = 'autonomous-trader', config: Partial<AutoTraderConfig> = {}) {
    super();
    this.userId = userId;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.engine = getPaperTradingEngine(userId);
    this.riskManager = getRiskManager(userId);
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[AutoTrader] Already running');
      return;
    }

    console.log('═'.repeat(60));
    console.log('[AutoTrader] Starting Autonomous Paper Trading Daemon');
    console.log('═'.repeat(60));
    console.log(`Mode: ${isKalshiDemo() ? 'DEMO (Paper)' : 'LIVE'}`);
    console.log(`Scan Interval: ${this.config.scanIntervalMs / 1000}s`);
    console.log(`Auto Execute: ${this.config.autoExecute}`);
    console.log(`Min Confidence: ${this.config.minConfidence}%`);
    console.log(`Min Edge: ${(this.config.minEdge * 100).toFixed(1)}%`);
    console.log(`Max Positions: ${this.config.maxConcurrentPositions}`);
    console.log(`Position Size: $${this.config.defaultPositionSizeUsd}`);
    console.log('─'.repeat(60));
    console.log('Platforms:', [
      this.config.enableKalshi && 'Kalshi',
      this.config.enablePolymarket && 'Polymarket',
      this.config.enableDFlow && 'DFlow',
    ].filter(Boolean).join(', '));
    console.log('Strategies:', this.framework.getEnabledStrategies().join(', '));
    console.log('═'.repeat(60) + '\n');

    this.isRunning = true;
    this.stats.startTime = new Date();

    // Start paper trading engine
    await this.engine.start();

    // Run initial scan
    await this.runScanCycle();

    // Set up periodic scanning
    this.scanInterval = setInterval(
      () => this.runScanCycle(),
      this.config.scanIntervalMs
    );

    // Set up position monitoring (check stop-loss/take-profit every minute)
    this.positionCheckInterval = setInterval(
      () => this.checkPositions(),
      60 * 1000
    );

    // Reset daily stats at midnight
    this.scheduleDailyReset();

    this.emit('started', { config: this.config, stats: this.stats });
    console.log('[AutoTrader] Daemon started successfully\n');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('\n[AutoTrader] Shutting down...');
    this.isRunning = false;

    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    if (this.positionCheckInterval) {
      clearInterval(this.positionCheckInterval);
      this.positionCheckInterval = null;
    }

    this.engine.stop();

    // Print final stats
    this.printStats();

    this.emit('stopped', { stats: this.stats });
    console.log('[AutoTrader] Shutdown complete');
  }

  // ============================================
  // MAIN SCAN CYCLE
  // ============================================

  async runScanCycle(): Promise<void> {
    if (!this.isRunning) return;

    const cycleStart = Date.now();
    console.log(`\n[${new Date().toISOString()}] Starting scan cycle #${this.stats.scansCompleted + 1}`);

    try {
      // Check if we should trade today
      if (this.stats.dailyTrades >= this.config.maxDailyTrades) {
        console.log('[AutoTrader] Daily trade limit reached, skipping scan');
        return;
      }

      if (Math.abs(this.stats.dailyPnl) >= this.config.maxDailyLossUsd && this.stats.dailyPnl < 0) {
        console.log('[AutoTrader] Daily loss limit reached, skipping scan');
        return;
      }

      // Fetch markets from all enabled platforms
      const markets = await this.fetchAllMarkets();
      console.log(`[AutoTrader] Fetched ${markets.length} markets`);

      // Evaluate each market
      const signals: StrategySignal[] = [];

      for (const market of markets) {
        try {
          const signal = await this.framework.getBestSignal(market);
          if (signal && this.isSignalValid(signal)) {
            signals.push(signal);
            this.stats.signalsGenerated++;

            console.log(`[Signal] ${signal.strategyType.toUpperCase()} - ${signal.direction} on ${signal.marketTicker}`);
            console.log(`         Confidence: ${signal.confidence.toFixed(0)}% | Edge: ${(signal.edge * 100).toFixed(2)}%`);
          }
        } catch (e) {
          // Skip failed evaluations
        }
      }

      // Sort signals by confidence
      signals.sort((a, b) => b.confidence - a.confidence);

      // Execute top signals if auto-execute is enabled
      if (this.config.autoExecute && signals.length > 0) {
        await this.executeSignals(signals);
      }

      this.stats.scansCompleted++;
      this.stats.lastScanTime = new Date();

      const duration = ((Date.now() - cycleStart) / 1000).toFixed(1);
      console.log(`[AutoTrader] Scan complete in ${duration}s - ${signals.length} signals found`);

      this.emit('scanComplete', {
        marketsScanned: markets.length,
        signalsFound: signals.length,
        duration: parseFloat(duration),
      });

    } catch (err: any) {
      const error = `Scan error: ${err?.message || err}`;
      console.error('[AutoTrader]', error);
      this.stats.errors.push(error);
      this.emit('error', { error });
    }
  }

  // ============================================
  // MARKET FETCHING
  // ============================================

  private async fetchAllMarkets(): Promise<MarketContext[]> {
    const contexts: MarketContext[] = [];

    // Fetch Kalshi
    if (this.config.enableKalshi) {
      try {
        const kalshiMarkets = await getKalshiMarkets(this.config.marketsPerScan);
        for (const m of kalshiMarkets) {
          const yesPrice = (m.yes_bid || m.last_price || 50) / 100;
          if (yesPrice > 0.05 && yesPrice < 0.95) {
            contexts.push({
              market: m as any,
              platform: 'kalshi',
              marketId: m.ticker,
              ticker: m.ticker,
              title: m.title || m.ticker,
              category: 'general',
              currentPrice: yesPrice,
              volume: m.volume || 0,
              daysToExpiry: m.expiration_time
                ? Math.max(1, (new Date(m.expiration_time).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : 30,
              newsRecency: 60,
            });
          }
        }
        console.log(`[Kalshi] Loaded ${contexts.filter(c => c.platform === 'kalshi').length} markets`);
      } catch (e: any) {
        console.warn('[Kalshi] Fetch error:', e?.message);
      }
    }

    // Fetch Polymarket
    if (this.config.enablePolymarket) {
      try {
        const polyMarkets = await fetchPolymarkets(this.config.marketsPerScan);
        for (const m of polyMarkets) {
          let yesPrice = 0.5;
          try {
            const prices = JSON.parse(m.outcomePrices || '[]');
            yesPrice = parseFloat(prices[0]) || 0.5;
          } catch {}

          if (yesPrice > 0.05 && yesPrice < 0.95) {
            contexts.push({
              market: m as any,
              platform: 'polymarket',
              marketId: m.conditionId || m.id,
              ticker: (m.slug || m.id || 'POLY').substring(0, 25),
              title: m.question || m.title || 'Unknown',
              category: 'general',
              currentPrice: yesPrice,
              volume: m.volumeNum || m.volume || 0,
              daysToExpiry: m.endDate
                ? Math.max(1, (new Date(m.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : 30,
              newsRecency: 60,
            });
          }
        }
        console.log(`[Polymarket] Loaded ${contexts.filter(c => c.platform === 'polymarket').length} markets`);
      } catch (e: any) {
        console.warn('[Polymarket] Fetch error:', e?.message);
      }
    }

    // Fetch DFlow
    if (this.config.enableDFlow) {
      try {
        const dflowMarkets = await getDFlowHotMarkets(this.config.marketsPerScan);
        for (const m of dflowMarkets) {
          const yesPrice = m.yesPrice || 0.5;
          if (yesPrice > 0.05 && yesPrice < 0.95) {
            contexts.push({
              market: m as any,
              platform: 'dflow',
              marketId: m.ticker,
              ticker: m.ticker,
              title: m.title || m.ticker,
              category: 'general',
              currentPrice: yesPrice,
              volume: m.volume || 0,
              daysToExpiry: 30,
              newsRecency: 60,
            });
          }
        }
        console.log(`[DFlow] Loaded ${contexts.filter(c => c.platform === 'dflow').length} markets`);
      } catch (e: any) {
        console.warn('[DFlow] Fetch error:', e?.message);
      }
    }

    return contexts;
  }

  // ============================================
  // SIGNAL VALIDATION & EXECUTION
  // ============================================

  private isSignalValid(signal: StrategySignal): boolean {
    // Check minimum confidence
    if (signal.confidence < this.config.minConfidence) return false;

    // Check minimum edge
    if (signal.edge < this.config.minEdge) return false;

    // Check if we already have a position in this market
    const positions = this.engine.getPositions();
    const hasPosition = positions.some(p => p.marketTicker === signal.marketTicker);
    if (hasPosition) return false;

    // Check max concurrent positions
    if (positions.length >= this.config.maxConcurrentPositions) return false;

    return true;
  }

  private async executeSignals(signals: StrategySignal[]): Promise<void> {
    const positions = this.engine.getPositions();
    const availableSlots = this.config.maxConcurrentPositions - positions.length;

    // Take top signals up to available slots
    const toExecute = signals.slice(0, availableSlots);

    for (const signal of toExecute) {
      try {
        // Calculate position size based on Kelly criterion and risk
        const portfolioValue = this.engine.getPortfolio().totalValue;
        const kellyFraction = (signal.edge * signal.confidence / 100) / (1 - signal.confidence / 100);
        const kellySize = Math.min(kellyFraction, 0.1) * portfolioValue; // Cap at 10%
        const positionSize = Math.min(kellySize, this.config.defaultPositionSizeUsd);

        // Calculate quantity
        const price = signal.currentPrice + (signal.direction === 'YES' ? 0.005 : -0.005); // Small slippage
        const quantity = Math.floor(positionSize / price);

        if (quantity < 1) continue;

        // Execute trade
        const result = await this.engine.executeTrade({
          userId: this.userId,
          mode: 'paper',
          platform: signal.platform,
          marketId: signal.marketId,
          marketTicker: signal.marketTicker,
          marketTitle: signal.marketTitle,
          direction: signal.direction,
          quantity,
          entryPrice: price,
          strategy: signal.strategyType,
          signalId: signal.id,
          signalConfidence: signal.confidence,
        });

        if (result.success && result.trade) {
          this.stats.tradesExecuted++;
          this.stats.dailyTrades++;
          this.stats.lastTradeTime = new Date();

          console.log(`[TRADE] Executed: ${signal.direction} ${quantity} ${signal.marketTicker} @ $${price.toFixed(3)}`);
          console.log(`        Strategy: ${signal.strategyType} | Confidence: ${signal.confidence.toFixed(0)}%`);

          this.emit('tradeExecuted', {
            trade: result.trade,
            signal,
          });
        } else {
          console.warn(`[TRADE] Failed: ${result.error}`);
        }

      } catch (err: any) {
        console.error(`[TRADE] Error executing signal: ${err?.message}`);
      }
    }
  }

  // ============================================
  // POSITION MANAGEMENT
  // ============================================

  private async checkPositions(): Promise<void> {
    if (!this.isRunning) return;

    const positions = this.engine.getPositions();

    for (const position of positions) {
      // Check stop-loss / take-profit
      // The paper trading engine handles this internally,
      // but we can add additional logic here

      // Check for time-based exit (e.g., close positions near expiry)
      if (position.daysToExpiry !== null && position.daysToExpiry < 1) {
        console.log(`[Position] Closing near-expiry position: ${position.marketTicker}`);
        await this.engine.closePosition(position.id, 'expiry');
      }
    }
  }

  // ============================================
  // UTILITIES
  // ============================================

  private scheduleDailyReset(): void {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();

    setTimeout(() => {
      this.stats.dailyTrades = 0;
      this.stats.dailyPnl = 0;
      console.log('[AutoTrader] Daily stats reset');
      this.scheduleDailyReset(); // Schedule next reset
    }, msUntilMidnight);
  }

  printStats(): void {
    const runtime = (Date.now() - this.stats.startTime.getTime()) / (1000 * 60 * 60);
    const portfolio = this.engine.getPortfolio();

    console.log('\n' + '═'.repeat(60));
    console.log('AUTONOMOUS TRADER STATISTICS');
    console.log('═'.repeat(60));
    console.log(`Runtime: ${runtime.toFixed(1)} hours`);
    console.log(`Scans Completed: ${this.stats.scansCompleted}`);
    console.log(`Signals Generated: ${this.stats.signalsGenerated}`);
    console.log(`Trades Executed: ${this.stats.tradesExecuted}`);
    console.log(`Win Rate: ${this.stats.tradesExecuted > 0
      ? ((this.stats.tradesWon / this.stats.tradesExecuted) * 100).toFixed(1)
      : 0}%`);
    console.log('─'.repeat(60));
    console.log(`Portfolio Value: $${portfolio.totalValue.toFixed(2)}`);
    console.log(`Total P&L: $${portfolio.totalPnl.toFixed(2)} (${(portfolio.totalPnlPercent * 100).toFixed(2)}%)`);
    console.log(`Open Positions: ${portfolio.positionCount}`);
    console.log('═'.repeat(60) + '\n');
  }

  // ============================================
  // PUBLIC API
  // ============================================

  getStats() {
    return { ...this.stats };
  }

  getConfig() {
    return { ...this.config };
  }

  setConfig(updates: Partial<AutoTraderConfig>) {
    this.config = { ...this.config, ...updates };
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getPortfolio() {
    return this.engine.getPortfolio();
  }

  getPositions() {
    return this.engine.getPositions();
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let instance: AutonomousTrader | null = null;

export function getAutonomousTrader(config?: Partial<AutoTraderConfig>): AutonomousTrader {
  if (!instance) {
    instance = new AutonomousTrader('autonomous-trader', config);
  }
  return instance;
}

export function stopAutonomousTrader(): void {
  if (instance) {
    instance.stop();
    instance = null;
  }
}

// ============================================
// CLI ENTRY POINT
// ============================================

if (require.main === module) {
  const trader = getAutonomousTrader({
    scanIntervalMs: 5 * 60 * 1000,  // 5 minutes
    autoExecute: true,
    minConfidence: 45,
    minEdge: 0.015,
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[AutoTrader] Received SIGINT, shutting down...');
    await trader.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n[AutoTrader] Received SIGTERM, shutting down...');
    await trader.stop();
    process.exit(0);
  });

  // Start the trader
  trader.start().catch(err => {
    console.error('[AutoTrader] Fatal error:', err);
    process.exit(1);
  });
}
