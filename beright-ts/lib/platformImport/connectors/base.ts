/**
 * Base Platform Connector
 *
 * Abstract base class for platform connectors. Provides common functionality
 * for fetching data, rate limiting, and error handling.
 */

import { PLATFORM_REGISTRY } from '../registry';
import type {
  ExternalPlatform,
  PlatformConnector,
  ImportedStats,
  OwnershipProof,
  VerificationResult,
  CalibrationBucket,
} from '../types';

// =============================================================================
// RATE LIMITER
// =============================================================================

interface RateLimitState {
  tokens: number;
  lastRefill: number;
  maxTokens: number;
  refillRatePerMs: number;
}

const rateLimiters: Map<ExternalPlatform, RateLimitState> = new Map();

function getRateLimiter(platform: ExternalPlatform): RateLimitState {
  if (!rateLimiters.has(platform)) {
    const config = PLATFORM_REGISTRY[platform];
    const rpm = config.rateLimitPerMinute || 60;
    rateLimiters.set(platform, {
      tokens: rpm,
      lastRefill: Date.now(),
      maxTokens: rpm,
      refillRatePerMs: rpm / 60000, // tokens per ms
    });
  }
  return rateLimiters.get(platform)!;
}

function consumeToken(platform: ExternalPlatform): boolean {
  const state = getRateLimiter(platform);
  const now = Date.now();
  const elapsed = now - state.lastRefill;

  // Refill tokens
  state.tokens = Math.min(
    state.maxTokens,
    state.tokens + elapsed * state.refillRatePerMs
  );
  state.lastRefill = now;

  // Try to consume a token
  if (state.tokens >= 1) {
    state.tokens -= 1;
    return true;
  }

  return false;
}

async function waitForToken(platform: ExternalPlatform): Promise<void> {
  while (!consumeToken(platform)) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// =============================================================================
// BASE CONNECTOR
// =============================================================================

export abstract class BasePlatformConnector implements PlatformConnector {
  abstract platform: ExternalPlatform;

  /**
   * Verify user owns this account.
   * Must be implemented by each connector.
   */
  abstract verifyOwnership(
    userId: string,
    proof: OwnershipProof
  ): Promise<VerificationResult>;

  /**
   * Fetch forecaster stats from platform.
   * Must be implemented by each connector.
   */
  abstract fetchStats(userId: string): Promise<ImportedStats>;

  /**
   * Normalize platform-specific score to Brier (0-1).
   * Must be implemented by each connector.
   */
  abstract normalizeToBrier(platformData: unknown): number | null;

  /**
   * Check if user exists on platform.
   * Must be implemented by each connector.
   */
  abstract userExists(userId: string): Promise<boolean>;

  // =============================================================================
  // SHARED UTILITIES
  // =============================================================================

  /**
   * Get platform configuration from registry.
   */
  protected getConfig() {
    return PLATFORM_REGISTRY[this.platform];
  }

  /**
   * Make a rate-limited fetch request.
   */
  protected async fetch(
    url: string,
    options?: RequestInit
  ): Promise<Response> {
    await waitForToken(this.platform);

    const response = await fetch(url, {
      ...options,
      headers: {
        'User-Agent': 'BeRight/1.0',
        'Accept': 'application/json',
        ...options?.headers,
      },
    });

    return response;
  }

  /**
   * Make a rate-limited JSON request.
   */
  protected async fetchJson<T>(
    url: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await this.fetch(url, options);

    if (!response.ok) {
      throw new Error(`${this.platform} API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Calculate Brier score from resolved predictions.
   */
  protected calculateBrierScore(
    predictions: Array<{ predicted: number; actual: number }>
  ): number | null {
    if (predictions.length === 0) return null;

    let brierSum = 0;
    for (const pred of predictions) {
      brierSum += Math.pow(pred.predicted - pred.actual, 2);
    }

    return brierSum / predictions.length;
  }

  /**
   * Calculate accuracy (% correct) from resolved predictions.
   */
  protected calculateAccuracy(
    predictions: Array<{ predicted: number; actual: number }>
  ): number | null {
    if (predictions.length === 0) return null;

    const correct = predictions.filter((p) => {
      const predictedYes = p.predicted > 0.5;
      const actualYes = p.actual === 1;
      return predictedYes === actualYes;
    }).length;

    return correct / predictions.length;
  }

  /**
   * Calculate calibration buckets from predictions.
   * Groups predictions into 10 buckets (0-10%, 10-20%, etc.)
   */
  protected calculateCalibration(
    predictions: Array<{ predicted: number; actual: number }>
  ): CalibrationBucket[] {
    const buckets: Map<number, { sum: number; count: number }> = new Map();

    // Initialize 10 buckets
    for (let i = 0.05; i < 1; i += 0.1) {
      buckets.set(Math.round(i * 100) / 100, { sum: 0, count: 0 });
    }

    // Populate buckets
    for (const pred of predictions) {
      // Find the bucket center (0.05, 0.15, 0.25, etc.)
      const bucketIndex = Math.floor(pred.predicted * 10);
      const bucketKey = Math.min(bucketIndex, 9) * 0.1 + 0.05;
      const roundedKey = Math.round(bucketKey * 100) / 100;

      const bucket = buckets.get(roundedKey);
      if (bucket) {
        bucket.sum += pred.actual;
        bucket.count += 1;
      }
    }

    // Convert to array
    return Array.from(buckets.entries())
      .map(([predicted, { sum, count }]) => ({
        predictedProbability: predicted,
        actualFrequency: count > 0 ? sum / count : 0,
        count,
      }))
      .filter((b) => b.count > 0);
  }

  /**
   * Create empty ImportedStats with default values.
   */
  protected createEmptyStats(): ImportedStats {
    return {
      brierScore: null,
      predictionCount: 0,
      resolvedCount: 0,
      accuracy: null,
      calibrationData: null,
      platformRank: null,
      platformPercentile: null,
      totalVolumeUsd: null,
      profitLossUsd: null,
      roi: null,
      importedAt: new Date().toISOString(),
      rawData: {},
    };
  }

  /**
   * Get API base URL from registry.
   */
  protected getApiBaseUrl(): string {
    const url = this.getConfig().apiBaseUrl;
    if (!url) {
      throw new Error(`${this.platform} does not have an API`);
    }
    return url;
  }

  /**
   * Build profile URL for user.
   */
  protected getProfileUrl(userId: string): string {
    return this.getConfig().profileUrlTemplate.replace('{userId}', userId);
  }
}

// =============================================================================
// CONNECTOR REGISTRY
// =============================================================================

const connectorRegistry: Map<ExternalPlatform, PlatformConnector> = new Map();

/**
 * Register a connector for a platform.
 */
export function registerConnector(connector: PlatformConnector): void {
  connectorRegistry.set(connector.platform, connector);
}

/**
 * Get a connector for a platform.
 */
export function getConnector(platform: ExternalPlatform): PlatformConnector | undefined {
  return connectorRegistry.get(platform);
}

/**
 * Get all registered connectors.
 */
export function getAllConnectors(): PlatformConnector[] {
  return Array.from(connectorRegistry.values());
}

/**
 * Check if a connector is available for a platform.
 */
export function hasConnector(platform: ExternalPlatform): boolean {
  return connectorRegistry.has(platform);
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  BasePlatformConnector,
  registerConnector,
  getConnector,
  getAllConnectors,
  hasConnector,
};
