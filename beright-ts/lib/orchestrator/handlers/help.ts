/**
 * Help Handler
 *
 * Display available commands and help information.
 *
 * @see docs/ADR-002-TELEGRAM-AS-GATEWAY.md
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
} from '../types';
import { registerHandler } from './registry';
import { getVisibleRoutes, getRoutesByCategory } from '../../router/routes.config';
import type { Route } from '../../router/types';

// =============================================================================
// TYPES
// =============================================================================

export interface CommandInfo {
  command: string;
  description: string;
  examples?: string[];
  tier: string;
}

export interface CategoryInfo {
  name: string;
  commands: CommandInfo[];
}

export interface HelpResult {
  timestamp: string;
  mode: 'overview' | 'category' | 'command';
  // For overview
  categories?: CategoryInfo[];
  totalCommands?: number;
  // For category
  category?: CategoryInfo;
  // For command
  command?: CommandInfo & {
    aliases?: string[];
    requiresAuth?: boolean;
    requiresWallet?: boolean;
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getCategoryDisplayName(category: string): string {
  const names: Record<string, string> = {
    'discovery': 'Market Discovery',
    'trading': 'Trading',
    'portfolio': 'Portfolio & Analytics',
    'predictions': 'Predictions',
    'intelligence': 'Intelligence',
    'research': 'Research',
    'calibration': 'Calibration',
    'alerts': 'Alerts & Notifications',
    'tracking': 'Tracking',
    'arbitrage': 'Arbitrage',
    'whale': 'Whale Tracking',
    'copy-trading': 'Copy Trading',
    'kalshi': 'Kalshi Exchange',
    'system': 'System',
    'notifications': 'Notifications',
  };
  return names[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

function routeToCommandInfo(route: Route): CommandInfo {
  return {
    command: route.patterns[0] || `/${route.id}`,
    description: route.description || 'No description available',
    examples: route.examples,
    tier: route.tier,
  };
}

function groupRoutesByCategory(routes: Route[]): Map<string, Route[]> {
  const groups = new Map<string, Route[]>();

  for (const route of routes) {
    const category = route.categories?.[0] || 'other';
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category)!.push(route);
  }

  return groups;
}

// =============================================================================
// HANDLER
// =============================================================================

export const helpHandler: CommandHandler<HelpResult> = {
  id: 'help',
  skillsUsed: [],

  async execute(context: CommandContext): Promise<CommandResult<HelpResult>> {
    const startTime = Date.now();

    try {
      const rawMessage = context.message?.text || '';
      const args = rawMessage.replace(/^\/(help|start|commands)\s*/i, '').trim();

      // Get all visible routes
      const allRoutes = getVisibleRoutes();

      // Check for specific category or command
      if (args) {
        const lowerArgs = args.toLowerCase();

        // Check if asking about a specific category
        const categoryRoutes = getRoutesByCategory(lowerArgs);
        if (categoryRoutes.length > 0) {
          const result: HelpResult = {
            timestamp: new Date().toISOString(),
            mode: 'category',
            category: {
              name: getCategoryDisplayName(lowerArgs),
              commands: categoryRoutes.map(routeToCommandInfo),
            },
          };

          return {
            success: true,
            data: result,
            meta: {
              handlerId: 'help',
              routeId: context.route.id,
              executedAt: new Date(),
              durationMs: Date.now() - startTime,
              skillsUsed: [],
              apiCallsMade: 0,
            },
            hints: {
              mood: 'EDUCATIONAL',
              suggestedActions: ['/help'],
            },
          };
        }

        // Check if asking about a specific command
        const matchingRoute = allRoutes.find(r =>
          r.patterns.some(p => p.toLowerCase() === `/${lowerArgs}` || p.toLowerCase() === lowerArgs) ||
          r.id.toLowerCase() === lowerArgs
        );

        if (matchingRoute) {
          const result: HelpResult = {
            timestamp: new Date().toISOString(),
            mode: 'command',
            command: {
              ...routeToCommandInfo(matchingRoute),
              aliases: matchingRoute.aliases,
              requiresAuth: matchingRoute.requiresAuth,
              requiresWallet: matchingRoute.requiresWallet,
            },
          };

          return {
            success: true,
            data: result,
            meta: {
              handlerId: 'help',
              routeId: context.route.id,
              executedAt: new Date(),
              durationMs: Date.now() - startTime,
              skillsUsed: [],
              apiCallsMade: 0,
            },
            hints: {
              mood: 'EDUCATIONAL',
              suggestedActions: [matchingRoute.patterns[0]],
            },
          };
        }
      }

      // Default: show all categories
      const grouped = groupRoutesByCategory(allRoutes);
      const categories: CategoryInfo[] = [];

      // Order categories logically
      const categoryOrder = [
        'discovery', 'trading', 'portfolio', 'predictions',
        'intelligence', 'research', 'calibration', 'alerts',
        'tracking', 'arbitrage', 'copy-trading', 'kalshi', 'system'
      ];

      for (const cat of categoryOrder) {
        if (grouped.has(cat)) {
          categories.push({
            name: getCategoryDisplayName(cat),
            commands: grouped.get(cat)!.map(routeToCommandInfo),
          });
        }
      }

      // Add any remaining categories
      for (const [cat, routes] of grouped) {
        if (!categoryOrder.includes(cat)) {
          categories.push({
            name: getCategoryDisplayName(cat),
            commands: routes.map(routeToCommandInfo),
          });
        }
      }

      const result: HelpResult = {
        timestamp: new Date().toISOString(),
        mode: 'overview',
        categories,
        totalCommands: allRoutes.length,
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'help',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: [],
          apiCallsMade: 0,
        },
        hints: {
          mood: 'EDUCATIONAL',
          suggestedActions: ['/hot', '/brief', '/research'],
        },
      };
    } catch (error) {
      console.error('[HelpHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'HELP_FAILED',
          message: error instanceof Error ? error.message : 'Failed to get help',
          retryable: false,
        },
        meta: {
          handlerId: 'help',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: [],
          apiCallsMade: 0,
        },
        hints: {
          mood: 'ERROR',
        },
      };
    }
  },
};

// =============================================================================
// AUTO-REGISTER
// =============================================================================

registerHandler(helpHandler);

export default helpHandler;
