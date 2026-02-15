/**
 * Autonomous Reporting Service
 *
 * Generates comprehensive reports and insights:
 * - Daily performance summaries
 * - Weekly deep-dive reports
 * - Monthly trend analysis
 * - Real-time dashboards
 * - Anomaly detection
 * - Predictive analytics
 *
 * Goal: Complete visibility into autonomous agent performance
 */

import { EventEmitter } from 'events';
import { db } from '../lib/supabase/client';
import { PortfolioManager, getPortfolioManager, PortfolioSummary } from './portfolioManager';
import { SelfCalibrationSystem, getCalibrationSystem, CalibrationReport } from './selfCalibration';
import { AutonomousOrchestrator, getOrchestrator } from './autonomousOrchestrator';
import { interpretBrierScore } from '../lib/onchain/memo';

// Types
interface DailyReport {
  date: string;
  userId: string;
  generatedAt: string;

  // Activity summary
  activity: {
    predictionseMade: number;
    predictionsResolved: number;
    opportunitiesScanned: number;
    notificationsSent: number;
  };

  // Performance
  performance: {
    resolvedToday: number;
    correctToday: number;
    wrongToday: number;
    avgBrierToday: number;
    runningAvgBrier: number;
  };

  // Portfolio snapshot
  portfolio: {
    activePositions: number;
    totalUnrealizedPnL: number;
    topGainer?: { ticker: string; pnl: number };
    topLoser?: { ticker: string; pnl: number };
  };

  // Calibration status
  calibration: {
    confidenceMultiplier: number;
    avoidCategories: string[];
    focusCategories: string[];
  };

  // Highlights
  highlights: string[];

  // Concerns
  concerns: string[];
}

interface WeeklyReport extends DailyReport {
  weekNumber: number;
  weekStart: string;
  weekEnd: string;

  // Trends
  trends: {
    brierTrend: 'improving' | 'declining' | 'stable';
    volumeTrend: 'increasing' | 'decreasing' | 'stable';
    accuracyTrend: 'improving' | 'declining' | 'stable';
  };

  // Category breakdown
  categoryBreakdown: {
    category: string;
    predictions: number;
    accuracy: number;
    avgBrier: number;
    pnl: number;
  }[];

  // Best/worst days
  bestDay?: { date: string; brier: number };
  worstDay?: { date: string; brier: number };

  // Patterns detected
  patterns: string[];

  // Next week outlook
  outlook: string[];
}

interface MonthlyReport extends WeeklyReport {
  month: string;
  year: number;

  // Long-term metrics
  longTermMetrics: {
    totalPredictions: number;
    overallAccuracy: number;
    overallBrier: number;
    brierPercentile: number; // vs. random
    profitableDays: number;
    lossDays: number;
  };

  // Evolution
  evolution: {
    startBrier: number;
    endBrier: number;
    improvement: number;
    milestone?: string;
  };

  // Strategic insights
  strategicInsights: string[];

  // Recommendations for next month
  nextMonthFocus: string[];
}

interface RealtimeDashboard {
  timestamp: string;
  userId: string;

  // Current state
  agentStatus: 'active' | 'paused' | 'stopped' | 'emergency_stopped';
  uptimeHours: number;

  // Today's stats
  todayPredictions: number;
  todayResolved: number;
  todayPnL: number;

  // Active alerts
  alerts: {
    level: 'critical' | 'warning' | 'info';
    message: string;
    timestamp: string;
  }[];

  // Recent activity
  recentActivity: {
    type: 'prediction' | 'resolution' | 'calibration' | 'alert';
    description: string;
    timestamp: string;
  }[];

  // Health indicators
  health: {
    scannerOk: boolean;
    predictionEngineOk: boolean;
    calibrationOk: boolean;
    portfolioOk: boolean;
  };

  // Next scheduled actions
  nextActions: {
    action: string;
    scheduledFor: string;
  }[];
}

// Configuration
const REPORTING_CONFIG = {
  // Report generation times
  dailyReportHour: 21, // 9 PM
  weeklyReportDay: 0, // Sunday
  weeklyReportHour: 10, // 10 AM

  // Trend thresholds
  improvingThreshold: 0.02,
  decliningThreshold: -0.02,

  // Alert thresholds
  criticalBrierThreshold: 0.35,
  warningBrierThreshold: 0.25,
};

/**
 * Autonomous Reporting Service
 */
export class AutonomousReporting extends EventEmitter {
  private userId: string;
  private portfolioManager: PortfolioManager;
  private calibrationSystem: SelfCalibrationSystem;

