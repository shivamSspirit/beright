/**
 * RPC Cascade for BeRight Protocol
 * Smart routing across free Solana RPC providers
 * Auto-failover with usage tracking to stay within free tier limits
 */

import { Connection } from '@solana/web3.js';

interface RpcProvider {
  name: string;
  url: string;
  monthlyLimit: number;     // approximate call limit
  callsUsed: number;
  lastReset: number;        // timestamp of last monthly reset
  priority: number;         // lower = preferred
  isEnhanced: boolean;      // supports enhanced APIs (DAS, parsed tx)
  lastError: number | null; // timestamp of last error (for cooldown)
}

const COOLDOWN_MS = 60_000; // 1 min cooldown after error
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// Provider registry
const providers: RpcProvider[] = [
  {
    name: 'helius',
    url: process.env.HELIUS_RPC_MAINNET || `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY || 'none'}`,
    monthlyLimit: 1_000_000,
    callsUsed: 0,
    lastReset: Date.now(),
    priority: 1,
    isEnhanced: true,
    lastError: null,
  },
  {
    name: 'solana-public',
    url: 'https://api.mainnet-beta.solana.com',
    monthlyLimit: 500_000, // rate-limited: 40 req/10s
    callsUsed: 0,
    lastReset: Date.now(),
    priority: 3,
    isEnhanced: false,
    lastError: null,
  },
];

// Add dRPC if configured
if (process.env.DRPC_API_KEY) {
  providers.push({
    name: 'drpc',
    url: `https://lb.drpc.org/ogrpc?network=solana&dkey=${process.env.DRPC_API_KEY}`,
    monthlyLimit: 10_000_000,
    callsUsed: 0,
    lastReset: Date.now(),
    priority: 0, // highest priority (most generous free tier)
    isEnhanced: false,
    lastError: null,
  });
}

// Add Alchemy if configured
if (process.env.ALCHEMY_API_KEY) {
  providers.push({
    name: 'alchemy',
    url: `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    monthlyLimit: 30_000_000,
    callsUsed: 0,
    lastReset: Date.now(),
    priority: 2,
    isEnhanced: false,
    lastError: null,
  });
}

/**
 * Reset monthly counters if needed
 */
function resetIfNeeded(provider: RpcProvider): void {
  if (Date.now() - provider.lastReset > MONTH_MS) {
    provider.callsUsed = 0;
    provider.lastReset = Date.now();
  }
}

/**
 * Check if provider is available
 */
function isAvailable(provider: RpcProvider): boolean {
  resetIfNeeded(provider);

  // Over monthly limit?
  if (provider.callsUsed >= provider.monthlyLimit * 0.95) return false;

  // In cooldown from error?
  if (provider.lastError && Date.now() - provider.lastError < COOLDOWN_MS) return false;

  // URL not configured?
  if (provider.url.includes('none') || provider.url.includes('undefined')) return false;

  return true;
}

/**
 * Get the best available RPC connection
 * Priority: configured providers sorted by priority, filtered by availability
 */
export function getConnection(options?: { requireEnhanced?: boolean }): Connection {
  const available = providers
    .filter(p => isAvailable(p))
    .filter(p => !options?.requireEnhanced || p.isEnhanced)
    .sort((a, b) => a.priority - b.priority);

  if (available.length === 0) {
    // Absolute fallback: Solana public RPC
    return new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  }

  const chosen = available[0];
  chosen.callsUsed++;

  return new Connection(chosen.url, 'confirmed');
}

/**
 * Get a connection specifically for Helius enhanced APIs
 */
export function getHeliusConnection(): Connection | null {
  const helius = providers.find(p => p.name === 'helius');
  if (!helius || !isAvailable(helius)) return null;

  helius.callsUsed++;
  return new Connection(helius.url, 'confirmed');
}

/**
 * Report an error for a provider (triggers cooldown)
 */
export function reportError(providerName: string): void {
  const provider = providers.find(p => p.name === providerName);
  if (provider) {
    provider.lastError = Date.now();
  }
}

/**
 * Get usage stats for monitoring
 */
export function getRpcStats(): { name: string; used: number; limit: number; available: boolean }[] {
  return providers.map(p => {
    resetIfNeeded(p);
    return {
      name: p.name,
      used: p.callsUsed,
      limit: p.monthlyLimit,
      available: isAvailable(p),
    };
  });
}

/**
 * Execute an RPC call with automatic failover
 */
export async function withFailover<T>(
  fn: (connection: Connection) => Promise<T>,
  options?: { requireEnhanced?: boolean }
): Promise<T> {
  const available = providers
    .filter(p => isAvailable(p))
    .filter(p => !options?.requireEnhanced || p.isEnhanced)
    .sort((a, b) => a.priority - b.priority);

  for (const provider of available) {
    try {
      provider.callsUsed++;
      const connection = new Connection(provider.url, 'confirmed');
      return await fn(connection);
    } catch (error) {
      provider.lastError = Date.now();
      console.warn(`RPC ${provider.name} failed, trying next...`);
    }
  }

  // Final fallback
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  return fn(connection);
}
