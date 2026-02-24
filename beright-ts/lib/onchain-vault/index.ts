/**
 * On-Chain BeRight Vault — shared constants and PDA helpers
 *
 * This is the Solana program vault (deposit/withdraw SOL, freeze, guardian,
 * epoch limits). It is NOT the same as the signal channels (see lib/channels/).
 *
 * Program: EhU2oz3LKPDCVRhRW5TXMeraqVFoSJ3L42cyeC6Ns2eL
 * IDL:     ./beright_vault.idl.json
 */

import { PublicKey } from '@solana/web3.js';

export const VAULT_PROGRAM_ID = new PublicKey('EhU2oz3LKPDCVRhRW5TXMeraqVFoSJ3L42cyeC6Ns2eL');

export const VAULT_RPC = {
  localnet: 'http://127.0.0.1:8899',
  devnet:   'https://api.devnet.solana.com',
  mainnet:  'https://api.mainnet-beta.solana.com',
} as const;

export type VaultCluster = keyof typeof VAULT_RPC;

/** Derive the vault SOL-holding PDA for an owner. */
export function deriveVaultPda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), owner.toBuffer()],
    VAULT_PROGRAM_ID,
  );
}

/** Derive the vault state (metadata) PDA for an owner. */
export function deriveVaultStatePda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault_state'), owner.toBuffer()],
    VAULT_PROGRAM_ID,
  );
}

export { default as VaultIDL } from './beright_vault.idl.json';
