/**
 * Autonomous Agent Orchestrator
 *
 * Master controller for 24/7 autonomous prediction operation:
 * - Coordinates all autonomous subsystems
 * - Manages agent lifecycle
 * - Handles failures and recovery
 * - Provides unified status and control
 * - Generates operational reports
 *
 * This is the main entry point for fully autonomous operation.
 */

import { EventEmitter } from 'events';
import { AutonomousScanner, getScanner } from './autonomousScanner';
import { AutoPredictionEngine, getAutoPredictionEngine } from './autoPredictionEngine';
import { SelfCalibrationSystem, getCalibrationSystem } from './selfCalibration';
import { MarketWatcher, getMarketWatcher } from './marketWatcher';
import { PortfolioManager, getPortfolioManager } from './portfolioManager';
import { AutonomousReporting, getReportingService } from './autonomousReporting';
import { processNotificationQueue } from './notificationDelivery';
import { checkAndQueueAlerts } from './marketAlerts';
import { generateAllWeeklySummaries } from './weeklySummary';
import { db } from '../lib/supabase/client';

// Configuration
const ORCHESTRATOR_CONFIG = {
  // Scan interval for opportunity scanning (ms)
  scanIntervalMs: 30 * 60 * 1000, // 30 minutes

  // Calibration interval (ms)
  calibrationIntervalMs: 6 * 60 * 60 * 1000, // 6 hours

  // Notification processing interval (ms)
  notificationIntervalMs: 5 * 60 * 1000, // 5 minutes

  // Market alert check interval (ms)
  alertCheckIntervalMs: 15 * 60 * 1000, // 15 minutes

  // Health check interval (ms)
  healthCheckIntervalMs: 60 * 1000, // 1 minute

  // Auto-restart on failure
  autoRestart: true,
  restartDelayMs: 30 * 1000, // 30 seconds

  // Max consecutive failures before pause
  maxConsecutiveFailures: 5,

  // Operating hours (optional, for limiting activity)
  operatingHours: {
    enabled: false,
    startHour: 6, // 6 AM
    endHour: 22, // 10 PM
    timezone: 'America/New_York',
  },

  // Emergency stop conditions
  emergencyStop: {
    // Stop if daily loss exceeds this
    maxDailyLoss: 10,
    // Stop if Brier score goes above this
    maxBrierScore: 0.40,
  },
};

// Types
interface SubsystemStatus {
  name: string;
  isRunning: boolean;
  lastActivity?: Date;
  errors: number;
  lastError?: string;
}

interface OrchestratorState {
  isRunning: boolean;
  startedAt?: Date;
  uptime: number;
  mode: 'active' | 'paused' | 'emergency_stopped' | 'idle';

  // Subsystem status
  subsystems: {
    scanner: SubsystemStatus;
    predictionEngine: SubsystemStatus;
    calibration: SubsystemStatus;
    marketWatcher: SubsystemStatus;
    portfolio: SubsystemStatus;
    reporting: SubsystemStatus;
    notifications: SubsystemStatus;
    alerts: SubsystemStatus;
  };

  // Operational stats
  stats: {
    predictionsToday: number;
    opportunitiesScanned: number;
    notificationsSent: number;
    alertsTriggered: number;
    errors: number;
  };

  // Health metrics
  health: {
    overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    consecutiveFailures: number;
    lastHealthCheck?: Date;
  };
}

interface OperationalReport {
  timestamp: string;
  uptime: string;
  mode: string;

  predictions: {
    today: number;
    avgBrier: number;
    successRate: number;
  };

  subsystems: SubsystemStatus[];

  health: {
    status: string;
    issues: string[];
    recommendations: string[];
  };

  nextActions: string[];
}

/**
 * Autonomous Agent Orchestrator
 */
export class AutonomousOrchestrator extends EventEmitter {
  private state: OrchestratorState;
  private agentUserId: string;

  // Subsystems
  private scanner: AutonomousScanner | null = null;
  private predictionEngine: AutoPredictionEngine | null = null;
  private calibrationSystem: SelfCalibrationSystem | null = null;
  private marketWatcher: MarketWatcher | null = null;
  private portfolioManager: PortfolioManager | null = null;
  private reportingService: AutonomousReporting | null = null;

