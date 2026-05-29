/**
 * Unified Router
 *
 * Chains multiple routers in priority order:
 * 1. Pattern Router (exact commands, fastest)
 * 2. Semantic Router (LLM understanding, slower but smarter)
 * 3. Fallback Router (default handling)
 *
 * This is where intelligence enters the system.
 *
 */

import { Router, RouteMatch, Route } from './types';
import { PatternRouter } from './patternRouter';
import { ROUTES } from './routes.config';

// =============================================================================
// ROUTER CHAIN
// =============================================================================

/**
 * Unified Router
 *
 * Tries routers in priority order until one matches.
 */
export class UnifiedRouter {
  private routers: Router[] = [];

  constructor() {
    // Initialize with pattern router (highest priority)
    this.routers.push(new PatternRouter());

    // TODO: Add semantic router
    // this.routers.push(new SemanticRouter());

    // Fallback is handled inline, not as a router
  }

  /**
   * Add a router to the chain
   */
  addRouter(router: Router): void {
    this.routers.push(router);
    // Keep sorted by priority (highest first)
    this.routers.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Match a message to a route
   *
   * Tries each router in priority order.
   * Returns fallback route if no router matches.
   */
  async match(
    text: string,
    context?: {
      userId?: string;
      conversationHistory?: string[];
      userProfile?: Record<string, unknown>;
    }
  ): Promise<RouteMatch> {
    const startTime = Date.now();
    const trimmed = text.trim();

    // Try each router in order
    for (const router of this.routers) {
      // Quick check if router can handle
      if (router.canHandle && !router.canHandle(trimmed)) {
        continue;
      }

      const match = await router.match(trimmed, context);
      if (match) {
        return {
          ...match,
          matchDurationMs: Date.now() - startTime,
        };
      }
    }

    // No router matched - return fallback
    return this.fallbackMatch(trimmed, startTime);
  }

  /**
   * Fallback match for unrecognized input
   *
   * Routes to semantic agent for LLM-based understanding.
   */
  private fallbackMatch(text: string, startTime: number): RouteMatch {
    const fallbackRoute = this.getFallbackRoute();

    return {
      route: fallbackRoute,
      matchType: 'fallback',
      confidence: 0.3,
      arguments: [text],
      params: { query: text },
      matchDurationMs: Date.now() - startTime,
    };
  }

  /**
   * Get fallback route (semantic/chat handler)
   */
  private getFallbackRoute(): Route {
    // Find semantic/chat route in config
    const semanticRoute = ROUTES.find(r => r.handler === 'semantic');
    if (semanticRoute) {
      return semanticRoute;
    }

    // Default fallback route
    return {
      id: 'fallback',
      handler: 'semantic',
      patterns: [],
      requiresAuth: false,
      requiresWallet: false,
      tier: 'free',
      description: 'Natural language understanding',
    };
  }

  /**
   * Get all available routes
   */
  getRoutes(): Route[] {
    return ROUTES.filter(r => r.enabled !== false);
  }

  /**
   * Get route by ID
   */
  getRoute(id: string): Route | undefined {
    return ROUTES.find(r => r.id === id);
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let routerInstance: UnifiedRouter | null = null;

/**
 * Get unified router instance
 */
export function getRouter(): UnifiedRouter {
  if (!routerInstance) {
    routerInstance = new UnifiedRouter();
  }
  return routerInstance;
}

/**
 * Match message to route (convenience function)
 */
export async function matchRoute(
  text: string,
  context?: {
    userId?: string;
    conversationHistory?: string[];
  }
): Promise<RouteMatch> {
  return getRouter().match(text, context);
}
