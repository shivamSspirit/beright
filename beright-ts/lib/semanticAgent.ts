/**
 * Semantic Understanding Agent
 *
 * This is the "brain" of BeRight - an LLM-powered runtime component that:
 * 1. Understands ANY natural language input
 * 2. Has deep knowledge of prediction markets
 * 3. Reasons about user intent semantically (no regex)
 * 4. Routes to appropriate internal specialist capabilities
 *
 * OpenClaw Architecture:
 * - SOUL.md defines personality and methodology
 * - IDENTITY.md defines capabilities and structure
 * - This file injects both as context for every understanding task
 */

import { llmChat } from './llm';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ============================================================================
// Domain Knowledge
// ============================================================================

/**
 * Deep prediction market knowledge base
 * This is injected into every LLM call to give semantic understanding
 */
const PREDICTION_MARKET_KNOWLEDGE = `
## Prediction Market Ecosystem

### Major Platforms

**Polymarket** (polymarket.com)
- Crypto-native, largest by volume
- USDC on Polygon
- Strengths: Liquidity, real-time data, whale activity visible
- Common topics: Politics, crypto prices, sports, current events
- Key metric: Volume, open interest

**Kalshi** (kalshi.com)
- CFTC-regulated, US-based
- Real money (USD), legally compliant
- Strengths: Regulatory clarity, institutional participation
- Common topics: Economic indicators, weather, Fed rates, elections
- Key metric: Contract prices (0-100 cents = 0-100% probability)

**Manifold** (manifold.markets)
- Play money (Mana), social/fun
- Anyone can create markets
- Strengths: Long-tail markets, rapid creation, experiential learning
- Common topics: Anything - tech, culture, personal bets
- Key metric: Volume, trader count

**Metaculus** (metaculus.com)
- Forecasting platform, no real money
- Expert-focused, calibration-tracked
- Strengths: Scientific questions, long-term forecasts
- Common topics: AI timelines, climate, science
- Key metric: Community prediction, Metaculus prediction

### Key Concepts

**Probability vs Odds**
- Probability: 0-100% chance of outcome
- Market price often equals implied probability
- Polymarket: YES price = implied probability (0.65 = 65%)
- Kalshi: Contract price in cents = probability (65¢ = 65%)

**Arbitrage**
- Same question priced differently across platforms
- Example: Trump 55% on Polymarket, 52% on Kalshi = 3% spread
- "Arbing" = buying cheap YES, selling expensive YES
- Complications: Fees, liquidity, settlement differences

**Whale Tracking**
- Large traders often have information edge
- Watching big bets can signal market moves
- "Smart money" = consistently profitable traders

**Calibration**
- How accurate forecasts are over time
- Perfect: When you say 70%, you're right 70% of the time
- Brier Score: 0 = perfect, 0.25 = random, lower is better
- Track record matters more than any single prediction

**Base Rates**
- Historical frequency of similar events
- Example: "How often do incumbent presidents win re-election?"
- Outside view: Start with base rate, then adjust for specifics
- Most forecasting errors come from ignoring base rates

### Common User Intents

**Information Seeking**
- "What are the odds on X?" → Want current market prices
- "Why is X priced at Y?" → Want reasoning/analysis
- "Where can I trade X?" → Want platform comparison

**Analysis Requests**
- "What do you think about X?" → Want reasoned opinion
- "Is the market wrong on X?" → Want contrarian analysis
- "Compare X across platforms" → Want arbitrage/spread info

**Discovery**
- "What's hot?" → Want trending markets
- "Any arb opportunities?" → Want spread detection
- "What's moving?" → Want volume/momentum

**Action**
- "I want to bet on X" → Want trade guidance
- "Track my prediction" → Want to record forecast
- "Alert me when X" → Want notifications

**Learning**
- "How does X work?" → Want educational content
- "What is base rate?" → Want concept explanation
- "Teach me forecasting" → Want methodology

### Edge Cases & Nuance

- "I think market is wrong" could mean:
  - User has alpha (info the market doesn't)
  - User misunderstands market
  - User wants debate/pushback

- "What about Trump?" could mean:
  - What are current odds?
  - What do you think will happen?
  - News about Trump?
  - Markets involving Trump?

- "Find me alpha" could mean:
  - Arbitrage opportunities
  - Mispriced markets
  - Information edge
  - Any profitable opportunity
`;

