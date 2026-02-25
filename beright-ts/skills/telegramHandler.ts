/**
 * Telegram Handler Skill for BeRight Protocol
 * Main router/dispatcher for all incoming messages
 */

import { SkillResponse, TelegramMessage } from '../types/index';
import { COMMANDS, KEYWORD_TRIGGERS, HELP_TEXT, getCommandHelp } from '../config/commands';
import { searchMarkets, formatMarkets, compareOdds, formatComparison, getHotMarkets } from './markets';
import { arbitrage } from './arbitrage';
import {
  handleArbMonitorCommand,
  subscribeToArb,
  unsubscribeFromArb,
  runQuickScan,
  setTelegramSender,
} from './arbMonitor';
import { research } from './research';
import { whaleWatch, addWhale } from './whale';
import { newsSearch, socialSearch, intelReport } from './intel';
import { morningBrief, quickBrief } from './brief';
import { calibration, predict, getCalibrationStats, listPending } from './calibration';
import { analyze as analyzeIntelligence, quickCheck } from './intelligence';
import { feedback as feedbackSkill } from './feedback';
import { recommendations as recommendationsSkill } from './recommendations';
import { compare as compareSkill } from './comparison';
import { learnings as learningsSkill } from './learnings';
import { predict as smartPredictSkill, searchMarketsForPrediction } from './smartPredict';
import { getQuote as getSwapQuote } from './swap';
import { getSolPrice } from './prices';
import { withFailover } from './rpc';
import { formatPct, formatUsd } from './utils';
import { getTradeQuote, searchPredictionTokens, getVolumeMetrics, scanLPOpportunities } from './trade';
import {
  getKalshiClient,
  getKalshiBalance,
  getKalshiPositions,
  getKalshiMarkets,
  getKalshiMarket,
  placeKalshiOrder,
  getKalshiOrders,
  getKalshiFills,
  getKalshiSettlements,
  getKalshiOrderbook,
  getKalshiPortfolioSummary,
  cancelKalshiOrder,
  cancelAllKalshiOrders,
  amendKalshiOrder,
  isKalshiDemo,
  calculateKalshiCost,
  calculateKalshiProfit,
  formatKalshiPrice,
  KalshiOrder,
  KalshiFill,
  KalshiSettlement,
} from '../lib/kalshi';
import { getOrCreateUser, linkWallet, getUserByTelegram } from '../lib/identity';
import { handleSubscribe, handleUnsubscribe, handleAlerts, generateArbAlerts, generateWhaleAlerts, queueAlerts } from './notifications';
import { getLeaderboard, formatLeaderboard, addUserPrediction, calculateUserStats, getUserPendingPredictions } from '../lib/leaderboard';
import { handleFollow, handleUnfollow as handleUnfollowUser, handleSignals, handleTopLists } from './copyTrading';
import { handlePortfolio as handlePortfolioCmd, handlePnl, handleExpiring } from './positions';
import { handleAlert, checkAlerts } from './priceAlerts';
import { handleLimits, handleAutobet, handleStopLoss, handleTakeProfit, handleDCA, checkLimits } from './autoTrade';
import { logConversation, searchLearnings, handleMemory, getRecentContext } from './memory';
import { handleWallet as handleDFlowWallet, handleDFlowSearch, handleTrade as handleDFlowTrade, handlePositions as handleDFlowPositions } from './dflowTrade';
import { handleAgentCommand, subscribeToAgent } from './proactiveAgent';
import { handlePosterCommand } from './agentPoster';

// Paper Trading System
import traderSkillHandlers from './trader';

// Signal Intelligence Engine
import { getRecentSignals, formatSignalsReport } from '../lib/signals/index';
import { subscribe as subscribeToSignals, unsubscribe as unsubscribeFromSignals, getSubscriptionStatus, formatSubscribeConfirmation } from '../lib/alertRouter';
import type { SignalType } from '../lib/signals/types';

// Vault v0 — Signal Channels
import { handleVaultCommand } from './vault';

// On-chain + Supabase integration
import { commitPrediction, calculateBrierScore, interpretBrierScore } from '../lib/onchain';
import { db } from '../lib/supabase/client';

// Multi-agent spawner
import { spawnAgent, AgentTask } from '../lib/agentSpawner';
import { getAgentForCommand, AGENTS } from '../config/agents';

// Smart Intent Classifier
import { classifyIntent, getIntentSuggestions, IntentResult } from '../lib/intentClassifier';
import { classifyIntentSmart, isObviousGreeting } from '../lib/smartIntentClassifier';

// Market watcher for auto-resolution
import { getMarketWatcher } from '../services/marketWatcher';

// ============================================
// CHAT CONTEXT TRACKING
// Track last bot message per chat for context-aware replies
// ============================================
interface ChatContext {
  lastBotMessage: string;
  timestamp: number;
  markets?: Array<{ title: string; platform: string; url: string }>;
}

const chatContextCache = new Map<string, ChatContext>();
const CONTEXT_TTL = 10 * 60 * 1000; // 10 minutes

function setChatContext(chatId: string, botMessage: string, markets?: Array<{ title: string; platform: string; url: string }>) {
  chatContextCache.set(chatId, {
    lastBotMessage: botMessage,
    timestamp: Date.now(),
    markets,
  });
}

function getChatContext(chatId: string): ChatContext | null {
  const ctx = chatContextCache.get(chatId);
  if (!ctx) return null;
  if (Date.now() - ctx.timestamp > CONTEXT_TTL) {
    chatContextCache.delete(chatId);
    return null;
  }
  return ctx;
}

/**
 * Route message to appropriate agent
 */
function routeMessage(text: string): string {
  const lower = text.toLowerCase();

  // MVP commands (handled directly in main handler)
  if (lower.startsWith('/brief')) return 'COMMANDER';
  if (lower.startsWith('/hot')) return 'COMMANDER';
  if (lower.startsWith('/alpha')) return 'COMMANDER';
  if (lower.startsWith('/predict')) return 'COMMANDER';
  if (lower.startsWith('/me')) return 'COMMANDER';
  if (lower.startsWith('/leaderboard')) return 'COMMANDER';
  if (lower.startsWith('/calibration')) return 'COMMANDER';

  // Explicit commands
  if (lower.startsWith('/research')) return 'RESEARCH';
  if (lower.startsWith('/arb-monitor')) return 'ARBITRAGE';
  if (lower.startsWith('/arb-subscribe')) return 'ARBITRAGE';
  if (lower.startsWith('/arb-unsubscribe')) return 'ARBITRAGE';
  if (lower.startsWith('/arb')) return 'ARBITRAGE';
  if (lower.startsWith('/agent')) return 'PROACTIVE_AGENT';
  if (lower.startsWith('/poster')) return 'COMMANDER';
  if (lower.startsWith('/colosseum')) return 'COMMANDER';
  if (lower.startsWith('/forum')) return 'COMMANDER';
  if (lower.startsWith('/odds')) return 'RESEARCH';
  if (lower.startsWith('/whale')) return 'WHALE';
  if (lower.startsWith('/track_whale')) return 'WHALE';
  if (lower.startsWith('/news')) return 'INTEL';
  if (lower.startsWith('/social')) return 'INTEL';
  if (lower.startsWith('/intel')) return 'INTEL';
  if (lower.startsWith('/execute')) return 'EXECUTOR';
  if (lower.startsWith('/wallet')) return 'EXECUTOR';
  if (lower.startsWith('/mywallet')) return 'EXECUTOR';
  if (lower.startsWith('/swap')) return 'EXECUTOR';
  if (lower.startsWith('/buy')) return 'EXECUTOR';
  if (lower.startsWith('/scan')) return 'EXECUTOR';
  if (lower.startsWith('/balance')) return 'EXECUTOR';
  if (lower.startsWith('/volume')) return 'EXECUTOR';
  if (lower.startsWith('/lp')) return 'EXECUTOR';
  if (lower.startsWith('/dflow')) return 'EXECUTOR';
  if (lower.startsWith('/trade')) return 'EXECUTOR';
  if (lower.startsWith('/positions')) return 'EXECUTOR';
  if (lower.startsWith('/mypositions')) return 'EXECUTOR';
  // Paper trading system commands
  if (lower.startsWith('/trader')) return 'TRADER';
  if (lower.startsWith('/paper')) return 'TRADER';
  if (lower.startsWith('/paptrade')) return 'TRADER';
  if (lower.startsWith('/pappositions')) return 'TRADER';
  if (lower.startsWith('/papclose')) return 'TRADER';
  if (lower.startsWith('/perftrader')) return 'TRADER';
  if (lower.startsWith('/risktrader')) return 'TRADER';
  if (lower.startsWith('/strategies')) return 'TRADER';

  // Kalshi direct commands (full trading)
  if (lower.startsWith('/kalshi')) return 'KALSHI';
  if (lower.startsWith('/kbalance')) return 'KALSHI';
  if (lower.startsWith('/kportfolio')) return 'KALSHI';
  if (lower.startsWith('/kpositions')) return 'KALSHI';
  if (lower.startsWith('/korders')) return 'KALSHI';
  if (lower.startsWith('/kfills')) return 'KALSHI';
  if (lower.startsWith('/ksettlements')) return 'KALSHI';
  if (lower.startsWith('/kwinnings')) return 'KALSHI';
  if (lower.startsWith('/kmarkets')) return 'KALSHI';
  if (lower.startsWith('/kbook')) return 'KALSHI';
  if (lower.startsWith('/kbuy')) return 'KALSHI';
  if (lower.startsWith('/ksell')) return 'KALSHI';
  if (lower.startsWith('/kcancel')) return 'KALSHI';
  if (lower.startsWith('/kamend')) return 'KALSHI';
  if (lower.startsWith('/connect')) return 'COMMANDER';
  if (lower.startsWith('/profile')) return 'COMMANDER';
  if (lower.startsWith('/intelligence')) return 'COMMANDER';
  if (lower.startsWith('/analyze')) return 'COMMANDER';
  if (lower.startsWith('/feedback')) return 'COMMANDER';
  if (lower.startsWith('/create-channel')) return 'COMMANDER';
  if (lower.startsWith('/channel')) return 'COMMANDER';
  if (lower.startsWith('/signal ') || lower === '/signal') return 'COMMANDER';
  if (lower.startsWith('/channels')) return 'COMMANDER';
  if (lower.startsWith('/subscribe-channel')) return 'COMMANDER';
  if (lower.startsWith('/unsubscribe-channel')) return 'COMMANDER';
  if (lower.startsWith('/my-channels')) return 'COMMANDER';
  if (lower.startsWith('/my-vault')) return 'COMMANDER';
  if (lower.startsWith('/recommend')) return 'COMMANDER';
  if (lower.startsWith('/compare')) return 'COMMANDER';
  if (lower.startsWith('/learnings')) return 'COMMANDER';
  if (lower.startsWith('/learn')) return 'COMMANDER';
  if (lower.startsWith('/smartpredict')) return 'COMMANDER';
  if (lower.startsWith('/findmarket')) return 'COMMANDER';
  if (lower.startsWith('/subscribe-all')) return 'SUBSCRIBE_ALL';
  if (lower.startsWith('/subscribe')) return 'COMMANDER';
  if (lower.startsWith('/unsubscribe')) return 'COMMANDER';
  if (lower.startsWith('/alerts')) return 'COMMANDER';
  if (lower.startsWith('/follow')) return 'COMMANDER';
  if (lower.startsWith('/unfollow')) return 'COMMANDER';
  if (lower.startsWith('/signals')) return 'COMMANDER';
  if (lower.startsWith('/toplists')) return 'COMMANDER';

  // Portfolio & automation commands
  if (lower.startsWith('/portfolio')) return 'COMMANDER';
  if (lower.startsWith('/pnl')) return 'COMMANDER';
  if (lower.startsWith('/expiring')) return 'COMMANDER';
  if (lower.startsWith('/alert')) return 'COMMANDER';
  if (lower.startsWith('/limits')) return 'COMMANDER';
  if (lower.startsWith('/autobet')) return 'COMMANDER';
  if (lower.startsWith('/stoploss')) return 'COMMANDER';
  if (lower.startsWith('/takeprofit')) return 'COMMANDER';
  if (lower.startsWith('/dca')) return 'COMMANDER';

  // Keyword detection
  for (const [keyword, agent] of Object.entries(KEYWORD_TRIGGERS)) {
    if (lower.includes(keyword)) return agent;
  }

  return 'COMMANDER';
}

/**
 * Extract query from command
 */
function extractQuery(text: string, command: string): string {
  return text.slice(command.length).trim();
}

/**
 * Detect if text looks like a legitimate market/topic query
 * vs random text, greetings, or system requests
 */
