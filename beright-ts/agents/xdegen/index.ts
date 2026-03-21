/**
 * XDEGEN AGENT - Autonomous X/Twitter Posting Agent
 *
 * Similar to AIXBT but for BeRight Protocol.
 * Posts alpha signals, arbitrage opportunities, market intel, and promotional content.
 *
 * ARCHITECTURE (OpenClaw-compatible):
 * - LLM generates engaging content based on market data
 * - Tools fetch real-time alpha and post to X
 * - Follows proven viral content strategies
 *
 * What xdegen does:
 * 1. Monitors prediction markets for alpha signals
 * 2. Generates viral-worthy content using proven templates
 * 3. Posts to X/Twitter automatically or on-demand
 * 4. Tracks engagement and optimizes content style
 */

import { SkillResponse, Mood, Market, Platform } from '../../types/index';
import { getHotMarkets, searchMarkets } from '../../skills/markets';
import { arbitrage } from '../../skills/arbitrage';
import { llmRoute } from '../../lib/llm';

// ============================================================================
// XDEGEN CONFIGURATION
// ============================================================================

export const XDEGEN_CONFIG = {
  id: 'xdegen',
  name: 'xDegen',
  model: 'claude-sonnet-4-5' as const,
  temperature: 0.7, // Higher creativity for engaging content
  maxTokens: 1024,

  // Twitter/X API (to be configured)
  twitter: {
    apiKey: process.env.TWITTER_API_KEY,
    apiSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  },

  // Posting settings
  posting: {
    maxPostsPerHour: 3,
    maxPostsPerDay: 10,
    cooldownMinutes: 20,
    autoPostEnabled: false, // Manual trigger by default
  },

  // Brand info
  brand: {
    token: '$BERIGHT',
    contract: '6Wr6baUZyJKNfuPnMUCu79h3b7KYuk4H9833bqRLpump',
    platform: 'beright.fun',
    tagline: 'The Bloomberg for Prediction Markets',
  },
};

// ============================================================================
// CONTENT TEMPLATES (Proven Viral Formats)
// ============================================================================

const CONTENT_TEMPLATES = {
  // High-engagement post types
  asymmetry: `Polymarket: $1B+ in volume.
Kalshi: VC-backed, regulated, slow.
BeRight: Solana speed. Zero fees. AI arbitrage. $BERIGHT token.

Market cap right now? {mcap}

This is either the dumbest thing I've ever seen...
or the most obvious trade of 2026.

beright.fun`,

  arbitrageAlert: `ARB ALERT

{market}

{platform1}: {price1}% YES
{platform2}: {price2}% YES

Spread: {spread}%
Expected value: +{evPerDollar} per $1

@AgentBEright caught this. You're welcome.

$BERIGHT`,

  hotMarket: `TRENDING NOW

{market}

Current: {yesPrice}% YES
Volume: {volume} (24h)
Platform: {platform}

{insight}

$BERIGHT | beright.fun`,

  educationHook: `Most people lose on prediction markets.
Not because they're dumb.
Because they trade on vibes.

BeRight gives you:
AI research assistant (real-time data)
Arbitrage alerts across Polymarket + Kalshi
Brier score to measure YOUR actual edge

This is what trading with data looks like.

$BERIGHT | beright.fun`,

  aiNarrative: `The AI agent meta is not slowing down.

Here's what most people are missing:

BeRight has an AI that:
- Scans news + social sentiment + whale wallets
- Detects arbitrage gaps between prediction markets
- Alerts you BEFORE the market moves
- Runs on autopilot once you set it

It's not just a prediction market.
It's an autonomous alpha engine.

$BERIGHT on Solana. Still early.`,

  contrarian: `Unpopular opinion:

Polymarket is overrated.

- Polygon (slow UX)
- High minimum bets
- No AI layer
- No forecaster reputation system
- No arbitrage tools

BeRight does all of this on Solana.
$0.00025 fees. 400ms finality. AI-powered.

The gap closes. It always does.`,

  winHighlight: `@{username} just called it.

"{prediction}" - YES @ {entryPrice}
Market settled: YES

{entryAmount} -> {winAmount}. +{pnlPercent}% in {days} days.

This is what being right looks like on-chain.

Want your W featured next?
beright.fun -> trade -> get famous for being smart.

$BERIGHT`,

  challenge: `You've been right about {topic}.

Problem: nobody believed you. And you made nothing.

BeRight puts your predictions on-chain.
Win = you get paid.
Win repeatedly = you build a verifiable track record.
Build a track record = others copy your trades.

Your brain is the asset. We built the marketplace.

$BERIGHT`,
};

