/**
 * Platform Fee Calculator
 *
 * Calculates trading fees for different prediction market platforms.
 * Accounts for fee types (maker/taker, winning, spread) and volume discounts.
 *
 * @author BeRight Protocol
 */

import { PlatformFeeCost } from './types';

// =============================================================================
// PLATFORM FEE CONFIGURATIONS
// =============================================================================

/**
 * Platform fee structures
 */
interface PlatformFeeConfig {
  baseFee: number;           // Base fee %
  feeType: 'maker_taker' | 'spread' | 'winning' | 'flat';
  tiers?: Array<{ minVolume: number; discount: number }>;
  notes: string;
}

const PLATFORM_FEES: Record<string, PlatformFeeConfig> = {
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

// =============================================================================
// FEE CALCULATION
// =============================================================================

/**
 * Calculate platform fee
 */
export function calculatePlatformFee(
  platform: string,
  tradeAmount: number,
  userVolume: number = 0  // Historical volume for tier calculation
): PlatformFeeCost {
  const config = PLATFORM_FEES[platform] || {
    baseFee: 1.0,
    feeType: 'flat' as const,
    notes: 'Unknown platform',
  };

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
 * Calculate fee for arbitrage (both legs)
 */
export function calculateArbitrageFees(
  buyPlatform: string,
  sellPlatform: string,
  amount: number,
  userVolumes?: { buy?: number; sell?: number }
): { buyFee: PlatformFeeCost; sellFee: PlatformFeeCost; totalPct: number; totalUsd: number } {
  const buyFee = calculatePlatformFee(buyPlatform, amount, userVolumes?.buy);
  const sellFee = calculatePlatformFee(sellPlatform, amount, userVolumes?.sell);

  return {
    buyFee,
    sellFee,
    totalPct: buyFee.effectiveFee + sellFee.effectiveFee,
    totalUsd: buyFee.usdAmount + sellFee.usdAmount,
  };
}

// =============================================================================
// FEE INFO
// =============================================================================

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
    case 'flat':
      tips.push('Fixed fee regardless of order type');
      break;
  }

  return {
    description: config.notes,
    feeStructure: `${config.baseFee}% ${config.feeType}`,
    tips,
  };
}

/**
 * Get all platform fees for comparison
 */
export function getAllPlatformFees(): Array<{
  platform: string;
  baseFee: number;
  feeType: string;
  hasTiers: boolean;
}> {
  return Object.entries(PLATFORM_FEES).map(([platform, config]) => ({
    platform,
    baseFee: config.baseFee,
    feeType: config.feeType,
    hasTiers: !!config.tiers,
  }));
}
