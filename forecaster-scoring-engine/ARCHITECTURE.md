# Forecaster Scoring Engine - Architecture

**Status**: Phase 2 & 3 Implementation
**Date**: 2026-04-17
**Engineer**: Genius Mode Engaged

---

## Overview

The Forecaster Scoring Engine is an off-chain TypeScript/Node.js service that:
1. Ingests prediction data from multiple platforms (Polymarket, Metaculus, Kalshi, Manifold)
2. Calculates sophisticated reputation scores (S1-S6 components)
3. Writes aggregated scores to on-chain Solana accounts (ForecasterState V2)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Data Ingestion Layer                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Polymarket│  │Metaculus │  │  Kalshi  │  │ Manifold │   │
│  │ Adapter  │  │ Adapter  │  │ Adapter  │  │ Adapter  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │              │             │          │
│       └─────────────┴──────────────┴─────────────┘          │
│                           │                                 │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Data Normalization & Deduplication             │
├─────────────────────────────────────────────────────────────┤
│  • Normalize market IDs across platforms                   │
│  • Link user identities (wallet → username → profile)      │
│  • Deduplicate cross-posted markets                        │
│  • Calculate market metadata (difficulty, spread, volume)  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Scoring Calculation Engine                │
├─────────────────────────────────────────────────────────────┤
│  Component Calculators:                                     │
│  ├─ S1: Dual-Path Calibrated Brier                         │
│  │   ├─ Trade-Implied (Polymarket, Kalshi)                 │
│  │   └─ Calibration-Binned (Metaculus, Manifold)           │
│  ├─ S2: Resolution Score (Murphy decomposition)            │
│  ├─ S3: Edge Score                                          │
│  │   ├─ Economic Edge (CLOB platforms)                     │
│  │   └─ Informational Edge (forecast platforms)            │
│  ├─ S4: Difficulty-Weighted Score                          │
│  ├─ S5: Volume & Consistency                               │
│  └─ S6: Cross-Platform Consistency (NEW)                   │
│                                                             │
│  Composite Calculators:                                    │
│  ├─ Raw Composite (weighted sum of S1-S6)                  │
│  ├─ Confidence Weight (Bayesian shrinkage)                 │
│  └─ Final Composite (confidence-adjusted)                  │
│                                                             │
│  Anti-Gaming Filters:                                      │
│  ├─ MM/Arb Detection                                        │
│  ├─ Late-Entry Detection                                    │
│  ├─ Easy-Question Farming Detection                        │
│  └─ Tier Assignment (1-5)                                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  On-Chain Score Updater                     │
├─────────────────────────────────────────────────────────────┤
│  • Build Solana transactions                               │
│  • Update ForecasterState V2 accounts                      │
│  • Store proof hashes for verification                     │
│  • Batch updates for efficiency                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Sources

### 1. Polymarket (CLOB - Trade Data)
- **API**: Goldsky subgraph (GraphQL)
- **Data**: Order fills, position history, P&L
- **Update Frequency**: Real-time via webhooks
- **Key Metrics**: Entry price, exit price, volume, duration

