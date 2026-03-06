/**
 * Routes Configuration
 *
 * Central configuration for all command routes.
 * Replaces 100+ if/else statements in telegramHandler.ts.
 *
 * To add a new command:
 * 1. Add route definition here
 * 2. Create handler in lib/orchestrator/handlers/[handler].ts
 * 3. Add formatter methods if needed
 *
 * @see docs/ADR-001-GATEWAY-SKILL-SEPARATION.md
 */

import { Route, ParameterizedPattern } from './types';

// =============================================================================
// ROUTE DEFINITIONS
// =============================================================================

/**
 * All application routes
 *
 * Routes are matched in order:
 * 1. Exact pattern match (fastest)
 * 2. Alias match
 * 3. Semantic understanding (LLM fallback)
 */
export const ROUTES: Route[] = [
  // ===========================================================================
  // DISCOVERY
  // ===========================================================================
  {
    id: 'hot-markets',
    handler: 'hotMarkets',
    patterns: ['/hot', '/trending', '/top'],
    aliases: ['hot markets', 'trending', 'what is hot', 'show me hot markets'],
    goals: ['DISCOVER_OPPORTUNITIES'],
    domains: ['PREDICTION_MARKETS'],
    requiresAuth: false,
    requiresWallet: false,
    tier: 'free',
    description: 'Show top trending prediction markets',
    examples: ['/hot', '/trending'],
    categories: ['discovery', 'markets'],
    showTyping: true,
  },

  {
    id: 'brief',
    handler: 'brief',
    patterns: ['/brief', '/morning', '/daily'],
    aliases: ['morning brief', 'daily brief', 'what is happening', 'market update'],
    goals: ['DISCOVER_OPPORTUNITIES', 'GET_ANALYSIS'],
    domains: ['PREDICTION_MARKETS'],
    requiresAuth: false,
    requiresWallet: false,
    tier: 'free',
    description: 'Get your personalized morning market brief',
    examples: ['/brief', '/morning'],
    categories: ['discovery', 'intelligence'],
    showTyping: true,
    expectedDurationMs: 5000,
  },

  {
    id: 'research',
    handler: 'research',
    patterns: ['/research', '/study', '/analyze'],
    aliases: ['research', 'analyze', 'tell me about', 'what about'],
    goals: ['GET_ANALYSIS', 'UNDERSTAND_MARKET'],
    domains: ['PREDICTION_MARKETS', 'GENERAL'],
    requiresAuth: false,
    requiresWallet: false,
    tier: 'free',
    description: 'Deep research on any topic',
    examples: ['/research bitcoin halving', '/research fed rates'],
    categories: ['research', 'intelligence'],
    showTyping: true,
    expectedDurationMs: 10000,
    recordEpisode: true,
  },

  {
    id: 'alpha',
    handler: 'alpha',
    patterns: ['/alpha', '/edge', '/opportunities'],
    aliases: ['find alpha', 'trading opportunities', 'find edge'],
    goals: ['DISCOVER_OPPORTUNITIES'],
    domains: ['PREDICTION_MARKETS'],
    requiresAuth: false,
    requiresWallet: false,
    tier: 'free',
    description: 'Find actionable trading opportunities',
    examples: ['/alpha', '/edge'],
    categories: ['discovery', 'trading'],
    showTyping: true,
  },

  {
    id: 'dflow-search',
    handler: 'dflowSearch',
    patterns: ['/dflow'],
    aliases: ['search dflow', 'dflow markets'],
    goals: ['DISCOVER_OPPORTUNITIES'],
    domains: ['PREDICTION_MARKETS'],
    requiresAuth: false,
    requiresWallet: false,
    tier: 'free',
    description: 'Search DFlow prediction markets',
    examples: ['/dflow bitcoin', '/dflow fed rates'],
    categories: ['discovery', 'dflow'],
    showTyping: true,
  },

  // ===========================================================================
  // TRADING
  // ===========================================================================
  {
    id: 'trade',
    handler: 'trade',
    patterns: ['/trade', '/buy', '/sell'],
    aliases: ['buy', 'sell', 'place trade', 'execute trade'],
    goals: ['EXECUTE_TRADE'],
    domains: ['PREDICTION_MARKETS'],
    requiresAuth: true,
    requiresWallet: true,
    tier: 'free',
    rateLimit: { requests: 10, window: 60000 },
    description: 'Execute a trade on DFlow',
    examples: ['/trade BTCUSDT YES 50', '/buy FEDRATE NO 25'],
    categories: ['trading'],
    showTyping: true,
    expectedDurationMs: 5000,
    recordEpisode: true,
  },

  {
    id: 'quote',
    handler: 'quote',
    patterns: ['/quote', '/price'],
    aliases: ['get quote', 'check price', 'how much for'],
    goals: ['GET_PRICE'],
    domains: ['PREDICTION_MARKETS'],
    requiresAuth: false,
    requiresWallet: false,
    tier: 'free',
    description: 'Get a quote for a potential trade',
    examples: ['/quote BTCUSDT YES 50'],
    categories: ['trading'],
    showTyping: true,
  },

  {
    id: 'swap',
    handler: 'swap',
    patterns: ['/swap'],
    aliases: ['swap tokens', 'jupiter swap', 'exchange tokens'],
    goals: ['EXECUTE_TRADE'],
    domains: ['CRYPTO'],
    requiresAuth: true,
    requiresWallet: true,
    tier: 'free',
    description: 'Swap tokens via Jupiter aggregator',
    examples: ['/swap SOL USDC 1', '/swap USDC BONK 100 --execute'],
    categories: ['trading', 'swap'],
    showTyping: true,
    expectedDurationMs: 5000,
    recordEpisode: true,
  },

  // ===========================================================================
  // PORTFOLIO
  // ===========================================================================
  {
    id: 'positions',
    handler: 'positions',
    patterns: ['/positions', '/portfolio', '/pos'],
    aliases: ['my positions', 'show portfolio', 'what do I hold'],
    goals: ['CHECK_POSITIONS'],
    domains: ['PORTFOLIO'],
    requiresAuth: true,
    requiresWallet: true,
    tier: 'free',
    description: 'View your open positions',
    examples: ['/positions', '/portfolio'],
    categories: ['portfolio'],
    showTyping: true,
  },

  {
    id: 'wallet',
    handler: 'wallet',
    patterns: ['/wallet', '/balance', '/bal'],
    aliases: ['my wallet', 'check balance', 'wallet balance'],
    goals: ['MANAGE_WALLET'],
    domains: ['PORTFOLIO'],
    requiresAuth: true,
    requiresWallet: false, // Creates wallet if needed
    tier: 'free',
    description: 'View or create your wallet',
    examples: ['/wallet', '/balance'],
    categories: ['wallet', 'portfolio'],
    showTyping: false,
  },

  // ===========================================================================
  // KALSHI TRADING
  // ===========================================================================
  {
    id: 'kalshi-overview',
    handler: 'kalshiOverview',
    patterns: ['/kalshi'],
    aliases: ['kalshi', 'kalshi markets', 'kalshi trading'],
    goals: ['DISCOVER_OPPORTUNITIES'],
    domains: ['PREDICTION_MARKETS'],
    requiresAuth: false,
    requiresWallet: false,
    tier: 'free',
    description: 'Kalshi prediction market overview',
    examples: ['/kalshi'],
    categories: ['kalshi', 'trading'],
    showTyping: true,
  },

  {
    id: 'kalshi-markets',
    handler: 'kalshiMarkets',
    patterns: ['/kalshi markets', '/kalshi search'],
    aliases: ['search kalshi', 'find kalshi markets'],
    goals: ['DISCOVER_OPPORTUNITIES'],
    domains: ['PREDICTION_MARKETS'],
    requiresAuth: false,
    requiresWallet: false,
    tier: 'free',
    description: 'Search Kalshi markets',
    examples: ['/kalshi markets bitcoin', '/kalshi search fed'],
    categories: ['kalshi', 'discovery'],
    showTyping: true,
  },

  {
    id: 'kalshi-buy',
    handler: 'kalshiBuy',
    patterns: ['/kalshi buy'],
    aliases: ['buy on kalshi', 'kalshi purchase'],
    goals: ['EXECUTE_TRADE'],
    domains: ['PREDICTION_MARKETS'],
    requiresAuth: true,
    requiresWallet: false,
    tier: 'free',
    rateLimit: { requests: 10, window: 60000 },
    description: 'Buy contracts on Kalshi',
    examples: ['/kalshi buy INXD-26MAR28-B5100 yes 5 65'],
    categories: ['kalshi', 'trading'],
    showTyping: true,
    expectedDurationMs: 5000,
    recordEpisode: true,
  },

  {
    id: 'kalshi-sell',
    handler: 'kalshiSell',
    patterns: ['/kalshi sell'],
    aliases: ['sell on kalshi', 'kalshi exit'],
    goals: ['EXECUTE_TRADE'],
    domains: ['PREDICTION_MARKETS'],
    requiresAuth: true,
    requiresWallet: false,
    tier: 'free',
    rateLimit: { requests: 10, window: 60000 },
    description: 'Sell positions on Kalshi',
    examples: ['/kalshi sell INXD-26MAR28-B5100 5 70'],
    categories: ['kalshi', 'trading'],
    showTyping: true,
    expectedDurationMs: 5000,
    recordEpisode: true,
  },

  {
    id: 'kalshi-positions',
    handler: 'kalshiPositions',
    patterns: ['/kalshi positions', '/kalshi pos'],
    aliases: ['my kalshi positions', 'kalshi holdings'],
    goals: ['CHECK_POSITIONS'],
    domains: ['PORTFOLIO'],
    requiresAuth: true,
    requiresWallet: false,
    tier: 'free',
    description: 'View your Kalshi positions',
    examples: ['/kalshi positions'],
    categories: ['kalshi', 'portfolio'],
    showTyping: true,
  },

  {
    id: 'kalshi-balance',
    handler: 'kalshiBalance',
    patterns: ['/kalshi balance', '/kalshi bal'],
    aliases: ['my kalshi balance', 'kalshi portfolio'],
    goals: ['MANAGE_WALLET'],
    domains: ['PORTFOLIO'],
    requiresAuth: true,
    requiresWallet: false,
    tier: 'free',
    description: 'View your Kalshi balance',
    examples: ['/kalshi balance'],
    categories: ['kalshi', 'portfolio'],
    showTyping: true,
  },

  {
    id: 'kalshi-orders',
    handler: 'kalshiOrders',
    patterns: ['/kalshi orders'],
    aliases: ['my kalshi orders', 'kalshi open orders'],
    goals: ['CHECK_POSITIONS'],
    domains: ['PORTFOLIO'],
    requiresAuth: true,
    requiresWallet: false,
    tier: 'free',
    description: 'View your Kalshi orders',
    examples: ['/kalshi orders', '/kalshi orders resting'],
    categories: ['kalshi', 'trading'],
    showTyping: true,
  },

  {
    id: 'kalshi-cancel',
    handler: 'kalshiCancel',
    patterns: ['/kalshi cancel'],
    aliases: ['cancel kalshi order', 'kalshi cancel all'],
    goals: ['EXECUTE_TRADE'],
    domains: ['PREDICTION_MARKETS'],
    requiresAuth: true,
    requiresWallet: false,
    tier: 'free',
    rateLimit: { requests: 10, window: 60000 },
    description: 'Cancel Kalshi orders',
    examples: ['/kalshi cancel <orderId>', '/kalshi cancel all'],
    categories: ['kalshi', 'trading'],
    showTyping: true,
    recordEpisode: true,
  },

  // ===========================================================================
  // PORTFOLIO & ANALYTICS
  // ===========================================================================
  {
    id: 'portfolio',
    handler: 'portfolio',
    patterns: ['/portfolio'],
    aliases: ['my portfolio', 'show portfolio', 'positions overview'],
    goals: ['CHECK_POSITIONS'],
    domains: ['PORTFOLIO'],
    requiresAuth: true,
    requiresWallet: false,
    tier: 'free',
    description: 'View your complete portfolio',
    examples: ['/portfolio'],
    categories: ['portfolio'],
    showTyping: true,
  },

  {
    id: 'pnl',
    handler: 'pnl',
    patterns: ['/pnl', '/profit', '/loss'],
    aliases: ['profit and loss', 'my pnl', 'show pnl'],
    goals: ['CHECK_POSITIONS'],
    domains: ['PORTFOLIO'],
    requiresAuth: true,
    requiresWallet: false,
    tier: 'free',
    description: 'View your P&L report',
    examples: ['/pnl', '/pnl 30'],
    categories: ['portfolio', 'analytics'],
    showTyping: true,
  },

  {
    id: 'me',
    handler: 'me',
    patterns: ['/me', '/profile', '/stats'],
    aliases: ['my profile', 'my stats', 'show me'],
    goals: ['CHECK_POSITIONS'],
    domains: ['PORTFOLIO'],
    requiresAuth: true,
    requiresWallet: false,
    tier: 'free',
    description: 'View your profile and achievements',
    examples: ['/me', '/profile'],
    categories: ['portfolio', 'analytics'],
    showTyping: true,
  },

  {
    id: 'calibration',
    handler: 'calibration',
    patterns: ['/calibration', '/brier', '/accuracy'],
    aliases: ['my calibration', 'brier score', 'prediction accuracy'],
    goals: ['CALIBRATE'],
    domains: ['PORTFOLIO'],
    requiresAuth: true,
    requiresWallet: false,
    tier: 'free',
    description: 'View your prediction calibration stats',
    examples: ['/calibration', '/brier'],
    categories: ['analytics', 'calibration'],
    showTyping: true,
  },

  {
    id: 'leaderboard',
    handler: 'leaderboard',
    patterns: ['/leaderboard', '/rankings', '/top'],
    aliases: ['show leaderboard', 'top forecasters', 'rankings'],
    goals: ['DISCOVER_OPPORTUNITIES'],
    domains: ['PORTFOLIO'],
    requiresAuth: false,
    requiresWallet: false,
    tier: 'free',
    description: 'View forecaster rankings',
    examples: ['/leaderboard', '/rankings'],
    categories: ['analytics', 'social'],
    showTyping: true,
  },

  {
    id: 'compare',
    handler: 'compare',
    patterns: ['/compare'],
    aliases: ['compare predictions', 'vs market', 'divergence'],
    goals: ['COMPARE_OPTIONS'],
    domains: ['PORTFOLIO'],
    requiresAuth: true,
    requiresWallet: false,
    tier: 'free',
    description: 'Compare your predictions vs market consensus',
    examples: ['/compare'],
    categories: ['analytics', 'calibration'],
    showTyping: true,
  },

  // ===========================================================================
  // RESEARCH & ANALYSIS
  // ===========================================================================
  {
    id: 'research',
    handler: 'research',
    patterns: ['/research', '/analyze', '/deep'],
    aliases: ['research', 'analyze', 'deep dive', 'tell me about'],
    goals: ['GET_ANALYSIS', 'UNDERSTAND_MARKET'],
    domains: ['PREDICTION_MARKETS', 'CRYPTO', 'POLITICS', 'FINANCE'],
    requiresAuth: false,
    requiresWallet: false,
    tier: 'free',
    description: 'Deep research and analysis on a topic',
    examples: ['/research fed rates', '/analyze bitcoin halving'],
    categories: ['research', 'analysis'],
    showTyping: true,
    expectedDurationMs: 15000,
    recordEpisode: true,
  },

  {
    id: 'arbitrage',
    handler: 'arbitrage',
    patterns: ['/arb', '/arbitrage', '/spread'],
    aliases: ['find arbitrage', 'check spreads', 'arb opportunities'],
    goals: ['COMPARE_OPTIONS', 'DISCOVER_OPPORTUNITIES'],
    domains: ['PREDICTION_MARKETS'],
    requiresAuth: false,
    requiresWallet: false,
    tier: 'free',
    description: 'Find arbitrage opportunities across platforms',
    examples: ['/arb', '/arbitrage bitcoin'],
    categories: ['arbitrage', 'discovery'],
    showTyping: true,
    expectedDurationMs: 10000,
  },

  // ===========================================================================
  // ALERTS & TRACKING
  // ===========================================================================
  {
    id: 'alert',
    handler: 'alert',
    patterns: ['/alert', '/notify'],
    aliases: ['set alert', 'notify me', 'alert when'],
    goals: ['SET_ALERT'],
    domains: ['PREDICTION_MARKETS', 'CRYPTO'],
    requiresAuth: true,
    requiresWallet: false,
    tier: 'free',
    description: 'Set price or event alerts',
    examples: ['/alert BTCUSDT 0.70', '/alert when bitcoin moves 5%'],
    categories: ['alerts'],
    showTyping: false,
  },

  {
    id: 'whale',
    handler: 'whale',
    patterns: ['/whale', '/whales', '/big'],
    aliases: ['whale activity', 'big trades', 'large orders'],
    goals: ['TRACK_WHALE'],
    domains: ['PREDICTION_MARKETS'],
    requiresAuth: false,
    requiresWallet: false,
    tier: 'free',
    description: 'Track whale activity and large trades',
    examples: ['/whale', '/whale BTCUSDT'],
    categories: ['tracking', 'whale'],
    showTyping: true,
  },

  {
    id: 'subscribe',
    handler: 'subscribe',
    patterns: ['/subscribe'],
    aliases: ['subscribe alerts', 'start notifications', 'enable alerts'],
    goals: ['SET_ALERT'],
    domains: ['SYSTEM'],
    requiresAuth: true,
    requiresWallet: false,
    tier: 'free',
    description: 'Subscribe to automated alerts and notifications',
    examples: ['/subscribe', '/subscribe briefs'],
    categories: ['alerts', 'notifications'],
    showTyping: false,
  },

  {
    id: 'unsubscribe',
    handler: 'subscribe',
    patterns: ['/unsubscribe'],
    aliases: ['unsubscribe', 'stop notifications', 'disable alerts'],
    goals: ['SET_ALERT'],
    domains: ['SYSTEM'],
    requiresAuth: true,
    requiresWallet: false,
    tier: 'free',
    description: 'Unsubscribe from automated alerts',
    examples: ['/unsubscribe'],
    categories: ['alerts', 'notifications'],
    showTyping: false,
  },

  {
    id: 'alerts',
    handler: 'subscribe',
    patterns: ['/alerts'],
    aliases: ['manage alerts', 'alert settings', 'my alerts'],
    goals: ['SET_ALERT'],
    domains: ['SYSTEM'],
    requiresAuth: true,
    requiresWallet: false,
    tier: 'free',
    description: 'Manage your alert settings',
    examples: ['/alerts', '/alerts on arb', '/alerts off whale', '/alerts time 09:00'],
    categories: ['alerts', 'notifications'],
    showTyping: false,
  },

  // ===========================================================================
  // PREDICTIONS & INTELLIGENCE
  // ===========================================================================
  {
    id: 'predict',
    handler: 'predict',
    patterns: ['/predict'],
    aliases: ['make prediction', 'predict', 'forecast'],
    goals: ['CALIBRATE'],
    domains: ['PREDICTION_MARKETS'],
    requiresAuth: true,
    requiresWallet: false,
    tier: 'free',
    description: 'Make a prediction on a market',
    examples: ['/predict "Will BTC hit 100k?" 65 YES'],
    categories: ['predictions', 'calibration'],
    showTyping: true,
    recordEpisode: true,
  },

  {
    id: 'smartpredict',
    handler: 'smartPredict',
    patterns: ['/smartpredict', '/sp'],
    aliases: ['smart predict', 'ai predict', 'assisted prediction'],
    goals: ['CALIBRATE'],
    domains: ['PREDICTION_MARKETS'],
    requiresAuth: true,
    requiresWallet: false,
    tier: 'free',
    description: 'AI-assisted prediction with market matching',
    examples: ['/smartpredict search bitcoin', '/smartpredict TICKER 65 YES'],
    categories: ['predictions', 'intelligence'],
    showTyping: true,
    expectedDurationMs: 5000,
    recordEpisode: true,
  },

  {
    id: 'intelligence',
    handler: 'intelligence',
    patterns: ['/intel', '/intelligence'],
    aliases: ['market intelligence', 'get intel', 'base rate'],
    goals: ['GET_ANALYSIS'],
    domains: ['PREDICTION_MARKETS'],
    requiresAuth: false,
    requiresWallet: false,
    tier: 'free',
    description: 'Get market intelligence: base rates, consensus, bias warnings',
    examples: ['/intel "Will BTC hit 100k?"', '/intelligence TICKER'],
    categories: ['intelligence', 'research'],
    showTyping: true,
    expectedDurationMs: 5000,
  },

  {
    id: 'recommendations',
    handler: 'recommendations',
    patterns: ['/recs', '/recommendations', '/suggest'],
    aliases: ['recommend markets', 'what should I predict', 'suggestions'],
    goals: ['DISCOVER_OPPORTUNITIES'],
    domains: ['PREDICTION_MARKETS'],
    requiresAuth: true,
    requiresWallet: false,
    tier: 'free',
    description: 'Get personalized market recommendations',
    examples: ['/recs', '/recommendations'],
    categories: ['discovery', 'intelligence'],
    showTyping: true,
    expectedDurationMs: 5000,
  },

  {
    id: 'feedback',
    handler: 'feedback',
    patterns: ['/feedback'],
    aliases: ['calibration feedback', 'performance feedback', 'improvement tips'],
    goals: ['CALIBRATE'],
    domains: ['PORTFOLIO'],
    requiresAuth: true,
    requiresWallet: false,
    tier: 'free',
    description: 'Get detailed calibration feedback with patterns and recommendations',
    examples: ['/feedback'],
    categories: ['calibration', 'learning'],
    showTyping: true,
  },

  {
    id: 'learnings',
    handler: 'learnings',
    patterns: ['/learnings', '/lessons'],
    aliases: ['my learnings', 'what I learned', 'prediction lessons'],
    goals: ['CALIBRATE'],
    domains: ['PORTFOLIO'],
    requiresAuth: true,
    requiresWallet: false,
    tier: 'free',
    description: 'View accumulated learning insights from past predictions',
    examples: ['/learnings', '/lessons'],
    categories: ['learning', 'calibration'],
    showTyping: true,
  },

  // ===========================================================================
  // COPY TRADING
  // ===========================================================================
  {
    id: 'follow',
    handler: 'follow',
    patterns: ['/follow'],
    aliases: ['follow forecaster', 'copy trader', 'follow user'],
    goals: ['DISCOVER_OPPORTUNITIES'],
    domains: ['PORTFOLIO'],
    requiresAuth: true,
    requiresWallet: false,
    tier: 'free',
    description: 'Follow a forecaster to see their predictions',
    examples: ['/follow @username', '/follow'],
    categories: ['social', 'copytrading'],
    showTyping: false,
  },

  {
    id: 'unfollow',
    handler: 'follow',
    patterns: ['/unfollow'],
    aliases: ['stop following', 'unfollow user'],
    goals: ['DISCOVER_OPPORTUNITIES'],
    domains: ['PORTFOLIO'],
    requiresAuth: true,
    requiresWallet: false,
    tier: 'free',
    description: 'Stop following a forecaster',
    examples: ['/unfollow @username'],
    categories: ['social', 'copytrading'],
    showTyping: false,
  },

  {
    id: 'signals',
    handler: 'signals',
    patterns: ['/signals'],
    aliases: ['trading signals', 'copy signals', 'forecaster signals'],
    goals: ['DISCOVER_OPPORTUNITIES'],
    domains: ['PREDICTION_MARKETS'],
    requiresAuth: true,
    requiresWallet: false,
    tier: 'free',
    description: 'View trading signals from followed forecasters',
    examples: ['/signals', '/signals 20'],
    categories: ['social', 'copytrading', 'discovery'],
    showTyping: true,
  },

  // ===========================================================================
  // SYSTEM
  // ===========================================================================
  {
    id: 'help',
    handler: 'help',
    patterns: ['/help', '/start', '/commands'],
    aliases: ['help', 'how to use', 'what can you do'],
    goals: ['GET_HELP'],
    domains: ['SYSTEM'],
    requiresAuth: false,
    requiresWallet: false,
    tier: 'free',
    description: 'Show help and available commands',
    examples: ['/help', '/start'],
    categories: ['system'],
    showTyping: false,
  },

  {
    id: 'settings',
    handler: 'settings',
    patterns: ['/settings', '/config', '/preferences'],
    aliases: ['settings', 'preferences', 'configure'],
    goals: ['GET_HELP'],
    domains: ['SYSTEM'],
    requiresAuth: true,
    requiresWallet: false,
    tier: 'free',
    description: 'Manage your preferences',
    examples: ['/settings'],
    categories: ['system'],
    hidden: true,
  },

  // ===========================================================================
  // SEMANTIC FALLBACK (Must be last - catches all unmatched messages)
  // ===========================================================================
  {
    id: 'semantic',
    handler: 'semantic',
    patterns: [], // No patterns - this is the fallback
    aliases: [], // No aliases - catches everything else
    goals: ['CHAT', 'UNKNOWN'],
    domains: ['GENERAL'],
    requiresAuth: false,
    requiresWallet: false,
    tier: 'free',
    description: 'Natural language understanding for any query',
    examples: ['Will Bitcoin hit 100k?', 'What markets are interesting?'],
    categories: ['system'],
    hidden: true, // Not shown in help
    showTyping: true,
    expectedDurationMs: 3000,
  },
];

