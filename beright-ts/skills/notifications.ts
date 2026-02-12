/**
 * Notifications Skill for BeRight Protocol
 * Handles outbound alerts to Telegram users
 *
 * Features:
 * - Morning brief push at user-preferred time
 * - Real-time arb alerts (>5% spread)
 * - Whale movement alerts (>$50K)
 * - Price alerts (user-defined thresholds)
 */

import * as fs from 'fs';
import * as path from 'path';
import { SkillResponse, ArbitrageOpportunity } from '../types/index';
import { getAllUsers, UserIdentity, updateUserSettings } from '../lib/identity';
import { formatBriefTelegram, generateMorningBrief } from './brief';
import { formatUsd, formatPct, timestamp } from './utils';

const MEMORY_DIR = path.join(process.cwd(), 'memory');
const ALERTS_FILE = path.join(MEMORY_DIR, 'alerts.json');
const SUBSCRIBERS_FILE = path.join(MEMORY_DIR, 'subscribers.json');

// ============================================
// TYPES
// ============================================

interface AlertConfig {
  type: 'arb' | 'whale' | 'price' | 'brief';
  enabled: boolean;
  threshold?: number; // For arb: spread %, for whale: USD amount
  marketId?: string;  // For price alerts
  targetPrice?: number;
}

interface Subscriber {
  telegramId: string;
  username?: string;
  alerts: AlertConfig[];
  briefTime: string; // "08:00" format
  timezone: string;
  lastBriefSent?: string;
  createdAt: string;
}

interface PendingAlert {
  id: string;
  type: 'arb' | 'whale' | 'price' | 'brief';
  message: string;
  targetUsers: string[]; // Telegram IDs
  createdAt: string;
  sentAt?: string;
  data?: any;
}

// ============================================
// SUBSCRIBER MANAGEMENT
// ============================================

function loadSubscribers(): Record<string, Subscriber> {
  try {
    if (fs.existsSync(SUBSCRIBERS_FILE)) {
      return JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Error loading subscribers:', error);
  }
  return {};
}

function saveSubscribers(subs: Record<string, Subscriber>): void {
  try {
    if (!fs.existsSync(MEMORY_DIR)) {
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
    }
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subs, null, 2));
  } catch (error) {
    console.error('Error saving subscribers:', error);
  }
}

/**
 * Subscribe a user to alerts
 */
export function subscribe(
  telegramId: string,
  username?: string,
  options: Partial<Subscriber> = {}
): Subscriber {
  const subs = loadSubscribers();

  const defaultAlerts: AlertConfig[] = [
    { type: 'brief', enabled: true },
    { type: 'arb', enabled: true, threshold: 5 }, // >5% spread
    { type: 'whale', enabled: true, threshold: 50000 }, // >$50K
  ];

  const subscriber: Subscriber = {
    telegramId,
    username,
    alerts: options.alerts || defaultAlerts,
    briefTime: options.briefTime || '08:00',
    timezone: options.timezone || 'UTC',
    createdAt: new Date().toISOString(),
    ...options,
  };

  subs[telegramId] = subscriber;
  saveSubscribers(subs);

  console.log(`Subscribed user ${telegramId} to alerts`);
  return subscriber;
}

/**
 * Unsubscribe a user from all alerts
 */
export function unsubscribe(telegramId: string): boolean {
  const subs = loadSubscribers();
  if (subs[telegramId]) {
    delete subs[telegramId];
    saveSubscribers(subs);
    return true;
  }
  return false;
}

/**
 * Get subscriber by Telegram ID
 */
export function getSubscriber(telegramId: string): Subscriber | null {
  const subs = loadSubscribers();
  return subs[telegramId] || null;
}

/**
 * Update subscriber settings
 */
export function updateSubscriber(
  telegramId: string,
  updates: Partial<Subscriber>
): Subscriber | null {
  const subs = loadSubscribers();
  if (!subs[telegramId]) return null;

  subs[telegramId] = { ...subs[telegramId], ...updates };
  saveSubscribers(subs);
  return subs[telegramId];
}

/**
 * Get all subscribers for a specific alert type
 */
export function getSubscribersForAlert(alertType: 'arb' | 'whale' | 'price' | 'brief'): Subscriber[] {
  const subs = loadSubscribers();
  return Object.values(subs).filter(sub =>
    sub.alerts.some(a => a.type === alertType && a.enabled)
  );
}

// ============================================
// ALERT GENERATION
// ============================================

/**
 * Generate morning brief alerts for all subscribers
 */
