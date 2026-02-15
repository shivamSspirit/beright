/**
 * Probability Value Object
 *
 * Represents a probability between 0 and 1 (inclusive).
 * Ensures values are always valid and provides utility methods.
 */

import { Result } from '../../shared/types/Result';
import { PredictionError } from '../../shared/errors/DomainError';

export class Probability {
  private readonly _value: number;

  private constructor(value: number) {
    this._value = value;
  }

  /**
   * Create a Probability from a 0-1 value
   */
  static create(value: number): Result<Probability, PredictionError> {
    if (typeof value !== 'number' || isNaN(value)) {
      return Result.err(PredictionError.invalidProbability(value));
    }

    if (value < 0 || value > 1) {
      return Result.err(PredictionError.invalidProbability(value));
    }

    return Result.ok(new Probability(value));
  }

  /**
   * Create a Probability from a percentage (0-100)
   */
  static fromPercent(percent: number): Result<Probability, PredictionError> {
    return Probability.create(percent / 100);
  }

  /**
   * Create an unsafe Probability (throws on invalid)
   * Use only when you've already validated the input
   */
  static unsafe(value: number): Probability {
    const result = Probability.create(value);
    if (result.ok === false) {
      throw result.error;
    }
    return result.value;
  }

  /**
   * Get the raw probability value (0-1)
   */
  get value(): number {
    return this._value;
  }

  /**
   * Get as percentage (0-100)
   */
  toPercent(): number {
    return this._value * 100;
  }

  /**
   * Get as formatted percentage string
   */
  toPercentString(decimals = 0): string {
    return `${this.toPercent().toFixed(decimals)}%`;
  }

  /**
   * Get the complement (1 - p)
   */
  complement(): Probability {
    return new Probability(1 - this._value);
  }

  /**
   * Check if this is a high confidence prediction (>80% or <20%)
   */
  isHighConfidence(): boolean {
    return this._value >= 0.8 || this._value <= 0.2;
  }

  /**
   * Check if this is a medium confidence prediction (60-80% or 20-40%)
   */
  isMediumConfidence(): boolean {
    return (this._value >= 0.6 && this._value < 0.8) ||
           (this._value > 0.2 && this._value <= 0.4);
  }

  /**
   * Check if this is a low confidence prediction (40-60%)
   */
  isLowConfidence(): boolean {
    return this._value > 0.4 && this._value < 0.6;
  }

  /**
   * Get confidence level
   */
  getConfidenceLevel(): 'high' | 'medium' | 'low' {
    if (this.isHighConfidence()) return 'high';
    if (this.isMediumConfidence()) return 'medium';
    return 'low';
  }

  /**
   * Compare with another probability
   */
  equals(other: Probability): boolean {
    return Math.abs(this._value - other._value) < 0.0001;
  }

  /**
   * Check if this is greater than another probability
   */
  greaterThan(other: Probability): boolean {
    return this._value > other._value;
  }

  /**
   * Check if this is less than another probability
   */
  lessThan(other: Probability): boolean {
    return this._value < other._value;
  }

  /**
   * Calculate the spread between two probabilities
   */
  spreadFrom(other: Probability): number {
    return Math.abs(this._value - other._value);
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
    return this.toPercentString(1);
  }
}

export default Probability;