// =============================================================================
// PARAMETERIZED PATTERNS
// =============================================================================

/**
 * Parameterized patterns for complex commands
 *
 * These define the expected structure of commands with arguments.
 */
export const PARAMETERIZED_PATTERNS: Record<string, ParameterizedPattern> = {
  trade: {
    command: '/trade',
    parameters: [
      {
        name: 'ticker',
        type: 'string',
        required: true,
        pattern: '^[A-Z0-9-]+$',
      },
      {
        name: 'side',
        type: 'enum',
        required: true,
        enumValues: ['YES', 'NO', 'BUY', 'SELL'],
      },
      {
        name: 'amount',
        type: 'number',
        required: true,
        min: 1,
        max: 100000,
      },
    ],
    usage: '/trade <ticker> <YES|NO> <amount>',
  },

  quote: {
    command: '/quote',
    parameters: [
      {
        name: 'ticker',
        type: 'string',
        required: true,
        pattern: '^[A-Z0-9-]+$',
      },
      {
        name: 'side',
        type: 'enum',
        required: true,
        enumValues: ['YES', 'NO'],
      },
      {
        name: 'amount',
        type: 'number',
        required: true,
        min: 1,
        max: 100000,
      },
    ],
    usage: '/quote <ticker> <YES|NO> <amount>',
  },

  alert: {
    command: '/alert',
    parameters: [
      {
        name: 'ticker',
        type: 'string',
        required: true,
        pattern: '^[A-Z0-9-]+$',
      },
      {
        name: 'price',
        type: 'number',
        required: true,
        min: 0,
        max: 1,
      },
    ],
    usage: '/alert <ticker> <price>',
  },

  research: {
    command: '/research',
    parameters: [
      {
        name: 'query',
        type: 'string',
        required: true,
      },
    ],
    usage: '/research <topic>',
  },
};

