/**
 * Smart Order Router
 *
 * Intelligently routes orders to the best platform for execution:
 * - Compares prices across platforms (Kalshi, DFlow, Polymarket)
 * - Estimates slippage and execution costs
 * - Selects optimal venue for best execution
 * - Supports both paper and live trading
 * - Handles order splitting for large orders
 *
 * "Best execution is not just about price, it's about total cost"
 */

import { EventEmitter } from 'events';
import {
  OrderRequest,
  OrderResult,
  PlatformQuote,
  Trade,
  TradeDirection,
  TradingMode,
  StrategyType,
  inferCategory,
} from '../types/trading';
import { Platform } from '../types/market';
import { getKalshiMarket, placeKalshiOrder, KalshiMarket } from '../lib/kalshi';
import { getMarket, DFlowMarket } from '../lib/dflow/api';
import { getPaperTradingEngine } from './paperTradingEngine';
import { getRiskManager } from './riskManager';

// ============================================
// CONFIGURATION
// ============================================

interface RouterConfig {
  // Slippage tolerance
  maxSlippagePct: number;

  // Minimum quote score to execute
  minQuoteScore: number;

  // Enable/disable platforms
  enabledPlatforms: Platform[];

  // Fee rates by platform
  platformFees: Record<string, number>;

  // Retry settings
  maxRetries: number;
  retryDelayMs: number;
}

const DEFAULT_CONFIG: RouterConfig = {
  maxSlippagePct: 0.02, // 2%
  minQuoteScore: 60,
  enabledPlatforms: ['kalshi', 'polymarket'],
  platformFees: {
    kalshi: 0.01, // 1%
    polymarket: 0.005, // 0.5%
    dflow: 0.008, // 0.8%
    limitless: 0.01, // 1%
  },
  maxRetries: 3,
  retryDelayMs: 1000,
};

// ============================================
// SMART ORDER ROUTER
// ============================================

