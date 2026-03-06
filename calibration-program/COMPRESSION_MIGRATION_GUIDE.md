# State Compression Migration Guide

## 🚀 Overview

This guide helps you migrate from **regular PDAs** ($0.27/prediction) to **compressed accounts** ($0.0001/prediction) - a **99% cost reduction**.

## 📊 Cost Comparison

| Predictions | PDA Cost | Compressed Cost | Savings |
|------------|----------|-----------------|---------|
| 1,000 | $270 | $0.10 | $269.90 (99.96%) |
| 10,000 | $2,700 | $1.00 | $2,699 (99.96%) |
| 100,000 | $27,000 | $10.00 | $26,990 (99.96%) |
| 1,000,000 | $270,000 | $100.00 | $269,900 (99.96%) |

---

## 🏗️ Architecture Decision

### What Gets Compressed?

✅ **COMPRESS**: `PredictionRecord` accounts (individual predictions)
- Why: These are the bottleneck (200 bytes each)
- Cost reduction: $0.27 → $0.0001 per prediction

❌ **KEEP AS PDA**: `ForecasterState` accounts (aggregated stats)
- Why: Need fast on-chain queries for leaderboards
- Impact: One per forecaster (~$0.40 one-time)

### Hybrid Approach Benefits

```
ForecasterState (PDA)          → Fast queries, leaderboard aggregation
    ↓
PredictionRecords (Compressed) → 99% cheaper history, Merkle tree proof
    ↓
Helius Indexer                 → Off-chain queries for compressed data
```

---

## 📋 Migration Steps

### Step 1: Deploy Updated Program

```bash
# Build with state compression dependencies
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Upgrade on mainnet (if already deployed)
anchor upgrade target/deploy/calibration.so \
  --program-id CaLibXYZAbcd1234567890qwertyuiopasdfghjkl \
  --provider.cluster mainnet
```

### Step 2: Initialize Merkle Tree

Choose your tree size based on expected prediction volume:

```typescript
import { initializeMerkleTree } from './app/client';
import { Keypair, PublicKey } from '@solana/web3.js';

// Create tree account
const treeKeypair = Keypair.generate();

// Initialize tree (depth=14 = 16K predictions)
const tx = await initializeMerkleTree(
  program,
  payerKeypair,       // Who pays for initialization
  treeKeypair,        // Tree account keypair
  payerKeypair.publicKey, // Tree authority (who can append)
  14,                 // maxDepth (16,384 capacity)
  64                  // maxBufferSize
);

console.log('Tree initialized:', treeKeypair.publicKey.toBase58());
```

**Tree Size Recommendations:**

| Max Predictions | maxDepth | maxBufferSize | One-time Cost |
|----------------|----------|---------------|---------------|
| 1,024 | 10 | 64 | ~$0.14 |
| 4,096 | 12 | 64 | ~$0.28 |
| 16,384 | 14 | 64 | ~$0.56 |
| 65,536 | 16 | 128 | ~$1.40 |
| 262,144 | 18 | 256 | ~$3.50 |
| 1,048,576 | 20 | 256 | ~$7.00 |

### Step 3: Start Using Compressed Predictions

```typescript
import { recordCompressedPrediction } from './app/client';

// Record prediction (99% cheaper!)
const tx = await recordCompressedPrediction(
  program,
  forecasterKeypair,
  merkleTreePubkey,
  'BTC:above:100k',   // Market ID
  0.75,               // Probability
  'Yes',              // Direction
  memoTxSignature,    // Memo tx reference
  0                   // Category
);

// Cost: ~$0.0001 (vs $0.27 for PDA)
```

### Step 4: Set Up Helius Indexer

Get your free API key at https://helius.dev

```typescript
import { fetchCompressedPredictions, buildCompressedLeaderboard } from './app/indexer';

// Fetch predictions
const predictions = await fetchCompressedPredictions(
  process.env.HELIUS_API_KEY!,
  merkleTreePubkey,
  {
    forecaster: forecasterPubkey, // Optional filter
    limit: 100,
    cluster: 'mainnet'
  }
);

// Build leaderboard from compressed data
const leaderboard = await buildCompressedLeaderboard(
  process.env.HELIUS_API_KEY!,
  merkleTreePubkey,
  'mainnet'
);

console.log('Top 10 forecasters:', leaderboard.slice(0, 10));
```

### Step 5: Update Frontend/Backend

**Before (PDA approach):**
```typescript
// Query prediction directly from chain
const prediction = await program.account.predictionRecord.fetch(predictionPda);
```

**After (Compressed approach):**
```typescript
// Query via Helius indexer
const prediction = await fetchCompressedPredictionByIndex(
  heliusApiKey,
  merkleTreePubkey,
  leafIndex
);
```

