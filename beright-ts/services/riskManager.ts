/**
 * Risk Manager
 *
 * Protects capital through:
 * - Position sizing (Kelly Criterion)
 * - Exposure limits
 * - Correlation management
 * - Circuit breakers
 * - Daily/weekly loss limits
 * - Drawdown protection
 *
 * "Risk management is the only free lunch in trading"
 */

import { EventEmitter } from 'events';
import { db } from '../lib/supabase/client';
import {
  RiskConfig,
  RiskAssessment,
  RiskWarning,
  Position,
  Trade,
  TradeDirection,
  StrategyType,
  DEFAULT_RISK_CONFIG,
  inferCategory,
  calculateKellySize,
} from '../types/trading';

// ============================================
// CONFIGURATION
// ============================================

interface RiskState {
  // Portfolio state
  totalValue: number;
  cashBalance: number;
  portfolioValue: number;

  // Position tracking
  openPositions: Position[];
  positionCount: number;

  // P&L tracking
  dailyPnl: number;
  weeklyPnl: number;
  monthlyPnl: number;
  unrealizedPnl: number;

  // Risk metrics
  currentDrawdown: number;
  maxDrawdown: number;
  peakValue: number;

  // Circuit breaker state
  circuitBreakerTriggered: boolean;
  circuitBreakerCooldownUntil: Date | null;

  // Performance metrics
  winRate: number;
  avgBrierScore: number;

  // Timestamps
  lastTradeAt: Date | null;
  lastUpdateAt: Date;
}

// ============================================
// RISK MANAGER
// ============================================

export class RiskManager extends EventEmitter {
  private userId: string;
  private config: RiskConfig;
  private state: RiskState;
  private dailyPnlHistory: { date: string; pnl: number }[] = [];

  constructor(userId: string, config?: Partial<RiskConfig>) {
    super();
    this.userId = userId;
    this.config = { ...DEFAULT_RISK_CONFIG, ...config };

    this.state = {
      totalValue: 0,
      cashBalance: 0,
      portfolioValue: 0,
      openPositions: [],
      positionCount: 0,
      dailyPnl: 0,
      weeklyPnl: 0,
      monthlyPnl: 0,
      unrealizedPnl: 0,
      currentDrawdown: 0,
      maxDrawdown: 0,
      peakValue: 0,
      circuitBreakerTriggered: false,
      circuitBreakerCooldownUntil: null,
      winRate: 0,
      avgBrierScore: 0.5,
      lastTradeAt: null,
      lastUpdateAt: new Date(),
    };
  }

  /**
   * Update risk state from portfolio data
   */
  updateState(portfolio: {
    totalValue: number;
    cashBalance: number;
    portfolioValue: number;
    openPositions: Position[];
    unrealizedPnl: number;
    realizedPnl: number;
    winRate: number;
  }): void {
    this.state.totalValue = portfolio.totalValue;
    this.state.cashBalance = portfolio.cashBalance;
    this.state.portfolioValue = portfolio.portfolioValue;
    this.state.openPositions = portfolio.openPositions;
    this.state.positionCount = portfolio.openPositions.length;
    this.state.unrealizedPnl = portfolio.unrealizedPnl;
    this.state.winRate = portfolio.winRate;
    this.state.lastUpdateAt = new Date();

    // Update peak and drawdown
    if (portfolio.totalValue > this.state.peakValue) {
      this.state.peakValue = portfolio.totalValue;
    }
    this.state.currentDrawdown = this.state.peakValue - portfolio.totalValue;
    if (this.state.currentDrawdown > this.state.maxDrawdown) {
      this.state.maxDrawdown = this.state.currentDrawdown;
    }

    // Check circuit breaker conditions
    this.checkCircuitBreaker();
  }

  /**
   * Record P&L for a trade
   */
  recordTradePnl(pnl: number): void {
    this.state.dailyPnl += pnl;
    this.state.weeklyPnl += pnl;
    this.state.monthlyPnl += pnl;
    this.state.lastTradeAt = new Date();

    // Track daily history
    const today = new Date().toISOString().split('T')[0];
    const existing = this.dailyPnlHistory.find(d => d.date === today);
    if (existing) {
      existing.pnl += pnl;
    } else {
      this.dailyPnlHistory.push({ date: today, pnl });
    }

    // Keep only last 30 days
    if (this.dailyPnlHistory.length > 30) {
      this.dailyPnlHistory = this.dailyPnlHistory.slice(-30);
    }
  }

