/**
 * Handler Types for BeRight Protocol
 * Shared types for modular Telegram handlers
 */

import type { SkillResponse, TelegramMessage } from '../../types';

/**
 * Handler function signature
 */
export type CommandHandler = (
  msg: TelegramMessage,
  args: string
) => Promise<SkillResponse>;

/**
 * Handler registration entry
 */
export interface HandlerEntry {
  /** Command pattern (e.g., '/hot', '/search') */
  command: string;
  /** Alternative patterns that trigger this handler */
  aliases?: string[];
  /** Handler function */
  handler: CommandHandler;
  /** Brief description for help text */
  description: string;
  /** Category for grouping in help */
  category: HandlerCategory;
  /** Minimum user tier required */
  minTier?: 'free' | 'basic' | 'pro' | 'whale';
}

/**
 * Handler categories for organization
 */
export type HandlerCategory =
  | 'markets'
  | 'predictions'
  | 'trading'
  | 'kalshi'
  | 'research'
  | 'alerts'
  | 'portfolio'
  | 'admin';

/**
 * Handler context passed to handlers
 */
export interface HandlerContext {
  /** Telegram chat ID */
  chatId: string;
  /** User ID (Telegram or internal) */
  userId: string;
  /** User tier */
  tier: 'free' | 'basic' | 'pro' | 'whale';
  /** Recent context from previous messages */
  recentContext?: string;
}

/**
 * Extract command and arguments from message text
 */
export function parseCommand(text: string): { command: string; args: string } {
  const trimmed = text.trim();
  const spaceIndex = trimmed.indexOf(' ');

  if (spaceIndex === -1) {
    return { command: trimmed.toLowerCase(), args: '' };
  }

  return {
    command: trimmed.slice(0, spaceIndex).toLowerCase(),
    args: trimmed.slice(spaceIndex + 1).trim(),
  };
}

/**
 * Format user-friendly error response
 */
export function errorResponse(
  message: string,
  suggestion?: string
): SkillResponse {
  let text = `❌ ${message}`;
  if (suggestion) {
    text += `\n\n💡 ${suggestion}`;
  }
  return { text, mood: 'ERROR' };
}

/**
 * Format success response with consistent styling
 */
export function successResponse(
  title: string,
  body: string,
  mood: SkillResponse['mood'] = 'NEUTRAL'
): SkillResponse {
  return {
    text: `✅ *${title}*\n\n${body}`,
    mood,
  };
}
