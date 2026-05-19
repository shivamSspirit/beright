/**
 * Metaculus Ingestor
 *
 * Fetches forecasting data from Metaculus API
 * API Docs: https://www.metaculus.com/api2/
 */

import { BaseIngestor, IngestorConfig } from './base';
import { V3Prediction } from '../v3/types';
import { v4 as uuidv4 } from 'uuid';

interface MetaculusQuestion {
  id: number;
  title: string;
  url: string;
  created_time: string;
  publish_time: string;
  close_time: string;
  resolve_time: string | null;
  resolution: number | null;  // -1 = NO, 1 = YES, null = unresolved
  possibilities: {
    type: string;
    low?: number;
    high?: number;
  };
  community_prediction: {
    q2: number;  // 50th percentile (median)
    q1: number;  // 25th percentile
    q3: number;  // 75th percentile
  };
}

interface MetaculusPrediction {
  question: number;
  user: number;
  t: string;  // Timestamp
  x: number;  // Predicted value (0-1 for binary)
}

interface MetaculusUser {
  id: number;
  username: string;
  score: number;
  num_predictions: number;
  num_questions_predicted: number;
}

export class MetaculusIngestor extends BaseIngestor {
  constructor(config?: Partial<IngestorConfig>) {
    super('metaculus', {
      baseUrl: 'https://www.metaculus.com/api2',
      rateLimitPerMinute: 30,  // Conservative rate limit
      ...config,
    });
  }

  protected getDefaultHeaders(): Record<string, string> {
    const headers = super.getDefaultHeaders();

    if (this.config.apiKey) {
      headers['Authorization'] = `Token ${this.config.apiKey}`;
    }

    return headers;
  }

  /**
   * Fetch predictions for a Metaculus user
   */
  async fetchUserPredictions(username: string): Promise<V3Prediction[]> {
    try {
      // First, get user ID from username
      const user = await this.fetchUser(username);
      if (!user) {
        this.logger.warn({ username }, 'User not found');
        return [];
      }

      // Fetch user's predictions
      const predictions = await this.fetchUserPredictionHistory(user.id);

      // Fetch question details for all predictions
      const questionIds = [...new Set(predictions.map(p => p.question))];
      const questions = await this.fetchQuestions(questionIds);
      const questionMap = new Map(questions.map(q => [q.id, q]));

      // Convert to Prediction format
      const convertedPredictions: V3Prediction[] = [];

      for (const pred of predictions) {
        const question = questionMap.get(pred.question);
        if (!question) continue;

        // Only handle binary questions for now
        if (question.possibilities.type !== 'binary') continue;

        const isResolved = question.resolution !== null;
        const outcome = isResolved
          ? question.resolution === 1  // 1 = YES, -1 = NO
          : undefined;

        // Calculate community spread (difficulty metric)
        const communitySpread = question.community_prediction
          ? (question.community_prediction.q3 - question.community_prediction.q1)
          : 0.5;

        const prediction: V3Prediction = {
          id: uuidv4(),
          forecasterId: username,
          source: 'imported',
          platform: 'metaculus',
          marketId: question.id.toString(),
          marketTitle: question.title,
          predictedProbability: pred.x,
          direction: pred.x >= 0.5 ? 'YES' : 'NO',

          // Outcome
          outcome,
          resolvedAt: question.resolve_time
            ? this.normalizeTimestamp(question.resolve_time)
            : undefined,

          // Timing
          predictedAt: this.normalizeTimestamp(pred.t),
          marketOpenTime: this.normalizeTimestamp(question.publish_time),
          marketCloseTime: this.normalizeTimestamp(question.close_time),

          // Context
          communityMedian: question.community_prediction?.q2,
          communitySpread,
          difficulty: communitySpread,  // Higher spread = harder question
          category: 'imported:metaculus',
          resolutionEvidence: isResolved ? {
            source: 'metaculus-api',
            finality: 'venue_final',
            confidence: 0.9,
            observedAt: new Date(),
            referenceUrl: question.url,
          } : undefined,
        };

        convertedPredictions.push(prediction);
      }

      this.logger.info(
        { username, count: convertedPredictions.length },
        'Fetched Metaculus predictions'
      );

      return convertedPredictions;
    } catch (error) {
      this.logger.error({ username, error }, 'Failed to fetch Metaculus predictions');
      throw error;
    }
  }

  /**
   * Get top forecasters from leaderboard
   */
  async getTopForecasters(limit: number = 100): Promise<string[]> {
    try {
      const response = await this.client.get('/leaderboard/', {
        params: {
          limit,
          type: 'global',  // Global leaderboard
        },
      });

      const users: MetaculusUser[] = response.data.results || response.data;
      return users.map(u => u.username);
    } catch (error) {
      this.logger.error({ error }, 'Failed to fetch Metaculus leaderboard');

      // Fallback: return sample usernames
      this.logger.warn('Using fallback sample usernames');
      return this.getSampleTopForecasters(limit);
    }
  }

  /**
   * Fetch user by username
   */
  private async fetchUser(username: string): Promise<MetaculusUser | null> {
    try {
      const response = await this.client.get(`/users/`, {
        params: {
          search: username,
        },
      });

      const users: MetaculusUser[] = response.data.results || response.data;
      return users.find(u => u.username === username) || null;
    } catch (error) {
      this.logger.error({ username, error }, 'Failed to fetch user');
      return null;
    }
  }

  /**
   * Fetch user's prediction history
   */
  private async fetchUserPredictionHistory(userId: number): Promise<MetaculusPrediction[]> {
    try {
      const allPredictions: MetaculusPrediction[] = [];
      let page = 1;
      const pageSize = 100;

      while (true) {
        const response = await this.client.get(`/predictions/`, {
          params: {
            user: userId,
            page,
            page_size: pageSize,
          },
        });

        const predictions: MetaculusPrediction[] = response.data.results || response.data;
        allPredictions.push(...predictions);

        // Check if there are more pages
        if (predictions.length < pageSize) break;

        page++;

        // Rate limiting
        await this.sleep(1000);
      }

      return allPredictions;
    } catch (error) {
      this.logger.error({ userId, error }, 'Failed to fetch prediction history');
      return [];
    }
  }

  /**
   * Fetch question details for multiple questions
   */
  private async fetchQuestions(questionIds: number[]): Promise<MetaculusQuestion[]> {
    const questions: MetaculusQuestion[] = [];

    // Batch requests
    const batchSize = 10;
    for (let i = 0; i < questionIds.length; i += batchSize) {
      const batch = questionIds.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (questionId) => {
          try {
            const response = await this.client.get(`/questions/${questionId}/`);
            questions.push(response.data);
          } catch (error) {
            this.logger.warn({ questionId }, 'Failed to fetch question');
          }
        })
      );

      // Rate limiting
      await this.sleep(1000);
    }

    return questions;
  }

  /**
   * Sample top forecasters (fallback for testing)
   */
  private getSampleTopForecasters(limit: number): string[] {
    const sampleUsers = [
      'Sylvain',
      'Charles',
      'SimonM',
      'PeterHurford',
      'Jgalt',
    ];

    return sampleUsers.slice(0, Math.min(limit, sampleUsers.length));
  }
}
