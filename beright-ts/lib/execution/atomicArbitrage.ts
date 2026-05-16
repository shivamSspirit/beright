/**
 * Atomic Arbitrage Engine
 *
 * Executes cross-platform arbitrage atomically on Solana using:
 * - Jupiter DEX aggregator for unified routing
 * - JITO bundles for MEV protection
 * - Price guards for spread protection
 *
 * Key insight: Traditional arbitrage requires two sequential trades.
 * If price moves between trades, profit can evaporate.
 * Atomic execution locks in the spread at submission time.
 *
 * Based on arXiv:2602.17805 on cross-chain intent analysis.
 *
 * @author BeRight Protocol
 */

import { Platform } from '../dataFabric/types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Arbitrage opportunity
 */
export interface ArbOpportunity {
  eventId: string;
  question: string;

  // Buy leg
  buyPlatform: Platform;
  buyMarketId: string;
  buyPrice: number;
  buyLiquidity: number;

  // Sell leg
  sellPlatform: Platform;
  sellMarketId: string;
  sellPrice: number;
  sellLiquidity: number;

  // Spread
  spread: number;
  spreadPct: number;

  // Estimated costs
  buyFees: number;
  sellFees: number;
  gasEstimate: number;

  // Net profit
  netProfitPct: number;

  // Confidence
  matchConfidence: number;
  executionConfidence: number;
}

/**
 * Execution parameters
 */
export interface AtomicArbParams {
  opportunity: ArbOpportunity;
  maxPositionUsd: number;
  maxSlippage: number;
  minSpreadPct: number;
  jitoTip: number;           // Lamports
  walletAddress: string;
}

/**
 * Execution result
 */
export interface AtomicArbResult {
  success: boolean;
  signature?: string;
  bundleId?: string;

  // Execution details
  buyPrice?: number;
  sellPrice?: number;
  quantity?: number;
  grossProfit?: number;
  fees?: number;
  netProfit?: number;

  // Timing
  latencyMs?: number;
  confirmationSlot?: number;

  // Errors
  error?: string;
  errorCode?: 'SPREAD_COLLAPSED' | 'INSUFFICIENT_LIQUIDITY' | 'JITO_REJECTED' | 'TX_FAILED';
}

/**
 * Price guard instruction
 */
export interface PriceGuard {
  minSpread: number;
  maxSlippage: number;
  expirySlot: number;
}

// =============================================================================
// ATOMIC ARBITRAGE ENGINE
// =============================================================================

export class AtomicArbitrageEngine {
  private isTestMode: boolean;

  constructor(testMode: boolean = true) {
    this.isTestMode = testMode;
  }

