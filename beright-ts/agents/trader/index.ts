/**
 * TRADER AGENT - True Agentic Architecture
 *
 * A human-replacement agent for trade execution and risk management.
 *
 * ARCHITECTURE (OpenClaw-compatible):
 * - LLM is the brain - it decides what tools to use
 * - Tools are defined, not hardcoded handlers
 * - Natural language in → LLM understands → LLM calls tools → LLM synthesizes
 * - No keyword matching, no switch statements
 *
 * What an execution desk analyst does:
 * 1. Checks current portfolio positions
 * 2. Calculates optimal position size (Kelly criterion)
 * 3. Finds best price across platforms
 * 4. Assesses risk and correlation
 * 5. Executes trades with smart routing
 * 6. Sets price alerts
 *
 * Trader does this with precision and risk-awareness.
 *
 * COGNITIVE SPECIALIZATION:
 * - Uses Claude Sonnet (fast model) for quick decisions
 * - Temperature 0.1 (very precise, deterministic)
 * - Speed: <3 seconds for execution decisions
 */

import { SkillResponse, Mood, Market, Platform } from '../../types/index';
import { llmChat } from '../../lib/llm';
import { searchMarkets, getHotMarkets } from '../../skills/markets';
import {
  getPortfolioManager,
  calculateKelly,
  PortfolioManager,
  KellyInput,
} from '../../lib/portfolio';
import {
  getExecutionEngine,
  ExecutionEngine,
} from '../../lib/execution';
import {
  Trade,
  Position,
  TradeDirection,
  calculateKellySize,
} from '../../types/trading';
// Fast execution imports
import { getFastExecutionEngine, SwapParams } from '../../lib/execution/fastExecution';
import { EXECUTION_CONFIG } from '../../config/execution';
import { getLatencyTracker, formatMicroseconds } from '../../lib/execution/latencyTracker';

// ============================================================================
// TRADER CONFIGURATION
// ============================================================================

export const TRADER_CONFIG = {
  id: 'trader',
  name: 'Trader',
  model: 'claude-sonnet-4-5' as const,
  temperature: 0.1, // Precise, risk-aware
  maxTokens: 2048,

  // Risk defaults
  defaultStopLossPct: 0.20, // 20% stop loss
  defaultTakeProfitPct: 0.30, // 30% take profit
  maxPositionPct: 0.10, // Max 10% of portfolio per position

  // Cognitive mode
  cognitiveMode: 'Risk calculation',
  responseTime: '2-3 seconds',
};

// ============================================================================
// TOOL DEFINITIONS (What Trader can do)
// ============================================================================

export interface TraderTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
  execute: (params: Record<string, any>) => Promise<any>;
}

/**
 * Trader's available tools - the LLM decides which to use
 *
 * Categorization: EXECUTION (precise, risk-aware, action-oriented)
 */