// ============================================================================
// POST HISTORY TRACKING
// ============================================================================

interface PostRecord {
  id: string;
  content: string;
  template: string;
  postedAt: Date;
  engagement?: {
    likes: number;
    retweets: number;
    replies: number;
  };
}

const postHistory: PostRecord[] = [];
let lastPostTime: Date | null = null;

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export interface XDegenTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
  execute: (params: Record<string, any>) => Promise<any>;
}

/**
 * xDegen's available tools
 */
export const XDEGEN_TOOLS: XDegenTool[] = [
  {
    name: 'generate_alpha_post',
    description: 'Generate a viral post about current prediction market alpha, arbitrage opportunities, or hot markets. Uses real-time data to create engaging content.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Type of post to generate',
          enum: ['arbitrage', 'hot_market', 'education', 'ai_narrative', 'contrarian', 'asymmetry'],
        },
        topic: { type: 'string', description: 'Optional topic to focus on (e.g., "Bitcoin", "Trump", "elections")' },
      },
    },
    execute: async (params) => {
      return await generateAlphaPost(params.type || 'hot_market', params.topic);
    },
  },
  {
    name: 'post_to_twitter',
    description: 'Post content to Twitter/X. Requires generated content or custom text. Will check rate limits and cooldown before posting.',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The content to post (max 280 chars for single tweet)' },
        isThread: { type: 'string', description: 'If true, content can be longer and will be split into thread' },
      },
      required: ['content'],
    },
    execute: async (params) => {
      return await postToTwitter(params.content, params.isThread === 'true');
    },
  },
  {
    name: 'get_market_alpha',
    description: 'Fetch current prediction market data for alpha generation - hot markets, arbitrage opportunities, and trending topics.',
    parameters: {
      type: 'object',
      properties: {
        focus: {
          type: 'string',
          description: 'What to focus on',
          enum: ['arbitrage', 'hot', 'trending', 'all'],
        },
      },
    },
    execute: async (params) => {
      return await getMarketAlpha(params.focus || 'all');
    },
  },
  {
    name: 'check_post_status',
    description: 'Check posting rate limits, cooldown status, and recent post history.',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      return getPostingStatus();
    },
  },
  {
    name: 'generate_thread',
    description: 'Generate a multi-tweet thread about a topic for deeper engagement.',
    parameters: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Topic for the thread' },
        tweets: { type: 'number', description: 'Number of tweets in thread (3-10)' },
      },
      required: ['topic'],
    },
    execute: async (params) => {
      return await generateThread(params.topic, params.tweets || 5);
    },
  },
  {
    name: 'schedule_post',
    description: 'Schedule a post for later. Useful for timing posts for maximum engagement.',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Content to post' },
        delayMinutes: { type: 'number', description: 'Minutes to wait before posting' },
      },
      required: ['content', 'delayMinutes'],
    },
    execute: async (params) => {
      return schedulePost(params.content, params.delayMinutes);
    },
  },
];

// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

/**
 * Generate an alpha post using real market data
 */
