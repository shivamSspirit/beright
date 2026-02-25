/**
 * Trading System Types for BeRight Protocol
 *
 * Comprehensive type definitions for:
 * - Paper & Live Trading
 * - Strategy Framework
 * - Risk Management
 * - Order Routing
 * - Performance Tracking
 */

import { Platform } from './market';

// ============================================
// CORE TRADING TYPES
// ============================================

export type TradingMode = 'paper' | 'live';
export type TradeStatus = 'pending' | 'open' | 'filled' | 'partial' | 'cancelled' | 'rejected' | 'closed';
export type TradeDirection = 'YES' | 'NO';
export type OrderType = 'market' | 'limit' | 'stop_loss' | 'take_profit';
export type StrategyType = 'arbitrage' | 'information_speed' | 'mean_reversion' | 'resolution_timing' | 'consensus_flip' | 'manual';

// ============================================
// TRADE TYPES
// ============================================

export interface Trade {
  id: string;
  userId: string;
  mode: TradingMode;

  // Market info
  platform: Platform | string;
  marketId: string;
  marketTicker: string;
  marketTitle: string;
  category: string;

  // Trade details
  direction: TradeDirection;
  orderType: OrderType;
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  quantityFilled: number;

  // USD values
  entryValueUsd: number;
  exitValueUsd: number | null;

  // P&L
  unrealizedPnl: number;
  realizedPnl: number | null;
  pnlPercent: number | null;
  fees: number;

  // Strategy
  strategy: StrategyType;
  signalId: string | null;
  signalConfidence: number | null;

  // Risk management
  stopLossPrice: number | null;
  takeProfitPrice: number | null;
  maxLossUsd: number | null;

  // Timestamps
  createdAt: Date;
  filledAt: Date | null;
  closedAt: Date | null;
  expiresAt: Date | null;

  // Status
  status: TradeStatus;
  closeReason: 'take_profit' | 'stop_loss' | 'manual' | 'expiry' | 'liquidation' | null;

  // Execution details
  executionLatencyMs: number | null;
  slippage: number | null;
  orderId: string | null;
  txSignature: string | null;
}

export interface TradeInput {
  userId: string;
  mode: TradingMode;
  platform: Platform | string;
  marketId: string;
  marketTicker: string;
  marketTitle: string;
  category?: string;
  direction: TradeDirection;
  orderType?: OrderType;
  entryPrice: number;
  quantity: number;
  entryValueUsd?: number;
  strategy?: StrategyType;
  signalId?: string;
  signalConfidence?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  maxLossUsd?: number;
  expiresAt?: Date;
}

// ============================================
// POSITION TYPES
// ============================================

export interface Position {
  id: string;
  tradeId: string;
  userId: string;
  mode: TradingMode;

  // Market
  platform: Platform | string;
  marketId: string;
  marketTicker: string;
  marketTitle: string;
  category: string;

  // Position details
  direction: TradeDirection;
  quantity: number;
  avgEntryPrice: number;
  currentPrice: number;

  // Value
  costBasis: number;
  currentValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;

  // Risk
  stopLossPrice: number | null;
  takeProfitPrice: number | null;
  riskScore: number; // 0-100

  // Time
  openedAt: Date;
  expiresAt: Date | null;
  daysToExpiry: number | null;

  // Status
  isOpen: boolean;
}

// ============================================
// PORTFOLIO TYPES
// ============================================

export interface VirtualPortfolio {
  id: string;
  userId: string;
  mode: TradingMode;

  // Balances
  initialBalance: number;
  cashBalance: number;
  portfolioValue: number;
  totalValue: number;

  // Performance
  totalPnl: number;
  totalPnlPercent: number;
  realizedPnl: number;
  unrealizedPnl: number;

  // Stats
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number; // gross profits / gross losses

  // Risk metrics
  sharpeRatio: number | null;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  currentDrawdown: number;

  // Positions
  openPositions: Position[];
  positionCount: number;

  // Time
  createdAt: Date;
  updatedAt: Date;
  lastTradeAt: Date | null;
}

// ============================================
// STRATEGY TYPES
// ============================================

