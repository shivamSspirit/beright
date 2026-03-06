/**
 * DFlow Module - Unified exports
 *
 * Complete integration for DFlow tokenized prediction markets on Solana:
 * - API: Market data, search, orderbook, trades
 * - WebSocket: Real-time prices and trade updates
 * - Executor: Transaction signing and submission
 * - Wallet: Multi-wallet support (Keypair, Privy, Phantom)
 * - Positions: On-chain position tracking
 * - Jupiter: DEX aggregator for best execution
 * - Router: Smart order routing (DFlow vs Jupiter)
 *
 * @author BeRight Protocol
 */

// Core API client
export * from './api';

// Real-time WebSocket
export * from './websocket';

// Transaction execution
export * from './executor';

// Wallet management (excluding constants that conflict with jupiter)
export type {
  WalletProvider,
  WalletBalance,
  StoredWallet,
  WalletAdapterInterface,
} from './wallet';

export {
  KeypairWallet,
  AdapterWallet,
  TelegramWalletStore,
  getWalletBalance,
  getTokenBalance,
  getAllTokenAccounts,
  getTelegramWalletStore,
  getDefaultTradingWallet,
} from './wallet';

// Position tracking
export * from './positions';

// Jupiter integration (smart routing)
export type {
  JupiterQuote,
  JupiterRoutePlan,
  JupiterSwapResponse,
  JupiterPrice,
  JupiterQuoteParams,
  JupiterSwapParams,
  JupiterExecutionResult,
} from './jupiter';

export {
  JupiterClient,
  getJupiterClient,
  getJupiterQuote,
  getRandomJitoTipAccount,
  // Re-export constants from here
  USDC_MINT,
  SOL_MINT,
  WSOL_MINT,
} from './jupiter';

// Smart order router (excluding executeSmartTrade which is in executor)
export type {
  RouteVenue,
  RouteQuote,
  RoutingResult,
  RoutingOptions,
} from './router';

export {
  SmartOrderRouter,
  getSmartRouter,
  findBestRoute,
  // Rename router's version to avoid conflict
  executeSmartTrade as executeSmartRouterTrade,
} from './router';
