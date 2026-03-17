# BeRight Yield Layer Implementation Plan

> **Target:** Meteora + Sanctum integration for multi-layer yield stack
> **Estimated Effort:** ~2,500 lines TypeScript
> **Priority:** CRITICAL (blocks revenue model)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BeRight Yield Stack                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Layer 1: Treasury Yield (Sanctum INF)                              │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  SOL Treasury → INF Token (6-9% APY + MEV)                  │    │
│  │  lib/yield/sanctum.ts                                       │    │
│  └────────────────────────────────────────────────────────────┘    │
│                           │                                         │
│                           ▼                                         │
│  Layer 2: Reserve Yield (Meteora Dynamic Vaults)                    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Idle USDC → Dynamic Vault (6-12% APY via lending)          │    │
│  │  lib/yield/meteora/vault.ts                                 │    │
│  └────────────────────────────────────────────────────────────┘    │
│                           │                                         │
│                           ▼                                         │
│  Layer 3: Active LP Yield (Meteora DAMM v2)                         │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Pool Capital → DAMM v2 Pools (10-20% APY)                  │    │
│  │  lib/yield/meteora/damm.ts                                  │    │
│  └────────────────────────────────────────────────────────────┘    │
│                           │                                         │
│                           ▼                                         │
│  Orchestration Layer                                                │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Yield Orchestrator - Routes capital across layers          │    │
│  │  lib/yield/orchestrator.ts                                  │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation & Types

### 1.1 Core Types (`lib/yield/types.ts`)

```typescript
// Yield source identifiers
export type YieldSource =
  | 'sanctum_inf'      // Layer 1: SOL → INF
  | 'meteora_vault'    // Layer 2: USDC → Dynamic Vault
  | 'meteora_damm'     // Layer 3: USDC → DAMM v2 LP
  | 'meteora_dlmm';    // Layer 3 (advanced): Outcome token LP

// Position in a yield source
export interface YieldPosition {
  id: string;
  source: YieldSource;

  // Principal
  depositedAmount: number;
  depositedMint: string;
  depositedAt: Date;

  // Current value
  currentValue: number;
  unrealizedYield: number;
  claimableYield: number;

  // For LP positions
  positionNft?: string;  // DAMM v2 position NFT
  poolAddress?: string;

  // APY tracking
  estimatedApy: number;
  realizedApy: number;

  // Status
  status: 'active' | 'withdrawing' | 'closed';
}

// Yield allocation strategy
export interface YieldStrategy {
  id: string;
  name: string;

  // Allocation percentages (must sum to 100)
  allocations: {
    sanctumInf: number;      // e.g., 20%
    meteoraVault: number;    // e.g., 50%
    meteoraDamm: number;     // e.g., 30%
  };

  // Constraints
  minDeposit: number;
  rebalanceThreshold: number;  // % deviation before rebalance

  // Risk parameters
  maxSinglePoolExposure: number;
  minLiquidReserve: number;
}

// Yield pool for forecaster delegations
export interface YieldPool {
  poolPubkey: string;
  forecasterPubkey: string;

  // Capital
  totalDeposited: number;
  currentValue: number;

  // Yield positions
  positions: YieldPosition[];

  // Strategy
  strategy: YieldStrategy;

  // Performance
  totalYieldEarned: number;
  weightedApy: number;

  // Timestamps
  createdAt: Date;
  lastRebalanceAt: Date;
}

// Yield claim result
export interface YieldClaimResult {
  success: boolean;
  claimedAmount: number;
  claimedMint: string;
  txSignature?: string;
  error?: string;
}
```

### 1.2 Constants (`lib/yield/constants.ts`)

```typescript
// Sanctum
export const INF_MINT = '5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm';
export const SANCTUM_PROGRAM = 'SANcxYz3H8BpjqYBbBbvJxRJwvPqgPU3nZiK3yF7Zcz';

// Meteora
export const DLMM_PROGRAM = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo';
export const DAMM_V2_PROGRAM = 'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB';
export const USDC_VAULT = 'USDC_DYNAMIC_VAULT_ADDRESS';  // Get from Meteora

// Common
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const WSOL_MINT = 'So11111111111111111111111111111111111111112';

// Default strategy
export const DEFAULT_YIELD_STRATEGY: YieldStrategy = {
  id: 'balanced',
  name: 'Balanced Yield',
  allocations: {
    sanctumInf: 20,      // 20% in INF for base yield
    meteoraVault: 50,    // 50% in Dynamic Vault for stable yield
    meteoraDamm: 30,     // 30% in DAMM v2 for higher yield
  },
  minDeposit: 100,       // 100 USDC minimum
  rebalanceThreshold: 5, // Rebalance if >5% deviation
  maxSinglePoolExposure: 30,
  minLiquidReserve: 20,  // Keep 20% liquid
};
```

