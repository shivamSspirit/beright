# BeRight Forecaster Network: DeFi-Native Design Spec

> **Thesis**: Prediction markets are the next DeFi primitive. BeRight creates the reputation + capital layer that makes forecasting talent tradeable, stakeable, and yield-bearing.

---

## The Opportunity

### Current State (March 2026)

**Prediction Market Volume:**
- Weekly volume: **$5.89B** (week of March 2-8, 2026)
- February 2026: **$17.9B combined** (Kalshi $9.9B, Polymarket $7.9B)
- Up from under $2B/month in August 2025 → **9x growth in 6 months**

**Market Share Battle:**
- Kalshi: 53% of volume, leads in sports ($1.99B) and revenue ($1.5B annualized)
- Polymarket: 47% of volume, leads in transactions (80.7M vs 70.8M in Feb)
- Both exploring **$20B valuations** (up from $11B for Kalshi in 2025)

**Category Breakdown:**
- Sports: $3.01B/week (largest)
- Crypto: $982M/week (5-15 min up/down contracts dominate)
- Politics: $574M/week (Polymarket dominates)

**Key Developments:**
- Polymarket acquired QCEX for $112M → CFTC-licensed US re-entry
- Jupiter integrated Polymarket (Feb 2026) → Solana-native prediction markets
- Jupiter raised $35M from ParaFi, has $2.35B TVL
- Chainlink oracles power 5-15 min crypto markets on Jupiter

