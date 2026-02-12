/**
 * Production-Grade Arbitrage Calculator
 *
 * Mathematical engine for detecting and validating arbitrage opportunities
 * in prediction markets. Handles:
 *
 * 1. Cross-platform spread arbitrage (Buy YES on A + NO on B)
 * 2. Synthetic arbitrage (multi-leg strategies)
 * 3. Fee-adjusted profit calculations
 * 4. Slippage estimation
 * 5. Liquidity constraints
 * 6. Risk scoring
 *
 * All calculations assume binary (Yes/No) markets with prices in [0, 1]
 */

import { Platform, Market } from '../../types/index';
import { PLATFORMS } from '../../config/platforms';
import {
  ValidatedMarketPair,
  ValidatedArbitrageOpportunity,
  ArbitrageStrategy,
  ArbitrageStrategyType,
  ArbitrageLeg,
  ExecutablePrice,
  OrderBookDepth,
  FeeStructure,
  CostBreakdown,
  RiskAssessment,
  ExecutionRisk,
  MarketRisk,
  OperationalRisk,
  RiskFlag,
  ExecutionPlan,
  ArbitrageConfidence,
  ConfidenceGrade,
  ArbitrageConfig,
  DEFAULT_ARBITRAGE_CONFIG,
} from './types';

// ============================================
// FEE STRUCTURES BY PLATFORM
// ============================================

const PLATFORM_FEES: Record<Platform, FeeStructure> = {
  polymarket: {
    tradingFee: 0.00,        // No trading fee
    withdrawalFee: 0.00,     // Gas costs on Polygon
    settlementFee: 0.00,     // No settlement fee
    volumeDiscounts: [],
  },
  kalshi: {
    tradingFee: 0.01,        // $0.01 per contract (1 cent on 1 contract = 1% at $1)
    withdrawalFee: 0.00,
    settlementFee: 0.00,
    volumeDiscounts: [
      { minVolume: 10000, feeRate: 0.007 },
      { minVolume: 100000, feeRate: 0.005 },
    ],
  },
  manifold: {
    tradingFee: 0.00,        // No fee (play money)
    withdrawalFee: 0.00,
    settlementFee: 0.00,
    volumeDiscounts: [],
  },
  limitless: {
    tradingFee: 0.005,       // 0.5% fee
    withdrawalFee: 0.00,
    settlementFee: 0.00,
    volumeDiscounts: [],
  },
  metaculus: {
    tradingFee: 0.00,        // No trading
    withdrawalFee: 0.00,
    settlementFee: 0.00,
    volumeDiscounts: [],
  },
};

// ============================================
// PRICE UTILITIES
// ============================================

/**
 * Get executable price data from market
 * Uses orderbook if available, otherwise estimates from mid price
 */
function getExecutablePrice(market: Market): ExecutablePrice {
  const now = new Date();

  // If market has orderbook data (e.g., from DFlow)
  if (market.orderbook) {
    return {
      midPrice: (market.orderbook.yesBid + market.orderbook.yesAsk) / 2,
      bidPrice: market.orderbook.yesBid,
      askPrice: market.orderbook.yesAsk,
      spread: market.orderbook.yesAsk - market.orderbook.yesBid,
      bidSize: estimateSizeFromVolume(market.volume),
      askSize: estimateSizeFromVolume(market.volume),
      depth: estimateDepth(market),
      timestamp: now,
      isStale: false,
    };
  }

  // Estimate from mid price with typical spread
  const typicalSpread = 0.02; // 2% typical spread
  const halfSpread = typicalSpread / 2;

  return {
    midPrice: market.yesPrice,
    bidPrice: Math.max(0, market.yesPrice - halfSpread),
    askPrice: Math.min(1, market.yesPrice + halfSpread),
    spread: typicalSpread,
    bidSize: estimateSizeFromVolume(market.volume),
    askSize: estimateSizeFromVolume(market.volume),
    depth: estimateDepth(market),
    timestamp: now,
    isStale: false,
  };
}

/**
 * Estimate available size from volume
 */
function estimateSizeFromVolume(volume: number): number {
  // Rough heuristic: 5% of total volume available at any time
  return Math.max(100, volume * 0.05);
}

/**
 * Estimate order book depth
 */
