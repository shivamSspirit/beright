# On-Chain Forecaster Accuracy & Calibration Storage
## Design Document for BeRight Protocol

**Last Updated**: 2026-03-05
**Status**: Proposal
**Context**: Moving beyond Memo Program to enable efficient accuracy tracking

---

## Current State (Memo Program)

### What We Have

**Location**: `lib/onchain/commit.ts`, `lib/onchain/memo.ts`

```typescript
// Current prediction format
BERIGHT:PREDICT:v1|userPubkey|marketId|probability|direction|timestamp|hash

// Resolution format
BERIGHT:RESOLVE:v1|commitTx|outcome|brierScore
```

### Problems with Memo-Only Approach

| Issue | Impact |
|-------|--------|
| **Not queryable** | Can't fetch "all predictions by forecaster X" without scanning entire chain |
| **No aggregation** | Can't compute accuracy scores on-chain - must index off-chain |
| **Storage in logs only** | Data not in account state - requires full node to query |
| **Limited composability** | Other programs can't read prediction history |
| **No incentives** | Can't build on-chain rewards based on accuracy |
| **Expensive to index** | Need to parse all transaction logs to build leaderboard |

### What Memo IS Good For

✅ **Tamper-proof commits** - Predictions can't be edited after submission
✅ **Low cost** - ~5000 lamports ($0.001) per transaction
✅ **Simple** - No custom program deployment needed
✅ **Multi-prediction batching** - ~6 predictions per transaction

---

## Recommended Architecture: Hybrid Approach

