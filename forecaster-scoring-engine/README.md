# Forecaster Scoring Engine

> **The most sophisticated forecaster reputation system in crypto**

Off-chain TypeScript service that calculates cross-platform forecaster scores and writes them to Solana's BeRight Calibration Program (V2).

---

## 🎯 What This Does

1. **Ingests** prediction data from 4 platforms (Polymarket, Metaculus, Kalshi, Manifold)
2. **Calculates** 6 component scores (S1-S6) using state-of-the-art forecasting metrics
3. **Detects** gaming patterns (MM wallets, late-entry snipers, easy-question farmers)
4. **Writes** aggregated reputation scores to on-chain Solana accounts

**The Moat**: S6 Cross-Platform Consistency score - measures skill transferability across different prediction markets. Nobody else has this.

---

## 📊 Scoring Components

| Component | Weight | What It Measures | Platforms |
|-----------|--------|------------------|-----------|
| **S1** Calibrated Brier | 28% | Forecast accuracy with calibration | All |
| **S2** Resolution | 22% | Informativeness (distance from base rate) | All |
| **S3** Edge | 18% | Economic profit (CLOB) / Beat community (forecast) | All |
| **S4** Difficulty-Weighted | 13% | Performance on hard questions | All |
| **S5** Volume & Consistency | 8% | Sustained activity over time | All |
| **S6** Cross-Platform | 11% | **Skill transferability** (min/max ratio) | All |

**Final Score**: 0-1000 scale with Bayesian shrinkage toward prior mean of 500

## V3 Direction

This repository now has a forward path for `Scoring V3` in [`SCORING_V3.md`](./SCORING_V3.md).

V3 introduces three outputs instead of one:

- `IScore`: imported historical score
- `NScore`: BeRight-native score
- `VScore`: unified vault score

The current `src/calculators/*` path remains the legacy engine.
The new `src/v3/*` path is the replacement design for the first layer of the BeRight network.

---

## 🏗️ Architecture

```
Data Sources
    ↓
┌─────────────────────────────────────────┐
│  Platform Ingestors (GraphQL + REST)   │
│  • Polymarket (Goldsky subgraph)       │
│  • Metaculus (REST API)                │
│  • Kalshi (REST API)                   │
│  • Manifold (REST API)                 │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  PostgreSQL Database                    │
│  • predictions table                    │
│  • forecasters table                    │
│  • identity_links table                 │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  Score Calculation Engine               │
│  • S1-S6 Component Calculators          │
│  • Composite Score Calculator           │
│  • Anti-Gaming Detection                │
│  • Confidence Weighting (Bayesian)      │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  Solana On-Chain Updater                │
│  • Build transactions                   │
│  • Update ForecasterState V2 accounts   │
│  • Store proof hashes                   │
└─────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Redis 7+
- Solana wallet with devnet/mainnet SOL

### Installation

```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your API keys and database credentials

# Build TypeScript
npm run build

# Run database migrations (TODO: implement)
npm run db:migrate

# Start the service
npm run dev
```

### CLI Tools

```bash
# Ingest data from platforms
npm run ingest:polymarket
npm run ingest:metaculus
npm run ingest:kalshi
npm run ingest:manifold

# Calculate scores for all forecasters
npm run calculate:scores

# Calculate V3 snapshots and calibration handoff summaries
npm run calculate:v3 -- --input data/v3-example-input.json

