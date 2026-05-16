<p align="center">
  <img src="../beright-logo.svg" alt="BeRight Logo" width="120" />
</p>

# BeRight Calibration Program

On-chain forecaster accuracy tracking and calibration for the BeRight prediction market platform.

## Current Program Surface

The active demo-safe path records forecasts as PDA-backed prediction records and syncs accepted V3 reputation snapshots. State-compression instructions are present as a prototype in the repository, but they are not exported by the current program build and should not be presented as the active integration path.

## Overview

This Solana program tracks forecaster predictions and calculates calibration metrics on-chain, enabling:

- **Queryable accuracy stats** - Fetch forecaster Brier scores, log scores, and accuracy with a single RPC call
- **On-chain leaderboards** - Sort forecasters by calibration metrics
- **Composability** - Other programs can read accuracy scores for incentives/rewards
- **Tamper-proof tracking** - Immutable prediction records tied to Memo transactions
- **Calibration analysis** - Track prediction calibration across probability buckets
- **V3 reputation sync** - Anchors accepted imported/native/unified score snapshots for product surfaces

## V3 Score Sync

The calibration program now also exposes a dedicated V3 score-sync surface for the scoring engine:

- `ScoreConfig` PDA at `[b"score_config"]`
  Stores the protocol authority, accepted score version, and pause state for score writes.
- `ScoreSnapshotV3` PDA at `[b"score_v3", forecaster_pubkey]`
  Stores the latest accepted imported score, native score, unified reputation score, confidence, status, tier, caps, and snapshot hashes for a forecaster.

This keeps the native calibration history (`ForecasterState`) separate from the off-chain scoring engine output. The scoring layer computes the math; the calibration layer only anchors the accepted summary onchain.

## Architecture

### Accounts

#### 1. ForecasterState (PDA)
**Seeds**: `[b"forecaster", forecaster_pubkey]`

Stores aggregated calibration statistics for a forecaster:

```rust
{
  authority: Pubkey,
  total_predictions: u32,
  resolved_predictions: u32,
  avg_brier_score: f64,        // Primary metric (0.0 = perfect, 1.0 = worst)
  avg_log_score: f64,
  accuracy: f64,                // Simple correct/total
  streak_correct: u16,
  calibration_buckets: [[u16; 2]; 10], // Bucket analysis
  // ... more fields
}
```

**Size**: ~320 bytes
**Rent**: ~0.003 SOL one-time (~$0.40)

#### 2. PredictionRecord (PDA)
**Seeds**: `[b"prediction", forecaster_pubkey, market_id, timestamp]`

Stores individual prediction details:

```rust
{
  forecaster: Pubkey,
  market_id: [u8; 32],
  predicted_probability: f64,
  direction: PredictionDirection,
  committed_at: i64,
  outcome: Option<bool>,
  brier_score: Option<f64>,
  memo_tx_signature: [u8; 64],  // Links to Memo transaction
  // ... more fields
}
```

**Size**: ~200 bytes
**Rent**: ~0.002 SOL one-time (~$0.27)

### Instructions

#### 1. `initialize_forecaster()`
Create a forecaster's calibration tracking account.

**Cost**: ~0.003 SOL rent + 0.000005 SOL tx fee

#### 2. `record_prediction(market_id, probability, direction, ...)`
Record a new prediction and update forecaster stats.

**Cost**: ~0.002 SOL rent + 0.000005 SOL tx fee

#### 3. `resolve_prediction(outcome)`
Resolve a prediction with the actual outcome, calculate scores.

**Cost**: 0.000005 SOL tx fee (updates existing accounts)

## Calibration Metrics

### Brier Score
**Formula**: `(predicted_probability - actual_outcome)^2`
- Range: 0.0 (perfect) to 1.0 (worst)
- Lower is better
- Industry standard for forecast accuracy

