# BeRight Protocol - Canonical Architecture Reference

> **5-Phase Synthesis: Competitive Intelligence + On-Chain Calibration System**
>
> **Date:** February 9, 2026
> **Status:** Canonical Reference Document
> **Authors:** BeRight Engineering

---

## Phase 1: Deep Understanding

### 1.1 Competitive Landscape Summary

From analyzing **515 projects** in the Colosseum Agent Hackathon, key patterns emerged:

| Pattern | Leading Projects | Adoption Rate |
|---------|-----------------|---------------|
| **Modular Plugin Architecture** | Solana Agent Kit, ElizaOS | ~80% of winning agents |
| **Skill-Based Routing** | OpenClaw, Clodds | ~60% of multi-function agents |
| **Simulation-First Execution** | DeFi Risk Guardian | ~40% of trading agents |
| **On-Chain Commitment** | SOLPRISM, KAMIYO | ~20% (emerging) |
| **Human-in-the-Loop** | Solana Agent Kit v2 | ~70% of trading agents |

### 1.2 BeRight's Unique Position

**Where BeRight is UNIQUE (No competitor has this):**
1. **Superforecaster methodology** - Tetlock's calibration framework applied to prediction markets
2. **Brier score tracking** - Scientific accuracy measurement over time
3. **Custom On-Chain Calibration** - Native Solana Memo Program (not dependent on SOLPRISM beta)
4. **Multi-agent specialization** - Scout/Analyst/Trader with appropriate model costs

**Where BeRight Competes:**
| Feature | BeRight | Clodds | Predly |
|---------|---------|--------|--------|
| Market aggregation | 3 platforms | 2+ platforms | 2 platforms |
| Arbitrage detection | Yes | Yes (more comprehensive) | No |
| AI forecasting | Superforecaster | None | AI probability |
| Multi-channel | Telegram (OpenClaw) | 22 platforms | Web only |
| On-chain verification | **Native Memo** | None | None |
| Calibration tracking | **Brier Score** | None | None |

### 1.3 On-Chain Module Architecture

The custom on-chain system uses **Solana Memo Program** for trustless prediction tracking:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ON-CHAIN CALIBRATION SYSTEM                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │   memo.ts       │    │   commit.ts     │    │  verify.ts  │ │
│  │                 │    │                 │    │             │ │
│  │ • formatPre-    │    │ • commitPre-    │    │ • fetchPre- │ │
│  │   dictionMemo   │───▶│   diction       │───▶│   diction   │ │
│  │ • formatReso-   │    │ • resolvePre-   │    │ • verifyPre │ │
│  │   lutionMemo    │    │   diction       │    │   diction   │ │
│  │ • calculateBri- │    │ • batchCommit   │    │ • generate- │ │
│  │   erScore       │    │                 │    │   Proof     │ │
│  └─────────────────┘    └─────────────────┘    └─────────────┘ │
│           │                      │                     │        │
│           └──────────────────────┼─────────────────────┘        │
│                                  ▼                              │
│                    ┌─────────────────────────┐                  │
│                    │   SOLANA MEMO PROGRAM   │                  │
│                    │   MemoSq4gqABAXKb96...  │                  │
│                    │                         │                  │
│                    │   Cost: ~0.000005 SOL   │                  │
│                    │   Capacity: 2,284 preds │                  │
│                    └─────────────────────────┘                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Memo Format (On-Chain):**
```
BERIGHT:PREDICT:v1|{userPubkey}|{marketId}|{probability}|{direction}|{timestamp}|{hash}
BERIGHT:RESOLVE:v1|{commitTx}|{outcome}|{brierScore}
```

**Brier Score Calculation:**
```typescript
// Brier = (forecast - outcome)²
// forecast = probability of YES (adjusted for direction)
// outcome = 1 if YES won, 0 if NO won
// Lower is better: 0 = perfect, 1 = completely wrong

const forecast = direction === 'YES' ? probability : 1 - probability;
const actual = outcome ? 1 : 0;
const brier = Math.pow(forecast - actual, 2);
```

---

## Phase 2: Synthesis Thinking

### 2.1 How Competitive Insights Influence On-Chain Design

