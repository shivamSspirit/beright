import {
  Connection,
  PublicKey,
  Transaction,
  TransactionSignature,
} from "@solana/web3.js";
import { BN, Program, Wallet } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

import {
  STAKING_POOL_PROGRAM_ID,
  DLMM_PROGRAM_ID,
  DlmmConfig,
  DlmmPositionState,
  DlmmConfigParams,
  CreatePositionParams,
  RebalanceParams,
  DlmmPositionStatus,
  deriveDlmmConfigPda,
  deriveDlmmPositionPda,
  shouldRebalance,
  calculatePositionValueInY,
  isPositionInRange,
} from "./types";

export interface DlmmPoolAccounts {
  dlmmPool: PublicKey;
  tokenXMint: PublicKey;
  tokenYMint: PublicKey;
  dlmmTokenXVault: PublicKey;
  dlmmTokenYVault: PublicKey;
  binArrayLower: PublicKey;
  binArrayUpper: PublicKey;
}

export interface DlmmPositionClientConfig {
  connection: Connection;
  wallet: Wallet;
  stakingPoolProgram: Program;
}

/**
 * Client for managing DLMM positions in staking pools
 */
export class DlmmPositionClient {
  private connection: Connection;
  private wallet: Wallet;
  private program: Program;

  constructor(config: DlmmPositionClientConfig) {
    this.connection = config.connection;
    this.wallet = config.wallet;
    this.program = config.stakingPoolProgram;
  }

  // === Configuration Methods ===

  /**
   * Initialize DLMM configuration for a pool
   */
  async initializeDlmmConfig(
    poolState: PublicKey,
    config?: DlmmConfigParams
  ): Promise<TransactionSignature> {
    const [dlmmConfig] = deriveDlmmConfigPda(poolState);

    const ix = await this.program.methods
      .initializeDlmmConfig(config || null)
      .accounts({
        forecaster: this.wallet.publicKey,
        poolState,
        dlmmConfig,
      })
      .instruction();

    const tx = new Transaction().add(ix);
    return await this.sendTransaction(tx);
  }

  /**
   * Update DLMM configuration
   */
  async updateDlmmConfig(
    poolState: PublicKey,
    config: DlmmConfigParams
  ): Promise<TransactionSignature> {
    const [dlmmConfig] = deriveDlmmConfigPda(poolState);

    const ix = await this.program.methods
      .updateDlmmConfig(config)
      .accounts({
        forecaster: this.wallet.publicKey,
        poolState,
        dlmmConfig,
      })
      .instruction();

    const tx = new Transaction().add(ix);
    return await this.sendTransaction(tx);
  }

  /**
   * Set DLMM active status
   */
  async setDlmmActive(
    poolState: PublicKey,
    isActive: boolean
  ): Promise<TransactionSignature> {
    const [dlmmConfig] = deriveDlmmConfigPda(poolState);

    const ix = await this.program.methods
      .setDlmmActive(isActive)
      .accounts({
        forecaster: this.wallet.publicKey,
        poolState,
        dlmmConfig,
      })
      .instruction();

    const tx = new Transaction().add(ix);
    return await this.sendTransaction(tx);
  }

  // === Position Management Methods ===

  /**
   * Create a new DLMM position
   */
  async createPosition(
    poolState: PublicKey,
    positionIndex: number,
    dlmmAccounts: DlmmPoolAccounts,
    params: CreatePositionParams,
    positionNftMint: PublicKey,
    positionNftAccount: PublicKey
  ): Promise<TransactionSignature> {
    const [dlmmConfig] = deriveDlmmConfigPda(poolState);
    const [positionState] = deriveDlmmPositionPda(poolState, positionIndex);

    const poolTokenX = getAssociatedTokenAddressSync(
      dlmmAccounts.tokenXMint,
      poolState,
      true
    );
    const poolTokenY = getAssociatedTokenAddressSync(
      dlmmAccounts.tokenYMint,
      poolState,
      true
    );

    const ix = await this.program.methods
      .createDlmmPosition(positionIndex, {
        lowerBinId: params.lowerBinId,
        upperBinId: params.upperBinId,
        amountX: params.amountX,
        amountY: params.amountY,
      })
      .accounts({
        forecaster: this.wallet.publicKey,
        poolState,
        dlmmConfig,
        positionState,
        dlmmPool: dlmmAccounts.dlmmPool,
        positionNftMint,
        positionNftAccount,
        tokenXMint: dlmmAccounts.tokenXMint,
        tokenYMint: dlmmAccounts.tokenYMint,
        poolTokenX,
        poolTokenY,
        dlmmTokenXVault: dlmmAccounts.dlmmTokenXVault,
        dlmmTokenYVault: dlmmAccounts.dlmmTokenYVault,
        binArrayLower: dlmmAccounts.binArrayLower,
        binArrayUpper: dlmmAccounts.binArrayUpper,
        dlmmProgram: DLMM_PROGRAM_ID,
      })
      .instruction();

    const tx = new Transaction().add(ix);
    return await this.sendTransaction(tx);
  }

