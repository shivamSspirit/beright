# BeRight Forecaster Network: DeFi-Native Design Spec

> **Thesis**: Prediction markets are the next DeFi primitive. BeRight creates the reputation + capital layer that makes forecasting talent tradeable, stakeable, and yield-bearing.

---

## The Opportunity

### Current State (March 2025)
- Prediction market volume: **$5.89B/week** (Kalshi $2.86B, Polymarket $2.50B)
- Paradigm + Sequoia backing Kalshi at $11B valuation
- **95% of DeFi composability hasn't been built yet**

### BeRight's Edge
We have what others don't:
1. **On-chain Brier scores** (portable reputation)
2. **Calibration program** (verifiable track record)
3. **Vault infrastructure** (timelock, guardian, rate-limiting)
4. **Tournament mechanics** (Meteora DAMM v2)

The missing piece: **turning reputation into yield**.

---

## Core Narrative: "Forecaster Alpha Vaults"

> **"Stake on skill, not luck. Yield on accuracy, not speculation."**

### Why This Wins

| Competitor Narrative | BeRight Narrative |
|---------------------|-------------------|
| "Bet on outcomes" | "Invest in forecasters" |
| "Gamble on elections" | "Stake on calibrated skill" |
| "Speculate on prices" | "Earn yield on accuracy" |

This is **Bloomberg Terminal meets Yearn** — skilled forecasters become fund managers, delegators earn yield on their edge.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    FORECASTER NETWORK                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌───────────────┐    ┌───────────────┐    ┌───────────────┐  │
│   │  REPUTATION   │    │    STAKING    │    │    YIELD      │  │
│   │    LAYER      │───▶│    LAYER      │───▶│    LAYER      │  │
│   └───────────────┘    └───────────────┘    └───────────────┘  │
│          │                    │                    │            │
│   Brier Scores         Delegator Pools       Sanctum INF       │
│   Calibration          Forecaster Tokens     Prediction P&L    │
│   Merkle Proofs        LP Positions          Fee Distribution  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                    COMPOSABILITY LAYER                          │
│                                                                 │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐          │
│   │  Meteora    │   │  Kamino     │   │  Marinade   │          │
│   │  DAMM/DLMM  │   │  Multiply   │   │  mSOL       │          │
│   └─────────────┘   └─────────────┘   └─────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Reputation (What We Have)

### Existing Infrastructure ✅

**Calibration Program** (Solana):
- ForecasterState PDA: aggregated Brier scores
- PredictionRecord PDA: individual predictions
- 10-bucket calibration curve analysis
- Events for indexing

**Metrics On-Chain**:
- `avg_brier_score` (0.0 = perfect, 1.0 = worst)
- `accuracy` (simple % correct)
- `resolved_predictions` (sample size)
- `calibration_buckets` (predicted vs actual)

### What's Needed 🔨

**1. Reputation Tokens (Non-Transferable)**
```
SKILL = f(Brier, Accuracy, SampleSize, Consistency)

// Composite score already exists in DB:
composite_score = weighted_avg([
  brier_weight * (1 - avg_brier),
  accuracy_weight * accuracy,
  confidence_weight * calibration_quality,
  volume_weight * log(resolved_predictions)
])
```

**2. Tier-Based Capabilities**
| Tier | Brier Threshold | Predictions | Unlocks |
|------|-----------------|-------------|---------|
| Rookie | Any | 10+ | Basic tracking |
| Verified | < 0.25 | 20+ | Create token |
| Elite | < 0.18 | 50+ | Create vault |
| Super | < 0.12 | 100+ | Higher caps |

---

## Layer 2: Staking (Needs Implementation)

### Design: Forecaster Staking Pools

Each verified forecaster can create a **staking pool** where:
- Delegators deposit USDC/SOL
- Capital is deployed by forecaster's strategy
- Returns split: **80% delegators / 20% forecaster**
- Reputation affects allocation limits

### Pool Types

**Type A: Tournament Pools** (existing foundation)
```
- Fixed duration (7/14/30 days)
- Min/max deposit
- Performance fee on profits
- Settled at expiry
```

