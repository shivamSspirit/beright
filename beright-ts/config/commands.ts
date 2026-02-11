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

// Keyword triggers for routing
export const KEYWORD_TRIGGERS: Record<string, string> = {
  arbitrage: 'ARBITRAGE',
  spread: 'ARBITRAGE',
  whale: 'WHALE',
  'smart money': 'WHALE',
  analyze: 'RESEARCH',
  research: 'RESEARCH',
  'what do you think': 'RESEARCH',
  news: 'INTEL',
  twitter: 'INTEL',
  reddit: 'INTEL',
};

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
BeRight - Prediction Market Intelligence

DAILY ESSENTIALS
/brief - Morning briefing with alpha
/hot - Top trending markets
/me - Your stats & performance
/leaderboard - Top forecasters

PREDICTIONS
/predict <question> <prob> YES|NO - Make prediction
/calibration - Your calibration report

RESEARCH & ANALYSIS
/research <topic> - Superforecaster analysis
/odds <topic> - Compare odds across platforms
/arb [topic] - Find arbitrage opportunities

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

TRADING (DFlow/Solana)
/buy <ticker> YES|NO <usdc> - Get trade quote
/scan - Find LP opportunities
/volume - Builder Code metrics
/swap <amt> <from> <to> - Token swap quote
/wallet <address> - Check balance

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
/subscribe - Get morning briefs & alerts
/unsubscribe - Stop all alerts

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
