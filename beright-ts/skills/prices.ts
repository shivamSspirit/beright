/**
 * Multi-Oracle Price Resolution Engine for BeRight Protocol
 * Fetches real prices from Pyth Hermes, Jupiter V6, and DeFi Llama
 * Returns median price with confidence scoring
 */

import { SOLANA, TOKENS } from '../config/platforms';

interface PriceResult {
  symbol: string;
  price: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  sources: PriceSource[];
  timestamp: string;
}

interface PriceSource {
  name: string;
  price: number;
  success: boolean;
}

// Pyth price feed IDs (mainnet)
const PYTH_FEED_IDS: Record<string, string> = {
  SOL: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  BTC: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  ETH: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  USDC: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
  BONK: '0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419',
  JUP: '0x0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996',
  WIF: '0x4ca4beeca86f0d164160323817a4e42b10010a724c2217c6571f53d9e78e51fe',
  PYTH: '0x0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06ed92a0c8',
};

// Token mint addresses for DeFi Llama
const TOKEN_MINTS: Record<string, string> = {
  SOL: TOKENS.SOL,
  USDC: TOKENS.USDC,
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  PYTH: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
};

// Simple in-memory cache (30-second TTL)
const priceCache: Map<string, { result: PriceResult; expiry: number }> = new Map();
const CACHE_TTL = 30_000;

/**
 * Fetch price from Pyth Hermes (free, no auth)
 */
async function fetchPyth(symbol: string): Promise<number | null> {
  const feedId = PYTH_FEED_IDS[symbol.toUpperCase()];
  if (!feedId) return null;

  try {
    const url = `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${feedId}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;

    const data = await response.json() as any;
    const parsed = data.parsed?.[0];
    if (!parsed?.price) return null;

    const price = parseFloat(parsed.price.price);
    const expo = parsed.price.expo;
    return price * Math.pow(10, expo);
  } catch {
    return null;
  }
}

/**
 * Fetch price from Jupiter lite API (free, no auth)
 * Gets the price by quoting a swap of 1 USDC -> token
 */
async function fetchJupiter(symbol: string): Promise<number | null> {
  const upperSymbol = symbol.toUpperCase();
  if (upperSymbol === 'USDC') return 1.0;

  const mint = TOKEN_MINTS[upperSymbol];
  if (!mint) return null;

  try {
    // Quote: how much of this token do I get for $1 USDC?
    const amount = 1_000_000; // 1 USDC (6 decimals)
    const url = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${TOKENS.USDC}&outputMint=${mint}&amount=${amount}&slippageBps=50`;

    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;

    const data = await response.json() as any;
    const outAmount = parseFloat(data.outAmount);

    // Get token decimals from the route
    const decimals = getTokenDecimals(upperSymbol);
    const tokensReceived = outAmount / Math.pow(10, decimals);

    // Price = 1 / tokensReceived (price per token in USD)
    return tokensReceived > 0 ? 1 / tokensReceived : null;
  } catch {
    return null;
  }
}

/**
 * Fetch price from DeFi Llama (free, no auth, no key)
 */
async function fetchDefiLlama(symbol: string): Promise<number | null> {
  const upperSymbol = symbol.toUpperCase();
  if (upperSymbol === 'USDC') return 1.0;

  const mint = TOKEN_MINTS[upperSymbol];
  if (!mint) return null;

  try {
    const url = `https://coins.llama.fi/prices/current/solana:${mint}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;

    const data = await response.json() as any;
    const coin = data.coins?.[`solana:${mint}`];
    return coin?.price ?? null;
  } catch {
    return null;
  }
}

/**
 * Get token decimals
 */
function getTokenDecimals(symbol: string): number {
  const decimals: Record<string, number> = {
    SOL: 9,
    USDC: 6,
    USDT: 6,
    BONK: 5,
    JUP: 6,
    WIF: 6,
    PYTH: 6,
    BTC: 8,
    ETH: 8,
  };
  return decimals[symbol.toUpperCase()] ?? 6;
}

/**
 * Calculate median of an array of numbers
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Get price for a token from multiple oracles
 * Returns median price with confidence based on source agreement
 */
export async function getPrice(symbol: string): Promise<PriceResult> {
  const upperSymbol = symbol.toUpperCase();

  // Check cache first
  const cached = priceCache.get(upperSymbol);
  if (cached && cached.expiry > Date.now()) {
    return cached.result;
  }

  // Fetch from all three sources in parallel
  const [pythPrice, jupiterPrice, llamaPrice] = await Promise.all([
    fetchPyth(upperSymbol),
    fetchJupiter(upperSymbol),
    fetchDefiLlama(upperSymbol),
  ]);

  const sources: PriceSource[] = [
    { name: 'pyth', price: pythPrice ?? 0, success: pythPrice !== null },
    { name: 'jupiter', price: jupiterPrice ?? 0, success: jupiterPrice !== null },
    { name: 'defillama', price: llamaPrice ?? 0, success: llamaPrice !== null },
  ];

  const validPrices = sources.filter(s => s.success).map(s => s.price);
  const successCount = validPrices.length;

  // Determine confidence
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  if (successCount >= 3) {
    confidence = 'HIGH';
  } else if (successCount >= 2) {
    confidence = 'MEDIUM';
  } else {
    confidence = 'LOW';
  }

  // Use median for outlier resistance
  const price = successCount > 0 ? median(validPrices) : 0;

  const result: PriceResult = {
    symbol: upperSymbol,
    price,
    confidence,
    sources,
    timestamp: new Date().toISOString(),
  };

  // Cache the result
  priceCache.set(upperSymbol, { result, expiry: Date.now() + CACHE_TTL });

  return result;
}

/**
 * Get prices for multiple tokens at once
 */
export async function getPrices(symbols: string[]): Promise<Map<string, PriceResult>> {
  const results = await Promise.all(symbols.map(s => getPrice(s)));
  const map = new Map<string, PriceResult>();
  for (let i = 0; i < symbols.length; i++) {
    map.set(symbols[i].toUpperCase(), results[i]);
  }
  return map;
}

/**
 * Get SOL price specifically (commonly needed)
 */
export async function getSolPrice(): Promise<number> {
  const result = await getPrice('SOL');
  return result.price;
}

// CLI interface
if (process.argv[1]?.endsWith('prices.ts')) {
  const symbol = process.argv[2] || 'SOL';
  (async () => {
    console.log(`Fetching price for ${symbol.toUpperCase()}...`);
    const result = await getPrice(symbol);
    console.log(`\nPrice: $${result.price.toFixed(4)}`);
    console.log(`Confidence: ${result.confidence}`);
    console.log(`Sources:`);
    for (const source of result.sources) {
      console.log(`  ${source.name}: ${source.success ? `$${source.price.toFixed(4)}` : 'FAILED'}`);
    }
  })();
}