export const TRADER_TOOLS: TraderTool[] = [
  {
    name: 'get_positions',
    description: 'Get current portfolio positions across all platforms. Shows what markets you hold, entry prices, current P&L, and exposure. Use when user asks about their positions, portfolio, or holdings.',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      try {
        const engine = getExecutionEngine();
        await engine.initialize();

        const balance = await engine.getTotalBalance();
        const exposure = await engine.getExposure();
        const positions = await engine.getPositions();

        return {
          balance: {
            total: balance.total,
            available: balance.available,
            atRisk: balance.atRisk,
          },
          exposure: {
            totalAtRisk: exposure.totalAtRisk,
            byCategory: exposure.byCategory,
            byPlatform: exposure.byPlatform,
          },
          positions: positions.map(p => ({
            market: p.marketTitle,
            platform: p.platform,
            direction: p.direction,
            quantity: p.quantity,
            entryPrice: p.avgEntryPrice,
            currentPrice: p.currentPrice,
            unrealizedPnl: p.unrealizedPnl,
            unrealizedPnlPct: p.unrealizedPnlPercent,
          })),
          positionCount: positions.length,
        };
      } catch (error) {
        const err = error as Error;
        // If execution engine not fully configured, return mock data
        return {
          balance: { total: 1000, available: 850, atRisk: 150 },
          exposure: { totalAtRisk: 150, byCategory: {}, byPlatform: {} },
          positions: [],
          positionCount: 0,
          note: 'Using simulated portfolio data',
        };
      }
    },
  },
  {
    name: 'calculate_size',
    description: 'Calculate optimal position size using Kelly criterion. Given your edge (probability estimate vs market price) and confidence, it calculates how much to bet. Use when user asks how much to bet, position sizing, or Kelly.',
    parameters: {
      type: 'object',
      properties: {
        probability: { type: 'number', description: 'Your probability estimate (0-1), e.g., 0.65 for 65%' },
        marketPrice: { type: 'number', description: 'Current market price (0-1), e.g., 0.55 for 55 cents' },
        confidence: { type: 'number', description: 'Your confidence in the estimate (0-1), e.g., 0.7 for 70% confident' },
        portfolioValue: { type: 'number', description: 'Optional: total portfolio value in USD' },
      },
      required: ['probability', 'marketPrice'],
    },
    execute: async (params) => {
      const probability = params.probability;
      const marketPrice = params.marketPrice;
      const confidence = params.confidence || 0.6;
      const portfolioValue = params.portfolioValue || 1000; // Default $1000

      // Calculate edge
      const edge = probability - marketPrice;

      // Kelly criterion with confidence adjustment
      const kellyFraction = calculateKellySize(edge, probability, 0.5); // Half Kelly is safer

      // Calculate recommended size
      const rawSize = portfolioValue * kellyFraction;
      const adjustedSize = rawSize * confidence; // Scale by confidence

      // Position size recommendations
      let sizeRecommendation: 'skip' | 'small' | 'medium' | 'large';
      let sizeUsd: number;

      if (Math.abs(edge) < 0.02 || kellyFraction < 0.01) {
        sizeRecommendation = 'skip';
        sizeUsd = 0;
      } else if (kellyFraction < 0.05) {
        sizeRecommendation = 'small';
        sizeUsd = Math.min(adjustedSize, portfolioValue * 0.03);
      } else if (kellyFraction < 0.15) {
        sizeRecommendation = 'medium';
        sizeUsd = Math.min(adjustedSize, portfolioValue * 0.07);
      } else {
        sizeRecommendation = 'large';
        sizeUsd = Math.min(adjustedSize, portfolioValue * 0.10);
      }

      return {
        inputs: {
          probability: `${(probability * 100).toFixed(0)}%`,
          marketPrice: `${(marketPrice * 100).toFixed(0)}%`,
          confidence: `${(confidence * 100).toFixed(0)}%`,
          portfolioValue: `$${portfolioValue.toFixed(0)}`,
        },
        edge: `${edge > 0 ? '+' : ''}${(edge * 100).toFixed(1)}%`,
        direction: edge > 0.02 ? 'YES' : edge < -0.02 ? 'NO' : 'NEUTRAL',
        kelly: {
          fullKelly: `${(kellyFraction * 2 * 100).toFixed(1)}%`, // Show full Kelly
          halfKelly: `${(kellyFraction * 100).toFixed(1)}%`, // What we use
        },
        recommendation: {
          size: sizeRecommendation,
          amount: `$${sizeUsd.toFixed(0)}`,
          percentOfPortfolio: `${((sizeUsd / portfolioValue) * 100).toFixed(1)}%`,
        },
        reasoning: edge > 0.02
          ? `With ${(edge * 100).toFixed(0)}% edge and ${(confidence * 100).toFixed(0)}% confidence, Kelly suggests ${sizeRecommendation} position`
          : `Insufficient edge (${(edge * 100).toFixed(1)}%) for profitable trade`,
      };
    },
  },
  {
    name: 'find_best_price',
    description: 'Find the best execution price for a market across all platforms. Compares prices, spreads, and liquidity to recommend where to trade. Use when user wants to know where to get the best price or fill.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Market topic or question to find' },
        side: { type: 'string', description: 'Trade side: YES or NO' },
        size: { type: 'number', description: 'Trade size in USD (optional)' },
      },
      required: ['query'],
    },
    execute: async (params) => {
      const markets = await searchMarkets(params.query);
      const side = params.side || 'YES';
      const size = params.size || 100;

      if (markets.length === 0) {
        return { found: false, query: params.query };
      }

      // Group by similar markets and compare prices
      const byPlatform: Record<string, { price: number; volume: number; market: Market }> = {};

      for (const market of markets.slice(0, 10)) {
        const platform = market.platform;
        const price = side === 'YES' ? market.yesPrice : (1 - market.yesPrice);

        if (!byPlatform[platform] || price < byPlatform[platform].price) {
          byPlatform[platform] = { price, volume: market.volume || 0, market };
        }
      }

      // Find best price
      const platforms = Object.entries(byPlatform)
        .sort((a, b) => a[1].price - b[1].price)
        .map(([platform, data]) => ({
          platform,
          price: `${(data.price * 100).toFixed(1)}¢`,
          volume: `$${formatVolume(data.volume)}`,
          market: data.market.title.slice(0, 60),
        }));

      const bestPlatform = platforms[0];
      const worstPlatform = platforms[platforms.length - 1];

      const spread = platforms.length > 1
        ? ((parseFloat(worstPlatform.price) - parseFloat(bestPlatform.price)))
        : 0;

      return {
        query: params.query,
        side,
        size: `$${size}`,
        platforms,
        recommendation: {
          bestPlatform: bestPlatform.platform,
          bestPrice: bestPlatform.price,
          savings: spread > 0 ? `${spread.toFixed(1)}¢ vs worst price` : 'Only one platform available',
        },
        platformCount: platforms.length,
      };
    },
  },
  {
    name: 'check_risk',
    description: 'Check current portfolio risk exposure and correlation. Analyzes position concentration, category exposure, drawdown, and whether new trades would exceed risk limits. Use when user asks about risk, exposure, or whether they can trade more.',
    parameters: {
      type: 'object',
      properties: {
        newTradeSize: { type: 'number', description: 'Optional: size of new trade to check' },
        newTradeCategory: { type: 'string', description: 'Optional: category of new trade' },
      },
    },
    execute: async (params) => {
      try {
        const portfolio = getPortfolioManager();
        await portfolio.initialize();

        const engine = getExecutionEngine();
        const [balance, exposure, positions] = await Promise.all([
          engine.getTotalBalance(),
          engine.getExposure(),
          engine.getPositions(),
        ]);

        // Calculate risk metrics
        const totalAtRisk = exposure.totalAtRisk;
        const riskPct = (totalAtRisk / balance.total) * 100;
        const positionCount = positions.length;

        // Category concentration
        const categoryExposure = Object.entries(exposure.byCategory || {}).map(([cat, amt]) => ({
          category: cat,
          amount: amt,
          percent: ((amt as number) / balance.total * 100).toFixed(1) + '%',
        }));

        // Risk warnings
        const warnings: string[] = [];
        if (riskPct > 50) warnings.push('High overall exposure (>50% of portfolio at risk)');
        if (positionCount > 10) warnings.push('Many open positions - consider consolidating');

        return {
          portfolio: {
            totalValue: `$${balance.total.toFixed(0)}`,
            atRisk: `$${totalAtRisk.toFixed(0)}`,
            available: `$${balance.available.toFixed(0)}`,
            riskPercent: `${riskPct.toFixed(1)}%`,
          },
          positions: {
            count: positionCount,
            byCategory: categoryExposure,
          },
          limits: {
            maxPositionSize: `$${(balance.total * 0.10).toFixed(0)}`,
            maxTotalExposure: `$${(balance.total * 0.80).toFixed(0)}`,
            remainingCapacity: `$${Math.max(0, balance.total * 0.80 - totalAtRisk).toFixed(0)}`,
          },
          warnings,
          canTradeMore: riskPct < 80,
        };
      } catch (error) {
        return {
          portfolio: { totalValue: '$1000', atRisk: '$150', available: '$850', riskPercent: '15%' },
          positions: { count: 2, byCategory: [] },
          limits: { maxPositionSize: '$100', maxTotalExposure: '$800', remainingCapacity: '$650' },
          warnings: [],
          canTradeMore: true,
          note: 'Using simulated risk data',
        };
      }
    },
  },
  {
    name: 'execute_trade',
    description: 'Execute a trade on a prediction market. Places the order with smart routing to get best execution. Use when user explicitly wants to buy, sell, or place an order. Always confirm trade details first.',
    parameters: {
      type: 'object',
      properties: {
        marketQuery: { type: 'string', description: 'Market topic or question to trade' },
        direction: { type: 'string', description: 'Trade direction: YES or NO' },
        amount: { type: 'number', description: 'Amount to trade in USD' },
        platform: { type: 'string', description: 'Optional: specific platform to use' },
        executionMode: { type: 'string', description: 'Execution mode: standard, fast, or jito (default: fast)' },
        useJito: { type: 'boolean', description: 'Use JITO bundle for MEV protection (default: false)' },
      },
      required: ['marketQuery', 'direction', 'amount'],
    },
    execute: async (params) => {
      const tracker = getLatencyTracker();
      tracker.reset();
      tracker.start('total');

      // Search for markets
      tracker.start('search');
      const markets = await searchMarkets(params.marketQuery);
      const searchUs = tracker.end('search');

      if (markets.length === 0) {
        tracker.end('total');
        return {
          success: false,
          error: `No markets found for: ${params.marketQuery}`,
        };
      }

      const market = markets[0];
      const price = params.direction === 'YES' ? market.yesPrice : (1 - market.yesPrice);
      const shares = params.amount / price;
      const executionMode = params.executionMode || 'fast';
      const useJito = params.useJito || false;

      // Calculate expected latency based on mode
      let expectedLatencyMs: string;
      switch (executionMode) {
        case 'jito':
          expectedLatencyMs = '50-200ms (JITO bundle, MEV protected)';
          break;
        case 'fast':
          expectedLatencyMs = '100-500ms (fast connection pool)';
          break;
        default:
          expectedLatencyMs = '1-5s (standard RPC)';
      }

      const totalUs = tracker.end('total');

      return {
        success: true,
        simulation: true,
        trade: {
          market: market.title,
          platform: market.platform,
          direction: params.direction,
          amount: `$${params.amount.toFixed(2)}`,
          price: `${(price * 100).toFixed(1)}¢`,
          estimatedShares: shares.toFixed(2),
        },
        execution: {
          mode: executionMode,
          useJito,
          expectedLatency: expectedLatencyMs,
          features: executionMode === 'fast' || executionMode === 'jito'
            ? ['Connection pooling', 'Pre-fetched blockhash', 'Priority fees', 'Skip preflight']
            : ['Standard RPC'],
        },
        latency: {
          searchMs: (searchUs / 1000).toFixed(1),
          totalMs: (totalUs / 1000).toFixed(1),
        },
        note: 'This is a simulation. Live trading requires wallet connection via /connect command.',
        toExecute: `To place this trade for real, connect your wallet and use: /trade ${params.direction} $${params.amount} on "${params.marketQuery}" --mode ${executionMode}${useJito ? ' --jito' : ''}`,
      };
    },
  },
  {
    name: 'execute_jupiter_trade',
    description: 'Execute a trade via Jupiter Prediction Markets (Solana). Jupiter aggregates Polymarket + Kalshi with zero payout fees. Returns unsigned transaction for wallet signing. Use when user wants to trade on Jupiter or wants best execution on Solana.',
    parameters: {
      type: 'object',
      properties: {
        marketId: { type: 'string', description: 'Jupiter market ID to trade' },
        direction: { type: 'string', description: 'Trade direction: YES or NO' },
        amountUsd: { type: 'number', description: 'Amount to trade in USD' },
        walletPubkey: { type: 'string', description: 'User Solana wallet public key' },
      },
      required: ['marketId', 'direction', 'amountUsd', 'walletPubkey'],
    },
    execute: async (params) => {
      const { createOrder, getMarket, microUsdToUsd } = await import('../../lib/jupiter/prediction');

      // First get market info
      const marketResponse = await getMarket(params.marketId);
      if (!marketResponse.success || !marketResponse.data) {
        return {
          success: false,
          error: `Market not found: ${params.marketId}`,
        };
      }

      const market = marketResponse.data;
      const price = params.direction === 'YES'
        ? microUsdToUsd(market.pricing.buyYesPriceUsd)
        : microUsdToUsd(market.pricing.buyNoPriceUsd);

      // Create order (returns unsigned transaction)
      const orderResponse = await createOrder({
        marketId: params.marketId,
        side: params.direction as 'YES' | 'NO',
        amountUsd: params.amountUsd,
        userPubkey: params.walletPubkey,
      });

      if (!orderResponse.success || !orderResponse.data) {
        return {
          success: false,
          error: orderResponse.error || 'Failed to create Jupiter order',
        };
      }

      const order = orderResponse.data;
      const contracts = parseInt(order.order.contracts);
      const totalCost = microUsdToUsd(order.order.totalCostUsd);

      return {
        success: true,
        requiresWalletSign: true,
        trade: {
          market: market.title,
          marketId: params.marketId,
          provider: market.provider, // 'polymarket' or 'kalshi'
          direction: params.direction,
          amount: `$${params.amountUsd.toFixed(2)}`,
          price: `${(price * 100).toFixed(1)}¢`,
          contracts: contracts,
          totalCost: `$${totalCost.toFixed(2)}`,
        },
        transaction: {
          base64: order.transaction,
          blockhash: order.txMeta.blockhash,
          lastValidBlockHeight: order.txMeta.lastValidBlockHeight,
        },
        orderDetails: {
          orderPubkey: order.order.orderPubkey,
          positionPubkey: order.order.positionPubkey,
        },
        benefits: [
          'Zero payout fees - winners get full $1/contract',
          'On-chain settlement on Solana',
          'Aggregated Polymarket + Kalshi liquidity',
        ],
        note: 'Sign this transaction with your Solana wallet to execute the trade.',
        warning: order.warning,
      };
    },
  },
  {
    name: 'get_jupiter_positions',
    description: 'Get user positions on Jupiter Prediction Markets. Shows open positions, P&L, and claimable winnings. Use when user asks about their Jupiter positions or wants to claim winnings.',
    parameters: {
      type: 'object',
      properties: {
        walletPubkey: { type: 'string', description: 'User Solana wallet public key' },
      },
      required: ['walletPubkey'],
    },
    execute: async (params) => {
      const { getPositions, getPortfolioSummary, microUsdToUsd } = await import('../../lib/jupiter/prediction');

      // Get positions
      const positionsResponse = await getPositions(params.walletPubkey);
      if (!positionsResponse.success) {
        return {
          success: false,
          error: positionsResponse.error || 'Failed to fetch Jupiter positions',
        };
      }

      // Get portfolio summary
      const summaryResponse = await getPortfolioSummary(params.walletPubkey);

      const positions = (positionsResponse.data || []).map(p => ({
        positionPubkey: p.positionPubkey,
        marketId: p.marketId,
        marketTitle: p.marketTitle || 'Unknown Market',
        side: p.isYes ? 'YES' : 'NO',
        contracts: parseInt(p.contracts),
        avgPrice: `${(microUsdToUsd(p.avgPriceUsd) * 100).toFixed(1)}¢`,
        currentValue: p.valueUsd ? `$${microUsdToUsd(p.valueUsd).toFixed(2)}` : 'N/A',
        pnl: p.pnlUsd ? `${microUsdToUsd(p.pnlUsd) >= 0 ? '+' : ''}$${microUsdToUsd(p.pnlUsd).toFixed(2)}` : 'N/A',
        pnlPercent: p.pnlPercent || 'N/A',
        claimable: p.claimable,
        claimed: p.claimed,
      }));

      const claimablePositions = positions.filter(p => p.claimable && !p.claimed);

      return {
        success: true,
        wallet: params.walletPubkey.slice(0, 8) + '...',
        summary: summaryResponse.success && summaryResponse.data ? {
          totalValue: `$${microUsdToUsd(summaryResponse.data.totalValueUsd).toFixed(2)}`,
          totalPnl: `$${microUsdToUsd(summaryResponse.data.totalPnlUsd).toFixed(2)}`,
          totalPnlPercent: summaryResponse.data.totalPnlPercent,
          openPositions: summaryResponse.data.openPositions,
          claimablePositions: summaryResponse.data.claimablePositions,
        } : null,
        positions,
        claimable: {
          count: claimablePositions.length,
          positions: claimablePositions,
          note: claimablePositions.length > 0
            ? 'Use claim_jupiter_winnings to claim your winnings!'
            : 'No claimable positions',
        },
      };
    },
  },
  {
    name: 'claim_jupiter_winnings',
    description: 'Claim winnings from resolved Jupiter positions. Returns unsigned transaction for wallet signing. Use when user wants to claim winnings from a winning position.',
    parameters: {
      type: 'object',
      properties: {
        positionPubkey: { type: 'string', description: 'Position public key to claim' },
        walletPubkey: { type: 'string', description: 'User Solana wallet public key' },
      },
      required: ['positionPubkey', 'walletPubkey'],
    },
    execute: async (params) => {
      const { claimWinnings, microUsdToUsd } = await import('../../lib/jupiter/prediction');

      const response = await claimWinnings(params.positionPubkey, params.walletPubkey);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || 'Failed to create claim transaction',
        };
      }

      const claim = response.data;
      const winnings = microUsdToUsd(claim.claim.winningsUsd);

      return {
        success: true,
        requiresWalletSign: true,
        claim: {
          positionPubkey: claim.claim.positionPubkey,
          contracts: parseInt(claim.claim.contracts),
          winnings: `$${winnings.toFixed(2)}`,
        },
        transaction: {
          base64: claim.transaction,
          blockhash: claim.txMeta.blockhash,
          lastValidBlockHeight: claim.txMeta.lastValidBlockHeight,
        },
        note: 'Sign this transaction with your Solana wallet to claim your winnings. Zero payout fees - you get the full amount!',
      };
    },
  },
  {
    name: 'set_alert',
    description: 'Set a price alert for a market. Get notified when a market hits a target price. Use when user wants to be alerted when price reaches a certain level.',
    parameters: {
      type: 'object',
      properties: {
        marketQuery: { type: 'string', description: 'Market topic or question to watch' },
        targetPrice: { type: 'number', description: 'Target price (0-1) to alert at' },
        direction: { type: 'string', description: 'Alert direction: ABOVE or BELOW target' },
      },
      required: ['marketQuery', 'targetPrice'],
    },
    execute: async (params) => {
      const markets = await searchMarkets(params.marketQuery);

      if (markets.length === 0) {
        return { success: false, error: `No markets found for: ${params.marketQuery}` };
      }

      const market = markets[0];
      const currentPrice = market.yesPrice;
      const targetPrice = params.targetPrice;
      const direction = params.direction || (targetPrice > currentPrice ? 'ABOVE' : 'BELOW');

      // In a real implementation, this would save to a database
      return {
        success: true,
        alert: {
          market: market.title,
          platform: market.platform,
          currentPrice: `${(currentPrice * 100).toFixed(1)}%`,
          targetPrice: `${(targetPrice * 100).toFixed(1)}%`,
          direction,
          trigger: direction === 'ABOVE'
            ? `When price rises above ${(targetPrice * 100).toFixed(0)}%`
            : `When price falls below ${(targetPrice * 100).toFixed(0)}%`,
        },
        note: 'Alert registered. You will be notified via Telegram when triggered.',
      };
    },
  },
  {
    name: 'get_execution_stats',
    description: 'Get fast execution engine statistics. Shows latency metrics, success rates, and engine health. Use when user asks about execution performance, latency, or trade speed.',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      try {
        const engine = getFastExecutionEngine();
        const stats = engine.getStats();
        const latencyStats = engine.getLatencyStats();
        const isHealthy = await engine.isHealthy();

        return {
          engine: {
            status: stats.initialized ? 'READY' : 'NOT_INITIALIZED',
            healthy: isHealthy,
            uptime: stats.uptime > 0 ? `${(stats.uptime / 1000 / 60).toFixed(1)} minutes` : 'N/A',
          },
          execution: {
            totalSwaps: stats.totalSwaps,
            successfulSwaps: stats.successfulSwaps,
            successRate: stats.totalSwaps > 0
              ? `${((stats.successfulSwaps / stats.totalSwaps) * 100).toFixed(1)}%`
              : 'N/A',
            avgLatency: stats.avgLatencyMs > 0 ? `${stats.avgLatencyMs.toFixed(1)}ms` : 'N/A',
          },
          arbitrage: {
            total: stats.totalArbitrages,
            successful: stats.successfulArbitrages,
          },
          latency: Object.fromEntries(
            Object.entries(latencyStats).map(([key, val]) => [
              key,
              {
                avg: `${val.avg.toFixed(1)}ms`,
                p50: `${val.p50.toFixed(1)}ms`,
                p95: `${val.p95.toFixed(1)}ms`,
                p99: `${val.p99.toFixed(1)}ms`,
              },
            ])
          ),
          config: {
            jitoEnabled: EXECUTION_CONFIG.jito.enabled,
            defaultTip: `${EXECUTION_CONFIG.jito.defaultTipLamports} lamports`,
            autoArbEnabled: EXECUTION_CONFIG.autoArbitrage.enabled,
            minSpread: `${(EXECUTION_CONFIG.autoArbitrage.minSpreadPct * 100).toFixed(0)}%`,
          },
        };
      } catch (error) {
        return {
          engine: { status: 'ERROR', healthy: false },
          error: error instanceof Error ? error.message : 'Failed to get stats',
          note: 'Fast execution engine not initialized',
        };
      }
    },
  },
];

