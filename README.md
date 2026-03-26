<p align="center">
  <img src="berightweb/public/logo.jpg" alt="BeRight Logo" width="200" />
</p>

<h1 align="center">BeRight</h1>

<p align="center">
  <strong>Autonomous AI agents for prediction markets</strong><br/>
  Aggregate data from 5+ platforms, detect arbitrage, and get superforecaster-grade analysis—automatically.
</p>

<p align="center">
  <a href="#quick-demo">Demo</a> •
  <a href="#features">Features</a> •
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

BeRight is a **multi-agent AI system** that monitors prediction markets 24/7. Instead of manually checking Polymarket, Kalshi, Manifold, Limitless, and Metaculus, BeRight does it for you—finding opportunities, tracking whale wallets, and providing research-backed forecasts.

**The Problem:** Prediction market traders spend hours monitoring multiple platforms, missing arbitrage opportunities, and making poorly-calibrated predictions.

**The Solution:** Autonomous AI agents that aggregate data, detect opportunities, verify predictions on-chain, and improve your forecasting accuracy over time.

---

## 🚀 Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| **Multi-platform aggregation** | ✅ Production | Search 5 platforms in one query |
| **Arbitrage detection** | ✅ Production | Real-time price monitoring |
| **AI research agent** | ✅ Production | Claude-powered superforecaster analysis |
| **On-chain prediction commits** | ✅ Production | Solana verification system |
| **Web dashboard** | 🟡 Beta | UI showcase (read-only) |
| **Trade execution** | 🔴 Development | Coming soon |
| **Telegram bot** | ✅ Production | 50+ commands available |

> **Note:** Trading execution is not yet enabled. Current version focuses on intelligence gathering and prediction tracking.

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

**Blockchain**
- Solana Web3.js
- Anchor Framework
- Helius RPC
- On-chain memo program

</td>
</tr>
<tr>
<td>

**AI/ML**
- Anthropic Claude (Opus/Sonnet)
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

## 🏗️ Architecture

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
     │ • Solana (on-chain verification)  │
     │ • Supabase (user data)            │
     │ • Redis (caching)                 │
     └───────────────────────────────────┘
```

### Multi-Agent System

| Agent | Model | Purpose | Speed |
|-------|-------|---------|-------|
| **Scout** | Sonnet 4.5 | Fast market scanning, trend detection, arbitrage | <2s |
| **Analyst** | Opus 4.5 | Deep research, superforecaster analysis | 5-15s |
| **Trader** | Sonnet 4.5 | Trade execution, position sizing, risk management | 2-5s |
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
