/**
 * Supabase User Repository
 *
 * Implements UserRepository interface using Supabase as persistence layer.
 * Wraps the existing db.users helper functions with Result type handling.
 */

import { supabaseAdmin, isSupabaseConfigured } from '../../../../../lib/supabase/client';
import type { UserRepository, UserFilter, LeaderboardEntry } from '../../../../domain/ports/repositories/UserRepository';
import type { User, UserStats } from '../../../../domain/entities/User';
import { User as UserEntity } from '../../../../domain/entities/User';
import type { UUID, WalletAddress } from '../../../../shared/types/Common';
import type { Result } from '../../../../shared/types/Result';
import { Result as ResultHelper } from '../../../../shared/types/Result';
import { AppError } from '../../../../shared/errors/AppError';

/**
 * Supabase User Repository Implementation
 */
export class SupabaseUserRepository implements UserRepository {
  /**
   * Save a new user
   */
  async save(user: User): Promise<Result<User, AppError>> {
    if (!isSupabaseConfigured) {
      return ResultHelper.err(AppError.service('Supabase not configured'));
    }

    try {
      const record = user.toRecord();
      const { data, error } = await supabaseAdmin
        .from('users')
        .insert(record)
        .select()
        .single();

      if (error) {
        return ResultHelper.err(AppError.database(error.message));
      }

      const result = UserEntity.fromRecord(data);
      if (result.ok === false) {
        return ResultHelper.err(AppError.internal(`Failed to parse saved user: ${result.error.message}`));
      }

      return ResultHelper.ok(result.value);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error saving user'
      ));
    }
  }

  /**
   * Find user by ID
   */
  async findById(id: UUID): Promise<Result<User | null, AppError>> {
    if (!isSupabaseConfigured) {
      return ResultHelper.err(AppError.service('Supabase not configured'));
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        // PGRST116 = no rows returned
        if (error.code === 'PGRST116') {
          return ResultHelper.ok(null);
        }
        return ResultHelper.err(AppError.database(error.message));
      }

      if (!data) {
        return ResultHelper.ok(null);
      }

      const result = UserEntity.fromRecord(data);
      if (result.ok === false) {
        return ResultHelper.err(AppError.internal(`Failed to parse user: ${result.error.message}`));
      }

      return ResultHelper.ok(result.value);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error finding user'
      ));
    }
  }

  /**
   * Find user by Telegram ID
   */
  async findByTelegramId(telegramId: number): Promise<Result<User | null, AppError>> {
    if (!isSupabaseConfigured) {
      return ResultHelper.err(AppError.service('Supabase not configured'));
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
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

      const result = UserEntity.fromRecord(data);
      if (result.ok === false) {
        return ResultHelper.err(AppError.internal(`Failed to parse user: ${result.error.message}`));
      }

      return ResultHelper.ok(result.value);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error finding user by Telegram ID'
      ));
    }
  }

  /**
   * Find user by wallet address
   */
  async findByWalletAddress(address: WalletAddress): Promise<Result<User | null, AppError>> {
    if (!isSupabaseConfigured) {
      return ResultHelper.err(AppError.service('Supabase not configured'));
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('wallet_address', address)
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

      const result = UserEntity.fromRecord(data);
      if (result.ok === false) {
        return ResultHelper.err(AppError.internal(`Failed to parse user: ${result.error.message}`));
      }

      return ResultHelper.ok(result.value);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error finding user by wallet'
      ));
    }
  }

  /**
   * Find or create user from Telegram
   */
  async upsertFromTelegram(
    telegramId: number,
    username?: string
  ): Promise<Result<User, AppError>> {
    if (!isSupabaseConfigured) {
      return ResultHelper.err(AppError.service('Supabase not configured'));
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .upsert(
          {
            telegram_id: telegramId,
            telegram_username: username,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'telegram_id' }
        )
        .select()
        .single();

      if (error) {
        return ResultHelper.err(AppError.database(error.message));
      }

      const result = UserEntity.fromRecord(data);
      if (result.ok === false) {
        return ResultHelper.err(AppError.internal(`Failed to parse user: ${result.error.message}`));
      }

      return ResultHelper.ok(result.value);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error upserting user from Telegram'
      ));
    }
  }

  /**
   * Find or create user from wallet
   */
  async upsertFromWallet(address: WalletAddress): Promise<Result<User, AppError>> {
    if (!isSupabaseConfigured) {
      return ResultHelper.err(AppError.service('Supabase not configured'));
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .upsert(
          {
            wallet_address: address,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'wallet_address' }
        )
        .select()
        .single();

      if (error) {
        return ResultHelper.err(AppError.database(error.message));
      }

      const result = UserEntity.fromRecord(data);
      if (result.ok === false) {
        return ResultHelper.err(AppError.internal(`Failed to parse user: ${result.error.message}`));
      }

      return ResultHelper.ok(result.value);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error upserting user from wallet'
      ));
    }
  }

  /**
   * Update user
   */
  async update(user: User): Promise<Result<User, AppError>> {
    if (!isSupabaseConfigured) {
      return ResultHelper.err(AppError.service('Supabase not configured'));
    }

    try {
      const record = user.toRecord();
      const { data, error } = await supabaseAdmin
        .from('users')
        .update(record)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        return ResultHelper.err(AppError.database(error.message));
      }

      const result = UserEntity.fromRecord(data);
      if (result.ok === false) {
        return ResultHelper.err(AppError.internal(`Failed to parse updated user: ${result.error.message}`));
      }

      return ResultHelper.ok(result.value);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error updating user'
      ));
    }
  }

  /**
   * Link wallet to user
   */
  async linkWallet(userId: UUID, address: WalletAddress): Promise<Result<User, AppError>> {
    if (!isSupabaseConfigured) {
      return ResultHelper.err(AppError.service('Supabase not configured'));
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .update({
          wallet_address: address,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        return ResultHelper.err(AppError.database(error.message));
      }

      const result = UserEntity.fromRecord(data);
      if (result.ok === false) {
        return ResultHelper.err(AppError.internal(`Failed to parse user: ${result.error.message}`));
      }

      return ResultHelper.ok(result.value);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error linking wallet'
      ));
    }
  }

  /**
   * Get user stats
   */
  async getStats(userId: UUID): Promise<Result<UserStats, AppError>> {
    if (!isSupabaseConfigured) {
      return ResultHelper.err(AppError.service('Supabase not configured'));
    }

    try {
      // Get predictions to calculate stats
      const { data: predictions, error } = await supabaseAdmin
        .from('predictions')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        return ResultHelper.err(AppError.database(error.message));
      }

      const all = predictions || [];
      const resolved = all.filter((p: { resolved_at?: string | null }) => p.resolved_at != null);
      const correct = resolved.filter((p: { outcome?: boolean | null; direction: string }) =>
        p.outcome !== null && ((p.direction === 'YES') === p.outcome)
      );

      const brierScores = resolved
        .filter((p: { brier_score?: number | null }) => p.brier_score != null)
        .map((p: { brier_score: number }) => p.brier_score);

      const avgBrier = brierScores.length > 0
        ? brierScores.reduce((a: number, b: number) => a + b, 0) / brierScores.length
        : null;

      const byPlatform: Record<string, number> = {};
      const byConfidence: { high: number; medium: number; low: number } = { high: 0, medium: 0, low: 0 };

      // Calculate platform breakdown
      for (const p of all) {
        const pred = p as { platform?: string | null };
        const platform = pred.platform || 'other';
        byPlatform[platform] = (byPlatform[platform] || 0) + 1;
      }

      // Calculate confidence breakdown
      for (const p of all) {
        const pred = p as { confidence?: string | null };
        const confidence = pred.confidence || 'medium';
        if (confidence === 'high' || confidence === 'medium' || confidence === 'low') {
          byConfidence[confidence]++;
        }
      }

      const stats: UserStats = {
        totalPredictions: all.length,
        resolvedPredictions: resolved.length,
        pendingPredictions: all.length - resolved.length,
        correctPredictions: correct.length,
        accuracy: resolved.length > 0 ? correct.length / resolved.length : 0,
        averageBrierScore: avgBrier,
        predictionsByPlatform: byPlatform,
        predictionsByConfidence: byConfidence,
      };

      return ResultHelper.ok(stats);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error getting user stats'
      ));
    }
  }

  /**
   * Get user rank on leaderboard
   */
  async getRank(userId: UUID): Promise<Result<number | null, AppError>> {
    if (!isSupabaseConfigured) {
      return ResultHelper.err(AppError.service('Supabase not configured'));
    }

    try {
      const { data: leaderboard, error } = await supabaseAdmin
        .from('leaderboard')
        .select('id')
        .order('avg_brier_score', { ascending: true, nullsFirst: false })
        .limit(1000);

      if (error) {
        return ResultHelper.err(AppError.database(error.message));
      }

      const entries = leaderboard || [];
      const index = entries.findIndex((u: { id: string }) => u.id === userId);

      return ResultHelper.ok(index === -1 ? null : index + 1);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error getting user rank'
      ));
    }
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(
    limit = 100,
    minPredictions = 0
  ): Promise<Result<LeaderboardEntry[], AppError>> {
    if (!isSupabaseConfigured) {
      return ResultHelper.err(AppError.service('Supabase not configured'));
    }

    try {
      let query = supabaseAdmin
        .from('leaderboard')
        .select('*')
        .order('avg_brier_score', { ascending: true, nullsFirst: false })
        .limit(limit);

      if (minPredictions > 0) {
        query = query.gte('total_predictions', minPredictions);
      }

      const { data, error } = await query;

      if (error) {
        return ResultHelper.err(AppError.database(error.message));
      }

      const entries = (data || []).map((entry: {
        id: string;
        telegram_username?: string | null;
        wallet_address?: string | null;
        total_predictions?: number | null;
        resolved_predictions?: number | null;
        accuracy?: number | null;
        avg_brier_score?: number | null;
      }, index: number): LeaderboardEntry => ({
        userId: entry.id,
        rank: index + 1,
        displayName: entry.telegram_username || entry.wallet_address?.slice(0, 8) || 'Anonymous',
        telegramUsername: entry.telegram_username || null,
        walletAddress: entry.wallet_address || null,
        totalPredictions: entry.total_predictions || 0,
        resolvedPredictions: entry.resolved_predictions || 0,
        accuracy: entry.accuracy || 0,
        averageBrierScore: entry.avg_brier_score || 0,
      }));

      return ResultHelper.ok(entries);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error getting leaderboard'
      ));
    }
  }

  /**
   * Find users matching filter
   */
  async findMany(filter: UserFilter): Promise<Result<User[], AppError>> {
    if (!isSupabaseConfigured) {
      return ResultHelper.err(AppError.service('Supabase not configured'));
    }

    try {
      let query = supabaseAdmin.from('users').select('*');

      if (filter.hasWallet !== undefined) {
        if (filter.hasWallet) {
          query = query.not('wallet_address', 'is', null);
        } else {
          query = query.is('wallet_address', null);
        }
      }

      if (filter.createdAfter) {
        query = query.gte('created_at', filter.createdAfter.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        return ResultHelper.err(AppError.database(error.message));
      }

      const users: User[] = [];
      for (const record of data || []) {
        const result = UserEntity.fromRecord(record);
        if (result.ok) {
          users.push(result.value);
        }
      }

      return ResultHelper.ok(users);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error finding users'
      ));
    }
  }

  /**
   * Count users
   */
  async count(filter?: UserFilter): Promise<Result<number, AppError>> {
    if (!isSupabaseConfigured) {
      return ResultHelper.err(AppError.service('Supabase not configured'));
    }

    try {
      let query = supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true });

      if (filter?.hasWallet !== undefined) {
        if (filter.hasWallet) {
          query = query.not('wallet_address', 'is', null);
        } else {
          query = query.is('wallet_address', null);
        }
      }

      const { count, error } = await query;

      if (error) {
        return ResultHelper.err(AppError.database(error.message));
      }

      return ResultHelper.ok(count || 0);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error counting users'
      ));
    }
  }

  /**
   * Delete user (soft delete)
   */
  async delete(id: UUID): Promise<Result<void, AppError>> {
    if (!isSupabaseConfigured) {
      return ResultHelper.err(AppError.service('Supabase not configured'));
    }

    try {
      // Soft delete by setting deleted_at
      const { error } = await supabaseAdmin
        .from('users')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        return ResultHelper.err(AppError.database(error.message));
      }

      return ResultHelper.ok(undefined);
    } catch (err) {
      return ResultHelper.err(AppError.internal(
        err instanceof Error ? err.message : 'Unknown error deleting user'
      ));
    }
  }
}

export default SupabaseUserRepository;