  // Intervals
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private notificationInterval: NodeJS.Timeout | null = null;
  private alertCheckInterval: NodeJS.Timeout | null = null;

  constructor(agentUserId: string) {
    super();
    this.agentUserId = agentUserId;

    this.state = {
      isRunning: false,
      uptime: 0,
      mode: 'idle',
      subsystems: {
        scanner: { name: 'Opportunity Scanner', isRunning: false, errors: 0 },
        predictionEngine: { name: 'Prediction Engine', isRunning: false, errors: 0 },
        calibration: { name: 'Self-Calibration', isRunning: false, errors: 0 },
        marketWatcher: { name: 'Market Watcher', isRunning: false, errors: 0 },
        portfolio: { name: 'Portfolio Manager', isRunning: false, errors: 0 },
        reporting: { name: 'Reporting Service', isRunning: false, errors: 0 },
        notifications: { name: 'Notifications', isRunning: false, errors: 0 },
        alerts: { name: 'Market Alerts', isRunning: false, errors: 0 },
      },
      stats: {
        predictionsToday: 0,
        opportunitiesScanned: 0,
        notificationsSent: 0,
        alertsTriggered: 0,
        errors: 0,
      },
      health: {
        overallStatus: 'healthy',
        consecutiveFailures: 0,
      },
    };
  }

  /**
   * Start the autonomous orchestrator
   */
  async start(): Promise<void> {
    if (this.state.isRunning) {
      console.log('[Orchestrator] Already running');
      return;
    }

    console.log('[Orchestrator] Starting autonomous agent orchestrator...');
    console.log('[Orchestrator] Agent ID:', this.agentUserId);

    this.state.isRunning = true;
    this.state.startedAt = new Date();
    this.state.mode = 'active';

    try {
      // Initialize subsystems
      await this.initializeSubsystems();

      // Start health monitoring
      this.startHealthMonitoring();

      // Start notification processing
      this.startNotificationProcessing();

      // Start alert checking
      this.startAlertChecking();

      // Schedule weekly summaries
      this.scheduleWeeklySummaries();

      this.emit('started');
      console.log('[Orchestrator] All systems online. Autonomous operation active.');
      this.logStatus();

    } catch (err) {
      console.error('[Orchestrator] Failed to start:', err);
      this.state.mode = 'idle';
      this.state.isRunning = false;
      throw err;
    }
  }

