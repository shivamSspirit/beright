/**
 * Meteora Dynamic Vault Configuration
 *
 * Production-ready vault addresses and configuration.
 * The SDK derives vault PDAs from token mints automatically.
 *
 * @see https://docs.meteora.ag/dynamic-vaults
 * @see https://github.com/MeteoraAg/vault-sdk
 */

import { PublicKey } from '@solana/web3.js';
import type { VaultToken, Network } from '../types';

// ============================================================================
// Program IDs
// ============================================================================

/**
 * Meteora Dynamic Vault Program ID (Mainnet)
 * @see https://solscan.io/account/24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi
 */
export const METEORA_VAULT_PROGRAM_ID = new PublicKey(
  '24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi'
);

/**
 * Meteora Affiliate Program ID
 * Used for partner integrations and fee sharing
 */
export const METEORA_AFFILIATE_PROGRAM_ID = new PublicKey(
  'GacY9YuN16HNRTy7ZWwULPccwvfFSBeNLuAQP7y38Du3'
);

/**
 * Vault Base Key for PDA derivation
 */
export const VAULT_BASE_KEY = new PublicKey(
  'HWzXGcGHy4tcpYfaRDCyLNzXqBTv3E6BttpCH2vJxArv'
);

/**
 * BeRight Affiliate ID for fee sharing
 * TODO: Create BeRight affiliate account on Meteora
 */
export const BERIGHT_AFFILIATE_ID: PublicKey | undefined = undefined;

// ============================================================================
// Token Mints (Production Addresses)
// ============================================================================

/**
 * Official Solana token mints
 */
export const TOKEN_MINTS: Record<Network, Record<VaultToken, PublicKey>> = {
  'mainnet-beta': {
    USDC: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    SOL: new PublicKey('So11111111111111111111111111111111111111112'),
    USDT: new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'),
  },
  devnet: {
    // Devnet token mints for testing
    USDC: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
    SOL: new PublicKey('So11111111111111111111111111111111111111112'),
    USDT: new PublicKey('EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS'),
  },
};

// ============================================================================
// Token Configuration
// ============================================================================

/**
 * Token decimals
 */
export const TOKEN_DECIMALS: Record<VaultToken, number> = {
  USDC: 6,
  SOL: 9,
  USDT: 6,
};

/**
 * Minimum deposit amounts (in base units)
 * Set conservatively to avoid dust deposits
 */
export const MIN_DEPOSITS: Record<VaultToken, bigint> = {
  USDC: 1_000000n,      // 1 USDC
  SOL: 10_000000n,      // 0.01 SOL
  USDT: 1_000000n,      // 1 USDT
};

/**
 * Maximum deposit amounts per transaction (in base units)
 * Prevents large single-transaction exposure
 */
export const MAX_DEPOSITS: Record<VaultToken, bigint> = {
  USDC: 1_000_000_000000n,  // 1M USDC
  SOL: 10_000_000000000n,   // 10K SOL
  USDT: 1_000_000_000000n,  // 1M USDT
};

// ============================================================================
// Strategy Protocols (Lending sources)
// ============================================================================

/**
 * Lending protocols Meteora vaults allocate to
 */
export const LENDING_PROTOCOLS = {
  solend: new PublicKey('So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo'),
  marginfi: new PublicKey('MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA'),
  kamino: new PublicKey('KLend2g3cP87ber41iEr6YYunQSUiQcHRNfQ8zqvMN1'),
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get token mint for a vault token on a network
 */
export function getTokenMint(
  token: VaultToken,
  network: Network = 'mainnet-beta'
): PublicKey {
  return TOKEN_MINTS[network][token];
}

/**
 * Get token decimals
 */
export function getTokenDecimals(token: VaultToken): number {
  return TOKEN_DECIMALS[token];
}

/**
 * Check if a token is supported
 */
export function isTokenSupported(token: string): token is VaultToken {
  return ['USDC', 'SOL', 'USDT'].includes(token);
}

/**
 * Get all supported tokens for a network
 */
export function getSupportedTokens(network: Network = 'mainnet-beta'): VaultToken[] {
  return Object.keys(TOKEN_MINTS[network]) as VaultToken[];
}

/**
 * Convert human-readable amount to base units
 */
export function toBaseUnits(amount: number, token: VaultToken): bigint {
  const decimals = TOKEN_DECIMALS[token];
  return BigInt(Math.floor(amount * 10 ** decimals));
}

/**
 * Convert base units to human-readable amount
 */
export function fromBaseUnits(amount: bigint, token: VaultToken): number {
  const decimals = TOKEN_DECIMALS[token];
  return Number(amount) / 10 ** decimals;
}

/**
 * Format amount for display
 */
export function formatAmount(amount: bigint, token: VaultToken, precision = 2): string {
  const value = fromBaseUnits(amount, token);
  return `${value.toFixed(precision)} ${token}`;
}

/**
 * Validate deposit amount
 */
export function validateDepositAmount(
  amount: bigint,
  token: VaultToken
): { valid: boolean; error?: string } {
  const min = MIN_DEPOSITS[token];
  const max = MAX_DEPOSITS[token];

  if (amount < min) {
    return {
      valid: false,
      error: `Minimum deposit is ${formatAmount(min, token)}`,
    };
  }

  if (amount > max) {
    return {
      valid: false,
      error: `Maximum deposit per transaction is ${formatAmount(max, token)}`,
    };
  }

  return { valid: true };
}