export class SmartOrderRouter extends EventEmitter {
  private config: RouterConfig;
  private quoteCache: Map<string, { quote: PlatformQuote; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 5000; // 5 seconds

  constructor(config?: Partial<RouterConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute an order with smart routing
   */
  async executeOrder(request: OrderRequest): Promise<OrderResult> {
    const startTime = Date.now();

    try {
      // Step 1: Get quotes from all platforms
      const quotes = await this.getQuotes(request.marketId, request.marketTicker, request.direction);

      if (quotes.length === 0) {
        return {
          success: false,
          trade: null,
          error: 'No quotes available from any platform',
          executedPrice: null,
          executedQuantity: null,
          slippage: null,
          fees: null,
          latencyMs: Date.now() - startTime,
          orderId: null,
          txSignature: null,
        };
      }

      // Step 2: Select best platform
      const bestQuote = this.selectBestQuote(quotes, request.quantity);

      if (bestQuote.score < this.config.minQuoteScore) {
        return {
          success: false,
          trade: null,
          error: `Best quote score (${bestQuote.score}) below minimum (${this.config.minQuoteScore})`,
          executedPrice: null,
          executedQuantity: null,
          slippage: null,
          fees: null,
          latencyMs: Date.now() - startTime,
          orderId: null,
          txSignature: null,
        };
      }

      // Step 3: Risk check
      const riskManager = getRiskManager(request.userId);
      const riskAssessment = riskManager.assessTrade({
        direction: request.direction,
        entryPrice: bestQuote.midPrice,
        quantity: request.quantity,
        category: inferCategory(request.marketTicker),
        strategy: request.strategy,
      });

      if (!riskAssessment.canTrade) {
        return {
          success: false,
          trade: null,
          error: `Risk check failed: ${riskAssessment.reasons.join(', ')}`,
          executedPrice: null,
          executedQuantity: null,
          slippage: null,
          fees: null,
          latencyMs: Date.now() - startTime,
          orderId: null,
          txSignature: null,
        };
      }

      // Adjust quantity if needed
      const adjustedQuantity = Math.min(
        request.quantity,
        riskAssessment.adjustedSize / bestQuote.midPrice
      );

      // Step 4: Execute based on mode
      if (request.mode === 'paper') {
        return await this.executePaperOrder(request, bestQuote, adjustedQuantity, startTime);
      } else {
        return await this.executeLiveOrder(request, bestQuote, adjustedQuantity, startTime);
      }

    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error('[Router] Order execution error:', error);

      return {
        success: false,
        trade: null,
        error,
        executedPrice: null,
        executedQuantity: null,
        slippage: null,
        fees: null,
        latencyMs: Date.now() - startTime,
        orderId: null,
        txSignature: null,
      };
    }
  }

  /**
   * Get quotes from all enabled platforms
   */
  async getQuotes(
    marketId: string,
    ticker: string,
    direction: TradeDirection
  ): Promise<PlatformQuote[]> {
    const quotes: PlatformQuote[] = [];

    // Check cache first
    const cacheKey = `${marketId}-${direction}`;
    const cached = this.quoteCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return [cached.quote];
    }

    // Fetch from each platform in parallel
    const fetchPromises = this.config.enabledPlatforms.map(async (platform) => {
      try {
        const quote = await this.fetchPlatformQuote(platform, marketId, ticker, direction);
        if (quote) {
          quotes.push(quote);
          this.quoteCache.set(cacheKey, { quote, timestamp: Date.now() });
        }
      } catch (err) {
        console.warn(`[Router] Quote fetch failed for ${platform}:`, err);
      }
    });

    await Promise.allSettled(fetchPromises);

    return quotes;
  }

  /**
   * Fetch quote from a specific platform
   */
  private async fetchPlatformQuote(
    platform: Platform,
    marketId: string,
    ticker: string,
    direction: TradeDirection
  ): Promise<PlatformQuote | null> {
    try {
      if (platform === 'kalshi') {
        const market = await getKalshiMarket(ticker);
        if (!market) return null;

        const bestBid = direction === 'YES' ? market.yes_bid / 100 : market.no_bid / 100;
        const bestAsk = direction === 'YES' ? market.yes_ask / 100 : market.no_ask / 100;
        const midPrice = (bestBid + bestAsk) / 2;
        const spread = bestAsk - bestBid;
        const fee = this.config.platformFees.kalshi || 0.01;

        return {
          platform: 'kalshi',
          marketId: market.ticker,
          direction,
          bestBid,
          bestAsk,
          midPrice,
          spread,
          availableQuantity: market.open_interest,
          estimatedSlippage: spread / 2,
          estimatedFee: fee,
          totalCost: midPrice + (spread / 2) + fee,
          score: this.calculateQuoteScore(spread, market.open_interest, fee),
        };
      }

      if (platform === 'polymarket') {
        // Polymarket would use their API
        // For now, return null as it requires separate integration
        return null;
      }

      // DFlow/other platforms
      const result = await getMarket(marketId);
      if (!result.success || !result.data) return null;

      const market = result.data;
      const bestBid = direction === 'YES'
        ? parseFloat(market.yesBid || '0')
        : parseFloat(market.noBid || '0');
      const bestAsk = direction === 'YES'
        ? parseFloat(market.yesAsk || '1')
        : parseFloat(market.noAsk || '1');
      const midPrice = (bestBid + bestAsk) / 2;
      const spread = bestAsk - bestBid;
      const fee = this.config.platformFees.dflow || 0.008;

      return {
        platform: 'kalshi', // DFlow uses Kalshi markets
        marketId,
        direction,
        bestBid,
        bestAsk,
        midPrice,
        spread,
        availableQuantity: market.volume || 0,
        estimatedSlippage: spread / 2,
        estimatedFee: fee,
        totalCost: midPrice + (spread / 2) + fee,
        score: this.calculateQuoteScore(spread, market.volume || 0, fee),
      };

    } catch (err) {
      console.warn(`[Router] Quote fetch error for ${platform}:`, err);
      return null;
    }
  }

  /**
   * Calculate quote quality score (0-100)
   */
  private calculateQuoteScore(spread: number, liquidity: number, fee: number): number {
    let score = 100;

    // Penalize wide spreads (each 1% spread = -10 points)
    score -= spread * 1000;

    // Penalize low liquidity (below $5000 = penalty)
    if (liquidity < 5000) {
      score -= (5000 - liquidity) / 500;
    }

    // Penalize high fees (each 1% fee = -5 points)
    score -= fee * 500;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Select the best quote from available options
   */
  private selectBestQuote(quotes: PlatformQuote[], quantity: number): PlatformQuote {
    // Sort by total cost (lower is better)
    const sorted = [...quotes].sort((a, b) => {
      // First by score (higher is better)
      if (Math.abs(a.score - b.score) > 5) {
        return b.score - a.score;
      }
      // Then by total cost (lower is better)
      return a.totalCost - b.totalCost;
    });

    return sorted[0];
  }

  /**
   * Execute paper trade
   */
  private async executePaperOrder(
    request: OrderRequest,
    quote: PlatformQuote,
    quantity: number,
    startTime: number
  ): Promise<OrderResult> {
    const engine = getPaperTradingEngine(request.userId);

    // Ensure engine is started
    if (!engine.getPortfolio().positionCount && !engine.getPortfolio().cashBalance) {
      await engine.start();
    }

    const result = await engine.executeTrade({
      userId: request.userId,
      mode: 'paper',
      platform: quote.platform,
      marketId: quote.marketId,
      marketTicker: request.marketTicker,
      marketTitle: request.marketTicker, // Would need to fetch actual title
      direction: request.direction,
      entryPrice: quote.midPrice,
      quantity,
      strategy: request.strategy,
      signalId: request.signalId,
      stopLossPrice: request.stopLossPrice,
      takeProfitPrice: request.takeProfitPrice,
    });

    return {
      success: result.success,
      trade: result.trade,
      error: result.error,
      executedPrice: result.trade?.entryPrice || null,
      executedQuantity: result.trade?.quantity || null,
      slippage: result.trade?.slippage || null,
      fees: result.trade?.fees || null,
      latencyMs: Date.now() - startTime,
      orderId: result.trade?.id || null,
      txSignature: null,
    };
  }

  /**
   * Execute live trade
   */
  private async executeLiveOrder(
    request: OrderRequest,
    quote: PlatformQuote,
    quantity: number,
    startTime: number
  ): Promise<OrderResult> {
    // Live trading requires platform-specific implementation
    // For Kalshi:
    if (quote.platform === 'kalshi') {
      try {
        const orderResult = await placeKalshiOrder(
          quote.marketId,
          request.direction.toLowerCase() as 'yes' | 'no',
          'buy',
          Math.floor(quantity),
          Math.round(quote.bestAsk * 100) // Kalshi uses cents
        );

        if (orderResult && orderResult.order_id) {
          const trade: Trade = {
            id: orderResult.order_id,
            userId: request.userId,
            mode: 'live',
            platform: 'kalshi',
            marketId: quote.marketId,
            marketTicker: request.marketTicker,
            marketTitle: request.marketTicker,
            category: inferCategory(request.marketTicker),
            direction: request.direction,
            orderType: 'limit',
            entryPrice: quote.bestAsk,
            exitPrice: null,
            quantity: Math.floor(quantity),
            quantityFilled: orderResult.count || Math.floor(quantity),
            entryValueUsd: quote.bestAsk * Math.floor(quantity),
            exitValueUsd: null,
            unrealizedPnl: 0,
            realizedPnl: null,
            pnlPercent: null,
            fees: quote.estimatedFee * Math.floor(quantity),
            strategy: request.strategy,
            signalId: request.signalId || null,
            signalConfidence: null,
            stopLossPrice: request.stopLossPrice || null,
            takeProfitPrice: request.takeProfitPrice || null,
            maxLossUsd: null,
            createdAt: new Date(),
            filledAt: new Date(),
            closedAt: null,
            expiresAt: null,
            status: 'open',
            closeReason: null,
            executionLatencyMs: Date.now() - startTime,
            slippage: quote.estimatedSlippage,
            orderId: orderResult.order_id,
            txSignature: null,
          };

          return {
            success: true,
            trade,
            error: null,
            executedPrice: quote.bestAsk,
            executedQuantity: Math.floor(quantity),
            slippage: quote.estimatedSlippage,
            fees: quote.estimatedFee * Math.floor(quantity),
            latencyMs: Date.now() - startTime,
            orderId: orderResult.order_id,
            txSignature: null,
          };
        }

        return {
          success: false,
          trade: null,
          error: 'Order placement failed - no order ID returned',
          executedPrice: null,
          executedQuantity: null,
          slippage: null,
          fees: null,
          latencyMs: Date.now() - startTime,
          orderId: null,
          txSignature: null,
        };

      } catch (err) {
        return {
          success: false,
          trade: null,
          error: `Kalshi order failed: ${err instanceof Error ? err.message : String(err)}`,
          executedPrice: null,
          executedQuantity: null,
          slippage: null,
          fees: null,
          latencyMs: Date.now() - startTime,
          orderId: null,
          txSignature: null,
        };
      }
    }

    // Other platforms would be implemented here
    return {
      success: false,
      trade: null,
      error: `Live trading not implemented for platform: ${quote.platform}`,
      executedPrice: null,
      executedQuantity: null,
      slippage: null,
      fees: null,
      latencyMs: Date.now() - startTime,
      orderId: null,
      txSignature: null,
    };
  }

  /**
   * Get best price for a market across all platforms
   */
  async getBestPrice(
    marketId: string,
    ticker: string,
    direction: TradeDirection
  ): Promise<{ platform: Platform | string; price: number; spread: number } | null> {
    const quotes = await this.getQuotes(marketId, ticker, direction);

    if (quotes.length === 0) return null;

    const best = this.selectBestQuote(quotes, 1);

    return {
      platform: best.platform,
      price: best.midPrice,
      spread: best.spread,
    };
  }

  /**
   * Compare prices across platforms
   */
  async compareAllPlatforms(
    marketId: string,
    ticker: string
  ): Promise<{
    yes: PlatformQuote[];
    no: PlatformQuote[];
    bestYes: PlatformQuote | null;
    bestNo: PlatformQuote | null;
    arbitrageOpportunity: boolean;
    arbitrageSpread: number;
  }> {
    const yesQuotes = await this.getQuotes(marketId, ticker, 'YES');
    const noQuotes = await this.getQuotes(marketId, ticker, 'NO');

    const bestYes = yesQuotes.length > 0 ? this.selectBestQuote(yesQuotes, 1) : null;
    const bestNo = noQuotes.length > 0 ? this.selectBestQuote(noQuotes, 1) : null;

    // Check for arbitrage
    let arbitrageOpportunity = false;
    let arbitrageSpread = 0;

    if (bestYes && bestNo) {
      // If YES price on one platform + NO price on another < 1, there's arb
      const totalCost = bestYes.bestAsk + bestNo.bestAsk;
      if (totalCost < 0.98) { // 2% margin for fees
        arbitrageOpportunity = true;
        arbitrageSpread = 1 - totalCost;
      }
    }

    return {
      yes: yesQuotes,
      no: noQuotes,
      bestYes,
      bestNo,
      arbitrageOpportunity,
      arbitrageSpread,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<RouterConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): RouterConfig {
    return { ...this.config };
  }

  /**
   * Clear quote cache
   */
  clearCache(): void {
    this.quoteCache.clear();
  }
}

// ============================================
// SINGLETON
// ============================================

let routerInstance: SmartOrderRouter | null = null;

export function getSmartOrderRouter(config?: Partial<RouterConfig>): SmartOrderRouter {
  if (!routerInstance) {
    routerInstance = new SmartOrderRouter(config);
  }
  return routerInstance;
}

// ============================================
// CLI INTERFACE
// ============================================

if (require.main === module) {
  const command = process.argv[2] || 'info';
  const ticker = process.argv[3] || 'KXBTC-25MAR14-B100';

  const router = new SmartOrderRouter();

  switch (command) {
    case 'quote':
      console.log(`\n💱 Getting quotes for ${ticker}...\n`);

      router.getQuotes(ticker, ticker, 'YES').then(quotes => {
        if (quotes.length === 0) {
          console.log('No quotes available');
          process.exit(1);
        }

        for (const q of quotes) {
          console.log(`${q.platform.toUpperCase()}`);
          console.log(`  Bid: ${(q.bestBid * 100).toFixed(1)}¢`);
          console.log(`  Ask: ${(q.bestAsk * 100).toFixed(1)}¢`);
          console.log(`  Spread: ${(q.spread * 100).toFixed(2)}¢`);
          console.log(`  Fee: ${(q.estimatedFee * 100).toFixed(1)}%`);
          console.log(`  Score: ${q.score.toFixed(0)}/100`);
          console.log('');
        }

        process.exit(0);
      }).catch(err => {
        console.error('Error:', err);
        process.exit(1);
      });
      break;

    case 'compare':
      console.log(`\n📊 Comparing all platforms for ${ticker}...\n`);

      router.compareAllPlatforms(ticker, ticker).then(comparison => {
        console.log('YES Quotes:');
        for (const q of comparison.yes) {
          console.log(`  ${q.platform}: ${(q.midPrice * 100).toFixed(1)}¢ (spread: ${(q.spread * 100).toFixed(2)}¢)`);
        }

        console.log('\nNO Quotes:');
        for (const q of comparison.no) {
          console.log(`  ${q.platform}: ${(q.midPrice * 100).toFixed(1)}¢ (spread: ${(q.spread * 100).toFixed(2)}¢)`);
        }

        if (comparison.arbitrageOpportunity) {
          console.log(`\n🚨 ARBITRAGE OPPORTUNITY: ${(comparison.arbitrageSpread * 100).toFixed(2)}% spread!`);
        }

        process.exit(0);
      }).catch(err => {
        console.error('Error:', err);
        process.exit(1);
      });
      break;

    case 'info':
    default:
      console.log('\n🔀 Smart Order Router');
      console.log('═'.repeat(40));
      console.log('\nConfiguration:');
      const config = router.getConfig();
      console.log(`  Max Slippage: ${(config.maxSlippagePct * 100).toFixed(1)}%`);
      console.log(`  Min Quote Score: ${config.minQuoteScore}`);
      console.log(`  Enabled Platforms: ${config.enabledPlatforms.join(', ')}`);
      console.log('\nPlatform Fees:');
      for (const [platform, fee] of Object.entries(config.platformFees)) {
        console.log(`  ${platform}: ${(fee * 100).toFixed(1)}%`);
      }

      console.log('\n\nUsage:');
      console.log('  ts-node smartOrderRouter.ts info              # Show configuration');
      console.log('  ts-node smartOrderRouter.ts quote <ticker>    # Get quotes');
      console.log('  ts-node smartOrderRouter.ts compare <ticker>  # Compare all platforms');
      break;
  }
}

export type { RouterConfig, PlatformQuote };
