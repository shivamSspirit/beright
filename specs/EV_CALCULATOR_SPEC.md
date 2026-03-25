# Expected Value (EV) Calculator Specification

## Overview

Build an EV-aware execution analysis layer that calculates the true expected value of trades across platforms, accounting for slippage, fees, liquidity depth, and execution risk.

**Author**: BeRight Engineering
**Status**: Draft
**Priority**: Medium
**Estimated Effort**: 2 weeks

---

## Problem Statement

Current arbitrage detection (`lib/ml/marketMatcher.ts`) calculates:
```typescript
spread = sell.yesPrice - buy.yesPrice
netProfit = spread - (buyFee + sellFee)
```

**Limitations:**
1. Assumes full order fills at quoted price (ignores slippage)
2. Uses static fee estimates (doesn't account for tier/volume discounts)
3. Ignores order book depth (a $10K order may move price significantly)
4. No gas/bridge cost consideration
5. No execution probability (what if order fails?)
6. Users see "3% arb" but realize 0.5% after execution

---

## Solution

Add an EV Calculator that computes **Effective Odds** - the true expected return accounting for all execution costs.

```
CURRENT:
Raw Odds ──► Show to User

PROPOSED:
Raw Odds ──► EV Calculator ──► Effective Odds ──► Show to User
                   │
                   ├── Slippage Model
                   ├── Fee Calculator
                   ├── Liquidity Analyzer
                   ├── Gas Estimator
                   └── Execution Risk Model
```

---

## Architecture

### File Structure

```
beright-ts/lib/ev/
├── index.ts                  # Main EV calculator entry point
├── types.ts                  # Type definitions
├── slippage.ts               # Slippage estimation models
├── fees.ts                   # Platform fee calculator
├── liquidity.ts              # Order book depth analysis
├── gas.ts                    # Gas/bridge cost estimator
├── execution.ts              # Execution probability model
└── __tests__/
    └── ev.test.ts
```

### Integration Points

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Data Fabric                                                            │
│       │                                                                 │
│       ▼                                                                 │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐              │
│  │ Market      │────►│ EV          │────►│ ML Match    │              │
│  │ Matcher     │     │ Calculator  │     │ Result      │              │
│  └─────────────┘     └─────────────┘     └─────────────┘              │
│                             │                                           │
│                             ▼                                           │
│                      ┌─────────────┐                                   │
│                      │ Enriched    │                                   │
│                      │ Response    │                                   │
│                      │ - rawOdds   │                                   │
│                      │ - effectiveOdds                                 │
│                      │ - slippageImpact                                │
│                      │ - netEV                                         │
│                      └─────────────┘                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Type Definitions

### File: `lib/ev/types.ts`

```typescript
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
  originChain: 'solana' | 'polygon' | 'base' | 'ethereum';
}

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
```

---

## Core EV Calculator

### File: `lib/ev/index.ts`

```typescript
import {
  EVResult,
  ArbitrageEVResult,
  EVConfig,
  DEFAULT_EV_CONFIG,
  PlatformMarketData,
  TradeParams,
} from './types';
import { estimateSlippage } from './slippage';
import { calculatePlatformFee } from './fees';
import { estimateGasFee, estimateBridgeFee } from './gas';
import { assessExecutionRisk } from './execution';
import { analyzeLiquidity } from './liquidity';

/**
 * Main EV Calculator class
 */
export class EVCalculator {
  private config: EVConfig;

  constructor(config: Partial<EVConfig> = {}) {
    this.config = { ...DEFAULT_EV_CONFIG, ...config };
  }

  /**
   * Calculate EV for a single trade
   */
  async calculateTradeEV(
    market: PlatformMarketData,
    trade: TradeParams
  ): Promise<EVResult> {
    const startTime = Date.now();

    // 1. Get raw odds
    const rawOdds = trade.side === 'YES' ? market.yesPrice : market.noPrice;

    // 2. Estimate slippage
    const slippage = await estimateSlippage(market, trade, this.config);

    // 3. Calculate platform fee
    const platformFee = calculatePlatformFee(market.platform, trade.amount);

    // 4. Estimate gas fee
    const gasFee = await estimateGasFee(market.platform, trade.originChain);

    // 5. Check if bridge needed
    const bridgeFee = await estimateBridgeFee(trade.originChain, market.platform);

    // 6. Calculate total costs
    const totalCostUsd =
      slippage.usdAmount +
      platformFee.usdAmount +
      gasFee.usdAmount +
      bridgeFee.estimatedUsd;

    const totalCostPct = (totalCostUsd / trade.amount) * 100;

    // 7. Calculate effective odds
    // effectiveOdds = rawOdds + (totalCost / amount)
    // Higher effective odds = worse deal (you're paying more per share)
    const effectiveOdds = rawOdds + (totalCostUsd / trade.amount);

    // 8. Calculate expected value
    // If you win: you get (1 / effectiveOdds) per dollar
    // Expected payout = amount * (1 / effectiveOdds) if win
    const expectedPayout = trade.amount / effectiveOdds;

    // EV = (winProb * payout) - amount
    // Using raw market odds as win probability proxy
    const winProbability = rawOdds; // Market's implied probability
    const expectedValue = (winProbability * expectedPayout) - trade.amount;

    // 9. Assess execution risk
    const liquidityAnalysis = analyzeLiquidity(market, trade.amount);
    const executionRisk = assessExecutionRisk(market, trade, slippage);

    // 10. Generate recommendation
    const recommendation = this.generateRecommendation(
      trade.amount,
      totalCostPct,
      liquidityAnalysis,
      executionRisk
    );

    return {
      rawOdds,
      effectiveOdds: Math.min(effectiveOdds, 1), // Cap at 1
      expectedPayout,
      expectedValue,

      costs: {
        slippage,
        platformFee,
        gasFee,
        bridgeFee,
        totalCostUsd,
        totalCostPct,
      },

      risk: {
        executionProbability: executionRisk.probability,
        partialFillRisk: executionRisk.partialFillRisk,
        slippageVolatility: slippage.worstCasePct - slippage.estimatedPct,
        liquidityScore: liquidityAnalysis.score,
      },

      recommendation,

      calculatedAt: new Date(),
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Calculate EV for arbitrage opportunity
   */
  async calculateArbitrageEV(
    buyMarket: PlatformMarketData,
    sellMarket: PlatformMarketData,
    amount: number,
    originChain: 'solana' | 'polygon' | 'base' | 'ethereum' = 'solana'
  ): Promise<ArbitrageEVResult> {
    // Calculate EV for each leg
    const [buyLeg, sellLeg] = await Promise.all([
      this.calculateTradeEV(buyMarket, {
        side: 'YES',
        amount,
        inputToken: 'USDC',
        originChain,
      }),
      this.calculateTradeEV(sellMarket, {
        side: 'YES', // Selling YES = buying NO equivalent
        amount,
        inputToken: 'USDC',
        originChain,
      }),
    ]);

    // Raw spread (before costs)
    const rawSpread = sellMarket.yesPrice - buyMarket.yesPrice;

    // Effective spread (after costs)
    const effectiveSpread =
      (1 - sellLeg.effectiveOdds) - buyLeg.effectiveOdds;

    // Net profit
    const totalCosts = buyLeg.costs.totalCostUsd + sellLeg.costs.totalCostUsd;
    const netProfit = (rawSpread * amount) - totalCosts;
    const netProfitPct = (netProfit / amount) * 100;

    // Capital required (need to fund both legs)
    const capitalRequired = amount * 2; // Simplified; could be optimized

    // ROI
    const roi = (netProfit / capitalRequired) * 100;

    // Risk-adjusted metrics
    const avgVolatility = (buyLeg.risk.slippageVolatility + sellLeg.risk.slippageVolatility) / 2;
    const sharpeProxy = avgVolatility > 0 ? netProfitPct / avgVolatility : 0;

    // Kelly criterion (simplified)
    const winProb = Math.min(buyLeg.risk.executionProbability, sellLeg.risk.executionProbability);
    const kellyFraction = winProb - ((1 - winProb) / (netProfitPct / 100 + 1));

    // Execution plan
    const executionPlan = this.buildExecutionPlan(buyMarket, sellMarket, originChain);

    // Viability assessment
    const isViable =
      netProfit > this.config.minNetProfit &&
      netProfitPct > this.config.minNetProfitPct &&
      winProb > this.config.minExecutionProbability &&
      buyLeg.costs.slippage.estimatedPct < this.config.maxSlippagePct &&
      sellLeg.costs.slippage.estimatedPct < this.config.maxSlippagePct;

    const confidenceLevel = this.assessConfidence(buyLeg, sellLeg, netProfitPct);

    return {
      buyPlatform: buyMarket.platform,
      sellPlatform: sellMarket.platform,
      rawSpread,
      effectiveSpread,

      buyLeg,
      sellLeg,

      netProfit,
      netProfitPct,
      capitalRequired,
      roi,

      sharpeProxy,
      kellyFraction: Math.max(0, Math.min(kellyFraction, 0.25)), // Cap at 25%

      executionPlan,

      isViable,
      confidenceLevel,
      reasoning: this.generateArbReasoning(isViable, netProfitPct, winProb, confidenceLevel),
    };
  }

  /**
   * Find optimal trade amount that maximizes EV
   */
  async findOptimalAmount(
    market: PlatformMarketData,
    trade: Omit<TradeParams, 'amount'>,
    maxAmount: number = 10000
  ): Promise<{ optimalAmount: number; maxEV: number; curve: Array<{ amount: number; ev: number }> }> {
    const testAmounts = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000].filter(a => a <= maxAmount);
    const curve: Array<{ amount: number; ev: number; effectiveOdds: number }> = [];

    for (const amount of testAmounts) {
      const result = await this.calculateTradeEV(market, { ...trade, amount });
      curve.push({
        amount,
        ev: result.expectedValue,
        effectiveOdds: result.effectiveOdds,
      });
    }

    // Find optimal (highest EV that's still positive)
    const positiveEV = curve.filter(c => c.ev > 0);
    if (positiveEV.length === 0) {
      return { optimalAmount: 0, maxEV: 0, curve };
    }

    const optimal = positiveEV.reduce((best, curr) =>
      curr.ev > best.ev ? curr : best
    );

    return {
      optimalAmount: optimal.amount,
      maxEV: optimal.ev,
      curve,
    };
  }

  /**
   * Generate trade recommendation
   */
  private generateRecommendation(
    amount: number,
    totalCostPct: number,
    liquidity: { score: number; maxSafeAmount: number },
    execution: { probability: number; partialFillRisk: number }
  ): EVResult['recommendation'] {
    const shouldExecute =
      totalCostPct < this.config.maxSlippagePct &&
      execution.probability > this.config.minExecutionProbability &&
      liquidity.score > 50;

    let reasoning: string;
    if (!shouldExecute) {
      if (totalCostPct >= this.config.maxSlippagePct) {
        reasoning = `Total costs (${totalCostPct.toFixed(2)}%) exceed max threshold (${this.config.maxSlippagePct}%)`;
      } else if (execution.probability <= this.config.minExecutionProbability) {
        reasoning = `Execution probability (${(execution.probability * 100).toFixed(1)}%) below minimum`;
      } else {
        reasoning = `Liquidity score (${liquidity.score}) indicates insufficient depth`;
      }
    } else {
      reasoning = `Trade viable with ${totalCostPct.toFixed(2)}% total costs`;
    }

    return {
      optimalAmount: Math.min(amount, liquidity.maxSafeAmount),
      maxAmount: liquidity.maxSafeAmount,
      shouldExecute,
      reasoning,
    };
  }

  /**
   * Build execution plan for arbitrage
   */
  private buildExecutionPlan(
    buyMarket: PlatformMarketData,
    sellMarket: PlatformMarketData,
    originChain: string
  ): ArbitrageEVResult['executionPlan'] {
    const buyChain = this.getPlatformChain(buyMarket.platform);
    const sellChain = this.getPlatformChain(sellMarket.platform);

    const needsBridge = originChain !== buyChain || originChain !== sellChain;

    let estimatedTime = 30; // Base: 30 seconds for single chain
    if (needsBridge) {
      estimatedTime += 120; // Add 2 minutes per bridge
    }

    const risks: string[] = [];
    if (needsBridge) {
      risks.push('Cross-chain bridge delay risk');
    }
    if (buyMarket.liquidity < 10000) {
      risks.push('Low buy-side liquidity');
    }
    if (sellMarket.liquidity < 10000) {
      risks.push('Low sell-side liquidity');
    }

    return {
      step1: `Buy YES on ${buyMarket.platform} at ${(buyMarket.yesPrice * 100).toFixed(1)}%`,
      step2: `Sell YES on ${sellMarket.platform} at ${(sellMarket.yesPrice * 100).toFixed(1)}%`,
      estimatedTimeSeconds: estimatedTime,
      risks,
    };
  }

  /**
   * Assess confidence level
   */
  private assessConfidence(
    buyLeg: EVResult,
    sellLeg: EVResult,
    netProfitPct: number
  ): 'high' | 'medium' | 'low' {
    const avgLiquidityScore = (buyLeg.risk.liquidityScore + sellLeg.risk.liquidityScore) / 2;
    const avgExecProb = (buyLeg.risk.executionProbability + sellLeg.risk.executionProbability) / 2;

    if (avgLiquidityScore > 80 && avgExecProb > 0.98 && netProfitPct > 2) {
      return 'high';
    }
    if (avgLiquidityScore > 50 && avgExecProb > 0.90 && netProfitPct > 1) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Generate arbitrage reasoning
   */
  private generateArbReasoning(
    isViable: boolean,
    netProfitPct: number,
    winProb: number,
    confidence: 'high' | 'medium' | 'low'
  ): string {
    if (!isViable) {
      if (netProfitPct <= 0) {
        return 'Costs exceed spread - no profit after fees';
      }
      if (winProb < 0.9) {
        return 'Execution risk too high - likely partial fills or failures';
      }
      return 'Does not meet minimum profitability thresholds';
    }

    return `${confidence.charAt(0).toUpperCase() + confidence.slice(1)} confidence arb: ` +
      `${netProfitPct.toFixed(2)}% net profit with ${(winProb * 100).toFixed(1)}% execution probability`;
  }

  /**
   * Get chain for platform
   */
  private getPlatformChain(platform: string): string {
    const chainMap: Record<string, string> = {
      polymarket: 'polygon',
      kalshi: 'offchain',
      manifold: 'offchain',
      jupiter: 'solana',
      dflow: 'solana',
      limitless: 'base',
    };
    return chainMap[platform] || 'unknown';
  }
}

// Singleton instance
let evCalculatorInstance: EVCalculator | null = null;

export function getEVCalculator(config?: Partial<EVConfig>): EVCalculator {
  if (!evCalculatorInstance) {
    evCalculatorInstance = new EVCalculator(config);
  }
  return evCalculatorInstance;
}
```

---

## Slippage Estimation

### File: `lib/ev/slippage.ts`

```typescript
import { PlatformMarketData, TradeParams, SlippageCost, EVConfig } from './types';

/**
 * Estimate slippage for a trade
 */
export async function estimateSlippage(
  market: PlatformMarketData,
  trade: TradeParams,
  config: EVConfig
): Promise<SlippageCost> {
  // If we have order book data, use it
  if (market.orderBook) {
    return estimateFromOrderBook(market.orderBook, trade, config);
  }

  // Otherwise estimate from liquidity
  return estimateFromLiquidity(market, trade, config);
}

/**
 * Estimate slippage from order book
 */
function estimateFromOrderBook(
  orderBook: PlatformMarketData['orderBook'],
  trade: TradeParams,
  config: EVConfig
): SlippageCost {
  if (!orderBook) {
    return estimateDefault(trade.amount, config);
  }

  const orders = trade.side === 'YES' ? orderBook.asks : orderBook.bids;

  let remaining = trade.amount;
  let totalCost = 0;
  let basePrice = orders[0]?.price || 0.5;

  for (const order of orders) {
    const fillAmount = Math.min(remaining, order.size);
    totalCost += fillAmount * order.price;
    remaining -= fillAmount;

    if (remaining <= 0) break;
  }

  // If couldn't fill entire order
  if (remaining > 0) {
    // Assume 10% worse price for unfilled portion
    totalCost += remaining * (basePrice * 1.1);
  }

  const avgPrice = totalCost / trade.amount;
  const slippagePct = ((avgPrice - basePrice) / basePrice) * 100;

  return {
    estimatedPct: slippagePct * config.slippageMultiplier,
    worstCasePct: slippagePct * config.slippageMultiplier * 2,
    usdAmount: (slippagePct / 100) * trade.amount,
    model: 'orderbook',
  };
}

/**
 * Estimate slippage from liquidity (no order book)
 */
function estimateFromLiquidity(
  market: PlatformMarketData,
  trade: TradeParams,
  config: EVConfig
): SlippageCost {
  // Simple model: slippage increases with trade size relative to liquidity
  // slippage% ≈ (tradeSize / liquidity) * impactFactor

  const liquidity = market.liquidity || 10000; // Default 10K if unknown
  const impactFactor = getImpactFactor(config.defaultSlippageModel);

  // Base slippage
  const tradeRatio = trade.amount / liquidity;
  let slippagePct = tradeRatio * impactFactor * 100;

  // Apply platform-specific adjustments
  slippagePct *= getPlatformSlippageMultiplier(market.platform);

  // Cap at reasonable maximum
  slippagePct = Math.min(slippagePct, 20);

  return {
    estimatedPct: slippagePct * config.slippageMultiplier,
    worstCasePct: slippagePct * config.slippageMultiplier * 2,
    usdAmount: (slippagePct / 100) * trade.amount,
    model: 'estimated',
  };
}

/**
 * Default slippage estimate
 */
function estimateDefault(amount: number, config: EVConfig): SlippageCost {
  // Conservative default: 1% base + 0.5% per $1000
  const basePct = 1;
  const scalePct = (amount / 1000) * 0.5;
  const estimatedPct = (basePct + scalePct) * config.slippageMultiplier;

  return {
    estimatedPct,
    worstCasePct: estimatedPct * 2,
    usdAmount: (estimatedPct / 100) * amount,
    model: 'estimated',
  };
}

/**
 * Get impact factor based on model aggressiveness
 */
function getImpactFactor(model: EVConfig['defaultSlippageModel']): number {
  switch (model) {
    case 'conservative': return 0.5;
    case 'moderate': return 0.3;
    case 'aggressive': return 0.15;
    default: return 0.3;
  }
}

/**
 * Platform-specific slippage multiplier
 */
function getPlatformSlippageMultiplier(platform: string): number {
  const multipliers: Record<string, number> = {
    polymarket: 1.0,    // CLOB, good liquidity
    kalshi: 0.8,        // Regulated, tighter spreads
    manifold: 1.5,      // AMM, more slippage
    jupiter: 1.2,       // DEX, variable
    limitless: 1.3,     // Newer, less liquid
  };
  return multipliers[platform] || 1.0;
}
```

---

## Fee Calculator

### File: `lib/ev/fees.ts`

```typescript
import { PlatformFeeCost } from './types';

/**
 * Platform fee structures
 */
const PLATFORM_FEES: Record<string, {
  baseFee: number;           // Base fee %
  feeType: 'maker_taker' | 'spread' | 'winning' | 'flat';
  tiers?: Array<{ minVolume: number; discount: number }>;
  notes: string;
}> = {
  polymarket: {
    baseFee: 2.0,
    feeType: 'winning',      // 2% on net winnings only
    notes: 'No fee on losses',
  },
  kalshi: {
    baseFee: 1.0,
    feeType: 'maker_taker',
    tiers: [
      { minVolume: 10000, discount: 0.1 },
      { minVolume: 100000, discount: 0.3 },
      { minVolume: 1000000, discount: 0.5 },
    ],
    notes: 'Volume-based discounts',
  },
  manifold: {
    baseFee: 0,
    feeType: 'flat',
    notes: 'Play money - no fees',
  },
  jupiter: {
    baseFee: 0.25,
    feeType: 'spread',
    notes: 'DEX aggregator fee',
  },
  dflow: {
    baseFee: 0.1,
    feeType: 'spread',
    notes: 'Order flow auction',
  },
  limitless: {
    baseFee: 1.5,
    feeType: 'maker_taker',
    notes: 'Standard DeFi fees',
  },
};

/**
 * Calculate platform fee
 */
export function calculatePlatformFee(
  platform: string,
  tradeAmount: number,
  userVolume: number = 0  // Historical volume for tier calculation
): PlatformFeeCost {
  const config = PLATFORM_FEES[platform] || { baseFee: 1.0, feeType: 'flat', notes: 'Unknown platform' };

  // Calculate volume discount
  let discount = 0;
  if (config.tiers) {
    for (const tier of config.tiers) {
      if (userVolume >= tier.minVolume) {
        discount = tier.discount;
      }
    }
  }

  const effectiveFee = config.baseFee * (1 - discount);

  // For 'winning' fee type (Polymarket), adjust expectation
  // On average, you win ~50% of trades, so effective fee is halved
  let adjustedFee = effectiveFee;
  if (config.feeType === 'winning') {
    adjustedFee = effectiveFee * 0.5; // Expected value
  }

  return {
    platform,
    baseFee: config.baseFee,
    volumeDiscount: discount,
    effectiveFee: adjustedFee,
    usdAmount: (adjustedFee / 100) * tradeAmount,
  };
}

/**
 * Get fee info for display
 */
export function getFeeInfo(platform: string): {
  description: string;
  feeStructure: string;
  tips: string[];
} {
  const config = PLATFORM_FEES[platform];
  if (!config) {
    return {
      description: 'Unknown platform',
      feeStructure: 'N/A',
      tips: [],
    };
  }

  const tips: string[] = [];

  switch (config.feeType) {
    case 'winning':
      tips.push('Fees only apply to winning trades');
      tips.push('No fee charged on losses');
      break;
    case 'maker_taker':
      tips.push('Limit orders may have lower fees');
      if (config.tiers) {
        tips.push('Higher volume = lower fees');
      }
      break;
    case 'spread':
      tips.push('Fee embedded in price spread');
      break;
  }

  return {
    description: config.notes,
    feeStructure: `${config.baseFee}% ${config.feeType}`,
    tips,
  };
}
```

---

## Gas Estimation

### File: `lib/ev/gas.ts`

```typescript
import { GasFeeCost, BridgeFeeCost } from './types';

/**
 * Chain gas configurations
 */
const CHAIN_GAS: Record<string, {
  avgGasUnits: number;
  avgGweiOrLamports: number;
  nativeTokenPrice: number;  // USD
}> = {
  solana: {
    avgGasUnits: 5000,       // Compute units
    avgGweiOrLamports: 5000, // Lamports
    nativeTokenPrice: 150,   // SOL price
  },
  polygon: {
    avgGasUnits: 150000,     // Gas units
    avgGweiOrLamports: 50,   // Gwei
    nativeTokenPrice: 0.5,   // MATIC price
  },
  ethereum: {
    avgGasUnits: 150000,
    avgGweiOrLamports: 30,
    nativeTokenPrice: 3000,  // ETH price
  },
  base: {
    avgGasUnits: 150000,
    avgGweiOrLamports: 0.01, // Very cheap
    nativeTokenPrice: 3000,
  },
};

/**
 * Platform to chain mapping
 */
const PLATFORM_CHAINS: Record<string, string> = {
  polymarket: 'polygon',
  kalshi: 'offchain',
  manifold: 'offchain',
  jupiter: 'solana',
  dflow: 'solana',
  limitless: 'base',
};

/**
 * Estimate gas fee for a trade
 */
export async function estimateGasFee(
  platform: string,
  originChain: string
): Promise<GasFeeCost> {
  const targetChain = PLATFORM_CHAINS[platform];

  // Offchain platforms have no gas
  if (targetChain === 'offchain') {
    return {
      chain: 'offchain',
      usdAmount: 0,
      confidence: 'high',
    };
  }

  const chainConfig = CHAIN_GAS[targetChain];
  if (!chainConfig) {
    return {
      chain: targetChain || 'unknown',
      usdAmount: 0.50, // Conservative default
      confidence: 'low',
    };
  }

  // Calculate gas cost
  let usdAmount: number;

  if (targetChain === 'solana') {
    // Solana: lamports * price / 1e9
    usdAmount = (chainConfig.avgGasUnits * chainConfig.avgGweiOrLamports * chainConfig.nativeTokenPrice) / 1e9;
  } else {
    // EVM: gasUnits * gwei * price / 1e9
    usdAmount = (chainConfig.avgGasUnits * chainConfig.avgGweiOrLamports * chainConfig.nativeTokenPrice) / 1e9;
  }

  return {
    chain: targetChain,
    estimatedGwei: chainConfig.avgGweiOrLamports,
    usdAmount: Math.max(usdAmount, 0.001), // Minimum $0.001
    confidence: 'medium',
  };
}

/**
 * Estimate bridge fee if cross-chain
 */
export async function estimateBridgeFee(
  originChain: string,
  targetPlatform: string
): Promise<BridgeFeeCost> {
  const targetChain = PLATFORM_CHAINS[targetPlatform];

  // No bridge needed for offchain or same chain
  if (targetChain === 'offchain' || targetChain === originChain) {
    return {
      required: false,
      estimatedUsd: 0,
      estimatedTimeSeconds: 0,
    };
  }

  // Bridge cost estimates
  const BRIDGE_COSTS: Record<string, { usd: number; seconds: number; provider: string }> = {
    'solana-polygon': { usd: 2.0, seconds: 180, provider: 'Wormhole' },
    'solana-base': { usd: 1.5, seconds: 120, provider: 'Wormhole' },
    'solana-ethereum': { usd: 5.0, seconds: 300, provider: 'Wormhole' },
    'polygon-solana': { usd: 2.0, seconds: 180, provider: 'Wormhole' },
    'polygon-base': { usd: 0.5, seconds: 60, provider: 'Across' },
    'ethereum-polygon': { usd: 3.0, seconds: 120, provider: 'Across' },
    'ethereum-base': { usd: 1.0, seconds: 60, provider: 'Across' },
  };

  const key = `${originChain}-${targetChain}`;
  const bridgeInfo = BRIDGE_COSTS[key] || { usd: 3.0, seconds: 180, provider: 'Unknown' };

  return {
    required: true,
    fromChain: originChain,
    toChain: targetChain,
    estimatedUsd: bridgeInfo.usd,
    estimatedTimeSeconds: bridgeInfo.seconds,
    provider: bridgeInfo.provider,
  };
}
```

---

## Liquidity Analysis

### File: `lib/ev/liquidity.ts`

```typescript
import { PlatformMarketData } from './types';

interface LiquidityAnalysis {
  score: number;               // 0-100
  maxSafeAmount: number;       // Max trade before excessive slippage
  depth: 'deep' | 'moderate' | 'thin' | 'very_thin';
  warnings: string[];
}

/**
 * Analyze market liquidity
 */
export function analyzeLiquidity(
  market: PlatformMarketData,
  intendedAmount: number
): LiquidityAnalysis {
  const liquidity = market.liquidity || 0;
  const volume24h = market.volume24h || 0;

  const warnings: string[] = [];

  // Score based on absolute liquidity
  let liquidityScore = Math.min(100, (liquidity / 100000) * 100);

  // Adjust for trade size
  const tradeRatio = intendedAmount / (liquidity || 1);
  if (tradeRatio > 0.1) {
    liquidityScore *= 0.5;
    warnings.push(`Trade is ${(tradeRatio * 100).toFixed(1)}% of total liquidity`);
  } else if (tradeRatio > 0.05) {
    liquidityScore *= 0.75;
    warnings.push('Trade size may impact price');
  }

  // Adjust for 24h volume (activity indicator)
  if (volume24h < 1000) {
    liquidityScore *= 0.7;
    warnings.push('Low 24h volume - market may be stale');
  }

  // Determine depth category
  let depth: LiquidityAnalysis['depth'];
  if (liquidity > 100000) {
    depth = 'deep';
  } else if (liquidity > 25000) {
    depth = 'moderate';
  } else if (liquidity > 5000) {
    depth = 'thin';
  } else {
    depth = 'very_thin';
    warnings.push('Very thin liquidity - expect high slippage');
  }

  // Calculate max safe amount (5% of liquidity as rule of thumb)
  const maxSafeAmount = liquidity * 0.05;

  return {
    score: Math.round(liquidityScore),
    maxSafeAmount,
    depth,
    warnings,
  };
}
```

---

## Execution Risk Model

### File: `lib/ev/execution.ts`

```typescript
import { PlatformMarketData, TradeParams, SlippageCost } from './types';

interface ExecutionRisk {
  probability: number;         // 0-1: probability of successful execution
  partialFillRisk: number;     // 0-1: risk of partial fill
  failureReasons: string[];
}

/**
 * Assess execution risk
 */
export function assessExecutionRisk(
  market: PlatformMarketData,
  trade: TradeParams,
  slippage: SlippageCost
): ExecutionRisk {
  let probability = 1.0;
  const failureReasons: string[] = [];

  // Liquidity-based risk
  const liquidityRatio = trade.amount / (market.liquidity || 1);
  if (liquidityRatio > 0.5) {
    probability *= 0.5;
    failureReasons.push('Trade exceeds 50% of market liquidity');
  } else if (liquidityRatio > 0.2) {
    probability *= 0.8;
    failureReasons.push('Trade is significant portion of liquidity');
  } else if (liquidityRatio > 0.1) {
    probability *= 0.95;
  }

  // Slippage-based risk
  if (slippage.estimatedPct > 10) {
    probability *= 0.6;
    failureReasons.push('Very high expected slippage');
  } else if (slippage.estimatedPct > 5) {
    probability *= 0.85;
    failureReasons.push('High expected slippage');
  }

  // Platform-specific risk
  const platformRisk = getPlatformRisk(market.platform);
  probability *= platformRisk.multiplier;
  if (platformRisk.reason) {
    failureReasons.push(platformRisk.reason);
  }

  // Partial fill risk
  let partialFillRisk = liquidityRatio * 2; // Higher ratio = higher partial fill risk
  partialFillRisk = Math.min(partialFillRisk, 0.9);

  return {
    probability: Math.max(0.1, Math.min(probability, 1)),
    partialFillRisk,
    failureReasons,
  };
}

/**
 * Platform-specific execution risk
 */
function getPlatformRisk(platform: string): { multiplier: number; reason?: string } {
  const risks: Record<string, { multiplier: number; reason?: string }> = {
    polymarket: { multiplier: 0.98 },                    // Very reliable
    kalshi: { multiplier: 0.99 },                        // Regulated, reliable
    manifold: { multiplier: 0.95, reason: 'Play money platform' },
    jupiter: { multiplier: 0.92, reason: 'DEX execution risk' },
    dflow: { multiplier: 0.90, reason: 'Auction-based execution' },
    limitless: { multiplier: 0.85, reason: 'Newer platform' },
  };

  return risks[platform] || { multiplier: 0.9, reason: 'Unknown platform' };
}
```

---

## Integration with Market Matcher

### File: `lib/ml/marketMatcher.ts` (modifications)

```typescript
// Add import
import { getEVCalculator, EVResult, ArbitrageEVResult } from '../ev';

// Modify MLMatchResult
export interface MLMatchResult {
  // ... existing fields ...

  // NEW: EV analysis
  evAnalysis?: {
    bestPlatform: string;
    effectiveOdds: number;
    totalCostPct: number;
    recommendation: string;
  };

  // Enhanced arbitrage with EV
  arbitrageEV?: ArbitrageEVResult;
}

// Modify detectArbitrage to include EV
async function detectArbitrageWithEV(
  markets: PlatformMarket[],
  config: MLMatchConfig
): Promise<{ basic: ArbitrageOpportunity | undefined; ev: ArbitrageEVResult | undefined }> {
  const basic = detectArbitrage(markets, config);

  if (!basic || basic.netProfit <= 0) {
    return { basic, ev: undefined };
  }

  // Calculate detailed EV
  const evCalculator = getEVCalculator();

  const buyMarket = markets.find(m => m.platform === basic.buyPlatform);
  const sellMarket = markets.find(m => m.platform === basic.sellPlatform);

  if (!buyMarket || !sellMarket) {
    return { basic, ev: undefined };
  }

  const ev = await evCalculator.calculateArbitrageEV(
    {
      platform: buyMarket.platform,
      yesPrice: buyMarket.yesPrice,
      noPrice: buyMarket.noPrice,
      volume24h: buyMarket.volume24h || 0,
      liquidity: buyMarket.liquidity || 10000,
      url: buyMarket.url,
    },
    {
      platform: sellMarket.platform,
      yesPrice: sellMarket.yesPrice,
      noPrice: sellMarket.noPrice,
      volume24h: sellMarket.volume24h || 0,
      liquidity: sellMarket.liquidity || 10000,
      url: sellMarket.url,
    },
    1000 // Default $1000 trade size for analysis
  );

  return { basic, ev };
}
```

---

## API Response Modifications

### File: `app/api/v2/markets/route.ts` (additions)

```typescript
// Add to query params
// ev=true - Include EV analysis (slower)
// tradeAmount=1000 - Amount for EV calculation

// Add to response
interface EnrichedMarketResponse {
  // ... existing fields ...

  ev?: {
    bestPlatform: {
      platform: string;
      effectiveOdds: number;
      totalCostPct: number;
    };
    arbitrage?: {
      isViable: boolean;
      netProfitPct: number;
      confidence: 'high' | 'medium' | 'low';
      buyPlatform: string;
      sellPlatform: string;
      executionPlan: string[];
    };
  };
}
```

---

## Frontend Display Component

### File: `berightweb/src/components/EVDisplay.tsx` (new)

```tsx
import React from 'react';
import styles from './EVDisplay.module.css';

interface EVDisplayProps {
  rawOdds: number;
  effectiveOdds: number;
  costs: {
    slippage: number;
    platformFee: number;
    gasFee: number;
    bridgeFee: number;
    totalPct: number;
  };
  recommendation: {
    shouldExecute: boolean;
    reasoning: string;
  };
}

export function EVDisplay({ rawOdds, effectiveOdds, costs, recommendation }: EVDisplayProps) {
  const costDiff = effectiveOdds - rawOdds;
  const isSignificant = costs.totalPct > 2;

  return (
    <div className={styles.container}>
      <div className={styles.oddsComparison}>
        <div className={styles.rawOdds}>
          <span className={styles.label}>Quoted</span>
          <span className={styles.value}>{(rawOdds * 100).toFixed(1)}%</span>
        </div>
        <div className={styles.arrow}>→</div>
        <div className={styles.effectiveOdds}>
          <span className={styles.label}>Effective</span>
          <span className={`${styles.value} ${isSignificant ? styles.warning : ''}`}>
            {(effectiveOdds * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      <div className={styles.costBreakdown}>
        <div className={styles.costItem}>
          <span>Slippage</span>
          <span>{costs.slippage.toFixed(2)}%</span>
        </div>
        <div className={styles.costItem}>
          <span>Platform Fee</span>
          <span>{costs.platformFee.toFixed(2)}%</span>
        </div>
        {costs.gasFee > 0 && (
          <div className={styles.costItem}>
            <span>Gas</span>
            <span>${costs.gasFee.toFixed(2)}</span>
          </div>
        )}
        {costs.bridgeFee > 0 && (
          <div className={styles.costItem}>
            <span>Bridge</span>
            <span>${costs.bridgeFee.toFixed(2)}</span>
          </div>
        )}
        <div className={`${styles.costItem} ${styles.total}`}>
          <span>Total Cost</span>
          <span>{costs.totalPct.toFixed(2)}%</span>
        </div>
      </div>

      <div className={`${styles.recommendation} ${recommendation.shouldExecute ? styles.go : styles.caution}`}>
        {recommendation.shouldExecute ? '✓' : '⚠'} {recommendation.reasoning}
      </div>
    </div>
  );
}
```

---

## Environment Variables

```bash
# .env.local

# EV Calculator
EV_CALCULATOR_ENABLED=true
EV_DEFAULT_SLIPPAGE_MODEL=moderate
EV_SLIPPAGE_MULTIPLIER=1.5
EV_MIN_EXECUTION_PROBABILITY=0.95
EV_MAX_SLIPPAGE_PCT=5
EV_MIN_NET_PROFIT=1
EV_MIN_NET_PROFIT_PCT=0.5
```

---

## Testing

### File: `lib/ev/__tests__/ev.test.ts`

```typescript
import { EVCalculator } from '../index';
import { calculatePlatformFee } from '../fees';
import { estimateSlippage } from '../slippage';

describe('EV Calculator', () => {
  const calculator = new EVCalculator();

  describe('Single Trade EV', () => {
    it('should calculate effective odds higher than raw odds', async () => {
      const market = {
        platform: 'polymarket',
        yesPrice: 0.50,
        noPrice: 0.50,
        volume24h: 50000,
        liquidity: 100000,
        url: 'https://polymarket.com/test',
      };

      const result = await calculator.calculateTradeEV(market, {
        side: 'YES',
        amount: 1000,
        inputToken: 'USDC',
        originChain: 'polygon',
      });

      expect(result.effectiveOdds).toBeGreaterThan(result.rawOdds);
      expect(result.costs.totalCostPct).toBeGreaterThan(0);
    });

    it('should flag high slippage trades', async () => {
      const thinMarket = {
        platform: 'limitless',
        yesPrice: 0.50,
        noPrice: 0.50,
        volume24h: 1000,
        liquidity: 5000,  // Very thin
        url: 'https://limitless.com/test',
      };

      const result = await calculator.calculateTradeEV(thinMarket, {
        side: 'YES',
        amount: 2500,  // 50% of liquidity
        inputToken: 'USDC',
        originChain: 'solana',
      });

      expect(result.recommendation.shouldExecute).toBe(false);
      expect(result.risk.liquidityScore).toBeLessThan(50);
    });
  });

  describe('Arbitrage EV', () => {
    it('should detect viable arbitrage', async () => {
      const buyMarket = {
        platform: 'polymarket',
        yesPrice: 0.45,
        noPrice: 0.55,
        volume24h: 100000,
        liquidity: 500000,
        url: 'https://polymarket.com/test',
      };

      const sellMarket = {
        platform: 'kalshi',
        yesPrice: 0.52,
        noPrice: 0.48,
        volume24h: 50000,
        liquidity: 200000,
        url: 'https://kalshi.com/test',
      };

      const result = await calculator.calculateArbitrageEV(
        buyMarket,
        sellMarket,
        1000,
        'polygon'
      );

      expect(result.rawSpread).toBeCloseTo(0.07, 2);
      expect(result.netProfitPct).toBeGreaterThan(0);
      expect(result.isViable).toBe(true);
    });

    it('should reject unprofitable arb after fees', async () => {
      const buyMarket = {
        platform: 'polymarket',
        yesPrice: 0.50,
        noPrice: 0.50,
        volume24h: 100000,
        liquidity: 500000,
        url: 'https://polymarket.com/test',
      };

      const sellMarket = {
        platform: 'kalshi',
        yesPrice: 0.51,  // Only 1% spread
        noPrice: 0.49,
        volume24h: 50000,
        liquidity: 200000,
        url: 'https://kalshi.com/test',
      };

      const result = await calculator.calculateArbitrageEV(
        buyMarket,
        sellMarket,
        1000,
        'solana'  // Requires bridge
      );

      // 1% spread minus fees + bridge should be negative
      expect(result.isViable).toBe(false);
    });
  });

  describe('Platform Fees', () => {
    it('should calculate Polymarket winning fee correctly', () => {
      const fee = calculatePlatformFee('polymarket', 1000);

      // 2% on winnings, but only ~50% of trades win
      expect(fee.effectiveFee).toBeCloseTo(1.0, 1);
    });

    it('should apply volume discounts for Kalshi', () => {
      const smallFee = calculatePlatformFee('kalshi', 1000, 1000);
      const largeFee = calculatePlatformFee('kalshi', 1000, 100000);

      expect(largeFee.effectiveFee).toBeLessThan(smallFee.effectiveFee);
    });
  });
});
```

---

## Migration Plan

### Phase 1: Core Implementation (Week 1)
1. Implement types and core calculator
2. Add slippage and fee modules
3. Unit tests for all modules

### Phase 2: Integration (Week 1-2)
1. Integrate with market matcher
2. Add EV to arbitrage detection
3. Modify API responses

### Phase 3: Frontend (Week 2)
1. Build EVDisplay component
2. Add to market cards
3. Add to arbitrage feed

### Phase 4: Optimization (Week 2+)
1. Add order book integration where available
2. Cache gas prices
3. Add historical slippage tracking

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Arb alert accuracy | ~70% | >90% |
| User realizes quoted profit | ~50% | >80% |
| False positive arb rate | ~30% | <10% |
| EV calculation latency | N/A | <100ms |

---

## Cost Analysis

| Component | Cost |
|-----------|------|
| Gas price APIs | Free (public RPCs) |
| Order book data | Platform-dependent |
| Compute | Minimal (local calculation) |

**Total estimated monthly cost**: $0 (all local computation)
