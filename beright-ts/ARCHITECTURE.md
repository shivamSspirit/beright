# BeRight Architecture: Bloomberg Terminal for Prediction Markets

## Vision

BeRight becomes the **orchestration layer** for the prediction market ecosystem—not competing with existing tools, but **unifying them** into a single trading terminal.

---

## Core Philosophy

### Be the Router, Not the Rebuilder

| Capability | Strategy | Rationale |
|------------|----------|-----------|
| Market Data | INTEGRATE | Polymarket/Kalshi APIs already exist |
| Arb Detection | INTEGRATE | PolyScan, ArbPM do this well |
| Whale Tracking | INTEGRATE | Arkham Intelligence API |
| News Pipeline | INTEGRATE | Tavily, Perplexity |
| **Trade Execution** | **BUILD** | This is the moat |
| **AI Reasoning** | **BUILD** | Superforecaster methodology |
| **Unified Dashboard** | **BUILD** | This is the product |
| **Portfolio Mgmt** | **BUILD** | Cross-platform positions |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      BERIGHT ORCHESTRATION LAYER                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                      GATEWAY LAYER                           │   │
│   │  Telegram │ Web Terminal │ API │ Webhooks │ CLI              │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                     AGENT ORCHESTRATOR                       │   │
│   │                                                              │   │
│   │  ┌─────────┐  ┌──────────┐  ┌────────┐  ┌──────────────┐   │   │
│   │  │ SCOUT   │  │ ANALYST  │  │ TRADER │  │ RESEARCHER   │   │   │
│   │  │ • Scan  │  │ • Reason │  │ • Quote│  │ • Deep dive  │   │   │
│   │  │ • Alert │  │ • Prob   │  │ • Risk │  │ • Synthesis  │   │   │
│   │  │ • Triage│  │ • Edge   │  │ • Exec │  │ • Forecast   │   │   │
│   │  └─────────┘  └──────────┘  └────────┘  └──────────────┘   │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                       CORE MODULES                           │   │
│   │                                                              │   │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│   │  │ DATA FABRIC  │  │   SIGNALS    │  │   AI ANALYST     │   │   │
│   │  │              │  │              │  │                  │   │   │
│   │  │ Unified mkt  │  │ Whale alerts │  │ Superforecaster  │   │   │
│   │  │ Cross-plat   │  │ News events  │  │ Base rates       │   │   │
│   │  │ Deduplication│  │ Vol spikes   │  │ Evidence weight  │   │   │
│   │  │ Best prices  │  │ Arb opps     │  │ Calibration      │   │   │
│   │  └──────────────┘  └──────────────┘  └──────────────────┘   │   │
│   │                                                              │   │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│   │  │  PORTFOLIO   │  │  EXECUTION   │  │   RISK ENGINE    │   │   │
│   │  │              │  │              │  │                  │   │   │
│   │  │ Positions    │  │ Smart route  │  │ Max exposure     │   │   │
│   │  │ PnL tracking │  │ Split orders │  │ Correlation      │   │   │
│   │  │ Performance  │  │ Best exec    │  │ Drawdown limits  │   │   │
│   │  │ Tax lots     │  │ Atomic       │  │ Position sizing  │   │   │
│   │  └──────────────┘  └──────────────┘  └──────────────────┘   │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                   EVENT BUS (Real-time)                      │   │
│   │  market.update │ signal.new │ trade.exec │ alert.trigger     │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                EXTERNAL INTEGRATIONS                         │   │
│   │                                                              │   │
│   │  MARKETS           INTELLIGENCE        EXECUTION             │   │
│   │  ┌──────────┐     ┌──────────┐       ┌──────────┐           │   │
│   │  │Polymarket│     │Tavily    │       │Poly CLOB │           │   │
│   │  │Kalshi    │     │Perplexity│       │Kalshi API│           │   │
│   │  │Manifold  │     │Twitter/X │       │Manifold  │           │   │
│   │  │Metaculus │     │Arkham    │       │          │           │   │
│   │  │PredictIt │     │Dune      │       │          │           │   │
│   │  └──────────┘     └──────────┘       └──────────┘           │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Module Specifications

