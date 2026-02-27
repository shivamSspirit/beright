/**
 * PMXT Aggregator Integration
 *
 * PMXT is "CCXT for prediction markets" - an open source unified API
 * for prediction market data across multiple exchanges.
 *
 * Repository: https://github.com/pmxt-dev/pmxt
 * License: MIT (free for commercial use)
 *
 * Supported Platforms:
 * - Polymarket
 * - Kalshi
 * - Limitless
 * - Probable Markets
 * - Baozi
 * - Myriad Markets
 *
 * @author BeRight Protocol
 * @version 1.0.0
 */

import {
  RawMarketData,
  DataPlatform,
  FetchOptions,
  AggregatorResponse,
  MarketAggregator,
} from '../types';

// =============================================================================
// PMXT API CONFIGURATION
// =============================================================================

/**
 * PMXT API base URL
 * Note: PMXT can be used as a library or via their hosted API
 * We use the hosted API for simplicity
 */
const PMXT_API_BASE = 'https://api.pmxt.dev';

/**
 * Timeout for API requests (ms)
 */
const REQUEST_TIMEOUT = 10000;

/**
 * Platform mapping from PMXT to our types
 */
const PLATFORM_MAP: Record<string, DataPlatform> = {
  'polymarket': 'polymarket',
  'kalshi': 'kalshi',
  'limitless': 'limitless',
  'probable': 'probable',
  'baozi': 'baozi',
  'myriad': 'myriad',
};

/**
 * Supported platforms via PMXT
 */
const SUPPORTED_PLATFORMS: DataPlatform[] = [
  'polymarket',
  'kalshi',
  'limitless',
  'probable',
  'baozi',
  'myriad',
];

// =============================================================================
// DATA NORMALIZATION
// =============================================================================

/**
 * Normalize PMXT event/market data to our RawMarketData format
 */
