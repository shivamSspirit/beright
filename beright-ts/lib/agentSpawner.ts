/**
 * Agent Spawner - Multi-agent delegation system for BeRight Protocol
 *
 * Each agent (Scout, Analyst, Trader) is invoked as a real Claude LLM call
 * using its configured system prompt, model, and temperature.
 * Skills run first to gather context; Claude reasons about the results.
 *
 * Falls back to keyword matching if ANTHROPIC_API_KEY is not set.
 */

import { SkillResponse, Mood } from '../types/index';
import { AGENTS, AgentConfig, isAgentAllowed, getAgentConfig } from '../config/agents';
import { llmChat } from './llm';

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

// =============================================================================
// SMART INTENT DETECTION (Handles negations and context)
// =============================================================================

/**
 * Direct negation patterns - keyword must follow closely after negation
 * These patterns look for "[negation] ... [keyword]" with keyword nearby
 */
const DIRECT_NEGATION_PHRASES = [
  'no need to',
  'no need for',
  "don't need",
  "don't want",
  'not interested in',
  'skip the',
  'skip',
  'without',
  'exclude',
  'ignore',
  'avoid',
  'no',
  'not',
];

/**
 * Contrast words that break negation scope
 * If these appear between negation and keyword, negation doesn't apply
 */
const CONTRAST_WORDS = [',', 'but', 'just', 'instead', 'only', 'however', 'rather'];

/**
 * Intent keywords with their triggers
 */
const INTENT_KEYWORDS = {
  arbitrage: ['arb', 'arbitrage', 'spread', 'price difference'],
  hot: ['hot', 'trending', 'popular', 'top markets'],
  news: ['news', 'intel', 'headlines'],
  whale: ['whale', 'big trades', 'large positions'],
  research: ['research', 'analyze', 'deep dive'],
  calibration: ['calibration', 'accuracy', 'brier', 'track record'],
};

/**
 * Check if a keyword is negated in the text
 * Improved: checks for direct negation phrases and respects contrast words
 */
function isKeywordNegated(text: string, keyword: string): boolean {
  const lowerText = text.toLowerCase();
  const keywordIndex = lowerText.indexOf(keyword.toLowerCase());

  if (keywordIndex === -1) return false;

  // Look at the 25 characters before the keyword for negation
  const contextStart = Math.max(0, keywordIndex - 25);
  const contextBefore = lowerText.slice(contextStart, keywordIndex);

  // Check for any direct negation phrase
  for (const negPhrase of DIRECT_NEGATION_PHRASES) {
    const negIndex = contextBefore.lastIndexOf(negPhrase);
    if (negIndex === -1) continue;

    // Found a negation phrase - check if contrast word breaks the scope
    const textBetween = contextBefore.slice(negIndex + negPhrase.length);

    // If a contrast word appears between negation and keyword, negation doesn't apply
    const hasContrast = CONTRAST_WORDS.some(cw => textBetween.includes(cw));
    if (hasContrast) {
      continue; // This negation doesn't apply to our keyword
    }

    // Negation is close and no contrast word breaks it
    console.log(`[Negation] "${negPhrase}" found before "${keyword}" - marking as negated`);
    return true;
  }

  return false;
}

/**
 * Detect user intent while respecting negations
 * Returns the intent type or null if no clear intent
 */
function detectIntent(task: string): {
  intent: 'arbitrage' | 'hot' | 'news' | 'whale' | 'research' | 'calibration' | 'search';
  confidence: number;
  negatedIntents: string[];
} {
  const taskLower = task.toLowerCase();
  const negatedIntents: string[] = [];
  let detectedIntent: string | null = null;
  let confidence = 0;

  // Check each intent type
  for (const [intentType, keywords] of Object.entries(INTENT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (taskLower.includes(keyword)) {
        if (isKeywordNegated(task, keyword)) {
          // User explicitly doesn't want this
          negatedIntents.push(intentType);
          console.log(`[Intent] "${keyword}" negated in context - skipping ${intentType}`);
        } else if (!detectedIntent) {
          // First non-negated match wins
          detectedIntent = intentType;
          confidence = 0.8;
        }
      }
    }
  }

  // If arbitrage was negated but hot was mentioned, prioritize hot
  if (negatedIntents.includes('arbitrage') && taskLower.includes('hot')) {
    detectedIntent = 'hot';
    confidence = 0.9;
  }

  return {
    intent: (detectedIntent || 'search') as any,
    confidence,
    negatedIntents,
  };
}