export async function generateMorningBriefAlerts(): Promise<PendingAlert[]> {
  const subscribers = getSubscribersForAlert('brief');
  const alerts: PendingAlert[] = [];

  if (subscribers.length === 0) {
    console.log('No subscribers for morning brief');
    return alerts;
  }

  // Check which users need their brief (based on time)
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();
  const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

  const eligibleUsers: string[] = [];

  for (const sub of subscribers) {
    // Check if it's time for their brief (within 5 minute window)
    const [briefHour, briefMinute] = sub.briefTime.split(':').map(Number);
    const timeDiff = Math.abs((currentHour * 60 + currentMinute) - (briefHour * 60 + briefMinute));

    if (timeDiff <= 5) {
      // Check if we already sent today
      if (sub.lastBriefSent) {
        const lastSent = new Date(sub.lastBriefSent);
        if (lastSent.toDateString() === now.toDateString()) {
          continue; // Already sent today
        }
      }
      eligibleUsers.push(sub.telegramId);
    }
  }

  if (eligibleUsers.length === 0) {
    return alerts;
  }

  // Generate the brief
  try {
    const briefData = await generateMorningBrief();
    const briefText = formatBriefTelegram(briefData);

    alerts.push({
      id: `brief_${Date.now()}`,
      type: 'brief',
      message: briefText,
      targetUsers: eligibleUsers,
      createdAt: new Date().toISOString(),
      data: briefData,
    });

    // Update lastBriefSent for all eligible users
    const subs = loadSubscribers();
    for (const telegramId of eligibleUsers) {
      if (subs[telegramId]) {
        subs[telegramId].lastBriefSent = new Date().toISOString();
      }
    }
    saveSubscribers(subs);

    console.log(`Generated morning brief for ${eligibleUsers.length} users`);
  } catch (error) {
    console.error('Failed to generate morning brief:', error);
  }

  return alerts;
}

/**
 * Generate arbitrage alerts
 */
export function generateArbAlerts(opportunities: ArbitrageOpportunity[]): PendingAlert[] {
  const subscribers = getSubscribersForAlert('arb');
  const alerts: PendingAlert[] = [];

  if (subscribers.length === 0 || opportunities.length === 0) {
    return alerts;
  }

  for (const opp of opportunities) {
    // Find users whose threshold is met
    const eligibleUsers = subscribers
      .filter(sub => {
        const arbConfig = sub.alerts.find(a => a.type === 'arb');
        return arbConfig && opp.spread >= (arbConfig.threshold || 5);
      })
      .map(sub => sub.telegramId);

    if (eligibleUsers.length > 0) {
      const message = `
🚨 *ARB ALERT*
${'─'.repeat(30)}

📊 *${opp.topic.slice(0, 50)}*

${opp.platformA}: ${formatPct(opp.priceAYes)} YES
${opp.platformB}: ${formatPct(opp.priceBYes)} YES

💰 *Spread: ${formatPct(opp.spread)}*
📈 Potential: ${opp.profitPercent.toFixed(1)}%

Strategy: ${opp.strategy}

/research ${opp.topic.split(' ').slice(0, 3).join(' ')}
`;

      alerts.push({
        id: `arb_${Date.now()}_${opp.topic.slice(0, 10)}`,
        type: 'arb',
        message,
        targetUsers: eligibleUsers,
        createdAt: new Date().toISOString(),
        data: opp,
      });
    }
  }

  return alerts;
}

/**
 * Generate whale alerts
 */
export function generateWhaleAlerts(whaleMovements: any[]): PendingAlert[] {
  const subscribers = getSubscribersForAlert('whale');
  const alerts: PendingAlert[] = [];

  if (subscribers.length === 0 || whaleMovements.length === 0) {
    return alerts;
  }

  for (const whale of whaleMovements) {
    // Find users whose threshold is met
    const eligibleUsers = subscribers
      .filter(sub => {
        const whaleConfig = sub.alerts.find(a => a.type === 'whale');
        return whaleConfig && whale.totalUsd >= (whaleConfig.threshold || 50000);
      })
      .map(sub => sub.telegramId);

    if (eligibleUsers.length > 0) {
      const message = `
🐋 *WHALE ALERT*
${'─'.repeat(30)}

@${whale.whaleName || 'Unknown'}
${whale.wallet.slice(0, 8)}...${whale.wallet.slice(-6)}

💰 *${formatUsd(whale.totalUsd)}*
📝 ${whale.description || whale.type}

${whale.whaleAccuracy ? `Accuracy: ${(whale.whaleAccuracy * 100).toFixed(0)}%` : ''}

/wallet ${whale.wallet}
`;

      alerts.push({
        id: `whale_${Date.now()}_${whale.wallet.slice(0, 8)}`,
        type: 'whale',
        message,
        targetUsers: eligibleUsers,
        createdAt: new Date().toISOString(),
        data: whale,
      });
    }
  }

  return alerts;
}

// ============================================
// ALERT QUEUE
// ============================================