// ============================================================================
// OpenClaw Context Loader
// ============================================================================

interface OpenClawContext {
  soul: string;
  identity: string;
  loaded: boolean;
}

let cachedContext: OpenClawContext | null = null;

/**
 * Load SOUL.md and IDENTITY.md as context
 */
function loadOpenClawContext(): OpenClawContext {
  if (cachedContext) return cachedContext;

  const workspaceRoot = join(process.cwd());

  let soul = '';
  let identity = '';

  // Try to load SOUL.md
  const soulPath = join(workspaceRoot, 'SOUL.md');
  if (existsSync(soulPath)) {
    soul = readFileSync(soulPath, 'utf-8');
  }

  // Try to load IDENTITY.md
  const identityPath = join(workspaceRoot, 'IDENTITY.md');
  if (existsSync(identityPath)) {
    identity = readFileSync(identityPath, 'utf-8');
  }

  cachedContext = { soul, identity, loaded: !!(soul && identity) };

  if (!cachedContext.loaded) {
    console.warn('[SemanticAgent] Warning: Could not load SOUL.md or IDENTITY.md');
  }

  return cachedContext;
}

// ============================================================================
// Semantic Understanding Types
// ============================================================================

/**
 * What the user fundamentally wants to accomplish
 */
export type UserGoal =
  | 'GET_INFORMATION'      // Want to know something
  | 'GET_ANALYSIS'         // Want reasoned opinion/synthesis
  | 'DISCOVER_OPPORTUNITIES' // Find markets, arbs, trends
  | 'TAKE_ACTION'          // Trade, predict, alert
  | 'LEARN'                // Educational, how things work
  | 'CONVERSE'             // Social, chat, banter
  | 'UNCLEAR';             // Genuinely ambiguous

/**
 * The domain the request belongs to
 */
export type Domain =
  | 'PREDICTION_MARKETS'   // Core domain
  | 'CRYPTO'               // Crypto-related
  | 'POLITICS'             // Political events
  | 'ECONOMICS'            // Fed, inflation, economic data
  | 'SPORTS'               // Sports betting/prediction
  | 'GENERAL'              // Non-market questions
  | 'META';                // Questions about BeRight itself

/**
 * Which specialist agent should handle this
 */
export type RecommendedAgent =
  | 'SCOUT'      // Fast scanning, data retrieval, trending
  | 'ANALYST'    // Deep reasoning, synthesis, probability
  | 'TRADER'     // Execution, quotes, positions
  | 'SELF'       // BeRight answers directly (meta, help)
  | 'HYBRID';    // Needs multiple agents

/**
 * Full semantic understanding of user input
 */
export interface SemanticUnderstanding {
  // Core understanding
  goal: UserGoal;
  domain: Domain;

  // Extracted entities
  topic?: string;           // Main subject (e.g., "bitcoin", "trump 2024")
  platforms?: string[];     // Mentioned platforms (e.g., ["polymarket", "kalshi"])
  timeframe?: string;       // Time context (e.g., "today", "by end of year")

  // Reasoning
  interpretation: string;   // How we understood the message
  confidence: number;       // 0-1 how confident in this understanding
  ambiguities?: string[];   // What's unclear that we assumed

  // Routing
  recommendedAgent: RecommendedAgent;
  agentReasoning: string;   // Why this agent

  // Suggested approach
  suggestedApproach: string; // What BeRight should do

  // Quick responses (for simple cases)
  canAnswerDirectly: boolean;
  directAnswer?: string;    // If trivial, answer here
}

// ============================================================================
// Semantic Understanding Engine
// ============================================================================

/**
 * Build the system prompt for semantic understanding
 */
