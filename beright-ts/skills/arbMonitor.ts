/**
 * Arbitrage Monitor Skill
 *
 * Integrates the production arbitrage monitor with:
 * - Telegram alerts for immediate notification
 * - Heartbeat integration for 24/7 scanning
 * - User subscription management
 *
 * Usage:
 *   /arb-monitor start   - Start monitoring (admin only)
 *   /arb-monitor stop    - Stop monitoring
 *   /arb-monitor status  - Show current status
 *   /arb-subscribe       - Subscribe to arb alerts
 *   /arb-unsubscribe     - Unsubscribe from alerts
 */

import * as fs from 'fs';
import * as path from 'path';
import { SkillResponse } from '../types/index';
import {
  startMonitor,
  stopMonitor,
  getMonitorStatus,
  quickScan,
  getActiveOpportunities,
  formatOpportunityAlert,
  refreshRegistry,
  getRegistry,
} from '../lib/arbitrage/monitor';
import { DEFAULT_ARBITRAGE_CONFIG } from '../lib/arbitrage/types';

// File path for persisting subscribers
const MEMORY_DIR = path.join(process.cwd(), 'memory');
const SUBSCRIBERS_FILE = path.join(MEMORY_DIR, 'arb-subscribers.json');

// Telegram alert sending (will be injected)
type TelegramAlertSender = (chatId: string, message: string) => Promise<void>;
let telegramSender: TelegramAlertSender | null = null;

// ============================================
// DEDUPLICATION: Prevent repeated alerts for same opportunity
// ============================================
interface SentAlert {
  key: string;
  sentAt: number;
  profit: number;
}

// Cache of recently sent alerts - key -> timestamp
const sentAlertsCache = new Map<string, SentAlert>();

// Don't re-alert same opportunity for 30 minutes
const ALERT_COOLDOWN_MS = 30 * 60 * 1000;

// Only re-alert if profit increased significantly (5% higher)
const PROFIT_CHANGE_THRESHOLD = 5;

/**
 * Generate unique key for an opportunity
 */
function getOpportunityKey(opp: {
  pair: {
    marketA: { platform: string; title: string };
    marketB: { platform: string; title: string };
  };
}): string {
  // Normalize: sort platforms alphabetically to handle A-B vs B-A
  const platforms = [opp.pair.marketA.platform, opp.pair.marketB.platform].sort();
  const titleNormalized = opp.pair.marketA.title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 50);
  return `${platforms[0]}-${platforms[1]}-${titleNormalized}`;
}

/**
 * Check if we should send alert (deduplication)
 */
function shouldSendAlert(key: string, currentProfit: number): boolean {
  const existing = sentAlertsCache.get(key);
  if (!existing) return true;

  const elapsed = Date.now() - existing.sentAt;

  // Cooldown not expired - check if profit increased significantly
  if (elapsed < ALERT_COOLDOWN_MS) {
    const profitIncrease = currentProfit - existing.profit;
    if (profitIncrease >= PROFIT_CHANGE_THRESHOLD) {
      console.log(`[ArbMonitor] Re-alerting: profit jumped ${profitIncrease.toFixed(2)}%`);
      return true;
    }
    return false;
  }

  // Cooldown expired, ok to send
  return true;
}

/**
 * Record that we sent an alert
 */
function recordSentAlert(key: string, profit: number): void {
  sentAlertsCache.set(key, {
    key,
    sentAt: Date.now(),
    profit,
  });

  // Cleanup old entries (older than 2 hours)
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  const entries = Array.from(sentAlertsCache.entries());
  for (const [k, v] of entries) {
    if (v.sentAt < twoHoursAgo) {
      sentAlertsCache.delete(k);
    }
  }
}

/**
 * Load subscribers from file
 */
