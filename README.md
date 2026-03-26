<p align="center">
  <img src="beright-logo.svg" alt="BeRight Logo" width="200" />
</p>

<h1 align="center">BeRight</h1>

<p align="center">
  <strong>Autonomous AI agents for prediction markets</strong><br/>
  Aggregate data from 5+ platforms, detect arbitrage, and get superforecaster-grade analysis—automatically.
</p>

<p align="center">
  <a href="#quick-demo">Demo</a> •
  <a href="#-conviction-pools-the-defi-primitive">DeFi Primitive</a> •
  <a href="#-openclaw-agentic-architecture">OpenClaw</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#documentation">Docs</a> •
  <a href="https://github.com/shivamSspirit/beright/issues">Issues</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-beta-yellow" alt="Beta" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node 18+" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue" alt="TypeScript" />
</p>

---

## 🎯 What is BeRight?

BeRight is a **decentralized forecaster network** powered by autonomous AI agents built on the **OpenClaw agentic architecture**. It's the first platform to introduce **Conviction Pools**—a DeFi primitive where you can delegate capital to skilled forecasters and earn yield from their prediction accuracy.

Instead of manually checking Polymarket, Kalshi, Manifold, Limitless, and Metaculus, BeRight does it for you—finding opportunities, tracking whale wallets, and providing research-backed forecasts 24/7.

**The Problem:**
- Prediction market traders spend hours monitoring multiple platforms
- Top forecasters can't monetize their skill at scale
- Capital providers have no way to delegate to expert forecasters
- No transparent, on-chain reputation system

**The Solution:**
- **Autonomous AI agents** that aggregate data, detect opportunities, and provide research-backed forecasts
- **Conviction Pools**: Delegate capital to forecasters, earn yield from their performance
- **On-chain verification**: Every prediction commits to Solana with Brier score tracking
- **Decentralized network**: Built on OpenClaw architecture for composability

---

## 🚀 Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| **Multi-platform aggregation** | ✅ Production | Search 5 platforms in one query |
| **Arbitrage detection** | ✅ Production | Real-time price monitoring |
| **AI research agent** | ✅ Production | Claude-powered superforecaster analysis |
| **On-chain prediction commits** | ✅ Production | Solana verification system |
| **Conviction Pools (DeFi)** | 🟡 Beta | Forecaster staking with SOL/USDC |
| **Web dashboard** | 🟡 Beta | UI showcase (read-only) |
| **Trade execution** | 🔴 Development | Coming soon |
| **Telegram bot** | ✅ Production | 50+ commands available |

> **Note:** Trading execution is not yet enabled. Current version focuses on intelligence gathering, prediction tracking, and forecaster staking.

---

## ⚡ Quick Demo

See BeRight in action without installation:

### Example 1: Multi-Platform Market Search

```bash
npx ts-node beright-ts/skills/markets.ts search "bitcoin 2025"
```

**Output:**
```
🔍 Found 12 markets across 5 platforms:

Polymarket | Bitcoin above $100K by 2025 | 68% | $2.1M volume
Kalshi     | BTC-25DEC-100K              | 71% | $890K volume
Manifold   | Bitcoin ATH in 2025         | 75% | 1.2K traders
...
```

### Example 2: Arbitrage Detection

```bash
npx ts-node beright-ts/skills/arbitrage.ts "fed rate cut"
```

**Output:**
```
🎯 ARBITRAGE OPPORTUNITY FOUND

Market: "Fed cuts rates by March 2025"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Polymarket:  67% YES ($1.8M volume)
Kalshi:      72% YES ($950K volume)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 5% spread | Potential profit: 7.5% ROI
```

### Example 3: AI-Powered Research

```bash
npx ts-node beright-ts/skills/research.ts "trump 2028"
```

**Output:**
```
📊 SUPERFORECASTER ANALYSIS

Base Rate: Former presidents running again: 3/45 (6.7%)
Market Probability: 42% (likely overvalued)

Key Factors:
✓ Historical precedent: Grover Cleveland (1892)
✗ Age factor: Would be 82 at inauguration
✗ Legal challenges: 4 criminal cases

Recommended Probability: 15-25%
Confidence: Medium (limited historical data)
```

---

## ✨ Key Features

### 💎 Conviction Pools (DeFi Primitive)
**The first skill-backed delegation primitive in DeFi.** Forecasters create staking pools in SOL or USDC. Delegators earn yield when forecasters make accurate predictions. Share price appreciates like Jito/Marinade liquid staking tokens.

