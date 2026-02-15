/**
 * UserRepository Interface
 *
 * Port for user persistence operations.
 * Implemented by adapters (Supabase, etc.)
 */

import type { UUID, WalletAddress } from '../../../shared/types/Common';
import type { AsyncResult } from '../../../shared/types/Result';
import type { User, CreateUserInput, UserStats } from '../../entities/User';
import type { AppError } from '../../../shared/errors/AppError';

/**
 * User filter options
 */
export interface UserFilter {
  source?: 'telegram' | 'web' | 'api';
  hasPredictions?: boolean;
  hasWallet?: boolean;
  createdAfter?: Date;
}

/**
 * Leaderboard entry
 */
export interface LeaderboardEntry {
  userId: UUID;
  rank: number;
  displayName: string;
  telegramUsername: string | null;
  walletAddress: string | null;
  totalPredictions: number;
  resolvedPredictions: number;
  accuracy: number;
  averageBrierScore: number;
}

/**
 * UserRepository Port
 */
export interface UserRepository {
  /**
   * Save a new user
   */
  save(user: User): AsyncResult<User, AppError>;

  /**
   * Find user by ID
   */
  findById(id: UUID): AsyncResult<User | null, AppError>;

  /**
   * Find user by Telegram ID
   */
  findByTelegramId(telegramId: number): AsyncResult<User | null, AppError>;

  /**
   * Find user by wallet address
   */
  findByWalletAddress(address: WalletAddress): AsyncResult<User | null, AppError>;

  /**
   * Find or create user from Telegram
   */
  upsertFromTelegram(
    telegramId: number,
    username?: string
  ): AsyncResult<User, AppError>;

  /**
   * Find or create user from wallet
   */
  upsertFromWallet(address: WalletAddress): AsyncResult<User, AppError>;

  /**
   * Update user
   */
  update(user: User): AsyncResult<User, AppError>;

  /**
   * Link wallet to user
   */
  linkWallet(userId: UUID, address: WalletAddress): AsyncResult<User, AppError>;

  /**
   * Get user stats
   */
  getStats(userId: UUID): AsyncResult<UserStats, AppError>;

  /**
   * Get user rank on leaderboard
   */
  getRank(userId: UUID): AsyncResult<number | null, AppError>;

  /**
   * Get leaderboard
   */
  getLeaderboard(
    limit?: number,
    minPredictions?: number
  ): AsyncResult<LeaderboardEntry[], AppError>;

  /**
   * Find users matching filter
   */
  findMany(filter: UserFilter): AsyncResult<User[], AppError>;

  /**
   * Count users
   */
  count(filter?: UserFilter): AsyncResult<number, AppError>;

  /**
   * Delete user (soft delete)
   */
  delete(id: UUID): AsyncResult<void, AppError>;
}

export default UserRepository;