export interface StrategyConfig {
  type: StrategyType;
  name: string;
  description: string;
  enabled: boolean;

  // Entry criteria
  minConfidence: number;
  minEdge: number;
  maxEntryPrice: number;
  minLiquidity: number;

  // Risk parameters
  maxPositionPct: number;
  stopLossPct: number;
  takeProfitPct: number;
  maxCorrelation: number;

  // Limits
  maxDailyTrades: number;
  maxOpenPositions: number;
  maxCategoryExposure: number;

  // Strategy-specific
  customParams: Record<string, unknown>;
}

export interface StrategySignal {
  id: string;
  strategyType: StrategyType;
  timestamp: Date;

  // Market
  platform: Platform | string;
  marketId: string;
  marketTicker: string;
  marketTitle: string;
  category: string;

  // Signal details
  direction: TradeDirection;
  confidence: number; // 0-100
  edge: number; // Expected profit margin
  currentPrice: number;
  targetPrice: number;

  // Reasoning
  reasoning: string;
  factors: SignalFactor[];

  // Recommendation
  recommendedAction: 'buy' | 'sell' | 'hold' | 'skip';
  recommendedSize: number;
  urgency: 'immediate' | 'soon' | 'optional';

  // Validity
  expiresAt: Date;
  isExpired: boolean;
}

export interface SignalFactor {
  name: string;
  value: number;
  weight: number;
  contribution: number;
  description: string;
}

// ============================================
// RISK MANAGEMENT TYPES
// ============================================

export interface RiskConfig {
  // Position limits
  maxPositionSizeUsd: number;
  maxPositionSizePct: number;
  maxTotalExposureUsd: number;
  maxTotalExposurePct: number;

  // Category limits
  maxCategoryExposurePct: number;
  maxCorrelatedPositions: number;

  // Loss limits
  maxDailyLossUsd: number;
  maxDailyLossPct: number;
  maxWeeklyLossPct: number;
  maxDrawdownPct: number;

  // Stop loss / take profit
  defaultStopLossPct: number;
  defaultTakeProfitPct: number;
  trailingStopEnabled: boolean;
  trailingStopPct: number;

  // Circuit breakers
  circuitBreakerEnabled: boolean;
  circuitBreakerLossPct: number;
  circuitBreakerCooldownMinutes: number;

  // Performance gates
  minBrierScoreToTrade: number;
  minWinRateToTrade: number;
}

export interface RiskAssessment {
  canTrade: boolean;
  reasons: string[];

  // Limits
  maxAllowedSize: number;
  adjustedSize: number;

  // Risk metrics
  positionRisk: number;
  portfolioRisk: number;
  correlationRisk: number;
  concentrationRisk: number;

  // Warnings
  warnings: RiskWarning[];
}

export interface RiskWarning {
  level: 'info' | 'warning' | 'critical';
  type: 'position_size' | 'exposure' | 'correlation' | 'drawdown' | 'loss_limit' | 'circuit_breaker';
  message: string;
}

// ============================================
// ORDER ROUTING TYPES
// ============================================

export interface OrderRequest {
  userId: string;
  mode: TradingMode;

  // Market
  platform?: Platform | string; // Optional - router will select best
  marketId: string;
  marketTicker: string;

  // Order
  direction: TradeDirection;
  orderType: OrderType;
  quantity: number;
  limitPrice?: number;

  // Risk
  stopLossPrice?: number;
  takeProfitPrice?: number;
  maxSlippagePct?: number;

  // Strategy
  strategy: StrategyType;
  signalId?: string;
}

export interface OrderResult {
  success: boolean;
  trade: Trade | null;
  error: string | null;

  // Execution details
  executedPrice: number | null;
  executedQuantity: number | null;
  slippage: number | null;
  fees: number | null;
  latencyMs: number;

  // Platform response
  orderId: string | null;
  txSignature: string | null;
  rawResponse?: unknown;
}

export interface PlatformQuote {
  platform: Platform | string;
  marketId: string;
  direction: TradeDirection;

  // Prices
  bestBid: number;
  bestAsk: number;
  midPrice: number;
  spread: number;

  // Liquidity
  availableQuantity: number;
  estimatedSlippage: number;