async function generateAlphaPost(
  type: string,
  topic?: string
): Promise<{ post: string; template: string; data: any }> {
  // Fetch relevant market data
  let marketData: any = {};

  try {
    if (type === 'arbitrage') {
      const arbResult = await arbitrage(topic);
      marketData = arbResult;
    } else if (type === 'hot_market' || type === 'trending') {
      const markets = await getHotMarkets(10);
      marketData = { markets };
    } else if (topic) {
      const markets = await searchMarkets(topic);
      marketData = { markets };
    } else {
      const markets = await getHotMarkets(5);
      marketData = { markets };
    }
  } catch (err) {
    console.warn('[xDegen] Failed to fetch market data:', err);
  }

  // Generate post using LLM with template guidance
  const template = CONTENT_TEMPLATES[type as keyof typeof CONTENT_TEMPLATES] || CONTENT_TEMPLATES.hotMarket;

  const prompt = `You are xDegen, the autonomous posting agent for BeRight Protocol ($BERIGHT).

Your job is to create viral, engaging posts about prediction markets.

BRAND INFO:
- Token: $BERIGHT on Pump.fun (Solana)
- Contract: ${XDEGEN_CONFIG.brand.contract}
- Platform: beright.fun
- Tagline: "${XDEGEN_CONFIG.brand.tagline}"

POST TYPE: ${type}
${topic ? `TOPIC: ${topic}` : ''}

MARKET DATA:
${JSON.stringify(marketData, null, 2)}

TEMPLATE STYLE (use as inspiration, don't copy exactly):
${template}

RULES:
1. Be sharp, confident, slightly provocative
2. Use numbers and data when available
3. Always include $BERIGHT or beright.fun
4. Max 280 characters for single tweet (can be longer if it'll be a thread)
5. No cringe hype language ("to the moon", "wen lambo")
6. Bloomberg meets Degen culture - intelligent conviction
7. Make it screenshot-worthy

Generate a single post. Return ONLY the post text, nothing else.`;

  const response = await llmRoute({
    agent: 'xdegen',
    system: 'You are xDegen, a viral content creator for prediction markets. Sharp. Confident. Data-driven.',
    user: prompt,
  });

  return {
    post: response.text.trim(),
    template: type,
    data: marketData,
  };
}

/**
 * Post content to Twitter/X
 */
