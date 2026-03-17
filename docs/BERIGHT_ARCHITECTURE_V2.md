# BeRight Protocol V2 Architecture

## Four Pillars of BeRight

Based on existing infrastructure analysis, here's the unified architecture addressing all four problem areas.

---

## PILLAR 1: Prediction Market Aggregation Layer (Predikt-Style)

### Current State
- **DataFabric**: 5-platform aggregation (Polymarket, Kalshi, Manifold, Jupiter, Limitless)
- **Matching**: Jaccard similarity + 6-stage pipeline (50% threshold)
- **Arbitrage**: 2%+ spread detection with fee calculations

### Enhancement: ML-Powered Market Matching Engine

```
┌─────────────────────────────────────────────────────────────────┐
│                    BERIGHT AGGREGATION LAYER                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐            │
│  │ Polymarket  │   │   Kalshi    │   │  Manifold   │            │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘            │
│         │                 │                 │                    │
│         └────────────┬────┴────────────────┘                    │
│                      ▼                                           │
│         ┌────────────────────────┐                              │
│         │   DATA FABRIC          │                              │
│         │   - Unified Schema     │                              │
│         │   - 30s Cache          │                              │
│         │   - Provider Registry  │                              │
│         └──────────┬─────────────┘                              │
│                    ▼                                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              ML MATCHING ENGINE (NEW)                    │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │                                                          │    │
│  │  Stage 1: EMBEDDING LAYER                                │    │
│  │  ├─ Sentence Transformer (all-MiniLM-L6-v2)             │    │
│  │  ├─ 384-dim embeddings per market question              │    │
│  │  └─ Batch processing for efficiency                     │    │
│  │                                                          │    │
│  │  Stage 2: ENTITY EXTRACTION (SpaCy/Custom NER)          │    │
│  │  ├─ People: Trump, Biden, Musk                          │    │
│  │  ├─ Organizations: Fed, SEC, Tesla                      │    │
│  │  ├─ Dates: "by December 2025", "Q3 2024"               │    │
│  │  ├─ Amounts: "$100K", "3%", "100bps"                   │    │
│  │  └─ Events: "Super Bowl", "Election"                    │    │
│  │                                                          │    │
│  │  Stage 3: SIMILARITY SCORING                             │    │
│  │  ├─ Cosine similarity on embeddings (40%)               │    │
│  │  ├─ Entity overlap score (30%)                          │    │
│  │  ├─ Date alignment (15%)                                │    │
│  │  └─ Category match (15%)                                │    │
│  │                                                          │    │
│  │  Stage 4: CONFIDENCE CALIBRATION                         │    │
│  │  ├─ Historical match accuracy feedback                  │    │
│  │  ├─ Resolution correlation tracking                     │    │
│  │  └─ False positive penalty learning                     │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                    ▼                                             │
│         ┌────────────────────────┐                              │
│         │   UNIFIED FEED         │                              │
│         │   - Matched Events     │                              │
│         │   - Consensus Prices   │                              │
│         │   - Arb Opportunities  │                              │
│         └────────────────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation: `beright-ts/lib/ml/marketMatcher.ts`

```typescript
// ML Market Matcher using embeddings
interface MLMatchResult {
  eventId: string;           // Canonical BeRight event ID
  markets: PlatformMarket[]; // All platform markets for this event
  matchConfidence: number;   // 0-1 ML confidence
  consensusPrice: number;    // Volume-weighted YES price
  priceSpread: number;       // Max - Min price across platforms
  totalLiquidity: number;    // Sum of platform liquidity
  arbitrage?: ArbitrageOpp;  // If spread > threshold
}

// Embedding cache for efficiency
const embeddingCache = new Map<string, Float32Array>();

async function computeEmbedding(text: string): Promise<Float32Array> {
  // Use sentence-transformers via ONNX runtime
  // or call HuggingFace Inference API
}

