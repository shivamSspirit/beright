/**
 * PredictionRepository Interface
 *
 * Port for prediction persistence operations.
 * Implemented by adapters (Supabase, File, etc.)
 */

import type { UUID } from '../../../shared/types/Common';
import type { AsyncResult } from '../../../shared/types/Result';
import type { Prediction, CreatePredictionInput, ResolvePredictionInput } from '../../entities/Prediction';
import type { AppError } from '../../../shared/errors/AppError';

/**
 * Filter options for querying predictions
 */
export interface PredictionFilter {
  userId?: UUID;
  resolved?: boolean;
  platform?: string;
  marketId?: string;
  direction?: 'YES' | 'NO';
  minProbability?: number;
  maxProbability?: number;
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * Pagination options
 */
export interface PredictionPagination {
  limit?: number;
  offset?: number;
  orderBy?: 'created_at' | 'resolved_at' | 'brier_score';
  orderDirection?: 'asc' | 'desc';
}

/**
 * Prediction statistics
 */
export interface PredictionStats {
  total: number;
  resolved: number;
  pending: number;
  correct: number;
  accuracy: number;
  averageBrierScore: number | null;
  byPlatform: Record<string, number>;
  byConfidence: Record<string, number>;
}

/**
 * PredictionRepository Port
 */
export interface PredictionRepository {
  /**
   * Save a new prediction
   */
  save(prediction: Prediction): AsyncResult<Prediction, AppError>;

  /**
   * Find prediction by ID
   */
  findById(id: UUID): AsyncResult<Prediction | null, AppError>;

  /**
   * Find predictions by user ID
   */
  findByUserId(
    userId: UUID,
    pagination?: PredictionPagination
  ): AsyncResult<Prediction[], AppError>;

  /**
   * Find predictions with filters
   */
  findMany(
    filter: PredictionFilter,
    pagination?: PredictionPagination
  ): AsyncResult<Prediction[], AppError>;

  /**
   * Find pending predictions (not resolved)
   */
  findPending(userId?: UUID): AsyncResult<Prediction[], AppError>;

  /**
   * Find resolved predictions
   */
  findResolved(
    userId?: UUID,
    pagination?: PredictionPagination
  ): AsyncResult<Prediction[], AppError>;

  /**
   * Find predictions by market ID
   */
  findByMarketId(marketId: string): AsyncResult<Prediction[], AppError>;

  /**
   * Update prediction (for resolution, on-chain tx, etc.)
   */
  update(prediction: Prediction): AsyncResult<Prediction, AppError>;

  /**
   * Resolve a prediction
   */
  resolve(
    id: UUID,
    input: ResolvePredictionInput
  ): AsyncResult<Prediction, AppError>;

  /**
   * Add on-chain transaction to prediction
   */
  addOnChainTx(
    id: UUID,
    txSignature: string,
    confirmed?: boolean
  ): AsyncResult<Prediction, AppError>;

  /**
   * Delete a prediction (soft delete preferred)
   */
  delete(id: UUID): AsyncResult<void, AppError>;

  /**
   * Get prediction statistics for a user
   */
  getStats(userId: UUID): AsyncResult<PredictionStats, AppError>;

  /**
   * Get all stats (global)
   */
  getGlobalStats(): AsyncResult<PredictionStats, AppError>;

  /**
   * Count predictions matching filter
   */
  count(filter: PredictionFilter): AsyncResult<number, AppError>;
}

export default PredictionRepository;
