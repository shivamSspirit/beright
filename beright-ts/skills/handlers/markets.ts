/**
 * Market Handlers for BeRight Protocol
 * Handles /hot, /search, /compare, /arb commands
 */

import type { SkillResponse, TelegramMessage } from '../../types';
import type { CommandHandler, HandlerEntry } from './types';
import { parseCommand, errorResponse } from './types';
import { formatUsd, formatPct } from '../../lib/core/format';

// Import existing market functions
import {
  searchMarkets,
  formatMarkets,
  compareOdds,
  formatComparison,
  getHotMarkets,
} from '../markets';
import { arbitrage } from '../arbitrage';

/**
 * Platform emoji mapping
 */
const PLATFORM_EMOJI: Record<string, string> = {
  polymarket: '🟣',
  kalshi: '🟢',
  manifold: '🔵',
  metaculus: '🟠',
  limitless: '⚪',
  jupiter: '🟡',
};

/**
 * Handle /hot command - show trending markets
 */
export const handleHot: CommandHandler = async (msg, args) => {
  try {
    const limit = args ? parseInt(args, 10) : 10;
    const validLimit = Math.min(Math.max(limit, 1), 20);

    const markets = await getHotMarkets(validLimit);

    if (!markets || markets.length === 0) {
      return {
        text: '📊 No trending markets found right now. Try again later.',
        mood: 'NEUTRAL',
      };
    }

    const formatted = formatMarkets(markets);

    return {
      text: `🔥 *HOT MARKETS*\n\n${formatted}`,
      mood: 'BULLISH',
      data: { markets },
    };
  } catch (error) {
    console.error('[Handler:hot] Error:', error);
    return errorResponse(
      'Failed to fetch hot markets',
      'Try /hot again in a moment'
    );
  }
};

/**
 * Handle /search command - search for markets
 */
export const handleSearch: CommandHandler = async (msg, args) => {
  if (!args || args.length < 2) {
    return errorResponse(
      'Please provide a search query',
      'Example: /search bitcoin or /search Trump election'
    );
  }

  try {
    const markets = await searchMarkets(args);

    if (!markets || markets.length === 0) {
      return {
        text: `🔍 No markets found for "${args}"\n\nTry different keywords or check spelling.`,
        mood: 'NEUTRAL',
      };
    }

    const formatted = formatMarkets(markets.slice(0, 10));

    return {
      text: `🔍 *SEARCH: ${args}*\n\n${formatted}`,
      mood: 'NEUTRAL',
      data: { markets, query: args },
    };
  } catch (error) {
    console.error('[Handler:search] Error:', error);
    return errorResponse(
      'Search failed',
      'Try again with different keywords'
    );
  }
};

/**
 * Handle /compare command - compare odds across platforms
 */
export const handleCompare: CommandHandler = async (msg, args) => {
  if (!args || args.length < 2) {
    return errorResponse(
      'Please provide a topic to compare',
      'Example: /compare Trump election'
    );
  }

  try {
    const comparison = await compareOdds(args);

    if (!comparison || comparison.markets.length === 0) {
      return {
        text: `📊 No comparable markets found for "${args}"`,
        mood: 'NEUTRAL',
      };
    }

    const formatted = formatComparison(comparison);

    return {
      text: `📊 *ODDS COMPARISON: ${args}*\n\n${formatted}`,
      mood: 'NEUTRAL',
      data: comparison,
    };
  } catch (error) {
    console.error('[Handler:compare] Error:', error);
    return errorResponse(
      'Comparison failed',
      'Try a different search term'
    );
  }
};

/**
 * Handle /arb command - find arbitrage opportunities
 */
export const handleArb: CommandHandler = async (msg, args) => {
  try {
    const result = await arbitrage(args || '');

    if (!result || result.text.includes('No arbitrage')) {
      return {
        text: '💰 No arbitrage opportunities found right now.\n\nArbitrages are rare and fleeting. Check back later!',
        mood: 'NEUTRAL',
      };
    }

    return {
      text: result.text,
      mood: 'ALERT',
      data: result.data,
    };
  } catch (error) {
    console.error('[Handler:arb] Error:', error);
    return errorResponse(
      'Arbitrage scan failed',
      'Try /arb again in a moment'
    );
  }
};

/**
 * Handle /trending command (alias for /hot)
 */
export const handleTrending: CommandHandler = async (msg, args) => {
  return handleHot(msg, args);
};

/**
 * Handle /top command (alias for /hot)
 */
export const handleTop: CommandHandler = async (msg, args) => {
  return handleHot(msg, args);
};

/**
 * Handler registry for market commands
 */
export const marketHandlers: HandlerEntry[] = [
  {
    command: '/hot',
    aliases: ['/trending', '/top'],
    handler: handleHot,
    description: 'Show trending/hot markets',
    category: 'markets',
  },
  {
    command: '/search',
    aliases: ['/find', '/lookup'],
    handler: handleSearch,
    description: 'Search for markets by keyword',
    category: 'markets',
  },
  {
    command: '/compare',
    aliases: ['/odds', '/diff'],
    handler: handleCompare,
    description: 'Compare odds across platforms',
    category: 'markets',
  },
  {
    command: '/arb',
    aliases: ['/arbitrage', '/spread'],
    handler: handleArb,
    description: 'Find arbitrage opportunities',
    category: 'markets',
  },
];

/**
 * Get handler for a command
 */
export function getMarketHandler(command: string): CommandHandler | null {
  const lower = command.toLowerCase();

  for (const entry of marketHandlers) {
    if (entry.command === lower) {
      return entry.handler;
    }
    if (entry.aliases?.includes(lower)) {
      return entry.handler;
    }
  }

  return null;
}