---

## 🔄 Backward Compatibility

### Option A: Dual Mode (Support Both)

Keep both instructions available:

```typescript
// New users → compressed (cheap)
if (user.useCompression) {
  await recordCompressedPrediction(...);
} else {
  // Old users → PDA (expensive but familiar)
  await recordPrediction(...);
}
```

**Pros:**
- Gradual migration
- No breaking changes
- Users choose cost vs convenience

**Cons:**
- Maintain two codepaths
- More complex

### Option B: Force Migration

Only expose compressed endpoint:

```typescript
// Only compressed predictions allowed
await recordCompressedPrediction(...);
```

**Pros:**
- Simpler codebase
- 99% cost savings for everyone

**Cons:**
- Breaking change for existing integrations
- Need Helius API key for queries

### Recommended: Hybrid Migration

1. **Week 1-2**: Deploy both, default to PDA
2. **Week 3-4**: Default to compressed, allow PDA opt-in
3. **Month 2**: Deprecate PDA endpoint
4. **Month 3**: Remove PDA code entirely

---

## 📦 Querying Compressed Data

### Using Helius DAS API

```typescript
// 1. Get all predictions in a tree
const allPredictions = await fetchCompressedPredictions(
  heliusApiKey,
  merkleTreePubkey,
  { limit: 1000 }
);

// 2. Filter by forecaster
const userPredictions = await fetchCompressedPredictions(
  heliusApiKey,
  merkleTreePubkey,
  { forecaster: userPubkey }
);

// 3. Get specific prediction by leaf index
const prediction = await fetchCompressedPredictionByIndex(
  heliusApiKey,
  merkleTreePubkey,
  42 // Leaf index
);
```

### Caching Strategy

**Problem:** Helius API has rate limits (free tier: 100 req/min)

**Solution:** Cache aggregated data

```typescript
// Run this every 5 minutes via cron
async function updateLeaderboardCache() {
  const leaderboard = await buildCompressedLeaderboard(
    heliusApiKey,
    merkleTreePubkey,
    'mainnet'
  );

  // Store in Redis/PostgreSQL
  await redis.set('leaderboard:latest', JSON.stringify(leaderboard), 'EX', 300);
}

// Frontend fetches from cache
const cachedLeaderboard = await redis.get('leaderboard:latest');
```

---

## 🛠️ Testing Compressed Predictions

### Unit Test Example

```typescript
import { initializeMerkleTree, recordCompressedPrediction } from './app/client';

describe('Compressed Predictions', () => {
  let treeKeypair: Keypair;
  let merkleTree: PublicKey;

  before(async () => {
    // Initialize tree (depth=10 for testing)
    treeKeypair = Keypair.generate();
    await initializeMerkleTree(
      program,
      payerKeypair,
      treeKeypair,
      payerKeypair.publicKey,
      10, // Small tree for tests
      64
    );
    merkleTree = treeKeypair.publicKey;
  });

  it('Records compressed prediction', async () => {
    const tx = await recordCompressedPrediction(
      program,
      forecasterKeypair,
      merkleTree,
      'TEST:market',
      0.75,
      'Yes',
      memoTxSig,
      0
    );

    assert.ok(tx);

    // Verify ForecasterState updated
    const stats = await getForecasterStats(program, forecasterKeypair.publicKey);
    assert.equal(stats.totalPredictions, 1);
  });
});
```

---

## ⚠️ Gotchas & Limitations

### 1. Compressed Data Not Queryable On-Chain

❌ **This won't work:**
```typescript
const prediction = await program.account.compressedPrediction.fetch(address);
// ERROR: No such account type
```

✅ **Use indexer instead:**
```typescript
const prediction = await fetchCompressedPredictionByIndex(heliusApiKey, tree, index);
```

### 2. Helius API Key Required

- Free tier: 100 requests/min
- Paid tier: 1000+ requests/min
- Alternative: Run your own indexer (Geyser plugin)

### 3. Tree Capacity is Fixed

Once initialized, tree size cannot change.

**Solution:** Create multiple trees

```typescript
// Tree 1: First 16K predictions
const tree1 = await initializeMerkleTree(program, payer, tree1Keypair, authority, 14, 64);

// Tree 2: Next 16K predictions
const tree2 = await initializeMerkleTree(program, payer, tree2Keypair, authority, 14, 64);

// Route to tree based on capacity
const currentTree = tree1Full ? tree2 : tree1;
await recordCompressedPrediction(program, user, currentTree, ...);
```

### 4. Resolution Process Differs

PDA version: Update account directly
Compressed version: Cannot update compressed data