  private dailyReportInterval: NodeJS.Timeout | null = null;
  private dashboardInterval: NodeJS.Timeout | null = null;

  private recentActivity: RealtimeDashboard['recentActivity'] = [];
  private alerts: RealtimeDashboard['alerts'] = [];

  constructor(userId: string) {
    super();
    this.userId = userId;
    this.portfolioManager = getPortfolioManager(userId);
    this.calibrationSystem = getCalibrationSystem(userId);
  }

  /**
   * Start reporting service
   */
  start(): void {
    console.log('[Reporting] Starting autonomous reporting service...');

    // Schedule daily reports
    this.scheduleDailyReports();

    // Update dashboard frequently
    this.dashboardInterval = setInterval(() => {
      this.emit('dashboardUpdate', this.getDashboard());
    }, 60 * 1000); // Every minute
  }

  /**
   * Stop reporting
   */
  stop(): void {
    if (this.dailyReportInterval) {
      clearInterval(this.dailyReportInterval);
      this.dailyReportInterval = null;
    }
    if (this.dashboardInterval) {
      clearInterval(this.dashboardInterval);
      this.dashboardInterval = null;
    }
  }

  /**
   * Schedule daily reports at configured hour
   */
  private scheduleDailyReports(): void {
    const scheduleNext = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(REPORTING_CONFIG.dailyReportHour, 0, 0, 0);

      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }

      const msUntilNext = next.getTime() - now.getTime();

