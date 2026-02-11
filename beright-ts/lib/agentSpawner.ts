/**
 * Agent Spawner - Multi-agent delegation system for BeRight Protocol
 *
 * Handles spawning specialist agents (scout, analyst, trader) from the orchestrator.
 * Uses OpenClaw agent protocol for inter-agent communication.
 */

import { SkillResponse, Mood } from '../types/index';
import { AGENTS, AgentConfig, isAgentAllowed, getAgentConfig } from '../config/agents';

// Agent execution context
export interface AgentContext {
  userId?: string;
  username?: string;
  conversationId?: string;
  parentAgent?: string;
}

// Agent task request
export interface AgentTask {
  agentId: string;
  task: string;
  context?: AgentContext;
  priority?: 'low' | 'normal' | 'high';
  timeout?: number;
}

// Agent task result
export interface AgentResult {
  agentId: string;
  success: boolean;
  response: SkillResponse;
  executionTimeMs: number;
  tokensUsed?: number;
}

// Spawn status for tracking
export interface SpawnStatus {
  id: string;
  agentId: string;
  task: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  result?: AgentResult;
}

// Active spawns (in-memory tracking)
const activeSpawns = new Map<string, SpawnStatus>();

/**
 * Generate unique spawn ID
 */
function generateSpawnId(): string {
  return `spawn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Spawn an agent to handle a task
 *
 * This is the main entry point for multi-agent delegation.
 * The orchestrator calls this to delegate work to specialist agents.
 */
export async function spawnAgent(task: AgentTask): Promise<AgentResult> {
  const { agentId, task: taskDescription, context, priority = 'normal', timeout = 30000 } = task;

  // Validate agent
  if (!isAgentAllowed(agentId)) {
    return {
      agentId,
      success: false,
      response: {
        text: `❌ Agent "${agentId}" is not in the spawn allowlist.\n\nAllowed agents: scout, analyst, trader`,
        mood: 'ERROR' as Mood,
      },
      executionTimeMs: 0,
    };
  }

  const agentConfig = getAgentConfig(agentId);
  if (!agentConfig) {
    return {
      agentId,
      success: false,
      response: {
        text: `❌ Agent "${agentId}" not found in configuration.`,
        mood: 'ERROR' as Mood,
      },
      executionTimeMs: 0,
    };
  }

  // Create spawn tracking
  const spawnId = generateSpawnId();
  const spawnStatus: SpawnStatus = {
    id: spawnId,
    agentId,
    task: taskDescription,
    status: 'running',
    startedAt: new Date(),
  };
  activeSpawns.set(spawnId, spawnStatus);

  const startTime = Date.now();

  try {
    // Execute agent task
    const result = await executeAgentTask(agentConfig, taskDescription, context, timeout);

    // Update spawn status
    spawnStatus.status = 'completed';
    spawnStatus.completedAt = new Date();
    spawnStatus.result = result;

    return result;
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;

    // Update spawn status
    spawnStatus.status = 'failed';
    spawnStatus.completedAt = new Date();

    return {
      agentId,
      success: false,
      response: {
        text: `❌ Agent ${agentConfig.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        mood: 'ERROR' as Mood,
      },
      executionTimeMs,
    };
  }
}

/**
 * Execute the actual agent task
 *
 * In a full OpenClaw deployment, this would spawn a subprocess or
 * make an API call to the agent runtime. For now, we execute inline
 * with the agent's system prompt and tools.
 */
async function executeAgentTask(
  agent: AgentConfig,
  task: string,
  context?: AgentContext,
  timeout?: number
): Promise<AgentResult> {
  const startTime = Date.now();

  // Import the relevant skills based on agent tools
  const toolResults: Record<string, unknown> = {};

  // Execute based on agent type
  switch (agent.id) {
    case 'scout':
      return await executeScoutTask(agent, task, context);

    case 'analyst':
      return await executeAnalystTask(agent, task, context);

    case 'trader':
      return await executeTraderTask(agent, task, context);

    default:
      return {
        agentId: agent.id,
        success: false,
        response: {
          text: `Unknown agent type: ${agent.id}`,
          mood: 'ERROR' as Mood,
        },
        executionTimeMs: Date.now() - startTime,
      };
  }
}

