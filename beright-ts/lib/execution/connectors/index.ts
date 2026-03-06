/**
 * Trading Connectors Registry
 *
 * Centralized access to all trading platform connectors.
 *
 * @author BeRight Protocol
 */

import { TradingConnector } from '../types';
import { Platform } from '../../dataFabric/types';
import { getPolymarketConnector, PolymarketConnector } from './polymarket';
import { getKalshiConnector, KalshiConnector } from './kalshi';
import { getManifoldConnector, ManifoldConnector } from './manifold';
import { getDFlowConnector, DFlowConnector } from './dflow';

// =============================================================================
// CONNECTOR REGISTRY
// =============================================================================

const connectors: Map<Platform, TradingConnector> = new Map();

/**
 * Get connector for a platform
 */
export function getConnector(platform: Platform | 'dflow'): TradingConnector | null {
  // Lazy initialization
  if (!connectors.has(platform as Platform)) {
    switch (platform) {
      case 'polymarket':
        connectors.set(platform, getPolymarketConnector());
        break;
      case 'kalshi':
        connectors.set(platform, getKalshiConnector());
        break;
      case 'manifold':
        connectors.set(platform, getManifoldConnector());
        break;
      case 'dflow':
        // DFlow routes to Kalshi via Solana - separate execution venue
        connectors.set('kalshi', getDFlowConnector());
        return getDFlowConnector();
      // Metaculus doesn't support trading
      case 'metaculus':
        return null;
      default:
        return null;
    }
  }

  return connectors.get(platform as Platform) || null;
}

/**
 * Get all available connectors
 */
export function getAllConnectors(): TradingConnector[] {
  const platforms: Platform[] = ['polymarket', 'kalshi', 'manifold'];

  return platforms
    .map(p => getConnector(p))
    .filter((c): c is TradingConnector => c !== null);
}

/**
 * Get all connected connectors
 */
export function getConnectedConnectors(): TradingConnector[] {
  return getAllConnectors().filter(c => c.isConnected());
}

/**
 * Connect all connectors
 */
export async function connectAll(): Promise<{
  connected: Platform[];
  failed: { platform: Platform; error: string }[];
}> {
  const connected: Platform[] = [];
  const failed: { platform: Platform; error: string }[] = [];

  const connectorList = getAllConnectors();

  await Promise.all(
    connectorList.map(async connector => {
      try {
        await connector.connect();
        connected.push(connector.platform);
      } catch (error) {
        failed.push({
          platform: connector.platform,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    })
  );

  return { connected, failed };
}

/**
 * Disconnect all connectors
 */
export async function disconnectAll(): Promise<void> {
  const connectorList = getAllConnectors();

  await Promise.all(
    connectorList.map(async connector => {
      try {
        await connector.disconnect();
      } catch (error) {
        console.error(`Failed to disconnect ${connector.platform}:`, error);
      }
    })
  );
}

/**
 * Get connector status summary
 */
export function getConnectorStatus(): {
  platform: Platform;
  name: string;
  connected: boolean;
  fees: { maker: number; taker: number };
  limits: { min: number; max: number };
}[] {
  return getAllConnectors().map(connector => ({
    platform: connector.platform,
    name: connector.name,
    connected: connector.isConnected(),
    fees: connector.getFees(),
    limits: {
      min: connector.getMinOrderSize(),
      max: connector.getMaxOrderSize(),
    },
  }));
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

export { PolymarketConnector, getPolymarketConnector } from './polymarket';
export { KalshiConnector, getKalshiConnector } from './kalshi';
export { ManifoldConnector, getManifoldConnector } from './manifold';
export { DFlowConnector, getDFlowConnector } from './dflow';

export default {
  getConnector,
  getAllConnectors,
  getConnectedConnectors,
  connectAll,
  disconnectAll,
  getConnectorStatus,
};
