/**
 * Jupiter Prediction API Client
 *
 * Client library for Jupiter's Prediction Markets API.
 * Jupiter aggregates Polymarket + Kalshi liquidity on Solana with:
 * - Zero payout fees (winners get full $1/contract)
 * - On-chain settlement via keeper network
 * - Single API key for all markets
 *
 * API Reference: https://docs.jup.ag/docs/prediction-market-api/
 *
 * @author BeRight Protocol
 */

import {
  JupiterEvent,
  JupiterMarket,
  JupiterPosition,
  JupiterOrder,
  JupiterOrderParams,
  JupiterOrderResponse,
  JupiterClosePositionResponse,
  JupiterClaimResponse,
  JupiterEventsParams,
  JupiterSearchParams,
  JupiterApiResponse,
} from './types';

// =============================================================================
// CONFIGURATION
// =============================================================================

const JUPITER_PREDICTION_API = process.env.JUPITER_PREDICTION_API_URL || 'https://api.jup.ag/prediction/v1';
const REQUEST_TIMEOUT = 15000;

/**
 * Platform fee configuration for BeRight revenue
 *
 * Jupiter Prediction supports referral fees on trades:
 * - referralAccount: Solana wallet that receives platform fees
 * - feeBps: Fee in basis points (100 bps = 1%)
 *
 * Revenue model:
 * - Typical fee: 50-100 bps (0.5-1%)
 * - Fee is taken from the trade amount before execution
 * - Fees accumulate in the referral account
 */
export const PLATFORM_FEE_CONFIG = {
  // Solana wallet address that receives platform fees
  referralAccount: process.env.JUPITER_PREDICTION_REFERRAL_ACCOUNT || process.env.JUPITER_REFERRAL_ACCOUNT,

  // Fee in basis points (100 = 1%, 50 = 0.5%)
  // BeRight charges 1% (100 bps) on all Jupiter Prediction trades
  feeBps: parseInt(process.env.JUPITER_PREDICTION_FEE_BPS || process.env.JUPITER_FEE_BPS || '100'),

  // Whether to enable platform fees
  enabled: process.env.JUPITER_PREDICTION_FEE_ENABLED !== 'false',
};

/**
 * Get API key from environment
 */
function getApiKey(): string | undefined {
  return (
    process.env.JUPITER_PREDICTION_API_KEY
    || process.env.JUPITER_API_KEY
    || process.env.JUP_API_KEY
  );
}

/**
 * Get platform fee config for order requests
 */
function getPlatformFeeParams(): { referralAccount?: string; feeBps?: number } | undefined {
  if (!PLATFORM_FEE_CONFIG.enabled || !PLATFORM_FEE_CONFIG.referralAccount) {
    return undefined;
  }
  return {
    referralAccount: PLATFORM_FEE_CONFIG.referralAccount,
    feeBps: PLATFORM_FEE_CONFIG.feeBps,
  };
}

/**
 * Build headers for API requests
 */
function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const apiKey = getApiKey();
  if (apiKey) {
    // Jupiter docs specify `x-api-key` (header name is case-insensitive, but keep it exact).
    headers['x-api-key'] = apiKey;
  }

  return headers;
}

// =============================================================================
// API FETCH WRAPPER
// =============================================================================

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Fetch with error handling and timeout
 */
