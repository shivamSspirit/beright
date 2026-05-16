/**
 * Risk Manager
 *
 * Enforces risk limits and validates trades before execution.
 * "The first rule of trading: don't lose money."
 *
 * @author BeRight Protocol
 */

import {
  RiskConfig,
  DEFAULT_RISK_CONFIG,
  RiskCheckResult,
  RiskWarning,
  RiskViolation,
  RiskWarningType,
  RiskViolationType,
} from './types';
import { OrderRequest, Position } from '../execution/types';
import { Platform, MarketCategory } from '../dataFabric/types';
import { getPositionManager } from '../execution/positions';
import { getExecutionEngine } from '../execution';
import { calculateKelly } from './kelly';
import { KellyInput } from './types';

// =============================================================================
// RISK MANAGER
// =============================================================================

export class RiskManager {
  private config: RiskConfig;

  // Daily tracking
  private dailyStartBalance: number = 0;
  private dailyLoss: number = 0;
  private dailyPeakBalance: number = 0;

  // Historical peak for drawdown
  private allTimePeak: number = 0;

  constructor(config?: Partial<RiskConfig>) {
    this.config = { ...DEFAULT_RISK_CONFIG, ...config };
  }

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  /**
   * Update risk configuration
   */
  updateConfig(config: Partial<RiskConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): RiskConfig {
    return { ...this.config };
  }

  /**
   * Reset daily tracking (call at start of each day)
   */
  async resetDaily(): Promise<void> {
    const engine = getExecutionEngine();
    const balance = await engine.getTotalBalance();

    this.dailyStartBalance = balance.total;
    this.dailyLoss = 0;
    this.dailyPeakBalance = balance.total;

    if (balance.total > this.allTimePeak) {
      this.allTimePeak = balance.total;
    }
  }

  // ==========================================================================
  // PRE-TRADE RISK CHECK
  // ==========================================================================