# Update on-chain Solana accounts
npm run update:onchain
```

### V3 Snapshot Outputs

`calculate:v3` writes two files:

- `score-snapshots.json`
  Full V3 score envelopes with deterministic snapshot hash
- `calibration-summaries.json`
  Compact summaries intended for the calibration-layer sync job

This is the contract between the scoring layer and the future calibration-layer handoff.

---

## 📁 Project Structure

```
forecaster-scoring-engine/
├── src/
│   ├── types/           # TypeScript type definitions
│   ├── calculators/     # S1-S6 score calculators
│   │   ├── s1-calibrated-brier.ts
│   │   ├── component-scores.ts  (S2-S6)
│   │   ├── composite.ts
│   │   ├── anti-gaming.ts
│   │   └── index.ts
│   ├── ingestors/       # Platform data fetchers
│   │   ├── base.ts
│   │   ├── polymarket.ts
│   │   ├── metaculus.ts
│   │   ├── kalshi.ts
│   │   └── manifold.ts
│   ├── identity/        # Cross-platform identity linking
│   ├── onchain/         # Solana transaction builders
│   ├── orchestrator/    # Cron jobs & pipeline orchestration
│   ├── api/             # Express API server
│   ├── db/              # Database schema & queries
│   ├── utils/           # Shared utilities
│   └── cli/             # CLI tools
├── tests/               # Unit & integration tests
├── ARCHITECTURE.md      # Detailed architecture documentation
├── package.json
├── tsconfig.json
└── README.md           # This file
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Test specific calculator
npm test -- s1-calibrated-brier

# Test with real data from top 10 forecasters (Phase 4)
npm run test:empirical
```

---

## 📊 Database Schema

### `predictions` table

Stores individual predictions from all platforms.

```sql
CREATE TABLE predictions (
  id UUID PRIMARY KEY,
  forecaster_id UUID NOT NULL,
  platform VARCHAR(20) NOT NULL,
  market_id VARCHAR(100) NOT NULL,
  predicted_probability FLOAT NOT NULL,
  entry_price FLOAT,  -- For CLOB platforms
  outcome BOOLEAN,  -- NULL if unresolved
  resolved_at TIMESTAMP,
  predicted_at TIMESTAMP NOT NULL,
  difficulty FLOAT,  -- Community spread
  brier_score FLOAT,

  -- Indexes
  INDEX idx_forecaster (forecaster_id),
  INDEX idx_platform (platform),
  INDEX idx_resolved (resolved_at)
);
```

### `forecasters` table

Stores calculated scores (cached from calculations).

```sql
CREATE TABLE forecasters (
  id UUID PRIMARY KEY,

  -- Identity links
  polymarket_wallet VARCHAR(44),
  metaculus_username VARCHAR(100),
  kalshi_user_id VARCHAR(100),
  manifold_username VARCHAR(100),

  -- On-chain reference
  solana_forecaster_pda VARCHAR(44),

  -- Calculated scores
  s1_composite FLOAT,
  s2_resolution FLOAT,
  s3_composite FLOAT,
  s4_difficulty_weighted FLOAT,
  s5_volume_consistency FLOAT,
  s6_cross_platform FLOAT,

  raw_composite_score SMALLINT,
  final_composite_score SMALLINT,
  tier SMALLINT,

  last_score_update TIMESTAMP
);
```

---

## 🔐 Security

### API Key Management
- All keys in environment variables (never committed)
- Use `.env.example` as template
- Rotate keys monthly

### Solana Wallet
- Hot wallet for score updates (minimal balance)
- Cold wallet for program upgrades (multi-sig recommended)

### Rate Limiting
- Enforced at ingestor level
- Respects platform rate limits
- Exponential backoff on errors

---

## 🎓 Key Formulas

### S1: Dual-Path Calibrated Brier

**Path A (Trade-Implied)**: For CLOB platforms
```typescript
brierScore = (outcome - entryPrice)²
avgBrier = mean(brierScores)
calibrationError = mean(|bin - binAccuracy|)
s1 = 1000 × (1 - avgBrier) × (1 - calibrationError)
```

**Path B (Calibration-Binned)**: For forecast platforms
```typescript
// Murphy-Yates decomposition
uncertainty = mean(outcome × (1 - outcome))
resolution = mean((forecast - baseRate)²)
reliability = mean((forecast - outcome)²)

skill = (resolution - reliability) / uncertainty
s1 = 500 + skill × 500  // Normalize to 0-1000
```

### S6: Cross-Platform Consistency

```typescript
platformScores = [poly, meta, kalshi, manifold].filter(s => s !== null)

