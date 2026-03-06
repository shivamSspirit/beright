/**
 * Execution Engine Module
 *
 * Smart order routing, position management, and multi-platform execution.
 *
 * @author BeRight Protocol
 * @version 3.0.0 - Bloomberg Terminal Architecture
 */

// =============================================================================
// RE-EXPORTS
// =============================================================================

// Types
export * from './types';

// Connectors
export {
  getConnector,
  getAllConnectors,
  getConnectedConnectors,
  connectAll,
  disconnectAll,
  getConnectorStatus,
  getPolymarketConnector,
  getKalshiConnector,
  getManifoldConnector,
} from './connectors';

// Router
export { SmartOrderRouter, getSmartOrderRouter } from './router';

// Positions
export { PositionManager, getPositionManager } from './positions';

// =============================================================================
// EXECUTION ENGINE CLASS
// =============================================================================

import {
  OrderRequest,
  ExecutionResult,
  ExecutionQuote,
  RoutingStrategy,
  RoutingDecision,
  Position,
  PositionSummary,
  ConnectorBalance,
} from './types';
import { Platform } from '../dataFabric/types';
import { connectAll, disconnectAll, getConnectorStatus, getConnector } from './connectors';
import { getSmartOrderRouter } from './router';
import { getPositionManager } from './positions';

/**
 * Main Execution Engine
 *
 * Unified interface for all trading operations.
 */
export class ExecutionEngine {
  private initialized = false;

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  /**
   * Initialize the execution engine
   */
  async initialize(): Promise<{
    connected: Platform[];
    failed: { platform: Platform; error: string }[];
  }> {
    if (this.initialized) {
      return { connected: [], failed: [] };
    }

    console.log('[Execution] Initializing execution engine...');

    const result = await connectAll();

    console.log(`[Execution] Connected to ${result.connected.length} platforms`);
    if (result.failed.length > 0) {
      console.warn(`[Execution] Failed to connect to ${result.failed.length} platforms`);
    }

    this.initialized = true;
    return result;
  }

  /**
   * Shutdown the execution engine
   */
  async shutdown(): Promise<void> {
    console.log('[Execution] Shutting down...');
    await disconnectAll();
    this.initialized = false;
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      connectors: getConnectorStatus(),
    };
  }

  // ==========================================================================
  // QUOTING
  // ==========================================================================

  /**
   * Get execution quote for an order
   */
  async getQuote(
    marketId: string,
    side: 'YES' | 'NO',
    size: number
  ): Promise<ExecutionQuote | null> {
    const router = getSmartOrderRouter();
    return router.getBestQuote(marketId, side, size);
  }

  /**
   * Get quotes from all venues
   */
  async getQuotes(
    marketId: string,
    side: 'YES' | 'NO',
    size: number
  ): Promise<ExecutionQuote[]> {
    const router = getSmartOrderRouter();
    return router.getQuotes(marketId, side, size);
  }

  /**
   * Get routing decision
   */
  async getRouting(
    marketId: string,
    side: 'YES' | 'NO',
    size: number,
    strategy: RoutingStrategy = 'BEST_PRICE'
  ): Promise<RoutingDecision> {
    const router = getSmartOrderRouter();
    return router.route(marketId, side, size, strategy);
  }

  // ==========================================================================
  // ORDER EXECUTION
  // ==========================================================================

  /**
   * Execute an order
   */
  async execute(
    request: OrderRequest,
    strategy: RoutingStrategy = 'BEST_PRICE'
  ): Promise<ExecutionResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const router = getSmartOrderRouter();
    return router.execute(request, strategy);
  }

  /**
   * Execute with automatic retry
   */
  async executeWithRetry(
    request: OrderRequest,
    strategy: RoutingStrategy = 'BEST_PRICE',
    maxRetries: number = 2
  ): Promise<{
    results: ExecutionResult[];
    totalFilled: number;
    totalCost: number;
    avgPrice: number;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    const router = getSmartOrderRouter();
    return router.executeWithRetry(request, strategy, maxRetries);
  }

  // ==========================================================================
  // POSITIONS
  // ==========================================================================

  /**
   * Get all positions
   */
  async getPositions(): Promise<Position[]> {
    const manager = getPositionManager();
    return manager.getAllPositions();
  }

  /**
   * Get open positions
   */
  async getOpenPositions(): Promise<Position[]> {
    const manager = getPositionManager();
    return manager.getOpenPositions();
  }

  /**
   * Get position summary
   */
  async getPositionSummary(): Promise<PositionSummary> {
    const manager = getPositionManager();
    return manager.getSummary();
  }

  /**
   * Get exposure analysis
   */
  async getExposure(): Promise<{
    totalAtRisk: number;
    totalMaxGain: number;
    riskRewardRatio: number;
    exposureByPlatform: Record<Platform, number>;
  }> {
    const manager = getPositionManager();
    return manager.getTotalExposure();
  }

  /**
   * Get top winners
   */
  async getTopWinners(limit: number = 5): Promise<Position[]> {
    const manager = getPositionManager();
    return manager.getTopWinners(limit);
  }

  /**
   * Get top losers
   */
  async getTopLosers(limit: number = 5): Promise<Position[]> {
    const manager = getPositionManager();
    return manager.getTopLosers(limit);
  }

  // ==========================================================================
  // BALANCES
  // ==========================================================================

  /**
   * Get balances across all platforms
   */
  async getBalances(): Promise<ConnectorBalance[]> {
    const balances: ConnectorBalance[] = [];
    const status = getConnectorStatus();

    for (const connector of status) {
      if (connector.connected) {
        try {
          const c = getConnector(connector.platform);
          if (c) {
            const balance = await c.getBalance();
            balances.push(balance);
          }
        } catch (error) {
          console.error(`[Execution] Failed to get balance from ${connector.platform}:`, error);
        }
      }
    }

    return balances;
  }

  /**
   * Get total balance (USD equivalent)
   */
  async getTotalBalance(): Promise<{
    total: number;
    available: number;
    locked: number;
    byPlatform: Record<Platform, number>;
  }> {
    const balances = await this.getBalances();

    let total = 0;
    let available = 0;
    let locked = 0;
    const byPlatform: Record<Platform, number> = {} as any;

    for (const balance of balances) {
      // Convert to USD (Manifold MANA is play money, so we count it separately)
      const usdValue = balance.currency === 'MANA' ? 0 : balance.total;

      total += usdValue;
      available += balance.currency === 'MANA' ? 0 : balance.available;
      locked += balance.currency === 'MANA' ? 0 : balance.locked;
      byPlatform[balance.platform] = balance.total;
    }

    return { total, available, locked, byPlatform };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let executionEngine: ExecutionEngine | null = null;

export function getExecutionEngine(): ExecutionEngine {
  if (!executionEngine) {
    executionEngine = new ExecutionEngine();
  }
  return executionEngine;
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default getExecutionEngine;