function looksLikeMarketQuery(text: string): boolean {
  const lower = text.toLowerCase().trim();

  // Too short to be a real query
  if (lower.length < 4) return false;

  // Common non-market patterns to REJECT
  const nonMarketPatterns = [
    // Greetings
    /^(hi|hello|hey|yo|sup|hola|greetings)/i,
    // System requests
    /^(show|give|tell|get|display|print|list)\s+(me\s+)?(the\s+)?(logs?|errors?|status|config|settings|info|data|users?|messages?)/i,
    // Meta questions about the bot
    /^(who|what)\s+(are|is)\s+(you|this|beright)/i,
    /^(can|do|will|how)\s+you/i,
    /^(help|assist|support)/i,
    // Random commands
    /^(test|testing|debug|check)/i,
    // Thank you / acknowledgments
    /^(thanks?|thank\s+you|ok|okay|cool|nice|great|good|awesome)/i,
    // Questions about capabilities
    /^what\s+can\s+(you|i)/i,
    /^how\s+(do|does|to)/i,
    // Complaints or feedback
    /^(this|that|it)\s+(is|was|doesn't|does not)/i,
  ];

  for (const pattern of nonMarketPatterns) {
    if (pattern.test(lower)) return false;
  }

  // Market-related keywords that SUGGEST a real query
  const marketKeywords = [
    'price', 'market', 'odds', 'bet', 'predict', 'election', 'trump', 'biden',
    'bitcoin', 'btc', 'eth', 'crypto', 'stock', 'fed', 'rate', 'inflation',
    'war', 'ukraine', 'china', 'taiwan', 'ai', 'gpt', 'openai', 'tesla',
    'apple', 'google', 'microsoft', 'amazon', 'nvidia', 'meta', 'spacex',
    'senate', 'house', 'congress', 'supreme', 'court', 'impeach', 'indictment',
    'gdp', 'recession', 'unemployment', 'cpi', 'earnings', 'ipo', 'merger',
    'championship', 'super bowl', 'world cup', 'olympics', 'nba', 'nfl',
    'will', 'when', 'what', 'who wins', 'chance', 'probability', 'likelihood',
  ];

  // Check if contains any market keyword
  for (const keyword of marketKeywords) {
    if (lower.includes(keyword)) return true;
  }

  // If it's a question format, might be a market query
  if (lower.includes('?') || lower.startsWith('will ') || lower.startsWith('what if')) {
    return true;
  }

  // Default: probably not a market query
  return false;
}

/**
 * Extract market context from a bot alert message
 * Parses the market title from various alert formats
 */
function extractMarketFromReply(replyText: string): string | null {
  if (!replyText) return null;

  // Pattern 1: Alert format with market title after separator
  // "⚡ 📈 TRENDING: 26% in 6hrs\n────────────────────────────\n\nWill Bryson DeChambeau win..."
  const separatorMatch = replyText.match(/[─━═]{10,}\s*\n+\s*(.+?)(?:\n|$)/);
  if (separatorMatch && separatorMatch[1]) {
    const title = separatorMatch[1].trim();
    if (title.length > 10 && !title.startsWith('→') && !title.startsWith('*')) {
      return title;
    }
  }

  // Pattern 2: Bold market title "*Market Title*"
  const boldMatch = replyText.match(/\*([^*]{10,})\*/);
  if (boldMatch && boldMatch[1]) {
    const title = boldMatch[1].trim();
    // Skip headers like "CLOSING IN <1 HOUR", "BIG MOVE", etc.
    if (!title.match(/^(CLOSING|BIG|HOT|NEW|SPREAD|WHALE|TRENDING|ALERT)/i)) {
      return title;
    }
  }

  // Pattern 3: Line after emoji header
  // "🔥 HOT MARKET\n\nWill something happen..."
  const emojiHeaderMatch = replyText.match(/[🔥⏰📈📉💰🆕🐋🚨⚡💡🎯🚀]\s*\*?[A-Z\s]+\*?\s*\n+(.+?)(?:\n|$)/);
  if (emojiHeaderMatch && emojiHeaderMatch[1]) {
    const title = emojiHeaderMatch[1].replace(/^\*|\*$/g, '').trim();
    if (title.length > 10) {
      return title;
    }
  }

  // Pattern 4: Market search result format "🟣 POLYMARKET \n   Title Here"
  const marketResultMatch = replyText.match(/[🟣🟢🔵]\s*\w+\s*\n\s+(.+?)(?:\n|$)/);
  if (marketResultMatch && marketResultMatch[1]) {
    return marketResultMatch[1].trim();
  }

  return null;
}

/**
 * Extract multiple markets from HOT MARKETS format
 * Format: "🔴 Market Title Here\n   5% YES  •  $161.4M..."
 */
function extractMarketsFromHotList(text: string): Array<{ title: string; odds: string }> {
  const markets: Array<{ title: string; odds: string }> = [];

  // Pattern: emoji followed by market title, then odds on next line
  // "🔴 Judy Shelton as Fed Chair?\n   5% YES"
  // "🟢 Gov be shut down on Feb 14, 2026?\n   99% YES"
  const marketPattern = /[🔴🟢🟡⚪]\s+(.+?)\n\s+(\d+%\s*YES)/g;

  let match;
  while ((match = marketPattern.exec(text)) !== null) {
    const title = match[1].replace(/\.{3}$/, '').trim(); // Remove trailing ...
    const odds = match[2];
    if (title.length > 5) {
      markets.push({ title, odds });
    }
  }

  return markets;
}

/**
 * Handle context from chat cache (for follow-up messages without Telegram reply)
 */
async function handleChatContextQuery(
  chatId: string,
  userText: string
): Promise<SkillResponse | null> {
  // Check if this is a context-dependent query
  if (!isContextDependentQuery(userText)) {
    return null;
  }

  // Get cached context for this chat
  const ctx = getChatContext(chatId);
  if (!ctx) {
    return null;
  }

  console.log(`[Context] Found cached context for chat ${chatId}`);

  // If we have cached markets from /hot, show them with links
  if (ctx.markets && ctx.markets.length > 0) {
    const marketList = ctx.markets.slice(0, 5).map((m, i) => {
      const platformEmoji = {
        polymarket: '🟣',
        kalshi: '🟢',
        manifold: '🔵',
        metaculus: '🟠',
        limitless: '⚪',
      }[m.platform] || '📊';
      return `${i + 1}. ${platformEmoji} *${m.title}*\n   🔗 ${m.url}`;
    }).join('\n\n');

    return {
      text: `Here are the market links:\n\n${marketList}`,
      mood: 'NEUTRAL',
    };
  }

  // Try to extract markets from the HOT MARKETS format
  const hotMarkets = extractMarketsFromHotList(ctx.lastBotMessage);
  if (hotMarkets.length > 0) {
    console.log(`[Context] Found ${hotMarkets.length} markets in HOT MARKETS format`);

    // Search for the first few markets and return links
    const results: string[] = [];
    for (const hm of hotMarkets.slice(0, 3)) {
      const markets = await searchMarkets(hm.title.slice(0, 30));
      if (markets.length > 0) {
        const m = markets[0];
        const platformEmoji = {
          polymarket: '🟣',
          kalshi: '🟢',
          manifold: '🔵',
          metaculus: '🟠',
          limitless: '⚪',
        }[m.platform] || '📊';
        results.push(`${platformEmoji} *${m.title.slice(0, 50)}*\n   ${formatPct(m.yesPrice)} YES • 🔗 ${m.url}`);
      }
    }

    if (results.length > 0) {
      return {
        text: `Here are the market links:\n\n${results.join('\n\n')}`,
        mood: 'NEUTRAL',
      };
    }
  }

  // Try single market extraction
  const marketTitle = extractMarketFromReply(ctx.lastBotMessage);
  if (marketTitle) {
    console.log(`[Context] Extracted single market: "${marketTitle}"`);
    const markets = await searchMarkets(marketTitle);
    if (markets.length > 0) {
      const market = markets[0];
      const platformEmoji = {
        polymarket: '🟣',
        kalshi: '🟢',
        manifold: '🔵',
        metaculus: '🟠',
        limitless: '⚪',
      }[market.platform] || '📊';

      return {
        text: `${platformEmoji} *${market.title}*

📊 *Current Odds*
YES: ${formatPct(market.yesPrice)} | NO: ${formatPct(1 - market.yesPrice)}

💰 *Volume:* ${formatUsd(market.volume || 0)}
📈 *Platform:* ${market.platform.charAt(0).toUpperCase() + market.platform.slice(1)}

🔗 *Link:* ${market.url}

_Trade directly on ${market.platform}_`,
        mood: 'NEUTRAL',
        data: market,
      };
    }
  }

  return null;
}

/**
 * Check if user message is asking for context-dependent info
 * Handles many variations: "give me link", "can give market link", "link please", etc.
 */
function isContextDependentQuery(text: string): boolean {
  const lower = text.toLowerCase().trim();

  // Don't treat commands as context queries
  if (lower.startsWith('/')) return false;

  const contextPatterns = [
    // Link requests - many variations
    /\b(give|show|get|send|share)\b.*(link|url)/i,
    /\b(can|could|would|will)\s+(you\s+)?(give|show|get|send|share).*(link|url)/i,
    /^(market\s+)?link\s*(please|pls)?$/i,
    /^url\s*(please|pls)?$/i,
    /\blink\s*(please|pls)?\s*$/i,

    // Info requests
    /^(more\s+)?(info|information|details?)/i,
    /\b(tell|show|give)\s+(me\s+)?more\b/i,
    /^more$/i,

    // Location/access questions
    /\b(where|how)\b.*(find|see|view|access|trade|bet|buy|sell)/i,
    /\b(can|could)\s+(i|we)\s+(find|see|view|access|trade|bet|buy|sell)/i,

    // Platform questions
    /\b(what|which)\s+(platform|site|exchange|market)/i,

    // Trade intent
    /^(buy|sell|trade)\s+(this|it|that)$/i,
    /\b(want|wanna)\s+to\s+(buy|sell|trade|bet)/i,

    // Open/view requests
    /^(open|view)\s+(this|the|that|it)\s*(market)?$/i,
  ];

  return contextPatterns.some(pattern => pattern.test(lower));
}

/**
 * Handle context-aware replies
 * When user replies to a bot message asking for more info
 */
async function handleContextReply(
  userText: string,
  replyText: string
): Promise<SkillResponse | null> {
  // Only handle context-dependent queries
  if (!isContextDependentQuery(userText)) {
    return null;
  }

  // Extract market title from the replied message
  const marketTitle = extractMarketFromReply(replyText);

  if (!marketTitle) {
    return null; // Couldn't extract context, fall through to normal handling
  }

  console.log(`[Context] Extracted market from reply: "${marketTitle}"`);

  // Search for the specific market
  const markets = await searchMarkets(marketTitle);

  if (markets.length === 0) {
    return {
      text: `I couldn't find that market. Try searching directly:\n\n/research ${marketTitle.slice(0, 50)}`,
      mood: 'NEUTRAL',
    };
  }

  // Find best match
  const exactMatch = markets.find(m =>
    m.title.toLowerCase().includes(marketTitle.toLowerCase().slice(0, 30)) ||
    marketTitle.toLowerCase().includes(m.title.toLowerCase().slice(0, 30))
  );

  const market = exactMatch || markets[0];

  // Format response with link and details
  const platformEmoji = {
    polymarket: '🟣',
    kalshi: '🟢',
    manifold: '🔵',
    metaculus: '🟠',
    limitless: '⚪',
  }[market.platform] || '📊';

  return {
    text: `${platformEmoji} *${market.title}*

📊 *Current Odds*
YES: ${formatPct(market.yesPrice)} | NO: ${formatPct(1 - market.yesPrice)}

💰 *Volume:* ${formatUsd(market.volume || 0)}
📈 *Platform:* ${market.platform.charAt(0).toUpperCase() + market.platform.slice(1)}

🔗 *Link:* ${market.url}

_Trade directly on ${market.platform}_`,
    mood: 'NEUTRAL',
    data: market,
  };
}

/**
 * Handle freeform non-command input
 * Returns response for greetings, meta questions, off-topic
 */
function handleFreeformInput(text: string): SkillResponse | null {
  const lower = text.toLowerCase().trim();

  // Greetings
  if (/^(hi|hello|hey|yo|sup|hola|greetings)/i.test(lower)) {
    return {
      text: `Hey! I'm BeRight, your prediction market intelligence agent.

What would you like to explore?
• /hot - See trending markets
• /arb - Find arbitrage opportunities
• /research <topic> - Deep dive on a topic

Or just ask me about any market topic!`,
      mood: 'NEUTRAL',
    };
  }

  // Who are you / What is this
  if (/^(who|what)\s+(are|is)\s+(you|this|beright)/i.test(lower)) {
    return {
      text: `I'm BeRight - a prediction market intelligence terminal.

I help you:
🎯 Find mispriced markets & arbitrage
📊 Analyze odds across platforms
🐋 Track whale (smart money) activity
📈 Improve your forecasting calibration

I'm not a general chatbot - I'm specialized for prediction markets.

Try /help to see what I can do.`,
      mood: 'EDUCATIONAL',
    };
  }

  // What can you do
  if (/^what\s+can\s+(you|i)/i.test(lower) || /^(can|do|will)\s+you/i.test(lower)) {
    return {
      text: `Here's what I can help with:

📊 *Market Analysis*
/hot - Trending markets
/odds <topic> - Compare prices across platforms
/research <topic> - Superforecaster analysis

💰 *Trading*
/arb - Find arbitrage opportunities
/whale - Track smart money
/trade - Execute trades (verified users)

🎯 *Forecasting*
/predict - Make predictions
/calibration - Track your accuracy
/leaderboard - See top forecasters

Type /help for the full command list.`,
      mood: 'EDUCATIONAL',
    };
  }

  // System/admin requests (politely decline)
  if (/^(show|give|tell|get|display|print|list)\s+(me\s+)?(the\s+)?(logs?|errors?|status|config|settings|data|users?|messages?|secrets?|keys?|env)/i.test(lower)) {
    return {
      text: `I'm a prediction market agent, not a system admin tool.

I can help you with:
• /hot - Market trends
• /arb - Arbitrage opportunities
• /research <topic> - Market analysis

What market topic interests you?`,
      mood: 'NEUTRAL',
    };
  }

  // Thanks / acknowledgments
  if (/^(thanks?|thank\s+you|ok|okay|cool|nice|great|good|awesome|got\s+it)/i.test(lower)) {
    return {
      text: `You're welcome! Let me know if you need anything else.

Quick actions:
• /hot - What's trending
• /brief - Morning briefing
• /me - Your stats`,
      mood: 'NEUTRAL',
    };
  }

  // Not a recognized pattern - let caller handle
  return null;
}

/**
 * Handle /start command
 */
function handleStart(): SkillResponse {
  return {
    text: `
🎯 Welcome to BeRight

I'm your prediction market intelligence terminal.

I help you:
• Find arbitrage opportunities across platforms
• Research markets with superforecaster methodology
• Track whale (smart money) activity
• Monitor news and social sentiment

${HELP_TEXT}

Let's make you a better forecaster.
`,
    mood: 'NEUTRAL',
  };
}

/**
 * Handle /help command
 */
function handleHelp(): SkillResponse {
  return {
    text: HELP_TEXT,
    mood: 'EDUCATIONAL',
  };
}

/**
 * Handle /brief command (morning briefing)
 */
async function handleBrief(): Promise<SkillResponse> {
  return await morningBrief('telegram');
}

/**
 * Handle /hot command (trending markets)
 *
 * NEW: Clean alpha-focused format with signals
 */
async function handleHot(): Promise<SkillResponse> {
  const { formatTrendingMarkets } = await import('./formatters');
  const markets = await getHotMarkets(10);

  const text = formatTrendingMarkets(markets);

  return { text, mood: 'NEUTRAL', data: markets };
}

/**
 * Handle /alpha command - actionable market opportunities
 *
 * Shows high conviction plays, contentious markets, and whale activity
 */
async function handleAlpha(): Promise<SkillResponse> {
  const { formatAlphaMarkets } = await import('./formatters');
  const markets = await getHotMarkets(20);

  const text = formatAlphaMarkets(markets);

  return { text, mood: 'BULLISH', data: markets };
}

/**
 * Handle /closing command - Markets expiring soon with alpha
 * Shows markets closing within 24h that may have arbitrage or mispricing
 */
async function handleClosing(): Promise<SkillResponse> {
  try {
    // Fetch markets from multiple platforms
    const markets = await searchMarkets('');

    // Filter to markets closing within 24 hours
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const closingMarkets = markets.filter(m => {
      if (!m.endDate) return false;
      const endDate = new Date(m.endDate);
      return endDate > now && endDate <= in24Hours;
    });

    // Sort by closing time (soonest first)
    closingMarkets.sort((a, b) => {
      const aEnd = new Date(a.endDate!).getTime();
      const bEnd = new Date(b.endDate!).getTime();
      return aEnd - bEnd;
    });

    if (closingMarkets.length === 0) {
      return {
        text: `⏰ *CLOSING SOON*
${'━'.repeat(40)}

No markets closing in the next 24 hours.

💡 Try:
• /hot - See trending markets
• /arb - Find arbitrage opportunities
• /brief - Morning briefing`,
        mood: 'NEUTRAL',
      };
    }

    let output = `⏰ *CLOSING SOON ALPHA*
${'━'.repeat(40)}
Markets expiring in <24 hours - act fast!

`;

    // Group by time remaining
    const within1h: typeof closingMarkets = [];
    const within6h: typeof closingMarkets = [];
    const within24h: typeof closingMarkets = [];

    for (const m of closingMarkets) {
      const hoursLeft = (new Date(m.endDate!).getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursLeft <= 1) within1h.push(m);
      else if (hoursLeft <= 6) within6h.push(m);
      else within24h.push(m);
    }

    // Format urgent markets (< 1 hour)
    if (within1h.length > 0) {
      output += `🚨 *CLOSING IN <1 HOUR* (URGENT)\n`;
      for (const m of within1h.slice(0, 3)) {
        const minsLeft = Math.round((new Date(m.endDate!).getTime() - now.getTime()) / (1000 * 60));
        const pricePct = (m.yesPrice * 100).toFixed(0);
        const shortTitle = m.title.length > 35 ? m.title.slice(0, 35) + '...' : m.title;

        output += `\n⏱️ *${minsLeft} mins left*\n`;
        output += `   ${shortTitle}\n`;
        output += `   ${pricePct}% YES @ ${m.platform}\n`;
        if (m.url) output += `   [Trade Now](${m.url})\n`;

        // Show edge
        const cost = m.yesPrice > 0.5 ? m.yesPrice * 100 : (1 - m.yesPrice) * 100;
        const profit = 100 - cost;
        const side = m.yesPrice > 0.5 ? 'YES' : 'NO';
        output += `   💰 ${side} @ ${cost.toFixed(0)}¢ → Win ${profit.toFixed(0)}¢/dollar\n`;
      }
      output += '\n';
    }

    // Format markets closing today (< 6 hours)
    if (within6h.length > 0) {
      output += `⚡ *CLOSING IN <6 HOURS*\n`;
      for (const m of within6h.slice(0, 3)) {
        const hoursLeft = Math.round((new Date(m.endDate!).getTime() - now.getTime()) / (1000 * 60 * 60));
        const pricePct = (m.yesPrice * 100).toFixed(0);
        const shortTitle = m.title.length > 35 ? m.title.slice(0, 35) + '...' : m.title;

        output += `\n⏱️ *${hoursLeft}h left*\n`;
        output += `   ${shortTitle}\n`;
        output += `   ${pricePct}% YES @ ${m.platform}\n`;
        if (m.url) output += `   [Trade](${m.url})\n`;
      }
      output += '\n';
    }

    // Format markets closing within 24h
    if (within24h.length > 0) {
      output += `📅 *CLOSING TODAY* (${within24h.length} markets)\n`;
      for (const m of within24h.slice(0, 3)) {
        const hoursLeft = Math.round((new Date(m.endDate!).getTime() - now.getTime()) / (1000 * 60 * 60));
        const pricePct = (m.yesPrice * 100).toFixed(0);
        const shortTitle = m.title.length > 30 ? m.title.slice(0, 30) + '...' : m.title;
        output += `   • ${shortTitle} (${pricePct}% YES, ${hoursLeft}h)\n`;
      }
    }

    output += `\n${'━'.repeat(40)}\n`;
    output += `💡 *Tips:*\n`;
    output += `• Check /arb for cross-platform price diff\n`;
    output += `• High conviction plays (>80% or <20%) often resolve as expected\n`;
    output += `• Compare with /odds <topic> before trading`;

    return {
      text: output,
      mood: 'ALERT',
      data: closingMarkets,
    };

  } catch (error) {
    console.error('Error in handleClosing:', error);
    return {
      text: `⏰ Error fetching closing markets. Try again later.`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /predict command
 *
 * WIRED TO: Supabase (primary) + Solana Memo (verification)
 */
async function handlePredict(text: string, telegramId?: string, username?: string): Promise<SkillResponse> {
  // Parse: /predict "question" 70 YES reasoning...
  const match = text.match(/\/predict\s+["']?([^"']+)["']?\s+(\d+(?:\.\d+)?)\s+(YES|NO)(?:\s+(.+))?/i);

  if (!match) {
    return {
      text: `
📝 *MAKE A PREDICTION*

Usage: /predict <question> <probability> YES|NO [reasoning]

Examples:
/predict "Bitcoin above 100K by Dec 2026" 65 YES Strong ETF inflows
/predict "Fed cuts in March" 40 NO Inflation still high

Probability should be 0-100 (your confidence %).

Your predictions are stored in Supabase and committed on-chain to Solana for verification.
`,
      mood: 'EDUCATIONAL',
    };
  }

  const [, question, probStr, direction, reasoning] = match;
  const probability = parseFloat(probStr) / 100; // Convert to 0-1
  const directionUpper = direction.toUpperCase() as 'YES' | 'NO';

  if (probability < 0 || probability > 1) {
    return { text: 'Probability must be between 0 and 100', mood: 'ERROR' };
  }

  if (!telegramId) {
    return { text: 'Could not identify your account. Please try again.', mood: 'ERROR' };
  }

  try {
    // 1. Get or create user in Supabase
    const user = await db.users.upsertFromTelegram(parseInt(telegramId), username);

    if (!user) {
      // Fallback to file-based if Supabase fails
      console.warn('Supabase user creation failed, falling back to file-based');
      const globalResult = await predict(question, probability, directionUpper, reasoning || 'No reasoning provided', 'telegram');
      addUserPrediction(telegramId, question, probability, directionUpper, reasoning || 'No reasoning provided', 'telegram');
      return globalResult;
    }

    // 2. Create prediction in Supabase
    const prediction = await db.predictions.create({
      user_id: user.id,
      question: question,
      predicted_probability: probability,
      direction: directionUpper,
      platform: 'telegram',
      market_id: question.slice(0, 50).replace(/[^a-zA-Z0-9-]/g, '-').toUpperCase(),
      reasoning: reasoning || 'No reasoning provided',
      confidence: probability > 0.8 || probability < 0.2 ? 'high' : probability > 0.6 || probability < 0.4 ? 'medium' : 'low',
    });

    // 3. Commit to Solana on-chain
    let chainResult: { success: boolean; signature?: string; explorerUrl?: string; error?: string } = { success: false };

    try {
      chainResult = await commitPrediction(
        user.wallet_address || telegramId,
        prediction.market_id || question.slice(0, 30),
        probability,
        directionUpper
      );

      // 4. Update prediction with TX signature if successful
      if (chainResult.success && chainResult.signature) {
        await db.predictions.addOnChainTx(prediction.id, chainResult.signature);
      }
    } catch (chainError) {
      console.warn('On-chain commit failed:', chainError);
      chainResult = { success: false, error: String(chainError) };
    }

    // 4.5. Register with MarketWatcher for auto-resolution if market_id exists (acts as ticker)
    if (prediction.market_id) {
      try {
        const watcher = getMarketWatcher();
        await watcher.watchPrediction(prediction.id, prediction.market_id);
        console.log(`[Prediction] Registered for auto-resolution: ${prediction.market_id}`);
      } catch (watcherError) {
        // Don't fail the prediction if watcher registration fails
        console.warn('MarketWatcher registration failed:', watcherError);
      }
    }

    // 5. Also store in file-based system for backward compatibility
    addUserPrediction(telegramId, question, probability, directionUpper, reasoning || 'No reasoning provided', 'telegram');

    // 6. Get user stats for response
    const userPredictions = await db.predictions.getByUser(user.id);
    const totalPredictions = userPredictions.length;

    // 7. Format response
    const chainStatus = chainResult.success
      ? `\n⛓️ *On-Chain Verified*\nTX: \`${chainResult.signature?.slice(0, 12)}...\`\n🔗 [View on Solscan](${chainResult.explorerUrl})`
      : `\n⚠️ On-chain commit pending`;

    return {
      text: `
✅ *PREDICTION RECORDED*
${'─'.repeat(35)}

📊 *${question}*

🎯 Direction: ${directionUpper}
📈 Probability: ${(probability * 100).toFixed(0)}%
💭 Reasoning: ${reasoning || 'None provided'}
${chainStatus}

📊 Your total predictions: ${totalPredictions}
Use /me to see your stats
`,
      mood: 'NEUTRAL',
      data: { prediction, chainResult },
    };

  } catch (error) {
    console.error('Prediction error:', error);

    // Fallback to file-based storage
    console.warn('Falling back to file-based storage');
    const globalResult = await predict(question, probability, directionUpper, reasoning || 'No reasoning provided', 'telegram');
    addUserPrediction(telegramId, question, probability, directionUpper, reasoning || 'No reasoning provided', 'telegram');

    return {
      text: globalResult.text + '\n\n⚠️ Note: Stored locally (Supabase unavailable)',
      mood: globalResult.mood,
      data: globalResult.data,
    };
  }
}

/**
 * Handle /me command (user stats)
 *
 * WIRED TO: Supabase (primary) with file-based fallback
 */
async function handleMe(telegramId?: string): Promise<SkillResponse> {
  if (!telegramId) {
    return { text: 'Could not identify your account. Please try again.', mood: 'ERROR' };
  }

  try {
    // 1. Try to get user from Supabase
    const user = await db.users.getByTelegramId(parseInt(telegramId));

    if (user) {
      // 2. Get predictions from Supabase
      const predictions = await db.predictions.getByUser(user.id);
      const resolved = predictions.filter(p => p.resolved_at);
      const pending = predictions.filter(p => !p.resolved_at);
      const onChainVerified = predictions.filter(p => p.on_chain_tx);

      // 3. Calculate Brier score
      const brierScores = resolved
        .map(p => p.brier_score)
        .filter((b): b is number => b !== null && b !== undefined);
      const avgBrier = brierScores.length > 0
        ? brierScores.reduce((a, b) => a + b, 0) / brierScores.length
        : 0;

      // 4. Calculate accuracy
      const correct = resolved.filter(p =>
        (p.direction === 'YES') === p.outcome
      );
      const accuracy = resolved.length > 0 ? correct.length / resolved.length : 0;

      // 5. Get grade using on-chain interpretBrierScore
      const gradeInfo = brierScores.length > 0
        ? interpretBrierScore(avgBrier)
        : { quality: 'new' as const, description: 'Make predictions to build track record' };

      const gradeEmoji =
        gradeInfo.quality === 'excellent' ? '🏆' :
        gradeInfo.quality === 'good' ? '⭐' :
        gradeInfo.quality === 'fair' ? '✨' :
        gradeInfo.quality === 'poor' ? '👍' :
        gradeInfo.quality === 'bad' ? '📈' : '📊';

      // 6. Get user rank from leaderboard
      const rank = await db.leaderboard.getUserRank(user.id);
      const rankText = rank ? `#${rank}` : 'Unranked (need 5+ resolved)';

      // 7. Format response
      let text = `
📊 *YOUR STATS* ${user.telegram_username ? `(@${user.telegram_username})` : ''}
${'─'.repeat(35)}

${gradeEmoji} *${gradeInfo.description}*

📈 *Performance*
• Brier Score: ${avgBrier.toFixed(4)} ${avgBrier < 0.2 ? '✅' : ''}
• Accuracy: ${(accuracy * 100).toFixed(1)}%
• Predictions: ${predictions.length} (${resolved.length} resolved)
• Rank: ${rankText}

⛓️ *On-Chain Verified*
• ${onChainVerified.length}/${predictions.length} predictions committed to Solana

`;

      if (pending.length > 0) {
        text += `⏳ *Pending* (${pending.length})\n`;
        for (const p of pending.slice(0, 3)) {
          text += `• ${p.question.slice(0, 28)}... ${p.direction} @ ${(p.predicted_probability * 100).toFixed(0)}%\n`;
        }
        if (pending.length > 3) text += `  ... and ${pending.length - 3} more\n`;
      }

      text += `
💡 *Brier Score Guide*
• < 0.10 = Superforecaster Elite 🏆
• < 0.20 = Good ⭐
• = 0.25 = Random guessing

/calibration - Full report | /leaderboard - Rankings
`;

      return { text, mood: avgBrier < 0.2 ? 'BULLISH' : 'NEUTRAL', data: { user, predictions, avgBrier } };
    }
  } catch (error) {
    console.warn('Supabase query failed, falling back to file-based:', error);
  }

  // FALLBACK: Use file-based stats
  let userStats = calculateUserStats(telegramId);
  const globalStats = getCalibrationStats();
  const pending = getUserPendingPredictions(telegramId);

  const stats = userStats && userStats.totalPredictions > 0 ? userStats : {
    brierScore: globalStats.overallBrierScore,
    accuracy: globalStats.accuracy,
    totalPredictions: globalStats.totalPredictions,
    resolvedPredictions: globalStats.resolvedPredictions,
    streak: globalStats.streak.current,
    streakType: globalStats.streak.type,
  };

  let grade = { emoji: '📊', label: 'Start Predicting' };
  if (stats.resolvedPredictions > 0) {
    if (stats.brierScore < 0.1) grade = { emoji: '🏆', label: 'Superforecaster Elite' };
    else if (stats.brierScore < 0.15) grade = { emoji: '⭐', label: 'Superforecaster' };
    else if (stats.brierScore < 0.2) grade = { emoji: '✨', label: 'Very Good' };
    else if (stats.brierScore < 0.25) grade = { emoji: '👍', label: 'Above Average' };
    else grade = { emoji: '📈', label: 'Keep Practicing' };
  }

  let text = `
📊 *YOUR STATS* (local)
${'─'.repeat(35)}

${grade.emoji} *${grade.label}*

📈 *Performance*
• Brier Score: ${stats.brierScore.toFixed(4)}
• Accuracy: ${(stats.accuracy * 100).toFixed(1)}%
• Predictions: ${stats.totalPredictions} (${stats.resolvedPredictions} resolved)

`;

  if (stats.streak > 0) {
    const streakEmoji = stats.streakType === 'win' ? '🔥' : '❄️';
    text += `🎯 *Streak*: ${stats.streak} ${stats.streakType === 'win' ? 'wins' : 'losses'} ${streakEmoji}\n\n`;
  }

  if (pending.length > 0) {
    text += `⏳ *Pending* (${pending.length})\n`;
    for (const p of pending.slice(0, 3)) {
      const prob = 'predictedProbability' in p ? p.predictedProbability : 0;
      const dir = 'direction' in p ? p.direction : '?';
      const q = 'question' in p ? p.question : '';
      text += `• ${q.slice(0, 30)}... ${dir} @ ${(prob * 100).toFixed(0)}%\n`;
    }
    if (pending.length > 3) text += `  ... and ${pending.length - 3} more\n`;
  }

  text += `
/calibration - Full calibration report
/leaderboard - See top forecasters
`;

  return { text, mood: stats.brierScore < 0.2 ? 'BULLISH' : 'NEUTRAL', data: stats };
}

/**
 * Handle /connect command - Link wallet to Telegram account
 */
async function handleConnect(text: string, telegramId?: string, username?: string): Promise<SkillResponse> {
  if (!telegramId) {
    return {
      text: '❌ Could not identify your Telegram account. Try again.',
      mood: 'ERROR',
    };
  }

  // Parse wallet address
  const match = text.match(/\/connect\s+([1-9A-HJ-NP-Za-km-z]{32,44})/);

  if (!match) {
    const user = getUserByTelegram(telegramId);
    if (user?.walletAddress) {
      return {
        text: `
🔗 *WALLET CONNECTED*

Your wallet: \`${user.walletAddress.slice(0, 8)}...${user.walletAddress.slice(-6)}\`

To link a different wallet:
/connect <solana_address>
`,
        mood: 'NEUTRAL',
      };
    }

    return {
      text: `
🔗 *CONNECT WALLET*

Link your Solana wallet to track trades and build your forecaster profile.

Usage: /connect <solana_address>

Example:
/connect 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU

Benefits:
• Track your trading volume
• Build forecaster reputation
• Enable trade execution
`,
      mood: 'EDUCATIONAL',
    };
  }

  const walletAddress = match[1];

  try {
    // Validate it's a real Solana address by checking on-chain
    const { PublicKey } = await import('@solana/web3.js');
    new PublicKey(walletAddress); // Will throw if invalid

    // Ensure user exists
    getOrCreateUser(telegramId, username);

    // Link wallet
    const user = linkWallet(telegramId, walletAddress);

    if (!user) {
      return {
        text: '❌ Failed to link wallet. Try again.',
        mood: 'ERROR',
      };
    }

    return {
      text: `
✅ *WALLET LINKED*
${'─'.repeat(35)}

Address: \`${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}\`

You can now:
• /buy to get trade quotes
• /volume to track your metrics
• /profile to view your stats

Welcome to BeRight! 🎯
`,
      mood: 'BULLISH',
    };
  } catch (error) {
    return {
      text: `❌ Invalid Solana address. Please check and try again.`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /profile command - View user profile
 */
async function handleProfile(telegramId?: string, username?: string): Promise<SkillResponse> {
  if (!telegramId) {
    return {
      text: '❌ Could not identify your Telegram account.',
      mood: 'ERROR',
    };
  }

  const user = getOrCreateUser(telegramId, username);
  const stats = getCalibrationStats();

  // Check if wallet is connected
  const walletStatus = user.walletAddress
    ? `\`${user.walletAddress.slice(0, 8)}...${user.walletAddress.slice(-6)}\``
    : '❌ Not connected (/connect to link)';

  let text = `
👤 *YOUR PROFILE*
${'─'.repeat(35)}

📱 Telegram: @${user.telegramUsername || 'unknown'}
💳 Wallet: ${walletStatus}
📅 Joined: ${new Date(user.createdAt).toLocaleDateString()}

📊 *FORECASTING STATS*
• Brier Score: ${stats.overallBrierScore.toFixed(4)}
• Accuracy: ${(stats.accuracy * 100).toFixed(1)}%
• Predictions: ${stats.totalPredictions}

💹 *TRADING STATS*
• Total Trades: ${user.stats.totalTrades}
• Volume: ${formatUsd(user.stats.volumeUsd)}

⚙️ *SETTINGS*
• Alerts: ${user.settings.alerts ? '✅ On' : '❌ Off'}
`;

  if (user.walletAddress) {
    text += `\n/wallet ${user.walletAddress} - Check balance`;
  }

  return { text, mood: 'NEUTRAL', data: user };
}

/**
 * Handle /leaderboard command
 *
 * WIRED TO: Supabase leaderboard view (primary) with file-based fallback
 */
async function handleLeaderboard(telegramId?: string): Promise<SkillResponse> {
  try {
    // 1. Try to get leaderboard from Supabase
    const supabaseEntries = await db.leaderboard.get({ limit: 10 });

    if (supabaseEntries && supabaseEntries.length > 0) {
      // Format Supabase leaderboard
      let text = `
🏆 *FORECASTER LEADERBOARD*
${'─'.repeat(35)}

`;

      for (let i = 0; i < supabaseEntries.length; i++) {
        const e = supabaseEntries[i];
        const rank = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
        const name = e.telegram_username ? `@${e.telegram_username}` : `User ${e.telegram_id?.toString().slice(-4) || '???'}`;

        // Grade based on Brier score
        const brier = e.avg_brier_score || 0;
        const gradeEmoji =
          brier < 0.1 ? '🏆' :
          brier < 0.15 ? '⭐' :
          brier < 0.2 ? '✨' :
          brier < 0.25 ? '👍' : '📈';

        text += `${rank} ${gradeEmoji} *${name}*\n`;
        text += `   Brier: ${brier.toFixed(3)} | Acc: ${((e.accuracy || 0) * 100).toFixed(0)}% | n=${e.prediction_count || 0}\n\n`;
      }

      // Check if current user is on the leaderboard
      let yourRank = '';
      if (telegramId) {
        const user = await db.users.getByTelegramId(parseInt(telegramId));
        if (user) {
          const userRank = await db.leaderboard.getUserRank(user.id);
          if (userRank) {
            yourRank = `\n📍 You are ranked #${userRank}`;
          } else {
            const predictions = await db.predictions.getByUser(user.id);
            const resolved = predictions.filter(p => p.resolved_at);
            if (resolved.length > 0 && resolved.length < 5) {
              yourRank = `\n📍 ${resolved.length}/5 resolved predictions to rank`;
            } else if (resolved.length === 0) {
              yourRank = `\n📍 Make predictions with /predict to join`;
            }
          }
        }
      }

      text += `${'─'.repeat(35)}
*Brier Score* (lower = better calibration)
• < 0.15 = Superforecaster ⭐
• < 0.25 = Above Average 👍
• = 0.25 = Random Guessing 🎲

⛓️ All predictions verified on Solana
${yourRank}
/me - Your stats | /calibration - Full report`;

      return {
        text,
        mood: 'BULLISH',
        data: supabaseEntries,
      };
    }
  } catch (error) {
    console.warn('Supabase leaderboard failed, falling back to file-based:', error);
  }

  // FALLBACK: Use file-based leaderboard
  const entries = getLeaderboard(10);
  const text = formatLeaderboard(entries);

  let yourRank = '';
  if (telegramId) {
    const userEntry = entries.find(e => e.telegramId === telegramId);
    if (userEntry) {
      yourRank = `\n📍 You are ranked #${userEntry.rank}`;
    } else {
      const stats = calculateUserStats(telegramId);
      if (stats.resolvedPredictions > 0) {
        yourRank = `\n📍 Your Brier: ${stats.brierScore.toFixed(3)} (need 5+ resolved to rank)`;
      }
    }
  }

  return {
    text: text + yourRank + '\n\n(local data)',
    mood: entries.length > 0 ? 'BULLISH' : 'NEUTRAL',
    data: entries,
  };
}

/**
 * Handle /swap command
 */
async function handleSwap(text: string): Promise<SkillResponse> {
  // Parse: /swap 1 SOL USDC
  const match = text.match(/\/swap\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(\w+)/i);

  if (!match) {
    return {
      text: `
💱 *JUPITER SWAP QUOTE*

Usage: /swap <amount> <from> <to>

Examples:
/swap 1 SOL USDC
/swap 100 USDC SOL
/swap 1000000 BONK SOL

Supported tokens: SOL, USDC, BONK, JUP, WIF, POPCAT
`,
      mood: 'EDUCATIONAL',
    };
  }

  const [, amountStr, fromToken, toToken] = match;
  const amount = parseFloat(amountStr);

  const quote = await getSwapQuote(fromToken.toUpperCase(), toToken.toUpperCase(), amount);

  if (!quote) {
    return {
      text: `❌ Could not get quote for ${amount} ${fromToken} → ${toToken}. Check token symbols.`,
      mood: 'ERROR',
    };
  }

  // Parse string values from Jupiter API
  const outAmount = parseFloat(quote.outAmount) / 1e6; // Assuming USDC/most tokens use 6 decimals
  const priceImpactNum = parseFloat(quote.priceImpactPct) * 100;
  const priceImpactLabel = priceImpactNum < 0.1 ? '✅ Low' : priceImpactNum < 1 ? '⚠️ Medium' : '🔴 High';
  const routeSteps = quote.routePlan?.length || 1;

  return {
    text: `
💱 *SWAP QUOTE*
${'─'.repeat(35)}

${amount} ${fromToken} → ${outAmount.toFixed(6)} ${toToken}

📊 Rate: 1 ${fromToken} = ${(outAmount / amount).toFixed(6)} ${toToken}
💨 Price Impact: ${priceImpactNum.toFixed(3)}% ${priceImpactLabel}
🛣️ Route Steps: ${routeSteps}

⚠️ Quote valid for ~30 seconds
`,
    mood: 'NEUTRAL',
    data: quote,
  };
}

/**
 * Handle /buy command - Buy prediction tokens
 */
async function handleBuy(text: string): Promise<SkillResponse> {
  // Parse: /buy TICKER YES|NO amount
  const match = text.match(/\/buy\s+(\S+)\s+(YES|NO)\s+(\d+(?:\.\d+)?)/i);

  if (!match) {
    return {
      text: `
🎯 *BUY PREDICTION TOKENS*

Usage: /buy <ticker> <YES|NO> <amount_usdc>

Examples:
/buy KXFEDCHAIRNOM-29-KW YES 5
/buy KXPRESNOMD-28-BS NO 10

Find tickers with /scan or /hot
`,
      mood: 'EDUCATIONAL',
    };
  }

  const [, ticker, direction, amountStr] = match;
  const amount = parseFloat(amountStr);

  try {
    const result = await getTradeQuote(ticker.toUpperCase(), direction.toUpperCase() as 'YES' | 'NO', amount);

    if (!result) {
      return {
        text: `❌ Could not find market: ${ticker}\n\nTry /scan to find valid markets.`,
        mood: 'ERROR',
      };
    }

    const { quote, token } = result;

    // Calculate output amount from Jupiter quote or estimate from price
    let outputAmount = 0;
    let priceImpact = 0;

    if (quote?.outAmount) {
      outputAmount = parseFloat(quote.outAmount) / 1e6; // Assuming 6 decimals
      priceImpact = parseFloat(quote.priceImpactPct || '0');
    } else {
      // Estimate based on token price
      const price = direction.toUpperCase() === 'YES' ? token.yesPrice : token.noPrice;
      outputAmount = price > 0 ? amount / price : 0;
    }

    return {
      text: `
🎯 *PREDICTION TRADE QUOTE*
${'─'.repeat(35)}

*Market:* ${token.title}
*Ticker:* ${token.ticker}
*Direction:* ${direction.toUpperCase()}

💵 *Input:* ${amount.toFixed(2)} USDC
📈 *Output:* ${outputAmount.toFixed(4)} ${direction.toUpperCase()} tokens
📊 *Price Impact:* ${(priceImpact * 100).toFixed(2)}%
${!quote ? '\n⚠️ No Jupiter liquidity - direct DFlow trade needed' : ''}

⚠️ This is a quote only (dry run)
To execute: /execute ${ticker} ${direction} ${amount}
`,
      mood: 'NEUTRAL',
      data: result,
    };
  } catch (error) {
    return {
      text: `❌ Quote failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /scan command - Scan for trading opportunities
 */
async function handleScan(): Promise<SkillResponse> {
  try {
    // Scan for cross-platform price spreads (real trading opportunities)
    const markets = await searchMarkets('');

    // Group markets by similar topics
    const marketsByTopic = new Map<string, typeof markets>();

    for (const m of markets) {
      // Create a simple topic key from title
      const key = m.title
        .toLowerCase()
        .replace(/will\s+/gi, '')
        .replace(/\?/g, '')
        .slice(0, 30)
        .trim();

      if (!marketsByTopic.has(key)) {
        marketsByTopic.set(key, []);
      }
      marketsByTopic.get(key)!.push(m);
    }

    // Find spreads between platforms
    const spreads: Array<{
      topic: string;
      platformA: string;
      platformB: string;
      priceA: number;
      priceB: number;
      spread: number;
      urlA: string;
      urlB: string;
    }> = [];

    for (const [topic, groupedMarkets] of marketsByTopic.entries()) {
      if (groupedMarkets.length < 2) continue;

      // Find markets from different platforms
      const platforms = [...new Set(groupedMarkets.map(m => m.platform))];
      if (platforms.length < 2) continue;

      // Compare prices across platforms
      for (let i = 0; i < groupedMarkets.length; i++) {
        for (let j = i + 1; j < groupedMarkets.length; j++) {
          const a = groupedMarkets[i];
          const b = groupedMarkets[j];
          if (a.platform === b.platform) continue;

          const spread = Math.abs(a.yesPrice - b.yesPrice) * 100;
          if (spread >= 3) {
            spreads.push({
              topic: a.title.slice(0, 40),
              platformA: a.platform,
              platformB: b.platform,
              priceA: a.yesPrice * 100,
              priceB: b.yesPrice * 100,
              spread,
              urlA: a.url,
              urlB: b.url,
            });
          }
        }
      }
    }

    // Sort by spread size
    spreads.sort((a, b) => b.spread - a.spread);

    if (spreads.length === 0) {
      return {
        text: `📊 *SPREAD SCANNER*
${'━'.repeat(40)}

No significant cross-platform spreads found (>3%).

Markets are efficiently priced right now.

💡 Try:
• /arb - Full arbitrage analysis
• /hot - Trending markets
• /closing - Expiring markets`,
        mood: 'NEUTRAL',
      };
    }

    let text = `📊 *SPREAD OPPORTUNITIES*
${'━'.repeat(40)}
Found ${spreads.length} cross-platform spreads >3%

`;

    for (const s of spreads.slice(0, 5)) {
      const cheaper = s.priceA < s.priceB ? s.platformA : s.platformB;
      const expensive = s.priceA > s.priceB ? s.platformA : s.platformB;
      const lowPrice = Math.min(s.priceA, s.priceB);
      const highPrice = Math.max(s.priceA, s.priceB);
      const cheaperUrl = s.priceA < s.priceB ? s.urlA : s.urlB;
      const expensiveUrl = s.priceA > s.priceB ? s.urlA : s.urlB;

      text += `🚨 *${s.spread.toFixed(1)}% SPREAD*\n`;
      text += `   "${s.topic}..."\n`;
      text += `   ├─ [${cheaper.toUpperCase()}](${cheaperUrl}): ${lowPrice.toFixed(0)}¢ YES\n`;
      text += `   └─ [${expensive.toUpperCase()}](${expensiveUrl}): ${highPrice.toFixed(0)}¢ YES\n`;
      text += `   💰 Buy @ ${cheaper}, Sell @ ${expensive}\n\n`;
    }

    text += `${'━'.repeat(40)}\n`;
    text += `💡 /arb for full arbitrage analysis`;

    return { text, mood: 'ALERT', data: spreads };
  } catch (error) {
    return {
      text: `❌ Scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /volume command - Show Builder Code volume metrics
 */
async function handleVolume(): Promise<SkillResponse> {
  try {
    const metrics = await getVolumeMetrics();

    const topMarkets = Object.entries(metrics.byMarket)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    let text = `
📊 *BUILDER CODE VOLUME*
${'─'.repeat(35)}

💰 Total Volume: ${formatUsd(metrics.totalVolumeUsd)}
🔢 Total Trades: ${metrics.totalTrades}
📈 Unique Markets: ${metrics.uniqueMarkets}

`;

    if (topMarkets.length > 0) {
      text += `*Top Markets:*\n`;
      for (const [market, vol] of topMarkets) {
        text += `• ${market.slice(0, 25)}... ${formatUsd(vol)}\n`;
      }
    }

    text += `\n🎯 Track volume for Kalshi's $2M grant`;

    return { text, mood: 'NEUTRAL', data: metrics };
  } catch (error) {
    return {
      text: `❌ Volume check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /lp command - Show LP opportunities
 */
async function handleLP(): Promise<SkillResponse> {
  return await handleScan(); // Same as /scan for now
}

// ============================================
// KALSHI HANDLERS
// ============================================

/**
 * Handle /kalshi command - Account overview
 */
async function handleKalshiOverview(): Promise<SkillResponse> {
  const client = getKalshiClient();
  if (!client) {
    return {
      text: `
⚠️ *KALSHI NOT CONFIGURED*

To use Kalshi trading:
1. Get API keys from kalshi.com/account/api
2. Add to .env:
   KALSHI_API_KEY=your_key
   KALSHI_API_SECRET=your_private_key

Then restart the bot.
`,
      mood: 'NEUTRAL',
    };
  }

  try {
    const [balance, positions] = await Promise.all([
      getKalshiBalance(),
      getKalshiPositions(),
    ]);

    let positionsText = '';
    let totalValue = 0;
    if (positions.length > 0) {
      for (const pos of positions.slice(0, 5)) {
        const value = pos.position * (pos.average_price / 100);
        totalValue += value;
        positionsText += `• ${pos.market_ticker}: ${pos.position} @ ${(pos.average_price / 100).toFixed(2)}¢\n`;
      }
      if (positions.length > 5) {
        positionsText += `  ... and ${positions.length - 5} more\n`;
      }
    }

    const modeLabel = isKalshiDemo() ? '🧪 DEMO' : '💰 LIVE';

    return {
      text: `
🔵 *KALSHI ACCOUNT* ${modeLabel}
${'═'.repeat(35)}

💰 *Balance:* $${balance ? (balance.balance / 100).toFixed(2) : '0.00'}
💵 *Available:* $${balance?.available_balance ? (balance.available_balance / 100).toFixed(2) : '0.00'}
📊 *Positions:* ${positions.length}
📈 *Position Value:* $${totalValue.toFixed(2)}

${positionsText ? `\n*Open Positions:*\n${positionsText}` : ''}
${'─'.repeat(35)}
*ACCOUNT*
/kportfolio - Full portfolio analytics
/kbalance - Detailed balance
/kpositions - All positions
/korders - View orders
/kfills - Trade history
/ksettlements - Winnings & payouts

*MARKETS*
/kmarkets [query] - Browse markets
/kbook <ticker> - View orderbook

*TRADING*
/kbuy <ticker> <yes|no> <qty> <price>
/ksell <ticker> <yes|no> <qty> <price>
/kcancel <id> | all - Cancel orders
/kamend <id> [qty] [price] - Amend order
`,
      mood: 'NEUTRAL',
      data: { balance, positions },
    };
  } catch (error) {
    return {
      text: `❌ Kalshi API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /kbalance command
 */
async function handleKalshiBalance(): Promise<SkillResponse> {
  const client = getKalshiClient();
  if (!client) {
    return { text: '⚠️ Kalshi not configured. Use /kalshi for setup info.', mood: 'NEUTRAL' };
  }

  try {
    const balance = await getKalshiBalance();
    if (!balance) {
      return { text: '❌ Could not fetch balance', mood: 'ERROR' };
    }

    return {
      text: `
💰 *KALSHI BALANCE*
${'─'.repeat(35)}

Total: $${(balance.balance / 100).toFixed(2)}
Available: $${((balance.available_balance ?? 0) / 100).toFixed(2)}
Payout: $${((balance.payout_balance ?? 0) / 100).toFixed(2)}
`,
      mood: 'NEUTRAL',
      data: balance,
    };
  } catch (error) {
    return {
      text: `❌ Balance error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /kpositions command
 */
async function handleKalshiPositions(): Promise<SkillResponse> {
  const client = getKalshiClient();
  if (!client) {
    return { text: '⚠️ Kalshi not configured. Use /kalshi for setup info.', mood: 'NEUTRAL' };
  }

  try {
    const positions = await getKalshiPositions();
    if (positions.length === 0) {
      return { text: '📊 No open positions on Kalshi.\n\nUse /kmarkets to find markets.', mood: 'NEUTRAL' };
    }

    let text = `
📊 *KALSHI POSITIONS* (${positions.length})
${'─'.repeat(35)}

`;

    for (const pos of positions) {
      const value = pos.position * (pos.average_price / 100);
      text += `*${pos.market_ticker}*\n`;
      text += `  Contracts: ${pos.position}\n`;
      text += `  Avg Price: ${(pos.average_price / 100).toFixed(2)}¢\n`;
      text += `  Value: $${value.toFixed(2)}\n`;
      text += `  Resting Orders: ${pos.resting_order_count}\n\n`;
    }

    return { text, mood: 'NEUTRAL', data: positions };
  } catch (error) {
    return {
      text: `❌ Positions error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /kmarkets command
 */
async function handleKalshiMarkets(query?: string): Promise<SkillResponse> {
  try {
    const markets = await getKalshiMarkets(15);

    let filtered = markets;
    if (query) {
      const q = query.toLowerCase();
      filtered = markets.filter(m =>
        m.title.toLowerCase().includes(q) ||
        m.ticker.toLowerCase().includes(q)
      );
    }

    if (filtered.length === 0) {
      return {
        text: query
          ? `No Kalshi markets found for "${query}"`
          : 'No open Kalshi markets found',
        mood: 'NEUTRAL',
      };
    }

    let text = `
🔵 *KALSHI MARKETS*${query ? ` (${query})` : ''}
${'─'.repeat(35)}

`;

    for (const m of filtered.slice(0, 10)) {
      text += `*${m.ticker}*\n`;
      text += `  ${m.title.slice(0, 45)}${m.title.length > 45 ? '...' : ''}\n`;
      text += `  YES: ${m.yes_bid}¢ / ${m.yes_ask}¢ | Vol: ${m.volume}\n\n`;
    }

    text += `\n/kbuy <ticker> yes|no <contracts> [price] - to trade`;

    return { text, mood: 'NEUTRAL', data: filtered };
  } catch (error) {
    return {
      text: `❌ Markets error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /kbuy command
 */
async function handleKalshiBuy(text: string): Promise<SkillResponse> {
  // Parse: /kbuy TICKER yes|no contracts price (price is REQUIRED - market orders deprecated Feb 2026)
  const match = text.match(/\/kbuy\s+(\S+)\s+(yes|no)\s+(\d+)\s+(\d+)/i);

  if (!match) {
    return {
      text: `
🔵 *KALSHI BUY*

Usage: /kbuy <ticker> <yes|no> <contracts> <price>

Examples:
/kbuy KXBTC-24DEC31-T1500 yes 10 65
/kbuy PRES-2024-DT yes 5 45

Price is in cents (1-99). Required for all orders.
`,
      mood: 'EDUCATIONAL',
    };
  }

  const [, ticker, side, contractsStr, priceStr] = match;
  const contracts = parseInt(contractsStr);
  const price = parseInt(priceStr);

  const client = getKalshiClient();
  if (!client) {
    return { text: '⚠️ Kalshi not configured. Use /kalshi for setup info.', mood: 'NEUTRAL' };
  }

  try {
    const order = await placeKalshiOrder(
      ticker.toUpperCase(),
      side.toLowerCase() as 'yes' | 'no',
      'buy',
      contracts,
      price
    );

    if (!order) {
      return { text: '❌ Order failed', mood: 'ERROR' };
    }

    return {
      text: `
✅ *ORDER PLACED*
${'─'.repeat(35)}

Order ID: ${order.order_id}
Market: ${order.market_ticker}
Side: ${order.side.toUpperCase()}
Contracts: ${order.count}
Type: ${order.type}
${order.yes_price ? `Price: ${order.yes_price}¢` : ''}
Status: ${order.status}

/kpositions to view positions
`,
      mood: 'BULLISH',
      data: order,
    };
  } catch (error) {
    return {
      text: `❌ Order error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /ksell command
 */
async function handleKalshiSell(text: string): Promise<SkillResponse> {
  // Parse: /ksell TICKER yes|no contracts price (price is REQUIRED - market orders deprecated Feb 2026)
  const match = text.match(/\/ksell\s+(\S+)\s+(yes|no)\s+(\d+)\s+(\d+)/i);

  if (!match) {
    return {
      text: `
🔵 *KALSHI SELL*

Usage: /ksell <ticker> <yes|no> <contracts> <price>

Examples:
/ksell KXBTC-24DEC31-T1500 yes 10 75
/ksell PRES-2024-DT no 5 55

Price is in cents (1-99). Required for all orders.
`,
      mood: 'EDUCATIONAL',
    };
  }

  const [, ticker, side, contractsStr, priceStr] = match;
  const contracts = parseInt(contractsStr);
  const price = parseInt(priceStr);

  const client = getKalshiClient();
  if (!client) {
    return { text: '⚠️ Kalshi not configured. Use /kalshi for setup info.', mood: 'NEUTRAL' };
  }

  try {
    const order = await placeKalshiOrder(
      ticker.toUpperCase(),
      side.toLowerCase() as 'yes' | 'no',
      'sell',
      contracts,
      price
    );

    if (!order) {
      return { text: '❌ Order failed', mood: 'ERROR' };
    }

    return {
      text: `
✅ *SELL ORDER PLACED*
${'─'.repeat(35)}

Order ID: ${order.order_id}
Market: ${order.market_ticker}
Side: ${order.side.toUpperCase()}
Contracts: ${order.count}
Type: ${order.type}
${order.yes_price ? `Price: ${order.yes_price}¢` : ''}
Status: ${order.status}

/kpositions to view positions
`,
      mood: 'NEUTRAL',
      data: order,
    };
  } catch (error) {
    return {
      text: `❌ Order error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /korders command - View open and recent orders
 */
async function handleKalshiOrders(status?: string): Promise<SkillResponse> {
  const client = getKalshiClient();
  if (!client) {
    return { text: '⚠️ Kalshi not configured. Use /kalshi for setup info.', mood: 'NEUTRAL' };
  }

  try {
    const orderStatus = status === 'executed' ? 'executed' : status === 'canceled' ? 'canceled' : 'resting';
    const orders = await getKalshiOrders(orderStatus as 'resting' | 'executed' | 'canceled');

    if (orders.length === 0) {
      return {
        text: `📋 No ${orderStatus} orders on Kalshi.\n\nUse /kbuy or /ksell to place orders.`,
        mood: 'NEUTRAL'
      };
    }

    let text = `
📋 *KALSHI ORDERS* (${orderStatus.toUpperCase()})
${'─'.repeat(35)}

`;

    for (const order of orders.slice(0, 10)) {
      const cost = calculateKalshiCost(order.side, order.count, order.yes_price || 50);
      text += `*${order.order_id.slice(0, 8)}...*\n`;
      text += `  ${order.market_ticker}\n`;
      text += `  ${order.action.toUpperCase()} ${order.count}x ${order.side.toUpperCase()} @ ${order.yes_price}¢\n`;
      text += `  Cost: ${formatKalshiPrice(cost)} | Status: ${order.status}\n\n`;
    }

    text += `\n/kcancel <order_id> - Cancel order\n/korders executed - View filled orders`;

    return { text, mood: 'NEUTRAL', data: orders };
  } catch (error) {
    return {
      text: `❌ Orders error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /kfills command - View trade history
 */
async function handleKalshiFillsCmd(): Promise<SkillResponse> {
  const client = getKalshiClient();
  if (!client) {
    return { text: '⚠️ Kalshi not configured. Use /kalshi for setup info.', mood: 'NEUTRAL' };
  }

  try {
    const fills = await getKalshiFills(20);

    if (fills.length === 0) {
      return {
        text: `📜 No trade history on Kalshi yet.\n\nPlace your first trade with /kbuy or /ksell.`,
        mood: 'NEUTRAL'
      };
    }

    let text = `
📜 *KALSHI TRADE HISTORY* (Recent ${fills.length})
${'─'.repeat(35)}

`;

    let totalVolume = 0;
    for (const fill of fills.slice(0, 15)) {
      const cost = fill.count * fill.yes_price;
      totalVolume += cost;
      const time = new Date(fill.created_time).toLocaleDateString();
      text += `*${time}* - ${fill.market_ticker.slice(0, 15)}...\n`;
      text += `  ${fill.action.toUpperCase()} ${fill.count}x ${fill.side.toUpperCase()} @ ${fill.yes_price}¢\n`;
      text += `  ${fill.is_taker ? 'Taker' : 'Maker'}${fill.fee ? ` | Fee: ${fill.fee}¢` : ''}\n\n`;
    }

    text += `${'─'.repeat(35)}\nTotal Volume: ${formatKalshiPrice(totalVolume)}`;

    return { text, mood: 'NEUTRAL', data: fills };
  } catch (error) {
    return {
      text: `❌ Trade history error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /ksettlements command - View winnings and payouts
 */
async function handleKalshiSettlementsCmd(): Promise<SkillResponse> {
  const client = getKalshiClient();
  if (!client) {
    return { text: '⚠️ Kalshi not configured. Use /kalshi for setup info.', mood: 'NEUTRAL' };
  }

  try {
    const settlements = await getKalshiSettlements(20);

    if (settlements.length === 0) {
      return {
        text: `🏆 No settlements yet!\n\nWhen your positions settle, winnings will appear here.`,
        mood: 'NEUTRAL'
      };
    }

    let text = `
🏆 *KALSHI SETTLEMENTS & WINNINGS*
${'─'.repeat(35)}

`;

    let totalWins = 0;
    let totalLosses = 0;
    let winCount = 0;

    for (const s of settlements) {
      const won = s.settlement_value > 0;
      if (won) {
        totalWins += s.settlement_value;
        winCount++;
      } else {
        totalLosses += Math.abs(s.settlement_value);
      }

      const icon = won ? '✅' : '❌';
      const time = new Date(s.settled_time).toLocaleDateString();
      text += `${icon} *${s.market_ticker.slice(0, 20)}*\n`;
      text += `   Result: ${s.result.toUpperCase()} | Position: ${s.position}\n`;
      text += `   ${won ? 'Won' : 'Lost'}: ${formatKalshiPrice(Math.abs(s.settlement_value))} | ${time}\n\n`;
    }

    const netPnL = totalWins - totalLosses;
    const winRate = settlements.length > 0 ? (winCount / settlements.length * 100).toFixed(1) : 0;

    text += `${'─'.repeat(35)}
📊 *Summary*
   Wins: ${winCount}/${settlements.length} (${winRate}%)
   Total Won: +${formatKalshiPrice(totalWins)}
   Total Lost: -${formatKalshiPrice(totalLosses)}
   Net P&L: ${netPnL >= 0 ? '+' : ''}${formatKalshiPrice(netPnL)}`;

    return { text, mood: netPnL >= 0 ? 'BULLISH' : 'BEARISH', data: { settlements, totalWins, totalLosses, netPnL } };
  } catch (error) {
    return {
      text: `❌ Settlements error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /kcancel command - Cancel an order
 */
async function handleKalshiCancel(text: string): Promise<SkillResponse> {
  const client = getKalshiClient();
  if (!client) {
    return { text: '⚠️ Kalshi not configured. Use /kalshi for setup info.', mood: 'NEUTRAL' };
  }

  // Parse: /kcancel <order_id> or /kcancel all [ticker]
  const match = text.match(/\/kcancel\s+(\S+)(?:\s+(\S+))?/i);

  if (!match) {
    return {
      text: `
🚫 *CANCEL ORDERS*

Usage:
  /kcancel <order_id> - Cancel specific order
  /kcancel all - Cancel all resting orders
  /kcancel all <ticker> - Cancel orders for market

Examples:
  /kcancel abc123def456
  /kcancel all
  /kcancel all KXBTC-25FEB28-T100K
`,
      mood: 'EDUCATIONAL',
    };
  }

  const [, target, ticker] = match;

  try {
    if (target.toLowerCase() === 'all') {
      const count = await cancelAllKalshiOrders(ticker?.toUpperCase());
      return {
        text: `✅ Canceled ${count} order${count !== 1 ? 's' : ''}${ticker ? ` for ${ticker.toUpperCase()}` : ''}`,
        mood: 'NEUTRAL',
      };
    } else {
      const success = await cancelKalshiOrder(target);
      if (success) {
        return { text: `✅ Order ${target.slice(0, 8)}... canceled`, mood: 'NEUTRAL' };
      } else {
        return { text: `❌ Failed to cancel order ${target.slice(0, 8)}...`, mood: 'ERROR' };
      }
    }
  } catch (error) {
    return {
      text: `❌ Cancel error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /kbook command - View orderbook for a market
 */
async function handleKalshiOrderbook(text: string): Promise<SkillResponse> {
  const client = getKalshiClient();
  if (!client) {
    return { text: '⚠️ Kalshi not configured. Use /kalshi for setup info.', mood: 'NEUTRAL' };
  }

  // Parse: /kbook <ticker>
  const match = text.match(/\/kbook\s+(\S+)/i);

  if (!match) {
    return {
      text: `
📊 *ORDERBOOK*

Usage: /kbook <ticker>

Example: /kbook KXBTC-25FEB28-T100K

Shows YES and NO bid/ask depth.
`,
      mood: 'EDUCATIONAL',
    };
  }

  const [, ticker] = match;

  try {
    const orderbook = await getKalshiOrderbook(ticker.toUpperCase());

    if (!orderbook) {
      return { text: `❌ Orderbook not found for ${ticker}`, mood: 'ERROR' };
    }

    let response = `
📊 *ORDERBOOK: ${ticker.toUpperCase()}*
${'─'.repeat(35)}

*YES BIDS* (Buy YES)
`;

    // Show top 5 YES bids
    const yesBids = orderbook.orderbook.yes.slice(0, 5);
    if (yesBids.length === 0) {
      response += `  No bids\n`;
    } else {
      for (const [price, qty] of yesBids) {
        const bar = '█'.repeat(Math.min(Math.floor(qty / 10), 10));
        response += `  ${price}¢ | ${qty} contracts ${bar}\n`;
      }
    }

    response += `\n*NO BIDS* (Buy NO / Sell YES)
`;

    // Show top 5 NO bids
    const noBids = orderbook.orderbook.no.slice(0, 5);
    if (noBids.length === 0) {
      response += `  No bids\n`;
    } else {
      for (const [price, qty] of noBids) {
        const bar = '█'.repeat(Math.min(Math.floor(qty / 10), 10));
        response += `  ${price}¢ | ${qty} contracts ${bar}\n`;
      }
    }

    // Calculate spread
    const bestYesBid = yesBids[0]?.[0] || 0;
    const bestNoBid = noBids[0]?.[0] || 0;
    const yesAsk = 100 - bestNoBid;
    const spread = yesAsk - bestYesBid;

    response += `
${'─'.repeat(35)}
Best YES: ${bestYesBid}¢ bid / ${yesAsk}¢ ask
Spread: ${spread}¢ (${(spread / 100 * 100).toFixed(1)}%)
`;

    return { text: response, mood: 'NEUTRAL', data: orderbook };
  } catch (error) {
    return {
      text: `❌ Orderbook error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /kportfolio command - Full portfolio summary with analytics
 */
async function handleKalshiPortfolio(): Promise<SkillResponse> {
  const client = getKalshiClient();
  if (!client) {
    return { text: '⚠️ Kalshi not configured. Use /kalshi for setup info.', mood: 'NEUTRAL' };
  }

  try {
    const portfolio = await getKalshiPortfolioSummary();

    if (!portfolio) {
      return { text: '❌ Failed to load portfolio', mood: 'ERROR' };
    }

    const modeLabel = portfolio.isDemo ? '🧪 DEMO' : '💰 LIVE';

    let text = `
📈 *KALSHI PORTFOLIO* ${modeLabel}
${'═'.repeat(35)}

💰 *BALANCE*
   Total: $${portfolio.balance.total.toFixed(2)}
   Available: $${portfolio.balance.available.toFixed(2)}
   In Positions: $${portfolio.balance.inPositions.toFixed(2)}
   Pending Payout: $${portfolio.balance.pendingSettlement.toFixed(2)}

📊 *POSITIONS*
   Open: ${portfolio.positions.open}
   Value: $${portfolio.positions.total_value.toFixed(2)}

📋 *ORDERS*
   Resting: ${portfolio.orders.resting}
   Pending Value: $${portfolio.orders.pending_value.toFixed(2)}

📜 *HISTORY*
   Total Trades: ${portfolio.history.total_trades}
   Realized P&L: ${portfolio.history.realized_pnl >= 0 ? '+' : ''}$${portfolio.history.realized_pnl.toFixed(2)}
   Win Rate: ${(portfolio.history.win_rate * 100).toFixed(1)}%

${'═'.repeat(35)}
/kpositions - View positions
/korders - View orders
/ksettlements - View winnings
`;

    const mood = portfolio.history.realized_pnl >= 0 ? 'BULLISH' : 'BEARISH';
    return { text, mood, data: portfolio };
  } catch (error) {
    return {
      text: `❌ Portfolio error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /kamend command - Amend an existing order
 */
async function handleKalshiAmend(text: string): Promise<SkillResponse> {
  const client = getKalshiClient();
  if (!client) {
    return { text: '⚠️ Kalshi not configured. Use /kalshi for setup info.', mood: 'NEUTRAL' };
  }

  // Parse: /kamend <order_id> [count] [price]
  const match = text.match(/\/kamend\s+(\S+)(?:\s+(\d+))?(?:\s+(\d+))?/i);

  if (!match || (!match[2] && !match[3])) {
    return {
      text: `
✏️ *AMEND ORDER*

Usage: /kamend <order_id> [new_count] [new_price]

Examples:
  /kamend abc123 10 - Change count to 10
  /kamend abc123 _ 55 - Change price to 55¢
  /kamend abc123 5 60 - Change both

Note: Use _ to skip a parameter.
`,
      mood: 'EDUCATIONAL',
    };
  }

  const [, orderId, countStr, priceStr] = match;
  const newCount = countStr && countStr !== '_' ? parseInt(countStr) : undefined;
  const newPrice = priceStr && priceStr !== '_' ? parseInt(priceStr) : undefined;

  try {
    const order = await amendKalshiOrder(orderId, newCount, newPrice);

    if (!order) {
      return { text: `❌ Failed to amend order ${orderId.slice(0, 8)}...`, mood: 'ERROR' };
    }

    return {
      text: `
✅ *ORDER AMENDED*
${'─'.repeat(35)}

Order ID: ${order.order_id.slice(0, 8)}...
Market: ${order.market_ticker}
${newCount ? `New Count: ${order.count}` : ''}
${newPrice ? `New Price: ${order.yes_price}¢` : ''}
Status: ${order.status}
`,
      mood: 'NEUTRAL',
      data: order,
    };
  } catch (error) {
    return {
      text: `❌ Amend error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /calibration command
 */
async function handleCalibration(): Promise<SkillResponse> {
  return await calibration();
}

/**
 * Handle /intelligence command - Prediction analysis to "be right mostly"
 */
async function handleIntelligence(question: string): Promise<SkillResponse> {
  try {
    const result = await analyzeIntelligence(question);
    return result;
  } catch (error) {
    console.error('Intelligence analysis error:', error);
    return {
      text: `❌ Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /feedback command - Personalized calibration feedback
 */
async function handleFeedback(telegramId?: string): Promise<SkillResponse> {
  if (!telegramId) {
    return {
      text: '❌ Could not identify your account. Please try again.',
      mood: 'ERROR',
    };
  }

  try {
    // Get user from Supabase
    const user = await db.users.getByTelegramId(parseInt(telegramId));

    if (!user) {
      return {
        text: `
📊 *CALIBRATION FEEDBACK*

You don't have an account yet! Make some predictions first:

/predict <question> <probability> YES|NO

Once you have 5+ resolved predictions, you'll get personalized feedback on:
• Your calibration accuracy
• Overconfidence/underconfidence patterns
• Performance trends
• Areas of strength and weakness
• Actionable recommendations
`,
        mood: 'EDUCATIONAL',
      };
    }

    const result = await feedbackSkill(user.id);
    return result;
  } catch (error) {
    console.error('Feedback error:', error);
    return {
      text: `❌ Feedback failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /recommend command - Personalized market recommendations
 */
async function handleRecommendations(telegramId?: string): Promise<SkillResponse> {
  if (!telegramId) {
    return {
      text: '❌ Could not identify your account. Please try again.',
      mood: 'ERROR',
    };
  }

  try {
    const user = await db.users.getByTelegramId(parseInt(telegramId));
    if (!user) {
      return {
        text: `
🎯 *MARKET RECOMMENDATIONS*

You need an account to get personalized recommendations.
Make some predictions first with /predict!
`,
        mood: 'EDUCATIONAL',
      };
    }

    return await recommendationsSkill(user.id);
  } catch (error) {
    console.error('Recommendations error:', error);
    return {
      text: `❌ Recommendations failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /compare command - Compare predictions vs market
 */
async function handleCompare(telegramId?: string): Promise<SkillResponse> {
  if (!telegramId) {
    return {
      text: '❌ Could not identify your account. Please try again.',
      mood: 'ERROR',
    };
  }

  try {
    const user = await db.users.getByTelegramId(parseInt(telegramId));
    if (!user) {
      return {
        text: 'You need an account to compare predictions. Make some predictions first with /predict!',
        mood: 'EDUCATIONAL',
      };
    }

    return await compareSkill(user.id);
  } catch (error) {
    console.error('Compare error:', error);
    return {
      text: `❌ Comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /learnings command - Learning insights from past predictions
 */
async function handleLearnings(telegramId?: string): Promise<SkillResponse> {
  if (!telegramId) {
    return {
      text: '❌ Could not identify your account. Please try again.',
      mood: 'ERROR',
    };
  }

  try {
    const user = await db.users.getByTelegramId(parseInt(telegramId));
    if (!user) {
      return {
        text: 'You need an account to see learning insights. Make some predictions first with /predict!',
        mood: 'EDUCATIONAL',
      };
    }

    return await learningsSkill(user.id);
  } catch (error) {
    console.error('Learnings error:', error);
    return {
      text: `❌ Learnings failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /smartpredict command - Prediction with market linking
 */
async function handleSmartPredict(args: string, telegramId?: string): Promise<SkillResponse> {
  if (!telegramId) {
    return {
      text: '❌ Could not identify your account. Please try again.',
      mood: 'ERROR',
    };
  }

  // Parse: <ticker> <probability> YES|NO [reasoning]
  const match = args.match(/^(\S+)\s+(\d+(?:\.\d+)?)\s+(YES|NO)(?:\s+(.+))?$/i);

  if (!match) {
    return {
      text: `
❌ Invalid format.

Usage: /smartpredict <ticker> <probability> YES|NO [reasoning]

Example: /smartpredict KXBTC-26DEC31 65 YES Strong ETF flows

Find market tickers with /findmarket <query>
`,
      mood: 'ERROR',
    };
  }

  const [, ticker, probStr, direction, reasoning] = match;
  const probability = parseFloat(probStr) / 100;
  const directionUpper = direction.toUpperCase() as 'YES' | 'NO';

  if (probability < 0 || probability > 1) {
    return { text: 'Probability must be between 0 and 100', mood: 'ERROR' };
  }

  try {
    const user = await db.users.getByTelegramId(parseInt(telegramId));
    if (!user) {
      return {
        text: 'You need an account to make predictions. Try /predict first!',
        mood: 'EDUCATIONAL',
      };
    }

    return await smartPredictSkill(
      `Prediction linked to ${ticker}`,
      probability,
      directionUpper,
      user.id,
      {
        reasoning,
        marketTicker: ticker.toUpperCase(),
      }
    );
  } catch (error) {
    console.error('SmartPredict error:', error);
    return {
      text: `❌ Smart predict failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      mood: 'ERROR',
    };
  }
}

/**
 * Handle /portfolio command - now uses positions.ts
 */
async function handlePortfolio(telegramId: string): Promise<SkillResponse> {
  if (!telegramId) {
    return { text: 'Could not identify your account', mood: 'ERROR' };
  }
  return await handlePortfolioCmd(telegramId);
}

/**
 * Main telegram handler
 */
export async function telegramHandler(message: TelegramMessage): Promise<SkillResponse> {
  const text = message.text?.trim() || '';
  const telegramId = message.from?.id?.toString();
  const username = message.from?.username;

  // Determine which agent will handle this
  const agent = routeMessage(text);

  // Process message and get response
  const response = await processMessage(message);

  // Log conversation (skip memory commands to avoid circular logging)
  const lower = text.toLowerCase();
  if (!lower.startsWith('/memory') && !lower.startsWith('/recall') && text) {
    logConversation(text, response.text, {
      userId: telegramId,
      skill: agent,
      mood: response.mood,
    });
  }

  // Publish event to Supabase for realtime sync with web UI
  try {
    await db.events.publish({
      event_type: 'agent_response',
      session_id: `tg-${telegramId}`,
      telegram_id: telegramId ? parseInt(telegramId) : undefined,
      telegram_username: username,
      agent: agent.toLowerCase() as 'scout' | 'analyst' | 'trader' | 'commander',
      command: text,
      response: response.text,
      mood: response.mood,
      data: response.data ? { result: response.data } : undefined,
    });
  } catch (err) {
    // Don't fail the response if event publishing fails
    console.warn('Failed to publish event:', err);
  }

  return response;
}

/**
 * Process message (internal handler logic)
 */
async function processMessage(message: TelegramMessage): Promise<SkillResponse> {
  const text = message.text?.trim() || '';

  if (!text) {
    return { text: "I didn't receive any text. Try /help for commands.", mood: 'NEUTRAL' };
  }

  const agent = routeMessage(text);
  const lower = text.toLowerCase();
  const telegramId = message.from?.id?.toString();
  const username = message.from?.username;

  const chatId = message.chat.id.toString();

  try {
    // CONTEXT-AWARE HANDLING (Priority 1)
    // Check for context-dependent queries like "give me link", "can give market link"
    // Works with both Telegram reply and cached context

    // First try Telegram reply context
    if (message.reply_to_message?.text && message.reply_to_message.from?.is_bot) {
      const contextResponse = await handleContextReply(text, message.reply_to_message.text);
      if (contextResponse) {
        return contextResponse;
      }
    }

    // Then try cached chat context (for follow-up messages without reply)
    const cachedContextResponse = await handleChatContextQuery(chatId, text);
    if (cachedContextResponse) {
      return cachedContextResponse;
    }

    // Memory commands
    if (lower.startsWith('/memory') || lower === '/recall') {
      const query = extractQuery(text, '/memory') || extractQuery(text, '/recall') || 'stats';
      return await handleMemory(query);
    }

    // Handle specific commands
    if (lower === '/start') return handleStart();
    if (lower === '/help') return handleHelp();
    if (lower === '/brief') return await handleBrief();
    if (lower === '/closing' || lower === '/expiring') return await handleClosing();

    // /hot - save context for follow-up questions
    if (lower === '/hot') {
      const response = await handleHot();
      // Save context with market data for follow-up queries
      const marketData = response.data as Array<{ title: string; platform: string; url: string }> | undefined;
      if (marketData) {
        setChatContext(chatId, response.text, marketData.map(m => ({
          title: m.title,
          platform: m.platform,
          url: m.url,
        })));
      } else {
        setChatContext(chatId, response.text);
      }
      return response;
    }

    // /alpha - save context for follow-up questions
    if (lower === '/alpha') {
      const response = await handleAlpha();
      const marketData = response.data as Array<{ title: string; platform: string; url: string }> | undefined;
      if (marketData) {
        setChatContext(chatId, response.text, marketData.map(m => ({
          title: m.title,
          platform: m.platform,
          url: m.url,
        })));
      } else {
        setChatContext(chatId, response.text);
      }
      return response;
    }
    if (lower.startsWith('/predict')) return await handlePredict(text, telegramId, username);
    if (lower === '/me') return await handleMe(telegramId);
    if (lower === '/leaderboard') return await handleLeaderboard(telegramId);
    if (lower.startsWith('/swap')) {
      // Spawn trader agent for swap execution
      const swapQuery = extractQuery(text, '/swap');
      if (!swapQuery) {
        return {
          text: `💱 *TRADER: SWAP*\n${'─'.repeat(30)}\n\nUsage: /swap <amount> <from> <to>\n\nExamples:\n/swap 1 SOL USDC\n/swap 100 USDC SOL`,
          mood: 'EDUCATIONAL',
        };
      }

      const task: AgentTask = {
        agentId: 'trader',
        task: `swap ${swapQuery}`,
        context: { userId: telegramId, username },
      };

      const result = await spawnAgent(task);
      return result.response;
    }
    if (lower === '/calibration') return await handleCalibration();
    if (lower === '/accuracy') return await handleMe(telegramId); // Alias for /me

    // Prediction intelligence - help users "be right mostly"
    if (lower.startsWith('/intelligence') || lower.startsWith('/analyze')) {
      const query = extractQuery(text, lower.startsWith('/intelligence') ? '/intelligence' : '/analyze');
      if (!query) {
        return {
          text: `
🔮 *PREDICTION INTELLIGENCE*

Get AI-powered analysis to make better predictions.

Usage: /intelligence <question>

Examples:
/intelligence Will Bitcoin reach $100K by end of 2026?
/intelligence Will the Fed cut rates in March?
/analyze Trump wins 2028 election

This provides:
• Base rate analysis from similar markets
• Market consensus & divergence
• Key factors to consider
• Cognitive bias warnings
• Recommended probability range
`,
          mood: 'EDUCATIONAL',
        };
      }
      return await handleIntelligence(query);
    }

    // Calibration feedback - personalized improvement suggestions
    if (lower === '/feedback') {
      return await handleFeedback(telegramId);
    }

    // Colosseum forum poster commands
    if (lower.startsWith('/poster') || lower.startsWith('/colosseum') || lower.startsWith('/forum')) {
      const cmd = lower.startsWith('/poster') ? '/poster' : lower.startsWith('/colosseum') ? '/colosseum' : '/forum';
      const args = extractQuery(text, cmd);
      return await handlePosterCommand(args || 'help');
    }

    // Recommendations - markets based on user strengths
    if (lower === '/recommend' || lower === '/recommendations') {
      return await handleRecommendations(telegramId);
    }

    // Compare predictions vs market consensus
    if (lower === '/compare') {
      return await handleCompare(telegramId);
    }

    // Learning insights from resolved predictions
    if (lower === '/learnings' || lower === '/learn') {
      return await handleLearnings(telegramId);
    }

    // Smart predict with market linking
    if (lower.startsWith('/smartpredict')) {
      const args = extractQuery(text, '/smartpredict');
      if (!args) {
        return {
          text: `
🎯 *SMART PREDICT*

Make predictions that auto-link to real markets for automatic resolution.

Usage: /smartpredict <ticker> <probability> YES|NO [reasoning]

Examples:
/smartpredict KXBTC-26DEC31 65 YES Strong ETF flows
/smartpredict PRES-2028-DT 40 NO Historical incumbency

Or search for markets first:
/findmarket bitcoin 100k
`,
          mood: 'EDUCATIONAL',
        };
      }
      return await handleSmartPredict(args, telegramId);
    }

    // Find markets to predict on
    if (lower.startsWith('/findmarket')) {
      const query = extractQuery(text, '/findmarket');
      if (!query) {
        return {
          text: 'Usage: /findmarket <search term>\n\nExample: /findmarket bitcoin 100k',
          mood: 'EDUCATIONAL',
        };
      }
      return await searchMarketsForPrediction(query);
    }

    // Portfolio & P&L commands
    if (lower === '/portfolio' || lower.startsWith('/portfolio ')) {
      return await handlePortfolio(telegramId || '');
    }
    if (lower === '/pnl' || lower.startsWith('/pnl ')) {
      const daysMatch = text.match(/\/pnl\s+(\d+)/);
      const days = daysMatch ? parseInt(daysMatch[1]) : undefined;
      return await handlePnl(telegramId || '', days);
    }
    if (lower === '/expiring') {
      return handleExpiring(telegramId || '');
    }

    // Price alerts
    if (lower.startsWith('/alert')) {
      return await handleAlert(text, telegramId || '');
    }

    // Budget limits & auto-trading
    if (lower.startsWith('/limits')) {
      return handleLimits(text, telegramId || '');
    }
    if (lower.startsWith('/autobet')) {
      return await handleAutobet(text, telegramId || '');
    }
    if (lower.startsWith('/stoploss')) {
      return handleStopLoss(text, telegramId || '');
    }
    if (lower.startsWith('/takeprofit')) {
      return handleTakeProfit(text, telegramId || '');
    }
    if (lower.startsWith('/dca')) {
      return await handleDCA(text, telegramId || '');
    }

    // Identity commands
    if (lower.startsWith('/connect')) return await handleConnect(text, telegramId, username);
    if (lower === '/profile') return await handleProfile(telegramId, username);

    // Notification commands
    if (lower === '/subscribe' || lower.startsWith('/subscribe ')) {
      return handleSubscribe(telegramId || '', username);
    }
    if (lower === '/unsubscribe') {
      return handleUnsubscribe(telegramId || '');
    }
    if (lower.startsWith('/alerts')) {
      const args = extractQuery(text, '/alerts');
      return handleAlerts(telegramId || '', args || undefined);
    }

    // ============================================
    // PAPER TRADING SYSTEM COMMANDS
    // ============================================
    if (lower.startsWith('/trader')) {
      return await traderSkillHandlers['/trader'](message);
    }
    if (lower.startsWith('/paper')) {
      return await traderSkillHandlers['/paper'](message);
    }
    if (lower.startsWith('/paptrade')) {
      return await traderSkillHandlers['/paptrade'](message);
    }
    if (lower.startsWith('/pappositions')) {
      return await traderSkillHandlers['/pappositions'](message);
    }
    if (lower.startsWith('/papclose')) {
      return await traderSkillHandlers['/papclose'](message);
    }
    if (lower.startsWith('/perftrader')) {
      return await traderSkillHandlers['/perftrader'](message);
    }
    if (lower.startsWith('/risktrader')) {
      return await traderSkillHandlers['/risktrader'](message);
    }
    if (lower.startsWith('/strategies')) {
      return await traderSkillHandlers['/strategies'](message);
    }

    // Copy trading commands
    if (lower.startsWith('/follow')) {
      if (!telegramId) return { text: 'Could not identify your account', mood: 'ERROR' };
      return handleFollow(text, telegramId);
    }
    if (lower.startsWith('/unfollow')) {
      if (!telegramId) return { text: 'Could not identify your account', mood: 'ERROR' };
      return handleUnfollowUser(text, telegramId);
    }
    if (lower === '/signals' || lower.startsWith('/signals ')) {
      // Use paper trading signals if from /signals with trader context, else copy trading
      const traderSignals = await traderSkillHandlers['/signals'](message);
      if (traderSignals.text.includes('No pending signals')) {
        return handleSignals(telegramId);
      }
      return traderSignals;
    }
    if (lower === '/toplists') {
      return handleTopLists();
    }

    // Signal Intelligence commands
    if (lower === '/feed' || lower.startsWith('/feed ')) {
      try {
        const filterArg = lower.replace('/feed', '').trim();
        const signals = await getRecentSignals({
          limit: 10,
          action: filterArg === 'alerts' ? 'ALERT' : undefined,
        });
        return { text: formatSignalsReport(signals), mood: signals.length > 0 ? 'BULLISH' : 'NEUTRAL' };
      } catch (err) {
        return { text: 'Signal feed temporarily unavailable. Try again.', mood: 'ERROR' };
      }
    }

    if (lower === '/watch-on' || lower.startsWith('/watch-on')) {
      if (!telegramId) return { text: 'Cannot identify your account. Send a message first.', mood: 'ERROR' };
      const tidNum = typeof telegramId === 'string' ? parseInt(telegramId) : telegramId as number;
      // Default subscription: arb, whale, volume, odds
      const defaultTypes: SignalType[] = ['arb_opportunity', 'whale_entry', 'volume_surge', 'odds_shift', 'resolution_imminent'];
      await subscribeToSignals(tidNum, defaultTypes, 0.55);
      return {
        text: formatSubscribeConfirmation(defaultTypes, 0.55),
        mood: 'BULLISH',
      };
    }

    if (lower === '/watch-off') {
      if (!telegramId) return { text: 'Cannot identify your account.', mood: 'ERROR' };
      const tidNum = typeof telegramId === 'string' ? parseInt(telegramId) : telegramId as number;
      await unsubscribeFromSignals(tidNum);
      return {
        text: `*Signal alerts disabled.*\n\nYou won't receive proactive alerts.\nUse /watch-on to re-enable.\nUse /feed to check signals anytime.`,
        mood: 'NEUTRAL',
      };
    }

    if (lower === '/watch-status') {
      if (!telegramId) return { text: 'Cannot identify your account.', mood: 'ERROR' };
      const tidNum = typeof telegramId === 'string' ? parseInt(telegramId) : telegramId as number;
      const status = await getSubscriptionStatus(tidNum);
      if (!status || !status.isSubscribed) {
        return { text: `*Not subscribed to signal alerts.*\n\nUse /watch-on to get proactive alerts.`, mood: 'NEUTRAL' };
      }
      return {
        text: `*Signal alerts: ACTIVE*\n\nTypes: ${status.signalTypes.join(', ')}\nMin strength: ${Math.round(status.minStrength * 100)}%\n\nUse /watch-off to disable.`,
        mood: 'BULLISH',
      };
    }

    // ─── Vault v0: Signal Channel Commands + On-chain Vault ───────────────────
    const vaultCommands = [
      '/create-channel', '/channel', '/signal',
      '/channels', '/subscribe-channel', '/unsubscribe-channel', '/my-channels',
      '/my-vault',
    ];
    const matchedVaultCmd = vaultCommands.find(cmd => lower === cmd || lower.startsWith(cmd + ' '));
    if (matchedVaultCmd) {
      if (!telegramId) {
        return { text: 'Cannot identify your account.', mood: 'ERROR' as const };
      }
      const cmdArgs = text.slice(matchedVaultCmd.length).trim().split(/\s+/).filter(Boolean);

      // Capture vault output for single-response model used by telegramHandler
      const messages: string[] = [];
      const captureSend = async (_chatId: number, msgText: string) => {
        messages.push(msgText);
      };

      const tidNum = typeof telegramId === 'string' ? parseInt(telegramId) : telegramId as number;
      await handleVaultCommand(
        matchedVaultCmd as Parameters<typeof handleVaultCommand>[0],
        cmdArgs,
        tidNum,
        username || `User_${telegramId}`,
        captureSend
      );

      if (messages.length > 0) {
        return { text: messages[0], mood: 'NEUTRAL' as const };
      }
    }

    // Route to specific agents
    switch (agent) {
      case 'RESEARCH': {
        // Spawn analyst agent for deep research
        if (lower.startsWith('/odds')) {
          const query = extractQuery(text, '/odds');
          if (!query) return { text: 'Usage: /odds <topic>', mood: 'NEUTRAL' };

          const task: AgentTask = {
            agentId: 'analyst',
            task: `compare odds across platforms for: ${query}`,
            context: { userId: telegramId, username },
          };

          const result = await spawnAgent(task);
          return result.response;
        }

        const query = extractQuery(text, '/research');
        if (!query) return { text: 'Usage: /research <market or topic>', mood: 'NEUTRAL' };

        const task: AgentTask = {
          agentId: 'analyst',
          task: `deep superforecaster research on: ${query}`,
          context: { userId: telegramId, username },
        };

        const result = await spawnAgent(task);
        return result.response;
      }

      case 'ARBITRAGE': {
        // Handle arb-monitor commands (24/7 early detection system)
        if (lower.startsWith('/arb-monitor')) {
          return await handleArbMonitorCommand(text, telegramId || '');
        }

        // Handle arb-subscribe
        if (lower === '/arb-subscribe') {
          return subscribeToArb(telegramId || '');
        }

        // Handle arb-unsubscribe
        if (lower === '/arb-unsubscribe') {
          return unsubscribeFromArb(telegramId || '');
        }

        // Quick scan for /arb command - use the real-time monitor
        const query = extractQuery(text, '/arb') || '';

        // If no query, run quick scan from monitor (faster, uses registry)
        if (!query) {
          return await runQuickScan();
        }

        // For topic-specific searches, use the scout agent
        const task: AgentTask = {
          agentId: 'scout',
          task: `scan for arbitrage opportunities ${query}`.trim(),
          context: { userId: telegramId, username },
          priority: 'high',
        };

        const result = await spawnAgent(task);
        return result.response;
      }

      case 'PROACTIVE_AGENT': {
        // Handle /agent commands for 24/7 AI agent subscription
        return await handleAgentCommand(text, telegramId || '', username);
      }

      case 'SUBSCRIBE_ALL': {
        // Subscribe to ALL notification types at once
        const results: string[] = [];

        // 1. Subscribe to proactive agent (closing soon, big movers, hot alpha, etc.)
        const agentResult = subscribeToAgent(telegramId || '', username);
        results.push('✅ *24/7 AI Agent* - Closing soon, big movers, hot alpha, spreads, new markets, whale signals');

        // 2. Subscribe to arb monitor
        subscribeToArb(telegramId || '');
        results.push('✅ *Arbitrage Alerts* - Instant cross-platform opportunities');

        // 3. Subscribe to general notifications (briefs, whale, etc.)
        handleSubscribe(telegramId || '', username);
        results.push('✅ *Daily Briefs* - Morning market summaries');
        results.push('✅ *Whale Alerts* - Large wallet movements');

        return {
          text: `
🔔 *SUBSCRIBED TO ALL ALERTS*
${'─'.repeat(30)}

${results.join('\n')}

You're now receiving ALL BeRight notifications!

*MANAGE SUBSCRIPTIONS:*
/agent settings - Customize AI agent alerts
/unsubscribe - Stop daily briefs
/arb-unsubscribe - Stop arb alerts
/agent off - Pause AI agent
`,
          mood: 'BULLISH' as const,
        };
      }

      case 'WHALE': {
        if (lower.startsWith('/track_whale')) {
          const address = extractQuery(text, '/track_whale');
          if (!address) return { text: 'Usage: /track_whale <address>', mood: 'NEUTRAL' };
          addWhale(address, 'User-tracked');
          return { text: `Added whale to tracking: ${address.slice(0, 20)}...\nUse /whale to scan activity.`, mood: 'NEUTRAL' };
        }

        // Spawn trader agent for whale watching
        const task: AgentTask = {
          agentId: 'trader',
          task: 'scan whale activity and smart money movements',
          context: { userId: telegramId, username },
        };

        const result = await spawnAgent(task);
        return result.response;
      }

      case 'INTEL': {
        if (lower.startsWith('/news')) {
          const query = extractQuery(text, '/news');
          if (!query) return { text: 'Usage: /news <topic>', mood: 'NEUTRAL' };

          // Spawn scout agent for news scanning
          const task: AgentTask = {
            agentId: 'scout',
            task: `scan news for: ${query}`,
            context: { userId: telegramId, username },
          };

          const result = await spawnAgent(task);
          return result.response;
        }
        if (lower.startsWith('/social')) {
          const query = extractQuery(text, '/social');
          if (!query) return { text: 'Usage: /social <topic>', mood: 'NEUTRAL' };
          return await socialSearch(query);
        }
        if (lower.startsWith('/intel')) {
          const query = extractQuery(text, '/intel');
          if (!query) return { text: 'Usage: /intel <topic>', mood: 'NEUTRAL' };
          console.log(`[TelegramHandler] /intel called with query: "${query}"`);
          try {
            const result = await intelReport(query);
            console.log(`[TelegramHandler] /intel result received, text length: ${result.text?.length || 0}`);
            return result;
          } catch (err) {
            console.error('[TelegramHandler] /intel error:', err);
            return {
              text: `Intel report failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
              mood: 'ERROR',
            };
          }
        }
        break;
      }

      case 'EXECUTOR': {
        // ============================================
        // DFLOW TRADING COMMANDS (Primary)
        // ============================================

        // /wallet - Create or view your DFlow trading wallet
        if (lower === '/wallet' || lower === '/mywallet') {
          if (!telegramId) return { text: 'Could not identify your account.', mood: 'ERROR' };
          return await handleDFlowWallet(telegramId);
        }

        // /dflow <query> - Search DFlow markets
        if (lower.startsWith('/dflow')) {
          const query = extractQuery(text, '/dflow');
          return await handleDFlowSearch(query);
        }

        // /trade <ticker> <YES|NO> <amount> - Place a DFlow trade
        if (lower.startsWith('/trade')) {
          if (!telegramId) return { text: 'Could not identify your account.', mood: 'ERROR' };
          const args = extractQuery(text, '/trade');
          const match = args.match(/^(\S+)\s+(YES|NO)\s+(\d+(?:\.\d+)?)/i);
          if (!match) {
            return {
              text: `
🎯 *DFLOW TRADE*
${'─'.repeat(35)}

Usage: /trade <ticker> <YES|NO> <amount_usdc>

Examples:
/trade KXFEDCHAIRNOM YES 10
/trade KXBTC-26DEC31-T150000 NO 5

Find tickers with /dflow <query>
`,
              mood: 'EDUCATIONAL',
            };
          }
          const [, ticker, side, amountStr] = match;
          return await handleDFlowTrade(telegramId, ticker.toUpperCase(), side.toUpperCase() as 'YES' | 'NO', parseFloat(amountStr));
        }

        // /positions - View your DFlow positions
        if (lower === '/positions' || lower === '/mypositions') {
          if (!telegramId) return { text: 'Could not identify your account.', mood: 'ERROR' };
          return await handleDFlowPositions(telegramId);
        }

        // ============================================
        // LEGACY TRADING COMMANDS
        // ============================================

        // /buy - Legacy trader agent
        if (lower.startsWith('/buy')) {
          const buyQuery = extractQuery(text, '/buy');
          if (!buyQuery) {
            return {
              text: `💱 *TRADER: BUY*\n${'─'.repeat(30)}\n\nUsage: /buy <ticker> <YES|NO> <amount>\n\nExample:\n/buy KXBTC-24DEC31 YES 10`,
              mood: 'EDUCATIONAL',
            };
          }

          const task: AgentTask = {
            agentId: 'trader',
            task: `buy trade ${buyQuery}`,
            context: { userId: telegramId, username },
          };

          const result = await spawnAgent(task);
          return result.response;
        }
        if (lower.startsWith('/scan')) return await handleScan();
        if (lower.startsWith('/volume')) return await handleVolume();
        if (lower.startsWith('/lp')) return await handleLP();

        // /balance <address> - Check any wallet balance
        if (lower.startsWith('/balance')) {
          const address = extractQuery(text, '/balance');
          if (!address) {
            return {
              text: `💳 *WALLET CHECK*\n\nUsage: /balance <solana_address>\n\nExample:\n/balance 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU`,
              mood: 'EDUCATIONAL',
            };
          }
          try {
            const { PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
            const pubkey = new PublicKey(address);
            const balance = await withFailover(async (conn) => conn.getBalance(pubkey));
            const solBalance = balance / LAMPORTS_PER_SOL;
            const solPrice = await getSolPrice();
            const usdValue = solBalance * solPrice;
            return {
              text: `
💳 *WALLET BALANCE*
${'─'.repeat(35)}

Address: \`${address.slice(0, 8)}...${address.slice(-6)}\`

💰 SOL: ${solBalance.toFixed(4)}
💵 USD: $${usdValue.toFixed(2)} (@ $${solPrice.toFixed(2)}/SOL)

/whale to check whale activity
`,
              mood: 'NEUTRAL',
            };
          } catch (err) {
            return { text: `❌ Wallet check failed: ${err instanceof Error ? err.message : 'Invalid address'}`, mood: 'ERROR' };
          }
        }
        if (lower.startsWith('/execute')) {
          return { text: '⚠️ Trade execution requires wallet setup. Contact @shivamSspirit to enable.', mood: 'NEUTRAL' };
        }
        break;
      }

      case 'KALSHI': {
        // Overview and balance
        if (lower === '/kalshi') return await handleKalshiOverview();
        if (lower === '/kbalance') return await handleKalshiBalance();
        if (lower === '/kportfolio') return await handleKalshiPortfolio();

        // Positions and orders
        if (lower === '/kpositions') return await handleKalshiPositions();
        if (lower.startsWith('/korders')) {
          const status = extractQuery(text, '/korders');
          return await handleKalshiOrders(status || undefined);
        }
        if (lower === '/kfills') return await handleKalshiFillsCmd();
        if (lower === '/ksettlements' || lower === '/kwinnings') return await handleKalshiSettlementsCmd();

        // Markets and orderbook
        if (lower.startsWith('/kmarkets')) {
          const query = extractQuery(text, '/kmarkets');
          return await handleKalshiMarkets(query || undefined);
        }
        if (lower.startsWith('/kbook')) return await handleKalshiOrderbook(text);

        // Trading commands
        if (lower.startsWith('/kbuy')) return await handleKalshiBuy(text);
        if (lower.startsWith('/ksell')) return await handleKalshiSell(text);
        if (lower.startsWith('/kcancel')) return await handleKalshiCancel(text);
        if (lower.startsWith('/kamend')) return await handleKalshiAmend(text);
        break;
      }

      default: {
        // Quick checks before LLM (save tokens)
        if (isObviousGreeting(text)) {
          return {
            text: `Hey! I'm BeRight, your prediction market intelligence agent.

What would you like to explore?
• /hot - Trending markets
• /arb - Arbitrage opportunities
• /brief - Morning briefing

Or just ask me anything about prediction markets!`,
            mood: 'NEUTRAL',
          };
        }

        // Use LLM to understand natural language (Groq - fast & free)
        const smartIntent = await classifyIntentSmart(text);
        console.log(`[SmartIntent] "${text.slice(0, 40)}..." → ${smartIntent.intent} (${Math.round(smartIntent.confidence * 100)}%) - ${smartIntent.reasoning}`);

        // Route based on LLM-detected intent
        switch (smartIntent.intent) {
          case 'PLATFORM_INFO': {
            return {
              text: `**Prediction Market Platforms I Track:**

**Crypto-Native:**
• **Polymarket** — Largest crypto prediction market. USDC on Polygon.
• **Limitless** — Newer platform with unique markets.

**Regulated (US):**
• **Kalshi** — CFTC-regulated exchange. Event contracts.

**Play Money / Research:**
• **Manifold** — Play money markets. Wisdom of crowds.
• **Metaculus** — Scientific forecasting. Expert calibration.

I aggregate odds across all of these to find arbitrage and consensus.

Try /hot for trending markets or /arb for price gaps.`,
              mood: 'EDUCATIONAL',
            };
          }

          case 'MARKET_ANALYSIS': {
            // User wants analysis - use research with Groq synthesis
            const topic = smartIntent.topic || text;
            const researchResult = await research(topic);
            return researchResult;
          }

          case 'PRICE_CHECK': {
            // User wants current odds
            const topic = smartIntent.topic || text;
            const markets = await searchMarkets(topic);
            if (markets.length > 0) {
              return { text: formatMarkets(markets, `Odds: ${topic}`), mood: 'NEUTRAL', data: markets };
            }
            return { text: `No markets found for "${topic}". Try /hot to see what's trending.`, mood: 'NEUTRAL' };
          }

          case 'ARBITRAGE': {
            const arbResult = await arbitrage(smartIntent.topic || 'top');
            return arbResult;
          }

          case 'TRENDING':
          case 'BROWSE_MARKETS': {
            // User wants to see available markets or what's trending
            const hotMarkets = await getHotMarkets();
            if (hotMarkets.length > 0) {
              return { text: formatMarkets(hotMarkets, '🔥 Trending Markets'), mood: 'BULLISH', data: hotMarkets };
            }
            return {
              text: `Here's how to explore markets:

• /hot - See trending markets with high volume
• /arb - Find arbitrage opportunities across platforms
• /research <topic> - Deep analysis on any topic (bitcoin, elections, etc.)

Or ask me about a specific topic like "bitcoin", "trump", or "fed rates"!`,
              mood: 'NEUTRAL'
            };
          }

          case 'WHALE_ACTIVITY': {
            const whaleResult = await whaleWatch();
            return whaleResult;
          }

          case 'HELP': {
            return { text: HELP_TEXT, mood: 'NEUTRAL' };
          }

          case 'GREETING': {
            return {
              text: `Hey! I'm BeRight, your prediction market intelligence agent.

What would you like to explore?
• /hot - Trending markets
• /arb - Arbitrage opportunities
• /brief - Morning briefing

Or just ask me anything about prediction markets!`,
              mood: 'NEUTRAL',
            };
          }

          case 'GENERAL_CHAT': {
            return {
              text: `I'm specialized for prediction markets — not general chat.

But I'm happy to discuss:
• Market odds and analysis
• Forecasting methodology
• Platform comparisons
• Trading strategies

What would you like to explore?`,
              mood: 'NEUTRAL',
            };
          }

          case 'PREDICTION': {
            // User wants to make a prediction
            return {
              text: `To make a prediction:
/predict <question> <probability> YES|NO

Example: /predict "Will Bitcoin hit 100k by March?" 65 YES

Your predictions are tracked for calibration scoring.`,
              mood: 'NEUTRAL',
            };
          }

          case 'UNKNOWN':
          default: {
            // LLM couldn't determine intent
            // ONLY search if LLM extracted a SPECIFIC topic (not the raw text)
            if (smartIntent.topic && smartIntent.topic.length > 2) {
              const markets = await searchMarkets(smartIntent.topic);
              if (markets.length > 0) {
                return { text: formatMarkets(markets, `Markets: ${smartIntent.topic}`), mood: 'NEUTRAL', data: markets };
              }
            }

            // No topic or no results - show helpful guidance
            return {
              text: `I'm BeRight, your prediction market intelligence agent.

I didn't quite catch that. Try:
• /hot - See what's trending
• /arb - Find arbitrage opportunities
• /research bitcoin - Analyze a specific topic
• "What are the odds on X?" - Check prices

Or ask about something specific like bitcoin, trump, or fed rates!`,
              mood: 'NEUTRAL',
            };
          }
        }
      }
    }

    return { text: HELP_TEXT, mood: 'NEUTRAL' };
  } catch (error) {
    console.error('Handler error:', error);
    return {
      text: `Something went wrong. Please try again.\n\nError: ${error instanceof Error ? error.message : 'Unknown'}`,
      mood: 'ERROR',
    };
  }
}

// ============================================
// INITIALIZE ARB MONITOR TELEGRAM SENDER
// ============================================

// Import the notification delivery service for sending alerts
import { sendTelegramMessage } from '../services/notificationDelivery';

// Set up the telegram sender for arb monitor alerts
setTelegramSender(async (chatId: string, message: string) => {
  const result = await sendTelegramMessage(chatId, message, { parseMode: 'Markdown' });
  if (!result.success) {
    console.error(`[ArbMonitor] Failed to send alert to ${chatId}:`, result.error);
    throw new Error(result.error || 'Failed to send telegram message');
  }
});

console.log('[TelegramHandler] Arbitrage monitor telegram sender initialized');

// Export for OpenClaw
export default telegramHandler;
