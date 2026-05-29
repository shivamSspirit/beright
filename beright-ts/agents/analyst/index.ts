/**
 * ANALYST AGENT - True Agentic Architecture
 *
 * A human-replacement agent for deep prediction market research.
 *
 * ARCHITECTURE (BeRight-compatible):
 * - LLM is the brain - it decides what tools to use
 * - Tools are defined, not hardcoded handlers
 * - Natural language in → LLM understands → LLM calls tools → LLM synthesizes
 * - No keyword matching, no switch statements
 *
 * What a senior research analyst does manually:
 * 1. Identifies reference class (historical precedent)
 * 2. Researches specific factors for/against
 * 3. Synthesizes evidence with Bayesian updating
 * 4. Calculates probability estimate
 * 5. Tracks calibration over time
 *
 * Analyst does this with superforecaster methodology.
 *
 * COGNITIVE SPECIALIZATION:
 * - Uses Claude Opus (smart model) for deep reasoning
 * - Temperature 0.4 (thoughtful, not random)
 * - Takes 5-15 seconds per analysis (depth over speed)
 */

import { SkillResponse, Mood, Market, Platform } from '../../types/index';
import { llmRoute } from '../../lib/llm';
import { searchMarkets } from '../../skills/markets';
import { estimateBaseRate, listReferenceClasses } from '../../lib/analyst/baserates';
import { gatherEvidence } from '../../lib/analyst/evidence';
import { analyze, quickTake } from '../../lib/analyst/superforecaster';
import { analyzeCalibration, suggestAdjustment } from '../../lib/analyst/calibration';
import { UnifiedMarket, MarketCategory } from '../../lib/dataFabric/types';

// ============================================================================
// ANALYST CONFIGURATION
// ============================================================================

export const ANALYST_CONFIG = {
  id: 'analyst',
  name: 'Analyst',
  model: 'claude-opus-4-5' as const,
  temperature: 0.4, // Thoughtful reasoning
  maxTokens: 4096,

  // Methodology
  methodology: 'Philip Tetlock Superforecasting',
  approach: 'Outside View (base rates) → Inside View (specific evidence) → Synthesis',

  // Cognitive mode
  cognitiveMode: 'Deep reasoning',
  responseTime: '5-15 seconds',
};

// ============================================================================
// TOOL DEFINITIONS (What Analyst can do)
// ============================================================================

