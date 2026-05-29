/**
 * Orchestrator Module
 *
 * Exports all orchestrator-related types and utilities.
 *
 */

// Force-load handler modules so their registerHandler() side effects run.
import './handlers/hotMarkets';
import './handlers/brief';
import './handlers/research';
import './handlers/alpha';
import './handlers/dflowSearch';
import './handlers/quote';
import './handlers/trade';
import './handlers/positions';
import './handlers/portfolio';
import './handlers/pnl';
import './handlers/me';
import './handlers/calibration';
import './handlers/leaderboard';
import './handlers/compare';
import './handlers/predict';
import './handlers/smartPredict';
import './handlers/semanticPredict';
import './handlers/intelligence';
import './handlers/recommendations';
import './handlers/feedback';
import './handlers/learnings';
import './handlers/swap';
import './handlers/wallet';
import './handlers/follow';
import './handlers/signals';
import './handlers/alert';
import './handlers/whale';
import './handlers/arbitrage';
import './handlers/subscribe';
import './handlers/help';
import './handlers/settings';
import './handlers/semantic';
import './handlers/kalshiOverview';
import './handlers/kalshiMarkets';
import './handlers/kalshiBuy';
import './handlers/kalshiSell';
import './handlers/kalshiPositions';
import './handlers/kalshiBalance';
import './handlers/kalshiOrders';
import './handlers/kalshiCancel';

// Orchestrator types
export * from './types';

// Main orchestrator
export * from './orchestrator';

// Handler registry
export * from './handlers/registry';

// Handlers
export { hotMarketsHandler } from './handlers/hotMarkets';
export { briefHandler } from './handlers/brief';
export { researchHandler } from './handlers/research';
export { alphaHandler } from './handlers/alpha';
export { dflowSearchHandler } from './handlers/dflowSearch';
export { quoteHandler } from './handlers/quote';
export { tradeHandler } from './handlers/trade';
export { positionsHandler } from './handlers/positions';

// Portfolio & Analytics handlers
export { portfolioHandler } from './handlers/portfolio';
export { pnlHandler } from './handlers/pnl';
export { meHandler } from './handlers/me';
export { calibrationHandler } from './handlers/calibration';
export { leaderboardHandler } from './handlers/leaderboard';
export { compareHandler } from './handlers/compare';

// Predictions & Intelligence handlers
export { predictHandler } from './handlers/predict';
export { smartPredictHandler } from './handlers/smartPredict';
export { semanticPredictHandler } from './handlers/semanticPredict';
export { intelligenceHandler } from './handlers/intelligence';
export { recommendationsHandler } from './handlers/recommendations';
export { feedbackHandler } from './handlers/feedback';
export { learningsHandler } from './handlers/learnings';

// Trading & Execution handlers
export { swapHandler } from './handlers/swap';
export { walletHandler } from './handlers/wallet';
export { followHandler } from './handlers/follow';
export { signalsHandler } from './handlers/signals';

// Monitoring & Alerts handlers
export { alertHandler } from './handlers/alert';
export { whaleHandler } from './handlers/whale';
export { arbitrageHandler } from './handlers/arbitrage';
export { subscribeHandler } from './handlers/subscribe';

// System handlers
export { helpHandler } from './handlers/help';
export { settingsHandler } from './handlers/settings';
export { semanticHandler } from './handlers/semantic';

// Kalshi handlers
export { kalshiOverviewHandler } from './handlers/kalshiOverview';
export { kalshiMarketsHandler } from './handlers/kalshiMarkets';
export { kalshiBuyHandler } from './handlers/kalshiBuy';
export { kalshiSellHandler } from './handlers/kalshiSell';
export { kalshiPositionsHandler } from './handlers/kalshiPositions';
export { kalshiBalanceHandler } from './handlers/kalshiBalance';
export { kalshiOrdersHandler } from './handlers/kalshiOrders';
export { kalshiCancelHandler } from './handlers/kalshiCancel';