async function fetchApi<T>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(url, {
      ...options,
      headers: {
        ...buildHeaders(),
        ...options?.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Jupiter Prediction] API error ${response.status}:`, errorText);
      if (response.status === 401 || response.status === 403) {
        const hasKey = !!getApiKey();
        return {
          success: false,
          error: hasKey
            ? `Jupiter API auth failed (HTTP ${response.status}). Check that your API key is valid/active.`
            : `Jupiter API key missing (HTTP ${response.status}). Set JUPITER_PREDICTION_API_KEY in the backend environment.`,
        };
      }
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const data = await response.json();

    // Handle Jupiter API response wrapper
    if ('success' in data && !data.success) {
      return {
        success: false,
        error: data.error?.message || 'API request failed',
      };
    }

    // Unwrap data if wrapped
    return {
      success: true,
      data: 'data' in data ? data.data : data,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return { success: false, error: 'Request timeout' };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'Unknown error' };
  }
}

// =============================================================================
// EVENTS API
// =============================================================================

/**
 * Get prediction events
 */
export async function getEvents(
  params: JupiterEventsParams = {}
): Promise<ApiResponse<JupiterEvent[]>> {
  const url = new URL(`${JUPITER_PREDICTION_API}/events`);

  if (params.category) url.searchParams.set('category', params.category);
  if (params.status?.length) url.searchParams.set('status', params.status.join(','));
  if (params.provider) url.searchParams.set('provider', params.provider);
  if (params.limit) url.searchParams.set('limit', params.limit.toString());
  if (params.offset) url.searchParams.set('offset', params.offset.toString());
  if (params.sortBy) url.searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) url.searchParams.set('sortOrder', params.sortOrder);
  if (params.includeMarkets !== undefined) {
    url.searchParams.set('includeMarkets', params.includeMarkets.toString());
  }

  return fetchApi<JupiterEvent[]>(url.toString());
}

/**
 * Get a single event by ID
 */
export async function getEvent(eventId: string): Promise<ApiResponse<JupiterEvent>> {
  return fetchApi<JupiterEvent>(`${JUPITER_PREDICTION_API}/events/${eventId}`);
}

/**
 * Search events
 */
export async function searchEvents(
  params: JupiterSearchParams
): Promise<ApiResponse<JupiterEvent[]>> {
  const url = new URL(`${JUPITER_PREDICTION_API}/events/search`);

  url.searchParams.set('q', params.query);
  if (params.category) url.searchParams.set('category', params.category);
  if (params.provider) url.searchParams.set('provider', params.provider);
  if (params.limit) url.searchParams.set('limit', params.limit.toString());
  if (params.includeMarkets !== undefined) {
    url.searchParams.set('includeMarkets', params.includeMarkets.toString());
  }

  return fetchApi<JupiterEvent[]>(url.toString());
}

/**
 * Get hot/trending events
 */
export async function getHotEvents(
  limit: number = 20
): Promise<ApiResponse<JupiterEvent[]>> {
  return getEvents({
    status: ['active'],
    sortBy: 'volume',
    sortOrder: 'desc',
    limit,
    includeMarkets: true,
  });
}

// =============================================================================
// MARKETS API
// =============================================================================

/**
 * Get a single market by ID
 */
export async function getMarket(marketId: string): Promise<ApiResponse<JupiterMarket>> {
  return fetchApi<JupiterMarket>(`${JUPITER_PREDICTION_API}/markets/${marketId}`);
}

/**
 * Get markets by event
 */
export async function getEventMarkets(eventId: string): Promise<ApiResponse<JupiterMarket[]>> {
  return fetchApi<JupiterMarket[]>(`${JUPITER_PREDICTION_API}/events/${eventId}/markets`);
}

/**
 * Get all active markets
 */
export async function getActiveMarkets(
  params: {
    provider?: 'polymarket' | 'kalshi';
    category?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<ApiResponse<JupiterMarket[]>> {
  const url = new URL(`${JUPITER_PREDICTION_API}/markets`);

  url.searchParams.set('status', 'active');
  if (params.provider) url.searchParams.set('provider', params.provider);
  if (params.category) url.searchParams.set('category', params.category);
  if (params.limit) url.searchParams.set('limit', params.limit.toString());
  if (params.offset) url.searchParams.set('offset', params.offset.toString());

  return fetchApi<JupiterMarket[]>(url.toString());
}

// =============================================================================
// ORDERS API
// =============================================================================

/**
 * Create an order (returns unsigned transaction)
 *
 * The returned transaction must be signed by the user's wallet and submitted to Solana.
 *
 * Platform fees:
 * - If JUPITER_PREDICTION_REFERRAL_ACCOUNT is set, platform fees are included
 * - Fee amount = amountUsd * (feeBps / 10000)
 * - Fees are sent to the referral account on trade execution
 */
export async function createOrder(
  params: JupiterOrderParams
): Promise<ApiResponse<JupiterOrderResponse>> {
  // Build order request with optional platform fees
  const orderRequest: Record<string, any> = {
    marketId: params.marketId,
    side: params.side,
    amountUsd: Math.round(params.amountUsd * 1_000_000), // Convert to micro USD
    maxPriceUsd: params.maxPriceUsd ? Math.round(params.maxPriceUsd * 1_000_000) : undefined,
    userPubkey: params.userPubkey,
  };

  // Add platform fee if configured (BeRight revenue)
  const platformFee = getPlatformFeeParams();
  if (platformFee) {
    orderRequest.referralAccount = platformFee.referralAccount;
    orderRequest.feeBps = platformFee.feeBps;
  }

  return fetchApi<JupiterOrderResponse>(`${JUPITER_PREDICTION_API}/orders`, {
    method: 'POST',
    body: JSON.stringify(orderRequest),
  });
}

/**
 * Get orders for a wallet
 */
export async function getOrders(
  ownerPubkey: string,
  params: {
    status?: 'open' | 'filled' | 'all';
    limit?: number;
  } = {}
): Promise<ApiResponse<JupiterOrder[]>> {
  const url = new URL(`${JUPITER_PREDICTION_API}/orders`);

  url.searchParams.set('owner', ownerPubkey);
  if (params.status) url.searchParams.set('status', params.status);
  if (params.limit) url.searchParams.set('limit', params.limit.toString());

  return fetchApi<JupiterOrder[]>(url.toString());
}

/**
 * Get a single order status
 */
export async function getOrderStatus(orderPubkey: string): Promise<ApiResponse<JupiterOrder>> {
  return fetchApi<JupiterOrder>(`${JUPITER_PREDICTION_API}/orders/${orderPubkey}`);
}

/**
 * Cancel an order (returns unsigned transaction)
 */
export async function cancelOrder(
  orderPubkey: string,
  ownerPubkey: string
): Promise<ApiResponse<{ transaction: string; txMeta: { blockhash: string; lastValidBlockHeight: number } }>> {
  return fetchApi(`${JUPITER_PREDICTION_API}/orders/${orderPubkey}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ ownerPubkey }),
  });
}

