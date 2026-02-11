# BeRight Protocol — Detailed Architecture

> Comprehensive architecture document for the BeRight autonomous prediction market intelligence agent, built for the Colosseum Agent Hackathon on Solana.

---

## Table of Contents

1. [How It Works in OpenClaw](#1-how-it-works-in-openclaw)
2. [System Design & Architecture](#2-system-design--architecture)
3. [Where Data Comes From](#3-where-data-comes-from)
4. [How the Agent Accesses Data](#4-how-the-agent-accesses-data)
5. [What the Agent Does With Data](#5-what-the-agent-does-with-data)
6. [How It Processes Data & Returns Actions](#6-how-it-processes-data--returns-actions)
7. [Value to End Users](#7-value-to-end-users)
8. [How It Delivers Value](#8-how-it-delivers-value)
9. [Monetization & Can Users Pay](#9-monetization--can-users-pay)
10. [Capabilities & What It Can Provide](#10-capabilities--what-it-can-provide)
11. [Full File Map](#11-full-file-map)
12. [Data Flow Diagrams](#12-data-flow-diagrams)
13. [Environment & Deployment](#13-environment--deployment)

---

## 1. How It Works in OpenClaw

BeRight is registered as an **OpenClaw skills-based agent**. The OpenClaw/Clawdbot platform treats it as a modular skill set that can be triggered via:

- **Telegram messages** — the primary interface. Users send commands like `/arb`, `/research bitcoin`, `/whale` and the agent dispatches to the right skill.
- **Cron triggers** — the heartbeat skill runs autonomously every 5 minutes, scanning for arbitrage, whale activity, and recording price snapshots.
- **HTTP API** — Next.js API routes expose the same intelligence via REST for web dashboards.

### Agent Registration

```yaml
# agent/system.md
agent:
  type: "skills"

identity:
  name: "BeRight"
  description: "Prediction market intelligence terminal and forecasting coach"
  tone: "Direct, educational, confident but humble about uncertainty"

skills:
  - name: "telegramHandler"
    path: "./skills/telegramHandler.ts"
    trigger: "telegram"

  - name: "heartbeat"
    path: "./skills/heartbeat.ts"
    trigger: "cron"
    schedule: "*/5 * * * *"
```

### Skill Response Contract

Every skill returns a unified `SkillResponse`:

```typescript
interface SkillResponse {
  text: string;      // Markdown-formatted output
  mood?: Mood;       // BULLISH | BEARISH | NEUTRAL | ALERT | EDUCATIONAL | ERROR
  data?: unknown;    // Structured data for downstream processing
}
```

This contract means OpenClaw can render any skill's output in Telegram, web, or feed formats without special handling.

---

## 2. System Design & Architecture

### Directory Structure

```
beright-ts/
├── agent/
│   └── system.md              # Agent identity + skill registration for OpenClaw
├── skills/
│   ├── telegramHandler.ts     # Main router/dispatcher (Telegram trigger)
│   ├── markets.ts             # Unified market data (5 platforms)
│   ├── arbitrage.ts           # Cross-platform arb detection
│   ├── research.ts            # Superforecaster analysis engine
│   ├── consensus.ts           # Multi-platform probability consensus
│   ├── decisionEngine.ts      # Multi-signal scoring & action decisions
│   ├── calibration.ts         # Brier score tracking & self-tuning
│   ├── whale.ts               # Solana wallet monitoring (Helius)
│   ├── intel.ts               # News RSS + Reddit sentiment
│   ├── brief.ts               # Morning briefing generator
│   ├── heartbeat.ts           # Autonomous periodic loop (cron)
│   ├── priceTracker.ts        # 48h price history & market movers
│   ├── prices.ts              # Multi-oracle price resolution (Pyth, Jupiter, DeFi Llama)
│   ├── swap.ts                # Jupiter token swaps
│   ├── onchain.ts             # Solana memo audit logging
│   ├── rpc.ts                 # RPC cascade & failover
│   ├── metaculus.ts            # Metaculus community forecasts
│   └── utils.ts               # Shared helpers (similarity, formatting)
├── app/
│   ├── page.tsx               # Next.js web terminal UI
│   └── api/
│       ├── brief/route.ts     # Morning briefing API
│       ├── markets/route.ts   # Market search & trends API
│       ├── predictions/route.ts # Prediction CRUD API
│       ├── leaderboard/route.ts # Rankings API
│       ├── alerts/route.ts    # Alert management API
│       ├── user/route.ts      # User profile API
│       └── agent-feed/route.ts # Agent activity feed API
├── config/
│   ├── platforms.ts           # API endpoints, RSS feeds, token addresses
│   ├── thresholds.ts          # Trading limits, alert thresholds, intervals
│   └── commands.ts            # Telegram command definitions
├── types/
│   ├── market.ts              # Market, Platform, ArbitrageOpportunity
│   ├── response.ts            # SkillResponse, TelegramMessage, NewsResult
│   ├── wallet.ts              # Position, Trade, KnownWhale, HeliusTransaction
│   └── index.ts               # Re-exports
├── lib/
│   └── db.ts                  # Supabase + local file fallback
├── memory/
│   ├── predictions.json       # User predictions (Brier tracking)
│   ├── heartbeat-state.json   # Last scan timestamps & counters
│   ├── price-history.json     # 48h rolling price snapshots
│   ├── decisions.json         # On-chain audit log fallback
│   ├── whales.json            # Known whale wallets
│   ├── positions.json         # Open positions
│   └── watchlist.json         # Tracked markets
└── package.json               # Dependencies & scripts
```

### Architecture Layers

```
┌──────────────────────────────────────────────────┐
│              INTERFACE LAYER                       │
│  Telegram Bot  │  Next.js Web UI  │  REST API     │
└────────┬───────┴────────┬─────────┴──────┬────────┘
         │                │                │
┌────────▼────────────────▼────────────────▼────────┐
│              ROUTING LAYER                         │
│  telegramHandler.ts (command + keyword dispatch)   │
│  app/api/* routes (HTTP dispatch)                  │
└────────┬──────────────────────────────────────────┘
         │
┌────────▼──────────────────────────────────────────┐
│              SKILL LAYER (18 skills)               │
│  markets │ arbitrage │ research │ whale │ intel    │
│  brief │ consensus │ decisionEngine │ calibration  │
│  heartbeat │ priceTracker │ prices │ swap │ onchain│
│  rpc │ metaculus │ utils                           │
└────────┬──────────────────────────────────────────┘
         │
┌────────▼──────────────────────────────────────────┐
│              DATA LAYER                            │
│  5 Prediction Markets │ 3 Price Oracles            │
│  20+ News RSS Feeds   │ Reddit API                 │
│  Helius (Solana RPC)  │ Jupiter (Swaps)            │
└────────┬──────────────────────────────────────────┘
         │
┌────────▼──────────────────────────────────────────┐
│              STATE LAYER                           │
│  Supabase (PostgreSQL) — primary                   │
│  memory/*.json — local fallback                    │
│  Solana Memo Program — on-chain audit log          │
└───────────────────────────────────────────────────┘
```

---

## 3. Where Data Comes From

### 3.1 Prediction Market Platforms (5 sources)

| Platform     | API Base URL                                  | Auth    | Fee  | Data Type            |
|-------------|-----------------------------------------------|---------|------|----------------------|
| Polymarket  | `https://gamma-api.polymarket.com`            | None    | 0.5% | Real-money markets   |
| Kalshi      | `https://api.elections.kalshi.com/trade-api/v2`| API Key | 1%   | Real-money markets   |
| Manifold    | `https://api.manifold.markets/v0`             | None    | 0%   | Play-money markets   |
| Limitless   | `https://api.limitless.exchange`              | None    | 1%   | Real-money (crypto)  |
| Metaculus   | `https://www.metaculus.com/api2`              | None    | 0%   | Community forecasts  |

**What we fetch:** Market title, YES/NO prices (probabilities), volume, liquidity, end date, status.

### 3.2 Price Oracles (3 sources)

| Oracle       | Endpoint                                    | Data Type              |
|-------------|---------------------------------------------|------------------------|
| Pyth Hermes | `https://hermes.pyth.network/v2/updates/price/latest` | Real-time feed prices |
| Jupiter     | `https://lite-api.jup.ag/swap/v1/quote`    | Swap-derived prices    |
| DeFi Llama  | `https://coins.llama.fi/prices/current/`   | Aggregated DeFi prices |

**Tokens tracked:** SOL, BTC, ETH, USDC, USDT, BONK, JUP, WIF, PYTH

### 3.3 News Intelligence (20+ RSS feeds)

- **Wire Services:** Reuters, AP News
- **Broadcast:** BBC, CNBC
- **Financial:** Wall Street Journal, Bloomberg
- **Crypto:** CoinDesk, Decrypt, The Block
- **Political:** Politico, The Hill, FiveThirtyEight
- **Search:** Google News RSS (topic-based)

### 3.4 Social Intelligence

- **Reddit JSON API** — searches by topic, counts comments, extracts subreddit distribution, measures engagement level (LOW/MEDIUM/HIGH)

### 3.5 Blockchain Data (Solana)

- **Helius API** — wallet transaction history, token transfers, native SOL transfers
- **Solana RPC** — transaction submission, memo logging
- **RPC Providers (failover chain):** dRPC → Helius → Alchemy → Public Solana

---

## 4. How the Agent Accesses Data

### 4.1 Parallel Fetching with `Promise.allSettled`

All platform queries run in parallel. If one platform is slow or fails, the others still return:

```typescript
const results = await Promise.allSettled(
  platforms.filter(p => fetchers[p]).map(p => fetchers[p](query))
);
// Only use fulfilled results — failed platforms are silently dropped
return results
  .filter((r): r is PromiseFulfilledResult<Market[]> => r.status === 'fulfilled')
  .flatMap(r => r.value);
```

### 4.2 Per-Platform Timeouts

Each platform has a tuned timeout via `AbortSignal.timeout()`:

```typescript
const PLATFORM_TIMEOUT: Record<Platform, number> = {
  polymarket: 4000,
  kalshi: 4000,
  manifold: 4000,
  limitless: 4000,
  metaculus: 5000,  // Slower API, needs more time
};
```

### 4.3 Response Caching (30-second TTL)

In-memory cache prevents hammering APIs during rapid queries:

```typescript
const marketCache: Map<string, { data: Market[]; expiry: number }> = new Map();
const CACHE_TTL = 30_000; // 30 seconds
```

### 4.4 Multi-Oracle Price Resolution

Prices are fetched from 3 oracles simultaneously, then resolved by median:

1. Query Pyth Hermes (feed ID based)
2. Query Jupiter (1 USDC swap quote)
3. Query DeFi Llama (aggregated)
4. Return **median price** + confidence score (HIGH if 3 agree, MEDIUM if 2, LOW if 1)

### 4.5 RPC Cascade with Failover

Solana RPC calls go through a smart routing layer:

- Tracks usage per provider against free tier limits
- 1-minute cooldown after errors
- Prioritizes by free tier generosity (dRPC 10M/mo → Helius 1M/mo → Alchemy 30M/mo → Public)
- Monthly counter resets

---

## 5. What the Agent Does With Data

### 5.1 Arbitrage Detection

Compares prices for the **same question** across different platforms:

1. Fetch markets from all 5 platforms
2. Match similar markets using **title similarity** (40% sequence + 60% Jaccard, threshold 35%)
3. Calculate spread between matched markets
4. If spread > 3% after fees → flag as arbitrage opportunity
5. Evaluate two strategies per opportunity:
   - Buy YES on cheaper platform + Buy NO on more expensive platform
   - Pure spread play (simultaneous buy/sell)
6. Report profit margin and recommended action

### 5.2 Whale Tracking

Monitors known Solana wallets for significant moves:

1. Query Helius API for recent transactions per tracked wallet
2. Sum USDC transfers + SOL transfers (converted to USD via live SOL price)
3. Filter by minimum threshold ($10K)
4. Correlate with known whale accuracy scores
5. Generate alerts for significant activity

### 5.3 Price Snapshot Recording

Every 5 minutes, records prices for the top 20 markets by volume:

- Maintains 48-hour rolling window
- Enables **real 24-hour price change** calculations
- Powers "market movers" in morning briefings

### 5.4 News & Sentiment Analysis

For any topic:

1. Search Google News RSS + category-specific feeds
2. Parse articles (regex-based XML, handles CDATA)
3. Score sentiment using keyword matching (bullish/bearish word lists)
4. Search Reddit for social engagement
5. Combine into sentiment score (BULLISH / BEARISH / NEUTRAL)

### 5.5 Consensus Calculation

For any question asked across multiple platforms:

1. Cluster similar markets using title similarity
2. Calculate **liquidity-weighted average** probability
3. Apply **platform reliability weights** (Polymarket: 1.0, Kalshi: 0.9, Manifold: 0.7, etc.)
4. Measure agreement score (how close platforms are to each other)
5. Flag high disagreement as potential arbitrage signal

### 5.6 Prediction Tracking & Calibration

Users can log predictions, which are tracked for accuracy:

- **Brier Score:** `(predicted - actual)^2` — 0.0 = perfect, 0.25 = random
- **Directional Accuracy:** % of correct YES/NO calls
- **Streaks:** Win/loss streaks
- **Buckets:** Calibration analysis by probability range (e.g., "when you say 70%, it happens 68% of the time")

---

## 6. How It Processes Data & Returns Actions

### 6.1 The Decision Engine

The core decision pipeline aggregates 5 signals with weighted scoring:

```
Signal Weights:
├── Market Consensus:  35%   ← Cross-platform probability agreement
├── Arbitrage Spread:  25%   ← Price discrepancy magnitude
├── News Sentiment:    15%   ← Bullish/bearish news signal
├── Whale Movement:    15%   ← Smart money direction
└── Social Sentiment:  10%   ← Reddit/social engagement
```

**Scoring each signal:**

- **Arbitrage:** `spread_pct / 10` = base score, bonus if volume > $10K, penalty if match confidence < 0.5
- **News:** bullish = 0.8, neutral = 0.5, bearish = 0.3
- **Whale:** large move + high accuracy whale = high score
- **Social:** high engagement + consistent sentiment = higher score

**Decision thresholds:**

```
Weighted Score ≥ 70  →  EXECUTE (act on this opportunity)
Weighted Score ≥ 45  →  WATCH (monitor closely)
Weighted Score < 45  →  SKIP (not actionable)
```

### 6.2 Self-Tuning via Brier Scores

The decision engine reads historical calibration data and adjusts confidence:

- If past Brier score < 0.15 → agent is well-calibrated, maintain confidence
- If past Brier score > 0.25 → agent is poorly calibrated, reduce confidence
- Adjustments applied multiplicatively to raw confidence scores

### 6.3 On-Chain Audit Logging

Every decision is logged to Solana as a memo transaction:

```typescript
DecisionMemo = {
  v: 1,                    // Schema version
  t: "DECISION",           // Type: DECISION | PREDICTION | ARBITRAGE | HEARTBEAT
  q: "Will BTC hit 100K",  // Question (truncated to 40 chars)
  consensus: 0.65,         // Cross-platform consensus
  spread: 4.2,             // Arb spread %
  action: "EXECUTE",       // Decision taken
  conf: 78,                // Confidence score
  ts: 1770280171           // Unix timestamp
}
```

- Uses Solana **Memo Program** (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`)
- Falls back to local `memory/decisions.json` if no wallet configured
- Creates **immutable, verifiable audit trail** of all agent decisions

### 6.4 The Autonomous Loop (Heartbeat)

The heartbeat runs continuously and executes tasks on intervals:

```
Every 5 minutes:
├── Record price snapshots (top 20 markets)
├── Run arbitrage scan across all 5 platforms
│   └── For top 3 opportunities → run decision engine
│       └── Log each decision on-chain
└── Save state

Every 15 minutes:
└── Run whale scan on tracked wallets
    └── Alert if significant movement detected

Every 1 hour:
└── Check for resolved markets
    └── Update prediction outcomes + Brier scores

Every morning (6 AM):
└── Generate morning briefing
    └── Hot markets, arb opps, whale activity, calibration stats
```

---

## 7. Value to End Users

### 7.1 For Prediction Market Traders

- **Arbitrage alerts** — find price discrepancies across 5 platforms before others do
- **Cross-platform odds comparison** — see the same question priced differently
- **Whale tracking** — know what smart money is doing on Solana
- **Market movers** — real 24h price changes for trending markets

### 7.2 For Forecasters

- **Calibration tracking** — Brier scores tell you if you're actually good at predicting
- **Superforecaster methodology** — the agent teaches probabilistic thinking
- **Leaderboard** — compete with other forecasters
- **Achievement system** — gamified improvement milestones

### 7.3 For Information Consumers

- **Morning briefings** — daily digest of what matters in prediction markets
- **Research reports** — deep analysis combining markets + news + social for any topic
- **News intelligence** — aggregated from 20+ sources with sentiment analysis
- **Social pulse** — Reddit engagement and sentiment for any topic

### 7.4 For DeFi Users

- **Jupiter swap integration** — trade tokens directly from the agent
- **SOL/BTC/ETH price tracking** — multi-oracle verified prices
- **On-chain transparency** — every agent decision is verifiable on Solana

---

## 8. How It Delivers Value

### 8.1 Speed

- All platform queries run in **parallel** (`Promise.allSettled`)
- Per-platform timeouts (4-5 seconds) prevent one slow API from blocking everything
- 30-second response cache eliminates redundant API calls
- Total wall time for all 8 data sources: **~3.3 seconds**

### 8.2 Breadth

- **5 prediction platforms** = widest coverage of any prediction market tool
- **3 price oracles** = robust, manipulation-resistant pricing
- **20+ news feeds** = comprehensive news coverage
- **Reddit API** = social sentiment layer

### 8.3 Intelligence

- Not just data aggregation — the **decision engine scores opportunities** across 5 weighted signals
- **Self-calibrating** — Brier scores feed back into confidence adjustments
- **On-chain audit trail** — verifiable decision history builds trust

### 8.4 Accessibility

- **Telegram-first** — no app download, no website, just message the bot
- **Natural language** — keyword triggers in addition to slash commands
- **Web dashboard** — Next.js UI for visual exploration
- **REST API** — integrate into any workflow

### 8.5 Autonomy

- **Heartbeat loop** — scans 24/7 without user intervention
- **Alert system** — only notifies when something actionable happens
- **Self-improving** — calibration data makes the agent better over time

---

## 9. Monetization & Can Users Pay

### 9.1 Current State (Hackathon MVP)

Currently **free and open**. No payment required. The agent runs on free API tiers:

- Polymarket, Manifold, Limitless, Metaculus — free, no auth
- Kalshi — free tier with optional API key
- Helius — free tier (1M calls/month)
- Pyth, Jupiter, DeFi Llama — free, no auth
- Supabase — free tier for database

### 9.2 Monetization Paths (Post-Hackathon)

**Freemium Model:**
- **Free tier:** Basic market search, daily brief, manual arbitrage scans
- **Pro tier ($X/month):** Real-time arb alerts, whale tracking, decision engine, unlimited research reports, priority API access

**On-Chain Subscription (Solana-native):**
- SPL token gating for premium features
- Pay-per-query via micropayments
- Staking model: stake tokens to access higher tiers

**Revenue from Trading:**
- Half-Kelly position sizing is already configured (`kellyMultiplier: 0.5`)
- Agent can execute trades on behalf of users (with consent)
- Performance fees on profitable arbitrage executions
- Auto-execute threshold already coded (`autoExecute: false` — flip to enable)

**Data Products:**
- Sell aggregated prediction market intelligence via API
- Calibration-as-a-service for institutional forecasters
- Market consensus feed (liquidity-weighted cross-platform probabilities)

### 9.3 Trading Configuration (Already Built)

```typescript
TRADING: {
  maxPositionUsd: 100,       // Max per trade
  maxPortfolioUsd: 500,      // Max total exposure
  defaultSlippage: 3%,       // Slippage tolerance
  kellyMultiplier: 0.5,      // Half-Kelly sizing
  autoExecute: false,        // Manual approval required
}
```

---

## 10. Capabilities & What It Can Provide

### 10.1 Market Intelligence

| Capability | Command | Description |
|-----------|---------|-------------|
| Market Search | `/hot`, keyword search | Find trending markets across 5 platforms |
| Odds Comparison | `/research <topic>` | Compare probabilities for the same event |
| Arbitrage Detection | `/arb [topic]` | Find profitable price discrepancies |
| Market Movers | Morning brief | 24h price change tracking for top markets |

### 10.2 Forecasting Tools

| Capability | Command | Description |
|-----------|---------|-------------|
| Make Predictions | `/predict <q> <prob> YES/NO` | Log a probabilistic forecast |
| Calibration Report | `/calibration` | Brier score, accuracy, streaks |
| Leaderboard | `/leaderboard` | Rank against other forecasters |
| User Stats | `/me` | Personal forecasting performance |

### 10.3 News & Social

| Capability | Command | Description |
|-----------|---------|-------------|
| News Search | `/news <topic>` | Aggregated from 20+ RSS feeds |
| Intel Report | `/intel <topic>` | News + Reddit + sentiment combined |
| Reddit Sentiment | Part of research | Engagement level, top subreddits |

### 10.4 Blockchain & Trading

| Capability | Command | Description |
|-----------|---------|-------------|
| Whale Tracking | `/whale` | Monitor Solana whale wallets |
| Token Prices | Part of whale/swap | Multi-oracle verified prices |
| Jupiter Swaps | `/swap <amt> <from> <to>` | Execute token swaps |
| On-Chain Audit | Automatic | Every decision logged to Solana |

### 10.5 Autonomous Agent

| Capability | Trigger | Description |
|-----------|---------|-------------|
| Heartbeat Loop | Cron (5 min) | Continuous market scanning |
| Arb Alerts | Autonomous | Notify when spread > 3% found |
| Whale Alerts | Autonomous | Notify on large Solana movements |
| Morning Brief | `/brief` or daily cron | Complete daily intelligence digest |
| Decision Engine | Autonomous | Score and rank opportunities |
| Self-Calibration | On resolution | Adjust confidence via Brier scores |

### 10.6 Things It Can Provide (Summary)

1. **Real-time arbitrage opportunities** across 5 prediction platforms
2. **Cross-platform consensus probabilities** with confidence scores
3. **Whale movement alerts** on Solana with USD values
4. **Multi-signal decision scores** (EXECUTE / WATCH / SKIP)
5. **News aggregation & sentiment** from 20+ sources
6. **Reddit social pulse** for any topic
7. **Morning intelligence briefings** with market movers
8. **Prediction tracking** with Brier score calibration
9. **Forecaster leaderboards** and achievement systems
10. **Jupiter token swaps** directly from the agent
11. **Verifiable on-chain audit trail** of all agent decisions
12. **48-hour price history** with real 24h change calculations
13. **Multi-oracle verified prices** for SOL, BTC, ETH, and more
14. **Superforecaster methodology coaching** through calibration feedback

---

## 11. Full File Map

### Skills (18 files)

| File | Main Export | Data Sources | Purpose |
|------|------------|-------------|---------|
| `telegramHandler.ts` | `handleMessage()` | All skills | Routes commands to skills |
| `markets.ts` | `searchMarkets()`, `getHotMarkets()` | 5 platforms | Unified market data |
| `arbitrage.ts` | `arbitrage()`, `scanAll()` | markets.ts | Cross-platform arb detection |
| `research.ts` | `research()` | markets + intel + consensus | Deep analysis reports |
| `consensus.ts` | `getConsensus()` | markets.ts | Liquidity-weighted consensus |
| `decisionEngine.ts` | `decide()` | All signals | Multi-signal scoring |
| `calibration.ts` | `addPrediction()`, `getCalibrationStats()` | Local predictions | Brier score tracking |
| `whale.ts` | `whaleWatch()` | Helius API + prices.ts | Solana whale monitoring |
| `intel.ts` | `newsSearch()`, `intelReport()` | RSS feeds + Reddit | News & social intelligence |
| `brief.ts` | `generateMorningBrief()` | All skills | Daily intelligence digest |
| `heartbeat.ts` | `heartbeatLoop()`, `heartbeatOnce()` | All skills | Autonomous agent loop |
| `priceTracker.ts` | `recordSnapshot()`, `getMarketMovers()` | markets.ts | 48h price history |
| `prices.ts` | `getSolPrice()`, `getTokenPrice()` | 3 oracles | Multi-oracle pricing |
| `swap.ts` | `getQuote()`, `executeSwap()` | Jupiter API | Token swaps |
| `onchain.ts` | `logHeartbeat()`, `logDecision()` | Solana RPC | Memo audit logging |
| `rpc.ts` | `getConnection()`, `withFailover()` | 4 RPC providers | Smart RPC routing |
| `metaculus.ts` | `fetchMetaculus()` | Metaculus API | Community forecasts |
| `utils.ts` | `calculateSimilarity()`, formatting | N/A | Shared helpers |

### API Routes (7 endpoints)

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/brief` | GET | Morning briefing (web/telegram/text format) |
| `/api/markets` | GET | Market search, hot markets, odds comparison |
| `/api/predictions` | GET, POST | Create and list predictions |
| `/api/leaderboard` | GET | Forecaster rankings |
| `/api/alerts` | GET, POST | Alert management + on-demand arb scan |
| `/api/user` | GET, POST, PATCH | User profile & settings |
| `/api/agent-feed` | GET | Agent activity log |

### State Files (7 files in `memory/`)

| File | Purpose | Updated By |
|------|---------|-----------|
| `predictions.json` | User predictions for Brier tracking | calibration.ts |
| `heartbeat-state.json` | Last scan timestamps & counters | heartbeat.ts |
| `price-history.json` | 48h rolling price snapshots | priceTracker.ts |
| `decisions.json` | On-chain audit log fallback | onchain.ts |
| `whales.json` | Tracked whale wallet addresses | whale.ts |
| `positions.json` | Open trading positions | (future) |
| `watchlist.json` | Markets being monitored | (future) |

---

## 12. Data Flow Diagrams

### Telegram Command Flow

```
User Message
    │
    ▼
telegramHandler.ts
    │
    ├─ /brief ──────► brief.ts ──────┬─ markets.ts (hot markets)
    │                                ├─ arbitrage.ts (top arb)
    │                                ├─ whale.ts (recent activity)
    │                                ├─ calibration.ts (user stats)
    │                                └─ priceTracker.ts (24h movers)
    │
    ├─ /arb ────────► arbitrage.ts ──┬─ markets.ts (all 5 platforms)
    │                                └─ utils.ts (similarity matching)
    │
    ├─ /research ───► research.ts ───┬─ markets.ts (market data)
    │                                ├─ intel.ts (news + reddit)
    │                                └─ consensus.ts (cross-platform)
    │
    ├─ /whale ──────► whale.ts ──────┬─ Helius API (transactions)
    │                                └─ prices.ts (SOL price)
    │
    ├─ /predict ────► calibration.ts ─── memory/predictions.json
    │
    ├─ /swap ───────► swap.ts ───────── Jupiter lite-api
    │
    └─ /news ───────► intel.ts ──────── 20+ RSS feeds + Reddit API
```

### Autonomous Heartbeat Flow

```
heartbeatLoop() [every 60s cycle]
    │
    ▼
heartbeatOnce()
    │
    ├─ 1. runPriceSnapshot() ──── markets.ts → memory/price-history.json
    │     (if 5 min since last)
    │
    ├─ 2. runArbScan() ───────── arbitrage.ts (all 5 platforms)
    │     (if 5 min since last)     │
    │                               ├─ For top 3 opportunities:
    │                               │   └─ decisionEngine.decide()
    │                               │       └─ EXECUTE / WATCH / SKIP
    │                               └─ Log each decision
    │
    ├─ 3. runWhaleScan() ─────── whale.ts → Helius API
    │     (if 15 min since last)
    │
    └─ 4. logHeartbeat() ─────── onchain.ts → Solana Memo Program
                                     │
                                     └─ Fallback: memory/decisions.json
```

### Decision Engine Pipeline

```
DecisionInput (topic + opportunity data)
    │
    ▼
┌───────────────────────────────────┐
│         SIGNAL COLLECTION          │
├──────────────────┬────────────────┤
│ Market Consensus │ 35% weight     │  ← consensus.ts
│ Arbitrage Spread │ 25% weight     │  ← arbitrage.ts
│ News Sentiment   │ 15% weight     │  ← intel.ts
│ Whale Movement   │ 15% weight     │  ← whale.ts
│ Social Sentiment │ 10% weight     │  ← intel.ts (reddit)
└──────────┬───────┴────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│        CONFIDENCE SCORING         │
│  Raw Score = Σ(signal * weight)   │
│  Adjusted = Raw * Brier modifier  │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│        DECISION OUTPUT            │
│  ≥ 70 → EXECUTE                   │
│  ≥ 45 → WATCH                     │
│  < 45 → SKIP                      │
└──────────┬───────────────────────┘
           │
           ▼
    onchain.ts → Solana Memo
```

---

## 13. Environment & Deployment

### Required Environment Variables

```bash
# Solana RPC (required for whale tracking & on-chain logging)
HELIUS_API_KEY=                    # Helius free tier (1M calls/mo)

# Optional RPC Providers (failover)
DRPC_API_KEY=                      # dRPC (10M calls/mo - most generous)
ALCHEMY_API_KEY=                   # Alchemy (30M calls/mo)

# On-Chain Logging (optional)
AGENT_WALLET_PRIVATE_KEY=          # Solana keypair for memo txns

# Database (optional — falls back to local JSON files)
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Telegram Bot (production)
TELEGRAM_BOT_TOKEN=

# Kalshi (optional, for Kalshi-specific data)
KALSHI_API_KEY=
```

### Run Commands

```bash
# Install
npm install

# Development
npm run dev                           # Next.js dev server

# Agent Loop
npx ts-node skills/heartbeat.ts loop 60    # Run agent (60s intervals)
npx ts-node skills/heartbeat.ts once       # Single scan
npx ts-node skills/heartbeat.ts stats      # View agent stats

# Individual Skills
npx ts-node skills/markets.ts search "bitcoin"
npx ts-node skills/arbitrage.ts "fed rate"
npx ts-node skills/research.ts "trump 2028"
npx ts-node skills/whale.ts scan
npx ts-node skills/intel.ts news "crypto"

# Build
npm run build
```

### Dependencies

**Core:** Next.js 14, React 18, TypeScript 5.6
**Solana:** @solana/web3.js 1.95, bs58 5.0
**Data:** @supabase/supabase-js 2.94, xml2js 0.6
**Runtime:** Node.js >= 18 (for native fetch, AbortSignal.timeout)

---

*Generated for the Colosseum Agent Hackathon — BeRight Protocol on Solana*
