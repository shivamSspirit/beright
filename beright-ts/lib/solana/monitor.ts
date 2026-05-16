/**
 * Solana Wallet Monitor
 *
 * Monitors wallet balances and transactions for:
 * - Balance changes
 * - Large outflows
 * - Suspicious patterns
 * - Low balance alerts
 *
 * Usage:
 *   import { WalletMonitor, startWalletMonitor, getWalletStatus } from '@/lib/solana/monitor';
 *
 *   // Start monitoring
 *   const monitor = startWalletMonitor(walletAddress, {
 *     lowBalanceThreshold: 0.1, // 0.1 SOL
 *     alertOnOutflow: 1,        // Alert on outflows > 1 SOL
 *   });
 *
 *   // Check status
 *   const status = await getWalletStatus(walletAddress);
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { secrets } from '../secrets';
import { logSecurityEvent, logCriticalSecurityEvent } from '../middleware/securityLogger';

// ============================================
// TYPES
// ============================================

export interface WalletMonitorConfig {
  pollIntervalMs?: number;         // How often to check (default: 30000)
  lowBalanceThreshold?: number;    // SOL threshold for low balance alert (default: 0.5)
  alertOnOutflowSol?: number;      // Alert on outflows above this (default: 5)
  maxOutflowPerHourSol?: number;   // Max cumulative outflow per hour (default: 50)
  enabled?: boolean;               // Enable monitoring (default: true)
}

export interface WalletStatus {
  address: string;
  balanceSol: number;
  balanceLamports: number;
  lastChecked: Date;
  isLow: boolean;
  recentOutflowSol: number;  // Last hour
  alertsTriggered: number;
}

export interface BalanceChange {
  timestamp: Date;
  previousBalance: number;
  newBalance: number;
  changeLamports: number;
  changeSol: number;
  isOutflow: boolean;
}

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_CONFIG: Required<WalletMonitorConfig> = {
  pollIntervalMs: 30000,           // 30 seconds
  lowBalanceThreshold: 0.5,        // 0.5 SOL
  alertOnOutflowSol: 5,            // 5 SOL
  maxOutflowPerHourSol: 50,        // 50 SOL per hour
  enabled: true,
};

// ============================================
// CONNECTION
// ============================================

let connection: Connection | null = null;

function getConnection(): Connection {
  if (connection) return connection;

  const rpcUrl = secrets.getHeliusRpcUrl();
  connection = new Connection(rpcUrl, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
  });

  return connection;
}

// ============================================
// WALLET MONITOR CLASS
// ============================================

export class WalletMonitor {
  private address: string;
  private publicKey: PublicKey;
  private config: Required<WalletMonitorConfig>;
  private connection: Connection;

  private lastBalance: number = 0;
  private lastChecked: Date = new Date();
  private balanceHistory: BalanceChange[] = [];
  private alertCount: number = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning: boolean = false;

  constructor(address: string, config: WalletMonitorConfig = {}) {
    this.address = address;
    this.publicKey = new PublicKey(address);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.connection = getConnection();
  }

  /**
   * Start monitoring the wallet
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    if (!this.config.enabled) {
      console.log(`[WalletMonitor] Monitoring disabled for ${this.shortenAddress()}`);
      return;
    }

    this.isRunning = true;
    console.log(`[WalletMonitor] Starting monitor for ${this.shortenAddress()}`);

    // Initial check
    await this.checkBalance();

    // Set up polling
    this.intervalId = setInterval(async () => {
      try {
        await this.checkBalance();
      } catch (error) {
        console.error(`[WalletMonitor] Error checking ${this.shortenAddress()}:`, error);
      }
    }, this.config.pollIntervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log(`[WalletMonitor] Stopped monitor for ${this.shortenAddress()}`);
  }

  /**
   * Check current balance and detect changes
   */
  async checkBalance(): Promise<WalletStatus> {
    try {
      const balanceLamports = await this.connection.getBalance(this.publicKey);
      const balanceSol = balanceLamports / LAMPORTS_PER_SOL;
      const now = new Date();

      // Detect balance change
      if (this.lastBalance !== 0 && balanceLamports !== this.lastBalance) {
        const changeLamports = balanceLamports - this.lastBalance;
        const changeSol = changeLamports / LAMPORTS_PER_SOL;
        const isOutflow = changeLamports < 0;

        const change: BalanceChange = {
          timestamp: now,
          previousBalance: this.lastBalance,
          newBalance: balanceLamports,
          changeLamports,
          changeSol,
          isOutflow,
        };

        this.balanceHistory.push(change);
        this.pruneHistory();

        // Handle the change
        await this.handleBalanceChange(change);
      }

      this.lastBalance = balanceLamports;
      this.lastChecked = now;

      // Check for low balance
      const isLow = balanceSol < this.config.lowBalanceThreshold;
      if (isLow) {
        await this.alertLowBalance(balanceSol);
      }

      return this.getStatus();
    } catch (error) {
      console.error(`[WalletMonitor] Failed to check balance:`, error);
      throw error;
    }
  }

  /**
   * Get current wallet status
   */
  getStatus(): WalletStatus {
    const balanceSol = this.lastBalance / LAMPORTS_PER_SOL;
    const recentOutflowSol = this.getRecentOutflow();

    return {
      address: this.address,
      balanceSol,
      balanceLamports: this.lastBalance,
      lastChecked: this.lastChecked,
      isLow: balanceSol < this.config.lowBalanceThreshold,
      recentOutflowSol,
      alertsTriggered: this.alertCount,
    };
  }

  /**
   * Get recent balance history
   */
  getHistory(limit = 20): BalanceChange[] {
    return this.balanceHistory.slice(-limit);
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private async handleBalanceChange(change: BalanceChange): Promise<void> {
    const action = change.isOutflow ? 'outflow' : 'inflow';
    const absSol = Math.abs(change.changeSol);

    console.log(
      `[WalletMonitor] ${action.toUpperCase()} | ${this.shortenAddress()} | ` +
      `${change.isOutflow ? '-' : '+'}${absSol.toFixed(4)} SOL`
    );

    // Log security event
    await logSecurityEvent({
      eventType: 'transaction_send',
      action: `wallet_${action}`,
      severity: change.isOutflow ? 'info' : 'debug',
      walletAddress: this.address,
      details: {
        changeSol: change.changeSol,
        newBalanceSol: change.newBalance / LAMPORTS_PER_SOL,
        previousBalanceSol: change.previousBalance / LAMPORTS_PER_SOL,
      },
    });

    // Check for large outflow
    if (change.isOutflow && absSol >= this.config.alertOnOutflowSol) {
      await this.alertLargeOutflow(change);
    }

    // Check for excessive hourly outflow
    const hourlyOutflow = this.getRecentOutflow();
    if (hourlyOutflow >= this.config.maxOutflowPerHourSol) {
      await this.alertExcessiveOutflow(hourlyOutflow);
    }
  }

  private async alertLowBalance(balanceSol: number): Promise<void> {
    this.alertCount++;

    const message = [
      '⚠️ LOW WALLET BALANCE',
      '',
      `Wallet: ${this.shortenAddress()}`,
      `Balance: ${balanceSol.toFixed(4)} SOL`,
      `Threshold: ${this.config.lowBalanceThreshold} SOL`,
    ].join('\n');

    await logSecurityEvent({
      eventType: 'suspicious_activity',
      action: 'low_balance_alert',
      severity: 'warning',
      walletAddress: this.address,
      details: {
        balanceSol,
        threshold: this.config.lowBalanceThreshold,
        message,
      },
    });

    console.warn('[WalletMonitor] LOW BALANCE:', message);
  }

  private async alertLargeOutflow(change: BalanceChange): Promise<void> {
    this.alertCount++;
    const absSol = Math.abs(change.changeSol);

    const message = [
      '🚨 LARGE OUTFLOW DETECTED',
      '',
      `Wallet: ${this.shortenAddress()}`,
      `Amount: ${absSol.toFixed(4)} SOL`,
      `New Balance: ${(change.newBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`,
      '',
      'Check recent transactions immediately.',
    ].join('\n');

    await logCriticalSecurityEvent({
      eventType: 'suspicious_activity',
      action: 'large_outflow_alert',
      severity: 'critical',
      walletAddress: this.address,
      details: {
        outflowSol: absSol,
        newBalanceSol: change.newBalance / LAMPORTS_PER_SOL,
        threshold: this.config.alertOnOutflowSol,
        message,
      },
    });

    console.error('[WalletMonitor] LARGE OUTFLOW:', message);
  }

  private async alertExcessiveOutflow(hourlyOutflow: number): Promise<void> {
    this.alertCount++;

    const message = [
      '🚨 EXCESSIVE HOURLY OUTFLOW',
      '',
      `Wallet: ${this.shortenAddress()}`,
      `Outflow (1h): ${hourlyOutflow.toFixed(4)} SOL`,
      `Limit: ${this.config.maxOutflowPerHourSol} SOL/hour`,
      '',
      'Possible unauthorized activity!',
    ].join('\n');

    await logCriticalSecurityEvent({
      eventType: 'suspicious_activity',
      action: 'excessive_outflow_alert',
      severity: 'critical',
      walletAddress: this.address,
      details: {
        hourlyOutflowSol: hourlyOutflow,
        limit: this.config.maxOutflowPerHourSol,
        message,
      },
    });

    console.error('[WalletMonitor] EXCESSIVE OUTFLOW:', message);
  }

  private getRecentOutflow(): number {
    const hourAgo = Date.now() - 60 * 60 * 1000;
    return this.balanceHistory
      .filter(c => c.timestamp.getTime() > hourAgo && c.isOutflow)
      .reduce((sum, c) => sum + Math.abs(c.changeSol), 0);
  }

  private pruneHistory(): void {
    // Keep only last 24 hours
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.balanceHistory = this.balanceHistory.filter(
      c => c.timestamp.getTime() > dayAgo
    );
  }

  private shortenAddress(): string {
    return this.address.slice(0, 6) + '...' + this.address.slice(-4);
  }
}

