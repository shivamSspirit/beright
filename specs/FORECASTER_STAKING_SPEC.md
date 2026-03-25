# Forecaster Staking Pools Specification

## Overview

A simplified staking system where forecasters create pools, delegators stake capital, and profits from prediction market activity are distributed according to a fixed revenue split.

**Revenue Split**:
- **30%** → Forecaster (skill reward)
- **50%** → Delegators (capital providers)
- **20%** → Platform (BeRight Protocol)

---

## Pool Tiers

### Newbie Forecaster Pools

| Tier | Capacity | Token | Min Brier | Min Predictions |
|------|----------|-------|-----------|-----------------|
| Starter SOL | 5 SOL | SOL | 0.35 | 10 |
| Basic SOL | 10 SOL | SOL | 0.30 | 25 |
| Starter USDC | 500 USDC | USDC | 0.35 | 10 |
| Basic USDC | 1,000 USDC | USDC | 0.30 | 25 |

### Pro Forecaster Pools

| Tier | Capacity | Token | Min Brier | Min Predictions |
|------|----------|-------|-----------|-----------------|
| Pro SOL | 100 SOL | SOL | 0.25 | 100 |
| Pro USDC | 10,000 USDC | USDC | 0.25 | 100 |
| Elite SOL | 500 SOL | SOL | 0.20 | 250 |
| Elite USDC | 50,000 USDC | USDC | 0.20 | 250 |

---

## Core Mechanics

### 1. Pool Creation (One-Click)

```
User clicks "Create Pool" → Select Tier → Confirm → Pool Live
```

**On-Chain Actions**:
1. Create Pool PDA (Program Derived Address)
2. Initialize vault account for deposits
3. Link to ForecasterProfile PDA
4. Emit `PoolCreated` event

```typescript
interface PoolConfig {
  tier: PoolTier;
  token: 'SOL' | 'USDC';
  capacity: number;
  forecaster: PublicKey;

  // Fixed by tier
  managementFeeBps: 0;        // No management fee (profit sharing only)
  performanceFeeBps: 3000;    // 30% to forecaster (performance fee)
  platformFeeBps: 2000;       // 20% to platform
  delegatorShareBps: 5000;    // 50% to delegators
}
```

### 2. Delegation (Staking)

```
Delegator → Deposit SOL/USDC → Receive Pool Shares
```

**Share Calculation**:
```
shares_minted = deposit_amount / share_price
share_price = pool_tvl / total_shares

// Initial: share_price = 1.0
// After profits: share_price > 1.0
// After losses: share_price < 1.0
```

**Example**:
```
Pool TVL: 10 SOL
Total Shares: 10
Share Price: 1.0 SOL

Delegator deposits 2 SOL
→ Receives 2 shares
→ New TVL: 12 SOL
→ New Total Shares: 12
→ Share Price: 1.0 SOL (unchanged)
```

### 3. Prediction Activity

Forecaster uses pool capital to make predictions:

```
Pool Capital → Prediction Market → Position
                                      ↓
                               Market Resolves
                                      ↓
                              Win/Loss Realized
                                      ↓
                             Profit Distribution
```

**Position Sizing Rule**:
```
max_position = pool_tvl * 0.20  // Max 20% per prediction
min_position = pool_tvl * 0.01  // Min 1% per prediction
```

### 4. Profit Distribution

When a prediction resolves profitably:

```typescript
function distributeProfits(profit: number) {
  const forecasterShare = profit * 0.30;  // 30%
  const delegatorShare = profit * 0.50;   // 50%
  const platformShare = profit * 0.20;    // 20%

  // Forecaster: direct transfer
  transfer(forecaster, forecasterShare);

  // Platform: transfer to treasury
  transfer(platformTreasury, platformShare);

  // Delegators: increase share price
  pool.tvl += delegatorShare;
  // share_price = pool.tvl / total_shares (automatically increases)
}
```

**Loss Handling**:
```typescript
function handleLoss(loss: number) {
  // Losses come from pool TVL (delegators bear the risk)
  pool.tvl -= loss;
  // share_price decreases proportionally

  // Forecaster receives nothing on losses
  // Platform receives nothing on losses
}
```

