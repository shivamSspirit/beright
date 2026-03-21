/**
 * SCOUT AGENT - True Agentic Architecture
 *
 * A human-replacement agent for prediction market power users.
 *
 * ARCHITECTURE (OpenClaw-compatible):
 * - LLM is the brain - it decides what tools to use
 * - Tools are defined, not hardcoded handlers
 * - Natural language in → LLM understands → LLM calls tools → LLM synthesizes
 * - No keyword matching, no switch statements
 *
 * What a power user does manually:
 * 1. Opens Polymarket, Kalshi, Manifold, Limitless, Metaculus tabs
 * 2. Looks at trending markets
 * 3. Compares prices across platforms by eye
 * 4. Calculates arbitrage spreads mentally
 * 5. Checks news that might move markets
 * 6. Does this 50+ times a day
 *
 * Scout does ALL of this autonomously in <2 seconds.
 */

import { SkillResponse, Mood, Market, Platform } from '../../types/index';
import {
  getHotMarkets,
  searchMarkets,
  compareOdds,
  getHotTradeableMarkets,
} from '../../skills/markets';
import { arbitrage } from '../../skills/arbitrage';
import { tavilyIntelSearch, newsSearch } from '../../skills/intel';
import { isTavilyConfigured } from '../../lib/tavily';
import { llmRoute } from '../../lib/llm';

// ============================================================================
// SCOUT CONFIGURATION
// ============================================================================

export const SCOUT_CONFIG = {
  id: 'scout',
  name: 'Scout',
  model: 'claude-sonnet-4-5' as const,
  temperature: 0.3,
  maxTokens: 2048,

  // Data sources (verified, real APIs)
  dataSources: {
    polymarket: 'https://gamma-api.polymarket.com',
    kalshi: 'https://api-v2.polyrouter.io (DFlow)',
    manifold: 'https://api.manifold.markets/v0',
    limitless: 'https://api.limitless.exchange',
    metaculus: 'https://www.metaculus.com/api2',
    jupiter: 'https://api.jup.ag/prediction/v1',  // Aggregates Polymarket + Kalshi on Solana
  },

  // Thresholds
  arbitrageThreshold: 0.03, // 3% spread minimum
  hotVolumeThreshold: 10000, // $10K = hot market
  urgentVolumeThreshold: 100000, // $100K = urgent
};

// ============================================================================
// TOOL DEFINITIONS (What Scout can do)
// ============================================================================

export interface ScoutTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
  execute: (params: Record<string, any>) => Promise<any>;
}

/**
 * Scout's available tools - the LLM decides which to use
 */