export interface AnalystTool {
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
 * Analyst's available tools - the LLM decides which to use
 *
 * Categorization: DEPTH (deep research on one topic at a time)
 */
export const ANALYST_TOOLS: AnalystTool[] = [
  {
    name: 'research_market',
    description: 'Deep dive research on a specific prediction market. Finds the market, gathers all available data including current prices, volume, close date, and market metadata. Use when user wants detailed information about a specific market or topic.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Market topic or question to research (e.g., "Trump 2028 election", "Bitcoin ETF approval")' },
      },
      required: ['query'],
    },
    execute: async (params) => {
      const markets = await searchMarkets(params.query);
      if (markets.length === 0) {
        return { found: false, query: params.query, markets: [] };
      }

      // Return top 3 most relevant markets with full details
      const topMarkets = markets.slice(0, 3).map(m => ({
        id: m.marketId,
        question: m.title,
        platform: m.platform,
        yesPrice: m.yesPrice,
        volume: m.volume,
        url: m.url,
      }));

      return {
        found: true,
        query: params.query,
        markets: topMarkets,
        primaryMarket: topMarkets[0],
      };
    },
  },
  {
    name: 'estimate_probability',
    description: 'Generate a superforecaster-style probability estimate using Tetlock methodology. Combines outside view (base rates) with inside view (specific evidence) to produce a calibrated probability estimate with reasoning chain. Use when user asks for probability estimate, our view, or edge analysis.',
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The prediction market question to estimate probability for' },
        category: { type: 'string', description: 'Category: politics, crypto, sports, economics, science, technology, world, other' },
        currentMarketPrice: { type: 'number', description: 'Current market consensus price (0-1), if known' },
      },
      required: ['question'],
    },
    execute: async (params) => {
      const category = (params.category || 'other') as MarketCategory;
      const marketPrice = params.currentMarketPrice || 0.5;

      // Get base rate (outside view)
      const outsideView = await estimateBaseRate(params.question, category);

      // Create a minimal market object for evidence gathering
      const minimalMarket: UnifiedMarket = {
        id: `temp-${Date.now()}`,
        slug: 'temp',
        question: params.question,
        category,
        tags: [],
        platforms: [],
        bestBid: marketPrice - 0.02,
        bestAsk: marketPrice + 0.02,
        consensusPrice: marketPrice,
        priceRange: { min: marketPrice - 0.1, max: marketPrice + 0.1 },
        totalVolume: 0,
        totalVolume24h: 0,
        totalLiquidity: 0,
        lastUpdate: new Date(),
        status: 'active',
        isResolved: false,
        overallTrustScore: 0.5,
        platformCount: 0,
      };

      // Get inside view (specific evidence)
      const insideView = await gatherEvidence(minimalMarket, { includeNews: true });

      // Synthesize probability
      let probability = outsideView.baseRate;
      probability += insideView.insideAdjustment;
      probability = Math.max(0.01, Math.min(0.99, probability));

      // Calculate edge vs market
      const edge = probability - marketPrice;

      return {
        probability,
        marketPrice,
        edge,
        direction: edge > 0.02 ? 'YES underpriced' : edge < -0.02 ? 'NO underpriced' : 'Fair value',
        outsideView: {
          baseRate: outsideView.baseRate,
          referenceClass: outsideView.referenceClass,
          confidence: outsideView.confidence,
          reasoning: outsideView.reasoning,
        },
        insideView: {
          bullishFactors: insideView.bullishFactors.slice(0, 3),
          bearishFactors: insideView.bearishFactors.slice(0, 3),
          netDirection: insideView.netDirection,
          adjustment: insideView.insideAdjustment,
        },
        synthesis: `Starting from ${(outsideView.baseRate * 100).toFixed(0)}% base rate, adjusted by ${(insideView.insideAdjustment * 100).toFixed(0)} points based on specific evidence. Final estimate: ${(probability * 100).toFixed(0)}%`,
      };
    },
  },
  {
    name: 'gather_evidence',
    description: 'Gather and analyze specific evidence factors for a market question. Lists bullish factors (supporting YES) and bearish factors (supporting NO) with weights. Use when user wants to understand what factors support each side.',
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The market question to gather evidence for' },
        includeNews: { type: 'boolean', description: 'Whether to include recent news (default: true)' },
      },
      required: ['question'],
    },
    execute: async (params) => {
      const category = detectCategory(params.question);
      const market: UnifiedMarket = {
        id: `temp-${Date.now()}`,
        slug: 'temp',
        question: params.question,
        category,
        tags: [],
        platforms: [],
        bestBid: 0.48,
        bestAsk: 0.52,
        consensusPrice: 0.5,
        priceRange: { min: 0.4, max: 0.6 },
        totalVolume: 0,
        totalVolume24h: 0,
        totalLiquidity: 0,
        lastUpdate: new Date(),
        status: 'active',
        isResolved: false,
        overallTrustScore: 0.5,
        platformCount: 0,
      };

      const evidence = await gatherEvidence(market, {
        includeNews: params.includeNews !== false
      });

      return {
        question: params.question,
        bullishFactors: evidence.bullishFactors,
        bearishFactors: evidence.bearishFactors,
        netDirection: evidence.netDirection,
        adjustment: evidence.insideAdjustment,
        uniqueFactors: evidence.uniqueFactors,
      };
    },
  },
  {
    name: 'find_base_rate',
    description: 'Find the historical base rate for a type of event using reference class forecasting. Answers "How often do events like this happen historically?" Use when user asks about historical precedent, base rates, or outside view.',
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The question to find base rate for' },
        category: { type: 'string', description: 'Category: politics, crypto, sports, economics, science, technology, world, other' },
      },
      required: ['question'],
    },
    execute: async (params) => {
      const category = (params.category || detectCategory(params.question)) as MarketCategory;
      const baseRate = await estimateBaseRate(params.question, category);

      return {
        question: params.question,
        referenceClass: baseRate.referenceClass,
        baseRate: baseRate.baseRate,
        baseRatePct: `${(baseRate.baseRate * 100).toFixed(0)}%`,
        confidence: baseRate.confidence,
        sampleSize: baseRate.sampleSize,
        reasoning: baseRate.reasoning,
        historicalExamples: baseRate.historicalExamples,
      };
    },
  },
  {
    name: 'compare_prices',
    description: 'Compare market prices across platforms for a specific topic. Shows where the same market trades on different platforms and identifies any pricing discrepancies. Use when user wants to compare odds or find the best price.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Market topic to compare across platforms' },
      },
      required: ['query'],
    },
    execute: async (params) => {
      const markets = await searchMarkets(params.query);

      // Group by platform
      const byPlatform: Record<string, any[]> = {};
      for (const market of markets) {
        const platform = market.platform;
        if (!byPlatform[platform]) byPlatform[platform] = [];
        byPlatform[platform].push({
          question: market.title,
          yesPrice: market.yesPrice,
          volume: market.volume,
        });
      }

      // Find price range
      const prices = markets.map(m => m.yesPrice).filter(p => p > 0 && p < 1);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const spread = maxPrice - minPrice;

      return {
        query: params.query,
        platformCount: Object.keys(byPlatform).length,
        byPlatform,
        priceRange: {
          min: minPrice,
          max: maxPrice,
          spread,
          spreadPct: `${(spread * 100).toFixed(1)}%`,
        },
        arbitrageOpportunity: spread > 0.03,
        recommendation: spread > 0.03
          ? `Price discrepancy of ${(spread * 100).toFixed(1)}% detected - potential arbitrage opportunity`
          : 'Prices are relatively aligned across platforms',
      };
    },
  },
  {
    name: 'check_calibration',
    description: 'Check our historical prediction accuracy and calibration. Shows Brier score, accuracy by category, and any systematic biases (overconfidence/underconfidence). Use when user asks about accuracy, track record, or calibration.',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const calibration = analyzeCalibration();

      return {
        totalPredictions: calibration.totalPredictions,
        totalResolved: calibration.totalResolved,
        brierScore: calibration.overallBrier,
        calibrationSummary: calibration.calibrationSummary,
        isOverconfident: calibration.isOverconfident,
        isUnderconfident: calibration.isUnderconfident,
        buckets: calibration.buckets.map(b => ({
          range: b.range,
          predictions: b.predictions,
          actualRate: `${(b.actualRate * 100).toFixed(0)}%`,
          expectedRate: `${(b.expectedRate * 100).toFixed(0)}%`,
          calibrationError: `${(b.calibrationError * 100).toFixed(1)}%`,
        })),
      };
    },
  },
];

