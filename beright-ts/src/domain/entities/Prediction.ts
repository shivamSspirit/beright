/**
 * Prediction Entity
 *
 * Represents a user's prediction on a market outcome.
 * Tracks the full lifecycle: created → (on-chain) → resolved → scored.
 */

import type { UUID, ISOTimestamp, Direction, Confidence, Platform, TxSignature } from '../../shared/types/Common';
import { Probability } from '../value-objects/Probability';
import { BrierScore } from '../value-objects/BrierScore';
import { Result } from '../../shared/types/Result';
import { PredictionError } from '../../shared/errors/DomainError';

/**
 * Prediction creation input
 */
export interface CreatePredictionInput {
  id?: UUID;
  userId: UUID;
  question: string;
  probability: number;
  direction: Direction;
  reasoning?: string;
  platform?: Platform;
  marketId?: string;
  marketUrl?: string;
  resolvesAt?: Date | string;
  stakeAmount?: number;
}

/**
 * Prediction resolution input
 */
export interface ResolvePredictionInput {
  outcome: boolean;
  actualProbability?: number;
  resolutionSource?: string;
}

/**
 * Prediction Entity
 */
export class Prediction {
  readonly id: UUID;
  readonly userId: UUID;
  readonly question: string;
  readonly probability: Probability;
  readonly direction: Direction;
  readonly reasoning: string | null;
  readonly platform: Platform | null;
  readonly marketId: string | null;
  readonly marketUrl: string | null;
  readonly confidence: Confidence;
  readonly resolvesAt: Date | null;
  readonly stakeAmount: number | null;
  readonly createdAt: Date;

  // Resolution state
  private _resolvedAt: Date | null = null;
  private _outcome: boolean | null = null;
  private _brierScore: BrierScore | null = null;

  // On-chain state
  private _onChainTx: TxSignature | null = null;
  private _onChainConfirmed: boolean = false;

  private constructor(props: {
    id: UUID;
    userId: UUID;
    question: string;
    probability: Probability;
    direction: Direction;
    reasoning: string | null;
    platform: Platform | null;
    marketId: string | null;
    marketUrl: string | null;
    confidence: Confidence;
    resolvesAt: Date | null;
    stakeAmount: number | null;
    createdAt: Date;
    resolvedAt?: Date | null;
    outcome?: boolean | null;
    brierScore?: BrierScore | null;
    onChainTx?: TxSignature | null;
    onChainConfirmed?: boolean;
  }) {
    this.id = props.id;
    this.userId = props.userId;
    this.question = props.question;
    this.probability = props.probability;
    this.direction = props.direction;
    this.reasoning = props.reasoning;
    this.platform = props.platform;
    this.marketId = props.marketId;
    this.marketUrl = props.marketUrl;
    this.confidence = props.confidence;
    this.resolvesAt = props.resolvesAt;
    this.stakeAmount = props.stakeAmount;
    this.createdAt = props.createdAt;
    this._resolvedAt = props.resolvedAt || null;
    this._outcome = props.outcome ?? null;
    this._brierScore = props.brierScore || null;
    this._onChainTx = props.onChainTx || null;
    this._onChainConfirmed = props.onChainConfirmed || false;
  }

  /**
   * Create a new Prediction
   */
  static create(input: CreatePredictionInput): Result<Prediction, PredictionError> {
    // Validate question
    if (!input.question || input.question.trim().length === 0) {
      return Result.err(PredictionError.missingQuestion());
    }

    // Validate and create probability
    const probResult = Probability.create(input.probability);
    if (probResult.ok === false) {
      return probResult;
    }

    // Validate direction
    if (input.direction !== 'YES' && input.direction !== 'NO') {
      return Result.err(PredictionError.invalidDirection(input.direction));
    }

    // Parse resolvesAt
    let resolvesAt: Date | null = null;
    if (input.resolvesAt) {
      resolvesAt = input.resolvesAt instanceof Date
        ? input.resolvesAt
        : new Date(input.resolvesAt);
      if (isNaN(resolvesAt.getTime())) {
        resolvesAt = null;
      }
    }

    // Determine confidence from probability
    const prob = probResult.value;
    const confidence = prob.getConfidenceLevel();

    return Result.ok(new Prediction({
      id: input.id || generateUUID(),
      userId: input.userId,
      question: input.question.trim(),
      probability: prob,
      direction: input.direction,
      reasoning: input.reasoning?.trim() || null,
      platform: input.platform || null,
      marketId: input.marketId || null,
      marketUrl: input.marketUrl || null,
      confidence,
      resolvesAt,
      stakeAmount: input.stakeAmount || null,
      createdAt: new Date(),
    }));
  }