  /**
   * Assess risk for a proposed trade
   */
  assessTrade(trade: {
    direction: TradeDirection;
    entryPrice: number;
    quantity: number;
    category: string;
    strategy: StrategyType;
    confidence?: number;
    edge?: number;
  }): RiskAssessment {
    const warnings: RiskWarning[] = [];
    const reasons: string[] = [];

    // Calculate proposed position value
    const positionValue = trade.quantity * trade.entryPrice;
    const positionPct = this.state.totalValue > 0 ? positionValue / this.state.totalValue : 0;

    // ================================================
    // CHECK 1: Circuit Breaker
    // ================================================
    if (this.state.circuitBreakerTriggered) {
      const cooldownRemaining = this.state.circuitBreakerCooldownUntil
        ? Math.max(0, (this.state.circuitBreakerCooldownUntil.getTime() - Date.now()) / 60000)
        : 0;

      reasons.push(`Circuit breaker active. Cooldown: ${cooldownRemaining.toFixed(0)} minutes remaining`);
      warnings.push({
        level: 'critical',
        type: 'circuit_breaker',
        message: `Trading halted due to circuit breaker. Resumes at ${this.state.circuitBreakerCooldownUntil?.toLocaleTimeString() || 'unknown'}`,
      });

      return {
        canTrade: false,
        reasons,
        maxAllowedSize: 0,
        adjustedSize: 0,
        positionRisk: 100,
        portfolioRisk: 100,
        correlationRisk: 0,
        concentrationRisk: 0,
        warnings,
      };
    }

    // ================================================
    // CHECK 2: Daily Loss Limit
    // ================================================
    if (this.state.dailyPnl < -this.config.maxDailyLossUsd) {
      reasons.push(`Daily loss limit exceeded: $${Math.abs(this.state.dailyPnl).toFixed(2)} > $${this.config.maxDailyLossUsd}`);
      warnings.push({
        level: 'critical',
        type: 'loss_limit',
        message: `Daily loss limit ($${this.config.maxDailyLossUsd}) exceeded`,
      });
    }

    const dailyLossPct = this.state.totalValue > 0
      ? Math.abs(this.state.dailyPnl) / this.state.totalValue
      : 0;
    if (dailyLossPct > this.config.maxDailyLossPct) {
      reasons.push(`Daily loss ${(dailyLossPct * 100).toFixed(1)}% exceeds ${(this.config.maxDailyLossPct * 100).toFixed(0)}% limit`);
      warnings.push({
        level: 'critical',
        type: 'loss_limit',
        message: `Daily loss percentage limit exceeded`,
      });
    }

    // ================================================
    // CHECK 3: Maximum Drawdown
    // ================================================
    const drawdownPct = this.state.peakValue > 0
      ? this.state.currentDrawdown / this.state.peakValue
      : 0;
    if (drawdownPct > this.config.maxDrawdownPct) {
      reasons.push(`Drawdown ${(drawdownPct * 100).toFixed(1)}% exceeds ${(this.config.maxDrawdownPct * 100).toFixed(0)}% limit`);
      warnings.push({
        level: 'critical',
        type: 'drawdown',
        message: `Maximum drawdown exceeded`,
      });
    }

    // ================================================
    // CHECK 4: Position Size Limits
    // ================================================
    let maxAllowedSize = Math.min(
      this.config.maxPositionSizeUsd,
      this.state.totalValue * this.config.maxPositionSizePct,
      this.state.cashBalance * 0.95 // Keep 5% reserve
    );

    if (positionValue > maxAllowedSize) {
      warnings.push({
        level: 'warning',
        type: 'position_size',
        message: `Position size $${positionValue.toFixed(2)} exceeds max $${maxAllowedSize.toFixed(2)}`,
      });
    }

    // ================================================
    // CHECK 5: Total Exposure Limit
    // ================================================
    const currentExposure = this.state.openPositions.reduce(
      (sum, p) => sum + p.currentValue,
      0
    );
    const newTotalExposure = currentExposure + positionValue;
    const exposurePct = this.state.totalValue > 0
      ? newTotalExposure / this.state.totalValue
      : 0;

    if (exposurePct > this.config.maxTotalExposurePct) {
      reasons.push(`Total exposure ${(exposurePct * 100).toFixed(1)}% would exceed ${(this.config.maxTotalExposurePct * 100).toFixed(0)}% limit`);
      warnings.push({
        level: 'warning',
        type: 'exposure',
        message: `Total market exposure limit would be exceeded`,
      });
    }

    // ================================================
    // CHECK 6: Category Exposure
    // ================================================
    const categoryPositions = this.state.openPositions.filter(
      p => p.category === trade.category
    );
    const categoryExposure = categoryPositions.reduce((sum, p) => sum + p.currentValue, 0);
    const newCategoryExposure = categoryExposure + positionValue;
    const categoryPct = this.state.totalValue > 0
      ? newCategoryExposure / this.state.totalValue
      : 0;

    if (categoryPct > this.config.maxCategoryExposurePct) {
      reasons.push(`${trade.category} exposure ${(categoryPct * 100).toFixed(1)}% would exceed ${(this.config.maxCategoryExposurePct * 100).toFixed(0)}% limit`);
      warnings.push({
        level: 'warning',
        type: 'exposure',
        message: `Category ${trade.category} exposure limit would be exceeded`,
      });
    }

    // ================================================
    // CHECK 7: Correlation Risk
    // ================================================
    const correlatedPositions = this.findCorrelatedPositions(trade.category, trade.direction);
    if (correlatedPositions.length >= this.config.maxCorrelatedPositions) {
      warnings.push({
        level: 'warning',
        type: 'correlation',
        message: `${correlatedPositions.length} correlated positions already open`,
      });
    }

    // ================================================
    // CHECK 8: Performance Gates
    // ================================================
    if (this.state.avgBrierScore > this.config.minBrierScoreToTrade) {
      warnings.push({
        level: 'info',
        type: 'loss_limit',
        message: `Brier score ${this.state.avgBrierScore.toFixed(3)} above threshold ${this.config.minBrierScoreToTrade}`,
      });
    }

    if (this.state.winRate < this.config.minWinRateToTrade && this.state.positionCount > 10) {
      warnings.push({
        level: 'warning',
        type: 'loss_limit',
        message: `Win rate ${(this.state.winRate * 100).toFixed(1)}% below threshold ${(this.config.minWinRateToTrade * 100).toFixed(0)}%`,
      });
    }

    // ================================================
    // CALCULATE OPTIMAL POSITION SIZE
    // ================================================
    let adjustedSize = positionValue;

    // Apply Kelly sizing if confidence and edge provided
    if (trade.confidence && trade.edge) {
      const kellySize = calculateKellySize(trade.edge, trade.confidence / 100);
      const kellyValue = this.state.totalValue * kellySize;

      // Use minimum of requested size and Kelly-optimal size
      adjustedSize = Math.min(positionValue, kellyValue);
    }

    // Reduce size based on warnings
    const criticalWarnings = warnings.filter(w => w.level === 'critical');
    const normalWarnings = warnings.filter(w => w.level === 'warning');

    if (criticalWarnings.length > 0) {
      adjustedSize = 0; // No trading allowed
    } else if (normalWarnings.length > 0) {
      // Reduce size by 20% per warning, max 60% reduction
      const reduction = Math.min(normalWarnings.length * 0.2, 0.6);
      adjustedSize = adjustedSize * (1 - reduction);
    }

    // Cap at maximum allowed
    adjustedSize = Math.min(adjustedSize, maxAllowedSize);

    // ================================================
    // CALCULATE RISK SCORES
    // ================================================
    const positionRisk = this.calculatePositionRisk(trade, positionValue);
    const portfolioRisk = this.calculatePortfolioRisk();
    const correlationRisk = correlatedPositions.length / this.config.maxCorrelatedPositions * 100;
    const concentrationRisk = this.calculateConcentrationRisk();

    // ================================================
    // FINAL DECISION
    // ================================================
    const canTrade = criticalWarnings.length === 0 && adjustedSize > 0;

    if (!canTrade && reasons.length === 0) {
      reasons.push('Trade blocked due to risk limits');
    }

    return {
      canTrade,
      reasons,
      maxAllowedSize,
      adjustedSize,
      positionRisk,
      portfolioRisk,
      correlationRisk,
      concentrationRisk,
      warnings,
    };
  }

