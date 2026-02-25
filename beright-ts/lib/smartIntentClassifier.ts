/**
 * Smart Intent Classifier - LLM-powered understanding
 *
 * Uses Groq (llama-3.1-8b-instant) to actually UNDERSTAND user intent
 * instead of brittle regex patterns.
 *
 * Fast (~200ms) and cheap (free tier).
 */

import { llmChat } from './llm';

export type SmartIntent =
  | 'PLATFORM_INFO'      // Questions about platforms, how many, which ones
  | 'BROWSE_MARKETS'     // User wants to see/browse/list markets (no specific topic)
  | 'MARKET_ANALYSIS'    // Analyze a specific topic/event (requires clear topic)
  | 'PRICE_CHECK'        // What are the odds on X (requires clear topic)
  | 'ARBITRAGE'          // Find arb/spreads
  | 'TRENDING'           // What's hot/moving
  | 'WHALE_ACTIVITY'     // Smart money movements
  | 'PREDICTION'         // User wants to make a prediction
  | 'HELP'               // How to use, what can you do
  | 'GREETING'           // Hi, hello
  | 'GENERAL_CHAT'       // Conversational, not market-related
  | 'UNKNOWN';

export interface SmartIntentResult {
  intent: SmartIntent;
  confidence: number;
  topic?: string;           // Extracted topic/market/question (only if clear)
  reasoning: string;        // Why this intent
  suggestedAction?: string; // What to do
}

const CLASSIFIER_PROMPT = `You are an intent classifier for BeRight, a prediction market intelligence agent.

BeRight tracks: Polymarket, Kalshi, Manifold, Metaculus, Limitless.

CRITICAL RULES:
1. ONLY set "topic" if user mentions a SPECIFIC topic (bitcoin, trump, fed, etc). Do NOT extract generic words like "markets" or "link".
2. If the query is vague/general, classify as BROWSE_MARKETS or TRENDING, NOT as a search.
3. MARKET_ANALYSIS requires a CLEAR, SPECIFIC topic. "link of markets" has no topic.

INTENTS (pick ONE):

PLATFORM_INFO - Questions about platforms (how many platforms, which ones do you track, what is Polymarket)
BROWSE_MARKETS - User wants to see/browse/list available markets, but NO specific topic
  Examples: "show me markets", "link of markets", "list markets", "markets available", "what markets", "any markets"
TRENDING - User wants what's hot, popular, moving, trending right now
  Examples: "what's hot", "trending", "popular markets", "what's moving"
MARKET_ANALYSIS - User wants analysis on a SPECIFIC named topic/event
  Examples: "analyze bitcoin", "what about trump winning", "fed rate analysis"
  REQUIRES: A clear topic like bitcoin, trump, elections, fed, etc.
PRICE_CHECK - User wants current odds/prices on a SPECIFIC topic
  Examples: "odds on bitcoin 100k", "what's the price of trump winning"
ARBITRAGE - Looking for arbitrage, price gaps, spreads across platforms
WHALE_ACTIVITY - Smart money, big bets, whale movements
PREDICTION - User wants to make/record their own prediction
HELP - How to use BeRight, what can you do, commands, capabilities
GREETING - Just a greeting (hi, hello, gm, hey) with nothing else
GENERAL_CHAT - Conversational but NOT about prediction markets
UNKNOWN - Only if truly unclassifiable

Respond ONLY with valid JSON:
{
  "intent": "INTENT_NAME",
  "confidence": 0.0-1.0,
  "topic": "only if SPECIFIC topic mentioned, otherwise null",
  "reasoning": "brief explanation",
  "suggestedAction": "what BeRight should do"
}`;

/**
 * Classify intent using LLM (Groq)
 */
export async function classifyIntentSmart(message: string): Promise<SmartIntentResult> {
  const startTime = Date.now();

  try {
    const response = await llmChat({
      system: CLASSIFIER_PROMPT,
      user: `User message: "${message}"`,
      maxTokens: 200,
      temperature: 0.1, // Very deterministic
      quality: 'fast',  // llama-3.1-8b-instant
    });

    // Check if LLM available
    if (response.provider === 'none') {
      console.warn('[SmartIntent] No LLM, falling back to UNKNOWN');
      return {
        intent: 'UNKNOWN',
        confidence: 0.5,
        reasoning: 'LLM not available',
      };
    }

    // Parse JSON
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[SmartIntent] No JSON in response');
      return {
        intent: 'UNKNOWN',
        confidence: 0.5,
        reasoning: 'Failed to parse LLM response',
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const elapsed = Date.now() - startTime;
    console.log(`[SmartIntent] "${message.slice(0, 30)}..." → ${parsed.intent} (${Math.round(parsed.confidence * 100)}%) in ${elapsed}ms`);

    return {
      intent: parsed.intent || 'UNKNOWN',
      confidence: parsed.confidence || 0.5,
      topic: parsed.topic,
      reasoning: parsed.reasoning || '',
      suggestedAction: parsed.suggestedAction,
    };
  } catch (error) {
    console.error('[SmartIntent] Error:', error);
    return {
      intent: 'UNKNOWN',
      confidence: 0.3,
      reasoning: `Error: ${error instanceof Error ? error.message : 'unknown'}`,
    };
  }
}

/**
 * Quick check if message is obviously a command (skip LLM)
 */
export function isExplicitCommand(message: string): boolean {
  return message.trim().startsWith('/');
}

/**
 * Quick check if message is obviously a greeting (skip LLM)
 */
export function isObviousGreeting(message: string): boolean {
  const greetings = /^(hi|hey|hello|gm|gn|yo|sup|hola)[\s!.,]*$/i;
  return greetings.test(message.trim());
}

export default {
  classifyIntentSmart,
  isExplicitCommand,
  isObviousGreeting,
};