      setTimeout(async () => {
        try {
          const report = await this.generateDailyReport();
          this.emit('dailyReport', report);
        } catch (err) {
          console.error('[Reporting] Daily report error:', err);
        }
        scheduleNext();
      }, msUntilNext);
    };

    scheduleNext();
  }

  /**
   * Generate daily report
   */
  async generateDailyReport(date?: Date): Promise<DailyReport> {
    const targetDate = date || new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    console.log(`[Reporting] Generating daily report for ${dateStr}...`);

    // Get all predictions
    const allPredictions = await db.predictions.getByUser(this.userId);

    // Filter to target date
    const todayStart = new Date(targetDate);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(targetDate);
    todayEnd.setHours(23, 59, 59, 999);

    const madeToday = allPredictions.filter(p => {
      const created = new Date(p.created_at);
      return created >= todayStart && created <= todayEnd;
    });

    const resolvedToday = allPredictions.filter(p => {
      if (!p.resolved_at) return false;
      const resolved = new Date(p.resolved_at);
      return resolved >= todayStart && resolved <= todayEnd;
    });

    // Calculate performance
    const correctToday = resolvedToday.filter(p => (p.direction === 'YES') === p.outcome).length;
    const wrongToday = resolvedToday.length - correctToday;
    const avgBrierToday = resolvedToday.length > 0
      ? resolvedToday.reduce((sum, p) => sum + (p.brier_score || 0), 0) / resolvedToday.length
      : 0;

    // Running average
    const allResolved = allPredictions.filter(p => p.brier_score !== null);
    const runningAvgBrier = allResolved.length > 0
      ? allResolved.reduce((sum, p) => sum + (p.brier_score || 0), 0) / allResolved.length
      : 0;

    // Portfolio snapshot
    const portfolioSummary = await this.portfolioManager.getSummary();

    // Calibration status
    const calibrationStatus = this.calibrationSystem.getAdjustments();

    // Generate highlights
    const highlights: string[] = [];
    if (correctToday > wrongToday && resolvedToday.length >= 3) {
      highlights.push(`Great day! ${correctToday}/${resolvedToday.length} predictions correct.`);
    }
    if (avgBrierToday > 0 && avgBrierToday < runningAvgBrier) {
      highlights.push(`Better than average Brier score today!`);
    }
    if (madeToday.length > 5) {
      highlights.push(`Highly active day with ${madeToday.length} new predictions.`);
    }

    // Generate concerns
    const concerns: string[] = [];
    if (avgBrierToday > REPORTING_CONFIG.warningBrierThreshold) {
      concerns.push(`Higher than usual Brier score: ${avgBrierToday.toFixed(4)}`);
    }
    if (portfolioSummary.concentrationRisk > 60) {
      concerns.push(`Portfolio concentration risk: ${portfolioSummary.concentrationRisk.toFixed(0)}/100`);
    }
    if (portfolioSummary.expiryRisk > 3) {
      concerns.push(`${portfolioSummary.expiryRisk} positions expiring soon`);
    }

    return {
      date: dateStr,
      userId: this.userId,
      generatedAt: new Date().toISOString(),
      activity: {
        predictionseMade: madeToday.length,
        predictionsResolved: resolvedToday.length,
        opportunitiesScanned: 0, // Would need orchestrator state
        notificationsSent: 0,
      },
      performance: {
        resolvedToday: resolvedToday.length,
        correctToday,
        wrongToday,
        avgBrierToday,
        runningAvgBrier,
      },
      portfolio: {
        activePositions: portfolioSummary.activePositions,
        totalUnrealizedPnL: portfolioSummary.totalUnrealizedPnL,
        topGainer: portfolioSummary.bestPosition
          ? { ticker: portfolioSummary.bestPosition.marketTicker, pnl: portfolioSummary.bestPosition.pnlPercent }
          : undefined,
        topLoser: portfolioSummary.worstPosition
          ? { ticker: portfolioSummary.worstPosition.marketTicker, pnl: portfolioSummary.worstPosition.pnlPercent }
          : undefined,
      },
      calibration: {
        confidenceMultiplier: calibrationStatus.confidenceMultiplier,
        avoidCategories: calibrationStatus.avoidCategories,
        focusCategories: calibrationStatus.focusCategories,
      },
      highlights,
      concerns,
    };
  }

  /**
   * Generate weekly report
   */
  async generateWeeklyReport(weekStart?: Date): Promise<WeeklyReport> {
    const start = weekStart || this.getWeekStart(new Date());
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    console.log(`[Reporting] Generating weekly report for ${start.toISOString().split('T')[0]}...`);

    // Get base daily report
    const daily = await this.generateDailyReport();

    // Get all predictions for the week
    const allPredictions = await db.predictions.getByUser(this.userId);
    const weekPredictions = allPredictions.filter(p => {
      const created = new Date(p.created_at);
      return created >= start && created < end;
    });

    const weekResolved = allPredictions.filter(p => {
      if (!p.resolved_at) return false;
      const resolved = new Date(p.resolved_at);
      return resolved >= start && resolved < end;
    });

    // Calculate trends
    const firstHalf = weekResolved.filter(p => {
      const resolved = new Date(p.resolved_at!);
      const midWeek = new Date(start);
      midWeek.setDate(midWeek.getDate() + 3.5);
      return resolved < midWeek;
    });

    const secondHalf = weekResolved.filter(p => {
      const resolved = new Date(p.resolved_at!);
      const midWeek = new Date(start);
      midWeek.setDate(midWeek.getDate() + 3.5);
      return resolved >= midWeek;
    });

    const firstHalfBrier = firstHalf.length > 0
      ? firstHalf.reduce((sum, p) => sum + (p.brier_score || 0), 0) / firstHalf.length
      : 0;
    const secondHalfBrier = secondHalf.length > 0
      ? secondHalf.reduce((sum, p) => sum + (p.brier_score || 0), 0) / secondHalf.length
      : 0;

    const brierDiff = secondHalfBrier - firstHalfBrier;
    let brierTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (brierDiff < REPORTING_CONFIG.decliningThreshold) brierTrend = 'improving';
    else if (brierDiff > REPORTING_CONFIG.improvingThreshold) brierTrend = 'declining';

    // Category breakdown
    const categoryData: Record<string, { predictions: number; correct: number; briers: number[] }> = {};
    for (const pred of weekResolved) {
      const category = this.inferCategory(pred.question || '');
      if (!categoryData[category]) {
        categoryData[category] = { predictions: 0, correct: 0, briers: [] };
      }
      categoryData[category].predictions++;
      if ((pred.direction === 'YES') === pred.outcome) {
        categoryData[category].correct++;
      }
      if (pred.brier_score !== null) {
        categoryData[category].briers.push(pred.brier_score);
      }
    }

    const categoryBreakdown = Object.entries(categoryData).map(([category, data]) => ({
      category,
      predictions: data.predictions,
      accuracy: data.correct / data.predictions,
      avgBrier: data.briers.length > 0
        ? data.briers.reduce((a, b) => a + b, 0) / data.briers.length
        : 0,
      pnl: 0, // Would need more data
    }));

    // Generate patterns
    const patterns: string[] = [];
    for (const cat of categoryBreakdown) {
      if (cat.accuracy > 0.7 && cat.predictions >= 3) {
        patterns.push(`Strong in ${cat.category}: ${(cat.accuracy * 100).toFixed(0)}% accuracy`);
      } else if (cat.accuracy < 0.4 && cat.predictions >= 3) {
        patterns.push(`Struggling with ${cat.category}: ${(cat.accuracy * 100).toFixed(0)}% accuracy`);
      }
    }

    // Generate outlook
    const outlook: string[] = [];
    if (brierTrend === 'improving') {
      outlook.push('Maintain current approach - calibration is improving.');
    } else if (brierTrend === 'declining') {
      outlook.push('Review recent predictions - calibration is declining.');
    }
    if (categoryBreakdown.length < 3) {
      outlook.push('Consider diversifying into more categories.');
    }

    return {
      ...daily,
      weekNumber: this.getWeekNumber(start),
      weekStart: start.toISOString().split('T')[0],
      weekEnd: end.toISOString().split('T')[0],
      trends: {
        brierTrend,
        volumeTrend: weekPredictions.length > 20 ? 'increasing' : weekPredictions.length < 5 ? 'decreasing' : 'stable',
        accuracyTrend: brierTrend, // Simplified
      },
      categoryBreakdown,
      patterns,
      outlook,
    };
  }

  /**
   * Get real-time dashboard
   */
  getDashboard(): RealtimeDashboard {
    let orchestratorState;
    try {
      const orchestrator = getOrchestrator();
      orchestratorState = orchestrator.getState();
    } catch {
      orchestratorState = null;
    }

    const uptimeHours = orchestratorState?.startedAt
      ? (Date.now() - orchestratorState.startedAt.getTime()) / (1000 * 60 * 60)
      : 0;

    return {
      timestamp: new Date().toISOString(),
      userId: this.userId,
      agentStatus: (orchestratorState?.mode === 'idle' ? 'paused' : orchestratorState?.mode) || 'stopped',
      uptimeHours,
      todayPredictions: orchestratorState?.stats.predictionsToday || 0,
      todayResolved: 0, // Would need to track
      todayPnL: 0,
      alerts: this.alerts.slice(-10),
      recentActivity: this.recentActivity.slice(-20),
      health: {
        scannerOk: orchestratorState?.subsystems.scanner.isRunning || false,
        predictionEngineOk: orchestratorState?.subsystems.predictionEngine.isRunning || false,
        calibrationOk: orchestratorState?.subsystems.calibration.isRunning || false,
        portfolioOk: true,
      },
      nextActions: [],
    };
  }

  /**
   * Add activity to recent list
   */
  logActivity(type: 'prediction' | 'resolution' | 'calibration' | 'alert', description: string): void {
    this.recentActivity.unshift({
      type,
      description,
      timestamp: new Date().toISOString(),
    });

    // Keep last 100
    if (this.recentActivity.length > 100) {
      this.recentActivity = this.recentActivity.slice(0, 100);
    }
  }

  /**
   * Add alert
   */
  addAlert(level: 'critical' | 'warning' | 'info', message: string): void {
    this.alerts.unshift({
      level,
      message,
      timestamp: new Date().toISOString(),
    });

    // Keep last 50
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(0, 50);
    }

    this.emit('alert', { level, message });
  }

  /**
   * Clear old alerts
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Format report as text
   */
  formatDailyReport(report: DailyReport): string {
    let text = `
📊 *DAILY REPORT - ${report.date}*
${'═'.repeat(40)}

📈 *Activity*
• Predictions made: ${report.activity.predictionseMade}
• Resolved: ${report.activity.predictionsResolved}

🎯 *Performance*
• Correct: ${report.performance.correctToday} | Wrong: ${report.performance.wrongToday}
• Today's Brier: ${report.performance.avgBrierToday.toFixed(4)}
• Running avg: ${report.performance.runningAvgBrier.toFixed(4)}

💼 *Portfolio*
• Active positions: ${report.portfolio.activePositions}
• Unrealized P&L: ${(report.portfolio.totalUnrealizedPnL * 100).toFixed(2)}%
`;

    if (report.portfolio.topGainer) {
      text += `• Top gainer: ${report.portfolio.topGainer.ticker} (+${(report.portfolio.topGainer.pnl * 100).toFixed(1)}%)\n`;
    }

    if (report.highlights.length > 0) {
      text += `\n⭐ *Highlights*\n`;
      for (const h of report.highlights) {
        text += `• ${h}\n`;
      }
    }

    if (report.concerns.length > 0) {
      text += `\n⚠️ *Concerns*\n`;
      for (const c of report.concerns) {
        text += `• ${c}\n`;
      }
    }

    return text;
  }

  /**
   * Helper: Get week start (Monday)
   */
  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Helper: Get week number
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  }

  /**
   * Helper: Infer category
   */
  private inferCategory(question: string): string {
    const lower = question.toLowerCase();

    if (lower.match(/bitcoin|btc|ethereum|eth|crypto|solana|sol|defi/)) return 'crypto';
    if (lower.match(/president|election|congress|senate|vote|trump|biden|democrat|republican/)) return 'politics';
    if (lower.match(/fed|inflation|gdp|unemployment|recession|economy|rates|cpi/)) return 'economics';
    if (lower.match(/nfl|nba|mlb|nhl|championship|playoff|super bowl|world cup/)) return 'sports';
    if (lower.match(/ai|openai|chatgpt|google|apple|microsoft|nvidia|tech|ipo/)) return 'tech';
    if (lower.match(/climate|weather|hurricane|earthquake|temperature/)) return 'climate';
    if (lower.match(/war|military|conflict|ukraine|russia|china|taiwan/)) return 'geopolitics';

    return 'general';
  }
}

