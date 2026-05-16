/**
 * EV Calculator Types
 *
 * Type definitions for the Expected Value calculation system.
 * Accounts for slippage, fees, gas, bridge costs, and execution risk.
 *
 * @author BeRight Protocol
 */

import { DataPlatform } from '../data/types';

// =============================================================================
// MARKET & TRADE TYPES
// =============================================================================

/**
 * Platform-specific market data for EV calculation
 */
export interface PlatformMarketData {
  platform: DataPlatform;
  yesPrice: number;              // 0-1
  noPrice: number;               // 0-1
  volume24h: number;             // USD
  liquidity: number;             // USD available
  orderBook?: OrderBookSnapshot; // If available
  url: string;
}

/**
 * Order book snapshot (if platform provides)
 */
export interface OrderBookSnapshot {
  bids: Array<{ price: number; size: number }>;  // YES bids
  asks: Array<{ price: number; size: number }>;  // YES asks
  timestamp: Date;
}

/**
 * Trade parameters
 */
export interface TradeParams {
  side: 'YES' | 'NO';
  amount: number;                // USD amount to trade
  inputToken: 'USDC' | 'SOL' | 'ETH';
  originChain: ChainType;
}

/**
 * Supported chains
 */
export type ChainType = 'solana' | 'polygon' | 'base' | 'ethereum' | 'offchain';

// =============================================================================
// COST BREAKDOWN TYPES
// =============================================================================

/**
 * Slippage cost breakdown
 */
export interface SlippageCost {
  estimatedPct: number;          // Expected slippage %
  worstCasePct: number;          // 95th percentile
  usdAmount: number;             // Slippage in USD
  model: 'orderbook' | 'amm' | 'historical' | 'estimated';
}

/**
 * Platform fee breakdown
 */
export interface PlatformFeeCost {
  platform: string;
  baseFee: number;               // Base fee %
  volumeDiscount: number;        // Discount based on volume
  effectiveFee: number;          // Final fee %
  usdAmount: number;
}

/**
 * Gas fee breakdown
 */
export interface GasFeeCost {
  chain: string;
  estimatedGwei?: number;
  usdAmount: number;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Bridge fee breakdown
 */
export interface BridgeFeeCost {
  required: boolean;
  fromChain?: string;
  toChain?: string;
  estimatedUsd: number;
  estimatedTimeSeconds: number;
  provider?: string;
}

// =============================================================================
// EV RESULT TYPES
// =============================================================================

/**
 * EV calculation result
 */
export interface EVResult {
  // Core metrics
  rawOdds: number;               // Quoted price (0-1)
  effectiveOdds: number;         // After all costs (0-1)
  expectedPayout: number;        // If win: amount * (1/effectiveOdds)
  expectedValue: number;         // expectedPayout * winProb - amount

  // Cost breakdown
  costs: {
    slippage: SlippageCost;
    platformFee: PlatformFeeCost;
    gasFee: GasFeeCost;
    bridgeFee: BridgeFeeCost;
    totalCostUsd: number;
    totalCostPct: number;        // As % of trade amount
  };

  // Risk metrics
  risk: {
    executionProbability: number;  // 0-1: likelihood of successful fill
    partialFillRisk: number;       // 0-1: risk of partial fill
    slippageVolatility: number;    // Expected slippage variance
    liquidityScore: number;        // 0-100: depth rating
  };

  // Recommendations
  recommendation: {
    optimalAmount: number;         // Amount that maximizes EV
    maxAmount: number;             // Max before excessive slippage
    shouldExecute: boolean;        // Is this trade worth it?
    reasoning: string;
  };

  // Metadata
  calculatedAt: Date;
  latencyMs: number;
}

/**
 * Cross-platform arbitrage analysis
 */
export interface ArbitrageEVResult {
  // Basic arb metrics
  buyPlatform: string;
  sellPlatform: string;
  rawSpread: number;             // Raw price difference
  effectiveSpread: number;       // After all costs

  // Per-leg analysis
  buyLeg: EVResult;
  sellLeg: EVResult;

  // Combined analysis
  netProfit: number;             // USD profit after all costs
  netProfitPct: number;          // As % of capital required
  capitalRequired: number;       // Total capital needed
  roi: number;                   // Return on capital

  // Risk-adjusted metrics
  sharpeProxy: number;           // profit / volatility
  kellyFraction: number;         // Optimal bet sizing

  // Execution plan
  executionPlan: {
    step1: string;
    step2: string;
    estimatedTimeSeconds: number;
    risks: string[];
  };

  // Verdict
  isViable: boolean;
  confidenceLevel: 'high' | 'medium' | 'low';
  reasoning: string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * EV Calculator configuration
 */
export interface EVConfig {
  // Slippage model
  defaultSlippageModel: 'conservative' | 'moderate' | 'aggressive';
  slippageMultiplier: number;    // Safety factor (default: 1.5)

  // Fee overrides (if different from defaults)
  platformFees?: Record<string, number>;

  // Gas settings
  gasBuffer: number;             // Buffer multiplier (default: 1.2)
  maxAcceptableGas: number;      // Max gas in USD

  // Risk thresholds
  minExecutionProbability: number;  // Min to recommend (default: 0.95)
  maxSlippagePct: number;           // Max acceptable (default: 5%)
  minNetProfit: number;             // Min profit USD (default: 1)
  minNetProfitPct: number;          // Min profit % (default: 0.5%)
}

/**
 * Default EV configuration
 */
export const DEFAULT_EV_CONFIG: EVConfig = {
  defaultSlippageModel: 'moderate',
  slippageMultiplier: 1.5,

  gasBuffer: 1.2,
  maxAcceptableGas: 5,

  minExecutionProbability: 0.95,
  maxSlippagePct: 5,
  minNetProfit: 1,
  minNetProfitPct: 0.5,
};

// =============================================================================
// LIQUIDITY ANALYSIS
// =============================================================================

/**
 * Liquidity analysis result
 */
export interface LiquidityAnalysis {
  score: number;               // 0-100
  maxSafeAmount: number;       // Max trade before excessive slippage
  depth: 'deep' | 'moderate' | 'thin' | 'very_thin';
  warnings: string[];
}

// =============================================================================
// EXECUTION RISK
// =============================================================================

/**
 * Execution risk assessment
 */
export interface ExecutionRisk {
  probability: number;         // 0-1: probability of successful execution
  partialFillRisk: number;     // 0-1: risk of partial fill
  failureReasons: string[];
}
