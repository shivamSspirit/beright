/**
 * P&L Tracking
 *
 * Track profit and loss over time with performance metrics.
 *
 * @author BeRight Protocol
 */

import {
  PnLSnapshot,
  DailyPnL,
  PerformanceMetrics,
  calculateSharpeRatio,
  calculateSortinoRatio,
  calculateMaxDrawdown,
} from './types';
import { Platform } from '../dataFabric/types';
import { getExecutionEngine } from '../execution';

// =============================================================================
// P&L TRACKER
// =============================================================================

export class PnLTracker {
  // Historical snapshots
  private snapshots: PnLSnapshot[] = [];

  // Daily records
  private dailyRecords: Map<string, DailyPnL> = new Map();

  // Trade tracking
  private trades: {
    timestamp: Date;
    pnl: number;
    isWin: boolean;
  }[] = [];

  // Snapshot settings
  private readonly maxSnapshots = 1000;
  private readonly snapshotIntervalMs = 60000; // 1 minute

  private snapshotInterval: NodeJS.Timeout | null = null;

  // ==========================================================================
  // SNAPSHOTS
  // ==========================================================================

  /**
   * Start automatic snapshots
   */
  startSnapshots(intervalMs: number = 60000): void {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
    }

    this.snapshotInterval = setInterval(() => {
      this.takeSnapshot().catch(err => {
        console.error('[PnL] Snapshot error:', err);
      });
    }, intervalMs);

