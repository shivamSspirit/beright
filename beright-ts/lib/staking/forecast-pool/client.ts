/**
 * Forecast Pool Client
 *
 * TypeScript client for interacting with the Forecast Pool Anchor program.
 *
 * @author BeRight Protocol
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  NATIVE_MINT,
} from '@solana/spl-token';
import BN from 'bn.js';

import {
  PoolTier,
  ForecastPoolStatus,
  PredictionPlatform,
  PredictionSide,
  ForecastPoolData,
  DelegationData,
  PoolPredictionData,
  PlatformTreasuryData,
  PoolDisplayInfo,
  DelegationDisplayInfo,
  CreatePoolParams,
  StakeParams,
  UnstakeParams,
  OpenPredictionParams,
  ResolvePredictionParams,
  FORECAST_POOL_CONSTANTS,
  deriveForecastPoolPda,
  derivePoolVaultPda,
  deriveDelegationPda,
  derivePoolPredictionPda,
  derivePlatformTreasuryPda,
  getTierConfig,
  DEFAULT_REVENUE_SPLIT,
} from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

const PROGRAM_ID = new PublicKey(FORECAST_POOL_CONSTANTS.PROGRAM_ID);

// USDC mints
const USDC_MINT_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const USDC_MINT_MAINNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

// =============================================================================
// CLIENT CLASS
// =============================================================================

/**
 * Forecast Pool Client
 */
export class ForecastPoolClient {
  private connection: Connection;
  private programId: PublicKey;
  private usdcMint: PublicKey;

  constructor(
    connection: Connection,
    options?: {
      programId?: PublicKey;
      network?: 'devnet' | 'mainnet';
    }
  ) {
    this.connection = connection;
    this.programId = options?.programId ?? PROGRAM_ID;
    this.usdcMint =
      options?.network === 'mainnet' ? USDC_MINT_MAINNET : USDC_MINT_DEVNET;
  }

  // =============================================================================
  // PDA DERIVATION
  // =============================================================================

  /**
   * Get forecast pool PDA
   */
  getPoolPda(forecaster: PublicKey, tier: PoolTier): [PublicKey, number] {
    return deriveForecastPoolPda(forecaster, tier, this.programId);
  }

  /**
   * Get pool vault PDA
   */
  getVaultPda(pool: PublicKey): [PublicKey, number] {
    return derivePoolVaultPda(pool, this.programId);
  }

  /**
   * Get delegation PDA
   */
  getDelegationPda(pool: PublicKey, delegator: PublicKey): [PublicKey, number] {
    return deriveDelegationPda(pool, delegator, this.programId);
  }

  /**
   * Get prediction PDA
   */
  getPredictionPda(pool: PublicKey, index: number): [PublicKey, number] {
    return derivePoolPredictionPda(pool, index, this.programId);
  }

  /**
   * Get treasury PDA
   */
  getTreasuryPda(): [PublicKey, number] {
    return derivePlatformTreasuryPda(this.programId);
  }

  // =============================================================================
  // ACCOUNT FETCHING
  // =============================================================================

  /**
   * Fetch pool data
   */
  async getPool(poolAddress: PublicKey): Promise<ForecastPoolData | null> {
    const accountInfo = await this.connection.getAccountInfo(poolAddress);
    if (!accountInfo) return null;

    // Parse account data (simplified - in production use Anchor's coder)
    return this.parsePoolData(accountInfo.data);
  }

  /**
   * Fetch delegation data
   */
  async getDelegation(
    pool: PublicKey,
    delegator: PublicKey
  ): Promise<DelegationData | null> {
    const [delegationPda] = this.getDelegationPda(pool, delegator);
    const accountInfo = await this.connection.getAccountInfo(delegationPda);
    if (!accountInfo) return null;

    return this.parseDelegationData(accountInfo.data);
  }

  /**
   * Fetch all pools for a forecaster
   */
  async getPoolsByForecaster(forecaster: PublicKey): Promise<ForecastPoolData[]> {
    const pools: ForecastPoolData[] = [];

    // Try all tiers
    for (let tier = 0; tier <= 7; tier++) {
      const [poolPda] = this.getPoolPda(forecaster, tier as PoolTier);
      const pool = await this.getPool(poolPda);
      if (pool) {
        pools.push(pool);
      }
    }

    return pools;
  }

