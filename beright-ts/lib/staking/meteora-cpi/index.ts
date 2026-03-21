// Meteora Vault CPI Client for BeRight Staking Pools
//
// This module provides a TypeScript client for interacting with the
// on-chain Meteora vault integration in the staking pool program.
//
// Usage:
//   import { MeteoraVaultCPIClient, createMeteoraVaultCPIClient } from './meteora-cpi';
//
// Example:
//   const client = createMeteoraVaultCPIClient(connection, wallet, stakingPoolProgram);
//   await client.initializeMeteoraVault(poolState, vaultAccounts, 5000, new BN(1_000_000));
//   await client.depositToMeteora(poolState, vaultAccounts, new BN(1_000_000_000));

export * from "./types";
export * from "./instructions";
export * from "./client";

export { MeteoraVaultCPIClient, createMeteoraVaultCPIClient } from "./client";