  /**
   * Add liquidity to an existing position
   */
  async addLiquidity(
    poolState: PublicKey,
    positionIndex: number,
    dlmmAccounts: DlmmPoolAccounts,
    amountX: BN,
    amountY: BN,
    minShares: BN = new BN(0)
  ): Promise<TransactionSignature> {
    const [dlmmConfig] = deriveDlmmConfigPda(poolState);
    const [positionState] = deriveDlmmPositionPda(poolState, positionIndex);

    const poolTokenX = getAssociatedTokenAddressSync(
      dlmmAccounts.tokenXMint,
      poolState,
      true
    );
    const poolTokenY = getAssociatedTokenAddressSync(
      dlmmAccounts.tokenYMint,
      poolState,
      true
    );

    // Get position for NFT account
    const position = await this.getPositionState(poolState, positionIndex);

    const ix = await this.program.methods
      .addDlmmLiquidity(positionIndex, amountX, amountY, minShares)
      .accounts({
        forecaster: this.wallet.publicKey,
        poolState,
        dlmmConfig,
        positionState,
        poolTokenX,
        poolTokenY,
        dlmmTokenXVault: dlmmAccounts.dlmmTokenXVault,
        dlmmTokenYVault: dlmmAccounts.dlmmTokenYVault,
        dlmmPool: dlmmAccounts.dlmmPool,
        positionNftAccount: position.positionNft,
        binArrayLower: dlmmAccounts.binArrayLower,
        binArrayUpper: dlmmAccounts.binArrayUpper,
        dlmmProgram: DLMM_PROGRAM_ID,
      })
      .instruction();

    const tx = new Transaction().add(ix);
    return await this.sendTransaction(tx);
  }

  /**
   * Remove liquidity from a position
   */
  async removeLiquidity(
    poolState: PublicKey,
    positionIndex: number,
    dlmmAccounts: DlmmPoolAccounts,
    sharesToRemove: BN,
    minAmountX: BN = new BN(0),
    minAmountY: BN = new BN(0)
  ): Promise<TransactionSignature> {
    const [dlmmConfig] = deriveDlmmConfigPda(poolState);
    const [positionState] = deriveDlmmPositionPda(poolState, positionIndex);

    const poolTokenX = getAssociatedTokenAddressSync(
      dlmmAccounts.tokenXMint,
      poolState,
      true
    );
    const poolTokenY = getAssociatedTokenAddressSync(
      dlmmAccounts.tokenYMint,
      poolState,
      true
    );

    const position = await this.getPositionState(poolState, positionIndex);

    const ix = await this.program.methods
      .removeDlmmLiquidity(
        positionIndex,
        sharesToRemove,
        minAmountX,
        minAmountY
      )
      .accounts({
        forecaster: this.wallet.publicKey,
        poolState,
        dlmmConfig,
        positionState,
        poolTokenX,
        poolTokenY,
        dlmmTokenXVault: dlmmAccounts.dlmmTokenXVault,
        dlmmTokenYVault: dlmmAccounts.dlmmTokenYVault,
        dlmmPool: dlmmAccounts.dlmmPool,
        positionNftAccount: position.positionNft,
        binArrayLower: dlmmAccounts.binArrayLower,
        binArrayUpper: dlmmAccounts.binArrayUpper,
        dlmmProgram: DLMM_PROGRAM_ID,
      })
      .instruction();

    const tx = new Transaction().add(ix);
    return await this.sendTransaction(tx);
  }

  /**
   * Claim accumulated fees from a position
   */
  async claimFees(
    poolState: PublicKey,
    positionIndex: number,
    dlmmAccounts: DlmmPoolAccounts
  ): Promise<TransactionSignature> {
    const [dlmmConfig] = deriveDlmmConfigPda(poolState);
    const [positionState] = deriveDlmmPositionPda(poolState, positionIndex);

    const poolTokenX = getAssociatedTokenAddressSync(
      dlmmAccounts.tokenXMint,
      poolState,
      true
    );
    const poolTokenY = getAssociatedTokenAddressSync(
      dlmmAccounts.tokenYMint,
      poolState,
      true
    );

    const position = await this.getPositionState(poolState, positionIndex);

    const ix = await this.program.methods
      .claimDlmmFees(positionIndex)
      .accounts({
        forecaster: this.wallet.publicKey,
        poolState,
        dlmmConfig,
        positionState,
        poolTokenX,
        poolTokenY,
        dlmmTokenXVault: dlmmAccounts.dlmmTokenXVault,
        dlmmTokenYVault: dlmmAccounts.dlmmTokenYVault,
        dlmmPool: dlmmAccounts.dlmmPool,
        positionNftAccount: position.positionNft,
        binArrayLower: dlmmAccounts.binArrayLower,
        binArrayUpper: dlmmAccounts.binArrayUpper,
        dlmmProgram: DLMM_PROGRAM_ID,
      })
      .instruction();

    const tx = new Transaction().add(ix);
    return await this.sendTransaction(tx);
  }