```
┌─────────────────────────────────────────────────────────┐
│              HYBRID ON-CHAIN STORAGE                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  TIER 1: COMMITS (Memo Program)                          │
│  ┌────────────────────────────────────┐                 │
│  │ • Immutable prediction commits      │                 │
│  │ • Tamper-proof timestamps          │                 │
│  │ • Cost: ~$0.001 per prediction     │                 │
│  └────────────────────────────────────┘                 │
│                     ↓                                    │
│  TIER 2: AGGREGATED STATE (Custom Program/PDA)          │
│  ┌────────────────────────────────────┐                 │
│  │ • Forecaster stats (Brier, count)  │                 │
│  │ • Market stats (volume, count)     │                 │
│  │ • Queryable by other programs      │                 │
│  │ • Cost: ~0.005 SOL rent + tx fees  │                 │
│  └────────────────────────────────────┘                 │
│                     ↓                                    │
│  TIER 3: DETAILED HISTORY (Compressed State)            │
│  ┌────────────────────────────────────┐                 │
│  │ • All predictions (Merkle tree)     │                 │
│  │ • Proof-based verification         │                 │
│  │ • Cost: ~$0.10 per 1M predictions  │                 │
│  └────────────────────────────────────┘                 │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Option 1: Custom Anchor Program (RECOMMENDED)

### Why This is Best for BeRight

✅ **Queryable state** - Fetch forecaster stats with a single RPC call
✅ **Composability** - Other programs can read accuracy scores
✅ **On-chain incentives** - Rewards based on accuracy (future: staking, badges)
✅ **Efficient aggregation** - Brier score computed on-chain incrementally
✅ **Standard Solana patterns** - Uses Anchor framework (already in dependencies)

### Architecture

#### Program Structure

```
beright-ts/programs/forecaster-registry/
├── src/
│   ├── lib.rs                  # Program entrypoint
│   ├── state/
│   │   ├── forecaster.rs       # Forecaster stats account
│   │   ├── market.rs           # Market stats account
│   │   └── prediction.rs       # Individual prediction record
│   ├── instructions/
│   │   ├── initialize.rs       # Initialize program
│   │   ├── commit_prediction.rs
│   │   ├── resolve_prediction.rs
│   │   └── update_stats.rs
│   └── errors.rs
├── Cargo.toml
└── Anchor.toml
```

#### Account Structures

**1. Forecaster Account** (PDA: `["forecaster", forecaster_pubkey]`)

```rust
#[account]
pub struct Forecaster {
    pub authority: Pubkey,           // Wallet address
    pub total_predictions: u32,      // Lifetime prediction count
    pub resolved_predictions: u32,   // Predictions with known outcomes
    pub cumulative_brier_score: f64, // Sum of all Brier scores
    pub avg_brier_score: f64,        // Current average (lower = better)
    pub markets_traded: u16,         // Unique markets predicted on
    pub best_category: u8,           // Category with best accuracy
    pub worst_category: u8,          // Category with worst accuracy
    pub streak_correct: u16,         // Current winning streak
    pub last_prediction_ts: i64,     // Unix timestamp
    pub created_at: i64,             // Account creation
    pub bump: u8,                    // PDA bump seed
}
// Size: ~120 bytes
// Rent: ~0.0015 SOL (~$0.20 one-time)
```

**2. Market Account** (PDA: `["market", market_id]`)

```rust
#[account]
pub struct Market {
    pub market_id: [u8; 32],         // Market identifier (hash)
    pub total_predictions: u32,      // Total predictions on this market
    pub unique_forecasters: u16,     // Unique users predicted
    pub avg_predicted_probability: f64, // Consensus prediction
    pub outcome: Option<bool>,       // Final outcome (Some after resolve)
    pub resolved_at: Option<i64>,    // Resolution timestamp
    pub category: u8,                // Category ID (politics, crypto, etc.)
    pub bump: u8,
}
// Size: ~90 bytes
```

**3. Prediction Record** (PDA: `["prediction", forecaster, market_id, timestamp]`)

```rust
#[account]
pub struct Prediction {
    pub forecaster: Pubkey,
    pub market_id: [u8; 32],
    pub predicted_probability: f64,   // 0.0 - 1.0
    pub direction: PredictionDirection, // YES or NO
    pub committed_at: i64,
    pub resolved_at: Option<i64>,
    pub outcome: Option<bool>,
    pub brier_score: Option<f64>,     // Computed after resolution
    pub memo_tx: [u8; 64],            // Reference to Memo transaction
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum PredictionDirection {
    Yes,
    No,
}
// Size: ~170 bytes
```

#### Instructions

**1. Commit Prediction**

```rust
pub fn commit_prediction(
    ctx: Context<CommitPrediction>,
    market_id: [u8; 32],
    predicted_probability: f64,
    direction: PredictionDirection,
    memo_tx_signature: [u8; 64],
) -> Result<()> {
    // 1. Create prediction record PDA
    // 2. Update forecaster stats (increment total_predictions)
    // 3. Update market stats (increment total_predictions, update avg)
    // 4. Emit event for indexers
    Ok(())
}
```

**2. Resolve Prediction**

```rust
pub fn resolve_prediction(
    ctx: Context<ResolvePrediction>,
    outcome: bool, // true = YES, false = NO
) -> Result<()> {
    let prediction = &mut ctx.accounts.prediction;
    let forecaster = &mut ctx.accounts.forecaster;
    let market = &mut ctx.accounts.market;

    // Calculate Brier score
    let p = if prediction.direction == PredictionDirection::Yes {
        prediction.predicted_probability
    } else {
        1.0 - prediction.predicted_probability
    };
    let o = if outcome { 1.0 } else { 0.0 };
    let brier = (p - o).powi(2);

    // Update prediction
    prediction.outcome = Some(outcome);
    prediction.brier_score = Some(brier);
    prediction.resolved_at = Some(Clock::get()?.unix_timestamp);

    // Update forecaster stats
    forecaster.resolved_predictions += 1;
    forecaster.cumulative_brier_score += brier;
    forecaster.avg_brier_score =
        forecaster.cumulative_brier_score / forecaster.resolved_predictions as f64;

    // Update market
    market.outcome = Some(outcome);
    market.resolved_at = Some(Clock::get()?.unix_timestamp);

    emit!(PredictionResolved {
        forecaster: forecaster.authority,
        market_id: prediction.market_id,
        brier_score: brier,
    });

    Ok(())
}
```

**3. Query Forecaster Stats**

```typescript
// Client-side (TypeScript)
import { Program } from '@coral-xyz/anchor';

async function getForecasterStats(
  program: Program,
  forecasterPubkey: PublicKey
): Promise<Forecaster> {
  const [forecasterPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('forecaster'), forecasterPubkey.toBuffer()],
    program.programId
  );

