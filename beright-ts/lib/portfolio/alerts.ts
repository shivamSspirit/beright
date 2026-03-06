/**
 * Portfolio Alert System
 *
 * Real-time alerts for risk events, opportunities, and portfolio changes.
 *
 * @author BeRight Protocol
 */

import { EventEmitter } from 'events';
import {
  PortfolioAlert,
  AlertType,
  AlertPriority,
  generateAlertId,
  RiskConfig,
  DEFAULT_RISK_CONFIG,
} from './types';
import { Position } from '../execution/types';
import { Platform } from '../dataFabric/types';
import { getPositionManager } from '../execution/positions';
import { getExecutionEngine } from '../execution';
import { getRiskManager } from './riskManager';

// =============================================================================
// ALERT MANAGER
// =============================================================================

export class AlertManager extends EventEmitter {
  private alerts: Map<string, PortfolioAlert> = new Map();
  private config: RiskConfig;

  // Price tracking for large move detection
  private lastPrices: Map<string, { price: number; timestamp: Date }> = new Map();
  private readonly priceChangeThreshold = 0.1; // 10% move

  // Monitoring interval
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<RiskConfig>) {
    super();
    this.config = { ...DEFAULT_RISK_CONFIG, ...config };
  }

  // ==========================================================================
  // ALERT MANAGEMENT
  // ==========================================================================

  /**
   * Create and emit an alert
   */
  createAlert(
    type: AlertType,
    priority: AlertPriority,
    title: string,
    message: string,
    data?: Record<string, any>
  ): PortfolioAlert {
    const alert: PortfolioAlert = {
      id: generateAlertId(),
      type,
      priority,
      title,
      message,
      data,
      createdAt: new Date(),
      acknowledged: false,
    };

    this.alerts.set(alert.id, alert);
    this.emit('alert', alert);

    // Emit priority-specific event
    this.emit(`alert:${priority}`, alert);

    return alert;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();
    this.alerts.set(alertId, alert);

    this.emit('alert:acknowledged', alert);

    return true;
  }

  /**
   * Get all alerts
   */
  getAlerts(options?: {
    unacknowledgedOnly?: boolean;
    priority?: AlertPriority;
    type?: AlertType;
    since?: Date;
    limit?: number;
  }): PortfolioAlert[] {
    let alerts = Array.from(this.alerts.values());

    if (options?.unacknowledgedOnly) {
      alerts = alerts.filter(a => !a.acknowledged);
    }

    if (options?.priority) {
      alerts = alerts.filter(a => a.priority === options.priority);
    }

    if (options?.type) {
      alerts = alerts.filter(a => a.type === options.type);
    }

    if (options?.since) {
      alerts = alerts.filter(a => a.createdAt >= options.since!);
    }

    // Sort by priority (critical first) then by date
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    alerts.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    if (options?.limit) {
      alerts = alerts.slice(0, options.limit);
    }

    return alerts;
  }

  /**
   * Clear old alerts
   */
  clearOldAlerts(maxAgeHours: number = 24): number {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    let cleared = 0;

    for (const [id, alert] of this.alerts) {
      if (alert.createdAt < cutoff && alert.acknowledged) {
        this.alerts.delete(id);
        cleared++;
      }
    }

    return cleared;
  }

  // ==========================================================================
  // MONITORING
  // ==========================================================================

  /**
   * Start continuous monitoring
   */
  startMonitoring(intervalMs: number = 60000): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      this.runMonitoringCycle().catch(err => {
        console.error('[Alerts] Monitoring error:', err);
      });
    }, intervalMs);

    // Run immediately
    this.runMonitoringCycle();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Run a monitoring cycle
   */
  async runMonitoringCycle(): Promise<void> {
    await Promise.all([
      this.checkRiskLimits(),
      this.checkPositions(),
      this.checkClosingMarkets(),
      this.checkDailyLoss(),
    ]);
  }

  // ==========================================================================
  // RISK LIMIT CHECKS
  // ==========================================================================

  /**
   * Check risk limits and create alerts
   */
  private async checkRiskLimits(): Promise<void> {
    const riskManager = getRiskManager();
    const engine = getExecutionEngine();

    const [balance, exposure] = await Promise.all([
      engine.getTotalBalance(),
      engine.getExposure(),
    ]);

    const portfolioValue = balance.total;

    // Check total exposure
    const exposurePct = portfolioValue > 0
      ? exposure.totalAtRisk / portfolioValue
      : 0;

    if (exposurePct >= this.config.maxExposurePct) {
      this.createAlert(
        'RISK_LIMIT_BREACH',
        'critical',
        'Exposure Limit Breached',
        `Total exposure at ${(exposurePct * 100).toFixed(1)}% exceeds ${(this.config.maxExposurePct * 100).toFixed(0)}% limit`,
        { exposurePct, limit: this.config.maxExposurePct }
      );
    } else if (exposurePct >= this.config.maxExposurePct * 0.8) {
      this.createAlert(
        'RISK_LIMIT_WARNING',
        'high',
        'Approaching Exposure Limit',
        `Total exposure at ${(exposurePct * 100).toFixed(1)}%`,
        { exposurePct, limit: this.config.maxExposurePct }
      );
    }

    // Check platform concentration
    for (const [platform, platformExposure] of Object.entries(exposure.exposureByPlatform)) {
      const platformPct = portfolioValue > 0 ? platformExposure / portfolioValue : 0;

      if (platformPct >= this.config.maxPerPlatformPct) {
        this.createAlert(
          'RISK_LIMIT_WARNING',
          'medium',
          'Platform Concentration',
          `${platform} at ${(platformPct * 100).toFixed(1)}% of portfolio`,
          { platform, platformPct, limit: this.config.maxPerPlatformPct }
        );
      }
    }
  }

  // ==========================================================================
  // POSITION CHECKS
  // ==========================================================================

  /**
   * Check positions for stop loss / take profit triggers
   */
  private async checkPositions(): Promise<void> {
    const riskManager = getRiskManager();
    const monitoring = await riskManager.monitorPositions();

    // Stop loss triggers
    for (const position of monitoring.stopLossTriggers) {
      this.createAlert(
        'POSITION_STOP_LOSS',
        'critical',
        'Stop Loss Triggered',
        `${position.marketQuestion.slice(0, 50)}... down ${(Math.abs(position.unrealizedPnLPct) * 100).toFixed(1)}%`,
        {
          positionId: position.id,
          marketId: position.marketId,
          unrealizedPnL: position.unrealizedPnL,
          unrealizedPnLPct: position.unrealizedPnLPct,
        }
      );
    }

    // Take profit triggers
    for (const position of monitoring.takeProfitTriggers) {
      this.createAlert(
        'POSITION_TAKE_PROFIT',
        'high',
        'Take Profit Target Reached',
        `${position.marketQuestion.slice(0, 50)}... up ${(position.unrealizedPnLPct * 100).toFixed(1)}%`,
        {
          positionId: position.id,
          marketId: position.marketId,
          unrealizedPnL: position.unrealizedPnL,
          unrealizedPnLPct: position.unrealizedPnLPct,
        }
      );
    }

    // Check for large price moves
    const positionManager = getPositionManager();
    const positions = await positionManager.getOpenPositions();

    for (const position of positions) {
      const lastPrice = this.lastPrices.get(position.marketId);

      if (lastPrice) {
        const priceChange = Math.abs(position.currentPrice - lastPrice.price);

        if (priceChange >= this.priceChangeThreshold) {
          const direction = position.currentPrice > lastPrice.price ? 'up' : 'down';

          this.createAlert(
            'LARGE_PRICE_MOVE',
            'high',
            `Large Price Move (${direction})`,
            `${position.marketQuestion.slice(0, 50)}... moved ${(priceChange * 100).toFixed(1)}% ${direction}`,
            {
              marketId: position.marketId,
              previousPrice: lastPrice.price,
              currentPrice: position.currentPrice,
              change: priceChange,
            }
          );
        }
      }

      // Update last price
      this.lastPrices.set(position.marketId, {
        price: position.currentPrice,
        timestamp: new Date(),
      });
    }
  }

  // ==========================================================================
  // MARKET CHECKS
  // ==========================================================================

  /**
   * Check for markets closing soon
   */
  private async checkClosingMarkets(): Promise<void> {
    const positionManager = getPositionManager();
    const closingSoon = await positionManager.getClosingSoon(24);

    for (const position of closingSoon) {
      if (!position.marketCloseDate) continue;

      const hoursUntil = (position.marketCloseDate.getTime() - Date.now()) / (1000 * 60 * 60);

      let priority: AlertPriority = 'low';
      if (hoursUntil <= 2) priority = 'critical';
      else if (hoursUntil <= 6) priority = 'high';
      else if (hoursUntil <= 12) priority = 'medium';

      this.createAlert(
        'MARKET_CLOSING_SOON',
        priority,
        'Market Closing Soon',
        `${position.marketQuestion.slice(0, 50)}... closes in ${hoursUntil.toFixed(1)} hours`,
        {
          positionId: position.id,
          marketId: position.marketId,
          closeDate: position.marketCloseDate,
          hoursUntil,
          unrealizedPnL: position.unrealizedPnL,
        }
      );
    }
  }

  // ==========================================================================
  // DAILY CHECKS
  // ==========================================================================

  /**
   * Check daily loss limits
   */
  private async checkDailyLoss(): Promise<void> {
    const riskManager = getRiskManager();
    const dailyStatus = riskManager.getDailyStatus();

    if (!dailyStatus.tradingAllowed) {
      this.createAlert(
        'DAILY_LOSS_WARNING',
        'critical',
        'Daily Loss Limit Reached',
        `Trading suspended. Daily loss: $${dailyStatus.currentLoss.toFixed(0)}`,
        { dailyLoss: dailyStatus.currentLoss }
      );
    } else if (dailyStatus.remainingLossAllowance < this.config.maxDailyLoss * 0.3) {
      this.createAlert(
        'DAILY_LOSS_WARNING',
        'high',
        'Approaching Daily Loss Limit',
        `Remaining allowance: $${dailyStatus.remainingLossAllowance.toFixed(0)}`,
        {
          dailyLoss: dailyStatus.currentLoss,
          remaining: dailyStatus.remainingLossAllowance,
        }
      );
    }

    // Check drawdown
    if (dailyStatus.drawdownFromPeak > this.config.maxDrawdown * 0.7) {
      this.createAlert(
        'DRAWDOWN_WARNING',
        'high',
        'Significant Drawdown',
        `Portfolio down $${dailyStatus.drawdownFromPeak.toFixed(0)} from peak`,
        { drawdown: dailyStatus.drawdownFromPeak }
      );
    }
  }

  // ==========================================================================
  // OPPORTUNITY ALERTS
  // ==========================================================================

  /**
   * Create alert for new opportunity
   */
  alertOpportunity(
    marketId: string,
    question: string,
    edge: number,
    confidence: number,
    platform: Platform
  ): PortfolioAlert {
    const priority: AlertPriority =
      edge >= 0.1 && confidence >= 0.8 ? 'high' :
      edge >= 0.05 ? 'medium' : 'low';

    return this.createAlert(
      'NEW_OPPORTUNITY',
      priority,
      'Trading Opportunity',
      `${question.slice(0, 50)}... | Edge: ${(edge * 100).toFixed(1)}%`,
      {
        marketId,
        question,
        edge,
        confidence,
        platform,
      }
    );
  }

  /**
   * Create alert for arbitrage opportunity
   */
  alertArbitrage(
    marketId: string,
    question: string,
    spread: number,
    buyPlatform: Platform,
    sellPlatform: Platform
  ): PortfolioAlert {
    const priority: AlertPriority = spread >= 0.05 ? 'high' : 'medium';

    return this.createAlert(
      'ARBITRAGE_DETECTED',
      priority,
      'Arbitrage Opportunity',
      `${question.slice(0, 50)}... | Spread: ${(spread * 100).toFixed(1)}%`,
      {
        marketId,
        question,
        spread,
        buyPlatform,
        sellPlatform,
      }
    );
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let alertManager: AlertManager | null = null;

export function getAlertManager(config?: Partial<RiskConfig>): AlertManager {
  if (!alertManager) {
    alertManager = new AlertManager(config);
  }
  return alertManager;
}

export default AlertManager;