async function matchMarkets(markets: RawMarket[]): Promise<MLMatchResult[]> {
  // 1. Compute embeddings for all markets
  const embeddings = await Promise.all(
    markets.map(m => computeEmbedding(m.question))
  );

  // 2. Cluster by cosine similarity > 0.85
  const clusters = clusterBySimilarity(embeddings, 0.85);

  // 3. Validate clusters with entity matching
  const validatedClusters = clusters.map(cluster =>
    validateWithEntities(cluster, markets)
  );

  // 4. Create unified events
  return validatedClusters.map(createUnifiedEvent);
}
```

### Feed Types for Terminal UI

| Feed | Description | Use Case |
|------|-------------|----------|
| **Hot Markets** | High volume, multiple platforms | Discovery |
| **Closing Soon** | < 24h to resolution | Urgency trading |
| **Price Divergence** | Same event, different prices | Arbitrage |
| **New Markets** | < 24h old, gaining traction | Early alpha |
| **Category Feeds** | Politics, Crypto, Sports, etc. | Focused browsing |

---

## PILLAR 2: Forecaster-Capitalist Mediator

### Concept
Connect skilled forecasters (track record) with capital providers (investors).

```
┌─────────────────────────────────────────────────────────────────┐
│               FORECASTER-CAPITALIST MARKETPLACE                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FORECASTERS                         CAPITALISTS                 │
│  ┌─────────────┐                    ┌─────────────┐             │
│  │ Track Record│                    │   Capital   │             │
│  │ Brier Score │                    │   Pools     │             │
│  │ Calibration │                    │   Vaults    │             │
│  └──────┬──────┘                    └──────┬──────┘             │
│         │                                  │                     │
│         └──────────────┬───────────────────┘                    │
│                        ▼                                         │
│         ┌────────────────────────────────────────┐              │
│         │         MEDIATOR PROTOCOL              │              │
│         ├────────────────────────────────────────┤              │
│         │                                        │              │
│         │  1. FORECASTER PROFILES (On-chain)    │              │
│         │     - Calibration Program Brier       │              │
│         │     - Historical accuracy by category │              │
│         │     - Resolution count                │              │
│         │     - Specializations                 │              │
│         │                                        │              │
│         │  2. CAPITAL POOLS (Staking Pool)      │              │
│         │     - Tournament Pools                │              │
│         │     - Alpha Vaults                    │              │
│         │     - Index Pools                     │              │
│         │                                        │              │
│         │  3. MATCHING ENGINE                   │              │
│         │     - Forecaster applies to pool      │              │
│         │     - Pool owner reviews track record │              │
│         │     - Stake requirement (skin in game)│              │
│         │     - Performance-based fees (20%)    │              │
│         │                                        │              │
│         │  4. SLASHING (Calibration-Based)      │              │
│         │     - Brier > 0.30 triggers warning   │              │
│         │     - Sustained poor performance      │              │
│         │     - 10% slash to treasury           │              │
│         │                                        │              │
│         └────────────────────────────────────────┘              │
│                        ▼                                         │
│         ┌────────────────────────────────────────┐              │
│         │        EXECUTION FLOW                  │              │
│         │                                        │              │
│         │  Forecaster → Signal → Pool validates  │              │
│         │       ↓                                │              │
│         │  Trade executes via Jupiter/Polymarket │              │
│         │       ↓                                │              │
│         │  P&L attributed to forecaster          │              │
│         │       ↓                                │              │
│         │  Fees split: 80% LP / 20% Forecaster   │              │
│         └────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### Data Model

```typescript
// Forecaster Profile (On-chain via Calibration Program)
interface ForecasterProfile {
  pubkey: string;
  brierScore: number;         // 0 = perfect, 0.25 = random
  logScore: number;           // Alternative scoring
  predictionCount: number;
  resolutionCount: number;
  calibrationByCategory: Record<Category, number>;
  streakDays: number;
  specializations: Category[];
  verificationLevel: 'anonymous' | 'verified' | 'super';
}

// Capital Pool (Staking Pool Program)
interface CapitalPool {
  poolId: string;
  poolType: 'tournament' | 'alphaVault' | 'indexPool';
  aum: number;                // Assets under management
  nav: number;                // Net asset value per share
  performanceFee: number;     // 20% default
  managementFee: number;      // 2% annual
  forecasterRequirements: {
    minBrierScore: number;    // e.g., < 0.20
    minPredictions: number;   // e.g., > 50
    requiredStake: number;    // Skin in game
  };
  activeForecasters: string[];
  depositors: DepositorState[];
}

// Forecaster Application
interface ForecasterApplication {
  forecaster: string;
  pool: string;
  proposedStake: number;
  trackRecordProof: string;   // On-chain calibration PDA
  status: 'pending' | 'approved' | 'rejected' | 'slashed';
}
```