  /**
   * Initialize all subsystems
   */
  private async initializeSubsystems(): Promise<void> {
    console.log('[Orchestrator] Initializing subsystems...');

    // 1. Market Watcher (for auto-resolution)
    try {
      this.marketWatcher = getMarketWatcher();
      this.marketWatcher.start();
      this.state.subsystems.marketWatcher.isRunning = true;
      this.state.subsystems.marketWatcher.lastActivity = new Date();
      console.log('[Orchestrator] Market Watcher started');
    } catch (err) {
      console.error('[Orchestrator] Market Watcher failed:', err);
      this.state.subsystems.marketWatcher.errors++;
      this.state.subsystems.marketWatcher.lastError = String(err);
    }

    // 2. Self-Calibration System
    try {
      this.calibrationSystem = getCalibrationSystem(this.agentUserId);
      this.calibrationSystem.start();
      this.state.subsystems.calibration.isRunning = true;
      this.state.subsystems.calibration.lastActivity = new Date();
      console.log('[Orchestrator] Calibration System started');
    } catch (err) {
      console.error('[Orchestrator] Calibration System failed:', err);
      this.state.subsystems.calibration.errors++;
      this.state.subsystems.calibration.lastError = String(err);
    }

    // 3. Opportunity Scanner
    try {
      this.scanner = getScanner();
      this.scanner.on('opportunitiesFound', (opps) => {
        this.state.stats.opportunitiesScanned += opps.length;
        this.state.subsystems.scanner.lastActivity = new Date();
      });
      this.scanner.start();
      this.state.subsystems.scanner.isRunning = true;
      console.log('[Orchestrator] Opportunity Scanner started');
    } catch (err) {
      console.error('[Orchestrator] Scanner failed:', err);
      this.state.subsystems.scanner.errors++;
      this.state.subsystems.scanner.lastError = String(err);
    }

    // 4. Auto-Prediction Engine
    try {
      this.predictionEngine = getAutoPredictionEngine(this.agentUserId);
      this.predictionEngine.on('predictionMade', () => {
        this.state.stats.predictionsToday++;
        this.state.subsystems.predictionEngine.lastActivity = new Date();
      });
      await this.predictionEngine.start();
      this.state.subsystems.predictionEngine.isRunning = true;
      console.log('[Orchestrator] Prediction Engine started');
    } catch (err) {
      console.error('[Orchestrator] Prediction Engine failed:', err);
      this.state.subsystems.predictionEngine.errors++;
      this.state.subsystems.predictionEngine.lastError = String(err);
    }

    // Wire up calibration adjustments to prediction engine
    if (this.calibrationSystem && this.predictionEngine) {
      this.calibrationSystem.on('calibrationComplete', (report) => {
        console.log('[Orchestrator] Calibration updated. Adjustments applied to prediction engine.');
      });
    }

    // 5. Portfolio Manager
    try {
      this.portfolioManager = getPortfolioManager(this.agentUserId);
      this.portfolioManager.start();
      this.portfolioManager.on('urgentAlert', (alerts) => {
        console.log(`[Orchestrator] Portfolio urgent alert: ${alerts.length} positions need attention`);
      });
      this.state.subsystems.portfolio.isRunning = true;
      this.state.subsystems.portfolio.lastActivity = new Date();
      console.log('[Orchestrator] Portfolio Manager started');
    } catch (err) {
      console.error('[Orchestrator] Portfolio Manager failed:', err);
      this.state.subsystems.portfolio.errors++;
      this.state.subsystems.portfolio.lastError = String(err);
    }

    // 6. Reporting Service
    try {
      this.reportingService = getReportingService(this.agentUserId);
      this.reportingService.start();
      this.reportingService.on('dailyReport', (report) => {
        console.log(`[Orchestrator] Daily report generated for ${report.date}`);
      });
      this.state.subsystems.reporting.isRunning = true;
      this.state.subsystems.reporting.lastActivity = new Date();
      console.log('[Orchestrator] Reporting Service started');
    } catch (err) {
      console.error('[Orchestrator] Reporting Service failed:', err);
      this.state.subsystems.reporting.errors++;
      this.state.subsystems.reporting.lastError = String(err);
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, ORCHESTRATOR_CONFIG.healthCheckIntervalMs);
  }

  /**
   * Perform health check on all subsystems
   */
  private async performHealthCheck(): Promise<void> {
    this.state.health.lastHealthCheck = new Date();

    const issues: string[] = [];

    // Check each subsystem
    for (const [key, subsystem] of Object.entries(this.state.subsystems)) {
      if (!subsystem.isRunning) {
        issues.push(`${subsystem.name} is not running`);
      }
      if (subsystem.errors > 3) {
        issues.push(`${subsystem.name} has ${subsystem.errors} errors`);
      }
    }

    // Check for emergency stop conditions
    if (this.calibrationSystem) {
      const report = this.calibrationSystem.getLastReport();
      if (report && report.overallBrier > ORCHESTRATOR_CONFIG.emergencyStop.maxBrierScore) {
        issues.push(`Brier score too high: ${report.overallBrier.toFixed(4)}`);
        this.triggerEmergencyStop('High Brier score');
        return;
      }
    }

    // Determine overall health
    if (issues.length === 0) {
      this.state.health.overallStatus = 'healthy';
      this.state.health.consecutiveFailures = 0;
    } else if (issues.length <= 2) {
      this.state.health.overallStatus = 'degraded';
    } else {
      this.state.health.overallStatus = 'unhealthy';
      this.state.health.consecutiveFailures++;

      if (this.state.health.consecutiveFailures >= ORCHESTRATOR_CONFIG.maxConsecutiveFailures) {
        this.triggerEmergencyStop('Too many consecutive failures');
      }
    }

    // Emit health status
    this.emit('healthCheck', {
      status: this.state.health.overallStatus,
      issues,
    });
  }

