# BeRight Implementation Roadmap

**Based on:** STRATEGIC_PLAN.md + Architecture Analysis
**Date:** Feb 2026

---

## Current State Assessment

### What's Already Built (Assets)

| Module | Location | Completeness | Notes |
|--------|----------|--------------|-------|
| **DFlow Integration** | `lib/dflow.ts`, `lib/dflow/` | 95% | Full client, trading, WebSocket |
| **Data Fabric** | `lib/dataFabric/` | 80% | Types + providers scaffolded |
| **Signal Aggregator** | `lib/signalAggregator/` | 70% | Detectors exist, needs streaming |
| **Analyst Module** | `lib/analyst/` | 60% | Superforecaster logic exists |
| **Execution Engine** | `lib/execution/` | 50% | Connectors scaffolded |
| **Portfolio** | `lib/portfolio/` | 40% | Basic tracking |
| **Terminal UI** | `berightweb/src/app/beright-terminal/` | 30% | Page exists, components TBD |
| **API v2** | `app/api/v2/` | 60% | Routes scaffolded |

### What's Missing (Gaps)

| Gap | Priority | Effort | Blocker? |
|-----|----------|--------|----------|
| Signal Stream (SSE) | P0 | Low | Yes - power users need this |
| Terminal UI completion | P0 | High | Yes - primary interface |
| Portfolio cross-platform sync | P1 | Medium | No |
| API documentation | P1 | Low | No |
| Agent SDK | P2 | High | No |
| Backtesting engine | P2 | High | No |

---

## Phase 1: Foundation (Days 1-5)

### Goal: Ship a usable Terminal + Signal Stream

#### 1.1 Signal Stream API (Day 1)

**What:** Real-time SSE endpoint for signals

**Files to create/modify:**
```
lib/signalAggregator/
├── stream.ts           # NEW - EventEmitter for signal bus
└── sse.ts              # NEW - SSE encoding helpers

app/api/v2/signals/
└── stream/route.ts     # NEW - SSE endpoint
```

**Implementation:**
```typescript
// lib/signalAggregator/stream.ts
import { EventEmitter } from 'events';

export const signalBus = new EventEmitter();
export type SignalEvent = {
  type: 'WHALE_BET' | 'NEWS_CATALYST' | 'VOLUME_SPIKE' | 'ARB_OPPORTUNITY';
  market: { id: string; question: string; platform: string };
  confidence: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  data: Record<string, any>;
  timestamp: Date;
};

export function emitSignal(signal: SignalEvent) {
  signalBus.emit('signal', signal);
}
```

**API Endpoint:**
```typescript
// app/api/v2/signals/stream/route.ts
export async function GET(req: Request) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const handler = (signal: SignalEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(signal)}\n\n`));
      };
      signalBus.on('signal', handler);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

#### 1.2 Terminal MVP (Days 2-4)

**What:** Bloomberg-style trading interface

**Files to create:**
```
berightweb/src/app/beright-terminal/
├── page.tsx                    # ENHANCE - Main layout
├── components/
│   ├── MarketPanel.tsx         # NEW - Market detail view
│   ├── SignalFeed.tsx          # NEW - Real-time signal stream
│   ├── TradePanel.tsx          # NEW - Order entry
│   ├── Watchlist.tsx           # NEW - Custom watchlists
│   ├── PortfolioSummary.tsx    # NEW - Position overview
│   └── PriceChart.tsx          # NEW - Candlestick chart
└── hooks/
    ├── useSignalStream.ts      # NEW - SSE hook
    ├── useMarketData.ts        # NEW - Market data hook
    └── usePortfolio.ts         # NEW - Portfolio hook
```

