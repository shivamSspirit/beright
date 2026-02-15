/**
 * Arbitrage Service
 *
 * Core business logic for arbitrage detection and monitoring.
 * Scans markets across platforms for pricing discrepancies.
 */

import type { MarketAggregator, MarketComparison } from '../../domain/ports/providers/MarketProvider';
import type { Market } from '../../domain/entities/Market';
import type { ArbitrageOpportunity } from '../../domain/entities/ArbitrageOpportunity';
import { ArbitrageOpportunity as ArbitrageEntity } from '../../domain/entities/ArbitrageOpportunity';
import type { Platform } from '../../shared/types/Common';
import type { Result } from '../../shared/types/Result';
import { Result as ResultHelper } from '../../shared/types/Result';
import { AppError } from '../../shared/errors/AppError';

/**
 * Arbitrage scan result
 */
export interface ArbitrageScanResult {
  scannedAt: Date;
  marketsScanned: number;
  opportunitiesFound: number;
  opportunities: ArbitrageOpportunity[];
  errors: string[];
}

/**
 * Arbitrage alert
 */
export interface ArbitrageAlert {
  opportunity: ArbitrageOpportunity;
  alertedAt: Date;
  expiresAt: Date;
}

/**
 * Arbitrage Service Interface
 */
export interface IArbitrageService {
  scanForOpportunities(query?: string, minSpread?: number): Promise<Result<ArbitrageScanResult, AppError>>;
  getActiveOpportunities(): Promise<Result<ArbitrageOpportunity[], AppError>>;
  monitorMarkets(topics: string[]): Promise<Result<ArbitrageAlert[], AppError>>;
  calculatePotentialProfit(opportunity: ArbitrageOpportunity, stake: number): ProfitCalculation;
}

export interface ProfitCalculation {
  stake: number;
  potentialProfit: number;
  profitPercent: number;
  breakEvenPrice: number;
  fees: number;
  netProfit: number;
}

/**
 * Arbitrage Service Implementation
 */
export class ArbitrageService implements IArbitrageService {
  private activeOpportunities: Map<string, ArbitrageOpportunity> = new Map();
  private readonly opportunityTtlMs = 5 * 60 * 1000; // 5 minutes

  constructor(
    private aggregator: MarketAggregator,
    private minSpreadDefault = 0.03 // 3% minimum spread
  ) {}

