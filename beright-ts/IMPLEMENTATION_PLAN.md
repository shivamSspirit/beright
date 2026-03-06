# BeRight Bloomberg Terminal - Implementation Plan

## Executive Summary

BeRight already has 80% of the infrastructure needed. This plan focuses on:
1. **Unifying** existing scattered components
2. **Enhancing** the data layer with proper types
3. **Adding** missing execution capabilities
4. **Building** the terminal UI

---

## Existing vs Required - Gap Analysis

### What We Already Have (Excellent Foundation)

| Component | Existing Location | Quality | Gap |
|-----------|-------------------|---------|-----|
| Multi-platform data | `lib/data/aggregators/` | Good | Needs unified types |
| Arbitrage detection | `lib/arbitrage/` | Excellent | Minor enhancements |
| Signal system | `lib/signals/` | Good | Needs aggregation |
| Whale tracking | `skills/whale.ts` | Basic | Needs Arkham |
| Research synthesis | `lib/synthesis/` | Excellent | None |
| Cognitive memory | `lib/cognitiveMemory.ts` | Excellent | None |
| Trade execution | `services/tradeExecutionLayer.ts` | Partial | Needs CLOB |
| Portfolio tracking | `services/portfolioManager.ts` | Basic | Needs enhancement |
| Risk management | `services/riskManager.ts` | Basic | Needs limits |
| Agent orchestration | `lib/semanticOrchestrator.ts` | Excellent | None |

### What We Need to Build

| Component | Priority | Effort | Build vs Enhance |
|-----------|----------|--------|------------------|
| UnifiedMarket type | P0 | Low | NEW |
| Data Fabric layer | P0 | Medium | ENHANCE `lib/data/` |
| Signal Aggregator | P1 | Medium | NEW over `lib/signals/` |
| Execution Engine | P1 | High | ENHANCE `services/` |
| Portfolio Module | P2 | Medium | ENHANCE existing |
| Risk Engine | P2 | Low | ENHANCE existing |
| Terminal Web UI | P3 | High | NEW in `berightweb/` |

---

## Phase-by-Phase Implementation

### Phase 1: Data Fabric (Days 1-3)

**Goal:** Single source of truth for all market data

#### Step 1.1: Create Unified Types
```
NEW: lib/dataFabric/types.ts
```

#### Step 1.2: Enhance Existing Aggregators
```
ENHANCE: lib/data/aggregators/direct.ts → lib/dataFabric/providers/
ENHANCE: lib/kalshi.ts → lib/dataFabric/providers/kalshi.ts
CREATE: lib/dataFabric/providers/manifold.ts
CREATE: lib/dataFabric/providers/metaculus.ts
```

#### Step 1.3: Market Deduplication
```
ENHANCE: lib/arbitrage/marketMatcher.ts → lib/dataFabric/deduplication.ts
```

#### Step 1.4: Unified API
```
CREATE: lib/dataFabric/index.ts (main export)
CREATE: app/api/v2/markets/route.ts (new unified endpoint)
```

#### Files to Create:
```
lib/dataFabric/
├── index.ts              # Main exports
├── types.ts              # UnifiedMarket, Platform types
├── unifier.ts            # Cross-platform normalization
├── deduplication.ts      # Same-market detection
├── providers/
│   ├── index.ts          # Provider registry
│   ├── polymarket.ts     # Polymarket adapter
│   ├── kalshi.ts         # Kalshi adapter
│   ├── manifold.ts       # Manifold adapter
│   └── metaculus.ts      # Metaculus adapter
└── cache.ts              # In-memory + Redis cache
```

---

### Phase 2: Signal Aggregator (Days 4-6)

**Goal:** All alpha signals in one stream

#### Step 2.1: Signal Types
```
CREATE: lib/signals/types.ts (unified signal schema)
```

#### Step 2.2: Signal Detectors
```
ENHANCE: lib/signals/ → lib/signalAggregator/detectors/
ENHANCE: skills/whale.ts → lib/signalAggregator/detectors/whale.ts
ENHANCE: skills/intel.ts → lib/signalAggregator/detectors/news.ts
CREATE: lib/signalAggregator/detectors/social.ts
```

#### Step 2.3: Signal Stream
```
CREATE: lib/signalAggregator/stream.ts (event emitter)
CREATE: app/api/v2/signals/stream/route.ts (SSE endpoint)
```

#### Files to Create:
```
lib/signalAggregator/
├── index.ts              # Main exports
├── types.ts              # Signal types
├── stream.ts             # Event stream manager
├── detectors/
│   ├── index.ts          # Detector registry
│   ├── whale.ts          # Whale bet detection
│   ├── news.ts           # News catalyst
│   ├── volume.ts         # Volume spike
│   ├── arbitrage.ts      # Arb opportunity
│   ├── social.ts         # Social buzz
│   └── momentum.ts       # Price momentum
└── alerter.ts            # Notification dispatch
```

---

### Phase 3: AI Analyst Enhancement (Days 7-9)

**Goal:** Structured superforecaster output

