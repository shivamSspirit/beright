/**
 * BeRight Automation Service
 *
 * This is the main automation entry point that runs:
 * 1. Market Watcher - Monitors predictions for auto-resolution
 * 2. Notification Processor - Sends resolution alerts
 * 3. Leaderboard Refresher - Keeps rankings up to date
 *
 * Usage:
 *   npx ts-node services/automation.ts         # Run once then exit
 *   npx ts-node services/automation.ts daemon  # Run continuously
 *   npx ts-node services/automation.ts status  # Check status
 */

import { MarketWatcher, getMarketWatcher } from './marketWatcher';
import { supabase } from '../lib/supabase/client';
import { processNotificationQueue } from './notificationDelivery';
import { checkAndQueueAlerts } from './marketAlerts';
import { generateAllWeeklySummaries } from './weeklySummary';

// Configuration
const CONFIG = {
  // How often to check for market resolutions (ms)
  pollFrequencyMs: 60000, // 1 minute

  // How often to process notification queue (ms)
  notificationIntervalMs: 30000, // 30 seconds

  // How often to check for market closing alerts (ms)
  marketAlertIntervalMs: 3600000, // 1 hour

  // Whether to use WebSocket for real-time updates
  useWebSocket: true,

  // Maximum concurrent notifications to process
  maxConcurrentNotifications: 10,

  // Weekly summary day (0 = Sunday, 1 = Monday, etc.)
  weeklySummaryDay: 0,
  weeklySummaryHour: 9, // 9 AM
};

// State
let isRunning = false;
let notificationInterval: NodeJS.Timeout | null = null;
let marketAlertInterval: NodeJS.Timeout | null = null;
let weeklySummaryTimeout: NodeJS.Timeout | null = null;

/**
 * Process pending notifications from the queue
 */
async function processNotificationQueue(): Promise<number> {
  try {
    // Get pending notifications
    const { data: notifications, error } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(CONFIG.maxConcurrentNotifications);

    if (error || !notifications || notifications.length === 0) {
      return 0;
    }

    console.log(`[Automation] Processing ${notifications.length} notifications`);

    let processed = 0;

    for (const notification of notifications) {
      try {
        // TODO: Actually send notifications via Telegram
        // For now, just mark as sent
        console.log(`[Notification] ${notification.notification_type}: ${notification.title}`);

        await supabase
          .from('notification_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', notification.id);

        processed++;
      } catch (err) {
        console.error(`[Notification] Failed to process ${notification.id}:`, err);

        await supabase
          .from('notification_queue')
          .update({
            status: 'failed',
            error: err instanceof Error ? err.message : 'Unknown error',
          })
          .eq('id', notification.id);
      }
    }

    return processed;
  } catch (err) {
    console.error('[Automation] Notification processing error:', err);
    return 0;
  }
}

/**
 * Refresh the leaderboard materialized view
 */
async function refreshLeaderboard(): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('refresh_leaderboard_v2');

    if (error) {
      console.error('[Automation] Leaderboard refresh failed:', error);
      return false;
    }

    console.log('[Automation] Leaderboard refreshed');
    return true;
  } catch (err) {
    console.error('[Automation] Leaderboard refresh error:', err);
    return false;
  }
}

/**
 * Start the automation service
 */
async function start(): Promise<void> {
  if (isRunning) {
    console.log('[Automation] Already running');
    return;
  }

  console.log('[Automation] Starting BeRight automation service...');
  console.log(`[Automation] Config: poll=${CONFIG.pollFrequencyMs}ms, ws=${CONFIG.useWebSocket}`);

  isRunning = true;

  // Start Market Watcher
  const watcher = getMarketWatcher();

  watcher.on('predictionResolved', async (data) => {
    console.log(`[Automation] Prediction resolved: ${data.predictionId}`);
    console.log(`  Question: ${data.question?.slice(0, 50)}...`);
    console.log(`  Outcome: ${data.outcome}`);
    console.log(`  Brier: ${data.brierScore.toFixed(4)} (${data.quality})`);

    // Leaderboard is auto-refreshed via trigger, but we can force refresh here too
    // await refreshLeaderboard();
  });

  watcher.on('marketResolved', async (data) => {
    console.log(`[Automation] Market resolved: ${data.ticker} = ${data.outcome}`);
    console.log(`  Resolved ${data.results.length} predictions`);
  });

  await watcher.start();

  // Start notification processor
  notificationInterval = setInterval(async () => {
    const result = await processNotificationQueue({ limit: CONFIG.maxConcurrentNotifications });
    if (result.processed > 0) {
      console.log(`[Automation] Processed ${result.succeeded}/${result.processed} notifications`);
    }
  }, CONFIG.notificationIntervalMs);

  // Start market alert checker
  marketAlertInterval = setInterval(async () => {
    console.log('[Automation] Checking for market closing alerts...');
    const result = await checkAndQueueAlerts();
    if (result.alertsQueued > 0) {
      console.log(`[Automation] Queued ${result.alertsQueued} market closing alerts`);
    }
  }, CONFIG.marketAlertIntervalMs);

  // Initial market alert check
  checkAndQueueAlerts().catch(err => {
    console.error('[Automation] Initial market alert check failed:', err);
  });

  // Schedule weekly summary (check every hour if it's time)
  scheduleWeeklySummary();

  console.log('[Automation] Service started successfully');
  console.log('[Automation] Press Ctrl+C to stop');
}

