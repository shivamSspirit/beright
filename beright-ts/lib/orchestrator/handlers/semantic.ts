/**
 * Semantic Handler
 *
 * Fallback handler that uses LLM-based semantic understanding
 * for any message that doesn't match a specific command pattern.
 *
 * This wraps the existing semanticOrchestrator to work with
 * the new gateway-agnostic architecture.
 *
 * @see docs/ADR-002-TELEGRAM-AS-GATEWAY.md
 */

import {
  CommandHandler,
  CommandContext,
  CommandResult,
  Mood,
} from '../types';
import { orchestrate, OrchestratorResponse } from '../../semanticOrchestrator';
import { registerHandler } from './registry';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Semantic handler result
 */
export interface SemanticResult {
  text: string;
  mood: Mood;
  understanding?: {
    goal: string;
    domain: string;
    topic?: string;
    confidence: number;
  };
  agentUsed?: string;
  capabilityUsed?: string;
  data?: unknown;
}

// =============================================================================
// HANDLER
// =============================================================================

/**
 * Semantic Handler
 *
 * Uses LLM to understand natural language and generate responses.
 * This is the fallback when no pattern matches.
 */
export const semanticHandler: CommandHandler<SemanticResult> = {
  id: 'semantic',
  skillsUsed: ['llm', 'memory'],

  async execute(context: CommandContext): Promise<CommandResult<SemanticResult>> {
    const startTime = Date.now();

    try {
      // Get the original message text
      const messageText = context.message.text;

      // Use existing semantic orchestrator
      const response: OrchestratorResponse = await orchestrate(messageText, {
        chatId: context.message.chatId,
        userId: context.userId,
      });

      // Map mood from semantic orchestrator to our Mood type
      const mood = mapMood(response.mood);

      const result: SemanticResult = {
        text: response.text,
        mood,
        understanding: response.understanding
          ? {
              goal: response.understanding.goal,
              domain: response.understanding.domain,
              topic: response.understanding.topic,
              confidence: response.understanding.confidence,
            }
          : undefined,
        agentUsed: response.agentUsed,
        capabilityUsed: response.capabilityUsed,
        data: response.data,
      };

      return {
        success: true,
        data: result,
        meta: {
          handlerId: 'semantic',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['llm', 'memory'],
          apiCallsMade: 1,
        },
        hints: {
          mood,
        },
      };
    } catch (error) {
      console.error('[SemanticHandler] Error:', error);

      return {
        success: false,
        error: {
          code: 'SEMANTIC_ERROR',
          message: error instanceof Error ? error.message : 'Failed to process message',
          retryable: true,
          recoveryAction: 'Try rephrasing your question',
        },
        meta: {
          handlerId: 'semantic',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['llm'],
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
// HELPERS
// =============================================================================

/**
 * Map orchestrator mood to handler Mood type
 */
function mapMood(orchestratorMood: OrchestratorResponse['mood']): Mood {
  switch (orchestratorMood) {
    case 'BULLISH':
      return 'BULLISH';
    case 'BEARISH':
      return 'BEARISH';
    case 'EDUCATIONAL':
      return 'EDUCATIONAL';
    case 'ERROR':
      return 'ERROR';
    case 'NEUTRAL':
    default:
      return 'NEUTRAL';
  }
}

// =============================================================================
// AUTO-REGISTER
// =============================================================================

registerHandler(semanticHandler);

// =============================================================================
// EXPORTS
// =============================================================================

export default semanticHandler;