  /**
   * Calculate stop loss price for a position
   */
  calculateStopLoss(
    entryPrice: number,
    direction: TradeDirection,
    customPct?: number
  ): number {
    const stopLossPct = customPct || this.config.defaultStopLossPct;

    if (direction === 'YES') {
      return Math.max(0.01, entryPrice * (1 - stopLossPct));
    } else {
      return Math.min(0.99, entryPrice * (1 + stopLossPct));
    }
  }

  /**
   * Calculate take profit price for a position
   */
  calculateTakeProfit(
    entryPrice: number,
    direction: TradeDirection,
    customPct?: number
  ): number {
    const takeProfitPct = customPct || this.config.defaultTakeProfitPct;

    if (direction === 'YES') {
      return Math.min(0.99, entryPrice * (1 + takeProfitPct));
    } else {
      return Math.max(0.01, entryPrice * (1 - takeProfitPct));
    }
  }

  /**
   * Calculate optimal position size using Kelly Criterion
   */
  calculateKellyPositionSize(
    edge: number,
    winProbability: number,
    maxPositionPct?: number
  ): { quantity: number; percentage: number } {
    const kellyFraction = calculateKellySize(edge, winProbability, 0.5); // Half Kelly
    const maxPct = maxPositionPct || this.config.maxPositionSizePct;

    const percentage = Math.min(kellyFraction, maxPct);
    const quantity = this.state.cashBalance * percentage;

    return { quantity, percentage };
  }

