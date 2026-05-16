/**
 * Kelly Criterion Position Sizing
 *
 * Optimal position sizing based on edge and bankroll.
 * "Bet big when you have edge, small when you don't."
 *
 * @author BeRight Protocol
 */

import {
  KellyInput,
  KellyOutput,
  RiskConfig,
  DEFAULT_RISK_CONFIG,
} from './types';

// =============================================================================
// KELLY CRITERION
// =============================================================================

/**
 * Calculate Kelly criterion for binary prediction market
 *
 * Kelly formula for binary outcomes:
 * f* = (bp - q) / b
 *
 * Where:
 * - f* = fraction of bankroll to bet
 * - b = odds received on the bet (payout per $1)
 * - p = probability of winning
 * - q = probability of losing (1 - p)
 *
 * For prediction markets at price P:
 * - If betting YES at price P: b = (1-P)/P, p = model probability
 * - If betting NO at price P: b = P/(1-P), p = 1 - model probability
 */
export function calculateKelly(
  input: KellyInput,
  config: RiskConfig = DEFAULT_RISK_CONFIG
): KellyOutput {
  const { probability, marketPrice, confidence, portfolioValue, currentExposure } = input;

  // Calculate edge
  const edge = probability - marketPrice;
  const absEdge = Math.abs(edge);

  // Determine direction
  const bettingYes = edge > 0;
  const effectiveProb = bettingYes ? probability : 1 - probability;
  const effectivePrice = bettingYes ? marketPrice : 1 - marketPrice;

  // Calculate odds (payout per $1 risked)
  // At price P, betting YES: pay P, win 1, so odds = (1-P)/P
  const odds = effectivePrice > 0 && effectivePrice < 1
    ? (1 - effectivePrice) / effectivePrice
    : 0;

  // Kelly formula: f* = (bp - q) / b
  const q = 1 - effectiveProb;
  let fullKelly = odds > 0 ? (odds * effectiveProb - q) / odds : 0;

  // Adjust for confidence
  // Lower confidence = more conservative sizing
  fullKelly *= confidence;

  // Clamp to reasonable range
  fullKelly = Math.max(0, Math.min(fullKelly, 0.5)); // Max 50% kelly

  // Calculate fractional kelly amounts
  const halfKelly = fullKelly / 2;
  const quarterKelly = fullKelly / 4;
  const suggestedFraction = fullKelly * config.kellyFraction;

  // Convert to dollar amounts
  const availableForBetting = Math.max(0, portfolioValue - currentExposure);
  const fullKellyDollars = fullKelly * portfolioValue;
  const suggestedDollars = suggestedFraction * portfolioValue;

  // Apply risk limits
  let maxAllowedDollars = Math.min(
    config.maxPositionSize,
    portfolioValue * config.maxPositionPct,
    availableForBetting
  );

  // Check total exposure limit
  const remainingExposureRoom = Math.max(
    0,
    portfolioValue * config.maxExposurePct - currentExposure
  );
  maxAllowedDollars = Math.min(maxAllowedDollars, remainingExposureRoom);

  // Calculate expected value
  const expectedValue = effectiveProb * (1 - effectivePrice) - (1 - effectiveProb) * effectivePrice;

  // Calculate variance reduction from using fractional kelly
  const varianceReduction = fullKelly > 0
    ? 1 - (suggestedFraction / fullKelly)
    : 0;

  // Generate reasoning
  const reasoning = generateKellyReasoning(
    edge,
    fullKelly,
    suggestedFraction,
    confidence,
    fullKellyDollars,
    suggestedDollars,
    maxAllowedDollars,
    config
  );

  return {
    fullKelly,
    halfKelly,
    quarterKelly,
    suggestedFraction,
    fullKellyDollars,
    suggestedDollars: Math.min(suggestedDollars, maxAllowedDollars),
    maxAllowedDollars,
    edge,
    expectedValue,
    varianceReduction,
    reasoning,
  };
}

/**
 * Generate reasoning for Kelly output
 */
function generateKellyReasoning(
  edge: number,
  fullKelly: number,
  suggestedFraction: number,
  confidence: number,
  fullKellyDollars: number,
  suggestedDollars: number,
  maxAllowedDollars: number,
  config: RiskConfig
): string {
  const parts: string[] = [];

  // Edge assessment
  if (Math.abs(edge) < config.minEdgeForTrade) {
    parts.push(`Edge of ${(edge * 100).toFixed(1)}% is below minimum threshold of ${(config.minEdgeForTrade * 100).toFixed(0)}%.`);
    parts.push('No position recommended.');
    return parts.join(' ');
  }

  parts.push(`Edge: ${(edge * 100).toFixed(1)}% ${edge > 0 ? '(YES underpriced)' : '(NO underpriced)'}.`);

  // Kelly analysis
  parts.push(`Full Kelly: ${(fullKelly * 100).toFixed(1)}% of portfolio ($${fullKellyDollars.toFixed(0)}).`);

  // Confidence adjustment
  if (confidence < 1) {
    parts.push(`Adjusted for ${(confidence * 100).toFixed(0)}% confidence.`);
  }

  // Fractional kelly
  parts.push(
    `Using ${(config.kellyFraction * 100).toFixed(0)}% Kelly suggests $${suggestedDollars.toFixed(0)}.`
  );

  // Risk limits
  if (suggestedDollars > maxAllowedDollars) {
    parts.push(`Capped at $${maxAllowedDollars.toFixed(0)} due to risk limits.`);
  }

  return parts.join(' ');
}