- **8 Pool Tiers**: Starter, Basic, Pro, Elite (SOL & USDC)
- **50/30/20 Profit Split**: Forecaster 50%, Delegators 30%, Platform 20%
- **On-Chain Reputation**: Brier scores tracked on Solana
- **Conditional Performance**: Forecasters only earn when maintaining tier thresholds

### 🔄 Multi-Platform Aggregation
Search across **Polymarket, Kalshi, Manifold, Limitless, and Metaculus** in a single query. No more tab switching.

### 📈 Real-Time Arbitrage Detection
Automated scanning for price discrepancies across platforms. Get alerts when opportunities emerge.

### 🐋 Whale Wallet Tracking
Monitor Solana wallets of top traders. See what the smart money is betting on.

### 🧠 Superforecaster AI Agent
Claude-powered research with base rates, bias warnings, and calibrated probability estimates.

### ⛓️ On-Chain Verification
Every prediction commits to Solana. Build an immutable, verifiable track record.

### 📊 Calibration Tracking
Brier scores track your accuracy over time. Get personalized feedback to improve.

### 🤖 24/7 Autonomous Monitoring
Heartbeat agent scans markets every 5 minutes, never missing an opportunity.

### 📱 Telegram Bot Interface
50+ commands for market intelligence, predictions, alerts, and portfolio tracking.

---

## 🛠️ Tech Stack

<table>
<tr>
<td>

**Frontend**
- Next.js 14 (App Router)
- React 18
- TypeScript (strict mode)
- Tailwind CSS
- Privy (wallet auth)

</td>
<td>

**Backend**
- Node.js 18+
- Express API
- TypeScript
- Supabase (PostgreSQL)
- Upstash Redis

</td>
<td>

**Blockchain / DeFi**
- Solana Web3.js
- Anchor Framework
- Conviction Pools (smart contracts)
- Helius RPC
- On-chain prediction commits

</td>
</tr>
<tr>
<td>

**AI / Agents**
- OpenClaw Architecture
- Anthropic Claude (Opus/Sonnet/Haiku)
- Multi-agent orchestration
- Semantic search
- Tavily API (web search)

</td>
<td>

**Data Sources**
- Polymarket API
- Kalshi API
- Manifold API
- Limitless API
- Metaculus API

</td>
<td>

**Infrastructure**
- Telegram Bot API
- Jito (MEV protection)
- Jupiter (DEX aggregation)
- DFlow (order flow)

</td>
</tr>
</table>

---

## 💎 Conviction Pools: The DeFi Primitive

BeRight introduces **Conviction Pools**—the first skill-backed delegation primitive in DeFi. Think Jito/Marinade liquid staking, but for forecaster expertise instead of validator uptime.

### How It Works

```
Forecaster Creates Pool
         │
         ├─▶ Tier Selected (Starter/Basic/Pro/Elite)
         ├─▶ Token Chosen (SOL or USDC)
         ├─▶ Brier Score Verified On-Chain
         │
Delegators Deposit Capital
         │
         ├─▶ Receive Pool Shares (exchange rate 1.0 initially)
         ├─▶ Capital used for predictions by forecaster
         │
Forecaster Makes Predictions
         │
         ├─▶ Winning predictions → profit
         ├─▶ Losing predictions → loss
         │
Profit Distribution (50/30/20 Split)
         │
         ├──▶ 50% to Forecaster (direct payout)
         ├──▶ 30% stays in pool (share price ↑)
         └──▶ 20% to Platform (treasury)
```

### Pool Tiers & Requirements

| Tier | Capacity | Token | Max Brier | Min Predictions | Min Deposit |
|------|----------|-------|-----------|-----------------|-------------|
| **Starter SOL** | 5 SOL | SOL | 0.35 | 10 | 0.1 SOL |
| **Basic SOL** | 10 SOL | SOL | 0.30 | 25 | 0.1 SOL |
| **Pro SOL** | 100 SOL | SOL | 0.25 | 100 | 1 SOL |
| **Elite SOL** | 500 SOL | SOL | 0.20 | 250 | 5 SOL |
| **Starter USDC** | 500 USDC | USDC | 0.35 | 10 | 5 USDC |
| **Basic USDC** | 1,000 USDC | USDC | 0.30 | 25 | 10 USDC |
| **Pro USDC** | 10,000 USDC | USDC | 0.25 | 100 | 100 USDC |
| **Elite USDC** | 50,000 USDC | USDC | 0.20 | 250 | 500 USDC |

