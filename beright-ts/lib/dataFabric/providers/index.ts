/**
 * Data Fabric Providers Registry
 *
 * Central registry for all platform data providers.
 *
 * @author BeRight Protocol
 */

import { DataPlatform } from '../../data/types';
import { DataFabricProvider } from '../types';

import { polymarketProvider } from './polymarket';
import { kalshiProvider } from './kalshi';
import { manifoldProvider } from './manifold';
import { jupiterProvider } from './jupiter';

// =============================================================================
// PROVIDER REGISTRY
// =============================================================================

/**
 * All available providers
 */
export const providers: Record<DataPlatform, DataFabricProvider | null> = {
  polymarket: polymarketProvider,
  kalshi: kalshiProvider,
  manifold: manifoldProvider,
  jupiter: jupiterProvider,  // Aggregates Polymarket + Kalshi on Solana
  // Not yet implemented - will be added
  limitless: null,
  metaculus: null,
  prophetx: null,
  novig: null,
  sxbet: null,
  myriad: null,
  baozi: null,
  probable: null,
};

/**
 * Get provider by platform name
 */
export function getProvider(platform: DataPlatform): DataFabricProvider | null {
  return providers[platform] || null;
}

/**
 * Get all active providers
 */
export function getActiveProviders(): DataFabricProvider[] {
  return Object.values(providers).filter((p): p is DataFabricProvider => p !== null);
}

/**
 * Get list of supported platforms (those with providers)
 */
export function getSupportedPlatforms(): DataPlatform[] {
  return Object.entries(providers)
    .filter(([_, provider]) => provider !== null)
    .map(([platform]) => platform as DataPlatform);
}

/**
 * Check health of all providers
 */
export async function checkAllProvidersHealth(): Promise<Record<DataPlatform, boolean>> {
  const results: Record<string, boolean> = {};
  const activeProviders = getActiveProviders();

  const checks = await Promise.allSettled(
    activeProviders.map(async (provider) => ({
      platform: provider.name,
      healthy: await provider.isHealthy(),
    }))
  );

  for (const check of checks) {
    if (check.status === 'fulfilled') {
      results[check.value.platform] = check.value.healthy;
    } else {
      // If health check throws, consider unhealthy
      // We need to find which provider this was for
    }
  }

  // Mark unsupported platforms as false
  for (const platform of Object.keys(providers)) {
    if (!(platform in results)) {
      results[platform] = false;
    }
  }

  return results as Record<DataPlatform, boolean>;
}

// Export individual providers
export { polymarketProvider } from './polymarket';
export { kalshiProvider } from './kalshi';
export { manifoldProvider } from './manifold';
export { jupiterProvider } from './jupiter';
