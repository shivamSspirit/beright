/**
 * Direct Platform API Aggregator
 *
 * Uses verified FREE public APIs - no API keys required for market data.
 * Based on research: docs.polymarket.com, docs.kalshi.com, docs.manifold.markets
 *
 * Supported Platforms (All FREE, No Auth):
 * - Polymarket (gamma-api.polymarket.com) - Real money, crypto
 * - Kalshi (api.elections.kalshi.com) - Real money, USD, CFTC-regulated
 * - Manifold (api.manifold.markets) - Play money with sweepstakes
 * - Limitless (api.limitless.exchange) - Real money, USDC on Base
 * - Metaculus (metaculus.com/api2) - Forecasting, needs free token
 *
 * @author BeRight Protocol
 * @version 2.0.0
 */

import {
  RawMarketData,
  DataPlatform,
  FetchOptions,
  AggregatorResponse,
  MarketAggregator,
} from '../types';

// =============================================================================
// VERIFIED FREE API ENDPOINTS (No Auth Required for Market Data)
// =============================================================================

// Polymarket - docs.polymarket.com - No auth, real money (crypto)
const POLYMARKET_API = 'https://gamma-api.polymarket.com';

// Kalshi - docs.kalshi.com - No auth for market reads, real money (USD)
const KALSHI_API = 'https://api.elections.kalshi.com/trade-api/v2';

// Manifold - docs.manifold.markets - No auth, 500 req/min
const MANIFOLD_API = 'https://api.manifold.markets/v0';

// Limitless - docs.limitless.exchange - No auth for browsing
const LIMITLESS_API = 'https://api.limitless.exchange';

// Metaculus - needs free token for API access
const METACULUS_API = 'https://www.metaculus.com/api2';

const REQUEST_TIMEOUT = 10000;

/**
 * Supported platforms via direct APIs
 */
export const DIRECT_PLATFORMS: DataPlatform[] = [
  'polymarket',
  'kalshi',
  'manifold',
  'limitless',
  'metaculus',
];

// =============================================================================
// POLYMARKET (Real Money - Crypto)
// Docs: docs.polymarket.com/market-data/overview
// Auth: None required for all read endpoints
// =============================================================================

async function fetchPolymarket(limit: number = 30): Promise<RawMarketData[]> {
  try {
    // gamma-api returns markets with full data
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
        yesPrice,
        noPrice,
        volume: parseFloat(m.volume) || parseFloat(m.volumeNum) || 0,
        liquidity: parseFloat(m.liquidity) || 0,
        endDate: m.end_date_iso ? new Date(m.end_date_iso) : (m.end_date ? new Date(m.end_date) : null),
        status: (m.closed ? 'closed' : 'active') as 'active' | 'closed',
        url: `https://polymarket.com/event/${eventSlug}/${marketSlug}`,
        fetchedAt,
      };
    });
  } catch (error) {
    console.error('[Polymarket] Fetch error:', error);
    return [];
  }
}

// =============================================================================
// KALSHI (Real Money - USD, CFTC Regulated)
// Docs: docs.kalshi.com
// Auth: None required for market data reads
// =============================================================================

async function fetchKalshi(limit: number = 30): Promise<RawMarketData[]> {
  try {
    // Direct Kalshi API - no auth needed for market data
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
      // yes_bid and yes_ask are in cents (0-100)
      const yesBid = (m.yes_bid || 0) / 100;
      const yesAsk = (m.yes_ask || 0) / 100;
      const noBid = (m.no_bid || 0) / 100;
      const noAsk = (m.no_ask || 0) / 100;

      // Mid price
      const yesPrice = yesBid > 0 && yesAsk > 0 ? (yesBid + yesAsk) / 2 : (yesBid || yesAsk || m.last_price / 100 || 0.5);
      const noPrice = 1 - yesPrice;

      result.push({
        id: m.ticker,
        platform: 'kalshi' as DataPlatform,
        source: 'direct' as const,
        title: m.title || m.subtitle || '',
        question: m.title || m.subtitle || '',
        yesPrice,
        noPrice,
        yesBid,
        yesAsk,
        noBid,
        noAsk,
        spread: yesAsk - yesBid,
        volume: m.volume || 0,
        volume24h: m.volume_24h || 0,
        liquidity: m.open_interest || 0,
        endDate: m.expiration_time ? new Date(m.expiration_time) : null,
        status: (m.status === 'open' ? 'active' : m.status) as 'active' | 'closed',
        url: `https://kalshi.com/markets/${m.ticker?.toLowerCase()}`,
        fetchedAt,
      });

      if (result.length >= limit) break;
    }

    return result;
  } catch (error) {
    console.error('[Kalshi] Fetch error:', error);
    return [];
  }
}

