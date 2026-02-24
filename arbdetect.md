# BeRight Arbitrage Detection System - Deep Research & Architecture

## Executive Summary

This document outlines a comprehensive strategy to build a **best-in-class arbitrage detection system** for prediction markets. Based on analysis of BeRight's current implementation, competitive landscape, and market dynamics, we identify gaps and propose a superior algorithm architecture.

**Key Finding:** Over **$40M in arbitrage profits** were extracted from Polymarket alone between April 2024 and April 2025. Tools like ArbBets find **80-100 daily opportunities** with an average **4.87% ROI**. The opportunity is real and significant.

---

## Table of Contents

1. [How Prediction Market Arbitrage Works](#how-prediction-market-arbitrage-works)
2. [Why Gaps Exist](#why-gaps-exist)
3. [The 5 Types of Arbitrage](#the-5-types-of-arbitrage)
4. [Current BeRight Implementation Analysis](#current-beright-implementation-analysis)
5. [Gaps & Weaknesses](#gaps--weaknesses)
6. [Competitive Landscape](#competitive-landscape)
7. [Superior Algorithm Architecture](#superior-algorithm-architecture)
8. [Implementation Roadmap](#implementation-roadmap)
9. [Monetization Strategy](#monetization-strategy)
10. [Sources & References](#sources--references)

---

## How Prediction Market Arbitrage Works

Every prediction market question has YES and NO contracts that each pay out $1 if correct. In a perfectly efficient market, YES + NO = $1.00. But in practice, prices drift apart — and when they do across platforms, arbitrage opportunities appear.

### Same-Platform Arbitrage

If on Polymarket, YES is $0.42 and NO is $0.55 (total = $0.97), you buy both for $0.97 and are guaranteed a $1.00 payout regardless of outcome. That's **$0.03 risk-free profit per pair**.

```
Example:
  Market: "Will Trump win 2024?"
  YES ask: $0.42
  NO ask:  $0.55
  ─────────────────
  Total:   $0.97
  Payout:  $1.00
  Profit:  $0.03 (3.1% ROI)
```

### Cross-Platform Arbitrage

This is where it gets more interesting. Polymarket might price YES at $0.45 on an event while Kalshi prices NO on the same event at $0.52. You buy YES on Polymarket and NO on Kalshi — total cost $0.97, guaranteed payout $1.00.

```
Example:
  Polymarket: "Trump wins 2024" YES @ $0.45
  Kalshi:     "Trump wins 2024" NO  @ $0.52
  ───────────────────────────────────────────
  Total cost: $0.97
  Payout:     $1.00 (one MUST be correct)
  Profit:     $0.03 (3.1% ROI)
```

---

## Why Gaps Exist

Pricing gaps emerge because of:

| Factor | Description |
|--------|-------------|
| **Information Asymmetry** | News breaks and one platform's traders react faster than another's |
| **Low Liquidity** | Thinner markets where prices get stale |
| **Different User Bases** | Polymarket is crypto-native globally while Kalshi is US-regulated and traditional |
| **Fee Structures** | Different fees create natural pricing offsets between platforms |
| **Regulatory Constraints** | Some users can only access certain platforms |
| **Time Zones** | Activity peaks differ, creating temporary mispricings |

---

## The 5 Types of Arbitrage

Most systems only detect Type 1. The real edge is in Types 2-5.

### Type 1: Cross-Platform Spread (Most Common)

**Status in BeRight: ✅ IMPLEMENTED**

Same event priced differently across platforms.

```
┌─────────────────────────────────────────────────────────────┐
│  CROSS-PLATFORM SPREAD ARBITRAGE                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Platform A (Polymarket)    Platform B (Kalshi)             │
│  ─────────────────────────  ─────────────────────           │
│  "Trump wins 2024"          "Trump wins 2024"               │
│  YES @ $0.42                YES @ $0.48                     │
│                             (NO @ $0.52)                    │
│                                                              │
│  STRATEGY: Buy YES on A ($0.42) + Buy NO on B ($0.52)       │
│  TOTAL COST: $0.94                                          │
│  GUARANTEED PAYOUT: $1.00                                   │
│  PROFIT: $0.06 (6.4% ROI)                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Type 2: Same-Platform Bundle (Often Overlooked)

**Status in BeRight: ❌ NOT IMPLEMENTED (explicitly skipped)**

YES + NO on SAME market < $1.00 due to order book gaps.

```
┌─────────────────────────────────────────────────────────────┐
│  SAME-PLATFORM BUNDLE ARBITRAGE                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Single Market on Polymarket:                               │
│  "Will Fed cut rates in March 2025?"                        │
│                                                              │
│  Order Book:                                                │
│    YES best ask: $0.42 (100 contracts available)            │
│    NO best ask:  $0.55 (150 contracts available)            │
│                                                              │
│  TOTAL: $0.97 < $1.00                                       │
│                                                              │
│  STRATEGY: Buy both YES and NO at ask prices                │
│  PROFIT: $0.03 per pair (3.1% ROI)                          │
│                                                              │
│  WHY IT HAPPENS:                                            │
│  - Thin order books                                         │
│  - Maker/taker imbalances                                   │
│  - Stale orders                                             │
│  - Low trading activity                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Type 3: Multi-Outcome Overround/Underround

**Status in BeRight: ❌ NOT IMPLEMENTED (binary only)**

Markets with 3+ outcomes where probabilities don't sum to 100%.

```
┌─────────────────────────────────────────────────────────────┐
│  MULTI-OUTCOME ARBITRAGE                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Market: "Who wins the Super Bowl?"                         │
│                                                              │
│  UNDERROUND EXAMPLE (Profit Opportunity):                   │
│    Chiefs:  35% ($0.35)                                     │
│    Eagles:  30% ($0.30)                                     │
│    49ers:   25% ($0.25)                                     │
│    Other:    8% ($0.08)                                     │
│    ─────────────────────                                    │
│    TOTAL:   98% ($0.98)                                     │
│                                                              │
│  STRATEGY: Buy ALL outcomes for $0.98                       │
│  GUARANTEED PAYOUT: $1.00 (one MUST win)                    │
│  PROFIT: $0.02 (2% ROI)                                     │
│                                                              │
│  OVERROUND EXAMPLE (No Direct Arbitrage):                   │
│    Chiefs:  38%                                             │
│    Eagles:  35%                                             │
│    49ers:   30%                                             │
│    Other:    5%                                             │
│    ─────────────────────                                    │
│    TOTAL:  108% → Indicates market inefficiency             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Type 4: Logical Inconsistency (Highest Alpha)

**Status in BeRight: ❌ NOT IMPLEMENTED**

Related markets with mathematically impossible price relationships.

```
┌─────────────────────────────────────────────────────────────┐
│  LOGICAL INCONSISTENCY ARBITRAGE                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  EXAMPLE 1: IMPLICATION VIOLATION                           │
│  ─────────────────────────────────                          │
│  Market A: "BTC > $100K by Dec 2025" @ 40%                  │
│  Market B: "BTC > $90K by Dec 2025"  @ 35%                  │
│                                                              │
│  LOGIC ERROR: If BTC > $100K, it MUST be > $90K             │
│  Therefore: P(A) must be <= P(B)                            │
│  But: 40% > 35% (IMPOSSIBLE)                                │
│                                                              │
│  STRATEGY:                                                  │
│    Buy YES on A (40¢)                                       │
│    Buy NO on B (65¢)                                        │
│    Total: $1.05                                             │
│                                                              │
│  OUTCOMES:                                                  │
│    If BTC > $100K: Win $1 on A, Lose 65¢ on B → +35¢        │
│    If $90K < BTC < $100K: Lose 40¢ on A, Lose 65¢ → -$1.05  │
│    If BTC < $90K: Lose 40¢ on A, Win $1 on B → +60¢         │
│                                                              │
│  The middle scenario should be impossible given pricing!    │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  EXAMPLE 2: MUTUAL EXCLUSION VIOLATION                      │
│  ─────────────────────────────────────                      │
│  Market A: "Trump wins 2024" @ 55%                          │
│  Market B: "Biden wins 2024" @ 50%                          │
│                                                              │
│  LOGIC ERROR: Both can't win (assuming 2-way race)          │
│  Therefore: P(A) + P(B) should be <= 100%                   │
│  But: 55% + 50% = 105% (IMPOSSIBLE)                         │
│                                                              │
│  STRATEGY: Sell both / Buy NO on both                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Type 5: Temporal Mismatch

**Status in BeRight: ❌ NOT IMPLEMENTED**

Same event with different timeframes priced inconsistently.

```
┌─────────────────────────────────────────────────────────────┐
│  TEMPORAL MISMATCH ARBITRAGE                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Market A: "Fed cuts rates in March 2025"  @ 60%            │
│  Market B: "Fed cuts rates in Q1 2025"     @ 55%            │
│                                                              │
│  LOGIC ERROR: March IS in Q1                                │
│  Therefore: P(March cut) <= P(Q1 cut)                       │
│  But: 60% > 55% (IMPOSSIBLE)                                │
│                                                              │
│  Another example:                                           │
│  Market A: "BTC reaches $100K in 2025"     @ 45%            │
│  Market B: "BTC reaches $100K in H1 2025"  @ 50%            │
│                                                              │
│  LOGIC ERROR: H1 is subset of full year                     │
│  Therefore: P(H1) <= P(2025)                                │
│  But: 50% > 45% (IMPOSSIBLE)                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Current BeRight Implementation Analysis

### Architecture Overview

BeRight implements a **two-tier arbitrage system**:

1. **Legacy Scanner** (`arbitrage.ts`) - Simple similarity-based matching
2. **V2 Production System** (`arbitrageV2.ts` + `lib/arbitrage/`) - Multi-stage validation pipeline

**V2 is enabled by default** (`USE_V2_ARBITRAGE !== 'false'`)

### V2 Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ARBITRAGE DETECTION V2                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Step 1: MARKET FETCHING                                    │
│  └─ Fetch markets from all platforms in parallel            │
│     (polymarket, kalshi, manifold)                          │
│                                                              │
│  Step 2: MARKET MATCHING (6-Stage Pipeline)                 │
│  ├─ Stage 1: Hard Filters (category, outcome type, dates)   │
│  ├─ Stage 2: Entity Extraction (people, orgs, locations)    │
│  ├─ Stage 3: Metadata Alignment (event dates, resolution)   │
│  ├─ Stage 4: Semantic Similarity (85%+ threshold)           │
│  ├─ Stage 5: Resolution Criteria Validation                 │
│  └─ Stage 6: Final Equivalence Scoring                      │
│                                                              │
│  Step 3: ARBITRAGE ANALYSIS                                 │
│  └─ Calculate profit opportunities with fee/slippage        │
│                                                              │
│  Step 4: RISK ASSESSMENT                                    │
│  ├─ Execution risk (liquidity, slippage, timing)            │
│  ├─ Market risk (resolution, correlation, volatility)       │
│  └─ Operational risk (platform reliability)                 │
│                                                              │
│  Step 5: OUTPUT & FILTERING                                 │
│  └─ Filter by confidence grade (A-F) and thresholds         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Current Matching Algorithm

**File:** `/beright-ts/lib/arbitrage/marketMatcher.ts`

#### Stage 1: Hard Filters (Early Rejection)

```typescript
// Category matching rules (strict)
Politics only matches: economics
Economics only matches: politics, crypto
Crypto only matches: economics, tech
Sports NEVER matches other categories
Entertainment NEVER matches other categories
Tech only matches: crypto, science
Science only matches: tech
"Other" is treated as a separate category (NO wildcard)

// Date alignment
- If both have dates: must be within 7 days
- If one has date, one doesn't: 0.3 alignment score
- Rejects if >7 days apart
```

#### Stage 2-3: Entity Extraction

```typescript
ExtractedEntities {
  people: string[];        // Trump, Biden, Powell, Zelensky, etc.
  organizations: string[]; // Fed, SEC, FDA, CDC, NASA, Tesla, OpenAI
  locations: string[];     // US, China, Russia, Ukraine, Taiwan, Israel
  dates: ExtractedDate[];  // Parsed deadlines and ranges
  amounts: ExtractedAmount[]; // $100K, 3%, BTC amounts
  events: string[];        // Super Bowl, World Cup, Olympics, Elections
}
```

#### Stage 4: Semantic Similarity

**Three-Algorithm Approach:**

1. **Character-Level Similarity** (30% weight)
   - Longest Common Subsequence (LCS) ratio
   - Formula: `(2 * matches) / (a.length + b.length)`

2. **Word-Level Jaccard** (40% weight)
   - Jaccard Index: `intersection / union`
   - Filters stop-words (words < 3 chars)

3. **Synonym-Aware Matching** (5-20% bonus)
   - Detects synonymous words (e.g., "victory" ≈ "win")
   - Bonus: min(0.2, synonymMatches * 0.05)

```
Final Score = min(1,
  0.3 * charSim +
  0.4 * jaccard +
  synonymBonus +
  phraseBonus
)
```

#### Stage 5-6: Equivalence Scoring

```typescript
overallScore =
  0.35 * titleSimilarity +
  0.30 * entityOverlap +
  0.15 * dateAlignment +
  0.10 * categoryMatch +
  0.10 * outcomeAlignment -
  validationPenalty
```

### Fee Calculations

**File:** `/beright-ts/lib/arbitrage/calculator.ts`

```typescript
const PLATFORM_FEES = {
  polymarket: {
    tradingFee: 0.00,        // No trading fee (uses Polygon)
    withdrawalFee: 0.00,
    settlementFee: 0.00,
  },

  kalshi: {
    tradingFee: 0.01,        // $0.01 per contract
    // At $0.50 price: 0.01/0.50 = 2% effective fee
    volumeDiscounts: [
      { minVolume: 10000, feeRate: 0.007 },   // 0.7% at $10K+
      { minVolume: 100000, feeRate: 0.005 },  // 0.5% at $100K+
    ],
  },

  limitless: {
    tradingFee: 0.005,       // 0.5% fee
  },

  manifold: {
    tradingFee: 0.00,        // Play money
  },
};
```

### Current Thresholds

```typescript
DEFAULT_ARBITRAGE_CONFIG = {
  // Matching thresholds (STRICT - raised from original)
  minEquivalenceScore: 0.80,    // 80% market equivalence
  minTitleSimilarity: 0.70,     // 70% title similarity
  maxDateDriftDays: 7,          // Within 1 week

  // Profit thresholds
  minNetProfitPct: 0.02,        // 2% minimum after fees
  minGrossProfitPct: 0.03,      // 3% minimum gross

  // Risk thresholds
  maxRiskScore: 60,             // 0-100 overall risk
  maxExecutionRisk: 50,         // 0-100 execution risk

  // Liquidity requirements
  minLiquidityUsd: 500,
  minVolumeUsd: 1000,

  // Scan frequency
  arbitrageScan: 5 * 60 * 1000,  // 5 minutes
};
```

---

## Gaps & Weaknesses

### Critical Gaps

| Gap | Current State | Impact | Priority |
|-----|---------------|--------|----------|
| **Multi-Outcome Markets** | Hardcoded to binary | Cannot detect Type 3 arbitrage | HIGH |
| **Same-Platform Detection** | Explicitly skipped | Missing Type 2 opportunities | HIGH |
| **Real-Time Price Feeds** | 5-minute polling | 78% of opportunities last <5 min | HIGH |
| **Logical Relationships** | Not implemented | Missing Type 4 & 5 arbitrage | MEDIUM |
| **Embedding-Based Matching** | Uses Jaccard similarity | Misses paraphrases/synonyms | MEDIUM |
| **Resolution Criteria** | Only extracts source | Different criteria = risk | MEDIUM |

### Detailed Gap Analysis

#### 1. Multi-Outcome Markets Not Supported

**File:** `/beright-ts/lib/arbitrage/marketMatcher.ts:135-138`

```typescript
function inferOutcomeType(market: Market): 'binary' | 'multi' | 'scalar' {
  // Most prediction markets are binary Yes/No
  // Multi-outcome and scalar would need platform-specific parsing
  return 'binary';  // ← HARDCODED
}
```

**Impact:** Cannot match "Who wins: Trump/Biden/Other" scenarios

#### 2. Same-Platform Arbitrage Skipped

**Current Code:**
```typescript
if (marketA.platform === marketB.platform) continue  // Skip
```

**Opportunity Missed:** Bundle arbitrage where YES + NO < $1 on same market

#### 3. Limited Entity Extraction

- Uses ~40 hardcoded regex patterns
- Missing: Sports teams, crypto tokens, company earnings
- Example blind spot: "Will Solana reach $500?" vs "Will SOL reach 500?"

#### 4. No Real-Time Price Feed

- Current: Fetches prices once per 5-minute scan
- Problem: Studies show 78% of opportunities close within 5 minutes
- Sub-second detection requires WebSocket integration

#### 5. Resolution Criteria Not Compared

- Current: Only checks resolution SOURCE (AP, Fed, etc.)
- Missing: Actual criteria text comparison
- Risk: "Trump wins according to AP" vs "Trump wins electoral college"

---

## Competitive Landscape

### Existing Arbitrage Tools

| Tool | Approach | Strengths | Weaknesses |
|------|----------|-----------|------------|
| **ArbBets** | Cross-platform scanner | 80-100 daily opps, 4.87% avg ROI | Manual execution |
| **Polytrage** | Polymarket-focused | Fast detection | Single platform |
| **PredictOS** | AI-powered | URL-based matching | Framework only |
| **poly-kalshi-arb** | Rust bot | Sub-10ms latency | BTC markets only |
| **EventArb** | Sports focus | Deep sports coverage | Limited to sports |

### Open Source Bots on GitHub

1. **[polymarket-arbitrage](https://github.com/ImMike/polymarket-arbitrage)** (ImMike)
   - Watches 10,000+ markets
   - Python-based
   - Cross-platform (Polymarket + Kalshi)

2. **[polymarket-kalshi-btc-arbitrage-bot](https://github.com/CarlosIbCu/polymarket-kalshi-btc-arbitrage-bot)** (CarlosIbCu)
   - Real-time BTC price markets
   - Smart matching algorithm
   - MIT licensed

3. **[poly-kalshi-arb](https://github.com/taetaehoho/poly-kalshi-arb)** (taetaehoho)
   - Rust 1.75+ for performance
   - Concurrent leg execution
   - Sports team mappings

4. **[PredictOS](https://github.com/PredictionXBT/PredictOS)** (PredictionXBT)
   - AI-powered detection
   - Multi-platform support
   - Open-source framework

### Market Data

- **$40M+** in arbitrage profits extracted (April 2024 - April 2025)
- **$44B+** prediction market trading volume (2025)
- **Kalshi:** 62% market share, $500M+ weekly volume
- **Polymarket:** 37% market share, crypto-native

---

## Superior Algorithm Architecture

### Phase 1: Real-Time Data Layer

```
┌─────────────────────────────────────────────────────────────┐
│                      REAL-TIME DATA LAYER                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  WEBSOCKET STREAMS (sub-second updates)                     │
│  ├─ Polymarket CLOB → Order book changes                    │
│  ├─ Kalshi API → Price/volume updates                       │
│  ├─ Limitless → Market state                                │
│  └─ Manifold → Community odds                               │
│                                                              │
│  PRICE NORMALIZATION                                        │
│  ├─ Standardize to 0.00-1.00 range                          │
│  ├─ Extract bid/ask/mid/last                                │
│  ├─ Calculate depth at 1%, 2%, 5% price impact              │
│  └─ Track 1min/5min/1hr price velocity                      │
│                                                              │
│  MARKET REGISTRY (in-memory cache)                          │
│  ├─ Deduped by platform+marketId                            │
│  ├─ TTL: 60 seconds for stale detection                     │
│  └─ Change detection triggers downstream                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Phase 2: Semantic Matching Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                   SEMANTIC MATCHING PIPELINE                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  STEP 1: EMBEDDING GENERATION                               │
│  ────────────────────────────                               │
│  Instead of Jaccard similarity, use dense embeddings:       │
│                                                              │
│  Input: "Will Donald Trump win the 2024 election?"          │
│  → OpenAI text-embedding-3-small (1536 dims)                │
│  → OR Sentence-BERT (all-MiniLM-L6-v2, 384 dims)            │
│                                                              │
│  Benefits:                                                  │
│  - "Trump wins" ≈ "Trump victory" ≈ "Donald Trump elected"  │
│  - Handles paraphrases automatically                        │
│  - Language-agnostic                                        │
│                                                              │
│  STEP 2: CLUSTERING (Reduce N² comparisons)                 │
│  ────────────────────────────────────────────               │
│  Problem: 10K markets × 10K markets = 100M comparisons      │
│                                                              │
│  Solution: Hierarchical clustering by category              │
│  ├─ Political elections cluster                             │
│  ├─ Fed/monetary policy cluster                             │
│  ├─ Crypto price cluster                                    │
│  ├─ Sports cluster                                          │
│  └─ etc.                                                    │
│                                                              │
│  Reduces to ~10K relevant comparisons                       │
│                                                              │
│  STEP 3: COSINE SIMILARITY RANKING                          │
│  ──────────────────────────────────                         │
│  similarity = cosine(embedding_A, embedding_B)              │
│  threshold: 0.85 (calibrated from labeled pairs)            │
│                                                              │
│  STEP 4: ENTITY VALIDATION (Hard Filter)                    │
│  ────────────────────────────────────────                   │
│  High similarity ≠ same event                               │
│                                                              │
│  "Trump wins 2024" vs "Biden wins 2024"                     │
│  → High embedding similarity (both about 2024 election)     │
│  → But DIFFERENT events → REJECT                            │
│                                                              │
│  STEP 5: RESOLUTION CRITERIA CHECK                          │
│  ─────────────────────────────────                          │
│  Extract resolution text, compare semantic similarity       │
│  Flag if resolution_similarity < 0.9                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Phase 3: Multi-Type Detection Engine

```typescript
// Enhanced arbitrage opportunity types
interface ArbitrageOpportunity {
  type:
    | 'CROSS_PLATFORM_SPREAD'      // Type 1 ✅ Implemented
    | 'SAME_PLATFORM_BUNDLE'       // Type 2 ❌ To implement
    | 'MULTI_OUTCOME_OVERROUND'    // Type 3 ❌ To implement
    | 'LOGICAL_INCONSISTENCY'      // Type 4 ❌ To implement
    | 'TEMPORAL_MISMATCH';         // Type 5 ❌ To implement

  markets: Market[];
  legs: TradeLeg[];

  grossProfit: number;
  totalFees: number;
  estimatedSlippage: number;
  netProfit: number;

  confidence: number;           // 0-100
  executionRisk: number;        // 0-100
  resolutionRisk: number;       // 0-100

  timeToExpiry: number;         // ms until opportunity closes
  liquidityDepth: number;       // $ executable at quoted prices
}
```

#### Type 2: Same-Platform Bundle Detection

```typescript
function detectSamePlatformArbitrage(market: Market): ArbitrageOpportunity | null {
  // Get order book
  const yesAsk = market.orderBook.yes.bestAsk;
  const noAsk = market.orderBook.no.bestAsk;

  // Check if buying both sides < $1
  const totalCost = yesAsk.price + noAsk.price;

  if (totalCost < 0.98) { // 2% minimum spread after fees
    const grossProfit = 1 - totalCost;
    const fees = market.platform === 'polymarket' ? 0 : 0.02;
    const netProfit = grossProfit - fees;

    if (netProfit > 0.01) { // 1% minimum net
      return {
        type: 'SAME_PLATFORM_BUNDLE',
        markets: [market],
        legs: [
          { side: 'YES', price: yesAsk.price, size: yesAsk.size },
          { side: 'NO', price: noAsk.price, size: noAsk.size },
        ],
        grossProfit,
        netProfit,
        confidence: 95, // High confidence - same market
      };
    }
  }

  return null;
}
```

#### Type 3: Multi-Outcome Detection

```typescript
function detectMultiOutcomeArbitrage(
  market: MultiOutcomeMarket
): ArbitrageOpportunity | null {
  // Sum all outcome prices
  const totalProbability = market.outcomes.reduce(
    (sum, o) => sum + o.askPrice,
    0
  );

  // Underround: total < 100% (rare but profitable)
  if (totalProbability < 0.98) {
    return {
      type: 'MULTI_OUTCOME_OVERROUND',
      strategy: 'BUY_ALL_OUTCOMES',
      grossProfit: 1 - totalProbability,
      legs: market.outcomes.map(o => ({
        side: o.name,
        price: o.askPrice,
        size: o.availableSize,
      })),
    };
  }

  return null;
}
```

#### Type 4: Logical Inconsistency Detection

```typescript
interface LogicalRelationship {
  type: 'IMPLIES' | 'EXCLUDES' | 'SUBSET';
  marketA: Market;
  marketB: Market;
  confidence: number;
}

function detectLogicalInconsistency(
  relationships: LogicalRelationship[]
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];

  for (const rel of relationships) {
    const priceA = rel.marketA.yesPrice;
    const priceB = rel.marketB.yesPrice;

    if (rel.type === 'IMPLIES') {
      // If A implies B, then P(A) <= P(B)
      if (priceA > priceB + 0.03) {
        opportunities.push({
          type: 'LOGICAL_INCONSISTENCY',
          strategy: 'BUY_YES_A_AND_NO_B',
          rationale: `If ${rel.marketA.title} is true, ` +
                     `${rel.marketB.title} must also be true`,
        });
      }
    }

    if (rel.type === 'EXCLUDES') {
      // If A excludes B, then P(A) + P(B) <= 1
      if (priceA + priceB > 1.03) {
        opportunities.push({
          type: 'LOGICAL_INCONSISTENCY',
          strategy: 'SELL_BOTH',
        });
      }
    }
  }

  return opportunities;
}

// Use LLM to classify relationships
async function classifyRelationship(
  marketA: Market,
  marketB: Market
): Promise<LogicalRelationship | null> {
  const prompt = `
    Market A: "${marketA.title}"
    Market B: "${marketB.title}"

    What is the logical relationship?
    1. IMPLIES: If A is true, B must be true
    2. EXCLUDES: A and B cannot both be true
    3. SUBSET: A is a more specific version of B
    4. INDEPENDENT: No logical relationship
  `;

  const response = await claude.complete(prompt);
  // Parse and return
}
```

### Phase 4: Execution Simulation

```typescript
interface ExecutionSimulation {
  success: boolean;
  expectedSlippage: number;
  expectedLatency: number;
  probabilityOfFill: number;
  adjustedNetProfit: number;
  warnings: string[];
}

async function simulateExecution(
  opportunity: ArbitrageOpportunity
): Promise<ExecutionSimulation> {

  const results = await Promise.all(
    opportunity.legs.map(async (leg) => {
      const depth = await getOrderBookDepth(leg.market, leg.side);

      const availableAtPrice = depth
        .filter(level => level.price <= leg.price * 1.005)
        .reduce((sum, l) => sum + l.size, 0);

      const fillProbability = Math.min(1, availableAtPrice / leg.size);
      const slippage = estimateSlippage(depth, leg.size);

      return { fillProbability, slippage };
    })
  );

  const jointFillProbability = results.reduce(
    (p, r) => p * r.fillProbability, 1
  );

  const totalSlippage = results.reduce(
    (s, r) => s + r.slippage, 0
  );

  return {
    success: jointFillProbability > 0.8 &&
             opportunity.netProfit - totalSlippage > 0.01,
    expectedSlippage: totalSlippage,
    probabilityOfFill: jointFillProbability,
    adjustedNetProfit: opportunity.netProfit - totalSlippage,
  };
}
```

### Phase 5: Continuous Learning

```typescript
interface ArbitrageOutcome {
  opportunityId: string;
  detectedAt: Date;
  executedAt: Date | null;

  predictedProfit: number;
  actualProfit: number | null;

  matchConfidence: number;
  wasCorrectMatch: boolean;

  executionSuccess: boolean;
  failureReason: string | null;
}

function recalibrateThresholds(outcomes: ArbitrageOutcome[]): void {
  const correctMatches = outcomes.filter(o => o.wasCorrectMatch);
  const falsePositives = outcomes.filter(o => !o.wasCorrectMatch);

  // Find optimal threshold that maximizes F1 score
  const optimalThreshold = findOptimalThreshold(
    correctMatches.map(o => o.matchConfidence),
    falsePositives.map(o => o.matchConfidence)
  );

  config.minEquivalenceScore = optimalThreshold;
}
```

---

## Implementation Roadmap

### Week 1: Quick Wins

| Task | Impact | Effort |
|------|--------|--------|
| Add same-platform bundle detection | +20% opportunities | Low |
| Reduce scan interval to 30 seconds | +50% catch rate | Low |
| Add execution simulation before alerting | -30% false alerts | Medium |

### Week 2-3: Core Improvements

| Task | Impact | Effort |
|------|--------|--------|
| Implement embedding-based matching | +40% match accuracy | Medium |
| Add multi-outcome market support | +15% opportunities | Medium |
| WebSocket integration (Polymarket) | Real-time detection | High |

### Week 4-6: Advanced Features

| Task | Impact | Effort |
|------|--------|--------|
| Logical relationship detection | New opportunity type | High |
| Resolution criteria comparison | -20% resolution risk | Medium |
| Auto-execution pipeline | Full automation | High |

### Month 2+: Optimization

| Task | Impact | Effort |
|------|--------|--------|
| ML-based false positive filtering | +25% precision | High |
| Continuous threshold calibration | Self-improving | Medium |
| Multi-platform WebSocket | Sub-second detection | High |

---

## Monetization Strategy

### Subscription Tiers

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | 5 alerts/day, 10-min delay, Type 1 only |
| **Pro** | $49/mo | Real-time alerts, Types 1-3, execution simulation |
| **Trader** | $149/mo | All types, <30s latency, API access, custom filters |
| **Fund** | $499/mo | Direct integration, priority alerts, white-glove |

### Performance Fee Model

Alternative approach for serious traders:
- Detect opportunities automatically
- Execute via connected wallet
- Take 20% of realized profits
- Only charge on successful arbitrage

### Projected Revenue

| Month | Free Users | Pro ($49) | Trader ($149) | MRR |
|-------|------------|-----------|---------------|-----|
| 3 | 2,000 | 100 | 30 | $9,370 |
| 6 | 5,000 | 300 | 100 | $29,600 |
| 12 | 10,000 | 800 | 300 | $83,900 |

---

## Sources & References

### GitHub Repositories

- [polymarket-arbitrage](https://github.com/ImMike/polymarket-arbitrage) - 10K+ market scanner
- [polymarket-kalshi-btc-arbitrage-bot](https://github.com/CarlosIbCu/polymarket-kalshi-btc-arbitrage-bot) - BTC markets
- [poly-kalshi-arb](https://github.com/taetaehoho/poly-kalshi-arb) - Rust implementation
- [PredictOS](https://github.com/PredictionXBT/PredictOS) - AI-powered framework
- [Polymarket-Kalshi-Arbitrage-Bot](https://github.com/earthskyorg/Polymarket-Kalshi-Arbitrage-Bot) - Cross-venue bot
- [prediction-market-arbitrage-bot](https://github.com/realfishsam/prediction-market-arbitrage-bot) - Educational bot

### Articles & Guides

- [Prediction Market Arbitrage Guide: Strategies for 2026](https://newyorkcityservers.com/blog/prediction-market-arbitrage-guide)
- [Building a Prediction Market Arbitrage Bot](https://navnoorbawa.substack.com/p/building-a-prediction-market-arbitrage)
- [How Prediction Market Arbitrage Works](https://www.trevorlasn.com/blog/how-prediction-market-polymarket-kalshi-arbitrage-works)
- [Best Prediction Market Bots & Tools](https://newyorkcityservers.com/blog/best-prediction-market-bots-tools)

### Tools & Platforms

- [ArbBets](https://getarbitragebets.com/) - Arbitrage finder
- [Prediction Hunt](https://polymark.et/product/prediction-hunt) - Market aggregator
- [ArbitrageBot.org](https://www.arbitragebot.org/) - Polymarket bot

### Market Data

- IMDEA Networks Institute research: $40M+ arbitrage profits (2024-2025)
- Kalshi: 62% market share, $500M+ weekly volume
- Prediction market industry: $44B+ trading volume (2025)

---

## Appendix: Current Code References

### Key Files

| File | Purpose |
|------|---------|
| `/lib/arbitrage/marketMatcher.ts` | Market matching logic |
| `/lib/arbitrage/calculator.ts` | Fee & profit calculations |
| `/lib/arbitrage/scanner.ts` | Legacy scanner |
| `/lib/arbitrage/arbitrageV2.ts` | V2 production system |
| `/lib/arbitrage/types.ts` | Type definitions |
| `/config/thresholds.ts` | Configuration defaults |

### Recent Commits

```
1f86f28 - fix: strict arbitrage matching to prevent false positive alerts
         • Changed similarity threshold: 35% → 70%
         • Changed equivalence: 55% → 80%
         • Changed date tolerance: 14 → 7 days

6d409b6 - feat: add market links to arbitrage alerts

329890d - fix: increase arb matching threshold to 80%
```

---

*Last updated: February 2026*
*Document version: 1.0*
