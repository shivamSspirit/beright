/**
 * Drawdown Control
 *
 * Track and manage portfolio drawdowns.
 *
 * @author BeRight Protocol
 */

import {
  DrawdownEvent,
  DrawdownAnalysis,
  DynamicLimitAdjustment,
} from './types';
import { RiskConfig, DEFAULT_RISK_CONFIG, calculateMaxDrawdown } from '../portfolio/types';

// =============================================================================
// DRAWDOWN CONTROLLER
// =============================================================================

export class DrawdownController {
  private config: RiskConfig;

  // Historical drawdown events
  private drawdownHistory: DrawdownEvent[] = [];

  // Current tracking
  private peakValue: number = 0;
  private currentValue: number = 0;
  private inDrawdown: boolean = false;
  private drawdownStartDate: Date | null = null;
  private drawdownStartValue: number = 0;

  constructor(config?: Partial<RiskConfig>) {
    this.config = { ...DEFAULT_RISK_CONFIG, ...config };
  }

  // ==========================================================================
  // VALUE TRACKING
  // ==========================================================================

  /**
   * Update current portfolio value
   */
  updateValue(newValue: number): void {
    this.currentValue = newValue;

    if (newValue > this.peakValue) {
      // New high - exit any drawdown
      if (this.inDrawdown) {
        this.recordDrawdownEnd(newValue);
      }
      this.peakValue = newValue;
    } else if (!this.inDrawdown && newValue < this.peakValue * 0.99) {
      // Entering drawdown (1% threshold to avoid noise)
      this.startDrawdown();
    }
  }

  /**
   * Start tracking a new drawdown
   */
  private startDrawdown(): void {
    this.inDrawdown = true;
    this.drawdownStartDate = new Date();
    this.drawdownStartValue = this.peakValue;
  }

  /**
   * Record end of drawdown
   */
  private recordDrawdownEnd(recoveryValue: number): void {
    if (!this.drawdownStartDate) return;

    const troughValue = Math.min(...this.getRecentValues());
    const drawdownAmt = this.drawdownStartValue - troughValue;
    const drawdownPct = this.drawdownStartValue > 0
      ? drawdownAmt / this.drawdownStartValue
      : 0;

    const event: DrawdownEvent = {
      id: `dd_${Date.now()}`,
      startDate: this.drawdownStartDate,
      endDate: new Date(),
      peakValue: this.drawdownStartValue,
      troughValue,
      drawdownAmt,
      drawdownPct,
      durationDays: Math.ceil(
        (Date.now() - this.drawdownStartDate.getTime()) / (1000 * 60 * 60 * 24)
      ),
      recovered: true,
      recoveryDate: new Date(),
      recoveryDays: Math.ceil(
        (Date.now() - this.drawdownStartDate.getTime()) / (1000 * 60 * 60 * 24)
      ),
    };

    this.drawdownHistory.push(event);
    this.inDrawdown = false;
    this.drawdownStartDate = null;
    this.drawdownStartValue = 0;

    // Keep only last 100 events
    if (this.drawdownHistory.length > 100) {
      this.drawdownHistory = this.drawdownHistory.slice(-100);
    }
  }

  /**
   * Get recent portfolio values (placeholder - would integrate with PnL tracker)
   */
  private getRecentValues(): number[] {
    // In production, this would pull from PnL tracker snapshots
    return [this.currentValue];
  }

  // ==========================================================================
  // ANALYSIS
  // ==========================================================================

