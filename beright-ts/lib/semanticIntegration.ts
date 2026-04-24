/**
 * Semantic Integration
 *
 * Drop-in replacement for the regex-based intent classifier.
 * This file provides a migration path from the old system to the new semantic agent.
 *
 * Usage in the legacy Telegram flow:
 *
 * BEFORE:
 * ```typescript
 * import { classifyIntentSmart } from '../lib/smartIntentClassifier';
 * const smartIntent = await classifyIntentSmart(text);
 * ```
 *
 * AFTER:
 * ```typescript
 * import { processMessage } from '../lib/semanticIntegration';
 * const result = await processMessage(text, chatId, userId);
 * // result.response is ready to send
 * // OR use result.legacyIntent to keep existing switch statements
 * ```
 */

import orchestrate, {
  toLegacyIntent,
  OrchestratorResponse,
  SemanticUnderstanding,
} from './semanticOrchestrator';

// ============================================================================
// Types
// ============================================================================

export interface ProcessResult {
  // The full response (ready to send)
  response: OrchestratorResponse;

  // Legacy format (for gradual migration)
  legacyIntent: {
    intent: string;
    confidence: number;
    topic?: string;
    reasoning: string;
    suggestedAction?: string;
  };

  // Full understanding (for debugging/logging)
  understanding: SemanticUnderstanding;

  // Processing metadata
  processingTimeMs: number;
}

// ============================================================================
// Main Integration Function
// ============================================================================

/**
 * Process a user message with full semantic understanding
 *
 * This is the main function to call from telegramHandler.
 * It returns everything you need:
 * - Ready-to-send response
 * - Legacy intent format (for existing switch statements)
 * - Full understanding (for logging)
 */
export async function processMessage(
  text: string,
  chatId: string,
  userId?: string,
  username?: string // Wallet pubkey when from gateway
): Promise<ProcessResult> {
  const startTime = Date.now();

  // Run semantic orchestration
  const response = await orchestrate(text, {
    chatId,
    userId: userId || 'anonymous',
    username, // Pass wallet pubkey for trading context
  });

  // Extract understanding
  const understanding = response.understanding!;

  // Generate legacy intent format
  const legacyIntent = toLegacyIntent(understanding);

  const processingTimeMs = Date.now() - startTime;

  console.log(`[SemanticIntegration] Processed in ${processingTimeMs}ms: "${text.slice(0, 30)}..." → ${understanding.goal}/${understanding.recommendedAgent}`);

  return {
    response,
    legacyIntent,
    understanding,
    processingTimeMs,
  };
}

/**
 * Quick check if we should use semantic processing
 * (vs. explicit commands like /help, /hot, etc.)
 */
export function shouldUseSemanticProcessing(text: string): boolean {
  // Explicit commands bypass semantic processing
  if (text.trim().startsWith('/')) {
    return false;
  }
  return true;
}

/**
 * Get a simple response without full orchestration
 * (for very simple cases like pure greetings)
 */
export function getQuickResponse(text: string): OrchestratorResponse | null {
  const lower = text.toLowerCase().trim();

  // Pure greetings
  if (/^(hi|hey|hello|gm|gn|yo|sup)[\s!.,?]*$/i.test(lower)) {
    return {
      text: "Hey. What markets are you watching?",
      mood: 'NEUTRAL',
    };
  }

  // Pure acknowledgments
  if (/^(ok|okay|thanks|ty|thx|cool|nice|got it)[\s!.,]*$/i.test(lower)) {
    return {
      text: "👍",
      mood: 'NEUTRAL',
    };
  }

  return null;
}

// ============================================================================
// Migration Helper
// ============================================================================

/**
 * Example of how to migrate existing switch statements
 *
 * BEFORE:
 * ```typescript
 * switch (smartIntent.intent) {
 *   case 'MARKET_ANALYSIS':
 *     return await research(smartIntent.topic || text);
 *   case 'TRENDING':
 *     return await getHotMarkets();
 *   // ... etc
 * }
 * ```
 *
 * AFTER (Option 1 - Full migration):
 * ```typescript
 * const result = await processMessage(text, chatId, userId);
 * return { text: result.response.text, mood: result.response.mood };
 * ```
 *
 * AFTER (Option 2 - Gradual migration):
 * ```typescript
 * const result = await processMessage(text, chatId, userId);
 * switch (result.legacyIntent.intent) {
 *   case 'MARKET_ANALYSIS':
 *     return await research(result.legacyIntent.topic || text);
 *   // ... keep existing code
 * }
 * ```
 */

// ============================================================================
// Exports
// ============================================================================

// Function exports
export { orchestrate, toLegacyIntent };

// Type re-exports (using 'export type' for isolatedModules compatibility)
export type { OrchestratorResponse, SemanticUnderstanding };

export default processMessage;
