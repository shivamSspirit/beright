/**
 * Platform Connectors Index
 *
 * Exports all platform connectors and provides a unified interface
 * for accessing connector functionality.
 */

// Import connectors (this registers them automatically)
import metaculusConnector from './metaculus';
import manifoldConnector from './manifold';
import polymarketConnector from './polymarket';

// Export base functionality
export {
  BasePlatformConnector,
  registerConnector,
  getConnector,
  getAllConnectors,
  hasConnector,
} from './base';

// Export individual connectors
export { metaculusConnector, manifoldConnector, polymarketConnector };

// Re-export from base for convenience
export type { PlatformConnector } from '../types';

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

import { getConnector, hasConnector } from './base';
import type { ExternalPlatform, ImportedStats, OwnershipProof, VerificationResult } from '../types';

/**
 * Fetch stats from a platform.
 */
export async function fetchPlatformStats(
  platform: ExternalPlatform,
  userId: string
): Promise<ImportedStats> {
  const connector = getConnector(platform);
  if (!connector) {
    throw new Error(`No connector available for platform: ${platform}`);
  }
  return connector.fetchStats(userId);
}

/**
 * Verify ownership on a platform.
 */
export async function verifyPlatformOwnership(
  platform: ExternalPlatform,
  userId: string,
  proof: OwnershipProof
): Promise<VerificationResult> {
  const connector = getConnector(platform);
  if (!connector) {
    throw new Error(`No connector available for platform: ${platform}`);
  }
  return connector.verifyOwnership(userId, proof);
}

/**
 * Check if user exists on a platform.
 */
export async function userExistsOnPlatform(
  platform: ExternalPlatform,
  userId: string
): Promise<boolean> {
  const connector = getConnector(platform);
  if (!connector) {
    return false;
  }
  return connector.userExists(userId);
}

/**
 * Check if a platform has a connector available.
 */
export function isPlatformSupported(platform: ExternalPlatform): boolean {
  return hasConnector(platform);
}

/**
 * Get list of supported platforms.
 */
export function getSupportedPlatforms(): ExternalPlatform[] {
  return ['metaculus', 'manifold', 'polymarket'];
}