/**
 * Scout agent execution - Fast market scanning
 */
async function executeScoutTask(
  agent: AgentConfig,
  task: string,
  context?: AgentContext
): Promise<AgentResult> {
  const startTime = Date.now();

  // Import scout tools
  const { arbitrage } = await import('../skills/arbitrage');
  const { getHotMarkets, searchMarkets } = await import('../skills/markets');
  const { newsSearch } = await import('../skills/intel');

  // Determine task type from keywords
  const taskLower = task.toLowerCase();

  let response: SkillResponse;

  if (taskLower.includes('arb') || taskLower.includes('arbitrage') || taskLower.includes('spread')) {
    // Arbitrage scanning
    const query = extractQuery(task);
    response = await arbitrage(query || undefined);

    // Enhance response with scout branding
    response.text = `🔍 *SCOUT SCAN: ARBITRAGE*\n${'─'.repeat(30)}\n\n${response.text}`;
  } else if (taskLower.includes('hot') || taskLower.includes('trending')) {
    // Hot markets
    const markets = await getHotMarkets(10);
    response = {
      text: formatScoutMarkets(markets, 'TRENDING'),
      mood: 'BULLISH' as Mood,
      data: markets,
    };
  } else if (taskLower.includes('news')) {
    // News scanning
    const query = extractQuery(task) || 'prediction market';
    response = await newsSearch(query);
    response.text = `🔍 *SCOUT SCAN: NEWS*\n${'─'.repeat(30)}\n\n${response.text}`;
  } else {
    // General market search
    const query = extractQuery(task) || task;
    const markets = await searchMarkets(query);
    response = {
      text: formatScoutMarkets(markets, `SEARCH: ${query}`),
      mood: markets.length > 0 ? 'NEUTRAL' as Mood : 'NEUTRAL' as Mood,
      data: markets,
    };
  }

  return {
    agentId: agent.id,
    success: true,
    response,
    executionTimeMs: Date.now() - startTime,
  };
}

/**
 * Analyst agent execution - Deep research
 */
async function executeAnalystTask(
  agent: AgentConfig,
  task: string,
  context?: AgentContext
): Promise<AgentResult> {
  const startTime = Date.now();

  // Import analyst tools
  const { research } = await import('../skills/research');
  const { calibration } = await import('../skills/calibration');
  const { compareOdds } = await import('../skills/markets');

  const taskLower = task.toLowerCase();
  let response: SkillResponse;

  if (taskLower.includes('calibration') || taskLower.includes('accuracy')) {
    // Calibration analysis
    response = await calibration();
    response.text = `📊 *ANALYST REPORT: CALIBRATION*\n${'─'.repeat(30)}\n\n${response.text}`;
  } else if (taskLower.includes('odds') || taskLower.includes('compare')) {
    // Odds comparison
    const query = extractQuery(task);
    if (query) {
      const comparison = await compareOdds(query);
      response = {
        text: formatAnalystComparison(comparison, query),
        mood: 'NEUTRAL' as Mood,
        data: comparison,
      };
    } else {
      response = {
        text: '📊 *ANALYST*\n\nUsage: Provide a topic to compare odds across platforms.',
        mood: 'NEUTRAL' as Mood,
      };
    }
  } else {
    // Deep research
    const query = extractQuery(task) || task;
    response = await research(query);
    response.text = `📊 *ANALYST REPORT: ${query.toUpperCase()}*\n${'─'.repeat(30)}\n\n${response.text}`;
  }

  return {
    agentId: agent.id,
    success: true,
    response,
    executionTimeMs: Date.now() - startTime,
  };
}

/**
 * Trader agent execution - Trade execution
 */
