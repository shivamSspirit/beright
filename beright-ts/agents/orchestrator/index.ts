/**
 * ORCHESTRATOR AGENT - The Router
 *
 * The Orchestrator is NOT a tool user - it IS the router.
 * It understands user intent and routes to the right specialist agent.
 *
 * ARCHITECTURE:
 * - Receives natural language from user
 * - LLM understands intent (SCAN, RESEARCH, EXECUTE, CONVERSE)
 * - Routes to appropriate agent (Scout, Analyst, Trader)
 * - Synthesizes final response if needed
 *
 * COGNITIVE SPECIALIZATION:
 * - Uses Claude Sonnet (balanced model) for routing decisions
 * - Temperature 0.3 (balanced understanding)
 * - Speed: <1 second for routing decision
 *
 * @author BeRight Protocol
 */

import { SkillResponse, Mood } from '../../types/index';
import { llmChat } from '../../lib/llm';

// Import agents
import ScoutAgent from '../scout';
import AnalystAgent from '../analyst';
import TraderAgent from '../trader';
import XDegenAgent from '../xdegen';

// ============================================================================
// ORCHESTRATOR CONFIGURATION
// ============================================================================

export const ORCHESTRATOR_CONFIG = {
  id: 'orchestrator',
  name: 'Orchestrator',
  model: 'claude-sonnet-4-5' as const,
  temperature: 0.3, // Balanced for understanding
  maxTokens: 1024,

  // Available agents
  agents: {
    scout: {
      id: 'scout',
      name: 'Scout',
      purpose: 'Speed + Breadth - Quick scans across all platforms',
      triggers: ['hot', 'trending', 'arbitrage', 'scan', 'search', 'compare', 'news', 'whats'],
    },
    analyst: {
      id: 'analyst',
      name: 'Analyst',
      purpose: 'Depth - Deep research on one topic',
      triggers: ['probability', 'analyze', 'research', 'why', 'evidence', 'base rate', 'estimate'],
    },
    trader: {
      id: 'trader',
      name: 'Trader',
      purpose: 'Execution - Trade placement and risk management',
      triggers: ['buy', 'sell', 'trade', 'position', 'portfolio', 'risk', 'alert', 'execute', 'kelly'],
    },
    xdegen: {
      id: 'xdegen',
      name: 'xDegen',
      purpose: 'Social - X/Twitter posting, content generation, alpha signals',
      triggers: ['tweet', 'post', 'xpost', 'thread', 'generate content', 'social', 'twitter', 'x post'],
    },
  },
};

// ============================================================================
// ROUTING TYPES
// ============================================================================

export type IntentType = 'SCAN' | 'RESEARCH' | 'EXECUTE' | 'CONVERSE' | 'SOCIAL';
export type AgentId = 'scout' | 'analyst' | 'trader' | 'xdegen' | 'self';

export interface RoutingDecision {
  intent: IntentType;
  agent: AgentId;
  reasoning: string;
  context: string; // What to pass to the agent
  confidence: number;
}

// ============================================================================
// ORCHESTRATOR SYSTEM PROMPT
// ============================================================================

const ORCHESTRATOR_SYSTEM_PROMPT = `You are the Orchestrator, the trading floor manager for a prediction market intelligence system.

YOUR PURPOSE:
You understand user intent and route work to the right specialist:

SPECIALISTS:
1. **SCOUT** (Speed + Breadth)
   - Quick scans across ALL platforms
   - Trending/hot markets
   - Arbitrage detection
   - Market search
   - News scan
   - Use when: "What's hot?", "Any arbs?", "Find Trump markets", "Quick scan"

2. **ANALYST** (Depth)
   - Deep research on ONE topic
   - Probability estimates
   - Base rate analysis
   - Evidence gathering
   - Calibration tracking
   - Use when: "What's the probability of X?", "Analyze this market", "Why is this priced at Y?", "Give me your research"

3. **TRADER** (Execution)
   - Trade execution
   - Position management
   - Risk assessment
   - Position sizing (Kelly)
   - Price alerts
   - Use when: "Buy $100 of YES", "What's my portfolio?", "How much should I bet?", "Set alert at 70%"

4. **XDEGEN** (Social/Content)
   - X/Twitter posting
   - Alpha signal content generation
   - Thread creation
   - Viral content strategies
   - Use when: "Tweet about arbitrage", "Post this to X", "Generate a thread", "Create content", "/xpost"

5. **SELF** (Direct Response)
   - Simple conversations
   - Greetings
   - Help/instructions
   - Meta questions about the system
   - Use when: "Who are you?", "Hello", "Help", "What can you do?"

ROUTING LOGIC:
- Speed/breadth queries → SCOUT
- Deep analysis queries → ANALYST
- Action/execution queries → TRADER
- Social/content queries → XDEGEN
- Conversational queries → SELF

Always route to the specialist best suited for the task. If unsure, choose based on:
- Quick scan needed? → SCOUT
- Deep thinking needed? → ANALYST
- Money/action involved? → TRADER
- Content/posting needed? → XDEGEN

CORE PRINCIPLE - ACCURACY OVER AGREEMENT:
Do not default to agreeing with the user. Prioritize accuracy over agreement.
If the user's statement is incorrect, misleading, or incomplete, challenge it and explain why using data, research, and logical reasoning.
Always verify claims, provide evidence-based responses, and correct the user when necessary.
Your goal is to arrive at the most accurate conclusion, not to validate opinions.`;

