/**
 * Slippage Estimation Module
 *
 * Estimates price slippage based on order book data or liquidity-based models.
 *
 * @author BeRight Protocol
 */

import {
  PlatformMarketData,
  TradeParams,
  SlippageCost,
  EVConfig,
  OrderBookSnapshot,
} from './types';

// =============================================================================
// MAIN SLIPPAGE ESTIMATOR
// =============================================================================

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

// =============================================================================
// ORDER BOOK MODEL
// =============================================================================

/**
 * Estimate slippage from order book
 */
function estimateFromOrderBook(
  orderBook: OrderBookSnapshot,
  trade: TradeParams,
  config: EVConfig
): SlippageCost {
  const orders = trade.side === 'YES' ? orderBook.asks : orderBook.bids;

  if (orders.length === 0) {
    return estimateDefault(trade.amount, config);
  }

  let remaining = trade.amount;
  let totalCost = 0;
  const basePrice = orders[0]?.price || 0.5;

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
    estimatedPct: Math.max(0, slippagePct * config.slippageMultiplier),
    worstCasePct: Math.max(0, slippagePct * config.slippageMultiplier * 2),
    usdAmount: (Math.max(0, slippagePct) / 100) * trade.amount,
    model: 'orderbook',
  };
}

// =============================================================================
// LIQUIDITY-BASED MODEL
// =============================================================================

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

// =============================================================================
// DEFAULT MODEL
// =============================================================================

/**
 * Default slippage estimate when no data available
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

// =============================================================================
// HELPERS
// =============================================================================

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
    dflow: 1.1,         // Order flow auction
    limitless: 1.3,     // Newer, less liquid
  };
  return multipliers[platform] || 1.0;
}

/**
 * Estimate slippage for a specific amount (for finding optimal size)
 */
export function estimateSlippageForAmount(
  liquidity: number,
  amount: number,
  platform: string,
  slippageModel: EVConfig['defaultSlippageModel'] = 'moderate'
): number {
  const impactFactor = getImpactFactor(slippageModel);
  const platformMultiplier = getPlatformSlippageMultiplier(platform);
  const tradeRatio = amount / (liquidity || 10000);

  return Math.min(tradeRatio * impactFactor * platformMultiplier * 100, 20);
}
