/**
 * Meteora APY Fetcher
 *
 * Fetches real-time APY data from Meteora's API endpoints.
 */

import type { VaultToken } from '../types';
import { TOKEN_MINTS } from './vaults';

// ============================================================================
// Types
// ============================================================================

export interface MeteoraVaultAPY {
  token: VaultToken;
  tokenMint: string;
  apy: number;              // Annualized percentage (0.08 = 8%)
  apy7d: number;            // 7-day APY
  apy30d: number;           // 30-day APY
  tvl: number;              // Total value locked in USD
  virtualPrice: number;
  lastUpdated: Date;
}

export interface MeteoraAPIResponse {
  data?: {
    apy?: number;
    apy_7d?: number;
    apy_30d?: number;
    tvl?: number;
    virtual_price?: number;
  };
  error?: string;
}

// ============================================================================
// API Configuration
// ============================================================================

// Meteora API endpoints (unofficial, based on their app)
const METEORA_API_BASE = 'https://app.meteora.ag/api';
const METEORA_VAULT_API = 'https://merv2-api.meteora.ag';

// Fallback APY estimates based on historical data
const FALLBACK_APY: Record<VaultToken, number> = {
  USDC: 0.075, // 7.5%
  USDT: 0.07,  // 7%
  SOL: 0.055,  // 5.5%
};

// Cache configuration
const APY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// APY Fetcher
// ============================================================================

// In-memory cache
const apyCache: Map<VaultToken, { data: MeteoraVaultAPY; timestamp: number }> = new Map();

/**
 * Fetch APY for a specific vault
 */
export async function fetchVaultAPY(token: VaultToken): Promise<MeteoraVaultAPY> {
  // Check cache first
  const cached = apyCache.get(token);
  if (cached && Date.now() - cached.timestamp < APY_CACHE_TTL_MS) {
    return cached.data;
  }

  const tokenMint = TOKEN_MINTS['mainnet-beta'][token].toBase58();

  try {
    // Try primary API
    const response = await fetchWithTimeout(
      `${METEORA_VAULT_API}/vault_info?token_mint=${tokenMint}`,
      5000
    );

    if (response.ok) {
      const data: MeteoraAPIResponse = await response.json();

      if (data.data) {
        const result: MeteoraVaultAPY = {
          token,
          tokenMint,
          apy: data.data.apy || FALLBACK_APY[token],
          apy7d: data.data.apy_7d || data.data.apy || FALLBACK_APY[token],
          apy30d: data.data.apy_30d || data.data.apy || FALLBACK_APY[token],
          tvl: data.data.tvl || 0,
          virtualPrice: data.data.virtual_price || 1,
          lastUpdated: new Date(),
        };

        // Update cache
        apyCache.set(token, { data: result, timestamp: Date.now() });
        return result;
      }
    }
  } catch (error) {
    console.warn(`Failed to fetch Meteora APY for ${token}:`, error);
  }

  // Try alternative endpoint
  try {
    const altResponse = await fetchWithTimeout(
      `${METEORA_API_BASE}/vaults/${tokenMint}`,
      5000
    );

    if (altResponse.ok) {
      const data = await altResponse.json();

      if (data) {
        const result: MeteoraVaultAPY = {
          token,
          tokenMint,
          apy: parseAPY(data.apy) || FALLBACK_APY[token],
          apy7d: parseAPY(data.apy_7d) || parseAPY(data.apy) || FALLBACK_APY[token],
          apy30d: parseAPY(data.apy_30d) || parseAPY(data.apy) || FALLBACK_APY[token],
          tvl: data.tvl || data.total_amount || 0,
          virtualPrice: data.virtual_price || 1,
          lastUpdated: new Date(),
        };

        apyCache.set(token, { data: result, timestamp: Date.now() });
        return result;
      }
    }
  } catch {
    // Ignore alternative endpoint errors
  }

  // Return fallback with cached or estimated values
  const fallbackResult: MeteoraVaultAPY = {
    token,
    tokenMint,
    apy: FALLBACK_APY[token],
    apy7d: FALLBACK_APY[token],
    apy30d: FALLBACK_APY[token],
    tvl: 0,
    virtualPrice: 1,
    lastUpdated: new Date(),
  };

  // Cache fallback for shorter time
  apyCache.set(token, { data: fallbackResult, timestamp: Date.now() - APY_CACHE_TTL_MS / 2 });

  return fallbackResult;
}

/**
 * Fetch APY for all supported vaults
 */
export async function fetchAllVaultAPYs(): Promise<Map<VaultToken, MeteoraVaultAPY>> {
  const tokens: VaultToken[] = ['USDC', 'SOL', 'USDT'];
  const results = new Map<VaultToken, MeteoraVaultAPY>();

  // Fetch in parallel
  const apyPromises = tokens.map(async (token) => {
    const apy = await fetchVaultAPY(token);
    return [token, apy] as [VaultToken, MeteoraVaultAPY];
  });

  const apyResults = await Promise.all(apyPromises);

  for (const [token, apy] of apyResults) {
    results.set(token, apy);
  }

  return results;
}

/**
 * Get cached APY (no network request)
 */
export function getCachedAPY(token: VaultToken): MeteoraVaultAPY | undefined {
  const cached = apyCache.get(token);
  return cached?.data;
}

/**
 * Clear APY cache
 */
export function clearAPYCache(): void {
  apyCache.clear();
}

/**
 * Calculate estimated APY from virtual price change
 */
export function calculateAPYFromPriceChange(
  startPrice: number,
  endPrice: number,
  days: number
): number {
  if (startPrice <= 0 || days <= 0) return 0;

  const priceChange = endPrice / startPrice - 1;
  const annualized = Math.pow(1 + priceChange, 365 / days) - 1;

  return annualized;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BeRight/1.0',
      },
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parse APY from various formats
 */
function parseAPY(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;

  if (typeof value === 'number') {
    // If > 1, assume it's a percentage (e.g., 7.5 = 7.5%)
    return value > 1 ? value / 100 : value;
  }

  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace('%', ''));
    if (!isNaN(parsed)) {
      return parsed > 1 ? parsed / 100 : parsed;
    }
  }

  return undefined;
}