// =============================================================================
// ROUTE HELPERS
// =============================================================================

/**
 * Get route by ID
 */
export function getRouteById(id: string): Route | undefined {
  return ROUTES.find(r => r.id === id);
}

/**
 * Get routes by category
 */
export function getRoutesByCategory(category: string): Route[] {
  return ROUTES.filter(r => r.categories?.includes(category) && !r.hidden);
}

/**
 * Get routes by goal
 */
export function getRoutesByGoal(goal: string): Route[] {
  return ROUTES.filter(r => r.goals?.includes(goal as any));
}

/**
 * Get all visible routes for help
 */
export function getVisibleRoutes(): Route[] {
  return ROUTES.filter(r => !r.hidden && r.enabled !== false);
}

/**
 * Find route by pattern (exact match)
 */
export function findRouteByPattern(pattern: string): Route | undefined {
  const normalizedPattern = pattern.toLowerCase().split(' ')[0];
  return ROUTES.find(r =>
    r.patterns.some(p => p.toLowerCase() === normalizedPattern)
  );
}

/**
 * Find route by alias
 */
export function findRouteByAlias(text: string): Route | undefined {
  const normalizedText = text.toLowerCase().trim();
  return ROUTES.find(r =>
    r.aliases?.some(a => normalizedText.includes(a.toLowerCase()))
  );
}