---

## Phase 2: Sanctum INF Integration

### 2.1 Sanctum Client (`lib/yield/sanctum.ts`)

```typescript
/**
 * Sanctum Infinity (INF) Client
 *
 * Converts SOL → INF for treasury yield (6-9% APY + MEV).
 * INF is a basket of LSTs providing diversified staking yield.
 */

import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import { INF_MINT, SANCTUM_PROGRAM } from './constants';

export interface SanctumDepositResult {
  success: boolean;
  solDeposited: number;
  infReceived: number;
  txSignature?: string;
  error?: string;
}

export interface SanctumWithdrawResult {
  success: boolean;
  infBurned: number;
  solReceived: number;
  txSignature?: string;
  error?: string;
}

export interface InfStats {
  totalSupply: number;
  navPerToken: number;  // SOL value per INF
  currentApy: number;
  basketComposition: {
    lstMint: string;
    lstName: string;
    weight: number;
  }[];
}

export class SanctumClient {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Get current INF stats and APY
   */
  async getInfStats(): Promise<InfStats> {
    // Fetch from Sanctum API
    const response = await fetch('https://sanctum.so/api/v1/inf/stats');
    const data = await response.json();

    return {
      totalSupply: data.totalSupply,
      navPerToken: data.navPerToken,
      currentApy: data.apy,
      basketComposition: data.composition,
    };
  }

  /**
   * Deposit SOL and receive INF tokens
   */
  async depositSol(
    wallet: Keypair,
    solAmount: number
  ): Promise<SanctumDepositResult> {
    try {
      // 1. Get quote from Sanctum
      const quote = await this.getDepositQuote(solAmount);

      // 2. Build transaction via Sanctum API
      const txResponse = await fetch('https://sanctum.so/api/v1/inf/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: wallet.publicKey.toBase58(),
          solAmount: solAmount * 1e9,  // lamports
        }),
      });

      const { transaction } = await txResponse.json();

      // 3. Sign and send
      const tx = Transaction.from(Buffer.from(transaction, 'base64'));
      tx.sign(wallet);

      const signature = await this.connection.sendRawTransaction(
        tx.serialize()
      );

      await this.connection.confirmTransaction(signature);

      return {
        success: true,
        solDeposited: solAmount,
        infReceived: quote.infAmount,
        txSignature: signature,
      };
    } catch (error) {
      return {
        success: false,
        solDeposited: 0,
        infReceived: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Withdraw SOL by burning INF tokens
   */
  async withdrawSol(
    wallet: Keypair,
    infAmount: number
  ): Promise<SanctumWithdrawResult> {
    try {
      // 1. Get withdrawal quote
      const quote = await this.getWithdrawQuote(infAmount);

      // 2. Build transaction via Sanctum API
      const txResponse = await fetch('https://sanctum.so/api/v1/inf/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: wallet.publicKey.toBase58(),
          infAmount: infAmount * 1e9,
        }),
      });

      const { transaction } = await txResponse.json();

      // 3. Sign and send
      const tx = Transaction.from(Buffer.from(transaction, 'base64'));
      tx.sign(wallet);

      const signature = await this.connection.sendRawTransaction(
        tx.serialize()
      );

      await this.connection.confirmTransaction(signature);

      return {
        success: true,
        infBurned: infAmount,
        solReceived: quote.solAmount,
        txSignature: signature,
      };
    } catch (error) {
      return {
        success: false,
        infBurned: 0,
        solReceived: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get INF balance for a wallet
   */
  async getInfBalance(wallet: PublicKey): Promise<number> {
    const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
      wallet,
      { mint: new PublicKey(INF_MINT) }
    );

    if (tokenAccounts.value.length === 0) return 0;

    return tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
  }

  /**
   * Calculate current SOL value of INF holdings
   */
  async getInfValueInSol(infAmount: number): Promise<number> {
    const stats = await this.getInfStats();
    return infAmount * stats.navPerToken;
  }

  private async getDepositQuote(solAmount: number): Promise<{ infAmount: number }> {
    const stats = await this.getInfStats();
    return {
      infAmount: solAmount / stats.navPerToken,
    };
  }

  private async getWithdrawQuote(infAmount: number): Promise<{ solAmount: number }> {
    const stats = await this.getInfStats();
    return {
      solAmount: infAmount * stats.navPerToken,
    };
  }
}
```

---

## Phase 3: Meteora Dynamic Vault Integration

### 3.1 Dynamic Vault Client (`lib/yield/meteora/vault.ts`)