function estimateDepth(market: Market): OrderBookDepth {
  const volume = market.volume || 0;
  const liquidity = market.liquidity || volume * 0.1;

  return {
    volumeAt1Pct: Math.min(liquidity * 0.1, 1000),
    volumeAt2Pct: Math.min(liquidity * 0.2, 2000),
    volumeAt5Pct: Math.min(liquidity * 0.4, 5000),
    priceImpact100: volume > 10000 ? 0.005 : 0.01,
    priceImpact1000: volume > 50000 ? 0.01 : 0.02,
    priceImpact10000: volume > 100000 ? 0.02 : 0.05,
  };
}

/**
 * Calculate slippage for a given order size
 */
function estimateSlippage(price: ExecutablePrice, orderSize: number): number {
  const depth = price.depth;

  if (orderSize <= 100) return depth.priceImpact100;
  if (orderSize <= 1000) return depth.priceImpact1000;
  if (orderSize <= 10000) return depth.priceImpact10000;

  // Linear extrapolation for larger orders
  return depth.priceImpact10000 * (orderSize / 10000);
}

// ============================================
// ARBITRAGE MATH
// ============================================

/**
 * Cross-Platform Spread Arbitrage
 *
 * The fundamental arbitrage in prediction markets:
 * - Buy YES on platform A at price P_A
 * - Buy NO on platform B at price (1 - P_B)
 *
 * Total cost = P_A + (1 - P_B) = P_A - P_B + 1
 *
 * Guaranteed payout = $1 (one of YES or NO wins)
 *
 * Profit = 1 - Total Cost = 1 - P_A - (1 - P_B) = P_B - P_A
 *
 * For arbitrage to exist: P_B > P_A (after fees)
 *
 * Note: This is NOT "buy low sell high" between platforms.
 * You can't directly sell on another platform. You're creating
 * a riskless position by holding both outcomes.
 */
interface ArbitrageResult {
  exists: boolean;
  strategy: ArbitrageStrategyType;
  description: string;

  // Legs
  legA: {
    side: 'YES' | 'NO';
    price: number;
    platform: Platform;
  };
  legB: {
    side: 'YES' | 'NO';
    price: number;
    platform: Platform;
  };

  // Economics (before slippage)
  grossCost: number;          // Total cost to enter position
  guaranteedPayout: number;   // Always $1 for binary
  grossProfit: number;        // guaranteedPayout - grossCost
  grossProfitPct: number;     // grossProfit / grossCost

  // After fees
  totalFees: number;
  netCost: number;
  netProfit: number;
  netProfitPct: number;
}

/**
 * Calculate cross-platform arbitrage opportunity
 */
function calculateCrossPlatformArbitrage(
  pair: ValidatedMarketPair
): ArbitrageResult | null {
  const marketA = pair.marketA;
  const marketB = pair.marketB;

  const priceA = getExecutablePrice(marketA);
  const priceB = getExecutablePrice(marketB);

  const feesA = PLATFORM_FEES[marketA.platform] || PLATFORM_FEES.polymarket;
  const feesB = PLATFORM_FEES[marketB.platform] || PLATFORM_FEES.polymarket;

  // Handle outcome mapping (in case one market is inverted)
  let yesA = priceA.askPrice;  // Price to BUY YES on A
  let yesB = priceB.askPrice;  // Price to BUY YES on B

  if (pair.outcomeMapping.isInverted) {
    // If inverted, YES on A = NO on B
    // So we compare A.YES with B.NO
    yesB = 1 - priceB.bidPrice; // Price of NO on B = 1 - bid of YES
  }

  // Strategy 1: Buy YES on A + NO on B
  // Works when: yesA + (1 - yesB) < 1
  // i.e., when yesA < yesB

  const costBuyYesA_NoB = yesA + (1 - yesB);
  const costBuyYesB_NoA = yesB + (1 - yesA);

  let bestStrategy: ArbitrageResult | null = null;

  // Check Strategy 1: YES on A + NO on B
  if (costBuyYesA_NoB < 1) {
    const grossProfit = 1 - costBuyYesA_NoB;
    const fees = yesA * feesA.tradingFee + (1 - yesB) * feesB.tradingFee;
    const netProfit = grossProfit - fees;

    if (netProfit > 0) {
      bestStrategy = {
        exists: true,
        strategy: 'CROSS_PLATFORM_SPREAD',
        description: `Buy YES @ ${marketA.platform} + NO @ ${marketB.platform}`,
        legA: { side: 'YES', price: yesA, platform: marketA.platform },
        legB: { side: 'NO', price: 1 - yesB, platform: marketB.platform },
        grossCost: costBuyYesA_NoB,
        guaranteedPayout: 1,
        grossProfit,
        grossProfitPct: grossProfit / costBuyYesA_NoB,
        totalFees: fees,
        netCost: costBuyYesA_NoB + fees,
        netProfit,
        netProfitPct: netProfit / (costBuyYesA_NoB + fees),
      };
    }
  }

  // Check Strategy 2: YES on B + NO on A
  if (costBuyYesB_NoA < 1) {
    const grossProfit = 1 - costBuyYesB_NoA;
    const fees = yesB * feesB.tradingFee + (1 - yesA) * feesA.tradingFee;
    const netProfit = grossProfit - fees;

    if (netProfit > 0 && (!bestStrategy || netProfit > bestStrategy.netProfit)) {
      bestStrategy = {
        exists: true,
        strategy: 'CROSS_PLATFORM_SPREAD',
        description: `Buy YES @ ${marketB.platform} + NO @ ${marketA.platform}`,
        legA: { side: 'NO', price: 1 - yesA, platform: marketA.platform },
        legB: { side: 'YES', price: yesB, platform: marketB.platform },
        grossCost: costBuyYesB_NoA,
        guaranteedPayout: 1,
        grossProfit,
        grossProfitPct: grossProfit / costBuyYesB_NoA,
        totalFees: fees,
        netCost: costBuyYesB_NoA + fees,
        netProfit,
        netProfitPct: netProfit / (costBuyYesB_NoA + fees),
      };
    }
  }

  return bestStrategy;
}