/**
 * Smart keyword check that respects negations
 * Use this instead of simple .includes() for intent detection
 */
function wantsIntent(task: string, intentType: keyof typeof INTENT_KEYWORDS): boolean {
  const detection = detectIntent(task);

  // If this intent was explicitly negated, return false
  if (detection.negatedIntents.includes(intentType)) {
    return false;
  }

  // Check if any keywords match without negation
  const keywords = INTENT_KEYWORDS[intentType];
  const taskLower = task.toLowerCase();

  return keywords.some(keyword =>
    taskLower.includes(keyword) && !isKeywordNegated(task, keyword)
  );
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
 * Execute the agent task via real Anthropic API call.
 *
 * Flow:
 * 1. Run relevant skill(s) to gather raw data (fast, deterministic)
 * 2. Call Claude with the agent's system prompt + raw data as context
 * 3. Claude reasons about the data and produces a natural language response
 *
 * Falls back to keyword-based routing if API key is absent.
 */
async function executeAgentTask(
  agent: AgentConfig,
  task: string,
  context?: AgentContext,
  timeout?: number
): Promise<AgentResult> {
  const startTime = Date.now();

  try {
    // Step 1: Gather raw context from skills (fast, deterministic)
    const rawContext = await gatherSkillContext(agent, task);

    // Step 2: Ask the LLM to reason about the data
    const userMessage = rawContext
      ? `Task: ${task}\n\n--- Raw data gathered ---\n${rawContext}`
      : task;

    const response = await llmChat({
      system: agent.systemPrompt,
      user: userMessage,
      maxTokens: agent.maxTokens,
      temperature: agent.temperature,
      quality: agent.id === 'analyst' ? 'smart' : 'smart',
    });

    if (response.provider !== 'none') {
      console.log(`[AgentSpawner] ${agent.name} via ${response.provider}/${response.model} (${response.tokensUsed} tokens)`);
      return {
        agentId: agent.id,
        success: true,
        response: { text: response.text, mood: 'NEUTRAL' as Mood },
        executionTimeMs: Date.now() - startTime,
        tokensUsed: response.tokensUsed,
      };
    }
  } catch (err) {
    console.warn(`[AgentSpawner] LLM call failed for ${agent.id}, falling back:`, err);
  }

  // Fallback: keyword-based routing (no LLM)
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
        response: { text: `Unknown agent type: ${agent.id}`, mood: 'ERROR' as Mood },
        executionTimeMs: Date.now() - startTime,
      };
  }
}

/**
 * Run the relevant skills for an agent and return raw text context.
 * This is the "perception" layer — fast, deterministic data gathering.
 * Claude then reasons about this data.
 */
