/**
 * Market Types for BeRight Protocol
 * Standardized interfaces for prediction market data
 */

export type Platform = 'polymarket' | 'kalshi' | 'limitless' | 'manifold' | 'metaculus';

/**
 * On-chain data for tokenized markets (Solana SPL tokens)
 * Only available for DFlow/Kalshi tokenized markets
 */
export interface OnChainData {
  yesMint: string | null;   // SPL token address for YES position
  noMint: string | null;    // SPL token address for NO position
  marketLedger: string | null;  // On-chain ledger address
}

/**
 * Live orderbook data from DFlow
 */
export interface OrderbookData {
  yesBid: number;
  yesAsk: number;
  noBid: number;
  noAsk: number;
  spread: number;
}

export interface Market {
  platform: Platform;
  marketId: string | null;
  title: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  yesPct: number;
  noPct: number;
  volume: number;
  volume24h?: number;  // 24h volume (DFlow)
  liquidity: number;
  endDate: Date | null;
  status: 'active' | 'resolved' | 'closed';
  url: string;
  // Tokenized market data (Solana SPL tokens) - only for DFlow/Kalshi
  onChain?: OnChainData;
  orderbook?: OrderbookData;
}

/**
 * Check if a market is tokenized (tradeable on Solana via wallet signing)
 * Only DFlow/Kalshi markets have SPL token addresses
 */
export function isTokenizedMarket(market: Market): boolean {
  return !!(market.onChain?.yesMint && market.onChain?.noMint);
}

/**
 * Tokenized market with guaranteed on-chain data
 * Use this type when you need markets that are definitely tradeable
 */
export interface TokenizedMarket extends Market {
  onChain: OnChainData & { yesMint: string; noMint: string };
  orderbook: OrderbookData;
}

export interface MarketEvent {
  platform: Platform;
  eventId: string | null;
  title: string;
  markets: Market[];
}

export interface ArbitrageOpportunity {
  topic: string;
  platformA: Platform;
  platformB: Platform;
  marketATitle: string;
  marketBTitle: string;
  priceAYes: number;
  priceBYes: number;
  spread: number;
  strategy: string;
  profitPercent: number;
  matchConfidence: number;
  volumeA: number;
  volumeB: number;
}

export interface OddsComparison {
  query: string;
  markets: Market[];
  byPlatform: Record<Platform, Market[]>;
  arbitrageOpportunities: ArbitrageOpportunity[];
}

// Platform API configuration
export interface PlatformConfig {
  name: Platform;
  baseUrl: string;
  requiresAuth: boolean;
  fee: number;
}
