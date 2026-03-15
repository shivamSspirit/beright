/**
 * BeRight On-Chain ForecasterProfile PDA
 *
 * Minimal on-chain state design for Solana (~168 bytes).
 * Rich data lives off-chain in Supabase, verified against merkle root.
 *
 * Design Goals:
 * 1. Minimize rent cost (~0.002 SOL for 168 bytes)
 * 2. Store verifiable commitments (merkle root)
 * 3. Enable on-chain ranking queries
 * 4. Support token mint reference
 *
 * PDA Seeds: ["forecaster", authority_pubkey]
 *
 * @author BeRight Protocol
 */

import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import BN from 'bn.js';

// =============================================================================
// CONSTANTS
// =============================================================================

export const PROGRAM_ID = new PublicKey('GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ');
export const FORECASTER_SEED = 'forecaster';
export const FORECASTER_PROFILE_SIZE = 168; // bytes

// Tier enum values for on-chain storage
export const TIER_UNRANKED = 0;
export const TIER_ROOKIE = 1;
export const TIER_VERIFIED = 2;
export const TIER_ELITE = 3;
export const TIER_SUPERFORECASTER = 4;

// Feature flags (bitflags)
export const FLAG_CAN_CREATE_TOURNAMENT = 1 << 0;
export const FLAG_IS_VERIFIED = 1 << 1;
export const FLAG_HAS_TOKEN = 1 << 2;
export const FLAG_ACTIVE = 1 << 3;

// =============================================================================
// ON-CHAIN ACCOUNT STRUCTURE
// =============================================================================

/**
 * ForecasterProfile PDA Account
 *
 * Layout (168 bytes):
 * - discriminator: 8 bytes (anchor auto-adds)
 * - authority: 32 bytes
 * - token_mint: 32 bytes
 * - predictions_root: 32 bytes
 * - prediction_count: 4 bytes (u32)
 * - composite_score: 2 bytes (u16, 0-10000)
 * - skill_rating: 2 bytes (u16, centered at 1000)
 * - total_volume_usd: 8 bytes (u64, in cents)
 * - total_pnl_cents: 8 bytes (i64, signed, in cents)
 * - tier: 1 byte (u8)
 * - flags: 1 byte (u8, bitflags)
 * - created_at: 8 bytes (i64)
 * - last_prediction_at: 8 bytes (i64)
 * - last_updated_at: 8 bytes (i64)
 * - bump: 1 byte (u8)
 * - version: 1 byte (u8)
 * - _padding: 12 bytes (reserved for future use)
 *
 * Total: 8 + 32 + 32 + 32 + 4 + 2 + 2 + 8 + 8 + 1 + 1 + 8 + 8 + 8 + 1 + 1 + 12 = 168 bytes
 */
export interface ForecasterProfileAccount {
  // Identity (64 bytes)
  authority: PublicKey;         // Owner wallet (PDA seed)
  tokenMint: PublicKey;         // SPL token mint (or SystemProgram if none)

  // Commitment (36 bytes)
  predictionsRoot: number[];    // 32 bytes, merkle root of all predictions
  predictionCount: number;      // u32, total count for verification

  // Scores (20 bytes)
  compositeScore: number;       // u16, 0-10000 (basis points for precision)
  skillRating: number;          // u16, Elo-style, centered at 1000
  totalVolumeUsd: BN;           // u64, total volume in cents (divide by 100)
  totalPnlCents: BN;            // i64, signed P&L in cents

  // Status (2 bytes)
  tier: number;                 // u8, 0-4
  flags: number;                // u8, bitflags

  // Timestamps (24 bytes)
  createdAt: BN;                // i64, unix timestamp
  lastPredictionAt: BN;         // i64, unix timestamp
  lastUpdatedAt: BN;            // i64, unix timestamp

  // PDA metadata (2 bytes)
  bump: number;                 // u8
  version: number;              // u8, for future migrations
}

// =============================================================================
// PDA DERIVATION
// =============================================================================

/**
 * Derive ForecasterProfile PDA address
 */
export function deriveForecasterPda(
  authority: PublicKey,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(FORECASTER_SEED), authority.toBuffer()],
    programId
  );
}

/**
 * Check if a PDA exists
 */
export async function forecasterExists(
  connection: anchor.web3.Connection,
  authority: PublicKey
): Promise<boolean> {
  const [pda] = deriveForecasterPda(authority);
  const account = await connection.getAccountInfo(pda);
  return account !== null;
}

// =============================================================================
// ACCOUNT PARSING
// =============================================================================

/**
 * Parse ForecasterProfile account data
 */
