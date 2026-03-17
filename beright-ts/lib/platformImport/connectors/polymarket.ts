/**
 * Polymarket Connector
 *
 * Fetches forecaster stats from Polymarket (Tier 2, real-money).
 * Uses wallet signature verification (Polygon/Ethereum).
 *
 * API: Gamma API (https://gamma-api.polymarket.com)
 */

import { BasePlatformConnector, registerConnector } from './base';
import { verifyEthereumSignature, getWalletVerificationMessage } from '../verification';
import type {
  ExternalPlatform,
  ImportedStats,
  OwnershipProof,
  VerificationResult,
} from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface PolymarketTrader {
  address: string;
  totalPositions: number;
  resolvedPositions: number;
  totalVolume: number;        // In USD
  totalProfit: number;        // In USD
  winRate: number;            // 0-1
  rank?: number;
  avgPositionSize?: number;
}

interface PolymarketPosition {
  id: string;
  marketId: string;
  marketTitle: string;
  outcome: 'YES' | 'NO';
  avgPrice: number;           // Average entry price (0-1)
  size: number;               // Position size in contracts
  realizedPnl: number;        // USD
  unrealizedPnl: number;      // USD
  resolved: boolean;
  resolution?: 'YES' | 'NO';
  resolutionTime?: string;
}

interface PolymarketMarketActivity {
  marketId: string;
  trades: number;
  volume: number;
  avgEntryPrice: number;
  exitPrice?: number;
  pnl?: number;
}

// =============================================================================
// CONNECTOR
// =============================================================================

export class PolymarketConnector extends BasePlatformConnector {
  platform: ExternalPlatform = 'polymarket';

  /**
   * Verify ownership via wallet signature.
   */
  async verifyOwnership(
    walletAddress: string,
    proof: OwnershipProof
  ): Promise<VerificationResult> {
    if (proof.type !== 'wallet_signature') {
      return { verified: false, error: 'Polymarket requires wallet signature verification' };
    }

    if (!proof.data.message || !proof.data.signature) {
      return { verified: false, error: 'Missing message or signature' };
    }

    // Verify the signature
    return verifyEthereumSignature(
      proof.data.message,
      proof.data.signature,
      walletAddress
    );
  }

  /**
   * Fetch forecaster stats from Polymarket.
   */
  async fetchStats(walletAddress: string): Promise<ImportedStats> {
    // Normalize address to lowercase
    const address = walletAddress.toLowerCase();

    // Fetch trader profile
    const trader = await this.fetchTraderProfile(address);

    if (!trader) {
      throw new Error(`Wallet "${walletAddress}" has no Polymarket activity`);
    }

    // Fetch positions for more detailed analysis
    const positions = await this.fetchTraderPositions(address);

    // Filter to resolved positions
    const resolvedPositions = positions.filter((p) => p.resolved && p.resolution);

    // Calculate Brier score from positions
    // Use avgPrice as the predicted probability
    const predictionData = resolvedPositions.map((p) => ({
      predicted: p.outcome === 'YES' ? p.avgPrice : 1 - p.avgPrice,
      actual: p.resolution === 'YES' ? 1 : 0,
    }));

    const brierScore = this.calculateBrierScore(predictionData);
    const calibrationData = this.calculateCalibration(predictionData);

    return {
      brierScore,
      predictionCount: trader.totalPositions,
      resolvedCount: trader.resolvedPositions,
      accuracy: trader.winRate,
      calibrationData,
      platformRank: trader.rank ?? null,
      platformPercentile: null,
      totalVolumeUsd: trader.totalVolume,
      profitLossUsd: trader.totalProfit,
      roi: trader.totalVolume > 0 ? trader.totalProfit / trader.totalVolume : null,
      importedAt: new Date().toISOString(),
      rawData: {
        trader: {
          address: trader.address,
          totalPositions: trader.totalPositions,
          totalVolume: trader.totalVolume,
          totalProfit: trader.totalProfit,
          winRate: trader.winRate,
        },
        positionsCount: positions.length,
        resolvedPositionsCount: resolvedPositions.length,
      },
    };
  }

  /**
   * Normalize Polymarket data to Brier score.
   * Polymarket doesn't use Brier natively, we calculate from positions.
   */
  normalizeToBrier(platformData: unknown): number | null {
    // Polymarket doesn't expose Brier directly
    return null;
  }