  /**
   * Comprehensive risk check before executing a trade
   */
  async checkTrade(
    request: OrderRequest,
    modelProbability?: number,
    confidence?: number
  ): Promise<RiskCheckResult> {
    const warnings: RiskWarning[] = [];
    const violations: RiskViolation[] = [];

    // Get current state
    const engine = getExecutionEngine();
    const positionManager = getPositionManager();

    const [balance, positions, exposure, summary] = await Promise.all([
      engine.getTotalBalance(),
      engine.getOpenPositions(),
      engine.getExposure(),
      engine.getPositionSummary(),
    ]);

    const portfolioValue = balance.total;
    const tradeCost = request.size * (request.price || 0.5);

    // 1. Position size limits
    if (tradeCost > this.config.maxPositionSize) {
      violations.push({
        type: 'POSITION_SIZE_EXCEEDED',
        message: `Position size $${tradeCost.toFixed(0)} exceeds max $${this.config.maxPositionSize}`,
        currentValue: tradeCost,
        limit: this.config.maxPositionSize,
      });
    } else if (tradeCost > this.config.maxPositionSize * 0.8) {
      warnings.push({
        type: 'APPROACHING_POSITION_LIMIT',
        message: 'Approaching position size limit',
        currentValue: tradeCost,
        threshold: this.config.maxPositionSize,
        severity: 'medium',
      });
    }

    // Position as % of portfolio
    if (tradeCost > portfolioValue * this.config.maxPositionPct) {
      violations.push({
        type: 'POSITION_SIZE_EXCEEDED',
        message: `Position ${((tradeCost / portfolioValue) * 100).toFixed(1)}% exceeds ${(this.config.maxPositionPct * 100).toFixed(0)}% limit`,
        currentValue: tradeCost / portfolioValue,
        limit: this.config.maxPositionPct,
      });
    }

    // 2. Total exposure limits
    const newTotalExposure = exposure.totalAtRisk + tradeCost;

    if (newTotalExposure > this.config.maxTotalExposure) {
      violations.push({
        type: 'TOTAL_EXPOSURE_EXCEEDED',
        message: `Total exposure $${newTotalExposure.toFixed(0)} exceeds max $${this.config.maxTotalExposure}`,
        currentValue: newTotalExposure,
        limit: this.config.maxTotalExposure,
      });
    }

    if (newTotalExposure > portfolioValue * this.config.maxExposurePct) {
      violations.push({
        type: 'TOTAL_EXPOSURE_EXCEEDED',
        message: `Total exposure ${((newTotalExposure / portfolioValue) * 100).toFixed(1)}% exceeds ${(this.config.maxExposurePct * 100).toFixed(0)}% limit`,
        currentValue: newTotalExposure / portfolioValue,
        limit: this.config.maxExposurePct,
      });
    } else if (newTotalExposure > portfolioValue * this.config.maxExposurePct * 0.8) {
      warnings.push({
        type: 'APPROACHING_EXPOSURE_LIMIT',
        message: 'Approaching total exposure limit',
        currentValue: newTotalExposure / portfolioValue,
        threshold: this.config.maxExposurePct,
        severity: 'medium',
      });
    }

    // 3. Platform limits
    const platformExposure = exposure.exposureByPlatform[request.platform] || 0;
    const newPlatformExposure = platformExposure + tradeCost;

    if (newPlatformExposure > this.config.maxPerPlatform) {
      violations.push({
        type: 'PLATFORM_LIMIT_EXCEEDED',
        message: `${request.platform} exposure $${newPlatformExposure.toFixed(0)} exceeds max $${this.config.maxPerPlatform}`,
        currentValue: newPlatformExposure,
        limit: this.config.maxPerPlatform,
      });
    }

    if (newPlatformExposure > portfolioValue * this.config.maxPerPlatformPct) {
      warnings.push({
        type: 'APPROACHING_PLATFORM_LIMIT',
        message: `High concentration in ${request.platform}`,
        currentValue: newPlatformExposure / portfolioValue,
        threshold: this.config.maxPerPlatformPct,
        severity: 'medium',
      });
    }

    // 4. Max positions
    if (positions.length >= this.config.maxOpenPositions) {
      violations.push({
        type: 'MAX_POSITIONS_EXCEEDED',
        message: `Already at max positions (${this.config.maxOpenPositions})`,
        currentValue: positions.length,
        limit: this.config.maxOpenPositions,
      });
    }

    // 5. Daily loss limit
    if (this.dailyLoss >= this.config.maxDailyLoss) {
      violations.push({
        type: 'DAILY_LOSS_LIMIT_EXCEEDED',
        message: `Daily loss limit reached ($${this.dailyLoss.toFixed(0)})`,
        currentValue: this.dailyLoss,
        limit: this.config.maxDailyLoss,
      });
    } else if (this.dailyLoss > this.config.maxDailyLoss * 0.7) {
      warnings.push({
        type: 'APPROACHING_DAILY_LOSS_LIMIT',
        message: `Daily loss at ${((this.dailyLoss / this.config.maxDailyLoss) * 100).toFixed(0)}% of limit`,
        currentValue: this.dailyLoss,
        threshold: this.config.maxDailyLoss,
        severity: 'high',
      });
    }

    // 6. Drawdown limit
    const currentDrawdown = this.allTimePeak - portfolioValue;
    const drawdownPct = this.allTimePeak > 0 ? currentDrawdown / this.allTimePeak : 0;

    if (drawdownPct >= this.config.maxDrawdownPct) {
      violations.push({
        type: 'DRAWDOWN_LIMIT_EXCEEDED',
        message: `Drawdown ${(drawdownPct * 100).toFixed(1)}% exceeds ${(this.config.maxDrawdownPct * 100).toFixed(0)}% limit`,
        currentValue: drawdownPct,
        limit: this.config.maxDrawdownPct,
      });
    } else if (drawdownPct > this.config.maxDrawdownPct * 0.7) {
      warnings.push({
        type: 'APPROACHING_DAILY_LOSS_LIMIT',
        message: `In significant drawdown (${(drawdownPct * 100).toFixed(1)}%)`,
        currentValue: drawdownPct,
        threshold: this.config.maxDrawdownPct,
        severity: 'high',
      });
    }

    // 7. Edge and confidence checks (if provided)
    if (modelProbability !== undefined && request.price !== undefined) {
      const edge = Math.abs(modelProbability - request.price);

      if (edge < this.config.minEdgeForTrade) {
        violations.push({
          type: 'INSUFFICIENT_EDGE',
          message: `Edge ${(edge * 100).toFixed(1)}% below minimum ${(this.config.minEdgeForTrade * 100).toFixed(0)}%`,
          currentValue: edge,
          limit: this.config.minEdgeForTrade,
        });
      } else if (edge < this.config.minEdgeForTrade * 1.5) {
        warnings.push({
          type: 'LOW_EDGE',
          message: 'Marginal edge detected',
          currentValue: edge,
          threshold: this.config.minEdgeForTrade * 1.5,
          severity: 'low',
        });
      }
    }

    if (confidence !== undefined && confidence < this.config.minConfidenceForTrade) {
      violations.push({
        type: 'INSUFFICIENT_CONFIDENCE',
        message: `Confidence ${(confidence * 100).toFixed(0)}% below minimum ${(this.config.minConfidenceForTrade * 100).toFixed(0)}%`,
        currentValue: confidence,
        limit: this.config.minConfidenceForTrade,
      });
    } else if (confidence !== undefined && confidence < this.config.minConfidenceForTrade * 1.2) {
      warnings.push({
        type: 'LOW_CONFIDENCE',
        message: 'Low confidence in analysis',
        currentValue: confidence,
        threshold: this.config.minConfidenceForTrade * 1.2,
        severity: 'medium',
      });
    }

    // Calculate suggested size if current is rejected
    let suggestedSize: number | undefined;
    if (violations.length > 0) {
      suggestedSize = this.calculateSuggestedSize(
        portfolioValue,
        exposure.totalAtRisk,
        request.platform,
        platformExposure
      );
    }

    // Generate reasoning
    const approved = violations.length === 0;
    let reasoning: string;

    if (approved) {
      if (warnings.length > 0) {
        reasoning = `Trade approved with ${warnings.length} warning(s). Review before proceeding.`;
      } else {
        reasoning = 'Trade approved. All risk checks passed.';
      }
    } else {
      reasoning = `Trade rejected due to ${violations.length} violation(s): ${violations.map(v => v.type).join(', ')}.`;
      if (suggestedSize) {
        reasoning += ` Consider reducing size to $${suggestedSize.toFixed(0)}.`;
      }
    }

    return {
      approved,
      warnings,
      violations,
      suggestedSize,
      reasoning,
    };
  }

