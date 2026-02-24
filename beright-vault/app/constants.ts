import { PublicKey } from '@solana/web3.js';

/** Program ID — matches declared_id! in lib.rs and Anchor.toml */
export const PROGRAM_ID = new PublicKey('EhU2oz3LKPDCVRhRW5TXMeraqVFoSJ3L42cyeC6Ns2eL');

/** Global admin pubkey — replace with your actual admin wallet before mainnet */
export const ADMIN_PUBKEY = new PublicKey('BaQhHZ6gA49DSBeJ7PGbw3vJsVTUMpVfT2U79mHKWyWi');

/** Solana network endpoints */
export const ENDPOINTS = {
  localnet: 'http://127.0.0.1:8899',
  devnet:   'https://api.devnet.solana.com',
  mainnet:  'https://api.mainnet-beta.solana.com',
} as const;

/** Well-known SPL token mints */
export const MINTS = {
  USDC_DEVNET:  new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
  USDC_MAINNET: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
} as const;

/** PDA seed constants (must match Rust program) */
export const SEEDS = {
  VAULT:       'vault',
  VAULT_STATE: 'vault_state',
} as const;

/** Security limits (informational — enforced on-chain) */
export const LIMITS = {
  MAX_WITHDRAWAL_DELAY_SECS: 2_592_000, // 30 days
} as const;