function loadAlertQueue(): PendingAlert[] {
  try {
    if (fs.existsSync(ALERTS_FILE)) {
      return JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Error loading alerts:', error);
  }
  return [];
}

function saveAlertQueue(alerts: PendingAlert[]): void {
  try {
    if (!fs.existsSync(MEMORY_DIR)) {
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
    }
    fs.writeFileSync(ALERTS_FILE, JSON.stringify(alerts, null, 2));
  } catch (error) {
    console.error('Error saving alerts:', error);
  }
}

/**
 * Queue alerts for sending
 */
export function queueAlerts(alerts: PendingAlert[]): void {
  const queue = loadAlertQueue();
  queue.push(...alerts);
  saveAlertQueue(queue);
  console.log(`Queued ${alerts.length} alerts`);
}

/**
 * Get pending alerts to send
 */
export function getPendingAlerts(): PendingAlert[] {
  const queue = loadAlertQueue();
  return queue.filter(a => !a.sentAt);
}

/**
 * Mark alert as sent
 */
export function markAlertSent(alertId: string): void {
  const queue = loadAlertQueue();
  const alert = queue.find(a => a.id === alertId);
  if (alert) {
    alert.sentAt = new Date().toISOString();
    saveAlertQueue(queue);
  }
}

// ============================================
// TELEGRAM HANDLER COMMANDS
// ============================================

/**
 * Handle /subscribe command
 */
export function handleSubscribe(telegramId: string, username?: string, args?: string): SkillResponse {
  const existing = getSubscriber(telegramId);

  if (existing) {
    return {
      text: `
✅ *ALREADY SUBSCRIBED*

You're receiving:
${existing.alerts.filter(a => a.enabled).map(a => `• ${a.type.toUpperCase()} alerts`).join('\n')}

Brief time: ${existing.briefTime} UTC

/unsubscribe to stop all alerts
/alerts to manage settings
`,
      mood: 'NEUTRAL',
    };
  }

  const sub = subscribe(telegramId, username);

  return {
    text: `
✅ *SUBSCRIBED TO ALERTS*
${'─'.repeat(35)}

You'll now receive:
• 🌅 Morning brief at ${sub.briefTime} UTC
• 🚨 Arb alerts (>5% spread)
• 🐋 Whale alerts (>$50K moves)

/alerts - Manage alert settings
/unsubscribe - Stop all alerts
`,
    mood: 'BULLISH',
  };
}

/**
 * Handle /unsubscribe command
 */
export function handleUnsubscribe(telegramId: string): SkillResponse {
  const success = unsubscribe(telegramId);

  if (success) {
    return {
      text: `
🔕 *UNSUBSCRIBED*

You'll no longer receive alerts.

/subscribe to re-enable alerts
`,
      mood: 'NEUTRAL',
    };
  }

  return {
    text: `You weren't subscribed to alerts.\n\n/subscribe to start receiving alerts`,
    mood: 'NEUTRAL',
  };
}

/**
 * Handle /alerts command - manage alert settings
 */
export function handleAlerts(telegramId: string, args?: string): SkillResponse {
  const sub = getSubscriber(telegramId);

  if (!sub) {
    return {
      text: `You're not subscribed to alerts.\n\n/subscribe to start`,
      mood: 'NEUTRAL',
    };
  }

  // Parse args for updates
  if (args) {
    const parts = args.toLowerCase().split(' ');
    const action = parts[0]; // on/off
    const alertType = parts[1]; // arb/whale/brief

    if ((action === 'on' || action === 'off') && alertType) {
      const alerts = [...sub.alerts];
      const alertConfig = alerts.find(a => a.type === alertType);
      if (alertConfig) {
        alertConfig.enabled = action === 'on';
        updateSubscriber(telegramId, { alerts });

        return {
          text: `${alertType.toUpperCase()} alerts turned ${action.toUpperCase()}`,
          mood: 'NEUTRAL',
        };
      }
    }

    // Update threshold
    if (parts[0] === 'threshold' && parts[1] && parts[2]) {
      const alertType = parts[1] as 'arb' | 'whale';
      const threshold = parseFloat(parts[2]);

      const alerts = [...sub.alerts];
      const alertConfig = alerts.find(a => a.type === alertType);
      if (alertConfig && !isNaN(threshold)) {
        alertConfig.threshold = threshold;
        updateSubscriber(telegramId, { alerts });

        return {
          text: `${alertType.toUpperCase()} threshold set to ${alertType === 'arb' ? threshold + '%' : formatUsd(threshold)}`,
          mood: 'NEUTRAL',
        };
      }
    }

    // Update brief time
    if (parts[0] === 'time' && parts[1]) {
      const timeMatch = parts[1].match(/(\d{1,2}):?(\d{2})?/);
      if (timeMatch) {
        const hour = timeMatch[1].padStart(2, '0');
        const minute = (timeMatch[2] || '00').padStart(2, '0');
        const briefTime = `${hour}:${minute}`;

        updateSubscriber(telegramId, { briefTime });

        return {
          text: `Morning brief time set to ${briefTime} UTC`,
          mood: 'NEUTRAL',
        };
      }
    }
  }

  // Show current settings
  let text = `
⚙️ *ALERT SETTINGS*
${'─'.repeat(35)}

`;

  for (const alert of sub.alerts) {
    const status = alert.enabled ? '✅' : '❌';
    let details = '';
    if (alert.type === 'arb') details = ` (>${alert.threshold}% spread)`;
    if (alert.type === 'whale') details = ` (>${formatUsd(alert.threshold || 50000)})`;
    if (alert.type === 'brief') details = ` at ${sub.briefTime} UTC`;

    text += `${status} ${alert.type.toUpperCase()}${details}\n`;
  }

  text += `
*Commands:*
/alerts on arb - Enable arb alerts
/alerts off whale - Disable whale alerts
/alerts threshold arb 8 - Set arb threshold to 8%
/alerts threshold whale 100000 - Set whale to $100K
/alerts time 09:00 - Set brief time to 9am UTC
`;

  return { text, mood: 'NEUTRAL', data: sub };
}

// ============================================
// MAIN NOTIFICATION CHECK
// ============================================

/**
 * Run notification check (called by heartbeat)
 * NOW ACTUALLY SENDS ALERTS TO TELEGRAM USERS!
 */
export async function checkAndSendNotifications(): Promise<number> {
  let alertsSent = 0;

  // Check for morning briefs
  const briefAlerts = await generateMorningBriefAlerts();
  if (briefAlerts.length > 0) {
    queueAlerts(briefAlerts);
  }

  // Get pending alerts
  const pending = getPendingAlerts();

  if (pending.length === 0) {
    return 0;
  }

  console.log(`[Notifications] ${pending.length} alerts pending to send`);

  // Import telegram sender
  const { sendTelegramMessage } = await import('../services/notificationDelivery');

  // ACTUALLY SEND ALERTS TO TELEGRAM USERS
  for (const alert of pending) {
    for (const userId of alert.targetUsers) {
      try {
        const result = await sendTelegramMessage(userId, alert.message, { parseMode: 'Markdown' });

        if (result.success) {
          alertsSent++;
          console.log(`[Notifications] ✅ Sent ${alert.type} alert to user ${userId}`);
        } else {
          console.warn(`[Notifications] ❌ Failed to send to ${userId}: ${result.error}`);
        }
      } catch (err) {
        console.error(`[Notifications] Error sending to ${userId}:`, err);
      }
    }

    // Mark as sent
    markAlertSent(alert.id);
  }

  console.log(`[Notifications] Sent ${alertsSent} alerts to users`);
  return alertsSent;
}

/**
 * Get notification stats
 */
export function getNotificationStats(): {
  totalSubscribers: number;
  briefSubscribers: number;
  arbSubscribers: number;
  whaleSubscribers: number;
  pendingAlerts: number;
} {
  const subs = loadSubscribers();
  const queue = loadAlertQueue();

  return {
    totalSubscribers: Object.keys(subs).length,
    briefSubscribers: getSubscribersForAlert('brief').length,
    arbSubscribers: getSubscribersForAlert('arb').length,
    whaleSubscribers: getSubscribersForAlert('whale').length,
    pendingAlerts: queue.filter(a => !a.sentAt).length,
  };
}

// CLI interface
if (process.argv[1]?.endsWith('notifications.ts')) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'stats') {
    const stats = getNotificationStats();
    console.log('Notification Stats:');
    console.log(`  Total subscribers: ${stats.totalSubscribers}`);
    console.log(`  Brief subscribers: ${stats.briefSubscribers}`);
    console.log(`  Arb subscribers: ${stats.arbSubscribers}`);
    console.log(`  Whale subscribers: ${stats.whaleSubscribers}`);
    console.log(`  Pending alerts: ${stats.pendingAlerts}`);
  } else if (command === 'check') {
    checkAndSendNotifications().then(count => {
      console.log(`Generated ${count} alerts`);
    });
  } else if (command === 'pending') {
    const pending = getPendingAlerts();
    console.log(`Pending alerts: ${pending.length}`);
    for (const alert of pending.slice(0, 5)) {
      console.log(`  - ${alert.type}: ${alert.targetUsers.length} users`);
    }
  } else {
    console.log('Usage:');
    console.log('  ts-node notifications.ts stats   - View stats');
    console.log('  ts-node notifications.ts check   - Check and generate alerts');
    console.log('  ts-node notifications.ts pending - View pending alerts');
  }
}