// ============================================
// COST BREAKDOWN
// ============================================

function calculateCosts(
  arb: ArbitrageResult,
  marketA: Market,
  marketB: Market,
  positionSize: number
): CostBreakdown {
  const priceA = getExecutablePrice(marketA);
  const priceB = getExecutablePrice(marketB);

  // Trading fees
  const feesA = PLATFORM_FEES[marketA.platform] || PLATFORM_FEES.polymarket;
  const feesB = PLATFORM_FEES[marketB.platform] || PLATFORM_FEES.polymarket;

  const tradingFees = positionSize * (
    arb.legA.price * feesA.tradingFee +
    arb.legB.price * feesB.tradingFee
  );

  // Slippage (estimated)
  const slippageA = estimateSlippage(priceA, positionSize * arb.legA.price);
  const slippageB = estimateSlippage(priceB, positionSize * arb.legB.price);
  const slippage = positionSize * (slippageA + slippageB);

  // Spread cost (bid-ask)
  const spreadCost = positionSize * (priceA.spread / 2 + priceB.spread / 2);

  // Settlement fees (usually 0)
  const settlementFees = positionSize * (feesA.settlementFee + feesB.settlementFee);

  const totalCost = tradingFees + slippage + spreadCost + settlementFees;

  return {
    tradingFees,
    slippage,
    spreadCost,
    settlementFees,
    totalCost,
    costAsPctOfCapital: totalCost / positionSize,
  };
}

// ============================================
// RISK ASSESSMENT
// ============================================