**Type B: Alpha Vaults** (new)
```
- Open-ended
- Continuous deposits/withdrawals (with timelock)
- Idle capital earns yield via Sanctum INF
- Forecaster takes trades, P&L reflected in NAV
```

**Type C: Index Pools** (aggregated)
```
- Allocate across top N forecasters by Brier
- Auto-rebalance monthly
- Passive exposure to forecasting alpha
```

### Meteora Integration (DAMM v2)

We use Meteora's Dynamic AMM for:
1. **Forecaster Token LP**: TOKEN/USDC pools
2. **Tournament Entry**: LP tokens represent shares
3. **Price Discovery**: Bonding curves for forecaster tokens

```typescript
// Existing in lib/token/forecasterToken.ts:
- Linear curve: price = initial + (slope × supply)
- Exponential: price = initial × (1 + slope)^supply
- Sigmoid: S-curve with cap
```

### What to Build 🔨

**1. StakingPool Program** (new Solana program)
```rust
// Account structure
pub struct StakingPool {
    pub forecaster: Pubkey,
    pub base_token: Pubkey,     // USDC mint
    pub pool_token: Pubkey,     // LP token mint
    pub total_deposits: u64,
    pub total_shares: u64,
    pub nav_per_share: f64,     // Net Asset Value
    pub performance_fee_bps: u16,
    pub management_fee_bps: u16,
    pub high_water_mark: f64,   // For performance fee
    pub last_harvest: i64,
    pub min_lock_period: i64,   // Withdrawal delay
    pub max_capacity: u64,      // Reputation-gated
}

// Instructions
- initialize_pool(forecaster, fees, lock_period)
- deposit(amount) -> shares
- request_withdrawal(shares) -> pending
- process_withdrawal(pending_id) -> tokens
- update_nav(new_nav, proof) // Oracle or on-chain calc
- harvest_fees()
```

**2. Reputation-Weighted Capacity**
```
max_capacity = base_capacity × reputation_multiplier

// Elite forecaster (Brier < 0.18):
max_capacity = $100K × 5.0 = $500K

// Rookie forecaster (Brier = 0.30):
max_capacity = $100K × 0.5 = $50K
```

**3. Withdrawal Queue**
- Prevent bank runs with timelock (from vault program)
- Per-epoch rate limits
- Guardian approval for large withdrawals

---

## Layer 3: Yield (The Hook)

### Yield Sources

**Source 1: Prediction P&L**
- Forecaster makes predictions on Polymarket/Kalshi/Jupiter
- Winning trades increase NAV
- Losing trades decrease NAV
- Net alpha = forecaster's edge

**Source 2: Idle Capital Yield (Sanctum INF)**
```
Tournament deposits → 70% active trading
                    → 30% Sanctum INF (4-5% APY)

// Already spec'd in tournament service:
"Idle capital during tournament routes to Sanctum INF for yield"
```

**Source 3: Trading Fees**
- Forecaster tokens have buy/sell fees (1% default)
- 50% to forecaster, 50% to platform
- Creates ongoing revenue stream

**Source 4: Protocol Revenue Share**
- Platform takes 20% performance fee
- Distributed to governance token holders (future)

### Yield Accounting

```
Total Pool Value = Active Positions + Idle Capital + Accrued Yield

NAV per Share = Total Pool Value / Total Shares

Delegator Return = (Exit NAV - Entry NAV) / Entry NAV

// After fees:
Net Return = Gross Return - Performance Fee - Management Fee
```

---

## Layer 4: Composability (The Moat)

### Why This Matters

From the research:
> "Outcome tokens are composable. They can be collateralized, lent, used as LP positions, bridged, or wrapped."

BeRight can do the same with **reputation tokens** and **pool shares**.

### Composability Plays

**1. Brier Score as Collateral**
```
- Verified forecaster has Brier = 0.15
- This represents proven edge
- Can borrow against future earnings
- Protocol: Kamino / Solend integration
```

**2. Pool Shares as LP**
```
- Forecaster vault shares = ERC-20 equivalent
- Can be traded on Jupiter
- Can be used in Meteora DLMM
- Creates secondary market for forecaster alpha
```