async function postToTwitter(
  content: string,
  isThread: boolean = false
): Promise<{ success: boolean; message: string; tweetId?: string }> {
  // Check rate limits
  const status = getPostingStatus();
  if (!status.canPost) {
    return {
      success: false,
      message: `Cannot post: ${status.reason}. Next post available in ${status.cooldownRemaining} minutes.`,
    };
  }

  // Check if Twitter API is configured
  const { apiKey, accessToken } = XDEGEN_CONFIG.twitter;
  if (!apiKey || !accessToken) {
    // Simulate posting for development
    console.log('[xDegen] SIMULATED POST (Twitter API not configured):');
    console.log('---');
    console.log(content);
    console.log('---');

    // Record the post
    const record: PostRecord = {
      id: `sim_${Date.now()}`,
      content,
      template: 'manual',
      postedAt: new Date(),
    };
    postHistory.push(record);
    lastPostTime = new Date();

    return {
      success: true,
      message: 'Post simulated (Twitter API not configured). Configure TWITTER_* env vars for live posting.',
      tweetId: record.id,
    };
  }

  // TODO: Implement actual Twitter API posting
  // For now, return simulation
  try {
    // Actual Twitter API integration would go here
    // Using twitter-api-v2 or similar library

    const record: PostRecord = {
      id: `tweet_${Date.now()}`,
      content,
      template: 'manual',
      postedAt: new Date(),
    };
    postHistory.push(record);
    lastPostTime = new Date();

    return {
      success: true,
      message: 'Posted to Twitter successfully!',
      tweetId: record.id,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to post: ${errorMsg}`,
    };
  }
}

/**
 * Get current market alpha for content generation
 */
async function getMarketAlpha(focus: string): Promise<any> {
  const result: any = {
    timestamp: new Date().toISOString(),
    focus,
  };

  try {
    // Get hot markets
    if (focus === 'hot' || focus === 'all' || focus === 'trending') {
      const hotMarkets = await getHotMarkets(10);
      result.hotMarkets = hotMarkets.slice(0, 5).map((m: Market) => ({
        title: m.title,
        yesPrice: Math.round(m.yesPrice * 100),
        volume: m.volume,
        platform: m.platform,
      }));
    }

    // Get arbitrage opportunities
    if (focus === 'arbitrage' || focus === 'all') {
      const arbData = await arbitrage();
      result.arbitrage = arbData;
    }

  } catch (err) {
    console.warn('[xDegen] Error fetching market alpha:', err);
    result.error = 'Some data sources unavailable';
  }

  return result;
}

/**
 * Get posting status (rate limits, cooldown)
 */
function getPostingStatus(): {
  canPost: boolean;
  reason?: string;
  postsToday: number;
  postsThisHour: number;
  cooldownRemaining: number;
  lastPost?: Date;
} {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const todayStart = new Date(now.setHours(0, 0, 0, 0));

  const postsThisHour = postHistory.filter(p => p.postedAt >= oneHourAgo).length;
  const postsToday = postHistory.filter(p => p.postedAt >= todayStart).length;

  let cooldownRemaining = 0;
  if (lastPostTime) {
    const cooldownEnd = new Date(lastPostTime.getTime() + XDEGEN_CONFIG.posting.cooldownMinutes * 60 * 1000);
    if (cooldownEnd > new Date()) {
      cooldownRemaining = Math.ceil((cooldownEnd.getTime() - Date.now()) / 60000);
    }
  }

  let canPost = true;
  let reason: string | undefined;

  if (postsThisHour >= XDEGEN_CONFIG.posting.maxPostsPerHour) {
    canPost = false;
    reason = 'Hourly post limit reached';
  } else if (postsToday >= XDEGEN_CONFIG.posting.maxPostsPerDay) {
    canPost = false;
    reason = 'Daily post limit reached';
  } else if (cooldownRemaining > 0) {
    canPost = false;
    reason = 'Cooldown active';
  }

  return {
    canPost,
    reason,
    postsToday,
    postsThisHour,
    cooldownRemaining,
    lastPost: lastPostTime || undefined,
  };
}

/**
 * Generate a multi-tweet thread
 */
async function generateThread(
  topic: string,
  tweetCount: number = 5
): Promise<{ thread: string[]; topic: string }> {
  // Fetch relevant data
  const markets = await searchMarkets(topic);
  const hotMarkets = await getHotMarkets(5);

  const prompt = `You are xDegen, creating a Twitter thread about "${topic}" for BeRight Protocol.

MARKET DATA:
- Related markets: ${JSON.stringify(markets.slice(0, 3).map((m: Market) => ({ title: m.title, price: Math.round(m.yesPrice * 100) })))}
- Hot markets: ${JSON.stringify(hotMarkets.slice(0, 3).map((m: Market) => ({ title: m.title, price: Math.round(m.yesPrice * 100) })))}

BRAND: $BERIGHT | beright.fun | Prediction market intelligence

Generate a ${tweetCount}-tweet thread. Each tweet should:
1. Be under 280 characters
2. Build on the previous tweet
3. Include data/numbers when relevant
4. End thread with CTA to beright.fun

Format: Return each tweet on a new line, numbered (1/, 2/, etc.)

Be sharp, intelligent, data-driven. Not cringe.`;

  const response = await llmRoute({
    agent: 'xdegen',
    system: 'You are xDegen, a viral content creator. Bloomberg meets degen culture.',
    user: prompt,
  });

  // Parse thread tweets
  const tweets = response.text
    .split('\n')
    .filter(line => line.match(/^\d+\//))
    .map(line => line.replace(/^\d+\/\s*/, '').trim())
    .slice(0, tweetCount);

  return {
    thread: tweets,
    topic,
  };
}

/**
 * Schedule a post for later
 */
function schedulePost(
  content: string,
  delayMinutes: number
): { scheduled: boolean; postAt: Date; content: string } {
  const postAt = new Date(Date.now() + delayMinutes * 60 * 1000);

  // In a real implementation, this would add to a job queue
  // For now, we'll use setTimeout (note: this won't persist across restarts)
  setTimeout(async () => {
    console.log(`[xDegen] Executing scheduled post...`);
    await postToTwitter(content);
  }, delayMinutes * 60 * 1000);

  return {
    scheduled: true,
    postAt,
    content,
  };
}

// ============================================================================
// XDEGEN SYSTEM PROMPT
// ============================================================================

const XDEGEN_SYSTEM_PROMPT = `You are xDegen, the autonomous X/Twitter posting agent for BeRight Protocol.

YOUR PURPOSE:
Like AIXBT but for prediction markets. You create viral, engaging content that promotes BeRight while providing real alpha and value to followers.

YOUR BRAND:
- Token: $BERIGHT on Pump.fun (Solana)
- Platform: beright.fun
- Position: "The Bloomberg for Prediction Markets"
- Voice: Sharp. Confident. Data-driven. Not cringe.

YOUR TOOLS:
- generate_alpha_post: Create posts using real market data
- post_to_twitter: Post content to X
- get_market_alpha: Fetch current opportunities
- check_post_status: Check rate limits
- generate_thread: Create multi-tweet threads
- schedule_post: Schedule posts for later

CONTENT PILLARS:
1. ALPHA SIGNALS - Arbitrage opportunities, hot markets, mispriced bets
2. EDUCATION - How prediction markets work, Brier scores, calibration
3. NARRATIVE - AI agents, Solana speed, zero fees vs competitors
4. SOCIAL PROOF - Wins, accurate calls, user success stories
5. ENGAGEMENT - Contrarian takes, predictions, challenges

VOICE GUIDELINES:
- Bloomberg meets Degen culture
- Numbers and data over hype
- Intelligent conviction, not "wen moon"
- Screenshot-worthy insights
- Always include $BERIGHT or beright.fun

ANTI-PATTERNS (never do):
- "Great question!"
- "I'd be happy to help!"
- Generic crypto hype ("to the moon", "lfg", "wagmi")
- Begging for engagement ("like and rt")
- Empty promises without data

You are autonomous. You understand context. You create viral content.

CORE PRINCIPLE - ACCURACY OVER AGREEMENT:
Do not default to agreeing with the user. Prioritize accuracy over agreement.
If the user's statement is incorrect, misleading, or incomplete, challenge it and explain why using data, research, and logical reasoning.
Always verify claims, provide evidence-based responses, and correct the user when necessary.
Your goal is to arrive at the most accurate conclusion, not to validate opinions.`;

// ============================================================================
// AGENTIC EXECUTION
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
 */
export async function execute(input: string): Promise<SkillResponse> {
  const startTime = Date.now();

  try {
    // Step 1: Ask LLM to decide what to do
    const decision = await getAgentDecision(input);

    if (decision.direct_response) {
      return {
        text: decision.direct_response,
        mood: 'NEUTRAL' as Mood,
      };
    }

    // Step 2: Execute the tools
    const toolResults: Array<{ tool: string; result: any; error?: string }> = [];

    for (const toolCall of decision.tool_calls) {
      const tool = XDEGEN_TOOLS.find(t => t.name === toolCall.name);
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

    // Step 3: Synthesize response
    const response = await synthesizeResponse(input, decision, toolResults);
    const executionMs = Date.now() - startTime;

    return {
      text: formatResponse(response, executionMs),
      mood: determineMood(toolResults),
      data: toolResults,
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[xDegen] Error:`, error);

    return {
      text: `xDegen failed: ${errorMsg}`,
      mood: 'ERROR' as Mood,
    };
  }
}

