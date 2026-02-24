'use client';

/**
 * useVault — React hook for BeRight on-chain vault operations
 *
 * Uses Privy wallet + @coral-xyz/anchor to read and write vault state.
 *
 * Usage:
 *   const { vaultState, deposit, withdraw, initVault, loading, error } = useVault();
 */

import { useState, useEffect, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useSignTransaction } from '@privy-io/react-auth/solana';
import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  Transaction,
  VersionedTransaction,
  SystemProgram,
} from '@solana/web3.js';
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import IDL from '@/lib/beright_vault.idl.json';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const PROGRAM_ID  = new PublicKey('EhU2oz3LKPDCVRhRW5TXMeraqVFoSJ3L42cyeC6Ns2eL');
const SOLANA_RPC  = process.env.NEXT_PUBLIC_SOLANA_RPC ?? 'https://api.devnet.solana.com';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface VaultState {
  owner:                  string;
  vaultPda:               string;
  vaultStatePda:          string;
  vaultLamports:          number;
  vaultSol:               number;
  totalDeposited:         number;
  totalWithdrawn:         number;
  isFrozen:               boolean;
  lockUntil:              number;
  timelocked:             boolean;
  unlocksInSeconds:       number;
  withdrawalDelay:        number;
  epochWithdrawLimit:     number;
  epochWithdrawn:         number;
  currentEpoch:           number;
  guardianSet:            boolean;
  guardian:               string | null;
  largeWithdrawThreshold: number;
  version:                number;
}

export interface InitVaultParams {
  withdrawalDelay?:        number;  // seconds (0 = no lock)
  epochWithdrawLimit?:     number;  // lamports (0 = unlimited)
  largeWithdrawThreshold?: number;  // lamports (0 = disabled)
}

// ─────────────────────────────────────────────────────────────────────────────
// PDA HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function deriveVaultPda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), owner.toBuffer()],
    PROGRAM_ID,
  );
}