### 2. Metaculus (Forecast Platform)
- **API**: REST API (https://www.metaculus.com/api2/)
- **Data**: Question predictions, community predictions, resolutions
- **Update Frequency**: Daily batch sync
- **Key Metrics**: Forecast probability, timestamp, community median

### 3. Kalshi (CLOB - Regulated Exchange)
- **API**: REST API (https://api.elections.kalshi.com/trade-api/v2)
- **Data**: Order history, settlement outcomes
- **Update Frequency**: Daily batch sync
- **Key Metrics**: Entry price, settlement outcome, fees

### 4. Manifold (Play Money Platform)
- **API**: REST API (https://api.manifold.markets/v0)
- **Data**: Bet history, market resolutions
- **Update Frequency**: Daily batch sync
- **Key Metrics**: Bet probability, outcome, market type

---

## Score Calculation Formulas

### S1: Dual-Path Calibrated Brier (28% weight)

#### Path A: Trade-Implied (Polymarket, Kalshi)
For CLOB platforms where users trade at specific prices:

```typescript
// Entry price is the implied probability
const brierScore = (outcome - entryPrice) ** 2;

// Calibration bins based on entry price
const binEdges = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
const bin = findBin(entryPrice, binEdges);
const binAccuracy = resolvedInBin / totalInBin;
const s1TradeImplied = 1000 * (1 - avgBrier) * (binAccuracy);
```

#### Path B: Calibration-Binned (Metaculus, Manifold)
For forecast platforms where users submit continuous probabilities:

```typescript
// Standard Brier score
const brierScore = (outcome - forecastProb) ** 2;

// Murphy-Yates decomposition
const uncertainty = mean(outcomes * (1 - outcomes));  // Inherent in market
const resolution = mean((forecast - mean(outcomes)) ** 2);  // Informativeness
const reliability = mean((forecast - calibrationCurve(forecast)) ** 2);  // Calibration

const s1CalibrationBinned = 1000 * (resolution - reliability) / uncertainty;
```

#### Composite S1
```typescript
const s1Composite = (
  (s1TradeImplied * tradeCount + s1CalibrationBinned * forecastCount) /
  (tradeCount + forecastCount)
);
```

### S2: Resolution Score (22% weight)

Measures informativeness (how far from base rate):

```typescript
const baseRate = mean(allOutcomes);  // e.g., 0.5 for binary
const resolution = mean(forecasts.map(f => (f - baseRate) ** 2));
const s2 = 1000 * Math.sqrt(resolution);  // Normalize to 0-1000
```

### S3: Edge Score (18% weight)

#### Economic Edge (Polymarket, Kalshi)
Profit over expected value from random trading:

```typescript
const actualPnL = sum(trades.map(t => t.pnl));
const randomPnL = sum(trades.map(t => (0.5 - t.entryPrice) * t.size));
const economicEdge = actualPnL - randomPnL;
const s3Economic = 1000 * (1 + Math.tanh(economicEdge / totalVolume));
```

#### Informational Edge (Metaculus, Manifold)
Log-odds advantage over community median:

```typescript
const logOddsUser = Math.log(forecast / (1 - forecast));
const logOddsCommunity = Math.log(communityMedian / (1 - communityMedian));
const logOddsOutcome = outcome ? Infinity : -Infinity;  // Simplified

const informationalEdge = mean(forecasts.map(f =>
  Math.abs(logOddsUser - logOddsOutcome) < Math.abs(logOddsCommunity - logOddsOutcome) ? 1 : 0
));

const s3Informational = 1000 * informationalEdge;
```

#### Composite S3
```typescript
const s3Composite = (
  (s3Economic * tradeVolume + s3Informational * forecastCount) /
  (tradeVolume + forecastCount)
);
```

### S4: Difficulty-Weighted Score (13% weight)

Harder questions get more weight:

```typescript
// Difficulty = community spread (high spread = uncertain = hard)
const difficulty = stdDev(communityForecasts);

const weightedBrier = sum(predictions.map(p =>
  (1 - p.brierScore) * p.difficulty
)) / sum(predictions.map(p => p.difficulty));

const s4 = 1000 * weightedBrier;
```

### S5: Volume & Consistency (8% weight)

Reward sustained activity:

```typescript
const volumeScore = Math.min(1000, totalPredictions / 100);  // Cap at 100 predictions

// Consistency = active weeks / total weeks
const activeWeeks = new Set(predictions.map(p => getWeek(p.timestamp))).size;
const totalWeeks = weeksBetween(firstPrediction, lastPrediction);
const consistencyScore = 1000 * (activeWeeks / totalWeeks);

const s5 = 0.6 * volumeScore + 0.4 * consistencyScore;
```

### S6: Cross-Platform Consistency (11% weight)

**This is the moat** - measures skill transferability:

```typescript
const platformScores = [
  polymarketComposite,  // e.g., 750
  metaculusComposite,   // e.g., 720
  kalshiComposite,      // e.g., 730
  manifoldComposite     // e.g., 680
].filter(s => s !== null);  // Only platforms with activity

if (platformScores.length < 2) {
  s6 = 0;  // Need 2+ platforms
} else {
  const minScore = Math.min(...platformScores);
  const maxScore = Math.max(...platformScores);
  s6 = 1000 * (minScore / maxScore);  // 1.0 = perfectly consistent
}
```

### Final Composite Score

```typescript
// Component weights (sum to 100%)
const weights = {
  s1: 0.28,  // Calibrated Brier
  s2: 0.22,  // Resolution
  s3: 0.18,  // Edge
  s4: 0.13,  // Difficulty
  s5: 0.08,  // Volume & Consistency
  s6: 0.11,  // Cross-Platform
};

// Raw composite (0-1000)
const rawComposite =
  weights.s1 * s1 +
  weights.s2 * s2 +
  weights.s3 * s3 +
  weights.s4 * s4 +
  weights.s5 * s5 +
  weights.s6 * s6;

// Bayesian shrinkage toward prior mean of 500
const totalResolved = predictions.filter(p => p.resolved).length;
const confidenceWeight = totalResolved / (totalResolved + 100);

// Final score (0-1000)
const finalComposite = Math.round(
  confidenceWeight * rawComposite + (1 - confidenceWeight) * 500
);
```

---

## Anti-Gaming Detection

### 1. Market Maker / Arbitrageur Detection
```typescript
const extremeTrades = trades.filter(t =>
  t.entryPrice < 0.2 || t.entryPrice > 0.8
).length;

const mmArbRatio = extremeTrades / trades.length;

if (mmArbRatio > 0.7 && trades.length > 20) {
  flags.push('LIKELY_MM_WALLET');
}
```

### 2. Late-Entry Gaming Detection
```typescript
const latePredictions = predictions.filter(p => {
  const marketDuration = p.closeTime - p.openTime;
  const timeUntilClose = p.closeTime - p.timestamp;
  return timeUntilClose < 0.1 * marketDuration;  // Last 10%
}).length;

const lateEntryRatio = latePredictions / predictions.length;

if (lateEntryRatio > 0.5) {
  flags.push('LATE_ENTRY_GAMER');
}
```

### 3. Easy-Question Farming Detection
```typescript
const avgDifficulty = mean(predictions.map(p => p.difficulty));

if (avgDifficulty < 0.2 && predictions.length > 100) {
  flags.push('EASY_QUESTION_FARMER');
}
```

---

## Tier Assignment

Based on final composite score:

| Tier | Score Range | Description | Vault Privileges |
|------|-------------|-------------|------------------|
| 1 | 700+ | Elite | Can create vaults |
| 2 | 600-699 | Expert | Can co-manage vaults |
| 3 | 500-599 | Verified | Can participate |
| 4 | 300-499 | Average | Limited participation |
| 5 | <300 | Unproven | No privileges |

---

## Identity Linking

### Challenge: Same user, multiple platforms

**Approach**: Multi-signal linking with confidence scoring

```typescript
interface IdentityLink {
  polymarketWallet?: string;
  metaculusUsername?: string;
  kalshiUserId?: string;
  manifoldUsername?: string;
  linkageConfidence: number;  // 0.0 - 1.0
  linkageMethod: 'self_declared' | 'behavioral' | 'cryptographic';
}
```

**Linking Signals**:
1. **Self-Declaration**: User claims accounts via signed message (100% confidence)
2. **Behavioral**: Same prediction patterns, timing, markets (60-80% confidence)
3. **Cryptographic**: Proof of ownership via wallet signatures (100% confidence)

**Storage**: PostgreSQL with identity graph

---

## Database Schema

### predictions table
```sql
CREATE TABLE predictions (
  id UUID PRIMARY KEY,
  forecaster_id UUID NOT NULL,
  platform VARCHAR(20) NOT NULL,  -- 'polymarket' | 'metaculus' | 'kalshi' | 'manifold'
  market_id VARCHAR(100) NOT NULL,
  market_title TEXT,
  predicted_probability FLOAT NOT NULL,
  entry_price FLOAT,  -- For CLOB platforms
  outcome BOOLEAN,  -- NULL if unresolved
  resolved_at TIMESTAMP,
  predicted_at TIMESTAMP NOT NULL,
  market_close_time TIMESTAMP,
  community_median FLOAT,  -- For consensus comparison
  difficulty FLOAT,  -- Community spread
  category VARCHAR(50),
  brier_score FLOAT,  -- Calculated on resolution

  -- Anti-gaming signals
  is_late_entry BOOLEAN,
  is_extreme_price BOOLEAN,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_predictions_forecaster ON predictions(forecaster_id);
CREATE INDEX idx_predictions_platform ON predictions(platform);
CREATE INDEX idx_predictions_resolved ON predictions(resolved_at);
```

### forecasters table
```sql
CREATE TABLE forecasters (
  id UUID PRIMARY KEY,

  -- Identity links
  polymarket_wallet VARCHAR(44),
  metaculus_username VARCHAR(100),
  kalshi_user_id VARCHAR(100),
  manifold_username VARCHAR(100),

  -- On-chain reference
  solana_forecaster_pda VARCHAR(44),  -- ForecasterState account

  -- Calculated scores (cached)
  s1_trade_implied FLOAT,
  s1_calibration_binned FLOAT,
  s1_composite FLOAT,
  s2_resolution FLOAT,
  s3_economic_edge FLOAT,
  s3_informational_edge FLOAT,
  s3_composite FLOAT,
  s4_difficulty_weighted FLOAT,
  s5_volume_consistency FLOAT,
  s6_cross_platform FLOAT,

  raw_composite_score SMALLINT,
  final_composite_score SMALLINT,
  confidence_weight FLOAT,
  tier SMALLINT,

  -- Anti-gaming flags
  mm_arb_ratio FLOAT,
  late_entry_ratio FLOAT,
  question_difficulty_avg FLOAT,

  -- Statistics
  total_predictions INT,
  total_resolved INT,
  polymarket_resolved_trades INT,
  metaculus_resolved_questions INT,
  kalshi_resolved_trades INT,
  manifold_resolved_questions INT,

  last_score_update TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_forecasters_polymarket ON forecasters(polymarket_wallet);
CREATE UNIQUE INDEX idx_forecasters_metaculus ON forecasters(metaculus_username);
CREATE UNIQUE INDEX idx_forecasters_solana ON forecasters(solana_forecaster_pda);
```

---

## Service Components

### 1. Data Ingestors (`src/ingestors/`)
- `polymarket.ts` - Goldsky subgraph queries
- `metaculus.ts` - REST API polling
- `kalshi.ts` - REST API polling
- `manifold.ts` - REST API polling
- `base.ts` - Abstract base class

### 2. Score Calculators (`src/calculators/`)
- `s1-calibrated-brier.ts`
- `s2-resolution.ts`
- `s3-edge.ts`
- `s4-difficulty-weighted.ts`
- `s5-volume-consistency.ts`
- `s6-cross-platform.ts`
- `composite.ts`
- `anti-gaming.ts`

### 3. Identity Linker (`src/identity/`)
- `linker.ts` - Core linking logic
- `confidence-scorer.ts` - Linkage confidence
- `self-declaration-handler.ts` - User claims

### 4. On-Chain Updater (`src/onchain/`)
- `solana-client.ts` - Connection management
- `account-updater.ts` - ForecasterState updates
- `transaction-builder.ts` - Build update txs
- `batch-processor.ts` - Batch updates

### 5. Orchestrator (`src/orchestrator/`)
- `scheduler.ts` - Cron jobs
- `pipeline.ts` - Full score calculation pipeline
- `worker.ts` - Background job processor

### 6. API Server (`src/api/`)
- `server.ts` - Express server
- `routes/scores.ts` - Get forecaster scores
- `routes/rankings.ts` - Leaderboards
- `routes/identity.ts` - Link accounts

---

## Deployment Architecture

### Services
1. **Ingestion Worker**: Pulls data from platforms (every 1 hour)
2. **Score Calculator**: Recalculates scores (every 24 hours)
3. **On-Chain Updater**: Writes to Solana (every 7 days)
4. **API Server**: Serves scores to frontend (always on)

### Infrastructure
- **Database**: PostgreSQL (Neon or Supabase)
- **Queue**: BullMQ (Redis-backed)
- **Hosting**: Railway or Fly.io
- **Monitoring**: Sentry + custom dashboards

---

## Success Metrics

### Data Quality
- **Coverage**: >95% of top 100 forecasters on each platform
- **Freshness**: <24h lag for all platforms
- **Accuracy**: <1% error rate in score calculations

### Performance
- **Ingestion**: Process 1000 predictions/minute
- **Calculation**: Full recalc for 10k forecasters in <5 minutes
- **On-Chain Updates**: <$0.50 per forecaster per week (Solana fees)

### Correctness
- **Anti-Gaming**: Flag >90% of known MM/arb wallets
- **Cross-Platform**: >70% of top 20 Metaculus users also score well on Polymarket

---

## Security Considerations

### API Key Management
- All platform API keys in environment variables
- Rotate keys monthly
- Rate limit enforcement

### Solana Wallet Security
- Hot wallet for score updates (small balance)
- Cold wallet for upgrade authority
- Multi-sig for critical operations

### Data Privacy
- Hash user identifiers in logs
- No storage of private prediction reasoning
- GDPR-compliant identity unlinking

---

## Next Steps

1. ✅ Design complete
2. ⏳ Implement core calculators (S1-S6)
3. ⏳ Build platform ingestors
4. ⏳ Create identity linking service
5. ⏳ Build on-chain updater
6. ⏳ Deploy to production
7. ⏳ Empirical validation with top 100 forecasters

---

**Ready to build the most sophisticated forecaster reputation system in crypto.**
