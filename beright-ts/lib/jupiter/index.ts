/**
 * Jupiter Integration Module
 *
 * Combines Jupiter DEX (swaps) and Jupiter Prediction Markets.
 *
 * @author BeRight Protocol
 */

// Jupiter DEX (existing swap functionality)
export {
  JupiterClient,
  getJupiterClient,
  getJupiterQuote,
  getRandomJitoTipAccount,
  USDC_MINT,
  SOL_MINT,
  WSOL_MINT,
} from '../dflow/jupiter';

// Jupiter Prediction Markets (new)
export {
  // Client
  JupiterPredictionClient,
  getJupiterPredictionClient,
  JUPITER_PREDICTION_API,

  // Events
  getEvents,
  getEvent,
  searchEvents,
  getHotEvents,

  // Markets
  getMarket,
  getEventMarkets,
  getActiveMarkets,

  // Orders
  createOrder,
  getOrders,
  getOrderStatus,
  cancelOrder,

  // Positions
  getPositions,
  getPosition,
  closePosition,
  closeAllPositions,
  claimWinnings,
  claimAllWinnings,

  // Portfolio
  getPortfolioSummary,

  // Health
  isHealthy,
} from './prediction';

// Types
export * from './types';
