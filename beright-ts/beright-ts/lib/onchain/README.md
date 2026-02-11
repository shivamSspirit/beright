# BeRight On-Chain Module

Verifiable prediction tracking via Solana Memo Program.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SKILL LAYER                              │
│  (research.ts, markets.ts, telegramHandler.ts)             │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                 INTEGRATION LAYER                           │
│  commitPredictionWithPersistence()                          │
│  resolvePredictionWithPersistence()                         │
│  • Handles Supabase persistence                             │
│  • Links on-chain TX with database records                  │
│  • Provides high-level API for skills                       │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                   RETRY LAYER                               │
│  commitPredictionWithRetry()                                │
│  resolvePredictionWithRetry()                               │
│  • Exponential backoff                                      │
│  • Smart retry (only on transient errors)                   │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                   COMMIT LAYER                              │
│  commitPrediction()                                         │
│  resolvePrediction()                                        │
│  • Creates Solana transactions                              │
│  • Sends to Memo Program                                    │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                   MEMO LAYER                                │
│  formatPredictionMemo()                                     │
│  parseMemo()                                                │
│  calculateBrierScore()                                      │
│  • Formats memo strings                                     │
│  • Validates data                                           │
│  • Calculates scores                                        │
└─────────────────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                SOLANA BLOCKCHAIN                            │
│  Memo Program: MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr │
└─────────────────────────────────────────────────────────────┘
```

## Usage Examples

### Basic Commitment (Low-Level)

```typescript
import { commitPrediction, Direction } from '../lib/onchain';

const result = await commitPrediction(
  'USER_PUBKEY_HERE',
  'MARKET_ID',
  0.72,
  'YES'
);

if (result.success) {
  console.log('TX:', result.signature);
  console.log('Explorer:', result.explorerUrl);
}
```

### With Persistence (Recommended)

```typescript
import { commitPredictionWithPersistence } from '../lib/onchain';

const result = await commitPredictionWithPersistence({
  userId: 'UUID',
  userPubkey: 'SOLANA_PUBKEY',
  question: 'Will Bitcoin reach $100k by EOY?',
  marketId: 'KXBTC-26DEC31-T100K',
  platform: 'kalshi',
  probability: 0.72,
  direction: 'YES',
  confidence: 'high',
  reasoning: 'Strong momentum + ETF approval',
  marketUrl: 'https://kalshi.com/markets/KXBTC-26DEC31-T100K',
});

if (result.success) {
  console.log('Prediction ID:', result.predictionId);
  console.log('TX:', result.txSignature);
}
```

### Resolution

```typescript
import { resolvePredictionWithPersistence } from '../lib/onchain';

const result = await resolvePredictionWithPersistence({
  predictionId: 'UUID',
  outcome: true, // YES won
});

if (result.success) {
  console.log('Brier Score:', result.brierScore);
  console.log('Resolution TX:', result.txSignature);
}
```

### Verification

```typescript
import { verifyDatabasePrediction } from '../lib/onchain';

const result = await verifyDatabasePrediction('PREDICTION_UUID');

if (result.valid) {
  console.log('✅ Prediction verified on-chain');
} else {
  console.error('❌ Verification failed:', result.errors);
}
```

### Get User Stats

```typescript
import { getUserOnChainStats } from '../lib/onchain';

const stats = await getUserOnChainStats('USER_UUID');

