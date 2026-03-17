/**
 * Yield Monitoring Module
 *
 * Monitors vault health, triggers alerts, and manages rebalancing.
 */

export {
  VaultHealthMonitor,
  getHealthMonitor,
  startHealthMonitoring,
  type HealthCheckResult,
  type HealthAlert,
  type MonitoringConfig,
  DEFAULT_MONITORING_CONFIG,
} from './health';