async function gatherSkillContext(agent: AgentConfig, task: string): Promise<string> {
  const parts: string[] = [];

  // Use smart intent detection that handles negations
  const detection = detectIntent(task);
  console.log(`[gatherSkillContext] Intent: ${detection.intent}, Negated: [${detection.negatedIntents.join(', ')}]`);

  try {
    if (agent.id === 'scout' || agent.id === 'analyst') {
      // Use smart intent detection instead of simple keyword matching
      if (wantsIntent(task, 'arbitrage')) {
        const { arbitrage } = await import('../skills/arbitrage');
        const result = await arbitrage(task);
        parts.push(`ARBITRAGE SCAN:\n${result.text}`);

      } else if (wantsIntent(task, 'hot')) {
        const { getHotMarkets } = await import('../skills/markets');
        const markets = await getHotMarkets(10);
        parts.push(`HOT MARKETS (${markets.length}):\n${markets.slice(0, 10).map(m =>
          `- ${m.title || m.question}: YES=${((m.yesPrice || 0.5) * 100).toFixed(0)}% vol=$${m.volume || 0}`
        ).join('\n')}`);

      } else if (wantsIntent(task, 'news')) {
        const { newsSearch } = await import('../skills/intel');
        const result = await newsSearch(task.replace(/news|intel/gi, '').trim() || 'prediction markets');
        parts.push(`NEWS INTEL:\n${result.text}`);

      } else {
        const { searchMarkets } = await import('../skills/markets');
        const markets = await searchMarkets(task);
        parts.push(`MARKET SEARCH (${markets.length} results):\n${markets.slice(0, 8).map(m =>
          `- [${m.platform}] ${m.title || m.question}: YES=${((m.yesPrice || 0.5) * 100).toFixed(0)}%`
        ).join('\n')}`);
      }
    }

    if (agent.id === 'analyst') {
      if (wantsIntent(task, 'calibration')) {
        const { calibration } = await import('../skills/calibration');
        const result = await calibration();
        parts.push(`CALIBRATION DATA:\n${result.text}`);
      } else {
        const { research } = await import('../skills/research');
        const result = await research(task);
        parts.push(`RESEARCH DATA:\n${result.text}`);
      }
    }

    if (agent.id === 'trader') {
      if (wantsIntent(task, 'whale')) {
        const { whaleWatch } = await import('../skills/whale');
        const result = await whaleWatch();
        parts.push(`WHALE DATA:\n${result.text}`);
      }
    }
  } catch (err) {
    console.warn('[AgentSpawner] Skill context gathering failed:', err);
  }

  return parts.join('\n\n');
}

/**
 * Scout agent execution - Fast market scanning
 * Enhanced with Tavily for real-time news
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
  const { newsSearch, tavilyIntelSearch, financeIntel } = await import('../skills/intel');
  const { isTavilyConfigured } = await import('./tavily');

  // Use smart intent detection that handles negations
  const detection = detectIntent(task);
  const taskLower = task.toLowerCase();
  const useTavily = isTavilyConfigured();

  console.log(`[executeScoutTask] Intent: ${detection.intent}, Negated: [${detection.negatedIntents.join(', ')}]`);

  let response: SkillResponse;

  // Use smart intent detection instead of simple keyword matching
  if (wantsIntent(task, 'arbitrage')) {
    // Arbitrage scanning
    const query = extractQuery(task);
    response = await arbitrage(query || undefined);

    // Enhance response with scout branding
    response.text = `🔍 *SCOUT SCAN: ARBITRAGE*\n${'─'.repeat(30)}\n\n${response.text}`;
  } else if (wantsIntent(task, 'hot')) {
    // Hot markets - this now takes priority when user says "hot markets, no arb"
    const markets = await getHotMarkets(10);
    response = {
      text: formatScoutMarkets(markets, 'TRENDING'),
      mood: 'BULLISH' as Mood,
      data: markets,
    };
  } else if (taskLower.includes('finance') || taskLower.includes('stock')) {
    // Finance news scanning (prefer Tavily) - narrowed from 'market' to avoid conflicts
    const query = extractQuery(task) || 'market news';
    response = await financeIntel(query);
    response.text = `🔍 *SCOUT SCAN: FINANCE*\n${'─'.repeat(30)}\n\n${response.text}`;
  } else if (wantsIntent(task, 'news')) {
    // News scanning (use Tavily if available for better results)
    const query = extractQuery(task) || 'prediction market';
    if (useTavily) {
      response = await tavilyIntelSearch(query);
      response.text = `🔍 *SCOUT SCAN: AI NEWS*\n${'─'.repeat(30)}\n\n${response.text}`;
    } else {
      response = await newsSearch(query);
      response.text = `🔍 *SCOUT SCAN: NEWS*\n${'─'.repeat(30)}\n\n${response.text}`;
    }
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
 * Enhanced with Tavily for comprehensive research
 */
