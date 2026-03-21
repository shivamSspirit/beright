/**
 * BeRight Delegation Pool Client
 *
 * TypeScript client for interacting with the staking pool program.
 * Wraps the existing DeFi SDK clients (Meteora, DLMM, Drift).
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { BN, Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';

import { STAKING_POOL_PROGRAM_ID } from '../staking';
import { MeteoraVaultCPIClient } from '../staking/meteora-cpi';
import { DlmmPositionClient } from '../staking/dlmm';
import { DriftTradingClient } from '../staking/drift';
import type {
  OnChainPoolState,
  OnChainDepositorState,
  OnChainPoolType,
  OnChainPoolConfig,
  InitializePoolParams,
  DepositParams,
  WithdrawalRequestParams,
  ProcessWithdrawalParams,
  UpdateNavParams,
  TransactionResult,
  ForecasterTier,
} from './types';

// Import IDL
import stakingPoolIdl from '../staking/idl/staking_pool.json';

// ============================================================================
// Constants
// ============================================================================

const NAV_DECIMALS = 9;
const NAV_SCALE = new BN(10).pow(new BN(NAV_DECIMALS));

// ============================================================================
// PDA Derivation
// ============================================================================

/**
 * Derive pool state PDA
 */
export function derivePoolStatePda(
  forecaster: PublicKey,
  poolMint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('pool'), forecaster.toBuffer(), poolMint.toBuffer()],
    STAKING_POOL_PROGRAM_ID
  );
}

/**
 * Derive depositor state PDA
 */
export function deriveDepositorStatePda(
  poolState: PublicKey,
  depositor: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('depositor'), poolState.toBuffer(), depositor.toBuffer()],
    STAKING_POOL_PROGRAM_ID
  );
}

/**
 * Derive pool authority PDA (for signing token transfers)
 */
export function derivePoolAuthorityPda(poolState: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority'), poolState.toBuffer()],
    STAKING_POOL_PROGRAM_ID
  );
}

// ============================================================================
// Client Configuration
// ============================================================================

export interface DelegationPoolClientConfig {
  connection: Connection;
  wallet: Wallet;
}

// ============================================================================
// Client Implementation
// ============================================================================

/**
 * Delegation Pool Client
 *
 * High-level client for interacting with the staking pool program.
 */
export class DelegationPoolClient {
  private connection: Connection;
  private wallet: Wallet;
  private program: Program;

  // DeFi integration clients
  private _meteoraClient: MeteoraVaultCPIClient | null = null;
  private _dlmmClient: DlmmPositionClient | null = null;
  private _driftClient: DriftTradingClient | null = null;

  constructor(config: DelegationPoolClientConfig) {
    this.connection = config.connection;
    this.wallet = config.wallet;

    const provider = new AnchorProvider(
      config.connection,
      config.wallet,
      AnchorProvider.defaultOptions()
    );

    this.program = new Program(
      stakingPoolIdl as any,
      provider
    );
  }

  // ============================================================================
  // DeFi Client Accessors
  // ============================================================================

  get meteora(): MeteoraVaultCPIClient {
    if (!this._meteoraClient) {
      this._meteoraClient = new MeteoraVaultCPIClient({
        connection: this.connection,
        wallet: this.wallet,
        stakingPoolProgram: this.program,
      });
    }
    return this._meteoraClient;
  }

  get dlmm(): DlmmPositionClient {
    if (!this._dlmmClient) {
      this._dlmmClient = new DlmmPositionClient({
        connection: this.connection,
        wallet: this.wallet,
        stakingPoolProgram: this.program,
      });
    }
    return this._dlmmClient;
  }

  get drift(): DriftTradingClient {
    if (!this._driftClient) {
      this._driftClient = new DriftTradingClient(
        this.connection,
        STAKING_POOL_PROGRAM_ID
      );
    }
    return this._driftClient;
  }

  // ============================================================================
  // Pool Management
  // ============================================================================

