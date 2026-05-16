/**
 * Demo Mode Module
 *
 * Export all demo-related functionality from a single entry point.
 *
 * Usage:
 *   import { isDemo, getMarketsData, getModeInfo } from '@/lib/demo';
 */

// Mode detection
export { isDemo, isProduction, getMode, getModeConfig, getSolanaRpc, getSolanaNetwork, logModeInfo } from '../mode';

// Data providers (main entry points for API routes)
export {
  getMarketsData,
  getMarketData,
  getLeaderboardData,
  commitPrediction,
  executeTrade,
  getWalletBalance,
  getModeInfo,
  isDemoMarket,
  isDemoWallet,
  isDemoTransaction,
} from './dataProvider';

// Mock data (for direct access if needed)
export {
  DEMO_MARKETS,
  getDemoMarkets,
  getHotDemoMarkets,
  searchDemoMarkets,
  getDemoMarketById,
  getDemoMarketsWithJitter,
  type DemoMarket,
} from './mockMarkets';

// Mock leaderboard
export {
  DEMO_LEADERBOARD,
  getDemoLeaderboard,
  getDemoForecasterById,
  getDemoForecasterByWallet,
  getDemoLeaderboardSummary,
  type DemoForecaster,
} from './mockLeaderboard';

// Mock confirmations
export {
  generateMockSignature,
  generateMockTransaction,
  generateMockPredictionCommit,
  generateMockTradeExecution,
  simulateConfirmation,
  simulateTransactionLifecycle,
  getDemoWalletBalance,
  DEMO_WALLET,
  getExplorerUrl,
  type MockTransaction,
  type MockPredictionCommit,
  type MockTradeExecution,
} from './mockConfirmations';