  /**
   * Rebalance a position to a new range
   */
  async rebalancePosition(
    poolState: PublicKey,
    positionIndex: number,
    dlmmAccounts: DlmmPoolAccounts,
    params: RebalanceParams,
    newPositionNftMint: PublicKey,
    newPositionNftAccount: PublicKey
  ): Promise<TransactionSignature> {
    const [dlmmConfig] = deriveDlmmConfigPda(poolState);
    const [positionState] = deriveDlmmPositionPda(poolState, positionIndex);

    const poolTokenX = getAssociatedTokenAddressSync(
      dlmmAccounts.tokenXMint,
      poolState,
      true
    );
    const poolTokenY = getAssociatedTokenAddressSync(
      dlmmAccounts.tokenYMint,
      poolState,
      true
    );

    const position = await this.getPositionState(poolState, positionIndex);

    const ix = await this.program.methods
      .rebalanceDlmmPosition(positionIndex, {
        newLowerBinId: params.newLowerBinId,
        newUpperBinId: params.newUpperBinId,
        minAmountX: params.minAmountX,
        minAmountY: params.minAmountY,
      })
      .accounts({
        forecaster: this.wallet.publicKey,
        poolState,
        dlmmConfig,
        positionState,
        poolTokenX,
        poolTokenY,
        dlmmTokenXVault: dlmmAccounts.dlmmTokenXVault,
        dlmmTokenYVault: dlmmAccounts.dlmmTokenYVault,
        dlmmPool: dlmmAccounts.dlmmPool,
        oldPositionNftAccount: position.positionNft,
        newPositionNftMint,
        newPositionNftAccount,
        oldBinArrayLower: dlmmAccounts.binArrayLower,
        oldBinArrayUpper: dlmmAccounts.binArrayUpper,
        newBinArrayLower: dlmmAccounts.binArrayLower, // Same for simplicity
        newBinArrayUpper: dlmmAccounts.binArrayUpper,
        dlmmProgram: DLMM_PROGRAM_ID,
      })
      .instruction();

    const tx = new Transaction().add(ix);
    return await this.sendTransaction(tx);
  }

  // === Query Methods ===

  /**
   * Get DLMM config for a pool
   */
  async getDlmmConfig(poolState: PublicKey): Promise<DlmmConfig> {
    const [configPda] = deriveDlmmConfigPda(poolState);
    const account = await this.program.account.dlmmConfig.fetch(configPda);
    return account as unknown as DlmmConfig;
  }

  /**
   * Get a specific position state
   */
  async getPositionState(
    poolState: PublicKey,
    positionIndex: number
  ): Promise<DlmmPositionState> {
    const [positionPda] = deriveDlmmPositionPda(poolState, positionIndex);
    const account = await this.program.account.dlmmPositionState.fetch(
      positionPda
    );
    return account as unknown as DlmmPositionState;
  }

  /**
   * Get all positions for a pool
   */
  async getAllPositions(poolState: PublicKey): Promise<DlmmPositionState[]> {
    const config = await this.getDlmmConfig(poolState);
    const positions: DlmmPositionState[] = [];

    for (let i = 0; i < config.maxPositions; i++) {
      try {
        const position = await this.getPositionState(poolState, i);
        if (position.status !== DlmmPositionStatus.Closed) {
          positions.push(position);
        }
      } catch {
        // Position doesn't exist at this index
      }
    }

    return positions;
  }

  /**
   * Check which positions need rebalancing
   */
  async getPositionsNeedingRebalance(
    poolState: PublicKey
  ): Promise<DlmmPositionState[]> {
    const config = await this.getDlmmConfig(poolState);
    const positions = await this.getAllPositions(poolState);

    return positions.filter((p) =>
      shouldRebalance(p, config.rebalanceThresholdBps)
    );
  }

  /**
   * Calculate total value across all positions
   */
  async getTotalPositionValue(
    poolState: PublicKey,
    currentPrice: BN
  ): Promise<BN> {
    const positions = await this.getAllPositions(poolState);
    return positions.reduce(
      (total, p) => total.add(calculatePositionValueInY(p, currentPrice)),
      new BN(0)
    );
  }

  /**
   * Get total unclaimed fees
   */
  async getTotalUnclaimedFees(
    poolState: PublicKey
  ): Promise<{ feeX: BN; feeY: BN }> {
    const positions = await this.getAllPositions(poolState);
    return positions.reduce(
      (total, p) => ({
        feeX: total.feeX.add(p.unclaimedFeeX),
        feeY: total.feeY.add(p.unclaimedFeeY),
      }),
      { feeX: new BN(0), feeY: new BN(0) }
    );
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
 * Create DlmmPositionClient instance
 */
export function createDlmmPositionClient(
  connection: Connection,
  wallet: Wallet,
  stakingPoolProgram: Program
): DlmmPositionClient {
  return new DlmmPositionClient({
    connection,
    wallet,
    stakingPoolProgram,
  });
}
