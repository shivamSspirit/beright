import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { BN, Program } from "@coral-xyz/anchor";
import {
  STAKING_POOL_PROGRAM_ID,
  METEORA_VAULT_PROGRAM_ID,
  deriveMeteoraVaultStatePda,
} from "./types";

/**
 * Build initialize_meteora_vault instruction
 */
export async function buildInitializeMeteoraVaultIx(
  program: Program,
  params: {
    forecaster: PublicKey;
    poolState: PublicKey;
    meteoraVault: PublicKey;
    vaultLpMint: PublicKey;
    underlyingMint: PublicKey;
    poolUnderlyingAccount: PublicKey;
    allocationBps: number;
    minDeposit: BN;
  }
): Promise<TransactionInstruction> {
  const [meteoraState] = deriveMeteoraVaultStatePda(params.poolState);

  const poolLpAccount = getAssociatedTokenAddressSync(
    params.vaultLpMint,
    params.poolState,
    true // allowOwnerOffCurve for PDA
  );

  return await program.methods
    .initializeMeteoraVault(params.allocationBps, params.minDeposit)
    .accounts({
      forecaster: params.forecaster,
      poolState: params.poolState,
      meteoraState,
      meteoraVault: params.meteoraVault,
      vaultLpMint: params.vaultLpMint,
      underlyingMint: params.underlyingMint,
      poolUnderlyingAccount: params.poolUnderlyingAccount,
      poolLpAccount,
      meteoraProgram: METEORA_VAULT_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction();
}

/**
 * Build deposit_to_meteora instruction
 */
export async function buildDepositToMeteoraIx(
  program: Program,
  params: {
    forecaster: PublicKey;
    poolState: PublicKey;
    poolUnderlyingAccount: PublicKey;
    poolLpAccount: PublicKey;
    meteoraVault: PublicKey;
    meteoraTokenVault: PublicKey;
    vaultLpMint: PublicKey;
    vaultAuthority: PublicKey;
    amount: BN;
  }
): Promise<TransactionInstruction> {
  const [meteoraState] = deriveMeteoraVaultStatePda(params.poolState);

  return await program.methods
    .depositToMeteora(params.amount)
    .accounts({
      forecaster: params.forecaster,
      poolState: params.poolState,
      meteoraState,
      poolUnderlyingAccount: params.poolUnderlyingAccount,
      poolLpAccount: params.poolLpAccount,
      meteoraProgram: METEORA_VAULT_PROGRAM_ID,
      meteoraVault: params.meteoraVault,
      meteoraTokenVault: params.meteoraTokenVault,
      vaultLpMint: params.vaultLpMint,
      vaultAuthority: params.vaultAuthority,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

/**
 * Build withdraw_from_meteora instruction
 */
export async function buildWithdrawFromMeteoraIx(
  program: Program,
  params: {
    forecaster: PublicKey;
    poolState: PublicKey;
    poolUnderlyingAccount: PublicKey;
    poolLpAccount: PublicKey;
    meteoraVault: PublicKey;
    meteoraTokenVault: PublicKey;
    vaultLpMint: PublicKey;
    vaultAuthority: PublicKey;
    lpAmount: BN;
    minOutAmount: BN;
  }
): Promise<TransactionInstruction> {
  const [meteoraState] = deriveMeteoraVaultStatePda(params.poolState);

  return await program.methods
    .withdrawFromMeteora(params.lpAmount, params.minOutAmount)
    .accounts({
      forecaster: params.forecaster,
      poolState: params.poolState,
      meteoraState,
      poolUnderlyingAccount: params.poolUnderlyingAccount,
      poolLpAccount: params.poolLpAccount,
      meteoraProgram: METEORA_VAULT_PROGRAM_ID,
      meteoraVault: params.meteoraVault,
      meteoraTokenVault: params.meteoraTokenVault,
      vaultLpMint: params.vaultLpMint,
      vaultAuthority: params.vaultAuthority,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

/**
 * Build withdraw_all_from_meteora instruction
 */
export async function buildWithdrawAllFromMeteoraIx(
  program: Program,
  params: {
    forecaster: PublicKey;
    poolState: PublicKey;
    poolUnderlyingAccount: PublicKey;
    poolLpAccount: PublicKey;
    meteoraVault: PublicKey;
    meteoraTokenVault: PublicKey;
    vaultLpMint: PublicKey;
    vaultAuthority: PublicKey;
  }
): Promise<TransactionInstruction> {
  const [meteoraState] = deriveMeteoraVaultStatePda(params.poolState);

  return await program.methods
    .withdrawAllFromMeteora()
    .accounts({
      forecaster: params.forecaster,
      poolState: params.poolState,
      meteoraState,
      poolUnderlyingAccount: params.poolUnderlyingAccount,
      poolLpAccount: params.poolLpAccount,
      meteoraProgram: METEORA_VAULT_PROGRAM_ID,
      meteoraVault: params.meteoraVault,
      meteoraTokenVault: params.meteoraTokenVault,
      vaultLpMint: params.vaultLpMint,
      vaultAuthority: params.vaultAuthority,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

/**
 * Build harvest_meteora_yield instruction
 */
export async function buildHarvestMeteoraYieldIx(
  program: Program,
  params: {
    forecaster: PublicKey;
    poolState: PublicKey;
    meteoraVault: PublicKey;
    newVirtualPrice: BN;
  }
): Promise<TransactionInstruction> {
  const [meteoraState] = deriveMeteoraVaultStatePda(params.poolState);

  return await program.methods
    .harvestMeteoraYield(params.newVirtualPrice)
    .accounts({
      forecaster: params.forecaster,
      poolState: params.poolState,
      meteoraState,
      meteoraVault: params.meteoraVault,
    })
    .instruction();
}

/**
 * Build auto_harvest_meteora_yield instruction (permissionless)
 */
export async function buildAutoHarvestMeteoraYieldIx(
  program: Program,
  params: {
    caller: PublicKey;
    poolState: PublicKey;
    meteoraVault: PublicKey;
  }
): Promise<TransactionInstruction> {
  const [meteoraState] = deriveMeteoraVaultStatePda(params.poolState);

  return await program.methods
    .autoHarvestMeteoraYield()
    .accounts({
      caller: params.caller,
      poolState: params.poolState,
      meteoraState,
      meteoraVault: params.meteoraVault,
    })
    .instruction();
}

/**
 * Build update_meteora_allocation instruction
 */
export async function buildUpdateMeteoraAllocationIx(
  program: Program,
  params: {
    forecaster: PublicKey;
    poolState: PublicKey;
    newAllocationBps: number;
  }
): Promise<TransactionInstruction> {
  const [meteoraState] = deriveMeteoraVaultStatePda(params.poolState);

  return await program.methods
    .updateMeteoraAllocation(params.newAllocationBps)
    .accounts({
      forecaster: params.forecaster,
      poolState: params.poolState,
      meteoraState,
    })
    .instruction();
}

/**
 * Build set_meteora_active instruction
 */
export async function buildSetMeteoraActiveIx(
  program: Program,
  params: {
    forecaster: PublicKey;
    poolState: PublicKey;
    isActive: boolean;
  }
): Promise<TransactionInstruction> {
  const [meteoraState] = deriveMeteoraVaultStatePda(params.poolState);

  return await program.methods
    .setMeteoraActive(params.isActive)
    .accounts({
      forecaster: params.forecaster,
      poolState: params.poolState,
      meteoraState,
    })
    .instruction();
}
