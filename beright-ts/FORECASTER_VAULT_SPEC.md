# BeRight Forecaster Network - Implementation Specification

> **Technical Co-Founder Implementation Plan**
>
> Phase 1: On-Chain Profile + Leaderboard
> Phase 2: Pool Creation + Depositor UI

---

## Executive Summary

We are building a **skill-capital matching protocol** that:
1. Tracks forecaster reputation via on-chain Brier scores
2. Enables capital delegation to proven forecasters
3. Distributes profits: 20% forecaster / 64% delegators / 16% platform

**The moat**: On-chain reputation is non-portable. The longer forecasters build history here, the harder it is to leave.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Phase 1: ForecasterProfile + Leaderboard](#2-phase-1-forecasterprofile--leaderboard)
3. [Phase 2: Pool Creation + Depositor UI](#3-phase-2-pool-creation--depositor-ui)
4. [On-Chain State Design](#4-on-chain-state-design)
5. [API Specification](#5-api-specification)
6. [Database Schema](#6-database-schema)
7. [Frontend Components](#7-frontend-components)
8. [Implementation Sequence](#8-implementation-sequence)
9. [Risk Mitigations](#9-risk-mitigations)

---

## 1. Architecture Overview

### System Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BeRight Forecaster Network                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  LAYER 1: Platform (Infrastructure)                                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  • Solana Programs (ForecasterProfile, ForecastPool)        │   │
│  │  • Scoring Engine (Brier, Kelly, Sharpe)                    │   │
│  │  • Market Resolution Oracle                                  │   │
│  │  • Fee Collection                                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  LAYER 2: Forecasters (Skill Providers)                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  • On-chain profile with reputation scores                   │   │
│  │  • Prediction history (append-only)                          │   │
│  │  • Pool creation rights (top 10%)                            │   │
│  │  • Hot key delegation                                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  LAYER 3: Delegators (Capital Providers)                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  • Browse leaderboard by "Various Scores"                    │   │
│  │  • Stake USDC to forecaster pools                            │   │
│  │  • Receive proportional profit share                         │   │
│  │  • Claim rewards on settlement                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Prediction Flow:
┌──────────┐    ┌─────────────┐    ┌──────────────┐    ┌──────────┐
│Forecaster│───▶│Record Intent│───▶│Execute Trade │───▶│ Track    │
│ Wallet   │    │(On-Chain)   │    │(DFlow/Jup)   │    │ Position │
└──────────┘    └─────────────┘    └──────────────┘    └──────────┘
                       │                                      │
                       ▼                                      ▼
              ┌─────────────┐                        ┌──────────────┐
              │  Brier      │◀───────────────────────│   Market     │
              │  Update     │                        │  Resolution  │
              └─────────────┘                        └──────────────┘
```

### Existing Code to Leverage

| Existing Module | Location | Reuse Strategy |
|-----------------|----------|----------------|
| Brier scoring | `lib/reputation.ts` | Enhance with Volume-Weighted, Sharpe |
| On-chain commit | `lib/onchain/calibration.ts` | Extend for ForecasterProfile |
| Market data | `lib/dataFabric/` | Use for resolution oracle |
| DFlow execution | `lib/dflow/executor.ts` | Pool trade execution |
| Jupiter Prediction | `lib/jupiter/prediction.ts` | Pool trade execution |
| Vault PDAs | `lib/onchain-vault/index.ts` | Extend for ForecastPool |
| Leaderboard | `lib/leaderboard.ts` | Migrate to DB + API |

---

## 2. Phase 1: ForecasterProfile + Leaderboard

### 2.1 Goals

- Launch ForecasterProfile system (no pools yet)
- Users connect wallets, make predictions on Polymarket/Kalshi/Jupiter through BeRight
- Accumulate on-chain Brier scores
- Build reputation dataset

### 2.2 ForecasterProfile Schema

```typescript
// types/forecaster.ts

export interface ForecasterProfile {
  // Identity
  pubkey: string;              // Wallet address (PDA seed)
  displayName: string | null;
  telegramId: number | null;
  twitterHandle: string | null;

  // Authority
  manager: string;             // Primary authority key
  delegate: string | null;     // Hot key for trading (optional)

  // Reputation Scores ("Various Score")
  scores: {
    brierOverall: number;      // 0-1, lower is better
    brierPolitics: number;
    brierCrypto: number;
    brierSports: number;
    brierMacro: number;
    brierScience: number;

    accuracy: number;          // % of correct direction calls
    calibration: number;       // How well-calibrated (0-1, lower better)
    roi: number;               // Cumulative ROI (can be negative)
    sharpeRatio: number;       // Risk-adjusted return
    kellyCompliance: number;   // Position sizing discipline (0-1)
    skillRating: number;       // Elo-style composite (1000 baseline)

    volumeWeightedBrier: number; // Brier weighted by stake size
  };

  // Volume & Financial Metrics
  metrics: {
    predictionCount: number;
    resolvedCount: number;
    cumulativeVolume: number;      // Total USDC ever wagered
    profitVolume: number;          // Cumulative profit in USDC
    totalAum: number;              // AUM if has pools (Phase 2)
    totalFeesEarned: number;       // Lifetime fees (Phase 2)
  };

  // Ranking
  globalRank: number | null;
  percentile: number | null;       // e.g., 95 = top 5%

  // Status
  tier: 'unranked' | 'rookie' | 'verified' | 'elite' | 'superforecaster';
  badges: string[];
  canCreatePool: boolean;          // Top 10% only

  // Timestamps
  createdAt: string;
  lastPredictionAt: string | null;
  lastActiveAt: string;
}

export interface PredictionRecord {
  id: string;                      // UUID
  forecasterPubkey: string;

  // Market Reference
  marketId: string;
  marketTitle: string;
  platform: 'polymarket' | 'kalshi' | 'jupiter' | 'dflow' | 'manifold';
  domain: 'politics' | 'crypto' | 'sports' | 'macro' | 'science' | 'general';

  // Prediction Details
  direction: 'YES' | 'NO';
  probability: number;             // 0-1, their confidence
  entryPrice: number;              // Price paid per contract
  contracts: number;               // Number of contracts
  stakeUsd: number;                // USDC committed

  // Resolution
  outcome: boolean | null;         // true = YES won, false = NO won, null = unresolved
  exitPrice: number | null;        // Price on exit/resolution
  pnlUsd: number | null;           // Profit/loss in USDC
  brierContribution: number | null; // (probability - outcome)²

  // On-Chain Proof
  intentTxSignature: string | null;  // Prediction intent committed
  executionTxSignature: string | null; // Trade executed
  resolutionTxSignature: string | null; // Resolution recorded

  // Timestamps
  predictedAt: string;
  executedAt: string | null;
  resolvedAt: string | null;
}
```

### 2.3 Scoring Engine

```typescript
// lib/scoring/engine.ts

export interface ScoringEngine {
  /**
   * Brier Score: (forecast - outcome)²
   * Perfect = 0, Worst = 1
   */
  calculateBrier(forecast: number, outcome: 0 | 1): number;

  /**
   * Volume-Weighted Brier: Σ(stake_i × brier_i) / Σ(stake_i)
   * Rewards conviction on correct predictions
   */
  calculateVolumeWeightedBrier(predictions: ResolvedPrediction[]): number;

  /**
   * Kelly Compliance: How close to optimal sizing
   * kelly = (p × b - q) / b where p = win prob, q = 1-p, b = odds
   */
  calculateKellyCompliance(predictions: ResolvedPrediction[]): number;

  /**
   * Sharpe-Equivalent: avg_roi / std_deviation
   * Risk-adjusted performance
   */
  calculateSharpe(predictions: ResolvedPrediction[]): number;

  /**
   * Skill Rating: Elo-style rating updated per resolution
   * Baseline = 1000
   */
  updateSkillRating(currentRating: number, prediction: ResolvedPrediction): number;

  /**
   * Composite Score for ranking
   * Weighted blend of all metrics
   */
  calculateCompositeScore(profile: ForecasterProfile): number;
}

// Scoring weights for composite
export const SCORING_WEIGHTS = {
  brierOverall: 0.25,       // Primary accuracy measure
  volumeWeightedBrier: 0.20, // Conviction-adjusted accuracy
  roi: 0.20,                // Profit generation
  sharpeRatio: 0.15,        // Risk-adjusted returns
  kellyCompliance: 0.10,    // Position sizing discipline
  predictionCount: 0.10,    // Activity (min threshold for ranking)
};
```

### 2.4 Leaderboard Features

```typescript
// Leaderboard query interface
export interface LeaderboardQuery {
  // Filtering
  domain?: 'politics' | 'crypto' | 'sports' | 'macro' | 'science' | 'all';
  tier?: 'elite' | 'superforecaster' | 'verified' | 'all';
  minPredictions?: number;    // Default: 10
  minResolved?: number;       // Default: 5

  // Sorting
  sortBy:
    | 'brierOverall'
    | 'volumeWeightedBrier'
    | 'roi'
    | 'sharpeRatio'
    | 'skillRating'
    | 'cumulativeVolume'
    | 'predictionCount';
  sortOrder: 'asc' | 'desc';

  // Pagination
  limit: number;
  offset: number;

  // Time filtering
  timeframe?: '7d' | '30d' | '90d' | 'all';
}

export interface LeaderboardEntry {
  rank: number;
  forecaster: ForecasterProfile;

  // Highlighted scores (based on sortBy)
  primaryScore: number;

  // Sparkline data (last 30 predictions)
  recentPerformance: {
    predictionDate: string;
    brierContribution: number;
  }[];

  // Badges for quick visual
  badges: ('elite' | 'hot-streak' | 'high-volume' | 'risk-adjusted')[];
}
```

### 2.5 Prediction Flow

```
User Action: "I think Trump wins at 65%"
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│ 1. INTENT CAPTURE                                                 │
│    • Parse prediction intent                                      │
│    • Find matching market (Polymarket/Kalshi/Jupiter)            │
│    • Get current market price                                     │
│    • Calculate implied position size                              │
└──────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│ 2. ON-CHAIN COMMIT (Memo Program)                                 │
│    • Create timestamped prediction memo                           │
│    • Format: "BERIGHT:PREDICT:{market}:{direction}:{prob}"       │
│    • Submit to Solana (immutable proof)                           │
│    • Store txSignature in prediction record                       │
└──────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3. TRADE EXECUTION (Optional - requires stake)                    │
│    • User approves trade in wallet                                │
│    • Execute via DFlow/Jupiter Prediction                         │
│    • Track position in portfolio                                  │
│    • Update prediction record with execution details              │
└──────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│ 4. RESOLUTION MONITORING                                          │
│    • Watch for market close/resolution                            │
│    • Fetch outcome from oracle/API                                │
│    • Calculate Brier contribution                                 │
│    • Update forecaster profile scores                             │
│    • Record resolution on-chain                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Phase 2: Pool Creation + Depositor UI

### 3.1 Goals

- Top 10% forecasters can create vaults
- Depositors browse leaderboard and stake USDC
- Pool executes trades on forecaster's behalf
- Profit distribution on settlement

### 3.2 ForecastPool Schema (Based on Drift Vault)

```typescript
// types/pool.ts

export interface ForecastPool {
  // Identity
  pubkey: string;                  // Pool PDA
  name: string;                    // 32 bytes max
  description: string;             // 256 bytes max

  // Authority
  forecaster: string;              // ForecasterProfile pubkey
  delegate: string | null;         // Hot key for trading

  // Configuration
  category: 'politics' | 'crypto' | 'sports' | 'macro' | 'mixed';
  strategyType: PoolStrategy;

  // Deposit Parameters
  minDeposit: number;              // USDC (e.g., 50)
  maxDeposit: number | null;       // Optional cap per user
  maxTvl: number | null;           // Optional total cap
  lockPeriod: number;              // Seconds (e.g., 7 days = 604800)

  // Fee Parameters
  fees: {
    depositFeeBps: number;         // 0-300 (0-3%)
    managementFeeBps: number;      // Annualized AUM fee (e.g., 200 = 2%)
    performanceFeeBps: number;     // Profit share (e.g., 2000 = 20%)
    hurdleRate: number | null;     // Min return before perf fee (e.g., 0.05 = 5%)
  };

  // State
  status: 'open' | 'active' | 'settling' | 'settled' | 'cancelled';

  // Vault Accounting (from Drift)
  vault: {
    tokenAccount: string;          // USDC vault PDA
    totalShares: bigint;           // Total LP shares outstanding
    userShares: bigint;            // Shares held by depositors
    netDeposits: bigint;           // Deposits - withdrawals
    totalDeposits: bigint;         // Cumulative deposits
    totalWithdraws: bigint;        // Cumulative withdrawals
    lastFeeUpdateTs: number;
    managementFeeAccrued: bigint;
  };

  // Performance Tracking
  performance: {
    navPerShare: number;           // Net Asset Value per share
    cumulativePnl: number;         // Total profit/loss
    activePositions: number;
    closedPositions: number;
    winRate: number;
    avgReturn: number;
  };

  // Timestamps
  createdAt: number;               // Unix timestamp
  activeAt: number | null;         // When trading started
  settlesAt: number;               // Scheduled settlement
  settledAt: number | null;        // Actual settlement

  // On-Chain
  bump: number;                    // PDA bump seed
  vaultBump: number;               // Vault token account bump
}

export type PoolStrategy =
  | 'single_market'      // Focus on one event
  | 'basket'             // Diversified across markets
  | 'arbitrage'          // Arb opportunities
  | 'long_shot'          // Low probability, high return
  | 'conservative'       // High probability, low variance
  | 'momentum'           // Follow price trends
  | 'contrarian';        // Fade consensus

export interface Delegation {
  pubkey: string;                  // Delegation PDA
  pool: string;                    // Pool pubkey
  delegator: string;               // User wallet

  // Position
  sharesOwned: bigint;             // LP shares
  depositedAmount: bigint;         // Original USDC deposited
  depositedAt: number;             // Unix timestamp

  // Withdrawal
  withdrawable: boolean;           // Lock period passed?
  withdrawRequestedAt: number | null;

  // Claim
  claimed: boolean;
  claimedAmount: bigint | null;
  claimedAt: number | null;

  // PDA
  bump: number;
}

export interface PoolPosition {
  pubkey: string;                  // Position PDA
  pool: string;                    // Pool pubkey

  // Market Reference
  marketId: string;
  marketTitle: string;
  platform: 'dflow' | 'jupiter' | 'polymarket';

  // Position Details
  outcomeMint: string;             // YES or NO token mint
  side: 'YES' | 'NO';
  contracts: number;
  avgEntryPrice: number;
  totalCostUsd: number;

  // Status
  status: 'open' | 'closing' | 'closed' | 'redeemed';

  // Resolution
  exitPrice: number | null;
  proceedsUsd: number | null;
  pnlUsd: number | null;

  // Timestamps
  openedAt: number;
  closedAt: number | null;
}
```

### 3.3 Pool Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Pool Lifecycle                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Phase 1: CREATION                                                  │
│  ┌───────────────────────────────────────────────────────┐         │
│  │  • Forecaster calls create_pool()                      │         │
│  │  • Set: name, category, fees, duration, min deposit    │         │
│  │  • Pay 0.1 SOL pool creation fee                       │         │
│  │  • Status: OPEN                                        │         │
│  └───────────────────────────────────────────────────────┘         │
│                         │                                           │
│                         ▼                                           │
│  Phase 2: CAPITAL RAISING (until min TVL or deadline)               │
│  ┌───────────────────────────────────────────────────────┐         │
│  │  • Depositors call stake()                             │         │
│  │  • USDC transferred to pool vault                      │         │
│  │  • LP shares minted to depositor                       │         │
│  │  • Deposit fee collected                               │         │
│  └───────────────────────────────────────────────────────┘         │
│                         │                                           │
│                         ▼                                           │
│  Phase 3: ACTIVE TRADING                                            │
│  ┌───────────────────────────────────────────────────────┐         │
│  │  • Forecaster calls activate_pool()                    │         │
│  │  • Status: ACTIVE                                      │         │
│  │  • Forecaster can open_position() via DFlow/Jupiter    │         │
│  │  • Idle capital → Meteora Dynamic Vault (yield)        │         │
│  │  • Management fee accrues continuously                 │         │
│  │  • No deposits/withdrawals during active phase         │         │
│  └───────────────────────────────────────────────────────┘         │
│                         │                                           │
│                         ▼                                           │
│  Phase 4: SETTLING                                                  │
│  ┌───────────────────────────────────────────────────────┐         │
│  │  • At settles_at timestamp OR forecaster triggers      │         │
│  │  • Status: SETTLING                                    │         │
│  │  • Close all open positions                            │         │
│  │  • Redeem winning tokens                               │         │
│  │  • Withdraw from Meteora vaults                        │         │
│  │  • Calculate final NAV                                 │         │
│  └───────────────────────────────────────────────────────┘         │
│                         │                                           │
│                         ▼                                           │
│  Phase 5: SETTLED                                                   │
│  ┌───────────────────────────────────────────────────────┐         │
│  │  • Status: SETTLED                                     │         │
│  │  • Calculate profit distribution:                      │         │
│  │    - 20% to forecaster (performance fee if profit)     │         │
│  │    - 64% to delegator pool (pro-rata)                  │         │
│  │    - 16% to platform treasury                          │         │
│  │  • Update forecaster Brier scores                      │         │
│  │  • Delegators can claim_rewards()                      │         │
│  └───────────────────────────────────────────────────────┘         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.4 Fee Structure

```typescript
// Fee calculations

interface FeeCalculation {
  // On deposit
  depositFee: bigint;           // depositAmount × depositFeeBps / 10000

  // Continuous (per second)
  managementFee: bigint;        // tvl × managementFeeBps / 10000 / YEAR_SECONDS

  // On profit (if any)
  performanceFee: bigint;       // max(0, (profit - hurdleReturn) × performanceFeeBps / 10000)

  // Platform cut
  platformFee: bigint;          // totalProfit × 1600 / 10000 (16% of profit)
}

// Default fee split (can be customized per pool)
const DEFAULT_FEE_SPLIT = {
  forecasterPerformance: 2000,  // 20% of profit
  delegatorReturn: 6400,        // 64% of profit
  platformFee: 1600,            // 16% of profit
  // Total: 10000 (100%)
};
```

### 3.5 Forecaster Eligibility

```typescript
// Eligibility check for pool creation

interface PoolEligibility {
  // Minimum requirements
  minPredictions: 20;           // Total predictions
  minResolved: 10;              // Resolved predictions
  minBrier: 0.35;               // Max Brier score (lower = better)
  minRank: 90;                  // Top 10% (percentile >= 90)
  minAge: 604800;               // 7 days since first prediction

  // Tier requirements
  tier: 'verified' | 'elite' | 'superforecaster';

  // Stake requirements (for trust)
  minStake: 100;                // 100 USDC self-stake
}

async function checkEligibility(forecaster: string): Promise<{
  eligible: boolean;
  reason: string | null;
  unlocksAt: number | null;     // When they'll become eligible
}> {
  const profile = await getForecasterProfile(forecaster);

  if (profile.metrics.predictionCount < 20) {
    return {
      eligible: false,
      reason: `Need ${20 - profile.metrics.predictionCount} more predictions`,
      unlocksAt: null,
    };
  }

  if (profile.percentile < 90) {
    return {
      eligible: false,
      reason: `Top 10% required. Current: ${profile.percentile}th percentile`,
      unlocksAt: null,
    };
  }

  // ... more checks

  return { eligible: true, reason: null, unlocksAt: null };
}
```

---

## 4. On-Chain State Design

### 4.1 Program IDs

```rust
// Existing
pub const CALIBRATION_PROGRAM: &str = "CaL1b..."; // Existing Calibration Program

// New
pub const FORECASTER_PROGRAM: &str = "FcSt...";  // ForecasterProfile + Leaderboard
pub const POOL_PROGRAM: &str = "BeRP...";        // ForecastPool
```

### 4.2 ForecasterProfile PDA (Anchor)

```rust
// programs/beright-forecaster/src/lib.rs

#[account]
pub struct ForecasterProfile {
    // Identity (64 bytes)
    pub authority: Pubkey,           // 32
    pub delegate: Pubkey,            // 32 (can be default if none)

    // Scores (80 bytes) - stored as basis points (0-10000)
    pub brier_overall: u32,          // 4
    pub brier_politics: u32,         // 4
    pub brier_crypto: u32,           // 4
    pub brier_sports: u32,           // 4
    pub brier_macro: u32,            // 4
    pub brier_science: u32,          // 4
    pub accuracy_bps: u32,           // 4
    pub calibration_bps: u32,        // 4
    pub roi_bps: i32,                // 4 (can be negative)
    pub sharpe_bps: i32,             // 4
    pub kelly_compliance_bps: u32,   // 4
    pub skill_rating: u32,           // 4 (default 10000 = 1000.00)
    pub volume_weighted_brier: u32,  // 4
    pub composite_score: u32,        // 4
    pub padding_scores: [u8; 16],    // 16

    // Metrics (64 bytes)
    pub prediction_count: u32,       // 4
    pub resolved_count: u32,         // 4
    pub cumulative_volume: u64,      // 8 (micro USDC)
    pub profit_volume: i64,          // 8 (can be negative)
    pub total_aum: u64,              // 8
    pub total_fees_earned: u64,      // 8
    pub active_pool_count: u8,       // 1
    pub total_pools_created: u16,    // 2
    pub padding_metrics: [u8; 21],   // 21

    // Status (16 bytes)
    pub global_rank: u32,            // 4
    pub percentile: u16,             // 2 (0-10000 for 0-100.00%)
    pub tier: u8,                    // 1 (0=unranked, 1=rookie, 2=verified, 3=elite, 4=super)
    pub badges_bitmap: u64,          // 8 (bit flags for badges)
    pub can_create_pool: bool,       // 1

    // Timestamps (24 bytes)
    pub created_at: i64,             // 8
    pub last_prediction_at: i64,     // 8
    pub last_active_at: i64,         // 8

    // PDA (1 byte)
    pub bump: u8,                    // 1

    // Reserved (7 bytes)
    pub reserved: [u8; 7],           // 7 for future use
}
// Total: 256 bytes

#[account]
pub struct PredictionRecord {
    pub forecaster: Pubkey,          // 32
    pub market_id: [u8; 64],         // 64 (string identifier)
    pub platform: u8,                // 1
    pub domain: u8,                  // 1
    pub direction: u8,               // 1 (0=NO, 1=YES)
    pub probability_bps: u16,        // 2 (0-10000)
    pub entry_price_bps: u16,        // 2
    pub contracts: u64,              // 8
    pub stake_micro_usd: u64,        // 8
    pub outcome: u8,                 // 1 (0=unresolved, 1=NO, 2=YES)
    pub exit_price_bps: u16,         // 2
    pub pnl_micro_usd: i64,          // 8
    pub brier_contribution_bps: u16, // 2
    pub predicted_at: i64,           // 8
    pub resolved_at: i64,            // 8
    pub bump: u8,                    // 1
}
// Total: 212 bytes
```

### 4.3 ForecastPool PDA (Anchor)

```rust
// programs/beright-pool/src/lib.rs

#[account]
pub struct ForecastPool {
    // Identity (96 bytes)
    pub forecaster: Pubkey,          // 32
    pub delegate: Pubkey,            // 32
    pub name: [u8; 32],              // 32

    // Configuration (24 bytes)
    pub category: u8,                // 1
    pub strategy_type: u8,           // 1
    pub min_deposit: u64,            // 8 (micro USDC)
    pub max_deposit: u64,            // 8 (0 = no limit)
    pub lock_period: u32,            // 4 (seconds)
    pub status: u8,                  // 1
    pub padding_config: u8,          // 1

    // Fees (16 bytes)
    pub deposit_fee_bps: u16,        // 2
    pub management_fee_bps: u16,     // 2
    pub performance_fee_bps: u16,    // 2
    pub hurdle_rate_bps: u16,        // 2
    pub padding_fees: [u8; 8],       // 8

    // Vault Accounting (64 bytes)
    pub token_account: Pubkey,       // 32
    pub total_shares: u128,          // 16
    pub user_shares: u128,           // 16

    // Financial State (48 bytes)
    pub net_deposits: i64,           // 8
    pub total_deposits: u64,         // 8
    pub total_withdraws: u64,        // 8
    pub management_fee_accrued: u64, // 8
    pub last_fee_update_ts: i64,     // 8
    pub nav_per_share: u64,          // 8 (6 decimals)

    // Performance (32 bytes)
    pub cumulative_pnl: i64,         // 8
    pub active_positions: u8,        // 1
    pub closed_positions: u16,       // 2
    pub win_rate_bps: u16,           // 2
    pub avg_return_bps: i16,         // 2
    pub padding_perf: [u8; 17],      // 17

    // Timestamps (32 bytes)
    pub created_at: i64,             // 8
    pub active_at: i64,              // 8
    pub settles_at: i64,             // 8
    pub settled_at: i64,             // 8

    // PDA (2 bytes)
    pub bump: u8,                    // 1
    pub vault_bump: u8,              // 1

    // Reserved (6 bytes)
    pub reserved: [u8; 6],           // 6
}
// Total: 320 bytes

#[account]
pub struct Delegation {
    pub pool: Pubkey,                // 32
    pub delegator: Pubkey,           // 32
    pub shares_owned: u128,          // 16
    pub deposited_amount: u64,       // 8
    pub deposited_at: i64,           // 8
    pub withdraw_requested_at: i64,  // 8
    pub claimed: bool,               // 1
    pub claimed_amount: u64,         // 8
    pub claimed_at: i64,             // 8
    pub bump: u8,                    // 1
}
// Total: 122 bytes
```

---

## 5. API Specification

### 5.1 Phase 1 APIs

```typescript
// Forecaster Profile APIs

// GET /api/v2/forecasters
// List forecasters with leaderboard
interface ListForecastersRequest {
  domain?: string;
  tier?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  timeframe?: '7d' | '30d' | '90d' | 'all';
}
interface ListForecastersResponse {
  success: boolean;
  data: {
    forecasters: LeaderboardEntry[];
    total: number;
    lastUpdated: string;
  };
}

// GET /api/v2/forecasters/:pubkey
// Get single forecaster profile
interface GetForecasterResponse {
  success: boolean;
  data: {
    profile: ForecasterProfile;
    recentPredictions: PredictionRecord[];
    performanceChart: { date: string; brierCumulative: number }[];
  };
}

// POST /api/v2/forecasters/register
// Register new forecaster profile
interface RegisterForecasterRequest {
  walletPubkey: string;
  displayName?: string;
  telegramId?: number;
}

// POST /api/v2/predictions/commit
// Commit a prediction intent
interface CommitPredictionRequest {
  forecasterPubkey: string;
  marketId: string;
  platform: string;
  direction: 'YES' | 'NO';
  probability: number;
  stakeUsd?: number;
}
interface CommitPredictionResponse {
  success: boolean;
  data: {
    predictionId: string;
    intentTxSignature: string;
    market: { title: string; currentPrice: number };
  };
}

// POST /api/v2/predictions/execute
// Execute trade for committed prediction
interface ExecutePredictionRequest {
  predictionId: string;
  walletPubkey: string;
  amountUsd: number;
}

// GET /api/v2/predictions/:id
// Get prediction status
interface GetPredictionResponse {
  success: boolean;
  data: PredictionRecord;
}

// GET /api/v2/leaderboard
// Public leaderboard endpoint
interface LeaderboardResponse {
  success: boolean;
  data: {
    entries: LeaderboardEntry[];
    totalForecasters: number;
    lastUpdated: string;
  };
}
```

### 5.2 Phase 2 APIs

```typescript
// Pool APIs

// GET /api/v2/pools
// List all pools
interface ListPoolsRequest {
  status?: 'open' | 'active' | 'settled';
  forecaster?: string;
  category?: string;
  sortBy?: 'tvl' | 'performance' | 'fees' | 'created';
  limit?: number;
}

// POST /api/v2/pools/create
// Create new pool (forecaster only)
interface CreatePoolRequest {
  forecasterPubkey: string;
  name: string;
  description: string;
  category: string;
  strategyType: string;
  durationDays: number;
  minDeposit: number;
  fees: {
    depositFeeBps: number;
    managementFeeBps: number;
    performanceFeeBps: number;
    hurdleRate?: number;
  };
}
interface CreatePoolResponse {
  success: boolean;
  data: {
    poolPubkey: string;
    transaction: string; // Base64 encoded, needs signing
  };
}

// POST /api/v2/pools/:pubkey/stake
// Stake USDC to pool
interface StakeRequest {
  delegatorPubkey: string;
  amountUsd: number;
}
interface StakeResponse {
  success: boolean;
  data: {
    delegationPubkey: string;
    sharesReceived: string;
    transaction: string;
  };
}

// POST /api/v2/pools/:pubkey/activate
// Activate pool for trading (forecaster only)

// POST /api/v2/pools/:pubkey/position
// Open position in pool (forecaster only)
interface OpenPositionRequest {
  forecasterPubkey: string;
  marketId: string;
  platform: 'dflow' | 'jupiter';
  side: 'YES' | 'NO';
  amountUsd: number;
  maxPrice?: number;
}

// POST /api/v2/pools/:pubkey/settle
// Trigger pool settlement

// POST /api/v2/pools/:pubkey/claim
// Claim rewards (delegator)
interface ClaimRequest {
  delegatorPubkey: string;
}
interface ClaimResponse {
  success: boolean;
  data: {
    payoutUsd: number;
    transaction: string;
  };
}
```

---

## 6. Database Schema

### 6.1 New Tables (Supabase)

```sql
-- ================================================
-- PHASE 1: Forecaster Profiles & Predictions
-- ================================================

-- Forecaster profiles (mirrors on-chain state)
CREATE TABLE forecaster_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pubkey TEXT UNIQUE NOT NULL,
  display_name TEXT,
  telegram_id BIGINT UNIQUE,
  twitter_handle TEXT,

  -- Authority
  manager_pubkey TEXT NOT NULL,
  delegate_pubkey TEXT,

  -- Scores (stored as basis points, 0-10000)
  brier_overall INTEGER DEFAULT 5000,
  brier_politics INTEGER,
  brier_crypto INTEGER,
  brier_sports INTEGER,
  brier_macro INTEGER,
  brier_science INTEGER,

  accuracy_bps INTEGER DEFAULT 5000,
  calibration_bps INTEGER DEFAULT 5000,
  roi_bps INTEGER DEFAULT 0,
  sharpe_bps INTEGER DEFAULT 0,
  kelly_compliance_bps INTEGER DEFAULT 5000,
  skill_rating INTEGER DEFAULT 10000,
  volume_weighted_brier INTEGER DEFAULT 5000,
  composite_score INTEGER DEFAULT 5000,

  -- Metrics
  prediction_count INTEGER DEFAULT 0,
  resolved_count INTEGER DEFAULT 0,
  cumulative_volume_micro BIGINT DEFAULT 0,
  profit_volume_micro BIGINT DEFAULT 0,
  total_aum_micro BIGINT DEFAULT 0,
  total_fees_earned_micro BIGINT DEFAULT 0,
  active_pool_count SMALLINT DEFAULT 0,
  total_pools_created SMALLINT DEFAULT 0,

  -- Ranking
  global_rank INTEGER,
  percentile SMALLINT,
  tier TEXT DEFAULT 'unranked',
  badges TEXT[] DEFAULT '{}',
  can_create_pool BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_prediction_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),

  -- On-chain sync
  on_chain_synced BOOLEAN DEFAULT FALSE,
  last_sync_slot BIGINT
);

CREATE INDEX idx_forecasters_rank ON forecaster_profiles(global_rank);
CREATE INDEX idx_forecasters_tier ON forecaster_profiles(tier);
CREATE INDEX idx_forecasters_telegram ON forecaster_profiles(telegram_id);
CREATE INDEX idx_forecasters_composite ON forecaster_profiles(composite_score DESC);

-- Prediction records
CREATE TABLE prediction_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecaster_pubkey TEXT NOT NULL REFERENCES forecaster_profiles(pubkey),

  -- Market reference
  market_id TEXT NOT NULL,
  market_title TEXT NOT NULL,
  platform TEXT NOT NULL,
  domain TEXT NOT NULL,

  -- Prediction details
  direction TEXT NOT NULL CHECK (direction IN ('YES', 'NO')),
  probability DECIMAL(5,4) NOT NULL CHECK (probability >= 0 AND probability <= 1),
  entry_price DECIMAL(5,4),
  contracts BIGINT DEFAULT 0,
  stake_usd DECIMAL(18,6) DEFAULT 0,

  -- Resolution
  outcome BOOLEAN, -- NULL = unresolved
  exit_price DECIMAL(5,4),
  pnl_usd DECIMAL(18,6),
  brier_contribution DECIMAL(10,8),

  -- On-chain proof
  intent_tx_signature TEXT,
  execution_tx_signature TEXT,
  resolution_tx_signature TEXT,

  -- Timestamps
  predicted_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,

  -- Constraints
  UNIQUE(forecaster_pubkey, market_id, direction)
);

CREATE INDEX idx_predictions_forecaster ON prediction_records(forecaster_pubkey);
CREATE INDEX idx_predictions_market ON prediction_records(market_id);
CREATE INDEX idx_predictions_unresolved ON prediction_records(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_predictions_domain ON prediction_records(domain);

-- Leaderboard view (materialized for performance)
CREATE MATERIALIZED VIEW leaderboard AS
SELECT
  fp.id,
  fp.pubkey,
  fp.display_name,
  fp.brier_overall,
  fp.accuracy_bps,
  fp.roi_bps,
  fp.skill_rating,
  fp.composite_score,
  fp.prediction_count,
  fp.resolved_count,
  fp.cumulative_volume_micro,
  fp.tier,
  fp.badges,
  fp.global_rank,
  fp.percentile,
  RANK() OVER (ORDER BY fp.composite_score DESC) as computed_rank
FROM forecaster_profiles fp
WHERE fp.resolved_count >= 5
ORDER BY fp.composite_score DESC;

CREATE UNIQUE INDEX idx_leaderboard_pubkey ON leaderboard(pubkey);

-- ================================================
-- PHASE 2: Pools & Delegations
-- ================================================

-- Forecast pools
CREATE TABLE forecast_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pubkey TEXT UNIQUE NOT NULL,
  forecaster_pubkey TEXT NOT NULL REFERENCES forecaster_profiles(pubkey),

  -- Basic info
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  strategy_type TEXT NOT NULL,

  -- Deposit params
  min_deposit_usd DECIMAL(18,6) NOT NULL,
  max_deposit_usd DECIMAL(18,6),
  max_tvl_usd DECIMAL(18,6),
  lock_period_seconds INTEGER NOT NULL,

  -- Fees (basis points)
  deposit_fee_bps SMALLINT DEFAULT 0,
  management_fee_bps SMALLINT DEFAULT 200,
  performance_fee_bps SMALLINT DEFAULT 2000,
  hurdle_rate_bps SMALLINT,

  -- Status
  status TEXT DEFAULT 'open',

  -- Vault accounting
  token_account TEXT,
  total_shares DECIMAL(38,0) DEFAULT 0,
  user_shares DECIMAL(38,0) DEFAULT 0,
  net_deposits_micro BIGINT DEFAULT 0,
  total_deposits_micro BIGINT DEFAULT 0,
  total_withdraws_micro BIGINT DEFAULT 0,
  management_fee_accrued_micro BIGINT DEFAULT 0,
  nav_per_share DECIMAL(18,6) DEFAULT 1.000000,

  -- Performance
  cumulative_pnl_micro BIGINT DEFAULT 0,
  active_positions SMALLINT DEFAULT 0,
  closed_positions INTEGER DEFAULT 0,
  win_rate_bps SMALLINT DEFAULT 0,
  avg_return_bps SMALLINT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  active_at TIMESTAMPTZ,
  settles_at TIMESTAMPTZ NOT NULL,
  settled_at TIMESTAMPTZ,

  -- On-chain
  bump SMALLINT,
  vault_bump SMALLINT
);

CREATE INDEX idx_pools_forecaster ON forecast_pools(forecaster_pubkey);
CREATE INDEX idx_pools_status ON forecast_pools(status);
CREATE INDEX idx_pools_category ON forecast_pools(category);

-- Delegations
CREATE TABLE delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pubkey TEXT UNIQUE NOT NULL,
  pool_pubkey TEXT NOT NULL REFERENCES forecast_pools(pubkey),
  delegator_pubkey TEXT NOT NULL,

  -- Position
  shares_owned DECIMAL(38,0) NOT NULL,
  deposited_amount_micro BIGINT NOT NULL,
  deposited_at TIMESTAMPTZ DEFAULT NOW(),

  -- Withdrawal
  withdraw_requested_at TIMESTAMPTZ,

  -- Claim
  claimed BOOLEAN DEFAULT FALSE,
  claimed_amount_micro BIGINT,
  claimed_at TIMESTAMPTZ,

  -- On-chain
  bump SMALLINT,

  UNIQUE(pool_pubkey, delegator_pubkey)
);

CREATE INDEX idx_delegations_pool ON delegations(pool_pubkey);
CREATE INDEX idx_delegations_delegator ON delegations(delegator_pubkey);

-- Pool positions
CREATE TABLE pool_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pubkey TEXT UNIQUE NOT NULL,
  pool_pubkey TEXT NOT NULL REFERENCES forecast_pools(pubkey),

  -- Market reference
  market_id TEXT NOT NULL,
  market_title TEXT NOT NULL,
  platform TEXT NOT NULL,

  -- Position details
  outcome_mint TEXT NOT NULL,
  side TEXT NOT NULL,
  contracts BIGINT NOT NULL,
  avg_entry_price DECIMAL(5,4) NOT NULL,
  total_cost_micro BIGINT NOT NULL,

  -- Status
  status TEXT DEFAULT 'open',

  -- Resolution
  exit_price DECIMAL(5,4),
  proceeds_micro BIGINT,
  pnl_micro BIGINT,

  -- Timestamps
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX idx_positions_pool ON pool_positions(pool_pubkey);
CREATE INDEX idx_positions_status ON pool_positions(status);
```

---

## 7. Frontend Components

### 7.1 Phase 1 Components

```typescript
// Leaderboard Page Components

// pages/leaderboard/page.tsx
interface LeaderboardPageProps {}

// components/LeaderboardTable.tsx
interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  sortBy: string;
  onSort: (column: string) => void;
}

// components/ForecasterCard.tsx
interface ForecasterCardProps {
  forecaster: ForecasterProfile;
  rank: number;
  onClick: () => void;
}

// components/ScoreRadar.tsx
// Radar chart showing all "Various Scores"
interface ScoreRadarProps {
  scores: ForecasterProfile['scores'];
}

// components/PredictionHistory.tsx
interface PredictionHistoryProps {
  predictions: PredictionRecord[];
  showChart?: boolean;
}

// components/PredictionForm.tsx
// Form for committing predictions
interface PredictionFormProps {
  market: Market;
  onSubmit: (prediction: CommitPredictionRequest) => void;
}

// Forecaster Profile Page
// pages/forecaster/[pubkey]/page.tsx
interface ForecasterProfilePageProps {
  params: { pubkey: string };
}
```

### 7.2 Phase 2 Components

```typescript
// Pool Discovery Page
// pages/pools/page.tsx

// components/PoolCard.tsx
interface PoolCardProps {
  pool: ForecastPool;
  forecaster: ForecasterProfile;
  onClick: () => void;
}

// components/PoolDetails.tsx
interface PoolDetailsProps {
  pool: ForecastPool;
  delegations: Delegation[];
  positions: PoolPosition[];
}

// components/StakeForm.tsx
interface StakeFormProps {
  pool: ForecastPool;
  onStake: (amount: number) => void;
}

// components/CreatePoolForm.tsx
// For eligible forecasters
interface CreatePoolFormProps {
  forecaster: ForecasterProfile;
  onSubmit: (params: CreatePoolRequest) => void;
}

// components/PoolPerformanceChart.tsx
interface PoolPerformanceChartProps {
  pool: ForecastPool;
  navHistory: { date: string; nav: number }[];
}

// components/DelegatorPortfolio.tsx
interface DelegatorPortfolioProps {
  delegations: Delegation[];
  onClaim: (delegationPubkey: string) => void;
}
```

---

## 8. Implementation Sequence

### 8.1 Phase 1 Milestones (4 weeks)

```
Week 1: Foundation
├── [ ] Database schema (forecaster_profiles, prediction_records)
├── [ ] ForecasterProfile TypeScript types
├── [ ] Enhanced scoring engine (lib/scoring/engine.ts)
├── [ ] Migrate existing reputation.ts to new schema
└── [ ] API: GET /api/v2/forecasters, GET /api/v2/leaderboard

Week 2: Prediction System
├── [ ] Prediction recording flow
├── [ ] On-chain commit (Memo Program integration)
├── [ ] API: POST /api/v2/predictions/commit
├── [ ] API: POST /api/v2/predictions/execute
├── [ ] Market resolution watcher (cron job)
└── [ ] Brier score updates on resolution

Week 3: Leaderboard UI
├── [ ] Leaderboard page (/leaderboard)
├── [ ] ForecasterCard component
├── [ ] LeaderboardTable with sorting/filtering
├── [ ] ScoreRadar visualization
├── [ ] Forecaster profile page (/forecaster/[pubkey])
└── [ ] PredictionHistory component

Week 4: Polish & Launch
├── [ ] Prediction form in market cards
├── [ ] Telegram bot integration (/predict command)
├── [ ] Materialized view refresh job
├── [ ] Performance optimization
├── [ ] Testing & bug fixes
└── [ ] Deploy Phase 1
```

### 8.2 Phase 2 Milestones (6 weeks)

```
Week 5-6: Pool Smart Contract
├── [ ] ForecastPool Anchor program design
├── [ ] create_pool instruction
├── [ ] stake instruction
├── [ ] activate_pool instruction
├── [ ] Unit tests
└── [ ] Devnet deployment

Week 7-8: Pool Operations
├── [ ] open_position instruction (DFlow/Jupiter integration)
├── [ ] close_position instruction
├── [ ] settle_pool instruction
├── [ ] claim_rewards instruction
├── [ ] Fee calculation logic
└── [ ] Position tracking

Week 9: Backend Integration
├── [ ] Pool service (lib/pool/poolService.ts)
├── [ ] API: POST /api/v2/pools/create
├── [ ] API: POST /api/v2/pools/:pubkey/stake
├── [ ] API: POST /api/v2/pools/:pubkey/position
├── [ ] API: POST /api/v2/pools/:pubkey/claim
└── [ ] Eligibility checker

Week 10: Depositor UI
├── [ ] Pool discovery page (/pools)
├── [ ] PoolCard component
├── [ ] PoolDetails page
├── [ ] StakeForm component
├── [ ] DelegatorPortfolio component
└── [ ] ClaimRewards flow

Week 11: Forecaster Dashboard
├── [ ] CreatePoolForm component
├── [ ] Pool management dashboard
├── [ ] Position opening UI
├── [ ] Performance tracking charts
└── [ ] Notification system

Week 12: Launch Prep
├── [ ] Security audit
├── [ ] Mainnet deployment
├── [ ] TVL caps & guardrails
├── [ ] Monitoring & alerts
├── [ ] Beta testing with 5 forecasters
└── [ ] Public launch
```

---

## 9. Risk Mitigations

### 9.1 Sybil Prevention

```typescript
// Anti-sybil measures

interface SybilPrevention {
  // Minimum stake to create predictions
  minPredictionStake: 1;          // $1 USDC per prediction

  // Score weight by volume
  volumeWeightedScoring: true;    // Big bets matter more

  // Time-based reputation
  minAgeForRanking: 604800;       // 7 days

  // Consistency requirements
  minPredictionsForRanking: 10;
  maxDailyPredictions: 50;        // Prevent spam

  // Social verification
  telegramVerification: true;
  twitterVerification: optional;
}
```

### 9.2 Pool Guardrails

```typescript
// Pool safety limits

interface PoolGuardrails {
  // Per-pool limits
  maxSingleMarketExposure: 0.30;  // 30% in one market
  minLiquidReserve: 0.20;         // 20% always liquid
  maxPositionSize: 0.15;          // 15% per position

  // Platform limits
  maxTvlPerPool: 100000;          // $100k initial cap
  maxTvlTotal: 1000000;           // $1M platform cap initially

  // Forecaster limits
  maxActivePoolsPerForecaster: 3;
  cooldownAfterLoss: 604800;      // 7 days after significant loss
}
```

### 9.3 Resolution Oracle

```typescript
// Multi-source resolution

interface ResolutionOracle {
  sources: [
    'platform_api',     // Primary: market's own API
    'polyrouter',       // Secondary: aggregator
    'manual_override',  // Fallback: admin resolution
  ];

  // Dispute window
  disputePeriod: 86400;           // 24 hours
  disputeStake: 50;               // $50 USDC

  // Resolution timing
  checkInterval: 3600;            // Every hour
  gracePeriod: 7200;              // 2 hours after close
}
```

---

## 10. Success Metrics

### Phase 1 KPIs

| Metric | Week 4 Target | Week 8 Target |
|--------|---------------|---------------|
| Registered Forecasters | 50 | 200 |
| Predictions Committed | 200 | 1,000 |
| Predictions Resolved | 50 | 300 |
| Active Daily Users | 20 | 50 |
| Avg Brier Score (platform) | < 0.30 | < 0.25 |

### Phase 2 KPIs

| Metric | Week 12 Target | Week 16 Target |
|--------|----------------|----------------|
| Active Pools | 5 | 20 |
| Total TVL | $10,000 | $50,000 |
| Unique Delegators | 20 | 100 |
| Pool Settlement Rate | 80% | 90% |
| Avg Pool ROI | > 0% | > 5% |

---

## Appendix: File Map

```
beright-ts/
├── types/
│   ├── forecaster.ts          # ForecasterProfile, PredictionRecord
│   └── pool.ts                # ForecastPool, Delegation, PoolPosition
├── lib/
│   ├── scoring/
│   │   ├── engine.ts          # Scoring calculations
│   │   ├── brier.ts           # Brier score functions
│   │   └── ranking.ts         # Leaderboard ranking
│   ├── forecaster/
│   │   ├── profile.ts         # Profile management
│   │   ├── prediction.ts      # Prediction recording
│   │   └── resolution.ts      # Market resolution watcher
│   ├── pool/
│   │   ├── poolService.ts     # Pool lifecycle management
│   │   ├── delegation.ts      # Stake/claim operations
│   │   └── settlement.ts      # Settlement logic
│   └── onchain/
│       ├── forecaster.ts      # ForecasterProfile program client
│       └── pool.ts            # ForecastPool program client
├── app/api/v2/
│   ├── forecasters/
│   │   ├── route.ts           # List/create forecasters
│   │   └── [pubkey]/route.ts  # Get/update forecaster
│   ├── predictions/
│   │   ├── commit/route.ts    # Commit prediction
│   │   ├── execute/route.ts   # Execute trade
│   │   └── [id]/route.ts      # Get prediction
│   ├── leaderboard/route.ts   # Public leaderboard
│   └── pools/
│       ├── route.ts           # List/create pools
│       └── [pubkey]/
│           ├── route.ts       # Pool details
│           ├── stake/route.ts # Stake to pool
│           ├── position/route.ts # Open position
│           └── claim/route.ts # Claim rewards
└── programs/
    ├── beright-forecaster/    # Anchor program
    └── beright-pool/          # Anchor program
```

---

*Spec Version: 1.0*
*Last Updated: March 2026*
*Author: BeRight Technical Team*
