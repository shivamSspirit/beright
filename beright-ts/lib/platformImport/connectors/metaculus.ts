/**
 * Metaculus Connector
 *
 * Fetches forecaster stats from Metaculus (Tier 1, academic-backed).
 * Uses Metaculus public API for user data and predictions.
 *
 * API Docs: https://www.metaculus.com/api2/
 */

import { BasePlatformConnector, registerConnector } from './base';
import { verifyProfileCode } from '../verification';
import type {
  ExternalPlatform,
  ImportedStats,
  OwnershipProof,
  VerificationResult,
  CalibrationBucket,
} from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface MetaculusUser {
  id: number;
  username: string;
  bio?: string;
  date_joined: string;

  // Forecasting stats
  points: number;
  level_title?: string;
  ranking?: number;
  medals_count?: number;

  // Prediction stats (may be in different locations depending on API version)
  predictions_count?: number;
  questions_authored_count?: number;
  comments_count?: number;
}

interface MetaculusUserProfile {
  id: number;
  username: string;
  bio?: string;
  calibration_curve?: number[][];

  // Extended stats
  total_predictions?: number;
  resolved_predictions?: number;
  brier_score?: number;
  accuracy?: number;
  percentile?: number;
  rank?: number;
}

interface MetaculusPrediction {
  id: number;
  question_id: number;
  question_title: string;
  prediction_value: number;    // 0-1 probability
  created_at: string;
  resolved?: boolean;
  resolution_value?: number;   // 0 or 1
}

// =============================================================================
// CONNECTOR
// =============================================================================

export class MetaculusConnector extends BasePlatformConnector {
  platform: ExternalPlatform = 'metaculus';

  private get apiToken(): string | undefined {
    return process.env.METACULUS_API_TOKEN;
  }

  /**
   * Verify ownership via profile code in bio.
   */
  async verifyOwnership(
    userId: string,
    proof: OwnershipProof
  ): Promise<VerificationResult> {
    if (proof.type !== 'profile_code') {
      return { verified: false, error: 'Metaculus requires profile code verification' };
    }

    if (!proof.data.code) {
      return { verified: false, error: 'Missing verification code' };
    }

    // Fetch user profile to check bio
    const fetchBio = async (): Promise<string | null> => {
      const profile = await this.fetchUserProfile(userId);
      return profile?.bio || null;
    };

    return verifyProfileCode(this.platform, userId, proof.data.code, fetchBio);
  }

  /**
   * Fetch forecaster stats from Metaculus.
   */
  async fetchStats(userId: string): Promise<ImportedStats> {
    const profile = await this.fetchUserProfile(userId);

    if (!profile) {
      throw new Error(`User "${userId}" not found on Metaculus`);
    }

    // Try to get detailed predictions for Brier calculation
    let predictions: MetaculusPrediction[] = [];
    try {
      predictions = await this.fetchUserPredictions(profile.id);
    } catch (error) {
      console.warn(`Could not fetch Metaculus predictions for ${userId}:`, error);
    }

    // Calculate stats from predictions
    const resolvedPredictions = predictions.filter((p) => p.resolved && p.resolution_value !== undefined);

    const predictionData = resolvedPredictions.map((p) => ({
      predicted: p.prediction_value,
      actual: p.resolution_value!,
    }));

    const brierScore = profile.brier_score ?? this.calculateBrierScore(predictionData);
    const accuracy = profile.accuracy ?? this.calculateAccuracy(predictionData);
    const calibrationData = profile.calibration_curve
      ? this.parseCalibrationCurve(profile.calibration_curve)
      : this.calculateCalibration(predictionData);

    return {
      brierScore,
      predictionCount: profile.total_predictions ?? predictions.length,
      resolvedCount: profile.resolved_predictions ?? resolvedPredictions.length,
      accuracy,
      calibrationData,
      platformRank: profile.rank ?? null,
      platformPercentile: profile.percentile ?? null,
      totalVolumeUsd: null, // Not a real-money platform
      profitLossUsd: null,
      roi: null,
      importedAt: new Date().toISOString(),
      rawData: { profile, predictionsCount: predictions.length },
    };
  }

