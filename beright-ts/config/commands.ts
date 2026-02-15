/**
 * Telegram Commands Configuration for BeRight Protocol
 */

export interface Command {
  name: string;
  description: string;
  usage: string;
  agent: 'COMMANDER' | 'RESEARCH' | 'ARBITRAGE' | 'WHALE' | 'INTEL' | 'EXECUTOR';
}

export const COMMANDS: Command[] = [
  // Commander (Router)
  {
    name: '/start',
    description: 'Welcome message and help',
    usage: '/start',
    agent: 'COMMANDER',
  },
  {
    name: '/help',
    description: 'Show available commands',
    usage: '/help',
    agent: 'COMMANDER',
  },
  {
    name: '/brief',
    description: 'Morning briefing with opportunities',
    usage: '/brief',
    agent: 'COMMANDER',
  },
  {
    name: '/accuracy',
    description: 'Your forecasting performance',
    usage: '/accuracy',
    agent: 'COMMANDER',
  },
  {
    name: '/track',
    description: 'Add market to watchlist',
    usage: '/track <market>',
    agent: 'COMMANDER',
  },
  {
    name: '/portfolio',
    description: 'View open positions and P&L',
    usage: '/portfolio',
    agent: 'COMMANDER',
  },
  {
    name: '/pnl',
    description: 'View profit/loss summary',
    usage: '/pnl',
    agent: 'COMMANDER',
  },
  {
    name: '/expiring',
    description: 'View positions expiring soon',
    usage: '/expiring',
    agent: 'COMMANDER',
  },
  {
    name: '/alert',
    description: 'Set price alerts for markets',
    usage: '/alert <market> above/below <price>',
    agent: 'COMMANDER',
  },
  {
    name: '/limits',
    description: 'Set trading budget limits',
    usage: '/limits daily <amount> | weekly <amount>',
    agent: 'COMMANDER',
  },
  {
    name: '/autobet',
    description: 'Manage auto-trade rules',
    usage: '/autobet',
    agent: 'COMMANDER',
  },
  {
    name: '/stoploss',
    description: 'Set stop-loss for position',
    usage: '/stoploss <market> <percent>',
    agent: 'COMMANDER',
  },
  {
    name: '/takeprofit',
    description: 'Set take-profit for position',
    usage: '/takeprofit <market> <percent>',
    agent: 'COMMANDER',
  },
  {
    name: '/dca',
    description: 'Set up DCA into market',
    usage: '/dca <market> <amount> <interval>',
    agent: 'COMMANDER',
  },

  // Research Agent
  {
    name: '/research',
    description: 'Deep superforecaster analysis',
    usage: '/research <market or topic>',
    agent: 'RESEARCH',
  },
  {
    name: '/odds',
    description: 'Cross-platform odds comparison',
    usage: '/odds <topic>',
    agent: 'RESEARCH',
  },

  // Arbitrage Agent
  {
    name: '/arb',
    description: 'Scan for arbitrage opportunities',
    usage: '/arb [topic]',
    agent: 'ARBITRAGE',
  },
  {
    name: '/arb-monitor',
    description: 'Control 24/7 arbitrage monitor (admin)',
    usage: '/arb-monitor start|stop|status',
    agent: 'ARBITRAGE',
  },
  {
    name: '/arb-subscribe',
    description: 'Subscribe to instant arb alerts',
    usage: '/arb-subscribe',
    agent: 'ARBITRAGE',
  },
  {
    name: '/arb-unsubscribe',
    description: 'Unsubscribe from arb alerts',
    usage: '/arb-unsubscribe',
    agent: 'ARBITRAGE',
  },

  // Whale Agent
  {
    name: '/whale',
    description: 'Whale activity alerts',
    usage: '/whale',
    agent: 'WHALE',
  },
  {
    name: '/track_whale',
    description: 'Add wallet to whale tracking',
    usage: '/track_whale <address>',
    agent: 'WHALE',
  },

  // Intel Agent
  {
    name: '/news',
    description: 'Search news on topic',
    usage: '/news <topic>',
    agent: 'INTEL',
  },
  {
    name: '/social',
    description: 'Social media sentiment',
    usage: '/social <topic>',
    agent: 'INTEL',
  },
  {
    name: '/intel',
    description: 'Full intel report (news + social)',
    usage: '/intel <topic>',
    agent: 'INTEL',
  },

  // Executor Agent
  {
    name: '/execute',
    description: 'Execute a trade',
    usage: '/execute <action>',
    agent: 'EXECUTOR',
  },
  {
    name: '/wallet',
    description: 'Check wallet balance',
    usage: '/wallet',
    agent: 'EXECUTOR',
  },
];