  // Costs
  estimatedFee: number;
  totalCost: number;

  // Quality
  score: number; // 0-100, higher = better execution
}

// ============================================
// PERFORMANCE TYPES
// ============================================

export interface StrategyPerformance {
  strategy: StrategyType;
  mode: TradingMode;
  period: 'daily' | 'weekly' | 'monthly' | 'all_time';

  // Trade stats
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;

  // P&L
  totalPnl: number;
  avgPnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;

  // Risk-adjusted
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  maxDrawdown: number;
  calmarRatio: number | null;

  // Execution
  avgSlippage: number;
  avgLatencyMs: number;

  // Time
  startDate: Date;
  endDate: Date;
}

export interface DailyPerformance {
  date: string; // YYYY-MM-DD
  mode: TradingMode;

  // P&L
  startingBalance: number;
  endingBalance: number;
  dayPnl: number;
  dayPnlPercent: number;

  // Trades
  tradesExecuted: number;
  tradesWon: number;
  tradesLost: number;

  // By strategy
  pnlByStrategy: Record<StrategyType, number>;

  // Risk
  maxDrawdownToday: number;
  peakBalance: number;
}

// ============================================
// TRADING SETTINGS
// ============================================

export interface TradingSettings {
  userId: string;

  // Mode
  mode: TradingMode;
  autoExecute: boolean;

  // Strategies
  enabledStrategies: StrategyType[];
  strategyConfigs: Partial<Record<StrategyType, Partial<StrategyConfig>>>;

  // Risk
  riskConfig: RiskConfig;

  // Portfolio
  initialBalance: number;

  // Notifications
  notifyOnTrade: boolean;
  notifyOnAlert: boolean;
  telegramChatId: number | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// DEFAULT CONFIGURATIONS
// ============================================

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  maxPositionSizeUsd: 100,
  maxPositionSizePct: 0.05,
  maxTotalExposureUsd: 1000,
  maxTotalExposurePct: 0.80,

  maxCategoryExposurePct: 0.30,
  maxCorrelatedPositions: 3,

  maxDailyLossUsd: 50,
  maxDailyLossPct: 0.03,
  maxWeeklyLossPct: 0.10,
  maxDrawdownPct: 0.20,

  defaultStopLossPct: 0.20,
  defaultTakeProfitPct: 0.30,
  trailingStopEnabled: false,
  trailingStopPct: 0.10,

  circuitBreakerEnabled: true,
  circuitBreakerLossPct: 0.05,
  circuitBreakerCooldownMinutes: 60,

  minBrierScoreToTrade: 0.35,
  minWinRateToTrade: 0.40,
};