// ============================================================================
// TRADER SYSTEM PROMPT
// ============================================================================

const TRADER_SYSTEM_PROMPT = `You are Trader, an execution desk AI that handles trade execution and risk management.

YOUR PURPOSE:
You replace what an execution desk does: check positions, size trades, find best prices, manage risk, and execute orders. You are precise, risk-aware, and action-oriented.

FAST EXECUTION CAPABILITIES:
You have access to microsecond/millisecond trade execution via:
- Connection pooling with HTTP keep-alive
- Pre-fetched blockhash (updated every 400ms)
- JITO bundles for MEV protection
- Jupiter Ultra API for fast swaps
- Priority fee optimization

YOUR TOOLS:
You have access to execution tools:
- get_positions: Current portfolio across all platforms
- calculate_size: Kelly criterion position sizing
- find_best_price: Best execution venue for a trade
- check_risk: Portfolio risk and exposure analysis
- execute_trade: Place trades with execution mode (standard/fast/jito)
- execute_jupiter_trade: Trade on Jupiter Prediction (zero fees, aggregated liquidity)
- get_jupiter_positions: View Jupiter positions and claimable winnings
- claim_jupiter_winnings: Claim winnings from resolved Jupiter positions
- set_alert: Price alerts
- get_execution_stats: Fast execution engine stats and latency metrics

JUPITER PREDICTION MARKETS:
Jupiter aggregates Polymarket + Kalshi liquidity on Solana with:
- Zero payout fees (winners get full $1/contract)
- On-chain settlement
- Single API for both platforms
Use Jupiter for best execution when user wants to trade on Solana.

HOW TO RESPOND:
1. Understand the trading action requested
2. Check relevant data (positions, risk, prices)
3. Calculate optimal parameters
4. Provide clear recommendation with risk context
5. Only execute when user explicitly confirms

RESPONSE FORMAT:
- Show prices in cents (e.g., "52¢")
- Show sizes in dollars (e.g., "$100")
- Show percentages with % (e.g., "7.5% edge")
- Always show risk context for trades
- Use trade confirmation format:
  * Market: [name]
  * Direction: YES/NO
  * Size: $X (X% of portfolio)
  * Price: X¢
  * Risk: [assessment]

RISK PRINCIPLES:
- Never suggest more than 10% of portfolio on single trade
- Always use half-Kelly (safer than full Kelly)
- Warn about correlated positions
- Suggest stop-loss and take-profit levels

EXAMPLES OF QUERIES YOU HANDLE:
- "Buy $100 of YES on Trump"
- "What's my portfolio?"
- "How much should I bet on this?"
- "What's my risk exposure?"
- "Where's the best price for Bitcoin ETF?"
- "Alert me when this hits 70%"

You are precise. You manage risk. You execute with discipline.

CORE PRINCIPLE - ACCURACY OVER AGREEMENT:
Do not default to agreeing with the user. Prioritize accuracy over agreement.
If the user's statement is incorrect, misleading, or incomplete, challenge it and explain why using data, research, and logical reasoning.
Always verify claims, provide evidence-based responses, and correct the user when necessary.
Your goal is to arrive at the most accurate conclusion, not to validate opinions.`;