  /**
   * Normalize Metaculus data to Brier score.
   * Metaculus already uses Brier scoring natively.
   */
  normalizeToBrier(platformData: unknown): number | null {
    if (typeof platformData === 'object' && platformData !== null) {
      const data = platformData as { brier_score?: number };
      if (typeof data.brier_score === 'number') {
        return data.brier_score;
      }
    }
    return null;
  }

  /**
   * Check if user exists on Metaculus.
   */
  async userExists(userId: string): Promise<boolean> {
    try {
      const profile = await this.fetchUserProfile(userId);
      return profile !== null;
    } catch {
      return false;
    }
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  /**
   * Fetch user profile from Metaculus API.
   */
  private async fetchUserProfile(username: string): Promise<MetaculusUserProfile | null> {
    const baseUrl = this.getApiBaseUrl();

    // Try to fetch by username
    // Metaculus API v2 supports fetching by username
    try {
      const headers: Record<string, string> = {};
      if (this.apiToken) {
        headers['Authorization'] = `Token ${this.apiToken}`;
      }

      // First, search for user by username
      const searchResponse = await this.fetch(
        `${baseUrl}/users/?search=${encodeURIComponent(username)}`,
        { headers }
      );

      if (!searchResponse.ok) {
        if (searchResponse.status === 404) return null;
        throw new Error(`Metaculus API error: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();
      const users = searchData.results || searchData;

      // Find exact username match (case-insensitive)
      const user = Array.isArray(users)
        ? users.find(
            (u: MetaculusUser) =>
              u.username.toLowerCase() === username.toLowerCase()
          )
        : null;

      if (!user) return null;

      // Fetch detailed profile
      const profileResponse = await this.fetch(
        `${baseUrl}/users/${user.id}/`,
        { headers }
      );

      if (!profileResponse.ok) {
        return user as MetaculusUserProfile;
      }

      const profile = await profileResponse.json();
      return profile as MetaculusUserProfile;
    } catch (error) {
      console.error('Metaculus fetchUserProfile error:', error);
      return null;
    }
  }

  /**
   * Fetch user predictions from Metaculus API.
   */
  private async fetchUserPredictions(userId: number): Promise<MetaculusPrediction[]> {
    const baseUrl = this.getApiBaseUrl();
    const predictions: MetaculusPrediction[] = [];

    const headers: Record<string, string> = {};
    if (this.apiToken) {
      headers['Authorization'] = `Token ${this.apiToken}`;
    }

    // Fetch predictions with pagination
    let nextUrl: string | null = `${baseUrl}/predictions/?user=${userId}&limit=100`;

    while (nextUrl && predictions.length < 1000) {
      const response = await this.fetch(nextUrl, { headers });

      if (!response.ok) {
        throw new Error(`Metaculus predictions API error: ${response.status}`);
      }

      const data = await response.json();
      const results = data.results || data;

      if (Array.isArray(results)) {
        predictions.push(...results);
      }

      // Get next page URL
      nextUrl = data.next || null;

      // Rate limit protection
      if (nextUrl) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return predictions;
  }

  /**
   * Parse Metaculus calibration curve to our format.
   */
  private parseCalibrationCurve(curve: number[][]): CalibrationBucket[] {
    if (!curve || !Array.isArray(curve)) return [];

    return curve
      .filter((row) => Array.isArray(row) && row.length >= 3)
      .map(([predicted, actual, count]) => ({
        predictedProbability: predicted,
        actualFrequency: actual,
        count: Math.round(count),
      }));
  }
}

// =============================================================================
// REGISTER CONNECTOR
// =============================================================================

const metaculusConnector = new MetaculusConnector();
registerConnector(metaculusConnector);

export default metaculusConnector;
