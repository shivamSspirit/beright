/**
 * Meteora Dynamic Vault Integration
 *
 * Production-ready integration with Meteora vaults for yield generation.
 *
 * @see https://docs.meteora.ag/dynamic-vaults
 * @see https://github.com/MeteoraAg/vault-sdk
 */

// Client
export {
  MeteoraVaultClient,
  type VaultMetrics,
  type StrategyInfo,
  type MeteoraClientConfig,
} from './client';

// Configuration
export {
  // Program IDs
  METEORA_VAULT_PROGRAM_ID,
  METEORA_AFFILIATE_PROGRAM_ID,
  VAULT_BASE_KEY,
  BERIGHT_AFFILIATE_ID,

  // Token configuration
  TOKEN_MINTS,
  TOKEN_DECIMALS,
  MIN_DEPOSITS,
  MAX_DEPOSITS,
  LENDING_PROTOCOLS,

  // Helper functions
  getTokenMint,
  getTokenDecimals,
  isTokenSupported,
  getSupportedTokens,
  toBaseUnits,
  fromBaseUnits,
  formatAmount,
  validateDepositAmount,
} from './vaults';

// APY Fetching
export {
  fetchVaultAPY,
  fetchAllVaultAPYs,
  getCachedAPY,
  clearAPYCache,
  calculateAPYFromPriceChange,
  type MeteoraVaultAPY,
} from './apy';

// Affiliate Program
export {
  BERIGHT_AFFILIATE_CONFIG,
  isAffiliateConfigured,
  getAffiliateId,
  recordAffiliateFee,
  getAffiliateStats,
  getPartnership,
  updatePartnership,
  verifyAffiliateSetup,
  AFFILIATE_REGISTRATION_GUIDE,
  type AffiliateConfig,
  type AffiliateInfo,
  type AffiliateStats,
} from './affiliate';