  return await program.account.forecaster.fetch(forecasterPda);
}

// Example output:
{
  authority: PublicKey("7xK..."),
  totalPredictions: 150,
  resolvedPredictions: 120,
  avgBrierScore: 0.18,  // Lower = better (perfect = 0, worst = 1)
  marketsTraded: 45,
  streakCorrect: 7,
  lastPredictionTs: 1735689600
}
```

### Cost Analysis

| Operation | Accounts Created | Rent | Transaction Fee | Total |
|-----------|------------------|------|-----------------|-------|
| Initialize Forecaster | 1 PDA (~120 bytes) | 0.0015 SOL | 0.000005 SOL | **~$0.20** |
| Commit Prediction | 1 PDA (~170 bytes) | 0.002 SOL | 0.000005 SOL | **~$0.27** |
| Resolve Prediction | 0 (updates existing) | 0 | 0.000005 SOL | **~$0.0007** |

**Annual Cost for 1 Active Forecaster** (100 predictions/year):
- Initialization: $0.20 (one-time)
- Predictions: $27 (100 × $0.27)
- Resolutions: $0.07 (100 × $0.0007)
- **Total: ~$27.27/year**

**Optimization**: Use compressed state (Option 3) to reduce to ~$1/year for 100 predictions.

---

## Option 2: State Compression (Lowest Cost)

### What Is State Compression?

Solana's State Compression stores account data in a **Merkle tree** instead of individual accounts. Only the tree root hash lives on-chain, while full data is stored off-chain (indexers).

**Tradeoffs**:
- ✅ **99% cheaper** - ~$0.10 per 1 million predictions
- ✅ **Scales to billions** of predictions
- ✅ **Provably on-chain** - Merkle proofs verify data integrity
- ⚠️ **Requires indexers** - Need RPC providers with compression support (Helius, Triton)
- ⚠️ **Complex queries** - Can't fetch "all predictions by X" without indexer

### Use Case for BeRight

**Best for**: High-volume prediction storage (>1000 predictions/day)

**Pattern**:
1. **Compressed tree** stores all predictions (Merkle proofs)
2. **Regular PDAs** store aggregated stats (Brier scores, counts)
3. **Indexer** (Helius DAS API) provides queryable interface

### Architecture

```rust
// Compressed Prediction (stored in Merkle tree)
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CompressedPrediction {
    pub forecaster: Pubkey,
    pub market_id: [u8; 32],
    pub probability: u16,  // Scaled to u16 (0-10000 = 0.00-1.00)
    pub timestamp: i64,
}
// Size: ~76 bytes (vs 170 bytes uncompressed)

// On-chain aggregated stats (regular PDA)
#[account]
pub struct ForecasterStats {
    pub authority: Pubkey,
    pub total_predictions: u32,
    pub avg_brier_score: f64,
    // ... same as Option 1
}
```

**Cost Comparison**:

| Approach | 1 Prediction | 1000 Predictions | 1M Predictions |
|----------|--------------|------------------|----------------|
| Regular PDA | $0.27 | $270 | $270,000 |
| Compressed | $0.0001 | $0.10 | **$100** |
| **Savings** | - | **99.96%** | **99.96%** |

### Implementation

```rust
use anchor_lang::prelude::*;
use spl_account_compression::{
    program::SplAccountCompression,
    cpi::{accounts::Modify, modify},
    Noop,
};

