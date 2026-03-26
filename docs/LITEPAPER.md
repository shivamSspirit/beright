# BeRight Protocol Litepaper

**AI-Powered Prediction Market Intelligence**

Version 1.0 | March 2025

---

## Executive Summary

BeRight Protocol is a decentralized prediction market platform that combines AI-powered market intelligence with on-chain forecaster staking pools. Users can stake capital with proven forecasters, earning returns based on their prediction accuracy while maintaining full transparency through Solana's blockchain.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Forecaster Staking Pools](#forecaster-staking-pools)
3. [Pool Tiers & Eligibility](#pool-tiers--eligibility)
4. [Staking Mechanics](#staking-mechanics)
5. [Prediction Flow](#prediction-flow)
6. [Revenue Distribution](#revenue-distribution)
7. [Risk Management](#risk-management)
8. [Technical Architecture](#technical-architecture)
9. [Roadmap](#roadmap)

---

## Introduction

Prediction markets offer a unique mechanism for aggregating information and forecasting future events. BeRight Protocol enhances this by:

- **Calibrated Forecasters**: On-chain Brier score tracking ensures forecaster quality
- **Delegated Staking**: Users can stake with top forecasters without active trading
- **AI Intelligence**: Machine learning for market matching and arbitrage detection
- **Transparent Returns**: All profits and losses recorded on-chain

---

## Forecaster Staking Pools

### Overview

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   FORECASTER    │         │   STAKING POOL  │         │   DELEGATORS    │
│  (Creates Pool) │────────▶│   (On-Chain)    │◀────────│  (Stake SOL/USDC)│
└─────────────────┘         └─────────────────┘         └─────────────────┘
                                    │
                                    ▼
                            ┌─────────────────┐
                            │   PREDICTIONS   │
                            │  (Win/Lose)     │
                            └─────────────────┘
                                    │
                                    ▼
                            ┌─────────────────┐
                            │ PROFIT SPLIT    │
                            │ 50% Forecaster  │
                            │ 30% Delegators  │
                            │ 20% Platform    │
                            └─────────────────┘
```

### How It Works

1. **Forecasters** build a track record through verified on-chain predictions
2. **Qualified forecasters** can create staking pools based on their Brier score
3. **Delegators** stake SOL or USDC to pools, receiving shares proportional to their deposit
4. **Forecasters** use pool capital to make predictions on supported markets
5. **Profits** are distributed automatically (50/30/20): 50% forecaster, 20% delegators (stays in pool), 20% platform

---

## Pool Tiers & Eligibility

Forecasters must meet specific criteria to create pools. Better performance unlocks higher-capacity tiers.

### Tier Requirements

| Tier | Brier Score | Min Predictions | Description |
|------|-------------|-----------------|-------------|
| **Starter** | < 0.35 | 10+ | Entry-level for new forecasters |
| **Basic** | < 0.30 | 25+ | Demonstrated consistency |
| **Pro** | < 0.25 | 100+ | Professional-grade accuracy |
| **Elite** | < 0.20 | 250+ | Top-tier superforecasters |

### Pool Capacities

| Tier | SOL Pool | USDC Pool |
|------|----------|-----------|
| Starter | 5 SOL | 500 USDC |
| Basic | 10 SOL | 1,000 USDC |
| Pro | 100 SOL | 10,000 USDC |
| Elite | 500 SOL | 50,000 USDC |

### Brier Score Explained

The Brier score measures prediction accuracy on a scale of 0 to 1:
- **0.00** = Perfect predictions
- **0.25** = Random guessing baseline
- **< 0.20** = Superforecaster territory

```
Brier Score = (predicted_probability - actual_outcome)²
```

---

## Staking Mechanics

### Depositing (Staking)

```
Delegator ──▶ Select Pool ──▶ Deposit SOL/USDC ──▶ Receive Shares

                        shares = deposit_amount / share_price
```

**Example:**
- Pool share price: 1.05 (5% gains since inception)
- Deposit: 10 SOL
- Shares received: 10 / 1.05 = 9.52 shares

### Minimum Deposits

| Tier | SOL Minimum | USDC Minimum |
|------|-------------|--------------|
| Starter | 0.05 SOL | $5 |
| Basic | 0.1 SOL | $10 |
| Pro | 1 SOL | $100 |
| Elite | 5 SOL | $500 |

### Withdrawing (Unstaking)

```
Delegator ──▶ Request Unstake ──▶ Burn Shares ──▶ Receive Tokens

                    withdrawal_value = shares × share_price - fee
```

### Fees & Lockup

| Parameter | Value |
|-----------|-------|
| Lockup Period | 7 days |
| Normal Withdrawal Fee | 0.5% |
| Early Exit Fee | 2.0% |
| Pool Creation Fee | 0.1 SOL |

---

## Prediction Flow

### Opening a Prediction

Forecasters allocate pool capital to predictions within defined limits:

```
Pool TVL: 50 SOL
         │
         ▼
┌─────────────────────────────────┐
│ Position Limits: 1-20% of TVL  │
│ Max per trade: 10 SOL          │
│ Min per trade: 0.5 SOL         │
└─────────────────────────────────┘
```

### Prediction Lifecycle

```
1. OPEN      ──▶ Forecaster commits capital to a market position
2. ACTIVE    ──▶ Capital locked, awaiting market resolution
3. RESOLVED  ──▶ Market outcome determined
4. SETTLED   ──▶ Profits/losses distributed
```

### Supported Platforms

- Polymarket
- Kalshi
- PredictIt
- Metaculus
- DFlow (native)

---

## Revenue Distribution

### Profit Split (On Winning Predictions) - 50/30/20 Model

```
Prediction Profit: 10 SOL
         │
         ├──▶ 50% Forecaster:  5 SOL (direct payout)
         │
         ├──▶ 30% Delegators:  3 SOL (increases share price)
         │
         └──▶ 20% Platform:    2 SOL (treasury)
```

**Why this split?**
- **Forecaster (50%)**: Strong incentive to perform
- **Delegators (30%)**: Meaningful return worth the capital risk
- **Platform (20%)**: Sustainable development funding

This is based on battle-tested DeFi primitives (Jito, Marinade) and provides perfect incentive alignment.

### How Delegators Earn

Delegator returns come from **share price appreciation**:

```
Initial Investment:  10 SOL at share price 1.00 = 10 shares
After Profits:       Share price increases to 1.15
Current Value:       10 shares × 1.15 = 11.5 SOL (+15%)
```

### Loss Handling

On losing predictions:
- Pool TVL decreases
- Share price decreases proportionally
- All delegators share losses equally (proportional to shares)

---

## Risk Management

### Position Limits

| Parameter | Value |
|-----------|-------|
| Minimum Position | 1% of TVL |
| Maximum Position | 20% of TVL |
| Max Concurrent Predictions | 10 |

### Pool Safeguards

1. **Capacity Limits**: Pools cannot exceed tier capacity
2. **Diversification**: No single prediction can risk >20% of pool
3. **On-Chain Tracking**: All positions and P&L recorded immutably
4. **Lockup Period**: Prevents bank runs during drawdowns

### Delegator Protections

- Full transparency of forecaster track record
- Real-time pool performance metrics
- On-chain audit trail of all predictions
- Withdrawal always available (with applicable fees)

---

## Technical Architecture

### Smart Contracts (Solana/Anchor)

```
Program ID: Fkb7q8pbMa4Wko4u1DYZMXBrXvq8ECFnSqze2TYMm4pM
Network: Devnet (Mainnet planned Q2 2025)
```

### Account Structure

```
┌─────────────────────────────────────────────────────────┐
│ ForecastPool                                            │
├─────────────────────────────────────────────────────────┤
│ forecaster: Pubkey      # Pool creator                  │
│ tier: PoolTier          # Starter/Basic/Pro/Elite       │
│ token_mint: Pubkey      # SOL or USDC                   │
│ total_value: u64        # Current TVL                   │
│ total_shares: u64       # Outstanding shares            │
│ share_price: u64        # Current price (6 decimals)    │
│ delegator_count: u32    # Number of stakers             │
│ prediction_count: u32   # Total predictions made        │
│ wins_count: u32         # Winning predictions           │
│ losses_count: u32       # Losing predictions            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Delegation                                              │
├─────────────────────────────────────────────────────────┤
│ pool: Pubkey            # Associated pool               │
│ delegator: Pubkey       # Staker wallet                 │
│ shares: u64             # Shares owned                  │
│ deposited_value: u64    # Original deposit              │
│ deposited_at: i64       # Timestamp for lockup          │
└─────────────────────────────────────────────────────────┘
```

### Instructions

| Instruction | Description |
|-------------|-------------|
| `create_forecast_pool` | Create a new pool (forecaster) |
| `stake_to_forecast_pool` | Deposit and receive shares |
| `unstake_from_forecast_pool` | Burn shares and withdraw |
| `open_pool_prediction` | Commit capital to prediction |
| `resolve_pool_prediction` | Settle prediction outcome |
| `cancel_pool_prediction` | Cancel before resolution |

### API Endpoints

```
GET  /api/v2/forecast-pools              # List all pools
GET  /api/v2/forecast-pools?tier=4       # Filter by tier
POST /api/v2/forecast-pools/create       # Create pool tx
POST /api/v2/forecast-pools/{id}/stake   # Stake tx
POST /api/v2/forecast-pools/{id}/unstake # Unstake tx
```

---

## Conclusion

BeRight Protocol creates a new paradigm for prediction market participation. By enabling delegated staking with verified forecasters, we democratize access to prediction alpha while maintaining the transparency and security of blockchain technology.

**Key Benefits:**
- **For Forecasters**: Monetize prediction skill, access more capital
- **For Delegators**: Passive exposure to prediction markets
- **For Markets**: More liquidity, better price discovery

---

## Links

- **Website**: [beright.ai](https://beright.ai)
- **Documentation**: [docs.beright.ai](https://docs.beright.ai)
- **GitHub**: [github.com/beright-protocol](https://github.com/beright-protocol)
- **Program (Devnet)**: `Fkb7q8pbMa4Wko4u1DYZMXBrXvq8ECFnSqze2TYMm4pM`

---

*BeRight Protocol - Stake on Intelligence*