  /**
   * Check and update circuit breaker status
   */
  private checkCircuitBreaker(): void {
    if (!this.config.circuitBreakerEnabled) return;

    // Check if we should trigger
    const dailyLossPct = this.state.totalValue > 0
      ? Math.abs(this.state.dailyPnl) / this.state.totalValue
      : 0;

    if (dailyLossPct >= this.config.circuitBreakerLossPct && !this.state.circuitBreakerTriggered) {
      this.state.circuitBreakerTriggered = true;
      this.state.circuitBreakerCooldownUntil = new Date(
        Date.now() + this.config.circuitBreakerCooldownMinutes * 60 * 1000
      );

      this.emit('circuitBreakerTriggered', {
        dailyLossPct,
        cooldownUntil: this.state.circuitBreakerCooldownUntil,
      });

      console.log(`[RiskManager] Circuit breaker TRIGGERED. Daily loss: ${(dailyLossPct * 100).toFixed(2)}%`);
    }

    // Check if cooldown has expired
    if (
      this.state.circuitBreakerTriggered &&
      this.state.circuitBreakerCooldownUntil &&
      new Date() > this.state.circuitBreakerCooldownUntil
    ) {
      this.state.circuitBreakerTriggered = false;
      this.state.circuitBreakerCooldownUntil = null;

      this.emit('circuitBreakerReset');
      console.log('[RiskManager] Circuit breaker RESET');
    }
  }

  /**
   * Find positions correlated with proposed trade
   */
  private findCorrelatedPositions(
    category: string,
    direction: TradeDirection
  ): Position[] {
    return this.state.openPositions.filter(p =>
      p.category === category && p.direction === direction
    );
  }

  /**
   * Calculate position risk score
   */
  private calculatePositionRisk(
    trade: { direction: TradeDirection; entryPrice: number; quantity: number },
    positionValue: number
  ): number {
    let risk = 0;

    // Size risk
    const sizePct = this.state.totalValue > 0
      ? positionValue / this.state.totalValue
      : 0;
    risk += sizePct * 200; // 10% position = 20 risk points

    // Price extremity risk
    const extremity = Math.abs(trade.entryPrice - 0.5) * 2;
    risk += extremity * 30; // Extreme prices add up to 30 risk points

    // Drawdown risk
    const drawdownPct = this.state.peakValue > 0
      ? this.state.currentDrawdown / this.state.peakValue
      : 0;
    risk += drawdownPct * 50; // 20% drawdown = 10 risk points

    return Math.min(100, risk);
  }

  /**
   * Calculate overall portfolio risk
   */
  private calculatePortfolioRisk(): number {
    let risk = 0;

    // Position count risk
    risk += Math.min(this.state.positionCount / 10, 1) * 20;

    // Exposure risk
    const exposurePct = this.state.totalValue > 0
      ? this.state.portfolioValue / this.state.totalValue
      : 0;
    risk += exposurePct * 30;

    // Drawdown risk
    const drawdownPct = this.state.peakValue > 0
      ? this.state.currentDrawdown / this.state.peakValue
      : 0;
    risk += drawdownPct * 50;

    // Daily P&L risk
    const dailyLossPct = this.state.totalValue > 0
      ? Math.abs(Math.min(0, this.state.dailyPnl)) / this.state.totalValue
      : 0;
    risk += dailyLossPct * 100;

    return Math.min(100, risk);
  }

