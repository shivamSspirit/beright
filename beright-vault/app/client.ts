/**
 * BeRight Vault — TypeScript Client SDK
 *
 * Usage:
 *   const client = new VaultClient(connection, wallet);
 *   await client.initVault({ withdrawalDelay: 86400, epochWithdrawLimit: sol(10) });
 *   await client.deposit({ amount: sol(1) });
 *   await client.withdraw({ amount: sol(0.5) });
 */

import {
  Connection,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Transaction,
} from '@solana/web3.js';
import {
  AnchorProvider,
  BN,
  Program,
  web3,
  Idl,
} from '@coral-xyz/anchor';
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

import { PROGRAM_ID, SEEDS } from './constants';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface VaultStateData {
  vaultBump: number;
  stateBump: number;
  owner: PublicKey;
  totalDeposited: BN;
  totalWithdrawn: BN;
  isFrozen: boolean;
  version: number;
  lockUntil: BN;
  withdrawalDelay: BN;
  epochWithdrawLimit: BN;
  currentEpoch: BN;
  epochWithdrawn: BN;
  guardian: PublicKey;
  largeWithdrawThreshold: BN;
  guardianSet: boolean;
}

export interface InitVaultParams {
  withdrawalDelay?: number;         // seconds (default: 0 = no lock)
  epochWithdrawLimit?: number;      // lamports (default: 0 = unlimited)
  largeWithdrawThreshold?: number;  // lamports (default: 0 = disabled)
}

export interface DepositParams {
  amount: number;  // lamports
}

export interface WithdrawParams {
  amount: number;      // lamports
  guardianKeypair?: web3.Keypair; // required if amount >= large_withdraw_threshold
}

export interface SetGuardianParams {
  guardian: PublicKey;
  threshold: number;  // lamports
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Convert SOL to lamports */
export function sol(amount: number): number {
  return Math.floor(amount * LAMPORTS_PER_SOL);
}

/** Derive the vault PDA for a given owner */
export function deriveVaultPda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.VAULT), owner.toBuffer()],
    PROGRAM_ID,
  );
}

/** Derive the vault state PDA for a given owner */
export function deriveVaultStatePda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.VAULT_STATE), owner.toBuffer()],
    PROGRAM_ID,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VAULT CLIENT
// ─────────────────────────────────────────────────────────────────────────────

export class VaultClient {
  public program: Program;
  public provider: AnchorProvider;
  public owner: PublicKey;

