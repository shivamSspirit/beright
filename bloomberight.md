# BloomBeRight: The Bloomberg for Prediction Markets

> **Vision**: BeRight is the intelligence and capital infrastructure layer for prediction markets — combining the data terminal model of Bloomberg/aixbt with a forecaster-capitalist bridge that unlocks value for both sides.

---

## Table of Contents

1. [The Vision](#the-vision)
2. [Learning from aixbt](#learning-from-aixbt)
3. [Core Concepts Mapped to Prediction Markets](#core-concepts-mapped-to-prediction-markets)
4. [BeRight Signal Types](#beright-signal-types)
5. [BeRight Terminal Features](#beright-terminal-features)
6. [The Forecaster-Capital Bridge](#the-forecaster-capital-bridge)
7. [Competitive Landscape](#competitive-landscape)
8. [BeRight's Competitive Advantages](#berights-competitive-advantages)
9. [Current State vs Target State](#current-state-vs-target-state)
10. [Product Roadmap](#product-roadmap)
11. [Monetization Model](#monetization-model)
12. [Technical Architecture](#technical-architecture)

---

## The Vision

### One-Liner
> **aixbt** surfaces emerging crypto trends before mainstream.
> **BeRight** surfaces prediction market alpha before consensus — and connects forecasters with capital.

### The Two-Sided Problem

```
┌─────────────────────────────────────────────────────────────────┐
│                    THE PREDICTION MARKET GAP                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   FORECASTERS                           CAPITALISTS              │
│   ───────────                           ───────────              │
│   ✅ Domain expertise                   ✅ Capital ($10k-$10M+)  │
│   ✅ Research skills                    ✅ Risk tolerance        │
│   ✅ Calibration discipline             ✅ Want alpha/returns    │
│   ✅ Track record (maybe)               ❌ No time to research   │
│   ❌ Limited capital ($100-$1k)         ❌ No forecasting skill  │
│   ❌ Can't size bets properly           ❌ Don't know who to     │
│   ❌ High opportunity cost                 trust                 │
│                                                                  │
│                         🚫 NO BRIDGE 🚫                          │
│                                                                  │
│   Result: Alpha left on the table by both sides                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### BeRight's Position

BeRight solves BOTH problems:
1. **Intelligence Layer** (like Bloomberg/aixbt) — Aggregate, analyze, surface alpha
2. **Capital Bridge** (like Numerai/prop trading) — Connect skilled forecasters with capital

---

## Learning from aixbt

### What is aixbt?

aixbt is the "Bloomberg for crypto" — a real-time market intelligence platform analyzing social signals and on-chain data to surface emerging trends before mainstream awareness.

### aixbt's Three Products

| Product | Description |
|---------|-------------|
| **Agent** | Autonomous X (Twitter) account sharing market analysis, engaging with community |
| **Terminal** | Analytics dashboard for trending projects, momentum tracking, sentiment analysis |
| **API** | REST interface for developers to build on aixbt's intelligence layer |

### aixbt's Core Concepts

| Concept | Description |
|---------|-------------|
| **Projects** | Foundational unit — tokens, protocols, pre-launch ventures, NFTs, narratives |
| **Signals** | Discrete, verified events — launches, listings, partnerships, funding, metrics |
| **Clusters** | Social graph analysis grouping X accounts into independent communities |
| **Momentum Score** | Rate at which new clusters begin discussing a project — cross-cluster convergence |

### Key Insight: Cross-Cluster Convergence

> "Activity within isolated clusters carries less weight than when multiple unconnected clusters independently start discussing the same project."

This creates an **early-warning system** for shifting narratives.

---

## Core Concepts Mapped to Prediction Markets

| aixbt (Crypto) | BeRight (Prediction Markets) |
|----------------|------------------------------|
| **Projects** (tokens, protocols) | **Markets** (questions, events, topics) |
| **Signals** (launches, listings, hacks) | **Market Signals** (new markets, volume spikes, resolution events, whale bets, odds shifts) |
| **Clusters** (social graph communities) | **Forecaster Clusters** (superforecasters, traders, domain experts, degens) |
| **Momentum Score** (cross-cluster convergence) | **Conviction Score** (when multiple forecaster types agree) |
| **Terminal** | **BeRight Terminal** |
| **Agent (X/Twitter)** | **BeRight Agent (Telegram + X)** |
| **API** | **BeRight API** |

### BeRight's Unique Addition: Forecaster Clusters

Unlike crypto (where you track social communities), prediction markets have **forecaster archetypes**:

| Cluster | Description | Signal Value |
|---------|-------------|--------------|
| **Superforecasters** | Brier < 0.15, 100+ predictions, academically calibrated | Highest |
| **Domain Experts** | Specialists (politics wonks, crypto traders, sports analysts) | High in domain |
| **Whale Traders** | >$100k position sizes, skin in the game | High (money talks) |
| **Sharp Money** | Consistently profitable across platforms | High |
| **Contrarians** | Systematically bet against consensus | Signal for reversals |
| **Retail Consensus** | Aggregate of small positions | Fade indicator |

### The Conviction Score

> When superforecasters, domain experts, AND whale traders all converge on the same position — that's a high-conviction signal.

```
CONVICTION SCORE = f(
  superforecaster_consensus,
  domain_expert_consensus,
  whale_position_direction,
  sharp_money_direction,
  cross_platform_agreement
)
```

---

## BeRight Signal Types

### 11 Signal Categories (Mapped from aixbt)

| # | Signal Type | Description | Example |
|---|-------------|-------------|---------|
| 1 | **New Market** | High-profile market creation | "Trump 2028 market launches on Polymarket" |
| 2 | **Volume Surge** | Unusual trading activity | "Ukraine market sees 10x normal volume" |
| 3 | **Odds Shift** | Significant probability movement | "Harris drops 15% in 4 hours" |
| 4 | **Whale Entry** | Large position detected | "Whale bets $500k YES on Fed rate cut" |
| 5 | **Smart Money Move** | Top-calibrated forecaster action | "3 superforecasters all predict NO" |
| 6 | **Arbitrage Opportunity** | Cross-platform mispricing | "5% spread on identical market Kalshi vs Polymarket" |
| 7 | **Resolution Imminent** | Market approaching resolution | "CPI announcement in 2 hours, market at 72%" |
| 8 | **Consensus Flip** | Majority view reversal | "Market flips from 60% YES to 40% YES" |
| 9 | **Narrative Emergence** | New topic cluster forming | "AI regulation markets surging across platforms" |
| 10 | **Cross-Market Signal** | Correlated markets diverging | "Biden approval up but re-election odds down" |
| 11 | **Insider Pattern** | Unusual pre-event activity | "Anomalous volume 2 hours before announcement" |

### What Doesn't Become a Signal

- General speculation without evidence
- Vague hype or predictions
- Duplicate events (reinforced instead)
- Low-volume noise

---

## BeRight Terminal Features

### 1. Markets Browser (like aixbt Projects)

- All markets across Polymarket, Kalshi, Manifold, Metaculus, Limitless
- Filterable by category (Politics, Crypto, Sports, Economics, Tech)
- Sortable by volume, momentum, time-to-resolution
- Market cards showing: current odds, volume, forecaster consensus, platform

### 2. Signals Feed (like aixbt Signals)

- Real-time chronological feed of verified market events
- Filter by signal type, category, platform
- "Hot Only" toggle for high-impact signals
- Reinforcement when multiple sources confirm same signal

### 3. Momentum Graph (like aixbt Momentum)

- Track how "attention" flows to markets over time
- Early warning when markets start gaining traction
- Cross-platform volume aggregation
- Predict which markets will go viral

### 4. Forecaster Clusters

- **Superforecasters** (Brier < 0.15, 100+ predictions)
- **Domain Experts** (specialists in politics, crypto, sports)
- **Whale Traders** (>$100k position sizes)
- **Sharp Money** (consistently profitable)
- **Retail Consensus** (aggregate small positions)

### 5. Conviction Score

- Measures cross-cluster agreement
- High score = multiple forecaster types agree
- Surface opportunities where smart money disagrees with market

### 6. Chat Interface

- "What's the superforecaster consensus on Trump 2028?"
- "Show me markets where whales disagree with odds"
- "Find arbitrage opportunities above 3%"
- "What markets resolve this week with high volume?"

### 7. Automated Tasks (like aixbt Tasks)

| Task Type | Description |
|-----------|-------------|
| **Reports** | Daily market digest, weekly alpha roundup, custom prompts |
| **Watchlists** | Track specific markets with instant alerts |
| **Observers** | System-wide alerts (new whale bets, consensus flips) |

---

## The Forecaster-Capital Bridge

### The Core Innovation

> **BeRight connects verified forecasters with capital allocators — creating the first talent marketplace for prediction markets where skill meets capital and both win.**

### Traditional Finance Analogies

| Industry | Problem | Solution |
|----------|---------|----------|
| **Hedge Funds** | Smart analysts, no capital | LPs invest in funds, managers allocate |
| **eToro** | Retail traders copy experts | Copy trading with revenue share |
| **Numerai** | Data scientists, no trading capital | Tournament → capital allocation |
| **a16z Scouts** | Founders know deals, no check size | Scout program with carry |
| **Prop Trading** | Traders have skill, no capital | Firm provides capital, splits profits |

**No one has built this for prediction markets.**

### BeRight Vaults System

```
┌─────────────────────────────────────────────────────────────────┐
│                      BERIGHT VAULT SYSTEM                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. FORECASTERS                                                  │
│     ┌──────────────────────────────────────────┐                │
│     │ • Build verified track record on BeRight │                │
│     │ • On-chain prediction commits (Solana)   │                │
│     │ • Brier score + calibration curves       │                │
│     │ • Domain specialization badges           │                │
│     │ • Public prediction history              │                │
│     └──────────────────────────────────────────┘                │
│                           ↓                                      │
│  2. VAULT CREATION                                               │
│     ┌──────────────────────────────────────────┐                │
│     │ • Top forecasters can create "Vaults"    │                │
│     │ • Set strategy (politics, crypto, macro) │                │
│     │ • Define fee structure (2/20, etc.)      │                │
│     │ • Set risk parameters                    │                │
│     └──────────────────────────────────────────┘                │
│                           ↓                                      │
│  3. CAPITAL ALLOCATION                                           │
│     ┌──────────────────────────────────────────┐                │
│     │ • Capitalists browse vault leaderboard   │                │
│     │ • See verified returns, Brier, Sharpe    │                │
│     │ • Deposit USDC into chosen vaults        │                │
│     │ • Set personal risk limits               │                │
│     └──────────────────────────────────────────┘                │
│                           ↓                                      │
│  4. EXECUTION                                                    │
│     ┌──────────────────────────────────────────┐                │
│     │ • Forecaster signals positions           │                │
│     │ • Vault auto-executes on Polymarket/     │                │
│     │   Kalshi/DFlow                           │                │
│     │ • Position sizing based on conviction    │                │
│     │ • Risk limits enforced automatically     │                │
│     └──────────────────────────────────────────┘                │
│                           ↓                                      │
│  5. PROFIT SHARING                                               │
│     ┌──────────────────────────────────────────┐                │
│     │ • Profits split per vault terms          │                │
│     │ • Forecaster earns carry (e.g., 20%)     │                │
│     │ • Capitalist earns returns (e.g., 80%)   │                │
│     │ • BeRight takes platform fee (e.g., 5%)  │                │
│     └──────────────────────────────────────────┘                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Vault Types

| Vault Type | Description | Risk Level |
|------------|-------------|------------|
| **Index Vault** | Auto-follows top 10 forecasters equally | Low |
| **Domain Vault** | Single forecaster, specific domain (e.g., "Jane's Politics Vault") | Medium |
| **Alpha Vault** | High-conviction concentrated bets | High |
| **Arb Vault** | Auto-executes arbitrage opportunities | Low |
| **Contrarian Vault** | Bets against market consensus when forecasters disagree | High |

### Profit Distribution

```
                    PROFIT DISTRIBUTION

  ┌─────────────────────────────────────────────────┐
  │                                                 │
  │   $100 Profit from Vault                        │
  │                                                 │
  │   ┌─────────────────────────────────────────┐   │
  │   │  Capitalist (LP)           75% = $75   │   │
  │   ├─────────────────────────────────────────┤   │
  │   │  Forecaster (GP)           20% = $20   │   │
  │   ├─────────────────────────────────────────┤   │
  │   │  BeRight Protocol           5% = $5    │   │
  │   └─────────────────────────────────────────┘   │
  │                                                 │
  └─────────────────────────────────────────────────┘
```

### Verified Forecaster Profile

```
┌─────────────────────────────────────────────────────┐
│  @superforecaster_jane                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│                                                     │
│  🎯 Brier Score: 0.12 (Top 2%)                     │
│  📊 342 verified predictions                        │
│  💰 Hypothetical ROI: +47% (if max-bet strategy)   │
│  🏆 Rank: #7 Global                                │
│                                                     │
│  DOMAIN EXPERTISE                                   │
│  ┌─────────┬─────────┬─────────┐                   │
│  │Politics │ Crypto  │ Macro   │                   │
│  │ ⭐⭐⭐⭐⭐ │ ⭐⭐⭐    │ ⭐⭐⭐⭐   │                   │
│  │ Brier:  │ Brier:  │ Brier:  │                   │
│  │ 0.09    │ 0.18    │ 0.11    │                   │
│  └─────────┴─────────┴─────────┘                   │
│                                                     │
│  CALIBRATION CURVE          ON-CHAIN VERIFIED      │
│  ┌────────────────┐         ✅ 342 Solana commits  │
│  │    ·  ·        │         ✅ All timestamps      │
│  │  ·    ·        │            verifiable          │
│  │·        ·      │         ✅ Cannot be faked     │
│  └────────────────┘                                │
│   0%    50%   100%                                 │
│                                                     │
│  [📈 VIEW VAULT]  [📋 FULL HISTORY]  [🔔 FOLLOW]  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Competitive Landscape

### Direct "Bloomberg for Prediction Markets" Competitors

| Competitor | Positioning | Platforms | Key Features | Pricing | Weakness |
|------------|-------------|-----------|--------------|---------|----------|
| **[Oddpool](https://oddpool.com)** | "The Bloomberg for prediction markets" | Polymarket, Kalshi, CME | Arbitrage scanner, Whale tracking, Volume dashboard, 40+ dashboards | Free + $30/mo Pro | No AI, No forecaster tracking, No Telegram |
| **[Verso](https://polymark.et/product/verso)** | YC-backed institutional terminal | Polymarket, Kalshi | AI news engine (73% accuracy), Advanced screener, 15k+ contracts | Beta | No API, No whale tracking, No calibration |
| **[Converge](https://docs.converge.market)** | First aggregator terminal | Polymarket, Kalshi, Limitless | Cross-platform trading, Zero fees, Arbitrage detection | Free (beta) | No intelligence, Trading-only |
| **[Unusual Predictions](https://unusualwhales.com/predictions)** | Insider radar (Unusual Whales) | Polymarket | Insider detection, Z-score analysis, Smart Money | Pro subscription | Single platform, No AI research |

### API/Infrastructure Competitors

| Competitor | Backing | What They Do | Status |
|------------|---------|--------------|--------|
| **[Dome](https://ycombinator.com/companies/dome)** | YC F25, Ex-Alchemy founders | Unified API across platforms | 50+ developers |
| **[PolyRouter](https://polyrouter.io)** | — | Unified API + MCP server | Active |
| **[FinFeedAPI](https://finfeedapi.com)** | — | Historical + live data API | Active |

### Analytics & Intelligence Competitors

| Competitor | Focus | Platforms |
|------------|-------|-----------|
| **[Prediedge](https://prediedge.com)** | Whale tracking, Insider detection | Polymarket, Kalshi |
| **[Polymarket Analytics](https://polymarketanalytics.com)** | Market search, Trade alerts | Polymarket, Kalshi, Limitless |
| **[Hashdive](https://hashdive.com)** | Smart Scores | Polymarket |

### Signal & Alert Competitors

| Competitor | Delivery | Features |
|------------|----------|----------|
| **YN Signals** | Telegram | 24/7 signals, New markets, Odds anomalies |
| **PolyAlertHub** | Telegram/Email | Whale tracking, AI analytics |
| **alerts.chat** | Telegram | Price action alerts |

### AI Agent Competitors

| Competitor | Approach |
|------------|----------|
| **Polyseer** | Open-source multi-agent, Bayesian aggregation |
| **Jatevo** | 6-agent AI pipeline |
| **Astron** | Claims 98% accuracy |
| **PolyBro** | Autonomous AI + academic research |

### Full Ecosystem

**200+ tools** exist across 18+ categories. See: [Awesome Prediction Market Tools](https://github.com/aarora4/Awesome-Prediction-Market-Tools)

---

## BeRight's Competitive Advantages

### What BeRight Has That NO ONE Else Has

| Advantage | Description | Competitors |
|-----------|-------------|-------------|
| **5-Platform Aggregation** | Polymarket, Kalshi, Manifold, Metaculus, Limitless | Most do 2-3 |
| **Forecaster Calibration** | Brier scores, calibration curves | No one tracks this |
| **On-Chain Verification** | Solana prediction commits, verifiable history | No one does this |
| **Superforecaster Methodology** | Base rates, evidence analysis, bias detection | Unique |
| **Telegram-First Agent** | 50+ commands, full-featured bot | Most have zero Telegram |
| **Combined Stack** | Arbitrage + Whale + AI Research in one | Competitors specialize |

### Competitive Matrix

| Feature | BeRight | Oddpool | Verso | Converge | Unusual Predictions | Dome |
|---------|---------|---------|-------|----------|---------------------|------|
| Multi-platform aggregation | ✅ 5 | ✅ 3 | ✅ 2 | ✅ 3 | ❌ 1 | ✅ 2+ |
| Arbitrage detection | ✅ | ✅ Pro | ❌ | ✅ | ❌ | ❌ |
| Whale tracking | ✅ | ✅ Pro | ❌ | ❌ | ✅ | ❌ |
| Insider detection | ⚠️ Partial | ❌ | ❌ | ❌ | ✅ Core | ❌ |
| AI research | ✅ Claude Opus | ❌ | ⚠️ News AI | ❌ | ❌ | ❌ |
| Superforecaster tracking | ✅ Unique | ❌ | ❌ | ❌ | ⚠️ Smart Money | ❌ |
| Calibration/Brier scores | ✅ Unique | ❌ | ❌ | ❌ | ❌ | ❌ |
| On-chain verification | ✅ Solana | ❌ | ❌ | ❌ | ❌ | ❌ |
| Telegram agent | ✅ 50+ commands | ❌ | ❌ | ❌ | ❌ | ❌ |
| X/Twitter agent | ❌ | ❌ | ❌ | ❌ | ✅ (parent) | ❌ |
| Web terminal | ⚠️ Basic | ✅ | ✅ | ✅ | ✅ | ❌ |
| Public API | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Core |
| YC Backed | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |

### Market Gap Analysis

| Gap | BeRight Opportunity |
|-----|---------------------|
| No one owns "forecaster accuracy" | Be THE platform for verified forecaster track records |
| No combined intelligence + trading | Do both — analyze AND execute |
| Fragmented signals | Single source of truth for prediction market signals |
| No true API standard | Build the API layer (or partner with Dome) |
| Telegram is underserved | Already far ahead with 50+ commands |
| No verifiable predictions | On-chain commits = unfakeable moat |
| No capital-forecaster bridge | First to connect skill with capital |

---

## Current State vs Target State

### What BeRight Already Has (Current State)

#### Core Features ✅
- 5-platform market aggregation (Polymarket, Kalshi, Manifold, Metaculus, Limitless)
- Real-time arbitrage detection (V2 with strict matching)
- Whale wallet tracking
- Superforecaster-grade AI analysis (Claude Opus)
- On-chain prediction commits (Solana)
- Calibration tracking + Brier scores
- Leaderboard system

#### Telegram Bot ✅ (50+ Commands)
- `/brief` — Morning market briefing
- `/hot` — Trending markets
- `/alpha` — Actionable opportunities
- `/research <topic>` — Deep superforecaster analysis
- `/intelligence <question>` — Base rates + recommendations
- `/odds <topic>` — Cross-platform odds comparison
- `/arb` — Arbitrage scan
- `/arb-subscribe` — 24/7 arbitrage alerts
- `/whale` — Recent whale activity
- `/track_whale <address>` — Add wallet tracking
- `/predict <question> <prob>` — Make predictions
- `/calibration` — Full calibration report
- `/leaderboard` — Top forecasters
- `/news`, `/social`, `/intel` — News and sentiment
- `/kalshi`, `/kmarkets`, `/kbuy` — Direct Kalshi trading
- `/dflow`, `/trade` — DFlow tokenized markets
- And 30+ more...

#### Infrastructure ✅
- Next.js web app + API
- Supabase/PostgreSQL database
- Redis caching
- Solana integration (Helius)
- Multi-agent architecture
- Autonomous heartbeat agent

### What BeRight Needs (Target State)

#### Terminal (Web UI)
- [ ] Professional markets browser with filtering/sorting
- [ ] Real-time signals feed page
- [ ] Market detail pages with signal timeline
- [ ] Forecaster profiles with track records
- [ ] Momentum graphs
- [ ] Conviction score visualization

#### Signal Infrastructure
- [ ] Signal detection engine (11 signal types)
- [ ] Signals database schema
- [ ] Real-time ingestion pipeline
- [ ] Signal deduplication + reinforcement

#### API Layer
- [ ] Public REST API
- [ ] API key management
- [ ] Rate limiting + tiering
- [ ] Developer documentation

#### X/Twitter Agent
- [ ] @beright_agent account
- [ ] Daily market insights posts
- [ ] Respond when tagged
- [ ] Build social presence

#### Vault System (Capital Bridge)
- [ ] Vault smart contracts
- [ ] LP deposit/withdrawal
- [ ] Profit calculation + distribution
- [ ] Risk limit enforcement
- [ ] Signal → position mapping

---

## Product Roadmap

### Phase 1: Signal Infrastructure (Foundation)
**Goal**: Build the detection engine that powers everything

- [ ] Define signal schema (11 types)
- [ ] Create signals database tables
- [ ] Build real-time signal ingestion from 5 platforms
- [ ] Implement signal deduplication + reinforcement
- [ ] Add Telegram signal notifications (`/signals` command)

### Phase 2: Web Terminal (Visibility)
**Goal**: Professional web presence to complement Telegram

- [ ] Markets browser with advanced filtering
- [ ] Signals feed (real-time, filterable)
- [ ] Market detail pages
- [ ] Forecaster profiles + track records
- [ ] Momentum visualization

### Phase 3: API Launch (Developer Platform)
**Goal**: Let others build on BeRight

- [ ] REST API design (following Dome/aixbt patterns)
- [ ] Endpoints: /markets, /signals, /forecasters, /arbitrage
- [ ] API key management + dashboard
- [ ] Rate limiting tiers
- [ ] Documentation site

### Phase 4: Conviction Engine (Intelligence)
**Goal**: Cross-cluster convergence scoring

- [ ] Forecaster cluster classification algorithm
- [ ] Conviction score calculation
- [ ] Alerts when high-conviction signals appear
- [ ] "Smart money disagrees with market" detection

### Phase 5: X Agent (Social Presence)
**Goal**: Build audience like aixbt

- [ ] Launch @beright_agent on X
- [ ] Daily market insights posts
- [ ] Respond to tags with market analysis
- [ ] Cross-post major signals

### Phase 6: Vault System v0 (Capital Bridge)
**Goal**: Connect forecasters with capital

- [ ] Social signals (forecasters make public predictions)
- [ ] Paper trading (followers track hypothetical returns)
- [ ] Tip jar (capitalists reward good calls)
- [ ] Signal subscriptions (pay for forecaster alerts)

### Phase 7: Vault System v1 (Full Vision)
**Goal**: Managed capital pools

- [ ] Vault smart contracts (Solana)
- [ ] LP deposits (USDC)
- [ ] Forecaster signal → auto-execution
- [ ] Profit sharing on-chain
- [ ] Risk limit enforcement

---

## Monetization Model

### Tiered Subscriptions (Terminal)

| Tier | Access | Price |
|------|--------|-------|
| **Free** | Telegram basics, delayed signals | $0 |
| **Pro** | Full terminal, real-time signals, 10 watchlists | $29/mo |
| **Whale** | Everything + API (10k calls), priority alerts | $99/mo |
| **Enterprise** | Unlimited API, white-label, custom integrations | Custom |

### API Access

| Tier | Calls/Month | Price |
|------|-------------|-------|
| **Demo** | 1,000 | Free |
| **Developer** | 50,000 | $49/mo |
| **Business** | 500,000 | $299/mo |
| **Enterprise** | Unlimited | Custom |

### Vault Fees (Capital Bridge)

```
Platform Fee: 5% of vault profits
├── Distributed to BeRight protocol
├── Covers execution, infrastructure, custody
└── Only charged on profitable vaults
```

### Revenue Projections

| Scenario | AUM in Vaults | Annual Fee Revenue |
|----------|---------------|-------------------|
| Conservative | $10M | $500K |
| Moderate | $50M | $2.5M |
| Aggressive | $100M | $5M |

---

## Technical Architecture

### Current Architecture

```
┌─────────────────────────────────────────────────────┐
│           FRONTEND LAYER                            │
│  Telegram Bot │ Next.js Dashboard │ Web Pages      │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│           API LAYER (Next.js Routes)                │
│  /api/markets │ /api/arbitrage │ /api/research    │
│  /api/whale │ /api/predictions │ /api/leaderboard │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│         SKILLS LAYER (Core Logic)                   │
│  markets.ts │ arbitrage.ts │ intelligence.ts       │
│  heartbeat.ts │ intel.ts │ calibration.ts          │
│  whale.ts │ brief.ts │ research.ts                 │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│    INTEGRATION LAYER (Clients & Utilities)          │
│  kalshi.ts │ dflow.ts │ arbitrage/index.ts        │
│  onchain/ │ supabase/ │ cognitive/                 │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│          EXTERNAL DATA SOURCES                      │
│  Polymarket │ Kalshi │ Manifold │ Solana           │
│  Tavily │ Twitter │ Jupiter │ Helius              │
└─────────────────────────────────────────────────────┘
```

### Target Architecture (BloomBeRight)

```
┌─────────────────────────────────────────────────────────────────┐
│                    BERIGHT PLATFORM ARCHITECTURE                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CONSUMER LAYER                                                  │
│  ├── Telegram Bot (50+ commands) ✅                              │
│  ├── X/Twitter Agent (@beright_agent) 🔲                         │
│  ├── Web Terminal (markets, signals, forecasters) 🔲             │
│  └── Mobile App (future)                                         │
│                                                                  │
│  DEVELOPER LAYER                                                 │
│  ├── REST API (/v2/markets, /v2/signals, etc.) 🔲                │
│  ├── WebSocket API (real-time signals) 🔲                        │
│  ├── SDKs (Python, TypeScript) 🔲                                │
│  └── MCP Server (AI workflow integration) 🔲                     │
│                                                                  │
│  INTELLIGENCE LAYER                                              │
│  ├── Signal Detection Engine 🔲                                  │
│  │   ├── New Market detector                                     │
│  │   ├── Volume Surge detector                                   │
│  │   ├── Odds Shift detector                                     │
│  │   ├── Whale Entry detector ✅                                 │
│  │   ├── Smart Money detector 🔲                                 │
│  │   ├── Arbitrage detector ✅                                   │
│  │   ├── Resolution detector 🔲                                  │
│  │   ├── Consensus Flip detector 🔲                              │
│  │   ├── Narrative detector 🔲                                   │
│  │   ├── Cross-Market detector 🔲                                │
│  │   └── Insider Pattern detector 🔲                             │
│  ├── Conviction Score Engine 🔲                                  │
│  ├── Forecaster Cluster Classification 🔲                        │
│  └── AI Research Engine (Claude Opus) ✅                         │
│                                                                  │
│  REPUTATION LAYER                                                │
│  ├── On-chain prediction commits (Solana) ✅                     │
│  ├── Brier score calculation ✅                                  │
│  ├── Calibration tracking ✅                                     │
│  ├── Domain expertise scoring 🔲                                 │
│  └── Leaderboard ✅                                              │
│                                                                  │
│  CAPITAL LAYER (Vaults)                                          │
│  ├── Vault smart contracts (Solana) 🔲                           │
│  ├── LP deposit/withdrawal 🔲                                    │
│  ├── Signal → Position mapping 🔲                                │
│  ├── Position sizing engine 🔲                                   │
│  ├── Risk limit enforcement 🔲                                   │
│  └── Profit distribution 🔲                                      │
│                                                                  │
│  EXECUTION LAYER                                                 │
│  ├── Polymarket execution (via API) ⚠️                          │
│  ├── Kalshi execution ✅                                         │
│  ├── DFlow execution ✅                                          │
│  └── Slippage protection 🔲                                      │
│                                                                  │
│  DATA LAYER                                                      │
│  ├── Markets database ✅                                         │
│  ├── Signals database 🔲                                         │
│  ├── Predictions database ✅                                     │
│  ├── Users database ✅                                           │
│  ├── Forecaster profiles 🔲                                      │
│  └── Vault state 🔲                                              │
│                                                                  │
│  INTEGRATION LAYER                                               │
│  ├── Polymarket API ✅                                           │
│  ├── Kalshi API ✅                                               │
│  ├── Manifold API ✅                                             │
│  ├── Metaculus API ✅                                            │
│  ├── Limitless API ✅                                            │
│  ├── Solana/Helius ✅                                            │
│  ├── Tavily (news) ✅                                            │
│  └── Twitter/X API 🔲                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Legend: ✅ Built  ⚠️ Partial  🔲 To Build
```

### BeRight API Design

```
# Markets
GET  /v2/markets                      # All markets across platforms
GET  /v2/markets/{id}                 # Single market details
GET  /v2/markets/{id}/signals         # Signal timeline for market
GET  /v2/markets/{id}/momentum        # Momentum graph data
GET  /v2/markets/search?q=            # Search markets

# Signals
GET  /v2/signals                      # Global signal feed
GET  /v2/signals?type=whale_entry     # Filtered by type
GET  /v2/signals?category=politics    # Filtered by category
GET  /v2/signals/hot                  # High-impact signals only

# Forecasters
GET  /v2/forecasters                  # Top forecasters
GET  /v2/forecasters/{id}             # Forecaster profile
GET  /v2/forecasters/{id}/predictions # Prediction history
GET  /v2/forecasters/{id}/calibration # Calibration data

# Intelligence
GET  /v2/arbitrage                    # Current arbitrage opportunities
GET  /v2/consensus/{market_id}        # Cross-cluster consensus
GET  /v2/conviction/{market_id}       # Conviction score

# Vaults (future)
GET  /v2/vaults                       # All vaults
GET  /v2/vaults/{id}                  # Vault details
GET  /v2/vaults/{id}/performance      # Historical returns
POST /v2/vaults/{id}/deposit          # Deposit to vault
POST /v2/vaults/{id}/withdraw         # Withdraw from vault

# Chat
POST /v2/chat                         # Conversational AI endpoint
POST /v2/research                     # Deep research generation
```

---

## Key Differentiators Summary

### vs Bloomberg
| Bloomberg | BeRight |
|-----------|---------|
| Sell information | Enable transactions |
| Subscription revenue | Take rate on profits |
| Users read data | Users make money |
| Terminal is the product | Vaults are the product |
| $20k/year per seat | % of AUM |

### vs Competitors
| Competitor Focus | BeRight Focus |
|------------------|---------------|
| Trading terminal | Intelligence + Capital |
| Anonymous whales | Verified forecasters |
| Single platform | 5-platform aggregation |
| Web-only | Telegram-first + Web |
| No verification | On-chain proof |

### The Taglines

> **"Where forecasting skill meets capital. Both win."**

> **"The talent marketplace for prediction markets."**

> **"Turn your predictions into income. Turn your capital into alpha."**

> **"Bloomberg intelligence. Numerai capital. Prediction market alpha."**

---

## References & Sources

### aixbt Research
- [aixbt.tech](https://aixbt.tech/)
- [aixbt Terminal](https://aixbt.tech/projects)
- [aixbt Docs - What is aixbt](https://docs.aixbt.tech/introduction/what-is-aixbt)
- [aixbt Docs - Core Concepts](https://docs.aixbt.tech/introduction/core-concepts)
- [aixbt Docs - API](https://docs.aixbt.tech/builders/rest-api)
- [aixbt Docs - Signals](https://docs.aixbt.tech/terminal/projects/signals)
- [aixbt Docs - Automated Tasks](https://docs.aixbt.tech/terminal/automated-tasks)

### Competitor Research
- [Oddpool - The Bloomberg for Prediction Markets](https://oddpool.com)
- [Verso on YC](https://polymark.et/product/verso)
- [Dome on YC](https://ycombinator.com/companies/dome)
- [Converge Docs](https://docs.converge.market)
- [Unusual Predictions](https://unusualwhales.com/predictions)
- [Prediedge](https://prediedge.com)
- [PolyRouter](https://polyrouter.io)
- [FinFeedAPI](https://finfeedapi.com/products/prediction-markets-api)

### Ecosystem
- [Awesome Prediction Market Tools (200+ tools)](https://github.com/aarora4/Awesome-Prediction-Market-Tools)
- [DeFi Prime - Polymarket Ecosystem Guide](https://defiprime.com/definitive-guide-to-the-polymarket-ecosystem)
- [Polymark.et Tools Directory](https://polymark.et)

---

*Last Updated: February 2026*
*Document Version: 1.0*
