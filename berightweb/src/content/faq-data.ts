/**
 * FAQ Content Data
 *
 * Central source for FAQ content, extracted for easy maintenance.
 * Content is derived from actual codebase implementations.
 *
 * @see beright-ts/lib/orchestrator/handlers/ - Command handlers
 * @see beright-ts/lib/router/routes.config.ts - Route definitions
 * @see beright-ts/lib/dataFabric/providers/ - Platform integrations
 */

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: FAQCategory;
}

export type FAQCategory =
  | 'Getting Started'
  | 'Scoring & Calibration'
  | 'Markets & Trading'
  | 'Terminal'
  | 'Web App'
  | 'Subscriptions & Tiers'
  | 'Pools & Vaults'
  | 'API & Developers';

export const FAQ_CATEGORIES: FAQCategory[] = [
  'Getting Started',
  'Scoring & Calibration',
  'Markets & Trading',
  'Terminal',
  'Web App',
  'Subscriptions & Tiers',
  'Pools & Vaults',
  'API & Developers',
];

export const CATEGORY_COLORS: Record<FAQCategory, { bg: string; border: string; text: string }> = {
  'Getting Started': { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.25)', text: '#10B981' },
  'Scoring & Calibration': { bg: 'rgba(255, 193, 7, 0.12)', border: 'rgba(255, 193, 7, 0.25)', text: '#FFC107' },
  'Markets & Trading': { bg: 'rgba(0, 255, 178, 0.12)', border: 'rgba(0, 255, 178, 0.25)', text: '#00FFB2' },
  'Terminal': { bg: 'rgba(0, 136, 204, 0.12)', border: 'rgba(0, 136, 204, 0.25)', text: '#0088CC' },
  'Web App': { bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.25)', text: '#8B5CF6' },
  'Subscriptions & Tiers': { bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.25)', text: '#F97316' },
  'Pools & Vaults': { bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.25)', text: '#EC4899' },
  'API & Developers': { bg: 'rgba(156, 163, 175, 0.12)', border: 'rgba(156, 163, 175, 0.25)', text: '#9CA3AF' },
};