function assessRisk(
  pair: ValidatedMarketPair,
  arb: ArbitrageResult,
  costs: CostBreakdown,
  config: ArbitrageConfig
): RiskAssessment {
  const flags: RiskFlag[] = [];

  // Execution Risk
  const executionRisk = assessExecutionRisk(pair, arb, config);

  // Market Risk
  const marketRisk = assessMarketRisk(pair, config);

  // Operational Risk
  const operationalRisk = assessOperationalRisk(pair);

  // Calculate overall risk score (weighted average)
  const overallRiskScore = Math.round(
    0.5 * executionRisk.score +
    0.3 * marketRisk.score +
    0.2 * operationalRisk.score
  );

  // Generate flags
  if (executionRisk.liquidityRisk > 60) {
    flags.push({
      severity: 'WARNING',
      code: 'LOW_LIQUIDITY',
      message: 'Low liquidity may cause high slippage',
    });
  }

  if (marketRisk.resolutionRisk > 50) {
    flags.push({
      severity: 'WARNING',
      code: 'RESOLUTION_RISK',
      message: 'Markets may resolve differently due to differing criteria',
    });
  }

  if (pair.equivalence.overallScore < 0.9) {
    flags.push({
      severity: 'WARNING',
      code: 'MATCH_UNCERTAINTY',
      message: `Market equivalence ${(pair.equivalence.overallScore * 100).toFixed(0)}% - verify manually`,
    });
  }

  if (arb.netProfitPct < config.minNetProfitPct * 2) {
    flags.push({
      severity: 'INFO',
      code: 'THIN_MARGIN',
      message: 'Profit margin is thin - small price movements could eliminate profit',
    });
  }

  // Determine if safe to execute
  const criticalFlags = flags.filter(f => f.severity === 'CRITICAL').length;
  const warningFlags = flags.filter(f => f.severity === 'WARNING').length;

  const isSafe = criticalFlags === 0 &&
                 warningFlags <= 2 &&
                 overallRiskScore <= config.maxRiskScore &&
                 executionRisk.score <= config.maxExecutionRisk;

  let safetyReason = 'All risk checks passed';
  if (criticalFlags > 0) {
    safetyReason = 'Critical risk flags present';
  } else if (overallRiskScore > config.maxRiskScore) {
    safetyReason = `Risk score ${overallRiskScore} exceeds threshold ${config.maxRiskScore}`;
  } else if (executionRisk.score > config.maxExecutionRisk) {
    safetyReason = `Execution risk ${executionRisk.score} exceeds threshold ${config.maxExecutionRisk}`;
  }

  return {
    overallRiskScore,
    executionRisk,
    marketRisk,
    operationalRisk,
    flags,
    isSafe,
    safetyReason,
  };
}

function assessExecutionRisk(
  pair: ValidatedMarketPair,
  arb: ArbitrageResult,
  config: ArbitrageConfig
): ExecutionRisk {
  const marketA = pair.marketA;
  const marketB = pair.marketB;

  const priceA = getExecutablePrice(marketA);
  const priceB = getExecutablePrice(marketB);

  // Liquidity risk
  const minLiquidity = Math.min(
    marketA.liquidity || marketA.volume * 0.1,
    marketB.liquidity || marketB.volume * 0.1
  );
  const liquidityRisk = minLiquidity < config.minLiquidityUsd ? 80 :
                        minLiquidity < config.minLiquidityUsd * 5 ? 50 : 20;

  // Slippage risk
  const expectedSlippage = (
    estimateSlippage(priceA, config.defaultPositionUsd * arb.legA.price) +
    estimateSlippage(priceB, config.defaultPositionUsd * arb.legB.price)
  );
  const slippageRisk = expectedSlippage > 0.05 ? 80 :
                       expectedSlippage > 0.02 ? 50 : 20;

  // Timing risk (how fast prices change)
  // Higher volume = lower timing risk
  const minVolume = Math.min(marketA.volume || 0, marketB.volume || 0);
  const timingRisk = minVolume < 1000 ? 70 :
                     minVolume < 10000 ? 40 : 20;

  // Max executable size
  const maxExecutableSize = Math.min(
    priceA.depth.volumeAt2Pct,
    priceB.depth.volumeAt2Pct
  );

  // Execution window (estimate)
  const executionWindowMs = minVolume < 5000 ? 60000 :
                            minVolume < 50000 ? 30000 : 10000;

  const score = Math.round((liquidityRisk + slippageRisk + timingRisk) / 3);

  return {
    score,
    liquidityRisk,
    slippageRisk,
    timingRisk,
    maxExecutableSize,
    expectedSlippage,
    executionWindowMs,
  };
}