export const SCOUT_TOOLS: ScoutTool[] = [
  {
    name: 'get_hot_markets',
    description: 'Fetch trending/hot prediction markets sorted by volume across all platforms (Polymarket, Kalshi, Manifold, Limitless, Metaculus). Use when user wants to see what markets are popular, trending, or have high activity.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of markets to return (default: 15)' },
      },
    },
    execute: async (params) => {
      const markets = await getHotMarkets(params.limit || 15);
      return { markets, count: markets.length, platforms: countPlatforms(markets) };
    },
  },
  {
    name: 'search_markets',
    description: 'Search for prediction markets by topic, question, or keyword across all platforms. Use when user wants to find markets about a specific topic like "Trump", "Bitcoin", "elections", "World Cup", etc.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query - the topic or keywords to search for' },
      },
      required: ['query'],
    },
    execute: async (params) => {
      const markets = await searchMarkets(params.query);
      return { markets, count: markets.length, query: params.query };
    },
  },
  {
    name: 'find_arbitrage',
    description: 'Find arbitrage opportunities - price differences for the same market across different platforms. When YES on one platform + NO on another < 100%, there\'s profit potential. Use when user asks about arbitrage, spreads, or price discrepancies.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional: focus on markets containing this query' },
      },
    },
    execute: async (params) => {
      const result = await arbitrage(params.query);
      return result;
    },
  },
  {
    name: 'compare_odds',
    description: 'Compare odds/prices for a specific market or topic across all platforms. Shows the same market\'s price on Polymarket vs Kalshi vs Manifold etc. Use when user wants to compare prices or find the best odds.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The market topic to compare across platforms' },
      },
      required: ['query'],
    },
    execute: async (params) => {
      const comparison = await compareOdds(params.query);
      return comparison;
    },
  },
  {
    name: 'get_news',
    description: 'Get market-moving news and intelligence that could affect prediction market prices. Use when user asks about news, what\'s happening, events that could move markets, or wants intel.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'News topic to search for (default: prediction markets)' },
      },
    },
    execute: async (params) => {
      const query = params.query || 'prediction markets';
      if (isTavilyConfigured()) {
        return await tavilyIntelSearch(query);
      }
      return await newsSearch(query);
    },
  },
  {
    name: 'get_tokenized_markets',
    description: 'Get on-chain tradeable markets that can be traded via Solana wallet (DFlow/Kalshi tokenized). These are real markets with SPL tokens. Use when user asks about tokenized, on-chain, DeFi, or Solana-based markets.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of markets to return (default: 15)' },
      },
    },
    execute: async (params) => {
      const markets = await getHotTradeableMarkets(params.limit || 15);
      return { markets, count: markets.length };
    },
  },
  {
    name: 'track_whales',
    description: 'Track large positions and whale activity in prediction markets. Shows big trades and significant position changes. Use when user asks about whales, big trades, or large positions.',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const { whaleWatch } = await import('../../skills/whale');
      return await whaleWatch();
    },
  },
  {
    name: 'get_jupiter_markets',
    description: 'Get prediction markets from Jupiter (aggregated Polymarket + Kalshi liquidity on Solana). Best for finding markets with real on-chain liquidity, zero payout fees. Use when user asks about Jupiter markets, Solana prediction markets, or wants aggregated Polymarket/Kalshi data.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Optional category filter: crypto, sports, politics, economics, entertainment, science, technology, world' },
        limit: { type: 'number', description: 'Maximum number of markets to return (default: 20)' },
      },
    },
    execute: async (params) => {
      const { getHotEvents, getActiveMarkets } = await import('../../lib/jupiter/prediction');

      // Fetch hot events with markets
      const response = await getHotEvents(params.limit || 20);

      if (!response.success || !response.data) {
        return { error: response.error || 'Failed to fetch Jupiter markets', markets: [] };
      }

      // Flatten markets from events
      const markets: Array<{
        marketId: string;
        title: string;
        yesPrice: number;
        noPrice: number;
        volume: number;
        provider: string;
        status: string;
      }> = [];

      for (const event of response.data) {
        if (event.markets) {
          for (const market of event.markets) {
            const { microUsdToUsd } = await import('../../lib/jupiter/types');
            markets.push({
              marketId: market.marketId,
              title: market.title,
              yesPrice: microUsdToUsd(market.pricing.buyYesPriceUsd),
              noPrice: microUsdToUsd(market.pricing.buyNoPriceUsd),
              volume: market.pricing.volume ? parseFloat(market.pricing.volume) : 0,
              provider: market.provider, // 'polymarket' or 'kalshi'
              status: market.status,
            });
          }
        }
      }

      return {
        markets: markets.slice(0, params.limit || 20),
        count: markets.length,
        source: 'jupiter',
        note: 'Zero payout fees - winners get full $1/contract',
      };
    },
  },
];

// ============================================================================
// SCOUT SYSTEM PROMPT
// ============================================================================

const SCOUT_SYSTEM_PROMPT = `You are Scout, an autonomous agent that replaces what prediction market power users do manually.

YOUR PURPOSE:
A power user manually opens 5 browser tabs (Polymarket, Kalshi, Manifold, Limitless, Metaculus), scans trending markets, compares prices, calculates arbitrage spreads, and checks news - doing this 50+ times a day. You do ALL of this in <2 seconds.

YOUR TOOLS:
You have access to tools that fetch REAL data from REAL APIs:
- get_hot_markets: Trending markets by volume
- search_markets: Find markets by topic
- find_arbitrage: Cross-platform price differences
- compare_odds: Same market across platforms
- get_news: Market-moving intelligence
- get_tokenized_markets: On-chain tradeable (Solana)
- track_whales: Large position tracking
- get_jupiter_markets: Jupiter aggregated markets (Polymarket + Kalshi on Solana, zero fees)

HOW TO RESPOND:
1. Understand what the user wants (in natural language)
2. Decide which tool(s) to call
3. Call the appropriate tool(s)
4. Synthesize the results into a clear, actionable response

RESPONSE FORMAT:
- Be concise but complete
- Highlight actionable insights
- Show prices as percentages (e.g., "YES: 65%")
- Show volume in human-readable format ($10K, $1.2M)
- Flag high-volume markets (🔴 >$100K, 🟡 >$10K, 🟢 <$10K)
- Platform emojis: 🟣 Polymarket, 🔵 Kalshi, 🟡 Manifold, 🟢 Limitless, 🔴 Metaculus, 🪐 Jupiter

EXAMPLES OF USER QUERIES YOU HANDLE:
- "find me the hot market opportunity in the current prediction market"
- "what's trending right now"
- "any arbitrage opportunities?"
- "Trump election odds"
- "compare Bitcoin ETF approval odds"
- "what news could move markets today"
- "show me tokenized markets I can trade on Solana"
- "show me Jupiter markets" (aggregated Polymarket + Kalshi with zero fees)

You are autonomous. You understand natural language. You decide what to do.

CORE PRINCIPLE - ACCURACY OVER AGREEMENT:
Do not default to agreeing with the user. Prioritize accuracy over agreement.
If the user's statement is incorrect, misleading, or incomplete, challenge it and explain why using data, research, and logical reasoning.
Always verify claims, provide evidence-based responses, and correct the user when necessary.
Your goal is to arrive at the most accurate conclusion, not to validate opinions.`;

