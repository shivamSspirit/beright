/**
 * Jupiter Prediction Provider
 *
 * Data fabric provider for Jupiter Prediction Markets.
 * Jupiter aggregates Polymarket + Kalshi liquidity on Solana.
 *
 * Key benefits:
 * - Zero payout fees (winners get full $1/contract)
 * - On-chain settlement on Solana
 * - Single API for both Polymarket and Kalshi
 *
 * @author BeRight Protocol
 */

import { RawMarketData, DataPlatform } from '../../data/types';
import { DataFabricProvider, ProviderFetchOptions, ProviderResponse } from '../types';
import {
  getEvents,
  getMarket,
  getHotEvents,
  searchEvents,
  getActiveMarkets,
  JupiterMarket,
  JupiterEvent,
  microUsdToUsd,
  getYesPrice,
  getNoPrice,
  getSpread,
} from '../../jupiter/prediction';

const TRADING_FEE = 0; // Zero payout fees on Jupiter

/**
 * Convert Jupiter market to RawMarketData
 */
function normalizeJupiterMarket(market: JupiterMarket, event?: JupiterEvent): RawMarketData {
  const fetchedAt = new Date();

  // Parse pricing
  const yesPrice = getYesPrice(market);
  const noPrice = getNoPrice(market);
  const spread = getSpread(market);

  // Orderbook prices
  const yesBid = market.pricing.yesBidUsd ? microUsdToUsd(market.pricing.yesBidUsd) : undefined;
  const yesAsk = market.pricing.yesAskUsd ? microUsdToUsd(market.pricing.yesAskUsd) : undefined;
  const noBid = market.pricing.noBidUsd ? microUsdToUsd(market.pricing.noBidUsd) : undefined;
  const noAsk = market.pricing.noAskUsd ? microUsdToUsd(market.pricing.noAskUsd) : undefined;

  // Volume and liquidity
  const volume = market.pricing.volume ? parseFloat(market.pricing.volume) : 0;
  const volume24h = market.pricing.volume24h ? parseFloat(market.pricing.volume24h) : undefined;
  const liquidity = market.pricing.liquidity ? parseFloat(market.pricing.liquidity) : 0;
  const openInterest = market.pricing.openInterest ? parseFloat(market.pricing.openInterest) : undefined;

  // Map status
  let status: 'active' | 'closed' | 'resolved' | 'unknown' = 'unknown';
  switch (market.status) {
    case 'active':
      status = 'active';
      break;
    case 'closed':
    case 'suspended':
      status = 'closed';
      break;
    case 'resolved_yes':
    case 'resolved_no':
      status = 'resolved';
      break;
    case 'cancelled':
      status = 'closed';
      break;
  }

  // Detect category
  const category = event?.category || market.metadata?.source || 'other';

  return {
    id: `jupiter-${market.marketId}`,
    platform: 'jupiter' as DataPlatform,
    source: 'direct',

    // Content
    title: market.title || market.metadata?.title || '',
    question: market.title || market.metadata?.title || '',
    description: market.description || market.metadata?.subtitle,
    category,

    // Pricing (0-1 scale)
    yesPrice,
    noPrice,

    // Orderbook
    yesBid,
    yesAsk,
    noBid,
    noAsk,
    spread,

    // Volume & Liquidity
    volume,
    volume24h,
    liquidity,
    openInterest,

    // Timing
    endDate: market.closeTime ? new Date(market.closeTime) : null,
    createdAt: market.createdAt ? new Date(market.createdAt) : null,
    fetchedAt,

    // Status
    status,

    // URL - Jupiter markets can be viewed via their portal
    url: `https://jup.ag/prediction/${market.marketId}`,

    // On-chain data (Solana SPL tokens)
    onChain: market.onChain ? {
      yesMint: market.onChain.yesMint,
      noMint: market.onChain.noMint,
      marketLedger: market.onChain.marketPubkey,
    } : undefined,

    // Store original data for debugging
    _raw: {
      market,
      event,
      provider: market.provider,  // 'polymarket' or 'kalshi'
    },
  };
}