Sources: [DeFi Rate](https://defirate.com/prediction-markets/), [CoinDesk](https://www.coindesk.com/markets/2026/02/02/jupiter-brings-polymarket-to-solana-and-lands-usd35-million-investment-deal/), [DailyCoin](https://dailycoin.com/prediction-markets-soar-kalshi-and-polymarket-could-be-worth-20b-soon/)

### Solana DeFi Context (March 2026)

**Ecosystem Scale:**
- Solana DeFi TVL: **$11.5B** (Dec 2025)
- Lending markets: $3.6B
- Meteora: $1B+ TVL, $300M daily volume
- Jupiter: $2.35B TVL, $650M annualized fees

**Yield Infrastructure:**
- Sanctum INF: **6.42% APY** (Jan 2026), peaks above 20% during high volume
- JitoSOL: 5.89% APY, $2B+ TVL (largest LST)
- Meteora Dynamic Vaults: Auto-lend to Kamino/Marginfi/Solend

Sources: [Sanctum](https://sanctum.so/blog/best-solana-yield-2026-staking-vs-defi), [Meteora Review](https://dexrank.com/reviews/meteora-dex), [Eco Guide](https://eco.com/support/en/articles/13225733-top-10-defi-apps-on-solana-in-2026-complete-guide)

### BeRight's Edge

We have what others don't:
1. **On-chain Brier scores** (portable reputation) - no competitor has this
2. **Calibration program** (verifiable track record on Solana)
3. **Vault infrastructure** (timelock, guardian, rate-limiting)
4. **Tournament mechanics** (Meteora DAMM v2 integration)

The missing piece: **turning reputation into yield**.

---

## Core Narrative: "Forecaster Alpha Vaults"

> **"Stake on skill, not luck. Yield on accuracy, not speculation."**

### Why This Wins

| Current Market | BeRight Differentiator |
|----------------|------------------------|
| Polymarket/Kalshi: "Bet on outcomes" | "Invest in forecasters" |
| 5-min crypto bets: "Gamble on price" | "Stake on calibrated skill" |
| GambleFi: "House always wins" | "Skilled forecasters win" |

This is **Bloomberg Terminal meets Yearn** — skilled forecasters become fund managers, delegators earn yield on their edge.

### Market Gap

From research:
> "Vitalik Buterin warns prediction markets are drifting into pure gambling with 5-minute crypto bets."

BeRight is the **anti-gambling** play:
- Not 5-min bets → Long-term forecasting skill
- Not speculation → Calibrated probability estimates
- Not luck → Verifiable Brier score track records

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
│   │  Meteora    │   │  Kamino     │   │  Sanctum    │          │
│   │  DAMM/DLMM  │   │  Multiply   │   │  INF Pool   │          │
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

**1. Reputation Score Formula**
```
SKILL = f(Brier, Accuracy, SampleSize, Consistency)

composite_score = weighted_avg([
  brier_weight * (1 - avg_brier),      // Lower Brier = better
  accuracy_weight * accuracy,           // Higher accuracy = better
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
| Super | < 0.12 | 100+ | Higher caps, index inclusion |

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
- Idle capital earns yield via Sanctum INF (~6-9% APY)
- Forecaster takes trades, P&L reflected in NAV
```

**Type C: Index Pools** (aggregated)
```
- Allocate across top N forecasters by Brier
- Auto-rebalance monthly
- Passive exposure to forecasting alpha
```

### Meteora Integration

Meteora is Solana's leading liquidity infrastructure ($1B+ TVL, $300M daily volume):

**DLMM Pools**: Dynamic fee adjustment based on volatility
**Dynamic Vaults**: Auto-lend idle capital to Kamino/Marginfi/Solend
**MET Token**: Governance + staking rewards (launched Oct 2025)

```typescript
// Existing in lib/token/forecasterToken.ts:
- Linear curve: price = initial + (slope × supply)
- Exponential: price = initial × (1 + slope)^supply
- Sigmoid: S-curve with cap
```

### What to Build 🔨

**1. StakingPool Program** (new Solana program)
```rust
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
    pub min_lock_period: i64,   // Withdrawal delay
    pub max_capacity: u64,      // Reputation-gated
}
```

**2. Reputation-Weighted Capacity**
```
max_capacity = base_capacity × reputation_multiplier

// Elite forecaster (Brier < 0.18):
max_capacity = $100K × 5.0 = $500K

// Rookie forecaster (Brier = 0.30):
max_capacity = $100K × 0.5 = $50K
```

---

## Layer 3: Yield (The Hook)

### Yield Sources

**Source 1: Prediction P&L**
- Forecaster trades on Jupiter Prediction Markets (Polymarket/Kalshi via Solana)
- Zero bridging needed (Jupiter integration live Feb 2026)
- Winning trades increase NAV
- Net alpha = forecaster's edge

**Source 2: Idle Capital Yield**
```
Tournament deposits → 70% active trading
                    → 30% Sanctum INF

Sanctum INF APY: 6.42% base, peaks >20%
- Holds basket of LSTs (JitoSOL, mSOL, etc.)
- Earns staking yield + swap fees
```

**Source 3: Trading Fees**
- Forecaster tokens have buy/sell fees (1% default)
- 50% to forecaster, 50% to platform
- Creates ongoing revenue stream

**Source 4: Protocol Revenue Share**
- Platform takes 20% performance fee
- Future: distributed to $BERIGHT holders

### Yield Accounting

```
Total Pool Value = Active Positions + Idle Capital + Accrued Yield

NAV per Share = Total Pool Value / Total Shares

Delegator Return = (Exit NAV - Entry NAV) / Entry NAV

// Example:
Deposit: $10,000 at NAV = $1.00 (10,000 shares)
Exit: NAV = $1.15 after 30 days
Gross Return: 15%
Performance Fee: 15% × 20% = 3%
Net Return: 12%
```

---

## Layer 4: Composability (The Moat)

### Why Jupiter Integration Changes Everything

Jupiter's Polymarket integration (Feb 2026) means:
- **No bridging** — trade prediction markets natively on Solana
- **Solana speed** — 400ms finality vs Polygon's 2s
- **Unified liquidity** — Jupiter's $2.35B TVL accessible
- **Chainlink oracles** — 5-15 min markets secured

BeRight becomes the **reputation layer** on top of Jupiter prediction markets.

### Composability Plays

**1. Brier Score as Collateral**
```
- Verified forecaster has Brier = 0.15
- Represents proven edge → can borrow against future earnings
- Integration: Kamino / Marginfi
```

**2. Pool Shares as LP**
```
- Forecaster vault shares = SPL tokens
- Tradeable on Jupiter
- Can LP in Meteora DLMM pools
- Secondary market for forecaster alpha
```

**3. Index Products**
```
- "Top 10 Forecasters by Brier" index
- Rebalances quarterly
- Single token exposure to forecasting alpha
```

**4. Structured Products**
```
- Principal-protected vault
- 90% in Sanctum INF (6-9% APY)
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
- [ ] Jupiter Prediction Markets integration

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

## Competitive Positioning

### vs Polymarket/Kalshi Direct
- They are **prediction markets** (bet on outcomes)
- We are **reputation markets** (invest in forecasters)
- We're the yield layer on top of their volume

### vs Jupiter Prediction Markets
- Jupiter provides **infrastructure** (trading, oracles)
- We provide **reputation + capital layer** (who to follow, how to stake)
- Complementary, not competitive

### vs GambleFi (5-min crypto bets)
- They enable **gambling** (random outcomes)
- We enable **skill investing** (calibrated forecasters)
- Different market, different users

---

## Token Economics (Future)

### $BERIGHT Token (Not Yet Launched)

**Utility**:
1. Governance (fee parameters, tier thresholds)
2. Fee discounts (stake for reduced fees)
3. Revenue share (stake to earn protocol fees)
4. Index weight (token holders vote on composition)

**Distribution**:
- 40% Community (airdrops, incentives)
- 25% Team (4-year vest)
- 20% Treasury (DAO-controlled)
- 15% Investors

**Emission**:
- Forecasters earn $BERIGHT for accurate predictions
- Delegators earn $BERIGHT for staking
- Early adopters earn bonus multipliers

---

## Key Metrics

### Forecaster Metrics
- Brier score (primary calibration metric)
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

1. **Oracle for NAV**: How to trustlessly update pool NAV?
   - Option A: Merkle proof of resolved predictions
   - Option B: Chainlink Functions (Jupiter uses this)
   - Option C: Optimistic oracle (UMA-style)

2. **Cross-Platform Tracking**: Jupiter aggregates Polymarket+Kalshi, but how to unify market IDs?
   - Current: Data Fabric with manual mapping
   - Future: Standardized event hashing

3. **Sybil Resistance**: Prevent Brier score gaming
   - Minimum stake per prediction ($10+)
   - Time-weighted scoring
   - Anomaly detection

4. **Regulatory**: Staking pools and securities law
   - Need legal review
   - KYC for large deposits
   - Structure matters (utility vs investment)

---

## Summary

BeRight Forecaster Network = **reputation layer + staking layer + yield layer**

Built for the March 2026 market where:
- Prediction markets hit $18B/month volume
- Jupiter brings Polymarket to Solana
- Sanctum INF enables 6-9% APY on idle capital
- Meteora provides $1B+ liquidity infrastructure

**The narrative**: "Yield on accuracy, not speculation."

**The moat**: On-chain Brier scores — no one else has portable, verifiable forecaster reputation.

**The opportunity**: Be the Bloomberg Terminal for forecasting — where skill is tradeable, reputation is portable, and alpha is accessible.
