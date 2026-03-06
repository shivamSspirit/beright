/**
 * Portfolio & Risk Management Types
 *
 * Types for risk limits, alerts, P&L tracking, and portfolio management.
 *
 * @author BeRight Protocol
 * @version 3.0.0 - Bloomberg Terminal Architecture
 */

import { Platform, MarketCategory } from '../dataFabric/types';
import { Position, OrderSide } from '../execution/types';

// =============================================================================
// RISK CONFIGURATION
// =============================================================================

/**
 * Portfolio risk configuration
 */
export interface RiskConfig {
  // Position limits
  maxPositionSize: number;           // Max $ per position
  maxPositionPct: number;            // Max % of portfolio per position
  maxTotalExposure: number;          // Max total $ at risk
  maxExposurePct: number;            // Max % of portfolio at risk

  // Platform limits
  maxPerPlatform: number;            // Max $ per platform
  maxPerPlatformPct: number;         // Max % per platform

  // Category limits
  maxPerCategory: number;            // Max $ per category
  maxPerCategoryPct: number;         // Max % per category

  // Loss limits
  maxDailyLoss: number;              // Stop trading if daily loss exceeds
  maxDailyLossPct: number;           // Stop trading if daily loss % exceeds
  maxDrawdown: number;               // Max drawdown from peak
  maxDrawdownPct: number;            // Max drawdown % from peak

  // Position management
  stopLossDefault: number;           // Default stop loss %
  takeProfitDefault: number;         // Default take profit %
  maxOpenPositions: number;          // Maximum number of open positions

  // Kelly sizing
  kellyFraction: number;             // Kelly fraction (0.25 = quarter kelly)
  minEdgeForTrade: number;           // Minimum edge to trade
  minConfidenceForTrade: number;     // Minimum confidence to trade

  // Correlation limits
  maxCorrelatedExposure: number;     // Max exposure to correlated positions
}

/**
 * Default risk configuration (conservative)
 */
export const DEFAULT_RISK_CONFIG: RiskConfig = {
  maxPositionSize: 1000,
  maxPositionPct: 0.1,              // 10% max per position
  maxTotalExposure: 5000,
  maxExposurePct: 0.5,              // 50% max total exposure

  maxPerPlatform: 3000,
  maxPerPlatformPct: 0.4,           // 40% max per platform

  maxPerCategory: 2000,
  maxPerCategoryPct: 0.3,           // 30% max per category

  maxDailyLoss: 500,
  maxDailyLossPct: 0.05,            // 5% max daily loss
  maxDrawdown: 1000,
  maxDrawdownPct: 0.1,              // 10% max drawdown

  stopLossDefault: 0.15,            // 15% stop loss
  takeProfitDefault: 0.25,          // 25% take profit
  maxOpenPositions: 20,

  kellyFraction: 0.25,              // Quarter kelly
  minEdgeForTrade: 0.03,            // 3% minimum edge
  minConfidenceForTrade: 0.5,       // 50% minimum confidence

  maxCorrelatedExposure: 2000,
};

// =============================================================================
// RISK ASSESSMENT
// =============================================================================

/**
 * Risk check result
 */
export interface RiskCheckResult {
  approved: boolean;
  warnings: RiskWarning[];
  violations: RiskViolation[];
  suggestedSize?: number;           // Suggested position size if current rejected
  reasoning: string;
}

/**
 * Risk warning (non-blocking)
 */