/**
 * Fetch markets from Jupiter Prediction API
 */
async function fetchJupiterMarkets(limit: number = 50): Promise<RawMarketData[]> {
  try {
    // Get hot events with markets
    const response = await getHotEvents(limit);

    if (!response.success || !response.data) {
      console.error('[Jupiter] Failed to fetch events:', response.error);
      return [];
    }

    const markets: RawMarketData[] = [];

    for (const event of response.data) {
      if (event.markets) {
        for (const market of event.markets) {
          markets.push(normalizeJupiterMarket(market, event));
        }
      }
    }

    return markets.slice(0, limit);
  } catch (error) {
    console.error('[Jupiter] Fetch error:', error);
    return [];
  }
}

/**
 * Search Jupiter markets
 */
async function searchJupiterMarkets(query: string, limit: number = 30): Promise<RawMarketData[]> {
  try {
    const response = await searchEvents({
      query,
      limit,
      includeMarkets: true,
    });

    if (!response.success || !response.data) {
      console.error('[Jupiter] Search failed:', response.error);
      return [];
    }

    const markets: RawMarketData[] = [];

    for (const event of response.data) {
      if (event.markets) {
        for (const market of event.markets) {
          markets.push(normalizeJupiterMarket(market, event));
        }
      }
    }

    return markets.slice(0, limit);
  } catch (error) {
    console.error('[Jupiter] Search error:', error);
    return [];
  }
}

/**
 * Fetch a single market by ID
 */
async function fetchJupiterMarket(marketId: string): Promise<RawMarketData | null> {
  try {
    // Remove 'jupiter-' prefix if present
    const cleanId = marketId.replace(/^jupiter-/, '');

    const response = await getMarket(cleanId);

    if (!response.success || !response.data) {
      console.error('[Jupiter] Market not found:', marketId);
      return null;
    }

    return normalizeJupiterMarket(response.data);
  } catch (error) {
    console.error('[Jupiter] Fetch market error:', error);
    return null;
  }
}

/**
 * Health check for Jupiter Prediction API
 */
async function isJupiterHealthy(): Promise<boolean> {
  try {
    const response = await getActiveMarkets({ limit: 1 });
    return response.success;
  } catch {
    return false;
  }
}

// =============================================================================
// PROVIDER EXPORT
// =============================================================================

/**
 * Jupiter Prediction Provider Implementation
 */
export const jupiterProvider: DataFabricProvider = {
  name: 'jupiter',
  displayName: 'Jupiter Prediction',

  async fetchMarkets(options?: ProviderFetchOptions): Promise<ProviderResponse> {
    const startTime = Date.now();
    const limit = options?.limit || 50;

    const markets = await fetchJupiterMarkets(limit);

    return {
      platform: 'jupiter',
      markets,
      fetchedAt: new Date(),
      latencyMs: Date.now() - startTime,
    };
  },

  async fetchMarket(platformId: string): Promise<RawMarketData | null> {
    return fetchJupiterMarket(platformId);
  },

  async searchMarkets(query: string, options?: ProviderFetchOptions): Promise<ProviderResponse> {
    const startTime = Date.now();
    const limit = options?.limit || 30;

    const markets = await searchJupiterMarkets(query, limit);

    return {
      platform: 'jupiter',
      markets,
      fetchedAt: new Date(),
      latencyMs: Date.now() - startTime,
    };
  },

  async isHealthy(): Promise<boolean> {
    return isJupiterHealthy();
  },

  getTradingFee(): number {
    return TRADING_FEE;
  },
};

export default jupiterProvider;

// =============================================================================
// ADDITIONAL EXPORTS FOR DIRECT USE
// =============================================================================

export {
  normalizeJupiterMarket,
  fetchJupiterMarkets,
  searchJupiterMarkets,
  fetchJupiterMarket,
  isJupiterHealthy,
};