**Brier Score Scale:** Lower is better. 0.25 = superforecaster level. 0.20 = world-class.

### Example: Share Price Appreciation

```
Elite USDC Pool: 10,000 USDC capacity, 5 delegators
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Initial State:
  Pool TVL: 10,000 USDC
  Total Shares: 10,000
  Share Price: 1.0 USDC

Forecaster makes winning prediction:
  Profit: 2,000 USDC (20% return)

Profit Split:
  50% → Forecaster: 1,000 USDC (withdrawn)
  30% → Delegators: 600 USDC (stays in pool)
  20% → Platform: 400 USDC (treasury)

After Distribution:
  Pool TVL: 10,600 USDC (10,000 + 600)
  Total Shares: 10,000 (unchanged)
  Share Price: 1.06 USDC ✅ (+6% for delegators)
```

### Key Innovations

1. **Skill-Backed Yield**: First DeFi primitive where yield comes from cognitive skill, not capital efficiency
2. **On-Chain Reputation**: Brier scores tracked on Solana, immutable and verifiable
3. **Conditional Performance**: Forecasters only earn when maintaining tier thresholds
4. **Exchange Rate Model**: Share price appreciation like liquid staking tokens
5. **Risk Alignment**: 7-day lockup + performance fees align incentives

### Smart Contract Architecture

Built with Solana Anchor framework:

- **ForecastPool**: Manages pool state, TVL, share price
- **Delegation**: Tracks delegator shares and deposits
- **PoolPrediction**: Records predictions and outcomes
- **PlatformTreasury**: Collects protocol fees

**Program ID:** `Fkb7q8pbMa4Wko4u1DYZMXBrXvq8ECFnSqze2TYMm4pM` (devnet)

---

## 🏛️ OpenClaw Agentic Architecture

BeRight is built on **OpenClaw**—an open-source architecture for composable AI agents. This enables:

### Plugin-Based System

```typescript
// Skills are composable plugins
import { registry } from './lib/plugins';

// Get all data sources
const sources = registry.getDataSources();
// → [polymarket, kalshi, manifold, limitless, metaculus]

// Get tools for specific agent
const tools = registry.getToolsForAgent('scout');
// → [market_search, arbitrage_detection, trend_analysis]
```

### Multi-Agent Coordination

```
User Request: "Find arbitrage opportunities for Trump 2028"
           ↓
    Orchestrator Agent
           ↓
    ┌──────┴──────┐
    ↓             ↓
Scout Agent   Analyst Agent
(Fast scan)   (Deep research)
    ↓             ↓
    └──────┬──────┘
           ↓
    Trader Agent
  (Position sizing)
```

### Agent Specialization

| Agent | Model | Purpose | OpenClaw Role |
|-------|-------|---------|---------------|
| **Scout** | Sonnet 4.5 | Fast market scanning, arbitrage detection | Data gatherer |
| **Analyst** | Opus 4.5 | Deep research, base rates, superforecaster analysis | Reasoning specialist |
| **Trader** | Sonnet 4.5 | Trade execution, position sizing, risk management | Executor |
| **xDegen** | Haiku | Social content generation for X/Twitter | Content creator |
| **Orchestrator** | Sonnet 4.5 | Multi-agent coordination, task routing | Coordinator |

### Decentralized Forecaster Network

BeRight creates a **permissionless network** where anyone can:

1. **Become a Forecaster**: Create a Conviction Pool with verified Brier score
2. **Contribute Data**: Add new prediction platforms via plugin system
3. **Build Agents**: Extend with custom AI agents using OpenClaw SDK
4. **Earn Yield**: Delegate to top forecasters, earn from their performance

**Network Effects:**
- More forecasters → better diversification for delegators
- More platforms → better arbitrage opportunities
- More agents → richer intelligence ecosystem
- More capital → deeper liquidity for predictions

---

## 🚀 Quick Start

### Option 1: Try Skills CLI (No Setup Required)

Test BeRight's capabilities without configuring API keys:

```bash
# Clone repository
git clone https://github.com/shivamSspirit/beright.git
cd beright && npm install

# Run skills directly
npx ts-node beright-ts/skills/markets.ts search "trump"
npx ts-node beright-ts/skills/arbitrage.ts "bitcoin"
```

