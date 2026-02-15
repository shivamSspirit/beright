/**
 * Prediction Service
 *
 * Core business logic for prediction management.
 * Coordinates between repositories, market providers, and blockchain adapters.
 */

import type { PredictionRepository, PredictionFilter, PredictionStats } from '../../domain/ports/repositories/PredictionRepository';
import type { UserRepository } from '../../domain/ports/repositories/UserRepository';
import type { Prediction, CreatePredictionInput, ResolvePredictionInput } from '../../domain/entities/Prediction';
import { Prediction as PredictionEntity } from '../../domain/entities/Prediction';
import type { User, UserStats } from '../../domain/entities/User';
import type { UUID } from '../../shared/types/Common';
import type { Result } from '../../shared/types/Result';
import { Result as ResultHelper } from '../../shared/types/Result';
import { AppError } from '../../shared/errors/AppError';

/**
 * Calibration report for user predictions
 */
export interface CalibrationReport {
  userId: UUID;
  totalPredictions: number;
  resolvedPredictions: number;
  averageBrierScore: number | null;
  calibrationBuckets: CalibrationBucket[];
  overconfidenceScore: number;
  underconfidenceScore: number;
  recommendations: string[];
}

export interface CalibrationBucket {
  range: string;
  predictedProbability: number;
  actualOutcomeRate: number;
  count: number;
  calibrationError: number;
}

/**
 * Prediction service input types
 */
export interface MakePredictionInput {
  userId: UUID;
  question: string;
  probability: number;
  direction: 'YES' | 'NO';
  reasoning?: string;
  platform?: string;
  marketId?: string;
  marketUrl?: string;
  resolvesAt?: Date | string;
  stakeAmount?: number;
  commitOnChain?: boolean;
}

/**
 * Prediction Service Interface
 */
export interface IPredictionService {
  makePrediction(input: MakePredictionInput): Promise<Result<Prediction, AppError>>;
  getUserPredictions(userId: UUID, filter?: PredictionFilter): Promise<Result<Prediction[], AppError>>;
  getPendingPredictions(userId?: UUID): Promise<Result<Prediction[], AppError>>;
  resolvePrediction(id: UUID, outcome: boolean): Promise<Result<Prediction, AppError>>;
  getUserStats(userId: UUID): Promise<Result<UserStats, AppError>>;
  getCalibrationReport(userId: UUID): Promise<Result<CalibrationReport, AppError>>;
  getGlobalStats(): Promise<Result<PredictionStats, AppError>>;
}

/**
 * Prediction Service Implementation
 */
export class PredictionService implements IPredictionService {
  constructor(
    private predictionRepo: PredictionRepository,
    private userRepo: UserRepository,
    private onChainAdapter?: { commitPrediction(prediction: Prediction): Promise<Result<string, AppError>> }
  ) {}

  /**
   * Make a new prediction
   */
  async makePrediction(input: MakePredictionInput): Promise<Result<Prediction, AppError>> {
    // Ensure user exists
    const userResult = await this.userRepo.findById(input.userId);
    if (userResult.ok === false) {
      return userResult;
    }

    if (!userResult.value) {
      return ResultHelper.err(AppError.notFound('User', input.userId));
    }

    // Create prediction entity
    const createResult = PredictionEntity.create({
      userId: input.userId,
      question: input.question,
      probability: input.probability,
      direction: input.direction,
      reasoning: input.reasoning,
      platform: input.platform as 'kalshi' | 'polymarket' | 'dflow' | 'manifold' | 'metaculus' | 'limitless' | undefined,
      marketId: input.marketId,
      marketUrl: input.marketUrl,
      resolvesAt: input.resolvesAt,
      stakeAmount: input.stakeAmount,
    });

    if (createResult.ok === false) {
      return ResultHelper.err(AppError.validation(createResult.error.message));
    }

    let prediction = createResult.value;

    // Commit on-chain if requested
    if (input.commitOnChain && this.onChainAdapter) {
      const txResult = await this.onChainAdapter.commitPrediction(prediction);
      if (txResult.ok) {
        prediction = prediction.setOnChainTx(txResult.value, true);
      }
      // Don't fail if on-chain commit fails, just log
    }

    // Save to database
    const saveResult = await this.predictionRepo.save(prediction);

    return saveResult;
  }