async function executeAnalystTask(
  agent: AgentConfig,
  task: string,
  context?: AgentContext
): Promise<AgentResult> {
  const startTime = Date.now();

  // Import analyst tools
  const { research, deepResearch, verifyClaimSkill } = await import('../skills/research');
  const { calibration } = await import('../skills/calibration');
  const { compareOdds } = await import('../skills/markets');
  const { isTavilyConfigured } = await import('./tavily');

  const taskLower = task.toLowerCase();
  let response: SkillResponse;

  // Use smart intent detection that handles negations
  console.log(`[executeAnalystTask] Task: ${task.slice(0, 50)}...`);

  if (wantsIntent(task, 'calibration')) {
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
  } else if (taskLower.includes('verify') || taskLower.includes('fact check') || taskLower.includes('factcheck')) {
    // Claim verification using Tavily
    const claim = extractQuery(task) || task;
    response = await verifyClaimSkill(claim);
    response.text = `📊 *ANALYST: VERIFICATION*\n${'─'.repeat(30)}\n\n${response.text}`;
  } else if ((taskLower.includes('deep') || taskLower.includes('comprehensive')) && isTavilyConfigured()) {
    // Deep research with Tavily - fall back to regular research if Tavily fails
    const query = extractQuery(task) || task;
    try {
      response = await deepResearch(query);
      response.text = `📊 *ANALYST DEEP RESEARCH*\n${'─'.repeat(30)}\n\n${response.text}`;
    } catch (tavilyError) {
      console.warn('[AgentSpawner] Tavily deep research failed, falling back to standard research:',
        tavilyError instanceof Error ? tavilyError.message : tavilyError);
      // Fall back to standard research with Groq synthesis
      response = await research(query);
      response.text = `📊 *ANALYST REPORT: ${query.toUpperCase()}*\n${'─'.repeat(30)}\n\n${response.text}`;
    }
  } else {
    // Standard research (enhanced with Tavily if available)
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
 *
 * Supports live Jupiter Prediction Market execution when wallet pubkey is provided.
 * Returns unsigned transaction for wallet signing by the frontend.
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

  // Extract wallet pubkey from context (set when called from web terminal)
  const walletPubkey = context?.username; // username field carries wallet pubkey from gateway

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
  } else if (taskLower.includes('buy') || taskLower.includes('trade') || taskLower.includes('execute')) {
    // Trade execution - supports live Jupiter execution with wallet
    // Match patterns like: "trade 5 yes on bitcoin" or "buy yes $10 bitcoin"
    const tradeMatch = task.match(/(?:trade|buy|execute)?\s*(\d+(?:\.\d+)?)\s*\$?\s*(yes|no)\s+(?:on\s+)?(.+)/i) ||
                       task.match(/(?:trade|buy|execute)?\s*(yes|no)\s+\$?(\d+(?:\.\d+)?)\s+(?:on\s+)?(.+)/i) ||
                       task.match(/(\w+[-\w]*)\s+(yes|no)\s+(\d+(?:\.\d+)?)/i);

    if (tradeMatch) {
      let amount: string, direction: string, marketQuery: string;

      // Handle different match patterns
      if (/^\d/.test(tradeMatch[1])) {
        // Pattern: "5 yes bitcoin" or "5 yes on bitcoin"
        [, amount, direction, marketQuery] = tradeMatch;
      } else if (/^(yes|no)$/i.test(tradeMatch[1])) {
        // Pattern: "yes $10 bitcoin"
        [, direction, amount, marketQuery] = tradeMatch;
      } else {
        // Pattern: "TICKER yes 10" (legacy)
        [, marketQuery, direction, amount] = tradeMatch;
      }

      const amountNum = parseFloat(amount);
      const side = direction.toUpperCase() as 'YES' | 'NO';

      // Live execution path: wallet connected
      if (walletPubkey) {
        try {
          const { searchEvents, createOrder } = await import('../lib/jupiter/prediction');

          // Search for the market on Jupiter
          const searchResult = await searchEvents({ query: marketQuery.trim(), limit: 5 });

          if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
            const event = searchResult.data[0];
            const market = event.markets?.[0];

            if (market) {
              // Create order (returns unsigned transaction)
              const orderResult = await createOrder({
                marketId: market.marketId,
                side,
                amountUsd: amountNum,
                userPubkey: walletPubkey,
              });

              if (orderResult.success && orderResult.data) {
                const orderData = orderResult.data;
                const contracts = orderData.order?.contracts ? parseFloat(orderData.order.contracts) / 1e6 : 0;
                const pricePerContract = orderData.order?.pricePerContractUsd
                  ? parseFloat(orderData.order.pricePerContractUsd) / 1e6
                  : 0;

                response = {
                  text: `💱 *TRADER: EXECUTING TRADE*\n${'─'.repeat(30)}\n\n` +
                    `*Market:* ${event.title}\n` +
                    `*Side:* ${side}\n` +
                    `*Amount:* $${amountNum}\n` +
                    `*Contracts:* ~${contracts.toFixed(2)}\n` +
                    `*Price:* $${pricePerContract.toFixed(3)}/contract\n\n` +
                    `🔐 Transaction ready. Signing with your wallet...`,
                  mood: 'BULLISH' as Mood,
                  data: [{
                    tool: 'execute_trade',
                    result: {
                      requiresWalletSign: true,
                      trade: {
                        market: event.title,
                        direction: side,
                        amount: `$${amountNum}`,
                        contracts,
                        pricePerContract,
                      },
                      transaction: {
                        base64: orderData.transaction,
                        blockhash: orderData.txMeta?.blockhash,
                        lastValidBlockHeight: orderData.txMeta?.lastValidBlockHeight,
                      },
                      jupiterMarket: {
                        eventId: event.eventId,
                        marketId: market.marketId,
                      },
                    },
                  }],
                };
              } else {
                response = {
                  text: `💱 *TRADER: ORDER FAILED*\n${'─'.repeat(30)}\n\n` +
                    `❌ Could not create order: ${orderResult.error || 'Unknown error'}\n\n` +
                    `Market: ${event.title}`,
                  mood: 'ERROR' as Mood,
                };
              }
            } else {
              response = {
                text: `💱 *TRADER: NO MARKET*\n${'─'.repeat(30)}\n\n` +
                  `Found event "${event.title}" but no tradeable market.\n` +
                  `This market may not be live yet.`,
                mood: 'NEUTRAL' as Mood,
              };
            }
          } else {
            response = {
              text: `💱 *TRADER: MARKET NOT FOUND*\n${'─'.repeat(30)}\n\n` +
                `No Jupiter prediction market found for "${marketQuery}".\n\n` +
                `Try a more specific query or check /hot for available markets.`,
              mood: 'NEUTRAL' as Mood,
            };
          }
        } catch (error) {
          console.error('[Trader] Jupiter execution error:', error);
          response = {
            text: `💱 *TRADER: ERROR*\n${'─'.repeat(30)}\n\n` +
              `❌ Trade execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            mood: 'ERROR' as Mood,
          };
        }
      } else {
        // Quote-only path: no wallet connected
        const result = await getTradeQuote(
          marketQuery.toUpperCase(),
          side,
          amountNum
        );
        response = formatTraderQuote(result, marketQuery, direction, amount);
        response.text += `\n\n💡 *Connect wallet in terminal to execute live trades*`;
      }
    } else {
      response = {
        text: `💱 *TRADER: BUY*\n${'─'.repeat(30)}\n\nUsage:\n• trade 5 yes on bitcoin\n• buy yes $10 fed rate cut\n• buy KXBTC-24DEC31 YES 10`,
        mood: 'EDUCATIONAL' as Mood,
      };
    }
  } else {
    response = {
      text: `💱 *TRADER*\n${'─'.repeat(30)}\n\nAvailable commands:\n• trade <amount> <YES|NO> on <market>\n• swap <amount> <from> to <to>\n• whale - Track whale activity`,
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
  // Remove command prefix and common keywords/phrases
  const cleaned = text
    .replace(/^\/\w+\s*/i, '')
    .replace(/^(scan|search|find|check|get|show)\s+/i, '')
    // Remove common task phrases that aren't user queries
    .replace(/^for\s+(arbitrage|arb)\s+opportunities?\s*/i, '')
    .replace(/^(arbitrage|arb)\s+opportunities?\s*/i, '')
    .replace(/^for\s+news\s*/i, '')
    .replace(/^news\s+for:?\s*/i, '')
    .replace(/^for:?\s*/i, '')
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