  /**
   * Build initialize pool transaction
   */
  async buildInitializePoolTx(
    params: InitializePoolParams
  ): Promise<{ transaction: Transaction; poolPda: PublicKey; poolMint: PublicKey }> {
    // Generate pool mint keypair (client needs to sign)
    const poolMintKeypair = PublicKey.unique();

    const [poolPda] = derivePoolStatePda(params.forecaster, poolMintKeypair);
    const [poolAuthority] = derivePoolAuthorityPda(poolPda);

    const poolBaseTokenAccount = getAssociatedTokenAddressSync(
      params.baseMint,
      poolPda,
      true
    );

    // Map pool type to enum
    const poolTypeEnum = this.mapPoolType(params.poolType);

    // Build config with defaults
    const config = {
      performanceFeeBps: params.config.performanceFeeBps ?? 2000,
      managementFeeBps: params.config.managementFeeBps ?? 200,
      entryFeeBps: params.config.entryFeeBps ?? 0,
      exitFeeBps: params.config.exitFeeBps ?? 25,
      withdrawalDelay: params.config.withdrawalDelay ?? 7 * 24 * 60 * 60, // 7 days
      maxCapacity: new BN(params.config.maxCapacity?.toString() ?? '0'),
      minDeposit: new BN(params.config.minDeposit?.toString() ?? '100000000'), // 100 USDC
      idleAllocationBps: params.config.idleAllocationBps ?? 3000,
    };

    const ix = await this.program.methods
      .initializePool(
        poolTypeEnum,
        config,
        params.avgBrierScore,
        params.resolvedPredictions
      )
      .accounts({
        forecaster: params.forecaster,
        poolState: poolPda,
        poolMint: poolMintKeypair,
        baseTokenMint: params.baseMint,
        poolBaseTokenAccount,
        poolAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    const tx = new Transaction().add(ix);

    return {
      transaction: tx,
      poolPda,
      poolMint: poolMintKeypair,
    };
  }

  /**
   * Build deposit transaction
   */
  async buildDepositTx(params: DepositParams): Promise<Transaction> {
    const poolState = await this.getPoolState(params.poolPda);
    if (!poolState) {
      throw new Error('Pool not found');
    }

    const [depositorPda] = deriveDepositorStatePda(params.poolPda, params.depositor);
    const [poolAuthority] = derivePoolAuthorityPda(params.poolPda);

    const depositorTokenAccount = getAssociatedTokenAddressSync(
      poolState.baseTokenMint,
      params.depositor
    );

    const depositorShareAccount = getAssociatedTokenAddressSync(
      poolState.poolMint,
      params.depositor
    );

    const ix = await this.program.methods
      .deposit(new BN(params.amount.toString()))
      .accounts({
        depositor: params.depositor,
        depositorState: depositorPda,
        poolState: params.poolPda,
        poolMint: poolState.poolMint,
        poolBaseTokenAccount: poolState.poolBaseTokenAccount,
        depositorTokenAccount,
        depositorShareAccount,
        poolAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    return new Transaction().add(ix);
  }

  /**
   * Build withdrawal request transaction
   */
  async buildRequestWithdrawalTx(params: WithdrawalRequestParams): Promise<Transaction> {
    const [depositorPda] = deriveDepositorStatePda(params.poolPda, params.depositor);

    const ix = await this.program.methods
      .requestWithdrawal(new BN(params.shares.toString()))
      .accounts({
        depositor: params.depositor,
        depositorState: depositorPda,
        poolState: params.poolPda,
      })
      .instruction();

    return new Transaction().add(ix);
  }

  /**
   * Build process withdrawal transaction
   */
  async buildProcessWithdrawalTx(params: ProcessWithdrawalParams): Promise<Transaction> {
    const poolState = await this.getPoolState(params.poolPda);
    if (!poolState) {
      throw new Error('Pool not found');
    }

    const [depositorPda] = deriveDepositorStatePda(params.poolPda, params.depositor);
    const [poolAuthority] = derivePoolAuthorityPda(params.poolPda);

    const depositorTokenAccount = getAssociatedTokenAddressSync(
      poolState.baseTokenMint,
      params.depositor
    );

    const depositorShareAccount = getAssociatedTokenAddressSync(
      poolState.poolMint,
      params.depositor
    );

    const ix = await this.program.methods
      .processWithdrawal()
      .accounts({
        depositor: params.depositor,
        depositorState: depositorPda,
        poolState: params.poolPda,
        poolMint: poolState.poolMint,
        poolBaseTokenAccount: poolState.poolBaseTokenAccount,
        depositorTokenAccount,
        depositorShareAccount,
        poolAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    return new Transaction().add(ix);
  }

  /**
   * Build update NAV transaction
   */
  async buildUpdateNavTx(params: UpdateNavParams): Promise<Transaction> {
    const ix = await this.program.methods
      .updateNav(new BN(params.newNavPerShare.toString()))
      .accounts({
        forecaster: params.forecaster,
        poolState: params.poolPda,
      })
      .instruction();

    return new Transaction().add(ix);
  }

  /**
   * Build collect fees transaction
   */
  async buildCollectFeesTx(
    poolPda: PublicKey,
    forecaster: PublicKey
  ): Promise<Transaction> {
    const poolState = await this.getPoolState(poolPda);
    if (!poolState) {
      throw new Error('Pool not found');
    }

    const [poolAuthority] = derivePoolAuthorityPda(poolPda);

    const forecasterTokenAccount = getAssociatedTokenAddressSync(
      poolState.baseTokenMint,
      forecaster
    );

    const ix = await this.program.methods
      .collectFees()
      .accounts({
        forecaster,
        poolState: poolPda,
        poolBaseTokenAccount: poolState.poolBaseTokenAccount,
        forecasterTokenAccount,
        poolAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    return new Transaction().add(ix);
  }

  // ============================================================================
  // State Queries
  // ============================================================================

  /**
   * Get pool state
   */
  async getPoolState(poolPda: PublicKey): Promise<OnChainPoolState | null> {
    try {
      const account = await (this.program.account as any).stakingPoolState.fetch(poolPda);
      return this.parsePoolState(poolPda, account);
    } catch {
      return null;
    }
  }

  /**
   * Get depositor state
   */
  async getDepositorState(
    poolPda: PublicKey,
    depositor: PublicKey
  ): Promise<OnChainDepositorState | null> {
    try {
      const [depositorPda] = deriveDepositorStatePda(poolPda, depositor);
      const account = await (this.program.account as any).depositorState.fetch(depositorPda);
      return this.parseDepositorState(depositorPda, account);
    } catch {
      return null;
    }
  }

  /**
   * Get all pools for a forecaster
   */
  async getPoolsForForecaster(forecaster: PublicKey): Promise<OnChainPoolState[]> {
    const accounts = await (this.program.account as any).stakingPoolState.all([
      {
        memcmp: {
          offset: 8, // After discriminator
          bytes: forecaster.toBase58(),
        },
      },
    ]);

    return accounts.map((acc: any) =>
      this.parsePoolState(acc.publicKey, acc.account)
    );
  }

  /**
   * Get all depositions for a wallet
   */
  async getDepositionsForWallet(wallet: PublicKey): Promise<OnChainDepositorState[]> {
    const accounts = await (this.program.account as any).depositorState.all([
      {
        memcmp: {
          offset: 8 + 32, // After discriminator + pool PDA
          bytes: wallet.toBase58(),
        },
      },
    ]);

    return accounts.map((acc: any) =>
      this.parseDepositorState(acc.publicKey, acc.account)
    );
  }

  // ============================================================================
  // Transaction Execution
  // ============================================================================

  /**
   * Send and confirm transaction
   */
  async sendTransaction(tx: Transaction): Promise<TransactionResult> {
    try {
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

      return { success: true, signature };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transaction failed',
      };
    }
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private mapPoolType(type: OnChainPoolType): any {
    const mapping: Record<OnChainPoolType, any> = {
      tournament: { tournament: {} },
      alpha_vault: { alphaVault: {} },
      index_pool: { indexPool: {} },
    };
    return mapping[type];
  }

  private parsePoolState(pda: PublicKey, account: any): OnChainPoolState {
    return {
      poolPda: pda,
      poolMint: account.poolMint,
      baseTokenMint: account.baseTokenMint,
      poolBaseTokenAccount: account.poolBaseTokenAccount,
      forecaster: account.forecaster,
      forecasterTier: this.parseTier(account.forecasterTier),
      poolType: this.parsePoolType(account.poolType),
      config: {
        performanceFeeBps: account.config.performanceFeeBps,
        managementFeeBps: account.config.managementFeeBps,
        entryFeeBps: account.config.entryFeeBps,
        exitFeeBps: account.config.exitFeeBps,
        withdrawalDelay: account.config.withdrawalDelay,
        maxCapacity: BigInt(account.config.maxCapacity.toString()),
        minDeposit: BigInt(account.config.minDeposit.toString()),
        idleAllocationBps: account.config.idleAllocationBps,
      },
      status: this.parseStatus(account.status),
      totalDeposits: BigInt(account.totalDeposits.toString()),
      totalShares: BigInt(account.totalShares.toString()),
      depositorCount: account.depositorCount,
      navPerShare: BigInt(account.navPerShare.toString()),
      highWaterMark: BigInt(account.highWaterMark.toString()),
      lastNavUpdate: new Date(account.lastNavUpdate.toNumber() * 1000),
      accruedPerformanceFee: BigInt(account.accruedPerformanceFee.toString()),
      accruedManagementFee: BigInt(account.accruedManagementFee.toString()),
      lastFeeCollection: new Date(account.lastFeeCollection.toNumber() * 1000),
      createdAt: new Date(account.createdAt.toNumber() * 1000),
      activatedAt: account.activatedAt
        ? new Date(account.activatedAt.toNumber() * 1000)
        : null,
    };
  }

  private parseDepositorState(pda: PublicKey, account: any): OnChainDepositorState {
    return {
      depositorPda: pda,
      poolPda: account.poolState,
      owner: account.owner,
      shares: BigInt(account.shares.toString()),
      depositedAmount: BigInt(account.depositedAmount.toString()),
      entryNav: BigInt(account.entryNav.toString()),
      withdrawalRequested: BigInt(account.withdrawalRequested.toString()),
      withdrawalRequestTs: account.withdrawalRequestTs
        ? new Date(account.withdrawalRequestTs.toNumber() * 1000)
        : null,
      withdrawableAfter: account.withdrawableAfter
        ? new Date(account.withdrawableAfter.toNumber() * 1000)
        : null,
      firstDepositAt: new Date(account.firstDepositAt.toNumber() * 1000),
      lastDepositAt: new Date(account.lastDepositAt.toNumber() * 1000),
    };
  }

  private parseTier(tier: any): ForecasterTier {
    if (tier.unranked) return 'unranked';
    if (tier.rookie) return 'rookie';
    if (tier.verified) return 'verified';
    if (tier.elite) return 'elite';
    if (tier.super) return 'super';
    return 'unranked';
  }

  private parsePoolType(type: any): OnChainPoolType {
    if (type.tournament) return 'tournament';
    if (type.alphaVault) return 'alpha_vault';
    if (type.indexPool) return 'index_pool';
    return 'alpha_vault';
  }

  private parseStatus(status: any): OnChainPoolState['status'] {
    if (status.pending) return 'pending';
    if (status.open) return 'open';
    if (status.active) return 'active';
    if (status.paused) return 'paused';
    if (status.settling) return 'settling';
    if (status.closed) return 'closed';
    return 'pending';
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create delegation pool client
 */
export function createDelegationPoolClient(
  connection: Connection,
  wallet: Wallet
): DelegationPoolClient {
  return new DelegationPoolClient({ connection, wallet });
}
