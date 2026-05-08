# Forecaster Scoring Engine - Architecture

**Status**: Current implementation: Scoring V3
**Date**: 2026-04-17
**Engineer**: Genius Mode Engaged

---

## Overview

The Forecaster Scoring Engine is an off-chain TypeScript/Node.js service that:
1. Ingests prediction data from the implemented adapters (currently Polymarket and Metaculus)
2. Calculates V3 imported/native/vault scores and score snapshots
3. Exports leaderboard data and calibration handoff payloads for downstream consumers

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Data Ingestion Layer                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐                                 │
│  │Polymarket│  │Metaculus │                                 │
│  │ Adapter  │  │ Adapter  │                                 │
│  └────┬─────┘  └────┬─────┘                                 │
│       │             │                                        │
│       └─────────────┴─────────────────────────────────────── │
│                           │                                 │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                Scoring & Snapshot Layer                     │
├─────────────────────────────────────────────────────────────┤
│  • V3 imported/native score calculation                    │
│  • Calibration handoff envelope generation                 │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                        Output Layer                         │
├─────────────────────────────────────────────────────────────┤
│  • leaderboard.json                                        │
│  • leaderboard-stats.json                                  │
│  • score-snapshots.json                                    │
│  • calibration-summaries.json                              │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Future Integration                       │
├─────────────────────────────────────────────────────────────┤
│  • Additional adapters (Kalshi, Manifold, others)          │
│  • Identity linking and orchestration services             │
│  • On-chain score synchronization                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Sources

### 1. Polymarket (CLOB - Trade Data)
- **API**: Polymarket APIs (Gamma/Data/CLOB)
- **Data**: Order fills, position history, P&L
- **Update Frequency**: Real-time via webhooks
- **Key Metrics**: Entry price, size, timestamps

### 2. Metaculus (Forecast Platform)
- **API**: REST API (https://www.metaculus.com/api2/)
- **Data**: Question predictions, community predictions, resolutions
- **Update Frequency**: Daily batch sync
- **Key Metrics**: Forecast probability, timestamp, community median

### 3. Kalshi (Planned Adapter)
- **API**: REST API (https://api.elections.kalshi.com/trade-api/v2)
- **Status**: Not implemented in `src/` today
- **Intended Data**: Order history, settlement outcomes

### 4. Manifold (Planned Adapter)
- **API**: REST API (https://api.manifold.markets/v0)
- **Status**: Not implemented in `src/` today
- **Intended Data**: Bet history, market resolutions

---

## Score Calculation (V3)

Scoring V3 is the canonical system implemented in `src/v3/*` and specified in `SCORING_V3.md`.

At a high level:

- Build two datasets: `imported` and `native`
- Apply exponential time decay to resolved predictions
- Compute proper-scoring-rule quality (Brier + log), calibration quality, difficulty weighting, consensus edge, and consistency
- Compute confidence via effective sample size (ESS)
- Apply anti-gaming penalties as multiplicative score reductions
- Emit `IScore`, `NScore`, and a blended `VScore` (vault score)

See:
- `SCORING_V3.md`
- `src/v3/metrics.ts`
- `src/v3/antiGaming.ts`
- `src/v3/calculator.ts`

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
- `polymarket.ts` - Polymarket API ingestion
- `metaculus.ts` - REST API polling
- `base.ts` - Abstract base class

### 2. V3 Scoring (`src/v3/`)
- `calculator.ts` - Imported/native score calculation
- `metrics.ts` - Shared V3 metric helpers
- `handoff.ts` - Snapshot and calibration summary builders
- `config.ts` - Versioned scoring configuration
- `types.ts` - V3 score model

### 3. CLI Entrypoints (`src/cli/`)
- `calculate-leaderboard.ts` - Leaderboard export
- `fetch-real-leaderboard.ts` - Small real-data leaderboard export
- `calculate-v3-snapshots.ts` - V3 score snapshot generation

The placeholder `src/api`, `src/db`, `src/identity`, `src/onchain`, `src/orchestrator`, and `src/utils` directories were removed because they contained no implementation.

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
2. ✅ Implement V3 scoring + penalties
3. ⏳ Expand platform ingestors (Kalshi/Manifold/etc.)
4. ⏳ Build identity linking service
5. ⏳ Build on-chain score updater
6. ⏳ Deploy to production
7. ⏳ Empirical validation with top 100 forecasters

---

**Ready to build the most sophisticated forecaster reputation system in crypto.**
