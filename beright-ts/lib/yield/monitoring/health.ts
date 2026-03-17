/**
 * Vault Health Monitoring
 *
 * Monitors vault health, triggers alerts, and manages rebalancing.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/client';
import { MeteoraVaultClient } from '../meteora/client';
import type { VaultToken, YieldProtocol } from '../types';
import type { VaultHealthMetrics, RebalanceEvent } from '../tracking/types';

// ============================================================================
// Types
// ============================================================================

export interface HealthCheckResult {
  healthy: boolean;
  status: 'healthy' | 'degraded' | 'critical';
  metrics: VaultHealthMetrics;
  alerts: HealthAlert[];
}

export interface HealthAlert {
  severity: 'info' | 'warning' | 'critical';
  type: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface MonitoringConfig {
  // Thresholds
  minWithdrawablePercent: number;  // Min % of TVL that should be withdrawable
  maxSingleStrategyPercent: number; // Max % in single lending strategy
  maxStalenessSeconds: number;      // Max age of vault data
  minAPYThreshold: number;          // Alert if APY drops below this

  // Rebalance triggers
  rebalanceThresholdBps: number;    // Trigger rebalance when off by this %

  // Alerting
  alertWebhookUrl?: string;
  alertEmail?: string;
}

export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  minWithdrawablePercent: 10,       // At least 10% should be withdrawable
  maxSingleStrategyPercent: 70,     // No more than 70% in single strategy
  maxStalenessSeconds: 300,         // 5 minutes max
  minAPYThreshold: 0.02,            // Alert if APY < 2%
  rebalanceThresholdBps: 500,       // 5% drift triggers rebalance
};

// ============================================================================
// Health Monitor
// ============================================================================

/**
 * Vault Health Monitor
 */
export class VaultHealthMonitor {
  private connection: Connection;
  private config: MonitoringConfig;
  private clients: Map<VaultToken, MeteoraVaultClient> = new Map();
  private lastCheck: Map<string, VaultHealthMetrics> = new Map();

  constructor(connection: Connection, config: Partial<MonitoringConfig> = {}) {
    this.connection = connection;
    this.config = { ...DEFAULT_MONITORING_CONFIG, ...config };
  }

  /**
   * Initialize monitoring for specified tokens
   */
  async initialize(tokens: VaultToken[] = ['USDC', 'SOL', 'USDT']): Promise<void> {
    for (const token of tokens) {
      try {
        const client = await MeteoraVaultClient.createAndConnect(
          this.connection,
          token,
          'mainnet-beta'
        );
        this.clients.set(token, client);
      } catch (error) {
        console.warn(`Failed to initialize ${token} vault monitor:`, error);
      }
    }
  }