**3. Index Products**
```
- "Top 10 Forecasters by Brier" index
- Rebalances quarterly
- Single token exposure to forecasting alpha
- Similar to: DeFi Pulse Index
```

**4. Structured Products**
```
- Principal-protected vault
- 90% in stables earning yield
- 10% in top forecaster pools
- Capped downside, uncapped upside
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Audit existing vault program
- [ ] Add NAV tracking to tournament pools
- [ ] Integrate Sanctum INF for idle yield
- [ ] Create pool share token (SPL)

### Phase 2: Staking Pools (Weeks 3-4)
- [ ] StakingPool program (Anchor)
- [ ] Deposit/withdrawal with timelock
- [ ] Reputation-weighted capacity limits
- [ ] NAV calculation + oracle

### Phase 3: Yield Mechanics (Weeks 5-6)
- [ ] Performance fee (high-water mark)
- [ ] Management fee (annual, prorated)
- [ ] Fee distribution to forecaster
- [ ] Sanctum INF integration live

### Phase 4: Composability (Weeks 7-8)
- [ ] Pool share tokens tradeable on Jupiter
- [ ] Meteora DLMM for forecaster tokens
- [ ] Index pool (top N by Brier)
- [ ] SDK for third-party integration

---

## Competitive Moats

### vs Polymarket
- Polymarket = prediction market (bet on outcomes)
- BeRight = reputation market (invest in forecasters)
- We're the **yield layer** on top of their volume

### vs Azuro
- Azuro = sports betting infrastructure
- BeRight = forecasting talent infrastructure
- We're for **skill**, not luck

### vs GambleFi (Rollbit, etc.)
- GambleFi = house always wins
- BeRight = skilled forecasters win
- We're **aligned with users**, not against them

---

## Token Economics (Future)

### $BERIGHT Token (Not Yet Launched)

**Utility**:
1. Governance (fee parameters, tier thresholds)
2. Fee discounts (stake $BERIGHT for reduced fees)
3. Revenue share (stake to earn protocol fees)
4. Index weight (token holders vote on index composition)

**Distribution**:
- 40% Community (airdrops, incentives)
- 25% Team (4-year vest)
- 20% Treasury (DAO-controlled)
- 15% Investors (if applicable)

**Emission Schedule**:
- Forecasters earn $BERIGHT for accurate predictions
- Delegators earn $BERIGHT for staking
- Early adopters earn bonus multipliers

---

## Key Metrics to Track

### Forecaster Metrics
- Brier score (primary)
- Sharpe ratio (risk-adjusted returns)
- Max drawdown (worst peak-to-trough)
- Consistency (Brier variance over time)

### Pool Metrics
- TVL (Total Value Locked)
- NAV growth (cumulative returns)
- Yield APY (annualized)
- Utilization (active vs idle capital)

### Network Metrics
- Total forecasters (by tier)
- Total delegators
- Total predictions resolved
- Protocol revenue

---

## Open Questions

1. **Oracle for NAV**: How to trustlessly update pool NAV from off-chain prediction outcomes?
   - Option A: Merkle proof of resolved predictions
   - Option B: Optimistic oracle (UMA-style)
   - Option C: Chainlink Functions

2. **Cross-Platform**: How to track forecaster performance across Polymarket, Kalshi, Jupiter?
   - Current: Manual tracking via Data Fabric
   - Future: Standardized market ID hashing

3. **Sybil Resistance**: How to prevent forecasters from gaming Brier scores?
   - Minimum stake per prediction
   - Time-weighted scoring
   - Anomaly detection

4. **Regulatory**: Are staking pools securities?
   - Likely need legal review
   - May need KYC for large deposits
   - Structure matters

---

## Summary

BeRight Forecaster Network = **reputation layer + staking layer + yield layer**

- **Forecasters**: Build track record → Create pools → Earn fees
- **Delegators**: Stake on skill → Earn yield → Exit anytime
- **Platform**: Takes cut → Grows ecosystem → Distributes to token holders

The narrative: **"Yield on accuracy, not speculation."**

This is the Bloomberg Terminal for forecasting — where skill is tradeable, reputation is portable, and alpha is accessible.