**Solution:** Emit event for resolution, indexer updates metadata

```rust
// In resolve_compressed_prediction instruction
emit!(PredictionResolved {
    leaf_index,
    outcome,
    brier_score,
    log_score,
});

// Indexer listens and updates metadata off-chain
```

---

## 🔐 Security Considerations

### Merkle Proof Verification

Compressed predictions use Merkle proofs for verification:

```typescript
// User claims: "I predicted 75% on BTC"
// Verification:
// 1. Get leaf hash from prediction data
// 2. Get Merkle proof from indexer
// 3. Verify proof against on-chain root
// 4. If valid → prediction is authentic
```

### Tree Authority

Only the designated authority can append to the tree:

```rust
#[account(
    constraint = tree_authority.key() == authority.key() @ CalibrationError::Unauthorized
)]
```

**Best Practice:** Use program PDA as tree authority (not user wallets)

```typescript
const [treeAuthorityPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('tree_authority')],
  programId
);
```

---

## 📈 Monitoring & Observability

### Track Compression Adoption

```sql
-- PostgreSQL schema for tracking
CREATE TABLE prediction_events (
  id SERIAL PRIMARY KEY,
  forecaster TEXT NOT NULL,
  market_id TEXT NOT NULL,
  probability NUMERIC NOT NULL,
  is_compressed BOOLEAN NOT NULL,
  tree_address TEXT,
  leaf_index INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Query compression adoption rate
SELECT
  is_compressed,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM prediction_events
GROUP BY is_compressed;
```

### Estimate Cost Savings

```typescript
import { calculateCostSavings } from './app/client';

// Track actual savings
const stats = {
  pdaPredictions: 1000,
  compressedPredictions: 50000,
};

const pdaCost = stats.pdaPredictions * 0.27;
const compressedCost = stats.compressedPredictions * 0.0001;
const totalSavings = (stats.pdaPredictions * 0.27) - (stats.compressedPredictions * 0.0001);

console.log(`Total savings: $${totalSavings.toFixed(2)}`);
```

---

## 🎯 Migration Checklist

- [ ] Deploy updated program with compression instructions
- [ ] Initialize Merkle tree(s) for production
- [ ] Get Helius API key and test indexer integration
- [ ] Update frontend to use `recordCompressedPrediction()`
- [ ] Set up cron job for leaderboard cache updates
- [ ] Monitor compression adoption rate
- [ ] Deprecate PDA endpoint (gradual rollout)
- [ ] Update documentation and user guides
- [ ] Celebrate 99% cost savings! 🎉

---

## 📚 Additional Resources

- [Solana State Compression Docs](https://docs.solana.com/developing/guides/compressed-nfts)
- [SPL Account Compression](https://github.com/solana-labs/solana-program-library/tree/master/account-compression)
- [Helius DAS API Docs](https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api)
- [Compressed NFT Guide](https://www.metaplex.com/posts/introducing-bubblegum)

---

## 🆘 Troubleshooting

### "Tree is full" Error

**Problem:** Tried to append beyond tree capacity

**Solution:**
```typescript
// Check tree capacity before appending
const treeInfo = await getAccountInfo(connection, merkleTree);
const currentLeaves = treeInfo.data.activeIndex;
const maxCapacity = Math.pow(2, maxDepth);

if (currentLeaves >= maxCapacity) {
  // Create new tree or rotate to backup tree
  merkleTree = backupTreePubkey;
}
```

### Helius API Returns Empty Results

**Problem:** Data not indexed yet

**Solution:** Wait for indexing (usually <30 seconds)

```typescript
// Poll until data appears
async function waitForIndexing(heliusApiKey, merkleTree, leafIndex, maxRetries = 10) {
  for (let i = 0; i < maxRetries; i++) {
    const data = await fetchCompressedPredictionByIndex(heliusApiKey, merkleTree, leafIndex);
    if (data) return data;

    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3s
  }
  throw new Error('Indexing timeout');
}
```

### ForecasterState Out of Sync

**Problem:** Compressed predictions not updating aggregated stats

**Solution:** Verify instruction still updates ForecasterState

```rust
// In record_compressed_prediction instruction
forecaster_state.record_prediction(clock.unix_timestamp)?;
// ↑ This MUST be called to keep stats in sync
```

---

**Cost Comparison Calculator:**
```typescript
import { calculateCostSavings } from './app/client';

console.log(calculateCostSavings(1_000_000));
// {
//   pdaApproach: { total: "$270,000.00" },
//   compressedApproach: { total: "$100.00" },
//   savings: { dollars: "$269,900.00", percent: "99.96%" }
// }
```

**You just saved $269,900. Time to scale!** 🚀