#[program]
pub mod compressed_forecaster {
    pub fn commit_prediction_compressed(
        ctx: Context<CommitCompressed>,
        market_id: [u8; 32],
        probability: u16,
    ) -> Result<()> {
        // Serialize prediction
        let prediction = CompressedPrediction {
            forecaster: ctx.accounts.forecaster.key(),
            market_id,
            probability,
            timestamp: Clock::get()?.unix_timestamp,
        };
        let leaf = hash_to_leaf(&prediction);

        // Append to Merkle tree
        let cpi_ctx = CpiContext::new(
            ctx.accounts.compression_program.to_account_info(),
            Modify {
                merkle_tree: ctx.accounts.merkle_tree.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
                noop: ctx.accounts.log_wrapper.to_account_info(),
            },
        );
        modify(cpi_ctx, /* ... */)?;

        // Update aggregated stats (regular PDA)
        ctx.accounts.forecaster_stats.total_predictions += 1;

        Ok(())
    }
}
```

**Querying** (requires Helius DAS API):

```typescript
import { Helius } from 'helius-sdk';

const helius = new Helius(process.env.HELIUS_API_KEY);

// Get all compressed predictions for a forecaster
const assets = await helius.rpc.getAssetsByOwner({
  ownerAddress: forecasterPubkey,
  page: 1,
  limit: 1000,
  // Filter by our Merkle tree
  displayOptions: {
    showCollectionMetadata: true,
  },
});

// assets[0].compression.leaf_id → Merkle proof
// assets[0].content.json_uri → Off-chain prediction data
```

---

## Option 3: Clockwork Automation (On-Chain Cron)

### Problem Solved

Currently, resolving predictions requires a manual transaction. With Clockwork, resolutions happen **automatically** when markets close.

### How It Works

```
Market Closes (timestamp reached)
    ↓
Clockwork Automation triggers
    ↓
Fetch oracle outcome (Pyth, Switchboard)
    ↓
Call resolve_prediction() instruction
    ↓
Update all forecaster stats
    ↓
Emit PredictionResolved events
```

### Code Example

```rust
use clockwork_sdk::prelude::*;

#[program]
pub mod forecaster_with_automation {
    pub fn schedule_resolution(
        ctx: Context<ScheduleResolution>,
        market_id: [u8; 32],
        close_timestamp: i64,
    ) -> Result<()> {
        // Create Clockwork thread
        clockwork_sdk::cpi::thread_create(
            CpiContext::new(
                ctx.accounts.clockwork_program.to_account_info(),
                ThreadCreate {
                    authority: ctx.accounts.authority.to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    thread: ctx.accounts.thread.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                },
            ),
            // Thread runs at close_timestamp
            Trigger::Timestamp {
                unix_ts: close_timestamp,
            },
            // Call our resolve instruction
            vec![InstructionData {
                program_id: crate::ID,
                accounts: vec![/* ... */],
                data: /* resolve_prediction args */,
            }],
        )?;

        Ok(())
    }
}
```

**Cost**: ~0.001 SOL per automated resolution (~$0.14)

---

## Recommended Implementation Plan

### Phase 1: Anchor Program MVP (1 week)

**Goal**: Replace Memo-only approach with queryable on-chain stats

**Deliverables**:
1. ✅ Deploy Anchor program to devnet
2. ✅ Forecaster & Market PDAs
3. ✅ Commit/resolve instructions
4. ✅ TypeScript SDK for client integration
5. ✅ Integration with existing `lib/onchain/` modules

**Files to Create**:
```
beright-ts/programs/forecaster-registry/
├── src/lib.rs
├── state/forecaster.rs
├── state/market.rs
├── instructions/commit.rs
└── instructions/resolve.rs

beright-ts/lib/onchain/
├── program.ts          # Anchor program client
├── pda.ts              # PDA derivation helpers
└── queries.ts          # Fetch forecaster/market stats
```

**Integration Points**:
- Update `lib/onchain/commit.ts` to create PDA after Memo transaction
- Update `lib/onchain/verify.ts` to fetch from PDAs instead of parsing logs
- Add `getForecasterStats(pubkey)` to skills

---

### Phase 2: Leaderboard & Incentives (2 weeks)

**Goal**: Public leaderboard with on-chain verification

**Features**:
1. Global leaderboard (top 100 forecasters by Brier score)
2. Category-specific leaderboards (politics, crypto, sports)
3. Accuracy badges (NFTs for milestones: 50 predictions, 0.15 Brier, etc.)
4. Referral tracking (who invited whom)

**New Instructions**:
```rust
pub fn claim_badge(ctx: Context<ClaimBadge>, badge_type: BadgeType) -> Result<()>
pub fn update_leaderboard(ctx: Context<UpdateLeaderboard>) -> Result<()>
```

**Frontend Integration**:
```typescript
// berightweb/src/app/leaderboard/page.tsx
const topForecasters = await program.account.forecaster.all([
  { memcmp: { offset: 8 + 32, bytes: /* filter by category */ } }
]);

