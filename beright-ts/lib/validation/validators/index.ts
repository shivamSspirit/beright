/**
 * Trust Engine Validators
 *
 * Six core validation checks for prediction market data:
 * 1. Existence - Market URL responds (market actually exists)
 * 2. Freshness - Data is recent (<5 minutes old)
 * 3. Price Oracle - Crypto prices match external oracles
 * 4. Arbitrage Math - YES + NO ≈ 1, spreads are valid
 * 5. Historical - No suspicious price spikes
 * 6. Cross-Platform - Consistent pricing across platforms
 *
 * @author BeRight Protocol
 * @version 1.0.0
 */

import {
  RawMarketData,
  ValidationCheck,
  ValidationContext,
  ValidationRule,
  FRESHNESS_THRESHOLDS,
} from '../../data/types';

// =============================================================================
// 1. EXISTENCE VALIDATOR
// =============================================================================

/**
 * Validates that a market actually exists by checking its URL
 * Returns 404 check result
 */
async function validateExistence(
  market: RawMarketData,
  _context?: ValidationContext
): Promise<ValidationCheck> {
  const name = 'existence';

  // If no URL, we can't validate existence via URL
  if (!market.url) {
    return {
      name,
      passed: true, // Assume exists if we got data from API
      confidence: 70,
      message: 'No URL available for existence check',
    };
  }

  try {
    // Use HEAD request for speed (we don't need the content)
    const response = await fetch(market.url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    });

    if (response.ok) {
      return {
        name,
        passed: true,
        confidence: 100,
        message: 'Market URL is accessible',
      };
    }

    // 404 = market doesn't exist
    if (response.status === 404) {
      return {
        name,
        passed: false,
        confidence: 100,
        message: `Market not found (404): ${market.url}`,
        details: { status: response.status },
      };
    }

    // Other errors are suspicious but not definitive
    return {
      name,
      passed: true,
      confidence: 60,
      message: `URL returned status ${response.status}`,
      details: { status: response.status },
    };
  } catch (error) {
    // Network errors - could be temporary
    return {
      name,
      passed: true,
      confidence: 50,
      message: `Could not verify URL: ${error instanceof Error ? error.message : 'Network error'}`,
    };
  }
}

// =============================================================================
// 2. FRESHNESS VALIDATOR
// =============================================================================

/**
 * Validates that data is recent (not stale)
 */
async function validateFreshness(
  market: RawMarketData,
  _context?: ValidationContext
): Promise<ValidationCheck> {
  const name = 'freshness';

  const now = Date.now();
  const fetchedAt = market.fetchedAt.getTime();
  const ageSeconds = (now - fetchedAt) / 1000;

  if (ageSeconds < FRESHNESS_THRESHOLDS.fresh) {
    return {
      name,
      passed: true,
      confidence: 100,
      message: `Data is fresh (${Math.round(ageSeconds)}s old)`,
      details: { ageSeconds },
    };
  }

  if (ageSeconds < FRESHNESS_THRESHOLDS.acceptable) {
    return {
      name,
      passed: true,
      confidence: 85,
      message: `Data is acceptable (${Math.round(ageSeconds / 60)}m old)`,
      details: { ageSeconds },
    };
  }

  if (ageSeconds < FRESHNESS_THRESHOLDS.stale) {
    return {
      name,
      passed: true,
      confidence: 60,
      message: `Data is getting stale (${Math.round(ageSeconds / 60)}m old)`,
      details: { ageSeconds },
    };
  }

  if (ageSeconds < FRESHNESS_THRESHOLDS.expired) {
    return {
      name,
      passed: false,
      confidence: 30,
      message: `Data is stale (${Math.round(ageSeconds / 60)}m old) - consider refreshing`,
      details: { ageSeconds },
    };
  }

  // Expired data
  return {
    name,
    passed: false,
    confidence: 0,
    message: `Data is expired (${Math.round(ageSeconds / 60)}m old) - filter out`,
    details: { ageSeconds },
  };
}

// =============================================================================
// 3. PRICE ORACLE VALIDATOR
// =============================================================================

/**
 * Validates crypto price markets against oracle data
 * e.g., "Will BTC be above $70k?" when BTC is at $68k should have reasonable odds
 */
