/**
 * BeRight Conviction Escrow - On-chain Integration
 *
 * Client SDK for interacting with the conviction escrow Solana program.
 * Handles creating markets, staking SOL, resolving outcomes, and claiming funds.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
} from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { BN } from '@coral-xyz/anchor';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Program ID for conviction escrow (devnet/localnet) */
export const ESCROW_PROGRAM_ID = new PublicKey(
  'E6Gp6fzaPM6y1k3wLYBFno1oMZjZvNbaFszVGzvXaZX9'
);

/** Minimum stake in SOL */
export const MIN_STAKE_SOL = 0.1;

/** Minimum stake in lamports */
export const MIN_STAKE_LAMPORTS = MIN_STAKE_SOL * LAMPORTS_PER_SOL;

/** PDA seeds */
export const MARKET_SEED = Buffer.from('market');
export const VAULT_SEED = Buffer.from('vault');

// ============================================================================
// TYPES
// ============================================================================

/** Stake position on a market */
export type EscrowStakePosition = 'yes' | 'no';

/** Market status from on-chain */
export type EscrowMarketStatus =
  | 'pending_stake'
  | 'active'
  | 'resolved'
  | 'claimed';

/** Market outcome from on-chain */
export type EscrowMarketOutcome = 'none' | 'yes' | 'no' | 'invalid';

/** On-chain market account data */
export interface EscrowMarketAccount {
  bump: number;
  vaultBump: number;
  projectWallet: PublicKey;
  resolver: PublicKey;
  stakeAmount: BN;
  stakePosition: EscrowStakePosition;
  resolutionDate: BN;
  status: EscrowMarketStatus;
  outcome: EscrowMarketOutcome;
  createdAt: BN;
}

/** Request to create an escrow market */
export interface CreateEscrowMarketRequest {
  /** Project wallet that will stake */
  projectWallet: PublicKey;
  /** Authority that can resolve the market */
  resolver: PublicKey;
  /** Project's position (yes = milestone achieved, no = milestone missed) */
  stakePosition: EscrowStakePosition;
  /** Unix timestamp for resolution */
  resolutionDate: number;
  /** Amount to stake in SOL */
  stakeAmountSol: number;
}

/** Response from creating an escrow market */
export interface CreateEscrowMarketResponse {
  /** Market PDA address */
  marketPda: PublicKey;
  /** Vault PDA address */
  vaultPda: PublicKey;
  /** Transaction to sign and send */
  transaction: Transaction;
  /** Market bump seed */
  marketBump: number;
  /** Vault bump seed */
  vaultBump: number;
}

/** Request to stake on a market */
export interface StakeEscrowRequest {
  /** Market PDA address */
  marketPda: PublicKey;
  /** Project wallet that is staking */
  projectWallet: PublicKey;
}

/** Request to resolve a market */
export interface ResolveEscrowRequest {
  /** Market PDA address */
  marketPda: PublicKey;
  /** Resolver wallet */
  resolver: PublicKey;
  /** Outcome of the market */
  outcome: 'yes' | 'no' | 'invalid';
}

/** Request to claim from a market */
export interface ClaimEscrowRequest {
  /** Market PDA address */
  marketPda: PublicKey;
  /** Claimer wallet */
  claimer: PublicKey;
}

// ============================================================================
// PDA DERIVATION
// ============================================================================

/**
 * Derive market PDA from project wallet
 */
export function deriveMarketPda(
  projectWallet: PublicKey,
  programId: PublicKey = ESCROW_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MARKET_SEED, projectWallet.toBuffer()],
    programId
  );
}

/**
 * Derive vault PDA from market PDA
 */
export function deriveVaultPda(
  marketPda: PublicKey,
  programId: PublicKey = ESCROW_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, marketPda.toBuffer()],
    programId
  );
}

/**
 * Get both market and vault PDAs for a project
 */
export function deriveEscrowPdas(projectWallet: PublicKey): {
  marketPda: PublicKey;
  marketBump: number;
  vaultPda: PublicKey;
  vaultBump: number;
} {
  const [marketPda, marketBump] = deriveMarketPda(projectWallet);
  const [vaultPda, vaultBump] = deriveVaultPda(marketPda);

  return { marketPda, marketBump, vaultPda, vaultBump };
}

// ============================================================================
// ESCROW CLIENT CLASS
// ============================================================================

/**
 * Client for interacting with the conviction escrow program
 */
export class ConvictionEscrowClient {
  private connection: Connection;
  private programId: PublicKey;

  constructor(
    connection: Connection,
    programId: PublicKey = ESCROW_PROGRAM_ID
  ) {
    this.connection = connection;
    this.programId = programId;
  }

  /**
   * Get market account data
   */
  async getMarket(marketPda: PublicKey): Promise<EscrowMarketAccount | null> {
    const accountInfo = await this.connection.getAccountInfo(marketPda);
    if (!accountInfo) return null;

    // Decode account data (skip 8-byte discriminator)
    const data = accountInfo.data.slice(8);

    return this.decodeMarketAccount(data);
  }