function loadSubscribers(): Set<string> {
  try {
    if (fs.existsSync(SUBSCRIBERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf-8'));
      if (Array.isArray(data)) {
        console.log(`[ArbMonitor] Loaded ${data.length} subscribers from file`);
        return new Set(data);
      }
    }
  } catch (e) {
    console.error('[ArbMonitor] Error loading subscribers:', e);
  }
  return new Set();
}

/**
 * Save subscribers to file
 */
function saveSubscribers(subs: Set<string>): void {
  try {
    if (!fs.existsSync(MEMORY_DIR)) {
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
    }
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(Array.from(subs), null, 2));
  } catch (e) {
    console.error('[ArbMonitor] Error saving subscribers:', e);
  }
}

// Subscriber list (chat IDs that want arb alerts) - loaded from file
const subscribers = loadSubscribers();

// Admin list (can start/stop monitor)
const ADMIN_IDS = process.env.SUPER_ADMIN_TELEGRAM_ID?.split(',') || ['5504043269'];

/**
 * Set the telegram sender function
 */
export function setTelegramSender(sender: TelegramAlertSender): void {
  telegramSender = sender;
}

/**
 * Send alert to all subscribers
 */
async function broadcastAlert(message: string): Promise<void> {
  if (!telegramSender) {
    console.log('[ArbMonitor] No telegram sender configured');
    return;
  }

  // Use Array.from() for TypeScript compatibility with downlevelIteration
  const chatIds = Array.from(subscribers);
  for (const chatId of chatIds) {
    try {
      await telegramSender(chatId, message);
    } catch (err) {
      console.error(`[ArbMonitor] Failed to send alert to ${chatId}:`, err);
    }
  }
}

/**
 * Start the monitor with telegram integration
 */
export async function startArbMonitor(intervalMs = 60000): Promise<SkillResponse> {
  const config = {
    ...DEFAULT_ARBITRAGE_CONFIG,
    minEquivalenceScore: 0.35,
    minTitleSimilarity: 0.25,
    minNetProfitPct: 0.02,
  };

  startMonitor(intervalMs, async (opp) => {
    // Send alert to all subscribers
    const message = formatOpportunityAlert(opp);
    await broadcastAlert(message);
  }, config);

  return {
    text: `
🔍 *ARBITRAGE MONITOR STARTED*

Scanning every ${intervalMs / 1000} seconds for opportunities.

Current status:
• Registry: ${getRegistry().entries.length} matched market pairs
• Subscribers: ${subscribers.size} users

When an opportunity is detected:
1. Alert sent instantly to all subscribers
2. Price tracked until opportunity closes
3. Historical data logged for analysis

Use /arb-subscribe to receive alerts.
`,
    mood: 'BULLISH',
  };
}

/**
 * Stop the monitor
 */
export function stopArbMonitor(): SkillResponse {
  stopMonitor();

  return {
    text: `
🛑 *ARBITRAGE MONITOR STOPPED*

No longer scanning for opportunities.
Use /arb-monitor start to resume.
`,
    mood: 'NEUTRAL',
  };
}

/**
 * Get monitor status
 */
export function getArbMonitorStatus(): SkillResponse {
  const status = getMonitorStatus();
  const registry = getRegistry();

  let text = `
📊 *ARBITRAGE MONITOR STATUS*

Running: ${status.isRunning ? '✅ Yes' : '❌ No'}
Last scan: ${status.lastScan.toISOString().slice(11, 19)}
Total scans: ${status.scanCount}

Registry:
• Matched pairs: ${registry.entries.length}
• Last refresh: ${registry.lastFullRefresh.toISOString().slice(0, 19)}

Opportunities:
• Active: ${status.activeOpportunities.length}
• Total found: ${status.opportunitiesFound}
• Alerts sent: ${status.alertsSent}

Subscribers: ${subscribers.size}
`;

  // Show active opportunities
  if (status.activeOpportunities.length > 0) {
    text += '\n*ACTIVE OPPORTUNITIES:*\n';
    for (const opp of status.activeOpportunities) {
      const age = Math.round((Date.now() - opp.firstSeen.getTime()) / 1000);
      text += `\n• ${opp.pair.marketA.title.slice(0, 35)}`;
      text += `\n  Profit: ${opp.currentProfit.toFixed(2)}% | Age: ${age}s`;
    }
  }

  // Show errors if any
  if (status.errors.length > 0) {
    text += '\n\n⚠️ *Recent errors:*\n';
    for (const err of status.errors.slice(-3)) {
      text += `• ${err}\n`;
    }
  }

  return {
    text,
    mood: status.activeOpportunities.length > 0 ? 'ALERT' : 'NEUTRAL',
    data: status,
  };
}

