/**
 * Demo Mode - Data Provider
 *
 * Central abstraction that provides data based on current mode.
 * The UI calls these functions - they return demo or production data
 * transparently based on BERIGHT_MODE.
 *
 * This is the key architectural piece that makes mode switching seamless.
 */

import { isDemo, getModeConfig } from '../mode';
import {
  getDemoMarkets,
  getHotDemoMarkets,
  searchDemoMarkets,
  getDemoMarketById,
  getDemoMarketsWithJitter,
  DemoMarket,
} from './mockMarkets';
import {
  getDemoLeaderboard,
  getDemoForecasterById,
  getDemoForecasterByWallet,
  getDemoLeaderboardSummary,
  DemoForecaster,
} from './mockLeaderboard';
import {
  generateMockPredictionCommit,
  generateMockTradeExecution,
  getDemoWalletBalance,
  MockPredictionCommit,
  MockTradeExecution,
} from './mockConfirmations';

// ============================================
// MARKET DATA PROVIDER
// ============================================

/**
 * Get hot markets - returns demo or live data based on mode
 */
export async function getMarketsData(options?: {
  limit?: number;
  category?: string;
  search?: string;
}): Promise<{
  markets: DemoMarket[];
  source: 'demo' | 'live';
  count: number;
}> {
  const limit = options?.limit || 20;

  if (isDemo()) {
    let markets: DemoMarket[];

    if (options?.search) {
      markets = searchDemoMarkets(options.search, limit);
    } else if (options?.category) {
      const allMarkets = getDemoMarkets();
      markets = allMarkets
        .filter(m => m.category === options.category)
        .slice(0, limit);
    } else {
      // Add price jitter for live feel
      markets = getDemoMarketsWithJitter(limit);
    }

    return {
      markets,
      source: 'demo',
      count: markets.length,
    };
  }

  // Production mode - this will be filled in by actual API calls
  // For now, throw to indicate production path needs implementation
  throw new Error('Production data fetching should go through existing APIs');
}

/**
 * Get single market by ID
 */
export async function getMarketData(marketId: string): Promise<{
  market: DemoMarket | null;
  source: 'demo' | 'live';
}> {
  if (isDemo()) {
    const market = getDemoMarketById(marketId);
    return {
      market: market || null,
      source: 'demo',
    };
  }

  throw new Error('Production data fetching should go through existing APIs');
}

// ============================================
// LEADERBOARD DATA PROVIDER
// ============================================

/**
 * Get leaderboard data
 */
export async function getLeaderboardData(options?: {
  limit?: number;
  userId?: string;
  walletAddress?: string;
}): Promise<{
  leaderboard: DemoForecaster[];
  userRank: number | null;
  userStats: ReturnType<typeof getDemoForecasterById> | null;
  source: 'demo' | 'live';
  summary: ReturnType<typeof getDemoLeaderboardSummary>;
}> {
  if (isDemo()) {
    const limit = options?.limit || 50;
    const leaderboard = getDemoLeaderboard(limit);

    let userRank: number | null = null;
    let userStats: DemoForecaster | null = null;

    if (options?.walletAddress) {
      userStats = getDemoForecasterByWallet(options.walletAddress) || null;
      if (userStats) {
        userRank = userStats.rank;
      }
    } else if (options?.userId) {
      userStats = getDemoForecasterById(options.userId) || null;
      if (userStats) {
        userRank = userStats.rank;
      }
    }

    return {
      leaderboard,
      userRank,
      userStats,
      source: 'demo',
      summary: getDemoLeaderboardSummary(),
    };
  }

  throw new Error('Production data fetching should go through existing APIs');
}

// ============================================
// PREDICTION COMMIT PROVIDER
// ============================================

/**
 * Commit a prediction - returns demo or real transaction
 */
export async function commitPrediction(params: {
  question: string;
  probability: number;
  direction: 'YES' | 'NO';
  walletAddress?: string;
}): Promise<{
  success: boolean;
  commit: MockPredictionCommit | null;
  source: 'demo' | 'live';
  message: string;
}> {
  if (isDemo()) {
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 800));

    const commit = generateMockPredictionCommit({
      question: params.question,
      probability: params.probability,
      direction: params.direction,
    });

    return {
      success: true,
      commit,
      source: 'demo',
      message: 'Prediction committed to Devnet (Demo Mode)',
    };
  }

  throw new Error('Production commits should go through existing on-chain logic');
}

// ============================================
// TRADE EXECUTION PROVIDER
// ============================================

/**
 * Execute a trade - returns demo or real execution
 */
export async function executeTrade(params: {
  market: { ticker: string; title: string };
  side: 'YES' | 'NO';
  size: number;
  price: number;
  walletAddress?: string;
}): Promise<{
  success: boolean;
  execution: MockTradeExecution | null;
  source: 'demo' | 'live';
  message: string;
}> {
  if (isDemo()) {
    // Simulate trade execution time
    await new Promise(resolve => setTimeout(resolve, 1200));

    const execution = generateMockTradeExecution({
      market: params.market,
      side: params.side,
      size: params.size,
      price: params.price,
    });

    return {
      success: true,
      execution,
      source: 'demo',
      message: 'Trade executed on Devnet (Demo Mode - Paper Trading)',
    };
  }

  throw new Error('Production trades should go through existing execution logic');
}

// ============================================
// WALLET BALANCE PROVIDER
// ============================================

/**
 * Get wallet balance - returns demo or real balance
 */
export async function getWalletBalance(walletAddress?: string): Promise<{
  sol: number;
  usdc: number;
  totalUsd: number;
  source: 'demo' | 'live';
}> {
  if (isDemo()) {
    const balance = getDemoWalletBalance();
    return {
      ...balance,
      source: 'demo',
    };
  }

  throw new Error('Production balances should go through existing wallet logic');
}

// ============================================
// MODE INFO PROVIDER
// ============================================

/**
 * Get current mode info for frontend display
 */
export function getModeInfo(): {
  mode: 'demo' | 'production';
  network: 'devnet' | 'mainnet-beta';
  networkLabel: string;
  tradingMode: 'paper' | 'live';
  showWaitlist: boolean;
  features: {
    trading: boolean;
    predictions: boolean;
    leaderboard: boolean;
    agents: boolean;
  };
} {
  const config = getModeConfig();

  return {
    mode: isDemo() ? 'demo' : 'production',
    network: config.solanaNetwork,
    networkLabel: config.networkLabel,
    tradingMode: config.tradingMode,
    showWaitlist: config.showWaitlist,
    features: {
      trading: config.tradingEnabled,
      predictions: true,
      leaderboard: true,
      agents: true,
    },
  };
}

// ============================================
// UTILITY: CHECK IF DEMO DATA
// ============================================

/**
 * Check if a market ID is from demo data
 */
export function isDemoMarket(marketId: string): boolean {
  return marketId.startsWith('demo-') || marketId.startsWith('DEMO-');
}

/**
 * Check if a wallet address is a demo wallet
 */
export function isDemoWallet(walletAddress: string): boolean {
  return walletAddress.startsWith('Demo');
}

/**
 * Check if a transaction signature is from demo mode
 */
export function isDemoTransaction(signature: string): boolean {
  // In demo mode, all transactions are simulated
  // We can't truly distinguish without tracking, but this helps
  return isDemo();
}