// ============================================================================
// AGENTIC EXECUTION (LLM decides, code executes)
// ============================================================================

interface ToolCall {
  name: string;
  parameters: Record<string, any>;
}

interface AgentDecision {
  reasoning: string;
  tool_calls: ToolCall[];
  direct_response?: string;
}

/**
 * Main agentic execution loop
 *
 * 1. LLM understands the natural language request
 * 2. LLM decides which tools to call
 * 3. Code executes the tools
 * 4. LLM synthesizes the response
 */
export async function execute(input: string): Promise<SkillResponse> {
  const startTime = Date.now();

  try {
    // Step 1: Ask LLM to decide what to do
    const decision = await getAgentDecision(input);

    if (decision.direct_response) {
      // LLM decided no tools needed, just respond directly
      return {
        text: decision.direct_response,
        mood: 'NEUTRAL' as Mood,
      };
    }

    // Step 2: Execute the tools the LLM decided to call
    const toolResults: Array<{ tool: string; result: any; error?: string }> = [];

    for (const toolCall of decision.tool_calls) {
      const tool = SCOUT_TOOLS.find(t => t.name === toolCall.name);
      if (!tool) {
        toolResults.push({ tool: toolCall.name, result: null, error: `Unknown tool: ${toolCall.name}` });
        continue;
      }

      try {
        const result = await tool.execute(toolCall.parameters);
        toolResults.push({ tool: toolCall.name, result });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Execution failed';
        toolResults.push({ tool: toolCall.name, result: null, error: errorMsg });
      }
    }

    // Step 3: Ask LLM to synthesize the results
    const response = await synthesizeResponse(input, decision, toolResults);
    const executionMs = Date.now() - startTime;

    return {
      text: formatFinalResponse(response, executionMs),
      mood: determineMood(toolResults),
      data: toolResults,
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Scout] Error:`, error);

    return {
      text: `❌ Scout scan failed: ${errorMsg}`,
      mood: 'ERROR' as Mood,
    };
  }
}

/**
 * Ask the LLM to decide what tools to call
 */
async function getAgentDecision(userInput: string): Promise<AgentDecision> {
  const toolsDescription = SCOUT_TOOLS.map(t =>
    `- ${t.name}: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters.properties)}`
  ).join('\n\n');

  const decisionPrompt = `User request: "${userInput}"

Available tools:
${toolsDescription}

Decide what to do. Respond in this JSON format:
{
  "reasoning": "Brief explanation of what the user wants and why you chose these tools",
  "tool_calls": [
    { "name": "tool_name", "parameters": { "param": "value" } }
  ],
  "direct_response": "Only if no tools needed - your direct text response"
}

If the user's request is clear, call the appropriate tool(s). You can call multiple tools if needed.
If the request is unclear or just a greeting, use direct_response.

Respond with ONLY valid JSON, no other text.`;

  const response = await llmRoute({
    agent: 'scout',
    system: SCOUT_SYSTEM_PROMPT,
    user: decisionPrompt,
  });

  // Parse the LLM's decision
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = response.text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\s*/, '').replace(/```\s*$/, '');
    }

    const decision = JSON.parse(jsonStr) as AgentDecision;
    console.log(`[Scout] Decision: ${decision.reasoning}`);
    console.log(`[Scout] Tools to call: ${decision.tool_calls?.map(t => t.name).join(', ') || 'none'}`);

    return decision;
  } catch (parseError) {
    console.error(`[Scout] Failed to parse LLM decision:`, response.text);
    // Fallback: assume user wants hot markets if we can't parse
    return {
      reasoning: 'Fallback: showing hot markets',
      tool_calls: [{ name: 'get_hot_markets', parameters: { limit: 15 } }],
    };
  }
}

/**
 * Ask the LLM to synthesize tool results into a final response
 */
