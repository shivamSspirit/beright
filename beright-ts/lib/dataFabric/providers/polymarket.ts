/**
 * Polymarket Provider
 *
 * Fetches market data from Polymarket's Gamma API.
 * No authentication required for read operations.
 *
 * @author BeRight Protocol
 */

import { RawMarketData, DataPlatform } from '../../data/types';
import { DataFabricProvider, ProviderFetchOptions, ProviderResponse } from '../types';

const POLYMARKET_API = 'https://gamma-api.polymarket.com';
const REQUEST_TIMEOUT = 10000;
const TRADING_FEE = 0.02; // 2%

/**
 * Fetch markets from Polymarket
 */
async function fetchPolymarketMarkets(limit: number = 50): Promise<RawMarketData[]> {
  try {
    const url = `${POLYMARKET_API}/markets?closed=false&limit=${limit}&order=volume&ascending=false`;
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });

    if (!response.ok) {
      console.error('[Polymarket] API error:', response.status);
      return [];
    }

    const data = await response.json() as any[];
    const fetchedAt = new Date();

    return data.map(m => {
      let yesPrice = 0;
      let noPrice = 0;

      try {
        if (typeof m.outcomePrices === 'string') {
          const prices = JSON.parse(m.outcomePrices);
          yesPrice = parseFloat(prices[0]) || 0;
          noPrice = parseFloat(prices[1]) || 0;
        } else if (Array.isArray(m.outcomePrices)) {
          yesPrice = parseFloat(m.outcomePrices[0]) || 0;
          noPrice = parseFloat(m.outcomePrices[1]) || 0;
        }
      } catch {
        yesPrice = parseFloat(m.yes_price) || 0;
        noPrice = parseFloat(m.no_price) || 0;
      }

      const marketSlug = m.slug || m.id;
      const eventSlug = (m.events && m.events[0]?.slug) || marketSlug;

      return {
        id: m.id || m.condition_id,
        platform: 'polymarket' as DataPlatform,
        source: 'direct' as const,
        title: m.question || m.title || '',
        question: m.question || m.title || '',
        description: m.description,
        category: m.category,
        yesPrice,
        noPrice,
        volume: parseFloat(m.volume) || parseFloat(m.volumeNum) || 0,
        volume24h: parseFloat(m.volume24hr) || undefined,
        liquidity: parseFloat(m.liquidity) || 0,
        endDate: m.end_date_iso ? new Date(m.end_date_iso) : (m.end_date ? new Date(m.end_date) : null),
        createdAt: m.created_at ? new Date(m.created_at) : null,
        status: (m.closed ? 'closed' : 'active') as 'active' | 'closed',
        url: `https://polymarket.com/event/${eventSlug}/${marketSlug}`,
        fetchedAt,
        onChain: m.conditionId ? {
          yesMint: m.outcomes?.[0]?.tokenId,
          noMint: m.outcomes?.[1]?.tokenId,
        } : undefined,
        _raw: m,
      };
    });
  } catch (error) {
    console.error('[Polymarket] Fetch error:', error);
    return [];
  }
}

/**
 * Search Polymarket markets
 */