function assessMarketRisk(
  pair: ValidatedMarketPair,
  config: ArbitrageConfig
): MarketRisk {
  // Resolution risk based on equivalence validations
  let resolutionRisk = 20;
  if (!pair.equivalence.validations.noResolutionConflict) {
    resolutionRisk = 70;
  } else if (!pair.equivalence.validations.sameTimeframe) {
    resolutionRisk = 50;
  }

  // Correlation risk based on entity overlap
  const correlationRisk = pair.equivalence.entityOverlap > 0.7 ? 20 :
                          pair.equivalence.entityOverlap > 0.5 ? 40 : 60;

  // Price volatility (rough estimate)
  const priceVolatility = 30; // Default moderate volatility

  // Days until resolution
  const now = new Date();
  const resolutionA = pair.marketA.endDate;
  const resolutionB = pair.marketB.endDate;
  const resolution = resolutionA || resolutionB;
  const resolutionDays = resolution ?
    Math.max(0, (resolution.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) :
    365; // Default to 1 year if unknown

  const score = Math.round((resolutionRisk + correlationRisk + priceVolatility) / 3);

  return {
    score,
    resolutionRisk,
    correlationRisk,
    priceVolatility,
    historicalVolatility: 0.3, // Placeholder
    resolutionDays,
  };
}

function assessOperationalRisk(pair: ValidatedMarketPair): OperationalRisk {
  // Platform reliability scores (based on track record)
  const platformReliability: Record<Platform, number> = {
    polymarket: 90,
    kalshi: 95,  // Regulated
    manifold: 70, // Play money
    limitless: 60,
    metaculus: 80,
  };

  const reliabilityA = platformReliability[pair.marketA.platform] || 50;
  const reliabilityB = platformReliability[pair.marketB.platform] || 50;
  const avgReliability = (reliabilityA + reliabilityB) / 2;

  // Settlement risk (inverse of reliability)
  const settlementRisk = 100 - avgReliability;

  // Regulatory risk
  const regulatoryRisk = 20; // Default low risk

  const score = Math.round((settlementRisk + regulatoryRisk) / 2);

  return {
    score,
    platformReliability,
    settlementRisk,
    regulatoryRisk,
  };
}

// ============================================
// EXECUTION PLANNING
// ============================================

function createExecutionPlan(
  pair: ValidatedMarketPair,
  arb: ArbitrageResult,
  risk: RiskAssessment,
  config: ArbitrageConfig
): ExecutionPlan {
  const marketA = pair.marketA;
  const marketB = pair.marketB;

  // Execute leg with lower liquidity first (get the hard side done)
  const liquidityA = marketA.liquidity || marketA.volume * 0.1;
  const liquidityB = marketB.liquidity || marketB.volume * 0.1;
  const legOrder = liquidityA < liquidityB ? [0, 1] : [1, 0];

  // Size calculations
  const maxSize = Math.min(
    risk.executionRisk.maxExecutableSize,
    config.maxPositionUsd
  );

  const minSizeForProfit = arb.netProfit > 0 ?
    10 / arb.netProfitPct : // At least $10 profit
    config.defaultPositionUsd;

  const recommendedSize = Math.min(
    maxSize,
    Math.max(minSizeForProfit, config.defaultPositionUsd)
  );

  return {
    legOrder,
    estimatedExecutionTimeMs: risk.executionRisk.executionWindowMs,
    maxAcceptableDelayMs: 5000,
    recommendedSize,
    maxSize,
    minSize: minSizeForProfit,
    maxPriceDeviation: config.maxPriceDeviation,
    fallbackStrategy: 'Cancel second leg if first leg executes at worse price',
    abortConditions: [
      'Price moves more than 2% during execution',
      'Insufficient liquidity at execution time',
      'Platform API unavailable',
    ],
  };
}

// ============================================
// CONFIDENCE SCORING
// ============================================

function calculateConfidence(
  pair: ValidatedMarketPair,
  arb: ArbitrageResult,
  risk: RiskAssessment,
  config: ArbitrageConfig
): ArbitrageConfidence {
  // Match confidence
  const matchConfidence = pair.equivalence.overallScore * 100;

  // Price confidence (based on spread and staleness)
  const priceA = getExecutablePrice(pair.marketA);
  const priceB = getExecutablePrice(pair.marketB);
  const avgSpread = (priceA.spread + priceB.spread) / 2;
  const priceConfidence = avgSpread < 0.02 ? 90 :
                          avgSpread < 0.05 ? 70 : 50;

  // Execution confidence (inverse of risk)
  const executionConfidence = Math.max(0, 100 - risk.executionRisk.score);

  // Profit confidence
  const profitConfidence = arb.netProfitPct > config.minNetProfitPct * 3 ? 90 :
                           arb.netProfitPct > config.minNetProfitPct * 2 ? 70 :
                           arb.netProfitPct > config.minNetProfitPct ? 50 : 30;

  // Overall score
  const score = Math.round(
    0.35 * matchConfidence +
    0.25 * priceConfidence +
    0.25 * executionConfidence +
    0.15 * profitConfidence
  );

  // Grade
  let grade: ConfidenceGrade;
  if (score >= 90) grade = 'A';
  else if (score >= 75) grade = 'B';
  else if (score >= 60) grade = 'C';
  else if (score >= 40) grade = 'D';
  else grade = 'F';

  // Recommendation
  let recommendation: string;
  switch (grade) {
    case 'A':
      recommendation = 'High confidence opportunity. Safe to execute with recommended size.';
      break;
    case 'B':
      recommendation = 'Good opportunity. Proceed with caution, use smaller position size.';
      break;
    case 'C':
      recommendation = 'Moderate opportunity. Manual review recommended before execution.';
      break;
    case 'D':
      recommendation = 'Low confidence. Not recommended without additional verification.';
      break;
    case 'F':
      recommendation = 'Do not execute. Insufficient confidence in opportunity validity.';
      break;
  }

  return {
    score,
    matchConfidence,
    priceConfidence,
    executionConfidence,
    profitConfidence,
    grade,
    recommendation,
  };
}

// ============================================
// MAIN ARBITRAGE ANALYSIS
// ============================================

/**
 * Analyze a validated market pair for arbitrage opportunities
 */
export function analyzeArbitrage(
  pair: ValidatedMarketPair,
  config: ArbitrageConfig = DEFAULT_ARBITRAGE_CONFIG
): ValidatedArbitrageOpportunity | null {
  // Calculate arbitrage opportunity
  const arb = calculateCrossPlatformArbitrage(pair);

  // No arbitrage exists
  if (!arb || !arb.exists) {
    return null;
  }

  // Below minimum profit threshold
  if (arb.netProfitPct < config.minNetProfitPct) {
    return null;
  }

  // Calculate costs
  const costs = calculateCosts(arb, pair.marketA, pair.marketB, config.defaultPositionUsd);

  // Adjust profit for additional costs (slippage, spread)
  const adjustedNetProfit = arb.netProfit - costs.slippage - costs.spreadCost;
  const adjustedNetProfitPct = adjustedNetProfit / (arb.netCost + costs.slippage + costs.spreadCost);

  // Still profitable after all costs?
  if (adjustedNetProfitPct < config.minNetProfitPct) {
    return null;
  }

  // Assess risk
  const risk = assessRisk(pair, arb, costs, config);

  // Create execution plan
  const execution = createExecutionPlan(pair, arb, risk, config);

  // Calculate confidence
  const confidence = calculateConfidence(pair, arb, risk, config);

  // Build strategy
  const strategy: ArbitrageStrategy = {
    type: arb.strategy,
    description: arb.description,
    legs: [
      {
        platform: arb.legA.platform,
        market: pair.marketA,
        side: arb.legA.side,
        action: 'BUY',
        targetPrice: arb.legA.price,
        executablePrice: getExecutablePrice(pair.marketA),
        fees: PLATFORM_FEES[arb.legA.platform] || PLATFORM_FEES.polymarket,
        estimatedSlippage: estimateSlippage(
          getExecutablePrice(pair.marketA),
          config.defaultPositionUsd * arb.legA.price
        ),
      },
      {
        platform: arb.legB.platform,
        market: pair.marketB,
        side: arb.legB.side,
        action: 'BUY',
        targetPrice: arb.legB.price,
        executablePrice: getExecutablePrice(pair.marketB),
        fees: PLATFORM_FEES[arb.legB.platform] || PLATFORM_FEES.polymarket,
        estimatedSlippage: estimateSlippage(
          getExecutablePrice(pair.marketB),
          config.defaultPositionUsd * arb.legB.price
        ),
      },
    ],
    guaranteedReturn: 1 / arb.netCost, // $1 payout / $cost
  };

  return {
    id: `arb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(),
    pair,
    strategy,
    netProfitPct: adjustedNetProfitPct,
    grossProfitPct: arb.grossProfitPct,
    totalCosts: costs,
    risk,
    execution,
    confidence,
  };
}

/**
 * Analyze multiple pairs and return valid opportunities
 */
export function findArbitrageOpportunities(
  pairs: ValidatedMarketPair[],
  config: ArbitrageConfig = DEFAULT_ARBITRAGE_CONFIG
): ValidatedArbitrageOpportunity[] {
  const opportunities: ValidatedArbitrageOpportunity[] = [];

  for (const pair of pairs) {
    const opportunity = analyzeArbitrage(pair, config);
    if (opportunity) {
      opportunities.push(opportunity);
    }
  }

  // Sort by net profit (highest first)
  return opportunities.sort((a, b) => b.netProfitPct - a.netProfitPct);
}