  /**
   * Get user's predictions with optional filter
   */
  async getUserPredictions(
    userId: UUID,
    filter?: PredictionFilter
  ): Promise<Result<Prediction[], AppError>> {
    return this.predictionRepo.findMany({
      ...filter,
      userId,
    });
  }

  /**
   * Get pending (unresolved) predictions
   */
  async getPendingPredictions(userId?: UUID): Promise<Result<Prediction[], AppError>> {
    return this.predictionRepo.findPending(userId);
  }

  /**
   * Resolve a prediction with outcome
   */
  async resolvePrediction(
    id: UUID,
    outcome: boolean
  ): Promise<Result<Prediction, AppError>> {
    return this.predictionRepo.resolve(id, { outcome });
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: UUID): Promise<Result<UserStats, AppError>> {
    return this.userRepo.getStats(userId);
  }

  /**
   * Get calibration report for a user
   */
  async getCalibrationReport(userId: UUID): Promise<Result<CalibrationReport, AppError>> {
    // Get resolved predictions
    const predictionsResult = await this.predictionRepo.findResolved(userId);

    if (predictionsResult.ok === false) {
      return predictionsResult;
    }

    const predictions = predictionsResult.value;

    if (predictions.length === 0) {
      return ResultHelper.ok({
        userId,
        totalPredictions: 0,
        resolvedPredictions: 0,
        averageBrierScore: null,
        calibrationBuckets: [],
        overconfidenceScore: 0,
        underconfidenceScore: 0,
        recommendations: ['Make more predictions to generate a calibration report.'],
      });
    }

    // Calculate calibration buckets (0-10%, 10-20%, etc.)
    const buckets = this.calculateCalibrationBuckets(predictions);

    // Calculate overall metrics
    const brierScores = predictions
      .filter(p => p.brierScore !== null)
      .map(p => p.brierScore!.value);

    const avgBrier = brierScores.length > 0
      ? brierScores.reduce((a, b) => a + b, 0) / brierScores.length
      : null;

    // Calculate over/underconfidence
    const { overconfidence, underconfidence } = this.calculateConfidenceBias(buckets);

    // Generate recommendations
    const recommendations = this.generateRecommendations(buckets, avgBrier, predictions.length);

    return ResultHelper.ok({
      userId,
      totalPredictions: predictions.length,
      resolvedPredictions: predictions.length,
      averageBrierScore: avgBrier,
      calibrationBuckets: buckets,
      overconfidenceScore: overconfidence,
      underconfidenceScore: underconfidence,
      recommendations,
    });
  }

  /**
   * Get global prediction statistics
   */
  async getGlobalStats(): Promise<Result<PredictionStats, AppError>> {
    return this.predictionRepo.getGlobalStats();
  }

