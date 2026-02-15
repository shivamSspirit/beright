/**
 * BrierScore Value Object
 *
 * Represents a Brier score for measuring prediction accuracy.
 * Lower scores are better (0 = perfect, 1 = worst possible).
 *
 * Formula: (forecast - outcome)^2
 * Where forecast is predicted probability and outcome is 0 or 1.
 */

import { Result } from '../../shared/types/Result';
import { AppError } from '../../shared/errors/AppError';
import { Probability } from './Probability';

/**
 * Quality interpretation of Brier score
 */
export type BrierQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'bad';

export interface BrierInterpretation {
  quality: BrierQuality;
  description: string;
  percentile?: number;
}

export class BrierScore {
  private readonly _value: number;

  private constructor(value: number) {
    this._value = value;
  }

  /**
   * Create a BrierScore from a value
   */
  static create(value: number): Result<BrierScore, AppError> {
    if (typeof value !== 'number' || isNaN(value)) {
      return Result.err(AppError.validation(`Invalid Brier score: ${value}`));
    }

    if (value < 0 || value > 1) {
      return Result.err(AppError.validation(`Brier score must be between 0 and 1, got: ${value}`));
    }

    return Result.ok(new BrierScore(value));
  }

  /**
   * Calculate Brier score from prediction and outcome
   */
  static calculate(
    predictedProbability: Probability,
    direction: 'YES' | 'NO',
    outcome: boolean
  ): BrierScore {
    // Get the forecast probability for the YES outcome
    const forecast = direction === 'YES'
      ? predictedProbability.value
      : 1 - predictedProbability.value;

    // Outcome: 1 if YES happened, 0 if NO happened
    const actual = outcome ? 1 : 0;

    // Brier score = (forecast - actual)^2
    const score = Math.pow(forecast - actual, 2);

    return new BrierScore(score);
  }

  /**
   * Create from raw number (unsafe)
   */
  static unsafe(value: number): BrierScore {
    const result = BrierScore.create(value);
    if (result.ok === false) {
      throw result.error;
    }
    return result.value;
  }

  /**
   * Get the raw score value
   */
  get value(): number {
    return this._value;
  }

  /**
   * Interpret the Brier score quality
   */
  interpret(): BrierInterpretation {
    if (this._value <= 0.1) {
      return {
        quality: 'excellent',
        description: 'Exceptional calibration - superforecaster level',
        percentile: 99,
      };
    }

    if (this._value <= 0.15) {
      return {
        quality: 'good',
        description: 'Well-calibrated predictions',
        percentile: 85,
      };
    }

    if (this._value <= 0.22) {
      return {
        quality: 'fair',
        description: 'Average calibration - room for improvement',
        percentile: 60,
      };
    }

    if (this._value <= 0.30) {
      return {
        quality: 'poor',
        description: 'Below average - review prediction methodology',
        percentile: 35,
      };
    }

    return {
      quality: 'bad',
      description: 'Poor calibration - predictions need significant adjustment',
      percentile: 15,
    };
  }

  /**
   * Check if this is a good score (lower than threshold)
   */
  isGood(threshold = 0.15): boolean {
    return this._value <= threshold;
  }

  /**
   * Compare with another score
   */
  isBetterThan(other: BrierScore): boolean {
    return this._value < other._value;
  }

  /**
   * Calculate improvement from another score
   */
  improvementFrom(other: BrierScore): number {
    return other._value - this._value;
  }

  /**
   * Calculate improvement percentage
   */
  improvementPercentFrom(other: BrierScore): number {
    if (other._value === 0) return 0;
    return ((other._value - this._value) / other._value) * 100;
  }

  /**
   * Get emoji representation
   */
  toEmoji(): string {
    const interp = this.interpret();
    switch (interp.quality) {
      case 'excellent': return '🏆';
      case 'good': return '⭐';
      case 'fair': return '✨';
      case 'poor': return '👍';
      case 'bad': return '📈';
    }
  }

  /**
   * Format as string with interpretation
   */
  toDisplayString(): string {
    const interp = this.interpret();
    return `${this._value.toFixed(4)} (${interp.quality})`;
  }

  /**
   * JSON serialization
   */
  toJSON(): number {
    return this._value;
  }

  /**
   * String representation
   */
  toString(): string {
    return this._value.toFixed(4);
  }
}

/**
 * Calculate average Brier score from multiple scores
 */
export function averageBrierScore(scores: BrierScore[]): BrierScore | null {
  if (scores.length === 0) return null;

  const sum = scores.reduce((acc, score) => acc + score.value, 0);
  return BrierScore.unsafe(sum / scores.length);
}

export default BrierScore;
