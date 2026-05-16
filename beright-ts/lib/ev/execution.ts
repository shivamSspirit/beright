/**
 * Execution Risk Model
 *
 * Assesses the probability of successful trade execution
 * and identifies potential failure modes.
 *
 * @author BeRight Protocol
 */

import { PlatformMarketData, TradeParams, SlippageCost, ExecutionRisk } from './types';

// =============================================================================
// EXECUTION RISK ASSESSMENT
// =============================================================================

/**
 * Assess execution risk for a trade
 */
export function assessExecutionRisk(
  market: PlatformMarketData,
  trade: TradeParams,
  slippage: SlippageCost
): ExecutionRisk {
  let probability = 1.0;
  const failureReasons: string[] = [];

  // 1. Liquidity-based risk
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

  // 2. Slippage-based risk
  if (slippage.estimatedPct > 10) {
    probability *= 0.6;
    failureReasons.push('Very high expected slippage (>10%)');
  } else if (slippage.estimatedPct > 5) {
    probability *= 0.85;
    failureReasons.push('High expected slippage (>5%)');
  } else if (slippage.estimatedPct > 3) {
    probability *= 0.95;
  }

  // 3. Platform-specific risk
  const platformRisk = getPlatformRisk(market.platform);
  probability *= platformRisk.multiplier;
  if (platformRisk.reason) {
    failureReasons.push(platformRisk.reason);
  }

  // 4. Volume-based activity risk
  const volume24h = market.volume24h || 0;
  if (volume24h < 1000) {
    probability *= 0.9;
    failureReasons.push('Low market activity (24h volume < $1000)');
  } else if (volume24h < 5000) {
    probability *= 0.95;
  }

  // 5. Order size relative to typical volume
  if (trade.amount > volume24h * 0.5) {
    probability *= 0.85;
    failureReasons.push('Order larger than 50% of 24h volume');
  }

  // 6. Partial fill risk
  let partialFillRisk = liquidityRatio * 2; // Higher ratio = higher partial fill risk
  partialFillRisk = Math.min(partialFillRisk, 0.9);

  // Add slippage model uncertainty
  if (slippage.model === 'estimated') {
    partialFillRisk = Math.min(partialFillRisk + 0.1, 0.9);
  }

  return {
    probability: Math.max(0.1, Math.min(probability, 1)),
    partialFillRisk,
    failureReasons,
  };
}

// =============================================================================
// PLATFORM RISK
// =============================================================================

/**
 * Platform-specific execution risk
 */
interface PlatformRiskConfig {
  multiplier: number;
  reason?: string;
}

function getPlatformRisk(platform: string): PlatformRiskConfig {
  const risks: Record<string, PlatformRiskConfig> = {
    polymarket: { multiplier: 0.98 },                    // Very reliable
    kalshi: { multiplier: 0.99 },                        // Regulated, reliable
    manifold: { multiplier: 0.95, reason: 'Play money platform - may have quirks' },
    jupiter: { multiplier: 0.92, reason: 'DEX execution risk - may fail on congestion' },
    dflow: { multiplier: 0.90, reason: 'Auction-based execution - variable fill' },
    limitless: { multiplier: 0.85, reason: 'Newer platform - less proven' },
  };

  return risks[platform] || { multiplier: 0.9, reason: 'Unknown platform' };
}

// =============================================================================
// ARBITRAGE EXECUTION RISK
// =============================================================================

/**
 * Assess combined execution risk for arbitrage
 */
export function assessArbitrageExecutionRisk(
  buyRisk: ExecutionRisk,
  sellRisk: ExecutionRisk,
  needsBridge: boolean
): {
  combinedProbability: number;
  riskLevel: 'low' | 'medium' | 'high' | 'very_high';
  allRisks: string[];
  recommendation: string;
} {
  // Combined probability = buy probability * sell probability
  let combinedProbability = buyRisk.probability * sellRisk.probability;

  // Bridge adds additional risk
  if (needsBridge) {
    combinedProbability *= 0.95; // 5% bridge failure risk
  }

  // Combine failure reasons
  const allRisks = [...new Set([...buyRisk.failureReasons, ...sellRisk.failureReasons])];

  if (needsBridge) {
    allRisks.push('Cross-chain bridge required - adds delay and risk');
  }

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'very_high';
  if (combinedProbability > 0.95) {
    riskLevel = 'low';
  } else if (combinedProbability > 0.85) {
    riskLevel = 'medium';
  } else if (combinedProbability > 0.70) {
    riskLevel = 'high';
  } else {
    riskLevel = 'very_high';
  }

  // Generate recommendation
  let recommendation: string;
  switch (riskLevel) {
    case 'low':
      recommendation = 'Execution likely to succeed. Proceed with standard monitoring.';
      break;
    case 'medium':
      recommendation = 'Moderate risk. Consider smaller position or split execution.';
      break;
    case 'high':
      recommendation = 'High risk. Reduce position size significantly or wait for better conditions.';
      break;
    case 'very_high':
      recommendation = 'Very high risk. Not recommended for execution.';
      break;
  }

  return {
    combinedProbability,
    riskLevel,
    allRisks,
    recommendation,
  };
}