  /**
   * Check if wallet has Polymarket activity.
   */
  async userExists(walletAddress: string): Promise<boolean> {
    try {
      const trader = await this.fetchTraderProfile(walletAddress.toLowerCase());
      return trader !== null && trader.totalPositions > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get the verification message for wallet signing.
   */
  getVerificationMessage(berightWallet: string, polymarketWallet: string): string {
    return getWalletVerificationMessage(berightWallet, polymarketWallet, 'polymarket');
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  /**
   * Fetch trader profile from Gamma API.
   */
  private async fetchTraderProfile(address: string): Promise<PolymarketTrader | null> {
    const baseUrl = this.getApiBaseUrl();

    try {
      // Try the traders endpoint
      const response = await this.fetch(`${baseUrl}/traders/${address}`);

      if (!response.ok) {
        if (response.status === 404) {
          // Try alternative endpoint
          return this.fetchTraderFromActivity(address);
        }
        throw new Error(`Polymarket API error: ${response.status}`);
      }

      const data = await response.json();
      return this.normalizeTraderData(data);
    } catch (error) {
      console.error('Polymarket fetchTraderProfile error:', error);
      return this.fetchTraderFromActivity(address);
    }
  }

  /**
   * Fetch trader data from activity endpoint as fallback.
   */
  private async fetchTraderFromActivity(address: string): Promise<PolymarketTrader | null> {
    const baseUrl = this.getApiBaseUrl();

    try {
      const response = await this.fetch(
        `${baseUrl}/activity?address=${address}&limit=100`
      );

      if (!response.ok) {
        return null;
      }

      const activities = await response.json();

      if (!Array.isArray(activities) || activities.length === 0) {
        return null;
      }

      // Aggregate stats from activities
      let totalVolume = 0;
      let totalProfit = 0;
      const marketsSeen = new Set<string>();

      for (const activity of activities) {
        if (activity.volume) totalVolume += activity.volume;
        if (activity.pnl) totalProfit += activity.pnl;
        if (activity.marketId) marketsSeen.add(activity.marketId);
      }

      return {
        address,
        totalPositions: marketsSeen.size,
        resolvedPositions: 0, // Can't determine from activity
        totalVolume,
        totalProfit,
        winRate: 0, // Can't determine from activity
      };
    } catch {
      return null;
    }
  }

  /**
   * Fetch trader positions from Gamma API.
   */
  private async fetchTraderPositions(address: string): Promise<PolymarketPosition[]> {
    const baseUrl = this.getApiBaseUrl();
    const positions: PolymarketPosition[] = [];

    try {
      // Fetch positions endpoint
      const response = await this.fetch(
        `${baseUrl}/positions?address=${address}&limit=1000`
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        for (const pos of data) {
          positions.push(this.normalizePositionData(pos));
        }
      }
    } catch (error) {
      console.error('Polymarket fetchTraderPositions error:', error);
    }

    return positions;
  }

  /**
   * Normalize trader data from API response.
   */
  private normalizeTraderData(data: Record<string, unknown>): PolymarketTrader {
    return {
      address: String(data.address || ''),
      totalPositions: Number(data.totalPositions ?? data.positions_count ?? 0),
      resolvedPositions: Number(data.resolvedPositions ?? data.resolved_count ?? 0),
      totalVolume: Number(data.totalVolume ?? data.volume ?? 0),
      totalProfit: Number(data.totalProfit ?? data.profit ?? data.pnl ?? 0),
      winRate: Number(data.winRate ?? data.win_rate ?? 0),
      rank: data.rank ? Number(data.rank) : undefined,
    };
  }

  /**
   * Normalize position data from API response.
   */
  private normalizePositionData(data: Record<string, unknown>): PolymarketPosition {
    return {
      id: String(data.id || ''),
      marketId: String(data.marketId ?? data.market_id ?? ''),
      marketTitle: String(data.marketTitle ?? data.title ?? ''),
      outcome: (data.outcome as 'YES' | 'NO') || 'YES',
      avgPrice: Number(data.avgPrice ?? data.avg_price ?? 0.5),
      size: Number(data.size ?? data.amount ?? 0),
      realizedPnl: Number(data.realizedPnl ?? data.realized_pnl ?? 0),
      unrealizedPnl: Number(data.unrealizedPnl ?? data.unrealized_pnl ?? 0),
      resolved: Boolean(data.resolved ?? data.is_resolved),
      resolution: data.resolution as 'YES' | 'NO' | undefined,
      resolutionTime: data.resolutionTime as string | undefined,
    };
  }
}

// =============================================================================
// REGISTER CONNECTOR
// =============================================================================

const polymarketConnector = new PolymarketConnector();
registerConnector(polymarketConnector);

export default polymarketConnector;