```typescript
/**
 * Meteora Dynamic Vault Client
 *
 * Routes USDC to lending protocols for 6-12% APY.
 * Uses off-chain keeper ("Hermes") for optimal allocation.
 */

import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import { USDC_MINT, USDC_VAULT } from '../constants';

export interface VaultStats {
  totalDeposits: number;
  totalShares: number;
  sharePrice: number;  // USDC per share
  currentApy: number;
  utilizationRate: number;

  // Allocation across lending protocols
  allocations: {
    protocol: string;
    amount: number;
    apy: number;
  }[];
}

export interface VaultDepositResult {
  success: boolean;
  usdcDeposited: number;
  sharesReceived: number;
  txSignature?: string;
  error?: string;
}

export interface VaultWithdrawResult {
  success: boolean;
  sharesBurned: number;
  usdcReceived: number;
  txSignature?: string;
  error?: string;
}

export class MeteoraVaultClient {
  private connection: Connection;
  private vaultAddress: PublicKey;

  constructor(connection: Connection, vaultAddress?: string) {
    this.connection = connection;
    this.vaultAddress = new PublicKey(vaultAddress || USDC_VAULT);
  }

  /**
   * Get vault statistics and APY
   */
  async getVaultStats(): Promise<VaultStats> {
    // Fetch vault state from on-chain
    const vaultAccount = await this.connection.getAccountInfo(this.vaultAddress);

    if (!vaultAccount) {
      throw new Error('Vault not found');
    }

    // Decode vault state (structure depends on Meteora IDL)
    // For now, fetch from Meteora API
    const response = await fetch(
      `https://api.meteora.ag/vault/${this.vaultAddress.toBase58()}`
    );
    const data = await response.json();

    return {
      totalDeposits: data.totalDeposits / 1e6,  // USDC 6 decimals
      totalShares: data.totalShares,
      sharePrice: data.sharePrice,
      currentApy: data.apy,
      utilizationRate: data.utilization,
      allocations: data.allocations.map((a: any) => ({
        protocol: a.name,
        amount: a.amount / 1e6,
        apy: a.apy,
      })),
    };
  }

  /**
   * Deposit USDC into vault
   */
  async deposit(
    wallet: Keypair,
    usdcAmount: number
  ): Promise<VaultDepositResult> {
    try {
      const stats = await this.getVaultStats();
      const expectedShares = usdcAmount / stats.sharePrice;

      // Build deposit instruction via Meteora SDK
      // Using direct API for simplicity
      const txResponse = await fetch('https://api.meteora.ag/vault/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vault: this.vaultAddress.toBase58(),
          wallet: wallet.publicKey.toBase58(),
          amount: Math.floor(usdcAmount * 1e6),
        }),
      });

      const { transaction } = await txResponse.json();

      const tx = Transaction.from(Buffer.from(transaction, 'base64'));
      tx.sign(wallet);

      const signature = await this.connection.sendRawTransaction(
        tx.serialize()
      );

      await this.connection.confirmTransaction(signature);

      return {
        success: true,
        usdcDeposited: usdcAmount,
        sharesReceived: expectedShares,
        txSignature: signature,
      };
    } catch (error) {
      return {
        success: false,
        usdcDeposited: 0,
        sharesReceived: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Withdraw USDC from vault
   */
  async withdraw(
    wallet: Keypair,
    shares: number
  ): Promise<VaultWithdrawResult> {
    try {
      const stats = await this.getVaultStats();
      const expectedUsdc = shares * stats.sharePrice;

      // Check utilization - if >80%, may need to wait
      if (stats.utilizationRate > 0.8) {
        console.warn('High utilization - withdrawal may be delayed');
      }

      const txResponse = await fetch('https://api.meteora.ag/vault/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vault: this.vaultAddress.toBase58(),
          wallet: wallet.publicKey.toBase58(),
          shares: Math.floor(shares),
        }),
      });

      const { transaction } = await txResponse.json();

      const tx = Transaction.from(Buffer.from(transaction, 'base64'));
      tx.sign(wallet);

      const signature = await this.connection.sendRawTransaction(
        tx.serialize()
      );

      await this.connection.confirmTransaction(signature);

      return {
        success: true,
        sharesBurned: shares,
        usdcReceived: expectedUsdc,
        txSignature: signature,
      };
    } catch (error) {
      return {
        success: false,
        sharesBurned: 0,
        usdcReceived: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get share balance for a wallet
   */
  async getShareBalance(wallet: PublicKey): Promise<number> {
    // Vault shares are LP tokens with their own mint
    const vaultStats = await this.getVaultStats();

    // Get vault share token mint from vault state
    const response = await fetch(
      `https://api.meteora.ag/vault/${this.vaultAddress.toBase58()}/share-mint`
    );
    const { shareMint } = await response.json();

    const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
      wallet,
      { mint: new PublicKey(shareMint) }
    );

    if (tokenAccounts.value.length === 0) return 0;

    return tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
  }

  /**
   * Get USDC value of share balance
   */
  async getUsdcValue(wallet: PublicKey): Promise<number> {
    const shares = await this.getShareBalance(wallet);
    const stats = await this.getVaultStats();
    return shares * stats.sharePrice;
  }
}
```

---

## Phase 4: Meteora DAMM v2 Integration

### 4.1 DAMM v2 Client (`lib/yield/meteora/damm.ts`)

```typescript
/**
 * Meteora DAMM v2 Client
 *
 * Creates LP positions with Position NFTs for 10-20% APY.
 * Supports single-sided liquidity and fee claiming.
 */