### Log Score
**Formula**: `log2(predicted_probability)` if correct, `log2(1 - predicted_probability)` if wrong
- Heavily penalizes overconfidence
- Encourages well-calibrated probabilities

### Calibration Buckets
Tracks predictions across 10 probability ranges (0-10%, 10-20%, ..., 90-100%):
- Measures how well-calibrated predictions are
- Perfect calibration: 60% predictions in 60-70% bucket resolve YES 65% of the time

## Setup

### Prerequisites

- Rust 1.75+
- Solana CLI 1.18+
- Anchor 0.30.1
- Node.js 18+

### Installation

```bash
# Install dependencies
npm install

# Build the program
anchor build

# Run tests
anchor test

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

### Update Program ID

After deployment, update the program ID in:
1. `programs/calibration/src/lib.rs` - `declare_id!("...")`
2. `Anchor.toml` - `[programs.devnet]` section
3. `app/client.ts` - `CALIBRATION_PROGRAM_ID` constant

Then rebuild:
```bash
anchor build
```

## TypeScript Integration

### Basic Usage

```typescript
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  initializeForecaster,
  recordPrediction,
  resolvePrediction,
  getForecasterStats,
  getTopForecasters,
} from './app/client';

// Setup
const connection = new Connection('https://api.devnet.solana.com');
const wallet = Keypair.fromSecretKey(/* ... */);
const provider = new AnchorProvider(connection, wallet, {});
const program = new Program(IDL, PROGRAM_ID, provider);

// Initialize forecaster
await initializeForecaster(program, wallet);

// Record prediction
const tx = await recordPrediction(
  program,
  wallet,
  'market-123',           // Market ID
  0.75,                   // 75% probability
  'Yes',                  // Direction
  'memo_tx_signature',    // Memo tx reference
  0                       // Category
);

// Later: resolve prediction
await resolvePrediction(
  program,
  wallet,
  predictionPda,
  true                    // Actual outcome
);

// Fetch stats
const stats = await getForecasterStats(program, wallet.publicKey);
console.log(stats);
// {
//   avgBrierScore: 0.18,
//   accuracy: 0.82,
//   resolvedPredictions: 120,
//   streakCorrect: 7,
//   ...
// }

// Get leaderboard
const topForecasters = await getTopForecasters(program, 10);
```

## Integration with BeRight

### Hybrid Approach (Memo + Anchor)

BeRight uses a two-tier storage system:

1. **Memo Program** - Immutable prediction commits
2. **Calibration Program** - Queryable stats

**Workflow**:
```typescript
// Step 1: Commit prediction via Memo (tamper-proof)
const memoTx = await commitPredictionMemo(userPubkey, marketId, probability);

// Step 2: Record in Calibration Program (queryable)
await recordPrediction(
  program,
  userKeypair,
  marketId,
  probability,
  direction,
  memoTx,  // Reference to Memo tx
  category
);
```

### Updating BeRight Code

Add to `beright-ts/lib/onchain/commit.ts`:

```typescript
import { recordPrediction } from '../../../calibration-program/app/client';

async function commitPredictionHybrid(
  userPubkey: PublicKey,
  marketId: string,
  probability: number
) {
  // Step 1: Memo transaction (existing code)
  const memo = formatPredictionMemo(userPubkey, marketId, probability);
  const memoTx = await submitMemoTransaction(memo);

  // Step 2: Calibration program (NEW)
  const program = getCalibrationProgram();
  await recordPrediction(
    program,
    userKeypair,
    marketId,
    probability,
    probability > 0.5 ? 'Yes' : 'No',
    memoTx,
    getCategoryId(marketId)
  );

  return { memoTx, calibrationTx };
}
```

## Events

The program emits events for off-chain indexers:

```rust
// Emitted when forecaster is initialized
ForecasterInitialized { forecaster, timestamp }

// Emitted when prediction is recorded
PredictionRecorded {
  forecaster,
  market_id,
  predicted_probability,
  direction,
  timestamp,
  total_predictions
}