async function synthesizeResponse(
  userInput: string,
  decision: AgentDecision,
  toolResults: Array<{ tool: string; result: any; error?: string }>
): Promise<string> {
  // Format tool results for the LLM
  const resultsText = toolResults.map(tr => {
    if (tr.error) {
      return `Tool: ${tr.tool}\nError: ${tr.error}`;
    }

    // Format based on tool type
    if (tr.tool === 'get_hot_markets' || tr.tool === 'search_markets' || tr.tool === 'get_tokenized_markets') {
      const markets = tr.result.markets || [];
      const formatted = markets.slice(0, 10).map((m: Market) =>
        `- ${getPlatformEmoji(m.platform)} ${m.title}: YES ${(m.yesPrice * 100).toFixed(0)}% | Vol: $${formatVolume(m.volume || 0)}`
      ).join('\n');
      return `Tool: ${tr.tool}\nCount: ${tr.result.count}\nMarkets:\n${formatted}`;
    }

    if (tr.tool === 'find_arbitrage') {
      const data = tr.result;
      if (data.text) return `Tool: ${tr.tool}\n${data.text}`;
      return `Tool: ${tr.tool}\n${JSON.stringify(data, null, 2)}`;
    }

    if (tr.tool === 'compare_odds') {
      const data = tr.result;
      const lines: string[] = [];
      if (data.byPlatform) {
        for (const [platform, markets] of Object.entries(data.byPlatform)) {
          const marketList = markets as Market[];
          if (marketList.length > 0) {
            lines.push(`${platform}: ${marketList.map((m: Market) => `${m.title} @ ${(m.yesPrice * 100).toFixed(0)}%`).join(', ')}`);
          }
        }
      }
      if (data.arbitrageOpportunities?.length > 0) {
        lines.push(`\nArbitrage: ${data.arbitrageOpportunities.length} opportunities found`);
      }
      return `Tool: ${tr.tool}\n${lines.join('\n')}`;
    }

    if (tr.tool === 'get_news') {
      const data = tr.result;
      if (data.text) return `Tool: ${tr.tool}\n${data.text}`;
      return `Tool: ${tr.tool}\n${JSON.stringify(data, null, 2)}`;
    }

    return `Tool: ${tr.tool}\n${JSON.stringify(tr.result, null, 2)}`;
  }).join('\n\n');

  const synthesisPrompt = `Original user request: "${userInput}"

Your reasoning: ${decision.reasoning}

Tool results:
${resultsText}

Now synthesize this into a clear, actionable response for the user.
- Be concise but informative
- Highlight the most important findings
- Use the platform emojis (🟣 Polymarket, 🔵 Kalshi, 🟡 Manifold, 🟢 Limitless, 🔴 Metaculus)
- Use volume indicators (🔴 >$100K, 🟡 >$10K, 🟢 <$10K)
- Format percentages as "XX%"
- If there were errors, mention them briefly

Respond with just the synthesized message, no JSON or extra formatting.`;

  const response = await llmRoute({
    agent: 'scout',
    system: SCOUT_SYSTEM_PROMPT,
    user: synthesisPrompt,
  });

  return response.text;
}

// ============================================================================
// HELPERS
// ============================================================================

function getPlatformEmoji(platform: Platform | 'jupiter'): string {
  const emojis: Record<string, string> = {
    polymarket: '🟣',
    kalshi: '🔵',
    manifold: '🟡',
    limitless: '🟢',
    metaculus: '🔴',
    jupiter: '🪐',
  };
  return emojis[platform] || '⚪';
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return `${v.toFixed(0)}`;
}

function countPlatforms(markets: Market[]): number {
  return new Set(markets.map(m => m.platform)).size;
}

function formatFinalResponse(text: string, executionMs: number): string {
  const header = `🔍 *SCOUT*\n${'─'.repeat(30)}`;
  const footer = `\n⏱️ ${new Date().toISOString().slice(11, 19)} UTC | ${executionMs}ms`;
  return `${header}\n\n${text}${footer}`;
}

function determineMood(toolResults: Array<{ tool: string; result: any; error?: string }>): Mood {
  // Check for errors
  if (toolResults.some(tr => tr.error)) return 'ERROR';

  // Check for arbitrage opportunities
  const arbResult = toolResults.find(tr => tr.tool === 'find_arbitrage');
  if (arbResult?.result?.arbitrageOpportunities?.length > 0) return 'BULLISH';

  return 'NEUTRAL';
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  id: SCOUT_CONFIG.id,
  name: SCOUT_CONFIG.name,
  execute,
  tools: SCOUT_TOOLS,
  config: SCOUT_CONFIG,
};
