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
  | 'MARKET_ANALYSIS'    // Analyze a specific market/event
  | 'PRICE_CHECK'        // What are the odds on X
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
  topic?: string;           // Extracted topic/market/question
  reasoning: string;        // Why this intent
  suggestedAction?: string; // What to do
}

const CLASSIFIER_PROMPT = `You are an intent classifier for BeRight, a prediction market intelligence agent.

BeRight tracks: Polymarket, Kalshi, Manifold, Metaculus, Limitless.

Classify the user's message into ONE intent:

PLATFORM_INFO - Questions about platforms (how many, which ones, list them, what is Polymarket)
MARKET_ANALYSIS - Wants analysis on a specific topic/event (will X happen, what do you think about Y)
PRICE_CHECK - Wants current odds/prices on something
ARBITRAGE - Looking for price discrepancies, spreads, arb opportunities
TRENDING - What's hot, trending, moving, popular markets
WHALE_ACTIVITY - Smart money, big bets, whale movements
PREDICTION - User wants to make/record a prediction
HELP - How to use, what can you do, commands
GREETING - Hello, hi, gm (just greeting, nothing else)
GENERAL_CHAT - Conversational but not about prediction markets
UNKNOWN - Can't determine

Respond ONLY with JSON:
{
  "intent": "INTENT_NAME",
  "confidence": 0.0-1.0,
  "topic": "extracted topic if any",
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
