/**
 * User Entity
 *
 * Represents a user in the BeRight Protocol system.
 * Users can come from Telegram, Web (wallet), or API.
 */

import type { UUID, WalletAddress, UserSource } from '../../shared/types/Common';
import { BrierScore } from '../value-objects/BrierScore';
import { Result } from '../../shared/types/Result';
import { UserError } from '../../shared/errors/DomainError';

/**
 * User creation input
 */
export interface CreateUserInput {
  id?: UUID;
  telegramId?: number;
  telegramUsername?: string;
  walletAddress?: WalletAddress;
  displayName?: string;
  source?: UserSource;
}

/**
 * User statistics
 */
export interface UserStats {
  totalPredictions: number;
  resolvedPredictions: number;
  pendingPredictions: number;
  correctPredictions: number;
  accuracy: number;
  averageBrierScore: number | null;
  rank?: number | null;
  onChainPredictions?: number;
  predictionsByPlatform: Record<string, number>;
  predictionsByConfidence: {
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * User Entity
 */
export class User {
  readonly id: UUID;
  readonly telegramId: number | null;
  readonly telegramUsername: string | null;
  readonly walletAddress: WalletAddress | null;
  readonly displayName: string | null;
  readonly source: UserSource;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  // Cached stats (computed externally)
  private _stats: UserStats | null = null;

  private constructor(props: {
    id: UUID;
    telegramId: number | null;
    telegramUsername: string | null;
    walletAddress: WalletAddress | null;
    displayName: string | null;
    source: UserSource;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = props.id;
    this.telegramId = props.telegramId;
    this.telegramUsername = props.telegramUsername;
    this.walletAddress = props.walletAddress;
    this.displayName = props.displayName;
    this.source = props.source;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Create a new User
   */
  static create(input: CreateUserInput): Result<User, UserError> {
    // Must have at least one identifier
    if (!input.telegramId && !input.walletAddress) {
      return Result.err(UserError.notFound('User must have telegramId or walletAddress'));
    }

    // Validate wallet address if provided
    if (input.walletAddress && !isValidSolanaAddress(input.walletAddress)) {
      return Result.err(UserError.invalidWalletAddress(input.walletAddress));
    }

    const now = new Date();

    return Result.ok(new User({
      id: input.id || generateUUID(),
      telegramId: input.telegramId || null,
      telegramUsername: input.telegramUsername || null,
      walletAddress: input.walletAddress || null,
      displayName: input.displayName || input.telegramUsername || null,
      source: input.source || (input.telegramId ? 'telegram' : 'web'),
      createdAt: now,
      updatedAt: now,
    }));
  }

  /**
   * Reconstitute from database record
   */
  static fromRecord(record: {
    id: string;
    telegram_id?: number | null;
    telegram_username?: string | null;
    wallet_address?: string | null;
    display_name?: string | null;
    source?: string | null;
    created_at: string;
    updated_at?: string | null;
  }): Result<User, UserError> {
    return Result.ok(new User({
      id: record.id,
      telegramId: record.telegram_id || null,
      telegramUsername: record.telegram_username || null,
      walletAddress: record.wallet_address || null,
      displayName: record.display_name || record.telegram_username || null,
      source: (record.source as UserSource) || 'telegram',
      createdAt: new Date(record.created_at),
      updatedAt: record.updated_at ? new Date(record.updated_at) : new Date(record.created_at),
    }));
  }

  /**
   * Get the best identifier for display
   */
  get identifier(): string {
    return this.displayName
      || this.telegramUsername
      || (this.walletAddress ? `${this.walletAddress.slice(0, 6)}...` : null)
      || this.id.slice(0, 8);
  }

  /**
   * Check if user has Telegram linked
   */
  get hasTelegram(): boolean {
    return this.telegramId !== null;
  }

  /**
   * Check if user has wallet linked
   */
  get hasWallet(): boolean {
    return this.walletAddress !== null;
  }

  /**
   * Get cached stats
   */
  get stats(): UserStats | null {
    return this._stats;
  }

  /**
   * Set stats (called by service layer)
   */
  withStats(stats: UserStats): User {
    const user = new User({
      id: this.id,
      telegramId: this.telegramId,
      telegramUsername: this.telegramUsername,
      walletAddress: this.walletAddress,
      displayName: this.displayName,
      source: this.source,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    });
    user._stats = stats;
    return user;
  }

  /**
   * Link a wallet address
   */
  linkWallet(address: WalletAddress): Result<User, UserError> {
    if (!isValidSolanaAddress(address)) {
      return Result.err(UserError.invalidWalletAddress(address));
    }

    return Result.ok(new User({
      id: this.id,
      telegramId: this.telegramId,
      telegramUsername: this.telegramUsername,
      walletAddress: address,
      displayName: this.displayName,
      source: this.source,
      createdAt: this.createdAt,
      updatedAt: new Date(),
    }));
  }

  /**
   * Update display name
   */
  updateDisplayName(name: string): User {
    return new User({
      id: this.id,
      telegramId: this.telegramId,
      telegramUsername: this.telegramUsername,
      walletAddress: this.walletAddress,
      displayName: name,
      source: this.source,
      createdAt: this.createdAt,
      updatedAt: new Date(),
    });
  }

  /**
   * Convert to plain object
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      telegramId: this.telegramId,
      telegramUsername: this.telegramUsername,
      walletAddress: this.walletAddress,
      displayName: this.displayName,
      identifier: this.identifier,
      source: this.source,
      hasTelegram: this.hasTelegram,
      hasWallet: this.hasWallet,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      stats: this._stats ? {
        totalPredictions: this._stats.totalPredictions,
        resolvedPredictions: this._stats.resolvedPredictions,
        pendingPredictions: this._stats.pendingPredictions,
        accuracy: this._stats.accuracy,
        averageBrierScore: this._stats.averageBrierScore,
        rank: this._stats.rank,
        onChainPredictions: this._stats.onChainPredictions,
        predictionsByPlatform: this._stats.predictionsByPlatform,
        predictionsByConfidence: this._stats.predictionsByConfidence,
      } : null,
    };
  }

  /**
   * Convert to database record format
   */
  toRecord(): Record<string, unknown> {
    return {
      id: this.id,
      telegram_id: this.telegramId,
      telegram_username: this.telegramUsername,
      wallet_address: this.walletAddress,
      display_name: this.displayName,
      source: this.source,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
    };
  }
}

/**
 * Calculate user stats from predictions
 */
export function calculateUserStats(
  predictions: Array<{
    resolved_at?: string | null;
    outcome?: boolean | null;
    direction: string;
    brier_score?: number | null;
    on_chain_tx?: string | null;
    platform?: string | null;
    confidence?: string | null;
  }>,
  rank?: number | null
): UserStats {
  const total = predictions.length;
  const resolved = predictions.filter(p => p.resolved_at);
  const pending = predictions.filter(p => !p.resolved_at);
  const correct = resolved.filter(p => (p.direction === 'YES') === p.outcome);
  const onChain = predictions.filter(p => p.on_chain_tx);

  const brierScores = resolved
    .map(p => p.brier_score)
    .filter((b): b is number => b !== null && b !== undefined);

  const avgBrier = brierScores.length > 0
    ? brierScores.reduce((a, b) => a + b, 0) / brierScores.length
    : null;

  // Calculate platform breakdown
  const byPlatform: Record<string, number> = {};
  for (const p of predictions) {
    const platform = p.platform || 'other';
    byPlatform[platform] = (byPlatform[platform] || 0) + 1;
  }

  // Calculate confidence breakdown
  const byConfidence = { high: 0, medium: 0, low: 0 };
  for (const p of predictions) {
    const confidence = p.confidence || 'medium';
    if (confidence === 'high' || confidence === 'medium' || confidence === 'low') {
      byConfidence[confidence]++;
    }
  }

  return {
    totalPredictions: total,
    resolvedPredictions: resolved.length,
    pendingPredictions: pending.length,
    correctPredictions: correct.length,
    accuracy: resolved.length > 0 ? correct.length / resolved.length : 0,
    averageBrierScore: avgBrier,
    rank: rank || null,
    onChainPredictions: onChain.length,
    predictionsByPlatform: byPlatform,
    predictionsByConfidence: byConfidence,
  };
}

/**
 * Validate Solana address format
 */
function isValidSolanaAddress(address: string): boolean {
  // Base58 check: 32-44 characters, no 0OIl
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
}

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default User;
