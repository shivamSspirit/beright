/**
 * Jupiter Prediction API Types
 *
 * TypeScript types for Jupiter's Prediction Markets API.
 * Jupiter aggregates Polymarket + Kalshi liquidity on Solana.
 *
 * API Reference: https://docs.jup.ag/docs/prediction-market-api/
 *
 * @author BeRight Protocol
 */

// =============================================================================
// EVENT & MARKET TYPES
// =============================================================================

/**
 * Jupiter Event - A prediction event containing one or more markets
 */
export interface JupiterEvent {
  eventId: string;
  title: string;
  description?: string;
  category?: JupiterCategory;
  status: JupiterEventStatus;
  imageUrl?: string;
  startTime?: string;  // ISO timestamp
  endTime?: string;    // ISO timestamp
  markets?: JupiterMarket[];
  metadata?: JupiterEventMetadata;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Jupiter Market - A single prediction market within an event
 */
export interface JupiterMarket {
  marketId: string;
  eventId: string;
  title: string;
  description?: string;
  status: JupiterMarketStatus;
  provider: JupiterProvider;  // 'polymarket' | 'kalshi'

  // Pricing (all values in micro USD - divide by 1_000_000)
  pricing: JupiterPricing;

  // On-chain data
  onChain?: JupiterOnChainData;

  // Metadata
  metadata?: JupiterMarketMetadata;