---

## Formulas

### Share Price

```
share_price = total_pool_value / total_shares_outstanding

// Example progression:
// Day 0: TVL = 10 SOL, Shares = 10, Price = 1.0
// Day 7: TVL = 12 SOL (profits), Shares = 10, Price = 1.2
// Day 14: TVL = 11 SOL (loss), Shares = 10, Price = 1.1
```

### Delegator Returns

```
delegator_value = shares_owned * share_price
delegator_profit = delegator_value - initial_deposit
delegator_apy = (delegator_profit / initial_deposit) * (365 / days_staked) * 100
```

### Pool Performance

```
// Gross returns (before split)
gross_return = (current_tvl + all_distributions) / initial_tvl - 1

// Net delegator return (after forecaster + platform take)
net_delegator_return = gross_return * 0.50

// Forecaster earnings
forecaster_earnings = gross_return * initial_tvl * 0.30

// Platform revenue
platform_revenue = gross_return * initial_tvl * 0.20
```

### Expected Value per Prediction

```
EV = (win_probability * profit_if_win) - (loss_probability * loss_if_lose)

// For prediction at 60% odds buying YES at $0.55:
// profit_if_win = $0.45 per share
// loss_if_lose = $0.55 per share
// EV = (0.60 * 0.45) - (0.40 * 0.55) = $0.05 per share
```

### Forecaster Skill Score Impact

```
// Better Brier score = can manage larger pools
max_pool_capacity = base_capacity * (1 + (0.35 - brier_score) * 10)

// Example:
// Brier 0.25: max = base * 2.0
// Brier 0.30: max = base * 1.5
// Brier 0.35: max = base * 1.0 (minimum)
```

---

## Platform Revenue Model

### Fee Sources

| Source | Fee | Trigger |
|--------|-----|---------|
| Prediction Profits | 20% of net profit | When prediction wins |
| Pool Creation | 0.1 SOL | One-time |
| Withdrawal Fee | 0.5% of amount | When delegator exits |
| Early Exit Penalty | 2% of amount | If < 7 days staked |

### Revenue Projection

```
Assumptions:
- 100 active pools
- Average pool size: 50 SOL (~$7,500)
- Average monthly return: 8%
- Profit rate: 60% (40% losses)

Monthly Calculations:
- Total TVL: 5,000 SOL ($750,000)
- Gross profits: 5,000 * 0.08 * 0.60 = 240 SOL
- Platform share: 240 * 0.20 = 48 SOL/month (~$7,200)

Annual Platform Revenue: ~$86,400 (at 100 pools)
```

---

## API Design

### Pool Management

```typescript
// Create pool (one-click)
POST /api/v2/pools/create
{
  tier: 'starter_sol' | 'basic_sol' | 'pro_sol' | ...
}
→ { poolId, address, tier, capacity, status: 'active' }

// Get pool details
GET /api/v2/pools/:poolId
→ {
  poolId, tier, forecaster,
  tvl, shares, sharePrice,
  performance: { daily, weekly, monthly, allTime },
  delegators: number,
  predictions: { active, resolved, winRate }
}

// List pools
GET /api/v2/pools?tier=pro&token=SOL&sort=performance
→ { pools: [...], total, page }
```

### Delegation

```typescript
// Stake to pool
POST /api/v2/pools/:poolId/stake
{
  amount: number,
  token: 'SOL' | 'USDC'
}
→ {
  txSignature,
  sharesReceived,
  sharePrice,
  estimatedApy
}

// Unstake from pool
POST /api/v2/pools/:poolId/unstake
{
  shares: number
}
→ {
  txSignature,
  amountReceived,
  fees: { withdrawal, earlyExit },
  pnl: { gross, net }
}

// Get delegation status
GET /api/v2/pools/:poolId/delegation
→ {
  shares,
  value,
  depositedAt,
  pnl,
  canWithdraw: boolean,
  lockupEnds: Date
}
```

### Predictions (Forecaster Only)