// Keyword triggers for routing (expanded from 10 to 60+)
export const KEYWORD_TRIGGERS: Record<string, string> = {
  // ARBITRAGE (price discrepancies)
  arbitrage: 'ARBITRAGE',
  arb: 'ARBITRAGE',
  spread: 'ARBITRAGE',
  mispriced: 'ARBITRAGE',
  mispricing: 'ARBITRAGE',
  'price difference': 'ARBITRAGE',
  discrepancy: 'ARBITRAGE',
  inefficiency: 'ARBITRAGE',
  'free money': 'ARBITRAGE',

  // WHALE (smart money tracking)
  whale: 'WHALE',
  whales: 'WHALE',
  'smart money': 'WHALE',
  'big players': 'WHALE',
  'large positions': 'WHALE',
  institutional: 'WHALE',
  'big bets': 'WHALE',
  "who's buying": 'WHALE',

  // RESEARCH (analysis)
  analyze: 'RESEARCH',
  analysis: 'RESEARCH',
  research: 'RESEARCH',
  'deep dive': 'RESEARCH',
  investigate: 'RESEARCH',
  'what do you think': 'RESEARCH',
  'your take': 'RESEARCH',
  probability: 'RESEARCH',
  likelihood: 'RESEARCH',
  forecast: 'RESEARCH',
  'base rate': 'RESEARCH',
  calibration: 'RESEARCH',

  // INTEL (news & social)
  news: 'INTEL',
  headlines: 'INTEL',
  twitter: 'INTEL',
  reddit: 'INTEL',
  social: 'INTEL',
  sentiment: 'INTEL',
  "what's happening": 'INTEL',
  latest: 'INTEL',
  updates: 'INTEL',

  // SCOUT (hot markets, trending)
  hot: 'COMMANDER',
  trending: 'COMMANDER',
  popular: 'COMMANDER',
  buzz: 'COMMANDER',
  hype: 'COMMANDER',
  volume: 'COMMANDER',
  moving: 'COMMANDER',
  momentum: 'COMMANDER',
  'top markets': 'COMMANDER',
  movers: 'COMMANDER',
  "what's hot": 'COMMANDER',

  // EXECUTOR (trading)
  buy: 'EXECUTOR',
  sell: 'EXECUTOR',
  trade: 'EXECUTOR',
  swap: 'EXECUTOR',
  quote: 'EXECUTOR',
  'price check': 'EXECUTOR',
  execute: 'EXECUTOR',
};

// Intelligence & Feedback Commands (Phase 1 Automation)
export const INTELLIGENCE_COMMANDS: Command[] = [
  {
    name: '/intelligence',
    description: 'Get AI-powered prediction analysis with base rates, bias warnings, and recommended probability',
    usage: '/intelligence <question>',
    agent: 'COMMANDER',
  },
  {
    name: '/analyze',
    description: 'Alias for /intelligence',
    usage: '/analyze <question>',
    agent: 'COMMANDER',
  },
  {
    name: '/feedback',
    description: 'Get personalized calibration feedback and improvement recommendations',
    usage: '/feedback',
    agent: 'COMMANDER',
  },
];

// New MVP Commands
export const MVP_COMMANDS: Command[] = [
  {
    name: '/brief',
    description: 'Morning briefing with hot markets & alpha',
    usage: '/brief',
    agent: 'COMMANDER',
  },
  {
    name: '/hot',
    description: 'Top trending markets',
    usage: '/hot',
    agent: 'COMMANDER',
  },
  {
    name: '/alpha',
    description: 'Actionable market opportunities',
    usage: '/alpha',
    agent: 'COMMANDER',
  },
  {
    name: '/predict',
    description: 'Make a prediction',
    usage: '/predict <question> <probability> YES|NO',
    agent: 'COMMANDER',
  },
  {
    name: '/me',
    description: 'Your stats and performance',
    usage: '/me',
    agent: 'COMMANDER',
  },
  {
    name: '/leaderboard',
    description: 'Top forecasters',
    usage: '/leaderboard',
    agent: 'COMMANDER',
  },
  {
    name: '/swap',
    description: 'Get Jupiter swap quote',
    usage: '/swap <amount> <from> <to>',
    agent: 'EXECUTOR',
  },
  {
    name: '/calibration',
    description: 'Your calibration report',
    usage: '/calibration',
    agent: 'COMMANDER',
  },
  {
    name: '/buy',
    description: 'Get prediction token trade quote',
    usage: '/buy <ticker> YES|NO <amount>',
    agent: 'EXECUTOR',
  },
  {
    name: '/scan',
    description: 'Scan for LP opportunities',
    usage: '/scan',
    agent: 'EXECUTOR',
  },
  {
    name: '/volume',
    description: 'Builder Code volume metrics',
    usage: '/volume',
    agent: 'EXECUTOR',
  },
  {
    name: '/memory',
    description: 'View memory stats and learnings',
    usage: '/memory [stats|recent|search <topic>]',
    agent: 'COMMANDER',
  },
];

