/**
 * PolyRouter Aggregator Integration
 *
 * PolyRouter is a unified API aggregator for prediction markets.
 * Currently in free beta with 100 requests/minute rate limit.
 *
 * Website: https://polyrouter.io
 * Docs: https://docs.polyrouter.io
 *
 * Supported Platforms:
 * - Polymarket
 * - Kalshi
 * - Manifold Markets
 * - Limitless
 * - ProphetX
 * - Novig
 * - SX.bet
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
// POLYROUTER API CONFIGURATION
// =============================================================================

/**
 * PolyRouter API base URL
 */
const POLYROUTER_API_BASE = 'https://api-v2.polyrouter.io';

/**
 * API Key (set via environment variable)
 * Free to obtain at https://polyrouter.io
 */
const API_KEY = process.env.POLYROUTER_API_KEY || '';

/**
 * Timeout for API requests (ms)
 */
const REQUEST_TIMEOUT = 10000;

/**
 * Rate limit tracking
 */
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 600; // ~100 req/min = 600ms between requests

/**
 * Platform mapping from PolyRouter to our types
 */
const PLATFORM_MAP: Record<string, DataPlatform> = {
  'polymarket': 'polymarket',
  'kalshi': 'kalshi',
  'manifold': 'manifold',
  'limitless': 'limitless',
  'prophetx': 'prophetx',
  'novig': 'novig',
  'sxbet': 'sxbet',
  'sx': 'sxbet',
};

/**
 * Supported platforms via PolyRouter
 */
const SUPPORTED_PLATFORMS: DataPlatform[] = [
  'polymarket',
  'kalshi',
  'manifold',
  'limitless',
  'prophetx',
  'novig',
  'sxbet',
];

// =============================================================================
// RATE LIMITING
// =============================================================================

/**
 * Wait for rate limit if needed
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    );
  }

  lastRequestTime = Date.now();
}

// =============================================================================
// DATA NORMALIZATION
// =============================================================================

/**
 * Normalize PolyRouter market data to our RawMarketData format
 */
