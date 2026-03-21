// BeRight Staking Pool Integrations
//
// This module exports clients for various DeFi integrations
// with the BeRight staking pool program.

import { PublicKey } from '@solana/web3.js';

// Staking Pool Program ID
export const STAKING_POOL_PROGRAM_ID = new PublicKey(
  'Fkb7q8pbMa4Wko4u1DYZMXBrXvq8ECFnSqze2TYMm4pM'
);

// Network-specific configurations
export const STAKING_POOL_CONFIG = {
  devnet: {
    programId: STAKING_POOL_PROGRAM_ID,
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  },
  mainnet: {
    programId: STAKING_POOL_PROGRAM_ID, // Same ID for mainnet deployment
    rpcUrl: process.env.SOLANA_MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com',
  },
};

export * from "./meteora-cpi";
export * from "./dlmm";
export * from "./drift";
