/**
 * Semantic Orchestrator
 *
 * This is the brain of BeRight - it uses semantic understanding to:
 * 1. Understand ANY natural language input
 * 2. Route to the appropriate agent/skill
 * 3. Generate intelligent responses
 *
 * This replaces regex-based intent classification with true understanding.
 *
 * OpenClaw Pattern:
 * - Loads SOUL.md and IDENTITY.md as context
 * - Uses LLM to understand, not pattern match
 * - Routes to Scout/Analyst/Trader based on semantic understanding
 */

import {
  understand,
  routeToAgent,
  SemanticUnderstanding,
  UserGoal,
  Domain,
  RecommendedAgent,
  loadOpenClawContext,
  PREDICTION_MARKET_KNOWLEDGE,
} from './semanticAgent';
import { llmChat } from './llm';
import { spawnAgent, AgentTask } from './agentSpawner';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Cognitive Memory System
import {
  addToWorkingMemory,
  getConversationSummary,
  setCurrentTopic,
  recordEpisode,
  getUserProfile,
  updateUserPreferences,
  buildMemoryContext,
} from './cognitiveMemory';

// ============================================================================
// Types
// ============================================================================

export interface OrchestratorResponse {
  text: string;
  mood: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'EDUCATIONAL' | 'ERROR';
  data?: unknown;
  understanding?: SemanticUnderstanding;
  agentUsed?: RecommendedAgent;
}