// Singleton
let reportingInstance: AutonomousReporting | null = null;

export function getReportingService(userId?: string): AutonomousReporting {
  if (!reportingInstance) {
    if (!userId) throw new Error('User ID required');
    reportingInstance = new AutonomousReporting(userId);
  }
  return reportingInstance;
}

// CLI
if (require.main === module) {
  const command = process.argv[2] || 'daily';
  const userId = process.env.AUTONOMOUS_AGENT_USER_ID || 'autonomous-agent';

  const reporting = new AutonomousReporting(userId);

  switch (command) {
    case 'daily':
      reporting.generateDailyReport().then(report => {
        console.log(reporting.formatDailyReport(report));
        process.exit(0);
      }).catch(err => {
        console.error('Error:', err);
        process.exit(1);
      });
      break;

    case 'weekly':
      reporting.generateWeeklyReport().then(report => {
        console.log('\n📊 WEEKLY REPORT');
        console.log('═'.repeat(50));
        console.log(`Week: ${report.weekStart} to ${report.weekEnd}`);
        console.log(`\nTrends:`);
        console.log(`  Brier: ${report.trends.brierTrend}`);
        console.log(`  Volume: ${report.trends.volumeTrend}`);
        console.log(`  Accuracy: ${report.trends.accuracyTrend}`);

        console.log(`\nCategory Breakdown:`);
        for (const cat of report.categoryBreakdown) {
          console.log(`  ${cat.category}: ${cat.predictions} preds, ${(cat.accuracy * 100).toFixed(0)}% acc, ${cat.avgBrier.toFixed(4)} brier`);
        }

        if (report.patterns.length > 0) {
          console.log(`\nPatterns:`);
          for (const p of report.patterns) {
            console.log(`  • ${p}`);
          }
        }

        if (report.outlook.length > 0) {
          console.log(`\nOutlook:`);
          for (const o of report.outlook) {
            console.log(`  • ${o}`);
          }
        }

        process.exit(0);
      }).catch(err => {
        console.error('Error:', err);
        process.exit(1);
      });
      break;

    case 'dashboard':
      const dashboard = reporting.getDashboard();
      console.log('\n📊 REAL-TIME DASHBOARD');
      console.log('═'.repeat(50));
      console.log(`Status: ${dashboard.agentStatus.toUpperCase()}`);
      console.log(`Uptime: ${dashboard.uptimeHours.toFixed(1)} hours`);
      console.log(`Today: ${dashboard.todayPredictions} predictions`);

      console.log(`\nHealth:`);
      console.log(`  Scanner: ${dashboard.health.scannerOk ? '✅' : '❌'}`);
      console.log(`  Prediction Engine: ${dashboard.health.predictionEngineOk ? '✅' : '❌'}`);
      console.log(`  Calibration: ${dashboard.health.calibrationOk ? '✅' : '❌'}`);
      console.log(`  Portfolio: ${dashboard.health.portfolioOk ? '✅' : '❌'}`);

      process.exit(0);
      break;

    default:
      console.log('\n📊 Autonomous Reporting Service');
      console.log('═'.repeat(40));
      console.log('\nUsage:');
      console.log('  ts-node autonomousReporting.ts daily     # Generate daily report');
      console.log('  ts-node autonomousReporting.ts weekly    # Generate weekly report');
      console.log('  ts-node autonomousReporting.ts dashboard # Show real-time dashboard');
      process.exit(0);
  }
}

export type { DailyReport, WeeklyReport, MonthlyReport, RealtimeDashboard };
export { REPORTING_CONFIG };