  /**
   * Calculate concentration risk (Herfindahl index style)
   */
  private calculateConcentrationRisk(): number {
    if (this.state.openPositions.length === 0) return 0;

    // Group by category
    const categoryValues: Record<string, number> = {};
    let totalValue = 0;

    for (const pos of this.state.openPositions) {
      categoryValues[pos.category] = (categoryValues[pos.category] || 0) + pos.currentValue;
      totalValue += pos.currentValue;
    }

    if (totalValue === 0) return 0;

    // Calculate HHI
    let hhi = 0;
    for (const value of Object.values(categoryValues)) {
      const share = value / totalValue;
      hhi += share * share;
    }

    // Normalize to 0-100 (1.0 = 100% in one category, 0.125 = equal across 8 categories)
    const normalizedHhi = (hhi - 0.125) / (1.0 - 0.125);
    return Math.max(0, Math.min(100, normalizedHhi * 100));
  }

  /**
   * Get current risk state summary
   */
  getRiskSummary(): {
    portfolioRisk: number;
    concentrationRisk: number;
    drawdownPct: number;
    dailyLossPct: number;
    positionCount: number;
    circuitBreakerActive: boolean;
    warnings: string[];
  } {
    const drawdownPct = this.state.peakValue > 0
      ? this.state.currentDrawdown / this.state.peakValue
      : 0;
    const dailyLossPct = this.state.totalValue > 0
      ? Math.abs(Math.min(0, this.state.dailyPnl)) / this.state.totalValue
      : 0;

    const warnings: string[] = [];

    if (drawdownPct > this.config.maxDrawdownPct * 0.8) {
      warnings.push(`Drawdown approaching limit (${(drawdownPct * 100).toFixed(1)}%)`);
    }
    if (dailyLossPct > this.config.maxDailyLossPct * 0.8) {
      warnings.push(`Daily loss approaching limit (${(dailyLossPct * 100).toFixed(1)}%)`);
    }
    if (this.state.circuitBreakerTriggered) {
      warnings.push('Circuit breaker active - trading halted');
    }

    return {
      portfolioRisk: this.calculatePortfolioRisk(),
      concentrationRisk: this.calculateConcentrationRisk(),
      drawdownPct,
      dailyLossPct,
      positionCount: this.state.positionCount,
      circuitBreakerActive: this.state.circuitBreakerTriggered,
      warnings,
    };
  }

  /**
   * Reset daily P&L counter (call at midnight)
   */
  resetDailyPnl(): void {
    this.state.dailyPnl = 0;

    // Check if circuit breaker should reset
    if (this.state.circuitBreakerTriggered) {
      this.state.circuitBreakerTriggered = false;
      this.state.circuitBreakerCooldownUntil = null;
      this.emit('circuitBreakerReset');
    }
  }

  /**
   * Reset weekly P&L counter (call on Sunday midnight)
   */
  resetWeeklyPnl(): void {
    this.state.weeklyPnl = 0;
  }

  /**
   * Update Brier score average
   */
  updateBrierScore(avgBrierScore: number): void {
    this.state.avgBrierScore = avgBrierScore;
  }

  /**
   * Update win rate
   */
  updateWinRate(winRate: number): void {
    this.state.winRate = winRate;
  }