### 1. Data Fabric (`lib/dataFabric/`)

**Purpose:** Single source of truth for all market data across platforms.

```typescript
// lib/dataFabric/types.ts
interface UnifiedMarket {
  id: string;                    // BeRight canonical ID
  slug: string;                  // URL-friendly identifier
  question: string;              // Normalized question text
  category: MarketCategory;

  // Cross-platform data
  platforms: {
    platform: 'polymarket' | 'kalshi' | 'manifold' | 'metaculus';
    marketId: string;
    url: string;
    yesPrice: number;
    noPrice: number;
    volume24h: number;
    liquidity: number;
    lastUpdate: Date;
  }[];

  // Computed fields
  bestBid: number;               // Best YES price across platforms
  bestAsk: number;               // Best NO price across platforms
  arbitrageSpread?: number;      // If arb exists
  consensusPrice: number;        // Volume-weighted average

  // Metadata
  closeDate: Date;
  resolutionSource?: string;
  tags: string[];
}

interface MarketCategory {
  primary: 'politics' | 'crypto' | 'sports' | 'science' | 'entertainment' | 'economics';
  secondary?: string;
  tags: string[];
}
```

**Key Functions:**
```typescript
// Unified market fetching
async function getMarket(query: string): Promise<UnifiedMarket>;
async function searchMarkets(filters: MarketFilters): Promise<UnifiedMarket[]>;
async function getTrendingMarkets(limit: number): Promise<UnifiedMarket[]>;

// Cross-platform deduplication
async function deduplicateMarkets(markets: RawMarket[]): Promise<UnifiedMarket[]>;

// Price aggregation
function getBestExecution(market: UnifiedMarket, side: 'YES' | 'NO'): ExecutionPlan;
```

---

### 2. Signal Aggregator (`lib/signals/`)

**Purpose:** Centralize all alpha signals into a unified stream.

```typescript
// lib/signals/types.ts
type SignalType =
  | 'WHALE_BET'        // Large position detected
  | 'NEWS_CATALYST'    // Breaking news relevant to market
  | 'VOLUME_SPIKE'     // Unusual trading activity
  | 'ARB_OPPORTUNITY'  // Cross-platform price divergence
  | 'AI_MISPRICING'    // Model vs market disagreement
  | 'SMART_MONEY'      // Pro trader position change
  | 'SOCIAL_BUZZ'      // Twitter/social volume spike
  | 'RESOLUTION_NEAR'  // Market closing soon with edge
  | 'PRICE_MOMENTUM'   // Strong directional move

interface Signal {
  id: string;
  type: SignalType;
  market: UnifiedMarket;
  source: string;              // 'arkham', 'tavily', 'twitter', 'internal'

  // Signal metadata
  confidence: number;          // 0-1 scale
  urgency: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  expiresAt?: Date;            // Signal validity window

  // Type-specific data
  data: WhaleData | NewsData | VolumeData | ArbData | MispricingData;

  // Optional action
  suggestedAction?: {
    direction: 'YES' | 'NO';
    size: 'small' | 'medium' | 'large';
    reasoning: string;
  };
}

interface WhaleData {
  wallet: string;
  amount: number;
  direction: 'YES' | 'NO';
  historicalAccuracy?: number;
}

interface NewsData {
  headline: string;
  source: string;
  url: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  relevance: number;
}

interface ArbData {
  platform1: string;
  platform2: string;
  spread: number;
  requiredCapital: number;
  estimatedProfit: number;
}
```

**Signal Sources:**
| Source | Signal Types | Integration |
|--------|-------------|-------------|
| Arkham Intelligence | WHALE_BET, SMART_MONEY | API |
| Tavily/Perplexity | NEWS_CATALYST | API |
| Twitter/X | SOCIAL_BUZZ | API |
| Internal Detection | VOLUME_SPIKE, PRICE_MOMENTUM | Computed |
| Cross-platform | ARB_OPPORTUNITY | Computed |
| AI Models | AI_MISPRICING | Internal |

