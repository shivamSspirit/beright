# BeRight V2 Architecture

## System Overview

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

---

## Agents

### Scout (Speed + Breadth)
- **Model**: Claude Sonnet | **Temp**: 0.3 | **Response**: <2s
- **Purpose**: Quick market scans across all platforms
- **Tools**:
  - `get_hot_markets` — Trending markets by volume
  - `search_markets` — Multi-platform search
  - `find_arbitrage` — Cross-platform price differences
  - `compare_odds` — Same market across platforms
  - `get_news` — Market-moving intelligence
  - `get_tokenized_markets` — On-chain tradeable (Solana)
  - `track_whales` — Large position tracking
  - `get_jupiter_markets` — Jupiter aggregated (zero fees)

### Analyst (Depth)
- **Model**: Claude Opus | **Temp**: 0.4 | **Response**: 5-15s
- **Purpose**: Deep research using Tetlock superforecasting
- **Tools**:
  - `research_market` — Deep dive with metadata
  - `estimate_probability` — Outside view + inside view synthesis
  - `gather_evidence` — Bullish/bearish factor analysis
  - `find_base_rate` — Historical reference class forecasting
  - `compare_prices` — Market comparison
  - `check_calibration` — Calibration analysis

### Trader (Execution)
- **Model**: Claude Sonnet | **Temp**: 0.1 | **Response**: 2-3s
- **Purpose**: Risk-aware trade execution
- **Tools**:
  - `get_positions` — Portfolio view
  - `calculate_size` — Kelly criterion position sizing
  - `find_best_price` — Optimal venue selection
  - `check_risk` — Risk exposure assessment
  - `execute_trade` — Order placement
  - `set_alert` — Price alerts

### xDegen (Social/Content)
- **Model**: Claude Sonnet | **Temp**: 0.7 | **Response**: 2-5s
- **Purpose**: Autonomous X/Twitter posting, alpha signals
- **Tools**:
  - `generate_alpha_post` — Alpha signal content
  - `post_to_twitter` — X/Twitter integration
  - `get_market_alpha` — Alpha research
  - `check_post_status` — Post tracking
  - `generate_thread` — Thread composition
  - `schedule_post` — Post scheduling

### Orchestrator (Router)
- **Model**: Claude Sonnet | **Temp**: 0.3 | **Response**: <1s
- **Purpose**: Intent classification → routing decision
- **Routing Logic**:
  - Speed/breadth queries → SCOUT
  - Deep analysis requests → ANALYST
  - Execution/money → TRADER
  - Social/content → XDEGEN
  - Conversational → Direct response

---

## Message Flow

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

---

## Two-Tier Pattern

```
Tier 1 (fast, deterministic):
  - Fetch data from APIs
  - Calculate metrics (volume, prices, spreads)
  - Format results
  - Cache for reuse

Tier 2 (smart, reasoning):
  - LLM processes Tier 1 data
  - Synthesizes insights
  - Estimates probabilities
  - Ranks opportunities
```

**Rule**: Always Tier 1 first. LLM only when reasoning needed.

---

## Key Modules

### Data Layer
| Module | Purpose |
|--------|---------|
| `lib/dataFabric/` | Unified market data, caching, deduplication |
| `lib/data/platforms/` | Raw platform adapters |
| `lib/kalshi/` | Kalshi-specific client (42KB) |
| `lib/jupiter/` | Jupiter DEX + Prediction Markets |

### Orchestration
| Module | Purpose |
|--------|---------|
| `lib/orchestrator/` | Command router + 40 handlers |
| `lib/semanticAgent/` | LLM-powered intent understanding |
| `lib/cognitive/` | Memory, learning loops |

### Execution
| Module | Purpose |
|--------|---------|
| `lib/execution/` | Smart order routing |
| `services/smartOrderRouter.ts` | Venue selection |
| `services/riskManager.ts` | Kelly sizing, exposure |
| `services/tradeExecutionLayer.ts` | Transaction building |

### On-Chain
| Module | Purpose |
|--------|---------|
| `lib/onchain/` | Solana integration |
| `lib/onchain/calibration.ts` | Brier score commits |
| `lib/onchain/commit.ts` | Transaction building |

---

## Services (7 Remaining)

| Service | Purpose |
|---------|---------|
| `smartOrderRouter` | Routes orders to best venue |
| `riskManager` | Kelly sizing, exposure limits |
| `tradeExecutionLayer` | Transaction building, MEV |
| `strategyFramework` | Strategy templates |
| `paperTradingEngine` | Simulation/backtesting |
| `marketWatcher` | Real-time monitoring |
| `notificationDelivery` | Alert distribution |

---

## Caching Strategy

| Layer | TTL | Purpose |
|-------|-----|---------|
| Data Fabric | 30s markets, 10s detail | Minimize API calls |
| Quote Cache | 5s | Prevent stale prices |
| Chat Context | 10m | Conversation continuity |
| Session Cache | 30m | Web API state |

---

## API Routes (V2)

### Agent Interface
```
POST /api/v2/agent     → { message, sessionId?, userId?, agent? }
GET  /api/v2/agent     → capabilities, session info
```

### Markets
```
GET /api/v2/markets           → unified market list
GET /api/v2/markets/trending  → momentum-sorted
GET /api/v2/markets/[id]      → detail
```

### Execution
```
GET  /api/v2/execution/quote     → order quote
POST /api/v2/execution           → execute order
GET  /api/v2/execution/balances  → account balances
```

### Portfolio
```
GET /api/v2/portfolio        → full summary
GET /api/v2/portfolio/alerts → active alerts
GET /api/v2/risk             → risk metrics
GET /api/v2/risk/sizing      → Kelly recommendations
```

---

## Core Principle

### Accuracy Over Agreement
Built into every agent system prompt:
- Challenge user assumptions when data disagrees
- Use research and logic, not validation
- Goal: most accurate conclusion, not user agreement