> **Note:** Some features require API keys. See [Full Setup](#full-setup) below.

### Option 2: Full Local Setup (5 minutes)

For complete functionality including web dashboard and bot:

```bash
# 1. Install dependencies
npm install

# 2. Copy environment templates
cp .env.example .env
cp beright-ts/.env.example beright-ts/.env
cp berightweb/.env.example berightweb/.env.local

# 3. Add REQUIRED API keys to .env (see below)
# - ANTHROPIC_API_KEY (get from console.anthropic.com)
# - HELIUS_API_KEY (get from dev.helius.xyz)
# - SUPABASE_URL + SUPABASE_ANON_KEY (get from supabase.com)
# - NEXT_PUBLIC_PRIVY_APP_ID (get from privy.io)

# 4. Generate Solana wallet
solana-keygen new --outfile ~/.config/solana/beright-wallet.json

# 5. Start dev servers
npm run dev
```

**Verify it works:**
- Frontend: http://localhost:3000
- API: http://localhost:3001/health
- CLI: `npx ts-node beright-ts/skills/markets.ts search "bitcoin"`

---

## 📚 Documentation

### For Users
- **[Telegram Bot Commands](docs/TELEGRAM_COMMANDS.md)** - 50+ commands for market intelligence
- **[FAQ](docs/FAQ.md)** - Common questions and answers
- **[Litepaper](docs/LITEPAPER.md)** - Product vision and architecture

### For Developers
- **[Environment Setup](docs/ENVIRONMENT.md)** - Complete API key configuration guide
- **[Architecture](docs/ARCHITECTURE.md)** - Multi-agent system design
- **[API Reference](docs/API.md)** - REST endpoints and responses
- **[Skills System](docs/SKILLS.md)** - How to create new agent capabilities
- **[Smart Contracts](docs/SMART_CONTRACTS.md)** - Solana on-chain programs

### Quick Links
- [Troubleshooting](#troubleshooting)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

---

## 🎮 Usage Examples

### Use Case 1: Daily Market Intelligence

```bash
# Morning routine: get briefing
npx ts-node beright-ts/skills/brief.ts

# Output: Top 10 trending markets, arbitrage opportunities, whale movements
```

### Use Case 2: Research a Specific Market

```bash
# Deep dive with AI analysis
npx ts-node beright-ts/skills/research.ts "Will AI replace developers by 2030?"

# Get: Base rates, expert predictions, bias warnings, recommended probability
```

### Use Case 3: Monitor Arbitrage 24/7

```bash
# Start autonomous monitoring loop
npm run heartbeat

# Runs every 5 minutes, sends Telegram alerts when opportunities found
```

### Use Case 4: Track Your Predictions

```bash
# Make a prediction (commits to Solana)
npx ts-node beright-ts/skills/predict.ts "Bitcoin above 100K by Dec 2025" 0.68 YES

# Check your calibration
npx ts-node beright-ts/skills/calibration.ts

# Output: Brier score, accuracy breakdown, improvement suggestions
```

---

## 🏗️ System Architecture

> **Built on OpenClaw**: Composable, plugin-based agent architecture. See [OpenClaw section](#-openclaw-agentic-architecture) for details.

```
┌─────────────────────────────────────────────────────────────┐
│                      USER INTERFACES                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Web Dashboard│  │ Telegram Bot │  │  CLI Skills  │     │
│  │  (port 3000) │  │   (50+ cmds) │  │  (TypeScript)│     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             ▼
          ┌─────────────────────────────────────┐
          │       BeRight API (port 3001)       │
          │    Multi-Agent Orchestration        │
          │      (OpenClaw Architecture)        │
          └──────────────┬──────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌────────────┐  ┌────────────┐  ┌────────────┐
│   Scout    │  │  Analyst   │  │   Trader   │
│  (Sonnet)  │  │   (Opus)   │  │  (Sonnet)  │
│            │  │            │  │            │
│ Fast scans │  │ Deep       │  │ Position   │
│ Trends     │  │ research   │  │ sizing     │
│ Arb detect │  │ Base rates │  │ Risk mgmt  │
└────┬───────┘  └────┬───────┘  └────┬───────┘
     │               │               │
     └───────────────┼───────────────┘
                     ▼
     ┌───────────────────────────────────┐
     │         DATA LAYER                │
     ├───────────────────────────────────┤
     │ • Polymarket, Kalshi, Manifold    │
     │ • Limitless, Metaculus            │
     │ • Conviction Pools (Solana)       │
     │ • On-chain predictions (Solana)   │
     │ • Supabase (user data)            │
     │ • Redis (caching)                 │
     └───────────────────────────────────┘
```

### Multi-Agent System (OpenClaw)

| Agent | Model | Purpose | Speed |
|-------|-------|---------|-------|
| **Scout** | Sonnet 4.5 | Fast market scanning, trend detection, arbitrage | <2s |
| **Analyst** | Opus 4.5 | Deep research, superforecaster analysis | 5-15s |
| **Trader** | Sonnet 4.5 | Trade execution, position sizing, risk management | 2-5s |
| **xDegen** | Haiku | Social content generation for X/Twitter | <1s |
| **Orchestrator** | Sonnet 4.5 | Multi-agent coordination, task routing | <1s |

---

## 🔐 Environment Variables

BeRight requires **three environment files**:

1. **Root `.env`** - Shared config (database, AI, blockchain)
2. **`beright-ts/.env`** - Backend specific (Twitter API for xDegen agent)
3. **`berightweb/.env.local`** - Frontend specific (public keys only)

### Required to Run (5 keys)

```bash
# Root .env
ANTHROPIC_API_KEY=sk-ant-...              # Get from console.anthropic.com (free $5 credit)
HELIUS_API_KEY=...                        # Get from dev.helius.xyz (free tier)
SUPABASE_URL=https://....supabase.co      # Get from supabase.com (free tier)
SUPABASE_ANON_KEY=...                     # From Supabase dashboard
NEXT_PUBLIC_PRIVY_APP_ID=...              # Get from privy.io (free dev tier)

# Frontend berightweb/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Recommended for Full Features

```bash
TAVILY_API_KEY=...              # Web search (1000 calls/mo free)
UPSTASH_REDIS_REST_URL=...      # Caching (10k commands/day free)
TELEGRAM_BOT_TOKEN=...          # Bot interface (free via @BotFather)
```

### Optional (Trading & Advanced)

```bash
KALSHI_API_KEY=...              # Kalshi trading (paid)
JITO_BLOCK_ENGINE_URL=...       # MEV protection
DFLOW_API_KEY=...               # Order flow optimization
```

**📖 Full environment guide:** [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md)

---

## 🧪 Testing

### Verify Installation

```bash
# Check prerequisites
node --version        # Should be 18+
npm --version
solana --version      # Install: sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Install dependencies
npm install

# Type check
npx tsc --noEmit
```

### Test Backend API

```bash
# Start API
npm run dev:api

# Test endpoints (in another terminal)
curl http://localhost:3001/health
curl "http://localhost:3001/api/markets?q=bitcoin"
curl http://localhost:3001/api/leaderboard
```

Expected: `{"status": "ok"}` from `/health`

### Test Skills CLI

```bash
# Market search (tests aggregation)
npx ts-node beright-ts/skills/markets.ts search "trump"

# Arbitrage detection (tests multi-platform comparison)
npx ts-node beright-ts/skills/arbitrage.ts "bitcoin"

# AI research (tests Anthropic integration)
npx ts-node beright-ts/skills/research.ts "fed rate"

# Whale tracking (tests Solana integration)
npx ts-node beright-ts/skills/whale.ts scan
```

### Test Frontend

```bash
npm run dev:web
# Visit http://localhost:3000
```

### Test Telegram Bot

```bash
npm run agent
# Send /start to your bot
```

---

## 🐛 Troubleshooting

### Common Issues

<details>
<summary><strong>Module not found / Cannot find module</strong></summary>

```bash
rm -rf node_modules package-lock.json berightweb/.next
npm install
```
</details>

<details>
<summary><strong>ANTHROPIC_API_KEY is not defined</strong></summary>

- Verify `.env` file exists in root directory
- Check `ANTHROPIC_API_KEY=sk-ant-...` is set
- Restart dev server after adding keys
</details>

<details>
<summary><strong>Failed to connect to Supabase</strong></summary>

- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct
- Check Supabase project is not paused (free tier auto-pauses)
- Test: `curl https://your-project.supabase.co/rest/v1/`
</details>

<details>
<summary><strong>Helius RPC error</strong></summary>

- Verify `HELIUS_API_KEY` is set in `.env`
- Check `RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY`
- Test: `curl "https://devnet.helius-rpc.com/?api-key=YOUR_KEY" -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'`
</details>

<details>
<summary><strong>Port 3000 or 3001 already in use</strong></summary>

```bash
# Kill processes
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9

# Or use different ports
PORT=3002 npm run dev:web
PORT=3003 npm run dev:api
```
</details>

<details>
<summary><strong>Skills return "No markets found"</strong></summary>

- Check internet connection
- Verify platform APIs are accessible (Polymarket, Kalshi may rate limit)
- Try a different, more specific query
- Check `TAVILY_API_KEY` for web search features
</details>

**More help:** [GitHub Issues](https://github.com/shivamSspirit/beright/issues) • [Full troubleshooting guide](docs/TROUBLESHOOTING.md)

---

## 📁 Project Structure

```
beright/
├── beright-ts/              # Backend + AI agents (TypeScript)
│   ├── skills/              # Agent capabilities (arbitrage, research, etc.)
│   │   ├── arbitrage.ts     # Cross-platform arbitrage detection
│   │   ├── markets.ts       # Multi-platform market search
│   │   ├── research.ts      # AI superforecaster analysis
│   │   ├── whale.ts         # Wallet tracking
│   │   ├── brief.ts         # Daily intelligence briefing
│   │   └── heartbeat.ts     # Autonomous monitoring loop
│   │
│   ├── lib/                 # Core libraries
│   │   ├── dataFabric/      # Multi-platform data aggregation
│   │   ├── polymarket/      # Polymarket client
│   │   ├── kalshi/          # Kalshi client
│   │   ├── onchain/         # Solana prediction commits
│   │   ├── plugins/         # Plugin registry system
│   │   └── agents/          # Multi-agent orchestration
│   │
│   └── app/api/             # REST API endpoints (Express)
│
├── berightweb/              # Frontend (Next.js 14)
│   └── src/
│       ├── app/             # Pages (App Router)
│       │   ├── page.tsx     # Landing page
│       │   ├── dashboard/   # User dashboard
│       │   └── docs/        # Documentation pages
│       │
│       ├── components/      # React components
│       ├── hooks/           # Custom hooks (Solana, Privy, APIs)
│       └── lib/             # Frontend utilities
│
├── staking-pool/            # Solana smart contracts (Anchor)
│   └── programs/
│       └── staking-pool/    # Conviction pools (forecaster staking)
│
├── docs/                    # Documentation
│   ├── LITEPAPER.md         # Product vision
│   ├── ARCHITECTURE.md      # Technical architecture
│   ├── API.md               # API reference
│   └── ENVIRONMENT.md       # Setup guide
│
└── .env.example             # Environment template
```

---

## 🤝 Contributing

We're actively developing and welcome contributions!

### Ways to Contribute

- 🐛 **Report bugs** via [GitHub Issues](https://github.com/shivamSspirit/beright/issues)
- 💡 **Suggest features** or improvements
- 📝 **Improve documentation**
- 🔧 **Submit PRs** for bug fixes or features
- 🧪 **Add tests** for existing features
- 🌍 **Add new data sources** (new prediction platforms)

### Development Setup

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/beright.git
cd beright

# Create feature branch
git checkout -b feature/your-feature-name

# Make changes, test, commit
npm run build    # Build all packages
npm run lint     # Check code style
npx tsc --noEmit # Type check

# Push and create PR
git push origin feature/your-feature-name
```

**Contribution guidelines:** [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

Built on the shoulders of giants:

- **Prediction Platforms:** Polymarket, Kalshi, Manifold, Limitless, Metaculus
- **AI:** Anthropic Claude (Opus & Sonnet 4.5)
- **Blockchain:** Solana, Anchor Framework
- **Infrastructure:** Helius, Supabase, Upstash, Privy

---

## 📞 Support & Community

- **GitHub Issues:** [Report bugs or request features](https://github.com/shivamSspirit/beright/issues)
- **Documentation:** [Full docs](docs/)
- **Telegram:** [Join our community](https://t.me/beright_community) (coming soon)
- **Twitter:** [@BeRightAI](https://twitter.com/BeRightAI) (coming soon)

---

<p align="center">
  <strong>Stop manually checking markets. Let AI do the work.</strong><br/>
  Built for forecasters who want to be right.
</p>

<p align="center">
  Made with 🧠 by the BeRight team
</p>
