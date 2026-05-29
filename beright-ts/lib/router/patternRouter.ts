/**
 * Pattern Router
 *
 * Fast pattern-based routing for commands.
 * Matches commands like /hot, /research, /trade by pattern.
 *
 * This is the first router in the chain. Falls through to
 * semantic router if no pattern matches.
 *
 */

import { Router, Route, RouteMatch, MatchType } from './types';
import {
  ROUTES,
  PARAMETERIZED_PATTERNS,
  findRouteByPattern,
  findRouteByAlias,
  findMatchingAlias,
} from './routes.config';

// =============================================================================
// PATTERN ROUTER
// =============================================================================

/**
 * Pattern Router
 *
 * Matches messages to routes using:
 * 1. Exact command patterns (/hot, /research)
 * 2. Parameterized patterns (/trade TICKER YES 50)
 * 3. Natural language aliases ("hot markets", "what's trending")
 */
export class PatternRouter implements Router {
  name = 'pattern';
  priority = 100; // Highest priority - try first

  /**
   * Check if this router can handle the message
   */
  canHandle(text: string): boolean {
    const normalized = text.toLowerCase().trim();

    // Commands start with /
    if (normalized.startsWith('/')) {
      return true;
    }

    // Check aliases
    return ROUTES.some((route) => Boolean(findMatchingAlias(route, normalized)));
  }

  /**
   * Match a message to a route
   */
  async match(text: string): Promise<RouteMatch | null> {
    const startTime = Date.now();
    const normalized = text.trim();
    const lower = normalized.toLowerCase();

    // Try exact command match first
    if (lower.startsWith('/')) {
      const match = this.matchCommand(normalized);
      if (match) {
        match.matchDurationMs = Date.now() - startTime;
        return match;
      }
    }

    // Try alias match
    const aliasMatch = this.matchAlias(normalized);
    if (aliasMatch) {
      aliasMatch.matchDurationMs = Date.now() - startTime;
      return aliasMatch;
    }

    // No match - let semantic router handle it
    return null;
  }

  /**
   * Match a command (starts with /)
   */
  private matchCommand(text: string): RouteMatch | null {
    const parts = text.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Find route by command pattern
    const route = findRouteByPattern(command);
    if (!route) {
      return null;
    }

    // Check if this is a parameterized command
    const paramPattern = PARAMETERIZED_PATTERNS[route.handler];
    if (paramPattern) {
      const params = this.parseParameters(args, paramPattern.parameters);
      return {
        route,
        matchType: 'pattern' as MatchType,
        confidence: 1.0,
        arguments: args,
        params,
      };
    }

    // Simple command match
    return {
      route,
      matchType: 'exact' as MatchType,
      confidence: 1.0,
      arguments: args,
      params: args.length > 0 ? { query: args.join(' ') } : {},
    };
  }

  /**
   * Match by alias (natural language)
   */
  private matchAlias(text: string): RouteMatch | null {
    const route = findRouteByAlias(text);
    if (!route) {
      return null;
    }

    // Extract any query after the alias
    const lower = text.toLowerCase();
    let query = '';
    const matchedAlias = findMatchingAlias(route, lower);

    if (matchedAlias) {
      const aliasRegex = new RegExp(
        `\\b${matchedAlias
          .trim()
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\s+/g, '\\s+')}\\b`,
        'i'
      );
      const match = text.match(aliasRegex);
      if (match && typeof match.index === 'number') {
        query = text.slice(match.index + match[0].length).trim();
      }
    }

    return {
      route,
      matchType: 'alias' as MatchType,
      confidence: 0.85, // Slightly lower confidence for aliases
      arguments: query ? [query] : [],
      params: query ? { query } : {},
    };
  }

  /**
   * Parse parameters from arguments
   */
  private parseParameters(
    args: string[],
    paramDefs: typeof PARAMETERIZED_PATTERNS[string]['parameters']
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    for (let i = 0; i < paramDefs.length; i++) {
      const def = paramDefs[i];
      const value = args[i];

      if (value === undefined) {
        if (def.required) {
          // Missing required parameter - will be caught by validation
          continue;
        }
        if (def.default !== undefined) {
          params[def.name] = def.default;
        }
        continue;
      }

      // Parse based on type
      switch (def.type) {
        case 'number':
          const num = parseFloat(value);
          if (!isNaN(num)) {
            params[def.name] = num;
          }
          break;

        case 'boolean':
          params[def.name] = value.toLowerCase() === 'true' || value === '1';
          break;

        case 'enum':
          const upper = value.toUpperCase();
          if (def.enumValues?.includes(upper)) {
            params[def.name] = upper;
          } else if (def.enumValues?.includes(value)) {
            params[def.name] = value;
          }
          break;

        default:
          params[def.name] = value;
      }
    }

    return params;
  }
}

// =============================================================================
// SINGLETON & HELPERS
// =============================================================================

let routerInstance: PatternRouter | null = null;

/**
 * Get pattern router instance
 */
export function getPatternRouter(): PatternRouter {
  if (!routerInstance) {
    routerInstance = new PatternRouter();
  }
  return routerInstance;
}

/**
 * Quick match helper
 */
export async function matchPattern(text: string): Promise<RouteMatch | null> {
  return getPatternRouter().match(text);
}

/**
 * Check if pattern router can handle message
 */
export function canHandlePattern(text: string): boolean {
  return getPatternRouter().canHandle(text);
}