/**
 * Schedule weekly summary generation
 */
function scheduleWeeklySummary(): void {
  const checkAndSchedule = async () => {
    const now = new Date();
    const isTargetDay = now.getDay() === CONFIG.weeklySummaryDay;
    const isTargetHour = now.getHours() === CONFIG.weeklySummaryHour;

    if (isTargetDay && isTargetHour) {
      console.log('[Automation] Running weekly summary generation...');
      try {
        const result = await generateAllWeeklySummaries();
        console.log(`[Automation] Weekly summaries: ${result.generated} generated, ${result.queued} queued`);
      } catch (err) {
        console.error('[Automation] Weekly summary generation failed:', err);
      }
    }

    // Check again in 1 hour
    weeklySummaryTimeout = setTimeout(checkAndSchedule, 3600000);
  };

  // Start checking
  checkAndSchedule();
}

/**
 * Stop the automation service
 */
function stop(): void {
  console.log('[Automation] Stopping...');

  isRunning = false;

  const watcher = getMarketWatcher();
  watcher.stop();

  if (notificationInterval) {
    clearInterval(notificationInterval);
    notificationInterval = null;
  }

  if (marketAlertInterval) {
    clearInterval(marketAlertInterval);
    marketAlertInterval = null;
  }

  if (weeklySummaryTimeout) {
    clearTimeout(weeklySummaryTimeout);
    weeklySummaryTimeout = null;
  }

  console.log('[Automation] Service stopped');
}

/**
 * Get service status
 */
function getStatus(): {
  isRunning: boolean;
  watcher: ReturnType<MarketWatcher['getStatus']>;
} {
  const watcher = getMarketWatcher();

  return {
    isRunning,
    watcher: watcher.getStatus(),
  };
}

/**
 * Print status to console
 */
function printStatus(): void {
  const status = getStatus();

  console.log('\n[Automation] Service Status');
  console.log('═'.repeat(50));
  console.log(`Running: ${status.isRunning ? 'YES' : 'NO'}`);
  console.log(`Watcher Running: ${status.watcher.isRunning ? 'YES' : 'NO'}`);
  console.log(`Watched Markets: ${status.watcher.watchedMarkets}`);
  console.log(`Pending Predictions: ${status.watcher.pendingPredictions}`);
  console.log(`WebSocket: ${status.watcher.useWebSocket ? 'ENABLED' : 'DISABLED'}`);
  console.log(`WebSocket Connected: ${status.watcher.wsConnected ? 'YES' : 'NO'}`);
  console.log('═'.repeat(50));
}

/**
 * Run once (check all markets, process notifications, exit)
 */
async function runOnce(): Promise<void> {
  console.log('[Automation] Running single check...');

  const watcher = getMarketWatcher();

  // Load and check markets
  await watcher.start();

  // Give it time to check markets
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Process any pending notifications
  const processed = await processNotificationQueue();
  console.log(`[Automation] Processed ${processed} notifications`);

  // Refresh leaderboard
  await refreshLeaderboard();

  // Stop
  watcher.stop();

  console.log('[Automation] Single check complete');
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2] || 'once';

  switch (command) {
    case 'daemon':
    case 'start':
    case 'loop':
      start().catch(console.error);

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n[Automation] Received SIGINT, shutting down...');
        stop();
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        console.log('\n[Automation] Received SIGTERM, shutting down...');
        stop();
        process.exit(0);
      });
      break;

    case 'status':
      printStatus();
      break;

    case 'once':
    default:
      runOnce().then(() => {
        process.exit(0);
      }).catch((err) => {
        console.error('[Automation] Error:', err);
        process.exit(1);
      });
      break;
  }
}

// Exports
export {
  start,
  stop,
  getStatus,
  processNotificationQueue,
  refreshLeaderboard,
  CONFIG,
};