// ============================================
// SINGLETON MONITOR REGISTRY
// ============================================

const activeMonitors = new Map<string, WalletMonitor>();

/**
 * Start monitoring a wallet
 */
export function startWalletMonitor(
  address: string,
  config?: WalletMonitorConfig
): WalletMonitor {
  // Check if already monitoring
  let monitor = activeMonitors.get(address);
  if (monitor) {
    console.log(`[WalletMonitor] Already monitoring ${address.slice(0, 8)}...`);
    return monitor;
  }

  // Create and start new monitor
  monitor = new WalletMonitor(address, config);
  activeMonitors.set(address, monitor);
  monitor.start().catch(console.error);

  return monitor;
}

/**
 * Stop monitoring a wallet
 */
export function stopWalletMonitor(address: string): void {
  const monitor = activeMonitors.get(address);
  if (monitor) {
    monitor.stop();
    activeMonitors.delete(address);
  }
}

/**
 * Stop all monitors
 */
export function stopAllMonitors(): void {
  for (const monitor of activeMonitors.values()) {
    monitor.stop();
  }
  activeMonitors.clear();
}

/**
 * Get wallet status (triggers a fresh check)
 */
export async function getWalletStatus(address: string): Promise<WalletStatus | null> {
  const monitor = activeMonitors.get(address);
  if (monitor) {
    return monitor.checkBalance();
  }

  // Create temporary monitor for one-time check
  const tempMonitor = new WalletMonitor(address, { enabled: false });
  try {
    return await tempMonitor.checkBalance();
  } catch {
    return null;
  }
}

/**
 * Get all active monitors' statuses
 */
export function getAllMonitorStatuses(): WalletStatus[] {
  return Array.from(activeMonitors.values()).map(m => m.getStatus());
}

/**
 * Check if a wallet is being monitored
 */
export function isMonitored(address: string): boolean {
  return activeMonitors.has(address);
}

// ============================================
// AUTO-START PROTOCOL WALLETS
// ============================================

/**
 * Start monitoring all protocol wallets
 * Call this at application startup
 */
export function startProtocolWalletMonitoring(): void {
  const protocolWallets = [
    process.env.PROTOCOL_WALLET_ADDRESS,
    process.env.FEE_WALLET_ADDRESS,
    process.env.TREASURY_WALLET_ADDRESS,
  ].filter(Boolean) as string[];

  for (const wallet of protocolWallets) {
    startWalletMonitor(wallet, {
      lowBalanceThreshold: 1,      // 1 SOL
      alertOnOutflowSol: 10,       // 10 SOL
      maxOutflowPerHourSol: 100,   // 100 SOL
    });
  }

  console.log(`[WalletMonitor] Started monitoring ${protocolWallets.length} protocol wallets`);
}
