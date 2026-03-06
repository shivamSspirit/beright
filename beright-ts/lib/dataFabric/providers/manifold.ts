/**
 * Manifold Provider
 *
 * Fetches market data from Manifold Markets API.
 * No authentication required for read operations.
 *
 * @author BeRight Protocol
 */

import { RawMarketData, DataPlatform } from '../../data/types';
import { DataFabricProvider, ProviderFetchOptions, ProviderResponse } from '../types';

const MANIFOLD_API = 'https://api.manifold.markets/v0';
const REQUEST_TIMEOUT = 10000;
const TRADING_FEE = 0; // Free (play money + sweepstakes)

/**
 * Fetch markets from Manifold
 */
async function fetchManifoldMarkets(limit: number = 50): Promise<RawMarketData[]> {
  try {
    const url = `${MANIFOLD_API}/search-markets?term=&limit=${limit}&sort=liquidity&filter=open`;
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });

    if (!response.ok) {
      console.error('[Manifold] API error:', response.status);
      return [];
    }

    const data = await response.json() as any[];
    const fetchedAt = new Date();

    return data.slice(0, limit).map(m => ({
      id: m.id,
      platform: 'manifold' as DataPlatform,
      source: 'direct' as const,
      title: m.question || '',
      question: m.question || '',
      description: m.description,
      category: m.groupSlugs?.[0],
      yesPrice: m.probability || 0,
      noPrice: 1 - (m.probability || 0),
      volume: m.volume || 0,
      volume24h: m.volume24Hours || undefined,
      liquidity: m.totalLiquidity || 0,
      endDate: m.closeTime ? new Date(m.closeTime) : null,
      createdAt: m.createdTime ? new Date(m.createdTime) : null,
      status: (m.isResolved ? 'resolved' : 'active') as 'active' | 'resolved',
      url: m.url || `https://manifold.markets/${m.creatorUsername}/${m.slug}`,
      fetchedAt,
      _raw: m,
    }));
  } catch (error) {
    console.error('[Manifold] Fetch error:', error);
    return [];
  }
}

/**
 * Search Manifold markets (native search support)
 */
async function searchManifoldMarkets(query: string, limit: number = 30): Promise<RawMarketData[]> {
  try {
    const url = `${MANIFOLD_API}/search-markets?term=${encodeURIComponent(query)}&limit=${limit}&sort=score&filter=open`;
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });

    if (!response.ok) return [];

    const data = await response.json() as any[];
    const fetchedAt = new Date();

    return data.map(m => ({
      id: m.id,
      platform: 'manifold' as DataPlatform,
      source: 'direct' as const,
      title: m.question || '',
      question: m.question || '',
      yesPrice: m.probability || 0,
      noPrice: 1 - (m.probability || 0),
      volume: m.volume || 0,
      liquidity: m.totalLiquidity || 0,
      endDate: m.closeTime ? new Date(m.closeTime) : null,
      status: (m.isResolved ? 'resolved' : 'active') as 'active' | 'resolved',
      url: m.url || `https://manifold.markets/${m.creatorUsername}/${m.slug}`,
      fetchedAt,
    }));
  } catch (error) {
    console.error('[Manifold] Search error:', error);
    return [];
  }
}

/**
 * Fetch a single market by ID or slug
 */
async function fetchManifoldMarket(marketId: string): Promise<RawMarketData | null> {
  try {
    // Try by ID first
    let url = `${MANIFOLD_API}/market/${marketId}`;
    let response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });

    // If not found, try by slug
    if (!response.ok) {
      url = `${MANIFOLD_API}/slug/${marketId}`;
      response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
    }

    if (!response.ok) return null;

    const m = await response.json() as any;
    const fetchedAt = new Date();

    return {
      id: m.id,
      platform: 'manifold',
      source: 'direct',
      title: m.question || '',
      question: m.question || '',
      yesPrice: m.probability || 0,
      noPrice: 1 - (m.probability || 0),
      volume: m.volume || 0,
      liquidity: m.totalLiquidity || 0,
      endDate: m.closeTime ? new Date(m.closeTime) : null,
      status: m.isResolved ? 'resolved' : 'active',
      url: m.url || `https://manifold.markets/${m.creatorUsername}/${m.slug}`,
      fetchedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Health check
 */
async function isManifoldHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`${MANIFOLD_API}/search-markets?term=&limit=1`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Manifold Provider Implementation
 */
export const manifoldProvider: DataFabricProvider = {
  name: 'manifold',
  displayName: 'Manifold',

  async fetchMarkets(options?: ProviderFetchOptions): Promise<ProviderResponse> {
    const startTime = Date.now();
    const limit = options?.limit || 50;

    const markets = await fetchManifoldMarkets(limit);

    return {
      platform: 'manifold',
      markets,
      fetchedAt: new Date(),
      latencyMs: Date.now() - startTime,
    };
  },

  async fetchMarket(platformId: string): Promise<RawMarketData | null> {
    return fetchManifoldMarket(platformId);
  },

  async searchMarkets(query: string, options?: ProviderFetchOptions): Promise<ProviderResponse> {
    const startTime = Date.now();
    const limit = options?.limit || 30;

    const markets = await searchManifoldMarkets(query, limit);

    return {
      platform: 'manifold',
      markets,
      fetchedAt: new Date(),
      latencyMs: Date.now() - startTime,
    };
  },

  async isHealthy(): Promise<boolean> {
    return isManifoldHealthy();
  },

  getTradingFee(): number {
    return TRADING_FEE;
  },
};

export default manifoldProvider;
