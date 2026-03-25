/**
 * Anchor-based Forecast Pool Client
 *
 * Uses the actual IDL from the staking-pool program for proper instruction encoding.
 *
 * @author BeRight Protocol
 */

import {
  Connection,
  PublicKey,
  Transaction,
  Keypair,
  SystemProgram,
  VersionedTransaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
  NATIVE_MINT,
} from '@solana/spl-token';
import { Program, AnchorProvider, Idl, BN } from '@coral-xyz/anchor';
import idlJson from './idl.json';

// Type for the IDL
type StakingPoolIdl = typeof idlJson;

// =============================================================================
// CONSTANTS
// =============================================================================

// Program ID from IDL
const PROGRAM_ID = new PublicKey(idlJson.address);

// Token mints
const USDC_MINT_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const USDC_MINT_MAINNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

// Native SOL mint (wrapped SOL)
const NATIVE_SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

// Pool type enum (matches Rust enum)
export enum PoolType {
  Tournament = 0,
  AlphaVault = 1,
  IndexPool = 2,
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * On-chain StakingPoolState structure (matches IDL exactly)
 * Field names are camelCase (Anchor converts from snake_case)
 */
export interface OnChainPoolState {
  bump: number;
  forecaster: PublicKey;
  poolMint: PublicKey;
  poolType: { tournament?: {}; alphaVault?: {}; indexPool?: {} };
  baseToken: PublicKey;  // The actual base token mint stored on-chain
  minDeposit: BN;
  maxCapacity: BN;
  totalDeposits: BN;
  totalShares: BN;
  navPerShare: BN;
  highWaterMark: BN;
  lastNavUpdate: BN;
  pendingWithdrawals: BN;
  availableLiquidity: BN;
  performanceFeeBps: number;
  managementFeeBps: number;
  entryFeeBps: number;
  exitFeeBps: number;
  lastFeeCollection: BN;
  minLockPeriod: BN;
  withdrawalDelay: BN;
  status: { pending?: {}; open?: {}; active?: {}; paused?: {}; settling?: {}; closed?: {} };
  version: number;
  tierAtCreation: number;
  flags: number;
  createdAt: BN;
  activatedAt: BN;
  closesAt: BN;
  depositorCount: number;
  totalDepositsEver: BN;
  totalWithdrawalsEver: BN;
  sanctumInfBalance: BN;
  sanctumYieldAccrued: BN;
  idleAllocationBps: number;
  accruedPerformanceFee: BN;
  accruedManagementFee: BN;
}

export interface PoolConfig {
  minDeposit: BN;
  maxCapacity: BN;
  performanceFeeBps: number;
  managementFeeBps: number;
  lockPeriodDays: number;
  withdrawalNoticeDays: number;
  entryFeeBps: number;
  exitFeeBps: number;
}

export interface CreatePoolParams {
  poolType: PoolType;
  config: PoolConfig;
  avgBrierScore: number;
  resolvedPredictions: number;
}

export interface DepositParams {
  poolAddress: PublicKey;
  amount: BN;
}

export interface WithdrawParams {
  poolAddress: PublicKey;
  shares: BN;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract and validate base token from pool state
 * Battle-tested: handles undefined, wrong types, and missing fields
 */
function extractBaseToken(poolState: unknown, fallbackMint: PublicKey): PublicKey {
  if (!poolState || typeof poolState !== 'object') {
    console.warn('[StakingPoolClient] Pool state invalid, using fallback token');
    return fallbackMint;
  }

  const state = poolState as Record<string, unknown>;

  // Try multiple possible field names (IDL might use different conventions)
  const possibleFields = ['baseToken', 'base_token', 'baseTokenMint', 'base_token_mint'];

  for (const field of possibleFields) {
    const value = state[field];
    if (value) {
      // Check if it's already a PublicKey
      if (value instanceof PublicKey) {
        return value;
      }
      // Check if it has toBase58 (duck typing for PublicKey-like objects)
      if (typeof value === 'object' && 'toBase58' in value && typeof (value as any).toBase58 === 'function') {
        return value as PublicKey;
      }
      // Check if it's a string that looks like a public key
      if (typeof value === 'string' && value.length >= 32 && value.length <= 44) {
        try {
          return new PublicKey(value);
        } catch {
          continue;
        }
      }
    }
  }

  console.warn('[StakingPoolClient] Could not find baseToken in pool state, using fallback. State keys:', Object.keys(state));
  return fallbackMint;
}

/**
 * Check if a token mint is native SOL (wSOL)
 */
function isNativeSolMint(mint: PublicKey): boolean {
  return mint.equals(NATIVE_SOL_MINT) || mint.equals(NATIVE_MINT);
}

// =============================================================================
// PDA SEEDS
// =============================================================================

const SEEDS = {
  STAKING_POOL: Buffer.from('staking_pool'),
  POOL_MINT_AUTHORITY: Buffer.from('pool_mint_authority'),
  DEPOSITOR: Buffer.from('depositor'),
};

// =============================================================================
// CLIENT CLASS
// =============================================================================

export class StakingPoolAnchorClient {
  private connection: Connection;
  private program: Program;
  private baseTokenMint: PublicKey;
  private network: 'devnet' | 'mainnet';
  private useNativeSol: boolean;