import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import { DAMM_V2_PROGRAM, USDC_MINT } from '../constants';

export interface DammPoolInfo {
  address: string;
  tokenA: string;
  tokenB: string;
  tokenAReserve: number;
  tokenBReserve: number;
  lpSupply: number;
  feeRate: number;
  currentPrice: number;
  apy24h: number;
  volume24h: number;
}

export interface DammPosition {
  positionNft: string;
  pool: string;
  tokenADeposited: number;
  tokenBDeposited: number;
  currentValueA: number;
  currentValueB: number;
  unclaimedFeesA: number;
  unclaimedFeesB: number;
  createdAt: Date;
}

export interface AddLiquidityResult {
  success: boolean;
  positionNft: string;
  tokenADeposited: number;
  tokenBDeposited: number;
  txSignature?: string;
  error?: string;
}

export interface RemoveLiquidityResult {
  success: boolean;
  tokenAReceived: number;
  tokenBReceived: number;
  txSignature?: string;
  error?: string;
}

export interface ClaimFeesResult {
  success: boolean;
  feesClaimedA: number;
  feesClaimedB: number;
  txSignature?: string;
  error?: string;
}

export class MeteoraDammClient {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Get all DAMM v2 pools
   */
  async getPools(tokenMint?: string): Promise<DammPoolInfo[]> {
    const url = tokenMint
      ? `https://api.meteora.ag/damm-v2/pools?token=${tokenMint}`
      : 'https://api.meteora.ag/damm-v2/pools';

    const response = await fetch(url);
    const data = await response.json();

    return data.pools.map((p: any) => ({
      address: p.address,
      tokenA: p.tokenA,
      tokenB: p.tokenB,
      tokenAReserve: p.reserveA / Math.pow(10, p.decimalsA),
      tokenBReserve: p.reserveB / Math.pow(10, p.decimalsB),
      lpSupply: p.lpSupply,
      feeRate: p.feeRate,
      currentPrice: p.price,
      apy24h: p.apy24h,
      volume24h: p.volume24h,
    }));
  }

  /**
   * Get pool by address
   */
  async getPool(poolAddress: string): Promise<DammPoolInfo> {
    const response = await fetch(
      `https://api.meteora.ag/damm-v2/pool/${poolAddress}`
    );
    const p = await response.json();

    return {
      address: p.address,
      tokenA: p.tokenA,
      tokenB: p.tokenB,
      tokenAReserve: p.reserveA / Math.pow(10, p.decimalsA),
      tokenBReserve: p.reserveB / Math.pow(10, p.decimalsB),
      lpSupply: p.lpSupply,
      feeRate: p.feeRate,
      currentPrice: p.price,
      apy24h: p.apy24h,
      volume24h: p.volume24h,
    };
  }

