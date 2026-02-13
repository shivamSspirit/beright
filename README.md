<p align="center">
  <img src="berightweb/public/logo.jpg" alt="BeRight Logo" width="200" />
</p>

<h1 align="center">BeRight</h1>

<p align="center">
  <strong>Your AI-powered edge in prediction markets</strong><br/>
  Autonomous market intelligence that runs 24/7 so you don't have to.
</p>

<p align="center">
  <em>Currently in Beta</em>
</p>

---

## What is BeRight?

BeRight is an autonomous AI agent platform for prediction markets. It aggregates data from 5 major platforms, detects arbitrage opportunities, tracks whale movements, and provides superforecaster-grade analysis — all automatically.

**Stop manually checking markets. Let AI do the work.**

## Key Features

| Feature | What it does |
|---------|--------------|
| **Multi-Platform Aggregation** | Search markets across Polymarket, Kalshi, Manifold, Limitless, Metaculus in one query |
| **Arbitrage Detection** | Auto-scan for price discrepancies across platforms |
| **Whale Tracking** | Monitor Solana wallets of top traders |
| **Superforecaster Analysis** | Deep research with base rates, contrarian views, and calibrated predictions |
| **On-Chain Verification** | Every prediction committed to Solana for verifiable track record |
| **24/7 Autonomous Loop** | Heartbeat agent scans markets every 5 minutes |

## Quick Start

```bash
# Clone and install
git clone https://github.com/your-org/beright.git
cd beright && npm install

# Configure environment
cp .env.example .env  # Add your API keys

# Run everything
npm run dev
```

**That's it.** Frontend at `localhost:3000`, API at `localhost:3001`.

## Using the Skills (CLI)

Run any skill directly from terminal:

```bash
# Search markets
npx ts-node beright-ts/skills/markets.ts search "bitcoin halving"

# Find arbitrage opportunities
npx ts-node beright-ts/skills/arbitrage.ts "fed rate cut"

# Deep research on a topic
npx ts-node beright-ts/skills/research.ts "trump 2028"

# Scan whale wallets
npx ts-node beright-ts/skills/whale.ts scan

# Get market intel/news
npx ts-node beright-ts/skills/intel.ts news "crypto regulation"

# Run autonomous loop (scans every 5 min)
npx ts-node beright-ts/skills/heartbeat.ts loop 300
```

## Integrate Your Own Agent

BeRight exposes a skill-based API. Each skill returns a consistent format:

```typescript
interface SkillResponse {
  text: string;      // Markdown response
  mood?: Mood;       // BULLISH | BEARISH | NEUTRAL | ALERT | EDUCATIONAL | ERROR
  data?: unknown;    // Structured data for your agent to process
}
```

### REST API Endpoints

```
GET  /api/markets?q=bitcoin       # Search all platforms
GET  /api/arbitrage?q=fed+rate    # Find arbitrage
GET  /api/research?q=topic        # Superforecaster analysis
GET  /api/whale                   # Whale wallet data
GET  /api/leaderboard             # Top forecasters
POST /api/predict                 # Submit prediction (on-chain)
```

### Example: Connect Your Agent

```typescript
// Your agent can call BeRight's API
const response = await fetch('http://localhost:3001/api/markets?q=bitcoin');
const { data } = await response.json();

// Process markets from all 5 platforms
for (const market of data.markets) {
  console.log(`${market.platform}: ${market.title} @ ${market.probability}%`);
}
```

### Telegram Bot Integration

Deploy your own BeRight bot with 30+ commands:
- `/search <query>` - Search markets
- `/arb <query>` - Find arbitrage
- `/research <query>` - Deep analysis
- `/whale` - Track whales
- `/brief` - Daily market summary

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Your Agent    │────▶│   BeRight API   │
│  (or Telegram)  │     │   (port 3001)   │
└─────────────────┘     └────────┬────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
┌───────────────┐    ┌───────────────────┐    ┌──────────────────┐
│  5 Platforms  │    │  Multi-Agent AI   │    │  Solana On-Chain │
│  Polymarket   │    │  Scout (Sonnet)   │    │  Memo Commits    │
│  Kalshi       │    │  Analyst (Opus)   │    │  Verification    │
│  Manifold     │    │  Trader (Sonnet)  │    └──────────────────┘
│  Limitless    │    └───────────────────┘
│  Metaculus    │
└───────────────┘
```

## Why BeRight?

1. **Aggregate** - One query searches 5 platforms. No more tab switching.
2. **Automate** - 24/7 scanning for opportunities you'd miss.
3. **Verify** - On-chain prediction commits create an immutable track record.
4. **Calibrate** - Brier scores track your accuracy over time.
5. **Scale** - Multi-agent system handles research, trading signals, and alerts.

## Environment Variables

Required in `.env`:

```bash
# Database
SUPABASE_URL=
SUPABASE_ANON_KEY=

# AI
ANTHROPIC_API_KEY=

# Blockchain
HELIUS_API_KEY=
SOLANA_PRIVATE_KEY=

# Bot (optional)
TELEGRAM_BOT_TOKEN=

# Frontend
NEXT_PUBLIC_PRIVY_APP_ID=
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Project Structure

```
beright/
├── beright-ts/          # Backend + AI agents (port 3001)
│   ├── skills/          # Core capabilities
│   ├── lib/             # Platform clients, Solana, DB
│   └── app/api/         # REST endpoints
└── berightweb/          # Frontend dashboard (port 3000)
    └── src/app/         # Next.js pages
```

## Contributing

We're in beta and actively developing. Issues and PRs welcome.

```bash
npm run build   # Build all
npm run lint    # Check code
npm test        # Run tests
```

---

<p align="center">
  <strong>Built for forecasters who want to be right.</strong><br/>
  <a href="https://github.com/your-org/beright/issues">Report Bug</a> ·
  <a href="https://github.com/your-org/beright/issues">Request Feature</a>
</p>
