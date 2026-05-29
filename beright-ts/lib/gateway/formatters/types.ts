/**
 * Formatter Layer Types
 *
 * Formatters transform structured CommandResult data into
 * gateway-specific output (Telegram markdown, HTML, JSON, etc.)
 *
 * Formatters are responsible for:
 * - Presentation logic
 * - Platform-specific formatting (emojis, markdown, HTML)
 * - Localization
 *
 * Formatters do NOT contain business logic.
 *
 */

import { FormattedResponse, GatewayType } from '../types';
import { CommandContext, CommandResult, Mood, ErrorResult } from '../../orchestrator/types';

// =============================================================================
// DATA TYPES (For type-specific formatters)
// =============================================================================

/**
 * Market data structure
 */
export interface MarketData {
  id: string;
  platform: 'polymarket' | 'kalshi' | 'manifold' | 'dflow' | 'limitless';
  question: string;
  yesPrice: number;
  noPrice: number;
  volume24h?: number;
  liquidity?: number;
  closeDate?: Date;
  url?: string;
  ticker?: string;
  category?: string;
}

/**
 * Position data structure
 */
export interface PositionData {
  market: MarketData;
  side: 'YES' | 'NO';
  shares: number;
  avgPrice: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
}

/**
 * Trade result structure
 */
export interface TradeData {
  market: MarketData;
  side: 'YES' | 'NO';
  amount: number;
  shares: number;
  price: number;
  fees: number;
  signature: string;
  route?: 'dflow' | 'jupiter';
  savings?: number;
}

/**
 * Research result structure
 */
export interface ResearchData {
  query: string;
  markets: MarketData[];
  synthesis: {
    narrative: string;
    probability?: number;
    confidence: 'low' | 'medium' | 'high';
    keyFactors: string[];
    risks: string[];
  };
  sources: {
    title: string;
    url: string;
    snippet?: string;
  }[];
  timestamp: Date;
}

/**
 * Arbitrage opportunity structure
 */
export interface ArbitrageData {
  question: string;
  platforms: {
    platform: string;
    yesPrice: number;
    noPrice: number;
  }[];
  spreadPct: number;
  direction: string;
  confidence: 'low' | 'medium' | 'high';
}

/**
 * Wallet data structure
 */
export interface WalletData {
  publicKey: string;
  solBalance: number;
  usdcBalance: number;
  isNew: boolean;
}

// =============================================================================
// FORMATTER INTERFACE
// =============================================================================

/**
 * Formatter interface
 *
 * Each gateway has a formatter that knows how to present
 * data for that specific platform.
 */
export interface Formatter {
  /** Formatter identifier (matches gateway) */
  name: GatewayType;

  // ===========================================================================
  // Generic Formatting
  // ===========================================================================

  /**
   * Format a command result
   *
   * This is the main entry point. Dispatches to type-specific
   * formatters based on route/handler ID.
   */
  format(result: CommandResult, context: CommandContext): FormattedResponse;

  /**
   * Format an error
   */
  formatError(error: ErrorResult, context: CommandContext): FormattedResponse;

  // ===========================================================================
  // Type-Specific Formatters (Optional Overrides)
  // ===========================================================================

  /** Format market list */
  formatMarkets?(markets: MarketData[], context: CommandContext): FormattedResponse;

  /** Format single market */
  formatMarket?(market: MarketData, context: CommandContext): FormattedResponse;

  /** Format positions list */
  formatPositions?(positions: PositionData[], context: CommandContext): FormattedResponse;

  /** Format trade result */
  formatTrade?(trade: TradeData, context: CommandContext): FormattedResponse;

  /** Format research result */
  formatResearch?(research: ResearchData, context: CommandContext): FormattedResponse;

  /** Format arbitrage opportunities */
  formatArbitrage?(opportunities: ArbitrageData[], context: CommandContext): FormattedResponse;

  /** Format wallet info */
  formatWallet?(wallet: WalletData, context: CommandContext): FormattedResponse;

  /** Format help text */
  formatHelp?(commands: { id: string; description: string }[], context: CommandContext): FormattedResponse;

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /** Get mood emoji */
  getMoodEmoji?(mood: Mood): string;

  /** Format price */
  formatPrice?(price: number): string;

  /** Format currency */
  formatCurrency?(amount: number): string;

  /** Format percentage */
  formatPercentage?(value: number): string;

  /** Format date */
  formatDate?(date: Date): string;

  /** Truncate text to max length */
  truncate?(text: string, maxLength: number): string;
}

// =============================================================================
// FORMATTER REGISTRY
// =============================================================================

/**
 * Formatter constructor type
 */
export type FormatterConstructor = new () => Formatter;

/**
 * Formatter registry
 *
 * Maps gateway types to their formatters.
 */
export class FormatterRegistry {
  private formatters: Map<GatewayType, Formatter> = new Map();

  /**
   * Register a formatter
   */
  register(formatter: Formatter): void {
    this.formatters.set(formatter.name, formatter);
  }

  /**
   * Get formatter for gateway
   */
  get(gateway: GatewayType): Formatter | undefined {
    return this.formatters.get(gateway);
  }

  /**
   * Check if formatter exists
   */
  has(gateway: GatewayType): boolean {
    return this.formatters.has(gateway);
  }

  /**
   * Get all registered formatters
   */
  getAll(): Formatter[] {
    return Array.from(this.formatters.values());
  }
}

// =============================================================================
// SINGLETON REGISTRY
// =============================================================================

let registryInstance: FormatterRegistry | null = null;

/**
 * Get formatter registry
 */
export function getFormatterRegistry(): FormatterRegistry {
  if (!registryInstance) {
    registryInstance = new FormatterRegistry();
  }
  return registryInstance;
}

/**
 * Get formatter for gateway
 */
export function getFormatter(gateway: GatewayType): Formatter | undefined {
  return getFormatterRegistry().get(gateway);
}

// =============================================================================
// BASE FORMATTER HELPERS
// =============================================================================

/**
 * Common formatting utilities
 */
export const formatUtils = {
  /**
   * Format price as percentage (0.65 → "65%")
   */
  formatPct(price: number): string {
    return `${(price * 100).toFixed(0)}%`;
  },

  /**
   * Format USD amount
   */
  formatUsd(amount: number): string {
    if (amount >= 1_000_000) {
      return `$${(amount / 1_000_000).toFixed(1)}M`;
    }
    if (amount >= 1_000) {
      return `$${(amount / 1_000).toFixed(1)}K`;
    }
    return `$${amount.toFixed(2)}`;
  },

  /**
   * Format date for display
   */
  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  },

  /**
   * Get mood emoji
   */
  getMoodEmoji(mood: Mood): string {
    const emojiMap: Record<Mood, string> = {
      BULLISH: '🟢',
      BEARISH: '🔴',
      NEUTRAL: '⚪',
      ALERT: '🔔',
      EDUCATIONAL: '📚',
      ERROR: '❌',
    };
    return emojiMap[mood] || '⚪';
  },

  /**
   * Truncate text with ellipsis
   */
  truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  },

  /**
   * Create separator line
   */
  separator(length: number = 30, char: string = '─'): string {
    return char.repeat(length);
  },

  /**
   * Escape markdown special characters
   */
  escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  },

  /**
   * Format PnL with color indicator
   */
  formatPnL(value: number, pct: number): string {
    const sign = value >= 0 ? '+' : '';
    const emoji = value >= 0 ? '📈' : '📉';
    return `${emoji} ${sign}$${value.toFixed(2)} (${sign}${(pct * 100).toFixed(1)}%)`;
  },
};