function deriveVaultStatePda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault_state'), owner.toBuffer()],
    PROGRAM_ID,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useVault() {
  const { ready, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { signTransaction } = useSignTransaction();

  const [vaultState, setVaultState]     = useState<VaultState | null>(null);
  const [initialized, setInitialized]   = useState<boolean>(false);
  const [loading, setLoading]           = useState(false);
  const [txLoading, setTxLoading]       = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [lastTx, setLastTx]             = useState<string | null>(null);

  // Pick the active Solana wallet (prefer external over embedded)
  const wallet = wallets.find(w => w.walletClientType !== 'privy') ?? wallets[0];
  const ownerPubkey = wallet?.address ? new PublicKey(wallet.address) : null;

  // Build Anchor program instance for the current wallet
  const buildProgram = useCallback(() => {
    if (!ownerPubkey) return null;

    const connection = new Connection(SOLANA_RPC, 'confirmed');

    const anchorWallet = {
      publicKey: ownerPubkey,
      signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
        // Serialize transaction for Privy's signTransaction API
        const serialized = tx.serialize({ requireAllSignatures: false });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const signed = await signTransaction(serialized as any);
        return signed as unknown as T;
      },
      signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
        return Promise.all(txs.map(tx => anchorWallet.signTransaction(tx)));
      },
    };

    const provider = new AnchorProvider(connection, anchorWallet, { commitment: 'confirmed' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Program(IDL as any, provider);
  }, [ownerPubkey, signTransaction]);

  // ─── Read vault state ────────────────────────────────────────────────────

  const fetchVaultState = useCallback(async () => {
    if (!ownerPubkey) return;
    setLoading(true);
    setError(null);

    try {
      const program = buildProgram();
      if (!program) return;

      const connection = new Connection(SOLANA_RPC, 'confirmed');
      const [vaultStatePda] = deriveVaultStatePda(ownerPubkey);
      const [vaultPda]      = deriveVaultPda(ownerPubkey);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = await (program.account as any).vaultState.fetch(vaultStatePda);
      setInitialized(true);

      const vaultLamports = await connection.getBalance(vaultPda);
      const now = Math.floor(Date.now() / 1000);
      const lockUntil = (raw.lockUntil as BN).toNumber();

      setVaultState({
        owner:                  raw.owner.toString(),
        vaultPda:               vaultPda.toString(),
        vaultStatePda:          vaultStatePda.toString(),
        vaultLamports,
        vaultSol:               vaultLamports / LAMPORTS_PER_SOL,
        totalDeposited:         (raw.totalDeposited as BN).toNumber(),
        totalWithdrawn:         (raw.totalWithdrawn as BN).toNumber(),
        isFrozen:               raw.isFrozen,
        lockUntil,
        timelocked:             lockUntil > now,
        unlocksInSeconds:       Math.max(0, lockUntil - now),
        withdrawalDelay:        (raw.withdrawalDelay as BN).toNumber(),
        epochWithdrawLimit:     (raw.epochWithdrawLimit as BN).toNumber(),
        epochWithdrawn:         (raw.epochWithdrawn as BN).toNumber(),
        currentEpoch:           (raw.currentEpoch as BN).toNumber(),
        guardianSet:            raw.guardianSet,
        guardian:               raw.guardian ? raw.guardian.toString() : null,
        largeWithdrawThreshold: (raw.largeWithdrawThreshold as BN).toNumber(),
        version:                raw.version,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('Account does not exist') || msg.includes('could not find account')) {
        setInitialized(false);
        setVaultState(null);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [ownerPubkey, buildProgram]);

  // Auto-fetch on mount and wallet change
  useEffect(() => {
    if (ready && authenticated && walletsReady && ownerPubkey) {
      fetchVaultState();
    }
  }, [ready, authenticated, walletsReady, ownerPubkey, fetchVaultState]);

  // ─── Init vault ──────────────────────────────────────────────────────────

  const initVault = useCallback(async (params: InitVaultParams = {}): Promise<string> => {
    const program = buildProgram();
    if (!program || !ownerPubkey) throw new Error('Wallet not connected');

    setTxLoading(true);
    setError(null);
    try {
      const [vaultState] = deriveVaultStatePda(ownerPubkey);
      const [vault]      = deriveVaultPda(ownerPubkey);

      const tx = await program.methods
        .initVault(
          new BN(params.withdrawalDelay        ?? 0),
          new BN(params.epochWithdrawLimit      ?? 0),
          new BN(params.largeWithdrawThreshold  ?? 0),
        )
        .accounts({
          owner:         ownerPubkey,
          vaultState,
          vault,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setLastTx(tx);
      await fetchVaultState();
      return tx;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setTxLoading(false);
    }
  }, [buildProgram, ownerPubkey, fetchVaultState]);

  // ─── Deposit SOL ─────────────────────────────────────────────────────────

  const deposit = useCallback(async (amountSol: number): Promise<string> => {
    const program = buildProgram();
    if (!program || !ownerPubkey) throw new Error('Wallet not connected');

    setTxLoading(true);
    setError(null);
    try {
      const [vaultState] = deriveVaultStatePda(ownerPubkey);
      const [vault]      = deriveVaultPda(ownerPubkey);
      const lamports     = Math.floor(amountSol * LAMPORTS_PER_SOL);

      const tx = await program.methods
        .deposit(new BN(lamports))
        .accounts({
          user:          ownerPubkey,
          owner:         ownerPubkey,
          vaultState,
          vault,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setLastTx(tx);
      await fetchVaultState();
      return tx;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setTxLoading(false);
    }
  }, [buildProgram, ownerPubkey, fetchVaultState]);

  // ─── Withdraw SOL ────────────────────────────────────────────────────────

  const withdraw = useCallback(async (amountSol: number): Promise<string> => {
    const program = buildProgram();
    if (!program || !ownerPubkey) throw new Error('Wallet not connected');

    setTxLoading(true);
    setError(null);
    try {
      const [vaultState] = deriveVaultStatePda(ownerPubkey);
      const [vault]      = deriveVaultPda(ownerPubkey);
      const lamports     = Math.floor(amountSol * LAMPORTS_PER_SOL);

      const tx = await program.methods
        .withdraw(new BN(lamports))
        .accounts({
          owner:         ownerPubkey,
          vaultState,
          vault,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setLastTx(tx);
      await fetchVaultState();
      return tx;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setTxLoading(false);
    }
  }, [buildProgram, ownerPubkey, fetchVaultState]);

  // ─── Freeze / Unfreeze ───────────────────────────────────────────────────

  const freezeVault = useCallback(async (): Promise<string> => {
    const program = buildProgram();
    if (!program || !ownerPubkey) throw new Error('Wallet not connected');

    setTxLoading(true);
    setError(null);
    try {
      const [vaultState] = deriveVaultStatePda(ownerPubkey);
      const tx = await program.methods
        .freezeVault()
        .accounts({ authority: ownerPubkey, owner: ownerPubkey, vaultState })
        .rpc();
      setLastTx(tx);
      await fetchVaultState();
      return tx;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setTxLoading(false);
    }
  }, [buildProgram, ownerPubkey, fetchVaultState]);

  const unfreezeVault = useCallback(async (): Promise<string> => {
    const program = buildProgram();
    if (!program || !ownerPubkey) throw new Error('Wallet not connected');

    setTxLoading(true);
    setError(null);
    try {
      const [vaultState] = deriveVaultStatePda(ownerPubkey);
      const tx = await program.methods
        .unfreezeVault()
        .accounts({ authority: ownerPubkey, owner: ownerPubkey, vaultState })
        .rpc();
      setLastTx(tx);
      await fetchVaultState();
      return tx;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setTxLoading(false);
    }
  }, [buildProgram, ownerPubkey, fetchVaultState]);

  // ─── Guardian ────────────────────────────────────────────────────────────

  const setGuardian = useCallback(async (guardianPubkey: string, thresholdSol: number): Promise<string> => {
    const program = buildProgram();
    if (!program || !ownerPubkey) throw new Error('Wallet not connected');

    setTxLoading(true);
    setError(null);
    try {
      const [vaultState]  = deriveVaultStatePda(ownerPubkey);
      const guardian      = new PublicKey(guardianPubkey);
      const thresholdLamp = Math.floor(thresholdSol * LAMPORTS_PER_SOL);

      const tx = await program.methods
        .setGuardian(guardian, new BN(thresholdLamp))
        .accounts({ owner: ownerPubkey, vaultState })
        .rpc();
      setLastTx(tx);
      await fetchVaultState();
      return tx;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setTxLoading(false);
    }
  }, [buildProgram, ownerPubkey, fetchVaultState]);

  const removeGuardian = useCallback(async (): Promise<string> => {
    const program = buildProgram();
    if (!program || !ownerPubkey) throw new Error('Wallet not connected');

    setTxLoading(true);
    setError(null);
    try {
      const [vaultState] = deriveVaultStatePda(ownerPubkey);
      const tx = await program.methods
        .removeGuardian()
        .accounts({ owner: ownerPubkey, vaultState })
        .rpc();
      setLastTx(tx);
      await fetchVaultState();
      return tx;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setTxLoading(false);
    }
  }, [buildProgram, ownerPubkey, fetchVaultState]);

  return {
    // State
    vaultState,
    initialized,
    loading,
    txLoading,
    error,
    lastTx,
    ownerPubkey,
    connected: !!ownerPubkey && authenticated,

    // Actions
    fetchVaultState,
    initVault,
    deposit,
    withdraw,
    freezeVault,
    unfreezeVault,
    setGuardian,
    removeGuardian,
  };
}