async function validatePriceOracle(
  market: RawMarketData,
  context?: ValidationContext
): Promise<ValidationCheck> {
  const name = 'priceOracle';

  // Only relevant for crypto price markets
  const title = market.title.toLowerCase();

  // Check if this is a crypto price market
  const btcMatch = title.match(/bitcoin|btc/i);
  const ethMatch = title.match(/ethereum|eth(?!er)/i);

  if (!btcMatch && !ethMatch) {
    // Not a crypto price market - skip validation
    return {
      name,
      passed: true,
      confidence: 100,
      message: 'Not a crypto price market - N/A',
    };
  }

  // Extract price threshold from title
  // Patterns like "above $70,000", "below $60k", "hit $100,000"
  const priceMatch = title.match(/(?:above|below|hit|reach|exceed)\s*\$?([\d,]+)k?/i);

  if (!priceMatch) {
    // Can't extract price threshold
    return {
      name,
      passed: true,
      confidence: 80,
      message: 'Could not extract price threshold - assuming valid',
    };
  }

  let threshold = parseFloat(priceMatch[1].replace(/,/g, ''));
  if (title.includes('k')) {
    threshold *= 1000;
  }

  // Get oracle price from context
  const oraclePrice = context?.oraclePrice;

  if (!oraclePrice) {
    return {
      name,
      passed: true,
      confidence: 70,
      message: 'No oracle price available for comparison',
    };
  }

  // Validate pricing logic
  const isAboveMarket = title.includes('above') || title.includes('hit') || title.includes('reach');
  const currentlyAbove = oraclePrice > threshold;

  // If current price is already above threshold, YES should be high
  // If current price is below threshold, YES should reflect probability of reaching it
  if (isAboveMarket) {
    if (currentlyAbove && market.yesPrice < 0.5) {
      // Price is already above threshold but market says <50% - suspicious
      return {
        name,
        passed: false,
        confidence: 80,
        message: `Price inconsistency: Oracle shows $${oraclePrice.toLocaleString()} (already above $${threshold.toLocaleString()}), but market is only ${(market.yesPrice * 100).toFixed(1)}%`,
        details: { oraclePrice, threshold, marketPrice: market.yesPrice },
      };
    }

    if (!currentlyAbove && market.yesPrice > 0.95) {
      // Price is below threshold but market says >95% - suspicious
      return {
        name,
        passed: false,
        confidence: 75,
        message: `Price inconsistency: Oracle shows $${oraclePrice.toLocaleString()} (below $${threshold.toLocaleString()}), but market is at ${(market.yesPrice * 100).toFixed(1)}%`,
        details: { oraclePrice, threshold, marketPrice: market.yesPrice },
      };
    }
  }

  return {
    name,
    passed: true,
    confidence: 90,
    message: `Oracle price ($${oraclePrice.toLocaleString()}) validates market pricing`,
    details: { oraclePrice, threshold, marketPrice: market.yesPrice },
  };
}

// =============================================================================
// 4. ARBITRAGE MATH VALIDATOR
// =============================================================================

/**
 * Validates that YES + NO ≈ 1 and spreads are reasonable
 */
async function validateArbitrageMath(
  market: RawMarketData,
  _context?: ValidationContext
): Promise<ValidationCheck> {
  const name = 'arbitrageMath';

  const { yesPrice, noPrice, yesBid, yesAsk, noBid, noAsk } = market;

  // Check YES + NO = 1 (within tolerance)
  const sum = yesPrice + noPrice;
  const tolerance = 0.05; // 5% tolerance for fees/spreads

  if (sum < 1 - tolerance || sum > 1 + tolerance) {
    return {
      name,
      passed: false,
      confidence: 90,
      message: `Invalid pricing: YES (${(yesPrice * 100).toFixed(1)}%) + NO (${(noPrice * 100).toFixed(1)}%) = ${(sum * 100).toFixed(1)}% (expected ~100%)`,
      details: { yesPrice, noPrice, sum },
    };
  }

  // If we have orderbook data, check spread
  if (yesBid && yesAsk) {
    const spread = yesAsk - yesBid;

    // Very wide spreads (>30%) are suspicious
    if (spread > 0.3) {
      return {
        name,
        passed: true,
        confidence: 70,
        message: `Wide spread detected: ${(spread * 100).toFixed(1)}% - low liquidity`,
        details: { spread, yesBid, yesAsk },
      };
    }

    // Negative spread is impossible - data error
    if (spread < 0) {
      return {
        name,
        passed: false,
        confidence: 100,
        message: `Invalid spread: Bid (${(yesBid * 100).toFixed(1)}%) > Ask (${(yesAsk * 100).toFixed(1)}%)`,
        details: { spread, yesBid, yesAsk },
      };
    }
  }

  // Valid pricing
  return {
    name,
    passed: true,
    confidence: 95,
    message: 'Pricing math is valid',
    details: { yesPrice, noPrice, sum },
  };
}

// =============================================================================
// 5. HISTORICAL VALIDATOR
// =============================================================================

/**
 * Validates that price changes aren't suspiciously large
 * Catches data errors and potential manipulation
 */
