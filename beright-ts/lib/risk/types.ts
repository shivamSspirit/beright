/**
 * Risk Module Types
 *
 * Types for correlation analysis, drawdown control, and advanced risk metrics.
 *
 * @author BeRight Protocol
 * @version 3.0.0 - Bloomberg Terminal Architecture
 */

// =============================================================================
// CORRELATION TYPES
// =============================================================================

/**
 * Correlation pair between two markets
 */
export interface CorrelationPair {
  marketA: string;
  marketB: string;
  correlation: number;           // -1 to 1
  confidence: number;            // 0 to 1 (based on sample size)
  sampleSize: number;
  lastUpdated: Date;
}

/**
 * Correlation category
 */
export type CorrelationCategory =
  | 'same_event'                 // Same event, different platform
  | 'related_event'              // Related events (e.g., Fed rate + inflation)
  | 'same_category'              // Same category (politics, crypto, etc.)
  | 'temporal'                   // Similar timeframes
  | 'unknown';

/**
 * Correlation matrix for portfolio
 */
export interface CorrelationMatrix {
  marketIds: string[];
  matrix: number[][];            // Correlation coefficients
  averageCorrelation: number;
  maxCorrelation: number;
  highlyCorrelatedPairs: CorrelationPair[];
  generatedAt: Date;
}

// =============================================================================
// DRAWDOWN TYPES
// =============================================================================

/**
 * Drawdown event
 */
export interface DrawdownEvent {
  id: string;
  startDate: Date;
  endDate?: Date;
  peakValue: number;
  troughValue: number;
  drawdownAmt: number;
  drawdownPct: number;
  durationDays: number;
  recovered: boolean;
  recoveryDate?: Date;
  recoveryDays?: number;
}

/**
 * Drawdown analysis
 */
export interface DrawdownAnalysis {
  currentDrawdown: number;
  currentDrawdownPct: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  maxDrawdownDate: Date;
  averageDrawdown: number;
  averageRecoveryDays: number;
  currentInDrawdown: boolean;
  daysInCurrentDrawdown: number;
  drawdownHistory: DrawdownEvent[];
}

// =============================================================================
// RISK METRICS
// =============================================================================

/**
 * Value at Risk (VaR) calculation
 */
export interface VaRResult {
  var95: number;                 // 95% VaR (1 in 20 days worse)
  var99: number;                 // 99% VaR (1 in 100 days worse)
  cvar95: number;                // Conditional VaR (expected loss when VaR breached)
  method: 'historical' | 'parametric' | 'monte_carlo';
  confidenceLevel: number;
  timeHorizon: '1d' | '1w' | '1m';
  calculatedAt: Date;
}

/**
 * Portfolio risk summary
 */
export interface PortfolioRiskSummary {
  // Exposure
  totalExposure: number;
  exposurePct: number;

  // Concentration
  herfindahlIndex: number;       // 0-1, higher = more concentrated
  largestPosition: number;
  largestPositionPct: number;

  // Correlation
  averageCorrelation: number;
  effectiveDiversification: number;  // 1 = fully diversified

  // Value at Risk
  var: VaRResult;

  // Drawdown
  drawdown: DrawdownAnalysis;

  // Risk score
  overallRiskScore: number;      // 0-100, higher = riskier
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

// =============================================================================
// LIMIT TYPES
// =============================================================================

/**
 * Dynamic limit adjustment
 */
export interface DynamicLimitAdjustment {
  originalLimit: number;
  adjustedLimit: number;
  adjustmentFactor: number;
  reason: string;
  triggers: string[];
}

/**
 * Limit breach record
 */
export interface LimitBreach {
  id: string;
  limitType: string;
  limitValue: number;
  actualValue: number;
  breachPct: number;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  action?: string;
}