  /**
   * Calculate suggested position size within limits
   */
  private calculateSuggestedSize(
    portfolioValue: number,
    currentExposure: number,
    platform: Platform,
    platformExposure: number
  ): number {
    const limits = [
      this.config.maxPositionSize,
      portfolioValue * this.config.maxPositionPct,
      this.config.maxTotalExposure - currentExposure,
      portfolioValue * this.config.maxExposurePct - currentExposure,
      this.config.maxPerPlatform - platformExposure,
      portfolioValue * this.config.maxPerPlatformPct - platformExposure,
    ];

    return Math.max(0, Math.min(...limits) * 0.9); // 90% of limit
  }

  // ==========================================================================
  // POSITION MONITORING
  // ==========================================================================

  /**
   * Check existing positions for risk events
   */
  async monitorPositions(): Promise<{
    stopLossTriggers: Position[];
    takeProfitTriggers: Position[];
    warnings: RiskWarning[];
  }> {
    const positionManager = getPositionManager();
    const positions = await positionManager.getOpenPositions();

    const stopLossTriggers: Position[] = [];
    const takeProfitTriggers: Position[] = [];
    const warnings: RiskWarning[] = [];

    for (const position of positions) {
      // Check stop loss
      if (position.unrealizedPnLPct <= -this.config.stopLossDefault) {
        stopLossTriggers.push(position);
      } else if (position.unrealizedPnLPct <= -this.config.stopLossDefault * 0.7) {
        warnings.push({
          type: 'APPROACHING_POSITION_LIMIT',
          message: `Position ${position.marketId} approaching stop loss`,
          currentValue: position.unrealizedPnLPct,
          threshold: -this.config.stopLossDefault,
          severity: 'high',
        });
      }

      // Check take profit
      if (position.unrealizedPnLPct >= this.config.takeProfitDefault) {
        takeProfitTriggers.push(position);
      }
    }

    return { stopLossTriggers, takeProfitTriggers, warnings };
  }

  // ==========================================================================
  // KELLY INTEGRATION
  // ==========================================================================

  /**
   * Get Kelly-optimal position size with risk limits applied
   */
  async getKellySize(
    probability: number,
    marketPrice: number,
    confidence: number
  ): Promise<{
    suggestedSize: number;
    kellyFraction: number;
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

    // Apply additional risk limits
    let suggestedSize = kelly.suggestedDollars;
    let riskAdjusted = false;

    // Reduce if in drawdown
    const drawdownPct = this.allTimePeak > 0
      ? (this.allTimePeak - balance.total) / this.allTimePeak
      : 0;

    if (drawdownPct > 0.05) {
      const drawdownFactor = 1 - drawdownPct;
      suggestedSize *= drawdownFactor;
      riskAdjusted = true;
    }

    // Reduce if approaching daily loss limit
    if (this.dailyLoss > this.config.maxDailyLoss * 0.5) {
      const dailyFactor = 1 - (this.dailyLoss / this.config.maxDailyLoss);
      suggestedSize *= dailyFactor;
      riskAdjusted = true;
    }

    let reasoning = kelly.reasoning;
    if (riskAdjusted) {
      reasoning += ` Size reduced due to current drawdown or daily loss.`;
    }

    return {
      suggestedSize,
      kellyFraction: kelly.suggestedFraction,
      riskAdjusted,
      reasoning,
    };
  }

  // ==========================================================================
  // DAILY TRACKING
  // ==========================================================================

  /**
   * Record a loss (call after losing trade or position mark-to-market)
   */
  recordLoss(amount: number): void {
    this.dailyLoss += amount;
  }

  /**
   * Get daily risk status
   */
  getDailyStatus(): {
    startBalance: number;
    currentLoss: number;
    remainingLossAllowance: number;
    tradingAllowed: boolean;
    drawdownFromPeak: number;
  } {
    return {
      startBalance: this.dailyStartBalance,
      currentLoss: this.dailyLoss,
      remainingLossAllowance: Math.max(0, this.config.maxDailyLoss - this.dailyLoss),
      tradingAllowed: this.dailyLoss < this.config.maxDailyLoss,
      drawdownFromPeak: this.allTimePeak - this.dailyStartBalance,
    };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let riskManager: RiskManager | null = null;

export function getRiskManager(config?: Partial<RiskConfig>): RiskManager {
  if (!riskManager) {
    riskManager = new RiskManager(config);
  } else if (config) {
    riskManager.updateConfig(config);
  }
  return riskManager;
}

export default RiskManager;