export interface RiskWarning {
  type: RiskWarningType;
  message: string;
  currentValue: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Risk violation (blocking)
 */
export interface RiskViolation {
  type: RiskViolationType;
  message: string;
  currentValue: number;
  limit: number;
}

export type RiskWarningType =
  | 'APPROACHING_POSITION_LIMIT'
  | 'APPROACHING_EXPOSURE_LIMIT'
  | 'APPROACHING_PLATFORM_LIMIT'
  | 'APPROACHING_CATEGORY_LIMIT'
  | 'APPROACHING_DAILY_LOSS_LIMIT'
  | 'LOW_EDGE'
  | 'LOW_CONFIDENCE'
  | 'HIGH_CORRELATION';

export type RiskViolationType =
  | 'POSITION_SIZE_EXCEEDED'
  | 'TOTAL_EXPOSURE_EXCEEDED'
  | 'PLATFORM_LIMIT_EXCEEDED'
  | 'CATEGORY_LIMIT_EXCEEDED'
  | 'DAILY_LOSS_LIMIT_EXCEEDED'
  | 'DRAWDOWN_LIMIT_EXCEEDED'
  | 'MAX_POSITIONS_EXCEEDED'
  | 'INSUFFICIENT_EDGE'
  | 'INSUFFICIENT_CONFIDENCE';

// =============================================================================
// ALERTS
// =============================================================================

/**
 * Alert types
 */
export type AlertType =
  | 'RISK_LIMIT_WARNING'
  | 'RISK_LIMIT_BREACH'
  | 'POSITION_STOP_LOSS'
  | 'POSITION_TAKE_PROFIT'
  | 'MARKET_CLOSING_SOON'
  | 'LARGE_PRICE_MOVE'
  | 'DAILY_LOSS_WARNING'
  | 'DRAWDOWN_WARNING'
  | 'NEW_OPPORTUNITY'
  | 'ARBITRAGE_DETECTED'
  | 'CORRELATION_WARNING';

/**
 * Alert priority
 */
export type AlertPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Portfolio alert
 */
export interface PortfolioAlert {
  id: string;
  type: AlertType;
  priority: AlertPriority;
  title: string;
  message: string;
  data?: Record<string, any>;

  // Context
  marketId?: string;
  positionId?: string;
  platform?: Platform;

  // Status
  createdAt: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;

  // Actions
  suggestedAction?: string;
  actionTaken?: string;
}

// =============================================================================
// P&L TRACKING
// =============================================================================

/**
 * P&L snapshot
 */
export interface PnLSnapshot {
  timestamp: Date;

  // Values
  portfolioValue: number;
  totalBalance: number;
  unrealizedPnL: number;
  realizedPnL: number;
  fees: number;

  // Positions
  openPositions: number;
  closedPositions: number;

  // By platform
  byPlatform: Record<Platform, {
    balance: number;
    unrealizedPnL: number;
    realizedPnL: number;
  }>;
}

/**
 * Daily P&L record
 */
export interface DailyPnL {
  date: string;                      // YYYY-MM-DD

  // Opening values
  openingBalance: number;
  openingPositions: number;

  // Closing values
  closingBalance: number;
  closingPositions: number;

  // Changes
  pnl: number;
  pnlPct: number;
  realizedPnL: number;
  unrealizedPnL: number;
  fees: number;

  // Trading activity
  tradesExecuted: number;
  volumeTraded: number;

  // Risk metrics
  maxDrawdown: number;
  peakValue: number;

  // Win/loss
  winningTrades: number;
  losingTrades: number;
  winRate: number;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  // Returns
  totalReturn: number;
  totalReturnPct: number;
  dailyReturnAvg: number;
  dailyReturnStd: number;

  // Risk-adjusted
  sharpeRatio: number;              // Assuming 0% risk-free rate
  sortinoRatio: number;             // Downside deviation only
  calmarRatio: number;              // Return / max drawdown

  // Drawdown
  maxDrawdown: number;
  maxDrawdownPct: number;
  currentDrawdown: number;
  currentDrawdownPct: number;

  // Win rate
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;             // Gross profit / gross loss

  // Exposure
  avgExposure: number;
  maxExposure: number;

  // Time in market
  daysTracked: number;
  profitableDays: number;
  profitableDaysPct: number;
}

// =============================================================================
// KELLY CRITERION
// =============================================================================

/**
 * Kelly sizing input
 */
export interface KellyInput {
  probability: number;               // Model probability (0-1)
  marketPrice: number;               // Current market price (0-1)
  confidence: number;                // Confidence in estimate (0-1)
  portfolioValue: number;            // Total portfolio value
  currentExposure: number;           // Current total exposure
}

/**
 * Kelly sizing output
 */
export interface KellyOutput {
  fullKelly: number;                 // Full Kelly fraction
  halfKelly: number;                 // Half Kelly (safer)
  quarterKelly: number;              // Quarter Kelly (conservative)
  suggestedFraction: number;         // Recommended based on config