  /**
   * Run health check for a specific token
   */
  async checkHealth(token: VaultToken): Promise<HealthCheckResult> {
    const client = this.clients.get(token);
    if (!client) {
      return {
        healthy: false,
        status: 'critical',
        metrics: this.createEmptyMetrics(token),
        alerts: [{ severity: 'critical', type: 'client_unavailable', message: `No client for ${token}` }],
      };
    }

    const alerts: HealthAlert[] = [];
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';

    try {
      // Get vault metrics
      const metrics = await client.getMetrics();
      const apy = await client.getAPY();

      // Calculate health indicators
      const withdrawableAmount = metrics.withdrawableAmount;
      const totalTvl = metrics.totalDeposited;
      const utilizationRate = totalTvl > 0n
        ? 1 - (Number(withdrawableAmount) / Number(totalTvl))
        : 0;

      // Check withdrawable amount
      const withdrawablePercent = totalTvl > 0n
        ? (Number(withdrawableAmount) / Number(totalTvl)) * 100
        : 100;

      if (withdrawablePercent < this.config.minWithdrawablePercent) {
        alerts.push({
          severity: 'warning',
          type: 'low_liquidity',
          message: `Only ${withdrawablePercent.toFixed(1)}% of TVL is withdrawable`,
          data: { withdrawablePercent, threshold: this.config.minWithdrawablePercent },
        });
        status = 'degraded';
      }

      if (withdrawablePercent < this.config.minWithdrawablePercent / 2) {
        alerts.push({
          severity: 'critical',
          type: 'critical_liquidity',
          message: `Critical: Only ${withdrawablePercent.toFixed(1)}% of TVL is withdrawable`,
        });
        status = 'critical';
      }

      // Check strategy concentration
      let largestStrategyAllocation = 0;
      if (metrics.strategies.length > 0) {
        const totalAllocation = metrics.strategies.reduce(
          (sum, s) => sum + Number(s.allocation),
          0
        );
        const maxAllocation = Math.max(...metrics.strategies.map(s => Number(s.allocation)));
        largestStrategyAllocation = totalAllocation > 0
          ? (maxAllocation / totalAllocation) * 100
          : 0;

        if (largestStrategyAllocation > this.config.maxSingleStrategyPercent) {
          alerts.push({
            severity: 'warning',
            type: 'strategy_concentration',
            message: `${largestStrategyAllocation.toFixed(1)}% in single strategy`,
            data: { allocation: largestStrategyAllocation },
          });
          if (status === 'healthy') status = 'degraded';
        }
      }

      // Check APY
      if (apy < this.config.minAPYThreshold) {
        alerts.push({
          severity: 'info',
          type: 'low_apy',
          message: `APY is ${(apy * 100).toFixed(2)}%, below ${(this.config.minAPYThreshold * 100).toFixed(2)}% threshold`,
          data: { apy, threshold: this.config.minAPYThreshold },
        });
      }

      // Build health metrics
      const healthMetrics: VaultHealthMetrics = {
        id: `${token}-${Date.now()}`,
        token,
        protocol: 'meteora',
        status,
        withdrawable_amount: withdrawableAmount.toString(),
        total_tvl: totalTvl.toString(),
        utilization_rate: utilizationRate,
        largest_strategy_allocation: largestStrategyAllocation,
        strategy_count: metrics.strategies.length,
        staleness_seconds: 0,
        current_apy: apy,
        virtual_price: metrics.virtualPrice,
        price_change_24h: 0, // Calculated from snapshots
        alerts: alerts.map(a => a.message),
        checked_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      // Store metrics
      this.lastCheck.set(token, healthMetrics);
      await this.saveHealthMetrics(healthMetrics);

      return {
        healthy: status === 'healthy',
        status,
        metrics: healthMetrics,
        alerts,
      };
    } catch (error) {
      const errorAlert: HealthAlert = {
        severity: 'critical',
        type: 'check_failed',
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };

      return {
        healthy: false,
        status: 'critical',
        metrics: this.createEmptyMetrics(token),
        alerts: [errorAlert],
      };
    }
  }

  /**
   * Run health check for all monitored vaults
   */
  async checkAllHealth(): Promise<Map<VaultToken, HealthCheckResult>> {
    const results = new Map<VaultToken, HealthCheckResult>();

    for (const token of this.clients.keys()) {
      results.set(token, await this.checkHealth(token));
    }

    return results;
  }

  /**
   * Get last known health metrics
   */
  getLastMetrics(token: VaultToken): VaultHealthMetrics | undefined {
    return this.lastCheck.get(token);
  }

  /**
   * Check if rebalance is needed
   */
  async checkRebalanceNeeded(
    poolId: string,
    token: VaultToken,
    currentAllocations: { yieldBps: number; reserveBps: number; activeBps: number },
    targetAllocations: { yieldBps: number; reserveBps: number; activeBps: number }
  ): Promise<{ needed: boolean; reason?: string }> {
    const yieldDrift = Math.abs(currentAllocations.yieldBps - targetAllocations.yieldBps);
    const reserveDrift = Math.abs(currentAllocations.reserveBps - targetAllocations.reserveBps);
    const maxDrift = Math.max(yieldDrift, reserveDrift);

    if (maxDrift > this.config.rebalanceThresholdBps) {
      return {
        needed: true,
        reason: `Allocation drift of ${maxDrift}bps exceeds threshold of ${this.config.rebalanceThresholdBps}bps`,
      };
    }

    return { needed: false };
  }

  /**
   * Record rebalance event
   */
  async recordRebalance(event: Omit<RebalanceEvent, 'id' | 'created_at'>): Promise<void> {
    if (!isSupabaseConfigured) return;

    await supabaseAdmin
      .from('rebalance_events')
      .insert({
        ...event,
        actions: JSON.stringify(event.actions),
      });
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private createEmptyMetrics(token: VaultToken): VaultHealthMetrics {
    return {
      id: `${token}-empty`,
      token,
      protocol: 'meteora',
      status: 'critical',
      withdrawable_amount: '0',
      total_tvl: '0',
      utilization_rate: 0,
      largest_strategy_allocation: 0,
      strategy_count: 0,
      staleness_seconds: 9999,
      current_apy: 0,
      virtual_price: 1,
      price_change_24h: 0,
      alerts: ['Unable to fetch metrics'],
      checked_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
  }

  private async saveHealthMetrics(metrics: VaultHealthMetrics): Promise<void> {
    if (!isSupabaseConfigured) return;

    try {
      await supabaseAdmin
        .from('vault_health_metrics')
        .insert({
          token: metrics.token,
          protocol: metrics.protocol,
          status: metrics.status,
          withdrawable_amount: metrics.withdrawable_amount,
          total_tvl: metrics.total_tvl,
          utilization_rate: metrics.utilization_rate,
          largest_strategy_allocation: metrics.largest_strategy_allocation,
          strategy_count: metrics.strategy_count,
          staleness_seconds: metrics.staleness_seconds,
          current_apy: metrics.current_apy,
          virtual_price: metrics.virtual_price,
          price_change_24h: metrics.price_change_24h,
          alerts: metrics.alerts,
          checked_at: metrics.checked_at,
        });
    } catch (error) {
      console.error('Failed to save health metrics:', error);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let healthMonitor: VaultHealthMonitor | null = null;

/**
 * Get or create health monitor instance
 */
export function getHealthMonitor(connection: Connection): VaultHealthMonitor {
  if (!healthMonitor) {
    healthMonitor = new VaultHealthMonitor(connection);
  }
  return healthMonitor;
}

/**
 * Initialize and start health monitoring
 */
export async function startHealthMonitoring(
  connection: Connection,
  tokens: VaultToken[] = ['USDC'],
  intervalMs: number = 60000 // 1 minute default
): Promise<NodeJS.Timeout> {
  const monitor = getHealthMonitor(connection);
  await monitor.initialize(tokens);

  // Run initial check
  await monitor.checkAllHealth();

  // Start interval
  return setInterval(async () => {
    try {
      const results = await monitor.checkAllHealth();

      // Log any degraded or critical vaults
      for (const [token, result] of results) {
        if (result.status !== 'healthy') {
          console.warn(`[VaultHealth] ${token} is ${result.status}:`, result.alerts);
        }
      }
    } catch (error) {
      console.error('[VaultHealth] Monitoring error:', error);
    }
  }, intervalMs);
}