---

## PILLAR 3: Automated Alpha Signal Layer

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ALPHA SIGNAL TERMINAL                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   SIGNAL SOURCES                         │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │                                                          │    │
│  │  1. AGENT SIGNALS (Multi-Agent System)                  │    │
│  │     ┌─────────┐  ┌──────────┐  ┌─────────┐             │    │
│  │     │  SCOUT  │  │ ANALYST  │  │ TRADER  │             │    │
│  │     │ <2s     │  │ 5-15s    │  │ <3s     │             │    │
│  │     │ No LLM  │  │ LLM Deep │  │ Execute │             │    │
│  │     └────┬────┘  └────┬─────┘  └────┬────┘             │    │
│  │          │            │             │                   │    │
│  │          └────────────┴─────────────┘                   │    │
│  │                       ▼                                 │    │
│  │     ┌─────────────────────────────┐                    │    │
│  │     │     SIGNAL AGGREGATOR       │                    │    │
│  │     └─────────────────────────────┘                    │    │
│  │                                                          │    │
│  │  2. MARKET SIGNALS (DataFabric)                         │    │
│  │     - Price spikes (>5% in 1hr)                         │    │
│  │     - Volume surges (>3x average)                       │    │
│  │     - Arbitrage opportunities (>2% spread)              │    │
│  │     - New market listings                               │    │
│  │     - Resolution approaching                            │    │
│  │                                                          │    │
│  │  3. WHALE SIGNALS (Helius RPC)                          │    │
│  │     - Large position changes (>$10K)                    │    │
│  │     - Smart money wallet tracking                       │    │
│  │     - Position accumulation patterns                    │    │
│  │                                                          │    │
│  │  4. NEWS SIGNALS (Tavily + RSS)                         │    │
│  │     - Market-relevant news detection                    │    │
│  │     - Sentiment shifts                                  │    │
│  │     - Resolution triggers                               │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  SIGNAL PROCESSING                       │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │                                                          │    │
│  │  Signal Schema:                                          │    │
│  │  {                                                       │    │
│  │    id: string,                                           │    │
│  │    type: 'ALPHA' | 'ARB' | 'WHALE' | 'NEWS' | 'PRICE',  │    │
│  │    market: UnifiedMarket,                                │    │
│  │    direction: 'YES' | 'NO',                              │    │
│  │    confidence: 0.0 - 1.0,                                │    │
│  │    expectedValue: number,                                │    │
│  │    reasoning: string,                                    │    │
│  │    source: 'SCOUT' | 'ANALYST' | 'SYSTEM',              │    │
│  │    urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',     │    │
│  │    expiresAt: Date,                                      │    │
│  │    metadata: { ... }                                     │    │
│  │  }                                                       │    │
│  │                                                          │    │
│  │  Priority Scoring:                                       │    │
│  │  - Confidence × EV × Urgency × Source Trust             │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  DELIVERY CHANNELS                       │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │                                                          │    │
│  │  Terminal UI (SSE Stream)   │  Telegram Bot              │    │
│  │  └─ Real-time signal feed   │  └─ @BeRightBot alerts     │    │
│  │  └─ Priority sorting        │  └─ Subscriber channels    │    │
│  │  └─ One-click execution     │  └─ /signal command        │    │
│  │                              │                            │    │
│  │  Webhook API                 │  Email Digest              │    │
│  │  └─ B2B integrations        │  └─ Daily/Weekly summary   │    │
│  │  └─ Custom filters          │  └─ Top opportunities      │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Signal Types & Priority

