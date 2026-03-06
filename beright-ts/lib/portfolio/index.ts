/**
 * Portfolio & Risk Management Module
 *
 * Risk limits, Kelly sizing, alerts, and P&L tracking.
 *
 * @author BeRight Protocol
 * @version 3.0.0 - Bloomberg Terminal Architecture
 */

// =============================================================================
// RE-EXPORTS
// =============================================================================

// Types
export * from './types';

// Kelly sizing
export {
  calculateKelly,
  calculateMultiKelly,
  calculateOptimalSize,
  calculateShares,
  calculateCostBasis,
} from './kelly';
export type { MultiKellyInput } from './kelly';

// Risk management
export { RiskManager, getRiskManager } from './riskManager';

// Alerts
export { AlertManager, getAlertManager } from './alerts';

// P&L tracking
export { PnLTracker, getPnLTracker } from './pnl';

// =============================================================================
// PORTFOLIO MANAGER CLASS
// =============================================================================

import { RiskConfig, DEFAULT_RISK_CONFIG, PortfolioAlert, PerformanceMetrics, KellyOutput, RiskCheckResult } from './types';
import { OrderRequest } from '../execution/types';
import { getRiskManager } from './riskManager';
import { getAlertManager } from './alerts';
import { getPnLTracker } from './pnl';
import { calculateKelly } from './kelly';
import { KellyInput } from './types';
import { getExecutionEngine } from '../execution';

/**
 * Unified Portfolio Manager
 *
 * Single interface for all portfolio and risk operations.
 */
export class PortfolioManager {
  private config: RiskConfig;
  private initialized = false;

  constructor(config?: Partial<RiskConfig>) {
    this.config = { ...DEFAULT_RISK_CONFIG, ...config };
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  /**
   * Initialize portfolio management
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize components
    const riskManager = getRiskManager(this.config);
    const alertManager = getAlertManager(this.config);
    const pnlTracker = getPnLTracker();

    // Start monitoring
    await riskManager.resetDaily();
    alertManager.startMonitoring(60000); // 1 minute
    pnlTracker.startSnapshots(60000); // 1 minute

    this.initialized = true;
    console.log('[Portfolio] Initialized');
  }

  /**
   * Shutdown portfolio management
   */
  shutdown(): void {
    const alertManager = getAlertManager();
    const pnlTracker = getPnLTracker();

    alertManager.stopMonitoring();
    pnlTracker.stopSnapshots();

    this.initialized = false;
    console.log('[Portfolio] Shutdown');
  }

  // ==========================================================================
  // RISK CHECKING
  // ==========================================================================

  /**
   * Check if a trade is within risk limits
   */
  async checkTrade(
    request: OrderRequest,
    modelProbability?: number,
    confidence?: number
  ): Promise<RiskCheckResult> {
    const riskManager = getRiskManager();
    return riskManager.checkTrade(request, modelProbability, confidence);
  }

  /**
   * Get optimal position size
   */
  async getOptimalSize(
    probability: number,
    marketPrice: number,
    confidence: number
  ): Promise<{
    suggestedSize: number;
    kelly: KellyOutput;
    riskAdjusted: boolean;
    reasoning: string;
  }> {
    const engine = getExecutionEngine();
    const [balance, exposure] = await Promise.all([
      engine.getTotalBalance(),
      engine.getExposure(),
    ]);

    const kellyInput: KellyInput = {
      probability,
      marketPrice,
      confidence,
      portfolioValue: balance.total,
      currentExposure: exposure.totalAtRisk,
    };

    const kelly = calculateKelly(kellyInput, this.config);

    const riskManager = getRiskManager();
    const riskAdjusted = await riskManager.getKellySize(probability, marketPrice, confidence);

    return {
      suggestedSize: riskAdjusted.suggestedSize,
      kelly,
      riskAdjusted: riskAdjusted.riskAdjusted,
      reasoning: riskAdjusted.reasoning,
    };
  }

  // ==========================================================================
  // ALERTS
  // ==========================================================================

  /**
   * Get all alerts
   */
  getAlerts(options?: {
    unacknowledgedOnly?: boolean;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    limit?: number;
  }): PortfolioAlert[] {
    const alertManager = getAlertManager();
    return alertManager.getAlerts(options);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alertManager = getAlertManager();
    return alertManager.acknowledgeAlert(alertId);
  }

  /**
   * Subscribe to alerts
   */
  onAlert(callback: (alert: PortfolioAlert) => void): void {
    const alertManager = getAlertManager();
    alertManager.on('alert', callback);
  }

  /**
   * Subscribe to critical alerts only
   */
  onCriticalAlert(callback: (alert: PortfolioAlert) => void): void {
    const alertManager = getAlertManager();
    alertManager.on('alert:critical', callback);
  }

  // ==========================================================================
  // P&L TRACKING
  // ==========================================================================

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const pnlTracker = getPnLTracker();
    return pnlTracker.calculateMetrics();
  }