export const DEFAULT_STRATEGY_CONFIGS: Record<StrategyType, StrategyConfig> = {
  arbitrage: {
    type: 'arbitrage',
    name: 'Cross-Platform Arbitrage',
    description: 'Exploit price differences between platforms for risk-free profit',
    enabled: true,
    minConfidence: 85,
    minEdge: 0.02,
    maxEntryPrice: 0.95,
    minLiquidity: 1000,
    maxPositionPct: 0.10,
    stopLossPct: 0.05,
    takeProfitPct: 0.05,
    maxCorrelation: 0.50,
    maxDailyTrades: 20,
    maxOpenPositions: 5,
    maxCategoryExposure: 0.50,
    customParams: {
      minSpreadPct: 0.03,
      maxExecutionDelayMs: 5000,
    },
  },
  information_speed: {
    type: 'information_speed',
    name: 'Information Speed',
    description: 'Act on news and events before markets fully price them in',
    enabled: true,
    minConfidence: 70,
    minEdge: 0.05,
    maxEntryPrice: 0.90,
    minLiquidity: 500,
    maxPositionPct: 0.08,
    stopLossPct: 0.15,
    takeProfitPct: 0.25,
    maxCorrelation: 0.60,
    maxDailyTrades: 10,
    maxOpenPositions: 5,
    maxCategoryExposure: 0.40,
    customParams: {
      newsSourceTiers: [1, 2],
      maxAgeMinutes: 30,
    },
  },
  mean_reversion: {
    type: 'mean_reversion',
    name: 'Mean Reversion',
    description: 'Bet against extreme price movements expecting return to fair value',
    enabled: true,
    minConfidence: 65,
    minEdge: 0.03,
    maxEntryPrice: 0.95,
    minLiquidity: 500,
    maxPositionPct: 0.06,
    stopLossPct: 0.25,
    takeProfitPct: 0.15,
    maxCorrelation: 0.50,
    maxDailyTrades: 8,
    maxOpenPositions: 4,
    maxCategoryExposure: 0.35,
    customParams: {
      minPriceDeviation: 0.15,
      lookbackPeriodHours: 24,
    },
  },
  resolution_timing: {
    type: 'resolution_timing',
    name: 'Resolution Timing',
    description: 'Exploit time decay and resolution dynamics near market close',
    enabled: true,
    minConfidence: 75,
    minEdge: 0.02,
    maxEntryPrice: 0.98,
    minLiquidity: 200,
    maxPositionPct: 0.05,
    stopLossPct: 0.10,
    takeProfitPct: 0.10,
    maxCorrelation: 0.40,
    maxDailyTrades: 15,
    maxOpenPositions: 6,
    maxCategoryExposure: 0.40,
    customParams: {
      maxDaysToExpiry: 7,
      minDaysToExpiry: 0.1,
    },
  },
  consensus_flip: {
    type: 'consensus_flip',
    name: 'Consensus Flip',
    description: 'Follow smart money when market consensus dramatically reverses',
    enabled: true,
    minConfidence: 80,
    minEdge: 0.08,
    maxEntryPrice: 0.85,
    minLiquidity: 1000,
    maxPositionPct: 0.07,
    stopLossPct: 0.20,
    takeProfitPct: 0.35,
    maxCorrelation: 0.70,
    maxDailyTrades: 5,
    maxOpenPositions: 3,
    maxCategoryExposure: 0.30,
    customParams: {
      minFlipMagnitude: 0.10,
      confirmationPeriodMinutes: 60,
    },
  },
  manual: {
    type: 'manual',
    name: 'Manual Trading',
    description: 'User-initiated trades',
    enabled: true,
    minConfidence: 0,
    minEdge: 0,
    maxEntryPrice: 1.0,
    minLiquidity: 0,
    maxPositionPct: 0.15,
    stopLossPct: 0.25,
    takeProfitPct: 0.50,
    maxCorrelation: 1.0,
    maxDailyTrades: 50,
    maxOpenPositions: 20,
    maxCategoryExposure: 0.50,
    customParams: {},
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export function inferCategory(text: string): string {
  const lower = text.toLowerCase();

  if (lower.match(/bitcoin|btc|ethereum|eth|crypto|solana|sol|defi|token/)) return 'crypto';
  if (lower.match(/president|election|congress|senate|vote|trump|biden|democrat|republican|governor/)) return 'politics';
  if (lower.match(/fed|inflation|gdp|unemployment|recession|economy|rates|cpi|fomc|treasury/)) return 'economics';
  if (lower.match(/nfl|nba|mlb|nhl|championship|playoff|super bowl|world cup|soccer|football|basketball/)) return 'sports';
  if (lower.match(/ai|openai|chatgpt|google|apple|microsoft|nvidia|tech|ipo|startup/)) return 'tech';
  if (lower.match(/climate|weather|hurricane|earthquake|temperature|carbon/)) return 'climate';
  if (lower.match(/war|military|conflict|ukraine|russia|china|taiwan|nato|sanctions/)) return 'geopolitics';

  return 'general';
}

export function calculateKellySize(
  edge: number,
  winProbability: number,
  fractionMultiplier: number = 0.5 // Half Kelly is safer
): number {
  // Kelly Criterion: f* = (bp - q) / b
  // where b = odds, p = win prob, q = lose prob
  // Simplified for binary outcomes:
  const optimalFraction = (edge * winProbability - (1 - winProbability)) / edge;

  // Apply fraction multiplier (half Kelly is common)
  const adjustedFraction = Math.max(0, optimalFraction * fractionMultiplier);

  // Cap at reasonable maximum
  return Math.min(adjustedFraction, 0.25);
}
