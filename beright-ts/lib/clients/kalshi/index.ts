/**
 * Kalshi API Client
 * Unified client for Kalshi prediction market API
 *
 * This module provides:
 * - Public API access (no auth required) for market data
 * - Private API access (auth required) for trading
 * - WebSocket support for real-time data (coming soon)
 *
 * Usage:
 * ```typescript
 * import { getKalshiPublicClient, getKalshiPrivateClient } from '@/lib/clients/kalshi';
 *
 * // Public data (no auth)
 * const publicClient = getKalshiPublicClient();
 * const markets = await publicClient.getHotMarkets();
 *
 * // Trading (requires auth)
 * const privateClient = getKalshiPrivateClient();
 * const balance = await privateClient.getBalance();
 * ```
 */

// Re-export types
export * from './types';

// Re-export auth utilities
export { loadCredentials, hasCredentials, signRequest } from './auth';

// Re-export public client
export { KalshiPublicClient, getKalshiPublicClient } from './public';

// Re-export private client
export { KalshiPrivateClient, getKalshiPrivateClient, hasKalshiCredentials } from './private';

// ============================================================================
// Unified Client (combines public + private)
// ============================================================================

import { KalshiPublicClient, getKalshiPublicClient } from './public';
import { KalshiPrivateClient, getKalshiPrivateClient, hasKalshiCredentials } from './private';
import type { KalshiMarket, KalshiBalance, KalshiPosition, KalshiOrder, KalshiOrderRequest } from './types';

/**
 * Unified Kalshi client that combines public and private APIs
 * Automatically uses public API for read operations and private for write
 */
export class KalshiClient {
  private readonly publicClient: KalshiPublicClient;
  private privateClient: KalshiPrivateClient | null = null;
  public readonly isDemo: boolean;

  constructor(options: { demo?: boolean } = {}) {
    this.isDemo = options.demo ?? true;
    this.publicClient = getKalshiPublicClient();

    if (hasKalshiCredentials()) {
      try {
        this.privateClient = getKalshiPrivateClient(this.isDemo);
      } catch (error) {
        console.warn('[KalshiClient] Private client not available:', error);
      }
    }
  }

  /**
   * Check if trading is available
   */
  get canTrade(): boolean {
    return this.privateClient !== null;
  }

  // ============================================================================
  // Public API Methods (no auth)
  // ============================================================================

  async getMarket(ticker: string): Promise<KalshiMarket> {
    return this.publicClient.getMarket(ticker);
  }

  async getMarkets(query?: Parameters<KalshiPublicClient['getMarkets']>[0]) {
    return this.publicClient.getMarkets(query);
  }

  async searchMarkets(query: string, limit?: number): Promise<KalshiMarket[]> {
    return this.publicClient.searchMarkets(query, limit);
  }

  async getHotMarkets(limit?: number): Promise<KalshiMarket[]> {
    return this.publicClient.getHotMarkets(limit);
  }

  async getOrderbook(ticker: string, depth?: number) {
    return this.publicClient.getOrderbook(ticker, depth);
  }

  async isExchangeOpen(): Promise<boolean> {
    return this.publicClient.isExchangeOpen();
  }

  // ============================================================================
  // Private API Methods (requires auth)
  // ============================================================================

  private requirePrivate(): KalshiPrivateClient {
    if (!this.privateClient) {
      throw new Error('Kalshi credentials not configured. Trading is not available.');
    }
    return this.privateClient;
  }

  async getBalance(): Promise<KalshiBalance> {
    return this.requirePrivate().getBalance();
  }

  async getPositions() {
    return this.requirePrivate().getPositions();
  }

  async getPosition(ticker: string): Promise<KalshiPosition | null> {
    return this.requirePrivate().getPosition(ticker);
  }

  async placeOrder(order: KalshiOrderRequest): Promise<KalshiOrder> {
    return this.requirePrivate().placeOrder(order);
  }

  async cancelOrder(orderId: string): Promise<KalshiOrder> {
    return this.requirePrivate().cancelOrder(orderId);
  }

  async cancelAllOrders(ticker?: string) {
    return this.requirePrivate().cancelAllOrders(ticker);
  }

  async buyYes(ticker: string, count: number, limitPrice?: number): Promise<KalshiOrder> {
    return this.requirePrivate().buyYes(ticker, count, limitPrice);
  }

  async buyNo(ticker: string, count: number, limitPrice?: number): Promise<KalshiOrder> {
    return this.requirePrivate().buyNo(ticker, count, limitPrice);
  }

  async sellYes(ticker: string, count: number, limitPrice?: number): Promise<KalshiOrder> {
    return this.requirePrivate().sellYes(ticker, count, limitPrice);
  }

  async sellNo(ticker: string, count: number, limitPrice?: number): Promise<KalshiOrder> {
    return this.requirePrivate().sellNo(ticker, count, limitPrice);
  }

  async getPortfolioSummary() {
    return this.requirePrivate().getPortfolioSummary();
  }

  async getFills(options?: Parameters<KalshiPrivateClient['getFills']>[0]) {
    return this.requirePrivate().getFills(options);
  }

  async getSettlements(cursor?: string) {
    return this.requirePrivate().getSettlements(cursor);
  }
}

// ============================================================================
// Singleton
// ============================================================================

let clientInstance: KalshiClient | null = null;

/**
 * Get the shared Kalshi client instance
 */
export function getKalshiClient(options?: { demo?: boolean }): KalshiClient {
  if (!clientInstance) {
    clientInstance = new KalshiClient(options);
  }
  return clientInstance;
}

/**
 * Check if using demo mode
 */
export function isKalshiDemo(): boolean {
  return getKalshiClient().isDemo;
}