  /**
   * Get configuration
   */
  getConfig(): RiskConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<RiskConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// ============================================
// SINGLETON
// ============================================

const riskManagerInstances: Map<string, RiskManager> = new Map();

export function getRiskManager(userId: string, config?: Partial<RiskConfig>): RiskManager {
  let manager = riskManagerInstances.get(userId);
  if (!manager) {
    manager = new RiskManager(userId, config);
    riskManagerInstances.set(userId, manager);
  }
  return manager;
}

// ============================================
// CLI INTERFACE
// ============================================

if (require.main === module) {
  const command = process.argv[2] || 'info';
  const userId = process.env.AUTONOMOUS_AGENT_USER_ID || 'risk-test-user';

  const manager = new RiskManager(userId);

  // Set up test state
  manager.updateState({
    totalValue: 1000,
    cashBalance: 800,
    portfolioValue: 200,
    openPositions: [
      {
        id: 'test-1',
        tradeId: 'test-1',
        userId,
        mode: 'paper',
        platform: 'kalshi',
        marketId: 'test-market',
        marketTicker: 'TEST-1',
        marketTitle: 'Test Position 1',
        category: 'crypto',
        direction: 'YES',
        quantity: 10,
        avgEntryPrice: 0.50,
        currentPrice: 0.55,
        costBasis: 50,
        currentValue: 55,
        unrealizedPnl: 5,
        unrealizedPnlPercent: 0.10,
        stopLossPrice: 0.40,
        takeProfitPrice: 0.70,
        riskScore: 30,
        openedAt: new Date(),
        expiresAt: null,
        daysToExpiry: null,
        isOpen: true,
      },
    ],
    unrealizedPnl: 5,
    realizedPnl: 0,
    winRate: 0.60,
  });

  switch (command) {
    case 'assess':
      console.log('\n🔍 Risk Assessment Test\n');

      const assessment = manager.assessTrade({
        direction: 'YES',
        entryPrice: 0.45,
        quantity: 100,
        category: 'crypto',
        strategy: 'manual',
        confidence: 75,
        edge: 0.08,
      });

      console.log(`Can Trade: ${assessment.canTrade ? 'YES' : 'NO'}`);
      console.log(`Max Allowed Size: $${assessment.maxAllowedSize.toFixed(2)}`);
      console.log(`Adjusted Size: $${assessment.adjustedSize.toFixed(2)}`);
      console.log(`\nRisk Scores:`);
      console.log(`  Position: ${assessment.positionRisk.toFixed(0)}/100`);
      console.log(`  Portfolio: ${assessment.portfolioRisk.toFixed(0)}/100`);
      console.log(`  Correlation: ${assessment.correlationRisk.toFixed(0)}/100`);
      console.log(`  Concentration: ${assessment.concentrationRisk.toFixed(0)}/100`);

      if (assessment.warnings.length > 0) {
        console.log(`\nWarnings:`);
        for (const w of assessment.warnings) {
          console.log(`  [${w.level.toUpperCase()}] ${w.message}`);
        }
      }

      if (assessment.reasons.length > 0) {
        console.log(`\nReasons:`);
        for (const r of assessment.reasons) {
          console.log(`  - ${r}`);
        }
      }
      break;

    case 'summary':
      console.log('\n📊 Risk Summary\n');

      const summary = manager.getRiskSummary();

      console.log(`Portfolio Risk: ${summary.portfolioRisk.toFixed(0)}/100`);
      console.log(`Concentration Risk: ${summary.concentrationRisk.toFixed(0)}/100`);
      console.log(`Drawdown: ${(summary.drawdownPct * 100).toFixed(2)}%`);
      console.log(`Daily Loss: ${(summary.dailyLossPct * 100).toFixed(2)}%`);
      console.log(`Open Positions: ${summary.positionCount}`);
      console.log(`Circuit Breaker: ${summary.circuitBreakerActive ? 'ACTIVE' : 'Inactive'}`);

      if (summary.warnings.length > 0) {
        console.log(`\nWarnings:`);
        for (const w of summary.warnings) {
          console.log(`  - ${w}`);
        }
      }
      break;

    case 'info':
    default:
      console.log('\n⚠️ Risk Manager');
      console.log('═'.repeat(40));
      console.log('\nConfiguration:');
      const config = manager.getConfig();
      console.log(`  Max Position Size: $${config.maxPositionSizeUsd} / ${(config.maxPositionSizePct * 100).toFixed(0)}%`);
      console.log(`  Max Daily Loss: $${config.maxDailyLossUsd} / ${(config.maxDailyLossPct * 100).toFixed(0)}%`);
      console.log(`  Max Drawdown: ${(config.maxDrawdownPct * 100).toFixed(0)}%`);
      console.log(`  Circuit Breaker: ${config.circuitBreakerEnabled ? 'Enabled' : 'Disabled'}`);
      console.log(`  Default Stop Loss: ${(config.defaultStopLossPct * 100).toFixed(0)}%`);
      console.log(`  Default Take Profit: ${(config.defaultTakeProfitPct * 100).toFixed(0)}%`);

      console.log('\n\nUsage:');
      console.log('  ts-node riskManager.ts info     # Show configuration');
      console.log('  ts-node riskManager.ts assess   # Run risk assessment');
      console.log('  ts-node riskManager.ts summary  # Show risk summary');
      break;
  }

  process.exit(0);
}

export type { RiskState };