  /**
   * Create a new DAMM v2 pool (~0.022 SOL)
   */
  async createPool(
    wallet: Keypair,
    tokenA: string,
    tokenB: string,
    initialPrice: number,
    feeRate: number = 30  // 0.3% default
  ): Promise<{ poolAddress: string; txSignature: string }> {
    const response = await fetch('https://api.meteora.ag/damm-v2/create-pool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: wallet.publicKey.toBase58(),
        tokenA,
        tokenB,
        initialPrice,
        feeRate,
      }),
    });

    const { transaction, poolAddress } = await response.json();

    const tx = Transaction.from(Buffer.from(transaction, 'base64'));
    tx.sign(wallet);

    const signature = await this.connection.sendRawTransaction(
      tx.serialize()
    );

    await this.connection.confirmTransaction(signature);

    return { poolAddress, txSignature: signature };
  }

  /**
   * Add liquidity to pool (returns Position NFT)
   */
  async addLiquidity(
    wallet: Keypair,
    poolAddress: string,
    amountA: number,
    amountB: number,
    slippageBps: number = 50
  ): Promise<AddLiquidityResult> {
    try {
      const pool = await this.getPool(poolAddress);

      const response = await fetch('https://api.meteora.ag/damm-v2/add-liquidity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: wallet.publicKey.toBase58(),
          pool: poolAddress,
          amountA: Math.floor(amountA * 1e6),  // Assuming 6 decimals
          amountB: Math.floor(amountB * 1e6),
          slippageBps,
        }),
      });

      const { transaction, positionNft } = await response.json();

      const tx = Transaction.from(Buffer.from(transaction, 'base64'));
      tx.sign(wallet);

      const signature = await this.connection.sendRawTransaction(
        tx.serialize()
      );

      await this.connection.confirmTransaction(signature);

      return {
        success: true,
        positionNft,
        tokenADeposited: amountA,
        tokenBDeposited: amountB,
        txSignature: signature,
      };
    } catch (error) {
      return {
        success: false,
        positionNft: '',
        tokenADeposited: 0,
        tokenBDeposited: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Add single-sided liquidity (USDC only)
   */
  async addSingleSidedLiquidity(
    wallet: Keypair,
    poolAddress: string,
    usdcAmount: number,
    slippageBps: number = 100
  ): Promise<AddLiquidityResult> {
    // Single-sided adds USDC, receives position
    return this.addLiquidity(wallet, poolAddress, usdcAmount, 0, slippageBps);
  }

  /**
   * Remove liquidity (burns Position NFT)
   */
  async removeLiquidity(
    wallet: Keypair,
    positionNft: string,
    percentToRemove: number = 100
  ): Promise<RemoveLiquidityResult> {
    try {
      const response = await fetch('https://api.meteora.ag/damm-v2/remove-liquidity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: wallet.publicKey.toBase58(),
          positionNft,
          percentToRemove,
        }),
      });

      const { transaction, tokenAReceived, tokenBReceived } = await response.json();

      const tx = Transaction.from(Buffer.from(transaction, 'base64'));
      tx.sign(wallet);

      const signature = await this.connection.sendRawTransaction(
        tx.serialize()
      );

      await this.connection.confirmTransaction(signature);

      return {
        success: true,
        tokenAReceived: tokenAReceived / 1e6,
        tokenBReceived: tokenBReceived / 1e6,
        txSignature: signature,
      };
    } catch (error) {
      return {
        success: false,
        tokenAReceived: 0,
        tokenBReceived: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Claim accumulated fees (does NOT auto-compound)
   */
  async claimFees(
    wallet: Keypair,
    positionNft: string,
    claimInSingleToken: boolean = true
  ): Promise<ClaimFeesResult> {
    try {
      const response = await fetch('https://api.meteora.ag/damm-v2/claim-fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: wallet.publicKey.toBase58(),
          positionNft,
          claimInQuoteOnly: claimInSingleToken,
        }),
      });

      const { transaction, feesA, feesB } = await response.json();

      const tx = Transaction.from(Buffer.from(transaction, 'base64'));
      tx.sign(wallet);

      const signature = await this.connection.sendRawTransaction(
        tx.serialize()
      );

      await this.connection.confirmTransaction(signature);

      return {
        success: true,
        feesClaimedA: feesA / 1e6,
        feesClaimedB: feesB / 1e6,
        txSignature: signature,
      };
    } catch (error) {
      return {
        success: false,
        feesClaimedA: 0,
        feesClaimedB: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get all positions for a wallet
   */
  async getPositions(wallet: PublicKey): Promise<DammPosition[]> {
    const response = await fetch(
      `https://api.meteora.ag/damm-v2/positions?wallet=${wallet.toBase58()}`
    );
    const data = await response.json();

    return data.positions.map((p: any) => ({
      positionNft: p.nft,
      pool: p.pool,
      tokenADeposited: p.depositedA / 1e6,
      tokenBDeposited: p.depositedB / 1e6,
      currentValueA: p.currentA / 1e6,
      currentValueB: p.currentB / 1e6,
      unclaimedFeesA: p.feesA / 1e6,
      unclaimedFeesB: p.feesB / 1e6,
      createdAt: new Date(p.createdAt * 1000),
    }));
  }
}
```

---

## Phase 5: Yield Orchestrator

### 5.1 Orchestrator Service (`lib/yield/orchestrator.ts`)

```typescript
/**
 * Yield Orchestrator
 *
 * Routes capital across yield sources according to strategy.
 * Handles rebalancing, fee claiming, and yield attribution.
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { SanctumClient } from './sanctum';
import { MeteoraVaultClient } from './meteora/vault';
import { MeteoraDammClient } from './meteora/damm';
import {
  YieldPosition,
  YieldStrategy,
  YieldPool,
  YieldSource,
  DEFAULT_YIELD_STRATEGY
} from './types';
import { supabaseAdmin } from '../supabase/client';

export interface YieldAllocationResult {
  success: boolean;
  positions: YieldPosition[];
  totalDeployed: number;
  estimatedApy: number;
  error?: string;
}

export interface RebalanceResult {
  success: boolean;
  positionsAdjusted: number;
  amountsMoved: number;
  newAllocations: { source: YieldSource; amount: number; percent: number }[];
  error?: string;
}

export class YieldOrchestrator {
  private connection: Connection;
  private sanctum: SanctumClient;
  private vault: MeteoraVaultClient;
  private damm: MeteoraDammClient;

  constructor(connection: Connection) {
    this.connection = connection;
    this.sanctum = new SanctumClient(connection);
    this.vault = new MeteoraVaultClient(connection);
    this.damm = new MeteoraDammClient(connection);
  }

  /**
   * Deploy capital according to yield strategy
   */
  async deployCapital(
    wallet: Keypair,
    totalUsdc: number,
    strategy: YieldStrategy = DEFAULT_YIELD_STRATEGY
  ): Promise<YieldAllocationResult> {
    const positions: YieldPosition[] = [];
    let totalDeployed = 0;

    try {
      // Calculate allocations
      const liquidReserve = totalUsdc * (strategy.minLiquidReserve / 100);
      const deployable = totalUsdc - liquidReserve;

      const sanctumAmount = deployable * (strategy.allocations.sanctumInf / 100);
      const vaultAmount = deployable * (strategy.allocations.meteoraVault / 100);
      const dammAmount = deployable * (strategy.allocations.meteoraDamm / 100);

      // 1. Deploy to Sanctum INF (convert USDC → SOL → INF)
      if (sanctumAmount > 0) {
        // First swap USDC → SOL via Jupiter
        // Then deposit SOL → INF
        // Simplified: assume we have SOL already
        const solAmount = sanctumAmount / 150;  // Rough USDC/SOL rate
        const infResult = await this.sanctum.depositSol(wallet, solAmount);

        if (infResult.success) {
          positions.push({
            id: `inf-${Date.now()}`,
            source: 'sanctum_inf',
            depositedAmount: sanctumAmount,
            depositedMint: 'USDC',
            depositedAt: new Date(),
            currentValue: sanctumAmount,
            unrealizedYield: 0,
            claimableYield: 0,
            estimatedApy: 7.5,
            realizedApy: 0,
            status: 'active',
          });
          totalDeployed += sanctumAmount;
        }
      }

      // 2. Deploy to Meteora Dynamic Vault
      if (vaultAmount > 0) {
        const vaultResult = await this.vault.deposit(wallet, vaultAmount);

        if (vaultResult.success) {
          const stats = await this.vault.getVaultStats();
          positions.push({
            id: `vault-${Date.now()}`,
            source: 'meteora_vault',
            depositedAmount: vaultAmount,
            depositedMint: 'USDC',
            depositedAt: new Date(),
            currentValue: vaultAmount,
            unrealizedYield: 0,
            claimableYield: 0,
            estimatedApy: stats.currentApy,
            realizedApy: 0,
            status: 'active',
          });
          totalDeployed += vaultAmount;
        }
      }

      // 3. Deploy to Meteora DAMM v2
      if (dammAmount > 0) {
        // Find best USDC pool
        const pools = await this.damm.getPools('USDC');
        const bestPool = pools.sort((a, b) => b.apy24h - a.apy24h)[0];

        if (bestPool) {
          const lpResult = await this.damm.addSingleSidedLiquidity(
            wallet,
            bestPool.address,
            dammAmount
          );

          if (lpResult.success) {
            positions.push({
              id: `damm-${Date.now()}`,
              source: 'meteora_damm',
              depositedAmount: dammAmount,
              depositedMint: 'USDC',
              depositedAt: new Date(),
              currentValue: dammAmount,
              unrealizedYield: 0,
              claimableYield: 0,
              positionNft: lpResult.positionNft,
              poolAddress: bestPool.address,
              estimatedApy: bestPool.apy24h,
              realizedApy: 0,
              status: 'active',
            });
            totalDeployed += dammAmount;
          }
        }
      }

      // Calculate weighted APY
      const weightedApy = positions.reduce((sum, p) => {
        const weight = p.depositedAmount / totalDeployed;
        return sum + (p.estimatedApy * weight);
      }, 0);

      return {
        success: true,
        positions,
        totalDeployed,
        estimatedApy: weightedApy,
      };
    } catch (error) {
      return {
        success: false,
        positions,
        totalDeployed,
        estimatedApy: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if rebalancing is needed
   */
  async checkRebalanceNeeded(
    positions: YieldPosition[],
    strategy: YieldStrategy
  ): Promise<boolean> {
    const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);

    for (const position of positions) {
      const currentPercent = (position.currentValue / totalValue) * 100;
      const targetPercent = this.getTargetPercent(position.source, strategy);
      const deviation = Math.abs(currentPercent - targetPercent);

      if (deviation > strategy.rebalanceThreshold) {
        return true;
      }
    }

    return false;
  }

  /**
   * Rebalance positions to match strategy
   */
  async rebalance(
    wallet: Keypair,
    positions: YieldPosition[],
    strategy: YieldStrategy
  ): Promise<RebalanceResult> {
    // Implementation would:
    // 1. Calculate current vs target allocations
    // 2. Withdraw from over-allocated positions
    // 3. Deposit to under-allocated positions
    // 4. Update position records

    // Simplified placeholder
    return {
      success: true,
      positionsAdjusted: 0,
      amountsMoved: 0,
      newAllocations: [],
    };
  }

  /**
   * Claim all available yield
   */
  async claimAllYield(
    wallet: Keypair,
    positions: YieldPosition[]
  ): Promise<{ totalClaimed: number; bySource: Record<YieldSource, number> }> {
    const bySource: Record<YieldSource, number> = {
      sanctum_inf: 0,
      meteora_vault: 0,
      meteora_damm: 0,
      meteora_dlmm: 0,
    };

    for (const position of positions) {
      if (position.claimableYield <= 0) continue;

      if (position.source === 'meteora_damm' && position.positionNft) {
        const result = await this.damm.claimFees(wallet, position.positionNft);
        if (result.success) {
          bySource.meteora_damm += result.feesClaimedA + result.feesClaimedB;
        }
      }

      // Dynamic vault yield is auto-compounded
      // INF yield is reflected in NAV
    }

    const totalClaimed = Object.values(bySource).reduce((a, b) => a + b, 0);

    return { totalClaimed, bySource };
  }

  /**
   * Withdraw all capital from yield sources
   */
  async withdrawAll(
    wallet: Keypair,
    positions: YieldPosition[]
  ): Promise<{ totalWithdrawn: number; positions: YieldPosition[] }> {
    let totalWithdrawn = 0;

    for (const position of positions) {
      if (position.status !== 'active') continue;

      position.status = 'withdrawing';

      if (position.source === 'sanctum_inf') {
        const infBalance = await this.sanctum.getInfBalance(wallet.publicKey);
        if (infBalance > 0) {
          const result = await this.sanctum.withdrawSol(wallet, infBalance);
          if (result.success) {
            totalWithdrawn += result.solReceived * 150;  // Rough SOL→USDC
            position.status = 'closed';
          }
        }
      }

      if (position.source === 'meteora_vault') {
        const shares = await this.vault.getShareBalance(wallet.publicKey);
        if (shares > 0) {
          const result = await this.vault.withdraw(wallet, shares);
          if (result.success) {
            totalWithdrawn += result.usdcReceived;
            position.status = 'closed';
          }
        }
      }

      if (position.source === 'meteora_damm' && position.positionNft) {
        const result = await this.damm.removeLiquidity(wallet, position.positionNft);
        if (result.success) {
          totalWithdrawn += result.tokenAReceived + result.tokenBReceived;
          position.status = 'closed';
        }
      }
    }

    return { totalWithdrawn, positions };
  }

  /**
   * Get current yield stats across all sources
   */
  async getYieldStats(): Promise<{
    sanctumApy: number;
    vaultApy: number;
    dammAvgApy: number;
    blendedApy: number;
  }> {
    const [infStats, vaultStats, pools] = await Promise.all([
      this.sanctum.getInfStats(),
      this.vault.getVaultStats(),
      this.damm.getPools('USDC'),
    ]);

    const dammAvgApy = pools.length > 0
      ? pools.reduce((sum, p) => sum + p.apy24h, 0) / pools.length
      : 0;

    // Blended assuming default strategy
    const blended =
      (infStats.currentApy * 0.2) +
      (vaultStats.currentApy * 0.5) +
      (dammAvgApy * 0.3);

    return {
      sanctumApy: infStats.currentApy,
      vaultApy: vaultStats.currentApy,
      dammAvgApy,
      blendedApy: blended,
    };
  }

  private getTargetPercent(source: YieldSource, strategy: YieldStrategy): number {
    const deployablePercent = 100 - strategy.minLiquidReserve;

    switch (source) {
      case 'sanctum_inf':
        return strategy.allocations.sanctumInf * (deployablePercent / 100);
      case 'meteora_vault':
        return strategy.allocations.meteoraVault * (deployablePercent / 100);
      case 'meteora_damm':
        return strategy.allocations.meteoraDamm * (deployablePercent / 100);
      default:
        return 0;
    }
  }
}
```

---

## Phase 6: API Endpoints

### 6.1 Yield API Routes

Create the following API routes:

```
app/api/v2/yield/
├── route.ts                    # GET yield stats, POST deploy capital
├── positions/route.ts          # GET all positions
├── positions/[id]/route.ts     # GET/DELETE specific position
├── claim/route.ts              # POST claim all yield
├── rebalance/route.ts          # POST trigger rebalance
├── strategies/route.ts         # GET available strategies
└── stats/route.ts              # GET APY stats across sources
```

### 6.2 Example: `/api/v2/yield/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/onchain/commit';
import { YieldOrchestrator } from '@/lib/yield/orchestrator';

export async function GET(req: NextRequest) {
  try {
    const connection = getConnection();
    const orchestrator = new YieldOrchestrator(connection);

    const stats = await orchestrator.getYieldStats();

    return NextResponse.json({
      success: true,
      data: {
        currentApys: {
          sanctumInf: `${stats.sanctumApy.toFixed(2)}%`,
          meteoraVault: `${stats.vaultApy.toFixed(2)}%`,
          meteoraDamm: `${stats.dammAvgApy.toFixed(2)}%`,
        },
        blendedApy: `${stats.blendedApy.toFixed(2)}%`,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch yield stats' },
      { status: 500 }
    );
  }
}
```

---

## Database Schema Additions

```sql
-- Yield positions tracking
CREATE TABLE yield_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_pubkey TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN (
    'sanctum_inf', 'meteora_vault', 'meteora_damm', 'meteora_dlmm'
  )),

  deposited_amount DECIMAL(20, 6) NOT NULL,
  deposited_mint TEXT NOT NULL,
  deposited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  current_value DECIMAL(20, 6),
  unrealized_yield DECIMAL(20, 6) DEFAULT 0,
  claimable_yield DECIMAL(20, 6) DEFAULT 0,

  position_nft TEXT,  -- For DAMM v2
  pool_address TEXT,

  estimated_apy DECIMAL(8, 4),
  realized_apy DECIMAL(8, 4),

  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'withdrawing', 'closed'
  )),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Yield claims history
CREATE TABLE yield_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID REFERENCES yield_positions(id),

  claimed_amount DECIMAL(20, 6) NOT NULL,
  claimed_mint TEXT NOT NULL,
  tx_signature TEXT,

  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_yield_positions_pool ON yield_positions(pool_pubkey);
CREATE INDEX idx_yield_positions_status ON yield_positions(status);
CREATE INDEX idx_yield_claims_position ON yield_claims(position_id);
```

---

## Implementation Checklist

### Week 1: Foundation
- [ ] Create `lib/yield/types.ts` with all interfaces
- [ ] Create `lib/yield/constants.ts` with addresses
- [ ] Install SDKs: `npm install @meteora-ag/dlmm @meteora-ag/damm-v2`
- [ ] Create database migration for yield tables

### Week 2: Sanctum Integration
- [ ] Implement `lib/yield/sanctum.ts`
- [ ] Add USDC→SOL swap via Jupiter
- [ ] Test SOL→INF deposit
- [ ] Test INF→SOL withdrawal
- [ ] Test INF balance queries

### Week 3: Meteora Integration
- [ ] Implement `lib/yield/meteora/vault.ts`
- [ ] Implement `lib/yield/meteora/damm.ts`
- [ ] Test vault deposits/withdrawals
- [ ] Test DAMM v2 LP positions
- [ ] Test fee claiming

### Week 4: Orchestration & APIs
- [ ] Implement `lib/yield/orchestrator.ts`
- [ ] Create all API routes under `/api/v2/yield/`
- [ ] Build rebalancing logic
- [ ] Add yield attribution per pool
- [ ] Integration testing

### Week 5: Pool Integration
- [ ] Connect yield orchestrator to staking pool
- [ ] Auto-deploy idle pool capital to yield sources
- [ ] Include yield in pool settlement
- [ ] Update pool P&L to include yield

---

## Risk Considerations

| Risk | Mitigation |
|------|------------|
| Sanctum INF de-peg | Max 20% allocation; monitor NAV |
| Meteora vault exploit | Max 50% allocation; diversify vaults |
| High utilization blocking withdrawals | Keep 20% liquid reserve |
| DAMM v2 impermanent loss | Single-sided deposits only |
| API changes | Abstract behind interfaces; version pinning |

---

## Success Metrics

1. **Yield Performance**
   - Target: 8-12% blended APY
   - Measure: Weekly yield snapshots

2. **Capital Efficiency**
   - Target: <5% idle capital
   - Measure: Deployed vs total ratio

3. **Operational Reliability**
   - Target: 99.9% successful transactions
   - Measure: Failed tx rate

4. **User Adoption**
   - Target: $100K TVL in yield positions
   - Measure: Total yield_positions value