// ============================================================================
// ANALYST SYSTEM PROMPT
// ============================================================================

const ANALYST_SYSTEM_PROMPT = `You are Analyst - concise superforecaster for prediction markets.

METHODOLOGY: Outside view (base rates) + Inside view (evidence) = Probability estimate

RESPONSE FORMAT - BE BRIEF:
Our Estimate: XX% | Market: XX% | Edge: +/-X%
Confidence: low/med/high

Why: 1-2 sentence reasoning

Bull: 2-3 key factors
Bear: 2-3 key factors

Bottom line: One clear recommendation

RULES:
- No long paragraphs - use bullet points
- Skip preambles like "Let me analyze..."
- Don't repeat the question back
- Max 150 words for standard analysis
- Be direct, not academic`;

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
 * 2. LLM decides which tools to call (often multiple in sequence)
 * 3. Code executes the tools
 * 4. LLM synthesizes the final analysis
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
      const tool = ANALYST_TOOLS.find(t => t.name === toolCall.name);
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
    console.error(`[Analyst] Error:`, error);

    return {
      text: `❌ Analysis failed: ${errorMsg}`,
      mood: 'ERROR' as Mood,
    };
  }
}

/**
 * Ask the LLM to decide what tools to call
 */
async function getAgentDecision(userInput: string): Promise<AgentDecision> {
  const toolsDescription = ANALYST_TOOLS.map(t =>
    `- ${t.name}: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters.properties)}`
  ).join('\n\n');

  const decisionPrompt = `User request: "${userInput}"

Available tools:
${toolsDescription}

Decide what to do. For deep analysis, you may want to call multiple tools in sequence:
1. find_base_rate first (outside view)
2. gather_evidence second (inside view)
3. estimate_probability for synthesis

Respond in this JSON format:
{
  "reasoning": "Brief explanation of what the user wants and your analysis plan",
  "tool_calls": [
    { "name": "tool_name", "parameters": { "param": "value" } }
  ],
  "direct_response": "Only if no tools needed - your direct text response"
}

If the user's request requires analysis, plan the appropriate tool sequence.
If the request is a greeting or simple question, use direct_response.

Respond with ONLY valid JSON, no other text.`;

  const response = await llmRoute({
    agent: 'analyst',
    system: ANALYST_SYSTEM_PROMPT,
    user: decisionPrompt,
  });

  // Parse the LLM's decision
  try {
    let jsonStr = response.text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\s*/, '').replace(/```\s*$/, '');
    }

    const decision = JSON.parse(jsonStr) as AgentDecision;
    console.log(`[Analyst] Decision: ${decision.reasoning}`);
    console.log(`[Analyst] Tools to call: ${decision.tool_calls?.map(t => t.name).join(' → ') || 'none'}`);

    return decision;
  } catch (parseError) {
    console.error(`[Analyst] Failed to parse LLM decision:`, response.text);
    // Fallback: assume user wants probability estimate
    return {
      reasoning: 'Fallback: providing probability estimate',
      tool_calls: [{ name: 'estimate_probability', parameters: { question: userInput } }],
    };
  }
}

/**
 * Ask the LLM to synthesize tool results into a final analysis
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
    if (tr.tool === 'estimate_probability') {
      const r = tr.result;
      return `Tool: estimate_probability
Probability: ${(r.probability * 100).toFixed(0)}%
Market Price: ${(r.marketPrice * 100).toFixed(0)}%
Edge: ${r.edge > 0 ? '+' : ''}${(r.edge * 100).toFixed(1)}%
Direction: ${r.direction}
Base Rate: ${(r.outsideView.baseRate * 100).toFixed(0)}% (${r.outsideView.referenceClass})
Inside View: ${r.insideView.netDirection} (${(r.insideView.adjustment * 100).toFixed(0)} pts adjustment)
Bullish Factors: ${r.insideView.bullishFactors.map((f: any) => f.factor).join(', ') || 'None identified'}
Bearish Factors: ${r.insideView.bearishFactors.map((f: any) => f.factor).join(', ') || 'None identified'}
Synthesis: ${r.synthesis}`;
    }

    if (tr.tool === 'find_base_rate') {
      const r = tr.result;
      return `Tool: find_base_rate
Reference Class: ${r.referenceClass}
Base Rate: ${r.baseRatePct}
Confidence: ${r.confidence}
Reasoning: ${r.reasoning}`;
    }

    if (tr.tool === 'gather_evidence') {
      const r = tr.result;
      return `Tool: gather_evidence
Net Direction: ${r.netDirection}
Bullish Factors (${r.bullishFactors.length}):
${r.bullishFactors.map((f: any) => `  - ${f.factor} (${f.weight})`).join('\n')}
Bearish Factors (${r.bearishFactors.length}):
${r.bearishFactors.map((f: any) => `  - ${f.factor} (${f.weight})`).join('\n')}
Inside Adjustment: ${(r.adjustment * 100).toFixed(0)} percentage points`;
    }

    if (tr.tool === 'research_market') {
      const r = tr.result;
      if (!r.found) {
        return `Tool: research_market\nNo markets found for: ${r.query}`;
      }
      return `Tool: research_market
Query: ${r.query}
Markets Found: ${r.markets.length}
Primary Market: ${r.primaryMarket.question}
Current Price: ${(r.primaryMarket.yesPrice * 100).toFixed(0)}%
Volume: $${formatVolume(r.primaryMarket.volume || 0)}
Platform: ${r.primaryMarket.platform}`;
    }

    if (tr.tool === 'compare_prices') {
      const r = tr.result;
      return `Tool: compare_prices
Query: ${r.query}
Platforms: ${r.platformCount}
Price Range: ${(r.priceRange.min * 100).toFixed(0)}% - ${(r.priceRange.max * 100).toFixed(0)}%
Spread: ${r.priceRange.spreadPct}
Arbitrage Opportunity: ${r.arbitrageOpportunity ? 'YES' : 'No'}
Recommendation: ${r.recommendation}`;
    }

    if (tr.tool === 'check_calibration') {
      const r = tr.result;
      return `Tool: check_calibration
Total Predictions: ${r.totalPredictions}
Resolved: ${r.totalResolved}
Brier Score: ${r.brierScore.toFixed(3)}
Summary: ${r.calibrationSummary}`;
    }

    return `Tool: ${tr.tool}\n${JSON.stringify(tr.result, null, 2)}`;
  }).join('\n\n');

  const synthesisPrompt = `User: "${userInput}"

Data:
${resultsText}

RESPOND IN THIS EXACT FORMAT (max 150 words):

Our Estimate: XX% | Market: XX% | Edge: +/-X%
Confidence: low/med/high

Why: [1-2 sentences max]

Bull: [2-3 bullet points]
Bear: [2-3 bullet points]

Bottom line: [one clear sentence]

RULES: No preambles. No "Let me analyze". Just the analysis.`;

  const response = await llmRoute({
    agent: 'analyst',
    system: ANALYST_SYSTEM_PROMPT,
    user: synthesisPrompt,
  });

  return response.text;
}

// ============================================================================
// HELPERS
// ============================================================================

function detectCategory(question: string): MarketCategory {
  const q = question.toLowerCase();

  if (/\b(trump|biden|election|president|congress|senate|vote|governor|party|democrat|republican|poll)\b/.test(q)) {
    return 'politics';
  }
  if (/\b(bitcoin|btc|ethereum|eth|crypto|token|blockchain|solana|sol|defi|nft)\b/.test(q)) {
    return 'crypto';
  }
  if (/\b(nba|nfl|mlb|nhl|soccer|football|basketball|tennis|golf|championship|super bowl|world cup|olympics)\b/.test(q)) {
    return 'sports';
  }
  if (/\b(fed|interest rate|inflation|gdp|unemployment|stock|s&p|nasdaq|dow|recession|economy)\b/.test(q)) {
    return 'economics';
  }
  if (/\b(climate|space|nasa|vaccine|covid|pandemic|ai|artificial intelligence|research|study)\b/.test(q)) {
    return 'science';
  }
  if (/\b(apple|google|microsoft|amazon|meta|facebook|twitter|startup|tech|product launch)\b/.test(q)) {
    return 'technology';
  }
  if (/\b(war|russia|ukraine|china|nato|un|conflict|treaty|international)\b/.test(q)) {
    return 'world';
  }

  return 'other';
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return `${v.toFixed(0)}`;
}

function formatFinalResponse(text: string, executionMs: number): string {
  // Clean, minimal formatting - no verbose headers/footers
  return `[ANALYST] ${(executionMs / 1000).toFixed(1)}s\n\n${text}`;
}

function determineMood(toolResults: Array<{ tool: string; result: any; error?: string }>): Mood {
  // Check for errors
  if (toolResults.some(tr => tr.error)) return 'ERROR';

  // Check for positive edge (bullish)
  const probResult = toolResults.find(tr => tr.tool === 'estimate_probability');
  if (probResult?.result?.edge > 0.05) return 'BULLISH';
  if (probResult?.result?.edge < -0.05) return 'BEARISH';

  return 'NEUTRAL';
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  id: ANALYST_CONFIG.id,
  name: ANALYST_CONFIG.name,
  execute,
  tools: ANALYST_TOOLS,
  config: ANALYST_CONFIG,
};
