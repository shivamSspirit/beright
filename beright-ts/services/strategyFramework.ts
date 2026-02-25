/**
 * Strategy Framework
 *
 * Implements 5 core trading strategies:
 * 1. Arbitrage - Cross-platform price discrepancies
 * 2. Information Speed - Act on news before markets
 * 3. Mean Reversion - Bet against extreme moves
 * 4. Resolution Timing - Exploit time decay near expiry
 * 5. Consensus Flip - Follow smart money reversals
 *
 * Each strategy:
 * - Evaluates market conditions
 * - Generates trading signals
 * - Calculates confidence and edge
 * - Recommends position sizing
 */

import { EventEmitter } from 'events';
import {
  StrategyType,
  StrategyConfig,
  StrategySignal,
  SignalFactor,
  TradeDirection,
  DEFAULT_STRATEGY_CONFIGS,
  inferCategory,
  calculateKellySize,
} from '../types/trading';
import { Platform, Market, ArbitrageOpportunity } from '../types/market';
import { scanForArbitrage, ScanResult } from '../lib/arbitrage/scanner';
import { getIntelligence } from '../skills/intelligence';

// ============================================
// STRATEGY INTERFACE
// ============================================

export interface MarketContext {
  market: Market;
  platform: Platform | string;
  marketId: string;
  ticker: string;
  title: string;
  currentPrice: number;
  volume: number;
  volume24h?: number;
  category: string;
  daysToExpiry?: number;
  priceHistory?: { timestamp: Date; price: number }[];
  newsRecency?: number; // Minutes since last related news
  consensusShift?: number; // Recent price change magnitude
}

export interface StrategyEvaluation {
  strategy: StrategyType;
  shouldTrade: boolean;
  signal: StrategySignal | null;
  factors: SignalFactor[];
  reasoning: string;
}

// ============================================
// BASE STRATEGY CLASS
// ============================================

abstract class BaseStrategy {
  protected config: StrategyConfig;

  constructor(config?: Partial<StrategyConfig>) {
    const defaultConfig = DEFAULT_STRATEGY_CONFIGS[this.getType()];
    this.config = { ...defaultConfig, ...config };
  }

  abstract getType(): StrategyType;

  abstract evaluate(context: MarketContext): Promise<StrategyEvaluation>;

