/**
 * Handler Registry
 *
 * Central registry for all command handlers.
 * Handlers register themselves here and are auto-loaded by the orchestrator.
 *
 * @see docs/ADR-002-TELEGRAM-AS-GATEWAY.md
 */

import { CommandHandler } from '../types';
import { getOrchestrator } from '../orchestrator';

// =============================================================================
// HANDLER REGISTRY
// =============================================================================

/**
 * Map of handler ID to handler instance
 */
const handlers: Map<string, CommandHandler> = new Map();

/**
 * Register a handler
 */
export function registerHandler(handler: CommandHandler): void {
  handlers.set(handler.id, handler);
  console.log(`[HandlerRegistry] Registered: ${handler.id}`);
}

/**
 * Get a handler by ID
 */
export function getHandler(id: string): CommandHandler | undefined {
  return handlers.get(id);
}

/**
 * Get all registered handlers
 */
export function getAllHandlers(): CommandHandler[] {
  return Array.from(handlers.values());
}

/**
 * Check if handler exists
 */
export function hasHandler(id: string): boolean {
  return handlers.has(id);
}

// =============================================================================
// AUTO-REGISTRATION
// =============================================================================

/**
 * Sync registered handlers to orchestrator
 *
 * Call this after all handler modules have been imported.
 */
export function syncToOrchestrator(): void {
  const orchestrator = getOrchestrator();
  for (const handler of handlers.values()) {
    orchestrator.registerHandler(handler);
  }
  console.log(`[HandlerRegistry] Synced ${handlers.size} handlers to orchestrator`);
}

// =============================================================================
// HANDLER DECORATOR (Alternative registration pattern)
// =============================================================================

/**
 * Decorator to auto-register a handler
 *
 * Usage:
 * ```typescript
 * @Handler
 * export const myHandler: CommandHandler = { ... }
 * ```
 */
export function Handler<T extends CommandHandler>(handler: T): T {
  registerHandler(handler);
  return handler;
}