  /**
   * Get current drawdown analysis
   */
  analyze(): DrawdownAnalysis {
    const currentDrawdown = this.peakValue - this.currentValue;
    const currentDrawdownPct = this.peakValue > 0
      ? currentDrawdown / this.peakValue
      : 0;

    // Find max historical drawdown
    let maxDrawdown = currentDrawdown;
    let maxDrawdownPct = currentDrawdownPct;
    let maxDrawdownDate = new Date();

    for (const event of this.drawdownHistory) {
      if (event.drawdownPct > maxDrawdownPct) {
        maxDrawdownPct = event.drawdownPct;
        maxDrawdown = event.drawdownAmt;
        maxDrawdownDate = event.startDate;
      }
    }

    // Calculate averages
    const recoveredEvents = this.drawdownHistory.filter(e => e.recovered);
    const avgDrawdown = recoveredEvents.length > 0
      ? recoveredEvents.reduce((sum, e) => sum + e.drawdownPct, 0) / recoveredEvents.length
      : 0;
    const avgRecoveryDays = recoveredEvents.length > 0
      ? recoveredEvents.reduce((sum, e) => sum + (e.recoveryDays || 0), 0) / recoveredEvents.length
      : 0;

    // Days in current drawdown
    const daysInCurrentDrawdown = this.drawdownStartDate
      ? Math.ceil((Date.now() - this.drawdownStartDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      currentDrawdown,
      currentDrawdownPct,
      maxDrawdown,
      maxDrawdownPct,
      maxDrawdownDate,
      averageDrawdown: avgDrawdown,
      averageRecoveryDays: avgRecoveryDays,
      currentInDrawdown: this.inDrawdown,
      daysInCurrentDrawdown,
      drawdownHistory: this.drawdownHistory.slice(-20),
    };
  }

  // ==========================================================================
  // LIMIT ADJUSTMENTS
  // ==========================================================================

  /**
   * Get dynamic limit adjustments based on drawdown
   */
  getDynamicLimits(): DynamicLimitAdjustment[] {
    const analysis = this.analyze();
    const adjustments: DynamicLimitAdjustment[] = [];

    // Reduce position size limits during drawdown
    if (analysis.currentDrawdownPct > 0.05) {
      const factor = Math.max(0.5, 1 - analysis.currentDrawdownPct);

      adjustments.push({
        originalLimit: this.config.maxPositionSize,
        adjustedLimit: this.config.maxPositionSize * factor,
        adjustmentFactor: factor,
        reason: `In ${(analysis.currentDrawdownPct * 100).toFixed(1)}% drawdown`,
        triggers: ['DRAWDOWN'],
      });
    }

    // Reduce Kelly fraction during extended drawdowns
    if (analysis.daysInCurrentDrawdown > 5) {
      const factor = Math.max(0.5, 1 - (analysis.daysInCurrentDrawdown / 30));

      adjustments.push({
        originalLimit: this.config.kellyFraction,
        adjustedLimit: this.config.kellyFraction * factor,
        adjustmentFactor: factor,
        reason: `${analysis.daysInCurrentDrawdown} days in drawdown`,
        triggers: ['EXTENDED_DRAWDOWN'],
      });
    }

    // Reduce exposure after large drawdowns
    if (analysis.maxDrawdownPct > this.config.maxDrawdownPct * 0.7) {
      const factor = 0.8;

      adjustments.push({
        originalLimit: this.config.maxExposurePct,
        adjustedLimit: this.config.maxExposurePct * factor,
        adjustmentFactor: factor,
        reason: 'Significant historical drawdown',
        triggers: ['HISTORICAL_DRAWDOWN'],
      });
    }

    return adjustments;
  }

  /**
   * Check if trading should be paused
   */
  shouldPauseTrading(): {
    pause: boolean;
    reason: string;
  } {
    const analysis = this.analyze();

    // Pause if at max drawdown
    if (analysis.currentDrawdownPct >= this.config.maxDrawdownPct) {
      return {
        pause: true,
        reason: `Max drawdown limit reached (${(analysis.currentDrawdownPct * 100).toFixed(1)}%)`,
      };
    }

    // Pause if drawdown is accelerating
    const recentEvents = this.drawdownHistory.slice(-5);
    if (recentEvents.length >= 3) {
      const avgRecentDrawdown = recentEvents.reduce(
        (sum, e) => sum + e.drawdownPct,
        0
      ) / recentEvents.length;

      if (avgRecentDrawdown > 0.05 && analysis.currentDrawdownPct > avgRecentDrawdown) {
        return {
          pause: true,
          reason: 'Accelerating drawdown pattern detected',
        };
      }
    }

    return { pause: false, reason: '' };
  }

  // ==========================================================================
  // RECOVERY TRACKING
  // ==========================================================================

  /**
   * Get recovery progress
   */
  getRecoveryProgress(): {
    needed: number;
    neededPct: number;
    estimatedDays: number;
    onTrack: boolean;
  } {
    const analysis = this.analyze();

    if (!this.inDrawdown || analysis.currentDrawdown <= 0) {
      return {
        needed: 0,
        neededPct: 0,
        estimatedDays: 0,
        onTrack: true,
      };
    }

    const needed = this.peakValue - this.currentValue;
    const neededPct = this.currentValue > 0 ? needed / this.currentValue : 0;

    // Estimate recovery based on historical average
    const estimatedDays = analysis.averageRecoveryDays > 0
      ? Math.ceil(analysis.averageRecoveryDays * (analysis.currentDrawdownPct / analysis.averageDrawdown))
      : 30;

    // Check if on track (not worse than average)
    const onTrack = analysis.daysInCurrentDrawdown <= estimatedDays;

    return {
      needed,
      neededPct,
      estimatedDays,
      onTrack,
    };
  }

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RiskConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set peak value (for initialization)
   */
  setPeak(value: number): void {
    this.peakValue = value;
    this.currentValue = value;
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let drawdownController: DrawdownController | null = null;

export function getDrawdownController(config?: Partial<RiskConfig>): DrawdownController {
  if (!drawdownController) {
    drawdownController = new DrawdownController(config);
  }
  return drawdownController;
}

export default DrawdownController;
