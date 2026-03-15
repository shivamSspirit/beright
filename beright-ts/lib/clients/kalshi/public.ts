/**
 * Kalshi Public API Client
 * No authentication required - real production market data
 */

import { fetchWithTimeout, TIMEOUT_DEFAULTS } from '../../core/timeout';
import { withRetry, RETRY_PRESETS } from '../../core/retry';
import { NetworkError, PlatformError } from '../../core/errors';
import type {
  KalshiMarket,
  KalshiEvent,
  KalshiSeries,
  KalshiTrade,
  KalshiOrderbook,
  KalshiExchangeStatus,
  KalshiSchedule,
  KalshiMarketQuery,
  KalshiEventQuery,
} from './types';

// Production API endpoint for public data
const KALSHI_PUBLIC_API = 'https://api.elections.kalshi.com/trade-api/v2';

/**
 * Public Kalshi API client
 * Provides read-only access to market data without authentication
 */
export class KalshiPublicClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly debug: boolean;

  constructor(options: { timeoutMs?: number; debug?: boolean } = {}) {
    this.baseUrl = KALSHI_PUBLIC_API;
    this.timeoutMs = options.timeoutMs ?? TIMEOUT_DEFAULTS.STANDARD;
    this.debug = options.debug ?? false;
  }

  /**
   * Make an authenticated request to the public API
   */
  private async request<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    // Build URL with query params
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    if (this.debug) {
      console.log(`[Kalshi Public] GET ${url.toString()}`);
    }

    const response = await withRetry(
      async () => {
        const res = await fetchWithTimeout(url.toString(), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          timeoutMs: this.timeoutMs,
        });

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new PlatformError(
            'kalshi',
            `API request failed: ${res.status} ${res.statusText}`,
            res.status >= 500, // Retry on 5xx
            String(res.status),
            { path, body }
          );
        }

        return res;
      },
      RETRY_PRESETS.CONSERVATIVE
    );

    return response.json() as Promise<T>;
  }

  // ============================================================================
  // Markets
  // ============================================================================

  /**
   * Get a single market by ticker
   */
  async getMarket(ticker: string): Promise<KalshiMarket> {
    const result = await this.request<{ market: KalshiMarket }>(`/markets/${ticker}`);
    return result.market;
  }

  /**
   * Get multiple markets with optional filters
   */
  async getMarkets(query?: KalshiMarketQuery): Promise<{ markets: KalshiMarket[]; cursor?: string }> {
    return this.request<{ markets: KalshiMarket[]; cursor?: string }>('/markets', query as Record<string, string | number>);
  }

  /**
   * Search markets by query string
   */
  async searchMarkets(searchQuery: string, limit: number = 20): Promise<KalshiMarket[]> {
    // Kalshi doesn't have a direct search endpoint, so we fetch and filter
    const { markets } = await this.getMarkets({ limit: 100, status: 'open' });

    const query = searchQuery.toLowerCase();
    const filtered = markets.filter(
      (m) =>
        m.title.toLowerCase().includes(query) ||
        m.subtitle?.toLowerCase().includes(query) ||
        m.ticker.toLowerCase().includes(query)
    );

    return filtered.slice(0, limit);
  }

  /**
   * Get trending/hot markets
   */
  async getHotMarkets(limit: number = 10): Promise<KalshiMarket[]> {
    const { markets } = await this.getMarkets({ status: 'open', limit: 100 });

    // Sort by volume and activity
    const sorted = markets.sort((a, b) => {
      // Combine volume and open interest for "hotness"
      const scoreA = (a.volume_24h || a.volume) + a.open_interest;
      const scoreB = (b.volume_24h || b.volume) + b.open_interest;
      return scoreB - scoreA;
    });

    return sorted.slice(0, limit);
  }

  // ============================================================================
  // Events
  // ============================================================================

  /**
   * Get a single event by ticker
   */
  async getEvent(eventTicker: string): Promise<KalshiEvent> {
    const result = await this.request<{ event: KalshiEvent }>(`/events/${eventTicker}`);
    return result.event;
  }

  /**
   * Get multiple events with optional filters
   */
  async getEvents(query?: KalshiEventQuery): Promise<{ events: KalshiEvent[]; cursor?: string }> {
    return this.request<{ events: KalshiEvent[]; cursor?: string }>('/events', query as Record<string, string | number>);
  }

  // ============================================================================
  // Series
  // ============================================================================

  /**
   * Get a single series by ticker
   */
  async getSeries(seriesTicker: string): Promise<KalshiSeries> {
    const result = await this.request<{ series: KalshiSeries }>(`/series/${seriesTicker}`);
    return result.series;
  }

  // ============================================================================
  // Trades & Orderbook
  // ============================================================================

  /**
   * Get recent trades for a market
   */
  async getTrades(ticker: string, limit: number = 100): Promise<KalshiTrade[]> {
    const result = await this.request<{ trades: KalshiTrade[] }>(`/markets/${ticker}/trades`, {
      limit,
    });
    return result.trades;
  }

  /**
   * Get orderbook for a market
   */
  async getOrderbook(ticker: string, depth: number = 10): Promise<KalshiOrderbook> {
    const result = await this.request<{ orderbook: KalshiOrderbook }>(`/markets/${ticker}/orderbook`, {
      depth,
    });
    return result.orderbook;
  }

  // ============================================================================
  // Exchange Status
  // ============================================================================

  /**
   * Get exchange status
   */
  async getExchangeStatus(): Promise<KalshiExchangeStatus> {
    const result = await this.request<{ exchange_status: KalshiExchangeStatus }>('/exchange/status');
    return result.exchange_status;
  }

  /**
   * Get exchange schedule
   */
  async getSchedule(): Promise<KalshiSchedule> {
    return this.request<KalshiSchedule>('/exchange/schedule');
  }

  /**
   * Check if exchange is currently open for trading
   */
  async isExchangeOpen(): Promise<boolean> {
    const status = await this.getExchangeStatus();
    return status.exchange_active && status.trading_active;
  }
}

/**
 * Singleton instance of public client
 */
let publicClientInstance: KalshiPublicClient | null = null;

/**
 * Get the shared public client instance
 */
export function getKalshiPublicClient(options?: { timeoutMs?: number; debug?: boolean }): KalshiPublicClient {
  if (!publicClientInstance) {
    publicClientInstance = new KalshiPublicClient(options);
  }
  return publicClientInstance;
}
