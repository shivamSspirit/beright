/**
 * Kalshi Private API Client
 * Authenticated endpoints for trading and account management
 */

import { fetchWithTimeout, TIMEOUT_DEFAULTS } from '../../core/timeout';
import { withRetry, RETRY_PRESETS } from '../../core/retry';
import { PlatformError, AuthError } from '../../core/errors';
import { loadCredentials, signRequest, type KalshiCredentials } from './auth';
import type {
  KalshiBalance,
  KalshiPosition,
  KalshiOrder,
  KalshiOrderRequest,
  KalshiFill,
  KalshiSettlement,
  KalshiPositionsResponse,
  KalshiOrdersResponse,
  KalshiFillsResponse,
  KalshiSettlementsResponse,
} from './types';

// API endpoints
const KALSHI_DEMO_API = 'https://demo-api.kalshi.co/trade-api/v2';
const KALSHI_PROD_API = 'https://api.elections.kalshi.com/trade-api/v2';

/**
 * Private Kalshi API client
 * Requires authentication for trading operations
 */
export class KalshiPrivateClient {
  private readonly baseUrl: string;
  private readonly credentials: KalshiCredentials;
  private readonly timeoutMs: number;
  private readonly debug: boolean;
  public readonly isDemo: boolean;

  constructor(options: {
    demo?: boolean;
    apiKeyId?: string;
    privateKeyPath?: string;
    privateKey?: string;
    timeoutMs?: number;
    debug?: boolean;
  } = {}) {
    this.isDemo = options.demo ?? true; // Default to demo for safety
    this.baseUrl = this.isDemo ? KALSHI_DEMO_API : KALSHI_PROD_API;
    this.timeoutMs = options.timeoutMs ?? TIMEOUT_DEFAULTS.STANDARD;
    this.debug = options.debug ?? false;

    // Load credentials
    const creds = loadCredentials(options.apiKeyId, options.privateKeyPath, options.privateKey);
    if (!creds) {
      throw new AuthError('Kalshi credentials not configured', false);
    }
    this.credentials = creds;
  }