  constructor(
    connection: Connection,
    options?: {
      network?: 'devnet' | 'mainnet';
      token?: 'SOL' | 'USDC';
      tokenMint?: string; // Custom token mint (e.g., user's USDC from wallet)
    }
  ) {
    this.connection = connection;
    this.network = options?.network || 'devnet';

    // For devnet, default to SOL; for mainnet, default to USDC
    const token = options?.token || (this.network === 'devnet' ? 'SOL' : 'USDC');
    this.useNativeSol = token === 'SOL';

    // Set base token mint based on:
    // 1. Custom tokenMint if provided (user's actual token from wallet)
    // 2. Otherwise default based on network and token type
    if (options?.tokenMint) {
      // Use custom mint from user's wallet
      this.baseTokenMint = new PublicKey(options.tokenMint);
      console.log(`[StakingPoolAnchorClient] Using custom token mint: ${options.tokenMint.slice(0, 12)}...`);
    } else if (this.useNativeSol) {
      this.baseTokenMint = NATIVE_SOL_MINT;
    } else {
      this.baseTokenMint = this.network === 'mainnet' ? USDC_MINT_MAINNET : USDC_MINT_DEVNET;
    }

    // Create a read-only provider (no wallet needed for building transactions)
    const dummyWallet = {
      publicKey: PublicKey.default,
      signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => tx,
      signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => txs,
    };

    const provider = new AnchorProvider(
      connection,
      dummyWallet,
      { commitment: 'confirmed' }
    );

    // Initialize program with IDL
    this.program = new Program(idlJson as Idl, provider);
  }

  // ===========================================================================
  // PDA DERIVATION
  // ===========================================================================

  /**
   * Derive pool state PDA
   */
  derivePoolPda(forecaster: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [SEEDS.STAKING_POOL, forecaster.toBuffer()],
      PROGRAM_ID
    );
  }

  /**
   * Derive pool mint authority PDA
   */
  derivePoolMintAuthority(poolState: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [SEEDS.POOL_MINT_AUTHORITY, poolState.toBuffer()],
      PROGRAM_ID
    );
  }