// =============================================================================
// MULTI-POSITION KELLY
// =============================================================================

/**
 * Input for multi-position Kelly
 */
export interface MultiKellyInput {
  positions: {
    marketId: string;
    probability: number;
    marketPrice: number;
    confidence: number;
    correlation?: number;            // Correlation with other positions
  }[];
  portfolioValue: number;
  currentExposure: number;
}

/**
 * Output for multi-position Kelly
 */
export interface MultiKellyOutput {
  allocations: {
    marketId: string;
    suggestedDollars: number;
    suggestedFraction: number;
    edge: number;
  }[];
  totalAllocation: number;
  diversificationBenefit: number;
  reasoning: string;
}

/**
 * Calculate Kelly for multiple positions (simplified)
 *
 * For correlated bets, optimal sizing is reduced.
 * This is a simplified approach - full solution requires
 * solving quadratic optimization problem.
 */
export function calculateMultiKelly(
  input: MultiKellyInput,
  config: RiskConfig = DEFAULT_RISK_CONFIG
): MultiKellyOutput {
  const { positions, portfolioValue, currentExposure } = input;

  // Calculate individual Kelly for each position
  const individualKellys = positions.map(pos => {
    const kelly = calculateKelly({
      probability: pos.probability,
      marketPrice: pos.marketPrice,
      confidence: pos.confidence,
      portfolioValue,
      currentExposure,
    }, config);

    return {
      marketId: pos.marketId,
      kelly,
      correlation: pos.correlation || 0,
    };
  });

  // Sum of individual kellys
  const totalIndividualKelly = individualKellys.reduce(
    (sum, k) => sum + k.kelly.suggestedFraction,
    0
  );

  // Calculate average correlation
  const avgCorrelation = individualKellys.reduce(
    (sum, k) => sum + Math.abs(k.correlation),
    0
  ) / Math.max(1, individualKellys.length);

  // Diversification adjustment
  // Higher correlation = less diversification = reduce sizing
  const diversificationFactor = 1 - avgCorrelation * 0.5;

  // Scale down if total exceeds limits
  const maxTotalFraction = config.maxExposurePct;
  const scaleFactor = totalIndividualKelly > maxTotalFraction
    ? maxTotalFraction / totalIndividualKelly
    : 1;

  const finalScaleFactor = scaleFactor * diversificationFactor;

  // Apply scaling
  const allocations = individualKellys.map(k => ({
    marketId: k.marketId,
    suggestedDollars: k.kelly.suggestedDollars * finalScaleFactor,
    suggestedFraction: k.kelly.suggestedFraction * finalScaleFactor,
    edge: k.kelly.edge,
  }));

  const totalAllocation = allocations.reduce(
    (sum, a) => sum + a.suggestedFraction,
    0
  );

  const diversificationBenefit = 1 - finalScaleFactor / scaleFactor;

  // Generate reasoning
  let reasoning = `Analyzing ${positions.length} positions. `;
  reasoning += `Total individual Kelly: ${(totalIndividualKelly * 100).toFixed(1)}%. `;

  if (avgCorrelation > 0.1) {
    reasoning += `Average correlation: ${(avgCorrelation * 100).toFixed(0)}%, reducing allocation. `;
  }

  if (scaleFactor < 1) {
    reasoning += `Scaled to ${(maxTotalFraction * 100).toFixed(0)}% max exposure. `;
  }

  reasoning += `Final allocation: ${(totalAllocation * 100).toFixed(1)}% of portfolio.`;

  return {
    allocations,
    totalAllocation,
    diversificationBenefit,
    reasoning,
  };
}

// =============================================================================
// POSITION SIZING HELPERS
// =============================================================================

/**
 * Calculate optimal bet size for a given risk level
 */
export function calculateOptimalSize(
  edge: number,
  confidence: number,
  portfolioValue: number,
  riskLevel: 'conservative' | 'moderate' | 'aggressive'
): number {
  const kellyFractions = {
    conservative: 0.1,    // 10% kelly
    moderate: 0.25,       // 25% kelly
    aggressive: 0.5,      // 50% kelly
  };

  const kellyFraction = kellyFractions[riskLevel];

  // Simplified kelly for edge
  const rawKelly = Math.abs(edge) * confidence;
  const adjustedKelly = rawKelly * kellyFraction;

  return portfolioValue * adjustedKelly;
}

/**
 * Calculate number of shares/contracts for a dollar amount
 */
export function calculateShares(
  dollarAmount: number,
  price: number,
  side: 'YES' | 'NO'
): number {
  // In prediction markets, you pay the price for YES shares
  // For NO, you pay 1 - price
  const effectivePrice = side === 'YES' ? price : 1 - price;

  if (effectivePrice <= 0 || effectivePrice >= 1) return 0;

  return dollarAmount / effectivePrice;
}

/**
 * Calculate cost basis for a position
 */
export function calculateCostBasis(
  shares: number,
  avgPrice: number,
  side: 'YES' | 'NO'
): number {
  const effectivePrice = side === 'YES' ? avgPrice : 1 - avgPrice;
  return shares * effectivePrice;
}

export default {
  calculateKelly,
  calculateMultiKelly,
  calculateOptimalSize,
  calculateShares,
  calculateCostBasis,
};