topForecasters.sort((a, b) => a.avgBrierScore - b.avgBrierScore);
```

---

### Phase 3: State Compression (3 weeks)

**Goal**: Scale to millions of predictions

**When to Implement**: After hitting >10,000 predictions (current: ~500 based on memory logs)

**Migration Strategy**:
1. Keep existing PDAs for aggregated stats
2. Move detailed prediction history to compressed tree
3. Use Helius DAS API for historical queries

**Cost Savings**: $270 → $0.10 per 1000 predictions

---

## Comparison Table

| Approach | Cost/1K Predictions | Queryable | Composable | Complexity | Best For |
|----------|---------------------|-----------|------------|------------|----------|
| **Memo Only** (current) | $1 | ❌ | ❌ | Low | Immutable commits |
| **Anchor Program** | $270 | ✅ | ✅ | Medium | <100K predictions |
| **State Compression** | $0.10 | ⚠️ Indexer | ✅ | High | >100K predictions |
| **Hybrid** (Memo + Anchor) | $1 + $270 | ✅ | ✅ | Medium | **RECOMMENDED** |

---

## Code Integration Example

### Before (Memo Only)

```typescript
// lib/onchain/commit.ts
async function commitPrediction(
  userPubkey: PublicKey,
  marketId: string,
  probability: number
) {
  const memo = formatPredictionMemo(userPubkey, marketId, probability);
  const tx = new Transaction().add(createMemoInstruction(memo));
  const signature = await sendAndConfirmTransaction(connection, tx, [signer]);

  return { signature, memo };
}
```

### After (Hybrid: Memo + Anchor)

```typescript
// lib/onchain/commit.ts
async function commitPrediction(
  userPubkey: PublicKey,
  marketId: string,
  probability: number
) {
  // Step 1: Immutable commit via Memo (tamper-proof)
  const memo = formatPredictionMemo(userPubkey, marketId, probability);
  const memoIx = createMemoInstruction(memo, userPubkey);

  // Step 2: Create queryable PDA via Anchor program
  const program = getForecasterProgram();
  const [forecasterPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('forecaster'), userPubkey.toBuffer()],
    program.programId
  );
  const [marketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('market'), Buffer.from(marketId)],
    program.programId
  );
  const [predictionPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('prediction'),
      userPubkey.toBuffer(),
      Buffer.from(marketId),
      Buffer.from(Date.now().toString()),
    ],
    program.programId
  );

  const commitIx = await program.methods
    .commitPrediction(
      Array.from(Buffer.from(marketId)),
      probability,
      { yes: {} }, // PredictionDirection enum
      Array.from(bs58.decode('signature_placeholder'))
    )
    .accounts({
      forecaster: forecasterPda,
      market: marketPda,
      prediction: predictionPda,
      authority: userPubkey,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  // Combine both instructions in one transaction
  const tx = new Transaction().add(memoIx, commitIx);
  const signature = await sendAndConfirmTransaction(connection, tx, [signer]);

  return { signature, memo, forecasterPda, predictionPda };
}
```

### Querying Stats

```typescript
// NEW: lib/onchain/queries.ts
import { Program, AnchorProvider } from '@coral-xyz/anchor';

export async function getForecasterStats(
  forecasterPubkey: PublicKey
): Promise<ForecasterStats> {
  const program = getForecasterProgram();
  const [forecasterPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('forecaster'), forecasterPubkey.toBuffer()],
    program.programId
  );

  const forecaster = await program.account.forecaster.fetch(forecasterPda);

  return {
    totalPredictions: forecaster.totalPredictions,
    resolvedPredictions: forecaster.resolvedPredictions,
    avgBrierScore: forecaster.avgBrierScore,
    accuracy: 1 - forecaster.avgBrierScore, // Convert to percentage
    streakCorrect: forecaster.streakCorrect,
    lastPredictionTs: new Date(forecaster.lastPredictionTs * 1000),
  };
}