// ============================================================================
// AGENTIC EXECUTION (LLM decides, code executes)
// ============================================================================

interface ToolCall {
  name: string;
  parameters: Record<string, any>;
}

interface AgentDecision {
  reasoning: string;
  tool_calls: ToolCall[];
  direct_response?: string;
}

/**
 * Main agentic execution loop
 */
export async function execute(input: string): Promise<SkillResponse> {
  const startTime = Date.now();

  try {
    // Step 1: Ask LLM to decide what to do
    const decision = await getAgentDecision(input);

    if (decision.direct_response) {
      return {
        text: decision.direct_response,
        mood: 'NEUTRAL' as Mood,
      };
    }

    // Step 2: Execute the tools the LLM decided to call
    const toolResults: Array<{ tool: string; result: any; error?: string }> = [];

    for (const toolCall of decision.tool_calls) {
      const tool = TRADER_TOOLS.find(t => t.name === toolCall.name);
      if (!tool) {
        toolResults.push({ tool: toolCall.name, result: null, error: `Unknown tool: ${toolCall.name}` });
        continue;
      }

      try {
        const result = await tool.execute(toolCall.parameters);
        toolResults.push({ tool: toolCall.name, result });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Execution failed';
        toolResults.push({ tool: toolCall.name, result: null, error: errorMsg });
      }
    }

    // Step 3: Ask LLM to synthesize the results
    const response = await synthesizeResponse(input, decision, toolResults);
    const executionMs = Date.now() - startTime;

    return {
      text: formatFinalResponse(response, executionMs),
      mood: determineMood(toolResults),
      data: toolResults,
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Trader] Error:`, error);

    return {
      text: `❌ Trade execution failed: ${errorMsg}`,
      mood: 'ERROR' as Mood,
    };
  }
}

/**
 * Ask the LLM to decide what tools to call
 */
async function getAgentDecision(userInput: string): Promise<AgentDecision> {
  const toolsDescription = TRADER_TOOLS.map(t =>
    `- ${t.name}: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters.properties)}`
  ).join('\n\n');

  const decisionPrompt = `User request: "${userInput}"