**Terminal Layout:**
```
┌────────────────────────────────────────────────────────────────┐
│  BERIGHT TERMINAL                                    [Search]  │
├─────────────────────┬──────────────────────┬───────────────────┤
│                     │                      │                   │
│   SIGNAL FEED       │   MARKET PANEL       │   TRADE PANEL     │
│   (Real-time)       │   (Selected market)  │   (Order entry)   │
│                     │                      │                   │
│   🐋 Whale bet...   │   Question: Will...  │   Side: [YES][NO] │
│   📰 News: Fed...   │   YES: 65% / NO: 35% │   Amount: $____   │
│   📈 Volume spike   │   Volume: $2.3M      │   [GET QUOTE]     │
│                     │   Chart...           │   [EXECUTE]       │
│                     │                      │                   │
├─────────────────────┴──────────────────────┴───────────────────┤
│   WATCHLIST          │   PORTFOLIO                              │
│   BTC > 100k  68%    │   Total: $12,340  |  P&L: +$1,234 (11%) │
│   Trump 2026  42%    │   Positions: 12   |  Win Rate: 67%      │
│   Fed Rate    23%    │   [View All]                             │
└──────────────────────┴─────────────────────────────────────────┘
```

#### 1.3 Connect Signal Detectors (Day 5)

**What:** Wire existing detectors to signal bus

**Existing detectors to connect:**
```
lib/signalAggregator/detectors/
├── whale.ts       # EXISTS - Connect to signalBus
├── arb.ts         # EXISTS - Connect to signalBus
├── volume.ts      # EXISTS - Connect to signalBus
├── momentum.ts    # EXISTS - Connect to signalBus
└── news.ts        # ENHANCE - Add Tavily integration
```

**Heartbeat integration:**
```typescript
// services/heartbeat.ts - ADD
import { runSignalDetectors } from '../lib/signalAggregator';

// Every 30 minutes, run all detectors
async function heartbeatLoop() {
  await runSignalDetectors(); // Emits to signalBus
}
```

---

## Phase 2: Power User Features (Days 6-12)

### Goal: API access + Portfolio management

#### 2.1 API Documentation (Day 6)

**What:** Document all v2 endpoints for power users

**File to create:**
```
berightweb/src/app/docs/api/page.tsx
```

**Endpoints to document:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v2/markets` | GET | Search unified markets |
| `/v2/markets/:id` | GET | Market details |
| `/v2/markets/trending` | GET | Hot markets by volume |
| `/v2/signals` | GET | Recent signals |
| `/v2/signals/stream` | GET | SSE real-time signals |
| `/v2/analyst/:id` | GET | AI analysis for market |
| `/v2/execution/quote` | POST | Get trade quote |
| `/v2/execution/execute` | POST | Execute trade |
| `/v2/portfolio` | GET | User positions |
| `/v2/portfolio/performance` | GET | P&L history |

#### 2.2 Portfolio Enhancement (Days 7-9)

**What:** Cross-platform position tracking + P&L

**Files to enhance:**
```
lib/portfolio/
├── tracker.ts          # ENHANCE - Add Polymarket, Kalshi, DFlow sync
├── pnl.ts              # ENHANCE - Real-time P&L calculation
├── alerts.ts           # ENHANCE - Position alerts (stop-loss, take-profit)
└── types.ts            # ENHANCE - Add platform-specific position types
```

**Database schema (Supabase):**
```sql
-- New table for positions
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  platform TEXT NOT NULL, -- polymarket, kalshi, dflow, manifold
  market_id TEXT NOT NULL,
  market_question TEXT,
  side TEXT NOT NULL CHECK (side IN ('YES', 'NO')),
  shares DECIMAL NOT NULL,
  avg_cost DECIMAL NOT NULL,
  current_price DECIMAL,
  pnl DECIMAL GENERATED ALWAYS AS ((current_price - avg_cost) * shares) STORED,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_positions_user ON positions(user_id);
CREATE INDEX idx_positions_platform ON positions(platform);
```

#### 2.3 Analyst API Exposure (Days 10-12)

**What:** Expose superforecaster analysis via API

**Enhance:**
```
lib/analyst/
├── superforecaster.ts  # EXISTS - Main analysis engine
├── api.ts              # NEW - API wrapper
└── cache.ts            # NEW - Cache analysis results