async function searchPolymarketMarkets(query: string, limit: number = 30): Promise<RawMarketData[]> {
  try {
    // Polymarket doesn't have a direct search endpoint, so we fetch and filter
    const url = `${POLYMARKET_API}/markets?closed=false&limit=100&order=volume&ascending=false`;
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });

    if (!response.ok) return [];

    const data = await response.json() as any[];
    const fetchedAt = new Date();
    const queryLower = query.toLowerCase();

    const filtered = data.filter(m => {
      const title = (m.question || m.title || '').toLowerCase();
      return title.includes(queryLower);
    });

    return filtered.slice(0, limit).map(m => {
      let yesPrice = 0;
      let noPrice = 0;

      try {
        if (typeof m.outcomePrices === 'string') {
          const prices = JSON.parse(m.outcomePrices);
          yesPrice = parseFloat(prices[0]) || 0;
          noPrice = parseFloat(prices[1]) || 0;
        } else if (Array.isArray(m.outcomePrices)) {
          yesPrice = parseFloat(m.outcomePrices[0]) || 0;
          noPrice = parseFloat(m.outcomePrices[1]) || 0;
        }
      } catch {
        yesPrice = parseFloat(m.yes_price) || 0;
        noPrice = parseFloat(m.no_price) || 0;
      }

      const marketSlug = m.slug || m.id;
      const eventSlug = (m.events && m.events[0]?.slug) || marketSlug;

      return {
        id: m.id || m.condition_id,
        platform: 'polymarket' as DataPlatform,
        source: 'direct' as const,
        title: m.question || m.title || '',
        question: m.question || m.title || '',
        yesPrice,
        noPrice,
        volume: parseFloat(m.volume) || 0,
        liquidity: parseFloat(m.liquidity) || 0,
        endDate: m.end_date_iso ? new Date(m.end_date_iso) : null,
        status: (m.closed ? 'closed' : 'active') as 'active' | 'closed',
        url: `https://polymarket.com/event/${eventSlug}/${marketSlug}`,
        fetchedAt,
      };
    });
  } catch (error) {
    console.error('[Polymarket] Search error:', error);
    return [];
  }
}

/**
 * Fetch a single market by ID
 */
async function fetchPolymarketMarket(marketId: string): Promise<RawMarketData | null> {
  try {
    const url = `${POLYMARKET_API}/markets/${marketId}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });

    if (!response.ok) return null;

    const m = await response.json() as any;
    const fetchedAt = new Date();

    let yesPrice = 0;
    let noPrice = 0;

    try {
      if (typeof m.outcomePrices === 'string') {
        const prices = JSON.parse(m.outcomePrices);
        yesPrice = parseFloat(prices[0]) || 0;
        noPrice = parseFloat(prices[1]) || 0;
      }
    } catch {
      // Use fallback
    }

    return {
      id: m.id,
      platform: 'polymarket',
      source: 'direct',
      title: m.question || m.title || '',
      question: m.question || m.title || '',
      yesPrice,
      noPrice,
      volume: parseFloat(m.volume) || 0,
      liquidity: parseFloat(m.liquidity) || 0,
      endDate: m.end_date_iso ? new Date(m.end_date_iso) : null,
      status: m.closed ? 'closed' : 'active',
      url: `https://polymarket.com/event/${m.slug}`,
      fetchedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Health check
 */
async function isPolymarketHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`${POLYMARKET_API}/markets?limit=1`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Polymarket Provider Implementation
 */
export const polymarketProvider: DataFabricProvider = {
  name: 'polymarket',
  displayName: 'Polymarket',

  async fetchMarkets(options?: ProviderFetchOptions): Promise<ProviderResponse> {
    const startTime = Date.now();
    const limit = options?.limit || 50;

    const markets = await fetchPolymarketMarkets(limit);

    return {
      platform: 'polymarket',
      markets,
      fetchedAt: new Date(),
      latencyMs: Date.now() - startTime,
    };
  },

  async fetchMarket(platformId: string): Promise<RawMarketData | null> {
    return fetchPolymarketMarket(platformId);
  },

  async searchMarkets(query: string, options?: ProviderFetchOptions): Promise<ProviderResponse> {
    const startTime = Date.now();
    const limit = options?.limit || 30;

    const markets = await searchPolymarketMarkets(query, limit);

    return {
      platform: 'polymarket',
      markets,
      fetchedAt: new Date(),
      latencyMs: Date.now() - startTime,
    };
  },

  async isHealthy(): Promise<boolean> {
    return isPolymarketHealthy();
  },

  getTradingFee(): number {
    return TRADING_FEE;
  },
};

export default polymarketProvider;