function normalizeMarket(
  prData: any,
  fetchedAt: Date
): RawMarketData | null {
  try {
    // Skip invalid data
    if (!prData || !prData.title) {
      return null;
    }

    // Determine platform
    const platformName = prData.platform?.toLowerCase() || 'unknown';
    const platform = PLATFORM_MAP[platformName] || 'polymarket';

    // Extract prices
    // PolyRouter returns current_prices object with yes/no
    let yesPrice = 0;
    let noPrice = 0;

    if (prData.current_prices) {
      yesPrice = parseFloat(prData.current_prices.yes) || 0;
      noPrice = parseFloat(prData.current_prices.no) || (1 - yesPrice);
    } else if (prData.yes_price !== undefined) {
      yesPrice = parseFloat(prData.yes_price) || 0;
      noPrice = parseFloat(prData.no_price) || (1 - yesPrice);
    } else if (prData.probability !== undefined) {
      yesPrice = parseFloat(prData.probability) || 0;
      noPrice = 1 - yesPrice;
    }

    // Skip markets with no valid price
    if (yesPrice === 0 && noPrice === 0) {
      return null;
    }

    // Ensure prices are in 0-1 range
    if (yesPrice > 1) yesPrice = yesPrice / 100;
    if (noPrice > 1) noPrice = noPrice / 100;

    // Build normalized market
    return {
      id: prData.id || prData.market_id || `${platform}-${Date.now()}`,
      platform,
      source: 'polyrouter',
      title: prData.title || '',
      question: prData.question || prData.title || '',
      description: prData.description,
      category: prData.category || prData.market_type,
      yesPrice,
      noPrice,
      volume: parseFloat(prData.volume_24h || prData.volume) || 0,
      volume24h: parseFloat(prData.volume_24h) || undefined,
      liquidity: parseFloat(prData.liquidity) || undefined,
      endDate: prData.end_date || prData.close_time
        ? new Date(prData.end_date || prData.close_time)
        : null,
      createdAt: prData.created_at
        ? new Date(prData.created_at)
        : null,
      fetchedAt,
      status: prData.status === 'active' || prData.status === 'open'
        ? 'active'
        : prData.status === 'resolved'
        ? 'resolved'
        : prData.status === 'closed'
        ? 'closed'
        : 'unknown',
      url: prData.url || prData.market_url,
      _raw: prData,
    };
  } catch (error) {
    console.error('[PolyRouter] Failed to normalize market:', error);
    return null;
  }
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Make authenticated request to PolyRouter API
 */
async function polyRouterRequest(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<any> {
  await waitForRateLimit();

  const url = new URL(`${POLYROUTER_API_BASE}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'BeRight/1.0',
  };

  // Add API key if available
  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    headers,
  });

  if (!response.ok) {
    throw new Error(`PolyRouter API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch markets from PolyRouter
 */
async function fetchMarkets(
  platform?: DataPlatform,
  limit: number = 50
): Promise<any[]> {
  try {
    const params: Record<string, string> = {
      limit: String(limit),
    };

    if (platform) {
      params.platform = platform;
    }

    const data = await polyRouterRequest('/markets', params);

    // PolyRouter returns { markets: [...] } or just an array
    return Array.isArray(data) ? data : (data.markets || data.data || []);
  } catch (error) {
    console.error(`[PolyRouter] Fetch error:`, error);
    return [];
  }
}

/**
 * Search markets via PolyRouter
 */
async function searchMarkets(
  query: string,
  platform?: DataPlatform,
  limit: number = 50
): Promise<any[]> {
  try {
    const params: Record<string, string> = {
      q: query,
      limit: String(limit),
    };

    if (platform) {
      params.platform = platform;
    }

    const data = await polyRouterRequest('/markets/search', params);

    return Array.isArray(data) ? data : (data.markets || data.results || data.data || []);
  } catch (error) {
    console.error('[PolyRouter] Search error:', error);
    return [];
  }
}

// =============================================================================
// AGGREGATOR IMPLEMENTATION
// =============================================================================

/**
 * PolyRouter Aggregator - implements MarketAggregator interface
 */
export const polyRouterAggregator: MarketAggregator = {
  name: 'polyrouter',
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

    // If specific platforms requested, fetch each separately
    // Otherwise fetch all at once (PolyRouter can aggregate)
    try {
      if (options.platforms && options.platforms.length > 0) {
        // Fetch each platform separately
        const results = await Promise.allSettled(
          platforms.map(platform => fetchMarkets(platform, options.limit || 50))
        );

        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          if (result.status === 'fulfilled') {
            for (const market of result.value) {
              const normalized = normalizeMarket(market, fetchedAt);
              if (normalized) {
                allMarkets.push(normalized);
              }
            }
          } else {
            errors.push(`${platforms[i]}: ${result.reason}`);
          }
        }
      } else {
        // Fetch all platforms at once
        const markets = await fetchMarkets(undefined, options.limit || 100);
        for (const market of markets) {
          const normalized = normalizeMarket(market, fetchedAt);
          if (normalized) {
            allMarkets.push(normalized);
          }
        }
      }
    } catch (error) {
      errors.push(`Fetch failed: ${error}`);
    }

    return {
      source: 'polyrouter',
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
      // PolyRouter has a unified search endpoint
      const platforms = options.platforms
        ? options.platforms.filter(p => SUPPORTED_PLATFORMS.includes(p))
        : undefined;

      // If specific platform requested, search that
      // Otherwise search all
      if (platforms && platforms.length === 1) {
        const markets = await searchMarkets(query, platforms[0], options.limit || 50);
        for (const market of markets) {
          const normalized = normalizeMarket(market, fetchedAt);
          if (normalized) {
            allMarkets.push(normalized);
          }
        }
      } else {
        // Search all platforms
        const markets = await searchMarkets(query, undefined, options.limit || 100);
        for (const market of markets) {
          const normalized = normalizeMarket(market, fetchedAt);
          if (normalized) {
            allMarkets.push(normalized);
          }
        }
      }
    } catch (error) {
      errors.push(`Search failed: ${error}`);
    }

    return {
      source: 'polyrouter',
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
      // Fetch markets sorted by volume
      const markets = await fetchMarkets(undefined, limit * 2);

      for (const market of markets) {
        const normalized = normalizeMarket(market, fetchedAt);
        if (normalized) {
          allMarkets.push(normalized);
        }
      }

      // Sort by volume (descending) and take top N
      allMarkets.sort((a, b) => (b.volume || 0) - (a.volume || 0));
    } catch (error) {
      errors.push(`Hot markets failed: ${error}`);
    }

    return {
      source: 'polyrouter',
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
      // Try to fetch one market
      const markets = await fetchMarkets('polymarket', 1);
      return markets.length > 0;
    } catch {
      return false;
    }
  },
};

// =============================================================================
// EXPORTS
// =============================================================================

export { SUPPORTED_PLATFORMS as POLYROUTER_PLATFORMS };
export default polyRouterAggregator;
