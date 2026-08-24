import { PublicKey } from '@solana/web3.js';

export const BERIGHT_CAPITAL_PROGRAM_ID = new PublicKey('F2WkXzns4p5pe8NAuK6V5NhZ4bdpXxAE9h5kLAMtxqCT');

const CONFIG_SEED = Buffer.from('capital-config');
const MARKET_SEED = Buffer.from('market');
const POSITION_SEED = Buffer.from('position');
const PRICE_SEED = Buffer.from('price');
const LENDING_SEED = Buffer.from('lending');
const LENDER_SEED = Buffer.from('lender');
const LOAN_SEED = Buffer.from('loan');
const INTENT_SEED = Buffer.from('intent');
const THESIS_SEED = Buffer.from('thesis');
const THESIS_VAULT_SEED = Buffer.from('thesis-vault');
const THESIS_SHARE_MINT_SEED = Buffer.from('thesis-share');
const THESIS_LIQUID_VAULT_SEED = Buffer.from('thesis-liquid');
const THESIS_CONTRIBUTOR_SEED = Buffer.from('thesis-contributor');
const SIMULATED_POSITION_SEED = Buffer.from('sim-position');
const REDEMPTION_SEED = Buffer.from('redemption');

export function deriveCapitalConfigPda(programId = BERIGHT_CAPITAL_PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([CONFIG_SEED], programId);
}

export function deriveCapitalMarketPda(config: PublicKey, marketId: Uint8Array, programId = BERIGHT_CAPITAL_PROGRAM_ID): [PublicKey, number] {
  if (marketId.length !== 32) throw new Error('marketId must be exactly 32 bytes.');
  return PublicKey.findProgramAddressSync([MARKET_SEED, config.toBuffer(), Buffer.from(marketId)], programId);
}

export function deriveCapitalPositionPda(market: PublicKey, owner: PublicKey, programId = BERIGHT_CAPITAL_PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([POSITION_SEED, market.toBuffer(), owner.toBuffer()], programId);
}

export function deriveCapitalPricePda(market: PublicKey, programId = BERIGHT_CAPITAL_PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([PRICE_SEED, market.toBuffer()], programId);
}

export function deriveLendingPoolPda(market: PublicKey, programId = BERIGHT_CAPITAL_PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([LENDING_SEED, market.toBuffer()], programId);
}

export function deriveLenderPda(pool: PublicKey, owner: PublicKey, programId = BERIGHT_CAPITAL_PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([LENDER_SEED, pool.toBuffer(), owner.toBuffer()], programId);
}

export function deriveLoanPda(pool: PublicKey, borrower: PublicKey, programId = BERIGHT_CAPITAL_PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([LOAN_SEED, pool.toBuffer(), borrower.toBuffer()], programId);
}

export function deriveAgentIntentPda(position: PublicKey, nonce: bigint, programId = BERIGHT_CAPITAL_PROGRAM_ID): [PublicKey, number] {
  if (nonce < 0n || nonce > 0xffff_ffff_ffff_ffffn) throw new Error('nonce must fit in u64.');
  const nonceBytes = Buffer.alloc(8);
  nonceBytes.writeBigUInt64LE(nonce);
  return PublicKey.findProgramAddressSync([INTENT_SEED, position.toBuffer(), nonceBytes], programId);
}

export function deriveThesisPda(
  config: PublicKey,
  creator: PublicKey,
  thesisId: Uint8Array,
  programId = BERIGHT_CAPITAL_PROGRAM_ID,
): [PublicKey, number] {
  assertBytes32(thesisId, 'thesisId');
  return PublicKey.findProgramAddressSync(
    [THESIS_SEED, config.toBuffer(), creator.toBuffer(), Buffer.from(thesisId)],
    programId,
  );
}

export function deriveThesisVaultPda(
  thesis: PublicKey,
  programId = BERIGHT_CAPITAL_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([THESIS_VAULT_SEED, thesis.toBuffer()], programId);
}

export function deriveThesisShareMintPda(
  vault: PublicKey,
  programId = BERIGHT_CAPITAL_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([THESIS_SHARE_MINT_SEED, vault.toBuffer()], programId);
}

export function deriveThesisLiquidVaultPda(
  vault: PublicKey,
  programId = BERIGHT_CAPITAL_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([THESIS_LIQUID_VAULT_SEED, vault.toBuffer()], programId);
}

export function deriveThesisContributorPda(
  vault: PublicKey,
  owner: PublicKey,
  programId = BERIGHT_CAPITAL_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [THESIS_CONTRIBUTOR_SEED, vault.toBuffer(), owner.toBuffer()],
    programId,
  );
}

export function deriveSimulatedPositionPda(
  vault: PublicKey,
  marketId: Uint8Array,
  programId = BERIGHT_CAPITAL_PROGRAM_ID,
): [PublicKey, number] {
  assertBytes32(marketId, 'marketId');
  return PublicKey.findProgramAddressSync(
    [SIMULATED_POSITION_SEED, vault.toBuffer(), Buffer.from(marketId)],
    programId,
  );
}

export function deriveThesisRedemptionPda(
  vault: PublicKey,
  nonce: bigint,
  programId = BERIGHT_CAPITAL_PROGRAM_ID,
): [PublicKey, number] {
  const nonceBytes = u64Bytes(nonce, 'nonce');
  return PublicKey.findProgramAddressSync([REDEMPTION_SEED, vault.toBuffer(), nonceBytes], programId);
}

function assertBytes32(value: Uint8Array, name: string): void {
  if (value.length !== 32) throw new Error(`${name} must be exactly 32 bytes.`);
}

function u64Bytes(value: bigint, name: string): Buffer {
  if (value < 0n || value > 0xffff_ffff_ffff_ffffn) throw new Error(`${name} must fit in u64.`);
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(value);
  return bytes;
}