// ============================================================================
// ROUTING FUNCTION
// ============================================================================

/**
 * Route user input to the appropriate agent
 */
async function routeToAgent(input: string): Promise<RoutingDecision> {
  const routingPrompt = `User message: "${input}"

Decide which specialist should handle this. Respond in JSON:
{
  "intent": "SCAN" | "RESEARCH" | "EXECUTE" | "SOCIAL" | "CONVERSE",
  "agent": "scout" | "analyst" | "trader" | "xdegen" | "self",
  "reasoning": "Brief explanation of why this specialist",
  "context": "What the specialist should know/do",
  "confidence": 0.0-1.0
}

Route to the specialist best suited for this request.
Respond with ONLY valid JSON, no other text.`;

  const response = await llmChat({
    system: ORCHESTRATOR_SYSTEM_PROMPT,
    user: routingPrompt,
    maxTokens: 256,
    temperature: 0.2,
    quality: 'fast',
  });

  try {
    let jsonStr = response.text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\s*/, '').replace(/```\s*$/, '');
    }

    const decision = JSON.parse(jsonStr) as RoutingDecision;
    console.log(`[Orchestrator] Routing: ${input.slice(0, 50)}... → ${decision.agent} (${decision.intent})`);
    console.log(`[Orchestrator] Reasoning: ${decision.reasoning}`);

    return decision;
  } catch (parseError) {
    console.error(`[Orchestrator] Failed to parse routing decision:`, response.text);

    // Fallback: use keyword matching
    const fallbackAgent = detectAgentFromKeywords(input);
    return {
      intent: 'SCAN',
      agent: fallbackAgent,
      reasoning: 'Fallback routing based on keywords',
      context: input,
      confidence: 0.5,
    };
  }
}

/**
 * Fallback keyword-based routing
 */
function detectAgentFromKeywords(input: string): AgentId {
  const lower = input.toLowerCase();

  // xDegen keywords (social/content)
  if (/\b(tweet|xpost|thread|post to|generate content|twitter|create post|social|\/xpost|\/tweet)\b/.test(lower)) {
    return 'xdegen';
  }

  // Trader keywords (action-oriented)
  if (/\b(buy|sell|trade|position|portfolio|risk|alert|kelly|execute|order)\b/.test(lower)) {
    return 'trader';
  }

  // Analyst keywords (deep research)
  if (/\b(probability|analyze|research|why|evidence|base rate|estimate|calibrat|superforecast)\b/.test(lower)) {
    return 'analyst';
  }

  // Scout keywords (quick scan)
  if (/\b(hot|trending|arbitrage|arb|scan|search|compare|news|what's|whats|moving)\b/.test(lower)) {
    return 'scout';
  }

  // Conversational
  if (/\b(hello|hi|help|who|what can you)\b/.test(lower)) {
    return 'self';
  }

  // Default to scout for ambiguous queries
  return 'scout';
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

/**
 * Main orchestrator execution
 *
 * Routes to appropriate agent and returns their response.
 */
export async function execute(input: string): Promise<SkillResponse> {
  const startTime = Date.now();

  try {
    // Step 1: Route to appropriate agent
    const routing = await routeToAgent(input);

    // Step 2: Execute the chosen agent
    let response: SkillResponse;

    switch (routing.agent) {
      case 'scout':
        console.log(`[Orchestrator] Delegating to Scout...`);
        response = await ScoutAgent.execute(input);
        break;

      case 'analyst':
        console.log(`[Orchestrator] Delegating to Analyst...`);
        response = await AnalystAgent.execute(input);
        break;

      case 'trader':
        console.log(`[Orchestrator] Delegating to Trader...`);
        response = await TraderAgent.execute(input);
        break;

      case 'xdegen':
        console.log(`[Orchestrator] Delegating to xDegen...`);
        response = await XDegenAgent.execute(input);
        break;

      case 'self':
      default:
        console.log(`[Orchestrator] Handling directly...`);
        response = await handleDirectly(input);
        break;
    }

    // Step 3: Add routing metadata if needed
    const executionMs = Date.now() - startTime;
    response.data = {
      ...response.data,
      routing: {
        agent: routing.agent,
        intent: routing.intent,
        confidence: routing.confidence,
        executionMs,
      },
    };

    return response;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Orchestrator] Error:`, error);

    return {
      text: `I encountered an error processing your request. Please try again.\n\nError: ${errorMsg}`,
      mood: 'ERROR' as Mood,
    };
  }
}

