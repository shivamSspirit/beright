/**
 * Kalshi Provider
 *
 * Fetches market data from Kalshi's public API.
 * No authentication required for read operations.
 *
 * @author BeRight Protocol
 */

import { RawMarketData, DataPlatform } from '../../data/types';
import { DataFabricProvider, ProviderFetchOptions, ProviderResponse } from '../types';

const KALSHI_API = 'https://api.elections.kalshi.com/trade-api/v2';
const REQUEST_TIMEOUT = 10000;
const TRADING_FEE = 0.01; // 1%

/**
 * Fetch markets from Kalshi
 */
async function fetchKalshiMarkets(limit: number = 50): Promise<RawMarketData[]> {
  try {
    const url = `${KALSHI_API}/markets?limit=${limit}&status=open`;
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });

    if (!response.ok) {
      console.error('[Kalshi] API error:', response.status);
      return [];
    }

    const data = await response.json() as { markets: any[], cursor?: string };
    const fetchedAt = new Date();
    const result: RawMarketData[] = [];

    for (const m of (data.markets || [])) {
      // Kalshi prices are in cents (0-100)
      const yesBid = (m.yes_bid || 0) / 100;
      const yesAsk = (m.yes_ask || 0) / 100;
      const noBid = (m.no_bid || 0) / 100;
      const noAsk = (m.no_ask || 0) / 100;

      // Mid price
      const yesPrice = yesBid > 0 && yesAsk > 0
        ? (yesBid + yesAsk) / 2
        : (yesBid || yesAsk || (m.last_price || 50) / 100);
      const noPrice = 1 - yesPrice;

      result.push({
        id: m.ticker,
        platform: 'kalshi' as DataPlatform,
        source: 'direct' as const,
        title: m.title || m.subtitle || '',
        question: m.title || m.subtitle || '',
        description: m.subtitle,
        category: m.category,
        yesPrice,
        noPrice,
        yesBid,
        yesAsk,
        noBid,
        noAsk,
        spread: yesAsk - yesBid,
        volume: m.volume || 0,
        volume24h: m.volume_24h || undefined,
        liquidity: m.open_interest || 0,
        openInterest: m.open_interest,
        endDate: m.expiration_time ? new Date(m.expiration_time) : null,
        createdAt: m.created_time ? new Date(m.created_time) : null,
        status: (m.status === 'open' ? 'active' : m.status) as 'active' | 'closed',
        url: `https://kalshi.com/markets/${m.ticker?.toLowerCase()}`,
        fetchedAt,
        _raw: m,
      });

      if (result.length >= limit) break;
    }

    return result;
  } catch (error) {
    console.error('[Kalshi] Fetch error:', error);
    return [];
  }
}

/**
 * Search Kalshi markets
 */
async function searchKalshiMarkets(query: string, limit: number = 30): Promise<RawMarketData[]> {
  try {
    // Kalshi has limited search - fetch all and filter
    const url = `${KALSHI_API}/markets?limit=200&status=open`;
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });

    if (!response.ok) return [];

    const data = await response.json() as { markets: any[] };
    const fetchedAt = new Date();
    const queryLower = query.toLowerCase();

    const filtered = (data.markets || []).filter(m => {
      const title = (m.title || m.subtitle || '').toLowerCase();
      return title.includes(queryLower);
    });

    return filtered.slice(0, limit).map(m => {
      const yesBid = (m.yes_bid || 0) / 100;
      const yesAsk = (m.yes_ask || 0) / 100;
      const yesPrice = yesBid > 0 && yesAsk > 0 ? (yesBid + yesAsk) / 2 : 0.5;

      return {
        id: m.ticker,
        platform: 'kalshi' as DataPlatform,
        source: 'direct' as const,
        title: m.title || m.subtitle || '',
        question: m.title || m.subtitle || '',
        yesPrice,
        noPrice: 1 - yesPrice,
        yesBid,
        yesAsk,
        spread: yesAsk - yesBid,
        volume: m.volume || 0,
        liquidity: m.open_interest || 0,
        endDate: m.expiration_time ? new Date(m.expiration_time) : null,
        status: (m.status === 'open' ? 'active' : m.status) as 'active' | 'closed',
        url: `https://kalshi.com/markets/${m.ticker?.toLowerCase()}`,
        fetchedAt,
      };
    });
  } catch (error) {
    console.error('[Kalshi] Search error:', error);
    return [];
  }
}

/**
 * Fetch a single market by ticker
 */
async function fetchKalshiMarket(ticker: string): Promise<RawMarketData | null> {
  try {
    const url = `${KALSHI_API}/markets/${ticker.toUpperCase()}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });

    if (!response.ok) return null;

    const data = await response.json() as { market: any };
    const m = data.market;
    const fetchedAt = new Date();

    const yesBid = (m.yes_bid || 0) / 100;
    const yesAsk = (m.yes_ask || 0) / 100;
    const yesPrice = yesBid > 0 && yesAsk > 0 ? (yesBid + yesAsk) / 2 : 0.5;

    return {
      id: m.ticker,
      platform: 'kalshi',
      source: 'direct',
      title: m.title || m.subtitle || '',
      question: m.title || m.subtitle || '',
      yesPrice,
      noPrice: 1 - yesPrice,
      yesBid,
      yesAsk,
      spread: yesAsk - yesBid,
      volume: m.volume || 0,
      liquidity: m.open_interest || 0,
      endDate: m.expiration_time ? new Date(m.expiration_time) : null,
      status: m.status === 'open' ? 'active' : m.status,
      url: `https://kalshi.com/markets/${m.ticker?.toLowerCase()}`,
      fetchedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Health check
 */
async function isKalshiHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`${KALSHI_API}/exchange/status`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const data = await response.json() as { exchange_active: boolean };
    return data.exchange_active;
  } catch {
    return false;
  }
}

/**
 * Kalshi Provider Implementation
 */
export const kalshiProvider: DataFabricProvider = {
  name: 'kalshi',
  displayName: 'Kalshi',

  async fetchMarkets(options?: ProviderFetchOptions): Promise<ProviderResponse> {
    const startTime = Date.now();
    const limit = options?.limit || 50;

    const markets = await fetchKalshiMarkets(limit);

    return {
      platform: 'kalshi',
      markets,
      fetchedAt: new Date(),
      latencyMs: Date.now() - startTime,
    };
  },

  async fetchMarket(platformId: string): Promise<RawMarketData | null> {
    return fetchKalshiMarket(platformId);
  },

  async searchMarkets(query: string, options?: ProviderFetchOptions): Promise<ProviderResponse> {
    const startTime = Date.now();
    const limit = options?.limit || 30;

    const markets = await searchKalshiMarkets(query, limit);

    return {
      platform: 'kalshi',
      markets,
      fetchedAt: new Date(),
      latencyMs: Date.now() - startTime,
    };
  },

  async isHealthy(): Promise<boolean> {
    return isKalshiHealthy();
  },

  getTradingFee(): number {
    return TRADING_FEE;
  },
};

export default kalshiProvider;