  constructor(
    connection: Connection,
    wallet: AnchorProvider['wallet'],
    idl: Idl,
    owner?: PublicKey,
  ) {
    this.provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed',
    });
    this.program = new Program(idl, this.provider);
    this.owner = owner ?? wallet.publicKey;
  }

  /** PDAs for this client's vault */
  get vaultPda(): PublicKey {
    return deriveVaultPda(this.owner)[0];
  }

  get vaultStatePda(): PublicKey {
    return deriveVaultStatePda(this.owner)[0];
  }

  // ─── Vault Lifecycle ───────────────────────────────────────────────────────

  /**
   * Initialize a new vault. Caller becomes the owner.
   * Only callable once per owner wallet.
   */
  async initVault(params: InitVaultParams = {}): Promise<string> {
    const {
      withdrawalDelay = 0,
      epochWithdrawLimit = 0,
      largeWithdrawThreshold = 0,
    } = params;

    const [vault]      = deriveVaultPda(this.owner);
    const [vaultState] = deriveVaultStatePda(this.owner);

    const tx = await this.program.methods
      .initVault(
        new BN(withdrawalDelay),
        new BN(epochWithdrawLimit),
        new BN(largeWithdrawThreshold),
      )
      .accounts({
        owner:       this.owner,
        vaultState,
        vault,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  // ─── SOL Operations ────────────────────────────────────────────────────────

  /**
   * Deposit SOL into the vault.
   * Anyone can call this — not just the owner.
   */
  async deposit(params: DepositParams): Promise<string> {
    const { amount } = params;
    const [vault]      = deriveVaultPda(this.owner);
    const [vaultState] = deriveVaultStatePda(this.owner);

    const tx = await this.program.methods
      .deposit(new BN(amount))
      .accounts({
        user:         this.provider.wallet.publicKey,
        owner:        this.owner,
        vaultState,
        vault,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  /**
   * Withdraw SOL from the vault.
   * Only the vault owner can call this.
   * Pass `guardianKeypair` if the amount exceeds the large-withdrawal threshold.
   */
  async withdraw(params: WithdrawParams): Promise<string> {
    const { amount, guardianKeypair } = params;
    const [vault]      = deriveVaultPda(this.owner);
    const [vaultState] = deriveVaultStatePda(this.owner);

    const methodBuilder = this.program.methods
      .withdraw(new BN(amount))
      .accounts({
        owner:         this.owner,
        vaultState,
        vault,
        systemProgram:  SystemProgram.programId,
      });

    // Add guardian as additional signer if provided
    if (guardianKeypair) {
      methodBuilder.signers([guardianKeypair]);
    }

    const tx = await methodBuilder.rpc();
    return tx;
  }

  // ─── SPL Token Operations ──────────────────────────────────────────────────

  /** Deposit SPL tokens into the vault's associated token account */
  async depositToken(mint: PublicKey, amount: number): Promise<string> {
    const [vaultState] = deriveVaultStatePda(this.owner);
    const userTokenAccount = await getAssociatedTokenAddress(
      mint,
      this.provider.wallet.publicKey,
    );
    const vaultTokenAccount = await getAssociatedTokenAddress(
      mint,
      vaultState,
      true, // allowOwnerOffCurve — PDA is off-curve
    );

    const tx = await this.program.methods
      .depositToken(new BN(amount))
      .accounts({
        user:               this.provider.wallet.publicKey,
        owner:              this.owner,
        vaultState,
        mint,
        userTokenAccount,
        vaultTokenAccount,
        tokenProgram:            TOKEN_PROGRAM_ID,
        associatedTokenProgram:  ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram:           SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  /** Withdraw SPL tokens from the vault */
  async withdrawToken(mint: PublicKey, amount: number): Promise<string> {
    const [vaultState] = deriveVaultStatePda(this.owner);
    const vaultTokenAccount = await getAssociatedTokenAddress(
      mint,
      vaultState,
      true,
    );
    const ownerTokenAccount = await getAssociatedTokenAddress(
      mint,
      this.owner,
    );

    const tx = await this.program.methods
      .withdrawToken(new BN(amount))
      .accounts({
        owner:              this.owner,
        vaultState,
        mint,
        vaultTokenAccount,
        ownerTokenAccount,
        tokenProgram:           TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram:          SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  // ─── Security Operations ───────────────────────────────────────────────────

  /** Freeze the vault (owner or admin) */
  async freezeVault(): Promise<string> {
    const [vaultState] = deriveVaultStatePda(this.owner);

    const tx = await this.program.methods
      .freezeVault()
      .accounts({
        authority:  this.provider.wallet.publicKey,
        owner:      this.owner,
        vaultState,
      })
      .rpc();

    return tx;
  }

  /** Unfreeze the vault */
  async unfreezeVault(): Promise<string> {
    const [vaultState] = deriveVaultStatePda(this.owner);

    const tx = await this.program.methods
      .unfreezeVault()
      .accounts({
        authority:  this.provider.wallet.publicKey,
        owner:      this.owner,
        vaultState,
      })
      .rpc();

    return tx;
  }

  /** Configure a guardian for large withdrawals */
  async setGuardian(params: SetGuardianParams): Promise<string> {
    const { guardian, threshold } = params;
    const [vaultState] = deriveVaultStatePda(this.owner);

    const tx = await this.program.methods
      .setGuardian(guardian, new BN(threshold))
      .accounts({
        owner:      this.owner,
        vaultState,
      })
      .rpc();

    return tx;
  }

  /** Remove guardian requirement */
  async removeGuardian(): Promise<string> {
    const [vaultState] = deriveVaultStatePda(this.owner);

    const tx = await this.program.methods
      .removeGuardian()
      .accounts({
        owner:      this.owner,
        vaultState,
      })
      .rpc();

    return tx;
  }

  // ─── Read Methods ──────────────────────────────────────────────────────────

  /** Fetch and decode the vault state */
  async fetchVaultState(): Promise<VaultStateData> {
    const [vaultState] = deriveVaultStatePda(this.owner);
    return this.program.account['vaultState'].fetch(vaultState) as Promise<VaultStateData>;
  }

  /** Get current vault SOL balance */
  async getVaultBalance(): Promise<number> {
    const [vault] = deriveVaultPda(this.owner);
    return this.provider.connection.getBalance(vault);
  }

  /** Get vault token balance for a given mint */
  async getVaultTokenBalance(mint: PublicKey): Promise<number> {
    const [vaultState] = deriveVaultStatePda(this.owner);
    const ata = await getAssociatedTokenAddress(mint, vaultState, true);
    try {
      const balance = await this.provider.connection.getTokenAccountBalance(ata);
      return Number(balance.value.amount);
    } catch {
      return 0;
    }
  }

  /** Check whether the vault is currently timelocked */
  async isTimelocked(): Promise<{ locked: boolean; unlocksAt: Date | null }> {
    const state = await this.fetchVaultState();
    const now = Math.floor(Date.now() / 1000);
    const lockUntil = state.lockUntil.toNumber();

    if (lockUntil <= now) {
      return { locked: false, unlocksAt: null };
    }

    return {
      locked: true,
      unlocksAt: new Date(lockUntil * 1000),
    };
  }
}
