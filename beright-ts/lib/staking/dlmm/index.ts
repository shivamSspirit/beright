// DLMM Position Client for BeRight Staking Pools
//
// This module provides a TypeScript client for managing concentrated
// liquidity positions on DLMM (Meteora) through the staking pool program.
//
// Usage:
//   import { DlmmPositionClient, createDlmmPositionClient } from './dlmm';
//
// Example:
//   const client = createDlmmPositionClient(connection, wallet, stakingPoolProgram);
//   await client.initializeDlmmConfig(poolState, { maxPositions: 5 });
//   await client.createPosition(poolState, 0, dlmmAccounts, {
//     lowerBinId: -10,
//     upperBinId: 10,
//     amountX: new BN(1_000_000),
//     amountY: new BN(1_000_000),
//   });

export * from "./types";
export * from "./client";

export { DlmmPositionClient, createDlmmPositionClient } from "./client";
