/**
 * Market Entity
 *
 * Represents a prediction market from any platform.
 * This is the domain representation, platform-agnostic.
 */

import type { Platform, MarketStatus, UUID, ISOTimestamp } from '../../shared/types/Common';
import { Price } from '../value-objects/Price';
import { Result } from '../../shared/types/Result';
import { MarketError } from '../../shared/errors/DomainError';

/**
 * Market creation input
 */
export interface CreateMarketInput {
  id: UUID;
  platform: Platform;
  title: string;
  question?: string;
  yesPrice: number;
  noPrice?: number;
  volume?: number;
  liquidity?: number;
  endDate?: Date | string;
  status?: MarketStatus;
  url?: string;
  category?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Market Entity
 */
export class Market {
  readonly id: UUID;
  readonly platform: Platform;
  readonly title: string;
  readonly question: string;
  readonly yesPrice: Price;
  readonly noPrice: Price;
  readonly volume: number;
  readonly liquidity: number;
  readonly endDate: Date | null;
  readonly status: MarketStatus;
  readonly url: string | null;
  readonly category: string | null;
  readonly tags: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly fetchedAt: Date;

  private constructor(props: {
    id: UUID;
    platform: Platform;
    title: string;
    question: string;
    yesPrice: Price;
    noPrice: Price;
    volume: number;
    liquidity: number;
    endDate: Date | null;
    status: MarketStatus;
    url: string | null;
    category: string | null;
    tags: string[];
    metadata: Record<string, unknown>;
  }) {
    this.id = props.id;
    this.platform = props.platform;
    this.title = props.title;
    this.question = props.question;
    this.yesPrice = props.yesPrice;
    this.noPrice = props.noPrice;
    this.volume = props.volume;
    this.liquidity = props.liquidity;
    this.endDate = props.endDate;
    this.status = props.status;
    this.url = props.url;
    this.category = props.category;
    this.tags = Object.freeze([...props.tags]);
    this.metadata = Object.freeze({ ...props.metadata });
    this.fetchedAt = new Date();
  }

  /**
   * Create a Market entity
   */
  static create(input: CreateMarketInput): Result<Market, MarketError> {
    // Validate and create prices
    const yesPriceResult = Price.create(input.yesPrice);
    if (!yesPriceResult.ok) {
      return Result.err(MarketError.invalidPrice(input.yesPrice));
    }

    const noPrice = input.noPrice ?? (1 - input.yesPrice);
    const noPriceResult = Price.create(noPrice);
    if (!noPriceResult.ok) {
      return Result.err(MarketError.invalidPrice(noPrice));
    }

    // Parse end date
    let endDate: Date | null = null;
    if (input.endDate) {
      endDate = input.endDate instanceof Date
        ? input.endDate
        : new Date(input.endDate);

      if (isNaN(endDate.getTime())) {
        endDate = null;
      }
    }

    return Result.ok(new Market({
      id: input.id,
      platform: input.platform,
      title: input.title,
      question: input.question || input.title,
      yesPrice: yesPriceResult.value,
      noPrice: noPriceResult.value,
      volume: input.volume || 0,
      liquidity: input.liquidity || 0,
      endDate,
      status: input.status || 'open',
      url: input.url || null,
      category: input.category || null,
      tags: input.tags || [],
      metadata: input.metadata || {},
    }));
  }

  /**
   * Create from raw API response (unsafe - throws on error)
   */
  static fromRaw(input: CreateMarketInput): Market {
    const result = Market.create(input);
    if (result.ok === false) {
      throw result.error;
    }
    return result.value;
  }

  /**
   * Get the implied probability (YES price as probability)
   */
  get impliedProbability(): number {
    return this.yesPrice.value;
  }

  /**
   * Get the implied probability as percentage
   */
  get impliedProbabilityPercent(): number {
    return this.yesPrice.value * 100;
  }

  /**
   * Check if market is still open for trading
   */
  get isOpen(): boolean {
    return this.status === 'open';
  }

  /**
   * Check if market is resolved
   */
  get isResolved(): boolean {
    return this.status === 'resolved';
  }

  /**
   * Check if market is closing soon (within 24 hours)
   */
  get isClosingSoon(): boolean {
    if (!this.endDate) return false;
    const hoursUntilClose = (this.endDate.getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursUntilClose > 0 && hoursUntilClose <= 24;
  }

  /**
   * Get hours until market closes
   */
  get hoursUntilClose(): number | null {
    if (!this.endDate) return null;
    return Math.max(0, (this.endDate.getTime() - Date.now()) / (1000 * 60 * 60));
  }

  /**
   * Check if this is a high volume market
   */
  get isHighVolume(): boolean {
    return this.volume >= 100000;
  }

  /**
   * Check if this is a contentious market (near 50%)
   */
  get isContentious(): boolean {
    return this.yesPrice.value >= 0.4 && this.yesPrice.value <= 0.6;
  }

  /**
   * Get platform emoji
   */
  get platformEmoji(): string {
    const emojis: Record<Platform, string> = {
      polymarket: '🟣',
      kalshi: '🔵',
      dflow: '🟠',
      manifold: '🔷',
      metaculus: '🟤',
      limitless: '⚪',
    };
    return emojis[this.platform] || '📊';
  }

  /**
   * Calculate spread with another market (for arbitrage)
   */
  spreadWith(other: Market): number {
    return this.yesPrice.spreadFrom(other.yesPrice);
  }

  /**
   * Check if there's arbitrage opportunity with another market
   */
  hasArbitrageWith(other: Market, minSpread = 0.03): boolean {
    return this.spreadWith(other) >= minSpread;
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      platform: this.platform,
      title: this.title,
      question: this.question,
      yesPrice: this.yesPrice.value,
      noPrice: this.noPrice.value,
      yesPct: this.impliedProbabilityPercent,
      noPct: 100 - this.impliedProbabilityPercent,
      volume: this.volume,
      liquidity: this.liquidity,
      endDate: this.endDate?.toISOString() || null,
      status: this.status,
      url: this.url,
      category: this.category,
      tags: [...this.tags],
      fetchedAt: this.fetchedAt.toISOString(),
    };
  }

  /**
   * Create a copy with updated prices
   */
  withUpdatedPrices(yesPrice: number, noPrice?: number): Result<Market, MarketError> {
    return Market.create({
      id: this.id,
      platform: this.platform,
      title: this.title,
      question: this.question,
      yesPrice,
      noPrice,
      volume: this.volume,
      liquidity: this.liquidity,
      endDate: this.endDate || undefined,
      status: this.status,
      url: this.url || undefined,
      category: this.category || undefined,
      tags: [...this.tags],
      metadata: { ...this.metadata },
    });
  }
}

export default Market;
