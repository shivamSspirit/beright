import {
  Connection,
  PublicKey,
  Transaction,
  TransactionSignature,
  Keypair,
  SendTransactionError,
} from "@solana/web3.js";
import { BN, Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";

import {
  STAKING_POOL_PROGRAM_ID,
  METEORA_VAULT_PROGRAM_ID,
  VIRTUAL_PRICE_DECIMALS,
  MeteoraVaultState,
  StakingPoolState,
  deriveMeteoraVaultStatePda,
  calculatePendingYield,
  calculateExpectedLpTokens,
  calculateExpectedUnderlying,
} from "./types";

import {
  buildInitializeMeteoraVaultIx,
  buildDepositToMeteoraIx,
  buildWithdrawFromMeteoraIx,
  buildWithdrawAllFromMeteoraIx,
  buildHarvestMeteoraYieldIx,
  buildAutoHarvestMeteoraYieldIx,
  buildUpdateMeteoraAllocationIx,
  buildSetMeteoraActiveIx,
} from "./instructions";

export interface MeteoraVaultAccounts {
  meteoraVault: PublicKey;
  meteoraTokenVault: PublicKey;
  vaultLpMint: PublicKey;
  vaultAuthority: PublicKey;
  underlyingMint: PublicKey;
}

export interface MeteoraVaultCPIClientConfig {
  connection: Connection;
  wallet: Wallet;
  stakingPoolProgram: Program;
}

/**
 * Client for interacting with Meteora Vault CPI in the staking pool program
 */
export class MeteoraVaultCPIClient {
  private connection: Connection;
  private wallet: Wallet;
  private program: Program;

  constructor(config: MeteoraVaultCPIClientConfig) {
    this.connection = config.connection;
    this.wallet = config.wallet;
    this.program = config.stakingPoolProgram;
  }

  /**
   * Initialize Meteora vault integration for a staking pool
   */
  async initializeMeteoraVault(
    poolState: PublicKey,
    vaultAccounts: MeteoraVaultAccounts,
    allocationBps: number,
    minDeposit: BN
  ): Promise<TransactionSignature> {
    const poolData = await this.getPoolState(poolState);
    const poolUnderlyingAccount = getAssociatedTokenAddressSync(
      vaultAccounts.underlyingMint,
      poolState,
      true
    );

    const ix = await buildInitializeMeteoraVaultIx(this.program, {
      forecaster: this.wallet.publicKey,
      poolState,
      meteoraVault: vaultAccounts.meteoraVault,
      vaultLpMint: vaultAccounts.vaultLpMint,
      underlyingMint: vaultAccounts.underlyingMint,
      poolUnderlyingAccount,
      allocationBps,
      minDeposit,
    });

    const tx = new Transaction().add(ix);
    return await this.sendTransaction(tx);
  }

  /**
   * Deposit tokens to Meteora vault
   */
  async depositToMeteora(
    poolState: PublicKey,
    vaultAccounts: MeteoraVaultAccounts,
    amount: BN
  ): Promise<TransactionSignature> {
    const poolUnderlyingAccount = getAssociatedTokenAddressSync(
      vaultAccounts.underlyingMint,
      poolState,
      true
    );
    const poolLpAccount = getAssociatedTokenAddressSync(
      vaultAccounts.vaultLpMint,
      poolState,
      true
    );

    const ix = await buildDepositToMeteoraIx(this.program, {
      forecaster: this.wallet.publicKey,
      poolState,
      poolUnderlyingAccount,
      poolLpAccount,
      meteoraVault: vaultAccounts.meteoraVault,
      meteoraTokenVault: vaultAccounts.meteoraTokenVault,
      vaultLpMint: vaultAccounts.vaultLpMint,
      vaultAuthority: vaultAccounts.vaultAuthority,
      amount,
    });

    const tx = new Transaction().add(ix);
    return await this.sendTransaction(tx);
  }

  /**
   * Withdraw tokens from Meteora vault
   */
  async withdrawFromMeteora(
    poolState: PublicKey,
    vaultAccounts: MeteoraVaultAccounts,
    lpAmount: BN,
    slippageBps: number = 100 // 1% default slippage
  ): Promise<TransactionSignature> {
    const meteoraState = await this.getMeteoraVaultState(poolState);
    const expectedUnderlying = calculateExpectedUnderlying(
      lpAmount,
      meteoraState.lastVirtualPrice
    );
    const minOutAmount = expectedUnderlying
      .mul(new BN(10000 - slippageBps))
      .div(new BN(10000));

    const poolUnderlyingAccount = getAssociatedTokenAddressSync(
      vaultAccounts.underlyingMint,
      poolState,
      true
    );
    const poolLpAccount = getAssociatedTokenAddressSync(
      vaultAccounts.vaultLpMint,
      poolState,
      true
    );

    const ix = await buildWithdrawFromMeteoraIx(this.program, {
      forecaster: this.wallet.publicKey,
      poolState,
      poolUnderlyingAccount,
      poolLpAccount,
      meteoraVault: vaultAccounts.meteoraVault,
      meteoraTokenVault: vaultAccounts.meteoraTokenVault,
      vaultLpMint: vaultAccounts.vaultLpMint,
      vaultAuthority: vaultAccounts.vaultAuthority,
      lpAmount,
      minOutAmount,
    });

    const tx = new Transaction().add(ix);
    return await this.sendTransaction(tx);
  }

  /**
   * Withdraw all LP tokens from Meteora vault
   */
  async withdrawAllFromMeteora(
    poolState: PublicKey,
    vaultAccounts: MeteoraVaultAccounts
  ): Promise<TransactionSignature> {
    const poolUnderlyingAccount = getAssociatedTokenAddressSync(
      vaultAccounts.underlyingMint,
      poolState,
      true
    );
    const poolLpAccount = getAssociatedTokenAddressSync(
      vaultAccounts.vaultLpMint,
      poolState,
      true
    );

    const ix = await buildWithdrawAllFromMeteoraIx(this.program, {
      forecaster: this.wallet.publicKey,
      poolState,
      poolUnderlyingAccount,
      poolLpAccount,
      meteoraVault: vaultAccounts.meteoraVault,
      meteoraTokenVault: vaultAccounts.meteoraTokenVault,
      vaultLpMint: vaultAccounts.vaultLpMint,
      vaultAuthority: vaultAccounts.vaultAuthority,
    });

    const tx = new Transaction().add(ix);
    return await this.sendTransaction(tx);
  }

  /**
   * Harvest yield from Meteora vault
   */
  async harvestMeteoraYield(
    poolState: PublicKey,
    meteoraVault: PublicKey,
    newVirtualPrice: BN
  ): Promise<TransactionSignature> {
    const ix = await buildHarvestMeteoraYieldIx(this.program, {
      forecaster: this.wallet.publicKey,
      poolState,
      meteoraVault,
      newVirtualPrice,
    });

    const tx = new Transaction().add(ix);
    return await this.sendTransaction(tx);
  }

  /**
   * Auto-harvest yield (permissionless)
   */
  async autoHarvestMeteoraYield(
    poolState: PublicKey,
    meteoraVault: PublicKey
  ): Promise<TransactionSignature> {
    const ix = await buildAutoHarvestMeteoraYieldIx(this.program, {
      caller: this.wallet.publicKey,
      poolState,
      meteoraVault,
    });

    const tx = new Transaction().add(ix);
    return await this.sendTransaction(tx);
  }

  /**
   * Update allocation percentage
   */
  async updateMeteoraAllocation(
    poolState: PublicKey,
    newAllocationBps: number
  ): Promise<TransactionSignature> {
    const ix = await buildUpdateMeteoraAllocationIx(this.program, {
      forecaster: this.wallet.publicKey,
      poolState,
      newAllocationBps,
    });

    const tx = new Transaction().add(ix);
    return await this.sendTransaction(tx);
  }

  /**
   * Pause/unpause Meteora integration
   */
  async setMeteoraActive(
    poolState: PublicKey,
    isActive: boolean
  ): Promise<TransactionSignature> {
    const ix = await buildSetMeteoraActiveIx(this.program, {
      forecaster: this.wallet.publicKey,
      poolState,
      isActive,
    });

    const tx = new Transaction().add(ix);
    return await this.sendTransaction(tx);
  }

  // === Query Methods ===

  /**
   * Get Meteora vault state for a pool
   */
  async getMeteoraVaultState(poolState: PublicKey): Promise<MeteoraVaultState> {
    const [statePda] = deriveMeteoraVaultStatePda(poolState);
    const account = await this.program.account.meteoraVaultState.fetch(statePda);
    return account as unknown as MeteoraVaultState;
  }

  /**
   * Get staking pool state
   */
  async getPoolState(poolState: PublicKey): Promise<StakingPoolState> {
    const account = await this.program.account.stakingPoolState.fetch(poolState);
    return account as unknown as StakingPoolState;
  }

  /**
   * Calculate pending yield for a pool
   */
  async calculatePendingYield(
    poolState: PublicKey,
    currentVirtualPrice: BN
  ): Promise<BN> {
    const meteoraState = await this.getMeteoraVaultState(poolState);
    return calculatePendingYield(
      meteoraState.lpTokenBalance,
      meteoraState.lastVirtualPrice,
      currentVirtualPrice
    );
  }

  /**
   * Get current APY estimate based on virtual price history
   */
  async estimateCurrentApy(poolState: PublicKey): Promise<number> {
    const meteoraState = await this.getMeteoraVaultState(poolState);
    const now = Math.floor(Date.now() / 1000);
    const timeDiff = now - meteoraState.lastHarvestTs.toNumber();

    if (timeDiff === 0 || meteoraState.depositedAmount.isZero()) {
      return 0;
    }

    // Calculate yield rate and annualize
    const yieldRate = meteoraState.totalYieldEarned
      .mul(new BN(10000))
      .div(meteoraState.depositedAmount)
      .toNumber() / 10000;

    const secondsPerYear = 365 * 24 * 60 * 60;
    const annualizedRate = (yieldRate / timeDiff) * secondsPerYear;

    return annualizedRate * 100; // Return as percentage
  }

  /**
   * Check if deposit would exceed allocation limit
   */
  async checkDepositAllowance(
    poolState: PublicKey,
    depositAmount: BN
  ): Promise<{ allowed: boolean; maxDeposit: BN; reason?: string }> {
    const poolData = await this.getPoolState(poolState);
    const meteoraState = await this.getMeteoraVaultState(poolState);

    if (!meteoraState.isActive) {
      return {
        allowed: false,
        maxDeposit: new BN(0),
        reason: "Meteora integration is paused",
      };
    }

    if (depositAmount.lt(meteoraState.minDeposit)) {
      return {
        allowed: false,
        maxDeposit: meteoraState.minDeposit,
        reason: `Deposit below minimum (${meteoraState.minDeposit.toString()})`,
      };
    }

    const maxAllocation = poolData.totalDeposits
      .mul(new BN(meteoraState.allocationBps))
      .div(new BN(10000));

    const currentDeposited = meteoraState.depositedAmount;
    const remaining = maxAllocation.sub(currentDeposited);

    if (depositAmount.gt(remaining)) {
      return {
        allowed: false,
        maxDeposit: remaining,
        reason: `Deposit would exceed allocation limit (max: ${remaining.toString()})`,
      };
    }

    return {
      allowed: true,
      maxDeposit: remaining,
    };
  }

  // === Private Methods ===

  private async sendTransaction(tx: Transaction): Promise<TransactionSignature> {
    const { blockhash, lastValidBlockHeight } =
      await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = this.wallet.publicKey;

    const signed = await this.wallet.signTransaction(tx);
    const signature = await this.connection.sendRawTransaction(signed.serialize());

    await this.connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    return signature;
  }
}

/**
 * Create MeteoraVaultCPIClient instance
 */
export function createMeteoraVaultCPIClient(
  connection: Connection,
  wallet: Wallet,
  stakingPoolProgram: Program
): MeteoraVaultCPIClient {
  return new MeteoraVaultCPIClient({
    connection,
    wallet,
    stakingPoolProgram,
  });
}