```typescript
// Make prediction using pool capital
POST /api/v2/pools/:poolId/predict
{
  marketId: string,
  side: 'YES' | 'NO',
  amount: number,        // In pool's token
  platform: 'polymarket' | 'kalshi' | 'jupiter'
}
→ {
  predictionId,
  positionSize,
  entryPrice,
  estimatedPayout,
  txSignature
}

// Close prediction
POST /api/v2/pools/:poolId/predictions/:predictionId/close
→ {
  exitPrice,
  pnl,
  distribution: {
    forecaster: number,
    delegators: number,
    platform: number
  }
}
```

### Analytics

```typescript
// Pool performance
GET /api/v2/pools/:poolId/analytics
→ {
  returns: { daily: [], weekly: [], monthly: [] },
  sharpe: number,
  maxDrawdown: number,
  winRate: number,
  avgHoldingPeriod: string,
  predictionsByCategory: { ... }
}

// Forecaster leaderboard
GET /api/v2/leaderboards/forecasters
→ {
  forecasters: [{
    profile,
    poolCount,
    totalTvl,
    avgReturn,
    brierScore,
    predictionCount
  }]
}

// Platform stats
GET /api/v2/stats
→ {
  totalTvl,
  totalPools,
  totalDelegators,
  totalPredictions,
  platformRevenue: { daily, weekly, monthly }
}
```

---

## Liquid Staking Tokens (LST) - Future

### Phase 1: Pool Shares (Current)

- Non-transferable shares
- Redeemable only from pool
- No secondary market

### Phase 2: Transferable Shares

- Pool shares become SPL tokens
- Can transfer between wallets
- Still redeemable from pool

### Phase 3: brSOL / brUSDC (BeRight LST)

**Concept**: Aggregate all pools into a single liquid staking token

```
Delegator deposits SOL
         ↓
    brSOL minted
         ↓
    SOL distributed across top forecaster pools
         ↓
    brSOL appreciates with aggregate returns
```

**brSOL Mechanics**:
```typescript
interface BrSolState {
  totalSolDeposited: number;
  totalBrSolMinted: number;

  // Exchange rate (appreciates over time)
  exchangeRate: number;  // brSOL per SOL

  // Underlying allocations
  poolAllocations: Array<{
    poolId: string;
    allocation: number;  // Percentage
    forecasterBrier: number;
  }>;
}

// Allocation algorithm: weight by forecaster performance
function calculateAllocations(pools: Pool[]): Allocation[] {
  const totalWeight = pools.reduce((sum, p) =>
    sum + (0.35 - p.forecaster.brierScore), 0);

  return pools.map(p => ({
    poolId: p.id,
    allocation: (0.35 - p.forecaster.brierScore) / totalWeight
  }));
}
```

**brSOL Benefits**:
1. **Diversification**: Exposure to multiple forecasters
2. **Liquidity**: Trade on DEXs (Raydium, Orca)
3. **DeFi Composability**: Use as collateral (Kamino, Drift)
4. **Passive Income**: Auto-compounds across pools

**Exchange Rate Calculation**:
```
brSOL_price = total_underlying_value / total_brSOL_supply

// Example:
// 1000 brSOL outstanding
// Underlying: 1100 SOL across pools
// brSOL price = 1.1 SOL per brSOL
```

---

## On-Chain Program Structure

### Account Types

```rust
// Pool Account (PDA)
#[account]
pub struct ForecastPool {
    pub bump: u8,
    pub forecaster: Pubkey,
    pub token_mint: Pubkey,         // SOL or USDC
    pub vault: Pubkey,              // Token account

    pub tier: PoolTier,
    pub capacity: u64,
    pub total_shares: u64,
    pub total_value: u64,           // In lamports or USDC base units

    pub created_at: i64,
    pub predictions_count: u32,
    pub wins_count: u32,
    pub losses_count: u32,

    pub status: PoolStatus,         // Active, Paused, Closed
}

// Delegation Account (PDA per delegator per pool)
#[account]
pub struct Delegation {
    pub bump: u8,
    pub pool: Pubkey,
    pub delegator: Pubkey,

    pub shares: u64,
    pub deposited_amount: u64,
    pub deposited_at: i64,
    pub last_claim_at: i64,
}

// Prediction Account (PDA per prediction)
#[account]
pub struct PoolPrediction {
    pub bump: u8,
    pub pool: Pubkey,
    pub market_id: [u8; 32],        // External market reference
    pub platform: Platform,

    pub side: Side,                 // Yes or No
    pub amount: u64,
    pub entry_price: u64,           // In basis points

    pub status: PredictionStatus,   // Open, Won, Lost, Cancelled
    pub exit_price: Option<u64>,
    pub pnl: Option<i64>,           // Signed for profit/loss

    pub opened_at: i64,
    pub closed_at: Option<i64>,
}
```