function buildUnderstandingPrompt(): string {
  const context = loadOpenClawContext();

  return `You are the semantic understanding engine for BeRight, a prediction market intelligence agent.

Your job is to DEEPLY UNDERSTAND what users mean, not pattern match on keywords.

${context.loaded ? `
## Your Personality (from SOUL.md)
${context.soul}

## Your Identity (from IDENTITY.md)
${context.identity}
` : ''}

${PREDICTION_MARKET_KNOWLEDGE}

## Your Task

Given a user message, provide a COMPLETE semantic understanding. Think step by step:

1. **What does the user fundamentally want?** (Goal)
   - GET_INFORMATION: They want facts/data
   - GET_ANALYSIS: They want reasoned opinion/synthesis
   - DISCOVER_OPPORTUNITIES: Find markets, arbs, trends
   - TAKE_ACTION: Trade, predict, set alerts
   - LEARN: Educational, understanding concepts
   - CONVERSE: Social, chat, rapport building
   - UNCLEAR: Genuinely can't tell

2. **What domain is this about?** (Domain)
   - PREDICTION_MARKETS: Core (odds, markets, platforms)
   - CRYPTO: Cryptocurrency specific
   - POLITICS: Political events/elections
   - ECONOMICS: Fed, macro, economic data
   - SPORTS: Sports prediction
   - GENERAL: Not market related
   - META: About BeRight itself

3. **What entities are mentioned?** (Topic, Platforms, Timeframe)
   - Extract the core topic (be specific: "bitcoin 100k" not just "bitcoin")
   - Note any platforms mentioned
   - Note any time constraints

4. **How should this be handled?** (Agent + Approach)
   - SCOUT: Fast data retrieval, scanning, trending
   - ANALYST: Deep reasoning, probability estimation, synthesis
   - TRADER: Trade execution, quotes, positions
   - SELF: BeRight answers meta questions directly
   - HYBRID: Needs multiple agents (scout for data, analyst for reasoning)

5. **Can this be answered directly?**
   - Simple greetings: Yes
   - "What is BeRight?": Yes
   - Complex analysis: No, needs agent work

CRITICAL: Respond with ONLY valid JSON. No markdown, no explanations, just the JSON object.
Do NOT include any text before or after the JSON.
Do NOT use newlines inside string values - use spaces instead.
Use double quotes for all strings. Use null (not "null") for missing values.

Schema:
{
  "goal": "USER_GOAL",
  "domain": "DOMAIN",
  "topic": "extracted topic or null",
  "platforms": ["platform1", "platform2"],
  "timeframe": "time context or null",
  "interpretation": "One sentence what user means",
  "confidence": 0.85,
  "ambiguities": ["unclear item"],
  "recommendedAgent": "AGENT",
  "agentReasoning": "Why this agent",
  "suggestedApproach": "What BeRight should do",
  "canAnswerDirectly": true,
  "directAnswer": "Direct response if trivial else null"
}`;
}

/**
 * Understand ANY user input semantically
 *
 * This replaces regex-based intent classification with true understanding.
 * Uses Groq (fast) by default, with intelligent caching.
 */