  protected createSignal(
    context: MarketContext,
    direction: TradeDirection,
    confidence: number,
    edge: number,
    factors: SignalFactor[],
    reasoning: string
  ): StrategySignal {
    const targetPrice = direction === 'YES'
      ? Math.min(0.99, context.currentPrice * (1 + edge))
      : Math.max(0.01, context.currentPrice * (1 - edge));

    return {
      id: `signal-${this.getType()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      strategyType: this.getType(),
      timestamp: new Date(),
      platform: context.platform,
      marketId: context.marketId,
      marketTicker: context.ticker,
      marketTitle: context.title,
      category: context.category,
      direction,
      confidence,
      edge,
      currentPrice: context.currentPrice,
      targetPrice,
      reasoning,
      factors,
      recommendedAction: confidence >= this.config.minConfidence ? 'buy' : 'skip',
      recommendedSize: calculateKellySize(edge, confidence / 100),
      urgency: confidence >= 80 ? 'immediate' : confidence >= 60 ? 'soon' : 'optional',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min validity
      isExpired: false,
    };
  }

  protected meetsMinimumCriteria(confidence: number, edge: number): boolean {
    return confidence >= this.config.minConfidence && edge >= this.config.minEdge;
  }
}

// ============================================
// STRATEGY 1: ARBITRAGE
// ============================================

class ArbitrageStrategy extends BaseStrategy {
  getType(): StrategyType {
    return 'arbitrage';
  }

  async evaluate(context: MarketContext): Promise<StrategyEvaluation> {
    const factors: SignalFactor[] = [];

    // Check if we have arbitrage data
    // This would integrate with existing arbitrage scanner
    try {
      const arbResults = await this.findArbitrageForMarket(context);

      if (!arbResults || arbResults.spread < (this.config.customParams.minSpreadPct as number || 0.03)) {
        return {
          strategy: this.getType(),
          shouldTrade: false,
          signal: null,
          factors,
          reasoning: 'No profitable arbitrage opportunity found',
        };
      }

      // Calculate factors
      const spreadFactor: SignalFactor = {
        name: 'Price Spread',
        value: arbResults.spread,
        weight: 0.4,
        contribution: arbResults.spread * 0.4,
        description: `${(arbResults.spread * 100).toFixed(2)}% spread between platforms`,
      };
      factors.push(spreadFactor);

      const liquidityFactor: SignalFactor = {
        name: 'Liquidity',
        value: Math.min(1, (arbResults.liquidity || 1000) / 5000),
        weight: 0.3,
        contribution: Math.min(1, (arbResults.liquidity || 1000) / 5000) * 0.3,
        description: `$${arbResults.liquidity || 'unknown'} available liquidity`,
      };
      factors.push(liquidityFactor);

      const confidenceFactor: SignalFactor = {
        name: 'Match Confidence',
        value: arbResults.matchConfidence,
        weight: 0.3,
        contribution: arbResults.matchConfidence * 0.3,
        description: `${(arbResults.matchConfidence * 100).toFixed(0)}% market match confidence`,
      };
      factors.push(confidenceFactor);

      // Calculate overall confidence and edge
      const confidence = factors.reduce((sum, f) => sum + f.contribution * 100, 0);
      const edge = arbResults.spread - 0.02; // Account for fees

      if (!this.meetsMinimumCriteria(confidence, edge)) {
        return {
          strategy: this.getType(),
          shouldTrade: false,
          signal: null,
          factors,
          reasoning: `Arbitrage found but below thresholds (conf: ${confidence.toFixed(0)}%, edge: ${(edge * 100).toFixed(2)}%)`,
        };
      }

      const signal = this.createSignal(
        context,
        arbResults.direction,
        confidence,
        edge,
        factors,
        `Arbitrage: Buy ${arbResults.direction} on ${arbResults.buyPlatform}, sell on ${arbResults.sellPlatform} for ${(arbResults.spread * 100).toFixed(2)}% spread`
      );

      return {
        strategy: this.getType(),
        shouldTrade: true,
        signal,
        factors,
        reasoning: signal.reasoning,
      };

    } catch (err) {
      return {
        strategy: this.getType(),
        shouldTrade: false,
        signal: null,
        factors,
        reasoning: `Arbitrage check failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  private async findArbitrageForMarket(context: MarketContext): Promise<{
    spread: number;
    direction: TradeDirection;
    buyPlatform: string;
    sellPlatform: string;
    liquidity?: number;
    matchConfidence: number;
  } | null> {
    // Simplified arbitrage check - in production would use full scanner
    // This is a placeholder that would integrate with existing arbitrage system
    return null;
  }
}

// ============================================
// STRATEGY 2: INFORMATION SPEED
// ============================================

class InformationSpeedStrategy extends BaseStrategy {
  getType(): StrategyType {
    return 'information_speed';
  }

  async evaluate(context: MarketContext): Promise<StrategyEvaluation> {
    const factors: SignalFactor[] = [];

    // Check news recency
    if (!context.newsRecency || context.newsRecency > (this.config.customParams.maxAgeMinutes as number || 30)) {
      return {
        strategy: this.getType(),
        shouldTrade: false,
        signal: null,
        factors,
        reasoning: 'No recent news to trade on',
      };
    }

    try {
      // Get intelligence assessment
      const intel = await getIntelligence(context.title, context.ticker);

      // Calculate how much market has moved vs our assessment
      const ourMidpoint = (intel.recommendedRange.low + intel.recommendedRange.high) / 2;
      const divergence = Math.abs(ourMidpoint - context.currentPrice);

      // News recency factor
      const recencyFactor: SignalFactor = {
        name: 'News Recency',
        value: 1 - (context.newsRecency / 60), // Decays over 60 min
        weight: 0.3,
        contribution: (1 - (context.newsRecency / 60)) * 0.3,
        description: `News is ${context.newsRecency} minutes old`,
      };
      factors.push(recencyFactor);

      // Price divergence factor
      const divergenceFactor: SignalFactor = {
        name: 'Price Divergence',
        value: divergence,
        weight: 0.4,
        contribution: Math.min(divergence * 2, 1) * 0.4,
        description: `Market price ${(divergence * 100).toFixed(1)}% from our assessment`,
      };
      factors.push(divergenceFactor);

      // Intel confidence factor (convert 'low'/'medium'/'high' to numeric)
      const confidenceMap: Record<string, number> = { low: 0.4, medium: 0.6, high: 0.8 };
      const intelConfidence = confidenceMap[intel.baseRate.confidence] || 0.5;
      const intelFactor: SignalFactor = {
        name: 'Intel Confidence',
        value: intelConfidence,
        weight: 0.3,
        contribution: intelConfidence * 0.3,
        description: `Intelligence confidence: ${intel.baseRate.confidence} (${(intelConfidence * 100).toFixed(0)}%)`,
      };
      factors.push(intelFactor);

      const confidence = factors.reduce((sum, f) => sum + f.contribution * 100, 0);
      const edge = divergence;

      if (!this.meetsMinimumCriteria(confidence, edge)) {
        return {
          strategy: this.getType(),
          shouldTrade: false,
          signal: null,
          factors,
          reasoning: `Recent news but edge too small (${(edge * 100).toFixed(2)}%)`,
        };
      }

      // Determine direction based on our assessment vs market
      const direction: TradeDirection = ourMidpoint > context.currentPrice ? 'YES' : 'NO';

      const signal = this.createSignal(
        context,
        direction,
        confidence,
        edge,
        factors,
        `Info Speed: Market at ${(context.currentPrice * 100).toFixed(0)}%, our assessment ${(ourMidpoint * 100).toFixed(0)}%. News ${context.newsRecency}min old.`
      );

      return {
        strategy: this.getType(),
        shouldTrade: true,
        signal,
        factors,
        reasoning: signal.reasoning,
      };

    } catch (err) {
      return {
        strategy: this.getType(),
        shouldTrade: false,
        signal: null,
        factors,
        reasoning: `Intelligence check failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}

// ============================================
// STRATEGY 3: MEAN REVERSION
// ============================================

class MeanReversionStrategy extends BaseStrategy {
  getType(): StrategyType {
    return 'mean_reversion';
  }

  async evaluate(context: MarketContext): Promise<StrategyEvaluation> {
    const factors: SignalFactor[] = [];

    // Need price history for mean reversion
    if (!context.priceHistory || context.priceHistory.length < 5) {
      return {
        strategy: this.getType(),
        shouldTrade: false,
        signal: null,
        factors,
        reasoning: 'Insufficient price history for mean reversion analysis',
      };
    }

    // Calculate moving average and deviation
    const prices = context.priceHistory.map(p => p.price);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const deviation = (context.currentPrice - avgPrice) / avgPrice;
    const absDeviation = Math.abs(deviation);

    const minDeviation = this.config.customParams.minPriceDeviation as number || 0.15;

    // Check if deviation is significant enough
    if (absDeviation < minDeviation) {
      return {
        strategy: this.getType(),
        shouldTrade: false,
        signal: null,
        factors,
        reasoning: `Price deviation (${(absDeviation * 100).toFixed(1)}%) below threshold (${(minDeviation * 100).toFixed(0)}%)`,
      };
    }

    // Deviation magnitude factor
    const deviationFactor: SignalFactor = {
      name: 'Price Deviation',
      value: Math.min(absDeviation / 0.30, 1), // Normalize to 30% max
      weight: 0.5,
      contribution: Math.min(absDeviation / 0.30, 1) * 0.5,
      description: `${(absDeviation * 100).toFixed(1)}% from ${(this.config.customParams.lookbackPeriodHours as number || 24)}h average`,
    };
    factors.push(deviationFactor);

    // Volume confirmation factor
    const volumeFactor: SignalFactor = {
      name: 'Volume',
      value: Math.min((context.volume || 0) / 10000, 1),
      weight: 0.3,
      contribution: Math.min((context.volume || 0) / 10000, 1) * 0.3,
      description: `$${context.volume || 0} volume`,
    };
    factors.push(volumeFactor);

    // Time decay factor (mean reversion works better with time)
    const timeFactor: SignalFactor = {
      name: 'Time Available',
      value: context.daysToExpiry ? Math.min(context.daysToExpiry / 30, 1) : 0.5,
      weight: 0.2,
      contribution: (context.daysToExpiry ? Math.min(context.daysToExpiry / 30, 1) : 0.5) * 0.2,
      description: context.daysToExpiry ? `${context.daysToExpiry.toFixed(1)} days to expiry` : 'Unknown expiry',
    };
    factors.push(timeFactor);

    const confidence = factors.reduce((sum, f) => sum + f.contribution * 100, 0);
    const edge = absDeviation * 0.5; // Expect 50% reversion

    if (!this.meetsMinimumCriteria(confidence, edge)) {
      return {
        strategy: this.getType(),
        shouldTrade: false,
        signal: null,
        factors,
        reasoning: `Mean reversion opportunity below thresholds`,
      };
    }

    // Bet against the deviation (if price is high, bet NO)
    const direction: TradeDirection = deviation > 0 ? 'NO' : 'YES';

    const signal = this.createSignal(
      context,
      direction,
      confidence,
      edge,
      factors,
      `Mean Reversion: Price ${deviation > 0 ? 'above' : 'below'} average by ${(absDeviation * 100).toFixed(1)}%. Betting ${direction} for reversion.`
    );

    return {
      strategy: this.getType(),
      shouldTrade: true,
      signal,
      factors,
      reasoning: signal.reasoning,
    };
  }
}

// ============================================
// STRATEGY 4: RESOLUTION TIMING
// ============================================

class ResolutionTimingStrategy extends BaseStrategy {
  getType(): StrategyType {
    return 'resolution_timing';
  }

  async evaluate(context: MarketContext): Promise<StrategyEvaluation> {
    const factors: SignalFactor[] = [];

    const maxDays = this.config.customParams.maxDaysToExpiry as number || 7;
    const minDays = this.config.customParams.minDaysToExpiry as number || 0.1;

    // Check if market is near resolution
    if (!context.daysToExpiry || context.daysToExpiry > maxDays || context.daysToExpiry < minDays) {
      return {
        strategy: this.getType(),
        shouldTrade: false,
        signal: null,
        factors,
        reasoning: context.daysToExpiry
          ? `${context.daysToExpiry.toFixed(1)} days to expiry outside target range (${minDays}-${maxDays} days)`
          : 'No expiry date available',
      };
    }

    // Time decay factor - closer to expiry = stronger effect
    const timeDecayFactor: SignalFactor = {
      name: 'Time Decay',
      value: 1 - (context.daysToExpiry / maxDays),
      weight: 0.4,
      contribution: (1 - (context.daysToExpiry / maxDays)) * 0.4,
      description: `${context.daysToExpiry.toFixed(2)} days until resolution`,
    };
    factors.push(timeDecayFactor);

    // Price extremity factor - extreme prices near expiry are more confident
    const priceExtremity = Math.abs(context.currentPrice - 0.5) * 2; // 0 at 50%, 1 at 0% or 100%
    const extremityFactor: SignalFactor = {
      name: 'Price Extremity',
      value: priceExtremity,
      weight: 0.4,
      contribution: priceExtremity * 0.4,
      description: `Price at ${(context.currentPrice * 100).toFixed(0)}% (${(priceExtremity * 100).toFixed(0)}% from middle)`,
    };
    factors.push(extremityFactor);

    // Volume factor
    const volumeFactor: SignalFactor = {
      name: 'Trading Activity',
      value: Math.min((context.volume24h || context.volume || 0) / 5000, 1),
      weight: 0.2,
      contribution: Math.min((context.volume24h || context.volume || 0) / 5000, 1) * 0.2,
      description: `$${context.volume24h || context.volume || 0} recent volume`,
    };
    factors.push(volumeFactor);

    const confidence = factors.reduce((sum, f) => sum + f.contribution * 100, 0);

    // Edge comes from time decay - near expiry, prices converge to 0 or 1
    const edge = priceExtremity * (1 - context.daysToExpiry / maxDays) * 0.1;

    if (!this.meetsMinimumCriteria(confidence, edge)) {
      return {
        strategy: this.getType(),
        shouldTrade: false,
        signal: null,
        factors,
        reasoning: `Resolution timing opportunity below thresholds`,
      };
    }

    // Bet with the trend for extreme prices near expiry
    const direction: TradeDirection = context.currentPrice > 0.5 ? 'YES' : 'NO';

    const signal = this.createSignal(
      context,
      direction,
      confidence,
      edge,
      factors,
      `Resolution Timing: ${context.daysToExpiry.toFixed(2)} days left, price at ${(context.currentPrice * 100).toFixed(0)}%. Betting ${direction} for convergence.`
    );

    return {
      strategy: this.getType(),
      shouldTrade: true,
      signal,
      factors,
      reasoning: signal.reasoning,
    };
  }
}

// ============================================
// STRATEGY 5: CONSENSUS FLIP
// ============================================

class ConsensusFlipStrategy extends BaseStrategy {
  getType(): StrategyType {
    return 'consensus_flip';
  }

  async evaluate(context: MarketContext): Promise<StrategyEvaluation> {
    const factors: SignalFactor[] = [];

    const minFlipMagnitude = this.config.customParams.minFlipMagnitude as number || 0.10;

    // Check for consensus shift
    if (!context.consensusShift || Math.abs(context.consensusShift) < minFlipMagnitude) {
      return {
        strategy: this.getType(),
        shouldTrade: false,
        signal: null,
        factors,
        reasoning: context.consensusShift
          ? `Price shift (${(Math.abs(context.consensusShift) * 100).toFixed(1)}%) below threshold (${(minFlipMagnitude * 100).toFixed(0)}%)`
          : 'No consensus shift data available',
      };
    }

    // Flip magnitude factor
    const flipFactor: SignalFactor = {
      name: 'Flip Magnitude',
      value: Math.min(Math.abs(context.consensusShift) / 0.30, 1), // Normalize to 30%
      weight: 0.5,
      contribution: Math.min(Math.abs(context.consensusShift) / 0.30, 1) * 0.5,
      description: `${(Math.abs(context.consensusShift) * 100).toFixed(1)}% consensus shift`,
    };
    factors.push(flipFactor);

    // Volume confirmation - smart money moves are often accompanied by volume
    const volumeFactor: SignalFactor = {
      name: 'Volume Confirmation',
      value: Math.min((context.volume24h || context.volume || 0) / 10000, 1),
      weight: 0.3,
      contribution: Math.min((context.volume24h || context.volume || 0) / 10000, 1) * 0.3,
      description: `$${context.volume24h || context.volume || 0} supporting volume`,
    };
    factors.push(volumeFactor);

    // Price reasonableness - not at extremes
    const priceReasonableness = 1 - Math.abs(context.currentPrice - 0.5) * 2;
    const priceFactor: SignalFactor = {
      name: 'Price Reasonableness',
      value: priceReasonableness,
      weight: 0.2,
      contribution: priceReasonableness * 0.2,
      description: `Price at ${(context.currentPrice * 100).toFixed(0)}% (${priceReasonableness > 0.5 ? 'reasonable' : 'extreme'})`,
    };
    factors.push(priceFactor);

    const confidence = factors.reduce((sum, f) => sum + f.contribution * 100, 0);
    const edge = Math.abs(context.consensusShift) * 0.6; // Expect 60% of the move continues

    if (!this.meetsMinimumCriteria(confidence, edge)) {
      return {
        strategy: this.getType(),
        shouldTrade: false,
        signal: null,
        factors,
        reasoning: `Consensus flip detected but below confidence threshold`,
      };
    }

    // Follow the flip direction
    const direction: TradeDirection = context.consensusShift > 0 ? 'YES' : 'NO';

    const signal = this.createSignal(
      context,
      direction,
      confidence,
      edge,
      factors,
      `Consensus Flip: ${(Math.abs(context.consensusShift) * 100).toFixed(1)}% shift ${context.consensusShift > 0 ? 'bullish' : 'bearish'}. Following smart money.`
    );

    return {
      strategy: this.getType(),
      shouldTrade: true,
      signal,
      factors,
      reasoning: signal.reasoning,
    };
  }
}

// ============================================
// STRATEGY FRAMEWORK
// ============================================

export class StrategyFramework extends EventEmitter {
  private strategies: Map<StrategyType, BaseStrategy> = new Map();
  private enabledStrategies: Set<StrategyType> = new Set();

  constructor(configs?: Partial<Record<StrategyType, Partial<StrategyConfig>>>) {
    super();

    // Initialize all strategies
    this.strategies.set('arbitrage', new ArbitrageStrategy(configs?.arbitrage));
    this.strategies.set('information_speed', new InformationSpeedStrategy(configs?.information_speed));
    this.strategies.set('mean_reversion', new MeanReversionStrategy(configs?.mean_reversion));
    this.strategies.set('resolution_timing', new ResolutionTimingStrategy(configs?.resolution_timing));
    this.strategies.set('consensus_flip', new ConsensusFlipStrategy(configs?.consensus_flip));

    // Enable all by default
    this.strategies.forEach((_, type) => this.enabledStrategies.add(type));
  }

  /**
   * Enable a strategy
   */
  enableStrategy(type: StrategyType): void {
    this.enabledStrategies.add(type);
  }

  /**
   * Disable a strategy
   */
  disableStrategy(type: StrategyType): void {
    this.enabledStrategies.delete(type);
  }

  /**
   * Get enabled strategies
   */
  getEnabledStrategies(): StrategyType[] {
    return Array.from(this.enabledStrategies);
  }

  /**
   * Evaluate all enabled strategies for a market
   */
  async evaluateAll(context: MarketContext): Promise<StrategyEvaluation[]> {
    const evaluations: StrategyEvaluation[] = [];

    for (const type of this.enabledStrategies) {
      const strategy = this.strategies.get(type);
      if (strategy) {
        try {
          const evaluation = await strategy.evaluate(context);
          evaluations.push(evaluation);

          if (evaluation.shouldTrade && evaluation.signal) {
            this.emit('signal', evaluation.signal);
          }
        } catch (err) {
          console.error(`[Strategy] ${type} evaluation failed:`, err);
          evaluations.push({
            strategy: type,
            shouldTrade: false,
            signal: null,
            factors: [],
            reasoning: `Evaluation error: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
    }

    return evaluations;
  }

  /**
   * Evaluate a specific strategy
   */
  async evaluateStrategy(type: StrategyType, context: MarketContext): Promise<StrategyEvaluation | null> {
    const strategy = this.strategies.get(type);
    if (!strategy) return null;

    try {
      return await strategy.evaluate(context);
    } catch (err) {
      console.error(`[Strategy] ${type} evaluation failed:`, err);
      return {
        strategy: type,
        shouldTrade: false,
        signal: null,
        factors: [],
        reasoning: `Evaluation error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Get best signal from all evaluations
   */
  async getBestSignal(context: MarketContext): Promise<StrategySignal | null> {
    const evaluations = await this.evaluateAll(context);

    const signals = evaluations
      .filter(e => e.shouldTrade && e.signal)
      .map(e => e.signal!)
      .sort((a, b) => {
        // Sort by confidence * edge (expected value)
        const evA = a.confidence * a.edge;
        const evB = b.confidence * b.edge;
        return evB - evA;
      });

    return signals[0] || null;
  }

  /**
   * Create market context from raw market data
   */
  static createContext(
    market: Market,
    options?: {
      priceHistory?: { timestamp: Date; price: number }[];
      newsRecency?: number;
      consensusShift?: number;
    }
  ): MarketContext {
    return {
      market,
      platform: market.platform,
      marketId: market.marketId || '',
      ticker: market.marketId || market.title.substring(0, 20),
      title: market.title,
      currentPrice: market.yesPrice,
      volume: market.volume,
      volume24h: market.volume24h,
      category: inferCategory(market.title),
      daysToExpiry: market.endDate
        ? (market.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        : undefined,
      priceHistory: options?.priceHistory,
      newsRecency: options?.newsRecency,
      consensusShift: options?.consensusShift,
    };
  }
}

// ============================================
// SINGLETON
// ============================================

let frameworkInstance: StrategyFramework | null = null;

export function getStrategyFramework(
  configs?: Partial<Record<StrategyType, Partial<StrategyConfig>>>
): StrategyFramework {
  if (!frameworkInstance) {
    frameworkInstance = new StrategyFramework(configs);
  }
  return frameworkInstance;
}

// ============================================
// CLI INTERFACE
// ============================================

if (require.main === module) {
  const command = process.argv[2] || 'info';

  const framework = new StrategyFramework();

  switch (command) {
    case 'info':
      console.log('\n📈 Strategy Framework');
      console.log('═'.repeat(50));
      console.log('\nAvailable Strategies:');

      for (const [type, config] of Object.entries(DEFAULT_STRATEGY_CONFIGS)) {
        console.log(`\n${type.toUpperCase()}`);
        console.log(`  Name: ${config.name}`);
        console.log(`  Description: ${config.description}`);
        console.log(`  Min Confidence: ${config.minConfidence}%`);
        console.log(`  Min Edge: ${(config.minEdge * 100).toFixed(0)}%`);
        console.log(`  Max Daily Trades: ${config.maxDailyTrades}`);
      }

      console.log('\n\nUsage:');
      console.log('  ts-node strategyFramework.ts info  # Show strategy info');
      console.log('  ts-node strategyFramework.ts test  # Run test evaluation');
      break;

    case 'test':
      console.log('\n🧪 Running test evaluation...\n');

      const testContext: MarketContext = {
        market: {} as Market,
        platform: 'kalshi',
        marketId: 'test-market',
        ticker: 'TEST',
        title: 'Will Bitcoin exceed $100,000 by end of 2024?',
        currentPrice: 0.45,
        volume: 50000,
        volume24h: 5000,
        category: 'crypto',
        daysToExpiry: 5,
        consensusShift: 0.12,
      };

      framework.evaluateAll(testContext).then(evaluations => {
        for (const eval_ of evaluations) {
          console.log(`\n${eval_.strategy.toUpperCase()}`);
          console.log(`  Should Trade: ${eval_.shouldTrade ? 'YES' : 'NO'}`);
          console.log(`  Reasoning: ${eval_.reasoning}`);
          if (eval_.signal) {
            console.log(`  Direction: ${eval_.signal.direction}`);
            console.log(`  Confidence: ${eval_.signal.confidence.toFixed(0)}%`);
            console.log(`  Edge: ${(eval_.signal.edge * 100).toFixed(2)}%`);
          }
        }
        process.exit(0);
      });
      break;

    default:
      console.log('Unknown command. Use: info, test');
      process.exit(1);
  }
}

// Note: MarketContext, StrategyEvaluation, and BaseStrategy are already exported above