function normalizeMarket(
  pmxtData: any,
  platform: DataPlatform,
  fetchedAt: Date
): RawMarketData | null {
  try {
    // PMXT returns events with nested markets
    // For binary markets, we use the primary market
    const market = pmxtData.markets?.[0] || pmxtData;

    // Skip invalid data
    if (!market || !market.title) {
      return null;
    }

    // Extract prices
    // PMXT normalizes prices to 0-1 scale
    let yesPrice = 0;
    let noPrice = 0;

    if (market.yes?.price !== undefined) {
      yesPrice = parseFloat(market.yes.price) || 0;
      noPrice = parseFloat(market.no?.price) || (1 - yesPrice);
    } else if (market.yesPrice !== undefined) {
      yesPrice = parseFloat(market.yesPrice) || 0;
      noPrice = parseFloat(market.noPrice) || (1 - yesPrice);
    } else if (market.probability !== undefined) {
      yesPrice = parseFloat(market.probability) || 0;
      noPrice = 1 - yesPrice;
    }

    // Skip markets with no valid price
    if (yesPrice === 0 && noPrice === 0) {
      return null;
    }

    // Extract orderbook data if available
    const yesBid = market.yes?.bid ? parseFloat(market.yes.bid) : undefined;
    const yesAsk = market.yes?.ask ? parseFloat(market.yes.ask) : undefined;
    const noBid = market.no?.bid ? parseFloat(market.no.bid) : undefined;
    const noAsk = market.no?.ask ? parseFloat(market.no.ask) : undefined;
    const spread = yesBid && yesAsk ? yesAsk - yesBid : undefined;

    // Build the normalized market
    return {
      id: market.id || pmxtData.id || pmxtData.slug || `${platform}-${Date.now()}`,
      platform,
      source: 'pmxt',
      title: market.title || pmxtData.title || '',
      question: market.question || market.title || pmxtData.title || '',
      description: market.description || pmxtData.description,
      category: market.category || pmxtData.category,
      yesPrice,
      noPrice,
      yesBid,
      yesAsk,
      noBid,
      noAsk,
      spread,
      volume: parseFloat(market.volume || pmxtData.volume) || 0,
      volume24h: parseFloat(market.volume24h || pmxtData.volume24h) || undefined,
      liquidity: parseFloat(market.liquidity || pmxtData.liquidity) || undefined,
      openInterest: parseFloat(market.openInterest || pmxtData.openInterest) || undefined,
      endDate: market.endDate || market.closeTime
        ? new Date(market.endDate || market.closeTime)
        : null,
      createdAt: market.createdAt || pmxtData.createdAt
        ? new Date(market.createdAt || pmxtData.createdAt)
        : null,
      fetchedAt,
      status: market.status === 'active' || market.status === 'open'
        ? 'active'
        : market.status === 'resolved'
        ? 'resolved'
        : market.status === 'closed'
        ? 'closed'
        : 'unknown',
      url: market.url || pmxtData.url,
      _raw: pmxtData,
    };
  } catch (error) {
    console.error('[PMXT] Failed to normalize market:', error);
    return null;
  }
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Fetch events from PMXT API
 */
async function fetchPmxtEvents(
  platform: DataPlatform,
  query?: string,
  limit: number = 50
): Promise<any[]> {
  try {
    const params = new URLSearchParams();
    params.set('exchange', platform);
    params.set('limit', String(limit));
    if (query) {
      params.set('query', query);
    }

    const url = `${PMXT_API_BASE}/v1/events?${params.toString()}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BeRight/1.0',
      },
    });

    if (!response.ok) {
      console.error(`[PMXT] API error for ${platform}: ${response.status}`);
      return [];
    }

    const data = await response.json();

    // PMXT returns { events: [...] } or just an array
    return Array.isArray(data) ? data : (data.events || data.data || []);
  } catch (error) {
    console.error(`[PMXT] Fetch error for ${platform}:`, error);
    return [];
  }
}

/**
 * Search markets via PMXT
 */
async function searchPmxtMarkets(
  query: string,
  platforms: DataPlatform[] = SUPPORTED_PLATFORMS,
  limit: number = 50
): Promise<any[]> {
  try {
    // PMXT unified search endpoint
    const params = new URLSearchParams();
    params.set('query', query);
    params.set('limit', String(limit));

    // Only search supported platforms
    const validPlatforms = platforms.filter(p => SUPPORTED_PLATFORMS.includes(p));
    if (validPlatforms.length > 0) {
      params.set('exchanges', validPlatforms.join(','));
    }

    const url = `${PMXT_API_BASE}/v1/search?${params.toString()}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BeRight/1.0',
      },
    });

    if (!response.ok) {
      console.error(`[PMXT] Search API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : (data.results || data.events || data.data || []);
  } catch (error) {
    console.error('[PMXT] Search error:', error);
    return [];
  }
}

// =============================================================================
// AGGREGATOR IMPLEMENTATION
// =============================================================================

/**
 * PMXT Aggregator - implements MarketAggregator interface
 */
export const pmxtAggregator: MarketAggregator = {
  name: 'pmxt',
  supportedPlatforms: SUPPORTED_PLATFORMS,

  /**
   * Fetch markets from all or specified platforms
   */
  async fetchMarkets(options: FetchOptions = {}): Promise<AggregatorResponse> {
    const startTime = Date.now();
    const fetchedAt = new Date();
    const errors: string[] = [];
    const allMarkets: RawMarketData[] = [];

    // Determine which platforms to fetch
    const platforms = options.platforms
      ? options.platforms.filter(p => SUPPORTED_PLATFORMS.includes(p))
      : SUPPORTED_PLATFORMS;

    // Fetch from all platforms in parallel
    const results = await Promise.allSettled(
      platforms.map(platform => fetchPmxtEvents(platform, options.query, options.limit || 50))
    );

    // Process results
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const platform = platforms[i];

      if (result.status === 'fulfilled') {
        const events = result.value;
        for (const event of events) {
          const normalized = normalizeMarket(event, platform, fetchedAt);
          if (normalized) {
            allMarkets.push(normalized);
          }
        }
      } else {
        errors.push(`${platform}: ${result.reason}`);
      }
    }

    return {
      source: 'pmxt',
      markets: allMarkets,
      fetchedAt,
      latencyMs: Date.now() - startTime,
      errors: errors.length > 0 ? errors : undefined,
    };
  },

  /**
   * Search markets across platforms
   */
  async searchMarkets(query: string, options: FetchOptions = {}): Promise<AggregatorResponse> {
    const startTime = Date.now();
    const fetchedAt = new Date();
    const errors: string[] = [];
    const allMarkets: RawMarketData[] = [];

    try {
      // Use PMXT unified search
      const platforms = options.platforms
        ? options.platforms.filter(p => SUPPORTED_PLATFORMS.includes(p))
        : SUPPORTED_PLATFORMS;

      const results = await searchPmxtMarkets(query, platforms, options.limit || 50);

      for (const event of results) {
        // Determine platform from event data
        const platformName = event.exchange || event.platform || 'unknown';
        const platform = PLATFORM_MAP[platformName.toLowerCase()] || 'polymarket';

        const normalized = normalizeMarket(event, platform, fetchedAt);
        if (normalized) {
          allMarkets.push(normalized);
        }
      }
    } catch (error) {
      errors.push(`Search failed: ${error}`);
    }

    return {
      source: 'pmxt',
      markets: allMarkets,
      fetchedAt,
      latencyMs: Date.now() - startTime,
      errors: errors.length > 0 ? errors : undefined,
    };
  },

  /**
   * Get hot/trending markets
   */
  async getHotMarkets(limit: number = 20): Promise<AggregatorResponse> {
    const startTime = Date.now();
    const fetchedAt = new Date();
    const errors: string[] = [];
    const allMarkets: RawMarketData[] = [];

    try {
      // Fetch from each platform and get top by volume
      const results = await Promise.allSettled(
        SUPPORTED_PLATFORMS.slice(0, 3).map(platform => // Top 3 platforms for speed
          fetchPmxtEvents(platform, undefined, Math.ceil(limit / 3))
        )
      );

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const platform = SUPPORTED_PLATFORMS[i];

        if (result.status === 'fulfilled') {
          const events = result.value;
          for (const event of events) {
            const normalized = normalizeMarket(event, platform, fetchedAt);
            if (normalized) {
              allMarkets.push(normalized);
            }
          }
        } else {
          errors.push(`${platform}: ${result.reason}`);
        }
      }

      // Sort by volume (descending)
      allMarkets.sort((a, b) => (b.volume || 0) - (a.volume || 0));
    } catch (error) {
      errors.push(`Hot markets failed: ${error}`);
    }

    return {
      source: 'pmxt',
      markets: allMarkets.slice(0, limit),
      fetchedAt,
      latencyMs: Date.now() - startTime,
      errors: errors.length > 0 ? errors : undefined,
    };
  },

  /**
   * Health check - verify API is responding
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${PMXT_API_BASE}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      // Fallback: try to fetch a small amount of data
      try {
        const result = await fetchPmxtEvents('polymarket', undefined, 1);
        return result.length > 0;
      } catch {
        return false;
      }
    }
  },
};

// =============================================================================
// EXPORTS
// =============================================================================

export { SUPPORTED_PLATFORMS as PMXT_PLATFORMS };
export default pmxtAggregator;