#### Step 3.1: Analyst Types
```
CREATE: lib/analyst/types.ts (AnalystOutput schema)
```

#### Step 3.2: Superforecaster Implementation
```
ENHANCE: lib/synthesis/researchSynthesis.ts → lib/analyst/superforecaster.ts
CREATE: lib/analyst/baserates.ts
CREATE: lib/analyst/evidence.ts
CREATE: lib/analyst/calibration.ts
```

#### Files to Create:
```
lib/analyst/
├── index.ts              # Main exports
├── types.ts              # AnalystOutput
├── superforecaster.ts    # Main analysis engine
├── baserates.ts          # Reference class lookup
├── evidence.ts           # Evidence gathering
├── calibration.ts        # Probability calibration
└── contrarian.ts         # Devil's advocate
```

---

### Phase 4: Execution Engine (Days 10-14)

**Goal:** Trade across platforms from one interface

#### Step 4.1: Execution Types
```
CREATE: lib/execution/types.ts (TradeIntent, ExecutionPlan)
```

#### Step 4.2: Platform Connectors
```
ENHANCE: services/smartOrderRouter.ts → lib/execution/router.ts
ENHANCE: services/tradeExecutionLayer.ts → lib/execution/executor.ts
CREATE: lib/execution/connectors/polymarket.ts (CLOB integration)
ENHANCE: lib/kalshi.ts → lib/execution/connectors/kalshi.ts
```

#### Step 4.3: Unified Trade API
```
CREATE: app/api/v2/trade/route.ts
CREATE: app/api/v2/trade/quote/route.ts
```

#### Files to Create:
```
lib/execution/
├── index.ts              # Main exports
├── types.ts              # Trade types
├── router.ts             # Smart order routing
├── executor.ts           # Order execution
├── connectors/
│   ├── index.ts          # Connector registry
│   ├── polymarket.ts     # Polymarket CLOB
│   ├── kalshi.ts         # Kalshi trading
│   └── manifold.ts       # Manifold trading
└── reconciliation.ts     # Fill tracking
```

---

### Phase 5: Portfolio & Risk (Days 15-18)

**Goal:** Track positions across all platforms

#### Step 5.1: Portfolio Types
```
CREATE: lib/portfolio/types.ts (Portfolio, Position)
```

#### Step 5.2: Portfolio Engine
```
ENHANCE: services/portfolioManager.ts → lib/portfolio/tracker.ts
CREATE: lib/portfolio/metrics.ts
CREATE: lib/portfolio/reporting.ts
```

#### Step 5.3: Risk Engine
```
ENHANCE: services/riskManager.ts → lib/risk/limits.ts
CREATE: lib/risk/drawdown.ts
CREATE: lib/risk/correlation.ts
```

#### Files to Create:
```
lib/portfolio/
├── index.ts              # Main exports
├── types.ts              # Portfolio types
├── tracker.ts            # Position tracking
├── metrics.ts            # Performance metrics
└── reporting.ts          # P&L reports

lib/risk/
├── index.ts              # Main exports
├── types.ts              # Risk config
├── limits.ts             # Position limits
├── drawdown.ts           # Drawdown control
└── correlation.ts        # Portfolio correlation
```

---

### Phase 6: Terminal Web UI (Days 19-28)

**Goal:** Bloomberg-style trading interface

#### Step 6.1: Terminal Page
```
CREATE: berightweb/src/app/terminal/page.tsx
```

#### Step 6.2: Components
```
CREATE: berightweb/src/components/terminal/
```

#### Step 6.3: Real-time Hooks
```
CREATE: berightweb/src/hooks/useMarketStream.ts
CREATE: berightweb/src/hooks/useSignalStream.ts
CREATE: berightweb/src/hooks/usePortfolio.ts
```

#### Files to Create:
```
berightweb/src/app/terminal/
├── page.tsx              # Main terminal page
├── layout.tsx            # Terminal layout
└── loading.tsx           # Loading state

berightweb/src/components/terminal/
├── MarketPanel.tsx       # Market detail view
├── SignalFeed.tsx        # Real-time signals
├── TradePanel.tsx        # Order entry
├── Portfolio.tsx         # Position summary
├── Watchlist.tsx         # Market watchlist
├── Chart.tsx             # Price/volume chart
├── OrderBook.tsx         # Orderbook display
└── Header.tsx            # Terminal header
```

---

## File Mapping: Old → New

| Existing File | New Location | Action |
|---------------|--------------|--------|
| `lib/data/aggregators/direct.ts` | `lib/dataFabric/providers/polymarket.ts` | REFACTOR |
| `lib/kalshi.ts` | `lib/dataFabric/providers/kalshi.ts` | MOVE |
| `lib/arbitrage/marketMatcher.ts` | `lib/dataFabric/deduplication.ts` | ENHANCE |
| `lib/signals/*` | `lib/signalAggregator/detectors/*` | REFACTOR |
| `skills/whale.ts` | `lib/signalAggregator/detectors/whale.ts` | EXTRACT |
| `skills/intel.ts` | `lib/signalAggregator/detectors/news.ts` | EXTRACT |
| `lib/synthesis/researchSynthesis.ts` | `lib/analyst/superforecaster.ts` | ENHANCE |
| `services/smartOrderRouter.ts` | `lib/execution/router.ts` | MOVE |
| `services/tradeExecutionLayer.ts` | `lib/execution/executor.ts` | MOVE |
| `services/portfolioManager.ts` | `lib/portfolio/tracker.ts` | MOVE |
| `services/riskManager.ts` | `lib/risk/limits.ts` | ENHANCE |