/**
 * Subscribe to alerts
 */
export function subscribeToArb(chatId: string): SkillResponse {
  subscribers.add(chatId);
  saveSubscribers(subscribers);

  return {
    text: `
✅ *SUBSCRIBED TO ARB ALERTS*

You will receive instant notifications when arbitrage opportunities are detected.

Current stats:
• Registry: ${getRegistry().entries.length} matched pairs
• Monitor running: ${getMonitorStatus().isRunning ? 'Yes' : 'No'}

Use /arb-unsubscribe to stop receiving alerts.
`,
    mood: 'BULLISH',
  };
}

/**
 * Unsubscribe from alerts
 */
export function unsubscribeFromArb(chatId: string): SkillResponse {
  subscribers.delete(chatId);
  saveSubscribers(subscribers);

  return {
    text: `
❌ *UNSUBSCRIBED FROM ARB ALERTS*

You will no longer receive arbitrage notifications.
Use /arb-subscribe to re-enable.
`,
    mood: 'NEUTRAL',
  };
}

/**
 * Quick scan (for /arb command)
 */
export async function runQuickScan(): Promise<SkillResponse> {
  console.log('[ArbMonitor] Running quick scan...');

  const result = await quickScan();

  let text = `
🔍 *ARBITRAGE QUICK SCAN*

Registry: ${result.registrySize} matched market pairs
Scan time: ${result.scanTime}ms
`;

  if (result.opportunities.length > 0) {
    text += `\n🚨 *${result.opportunities.length} ACTIVE OPPORTUNITIES*\n`;

    for (const opp of result.opportunities) {
      const age = Math.round((Date.now() - opp.firstSeen.getTime()) / 1000);
      text += `
━━━━━━━━━━━━━━━━━━━━━━━
📊 *${opp.currentProfit.toFixed(2)}% PROFIT*

${opp.pair.marketA.title.slice(0, 45)}

• ${opp.pair.marketA.platform} vs ${opp.pair.marketB.platform}
• Match confidence: ${(opp.pair.equivalenceScore * 100).toFixed(0)}%
• First seen: ${age}s ago
• Peak profit: ${opp.peakProfit.toFixed(2)}%

⚡ Act fast!
`;
    }
  } else {
    text += `
No arbitrage opportunities at this moment.

This is normal - real arbitrage is rare and captured quickly.

💡 *Tips:*
• Use /arb-subscribe to get instant alerts
• Monitor runs 24/7 for early detection
• Most opportunities last < 60 seconds
`;
  }

  return {
    text,
    mood: result.opportunities.length > 0 ? 'ALERT' : 'NEUTRAL',
    data: result,
  };
}

/**
 * Refresh the market registry
 */
export async function refreshArbRegistry(): Promise<SkillResponse> {
  console.log('[ArbMonitor] Refreshing registry...');

  await refreshRegistry();
  const registry = getRegistry();

  let text = `
🔄 *REGISTRY REFRESHED*

Matched pairs: ${registry.entries.length}
Last update: ${registry.lastFullRefresh.toISOString().slice(0, 19)}

*Top matched pairs:*
`;

  for (const entry of registry.entries.slice(0, 10)) {
    text += `\n• ${entry.marketA.platform}: ${entry.marketA.title.slice(0, 30)}`;
    text += `\n  ${entry.marketB.platform}: ${entry.marketB.title.slice(0, 30)}`;
    text += `\n  Equiv: ${(entry.equivalenceScore * 100).toFixed(0)}%\n`;
  }

  return {
    text,
    mood: 'NEUTRAL',
    data: registry,
  };
}

