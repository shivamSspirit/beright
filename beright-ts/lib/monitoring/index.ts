/**
 * Monitoring Module
 *
 * Security alerts and monitoring for BeRight Protocol.
 */

// Alerts
export {
  type AlertChannel,
  type AlertSeverity,
  type Alert,
  type AlertResult,
  sendAlert,
  sendCriticalAlert,
  sendWarningAlert,
  sendInfoAlert,
  alertHighValueTransaction,
  alertLowBalance,
  alertTransactionFailed,
  alertSecurityEvent,
  alertKillSwitch,
  alertRateLimitExceeded,
  sendTestAlert,
} from './alerts';