// Help text
export const HELP_TEXT = `
*BERIGHT* - Prediction Market Intelligence

*QUICK START*
/hot - Trending markets
/alpha - Actionable opportunities
/brief - Morning briefing
/arb - Arbitrage scanner

*YOUR STATS*
/me - Your performance
/leaderboard - Top forecasters

PREDICTIONS
/predict <question> <prob> YES|NO - Make prediction
/calibration - Your calibration report
/feedback - Personalized improvement tips

BE RIGHT MOSTLY (AI-Powered Analysis)
/intelligence <question> - Base rates, bias warnings, recommended probability
/analyze <question> - Alias for /intelligence
/recommend - Personalized market recommendations
/compare - Compare your predictions vs market
/learnings - Insights from past predictions

SMART PREDICTIONS (Auto-Resolution)
/findmarket <query> - Find DFlow markets to predict on
/smartpredict <ticker> <prob> YES|NO - Predict with auto-resolution

RESEARCH & ANALYSIS
/research <topic> - Superforecaster analysis
/odds <topic> - Compare odds across platforms
/arb [topic] - Find arbitrage opportunities

ARBITRAGE MONITOR (24/7 Early Detection)
/arb-subscribe - Get instant arb alerts
/arb-unsubscribe - Stop arb alerts
/arb-monitor status - Monitor status
/arb-monitor start - Start monitor (admin)
/arb-monitor stop - Stop monitor (admin)

INTELLIGENCE
/news <topic> - Search news
/intel <topic> - Full intel report
/whale - Whale activity

PORTFOLIO & TRACKING
/portfolio - View all open positions
/pnl - Profit/loss summary
/expiring - Positions expiring soon
/track <market> - Add to watchlist

PRICE ALERTS
/alert <market> above/below <price> - Set alert
/alert - List all active alerts
/alert delete <id> - Remove alert

AUTO-TRADE RULES
/limits daily <$> weekly <$> - Set budget limits
/stoploss <market> <percent> - Auto-sell if down
/takeprofit <market> <percent> - Auto-sell if up
/dca <market> <$> <hours> - Dollar-cost average
/autobet - View all active rules

DFLOW TRADING (One-Tap Trading)
/wallet - Create or view your trading wallet
/dflow <query> - Search DFlow markets
/trade <ticker> YES|NO <usdc> - Place a trade
/positions - View your positions

LEGACY TRADING
/buy <ticker> YES|NO <usdc> - Get trade quote
/scan - Find LP opportunities
/volume - Builder Code metrics
/swap <amt> <from> <to> - Token swap quote
/balance <address> - Check any wallet

KALSHI DIRECT
/kalshi - Kalshi account overview
/kbalance - Your Kalshi balance
/kpositions - Your Kalshi positions
/kmarkets [query] - Browse Kalshi markets
/kbuy <ticker> <yes|no> <contracts> [price] - Buy on Kalshi
/ksell <ticker> <yes|no> <contracts> [price] - Sell on Kalshi

IDENTITY
/connect <wallet> - Link your Solana wallet
/profile - View your profile & stats

NOTIFICATIONS
/subscribe-all - Subscribe to ALL alerts (recommended)
/subscribe - Get morning briefs & alerts
/unsubscribe - Stop all alerts
/agent - 24/7 AI agent (big movers, closing soon, etc)

COPY TRADING
/follow @user - Follow a forecaster
/unfollow @user - Stop following
/signals - View predictions from followed
/toplists - Find top forecasters

MEMORY & LEARNING
/memory - View memory stats
/memory recent - Recent conversations
/memory search <topic> - Search learnings

Just ask me anything about prediction markets!
`;

/**
 * Get help for a specific command
 * Extracts command name from queries like "what is intel command for"
 */
export function getCommandHelp(query: string): string | null {
  // Normalize query
  const normalized = query.toLowerCase().trim();

  // Extract command name from various patterns
  // "what is intel command for" -> "intel"
  // "what does /hot do" -> "hot"
  // "explain the arb command" -> "arb"
  const patterns = [
    // "what is/does /command for/do" - with slash
    /(?:what\s+(?:is|does))\s+(?:the\s+)?\/(\w+)\s*(?:command)?\s*(?:for|do)?/i,
    // "what is/does command for/do" - without slash
    /(?:what\s+(?:is|does))\s+(?:the\s+)?(\w+)\s+command\s*(?:for|do)?/i,
    // "explain the command"
    /(?:explain|tell\s+me\s+about)\s+(?:the\s+)?\/?([\w-]+)\s*(?:command)?/i,
    // "command is for what"
    /\/?([\w-]+)\s+command\s+(?:is\s+)?(?:for|do|does|mean)/i,
  ];

  let cmdName: string | null = null;
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      // Remove leading slash if present
      cmdName = match[1].replace(/^\//, '');
      break;
    }
  }

  if (!cmdName) return null;

  // Find the command in both COMMANDS and MVP_COMMANDS arrays
  const allCommands = [...COMMANDS, ...MVP_COMMANDS];
  const cmd = allCommands.find(c =>
    c.name === `/${cmdName}` ||
    c.name.toLowerCase() === `/${cmdName.toLowerCase()}`
  );

  if (!cmd) {
    return `I don't recognize the command "/${cmdName}". Type /help to see all available commands.`;
  }

  // Build a helpful response
  return `*/${cmdName.toUpperCase()}* Command

📝 *What it does:* ${cmd.description}

💡 *Usage:* \`${cmd.usage}\`

🤖 *Handled by:* ${cmd.agent} Agent

Try it now: \`${cmd.usage.replace('<topic>', 'bitcoin').replace('<question>', 'Will BTC hit 100k?').replace('<market>', 'BTC-100K')}\``;
}
