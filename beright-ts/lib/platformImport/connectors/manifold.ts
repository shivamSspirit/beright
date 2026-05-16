/**
 * Manifold Markets Connector
 *
 * Fetches forecaster stats from Manifold Markets (Tier 2, play-money).
 * Uses Manifold public API v0 for user data and bets.
 *
 * API Docs: https://docs.manifold.markets/api
 */

import { BasePlatformConnector, registerConnector } from './base';
import { verifyProfileCode } from '../verification';
import type {
  ExternalPlatform,
  ImportedStats,
  OwnershipProof,
  VerificationResult,
} from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface ManifoldUser {
  id: string;
  username: string;
  name: string;
  bio?: string;
  avatarUrl?: string;
  website?: string;
  createdTime: number;

  // Balances
  balance: number;           // Current mana balance
  totalDeposits?: number;    // Total deposited mana

  // Stats
  profitCached?: {
    daily: number;
    weekly: number;
    monthly: number;
    allTime: number;
  };

  // Ranking
  creatorTraders?: number;   // Number of traders on their markets
  followerCount?: number;
}

interface ManifoldBet {
  id: string;
  contractId: string;
  userId: string;
  createdTime: number;

  // Bet details
  amount: number;            // Mana amount
  outcome: 'YES' | 'NO';
  probBefore: number;        // Probability before bet
  probAfter: number;         // Probability after bet

  // Resolution (only if market resolved)
  isResolved?: boolean;
  resolution?: 'YES' | 'NO' | 'CANCEL' | 'MKT';
  resolutionProbability?: number;

  // Filled
  isFilled?: boolean;
  isCancelled?: boolean;
}

interface ManifoldPosition {
  contractId: string;
  hasYesShares: boolean;
  hasNoShares: boolean;
  totalShares: Record<string, number>;
  payout: number;
  invested: number;
  profit?: number;
}

// =============================================================================
// CONNECTOR
// =============================================================================

export class ManifoldConnector extends BasePlatformConnector {
  platform: ExternalPlatform = 'manifold';

  /**
   * Verify ownership via profile code in bio.
   */
  async verifyOwnership(
    userId: string,
    proof: OwnershipProof
  ): Promise<VerificationResult> {
    if (proof.type !== 'profile_code') {
      return { verified: false, error: 'Manifold requires profile code verification' };
    }

    if (!proof.data.code) {
      return { verified: false, error: 'Missing verification code' };
    }

    // Fetch user profile to check bio
    const fetchBio = async (): Promise<string | null> => {
      const user = await this.fetchUser(userId);
      return user?.bio || null;
    };

    return verifyProfileCode(this.platform, userId, proof.data.code, fetchBio);
  }

  /**
   * Fetch forecaster stats from Manifold.
   */
  async fetchStats(userId: string): Promise<ImportedStats> {
    const user = await this.fetchUser(userId);

    if (!user) {
      throw new Error(`User "${userId}" not found on Manifold`);
    }

    // Fetch user's bets for Brier calculation
    const bets = await this.fetchUserBets(userId);

    // Filter to resolved bets
    const resolvedBets = bets.filter(
      (b) => b.isResolved && b.resolution && b.resolution !== 'CANCEL'
    );

    // Calculate Brier score from bets
    // For Manifold, we use probAfter as the prediction
    const predictionData = resolvedBets
      .filter((b) => b.resolution === 'YES' || b.resolution === 'NO')
      .map((b) => ({
        predicted: b.probAfter,
        actual: b.resolution === 'YES' ? 1 : 0,
      }));

    const brierScore = this.calculateBrierScore(predictionData);
    const accuracy = this.calculateAccuracy(predictionData);
    const calibrationData = this.calculateCalibration(predictionData);

    // Calculate ROI
    const totalDeposits = user.totalDeposits || 1;
    const profit = user.profitCached?.allTime || 0;
    const roi = totalDeposits > 0 ? profit / totalDeposits : null;

    return {
      brierScore,
      predictionCount: bets.length,
      resolvedCount: resolvedBets.length,
      accuracy,
      calibrationData,
      platformRank: null, // Manifold doesn't expose global rank
      platformPercentile: null,
      totalVolumeUsd: null, // Play money
      profitLossUsd: profit, // In mana, not USD
      roi,
      importedAt: new Date().toISOString(),
      rawData: {
        user: {
          id: user.id,
          username: user.username,
          balance: user.balance,
          profitAllTime: profit,
        },
        betsCount: bets.length,
        resolvedBetsCount: resolvedBets.length,
      },
    };
  }

  /**
   * Normalize Manifold data to Brier score.
   * Manifold doesn't natively use Brier, so we calculate from bets.
   */
  normalizeToBrier(platformData: unknown): number | null {
    // Manifold doesn't expose Brier directly
    // The actual calculation is done in fetchStats
    return null;
  }

  /**
   * Check if user exists on Manifold.
   */
  async userExists(userId: string): Promise<boolean> {
    try {
      const user = await this.fetchUser(userId);
      return user !== null;
    } catch {
      return false;
    }
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  /**
   * Fetch user from Manifold API.
   */
  private async fetchUser(username: string): Promise<ManifoldUser | null> {
    const baseUrl = this.getApiBaseUrl();

    try {
      const response = await this.fetch(`${baseUrl}/user/${encodeURIComponent(username)}`);

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Manifold API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Manifold fetchUser error:', error);
      return null;
    }
  }

  /**
   * Fetch user bets from Manifold API.
   */
  private async fetchUserBets(username: string): Promise<ManifoldBet[]> {
    const baseUrl = this.getApiBaseUrl();
    const allBets: ManifoldBet[] = [];

    // Manifold API supports pagination with before parameter
    let before: string | undefined;
    const limit = 1000;
    const maxBets = 5000; // Cap to avoid excessive API calls

    while (allBets.length < maxBets) {
      let url = `${baseUrl}/bets?username=${encodeURIComponent(username)}&limit=${limit}`;
      if (before) {
        url += `&before=${before}`;
      }

      const response = await this.fetch(url);

      if (!response.ok) {
        throw new Error(`Manifold bets API error: ${response.status}`);
      }

      const bets: ManifoldBet[] = await response.json();

      if (bets.length === 0) break;

      allBets.push(...bets);

      // Get the last bet's ID for pagination
      if (bets.length < limit) break;
      before = bets[bets.length - 1].id;

      // Rate limit protection
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return allBets;
  }

  /**
   * Fetch user positions (for more accurate profit calculation).
   */
  private async fetchUserPositions(userId: string): Promise<ManifoldPosition[]> {
    const baseUrl = this.getApiBaseUrl();

    try {
      const response = await this.fetch(
        `${baseUrl}/users/${userId}/positions`
      );

      if (!response.ok) {
        return [];
      }

      return await response.json();
    } catch {
      return [];
    }
  }
}

// =============================================================================
// REGISTER CONNECTOR
// =============================================================================

const manifoldConnector = new ManifoldConnector();
registerConnector(manifoldConnector);

export default manifoldConnector;