  /**
   * Fetch all delegations for a wallet
   */
  async getDelegationsByWallet(
    wallet: PublicKey,
    pools: PublicKey[]
  ): Promise<Array<{ pool: PublicKey; delegation: DelegationData }>> {
    const delegations: Array<{ pool: PublicKey; delegation: DelegationData }> = [];

    for (const pool of pools) {
      const delegation = await this.getDelegation(pool, wallet);
      if (delegation && delegation.shares > 0n) {
        delegations.push({ pool, delegation });
      }
    }

    return delegations;
  }

  // =============================================================================
  // TRANSACTION BUILDERS
  // =============================================================================

  /**
   * Build create pool transaction
   */
  async buildCreatePoolTx(
    forecaster: PublicKey,
    params: CreatePoolParams
  ): Promise<Transaction> {
    const tierConfig = getTierConfig(params.tier);
    const [poolPda, poolBump] = this.getPoolPda(forecaster, params.tier);
    const [vaultPda] = this.getVaultPda(poolPda);
    const [treasuryPda] = this.getTreasuryPda();

    // Get token mint based on tier
    const tokenMint = tierConfig.token === 'SOL' ? NATIVE_MINT : this.usdcMint;

    // Build instruction data
    const instructionData = this.encodeCreatePoolData(
      params.tier,
      params.brierScoreScaled,
      params.predictionCount
    );

    const instruction = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: forecaster, isSigner: true, isWritable: true },
        { pubkey: poolPda, isSigner: false, isWritable: true },
        { pubkey: tokenMint, isSigner: false, isWritable: false },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: treasuryPda, isSigner: false, isWritable: true },
        { pubkey: forecaster, isSigner: false, isWritable: true }, // treasury_sol
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });

    const tx = new Transaction().add(instruction);
    tx.feePayer = forecaster;

    return tx;
  }

  /**
   * Build stake transaction
   */
  async buildStakeTx(
    delegator: PublicKey,
    params: StakeParams
  ): Promise<Transaction> {
    const pool = new PublicKey(params.poolAddress);
    const poolData = await this.getPool(pool);
    if (!poolData) throw new Error('Pool not found');

    const [delegationPda] = this.getDelegationPda(pool, delegator);
    const delegatorToken = await getAssociatedTokenAddress(
      poolData.tokenMint,
      delegator
    );

    const tx = new Transaction();

    // Check if delegation account exists
    const delegationAccount = await this.connection.getAccountInfo(delegationPda);
    // Account will be created by init_if_needed in the program

    // Build stake instruction
    const instructionData = this.encodeStakeData(params.amount);

    const instruction = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: delegator, isSigner: true, isWritable: true },
        { pubkey: pool, isSigner: false, isWritable: true },
        { pubkey: poolData.vault, isSigner: false, isWritable: true },
        { pubkey: delegatorToken, isSigner: false, isWritable: true },
        { pubkey: delegationPda, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });

    tx.add(instruction);
    tx.feePayer = delegator;

    return tx;
  }

  /**
   * Build unstake transaction
   */
  async buildUnstakeTx(
    delegator: PublicKey,
    params: UnstakeParams
  ): Promise<Transaction> {
    const pool = new PublicKey(params.poolAddress);
    const poolData = await this.getPool(pool);
    if (!poolData) throw new Error('Pool not found');

    const [delegationPda] = this.getDelegationPda(pool, delegator);
    const [treasuryPda] = this.getTreasuryPda();

    const delegatorToken = await getAssociatedTokenAddress(
      poolData.tokenMint,
      delegator
    );
    const treasuryToken = await getAssociatedTokenAddress(
      poolData.tokenMint,
      treasuryPda,
      true
    );

    // Build unstake instruction
    const instructionData = this.encodeUnstakeData(params.shares);

    const instruction = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: delegator, isSigner: true, isWritable: true },
        { pubkey: pool, isSigner: false, isWritable: true },
        { pubkey: poolData.vault, isSigner: false, isWritable: true },
        { pubkey: delegatorToken, isSigner: false, isWritable: true },
        { pubkey: delegationPda, isSigner: false, isWritable: true },
        { pubkey: treasuryPda, isSigner: false, isWritable: true },
        { pubkey: treasuryToken, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });

    const tx = new Transaction().add(instruction);
    tx.feePayer = delegator;

    return tx;
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  /**
   * Calculate delegation value at current share price
   */
  calculateDelegationValue(
    shares: bigint,
    sharePrice: bigint
  ): number {
    return Number(shares * sharePrice / FORECAST_POOL_CONSTANTS.SHARE_DECIMALS);
  }

  /**
   * Calculate shares for deposit amount
   */
  calculateShares(
    amount: number,
    totalShares: bigint,
    totalValue: bigint,
    sharePrice: bigint
  ): bigint {
    if (totalShares === 0n || totalValue === 0n) {
      return BigInt(amount);
    }
    return BigInt(amount) * FORECAST_POOL_CONSTANTS.SHARE_DECIMALS / sharePrice;
  }

  /**
   * Calculate withdrawal fee
   */
  calculateWithdrawalFee(
    amount: number,
    depositedAt: number
  ): { fee: number; feeRate: number } {
    const now = Date.now() / 1000;
    const lockupComplete = now >= depositedAt + FORECAST_POOL_CONSTANTS.LOCKUP_PERIOD;
    const feeRate = lockupComplete
      ? FORECAST_POOL_CONSTANTS.WITHDRAWAL_FEE_BPS
      : FORECAST_POOL_CONSTANTS.EARLY_EXIT_FEE_BPS;
    const fee = (amount * feeRate) / 10000;
    return { fee, feeRate };
  }

  /**
   * Format pool for UI display
   */
  formatPoolForDisplay(pool: ForecastPoolData, address: PublicKey): PoolDisplayInfo {
    const tierConfig = getTierConfig(pool.tier);
    const tvl = Number(pool.totalValue);
    const capacity = Number(pool.capacity);
    const sharePrice = Number(pool.sharePrice) / 1e9;

    return {
      address: address.toBase58(),
      forecaster: pool.forecaster.toBase58(),
      tier: tierConfig,
      tvl,
      tvlDisplay: tierConfig.token === 'SOL'
        ? `${(tvl / 1e9).toFixed(2)} SOL`
        : `$${(tvl / 1e6).toFixed(2)}`,
      sharePrice,
      sharePriceDisplay: sharePrice.toFixed(4),
      capacity,
      capacityDisplay: tierConfig.capacityDisplay,
      utilizationPct: capacity > 0 ? (tvl / capacity) * 100 : 0,
      delegatorCount: pool.delegatorCount,
      winRate: pool.predictionCount > 0
        ? (pool.winsCount / pool.predictionCount) * 100
        : 0,
      predictionCount: pool.predictionCount,
      status: pool.status,
      createdAt: new Date(Number(pool.createdAt) * 1000),
      forecasterEarnings: Number(pool.forecasterEarnings),
      apy: null, // Calculate from historical data
    };
  }

  /**
   * Format delegation for UI display
   */
  formatDelegationForDisplay(
    delegation: DelegationData,
    pool: ForecastPoolData
  ): DelegationDisplayInfo {
    const tierConfig = getTierConfig(pool.tier);
    const shares = Number(delegation.shares);
    const value = this.calculateDelegationValue(delegation.shares, pool.sharePrice);
    const deposited = Number(delegation.depositedAmount);
    const pnl = value - deposited;
    const pnlPct = deposited > 0 ? (pnl / deposited) * 100 : 0;
    const depositedAt = Number(delegation.depositedAt);
    const { feeRate } = this.calculateWithdrawalFee(value, depositedAt);

    return {
      poolAddress: pool.vault.toBase58(),
      shares,
      value,
      valueDisplay: tierConfig.token === 'SOL'
        ? `${(value / 1e9).toFixed(4)} SOL`
        : `$${(value / 1e6).toFixed(2)}`,
      depositedAmount: deposited,
      depositedAmountDisplay: tierConfig.token === 'SOL'
        ? `${(deposited / 1e9).toFixed(4)} SOL`
        : `$${(deposited / 1e6).toFixed(2)}`,
      pnl,
      pnlPct,
      pnlDisplay: `${pnl >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`,
      depositedAt: new Date(depositedAt * 1000),
      lockupComplete: Date.now() / 1000 >= depositedAt + FORECAST_POOL_CONSTANTS.LOCKUP_PERIOD,
      withdrawalFeeRate: feeRate,
    };
  }

  // =============================================================================
  // PRIVATE METHODS - INSTRUCTION ENCODING
  // =============================================================================

  private encodeCreatePoolData(
    tier: PoolTier,
    brierScoreScaled: number,
    predictionCount: number
  ): Buffer {
    // Anchor instruction discriminator for create_forecast_pool
    const discriminator = Buffer.from([/* instruction hash */]);
    // Simplified encoding - in production use Anchor's BorshCoder
    const data = Buffer.alloc(100);
    let offset = 0;
    // Add discriminator + args
    data.writeUInt8(tier, offset);
    offset += 1;
    data.writeBigUInt64LE(BigInt(brierScoreScaled), offset);
    offset += 8;
    data.writeUInt32LE(predictionCount, offset);
    return data.slice(0, offset + 4);
  }

  private encodeStakeData(amount: number): Buffer {
    const data = Buffer.alloc(16);
    data.writeBigUInt64LE(BigInt(amount), 0);
    return data.slice(0, 8);
  }

  private encodeUnstakeData(shares: number): Buffer {
    const data = Buffer.alloc(16);
    data.writeBigUInt64LE(BigInt(shares), 0);
    return data.slice(0, 8);
  }

  private parsePoolData(data: Buffer): ForecastPoolData {
    // Simplified parsing - in production use Anchor's coder
    // This is a placeholder that shows the structure
    return {
      bump: data[8],
      forecaster: new PublicKey(data.slice(9, 41)),
      tier: data[41] as PoolTier,
      tokenMint: new PublicKey(data.slice(42, 74)),
      vault: new PublicKey(data.slice(74, 106)),
      totalValue: data.readBigUInt64LE(106),
      totalShares: data.readBigUInt64LE(114),
      sharePrice: data.readBigUInt64LE(122),
      capacity: data.readBigUInt64LE(130),
      availableLiquidity: data.readBigUInt64LE(138),
      revenueSplit: DEFAULT_REVENUE_SPLIT,
      delegatorCount: data.readUInt32LE(152),
      predictionCount: data.readUInt32LE(156),
      winsCount: data.readUInt32LE(160),
      lossesCount: data.readUInt32LE(164),
      forecasterEarnings: data.readBigUInt64LE(168),
      platformEarnings: data.readBigUInt64LE(176),
      status: data[184] as ForecastPoolStatus,
      version: data[185],
      createdAt: data.readBigInt64LE(186),
      lastActivity: data.readBigInt64LE(194),
    };
  }

  private parseDelegationData(data: Buffer): DelegationData {
    return {
      bump: data[8],
      pool: new PublicKey(data.slice(9, 41)),
      delegator: new PublicKey(data.slice(41, 73)),
      shares: data.readBigUInt64LE(73),
      depositedAmount: data.readBigUInt64LE(81),
      depositedAt: data.readBigInt64LE(89),
      lastClaimAt: data.readBigInt64LE(97),
      pendingWithdrawal: data.readBigUInt64LE(105),
      withdrawalRequestedAt: data.readBigInt64LE(113),
    };
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let clientInstance: ForecastPoolClient | null = null;

/**
 * Get or create client singleton
 */
export function getForecastPoolClient(
  connection: Connection,
  options?: { network?: 'devnet' | 'mainnet' }
): ForecastPoolClient {
  if (!clientInstance) {
    clientInstance = new ForecastPoolClient(connection, options);
  }
  return clientInstance;
}

/**
 * Reset client singleton (for testing)
 */
export function resetForecastPoolClient(): void {
  clientInstance = null;
}