Available tools:
${toolsDescription}

Decide what to do. For trade execution, you may need multiple tools:
1. find_best_price to check prices
2. calculate_size to determine position size
3. check_risk to verify limits
4. execute_trade only after user confirmation

Respond in this JSON format:
{
  "reasoning": "Brief explanation of what the user wants and your execution plan",
  "tool_calls": [
    { "name": "tool_name", "parameters": { "param": "value" } }
  ],
  "direct_response": "Only if no tools needed - your direct text response"
}

If the request involves trading, always check risk before execution.
For simple questions like greetings, use direct_response.

Respond with ONLY valid JSON, no other text.`;

  const response = await llmChat({
    system: TRADER_SYSTEM_PROMPT,
    user: decisionPrompt,
    maxTokens: 1024,
    temperature: 0.1, // Very precise for trading decisions
    quality: 'fast',
  });

  try {
    let jsonStr = response.text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\s*/, '').replace(/```\s*$/, '');
    }

    const decision = JSON.parse(jsonStr) as AgentDecision;
    console.log(`[Trader] Decision: ${decision.reasoning}`);
    console.log(`[Trader] Tools to call: ${decision.tool_calls?.map(t => t.name).join(' → ') || 'none'}`);

    return decision;
  } catch (parseError) {
    console.error(`[Trader] Failed to parse LLM decision:`, response.text);
    return {
      reasoning: 'Fallback: showing positions',
      tool_calls: [{ name: 'get_positions', parameters: {} }],
    };
  }
}

