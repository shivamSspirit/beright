# BeRight Protocol Litepaper

**The Bloomberg Terminal for Prediction Markets**

Version 2.0 | March 2026

---

## Executive Summary

BeRight Protocol is building the infrastructure layer for prediction markets—combining conversational AI, decentralized forecaster reputation, and capital delegation into a unified platform on Solana.

We transform prediction markets from fragmented speculation into structured, signal-driven capital markets where forecasting skill becomes an investable asset class.

**Core Innovation:** Conviction Pools—a DeFi primitive where forecasters create staking pools backed by on-chain reputation, enabling capital providers to earn yield from cognitive skill rather than capital efficiency.

---

## Table of Contents

1. [Introduction](#introduction)
2. [The Three Layers](#the-three-layers)
3. [Conviction Pools (Forecaster Staking)](#conviction-pools-forecaster-staking)
4. [Pool Tiers & Eligibility](#pool-tiers--eligibility)
5. [Staking Mechanics](#staking-mechanics)
6. [Prediction Flow](#prediction-flow)
7. [Revenue Distribution](#revenue-distribution)
8. [Risk Management](#risk-management)
9. [Technical Architecture](#technical-architecture)
10. [Roadmap](#roadmap)
11. [Conclusion](#conclusion)

---

## Introduction

### The Problem

Prediction markets reached **$63.5B in volume** in 2025, projected to surpass **$325B in 2026**. Yet the infrastructure layer remains fundamentally broken:

**No Proof of Skill**
- Forecasters operate across fragmented platforms (Polymarket, Kalshi, Manifold, Metaculus)
- No unified, verifiable track record
- Twitter "gurus" delete losses
- Alpha exists but is invisible

**No Capital Allocation**
- Top forecasters limited by their own capital
- Investors have no mechanism to back proven talent
- Skill cannot scale

**No Unified Access**
- Users manually check multiple platforms
- Miss arbitrage opportunities
- Lose edge to friction

### The Vision

BeRight Protocol creates the infrastructure layer that makes forecasting skill investable, verifiable, and scalable.

We're building the **Bloomberg Terminal for prediction markets**—where:
- **AI agents** handle market intelligence (arbitrage, research, execution)
- **Conversational interfaces** replace screen-switching across platforms
- **On-chain reputation** makes skill transparent and composable
- **Conviction Pools** enable capital delegation to proven forecasters

---

## The Three Layers

### 1. AI Signal Layer

Multi-agent system powered by Claude (Anthropic):

**Scout Agent** (Haiku)
- Fast market scanning across 5+ platforms
- Real-time arbitrage detection
- Trend analysis and opportunity scoring

**Analyst Agent** (Opus)
- Deep research with base rates
- Superforecaster-grade probability estimates
- Bias detection and calibration warnings

**Trader Agent** (Sonnet)
- Position sizing algorithms
- Risk management and portfolio rebalancing
- Trade execution and performance tracking

**Integration Layer**
- Natural language commands for agent interaction
- Terminal interface for power users
- Web dashboard for portfolio management

### 2. Decentralized Forecaster Network

**On-Chain Reputation System**
- Every prediction commits to Solana
- Brier scores calculated and stored immutably
- Verifiable track record across all markets
- Composable credentials (soulbound NFTs coming)

**Forecaster Progression**
```
Rookie (0 predictions)
    ↓
Verified (10+ predictions, Brier < 0.35)
    ↓
Elite (100+ predictions, Brier < 0.25)
    ↓
Super Forecaster (250+ predictions, Brier < 0.20)
```

### 3. Market Aggregation Layer

**Unified Access**
- Polymarket (crypto prediction markets)
- Kalshi (regulated US markets)
- Manifold (play-money markets)
- Limitless (Base chain markets)
- Metaculus (forecasting tournaments)

**Cross-Platform Features**
- Unified search and discovery
- Price comparison and arbitrage detection
- Portfolio tracking across all platforms
- Whale wallet monitoring

---

## Conviction Pools (Forecaster Staking)

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
5. **Profits** are distributed automatically (50/30/20): 50% forecaster, 30% delegators (stays in pool, increases share price), 20% platform

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

The Brier score measures prediction accuracy on a scale of 0 to 1, where **lower is better**:

| Score | Meaning | Example |
|-------|---------|---------|
| **0.00** | Perfect predictions | Predicted 70%, outcome YES (1.0): (0.7-1.0)² = 0.09 |
| **0.25** | Random guessing | Coin flip baseline |
| **0.20** | Superforecaster | Top 1% of forecasters globally |
| **0.18** | Elite tier | Professional-grade accuracy |
| **0.50+** | Poor calibration | Worse than random |

**Formula:**
```
Brier Score = Σ(predicted_probability - actual_outcome)² / N
```

**Why Brier Scores Matter:**
- Rewards well-calibrated probabilities, not just binary predictions
- Penalizes overconfidence (predicting 95% when outcome is 50/50)
- Industry standard used by Good Judgment Project, Metaculus, and professional forecasting

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

**Current Deployment: Devnet**
- Calibration Program: `GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ`
- Conviction Escrow: `E6Gp6fzaPM6y1k3wLYBFno1oMZjZvNbaFszVGzvXaZX9`
- Staking Pool: `Fkb7q8pbMa4Wko4u1DYZMXBrXvq8ECFnSqze2TYMm4pM`
- BeRight Vault: `EhU2oz3LKPDCVRhRW5TXMeraqVFoSJ3L42cyeC6Ns2eL`

**Mainnet Launch: Q2 2026**

All programs built with Anchor framework (v0.30+) with comprehensive test coverage and security best practices.

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

## Development Roadmap

### Current Status (March 2026)
- ✅ 4 Solana programs deployed on devnet
- ✅ Multi-agent AI system operational
- ✅ Cross-platform aggregation (5 platforms)
- ✅ 35+ predictions recorded on-chain
- ✅ 198 commits, production-ready codebase

### Near-Term (Q2 2026)
**Mainnet Launch**
- Deploy all programs to Solana mainnet
- Production AI infrastructure (Claude, Jupiter, Tavily)
- Public forecaster profiles and leaderboards
- Conviction Pools launch (8 tiers operational)

**Target Metrics:**
- 1,000+ users
- 10,000+ on-chain predictions
- $50K+ TVL in pools
- 50+ verified forecasters

### Future Development
Additional features planned post-mainnet:
- Enhanced trading execution
- Additional platform integrations
- Advanced analytics and reporting
- Developer API for third-party applications

---

## Conclusion

BeRight Protocol creates a new DeFi primitive where forecasting skill becomes an investable asset class.

### The Core Innovation

**Conviction Pools** transform prediction markets from individual speculation into a structured capital market where:
- **Forecasters** monetize their skill at scale
- **Delegators** earn yield from proven talent
- **Markets** get deeper liquidity and better price discovery

### Why This Matters

1. **First Skill-Backed DeFi Primitive**
   - Yield comes from cognitive skill, not capital efficiency
   - On-chain reputation makes talent verifiable and composable

2. **Solana-Native Infrastructure**
   - Fast finality for real-time prediction recording
   - Low fees enable micro-predictions
   - Composable programs for ecosystem integration

3. **Network Effects**
   - More forecasters → better talent pool → more capital
   - More platforms → better arbitrage → more opportunities
   - More reputation data → better delegation decisions

### Vision

BeRight Protocol is building the infrastructure layer where intelligence is investable, reputation is verifiable, and prediction markets reach their full potential as information aggregation mechanisms.

This is **capital delegation backed by proof-of-skill**—a new primitive for DeFi.

---

## Links & Resources

- **Website**: [beright.io](https://beright.io)
- **Documentation**: [docs.beright.io](https://docs.beright.io)
- **GitHub**: [github.com/shivamSspirit/beright](https://github.com/shivamSspirit/beright)
- **Twitter**: [@beright_io](https://twitter.com/beright_io)

### Deployed Programs (Devnet)

| Program | Address |
|---------|---------|
| Calibration | `GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ` |
| Conviction Escrow | `E6Gp6fzaPM6y1k3wLYBFno1oMZjZvNbaFszVGzvXaZX9` |
| Staking Pool | `Fkb7q8pbMa4Wko4u1DYZMXBrXvq8ECFnSqze2TYMm4pM` |
| BeRight Vault | `EhU2oz3LKPDCVRhRW5TXMeraqVFoSJ3L42cyeC6Ns2eL` |

### Contact

- **Telegram**: @shivamSspirit
- **Email**: team@beright.io

---

*BeRight Protocol - Where Intelligence Meets Capital*

**Version 2.0** | March 2026 | Built on Solana