export const FAQ_ITEMS: FAQItem[] = [
  // ===========================================================================
  // GETTING STARTED
  // ===========================================================================
  {
    id: 'what-is-beright',
    category: 'Getting Started',
    question: 'What is BeRight?',
    answer: `BeRight is an AI-powered prediction market intelligence platform that helps you trade smarter across multiple platforms. We provide:

• **AI-powered forecasts** - Benchmark your predictions against our ensemble AI model (GPT-4 + Claude)
• **Arbitrage detection** - Find price discrepancies across Polymarket, Kalshi, Manifold, and Jupiter
• **On-chain calibration** - Build a verifiable forecasting track record with Brier scores on Solana
• **Real-time signals** - Whale movements, price alerts, and market intelligence
• **Swipe-to-trade** - Mobile-first trading experience via the web app
• **Delegation pools** - Delegate to top forecasters and earn from their predictions

Think of BeRight as your AI copilot for prediction markets.`,
  },
  {
    id: 'connect-wallet',
    category: 'Getting Started',
    question: 'How do I connect my wallet?',
    answer: `Click "Connect" on the homepage. We support:

• **Phantom** - Most popular Solana wallet
• **Solflare** - Feature-rich Solana wallet
• **Backpack** - Multi-chain wallet with xNFT support
• **Email/Social login** - Via Privy (creates an embedded Solana wallet)

Your wallet is used for:
1. Identity (your prediction history is tied to your wallet)
2. On-chain calibration records (Brier scores stored on Solana)
3. Trading on DFlow/Jupiter (Solana-native prediction markets)
4. Pool delegation (deposit to forecaster vaults)

We never have access to your private keys. All transactions require your explicit approval.`,
  },
  {
    id: 'get-started-web',
    category: 'Getting Started',
    question: 'How do I get started with the web app?',
    answer: `**Quick Start:**

1. **Connect wallet** - Click "Connect" and choose your wallet or sign in with email
2. **Explore markets** - Browse trending markets on the home page
3. **Swipe to predict** - Swipe right for YES, left for NO on market cards
4. **Track calibration** - View your Brier score on the Leaderboard
5. **Check the terminal** - Use the BeRight Terminal for advanced commands

**Key Pages:**
• **Home** - Swipe cards for quick predictions
• **Markets** - Browse all available markets
• **Terminal** - Natural language trading interface
• **Leaderboard** - See top forecasters and your rank
• **Profile** - Your stats, predictions, and settings`,
  },

  // ===========================================================================
  // SCORING & CALIBRATION
  // ===========================================================================
  {
    id: 'scoring',
    category: 'Scoring & Calibration',
    question: 'How does scoring work?',
    answer: `BeRight uses **Brier Scoring** - the gold standard for forecast accuracy:

**Formula:** Brier Score = (probability - outcome)²

**Example:**
• You predict 80% YES, outcome is YES (1): Score = (0.80 - 1)² = 0.04 (excellent)
• You predict 80% YES, outcome is NO (0): Score = (0.80 - 0)² = 0.64 (poor)

**Score interpretation:**
• 0.00 - 0.10: Exceptional (superforecaster territory)
• 0.10 - 0.15: Elite
• 0.15 - 0.20: Very Good
• 0.20 - 0.25: Average
• 0.25+: Below baseline (random guessing)

Lower is better. A score of 0.25 is equivalent to always guessing 50%.`,
  },
  {
    id: 'brier-score',
    category: 'Scoring & Calibration',
    question: 'What is a Brier Score?',
    answer: `The Brier Score measures how **calibrated** your predictions are - not just if you got the direction right, but if your confidence levels were appropriate.

**Why Brier over Win Rate?**
Win rate ignores confidence. If you say "90% YES" and it happens, great. But if you said "51% YES", that's not impressive. Brier Score captures this nuance.

**What's a good Brier Score?**
• **< 0.12** - Superforecaster tier (100+ predictions needed)
• **0.12 - 0.18** - Elite tier (50+ predictions needed)
• **0.18 - 0.25** - Verified tier (20+ predictions needed)
• **> 0.25** - Rookie (building track record)

Philip Tetlock's superforecasters typically achieve 0.10-0.15 on geopolitical questions.`,
  },
  {
    id: 'ai-benchmark',
    category: 'Scoring & Calibration',
    question: 'How does the AI benchmark work?',
    answer: `Every market on BeRight has an **AI probability forecast** generated by our ensemble model (GPT-4 + Claude).

**How it works:**
1. AI analyzes the market question, historical data, base rates, and current news
2. Generates a calibrated probability estimate
3. Your predictions are compared against the AI's predictions
4. We track who performs better over time

**Why it matters:**
If you consistently beat the AI benchmark, you have demonstrable alpha. This is valuable for:
• Building credibility as a forecaster
• Proving skill vs. luck
• Qualifying for delegation pools (others can copy your predictions)
• Attracting followers on BeRight`,
  },
  {
    id: 'onchain-calibration',
    category: 'Scoring & Calibration',
    question: 'What is on-chain calibration?',
    answer: `BeRight records your calibration scores **on the Solana blockchain**, creating a verifiable, tamper-proof track record.

**How it works:**
1. When you make a prediction, it's hashed and stored on-chain
2. When the market resolves, your Brier score is calculated
3. Your aggregate stats are updated in your on-chain forecaster account
4. Anyone can verify your track record by querying the blockchain

**Forecaster Tiers (based on on-chain data):**
• **Superforecaster** - Brier < 0.12, 100+ resolved predictions
• **Elite** - Brier < 0.18, 50+ resolved predictions
• **Verified** - Brier < 0.25, 20+ resolved predictions
• **Rookie** - Building track record (< 20 predictions)

This creates a **sybil-resistant** reputation system that can't be gamed.`,
  },

  // ===========================================================================
  // MARKETS & TRADING
  // ===========================================================================
  {
    id: 'platforms',
    category: 'Markets & Trading',
    question: 'Which platforms does BeRight support?',
    answer: `We aggregate data from major prediction markets:

**Active Integrations:**
- **Polymarket** - Largest crypto-native market, USDC-based
- **Kalshi** - US-regulated (CFTC), USD deposits
- **Manifold** - Play money, great for practice and calibration
- **Jupiter (DFlow)** - Solana-native, on-chain order books

**Data Available:**
• Real-time prices and volumes
• Historical price charts
• Cross-platform arbitrage detection
• Whale activity tracking (Polymarket)
• Order book depth (Jupiter/DFlow)

**Coming Soon:**
• Metaculus (community forecasting)
• Limitless
• ProphetX`,
  },
  {
    id: 'arbitrage',
    category: 'Markets & Trading',
    question: 'What is arbitrage and how do I use it?',
    answer: `**Arbitrage** is when the same event has different prices on different platforms, creating a risk-free profit opportunity.

**Example:**
• Polymarket: "Trump wins" at 55¢ YES
• Kalshi: "Trump wins" at 48¢ YES

If you buy YES on Kalshi (48¢) and NO on Polymarket (45¢), you spend 93¢ and are guaranteed $1 → **7% profit** regardless of outcome.

**Using BeRight:**
• Use \`/arb\` in the Terminal to scan for opportunities
• Type "arb" or "arbitrage" for natural language queries
• GET \`/api/v2/arbitrage\` for programmatic access
• We show spreads, confidence scores, and platform links

**Note:** Account for fees (~2-5%) and execution risk when calculating real profits.`,
  },
  {
    id: 'swipe-trading',
    category: 'Markets & Trading',
    question: 'How does swipe-to-trade work?',
    answer: `The home page features a **Tinder-like swipe interface** for quick market predictions:

**How to use:**
• **Swipe RIGHT** → Predict YES
• **Swipe LEFT** → Predict NO
• **Swipe UP** → Skip / Save for later
• **Tap card** → View market details

**What happens when you swipe:**
1. Your prediction is recorded (on-chain if connected)
2. Contributes to your calibration score when market resolves
3. In trading mode, can execute actual trades via Jupiter

**Customization:**
• Filter by category (Politics, Crypto, Sports, etc.)
• Set default prediction size in Settings
• Enable/disable auto-execution

This makes forecasting as easy as browsing social media.`,
  },

  // ===========================================================================
  // TERMINAL
  // ===========================================================================
  {
    id: 'terminal-commands',
    category: 'Terminal',
    question: 'What commands does the Terminal support?',
    answer: `**Discovery:**
• \`/hot\` - Trending markets
• \`/brief\` - Morning market briefing
• \`/research <topic>\` - Deep analysis
• \`/alpha\` - Find trading opportunities
• \`/dflow <query>\` - Search Jupiter/DFlow markets

**Trading:**
• \`/trade <ticker> YES/NO <amount>\` - Execute trade
• \`/quote <ticker> YES/NO <amount>\` - Get quote
• \`/swap SOL USDC <amount>\` - Jupiter token swap
• \`/positions\` - View open positions
• \`/wallet\` - Check balance

**Kalshi:**
• \`/kalshi\` - Overview
• \`/kalshi markets <query>\` - Search
• \`/kalshi buy <ticker> yes <qty> <price>\` - Buy
• \`/kalshi positions\` - View positions
• \`/kalshi balance\` - Account balance

**Predictions & Calibration:**
• \`/predict "Question" <prob> YES/NO\` - Make prediction
• \`/calibration\` - Your Brier scores
• \`/leaderboard\` - Top forecasters
• \`/me\` - Your profile & stats
• \`/feedback\` - Get improvement tips

**Intelligence:**
• \`/arb\` - Arbitrage scanner
• \`/intel <topic>\` - Market intelligence
• \`/whale\` - Whale activity
• \`/recs\` - Personalized recommendations

**Alerts:**
• \`/alerts\` - View and manage alerts
• \`/alerts on arb\` - Turn on arbitrage alerts
• \`/alerts off whale\` - Disable whale alerts

**System:**
• \`/help\` - List all commands
• \`/settings\` - Manage preferences`,
  },
  {
    id: 'alerts',
    category: 'Terminal',
    question: 'How do I set up alerts?',
    answer: `**Enable notifications in Settings:**

Visit Profile → Settings to configure:
• Arbitrage opportunities (>3% spread)
• Whale movements (>$10K trades)
• Price threshold alerts
• Market resolutions

**Manage alerts in Terminal:**
• \`/alerts\` - View current settings
• \`/alerts on arb\` - Enable arbitrage alerts
• \`/alerts off whale\` - Disable whale alerts

**Pro/Alpha tiers get:**
• Custom price threshold alerts
• Market-specific notifications
• Portfolio P&L alerts
• Priority delivery`,
  },
  {
    id: 'natural-language',
    category: 'Terminal',
    question: 'Can I use natural language instead of commands?',
    answer: `Yes! The Terminal understands natural language queries. Just type normally:

**Examples that work:**
• "What are the hot markets right now?"
• "Tell me about the Fed rate decision"
• "Predict YES on Bitcoin 100k with 0.5 SOL"
• "Show my calibration stats"
• "Find arbitrage opportunities"

**The Terminal will:**
1. Parse your intent using GPT-4
2. Route to the appropriate handler
3. Execute the action or ask for clarification

**Tips:**
• Be specific about amounts and directions for trades
• Include context for research queries
• Use /help <topic> for command-specific help

Natural language works best for discovery and research. For precision trading, use explicit commands.`,
  },

  // ===========================================================================
  // WEB APP
  // ===========================================================================
  {
    id: 'terminal',
    category: 'Web App',
    question: 'How do I use the BeRight Terminal?',
    answer: `The **Terminal** is a command-line style interface in the web app for power users:

**Access:** Click "Terminal" in the navigation

**Features:**
• Natural language queries ("What's happening with Bitcoin?")
• Slash commands (/hot, /arb, /research bitcoin)
• AI-assisted predictions
• Real-time market data
• Trading execution (when connected)

**Example session:**
\`\`\`
> /hot
[Shows trending markets]

> research fed rate decision
[Deep analysis with base rates, consensus, news]

> predict YES on Bitcoin 100k at 65%
[Records prediction to your calibration]

> /arb
[Shows arbitrage opportunities]
\`\`\`

The terminal remembers context, so follow-up questions work naturally.`,
  },
  {
    id: 'portfolio-tracking',
    category: 'Web App',
    question: 'How does portfolio tracking work?',
    answer: `BeRight tracks your positions across connected platforms:

**Tracked Metrics:**
• Open positions and P&L
• Historical performance
• Brier scores over time
• Win rate and calibration curves
• Comparison vs AI benchmark

**View your portfolio:**
• **Profile page** - Overview of all stats
• **Leaderboard** - Your rank vs others
• **Terminal** - /positions, /pnl, /me commands

**Cross-platform tracking:**
• Link your Kalshi account
• Connect Polymarket (via wallet)
• Automatic DFlow/Jupiter tracking (same wallet)

**Pro tier and above** get detailed analytics, export options, and historical charts.`,
  },
  {
    id: 'leaderboard',
    category: 'Web App',
    question: 'How does the leaderboard work?',
    answer: `The leaderboard ranks forecasters by their **on-chain verified** Brier scores:

**Ranking criteria:**
1. Average Brier Score (lower is better)
2. Number of resolved predictions (minimum 10 required)
3. Consistency over time

**Tiers displayed:**
• **Superforecaster** - Top performers, eligible for pools
• **Elite** - Strong track record
• **Verified** - Proven calibration
• **Rookie** - Building history

**What you can see:**
• Rank and display name
• Brier score and accuracy
• Total predictions and streaks
• On-chain verification status
• Profile link

**Getting on the leaderboard:**
1. Make predictions (swipe cards or use /predict)
2. Wait for markets to resolve
3. Build up 10+ resolved predictions
4. Your stats appear automatically`,
  },

  // ===========================================================================
  // SUBSCRIPTIONS & TIERS
  // ===========================================================================
  {
    id: 'tiers-overview',
    category: 'Subscriptions & Tiers',
    question: 'What are the subscription tiers?',
    answer: `BeRight offers 5 tiers to match your needs:

**Free ($0/forever)**
• Dashboard access
• Terminal (basic)
• Scout Agent (5 calls/day)
• 10 queries/day
• 3 watchlist slots

**Pro ($29/month)**
• Everything in Free
• API access (1K calls/day)
• Arbitrage alerts
• Signal intelligence
• Portfolio tracking
• Custom alerts
• 100 queries/day

**Alpha ($79/month)**
• Everything in Pro
• All AI agents (Scout, Analyst, Trader, xDegen)
• Deep research
• 500 queries/day
• 5K API calls/day

**Whale ($199/month)**
• Everything in Alpha
• Auto-execution
• Priority support
• 2K queries/day
• 20K API calls/day

**Enterprise ($499/month)**
• Unlimited everything
• White-glove service
• Custom integrations
• Dedicated support`,
  },
  {
    id: 'tier-features',
    category: 'Subscriptions & Tiers',
    question: 'What features are included in each tier?',
    answer: `**Agent Access by Tier:**

| Agent | Free | Pro | Alpha | Whale |
|-------|------|-----|-------|-------|
| Scout (quick scans) | ✓ | ✓ | ✓ | ✓ |
| Analyst (deep research) | — | — | ✓ | ✓ |
| Trader (execution) | — | — | ✓ | ✓ |
| xDegen (social content) | — | — | ✓ | ✓ |

**Feature Matrix:**

| Feature | Free | Pro | Alpha | Whale |
|---------|------|-----|-------|-------|
| Arbitrage Alerts | — | ✓ | ✓ | ✓ |
| Custom Alerts | — | ✓ | ✓ | ✓ |
| API Access | — | ✓ | ✓ | ✓ |
| Portfolio Tracking | — | ✓ | ✓ | ✓ |
| Deep Research | — | — | ✓ | ✓ |
| Auto-Execution | — | — | — | ✓ |
| Priority Support | — | — | — | ✓ |`,
  },
  {
    id: 'upgrade',
    category: 'Subscriptions & Tiers',
    question: 'How do I upgrade my subscription?',
    answer: `**To upgrade:**
1. Go to Profile → Subscription (or visit /subscription)
2. Select your desired tier
3. Choose monthly or yearly billing (save 17% on yearly)
4. Complete checkout via Stripe

**Payment methods:**
• All major credit cards
• Enterprise: Invoice/ACH available

**Plan changes:**
• Upgrades take effect immediately
• Downgrades apply at end of billing period
• Cancel anytime (access continues until period ends)

**7-day money-back guarantee** on first subscription.

**Enterprise inquiries:** Contact enterprise@beright.io`,
  },

  // ===========================================================================
  // POOLS & VAULTS
  // ===========================================================================
  {
    id: 'pools-explained',
    category: 'Pools & Vaults',
    question: 'How do prediction pools work?',
    answer: `**Conviction Pools** let you delegate funds to top forecasters:

**How it works:**
1. Elite/Superforecaster creates a pool
2. You deposit SOL/USDC to the pool
3. Forecaster trades on your behalf
4. Profits (minus fees) are distributed to depositors

**Pool Types:**
• **Public** - Anyone can join
• **Private** - Invite-only
• **Institutional** - Large minimums, lower fees

**Fee Structure (typical):**
• Management fee: 2% annually
• Performance fee: 20% of profits
• Entry fee: 0-0.25%
• Exit fee: 0.25%

**Safety features:**
• Funds held in on-chain smart contracts
• Forecaster can only trade, not withdraw your funds
• Transparent on-chain performance history
• 7-day lockup with 3-day withdrawal notice`,
  },
  {
    id: 'delegation',
    category: 'Pools & Vaults',
    question: 'How do I delegate to a forecaster?',
    answer: `**To delegate:**
1. Visit the **Pools** page
2. Browse available pools (sorted by return, Brier score, TVL)
3. Click a pool to view forecaster's track record
4. Connect wallet and click "Delegate"
5. Enter amount and confirm transaction

**Requirements:**
• Connected Solana wallet
• Minimum deposit (usually 100 USDC)
• SOL for transaction fees

**What to look for:**
• Forecaster's Brier score (lower is better)
• Historical returns
• Number of delegators
• Fee structure
• Pool status (open vs. closed)

**Withdrawing:**
• Request withdrawal (3-day notice period)
• After lockup expires, claim your funds
• Includes proportional share of profits/losses`,
  },
  {
    id: 'yield',
    category: 'Pools & Vaults',
    question: 'How do pools generate yield?',
    answer: `Pools generate returns through multiple mechanisms:

**Active Trading (Primary):**
• Forecaster makes predictions on markets
• Profitable predictions generate returns
• Returns distributed proportionally to depositors

**Yield Allocation (Passive):**
• Portion of pool deposited to yield strategies
• Currently: Solana staking, lending protocols
• Provides baseline APY even during low activity

**Pool Capital Allocation:**
• ~30-50% actively traded
• ~20-30% in yield strategies
• ~20-30% held as reserve (for withdrawals)

**Example returns:**
• Elite forecaster with 0.15 Brier → ~15-25% APY historically
• After 20% performance fee → ~12-20% net to delegators
• Plus yield component → additional 3-5% APY

**Note:** Past performance doesn't guarantee future results. Prediction markets carry risk.`,
  },

  // ===========================================================================
  // API & DEVELOPERS
  // ===========================================================================
  {
    id: 'api-access',
    category: 'API & Developers',
    question: 'How do I access the BeRight API?',
    answer: `The BeRight API provides programmatic access to market data and trading.

**Availability:**
• Pro tier and above
• Rate limits based on tier

**Base URL:** \`https://api.beright.io/v2\`

**Authentication:**
• API key in header: \`Authorization: Bearer <your-api-key>\`
• Get your key in Profile → Settings → API

**Key Endpoints:**
• \`GET /markets\` - List markets
• \`GET /markets/trending\` - Hot markets
• \`GET /arbitrage\` - Arbitrage opportunities
• \`GET /calibration?wallet=<addr>\` - Forecaster stats
• \`GET /calibration?leaderboard=true\` - Rankings
• \`POST /predictions/record\` - Record prediction

**Rate Limits:**
• Pro: 10/min, 1K/day
• Alpha: 30/min, 5K/day
• Whale: 60/min, 20K/day
• Enterprise: 120/min, unlimited`,
  },
  {
    id: 'api-endpoints',
    category: 'API & Developers',
    question: 'What API endpoints are available?',
    answer: `**Markets & Discovery:**
• \`GET /v2/markets\` - List all markets
• \`GET /v2/markets/trending\` - Trending markets
• \`GET /v2/markets/{id}\` - Market details
• \`GET /v2/demo/markets\` - Demo mode markets

**Trading & Execution:**
• \`GET /v2/execution/quote\` - Get quote
• \`POST /v2/execution\` - Execute trade
• \`GET /v2/execution/balances\` - Wallet balances

**Portfolio:**
• \`GET /v2/portfolio\` - Portfolio overview
• \`GET /v2/portfolio/alerts\` - Active alerts

**Calibration:**
• \`GET /v2/calibration?wallet=<addr>\` - Forecaster stats
• \`GET /v2/calibration?leaderboard=true\` - Leaderboard

**Predictions:**
• \`POST /v2/predictions/record\` - Record prediction
• \`GET /v2/predictions/user\` - User predictions

**Pools:**
• \`GET /v2/pools\` - List pools
• \`GET /v2/pools/{id}\` - Pool details
• \`POST /v2/pools/{id}/delegate\` - Delegate to pool

**Intelligence:**
• \`GET /v2/arbitrage\` - Arbitrage opportunities
• \`GET /v2/feed\` - Market feed`,
  },
  {
    id: 'api-example',
    category: 'API & Developers',
    question: 'Can you show an API example?',
    answer: `**Fetch trending markets:**
\`\`\`bash
curl -X GET "https://api.beright.io/v2/markets/trending" \\
  -H "Authorization: Bearer YOUR_API_KEY"
\`\`\`

**Get arbitrage opportunities:**
\`\`\`bash
curl -X GET "https://api.beright.io/v2/arbitrage" \\
  -H "Authorization: Bearer YOUR_API_KEY"
\`\`\`

**Record a prediction:**
\`\`\`bash
curl -X POST "https://api.beright.io/v2/predictions/record" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "marketId": "btc-100k-2024",
    "probability": 0.65,
    "position": "YES",
    "walletAddress": "your-wallet-address"
  }'
\`\`\`

**Check forecaster calibration:**
\`\`\`bash
curl -X GET "https://api.beright.io/v2/calibration?wallet=YOUR_WALLET" \\
  -H "Authorization: Bearer YOUR_API_KEY"
\`\`\`

See full documentation at docs.beright.io`,
  },
];

export default FAQ_ITEMS;
