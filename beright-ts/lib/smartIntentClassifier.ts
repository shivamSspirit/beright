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
1. ONLY set "topic" if user mentions a SPECIFIC topic (bitcoin, trump, fed, etc). Do NOT extract generic words like "markets", "link", "platform".
2. NEVER set "topic" to the full user message or a question. Topics are SHORT (1-3 words max): "bitcoin", "trump", "fed rates".
3. If the query is vague/general/a question, classify appropriately but set topic to null.
4. MARKET_ANALYSIS requires a CLEAR, SPECIFIC topic. "link of markets" has no topic.
5. Questions about "how many" platforms or "which" platforms → PLATFORM_INFO, topic: null
6. IMPORTANT: "best markets", "good markets", "hot markets", "top markets" = TRENDING (user wants recommendations)
7. Market requests with time constraints ("closing soon", "expiring", "ending today") = TRENDING

INTENTS (pick ONE):

TRENDING - User wants what's hot, popular, best, top, or time-sensitive markets
  Examples: "what's hot", "trending", "popular markets", "what's moving"
  ALSO: "find me best markets", "show me top markets", "good markets", "best bets"
  ALSO: "markets closing soon", "expiring today", "ending soon", "closing in one day"
  ALSO: "find me hot markets", "give me your best picks", "what should I bet on"
BROWSE_MARKETS - User wants to see/browse/list available markets, but NO specific topic and NO quality preference
  Examples: "show me markets", "link of markets", "list markets", "markets available", "what markets", "any markets"
  NOTE: If they say "best" or "hot" or "top" → use TRENDING instead
PLATFORM_INFO - Questions about platforms, chains, infrastructure
  Examples: "how many platforms", "which platforms", "what is Polymarket", "platforms on Solana"
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

  // Try fast pattern matching first (no LLM needed)
  const fastResult = fastPatternMatch(message);
  if (fastResult) {
    console.log(`[SmartIntent] Fast match: "${message.slice(0, 30)}..." → ${fastResult.intent}`);
    return fastResult;
  }

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

/**
 * Fast pattern matching for common queries (skip LLM for speed)
 * Returns null if no obvious match, otherwise returns the intent
 */
export function fastPatternMatch(message: string): SmartIntentResult | null {
  const lower = message.toLowerCase().trim();

  // TRENDING patterns - user wants best/hot/top markets
  const trendingPatterns = [
    /\b(best|top|hot|trending|popular|good)\s*(market|bet|pick|trade)/i,
    /\b(find|show|give|get|send)\s*(me\s*)?(the\s*)?(best|top|hot|good)/i,
    /\bwhat('s| is| are)?\s*(hot|trending|best|top)/i,
    /\b(closing|expiring|ending)\s*(soon|today|tomorrow|in\s+\d+)/i,
    /\bmarkets?\s*(closing|expiring|ending)/i,
    /\bwhat\s+should\s+i\s+(bet|buy|trade)/i,
    /\b(recommend|suggestion|pick)/i,
  ];

  for (const pattern of trendingPatterns) {
    if (pattern.test(lower)) {
      return {
        intent: 'TRENDING',
        confidence: 0.9,
        reasoning: 'Fast pattern match: trending/best markets request',
      };
    }
  }

  // BROWSE_MARKETS patterns - user wants to see/browse markets (general)
  const browsePatterns = [
    /\b(show|send|give|get)\s*(me\s*)?(the\s*)?(market|markets)/i,
    /\b(market|markets)\s*(link|url|page)/i,
    /\b(link|url)\s*(to|for|of)\s*(market|markets)/i,
    /^(market|markets)s?$/i,
    /\bsend\s*markets?/i,
    /\bgive\s*(me\s*)?markets?/i,
    /\bshow\s*(me\s*)?markets?/i,
    /\bwhere\s*(can\s+i|to)\s*(see|find|browse)\s*markets?/i,
  ];

  for (const pattern of browsePatterns) {
    if (pattern.test(lower)) {
      return {
        intent: 'BROWSE_MARKETS',
        confidence: 0.9,
        reasoning: 'Fast pattern match: browse markets request',
      };
    }
  }

  // ARBITRAGE patterns
  if (/\b(arb|arbitrage|spread|mispriced|price\s*gap)/i.test(lower)) {
    return {
      intent: 'ARBITRAGE',
      confidence: 0.9,
      reasoning: 'Fast pattern match: arbitrage request',
    };
  }

  // HELP patterns
  if (/^(help|commands?|what\s+can\s+you|how\s+do\s+i|how\s+to)[\s?]*$/i.test(lower)) {
    return {
      intent: 'HELP',
      confidence: 0.9,
      reasoning: 'Fast pattern match: help request',
    };
  }

  // Simple affirmations like "ok", "yes", "no" - treat as UNKNOWN to avoid confusion
  if (/^(ok|okay|yes|no|sure|thanks|ty|thx|cool|nice|great)[\s!.]*$/i.test(lower)) {
    return {
      intent: 'GREETING',
      confidence: 0.7,
      reasoning: 'Fast pattern match: simple acknowledgment',
    };
  }

  return null; // No fast match, use LLM
}

export default {
  classifyIntentSmart,
  isExplicitCommand,
  isObviousGreeting,
  fastPatternMatch,
};