  /**
   * Start notification processing
   */
  private startNotificationProcessing(): void {
    this.state.subsystems.notifications.isRunning = true;

    this.notificationInterval = setInterval(async () => {
      try {
        const result = await processNotificationQueue({ limit: 50 });
        this.state.stats.notificationsSent += result.succeeded;
        this.state.subsystems.notifications.lastActivity = new Date();
      } catch (err) {
        console.error('[Orchestrator] Notification processing error:', err);
        this.state.subsystems.notifications.errors++;
        this.state.subsystems.notifications.lastError = String(err);
      }
    }, ORCHESTRATOR_CONFIG.notificationIntervalMs);
  }

  /**
   * Start alert checking
   */
  private startAlertChecking(): void {
    this.state.subsystems.alerts.isRunning = true;

    this.alertCheckInterval = setInterval(async () => {
      try {
        const result = await checkAndQueueAlerts();
        this.state.stats.alertsTriggered += result.alertsQueued;
        this.state.subsystems.alerts.lastActivity = new Date();
      } catch (err) {
        console.error('[Orchestrator] Alert checking error:', err);
        this.state.subsystems.alerts.errors++;
        this.state.subsystems.alerts.lastError = String(err);
      }
    }, ORCHESTRATOR_CONFIG.alertCheckIntervalMs);
  }

  /**
   * Schedule weekly summaries (Sunday at 9 AM)
   */
  private scheduleWeeklySummaries(): void {
    const scheduleNextSunday = () => {
      const now = new Date();
      const nextSunday = new Date(now);
      nextSunday.setDate(now.getDate() + (7 - now.getDay()));
      nextSunday.setHours(9, 0, 0, 0);

      if (nextSunday <= now) {
        nextSunday.setDate(nextSunday.getDate() + 7);
      }

      const msUntilSunday = nextSunday.getTime() - now.getTime();

      setTimeout(async () => {
        console.log('[Orchestrator] Generating weekly summaries...');
        try {
          await generateAllWeeklySummaries();
        } catch (err) {
          console.error('[Orchestrator] Weekly summary error:', err);
        }
        scheduleNextSunday(); // Schedule next week
      }, msUntilSunday);
    };

    scheduleNextSunday();
  }

  /**
   * Trigger emergency stop
   */
  private triggerEmergencyStop(reason: string): void {
    console.error(`[Orchestrator] EMERGENCY STOP: ${reason}`);

    this.state.mode = 'emergency_stopped';

    // Stop all active subsystems
    this.stopSubsystems();

    this.emit('emergencyStop', { reason });
  }

  /**
   * Stop all subsystems
   */
  private stopSubsystems(): void {
    if (this.scanner) {
      this.scanner.stop();
      this.state.subsystems.scanner.isRunning = false;
    }

    if (this.predictionEngine) {
      this.predictionEngine.stop();
      this.state.subsystems.predictionEngine.isRunning = false;
    }

    if (this.calibrationSystem) {
      this.calibrationSystem.stop();
      this.state.subsystems.calibration.isRunning = false;
    }

    if (this.marketWatcher) {
      this.marketWatcher.stop();
      this.state.subsystems.marketWatcher.isRunning = false;
    }

    if (this.portfolioManager) {
      this.portfolioManager.stop();
      this.state.subsystems.portfolio.isRunning = false;
    }

    if (this.reportingService) {
      this.reportingService.stop();
      this.state.subsystems.reporting.isRunning = false;
    }
  }

