/**
 * Liquidity Analysis Module
 *
 * Analyzes market depth and determines safe trading amounts.
 *
 * @author BeRight Protocol
 */

import { PlatformMarketData, LiquidityAnalysis } from './types';

// =============================================================================
// LIQUIDITY ANALYSIS
// =============================================================================

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
  } else if (volume24h < 5000) {
    liquidityScore *= 0.85;
  }

  // Platform-specific adjustments
  const platformMultiplier = getPlatformLiquidityMultiplier(market.platform);
  liquidityScore *= platformMultiplier;

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
  const maxSafeAmount = Math.max(liquidity * 0.05, 10); // Min $10

  return {
    score: Math.round(Math.max(0, Math.min(100, liquidityScore))),
    maxSafeAmount,
    depth,
    warnings,
  };
}

// =============================================================================
// ORDER BOOK ANALYSIS
// =============================================================================

/**
 * Analyze order book depth
 */
export function analyzeOrderBookDepth(
  market: PlatformMarketData,
  side: 'YES' | 'NO'
): {
  totalDepth: number;
  depthAt1Pct: number;
  depthAt2Pct: number;
  depthAt5Pct: number;
  bestPrice: number;
  worstPriceFor: (amount: number) => number;
} {
  if (!market.orderBook) {
    // No order book - estimate from liquidity
    const estimatedDepth = market.liquidity || 10000;
    const currentPrice = side === 'YES' ? market.yesPrice : market.noPrice;

    return {
      totalDepth: estimatedDepth,
      depthAt1Pct: estimatedDepth * 0.3,
      depthAt2Pct: estimatedDepth * 0.5,
      depthAt5Pct: estimatedDepth * 0.8,
      bestPrice: currentPrice,
      worstPriceFor: (amount: number) => {
        const slippage = (amount / estimatedDepth) * 0.1;
        return side === 'YES'
          ? currentPrice * (1 + slippage)
          : currentPrice * (1 - slippage);
      },
    };
  }

  const orders = side === 'YES' ? market.orderBook.asks : market.orderBook.bids;
  const bestPrice = orders[0]?.price || (side === 'YES' ? market.yesPrice : market.noPrice);

  // Calculate depth at various price levels
  let totalDepth = 0;
  let depthAt1Pct = 0;
  let depthAt2Pct = 0;
  let depthAt5Pct = 0;

  for (const order of orders) {
    const priceDiff = Math.abs(order.price - bestPrice) / bestPrice;
    totalDepth += order.size;

    if (priceDiff <= 0.01) depthAt1Pct += order.size;
    if (priceDiff <= 0.02) depthAt2Pct += order.size;
    if (priceDiff <= 0.05) depthAt5Pct += order.size;
  }

  // Calculate worst price for a given amount
  const worstPriceFor = (amount: number): number => {
    let remaining = amount;
    let lastPrice = bestPrice;

    for (const order of orders) {
      if (remaining <= 0) break;
      remaining -= order.size;
      lastPrice = order.price;
    }

    // If couldn't fill entirely, add 10% slippage to last price
    if (remaining > 0) {
      return side === 'YES' ? lastPrice * 1.1 : lastPrice * 0.9;
    }

    return lastPrice;
  };

  return {
    totalDepth,
    depthAt1Pct,
    depthAt2Pct,
    depthAt5Pct,
    bestPrice,
    worstPriceFor,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Platform-specific liquidity quality multiplier
 */
function getPlatformLiquidityMultiplier(platform: string): number {
  const multipliers: Record<string, number> = {
    polymarket: 1.0,    // Established, reliable liquidity
    kalshi: 1.1,        // Regulated, consistent
    manifold: 0.7,      // Play money, less reliable
    jupiter: 0.9,       // DEX, variable
    dflow: 0.85,        // Auction-based
    limitless: 0.8,     // Newer platform
  };
  return multipliers[platform] || 0.9;
}

/**
 * Calculate volume-to-liquidity ratio (activity indicator)
 */
export function calculateTurnoverRatio(market: PlatformMarketData): number {
  if (!market.liquidity || market.liquidity === 0) return 0;
  return (market.volume24h || 0) / market.liquidity;
}

/**
 * Determine if market is active enough for trading
 */
export function isMarketActive(market: PlatformMarketData): {
  active: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  let active = true;

  if ((market.volume24h || 0) < 100) {
    reasons.push('Very low 24h volume (<$100)');
    active = false;
  }

  if ((market.liquidity || 0) < 1000) {
    reasons.push('Very low liquidity (<$1000)');
    active = false;
  }

  const turnover = calculateTurnoverRatio(market);
  if (turnover < 0.01) {
    reasons.push('Low turnover - may be stale market');
  }

  return { active, reasons };
}

/**
 * Compare liquidity across platforms for arbitrage
 */
export function compareLiquidity(
  markets: PlatformMarketData[]
): {
  bestLiquidity: PlatformMarketData;
  worstLiquidity: PlatformMarketData;
  avgLiquidity: number;
  minSafeAmount: number;
} {
  if (markets.length === 0) {
    throw new Error('No markets to compare');
  }

  const sorted = [...markets].sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0));
  const avgLiquidity = markets.reduce((sum, m) => sum + (m.liquidity || 0), 0) / markets.length;

  // Min safe amount is constrained by the least liquid market
  const minLiquidity = sorted[sorted.length - 1].liquidity || 0;
  const minSafeAmount = Math.max(minLiquidity * 0.05, 10);

  return {
    bestLiquidity: sorted[0],
    worstLiquidity: sorted[sorted.length - 1],
    avgLiquidity,
    minSafeAmount,
  };
}
