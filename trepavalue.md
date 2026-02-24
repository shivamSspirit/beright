# Trepa + BeRight: Strategic Integration Analysis

> **Thesis**: Trepa is not a competitor — it's a multiplier for BeRight. Integrating Trepa makes BeRight the first prediction market intelligence platform spanning both binary probability markets AND numerical precision markets.

---

## Table of Contents

1. [Trepa Overview](#trepa-overview)
2. [Core Mechanics](#core-mechanics)
3. [Trepa V2: AI-Native](#trepa-v2-ai-native)
4. [Strategic Value for BeRight](#strategic-value-for-beright)
5. [Integration Opportunities](#integration-opportunities)
6. [Implementation Roadmap](#implementation-roadmap)
7. [Competitive Positioning](#competitive-positioning)

---

## Trepa Overview

### What is Trepa?

**Trepa** is a precision-based prediction platform on Solana where users forecast **exact numerical outcomes** rather than binary yes/no predictions. The closer your prediction to the actual outcome, the higher your payout — creating a continuous reward spectrum rather than binary win/lose.

### Philosophy: Galton's Wisdom of Crowds

Trepa draws inspiration from Francis Galton's 1906 ox-weight guessing competition in Plymouth:
- 878 participants' median estimate: 1,207 pounds
- Actual weight: 1,198 pounds
- Error: Only 0.8%

**Key insight**: Individual precision drives collective signal quality through competitive incentives. Galton noted that "the sixpenny fee deterred practical joking, and the hope of a prize and the joy of competition prompted each competitor" toward accuracy.

### Funding & Backing

| Investor | Amount | Notes |
|----------|--------|-------|
| **Colosseum** (Lead) | Part of $420K | Solana ecosystem accelerator, founded by former Solana Foundation Growth Director |
| **Balaji Fund** | $100K | Balaji Srinivasan, former CTO of Coinbase |
| **Ignight Capital** | Part of $420K | — |
| **Angel Syndicate** | Part of $420K | Prominent crypto angels |

### Achievements

- 🥇 1st Place — Colosseum Breakout Hackathon (1,412 submissions)
- 🥇 1st Place — Solana Korea Hackathon
- 🥇 1st Place — Sonic SVM MOBIUS
- 🥈 2nd Place — Web3 Unleashed (Dubai)
- 2,000+ beta users
- Live on Solana Mobile dApp Store

### Team

- **Cofounders**: Jong and Leon
- **Established**: Singapore, 2024
- **Background**: Cross-disciplinary expertise

---

## Core Mechanics

### How Trepa Works

| Aspect | Description |
|--------|-------------|
| **Prediction Model** | Users slide to a specific number (not binary YES/NO) |
| **Payout Structure** | Convex, accuracy-score and time-weighted pari-mutuel |
| **Stake Mechanism** | Users back forecasts with skin in the game |
| **Reward Distribution** | Continuous — closer predictions earn more, even "close misses" get partial returns |
| **Resolution** | Official, verifiable data sources (government releases, etc.) |

### Three-Step Process

```
1. SLIDE TO YOUR BEST GUESS
   └── Set predictions on intuitive slider interface
   └── Granular precision (not just YES/NO)

2. STAKE YOUR CONVICTION
   └── Back your forecast with USDC
   └── Skin in the game incentivizes accuracy

3. CLAIM CASH AND CLOUT
   └── Win if accuracy exceeds peer performance
   └── Climb leaderboards, build reputation
```

### What Users Can Predict

- **Economic Indicators**: CPI, job reports, Fed rates
- **Market Data**: Stock prices, earnings
- **Crypto Metrics**: ETH gas fees, token volumes, prices
- **Macro Signals**: GDP, inflation, unemployment

### Technical Infrastructure

| Component | Implementation |
|-----------|----------------|
| **Blockchain** | Solana mainnet |
| **Currency** | USDC stablecoin |
| **Transaction Cost** | < $0.01 |
| **Confirmation Time** | < 400 milliseconds |
| **Smart Contracts** | Automated staking and payouts |
| **Custody** | Non-custodial (user wallet control) |
| **Security Audit** | Completed by Adevar Labs |
| **Outcome Verification** | On-chain, immutable, verifiable sources |

### Reward Mechanics

```
TREPA REWARD STRUCTURE

Traditional Binary Market:
├── RIGHT → Win full payout
└── WRONG → Lose stake

Trepa Precision Market:
├── EXACT → Maximum payout (exponential)
├── VERY CLOSE → High payout
├── CLOSE → Moderate payout
├── SOMEWHAT CLOSE → Partial payout
└── FAR OFF → Minimal/no payout

Result: Lower risk, rewards analytical precision over luck
```

### Competitive Features

- **Leaderboards**: Track forecasting skill and ranking
- **Streakpots**: Compound rewards for consistent accuracy
- **Social Proof**: Public track records of forecasting ability

---

## Trepa V2: AI-Native

### The Shift to AI-Native

Trepa V2 represents a fundamental evolution:

| V1 (Current) | V2 (Coming) |
|--------------|-------------|
| Human forecasters | **AI-native** — bots, agents, models explicitly encouraged |
| General prediction pools | **Short-term recurring pools** |
| Individual competition | **Pipeline optimization** for forecasting edge |
| Manual participation | **Automated trading systems** welcome |
| — | **Early participant program** to shape mechanics, APIs, incentives |

### V2 Design Philosophy

> "Trepa V2 is all about short-term prediction pools. This version is AI-native. Bots, agents, trading models, custom pipelines — bring them. Usage of AI is explicitly encouraged. Compete in recurring pools, optimize for precision, and stress-test your forecasting edge in real time."

### What This Means

1. **API-First Design**: Building for programmatic access
2. **Bot-Friendly**: No penalties for automated trading
3. **Recurring Pools**: Continuous opportunities, not one-off markets
4. **Precision Optimization**: Edge comes from accuracy algorithms
5. **Early Access Program**: Shape the platform before public launch

---

## Strategic Value for BeRight

### 1. 6th Platform Integration — Numerical Prediction Data

BeRight currently aggregates 5 platforms — all **binary** prediction markets:

```
BERIGHT PLATFORM COVERAGE (Current → Proposed)

Binary Markets (YES/NO):
├── Polymarket ✅
├── Kalshi ✅
├── Manifold ✅
├── Metaculus ✅
└── Limitless ✅

Numerical Precision Markets (NEW):
└── Trepa 🔲 ← INTEGRATION OPPORTUNITY
```

**Value**: BeRight becomes the ONLY aggregator covering both binary AND numerical prediction markets.

### 2. New Signal Types

BeRight's 11 signal types are all binary-market focused. Trepa enables new categories:

| New Signal Type | Description | Example |
|-----------------|-------------|---------|
| **Numerical Convergence** | Trepa crowd median aligns with binary market odds | "Trepa crowd predicts BTC at $105,200. Kalshi 'BTC above $100k' at 78% → Convergent signal" |
| **Precision Divergence** | Binary odds contradict numerical consensus | "Trepa median: 4.1% CPI. Kalshi 'CPI above 4%' at 35% → Anomaly" |
| **Top Forecaster Numerical** | Trepa's most accurate forecasters make bold predictions | "Top 5 Trepa forecasters cluster around 3.8% CPI" |
| **Numerical Momentum** | Shifting numerical consensus over time | "Trepa CPI median moved from 3.2% to 3.8% in 24 hours" |

### 3. AI Forecaster Proving Ground

Trepa V2 is explicitly **AI-native**. Perfect testing arena for BeRight's intelligence engine.

```
BERIGHT AI → TREPA COMPETITION PIPELINE

1. BeRight AI generates numerical forecasts
   └── Uses superforecaster methodology
   └── Analyzes base rates, evidence, biases

2. Submit predictions to Trepa pools
   └── Economic data: CPI, jobs, rates
   └── Crypto metrics: ETH gas, token volumes

3. Build public, verifiable track record
   └── On-chain Solana commits
   └── Accuracy scores visible to all

4. Use track record for BeRight credibility
   └── "BeRight AI: Precision Score 0.94 on Trepa economic pools"
   └── Attracts capital to BeRight Vaults
```

**Value**: BeRight AI becomes a **verified superforecaster** with on-chain proof.

### 4. Cross-Platform Arbitrage: Binary vs Numerical

New arbitrage opportunities emerge when binary market odds diverge from numerical consensus:

```
EXAMPLE ARBITRAGE SCENARIO

KALSHI: "Will CPI be above 4.0%?" — 62% YES
TREPA: Crowd median prediction — 3.85% CPI

ANALYSIS:
├── Trepa's numerical crowd says BELOW 4.0%
├── Kalshi odds say ABOVE 4.0%
└── Potential arbitrage: Bet NO on Kalshi (38% odds)
    if Trepa crowd (wisdom of crowds) is more accurate

BERIGHT SIGNAL:
"⚡ Binary-Numerical Divergence Alert"
"Trepa median: 3.85% CPI"
"Kalshi 'CPI >4%' at 62% YES"
"Edge: 24%+ if Trepa crowd is calibrated"
```

### 5. Enhanced Forecaster Reputation Layer

BeRight's unique value is **verified forecaster track records**. Trepa adds another dimension:

| Current BeRight Metrics | + Trepa Metrics |
|------------------------|-----------------|
| Brier score (binary) | Numerical precision score |
| Calibration curves | Continuous accuracy distribution |
| Domain expertise badges | Macro/Economic specialist validation |
| Win/loss record | Proximity-based scoring |

**Enhanced Forecaster Profile**:

```
┌─────────────────────────────────────────────────────┐
│  @jane_superforecaster                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│                                                     │
│  BINARY MARKETS (Polymarket, Kalshi, etc.)         │
│  🎯 Brier Score: 0.12 (Top 2%)                     │
│  📊 342 verified predictions                        │
│                                                     │
│  NUMERICAL MARKETS (Trepa)                          │
│  📈 Precision Score: 0.94 (Top 5%)                 │
│  📊 156 verified numerical predictions              │
│                                                     │
│  COMBINED                                           │
│  🏆 Rank: #7 Global                                │
│  💼 Specialization: Economic Indicators ⭐⭐⭐⭐⭐     │
│                                                     │
│  [📈 VIEW VAULT]  [📋 FULL HISTORY]  [🔔 FOLLOW]  │
└─────────────────────────────────────────────────────┘
```

### 6. New Vault Strategy: Macro Economic Pool

BeRight's Vault system can add a new strategy type powered by Trepa:

| Vault Type | Platform | Strategy |
|------------|----------|----------|
| Politics Vault | Polymarket/Kalshi | US elections, policy |
| Crypto Vault | Polymarket/Limitless | Token prices, events |
| **Macro Vault (NEW)** | **Trepa + Kalshi** | CPI, jobs, Fed rates |
| Arb Vault | All | Cross-platform spreads |

**Macro Vault Logic**:

```
MACRO VAULT STRATEGY

1. INTELLIGENCE GATHERING
   └── Trepa numerical consensus for CPI, jobs, rates
   └── BeRight AI analysis of macro indicators

2. SIGNAL GENERATION
   └── Cross-reference with Kalshi binary odds
   └── Identify divergences = alpha opportunities

3. EXECUTION
   └── Position on Trepa (numerical precision)
   └── Position on Kalshi (binary hedge)

4. PROFIT CAPTURE
   └── Precision rewards from Trepa
   └── Binary payouts from Kalshi
   └── Arbitrage spread when divergent
```

### 7. Conviction Score Enhancement

BeRight's Conviction Score measures cross-cluster agreement on binary markets.

**Trepa adds numerical precision to conviction**:

```
ENHANCED CONVICTION SCORE = f(
  superforecaster_binary_consensus,    ← Current
  domain_expert_binary_consensus,      ← Current
  whale_position_direction,            ← Current
  sharp_money_direction,               ← Current
  trepa_numerical_median,              ← NEW
  trepa_top_forecaster_cluster,        ← NEW
  binary_numerical_alignment           ← NEW
)
```

When binary odds AND Trepa numerical consensus align → **highest conviction signal**.

---

## Integration Opportunities

### Technical Integration Points

#### 1. Data Ingestion

```typescript
// Trepa API Integration (Proposed)
interface TrepaPool {
  poolId: string;
  question: string;
  category: 'economic' | 'crypto' | 'macro';
  currentMedian: number;
  currentMean: number;
  participantCount: number;
  totalStaked: number;
  resolutionSource: string;
  resolutionTime: Date;
  topForecasterPredictions: TrepaPrediction[];
}

interface TrepaPrediction {
  forecaster: string;
  prediction: number;
  stake: number;
  timestamp: Date;
  historicalPrecision: number;
}

// BeRight Trepa Service
class TrepaService {
  async getActivePools(): Promise<TrepaPool[]>;
  async getPoolConsensus(poolId: string): Promise<ConsensusData>;
  async getTopForecasters(): Promise<Forecaster[]>;
  async submitPrediction(poolId: string, value: number, stake: number): Promise<TxHash>;
}
```

#### 2. Signal Detection Engine

```typescript
// New Signal Types for Trepa
enum TrepaSignalType {
  NUMERICAL_CONVERGENCE = 'numerical_convergence',
  PRECISION_DIVERGENCE = 'precision_divergence',
  TOP_FORECASTER_CLUSTER = 'top_forecaster_cluster',
  NUMERICAL_MOMENTUM = 'numerical_momentum',
  BINARY_NUMERICAL_ARB = 'binary_numerical_arb',
}

interface TrepaSignal {
  type: TrepaSignalType;
  trepaPoolId: string;
  relatedBinaryMarkets: string[]; // Kalshi, Polymarket market IDs
  numericalConsensus: number;
  binaryOdds: number;
  divergencePercent: number;
  confidence: number;
  actionableInsight: string;
}
```

#### 3. Arbitrage Detection

```typescript
// Binary vs Numerical Arbitrage
interface BinaryNumericalArbitrage {
  trepaPool: TrepaPool;
  binaryMarket: Market; // Kalshi or Polymarket
  trepaMedian: number;
  binaryThreshold: number; // e.g., "CPI above 4%"
  binaryOdds: number;
  impliedDirection: 'above' | 'below';
  trepaImpliedDirection: 'above' | 'below';
  divergent: boolean;
  potentialEdge: number;
  recommendation: string;
}
```

### API Partnership

Trepa V2 is onboarding early participants to shape APIs. BeRight should:

1. **Join early access** — influence API design for aggregation needs
2. **Build integration** — real-time Trepa data feed
3. **Co-develop** — shared forecaster identity across platforms
4. **Negotiate** — data licensing for commercial use

---

## Implementation Roadmap

### Phase 1: Research & Relationship (Immediate)

- [ ] Apply to Trepa V2 early access program
- [ ] Establish relationship with Jong and Leon (cofounders)
- [ ] Understand API capabilities and limitations
- [ ] Evaluate data quality and update frequency

### Phase 2: Data Integration (Short-term)

- [ ] Build Trepa API client
- [ ] Add Trepa pools to markets database
- [ ] Create numerical consensus tracking
- [ ] Display Trepa data in BeRight Telegram bot

### Phase 3: Signal Development (Medium-term)

- [ ] Implement "Numerical Convergence" signal type
- [ ] Build binary-numerical divergence detector
- [ ] Add Trepa forecaster reputation tracking
- [ ] Create cross-platform arbitrage alerts

### Phase 4: AI Competition (Medium-term)

- [ ] Deploy BeRight AI to Trepa pools
- [ ] Build automated prediction pipeline
- [ ] Track and publicize AI performance
- [ ] Use track record for marketing

### Phase 5: Vault Integration (Long-term)

- [ ] Launch Macro Vault strategy
- [ ] Integrate Trepa execution
- [ ] Build cross-platform position management
- [ ] Profit sharing for numerical + binary strategies

---

## Competitive Positioning

### Market Gap Analysis

```
PREDICTION MARKET INTELLIGENCE LANDSCAPE

                 Binary Markets    Numerical Markets
                 ─────────────     ─────────────────
Oddpool              ✅                  ❌
Verso                ✅                  ❌
Converge             ✅                  ❌
Dome                 ✅                  ❌
Unusual Predictions  ✅                  ❌
────────────────────────────────────────────────────
BERIGHT              ✅                  ✅ (Trepa)
                         ↑ ONLY ONE
```

### Unique Value Proposition

With Trepa integration, BeRight offers:

| Capability | Competitors | BeRight + Trepa |
|------------|-------------|-----------------|
| Binary market aggregation | 2-5 platforms | 5 platforms |
| Numerical prediction data | ❌ None | ✅ Trepa |
| Cross-platform arbitrage | Binary only | Binary + Numerical |
| AI forecaster track record | No verification | On-chain Trepa proof |
| Forecaster reputation | Binary Brier only | Binary + Numerical precision |
| Economic/macro specialization | Limited | Native (Trepa focus) |

### Positioning Statement

> **BeRight: The only prediction market intelligence platform covering both binary probability markets AND numerical precision markets — spanning the full spectrum of forecasting.**

---

## Key Contacts & Resources

### Trepa Links

- **Website**: https://www.trepa.io/
- **Blog**: https://blog.trepa.io/
- **Mainnet Announcement**: https://blog.trepa.io/p/mainnet-coming-soon
- **Philosophy (Galton's Ox)**: https://blog.trepa.io/p/trepa-and-galtons-dressed-ox
- **Security Audit**: Adevar Labs (GitHub)
- **App**: Solana Mobile dApp Store

### Investor Links

- **Colosseum**: Solana ecosystem accelerator
- **Balaji Fund**: https://venture.angellist.com/v/back/balaji-fund

### Research Sources

- [Trepa Review - CoinCodeCap](https://coincodecap.com/trepa-review)
- [Trepa $420K Pre-Seed Announcement](https://www.cmointern.com/2025/08/trepa-secures-420k-pre-seed-for-web3.html)
- [Trepa RootData Profile](https://www.rootdata.com/Projects/detail/Trepa)
- [8 Prediction Markets Analysis - Bitget](https://www.bitget.com/news/detail/12560605021935)

---

## Summary

### Why Trepa Matters for BeRight

| BeRight Gap | Trepa Solution |
|-------------|----------------|
| Only binary markets | Adds numerical precision predictions |
| No macro/economic specialization | CPI, jobs, rates focus |
| AI needs proving ground | AI-native V2 platform |
| Cross-platform arb limited to binary | Binary vs numerical arbitrage |
| Forecaster reputation is single-dimensional | Adds precision scoring |
| Limited Solana presence | Native Solana integration |

### The Integration Thesis

**Trepa is not a competitor — it's a multiplier.**

By integrating Trepa, BeRight:
1. Expands coverage to a new market type (numerical)
2. Gains unique arbitrage opportunities (binary vs numerical)
3. Builds verifiable AI track record (on-chain)
4. Enhances forecaster reputation system (dual scoring)
5. Creates new vault strategies (Macro Vault)
6. Establishes competitive moat (only aggregator with both types)

### Next Steps

1. **Apply to Trepa V2 early access** — Shape APIs, build relationship
2. **Add Trepa as 6th platform** — Numerical data integration
3. **Deploy BeRight AI to Trepa** — Build verifiable track record
4. **Create "Numerical Convergence" signal type** — Unique to BeRight
5. **Launch Macro Vault** — Trepa + Kalshi economic predictions

---

*Last Updated: February 2026*
*Document Version: 1.0*