  /**
   * Get P&L summary
   */
  async getPnLSummary() {
    const pnlTracker = getPnLTracker();
    return pnlTracker.getSummary();
  }

  /**
   * Get daily P&L records
   */
  getDailyPnL(days: number = 30) {
    const pnlTracker = getPnLTracker();
    return pnlTracker.getDailyRecords(days);
  }

  /**
   * Record a completed trade
   */
  recordTrade(pnl: number): void {
    const pnlTracker = getPnLTracker();
    pnlTracker.recordTrade(pnl);

    // Also record loss for risk manager
    if (pnl < 0) {
      const riskManager = getRiskManager();
      riskManager.recordLoss(Math.abs(pnl));
    }
  }

  /**
   * Export P&L data as CSV
   */
  exportPnLCSV(): string {
    const pnlTracker = getPnLTracker();
    return pnlTracker.exportDailyCSV();
  }

  // ==========================================================================
  // RISK STATUS
  // ==========================================================================

  /**
   * Get current risk status
   */
  async getRiskStatus(): Promise<{
    config: RiskConfig;
    dailyStatus: ReturnType<typeof getRiskManager>['getDailyStatus'] extends () => infer R ? R : never;
    exposure: {
      totalAtRisk: number;
      utilizationPct: number;
      byPlatform: Record<string, number>;
    };
    alerts: {
      unacknowledged: number;
      critical: number;
    };
    tradingAllowed: boolean;
  }> {
    const riskManager = getRiskManager();
    const alertManager = getAlertManager();
    const engine = getExecutionEngine();

    const [balance, exposure] = await Promise.all([
      engine.getTotalBalance(),
      engine.getExposure(),
    ]);

    const dailyStatus = riskManager.getDailyStatus();
    const alerts = alertManager.getAlerts({ unacknowledgedOnly: true });
    const criticalAlerts = alerts.filter(a => a.priority === 'critical');

    return {
      config: riskManager.getConfig(),
      dailyStatus,
      exposure: {
        totalAtRisk: exposure.totalAtRisk,
        utilizationPct: balance.total > 0
          ? (exposure.totalAtRisk / balance.total) * 100
          : 0,
        byPlatform: exposure.exposureByPlatform,
      },
      alerts: {
        unacknowledged: alerts.length,
        critical: criticalAlerts.length,
      },
      tradingAllowed: dailyStatus.tradingAllowed && criticalAlerts.length === 0,
    };
  }

  /**
   * Update risk configuration
   */
  updateConfig(config: Partial<RiskConfig>): void {
    this.config = { ...this.config, ...config };
    const riskManager = getRiskManager();
    riskManager.updateConfig(config);
  }

  // ==========================================================================
  // DAILY OPERATIONS
  // ==========================================================================

  /**
   * Start of day routine
   */
  async startOfDay(): Promise<void> {
    const riskManager = getRiskManager();
    await riskManager.resetDaily();

    const alertManager = getAlertManager();
    alertManager.clearOldAlerts(48); // Clear alerts older than 48 hours

    console.log('[Portfolio] Start of day routine completed');
  }

  /**
   * End of day routine
   */
  async endOfDay(): Promise<{
    dailyPnL: number;
    metrics: PerformanceMetrics;
  }> {
    const pnlTracker = getPnLTracker();
    await pnlTracker.takeSnapshot();

    const today = new Date().toISOString().split('T')[0];
    const dailyRecord = pnlTracker.getDailyRecord(today);
    const metrics = pnlTracker.calculateMetrics();

    console.log('[Portfolio] End of day routine completed');

    return {
      dailyPnL: dailyRecord?.pnl || 0,
      metrics,
    };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let portfolioManager: PortfolioManager | null = null;

export function getPortfolioManager(config?: Partial<RiskConfig>): PortfolioManager {
  if (!portfolioManager) {
    portfolioManager = new PortfolioManager(config);
  } else if (config) {
    portfolioManager.updateConfig(config);
  }
  return portfolioManager;
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default getPortfolioManager;