  /**
   * Get vault balance
   */
  async getVaultBalance(vaultPda: PublicKey): Promise<number> {
    const balance = await this.connection.getBalance(vaultPda);
    return balance / LAMPORTS_PER_SOL;
  }

  /**
   * Check if a market exists for a project wallet
   */
  async marketExists(projectWallet: PublicKey): Promise<boolean> {
    const { marketPda } = deriveEscrowPdas(projectWallet);
    const accountInfo = await this.connection.getAccountInfo(marketPda);
    return accountInfo !== null;
  }

  /**
   * Build create market transaction
   */
  buildCreateMarketTransaction(
    request: CreateEscrowMarketRequest
  ): CreateEscrowMarketResponse {
    const { projectWallet, resolver, stakePosition, resolutionDate, stakeAmountSol } = request;

    // Validate stake amount
    if (stakeAmountSol < MIN_STAKE_SOL) {
      throw new Error(`Minimum stake is ${MIN_STAKE_SOL} SOL`);
    }

    // Validate resolution date
    const now = Math.floor(Date.now() / 1000);
    if (resolutionDate <= now) {
      throw new Error('Resolution date must be in the future');
    }

    // Derive PDAs
    const { marketPda, marketBump, vaultPda, vaultBump } = deriveEscrowPdas(projectWallet);

    // Build instruction data
    const stakePositionValue = stakePosition === 'yes' ? 0 : 1;
    const stakeAmountLamports = Math.floor(stakeAmountSol * LAMPORTS_PER_SOL);

    // Create instruction (would use Anchor IDL in production)
    const instruction = this.buildCreateMarketInstruction(
      marketPda,
      vaultPda,
      projectWallet,
      resolver,
      stakePositionValue,
      resolutionDate,
      stakeAmountLamports
    );

    const transaction = new Transaction().add(instruction);

    return {
      marketPda,
      vaultPda,
      transaction,
      marketBump,
      vaultBump,
    };
  }

  /**
   * Build stake transaction
   */
  buildStakeTransaction(request: StakeEscrowRequest): Transaction {
    const { marketPda, projectWallet } = request;
    const { vaultPda } = deriveEscrowPdas(projectWallet);

    const instruction = this.buildStakeInstruction(
      marketPda,
      vaultPda,
      projectWallet
    );

    return new Transaction().add(instruction);
  }

  /**
   * Build resolve transaction
   */
  buildResolveTransaction(request: ResolveEscrowRequest): Transaction {
    const { marketPda, resolver, outcome } = request;

    const outcomeValue =
      outcome === 'yes' ? 1 : outcome === 'no' ? 2 : 3;

    const instruction = this.buildResolveInstruction(
      marketPda,
      resolver,
      outcomeValue
    );

    return new Transaction().add(instruction);
  }