async function validateHistorical(
  market: RawMarketData,
  context?: ValidationContext
): Promise<ValidationCheck> {
  const name = 'historical';

  const previousPrice = context?.previousPrice;

  if (previousPrice === undefined) {
    // No previous price to compare
    return {
      name,
      passed: true,
      confidence: 80,
      message: 'No historical data for comparison',
    };
  }

  const change = Math.abs(market.yesPrice - previousPrice);
  const changePct = change * 100;

  // Unusual thresholds
  const SPIKE_THRESHOLD = 0.2;      // 20% change is unusual
  const EXTREME_THRESHOLD = 0.4;    // 40% change is extreme

  if (change >= EXTREME_THRESHOLD) {
    return {
      name,
      passed: false,
      confidence: 85,
      message: `Extreme price movement: ${changePct.toFixed(1)}% change - likely data error`,
      details: { previousPrice, currentPrice: market.yesPrice, change },
    };
  }

  if (change >= SPIKE_THRESHOLD) {
    return {
      name,
      passed: true,
      confidence: 70,
      message: `Unusual price movement: ${changePct.toFixed(1)}% change - verify before trading`,
      details: { previousPrice, currentPrice: market.yesPrice, change },
    };
  }

  return {
    name,
    passed: true,
    confidence: 95,
    message: `Normal price movement: ${changePct.toFixed(1)}% change`,
    details: { previousPrice, currentPrice: market.yesPrice, change },
  };
}

// =============================================================================
// 6. CROSS-PLATFORM VALIDATOR
// =============================================================================

/**
 * Validates pricing consistency across platforms for the same market
 */
async function validateCrossPlatform(
  market: RawMarketData,
  context?: ValidationContext
): Promise<ValidationCheck> {
  const name = 'crossPlatform';

  const existingMarkets = context?.existingMarkets;

  if (!existingMarkets || existingMarkets.size === 0) {
    return {
      name,
      passed: true,
      confidence: 80,
      message: 'No cross-platform data for comparison',
    };
  }

  // Find similar markets on other platforms
  const marketTitle = market.title.toLowerCase();
  const priceDiscrepancies: Array<{
    platform: string;
    price: number;
    spread: number;
  }> = [];

  for (const [key, otherMarket] of existingMarkets.entries()) {
    if (otherMarket.platform === market.platform) continue;
    if (otherMarket.id === market.id) continue;

    // Simple title similarity check
    const otherTitle = otherMarket.title.toLowerCase();
    const titleSimilarity = calculateTitleSimilarity(marketTitle, otherTitle);

    if (titleSimilarity > 0.7) {
      const spread = Math.abs(market.yesPrice - otherMarket.yesPrice);

      priceDiscrepancies.push({
        platform: otherMarket.platform,
        price: otherMarket.yesPrice,
        spread,
      });
    }
  }

  if (priceDiscrepancies.length === 0) {
    return {
      name,
      passed: true,
      confidence: 80,
      message: 'No matching markets found on other platforms',
    };
  }

  // Check for large discrepancies
  const maxSpread = Math.max(...priceDiscrepancies.map(d => d.spread));

  if (maxSpread > 0.15) {
    // >15% spread is suspicious but could be arbitrage opportunity
    return {
      name,
      passed: true,
      confidence: 65,
      message: `Large cross-platform spread detected: ${(maxSpread * 100).toFixed(1)}%`,
      details: { discrepancies: priceDiscrepancies },
    };
  }

  return {
    name,
    passed: true,
    confidence: 95,
    message: 'Cross-platform pricing is consistent',
    details: { discrepancies: priceDiscrepancies },
  };
}

/**
 * Simple title similarity calculation
 */
function calculateTitleSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 2));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let matches = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) matches++;
  }

  return matches / Math.max(wordsA.size, wordsB.size);
}

// =============================================================================
// VALIDATION RULES CONFIGURATION
// =============================================================================

/**
 * All validation rules with weights and requirements
 */
export const VALIDATION_RULES: ValidationRule[] = [
  {
    name: 'freshness',
    weight: 0.25,      // 25% of score
    required: false,   // Stale data is warned, not filtered
    validator: validateFreshness,
  },
  {
    name: 'arbitrageMath',
    weight: 0.25,      // 25% of score
    required: true,    // Invalid math = filter out
    validator: validateArbitrageMath,
  },
  {
    name: 'existence',
    weight: 0.15,      // 15% of score
    required: true,    // 404 = filter out
    validator: validateExistence,
  },
  {
    name: 'priceOracle',
    weight: 0.15,      // 15% of score
    required: false,   // Inconsistency is warned, not filtered
    validator: validatePriceOracle,
  },
  {
    name: 'historical',
    weight: 0.10,      // 10% of score
    required: false,   // Spikes are warned
    validator: validateHistorical,
  },
  {
    name: 'crossPlatform',
    weight: 0.10,      // 10% of score
    required: false,   // Discrepancies are noted
    validator: validateCrossPlatform,
  },
];

// =============================================================================
// EXPORTS
// =============================================================================

export {
  validateExistence,
  validateFreshness,
  validatePriceOracle,
  validateArbitrageMath,
  validateHistorical,
  validateCrossPlatform,
};
