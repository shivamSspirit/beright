# BeRight DeFi Prediction Market Strategy Guide

> **Technical Co-Founder Analysis: Comprehensive DFlow + Meteora Integration**
>
> Last Updated: March 2026

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [DFlow/Pond Technology Stack](#dflowpond-technology-stack)
3. [Meteora LP Technologies](#meteora-lp-technologies)
4. [Solana Staking & Yield Infrastructure](#solana-staking--yield-infrastructure)
5. [Profitable DeFi Strategies](#profitable-defi-strategies)
6. [BeRight Implementation Architecture](#beright-implementation-architecture)
7. [Revenue Model & Fee Structures](#revenue-model--fee-structures)
8. [Risk Analysis & Mitigations](#risk-analysis--mitigations)
9. [Implementation Roadmap](#implementation-roadmap)
10. [API Reference](#api-reference)

---

## Executive Summary

### Market Opportunity

| Metric | 2024 | 2025 | Growth |
|--------|------|------|--------|
| Prediction Market Volume | $9B | $44B | **+400%** |
| Polymarket Volume | - | $21.5B | - |
| Kalshi Volume | - | $17.1B | - |
| Documented Arbitrage Profits | - | $40M+ | - |
| Solana Liquid Staking TVL | $2.5B | $7.1B | **+217%** |

### BeRight's Position

We are building a **skill-capital matching protocol** that combines:
- **DFlow** for prediction market execution (tokenized Kalshi markets)
- **Meteora** for LP yield on idle capital and outcome tokens
- **Solana LSTs** for base yield on treasury/reserves
- **On-chain Brier scores** for portable forecaster reputation

### Core Value Proposition

```
┌─────────────────────────────────────────────────────────────────────┐
│                     BeRight Protocol Value Flow                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  FORECASTERS                      DELEGATORS                        │
│  (Skill Providers)                (Capital Providers)               │
│       │                                │                            │
│       │ Build on-chain                 │ Stake USDC into            │
│       │ Brier reputation               │ forecaster pools           │
│       ▼                                ▼                            │
│  ┌──────────────────────────────────────────────────────┐          │
│  │              BeRight Pool Smart Contract              │          │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │          │
│  │  │ Pool Vault  │  │ Delegation  │  │  Reputation  │  │          │
│  │  │    PDA      │  │    PDAs     │  │     PDA      │  │          │
│  │  └──────┬──────┘  └──────┬──────┘  └──────────────┘  │          │
│  └─────────┼────────────────┼───────────────────────────┘          │
│            │                │                                       │
│            ▼                ▼                                       │
│  ┌──────────────────────────────────────────────────────┐          │
│  │                   Capital Deployment                  │          │
│  │                                                       │          │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │          │
│  │  │   DFlow     │  │   Meteora   │  │   Sanctum    │  │          │
│  │  │ Prediction  │  │  LP Yield   │  │  LST Yield   │  │          │
│  │  │   Markets   │  │   (6-20%)   │  │   (6-9%)     │  │          │
│  │  └─────────────┘  └─────────────┘  └──────────────┘  │          │
│  └──────────────────────────────────────────────────────┘          │
│                            │                                        │
│                            ▼                                        │
│  ┌──────────────────────────────────────────────────────┐          │
│  │              Profit Distribution Engine               │          │
│  │                                                       │          │
│  │   20% Forecaster │ 64% Delegators │ 16% Platform     │          │
│  └──────────────────────────────────────────────────────┘          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## DFlow/Pond Technology Stack

### Overview

DFlow is Solana's most active unified trading infrastructure, routing tens of billions in monthly volume across spot and prediction markets through a single API surface.

### API Endpoints

| Service | URL | Auth Required |
|---------|-----|---------------|
| Trade API | `https://dev-quote-api.dflow.net` | Optional (rate-limited) |
| Metadata API | `https://dev-prediction-markets-api.dflow.net` | Optional |
| WebSocket | `wss://dev-prediction-markets-api.dflow.net/api/v1/ws` | Optional |
| Proof API | `https://proof.dflow.net` | None |

**Note:** `dev-` endpoints execute on mainnet-beta. Production keys provide higher rate limits.

### Core Concepts

#### 1. Just-In-Time (JIT) Routing

Traditional aggregators compute routes offchain and embed fixed paths. DFlow moves routing decisions **onchain**:

```
Quote Time (Offchain)          Execution Time (Onchain)
       │                              │
       ▼                              ▼
┌─────────────┐               ┌─────────────────┐
│ Compute     │               │ Check current   │
│ optimal     │──────────────▶│ prices, execute │
│ route +     │               │ original OR     │
│ fallbacks   │               │ switch venue    │
└─────────────┘               └─────────────────┘
```

**Benefits:**
- Lower realized slippage
- Higher success rates
- No need for wide slippage tolerances
- Competitive in volatile conditions

#### 2. Concurrent Liquidity Programs (CLPs)

CLPs bridge offchain liquidity with onchain users for prediction markets:

```typescript
// CLP Flow for Prediction Markets
Phase 1: User submits limit-priced trade intent onchain
Phase 2: Offchain LPs observe intent and fill asynchronously
Phase 3: Protocol mints SPL tokens representing position
Phase 4: On resolution, winning tokens redeem for payout
```

**Critical:** Prediction market orders are async (multi-transaction), not atomic.

#### 3. Execution Modes

| Mode | Use Case | Transaction Count |
|------|----------|-------------------|
| `sync` | Spot token swaps | 1 |
| `async` | Prediction markets | 2+ (intent + fills) |

### Prediction Market Data Model

#### Event Structure

```typescript
interface Event {
  ticker: string;           // e.g., "KXBTC-26JAN14-B63000"
  title: string;            // Human-readable title
  seriesTicker: string;     // Parent series identifier
  liquidity: number;        // Total liquidity (scaled)
  openInterest: number;     // Open positions
  volume: number;           // Trading volume
  settlementSources: string[]; // Oracle sources
  markets: Market[];        // Nested markets
}

interface Market {
  ticker: string;
  status: MarketStatus;
  openTime: string;         // ISO timestamp
  closeTime: string;
  expirationTime: string;
  yesBid: number;           // Current YES bid (0-10000)
  yesAsk: number;           // Current YES ask (0-10000)
  noBid: number;
  noAsk: number;
  settlementMint: string;   // USDC or CASH
  accounts: MarketAccountInfo;
}

interface MarketAccountInfo {
  marketLedger: string;     // Ledger mint address
  yesMint: string;          // YES outcome token mint
  noMint: string;           // NO outcome token mint
  isInitialized: boolean;   // Tokenization status
  redemptionStatus: string; // "open" | "closed"
}

type MarketStatus =
  | "initialized"  // Pre-trading
  | "active"       // TRADING ALLOWED
  | "inactive"     // Paused
  | "closed"       // Post-trading, pre-resolution
  | "determined"   // Outcome decided, redemption may be available
  | "finalized";   // Fully settled
```

### KYC/Proof Requirements

**Critical Constraints:**

| Action | KYC Required | Notes |
|--------|--------------|-------|
| Buy outcome tokens | **YES** | Receiving wallet must be Proof-verified |
| Sell outcome tokens | No | Any wallet can sell |
| Quote without execution | No | Omit `userPublicKey` from request |
| Spot trading | No | KYC not required |

**Verification Flow:**

```typescript
// 1. Generate signature for wallet ownership
const timestamp = Date.now();
const message = `Proof KYC verification: ${timestamp}`;
const signature = await wallet.signMessage(message);

// 2. Redirect user to Proof
const proofUrl = new URL("https://dflow.net/proof");
proofUrl.searchParams.set("wallet", wallet.publicKey.toBase58());
proofUrl.searchParams.set("signature", bs58.encode(signature));
proofUrl.searchParams.set("timestamp", timestamp.toString());
proofUrl.searchParams.set("redirect_uri", "https://beright.app/callback");

// 3. Check verification status
const verified = await fetch(
  `https://proof.dflow.net/verify/${wallet.publicKey.toBase58()}`
).then(r => r.json());
// Returns: { verified: true/false }
```

**Geoblocking Required:** US, UK, EU (France, Italy, Belgium, Poland), Singapore, China, and ~40+ jurisdictions blocked from prediction market trading.

### Trading Implementation

#### Opening a Position

```typescript
import { Connection, VersionedTransaction } from "@solana/web3.js";

const API_BASE = "https://dev-quote-api.dflow.net";
const METADATA_API = "https://dev-prediction-markets-api.dflow.net";

async function openPredictionPosition(
  walletKeypair: Keypair,
  outcomeMint: string,  // YES or NO mint
  usdcAmount: number,   // Amount in USDC (6 decimals)
  connection: Connection
) {
  const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

  const params = new URLSearchParams({
    inputMint: USDC,
    outputMint: outcomeMint,
    amount: (usdcAmount * 1_000_000).toString(),  // Scale to 6 decimals
    userPublicKey: walletKeypair.publicKey.toBase58(),
    slippageBps: "auto",
  });

  const headers: HeadersInit = {};
  if (process.env.DFLOW_API_KEY) {
    headers["x-api-key"] = process.env.DFLOW_API_KEY;
  }

  const orderResponse = await fetch(
    `${API_BASE}/order?${params.toString()}`,
    { headers }
  ).then(r => r.json());

  if (orderResponse.error) {
    throw new Error(orderResponse.error.msg);
  }

  // Sign transaction
  const txBuffer = Buffer.from(orderResponse.transaction, "base64");
  const tx = VersionedTransaction.deserialize(txBuffer);
  tx.sign([walletKeypair]);

  // Submit
  const signature = await connection.sendTransaction(tx);

  // Monitor async order
  if (orderResponse.executionMode === "async") {
    return await monitorAsyncOrder(signature, headers);
  }

  return { signature, executionMode: "sync" };
}

async function monitorAsyncOrder(signature: string, headers: HeadersInit) {
  let status = "open";
  let fills = [];

  while (status === "open" || status === "pendingClose") {
    await new Promise(r => setTimeout(r, 2000));

    const statusResponse = await fetch(
      `${API_BASE}/order-status?signature=${signature}`,
      { headers }
    ).then(r => r.json());

    status = statusResponse.status;
    fills = statusResponse.fills || [];
  }

  return { signature, status, fills };
}
```

#### Position Tracking

```typescript
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

async function trackPredictionPositions(
  walletPublicKey: PublicKey,
  connection: Connection
) {
  // 1. Get all Token-2022 accounts
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
    walletPublicKey,
    { programId: TOKEN_2022_PROGRAM_ID }
  );

  const userTokens = tokenAccounts.value
    .map(({ account }) => ({
      mint: account.data.parsed.info.mint,
      balance: account.data.parsed.info.tokenAmount.uiAmount,
      decimals: account.data.parsed.info.tokenAmount.decimals,
    }))
    .filter(t => t.balance > 0);

  // 2. Filter for outcome mints
  const mints = userTokens.map(t => t.mint);
  const filterResponse = await fetch(
    `${METADATA_API}/api/v1/filter_outcome_mints`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresses: mints }),
    }
  ).then(r => r.json());

  const outcomeMints = new Set(filterResponse.outcomeMints || []);
  const outcomeTokens = userTokens.filter(t => outcomeMints.has(t.mint));

  // 3. Fetch market details
  const marketsResponse = await fetch(
    `${METADATA_API}/api/v1/markets/batch`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mints: Array.from(outcomeMints) }),
    }
  ).then(r => r.json());

  // 4. Build position map
  const positions = outcomeTokens.map(token => {
    const market = marketsResponse.markets?.find((m: any) =>
      Object.values(m.accounts || {}).some((a: any) =>
        a.yesMint === token.mint || a.noMint === token.mint
      )
    );

    const isYes = Object.values(market?.accounts || {}).some(
      (a: any) => a.yesMint === token.mint
    );

    return {
      mint: token.mint,
      balance: token.balance,
      side: isYes ? "YES" : "NO",
      market: market ? {
        ticker: market.ticker,
        title: market.title,
        status: market.status,
        yesBid: market.yesBid / 100,  // Convert to probability
        yesAsk: market.yesAsk / 100,
      } : null,
    };
  });

  return positions;
}
```

#### Redemption After Resolution

```typescript
async function redeemOutcomeTokens(
  walletKeypair: Keypair,
  outcomeMint: string,
  amount: number,
  connection: Connection
) {
  // 1. Verify market is redeemable
  const market = await fetch(
    `${METADATA_API}/api/v1/market/by-mint/${outcomeMint}`
  ).then(r => r.json());

  const settlementAccount = market.accounts?.[market.settlementMint];

  if (
    (market.status !== "determined" && market.status !== "finalized") ||
    settlementAccount?.redemptionStatus !== "open"
  ) {
    throw new Error("Market not redeemable yet");
  }

  // 2. Execute redemption via /order (outcome → settlement)
  const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

  const params = new URLSearchParams({
    inputMint: outcomeMint,
    outputMint: USDC,
    amount: (amount * 1_000_000).toString(),
    userPublicKey: walletKeypair.publicKey.toBase58(),
  });

  const orderResponse = await fetch(
    `${API_BASE}/order?${params.toString()}`
  ).then(r => r.json());

  const txBuffer = Buffer.from(orderResponse.transaction, "base64");
  const tx = VersionedTransaction.deserialize(txBuffer);
  tx.sign([walletKeypair]);

  const signature = await connection.sendTransaction(tx);
  return signature;
}
```

### Fee Structure

#### Trading Fees (Volume-Based Tiers)

| Tier | Monthly Volume | Taker Fee | Maker Fee |
|------|----------------|-----------|-----------|
| Frost | <$50M | 0.09 | 0.0225 |
| Glacier | $50-150M | 0.0875 | 0.021875 |
| Steel | $150-300M | 0.085 | 0.02125 |
| Obsidian | >$300M | 0.08 | 0.02 |

**Fee Formula:**
```
fee = roundup(taker_scale × c × p × (1 - p)) + (maker_scale × c × p × (1 - p))
```
Where `p` = fill price, `c` = contract quantity.

**Higher fees when outcomes uncertain, lower fees near resolution.**

#### Platform Fee Implementation

```typescript
// Fixed fee (basis points)
queryParams.append("platformFeeBps", "50");  // 0.5%
queryParams.append("platformFeeMode", "outputMint");
queryParams.append("feeAccount", "YourFeeTokenAccount");

// Dynamic fee for prediction markets
queryParams.append("platformFeeScale", "50");  // k value
// Formula: k × p × (1 - p) × c
```

#### Sponsorship Options

| Cost | Sponsorship Parameter |
|------|----------------------|
| Transaction fees | `sponsor` = sponsor wallet |
| ATA creation | `sponsor` = sponsor wallet |
| Market initialization | `predictionMarketInitPayer` |

**Market initialization cost: ~0.02 SOL** (one-time per market)

---

## Meteora LP Technologies

### Overview

Meteora is Solana's leading liquidity layer with $1B+ TVL, offering multiple AMM products optimized for different use cases.

### Product Comparison

| Product | Best For | Pool Cost | Auto-Compound | Yield Source |
|---------|----------|-----------|---------------|--------------|
| **DLMM** | Active trading, zero-slippage | ~0.25 SOL | No | Trading fees |
| **DAMM v2** | Idle capital, launches | ~0.022 SOL | No (claimable) | Fees + Dynamic Vaults |
| **DAMM v1** | Infinite range | ~0.05 SOL | Yes | Fees + lending |
| **Dynamic Vaults** | Pure yield | N/A | Yes | Lending protocols |

### DLMM (Dynamic Liquidity Market Maker)

**Architecture:**
- Organizes liquidity into discrete price **bins**
- Swaps within a bin suffer **zero slippage**
- Uses Q64.64 fixed-point arithmetic

**Price Formula:**
```
price = (1 + bin_step / 10000) ^ active_bin_id
```

**Fee Components:**
```
total_fee = base_fee + variable_fee
variable_fee = A × (volatility_accumulator × bin_step)² / 100000000000
```

**Best Use Cases:**
- Outcome token trading (0-1 price range perfect for bins)
- High-frequency trading pairs
- Active management with concentrated liquidity

**Strategy Types:**
| Shape | Description | Use Case |
|-------|-------------|----------|
| Spot | Uniform distribution | General purpose |
| Curve | Concentrated around current price | Stable pairs |
| Bid-Ask | Inverse curve | DCA strategies |

### DAMM v2 (Constant Product AMM)

**Key Features:**
- Positions are **Position NFTs** (transferable)
- LP fees **do not auto-compound** (claimable separately)
- Single-sided liquidity launch supported
- Lock liquidity with vesting while claiming fees
- Built-in farming (no external program)
- **10x cheaper than DLMM** (~0.022 SOL vs ~0.25 SOL)

**Token Compatibility:**
- SPL tokens
- Token 2022 (extensions)

**Fee Options:**
| Type | Description |
|------|-------------|
| Fixed Base Fee | 0.01% - 50% constant |
| Fee Time Scheduler | Decays over time |
| Fee Market Cap Scheduler | Reduces as price increases |
| Rate Limiter | Higher fees for larger trades |

**Dynamic Fee Formula:**
```
f_v = (v_a × s)² × C / 100000000000

Where:
- v_a = Volatility Accumulator (capped)
- s = Bin Step
- C = Variable Fee Control parameter
```

**Max dynamic fee = 20% of base fee** when `useDynamicFee` enabled.

### Dynamic Vaults

**Purpose:** Route idle liquidity across lending protocols for optimal APY.

**Architecture:**
- Single-token vaults (e.g., USDC vault)
- Off-chain keeper ("Hermes") calculates optimal allocation
- Rebalances every few minutes

**Risk Management:**
- If any lending pool utilization > 80% → full withdrawal for 12 hours
- Diversified across Solend, Tulip, etc.

**Supported Connections:**
- DAMM v1 pools → Yes
- DAMM v2 pools → Yes
- **DLMM pools → NO** (trading only, no vault connection)

### SDK Installation

```bash
# DLMM SDK
npm install @meteora-ag/dlmm @coral-xyz/anchor @solana/web3.js

# DAMM v2 SDK
npm install @meteora-ag/damm-v2

# Zap SDK (multi-protocol entry)
npm install @meteora-ag/zap
```

### Integration Example (DAMM v2)

```typescript
import { DAMM } from "@meteora-ag/damm-v2";

// Create pool with idle USDC
async function createIdleYieldPool(
  connection: Connection,
  wallet: Keypair,
  tokenA: PublicKey,  // USDC
  tokenB: PublicKey,  // Outcome token or other
) {
  const damm = new DAMM(connection);

  // Create pool (~0.022 SOL)
  const pool = await damm.createPool({
    tokenA,
    tokenB,
    configId: 0,  // Fee tier
    initialPrice: 1.0,
    activationType: "slot",  // or "timestamp"
    activationPoint: null,   // Immediate
  });

  // Add liquidity (returns Position NFT)
  const position = await damm.addLiquidity({
    pool: pool.publicKey,
    amountA: 1000_000_000,  // 1000 USDC
    amountB: 0,             // Single-sided
    slippage: 0.01,
  });

  return { pool, position };
}

// Claim fees (not auto-compounded)
async function claimFees(
  damm: DAMM,
  positionNft: PublicKey
) {
  const fees = await damm.claimFees({
    position: positionNft,
    claimInQuoteOnly: true,  // Get fees in single token
  });

  return fees;
}
```

---

## Solana Staking & Yield Infrastructure

### Liquid Staking Landscape

| Token | Provider | APY (2026) | TVL | MEV Rewards |
|-------|----------|------------|-----|-------------|
| **JitoSOL** | Jito | 5.89% | $2B+ | Yes |
| **mSOL** | Marinade | 5.5% | $1.5B | No |
| **INF** | Sanctum | 6.42% | $500M | Yes (via basket) |
| **bSOL** | Blaze | 5.7% | $300M | Yes |

### Sanctum Infinity (INF) - Recommended

**Why INF for BeRight:**
- Basket of LSTs (diversified risk)
- 6.42% base APY + trading fees
- Peaks above 20% during high-volume periods
- Perfect for treasury/reserve management

**Integration:**
```typescript
// Deposit SOL → INF
const sanctum = new SanctumClient(connection);
const infTokens = await sanctum.depositSol(
  wallet,
  solAmount,
  "INF"  // Receive INF tokens
);
```

### Multi-Yield Stack Strategy

```
┌──────────────────────────────────────────────────────────┐
│                  BeRight Yield Stack                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Layer 1: Base Yield (Treasury)                          │
│  ┌────────────────────────────────────────┐              │
│  │  SOL → INF (Sanctum Infinity)          │              │
│  │  APY: 6-9% (base + trading fees)       │              │
│  └────────────────────────────────────────┘              │
│                                                          │
│  Layer 2: Stablecoin Yield (Pool Reserves)               │
│  ┌────────────────────────────────────────┐              │
│  │  USDC → Meteora Dynamic Vault          │              │
│  │  APY: 6-12% (lending across protocols) │              │
│  └────────────────────────────────────────┘              │
│                                                          │
│  Layer 3: LP Yield (Active Capital)                      │
│  ┌────────────────────────────────────────┐              │
│  │  USDC/Outcome → DLMM Pools             │              │
│  │  APY: 10-50% (dynamic fees)            │              │
│  └────────────────────────────────────────┘              │
│                                                          │
│  Layer 4: Prediction Alpha (Core Product)                │
│  ┌────────────────────────────────────────┐              │
│  │  Forecaster skill → DFlow execution    │              │
│  │  Returns: Variable (skill-dependent)   │              │
│  └────────────────────────────────────────┘              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Profitable DeFi Strategies

### Strategy 1: Arbitrage Capture

**Market Opportunity:** $40M+ in documented arbitrage profits on Polymarket alone (2024-2025).

#### Single-Market Arbitrage

```typescript
// When YES + NO prices < $1, guaranteed profit
async function checkSingleMarketArb(market: Market): Promise<ArbOpportunity | null> {
  const yesBest = market.yesAsk / 100;  // Best ask for YES
  const noBest = market.noAsk / 100;    // Best ask for NO

  const totalCost = yesBest + noBest;

  if (totalCost < 0.99) {  // Account for fees
    const profit = 1 - totalCost;
    return {
      type: "single-market",
      market: market.ticker,
      yesCost: yesBest,
      noCost: noBest,
      grossProfit: profit,
      netProfit: profit - 0.01,  // ~1% fees
    };
  }

  return null;
}
```

#### Cross-Platform Arbitrage

```typescript
// Polymarket vs Kalshi price differences
interface CrossPlatformArb {
  event: string;
  polymarketYes: number;
  kalshiYes: number;
  spread: number;
  direction: "buy_poly_sell_kalshi" | "buy_kalshi_sell_poly";
}

async function findCrossArbs(): Promise<CrossPlatformArb[]> {
  const polyMarkets = await fetchPolymarketMarkets();
  const dflowMarkets = await fetchDFlowMarkets();  // Kalshi via DFlow

  const arbs: CrossPlatformArb[] = [];

  for (const poly of polyMarkets) {
    const kalshi = dflowMarkets.find(k =>
      matchMarketByEvent(poly, k)
    );

    if (!kalshi) continue;

    const spread = Math.abs(poly.yesPrice - kalshi.yesPrice);

    if (spread > 0.03) {  // 3% minimum spread
      arbs.push({
        event: poly.question,
        polymarketYes: poly.yesPrice,
        kalshiYes: kalshi.yesPrice,
        spread,
        direction: poly.yesPrice < kalshi.yesPrice
          ? "buy_poly_sell_kalshi"
          : "buy_kalshi_sell_poly",
      });
    }
  }

  return arbs;
}
```

### Strategy 2: Yield-Bearing Prediction Positions

**Concept:** Don't let capital sit idle while holding predictions.

```
┌─────────────────────────────────────────────────────────┐
│         Yield-Bearing Prediction Strategy                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Step 1: User deposits 1000 USDC                        │
│          │                                              │
│          ▼                                              │
│  Step 2: 700 USDC → DFlow position (YES tokens)         │
│          300 USDC → Meteora Dynamic Vault (6-12% APY)   │
│          │                                              │
│          ▼                                              │
│  Step 3: YES tokens → DLMM LP (earn trading fees)       │
│          │                                              │
│          ▼                                              │
│  Step 4: Before resolution:                             │
│          - Unwind DLMM position                         │
│          - Withdraw from vault                          │
│          - Redeem outcome tokens                        │
│                                                         │
│  Result: Prediction return + LP fees + vault yield      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### Implementation

```typescript
class YieldBearingPosition {
  private damm: DAMM;
  private dlmm: DLMM;
  private dflow: DFlowClient;

  async openPosition(
    usdcAmount: number,
    outcomeMint: string,
    allocationRatio: { prediction: number; reserve: number }
  ) {
    const predictionAmount = usdcAmount * allocationRatio.prediction;
    const reserveAmount = usdcAmount * allocationRatio.reserve;

    // 1. Open prediction position
    const predictionTx = await this.dflow.openPosition(
      outcomeMint,
      predictionAmount
    );

    // 2. Deposit reserve into Dynamic Vault
    const vaultDeposit = await this.damm.depositToVault(
      USDC_MINT,
      reserveAmount
    );

    // 3. Optionally LP the outcome tokens (advanced)
    // WARNING: Requires active management, IL risk on binary outcomes

    return {
      predictionTx,
      vaultDeposit,
      totalDeployed: usdcAmount,
    };
  }

  async closeBeforeResolution(positionId: string) {
    // 1. Unwind any LP positions first
    // 2. Withdraw from vault
    // 3. Sell outcome tokens before resolution (if desired)
  }
}
```

### Strategy 3: Forecaster Reputation Monetization

**Build on-chain Brier scores → attract delegated capital → earn performance fees.**

```typescript
// Brier Score Formula
// BS = (1/N) × Σ(forecast_i - outcome_i)²
// Lower is better (0 = perfect, 1 = worst)

interface BrierUpdate {
  forecaster: PublicKey;
  marketId: string;
  forecast: number;      // 0-1, probability given
  outcome: number;       // 0 or 1, actual result
  brierContribution: number;  // (forecast - outcome)²
}

function calculateBrierContribution(
  forecast: number,
  outcome: number
): number {
  return Math.pow(forecast - outcome, 2);
}

// On-chain update via calibration program
async function updateBrierScore(
  forecaster: PublicKey,
  marketId: string,
  forecast: number,
  outcome: number,
  calibrationProgram: Program
) {
  const brierDelta = calculateBrierContribution(forecast, outcome);

  await calibrationProgram.methods
    .recordPrediction({
      marketId,
      forecast: Math.floor(forecast * 10000),  // Scale to basis points
      outcome: outcome ? 1 : 0,
      brierContribution: Math.floor(brierDelta * 10000),
    })
    .accounts({
      forecaster,
      forecasterState: deriveForecasterStatePda(forecaster),
    })
    .rpc();
}
```

### Strategy 4: Pool-Based Delegation Protocol

**Core BeRight Product:**

```
┌───────────────────────────────────────────────────────────────┐
│                    Pool Lifecycle                              │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  Phase 1: Pool Creation                                       │
│  ┌─────────────────────────────────────────────┐             │
│  │  Forecaster creates pool:                    │             │
│  │  - Category: crypto/politics/sports          │             │
│  │  - Duration: 7d/30d/90d                      │             │
│  │  - Min stake: 50 USDC                        │             │
│  │  - Fee split: 20/64/16                       │             │
│  └─────────────────────────────────────────────┘             │
│                                                               │
│  Phase 2: Capital Raising                                     │
│  ┌─────────────────────────────────────────────┐             │
│  │  Delegators stake USDC:                      │             │
│  │  - Receive pool share tokens                 │             │
│  │  - Funds held in pool vault PDA              │             │
│  └─────────────────────────────────────────────┘             │
│                                                               │
│  Phase 3: Active Trading                                      │
│  ┌─────────────────────────────────────────────┐             │
│  │  Forecaster executes via DFlow:              │             │
│  │  - Open positions (KYC'd pool wallet)        │             │
│  │  - Idle capital → Meteora vault (yield)      │             │
│  │  - Track all positions on-chain              │             │
│  └─────────────────────────────────────────────┘             │
│                                                               │
│  Phase 4: Settlement                                          │
│  ┌─────────────────────────────────────────────┐             │
│  │  At pool expiry:                             │             │
│  │  - Redeem all resolved positions             │             │
│  │  - Sell any remaining tokens                 │             │
│  │  - Calculate total P&L                       │             │
│  │  - Distribute: 20% forecaster, 64% LPs, 16% │             │
│  │  - Update Brier scores                       │             │
│  └─────────────────────────────────────────────┘             │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Strategy 5: Market Making on Outcome Tokens

**Advanced:** Provide liquidity on prediction outcomes.

```typescript
// DLMM LP for outcome tokens
// Binary outcomes (0 or 1) map perfectly to DLMM bins

async function createOutcomeTokenLP(
  dlmm: DLMM,
  yesMint: PublicKey,
  noMint: PublicKey,
  usdcAmount: number
) {
  // Create DLMM pool for YES/USDC
  const pool = await dlmm.createPool({
    tokenA: yesMint,
    tokenB: USDC_MINT,
    binStep: 25,  // 0.25% per bin
    feeBps: 30,   // 0.3% base fee
  });

  // Add concentrated liquidity around current price
  const currentYesPrice = 0.65;  // 65% probability

  const position = await dlmm.addLiquidity({
    pool: pool.publicKey,
    strategy: {
      type: "BidAsk",  // Inverse curve for DCA-style
      minPrice: currentYesPrice * 0.9,
      maxPrice: currentYesPrice * 1.1,
    },
    amountA: yesTokens,
    amountB: usdcAmount,
  });

  // CRITICAL: Set reminder to unwind before market resolution!
  return { pool, position, unwrapBefore: market.closeTime };
}
```

**Risks:**
- Impermanent loss on binary outcomes can be severe
- Must unwind before resolution
- Active management required

---

## BeRight Implementation Architecture

### Smart Contract Structure (Anchor)

```rust
// programs/beright-pool/src/lib.rs

use anchor_lang::prelude::*;

declare_id!("BRtP..."); // Your program ID

#[program]
pub mod beright_pool {
    use super::*;

    /// Create a new forecaster pool
    pub fn create_pool(
        ctx: Context<CreatePool>,
        category: String,
        duration_seconds: i64,
        min_stake: u64,
        fee_split: FeeSplit,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.forecaster = ctx.accounts.forecaster.key();
        pool.category = category;
        pool.created_at = Clock::get()?.unix_timestamp;
        pool.settles_at = pool.created_at + duration_seconds;
        pool.min_stake = min_stake;
        pool.fee_split = fee_split;
        pool.total_staked = 0;
        pool.total_pnl = 0;
        pool.status = PoolStatus::Open;
        pool.bump = ctx.bumps.pool;
        Ok(())
    }

    /// Delegate capital to a pool
    pub fn stake(
        ctx: Context<Stake>,
        amount: u64,
    ) -> Result<()> {
        require!(amount >= ctx.accounts.pool.min_stake, ErrorCode::BelowMinStake);

        // Transfer USDC to pool vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.staker_usdc.to_account_info(),
            to: ctx.accounts.pool_vault.to_account_info(),
            authority: ctx.accounts.staker.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        // Record delegation
        let delegation = &mut ctx.accounts.delegation;
        delegation.pool = ctx.accounts.pool.key();
        delegation.delegator = ctx.accounts.staker.key();
        delegation.staked_amount = amount;
        delegation.staked_at = Clock::get()?.unix_timestamp;
        delegation.bump = ctx.bumps.delegation;

        // Update pool total
        ctx.accounts.pool.total_staked += amount;

        Ok(())
    }

    /// Forecaster opens a prediction position
    pub fn open_position(
        ctx: Context<OpenPosition>,
        market_id: String,
        outcome_mint: Pubkey,
        amount: u64,
        max_price: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.pool.status == PoolStatus::Active,
            ErrorCode::PoolNotActive
        );
        require!(
            ctx.accounts.pool.forecaster == ctx.accounts.forecaster.key(),
            ErrorCode::NotForecaster
        );

        // Record position intent
        // Actual DFlow execution happens off-chain with CPI or backend
        let position = &mut ctx.accounts.position;
        position.pool = ctx.accounts.pool.key();
        position.market_id = market_id;
        position.outcome_mint = outcome_mint;
        position.usdc_amount = amount;
        position.max_price = max_price;
        position.status = PositionStatus::IntentSubmitted;
        position.created_at = Clock::get()?.unix_timestamp;

        ctx.accounts.pool.active_positions += 1;

        Ok(())
    }

    /// Settle pool after duration expires
    pub fn settle_pool(ctx: Context<SettlePool>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        let clock = Clock::get()?;

        require!(
            clock.unix_timestamp >= pool.settles_at,
            ErrorCode::PoolNotExpired
        );
        require!(
            pool.active_positions == 0,
            ErrorCode::PositionsStillOpen
        );

        // Calculate P&L
        let final_balance = ctx.accounts.pool_vault.amount;
        let pnl = final_balance as i64 - pool.total_staked as i64;
        pool.total_pnl = pnl;

        if pnl > 0 {
            // Profit distribution
            let profit = pnl as u64;
            let forecaster_fee = profit * pool.fee_split.forecaster as u64 / 100;
            let platform_fee = profit * pool.fee_split.platform as u64 / 100;
            let delegator_return = profit - forecaster_fee - platform_fee;

            pool.forecaster_payout = forecaster_fee;
            pool.platform_payout = platform_fee;
            pool.delegator_pool = pool.total_staked + delegator_return;
        } else {
            // Loss: return remaining pro-rata
            pool.delegator_pool = final_balance;
        }

        pool.status = PoolStatus::Settled;

        Ok(())
    }

    /// Delegator claims their share
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        let pool = &ctx.accounts.pool;
        require!(pool.status == PoolStatus::Settled, ErrorCode::PoolNotSettled);

        let delegation = &mut ctx.accounts.delegation;
        require!(!delegation.claimed, ErrorCode::AlreadyClaimed);

        // Calculate share
        let share_ratio = delegation.staked_amount as u128 * 1_000_000
            / pool.total_staked as u128;
        let payout = (pool.delegator_pool as u128 * share_ratio / 1_000_000) as u64;

        // Transfer from vault
        let seeds = &[
            b"pool_vault",
            pool.to_account_info().key.as_ref(),
            &[pool.vault_bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.pool_vault.to_account_info(),
            to: ctx.accounts.delegator_usdc.to_account_info(),
            authority: ctx.accounts.pool_vault.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        token::transfer(cpi_ctx, payout)?;

        delegation.claimed = true;
        delegation.claimed_amount = payout;

        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct FeeSplit {
    pub forecaster: u8,  // e.g., 20
    pub delegator: u8,   // e.g., 64
    pub platform: u8,    // e.g., 16
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
pub enum PoolStatus {
    Open,
    Active,
    Settled,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
pub enum PositionStatus {
    IntentSubmitted,
    PartiallyFilled,
    Filled,
    Closed,
}

#[account]
pub struct Pool {
    pub forecaster: Pubkey,
    pub category: String,
    pub created_at: i64,
    pub settles_at: i64,
    pub min_stake: u64,
    pub fee_split: FeeSplit,
    pub total_staked: u64,
    pub total_pnl: i64,
    pub active_positions: u8,
    pub status: PoolStatus,
    pub forecaster_payout: u64,
    pub platform_payout: u64,
    pub delegator_pool: u64,
    pub bump: u8,
    pub vault_bump: u8,
}

#[account]
pub struct Delegation {
    pub pool: Pubkey,
    pub delegator: Pubkey,
    pub staked_amount: u64,
    pub staked_at: i64,
    pub claimed: bool,
    pub claimed_amount: u64,
    pub bump: u8,
}

#[account]
pub struct Position {
    pub pool: Pubkey,
    pub market_id: String,
    pub outcome_mint: Pubkey,
    pub usdc_amount: u64,
    pub max_price: u64,
    pub filled_amount: u64,
    pub avg_price: u64,
    pub status: PositionStatus,
    pub created_at: i64,
}
```

### Backend Integration

```typescript
// beright-ts/lib/pool/poolService.ts

import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { BeRightPool } from "../idl/beright_pool";

export class PoolService {
  private program: Program<BeRightPool>;
  private dflow: DFlowClient;
  private meteora: MeteoraClient;

  constructor(
    provider: AnchorProvider,
    dflowApiKey: string
  ) {
    this.program = new Program(IDL, PROGRAM_ID, provider);
    this.dflow = new DFlowClient(dflowApiKey);
    this.meteora = new MeteoraClient(provider.connection);
  }

  async createPool(
    forecaster: Keypair,
    params: {
      category: string;
      durationDays: number;
      minStake: number;
      feeSplit?: { forecaster: number; delegator: number; platform: number };
    }
  ) {
    const [poolPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pool"),
        forecaster.publicKey.toBuffer(),
        Buffer.from(Date.now().toString()),
      ],
      this.program.programId
    );

    const tx = await this.program.methods
      .createPool(
        params.category,
        new BN(params.durationDays * 86400),
        new BN(params.minStake * 1_000_000),
        params.feeSplit || { forecaster: 20, delegator: 64, platform: 16 }
      )
      .accounts({
        pool: poolPda,
        forecaster: forecaster.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([forecaster])
      .rpc();

    return { poolPda, tx };
  }

  async executePosition(
    pool: PublicKey,
    marketId: string,
    side: "YES" | "NO",
    usdcAmount: number
  ) {
    // 1. Get pool data
    const poolAccount = await this.program.account.pool.fetch(pool);

    // 2. Get market info from DFlow
    const market = await this.dflow.getMarketByTicker(marketId);
    const outcomeMint = side === "YES"
      ? market.accounts[market.settlementMint].yesMint
      : market.accounts[market.settlementMint].noMint;

    // 3. Record position intent on-chain
    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), pool.toBuffer(), Buffer.from(marketId)],
      this.program.programId
    );

    await this.program.methods
      .openPosition(marketId, new PublicKey(outcomeMint), new BN(usdcAmount), new BN(10000))
      .accounts({
        pool,
        position: positionPda,
        forecaster: poolAccount.forecaster,
        // ... other accounts
      })
      .rpc();

    // 4. Execute via DFlow (off-chain, uses pool vault as wallet)
    const order = await this.dflow.executeOrder({
      inputMint: USDC_MINT,
      outputMint: outcomeMint,
      amount: usdcAmount * 1_000_000,
      userPublicKey: this.getPoolVaultAddress(pool),
    });

    return order;
  }

  async depositIdleCapitalToVault(pool: PublicKey, amount: number) {
    // Move idle USDC to Meteora Dynamic Vault for yield
    const poolVault = this.getPoolVaultAddress(pool);

    const deposit = await this.meteora.depositToVault({
      vault: USDC_VAULT,
      amount: amount * 1_000_000,
      sourceAccount: poolVault,
    });

    return deposit;
  }
}
```

---

## Revenue Model & Fee Structures

### BeRight Platform Revenue

| Source | Rate | Trigger |
|--------|------|---------|
| Pool Performance Fee | 16% of profits | Pool settlement |
| Pool Creation Fee | 0.1 SOL | Pool creation |
| Premium Signals API | $29-99/mo | Subscription |
| Enterprise API | Custom | B2B agreement |
| Copy Trading Fee | 2% of volume | Copy execution |

### Fee Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Fee Flow Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Trade Execution (via DFlow)                                    │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │  User → Trade → DFlow Fee (0.08-0.09) → Execution        │ │
│  │                    │                                      │ │
│  │                    ▼                                      │ │
│  │           Platform Fee (platformFeeBps)                   │ │
│  │                    │                                      │ │
│  │                    ▼                                      │ │
│  │           BeRight Fee Account (USDC)                      │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Pool Settlement                                                │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │  Total Profit                                             │ │
│  │       │                                                   │ │
│  │       ├──▶ 20% → Forecaster Wallet                       │ │
│  │       │                                                   │ │
│  │       ├──▶ 64% → Delegator Pool (pro-rata)               │ │
│  │       │                                                   │ │
│  │       └──▶ 16% → Platform Treasury                       │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Yield Sources (Passive)                                        │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │  Meteora LP Fees → Pool (distributed at settlement)       │ │
│  │  Dynamic Vault Yield → Pool (accrues continuously)        │ │
│  │  LST Yield → Treasury (compounds)                         │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Projected Revenue (Conservative)

| Year | TVL | Avg Return | Platform Fee (16%) | Other Revenue | Total |
|------|-----|------------|---------------------|---------------|-------|
| Y1 | $100K | 30% | $4,800 | $5,000 | **$9,800** |
| Y2 | $1M | 30% | $48,000 | $20,000 | **$68,000** |
| Y3 | $10M | 25% | $400,000 | $100,000 | **$500,000** |
| Y4 | $50M | 20% | $1,600,000 | $400,000 | **$2,000,000** |

---

## Risk Analysis & Mitigations

### Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **KYC blocks program wallets** | High | Start with non-Kalshi markets (Polymarket, Manifold); contact DFlow about PDA verification |
| **DFlow CLP fills fail** | Medium | Implement timeout + refund mechanism; max 15min fill window |
| **Meteora vault exploit** | Medium | Cap vault exposure at 30%; diversify across protocols |
| **Smart contract bug** | Critical | Audit before mainnet; progressive rollout; insurance fund |
| **Outcome token LP IL** | Medium | Auto-unwind 24h before resolution; avoid narrow ranges |

### Operational Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Forecaster rugs delegators** | High | Time-locked withdrawals; reputation stakes; gradual access |
| **Market manipulation** | Medium | Concentration limits; multi-source price verification |
| **Oracle failure** | Medium | Multiple resolution sources; dispute mechanism |
| **Key compromise** | Critical | Multi-sig treasury; MPC for pool wallets |

### Regulatory Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **US/EU regulatory action** | High | Geoblocking; non-US entity; no fiat on/off ramps |
| **Securities classification** | Medium | Utility token design; no profit promises; legal review |
| **Exchange delistings** | Low | Self-custody focus; DEX liquidity |

### Risk Budget Allocation

```
┌────────────────────────────────────────────────────┐
│              Capital Allocation Limits              │
├────────────────────────────────────────────────────┤
│                                                    │
│  Per Pool:                                         │
│  - Max 30% in single market                        │
│  - Max 50% in Meteora vaults                       │
│  - Min 20% liquid (USDC reserve)                   │
│                                                    │
│  Platform Treasury:                                │
│  - 50% INF (Sanctum)                               │
│  - 30% USDC (Meteora Dynamic Vault)                │
│  - 20% SOL (operational)                           │
│                                                    │
│  Insurance Fund (from platform fees):              │
│  - 10% of all platform revenue                     │
│  - Used for: hack recovery, bad debt, disputes     │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

**Week 1-2: Fix Existing Gaps**
- [ ] Fix missing API endpoints (`/api/v2/portfolio`, `/api/v2/risk`)
- [ ] Restore deployment (Railway/Vercel)
- [ ] Deploy calibration program to mainnet
- [ ] Test DFlow dev endpoints end-to-end

**Week 3-4: Core Pool Contract**
- [ ] Design and implement Pool PDA schema
- [ ] Implement `create_pool`, `stake` instructions
- [ ] Create pool vault management
- [ ] Unit tests for all instructions

### Phase 2: DFlow Integration (Weeks 5-8)

**Week 5-6: Position Management**
- [ ] Implement `open_position` with DFlow CLP flow
- [ ] Handle async fill monitoring
- [ ] Position tracking in pool state
- [ ] Error handling for failed fills

**Week 7-8: Settlement**
- [ ] Implement redemption flow
- [ ] P&L calculation
- [ ] Profit distribution logic
- [ ] Brier score updates

### Phase 3: Yield Layer (Weeks 9-12)

**Week 9-10: Meteora Integration**
- [ ] DAMM v2 idle capital deployment
- [ ] Dynamic Vault integration
- [ ] Fee claiming logic

**Week 11-12: Advanced Features**
- [ ] Outcome token LP (optional)
- [ ] Auto-unwind before resolution
- [ ] Yield attribution per pool

### Phase 4: Launch (Weeks 13-16)

**Week 13-14: Testing & Audit**
- [ ] Security audit
- [ ] Testnet deployment
- [ ] Load testing
- [ ] Beta with 5 forecasters

**Week 15-16: Mainnet Launch**
- [ ] Mainnet deployment
- [ ] Gradual TVL caps
- [ ] Monitoring & alerts
- [ ] Public launch

---

## API Reference

### DFlow Quick Reference

```typescript
// Trading API Base
const TRADE_API = "https://dev-quote-api.dflow.net";
// Metadata API Base
const METADATA_API = "https://dev-prediction-markets-api.dflow.net";

// Headers
const headers = {
  "Content-Type": "application/json",
  "x-api-key": process.env.DFLOW_API_KEY || "",
};

// Key Endpoints
GET  /order                    // Get quote + transaction
GET  /order-status?signature=  // Check async order status
GET  /intent                   // Declarative quote
POST /submit-intent            // Submit declarative order
GET  /prediction-market-init   // Initialize market tokenization

// Metadata Endpoints
GET  /api/v1/events            // List events with markets
GET  /api/v1/markets           // List markets
GET  /api/v1/market/by-mint/:mint  // Get market by outcome mint
POST /api/v1/filter_outcome_mints  // Filter for outcome tokens
POST /api/v1/markets/batch     // Batch market lookup
GET  /api/v1/orderbook/:ticker // Get orderbook
```

### Meteora Quick Reference

```typescript
// SDK Installation
npm install @meteora-ag/dlmm @meteora-ag/damm-v2 @coral-xyz/anchor @solana/web3.js

// DLMM Program ID
const DLMM_PROGRAM = "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo";

// DAMM v2 Key Features
- Position NFTs (transferable)
- LP fees claimable separately
- Single-sided liquidity
- ~0.022 SOL pool creation cost
- Token 2022 support
```

### Solana LST Reference

```typescript
// Top LST Mints (Mainnet)
const JITO_SOL = "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn";
const MSOL = "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So";
const INF = "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm";
const BSOL = "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1";

// Sanctum INF APY: ~6.42% base + trading fees (peaks 20%+)
```

---

## DFlow Kalshi Trading Quick Reference

### Kalshi Market Hierarchy

```
Categories → Tags → Series → Events → Markets
    │          │        │         │        │
Sports   → Soccer → KXEPLGAME → WOL vs ARS → -ARS/-WOL/-TIE
```

Each **market** = one Yes/No binary contract. Each has `yesMint` + `noMint` per settlement token (USDC/CASH).

### API Endpoints (Dev = No Auth Required)

| API | Base URL | Purpose |
|-----|----------|---------|
| Metadata | `https://dev-prediction-markets-api.dflow.net` | Market discovery, pricing |
| Trade | `https://dev-quote-api.dflow.net` | Buy/redeem transactions |

**Note:** "Dev" is auth tier, NOT devnet. All trades execute on mainnet-beta.

### Discovery Flow (3 Calls)

```bash
# 1. Get available tags
GET /api/v1/tags_by_categories
# → {"Sports": ["Soccer", "Basketball", ...]}

# 2. Find series by category+tag
GET /api/v1/series?category=Sports&tags=Soccer
# → ticker: "KXEPLGAME" (EPL Game)

# 3. Get active events with markets
GET /api/v1/events?seriesTickers=KXEPLGAME&status=active&withNestedMarkets=true
# → events[].markets[].accounts["USDC_MINT"].{yesMint, noMint}
```

### Market Response Structure

```typescript
{
  ticker: "KXEPLGAME-26FEB18WOLARS-ARS",
  yesAsk: "0.77",  // Price to buy YES
  noAsk: "0.23",   // Price to buy NO
  accounts: {
    "EPjFWdd5...Dt1v": {  // USDC settlement mint
      yesMint: "EahtAm7...",  // SPL token for YES position
      noMint: "4kXWe1o...",   // SPL token for NO position
      redemptionStatus: "pending" | "open"
    }
  }
}
```

### Trading Lifecycle

```typescript
// 1. BUY OUTCOME TOKEN
const params = new URLSearchParams({
  inputMint: USDC_MINT,
  outputMint: yesMint,  // or noMint
  amount: String(usdcAmount * 1_000_000),  // 6 decimals
  userPublicKey: wallet.address,
  slippageBps: "auto"
});
const order = await fetch(`${TRADE_API}/order?${params}`).then(r => r.json());

// Sign + send returned transaction
const tx = getTransactionDecoder().decode(Buffer.from(order.transaction, 'base64'));
const signed = await signTransaction([keyPair], tx);
await sendTransaction(signed);

// 2. TRACK POSITIONS - Filter wallet tokens for outcome mints
const market = await fetch(`${METADATA_API}/api/v1/market/by-mint/${tokenMint}`);
const side = market.accounts[USDC].yesMint === tokenMint ? "YES" : "NO";

// 3. REDEEM WINNING TOKENS (same /order endpoint, reversed direction)
const redeemParams = new URLSearchParams({
  inputMint: outcomeMint,  // Your winning YES/NO token
  outputMint: USDC_MINT,   // Receive USDC
  amount: String(tokenBalance),
  userPublicKey: wallet.address
});
```

### Redemption Rules

| Condition | Required Value |
|-----------|----------------|
| Market status | `determined` or `finalized` |
| redemptionStatus | `open` |
| Your token | Must match winning side (`result === "yes"` → yesMint) |

### Execution Modes

| Mode | Used For | Flow |
|------|----------|------|
| `sync` | Spot swaps | 1 transaction |
| `async` | Prediction markets | Intent → LP fills → Poll status |

```typescript
// Poll async order until filled
while (true) {
  const status = await fetch(`${TRADE_API}/order-status?signature=${sig}`);
  if (['closed', 'expired', 'failed'].includes(status.status)) break;
  await sleep(2000);
}
```

### Binary Market Payoff Matrix (EPL Example)

| Market | Token | Arsenal wins | Wolves wins | Draw |
|--------|-------|--------------|-------------|------|
| -ARS | YES | ✅ $1 | ❌ $0 | ❌ $0 |
| -ARS | NO | ❌ $0 | ✅ $1 | ✅ $1 |
| -WOL | YES | ❌ $0 | ✅ $1 | ❌ $0 |
| -TIE | YES | ❌ $0 | ❌ $0 | ✅ $1 |

**Critical:** Buy the specific market matching your exact prediction. YES-ARS ≠ NO-WOL.

### Production Checklist

- [ ] Replace `dev-` URLs with production endpoints + API key (`x-api-key` header)
- [ ] KYC wallet via DFlow Proof before buying
- [ ] Handle async order expiry (no fill within timeout)
- [ ] Geoblocking: US, EU (France/Italy/Belgium/Poland), UK, Singapore, China blocked
- [ ] Market can be `suspended` temporarily - always check status

### Key Constants

```typescript
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
```

---

## Summary: What to Build Next

### Immediate Priorities (This Week)

1. **Fix `/api/v2/portfolio` and `/api/v2/risk` endpoints** - Unblocks terminal UI
2. **Restore deployment** - Railway or Vercel (EC2 expired)
3. **Test DFlow dev endpoints** - Verify execution flow works

### Core Architecture (Month 1)

1. **Pool smart contract** - PDAs for pools, delegations, positions
2. **DFlow execution integration** - Handle async CLP fills
3. **Settlement logic** - P&L calculation, profit distribution

### Yield Layer (Month 2)

1. **Meteora DAMM v2** - Idle capital yield
2. **Brier score updates** - On-chain reputation
3. **Premium API** - Signal monetization

### The Moat

**On-chain Brier scores are the defensible asset.** Once forecasters have portable, verifiable track records, capital will follow. Ship the pool architecture, get 10 forecasters with real scores, and the flywheel begins.

---

## Sources

### DFlow/Pond Documentation
- [DFlow Introduction](https://pond.dflow.net/introduction)
- [Build with DFlow](https://pond.dflow.net/build/introduction)
- [API Endpoints](https://pond.dflow.net/build/endpoints)
- [Trading API](https://pond.dflow.net/build/trading-api/introduction)
- [Prediction Markets](https://pond.dflow.net/build/prediction-markets/kyc)
- [Proof KYC](https://pond.dflow.net/build/proof/introduction)
- [Code Recipes](https://pond.dflow.net/build/recipes/)

### Meteora Documentation
- [DAMM v2 Overview](https://docs.meteora.ag/overview/products/damm-v2/what-is-damm-v2)
- [DAMM v2 Fees](https://docs.meteora.ag/overview/products/damm-v2/damm-v2-fee-calculation)
- [Developer Guide](https://docs.meteora.ag/developer-guide/home)

### Research & Market Data
- [Prediction Market Arbitrage Guide 2026](https://newyorkcityservers.com/blog/prediction-market-arbitrage-guide)
- [Solana Liquid Staking Guide 2025](https://sanctum.so/blog/solana-liquid-staking-guide)
- [Best Solana Yield 2026](https://sanctum.so/blog/best-solana-yield-2026-staking-vs-defi)
- [DFlow Prediction Markets API](https://solana.com/news/dflow-prediction-markets-api)
- [Meteora DLMM Protocol](https://meteoraag.medium.com/dlmm-new-dynamic-liquidity-protocol-to-boost-lp-fees-on-solana)

---

*Document generated by BeRight Technical Team - March 2026*