    // Take initial snapshot
    this.takeSnapshot();
  }

  /**
   * Stop automatic snapshots
   */
  stopSnapshots(): void {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
  }

  /**
   * Take a P&L snapshot
   */
  async takeSnapshot(): Promise<PnLSnapshot> {
    const engine = getExecutionEngine();

    const [balance, summary] = await Promise.all([
      engine.getTotalBalance(),
      engine.getPositionSummary(),
    ]);

    const snapshot: PnLSnapshot = {
      timestamp: new Date(),
      portfolioValue: balance.total + summary.totalUnrealizedPnL,
      totalBalance: balance.total,
      unrealizedPnL: summary.totalUnrealizedPnL,
      realizedPnL: summary.totalRealizedPnL,
      fees: summary.totalFees,
      openPositions: summary.openPositions,
      closedPositions: summary.totalPositions - summary.openPositions,
      byPlatform: {} as any,
    };

    // Add platform breakdown
    for (const [platform, data] of Object.entries(summary.byPlatform)) {
      snapshot.byPlatform[platform as Platform] = {
        balance: balance.byPlatform[platform as Platform] || 0,
        unrealizedPnL: data.unrealizedPnL,
        realizedPnL: 0, // Would need to track this separately
      };
    }

    this.snapshots.push(snapshot);

    // Prune old snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.maxSnapshots);
    }

    // Update daily record
    this.updateDailyRecord(snapshot);

    return snapshot;
  }

  /**
   * Get recent snapshots
   */
  getSnapshots(limit: number = 100): PnLSnapshot[] {
    return this.snapshots.slice(-limit);
  }

  /**
   * Get snapshot at specific time (nearest)
   */
  getSnapshotAt(timestamp: Date): PnLSnapshot | null {
    if (this.snapshots.length === 0) return null;

    let closest = this.snapshots[0];
    let minDiff = Math.abs(timestamp.getTime() - closest.timestamp.getTime());

    for (const snapshot of this.snapshots) {
      const diff = Math.abs(timestamp.getTime() - snapshot.timestamp.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        closest = snapshot;
      }
    }

    return closest;
  }

  // ==========================================================================
  // DAILY RECORDS
  // ==========================================================================

  /**
   * Update daily P&L record
   */
  private updateDailyRecord(snapshot: PnLSnapshot): void {
    const date = snapshot.timestamp.toISOString().split('T')[0];

    let record = this.dailyRecords.get(date);

    if (!record) {
      // New day
      const previousDay = this.getPreviousDay(date);
      const previousRecord = previousDay ? this.dailyRecords.get(previousDay) : null;

      record = {
        date,
        openingBalance: previousRecord?.closingBalance || snapshot.totalBalance,
        openingPositions: previousRecord?.closingPositions || snapshot.openPositions,
        closingBalance: snapshot.totalBalance,
        closingPositions: snapshot.openPositions,
        pnl: 0,
        pnlPct: 0,
        realizedPnL: 0,
        unrealizedPnL: snapshot.unrealizedPnL,
        fees: 0,
        tradesExecuted: 0,
        volumeTraded: 0,
        maxDrawdown: 0,
        peakValue: snapshot.portfolioValue,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
      };
    }

    // Update closing values
    record.closingBalance = snapshot.totalBalance;
    record.closingPositions = snapshot.openPositions;
    record.unrealizedPnL = snapshot.unrealizedPnL;

    // Calculate daily P&L
    record.pnl = (record.closingBalance + record.unrealizedPnL) -
                 (record.openingBalance);
    record.pnlPct = record.openingBalance > 0
      ? record.pnl / record.openingBalance
      : 0;

    // Track peak for drawdown
    if (snapshot.portfolioValue > record.peakValue) {
      record.peakValue = snapshot.portfolioValue;
    }
    record.maxDrawdown = Math.max(
      record.maxDrawdown,
      record.peakValue - snapshot.portfolioValue
    );

    // Win rate
    const totalTrades = record.winningTrades + record.losingTrades;
    record.winRate = totalTrades > 0 ? record.winningTrades / totalTrades : 0;

    this.dailyRecords.set(date, record);
  }

  /**
   * Get previous day string
   */
  private getPreviousDay(date: string): string {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }

  /**
   * Get daily records
   */
  getDailyRecords(days: number = 30): DailyPnL[] {
    const records = Array.from(this.dailyRecords.values());
    return records
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, days);
  }

  /**
   * Get daily record for specific date
   */
  getDailyRecord(date: string): DailyPnL | null {
    return this.dailyRecords.get(date) || null;
  }

  // ==========================================================================
  // TRADE TRACKING
  // ==========================================================================

  /**
   * Record a completed trade
   */
  recordTrade(pnl: number, timestamp: Date = new Date()): void {
    this.trades.push({
      timestamp,
      pnl,
      isWin: pnl > 0,
    });

    // Update daily record
    const date = timestamp.toISOString().split('T')[0];
    const record = this.dailyRecords.get(date);

    if (record) {
      record.tradesExecuted++;
      record.realizedPnL += pnl;

      if (pnl > 0) {
        record.winningTrades++;
      } else if (pnl < 0) {
        record.losingTrades++;
      }

      const totalTrades = record.winningTrades + record.losingTrades;
      record.winRate = totalTrades > 0 ? record.winningTrades / totalTrades : 0;

      this.dailyRecords.set(date, record);
    }
  }

  // ==========================================================================
  // PERFORMANCE METRICS
  // ==========================================================================

  /**
   * Calculate comprehensive performance metrics
   */
  calculateMetrics(): PerformanceMetrics {
    const dailyRecords = this.getDailyRecords(365);

    if (dailyRecords.length === 0) {
      return this.emptyMetrics();
    }

    // Extract daily returns
    const dailyReturns = dailyRecords.map(r => r.pnlPct);
    const portfolioValues = this.snapshots.map(s => s.portfolioValue);

    // Total return
    const firstRecord = dailyRecords[dailyRecords.length - 1];
    const lastRecord = dailyRecords[0];
    const totalReturn = lastRecord.closingBalance - firstRecord.openingBalance +
                        lastRecord.unrealizedPnL;
    const totalReturnPct = firstRecord.openingBalance > 0
      ? totalReturn / firstRecord.openingBalance
      : 0;

    // Daily return stats
    const dailyReturnAvg = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const dailyReturnVariance = dailyReturns.reduce(
      (sum, r) => sum + Math.pow(r - dailyReturnAvg, 2),
      0
    ) / (dailyReturns.length - 1 || 1);
    const dailyReturnStd = Math.sqrt(dailyReturnVariance);

    // Risk-adjusted metrics
    const sharpeRatio = calculateSharpeRatio(dailyReturns);
    const sortinoRatio = calculateSortinoRatio(dailyReturns);

    // Drawdown
    const drawdownInfo = calculateMaxDrawdown(portfolioValues);
    const currentValue = portfolioValues[portfolioValues.length - 1] || 0;
    const peakValue = Math.max(...portfolioValues);
    const currentDrawdown = peakValue - currentValue;
    const currentDrawdownPct = peakValue > 0 ? currentDrawdown / peakValue : 0;

    // Calmar ratio (annualized return / max drawdown)
    const annualizedReturn = dailyReturnAvg * 252; // Trading days
    const calmarRatio = drawdownInfo.maxDrawdownPct > 0
      ? annualizedReturn / drawdownInfo.maxDrawdownPct
      : 0;

    // Win rate from trades
    const winningTrades = this.trades.filter(t => t.isWin).length;
    const losingTrades = this.trades.filter(t => !t.isWin && t.pnl !== 0).length;
    const totalTrades = winningTrades + losingTrades;
    const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;

    // Average win/loss
    const wins = this.trades.filter(t => t.pnl > 0);
    const losses = this.trades.filter(t => t.pnl < 0);
    const avgWin = wins.length > 0
      ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length
      : 0;
    const avgLoss = losses.length > 0
      ? Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length)
      : 0;

    // Profit factor
    const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    // Exposure
    const exposures = dailyRecords.map(r => r.closingPositions);
    const avgExposure = exposures.reduce((a, b) => a + b, 0) / exposures.length;
    const maxExposure = Math.max(...exposures);

    // Profitable days
    const profitableDays = dailyRecords.filter(r => r.pnl > 0).length;
    const profitableDaysPct = dailyRecords.length > 0
      ? profitableDays / dailyRecords.length
      : 0;

    return {
      totalReturn,
      totalReturnPct,
      dailyReturnAvg,
      dailyReturnStd,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      maxDrawdown: drawdownInfo.maxDrawdown,
      maxDrawdownPct: drawdownInfo.maxDrawdownPct,
      currentDrawdown,
      currentDrawdownPct,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      avgExposure,
      maxExposure,
      daysTracked: dailyRecords.length,
      profitableDays,
      profitableDaysPct,
    };
  }

  /**
   * Empty metrics template
   */
  private emptyMetrics(): PerformanceMetrics {
    return {
      totalReturn: 0,
      totalReturnPct: 0,
      dailyReturnAvg: 0,
      dailyReturnStd: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      currentDrawdown: 0,
      currentDrawdownPct: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      avgExposure: 0,
      maxExposure: 0,
      daysTracked: 0,
      profitableDays: 0,
      profitableDaysPct: 0,
    };
  }

  // ==========================================================================
  // EXPORT / REPORTING
  // ==========================================================================

  /**
   * Export P&L data as CSV
   */
  exportDailyCSV(): string {
    const records = this.getDailyRecords(365);

    const headers = [
      'Date',
      'Opening Balance',
      'Closing Balance',
      'P&L',
      'P&L %',
      'Realized P&L',
      'Unrealized P&L',
      'Trades',
      'Win Rate',
      'Max Drawdown',
    ].join(',');

    const rows = records.map(r => [
      r.date,
      r.openingBalance.toFixed(2),
      r.closingBalance.toFixed(2),
      r.pnl.toFixed(2),
      (r.pnlPct * 100).toFixed(2) + '%',
      r.realizedPnL.toFixed(2),
      r.unrealizedPnL.toFixed(2),
      r.tradesExecuted,
      (r.winRate * 100).toFixed(1) + '%',
      r.maxDrawdown.toFixed(2),
    ].join(','));

    return [headers, ...rows].join('\n');
  }

  /**
   * Get P&L summary for display
   */
  async getSummary(): Promise<{
    current: PnLSnapshot | null;
    today: DailyPnL | null;
    metrics: PerformanceMetrics;
    recentSnapshots: PnLSnapshot[];
  }> {
    const current = this.snapshots.length > 0
      ? this.snapshots[this.snapshots.length - 1]
      : await this.takeSnapshot();

    const today = this.getDailyRecord(new Date().toISOString().split('T')[0]);
    const metrics = this.calculateMetrics();
    const recentSnapshots = this.getSnapshots(60); // Last hour

    return { current, today, metrics, recentSnapshots };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let pnlTracker: PnLTracker | null = null;

export function getPnLTracker(): PnLTracker {
  if (!pnlTracker) {
    pnlTracker = new PnLTracker();
  }
  return pnlTracker;
}

export default PnLTracker;