  /**
   * Calculate calibration buckets from predictions
   */
  private calculateCalibrationBuckets(predictions: Prediction[]): CalibrationBucket[] {
    const buckets: Map<string, { predicted: number[]; outcomes: boolean[] }> = new Map();

    // Initialize buckets
    for (let i = 0; i < 10; i++) {
      const range = `${i * 10}-${(i + 1) * 10}%`;
      buckets.set(range, { predicted: [], outcomes: [] });
    }

    // Populate buckets
    for (const pred of predictions) {
      if (pred.outcome === null) continue;

      // Get effective probability (what we predicted for YES)
      const effectiveProb = pred.direction === 'YES'
        ? pred.probability.value
        : 1 - pred.probability.value;

      const bucketIndex = Math.min(Math.floor(effectiveProb * 10), 9);
      const range = `${bucketIndex * 10}-${(bucketIndex + 1) * 10}%`;

      const bucket = buckets.get(range);
      if (bucket) {
        bucket.predicted.push(effectiveProb);
        bucket.outcomes.push(pred.outcome);
      }
    }

    // Calculate bucket statistics
    return Array.from(buckets.entries()).map(([range, data]) => {
      const count = data.predicted.length;

      if (count === 0) {
        return {
          range,
          predictedProbability: 0,
          actualOutcomeRate: 0,
          count: 0,
          calibrationError: 0,
        };
      }

      const avgPredicted = data.predicted.reduce((a, b) => a + b, 0) / count;
      const actualRate = data.outcomes.filter(o => o).length / count;

      return {
        range,
        predictedProbability: avgPredicted,
        actualOutcomeRate: actualRate,
        count,
        calibrationError: Math.abs(avgPredicted - actualRate),
      };
    });
  }

  /**
   * Calculate over/underconfidence scores
   */
  private calculateConfidenceBias(buckets: CalibrationBucket[]): {
    overconfidence: number;
    underconfidence: number;
  } {
    let overconfidence = 0;
    let underconfidence = 0;
    let totalCount = 0;

    for (const bucket of buckets) {
      if (bucket.count === 0) continue;

      const error = bucket.predictedProbability - bucket.actualOutcomeRate;
      const weightedError = error * bucket.count;

      if (error > 0) {
        overconfidence += weightedError;
      } else {
        underconfidence += Math.abs(weightedError);
      }

      totalCount += bucket.count;
    }

    if (totalCount === 0) {
      return { overconfidence: 0, underconfidence: 0 };
    }

    return {
      overconfidence: overconfidence / totalCount,
      underconfidence: underconfidence / totalCount,
    };
  }

  /**
   * Generate calibration recommendations
   */
  private generateRecommendations(
    buckets: CalibrationBucket[],
    avgBrier: number | null,
    totalPredictions: number
  ): string[] {
    const recommendations: string[] = [];

    if (totalPredictions < 20) {
      recommendations.push('Make at least 20 predictions for more reliable calibration analysis.');
      return recommendations;
    }

    // Check for overconfidence in high-probability predictions
    const highConfBuckets = buckets.filter(b => b.range.startsWith('8') || b.range.startsWith('9'));
    const avgHighConfError = highConfBuckets
      .filter(b => b.count > 0)
      .reduce((sum, b) => sum + b.calibrationError, 0) / Math.max(highConfBuckets.filter(b => b.count > 0).length, 1);

    if (avgHighConfError > 0.15) {
      recommendations.push('Consider being less confident in high-probability predictions (80%+).');
    }

    // Check for underconfidence
    const lowConfBuckets = buckets.filter(b => b.range.startsWith('4') || b.range.startsWith('5'));
    const avgLowConfError = lowConfBuckets
      .filter(b => b.count > 0)
      .reduce((sum, b) => sum + b.calibrationError, 0) / Math.max(lowConfBuckets.filter(b => b.count > 0).length, 1);

    if (avgLowConfError > 0.15) {
      recommendations.push('Your "uncertain" predictions (40-60%) might need more decisive positioning.');
    }

    // Brier score recommendations
    if (avgBrier !== null) {
      if (avgBrier <= 0.1) {
        recommendations.push('Excellent calibration. Keep up the great work.');
      } else if (avgBrier <= 0.15) {
        recommendations.push('Good calibration. Focus on improving high-confidence predictions.');
      } else if (avgBrier <= 0.22) {
        recommendations.push('Average calibration. Try to identify systematic biases in your predictions.');
      } else {
        recommendations.push('Your predictions need improvement. Consider studying base rates more carefully.');
      }
    }

    return recommendations.length > 0 ? recommendations : ['Keep making predictions to improve calibration.'];
  }
}

export default PredictionService;