  // Timestamps
  openTime?: string;
  closeTime?: string;
  settlementTime?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Jupiter pricing data
 */
export interface JupiterPricing {
  buyYesPriceUsd: string;    // micro USD (divide by 1_000_000)
  buyNoPriceUsd: string;     // micro USD
  sellYesPriceUsd?: string;  // micro USD
  sellNoPriceUsd?: string;   // micro USD
  yesBidUsd?: string;        // Best bid for YES
  yesAskUsd?: string;        // Best ask for YES
  noBidUsd?: string;         // Best bid for NO
  noAskUsd?: string;         // Best ask for NO
  spreadUsd?: string;        // Spread in micro USD
  volume?: string;           // Total volume
  volume24h?: string;        // 24h volume
  liquidity?: string;        // Available liquidity
  openInterest?: string;     // Open interest
}

/**
 * Jupiter on-chain data (Solana)
 */
export interface JupiterOnChainData {
  marketPubkey: string;      // On-chain market address
  yesMint?: string;          // YES token SPL mint
  noMint?: string;           // NO token SPL mint
  vaultPubkey?: string;      // Escrow vault
  oraclePubkey?: string;     // Settlement oracle
}

/**
 * Event metadata
 */
export interface JupiterEventMetadata {
  title: string;
  description?: string;
  imageUrl?: string;
  source?: string;
  tags?: string[];
}

/**
 * Market metadata
 */
export interface JupiterMarketMetadata {
  title: string;
  subtitle?: string;
  yesLabel?: string;
  noLabel?: string;
  resolutionCriteria?: string;
  source?: string;
}

// =============================================================================
// ORDER & POSITION TYPES
// =============================================================================

/**
 * Order parameters for creating a new order
 */
export interface JupiterOrderParams {
  marketId: string;
  side: 'YES' | 'NO';
  amountUsd: number;         // Amount in USD
  maxPriceUsd?: number;      // Max price per contract (optional limit)
  userPubkey: string;        // User's Solana wallet
}

/**
 * Order creation response
 */
export interface JupiterOrderResponse {
  transaction: string;        // Base64 encoded unsigned transaction
  txMeta: {
    blockhash: string;
    lastValidBlockHeight: number;
  };
  order: {
    orderPubkey: string;
    positionPubkey: string;
    contracts: string;        // Number of contracts (u64 as string)
    pricePerContractUsd: string;  // micro USD
    totalCostUsd: string;     // micro USD
  };
  warning?: string;
}

/**
 * Jupiter order status
 */
export interface JupiterOrder {
  orderPubkey: string;
  ownerPubkey: string;
  marketId: string;
  side: 'YES' | 'NO';
  contracts: string;         // u64 as string
  priceUsd: string;          // micro USD
  filledContracts: string;   // How many filled
  status: JupiterOrderStatus;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Jupiter position
 */
export interface JupiterPosition {
  positionPubkey: string;
  ownerPubkey: string;
  marketId: string;
  eventId?: string;
  marketTitle?: string;
  isYes: boolean;
  contracts: string;         // u64 as string
  avgPriceUsd: string;       // micro USD - average entry price
  valueUsd?: string;         // Current value in micro USD
  pnlUsd?: string;           // Profit/Loss in micro USD
  pnlPercent?: string;       // P&L percentage
  claimable: boolean;        // Can be claimed (market resolved in favor)
  claimed: boolean;          // Already claimed
  settlementValue?: string;  // Settlement value if resolved
  createdAt: string;
  updatedAt?: string;
}

/**
 * Position close response
 */
export interface JupiterClosePositionResponse {
  transaction: string;
  txMeta: {
    blockhash: string;
    lastValidBlockHeight: number;
  };
  position: {
    positionPubkey: string;
    contracts: string;
    exitPriceUsd: string;
    proceeds: string;        // micro USD
  };
}

/**
 * Claim winnings response
 */
export interface JupiterClaimResponse {
  transaction: string;
  txMeta: {
    blockhash: string;
    lastValidBlockHeight: number;
  };
  claim: {
    positionPubkey: string;
    contracts: string;
    winningsUsd: string;     // micro USD (contracts * 1_000_000 for winners)
  };
}

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

export type JupiterCategory =
  | 'crypto'
  | 'politics'
  | 'sports'
  | 'economics'
  | 'entertainment'
  | 'science'
  | 'technology'
  | 'world'
  | 'other';

export type JupiterEventStatus =
  | 'upcoming'
  | 'active'
  | 'closed'
  | 'settled'
  | 'cancelled';

export type JupiterMarketStatus =
  | 'active'
  | 'suspended'
  | 'closed'
  | 'resolved_yes'
  | 'resolved_no'
  | 'cancelled';

export type JupiterOrderStatus =
  | 'pending'
  | 'open'
  | 'partially_filled'
  | 'filled'
  | 'cancelled'
  | 'expired';

export type JupiterProvider = 'polymarket' | 'kalshi';

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

/**
 * Event list request parameters
 */
export interface JupiterEventsParams {
  category?: JupiterCategory;
  status?: JupiterEventStatus[];
  provider?: JupiterProvider;
  limit?: number;
  offset?: number;
  sortBy?: 'volume' | 'created' | 'ending';
  sortOrder?: 'asc' | 'desc';
  includeMarkets?: boolean;
}

/**
 * Search parameters
 */
export interface JupiterSearchParams {
  query: string;
  category?: JupiterCategory;
  provider?: JupiterProvider;
  limit?: number;
  includeMarkets?: boolean;
}

/**
 * API response wrapper
 */
export interface JupiterApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert micro USD (string) to USD number
 */
export function microUsdToUsd(microUsd: string | undefined): number {
  if (!microUsd) return 0;
  return parseInt(microUsd, 10) / 1_000_000;
}

/**
 * Convert USD number to micro USD string
 */
export function usdToMicroUsd(usd: number): string {
  return Math.round(usd * 1_000_000).toString();
}

/**
 * Check if a market is tradeable (active and has liquidity)
 */
export function isTradeableMarket(market: JupiterMarket): boolean {
  return (
    market.status === 'active' &&
    !!market.pricing &&
    parseInt(market.pricing.liquidity || '0', 10) > 0
  );
}

/**
 * Check if a position is claimable (resolved in user's favor)
 */
export function isClaimablePosition(position: JupiterPosition): boolean {
  return position.claimable && !position.claimed;
}

/**
 * Get YES price from market (0-1 scale)
 */
export function getYesPrice(market: JupiterMarket): number {
  const priceUsd = microUsdToUsd(market.pricing.buyYesPriceUsd);
  // Jupiter uses $1 = 1 contract, so price is already 0-1 scale
  return Math.min(Math.max(priceUsd, 0), 1);
}

/**
 * Get NO price from market (0-1 scale)
 */
export function getNoPrice(market: JupiterMarket): number {
  const priceUsd = microUsdToUsd(market.pricing.buyNoPriceUsd);
  return Math.min(Math.max(priceUsd, 0), 1);
}

/**
 * Calculate spread from market pricing
 */
export function getSpread(market: JupiterMarket): number {
  if (!market.pricing.spreadUsd) {
    // Calculate from bid/ask if available
    const yesBid = microUsdToUsd(market.pricing.yesBidUsd);
    const yesAsk = microUsdToUsd(market.pricing.yesAskUsd);
    if (yesBid && yesAsk) {
      return yesAsk - yesBid;
    }
    return 0;
  }
  return microUsdToUsd(market.pricing.spreadUsd);
}