/**
 * Main handler for /arb-monitor command
 */
export async function handleArbMonitorCommand(
  command: string,
  userId: string
): Promise<SkillResponse> {
  const isAdmin = ADMIN_IDS.includes(userId);
  const parts = command.toLowerCase().split(' ');
  const action = parts[1] || 'status';

  switch (action) {
    case 'start':
      if (!isAdmin) {
        return {
          text: '⛔ Only admins can start the monitor.',
          mood: 'NEUTRAL',
        };
      }
      return startArbMonitor();

    case 'stop':
      if (!isAdmin) {
        return {
          text: '⛔ Only admins can stop the monitor.',
          mood: 'NEUTRAL',
        };
      }
      return stopArbMonitor();

    case 'status':
      return getArbMonitorStatus();

    case 'refresh':
      return refreshArbRegistry();

    case 'scan':
      return runQuickScan();

    default:
      return {
        text: `
📖 *ARBITRAGE MONITOR COMMANDS*

/arb-monitor status  - Show current status
/arb-monitor scan    - Quick scan for opportunities
/arb-monitor refresh - Refresh market registry
/arb-monitor start   - Start 24/7 monitoring (admin)
/arb-monitor stop    - Stop monitoring (admin)

/arb-subscribe       - Get instant arb alerts
/arb-unsubscribe     - Stop receiving alerts
`,
        mood: 'NEUTRAL',
      };
  }
}

/**
 * Broadcast an opportunity alert to all subscribers
 * Called by heartbeat when opportunities are detected
 *
 * DEDUPLICATION: Will skip if same opportunity was alerted in last 30 minutes
 * unless profit increased by 5%+ (significant move worth re-alerting)
 */
export async function broadcastOpportunityToSubscribers(opp: {
  pair: {
    marketA: { platform: string; title: string };
    marketB: { platform: string; title: string };
    equivalenceScore: number;
  };
  currentProfit: number;
  peakProfit: number;
  firstSeen: Date;
}): Promise<number> {
  if (!telegramSender) {
    console.log('[ArbMonitor] No telegram sender configured');
    return 0;
  }

  // DEDUPLICATION CHECK
  const oppKey = getOpportunityKey(opp);
  if (!shouldSendAlert(oppKey, opp.currentProfit)) {
    console.log(`[ArbMonitor] Skipping duplicate alert for: ${oppKey.slice(0, 50)}...`);
    return 0;
  }

  const subscriberList = Array.from(subscribers);
  if (subscriberList.length === 0) {
    console.log('[ArbMonitor] No subscribers to alert');
    return 0;
  }

  const age = Math.round((Date.now() - opp.firstSeen.getTime()) / 1000);
  const message = `
🚨 *ARBITRAGE ALERT*

${opp.pair.marketA.title.slice(0, 50)}

📊 *PROFIT: ${opp.currentProfit.toFixed(2)}%*

Platform A: ${opp.pair.marketA.platform}
Platform B: ${opp.pair.marketB.platform}

Match confidence: ${(opp.pair.equivalenceScore * 100).toFixed(0)}%
First seen: ${age}s ago
Peak profit: ${opp.peakProfit.toFixed(2)}%

⚡ ACT FAST - Opportunities close quickly!
`;

  let sentCount = 0;
  for (const chatId of subscriberList) {
    try {
      await telegramSender(chatId, message);
      sentCount++;
    } catch (err) {
      console.error(`[ArbMonitor] Failed to send alert to ${chatId}:`, err);
    }
  }

  // Record that we sent this alert (for deduplication)
  recordSentAlert(oppKey, opp.currentProfit);

  console.log(`[ArbMonitor] Broadcast alert to ${sentCount}/${subscriberList.length} subscribers`);
  return sentCount;
}

// Export for heartbeat integration
export {
  quickScan as heartbeatArbScan,
  getActiveOpportunities,
  subscribers as arbSubscribers,
};
