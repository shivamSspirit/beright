# BeRight Protocol - Gap Analysis

> **Architecture Vision vs Current Implementation**
>
> Date: February 9, 2026

---

## Executive Summary

| Category | Architecture Target | Current State | Gap |
|----------|-------------------|---------------|-----|
| **Core Commands** | 3 commands with on-chain | 3 commands (file-based) | **50% complete** |
| **Storage** | Supabase primary | File-based (memory/*.json) | **Not integrated** |
| **On-Chain** | Auto-commit to Solana | Module exists, not wired | **Not wired** |
| **Leaderboard** | Supabase view | File-based JSON | **Not integrated** |

**Bottom Line:** The building blocks exist, but they're not connected. The `/predict`, `/me`, `/leaderboard` commands work but use file storage instead of Supabase + on-chain.

---

## Detailed Comparison

### 1. Command Implementation

#### `/predict` Command

| Aspect | Architecture Spec | Current Implementation | Status |
|--------|------------------|------------------------|--------|
| **Location** | `skills/predict.ts` (separate file) | `skills/telegramHandler.ts:180-230` | Inline |
| **Storage** | Supabase `predictions` table | `memory/predictions.json` (file) | File-based |
| **On-chain commit** | `commitPrediction()` called | Not called | **MISSING** |
| **TX signature** | Stored in Supabase | Not stored | **MISSING** |
| **User tracking** | Supabase user lookup | `lib/leaderboard.ts` file-based | File-based |

**Current Code Flow (telegramHandler.ts:180-230):**
```typescript
// What happens now:
1. Parse: /predict "question" 70 YES reason
2. Call calibration.predict() → saves to memory/predictions.json
3. Call leaderboard.addUserPrediction() → saves to memory/user-predictions.json
4. Return response
// ❌ NO Supabase
// ❌ NO on-chain commit
```

**Architecture Target Flow:**
```typescript
// What should happen:
1. Parse: /predict "question" 70 YES reason
2. Get/create user in Supabase
3. Create prediction in Supabase
4. Call commitPrediction() → sends TX to Solana
5. Update prediction with TX signature
6. Return response with explorer link
```

---

#### `/me` Command

| Aspect | Architecture Spec | Current Implementation | Status |
|--------|------------------|------------------------|--------|
| **Location** | `skills/me.ts` (separate file) | `skills/telegramHandler.ts:235-296` | Inline |
| **Data source** | Supabase queries | `lib/leaderboard.ts` (file-based) | File-based |
| **On-chain count** | Count of verified TX | Not tracked | **MISSING** |
| **Wallet display** | Shows connected wallet | Via identity.ts (file-based) | Partial |

**Current Code (telegramHandler.ts:235-296):**
```typescript
// Reads from file-based lib/leaderboard.ts
let userStats = telegramId ? calculateUserStats(telegramId) : null;
const globalStats = getCalibrationStats(); // ← file-based
const pending = telegramId ? getUserPendingPredictions(telegramId) : listPending();
```

---

#### `/leaderboard` Command

| Aspect | Architecture Spec | Current Implementation | Status |
|--------|------------------|------------------------|--------|
| **Location** | `skills/leaderboard.ts` (separate file) | `skills/telegramHandler.ts:442-465` | Inline |
| **Data source** | Supabase `leaderboard` view | `memory/user-predictions.json` | File-based |
| **Ranking** | By avg Brier score | By avg Brier score | Correct |
| **Min predictions** | 5 to rank | 1 to rank (5 preferred) | Partial |

---

### 2. Storage Layer

#### File-Based (Current)

```
memory/
├── predictions.json         # Global predictions (calibration.ts)
├── user-predictions.json    # Per-user predictions (leaderboard.ts)
├── whales.json             # Tracked whale wallets
├── watchlist.json          # User watchlists
├── positions.json          # User positions
├── conversations.json      # Chat memory
├── learnings.json          # AI learnings
├── heartbeat-state.json    # Cron state
├── price-history.json      # Historical prices
├── builder-volume.json     # Kalshi volume
├── decisions.json          # Decision audit
└── prediction-trades.json  # Trade records
```

**Problem:** Data is split across files, no ACID guarantees, no cross-user queries efficient.

#### Supabase (Target)

```sql
-- Tables exist in Supabase but NOT USED:
users                 -- ✅ Schema exists, client ready
predictions           -- ✅ Schema exists, client ready
alerts                -- ✅ Schema exists, client ready
watchlist             -- ✅ Schema exists, client ready
leaderboard (view)    -- ✅ Schema exists, client ready
whale_wallets         -- ✅ Schema exists, client ready
whale_trades          -- ✅ Schema exists, client ready
arbitrage_history     -- ✅ Schema exists, client ready
```

**Client is ready** (`lib/supabase/client.ts`):
```typescript
// These helpers exist and work:
await db.users.getByTelegramId(123456);
await db.predictions.create({ ... });
await db.predictions.resolve(predictionId, true);
await db.predictions.addOnChainTx(predictionId, txSignature);
await db.leaderboard.get({ limit: 10 });
```

---

### 3. On-Chain Module

| Component | Status | Notes |
|-----------|--------|-------|
| `lib/onchain/types.ts` | Complete | BERIGHT memo format defined |
| `lib/onchain/memo.ts` | Complete | formatPredictionMemo, calculateBrierScore |
| `lib/onchain/commit.ts` | Complete | commitPrediction, resolvePrediction, batchCommit |
| `lib/onchain/verify.ts` | Complete | fetchPrediction, verifyPrediction |
| `lib/onchain/test.ts` | Complete | All tests pass |

**The module is 100% complete and tested.** It just needs to be wired into the `/predict` flow.

```typescript
// This code EXISTS and WORKS:
import { commitPrediction, calculateBrierScore } from './lib/onchain';

const result = await commitPrediction(
  userPubkey,
  marketId,
  0.72,
  'YES'
);
// Returns: { success: true, signature: '5abc...', explorerUrl: '...' }
```

---

### 4. Skills Organization

#### Architecture Target
```
skills/
├── telegramHandler.ts   # Router only (slim)
├── markets.ts           # ✅ Exists
├── arbitrage.ts         # ✅ Exists
├── research.ts          # ✅ Exists
├── whale.ts             # ✅ Exists
├── intel.ts             # ✅ Exists
├── heartbeat.ts         # ✅ Exists
├── predict.ts           # ❌ MISSING (inline in handler)
├── me.ts                # ❌ MISSING (inline in handler)
└── leaderboard.ts       # ❌ MISSING (inline in handler)
```

#### Current State
```
skills/
├── telegramHandler.ts   # 1325 lines (too big, has inline handlers)
├── markets.ts           # ✅
├── arbitrage.ts         # ✅
├── research.ts          # ✅
├── whale.ts             # ✅
├── intel.ts             # ✅
├── heartbeat.ts         # ✅
├── calibration.ts       # ✅ (has predict function but file-based)
├── trade.ts             # ✅
├── positions.ts         # ✅
├── copyTrading.ts       # ✅
├── priceAlerts.ts       # ✅
├── autoTrade.ts         # ✅
├── memory.ts            # ✅
├── notifications.ts     # ✅
└── ... (26 total files)
```

---

## Gap Summary

### Critical Gaps (P0)

| Gap | Impact | Fix Effort |
|-----|--------|------------|
| **On-chain not wired** | Predictions not verifiable | 2 hours |
| **Supabase not used** | No persistent storage | 3 hours |
| **Dual storage (file + no Supabase)** | Data inconsistency risk | 3 hours |

### Important Gaps (P1)

| Gap | Impact | Fix Effort |
|-----|--------|------------|
| Commands inline in handler | Hard to maintain | 1 hour |
| No TX signature tracking | Can't verify on-chain | 30 min |
| Leaderboard file-based | Won't scale | 1 hour |

### Nice-to-Have (P2)

| Gap | Impact | Fix Effort |
|-----|--------|------------|
| Extract predict.ts | Cleaner code | 30 min |
| Extract me.ts | Cleaner code | 30 min |
| Extract leaderboard.ts | Cleaner code | 30 min |

---

## Wiring Plan

### Step 1: Wire `/predict` to Supabase + On-Chain (P0)

**File:** `skills/telegramHandler.ts` (modify handlePredict function)

```typescript
// CHANGE FROM:
async function handlePredict(text: string, telegramId?: string): Promise<SkillResponse> {
  // ... parse ...
  const globalResult = await predict(...); // ← file-based
  if (telegramId) {
    addUserPrediction(...); // ← file-based
  }
  return globalResult;
}

// CHANGE TO:
async function handlePredict(text: string, telegramId?: string): Promise<SkillResponse> {
  // ... parse ...

  // 1. Get/create user in Supabase
  const user = await db.users.upsertFromTelegram(parseInt(telegramId!), username);

  // 2. Create prediction in Supabase
  const prediction = await db.predictions.create({
    user_id: user.id,
    question,
    predicted_probability: probability,
    direction,
    reasoning,
    platform: 'telegram'
  });

  // 3. Commit to chain
  const chainResult = await commitPrediction(
    user.wallet_address || telegramId!,
    question.slice(0, 30), // Market ID
    probability,
    direction
  );

  // 4. Update with TX
  if (chainResult.success) {
    await db.predictions.addOnChainTx(prediction.id, chainResult.signature!);
  }

  // 5. Return with explorer link
  return {
    text: `✅ Prediction committed!\n\n` +
          `📊 ${question}\n` +
          `Direction: ${direction} @ ${(probability*100).toFixed(0)}%\n\n` +
          (chainResult.success
            ? `⛓️ TX: ${chainResult.signature?.slice(0,8)}...\n🔗 ${chainResult.explorerUrl}`
            : `⚠️ On-chain commit pending`),
    mood: 'NEUTRAL'
  };
}
```

### Step 2: Wire `/me` to Supabase (P0)

```typescript
// Use Supabase instead of file-based
async function handleMe(telegramId?: string): Promise<SkillResponse> {
  if (!telegramId) return { text: 'Could not identify you', mood: 'ERROR' };

  // Get from Supabase
  const user = await db.users.getByTelegramId(parseInt(telegramId));
  if (!user) {
    return { text: 'Make your first prediction with /predict', mood: 'NEUTRAL' };
  }

  const predictions = await db.predictions.getByUser(user.id);
  const resolved = predictions.filter(p => p.resolved_at);
  const brierScores = resolved.map(p => p.brier_score).filter(Boolean);
  const avgBrier = brierScores.length
    ? brierScores.reduce((a,b) => a+b, 0) / brierScores.length
    : 0;

  const onChainCount = predictions.filter(p => p.on_chain_tx).length;

  return {
    text: `📊 Your Stats\n\n` +
          `🎯 Predictions: ${predictions.length} (${resolved.length} resolved)\n` +
          `📈 Brier Score: ${avgBrier.toFixed(4)}\n` +
          `⛓️ On-chain verified: ${onChainCount}/${predictions.length}`,
    mood: 'NEUTRAL'
  };
}
```

### Step 3: Wire `/leaderboard` to Supabase (P0)

```typescript
async function handleLeaderboard(): Promise<SkillResponse> {
  // Use Supabase view
  const entries = await db.leaderboard.get({ limit: 10 });

  let text = '🏆 *FORECASTER LEADERBOARD*\n\n';

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const rank = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
    const name = e.telegram_username || `User ${e.telegram_id?.toString().slice(-4)}`;
    text += `${rank} ${name}\n`;
    text += `   Brier: ${e.avg_brier_score?.toFixed(3)} | n=${e.prediction_count}\n\n`;
  }

  return { text, mood: 'BULLISH' };
}
```

---

## Current vs Target Architecture Diagram

```
CURRENT STATE:
─────────────────────────────────────────────────────────────
User → Telegram → telegramHandler.ts → calibration.ts/leaderboard.ts
                                              ↓
                                    memory/*.json (FILES)

                                    ❌ Supabase (exists but unused)
                                    ❌ On-chain (exists but unused)


TARGET STATE (per BERIGHT_ARCHITECTURE.md):
─────────────────────────────────────────────────────────────
User → Telegram → telegramHandler.ts
                         ↓
              ┌─────────────────────┐
              │   predict.ts        │
              │   me.ts             │
              │   leaderboard.ts    │
              └─────────────────────┘
                         ↓
              ┌─────────────────────┐
              │   SUPABASE          │ ← Primary storage
              │   (users,           │
              │    predictions,     │
              │    leaderboard)     │
              └─────────────────────┘
                         ↓
              ┌─────────────────────┐
              │   SOLANA MEMO       │ ← Verification anchor
              │   (lib/onchain)     │
              └─────────────────────┘
```

---

## Action Items

### Immediate (Today)

1. [ ] Modify `handlePredict` to use Supabase + on-chain
2. [ ] Modify `handleMe` to query Supabase
3. [ ] Modify `handleLeaderboard` to use Supabase view
4. [ ] Test end-to-end flow

### This Week

5. [ ] Extract predict/me/leaderboard to separate skill files
6. [ ] Add resolution automation (heartbeat checks market outcomes)
7. [ ] Add batch commit support for multiple predictions

---

*Analysis generated: February 9, 2026*
