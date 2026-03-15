/**
 * Common Telegram Formatting Utilities
 * Shared constants, helpers, and base formatting functions
 */

import type { FormattedResponse, Button } from '../../types';
import type { Mood, CommandContext } from '../../../orchestrator/types';
import { formatUsd, formatPct, formatDate, truncate } from '../../../core/format';

/**
 * Error result type (simplified for compatibility)
 */
export interface ErrorResult {
  message: string;
  code?: string;
  suggestion?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const MAX_MESSAGE_LENGTH = 4096;
export const SEPARATOR = '─'.repeat(30);
export const THIN_SEPARATOR = '─'.repeat(20);

/**
 * Mood emojis for Telegram
 */
export const MOOD_EMOJIS: Record<Mood, string> = {
  BULLISH: '🟢',
  BEARISH: '🔴',
  NEUTRAL: '⚪',
  ALERT: '🔔',
  EDUCATIONAL: '📚',
  ERROR: '❌',
};

/**
 * Platform emojis
 */
export const PLATFORM_EMOJIS: Record<string, string> = {
  polymarket: '🟣',
  kalshi: '🟢',
  manifold: '🔵',
  metaculus: '🟠',
  limitless: '⚪',
  jupiter: '🟡',
  dflow: '🔷',
};

/**
 * Price change direction emojis
 */
export const PRICE_EMOJIS = {
  up: '📈',
  down: '📉',
  neutral: '➡️',
};

/**
 * Status emojis
 */
export const STATUS_EMOJIS = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  loading: '⏳',
  money: '💰',
  chart: '📊',
  fire: '🔥',
  target: '🎯',
  bell: '🔔',
  whale: '🐋',
  rocket: '🚀',
};

// =============================================================================
// FORMATTING UTILITIES (re-exports with Telegram-specific behavior)
// =============================================================================

export { formatUsd, formatPct, formatDate, truncate };

/**
 * Get emoji for price change direction
 */
export function getPriceEmoji(change: number): string {
  if (change > 0.01) return PRICE_EMOJIS.up;
  if (change < -0.01) return PRICE_EMOJIS.down;
  return PRICE_EMOJIS.neutral;
}

/**
 * Get emoji for profit/loss
 */
export function getPnLEmoji(pnl: number): string {
  if (pnl > 0) return '🟢';
  if (pnl < 0) return '🔴';
  return '⚪';
}

/**
 * Format platform name with emoji
 */
export function formatPlatform(platform: string): string {
  const emoji = PLATFORM_EMOJIS[platform.toLowerCase()] || '📊';
  const name = platform.charAt(0).toUpperCase() + platform.slice(1);
  return `${emoji} ${name}`;
}

/**
 * Escape Telegram markdown special characters
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

/**
 * Bold text in Telegram markdown
 */
export function bold(text: string): string {
  return `*${text}*`;
}

/**
 * Italic text in Telegram markdown
 */
export function italic(text: string): string {
  return `_${text}_`;
}

/**
 * Code block in Telegram markdown
 */
export function code(text: string): string {
  return `\`${text}\``;
}

/**
 * Multi-line code block
 */
export function codeBlock(text: string, language?: string): string {
  return `\`\`\`${language || ''}\n${text}\n\`\`\``;
}

/**
 * Link in Telegram markdown
 */
export function link(text: string, url: string): string {
  return `[${text}](${url})`;
}

/**
 * Truncate message to Telegram's limit
 */
export function truncateMessage(text: string, maxLength: number = MAX_MESSAGE_LENGTH): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 20) + '\n\n_...truncated_';
}

// =============================================================================
// RESPONSE BUILDERS
// =============================================================================

/**
 * Extended response with mood (internal use)
 */
export interface ExtendedResponse extends FormattedResponse {
  mood?: Mood;
  data?: unknown;
}

/**
 * Create a formatted response
 */
export function createResponse(
  text: string,
  options: {
    mood?: Mood;
    buttons?: Button[];
    data?: unknown;
  } = {}
): ExtendedResponse {
  return {
    text: truncateMessage(text),
    buttons: options.buttons,
    mood: options.mood,
    data: options.data,
  };
}

/**
 * Create an error response
 */
export function createErrorResponse(
  error: ErrorResult,
  _context: CommandContext
): FormattedResponse {
  const emoji = MOOD_EMOJIS.ERROR;
  let text = `${emoji} ${bold('Error')}\n\n`;
  text += error.message;

  if (error.suggestion) {
    text += `\n\n💡 ${italic(error.suggestion)}`;
  }

  return createResponse(text, { mood: 'ERROR' });
}

/**
 * Create a success response with title
 */
export function createSuccessResponse(
  title: string,
  body: string,
  options: {
    mood?: Mood;
    buttons?: Button[];
  } = {}
): FormattedResponse {
  const text = `${STATUS_EMOJIS.success} ${bold(title)}\n\n${body}`;
  return createResponse(text, { mood: options.mood || 'NEUTRAL', buttons: options.buttons });
}

/**
 * Create a section header
 */
export function sectionHeader(title: string, emoji?: string): string {
  const e = emoji || '';
  return `${e}${e ? ' ' : ''}${bold(title)}\n${THIN_SEPARATOR}`;
}

/**
 * Create a key-value line
 */
export function kvLine(key: string, value: string): string {
  return `${bold(key + ':')} ${value}`;
}

/**
 * Create a bullet point
 */
export function bullet(text: string): string {
  return `• ${text}`;
}

/**
 * Create a numbered list
 */
export function numberedList(items: string[]): string {
  return items.map((item, i) => `${i + 1}. ${item}`).join('\n');
}

/**
 * Create callback button
 */
export function createButton(label: string, callbackData: string): Button {
  return { label, type: 'callback', value: callbackData };
}

/**
 * Create URL button
 */
export function createUrlButton(label: string, url: string): Button {
  return { label, type: 'url', value: url };
}
