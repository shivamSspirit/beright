# BeRight Protocol: Complete Architecture & DeFi Primitive Design

> A Decentralized Network of Forecasters - Capital Meets Calibrated Skill

**Version:** 1.0
**Date:** April 2026
**Status:** Architecture Specification

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture](#2-current-architecture)
3. [Solana DeFi Protocol Research](#3-solana-defi-protocol-research)
4. [Prediction Market DeFi Landscape](#4-prediction-market-defi-landscape)
5. [BeRight's Unique Primitive](#5-berights-unique-primitive)
6. [Capital Flow Architecture](#6-capital-flow-architecture)
7. [Pool Mechanics](#7-pool-mechanics)
8. [Platform Integrations](#8-platform-integrations)
9. [Yield Generation Formulas](#9-yield-generation-formulas)
10. [Leverage Mechanism](#10-leverage-mechanism)
11. [Share Token Composability](#11-share-token-composability)
12. [Resolution & Distribution (50/30/20)](#12-resolution--distribution-503020)
13. [Prediction Decision System](#13-prediction-decision-system)
14. [Complete System Architecture](#14-complete-system-architecture)
15. [Implementation Roadmap](#15-implementation-roadmap)
16. [Monetization Strategy](#16-monetization-strategy)

---

## 1. Executive Summary

### What BeRight Is Building

BeRight is a **decentralized forecaster network** - a DeFi primitive where capital flows to on-chain verified forecasting skill. Think of it as a hedge fund protocol where:

- **Forecasters** provide skill (verified via Brier scores)
- **Delegators** provide capital (stake to forecaster pools)
- **Platform** provides infrastructure (takes 20% of profits)

### The Three Pillars

| Program | Address | Purpose |
|---------|---------|---------|
| **Calibration** | `GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ` | On-chain skill verification |
| **Staking Pool** | `Fkb7q8pbMa4Wko4u1DYZMXBrXvq8ECFnSqze2TYMm4pM` | Capital delegation & yield |
| **Conviction Escrow** | `E6Gp6fzaPM6y1k3wLYBFno1oMZjZvNbaFszVGzvXaZX9` | Project milestone markets |

### Revenue Split

```
Prediction Profits: 100%
├── 50% → Forecaster (skill reward)
├── 30% → Delegators (capital provider yield)
└── 20% → Platform (infrastructure fee)
```

### Key Innovation

**No other protocol monetizes forecasting skill on-chain.** Gondor lets you borrow against positions. HyperOdd gives you leverage. BeRight verifies WHICH forecasters deserve capital.

---

## 2. Current Architecture

### How The Three Programs Work Together

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BERIGHT FORECASTER NETWORK                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────┐     ┌─────────────────────┐     ┌──────────────┐ │
│   │  CALIBRATION        │────▶│  STAKING POOL       │────▶│  CONVICTION  │ │
│   │  PROGRAM            │     │  PROGRAM            │     │  ESCROW      │ │
│   │                     │     │                     │     │              │ │
│   │  • Brier scores     │     │  • Forecaster pools │     │  • Project   │ │
│   │  • Predictions      │     │  • Delegations      │     │    stakes    │ │
│   │  • Resolution       │     │  • 50/30/20 split   │     │  • Binary    │ │
│   │  • Track record     │     │  • Tier gating      │     │    markets   │ │
│   └─────────────────────┘     └─────────────────────┘     └──────────────┘ │
│            │                           │                         │         │
│            │      SKILL PROOF          │     CAPITAL FLOW        │  SKIN   │
│            └───────────────────────────┴────────────────────────▶│  IN     │
│                                                                   │  GAME   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Calibration Program

Tracks forecaster skill on-chain via Brier scores.

```rust
pub struct ForecasterState {
    pub authority: Pubkey,
    pub total_predictions: u32,
    pub resolved_predictions: u32,
    pub cumulative_brier_score: f64,
    pub avg_brier_score: f64,          // Primary skill metric
    pub accuracy: f64,
    pub calibration_buckets: [[u16; 2]; 10],  // For calibration curves
}
```

**Key Instructions:**
- `initialize_forecaster` - Create forecaster profile
- `record_prediction` - Log prediction with probability
- `resolve_prediction` - Calculate Brier score on resolution

### Staking Pool Program

Routes capital to proven forecasters via tier-gated pools.

```rust
pub struct ForecastPool {
    pub forecaster: Pubkey,
    pub tier: PoolTier,
    pub total_value: u64,
    pub total_shares: u64,
    pub share_price: u64,
    pub revenue_split: RevenueSplit,  // 50/30/20
}

pub enum PoolTier {
    StarterSol,   // 5 SOL, Brier < 0.35, 10+ predictions
    BasicSol,     // 10 SOL, Brier < 0.30, 25+ predictions
    ProSol,       // 100 SOL, Brier < 0.25, 100+ predictions
    EliteSol,     // 500 SOL, Brier < 0.20, 250+ predictions
}
```

**Key Instructions:**
- `create_forecast_pool` - Forecaster creates tier-gated pool
- `stake_to_forecast_pool` - Delegator stakes capital
- `open_pool_prediction` - Forecaster makes prediction
- `resolve_pool_prediction` - Distribute profits (50/30/20)

### Conviction Escrow

Projects stake SOL on their own milestones.

```rust
pub struct ConvictionMarket {
    pub project_wallet: Pubkey,
    pub stake_amount: u64,
    pub stake_position: StakePosition,  // YES or NO
    pub resolution_date: i64,
    pub outcome: MarketOutcome,
}
```

---

## 3. Solana DeFi Protocol Research

### Protocol Comparison

| Protocol | TVL | APY | Fee Model | Key Innovation |
|----------|-----|-----|-----------|----------------|
| **Jito** | $2.92B | 8-10% | 0.3% annual + 0.1% withdraw | MEV rewards to stakers |
| **Marinade** | $1.5B+ | 7-9% | Conditional performance | Only charge when outperforming |
| **Marginfi** | $500M+ | 5-8% | 12.5% of interest spread | Risk-tiered lending |
| **Meteora** | $750M+ | 20-80% | 0% (most pools) | Idle capital auto-lent |
| **Kamino** | $1B+ | 15-100% | 5-20% performance | Auto-rebalancing + leverage |
| **Sanctum** | $2B+ | 9-20% | 10% of trading fees | LST aggregation |

### Key Lessons For BeRight

#### 1. Exchange Rate Appreciation (Jito, Marinade, Sanctum)

The battle-tested model for yield-bearing tokens:

```
User deposits 100 SOL → Receives ~97.5 tokens (rate already appreciated)
Profits accumulate → Exchange rate increases
User redeems 97.5 tokens → Receives 105 SOL
```

**BeRight Implementation:** Already using `share_price = total_value / total_shares`

#### 2. Conditional Performance Fees (Marinade Feb 2026)

Revolutionary fee model - only charge when outperforming:

```rust
if forecaster.avg_brier_score < tier.max_brier_score {
    // Outperforming threshold → charge 50%
    performance_fee = profit * 0.50;
} else {
    // Underperforming → NO FEE
    performance_fee = 0;
}
```

**Impact:** Aligns incentives perfectly. Forecasters only earn when delivering value.

#### 3. Idle Capital Optimization (Meteora, Marginfi)

Capital should never be idle:

```
Pool: 50,000 USDC
├── Active predictions: 32% (16,000 USDC)
├── Yield protocols: 58% (29,000 USDC)
│   ├── Marginfi: 14,500 USDC @ 6% APY
│   ├── Meteora: 8,700 USDC @ 5% APY
│   └── Sanctum: 5,800 USDC @ 10% APY
└── Reserve: 10% (5,000 USDC)

Blended idle yield: 5.9% APY
Impact: +3.5% to total pool APY
```

#### 4. Multi-Stakeholder Distribution (Jito TipRouter)

```
MEV Tips: 100%
├─ 94% → Validators & Stakers (pro-rata)
└─ 6% → Protocol fees
    ├─ 5.7% → Jito DAO
    ├─ 0.15% → Operations
    └─ 0.15% → Token stakers
```

Creates sustainable economics with multiple beneficiaries.

#### 5. Reserve Pools (Sanctum)

Enable instant withdrawals without sacrificing yield:

```rust
struct ReserveConfig {
    target: 10%,    // Target reserve ratio
    min: 5%,        // Minimum before blocking withdrawals
    max: 20%,       // Maximum (excess deployed to yield)
}

// Dynamic withdrawal fee based on reserves
fn withdrawal_fee(reserves: f64) -> f64 {
    if reserves > 0.15 { 0.005 }      // 0.5%
    else if reserves > 0.10 { 0.01 }  // 1.0%
    else if reserves > 0.05 { 0.02 }  // 2.0%
    else { 0.05 }                      // 5.0%
}
```

---

## 4. Prediction Market DeFi Landscape

### Existing Protocols

| Protocol | What It Does | Status | Revenue Model |
|----------|--------------|--------|---------------|
| **Gondor** | Borrow against Polymarket positions | Live | Interest spread |
| **HyperOdd** | 20x leverage on predictions | Testnet | Trading fees |
| **Ostium** | Event-driven automation | Raised $24M | Platform fees |
| **Aura** | Unified Poly + Hyperliquid | Live | Routing fees |
| **Narrative** | Perpetual info markets | Early testnet | TBD |

### Gondor Deep Dive

Collateralized borrowing against prediction positions:

- **LTV:** 50% (borrow up to half your position value)
- **Liquidation:** 77% threshold
- **Innovation:** Opposite-outcome hedging for liquidations
- **Built on:** Morpho ($5B+ TVL, 34 audits)

### HyperOdd Deep Dive

Leveraged prediction markets (up to 20x):

- **Risk Management:**
  - Liquidation bands (lower bands liquidate first)
  - OI-based margin scaling
  - Leverage decay (5x at 30 days → 1x at expiry)
- **Markets:** Politics, sports, crypto, stocks

### Key Insight: BeRight's Unique Position

```
Existing Protocols:
- Gondor: Unlocks capital in positions (passive collateral)
- HyperOdd: Amplifies exposure (leverage)
- Ostium: Automates trading (execution)

BeRight: Monetizes forecasting SKILL (no one else does this)
```

### CLOB vs AMM in Prediction Markets

**Why AMMs Failed:**
- Binary markets break invariants
- At resolution, half your inventory goes to zero
- Can't rebalance like perpetual token pairs

**Why CLOB Won:**
- Directional liquidity
- No impermanent loss
- Capital efficient for tail probabilities
- Industry consensus: Polymarket, Kalshi, Hyperliquid all use CLOB

---

## 5. BeRight's Unique Primitive

### The Forecaster Hedge Fund Protocol

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BERIGHT: THE FORECASTER HEDGE FUND PROTOCOL              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   TRADITIONAL HEDGE FUND          │        BERIGHT PROTOCOL                │
│   ─────────────────────────       │        ────────────────                 │
│                                   │                                         │
│   • Fund manager = skill          │   • Forecaster = skill (Brier verified) │
│   • LPs = capital                 │   • Delegators = capital                │
│   • 2/20 fee structure            │   • 50/30/20 split (performance only)   │
│   • Quarterly audits              │   • On-chain real-time transparency     │
│   • $1M+ minimums                 │   • 0.05 SOL minimum                    │
│   • Accredited only               │   • Permissionless                      │
│   • Opaque strategies             │   • Every prediction visible            │
│                                   │                                         │
│   PROBLEM: Trust required         │   SOLUTION: Trust minimized             │
│   PROBLEM: Capital locked         │   SOLUTION: Liquid shares               │
│   PROBLEM: Performance            │   SOLUTION: Brier score = on-chain      │
│            unverifiable           │              verifiable skill           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Core Innovation: Skill-Gated Capital

```rust
// BeRight's tier system creates a SKILL MARKETPLACE
PoolTier::StarterSol => {
    capacity: 5 SOL,
    max_brier: 0.35,  // Anyone with basic skill
    min_predictions: 10
}

PoolTier::EliteSol => {
    capacity: 500 SOL,
    max_brier: 0.20,  // Top-tier forecaster (rare)
    min_predictions: 250
}

// Capital FLOWS to skill
// Better Brier → Bigger pool → More earnings
```

### Competitive Moat

1. **On-Chain Skill Verification** - Brier scores are immutable, non-fakeable
2. **Integrated Execution Stack** - Jupiter, Polymarket, Kalshi connectors
3. **Forecaster Network** - Switching costs (reputation stays on BeRight)

---

## 6. Capital Flow Architecture

### How Capital Enters The System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CAPITAL INFLOW SEQUENCE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   STEP 1: Delegator Discovery                                              │
│   ─────────────────────────────                                             │
│                                                                             │
│   Delegator browses forecaster leaderboard:                                │
│   ┌────────────────────────────────────────────────────────────────┐       │
│   │  FORECASTER      │ BRIER │ WIN% │ TVL      │ 30D RETURN │ APY  │       │
│   │──────────────────│───────│──────│──────────│────────────│──────│       │
│   │  @superforecaster│ 0.18  │ 72%  │ 450 SOL  │ +12.4%     │ 148% │       │
│   │  @alphahunter    │ 0.22  │ 68%  │ 280 SOL  │ +8.2%      │ 98%  │       │
│   │  @politicsquant  │ 0.24  │ 65%  │ 120 SOL  │ +6.1%      │ 73%  │       │
│   └────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│   STEP 2: Delegation Transaction                                           │
│   ──────────────────────────────                                            │
│                                                                             │
│   delegator_wallet ──── 10 SOL ────▶ pool_vault                            │
│                                           │                                 │
│                                           ▼                                 │
│                                    ┌─────────────┐                          │
│                                    │ SHARE CALC  │                          │
│                                    │             │                          │
│                                    │ shares =    │                          │
│                                    │ amount /    │                          │
│                                    │ share_price │                          │
│                                    │             │                          │
│                                    │ 10 SOL /    │                          │
│                                    │ 1.15 =      │                          │
│                                    │ 8.7 shares  │                          │
│                                    └─────────────┘                          │
│                                           │                                 │
│                                           ▼                                 │
│   delegation_pda ◀──── 8.7 shares credited                                 │
│                                                                             │
│   STEP 3: Capital Routing (Immediate)                                      │
│   ────────────────────────────────────                                      │
│                                                                             │
│   10 SOL deposit                                                           │
│       │                                                                     │
│       ├──── 1 SOL (10%) ────▶ RESERVE (instant withdrawals)               │
│       │                                                                     │
│       ├──── 3 SOL (30%) ────▶ PREDICTION_READY (for forecaster)           │
│       │                                                                     │
│       └──── 6 SOL (60%) ────▶ YIELD_GENERATION                            │
│                                   │                                         │
│                                   ├──── 3 SOL ──▶ Marginfi (lending)       │
│                                   ├──── 2 SOL ──▶ Meteora Vault            │
│                                   └──── 1 SOL ──▶ Sanctum INF              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Capital Allocation Buckets

```
Total Pool Capital: 100%
├── RESERVE (10%)
│   └── Native SOL/USDC in vault for instant withdrawals
│
├── ACTIVE_PREDICTIONS (30%)
│   └── Deployed to prediction markets (YES/NO tokens)
│       │
│       └── PREDICTION_TOKEN_YIELD (50% of active)
│           ├── Meteora DLMM LP: 10-30% APY
│           ├── Gondor borrow: 5-8% APY
│           └── Outcome token AMM LP: 15-40% APY
│
├── IDLE_YIELD_GENERATION (50%)
│   ├── Marginfi: 40% of idle (5-8% APY)
│   ├── Meteora: 30% of idle (4-6% APY)
│   ├── Sanctum: 20% of idle (9-12% APY)
│   └── Kamino: 10% of idle (4-7% APY)
│
└── LEVERAGE_BUFFER (10%)
    └── Collateral for leveraged predictions (Marginfi)

YIELD SOURCES SUMMARY:
┌─────────────────────────────────────────────────────────────────────────────┐
│  Capital Type         │ % of Pool │ Yield Source              │ APY       │
│─────────────────────────────────────────────────────────────────────────────│
│  Reserve              │ 10%       │ None (liquidity)          │ 0%        │
│  Active Predictions   │ 30%       │ Prediction profits        │ Variable  │
│  ├─ Token Yield       │ (15%)     │ LP/Lending on YES/NO      │ 10-30%    │
│  Idle Capital         │ 50%       │ DeFi lending/vaults       │ 5-10%     │
│  Leverage Buffer      │ 10%       │ Marginfi collateral       │ 0%*       │
│─────────────────────────────────────────────────────────────────────────────│
│  * Leverage buffer earns when not actively borrowed                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Pool Mechanics

### Pool State Machine

```rust
pub struct ForecastPool {
    // Identity
    pub forecaster: Pubkey,
    pub tier: PoolTier,

    // Capital Tracking
    pub total_value: u64,
    pub total_shares: u64,
    pub share_price: u64,           // NAV per share (scaled 1e9)

    // Allocation State
    pub available_liquidity: u64,   // Ready for predictions
    pub deployed_to_defi: u64,      // In yield protocols
    pub active_predictions: u64,    // Currently in markets
    pub reserve_balance: u64,       // For instant withdrawals

    // Performance
    pub total_profit: u64,
    pub total_loss: u64,
    pub prediction_count: u32,
    pub wins_count: u32,
}
```

### Pool Invariants

```
1. total_value = available_liquidity
               + deployed_to_defi
               + active_predictions
               + prediction_token_yield   // NEW: Yield from LP'd YES/NO tokens
               + reserve_balance

2. share_price = total_value * 1e9 / total_shares

3. reserve_balance >= total_value * RESERVE_PCT (10%)

4. active_predictions <= total_value * MAX_PREDICTION_PCT (40%)

5. single_prediction <= total_value * MAX_SINGLE_POSITION (20%)

6. active_predictions_total = position_value + accrued_token_yield  // NEW
```

### Prediction Token Yield (Innovation)

**Key Insight:** When the pool buys YES or NO tokens, those tokens sit in the wallet waiting for resolution. This is "dead capital" - but it doesn't have to be.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PREDICTION TOKEN YIELD GENERATION                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   TRADITIONAL FLOW (Capital sits idle):                                    │
│   ─────────────────────────────────────                                     │
│                                                                             │
│   Pool USDC ──▶ Buy YES tokens ──▶ Hold in wallet ──▶ Wait for resolution  │
│                                         │                                   │
│                                         └── EARNING NOTHING                │
│                                                                             │
│   OPTIMIZED FLOW (Tokens earn yield):                                      │
│   ───────────────────────────────────                                       │
│                                                                             │
│   Pool USDC ──▶ Buy YES tokens ──▶ Deploy to yield ──▶ Earn while waiting │
│                                         │                                   │
│                                         ├── Meteora YES/NO DLMM pools      │
│                                         ├── Gondor (borrow against)        │
│                                         ├── Prediction market AMM LP       │
│                                         └── Outcome token lending          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Strategy 1: Meteora DLMM for Prediction Tokens

```
If Meteora has a YES/USDC or YES/NO liquidity pool:

Pool holds: 10,000 YES tokens (from prediction)
           + 5,000 USDC (additional liquidity)

Deploy to: Meteora DLMM YES/USDC pool

Earn:
• Trading fees (0.1-0.5% per swap)
• LP rewards (if incentivized)
• Concentrated liquidity premium

Risk:
• Impermanent loss if price moves
• Must withdraw before resolution
• Liquidity depth requirements
```

#### Strategy 2: Borrow Against Tokens (Gondor-style)

```
Pool holds: 10,000 YES tokens worth $5,500 (at $0.55 each)

Deposit to: Lending protocol (like Gondor)
Borrow:     $2,750 USDC (50% LTV)

Deploy borrowed USDC to:
• Marginfi lending (5-8% APY)
• Another prediction (compounding)
• Meteora stable vaults

Net effect:
• Original YES position maintained
• Additional yield on borrowed capital
• Must repay before resolution
```

#### Strategy 3: Outcome Token AMM LP

```
For prediction markets with AMM (not CLOB):

Pool holds: YES tokens + NO tokens (hedged position)

Provide liquidity to:
• Market's native AMM pool
• Earn trading fees from other traders
• Auto-rebalance exposure

Best for:
• Markets with high trading volume
• Delta-neutral strategies
• Extended time to resolution
```

#### Yield Calculation Update

```rust
pub struct ActivePrediction {
    pub position_value: u64,          // Value of YES/NO tokens
    pub tokens_in_yield: u64,         // Tokens deployed to yield
    pub yield_protocol: YieldProtocol,
    pub accrued_yield: u64,           // Yield earned while waiting
    pub yield_apy: u64,               // Current APY (basis points)
}

// Total prediction value includes yield
fn calculate_prediction_value(prediction: &ActivePrediction) -> u64 {
    prediction.position_value + prediction.accrued_yield
}

// Example:
// Position: 10,000 YES @ $0.55 = $5,500
// Deployed to Meteora LP
// After 30 days @ 15% APY: $5,500 × 0.15 × (30/365) = $67.81
// Total value: $5,567.81
```

#### Risk Management for Token Yield

```
RULES:
1. Max 50% of position tokens can be deployed to yield
2. Must maintain instant-withdraw capability for 50%
3. Auto-recall 7 days before expected resolution
4. Only whitelisted yield protocols
5. Circuit breaker if IL > 5%

WHITELISTED PROTOCOLS:
• Meteora DLMM (verified pools only)
• Gondor (when live)
• Native prediction market AMM
• BeRight-operated lending pools (future)
```

### Operations Matrix

| Operation | Who | Effect on Pool State |
|-----------|-----|---------------------|
| **DEPOSIT** | Delegator | total_value ↑, total_shares ↑, routes to buckets |
| **WITHDRAW** | Delegator | total_value ↓, total_shares ↓, pulls from reserve → yield → available |
| **OPEN_PREDICTION** | Forecaster | available_liquidity ↓, active_predictions ↑ |
| **CLOSE_PREDICTION** | Forecaster/Keeper | If WIN: total_value ↑, triggers 50/30/20 split |
| **HARVEST_YIELD** | Keeper | Pulls from DeFi, total_value ↑, share_price ↑ |
| **REBALANCE** | Keeper | Moves capital between allocation buckets |

---

## 8. Platform Integrations

### Integration Architecture

```
                           ┌─────────────────────┐
                           │    BERIGHT POOL     │
                           │      ROUTER         │
                           └──────────┬──────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
          ▼                           ▼                           ▼
  ┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
  │  YIELD LAYER      │     │  PREDICTION LAYER │     │  LEVERAGE LAYER   │
  │  (Idle Capital)   │     │  (Active Trading) │     │  (Amplification)  │
  └─────────┬─────────┘     └─────────┬─────────┘     └─────────┬─────────┘
            │                         │                         │
    ┌───────┴───────┐         ┌───────┴───────┐         ┌───────┴───────┐
    │ • Marginfi    │         │ • Polymarket  │         │ • Marginfi    │
    │ • Meteora     │         │ • Kalshi      │         │   (borrow)    │
    │ • Sanctum     │         │ • Jupiter     │         │ • Kamino      │
    │ • Kamino      │         │ • Manifold    │         │   (multiply)  │
    └───────────────┘         └───────────────┘         │ • Drift       │
                                                        │   (perps)     │
                                                        └───────────────┘
```

### Platform Specifications

#### Marginfi

```
Purpose: Lending (yield) + Borrowing (leverage)
Program: MrgnLendProgram (mainnet)

Key Instructions:
• marginfi_deposit(amount) → Earn yield
• marginfi_withdraw(amount) → Redeem + yield
• marginfi_borrow(amount) → Leverage capital

APY: 5-8% (USDC), 3-6% (SOL)
LTV: 80% (USDC), 75% (SOL)

BeRight Usage:
• Idle capital → marginfi_deposit → Earn yield
• Before prediction → marginfi_borrow → Leverage capital
```

#### Meteora

```
Purpose: Dynamic Vaults (auto-compounding) + DLMM
Programs: meteora_dlmm_vault_program, meteora_dlmm_program

Key Instructions:
• vault_deposit(amount) → Receive LP tokens
• vault_withdraw(lp_amount, min_out) → Underlying + yield
• harvest_yield() → Auto-compounds

APY: 4-6% (stable vaults), 20-80% (volatile DLMM)

BeRight Usage:
• Idle USDC → Stable vault (USDC-USDT) → Low-risk yield
```

#### Sanctum

```
Purpose: LST aggregation (INF token)
Program: sanctum_infinity_program

Key Instructions:
• stake_sol(amount) → Receive INF
• unstake_inf(amount) → Receive SOL

APY: 9-12% (staking + trading fees)
Instant Unstake Fee: 0.1-0.3% (dynamic)

BeRight Usage:
• SOL pools → Convert idle SOL to INF for enhanced yield
```

#### Kamino

```
Purpose: Automated Liquidity Vaults + Multiply (leverage)
Programs: kamino_lending_program, kamino_vault_program

Key Instructions:
• k_lend_deposit(amount) → Lending pool
• multiply_deposit(amount, leverage) → Leveraged LP

APY: 4-7% (lending), 15-100% (multiply)
Leverage: 2x-5x

BeRight Usage:
• Conservative pools → K-Lend only
• Aggressive pools → Multiply for extra yield
```

#### Drift

```
Purpose: Perpetual futures (hedging + leverage)
Program: drift_program_v2

Key Instructions:
• deposit_collateral(amount) → Fund margin
• place_perp_order(market, size, direction, leverage)
• close_position(market_index) → Realize P&L

Leverage: 1x-20x
Markets: BTC, ETH, SOL, 20+ others

BeRight Usage:
• Hedge prediction exposure
• Amplify directional bets based on prediction signals
```

---

## 9. Yield Generation Formulas

### Revenue Stream #1: Prediction Profits

```
prediction_profit = (exit_price - entry_price) × position_size

Example:
• Buy YES @ $0.55 with 1,000 USDC
• Market resolves YES (pays $1.00)
• Shares held: 1,000 / 0.55 = 1,818
• Gross profit: (1.00 - 0.55) × 1,818 = $818
• Less platform fees (2% Polymarket): $802

Expected Monthly (Elite Forecaster):
• Brier score: 0.20
• Win rate: ~72%
• Average edge: 8-12%
• Monthly return on active capital: 8-15%
```

### Revenue Stream #2: DeFi Yield on Idle Capital

```
idle_yield = Σ(allocation_i × apy_i) for each protocol i

Default Allocation:
┌─────────────────────────────────────────────────────────────┐
│ Protocol       │ Allocation │ APY     │ Contribution       │
│───────────────────────────────────────────────────────────────│
│ Marginfi USDC  │ 40%        │ 6.0%    │ 2.40%              │
│ Meteora Stable │ 30%        │ 5.0%    │ 1.50%              │
│ Sanctum INF    │ 20%        │ 10.0%   │ 2.00%              │
│ Reserve        │ 10%        │ 0.0%    │ 0.00%              │
│───────────────────────────────────────────────────────────────│
│ TOTAL          │ 100%       │         │ 5.90%              │
└─────────────────────────────────────────────────────────────┘

If 60% of pool is idle capital:
Pool yield contribution = 60% × 5.90% = 3.54% APY
```

### Revenue Stream #3: Prediction Token Yield (NEW)

```
YES/NO tokens earn yield while waiting for resolution:

Strategies:
┌─────────────────────────────────────────────────────────────────────────────┐
│ Strategy              │ APY      │ Risk     │ Best For                     │
│─────────────────────────────────────────────────────────────────────────────│
│ Meteora DLMM LP       │ 10-30%   │ Medium   │ High-volume markets          │
│ Gondor Borrow         │ 5-8%     │ Low      │ Long-dated positions         │
│ AMM LP (YES/NO)       │ 15-40%   │ Medium   │ Delta-neutral strategies     │
│ Outcome Token Lending │ 3-6%     │ Low      │ Any position                 │
└─────────────────────────────────────────────────────────────────────────────┘

Example:
• Pool holds: 10,000 YES tokens @ $0.55 = $5,500
• Deploy 50% to Meteora DLMM: 5,000 tokens
• APY: 15%
• Hold time: 45 days

Yield = $2,750 × 0.15 × (45/365) = $50.89
Total position value: $5,500 + $50.89 = $5,550.89

Impact on Pool:
• Adds ~1-3% APY on active prediction capital
• Compounds with prediction profits
• Reduces effective cost basis
```

### Revenue Stream #4: Leverage Premium

```
When forecaster uses leverage:
• Borrow from Marginfi at X% APR
• Deploy to prediction at Y% expected return
• Net = Y - X (if Y > X, leverage is profitable)

Example:
• Pool has 100 SOL
• Forecaster wants 50 SOL position (high conviction)
• Borrow 25 SOL from Marginfi (collateralized by 50 SOL)
• Total position: 75 SOL
• If prediction wins: 75 × profit_pct (amplified)
• Cost: 25 SOL × 10% APR × (hold_days/365)
```

### Master Yield Formula

```
TOTAL_POOL_YIELD =
    (active_capital_pct × prediction_return × win_rate)
  + (idle_capital_pct × blended_defi_apy)
  + (active_capital_pct × prediction_token_yield_apy)    // NEW: Token yield
  + (leveraged_capital × leverage_multiplier × prediction_return - borrow_cost)
  + (arbitrage_opportunities × arb_profit × pool_share)

Example (Elite Pool, 500 SOL):
├── Active Capital: 35% (175 SOL in predictions)
├── Idle Capital: 55% (275 SOL in DeFi @ 5.9%)
└── Reserve: 10% (50 SOL)

Monthly P&L:
• Prediction profits: 47.6 SOL (after wins/losses)
• Idle capital yield: 1.35 SOL (275 SOL @ 5.9%)
• Prediction token yield: 2.19 SOL (175 SOL × 50% deployed @ 15% APY)
• TOTAL: 51.14 SOL (10.2% monthly, 122.7% APY)

After 50/30/20 Split (on prediction profits only):
• Forecaster (50%): 23.80 SOL
• Delegators (30%): 14.28 SOL + 3.54 SOL yields = 17.82 SOL
• Platform (20%): 9.52 SOL

Delegator APY: ~42.8% (prediction share + all yield income)

KEY INSIGHT: Prediction token yield adds ~4-5% APY to delegator returns!
```

---

## 10. Leverage Mechanism

### How Leverage Works Before Prediction Entry

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LEVERAGE FLOW: HIGH-CONVICTION PREDICTION                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Pool State Before:                                                        │
│   • Total Value: 100 SOL                                                   │
│   • Available Liquidity: 30 SOL                                            │
│   • In DeFi Protocols: 60 SOL                                             │
│   • Reserve: 10 SOL                                                        │
│                                                                             │
│   STEP 1: Forecaster initiates prediction                                  │
│   ─────────────────────────────────────────                                 │
│                                                                             │
│   open_prediction({                                                        │
│     market: "Biden wins 2024",                                             │
│     side: YES,                                                              │
│     confidence: 0.85,        // 85% confident                              │
│     desired_size: 20 SOL,    // 20% of pool                               │
│     use_leverage: true,                                                    │
│     max_leverage: 1.5                                                      │
│   })                                                                        │
│                                                                             │
│   STEP 2: Calculate leverage parameters                                    │
│   ──────────────────────────────────────                                    │
│                                                                             │
│   max_leverage_for_tier = match tier {                                     │
│     Starter => 1.0,    // No leverage                                      │
│     Basic   => 1.25,   // 25% extra                                        │
│     Pro     => 1.5,    // 50% extra                                        │
│     Elite   => 2.0,    // 100% extra (2x)                                  │
│   };                                                                        │
│                                                                             │
│   confidence_multiplier = (confidence - 0.5) * 2;  // 0.85 → 0.70         │
│   effective_leverage = 1.0 + (max_leverage - 1.0) * confidence_multiplier;│
│   // For 0.85 confidence, Elite tier: 1.70x                               │
│                                                                             │
│   STEP 3: Execute leverage via Marginfi                                   │
│   ──────────────────────────────────────                                    │
│                                                                             │
│   base_capital = 20 SOL                                                    │
│   leverage = 1.70x                                                          │
│   borrowed_amount = 20 × 0.70 = 14 SOL                                    │
│   total_position = 20 + 14 = 34 SOL                                       │
│                                                                             │
│   Transaction sequence:                                                    │
│   1. Recall 14 SOL from Meteora (for collateral)                          │
│   2. Deposit 28 SOL to Marginfi as collateral                             │
│   3. Borrow 14 SOL from Marginfi                                          │
│   4. Execute prediction with 34 SOL total                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Leverage Risk Controls

```
1. MAX_LEVERAGE_BY_TIER
   ┌──────────────────────────────────────────┐
   │ Tier    │ Max Leverage │ Max Debt/Pool  │
   │─────────────────────────────────────────────│
   │ Starter │ 1.0x (none)  │ 0%             │
   │ Basic   │ 1.25x        │ 5%             │
   │ Pro     │ 1.5x         │ 10%            │
   │ Elite   │ 2.0x         │ 15%            │
   └──────────────────────────────────────────┘

2. CONFIDENCE_GATING
   • Leverage only if confidence >= 0.70
   • Full leverage only at confidence >= 0.90

3. BRIER_SCORE_THROTTLE
   • Leverage disabled if recent Brier > tier threshold

4. UTILIZATION_LIMIT
   • Max 50% of DeFi capital can be recalled

5. LIQUIDATION_BUFFER
   • Marginfi LTV: 75% max, we target 50%
   • 25% buffer before liquidation risk
```

---

## 11. Share Token Composability

### Phase 1: Internal Shares (Current)

```rust
// Shares are PDAs, non-transferable
Delegation {
    pool: Pubkey,
    delegator: Pubkey,
    shares: u64,
    deposited_amount: u64,
    current_value: shares × pool.share_price,
}
```

### Phase 2: Transferable Pool Tokens

```rust
// Each pool creates SPL token mint
pool_token_mint = create_mint(
    authority: pool_pda,
    decimals: 9,
    symbol: "brPOOL-{forecaster_handle}"
);

// On deposit, mint tokens
deposit(amount) {
    shares = calculate_shares(amount);
    mint_to(delegator_ata, shares);
}

// On withdraw, burn tokens
withdraw(shares) {
    amount = calculate_withdrawal(shares);
    burn(delegator_ata, shares);
    transfer(amount - fees, delegator);
}
```

**Benefits:**
- Transfer shares between wallets
- Trade on DEXs (Raydium, Orca)
- Use as collateral in DeFi

### Phase 3: brSOL / brUSDC (Aggregated LST)

```
                     ┌─────────────────┐
                     │     brSOL       │
                     │  (Aggregated)   │
                     └────────┬────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ Elite Pool A  │     │ Pro Pool B    │     │ Pro Pool C    │
│ Brier: 0.18   │     │ Brier: 0.22   │     │ Brier: 0.24   │
│ Weight: 40%   │     │ Weight: 35%   │     │ Weight: 25%   │
└───────────────┘     └───────────────┘     └───────────────┘

Allocation Formula:
weight_i = (0.35 - brier_i) / Σ(0.35 - brier_j)
// Lower Brier = higher weight = more capital
```

### DeFi Integrations for brSOL

| Integration | Protocol | Use Case |
|-------------|----------|----------|
| **Collateral** | Marginfi | Borrow USDC against brSOL |
| **LP** | Raydium/Orca | brSOL/SOL pool for instant swaps |
| **Margin** | Drift | Use brSOL as perp margin |
| **Leverage** | Kamino Multiply | 2-3x brSOL exposure |

---

## 12. Resolution & Distribution (50/30/20)

### Complete Resolution Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PREDICTION RESOLUTION & PROFIT DISTRIBUTION               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   STEP 1: Detect Resolution                                                │
│   ─────────────────────────                                                  │
│   Keeper or forecaster triggers:                                           │
│   resolve_pool_prediction({                                                │
│     pool: pool_pubkey,                                                     │
│     prediction_index: 3,                                                   │
│     won: true,                                                             │
│     exit_price: 1_000_000,     // $1.00                                   │
│     realized_amount: 61_818,   // USDC received                           │
│   })                                                                        │
│                                                                             │
│   STEP 2: Calculate P&L                                                    │
│   ─────────────────────                                                      │
│   prediction = {                                                            │
│     amount: 34_000,           // Position size                             │
│     entry_price: 550_000,     // Bought @ $0.55                           │
│     borrowed: 14_000,         // Leverage from Marginfi                   │
│     borrow_cost: 140,         // Interest accrued                         │
│   };                                                                        │
│                                                                             │
│   shares_held = 34_000 / 0.55 = 61,818                                     │
│   gross_payout = 61,818 × $1.00 = 61,818 USDC                             │
│   gross_profit = 61,818 - 34,000 = 27,818 USDC                            │
│   platform_fee = 27,818 × 0.02 = 556 USDC (Polymarket)                    │
│   borrow_cost = 140 USDC                                                   │
│   net_profit = 27,818 - 556 - 140 = 27,122 USDC                           │
│                                                                             │
│   STEP 3: Repay Leverage                                                   │
│   ──────────────────────                                                    │
│   marginfi.repay(14,140 USDC);     // Principal + interest                │
│   marginfi.withdraw(28,000 USDC);  // Collateral                          │
│                                                                             │
│   STEP 4: Apply 50/30/20 Split                                            │
│   ───────────────────────────                                               │
│                                                                             │
│   net_profit = 27,122 USDC                                                 │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────┐          │
│   │                                                             │          │
│   │   FORECASTER (50%): 13,561 USDC                            │          │
│   │   └── Direct transfer to forecaster wallet                 │          │
│   │                                                             │          │
│   │   DELEGATORS (30%): 8,137 USDC                             │          │
│   │   └── Added to pool total_value (increases share_price)   │          │
│   │                                                             │          │
│   │   PLATFORM (20%): 5,424 USDC                               │          │
│   │   └── Transfer to platform treasury PDA                   │          │
│   │                                                             │          │
│   └─────────────────────────────────────────────────────────────┘          │
│                                                                             │
│   STEP 5: Update Pool State                                                │
│   ─────────────────────────                                                 │
│                                                                             │
│   BEFORE: pool.total_value = 100,000, share_price = 1.000                 │
│   AFTER:  pool.total_value = 108,137, share_price = 1.081 (+8.1%)         │
│                                                                             │
│   pool.wins_count += 1                                                     │
│   pool.forecaster_earnings += 13,561                                       │
│   pool.platform_earnings += 5,424                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Loss Scenario

```
On LOSS: No profit to split

FORECASTER: $0 (no profit, no payment)
PLATFORM: $0 (no profit, no fee)
DELEGATORS: -20,140 USDC (pool value decreases)

// Pool state update:
pool.total_value -= loss_amount;
pool.update_share_price();
pool.losses_count += 1;

// Share price impact:
BEFORE: 100,000 USDC / 100,000 shares = 1.000
AFTER:  79,860 USDC / 100,000 shares = 0.799 (-20%)
```

**Key Insight:** Delegators bear 100% of losses but only get 30% of profits. This asymmetry compensates forecasters for skill (like hedge fund 2/20).

---

## 13. Prediction Decision System

### Who Can Make Predictions

Only the pool's forecaster can make predictions. Enforced on-chain:

```rust
#[account(
    constraint = forecaster.key() == pool.forecaster
        @ StakingPoolError::Unauthorized
)]
pub forecaster: Signer<'info>,
```

### Validation Checks

```rust
function validate_prediction(pool, params) {
    // CHECK 1: Pool is active
    require(pool.status == Active);

    // CHECK 2: Position size within limits (1-20% of pool)
    let max = pool.total_value * 20 / 100;
    let min = pool.total_value * 1 / 100;
    require(params.amount >= min && params.amount <= max);

    // CHECK 3: Sufficient liquidity
    require(pool.available_liquidity >= params.amount);

    // CHECK 4: Max open positions (e.g., 10)
    require(pool.open_predictions < 10);

    // CHECK 5: Max total exposure (40%)
    require(pool.active_predictions + params.amount
        <= pool.total_value * 40 / 100);

    // CHECK 6: Forecaster still calibrated
    let forecaster = get_calibration(pool.forecaster);
    require(forecaster.avg_brier <= pool.tier.max_brier());

    // CHECK 7: Valid platform
    require(is_valid_platform(params.platform));
}
```

### Settlement & Fraud Prevention

**Settlement Sources:**
- Polymarket: UMA Optimistic Oracle
- Kalshi: CFTC-regulated resolution
- Jupiter: Keeper network aggregation

**Fraud Prevention:**
1. **On-Chain Proof** - Resolution tx verifiable
2. **Token Redemption** - Win = $1, Loss = $0 (provable)
3. **Keeper Validation** - Decentralized monitoring
4. **Calibration Link** - Every pool prediction mirrored in calibration program

---

## 14. Complete System Architecture

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     BERIGHT PROTOCOL ARCHITECTURE                                  │
│                                  "A Decentralized Forecaster Network"                              │
├───────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                   │
│   USER LAYER                                                                                      │
│   ──────────                                                                                      │
│   ┌───────────────┐    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐              │
│   │  DELEGATORS   │    │  FORECASTERS  │    │   KEEPERS     │    │   PROJECTS    │              │
│   │ • Provide     │    │ • Provide     │    │ • Monitor     │    │ • Stake on    │              │
│   │   capital     │    │   skill       │    │   markets     │    │   milestones  │              │
│   │ • Earn 30%    │    │ • Earn 50%    │    │ • Execute     │    │ • Build       │              │
│   └───────┬───────┘    └───────┬───────┘    └───────┬───────┘    └───────┬───────┘              │
│           │                    │                    │                    │                       │
│           ▼                    ▼                    ▼                    ▼                       │
│   BERIGHT CORE LAYER                                                                             │
│   ──────────────────                                                                             │
│   ┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐               │
│   │  CALIBRATION PROGRAM  │  │    STAKING POOL       │  │   CONVICTION ESCROW   │               │
│   │  GDMJpNck...          │◀─│    Fkb7q8pb...        │─▶│   E6Gp6fzv...         │               │
│   │  • Brier scores       │  │  • Forecaster pools   │  │  • Project stakes     │               │
│   │  • Predictions        │  │  • Delegations        │  │  • Binary markets     │               │
│   │  • Resolution         │  │  • 50/30/20 split     │  │  • Resolution         │               │
│   └───────────────────────┘  └───────────┬───────────┘  └───────────────────────┘               │
│                                          │                                                       │
│   CAPITAL ALLOCATION LAYER               │                                                       │
│   ────────────────────────               ▼                                                       │
│   ┌─────────────────────────────────────────────────────────────────────────────────────┐       │
│   │                              POOL CAPITAL ROUTER                                    │       │
│   │                                                                                     │       │
│   │   ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐   │       │
│   │   │  RESERVE (10%) │  │  ACTIVE (30%)  │  │  YIELD (50%)   │  │ LEVERAGE (10%) │   │       │
│   │   │  Instant exits │  │  Predictions   │  │  DeFi yield    │  │  Amplification │   │       │
│   │   └────────────────┘  └────────────────┘  └────────────────┘  └────────────────┘   │       │
│   └─────────────────────────────────────────────────────────────────────────────────────┘       │
│                    │                                              │                              │
│                    ▼                                              ▼                              │
│   ┌─────────────────────────────────────┐   ┌─────────────────────────────────────┐            │
│   │        PREDICTION MARKETS           │   │          YIELD PROTOCOLS            │            │
│   │  ┌──────────┐ ┌──────────┐ ┌──────┐ │   │  ┌──────────┐ ┌──────────┐ ┌──────┐ │            │
│   │  │POLYMARKET│ │  KALSHI  │ │JUPPRE│ │   │  │ MARGINFI │ │ METEORA  │ │SANCTU│ │            │
│   │  └──────────┘ └──────────┘ └──────┘ │   │  └──────────┘ └──────────┘ └──────┘ │            │
│   └─────────────────────────────────────┘   └─────────────────────────────────────┘            │
│                                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Component Summary

| Component | Purpose | Revenue | Risk |
|-----------|---------|---------|------|
| **Calibration** | Skill verification | None | None |
| **Staking Pool** | Capital routing | 20% of profits | Forecaster skill |
| **Conviction** | Project stakes | 1% resolution | Project fraud |
| **Marginfi** | Yield + Leverage | Spread | Smart contract |
| **Meteora** | Vault yield | LP fees | IL risk |
| **Polymarket** | Predictions | Profits | Market resolution |

---

## 15. Implementation Roadmap

### Phase 1: Core (Weeks 1-4)
- [ ] Complete ForecastPool with deposit/withdraw
- [ ] Implement 50/30/20 profit distribution
- [ ] Link to CalibrationProgram for tier verification
- [ ] Manual prediction open/close
- [ ] Basic UI for pool creation and staking

### Phase 2: Yield Layer (Weeks 5-8)
- [ ] Marginfi CPI integration (deposit/withdraw)
- [ ] Meteora vault integration
- [ ] Auto-routing of idle capital
- [ ] Yield harvesting keepers
- [ ] Reserve pool management

### Phase 3: Leverage (Weeks 9-12)
- [ ] Marginfi borrow integration
- [ ] Confidence-gated leverage tiers
- [ ] Collateral management
- [ ] Liquidation protection
- [ ] Dynamic leverage based on Brier score

### Phase 4: Share Tokens (Weeks 13-16)
- [ ] SPL token minting for pool shares
- [ ] DEX liquidity (brPOOL/SOL pools)
- [ ] Oracle integration for share price
- [ ] Secondary market trading

### Phase 5: brSOL (Weeks 17-20)
- [ ] Aggregation layer across top pools
- [ ] Weighted allocation by Brier score
- [ ] Marginfi collateral listing
- [ ] DeFi composability suite

---

## 16. Monetization Strategy

### Current Revenue Streams

| Stream | Fee | Trigger |
|--------|-----|---------|
| Prediction Profits | 20% | When forecaster wins |
| Pool Creation | 0.1 SOL | One-time |
| Withdrawal | 0.5% | Normal exit |
| Early Exit | 2% | < 7 days staked |

### Enhanced Revenue Streams

| Stream | Fee | Source |
|--------|-----|--------|
| Prediction Profits | 20% | Winning predictions |
| AUM Fee | 0.5%/year | Total value locked |
| Idle Yield Share | 30% | DeFi yield on idle capital |
| brSOL Trading | 10% | Trading fees from brSOL swaps |
| Conviction Markets | 1% | Resolution fee |
| API/Data | $99-999/mo | Forecaster signals |

### Revenue Projections

```
Year 1 (200 pools, $1.5M TVL):
├── Prediction profits (20%): ~$170K
├── Pool creation: ~$3K
├── Withdrawals: ~$7K
├── Idle yield (30%): ~$27K
└── TOTAL: ~$207K/year

Year 3 (1,000 pools, $15M TVL):
├── Prediction profits: ~$1.7M
├── AUM fees: ~$75K
├── Idle yield: ~$270K
├── brSOL trading: ~$50K
└── TOTAL: ~$2.1M/year
```

---

## Appendix A: Key Formulas

### Share Price Calculation
```
share_price = total_pool_value * 1e9 / total_shares
```

### Deposit Shares
```
shares_minted = deposit_amount * 1e9 / share_price
```

### Withdrawal Amount
```
withdrawal_amount = shares * share_price / 1e9
```

### Brier Score
```
brier_score = (predicted_probability - actual_outcome)^2
// Range: 0 (perfect) to 1 (worst)
```

### Profit Distribution
```
forecaster_share = net_profit * 5000 / 10000  // 50%
delegator_share  = net_profit * 3000 / 10000  // 30%
platform_share   = net_profit * 2000 / 10000  // 20%
```

### Leverage Calculation
```
max_leverage = tier_max * confidence_multiplier
confidence_multiplier = (confidence - 0.5) * 2
borrowed_amount = base_capital * (effective_leverage - 1)
```

### Idle Yield Blend
```
blended_apy = Σ(allocation_i * apy_i) for all protocols
pool_yield_contribution = idle_capital_pct * blended_apy
```

---

## Appendix B: Account Structures

### ForecastPool
```rust
pub struct ForecastPool {
    pub bump: u8,
    pub forecaster: Pubkey,
    pub tier: PoolTier,
    pub token_mint: Pubkey,
    pub vault: Pubkey,
    pub total_value: u64,
    pub total_shares: u64,
    pub share_price: u64,
    pub capacity: u64,
    pub available_liquidity: u64,
    pub revenue_split: RevenueSplit,
    pub delegator_count: u32,
    pub prediction_count: u32,
    pub wins_count: u32,
    pub losses_count: u32,
    pub forecaster_earnings: u64,
    pub platform_earnings: u64,
    pub status: ForecastPoolStatus,
    pub created_at: i64,
}
```

### Delegation
```rust
pub struct Delegation {
    pub bump: u8,
    pub pool: Pubkey,
    pub delegator: Pubkey,
    pub shares: u64,
    pub deposited_amount: u64,
    pub deposited_at: i64,
    pub last_claim_at: i64,
}
```

### PoolPrediction
```rust
pub struct PoolPrediction {
    pub bump: u8,
    pub pool: Pubkey,
    pub market_id: [u8; 32],
    pub platform: u8,
    pub side: u8,
    pub amount: u64,
    pub entry_price: u64,
    pub exit_price: u64,
    pub pnl: i64,
    pub status: u8,
    pub opened_at: i64,
    pub closed_at: i64,
}
```

---

## Appendix C: Research Sources

### Solana DeFi Protocols
- Jito Foundation Technical FAQs
- TipRouter Overview
- Marinade State Q4 2025 (Messari)
- Marginfi Documentation
- Meteora DLMM Guide
- Kamino Finance Overview
- Sanctum Infinity Economics

### Prediction Market DeFi
- Gondor Official Documentation
- HyperOdd Testnet
- Polymarket CLOB Documentation
- Prediction Market Making Guide 2026
- AI Agents in Prediction Markets (CoinDesk)

---

*Document Version 1.0 - April 2026*
*BeRight Protocol - A Decentralized Forecaster Network*