if (platformScores.length < 2) {
  s6 = 0  // Need 2+ platforms
} else {
  s6 = 1000 × (min(scores) / max(scores))
}
```

### Bayesian Shrinkage (Confidence Weighting)

```typescript
confidenceWeight = N / (N + 100)  // N = total resolved predictions
finalScore = confidenceWeight × rawScore + (1 - confidenceWeight) × 500
```

---

## 📈 Phase 2 & 3 Status

### ✅ Phase 2: Scoring Engine (COMPLETE)

- [x] S1 dual-path calculator (trade + calibration)
- [x] S2 resolution calculator
- [x] S3 edge calculator (economic + informational)
- [x] S4 difficulty-weighted calculator
- [x] S5 volume & consistency calculator
- [x] S6 cross-platform consistency calculator
- [x] Composite calculator with confidence weighting
- [x] Anti-gaming detection (MM, late-entry, easy-question)
- [x] TypeScript types and interfaces
- [x] Unit test infrastructure

### ⏳ Phase 3: Data Pipeline (IN PROGRESS)

- [x] Base ingestor architecture
- [ ] Polymarket ingestor (Goldsky GraphQL)
- [ ] Metaculus ingestor (REST API)
- [ ] Kalshi ingestor (REST API)
- [ ] Manifold ingestor (REST API)
- [ ] Identity linking service
- [ ] PostgreSQL schema implementation
- [ ] Cron job orchestration
- [ ] On-chain Solana updater

### ⏳ Phase 4: Empirical Validation (PENDING)

- [ ] Run on top 100 Polymarket wallets
- [ ] Run on top 100 Metaculus forecasters
- [ ] Lock in normalization constants (means & stddevs)
- [ ] Validate anti-gaming filters catch known bad actors
- [ ] Generate calibration reports
- [ ] Deploy to production

---

## 🛠️ Development Roadmap

### Week 1 (Current)
- ✅ Architecture design
- ✅ Core calculators (S1-S6)
- ✅ Anti-gaming detection
- ⏳ Platform ingestors

### Week 2
- [ ] Database schema & migrations
- [ ] Identity linking service
- [ ] Orchestration & cron jobs
- [ ] On-chain updater

### Week 3
- [ ] API server for querying scores
- [ ] Admin dashboard
- [ ] Monitoring & alerting
- [ ] Integration tests

### Week 4
- [ ] Empirical validation on real data
- [ ] Lock in normalization constants
- [ ] Production deployment
- [ ] Documentation

---

## 📚 References

### On-Chain Program
- **V2 Schema**: `../calibration-program/programs/calibration/src/state/forecaster_v2.rs`
- **Program ID (Devnet)**: `GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ`
- **Implementation Summary**: `../calibration-program/V2_IMPLEMENTATION_SUMMARY.md`

### Research
- Murphy & Yates (1984): "Brier Score Decomposition"
- Satopää et al. (2014): "Combining Multiple Probability Predictions Using a Simple Logit Model"
- Metaculus Community: Empirical validation of calibration curves

---

## 🏆 What Makes This Unique

1. **Cross-Platform Aggregation**: First system to unify Polymarket + Metaculus + Kalshi + Manifold
2. **Dual-Path S1**: Handles both CLOB (trade-based) and forecast (calibration-based) platforms correctly
3. **S6 Consistency**: Novel metric that measures skill transferability (not just single-platform excellence)
4. **Anti-Gaming**: Platform-specific gaming detection (MM/arb, late-entry, easy-question)
5. **Bayesian Shrinkage**: Confidence weighting prevents small-sample gaming
6. **On-Chain Verification**: Cryptographic proof hashes for score calculations

**Competitive Moat**: The cross-platform dataset (linking Polymarket wallets to Metaculus usernames) is worth $1M+ and cannot be easily replicated.

---

## 📝 License

MIT License - See LICENSE file

---

## 👥 Contributors

- **BeRight Protocol Team**
- Built by genius Solana engineers in genius mode

---

## 🔗 Links

- **Main Repo**: https://github.com/beright-protocol/beright
- **Calibration Program**: `../calibration-program/`
- **Frontend**: `../berightweb/`
- **API Documentation**: (coming soon)

---

**Status**: Phase 2 complete, Phase 3 in progress
**Last Updated**: 2026-04-17
**Version**: 1.0.0