  // Dollar amounts
  fullKellyDollars: number;
  suggestedDollars: number;
  maxAllowedDollars: number;         // Based on risk limits

  // Analysis
  edge: number;
  expectedValue: number;
  varianceReduction: number;         // % reduction from full kelly

  reasoning: string;
}

// =============================================================================
// PORTFOLIO OPTIMIZATION
// =============================================================================

/**
 * Portfolio allocation suggestion
 */
export interface AllocationSuggestion {
  marketId: string;
  question: string;
  currentAllocation: number;
  suggestedAllocation: number;
  reason: string;
  expectedEdge: number;
  confidence: number;
}

/**
 * Rebalancing recommendation
 */
export interface RebalanceRecommendation {
  needed: boolean;
  urgency: 'low' | 'medium' | 'high';

  // Suggested changes
  toIncrease: AllocationSuggestion[];
  toDecrease: AllocationSuggestion[];
  toClose: AllocationSuggestion[];

  // Summary
  currentConcentration: number;      // Herfindahl index
  targetConcentration: number;
  estimatedImprovement: number;

  reasoning: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate unique alert ID
 */
export function generateAlertId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `alert_${timestamp}_${random}`;
}

/**
 * Calculate Sharpe ratio
 */
export function calculateSharpeRatio(
  returns: number[],
  riskFreeRate: number = 0
): number {
  if (returns.length < 2) return 0;

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const excessReturn = avgReturn - riskFreeRate;

  const variance = returns.reduce(
    (sum, r) => sum + Math.pow(r - avgReturn, 2),
    0
  ) / (returns.length - 1);

  const stdDev = Math.sqrt(variance);

  return stdDev > 0 ? excessReturn / stdDev : 0;
}

/**
 * Calculate Sortino ratio (downside deviation only)
 */
export function calculateSortinoRatio(
  returns: number[],
  riskFreeRate: number = 0
): number {
  if (returns.length < 2) return 0;

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const excessReturn = avgReturn - riskFreeRate;

  const downsideReturns = returns.filter(r => r < riskFreeRate);
  if (downsideReturns.length === 0) return avgReturn > 0 ? Infinity : 0;

  const downsideVariance = downsideReturns.reduce(
    (sum, r) => sum + Math.pow(r - riskFreeRate, 2),
    0
  ) / downsideReturns.length;

  const downsideDeviation = Math.sqrt(downsideVariance);

  return downsideDeviation > 0 ? excessReturn / downsideDeviation : 0;
}

/**
 * Calculate maximum drawdown
 */
export function calculateMaxDrawdown(values: number[]): {
  maxDrawdown: number;
  maxDrawdownPct: number;
  peakIndex: number;
  troughIndex: number;
} {
  if (values.length < 2) {
    return { maxDrawdown: 0, maxDrawdownPct: 0, peakIndex: 0, troughIndex: 0 };
  }

  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  let peak = values[0];
  let peakIndex = 0;
  let troughIndex = 0;
  let resultPeakIndex = 0;

  for (let i = 1; i < values.length; i++) {
    if (values[i] > peak) {
      peak = values[i];
      peakIndex = i;
    }

    const drawdown = peak - values[i];
    const drawdownPct = peak > 0 ? drawdown / peak : 0;

    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPct = drawdownPct;
      resultPeakIndex = peakIndex;
      troughIndex = i;
    }
  }

  return {
    maxDrawdown,
    maxDrawdownPct,
    peakIndex: resultPeakIndex,
    troughIndex,
  };
}

/**
 * Calculate Herfindahl concentration index
 */
export function calculateConcentration(weights: number[]): number {
  const total = weights.reduce((a, b) => a + Math.abs(b), 0);
  if (total === 0) return 0;

  return weights.reduce((sum, w) => {
    const normalized = Math.abs(w) / total;
    return sum + normalized * normalized;
  }, 0);
}
