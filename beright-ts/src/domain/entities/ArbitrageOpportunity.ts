/**
 * ArbitrageOpportunity Entity
 *
 * Represents an arbitrage opportunity between two markets on different platforms.
 */

import type { UUID, Platform } from '../../shared/types/Common';
import { Price } from '../value-objects/Price';
import { Result } from '../../shared/types/Result';
import { ArbitrageError } from '../../shared/errors/DomainError';
import { Market } from './Market';

/**
 * Arbitrage strategy type
 */
export type ArbitrageStrategy = 'buy_yes_sell_no' | 'buy_no_sell_yes' | 'cross_platform';

/**
 * Arbitrage opportunity input
 */
export interface CreateArbitrageInput {
  id?: UUID;
  topic: string;
  marketA: {
    platform: Platform;
    marketId: string;
    title: string;
    yesPrice: number;
    url?: string;
  };
  marketB: {
    platform: Platform;
    marketId: string;
    title: string;
    yesPrice: number;
    url?: string;
  };
  matchConfidence?: number;
}

/**
 * ArbitrageOpportunity Entity
 */
export class ArbitrageOpportunity {
  readonly id: UUID;
  readonly topic: string;
  readonly platformA: Platform;
  readonly platformB: Platform;
  readonly marketIdA: string;
  readonly marketIdB: string;
  readonly titleA: string;
  readonly titleB: string;
  readonly priceAYes: Price;
  readonly priceBYes: Price;
  readonly urlA: string | null;
  readonly urlB: string | null;
  readonly spread: number;
  readonly profitPercent: number;
  readonly strategy: ArbitrageStrategy;
  readonly matchConfidence: number;
  readonly detectedAt: Date;
  readonly expiresAt: Date;

  private constructor(props: {
    id: UUID;
    topic: string;
    platformA: Platform;
    platformB: Platform;
    marketIdA: string;
    marketIdB: string;
    titleA: string;
    titleB: string;
    priceAYes: Price;
    priceBYes: Price;
    urlA: string | null;
    urlB: string | null;
    spread: number;
    profitPercent: number;
    strategy: ArbitrageStrategy;
    matchConfidence: number;
    detectedAt: Date;
    expiresAt: Date;
  }) {
    this.id = props.id;
    this.topic = props.topic;
    this.platformA = props.platformA;
    this.platformB = props.platformB;
    this.marketIdA = props.marketIdA;
    this.marketIdB = props.marketIdB;
    this.titleA = props.titleA;
    this.titleB = props.titleB;
    this.priceAYes = props.priceAYes;
    this.priceBYes = props.priceBYes;
    this.urlA = props.urlA;
    this.urlB = props.urlB;
    this.spread = props.spread;
    this.profitPercent = props.profitPercent;
    this.strategy = props.strategy;
    this.matchConfidence = props.matchConfidence;
    this.detectedAt = props.detectedAt;
    this.expiresAt = props.expiresAt;
  }

  /**
   * Create from two markets
   */
  static fromMarkets(
    marketA: Market,
    marketB: Market,
    matchConfidence = 0.9
  ): Result<ArbitrageOpportunity, ArbitrageError> {
    // Calculate spread
    const spread = marketA.yesPrice.spreadFrom(marketB.yesPrice);

    if (spread < 0.02) {
      return Result.err(ArbitrageError.noOpportunities());
    }

    // Determine strategy based on prices
    const strategy: ArbitrageStrategy = marketA.yesPrice.greaterThan(marketB.yesPrice)
      ? 'buy_yes_sell_no'  // Buy YES on B (cheaper), sell NO on A
      : 'buy_no_sell_yes'; // Buy NO on B, sell YES on A

    // Calculate profit potential
    const profitPercent = marketA.yesPrice.arbitrageProfitPercent(marketB.yesPrice);

    // Generate topic from market titles
    const topic = extractCommonTopic(marketA.title, marketB.title);

    return Result.ok(new ArbitrageOpportunity({
      id: generateUUID(),
      topic,
      platformA: marketA.platform,
      platformB: marketB.platform,
      marketIdA: marketA.id,
      marketIdB: marketB.id,
      titleA: marketA.title,
      titleB: marketB.title,
      priceAYes: marketA.yesPrice,
      priceBYes: marketB.yesPrice,
      urlA: marketA.url,
      urlB: marketB.url,
      spread,
      profitPercent,
      strategy,
      matchConfidence,
      detectedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour expiry
    }));
  }

