/**
 * BeRight On-Chain Pricing Utilities
 *
 * Fetch real-time SOL price for cost estimation
 */

export interface SolPrice {
  usd: number;
  lastUpdated: number;
}

let cachedPrice: SolPrice | null = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch SOL price from CoinGecko (free API, no key required)
 */
export async function fetchSolPrice(): Promise<number> {
  try {
    // Check cache
    if (cachedPrice && Date.now() - cachedPrice.lastUpdated < CACHE_DURATION_MS) {
      return cachedPrice.usd;
    }

    // Fetch from CoinGecko
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const price = data.solana?.usd;

    if (typeof price !== 'number') {
      throw new Error('Invalid price data from CoinGecko');
    }

    // Update cache
    cachedPrice = {
      usd: price,
      lastUpdated: Date.now(),
    };

    return price;
  } catch (error: any) {
    console.warn('Failed to fetch SOL price:', error.message);
    // Fallback to reasonable estimate
    return 150;
  }
}

/**
 * Get cached SOL price (fast, may be stale)
 */
export function getCachedSolPrice(): number {
  return cachedPrice?.usd || 150;
}

/**
 * Clear price cache (for testing)
 */
export function clearPriceCache(): void {
  cachedPrice = null;
}
