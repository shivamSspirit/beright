# Forecaster Scoring Engine

> **The most sophisticated forecaster reputation system in crypto**

Off-chain TypeScript service that calculates cross-platform forecaster scores, exports leaderboard data, and produces V3 score snapshots for downstream calibration handoff.

---

## 🎯 What This Does

1. **Ingests** prediction data from the currently implemented adapters (Polymarket and Metaculus)
2. **Scores** imported/native history using Scoring V3 proper-scoring-rule metrics (Brier + log), calibration quality, difficulty-weighted quality, consensus edge, and consistency
3. **Penalizes** gaming patterns (late-entry, easy-market farming, extreme-price farming, category concentration)
4. **Exports** leaderboard JSON and calibration-ready V3 score snapshots

## V3 Direction

This repository now has a forward path for `Scoring V3` in [`SCORING_V3.md`](./SCORING_V3.md).

V3 introduces three outputs instead of one:

- `IScore`: imported historical score
- `NScore`: BeRight-native score
- `VScore`: unified vault score

`src/v3/*` is the canonical scoring engine for the first layer of the BeRight network.

---

## 🏗️ Architecture

Current implementation:

```
Data Sources
    ↓
┌─────────────────────────────────────────┐
│  Platform Ingestors                     │
│  • Polymarket (API)                    │
│  • Metaculus (REST API)                │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  V3 Scoring Engine                      │
│  • Imported score (IScore)              │
│  • Native score (NScore)                │
│  • Unified vault score (VScore)         │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  JSON Outputs                           │
│  • leaderboard.json                     │
│  • leaderboard-stats.json               │
│  • score-snapshots.json                 │
│  • calibration-summaries.json           │
└─────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+

### Installation

```bash
npm install

# Verify the package
npm run typecheck

# Generate leaderboard outputs
npm run calculate:leaderboard

# Generate V3 snapshots from a sample input
npm run calculate:v3 -- --input data/v3-example-input.json
```

### CLI Tools

```bash
# Calculate leaderboard outputs from the legacy engine
npm run calculate:leaderboard

# Calculate V3 snapshots and calibration handoff summaries
npm run calculate:v3 -- --input data/v3-example-input.json

# Fetch a small real-data leaderboard export
npm run fetch:real
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
│   ├── index.ts          # Package exports
│   ├── ingestors/       # Platform data fetchers
│   │   ├── base.ts
│   │   ├── polymarket.ts
│   │   ├── metaculus.ts
│   ├── v3/              # Scoring V3 calculator and snapshot handoff
│   └── cli/             # CLI tools
├── data/                # Example inputs and generated outputs
├── ARCHITECTURE.md      # Detailed architecture documentation
├── package.json
├── tsconfig.json
└── README.md           # This file
```

---

## 🧪 Testing

```bash
# TypeScript verification
npm run typecheck

# Smoke test the V3 path
npm run calculate:v3 -- --input data/v3-example-input.json
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
- Rotate keys monthly

### Solana Wallet
- Hot wallet for score updates (minimal balance)
- Cold wallet for program upgrades (multi-sig recommended)

### Rate Limiting
- Enforced at ingestor level
- Respects platform rate limits
- Exponential backoff on errors

---

## 🎓 Scoring Details

Scoring V3 formulas and implementation live in:

- `SCORING_V3.md`
- `src/v3/*`

---

## 🛠️ Development Roadmap

### Week 1 (Current)
- ✅ Architecture design
- ✅ V3 scoring + anti-gaming penalties
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
- **Program ID (Devnet)**: `GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ`

### Research
- Murphy & Yates (1984): "Brier Score Decomposition"
- Satopää et al. (2014): "Combining Multiple Probability Predictions Using a Simple Logit Model"
- Metaculus Community: Empirical validation of calibration curves

---

## 🏆 What Makes This Unique

1. **Cross-Platform Aggregation**: First system to unify Polymarket + Metaculus + Kalshi + Manifold
2. **Proper Scoring Rules**: Decayed Brier + log score quality, plus calibration quality
3. **Anti-Gaming**: Late-entry, easy-market farming, extreme-price farming, and concentration penalties
4. **Confidence Modeling**: Effective sample size (ESS) confidence adjustment
5. **On-Chain Verification**: Cryptographic snapshot hashes for score calculations

**Competitive Moat**: cross-platform linkage + long-horizon imported-to-native convergence.

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

**Status**: Scoring V3 is canonical