  /**
   * Execute atomic arbitrage
   */
  async execute(params: AtomicArbParams): Promise<AtomicArbResult> {
    const startTime = Date.now();
    const { opportunity, maxPositionUsd, maxSlippage, minSpreadPct, jitoTip } = params;

    // Pre-flight checks
    const preflight = this.preflightCheck(opportunity, minSpreadPct);
    if (!preflight.pass) {
      return {
        success: false,
        error: preflight.reason,
        errorCode: 'SPREAD_COLLAPSED',
      };
    }

    try {
      // Calculate optimal size
      const optimalSize = this.calculateOptimalSize(opportunity, maxPositionUsd);

      if (optimalSize < 10) {
        return {
          success: false,
          error: 'Position too small after liquidity adjustment',
          errorCode: 'INSUFFICIENT_LIQUIDITY',
        };
      }

      // In test mode, simulate execution
      if (this.isTestMode) {
        return this.simulateExecution(opportunity, optimalSize, startTime);
      }

      // Production execution
      return await this.executeAtomic(params, optimalSize);

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'TX_FAILED',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Pre-flight validation
   */
  private preflightCheck(
    opp: ArbOpportunity,
    minSpread: number
  ): { pass: boolean; reason?: string } {
    // Check spread still valid
    if (opp.spreadPct < minSpread) {
      return { pass: false, reason: `Spread ${opp.spreadPct.toFixed(2)}% below minimum ${minSpread}%` };
    }

    // Check liquidity
    const minLiquidity = 100; // $100 minimum
    if (opp.buyLiquidity < minLiquidity || opp.sellLiquidity < minLiquidity) {
      return { pass: false, reason: 'Insufficient liquidity' };
    }

    // Check match confidence
    if (opp.matchConfidence < 0.85) {
      return { pass: false, reason: `Match confidence ${opp.matchConfidence.toFixed(2)} too low` };
    }

    // Check execution confidence
    if (opp.executionConfidence < 0.7) {
      return { pass: false, reason: `Execution confidence ${opp.executionConfidence.toFixed(2)} too low` };
    }

    return { pass: true };
  }

  /**
   * Calculate optimal position size based on liquidity
   */
  private calculateOptimalSize(opp: ArbOpportunity, maxSize: number): number {
    // Size limited by minimum liquidity across venues
    const liquidityLimit = Math.min(opp.buyLiquidity, opp.sellLiquidity) * 0.2; // Take max 20% of liquidity

    // Apply Kelly-like sizing based on edge
    const edge = opp.netProfitPct / 100;
    const kellyFraction = Math.min(0.25, edge / (1 - edge)); // Quarter Kelly

    const kellySize = maxSize * kellyFraction;

    return Math.min(maxSize, liquidityLimit, kellySize);
  }

  /**
   * Simulate execution (test mode)
   */
  private simulateExecution(
    opp: ArbOpportunity,
    size: number,
    startTime: number
  ): AtomicArbResult {
    // Simulate realistic execution
    const slippage = Math.random() * 0.02; // 0-2% slippage
    const actualSpread = opp.spreadPct - slippage * 100;

    if (actualSpread < 1) {
      return {
        success: false,
        error: 'Spread collapsed during execution',
        errorCode: 'SPREAD_COLLAPSED',
        latencyMs: Date.now() - startTime,
      };
    }

    const grossProfit = size * (actualSpread / 100);
    const totalFees = opp.buyFees + opp.sellFees + opp.gasEstimate / 100;
    const netProfit = grossProfit - totalFees;

    return {
      success: true,
      signature: `sim_${Date.now().toString(36)}`,
      bundleId: `bundle_${Date.now().toString(36)}`,
      buyPrice: opp.buyPrice * (1 + slippage / 2),
      sellPrice: opp.sellPrice * (1 - slippage / 2),
      quantity: size / opp.buyPrice,
      grossProfit,
      fees: totalFees,
      netProfit,
      latencyMs: Date.now() - startTime,
      confirmationSlot: Math.floor(Math.random() * 1000000),
    };
  }

  /**
   * Execute atomic arbitrage on-chain
   */
  private async executeAtomic(
    params: AtomicArbParams,
    size: number
  ): Promise<AtomicArbResult> {
    const startTime = Date.now();
    const { opportunity, maxSlippage, jitoTip } = params;

    // Build transaction bundle
    const bundle = await this.buildArbBundle(opportunity, size, maxSlippage, jitoTip);

    if (!bundle) {
      return {
        success: false,
        error: 'Failed to build transaction bundle',
        errorCode: 'TX_FAILED',
      };
    }

    // Submit to JITO
    const result = await this.submitJitoBundle(bundle);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        errorCode: 'JITO_REJECTED',
        latencyMs: Date.now() - startTime,
      };
    }

    // Wait for confirmation
    const confirmation = await this.waitForConfirmation(result.bundleId!, 30000);

    if (!confirmation.confirmed) {
      return {
        success: false,
        error: 'Bundle not confirmed',
        errorCode: 'TX_FAILED',
        bundleId: result.bundleId,
        latencyMs: Date.now() - startTime,
      };
    }

    // Calculate actual profit from on-chain data
    const profitData = await this.calculateActualProfit(confirmation.signature!);

    return {
      success: true,
      signature: confirmation.signature,
      bundleId: result.bundleId,
      buyPrice: profitData.buyPrice,
      sellPrice: profitData.sellPrice,
      quantity: profitData.quantity,
      grossProfit: profitData.grossProfit,
      fees: profitData.fees,
      netProfit: profitData.netProfit,
      latencyMs: Date.now() - startTime,
      confirmationSlot: confirmation.slot,
    };
  }

  /**
   * Build arbitrage transaction bundle
   */
  private async buildArbBundle(
    opp: ArbOpportunity,
    size: number,
    maxSlippage: number,
    jitoTip: number
  ): Promise<any | null> {
    try {
      // This would integrate with actual Jupiter/Solana SDK
      // Placeholder for now

      const bundle = {
        instructions: [
          // Price guard instruction
          {
            type: 'price_guard',
            minSpread: opp.spreadPct * 0.8,
            maxSlippage,
          },
          // Buy leg
          {
            type: 'swap',
            direction: 'buy',
            platform: opp.buyPlatform,
            marketId: opp.buyMarketId,
            amount: size,
            maxPrice: opp.buyPrice * (1 + maxSlippage),
          },
          // Sell leg
          {
            type: 'swap',
            direction: 'sell',
            platform: opp.sellPlatform,
            marketId: opp.sellMarketId,
            amount: size,
            minPrice: opp.sellPrice * (1 - maxSlippage),
          },
          // JITO tip
          {
            type: 'jito_tip',
            amount: jitoTip,
          },
        ],
        expirySlot: 'current + 150', // ~60 seconds
      };

      return bundle;
    } catch {
      return null;
    }
  }

  /**
   * Submit bundle to JITO
   */
  private async submitJitoBundle(bundle: any): Promise<{
    success: boolean;
    bundleId?: string;
    error?: string;
  }> {
    // Placeholder for JITO integration
    // Would call actual JITO bundle API

    return {
      success: true,
      bundleId: `bundle_${Date.now().toString(36)}`,
    };
  }