---

### 3. AI Analyst Layer (`lib/analyst/`)

**Purpose:** Apply superforecasting methodology to generate actionable insights.

```typescript
// lib/analyst/types.ts
interface AnalystOutput {
  market: UnifiedMarket;
  timestamp: Date;

  // Core prediction
  modelProbability: number;     // Our estimate
  marketProbability: number;    // Current market price
  edge: number;                 // model - market
  confidence: number;           // How sure are we?

  // Reasoning chain (transparent)
  reasoning: {
    baseRate: {
      estimate: number;
      source: string;           // "Historical incumbents lose 30%..."
    };
    recentEvidence: {
      item: string;
      direction: 'increases' | 'decreases';
      magnitude: 'slight' | 'moderate' | 'strong';
    }[];
    contrarian: string;         // Devil's advocate view
    uncertainties: string[];    // Known unknowns
    insideView: string;         // Specific to this case
    outsideView: string;        // Reference class reasoning
  };

  // Action recommendation
  recommendation: {
    action: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    direction: 'YES' | 'NO';
    conviction: number;         // Kelly fraction suggestion
    reasoning: string;
  };

  // Calibration tracking
  meta: {
    modelVersion: string;
    priorPredictions: number;
    priorAccuracy: number;
  };
}
```

**Superforecasting Methodology:**
```typescript
// lib/analyst/superforecaster.ts
async function analyze(market: UnifiedMarket): Promise<AnalystOutput> {
  // 1. OUTSIDE VIEW: Find reference class
  const baseRate = await estimateBaseRate(market);

  // 2. INSIDE VIEW: Gather specific evidence
  const evidence = await gatherEvidence(market);

  // 3. SYNTHESIS: Adjust base rate with evidence
  const adjusted = adjustProbability(baseRate, evidence);

  // 4. CONTRARIAN CHECK: Steel-man opposing view
  const contrarian = await generateContrarianView(market, adjusted);

  // 5. CALIBRATE: Avoid overconfidence
  const calibrated = applyCalibration(adjusted, confidence);

  // 6. EDGE CALCULATION
  const edge = calibrated - market.consensusPrice;

  return buildOutput(market, calibrated, edge, reasoning);
}
```

---

### 4. Portfolio Management (`lib/portfolio/`)

**Purpose:** Track positions across platforms, calculate P&L, manage risk.

```typescript
// lib/portfolio/types.ts
interface Portfolio {
  userId: string;

  // Positions across platforms
  positions: Position[];

  // Aggregated metrics
  totalValue: number;
  totalCost: number;
  unrealizedPnL: number;
  realizedPnL: number;

  // Risk metrics
  exposure: {
    byPlatform: Record<string, number>;
    byCategory: Record<string, number>;
    byTimeframe: {
      expiring7d: number;
      expiring30d: number;
      longTerm: number;
    };
    correlationMatrix: number[][];
  };

  // Performance metrics
  performance: {
    winRate: number;
    avgWin: number;
    avgLoss: number;
    sharpe: number;
    maxDrawdown: number;
    calmarRatio: number;
  };
}

interface Position {
  market: UnifiedMarket;
  platform: string;

  // Position details
  side: 'YES' | 'NO';
  shares: number;
  avgCost: number;
  currentPrice: number;

  // Computed
  value: number;
  pnl: number;
  pnlPercent: number;

  // Metadata
  openedAt: Date;
  notes?: string;
  tags?: string[];
}
```

---

### 5. Execution Engine (`lib/execution/`)

**Purpose:** Smart order routing for best execution across platforms.