// =============================================================================
// TIMING RISK
// =============================================================================

/**
 * Assess timing-related execution risk
 */
export function assessTimingRisk(
  market: PlatformMarketData,
  estimatedExecutionTimeSeconds: number
): {
  priceChangeRisk: number;  // 0-1
  recommendation: string;
} {
  // Higher volume = prices move faster
  const volume24h = market.volume24h || 0;
  const volumePerSecond = volume24h / (24 * 60 * 60);

  // Expected price movement during execution
  // More volume + longer time = higher risk
  const exposureVolume = volumePerSecond * estimatedExecutionTimeSeconds;
  const exposureRatio = exposureVolume / (market.liquidity || 10000);

  // Base risk on exposure
  let priceChangeRisk = Math.min(exposureRatio * 2, 0.5);

  // Adjust for execution time
  if (estimatedExecutionTimeSeconds > 180) {
    priceChangeRisk += 0.1;
  } else if (estimatedExecutionTimeSeconds > 60) {
    priceChangeRisk += 0.05;
  }

  priceChangeRisk = Math.min(priceChangeRisk, 0.9);

  let recommendation: string;
  if (priceChangeRisk < 0.1) {
    recommendation = 'Low timing risk - market stable enough for execution';
  } else if (priceChangeRisk < 0.25) {
    recommendation = 'Moderate timing risk - execute quickly';
  } else if (priceChangeRisk < 0.5) {
    recommendation = 'High timing risk - prices may move during execution';
  } else {
    recommendation = 'Very high timing risk - consider limit orders or smaller size';
  }

  return {
    priceChangeRisk,
    recommendation,
  };
}

// =============================================================================
// FAILURE MODE ANALYSIS
// =============================================================================

/**
 * Identify potential failure modes
 */
export function identifyFailureModes(
  market: PlatformMarketData,
  trade: TradeParams
): Array<{
  mode: string;
  probability: number;
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
}> {
  const modes: Array<{
    mode: string;
    probability: number;
    impact: 'low' | 'medium' | 'high';
    mitigation: string;
  }> = [];

  // 1. Insufficient liquidity
  const liquidityRatio = trade.amount / (market.liquidity || 1);
  if (liquidityRatio > 0.05) {
    modes.push({
      mode: 'Partial fill',
      probability: Math.min(liquidityRatio * 2, 0.8),
      impact: 'medium',
      mitigation: 'Reduce order size or use limit orders',
    });
  }

  // 2. Price movement
  if ((market.volume24h || 0) > 10000) {
    modes.push({
      mode: 'Price slippage beyond estimate',
      probability: 0.15,
      impact: 'low',
      mitigation: 'Use slippage protection / limit orders',
    });
  }

  // 3. Network congestion (on-chain)
  const chain = getChainForPlatform(market.platform);
  if (chain !== 'offchain') {
    modes.push({
      mode: 'Network congestion',
      probability: chain === 'ethereum' ? 0.1 : 0.05,
      impact: chain === 'ethereum' ? 'high' : 'low',
      mitigation: 'Monitor gas prices, set appropriate priority fee',
    });
  }

  // 4. Platform downtime
  modes.push({
    mode: 'Platform unavailable',
    probability: 0.02,
    impact: 'high',
    mitigation: 'Check platform status before large trades',
  });

  return modes;
}

/**
 * Get chain for platform
 */
function getChainForPlatform(platform: string): string {
  const chains: Record<string, string> = {
    polymarket: 'polygon',
    kalshi: 'offchain',
    manifold: 'offchain',
    jupiter: 'solana',
    dflow: 'solana',
    limitless: 'base',
  };
  return chains[platform] || 'unknown';
}