  /**
   * Derive depositor state PDA
   */
  deriveDepositorPda(poolState: PublicKey, depositor: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [SEEDS.DEPOSITOR, poolState.toBuffer(), depositor.toBuffer()],
      PROGRAM_ID
    );
  }

  // ===========================================================================
  // TRANSACTION BUILDERS
  // ===========================================================================

  /**
   * Build initialize pool transaction
   */
  async buildInitializePoolTx(
    forecaster: PublicKey,
    params: CreatePoolParams
  ): Promise<{ transaction: Transaction; poolMint: Keypair; poolAddress: PublicKey }> {
    const [poolState] = this.derivePoolPda(forecaster);
    const [poolMintAuthority] = this.derivePoolMintAuthority(poolState);

    // Generate new keypair for pool mint
    const poolMint = Keypair.generate();

    // Get pool vault (ATA of pool_state for USDC)
    const poolVault = await getAssociatedTokenAddress(
      this.baseTokenMint,
      poolState,
      true // allowOwnerOffCurve for PDA
    );

    // Map PoolType enum to Anchor variant format (must match IDL exactly)
    const poolTypeVariant = (() => {
      switch (params.poolType) {
        case PoolType.Tournament:
          return { tournament: {} };
        case PoolType.AlphaVault:
          return { alphaVault: {} };
        case PoolType.IndexPool:
          return { indexPool: {} };
        default:
          return { alphaVault: {} };
      }
    })();

    // Build the instruction using Anchor
    const ix = await this.program.methods
      .initializePool(
        poolTypeVariant,
        {
          minDeposit: params.config.minDeposit,
          maxCapacity: params.config.maxCapacity,
          performanceFeeBps: params.config.performanceFeeBps,
          managementFeeBps: params.config.managementFeeBps,
          lockPeriodDays: params.config.lockPeriodDays,
          withdrawalNoticeDays: params.config.withdrawalNoticeDays,
          entryFeeBps: params.config.entryFeeBps,
          exitFeeBps: params.config.exitFeeBps,
        },
        params.avgBrierScore,
        params.resolvedPredictions
      )
      .accounts({
        forecaster,
        poolState,
        poolMint: poolMint.publicKey,
        poolMintAuthority,
        baseTokenMint: this.baseTokenMint,
        poolVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const tx = new Transaction().add(ix);
    tx.feePayer = forecaster;

    return { transaction: tx, poolMint, poolAddress: poolState };
  }

  /**
   * Build deposit transaction
   *
   * IMPORTANT: This reads the pool's actual baseToken from on-chain state,
   * ensuring we use the correct token mint regardless of client configuration.
   */
  async buildDepositTx(
    depositor: PublicKey,
    params: DepositParams
  ): Promise<Transaction> {
    const [depositorState] = this.deriveDepositorPda(params.poolAddress, depositor);

    // Fetch pool state to get pool mint AND base token
    const poolStateAccount = await this.getPoolState(params.poolAddress);
    if (!poolStateAccount) {
      throw new Error(`Pool not found: ${params.poolAddress.toBase58()}`);
    }

    // Extract pool mint (required)
    const state = poolStateAccount as Partial<OnChainPoolState>;
    if (!state.poolMint) {
      throw new Error('Pool state missing poolMint field');
    }
    const poolMint = state.poolMint;

    // Extract base token using robust helper (handles various field names and types)
    const poolBaseToken = extractBaseToken(poolStateAccount, this.baseTokenMint);
    const isPoolUsingSol = isNativeSolMint(poolBaseToken);

    const tokenSymbol = isPoolUsingSol ? 'SOL' : 'USDC';
    console.log(`[StakingPoolClient] Deposit to pool:`, {
      pool: params.poolAddress.toBase58().slice(0, 12),
      token: tokenSymbol,
      mint: poolBaseToken.toBase58().slice(0, 12),
      amount: params.amount.toString(),
    });

    // Get depositor's token account using pool's base token
    const depositorTokenAccount = await getAssociatedTokenAddress(
      poolBaseToken,
      depositor
    );

    // =======================================================================
    // VALIDATION: Check if user has sufficient balance for non-SOL deposits
    // =======================================================================
    if (!isPoolUsingSol) {
      // For USDC/other tokens, check if user has enough balance
      const depositorTokenAccountInfo = await this.connection.getAccountInfo(depositorTokenAccount);
      if (!depositorTokenAccountInfo) {
        throw new Error(
          `This pool requires ${tokenSymbol} deposits. You don't have a ${tokenSymbol} token account. ` +
          `Please get devnet ${tokenSymbol} from a faucet, or create a new pool that uses SOL.`
        );
      }

      // Check token balance
      const { getAccount } = await import('@solana/spl-token');
      try {
        const tokenAccount = await getAccount(this.connection, depositorTokenAccount);
        const balance = Number(tokenAccount.amount);
        const required = params.amount.toNumber();
        if (balance < required) {
          const decimals = 6; // USDC has 6 decimals
          throw new Error(
            `Insufficient ${tokenSymbol} balance. You have ${(balance / Math.pow(10, decimals)).toFixed(2)} ${tokenSymbol}, ` +
            `but need ${(required / Math.pow(10, decimals)).toFixed(2)} ${tokenSymbol}. ` +
            `This pool was created with ${tokenSymbol} as the base token. ` +
            `To deposit with SOL, create a new pool that uses SOL.`
          );
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('Insufficient')) {
          throw err; // Re-throw our custom error
        }
        throw new Error(
          `Cannot read ${tokenSymbol} balance. Make sure you have ${tokenSymbol} in your wallet. ` +
          `This pool requires ${tokenSymbol}, not SOL.`
        );
      }
    }

    // Get pool vault using pool's base token
    const poolVault = await getAssociatedTokenAddress(
      poolBaseToken,
      params.poolAddress,
      true
    );

    const [poolMintAuthority] = this.derivePoolMintAuthority(params.poolAddress);

    // Get depositor's pool token account
    const depositorPoolTokenAccount = await getAssociatedTokenAddress(
      poolMint,
      depositor
    );

    const tx = new Transaction();

    // =======================================================================
    // STEP 1: Ensure depositor's base token ATA exists (for SOL only - USDC checked above)
    // =======================================================================
    if (isPoolUsingSol) {
      const depositorTokenAccountInfo = await this.connection.getAccountInfo(depositorTokenAccount);
      if (!depositorTokenAccountInfo) {
        console.log(`[StakingPoolClient] Creating depositor wSOL ATA...`);
        tx.add(
          createAssociatedTokenAccountInstruction(
            depositor,                // payer
            depositorTokenAccount,    // ATA address
            depositor,                // owner
            poolBaseToken             // mint (wSOL)
          )
        );
      }
    }

    // =======================================================================
    // STEP 2: For native SOL, wrap SOL into wSOL
    // =======================================================================
    if (isPoolUsingSol) {
      // Transfer SOL to wSOL account (works whether ATA existed or was just created)
      tx.add(
        SystemProgram.transfer({
          fromPubkey: depositor,
          toPubkey: depositorTokenAccount,
          lamports: params.amount.toNumber(),
        })
      );

      // Sync native to update wSOL balance
      tx.add(createSyncNativeInstruction(depositorTokenAccount));
    }
    // For USDC/other tokens: User must already have tokens in their ATA
    // We just ensure the ATA exists (done above)

    // =======================================================================
    // STEP 3: Ensure depositor's pool LP token ATA exists
    // =======================================================================
    const depositorPoolTokenAccountInfo = await this.connection.getAccountInfo(depositorPoolTokenAccount);
    if (!depositorPoolTokenAccountInfo) {
      console.log(`[StakingPoolClient] Creating depositor pool token ATA...`);
      tx.add(
        createAssociatedTokenAccountInstruction(
          depositor,
          depositorPoolTokenAccount,
          depositor,
          poolMint
        )
      );
    }

    // Build deposit instruction - use pool's actual base token
    const ix = await this.program.methods
      .deposit(params.amount)
      .accounts({
        depositor,
        poolState: params.poolAddress,
        depositorState,
        depositorTokenAccount,
        poolVault,
        poolMint,
        poolMintAuthority,
        depositorPoolTokenAccount,
        baseTokenMint: poolBaseToken, // Use pool's token from on-chain state
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    tx.add(ix);
    tx.feePayer = depositor;

    return tx;
  }

  /**
   * Build withdraw transaction
   *
   * IMPORTANT: This reads the pool's actual baseToken from on-chain state,
   * ensuring we use the correct token mint regardless of client configuration.
   */
  async buildWithdrawTx(
    withdrawer: PublicKey,
    params: WithdrawParams
  ): Promise<Transaction> {
    const [depositorState] = this.deriveDepositorPda(params.poolAddress, withdrawer);

    // Fetch pool state to get pool mint AND base token
    const poolStateAccount = await this.getPoolState(params.poolAddress);
    if (!poolStateAccount) {
      throw new Error(`Pool not found: ${params.poolAddress.toBase58()}`);
    }

    // Extract pool mint (required)
    const state = poolStateAccount as Partial<OnChainPoolState>;
    if (!state.poolMint) {
      throw new Error('Pool state missing poolMint field');
    }
    const poolMint = state.poolMint;

    // Extract base token using robust helper (handles various field names and types)
    const poolBaseToken = extractBaseToken(poolStateAccount, this.baseTokenMint);
    const isPoolUsingSol = isNativeSolMint(poolBaseToken);

    console.log(`[StakingPoolClient] Withdraw from pool:`, {
      pool: params.poolAddress.toBase58().slice(0, 12),
      token: isPoolUsingSol ? 'SOL' : 'USDC',
      mint: poolBaseToken.toBase58().slice(0, 12),
      shares: params.shares.toString(),
    });

    // Get withdrawer's token account using pool's base token
    const withdrawerTokenAccount = await getAssociatedTokenAddress(
      poolBaseToken,
      withdrawer
    );

    // Get pool vault using pool's base token
    const poolVault = await getAssociatedTokenAddress(
      poolBaseToken,
      params.poolAddress,
      true
    );

    const [poolMintAuthority] = this.derivePoolMintAuthority(params.poolAddress);

    // Get withdrawer's pool token account
    const withdrawerPoolTokenAccount = await getAssociatedTokenAddress(
      poolMint,
      withdrawer
    );

    const tx = new Transaction();

    // =======================================================================
    // STEP 1: Ensure withdrawer's base token ATA exists
    // =======================================================================
    const withdrawerTokenAccountInfo = await this.connection.getAccountInfo(withdrawerTokenAccount);
    if (!withdrawerTokenAccountInfo) {
      console.log(`[StakingPoolClient] Creating withdrawer token ATA for ${isPoolUsingSol ? 'wSOL' : 'token'}...`);
      tx.add(
        createAssociatedTokenAccountInstruction(
          withdrawer,               // payer
          withdrawerTokenAccount,   // ATA address
          withdrawer,               // owner
          poolBaseToken             // mint (wSOL or USDC)
        )
      );
    }

    // =======================================================================
    // STEP 2: Build withdraw instruction
    // =======================================================================
    const ix = await this.program.methods
      .withdraw(params.shares)
      .accounts({
        withdrawer,
        poolState: params.poolAddress,
        depositorState,
        withdrawerTokenAccount,
        poolVault,
        poolMint,
        poolMintAuthority,
        withdrawerPoolTokenAccount,
        baseTokenMint: poolBaseToken, // Use pool's token from on-chain state
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    tx.add(ix);

    // =======================================================================
    // STEP 3: For native SOL, unwrap wSOL back to native SOL
    // =======================================================================
    if (isPoolUsingSol) {
      // Close wSOL account - this returns the lamports (wSOL balance + rent) to the owner
      tx.add(
        createCloseAccountInstruction(
          withdrawerTokenAccount,  // wSOL ATA to close
          withdrawer,              // destination for lamports
          withdrawer               // authority
        )
      );
    }
    // For USDC/other tokens: tokens stay in the ATA, no unwrapping needed

    tx.feePayer = withdrawer;

    return tx;
  }

  // ===========================================================================
  // ACCOUNT FETCHING
  // ===========================================================================

  /**
   * Fetch pool state
   */
  async getPoolState(poolAddress: PublicKey): Promise<unknown | null> {
    try {
      // Use generic account fetch since IDL types aren't statically available
      const accountInfo = await this.connection.getAccountInfo(poolAddress);
      if (!accountInfo) return null;
      // Use Anchor's coder to decode
      const coder = this.program.coder.accounts;
      return coder.decode('stakingPoolState', accountInfo.data);
    } catch {
      return null;
    }
  }

  /**
   * Fetch depositor state
   */
  async getDepositorState(poolAddress: PublicKey, depositor: PublicKey): Promise<unknown | null> {
    const [depositorPda] = this.deriveDepositorPda(poolAddress, depositor);
    try {
      const accountInfo = await this.connection.getAccountInfo(depositorPda);
      if (!accountInfo) return null;
      const coder = this.program.coder.accounts;
      return coder.decode('depositorState', accountInfo.data);
    } catch {
      return null;
    }
  }

  /**
   * Get all pools for a forecaster
   */
  async getPoolsForForecaster(forecaster: PublicKey) {
    const [poolPda] = this.derivePoolPda(forecaster);
    const pool = await this.getPoolState(poolPda);
    return pool ? [{ address: poolPda, state: pool }] : [];
  }

  /**
   * Fetch ALL pools from the blockchain
   */
  async getAllPools(): Promise<Array<{ address: PublicKey; state: unknown }>> {
    try {
      // Fetch all StakingPoolState accounts from the program
      const accounts = await (this.program.account as any).stakingPoolState.all();

      return accounts.map((acc: any) => ({
        address: acc.publicKey,
        state: acc.account,
      }));
    } catch (err) {
      console.error('[StakingPoolClient] Failed to fetch all pools:', err);
      return [];
    }
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  get programId(): PublicKey {
    return PROGRAM_ID;
  }

  get baseTokenMintAddress(): PublicKey {
    return this.baseTokenMint;
  }

  get isNativeSol(): boolean {
    return this.useNativeSol;
  }

  get tokenSymbol(): 'SOL' | 'USDC' {
    return this.useNativeSol ? 'SOL' : 'USDC';
  }

  get tokenDecimals(): number {
    return this.useNativeSol ? 9 : 6;
  }

  // Legacy getter for backwards compatibility
  get usdcMintAddress(): PublicKey {
    return this.baseTokenMint;
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let clientInstance: StakingPoolAnchorClient | null = null;

export function getStakingPoolClient(
  connection: Connection,
  options?: { network?: 'devnet' | 'mainnet'; tokenMint?: string }
): StakingPoolAnchorClient {
  // If custom tokenMint is provided, create a fresh client (don't use singleton)
  if (options?.tokenMint) {
    console.log(`[getStakingPoolClient] Creating client with custom token mint: ${options.tokenMint.slice(0, 8)}...`);
    return new StakingPoolAnchorClient(connection, options);
  }
  // Use singleton for default cases
  if (!clientInstance) {
    clientInstance = new StakingPoolAnchorClient(connection, options);
  }
  return clientInstance;
}

export function resetStakingPoolClient(): void {
  clientInstance = null;
}

// =============================================================================
// DEFAULT CONFIG FOR POOL CREATION
// =============================================================================

export const DEFAULT_POOL_CONFIG: PoolConfig = {
  minDeposit: new BN(5_000_000), // 5 USDC (6 decimals)
  maxCapacity: new BN(100_000_000_000), // 100k USDC
  performanceFeeBps: 2000, // 20%
  managementFeeBps: 200, // 2%
  lockPeriodDays: 7,
  withdrawalNoticeDays: 3,
  entryFeeBps: 0,
  exitFeeBps: 50, // 0.5%
};