export function parseForecasterProfile(
  data: Buffer
): ForecasterProfileAccount {
  // Skip 8-byte discriminator
  let offset = 8;

  const authority = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const tokenMint = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const predictionsRoot = Array.from(data.slice(offset, offset + 32));
  offset += 32;

  const predictionCount = data.readUInt32LE(offset);
  offset += 4;

  const compositeScore = data.readUInt16LE(offset);
  offset += 2;

  const skillRating = data.readUInt16LE(offset);
  offset += 2;

  const totalVolumeUsd = new BN(data.slice(offset, offset + 8), 'le');
  offset += 8;

  const totalPnlCents = new BN(data.slice(offset, offset + 8), 'le').fromTwos(64);
  offset += 8;

  const tier = data.readUInt8(offset);
  offset += 1;

  const flags = data.readUInt8(offset);
  offset += 1;

  const createdAt = new BN(data.slice(offset, offset + 8), 'le');
  offset += 8;

  const lastPredictionAt = new BN(data.slice(offset, offset + 8), 'le');
  offset += 8;

  const lastUpdatedAt = new BN(data.slice(offset, offset + 8), 'le');
  offset += 8;

  const bump = data.readUInt8(offset);
  offset += 1;

  const version = data.readUInt8(offset);

  return {
    authority,
    tokenMint,
    predictionsRoot,
    predictionCount,
    compositeScore,
    skillRating,
    totalVolumeUsd,
    totalPnlCents,
    tier,
    flags,
    createdAt,
    lastPredictionAt,
    lastUpdatedAt,
    bump,
    version,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert tier number to string
 */
export function tierToString(tier: number): string {
  switch (tier) {
    case TIER_UNRANKED:
      return 'unranked';
    case TIER_ROOKIE:
      return 'rookie';
    case TIER_VERIFIED:
      return 'verified';
    case TIER_ELITE:
      return 'elite';
    case TIER_SUPERFORECASTER:
      return 'superforecaster';
    default:
      return 'unknown';
  }
}

/**
 * Check flag
 */
export function hasFlag(flags: number, flag: number): boolean {
  return (flags & flag) !== 0;
}

/**
 * Convert merkle root bytes to hex string
 */
export function rootToHex(root: number[]): string {
  return Buffer.from(root).toString('hex');
}

/**
 * Convert hex string to merkle root bytes
 */
export function hexToRoot(hex: string): number[] {
  return Array.from(Buffer.from(hex, 'hex'));
}

/**
 * Format USD amount from cents
 */
export function centsToUsd(cents: BN): number {
  return cents.toNumber() / 100;
}

// =============================================================================
// IDL TYPE (for Anchor client)
// =============================================================================

/**
 * Anchor IDL type for ForecasterProfile
 *
 * This matches what Anchor would generate from the Rust program.
 */
export const FORECASTER_PROFILE_IDL_TYPE = {
  name: 'forecasterProfile',
  type: {
    kind: 'struct',
    fields: [
      { name: 'authority', type: 'publicKey' },
      { name: 'tokenMint', type: 'publicKey' },
      { name: 'predictionsRoot', type: { array: ['u8', 32] } },
      { name: 'predictionCount', type: 'u32' },
      { name: 'compositeScore', type: 'u16' },
      { name: 'skillRating', type: 'u16' },
      { name: 'totalVolumeUsd', type: 'u64' },
      { name: 'totalPnlCents', type: 'i64' },
      { name: 'tier', type: 'u8' },
      { name: 'flags', type: 'u8' },
      { name: 'createdAt', type: 'i64' },
      { name: 'lastPredictionAt', type: 'i64' },
      { name: 'lastUpdatedAt', type: 'i64' },
      { name: 'bump', type: 'u8' },
      { name: 'version', type: 'u8' },
      { name: 'padding', type: { array: ['u8', 12] } },
    ],
  },
};

// =============================================================================
// INSTRUCTION TYPES
// =============================================================================

/**
 * Initialize ForecasterProfile instruction args
 */
export interface InitializeForecasterArgs {
  // No args - authority is derived from signer
}

/**
 * Update ForecasterProfile instruction args
 */
export interface UpdateForecasterArgs {
  predictionsRoot: number[];    // 32 bytes
  predictionCount: number;      // u32
  compositeScore: number;       // u16
  skillRating: number;          // u16
  totalVolumeUsd: BN;           // u64
  totalPnlCents: BN;            // i64
  tier: number;                 // u8
}

/**
 * Set token mint instruction args
 */
export interface SetTokenMintArgs {
  tokenMint: PublicKey;
}

// =============================================================================
// ACCOUNT VALIDATION
// =============================================================================

/**
 * Validate ForecasterProfile account data
 */
export function validateForecasterProfile(
  account: ForecasterProfileAccount
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check composite score range
  if (account.compositeScore > 10000) {
    errors.push(`Composite score ${account.compositeScore} exceeds max 10000`);
  }

  // Check tier value
  if (account.tier > TIER_SUPERFORECASTER) {
    errors.push(`Invalid tier value: ${account.tier}`);
  }

  // Check predictions root is 32 bytes
  if (account.predictionsRoot.length !== 32) {
    errors.push(`Invalid predictions root length: ${account.predictionsRoot.length}`);
  }

  // Check version
  if (account.version !== 1) {
    errors.push(`Unknown version: ${account.version}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  PROGRAM_ID,
  FORECASTER_SEED,
  FORECASTER_PROFILE_SIZE,
  deriveForecasterPda,
  forecasterExists,
  parseForecasterProfile,
  tierToString,
  hasFlag,
  rootToHex,
  hexToRoot,
  centsToUsd,
  validateForecasterProfile,
  FORECASTER_PROFILE_IDL_TYPE,

  // Constants
  TIER_UNRANKED,
  TIER_ROOKIE,
  TIER_VERIFIED,
  TIER_ELITE,
  TIER_SUPERFORECASTER,
  FLAG_CAN_CREATE_TOURNAMENT,
  FLAG_IS_VERIFIED,
  FLAG_HAS_TOKEN,
  FLAG_ACTIVE,
};