| Competitive Insight | Impact on Our Design | Implementation |
|---------------------|---------------------|----------------|
| **SOLPRISM is beta** | Build native solution | Custom Memo Program integration |
| **Trust is emerging primitive** | On-chain > off-chain for credibility | All predictions verifiable on Solscan |
| **Clodds has no calibration** | This is our moat | Brier score + historical tracking |
| **Gas costs matter** | Batch predictions | Up to 6 predictions per tx (~$0.00075) |
| **Gamification wins users** | Leaderboard from day 1 | Supabase + on-chain verification |

### 2.2 Architecture Decision Records (ADRs)

#### ADR-001: Native Memo vs SOLPRISM

**Decision:** Use native Solana Memo Program instead of SOLPRISM SDK

**Context:**
- SOLPRISM is in beta (unstable API)
- We need full control over memo format
- Lower latency (no SDK overhead)
- Zero dependency risk

**Consequences:**
- (+) Full control, stable, no external dependency
- (+) Custom memo format optimized for predictions
- (+) Batch capability (SOLPRISM doesn't batch)
- (-) No "verifiable reasoning" feature (we store reasoning off-chain)
- (-) Must build own verification explorer

**Status:** Accepted

---

#### ADR-002: Off-Chain First, On-Chain Verification

**Decision:** Store all data in Supabase, commit to chain for verification

**Context:**
- On-chain storage is expensive (~5000 lamports per tx)
- Need fast queries for leaderboard
- Need real-time updates for UX
- On-chain provides trust anchor

**Implementation:**
```
User makes prediction
         │
         ▼
┌─────────────────────┐
│  Supabase (Primary) │◀─── Fast queries, real-time, free
│  • predictions      │
│  • users            │
│  • leaderboard_view │
└─────────────────────┘
         │
         ▼ (async)
┌─────────────────────┐
│  Solana (Proof)     │◀─── Trust anchor, verification
│  • Memo Program     │
│  • Immutable record │
└─────────────────────┘
```

**Status:** Accepted

---

#### ADR-003: Brier Score as Primary Metric

**Decision:** Rank users by average Brier score, not win rate

**Context:**
- Win rate rewards overconfidence (always predict 100%)
- Brier score rewards calibration
- Academic standard (Tetlock, IARPA)
- Differentiator from competitors

**Interpretation Table:**
| Brier Score | Quality | Description |
|-------------|---------|-------------|
| ≤ 0.10 | Excellent | Superforecaster level |
| ≤ 0.20 | Good | Well-calibrated |
| ≤ 0.30 | Fair | Average forecaster |
| ≤ 0.40 | Poor | Needs improvement |
| > 0.40 | Bad | Worse than random |

**Status:** Accepted

---

#### ADR-004: Single Agent + Tools (Not Multi-Agent)

**Decision:** Use single Claude agent with skill-based routing instead of multi-agent orchestration

**Context:**
- Simpler to build and maintain
- Lower latency (no agent-to-agent communication)
- Tools provide specialization
- OpenClaw Gateway handles routing

**Architecture:**
```
User Message
     │
     ▼
┌─────────────────────────────────────────┐
│         OPENCLAW GATEWAY                 │
│  (Telegram Handler + Session Manager)    │
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│         SINGLE CLAUDE AGENT             │
│         (Sonnet 4 / Opus 4.5)           │
│                                         │
│  Intent Detection → Tool Selection      │
│                                         │
│  ┌─────────┬─────────┬─────────┐       │
│  │markets  │arbitrage│research │       │
│  │.ts      │.ts      │.ts      │       │
│  └─────────┴─────────┴─────────┘       │
│  ┌─────────┬─────────┬─────────┐       │
│  │whale.ts │intel.ts │predict  │       │
│  │         │         │.ts      │       │
│  └─────────┴─────────┴─────────┘       │
└─────────────────────────────────────────┘
```

**Status:** Accepted

---

## Phase 3: Winning Architecture

### 3.1 Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BERIGHT PROTOCOL ARCHITECTURE                        │
│                         "Prediction Intelligence Terminal"                    │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │   USER LAYER    │
                              │                 │
                              │  Telegram  Web  │
                              │  (future:       │
                              │   Discord/API)  │
                              └────────┬────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OPENCLAW GATEWAY                                     │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                   │
│  │ Telegram      │  │   Session     │  │    Cron       │                   │
│  │ Handler       │  │   Manager     │  │   (Heartbeat) │                   │
│  └───────────────┘  └───────────────┘  └───────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SKILL LAYER (Tools)                                  │
│                                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  markets.ts │ │arbitrage.ts │ │ research.ts │ │ predict.ts  │           │
│  │             │ │             │ │             │ │   (NEW)     │           │
│  │ • Search    │ │ • Cross-    │ │ • Super-    │ │ • Make pred │           │
│  │ • Compare   │ │   platform  │ │   forecaster│ │ • On-chain  │           │
│  │ • Price     │ │ • Spread    │ │ • Base rate │ │   commit    │           │
│  │   fetch     │ │   detection │ │ • Analysis  │ │ • Track     │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  whale.ts   │ │  intel.ts   │ │    me.ts    │ │leaderboard  │           │
│  │             │ │             │ │   (NEW)     │ │.ts (NEW)    │           │
│  │ • Track     │ │ • News RSS  │ │ • User      │ │ • Global    │           │
│  │   wallets   │ │ • Reddit    │ │   stats     │ │   rankings  │           │
│  │ • Alert     │ │ • Sentiment │ │ • Brier     │ │ • Brier     │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                           │
│                                                                              │
│  ┌────────────────────────────────┐  ┌────────────────────────────────┐    │
│  │     EXTERNAL APIS              │  │     INTERNAL STORAGE           │    │
│  │  ┌────────┐ ┌────────┐        │  │  ┌────────────────────────┐    │    │
│  │  │Polymar-│ │ Kalshi │        │  │  │      SUPABASE          │    │    │
│  │  │  ket   │ │        │        │  │  │  • users               │    │    │
│  │  └────────┘ └────────┘        │  │  │  • predictions         │    │    │
│  │  ┌────────┐ ┌────────┐        │  │  │  • leaderboard_view    │    │    │
│  │  │Manifold│ │ Helius │        │  │  │  • alerts              │    │    │
│  │  │        │ │(Solana)│        │  │  │  • watchlist           │    │    │
│  │  └────────┘ └────────┘        │  │  └────────────────────────┘    │    │
│  └────────────────────────────────┘  │  ┌────────────────────────┐    │    │
│                                       │  │    FILE-BASED STATE    │    │    │
│                                       │  │  • memory/*.json       │    │    │
│                                       │  └────────────────────────┘    │    │
│                                       └────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BLOCKCHAIN LAYER                                     │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                    SOLANA MEMO PROGRAM                                 │ │
│  │                                                                        │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │ │
│  │  │ lib/onchain/ │  │ lib/onchain/ │  │ lib/onchain/ │                │ │
│  │  │   memo.ts    │  │  commit.ts   │  │  verify.ts   │                │ │
│  │  │              │  │              │  │              │                │ │
│  │  │ Format       │──│ Send TX      │──│ Verify       │                │ │
│  │  │ Parse        │  │ Batch        │  │ Fetch        │                │ │
│  │  │ Brier calc   │  │ Resolve      │  │ Proof        │                │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                │ │
│  │                                                                        │ │
│  │  Memo Program ID: MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr         │ │
│  │  Cost per TX: ~0.000005 SOL (~$0.00075)                               │ │
│  │  Batch capacity: 6 predictions per TX                                 │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow: Making a Prediction

```
User: /predict BTC-100K 72% YES
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│ 1. VALIDATION                                                  │
│    • Parse: market="BTC-100K", probability=0.72, direction=YES │
│    • Validate: 0 ≤ probability ≤ 1                            │
│    • Check: user exists in Supabase                           │
└───────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│ 2. SUPABASE WRITE (Primary Record)                            │
│                                                                │
│    INSERT INTO predictions (                                   │
│      user_id, market_id, probability, direction, created_at   │
│    ) VALUES (                                                  │
│      'user-123', 'BTC-100K', 0.72, 'YES', now()               │
│    )                                                           │
│                                                                │
│    Returns: prediction_id = 'pred-456'                         │
└───────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│ 3. ON-CHAIN COMMIT (Verification Anchor)                      │
│                                                                │
│    memo = formatPredictionMemo(                                │
│      userPubkey: "7vHKGx...",                                 │
│      marketId: "BTC-100K",                                    │
│      probability: 0.72,                                        │
│      direction: "YES"                                          │
│    )                                                           │
│                                                                │
│    Result: "BERIGHT:PREDICT:v1|7vHKGx...|BTC-100K|0.7200|YES| │
│             1707494400|a1b2c3d4e5f6g7h8"                       │
│                                                                │
│    commitPrediction() → TX signature                           │
└───────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│ 4. UPDATE SUPABASE WITH TX                                     │
│                                                                │
│    UPDATE predictions                                          │
│    SET tx_signature = '5abc...', committed_at = now()         │
│    WHERE id = 'pred-456'                                       │
└───────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│ 5. USER RESPONSE                                               │
│                                                                │
│    ✅ Prediction committed!                                    │
│                                                                │
│    📊 BTC-100K: 72% YES                                       │
│    ⛓️  TX: 5abc...                                             │
│    🔗 Verify: https://solscan.io/tx/5abc...                   │
│                                                                │
│    Your predictions: 12 total                                  │
│    Your Brier score: 0.18 (Good)                              │
└───────────────────────────────────────────────────────────────┘
```

### 3.3 Data Flow: Resolving a Prediction

```
Market BTC-100K resolves: YES wins
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│ 1. FETCH UNRESOLVED PREDICTIONS                               │
│                                                                │
│    SELECT * FROM predictions                                   │
│    WHERE market_id = 'BTC-100K'                               │
│      AND resolved_at IS NULL                                   │
│                                                                │
│    Returns: [pred-456, pred-789, ...]                          │
└───────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│ 2. CALCULATE BRIER SCORES                                     │
│                                                                │
│    For pred-456: (probability=0.72, direction=YES, outcome=YES)│
│                                                                │
│    forecast = 0.72 (already YES)                              │
│    actual = 1 (YES won)                                        │
│    brier = (0.72 - 1)² = 0.0784                               │
│                                                                │
│    Quality: "good" (≤ 0.10 = excellent)                       │
└───────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│ 3. ON-CHAIN RESOLUTION                                        │
│                                                                │
│    resolvePrediction(                                          │
│      commitTx: "5abc...",                                     │
│      probability: 0.72,                                        │
│      direction: "YES",                                         │
│      outcome: true                                             │
│    )                                                           │
│                                                                │
│    Memo: "BERIGHT:RESOLVE:v1|5abc...|YES|0.0784"              │
│    Returns: resolution TX signature                            │
└───────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│ 4. UPDATE SUPABASE                                             │
│                                                                │
│    UPDATE predictions                                          │
│    SET resolved_at = now(),                                    │
│        outcome = 'YES',                                        │
│        brier_score = 0.0784,                                   │
│        resolution_tx = '7def...'                               │
│    WHERE id = 'pred-456'                                       │
│                                                                │
│    -- Leaderboard view auto-updates via materialized view     │
└───────────────────────────────────────────────────────────────┘
```

### 3.4 Database Schema (Supabase)

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id TEXT UNIQUE,
  wallet_address TEXT,
  username TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  settings JSONB DEFAULT '{}'::jsonb
);

-- Predictions table
CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  market_id TEXT NOT NULL,
  probability DECIMAL(5,4) NOT NULL CHECK (probability >= 0 AND probability <= 1),
  direction TEXT NOT NULL CHECK (direction IN ('YES', 'NO')),
  created_at TIMESTAMPTZ DEFAULT now(),
  tx_signature TEXT,  -- On-chain commit TX
  committed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  outcome TEXT CHECK (outcome IN ('YES', 'NO')),
  brier_score DECIMAL(6,4),
  resolution_tx TEXT  -- On-chain resolution TX
);

-- Leaderboard view (auto-calculated)
CREATE VIEW leaderboard AS
SELECT
  u.id,
  u.username,
  u.telegram_id,
  COUNT(p.id) as total_predictions,
  COUNT(p.id) FILTER (WHERE p.resolved_at IS NOT NULL) as resolved_predictions,
  AVG(p.brier_score) FILTER (WHERE p.brier_score IS NOT NULL) as avg_brier,
  MIN(p.brier_score) as best_brier,
  COUNT(p.id) FILTER (WHERE p.brier_score <= 0.1) as excellent_predictions
FROM users u
LEFT JOIN predictions p ON u.id = p.user_id
GROUP BY u.id, u.username, u.telegram_id
ORDER BY avg_brier ASC NULLS LAST;
```

---

## Phase 4: Execution Plan

### 4.1 Immediate Tasks (Next 24 Hours)

| Task | File | Status | Effort |
|------|------|--------|--------|
| Create `/predict` command | `skills/predict.ts` | Pending | 3h |
| Create `/me` command | `skills/me.ts` | Pending | 2h |
| Create `/leaderboard` command | `skills/leaderboard.ts` | Pending | 2h |
| Update telegramHandler routing | `skills/telegramHandler.ts` | Pending | 1h |
| Test full prediction flow | - | Pending | 1h |

### 4.2 `/predict` Command Specification

**Usage:**
```
/predict <market> <probability>% <direction>
/predict BTC-100K 72% YES
/predict "Fed rate cut" 45 NO
```

**Implementation Flow:**
```typescript
// skills/predict.ts

import { commitPrediction, calculateBrierScore } from '../lib/onchain';
import { db } from '../lib/supabase/client';

interface PredictResult {
  success: boolean;
  predictionId?: string;
  txSignature?: string;
  explorerUrl?: string;
  error?: string;
}

export async function predict(
  telegramId: string,
  marketId: string,
  probability: number,
  direction: 'YES' | 'NO'
): Promise<PredictResult> {

  // 1. Get or create user
  let user = await db.users.getByTelegramId(telegramId);
  if (!user) {
    user = await db.users.create({ telegram_id: telegramId });
  }

  // 2. Create prediction in Supabase
  const prediction = await db.predictions.create({
    user_id: user.id,
    market_id: marketId,
    probability,
    direction
  });

  // 3. Commit to chain
  const result = await commitPrediction(
    user.wallet_address || telegramId, // Use telegram ID if no wallet
    marketId,
    probability,
    direction
  );

  if (!result.success) {
    // Still saved in Supabase, just not on-chain
    return {
      success: true,
      predictionId: prediction.id,
      error: 'On-chain commit failed: ' + result.error
    };
  }

  // 4. Update with TX signature
  await db.predictions.update(prediction.id, {
    tx_signature: result.signature,
    committed_at: new Date()
  });

  return {
    success: true,
    predictionId: prediction.id,
    txSignature: result.signature,
    explorerUrl: result.explorerUrl
  };
}
```

### 4.3 `/me` Command Specification

**Usage:**
```
/me
/stats
```

**Output:**
```
📊 Your Stats (@username)

🎯 Predictions: 24 total (18 resolved)
📈 Brier Score: 0.18 (Good)
🏆 Rank: #12 of 156 forecasters

Best call: ETH-5K (0.02 Brier - Excellent!)
Worst call: DOGE-1 (0.64 Brier)

📅 Streak: 5 days active
⛓️  On-chain verified: 18/24 predictions
```

### 4.4 `/leaderboard` Command Specification

**Usage:**
```
/leaderboard
/top
/lb
```

**Output:**
```
🏆 BeRight Leaderboard

#1  @superforecaster  │ 0.08 Brier │ 45 predictions
#2  @calibrated_carl  │ 0.12 Brier │ 32 predictions
#3  @probability_paul │ 0.15 Brier │ 28 predictions
...
#12 @you              │ 0.18 Brier │ 24 predictions ← You

💡 Lower Brier = Better calibration
⛓️  All predictions verified on Solana
```

### 4.5 Week 1 Roadmap

| Day | Tasks | Deliverable |
|-----|-------|-------------|
| **Day 1** | `/predict`, `/me`, `/leaderboard` | Core commands working |
| **Day 2** | Integration testing, edge cases | Stable prediction flow |
| **Day 3** | Resolution automation | Market resolution triggers |
| **Day 4** | Web dashboard (basic) | View predictions on web |
| **Day 5** | Polish, documentation | Ready for demo |

### 4.6 Future Phases

**Phase 2 (Week 2-3): Enhanced Features**
- Batch predictions (`/predict-batch`)
- Prediction editing (before resolution)
- Market resolution automation via Polymarket/Kalshi webhooks
- Achievement system (badges)

**Phase 3 (Week 4+): Monetization**
- Premium features (advanced analytics)
- Prediction staking (skin in the game)
- API access for other agents
- Reputation NFTs

---

## Phase 5: Reference Summary

### 5.1 Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| On-chain protocol | Native Memo | SOLPRISM is beta, full control needed |
| Primary storage | Supabase | Fast queries, free tier, real-time |
| Ranking metric | Brier score | Academic standard, rewards calibration |
| Architecture | Single agent + tools | Simpler, lower latency |
| Model selection | Sonnet (default), Opus (research) | Cost optimization |

### 5.2 File Structure

```
beright-ts/
├── agent/
│   └── system.md          # Agent identity
├── skills/
│   ├── telegramHandler.ts # Main router
│   ├── markets.ts         # Market data
│   ├── arbitrage.ts       # Arb detection
│   ├── research.ts        # Superforecaster
│   ├── whale.ts           # Wallet tracking
│   ├── intel.ts           # News/sentiment
│   ├── heartbeat.ts       # Cron tasks
│   ├── predict.ts         # NEW: Make predictions
│   ├── me.ts              # NEW: User stats
│   └── leaderboard.ts     # NEW: Global rankings
├── lib/
│   ├── onchain/
│   │   ├── index.ts       # Exports
│   │   ├── types.ts       # Type definitions
│   │   ├── memo.ts        # Memo formatting
│   │   ├── commit.ts      # TX handling
│   │   └── verify.ts      # Verification
│   └── supabase/
│       ├── client.ts      # DB client
│       ├── types.ts       # DB types
│       └── schema.sql     # Schema
├── config/
│   ├── platforms.ts       # API endpoints
│   ├── thresholds.ts      # Limits
│   └── commands.ts        # Command definitions
├── memory/
│   └── *.json             # File-based state
├── types/
│   └── *.ts               # Shared types
└── BERIGHT_ARCHITECTURE.md # THIS FILE
```

### 5.3 Environment Variables

```env
# Supabase
SUPABASE_URL=https://zmpsqixstjmtftuqstnd.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Solana
SOLANA_PRIVATE_KEY=[byte array]
HELIUS_RPC_MAINNET=https://mainnet.helius-rpc.com/?api-key=...
PREDICTION_SALT=beright-secret-salt

# APIs
HELIUS_API_KEY=...
KALSHI_API_KEY=...

# Telegram
TELEGRAM_BOT_TOKEN=...
```

### 5.4 Quick Reference: On-Chain Functions

```typescript
// Make a prediction
import { commitPrediction } from './lib/onchain';
const result = await commitPrediction(userPubkey, marketId, 0.72, 'YES');
// Returns: { success: true, signature: '5abc...', explorerUrl: '...' }

// Resolve a prediction
import { resolvePrediction } from './lib/onchain';
const result = await resolvePrediction(commitTx, 0.72, 'YES', true);
// Returns: { success: true, signature: '7def...', explorerUrl: '...' }

// Calculate Brier score
import { calculateBrierScore, interpretBrierScore } from './lib/onchain';
const brier = calculateBrierScore({ probability: 0.72, direction: 'YES', outcome: true });
// Returns: 0.0784
const quality = interpretBrierScore(brier);
// Returns: { quality: 'good', description: 'Well-calibrated' }

// Verify prediction
import { verifyPrediction } from './lib/onchain';
const result = await verifyPrediction(commitTx, resolveTx, marketResolutionTime);
// Returns: { valid: true, errors: [], details: {...} }
```

### 5.5 Competitive Moats

1. **On-Chain Calibration** - Only prediction platform with native Solana verification
2. **Brier Score System** - Academic-grade calibration tracking (no competitor has this)
3. **Superforecaster Methodology** - Tetlock framework differentiates from pure arb bots
4. **Cost Efficiency** - ~$0.00075 per verified prediction (vs. $0 for competitors, but no verification)

---

*Document Version: 1.0*
*Last Updated: February 9, 2026*
*Status: Canonical Reference - Follow this architecture exactly*
