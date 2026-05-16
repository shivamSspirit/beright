/**
 * EV Calculator Module
 *
 * Main entry point for Expected Value calculations.
 * Calculates effective odds accounting for slippage, fees, gas, and execution risk.
 *
 * Usage:
 * ```typescript
 * import { getEVCalculator, EVCalculator } from './ev';
 *
 * // Using singleton
 * const calculator = getEVCalculator();
 * const result = await calculator.calculateTradeEV(market, trade);
 *
 * // Or create custom instance
 * const customCalculator = new EVCalculator({ maxSlippagePct: 3 });
 * ```
 *
 * @author BeRight Protocol
 */

// Types
export type {
  PlatformMarketData,
  OrderBookSnapshot,
  TradeParams,
  ChainType,
  SlippageCost,
  PlatformFeeCost,
  GasFeeCost,
  BridgeFeeCost,
  EVResult,
  ArbitrageEVResult,
  EVConfig,
  LiquidityAnalysis,
  ExecutionRisk,
} from './types';

export { DEFAULT_EV_CONFIG } from './types';

// Sub-modules
export { estimateSlippage, estimateSlippageForAmount } from './slippage';
export { calculatePlatformFee, calculateArbitrageFees, getFeeInfo, getAllPlatformFees } from './fees';
export { estimateGasFee, estimateBridgeFee, getPlatformChain, needsBridge, estimateTotalChainCosts } from './gas';
export { analyzeLiquidity, analyzeOrderBookDepth, calculateTurnoverRatio, isMarketActive, compareLiquidity } from './liquidity';
export { assessExecutionRisk, assessArbitrageExecutionRisk, assessTimingRisk, identifyFailureModes } from './execution';

// =============================================================================
// IMPORTS
// =============================================================================

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
import { estimateGasFee, estimateBridgeFee, getPlatformChain } from './gas';
import { assessExecutionRisk } from './execution';
import { analyzeLiquidity } from './liquidity';

// =============================================================================
// EV CALCULATOR CLASS
// =============================================================================

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
   * Batch calculate EV for multiple markets
   */
  async calculateBatchEV(
    markets: PlatformMarketData[],
    trade: Omit<TradeParams, 'side'> & { side?: 'YES' | 'NO' }
  ): Promise<Array<{ market: PlatformMarketData; ev: EVResult }>> {
    const side = trade.side || 'YES';
    const results = await Promise.all(
      markets.map(async (market) => {
        const ev = await this.calculateTradeEV(market, { ...trade, side });
        return { market, ev };
      })
    );

    // Sort by effective odds (best first)
    return results.sort((a, b) => a.ev.effectiveOdds - b.ev.effectiveOdds);
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
    const buyChain = getPlatformChain(buyMarket.platform);
    const sellChain = getPlatformChain(sellMarket.platform);

    const needsBridgeBuy = originChain !== buyChain && buyChain !== 'offchain';
    const needsBridgeSell = originChain !== sellChain && sellChain !== 'offchain';

    let estimatedTime = 30; // Base: 30 seconds for single chain
    if (needsBridgeBuy) {
      estimatedTime += 120; // Add 2 minutes per bridge
    }
    if (needsBridgeSell) {
      estimatedTime += 120;
    }

    const risks: string[] = [];
    if (needsBridgeBuy || needsBridgeSell) {
      risks.push('Cross-chain bridge delay risk');
    }
    if ((buyMarket.liquidity || 0) < 10000) {
      risks.push('Low buy-side liquidity');
    }
    if ((sellMarket.liquidity || 0) < 10000) {
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
   * Update configuration
   */
  updateConfig(config: Partial<EVConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): EVConfig {
    return { ...this.config };
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let evCalculatorInstance: EVCalculator | null = null;

/**
 * Get or create the EV calculator singleton
 */
export function getEVCalculator(config?: Partial<EVConfig>): EVCalculator {
  if (!evCalculatorInstance) {
    evCalculatorInstance = new EVCalculator(config);
  } else if (config) {
    evCalculatorInstance.updateConfig(config);
  }
  return evCalculatorInstance;
}

/**
 * Reset the EV calculator singleton (for testing)
 */
export function resetEVCalculator(): void {
  evCalculatorInstance = null;
}