// =============================================================================
// POSITIONS API
// =============================================================================

/**
 * Get all positions for a wallet
 */
export async function getPositions(
  ownerPubkey: string,
  params: {
    status?: 'open' | 'closed' | 'claimable' | 'all';
    limit?: number;
  } = {}
): Promise<ApiResponse<JupiterPosition[]>> {
  const url = new URL(`${JUPITER_PREDICTION_API}/positions`);

  url.searchParams.set('owner', ownerPubkey);
  if (params.status) url.searchParams.set('status', params.status);
  if (params.limit) url.searchParams.set('limit', params.limit.toString());

  return fetchApi<JupiterPosition[]>(url.toString());
}

/**
 * Get a single position
 */
export async function getPosition(positionPubkey: string): Promise<ApiResponse<JupiterPosition>> {
  return fetchApi<JupiterPosition>(`${JUPITER_PREDICTION_API}/positions/${positionPubkey}`);
}

/**
 * Close a position (returns unsigned transaction)
 */
export async function closePosition(
  positionPubkey: string,
  ownerPubkey: string
): Promise<ApiResponse<JupiterClosePositionResponse>> {
  return fetchApi<JupiterClosePositionResponse>(
    `${JUPITER_PREDICTION_API}/positions/${positionPubkey}/close`,
    {
      method: 'POST',
      body: JSON.stringify({ ownerPubkey }),
    }
  );
}

/**
 * Close all positions for a market (returns unsigned transaction)
 */
export async function closeAllPositions(
  ownerPubkey: string,
  marketId?: string
): Promise<ApiResponse<{ transactions: JupiterClosePositionResponse[] }>> {
  const body: Record<string, string> = { ownerPubkey };
  if (marketId) body.marketId = marketId;

  return fetchApi(`${JUPITER_PREDICTION_API}/positions/close-all`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Claim winnings from a resolved position (returns unsigned transaction)
 */
export async function claimWinnings(
  positionPubkey: string,
  ownerPubkey: string
): Promise<ApiResponse<JupiterClaimResponse>> {
  return fetchApi<JupiterClaimResponse>(
    `${JUPITER_PREDICTION_API}/positions/${positionPubkey}/claim`,
    {
      method: 'POST',
      body: JSON.stringify({ ownerPubkey }),
    }
  );
}

/**
 * Claim all available winnings (returns unsigned transactions)
 */
export async function claimAllWinnings(
  ownerPubkey: string
): Promise<ApiResponse<{ claims: JupiterClaimResponse[] }>> {
  return fetchApi(`${JUPITER_PREDICTION_API}/positions/claim-all`, {
    method: 'POST',
    body: JSON.stringify({ ownerPubkey }),
  });
}

// =============================================================================
// PORTFOLIO API
// =============================================================================

/**
 * Get portfolio summary for a wallet
 */
export async function getPortfolioSummary(ownerPubkey: string): Promise<ApiResponse<{
  totalValueUsd: string;
  totalPnlUsd: string;
  totalPnlPercent: string;
  openPositions: number;
  claimablePositions: number;
  totalClaimed: string;
}>> {
  return fetchApi(`${JUPITER_PREDICTION_API}/portfolio/${ownerPubkey}/summary`);
}

// =============================================================================
// HEALTH CHECK
// =============================================================================

/**
 * Check if Jupiter Prediction API is healthy
 */
export async function isHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`${JUPITER_PREDICTION_API}/health`, {
      method: 'GET',
      headers: buildHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// =============================================================================
// CLIENT CLASS
// =============================================================================

/**
 * Jupiter Prediction Client class for stateful usage
 */
export class JupiterPredictionClient {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || getApiKey();
  }

  // Events
  getEvents = getEvents;
  getEvent = getEvent;
  searchEvents = searchEvents;
  getHotEvents = getHotEvents;

  // Markets
  getMarket = getMarket;
  getEventMarkets = getEventMarkets;
  getActiveMarkets = getActiveMarkets;

  // Orders
  createOrder = createOrder;
  getOrders = getOrders;
  getOrderStatus = getOrderStatus;
  cancelOrder = cancelOrder;

  // Positions
  getPositions = getPositions;
  getPosition = getPosition;
  closePosition = closePosition;
  closeAllPositions = closeAllPositions;
  claimWinnings = claimWinnings;
  claimAllWinnings = claimAllWinnings;

  // Portfolio
  getPortfolioSummary = getPortfolioSummary;

  // Health
  isHealthy = isHealthy;
}

// =============================================================================
// SINGLETON
// =============================================================================

let jupiterPredictionClient: JupiterPredictionClient | null = null;

/**
 * Get the Jupiter Prediction client singleton
 */
export function getJupiterPredictionClient(): JupiterPredictionClient {
  if (!jupiterPredictionClient) {
    jupiterPredictionClient = new JupiterPredictionClient();
  }
  return jupiterPredictionClient;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  JUPITER_PREDICTION_API,
};

// Re-export types
export * from './types';