export async function getTopForecasters(limit: number = 10): Promise<ForecasterStats[]> {
  const program = getForecasterProgram();
  const forecasters = await program.account.forecaster.all();

  return forecasters
    .sort((a, b) => a.account.avgBrierScore - b.account.avgBrierScore)
    .slice(0, limit)
    .map(f => ({
      pubkey: f.publicKey,
      ...f.account,
    }));
}
```

---

## Security Considerations

### 1. Authority Verification

```rust
// Only forecaster can resolve their own predictions
#[derive(Accounts)]
pub struct ResolvePrediction<'info> {
    #[account(
        mut,
        has_one = forecaster @ ErrorCode::Unauthorized
    )]
    pub prediction: Account<'info, Prediction>,

    #[account(mut)]
    pub forecaster: Account<'info, Forecaster>,

    pub authority: Signer<'info>, // Must match forecaster.authority
}
```

### 2. Oracle Integration (Future)

For automated resolution, use **Pyth** or **Switchboard** price feeds:

```rust
use pyth_sdk_solana::load_price_feed_from_account_info;

pub fn resolve_with_oracle(
    ctx: Context<ResolveWithOracle>,
    threshold_price: i64,
) -> Result<()> {
    let price_feed = load_price_feed_from_account_info(&ctx.accounts.price_feed)?;
    let current_price = price_feed.get_current_price().unwrap();

    let outcome = current_price.price >= threshold_price;

    // Rest of resolution logic...
}
```

### 3. Spam Prevention

```rust
// Require minimum stake to create predictions
#[account(
    constraint = forecaster.stake >= MIN_STAKE @ ErrorCode::InsufficientStake
)]
pub forecaster: Account<'info, Forecaster>,
```

---

## Next Steps

### Immediate (This Week)

1. ✅ **Review this design document**
2. ⬜ **Choose approach**: Anchor Program (Phase 1) vs State Compression (Phase 3)
3. ⬜ **Set up Anchor workspace**: `anchor init forecaster-registry`
4. ⬜ **Deploy to devnet**: Test with fake predictions
5. ⬜ **Integrate with existing `/lib/onchain/` modules**

### Short-term (2-4 Weeks)

6. ⬜ **Mainnet deployment** (after testing)
7. ⬜ **Migrate existing Memo predictions** to PDAs (backfill script)
8. ⬜ **Update Telegram bot** to show on-chain stats (`/me` command)
9. ⬜ **Build leaderboard API** endpoint
10. ⬜ **Frontend integration** (berightweb)

### Long-term (1-3 Months)

11. ⬜ **State compression migration** (if >10K predictions)
12. ⬜ **Clockwork automation** (auto-resolve)
13. ⬜ **NFT badges** for accuracy milestones
14. ⬜ **On-chain incentives** (staking, rewards pool)

---

## References

- **Anchor Framework**: https://www.anchor-lang.com
- **State Compression**: https://docs.solana.com/developing/guides/compressed-nfts
- **Clockwork**: https://docs.clockwork.xyz
- **Helius DAS API**: https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api
- **BeRight Existing Code**: `lib/onchain/`, `lib/dflow/`

---

## TL;DR

**Current Problem**: Memo Program stores predictions in logs (not queryable)
**Recommended Solution**: Hybrid Anchor Program + Memo
**Benefits**: Queryable stats, on-chain composability, future incentives
**Cost**: ~$27/year per active forecaster (100 predictions)
**Migration**: Keep Memo for immutability, add PDAs for aggregated stats
**Timeline**: 1 week for MVP, 2 weeks for leaderboard, 3 weeks for compression

**Start with Phase 1 (Anchor Program)** - it's the sweet spot of cost, complexity, and features.
