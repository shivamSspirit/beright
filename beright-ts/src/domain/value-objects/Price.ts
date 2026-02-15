/**
 * Price Value Object
 *
 * Represents a market price (YES/NO contract price).
 * Prices are typically between 0 and 1 (or 0.01 to 0.99 for binary markets).
 */

import { Result } from '../../shared/types/Result';
import { MarketError } from '../../shared/errors/DomainError';
import { Probability } from './Probability';

export class Price {
  private readonly _value: number;

  private constructor(value: number) {
    this._value = value;
  }

  /**
   * Create a Price from a 0-1 value
   */
  static create(value: number): Result<Price, MarketError> {
    if (typeof value !== 'number' || isNaN(value)) {
      return Result.err(MarketError.invalidPrice(value));
    }

    // Allow slightly outside bounds for edge cases, but clamp
    const clamped = Math.max(0, Math.min(1, value));

    return Result.ok(new Price(clamped));
  }

  /**
   * Create from cents (0-100)
   */
  static fromCents(cents: number): Result<Price, MarketError> {
    return Price.create(cents / 100);
  }

  /**
   * Create unsafe (throws on invalid)
   */
  static unsafe(value: number): Price {
    const result = Price.create(value);
    if (result.ok === false) {
      throw result.error;
    }
    return result.value;
  }

  /**
   * Get the raw price value (0-1)
   */
  get value(): number {
    return this._value;
  }

  /**
   * Get as cents (0-100)
   */
  toCents(): number {
    return Math.round(this._value * 100);
  }

  /**
   * Get as formatted cents string
   */
  toCentsString(): string {
    return `${this.toCents()}¢`;
  }

  /**
   * Get as probability
   */
  toProbability(): Result<Probability, never> {
    // Price is already validated 0-1, so this should always succeed
    return Probability.create(this._value) as Result<Probability, never>;
  }

  /**
   * Get the complement price (for NO when this is YES)
   */
  complement(): Price {
    return new Price(1 - this._value);
  }

  /**
   * Calculate spread between two prices
   */
  spreadFrom(other: Price): number {
    return Math.abs(this._value - other._value);
  }

  /**
   * Calculate spread as percentage
   */
  spreadPercentFrom(other: Price): number {
    return this.spreadFrom(other) * 100;
  }

  /**
   * Check if arbitrage exists between this and another price
   * Arbitrage exists when YES + NO < 1 (can profit by buying both)
   * or when prices on different platforms have significant spread
   */
  hasArbitrageWith(otherYesPrice: Price, minSpread = 0.03): boolean {
    const spread = this.spreadFrom(otherYesPrice);
    return spread >= minSpread;
  }

  /**
   * Calculate potential profit from arbitrage
   */
  arbitrageProfitPercent(otherPrice: Price): number {
    const spread = this.spreadFrom(otherPrice);
    const avgPrice = (this._value + otherPrice._value) / 2;
    if (avgPrice === 0) return 0;
    return (spread / avgPrice) * 100;
  }

  /**
   * Check if prices are approximately equal
   */
  equals(other: Price, tolerance = 0.001): boolean {
    return Math.abs(this._value - other._value) < tolerance;
  }

  /**
   * Compare prices
   */
  greaterThan(other: Price): boolean {
    return this._value > other._value;
  }

  lessThan(other: Price): boolean {
    return this._value < other._value;
  }

  /**
   * Get mid price between two prices
   */
  midWith(other: Price): Price {
    return new Price((this._value + other._value) / 2);
  }

  /**
   * Format for display
   */
  toDisplayString(): string {
    return `${(this._value * 100).toFixed(1)}%`;
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
    return this.toDisplayString();
  }
}

/**
 * Price pair for a binary market
 */
export interface PricePair {
  yes: Price;
  no: Price;
}

/**
 * Create a price pair ensuring they sum correctly
 */
export function createPricePair(yesPrice: number): Result<PricePair, MarketError> {
  const yesResult = Price.create(yesPrice);
  if (yesResult.ok === false) {
    return { ok: false, error: yesResult.error };
  }

  const noResult = Price.create(1 - yesPrice);
  if (noResult.ok === false) {
    return { ok: false, error: noResult.error };
  }

  return Result.ok({
    yes: yesResult.value,
    no: noResult.value,
  });
}

export default Price;