| Signal Type | Source | Urgency | Auto-Execute |
|-------------|--------|---------|--------------|
| **ARBITRAGE** | DataFabric | CRITICAL | Yes (if configured) |
| **WHALE_MOVE** | Helius | HIGH | No |
| **ANALYST_ALPHA** | Analyst Agent | MEDIUM | No |
| **PRICE_SPIKE** | DataFabric | HIGH | No |
| **NEWS_CATALYST** | Tavily | MEDIUM | No |
| **RESOLUTION_SOON** | DataFabric | LOW | No |

---

## PILLAR 4: Prediction Markets as DeFi Primitive

### Existing Infrastructure
- **Staking Pool Program**: Tournament, AlphaVault, IndexPool
- **veToken Governance**: Lock duration → voting power
- **Slashing**: Calibration-based penalties

### Enhancement: LP Mechanisms

```
┌─────────────────────────────────────────────────────────────────┐
│              PREDICTION MARKET DEFI PRIMITIVES                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              1. PREDICTION LP POOLS                      │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │                                                          │    │
│  │  Unlike AMM LPs, prediction market LPs provide:         │    │
│  │  - Capital for market making (YES/NO liquidity)         │    │
│  │  - Earn spread from bid-ask                             │    │
│  │  - Risk: Resolution outcome                             │    │
│  │                                                          │    │
│  │  Pool Structure:                                         │    │
│  │  ┌─────────────────────────────────────────┐            │    │
│  │  │  USDC Deposit                           │            │    │
│  │  │       ↓                                 │            │    │
│  │  │  LP Tokens minted (brLP-USDC)          │            │    │
│  │  │       ↓                                 │            │    │
│  │  │  Capital deployed to markets            │            │    │
│  │  │  ├─ 40% High-confidence markets        │            │    │
│  │  │  ├─ 40% Medium-confidence markets      │            │    │
│  │  │  └─ 20% Reserve for withdrawals        │            │    │
│  │  │       ↓                                 │            │    │
│  │  │  Yield = Spread earned - Losses        │            │    │
│  │  └─────────────────────────────────────────┘            │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              2. OUTCOME TOKEN STAKING                    │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │                                                          │    │
│  │  Stake YES/NO tokens from active positions:             │    │
│  │  - Earn yield while waiting for resolution              │    │
│  │  - Tokens locked until market resolves                  │    │
│  │  - Yield from protocol fees + Sanctum INF routing       │    │
│  │                                                          │    │
│  │  Flow:                                                   │    │
│  │  YES Token → Stake in BeRight Vault                     │    │
│  │       ↓                                                 │    │
│  │  Idle USDC collateral → Sanctum INF                     │    │
│  │       ↓                                                 │    │
│  │  Yield accrues to staker                                │    │
│  │       ↓                                                 │    │
│  │  Resolution: Token + Yield returned                     │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              3. ALPHA VAULT STRATEGIES                   │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │                                                          │    │
│  │  Managed vaults with specific strategies:               │    │
│  │                                                          │    │
│  │  ┌─────────────────┐  ┌─────────────────┐              │    │
│  │  │  ARB HUNTER     │  │  TREND FOLLOWER │              │    │
│  │  │  ───────────    │  │  ─────────────  │              │    │
│  │  │  Target: 15% APY│  │  Target: 25% APY│              │    │
│  │  │  Risk: Low      │  │  Risk: Medium   │              │    │
│  │  │  Strategy:      │  │  Strategy:      │              │    │
│  │  │  Cross-platform │  │  Momentum on    │              │    │
│  │  │  arbitrage only │  │  high-volume    │              │    │
│  │  │                 │  │  markets        │              │    │
│  │  └─────────────────┘  └─────────────────┘              │    │
│  │                                                          │    │
│  │  ┌─────────────────┐  ┌─────────────────┐              │    │
│  │  │  AI FORECASTER  │  │  INDEX FUND     │              │    │
│  │  │  ─────────────  │  │  ──────────     │              │    │
│  │  │  Target: 40% APY│  │  Target: 10% APY│              │    │
│  │  │  Risk: High     │  │  Risk: Low      │              │    │
│  │  │  Strategy:      │  │  Strategy:      │              │    │
│  │  │  Analyst agent  │  │  Diversified    │              │    │
│  │  │  driven trades  │  │  basket of top  │              │    │
│  │  │                 │  │  markets        │              │    │
│  │  └─────────────────┘  └─────────────────┘              │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              4. veBeRight GOVERNANCE                     │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │                                                          │    │
│  │  Lock Duration → Voting Power → Benefits                │    │
│  │                                                          │    │
│  │  ┌────────────┬─────────────┬──────────────────┐        │    │
│  │  │ Lock Time  │ Multiplier  │ Benefits         │        │    │
│  │  ├────────────┼─────────────┼──────────────────┤        │    │
│  │  │ 1 week     │ 1.0x        │ Basic voting     │        │    │
│  │  │ 1 month    │ 1.25x       │ + Fee discount   │        │    │
│  │  │ 6 months   │ 1.75x       │ + Signal access  │        │    │
│  │  │ 1 year     │ 2.0x        │ + Alpha vaults   │        │    │
│  │  │ 4 years    │ 2.5x        │ + Revenue share  │        │    │
│  │  └────────────┴─────────────┴──────────────────┘        │    │
│  │                                                          │    │
│  │  Governance Powers:                                      │    │
│  │  - Vote on fee parameters                               │    │
│  │  - Vote on platform integrations                        │    │
│  │  - Vote on forecaster slashing                          │    │
│  │  - Vote on treasury allocation                          │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Roadmap

### Phase 1: ML Aggregation (2 weeks)
- [ ] Implement embedding-based market matching
- [ ] Deploy sentence-transformer ONNX model
- [ ] Create unified feed API for terminal
- [ ] Build aggregated market cards UI

### Phase 2: Alpha Signal Layer (2 weeks)
- [ ] Create Signal schema and SSE stream
- [ ] Implement signal scoring/prioritization
- [ ] Add signal feed to terminal UI
- [ ] Enable one-click execution from signals

### Phase 3: Forecaster-Capitalist Mediator (3 weeks)
- [ ] Forecaster profile page (track record display)
- [ ] Pool application flow
- [ ] Integration with existing Staking Pool program
- [ ] Slashing integration with Calibration program

### Phase 4: LP Mechanisms (3 weeks)
- [ ] Prediction LP pool smart contract
- [ ] Outcome token staking
- [ ] Sanctum INF integration
- [ ] Alpha vault strategies

---

## Key Differentiators vs Predikt

| Feature | Predikt | BeRight |
|---------|---------|---------|
| **Core Focus** | Infrastructure layer for other apps | End-user terminal + infrastructure |
| **Aggregation** | ML + LLM hybrid | ML embeddings + entity matching |
| **Execution** | Cross-chain solvers | Jupiter + Polymarket direct |
| **Unique** | Solver network | AI agents + Forecaster reputation |
| **DeFi** | Not core | Staking, LP, veTokens |
| **Alpha** | N/A | Automated signal generation |

---

## Files to Create

```
beright-ts/
├── lib/ml/
│   ├── embeddings.ts      # Sentence transformer integration
│   ├── marketMatcher.ts   # ML-based market matching
│   └── entityExtractor.ts # NER for market analysis
├── lib/signals/
│   ├── types.ts           # Signal schema
│   ├── aggregator.ts      # Multi-source signal aggregation
│   ├── scorer.ts          # Priority scoring
│   └── stream.ts          # SSE delivery
├── lib/mediator/
│   ├── forecasterProfile.ts
│   ├── poolApplication.ts
│   └── performanceTracker.ts
└── lib/defi/
    ├── predictionLP.ts    # LP pool logic
    ├── outcomeStaking.ts  # Token staking
    └── alphaVault.ts      # Strategy vaults
```

---

*Generated by BeRight Protocol Architecture Team*