```typescript
// lib/execution/types.ts
interface TradeIntent {
  market: UnifiedMarket;
  direction: 'YES' | 'NO';

  // Size specification
  size: number;                  // In dollars
  sizeType: 'notional' | 'shares';

  // Execution preferences
  maxSlippage: number;           // Max acceptable slippage %
  splitAcrossPlatforms: boolean; // Allow multi-venue execution
  urgency: 'patient' | 'normal' | 'urgent';

  // Risk controls
  maxCost?: number;
  stopLoss?: number;
  takeProfit?: number;
}

interface ExecutionPlan {
  intent: TradeIntent;

  // Planned execution
  legs: {
    platform: string;
    shares: number;
    expectedPrice: number;
    expectedCost: number;
  }[];

  // Projections
  totalCost: number;
  expectedAvgPrice: number;
  estimatedSlippage: number;

  // Warnings
  warnings: string[];
}

interface TradeResult {
  intent: TradeIntent;
  status: 'filled' | 'partial' | 'failed';

  fills: {
    platform: string;
    shares: number;
    price: number;
    cost: number;
    timestamp: Date;
    txHash?: string;
  }[];

  summary: {
    totalShares: number;
    avgPrice: number;
    totalCost: number;
    slippage: number;
  };
}
```

**Smart Order Routing:**
```typescript
// lib/execution/router.ts
async function executeTrade(intent: TradeIntent): Promise<TradeResult> {
  // 1. GET LIQUIDITY: Check depth across platforms
  const liquidity = await getLiquidityMap(intent.market);

  // 2. PLAN: Determine optimal split
  const plan = optimizeExecution(intent, liquidity);

  // 3. VALIDATE: Check risk limits
  await validateRiskLimits(plan);

  // 4. EXECUTE: Send orders (parallel if multi-venue)
  const results = await executeLegs(plan.legs);

  // 5. RECONCILE: Verify fills, update portfolio
  return reconcileFills(intent, results);
}
```

---

### 6. Risk Engine (`lib/risk/`)

**Purpose:** Protect capital with automated risk controls.

```typescript
// lib/risk/types.ts
interface RiskConfig {
  // Position limits
  maxPositionSize: number;       // Max $ per market
  maxPlatformExposure: number;   // Max $ per platform
  maxCategoryExposure: number;   // Max $ per category

  // Portfolio limits
  maxTotalExposure: number;      // Max total $ at risk
  maxCorrelation: number;        // Max correlation between positions

  // Drawdown controls
  dailyLossLimit: number;        // Stop trading if hit
  maxDrawdown: number;           // Hard stop

  // Position management
  defaultStopLoss: number;       // Auto stop-loss %
  trailingStop?: number;         // Trailing stop %
}

interface RiskCheck {
  allowed: boolean;
  warnings: string[];
  blockers: string[];
  suggestedSize?: number;        // If size needs reduction
}
```

---

## File Structure

```
beright-ts/
├── lib/
│   ├── dataFabric/
│   │   ├── index.ts              # Main exports
│   │   ├── types.ts              # TypeScript interfaces
│   │   ├── unifier.ts            # Market deduplication
│   │   ├── providers/
│   │   │   ├── polymarket.ts
│   │   │   ├── kalshi.ts
│   │   │   ├── manifold.ts
│   │   │   └── metaculus.ts
│   │   └── cache.ts              # Redis/memory caching
│   │
│   ├── signals/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── aggregator.ts         # Signal stream manager
│   │   ├── detectors/
│   │   │   ├── whale.ts          # Arkham integration
│   │   │   ├── news.ts           # Tavily integration
│   │   │   ├── volume.ts         # Internal detection
│   │   │   ├── arbitrage.ts      # Cross-platform spreads
│   │   │   └── social.ts         # Twitter/social
│   │   └── alerter.ts            # Notification dispatch
│   │
│   ├── analyst/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── superforecaster.ts    # Main analysis engine
│   │   ├── baserates.ts          # Reference class reasoning
│   │   ├── evidence.ts           # Evidence gathering
│   │   ├── calibration.ts        # Probability calibration
│   │   └── contrarian.ts         # Devil's advocate
│   │
│   ├── portfolio/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── tracker.ts            # Position tracking
│   │   ├── metrics.ts            # Performance calculation
│   │   └── reporting.ts          # P&L reports
│   │
│   ├── execution/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── router.ts             # Smart order routing
│   │   ├── connectors/
│   │   │   ├── polymarket.ts     # CLOB integration
│   │   │   ├── kalshi.ts
│   │   │   └── manifold.ts
│   │   └── reconciliation.ts     # Fill tracking
│   │
│   ├── risk/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── limits.ts             # Position limits
│   │   ├── drawdown.ts           # Drawdown controls
│   │   └── correlation.ts        # Portfolio correlation
│   │
│   └── terminal/                 # Web UI backend
│       ├── api.ts                # REST endpoints
│       ├── websocket.ts          # Real-time updates
│       └── charts.ts             # Charting data
│
├── skills/                       # Existing Telegram skills
│   └── ... (existing files)
│
├── web/                          # Terminal web UI
│   ├── pages/
│   │   ├── terminal.tsx          # Main terminal
│   │   ├── markets.tsx           # Market explorer
│   │   ├── portfolio.tsx         # Portfolio view
│   │   └── signals.tsx           # Signal feed
│   └── components/
│       ├── MarketCard.tsx
│       ├── SignalFeed.tsx
│       ├── TradePanel.tsx
│       └── PortfolioSummary.tsx
│
└── services/
    ├── heartbeat.ts              # Existing cognitive loop
    └── signalProcessor.ts        # Real-time signal processing
```