  /**
   * Create from input
   */
  static create(input: CreateArbitrageInput): Result<ArbitrageOpportunity, ArbitrageError> {
    const priceAResult = Price.create(input.marketA.yesPrice);
    if (!priceAResult.ok) {
      return Result.err(ArbitrageError.scanFailed('Invalid price for market A'));
    }

    const priceBResult = Price.create(input.marketB.yesPrice);
    if (!priceBResult.ok) {
      return Result.err(ArbitrageError.scanFailed('Invalid price for market B'));
    }

    const spread = priceAResult.value.spreadFrom(priceBResult.value);
    const profitPercent = priceAResult.value.arbitrageProfitPercent(priceBResult.value);

    const strategy: ArbitrageStrategy = priceAResult.value.greaterThan(priceBResult.value)
      ? 'buy_yes_sell_no'
      : 'buy_no_sell_yes';

    return Result.ok(new ArbitrageOpportunity({
      id: input.id || generateUUID(),
      topic: input.topic,
      platformA: input.marketA.platform,
      platformB: input.marketB.platform,
      marketIdA: input.marketA.marketId,
      marketIdB: input.marketB.marketId,
      titleA: input.marketA.title,
      titleB: input.marketB.title,
      priceAYes: priceAResult.value,
      priceBYes: priceBResult.value,
      urlA: input.marketA.url || null,
      urlB: input.marketB.url || null,
      spread,
      profitPercent,
      strategy,
      matchConfidence: input.matchConfidence ?? 0.9,
      detectedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    }));
  }

  /**
   * Check if opportunity is still valid (not expired)
   */
  get isValid(): boolean {
    return new Date() < this.expiresAt;
  }

  /**
   * Check if this is a high-value opportunity (>5% profit)
   */
  get isHighValue(): boolean {
    return this.profitPercent >= 5;
  }

  /**
   * Check if match confidence is high enough
   */
  get isHighConfidence(): boolean {
    return this.matchConfidence >= 0.85;
  }

  /**
   * Get platform emojis
   */
  get platformEmojis(): { a: string; b: string } {
    const emoji = (p: Platform): string => ({
      polymarket: '🟣',
      kalshi: '🔵',
      dflow: '🟠',
      manifold: '🔷',
      metaculus: '🟤',
      limitless: '⚪',
    }[p] || '📊');

    return {
      a: emoji(this.platformA),
      b: emoji(this.platformB),
    };
  }

  /**
   * Get human-readable strategy description
   */
  get strategyDescription(): string {
    switch (this.strategy) {
      case 'buy_yes_sell_no':
        return `Buy YES on ${this.platformB} (${this.priceBYes.toDisplayString()}), hedge with NO on ${this.platformA}`;
      case 'buy_no_sell_yes':
        return `Buy NO on ${this.platformB}, sell YES on ${this.platformA} (${this.priceAYes.toDisplayString()})`;
      case 'cross_platform':
        return `Cross-platform arbitrage between ${this.platformA} and ${this.platformB}`;
    }
  }

  /**
   * Get minutes until expiry
   */
  get minutesUntilExpiry(): number {
    return Math.max(0, (this.expiresAt.getTime() - Date.now()) / (1000 * 60));
  }

  /**
   * Convert to plain object
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      topic: this.topic,
      platformA: this.platformA,
      platformB: this.platformB,
      marketIdA: this.marketIdA,
      marketIdB: this.marketIdB,
      titleA: this.titleA,
      titleB: this.titleB,
      priceAYes: this.priceAYes.value,
      priceBYes: this.priceBYes.value,
      urlA: this.urlA,
      urlB: this.urlB,
      spread: this.spread,
      spreadPercent: this.spread * 100,
      profitPercent: this.profitPercent,
      strategy: this.strategy,
      strategyDescription: this.strategyDescription,
      matchConfidence: this.matchConfidence,
      isValid: this.isValid,
      isHighValue: this.isHighValue,
      detectedAt: this.detectedAt.toISOString(),
      expiresAt: this.expiresAt.toISOString(),
      minutesUntilExpiry: this.minutesUntilExpiry,
    };
  }

  /**
   * Convert to database record format
   */
  toRecord(): Record<string, unknown> {
    return {
      id: this.id,
      market_title: this.topic,
      platform1: this.platformA,
      platform2: this.platformB,
      market_id_platform1: this.marketIdA,
      market_id_platform2: this.marketIdB,
      price_platform1: this.priceAYes.value,
      price_platform2: this.priceBYes.value,
      spread_percent: this.spread * 100,
      detected_at: this.detectedAt.toISOString(),
    };
  }
}

/**
 * Extract common topic from two market titles
 */
function extractCommonTopic(titleA: string, titleB: string): string {
  // Simple implementation: return shorter title or first 50 chars
  const shorter = titleA.length <= titleB.length ? titleA : titleB;
  return shorter.slice(0, 50);
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

export default ArbitrageOpportunity;