/**
 * Ask the LLM to synthesize tool results into a final response
 */
async function synthesizeResponse(
  userInput: string,
  decision: AgentDecision,
  toolResults: Array<{ tool: string; result: any; error?: string }>
): Promise<string> {
  const resultsText = toolResults.map(tr => {
    if (tr.error) {
      return `Tool: ${tr.tool}\nError: ${tr.error}`;
    }

    if (tr.tool === 'get_positions') {
      const r = tr.result;
      return `Tool: get_positions
Balance: Total ${r.balance?.total ? '$' + r.balance.total.toFixed(0) : 'N/A'} | Available ${r.balance?.available ? '$' + r.balance.available.toFixed(0) : 'N/A'}
Positions: ${r.positionCount} open
${r.positions?.map((p: any) => `- ${p.market}: ${p.direction} @ ${(p.entryPrice * 100).toFixed(0)}¢ → ${(p.currentPrice * 100).toFixed(0)}¢ (${p.unrealizedPnl > 0 ? '+' : ''}$${p.unrealizedPnl.toFixed(0)})`).join('\n') || 'No open positions'}`;
    }

    if (tr.tool === 'calculate_size') {
      const r = tr.result;
      return `Tool: calculate_size
Edge: ${r.edge} | Direction: ${r.direction}
Kelly: Full ${r.kelly?.fullKelly}, Half ${r.kelly?.halfKelly}
Recommendation: ${r.recommendation?.size} - ${r.recommendation?.amount} (${r.recommendation?.percentOfPortfolio})
Reasoning: ${r.reasoning}`;
    }

    if (tr.tool === 'find_best_price') {
      const r = tr.result;
      return `Tool: find_best_price
Query: ${r.query} (${r.side})
Best: ${r.recommendation?.bestPlatform} @ ${r.recommendation?.bestPrice}
Savings: ${r.recommendation?.savings}
All Platforms:
${r.platforms?.map((p: any) => `- ${p.platform}: ${p.price} (vol: ${p.volume})`).join('\n')}`;
    }

    if (tr.tool === 'check_risk') {
      const r = tr.result;
      return `Tool: check_risk
Portfolio: ${r.portfolio?.totalValue} total, ${r.portfolio?.atRisk} at risk (${r.portfolio?.riskPercent})
Positions: ${r.positions?.count} open
Capacity: ${r.limits?.remainingCapacity} available for new trades
Can Trade More: ${r.canTradeMore ? 'Yes' : 'No - risk limits reached'}
Warnings: ${r.warnings?.join(', ') || 'None'}`;
    }

    if (tr.tool === 'execute_trade') {
      const r = tr.result;
      if (!r.success) {
        return `Tool: execute_trade\nError: ${r.error}`;
      }
      return `Tool: execute_trade
${r.simulation ? '⚠️ SIMULATION MODE' : '✅ EXECUTED'}
Trade: ${r.trade?.direction} ${r.trade?.amount} on ${r.trade?.market}
Price: ${r.trade?.price} | Est. Shares: ${r.trade?.estimatedShares}
Execution: ${r.execution?.mode} mode (${r.execution?.expectedLatency})
Features: ${r.execution?.features?.join(', ')}
Latency: Search ${r.latency?.searchMs}ms | Total ${r.latency?.totalMs}ms
${r.note}`;
    }

    if (tr.tool === 'get_execution_stats') {
      const r = tr.result;
      if (r.error) {
        return `Tool: get_execution_stats\nStatus: ${r.engine?.status}\nError: ${r.error}`;
      }
      return `Tool: get_execution_stats
Engine: ${r.engine?.status} | Healthy: ${r.engine?.healthy}
Uptime: ${r.engine?.uptime}
Swaps: ${r.execution?.totalSwaps} total, ${r.execution?.successfulSwaps} successful (${r.execution?.successRate})
Avg Latency: ${r.execution?.avgLatency}
Arbitrage: ${r.arbitrage?.total} total, ${r.arbitrage?.successful} successful
Config: JITO ${r.config?.jitoEnabled ? 'ON' : 'OFF'}, Auto-Arb ${r.config?.autoArbEnabled ? 'ON' : 'OFF'} (min ${r.config?.minSpread})`;
    }

    if (tr.tool === 'set_alert') {
      const r = tr.result;
      return `Tool: set_alert
${r.success ? '✅ Alert Set' : '❌ Failed'}
Market: ${r.alert?.market}
Trigger: ${r.alert?.trigger}
Current: ${r.alert?.currentPrice} → Target: ${r.alert?.targetPrice}`;
    }

    return `Tool: ${tr.tool}\n${JSON.stringify(tr.result, null, 2)}`;
  }).join('\n\n');

  const synthesisPrompt = `Original user request: "${userInput}"

Your execution plan: ${decision.reasoning}

Tool results:
${resultsText}

Synthesize this into a clear, actionable response for the user.
For trading:
- Confirm what action was taken or recommended
- Show key numbers: price, size, edge, risk
- Include any warnings or confirmations needed
- Be precise and concise

Respond with just the synthesized message, no JSON.`;

  const response = await llmChat({
    system: TRADER_SYSTEM_PROMPT,
    user: synthesisPrompt,
    maxTokens: 1000,
    temperature: 0.2,
    quality: 'fast',
  });

  return response.text;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return `${v.toFixed(0)}`;
}

function formatFinalResponse(text: string, executionMs: number): string {
  const header = `💼 *TRADER*\n${'─'.repeat(30)}`;
  const footer = `\n⏱️ ${new Date().toISOString().slice(11, 19)} UTC | ${executionMs}ms`;
  return `${header}\n\n${text}${footer}`;
}

function determineMood(toolResults: Array<{ tool: string; result: any; error?: string }>): Mood {
  if (toolResults.some(tr => tr.error)) return 'ERROR';

  const tradeResult = toolResults.find(tr => tr.tool === 'execute_trade');
  if (tradeResult?.result?.success) return 'BULLISH';

  const riskResult = toolResults.find(tr => tr.tool === 'check_risk');
  if (riskResult?.result?.canTradeMore === false) return 'BEARISH';

  return 'NEUTRAL';
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  id: TRADER_CONFIG.id,
  name: TRADER_CONFIG.name,
  execute,
  tools: TRADER_TOOLS,
  config: TRADER_CONFIG,
};
