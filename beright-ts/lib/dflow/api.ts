/**
 * DFlow API Client
 *
 * Market data, search, and status checking for auto-resolution
 */

const DFLOW_METADATA_API = 'https://dev-prediction-markets-api.dflow.net';
const DFLOW_TRADE_API = 'https://dev-quote-api.dflow.net';

export interface DFlowEvent {
  ticker: string;
  seriesTicker: string;
  title: string;
  subtitle?: string;
  category?: string;
  competition?: string;
  imageUrl?: string;
  liquidity?: number;
  volume?: number;
  volume24h?: number;
  openInterest?: number;
  strikeDate?: number;
  markets?: DFlowMarket[];
}

export interface DFlowMarket {
  ticker: string;
  eventTicker: string;
  marketType: string;
  title: string;
  subtitle?: string;
  yesSubTitle?: string;
  noSubTitle?: string;
  openTime: number;
  closeTime: number;
  expirationTime: number;
  status: 'initialized' | 'active' | 'inactive' | 'closed' | 'determined' | 'finalized';
  result?: 'yes' | 'no' | '';
  volume: number;
  openInterest: number;
  yesBid?: string;
  yesAsk?: string;
  noBid?: string;
  noAsk?: string;
  canCloseEarly: boolean;
  accounts?: {
    [key: string]: {
      marketLedger: string;
      yesMint: string;
      noMint: string;
      isInitialized: boolean;
      redemptionStatus: 'open' | 'closed';
    };
  };
}

export interface DFlowTrade {
  tradeId: string;
  ticker: string;
  price: number;
  count: number;
  yesPrice: number;
  noPrice: number;
  takerSide: 'yes' | 'no';
  createdTime: number;
}

export interface DFlowOrderbook {
  sequence: number;
  yesBids: Record<string, number>;
  yesAsks: Record<string, number>;
  noBids: Record<string, number>;
  noAsks: Record<string, number>;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Fetch with error handling
 */
async function fetchApi<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.DFLOW_API_KEY ? { 'x-api-key': process.env.DFLOW_API_KEY } : {}),
        ...options?.headers,
      },
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Search events by query
 */
export async function searchEvents(
  query: string,
  options: {
    withNestedMarkets?: boolean;
    limit?: number;
    sort?: 'volume' | 'volume24h' | 'liquidity' | 'openInterest';
    order?: 'asc' | 'desc';
  } = {}
): Promise<ApiResponse<DFlowEvent[]>> {
  const params = new URLSearchParams({
    q: query,
    withNestedMarkets: String(options.withNestedMarkets ?? true),
    limit: String(options.limit ?? 20),
    sort: options.sort ?? 'volume24h',
    order: options.order ?? 'desc',
  });

  return fetchApi<DFlowEvent[]>(`${DFLOW_METADATA_API}/api/v1/search?${params}`);
}

/**
 * Get events with optional filters
 */
export async function getEvents(
  options: {
    limit?: number;
    cursor?: number;
    withNestedMarkets?: boolean;
    isInitialized?: boolean;
    status?: 'initialized' | 'active' | 'inactive' | 'closed' | 'determined';
    seriesTickers?: string[];
    sort?: 'volume' | 'volume24h' | 'liquidity' | 'openInterest' | 'startDate';
    order?: 'asc' | 'desc';
  } = {}
): Promise<ApiResponse<{ events: DFlowEvent[]; cursor?: number }>> {
  const params = new URLSearchParams();

  if (options.limit) params.set('limit', String(options.limit));
  if (options.cursor) params.set('cursor', String(options.cursor));
  if (options.withNestedMarkets !== undefined) params.set('withNestedMarkets', String(options.withNestedMarkets));
  if (options.isInitialized !== undefined) params.set('isInitialized', String(options.isInitialized));
  if (options.status) params.set('status', options.status);
  if (options.seriesTickers) params.set('seriesTickers', options.seriesTickers.join(','));
  if (options.sort) params.set('sort', options.sort);
  if (options.order) params.set('order', options.order);

  return fetchApi<{ events: DFlowEvent[]; cursor?: number }>(`${DFLOW_METADATA_API}/api/v1/events?${params}`);
}