app/api/v2/analyst/
└── [marketId]/route.ts # NEW - Analysis endpoint
```

**Response format:**
```typescript
interface AnalystResponse {
  market: { id: string; question: string };
  analysis: {
    modelProbability: number;      // Our estimate
    marketProbability: number;     // Current market price
    edge: number;                  // Difference
    confidence: number;            // How sure we are
    reasoning: {
      baseRate: { estimate: number; source: string };
      evidence: { item: string; impact: 'bullish' | 'bearish' }[];
      contrarian: string;          // Devil's advocate
    };
    recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  };
  generatedAt: string;
}
```

---

## Phase 3: Tokenized Market Meta (Days 13-20)

### Goal: Full DFlow execution + Vault product

#### 3.1 DFlow Terminal Integration (Days 13-15)

**What:** Trade DFlow markets from Terminal UI

**Enhance:**
```
berightweb/src/app/beright-terminal/components/
├── TradePanel.tsx      # ENHANCE - Add DFlow execution
└── DFlowMarkets.tsx    # NEW - DFlow-specific market view

berightweb/src/hooks/
└── useDFlowTrading.ts  # EXISTS - Enhance with wallet integration
```

**Flow:**
1. User selects DFlow market in Terminal
2. TradePanel detects platform = 'dflow'
3. Calls `lib/dflow.ts` → `getOrder()` for quote
4. User signs with Phantom/Privy wallet
5. Transaction submitted to Solana

#### 3.2 Multi-Platform Execution Router (Days 16-18)

**What:** Smart routing across Polymarket, Kalshi, DFlow

**Files:**
```
lib/execution/
├── router.ts           # ENHANCE - Multi-platform routing
├── connectors/
│   ├── polymarket.ts   # EXISTS - CLOB integration
│   ├── kalshi.ts       # EXISTS - API trading
│   ├── dflow.ts        # NEW - Wrapper around lib/dflow.ts
│   └── index.ts        # NEW - Connector registry
└── types.ts            # ENHANCE - Unified execution types
```

**Smart routing logic:**
```typescript
async function getBestExecution(
  market: UnifiedMarket,
  side: 'YES' | 'NO',
  amount: number
): Promise<ExecutionPlan> {
  // Get quotes from all platforms where market exists
  const quotes = await Promise.all(
    market.platforms.map(p => getQuote(p.platform, p.marketId, side, amount))
  );

  // Sort by effective price
  quotes.sort((a, b) => a.effectivePrice - b.effectivePrice);

  // Return best single-venue or split execution
  return optimizeExecution(quotes, amount);
}
```

#### 3.3 Vault Product MVP (Days 19-20)

**What:** Managed prediction market exposure

**Files:**
```
lib/vault/
├── index.ts            # EXISTS - Core vault logic
├── strategies/
│   ├── arb.ts          # NEW - Arbitrage strategy
│   ├── momentum.ts     # NEW - Momentum strategy
│   └── diversified.ts  # NEW - Diversified portfolio
└── reporting.ts        # NEW - NAV calculation, reports

berightweb/src/app/vault/
└── page.tsx            # ENHANCE - Vault dashboard
```

**Vault structure:**
- Users deposit USDC
- BeRight executes trades via DFlow/Polymarket
- Positions tracked in `beright-vault/` Anchor program
- Performance fees: 2% management + 20% performance

---

## Phase 4: AI Agent Infrastructure (Days 21-30)

### Goal: SDK for AI agent developers

#### 4.1 Agent SDK (Days 21-25)

**What:** TypeScript SDK for building prediction market agents

**New package:**
```
packages/beright-agent-sdk/
├── package.json
├── src/
│   ├── index.ts        # Main exports
│   ├── client.ts       # BeRight API client
│   ├── markets.ts      # Market data helpers
│   ├── signals.ts      # Signal stream subscription
│   ├── execution.ts    # Trade execution
│   ├── portfolio.ts    # Position tracking
│   └── strategies/
│       ├── base.ts     # Base strategy class
│       ├── arb.ts      # Pre-built arb strategy
│       └── momentum.ts # Pre-built momentum strategy
└── README.md
```

**SDK usage:**
```typescript
import { BeRightAgent, ArbStrategy } from '@beright/agent-sdk';

const agent = new BeRightAgent({
  apiKey: process.env.BERIGHT_API_KEY,
  wallet: myKeypair,
});

