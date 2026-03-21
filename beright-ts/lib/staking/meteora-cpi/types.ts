import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

// Program IDs
export const STAKING_POOL_PROGRAM_ID = new PublicKey(
  "STAKEpoo11111111111111111111111111111111111"
);

export const METEORA_VAULT_PROGRAM_ID = new PublicKey(
  "24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi"
);

// Seeds
export const METEORA_VAULT_STATE_SEED = Buffer.from("meteora_vault_state");

// Constants
export const VIRTUAL_PRICE_DECIMALS = new BN(1_000_000_000); // 1e9
export const MAX_ALLOCATION_BPS = 10_000; // 100%

/**
 * Meteora Vault State account data
 */
export interface MeteoraVaultState {
  bump: number;
  pool: PublicKey;
  vault: PublicKey;
  vaultLpMint: PublicKey;
  underlyingMint: PublicKey;
  depositedAmount: BN;
  lpTokenBalance: BN;
  lastVirtualPrice: BN;
  totalYieldEarned: BN;
  lastHarvestTs: BN;
  allocationBps: number;
  minDeposit: BN;
  isActive: boolean;
  createdAt: BN;
  lastUpdate: BN;
}

/**
 * Staking Pool State (simplified, relevant fields)
 */
export interface StakingPoolState {
  forecaster: PublicKey;
  poolMint: PublicKey;
  baseTokenMint: PublicKey;
  poolVault: PublicKey;
  totalDeposits: BN;
  availableLiquidity: BN;
  bump: number;
}

/**
 * Initialize Meteora Vault params
 */
export interface InitializeMeteoraVaultParams {
  allocationBps: number; // Percentage of idle capital (0-10000)
  minDeposit: BN; // Minimum deposit amount
}

/**
 * Deposit to Meteora params
 */
export interface DepositToMeteoraParams {
  amount: BN;
}

/**
 * Withdraw from Meteora params
 */
export interface WithdrawFromMeteoraParams {
  lpAmount: BN;
  minOutAmount: BN;
}

/**
 * Harvest yield params
 */
export interface HarvestMeteoraYieldParams {
  newVirtualPrice: BN;
}

/**
 * Update allocation params
 */
export interface UpdateMeteoraAllocationParams {
  newAllocationBps: number;
}

// Events

export interface MeteoraVaultInitializedEvent {
  pool: PublicKey;
  meteoraVault: PublicKey;
  vaultLpMint: PublicKey;
  underlyingMint: PublicKey;
  allocationBps: number;
  minDeposit: BN;
  timestamp: BN;
}

export interface MeteoraDepositEvent {
  pool: PublicKey;
  amountDeposited: BN;
  lpTokensReceived: BN;
  virtualPrice: BN;
  totalDeposited: BN;
  timestamp: BN;
}

export interface MeteoraWithdrawEvent {
  pool: PublicKey;
  lpTokensBurned: BN;
  amountReceived: BN;
  yieldRealized: BN;
  virtualPrice: BN;
  remainingLp: BN;
  timestamp: BN;
}

export interface MeteoraYieldHarvestedEvent {
  pool: PublicKey;
  yieldAmount: BN;
  oldVirtualPrice: BN;
  newVirtualPrice: BN;
  lpTokenBalance: BN;
  totalYieldEarned: BN;
  timestamp: BN;
}

/**
 * Calculate pending yield based on virtual price increase
 */
export function calculatePendingYield(
  lpTokenBalance: BN,
  lastVirtualPrice: BN,
  currentVirtualPrice: BN
): BN {
  if (currentVirtualPrice.lte(lastVirtualPrice)) {
    return new BN(0);
  }

  const priceDiff = currentVirtualPrice.sub(lastVirtualPrice);
  return lpTokenBalance.mul(priceDiff).div(VIRTUAL_PRICE_DECIMALS);
}

/**
 * Calculate expected LP tokens from deposit
 */
export function calculateExpectedLpTokens(
  amount: BN,
  virtualPrice: BN
): BN {
  return amount.mul(VIRTUAL_PRICE_DECIMALS).div(virtualPrice);
}

/**
 * Calculate expected underlying from LP tokens
 */
export function calculateExpectedUnderlying(
  lpAmount: BN,
  virtualPrice: BN
): BN {
  return lpAmount.mul(virtualPrice).div(VIRTUAL_PRICE_DECIMALS);
}

/**
 * Derive Meteora vault state PDA
 */
export function deriveMeteoraVaultStatePda(
  poolPubkey: PublicKey,
  programId: PublicKey = STAKING_POOL_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [METEORA_VAULT_STATE_SEED, poolPubkey.toBuffer()],
    programId
  );
}