// =============================================================================
// MANIFOLD (Play Money + Sweepstakes)
// Docs: docs.manifold.markets/api
// Auth: None required, 500 req/min rate limit
// =============================================================================

async function fetchManifold(limit: number = 30): Promise<RawMarketData[]> {
  try {
    // search-markets endpoint with sorting by liquidity
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
    console.error('[Manifold] Fetch error:', error);
    return [];
  }
}

// =============================================================================
// LIMITLESS (Real Money - USDC on Base L2)
// Docs: https://api.limitless.exchange/api-v1
// Auth: None required for market browsing
// Rate Limit: 2 concurrent requests, 300ms between calls
// =============================================================================

async function fetchLimitless(limit: number = 30): Promise<RawMarketData[]> {
  try {
    // CORRECT ENDPOINT: /markets/active (not /markets)
    // Supports: page, limit (max 25), tradeType (amm|clob|group)
    // NOTE: Limitless has max limit of 25
    const actualLimit = Math.min(limit, 25);
    const url = `${LIMITLESS_API}/markets/active?limit=${actualLimit}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });

    if (!response.ok) {
      console.error('[Limitless] API error:', response.status);
      return [];
    }

    const json = await response.json() as any;
    const fetchedAt = new Date();

    // Response is array of markets or { data: [...] }
    let markets: any[] = Array.isArray(json) ? json : (json.data || json.markets || []);

    if (!Array.isArray(markets)) markets = [];

    return markets.slice(0, limit).map(m => {
      // Limitless uses adjustedMidpoint or prices array
      let yesPrice = 0.5;
      let noPrice = 0.5;

      // Try different price formats
      if (m.adjustedMidpoint !== undefined) {
        yesPrice = parseFloat(m.adjustedMidpoint) || 0.5;
        noPrice = 1 - yesPrice;
      } else if (Array.isArray(m.prices) && m.prices.length >= 2) {
        yesPrice = parseFloat(m.prices[0]) || 0.5;
        noPrice = parseFloat(m.prices[1]) || (1 - yesPrice);
      } else if (m.probability !== undefined) {
        yesPrice = parseFloat(m.probability) || 0.5;
        noPrice = 1 - yesPrice;
      } else if (m.outcomeTokens && m.outcomeTokens[0]) {
        yesPrice = parseFloat(m.outcomeTokens[0].price) || 0.5;
        noPrice = parseFloat(m.outcomeTokens[1]?.price) || (1 - yesPrice);
      }

      // Deadline is Unix timestamp in seconds
      let endDate: Date | null = null;
      if (m.deadline) {
        endDate = new Date(typeof m.deadline === 'number' ? m.deadline * 1000 : m.deadline);
      } else if (m.expirationDate) {
        endDate = new Date(m.expirationDate);
      }

      return {
        id: m.slug || m.address || m.id?.toString() || `limitless-${Date.now()}`,
        platform: 'limitless' as DataPlatform,
        source: 'direct' as const,
        title: m.title || m.question || '',
        question: m.title || m.question || '',
        yesPrice,
        noPrice,
        volume: parseFloat(m.volumeFormatted || m.volume || m.totalVolume) || 0,
        liquidity: parseFloat(m.liquidity || m.totalLiquidity) || 0,
        endDate,
        status: (m.expired || m.resolved ? 'closed' : 'active') as 'active' | 'closed',
        url: `https://limitless.exchange/markets/${m.slug || m.address || m.id}`,
        fetchedAt,
      };
    });
  } catch (error) {
    console.error('[Limitless] Fetch error:', error);
    return [];
  }
}

// =============================================================================
// METACULUS (Forecasting - Long-horizon questions)
// Docs: metaculus.com/api/
// Auth: Free account + Token required
// =============================================================================

