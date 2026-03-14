# BeRight Protocol - Claude Code Instructions

## Overview
Prediction market intelligence platform with Telegram bot, arbitrage monitoring, and AI forecasting.

---

## Core Philosophy

> **AI replaces work, not just assists. Users feel smart without manual effort.**

| Anti-Pattern | BeRight Way |
|--------------|-------------|
| Show data for analysis | Deliver actionable insights |
| List opportunities | Find, evaluate, execute |
| Manual alerts | Proactive notifications |
| Raw research | Synthesized conclusions |

**10x Test**: Does this make users 10x more effective? Can they get value passively? Do they feel like they have a team?

---

## Vision: Bloomberg Terminal for AI-Native Traders

**Flywheel**: Forecasters build Brier-scored reputation → Delegators stake on top callers → 80/20 profit split (skill/capital) → 20% platform fee

| Phase | Focus |
|-------|-------|
| V1 | Telegram Bot - AI signals, Brier tracking |
| V2 | Dashboard - Alpha feeds, delegation UI |
| V3 | Protocol - On-chain PDAs, cross-platform rep |

**Build Priorities**:
1. Track/display Brier scores (portable reputation)
2. AI delivers alpha (users don't research)
3. Make staking as easy as following
4. Screenshot-worthy, shareable outputs
5. Architecture supports real stakes

---

## Development Workflow

### Spec-First (70% Less Rework)
```
1. "Write a spec for [feature]"
2. Review together
3. "Go build it"
```

Spec covers: behavior, technical approach, edge cases, testing, out of scope.

### Commit Habits
- Commit after every working milestone
- Format: `feat:`, `fix:`, `refactor:` with WHY
- Never batch features

### Session Hygiene
**Start**: Read CURRENT_TASK.md, check git status, run tests
**End**: Commit, update CURRENT_TASK.md, note blockers

### Context Management
Use `/compact` for long sessions. Track progress in CURRENT_TASK.md:
```markdown
## Current Task | ## Progress | ## Decisions | ## Files Modified | ## Blockers
```

---

## V2 Agent Architecture (Current)

### System Overview
```
┌─────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR                           │
│            (Intent classification → Agent routing)          │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┬───────────┐
        ▼                  ▼                  ▼           ▼
   ┌─────────┐      ┌──────────┐      ┌────────┐   ┌─────────┐
   │ SCOUT   │      │ ANALYST  │      │ TRADER │   │ XDEGEN  │
   │Speed+   │      │  Deep    │      │Execute │   │ Social  │
   │Breadth  │      │Research  │      │  Risk  │   │ Content │
   └────┬────┘      └────┬─────┘      └───┬────┘   └────┬────┘
        │                │                │             │
        └────────────────┴────────────────┴─────────────┘
                           │
                    ┌──────┴──────┐
                    │ DATA FABRIC │
                    │  (Unified)  │
                    └──────┬──────┘
                           │
     ┌─────────┬───────────┼───────────┬──────────┐
     ▼         ▼           ▼           ▼          ▼
 Polymarket  Kalshi    Manifold   Limitless   Jupiter
```

### Agent Details

| Agent | Model | Temp | Tools | Purpose |
|-------|-------|------|-------|---------|
| **Scout** | Sonnet | 0.3 | 8 | Quick scans, arb detection, hot markets |
| **Analyst** | Opus | 0.4 | 6 | Deep research, probability estimates |
| **Trader** | Sonnet | 0.1 | 6 | Execution, Kelly sizing, risk checks |
| **xDegen** | Sonnet | 0.7 | 6 | Twitter/X content, alpha posts |
| **Orchestrator** | Sonnet | 0.3 | - | Routes to correct agent |

### Agent Tools

**Scout**: `get_hot_markets`, `search_markets`, `find_arbitrage`, `compare_odds`, `get_news`, `get_tokenized_markets`, `track_whales`, `get_jupiter_markets`

**Analyst**: `research_market`, `estimate_probability`, `gather_evidence`, `find_base_rate`, `compare_prices`, `check_calibration`

**Trader**: `get_positions`, `calculate_size`, `find_best_price`, `check_risk`, `execute_trade`, `set_alert`

**xDegen**: `generate_alpha_post`, `post_to_twitter`, `get_market_alpha`, `check_post_status`, `generate_thread`, `schedule_post`

### Message Flow
```
Telegram/API
    │
    ▼
┌─────────────────┐
│ Secure Handler  │ → Rate limit, sanitize, tier check
└────────┬────────┘
         ▼
┌─────────────────┐
│ Telegram Handler│ → Command matching, context
└────────┬────────┘
         ▼
┌─────────────────┐
│ Intent Classify │ → SCAN / RESEARCH / EXECUTE / SOCIAL
└────────┬────────┘
         ▼
┌─────────────────┐
│ Agent Execution │ → LLM + Tools + Synthesis
└────────┬────────┘
         ▼
┌─────────────────┐
│  Data Fabric    │ → Unified market data (cached, deduped)
└─────────────────┘
```

### Two-Tier Pattern
```
Tier 1 (fast, deterministic): Fetch APIs, calculate metrics, cache
Tier 2 (LLM reasoning): Synthesize, estimate probabilities, rank
```
**Rule**: Always Tier 1 first. LLM only when reasoning needed.

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `/agents/` | Scout, Analyst, Trader, xDegen, Orchestrator |
| `/lib/dataFabric/` | Unified market data layer |
| `/lib/orchestrator/` | 40 command handlers |
| `/lib/execution/` | Trade routing, Jito bundles, Jupiter |
| `/lib/onchain/` | Solana Brier score commits |
| `/services/` | 7 remaining: risk, execution, routing |
| `/skills/` | Legacy skills (still used by telegramHandler) |

### Services (Remaining 7)

| Service | Purpose |
|---------|---------|
| `smartOrderRouter` | Routes orders to best venue |
| `riskManager` | Kelly sizing, exposure limits |
| `tradeExecutionLayer` | Transaction building, MEV |
| `strategyFramework` | Strategy templates |
| `paperTradingEngine` | Simulation/backtesting |
| `marketWatcher` | Real-time monitoring |
| `notificationDelivery` | Alert distribution |

### Caching Strategy

| Layer | TTL | Purpose |
|-------|-----|---------|
| Data Fabric | 30s markets, 10s detail | Minimize API calls |
| Quote Cache | 5s | Prevent stale prices |
| Chat Context | 10m | Conversation continuity |
| Session Cache | 30m | Web API state |

### Common Issues

| Problem | Fix |
|---------|-----|
| Agent not responding | Check ANTHROPIC_API_KEY in .env |
| Stale market data | Data Fabric cache (30s TTL) |
| No synthesis | Ensure Tier 2 agent called, not just skill |
| Rate limited | Check user tier in channelSecurity |

---

## Viral Product Principles (Nikita Bier)

- Reproducible testing > any single idea
- Narrow audience is fine (obsessive traders = ideal)
- Core needs: love, money, play → BeRight = money
- Can they use it from the toilet? Keep it simple
- 7 new opens per session = escape velocity
- Build shareable outputs

**Feature Checklist**:
- [ ] Test in one community first
- [ ] Helps make/save money
- [ ] Creates feedback loop
- [ ] Shareable on other platforms

---

## Prediction Market APIs (Verified Feb 2026)

### Quick Reference
| Platform | Auth | Real Money | Best For |
|----------|------|------------|----------|
| Polymarket | None | Crypto | Politics, sports |
| Kalshi | None (reads) | USD | Regulated US events |
| Manifold | None | Play-money | Wide variety |
| Jupiter | None | Solana | Aggregated Poly+Kalshi (ZERO fees) |
| Limitless | None | USDC | Crypto price predictions |
| Metaculus | Free key | No | Long-range forecasts |

### Polymarket (No Auth)
```
Base: https://gamma-api.polymarket.com

GET /markets?closed=false&limit=30&order=volume&ascending=false
GET /events?closed=false&limit=20

Response: { id, question, outcomePrices: "[\"0.65\",\"0.35\"]", volume, slug }
```

### Kalshi (No Auth for reads)
```
Base: https://api.elections.kalshi.com/trade-api/v2

GET /markets?limit=30&status=open
GET /markets/{ticker}/orderbook

Response: { ticker, title, yes_bid, yes_ask } // Prices in CENTS (0-100)
```

### Manifold (No Auth)
```
Base: https://api.manifold.markets/v0

GET /search-markets?term=&limit=20&sort=liquidity&filter=open

Response: { id, question, probability, volume, url }
```

### PolyRouter (Free Key Required)
```
Base: https://api-v2.polyrouter.io
Header: X-API-Key: pk_...

GET /markets?platform=polymarket&limit=20
Platforms: polymarket, kalshi, manifold, limitless, prophetx
```

### Metaculus (Free Key Required)
```
Base: https://www.metaculus.com/api2
Header: Authorization: Token YOUR_TOKEN

GET /questions/?format=json&limit=20&status=open&type=forecast
```

### Limitless (No Auth)
```
Base: https://api.limitless.exchange
IMPORTANT: Use /markets/active NOT /markets

GET /markets/active?limit=20&sortBy=newest
GET /markets/{slug}/orderbook
GET /markets/search?query=bitcoin&limit=10

Notes: USDC has 6 decimals, deadline is Unix seconds
```

### Jupiter Prediction Markets (No Auth)
```
Base: https://api.jup.ag/prediction/v1

GET /events                    # All active prediction events
GET /events/{eventId}          # Event details
GET /events/{eventId}/orderbook
POST /orders                   # Place order (requires wallet signature)

Key Benefits:
- Aggregates Polymarket + Kalshi markets
- ZERO payout fees (vs 2% on native platforms)
- Native Solana wallet integration
- SOL/USDC settlement
```

### Code Examples
```typescript
// Polymarket
const markets = await fetch('https://gamma-api.polymarket.com/markets?closed=false&limit=20&order=volume').then(r => r.json());
const yesPrice = parseFloat(JSON.parse(m.outcomePrices)[0]);

// Kalshi (prices in cents!)
const { markets } = await fetch('https://api.elections.kalshi.com/trade-api/v2/markets?limit=20&status=open').then(r => r.json());
const yesPrice = ((m.yes_bid + m.yes_ask) / 2) / 100;

// Manifold
const markets = await fetch('https://api.manifold.markets/v0/search-markets?limit=20&filter=open').then(r => r.json());
const yesPrice = m.probability; // Already 0-1
```

### Env Vars
```bash
GROQ_API_KEY=...           # Required for semantic agent
POLYROUTER_API_KEY=pk_...  # Optional aggregator
METACULUS_TOKEN=...        # Optional long-range
```

---

## /pitch Skill

12-slide pitch deck generator. Slides: Hook → Problem → Solution → Features → Tech → Market → Business Model → Traction → Roadmap → Team → CTA

Ask for: company name, one-liner, problem, target market, business model, traction, team.

---

## Key Principles

1. **Authenticity > Performance**: Skip "Great question!" — just help
2. **Proactive**: Try to figure it out before asking
3. **Concise/thorough**: Match depth to complexity
4. **Two-tier**: Deterministic first, LLM reasoning only when needed
5. **Spec-first**: Plan before coding
6. **Commit often**: Working milestone = commit