async function executeTraderTask(
  agent: AgentConfig,
  task: string,
  context?: AgentContext
): Promise<AgentResult> {
  const startTime = Date.now();

  // Import trader tools
  const { getQuote } = await import('../skills/swap');
  const { getTradeQuote } = await import('../skills/trade');
  const { whaleWatch } = await import('../skills/whale');

  const taskLower = task.toLowerCase();
  let response: SkillResponse;

  if (taskLower.includes('swap')) {
    // Token swap
    const swapMatch = task.match(/(\d+(?:\.\d+)?)\s+(\w+)\s+(?:to|for|->)\s+(\w+)/i);
    if (swapMatch) {
      const [, amount, from, to] = swapMatch;
      const quote = await getQuote(from.toUpperCase(), to.toUpperCase(), parseFloat(amount));
      response = formatTraderSwapQuote(quote, parseFloat(amount), from, to);
    } else {
      response = {
        text: `💱 *TRADER: SWAP*\n${'─'.repeat(30)}\n\nUsage: swap <amount> <from> to <to>\nExample: swap 1 SOL to USDC`,
        mood: 'EDUCATIONAL' as Mood,
      };
    }
  } else if (taskLower.includes('whale')) {
    // Whale tracking
    response = await whaleWatch();
    response.text = `💱 *TRADER: WHALE ACTIVITY*\n${'─'.repeat(30)}\n\n${response.text}`;
  } else if (taskLower.includes('buy') || taskLower.includes('trade')) {
    // Trade quote
    const tradeMatch = task.match(/(\w+[-\w]*)\s+(yes|no)\s+(\d+(?:\.\d+)?)/i);
    if (tradeMatch) {
      const [, ticker, direction, amount] = tradeMatch;
      const result = await getTradeQuote(
        ticker.toUpperCase(),
        direction.toUpperCase() as 'YES' | 'NO',
        parseFloat(amount)
      );
      response = formatTraderQuote(result, ticker, direction, amount);
    } else {
      response = {
        text: `💱 *TRADER: BUY*\n${'─'.repeat(30)}\n\nUsage: buy <ticker> <YES|NO> <amount>\nExample: buy KXBTC-24DEC31 YES 10`,
        mood: 'EDUCATIONAL' as Mood,
      };
    }
  } else {
    response = {
      text: `💱 *TRADER*\n${'─'.repeat(30)}\n\nAvailable commands:\n• swap <amount> <from> to <to>\n• buy <ticker> <YES|NO> <amount>\n• whale - Track whale activity`,
      mood: 'NEUTRAL' as Mood,
    };
  }

  return {
    agentId: agent.id,
    success: true,
    response,
    executionTimeMs: Date.now() - startTime,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function extractQuery(text: string): string | null {
  // Remove command prefix and common keywords
  const cleaned = text
    .replace(/^\/\w+\s*/i, '')
    .replace(/^(scan|search|find|check|get|show)\s+/i, '')
    .trim();
  return cleaned || null;
}

function formatScoutMarkets(markets: any[], title: string): string {
  let text = `🔍 *SCOUT SCAN: ${title}*\n${'─'.repeat(30)}\n\n`;

  if (markets.length === 0) {
    text += 'No markets found.\n';
    return text;
  }

  for (let i = 0; i < Math.min(10, markets.length); i++) {
    const m = markets[i];
    const platformEmoji = m.platform === 'polymarket' ? '🟣' : m.platform === 'kalshi' ? '🔵' : '🟡';
    const urgency = m.volume > 100000 ? '🔴' : m.volume > 10000 ? '🟡' : '🟢';

    text += `${urgency} ${platformEmoji} *${(m.title || m.question || '').slice(0, 35)}*\n`;
    text += `   YES: ${((m.yesPrice || m.yesPct || 50) * (m.yesPrice > 1 ? 1 : 100)).toFixed(0)}% | Vol: $${formatVolume(m.volume || 0)}\n\n`;
  }

  text += `\n⏱️ Scanned at ${new Date().toLocaleTimeString()}`;
  return text;
}

function formatAnalystComparison(comparison: any, query: string): string {
  let text = `📊 *ANALYST: ODDS COMPARISON*\n${'─'.repeat(30)}\n\n`;
  text += `Query: "${query}"\n\n`;

  if (!comparison || !comparison.markets || comparison.markets.length === 0) {
    text += 'No comparable markets found across platforms.\n';
    return text;
  }

  text += '*Platform Comparison:*\n\n';
  for (const m of comparison.markets.slice(0, 5)) {
    const platformEmoji = m.platform === 'polymarket' ? '🟣' : m.platform === 'kalshi' ? '🔵' : '🟡';
    text += `${platformEmoji} *${m.platform}*\n`;
    text += `   ${(m.title || '').slice(0, 40)}\n`;
    text += `   YES: ${((m.yesPrice || 0.5) * 100).toFixed(0)}%\n\n`;
  }

  if (comparison.spread) {
    text += `\n📈 *Spread: ${(comparison.spread * 100).toFixed(1)}%*\n`;
  }

  return text;
}

function formatTraderSwapQuote(quote: any, amount: number, from: string, to: string): SkillResponse {
  if (!quote) {
    return {
      text: `💱 *TRADER: SWAP QUOTE*\n${'─'.repeat(30)}\n\n❌ Could not get quote for ${amount} ${from} → ${to}`,
      mood: 'ERROR' as Mood,
    };
  }

  const outAmount = parseFloat(quote.outAmount || '0') / 1e6;
  const priceImpact = parseFloat(quote.priceImpactPct || '0') * 100;
  const impactWarning = priceImpact > 1 ? '⚠️ HIGH IMPACT' : priceImpact > 0.5 ? '🟡 MODERATE' : '✅ LOW';

  return {
    text: `💱 *TRADER: SWAP QUOTE*\n${'─'.repeat(30)}\n\n` +
      `${amount} ${from.toUpperCase()} → ${outAmount.toFixed(6)} ${to.toUpperCase()}\n\n` +
      `📊 Rate: 1 ${from} = ${(outAmount / amount).toFixed(6)} ${to}\n` +
      `💨 Impact: ${priceImpact.toFixed(3)}% ${impactWarning}\n` +
      `🛣️ Route: ${quote.routePlan?.length || 1} step(s)\n\n` +
      `⚠️ Quote valid ~30 seconds`,
    mood: 'NEUTRAL' as Mood,
    data: quote,
  };
}

function formatTraderQuote(result: any, ticker: string, direction: string, amount: string): SkillResponse {
  if (!result) {
    return {
      text: `💱 *TRADER: TRADE QUOTE*\n${'─'.repeat(30)}\n\n❌ Could not get quote for ${ticker}`,
      mood: 'ERROR' as Mood,
    };
  }

  const { quote, token } = result;

  return {
    text: `💱 *TRADER: TRADE QUOTE*\n${'─'.repeat(30)}\n\n` +
      `*Market:* ${token?.title || ticker}\n` +
      `*Direction:* ${direction.toUpperCase()}\n` +
      `*Amount:* ${amount} USDC\n\n` +
      `${quote ? '✅ Jupiter route available' : '⚠️ Direct DFlow trade needed'}\n\n` +
      `To execute: /execute ${ticker} ${direction} ${amount}`,
    mood: 'NEUTRAL' as Mood,
    data: result,
  };
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return `${v.toFixed(0)}`;
}

/**
 * Spawn multiple agents in parallel
 */
export async function spawnAgentsParallel(tasks: AgentTask[]): Promise<AgentResult[]> {
  return Promise.all(tasks.map(task => spawnAgent(task)));
}

/**
 * Get active spawn status
 */
export function getSpawnStatus(spawnId: string): SpawnStatus | undefined {
  return activeSpawns.get(spawnId);
}

/**
 * List all active spawns
 */
export function listActiveSpawns(): SpawnStatus[] {
  return Array.from(activeSpawns.values()).filter(s => s.status === 'running');
}

// Export for OpenClaw
export default spawnAgent;