// Subscribe to signals
agent.signals.on('ARB_OPPORTUNITY', async (signal) => {
  if (signal.data.spread > 0.05) {
    await agent.execute({
      market: signal.market.id,
      side: 'YES',
      amount: 100,
    });
  }
});

// Or use pre-built strategy
const strategy = new ArbStrategy({ minSpread: 0.03, maxPosition: 500 });
agent.run(strategy);
```

#### 4.2 Agent Dashboard (Days 26-28)

**What:** Monitor running agents

**Files:**
```
berightweb/src/app/agents/
├── page.tsx            # NEW - Agent list
├── [id]/page.tsx       # NEW - Agent detail
└── components/
    ├── AgentCard.tsx   # NEW
    ├── PnLChart.tsx    # NEW
    └── TradeLog.tsx    # NEW
```

#### 4.3 Eliza Integration (Days 29-30)

**What:** Plugin for Eliza agent framework

**Files:**
```
packages/beright-eliza-plugin/
├── package.json
├── src/
│   ├── index.ts        # Plugin entry
│   ├── actions/
│   │   ├── trade.ts    # TRADE action
│   │   ├── analyze.ts  # ANALYZE action
│   │   └── portfolio.ts# PORTFOLIO action
│   └── providers/
│       └── markets.ts  # Market data provider
└── README.md
```

---

## Phase 5: Growth & Content (Ongoing)

### Goal: Twitter presence + Community

#### 5.1 Automated Twitter Content

**What:** Daily volume dashboards, signals, leaderboards

**Files:**
```
services/
├── twitterBot.ts       # NEW - Twitter posting
└── contentGenerator.ts # NEW - Generate charts, insights

lib/content/
├── volumeDashboard.ts  # NEW - Generate volume chart
├── signalSummary.ts    # NEW - Daily signal digest
└── leaderboard.ts      # NEW - Forecaster accuracy
```

**Content schedule:**
| Time | Content | Source |
|------|---------|--------|
| 7 AM | Volume dashboard | Polymarket + Kalshi + DFlow APIs |
| 12 PM | Top signals | Signal stream |
| 6 PM | AI agent volume | DFlow trades tagged as agent |
| Weekly | Forecaster leaderboard | Resolution data |

#### 5.2 Community Engagement

**Accounts to engage:**
- @TrenchFu - Geo-political intel
- @assymetrix - Market data
- @defioasis.eth - Solana analytics
- @mtehrealm - Power user
- @kiruwaaaaa - Viral takes
- @DFlow - Infrastructure partner

---

## Success Criteria

### Week 1 (Days 1-5)
- [ ] Signal SSE endpoint live at `/v2/signals/stream`
- [ ] Terminal MVP deployed with Signal Feed + Market Panel
- [ ] At least 3 signal types flowing (whale, arb, volume)

### Week 2 (Days 6-12)
- [ ] API docs live at `/docs/api`
- [ ] Portfolio tracking for 2+ platforms
- [ ] Analyst API returning structured analysis

### Week 3 (Days 13-20)
- [ ] DFlow trading from Terminal UI
- [ ] Multi-platform execution router
- [ ] Vault MVP with 1 strategy

### Week 4 (Days 21-30)
- [ ] Agent SDK published to npm
- [ ] Agent dashboard live
- [ ] First external agent using SDK

### Ongoing
- [ ] 1000+ Twitter followers in 30 days
- [ ] 100+ Terminal DAU in 30 days
- [ ] $100K+ execution volume in 30 days

---

## Quick Start Commands

```bash
# Start development
cd beright-ts && npm run dev

# Test DFlow integration
npx ts-node lib/dflow.ts hot
npx ts-node lib/dflow.ts search "bitcoin"

# Test signal stream
curl http://localhost:3000/api/v2/signals/stream

# Build terminal
cd berightweb && npm run dev
```

---

## Notes

1. **DFlow is already integrated** - Focus on Terminal UI, not backend
2. **Signal detectors exist** - Just need to wire to SSE stream
3. **Don't over-engineer** - Ship MVP, iterate based on user feedback
4. **Twitter is urgent** - Start content now, don't wait for product
5. **Power users first** - Build for quants and signal hunters, not casual users

---

*Next action: Start Phase 1.1 - Signal Stream API*