  /**
   * Make an authenticated request
   */
  private async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      query?: Record<string, string | number | undefined>;
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, query } = options;

    // Build URL with query params
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    // Get signed headers
    const signedHeaders = signRequest(
      this.credentials,
      method,
      url.pathname + url.search
    );

    if (this.debug) {
      console.log(`[Kalshi Private] ${method} ${url.toString()}`);
    }

    const response = await withRetry(
      async () => {
        const res = await fetchWithTimeout(url.toString(), {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...signedHeaders,
          },
          body: body ? JSON.stringify(body) : undefined,
          timeoutMs: this.timeoutMs,
        });

        if (!res.ok) {
          const errorBody = await res.text().catch(() => '');

          if (res.status === 401 || res.status === 403) {
            throw new AuthError(
              `Authentication failed: ${res.status}`,
              res.status === 401
            );
          }

          throw new PlatformError(
            'kalshi',
            `API request failed: ${res.status} ${res.statusText}`,
            res.status >= 500,
            String(res.status),
            { path, errorBody }
          );
        }

        return res;
      },
      RETRY_PRESETS.CONSERVATIVE
    );

    return response.json() as Promise<T>;
  }

  // ============================================================================
  // Balance & Portfolio
  // ============================================================================

  /**
   * Get account balance
   */
  async getBalance(): Promise<KalshiBalance> {
    const result = await this.request<{ balance: KalshiBalance }>('/portfolio/balance');
    return result.balance;
  }

  /**
   * Get portfolio summary
   */
  async getPortfolioSummary(): Promise<{
    balance: KalshiBalance;
    positions: KalshiPosition[];
    totalValue: number;
    unrealizedPnL: number;
  }> {
    const [balance, positionsResp] = await Promise.all([
      this.getBalance(),
      this.getPositions(),
    ]);

    // Calculate totals
    let unrealizedPnL = 0;
    for (const pos of positionsResp.positions) {
      unrealizedPnL += pos.realized_pnl || 0;
    }

    const totalValue = (balance.balance || 0) + (balance.portfolio_value || 0);

    return {
      balance,
      positions: positionsResp.positions,
      totalValue,
      unrealizedPnL,
    };
  }

  // ============================================================================
  // Positions
  // ============================================================================

  /**
   * Get all positions
   */
  async getPositions(cursor?: string): Promise<{ positions: KalshiPosition[]; cursor?: string }> {
    const result = await this.request<KalshiPositionsResponse>('/portfolio/positions', {
      query: { cursor },
    });
    return { positions: result.market_positions, cursor: result.cursor };
  }

  /**
   * Get position for a specific market
   */
  async getPosition(ticker: string): Promise<KalshiPosition | null> {
    const { positions } = await this.getPositions();
    return positions.find((p) => p.market_ticker === ticker) || null;
  }

  // ============================================================================
  // Orders
  // ============================================================================

  /**
   * Place an order
   */
  async placeOrder(order: KalshiOrderRequest): Promise<KalshiOrder> {
    const result = await this.request<{ order: KalshiOrder }>('/portfolio/orders', {
      method: 'POST',
      body: order,
    });
    return result.order;
  }

  /**
   * Get all resting orders
   */
  async getOrders(
    options: { ticker?: string; status?: string; cursor?: string } = {}
  ): Promise<{ orders: KalshiOrder[]; cursor?: string }> {
    return this.request<KalshiOrdersResponse>('/portfolio/orders', {
      query: options as Record<string, string>,
    });
  }

  /**
   * Get a specific order
   */
  async getOrder(orderId: string): Promise<KalshiOrder> {
    const result = await this.request<{ order: KalshiOrder }>(`/portfolio/orders/${orderId}`);
    return result.order;
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<KalshiOrder> {
    const result = await this.request<{ order: KalshiOrder }>(`/portfolio/orders/${orderId}`, {
      method: 'DELETE',
    });
    return result.order;
  }

  /**
   * Cancel all orders for a market
   */
  async cancelAllOrders(ticker?: string): Promise<{ canceled: number }> {
    const query = ticker ? { ticker } : undefined;
    return this.request<{ canceled: number }>('/portfolio/orders', {
      method: 'DELETE',
      query,
    });
  }

  /**
   * Amend an order (change price or quantity)
   */
  async amendOrder(
    orderId: string,
    changes: { count?: number; price?: number }
  ): Promise<KalshiOrder> {
    const result = await this.request<{ order: KalshiOrder }>(`/portfolio/orders/${orderId}`, {
      method: 'PATCH',
      body: changes,
    });
    return result.order;
  }

  // ============================================================================
  // Fills & Settlements
  // ============================================================================

  /**
   * Get order fills (executed trades)
   */
  async getFills(
    options: { ticker?: string; order_id?: string; cursor?: string } = {}
  ): Promise<{ fills: KalshiFill[]; cursor?: string }> {
    return this.request<KalshiFillsResponse>('/portfolio/fills', {
      query: options as Record<string, string>,
    });
  }

  /**
   * Get settlements (resolved markets)
   */
  async getSettlements(cursor?: string): Promise<{ settlements: KalshiSettlement[]; cursor?: string }> {
    return this.request<KalshiSettlementsResponse>('/portfolio/settlements', {
      query: { cursor },
    });
  }

  // ============================================================================
  // Convenience Methods
  // ============================================================================

  /**
   * Buy YES contracts
   */
  async buyYes(
    ticker: string,
    count: number,
    limitPrice?: number
  ): Promise<KalshiOrder> {
    return this.placeOrder({
      ticker,
      side: 'yes',
      action: 'buy',
      type: limitPrice ? 'limit' : 'market',
      count,
      yes_price: limitPrice,
    });
  }

  /**
   * Buy NO contracts
   */
  async buyNo(
    ticker: string,
    count: number,
    limitPrice?: number
  ): Promise<KalshiOrder> {
    return this.placeOrder({
      ticker,
      side: 'no',
      action: 'buy',
      type: limitPrice ? 'limit' : 'market',
      count,
      no_price: limitPrice,
    });
  }

  /**
   * Sell YES contracts
   */
  async sellYes(
    ticker: string,
    count: number,
    limitPrice?: number
  ): Promise<KalshiOrder> {
    return this.placeOrder({
      ticker,
      side: 'yes',
      action: 'sell',
      type: limitPrice ? 'limit' : 'market',
      count,
      yes_price: limitPrice,
    });
  }

  /**
   * Sell NO contracts
   */
  async sellNo(
    ticker: string,
    count: number,
    limitPrice?: number
  ): Promise<KalshiOrder> {
    return this.placeOrder({
      ticker,
      side: 'no',
      action: 'sell',
      type: limitPrice ? 'limit' : 'market',
      count,
      no_price: limitPrice,
    });
  }
}

/**
 * Singleton instances
 */
let demoClientInstance: KalshiPrivateClient | null = null;
let prodClientInstance: KalshiPrivateClient | null = null;

/**
 * Get the shared private client instance
 */
export function getKalshiPrivateClient(demo: boolean = true): KalshiPrivateClient {
  if (demo) {
    if (!demoClientInstance) {
      demoClientInstance = new KalshiPrivateClient({ demo: true });
    }
    return demoClientInstance;
  } else {
    if (!prodClientInstance) {
      prodClientInstance = new KalshiPrivateClient({ demo: false });
    }
    return prodClientInstance;
  }
}

/**
 * Check if private client is configured
 */
export function hasKalshiCredentials(): boolean {
  try {
    const creds = loadCredentials();
    return creds !== null;
  } catch {
    return false;
  }
}
