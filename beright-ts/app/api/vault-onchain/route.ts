/**
 * GET /api/vault-onchain?owner=<pubkey>&cluster=<devnet|mainnet>
 *
 * Reads the BeRight vault state for a given owner from the Solana chain.
 * Returns vault balance, timelock status, guardian config, and all counters.
 * Read-only — no wallet required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import IDL from '../../../lib/onchain-vault/beright_vault.idl.json';

const PROGRAM_ID = new PublicKey('EhU2oz3LKPDCVRhRW5TXMeraqVFoSJ3L42cyeC6Ns2eL');

const ENDPOINTS: Record<string, string> = {
  localnet: 'http://127.0.0.1:8899',
  devnet:   'https://api.devnet.solana.com',
  mainnet:  'https://api.mainnet-beta.solana.com',
};

function deriveVaultState(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault_state'), owner.toBuffer()],
    PROGRAM_ID,
  );
}

function deriveVault(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), owner.toBuffer()],
    PROGRAM_ID,
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ownerStr = searchParams.get('owner');
  const cluster  = searchParams.get('cluster') ?? 'devnet';

  if (!ownerStr) {
    return NextResponse.json({ error: 'owner query param required' }, { status: 400 });
  }

  let owner: PublicKey;
  try {
    owner = new PublicKey(ownerStr);
  } catch {
    return NextResponse.json({ error: 'invalid owner pubkey' }, { status: 400 });
  }

  const rpc = ENDPOINTS[cluster] ?? ENDPOINTS.devnet;
  const connection = new Connection(rpc, 'confirmed');

  // Minimal read-only provider — no signing needed
  const provider = new AnchorProvider(
    connection,
    { publicKey: owner, signTransaction: async (t) => t, signAllTransactions: async (t) => t },
    { commitment: 'confirmed' },
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = new Program(IDL as any, provider);

  const [vaultStatePda] = deriveVaultState(owner);
  const [vaultPda]      = deriveVault(owner);

  let state: Record<string, unknown> | null = null;
  let vaultLamports = 0;
  let initialized = false;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await (program.account as any).vaultState.fetch(vaultStatePda);
    initialized = true;
    vaultLamports = await connection.getBalance(vaultPda);

    const now = Math.floor(Date.now() / 1000);
    const lockUntil = (raw.lockUntil as BN).toNumber();

    state = {
      owner:                 raw.owner.toString(),
      vaultPda:              vaultPda.toString(),
      vaultStatePda:         vaultStatePda.toString(),

      // Balances
      vaultLamports,
      vaultSol:              vaultLamports / LAMPORTS_PER_SOL,
      totalDeposited:        (raw.totalDeposited as BN).toNumber(),
      totalWithdrawn:        (raw.totalWithdrawn as BN).toNumber(),

      // Timelock
      isFrozen:              raw.isFrozen as boolean,
      lockUntil,
      timelocked:            lockUntil > now,
      unlocksInSeconds:      Math.max(0, lockUntil - now),
      withdrawalDelay:       (raw.withdrawalDelay as BN).toNumber(),

      // Epoch limit
      epochWithdrawLimit:    (raw.epochWithdrawLimit as BN).toNumber(),
      epochWithdrawn:        (raw.epochWithdrawn as BN).toNumber(),
      currentEpoch:          (raw.currentEpoch as BN).toNumber(),

      // Guardian
      guardianSet:           raw.guardianSet as boolean,
      guardian:              raw.guardian ? raw.guardian.toString() : null,
      largeWithdrawThreshold: (raw.largeWithdrawThreshold as BN).toNumber(),

      // Meta
      version:               raw.version as number,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('Account does not exist') && !msg.includes('could not find account')) {
      return NextResponse.json({ error: `Failed to read vault state: ${msg}` }, { status: 500 });
    }
    // Account doesn't exist — vault not initialized
  }

  return NextResponse.json({
    initialized,
    owner: ownerStr,
    cluster,
    vaultStatePda: vaultStatePda.toString(),
    vaultPda:      vaultPda.toString(),
    state,
    timestamp:     new Date().toISOString(),
  });
}
