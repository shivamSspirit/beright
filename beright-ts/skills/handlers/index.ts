/**
 * Handler Registry for BeRight Protocol
 * Central registry for all modular Telegram handlers
 */

import type { SkillResponse, TelegramMessage } from '../../types';
import type { CommandHandler, HandlerEntry, HandlerCategory } from './types';
import { parseCommand } from './types';

// Import handler modules
import { marketHandlers, getMarketHandler } from './markets';
import { adminHandlers, getAdminHandler } from './admin';

// Re-export types
export * from './types';

/**
 * All registered handlers
 */
const allHandlers: HandlerEntry[] = [
  ...marketHandlers,
  ...adminHandlers,
];

/**
 * Handler lookup map for O(1) access
 */
const handlerMap = new Map<string, CommandHandler>();
const aliasMap = new Map<string, string>(); // alias -> canonical command

// Build lookup maps
for (const entry of allHandlers) {
  handlerMap.set(entry.command, entry.handler);
  if (entry.aliases) {
    for (const alias of entry.aliases) {
      aliasMap.set(alias, entry.command);
    }
  }
}

/**
 * Get handler for a command
 */
export function getHandler(command: string): CommandHandler | null {
  const lower = command.toLowerCase();

  // Direct match
  const direct = handlerMap.get(lower);
  if (direct) return direct;

  // Alias match
  const canonical = aliasMap.get(lower);
  if (canonical) {
    return handlerMap.get(canonical) || null;
  }

  return null;
}

/**
 * Check if a command is handled by the new modular system
 */
export function isModularCommand(text: string): boolean {
  const { command } = parseCommand(text);
  return handlerMap.has(command) || aliasMap.has(command);
}

/**
 * Execute a command using modular handlers
 */
export async function executeCommand(
  msg: TelegramMessage
): Promise<SkillResponse | null> {
  const text = msg.text || '';
  const { command, args } = parseCommand(text);

  const handler = getHandler(command);
  if (!handler) {
    return null;
  }

  return handler(msg, args);
}

/**
 * Get all handlers for a category
 */
export function getHandlersByCategory(category: HandlerCategory): HandlerEntry[] {
  return allHandlers.filter((h) => h.category === category);
}

/**
 * Get all available commands with descriptions
 */
export function getAllCommands(): Array<{ command: string; description: string; category: HandlerCategory }> {
  return allHandlers.map((h) => ({
    command: h.command,
    description: h.description,
    category: h.category,
  }));
}

/**
 * Generate help text for all commands
 */
export function generateHelpText(): string {
  const byCategory = new Map<HandlerCategory, HandlerEntry[]>();

  for (const entry of allHandlers) {
    const list = byCategory.get(entry.category) || [];
    list.push(entry);
    byCategory.set(entry.category, list);
  }

  const categoryNames: Record<HandlerCategory, string> = {
    markets: '📊 Markets',
    predictions: '🎯 Predictions',
    trading: '💰 Trading',
    kalshi: '🟢 Kalshi',
    research: '🔬 Research',
    alerts: '🔔 Alerts',
    portfolio: '📈 Portfolio',
    admin: '⚙️ Admin',
  };

  let text = '*Available Commands*\n\n';

  for (const [category, entries] of byCategory) {
    text += `${categoryNames[category]}\n`;
    for (const entry of entries) {
      const aliases = entry.aliases ? ` (${entry.aliases.join(', ')})` : '';
      text += `  ${entry.command}${aliases} - ${entry.description}\n`;
    }
    text += '\n';
  }

  return text;
}