  /**
   * Stop the orchestrator
   */
  stop(): void {
    console.log('[Orchestrator] Stopping...');

    this.state.isRunning = false;
    this.state.mode = 'idle';

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.notificationInterval) {
      clearInterval(this.notificationInterval);
      this.notificationInterval = null;
    }

    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
      this.alertCheckInterval = null;
    }

    // Stop subsystems
    this.stopSubsystems();

    this.state.subsystems.notifications.isRunning = false;
    this.state.subsystems.alerts.isRunning = false;

    this.emit('stopped');
    console.log('[Orchestrator] All systems stopped.');
  }

  /**
   * Pause operation (keep monitoring, stop predictions)
   */
  pause(): void {
    console.log('[Orchestrator] Pausing prediction activity...');
    this.state.mode = 'paused';

    if (this.predictionEngine) {
      this.predictionEngine.stop();
      this.state.subsystems.predictionEngine.isRunning = false;
    }

    this.emit('paused');
  }

  /**
   * Resume operation
   */
  async resume(): Promise<void> {
    if (this.state.mode === 'emergency_stopped') {
      console.log('[Orchestrator] Cannot resume from emergency stop. Use reset() first.');
      return;
    }

    console.log('[Orchestrator] Resuming...');
    this.state.mode = 'active';

    if (this.predictionEngine) {
      await this.predictionEngine.start();
      this.state.subsystems.predictionEngine.isRunning = true;
    }

    this.emit('resumed');
  }

  /**
   * Reset after emergency stop
   */
  async reset(): Promise<void> {
    console.log('[Orchestrator] Resetting after emergency stop...');

    this.state.health.consecutiveFailures = 0;
    this.state.stats.errors = 0;

    // Reset subsystem errors
    for (const subsystem of Object.values(this.state.subsystems)) {
      subsystem.errors = 0;
      subsystem.lastError = undefined;
    }

    this.state.mode = 'idle';

    // Restart
    await this.start();
  }

  /**
   * Get current state
   */
  getState(): OrchestratorState {
    // Calculate uptime
    if (this.state.startedAt) {
      this.state.uptime = Date.now() - this.state.startedAt.getTime();
    }
    return { ...this.state };
  }

  /**
   * Generate operational report
   */
  async generateReport(): Promise<OperationalReport> {
    const state = this.getState();

    // Get prediction stats
    let avgBrier = 0;
    let successRate = 0;

    try {
      const predictions = await db.predictions.getByUser(this.agentUserId);
      const resolved = predictions.filter(p => p.brier_score !== null);
      if (resolved.length > 0) {
        avgBrier = resolved.reduce((sum, p) => sum + (p.brier_score || 0), 0) / resolved.length;
        const correct = resolved.filter(p => (p.direction === 'YES') === p.outcome).length;
        successRate = correct / resolved.length;
      }
    } catch (err) {
      console.error('Error getting prediction stats:', err);
    }

    // Identify issues
    const issues: string[] = [];
    const recommendations: string[] = [];

    for (const subsystem of Object.values(state.subsystems)) {
      if (!subsystem.isRunning) {
        issues.push(`${subsystem.name} is offline`);
        recommendations.push(`Restart ${subsystem.name}`);
      }
      if (subsystem.errors > 0) {
        issues.push(`${subsystem.name}: ${subsystem.errors} errors`);
      }
    }

    if (avgBrier > 0.25) {
      issues.push(`High Brier score: ${avgBrier.toFixed(4)}`);
      recommendations.push('Review prediction criteria and calibration');
    }

    // Next actions
    const nextActions: string[] = [];
    if (this.scanner) {
      const scannerStatus = this.scanner.getStatus();
      if (!scannerStatus.isRunning) {
        nextActions.push('Scanner will resume on next interval');
      }
    }

    if (state.mode === 'paused') {
      nextActions.push('Predictions paused. Use resume() to continue.');
    }

    return {
      timestamp: new Date().toISOString(),
      uptime: this.formatUptime(state.uptime),
      mode: state.mode,
      predictions: {
        today: state.stats.predictionsToday,
        avgBrier,
        successRate,
      },
      subsystems: Object.values(state.subsystems),
      health: {
        status: state.health.overallStatus,
        issues,
        recommendations,
      },
      nextActions,
    };
  }

  /**
   * Format uptime as human-readable string
   */
  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Log current status
   */
  logStatus(): void {
    const state = this.getState();

    console.log('\n' + '═'.repeat(60));
    console.log('🤖 AUTONOMOUS AGENT ORCHESTRATOR STATUS');
    console.log('═'.repeat(60));
    console.log(`Mode: ${state.mode.toUpperCase()}`);
    console.log(`Uptime: ${this.formatUptime(state.uptime)}`);
    console.log(`Health: ${state.health.overallStatus.toUpperCase()}`);

    console.log('\n📊 Subsystems:');
    for (const [key, sub] of Object.entries(state.subsystems)) {
      const status = sub.isRunning ? '✅' : '❌';
      console.log(`  ${status} ${sub.name} (errors: ${sub.errors})`);
    }

    console.log('\n📈 Stats:');
    console.log(`  Predictions today: ${state.stats.predictionsToday}`);
    console.log(`  Opportunities scanned: ${state.stats.opportunitiesScanned}`);
    console.log(`  Notifications sent: ${state.stats.notificationsSent}`);
    console.log(`  Alerts triggered: ${state.stats.alertsTriggered}`);

    console.log('═'.repeat(60) + '\n');
  }
}