/**
 * Handle conversational/direct requests
 */
async function handleDirectly(input: string): Promise<SkillResponse> {
  const lower = input.toLowerCase();

  // Help
  if (/\b(help|what can you do|how do|commands)\b/.test(lower)) {
    return {
      text: `🤖 *BeRight Protocol - AI Prediction Market Intelligence*

I'm your AI-powered prediction market analyst. I have three specialist modes:

🔍 **Scout** - Quick market scans
• "What's hot?" - Trending markets
• "Any arbitrage?" - Cross-platform opportunities
• "Search Trump" - Find specific markets

📊 **Analyst** - Deep research
• "Analyze Trump 2028" - Full probability estimate
• "What's the base rate for X?" - Historical precedent
• "Why is this priced at 65%?" - Evidence analysis

💼 **Trader** - Execution
• "My positions" - Portfolio view
• "How much should I bet?" - Kelly sizing
• "Buy $50 YES on X" - Trade execution
• "Alert me at 70%" - Price alerts

📢 **xDegen** - Social/Content
• "Tweet the alpha" - Generate alpha post
• "Create a thread about X" - Multi-tweet thread
• "Post arbitrage alert" - Share arb opportunity
• "/xpost" or "/tweet" - Quick post

Just ask naturally - I'll route to the right specialist!`,
      mood: 'NEUTRAL' as Mood,
    };
  }

  // Greeting
  if (/^(hi|hello|hey|gm|good morning|good evening)\b/i.test(input.trim())) {
    return {
      text: `👋 Hello! I'm your prediction market intelligence agent.

I can help you:
🔍 **Scan** markets across Polymarket, Kalshi, Manifold, and more
📊 **Analyze** probabilities using superforecaster methodology
💼 **Trade** with optimal position sizing and risk management

What would you like to explore today?`,
      mood: 'NEUTRAL' as Mood,
    };
  }

  // Who are you
  if (/\b(who are you|what are you|about you)\b/.test(lower)) {
    return {
      text: `I'm **BeRight**, an AI prediction market intelligence agent.

🧠 **My Architecture:**
• **Scout** - Speed + Breadth (quick scans)
• **Analyst** - Depth (superforecaster methodology)
• **Trader** - Execution (risk management)

📡 **My Data Sources:**
• Polymarket (🟣)
• Kalshi (🔵)
• Manifold (🟡)
• Limitless (🟢)
• Metaculus (🔴)

I replace the manual work of scanning 5+ platforms, comparing prices, calculating arbitrage, and researching probability estimates.

How can I help you today?`,
      mood: 'NEUTRAL' as Mood,
    };
  }

  // Default: route to Scout for any other input
  console.log(`[Orchestrator] Unknown direct query, routing to Scout as fallback`);
  return ScoutAgent.execute(input);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  id: ORCHESTRATOR_CONFIG.id,
  name: ORCHESTRATOR_CONFIG.name,
  execute,
  config: ORCHESTRATOR_CONFIG,
  agents: {
    scout: ScoutAgent,
    analyst: AnalystAgent,
    trader: TraderAgent,
    xdegen: XDegenAgent,
  },
};