console.log('Total predictions:', stats.totalPredictions);
console.log('On-chain verified:', stats.onChainPredictions);
console.log('Verification rate:', (stats.verificationRate * 100).toFixed(1) + '%');
console.log('Avg Brier score:', stats.avgBrierScore.toFixed(4));
console.log('Accuracy:', (stats.accuracy * 100).toFixed(1) + '%');
```

## Memo Format

### Prediction Memo

```
BERIGHT:PREDICT:v1|USER_PUBKEY|MARKET_ID|PROBABILITY|DIRECTION|TIMESTAMP|HASH
```

Example:
```
BERIGHT:PREDICT:v1|7vHKGxJPbPqLEXXhN1W3k8pJNmB6vkxNq6wNGbJYxYz|KXBTC-26DEC31-T100K|0.7200|YES|1707494400|a3f2b1c4d5e6f7a8
```

### Resolution Memo

```
BERIGHT:RESOLVE:v1|COMMIT_TX|OUTCOME|BRIER_SCORE
```

Example:
```
BERIGHT:RESOLVE:v1|3abc123def456...|YES|0.0784
```

## Brier Score

Brier Score = (forecast - outcome)²

- **0.00 - 0.10**: Excellent (Superforecaster level)
- **0.10 - 0.20**: Good (Well-calibrated)
- **0.20 - 0.30**: Fair (Average forecaster)
- **0.30 - 0.40**: Poor (Needs improvement)
- **0.40+**: Bad (Worse than random)

## Testing

```bash
# Run unit tests
npx ts-node lib/onchain/test.ts

# Test real on-chain commit (costs ~0.000005 SOL)
npx ts-node lib/onchain/test.ts --commit

# Verify a prediction
npx ts-node lib/onchain/verify.ts COMMIT_TX_SIGNATURE

# Verify full lifecycle
npx ts-node lib/onchain/verify.ts COMMIT_TX RESOLUTION_TX MARKET_RESOLUTION_TIMESTAMP
```

## Environment Variables

```bash
# Required for committing
SOLANA_PRIVATE_KEY=<base58 or JSON array>
SOLANA_RPC_URL=<helius or other RPC>

# Required for persistence
SUPABASE_URL=<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<secret-key>

# Optional
PREDICTION_SALT=<custom-salt-for-hashing>
```

## Cost Analysis

- **Per prediction commit**: ~5,000 lamports (~$0.0007 at $150/SOL)
- **Per resolution**: ~5,000 lamports (~$0.0007 at $150/SOL)
- **Total per prediction lifecycle**: ~10,000 lamports (~$0.0015)
- **With 1 SOL**: ~100,000 predictions possible

## Integration with Skills

### research.ts

```typescript
import { commitPredictionWithPersistence } from '../lib/onchain';

// After generating a prediction
const onChainResult = await commitPredictionWithPersistence({
  userId: user.id,
  userPubkey: user.wallet_address,
  question: marketData.question,
  marketId: marketData.id,
  platform: 'polymarket',
  probability: analysis.consensus,
  direction: analysis.direction,
  confidence: analysis.confidence,
  reasoning: analysis.reasoning,
  marketUrl: marketData.url,
});
```

### heartbeat.ts

```typescript
import { resolvePredictionWithPersistence } from '../lib/onchain';

// When checking for resolved markets
for (const prediction of unresolvedPredictions) {
  const marketData = await fetchMarketOutcome(prediction.market_id);
  
  if (marketData.resolved) {
    await resolvePredictionWithPersistence({
      predictionId: prediction.id,
      outcome: marketData.outcome === 'YES',
      resolvedAt: new Date(marketData.resolvedAt),
    });
  }
}
```

## Security Considerations

1. **Private Key Management**: Use secure key storage (env vars, secrets manager)
2. **Hash Verification**: All predictions include SHA256 hash with salt
3. **Timestamp Validation**: Predictions must be made before market resolution
4. **On-Chain Immutability**: Once committed, predictions cannot be altered
5. **Public Verification**: Anyone can verify predictions via Solscan/blockchain explorers

## Roadmap

- [x] Basic memo formatting and parsing
- [x] On-chain commit and resolution
- [x] Brier score calculation
- [x] Verification and proof generation
- [x] Supabase integration
- [x] Retry logic with exponential backoff
- [x] Batch verification
- [ ] Webhook for automatic resolution (via Helius)
- [ ] Leaderboard with on-chain verification badges
- [ ] Public verification page (beright.app/verify/:tx)
- [ ] Compressed NFTs for top forecasters
- [ ] Integration with prediction market resolution events