// Singleton
let orchestratorInstance: AutonomousOrchestrator | null = null;

export function getOrchestrator(agentUserId?: string): AutonomousOrchestrator {
  if (!orchestratorInstance) {
    if (!agentUserId) throw new Error('Agent user ID required for first initialization');
    orchestratorInstance = new AutonomousOrchestrator(agentUserId);
  }
  return orchestratorInstance;
}

// CLI
if (require.main === module) {
  const command = process.argv[2] || 'status';
  const agentUserId = process.env.AUTONOMOUS_AGENT_USER_ID || 'autonomous-agent';

  const orchestrator = new AutonomousOrchestrator(agentUserId);

  switch (command) {
    case 'start':
    case 'daemon':
      console.log('\n🚀 Starting Autonomous Agent Orchestrator...\n');

      orchestrator.on('emergencyStop', ({ reason }) => {
        console.log(`\n🚨 EMERGENCY STOP: ${reason}\n`);
      });

      orchestrator.on('healthCheck', ({ status, issues }) => {
        if (status !== 'healthy') {
          console.log(`\n⚠️ Health: ${status}`);
          issues.forEach((i: string) => console.log(`  - ${i}`));
        }
      });

      orchestrator.start().then(() => {
        console.log('\n🤖 Autonomous operation active.');
        console.log('Press Ctrl+C to stop gracefully.\n');

        // Log status every hour
        setInterval(() => {
          orchestrator.logStatus();
        }, 60 * 60 * 1000);
      });

      process.on('SIGINT', () => {
        console.log('\n\nReceived SIGINT. Shutting down gracefully...');
        orchestrator.stop();
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        console.log('\n\nReceived SIGTERM. Shutting down gracefully...');
        orchestrator.stop();
        process.exit(0);
      });
      break;

    case 'status':
      orchestrator.logStatus();
      process.exit(0);
      break;

    case 'report':
      orchestrator.generateReport().then(report => {
        console.log('\n📋 OPERATIONAL REPORT');
        console.log('═'.repeat(50));
        console.log(`Generated: ${report.timestamp}`);
        console.log(`Uptime: ${report.uptime}`);
        console.log(`Mode: ${report.mode}`);

        console.log('\n📊 Predictions:');
        console.log(`  Today: ${report.predictions.today}`);
        console.log(`  Avg Brier: ${report.predictions.avgBrier.toFixed(4)}`);
        console.log(`  Success Rate: ${(report.predictions.successRate * 100).toFixed(1)}%`);

        console.log('\n🔧 Subsystems:');
        for (const sub of report.subsystems) {
          const status = sub.isRunning ? '✅' : '❌';
          console.log(`  ${status} ${sub.name}`);
        }

        if (report.health.issues.length > 0) {
          console.log('\n⚠️ Issues:');
          for (const issue of report.health.issues) {
            console.log(`  - ${issue}`);
          }
        }

        if (report.health.recommendations.length > 0) {
          console.log('\n💡 Recommendations:');
          for (const rec of report.health.recommendations) {
            console.log(`  - ${rec}`);
          }
        }

        process.exit(0);
      }).catch(err => {
        console.error('Error generating report:', err);
        process.exit(1);
      });
      break;

    default:
      console.log('\n🤖 Autonomous Agent Orchestrator');
      console.log('═'.repeat(40));
      console.log('\nUsage:');
      console.log('  ts-node autonomousOrchestrator.ts start   # Run 24/7 autonomous operation');
      console.log('  ts-node autonomousOrchestrator.ts status  # Show current status');
      console.log('  ts-node autonomousOrchestrator.ts report  # Generate operational report');
      process.exit(0);
  }
}

export { ORCHESTRATOR_CONFIG, OrchestratorState, OperationalReport, SubsystemStatus };