export interface ConversationContext {
  chatId: string;
  userId: string;
  recentMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

// ============================================================================
// Main Orchestrator
// ============================================================================

/**
 * Process any user message with full semantic understanding
 *
 * This is the main entry point - call this instead of intent classification
 *
 * OpenClaw Pattern:
 * - Memory: Tracks conversation context and user preferences
 * - Understanding: LLM-based semantic analysis
 * - Routing: Intelligent agent selection
 * - Learning: Records episodes for future improvement
 */
export async function orchestrate(
  message: string,
  context?: ConversationContext
): Promise<OrchestratorResponse> {
  const startTime = Date.now();
  const chatId = context?.chatId || 'unknown';
  const userId = context?.userId;

  // Step 0: Record user message in working memory
  addToWorkingMemory(chatId, { role: 'user', content: message }, userId);

  // Step 0.5: Get user profile (tracks preferences over time)
  if (userId) {
    getUserProfile(userId);
  }

  // Step 1: Build context from memory
  const memoryContext = buildMemoryContext(chatId, userId);
  const conversationSummary = getConversationSummary(chatId) || memoryContext;

  // Step 2: Semantic Understanding (with memory context)
  const understanding = await understand(message, conversationSummary);

  // Track topic for future context
  if (understanding.topic) {
    setCurrentTopic(chatId, understanding.topic);

    // Update user preferences
    if (userId) {
      updateUserPreferences(userId, {
        preferredTopics: [understanding.topic],
      });
    }
  }

  // Step 3: Quick responses for trivial cases
  if (understanding.canAnswerDirectly && understanding.directAnswer) {
    console.log(`[Orchestrator] Direct answer for: "${message.slice(0, 30)}..."`);

    // Record in memory
    addToWorkingMemory(chatId, { role: 'assistant', content: understanding.directAnswer });

    return {
      text: understanding.directAnswer,
      mood: 'NEUTRAL',
      understanding,
      agentUsed: 'SELF',
    };
  }

  // Step 4: Route to appropriate handler
  const routing = routeToAgent(understanding);

  console.log(`[Orchestrator] Routing: ${routing.primary}${routing.secondary ? ` → ${routing.secondary}` : ''} with skills: [${routing.skills.join(', ')}]`);

  // Step 5: Execute based on routing
  let response: OrchestratorResponse;

  switch (routing.primary) {
    case 'SELF':
      response = await handleSelf(understanding, message);
      break;

    case 'SCOUT':
      response = await handleScout(understanding, message, routing.skills);
      break;

    case 'ANALYST':
      response = await handleAnalyst(understanding, message, routing.skills);
      break;

    case 'TRADER':
      response = await handleTrader(understanding, message, routing.skills);
      break;

    case 'HYBRID':
      response = await handleHybrid(understanding, message, routing);
      break;

    default:
      response = await handleUnknown(understanding, message);
  }

  const elapsed = Date.now() - startTime;
  console.log(`[Orchestrator] Completed in ${elapsed}ms`);

  // Step 6: Record response in working memory
  addToWorkingMemory(chatId, { role: 'assistant', content: response.text });

  // Step 7: Record episode for learning
  recordEpisode({
    userId,
    chatId,
    trigger: message,
    action: `Routed to ${routing.primary} agent`,
    outcome: response.text.slice(0, 200),
    intent: understanding.goal,
    agent: routing.primary,
    skills: routing.skills,
    success: response.mood !== 'ERROR',
    confidence: understanding.confidence,
    tags: [understanding.domain, understanding.topic].filter(Boolean) as string[],
  });

  return {
    ...response,
    understanding,
    agentUsed: routing.primary,
  };
}

// ============================================================================
// Agent Handlers
// ============================================================================

/**
 * BeRight handles directly (meta questions, help, etc.)
 */
async function handleSelf(
  understanding: SemanticUnderstanding,
  message: string
): Promise<OrchestratorResponse> {
  const context = loadOpenClawContext();

  // Generate response using SOUL.md personality
  const response = await llmChat({
    system: `You are BeRight, a prediction market intelligence agent.

${context.soul}

Respond to this message in BeRight's voice: direct, knowledgeable, no fluff.
Keep response concise but helpful.`,
    user: `User message: "${message}"
Understanding: ${understanding.interpretation}`,
    maxTokens: 300,
    temperature: 0.7,
    quality: 'fast',
  });

  if (response.provider === 'none') {
    return {
      text: "I can help with prediction market intelligence. Try /hot for trending markets or ask me about any topic.",
      mood: 'NEUTRAL',
    };
  }

  return {
    text: response.text,
    mood: 'NEUTRAL',
  };
}

/**
 * Scout agent - fast scanning, data retrieval
 */
async function handleScout(
  understanding: SemanticUnderstanding,
  message: string,
  skills: string[]
): Promise<OrchestratorResponse> {
  // Build agent task using correct AgentTask interface
  const task: AgentTask = {
    agentId: 'scout',
    task: `${understanding.interpretation}. Topic: ${understanding.topic || 'general'}. Skills to use: ${skills.join(', ')}`,
    context: {
      userId: undefined,
      username: undefined,
    },
  };

  try {
    const result = await spawnAgent(task);

    return {
      text: result.response?.text || 'No data found.',
      mood: mapMood(result.response?.mood),
      data: result.response?.data,
    };
  } catch (error) {
    console.error('[Orchestrator] Scout error:', error);
    return {
      text: "Couldn't fetch market data right now. Try again in a moment.",
      mood: 'ERROR',
    };
  }
}

/**
 * Analyst agent - deep reasoning, synthesis
 */
async function handleAnalyst(
  understanding: SemanticUnderstanding,
  message: string,
  skills: string[]
): Promise<OrchestratorResponse> {
  const task: AgentTask = {
    agentId: 'analyst',
    task: `${understanding.interpretation}. Topic: ${understanding.topic || message}. Approach: ${understanding.suggestedApproach}`,
    context: {
      userId: undefined,
      username: undefined,
    },
  };

  try {
    const result = await spawnAgent(task);

    return {
      text: result.response?.text || 'Analysis complete but no insights generated.',
      mood: mapMood(result.response?.mood),
      data: result.response?.data,
    };
  } catch (error) {
    console.error('[Orchestrator] Analyst error:', error);
    return {
      text: "Deep analysis unavailable right now. Try a simpler query or /hot for trending markets.",
      mood: 'ERROR',
    };
  }
}

/**
 * Trader agent - execution, quotes
 */
async function handleTrader(
  understanding: SemanticUnderstanding,
  message: string,
  skills: string[]
): Promise<OrchestratorResponse> {
  const task: AgentTask = {
    agentId: 'trader',
    task: `${understanding.interpretation}. Topic: ${understanding.topic || message}`,
    context: {
      userId: undefined,
      username: undefined,
    },
  };

  try {
    const result = await spawnAgent(task);

    return {
      text: result.response?.text || 'Trade information unavailable.',
      mood: mapMood(result.response?.mood),
      data: result.response?.data,
    };
  } catch (error) {
    console.error('[Orchestrator] Trader error:', error);
    return {
      text: "Trading functions unavailable right now.",
      mood: 'ERROR',
    };
  }
}

/**
 * Hybrid - Scout first for data, then Analyst for reasoning
 */
async function handleHybrid(
  understanding: SemanticUnderstanding,
  message: string,
  routing: { primary: RecommendedAgent; secondary?: RecommendedAgent; skills: string[] }
): Promise<OrchestratorResponse> {
  // Phase 1: Scout gathers data
  const scoutTask: AgentTask = {
    agentId: 'scout',
    task: `Gather data for: ${understanding.interpretation}. Topic: ${understanding.topic || 'general'}`,
    context: {
      userId: undefined,
      username: undefined,
    },
  };

  let scoutData: unknown = null;
  try {
    const scoutResult = await spawnAgent(scoutTask);
    scoutData = scoutResult.response?.data;
  } catch (error) {
    console.warn('[Orchestrator] Scout phase failed, proceeding with Analyst');
  }

  // Phase 2: Analyst reasons about data
  const analystTask: AgentTask = {
    agentId: 'analyst',
    task: `${understanding.interpretation}. Topic: ${understanding.topic || message}. Approach: ${understanding.suggestedApproach}. Scout data available: ${scoutData ? 'yes' : 'no'}`,
    context: {
      userId: undefined,
      username: undefined,
    },
  };

  try {
    const analystResult = await spawnAgent(analystTask);

    return {
      text: analystResult.response?.text || 'Analysis complete.',
      mood: mapMood(analystResult.response?.mood),
      data: { scoutData, analysis: analystResult.response?.data },
    };
  } catch (error) {
    console.error('[Orchestrator] Analyst phase failed:', error);
    return {
      text: "Couldn't complete analysis. Try /hot for trending markets.",
      mood: 'ERROR',
    };
  }
}

/**
 * Unknown - try to be helpful anyway
 */
async function handleUnknown(
  understanding: SemanticUnderstanding,
  message: string
): Promise<OrchestratorResponse> {
  const context = loadOpenClawContext();

  // Use LLM to generate helpful response even for unclear intents
  const response = await llmChat({
    system: `You are BeRight, a prediction market intelligence agent.

${context.soul}

The user's intent was unclear. Try to be helpful.
If they seem to want market data, suggest /hot or /arb.
If they have a specific topic, offer to research it.
Keep response concise and in BeRight's direct voice.`,
    user: `User message: "${message}"
My interpretation: ${understanding.interpretation}
Ambiguities: ${understanding.ambiguities?.join(', ') || 'none detected'}`,
    maxTokens: 200,
    temperature: 0.7,
    quality: 'fast',
  });

  if (response.provider === 'none') {
    return {
      text: `Wasn't sure what you meant. Try:
• /hot — Trending markets
• /arb — Price gaps across platforms
• /research <topic> — Deep analysis

Or just tell me what market you're curious about.`,
      mood: 'NEUTRAL',
    };
  }

  return {
    text: response.text,
    mood: 'NEUTRAL',
  };
}

// ============================================================================
// Utilities
// ============================================================================

function mapMood(mood?: string): OrchestratorResponse['mood'] {
  if (!mood) return 'NEUTRAL';
  const upper = mood.toUpperCase();
  if (upper === 'BULLISH') return 'BULLISH';
  if (upper === 'BEARISH') return 'BEARISH';
  if (upper === 'EDUCATIONAL') return 'EDUCATIONAL';
  if (upper === 'ERROR') return 'ERROR';
  return 'NEUTRAL';
}

// ============================================================================
// Legacy Adapter
// ============================================================================

/**
 * Map semantic understanding to legacy SmartIntent format
 * Use this for gradual migration - keeps existing switch statements working
 */
export function toLegacyIntent(understanding: SemanticUnderstanding): {
  intent: string;
  confidence: number;
  topic?: string;
  reasoning: string;
  suggestedAction?: string;
} {
  // Map goal + domain to legacy intents
  let intent: string;

  if (understanding.goal === 'CONVERSE' && understanding.domain === 'META') {
    intent = 'GREETING';
  } else if (understanding.goal === 'LEARN') {
    intent = 'HELP';
  } else if (understanding.goal === 'DISCOVER_OPPORTUNITIES') {
    if (understanding.interpretation.toLowerCase().includes('arb')) {
      intent = 'ARBITRAGE';
    } else {
      intent = 'TRENDING';
    }
  } else if (understanding.goal === 'GET_INFORMATION') {
    if (understanding.domain === 'META') {
      intent = 'PLATFORM_INFO';
    } else if (understanding.topic) {
      intent = 'PRICE_CHECK';
    } else {
      intent = 'BROWSE_MARKETS';
    }
  } else if (understanding.goal === 'GET_ANALYSIS') {
    intent = 'MARKET_ANALYSIS';
  } else if (understanding.goal === 'TAKE_ACTION') {
    intent = 'PREDICTION';
  } else {
    intent = 'UNKNOWN';
  }

  return {
    intent,
    confidence: understanding.confidence,
    topic: understanding.topic,
    reasoning: understanding.interpretation,
    suggestedAction: understanding.suggestedApproach,
  };
}

// ============================================================================
// Exports
// ============================================================================

// Function exports
export { understand };

// Type re-exports (using 'export type' for isolatedModules compatibility)
export type { SemanticUnderstanding, UserGoal, Domain, RecommendedAgent };

export default orchestrate;