---

## Implementation Phases

### Phase 1: Data Fabric (Week 1-2)
- [ ] Design unified market schema
- [ ] Implement Polymarket provider
- [ ] Implement Kalshi provider
- [ ] Build market deduplication
- [ ] Add caching layer
- [ ] Create market search API

### Phase 2: Signal Aggregator (Week 2-3)
- [ ] Design signal types and schema
- [ ] Integrate Arkham for whale tracking
- [ ] Integrate Tavily for news
- [ ] Build internal volume spike detection
- [ ] Build arbitrage detection
- [ ] Create signal stream API

### Phase 3: AI Analyst (Week 3-4)
- [ ] Implement superforecaster methodology
- [ ] Build base rate estimation
- [ ] Build evidence gathering pipeline
- [ ] Implement calibration
- [ ] Create analysis API

### Phase 4: Portfolio Management (Week 4-5)
- [ ] Design position tracking schema
- [ ] Build cross-platform aggregation
- [ ] Implement P&L calculation
- [ ] Add performance metrics
- [ ] Create portfolio API

### Phase 5: Execution Engine (Week 5-6)
- [ ] Design execution interfaces
- [ ] Build Polymarket CLOB connector
- [ ] Build Kalshi connector
- [ ] Implement smart order routing
- [ ] Add fill reconciliation

### Phase 6: Web Terminal (Week 6-8)
- [ ] Design terminal layout
- [ ] Build market explorer
- [ ] Build signal feed
- [ ] Build trade panel
- [ ] Build portfolio view
- [ ] Add real-time updates

---

## Integration Strategy (Collaborative, Not Competitive)

Instead of building everything from scratch, leverage existing tools:

| Capability | Partner/Integration | How We Add Value |
|------------|---------------------|------------------|
| Arb Detection | PolyScan, ArbPM | Unified alerts + execution |
| Whale Tracking | Arkham Intelligence | Contextual analysis |
| News | Tavily, Perplexity | Market-specific filtering |
| Analytics | Dune, Hunchbot | Actionable signals |
| Forecasting | Metaculus, GJP | Calibrated ensemble |

**Key Insight:** We're not replacing these tools—we're making them more valuable by connecting them.

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Daily Active Users | 1000+ | Terminal logins |
| Execution Volume | $1M+/month | Trades through platform |
| Signal Accuracy | >60% | Profitable signals |
| Latency | <500ms | API response time |
| Uptime | 99.9% | Service availability |

---

## Security Considerations

1. **API Keys**: Never store user exchange credentials server-side
2. **Trading**: Require explicit confirmation for large trades
3. **Risk**: Hard-coded maximum position limits
4. **Audit**: Full trade logging with immutable records
5. **Privacy**: No selling of user trading data

---

## Next Steps

1. Review and approve this architecture
2. Start with Phase 1: Data Fabric
3. Iterate based on user feedback

The goal: **Make BeRight the one place traders go to understand and trade prediction markets.**
