/**
 * Polymarket Ingestor
 *
 * Fetches trading data from Polymarket Gamma API
 * API Docs: https://docs.polymarket.com
 */

import { BaseIngestor, IngestorConfig } from './base';
import { Prediction, PredictionDirection } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface PolymarketMarket {
  id: string;
  question: string;
  end_date_iso: string;
  closed: boolean;
  volume: number;
  outcomes: string[];
}

interface PolymarketOrder {
  id: string;
  market_id: string;
  outcome: string;
  price: number;
  size: number;
  side: 'BUY' | 'SELL';
  created_at: string;
  status: 'MATCHED' | 'PENDING' | 'CANCELLED';
}

interface PolymarketPosition {
  market_id: string;
  outcome: string;
  size: number;
  average_entry_price: number;
  realized_pnl: number;
  unrealized_pnl: number;
}

interface PolymarketTraderStats {
  address: string;
  total_volume: number;
  total_trades: number;
  markets_traded: number;
  win_rate: number;
}

export class PolymarketIngestor extends BaseIngestor {
  constructor(config?: Partial<IngestorConfig>) {
    super('polymarket', {
      baseUrl: 'https://gamma-api.polymarket.com',
      rateLimitPerMinute: 60,
      ...config,
    });
  }

  protected getDefaultHeaders(): Record<string, string> {
    const headers = super.getDefaultHeaders();

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  /**
   * Fetch predictions for a Polymarket wallet address
   */
  async fetchUserPredictions(walletAddress: string): Promise<Prediction[]> {
    try {
      // Fetch user's orders (trade history)
      const orders = await this.fetchUserOrders(walletAddress);

      // Fetch user's positions
      const positions = await this.fetchUserPositions(walletAddress);

      // Fetch market details for all markets traded
      const marketIds = [...new Set(orders.map(o => o.market_id))];
      const markets = await this.fetchMarkets(marketIds);
      const marketMap = new Map(markets.map(m => [m.id, m]));

      // Convert orders to Prediction format
      const predictions: Prediction[] = [];

      for (const order of orders) {
        if (order.status !== 'MATCHED') continue;  // Only matched orders

        const market = marketMap.get(order.market_id);
        if (!market) continue;

        // Find position for this market
        const position = positions.find(p => p.market_id === order.market_id);

        // Determine if market is resolved
        const isResolved = market.closed;
        const outcome = isResolved ? this.getMarketOutcome(market, order.outcome) : undefined;

        const prediction: Prediction = {
          id: uuidv4(),
          forecasterId: walletAddress,
          platform: 'polymarket',
          marketId: market.id,
          marketTitle: market.question,
          predictedProbability: order.price,
          direction: order.outcome === 'YES' ? 'YES' : 'NO',

          // CLOB-specific fields
          entryPrice: order.price,
          exitPrice: position?.average_entry_price,
          positionSize: order.size,

          // Outcome
          outcome,
          resolvedAt: isResolved ? this.normalizeTimestamp(market.end_date_iso) : undefined,

          // Timing
          predictedAt: this.normalizeTimestamp(order.created_at),
          marketCloseTime: this.normalizeTimestamp(market.end_date_iso),

          // Context
          volume: market.volume,
          difficulty: this.estimateDifficulty(order.price),

          // Calculated metrics
          isExtremePrice: order.price < 0.2 || order.price > 0.8,

          createdAt: new Date(),
          updatedAt: new Date(),
        };

        predictions.push(prediction);
      }

      this.logger.info(
        { walletAddress, count: predictions.length },
        'Fetched Polymarket predictions'
      );

      return predictions;
    } catch (error) {
      this.logger.error({ walletAddress, error }, 'Failed to fetch Polymarket predictions');
      throw error;
    }
  }

  /**
   * Get top traders by volume
   */
  async getTopForecasters(limit: number = 100): Promise<string[]> {
    try {
      const response = await this.client.get('/leaderboard', {
        params: {
          limit,
          sort: 'volume',  // Sort by total volume
        },
      });

      const traders: PolymarketTraderStats[] = response.data;
      return traders.map(t => t.address);
    } catch (error) {
      this.logger.error({ error }, 'Failed to fetch Polymarket leaderboard');

      // Fallback: return sample addresses for testing
      this.logger.warn('Using fallback sample addresses');
      return this.getSampleTopTraders(limit);
    }
  }

  /**
   * Fetch user's order history
   */
  private async fetchUserOrders(walletAddress: string): Promise<PolymarketOrder[]> {
    try {
      const response = await this.client.get(`/orders`, {
        params: {
          maker: walletAddress,
          limit: 1000,  // Max allowed
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error({ walletAddress, error }, 'Failed to fetch orders');
      return [];
    }
  }

  /**
   * Fetch user's current positions
   */
  private async fetchUserPositions(walletAddress: string): Promise<PolymarketPosition[]> {
    try {
      const response = await this.client.get(`/positions`, {
        params: {
          user: walletAddress,
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error({ walletAddress, error }, 'Failed to fetch positions');
      return [];
    }
  }

  /**
   * Fetch market details for multiple markets
   */
  private async fetchMarkets(marketIds: string[]): Promise<PolymarketMarket[]> {
    const markets: PolymarketMarket[] = [];

    // Batch requests to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < marketIds.length; i += batchSize) {
      const batch = marketIds.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (marketId) => {
          try {
            const response = await this.client.get(`/markets/${marketId}`);
            markets.push(response.data);
          } catch (error) {
            this.logger.warn({ marketId }, 'Failed to fetch market');
          }
        })
      );

      // Rate limiting
      await this.sleep(1000);
    }

    return markets;
  }

  /**
   * Determine market outcome (simplified - actual resolution is complex)
   */
  private getMarketOutcome(market: PolymarketMarket, userOutcome: string): boolean | undefined {
    if (!market.closed) return undefined;

    // This is simplified - in reality, you'd need to check settlement data
    // For now, assume binary markets and check which outcome won
    // In production, you'd call /settlements endpoint

    return userOutcome === 'YES';  // Placeholder
  }

  /**
   * Estimate market difficulty from price
   * High difficulty = price near 0.5 (uncertain)
   * Low difficulty = price near 0 or 1 (certain)
   */
  private estimateDifficulty(price: number): number {
    // Difficulty = 1 - |price - 0.5| * 2
    // Price 0.5 → difficulty 1.0
    // Price 0.0 or 1.0 → difficulty 0.0
    return 1 - Math.abs(price - 0.5) * 2;
  }

  /**
   * Sample top traders (fallback for testing when API is unavailable)
   */
  private getSampleTopTraders(limit: number): string[] {
    // These are example addresses - in production, fetch from API
    const sampleAddresses = [
      '0x1234567890123456789012345678901234567890',
      '0x2345678901234567890123456789012345678901',
      '0x3456789012345678901234567890123456789012',
      '0x4567890123456789012345678901234567890123',
      '0x5678901234567890123456789012345678901234',
    ];

    return sampleAddresses.slice(0, Math.min(limit, sampleAddresses.length));
  }
}