  /**
   * Build claim transaction
   */
  buildClaimTransaction(request: ClaimEscrowRequest): Transaction {
    const { marketPda, claimer } = request;

    // Get market to find vault
    const marketInfo = this.connection.getAccountInfo(marketPda);

    // Derive vault from market (we need to read market first to get project wallet)
    // For now, use a placeholder approach
    const instruction = this.buildClaimInstruction(marketPda, claimer);

    return new Transaction().add(instruction);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private decodeMarketAccount(data: Buffer): EscrowMarketAccount {
    let offset = 0;

    const bump = data.readUInt8(offset);
    offset += 1;

    const vaultBump = data.readUInt8(offset);
    offset += 1;

    const projectWallet = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const resolver = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const stakeAmount = new BN(data.slice(offset, offset + 8), 'le');
    offset += 8;

    const stakePositionByte = data.readUInt8(offset);
    offset += 1;
    const stakePosition: EscrowStakePosition = stakePositionByte === 0 ? 'yes' : 'no';

    const resolutionDate = new BN(data.slice(offset, offset + 8), 'le');
    offset += 8;

    const statusByte = data.readUInt8(offset);
    offset += 1;
    const statusMap: EscrowMarketStatus[] = ['pending_stake', 'active', 'resolved', 'claimed'];
    const status = statusMap[statusByte] || 'pending_stake';

    const outcomeByte = data.readUInt8(offset);
    offset += 1;
    const outcomeMap: EscrowMarketOutcome[] = ['none', 'yes', 'no', 'invalid'];
    const outcome = outcomeMap[outcomeByte] || 'none';

    const createdAt = new BN(data.slice(offset, offset + 8), 'le');

    return {
      bump,
      vaultBump,
      projectWallet,
      resolver,
      stakeAmount,
      stakePosition,
      resolutionDate,
      status,
      outcome,
      createdAt,
    };
  }

  private buildCreateMarketInstruction(
    marketPda: PublicKey,
    vaultPda: PublicKey,
    project: PublicKey,
    resolver: PublicKey,
    stakePosition: number,
    resolutionDate: number,
    stakeAmount: number
  ): TransactionInstruction {
    // Anchor discriminator for create_market
    const discriminator = Buffer.from([
      143, 102, 179, 96, 44, 99, 221, 30, // sighash of "global:create_market"
    ]);

    // Instruction data
    const data = Buffer.alloc(1 + 8 + 8); // stakePosition + resolutionDate + stakeAmount
    let offset = 0;

    data.writeUInt8(stakePosition, offset);
    offset += 1;

    const resDateBN = new BN(resolutionDate);
    resDateBN.toArrayLike(Buffer, 'le', 8).copy(data, offset);
    offset += 8;

    const stakeAmountBN = new BN(stakeAmount);
    stakeAmountBN.toArrayLike(Buffer, 'le', 8).copy(data, offset);

    const instructionData = Buffer.concat([discriminator, data]);

    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: marketPda, isSigner: false, isWritable: true },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: project, isSigner: true, isWritable: true },
        { pubkey: resolver, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });
  }

  private buildStakeInstruction(
    marketPda: PublicKey,
    vaultPda: PublicKey,
    project: PublicKey
  ): TransactionInstruction {
    // Anchor discriminator for stake
    const discriminator = Buffer.from([
      206, 176, 202, 18, 200, 209, 179, 108, // sighash of "global:stake"
    ]);

    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: marketPda, isSigner: false, isWritable: true },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: project, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: discriminator,
    });
  }

  private buildResolveInstruction(
    marketPda: PublicKey,
    resolver: PublicKey,
    outcome: number
  ): TransactionInstruction {
    // Anchor discriminator for resolve
    const discriminator = Buffer.from([
      234, 246, 167, 121, 161, 119, 197, 113, // sighash of "global:resolve"
    ]);

    const data = Buffer.alloc(1);
    data.writeUInt8(outcome, 0);

    const instructionData = Buffer.concat([discriminator, data]);

    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: marketPda, isSigner: false, isWritable: true },
        { pubkey: resolver, isSigner: true, isWritable: false },
      ],
      data: instructionData,
    });
  }

  private buildClaimInstruction(
    marketPda: PublicKey,
    claimer: PublicKey
  ): TransactionInstruction {
    // Anchor discriminator for claim
    const discriminator = Buffer.from([
      62, 198, 214, 193, 213, 159, 108, 210, // sighash of "global:claim"
    ]);

    // We need to derive vault from market, but for now use a placeholder
    // In production, read market account first to get project wallet
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [VAULT_SEED, marketPda.toBuffer()],
      this.programId
    );

    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: marketPda, isSigner: false, isWritable: true },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: claimer, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: discriminator,
    });
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let escrowClient: ConvictionEscrowClient | null = null;

/**
 * Get or create escrow client instance
 */
export function getEscrowClient(connection?: Connection): ConvictionEscrowClient {
  if (!escrowClient && connection) {
    escrowClient = new ConvictionEscrowClient(connection);
  }
  if (!escrowClient) {
    // Use default devnet connection
    const defaultConnection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'
    );
    escrowClient = new ConvictionEscrowClient(defaultConnection);
  }
  return escrowClient;
}

/**
 * Reset escrow client (for testing)
 */
export function resetEscrowClient(): void {
  escrowClient = null;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create escrow market for a project
 */
export async function createEscrowMarket(
  connection: Connection,
  request: CreateEscrowMarketRequest
): Promise<CreateEscrowMarketResponse> {
  const client = new ConvictionEscrowClient(connection);
  return client.buildCreateMarketTransaction(request);
}

/**
 * Get escrow market data
 */
export async function getEscrowMarket(
  connection: Connection,
  marketPda: PublicKey
): Promise<EscrowMarketAccount | null> {
  const client = new ConvictionEscrowClient(connection);
  return client.getMarket(marketPda);
}

/**
 * Get escrow market by project wallet
 */
export async function getEscrowMarketByProject(
  connection: Connection,
  projectWallet: PublicKey
): Promise<EscrowMarketAccount | null> {
  const { marketPda } = deriveEscrowPdas(projectWallet);
  const client = new ConvictionEscrowClient(connection);
  return client.getMarket(marketPda);
}

// ============================================================================
// EXPORTS OBJECT
// ============================================================================

export const escrow = {
  client: ConvictionEscrowClient,
  getClient: getEscrowClient,
  resetClient: resetEscrowClient,

  // PDA derivation
  deriveMarketPda,
  deriveVaultPda,
  deriveEscrowPdas,

  // Operations
  createMarket: createEscrowMarket,
  getMarket: getEscrowMarket,
  getMarketByProject: getEscrowMarketByProject,

  // Constants
  PROGRAM_ID: ESCROW_PROGRAM_ID,
  MIN_STAKE_SOL,
  MIN_STAKE_LAMPORTS,
};

export default escrow;