export async function understand(
  message: string,
  conversationContext?: string
): Promise<SemanticUnderstanding> {
  const startTime = Date.now();

  // Handle trivial cases without LLM
  const trivialResult = handleTrivialCases(message);
  if (trivialResult) {
    console.log(`[SemanticAgent] Trivial case: "${message.slice(0, 30)}..." → ${trivialResult.goal}`);
    return trivialResult;
  }

  try {
    const systemPrompt = buildUnderstandingPrompt();

    const userPrompt = conversationContext
      ? `Previous context: ${conversationContext}\n\nUser message: "${message}"`
      : `User message: "${message}"`;

    const response = await llmChat({
      system: systemPrompt,
      user: userPrompt,
      maxTokens: 500,
      temperature: 0.1, // Very deterministic
      quality: 'fast',  // Groq llama-3.1-8b-instant for speed
    });

    // Check if LLM available
    if (response.provider === 'none') {
      console.error('[SemanticAgent] LLM unavailable - cannot understand natural language without LLM');
      // Return honest failure - don't pretend to understand with regex
      return createLLMFailureResponse();
    }

    // Parse JSON response with robust extraction and sanitization
    // LLMs sometimes return text before/after JSON, or use markdown code blocks
    let jsonStr: string | null = null;

    // Strategy 1: Extract JSON from markdown code block (```json ... ```)
    const codeBlockMatch = response.text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    }

    // Strategy 2: Find the outermost complete JSON object
    if (!jsonStr) {
      // Find first { and last } to extract JSON
      const firstBrace = response.text.indexOf('{');
      const lastBrace = response.text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = response.text.slice(firstBrace, lastBrace + 1);
      }
    }

    if (!jsonStr) {
      console.warn('[SemanticAgent] No JSON found in LLM response:', response.text.slice(0, 200));
      // Use fallback understanding instead of complete failure
      return createFallbackUnderstanding(message);
    }

    // Sanitize JSON: Fix common LLM output issues
    jsonStr = jsonStr
      // Remove control characters (but preserve JSON structure)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Fix literal newlines in strings (common LLM issue)
      .replace(/\n(?=[^"]*"[^"]*$)/gm, '\\n')
      // Fix unquoted keys: { goal: -> { "goal":
      .replace(/{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '{"$1":')
      .replace(/,\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, ',"$1":');

    let parsed: SemanticUnderstanding;
    try {
      parsed = JSON.parse(jsonStr) as SemanticUnderstanding;
    } catch (jsonError) {
      console.warn('[SemanticAgent] JSON parse failed, attempting recovery:', jsonError);
      // Try more aggressive cleanup
      try {
        const cleanedJson = jsonStr
          .replace(/,\s*}/g, '}')  // Remove trailing commas
          .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
          .replace(/'/g, '"')      // Replace single quotes with double
          .replace(/:\s*'([^']*)'/g, ':"$1"')  // Fix 'value' to "value"
          .replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*([,}])/g, ':"$1"$2'); // Fix unquoted values
        parsed = JSON.parse(cleanedJson) as SemanticUnderstanding;
      } catch {
        console.warn('[SemanticAgent] JSON recovery failed, using fallback:', response.text.slice(0, 100));
        // Use fallback understanding instead of honest failure for better UX
        return createFallbackUnderstanding(message);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[SemanticAgent] Understood: "${message.slice(0, 40)}..." → ${parsed.goal}/${parsed.domain}/${parsed.recommendedAgent} (${Math.round(parsed.confidence * 100)}%) in ${elapsed}ms`);

    return parsed;

  } catch (error) {
    console.error('[SemanticAgent] Error:', error);
    // On error, return honest failure - don't fake understanding
    return createLLMFailureResponse();
  }
}

/**
 * Return honest response when LLM fails
 * This tells the user we couldn't understand, rather than faking it with regex
 */
function createLLMFailureResponse(): SemanticUnderstanding {
  return {
    goal: 'CONVERSE',
    domain: 'META',
    interpretation: 'LLM unavailable - cannot process natural language',
    confidence: 0,  // Zero confidence because we DIDN'T understand
    recommendedAgent: 'SELF',
    agentReasoning: 'LLM failed - returning honest error to user',
    suggestedApproach: 'Tell user to try again',
    canAnswerDirectly: true,
    directAnswer: `I'm having trouble understanding right now. My AI brain is temporarily unavailable.

Please try:
• Using a command: /hot, /arb, /research <topic>
• Trying again in a moment

Sorry for the inconvenience!`,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Handle trivial cases without LLM (true O(1) responses)
 * IMPORTANT: Catches META questions to prevent them being misrouted to market scans
 */
function handleTrivialCases(message: string): SemanticUnderstanding | null {
  const lower = message.toLowerCase().trim();

  // Pure greetings - respond with personality and invite engagement
  // Includes "whatsup", "what's up", "wassup", etc.
  if (/^(hi|hey|hello|gm|gn|yo|sup|hola|howdy|whatsup|what'?s?\s*up|wassup|wazzup|hiya|heya)[\s!.,?]*$/i.test(lower)) {
    // Different responses based on time of day (gm vs gn) or general greeting
    const isGM = /^gm/i.test(lower);
    const isGN = /^gn/i.test(lower);

    let greeting = "Hey! Ready to scan some markets?";
    if (isGM) {
      greeting = "GM! Markets are moving. Want to see what's hot today?";
    } else if (isGN) {
      greeting = "GN! Check /brief in the morning for your daily alpha.";
    }

    return {
      goal: 'CONVERSE',
      domain: 'META',
      interpretation: 'User is greeting',
      confidence: 1.0,
      recommendedAgent: 'SELF',
      agentReasoning: 'Simple greeting requires no agent work',
      suggestedApproach: 'Respond with friendly greeting in BeRight voice',
      canAnswerDirectly: true,
      directAnswer: greeting,
    };
  }

  // Pure acknowledgments
  if (/^(ok|okay|thanks|ty|thx|cool|nice|got it|sure)[\s!.,]*$/i.test(lower)) {
    return {
      goal: 'CONVERSE',
      domain: 'META',
      interpretation: 'User is acknowledging',
      confidence: 1.0,
      recommendedAgent: 'SELF',
      agentReasoning: 'Simple acknowledgment',
      suggestedApproach: 'Brief acknowledgment back',
      canAnswerDirectly: true,
      directAnswer: "👍",
    };
  }

  // =========================================================================
  // META QUESTIONS - About BeRight itself (CRITICAL to catch these!)
  // Without this, they get misrouted to market scans
  // =========================================================================

  // "who are you" / "who u are" / "who is this" / "what is beright"
  if (/^(who\s*(are|r|is)\s*(you|u|this|beright)|what\s*(are|is)\s*(you|u|this|beright))[\s?!.,]*$/i.test(lower)) {
    return {
      goal: 'LEARN',
      domain: 'META',
      interpretation: 'User wants to know what BeRight is',
      confidence: 1.0,
      recommendedAgent: 'SELF',
      agentReasoning: 'Meta question about BeRight identity',
      suggestedApproach: 'Explain BeRight capabilities',
      canAnswerDirectly: true,
      directAnswer: `I'm BeRight - a prediction market intelligence agent.

I help you:
• Find trending markets (/hot)
• Spot arbitrage opportunities (/arb)
• Research any topic (/research <query>)
• Track your predictions (/predict)
• Get AI-powered analysis (/intelligence)

What are you interested in predicting?`,
    };
  }

  // "what do you do" / "what you do" / "what can you do"
  if (/^what\s*(do\s*you|you|can\s*you)\s*(do|help|offer)[\s?!.,]*$/i.test(lower)) {
    return {
      goal: 'LEARN',
      domain: 'META',
      interpretation: 'User wants to know BeRight capabilities',
      confidence: 1.0,
      recommendedAgent: 'SELF',
      agentReasoning: 'Meta question about capabilities',
      suggestedApproach: 'List capabilities concisely',
      canAnswerDirectly: true,
      directAnswer: `I scan prediction markets and give you edge.

**Quick commands:**
• /hot - Trending markets right now
• /arb - Cross-platform arbitrage
• /research <topic> - Deep analysis
• /predict <question> - Track your forecast

**Ask me anything like:**
• "What are the odds Trump wins 2028?"
• "Any good arb opportunities?"
• "Research Bitcoin 100K"

What interests you?`,
    };
  }

  // "help" / "help me" / "i need help"
  if (/^(help|help\s*me|i\s*need\s*help|how\s*(do|to)\s*(i|you)\s*use)[\s?!.,]*$/i.test(lower)) {
    return {
      goal: 'LEARN',
      domain: 'META',
      interpretation: 'User needs help',
      confidence: 1.0,
      recommendedAgent: 'SELF',
      agentReasoning: 'Help request',
      suggestedApproach: 'Show quick start guide',
      canAnswerDirectly: true,
      directAnswer: `**Quick Start:**

1. /hot - See what's trending
2. /research <topic> - Get AI analysis
3. /predict <question> - Make a prediction
4. /me - Check your accuracy

**Ask naturally:**
"What are odds on Fed rate cut?"
"Any arb opportunities?"
"Research the next election"

What do you want to explore?`,
    };
  }

  // "what are your capabilities" / "features" / "what can u do"
  if (/^(what\s*(are\s*)?(your|ur)\s*(capabilities|features|skills|abilities)|features|capabilities|what\s*can\s*(u|you)\s*do)[\s?!.,]*$/i.test(lower)) {
    return {
      goal: 'LEARN',
      domain: 'META',
      interpretation: 'User asking about capabilities',
      confidence: 1.0,
      recommendedAgent: 'SELF',
      agentReasoning: 'Capabilities inquiry',
      suggestedApproach: 'List key features',
      canAnswerDirectly: true,
      directAnswer: `**BeRight capabilities:**

📊 **Market Intelligence**
• Real-time odds from Polymarket, Kalshi, Manifold
• Trending markets and volume spikes
• Whale activity tracking

🔍 **Research**
• AI-powered analysis on any topic
• Cross-platform comparison
• News and sentiment aggregation

💰 **Trading Edge**
• Arbitrage detection
• Smart predictions with reasoning
• Calibration tracking

Try /hot to see trending markets!`,
    };
  }

  // "what are you expert in" / "what you are expert in" / "what's your expertise"
  // "what do you know" / "what do you specialize in"
  if (/^(what\s*(are|r)\s*(you|u)\s*(expert|good|specialized?)\s*(in|at)|what\s*(you|u)\s*(are|r)\s*(expert|good)\s*(in|at)|what('?s| is)\s*(your|ur)\s*(expertise|specialty|speciality)|what\s*(do\s*)?(you|u)\s*(know|specialize\s*in))[\s?!.,]*$/i.test(lower)) {
    return {
      goal: 'LEARN',
      domain: 'META',
      interpretation: 'User asking about expertise',
      confidence: 1.0,
      recommendedAgent: 'SELF',
      agentReasoning: 'Expertise inquiry',
      suggestedApproach: 'Explain core expertise areas',
      canAnswerDirectly: true,
      directAnswer: `I'm an expert in prediction markets and forecasting intelligence.

**My specialties:**
• 📈 Market scanning across Polymarket, Kalshi, Manifold, Metaculus
• 🔍 Finding arbitrage opportunities between platforms
• 🧠 AI-powered research and probability estimation
• 📊 Tracking calibration and forecast accuracy
• 🐋 Whale activity and volume spike detection

**I can help you:**
• Find trending markets in any category (politics, crypto, sports)
• Spot price discrepancies for arbitrage
• Research any prediction topic with reasoning

What topic interests you?`,
    };
  }

  return null;
}

/**
 * Extract likely topic from message for fallback routing
 */
function extractFallbackTopic(message: string): string | undefined {
  const lower = message.toLowerCase();

  // Common prediction market topics
  const topicPatterns = [
    // Crypto
    { pattern: /\b(bitcoin|btc)\b/i, topic: 'bitcoin' },
    { pattern: /\b(ethereum|eth)\b/i, topic: 'ethereum' },
    { pattern: /\b(solana|sol)\b/i, topic: 'solana' },
    { pattern: /\bcrypto\b/i, topic: 'crypto' },
    // Politics
    { pattern: /\btrump\b/i, topic: 'trump' },
    { pattern: /\bbiden\b/i, topic: 'biden' },
    { pattern: /\belection\b/i, topic: 'election' },
    // Economics
    { pattern: /\b(fed|fomc|rate cut|rate hike)\b/i, topic: 'federal reserve' },
    { pattern: /\binflation\b/i, topic: 'inflation' },
    // Tech
    { pattern: /\b(ai|artificial intelligence|openai|gpt)\b/i, topic: 'AI' },
  ];

  for (const { pattern, topic } of topicPatterns) {
    if (pattern.test(lower)) return topic;
  }

  // Extract quoted text as topic
  const quoted = message.match(/"([^"]+)"|'([^']+)'/);
  if (quoted) return quoted[1] || quoted[2];

  return undefined;
}

/**
 * Fallback when LLM is unavailable
 * Enhanced with better keyword detection and topic extraction
 */
function createFallbackUnderstanding(message: string): SemanticUnderstanding {
  const lower = message.toLowerCase();
  const topic = extractFallbackTopic(message);

  // Basic keyword detection for fallback
  let goal: UserGoal = 'GET_INFORMATION';  // Default to info-seeking, not UNCLEAR
  let domain: Domain = 'PREDICTION_MARKETS';  // Default to our core domain
  let recommendedAgent: RecommendedAgent = 'SCOUT';  // Default to Scout for data

  // =========================================================================
  // META QUESTIONS - Catch these first to avoid misrouting
  // =========================================================================
  if (lower.includes('who are') || lower.includes('who r') || lower.includes('who u') ||
      lower.includes('what are you') || lower.includes('what r you') ||
      lower.includes('what do you') || lower.includes('what you do') ||
      lower.includes('help') || lower.includes('capabilities') || lower.includes('features')) {
    return {
      goal: 'LEARN',
      domain: 'META',
      interpretation: 'User asking about BeRight (LLM fallback)',
      confidence: 0.7,
      recommendedAgent: 'SELF',
      agentReasoning: 'Meta question about BeRight',
      suggestedApproach: 'Explain capabilities',
      canAnswerDirectly: true,
      directAnswer: `I'm BeRight - prediction market intelligence.

Try:
• /hot - Trending markets
• /arb - Arbitrage opportunities
• /research <topic> - Deep analysis

What do you want to explore?`,
    };
  }

  // =========================================================================
  // SMART KEYWORD DETECTION - Improved routing
  // =========================================================================

  // Arbitrage/spread detection - high priority
  if (lower.includes('arb') || lower.includes('spread') || lower.includes('difference between')) {
    goal = 'DISCOVER_OPPORTUNITIES';
    recommendedAgent = 'SCOUT';
  }
  // Analysis/research requests - route to Analyst
  else if (lower.includes('research') || lower.includes('analysis') || lower.includes('analyze') ||
           lower.includes('deep dive') || lower.includes('investigate')) {
    goal = 'GET_ANALYSIS';
    recommendedAgent = 'ANALYST';
  }
  // Opinion/prediction requests - route to Analyst
  else if (lower.includes('think') || lower.includes('predict') || lower.includes('opinion') ||
           lower.includes('forecast') || lower.includes('probability')) {
    goal = 'GET_ANALYSIS';
    recommendedAgent = 'ANALYST';
  }
  // Hot/trending - Scout
  else if (lower.includes('hot') || lower.includes('trending') || lower.includes('moving') ||
           lower.includes('popular') || lower.includes('top market')) {
    goal = 'DISCOVER_OPPORTUNITIES';
    recommendedAgent = 'SCOUT';
  }
  // Trading intent - Trader
  else if (lower.includes('buy') || lower.includes('sell') || lower.includes('trade') ||
           lower.includes('position') || lower.includes('portfolio')) {
    goal = 'TAKE_ACTION';
    recommendedAgent = 'TRADER';
  }
  // Educational/learning
  else if (lower.includes('what is') || lower.includes('how does') || lower.includes('explain') ||
           lower.includes('learn') || lower.includes('teach')) {
    goal = 'LEARN';
    recommendedAgent = 'SELF';
  }
  // Brief/morning brief - Scout
  else if (lower.includes('brief') || lower.includes('morning') || lower.includes('summary') ||
           lower.includes('update')) {
    goal = 'GET_INFORMATION';
    recommendedAgent = 'SCOUT';
  }
  // Platform mentions or general market queries - Scout
  else if (lower.includes('polymarket') || lower.includes('kalshi') || lower.includes('manifold') ||
           lower.includes('odds') || lower.includes('market') || lower.includes('price')) {
    goal = 'GET_INFORMATION';
    recommendedAgent = 'SCOUT';
  }
  // Links/URL requests - Scout (user asking for market links)
  else if (lower.includes('link') || lower.includes('url') || lower.includes('where') ||
           lower.includes('platform')) {
    goal = 'GET_INFORMATION';
    recommendedAgent = 'SCOUT';
  }

  // Calculate confidence based on how well we matched
  const confidence = topic ? 0.65 : 0.5;  // Higher if we found a topic

  return {
    goal,
    domain,
    topic,  // Include extracted topic
    interpretation: `Fallback understanding: ${goal.toLowerCase().replace(/_/g, ' ')} about ${topic || 'general markets'}`,
    confidence,
    recommendedAgent,
    agentReasoning: `Keyword-based routing to ${recommendedAgent}`,
    suggestedApproach: `Use ${recommendedAgent} agent to handle ${topic || 'request'}`,
    canAnswerDirectly: false,
  };
}

// ============================================================================
// Agent Routing
// ============================================================================

/**
 * Route to appropriate handler based on semantic understanding
 * Now with smarter skill selection based on topic analysis
 */
export function routeToAgent(understanding: SemanticUnderstanding): {
  primary: RecommendedAgent;
  secondary?: RecommendedAgent;
  skills: string[];
} {
  const { goal, domain, recommendedAgent, topic, interpretation } = understanding;

  // Determine skills based on understanding
  const skills: string[] = [];

  // Helper to check if user wants a specific type of content
  // Uses topic and interpretation to make smarter decisions
  const topicLower = (topic || '').toLowerCase();
  const interpLower = (interpretation || '').toLowerCase();
  const contextText = `${topicLower} ${interpLower}`;

  const wantsArbitrage = contextText.includes('arb') || contextText.includes('spread') || contextText.includes('price difference');
  const wantsHot = contextText.includes('hot') || contextText.includes('trending') || contextText.includes('popular') || contextText.includes('top market');
  const wantsWhale = contextText.includes('whale') || contextText.includes('big trade') || contextText.includes('large position');

  switch (recommendedAgent) {
    case 'SCOUT':
      if (goal === 'DISCOVER_OPPORTUNITIES') {
        // Be selective about which skills to add based on what user actually wants
        // Don't blindly add all three skills
        if (wantsArbitrage) skills.push('arbitrage');
        if (wantsHot) skills.push('hot');
        if (wantsWhale) skills.push('whale');

        // If nothing specific detected, default to hot markets (safest general option)
        if (skills.length === 0) {
          skills.push('hot', 'search');
        }
      } else if (goal === 'GET_INFORMATION') {
        skills.push('markets', 'prices');
        if (topic) skills.push('search');
      }
      break;

    case 'ANALYST':
      skills.push('research');
      if (domain === 'PREDICTION_MARKETS') {
        skills.push('consensus', 'calibration');
      }
      break;

    case 'TRADER':
      skills.push('trade', 'positions', 'quotes');
      break;

    case 'HYBRID':
      // Scout first for data, then Analyst for reasoning
      return {
        primary: 'SCOUT',
        secondary: 'ANALYST',
        skills: ['markets', 'search', 'research'],
      };

    case 'SELF':
      // No skills needed, answer directly
      break;
  }

  return {
    primary: recommendedAgent,
    skills,
  };
}

// ============================================================================
// Exports
// ============================================================================

// Named exports for direct import
export { loadOpenClawContext, PREDICTION_MARKET_KNOWLEDGE };

// Note: Types (UserGoal, Domain, RecommendedAgent, SemanticUnderstanding) are
// already exported inline where they're defined using 'export type' and 'export interface'

export default {
  understand,
  routeToAgent,
  loadOpenClawContext,
  PREDICTION_MARKET_KNOWLEDGE,
};