  /**
   * Reconstitute from database record
   */
  static fromRecord(record: {
    id: string;
    user_id: string;
    question: string;
    predicted_probability: number;
    direction: string;
    reasoning?: string | null;
    platform?: string | null;
    market_id?: string | null;
    market_url?: string | null;
    confidence?: string | null;
    resolves_at?: string | null;
    stake_amount?: number | null;
    created_at: string;
    resolved_at?: string | null;
    outcome?: boolean | null;
    brier_score?: number | null;
    on_chain_tx?: string | null;
    on_chain_confirmed?: boolean | null;
  }): Result<Prediction, PredictionError> {
    const probResult = Probability.create(record.predicted_probability);
    if (probResult.ok === false) {
      return { ok: false, error: probResult.error };
    }

    let brierScore: BrierScore | null = null;
    if (record.brier_score !== null && record.brier_score !== undefined) {
      const brierResult = BrierScore.create(record.brier_score);
      if (brierResult.ok) {
        brierScore = brierResult.value;
      }
    }

    return Result.ok(new Prediction({
      id: record.id,
      userId: record.user_id,
      question: record.question,
      probability: probResult.value,
      direction: record.direction as Direction,
      reasoning: record.reasoning || null,
      platform: (record.platform as Platform) || null,
      marketId: record.market_id || null,
      marketUrl: record.market_url || null,
      confidence: (record.confidence as Confidence) || probResult.value.getConfidenceLevel(),
      resolvesAt: record.resolves_at ? new Date(record.resolves_at) : null,
      stakeAmount: record.stake_amount || null,
      createdAt: new Date(record.created_at),
      resolvedAt: record.resolved_at ? new Date(record.resolved_at) : null,
      outcome: record.outcome ?? null,
      brierScore,
      onChainTx: record.on_chain_tx || null,
      onChainConfirmed: record.on_chain_confirmed || false,
    }));
  }

  // Getters for resolution state
  get resolvedAt(): Date | null { return this._resolvedAt; }
  get outcome(): boolean | null { return this._outcome; }
  get brierScore(): BrierScore | null { return this._brierScore; }
  get onChainTx(): TxSignature | null { return this._onChainTx; }
  get onChainConfirmed(): boolean { return this._onChainConfirmed; }

  /**
   * Check if prediction is resolved
   */
  get isResolved(): boolean {
    return this._resolvedAt !== null;
  }

  /**
   * Check if prediction is pending
   */
  get isPending(): boolean {
    return !this.isResolved;
  }

  /**
   * Check if prediction was correct
   */
  get isCorrect(): boolean | null {
    if (this._outcome === null) return null;
    return (this.direction === 'YES') === this._outcome;
  }

  /**
   * Check if committed on-chain
   */
  get isOnChain(): boolean {
    return this._onChainTx !== null;
  }

  /**
   * Resolve the prediction
   */
  resolve(input: ResolvePredictionInput): Result<Prediction, PredictionError> {
    if (this.isResolved) {
      return Result.err(PredictionError.alreadyResolved(this.id));
    }

    // Calculate Brier score
    const brierScore = BrierScore.calculate(
      this.probability,
      this.direction,
      input.outcome
    );

    // Create new prediction with resolution data
    const resolved = new Prediction({
      id: this.id,
      userId: this.userId,
      question: this.question,
      probability: this.probability,
      direction: this.direction,
      reasoning: this.reasoning,
      platform: this.platform,
      marketId: this.marketId,
      marketUrl: this.marketUrl,
      confidence: this.confidence,
      resolvesAt: this.resolvesAt,
      stakeAmount: this.stakeAmount,
      createdAt: this.createdAt,
      resolvedAt: new Date(),
      outcome: input.outcome,
      brierScore,
      onChainTx: this._onChainTx,
      onChainConfirmed: this._onChainConfirmed,
    });

    return Result.ok(resolved);
  }

  /**
   * Set on-chain transaction
   */
  setOnChainTx(txSignature: TxSignature, confirmed = false): Prediction {
    const updated = new Prediction({
      id: this.id,
      userId: this.userId,
      question: this.question,
      probability: this.probability,
      direction: this.direction,
      reasoning: this.reasoning,
      platform: this.platform,
      marketId: this.marketId,
      marketUrl: this.marketUrl,
      confidence: this.confidence,
      resolvesAt: this.resolvesAt,
      stakeAmount: this.stakeAmount,
      createdAt: this.createdAt,
      resolvedAt: this._resolvedAt,
      outcome: this._outcome,
      brierScore: this._brierScore,
      onChainTx: txSignature,
      onChainConfirmed: confirmed,
    });

    return updated;
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      userId: this.userId,
      question: this.question,
      probability: this.probability.value,
      probabilityPercent: this.probability.toPercent(),
      direction: this.direction,
      reasoning: this.reasoning,
      platform: this.platform,
      marketId: this.marketId,
      marketUrl: this.marketUrl,
      confidence: this.confidence,
      resolvesAt: this.resolvesAt?.toISOString() || null,
      stakeAmount: this.stakeAmount,
      createdAt: this.createdAt.toISOString(),
      resolvedAt: this._resolvedAt?.toISOString() || null,
      outcome: this._outcome,
      isCorrect: this.isCorrect,
      brierScore: this._brierScore?.value || null,
      onChainTx: this._onChainTx,
      onChainConfirmed: this._onChainConfirmed,
    };
  }

  /**
   * Convert to database record format
   */
  toRecord(): Record<string, unknown> {
    return {
      id: this.id,
      user_id: this.userId,
      question: this.question,
      predicted_probability: this.probability.value,
      direction: this.direction,
      reasoning: this.reasoning,
      platform: this.platform,
      market_id: this.marketId,
      market_url: this.marketUrl,
      confidence: this.confidence,
      resolves_at: this.resolvesAt?.toISOString(),
      stake_amount: this.stakeAmount,
      created_at: this.createdAt.toISOString(),
      resolved_at: this._resolvedAt?.toISOString(),
      outcome: this._outcome,
      brier_score: this._brierScore?.value,
      on_chain_tx: this._onChainTx,
      on_chain_confirmed: this._onChainConfirmed,
    };
  }
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

export default Prediction;