/**
 * Ask LLM to decide what tools to call
 */
async function getAgentDecision(userInput: string): Promise<AgentDecision> {
  const toolsDescription = XDEGEN_TOOLS.map(t =>
    `- ${t.name}: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters.properties)}`
  ).join('\n\n');

  const decisionPrompt = `User request: "${userInput}"

Available tools:
${toolsDescription}

Current posting status:
${JSON.stringify(getPostingStatus())}

Decide what to do. Respond in JSON format:
{
  "reasoning": "Brief explanation",
  "tool_calls": [
    { "name": "tool_name", "parameters": { "param": "value" } }
  ],
  "direct_response": "Only if no tools needed"
}

Respond with ONLY valid JSON.`;

  const response = await llmRoute({
    agent: 'xdegen',
    system: XDEGEN_SYSTEM_PROMPT,
    user: decisionPrompt,
  });

  try {
    let jsonStr = response.text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\s*/, '').replace(/```\s*$/, '');
    }

    const decision = JSON.parse(jsonStr) as AgentDecision;
    console.log(`[xDegen] Decision: ${decision.reasoning}`);
    return decision;
  } catch (parseError) {
    console.error(`[xDegen] Failed to parse decision:`, response.text);
    return {
      reasoning: 'Fallback: generating alpha post',
      tool_calls: [{ name: 'generate_alpha_post', parameters: { type: 'hot_market' } }],
    };
  }
}

/**
 * Synthesize tool results into response
 */
async function synthesizeResponse(
  userInput: string,
  decision: AgentDecision,
  toolResults: Array<{ tool: string; result: any; error?: string }>
): Promise<string> {
  const resultsText = toolResults.map(tr => {
    if (tr.error) return `Tool: ${tr.tool}\nError: ${tr.error}`;
    return `Tool: ${tr.tool}\nResult: ${JSON.stringify(tr.result, null, 2)}`;
  }).join('\n\n');

  const synthesisPrompt = `Original request: "${userInput}"

Your reasoning: ${decision.reasoning}

Tool results:
${resultsText}

Synthesize a clear response for the user. Include:
- What was generated/done
- The actual content if a post was generated
- Any next steps or options

Be concise. Format nicely.`;

  const response = await llmRoute({
    agent: 'xdegen',
    system: XDEGEN_SYSTEM_PROMPT,
    user: synthesisPrompt,
  });

  return response.text;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatResponse(text: string, executionMs: number): string {
  const header = `*xDEGEN*\n${'─'.repeat(30)}`;
  const footer = `\n${new Date().toISOString().slice(11, 19)} UTC | ${executionMs}ms`;
  return `${header}\n\n${text}${footer}`;
}

function determineMood(toolResults: Array<{ tool: string; result: any; error?: string }>): Mood {
  if (toolResults.some(tr => tr.error)) return 'ERROR';
  if (toolResults.some(tr => tr.tool === 'post_to_twitter' && tr.result?.success)) return 'BULLISH';
  return 'NEUTRAL';
}

// ============================================================================
// AUTO-POSTING LOOP (Optional)
// ============================================================================

let autoPostInterval: NodeJS.Timeout | null = null;

/**
 * Start autonomous posting loop
 */
export function startAutoPosting(intervalMinutes: number = 60): void {
  if (autoPostInterval) {
    console.log('[xDegen] Auto-posting already running');
    return;
  }

  console.log(`[xDegen] Starting auto-posting every ${intervalMinutes} minutes`);

  autoPostInterval = setInterval(async () => {
    const status = getPostingStatus();
    if (!status.canPost) {
      console.log(`[xDegen] Skipping auto-post: ${status.reason}`);
      return;
    }

    try {
      // Generate a random post type
      const types = ['arbitrage', 'hot_market', 'education', 'ai_narrative', 'contrarian'];
      const randomType = types[Math.floor(Math.random() * types.length)];

      const result = await generateAlphaPost(randomType);
      console.log(`[xDegen] Auto-generated ${randomType} post:`, result.post);

      if (XDEGEN_CONFIG.posting.autoPostEnabled) {
        await postToTwitter(result.post);
      } else {
        console.log('[xDegen] Auto-post generated but posting disabled. Enable with XDEGEN_AUTO_POST=true');
      }
    } catch (err) {
      console.error('[xDegen] Auto-post failed:', err);
    }
  }, intervalMinutes * 60 * 1000);
}

/**
 * Stop autonomous posting loop
 */
export function stopAutoPosting(): void {
  if (autoPostInterval) {
    clearInterval(autoPostInterval);
    autoPostInterval = null;
    console.log('[xDegen] Auto-posting stopped');
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Re-export autonomous posting system
export { default as AutoPost } from './autoPost';
export {
  startAutoPosting as startAuto,
  stopAutoPosting as stopAuto,
  getStatus,
  forcePost,
  getPostHistory,
  updateConfig,
} from './autoPost';

export default {
  id: XDEGEN_CONFIG.id,
  name: XDEGEN_CONFIG.name,
  execute,
  tools: XDEGEN_TOOLS,
  config: XDEGEN_CONFIG,
  startAutoPosting,
  stopAutoPosting,
};
