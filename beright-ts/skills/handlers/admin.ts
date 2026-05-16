/**
 * Admin Handlers for BeRight Protocol
 * Handles /help, /start, /settings commands
 */

import type { SkillResponse, TelegramMessage } from '../../types';
import type { CommandHandler, HandlerEntry } from './types';
import { HELP_TEXT, getCommandHelp } from '../../config/commands';

/**
 * Handle /help command
 */
export const handleHelp: CommandHandler = async (msg, args) => {
  if (args) {
    // Help for specific command
    const commandHelp = getCommandHelp(args);
    if (commandHelp) {
      return {
        text: commandHelp,
        mood: 'EDUCATIONAL',
      };
    }
    return {
      text: `❓ Unknown command: ${args}\n\nUse /help to see available commands.`,
      mood: 'NEUTRAL',
    };
  }

  // General help
  return {
    text: HELP_TEXT,
    mood: 'EDUCATIONAL',
  };
};

/**
 * Handle /start command
 */
export const handleStart: CommandHandler = async (msg, args) => {
  const firstName = msg.from?.first_name || 'there';

  return {
    text: `👋 *Welcome to BeRight, ${firstName}!*

I'm your AI-powered prediction market assistant. I help you find alpha across Polymarket, Kalshi, and other platforms.

🚀 *Quick Start:*
• /hot - See trending markets
• /search <topic> - Find specific markets
• /predict <market> <probability> - Make predictions
• /portfolio - View your positions

💡 *Pro Tips:*
• Reply to any market alert to get more info
• Use /research <topic> for deep analysis
• Track your accuracy with /calibration

Type /help for the full command list.

_Let's find some alpha!_ 📈`,
    mood: 'NEUTRAL',
  };
};

/**
 * Handle /settings command
 */
export const handleSettings: CommandHandler = async (msg, args) => {
  // TODO: Implement user settings
  return {
    text: `⚙️ *Settings*

🔔 *Notifications:* ON
📊 *Default Platform:* All
🎯 *Alert Threshold:* 5% move

_Settings customization coming soon!_

Use /subscribe and /unsubscribe to manage alerts.`,
    mood: 'NEUTRAL',
  };
};

/**
 * Handle /commands command (alias for help)
 */
export const handleCommands: CommandHandler = async (msg, args) => {
  return handleHelp(msg, args);
};

/**
 * Handler registry for admin commands
 */
export const adminHandlers: HandlerEntry[] = [
  {
    command: '/help',
    aliases: ['/commands', '/?'],
    handler: handleHelp,
    description: 'Show help and available commands',
    category: 'admin',
  },
  {
    command: '/start',
    handler: handleStart,
    description: 'Welcome message and quick start guide',
    category: 'admin',
  },
  {
    command: '/settings',
    aliases: ['/config', '/preferences'],
    handler: handleSettings,
    description: 'View and change settings',
    category: 'admin',
  },
];

/**
 * Get handler for admin command
 */
export function getAdminHandler(command: string): CommandHandler | null {
  const lower = command.toLowerCase();

  for (const entry of adminHandlers) {
    if (entry.command === lower) {
      return entry.handler;
    }
    if (entry.aliases?.includes(lower)) {
      return entry.handler;
    }
  }

  return null;
}
