/**
 * Supabase Prediction Repository
 *
 * Implements PredictionRepository interface using Supabase as persistence layer.
 * Wraps the existing db.predictions helper functions with Result type handling.
 */

import { supabaseAdmin, isSupabaseConfigured } from '../../../../../lib/supabase/client';
import type {
  PredictionRepository,
  PredictionFilter,
  PredictionPagination,
  PredictionStats,
} from '../../../../domain/ports/repositories/PredictionRepository';
import type { Prediction, ResolvePredictionInput } from '../../../../domain/entities/Prediction';
import { Prediction as PredictionEntity } from '../../../../domain/entities/Prediction';
import type { UUID } from '../../../../shared/types/Common';
import type { Result } from '../../../../shared/types/Result';
import { Result as ResultHelper } from '../../../../shared/types/Result';
import { AppError } from '../../../../shared/errors/AppError';

/**
 * Supabase Prediction Repository Implementation
 */
export class SupabasePredictionRepository implements PredictionRepository {
  /**
   * Save a new prediction
   */
  async save(prediction: Prediction): Promise<Result<Prediction, AppError>> {
    if (!isSupabaseConfigured) {
      return ResultHelper.err(AppError.service('Supabase not configured'));
    }

    try {
      const record = prediction.toRecord();
      const { data, error } = await supabaseAdmin
        .from('predictions')
        .insert(record)
        .select()
        .single();

      if (error) {
        return ResultHelper.err(AppError.database(error.message));
      }

      const result = PredictionEntity.fromRecord(data);
      if (result.ok === false) {
        return ResultHelper.err(AppError.internal(`Failed to parse saved prediction: ${result.error.message}`));
      }

      return ResultHelper.ok(result.value);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error saving prediction'
      ));
    }
  }

  /**
   * Find prediction by ID
   */
  async findById(id: UUID): Promise<Result<Prediction | null, AppError>> {
    if (!isSupabaseConfigured) {
      return ResultHelper.err(AppError.service('Supabase not configured'));
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('predictions')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return ResultHelper.ok(null);
        }
        return ResultHelper.err(AppError.database(error.message));
      }

      if (!data) {
        return ResultHelper.ok(null);
      }

      const result = PredictionEntity.fromRecord(data);
      if (result.ok === false) {
        return ResultHelper.err(AppError.internal(`Failed to parse prediction: ${result.error.message}`));
      }

      return ResultHelper.ok(result.value);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error finding prediction'
      ));
    }
  }

  /**
   * Find predictions by user ID
   */
  async findByUserId(
    userId: UUID,
    pagination?: PredictionPagination
  ): Promise<Result<Prediction[], AppError>> {
    return this.findMany({ userId }, pagination);
  }

  /**
   * Find predictions with filters
   */
  async findMany(
    filter: PredictionFilter,
    pagination?: PredictionPagination
  ): Promise<Result<Prediction[], AppError>> {
    if (!isSupabaseConfigured) {
      return ResultHelper.err(AppError.service('Supabase not configured'));
    }

    try {
      let query = supabaseAdmin.from('predictions').select('*');

      // Apply filters
      if (filter.userId) {
        query = query.eq('user_id', filter.userId);
      }
      if (filter.resolved !== undefined) {
        if (filter.resolved) {
          query = query.not('resolved_at', 'is', null);
        } else {
          query = query.is('resolved_at', null);
        }
      }
      if (filter.platform) {
        query = query.eq('platform', filter.platform);
      }
      if (filter.marketId) {
        query = query.eq('market_id', filter.marketId);
      }
      if (filter.direction) {
        query = query.eq('direction', filter.direction);
      }
      if (filter.minProbability !== undefined) {
        query = query.gte('predicted_probability', filter.minProbability);
      }
      if (filter.maxProbability !== undefined) {
        query = query.lte('predicted_probability', filter.maxProbability);
      }
      if (filter.createdAfter) {
        query = query.gte('created_at', filter.createdAfter.toISOString());
      }
      if (filter.createdBefore) {
        query = query.lte('created_at', filter.createdBefore.toISOString());
      }

      // Apply pagination
      const orderBy = pagination?.orderBy || 'created_at';
      const orderDirection = pagination?.orderDirection || 'desc';
      query = query.order(orderBy, { ascending: orderDirection === 'asc' });

      if (pagination?.limit) {
        query = query.limit(pagination.limit);
      }
      if (pagination?.offset) {
        query = query.range(
          pagination.offset,
          pagination.offset + (pagination.limit || 50) - 1
        );
      }

      const { data, error } = await query;

      if (error) {
        return ResultHelper.err(AppError.database(error.message));
      }

      const predictions: Prediction[] = [];
      for (const record of data || []) {
        const result = PredictionEntity.fromRecord(record);
        if (result.ok) {
          predictions.push(result.value);
        }
      }

      return ResultHelper.ok(predictions);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error finding predictions'
      ));
    }
  }

  /**
   * Find pending predictions (not resolved)
   */
  async findPending(userId?: UUID): Promise<Result<Prediction[], AppError>> {
    const filter: PredictionFilter = { resolved: false };
    if (userId) {
      filter.userId = userId;
    }
    return this.findMany(filter);
  }

  /**
   * Find resolved predictions
   */
  async findResolved(
    userId?: UUID,
    pagination?: PredictionPagination
  ): Promise<Result<Prediction[], AppError>> {
    const filter: PredictionFilter = { resolved: true };
    if (userId) {
      filter.userId = userId;
    }
    return this.findMany(filter, pagination);
  }

  /**
   * Find predictions by market ID
   */
  async findByMarketId(marketId: string): Promise<Result<Prediction[], AppError>> {
    return this.findMany({ marketId });
  }

  /**
   * Update prediction (for resolution, on-chain tx, etc.)
   */
  async update(prediction: Prediction): Promise<Result<Prediction, AppError>> {
    if (!isSupabaseConfigured) {
      return ResultHelper.err(AppError.service('Supabase not configured'));
    }

    try {
      const record = prediction.toRecord();
      const { data, error } = await supabaseAdmin
        .from('predictions')
        .update(record)
        .eq('id', prediction.id)
        .select()
        .single();

      if (error) {
        return ResultHelper.err(AppError.database(error.message));
      }

      const result = PredictionEntity.fromRecord(data);
      if (result.ok === false) {
        return ResultHelper.err(AppError.internal(`Failed to parse updated prediction: ${result.error.message}`));
      }

      return ResultHelper.ok(result.value);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error updating prediction'
      ));
    }
  }

  /**
   * Resolve a prediction
   */
  async resolve(
    id: UUID,
    input: ResolvePredictionInput
  ): Promise<Result<Prediction, AppError>> {
    if (!isSupabaseConfigured) {
      return ResultHelper.err(AppError.service('Supabase not configured'));
    }

    try {
      // First get the prediction
      const findResult = await this.findById(id);
      if (findResult.ok === false) {
        return findResult;
      }

      const prediction = findResult.value;
      if (!prediction) {
        return ResultHelper.err(AppError.notFound(`Prediction not found: ${id}`));
      }

      // Resolve using domain entity method
      const resolveResult = prediction.resolve(input);
      if (resolveResult.ok === false) {
        return ResultHelper.err(AppError.validation(resolveResult.error.message));
      }

      // Save the resolved prediction
      return this.update(resolveResult.value);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error resolving prediction'
      ));
    }
  }

  /**
   * Add on-chain transaction to prediction
   */
  async addOnChainTx(
    id: UUID,
    txSignature: string,
    confirmed = false
  ): Promise<Result<Prediction, AppError>> {
    if (!isSupabaseConfigured) {
      return ResultHelper.err(AppError.service('Supabase not configured'));
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('predictions')
        .update({
          on_chain_tx: txSignature,
          on_chain_confirmed: confirmed,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return ResultHelper.err(AppError.database(error.message));
      }

      const result = PredictionEntity.fromRecord(data);
      if (result.ok === false) {
        return ResultHelper.err(AppError.internal(`Failed to parse prediction: ${result.error.message}`));
      }

      return ResultHelper.ok(result.value);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error adding on-chain tx'
      ));
    }
  }

  /**
   * Delete a prediction (soft delete)
   */
  async delete(id: UUID): Promise<Result<void, AppError>> {
    if (!isSupabaseConfigured) {
      return ResultHelper.err(AppError.service('Supabase not configured'));
    }

    try {
      const { error } = await supabaseAdmin
        .from('predictions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        return ResultHelper.err(AppError.database(error.message));
      }

      return ResultHelper.ok(undefined);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error deleting prediction'
      ));
    }
  }

  /**
   * Get prediction statistics for a user
   */
  async getStats(userId: UUID): Promise<Result<PredictionStats, AppError>> {
    if (!isSupabaseConfigured) {
      return ResultHelper.err(AppError.service('Supabase not configured'));
    }

    try {
      const { data: predictions, error } = await supabaseAdmin
        .from('predictions')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        return ResultHelper.err(AppError.database(error.message));
      }

      return this.calculateStats(predictions || []);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error getting prediction stats'
      ));
    }
  }

  /**
   * Get all stats (global)
   */
  async getGlobalStats(): Promise<Result<PredictionStats, AppError>> {
    if (!isSupabaseConfigured) {
      return ResultHelper.err(AppError.service('Supabase not configured'));
    }

    try {
      const { data: predictions, error } = await supabaseAdmin
        .from('predictions')
        .select('*');

      if (error) {
        return ResultHelper.err(AppError.database(error.message));
      }

      return this.calculateStats(predictions || []);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error getting global stats'
      ));
    }
  }

  /**
   * Count predictions matching filter
   */
  async count(filter: PredictionFilter): Promise<Result<number, AppError>> {
    if (!isSupabaseConfigured) {
      return ResultHelper.err(AppError.service('Supabase not configured'));
    }

    try {
      let query = supabaseAdmin
        .from('predictions')
        .select('*', { count: 'exact', head: true });

      if (filter.userId) {
        query = query.eq('user_id', filter.userId);
      }
      if (filter.resolved !== undefined) {
        if (filter.resolved) {
          query = query.not('resolved_at', 'is', null);
        } else {
          query = query.is('resolved_at', null);
        }
      }
      if (filter.platform) {
        query = query.eq('platform', filter.platform);
      }

      const { count, error } = await query;

      if (error) {
        return ResultHelper.err(AppError.database(error.message));
      }

      return ResultHelper.ok(count || 0);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error counting predictions'
      ));
    }
  }

  /**
   * Helper to calculate stats from prediction records
   */
  private calculateStats(predictions: unknown[]): Result<PredictionStats, AppError> {
    interface PredictionRecord {
      resolved_at?: string | null;
      outcome?: boolean | null;
      direction: string;
      brier_score?: number | null;
      platform?: string | null;
      confidence?: string | null;
    }

    const all = predictions as PredictionRecord[];
    const resolved = all.filter((p) => p.resolved_at != null);
    const correct = resolved.filter((p) =>
      p.outcome !== null && ((p.direction === 'YES') === p.outcome)
    );

    const brierScores = resolved
      .filter((p) => p.brier_score != null)
      .map((p) => p.brier_score as number);

    const avgBrier = brierScores.length > 0
      ? brierScores.reduce((a, b) => a + b, 0) / brierScores.length
      : null;

    const byPlatform: Record<string, number> = {};
    const byConfidence: Record<string, number> = {};

    for (const p of all) {
      const platform = p.platform || 'other';
      byPlatform[platform] = (byPlatform[platform] || 0) + 1;

      const confidence = p.confidence || 'medium';
      byConfidence[confidence] = (byConfidence[confidence] || 0) + 1;
    }

    const stats: PredictionStats = {
      total: all.length,
      resolved: resolved.length,
      pending: all.length - resolved.length,
      correct: correct.length,
      accuracy: resolved.length > 0 ? correct.length / resolved.length : 0,
      averageBrierScore: avgBrier,
      byPlatform,
      byConfidence,
    };

    return ResultHelper.ok(stats);
  }
}

export default SupabasePredictionRepository;