### Instructions

```rust
pub enum ForecastPoolInstruction {
    // Pool Management
    CreatePool { tier: PoolTier },
    PausePool,
    ClosePool,

    // Delegation
    Stake { amount: u64 },
    Unstake { shares: u64 },

    // Predictions (forecaster only)
    OpenPrediction {
        market_id: [u8; 32],
        platform: Platform,
        side: Side,
        amount: u64,
    },
    ClosePrediction {
        prediction: Pubkey,
        outcome: Outcome,
    },

    // Admin
    DistributeProfits { prediction: Pubkey },
    UpdateForecasterProfile,
}
```

---

## Security Considerations

### Risk Limits

```typescript
const RISK_LIMITS = {
  maxPositionPct: 0.20,          // 20% of pool per prediction
  maxOpenPositions: 10,          // Max concurrent predictions
  maxDailyTrades: 20,            // Rate limit
  minHoldingPeriod: 3600,        // 1 hour minimum
  maxLeverage: 1,                // No leverage (1x only)

  // Pool limits
  maxDelegatorPct: 0.25,         // No single delegator > 25%
  minDelegatorCount: 3,          // Need 3+ delegators for pro pools
};
```

### Circuit Breakers

```typescript
const CIRCUIT_BREAKERS = {
  // Pool-level
  maxDailyLoss: 0.10,            // Pause if 10% daily loss
  maxWeeklyLoss: 0.20,           // Pause if 20% weekly loss

  // Platform-level
  maxSystemDrawdown: 0.15,       // Halt all pools if 15% system loss
  minLiquidity: 1000,            // USD equivalent
};
```

### Audit Requirements

1. **Smart Contract Audit**: Before mainnet
2. **Economic Audit**: Tokenomics review
3. **Continuous Monitoring**: Real-time alerts

---

## Implementation Roadmap

### Phase 1: MVP (4 weeks)
- [ ] Pool creation (fixed tiers)
- [ ] SOL staking/unstaking
- [ ] Manual prediction execution
- [ ] Basic profit distribution

### Phase 2: Full Launch (4 weeks)
- [ ] USDC pools
- [ ] Automated prediction routing
- [ ] Delegator dashboard
- [ ] Mobile support

### Phase 3: LST (6 weeks)
- [ ] Transferable pool shares
- [ ] brSOL token launch
- [ ] DEX liquidity
- [ ] DeFi integrations

### Phase 4: Scale (Ongoing)
- [ ] Cross-chain pools
- [ ] Institutional tiers
- [ ] Automated strategies
- [ ] Governance (DAO)

---

## References

- [Solana Liquid Staking Guide](https://sanctum.so/blog/solana-liquid-staking-guide)
- [SPL Stake Pool Documentation](https://spl.solana.com/stake-pool/overview)
- [Solana Staking Rewards Calculator](https://www.helius.dev/staking/calculator)
- [Prediction Markets Guide](https://dappradar.com/blog/prediction-markets-crypto-guide)
- [Solana LST Comparison](https://solanacompass.com/stake-pools)
- [Helius LST Deep Dive](https://www.helius.dev/blog/lsts-on-solana)

---

## Summary

| Metric | Value |
|--------|-------|
| Pool Tiers | 8 (4 newbie, 4 pro) |
| Revenue Split | 30/50/20 (F/D/P) |
| Min Stake | 5 SOL / 500 USDC |
| Max Pool | 500 SOL / 50,000 USDC |
| Lockup | 7 days |
| Withdrawal Fee | 0.5% |
| Early Exit Fee | 2% |

**Key Differentiator**: Brier-score gated pools ensure only calibrated forecasters can manage larger capital, aligning incentives between forecasters, delegators, and platform.