---

## Database Schema Additions

### New Tables (Supabase)

```sql
-- Portfolio tracking
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  market_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('YES', 'NO')),
  shares DECIMAL NOT NULL,
  avg_cost DECIMAL NOT NULL,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  notes TEXT,
  tags TEXT[]
);

-- Trade history
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  position_id UUID REFERENCES positions(id),
  platform TEXT NOT NULL,
  market_id TEXT NOT NULL,
  side TEXT NOT NULL,
  shares DECIMAL NOT NULL,
  price DECIMAL NOT NULL,
  cost DECIMAL NOT NULL,
  fees DECIMAL DEFAULT 0,
  tx_hash TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Signal history
CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  market_id TEXT NOT NULL,
  confidence DECIMAL NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Market cache (unified)
CREATE TABLE unified_markets (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE,
  question TEXT NOT NULL,
  category TEXT,
  platforms JSONB NOT NULL,
  best_bid DECIMAL,
  best_ask DECIMAL,
  consensus_price DECIMAL,
  volume_24h DECIMAL,
  close_date TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API Endpoints - New Routes

### V2 API (New)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v2/markets` | Unified market search |
| GET | `/api/v2/markets/:id` | Single market detail |
| GET | `/api/v2/markets/trending` | Trending markets |
| GET | `/api/v2/signals` | Recent signals |
| GET | `/api/v2/signals/stream` | SSE signal stream |
| GET | `/api/v2/portfolio` | User positions |
| POST | `/api/v2/trade/quote` | Get trade quote |
| POST | `/api/v2/trade/execute` | Execute trade |
| GET | `/api/v2/analyst/:marketId` | AI analysis |

---

## Backward Compatibility

All existing endpoints continue to work:
- `/api/markets` → forwards to `/api/v2/markets`
- `/api/arbitrage` → uses new data fabric
- `/api/signals` → uses new signal aggregator

Skills continue to work:
- Telegram bot uses same handlers
- Heartbeat runs unchanged
- Agents use enhanced data

---

## Testing Strategy

### Unit Tests
```
tests/dataFabric/
tests/signalAggregator/
tests/execution/
tests/portfolio/
```

### Integration Tests
```
tests/integration/
├── polymarket.test.ts
├── kalshi.test.ts
├── manifold.test.ts
└── cross-platform.test.ts
```

### Mock Data
```
tests/mocks/
├── markets.json
├── signals.json
└── trades.json
```

---

## Rollout Strategy

### Week 1: Foundation
- [ ] Create `lib/dataFabric/` structure
- [ ] Migrate Polymarket provider
- [ ] Migrate Kalshi provider
- [ ] Add Manifold provider
- [ ] Create unified market types

### Week 2: Signals
- [ ] Create `lib/signalAggregator/` structure
- [ ] Migrate whale detection
- [ ] Migrate news detection
- [ ] Add volume spike detection
- [ ] Create signal stream API

### Week 3: Trading
- [ ] Create `lib/execution/` structure
- [ ] Build Polymarket CLOB connector
- [ ] Enhance Kalshi connector
- [ ] Build smart order router
- [ ] Create trade API

### Week 4: Portfolio
- [ ] Create `lib/portfolio/` structure
- [ ] Build position tracker
- [ ] Add performance metrics
- [ ] Create portfolio API
- [ ] Build risk controls

### Week 5-6: Terminal UI
- [ ] Design terminal layout
- [ ] Build market panel
- [ ] Build signal feed
- [ ] Build trade panel
- [ ] Build portfolio view
- [ ] Add real-time updates

---

## Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Market data latency | <500ms | API response time |
| Cross-platform coverage | 4+ platforms | Polymarket, Kalshi, Manifold, Metaculus |
| Signal generation | <30s | Time from event to alert |
| Trade execution | <5s | Order to fill confirmation |
| Portfolio sync | Real-time | Position updates |
| UI responsiveness | <100ms | Interaction feedback |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| API rate limits | Aggressive caching, request batching |
| API key missing | Graceful degradation, mock data |
| Platform downtime | Multi-source fallback |
| Data staleness | Websocket for real-time, polling fallback |
| Breaking changes | Version API endpoints (v2) |

---

## Quick Start Commands

```bash
# Development
npm run dev

# Build data fabric
npm run build:dataFabric

# Test integration
npm run test:integration

# Deploy
npm run deploy
```

---

## Next Steps

1. **Start with Phase 1** - Create `lib/dataFabric/` today
2. **Don't wait for API keys** - Build with existing data + mocks
3. **Keep existing code working** - Add new, don't break old
4. **Ship incrementally** - Each phase is usable independently
