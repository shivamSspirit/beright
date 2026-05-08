/**
 * Base class for platform ingestors
 * All platform-specific ingestors extend this
 */

import { V3Prediction } from '../v3/types';
import axios, { AxiosInstance } from 'axios';
import pino from 'pino';

export interface IngestorConfig {
  apiKey?: string;
  apiSecret?: string;
  baseUrl: string;
  rateLimitPerMinute?: number;
}

export abstract class BaseIngestor {
  protected platform: string;
  protected config: IngestorConfig;
  protected client: AxiosInstance;
  protected logger: pino.Logger;

  constructor(platform: string, config: IngestorConfig) {
    this.platform = platform;
    this.config = config;

    this.logger = pino({
      name: `${platform}-ingestor`,
      level: process.env.LOG_LEVEL || 'info',
    });

    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: this.getDefaultHeaders(),
    });

    // Add request/response interceptors for logging and rate limiting
    this.client.interceptors.request.use(
      (config) => {
        this.logger.debug({ url: config.url, method: config.method }, 'API Request');
        return config;
      },
      (error) => {
        this.logger.error({ error }, 'API Request Error');
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug(
          { url: response.config.url, status: response.status },
          'API Response'
        );
        return response;
      },
      (error) => {
        this.logger.error(
          {
            url: error.config?.url,
            status: error.response?.status,
            data: error.response?.data,
          },
          'API Response Error'
        );
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get default HTTP headers for API requests
   */
  protected getDefaultHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'User-Agent': 'BeRight-Forecaster-Scoring-Engine/1.0',
    };
  }

  /**
   * Fetch predictions for a specific user
   */
  abstract fetchUserPredictions(userId: string): Promise<V3Prediction[]>;

  /**
   * Fetch predictions for multiple users (batch)
   */
  async fetchBatchUserPredictions(userIds: string[]): Promise<Map<string, V3Prediction[]>> {
    const results = new Map<string, V3Prediction[]>();

    for (const userId of userIds) {
      try {
        const predictions = await this.fetchUserPredictions(userId);
        results.set(userId, predictions);

        // Rate limiting: wait between requests
        if (this.config.rateLimitPerMinute) {
          const delayMs = (60 * 1000) / this.config.rateLimitPerMinute;
          await this.sleep(delayMs);
        }
      } catch (error) {
        this.logger.error({ userId, error }, 'Failed to fetch user predictions');
        results.set(userId, []);
      }
    }

    return results;
  }

  /**
   * Get top forecasters (leaderboard)
   * Useful for Phase 4 empirical validation
   */
  abstract getTopForecasters(limit: number): Promise<string[]>;

  /**
   * Sleep helper for rate limiting
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Normalize timestamp to Date object
   */
  protected normalizeTimestamp(timestamp: string | number | Date): Date {
    if (timestamp instanceof Date) {
      return timestamp;
    }
    if (typeof timestamp === 'number') {
      return new Date(timestamp * 1000);  // Assume Unix timestamp
    }
    return new Date(timestamp);
  }
}