  /**
   * Scan for arbitrage opportunities
   */
  async scanForOpportunities(
    query?: string,
    minSpread?: number
  ): Promise<Result<ArbitrageScanResult, AppError>> {
    const spread = minSpread || this.minSpreadDefault;
    const errors: string[] = [];

    try {
      let comparisons: MarketComparison[];

      if (query) {
        // Search specific topic
        const result = await this.aggregator.compareMarkets(query);
        if (result.ok === false) {
          return ResultHelper.err(result.error);
        }
        comparisons = result.value;
      } else {
        // Scan hot markets
        const hotResult = await this.aggregator.getHotAll(20);
        if (hotResult.ok === false) {
          return ResultHelper.err(hotResult.error);
        }

        // Group by similar topics and compare
        const markets = hotResult.value;
        comparisons = this.groupAndCompare(markets);
      }

      // Filter for actual arbitrage opportunities
      const opportunities: ArbitrageOpportunity[] = [];

      for (const comparison of comparisons) {
        if (!comparison.hasArbitrage || comparison.maxSpread < spread) {
          continue;
        }

        if (comparison.markets.length < 2) {
          continue;
        }

        // Create arbitrage opportunity from markets
        const oppResult = this.createOpportunityFromComparison(comparison);
        if (oppResult.ok) {
          opportunities.push(oppResult.value);
          this.activeOpportunities.set(oppResult.value.id, oppResult.value);
        }
      }

      // Sort by profit potential
      opportunities.sort((a, b) => b.profitPercent - a.profitPercent);

      return ResultHelper.ok({
        scannedAt: new Date(),
        marketsScanned: comparisons.reduce((sum, c) => sum + c.markets.length, 0),
        opportunitiesFound: opportunities.length,
        opportunities,
        errors,
      });
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error scanning for arbitrage'
      ));
    }
  }

  /**
   * Get currently active opportunities
   */
  async getActiveOpportunities(): Promise<Result<ArbitrageOpportunity[], AppError>> {
    // Clean expired opportunities
    for (const [id, opp] of this.activeOpportunities) {
      if (!opp.isValid) {
        this.activeOpportunities.delete(id);
      }
    }

    const opportunities = Array.from(this.activeOpportunities.values());

    // Sort by profit
    opportunities.sort((a, b) => b.profitPercent - a.profitPercent);

    return ResultHelper.ok(opportunities);
  }

  /**
   * Monitor specific topics for arbitrage
   */
  async monitorMarkets(topics: string[]): Promise<Result<ArbitrageAlert[], AppError>> {
    const alerts: ArbitrageAlert[] = [];

    for (const topic of topics) {
      const result = await this.scanForOpportunities(topic);

      if (result.ok && result.value.opportunities.length > 0) {
        for (const opp of result.value.opportunities) {
          alerts.push({
            opportunity: opp,
            alertedAt: new Date(),
            expiresAt: opp.expiresAt,
          });
        }
      }
    }

    return ResultHelper.ok(alerts);
  }

  /**
   * Calculate potential profit for an opportunity
   */
  calculatePotentialProfit(
    opportunity: ArbitrageOpportunity,
    stake: number
  ): ProfitCalculation {
    const priceA = opportunity.priceAYes.value;
    const priceB = opportunity.priceBYes.value;

    // Simple calculation: buy YES on cheaper, buy NO on more expensive
    // For $100 stake split evenly:
    // - Buy YES shares at lower price
    // - Buy NO shares at higher price
    // - One of them will pay out $1 per share

    const halfStake = stake / 2;

    // Determine which market has cheaper YES
    const [cheaperPrice, expensivePrice] = priceA < priceB
      ? [priceA, priceB]
      : [priceB, priceA];

    // Shares purchased
    const yesShares = halfStake / cheaperPrice;
    const noShares = halfStake / (1 - expensivePrice); // NO price is 1 - YES price

    // Guaranteed payout (one pays $1 per share)
    const minPayout = Math.min(yesShares, noShares);

    // Total cost
    const totalCost = stake;

    // Estimated fees (2% per platform)
    const fees = totalCost * 0.02;

    // Gross profit
    const grossProfit = minPayout - totalCost;

    // Net profit after fees
    const netProfit = grossProfit - fees;

    return {
      stake,
      potentialProfit: grossProfit,
      profitPercent: (grossProfit / totalCost) * 100,
      breakEvenPrice: totalCost / (yesShares + noShares),
      fees,
      netProfit,
    };
  }

  /**
   * Group markets by similarity and create comparisons
   */
  private groupAndCompare(markets: Market[]): MarketComparison[] {
    const groups: Map<string, Market[]> = new Map();

    // Group by normalized title
    for (const market of markets) {
      const key = this.normalizeTitle(market.title);

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      const group = groups.get(key);
      if (group) {
        group.push(market);
      }
    }

    // Create comparisons for groups with multiple markets
    const comparisons: MarketComparison[] = [];

    for (const [topic, groupMarkets] of groups) {
      if (groupMarkets.length < 2) continue;

      // Check if different platforms
      const platforms = new Set(groupMarkets.map(m => m.platform));
      if (platforms.size < 2) continue;

      const prices = groupMarkets.map(m => m.yesPrice.value);
      const maxSpread = Math.max(...prices) - Math.min(...prices);

      comparisons.push({
        topic,
        markets: groupMarkets,
        maxSpread,
        hasArbitrage: maxSpread >= this.minSpreadDefault,
        matchConfidence: 0.9, // High confidence since we're using exact matching
      });
    }

    return comparisons;
  }

  /**
   * Create arbitrage opportunity from market comparison
   */
  private createOpportunityFromComparison(
    comparison: MarketComparison
  ): Result<ArbitrageOpportunity, AppError> {
    if (comparison.markets.length < 2) {
      return ResultHelper.err(AppError.validation('Need at least 2 markets'));
    }

    // Sort by price to find best buy/sell sides
    const sorted = [...comparison.markets].sort(
      (a, b) => a.yesPrice.value - b.yesPrice.value
    );

    const cheapestYes = sorted[0];
    const expensiveYes = sorted[sorted.length - 1];

    if (!cheapestYes || !expensiveYes) {
      return ResultHelper.err(AppError.validation('Invalid markets'));
    }

    // Use the entity factory
    const result = ArbitrageEntity.fromMarkets(
      cheapestYes,
      expensiveYes,
      comparison.matchConfidence
    );

    if (result.ok === false) {
      return ResultHelper.err(AppError.validation(result.error.message));
    }

    return ResultHelper.ok(result.value);
  }

  /**
   * Normalize title for comparison
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(w => w.length > 2)
      .sort()
      .join(' ');
  }

  /**
   * Clear all active opportunities
   */
  clearOpportunities(): void {
    this.activeOpportunities.clear();
  }
}

export default ArbitrageService;