/**
 * Get single event by ticker
 */
export async function getEvent(ticker: string): Promise<ApiResponse<DFlowEvent>> {
  return fetchApi<DFlowEvent>(`${DFLOW_METADATA_API}/api/v1/event/${ticker}`);
}

/**
 * Get single market by ticker
 */
export async function getMarket(ticker: string): Promise<ApiResponse<DFlowMarket>> {
  return fetchApi<DFlowMarket>(`${DFLOW_METADATA_API}/api/v1/market/${ticker}`);
}

/**
 * Get market by outcome mint address
 */
export async function getMarketByMint(mint: string): Promise<ApiResponse<DFlowMarket>> {
  return fetchApi<DFlowMarket>(`${DFLOW_METADATA_API}/api/v1/market/by-mint/${mint}`);
}

/**
 * Batch fetch markets by mints
 */
export async function getMarketsBatch(mints: string[]): Promise<ApiResponse<DFlowMarket[]>> {
  return fetchApi<DFlowMarket[]>(`${DFLOW_METADATA_API}/api/v1/markets/batch`, {
    method: 'POST',
    body: JSON.stringify({ mints }),
  });
}

/**
 * Get orderbook for a market
 */
export async function getOrderbook(ticker: string): Promise<ApiResponse<DFlowOrderbook>> {
  return fetchApi<DFlowOrderbook>(`${DFLOW_METADATA_API}/api/v1/orderbook/${ticker}`);
}

/**
 * Get recent trades
 */
export async function getTrades(
  options: {
    ticker?: string;
    limit?: number;
    minTs?: number;
    maxTs?: number;
  } = {}
): Promise<ApiResponse<DFlowTrade[]>> {
  const params = new URLSearchParams();

  if (options.ticker) params.set('ticker', options.ticker);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.minTs) params.set('minTs', String(options.minTs));
  if (options.maxTs) params.set('maxTs', String(options.maxTs));

  return fetchApi<DFlowTrade[]>(`${DFLOW_METADATA_API}/api/v1/trades?${params}`);
}

/**
 * Get all series (market templates)
 */
export async function getSeries(): Promise<ApiResponse<{ series: Array<{ ticker: string; title: string; category?: string }> }>> {
  return fetchApi<{ series: Array<{ ticker: string; title: string; category?: string }> }>(`${DFLOW_METADATA_API}/api/v1/series`);
}

/**
 * Get tags and categories
 */
export async function getTagsAndCategories(): Promise<ApiResponse<Record<string, string[]>>> {
  return fetchApi<Record<string, string[]>>(`${DFLOW_METADATA_API}/api/v1/tags_by_categories`);
}

/**
 * Check if markets have resolved - key for auto-resolution
 */
export async function checkMarketResolutions(tickers: string[]): Promise<Map<string, { resolved: boolean; result?: 'yes' | 'no' }>> {
  const results = new Map<string, { resolved: boolean; result?: 'yes' | 'no' }>();

  // Batch by fetching events
  const uniqueEventTickers = [...new Set(tickers.map(t => t.split('-').slice(0, -1).join('-')))];

  for (const eventTicker of uniqueEventTickers) {
    const response = await getEvent(eventTicker);
    if (response.success && response.data?.markets) {
      for (const market of response.data.markets) {
        if (tickers.includes(market.ticker)) {
          const isResolved = ['closed', 'determined', 'finalized'].includes(market.status);
          results.set(market.ticker, {
            resolved: isResolved,
            result: isResolved && market.result ? (market.result as 'yes' | 'no') : undefined,
          });
        }
      }
    }
  }

  // For tickers not found via events, check individually
  for (const ticker of tickers) {
    if (!results.has(ticker)) {
      const response = await getMarket(ticker);
      if (response.success && response.data) {
        const isResolved = ['closed', 'determined', 'finalized'].includes(response.data.status);
        results.set(ticker, {
          resolved: isResolved,
          result: isResolved && response.data.result ? (response.data.result as 'yes' | 'no') : undefined,
        });
      } else {
        results.set(ticker, { resolved: false });
      }
    }
  }

  return results;
}