// Emitted when prediction is resolved
PredictionResolved {
  forecaster,
  market_id,
  outcome,
  brier_score,
  log_score,
  timestamp,
  avg_brier_score,
  accuracy
}

// Emitted on calibration update
CalibrationUpdated {
  forecaster,
  avg_brier_score,
  accuracy,
  streak_correct
}
```

## Cost Analysis

### Per-Forecaster Costs (100 predictions/year)

| Operation | Frequency | Cost/Operation | Annual Cost |
|-----------|-----------|----------------|-------------|
| Initialize Forecaster | Once | $0.40 | $0.40 |
| Record Prediction | 100/year | $0.27 | $27.00 |
| Resolve Prediction | 100/year | $0.0007 | $0.07 |
| **Total** | | | **$27.47** |

### Cost Optimization

For high-volume scenarios (>1000 predictions/day):
- Implement **State Compression** (~99% cost reduction)
- See `docs/ONCHAIN_ACCURACY_DESIGN.md` for details

## Querying Data

### RPC Queries

```typescript
// Get all forecasters
const forecasters = await program.account.forecasterState.all();

// Filter by resolved predictions > 50
const activeForecasters = await program.account.forecasterState.all([
  {
    memcmp: {
      offset: 8 + 1 + 32 + 4, // Skip discriminator + bump + authority + total_predictions
      bytes: bs58.encode(Buffer.from([50, 0, 0, 0])), // u32 = 50
    },
  },
]);

// Get specific forecaster
const [forecasterPda] = deriveForecasterPda(userPubkey);
const stats = await program.account.forecasterState.fetch(forecasterPda);
```

## Security Considerations

### Access Control
- Only forecaster can resolve their own predictions
- Predictions cannot be resolved twice (`AlreadyResolved` error)

### Data Integrity
- All arithmetic uses checked operations (no overflow)
- Probability constrained to [0.0, 1.0]
- References Memo transaction for tamper-proof commits

### Future Enhancements
- Guardian/oracle for automated resolution
- Dispute resolution mechanism
- Stake-based prediction submissions

## Development

### Project Structure

```
calibration-program/
├── programs/
│   └── calibration/
│       ├── src/
│       │   ├── lib.rs              # Program entry point
│       │   ├── state/
│       │   │   ├── forecaster.rs   # ForecasterState account
│       │   │   └── prediction.rs   # PredictionRecord account
│       │   ├── instructions/
│       │   │   ├── initialize_forecaster.rs
│       │   │   ├── record_prediction.rs
│       │   │   └── resolve_prediction.rs
│       │   ├── errors.rs           # Custom errors
│       │   └── events.rs           # On-chain events
│       └── Cargo.toml
├── app/
│   └── client.ts                   # TypeScript SDK
├── tests/
│   └── calibration.ts              # Anchor tests
├── Anchor.toml
├── Cargo.toml
└── package.json
```

### Testing

```bash
# Unit tests
anchor test --skip-deploy

# Integration tests
anchor test

# Specific test
anchor test -- --grep "initialize forecaster"
```

### Deployment Checklist

- [ ] Update program ID in `lib.rs`, `Anchor.toml`, `client.ts`
- [ ] Rebuild program after ID update
- [ ] Verify on Solana Explorer
- [ ] Test on devnet before mainnet
- [ ] Document deployed program ID
- [ ] Initialize first forecaster account
- [ ] Verify events are emitted correctly

## Resources

- **Anchor Framework**: https://www.anchor-lang.com
- **Solana Cookbook**: https://solanacookbook.com
- **BeRight Docs**: `../beright-ts/docs/ONCHAIN_ACCURACY_DESIGN.md`

## License

MIT

## Support

For issues or questions:
- GitHub Issues: https://github.com/beright/calibration-program/issues
- Discord: [BeRight Community]