  /**
   * Wait for bundle confirmation
   */
  private async waitForConfirmation(
    bundleId: string,
    timeoutMs: number
  ): Promise<{
    confirmed: boolean;
    signature?: string;
    slot?: number;
  }> {
    // Placeholder - would poll JITO for bundle status

    return {
      confirmed: true,
      signature: `sig_${bundleId}`,
      slot: Math.floor(Math.random() * 1000000),
    };
  }

  /**
   * Calculate actual profit from on-chain data
   */
  private async calculateActualProfit(signature: string): Promise<{
    buyPrice: number;
    sellPrice: number;
    quantity: number;
    grossProfit: number;
    fees: number;
    netProfit: number;
  }> {
    // Placeholder - would parse actual transaction

    return {
      buyPrice: 0.45,
      sellPrice: 0.52,
      quantity: 100,
      grossProfit: 7,
      fees: 0.5,
      netProfit: 6.5,
    };
  }

  /**
   * Estimate profit for an opportunity
   */
  estimateProfit(opp: ArbOpportunity, size: number): {
    grossProfit: number;
    fees: number;
    netProfit: number;
    roi: number;
  } {
    const grossProfit = size * (opp.spreadPct / 100);
    const fees = size * (opp.buyFees + opp.sellFees) + opp.gasEstimate / 100;
    const netProfit = grossProfit - fees;
    const roi = (netProfit / size) * 100;

    return { grossProfit, fees, netProfit, roi };
  }
}

// =============================================================================
// OPPORTUNITY SCANNER
// =============================================================================

/**
 * Scan for arbitrage opportunities
 */
export async function scanForOpportunities(
  markets: {
    eventId: string;
    question: string;
    platforms: {
      platform: Platform;
      marketId: string;
      yesPrice: number;
      liquidity: number;
      fees: number;
    }[];
    matchConfidence: number;
  }[],
  minSpread: number = 0.03
): Promise<ArbOpportunity[]> {
  const opportunities: ArbOpportunity[] = [];

  for (const market of markets) {
    if (market.platforms.length < 2) continue;

    // Find best buy and sell venues
    const sorted = [...market.platforms].sort((a, b) => a.yesPrice - b.yesPrice);

    const buyVenue = sorted[0];
    const sellVenue = sorted[sorted.length - 1];

    const spread = sellVenue.yesPrice - buyVenue.yesPrice;
    const spreadPct = (spread / buyVenue.yesPrice) * 100;

    if (spreadPct >= minSpread * 100) {
      // Calculate net profit after fees
      const totalFees = buyVenue.fees + sellVenue.fees;
      const gasEstimate = 5000; // 5000 lamports ~ $0.00075
      const netProfitPct = spreadPct - totalFees * 100;

      if (netProfitPct > 0) {
        const executionConfidence = calculateExecutionConfidence(buyVenue, sellVenue);

        opportunities.push({
          eventId: market.eventId,
          question: market.question,
          buyPlatform: buyVenue.platform,
          buyMarketId: buyVenue.marketId,
          buyPrice: buyVenue.yesPrice,
          buyLiquidity: buyVenue.liquidity,
          sellPlatform: sellVenue.platform,
          sellMarketId: sellVenue.marketId,
          sellPrice: sellVenue.yesPrice,
          sellLiquidity: sellVenue.liquidity,
          spread,
          spreadPct,
          buyFees: buyVenue.fees,
          sellFees: sellVenue.fees,
          gasEstimate,
          netProfitPct,
          matchConfidence: market.matchConfidence,
          executionConfidence,
        });
      }
    }
  }

  // Sort by net profit
  opportunities.sort((a, b) => b.netProfitPct - a.netProfitPct);

  return opportunities;
}

/**
 * Calculate execution confidence
 */
function calculateExecutionConfidence(
  buyVenue: { platform: Platform; liquidity: number },
  sellVenue: { platform: Platform; liquidity: number }
): number {
  // Platform reliability scores
  const platformReliability: Record<Platform, number> = {
    kalshi: 0.95,
    polymarket: 0.9,
    jupiter: 0.85,
    limitless: 0.8,
    manifold: 0.7,
    metaculus: 0.5,
    prophetx: 0.6,
    novig: 0.55,
    sxbet: 0.6,
    myriad: 0.5,
    baozi: 0.4,
    probable: 0.5,
  };

  const buyReliability = platformReliability[buyVenue.platform] || 0.5;
  const sellReliability = platformReliability[sellVenue.platform] || 0.5;

  // Liquidity score
  const minLiquidity = Math.min(buyVenue.liquidity, sellVenue.liquidity);
  const liquidityScore = Math.min(1, minLiquidity / 10000); // $10k = max score

  // Combined confidence
  return (buyReliability * sellReliability * (0.5 + 0.5 * liquidityScore));
}

// =============================================================================
// SINGLETON
// =============================================================================

let engine: AtomicArbitrageEngine | null = null;

export function getAtomicArbEngine(testMode: boolean = true): AtomicArbitrageEngine {
  if (!engine) {
    engine = new AtomicArbitrageEngine(testMode);
  }
  return engine;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  AtomicArbitrageEngine,
  getAtomicArbEngine,
  scanForOpportunities,
};
