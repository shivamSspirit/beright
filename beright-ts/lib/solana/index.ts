/**
 * Solana Module
 *
 * Transaction auditing and wallet monitoring for Solana operations.
 */

// Audit logging
export {
  type TxType,
  type TxStatus,
  type TxAudit,
  type TxAuditCreate,
  type TxAuditUpdate,
  startTxAudit,
  updateTxAudit,
  completeTxAudit,
  failTxAudit,
  timeoutTxAudit,
  getRecentTxAudits,
  getTxAuditBySignature,
  getWalletTxStats,
  withTxAudit,
} from './auditLog';

// Wallet monitoring
export {
  type WalletMonitorConfig,
  type WalletStatus,
  type BalanceChange,
  WalletMonitor,
  startWalletMonitor,
  stopWalletMonitor,
  stopAllMonitors,
  getWalletStatus,
  getAllMonitorStatuses,
  isMonitored,
  startProtocolWalletMonitoring,
} from './monitor';