async function fetchMetaculus(limit: number = 30): Promise<RawMarketData[]> {
  const token = process.env.METACULUS_TOKEN;

  // Skip if no token configured
  if (!token) {
    return [];
  }

  try {
    const url = `${METACULUS_API}/questions/?format=json&limit=${limit}&status=open&type=forecast&order_by=-activity`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Token ${token}`,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) {
      console.error('[Metaculus] API error:', response.status);
      return [];
    }

    const data = await response.json() as { results: any[] };
    const fetchedAt = new Date();

    return (data.results || []).slice(0, limit).map(q => {
      // Metaculus uses community_prediction for aggregate forecast
      const prediction = q.community_prediction?.full?.q2 || q.community_prediction?.y || 0.5;

      return {
        id: q.id?.toString(),
        platform: 'metaculus' as DataPlatform,
        source: 'direct' as const,
        title: q.title || '',
        question: q.title || '',
        yesPrice: prediction,
        noPrice: 1 - prediction,
        volume: q.number_of_predictions || 0,
        liquidity: 0,
        endDate: q.resolve_time ? new Date(q.resolve_time) : null,
        status: (q.active ? 'active' : 'closed') as 'active' | 'closed',
        url: `https://www.metaculus.com/questions/${q.id}`,
        fetchedAt,
      };
    });
  } catch (error) {
    console.error('[Metaculus] Fetch error:', error);
    return [];
  }
}

// =============================================================================
// DIRECT API AGGREGATOR
// =============================================================================

/**
 * Direct API aggregator - uses verified FREE public APIs
 * No API keys required for Polymarket, Kalshi, Manifold, Limitless
 */
export const directAggregator: MarketAggregator = {
  name: 'direct',

  supportedPlatforms: DIRECT_PLATFORMS,

  async fetchMarkets(options: FetchOptions = {}): Promise<AggregatorResponse> {
    const startTime = Date.now();
    const fetchedAt = new Date();
    const limit = options.limit || 30;
    const platforms = options.platforms || DIRECT_PLATFORMS;

    const fetchers: Record<DataPlatform, () => Promise<RawMarketData[]>> = {
      polymarket: () => fetchPolymarket(limit),
      kalshi: () => fetchKalshi(limit),
      manifold: () => fetchManifold(limit),
      limitless: () => fetchLimitless(limit),
      metaculus: () => fetchMetaculus(limit),
      // Platforms only available via PolyRouter
      prophetx: async () => [],
      novig: async () => [],
      sxbet: async () => [],
      myriad: async () => [],
      baozi: async () => [],
      probable: async () => [],
    };

    const platformsToFetch = platforms.filter(p => fetchers[p]);

    const results = await Promise.allSettled(
      platformsToFetch.map(p => fetchers[p]?.() || Promise.resolve([]))
    );

    const allMarkets: RawMarketData[] = [];
    const errors: string[] = [];
    const platformResults: Record<string, number> = {};

    results.forEach((result, i) => {
      const platform = platformsToFetch[i];
      if (result.status === 'fulfilled') {
        allMarkets.push(...result.value);
        platformResults[platform] = result.value.length;
      } else {
        errors.push(`${platform}: ${result.reason}`);
        platformResults[platform] = 0;
      }
    });

    // Sort by volume (real money markets first)
    allMarkets.sort((a, b) => (b.volume || 0) - (a.volume || 0));

    console.log(`[Direct] Fetched ${allMarkets.length} markets:`, platformResults);

    return {
      source: 'direct',
      markets: allMarkets.slice(0, limit),
      fetchedAt,
      latencyMs: Date.now() - startTime,
      errors: errors.length > 0 ? errors : undefined,
    };
  },

  async searchMarkets(query: string, options: FetchOptions = {}): Promise<AggregatorResponse> {
    // For Manifold, we can use their search endpoint directly
    if (query && (!options.platforms || options.platforms.includes('manifold'))) {
      try {
        const manifoldResults = await fetchManifoldSearch(query, options.limit || 30);
        if (manifoldResults.length > 0) {
          return {
            source: 'direct',
            markets: manifoldResults,
            fetchedAt: new Date(),
            latencyMs: 0,
          };
        }
      } catch {
        // Fall through to client-side filtering
      }
    }

    // Fetch all and filter client-side
    const result = await this.fetchMarkets({ ...options, limit: 100 });

    if (!query) return result;

    const queryLower = query.toLowerCase();
    const filtered = result.markets.filter(m =>
      m.title.toLowerCase().includes(queryLower) ||
      (m.question || '').toLowerCase().includes(queryLower)
    );

    return {
      ...result,
      markets: filtered.slice(0, options.limit || 30),
    };
  },

  async getHotMarkets(limit: number = 20): Promise<AggregatorResponse> {
    return this.fetchMarkets({ limit });
  },

  async isHealthy(): Promise<boolean> {
    try {
      // Quick health check - try Polymarket API (most reliable)
      const response = await fetch(`${POLYMARKET_API}/markets?limit=1`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  },
};

/**
 * Helper: Search Manifold markets directly
 */
async function fetchManifoldSearch(query: string, limit: number): Promise<RawMarketData[]> {
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
}

export default directAggregator;