/**
 * Get historical price data (candlesticks)
 */
export async function getCandlesticks(
  ticker: string,
  options: {
    resolution?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
    from?: number;
    to?: number;
  } = {}
): Promise<ApiResponse<Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>>> {
  const params = new URLSearchParams();
  if (options.resolution) params.set('resolution', options.resolution);
  if (options.from) params.set('from', String(options.from));
  if (options.to) params.set('to', String(options.to));

  return fetchApi<Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>>(
    `${DFLOW_METADATA_API}/api/v1/market/${ticker}/candlesticks?${params}`
  );
}

/**
 * Find similar markets to a given question
 * Useful for base rate analysis
 */
export async function findSimilarMarkets(question: string, limit = 10): Promise<DFlowMarket[]> {
  // Extract key terms from question
  const terms = question
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 3 && !['will', 'the', 'be', 'by', 'this', 'that', 'what', 'when', 'how'].includes(t));

  const searchQuery = terms.slice(0, 3).join(' ');
  const response = await searchEvents(searchQuery, { withNestedMarkets: true, limit });

  if (!response.success || !response.data) {
    return [];
  }

  // Flatten markets from events
  const markets: DFlowMarket[] = [];
  for (const event of response.data) {
    if (event.markets) {
      markets.push(...event.markets);
    }
  }

  return markets.slice(0, limit);
}

/**
 * Calculate base rate from historical similar markets
 */
export async function calculateBaseRate(question: string): Promise<{
  baseRate: number;
  sampleSize: number;
  similarMarkets: Array<{ title: string; result: 'yes' | 'no'; yesPrice: number }>;
}> {
  const markets = await findSimilarMarkets(question, 20);

  // Filter to resolved markets
  const resolvedMarkets = markets.filter(
    m => ['determined', 'finalized'].includes(m.status) && m.result
  );

  if (resolvedMarkets.length === 0) {
    return { baseRate: 0.5, sampleSize: 0, similarMarkets: [] };
  }

  // Calculate base rate
  const yesCount = resolvedMarkets.filter(m => m.result === 'yes').length;
  const baseRate = yesCount / resolvedMarkets.length;

  return {
    baseRate,
    sampleSize: resolvedMarkets.length,
    similarMarkets: resolvedMarkets.map(m => ({
      title: m.title,
      result: m.result as 'yes' | 'no',
      yesPrice: parseFloat(m.yesBid || '0.5'),
    })),
  };
}

/**
 * Get hot/trending markets
 * Returns active markets sorted by 24h volume
 */
export async function getHotMarkets(limit = 20): Promise<Array<{
  ticker: string;
  title: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  closeTime?: string;
}>> {
  const response = await getEvents({
    limit,
    withNestedMarkets: true,
    status: 'active',
    sort: 'volume24h',
    order: 'desc',
  });

  if (!response.success || !response.data?.events) {
    return [];
  }

  const markets: Array<{
    ticker: string;
    title: string;
    yesPrice: number;
    noPrice: number;
    volume: number;
    closeTime?: string;
  }> = [];

  for (const event of response.data.events) {
    if (!event.markets) continue;

    for (const market of event.markets) {
      if (market.status !== 'active') continue;

      markets.push({
        ticker: market.ticker,
        title: market.title,
        yesPrice: parseFloat(market.yesBid || '0.5'),
        noPrice: parseFloat(market.noBid || '0.5'),
        volume: market.volume || 0,
        closeTime: market.closeTime ? new Date(market.closeTime).toISOString() : undefined,
      });
    }
  }

  return markets.slice(0, limit);
}

// Export API base URL for other modules
export { DFLOW_METADATA_API, DFLOW_TRADE_API };
